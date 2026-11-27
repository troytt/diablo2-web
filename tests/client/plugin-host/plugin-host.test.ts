import { describe, expect, it, vi } from 'vitest'
import {
  bootPluginPage,
  validatePluginRegistry,
  type D2WebPlugin,
  type PluginContext,
  type PluginSessionView,
} from '../../../src/client/plugin-host/api.ts'
import {
  PLUGIN_CONFIG_STORAGE_KEY,
  PluginConfigStore,
} from '../../../src/client/plugin-host/plugin-config-store.ts'
import {
  PluginHost,
  type PluginHostToolbarPort,
  type ToolbarContributionSpec,
} from '../../../src/client/plugin-host/plugin-host.ts'
import { buildPluginMenuViewModel } from '../../../src/client/plugin-host/plugin-menu-model.ts'
import { OnlineSession } from '../../../src/client/session/online-session.ts'
import { isModalDomOverlayOpen } from '../../../src/client/ui/dom-overlay.ts'

class MemoryPluginStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  readonly data = new Map<string, string>()
  setCalls = 0

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.setCalls++
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }
}

function makeMockSession(): PluginSessionView {
  return new OnlineSession()
}

function makeMockToolbarPort(): {
  toolbar: PluginHostToolbarPort
  activeItems: Map<string, ToolbarContributionSpec>
  buttonStates: { ready: boolean; hasWarning: boolean; open?: boolean | undefined }[]
} {
  const activeItems = new Map<string, ToolbarContributionSpec>()
  const buttonStates: { ready: boolean; hasWarning: boolean; open?: boolean | undefined }[] = []
  const toolbar: PluginHostToolbarPort = {
    setPluginsButtonState(state) {
      buttonStates.push(state)
    },
    addContribution(spec) {
      activeItems.set(spec.domId, spec)
      return () => {
        activeItems.delete(spec.domId)
      }
    },
  }
  return { toolbar, activeItems, buttonStates }
}

function makeValidPlugin(overrides: Partial<D2WebPlugin> = {}): D2WebPlugin {
  return {
    id: overrides.id ?? 'sample-plugin',
    name: overrides.name ?? { zh: '示例插件', en: 'Sample Plugin' },
    description: overrides.description ?? {
      zh: '示例插件描述',
      en: 'Sample plugin description',
    },
    defaultEnabled: overrides.defaultEnabled ?? true,
    settings: overrides.settings ?? [
      {
        kind: 'boolean',
        key: 'showShortcut',
        label: { zh: '显示快捷方式', en: 'Show Shortcut' },
        default: true,
      },
      {
        kind: 'select',
        key: 'mode',
        label: { zh: '模式', en: 'Mode' },
        default: 'compact',
        options: [
          { value: 'compact', label: { zh: '紧凑', en: 'Compact' } },
          { value: 'full', label: { zh: '完整', en: 'Full' } },
        ],
      },
    ],
    actions: overrides.actions ?? [
      {
        kind: 'link',
        id: 'open',
        label: { zh: '打开页面', en: 'Open Page' },
        href: 'plugins/sample-plugin/index.html',
      },
    ],
    activate:
      overrides.activate ??
      (() => ({
        deactivate() {},
      })),
  }
}

describe('validatePluginRegistry (Fail-Fast Registry Validation)', () => {
  it('accepts valid plugins and rejects duplicate IDs, non-kebab IDs, bad settings, and unsafe action hrefs', () => {
    expect(() => validatePluginRegistry([makeValidPlugin()])).not.toThrow()

    // Duplicate ID
    expect(() =>
      validatePluginRegistry([
        makeValidPlugin({ id: 'dup-id' }),
        makeValidPlugin({ id: 'dup-id' }),
      ]),
    ).toThrow(/Duplicate plugin id/i)

    // Non-kebab ID
    expect(() =>
      validatePluginRegistry([makeValidPlugin({ id: 'Bad_Id' })]),
    ).toThrow(/kebab-case/i)

    // Empty localized string
    expect(() =>
      validatePluginRegistry([
        makeValidPlugin({ name: { zh: '', en: 'Sample' } }),
      ]),
    ).toThrow(/localized name/i)

    // Select with empty options
    expect(() =>
      validatePluginRegistry([
        makeValidPlugin({
          settings: [
            {
              kind: 'select',
              key: 'mode',
              label: { zh: '模式', en: 'Mode' },
              default: 'only',
              options: [],
            },
          ],
        }),
      ]),
    ).toThrow(/non-empty options/i)

    // Select default not in options
    expect(() =>
      validatePluginRegistry([
        makeValidPlugin({
          settings: [
            {
              kind: 'select',
              key: 'mode',
              label: { zh: '模式', en: 'Mode' },
              default: 'missing',
              options: [
                { value: 'a', label: { zh: 'A', en: 'A' } },
                { value: 'b', label: { zh: 'B', en: 'B' } },
              ],
            },
          ],
        }),
      ]),
    ).toThrow(/default.*not in options/i)

    // External URL or leading slash in link action href
    expect(() =>
      validatePluginRegistry([
        makeValidPlugin({
          actions: [
            {
              kind: 'link',
              id: 'open',
              label: { zh: '打开', en: 'Open' },
              href: 'https://evil.example.com',
            },
          ],
        }),
      ]),
    ).toThrow(/relative path/i)

    expect(() =>
      validatePluginRegistry([
        makeValidPlugin({
          actions: [
            {
              kind: 'link',
              id: 'open',
              label: { zh: '打开', en: 'Open' },
              href: '/plugins/sample-plugin/index.html',
            },
          ],
        }),
      ]),
    ).toThrow(/relative path/i)
  })
})

describe('PluginConfigStore (d2web.plugins.v1 Persistence & Corruption Handling)', () => {
  it('flags corrupt JSON, wrong version, and invalid field types via console.error without overwriting storage until explicit user action', () => {
    const plugin = makeValidPlugin()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // 1. Corrupt JSON
    const storage1 = new MemoryPluginStorage()
    const rawCorrupt = '{not-valid-json'
    storage1.data.set(PLUGIN_CONFIG_STORAGE_KEY, rawCorrupt)
    const store1 = new PluginConfigStore([plugin], { storage: storage1 })

    expect(errSpy).toHaveBeenCalled()
    expect(store1.hasCorruptionError()).toBe(true)
    expect(store1.getCorruptionMessage()).toContain('Corrupt JSON')
    expect(store1.isEnabled('sample-plugin')).toBe(true)
    expect(store1.getSetting('sample-plugin', 'mode')).toBe('compact')
    // Must NOT overwrite raw corrupt localStorage entry on load
    expect(storage1.setCalls).toBe(0)
    expect(storage1.getItem(PLUGIN_CONFIG_STORAGE_KEY)).toBe(rawCorrupt)

    // Explicit user setting change overwrites and clears corruption flag
    store1.setSetting('sample-plugin', 'mode', 'full')
    expect(store1.hasCorruptionError()).toBe(false)
    expect(storage1.setCalls).toBe(1)
    expect(store1.getSetting('sample-plugin', 'mode')).toBe('full')

    // 2. Invalid field types & out-of-range select option + unknown plugin preservation
    const storage2 = new MemoryPluginStorage()
    storage2.data.set(
      PLUGIN_CONFIG_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        plugins: {
          'sample-plugin': {
            enabled: 'not-a-boolean',
            settings: {
              showShortcut: false,
              mode: 'non-existent-option',
            },
          },
          'future-plugin': {
            enabled: false,
            settings: { customFlag: true },
          },
        },
      }),
    )
    const store2 = new PluginConfigStore([plugin], { storage: storage2 })
    expect(store2.hasCorruptionError()).toBe(true)
    // Invalid enabled & mode fall back to defaults; valid showShortcut=false is kept
    expect(store2.isEnabled('sample-plugin')).toBe(true)
    expect(store2.getSetting('sample-plugin', 'showShortcut')).toBe(false)
    expect(store2.getSetting('sample-plugin', 'mode')).toBe('compact')
    expect(storage2.setCalls).toBe(0)

    // Explicit toggle persists and preserves 'future-plugin'
    store2.setEnabled('sample-plugin', false)
    const saved = JSON.parse(storage2.getItem(PLUGIN_CONFIG_STORAGE_KEY)!) as {
      version: number
      plugins: Record<string, unknown>
    }
    expect(saved.version).toBe(1)
    expect(saved.plugins['future-plugin']).toEqual({
      enabled: false,
      settings: { customFlag: true },
    })

    // resetAllToDefaults resets to defaults and preserves unknown plugins
    store2.resetAllToDefaults()
    expect(store2.isEnabled('sample-plugin')).toBe(true)
    expect(store2.getSetting('sample-plugin', 'showShortcut')).toBe(true)

    errSpy.mockRestore()
  })
})

describe('PluginHost (Lifecycle, Serialized Toggles, Resource Cleanup & Error Isolation)', () => {
  it('activates default-enabled plugins, auto-cleans toolbar/subscriptions on deactivate, serializes rapid toggles, and isolates errors', async () => {
    const storage = new MemoryPluginStorage()
    const { toolbar, activeItems } = makeMockToolbarPort()
    const events: string[] = []

    let resolveSlowActivate: (() => void) | null = null
    let slowActivateCount = 0
    let slowDeactivateCount = 0

    const slowPlugin = makeValidPlugin({
      id: 'slow-plugin',
      defaultEnabled: true,
      async activate(ctx: PluginContext) {
        slowActivateCount++
        events.push(`activate:${slowActivateCount}:start`)
        ctx.toolbar.addLink({
          id: 'open',
          label: { zh: '打开', en: 'Open' },
          href: 'plugins/slow-plugin/index.html',
        })
        if (slowActivateCount === 1) {
          await new Promise<void>((resolve) => {
            resolveSlowActivate = resolve
          })
        } else {
          await Promise.resolve()
        }
        events.push(`activate:${slowActivateCount}:done`)
        return {
          async deactivate() {
            slowDeactivateCount++
            events.push(`deactivate:${slowDeactivateCount}`)
          },
        }
      },
    })

    const faultyPlugin = makeValidPlugin({
      id: 'faulty-plugin',
      defaultEnabled: true,
      activate() {
        throw new Error('Boom during activate')
      },
    })

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const configStore = new PluginConfigStore([slowPlugin, faultyPlugin], {
      storage,
    })

    const pluginHost = new PluginHost({
      plugins: [slowPlugin, faultyPlugin],
      configStore,
      session: makeMockSession(),
      toolbar,
      autoStart: false,
    })

    const startPromise = pluginHost.start()
    await Promise.resolve()
    // Queue rapid toggles while start() is awaiting slowPlugin.activate
    const toggleOff = pluginHost.setEnabled('slow-plugin', false)
    const toggleOn = pluginHost.setEnabled('slow-plugin', true)
    const toggleOffFinal = pluginHost.setEnabled('slow-plugin', false)

    resolveSlowActivate!()
    await Promise.all([startPromise, toggleOff, toggleOn, toggleOffFinal])

    expect(pluginHost.isEnabled('slow-plugin')).toBe(false)
    expect(activeItems.size).toBe(0)
    expect(slowDeactivateCount).toBeGreaterThanOrEqual(1)

    // Faulty plugin is isolated with level === 'error'
    const faultyDesc = pluginHost
      .list()
      .find((d) => d.plugin.id === 'faulty-plugin')
    expect(faultyDesc?.status.level).toBe('error')
    expect(faultyDesc?.status.text.en).toContain('Boom during activate')
    expect(pluginHost.hasErrorOrCorruption()).toBe(true)

    // Build menu view model in both zh and en
    const vmZh = buildPluginMenuViewModel(pluginHost, 'zh')
    expect(vmZh.title).toBe('插件管理')
    expect(vmZh.alertText).toContain('Boom during activate')
    expect(vmZh.cards).toHaveLength(2)

    await pluginHost.destroy()
    errSpy.mockRestore()
  })

  it('serializes cross-tab reload events onto record.queue when async activate() is in-flight and clears sticky errors on resetAllToDefaults()', async () => {
    const prevWindow = (globalThis as { window?: unknown }).window
    const storageListeners = new Set<(ev: StorageEvent) => void>()
    ;(globalThis as unknown as { window: unknown }).window = {
      addEventListener(type: string, cb: (ev: StorageEvent) => void) {
        if (type === 'storage') storageListeners.add(cb)
      },
      removeEventListener(type: string, cb: (ev: StorageEvent) => void) {
        if (type === 'storage') storageListeners.delete(cb)
      },
    }

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const storage = new MemoryPluginStorage()
      let resolveInFlightActivate: (() => void) | null = null
      let blockNextActivate = true
      let deactivated = false

      const asyncPlugin = makeValidPlugin({
        id: 'in-flight-plugin',
        defaultEnabled: true,
        actions: [
          {
            kind: 'button',
            id: 'boom-action',
            label: { zh: '报错动作', en: 'Boom Action' },
            run() {
              throw new Error('Action failure while active')
            },
          },
        ],
        async activate() {
          if (blockNextActivate) {
            blockNextActivate = false
            await new Promise<void>((resolve) => {
              resolveInFlightActivate = resolve
            })
          }
          return {
            deactivate() {
              deactivated = true
            },
          }
        },
      })

      const configStore = new PluginConfigStore([asyncPlugin], { storage })
      const host = new PluginHost({
        plugins: [asyncPlugin],
        configStore,
        session: makeMockSession(),
        autoStart: false,
      })

      const startPromise = host.start()
      await Promise.resolve()

      // Simulate another tab disabling 'in-flight-plugin' while activate() is still awaiting
      storage.data.set(
        PLUGIN_CONFIG_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          plugins: {
            'in-flight-plugin': {
              enabled: false,
              settings: { showShortcut: true, mode: 'compact' },
            },
          },
        }),
      )
      for (const cb of storageListeners) {
        cb({ key: PLUGIN_CONFIG_STORAGE_KEY } as StorageEvent)
      }

      // Now let the in-flight activate() resolve; the queued reload handler must deactivate it
      resolveInFlightActivate!()
      await startPromise
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()

      expect(deactivated).toBe(true)
      expect(host.isEnabled('in-flight-plugin')).toBe(false)

      // Re-enable the plugin, trigger an action error while active, then verify resetAllToDefaults() clears record.error
      await host.setEnabled('in-flight-plugin', true)

      host.runAction('in-flight-plugin', 'boom-action')
      expect(host.hasErrorOrCorruption()).toBe(true)
      expect(host.list()[0]?.status.level).toBe('error')

      await host.resetAllToDefaults()
      expect(host.hasErrorOrCorruption()).toBe(false)
      expect(host.list()[0]?.status.level).not.toBe('error')

      await host.destroy()
    } finally {
      errSpy.mockRestore()
      ;(globalThis as unknown as { window: unknown }).window = prevWindow
    }
  })

  it('bootPluginPage reads language and enabled status, fires subscribers once per storage event, and cleans up on destroy', () => {
    const prevWindow = (globalThis as { window?: unknown }).window
    const prevLocalStorage = (globalThis as { localStorage?: unknown }).localStorage
    const storageListeners = new Set<(ev: StorageEvent) => void>()
    const memoryStorage = new MemoryPluginStorage()

    ;(globalThis as unknown as { window: unknown }).window = {
      addEventListener(type: string, cb: (ev: StorageEvent) => void) {
        if (type === 'storage') storageListeners.add(cb)
      },
      removeEventListener(type: string, cb: (ev: StorageEvent) => void) {
        if (type === 'storage') storageListeners.delete(cb)
      },
    }
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = memoryStorage

    try {
      const plugin = makeValidPlugin({ id: 'page-plugin', defaultEnabled: true })
      const pageCtx = bootPluginPage(plugin)

      let enabledEvents = 0
      const notifiedSettingKeys: string[] = []
      pageCtx.subscribeEnabled(() => {
        enabledEvents++
      })
      pageCtx.subscribeSettings((key) => {
        notifiedSettingKeys.push(key)
      })

      expect(pageCtx.pluginId).toBe('page-plugin')
      expect(pageCtx.isEnabled()).toBe(true)

      // Simulate a cross-tab localStorage update to d2web.plugins.v1
      memoryStorage.data.set(
        PLUGIN_CONFIG_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          plugins: {
            'page-plugin': {
              enabled: false,
              settings: { showShortcut: false, mode: 'full' },
            },
          },
        }),
      )
      for (const cb of storageListeners) {
        cb({ key: PLUGIN_CONFIG_STORAGE_KEY } as StorageEvent)
      }

      // Each subscriber must fire once per setting/enabled state (no duplicate window storage firing)
      expect(enabledEvents).toBe(1)
      expect(notifiedSettingKeys).toEqual(['showShortcut', 'mode'])
      expect(pageCtx.isEnabled()).toBe(false)
      expect(pageCtx.getSetting('mode')).toBe('full')

      pageCtx.setLang('en')
      expect(pageCtx.getLang()).toBe('en')
      pageCtx.setLang('zh')
      expect(pageCtx.getLang()).toBe('zh')
      pageCtx.destroy()
      expect(storageListeners.size).toBe(0)
    } finally {
      ;(globalThis as unknown as { window: unknown }).window = prevWindow
      ;(globalThis as unknown as { localStorage: unknown }).localStorage = prevLocalStorage
    }
  })

  it('isModalDomOverlayOpen returns false in non-DOM environments', () => {
    expect(isModalDomOverlayOpen(null)).toBe(false)
  })
})

