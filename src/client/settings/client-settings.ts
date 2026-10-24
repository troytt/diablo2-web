import { detectInitialLang, type GameLang } from '../i18n/lang.ts'
import { Sgd2FreeResPresentation } from '../../common/ui/pd2-sgd2freeres.ts'
import {
  createDefaultKeyBindings,
  DEFAULT_KEY_BINDINGS,
  sanitizeKeyBindings,
  type ControlActionId,
  type KeyBindingsConfig,
  type KeyBindingSlot,
} from './key-bindings.ts'

export {
  assignKeyBinding,
  clearKeyBindingSlot,
  cloneKeyBindings,
  CONTROL_ACTION_DEFINITIONS,
  CONTROL_ACTION_IDS,
  createDefaultKeyBindings,
  DEFAULT_KEY_BINDINGS,
  formatKeyBindingCode,
  matchesKeyBinding,
  normalizeKeyEventToBindingCode,
  sanitizeKeyBindings,
  type ControlActionDefinition,
  type ControlActionId,
  type KeyBindingsConfig,
  type KeyBindingSlot,
} from './key-bindings.ts'

export const SETTINGS_STORAGE_KEY = 'd2web.settings.v1'
export const DEFAULT_SERVER_HOST = 'www.laiseek.xyz'

export type ClientLightingPreset =
  | 'auto'
  | 'noon'
  | 'dusk'
  | 'night'
  | 'torch'
  | 'cold'
  | 'fullbright'

export type AutomapRevealMode = 'off' | 'level' | 'act'
/**
 * The in-game resolutions of PD2's `SGD2FreeResolution.json` (`pd2-sgd2freeres.ts`); `1280x960` and
 * `1424x800` exist only there. All of them are valid settings ({@link VALID_VIEWPORT_RESOLUTIONS}).
 */
export type ViewportResolution =
  | '640x480'
  | '800x600'
  | '1024x768'
  | '1068x600'
  | '1280x720'
  | '1280x960'
  | '1424x800'
/**
 * NOT 1.13c: forced precipitation set by the `weather-override` plugin. `'off'` is the vanilla
 * 1.13c weather; the host reverts to it when no plugin claims the setting.
 */
export type WeatherOverrideSetting = 'off' | 'rain' | 'snow'
/**
 * The 1.13c "Light Quality" video option (D2Client registry value at 0x6fb851f8): 0 low, 1 medium, 2 high. It caps
 * the light grid mode (0x6fb58800) and gates missile lights (0x6fb63647). Issue #830; default high (SPEC §11 Q7).
 */
export type LightQualitySetting = 0 | 1 | 2
export type HudLayoutMode = 'auto' | 'classic' | 'compact-d2r'
export type SkillWheelBankMode = 'toggle' | 'hold'
export type MultiboxAudioFocusPolicy = 'focus-only' | 'all'

export interface HudEnhancementsConfig {
  readonly showBasePlusBonusStats: boolean
  readonly showBasePlusBonusSkills: boolean
  readonly showStatGainTooltips: boolean
  readonly showWeaponDamageFormula: boolean
  readonly showAdvancedStatsButton: boolean
  readonly showRuneNumbers: boolean
}

export interface AutomapRadarConfig {
  readonly automapShowMonsters: boolean
  readonly automapShowShrines: boolean
  readonly automapShowWaypoints?: boolean
}

export interface GroundItemEnhancementsConfig {
  readonly showUniqueSetBeams: boolean
  readonly alwaysShowUniqueSetLabels: boolean
}

export interface ClientSettings
  extends HudEnhancementsConfig,
    AutomapRadarConfig,
    GroundItemEnhancementsConfig {
  readonly version: 1
  readonly serverHost: string // default: 'www.laiseek.xyz'
  readonly lang: 'zh' | 'en' // default: detected from URL/browser or 'zh'
  readonly lightingPreset: ClientLightingPreset
  readonly lightQuality: LightQualitySetting // default: 2
  readonly automapReveal: AutomapRevealMode
  readonly automapShowWaypoints: boolean
  readonly viewport: ViewportResolution
  /** In-game world render-rate cap: 60 (uncapped, follows display refresh) or 30 (≈half the GPU raster, slightly steppier scrolling). */
  readonly worldRenderFps: 30 | 60
  readonly weatherOverride: WeatherOverrideSetting // default: 'off'
  readonly audioMuted: boolean // default: false
  readonly masterVolume: number // default: 0.8 (0..1)
  readonly alwaysShowStatRanges: boolean // default: true
  readonly showItemLevel: boolean // default: true
  readonly showSocketCount: boolean // default: true
  readonly showEtherealTag: boolean // default: true
  readonly extraItemContext: boolean // default: true
  readonly keyBindings: KeyBindingsConfig
  readonly hudLayoutMode?: HudLayoutMode | undefined
  readonly skillWheelBankMode?: SkillWheelBankMode | undefined
  readonly mobileAutoPickupGoldAndPotions?: boolean | undefined
  readonly mobileHapticsEnabled?: boolean | undefined
  /** Single-Tab multi-instance (multibox) architecture (#1362): disabled by default, manually enabled in config. */
  readonly multiboxEnabled?: boolean | undefined
  /** Audio focus policy across multibox instances (#1363): 'focus-only' (default) or 'all'. */
  readonly multiboxAudioFocusPolicy?: MultiboxAudioFocusPolicy | undefined
  /** Whether background survival alert sounds are enabled when non-focused instances take damage (#1363). */
  readonly multiboxAlertSoundEnabled?: boolean | undefined
}

export const VALID_LIGHTING_PRESETS: readonly ClientLightingPreset[] = [
  'auto',
  'noon',
  'dusk',
  'night',
  'torch',
  'cold',
  'fullbright',
] as const

export const VALID_AUTOMAP_REVEAL_MODES: readonly AutomapRevealMode[] = [
  'off',
  'level',
  'act',
] as const

/** Every settable viewport: PD2 `SGD2FreeResolution.json` `Ingame Resolutions`, in file order. */
export const VALID_VIEWPORT_RESOLUTIONS: readonly ViewportResolution[] = [
  '640x480',
  '800x600',
  '1024x768',
  '1068x600',
  '1280x720',
  '1280x960',
  '1424x800',
] as const

function requireViewportResolution(id: string, where: string): ViewportResolution {
  if (!(VALID_VIEWPORT_RESOLUTIONS as readonly string[]).includes(id)) {
    throw new Error(`${where}: ${id} is not a registered viewport resolution`)
  }
  return id as ViewportResolution
}

/**
 * The client's default viewport: the PD2 SGD2FreeRes default (`Ingame Resolution Mode` 3 -> `1068x600`).
 * D2 1.13c's `800x600` is {@link defaultViewportResolution}('113c') and is never picked implicitly.
 */
export const DEFAULT_VIEWPORT_RESOLUTION: ViewportResolution = requireViewportResolution(
  new Sgd2FreeResPresentation().defaultResolutionId(),
  'SGD2FreeRes default resolution',
)

/** Default viewport for a data mode; `'113c'` must be asked for explicitly. */
export function defaultViewportResolution(mode: 'pd2' | '113c' = 'pd2'): ViewportResolution {
  return requireViewportResolution(
    new Sgd2FreeResPresentation(undefined, mode).defaultResolutionId(),
    `${mode} default resolution`,
  )
}

export const VALID_WEATHER_OVERRIDES: readonly WeatherOverrideSetting[] = ['off', 'rain', 'snow'] as const

export const DEFAULT_LIGHT_QUALITY: LightQualitySetting = 2
export const DEFAULT_AUDIO_MUTED = false
export const DEFAULT_MASTER_VOLUME = 0.8
export const DEFAULT_MULTIBOX_ENABLED = false
export const DEFAULT_MULTIBOX_AUDIO_FOCUS_POLICY: MultiboxAudioFocusPolicy = 'focus-only'
export const DEFAULT_MULTIBOX_ALERT_SOUND_ENABLED = true

export function createDefaultClientSettings(defaultLang?: GameLang): ClientSettings {
  return {
    version: 1,
    serverHost: DEFAULT_SERVER_HOST,
    lang: defaultLang ?? detectInitialLang(),
    lightingPreset: 'auto',
    lightQuality: DEFAULT_LIGHT_QUALITY,
    automapReveal: 'off',
    automapShowMonsters: false,
    automapShowShrines: false,
    automapShowWaypoints: false,
    viewport: DEFAULT_VIEWPORT_RESOLUTION,
    worldRenderFps: 60,
    showBasePlusBonusStats: false,
    showBasePlusBonusSkills: false,
    showStatGainTooltips: false,
    showWeaponDamageFormula: false,
    showAdvancedStatsButton: false,
    showUniqueSetBeams: false,
    alwaysShowUniqueSetLabels: false,
    weatherOverride: 'off',
    audioMuted: DEFAULT_AUDIO_MUTED,
    masterVolume: DEFAULT_MASTER_VOLUME,
    alwaysShowStatRanges: true,
    showItemLevel: true,
    showSocketCount: true,
    showEtherealTag: true,
    showRuneNumbers: false,
    extraItemContext: true,
    keyBindings: createDefaultKeyBindings(),
    multiboxEnabled: DEFAULT_MULTIBOX_ENABLED,
    multiboxAudioFocusPolicy: DEFAULT_MULTIBOX_AUDIO_FOCUS_POLICY,
    multiboxAlertSoundEnabled: DEFAULT_MULTIBOX_ALERT_SOUND_ENABLED,
  }
}

export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  version: 1,
  serverHost: DEFAULT_SERVER_HOST,
  lang: 'zh',
  lightingPreset: 'auto',
  lightQuality: DEFAULT_LIGHT_QUALITY,
  automapReveal: 'off',
  automapShowMonsters: false,
  automapShowShrines: false,
  automapShowWaypoints: false,
  viewport: DEFAULT_VIEWPORT_RESOLUTION,
  worldRenderFps: 60,
  showBasePlusBonusStats: false,
  showBasePlusBonusSkills: false,
  showStatGainTooltips: false,
  showWeaponDamageFormula: false,
  showAdvancedStatsButton: false,
  showUniqueSetBeams: false,
  alwaysShowUniqueSetLabels: false,
  weatherOverride: 'off',
  audioMuted: DEFAULT_AUDIO_MUTED,
  masterVolume: DEFAULT_MASTER_VOLUME,
  alwaysShowStatRanges: true,
  showItemLevel: true,
  showSocketCount: true,
  showEtherealTag: true,
  showRuneNumbers: false,
  extraItemContext: true,
  keyBindings: DEFAULT_KEY_BINDINGS,
  multiboxEnabled: DEFAULT_MULTIBOX_ENABLED,
  multiboxAudioFocusPolicy: DEFAULT_MULTIBOX_AUDIO_FOCUS_POLICY,
  multiboxAlertSoundEnabled: DEFAULT_MULTIBOX_ALERT_SOUND_ENABLED,
}

export type ServerHostValidationErrorReason =
  | 'empty'
  | 'bare_ip_on_https'
  | 'invalid_format'
  | 'invalid_port'

export interface ServerHostValidationResult {
  readonly valid: boolean
  readonly normalizedHost: string
  readonly reason?: ServerHostValidationErrorReason | undefined
  readonly errorMessage?: string | undefined
  readonly errorMessageZh?: string | undefined
}

const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const HOSTNAME_LABEL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

export function isBareIpv4(hostWithoutPort: string): boolean {
  const m = IPV4_REGEX.exec(hostWithoutPort)
  if (!m) return false
  for (let i = 1; i <= 4; i++) {
    const octet = Number(m[i])
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return false
    }
  }
  return true
}

export function isBareIpv6(hostWithoutPort: string): boolean {
  const unwrapped =
    hostWithoutPort.startsWith('[') && hostWithoutPort.endsWith(']')
      ? hostWithoutPort.slice(1, -1)
      : hostWithoutPort
  if (!unwrapped.includes(':')) return false
  return /^[0-9a-fA-F:]+$/.test(unwrapped)
}

export function isBareIpAddress(hostWithoutPort: string): boolean {
  return isBareIpv4(hostWithoutPort) || isBareIpv6(hostWithoutPort)
}

/**
 * Validate and normalize a user-supplied `serverHost` value.
 * Rejects bare IPv4/IPv6 addresses when the page is served over `https:` because
 * `wss://<ip>/ws/*` fails browser TLS certificate SAN verification.
 */
export function validateServerHost(
  rawHost: string,
  pageProtocol: string = typeof window !== 'undefined' && window.location
    ? window.location.protocol
    : 'https:',
): ServerHostValidationResult {
  if (typeof rawHost !== 'string') {
    return {
      valid: false,
      normalizedHost: '',
      reason: 'empty',
      errorMessage: 'Server host must not be empty.',
      errorMessageZh: '服务器地址不能为空。',
    }
  }

  let cleaned = rawHost.trim()
  if (cleaned === '') {
    return {
      valid: false,
      normalizedHost: '',
      reason: 'empty',
      errorMessage: 'Server host must not be empty.',
      errorMessageZh: '服务器地址不能为空。',
    }
  }

  // Strip optional scheme prefix if user pasted full URL
  cleaned = cleaned.replace(/^(?:wss?|https?):\/\//i, '')
  // Strip any path/query/hash suffix
  const slashIdx = cleaned.search(/[/?#]/)
  if (slashIdx >= 0) {
    cleaned = cleaned.slice(0, slashIdx)
  }
  cleaned = cleaned.trim()

  if (cleaned === '' || /\s/.test(cleaned)) {
    return {
      valid: false,
      normalizedHost: '',
      reason: 'invalid_format',
      errorMessage: 'Invalid server hostname format.',
      errorMessageZh: '服务器域名格式无效。',
    }
  }

  let hostPart = cleaned
  let portPart: string | undefined

  if (cleaned.startsWith('[')) {
    const closeBracket = cleaned.indexOf(']')
    if (closeBracket < 0) {
      return {
        valid: false,
        normalizedHost: '',
        reason: 'invalid_format',
        errorMessage: 'Invalid IPv6 bracket syntax.',
        errorMessageZh: 'IPv6 地址括号格式无效。',
      }
    }
    hostPart = cleaned.slice(0, closeBracket + 1)
    const rest = cleaned.slice(closeBracket + 1)
    if (rest.startsWith(':')) {
      portPart = rest.slice(1)
    } else if (rest !== '') {
      return {
        valid: false,
        normalizedHost: '',
        reason: 'invalid_format',
        errorMessage: 'Unexpected characters after IPv6 address.',
        errorMessageZh: 'IPv6 地址后包含无效字符。',
      }
    }
  } else {
    const firstColon = cleaned.indexOf(':')
    const lastColon = cleaned.lastIndexOf(':')
    if (firstColon !== -1 && firstColon === lastColon) {
      hostPart = cleaned.slice(0, firstColon)
      portPart = cleaned.slice(firstColon + 1)
    } else if (firstColon !== lastColon) {
      // Unbracketed IPv6 literal
      hostPart = cleaned
    }
  }

  if (portPart !== undefined) {
    if (!/^\d+$/.test(portPart)) {
      return {
        valid: false,
        normalizedHost: '',
        reason: 'invalid_port',
        errorMessage: `Invalid port "${portPart}": must be an integer between 1 and 65535.`,
        errorMessageZh: `端口 "${portPart}" 无效：必须为 1 到 65535 之间的整数。`,
      }
    }
    const portNum = Number(portPart)
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return {
        valid: false,
        normalizedHost: '',
        reason: 'invalid_port',
        errorMessage: `Port ${portPart} is out of range (1..65535).`,
        errorMessageZh: `端口 ${portPart} 超出有效范围 (1..65535)。`,
      }
    }
  }

  const isIp = isBareIpAddress(hostPart)
  const normProto = (pageProtocol || 'https:').trim().toLowerCase()
  const isHttps = normProto === 'https:' || normProto === 'https' || normProto === 'wss:' || normProto === 'wss'

  if (isIp && isHttps) {
    return {
      valid: false,
      normalizedHost: '',
      reason: 'bare_ip_on_https',
      errorMessage:
        `Cannot connect to bare IP "${hostPart}" from an HTTPS page: WSS TLS requires a domain name with a valid certificate (use "${DEFAULT_SERVER_HOST}").`,
      errorMessageZh:
        `HTTPS 页面下无法对裸 IP "${hostPart}" 发起安全 WSS 连接：TLS 证书校验要求使用有效域名（请使用 "${DEFAULT_SERVER_HOST}"）。`,
    }
  }

  if (!isIp) {
    const labels = hostPart.split('.')
    if (labels.some((label) => label.length === 0 || !HOSTNAME_LABEL_REGEX.test(label))) {
      return {
        valid: false,
        normalizedHost: '',
        reason: 'invalid_format',
        errorMessage: `Invalid hostname "${hostPart}". Expected a valid domain such as ${DEFAULT_SERVER_HOST}.`,
        errorMessageZh: `域名 "${hostPart}" 格式无效，请输入有效域名（如 ${DEFAULT_SERVER_HOST}）。`,
      }
    }
  }

  const normalizedHostPart = hostPart.toLowerCase()
  const normalizedHost =
    portPart !== undefined ? `${normalizedHostPart}:${portPart}` : normalizedHostPart

  return {
    valid: true,
    normalizedHost,
  }
}

export function normalizeClientLightingPreset(value: unknown): ClientLightingPreset {
  if (typeof value !== 'string') return 'auto'
  const clean = value.trim().toLowerCase()
  if ((VALID_LIGHTING_PRESETS as readonly string[]).includes(clean)) {
    return clean as ClientLightingPreset
  }
  if (clean === 'sunset' || clean === 'morning') return 'dusk'
  if (clean === 'cave' || clean === 'hell') return 'torch'
  if (clean === 'eclipse') return 'cold'
  if (clean === 'off' || clean === 'none' || clean === 'false' || clean === '0') return 'fullbright'
  return 'auto'
}

export function normalizeAutomapReveal(value: unknown): AutomapRevealMode {
  if (typeof value !== 'string') return 'off'
  const clean = value.trim().toLowerCase()
  if ((VALID_AUTOMAP_REVEAL_MODES as readonly string[]).includes(clean)) {
    return clean as AutomapRevealMode
  }
  return 'off'
}

/** Anything that is not a registered id falls back to the PD2 default {@link DEFAULT_VIEWPORT_RESOLUTION}. */
export function normalizeViewportResolution(value: unknown): ViewportResolution {
  if (typeof value !== 'string') return DEFAULT_VIEWPORT_RESOLUTION
  const clean = value.trim().toLowerCase()
  for (const id of VALID_VIEWPORT_RESOLUTIONS) {
    if (clean === id) return id
  }
  // Bare width shorthand (`'1068'`), only for widths registered once (`'1280'` is 1280x720 and 1280x960).
  const byWidth = VALID_VIEWPORT_RESOLUTIONS.filter((id) => clean === id.slice(0, id.indexOf('x')))
  if (byWidth.length === 1) return byWidth[0]!
  return DEFAULT_VIEWPORT_RESOLUTION
}

/** Anything but a known override id is the vanilla 1.13c weather (`'off'`). */
export function normalizeWeatherOverride(value: unknown): WeatherOverrideSetting {
  if (typeof value !== 'string') return 'off'
  const clean = value.trim().toLowerCase()
  if ((VALID_WEATHER_OVERRIDES as readonly string[]).includes(clean)) {
    return clean as WeatherOverrideSetting
  }
  return 'off'
}

/** The stored Light Quality: 0, 1 or 2 (numbers or their decimal strings); anything else is the default. */
export function normalizeLightQuality(value: unknown, fallback: LightQualitySetting = DEFAULT_LIGHT_QUALITY): LightQualitySetting {
  const n = typeof value === 'string' && /^\s*[012]\s*$/.test(value) ? Number(value) : value
  return n === 0 || n === 1 || n === 2 ? n : fallback
}

/**
 * Sanitize an arbitrary input value into a strictly valid `ClientSettings` object.
 * Never throws; strips unknown fields and replaces corrupt fields with defaults.
 */
export function sanitizeClientSettings(
  raw: unknown,
  options?: {
    readonly defaultLang?: GameLang | undefined
    readonly pageProtocol?: string | undefined
  },
): ClientSettings {
  const defaults = createDefaultClientSettings(options?.defaultLang)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return defaults
  }

  const rec = raw as Record<string, unknown>

  let serverHost = defaults.serverHost
  if (typeof rec.serverHost === 'string') {
    const check = validateServerHost(rec.serverHost, options?.pageProtocol ?? 'https:')
    if (check.valid && check.normalizedHost !== 'wzsc.hbscit.com') {
      serverHost = check.normalizedHost
    }
  }

  let lang: GameLang = defaults.lang
  if (rec.lang === 'en' || rec.lang === 'zh') {
    lang = rec.lang
  } else if (typeof rec.lang === 'string') {
    const norm = rec.lang.trim().toLowerCase()
    if (norm === 'eng' || norm === 'english') lang = 'en'
    else if (norm === 'chi' || norm === 'zh-cn' || norm === 'cn') lang = 'zh'
  }

  const lightingPreset =
    rec.lightingPreset !== undefined
      ? normalizeClientLightingPreset(rec.lightingPreset)
      : defaults.lightingPreset

  const lightQuality = normalizeLightQuality(rec.lightQuality, defaults.lightQuality)

  const automapReveal =
    rec.automapReveal !== undefined
      ? normalizeAutomapReveal(rec.automapReveal)
      : defaults.automapReveal

  const automapShowMonsters =
    typeof rec.automapShowMonsters === 'boolean'
      ? rec.automapShowMonsters
      : defaults.automapShowMonsters

  const automapShowShrines =
    typeof rec.automapShowShrines === 'boolean'
      ? rec.automapShowShrines
      : defaults.automapShowShrines

  const automapShowWaypoints =
    typeof rec.automapShowWaypoints === 'boolean'
      ? rec.automapShowWaypoints
      : defaults.automapShowWaypoints

  const viewport =
    rec.viewport !== undefined
      ? normalizeViewportResolution(rec.viewport)
      : defaults.viewport

  const worldRenderFps: 30 | 60 =
    rec.worldRenderFps === 30 ? 30 : rec.worldRenderFps === 60 ? 60 : defaults.worldRenderFps

  const showBasePlusBonusStats =
    typeof rec.showBasePlusBonusStats === 'boolean'
      ? rec.showBasePlusBonusStats
      : defaults.showBasePlusBonusStats

  const showBasePlusBonusSkills =
    typeof rec.showBasePlusBonusSkills === 'boolean'
      ? rec.showBasePlusBonusSkills
      : defaults.showBasePlusBonusSkills

  const showStatGainTooltips =
    typeof rec.showStatGainTooltips === 'boolean'
      ? rec.showStatGainTooltips
      : defaults.showStatGainTooltips

  const showWeaponDamageFormula =
    typeof rec.showWeaponDamageFormula === 'boolean'
      ? rec.showWeaponDamageFormula
      : defaults.showWeaponDamageFormula

  const showAdvancedStatsButton =
    typeof rec.showAdvancedStatsButton === 'boolean'
      ? rec.showAdvancedStatsButton
      : defaults.showAdvancedStatsButton

  const showUniqueSetBeams =
    typeof rec.showUniqueSetBeams === 'boolean'
      ? rec.showUniqueSetBeams
      : defaults.showUniqueSetBeams

  const alwaysShowUniqueSetLabels =
    typeof rec.alwaysShowUniqueSetLabels === 'boolean'
      ? rec.alwaysShowUniqueSetLabels
      : defaults.alwaysShowUniqueSetLabels

  const weatherOverride =
    rec.weatherOverride !== undefined
      ? normalizeWeatherOverride(rec.weatherOverride)
      : defaults.weatherOverride

  const audioMuted =
    typeof rec.audioMuted === 'boolean' ? rec.audioMuted : defaults.audioMuted

  const masterVolume =
    typeof rec.masterVolume === 'number' && Number.isFinite(rec.masterVolume)
      ? Math.max(0, Math.min(1, rec.masterVolume))
      : defaults.masterVolume

  const alwaysShowStatRanges =
    typeof rec.alwaysShowStatRanges === 'boolean' ? rec.alwaysShowStatRanges : defaults.alwaysShowStatRanges
  const showItemLevel =
    typeof rec.showItemLevel === 'boolean' ? rec.showItemLevel : defaults.showItemLevel
  const showSocketCount =
    typeof rec.showSocketCount === 'boolean' ? rec.showSocketCount : defaults.showSocketCount
  const showEtherealTag =
    typeof rec.showEtherealTag === 'boolean' ? rec.showEtherealTag : defaults.showEtherealTag
  const showRuneNumbers =
    typeof rec.showRuneNumbers === 'boolean' ? rec.showRuneNumbers : defaults.showRuneNumbers
  const extraItemContext =
    typeof rec.extraItemContext === 'boolean' ? rec.extraItemContext : defaults.extraItemContext
  const keyBindings = sanitizeKeyBindings(rec.keyBindings)
  const hudLayoutMode: HudLayoutMode | undefined =
    rec.hudLayoutMode === 'auto' || rec.hudLayoutMode === 'classic' || rec.hudLayoutMode === 'compact-d2r'
      ? rec.hudLayoutMode
      : undefined
  const skillWheelBankMode: SkillWheelBankMode | undefined =
    rec.skillWheelBankMode === 'toggle' || rec.skillWheelBankMode === 'hold'
      ? rec.skillWheelBankMode
      : undefined
  const mobileAutoPickupGoldAndPotions: boolean | undefined =
    typeof rec.mobileAutoPickupGoldAndPotions === 'boolean'
      ? rec.mobileAutoPickupGoldAndPotions
      : undefined
  const mobileHapticsEnabled: boolean | undefined =
    typeof rec.mobileHapticsEnabled === 'boolean'
      ? rec.mobileHapticsEnabled
      : undefined
  const multiboxEnabled: boolean =
    typeof rec.multiboxEnabled === 'boolean' ? rec.multiboxEnabled : DEFAULT_MULTIBOX_ENABLED
  const multiboxAudioFocusPolicy: MultiboxAudioFocusPolicy =
    rec.multiboxAudioFocusPolicy === 'all' || rec.multiboxAudioFocusPolicy === 'focus-only'
      ? rec.multiboxAudioFocusPolicy
      : DEFAULT_MULTIBOX_AUDIO_FOCUS_POLICY
  const multiboxAlertSoundEnabled: boolean =
    typeof rec.multiboxAlertSoundEnabled === 'boolean'
      ? rec.multiboxAlertSoundEnabled
      : DEFAULT_MULTIBOX_ALERT_SOUND_ENABLED

  return {
    version: 1,
    serverHost,
    lang,
    lightingPreset,
    lightQuality,
    automapReveal,
    automapShowMonsters,
    automapShowShrines,
    automapShowWaypoints,
    viewport,
    worldRenderFps,
    showBasePlusBonusStats,
    showBasePlusBonusSkills,
    showStatGainTooltips,
    showWeaponDamageFormula,
    showAdvancedStatsButton,
    showUniqueSetBeams,
    alwaysShowUniqueSetLabels,
    weatherOverride,
    audioMuted,
    masterVolume,
    alwaysShowStatRanges,
    showItemLevel,
    showSocketCount,
    showEtherealTag,
    showRuneNumbers,
    extraItemContext,
    keyBindings,
    multiboxEnabled,
    multiboxAudioFocusPolicy,
    multiboxAlertSoundEnabled,
    ...(hudLayoutMode !== undefined ? { hudLayoutMode } : {}),
    ...(skillWheelBankMode !== undefined ? { skillWheelBankMode } : {}),
    ...(mobileAutoPickupGoldAndPotions !== undefined ? { mobileAutoPickupGoldAndPotions } : {}),
    ...(mobileHapticsEnabled !== undefined ? { mobileHapticsEnabled } : {}),
  }
}

export function parseClientSettingsJson(
  jsonStr: string | null | undefined,
  options?: {
    readonly defaultLang?: GameLang | undefined
    readonly pageProtocol?: string | undefined
  },
): ClientSettings {
  if (typeof jsonStr !== 'string' || jsonStr.trim() === '') {
    return createDefaultClientSettings(options?.defaultLang)
  }
  try {
    const parsed: unknown = JSON.parse(jsonStr)
    return sanitizeClientSettings(parsed, options)
  } catch {
    return createDefaultClientSettings(options?.defaultLang)
  }
}

export interface RealmWsEndpoints {
  readonly bncsUrl: string
  readonly mcpUrl: string
  readonly d2gsUrl: string
}
