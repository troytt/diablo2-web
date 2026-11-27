/**
 * Quick Cast plugin tests (Issue #952): the plugin is a single toggle — activation claims
 * the capability, deactivation / host teardown releases it and restores vanilla behavior.
 */

import { describe, expect, it } from 'vitest'
import {
  containsCjkCharacters,
  validatePluginRegistry,
  type PluginQuickCastPort,
  type PluginSessionView,
} from '../../src/client/plugin-host/api.ts'
import { PluginHost } from '../../src/client/plugin-host/plugin-host.ts'
import { PluginConfigStore } from '../../src/client/plugin-host/plugin-config-store.ts'
import { quickCastPlugin } from '../../plugins/quick-cast/index.ts'

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

function createPortStub(): PluginQuickCastPort & { enabled: boolean } {
  const stub: PluginQuickCastPort & { enabled: boolean } = {
    enabled: false,
    isEnabled: () => stub.enabled,
    setEnabled: (value: boolean) => {
      stub.enabled = value
    },
  }
  return stub
}

function createHarness(port: PluginQuickCastPort) {
  const storage = new MemoryStorage()
  const store = new PluginConfigStore([quickCastPlugin], { storage })
  const host = new PluginHost({
    plugins: [quickCastPlugin],
    configStore: store,
    session: {
      phase: 'lobby',
      world: {},
      loginHost: null,
      getSnapshot: () => ({}),
      onServerEvent: () => () => {},
      onStateChange: () => () => {},
    } as unknown as PluginSessionView,
    toolbar: {
      setPluginsButtonState() {},
      addContribution: () => () => {},
    },
    quickCast: port,
    autoStart: false,
  })
  return { host, store }
}

describe('quick-cast — toggle plugin (Issue #952)', () => {
  it('registers in the builtin registry with a valid descriptor', () => {
    expect(() => validatePluginRegistry([quickCastPlugin])).not.toThrow()
    expect(quickCastPlugin.id).toBe('quick-cast')
    expect(quickCastPlugin.defaultEnabled).toBe(true)
    expect(quickCastPlugin.settings).toBeUndefined()
    expect(quickCastPlugin.actions).toBeUndefined()
  })

  it('reports a bilingual status free of CJK in English', () => {
    expect(containsCjkCharacters(quickCastPlugin.name.en)).toBe(false)
    expect(containsCjkCharacters(quickCastPlugin.description.en)).toBe(false)
  })

  it('activation claims the capability and reports the active status', async () => {
    const port = createPortStub()
    const { host } = createHarness(port)
    await host.start()
    expect(port.enabled).toBe(true)
    const status = host.getStatus('quick-cast')
    expect(status.level).toBe('ok')
    expect(status.text.zh).toMatch(/已开启/)
    expect(status.text.en).not.toMatch(/[\u4e00-\u9fff]/)
    await host.destroy()
    expect(port.enabled).toBe(false)
  })

  it('disabling the plugin releases the claim and restores vanilla behavior', async () => {
    const port = createPortStub()
    const { host } = createHarness(port)
    await host.start()
    expect(port.enabled).toBe(true)

    await host.setEnabled('quick-cast', false)
    expect(port.enabled).toBe(false)

    await host.setEnabled('quick-cast', true)
    expect(port.enabled).toBe(true)
    await host.destroy()
    expect(port.enabled).toBe(false)
  })
})
