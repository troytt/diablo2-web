/**
 * Issue #1337: real-map `Objects.txt Lockable` chests must spawn with
 * `isLocked`, so the key check runs before the container roll.
 */
import { describe, expect, it } from 'vitest'
import { OBJECTS_LOCKABLE_113C } from '../../src/common/world/objects-txt-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { createAreaBootstrapResolver } from '../../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry, LocalAreaLevelSource } from '../../src/netproto/index.ts'

function level(areaId: number, chestClassIds: readonly number[]): LocalAreaLevelGeometry {
  const size = 80
  return {
    areaId,
    originX: 1000,
    originY: 1000,
    subWidth: size,
    subHeight: size,
    blocked: new Uint8Array(size * size),
    spawnTileX: 4,
    spawnTileY: 4,
    rooms: [{ areaId, tileX: 200, tileY: 200 }],
    roomRects: [{ index: 0, x: 1000, y: 1000, w: size, h: size, seed: 1 }],
    adjacentAreaIds: [],
    presetUnits: chestClassIds.map((index, i) => ({
      type: 2,
      index,
      mode: 0,
      subX: 10 + i * 5,
      subY: 10,
    })),
    warps: [],
  }
}

describe('#1337 Lockable chests', () => {
  it('marks Objects.txt Lockable rows and leaves other containers unlocked', () => {
    expect(OBJECTS_LOCKABLE_113C.has(5)).toBe(true)
    expect(OBJECTS_LOCKABLE_113C.has(4)).toBe(false)

    const source: LocalAreaLevelSource = (request) =>
      request.areaId === 2 ? level(2, [5, 4]) : null
    const game = new GameInstance({
      seed: 13370,
      areaId: 1,
      resolveAreaBootstrap: createAreaBootstrapResolver(source),
    })
    game.ensureAreaLoaded(2)
    const objects = (game as unknown as { objects: Map<number, any> }).objects
    const inArea = [...objects.values()].filter((obj) => obj.areaId === 2)
    expect(inArea.find((obj) => obj.classId === 5)?.isLocked).toBe(true)
    expect(inArea.find((obj) => obj.classId === 4)?.isLocked).toBe(false)
  })
})