import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DEFAULT_CLIENT_SETTINGS } from '../../src/client/settings/client-settings.ts'
import { SettingsStore } from '../../src/client/settings/settings-store.ts'
import { Toolbar } from '../../src/client/toolbar/toolbar.ts'
import {
  AudioFocusController,
  createStageContainer,
  MultiInstanceManager,
  SharedAssetPool,
  type StageContainerRefs,
} from '../../src/client/multibox/index.ts'
import { WebAudioSoundVoices } from '../../src/client/audio/sound-voices-webaudio.ts'
import { AudioRuntime113c } from '../../src/client/audio/audio-runtime-113c.ts'
import type { PlayAppController } from '../../src/client/main.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

class FakeElement {
  readonly tagName: string
  readonly children: FakeElement[] = []
  readonly style: Record<string, string> = {}
  readonly dataset: Record<string, string> = {}
  parentNode: FakeElement | null = null
  id = ''
  className = ''
  type = ''
  value = ''
  title = ''
  htmlFor = ''
  disabled = false
  hidden = false
  width = 0
  height = 0
  rawHtml = ''
  private text = ''
  private readonly attrs = new Map<string, string>()
  private readonly listeners = new Map<
    string,
    Array<(ev: { type: string; target?: unknown; stopPropagation?: () => void }) => void>
  >()

  readonly classList = {
    add: (...tokens: string[]): void => {
      const set = new Set(this.className.split(/\s+/).filter(Boolean))
      for (const t of tokens) set.add(t)
      this.className = [...set].join(' ')
    },
    remove: (...tokens: string[]): void => {
      const set = new Set(this.className.split(/\s+/).filter(Boolean))
      for (const t of tokens) set.delete(t)
      this.className = [...set].join(' ')
    },
    contains: (token: string): boolean => {
      return this.className.split(/\s+/).filter(Boolean).includes(token)
    },
  }

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }

  get options(): FakeElement[] {
    return this.children
  }

  get parentElement(): FakeElement | null {
    return this.parentNode
  }

  get innerHTML(): string {
    return this.rawHtml
  }

  set innerHTML(val: string) {
    this.rawHtml = val
    if (val === '') {
      for (const c of this.children) c.parentNode = null
      this.children.length = 0
      this.text = ''
    }
  }

  get textContent(): string {
    if (this.children.length === 0) return this.text
    return this.text + this.children.map((c) => c.textContent).join('')
  }

  set textContent(val: string | null) {
    for (const c of this.children) c.parentNode = null
    this.children.length = 0
    this.text = val ?? ''
  }

  setAttribute(name: string, val: string): void {
    if (name === 'id') this.id = val
    if (name === 'class') this.className = val
    this.attrs.set(name, val)
  }

  getAttribute(name: string): string | null {
    if (name === 'id' && this.id) return this.id
    if (name === 'class' && this.className) return this.className
    return this.attrs.get(name) ?? null
  }

  hasAttribute(name: string): boolean {
    if (name === 'id') return Boolean(this.id)
    if (name === 'class') return Boolean(this.className)
    return this.attrs.has(name)
  }

  removeAttribute(name: string): void {
    if (name === 'id') this.id = ''
    if (name === 'class') this.className = ''
    this.attrs.delete(name)
  }

  appendChild(child: FakeElement): FakeElement {
    if (child.parentNode) {
      child.parentNode.removeChild(child)
    }
    child.parentNode = this
    this.children.push(child)
    return child
  }

  removeChild(child: FakeElement): FakeElement {
    const idx = this.children.indexOf(child)
    if (idx >= 0) {
      this.children.splice(idx, 1)
      child.parentNode = null
    }
    return child
  }

  remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this)
    }
  }

  addEventListener(
    type: string,
    fn: (ev: { type: string; target?: unknown; stopPropagation?: () => void }) => void,
  ): void {
    let list = this.listeners.get(type)
    if (!list) {
      list = []
      this.listeners.set(type, list)
    }
    list.push(fn)
  }

  removeEventListener(
    type: string,
    fn: (ev: { type: string; target?: unknown; stopPropagation?: () => void }) => void,
  ): void {
    const list = this.listeners.get(type)
    if (!list) return
    const idx = list.indexOf(fn)
    if (idx >= 0) list.splice(idx, 1)
  }

  click(): void {
    const list = this.listeners.get('click') ?? []
    for (const fn of [...list]) {
      fn({
        type: 'click',
        target: this,
        stopPropagation: () => {},
      })
    }
  }

  matchesSelector(sel: string): boolean {
    const trimmed = sel.trim()
    if (trimmed.startsWith('#')) {
      return this.id === trimmed.slice(1)
    }
    if (trimmed.startsWith('.')) {
      return this.classList.contains(trimmed.slice(1))
    }
    return this.tagName.toLowerCase() === trimmed.toLowerCase()
  }

  querySelector(selector: string): FakeElement | null {
    const parts = selector.split(',').map((s) => s.trim())
    const queue: FakeElement[] = [...this.children]
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (parts.some((p) => cur.matchesSelector(p))) {
        return cur
      }
      queue.push(...cur.children)
    }
    return null
  }

  querySelectorAll(selector: string): FakeElement[] {
    const parts = selector.split(',').map((s) => s.trim())
    const out: FakeElement[] = []
    const queue: FakeElement[] = [...this.children]
    while (queue.length > 0) {
      const cur = queue.shift()!
      if (parts.some((p) => cur.matchesSelector(p))) {
        out.push(cur)
      }
      queue.push(...cur.children)
    }
    return out
  }
}

function installFakeDom() {
  const body = new FakeElement('body')
  const toolbarContainer = new FakeElement('header')
  toolbarContainer.id = 'd2-toolbar-container'
  body.appendChild(toolbarContainer)

  const workspace = new FakeElement('main')
  workspace.id = 'play-workspace'
  body.appendChild(workspace)

  const wrapper1 = new FakeElement('div')
  wrapper1.id = 'play-stage-wrapper'
  wrapper1.className = 'play-stage-wrapper'
  workspace.appendChild(wrapper1)

  const stage1 = new FakeElement('div')
  stage1.id = 'play-stage'
  stage1.className = 'play-stage'
  wrapper1.appendChild(stage1)

  const bootLoading1 = new FakeElement('div')
  bootLoading1.id = 'd2-boot-loading'
  bootLoading1.className = 'd2-boot-loading'
  stage1.appendChild(bootLoading1)

  const bnetShell1 = new FakeElement('div')
  bnetShell1.id = 'bnet-shell'
  bnetShell1.className = 'bnet-shell'
  const bnetCanvas1 = new FakeElement('canvas')
  bnetCanvas1.id = 'bnet-canvas'
  bnetCanvas1.className = 'bnet-canvas'
  bnetShell1.appendChild(bnetCanvas1)
  stage1.appendChild(bnetShell1)

  const view1 = new FakeElement('canvas')
  view1.id = 'view'
  view1.className = 'play-view-canvas'
  stage1.appendChild(view1)

  const hud1 = new FakeElement('canvas')
  hud1.id = 'd2-hud-canvas'
  hud1.className = 'd2-hud-canvas'
  stage1.appendChild(hud1)

  const cursor1 = new FakeElement('canvas')
  cursor1.id = 'd2-cursor-canvas'
  cursor1.className = 'd2-cursor-canvas'
  stage1.appendChild(cursor1)

  const banner1 = new FakeElement('div')
  banner1.id = 'play-disconnect-banner'
  banner1.className = 'play-disconnect-banner'
  banner1.hidden = true
  stage1.appendChild(banner1)

  const windowListeners = new Map<string, Array<(ev: unknown) => void>>()

  const fakeDoc = {
    body,
    createElement: (tag: string) => new FakeElement(tag),
    getElementById: (id: string) => body.querySelector(`#${id}`),
    querySelector: (sel: string) => body.querySelector(sel),
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }

  const fakeWin = {
    document: fakeDoc,
    addEventListener: (type: string, fn: (ev: unknown) => void) => {
      let arr = windowListeners.get(type)
      if (!arr) {
        arr = []
        windowListeners.set(type, arr)
      }
      arr.push(fn)
    },
    removeEventListener: (type: string, fn: (ev: unknown) => void) => {
      const arr = windowListeners.get(type)
      if (!arr) return
      const idx = arr.indexOf(fn)
      if (idx >= 0) arr.splice(idx, 1)
    },
    dispatchKeyDown: (ev: Partial<KeyboardEvent>) => {
      const arr = windowListeners.get('keydown') ?? []
      for (const fn of [...arr]) {
        fn({
          defaultPrevented: false,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          stopImmediatePropagation: vi.fn(),
          ...ev,
        })
      }
    },
  }

  vi.stubGlobal('document', fakeDoc)
  vi.stubGlobal('window', fakeWin)

  return { body, toolbarContainer, workspace, fakeDoc, fakeWin }
}

describe('Issues #1362 & #1363 — Single-Tab Multibox Architecture & Audio Focus / Survival Alert Policy', () => {
  beforeEach(() => {
    SharedAssetPool.getGlobal().clear()
  })

  it('defaults multiboxEnabled to false (single-tab by default) and requires manual activation in config modal', () => {
    const { toolbarContainer, body } = installFakeDom()
    expect(DEFAULT_CLIENT_SETTINGS.multiboxEnabled).toBe(false)
    expect(DEFAULT_CLIENT_SETTINGS.multiboxAudioFocusPolicy).toBe('focus-only')
    expect(DEFAULT_CLIENT_SETTINGS.multiboxAlertSoundEnabled).toBe(true)

    const store = new SettingsStore({ storage: new MemoryStorage() })
    expect(store.get().multiboxEnabled).toBe(false)

    const toolbar = new Toolbar({
      store,
      container: toolbarContainer as unknown as HTMLElement,
    })

    const multiboxSlot = toolbar.getMultiboxSlotElement() as unknown as FakeElement
    expect(multiboxSlot).not.toBeNull()
    expect(multiboxSlot.hidden).toBe(true)

    const multiboxBtn = body.querySelector('#d2-toolbar-multibox-btn')
    const alertBtn = body.querySelector('#d2-toolbar-multibox-alert-btn')
    expect(multiboxBtn).not.toBeNull()
    expect(alertBtn).not.toBeNull()
    expect(alertBtn!.hidden).toBe(true)

    // Manually enable single-tab multibox in config modal
    multiboxBtn!.click()
    expect(store.get().multiboxEnabled).toBe(true)
    expect(multiboxSlot.hidden).toBe(false)
    expect(alertBtn!.hidden).toBe(false)

    // Toggle background survival alert sound
    alertBtn!.click()
    expect(store.get().multiboxAlertSoundEnabled).toBe(false)

    toolbar.destroy()
  })

  it('isolates DOM stage containers across Slots 1..N without duplicate IDs', () => {
    const { workspace, fakeDoc } = installFakeDom()
    const slot1 = createStageContainer(1, workspace as unknown as HTMLElement)
    const slot2 = createStageContainer(2, workspace as unknown as HTMLElement)
    const slot3 = createStageContainer(3, workspace as unknown as HTMLElement)

    expect(slot1.stageWrapperEl.id).toBe('play-stage-wrapper')
    expect(slot2.stageWrapperEl.id).toBe('play-stage-wrapper-slot-2')
    expect(slot3.stageWrapperEl.id).toBe('play-stage-wrapper-slot-3')

    expect(slot1.viewCanvas.id).toBe('view')
    expect(slot2.viewCanvas.id).toBe('view-slot-2')
    expect(slot3.viewCanvas.id).toBe('view-slot-3')

    // Visibility toggling
    slot2.setVisible(false)
    expect(slot2.stageWrapperEl.style.display).toBe('none')
    expect(slot2.stageWrapperEl.dataset.d2SlotActive).toBe('0')

    slot2.setVisible(true)
    expect(slot2.stageWrapperEl.style.display).toBe('flex')
    expect(slot2.stageWrapperEl.dataset.d2SlotActive).toBe('1')

    // Destroying child slot removes its DOM subtree cleanly while Slot 1 stays intact
    slot3.destroy()
    expect(fakeDoc.getElementById('play-stage-wrapper-slot-3')).toBeNull()
    expect(fakeDoc.getElementById('play-stage-wrapper')).not.toBeNull()
  })

  it('shares static ArrayBuffers, JSON manifests, Blobs, and SfxChunkLoader across instances in SharedAssetPool', async () => {
    const pool = new SharedAssetPool()
    let fetchCount = 0
    const fakeFetcher = vi.fn(async (url: string) => {
      fetchCount++
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        json: async () => ({ url, ok: true }),
        blob: async () => new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' }),
      } as unknown as Response
    })
    vi.stubGlobal('fetch', fakeFetcher)

    const [bufA, bufB] = await Promise.all([
      pool.fetchArrayBuffer('/act-packs/tiles/drlg-bundle.bin'),
      pool.fetchArrayBuffer('/act-packs/tiles/drlg-bundle.bin'),
    ])
    expect(bufA).toBe(bufB)
    expect(fetchCount).toBe(1)

    const [jsonA, jsonB] = await Promise.all([
      pool.fetchJson<{ url: string }>('/ui/manifest.json'),
      pool.fetchJson<{ url: string }>('/ui/manifest.json'),
    ])
    expect(jsonA).toBe(jsonB)
    expect(fetchCount).toBe(2)

    expect(pool.getSharedSfxLoader()).toBe(pool.getSharedSfxLoader())
    const stats = pool.getStats()
    expect(stats.binaryCount).toBe(1)
    expect(stats.jsonCount).toBe(1)
    expect(stats.hasSharedSfxLoader).toBe(true)
  })

  it('enforces AudioFocusController focus-only auto-mute, per-slot speaker overrides, and survival alerts', () => {
    const audioFocus = new AudioFocusController('focus-only', true)

    audioFocus.setActiveSlotId(1)
    expect(audioFocus.shouldMuteSlot(1)).toBe(false)
    expect(audioFocus.shouldMuteSlot(2)).toBe(true)

    // Switching focus to Slot 2 automatically mutes Slot 1 and unmutes Slot 2
    audioFocus.setActiveSlotId(2)
    expect(audioFocus.shouldMuteSlot(1)).toBe(true)
    expect(audioFocus.shouldMuteSlot(2)).toBe(false)

    // Manual override on Slot 1 ('unmute') keeps Slot 1 audible in background
    expect(audioFocus.toggleSlotSpeaker(1)).toBe('unmute')
    expect(audioFocus.shouldMuteSlot(1)).toBe(false)

    // Reset Slot 1 override back to 'auto'
    audioFocus.setSlotOverride(1, 'auto')
    expect(audioFocus.shouldMuteSlot(1)).toBe(true)

    // Vital monitoring on background Slot 1 while Slot 2 is focused:
    // Initial sample (100/100 HP) -> no alert
    const initVital = audioFocus.evaluateSlotVital(
      { slotId: 1, inGame: true, hp: 100, maxHp: 100 },
      1000,
    )
    expect(initVital.alertState).toBe('none')
    expect(initVital.shouldTriggerAlertSound).toBe(false)

    // Minor hit on background Slot 1 (100 -> 85 HP) -> triggers 'damage' alert + cue
    const hitVital = audioFocus.evaluateSlotVital(
      { slotId: 1, inGame: true, hp: 85, maxHp: 100 },
      2000,
    )
    expect(hitVital.alertState).toBe('damage')
    expect(hitVital.shouldTriggerAlertSound).toBe(true)
    expect(audioFocus.getSlotAlertState(1)).toBe('damage')

    // Second minor hit within cooldown (2000ms -> 2300ms) -> alert stays active, cue suppressed by cooldown
    const cooldownVital = audioFocus.evaluateSlotVital(
      { slotId: 1, inGame: true, hp: 80, maxHp: 100 },
      2300,
    )
    expect(cooldownVital.alertState).toBe('damage')
    expect(cooldownVital.shouldTriggerAlertSound).toBe(false)

    // Severe drop below 35% HP (80 -> 25 HP) after urgent cooldown -> escalates to 'low-hp' and plays alert cue
    const lowHpVital = audioFocus.evaluateSlotVital(
      { slotId: 1, inGame: true, hp: 25, maxHp: 100 },
      3500,
    )
    expect(lowHpVital.alertState).toBe('low-hp')
    expect(lowHpVital.shouldTriggerAlertSound).toBe(true)

    // Focusing Slot 1 clears its alert state
    audioFocus.setActiveSlotId(1)
    expect(audioFocus.getSlotAlertState(1)).toBe('none')
  })

  it('skips creating non-looping WebAudio source nodes when focusMuted is true while keeping looping voices alive', () => {
    let createdSources = 0
    const fakeBusNode = {
      gain: { value: 1 },
      connect: vi.fn(),
    } as unknown as GainNode
    const fakeCtx = {
      state: 'running',
      destination: {},
      createGain: vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createChannelMerger: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createChannelSplitter: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createBufferSource: vi.fn(() => {
        createdSources++
        return {
          buffer: null,
          loop: false,
          playbackRate: { value: 1 },
          onended: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        }
      }),
    } as unknown as AudioContext

    const dummyBuffer = { numberOfChannels: 1, duration: 1.0 } as AudioBuffer
    const voices = new WebAudioSoundVoices(
      () => ({ ctx: fakeCtx, node: fakeBusNode }),
      () => ({ buffer: dummyBuffer, sourceSampleRate: 22050 }),
    )

    // Focus-mute the voice backend
    voices.setFocusMuted(true)
    expect(voices.isFocusMuted()).toBe(true)

    // One-shot non-looping sound while focusMuted -> 0 AudioBufferSourceNodes created
    voices.start(1, 10, false, 0)
    expect(createdSources).toBe(0)

    // Looping sound (e.g. ambient / environment) while focusMuted -> still allocated so unmuting resumes seamlessly
    voices.start(2, 20, true, 0)
    expect(createdSources).toBe(1)

    // Unmuting on focus allows one-shot voices again
    voices.setFocusMuted(false)
    expect(voices.isFocusMuted()).toBe(false)
    voices.start(3, 10, false, 0)
    expect(createdSources).toBe(2)

    // AudioRuntime113c.playBackgroundAlertCue temporarily lifts focusMuted to play authentic Sounds.txt ID 14
    const runtime = new AudioRuntime113c()
    runtime.setFocusMuted(true)
    expect(runtime.isFocusMuted()).toBe(true)
    expect(runtime.isEffectiveMuted()).toBe(true)
    const playSpy = vi.spyOn(runtime, 'playBySoundId').mockReturnValue(1)
    runtime.playBackgroundAlertCue('low-hp')
    expect(playSpy).toHaveBeenCalledWith(14)
    expect(runtime.isFocusMuted()).toBe(true)
  })

  it('manages multi-instance slots, Alt+1..8 / Alt+` hotkeys, audio focus sync, and 0-GPU background state', async () => {
    const { workspace, toolbarContainer, fakeWin } = installFakeDom()
    const store = new SettingsStore({ storage: new MemoryStorage() })
    store.set({ multiboxEnabled: true })

    const toolbar = new Toolbar({
      store,
      container: toolbarContainer as unknown as HTMLElement,
    })

    const makeFakeController = (slotId: number, stageRefs: StageContainerRefs): PlayAppController => {
      let focused = true
      let focusMuted = false
      let life = 100
      const maxLife = 100
      const alertCueSpy = vi.fn()
      const ctrl = {
        slotId,
        stageRefs,
        ready: true,
        isInGameView: () => true,
        flowState: {
          stage: 'in_game',
          roster: [{ name: `HeroSlot${slotId}`, level: 80 + slotId }],
          selectedSlotIndex: 0,
        },
        hudManager: {
          get hp() {
            return life
          },
          maxHp: maxLife,
          charSheet: { attrs: { level: 80 + slotId } },
        },
        session: {
          phase: 'ingame',
          selectedChar: `HeroSlot${slotId}`,
          disconnect: vi.fn(async () => {}),
          world: {
            self: {
              get life() {
                return life
              },
              maxLife,
              level: 80 + slotId,
            },
          },
          audioRuntime: {
            setFocusMuted: (m: boolean) => {
              focusMuted = m
            },
            isFocusMuted: () => focusMuted,
            playBackgroundAlertCue: alertCueSpy,
            dispose: vi.fn(),
          },
        },
        setInstanceFocused: (f: boolean) => {
          focused = f
        },
        isInstanceFocused: () => focused,
        dispose: vi.fn(),
        __setLifeWhole: (hp: number) => {
          life = hp
        },
        __alertCueSpy: alertCueSpy,
      }
      return ctrl as unknown as PlayAppController
    }

    const slot1Refs = createStageContainer(1, workspace as unknown as HTMLElement)
    const slot1Ctrl = makeFakeController(1, slot1Refs)

    const manager = new MultiInstanceManager({
      initialController: slot1Ctrl,
      initialStageRefs: slot1Refs,
      workspaceEl: workspace as unknown as HTMLElement,
      multiboxSlotEl: toolbar.getMultiboxSlotElement(),
      settingsStore: store,
      createControllerForSlot: async (childSlotId, childRefs) =>
        makeFakeController(childSlotId, childRefs),
    })

    expect(manager.getSlotIds()).toEqual([1])
    expect(manager.getActiveSlotId()).toBe(1)

    // Create Slot 2 -> auto-focuses Slot 2, unfocuses & focus-mutes Slot 1
    const slot2Ctrl = await manager.createSlot()
    expect(slot2Ctrl.slotId).toBe(2)
    expect(manager.getSlotIds()).toEqual([1, 2])
    expect(manager.getActiveSlotId()).toBe(2)
    expect(slot1Ctrl.isInstanceFocused!()).toBe(false)
    expect(slot1Ctrl.session.audioRuntime.isFocusMuted()).toBe(true)

    expect(slot2Ctrl.isInstanceFocused!()).toBe(true)
    expect(slot2Ctrl.session.audioRuntime.isFocusMuted()).toBe(false)
    expect(slot1Refs.stageWrapperEl.style.display).toBe('none')
    expect(slot2Ctrl.stageRefs!.stageWrapperEl.style.display).toBe('flex')

    // Simulate background Slot 1 taking heavy damage (100 -> 20 HP < 35%)
    manager.pollSlotsStatus(1000)
    ;(slot1Ctrl as unknown as { __setLifeWhole: (hp: number) => void }).__setLifeWhole(20)
    manager.pollSlotsStatus(2000)

    expect(manager.audioFocus.getSlotAlertState(1)).toBe('low-hp')
    // Alert cue played on focused Slot 2's audio runtime
    expect(
      (slot2Ctrl as unknown as { __alertCueSpy: ReturnType<typeof vi.fn> }).__alertCueSpy,
    ).toHaveBeenCalledWith('low-hp')

    // Hotkey Alt+1 switches back to Slot 1 and clears its alert
    fakeWin.dispatchKeyDown({ altKey: true, code: 'Digit1' })
    expect(manager.getActiveSlotId()).toBe(1)
    expect(slot1Ctrl.isInstanceFocused!()).toBe(true)
    expect(slot2Ctrl.isInstanceFocused!()).toBe(false)
    expect(manager.audioFocus.getSlotAlertState(1)).toBe('none')

    // Hotkey Alt+` cycles to Slot 2
    fakeWin.dispatchKeyDown({ altKey: true, code: 'Backquote' })
    expect(manager.getActiveSlotId()).toBe(2)

    // Closing Slot 2 disposes it and returns focus to Slot 1
    expect(await manager.closeSlot(2)).toBe(true)
    expect(manager.getSlotIds()).toEqual([1])
    expect(manager.getActiveSlotId()).toBe(1)
    expect(slot1Ctrl.isInstanceFocused!()).toBe(true)

    manager.dispose()
    toolbar.destroy()
  })
})
