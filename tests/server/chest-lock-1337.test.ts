/**
 * Issues #1337 + #1832: real-map `Objects.txt` `InitFn === 3 && Lockable === 1` chests roll
 * runtime `isLocked` at `Math.floor(areaLevel / 2) + 8`% (`D2Game.dll` `0x6FC4ECB0`),
 * while non-lockable containers (`classId = 4`), quest chests (`354..356, 405..407`),
 * Sparkly/Special chests (`397, 455`), and Mephisto's `Hellgate` (`342`) never spawn locked.
 */
import { describe, expect, it } from 'vitest'
import { OBJECTS_LOCKABLE_113C } from '../../src/common/world/objects-txt-113c.ts'
import { INIT_FN_3_LOCKABLE_CLASS_IDS_113C } from '../../src/common/world/object-operate-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { createAreaBootstrapResolver } from '../../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry, LocalAreaLevelSource } from '../../src/netproto/index.ts'

function level(areaId: number, chestClassIds: readonly number[]): LocalAreaLevelGeometry {
  const size = 120
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
    roomRects: [],
    adjacentAreaIds: [],
    presetUnits: chestClassIds.map((index, i) => ({
      type: 2,
      index,
      mode: 0,
      subX: 10 + (i % 15) * 6,
      subY: 10 + Math.floor(i / 15) * 6,
    })),
    warps: [],
  }
}

describe('#1337 + #1832 Lockable chests (InitFn 3 probability roll)', () => {
  it('rolls InitFn=3 Lockable=1 chests probabilistically and leaves non-InitFn=3 / quest / sparkly / hellgate unlocked', () => {
    expect(OBJECTS_LOCKABLE_113C.has(5)).toBe(true)
    expect(INIT_FN_3_LOCKABLE_CLASS_IDS_113C.has(5)).toBe(true)
    expect(OBJECTS_LOCKABLE_113C.has(4)).toBe(false)
    expect(INIT_FN_3_LOCKABLE_CLASS_IDS_113C.has(4)).toBe(false)
    for (const specialId of [342, 354, 355, 356, 397, 405, 406, 407, 455]) {
      expect(INIT_FN_3_LOCKABLE_CLASS_IDS_113C.has(specialId)).toBe(false)
    }

    const presetIds = [
      ...Array.from({ length: 30 }, () => 5),
      ...Array.from({ length: 10 }, () => 4),
      342,
      354,
      355,
      356,
      397,
      405,
      406,
      407,
      455,
    ]
    const source: LocalAreaLevelSource = (request) =>
      request.areaId === 36 ? level(36, presetIds) : null
    const game = new GameInstance({
      seed: 13370,
      areaId: 1,
      difficulty: 1,
      resolveAreaBootstrap: createAreaBootstrapResolver(source),
    })
    game.ensureAreaLoaded(36)
    const objects = (game as unknown as { objects: Map<number, { areaId: number; classId: number; isLocked: boolean }> }).objects
    const inArea = [...objects.values()].filter((obj) => obj.areaId === 36)

    const chest5 = inArea.filter((obj) => obj.classId === 5)
    expect(chest5).toHaveLength(30)
    const lockedCount = chest5.filter((obj) => obj.isLocked).length
    expect(lockedCount).toBeGreaterThan(0)
    expect(lockedCount).toBeLessThan(30)

    for (const unlockedId of [4, 342, 354, 355, 356, 397, 405, 406, 407, 455]) {
      for (const obj of inArea.filter((o) => o.classId === unlockedId)) {
        expect(obj.isLocked, `classId ${unlockedId} must never spawn locked`).toBe(false)
      }
    }
  })
})
