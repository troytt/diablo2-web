import { describe, expect, it } from 'vitest'
import { beltColumnKinds, beltRefillPick } from '../../src/client/input/belt-refill.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { scrollsCarried, scrollSource, townPortalSource } from '../../src/client/input/town-portal.ts'
import type { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { BeltModel } from '../../src/common/items/belt-model.ts'

const beltWith = (beltCode: string, ...columns: (readonly string[])[]) => {
  const belt = new BeltModel()
  belt.setEquippedBelt(beltCode)
  columns.forEach((codes, col) => codes.forEach((code, row) => belt.setSlot(col, row, { code })))
  return belt
}
const potions = (...codes: string[]) => codes.map((code, index) => ({ itemId: 100 + index, code }))

describe('town portal source', () => {
  it('prefers a tome with charges, then a loose scroll', () => {
    expect(townPortalSource([{ id: 1, code: 'tsc' }, { id: 2, code: 'tbk ', quantity: 3 }])?.id).toBe(2)
    expect(townPortalSource([{ id: 1, code: 'tsc' }, { id: 2, code: 'tbk', quantity: 0 }])?.id).toBe(1)
    expect(townPortalSource([{ id: 2, code: 'tbk', stats: [{ statId: 70, value: 4 }] }])?.id).toBe(2)
    expect(townPortalSource([{ id: 2, code: 'tbk', quantity: 0 }, { id: 3, code: 'hp1' }])).toBeNull()
  })

  it('counts every scroll carried in tomes and loose, and finds one to read', () => {
    expect(scrollsCarried([{ id: 1, code: 'tsc' }, { id: 2, code: 'tbk ', quantity: 3 }, { id: 3, code: 'tsc' }], 'tbk', 'tsc')).toEqual({ tome: true, scrolls: 5 })
    expect(scrollsCarried([{ id: 3, code: 'hp1' }], 'ibk', 'isc')).toEqual({ tome: false, scrolls: 0 })
    expect(scrollSource([{ id: 4, code: 'ibk', quantity: 0 }, { id: 5, code: 'isc' }], 'ibk', 'isc')?.id).toBe(5)
  })
})

describe('belt refill pick', () => {
  it('tops up a column holding the same kind of potion', () => {
    expect(beltRefillPick(beltWith('mbl', ['hp1'], ['mp1', 'mp1', 'mp1']), potions('mp2', 'hp3'))).toBe(101)
  })

  it('gives an empty column a kind the belt is missing first, then anything', () => {
    const belt = beltWith('lbl', ['hp1', 'hp1'], ['mp1'])
    expect(beltRefillPick(belt, potions('hp2', 'rvs'))).toBe(101)
    expect(beltRefillPick(belt, potions('hp2', 'hp3'))).toBe(100)
  })

  it('refills an emptied column with the kind it held before', () => {
    const belt = beltWith('', ['hp1'], ['hp1'], ['hp1'], ['mp1'])
    const kinds = beltColumnKinds(belt)
    belt.setSlot(3, 0, null)
    expect(beltRefillPick(belt, potions('hp2', 'mp2'), kinds)).toBe(101)
    belt.setSlot(3, 0, { code: 'mp1' })
    belt.setSlot(1, 0, null)
    expect(beltRefillPick(belt, potions('mp2', 'hp2'), beltColumnKinds(belt, kinds))).toBe(101)
  })

  it('does nothing when the belt is full or the inventory has no potions', () => {
    expect(beltRefillPick(beltWith('', ['hp1'], ['hp1'], ['mp1'], ['rvs']), potions('hp1'))).toBeNull()
    expect(beltRefillPick(beltWith('mbl', ['hp1']), [])).toBeNull()
  })
})

const putItem = (world: ClientWorld, container: 'belt' | 'inventory', id: number, code: string, quantity?: number) =>
  world.apply({
    type: 'ItemEvent',
    action: 0,
    container,
    item: { id, itemId: id, code, rawCode: `${code} `, container, action: 0, flags: 0x00200010, rawFlags: 0x00200010, gridX: 0, gridY: 0, x: 0, y: 0, ...(quantity === undefined ? {} : { quantity }) },
  })

const createSetup = () => {
  const world = new ClientWorld()
  world.apply({ type: 'UnitAssign', unit: { unitType: 0, id: 1, classId: 1, name: 'Hero', x: 5000, y: 5000 }, isSelf: true })
  const hudManager = new HudManager()
  hudManager.lang = 'ENG'
  const used: number[] = []
  const belted: number[] = []
  const hudModel = { useItem: (itemId: number) => void used.push(itemId), autoBeltItem: (itemId: number) => belted.push(itemId) > 0 } as unknown as HudModel
  const mapper = new CommandMapper({ world, hudManager, hudModel })
  const lastMessage = () => world.messageLogEntries.at(-1)?.text
  return { world, hudManager, mapper, used, belted, lastMessage }
}

describe('town portal key', () => {
  it('reads a tome on its key and leaves other keys alone', () => {
    const { world, mapper, used } = createSetup()
    mapper.assists.townPortalKey = 'G'
    putItem(world, 'inventory', 31, 'tsc')
    putItem(world, 'inventory', 32, 'tbk', 5)
    expect(mapper.assists.handleKey({ key: 'h' })).toBe(false)
    expect(mapper.assists.handleKey({ key: 'g' })).toBe(true)
    expect(mapper.assists.handleKey({ key: 'g', repeat: true })).toBe(true)
    expect(used).toEqual([32])
  })

  it('says so when there is nothing to read or you are in town', () => {
    const { world, mapper, used, lastMessage } = createSetup()
    mapper.assists.townPortalKey = 'G'
    mapper.assists.handleKey({ key: 'G' })
    expect(lastMessage()).toBe('No Town Portal scrolls')
    world.apply({ type: 'LoadAct', act: 0, areaId: 1, mapSeed: 1 } as never)
    putItem(world, 'inventory', 31, 'tsc')
    mapper.assists.handleKey({ key: 'G' })
    expect([used, lastMessage()]).toEqual([[], "You're already in town"])
  })
})

describe('belt refill in the command mapper', () => {
  it('moves one matching potion at a time and waits for the server', () => {
    const { world, hudManager, mapper, belted } = createSetup()
    mapper.assists.beltRefill = true
    hudManager.belt.setEquippedBelt('mbl')
    hudManager.belt.setSlot(0, 0, { code: 'hp1' })
    putItem(world, 'inventory', 81, 'hp2')
    putItem(world, 'inventory', 82, 'hp2')
    mapper.assists.refillBelt(1_000)
    mapper.assists.refillBelt(1_100)
    expect(belted).toEqual([81])
    world.apply({ type: 'ItemEvent', action: 0, container: 'belt', item: { id: 81, itemId: 81, code: 'hp2', rawCode: 'hp2 ', container: 'belt', action: 0, flags: 0x00200010, rawFlags: 0x00200010, gridX: 4, gridY: 0, x: 4, y: 0 } })
    hudManager.belt.setSlot(0, 1, { code: 'hp2' })
    mapper.assists.refillBelt(1_300)
    expect(belted).toEqual([81, 82])
  })

  it('stays off until switched on', () => {
    const { world, hudManager, mapper, belted } = createSetup()
    hudManager.belt.setEquippedBelt('mbl')
    hudManager.belt.setSlot(0, 0, { code: 'hp1' })
    putItem(world, 'inventory', 81, 'hp2')
    mapper.assists.refillBelt(1_000)
    expect(belted).toEqual([])
  })
})
