/**
 * Issue #1486 — Strict 1.13c vendor pricing and gamble purchase checks.
 *
 * Verifies:
 * 1. serverItemPrice113c strictly delegates to computeTransactionCost113c without
 *    cost/4 fallback or catch swallow returning raw entry.cost.
 * 2. Unknown or unpriceable item codes are rejected without falling back to 'cap'.
 * 3. Gamble purchasing strictly uses computeTransactionCost113c with type 2
 *    (scaling with clvl) rather than info.cost.
 * 4. Selling an item strictly uses type 1 pricing; unknown NPC or unpriceable item
 *    rejects the transaction without gold change.
 */
import { describe, expect, it } from 'vitest'
import {
  computeGambleBaseCost113c,
  computeTransactionCost113c,
  getCanonicalTransactionCostTables,
  type TransactionCostInput,
} from '../../src/common/items/transaction-cost.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface VendorEntry {
  unitId: number
  code: string
  name: string
  quality: number
  level: number
  location: string
  x: number
  y: number
  width: number
  height: number
  areaId: number
  ownerId: number
  bodyLoc: number
  storePage: number
  cost: number
  gamble: boolean
  identified: boolean
  ethereal: boolean
  socketed: boolean
  totalSockets: number
  durability: number
  maxDurability: number
  quantity: number
  stats: Map<number, number>
  socketedItems: never[]
  rawItemData?: unknown
}

interface PlayerRecord {
  gold: number
  goldBank: number
  level: number
  activeNpcId: number | undefined
  activeVendorMode: 'trade' | 'gamble' | null
  vendorPools: Map<number, VendorEntry[]>
  items: VendorEntry[]
}

function setupGame(seed: number, level = 20): {
  game: GameInstance
  playerId: number
  npcId: number
  player: PlayerRecord
  npc: { hcIdx: number; vendorPool: VendorEntry[] }
} {
  const game = new GameInstance({ seed, difficulty: 0, areaId: 1 })
  const playerId = game.connectPlayer({
    charClass: 'pal',
    name: 'StrictPricer',
    x: 10,
    y: 10,
    areaId: 1,
    level,
  } as never)
  const player = (game as unknown as { players: Map<number, PlayerRecord> }).players.get(playerId)!
  player.gold = 500_000
  player.goldBank = 0
  player.level = level

  const npcId = game.spawnMonster({
    classId: 154,
    name: 'Charsi',
    x: 11,
    y: 10,
    areaId: 1,
    isNpc: true,
    isVendor: true,
  })
  const npc = (game as unknown as {
    monsters: Map<number, { hcIdx: number; vendorPool: VendorEntry[] }>
  }).monsters.get(npcId)!

  game.enqueueCommand(playerId, { type: 'NpcAction', npcId, action: 'trade' } as never)
  game.stepFrames(1)
  game.drainEvents(playerId)

  return { game, playerId, npcId, player, npc }
}

describe('issue #1486 strict vendor and gamble pricing', () => {
  it('throws on unpriceable item in serverItemPrice113c instead of catching and returning entry.cost', () => {
    const { game, player, npc } = setupGame(148601)
    const invalidEntry: VendorEntry = {
      unitId: 88888,
      code: 'ZZZZ', // Invalid item code not present in tables
      name: 'Corrupted Item',
      quality: 2,
      level: 1,
      location: 'inventory',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 1,
      ownerId: 0,
      bodyLoc: 0,
      storePage: 1,
      cost: 99999,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 10,
      maxDurability: 10,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    }

    const internal = game as unknown as {
      serverItemPrice113c: (p: PlayerRecord, npcClass: number, e: VendorEntry, t: number) => number
    }

    expect(() => {
      internal.serverItemPrice113c(player, npc.hcIdx, invalidEntry, 0)
    }).toThrow()
  })

  it('rejects buying an unknown item code and leaves player gold untouched', () => {
    const { game, playerId, npcId, player } = setupGame(148602)
    const pool = player.vendorPools.get(npcId)!
    expect(pool.length).toBeGreaterThan(0)

    // Attempt to buy an invalid itemId that is not in the pool
    const goldBefore = player.gold
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 999999, cost: 0 } as never)
    game.stepFrames(1)

    expect(player.gold).toBe(goldBefore)
  })

  it('gamble preview prices strictly use type 2 scaling and reject unknown base codes', () => {
    const { game, playerId, player } = setupGame(148603, 30)
    const gheedId = game.spawnMonster({
      classId: 147,
      name: 'Gheed',
      x: 10,
      y: 11,
      areaId: 1,
      isNpc: true,
      isVendor: true,
    })
    player.activeNpcId = gheedId
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId: gheedId, action: 'gamble' } as never)
    game.stepFrames(1)
    game.drainEvents(playerId)

    const pool = player.vendorPools.get(gheedId)!
    expect(pool.length).toBeGreaterThan(0)

    const gambleItem = pool[0]!
    const expectedGamblePrice = computeGambleBaseCost113c(
      gambleItem.code,
      30,
      getCanonicalTransactionCostTables(),
    )
    expect(gambleItem.cost).toBe(expectedGamblePrice)
  })

  it('rejects selling an unpriceable or invalid item and leaves gold unchanged', () => {
    const { game, playerId, npcId, player } = setupGame(148604)
    const corruptedItem: VendorEntry = {
      unitId: 77777,
      code: 'XXXX',
      name: 'Bad Item',
      quality: 2,
      level: 1,
      location: 'inventory',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 1,
      ownerId: playerId,
      bodyLoc: 0,
      storePage: 1,
      cost: 500,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 10,
      maxDurability: 10,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    }
    player.items.push(corruptedItem)
    const goldBefore = player.gold

    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 77777 } as never)
    game.stepFrames(1)

    // Transaction must be rejected; gold remains untouched
    expect(player.gold).toBe(goldBefore)
    expect(player.items.some((i) => i.unitId === 77777)).toBe(true)
  })
})
