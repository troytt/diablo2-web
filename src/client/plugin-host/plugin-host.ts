/**
 * Generic Hot-Swappable Plugin Host (`src/client/plugin-host/plugin-host.ts`).
 *
 * Responsibilities:
 * - Fail-fast startup validation via `validatePluginRegistry`.
 * - Per-plugin serialized `setEnabled(id, enabled)` lifecycle queue so rapid toggles
 *   converge deterministically to the final state.
 * - Automatic teardown of toolbar contributions (`addLink` / `addButton` / `addSelect`),
 *   client capability claims (`automapReveal`, `lightingPreset`, `allowedViewports`,
 *   `weatherOverride`), and setting/language subscriptions registered via `PluginContext` on
 *   deactivate.
 * - Runtime error isolation in `activate`, `deactivate`, setting callbacks, action
 *   runners, and `ctx.log.error` (`console.error` + plugin status set to `level: 'error'`
 *   + toolbar plugin button displays `⚠`).
 */

import { getGameLang, onLangChange, type GameLang } from '../i18n/lang.ts'
import {
  VALID_AUTOMAP_REVEAL_MODES,
  VALID_LIGHTING_PRESETS,
  VALID_VIEWPORT_RESOLUTIONS,
  VALID_WEATHER_OVERRIDES,
  type AutomapRadarConfig,
  type AutomapRevealMode,
  type ClientLightingPreset,
  type GroundItemEnhancementsConfig,
  type HudEnhancementsConfig,
  type ViewportResolution,
  type WeatherOverrideSetting,
} from '../settings/client-settings.ts'
import {
  getGlobalSettingsStore,
  type SettingsStore,
} from '../settings/settings-store.ts'
import { DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS, pickFallbackViewport } from '../view/viewport-profile.ts'
import {
  isRelativePluginHref,
  isValidLocalizedText,
  validatePluginRegistry,
  type D2WebPlugin,
  type LocalizedText,
  type PluginClientCapabilities,
  type PluginContext,
  type PluginInstance,
  type PluginLogger,
  type PluginQuickCastPort,
  type PluginNotifyPort,
  type PluginTogglePort,
  type PluginSessionView,
  type PluginStatus,
  type PluginToolbarContributionSpec,
  type PluginToolbarSelectOption,
  type PluginToolbarSelectSpec,
  type ToolbarContributionHandle,
  type ToolbarContributionPatch,
} from './api.ts'
import {
  PluginConfigStore,
  type PluginConfigStoreOptions,
} from './plugin-config-store.ts'

export type ToolbarContributionSpec =
  | {
      readonly domId: string
      readonly kind: 'link'
      readonly label: LocalizedText
      readonly tooltip?: LocalizedText | undefined
      readonly iconSvg?: string | undefined
      readonly href: string
    }
  | {
      readonly domId: string
      readonly kind: 'button'
      readonly label: LocalizedText
      readonly tooltip?: LocalizedText | undefined
      readonly iconSvg?: string | undefined
      readonly onClick: () => void
    }
  | {
      readonly domId: string
      readonly selectDomId: string
      readonly kind: 'select'
      readonly label: LocalizedText
      readonly tooltip?: LocalizedText | undefined
      readonly options: readonly PluginToolbarSelectOption[]
      readonly getValue: () => string
      readonly onChange: (value: string) => void
    }

export interface PluginHostToolbarPort {
  setPluginsButtonState(state: {
    readonly ready: boolean
    readonly hasWarning: boolean
    readonly open?: boolean | undefined
  }): void
  addContribution(spec: ToolbarContributionSpec): ToolbarContributionHandle | (() => void)
  getAllowedViewports?(): readonly ViewportResolution[]
  setAllowedViewports?(resolutions: readonly ViewportResolution[]): void
}

export interface PluginDescriptorSnapshot {
  readonly id: string
  readonly plugin: D2WebPlugin
  readonly enabled: boolean
  readonly active: boolean
  readonly status: PluginStatus
  readonly settings: Readonly<Record<string, boolean | string>>
  readonly error: string | null
}

export interface PluginHostOptions {
  readonly plugins: readonly D2WebPlugin[]
  readonly session: PluginSessionView
  readonly toolbar?: PluginHostToolbarPort | null | undefined
  readonly settingsStore?: SettingsStore | undefined
  readonly enforceClientDefaults?: boolean | undefined
  readonly configStore?: PluginConfigStore | undefined
  readonly storageOptions?: PluginConfigStoreOptions | undefined
  readonly autoStart?: boolean | undefined
  /**
   * NOT 1.13c: Quick Cast capability port (Issue #952). Wired by the composition root
   * (`main.ts`); when absent, `ctx.quickCast.setEnabled` throws fail-fast (no silently dead
   * toggle).
   */
  readonly quickCast?: PluginQuickCastPort | null | undefined
  readonly notify?: PluginNotifyPort | null | undefined
}

const TOGGLE_PORT_NAMES = ['dragInteract', 'stashDepositAll', 'xpBar', 'autoGoldPickup', 'beltRefill', 'upgradeHints', 'monsterResists', 'lowLifeWarning', 'smartSkills', 'spendPoints'] as const
type TogglePortName = (typeof TOGGLE_PORT_NAMES)[number]
type SettingPortName = 'autoCombat' | 'townPortal' | 'autopilot' | 'autoPotion' | 'autoLoot' | 'inventoryCare' | 'itemInfo' | 'pathGuide'
type WiredPortOptions = { readonly [K in TogglePortName | SettingPortName]?: PluginContext[K] | null | undefined }

export interface PluginHostOptions extends WiredPortOptions {}

const requireWiredPort = <T>(port: T, name: string, pluginId: string): NonNullable<T> => {
  if (!port) throw new Error(`[plugin-host] ${name} port is not wired by the composition root (plugin "${pluginId}")`)
  return port
}

interface InternalPluginRecord {
  readonly plugin: D2WebPlugin
  instance: PluginInstance | null
  ctx: PluginContext | null
  active: boolean
  error: string | null
  queue: Promise<void>
  disposers: Set<() => void>
  settingSubscribers: Set<(key: string) => void>
}

const KEBAB_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class PluginHost {
  private readonly session: PluginSessionView
  private readonly toolbar: PluginHostToolbarPort | null
  private readonly settingsStore: SettingsStore
  private readonly enforceClientDefaults: boolean
  private readonly configStore: PluginConfigStore
  private readonly records = new Map<string, InternalPluginRecord>()
  private readonly listeners = new Set<() => void>()
  private readonly automapClaims = new Set<string>()
  private readonly automapRadarClaims = new Set<string>()
  private readonly lightingClaims = new Set<string>()
  private readonly viewportClaims = new Set<string>()
  private readonly hudEnhancementsClaims = new Set<string>()
  private readonly groundItemEnhancementsClaims = new Set<string>()
  private readonly weatherClaims = new Set<string>()
  private fallbackAllowedViewports: readonly ViewportResolution[] =
    DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS
  private readonly unsubConfig: () => void
  private readonly quickCastPort: PluginQuickCastPort | null
  private readonly notifyPort: PluginNotifyPort | null
  /** Plugins currently claiming Quick Cast (Issue #952); empty set = vanilla behavior. */
  private readonly quickCastClaims = new Set<string>()
  private readonly settingPorts: Pick<WiredPortOptions, SettingPortName>
  private readonly togglePorts: ReadonlyMap<TogglePortName, { readonly port: PluginTogglePort | null; readonly claims: Set<string> }>
  private ready = false
  private destroyed = false
  private startPromise: Promise<void> | null = null

  constructor(options: PluginHostOptions) {
    validatePluginRegistry(options.plugins)
    this.session = options.session
    this.toolbar = options.toolbar ?? null
    this.quickCastPort = options.quickCast ?? null
    this.notifyPort = options.notify ?? null
    this.settingPorts = { autoCombat: options.autoCombat, townPortal: options.townPortal, autopilot: options.autopilot, autoPotion: options.autoPotion, autoLoot: options.autoLoot, inventoryCare: options.inventoryCare, itemInfo: options.itemInfo, pathGuide: options.pathGuide }
    this.togglePorts = new Map(TOGGLE_PORT_NAMES.map((name) => [name, { port: options[name] ?? null, claims: new Set<string>() }]))
    this.settingsStore = options.settingsStore ?? getGlobalSettingsStore()
    this.enforceClientDefaults = options.enforceClientDefaults ?? false
    this.configStore =
      options.configStore ??
      new PluginConfigStore(options.plugins, options.storageOptions)
    this.configStore.attachStorageListener()

    for (const plugin of options.plugins) {
      this.records.set(plugin.id, {
        plugin,
        instance: null,
        ctx: null,
        active: false,
        error: null,
        queue: Promise.resolve(),
        disposers: new Set(),
        settingSubscribers: new Set(),
      })
    }

    this.unsubConfig = this.configStore.subscribe((event) => {
      if (this.destroyed) return
      if (event.kind === 'setting' && event.pluginId && event.settingKey) {
        const record = this.records.get(event.pluginId)
        if (record && record.active) {
          this.notifySettingSubscribers(record, event.settingKey)
        }
        this.syncToolbarState()
        this.notifyListeners()
      } else if (event.kind === 'reload') {
        for (const [pluginId, record] of this.records.entries()) {
          const next = record.queue.then(async () => {
            if (this.destroyed) return
            const desired = this.configStore.isEnabled(pluginId)
            if (desired !== record.active) {
              if (desired) {
                await this.activateRecord(record)
              } else {
                await this.deactivateRecord(record)
              }
            } else if (record.active) {
              for (const spec of record.plugin.settings ?? []) {
                this.notifySettingSubscribers(record, spec.key)
              }
            }
          })
          record.queue = next.catch(() => {
            // Errors are isolated inside activateRecord / deactivateRecord
          })
        }
        this.syncToolbarState()
        this.notifyListeners()
      }
    })

    this.syncToolbarState()

    if (options.autoStart !== false) {
      this.startPromise = this.start()
    }
  }

  start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise
    }
    const tasks: Promise<void>[] = []
    for (const [pluginId, record] of this.records.entries()) {
      if (this.configStore.isEnabled(pluginId)) {
        tasks.push(this.enqueueTransition(record, true))
      }
    }
    this.startPromise = Promise.all(tasks).then(() => {
      if (this.enforceClientDefaults) {
        this.reconcileUnclaimedClientCapabilities()
      }
      this.ready = true
      this.syncToolbarState()
      this.notifyListeners()
    })
    return this.startPromise
  }

  whenStarted(): Promise<void> {
    return this.start()
  }

  isReady(): boolean {
    return this.ready
  }

  getConfigStore(): PluginConfigStore {
    return this.configStore
  }

  hasCorruptionError(): boolean {
    return this.configStore.hasCorruptionError()
  }

  getCorruptionMessage(): string | null {
    return this.configStore.getCorruptionMessage()
  }

  hasErrorOrCorruption(): boolean {
    if (this.configStore.hasCorruptionError()) {
      return true
    }
    for (const record of this.records.values()) {
      if (record.error !== null) {
        return true
      }
      if (record.active && record.instance?.getStatus) {
        try {
          if (record.instance.getStatus().level === 'error') {
            return true
          }
        } catch (err) {
          this.recordPluginError(record, 'getStatus', err)
          return true
        }
      }
    }
    return false
  }

  list(): readonly PluginDescriptorSnapshot[] {
    const out: PluginDescriptorSnapshot[] = []
    for (const [pluginId, record] of this.records.entries()) {
      out.push({
        id: pluginId,
        plugin: record.plugin,
        enabled: this.configStore.isEnabled(pluginId),
        active: record.active,
        status: this.getStatus(pluginId),
        settings: this.configStore.getAllSettings(pluginId),
        error: record.error,
      })
    }
    return out
  }

  getInstance<T = PluginInstance>(id: string): T | null {
    const record = this.records.get(id)
    if (!record || !record.active || !record.instance) {
      return null
    }
    return record.instance as unknown as T
  }

  isEnabled(id: string): boolean {
    this.requireRecord(id)
    return this.configStore.isEnabled(id)
  }

  setEnabled(id: string, enabled: boolean): Promise<void> {
    const record = this.requireRecord(id)
    this.configStore.setEnabled(id, enabled)
    this.syncToolbarState()
    this.notifyListeners()
    return this.enqueueTransition(record, enabled)
  }

  getSetting<T extends boolean | string = boolean | string>(
    id: string,
    key: string,
  ): T {
    this.requireRecord(id)
    return this.configStore.getSetting<T>(id, key)
  }

  setSetting(id: string, key: string, value: boolean | string): void {
    this.requireRecord(id)
    this.configStore.setSetting(id, key, value)
  }

  getStatus(id: string): PluginStatus {
    const record = this.requireRecord(id)
    if (record.error !== null) {
      return {
        level: 'error',
        text: {
          zh: `错误: ${record.error}`,
          en: `Error: ${record.error}`,
        },
      }
    }
    if (!this.configStore.isEnabled(id)) {
      return {
        level: 'ok',
        text: {
          zh: '已关闭',
          en: 'Disabled',
        },
      }
    }
    if (record.active && record.instance?.getStatus) {
      try {
        const status = record.instance.getStatus()
        if (
          !status ||
          typeof status !== 'object' ||
          (status.level !== 'ok' && status.level !== 'warn' && status.level !== 'error') ||
          !isValidLocalizedText(status.text)
        ) {
          throw new Error(
            `[PluginHost] Plugin "${id}" getStatus() must return { level: 'ok'|'warn'|'error', text: { zh, en } }`,
          )
        }
        if (status.level === 'error') {
          const zhText = status.text.zh.startsWith('错误')
            ? status.text.zh
            : `错误: ${status.text.zh}`
          const enText = status.text.en.toLowerCase().startsWith('error')
            ? status.text.en
            : `Error: ${status.text.en}`
          return {
            level: 'error',
            text: { zh: zhText, en: enText },
          }
        }
        return status
      } catch (err) {
        this.recordPluginError(record, 'getStatus', err)
        return {
          level: 'error',
          text: {
            zh: `错误: ${record.error}`,
            en: `Error: ${record.error}`,
          },
        }
      }
    }
    return {
      level: 'ok',
      text: {
        zh: '运行中',
        en: 'Active',
      },
    }
  }

  runAction(id: string, actionId: string): void {
    const record = this.requireRecord(id)
    const action = record.plugin.actions?.find((a) => a.id === actionId)
    if (!action) {
      throw new Error(`[PluginHost] Unknown action "${actionId}" on plugin "${id}"`)
    }
    if (action.kind === 'button') {
      if (!record.active || !record.ctx) {
        return
      }
      try {
        action.run(record.ctx)
      } catch (err) {
        this.recordPluginError(record, `action "${actionId}"`, err)
        this.syncToolbarState()
        this.notifyListeners()
      }
    }
  }

  async resetAllToDefaults(): Promise<void> {
    this.configStore.resetAllToDefaults()
    const tasks: Promise<void>[] = []
    for (const [pluginId, record] of this.records.entries()) {
      const targetEnabled = this.configStore.isEnabled(pluginId)
      record.error = null
      tasks.push(this.enqueueTransition(record, targetEnabled))
      if (targetEnabled && record.active) {
        for (const spec of record.plugin.settings ?? []) {
          this.notifySettingSubscribers(record, spec.key)
        }
      }
    }
    await Promise.all(tasks)
    if (this.enforceClientDefaults) {
      this.reconcileUnclaimedClientCapabilities()
    }
    this.syncToolbarState()
    this.notifyListeners()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async destroy(): Promise<void> {
    if (this.destroyed) return
    this.destroyed = true
    this.unsubConfig()
    this.configStore.detachStorageListener()
    const tasks: Promise<void>[] = []
    for (const record of this.records.values()) {
      tasks.push(this.enqueueTransition(record, false))
    }
    await Promise.all(tasks)
    this.listeners.clear()
  }

  private enqueueTransition(
    record: InternalPluginRecord,
    targetEnabled: boolean,
  ): Promise<void> {
    const next = record.queue.then(async () => {
      if (targetEnabled && !this.destroyed) {
        await this.activateRecord(record)
      } else {
        await this.deactivateRecord(record)
      }
    })
    record.queue = next.catch(() => {
      // Errors are isolated inside activateRecord / deactivateRecord
    })
    return next
  }

  /**
   * NOT 1.13c: Per-plugin Quick Cast toggle (Issue #952). Claims are host-tracked so the
   * capability is released automatically on deactivate; the last release restores the
   * vanilla select-on-press behavior.
   */
  private createQuickCastPort(
    record: InternalPluginRecord,
    isDisposed: () => boolean,
  ): PluginQuickCastPort {
    const pluginId = record.plugin.id
    const requirePort = (): PluginQuickCastPort => {
      if (!this.quickCastPort) {
        throw new Error(
          `[plugin-host] quickCast port is not wired by the composition root (plugin "${pluginId}")`,
        )
      }
      return this.quickCastPort
    }
    return {
      isEnabled: (): boolean => this.quickCastClaims.size > 0,
      setEnabled: (enabled: boolean): void => {
        if (isDisposed()) return
        requirePort()
        const release = (): void => {
          record.disposers.delete(release)
          this.quickCastClaims.delete(pluginId)
          if (this.quickCastClaims.size === 0 && this.quickCastPort) {
            this.quickCastPort.setEnabled(false)
          }
        }
        if (enabled) {
          if (this.quickCastClaims.has(pluginId)) return
          this.quickCastClaims.add(pluginId)
          record.disposers.add(release)
          this.quickCastPort!.setEnabled(true)
        } else {
          release()
        }
      },
    }
  }

  private createClaimedTogglePort(record: InternalPluginRecord, isDisposed: () => boolean, name: TogglePortName): PluginTogglePort {
    const pluginId = record.plugin.id
    const { port, claims } = this.togglePorts.get(name)!
    return {
      isEnabled: () => claims.size > 0,
      setEnabled: (enabled) => {
        if (isDisposed()) return
        const wiredPort = requireWiredPort(port, name, pluginId)
        const release = (): void => {
          record.disposers.delete(release)
          claims.delete(pluginId)
          if (claims.size === 0) wiredPort.setEnabled(false)
        }
        if (!enabled) return release()
        if (claims.has(pluginId)) return
        claims.add(pluginId)
        record.disposers.add(release)
        wiredPort.setEnabled(true)
      },
    }
  }

  private createWiredPorts(record: InternalPluginRecord, isDisposed: () => boolean): Pick<PluginContext, TogglePortName | SettingPortName> {
    const pluginId = record.plugin.id
    const { autoCombat, townPortal, autopilot, autoPotion, autoLoot, inventoryCare, itemInfo, pathGuide } = this.settingPorts
    const wired = <K extends SettingPortName>(name: K) => requireWiredPort(this.settingPorts[name], name, pluginId)
    return {
      ...(Object.fromEntries(TOGGLE_PORT_NAMES.map((name) => [name, this.createClaimedTogglePort(record, isDisposed, name)])) as Record<TogglePortName, PluginTogglePort>),
      autoCombat: { getKey: () => autoCombat?.getKey() ?? null, setKey: (key) => wired('autoCombat').setKey(key) },
      townPortal: { getKey: () => townPortal?.getKey() ?? null, setKey: (key) => wired('townPortal').setKey(key) },
      autopilot: { getKey: () => autopilot?.getKey() ?? null, setKey: (key) => wired('autopilot').setKey(key) },
      autoPotion: { getThresholds: () => autoPotion?.getThresholds() ?? null, setThresholds: (thresholds) => wired('autoPotion').setThresholds(thresholds) },
      autoLoot: { getRules: () => autoLoot?.getRules() ?? null, setRules: (rules) => wired('autoLoot').setRules(rules) },
      inventoryCare: { getConfig: () => inventoryCare?.getConfig() ?? null, setConfig: (config) => wired('inventoryCare').setConfig(config) },
      itemInfo: { getConfig: () => itemInfo?.getConfig() ?? null, setConfig: (config) => wired('itemInfo').setConfig(config) },
      pathGuide: { getMode: () => pathGuide?.getMode() ?? null, setMode: (mode) => wired('pathGuide').setMode(mode) },
    }
  }

  private createClientCapabilities(
    record: InternalPluginRecord,
    isDisposed: () => boolean,
  ): PluginClientCapabilities {
    const pluginId = record.plugin.id

    const claimAutomap = (): void => {
      if (isDisposed() || this.automapClaims.has(pluginId)) return
      this.automapClaims.add(pluginId)
      const release = (): void => {
        record.disposers.delete(release)
        this.automapClaims.delete(pluginId)
        if (this.automapClaims.size === 0 && this.settingsStore.get().automapReveal !== 'off') {
          this.settingsStore.set({ automapReveal: 'off' })
        }
      }
      record.disposers.add(release)
    }

    const claimAutomapRadar = (): void => {
      if (isDisposed() || this.automapRadarClaims.has(pluginId)) return
      this.automapRadarClaims.add(pluginId)
      const release = (): void => {
        record.disposers.delete(release)
        this.automapRadarClaims.delete(pluginId)
        if (this.automapRadarClaims.size === 0) {
          this.revertAutomapRadarToNative()
        }
      }
      record.disposers.add(release)
    }

    const claimLighting = (): void => {
      if (isDisposed() || this.lightingClaims.has(pluginId)) return
      this.lightingClaims.add(pluginId)
      const release = (): void => {
        record.disposers.delete(release)
        this.lightingClaims.delete(pluginId)
        if (this.lightingClaims.size === 0 && this.settingsStore.get().lightingPreset !== 'auto') {
          this.settingsStore.set({ lightingPreset: 'auto' })
        }
      }
      record.disposers.add(release)
    }

    const claimViewport = (): void => {
      if (isDisposed() || this.viewportClaims.has(pluginId)) return
      this.viewportClaims.add(pluginId)
      const release = (): void => {
        record.disposers.delete(release)
        this.viewportClaims.delete(pluginId)
        if (this.viewportClaims.size === 0) {
          this.revertAllowedViewportsToNative()
        }
      }
      record.disposers.add(release)
    }

    const claimHudEnhancements = (): void => {
      if (isDisposed() || this.hudEnhancementsClaims.has(pluginId)) return
      this.hudEnhancementsClaims.add(pluginId)
      const release = (): void => {
        record.disposers.delete(release)
        this.hudEnhancementsClaims.delete(pluginId)
        if (this.hudEnhancementsClaims.size === 0) {
          this.revertHudEnhancementsToNative()
        }
      }
      record.disposers.add(release)
    }

    const claimGroundItemEnhancements = (): void => {
      if (isDisposed() || this.groundItemEnhancementsClaims.has(pluginId)) return
      this.groundItemEnhancementsClaims.add(pluginId)
      const release = (): void => {
        record.disposers.delete(release)
        this.groundItemEnhancementsClaims.delete(pluginId)
        if (this.groundItemEnhancementsClaims.size === 0) {
          this.revertGroundItemEnhancementsToNative()
        }
      }
      record.disposers.add(release)
    }

    const claimWeather = (): void => {
      if (isDisposed() || this.weatherClaims.has(pluginId)) return
      this.weatherClaims.add(pluginId)
      const release = (): void => {
        record.disposers.delete(release)
        this.weatherClaims.delete(pluginId)
        if (this.weatherClaims.size === 0 && this.settingsStore.get().weatherOverride !== 'off') {
          this.settingsStore.set({ weatherOverride: 'off' })
        }
      }
      record.disposers.add(release)
    }

    return {
      getAutomapReveal: (): AutomapRevealMode => this.settingsStore.get().automapReveal,
      setAutomapReveal: (mode: AutomapRevealMode): void => {
        if (
          typeof mode !== 'string' ||
          !(VALID_AUTOMAP_REVEAL_MODES as readonly string[]).includes(mode)
        ) {
          throw new Error(
            `[PluginHost] Invalid automapReveal mode "${String(mode)}" from plugin "${pluginId}"`,
          )
        }
        if (isDisposed()) return
        claimAutomap()
        if (this.settingsStore.get().automapReveal !== mode) {
          this.settingsStore.set({ automapReveal: mode })
        }
        this.syncToolbarState()
      },
      subscribeAutomapReveal: (fn: (mode: AutomapRevealMode) => void): (() => void) => {
        if (isDisposed()) return () => {}
        claimAutomap()
        const unsub = this.settingsStore.subscribe((next, prev, changed) => {
          if (!changed.includes('automapReveal') || next.automapReveal === prev.automapReveal) {
            return
          }
          try {
            fn(next.automapReveal)
          } catch (err) {
            this.recordPluginError(record, 'automapReveal subscriber', err)
            this.syncToolbarState()
            this.notifyListeners()
          }
        })
        let removed = false
        const dispose = (): void => {
          if (removed) return
          removed = true
          record.disposers.delete(dispose)
          unsub()
        }
        record.disposers.add(dispose)
        return dispose
      },

      getAutomapRadar: (): AutomapRadarConfig => {
        const s = this.settingsStore.get()
        return {
          automapShowMonsters: s.automapShowMonsters,
          automapShowShrines: s.automapShowShrines,
          automapShowWaypoints: s.automapShowWaypoints,
        }
      },
      setAutomapRadar: (patch: Partial<AutomapRadarConfig>): void => {
        if (!patch || typeof patch !== 'object') {
          throw new Error(
            `[PluginHost] Invalid AutomapRadarConfig patch from plugin "${pluginId}"`,
          )
        }
        if (
          (patch.automapShowMonsters !== undefined &&
            typeof patch.automapShowMonsters !== 'boolean') ||
          (patch.automapShowShrines !== undefined &&
            typeof patch.automapShowShrines !== 'boolean') ||
          (patch.automapShowWaypoints !== undefined &&
            typeof patch.automapShowWaypoints !== 'boolean')
        ) {
          throw new Error(
            `[PluginHost] AutomapRadarConfig fields must be booleans on plugin "${pluginId}"`,
          )
        }
        if (isDisposed()) return
        claimAutomapRadar()
        const curr = this.settingsStore.get()
        const nextMonsters = patch.automapShowMonsters ?? curr.automapShowMonsters
        const nextShrines = patch.automapShowShrines ?? curr.automapShowShrines
        const nextWaypoints = patch.automapShowWaypoints ?? curr.automapShowWaypoints
        if (
          nextMonsters !== curr.automapShowMonsters ||
          nextShrines !== curr.automapShowShrines ||
          nextWaypoints !== curr.automapShowWaypoints
        ) {
          this.settingsStore.set({
            automapShowMonsters: nextMonsters,
            automapShowShrines: nextShrines,
            automapShowWaypoints: nextWaypoints,
          })
        }
        this.syncToolbarState()
      },
      subscribeAutomapRadar: (fn: (config: AutomapRadarConfig) => void): (() => void) => {
        if (isDisposed()) return () => {}
        claimAutomapRadar()
        const unsub = this.settingsStore.subscribe((next, prev, changed) => {
          if (
            (!changed.includes('automapShowMonsters') &&
              !changed.includes('automapShowShrines') &&
              !changed.includes('automapShowWaypoints')) ||
            (next.automapShowMonsters === prev.automapShowMonsters &&
              next.automapShowShrines === prev.automapShowShrines &&
              next.automapShowWaypoints === prev.automapShowWaypoints)
          ) {
            return
          }
          try {
            fn({
              automapShowMonsters: next.automapShowMonsters,
              automapShowShrines: next.automapShowShrines,
              automapShowWaypoints: next.automapShowWaypoints,
            })
          } catch (err) {
            this.recordPluginError(record, 'automapRadar subscriber', err)
            this.syncToolbarState()
            this.notifyListeners()
          }
        })
        let removed = false
        const dispose = (): void => {
          if (removed) return
          removed = true
          record.disposers.delete(dispose)
          unsub()
        }
        record.disposers.add(dispose)
        return dispose
      },

      getLightingPreset: (): ClientLightingPreset => this.settingsStore.get().lightingPreset,
      setLightingPreset: (preset: ClientLightingPreset): void => {
        if (
          typeof preset !== 'string' ||
          !(VALID_LIGHTING_PRESETS as readonly string[]).includes(preset)
        ) {
          throw new Error(
            `[PluginHost] Invalid lightingPreset "${String(preset)}" from plugin "${pluginId}"`,
          )
        }
        if (isDisposed()) return
        claimLighting()
        if (this.settingsStore.get().lightingPreset !== preset) {
          this.settingsStore.set({ lightingPreset: preset })
        }
        this.syncToolbarState()
      },
      subscribeLightingPreset: (fn: (preset: ClientLightingPreset) => void): (() => void) => {
        if (isDisposed()) return () => {}
        claimLighting()
        const unsub = this.settingsStore.subscribe((next, prev, changed) => {
          if (!changed.includes('lightingPreset') || next.lightingPreset === prev.lightingPreset) {
            return
          }
          try {
            fn(next.lightingPreset)
          } catch (err) {
            this.recordPluginError(record, 'lightingPreset subscriber', err)
            this.syncToolbarState()
            this.notifyListeners()
          }
        })
        let removed = false
        const dispose = (): void => {
          if (removed) return
          removed = true
          record.disposers.delete(dispose)
          unsub()
        }
        record.disposers.add(dispose)
        return dispose
      },

      getViewport: (): ViewportResolution => this.settingsStore.get().viewport,
      setViewport: (viewport: ViewportResolution): void => {
        if (
          typeof viewport !== 'string' ||
          !(VALID_VIEWPORT_RESOLUTIONS as readonly string[]).includes(viewport)
        ) {
          throw new Error(
            `[PluginHost] Invalid viewport "${String(viewport)}" from plugin "${pluginId}"`,
          )
        }
        if (isDisposed()) return
        claimViewport()
        if (this.settingsStore.get().viewport !== viewport) {
          this.settingsStore.set({ viewport })
        }
        this.syncToolbarState()
      },
      subscribeViewport: (fn: (viewport: ViewportResolution) => void): (() => void) => {
        if (isDisposed()) return () => {}
        claimViewport()
        const unsub = this.settingsStore.subscribe((next, prev, changed) => {
          if (!changed.includes('viewport') || next.viewport === prev.viewport) {
            return
          }
          try {
            fn(next.viewport)
          } catch (err) {
            this.recordPluginError(record, 'viewport subscriber', err)
            this.syncToolbarState()
            this.notifyListeners()
          }
        })
        let removed = false
        const dispose = (): void => {
          if (removed) return
          removed = true
          record.disposers.delete(dispose)
          unsub()
        }
        record.disposers.add(dispose)
        return dispose
      },
      getAllowedViewports: (): readonly ViewportResolution[] => {
        if (this.toolbar?.getAllowedViewports) {
          return this.toolbar.getAllowedViewports()
        }
        return this.fallbackAllowedViewports
      },
      setAllowedViewports: (resolutions: readonly ViewportResolution[]): void => {
        if (!Array.isArray(resolutions) || resolutions.length === 0) {
          throw new Error(
            `[PluginHost] setAllowedViewports on plugin "${pluginId}" requires a non-empty array`,
          )
        }
        const unique: ViewportResolution[] = []
        for (const r of resolutions) {
          if (
            typeof r !== 'string' ||
            !(VALID_VIEWPORT_RESOLUTIONS as readonly string[]).includes(r)
          ) {
            throw new Error(
              `[PluginHost] Invalid viewport resolution "${String(r)}" in setAllowedViewports on plugin "${pluginId}"`,
            )
          }
          const vp = r as ViewportResolution
          if (!unique.includes(vp)) {
            unique.push(vp)
          }
        }
        if (isDisposed()) return
        claimViewport()
        this.fallbackAllowedViewports = unique
        if (this.toolbar?.setAllowedViewports) {
          this.toolbar.setAllowedViewports(unique)
        } else if (!unique.includes(this.settingsStore.get().viewport)) {
          this.settingsStore.set({ viewport: pickFallbackViewport(unique) })
        }
      },

      getHudEnhancements: (): HudEnhancementsConfig => {
        const s = this.settingsStore.get()
        return {
          showBasePlusBonusStats: s.showBasePlusBonusStats,
          showBasePlusBonusSkills: s.showBasePlusBonusSkills,
          showStatGainTooltips: s.showStatGainTooltips,
          showWeaponDamageFormula: s.showWeaponDamageFormula,
          showAdvancedStatsButton: s.showAdvancedStatsButton,
          showRuneNumbers: s.showRuneNumbers,
        }
      },
      setHudEnhancements: (patch: Partial<HudEnhancementsConfig>): void => {
        if (!patch || typeof patch !== 'object') {
          throw new Error(
            `[PluginHost] Invalid HudEnhancementsConfig patch from plugin "${pluginId}"`,
          )
        }
        if (
          (patch.showBasePlusBonusStats !== undefined &&
            typeof patch.showBasePlusBonusStats !== 'boolean') ||
          (patch.showBasePlusBonusSkills !== undefined &&
            typeof patch.showBasePlusBonusSkills !== 'boolean') ||
          (patch.showStatGainTooltips !== undefined &&
            typeof patch.showStatGainTooltips !== 'boolean') ||
          (patch.showWeaponDamageFormula !== undefined &&
            typeof patch.showWeaponDamageFormula !== 'boolean') ||
          (patch.showAdvancedStatsButton !== undefined &&
            typeof patch.showAdvancedStatsButton !== 'boolean') ||
          (patch.showRuneNumbers !== undefined &&
            typeof patch.showRuneNumbers !== 'boolean')
        ) {
          throw new Error(
            `[PluginHost] HudEnhancementsConfig fields must be booleans on plugin "${pluginId}"`,
          )
        }
        if (isDisposed()) return
        claimHudEnhancements()
        const curr = this.settingsStore.get()
        const nextStats = patch.showBasePlusBonusStats ?? curr.showBasePlusBonusStats
        const nextSkills = patch.showBasePlusBonusSkills ?? curr.showBasePlusBonusSkills
        const nextStatTips = patch.showStatGainTooltips ?? curr.showStatGainTooltips
        const nextWeapDmgFormula = patch.showWeaponDamageFormula ?? curr.showWeaponDamageFormula
        const nextAdvStatsBtn = patch.showAdvancedStatsButton ?? curr.showAdvancedStatsButton
        const nextRuneNumbers = patch.showRuneNumbers ?? curr.showRuneNumbers
        if (
          nextStats !== curr.showBasePlusBonusStats ||
          nextSkills !== curr.showBasePlusBonusSkills ||
          nextStatTips !== curr.showStatGainTooltips ||
          nextWeapDmgFormula !== curr.showWeaponDamageFormula ||
          nextAdvStatsBtn !== curr.showAdvancedStatsButton ||
          nextRuneNumbers !== curr.showRuneNumbers
        ) {
          this.settingsStore.set({
            showBasePlusBonusStats: nextStats,
            showBasePlusBonusSkills: nextSkills,
            showStatGainTooltips: nextStatTips,
            showWeaponDamageFormula: nextWeapDmgFormula,
            showAdvancedStatsButton: nextAdvStatsBtn,
            showRuneNumbers: nextRuneNumbers,
          })
        }
        this.syncToolbarState()
      },
      subscribeHudEnhancements: (fn: (config: HudEnhancementsConfig) => void): (() => void) => {
        if (isDisposed()) return () => {}
        claimHudEnhancements()
        const unsub = this.settingsStore.subscribe((next, prev, changed) => {
          if (
            (!changed.includes('showBasePlusBonusStats') &&
              !changed.includes('showBasePlusBonusSkills') &&
              !changed.includes('showStatGainTooltips') &&
              !changed.includes('showWeaponDamageFormula') &&
              !changed.includes('showAdvancedStatsButton') &&
              !changed.includes('showRuneNumbers')) ||
            (next.showBasePlusBonusStats === prev.showBasePlusBonusStats &&
              next.showBasePlusBonusSkills === prev.showBasePlusBonusSkills &&
              next.showStatGainTooltips === prev.showStatGainTooltips &&
              next.showWeaponDamageFormula === prev.showWeaponDamageFormula &&
              next.showAdvancedStatsButton === prev.showAdvancedStatsButton &&
              next.showRuneNumbers === prev.showRuneNumbers)
          ) {
            return
          }
          try {
            fn({
              showBasePlusBonusStats: next.showBasePlusBonusStats,
              showBasePlusBonusSkills: next.showBasePlusBonusSkills,
              showStatGainTooltips: next.showStatGainTooltips,
              showWeaponDamageFormula: next.showWeaponDamageFormula,
              showAdvancedStatsButton: next.showAdvancedStatsButton,
              showRuneNumbers: next.showRuneNumbers,
            })
          } catch (err) {
            this.recordPluginError(record, 'hudEnhancements subscriber', err)
            this.syncToolbarState()
            this.notifyListeners()
          }
        })
        let removed = false
        const dispose = (): void => {
          if (removed) return
          removed = true
          record.disposers.delete(dispose)
          unsub()
        }
        record.disposers.add(dispose)
        return dispose
      },

      getGroundItemEnhancements: (): GroundItemEnhancementsConfig => {
        const s = this.settingsStore.get()
        return {
          showUniqueSetBeams: s.showUniqueSetBeams,
          alwaysShowUniqueSetLabels: s.alwaysShowUniqueSetLabels,
        }
      },
      setGroundItemEnhancements: (patch: Partial<GroundItemEnhancementsConfig>): void => {
        if (!patch || typeof patch !== 'object') {
          throw new Error(
            `[PluginHost] Invalid GroundItemEnhancementsConfig patch from plugin "${pluginId}"`,
          )
        }
        if (
          (patch.showUniqueSetBeams !== undefined &&
            typeof patch.showUniqueSetBeams !== 'boolean') ||
          (patch.alwaysShowUniqueSetLabels !== undefined &&
            typeof patch.alwaysShowUniqueSetLabels !== 'boolean')
        ) {
          throw new Error(
            `[PluginHost] GroundItemEnhancementsConfig fields must be booleans on plugin "${pluginId}"`,
          )
        }
        if (isDisposed()) return
        claimGroundItemEnhancements()
        const curr = this.settingsStore.get()
        const nextBeams = patch.showUniqueSetBeams ?? curr.showUniqueSetBeams
        const nextLabels = patch.alwaysShowUniqueSetLabels ?? curr.alwaysShowUniqueSetLabels
        if (
          nextBeams !== curr.showUniqueSetBeams ||
          nextLabels !== curr.alwaysShowUniqueSetLabels
        ) {
          this.settingsStore.set({
            showUniqueSetBeams: nextBeams,
            alwaysShowUniqueSetLabels: nextLabels,
          })
        }
        this.syncToolbarState()
      },
      subscribeGroundItemEnhancements: (
        fn: (config: GroundItemEnhancementsConfig) => void,
      ): (() => void) => {
        if (isDisposed()) return () => {}
        claimGroundItemEnhancements()
        const unsub = this.settingsStore.subscribe((next, prev, changed) => {
          if (
            (!changed.includes('showUniqueSetBeams') &&
              !changed.includes('alwaysShowUniqueSetLabels')) ||
            (next.showUniqueSetBeams === prev.showUniqueSetBeams &&
              next.alwaysShowUniqueSetLabels === prev.alwaysShowUniqueSetLabels)
          ) {
            return
          }
          try {
            fn({
              showUniqueSetBeams: next.showUniqueSetBeams,
              alwaysShowUniqueSetLabels: next.alwaysShowUniqueSetLabels,
            })
          } catch (err) {
            this.recordPluginError(record, 'groundItemEnhancements subscriber', err)
            this.syncToolbarState()
            this.notifyListeners()
          }
        })
        let removed = false
        const dispose = (): void => {
          if (removed) return
          removed = true
          record.disposers.delete(dispose)
          unsub()
        }
        record.disposers.add(dispose)
        return dispose
      },

      getWeatherOverride: (): WeatherOverrideSetting => this.settingsStore.get().weatherOverride,
      setWeatherOverride: (mode: WeatherOverrideSetting): void => {
        if (
          typeof mode !== 'string' ||
          !(VALID_WEATHER_OVERRIDES as readonly string[]).includes(mode)
        ) {
          throw new Error(
            `[PluginHost] Invalid weatherOverride "${String(mode)}" from plugin "${pluginId}"`,
          )
        }
        if (isDisposed()) return
        claimWeather()
        if (this.settingsStore.get().weatherOverride !== mode) {
          this.settingsStore.set({ weatherOverride: mode })
        }
        this.syncToolbarState()
      },
      subscribeWeatherOverride: (fn: (mode: WeatherOverrideSetting) => void): (() => void) => {
        if (isDisposed()) return () => {}
        claimWeather()
        const unsub = this.settingsStore.subscribe((next, prev, changed) => {
          if (!changed.includes('weatherOverride') || next.weatherOverride === prev.weatherOverride) {
            return
          }
          try {
            fn(next.weatherOverride)
          } catch (err) {
            this.recordPluginError(record, 'weatherOverride subscriber', err)
            this.syncToolbarState()
            this.notifyListeners()
          }
        })
        let removed = false
        const dispose = (): void => {
          if (removed) return
          removed = true
          record.disposers.delete(dispose)
          unsub()
        }
        record.disposers.add(dispose)
        return dispose
      },
    }
  }

  private reconcileUnclaimedClientCapabilities(): void {
    if (this.automapClaims.size === 0 && this.settingsStore.get().automapReveal !== 'off') {
      this.settingsStore.set({ automapReveal: 'off' })
    }
    if (this.automapRadarClaims.size === 0) {
      this.revertAutomapRadarToNative()
    }
    if (this.lightingClaims.size === 0 && this.settingsStore.get().lightingPreset !== 'auto') {
      this.settingsStore.set({ lightingPreset: 'auto' })
    }
    if (this.viewportClaims.size === 0) {
      this.revertAllowedViewportsToNative()
    }
    if (this.hudEnhancementsClaims.size === 0) {
      this.revertHudEnhancementsToNative()
    }
    if (this.groundItemEnhancementsClaims.size === 0) {
      this.revertGroundItemEnhancementsToNative()
    }
    if (this.weatherClaims.size === 0 && this.settingsStore.get().weatherOverride !== 'off') {
      this.settingsStore.set({ weatherOverride: 'off' })
    }
  }

  private revertAutomapRadarToNative(): void {
    const curr = this.settingsStore.get()
    if (curr.automapShowMonsters || curr.automapShowShrines || curr.automapShowWaypoints) {
      this.settingsStore.set({
        automapShowMonsters: false,
        automapShowShrines: false,
        automapShowWaypoints: false,
      })
    }
  }

  private revertHudEnhancementsToNative(): void {
    const curr = this.settingsStore.get()
    if (
      curr.showBasePlusBonusStats ||
      curr.showBasePlusBonusSkills ||
      curr.showStatGainTooltips ||
      curr.showWeaponDamageFormula ||
      curr.showAdvancedStatsButton ||
      curr.showRuneNumbers
    ) {
      this.settingsStore.set({
        showBasePlusBonusStats: false,
        showBasePlusBonusSkills: false,
        showStatGainTooltips: false,
        showWeaponDamageFormula: false,
        showAdvancedStatsButton: false,
        showRuneNumbers: false,
      })
    }
  }

  private revertGroundItemEnhancementsToNative(): void {
    const curr = this.settingsStore.get()
    if (curr.showUniqueSetBeams || curr.alwaysShowUniqueSetLabels) {
      this.settingsStore.set({
        showUniqueSetBeams: false,
        alwaysShowUniqueSetLabels: false,
      })
    }
  }

  /** Back to the default allowed list (PD2 SGD2FreeRes), once no plugin claims the viewport list. */
  private revertAllowedViewportsToNative(): void {
    this.fallbackAllowedViewports = DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS
    if (this.toolbar?.setAllowedViewports) {
      this.toolbar.setAllowedViewports(DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS)
    } else if (!DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS.includes(this.settingsStore.get().viewport)) {
      this.settingsStore.set({ viewport: pickFallbackViewport(DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS) })
    }
  }

  private async activateRecord(record: InternalPluginRecord): Promise<void> {
    if (record.active) {
      return
    }
    record.error = null
    this.disposeRecordResources(record)

    let contextDisposed = false
    const pluginId = record.plugin.id

    const logger: PluginLogger = {
      info: (msg: string, ...args: unknown[]): void => {
        console.info(`[plugin:${pluginId}] ${msg}`, ...args)
      },
      warn: (msg: string, ...args: unknown[]): void => {
        console.warn(`[plugin:${pluginId}] ${msg}`, ...args)
      },
      error: (msg: string, ...args: unknown[]): void => {
        console.error(`[plugin:${pluginId}] ${msg}`, ...args)
        record.error = msg
        this.syncToolbarState()
        this.notifyListeners()
      },
    }

    const ctx: PluginContext = {
      pluginId,
      session: this.session,
      settings: {
        get: (key: string): boolean | string => {
          return this.configStore.getSetting(pluginId, key)
        },
        set: (key: string, value: boolean | string): void => {
          if (contextDisposed) return
          this.configStore.setSetting(pluginId, key, value)
        },
        subscribe: (fn: (key: string) => void): (() => void) => {
          if (contextDisposed) {
            return () => {}
          }
          record.settingSubscribers.add(fn)
          const remove = (): void => {
            record.settingSubscribers.delete(fn)
            record.disposers.delete(remove)
          }
          record.disposers.add(remove)
          return remove
        },
      },
      toolbar: (() => {
        const makeNoopHandle = (): ToolbarContributionHandle => {
          const noop = (): void => {}
          return Object.assign(noop, {
            dispose: noop,
            update: (): void => {},
          })
        }

        const bindContributionHandle = (
          rawHandle: ToolbarContributionHandle | (() => void) | undefined,
        ): ToolbarContributionHandle => {
          let removed = false
          const dispose = (): void => {
            if (removed) return
            removed = true
            record.disposers.delete(dispose)
            if (typeof rawHandle === 'function') {
              rawHandle()
            } else if (
              rawHandle &&
              typeof (rawHandle as { dispose?: () => void }).dispose === 'function'
            ) {
              ;(rawHandle as { dispose: () => void }).dispose()
            }
          }
          const update = (patch: ToolbarContributionPatch): void => {
            if (removed || contextDisposed) return
            if (patch.label !== undefined && !isValidLocalizedText(patch.label)) {
              throw new Error(
                `[PluginHost] Plugin "${record.plugin.id}" toolbar update must provide non-empty localized label`,
              )
            }
            if (patch.tooltip !== undefined && !isValidLocalizedText(patch.tooltip)) {
              throw new Error(
                `[PluginHost] Plugin "${record.plugin.id}" toolbar update must provide non-empty localized tooltip`,
              )
            }
            if (
              rawHandle &&
              typeof (rawHandle as ToolbarContributionHandle).update === 'function'
            ) {
              ;(rawHandle as ToolbarContributionHandle).update!(patch)
            }
          }
          const handle: ToolbarContributionHandle = Object.assign(dispose, {
            dispose,
            update,
          })
          record.disposers.add(dispose)
          return handle
        }

        const addLink = (spec: {
          id: string
          label: LocalizedText
          tooltip?: LocalizedText | undefined
          iconSvg?: string | undefined
          href: string
        }): ToolbarContributionHandle => {
          if (!spec || typeof spec.id !== 'string' || !KEBAB_ID_RE.test(spec.id)) {
            throw new Error(
              `[PluginHost] Toolbar link id "${String(spec?.id)}" on plugin "${pluginId}" must be kebab-case`,
            )
          }
          if (!isValidLocalizedText(spec.label)) {
            throw new Error(
              `[PluginHost] Toolbar link "${spec.id}" on plugin "${pluginId}" must have localized label`,
            )
          }
          if (!isRelativePluginHref(spec.href)) {
            throw new Error(
              `[PluginHost] Toolbar link "${spec.id}" on plugin "${pluginId}" href "${String(spec.href)}" must be relative`,
            )
          }
          if (contextDisposed) {
            return makeNoopHandle()
          }
          const domId = `d2-toolbar-plugin-${pluginId}-${spec.id}`
          const rawHandle = this.toolbar?.addContribution({
            domId,
            kind: 'link',
            label: spec.label,
            ...(spec.tooltip !== undefined ? { tooltip: spec.tooltip } : {}),
            ...(spec.iconSvg !== undefined ? { iconSvg: spec.iconSvg } : {}),
            href: spec.href,
          })
          return bindContributionHandle(rawHandle)
        }

        const addButton = (spec: {
          id: string
          label: LocalizedText
          tooltip?: LocalizedText | undefined
          iconSvg?: string | undefined
          onClick(): void
        }): ToolbarContributionHandle => {
          if (!spec || typeof spec.id !== 'string' || !KEBAB_ID_RE.test(spec.id)) {
            throw new Error(
              `[PluginHost] Toolbar button id "${String(spec?.id)}" on plugin "${pluginId}" must be kebab-case`,
            )
          }
          if (!isValidLocalizedText(spec.label)) {
            throw new Error(
              `[PluginHost] Toolbar button "${spec.id}" on plugin "${pluginId}" must have localized label`,
            )
          }
          if (typeof spec.onClick !== 'function') {
            throw new Error(
              `[PluginHost] Toolbar button "${spec.id}" on plugin "${pluginId}" must provide onClick`,
            )
          }
          if (contextDisposed) {
            return makeNoopHandle()
          }
          const domId = `d2-toolbar-plugin-${pluginId}-${spec.id}`
          const rawHandle = this.toolbar?.addContribution({
            domId,
            kind: 'button',
            label: spec.label,
            ...(spec.tooltip !== undefined ? { tooltip: spec.tooltip } : {}),
            ...(spec.iconSvg !== undefined ? { iconSvg: spec.iconSvg } : {}),
            onClick: () => {
              try {
                spec.onClick()
              } catch (err) {
                this.recordPluginError(record, `toolbar button "${spec.id}"`, err)
                this.syncToolbarState()
                this.notifyListeners()
              }
            },
          })
          return bindContributionHandle(rawHandle)
        }

        const addSelect = (spec: PluginToolbarSelectSpec): ToolbarContributionHandle => {
          if (!spec || typeof spec.id !== 'string' || !KEBAB_ID_RE.test(spec.id)) {
            throw new Error(
              `[PluginHost] Toolbar select id "${String(spec?.id)}" on plugin "${pluginId}" must be kebab-case`,
            )
          }
          if (!isValidLocalizedText(spec.label)) {
            throw new Error(
              `[PluginHost] Toolbar select "${spec.id}" on plugin "${pluginId}" must have localized label`,
            )
          }
          if (!Array.isArray(spec.options) || spec.options.length === 0) {
            throw new Error(
              `[PluginHost] Toolbar select "${spec.id}" on plugin "${pluginId}" must have non-empty options`,
            )
          }
          for (const opt of spec.options) {
            if (
              !opt ||
              typeof opt.value !== 'string' ||
              opt.value.trim().length === 0 ||
              !isValidLocalizedText(opt.label)
            ) {
              throw new Error(
                `[PluginHost] Toolbar select "${spec.id}" on plugin "${pluginId}" has an invalid option`,
              )
            }
          }
          if (typeof spec.getValue !== 'function' || typeof spec.onChange !== 'function') {
            throw new Error(
              `[PluginHost] Toolbar select "${spec.id}" on plugin "${pluginId}" must provide getValue and onChange`,
            )
          }
          if (contextDisposed) {
            return makeNoopHandle()
          }
          const domId = `d2-toolbar-plugin-${pluginId}-${spec.id}`
          const selectDomId =
            typeof spec.selectDomId === 'string' && spec.selectDomId.trim().length > 0
              ? spec.selectDomId.trim()
              : `${domId}-select`
          const rawHandle = this.toolbar?.addContribution({
            domId,
            selectDomId,
            kind: 'select',
            label: spec.label,
            options: spec.options,
            getValue: () => spec.getValue(),
            onChange: (value: string) => {
              try {
                spec.onChange(value)
              } catch (err) {
                this.recordPluginError(record, `toolbar select "${spec.id}"`, err)
                this.syncToolbarState()
                this.notifyListeners()
              }
            },
          })
          return bindContributionHandle(rawHandle)
        }

        const addContribution = (
          spec: PluginToolbarContributionSpec,
        ): ToolbarContributionHandle => {
          if (spec.kind === 'link' || (typeof spec.href === 'string' && !spec.onClick)) {
            return addLink({
              id: spec.id,
              label: spec.label,
              ...(spec.tooltip !== undefined ? { tooltip: spec.tooltip } : {}),
              href: spec.href ?? '',
            })
          }
          return addButton({
            id: spec.id,
            label: spec.label,
            ...(spec.tooltip !== undefined ? { tooltip: spec.tooltip } : {}),
            onClick: spec.onClick ?? (() => {}),
          })
        }

        return {
          addLink,
          addButton,
          addSelect,
          addContribution,
        }
      })(),
      client: this.createClientCapabilities(record, () => contextDisposed),
      quickCast: this.createQuickCastPort(record, () => contextDisposed),
      notify: { show: (toast) => void (contextDisposed || this.notifyPort?.show(toast)) },
      ...this.createWiredPorts(record, () => contextDisposed),
      lang: (() => {
        const subscribe = (fn: (lang: GameLang) => void): (() => void) => {
          if (contextDisposed) {
            return () => {}
          }
          const unsub = onLangChange((lang) => {
            try {
              fn(lang)
            } catch (err) {
              this.recordPluginError(record, 'lang subscriber', err)
              this.syncToolbarState()
              this.notifyListeners()
            }
          })
          let removed = false
          const dispose = (): void => {
            if (removed) return
            removed = true
            record.disposers.delete(dispose)
            unsub()
          }
          record.disposers.add(dispose)
          return dispose
        }
        return {
          get: (): GameLang => getGameLang(),
          subscribe,
          onChange: subscribe,
        }
      })(),
      log: logger,
      notifyStatusChanged: (): void => {
        if (contextDisposed) return
        this.syncToolbarState()
        this.notifyListeners()
      },
    }

    record.disposers.add(() => {
      contextDisposed = true
    })

    try {
      const instance = await record.plugin.activate(ctx)
      record.ctx = ctx
      record.instance = instance
      record.active = true
      this.syncToolbarState()
      this.notifyListeners()
    } catch (err) {
      this.disposeRecordResources(record)
      record.ctx = null
      record.instance = null
      record.active = false
      this.recordPluginError(record, 'activate', err)
      this.syncToolbarState()
      this.notifyListeners()
    }
  }

  private async deactivateRecord(record: InternalPluginRecord): Promise<void> {
    const instance = record.instance
    record.instance = null
    record.ctx = null
    record.active = false

    let deactivateError: unknown = null
    if (instance && typeof instance.deactivate === 'function') {
      try {
        await instance.deactivate()
      } catch (err) {
        deactivateError = err
      }
    }

    this.disposeRecordResources(record)

    if (deactivateError !== null) {
      this.recordPluginError(record, 'deactivate', deactivateError)
    } else {
      record.error = null
    }

    this.syncToolbarState()
    this.notifyListeners()
  }

  private disposeRecordResources(record: InternalPluginRecord): void {
    record.settingSubscribers.clear()
    for (const dispose of [...record.disposers]) {
      try {
        dispose()
      } catch (err) {
        console.error(`[plugin:${record.plugin.id}] Error during resource cleanup:`, err)
      }
    }
    record.disposers.clear()
  }

  private notifySettingSubscribers(record: InternalPluginRecord, key: string): void {
    for (const fn of [...record.settingSubscribers]) {
      try {
        fn(key)
      } catch (err) {
        this.recordPluginError(record, `setting subscriber (${key})`, err)
      }
    }
  }

  private recordPluginError(
    record: InternalPluginRecord,
    phase: string,
    err: unknown,
  ): void {
    const message = err instanceof Error ? err.message : String(err)
    record.error = message
    console.error(`[plugin:${record.plugin.id}] Error in ${phase}:`, err)
  }

  private syncToolbarState(): void {
    this.toolbar?.setPluginsButtonState({
      ready: this.ready,
      hasWarning: this.hasErrorOrCorruption(),
    })
  }

  private requireRecord(id: string): InternalPluginRecord {
    const record = this.records.get(id)
    if (!record) {
      throw new Error(`[PluginHost] Unknown plugin id "${id}"`)
    }
    return record
  }

  private notifyListeners(): void {
    for (const listener of [...this.listeners]) {
      listener()
    }
  }
}
