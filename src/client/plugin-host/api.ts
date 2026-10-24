/**
 * Public Plugin API Contract (`src/client/plugin-host/api.ts`).
 *
 * Architectural Rule 9: This is the SOLE `src/client/` module that `plugins/**` may import.
 * It defines the plugin descriptor contract, runtime context, status reporting, fail-fast
 * registry validation, and the standalone plugin page bootstrapper (`bootPluginPage`).
 */

import {
  getGameLang,
  initLangFromBrowser,
  onLangChange,
  setLang,
  type GameLang,
} from '../i18n/lang.ts'
import {
  CLIENT_LIGHTING_PRESET_ORDER,
  LIGHTING_PRESETS,
  type LightingPresetConfig,
} from '../../client/scene/lighting-presets.ts'
import {
  DuplicateCharacterLoginError,
  OnlineSession,
  formatLobbyGameEnterError,
  parseMcpGameErrorStatus,
  type OnlineSessionLobbySnapshot,
  type OnlineSessionLoginParams,
  type OnlineSessionOptions,
} from '../session/online-session.ts'
import type { AutoPotionThresholds } from '../input/auto-potion.ts'
import type { AutoLootRules, LootCategories } from '../input/auto-loot.ts'
import type { InventoryCareConfig } from '../input/inventory-care.ts'
import type { ItemInfoConfig, LootFilter } from '../ui/ground-item-info.ts'
import type { GuideMode } from '../guide/route.ts'
import type { MenuLayout } from './mod-menu-text.ts'
import { HudManager } from '../ui/hud-manager.ts'
import {
  INV_COLS,
  INV_ROWS,
  findFreeGridSlot,
  getInventoryGoldLimit,
  getStashGoldLimit,
  type GridPlacement,
  type UiInventoryItem,
} from '../ui/inventory.ts'
import type { ClientUnit } from '../world/client-unit.ts'
import type { ChatLogEntry, ClientWorld } from '../world/client-world.ts'
import {
  DEFAULT_VIEWPORT_RESOLUTION,
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
import { getGlobalSettingsStore } from '../settings/settings-store.ts'
import {
  DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS,
  EXTENDED_VIEWPORT_RESOLUTIONS,
  NATIVE_113C_VIEWPORT_RESOLUTIONS,
  VIEWPORT_PROFILES,
  formatViewportLabel,
  getViewportProfile,
  isExtendedViewport,
  type ViewportProfile,
} from '../view/viewport-profile.ts'
import {
  PluginConfigStore,
} from './plugin-config-store.ts'

export {
  CLIENT_LIGHTING_PRESET_ORDER,
  DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS,
  DEFAULT_VIEWPORT_RESOLUTION,
  DuplicateCharacterLoginError,
  EXTENDED_VIEWPORT_RESOLUTIONS,
  HudManager,
  INV_COLS,
  INV_ROWS,
  LIGHTING_PRESETS,
  NATIVE_113C_VIEWPORT_RESOLUTIONS,
  OnlineSession,
  VALID_AUTOMAP_REVEAL_MODES,
  VALID_LIGHTING_PRESETS,
  VALID_VIEWPORT_RESOLUTIONS,
  VALID_WEATHER_OVERRIDES,
  VIEWPORT_PROFILES,
  findFreeGridSlot,
  formatLobbyGameEnterError,
  formatViewportLabel,
  getInventoryGoldLimit,
  getStashGoldLimit,
  getViewportProfile,
  isExtendedViewport,
  parseMcpGameErrorStatus,
  type AutomapRadarConfig,
  type AutomapRevealMode,
  type ChatLogEntry,
  type ClientLightingPreset,
  type ClientUnit,
  type ClientWorld,
  type GameLang,
  type GridPlacement,
  type GroundItemEnhancementsConfig,
  type HudEnhancementsConfig,
  type LightingPresetConfig,
  type OnlineSessionLobbySnapshot,
  type OnlineSessionLoginParams,
  type OnlineSessionOptions,
  type UiInventoryItem,
  type ViewportProfile,
  type ViewportResolution,
  type WeatherOverrideSetting,
}

export interface LocalizedText {
  readonly zh: string
  readonly en: string
}

export interface PluginSettingCondition {
  readonly key: string
  readonly is: readonly (string | boolean)[]
}

export type PluginSettingSpec = (
  | {
      readonly kind: 'boolean'
      readonly key: string
      readonly label: LocalizedText
      readonly default: boolean
    }
  | {
      readonly kind: 'select'
      readonly key: string
      readonly label: LocalizedText
      readonly default: string
      readonly options: readonly {
        readonly value: string
        readonly label: LocalizedText
      }[]
    }
) & { readonly shownWhen?: readonly PluginSettingCondition[] | undefined }

export type PluginActionSpec =
  | {
      readonly kind: 'link'
      readonly id: string
      readonly label: LocalizedText
      readonly href: string
    }
  | {
      readonly kind: 'button'
      readonly id: string
      readonly label: LocalizedText
      run(ctx: PluginContext): void
    }

export interface D2WebPlugin {
  readonly id: string
  readonly name: LocalizedText
  readonly description: LocalizedText
  readonly author?: string | undefined
  readonly defaultEnabled: boolean
  readonly settings?: readonly PluginSettingSpec[]
  readonly actions?: readonly PluginActionSpec[]
  activate(ctx: PluginContext): PluginInstance | Promise<PluginInstance>
}

export interface PluginInstance {
  deactivate(): void | Promise<void>
  getStatus?(): PluginStatus
}

export interface PluginStatus {
  readonly level: 'ok' | 'warn' | 'error'
  readonly text: LocalizedText
}

export type PluginSessionView = Pick<
  OnlineSession,
  'phase' | 'world' | 'loginHost' | 'getSnapshot' | 'onServerEvent' | 'onStateChange'
>

export interface PluginLogger {
  info(msg: string, ...args: unknown[]): void
  warn(msg: string, ...args: unknown[]): void
  error(msg: string, ...args: unknown[]): void
}

export interface PluginToolbarSelectOption {
  readonly value: string
  readonly label: LocalizedText
}

export interface PluginToolbarSelectSpec {
  readonly id: string
  readonly selectDomId?: string | undefined
  readonly label: LocalizedText
  readonly options: readonly PluginToolbarSelectOption[]
  getValue(): string
  onChange(value: string): void
}

export interface PluginClientCapabilities {
  getAutomapReveal(): AutomapRevealMode
  setAutomapReveal(mode: AutomapRevealMode): void
  subscribeAutomapReveal(fn: (mode: AutomapRevealMode) => void): () => void

  /**
   * NOT 1.13c: MapHack-style automap monster crosshairs & shrine type badges (Issue #881).
   * Setting or subscribing claims the capability; when unclaimed, reverts to `{ false, false }`.
   */
  getAutomapRadar(): AutomapRadarConfig
  setAutomapRadar(patch: Partial<AutomapRadarConfig>): void
  subscribeAutomapRadar(fn: (config: AutomapRadarConfig) => void): () => void

  getLightingPreset(): ClientLightingPreset
  setLightingPreset(preset: ClientLightingPreset): void
  subscribeLightingPreset(fn: (preset: ClientLightingPreset) => void): () => void

  getViewport(): ViewportResolution
  setViewport(viewport: ViewportResolution): void
  subscribeViewport(fn: (viewport: ViewportResolution) => void): () => void
  getAllowedViewports(): readonly ViewportResolution[]
  setAllowedViewports(resolutions: readonly ViewportResolution[]): void

  getHudEnhancements(): HudEnhancementsConfig
  setHudEnhancements(patch: Partial<HudEnhancementsConfig>): void
  subscribeHudEnhancements(fn: (config: HudEnhancementsConfig) => void): () => void

  /**
   * NOT 1.13c: Ground item display enhancements (Diablo III-style loot beam & permanent labels
   * for Unique/Set ground items, Issue #957). Setting or subscribing claims the capability;
   * when unclaimed, reverts to `{ showUniqueSetBeams: false, alwaysShowUniqueSetLabels: false }`.
   */
  getGroundItemEnhancements(): GroundItemEnhancementsConfig
  setGroundItemEnhancements(patch: Partial<GroundItemEnhancementsConfig>): void
  subscribeGroundItemEnhancements(fn: (config: GroundItemEnhancementsConfig) => void): () => void

  /**
   * NOT 1.13c: forced precipitation (`'off'` is the vanilla 1.13c weather). Setting or subscribing
   * claims it; once no active plugin claims it, the host restores `'off'`.
   */
  getWeatherOverride(): WeatherOverrideSetting
  setWeatherOverride(mode: WeatherOverrideSetting): void
  subscribeWeatherOverride(fn: (mode: WeatherOverrideSetting) => void): () => void
}

/**
 * NOT 1.13c: Quick Cast capability port (Issue #952, PD2/D2R-style keybind casting).
 *
 * A single boolean toggle — no configuration. While claimed, pressing a bound skill
 * hotkey (bindings made via the native `S` skill popup flow; the bindable key range is
 * owned by the binding flow, not by this port) casts the bound skill immediately at the
 * mouse cursor instead of switching the active skill selection. The cast reuses the
 * original wire sequence `SelectSkill (0x3C)` → `SkillAt`/`SkillOn` → `SelectSkill`
 * restore inside `CommandMapper`, so no plugin-side casting API is needed. When the last
 * claiming plugin deactivates, the host restores the vanilla select-on-press behavior.
 */
export interface PluginQuickCastPort {
  isEnabled(): boolean
  /** Claim (true) / release (false) Quick Cast; releasing the last claim restores vanilla behavior. */
  setEnabled(enabled: boolean): void
}

export type PluginTogglePort = PluginQuickCastPort

export type PluginToastColor = 'white' | 'red' | 'green' | 'blue' | 'gold' | 'tan' | 'orange' | 'yellow' | 'purple'

export interface PluginToast {
  readonly title: string
  readonly detail?: string | undefined
  readonly color: PluginToastColor
}

export interface PluginNotifyPort {
  show(toast: PluginToast): void
}

export interface PluginHotkeyPort {
  getKey(): string | null
  setKey(key: string | null): void
}

export type PluginAutoCombatPort = PluginHotkeyPort

export type { AutoLootRules, AutoPotionThresholds, InventoryCareConfig, ItemInfoConfig, LootCategories, LootFilter }

export type { GuideMode }

export type { MenuLayout }

export interface PluginPathGuidePort {
  getMode(): GuideMode | null
  setMode(mode: GuideMode | null): void
}

export interface PluginItemInfoPort {
  getConfig(): ItemInfoConfig | null
  setConfig(config: ItemInfoConfig | null): void
}

export interface PluginAutoLootPort {
  getRules(): AutoLootRules | null
  setRules(rules: AutoLootRules | null): void
}

export interface PluginInventoryCarePort {
  getConfig(): InventoryCareConfig | null
  setConfig(config: InventoryCareConfig | null): void
}

export interface PluginAutoPotionPort {
  getThresholds(): AutoPotionThresholds | null
  setThresholds(thresholds: AutoPotionThresholds | null): void
}

const ACTIVE_STATUS: PluginStatus = { level: 'ok', text: { zh: '已开启', en: 'Active' } }
const INACTIVE_STATUS: PluginStatus = { level: 'warn', text: { zh: '未开启', en: 'Inactive' } }

export function createTogglePlugin({
  port,
  defaultEnabled = true,
  ...meta
}: Pick<D2WebPlugin, 'id' | 'name' | 'description' | 'author'> & { readonly port: (ctx: PluginContext) => PluginTogglePort; readonly defaultEnabled?: boolean }): D2WebPlugin {
  return {
    ...meta,
    defaultEnabled,
    activate: (ctx) => {
      port(ctx).setEnabled(true)
      return {
        getStatus: () => (port(ctx).isEnabled() ? ACTIVE_STATUS : INACTIVE_STATUS),
        deactivate: () => port(ctx).setEnabled(false),
      }
    },
  }
}

export interface ToolbarContributionPatch {
  readonly label?: LocalizedText | undefined
  readonly tooltip?: LocalizedText | undefined
  readonly iconSvg?: string | undefined
}

export const TOOLBAR_KILL_STATS_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M2.5 13.5L13 3M10 2.5h3.5V6M13.5 13.5L3 3M6 2.5H2.5V6"/></svg>'

export const TOOLBAR_DROP_TRACKER_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" focusable="false" aria-hidden="true"><path d="M8 1.5L13.5 7 8 14.5 2.5 7 8 1.5Z"/></svg>'

export const TOOLBAR_TRADE_HALL_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M2.5 5.5h11l-2.5-2.5M13.5 10.5h-11l2.5 2.5"/></svg>'

export interface ToolbarContributionHandle {
  (): void
  readonly dispose: () => void
  readonly update?: (patch: ToolbarContributionPatch) => void
}

export interface PluginToolbarContributionSpec {
  readonly id: string
  readonly slot?: 'left' | 'center' | 'right' | undefined
  readonly order?: number | undefined
  readonly kind?: 'link' | 'button' | undefined
  readonly label: LocalizedText
  readonly tooltip?: LocalizedText | undefined
  readonly iconSvg?: string | undefined
  readonly href?: string | undefined
  readonly onClick?: (() => void) | undefined
}

export interface PluginContext {
  readonly pluginId: string
  readonly session: PluginSessionView
  readonly settings: {
    get(key: string): boolean | string
    set(key: string, value: boolean | string): void
    subscribe(fn: (key: string) => void): () => void
  }
  readonly toolbar: {
    addLink(spec: {
      id: string
      label: LocalizedText
      tooltip?: LocalizedText | undefined
      iconSvg?: string | undefined
      href: string
    }): ToolbarContributionHandle
    addButton(spec: {
      id: string
      label: LocalizedText
      tooltip?: LocalizedText | undefined
      iconSvg?: string | undefined
      onClick(): void
    }): ToolbarContributionHandle
    addSelect(spec: PluginToolbarSelectSpec): ToolbarContributionHandle
    addContribution?(spec: PluginToolbarContributionSpec): ToolbarContributionHandle
  }
  readonly client: PluginClientCapabilities
  /**
   * NOT 1.13c: Quick Cast toggle port (Issue #952). Setting it claims the capability; the
   * host releases it automatically when the plugin deactivates (vanilla behavior restored).
   */
  readonly quickCast: PluginQuickCastPort
  readonly dragInteract: PluginTogglePort
  readonly stashDepositAll: PluginTogglePort
  readonly xpBar: PluginTogglePort
  readonly autoGoldPickup: PluginTogglePort
  readonly beltRefill: PluginTogglePort
  readonly upgradeHints: PluginTogglePort
  readonly monsterResists: PluginTogglePort
  readonly lowLifeWarning: PluginTogglePort
  readonly smartSkills: PluginTogglePort
  readonly spendPoints: PluginTogglePort
  readonly notify: PluginNotifyPort
  readonly itemInfo: PluginItemInfoPort
  readonly pathGuide: PluginPathGuidePort
  readonly autoCombat: PluginAutoCombatPort
  readonly townPortal: PluginHotkeyPort
  readonly autopilot: PluginHotkeyPort
  readonly autoPotion: PluginAutoPotionPort
  readonly autoLoot: PluginAutoLootPort
  readonly inventoryCare: PluginInventoryCarePort
  readonly lang: {
    get(): GameLang
    subscribe(fn: (lang: GameLang) => void): () => void
    onChange?(fn: (lang: GameLang) => void): () => void
  }
  readonly log: PluginLogger
  notifyStatusChanged(): void
}

export interface PluginPageContext {
  readonly pluginId: string
  getLang(): GameLang
  setLang(lang: GameLang): void
  subscribeLang(fn: (lang: GameLang) => void): () => void
  isEnabled(): boolean
  subscribeEnabled(fn: (enabled: boolean) => void): () => void
  getSetting(key: string): boolean | string
  setSetting(key: string, value: boolean | string): void
  subscribeSettings(fn: (key: string) => void): () => void
  destroy(): void
}

const KEBAB_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function resolveLocalizedText(text: LocalizedText, lang: GameLang): string {
  return lang === 'en' ? text.en : text.zh
}

export function isValidLocalizedText(value: unknown): value is LocalizedText {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { zh?: unknown; en?: unknown }
  return (
    typeof candidate.zh === 'string' &&
    candidate.zh.trim().length > 0 &&
    typeof candidate.en === 'string' &&
    candidate.en.trim().length > 0
  )
}

export type PluginI18nDictionary<K extends string = string> = Readonly<
  Record<K, LocalizedText>
>

export type PluginI18nParams = Readonly<Record<string, string | number>>

const CJK_CHAR_RE = /[\u4e00-\u9fff]/

export function containsCjkCharacters(text: string): boolean {
  return CJK_CHAR_RE.test(text)
}

export function validatePluginI18nDictionary<K extends string>(
  pluginId: string,
  dict: PluginI18nDictionary<K>,
): void {
  if (!dict || typeof dict !== 'object') {
    throw new Error(
      `[PluginHost] Plugin "${pluginId}" i18n dictionary must be a non-null object`,
    )
  }
  const keys = Object.keys(dict) as K[]
  if (keys.length === 0) {
    throw new Error(
      `[PluginHost] Plugin "${pluginId}" i18n dictionary must contain at least one key`,
    )
  }
  for (const key of keys) {
    const entry = dict[key]
    if (!isValidLocalizedText(entry)) {
      throw new Error(
        `[PluginHost] Plugin "${pluginId}" i18n key "${key}" must provide non-empty zh and en strings`,
      )
    }
    if (containsCjkCharacters(entry.en)) {
      throw new Error(
        `[PluginHost] Plugin "${pluginId}" i18n key "${key}" has CJK characters in en translation: "${entry.en}"`,
      )
    }
  }
}

export function formatLocalizedTemplate(
  template: string,
  params?: PluginI18nParams,
): string {
  if (!params) return template
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, token: string) => {
    if (Object.prototype.hasOwnProperty.call(params, token)) {
      return String(params[token])
    }
    return match
  })
}

export function createPluginI18n<K extends string>(
  pluginId: string,
  dict: PluginI18nDictionary<K>,
): (key: K, lang: GameLang, params?: PluginI18nParams) => string {
  validatePluginI18nDictionary(pluginId, dict)
  return (key: K, lang: GameLang, params?: PluginI18nParams): string => {
    const entry = dict[key]
    if (!entry) {
      throw new Error(`[PluginHost] Unknown i18n key "${String(key)}" in plugin "${pluginId}"`)
    }
    const raw = resolveLocalizedText(entry, lang)
    return formatLocalizedTemplate(raw, params)
  }
}

/**
 * Only relative paths inside the application are permitted for plugin link actions
 * and toolbar links. External schemes (`http:`, `https:`, `javascript:`, `data:`),
 * protocol-relative URLs (`//`), and root-absolute paths (`/`) are rejected.
 */
export function isRelativePluginHref(href: string): boolean {
  if (typeof href !== 'string') return false
  const trimmed = href.trim()
  if (trimmed.length === 0) return false
  if (trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('\\')) {
    return false
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false
  }
  return true
}

export function isValidPluginSettingValue(
  spec: PluginSettingSpec,
  value: unknown,
): value is boolean | string {
  if (spec.kind === 'boolean') {
    return typeof value === 'boolean'
  }
  if (spec.kind === 'select') {
    return (
      typeof value === 'string' &&
      spec.options.some((opt) => opt.value === value)
    )
  }
  return false
}

export function validatePluginDefinition(plugin: D2WebPlugin): void {
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('[PluginHost] Invalid plugin definition: expected object')
  }
  if (typeof plugin.id !== 'string' || !KEBAB_ID_RE.test(plugin.id)) {
    throw new Error(
      `[PluginHost] Invalid plugin id "${String(plugin.id)}": must be non-empty kebab-case`,
    )
  }
  if (!isValidLocalizedText(plugin.name)) {
    throw new Error(
      `[PluginHost] Plugin "${plugin.id}" must provide non-empty localized name (zh & en)`,
    )
  }
  if (!isValidLocalizedText(plugin.description)) {
    throw new Error(
      `[PluginHost] Plugin "${plugin.id}" must provide non-empty localized description (zh & en)`,
    )
  }
  if (typeof plugin.defaultEnabled !== 'boolean') {
    throw new Error(
      `[PluginHost] Plugin "${plugin.id}" defaultEnabled must be a boolean`,
    )
  }
  if (typeof plugin.activate !== 'function') {
    throw new Error(
      `[PluginHost] Plugin "${plugin.id}" must implement activate(ctx)`,
    )
  }

  if (plugin.settings !== undefined) {
    if (!Array.isArray(plugin.settings)) {
      throw new Error(
        `[PluginHost] Plugin "${plugin.id}" settings must be an array`,
      )
    }
    const seenKeys = new Set<string>()
    for (const spec of plugin.settings) {
      if (!spec || typeof spec !== 'object') {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" has an invalid setting descriptor`,
        )
      }
      if (typeof spec.key !== 'string' || spec.key.trim().length === 0) {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" has a setting with an empty key`,
        )
      }
      if (seenKeys.has(spec.key)) {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" has duplicate setting key "${spec.key}"`,
        )
      }
      seenKeys.add(spec.key)
      if (!isValidLocalizedText(spec.label)) {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" setting "${spec.key}" must have non-empty localized label`,
        )
      }
      if (spec.kind === 'boolean') {
        if (typeof spec.default !== 'boolean') {
          throw new Error(
            `[PluginHost] Plugin "${plugin.id}" boolean setting "${spec.key}" must have boolean default`,
          )
        }
      } else if (spec.kind === 'select') {
        if (!Array.isArray(spec.options) || spec.options.length === 0) {
          throw new Error(
            `[PluginHost] Plugin "${plugin.id}" select setting "${spec.key}" must have non-empty options`,
          )
        }
        const optionValues = new Set<string>()
        for (const opt of spec.options) {
          if (!opt || typeof opt.value !== 'string' || opt.value.trim().length === 0) {
            throw new Error(
              `[PluginHost] Plugin "${plugin.id}" select setting "${spec.key}" has an option with empty value`,
            )
          }
          if (optionValues.has(opt.value)) {
            throw new Error(
              `[PluginHost] Plugin "${plugin.id}" select setting "${spec.key}" has duplicate option "${opt.value}"`,
            )
          }
          optionValues.add(opt.value)
          if (!isValidLocalizedText(opt.label)) {
            throw new Error(
              `[PluginHost] Plugin "${plugin.id}" select setting "${spec.key}" option "${opt.value}" must have localized label`,
            )
          }
        }
        if (typeof spec.default !== 'string' || !optionValues.has(spec.default)) {
          throw new Error(
            `[PluginHost] Plugin "${plugin.id}" select setting "${spec.key}" default "${String(spec.default)}" is not in options`,
          )
        }
      } else {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" setting "${(spec as { key?: string }).key ?? ''}" has unsupported kind`,
        )
      }
    }
    const keys = new Set(plugin.settings.map((spec) => spec.key))
    const dangling = plugin.settings.flatMap((spec) => (spec.shownWhen ?? []).filter(({ key }: PluginSettingCondition) => !keys.has(key) || key === spec.key).map(({ key }: PluginSettingCondition) => `${spec.key} → ${key}`))
    if (dangling.length > 0) throw new Error(`[PluginHost] Plugin "${plugin.id}" shows settings based on unknown settings: ${dangling.join(', ')}`)
  }

  if (plugin.actions !== undefined) {
    if (!Array.isArray(plugin.actions)) {
      throw new Error(
        `[PluginHost] Plugin "${plugin.id}" actions must be an array`,
      )
    }
    const seenIds = new Set<string>()
    for (const action of plugin.actions) {
      if (!action || typeof action !== 'object') {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" has an invalid action descriptor`,
        )
      }
      if (typeof action.id !== 'string' || !KEBAB_ID_RE.test(action.id)) {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" action id "${String(action.id)}" must be non-empty kebab-case`,
        )
      }
      if (seenIds.has(action.id)) {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" has duplicate action id "${action.id}"`,
        )
      }
      seenIds.add(action.id)
      if (!isValidLocalizedText(action.label)) {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" action "${action.id}" must have non-empty localized label`,
        )
      }
      if (action.kind === 'link') {
        if (!isRelativePluginHref(action.href)) {
          throw new Error(
            `[PluginHost] Plugin "${plugin.id}" link action "${action.id}" href "${String(action.href)}" must be a relative path`,
          )
        }
      } else if (action.kind === 'button') {
        if (typeof action.run !== 'function') {
          throw new Error(
            `[PluginHost] Plugin "${plugin.id}" button action "${action.id}" must provide a run(ctx) function`,
          )
        }
      } else {
        throw new Error(
          `[PluginHost] Plugin "${plugin.id}" action "${(action as { id?: string }).id ?? ''}" has unsupported kind`,
        )
      }
    }
  }
}

export function validatePluginRegistry(plugins: readonly D2WebPlugin[]): void {
  if (!Array.isArray(plugins)) {
    throw new Error('[PluginHost] Plugin registry must be an array')
  }
  const seenIds = new Set<string>()
  for (const plugin of plugins) {
    validatePluginDefinition(plugin)
    if (seenIds.has(plugin.id)) {
      throw new Error(`[PluginHost] Duplicate plugin id "${plugin.id}" in registry`)
    }
    seenIds.add(plugin.id)
  }
}

function syncPluginDocumentLocale(plugin: D2WebPlugin, lang: GameLang): void {
  if (typeof document === 'undefined' || !document) return
  const htmlLang = lang === 'en' ? 'en' : 'zh-CN'
  if (document.documentElement) {
    document.documentElement.lang = htmlLang
    if (typeof document.documentElement.setAttribute === 'function') {
      document.documentElement.setAttribute('lang', htmlLang)
    }
  }
  document.title = `${resolveLocalizedText(plugin.name, lang)} — Diablo II Web`
}

/**
 * Bootstrap context for a standalone plugin page (e.g. `/plugins/<id>/index.html`).
 * - Resolves language using URL `?lang=` > stored `d2web.settings.v1` > `<html lang>`
 * - Synchronizes `<html lang>` and `document.title` with the plugin's localized name
 * - Synchronizes global language and plugin enabled/settings state across tabs via `storage` events
 */
export function bootPluginPage(plugin: D2WebPlugin): PluginPageContext {
  validatePluginDefinition(plugin)

  initLangFromBrowser({ preferStoredSetting: true })
  const settingsStore = getGlobalSettingsStore()
  settingsStore.reload()
  const currentLang = getGameLang()
  if (settingsStore.get().lang !== currentLang) {
    settingsStore.set({ lang: currentLang })
  }
  syncPluginDocumentLocale(plugin, currentLang)
  const unsubDocLang = onLangChange((nextLang) => {
    syncPluginDocumentLocale(plugin, nextLang)
  })

  const configStore = new PluginConfigStore([plugin])
  configStore.attachStorageListener()

  const enabledListeners = new Set<(enabled: boolean) => void>()
  const settingListeners = new Set<(key: string) => void>()

  const unsubConfig = configStore.subscribe((change) => {
    if (change.pluginId !== null && change.pluginId !== plugin.id) return
    if (change.kind === 'enabled' || change.kind === 'reload' || change.kind === 'reset') {
      const enabled = configStore.isEnabled(plugin.id)
      for (const fn of [...enabledListeners]) {
        fn(enabled)
      }
    }
    if (change.kind === 'setting' && change.settingKey) {
      for (const fn of [...settingListeners]) {
        fn(change.settingKey)
      }
    } else if (change.kind === 'reload' || change.kind === 'reset') {
      for (const spec of plugin.settings ?? []) {
        for (const fn of [...settingListeners]) {
          fn(spec.key)
        }
      }
    }
  })

  const onWindowStorage = (ev: StorageEvent): void => {
    if (ev.key === 'd2web.settings.v1' || ev.key === null) {
      const reloaded = settingsStore.reload()
      if (getGameLang() !== reloaded.lang) {
        setLang(reloaded.lang)
      }
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', onWindowStorage)
  }

  return {
    pluginId: plugin.id,
    getLang(): GameLang {
      return getGameLang()
    },
    setLang(lang: GameLang): void {
      settingsStore.set({ lang })
      setLang(lang)
    },
    subscribeLang(fn: (lang: GameLang) => void): () => void {
      return onLangChange(fn)
    },
    isEnabled(): boolean {
      return configStore.isEnabled(plugin.id)
    },
    subscribeEnabled(fn: (enabled: boolean) => void): () => void {
      enabledListeners.add(fn)
      return () => {
        enabledListeners.delete(fn)
      }
    },
    getSetting(key: string): boolean | string {
      return configStore.getSetting(plugin.id, key)
    },
    setSetting(key: string, value: boolean | string): void {
      configStore.setSetting(plugin.id, key, value)
    },
    subscribeSettings(fn: (key: string) => void): () => void {
      settingListeners.add(fn)
      return () => {
        settingListeners.delete(fn)
      }
    },
    destroy(): void {
      unsubDocLang()
      unsubConfig()
      configStore.detachStorageListener()
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('storage', onWindowStorage)
      }
      enabledListeners.clear()
      settingListeners.clear()
    },
  }
}
