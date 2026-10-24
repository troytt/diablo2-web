/**
 * Issue #1354 — server-authoritative NpcBuy: ignore client cost, atomic inventory
 * + gold checks, remove non-permanent stock, validate trade context, per-player shops.
 */
import { describe, expect, it } from 'vitest'
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
  socketedItems: unknown[]
  permStore?: boolean
}

function connect(game: GameInstance, name: string, x = 10, y = 10): number {
  return game.connectPlayer({ charClass: 'pal', name, x, y, areaId: 1 })
}

function playerRecord(game: GameInstance, id: number): {
  gold: number
  goldBank: number
  items: unknown[]
  activeNpcId: number | undefined
  activeVendorMode: 'trade' | 'gamble' | null
  vendorPools: Map<number, VendorEntry[]>
} {
  return (game as unknown as {
    players: Map<number, {
      gold: number
      goldBank: number
      items: unknown[]
      activeNpcId: number | undefined
      activeVendorMode: 'trade' | 'gamble' | null
      vendorPools: Map<number, VendorEntry[]>
    }>
  }).players.get(id)!
}

function vendor(game: GameInstance, x = 11, y = 10): {
  npc: { vendorPool: VendorEntry[] }
  id: number
} {
  const id = game.spawnMonster({
    classId: 154,
    name: 'Charsi',
    x,
    y,
    areaId: 1,
    isNpc: true,
    isVendor: true,
  })
  return {
    id,
    npc: (game as unknown as { monsters: Map<number, { vendorPool: VendorEntry[] }> }).monsters.get(id)!,
  }
}

function entry(unitId: number, cost: number, permStore = false): VendorEntry {
  return {
    unitId,
    code: 'cap',
    name: 'Cap',
    quality: 2,
    level: 1,
    location: 'vendor',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    areaId: 1,
    ownerId: 0,
    bodyLoc: 0,
    storePage: 1,
    cost,
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
    permStore,
  }
}

describe('issue #1354 NpcBuy atomicity and stock', () => {
  it('ignores the client price and deducts the server-owned cost', () => {
    const game = new GameInstance({ seed: 1354, areaId: 1 })
    const playerId = connect(game, 'Buyer')
    const p = playerRecord(game, playerId)
    p.gold = 1000
    const { npc, id: npcId } = vendor(game)
    npc.vendorPool = [entry(9001, 500)]
    p.activeNpcId = npcId
    p.activeVendorMode = 'trade'
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9001, cost: 0 })
    game.stepFrames(1)
    expect(p.gold).toBe(500)
    expect(p.items.filter((it) => (it as { code?: string }).code === 'cap').length).toBe(1)
  })

  it('does not deduct gold when the inventory is full', () => {
    const game = new GameInstance({ seed: 1355, areaId: 1 })
    const playerId = connect(game, 'Full')
    const p = playerRecord(game, playerId)
    p.gold = 1000
    for (let i = 0; i < 40; i++) {
      p.items.push({
        unitId: 10000 + i,
        code: 'cap',
        width: 1,
        height: 1,
        location: 'inventory',
        x: i % 10,
        y: Math.floor(i / 10),
      })
    }
    const { npc, id: npcId } = vendor(game)
    npc.vendorPool = [entry(9101, 500)]
    p.activeNpcId = npcId
    p.activeVendorMode = 'trade'
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9101, cost: 0 })
    game.stepFrames(1)
    expect(p.gold).toBe(1000)
    expect((game as unknown as { monsters: Map<number, { vendorPool: VendorEntry[] }> }).monsters.get(npcId)!.vendorPool)
      .toHaveLength(1)
  })

  it('removes non-permanent stock and rejects a second purchase of the same item', () => {
    const game = new GameInstance({ seed: 1356, areaId: 1 })
    const playerId = connect(game, 'Duplicate')
    const p = playerRecord(game, playerId)
    p.gold = 5000
    const { npc, id: npcId } = vendor(game)
    npc.vendorPool = [entry(9201, 100)]
    p.activeNpcId = npcId
    p.activeVendorMode = 'trade'
    game.drainEvents(playerId)
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9201, cost: 0 })
    game.stepFrames(1)
    expect(npc.vendorPool).toHaveLength(0)
    expect(
      game.drainEvents(playerId).some(
        (e) => e.type === 'UnitRemove' && (e as { id?: number }).id === 9201,
      ),
    ).toBe(true)
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9201, cost: 0 })
    game.stepFrames(1)
    expect(p.gold).toBe(4900)
  })

  it('keeps permanent stock available across purchases', () => {
    const game = new GameInstance({ seed: 1357, areaId: 1 })
    const playerId = connect(game, 'Potions')
    const p = playerRecord(game, playerId)
    p.gold = 1000
    const { npc, id: npcId } = vendor(game)
    npc.vendorPool = [entry(9301, 50, true)]
    p.activeNpcId = npcId
    p.activeVendorMode = 'trade'
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9301, cost: 0 })
    game.stepFrames(1)
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9301, cost: 0 })
    game.stepFrames(1)
    expect(p.gold).toBe(900)
    expect(npc.vendorPool).toHaveLength(1)
  })

  it('rejects purchases through a different/far NPC and keeps per-player shops separate', () => {
    const game = new GameInstance({ seed: 1358, areaId: 1, maxPlayers: 8 })
    const p1 = connect(game, 'One', 10, 10)
    const p2 = connect(game, 'Two', 10, 11)
    const a = playerRecord(game, p1)
    const b = playerRecord(game, p2)
    a.gold = 1000
    b.gold = 1000
    const { npc, id: npcId } = vendor(game, 11, 10)
    npc.vendorPool = [entry(9401, 100)]
    a.activeNpcId = 999
    game.enqueueCommand(p1, { type: 'NpcBuy', npcId, itemId: 9401, cost: 0 })
    game.stepFrames(1)
    expect(a.gold).toBe(1000)

    a.activeNpcId = npcId
    a.activeVendorMode = 'trade'
    b.activeNpcId = npcId
    b.activeVendorMode = 'trade'
    a.vendorPools.set(npcId, [entry(9402, 100)])
    b.vendorPools.set(npcId, [entry(9403, 100)])
    game.enqueueCommand(p1, { type: 'NpcBuy', npcId, itemId: 9402, cost: 0 })
    game.stepFrames(1)
    expect(a.gold).toBe(900)
    expect(a.vendorPools.get(npcId)).toHaveLength(0)
    expect(b.vendorPools.get(npcId)).toHaveLength(1)
  })
})