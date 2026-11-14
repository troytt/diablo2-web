/**
 * Issue #1437: 1.13c Server Shrine Type Selection (`D2Game.dll` InitFn 1 @ `0x6fc4ef90` & `0x6fc4ed70`).
 *
 * Verifies:
 * 1. `Objects.txt` `Parm0` (`+0x178`) is baked into `OBJECTS_TXT_113C` and `CANONICAL_113C_OBJECTS`
 *    across all 92 `OperateFn = 2` shrine rows (`Parm0 = 1, 2, 3`).
 * 2. `Shrines.txt` `effectclass` (`+0x0A`) and `LevelMin` (`+0x10C`) are baked into `CANONICAL_113C_SHRINES`
 *    and grouped into `SHRINES_BY_EFFECT_CLASS_113C` (`0x6fc2b9a0`).
 * 3. `GameInstance.spawnObject` and `rollShrineType113c` replicate `0x6fc4ef90` / `0x6fc4ed70`:
 *    - `Parm0 = 1` -> 100% `Code 2` (Health Shrine)
 *    - `Parm0 = 2` -> 100% `Code 3` (Mana Shrine)
 *    - `Parm0 = 3` -> ~10% `effectclass 1` / ~90% `effectclass 4`
 *    - `levelId < LevelMin` types never spawn
 *    - `Code 4`, `Code 5`, `Code 16` are remapped (`4->2`, `5->3`, `16->18`) and have 0 occurrences
 *    - Non-shrine objects (`!isShrine`) have `shrineType = 0`, never `1`.
 * 4. Full sweep across all 136 levels (`areaId = 1..136`) and all 92 `OperateFn = 2` rows.
 */
import { describe, expect, it } from 'vitest'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import { CANONICAL_113C_OBJECTS, CANONICAL_113C_SHRINES } from '../../src/common/world/objects-meta.ts'
import {
  SHRINES_BY_EFFECT_CLASS_113C,
  remapShrineCode113c,
  rollShrineType113c,
} from '../../src/common/world/object-operate-113c.ts'
import { OBJECTS_TXT_113C, getObjectsTxtRecord113c } from '../../src/common/world/objects-txt-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

function getObjectRecord(
  game: GameInstance,
  unitId: number,
): { classId: number; isShrine: boolean; shrineType: number } {
  const map = (
    game as unknown as {
      objects: Map<number, { classId: number; isShrine: boolean; shrineType: number }>
    }
  ).objects
  const rec = map.get(unitId)
  if (!rec) throw new Error(`Object ${String(unitId)} not found`)
  return rec
}

describe('Issue #1437 — 1.13c Shrine InitFn 1 (0x6fc4ef90 & 0x6fc4ed70)', () => {
  it('bakes Shrines.txt effectclass and LevelMin and builds 0x6fc2b9a0 effectclass buckets', () => {
    expect(Object.keys(CANONICAL_113C_SHRINES)).toHaveLength(23)
    expect(CANONICAL_113C_SHRINES[0]).toMatchObject({ effectclass: 0, levelMin: 0 })
    expect(CANONICAL_113C_SHRINES[1]).toMatchObject({ effectclass: 4, levelMin: 1 })
    expect(CANONICAL_113C_SHRINES[2]).toMatchObject({ effectclass: 2, levelMin: 1 })
    expect(CANONICAL_113C_SHRINES[3]).toMatchObject({ effectclass: 3, levelMin: 1 })
    expect(CANONICAL_113C_SHRINES[4]).toMatchObject({ effectclass: 2, levelMin: 2 })
    expect(CANONICAL_113C_SHRINES[5]).toMatchObject({ effectclass: 3, levelMin: 2 })
    expect(CANONICAL_113C_SHRINES[6]).toMatchObject({ effectclass: 4, levelMin: 5 })
    expect(CANONICAL_113C_SHRINES[7]).toMatchObject({ effectclass: 4, levelMin: 8 })
    expect(CANONICAL_113C_SHRINES[8]).toMatchObject({ effectclass: 4, levelMin: 5 })
    expect(CANONICAL_113C_SHRINES[9]).toMatchObject({ effectclass: 4, levelMin: 26 })
    expect(CANONICAL_113C_SHRINES[10]).toMatchObject({ effectclass: 4, levelMin: 32 })
    expect(CANONICAL_113C_SHRINES[11]).toMatchObject({ effectclass: 4, levelMin: 21 })
    expect(CANONICAL_113C_SHRINES[16]).toMatchObject({ effectclass: 1, levelMin: 1 })
    expect(CANONICAL_113C_SHRINES[17]).toMatchObject({ effectclass: 1, levelMin: 3 })
    expect(CANONICAL_113C_SHRINES[18]).toMatchObject({ effectclass: 1, levelMin: 4 })
    expect(CANONICAL_113C_SHRINES[20]).toMatchObject({ effectclass: 1, levelMin: 3 })

    // D2Game.dll 0x6fc2b9a0..0x6fc2bbe8 per-effectclass lists:
    expect(SHRINES_BY_EFFECT_CLASS_113C[1]).toEqual([16, 17, 18, 19, 20, 21, 22])
    expect(SHRINES_BY_EFFECT_CLASS_113C[2]).toEqual([2, 4])
    expect(SHRINES_BY_EFFECT_CLASS_113C[3]).toEqual([3, 5])
    expect(SHRINES_BY_EFFECT_CLASS_113C[4]).toEqual([1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  })

  it('bakes Objects.txt Parm0 across all 92 OperateFn=2 rows (21 Parm0=1, 21 Parm0=2, 50 Parm0=3)', () => {
    const shrineRows = OBJECTS_TXT_113C.map((rec, idx) => ({ idx, rec })).filter(
      ({ rec }) => rec.operateFn === 2,
    )
    expect(shrineRows).toHaveLength(92)
    const parm1 = shrineRows.filter(({ rec }) => rec.parm0 === 1)
    const parm2 = shrineRows.filter(({ rec }) => rec.parm0 === 2)
    const parm3 = shrineRows.filter(({ rec }) => rec.parm0 === 3)
    expect(parm1).toHaveLength(21)
    expect(parm2).toHaveLength(21)
    expect(parm3).toHaveLength(50)

    for (const { idx, rec } of shrineRows) {
      expect(CANONICAL_113C_OBJECTS[idx]?.parm0).toBe(rec.parm0)
    }
  })

  it('Parm0=1 shrines spawn 100% Code 2 (Health) and Parm0=2 shrines spawn 100% Code 3 (Mana)', () => {
    const game = new GameInstance({ mapSeed: 0x1437_0001 })
    const parm1Ids = OBJECTS_TXT_113C.flatMap((r, i) => (r.operateFn === 2 && r.parm0 === 1 ? [i] : []))
    const parm2Ids = OBJECTS_TXT_113C.flatMap((r, i) => (r.operateFn === 2 && r.parm0 === 2 ? [i] : []))

    for (let i = 0; i < 200; i += 1) {
      const classId1 = parm1Ids[i % parm1Ids.length]!
      const id1 = game.spawnObject({ classId: classId1, x: 10, y: 10, areaId: 1 + (i % 136) })
      const obj1 = getObjectRecord(game, id1)
      expect(obj1.isShrine).toBe(true)
      expect(obj1.shrineType).toBe(2)

      const classId2 = parm2Ids[i % parm2Ids.length]!
      const id2 = game.spawnObject({ classId: classId2, x: 12, y: 10, areaId: 1 + (i % 136) })
      const obj2 = getObjectRecord(game, id2)
      expect(obj2.isShrine).toBe(true)
      expect(obj2.shrineType).toBe(3)
    }
  })

  it('Parm0=3 shrines distribute ~10% effectclass 1 and ~90% effectclass 4 with 0 occurrences of Code 2/3/4/5/16', () => {
    const rng = new D2Rng(0x1437_0003)
    const total = 5000
    let effectClass1Count = 0
    let effectClass4Count = 0
    const counts = new Map<number, number>()

    for (let i = 0; i < total; i += 1) {
      const code = rollShrineType113c(2, 50, rng) // classId 2 = Shrine (Parm0 = 3), areaId = 50
      counts.set(code, (counts.get(code) ?? 0) + 1)
      const meta = CANONICAL_113C_SHRINES[code]!
      expect(meta).toBeDefined()
      expect([1, 4]).toContain(meta.effectclass)
      if (meta.effectclass === 1) effectClass1Count += 1
      if (meta.effectclass === 4) effectClass4Count += 1
    }

    expect(counts.get(2) ?? 0).toBe(0)
    expect(counts.get(3) ?? 0).toBe(0)
    expect(counts.get(4) ?? 0).toBe(0)
    expect(counts.get(5) ?? 0).toBe(0)
    expect(counts.get(16) ?? 0).toBe(0)
    expect(effectClass1Count + effectClass4Count).toBe(total)

    const ec1Ratio = effectClass1Count / total
    const ec4Ratio = effectClass4Count / total
    expect(ec1Ratio).toBeGreaterThan(0.08)
    expect(ec1Ratio).toBeLessThan(0.12)
    expect(ec4Ratio).toBeGreaterThan(0.88)
    expect(ec4Ratio).toBeLessThan(0.92)
    // Remapped Gem Shrine (16 -> 18) is present in effectclass 1 at areaId=50
    expect(counts.get(18) ?? 0).toBeGreaterThan(0)
  })

  it('Parm0=0 branch rolls 1..22 with LevelMin check and remaps 4->2, 5->3, 16->18', () => {
    expect(remapShrineCode113c(4)).toBe(2)
    expect(remapShrineCode113c(5)).toBe(3)
    expect(remapShrineCode113c(16)).toBe(18)
    expect(remapShrineCode113c(12)).toBe(12)

    const rng = new D2Rng(0x1437_0000)
    // Synthetic classId with Parm0 = 0
    expect(getObjectsTxtRecord113c(1).parm0).toBe(0)
    for (let i = 0; i < 1000; i += 1) {
      const areaId = 1 + (i % 10)
      const code = rollShrineType113c(1, areaId, rng)
      expect(code).toBeGreaterThanOrEqual(1)
      expect(code).toBeLessThanOrEqual(22)
      expect([4, 5, 16]).not.toContain(code)
      expect(areaId).toBeGreaterThanOrEqual(CANONICAL_113C_SHRINES[code]!.levelMin)
    }
  })

  it('never spawns shrine types with levelId < LevelMin on low levels (e.g. Blood Moor areaId=2)', () => {
    const game = new GameInstance({ mapSeed: 0x1437_0002 })
    // Blood Moor = areaId 2:
    // Allowed in effectclass 4: 1, 12, 13, 14, 15 (LevelMin=1)
    // Forbidden in effectclass 4: 6 (5), 7 (8), 8 (5), 9 (26), 10 (32), 11 (21)
    // Allowed in effectclass 1: 19, 21, 22 (LevelMin=1)
    // Forbidden in effectclass 1: 17 (3), 18 (4, including remapped 16->18), 20 (3)
    for (let i = 0; i < 1000; i += 1) {
      const id = game.spawnObject({ classId: 2, x: 10, y: 10, areaId: 2 })
      const { shrineType } = getObjectRecord(game, id)
      expect([4, 5, 16]).not.toContain(shrineType)
      const shrineMeta = CANONICAL_113C_SHRINES[shrineType]!
      expect(shrineMeta.levelMin).toBeLessThanOrEqual(2)
      expect([1, 12, 13, 14, 15, 19, 21, 22]).toContain(shrineType)
    }
  })

  it('batch spawns shrines across all 136 levels (1..136) and all 92 OperateFn=2 rows respecting LevelMin and Parm0', () => {
    const rng = new D2Rng(0x1437_0136)
    const shrineRows = OBJECTS_TXT_113C.map((rec, idx) => ({ idx, rec })).filter(
      ({ rec }) => rec.operateFn === 2,
    )

    for (let areaId = 1; areaId <= 136; areaId += 1) {
      for (const { idx, rec } of shrineRows) {
        const shrineType = rollShrineType113c(idx, areaId, rng)
        expect(shrineType).toBeGreaterThanOrEqual(1)
        expect(shrineType).toBeLessThanOrEqual(22)
        expect([4, 5, 16]).not.toContain(shrineType)
        const meta = CANONICAL_113C_SHRINES[shrineType]!
        expect(areaId).toBeGreaterThanOrEqual(meta.levelMin)
        if (rec.parm0 === 1) {
          expect(shrineType).toBe(2)
        } else if (rec.parm0 === 2) {
          expect(shrineType).toBe(3)
        } else {
          expect([1, 4]).toContain(meta.effectclass)
        }
      }
    }
  })

  it('does not assign shrineType = 1 to non-shrine objects', () => {
    const game = new GameInstance({ mapSeed: 0x1437_9999 })
    const chestId = game.spawnObject({ classId: 5, x: 10, y: 10, areaId: 1 })
    const doorId = game.spawnObject({ classId: 13, x: 12, y: 10, areaId: 1 })
    const wpId = game.spawnObject({ classId: 119, x: 14, y: 10, areaId: 1, isWaypoint: true })

    expect(getObjectRecord(game, chestId)).toMatchObject({ isShrine: false, shrineType: 0 })
    expect(getObjectRecord(game, doorId)).toMatchObject({ isShrine: false, shrineType: 0 })
    expect(getObjectRecord(game, wpId)).toMatchObject({ isShrine: false, shrineType: 0 })
  })
})
