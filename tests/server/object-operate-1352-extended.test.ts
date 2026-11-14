/**
 * Issue #1352 follow-up — real shrine type selection and Gem Shrine.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function connect(game: GameInstance): number {
  return game.connectPlayer({ charClass: 'sor', name: 'Actor', x: 50, y: 50, areaId: 1 })
}

describe('issue #1352 object operate follow-up', () => {
  it('assigns a real 1..22 shrine type to world shrine objects', () => {
    const game = new GameInstance({ seed: 1352, areaId: 1 })
    connect(game)
    const types = new Set<number>()
    for (let i = 0; i < 24; i++) {
      const id = game.spawnObject({
        classId: 133,
        x: 40 + (i % 6),
        y: 40 + Math.floor(i / 6),
        areaId: 1,
        isShrine: true,
      })
      const shrineType = (game as unknown as {
        objects: Map<number, { shrineType: number }>
      }).objects.get(id)!.shrineType
      expect(shrineType).toBeGreaterThanOrEqual(1)
      expect(shrineType).toBeLessThanOrEqual(22)
      types.add(shrineType)
    }
    expect(types.size).toBeGreaterThan(1)
  })

  it('upgrades a carried gem at a Gem Shrine (code 18)', () => {
    const game = new GameInstance({ seed: 1353, areaId: 1 })
    const playerId = connect(game)
    const player = (game as unknown as {
      players: Map<number, { items: unknown[] }>
    }).players.get(playerId)!
    const gem = {
      unitId: 9001,
      code: 'gcv',
      name: 'Chipped Amethyst',
      quality: 0,
      level: 1,
      location: 'inventory',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      areaId: 1,
      ownerId: playerId,
      bodyLoc: 0,
      storePage: 0,
      cost: 0,
      gamble: false,
      identified: true,
      ethereal: false,
      socketed: false,
      totalSockets: 0,
      durability: 0,
      maxDurability: 0,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    }
    player.items.push(gem)
    const shrineId = game.spawnObject({
      classId: 133,
      x: 50,
      y: 50,
      areaId: 1,
      isShrine: true,
      shrineType: 18,
    })
    game.enqueueCommand(playerId, { type: 'OperateObject', objectId: shrineId })
    game.stepFrames(1)
    expect((gem as { code: string }).code).toBe('gfv')
  })
})