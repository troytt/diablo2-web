import { describe, expect, it } from 'vitest'
import { lootAlert } from '../../plugins/loot-alerts/alerts.ts'
import { lootAlertsPlugin } from '../../plugins/loot-alerts/index.ts'
import { PluginHost } from '../../src/client/plugin-host/plugin-host.ts'
import { PluginConfigStore } from '../../src/client/plugin-host/plugin-config-store.ts'
import type { PluginSessionView, PluginToast } from '../../src/client/plugin-host/api.ts'
import type { ItemData, ServerEvent } from '../../src/netproto/index.ts'
import { characterBuild } from '../../src/common/items/character-build.ts'
import type { AppraisalContext } from '../../src/common/items/loot-appraisal.ts'
import { appraisalContextOf } from '../../src/common/items/loot-context.ts'

const BLOOD_MOOR = 2
const NO_CHARACTER = appraisalContextOf(null)
const coldSorc: AppraisalContext = { build: characterBuild({ classIndex: 1, level: 30, strength: 40, dexterity: 30, skillPoints: new Map([[59, 10], [64, 8]]) }), equipped: [], owned: [] }
const dropped = (fields: Partial<ItemData> & { readonly id: number; readonly code: string }): ItemData => ({ quality: 2, stats: [], runewordStats: [], ...fields }) as ItemData

describe('loot alerts', () => {
  it('announces new unique, set and rune drops with their kind and area', () => {
    expect(lootAlert(0, dropped({ id: 1, code: 'r08', quality: 2 }), 'notable', BLOOD_MOOR, NO_CHARACTER)).toEqual({ title: 'Ral Rune', detail: 'Rune · Blood Moor', color: 'orange' })
    expect(lootAlert(0, dropped({ id: 2, code: 'cap', quality: 7 }), 'notable', BLOOD_MOOR, NO_CHARACTER)).toMatchObject({ detail: 'Unique · Blood Moor', color: 'gold' })
    expect(lootAlert(0, dropped({ id: 3, code: 'lrg', quality: 5 }), 'notable', BLOOD_MOOR, NO_CHARACTER)).toMatchObject({ detail: 'Set item · Blood Moor', color: 'green' })
  })

  it('skips items already on the ground, dropped by the player, or below the chosen level', () => {
    expect(lootAlert(3, dropped({ id: 1, code: 'r08' }), 'notable', BLOOD_MOOR, NO_CHARACTER)).toBeNull()
    expect(lootAlert(2, dropped({ id: 1, code: 'r08' }), 'notable', BLOOD_MOOR, NO_CHARACTER)).toBeNull()
    expect(lootAlert(0, dropped({ id: 4, code: 'cap', quality: 6 }), 'notable', BLOOD_MOOR, NO_CHARACTER)).toBeNull()
    expect(lootAlert(0, dropped({ id: 4, code: 'cap', quality: 6 }), 'valuable', BLOOD_MOOR, NO_CHARACTER)).toMatchObject({ color: 'yellow' })
    expect(lootAlert(0, dropped({ id: 5, code: 'cm1', quality: 4 }), 'valuable', BLOOD_MOOR, NO_CHARACTER)).toMatchObject({ detail: 'Charm · Blood Moor', color: 'blue' })
    expect(lootAlert(0, dropped({ id: 2, code: 'cap', quality: 7 }), 'runes', BLOOD_MOOR, NO_CHARACTER)).toBeNull()
    expect(lootAlert(0, dropped({ id: 6, code: 'hp1', quality: 2 }), 'valuable', BLOOD_MOOR, NO_CHARACTER)).toBeNull()
  })

  it('by default announces what helps the character and says why', () => {
    expect(lootAlert(0, dropped({ id: 1, code: 'r07' }), 'smart', BLOOD_MOOR, coldSorc)).toEqual({ title: 'Tal Rune', detail: 'For Spirit · 1/4 runes · Blood Moor', color: 'orange' })
    expect(lootAlert(0, dropped({ id: 2, code: 'gpw' }), 'smart', BLOOD_MOOR, coldSorc)).toMatchObject({ detail: 'In your shield: All Resistances +19 · Blood Moor', color: 'white' })
    expect(lootAlert(0, dropped({ id: 3, code: 'ne1', quality: 4 }), 'smart', BLOOD_MOOR, coldSorc)).toBeNull()
    expect(lootAlert(0, dropped({ id: 4, code: 'hp5' }), 'smart', BLOOD_MOOR, coldSorc)).toBeNull()
    expect(lootAlertsPlugin.settings?.[0]).toMatchObject({ key: 'level', default: 'smart' })
  })

  it('shows each dropped item once and nothing after the plugin is turned off', async () => {
    const listeners = new Set<(ev: ServerEvent) => void>()
    const shown: PluginToast[] = []
    const session = { phase: 'ingame', world: { areaId: BLOOD_MOOR }, loginHost: null, getSnapshot: () => ({}), onServerEvent: (cb: (ev: ServerEvent) => void) => (listeners.add(cb), () => listeners.delete(cb)), onStateChange: () => () => {} } as unknown as PluginSessionView
    const store = { map: new Map<string, string>(), getItem(k: string) { return this.map.get(k) ?? null }, setItem(k: string, v: string) { this.map.set(k, v) }, removeItem(k: string) { this.map.delete(k) } }
    const host = new PluginHost({ plugins: [lootAlertsPlugin], configStore: new PluginConfigStore([lootAlertsPlugin], { storage: store }), session, toolbar: { setPluginsButtonState() {}, addContribution: () => () => {} }, autoStart: false, notify: { show: (t) => void shown.push(t) } })
    await host.start()
    await host.setEnabled('loot-alerts', true)
    const drop = { type: 'ItemEvent', action: 0, container: 'ground', item: { id: 9, code: 'r01', quality: 2 } } as unknown as ServerEvent
    listeners.forEach((cb) => {
      cb(drop)
      cb(drop)
    })
    expect(shown.map((t) => t.title)).toEqual(['El Rune'])
    await host.setEnabled('loot-alerts', false)
    listeners.forEach((cb) => cb({ ...drop, item: { id: 10, code: 'r02' } } as unknown as ServerEvent))
    expect(shown).toHaveLength(1)
  })
})
