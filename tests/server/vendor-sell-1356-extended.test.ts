/**
 * Issue #1356 follow-up — NpcSell requires an open trade window.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { getInventoryGoldLimit, getStashGoldLimit } from '../../src/common/items/inventory-model.ts'

describe('issue #1356 sell window validation', () => {
  it('rejects NpcSell when no trade window is open', () => {
    const game = new GameInstance({ seed: 1356, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Seller', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, { gold: number; items: unknown[]; activeNpcId: number | undefined }>
    }).players.get(playerId)!
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    player.items.push({
      unitId: 9601, code: 'cap', name: 'Cap', quality: 2, level: 1, location: 'inventory',
      x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: playerId, bodyLoc: 0,
      storePage: 0, cost: 500, gamble: false, identified: true, ethereal: false,
      socketed: false, totalSockets: 0, durability: 10, maxDurability: 10,
      quantity: 1, stats: new Map(), socketedItems: [],
    })
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9601 } as never)
    game.stepFrames(1)
    expect(player.gold).toBe(0)
    expect((player.items as { unitId: number }[]).some((it) => it.unitId === 9601)).toBe(true)
  })

  it('rejects the sale when both inventory and stash gold are full', () => {
    const game = new GameInstance({ seed: 13561, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Rich', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, { gold: number; goldBank: number; items: unknown[] }>
    }).players.get(playerId)!
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    player.items.push({
      unitId: 9611, code: 'cap', name: 'Cap', quality: 2, level: 1, location: 'inventory',
      x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: playerId, bodyLoc: 0,
      storePage: 0, cost: 500, gamble: false, identified: true, ethereal: false,
      socketed: false, totalSockets: 0, durability: 10, maxDurability: 10,
      quantity: 1, stats: new Map(), socketedItems: [],
    })
    player.gold = getInventoryGoldLimit(1)
    player.goldBank = getStashGoldLimit(1)
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId, action: 'trade' } as never)
    game.stepFrames(1)
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9611 } as never)
    game.stepFrames(1)
    expect((player.items as { unitId: number }[]).some((it) => it.unitId === 9611)).toBe(true)
    expect(player.gold).toBe(getInventoryGoldLimit(1))
    expect(player.goldBank).toBe(getStashGoldLimit(1))
  })

  it('rejects player ears, excludes ethereal/broken/socketed items from buyback, and restores durability/stack/identified on buyback', () => {
    const game = new GameInstance({ seed: 13562, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Seller', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<
        number,
        {
          gold: number
          goldBank: number
          items: Record<string, unknown>[]
          vendorPools: Map<number, Record<string, unknown>[]>
        }
      >
    }).players.get(playerId)!
    player.gold = 0
    player.goldBank = 0
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId, action: 'trade' } as never)
    game.stepFrames(1)
    const pool = player.vendorPools.get(npcId)!

    // 1. Player ear ('play') cannot be sold at all.
    player.items.push({
      unitId: 9701, code: 'play', name: 'Ear', quality: 2, level: 1, location: 'inventory',
      x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: playerId, bodyLoc: 0,
      storePage: 0, cost: 1, gamble: false, identified: true, ethereal: false,
      socketed: false, totalSockets: 0, durability: 0, maxDurability: 0,
      quantity: 1, stats: new Map(), socketedItems: [],
    })
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9701 } as never)
    game.stepFrames(1)
    expect(player.items.some((it) => it.unitId === 9701)).toBe(true)
    expect(player.gold).toBe(0)

    // 2. Ethereal item sells for gold but does not enter vendor buyback pool.
    player.items.push({
      unitId: 9702, code: 'cap', name: 'Eth Cap', quality: 2, level: 1, location: 'inventory',
      x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: playerId, bodyLoc: 0,
      storePage: 0, cost: 400, gamble: false, identified: true, ethereal: true,
      socketed: false, totalSockets: 0, durability: 7, maxDurability: 7,
      quantity: 1, stats: new Map(), socketedItems: [],
    })
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9702 } as never)
    game.stepFrames(1)
    expect(player.items.some((it) => it.unitId === 9702)).toBe(false)
    expect(player.gold).toBe(100)
    expect(pool.some((it) => it.unitId === 9702)).toBe(false)

    // 3. Broken item (durability 0 / maxDurability > 0) sells for gold but does not enter buyback.
    player.items.push({
      unitId: 9703, code: 'cap', name: 'Broken Cap', quality: 2, level: 1, location: 'inventory',
      x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: playerId, bodyLoc: 0,
      storePage: 0, cost: 400, gamble: false, identified: true, ethereal: false,
      socketed: false, totalSockets: 0, durability: 0, maxDurability: 12,
      quantity: 1, stats: new Map(), socketedItems: [],
    })
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9703 } as never)
    game.stepFrames(1)
    expect(player.items.some((it) => it.unitId === 9703)).toBe(false)
    expect(player.gold).toBe(200)
    expect(pool.some((it) => it.unitId === 9703)).toBe(false)

    // 4. Unidentified damaged stackable weapon ('jav') enters buyback identified with full durability & stack, without overlapping existing items on its page.
    player.items.push({
      unitId: 9704, code: 'jav', name: 'Javelin', quality: 4, level: 5, location: 'inventory',
      x: 9, y: 3, width: 1, height: 3, areaId: 1, ownerId: playerId, bodyLoc: 0,
      storePage: 1, cost: 400, gamble: false, identified: false, ethereal: false,
      socketed: false, totalSockets: 0, durability: 2, maxDurability: 6,
      quantity: 5, stats: new Map(), socketedItems: [],
    })
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 9704 } as never)
    game.stepFrames(1)
    const resold = pool.find((it) => it.unitId === 9704)
    expect(resold).toBeDefined()
    expect(resold!.identified).toBe(true)
    expect(resold!.durability).toBe(6)
    expect(resold!.quantity).toBeGreaterThan(5)
    expect(resold!.storePage).toBe(4)
    const othersOnPage = pool.filter(
      (it) => it.unitId !== 9704 && it.storePage === resold!.storePage,
    )
    const rx = resold!.x as number
    const ry = resold!.y as number
    const rw = resold!.width as number
    const rh = resold!.height as number
    for (const other of othersOnPage) {
      const ox = other.x as number
      const oy = other.y as number
      const ow = other.width as number
      const oh = other.height as number
      const overlaps = rx < ox + ow && rx + rw > ox && ry < oy + oh && ry + rh > oy
      expect(overlaps).toBe(false)
    }
  })
})
