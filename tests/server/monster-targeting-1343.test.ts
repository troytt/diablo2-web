/**
 * Issue #1343 — monster aggro defaults to the MonStats AI sight distance (~20), not 85.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function monsterXAfter(playerX: number): number {
  const game = new GameInstance({ seed: 1343, areaId: 1 })
  game.connectPlayer({ charClass: 'pal', name: 'Target', x: playerX, y: 10, areaId: 1 })
  const monsterId = game.spawnMonster({
    defId: 'fallen1', x: 10, y: 10, areaId: 1, velocity: 5, runSpeed: 5,
  })
  game.stepFrames(20)
  return game.getMonster(monsterId)!.x
}

describe('issue #1343 monster aggro radius', () => {
  it('does not chase a player beyond the default ~20 sub-tile sight radius', () => {
    expect(monsterXAfter(40)).toBe(10)
  })

  it('chases a player inside the default sight radius', () => {
    expect(monsterXAfter(25)).toBeGreaterThan(10)
  })
})