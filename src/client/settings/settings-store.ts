import { setLang, type GameLang } from '../i18n/lang.ts'
import {
  createDefaultClientSettings,
  parseClientSettingsJson,
  sanitizeClientSettings,
  SETTINGS_STORAGE_KEY,
  validateServerHost,
  type ClientSettings,
  type ServerHostValidationResult,
} from './client-settings.ts'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export type SettingsKey = keyof Omit<ClientSettings, 'version'>

export type SettingsChangeListener = (
  settings: ClientSettings,
  prev: ClientSettings,
  changedKeys: readonly SettingsKey[],
) => void

export interface SettingsStoreOptions {
  readonly storage?: StorageLike | null | undefined
  readonly storageKey?: string | undefined
  readonly defaultLang?: GameLang | undefined
  readonly pageProtocol?: string | undefined
  readonly syncGlobalLang?: boolean | undefined
}

const COMPARE_KEYS: readonly SettingsKey[] = [
  'serverHost',
  'lang',
  'lightingPreset',
  'lightQuality',
  'automapReveal',
  'automapShowMonsters',
  'automapShowShrines',
  'automapShowWaypoints',
  'viewport',
  'worldRenderFps',
  'showBasePlusBonusStats',
  'showBasePlusBonusSkills',
  'showStatGainTooltips',
  'showWeaponDamageFormula',
  'showAdvancedStatsButton',
  'showRuneNumbers',
  'showUniqueSetBeams',
  'alwaysShowUniqueSetLabels',
  'weatherOverride',
  'audioMuted',
  'masterVolume',
  'multiboxEnabled',
  'multiboxAudioFocusPolicy',
  'multiboxAlertSoundEnabled',
] as const

function resolveDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const ls = (globalThis as { localStorage?: StorageLike }).localStorage
      if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') {
        return ls
      }
    }
  } catch {
    // SecurityError or disabled localStorage
  }
  return null
}

/**
 * Persistent reactive store for `ClientSettings` backed by `localStorage['d2web.settings.v1']`.
 */
export class SettingsStore {
  private readonly explicitStorage: StorageLike | null | undefined
  private readonly storageKey: string
  private readonly defaultLang: GameLang | undefined
  private readonly pageProtocol: string
  private readonly syncGlobalLang: boolean
  private current: ClientSettings
  private readonly listeners = new Set<SettingsChangeListener>()

  constructor(options?: SettingsStoreOptions) {
    this.explicitStorage = options?.storage
    this.storageKey = options?.storageKey ?? SETTINGS_STORAGE_KEY
    this.defaultLang = options?.defaultLang
    this.pageProtocol =
      options?.pageProtocol ??
      (typeof window !== 'undefined' && window.location ? window.location.protocol : 'https:')
    this.syncGlobalLang = options?.syncGlobalLang ?? true

    this.current = this.readFromStorage()
    if (this.syncGlobalLang) {
      setLang(this.current.lang)
    }
    // Persist canonicalized settings on startup so corrupt/missing storage is healed
    this.writeToStorage(this.current)
  }

  private getStorage(): StorageLike | null {
    return this.explicitStorage !== undefined ? this.explicitStorage : resolveDefaultStorage()
  }

  private readFromStorage(): ClientSettings {
    const storage = this.getStorage()
    if (!storage) {
      return createDefaultClientSettings(this.defaultLang)
    }
    try {
      const raw = storage.getItem(this.storageKey)
      return parseClientSettingsJson(raw, {
        defaultLang: this.defaultLang,
        pageProtocol: this.pageProtocol,
      })
    } catch {
      return createDefaultClientSettings(this.defaultLang)
    }
  }

  private writeToStorage(settings: ClientSettings): void {
    const storage = this.getStorage()
    if (!storage) return
    try {
      storage.setItem(this.storageKey, JSON.stringify(settings))
    } catch {
      // Ignore quota or private-browsing write errors
    }
  }

  get(): ClientSettings {
    return this.current
  }

  reload(): ClientSettings {
    const prev = this.current
    const next = this.readFromStorage()
    this.applyUpdate(prev, next)
    return this.current
  }

  set(patch: Partial<Omit<ClientSettings, 'version'>>): ClientSettings {
    const prev = this.current
    const merged: Record<string, unknown> = {
      ...prev,
      ...patch,
      version: 1,
    }
    // If patch explicitly provided an invalid serverHost, keep previous valid serverHost
    if (patch.serverHost !== undefined) {
      const hostCheck = validateServerHost(patch.serverHost, this.pageProtocol)
      merged.serverHost = hostCheck.valid ? hostCheck.normalizedHost : prev.serverHost
    }
    const next = sanitizeClientSettings(merged, {
      defaultLang: prev.lang,
      pageProtocol: this.pageProtocol,
    })
    this.applyUpdate(prev, next)
    return this.current
  }

  update(patch: Partial<Omit<ClientSettings, 'version'>>): ClientSettings {
    return this.set(patch)
  }

  /**
   * Validate and update `serverHost`. Returns the validation result along with the active settings.
   * Does not overwrite `serverHost` if validation fails.
   */
  setServerHost(
    rawHost: string,
    pageProtocol: string = this.pageProtocol,
  ): ServerHostValidationResult & { readonly settings: ClientSettings } {
    const check = validateServerHost(rawHost, pageProtocol)
    if (!check.valid) {
      return {
        ...check,
        settings: this.current,
      }
    }
    const prev = this.current
    const next: ClientSettings = {
      ...prev,
      serverHost: check.normalizedHost,
    }
    this.applyUpdate(prev, next)
    return {
      ...check,
      settings: this.current,
    }
  }

  reset(): ClientSettings {
    const prev = this.current
    const next = createDefaultClientSettings(this.defaultLang)
    this.applyUpdate(prev, next)
    return this.current
  }

  subscribe(listener: SettingsChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private applyUpdate(prev: ClientSettings, next: ClientSettings): void {
    const changedKeys: SettingsKey[] = []
    for (const key of COMPARE_KEYS) {
      if (prev[key] !== next[key]) {
        changedKeys.push(key)
      }
    }
    this.current = next
    this.writeToStorage(next)

    if (changedKeys.length === 0) {
      return
    }

    if (this.syncGlobalLang && prev.lang !== next.lang) {
      setLang(next.lang)
    }

    for (const listener of this.listeners) {
      try {
        listener(next, prev, changedKeys)
      } catch {
        // Ignore subscriber exceptions
      }
    }
  }
}

export function createSettingsStore(options?: SettingsStoreOptions): SettingsStore {
  return new SettingsStore(options)
}

let globalStore: SettingsStore | null = null

export function getGlobalSettingsStore(options?: SettingsStoreOptions): SettingsStore {
  if (!globalStore) {
    globalStore = new SettingsStore(options)
  }
  return globalStore
}
