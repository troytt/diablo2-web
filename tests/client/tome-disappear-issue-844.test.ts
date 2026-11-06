import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { decode0x7CUseSpecialItem } from '../../src/netproto/d2gs/s2c/items.ts'
import type { ItemContainer, ItemData } from '../../src/netproto/index.ts'

function makeTestItemData(overrides: Partial<ItemData> & Pick<ItemData, 'id' | 'code'>): ItemData {
  const { id, code, ...rest } = overrides
  const container: ItemContainer = rest.container ?? 'inventory'
  return {
    id,
    itemId: id,
    opcode: 0x9c,
    action: rest.action ?? 0x04,
    category: 0,
    flags: 0x10,
    rawFlags: 0x10,
    version: 101,
    location: container === 'ground' ? 3 : 0,
    container,
    bodyLoc: 0,
    equippedSlot: 0,
    gridX: rest.gridX ?? 0,
    gridY: rest.gridY ?? 0,
    storePage: 0,
    storagePage: 0,
    worldX: rest.worldX ?? 0,
    worldY: rest.worldY ?? 0,
    x: rest.x ?? rest.gridX ?? 0,
    y: rest.y ?? rest.gridY ?? 0,
    code,
    rawCode: code.padEnd(4, ' '),
    compact: false,
    simple: false,
    identified: true,
    socketed: false,
    ethereal: false,
    runeword: false,
    personalized: false,
    isEar: false,
    newItem: false,
    starterItem: false,
    broken: false,
    inSocket: false,
    equipped: false,
    socketedChildCount: 0,
    usedSockets: 0,
    totalSockets: 0,
    quality: 2,
    invWidth: rest.invWidth ?? 1,
    invHeight: rest.invHeight ?? 2,
    stats: rest.stats ?? [],
    setBonusStats: [],
    runewordStats: [],
    ...rest,
  }
}

describe('Issue #844: Tome of Identify (ibk) & Tome of Town Portal (tbk) disappearing after S2C 0x7C', () => {
  it('decodes S2C 0x7C UseSpecialItem per D2Game.dll 0x6fcac3b0 & D2Client.dll 0x6fb5d2a0 ([0x7C, unitType, itemId])', () => {
    // Wire packet sent by D2Game.dll 0x6fcac3b0: [0x7C, 0x04 (UNIT_ITEM), 0xbd, 0x02, 0x00, 0x00 (itemId=701)]
    const pkt = new Uint8Array([0x7c, 0x04, 0xbd, 0x02, 0x00, 0x00])
    const ev = decode0x7CUseSpecialItem(pkt)
    expect(ev).toEqual({
      type: 'UseSpecialItem',
      unitType: 4,
      id: 701,
    })
  })

  it('preserves Tome of Town Portal (tbk) and Tome of Identify (ibk) in inventory and HudModel after S2C 0x7C, walking/pruning, and portal area transition', () => {
    const world = new ClientWorld()
    const hudManager = new HudManager()
    const hudModel = new HudModel({ world, hudManager })

    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 2 }) // Blood Moor
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorceress',
        x: 500,
        y: 500,
        lifePct: 128,
        mode: 1,
      },
    })

    // Place Tome of Town Portal (tbk) at inventory (8, 0) and Tome of Identify (ibk) at (9, 0)
    world.apply({
      type: 'ItemEvent',
      action: 0x04, // PutInContainer
      container: 'inventory',
      item: makeTestItemData({
        id: 701,
        code: 'tbk',
        container: 'inventory',
        x: 8,
        y: 0,
        gridX: 8,
        gridY: 0,
        invWidth: 1,
        invHeight: 2,
        quantity: 20,
        stats: [{ statId: 70, value: 20, param: 0 }],
      }),
    })
    world.apply({
      type: 'ItemEvent',
      action: 0x04, // PutInContainer
      container: 'inventory',
      item: makeTestItemData({
        id: 702,
        code: 'ibk',
        container: 'inventory',
        x: 9,
        y: 0,
        gridX: 9,
        gridY: 0,
        invWidth: 1,
        invHeight: 2,
        quantity: 20,
        stats: [{ statId: 70, value: 20, param: 0 }],
      }),
    })

    hudModel.syncFromWorld()
    expect(world.containers.inventory.has(701)).toBe(true)
    expect(world.containers.inventory.has(702)).toBe(true)
    expect(hudManager.inventory.gridItems.some((p) => p.item.code === 'tbk')).toBe(true)
    expect(hudManager.inventory.gridItems.some((p) => p.item.code === 'ibk')).toBe(true)

    // Player uses Tome of Identify (702) and Tome of Town Portal (701); server sends S2C 0x7C for each
    const pktIbk = new Uint8Array([0x7c, 0x04, 0xbe, 0x02, 0x00, 0x00]) // itemId = 702
    const pktTbk = new Uint8Array([0x7c, 0x04, 0xbd, 0x02, 0x00, 0x00]) // itemId = 701
    world.apply(decode0x7CUseSpecialItem(pktIbk))
    world.apply(decode0x7CUseSpecialItem(pktTbk))

    // Inventory items must NEVER be instantiated as phantom world units at (0, 0)
    expect(world.getUnit('item', 701)).toBeUndefined()
    expect(world.getUnit('item', 702)).toBeUndefined()

    // Player walks / teleports around Blood Moor -> pruneStaleUnitsOutsideArea runs every 250ms
    world.pruneStaleUnitsOutsideArea(520, 520, 96)
    hudModel.syncFromWorld()

    expect(world.containers.inventory.has(701)).toBe(true)
    expect(world.containers.inventory.has(702)).toBe(true)
    expect(hudManager.inventory.gridItems.some((p) => p.item.code === 'tbk')).toBe(true)
    expect(hudManager.inventory.gridItems.some((p) => p.item.code === 'ibk')).toBe(true)

    // Player steps through Town Portal into Rogue Encampment (LoadAct 0x03 -> pruneNonSelfUnitsOnAreaTransition)
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 1 })
    hudModel.syncFromWorld()

    expect(world.containers.inventory.has(701)).toBe(true)
    expect(world.containers.inventory.has(702)).toBe(true)
    expect(hudManager.inventory.gridItems.some((p) => p.item.code === 'tbk')).toBe(true)
    expect(hudManager.inventory.gridItems.some((p) => p.item.code === 'ibk')).toBe(true)
  })

  it('never removes container-owned items on UnitRemove (0x0A) or generic unit events, while still removing genuine ground items', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x9999, areaId: 2 })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Hero',
        x: 300,
        y: 300,
        lifePct: 128,
        mode: 1,
      },
    })

    // Inventory tome (801) and ground potion (802)
    world.apply({
      type: 'ItemEvent',
      action: 0x04,
      container: 'inventory',
      item: makeTestItemData({
        id: 801,
        code: 'tbk',
        container: 'inventory',
        x: 0,
        y: 0,
        gridX: 0,
        gridY: 0,
        invWidth: 1,
        invHeight: 2,
      }),
    })
    world.apply({
      type: 'ItemEvent',
      action: 0x00,
      container: 'ground',
      item: makeTestItemData({
        id: 802,
        code: 'hp1',
        action: 0x00,
        container: 'ground',
        x: 305,
        y: 305,
        worldX: 305,
        worldY: 305,
        invWidth: 1,
        invHeight: 1,
      }),
    })

    // Spurious/generic UnitMode, StateSet, StateEnd, and UnitRemove targeting inventory item 801
    world.apply({ type: 'UnitMode', unitType: 4, id: 801, mode: 4 })
    world.apply({ type: 'StateSet', unit: { unitType: 4, id: 801 }, state: 0x36 })
    world.apply({ type: 'StateEnd', unit: { unitType: 4, id: 801 }, state: 0x36 })
    expect(world.getUnit('item', 801)).toBeUndefined()

    world.apply({ type: 'UnitRemove', unitType: 4, id: 801 })
    expect(world.containers.inventory.has(801)).toBe(true)
    expect(world.containers.allById.has(801)).toBe(true)

    // Genuine ground item 802 IS removed by UnitRemove (0x0A RemoveGroundUnit)
    expect(world.containers.ground.has(802)).toBe(true)
    expect(world.getUnit('item', 802)).toBeDefined()
    world.apply({ type: 'UnitRemove', unitType: 4, id: 802 })
    expect(world.containers.ground.has(802)).toBe(false)
    expect(world.containers.allById.has(802)).toBe(false)
    expect(world.getUnit('item', 802)).toBeUndefined()
  })
})
