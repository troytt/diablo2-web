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
import { beltRefillPlugin } from '../../plugins/belt-refill/index.ts'
import type { AutoLootRules, InventoryCareConfig } from '../../src/client/plugin-host/api.ts'
import { lowLifeWarningPlugin } from '../../plugins/low-life-warning/index.ts'
import { townPortalKeyPlugin } from '../../plugins/town-portal-key/index.ts'
import { autoCombatPlugin } from '../../plugins/auto-combat/index.ts'
import { pathGuidePlugin } from '../../plugins/path-guide/index.ts'
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
  { plugin: beltRefillPlugin, portName: 'beltRefill', defaultOn: false },
  { plugin: upgradeHintsPlugin, portName: 'upgradeHints', defaultOn: true },
  { plugin: monsterResistsPlugin, portName: 'monsterResists', defaultOn: true },
  { plugin: lowLifeWarningPlugin, portName: 'lowLifeWarning', defaultOn: true },
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
    let smart = false
    const host = await startEnabled(createHost(autoCombatPlugin, { autoCombat: { getKey: () => key, setKey: (k) => void (key = k) }, smartSkills: { isEnabled: () => smart, setEnabled: (on) => void (smart = on) } }), 'auto-combat')
    expect([key, smart, host.getStatus('auto-combat').level]).toEqual(['E', true, 'ok'])
    host.setSetting('auto-combat', 'key', 'SPACE')
    host.setSetting('auto-combat', 'skills', 'mine')
    expect([key, smart]).toEqual(['SPACE', false])
    await host.destroy()
    expect([key, smart]).toEqual([null, false])
  })
})

describe('path-guide plugin', () => {
  it('binds the autopilot key with the guide, can switch it off, and releases both on teardown', async () => {
    let [mode, key, spend]: [string | null, string | null, boolean] = [null, null, false]
    const host = await startEnabled(createHost(pathGuidePlugin, { pathGuide: { getMode: () => mode as never, setMode: (m) => void (mode = m) }, autopilot: { getKey: () => key, setKey: (k) => void (key = k) }, spendPoints: { isEnabled: () => spend, setEnabled: (on) => void (spend = on) } }), 'path-guide')
    expect([mode, key, spend, host.getStatus('path-guide').text.en]).toEqual(['story', 'Y', false, 'Every quest · Y for autopilot'])
    host.setSetting('path-guide', 'autopilot', 'off')
    host.setSetting('path-guide', 'points', 'build')
    expect([key, spend, host.getStatus('path-guide').text.en]).toEqual([null, true, 'Every quest'])
    await host.destroy()
    expect([mode, key, spend]).toEqual([null, null, false])
  })
})

describe('auto-potion plugin', () => {
  it('applies the default thresholds, follows setting changes and switches off on teardown', async () => {
    let thresholds: AutoPotionThresholds | null = null
    const host = await startEnabled(createHost(autoPotionPlugin, { autoPotion: { getThresholds: () => thresholds, setThresholds: (t) => void (thresholds = t) } }), 'auto-potion')
    expect([thresholds, host.getStatus('auto-potion').level]).toEqual([{ life: 65, rejuv: 35, mana: 20, merc: 40 }, 'ok'])
    host.setSetting('auto-potion', 'mana', '0')
    expect(thresholds).toMatchObject({ life: 65, mana: 0 })
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
  it.each([autoCombatPlugin, autoPotionPlugin, autoGoldPickupPlugin, beltRefillPlugin])('$id starts off and stays on in the same browser once switched on', async (plugin) => {
    const ports: Partial<PluginHostOptions> = {
      autoCombat: { getKey: () => null, setKey() {} },
      autoPotion: { getThresholds: () => null, setThresholds() {} },
      autoGoldPickup: portStub(),
      autoLoot: { getRules: () => null, setRules() {} },
      inventoryCare: { getConfig: () => null, setConfig() {} },
      beltRefill: portStub(),
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

describe('auto pickup plugin', () => {
  it('picks up gold and what helps the character, switches to chosen categories, and stops everything on teardown', async () => {
    const gold = portStub()
    const loot = { rules: null as AutoLootRules | null, getRules: () => loot.rules, setRules: (rules: AutoLootRules | null) => void (loot.rules = rules) }
    const care = { config: null as InventoryCareConfig | null, getConfig: () => care.config, setConfig: (config: InventoryCareConfig | null) => void (care.config = config) }
    const host = await startEnabled(createHost(autoGoldPickupPlugin, { autoGoldPickup: gold, autoLoot: loot, inventoryCare: care }), 'auto-gold-pickup')
    expect([gold.enabled, loot.rules, care.config]).toEqual([true, { mode: 'smart', minTier: 'good' }, { makeRoom: true, sellJunk: true, stashValuables: true }])
    host.setSetting('auto-gold-pickup', 'choose', 'categories')
    host.setSetting('auto-gold-pickup', 'rares', true)
    expect(loot.rules).toEqual({ mode: 'categories', runes: true, uniques: true, sets: true, charms: true, jewels: true, gems: false, rares: true })
    host.setSetting('auto-gold-pickup', 'pickup', 'items')
    expect(gold.enabled).toBe(false)
    expect(host.getStatus('auto-gold-pickup').text.en).toBe('Picking up runes, unique items, set items, charms, jewels and rare items')
    host.setSetting('auto-gold-pickup', 'pickup', 'gold')
    expect([gold.enabled, loot.rules, care.config?.makeRoom, care.config?.sellJunk]).toEqual([true, null, false, true])
    await host.setEnabled('auto-gold-pickup', false)
    expect([gold.enabled, loot.rules, care.config]).toEqual([false, null, null])
    await host.destroy()
  })

  it('only shows the category switches when picking categories', () => {
    const shown = (settings: Record<string, string | boolean>) =>
      (autoGoldPickupPlugin.settings ?? []).filter(({ shownWhen = [] }) => shownWhen.every(({ key, is }) => is.includes(settings[key] ?? ''))).map(({ key }) => key)
    expect(shown({ pickup: 'gold', choose: 'smart' })).toEqual(['pickup', 'sellJunk', 'stashValuables'])
    expect(shown({ pickup: 'both', choose: 'smart' })).toEqual(['pickup', 'choose', 'makeRoom', 'sellJunk', 'stashValuables'])
    expect(shown({ pickup: 'items', choose: 'categories' })).toContain('rares')
  })
})

describe('town portal key plugin', () => {
  it('is on by default, binds G and frees the key on teardown', async () => {
    const port = { key: null as string | null, getKey: () => port.key, setKey: (key: string | null) => void (port.key = key) }
    const host = createHost(townPortalKeyPlugin, { townPortal: port })
    await host.start()
    expect([BUILTIN_PLUGINS.includes(townPortalKeyPlugin), host.isEnabled(townPortalKeyPlugin.id), port.key]).toEqual([true, true, 'G'])
    expect(host.getStatus(townPortalKeyPlugin.id).text.en).toBe('Press G for a portal')
    host.setSetting(townPortalKeyPlugin.id, 'key', 'F')
    expect(port.key).toBe('F')
    await host.setEnabled(townPortalKeyPlugin.id, false)
    expect(port.key).toBeNull()
    await host.destroy()
  })
})
