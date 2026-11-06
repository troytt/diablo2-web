/**
 * Persistent Plugin Configuration Store (`d2web.plugins.v1`).
 *
 * Schema:
 * `{ version: 1, plugins: { [id]: { enabled: boolean, settings: Record<string, boolean | string> } } }`
 *
 * Fail-fast & anti-silent-overwrite guarantees:
 * - Missing plugins or setting keys use the plugin's declared defaults.
 * - Unknown plugin IDs in storage are preserved untouched when structurally valid.
 * - On corrupt storage (invalid JSON, wrong `version`, non-boolean `enabled`, non-object
 *   `settings`, invalid setting type or out-of-range `select` option):
 *   1. Logs via `console.error`.
 *   2. Marks the store as having a corruption error (`hasCorruptionError()`, `getCorruptionMessage()`).
 *   3. Falls back to declared defaults in memory for invalid fields.
 *   4. NEVER overwrites the raw corrupt `localStorage` entry until the user explicitly
 *      changes a setting/toggle or calls `resetAllToDefaults()`.
 */

import {
  isValidPluginSettingValue,
  validatePluginRegistry,
  type D2WebPlugin,
  type PluginSettingSpec,
} from './api.ts'

export const PLUGIN_CONFIG_STORAGE_KEY = 'd2web.plugins.v1'

export interface StoredPluginEntry {
  readonly enabled: boolean
  readonly settings: Record<string, boolean | string>
}

export interface StoredPluginsPayloadV1 {
  readonly version: 1
  readonly plugins: Record<string, StoredPluginEntry>
}

export interface PluginConfigChangeEvent {
  readonly kind: 'enabled' | 'setting' | 'reset' | 'reload'
  readonly pluginId: string | null
  readonly settingKey?: string | undefined
}

export type PluginConfigListener = (event: PluginConfigChangeEvent) => void

export interface PluginConfigStoreOptions {
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined
}

interface MutablePluginState {
  enabled: boolean
  settings: Record<string, boolean | string>
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function resolveDefaultStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage
    }
  } catch {
    // Ignore sandboxed storage access errors
  }
  return null
}

export class PluginConfigStore {
  private readonly pluginsById = new Map<string, D2WebPlugin>()
  private readonly settingSpecsByPlugin = new Map<string, Map<string, PluginSettingSpec>>()
  private readonly states = new Map<string, MutablePluginState>()
  private readonly unknownPlugins = new Map<string, StoredPluginEntry>()
  private readonly listeners = new Set<PluginConfigListener>()
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  private corruptionMessage: string | null = null
  private storageListenerAttached = false

  private readonly handleWindowStorage = (ev: StorageEvent): void => {
    if (ev.key === PLUGIN_CONFIG_STORAGE_KEY || ev.key === null) {
      this.reloadFromStorage(true)
    }
  }

  constructor(plugins: readonly D2WebPlugin[], options?: PluginConfigStoreOptions) {
    validatePluginRegistry(plugins)
    this.storage = options?.storage !== undefined ? options.storage : resolveDefaultStorage()

    for (const plugin of plugins) {
      this.pluginsById.set(plugin.id, plugin)
      const specMap = new Map<string, PluginSettingSpec>()
      for (const spec of plugin.settings ?? []) {
        specMap.set(spec.key, spec)
      }
      this.settingSpecsByPlugin.set(plugin.id, specMap)
    }

    this.reloadFromStorage(false)
  }

  hasCorruptionError(): boolean {
    return this.corruptionMessage !== null
  }

  getCorruptionMessage(): string | null {
    return this.corruptionMessage
  }

  isEnabled(pluginId: string): boolean {
    const state = this.requirePluginState(pluginId)
    return state.enabled
  }

  setEnabled(pluginId: string, enabled: boolean): void {
    const state = this.requirePluginState(pluginId)
    if (typeof enabled !== 'boolean') {
      throw new Error(`[PluginConfigStore] enabled value for "${pluginId}" must be boolean`)
    }
    state.enabled = enabled
    this.corruptionMessage = null
    this.persistToStorage()
    this.notify({ kind: 'enabled', pluginId })
  }

  getSetting<T extends boolean | string = boolean | string>(
    pluginId: string,
    key: string,
  ): T {
    const state = this.requirePluginState(pluginId)
    const specMap = this.settingSpecsByPlugin.get(pluginId)
    if (!specMap || !specMap.has(key)) {
      throw new Error(
        `[PluginConfigStore] Unknown setting key "${key}" for plugin "${pluginId}"`,
      )
    }
    return state.settings[key] as T
  }

  getAllSettings(pluginId: string): Readonly<Record<string, boolean | string>> {
    const state = this.requirePluginState(pluginId)
    return { ...state.settings }
  }

  setSetting(pluginId: string, key: string, value: boolean | string): void {
    const state = this.requirePluginState(pluginId)
    const spec = this.settingSpecsByPlugin.get(pluginId)?.get(key)
    if (!spec) {
      throw new Error(
        `[PluginConfigStore] Unknown setting key "${key}" for plugin "${pluginId}"`,
      )
    }
    if (!isValidPluginSettingValue(spec, value)) {
      throw new Error(
        `[PluginConfigStore] Invalid value ${JSON.stringify(value)} for setting "${pluginId}.${key}"`,
      )
    }
    state.settings[key] = value
    this.corruptionMessage = null
    this.persistToStorage()
    this.notify({ kind: 'setting', pluginId, settingKey: key })
  }

  resetAllToDefaults(): void {
    this.initializeDefaultStates()
    this.corruptionMessage = null
    this.persistToStorage()
    this.notify({ kind: 'reset', pluginId: null })
  }

  reloadFromStorage(notifyListeners = true): void {
    this.initializeDefaultStates()
    this.unknownPlugins.clear()

    if (!this.storage) {
      this.corruptionMessage = null
      if (notifyListeners) {
        this.notify({ kind: 'reload', pluginId: null })
      }
      return
    }

    let raw: string | null = null
    try {
      raw = this.storage.getItem(PLUGIN_CONFIG_STORAGE_KEY)
    } catch (err) {
      this.recordCorruption(
        `Failed to read ${PLUGIN_CONFIG_STORAGE_KEY}: ${err instanceof Error ? err.message : String(err)}`,
      )
      if (notifyListeners) {
        this.notify({ kind: 'reload', pluginId: null })
      }
      return
    }

    if (raw === null) {
      this.corruptionMessage = null
      if (notifyListeners) {
        this.notify({ kind: 'reload', pluginId: null })
      }
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      this.recordCorruption(
        `Corrupt JSON in ${PLUGIN_CONFIG_STORAGE_KEY}: ${err instanceof Error ? err.message : String(err)}`,
      )
      if (notifyListeners) {
        this.notify({ kind: 'reload', pluginId: null })
      }
      return
    }

    if (!isPlainObject(parsed) || parsed.version !== 1 || !isPlainObject(parsed.plugins)) {
      this.recordCorruption(
        `Invalid schema in ${PLUGIN_CONFIG_STORAGE_KEY}: expected { version: 1, plugins: { ... } }`,
      )
      if (notifyListeners) {
        this.notify({ kind: 'reload', pluginId: null })
      }
      return
    }

    let detectedIssue: string | null = null
    for (const [pluginId, rawEntry] of Object.entries(parsed.plugins)) {
      const registered = this.pluginsById.get(pluginId)
      if (!registered) {
        if (this.isValidRawUnknownEntry(rawEntry)) {
          this.unknownPlugins.set(pluginId, {
            enabled: rawEntry.enabled,
            settings: { ...rawEntry.settings },
          })
        } else {
          detectedIssue ??= `Corrupt plugin entry "${pluginId}" in ${PLUGIN_CONFIG_STORAGE_KEY}`
        }
        continue
      }

      if (!isPlainObject(rawEntry)) {
        detectedIssue ??= `Corrupt entry for plugin "${pluginId}" in ${PLUGIN_CONFIG_STORAGE_KEY}: expected object`
        continue
      }

      const state = this.states.get(pluginId)!
      if (typeof rawEntry.enabled === 'boolean') {
        state.enabled = rawEntry.enabled
      } else {
        detectedIssue ??= `Corrupt "enabled" field for plugin "${pluginId}" in ${PLUGIN_CONFIG_STORAGE_KEY}: expected boolean`
      }

      if (rawEntry.settings !== undefined) {
        if (!isPlainObject(rawEntry.settings)) {
          detectedIssue ??= `Corrupt "settings" field for plugin "${pluginId}" in ${PLUGIN_CONFIG_STORAGE_KEY}: expected object`
        } else {
          const specMap = this.settingSpecsByPlugin.get(pluginId)!
          for (const [key, rawVal] of Object.entries(rawEntry.settings)) {
            const spec = specMap.get(key)
            if (!spec) {
              if (typeof rawVal !== 'boolean' && typeof rawVal !== 'string') {
                detectedIssue ??= `Corrupt setting "${pluginId}.${key}" in ${PLUGIN_CONFIG_STORAGE_KEY}`
              }
              continue
            }
            if (isValidPluginSettingValue(spec, rawVal)) {
              state.settings[key] = rawVal
            } else {
              detectedIssue ??= `Invalid setting value for "${pluginId}.${key}" in ${PLUGIN_CONFIG_STORAGE_KEY}: ${JSON.stringify(rawVal)}`
            }
          }
        }
      }
    }

    if (detectedIssue !== null) {
      this.recordCorruption(detectedIssue)
    } else {
      this.corruptionMessage = null
    }

    if (notifyListeners) {
      this.notify({ kind: 'reload', pluginId: null })
    }
  }

  attachStorageListener(): void {
    if (this.storageListenerAttached) return
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', this.handleWindowStorage)
      this.storageListenerAttached = true
    }
  }

  detachStorageListener(): void {
    if (!this.storageListenerAttached) return
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('storage', this.handleWindowStorage)
    }
    this.storageListenerAttached = false
  }

  subscribe(listener: PluginConfigListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private initializeDefaultStates(): void {
    this.states.clear()
    for (const [pluginId, plugin] of this.pluginsById.entries()) {
      const defaults: Record<string, boolean | string> = {}
      for (const spec of plugin.settings ?? []) {
        defaults[spec.key] = spec.default
      }
      this.states.set(pluginId, {
        enabled: plugin.defaultEnabled,
        settings: defaults,
      })
    }
  }

  private isValidRawUnknownEntry(rawEntry: unknown): rawEntry is StoredPluginEntry {
    if (!isPlainObject(rawEntry)) return false
    if (typeof rawEntry.enabled !== 'boolean') return false
    if (!isPlainObject(rawEntry.settings)) return false
    for (const val of Object.values(rawEntry.settings)) {
      if (typeof val !== 'boolean' && typeof val !== 'string') {
        return false
      }
    }
    return true
  }

  private recordCorruption(message: string): void {
    this.corruptionMessage = message
    console.error(`[PluginConfigStore] ${message}`)
  }

  private persistToStorage(): void {
    if (!this.storage) return
    const pluginsPayload: Record<string, StoredPluginEntry> = {}
    for (const [unknownId, entry] of this.unknownPlugins.entries()) {
      pluginsPayload[unknownId] = {
        enabled: entry.enabled,
        settings: { ...entry.settings },
      }
    }
    for (const [pluginId, state] of this.states.entries()) {
      pluginsPayload[pluginId] = {
        enabled: state.enabled,
        settings: { ...state.settings },
      }
    }
    const payload: StoredPluginsPayloadV1 = {
      version: 1,
      plugins: pluginsPayload,
    }
    try {
      this.storage.setItem(PLUGIN_CONFIG_STORAGE_KEY, JSON.stringify(payload))
    } catch (err) {
      console.error('[PluginConfigStore] Failed to persist plugin configuration:', err)
    }
  }

  private requirePluginState(pluginId: string): MutablePluginState {
    const state = this.states.get(pluginId)
    if (!state) {
      throw new Error(`[PluginConfigStore] Unknown plugin id "${pluginId}"`)
    }
    return state
  }

  private notify(event: PluginConfigChangeEvent): void {
    for (const listener of [...this.listeners]) {
      listener(event)
    }
  }
}
