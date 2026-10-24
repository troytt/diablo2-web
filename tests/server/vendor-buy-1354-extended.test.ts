/**
 * Issue #1354 follow-up — closed trade window must reject NpcBuy.
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
  socketedItems: unknown[]
}

function item(id: number): Entry {
  return {
    unitId: id, code: 'cap', name: 'Cap', quality: 2, level: 1,
    location: 'vendor', x: 0, y: 0, width: 1, height: 1, areaId: 1,
    ownerId: 0, bodyLoc: 0, storePage: 1, cost: 100, gamble: false,
    identified: true, ethereal: false, socketed: false, totalSockets: 0,
    durability: 10, maxDurability: 10, quantity: 1,
    stats: new Map(), socketedItems: [],
  }
}

describe('issue #1354 trade window validation', () => {
  it('rejects NpcBuy while the vendor window is closed', () => {
    const game = new GameInstance({ seed: 1354, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Buyer', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, {
        gold: number
        activeNpcId: number | undefined
        activeVendorMode: 'trade' | 'gamble' | null
        vendorPools: Map<number, Entry[]>
      }>
    }).players.get(playerId)!
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    player.gold = 1000
    player.vendorPools.set(npcId, [item(9501)])

    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9501, cost: 0 })
    game.stepFrames(1)
    expect(player.gold).toBe(1000)
    expect(player.vendorPools.get(npcId)).toHaveLength(1)

    player.activeNpcId = npcId
    player.activeVendorMode = 'trade'
    game.enqueueCommand(playerId, { type: 'NpcBuy', npcId, itemId: 9501, cost: 0 })
    game.stepFrames(1)
    expect(player.gold).toBeLessThan(1000)
  })

  it('isolates simultaneous multi-player gamble pools and prevents cross-player gamble purchases', () => {
    const game = new GameInstance({ seed: 13549, areaId: 1, maxPlayers: 8 })
    const p1 = game.connectPlayer({ charClass: 'pal', name: 'P1', x: 10, y: 10, areaId: 1 })
    const p2 = game.connectPlayer({ charClass: 'sor', name: 'P2', x: 10, y: 11, areaId: 1 })
    const players = (game as unknown as {
      players: Map<number, {
        gold: number
        level: number
        items: Entry[]
        vendorPools: Map<number, Entry[]>
      }>
    }).players
    const rec1 = players.get(p1)!
    const rec2 = players.get(p2)!
    rec1.gold = 500_000
    rec2.gold = 500_000
    rec1.level = 20
    rec2.level = 20

    const gheedId = game.spawnMonster({
      classId: 147, name: 'Gheed', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })

    // Both players open gamble windows with Gheed
    game.enqueueCommand(p1, { type: 'NpcAction', npcId: gheedId, action: 'gamble' } as never)
    game.enqueueCommand(p2, { type: 'NpcAction', npcId: gheedId, action: 'gamble' } as never)
    game.stepFrames(1)

    const pool1 = rec1.vendorPools.get(gheedId)!
    const pool2 = rec2.vendorPools.get(gheedId)!
    expect(pool1.length).toBeGreaterThan(0)
    expect(pool2.length).toBeGreaterThan(0)
    const p1TargetId = pool1[0]!.unitId
    const p2TargetId = pool2[0]!.unitId
    expect(p1TargetId).not.toBe(p2TargetId)

    // P1 refreshes gamble window; P2's gamble pool and gambleSourceItems must remain intact
    game.enqueueCommand(p1, { type: 'NpcAction', npcId: gheedId, action: 'gamble' } as never)
    game.stepFrames(1)
    const pool1Refreshed = rec1.vendorPools.get(gheedId)!
    const p1NewTargetId = pool1Refreshed[0]!.unitId

    // P2 tries to gamble P1's gamble item: must be rejected without deducting P2's gold
    const p2GoldBefore = rec2.gold
    game.enqueueCommand(p2, { type: 'NpcBuy', npcId: gheedId, itemId: p1NewTargetId, gamble: true, cost: 0 })
    game.stepFrames(1)
    expect(rec2.gold).toBe(p2GoldBefore)
    expect(pool1Refreshed.some((e) => e.unitId === p1NewTargetId)).toBe(true)

    // P2 gambles their own item: succeeds even after P1 refreshed their gamble pool
    game.enqueueCommand(p2, { type: 'NpcBuy', npcId: gheedId, itemId: p2TargetId, gamble: true, cost: 0 })
    game.stepFrames(1)
    expect(rec2.gold).toBeLessThan(p2GoldBefore)
    expect(rec2.vendorPools.get(gheedId)!.some((e) => e.unitId === p2TargetId)).toBe(false)
  })
})