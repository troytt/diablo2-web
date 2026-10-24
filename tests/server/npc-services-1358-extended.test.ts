/**
 * Issue #1358 follow-up — service capabilities are enforced.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function setup(seed: number) {
  const game = new GameInstance({ seed, areaId: 1 })
  const playerId = game.connectPlayer({ charClass: 'pal', name: 'Actor', x: 10, y: 10, areaId: 1, hp: 100, maxHp: 500 })
  const player = (game as unknown as {
    players: Map<number, {
      hp: number
      maxHp: number
      activeNpcId: number | undefined
      activeVendorMode: 'trade' | 'gamble' | null
      items: unknown[]
    }>
  }).players.get(playerId)!
  player.activeVendorMode = 'trade'
  return { game, playerId, player }
}

describe('issue #1358 service capability gates', () => {
  it('rejects repair/identify/heal at an NPC without that service', () => {
    const { game, playerId, player } = setup(1358)
    const charsi = game.spawnMonster({
      classId: 154, name: 'Charsi', x: 11, y: 10, areaId: 1, isNpc: true, isVendor: true,
    })
    const cain = game.spawnMonster({
      classId: 146, name: 'Cain', x: 12, y: 10, areaId: 1, isNpc: true,
    })
    const item = {
      unitId: 9801, code: 'cap', name: 'Cap', quality: 2, level: 1, location: 'equipped',
      x: 0, y: 0, width: 1, height: 1, areaId: 1, ownerId: playerId, bodyLoc: 4,
      storePage: 0, cost: 100, gamble: false, identified: false, ethereal: false,
      socketed: false, totalSockets: 0, durability: 0, maxDurability: 10,
      quantity: 1, stats: new Map(), socketedItems: [],
    }
    player.items.push(item)

    player.activeNpcId = cain
    game.enqueueCommand(playerId, { type: 'NpcRepairItem', npcId: cain, itemId: 9801, itemMode: 1, durability: 0 } as never)
    game.stepFrames(1)
    expect(item.durability).toBe(0)

    player.activeNpcId = charsi
    game.enqueueCommand(playerId, { type: 'NpcIdentifyAll', npcId: charsi } as never)
    game.stepFrames(1)
    expect(item.identified).toBe(false)

    player.activeNpcId = charsi
    game.enqueueCommand(playerId, { type: 'NpcHeal', npcId: charsi } as never)
    game.stepFrames(1)
    expect(player.hp).toBe(100)
  })

  it('heals at a real healer (Akara)', () => {
    const { game, playerId, player } = setup(1359)
    const akara = game.spawnMonster({
      classId: 148, name: 'Akara', x: 11, y: 10, areaId: 1, isNpc: true,
    })
    player.activeNpcId = akara
    game.enqueueCommand(playerId, { type: 'NpcHeal', npcId: akara } as never)
    game.stepFrames(1)
    expect(player.hp).toBe(player.maxHp)
  })
})