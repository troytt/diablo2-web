/**
 * Issue #1668: the 1.13c stash gold limit is a flat 2,500,000 (`D2Common.dll` #11060 @ `0x6FD7E9C0`:
 * `mov eax, 0x2625A0; ret 4`, unit argument ignored). D2Game clamps stat 15 `goldbank` with it
 * (`0x6FC21063`), so a level 1 character's NPC sale overflows into the stash past 50,000.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  getInventoryGoldLimit,
  getStashGoldLimit,
  STASH_GOLD_CAP,
} from '../../src/common/items/inventory-model.ts'

describe('issue #1668: flat 2,500,000 stash gold limit', () => {
  it('getStashGoldLimit ignores character level', () => {
    for (let lvl = 1; lvl <= 99; lvl++) expect(getStashGoldLimit(lvl)).toBe(2_500_000)
    expect(getStashGoldLimit()).toBe(STASH_GOLD_CAP)
  })

  it('level 1 NPC sale overflows into a stash already holding more than 50,000 gold', () => {
    const game = new GameInstance({ seed: 16680, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Lowbie', x: 10, y: 10, areaId: 1 })
    const player = (game as unknown as {
      players: Map<number, { gold: number; goldBank: number; level: number; items: unknown[] }>
    }).players.get(playerId)!
    expect(player.level).toBe(1)
    const npcId = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    player.items.push({
      unitId: 16681, code: 'cap', name: 'Cap', quality: 2, level: 1, location: 'inventory',
      x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: playerId, bodyLoc: 0,
      storePage: 0, cost: 500, gamble: false, identified: true, ethereal: false,
      socketed: false, totalSockets: 0, durability: 10, maxDurability: 10,
      quantity: 1, stats: new Map(), socketedItems: [],
    })
    player.gold = getInventoryGoldLimit(1)
    player.goldBank = 100_000
    game.enqueueCommand(playerId, { type: 'NpcAction', npcId, action: 'trade' } as never)
    game.stepFrames(1)
    game.enqueueCommand(playerId, { type: 'NpcSell', npcId, itemId: 16681 } as never)
    game.stepFrames(1)
    expect((player.items as { unitId: number }[]).some((it) => it.unitId === 16681)).toBe(false)
    expect(player.gold).toBe(getInventoryGoldLimit(1))
    expect(player.goldBank).toBeGreaterThan(100_000)
  })
})
