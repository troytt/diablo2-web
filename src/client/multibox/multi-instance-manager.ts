/**
 * Single-Tab Multi-Instance (`Multibox`) Orchestrator (`#1362` & `#1363`).
 *
 * Manages up to 8 concurrent `PlayAppController` instances inside a single browser tab:
 * - Default disabled (`multiboxEnabled: false` in `ClientSettings`), manually toggled in `#d2-config-modal`.
 * - Renders the instance switcher tab bar inside `#d2-multibox-slot` when enabled.
 * - Coordinates DOM visibility & 0-GPU background keep-alive (`setInstanceFocused`).
 * - Coordinates `AudioFocusController` (`#1363`) for automatic non-focus mute, per-slot
 *   speaker override (`🔊`/`🔇`), and background damage / low-HP (< 35%) survival alerts.
 */

import { getGameLang, onGameLangChange, type GameLang } from '../i18n/lang.ts'
import type { PlayAppController } from '../main.ts'
import type { SettingsStore } from '../settings/settings-store.ts'
import {
  AudioFocusController,
  type SlotAlertState,
  type SlotAudioOverride,
} from './audio-focus-policy.ts'
import { createStageContainer, type StageContainerRefs } from './stage-container.ts'

export const MAX_MULTIBOX_SLOTS = 8

export interface MultiboxSlotInfo {
  readonly slotId: number
  readonly controller: PlayAppController
  readonly stageRefs: StageContainerRefs
  readonly label: string
  readonly inGame: boolean
  readonly hp: number
  readonly maxHp: number
  readonly hpRatio: number
  readonly effectiveMuted: boolean
  readonly audioOverride: SlotAudioOverride
  readonly alertState: SlotAlertState
}

export interface MultiInstanceManagerOptions {
  readonly settingsStore: SettingsStore
  readonly workspaceEl: HTMLElement | null
  readonly multiboxSlotEl: HTMLElement | null
  readonly initialController: PlayAppController
  readonly initialStageRefs: StageContainerRefs
  readonly createControllerForSlot: (
    slotId: number,
    stageRefs: StageContainerRefs,
  ) => Promise<PlayAppController>
}

export class MultiInstanceManager {
  private readonly settingsStore: SettingsStore
  private readonly workspaceEl: HTMLElement | null
  private readonly multiboxSlotEl: HTMLElement | null
  private readonly createControllerForSlot: (
    slotId: number,
    stageRefs: StageContainerRefs,
  ) => Promise<PlayAppController>

  readonly audioFocus: AudioFocusController
  private readonly slots = new Map<
    number,
    {
      readonly slotId: number
      readonly controller: PlayAppController
      readonly stageRefs: StageContainerRefs
    }
  >()
  private activeSlotId = 1
  private creatingSlot = false
  private monitorTimer: ReturnType<typeof setInterval> | null = null
  private lastRenderedBarSignature = ''
  private readonly disposers: (() => void)[] = []

  constructor(options: MultiInstanceManagerOptions) {
    this.settingsStore = options.settingsStore
    this.workspaceEl = options.workspaceEl
    this.multiboxSlotEl = options.multiboxSlotEl
    this.createControllerForSlot = options.createControllerForSlot

    const initialSettings = this.settingsStore.get()
    this.audioFocus = new AudioFocusController(
      initialSettings.multiboxAudioFocusPolicy ?? 'focus-only',
      initialSettings.multiboxAlertSoundEnabled ?? true,
    )

    this.slots.set(1, {
      slotId: 1,
      controller: options.initialController,
      stageRefs: options.initialStageRefs,
    })
    this.publishGlobalMap()
    this.syncAudioFocus()
    this.renderTabBar(true)

    const unsubSettings = this.settingsStore.subscribe((next) => {
      this.audioFocus.setPolicy(next.multiboxAudioFocusPolicy ?? 'focus-only')
      this.audioFocus.setAlertSoundEnabled(next.multiboxAlertSoundEnabled ?? true)
      if (this.multiboxSlotEl) {
        this.multiboxSlotEl.hidden = !(next.multiboxEnabled ?? false)
      }
      this.syncAudioFocus()
      this.renderTabBar(true)
    })
    this.disposers.push(unsubSettings)

    const unsubLang = onGameLangChange(() => {
      this.renderTabBar(true)
    })
    this.disposers.push(unsubLang)

    if (typeof window !== 'undefined') {
      const onKeyDown = (e: KeyboardEvent): void => {
        if (!(this.settingsStore.get().multiboxEnabled ?? false)) return
        if (!e.altKey || e.ctrlKey || e.metaKey) return
        if (e.code === 'Backquote' || e.key === '`') {
          e.preventDefault()
          e.stopPropagation()
          this.cycleNextSlot()
          return
        }
        const digitMatch = /^Digit([1-8])$/.exec(e.code)
        if (digitMatch) {
          const targetSlot = Number(digitMatch[1])
          if (this.slots.has(targetSlot)) {
            e.preventDefault()
            e.stopPropagation()
            this.focusSlot(targetSlot)
          }
        }
      }
      window.addEventListener('keydown', onKeyDown, true)
      this.disposers.push(() => window.removeEventListener('keydown', onKeyDown, true))
    }

    // 10Hz vital & tab label monitor for background survival alerts (#1363)
    this.monitorTimer = setInterval(() => {
      this.tickMonitor()
    }, 100)
  }

  isMultiboxEnabled(): boolean {
    return Boolean(this.settingsStore.get().multiboxEnabled)
  }

  setMultiboxEnabled(enabled: boolean): void {
    this.settingsStore.set({ multiboxEnabled: Boolean(enabled) })
  }

  getActiveSlotId(): number {
    return this.activeSlotId
  }

  getActiveController(): PlayAppController {
    return (
      this.slots.get(this.activeSlotId)?.controller ??
      this.slots.values().next().value!.controller
    )
  }

  getSlotCount(): number {
    return this.slots.size
  }

  getSlotIds(): number[] {
    return [...this.slots.keys()].sort((a, b) => a - b)
  }

  getSlotController(slotId: number): PlayAppController | undefined {
    return this.slots.get(slotId)?.controller
  }

  getSlotsInfo(): MultiboxSlotInfo[] {
    const lang = getGameLang()
    return this.getSlotIds().map((slotId) => {
      const entry = this.slots.get(slotId)!
      const vital = this.readSlotVital(entry.controller)
      const hpRatio = vital.maxHp > 0 ? Math.max(0, Math.min(1, vital.hp / vital.maxHp)) : 1
      return {
        slotId,
        controller: entry.controller,
        stageRefs: entry.stageRefs,
        label: this.formatSlotLabel(slotId, entry.controller, lang),
        inGame: vital.inGame,
        hp: vital.hp,
        maxHp: vital.maxHp,
        hpRatio,
        effectiveMuted: entry.controller.session.audioRuntime.isFocusMuted(),
        audioOverride: this.audioFocus.getSlotOverride(slotId),
        alertState: this.audioFocus.getSlotAlertState(slotId),
      }
    })
  }

  /**
   * Allocates and boots a new instance slot (`2..8`), automatically focusing it.
   */
  async createSlot(requestedSlotId?: number): Promise<PlayAppController> {
    if (this.slots.size >= MAX_MULTIBOX_SLOTS) {
      throw new Error(`Maximum multibox instances (${MAX_MULTIBOX_SLOTS}) reached`)
    }
    let slotId = requestedSlotId
    if (slotId === undefined || this.slots.has(slotId)) {
      for (let candidate = 1; candidate <= MAX_MULTIBOX_SLOTS; candidate += 1) {
        if (!this.slots.has(candidate)) {
          slotId = candidate
          break
        }
      }
    }
    if (slotId === undefined || slotId < 1 || slotId > MAX_MULTIBOX_SLOTS) {
      throw new Error('No available multibox slot ID')
    }

    this.creatingSlot = true
    this.renderTabBar(true)
    try {
      const stageRefs = createStageContainer(slotId, this.workspaceEl)
      const controller = await this.createControllerForSlot(slotId, stageRefs)
      this.slots.set(slotId, { slotId, controller, stageRefs })
      this.publishGlobalMap()
      this.focusSlot(slotId)
      return controller
    } finally {
      this.creatingSlot = false
      this.renderTabBar(true)
    }
  }

  /**
   * Switches active visual, input, and audio focus to `slotId`.
   */
  focusSlot(slotId: number): boolean {
    const target = this.slots.get(slotId)
    if (!target) return false

    this.activeSlotId = slotId
    this.audioFocus.setActiveSlotId(slotId)

    for (const [id, entry] of this.slots) {
      const isFocused = id === slotId
      entry.controller.setInstanceFocused?.(isFocused)
      entry.stageRefs.setVisible(isFocused)
    }

    this.syncAudioFocus()
    this.publishGlobalMap()
    this.syncPrimaryToolbarStatus(target.controller)
    this.renderTabBar(true)
    return true
  }

  /**
   * Cycles to the next open instance slot (`Alt+\``).
   */
  cycleNextSlot(): number {
    const ids = this.getSlotIds()
    if (ids.length <= 1) return this.activeSlotId
    const idx = ids.indexOf(this.activeSlotId)
    const nextSlotId = ids[(idx + 1) % ids.length]!
    this.focusSlot(nextSlotId)
    return nextSlotId
  }

  /**
   * Toggles per-slot speaker override (`🔊` / `🔇`) on the tab bar (#1363).
   */
  toggleSlotSpeaker(slotId: number): SlotAudioOverride {
    const nextOverride = this.audioFocus.toggleSlotSpeaker(slotId)
    this.syncAudioFocus()
    this.renderTabBar(true)
    return nextOverride
  }

  /**
   * Closes and disposes an instance slot, releasing its WebSockets, WebGL2 context,
   * AudioContext, and DOM container. Refuses to close the last remaining slot.
   */
  async closeSlot(slotId: number): Promise<boolean> {
    if (this.slots.size <= 1) return false
    const entry = this.slots.get(slotId)
    if (!entry) return false

    this.slots.delete(slotId)
    this.audioFocus.removeSlot(slotId)

    try {
      await entry.controller.session.disconnect('Multibox slot closed')
    } catch {
      /* ignore */
    }
    try {
      entry.controller.session.audioRuntime.dispose()
    } catch {
      /* ignore */
    }
    try {
      entry.controller.dispose()
    } catch {
      /* ignore */
    }
    try {
      entry.stageRefs.destroy()
    } catch {
      /* ignore */
    }

    if (this.activeSlotId === slotId) {
      const remaining = this.getSlotIds()
      if (remaining.length > 0) {
        this.focusSlot(remaining[0]!)
      }
    } else {
      this.syncAudioFocus()
      this.publishGlobalMap()
      this.renderTabBar(true)
    }
    return true
  }

  dispose(): void {
    if (this.monitorTimer !== null) {
      clearInterval(this.monitorTimer)
      this.monitorTimer = null
    }
    for (const d of this.disposers) d()
    this.disposers.length = 0
  }

  private syncAudioFocus(): void {
    this.audioFocus.applyToRuntimes(
      [...this.slots.values()].map((entry) => ({
        slotId: entry.slotId,
        setFocusMuted: (muted: boolean) => entry.controller.session.audioRuntime.setFocusMuted(muted),
        isFocusMuted: () => entry.controller.session.audioRuntime.isFocusMuted(),
      })),
    )
  }

  private syncPrimaryToolbarStatus(activeController: PlayAppController): void {
    const primaryToolbar = this.slots.get(1)?.controller.toolbar
    if (!primaryToolbar) return
    const phase = activeController.session.phase
    const pingMs = activeController.session.pingMs
    if (phase === 'ingame' || phase === 'replay') {
      primaryToolbar.setConnectionState({ phase: 'd2gs', rttMs: pingMs })
    } else if (phase === 'lobby') {
      primaryToolbar.setConnectionState({ phase: 'mcp', rttMs: pingMs })
    } else if (phase === 'connecting') {
      primaryToolbar.setConnectionState({ phase: 'connecting', rttMs: null })
    } else {
      primaryToolbar.setConnectionState({ phase: 'disconnected', rttMs: null })
    }
  }

  private publishGlobalMap(): void {
    if (typeof window === 'undefined') return
    const map = new Map<number, PlayAppController>()
    for (const [id, entry] of this.slots) {
      map.set(id, entry.controller)
    }
    window.__d2PlayInstances = map
    const active = this.slots.get(this.activeSlotId)?.controller
    if (active) {
      window.__d2Play = active
      window.__d2PlayApp = active
    }
  }

  private readSlotVital(controller: PlayAppController): {
    readonly inGame: boolean
    readonly hp: number
    readonly maxHp: number
  } {
    const inGame =
      typeof controller.isInGameView === 'function'
        ? controller.isInGameView()
        : controller.flowState?.stage === 'in_game'
    if (!inGame) {
      return { inGame: false, hp: 0, maxHp: 0 }
    }
    const hudHp = controller.hudManager?.hp ?? 0
    const hudMaxHp = controller.hudManager?.maxHp ?? 0
    const worldHp = controller.session?.world?.self?.life ?? 0
    const worldMaxHp = controller.session?.world?.self?.maxLife ?? 0
    const maxHp = hudMaxHp > 0 ? hudMaxHp : worldMaxHp
    const hp = hudMaxHp > 0 ? hudHp : worldHp
    return { inGame: true, hp, maxHp }
  }

  private formatSlotLabel(
    slotId: number,
    controller: PlayAppController,
    lang: GameLang,
  ): string {
    const charName =
      controller.session?.selectedChar ||
      controller.flowState?.roster?.[controller.flowState.selectedSlotIndex]?.name ||
      ''
    const inGame =
      typeof controller.isInGameView === 'function'
        ? controller.isInGameView()
        : controller.flowState?.stage === 'in_game'
    if (inGame) {
      const lvl =
        controller.hudManager?.charSheet?.attrs?.level ||
        controller.session?.world?.self?.level ||
        controller.flowState?.roster?.[controller.flowState.selectedSlotIndex]?.level ||
        0
      const namePart = charName || (lang === 'en' ? 'In-Game' : '游戏中')
      return lvl > 0 ? `${slotId}: ${namePart} (Lv.${lvl})` : `${slotId}: ${namePart}`
    }
    const stage = controller.flowState.stage
    if (stage === 'bnet_lobby') {
      return `${slotId}: ${charName || (lang === 'en' ? 'Lobby' : '战网大厅')}`
    }
    if (stage === 'char_select' || stage === 'char_create') {
      return `${slotId}: ${lang === 'en' ? 'Characters' : '角色选择'}`
    }
    if (stage === 'bnet_login' || stage === 'bnet_connecting') {
      return `${slotId}: ${lang === 'en' ? 'Login' : '战网登录'}`
    }
    return `${slotId}: ${lang === 'en' ? 'Main Menu' : '主菜单'}`
  }

  /**
   * Polls all slots for vital changes, triggers background damage/low-HP sound alerts,
   * and updates the tab bar DOM when state changes.
   */
  pollSlotsStatus(nowMs = performance.now()): void {
    this.tickMonitor(nowMs)
  }

  tickMonitor(nowMs = performance.now()): void {
    let playAlertKind: 'damage' | 'low-hp' | 'dead' | null = null
    for (const [slotId, entry] of this.slots) {
      const vital = this.readSlotVital(entry.controller)
      const evalRes = this.audioFocus.evaluateSlotVital(
        {
          slotId,
          inGame: vital.inGame,
          hp: vital.hp,
          maxHp: vital.maxHp,
        },
        nowMs,
      )
      if (evalRes.shouldTriggerAlertSound && evalRes.alertState !== 'none') {
        playAlertKind = evalRes.alertState
      }
    }
    if (playAlertKind !== null) {
      const active = this.slots.get(this.activeSlotId)?.controller
      active?.session.audioRuntime.playBackgroundAlertCue(playAlertKind)
    }
    this.renderTabBar(false)
  }

  private renderTabBar(force: boolean): void {
    const container = this.multiboxSlotEl
    if (!container || typeof document === 'undefined') return
    const enabled = this.isMultiboxEnabled()
    container.hidden = !enabled
    if (!enabled) return

    const infos = this.getSlotsInfo()
    const lang = getGameLang()
    const sig = JSON.stringify({
      active: this.activeSlotId,
      creating: this.creatingSlot,
      lang,
      slots: infos.map((i) => ({
        id: i.slotId,
        label: i.label,
        inGame: i.inGame,
        hpPct: Math.round(i.hpRatio * 20),
        muted: i.effectiveMuted,
        ov: i.audioOverride,
        alert: i.alertState,
      })),
    })
    if (!force && sig === this.lastRenderedBarSignature) return
    this.lastRenderedBarSignature = sig

    container.innerHTML = ''
    for (const info of infos) {
      const tab = document.createElement('div')
      tab.id = `d2-multibox-tab-${info.slotId}`
      const classes = ['d2-multibox-tab']
      if (info.slotId === this.activeSlotId) {
        classes.push('d2-multibox-tab--active')
      }
      if (info.alertState !== 'none') {
        classes.push(`d2-multibox-tab--alert-${info.alertState}`)
      }
      tab.className = classes.join(' ')
      tab.setAttribute('data-slot-id', String(info.slotId))
      tab.title =
        lang === 'en'
          ? `Slot ${info.slotId} (Alt+${info.slotId})`
          : `实例 ${info.slotId} (快捷键 Alt+${info.slotId})`
      tab.addEventListener('click', () => {
        this.focusSlot(info.slotId)
      })

      const labelSpan = document.createElement('span')
      labelSpan.className = 'd2-multibox-tab__label'
      labelSpan.textContent = info.label
      tab.appendChild(labelSpan)

      if (info.inGame && info.maxHp > 0) {
        const hpWrap = document.createElement('span')
        hpWrap.className = 'd2-multibox-tab__hp'
        const hpFill = document.createElement('span')
        hpFill.className = 'd2-multibox-tab__hp-fill'
        hpFill.style.width = `${Math.round(info.hpRatio * 100)}%`
        hpWrap.appendChild(hpFill)
        tab.appendChild(hpWrap)
      }

      const speakerBtn = document.createElement('button')
      speakerBtn.type = 'button'
      speakerBtn.className = 'd2-multibox-tab__speaker'
      speakerBtn.setAttribute('data-slot-speaker', String(info.slotId))
      speakerBtn.textContent = info.effectiveMuted ? '🔇' : '🔊'
      speakerBtn.title =
        lang === 'en'
          ? info.effectiveMuted
            ? 'Unmute this instance'
            : 'Mute this instance'
          : info.effectiveMuted
            ? '取消静音此实例'
            : '静音此实例'
      speakerBtn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        this.toggleSlotSpeaker(info.slotId)
      })
      tab.appendChild(speakerBtn)

      if (infos.length > 1) {
        const closeBtn = document.createElement('button')
        closeBtn.type = 'button'
        closeBtn.className = 'd2-multibox-tab__close'
        closeBtn.setAttribute('data-slot-close', String(info.slotId))
        closeBtn.textContent = '×'
        closeBtn.title = lang === 'en' ? `Close Slot ${info.slotId}` : `关闭实例 ${info.slotId}`
        closeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          void this.closeSlot(info.slotId)
        })
        tab.appendChild(closeBtn)
      }

      container.appendChild(tab)
    }

    if (infos.length < MAX_MULTIBOX_SLOTS) {
      const addBtn = document.createElement('button')
      addBtn.type = 'button'
      addBtn.id = 'd2-multibox-add-btn'
      addBtn.className = 'd2-toolbar__btn d2-multibox-add-btn'
      addBtn.disabled = this.creatingSlot
      addBtn.textContent =
        lang === 'en'
          ? this.creatingSlot
            ? '...'
            : '+ New'
          : this.creatingSlot
            ? '创建中...'
            : '+ 新开实例'
      addBtn.title =
        lang === 'en'
          ? 'Open a new Diablo II instance in this tab'
          : '在当前标签页新开一个暗黑2实例'
      addBtn.addEventListener('click', () => {
        void this.createSlot()
      })
      container.appendChild(addBtn)
    }
  }
}
