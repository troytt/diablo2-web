/**
 * Issue #1355 follow-up — repair-all uses D2Common #10071 and reduced-price
 * context matches the client's active weapon set.
 */
import { describe, expect, it } from 'vitest'
import { itemToTransactionCostInput } from '../../src/client/ui-model/transaction-cost-input.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import {
  computeGambleBaseCost113c,
  computeRepairAllCost113c,
  computeTransactionCost113c,
  getCanonicalTransactionCostTables,
  type TransactionCostContext,
  type TransactionCostInput,
} from '../../src/common/items/transaction-cost.ts'
import { generateGambleInventory } from '../../src/common/items/vendor-generator.ts'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { VendorNpcId } from '../../src/common/units/npc-table.ts'
import type { ItemData } from '../../src/netproto/index.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function equip(unitId: number, bodyLoc: number, durability: number, maxDurability: number, reduced = 0) {
  return {
    unitId, code: 'cap', name: 'Cap', quality: 2, level: 1, location: 'equipped',
    x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: 1, bodyLoc,
    storePage: 0, cost: 100, gamble: false, identified: true, ethereal: false,
    socketed: false, totalSockets: 0, durability, maxDurability, quantity: 1,
    stats: new Map(reduced > 0 ? [[87, reduced]] : []), socketedItems: [],
  }
}

describe('issue #1355 repair-all and reduced prices', () => {
  it('charges exactly the #10071 repair-all total and repairs every equipped item', () => {
    const game = new GameInstance({ seed: 1355, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Repair', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, {
        gold: number
        activeNpcId: number | undefined
        activeVendorMode: 'trade' | 'gamble' | null
        items: ReturnType<typeof equip>[]
      }>
    }).players.get(playerId)!
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    const weapon = equip(9001, 4, 0, 10)
    const shield = equip(9002, 5, 5, 10)
    player.items.push(weapon, shield)
    player.gold = 100_000
    player.activeNpcId = npcId
    player.activeVendorMode = 'trade'

    const internal = game as unknown as {
      transactionInputFromEntry: (item: unknown) => TransactionCostInput
      transactionCostContext: (player: unknown, npcClass: number) => unknown
    }
    const slots: (TransactionCostInput | null)[] = new Array(13).fill(null)
    for (const item of player.items) {
      if (item.location === 'equipped' && item.bodyLoc > 0 && item.bodyLoc < slots.length) {
        slots[item.bodyLoc] = internal.transactionInputFromEntry(item)
      }
    }
    const expected = computeRepairAllCost113c(
      slots,
      internal.transactionCostContext(player, 154) as never,
    )
    expect(expected).toBeGreaterThan(0)

    game.enqueueCommand(playerId, { type: 'NpcRepairAll', npcId })
    game.stepFrames(1)
    expect(player.gold).toBe(100_000 - expected)
    expect(weapon.durability).toBe(10)
    expect(shield.durability).toBe(10)
  })

  it('counts reduced-price stats from the active weapon set only', () => {
    const game = new GameInstance({ seed: 1356, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Prices', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, { items: ReturnType<typeof equip>[] }>
    }).players.get(playerId)!
    player.items.push(equip(1, 4, 10, 10, 10))
    player.items.push(equip(2, 11, 10, 10, 50))
    const reduced = (game as unknown as {
      transactionCostContext: (player: unknown, npcClass: number) => { playerReducedPricesPct: number }
    }).transactionCostContext(player, 154).playerReducedPricesPct
    expect(reduced).toBe(10)
  })

  it('syncs rawItemData durability on repair so repeat repair does not double-charge', () => {
    const game = new GameInstance({ seed: 1357, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'SyncDur', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, {
        gold: number
        activeNpcId: number | undefined
        activeVendorMode: 'trade' | 'gamble' | null
        items: Record<string, any>[]
      }>
    }).players.get(playerId)!
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    const helm = {
      ...equip(9101, 1, 2, 12),
      rawItemData: {
        id: 9101, itemId: 9101, code: 'cap', version: 101, quality: 2,
        identified: true, ethereal: false, starterItem: false, isEar: false,
        defense: 5, durability: 2, curDurability: 2, maxDurability: 12,
        stats: [], runewordStats: [],
      },
    }
    player.items.push(helm)
    player.gold = 50_000
    player.activeNpcId = npcId
    player.activeVendorMode = 'trade'

    game.enqueueCommand(playerId, {
      type: 'NpcRepairItem', npcId, itemId: 9101, itemMode: 1, durability: 2,
    })
    game.stepFrames(1)
    const goldAfterFirst = player.gold
    expect(goldAfterFirst).toBeLessThan(50_000)
    expect(helm.durability).toBe(12)
    expect(helm.rawItemData.durability).toBe(12)
    expect(helm.rawItemData.curDurability).toBe(12)

    // Repeat single-item repair or repair-all must charge 0 gold
    game.enqueueCommand(playerId, {
      type: 'NpcRepairItem', npcId, itemId: 9101, itemMode: 1, durability: 12,
    })
    game.enqueueCommand(playerId, { type: 'NpcRepairAll', npcId })
    game.stepFrames(1)
    expect(player.gold).toBe(goldAfterFirst)
  })

  it('refills throwing weapon stack (Items.txt maxStack + stat 254) and recharges stat 204 skills on both single repair and repair-all', () => {
    const game = new GameInstance({ seed: 1358, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'ama', name: 'ThrowCharge', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, {
        gold: number
        activeNpcId: number | undefined
        activeVendorMode: 'trade' | 'gamble' | null
        items: Record<string, any>[]
      }>
    }).players.get(playerId)!
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    // Javelin (`jav`, Weapons.txt maxStack = 60) + extra stack +20 (stat 254) => target 80
    const javelin = {
      ...equip(9201, 4, 6, 6),
      code: 'jav',
      name: 'Javelin',
      quantity: 15,
      stats: new Map([[254, 20]]),
      rawItemData: {
        id: 9201, itemId: 9201, code: 'jav', version: 101, quality: 4,
        identified: true, ethereal: false, starterItem: false, isEar: false,
        durability: 6, curDurability: 6, maxDurability: 6, quantity: 15,
        magicPrefixId: 0, magicSuffixId: 0,
        stats: [{ statId: 254, param: 0, value: 20 }],
        runewordStats: [],
      },
    }
    // Amulet with Teleport level 1 charges (skillId 54 -> param = (54 << 6) | 1 = 3457, 5/20 charges)
    const chargedParam = (54 << 6) | 1
    const depletedValue = (20 << 8) | 5
    const fullChargeValue = (20 << 8) | 20
    const amulet = {
      ...equip(9202, 2, 0, 0),
      code: 'amu',
      name: 'Amulet',
      durability: 0,
      maxDurability: 0,
      stats: new Map([[204, depletedValue]]),
      rawItemData: {
        id: 9202, itemId: 9202, code: 'amu', version: 101, quality: 4,
        identified: true, ethereal: false, starterItem: false, isEar: false,
        magicPrefixId: 0, magicSuffixId: 0,
        stats: [{ statId: 204, param: chargedParam, value: depletedValue }],
        runewordStats: [],
      },
    }
    player.items.push(javelin, amulet)
    player.gold = 500_000
    player.activeNpcId = npcId
    player.activeVendorMode = 'trade'

    // Single-item repair on javelin (even though durability 6/6 is full!)
    game.enqueueCommand(playerId, {
      type: 'NpcRepairItem', npcId, itemId: 9201, itemMode: 1, durability: 6,
    })
    game.stepFrames(1)
    expect(javelin.quantity).toBe(80)
    expect(javelin.rawItemData.quantity).toBe(80)
    const goldAfterJav = player.gold
    expect(goldAfterJav).toBeLessThan(500_000)

    // Repair-all restores the amulet's Teleport charges (5 -> 20)
    game.enqueueCommand(playerId, { type: 'NpcRepairAll', npcId })
    game.stepFrames(1)
    expect(amulet.rawItemData.stats[0].value).toBe(fullChargeValue)
    expect(amulet.stats.get(204)).toBe(fullChargeValue)
    const goldAfterAmu = player.gold
    expect(goldAfterAmu).toBeLessThan(goldAfterJav)

    // Subsequent repair-all costs 0 because both stack and charges are full
    game.enqueueCommand(playerId, { type: 'NpcRepairAll', npcId })
    game.stepFrames(1)
    expect(player.gold).toBe(goldAfterAmu)
  })

  it('skips ethereal items on both single-item repair and repair-all without charging gold', () => {
    const game = new GameInstance({ seed: 1359, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'EthSkip', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, {
        gold: number
        activeNpcId: number | undefined
        activeVendorMode: 'trade' | 'gamble' | null
        items: Record<string, any>[]
      }>
    }).players.get(playerId)!
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    const ethHelm = {
      ...equip(9301, 1, 3, 7),
      ethereal: true,
      rawItemData: {
        id: 9301, itemId: 9301, code: 'cap', version: 101, quality: 2,
        identified: true, ethereal: true, starterItem: false, isEar: false,
        defense: 8, durability: 3, curDurability: 3, maxDurability: 7,
        stats: [], runewordStats: [],
      },
    }
    player.items.push(ethHelm)
    player.gold = 10_000
    player.activeNpcId = npcId
    player.activeVendorMode = 'trade'

    game.enqueueCommand(playerId, {
      type: 'NpcRepairItem', npcId, itemId: 9301, itemMode: 1, durability: 3,
    })
    game.enqueueCommand(playerId, { type: 'NpcRepairAll', npcId })
    game.stepFrames(1)
    expect(player.gold).toBe(10_000)
    expect(ethHelm.durability).toBe(3)
    expect(ethHelm.rawItemData.durability).toBe(3)
  })

  it('deduplicates unique charms by uniqueItemId (ignoring 0xfff and non-uniques), skips unidentified charms, and counts runewordStats', () => {
    const game = new GameInstance({ seed: 1360, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Charms', x: 10, y: 10, areaId: 1, level: 99 } as never)
    const player = (game as unknown as {
      players: Map<number, { level: number; items: Record<string, any>[] }>
    }).players.get(playerId)!
    player.level = 99
    // Equipped bow with Edge runeword (-15% vendor prices in runewordStats)
    player.items.push({
      ...equip(9401, 4, 20, 20, 0),
      code: 'sbw',
      rawItemData: {
        id: 9401, itemId: 9401, code: 'sbw', version: 101, quality: 2,
        identified: true, ethereal: false, starterItem: false, isEar: false,
        stats: [],
        runewordStats: [{ statId: 87, param: 0, value: 15 }],
      },
    })
    // Two identical Gheed's Fortune unique grand charms (quality 7, uniqueItemId 360): only counted once (+12)
    for (const unitId of [9402, 9403]) {
      player.items.push({
        ...equip(unitId, 0, 0, 0, 12),
        code: 'cm3',
        quality: 7,
        location: 'inventory',
        rawItemData: {
          id: unitId, itemId: unitId, code: 'cm3', version: 101, quality: 7,
          identified: true, ethereal: false, starterItem: false, isEar: false,
          uniqueItemId: 360,
          stats: [{ statId: 87, param: 0, value: 12 }],
          runewordStats: [],
        },
      })
    }
    // Unidentified Gheed's Fortune: must NOT be counted
    player.items.push({
      ...equip(9404, 0, 0, 0, 15),
      code: 'cm3',
      quality: 7,
      identified: false,
      location: 'inventory',
      rawItemData: {
        id: 9404, itemId: 9404, code: 'cm3', version: 101, quality: 7,
        identified: false, ethereal: false, starterItem: false, isEar: false,
        uniqueItemId: 361,
        stats: [{ statId: 87, param: 0, value: 15 }],
        runewordStats: [],
      },
    })
    // Two magic charms with sentinel uniqueItemId 0xfff: both must be counted (+3 + 4 = +7)
    for (const [unitId, val] of [[9405, 3], [9406, 4]] as const) {
      player.items.push({
        ...equip(unitId, 0, 0, 0, val),
        code: 'cm1',
        quality: 4,
        location: 'inventory',
        rawItemData: {
          id: unitId, itemId: unitId, code: 'cm1', version: 101, quality: 4,
          identified: true, ethereal: false, starterItem: false, isEar: false,
          uniqueItemId: 0xfff,
          stats: [{ statId: 87, param: 0, value: val }],
          runewordStats: [],
        },
      })
    }
    const reduced = (game as unknown as {
      transactionCostContext: (player: unknown, npcClass: number) => { playerReducedPricesPct: number }
    }).transactionCostContext(player, 154).playerReducedPricesPct
    expect(reduced).toBe(15 + 12 + 3 + 4)
  })

  it('matches client itemToTransactionCostInput + computeTransactionCost113c across buy, sell, gamble, and repair', () => {
    const game = new GameInstance({ seed: 1361, difficulty: 0, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Parity', x: 10, y: 10, areaId: 1, level: 35 } as never)
    const internal = game as unknown as {
      players: Map<number, {
        level: number
        questFlags: Uint16Array
        vendorPools: Map<number, Record<string, any>[]>
        items: Record<string, any>[]
      }>
      monsters: Map<number, { hcIdx: number }>
      serverEntryToItemData: (entry: unknown) => ItemData
      serverItemPrice113c: (player: unknown, npcClass: number, entry: unknown, type: 0 | 1 | 2 | 3) => number
      transactionCostContext: (player: unknown, npcClass: number) => TransactionCostContext
    }
    const player = internal.players.get(playerId)!
    player.level = 35
    const charsiId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId: charsiId, action: 'trade' } as never)
    game.stepFrames(1)
    const pool = player.vendorPools.get(charsiId)!
    expect(pool.length).toBeGreaterThan(0)
    const ctx = internal.transactionCostContext(player, 154)

    for (const entry of pool.slice(0, 12)) {
      const wireItem = internal.serverEntryToItemData(entry)
      const clientInput = itemToTransactionCostInput(wireItem, wireItem.socketedItems ?? [], 0)
      for (const txType of [0, 1, 2, 3] as const) {
        const clientCost = computeTransactionCost113c(
          itemToTransactionCostInput(wireItem, wireItem.socketedItems ?? [], txType),
          ctx,
          txType,
        )
        const serverCost = internal.serverItemPrice113c(player, 154, entry, txType)
        expect(serverCost).toBe(txType === 3 ? Math.max(0, clientCost) : Math.max(1, clientCost))
      }
      expect(clientInput.code).toBe(entry.code.trim())
    }

    // Gamble inventory items in vendor-generator scale `mysteryItem.value` with cLvl
    const tables = getEmbeddedDropTables()
    const costTables = getCanonicalTransactionCostTables()
    const lowGrid = generateGambleInventory({
      vendorId: VendorNpcId.GHEED,
      cLvl: 15,
      tables,
      rng: new D2Rng(4242),
    })
    const highGrid = generateGambleInventory({
      vendorId: VendorNpcId.GHEED,
      cLvl: 75,
      tables,
      rng: new D2Rng(4242),
    })
    const lowItem = lowGrid.list().find((p) => p.item.base.id !== 'rin' && p.item.base.id !== 'amu')!.item
    const highItem = highGrid.list().find((p) => p.item.base.id !== 'rin' && p.item.base.id !== 'amu')!.item
    expect(lowItem.value).toBe(computeGambleBaseCost113c(lowItem.base.id, 15, costTables))
    expect(highItem.value).toBe(computeGambleBaseCost113c(highItem.base.id, 75, costTables))
    expect(highItem.value).toBeGreaterThan(lowItem.value)
  })
})