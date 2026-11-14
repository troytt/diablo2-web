/**
 * Server walk/run parity with 1.13c D2Game:
 * - `0x6FCEBF50` -> `0x6FCEB690` (`ebx = 0x32`): C2S `0x01` / `0x03` targets more than 50 sub-tiles
 *   away on either axis are dropped; the position is re-sent only when the last accepted walk/run
 *   packet is more than 25 frames old (`0x6FCEBFBC..0x6FCEBFC5`, stamp at `0x6FCEC00D`).
 * - `0x6FC98710` keeps `PATHTYPE_STRAIGHT (7)` for walk/run, so the player path is
 *   `D2Common_10142` (`PATH_Straight_Compute` 0x6FDB7AD0): A* fallback only within 18 sub-tiles.
 */
import { describe, expect, it } from 'vitest'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  WALK_PACKET_MAX_AXIS_DELTA_113C,
  WALK_PACKET_REJECT_REASSIGN_FRAMES_113C,
} from '../../src/server/engine/game-instance/constants-and-helpers.ts'

interface PlayerView {
  x: number
  y: number
  targetX: number | undefined
  targetY: number | undefined
}

function player(game: GameInstance, id: number): PlayerView {
  return (game as unknown as { players: Map<number, PlayerView> }).players.get(id)!
}

function findPlayerPath(
  game: GameInstance,
  areaId: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): readonly { x: number; y: number }[] {
  return (
    game as unknown as {
      findPlayerPath(a: number, fx: number, fy: number, tx: number, ty: number): readonly { x: number; y: number }[]
    }
  ).findPlayerPath(areaId, fromX, fromY, toX, toY)
}

describe('1.13c server walk/run packet gate and STRAIGHT player path (D2Game 0x6FCEBF50 / D2Common_10142)', () => {
  it('drops WalkToLocation / RunToLocation beyond 50 sub-tiles on either axis', () => {
    expect(WALK_PACKET_MAX_AXIS_DELTA_113C).toBe(50)
    expect(WALK_PACKET_REJECT_REASSIGN_FRAMES_113C).toBe(25)

    for (const type of ['WalkToLocation', 'RunToLocation'] as const) {
      const game = new GameInstance({ seed: 210, areaId: 1 })
      const id = game.connectPlayer({ charClass: 'sor', name: 'Actor', x: 200, y: 200, areaId: 1 })
      const p = player(game, id)
      const beforeX = p.targetX
      const beforeY = p.targetY

      game.enqueueCommand(id, { type, x: 251, y: 200 })
      game.stepFrames(1)
      expect(p.targetX).toBe(beforeX)
      expect(p.targetY).toBe(beforeY)

      game.enqueueCommand(id, { type, x: 200, y: 149 })
      game.stepFrames(1)
      expect(p.targetX).toBe(beforeX)
      expect(p.targetY).toBe(beforeY)
      expect(Math.round(p.x)).toBe(200)
      expect(Math.round(p.y)).toBe(200)

      // Exactly 50 on both axes is accepted (`cmp ; jg`).
      game.enqueueCommand(id, { type, x: 250, y: 150 })
      game.stepFrames(1)
      expect(p.targetX).toBe(250)
      expect(p.targetY).toBe(150)
    }
  })

  it('re-sends the position for a rejected packet only when the last accepted one is over 25 frames old', () => {
    const game = new GameInstance({ seed: 211, areaId: 1 })
    const id = game.connectPlayer({ charClass: 'sor', name: 'Actor', x: 200, y: 200, areaId: 1 })
    game.stepFrames(30)
    game.drainEvents(id)

    game.enqueueCommand(id, { type: 'WalkToLocation', x: 300, y: 200 })
    game.stepFrames(1)
    const pulled = game.drainEvents(id).filter((e) => e.type === 'WalkVerify')
    expect(pulled).toHaveLength(1)
    expect(pulled[0]).toMatchObject({ x: 200, y: 200 })

    // Accepted packet stamps the frame; a reject within 25 frames stays silent.
    game.enqueueCommand(id, { type: 'WalkToLocation', x: 201, y: 200 })
    game.stepFrames(3)
    game.drainEvents(id)
    game.enqueueCommand(id, { type: 'WalkToLocation', x: 320, y: 200 })
    game.stepFrames(1)
    expect(game.drainEvents(id).some((e) => e.type === 'WalkVerify')).toBe(false)
  })

  it('paths players with PATHTYPE_STRAIGHT: A* detour only within 18 sub-tiles', () => {
    const game = new GameInstance({ seed: 212, areaId: 1 })
    game.connectPlayer({ charClass: 'sor', name: 'Actor', x: 50, y: 50, areaId: 1 })
    // Wall at y = 55, x = 45..55.
    game.setTerrainWalkableCheck((_areaId, x, y) => !(Math.round(y) === 55 && Math.round(x) >= 45 && Math.round(x) <= 55))

    // 25 sub-tiles away (625 > 324): no A*, stops in front of the wall.
    const far = findPlayerPath(game, 1, 50, 50, 50, 75)
    expect(far.at(-1)).toEqual({ x: 50, y: 53 })

    // 12 sub-tiles away (144 <= 324): A* walks around the wall.
    const near = findPlayerPath(game, 1, 50, 50, 50, 62)
    expect(near.at(-1)).toEqual({ x: 50, y: 62 })
  })
})
