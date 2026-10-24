/**
 * Issue #1355 — server NpcBuy/NpcSell/NpcGamble prices use the shared D2Common
 * #10107 formula (quality, clvl, reduced prices) instead of base cost / fixed /2.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface VendorEntry {
  unitId: number
  code: string
  cost: number
  rawItemData?: unknown
}
interface PlayerRecord {
  gold: number
  goldBank: number
  level: number
  activeNpcId: number | undefined
  activeVendorMode: 'trade' | 'gamble' | null
  vendorPools: Map<number, VendorEntry[]>
  items: { unitId: number; cost: number; rawItemData?: unknown; location: string }[]
}

function setup(seed: number, level = 20): {
  game: GameInstance
  playerId: number
  npcId: number
  record: PlayerRecord
  npc: { hcIdx: number; vendorPool: VendorEntry[] }
} {
  const game = new GameInstance({ seed, difficulty: 0, areaId: 1 })
  const playerId = game.connectPlayer({
    charClass: 'pal',
    name: 'Pricer',
    x: 10,
    y: 10,
    areaId: 1,
    level,
  } as never)
  const record = (game as unknown as { players: Map<number, PlayerRecord> }).players.get(playerId)!
  record.gold = 1_000_000
  record.level = level
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
  return { game, playerId, npcId, record, npc }
}

function priceOf(
  game: GameInstance,
  record: PlayerRecord,
  npc: { hcIdx: number },
  entry: VendorEntry,
  type: 0 | 1 | 2 | 3,
): number {
  return (game as unknown as {
    serverItemPrice113c: (
      p: PlayerRecord,
      npcClass: number,
      e: VendorEntry,
      t: number,
    ) => number
  }).serverItemPrice113c(record, npc.hcIdx, entry, type)
}

describe('issue #1355 vendor pricing', () => {
  it('stocks items at the 1.13c #10107 buy price and charges that price', () => {
    const { game, playerId, npcId, record, npc } = setup(1355)
    const pool = record.vendorPools.get(npcId)!
    expect(pool.length).toBeGreaterThan(0)
    const item = pool[0]!
    expect(item.cost).toBe(priceOf(game, record, npc, item, 0))

    const goldBefore = record.gold
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: item.unitId, cost: 0 } as never)
    game.stepFrames(1)
    expect(record.gold).toBe(goldBefore - item.cost)
  })

  it('prices items by quality/affixes rather than the base cost alone', () => {
    const { game, record, npc, npcId } = setup(1356)
    const pool = record.vendorPools.get(npcId)!
    const prices = new Set(pool.map((entry) => entry.cost))
    expect(prices.size).toBeGreaterThan(1)
    const magic = pool.find((entry) => (entry.rawItemData as { quality?: number })?.quality === 4)
    if (magic) {
      expect(magic.cost).toBe(priceOf(game, record, npc, magic, 0))
    }
  })

  it('gamble prices scale with character level', () => {
    const { game, playerId, record, npc } = setup(1357, 20)
    const gheedId = game.spawnMonster({
      classId: 147,
      name: 'Gheed',
      x: 10,
      y: 11,
      areaId: 1,
      isNpc: true,
      isVendor: true,
    })
    const gheed = (game as unknown as {
      monsters: Map<number, { hcIdx: number; vendorPool: VendorEntry[] }>
    }).monsters.get(gheedId)!
    record.activeNpcId = gheedId
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId: gheedId, action: 'gamble' } as never)
    game.stepFrames(1)
    game.drainEvents(playerId)
    const pool = record.vendorPools.get(gheedId)!
    expect(pool.length).toBeGreaterThan(0)
    const ring = pool.find((entry) => entry.code !== 'rin' && entry.code !== 'amu') ?? pool[0]!
    record.level = 20
    const low = priceOf(game, record, gheed, ring, 2)
    record.level = 60
    const high = priceOf(game, record, gheed, ring, 2)
    expect(high).toBeGreaterThanOrEqual(low)
    expect(high).not.toBe(low)
  })

  it('applies item_reducedprices to the server price', () => {
    const { game, record, npc, npcId } = setup(1358)
    const item = record.vendorPools.get(npcId)![0]!
    const full = priceOf(game, record, npc, item, 0)
    record.items.push({
      unitId: 9999,
      cost: 0,
      location: 'equipped',
      rawItemData: undefined,
      // STAT_ITEM_REDUCEDPRICES = 87
      ...({ stats: new Map([[87, 25]]), socketedItems: [] } as object),
    })
    const reduced = priceOf(game, record, npc, item, 0)
    expect(reduced).toBeLessThan(full)
  })

  it('uses the #10107 sell formula instead of cost/2', () => {
    const { game, playerId, npcId, record, npc } = setup(1359)
    const item = record.vendorPools.get(npcId)![0]!
    const buy = priceOf(game, record, npc, item, 0)
    const sell = priceOf(game, record, npc, item, 1)
    expect(sell).toBeGreaterThanOrEqual(1)
    expect(sell).not.toBe(Math.floor(buy / 2))

    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: item.unitId, cost: 0 } as never)
    game.stepFrames(1)
    const bought = record.items[record.items.length - 1]!
    record.gold = 0
    record.goldBank = 0
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: bought.unitId } as never)
    game.stepFrames(1)
    expect(record.gold).toBe(sell)
  })
})