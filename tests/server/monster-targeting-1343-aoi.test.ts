/**
 * Issue #1343 follow-up — room/adjacent-room AOI activation.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('issue #1343 room AOI', () => {
  it('activates the player room and its neighbours, not every monster within 80 sub-tiles', () => {
    const game = new GameInstance({ seed: 1343, areaId: 1 })
    game.connectPlayer({ charClass: 'bar', name: 'Hero', x: 10, y: 10, areaId: 1 })
    const roomRects = [
      { index: 0, x: 0, y: 0, w: 20, h: 20, seed: 0 },
      { index: 1, x: 20, y: 0, w: 20, h: 20, seed: 0 },
      { index: 2, x: 60, y: 0, w: 20, h: 20, seed: 0 },
    ]
    ;(game as unknown as { loadedAreas: Map<number, unknown> }).loadedAreas.set(1, {
      areaId: 1, spawnX: 10, spawnY: 10, rooms: [], roomRects,
      adjacentAreaIds: [], isWalkable: () => true,
    })
    const active = game.spawnMonster({ defId: 'fallen1', x: 30, y: 10, areaId: 1, aiDisabled: true })
    const far = game.spawnMonster({ defId: 'fallen1', x: 70, y: 10, areaId: 1, aiDisabled: true })
    const internal = game as unknown as {
      monsters: Map<number, unknown>
      isMonsterInActiveAoi: (monster: unknown) => boolean
    }
    expect(internal.isMonsterInActiveAoi(internal.monsters.get(active))).toBe(true)
    // Distance is 60 (<80), but the room is not adjacent: must sleep.
    expect(internal.isMonsterInActiveAoi(internal.monsters.get(far))).toBe(false)
  })
})