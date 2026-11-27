import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'
import { fitsInInventory, isWantedLoot, planRoom, type AutoLootRules, type JudgedItem } from '../../src/client/input/auto-loot.ts'
import type { Appraisal, LootTier } from '../../src/common/items/loot-appraisal.ts'

const NOTABLE: AutoLootRules = { mode: 'categories', runes: true, uniques: true, sets: true, charms: true, jewels: true, gems: false, rares: false }
const judged = (tier: LootTier, kind: Appraisal['kind'] = 'magic', locked = false): Appraisal => ({ tier, kind, score: 10, reason: '', locked })
const at = (gridX: number, gridY: number, invWidth: number, invHeight: number, appraisal = judged('junk'), id = gridY * 10 + gridX): JudgedItem => ({ id, gridX, gridY, invWidth, invHeight, appraisal })

describe('auto loot', () => {
  it('wants the chosen categories, and gems only when flawless or better', () => {
    expect((['rune', 'unique', 'set', 'charm', 'jewel'] as const).every((kind) => isWantedLoot(NOTABLE, { code: 'x' }, judged('keep', kind)))).toBe(true)
    expect((['gem', 'rare', 'magic', 'consumable'] as const).some((kind) => isWantedLoot(NOTABLE, { code: 'gpv' }, judged('great', kind)))).toBe(false)
    expect(isWantedLoot({ ...NOTABLE, gems: true }, { code: 'glr' }, judged('keep', 'gem'))).toBe(true)
    expect(isWantedLoot({ ...NOTABLE, gems: true }, { code: 'gcr' }, judged('keep', 'gem'))).toBe(false)
  })

  it('in smart mode wants what the judge rates highly enough, but never gold or supplies', () => {
    const good: AutoLootRules = { mode: 'smart', minTier: 'good' }
    expect([judged('good'), judged('great'), judged('keep'), judged('great', 'consumable')].map((appraisal) => isWantedLoot(good, { code: 'x' }, appraisal))).toEqual([true, true, false, false])
    expect(isWantedLoot({ mode: 'smart', minTier: 'great' }, { code: 'x' }, judged('good'))).toBe(false)
  })

  it('only picks up what the inventory has room for', () => {
    const fullButOneColumn = [...Array(9).keys()].map((x) => at(x, 0, 1, 4))
    expect(fitsInInventory(fullButOneColumn, 1, 3)).toBe(true)
    expect(fitsInInventory(fullButOneColumn, 2, 1)).toBe(false)
    expect(fitsInInventory([...fullButOneColumn, at(9, 1, 1, 1)], 1, 3)).toBe(false)
    expect(fitsInInventory([], 2, 4)).toBe(true)
  })

  it('makes room by moving one item first, then by dropping the least valuable unlocked items', () => {
    const scattered = [...[...Array(9).keys()].map((x) => at(x, 0, 1, 4, judged('keep'))), at(9, 1, 1, 1, judged('keep'))]
    expect(planRoom(scattered, 1, 3, judged('great'), true)).toEqual({ kind: 'move', itemId: 19, x: 9, y: 0 })
    const packed = [...Array(10).keys()].map((x) => at(x, 0, 1, 4, x === 3 ? judged('junk') : x === 5 ? judged('junk', 'charm', true) : judged('good'), x))
    expect(planRoom(packed, 1, 2, judged('great'), true)).toEqual({ kind: 'drop', itemIds: [3] })
    expect(planRoom(packed, 1, 2, judged('great'), false)).toBeNull()
    expect(planRoom(packed, 1, 2, judged('junk'), true)).toBeNull()
    expect(planRoom(packed, 2, 2, judged('great'), true)).toBeNull()
    const twoJunk = packed.map((item) => (item.id === 4 ? { ...item, appraisal: judged('keep') } : item))
    expect(planRoom(twoJunk, 2, 2, judged('great'), true)).toEqual({ kind: 'drop', itemIds: [3, 4] })
  })
})

describe('auto loot pickup in play', () => {
  const setup = () => {
    const world = new ClientWorld()
    world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 }, isSelf: true })
    const sent: ClientCommand[] = []
    const mapper = new CommandMapper({ world, hudManager: new HudManager(), sendCommand: (cmd) => sent.push(cmd) })
    mapper.assists.autoLootRules = NOTABLE
    const drop = (id: number, code: string, quality: number, invWidth = 1, invHeight = 1) =>
      world.apply({ type: 'ItemEvent', action: 0, container: 'ground', item: { id, itemId: id, code, rawCode: `${code} `, quality, invWidth, invHeight, stats: [], runewordStats: [], container: 'ground', action: 0, flags: 0x10, rawFlags: 0x10, x: 5001, y: 5000, worldX: 5001, worldY: 5000 } })
    return { world, mapper, drop, pickups: () => sent.flatMap((c) => (c.type === 'ItemPickup' ? [c.itemId] : [])) }
  }

  it('picks up a rune but leaves a magic sword', () => {
    const s = setup()
    s.drop(71, 'r08', 2)
    s.drop(72, 'lsd', 4, 1, 3)
    ;[1000, 1040, 1080].forEach((t) => s.mapper.assists.pickUpNearbyLoot(t))
    expect(s.pickups()).toEqual([71])
  })

  it('leaves a unique on the ground when the inventory is full', () => {
    const s = setup()
    ;[...Array(10).keys()].forEach((x) => s.world.containers.applyItemEvent(0x00, { id: 900 + x, itemId: 900 + x, code: 'tsc', quality: 2, invWidth: 1, invHeight: 4, gridX: x, gridY: 0, x, y: 0, container: 'inventory', location: 0 } as never, 'inventory', 1))
    s.drop(73, 'cap', 7, 2, 2)
    s.mapper.assists.pickUpNearbyLoot(1000)
    expect(s.pickups()).toEqual([])
  })

  it('in smart mode leaves junk for the character and picks up a rune it can use', () => {
    const s = setup()
    s.mapper.assists.autoLootRules = { mode: 'smart', minTier: 'good' }
    s.drop(74, 'lsd', 4, 1, 3)
    s.drop(75, 'r08', 2)
    ;[1000, 1040].forEach((t) => s.mapper.assists.pickUpNearbyLoot(t))
    expect(s.pickups()).toEqual([75])
  })

  it('waits for one item to land in the bag before reaching for the next, so the room count stays true', () => {
    const s = setup()
    s.drop(76, 'r08', 2)
    s.drop(77, 'r09', 2)
    ;[1000, 1040, 1080].forEach((t) => s.mapper.assists.pickUpNearbyLoot(t))
    expect(s.pickups()).toEqual([76])
    s.world.apply({ type: 'UnitRemove', unitType: 4, id: 76, unitId: 76 } as never)
    s.mapper.assists.pickUpNearbyLoot(1120)
    expect(s.pickups()).toEqual([76, 77])
  })

  it('holds off on items while something is on the cursor', () => {
    const s = setup()
    s.world.containers.applyItemEvent(0x05, { id: 950, itemId: 950, code: 'r10', quality: 2, invWidth: 1, invHeight: 1, container: 'cursor', location: 4 } as never, 'cursor', 1)
    s.drop(78, 'r08', 2)
    s.mapper.assists.pickUpNearbyLoot(1000)
    expect(s.pickups()).toEqual([])
  })
})
