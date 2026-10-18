import { describe, expect, it } from 'vitest'
import {
  containsCjkCharacters,
  validatePluginRegistry,
  type AutoPotionThresholds,
  type ItemInfoConfig,
  type D2WebPlugin,
  type PluginSessionView,
  type PluginTogglePort,
} from '../../src/client/plugin-host/api.ts'
import { PluginConfigStore } from '../../src/client/plugin-host/plugin-config-store.ts'
import { PluginHost, type PluginHostOptions } from '../../src/client/plugin-host/plugin-host.ts'
import { BUILTIN_PLUGINS } from '../../plugins/index.ts'
import { dragInteractPlugin } from '../../plugins/drag-interact/index.ts'
import { stashDepositAllPlugin } from '../../plugins/stash-deposit-all/index.ts'
import { experienceBarPlugin } from '../../plugins/experience-bar/index.ts'
import { autoGoldPickupPlugin } from '../../plugins/auto-gold-pickup/index.ts'
import { autoCombatPlugin } from '../../plugins/auto-combat/index.ts'
import { autoPotionPlugin } from '../../plugins/auto-potion/index.ts'
import { upgradeHintsPlugin } from '../../plugins/upgrade-hints/index.ts'
import { itemInfoPlugin } from '../../plugins/item-info/index.ts'
import { monsterResistsPlugin } from '../../plugins/monster-resists/index.ts'

const memoryStorage = () => {
  const map = new Map<string, string>()
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }
}

const createHost = (plugin: D2WebPlugin, ports: Partial<PluginHostOptions> = {}, storage = memoryStorage()) =>
  new PluginHost({
    plugins: [plugin],
    configStore: new PluginConfigStore([plugin], { storage }),
    session: { phase: 'lobby', world: {}, loginHost: null, getSnapshot: () => ({}), onServerEvent: () => () => {}, onStateChange: () => () => {} } as unknown as PluginSessionView,
    toolbar: { setPluginsButtonState() {}, addContribution: () => () => {} },
    autoStart: false,
    ...ports,
  })

const startEnabled = async (host: PluginHost, pluginId: string) => {
  await host.start()
  await host.setEnabled(pluginId, true)
  return host
}

const portStub = () => {
  const stub = { enabled: false, isEnabled: () => stub.enabled, setEnabled: (v: boolean) => void (stub.enabled = v) }
  return stub
}

describe.each([
  { plugin: dragInteractPlugin, portName: 'dragInteract', defaultOn: true },
  { plugin: stashDepositAllPlugin, portName: 'stashDepositAll', defaultOn: true },
  { plugin: experienceBarPlugin, portName: 'xpBar', defaultOn: true },
  { plugin: autoGoldPickupPlugin, portName: 'autoGoldPickup', defaultOn: false },
  { plugin: upgradeHintsPlugin, portName: 'upgradeHints', defaultOn: true },
  { plugin: monsterResistsPlugin, portName: 'monsterResists', defaultOn: true },
])('$plugin.id toggle plugin', ({ plugin, portName, defaultOn }) => {
  const createToggleHost = (port: PluginTogglePort | null) => createHost(plugin, { [portName]: port })

  it('is registered as a valid toggle with the expected default', () => {
    expect(BUILTIN_PLUGINS).toContain(plugin)
    expect(() => validatePluginRegistry([plugin])).not.toThrow()
    expect(plugin.defaultEnabled).toBe(defaultOn)
    expect(plugin.settings).toBeUndefined()
    expect(containsCjkCharacters(plugin.name.en) || containsCjkCharacters(plugin.description.en)).toBe(false)
  })

  it('turns the port on while active and off on teardown', async () => {
    const port = portStub()
    const host = await startEnabled(createToggleHost(port), plugin.id)
    expect([port.enabled, host.getStatus(plugin.id).level]).toEqual([true, 'ok'])
    await host.destroy()
    expect(port.enabled).toBe(false)
  })

  it('disabling the plugin restores vanilla behaviour', async () => {
    const port = portStub()
    const host = await startEnabled(createToggleHost(port), plugin.id)
    await host.setEnabled(plugin.id, false)
    expect(port.enabled).toBe(false)
    await host.setEnabled(plugin.id, true)
    expect(port.enabled).toBe(true)
    await host.destroy()
  })

  it('reports an error instead of silently doing nothing when the port is not wired', async () => {
    const host = await startEnabled(createToggleHost(null), plugin.id)
    expect(host.getStatus(plugin.id).level).toBe('error')
    await host.destroy()
  })
})

describe('auto-combat plugin', () => {
  it('binds the configured key while active, follows setting changes and unbinds on teardown', async () => {
    let key: string | null = null
    const host = await startEnabled(createHost(autoCombatPlugin, { autoCombat: { getKey: () => key, setKey: (k) => void (key = k) } }), 'auto-combat')
    expect([key, host.getStatus('auto-combat').level]).toEqual(['E', 'ok'])
    host.setSetting('auto-combat', 'key', 'SPACE')
    expect(key).toBe('SPACE')
    await host.destroy()
    expect(key).toBeNull()
  })
})

describe('auto-potion plugin', () => {
  it('applies the default thresholds, follows setting changes and switches off on teardown', async () => {
    let thresholds: AutoPotionThresholds | null = null
    const host = await startEnabled(createHost(autoPotionPlugin, { autoPotion: { getThresholds: () => thresholds, setThresholds: (t) => void (thresholds = t) } }), 'auto-potion')
    expect([thresholds, host.getStatus('auto-potion').level]).toEqual([{ life: 50, rejuv: 25, mana: 20, merc: 40 }, 'ok'])
    host.setSetting('auto-potion', 'mana', '0')
    expect(thresholds).toMatchObject({ life: 50, mana: 0 })
    await host.destroy()
    expect(thresholds).toBeNull()
  })

  it('reports an error when the port is not wired', async () => {
    const host = await startEnabled(createHost(autoPotionPlugin), 'auto-potion')
    expect(host.getStatus('auto-potion').level).toBe('error')
    await host.destroy()
  })
})

describe('item-info plugin', () => {
  it('applies its settings to the port, follows changes and switches off on teardown', async () => {
    let config: ItemInfoConfig | null = null
    const host = await startEnabled(createHost(itemInfoPlugin, { itemInfo: { getConfig: () => config, setConfig: (c) => void (config = c) } }), 'item-info')
    expect([config, host.getStatus('item-info').text.en]).toEqual([{ itemLevel: true, labelDetails: true, alwaysShow: false, lootFilter: 'off' }, 'Labels on Alt · filter off'])
    host.setSetting('item-info', 'alwaysShow', true)
    host.setSetting('item-info', 'lootFilter', 'junk')
    expect([config, host.getStatus('item-info').text.en]).toEqual([{ itemLevel: true, labelDetails: true, alwaysShow: true, lootFilter: 'junk' }, 'Labels always on · hiding junk'])
    await host.destroy()
    expect(config).toBeNull()
  })

  it('reports an error when the port is not wired', async () => {
    const host = await startEnabled(createHost(itemInfoPlugin), 'item-info')
    expect(host.getStatus('item-info').level).toBe('error')
    await host.destroy()
  })
})

describe('automation plugins', () => {
  it.each([autoCombatPlugin, autoPotionPlugin, autoGoldPickupPlugin])('$id starts off and stays on in the same browser once switched on', async (plugin) => {
    const ports: Partial<PluginHostOptions> = {
      autoCombat: { getKey: () => null, setKey() {} },
      autoPotion: { getThresholds: () => null, setThresholds() {} },
      autoGoldPickup: portStub(),
    }
    const storage = memoryStorage()
    const first = createHost(plugin, ports, storage)
    await first.start()
    expect(first.isEnabled(plugin.id)).toBe(false)
    await first.setEnabled(plugin.id, true)
    await first.destroy()
    const reloaded = createHost(plugin, ports, storage)
    await reloaded.start()
    expect(reloaded.isEnabled(plugin.id)).toBe(true)
    await reloaded.destroy()
    expect(createHost(plugin, ports).isEnabled(plugin.id)).toBe(false)
  })
})
