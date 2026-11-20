import { afterEach, describe, expect, it, vi } from 'vitest'
import type { D2WebPlugin } from '../../../src/client/plugin-host/api.ts'
import {
  PLUGIN_CONFIG_STORAGE_KEY,
  PluginConfigStore,
  type PluginConfigChangeEvent,
} from '../../../src/client/plugin-host/plugin-config-store.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  readonly data = new Map<string, string>()
  setCalls = 0
  removeCalls = 0
  throwOnGet = false
  throwOnSet = false

  getItem(key: string): string | null {
    if (this.throwOnGet) {
      throw new Error('QuotaExceeded or SecurityError on getItem')
    }
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error('QuotaExceeded or SecurityError on setItem')
    }
    this.setCalls++
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.removeCalls++
    this.data.delete(key)
  }
}

function makeTestPlugin(overrides: Partial<D2WebPlugin> = {}): D2WebPlugin {
  return {
    id: overrides.id ?? 'kill-stats',
    name: overrides.name ?? { zh: '击杀统计', en: 'Kill Stats' },
    description: overrides.description ?? {
      zh: '记录并展示角色击杀统计',
      en: 'Record and display character kill statistics',
    },
    defaultEnabled: overrides.defaultEnabled ?? true,
    settings: overrides.settings ?? [
      {
        kind: 'boolean',
        key: 'showToolbarShortcut',
        label: { zh: '在工具栏显示快捷入口', en: 'Show shortcut in toolbar' },
        default: true,
      },
      {
        kind: 'select',
        key: 'density',
        label: { zh: '密度', en: 'Density' },
        default: 'normal',
        options: [
          { value: 'compact', label: { zh: '紧凑', en: 'Compact' } },
          { value: 'normal', label: { zh: '标准', en: 'Normal' } },
        ],
      },
    ],
    actions: overrides.actions ?? [],
    activate:
      overrides.activate ??
      (() => ({
        deactivate() {},
      })),
  }
}

describe('PluginConfigStore (d2web.plugins.v1 Persistence & Corruption Resilience)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses manifest defaults when localStorage is empty without writing to storage', () => {
    const storage = new MemoryStorage()
    const pluginA = makeTestPlugin({ id: 'kill-stats', defaultEnabled: true })
    const pluginB = makeTestPlugin({
      id: 'map-overlay',
      defaultEnabled: false,
      settings: [],
    })

    const store = new PluginConfigStore([pluginA, pluginB], { storage })

    expect(store.hasCorruptionError()).toBe(false)
    expect(store.getCorruptionMessage()).toBeNull()
    expect(store.isEnabled('kill-stats')).toBe(true)
    expect(store.isEnabled('map-overlay')).toBe(false)
    expect(store.getSetting('kill-stats', 'showToolbarShortcut')).toBe(true)
    expect(store.getSetting('kill-stats', 'density')).toBe('normal')
    expect(store.getAllSettings('kill-stats')).toEqual({
      showToolbarShortcut: true,
      density: 'normal',
    })
    expect(storage.setCalls).toBe(0)
    store.detachStorageListener()
  })

  it('persists and round-trips v1 schema across store instances and notifies subscribers', () => {
    const storage = new MemoryStorage()
    const plugin = makeTestPlugin()
    const store1 = new PluginConfigStore([plugin], { storage })
    const events: PluginConfigChangeEvent[] = []
    const unsub = store1.subscribe((e) => events.push(e))

    store1.setEnabled('kill-stats', false)
    store1.setSetting('kill-stats', 'showToolbarShortcut', false)
    store1.setSetting('kill-stats', 'density', 'compact')

    expect(events).toEqual([
      { kind: 'enabled', pluginId: 'kill-stats' },
      { kind: 'setting', pluginId: 'kill-stats', settingKey: 'showToolbarShortcut' },
      { kind: 'setting', pluginId: 'kill-stats', settingKey: 'density' },
    ])

    const raw = storage.getItem(PLUGIN_CONFIG_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as {
      version: number
      plugins: Record<string, { enabled: boolean; settings: Record<string, unknown> }>
    }
    expect(parsed).toEqual({
      version: 1,
      plugins: {
        'kill-stats': {
          enabled: false,
          settings: {
            showToolbarShortcut: false,
            density: 'compact',
          },
        },
      },
    })

    const store2 = new PluginConfigStore([plugin], { storage })
    expect(store2.hasCorruptionError()).toBe(false)
    expect(store2.isEnabled('kill-stats')).toBe(false)
    expect(store2.getSetting('kill-stats', 'showToolbarShortcut')).toBe(false)
    expect(store2.getSetting('kill-stats', 'density')).toBe('compact')

    unsub()
    store1.detachStorageListener()
    store2.detachStorageListener()
  })

  it('flags corrupt JSON via console.error, falls back to defaults in memory, and preserves raw localStorage until explicit user write', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = new MemoryStorage()
    const corruptRaw = '{not-valid-json'
    storage.data.set(PLUGIN_CONFIG_STORAGE_KEY, corruptRaw)

    const plugin = makeTestPlugin()
    const store = new PluginConfigStore([plugin], { storage })

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PluginConfigStore] Corrupt JSON in d2web.plugins.v1:'),
    )
    expect(store.hasCorruptionError()).toBe(true)
    expect(store.getCorruptionMessage()).toContain('Corrupt JSON in d2web.plugins.v1:')
    expect(store.isEnabled('kill-stats')).toBe(true)
    expect(store.getSetting('kill-stats', 'showToolbarShortcut')).toBe(true)
    // Raw corrupt entry MUST NOT be overwritten during initialization
    expect(storage.setCalls).toBe(0)
    expect(storage.getItem(PLUGIN_CONFIG_STORAGE_KEY)).toBe(corruptRaw)

    // Explicit user action clears corruption state and writes valid v1 JSON
    store.setSetting('kill-stats', 'density', 'compact')
    expect(store.hasCorruptionError()).toBe(false)
    expect(store.getCorruptionMessage()).toBeNull()
    expect(storage.setCalls).toBe(1)
    expect(JSON.parse(storage.getItem(PLUGIN_CONFIG_STORAGE_KEY)!).version).toBe(1)

    store.detachStorageListener()
  })

  it('rejects unsupported schema version or missing plugins object without overwriting storage', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = new MemoryStorage()
    const futureRaw = JSON.stringify({ version: 99, plugins: {} })
    storage.data.set(PLUGIN_CONFIG_STORAGE_KEY, futureRaw)

    const store = new PluginConfigStore([makeTestPlugin()], { storage })
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PluginConfigStore] Invalid schema in d2web.plugins.v1'),
    )
    expect(store.hasCorruptionError()).toBe(true)
    expect(store.getCorruptionMessage()).toContain('Invalid schema in d2web.plugins.v1')
    expect(storage.setCalls).toBe(0)
    expect(storage.getItem(PLUGIN_CONFIG_STORAGE_KEY)).toBe(futureRaw)

    store.detachStorageListener()
  })

  it('validates per-plugin enabled and setting values, preserves unknown plugin entries, and supports resetAllToDefaults()', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = new MemoryStorage()
    storage.data.set(
      PLUGIN_CONFIG_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        plugins: {
          'kill-stats': {
            enabled: 'not-a-boolean',
            settings: {
              showToolbarShortcut: false,
              density: 'invalid-option',
            },
          },
          'future-plugin': {
            enabled: false,
            settings: { customKey: 'customVal' },
          },
        },
      }),
    )

    const store = new PluginConfigStore([makeTestPlugin()], { storage })
    expect(errSpy).toHaveBeenCalled()
    expect(store.hasCorruptionError()).toBe(true)
    // Invalid enabled & density fall back to defaults; valid showToolbarShortcut=false is retained
    expect(store.isEnabled('kill-stats')).toBe(true)
    expect(store.getSetting('kill-stats', 'showToolbarShortcut')).toBe(false)
    expect(store.getSetting('kill-stats', 'density')).toBe('normal')
    expect(storage.setCalls).toBe(0)

    // resetAllToDefaults clears corruption error, restores manifest defaults, and preserves 'future-plugin'
    store.resetAllToDefaults()
    expect(store.hasCorruptionError()).toBe(false)
    expect(store.getCorruptionMessage()).toBeNull()
    expect(store.isEnabled('kill-stats')).toBe(true)
    expect(store.getSetting('kill-stats', 'showToolbarShortcut')).toBe(true)
    expect(store.getSetting('kill-stats', 'density')).toBe('normal')

    const persisted = JSON.parse(storage.getItem(PLUGIN_CONFIG_STORAGE_KEY)!) as {
      version: number
      plugins: Record<string, unknown>
    }
    expect(persisted.plugins['future-plugin']).toEqual({
      enabled: false,
      settings: { customKey: 'customVal' },
    })

    store.detachStorageListener()
  })

  it('reloads configuration when window dispatches a storage event for d2web.plugins.v1', () => {
    const prevWindow = globalThis.window
    const storageListeners = new Set<(ev: StorageEvent) => void>()
    const fakeWindow = {
      addEventListener(type: string, listener: (ev: StorageEvent) => void) {
        if (type === 'storage') storageListeners.add(listener)
      },
      removeEventListener(type: string, listener: (ev: StorageEvent) => void) {
        if (type === 'storage') storageListeners.delete(listener)
      },
    }
    ;(globalThis as unknown as { window: unknown }).window = fakeWindow

    try {
      const storage = new MemoryStorage()
      const store = new PluginConfigStore([makeTestPlugin()], { storage })
      store.attachStorageListener()
      const events: PluginConfigChangeEvent[] = []
      store.subscribe((e) => events.push(e))

      expect(store.isEnabled('kill-stats')).toBe(true)

      storage.data.set(
        PLUGIN_CONFIG_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          plugins: {
            'kill-stats': {
              enabled: false,
              settings: { showToolbarShortcut: false, density: 'compact' },
            },
          },
        }),
      )

      for (const listener of storageListeners) {
        listener({ key: PLUGIN_CONFIG_STORAGE_KEY } as StorageEvent)
      }

      expect(store.isEnabled('kill-stats')).toBe(false)
      expect(store.getSetting('kill-stats', 'showToolbarShortcut')).toBe(false)
      expect(store.getSetting('kill-stats', 'density')).toBe('compact')
      expect(events).toEqual([{ kind: 'reload', pluginId: null }])

      store.detachStorageListener()
      expect(storageListeners.size).toBe(0)
    } finally {
      ;(globalThis as unknown as { window: unknown }).window = prevWindow
    }
  })

  it('handles storage getItem/setItem exceptions gracefully by logging console.error and flagging corruption', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = new MemoryStorage()
    storage.throwOnGet = true

    const store = new PluginConfigStore([makeTestPlugin()], { storage })
    expect(store.hasCorruptionError()).toBe(true)
    expect(store.getCorruptionMessage()).toContain('Failed to read d2web.plugins.v1:')

    storage.throwOnGet = false
    storage.throwOnSet = true
    store.setEnabled('kill-stats', false)
    expect(errSpy).toHaveBeenCalledWith(
      '[PluginConfigStore] Failed to persist plugin configuration:',
      expect.any(Error),
    )

    store.detachStorageListener()
  })
})
