/**
 * Issue #1342 — MonStats Velocity/Run movement rates and D2Common path following.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('issue #1342 monster movement', () => {
  it('scales movement with the MonStats Run velocity instead of one shared step', () => {
    const slow = new GameInstance({ seed: 1342, areaId: 1 })
    slow.connectPlayer({ charClass: 'pal', name: 'Target', x: 40, y: 10, areaId: 1 })
    const slowId = slow.spawnMonster({
      defId: 'fallen1', x: 10, y: 10, areaId: 1, velocity: 4, runSpeed: 4, aggroRadius: 60,
    })
    slow.stepFrames(10)

    const fast = new GameInstance({ seed: 1342, areaId: 1 })
    fast.connectPlayer({ charClass: 'pal', name: 'Target', x: 40, y: 10, areaId: 1 })
    const fastId = fast.spawnMonster({
      defId: 'fallen1', x: 10, y: 10, areaId: 1, velocity: 8, runSpeed: 8, aggroRadius: 60,
    })
    fast.stepFrames(10)

    expect(fast.getMonster(fastId)!.x).toBeGreaterThan(slow.getMonster(slowId)!.x)
  })

  it('routes around a wall instead of stopping at it', () => {
    const game = new GameInstance({ seed: 1343, areaId: 1 })
    const playerId = game.connectPlayer({ charClass: 'pal', name: 'Target', x: 20, y: 10, areaId: 1 })
    const monsterId = game.spawnMonster({
      defId: 'fallen1', x: 10, y: 10, areaId: 1, velocity: 6, runSpeed: 6, aggroRadius: 40,
      hp: 500, maxHp: 500,
    })
    // Solid wall at x=15 from y=6..14; the monster must detour around it.
    game.setTerrainWalkableCheck((_area, x, y) => !(Math.round(x) === 15 && y >= 6 && y <= 14))
    // Strict LOS (#1343) means an unprovoked monster will not aggro through the
    // wall; the last-attacker threat makes it pursue and exercise the detour.
    game.applyDamageToMonster(monsterId, 1, playerId)
    game.stepFrames(60)
    const monster = game.getMonster(monsterId)!
    expect(monster.x).toBeGreaterThan(15)
  })
})