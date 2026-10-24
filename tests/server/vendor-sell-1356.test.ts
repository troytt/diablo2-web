/**
 * Issue #1356 — NpcSell context/state validation, buyback stock and gold caps.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

interface Entry {
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
  vendorPools: Map<number, Entry[]>
  items: Entry[]
}

function entry(unitId: number, code: string, location = 'inventory', cost = 500): Entry {
  return {
    unitId,
    code,
    name: code,
    quality: 2,
    level: 1,
    location,
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
  }
}

function setup(seed: number): {
  game: GameInstance
  playerId: number
  record: PlayerRecord
  npcId: number
  npc: { hcIdx: number; vendorPool: Entry[] }
} {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Seller', x: 10, y: 10, areaId: 1 })
  const record = (game as unknown as { players: Map<number, PlayerRecord> }).players.get(playerId)!
  record.gold = 0
  record.goldBank = 0
  record.level = 1
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
    monsters: Map<number, { hcIdx: number; vendorPool: Entry[] }>
  }).monsters.get(npcId)!
  game.enqueueCommand(playerId, { type: 'NpcAction', npcId, action: 'trade' } as never)
  game.stepFrames(1)
  game.drainEvents(playerId)
  return { game, playerId, record, npcId, npc }
}

describe('issue #1356 NpcSell', () => {
  it('only sells inventory items and never quest items', () => {
    const { game, playerId, record, npcId } = setup(1356)
    record.items.push(entry(9001, 'cap', 'equipped'))
    record.items.push(entry(9002, 'box', 'inventory'))
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9001 } as never)
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9002 } as never)
    game.stepFrames(1)
    expect(record.gold).toBe(0)
    expect(record.items.some((it) => it.unitId === 9001)).toBe(true)
    expect(record.items.some((it) => it.unitId === 9002)).toBe(true)

    record.items.push(entry(9003, 'cap', 'inventory', 500))
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9003 } as never)
    game.stepFrames(1)
    expect(record.gold).toBe(125)
    expect(record.items.some((it) => it.unitId === 9003)).toBe(false)
  })

  it('rejects sale through another or distant NPC', () => {
    const { game, playerId, record, npcId } = setup(1357)
    record.items.push(entry(9101, 'cap', 'inventory', 500))
    record.activeNpcId = 999
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9101 } as never)
    game.stepFrames(1)
    expect(record.gold).toBe(0)

    record.activeNpcId = npcId
    record.items[0]!.x = 10
    // Move the NPC far away: the active trade window no longer passes the range check.
    const npc = (game as unknown as { monsters: Map<number, { x: number; y: number }> }).monsters.get(npcId)!
    npc.x = 120
    npc.y = 120
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9101 } as never)
    game.stepFrames(1)
    expect(record.gold).toBe(0)
  })

  it('adds sold items to that customer vendor stock for buyback', () => {
    const { game, playerId, record, npcId } = setup(1358)
    record.items.push(entry(9201, 'cap', 'inventory', 800))
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9201 } as never)
    game.stepFrames(1)
    const pool = record.vendorPools.get(npcId)!
    const buyback = pool.find((it) => it.unitId === 9201)
    expect(buyback).toBeDefined()
    expect(buyback!.cost).toBe(200)
    expect(buyback!.location).toBe('vendor')

    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9201, cost: 0 } as never)
    game.stepFrames(1)
    expect(record.gold).toBe(0)
    expect(record.items.some((it) => it.code === 'cap' && it.location === 'inventory')).toBe(true)
    expect(pool.some((it) => it.unitId === 9201)).toBe(false)
  })

  it('respects the inventory gold cap and overflows into the stash', () => {
    const { game, playerId, record, npcId } = setup(1359)
    record.gold = 9_900 // cap at level 1 = 10,000
    record.items.push(entry(9301, 'cap', 'inventory', 1_000))
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9301 } as never)
    game.stepFrames(1)
    expect(record.gold).toBe(10_000)
    expect(record.goldBank).toBe(150)
  })
})