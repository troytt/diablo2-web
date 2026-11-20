/**
 * Milestone 36 [K5]: 136 Levels x 3 Difficulties (= 408 level instances)
 * Full-Spectrum Pure Kernel Traversal Exit Gate (`src/d2kern-113c/`).
 *
 * Covers Acts 1-5 (`1..132`) plus Pandemonium / Uber levels (`133` Matron's Den,
 * `134` Forgotten Sands, `135` Furnace of Pain, `136` Uber Tristram) across
 * Normal (`0`), Nightmare (`1`), and Hell (`2`).
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { DRLG_GetActNoFromLevelId113c } from '../../../src/d2kern-113c/common/drlg/drlg.ts'
import {
  DRLG_FindPortalTargetRoomEx113c,
  WAYPOINT_PAIR_GROUP_6FDE4F48,
} from '../../../src/d2kern-113c/common/dungeon.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  K5_ACT_LEVEL_RANGES,
  K5_COLLIDE_VOID_SENTINEL,
  K5_DIGEST_VECTORS_PATH,
  type K5DifficultyTraversalSummary,
  type K5LevelTraversalRecord,
  isK5TraversalEnvReady,
  resolveK5D2DataDir,
  traverseDifficultyLevels113c,
} from '../../../tools/oracle/k5-408-levels-traversal.ts'
import { type DrlgDigestRecord, parseDrlgDigestFile } from '../../../tools/oracle/vectors/drlg-vector.ts'

const K5_CANONICAL_SEED = 12345
const K5_DIFFICULTIES = [0, 1, 2] as const

/** Levels without `D2RoomTileStrc` stair/vis warps (outdoor walk-across borders or red-portal arenas). */
const LEVELS_WITHOUT_ROOMTILE_WARPS = new Set<number>([
  1, 26, 27, 38, 39, 73, 74, 75, 77, 79, 103, 104, 105, 108, 109, 110, 111, 125, 126, 127, 132,
  133, 134, 135, 136,
])

/** Outdoor border levels connected via direct cross-level `ppRoomsNear` room adjacency. */
const OUTDOOR_CROSS_LEVEL_ADJACENT_IDS = [
  1, 2, 26, 27, 75, 76, 103, 104, 105, 109, 110, 111,
] as const

/** Strictly expanding maze levels (`Normal < Nightmare < Hell` room counts in `LvlMaze.bin`). */
const STRICTLY_EXPANDING_MAZE_LEVEL_IDS = [18, 19, 21, 22, 23, 133] as const

describe('Milestone 36 [K5]: 136 Levels x 3 Difficulties (= 408) Pure Kernel Traversal Gate', () => {
  const summariesByDiff = new Map<number, K5DifficultyTraversalSummary>()
  const all408Records: K5LevelTraversalRecord[] = []
  const goldenByDiffAndLevel = new Map<string, DrlgDigestRecord>()

  beforeAll(() => {
    expect(isK5TraversalEnvReady()).toBe(true)

    const digestRaw = new Uint8Array(gunzipSync(readFileSync(K5_DIGEST_VECTORS_PATH)))
    const parsedDigest = parseDrlgDigestFile(digestRaw)
    for (const rec of parsedDigest.records) {
      if (rec.seed === K5_CANONICAL_SEED) {
        goldenByDiffAndLevel.set(`${rec.diff}:${rec.levelId}`, rec)
      }
    }
    expect(goldenByDiffAndLevel.size).toBe(408)

    for (const diff of K5_DIFFICULTIES) {
      const summary = traverseDifficultyLevels113c(K5_CANONICAL_SEED, diff)
      summariesByDiff.set(diff, summary)
      for (const lvl of summary.levels) {
        all408Records.push(lvl)
      }
    }
  }, 240_000)

  it('verifies WAYPOINT_PAIR_GROUP_6FDE4F48 byte-for-byte against D2Common.dll .rdata 0x6FDE4F48 and portal group 5 matching', () => {
    expect(WAYPOINT_PAIR_GROUP_6FDE4F48.length).toBe(28)
    const dllPath = join(resolveK5D2DataDir(), 'D2Common.dll')
    expect(existsSync(dllPath)).toBe(true)
    const dllBuf = readFileSync(dllPath)
    const rdataOff = 0x6fde4f48 - 0x6fd50000
    for (let i = 0; i < 28; i++) {
      expect(WAYPOINT_PAIR_GROUP_6FDE4F48[i]).toBe(dllBuf.readInt32LE(rdataOff + i * 4))
    }

    // Verify `DRLG_FindPortalTargetRoomEx113c` (`0x6FD69B60`) matches `nPortalType = 5` against `eType = 6`
    // via `WAYPOINT_PAIR_GROUP_6FDE4F48[5*2] == 1` and `group == 1`, rather than falling back to index 0.
    const m = new SparseMemory113c()
    const pDrlg = m.alloc(0x48c)
    const pLevel = m.alloc(0x230)
    m.setU32((pLevel + 0x1b4) >>> 0, pDrlg)
    m.setU32((pLevel + 0x1c4) >>> 0, 1)
    m.setU32((pLevel + 0x1c8) >>> 0, 0)
    m.setU32((pLevel + 0x1d0) >>> 0, 40)
    m.setU32((pLevel + 0x1d8) >>> 0, 2)
    // Entry 0: town portal (`eType = 10`) at `(1010, 1010)`
    m.setU32((pLevel + 0x2c) >>> 0, 1010)
    m.setU32((pLevel + 0x30) >>> 0, 1010)
    m.setU32((pLevel + 0x34) >>> 0, 10)
    // Entry 1: palace exit member (`eType = 6`, group 1) at `(1044, 1022)`
    m.setU32((pLevel + 0x38) >>> 0, 1044)
    m.setU32((pLevel + 0x3c) >>> 0, 1022)
    m.setU32((pLevel + 0x40) >>> 0, 6)

    const r0 = m.alloc(0xec)
    m.setU32((r0 + 0x34) >>> 0, 1000)
    m.setU32((r0 + 0x38) >>> 0, 1000)
    m.setU32((r0 + 0x3c) >>> 0, 20)
    m.setU32((r0 + 0x40) >>> 0, 20)
    m.setU32((r0 + 0x58) >>> 0, pLevel)

    const r1 = m.alloc(0xec)
    m.setU32((r1 + 0x34) >>> 0, 1040)
    m.setU32((r1 + 0x38) >>> 0, 1020)
    m.setU32((r1 + 0x3c) >>> 0, 20)
    m.setU32((r1 + 0x40) >>> 0, 20)
    m.setU32((r1 + 0x58) >>> 0, pLevel)
    m.setU32((r0 + 0x24) >>> 0, r1)
    m.setU32((pLevel + 0x10) >>> 0, r0)
    m.setU32((pLevel + 0x08) >>> 0, 2)

    const pOutX = m.alloc(8)
    const pOutY = (pOutX + 4) >>> 0
    const matchedRoom = DRLG_FindPortalTargetRoomEx113c(m, pLevel, 5, pOutX, pOutY)
    expect(matchedRoom).toBe(r1)
    expect(m.u32(pOutX) | 0).toBe(1044)
    expect(m.u32(pOutY) | 0).toBe(1022)
  })

  it('covers all 136 levels (Acts 1-5 + Uber 133..136) x 3 difficulties = 408 instances with 100% golden D2Common.dll parity', () => {
    expect(all408Records.length).toBe(408)
    const seenPairs = new Set<string>()
    let actLevelCountSum = 0
    for (const r of K5_ACT_LEVEL_RANGES) {
      actLevelCountSum += r.maxLevelId - r.minLevelId + 1
    }
    expect(actLevelCountSum).toBe(136)

    const emptyMem = new SparseMemory113c()
    for (const diff of K5_DIFFICULTIES) {
      const summary = summariesByDiff.get(diff)
      expect(summary).toBeDefined()
      expect(summary!.levels.length).toBe(136)
      expect(summary!.totalRooms).toBeGreaterThan(6000)
      expect(summary!.totalSubtiles).toBeGreaterThan(5_000_000)

      for (let levelId = 1; levelId <= 136; levelId++) {
        const rec = summary!.levels[levelId - 1]!
        expect(rec.levelId).toBe(levelId)
        expect(rec.difficulty).toBe(diff)
        expect(rec.act).toBe(DRLG_GetActNoFromLevelId113c(emptyMem, levelId))
        seenPairs.add(`${diff}:${levelId}`)

        const golden = goldenByDiffAndLevel.get(`${diff}:${levelId}`)
        expect(golden).toBeDefined()
        expect(rec.drlgType).toBe(golden!.drlgType)
        expect(rec.nRoomsGraph).toBe(golden!.nRoomList)
        expect(rec.nRoomsHeader).toBe(golden!.nRoomsField)
        expect(rec.posX).toBe(golden!.posX)
        expect(rec.posY).toBe(golden!.posY)
        expect(rec.sizeX).toBe(golden!.sizeX)
        expect(rec.sizeY).toBe(golden!.sizeY)
        expect(rec.layoutHash, `layoutHash mismatch on diff=${diff} L=${levelId}`).toBe(
          golden!.layoutHash,
        )
        expect(rec.collHash, `collHash mismatch on diff=${diff} L=${levelId}`).toBe(
          golden!.collHash,
        )
      }
    }
    expect(seenPairs.size).toBe(408)
  })

  it('verifies non-empty D2RoomExStrc graphs, valid level bounds, and ppRoomsNear adjacency across all 408 instances', () => {
    for (const rec of all408Records) {
      expect(
        rec.drlgType === 1 || rec.drlgType === 2 || rec.drlgType === 3,
        `invalid drlgType=${rec.drlgType} on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBe(true)
      expect(rec.levelType).toBeGreaterThan(0)
      expect(rec.posX).toBeGreaterThanOrEqual(0)
      expect(rec.posY).toBeGreaterThanOrEqual(0)
      expect(rec.sizeX).toBeGreaterThan(0)
      expect(rec.sizeY).toBeGreaterThan(0)
      expect(rec.nRoomsGraph).toBeGreaterThan(0)
      expect(rec.nRoomsHeader).toBe(rec.nRoomsGraph)
      expect(
        rec.roomBoundsViolations,
        `room bounds violation on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBe(0)
      expect(
        rec.nearRoomViolations,
        `ppRoomsNear violation on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBe(0)
    }

    for (const diff of K5_DIFFICULTIES) {
      const summary = summariesByDiff.get(diff)!
      for (const borderLvl of OUTDOOR_CROSS_LEVEL_ADJACENT_IDS) {
        const rec = summary.levels[borderLvl - 1]!
        expect(
          rec.crossLevelNearLinks,
          `expected cross-level outdoor room adjacency on L=${borderLvl} diff=${diff}`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('verifies D2ActiveRoomStrc instantiation, pColl grids, void/sparse protection, and grounded walkable spawn across all 408 instances', () => {
    for (const rec of all408Records) {
      expect(rec.nActiveRooms).toBe(rec.nRoomsGraph)
      expect(rec.nCollGrids).toBe(rec.nRoomsGraph)
      expect(rec.totalSubtiles).toBeGreaterThan(0)
      expect(rec.voidProbeMask).toBe(K5_COLLIDE_VOID_SENTINEL)
      expect(
        rec.universalDt1Violations,
        `missing universal DT1 libraries (Blank/InvisWal/Warp) on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBe(0)
      expect(
        rec.walkableSubtiles,
        `zero walkable subtiles on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBeGreaterThan(0)

      expect(
        rec.spawnRoomPtr,
        `failed grounded spawn room on L=${rec.levelId} diff=${rec.difficulty}`,
      ).not.toBe(0)
      expect(
        rec.spawnFootprintClear,
        `spawn footprint collided with 0x1c09 on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBe(true)
      expect(rec.spawnSubtileX).toBeGreaterThanOrEqual(rec.posX * 5)
      expect(rec.spawnSubtileX).toBeLessThan((rec.posX + rec.sizeX) * 5)
      expect(rec.spawnSubtileY).toBeGreaterThanOrEqual(rec.posY * 5)
      expect(rec.spawnSubtileY).toBeLessThan((rec.posY + rec.sizeY) * 5)
    }
  })

  it('verifies D2PresetUnitStrc chains, ROOM_SpawnPresetUnits113c Uber 133..136 filters, and bidirectional D2RoomTileStrc warps across all 408 instances', () => {
    for (const rec of all408Records) {
      expect(
        rec.presetUnitsTotal,
        `empty preset unit list on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBeGreaterThan(0)
      expect(rec.presetMonsters + rec.presetObjects + rec.presetWarps).toBe(rec.presetUnitsTotal)
      expect(
        rec.presetBoundsViolations,
        `out-of-bounds preset unit on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBe(0)
      expect(rec.spawnedNonMonsters + rec.spawnedMonsters).toBeGreaterThan(0)

      expect(rec.warpArrayValidSlots).toBe(8)
      expect(
        rec.warpViolations,
        `broken D2RoomTileStrc warp on L=${rec.levelId} diff=${rec.difficulty}`,
      ).toBe(0)
      expect(rec.warpBidirectionalLinked).toBe(rec.warpTileNodes)

      if (!LEVELS_WITHOUT_ROOMTILE_WARPS.has(rec.levelId)) {
        expect(
          rec.warpTileNodes,
          `expected non-zero D2RoomTileStrc warps on L=${rec.levelId} diff=${rec.difficulty}`,
        ).toBeGreaterThan(0)
      }
    }

    // Verify Pandemonium / Uber levels 133..136 preset filter semantics across Normal, Nightmare, and Hell
    for (const diff of K5_DIFFICULTIES) {
      const summary = summariesByDiff.get(diff)!
      const matronsDen = summary.levels[133 - 1]!
      const forgottenSands = summary.levels[134 - 1]!
      const furnaceOfPain = summary.levels[135 - 1]!
      const uberTristram = summary.levels[136 - 1]!

      expect(matronsDen.drlgType).toBe(1)
      expect(matronsDen.spawnedMonsters).toBe(matronsDen.presetMonsters)
      expect(matronsDen.spawnedNonMonsters).toBeLessThan(matronsDen.presetObjects)

      expect(forgottenSands.drlgType).toBe(3)
      expect(forgottenSands.spawnedMonsters).toBe(forgottenSands.presetMonsters)
      expect(forgottenSands.spawnedNonMonsters).toBe(forgottenSands.presetObjects - 2)

      expect(furnaceOfPain.drlgType).toBe(1)
      expect(furnaceOfPain.spawnedMonsters).toBe(furnaceOfPain.presetMonsters)
      expect(furnaceOfPain.spawnedNonMonsters).toBeLessThan(furnaceOfPain.presetObjects)

      expect(uberTristram.drlgType).toBe(2)
      expect(uberTristram.presetMonsters).toBeGreaterThan(0)
      expect(uberTristram.spawnedMonsters).toBe(0)
      expect(uberTristram.spawnedNonMonsters).toBeLessThan(uberTristram.presetObjects)
    }
  })

  it('verifies difficulty maze scaling (Normal <= Nightmare <= Hell) and deterministic replay repeatability', () => {
    const norm = summariesByDiff.get(0)!
    const night = summariesByDiff.get(1)!
    const hell = summariesByDiff.get(2)!

    expect(hell.totalRooms).toBeGreaterThan(norm.totalRooms)
    expect(night.totalRooms).toBeGreaterThan(norm.totalRooms)

    // Every single maze level (`drlgType === 1`) across all 136 levels is non-decreasing (`Normal <= Nightmare <= Hell`)
    for (let levelId = 1; levelId <= 136; levelId++) {
      const rNorm = norm.levels[levelId - 1]!
      const rNight = night.levels[levelId - 1]!
      const rHell = hell.levels[levelId - 1]!
      if (rNorm.drlgType === 1) {
        expect(rNight.nRoomsGraph).toBeGreaterThanOrEqual(rNorm.nRoomsGraph)
        expect(rHell.nRoomsGraph).toBeGreaterThanOrEqual(rNight.nRoomsGraph)
      }
    }

    // Strictly expanding mazes (`Normal < Nightmare < Hell`, including Pandemonium Matron's Den `133`)
    for (const mazeLvl of STRICTLY_EXPANDING_MAZE_LEVEL_IDS) {
      const rNorm = norm.levels[mazeLvl - 1]!
      const rNight = night.levels[mazeLvl - 1]!
      const rHell = hell.levels[mazeLvl - 1]!
      expect(rNorm.drlgType).toBe(1)
      expect(rNight.nRoomsGraph).toBeGreaterThan(rNorm.nRoomsGraph)
      expect(rHell.nRoomsGraph).toBeGreaterThan(rNight.nRoomsGraph)
    }

    // Re-run Hell (`difficulty = 2`) from scratch and verify bit-identical determinism across all 136 levels
    const hellRepeat = traverseDifficultyLevels113c(K5_CANONICAL_SEED, 2)
    expect(hellRepeat.totalRooms).toBe(hell.totalRooms)
    expect(hellRepeat.totalSubtiles).toBe(hell.totalSubtiles)
    for (let i = 0; i < 136; i++) {
      expect(hellRepeat.levels[i]!.layoutHash).toBe(hell.levels[i]!.layoutHash)
      expect(hellRepeat.levels[i]!.collHash).toBe(hell.levels[i]!.collHash)
      expect(hellRepeat.levels[i]!.spawnSubtileX).toBe(hell.levels[i]!.spawnSubtileX)
      expect(hellRepeat.levels[i]!.spawnSubtileY).toBe(hell.levels[i]!.spawnSubtileY)
    }
  }, 120_000)
})
