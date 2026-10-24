/**
 * Diablo II 1.13c D2Common dynamic-path, collision, unit-footprint, and per-tick step tests (Refs #808).
 *
 * Verifies the ported D2Common 1.13c dynamic-path subsystem (`src/common/path/`) against:
 * 1. MPQ table parity (`MonStats.txt` and `MonStats2.txt` into `monster-path-data.ts`).
 * 2. Pathfinder algorithms (`PATHTYPE_TOWARD`, `PATHTYPE_ASTAR`, `PATHTYPE_IDASTAR`, `PATHTYPE_STRAIGHT`,
 *    `PATHTYPE_WALL_FOLLOW`, `PATHTYPE_KNOCKBACK_CLIENT`, `PATHTYPE_KNOCKBACK_SERVER`, `PATHTYPE_LEAP`,
 *    `PATHTYPE_BACKUP_TURN`) and `D2Common_10142` (`#10334`) invariants.
 * 3. Per-tick stepping (`D2Common_10226` / `#10342`), exact 16.16 fixed-point velocity displacement,
 *    re-target checks (`sub_6FD5DB70`), collision stopping + `nCollidedWithMask`, and `D2Common_10213`.
 * 4. Unit collision footprints (`PATH_Add/RemoveCollisionFootprintForUnit`, `PATH_SetUnitDeadCollision`,
 *    `PATH_SetUnitAliveCollision`), cross-room bounding-box splits, and `COLLIDE_MASK_INVALID` outside rooms.
 * 5. Teleports and snaps (`D2Common_10229`, `D2Common_10230`, `D2Common_10231`, `D2Common_10232`).
 * 6. Room adjacency builder (`buildAdjacentRoomLists`, `DrlgDrlgRoom.cpp:601`).
 */

import { describe, expect, it } from 'vitest'
import {
  MONSTATS2_BIN_PATH,
  MONSTATS_BIN_PATH,
  buildMonsterPathData,
  packMonsterPathData,
  renderMonsterPathDataModule,
} from '../../../src/baker/packers/pack-monster-path-data.ts'
import { getSharedDataRegistry, getSharedMountedArchives } from '../../../src/baker/mpq-archive-source.ts'
import {
  COLLIDE_CORPSE,
  COLLIDE_DOOR,
  COLLIDE_MASK_INVALID,
  COLLIDE_MONSTER,
  COLLIDE_NONE,
  COLLIDE_PET,
  COLLIDE_WALL,
  COLLISION_CheckAnyCollisionWithPattern,
  COLLISION_CheckMask,
  COLLISION_CheckMaskWithPattern,
  COLLISION_CheckMaskWithSize,
  COLLISION_PATTERN_BIG_PET_PRESENCE,
  COLLISION_PATTERN_BIG_UNIT_PRESENCE,
  COLLISION_PATTERN_SMALL_NO_PRESENCE,
  COLLISION_PATTERN_SMALL_PET_PRESENCE,
  COLLISION_PATTERN_SMALL_UNIT_PRESENCE,
  COLLISION_ResetMaskWithPattern,
  COLLISION_SetMaskWithPattern,
  D2AssertError,
  D2COMMON_10170_PathSetTargetPos,
  D2COMMON_10190_PATH_SetDistance,
  D2COMMON_10212_PATH_SetMoveFlags,
  D2COMMON_ORDINALS_113C,
  D2Common_10142,
  D2Common_10153,
  D2Common_10213,
  D2Common_10226,
  D2Common_10227,
  D2Common_10229,
  D2Common_10230,
  D2Common_10231,
  D2Common_10232,
  D2Common_10399,
  D2Common_10434_FaceSubtile,
  DUNGEON_GetRoomAtPosition,
  MONMODE_DEAD,
  MONMODE_WALK,
  MONSTER_PATH_DATA,
  MONSTER_PATH_DATA_STRIDE,
  MONSTER_PATH_IDS,
  MONSTATS2_TXT_RECORD_COUNT,
  MONSTATS_TXT_RECORD_COUNT,
  PATHTYPE_ASTAR,
  PATHTYPE_BACKUP_TURN,
  PATHTYPE_IDASTAR,
  PATHTYPE_KNOCKBACK_CLIENT,
  PATHTYPE_KNOCKBACK_SERVER,
  PATHTYPE_LEAP,
  PATHTYPE_STRAIGHT,
  PATHTYPE_TOWARD,
  PATHTYPE_WALL_FOLLOW,
  PATH_AddCollisionFootprintForUnit,
  PATH_AllocDynamicPath,
  PATH_GetDirection,
  PATH_GetFootprintCollisionMask,
  PATH_GetNumberOfPathPoints,
  PATH_GetPathPoints,
  PATH_GetPrecisionX,
  PATH_GetXPosition,
  PATH_GetYPosition,
  PATH_RemoveCollisionFootprintForUnit,
  PATH_SetIDAStarInitFScore,
  PATH_SetNewDistance,
  PATH_SetStepNum,
  PATH_SetTargetUnit,
  PATH_SetType,
  PATH_SetUnitAliveCollision,
  PATH_SetUnitDeadCollision,
  PATH_SetVelocity,
  PATH_UNKNOWN_FLAG_0x00020,
  type PathCollisionGrid,
  type PathPoint,
  type PathRoom,
  type PathUnit,
  UNIT_MONSTER,
  UNIT_PLAYER,
  buildAdjacentRoomLists,
  getMonsterPathRecord,
  toFP16Center,
} from '../../../src/common/path/index.ts'

// ---------------------------------------------------------------------------
// Synthetic multi-room world helpers
// ---------------------------------------------------------------------------

interface MutableRoom extends PathRoom {
  adjacentRooms: PathRoom[]
  readonly raw: Uint16Array
}

function createRoom(subX: number, subY: number, subW: number, subH: number, isTown = false): MutableRoom {
  const raw = new Uint16Array(subW * subH)
  const grid: PathCollisionGrid = {
    get(x: number, y: number): number {
      const lx = x - subX
      const ly = y - subY
      if (lx < 0 || lx >= subW || ly < 0 || ly >= subH) {
        throw new Error(`Grid out-of-bounds read at (${x},${y}) for room (${subX},${subY},${subW},${subH})`)
      }
      return raw[ly * subW + lx]!
    },
    set(x: number, y: number, value: number): void {
      const lx = x - subX
      const ly = y - subY
      if (lx < 0 || lx >= subW || ly < 0 || ly >= subH) {
        throw new Error(`Grid out-of-bounds write at (${x},${y}) for room (${subX},${subY},${subW},${subH})`)
      }
      raw[ly * subW + lx] = value & 0xffff
    },
  }
  return {
    subX,
    subY,
    subW,
    subH,
    isTown,
    adjacentRooms: [],
    grid,
    raw,
  }
}

function linkWorld(rooms: MutableRoom[]): void {
  const map = buildAdjacentRoomLists(rooms)
  for (const r of rooms) {
    r.adjacentRooms = map.get(r)!
  }
}

function createTestUnit(
  unitType: number,
  classId: number,
  unitId: number,
  room: PathRoom | null,
  x: number,
  y: number,
  bClientFlag = false,
): PathUnit {
  const unit: PathUnit = {
    dwUnitType: unitType,
    dwClassId: classId,
    dwUnitId: unitId,
    dwAnimMode: unitType === UNIT_MONSTER ? MONMODE_WALK : 1,
    dwFlags: 0,
    dwFlagEx: 0,
    pDynamicPath: null,
    pStaticPath: null,
    objectTxt: null,
  }
  PATH_AllocDynamicPath(room, x, y, unit, bClientFlag)
  return unit
}

function readPathPoints(unit: PathUnit): PathPoint[] {
  const p = unit.pDynamicPath!
  const { pPathPoints, nCount } = PATH_GetPathPoints(p)
  expect(nCount).toBe(PATH_GetNumberOfPathPoints(p))
  return pPathPoints.slice(0, nCount).map(pt => ({ X: pt.X, Y: pt.Y }))
}

// ---------------------------------------------------------------------------
// 1. Baked MPQ Monster Data Parity
// ---------------------------------------------------------------------------

describe('1.13c Monster Path Data (MonStats / MonStats2 MPQ Parity)', () => {
  it('matches MonStats.txt and MonStats2.txt row-by-row via getSharedDataRegistry', async () => {
    const [reg, archives] = await Promise.all([getSharedDataRegistry(), getSharedMountedArchives()])
    const packed = buildMonsterPathData(
      reg.monStatsTable,
      reg.monStats2Table,
      archives.readBytes(MONSTATS_BIN_PATH),
      archives.readBytes(MONSTATS2_BIN_PATH),
      reg.animData,
    )

    expect(packed.monStatsCount).toBe(MONSTATS_TXT_RECORD_COUNT)
    expect(packed.monStats2Count).toBe(MONSTATS2_TXT_RECORD_COUNT)
    expect(packed.ids).toEqual(MONSTER_PATH_IDS)
    expect(packed.rows).toEqual(MONSTER_PATH_DATA)
    expect(MONSTER_PATH_DATA.length).toBe(MONSTATS_TXT_RECORD_COUNT * MONSTER_PATH_DATA_STRIDE)

    // Verify rendered module matches committed file byte-for-byte
    const rendered = await packMonsterPathData(process.cwd(), true)
    expect(rendered).toBe(renderMonsterPathDataModule(packed))
  })

  it('provides accurate records for skeleton1 (0), wraith1 (38), and fails fast on out-of-range classId', () => {
    const skel = getMonsterPathRecord(0) // skeleton1
    expect(skel.baseId).toBe(0)
    expect(skel.sizeX).toBe(2)
    expect(skel.sizeY).toBe(2)
    expect(skel.velocity).toBeGreaterThan(0)
    expect(skel.walkAnimSpeed).toBeGreaterThan(0)
    expect((skel.modeFlags & (1 << MONMODE_WALK)) !== 0).toBe(true)

    const wraith = getMonsterPathRecord(38) // ghost1 / wraith1 base
    expect(wraith.baseId).toBe(38)

    expect(() => getMonsterPathRecord(-1)).toThrow(D2AssertError)
    expect(() => getMonsterPathRecord(MONSTATS_TXT_RECORD_COUNT)).toThrow(D2AssertError)
  })
})

// ---------------------------------------------------------------------------
// 2. Room Adjacency & Collision Primitives
// ---------------------------------------------------------------------------

describe('1.13c Room Adjacency & Collision Footprints', () => {
  it('buildAdjacentRoomLists implements DrlgDrlgRoom.cpp:601 tile-gap < 6 and bubble sort', () => {
    // 3 disjoint rooms in a horizontal line, each 20x20 sub-tiles (4x4 tiles), plus 1 distant room at X=100 (tile 20)
    const r0 = createRoom(0, 0, 20, 20)
    const r1 = createRoom(20, 0, 20, 20) // gap from r0 = (4 - 4 - 0) = 0 tiles (< 6, so adjacent)
    const r2 = createRoom(40, 0, 20, 20) // gap from r0 = (8 - 4 - 0) = 4 tiles (< 6, so adjacent)
    const rFar = createRoom(100, 0, 20, 20) // gap from r0 = (20 - 4 - 0) = 16 tiles (>= 6, so not adjacent to r0)
    linkWorld([rFar, r2, r1, r0])

    expect(r0.adjacentRooms).toContain(r0)
    expect(r0.adjacentRooms).toContain(r1)
    expect(r0.adjacentRooms).toContain(r2)
    expect(r0.adjacentRooms).not.toContain(rFar)

    // Bubble sort places disjoint rooms in ascending tile X/Y order
    expect(r0.adjacentRooms[0]).toBe(r0)
    expect(r0.adjacentRooms[1]).toBe(r1)
    expect(r0.adjacentRooms[2]).toBe(r2)
  })

  it('returns COLLIDE_MASK_INVALID (0x27) or masked nMask for cells outside any room or when room is null', () => {
    const r0 = createRoom(100, 100, 40, 40)
    linkWorld([r0])

    expect(COLLISION_CheckMask(null, 110, 110, COLLIDE_WALL)).toBe(COLLIDE_MASK_INVALID)
    expect(COLLISION_CheckMask(r0, 50, 50, COLLIDE_WALL)).toBe(COLLIDE_MASK_INVALID)
    // Pattern 1 (SMALL_UNIT_PRESENCE) delegates to COLLISION_CheckCollisionMaskWithAdjacentCells, which returns nMask & 0xffff when room is null
    expect(COLLISION_CheckMaskWithPattern(r0, 50, 50, COLLISION_PATTERN_SMALL_UNIT_PRESENCE, COLLIDE_WALL)).toBe(
      COLLIDE_WALL,
    )
    // Pattern 2 (BIG_UNIT_PRESENCE) delegates to COLLISION_CheckCollisionMaskForBoundingBoxRecursively, which returns COLLIDE_MASK_INVALID
    expect(COLLISION_CheckMaskWithPattern(r0, 50, 50, COLLISION_PATTERN_BIG_UNIT_PRESENCE, COLLIDE_WALL)).toBe(
      COLLIDE_MASK_INVALID,
    )
    // Size 2 delegates to COLLISION_CheckCollisionMaskWithAdjacentCells (returns nMask & 0xffff), Size 3 delegates to 3x3 box (returns COLLIDE_MASK_INVALID)
    expect(COLLISION_CheckMaskWithSize(r0, 50, 50, 2, COLLIDE_WALL)).toBe(COLLIDE_WALL)
    expect(COLLISION_CheckMaskWithSize(r0, 50, 50, 3, COLLIDE_WALL)).toBe(COLLIDE_MASK_INVALID)
  })

  it('stamps and resets all 5 collision patterns including cross-room boundary splitting', () => {
    const rLeft = createRoom(100, 100, 40, 40)
    const rRight = createRoom(140, 100, 40, 40)
    linkWorld([rLeft, rRight])

    // Pattern 1 (SMALL_UNIT_PRESENCE) at boundary x=139 spills its eastern point into x=140 in rRight
    COLLISION_SetMaskWithPattern(rLeft, 139, 120, COLLISION_PATTERN_SMALL_UNIT_PRESENCE, COLLIDE_MONSTER)
    expect(rLeft.grid!.get(139, 120) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)
    expect(rLeft.grid!.get(139, 120) & 0x1000).toBe(0x1000) // COLLIDE_NO_PATH on unit presence center
    expect(rLeft.grid!.get(138, 120) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)
    expect(rRight.grid!.get(140, 120) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)

    expect(
      COLLISION_CheckAnyCollisionWithPattern(rLeft, 139, 120, COLLISION_PATTERN_SMALL_UNIT_PRESENCE, COLLIDE_MONSTER),
    ).toBe(1)

    COLLISION_ResetMaskWithPattern(rLeft, 139, 120, COLLISION_PATTERN_SMALL_UNIT_PRESENCE, COLLIDE_MONSTER)
    expect(rLeft.grid!.get(139, 120)).toBe(COLLIDE_NONE)
    expect(rLeft.grid!.get(138, 120)).toBe(COLLIDE_NONE)
    expect(rRight.grid!.get(140, 120)).toBe(COLLIDE_NONE)

    // Pattern 2 (BIG_UNIT_PRESENCE): 3x3 box + 0x1000 on 5-point cross, straddling x=138 through 140
    COLLISION_SetMaskWithPattern(rLeft, 139, 120, COLLISION_PATTERN_BIG_UNIT_PRESENCE, COLLIDE_MONSTER)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const room = 139 + dx < 140 ? rLeft : rRight
        expect(room.grid!.get(139 + dx, 120 + dy) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)
      }
    }
    COLLISION_ResetMaskWithPattern(rLeft, 139, 120, COLLISION_PATTERN_BIG_UNIT_PRESENCE, COLLIDE_MONSTER)
    expect(rLeft.grid!.get(139, 120)).toBe(COLLIDE_NONE)
    expect(rRight.grid!.get(140, 120)).toBe(COLLIDE_NONE)

    // Pattern 3 (SMALL_PET_PRESENCE) and Pattern 4 (BIG_PET_PRESENCE): center gets 0x2000 (COLLIDE_PET)
    COLLISION_SetMaskWithPattern(rLeft, 120, 120, COLLISION_PATTERN_SMALL_PET_PRESENCE, COLLIDE_MONSTER)
    expect(rLeft.grid!.get(120, 120) & COLLIDE_PET).toBe(COLLIDE_PET)
    COLLISION_ResetMaskWithPattern(rLeft, 120, 120, COLLISION_PATTERN_SMALL_PET_PRESENCE, COLLIDE_MONSTER)
    expect(rLeft.grid!.get(120, 120)).toBe(COLLIDE_NONE)

    COLLISION_SetMaskWithPattern(rLeft, 120, 120, COLLISION_PATTERN_BIG_PET_PRESENCE, COLLIDE_MONSTER)
    expect(rLeft.grid!.get(120, 120) & COLLIDE_PET).toBe(COLLIDE_PET)
    COLLISION_ResetMaskWithPattern(rLeft, 120, 120, COLLISION_PATTERN_BIG_PET_PRESENCE, COLLIDE_MONSTER)
    expect(rLeft.grid!.get(120, 120)).toBe(COLLIDE_NONE)
  })

  it('handles monster corpse collision (#10084 PATH_SetUnitDeadCollision) and revival (#10938 PATH_SetUnitAliveCollision)', () => {
    const room = createRoom(100, 100, 40, 40)
    linkWorld([room])

    // Spawn bighead1 (hcIdx 10, SizeX 3 -> pattern 2 BIG_UNIT_PRESENCE) at (120, 120)
    const mon = createTestUnit(UNIT_MONSTER, 10, 10, room, 120, 120, true)
    expect(mon.pDynamicPath!.dwCollisionPattern).toBe(COLLISION_PATTERN_BIG_UNIT_PRESENCE)
    expect(PATH_GetFootprintCollisionMask(mon.pDynamicPath)).toBe(COLLIDE_MONSTER)
    expect(room.grid!.get(120, 120) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)

    // Client death: PATH_SetUnitDeadCollision(mon, 0) removes monster footprint and stamps pattern 5 with 0x8000 (COLLIDE_CORPSE)
    PATH_SetUnitDeadCollision(mon, 0)
    expect(mon.pDynamicPath!.dwCollisionPattern).toBe(COLLISION_PATTERN_SMALL_NO_PRESENCE)
    expect(PATH_GetFootprintCollisionMask(mon.pDynamicPath)).toBe(COLLIDE_CORPSE)
    expect(room.grid!.get(120, 120) & COLLIDE_MONSTER).toBe(0)
    expect(room.grid!.get(120, 120) & COLLIDE_CORPSE).toBe(COLLIDE_CORPSE)

    // While in MONMODE_DEATH / MONMODE_DEAD, non-forced PATH_RemoveCollisionFootprintForUnit returns false
    mon.dwAnimMode = MONMODE_DEAD
    expect(PATH_RemoveCollisionFootprintForUnit(mon, false)).toBe(false)
    expect(room.grid!.get(120, 120) & COLLIDE_CORPSE).toBe(COLLIDE_CORPSE)

    // Client revive: PATH_SetUnitAliveCollision(mon, 0) restores pattern 2 and COLLIDE_MONSTER
    mon.dwAnimMode = MONMODE_WALK
    PATH_SetUnitAliveCollision(mon, 0)
    expect(mon.pDynamicPath!.dwCollisionPattern).toBe(COLLISION_PATTERN_BIG_UNIT_PRESENCE)
    expect(PATH_GetFootprintCollisionMask(mon.pDynamicPath)).toBe(COLLIDE_MONSTER)
    expect(room.grid!.get(120, 120) & COLLIDE_CORPSE).toBe(0)
    expect(room.grid!.get(120, 120) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)
  })
})

// ---------------------------------------------------------------------------
// 3. Pathfinder Algorithms & D2Common_10142 (#10334)
// ---------------------------------------------------------------------------

describe('1.13c Path Computation (D2Common_10142 / #10334)', () => {
  it('rejects start == target and |dx| > 100 or |dy| > 100', () => {
    const r0 = createRoom(100, 100, 150, 150)
    linkWorld([r0])
    const mon = createTestUnit(UNIT_MONSTER, 0, 1, r0, 120, 120, true)
    const path = mon.pDynamicPath!

    // start == target -> 0 points, flag 0x20 cleared
    D2COMMON_10170_PathSetTargetPos(path, 120, 120)
    expect(D2Common_10142(path, mon, 0)).toBe(0)
    expect(path.dwFlags & PATH_UNKNOWN_FLAG_0x00020).toBe(0)

    // |dx| = 101 > 100 -> 0 points
    D2COMMON_10170_PathSetTargetPos(path, 221, 120)
    expect(D2Common_10142(path, mon, 0)).toBe(0)
    expect(path.dwFlags & PATH_UNKNOWN_FLAG_0x00020).toBe(0)
  })

  it('computes PATHTYPE_TOWARD (2) in open space and slides around a wall', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    const mon = createTestUnit(UNIT_MONSTER, 0, 1, r0, 110, 120, true)
    const path = mon.pDynamicPath!

    // Open space straight east to (120, 120)
    PATH_SetType(path, PATHTYPE_TOWARD)
    D2COMMON_10170_PathSetTargetPos(path, 120, 120)
    const nOpen = D2Common_10142(path, mon, 0)
    expect(nOpen).toBeGreaterThan(0)
    const openPts = readPathPoints(mon)
    expect(openPts[openPts.length - 1]).toEqual({ X: 120, Y: 120 })
    expect(path.dwFlags & PATH_UNKNOWN_FLAG_0x00020).toBe(PATH_UNKNOWN_FLAG_0x00020)

    // Place a single wall cell at (115, 120): initial raytrace stops at (113, 120), then the 3-candidate
    // loop steps diagonally to (114, 121) and stops when candidate 0/1 touch (115, 120) and candidate 2 is PATH_DIR_NULL
    r0.grid!.set(115, 120, COLLIDE_WALL)
    D2COMMON_10170_PathSetTargetPos(path, 120, 120)
    const nAround = D2Common_10142(path, mon, 0)
    expect(nAround).toBe(3)
    const aroundPts = readPathPoints(mon)
    expect(aroundPts[aroundPts.length - 1]).toEqual({ X: 114, Y: 121 })
    // Every point along the returned path must be collision-free for the monster's pattern
    PATH_RemoveCollisionFootprintForUnit(mon, true)
    for (const pt of aroundPts) {
      expect(
        COLLISION_CheckAnyCollisionWithPattern(
          r0,
          pt.X,
          pt.Y,
          path.dwCollisionPattern,
          path.nMoveTestCollisionMask,
        ),
      ).toBe(0)
    }
    PATH_AddCollisionFootprintForUnit(mon)
  })

  it('computes PATHTYPE_ASTAR (1) around a vertical obstacle to reach the exact target', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    const mon = createTestUnit(UNIT_MONSTER, 0, 1, r0, 110, 110, true)
    const path = mon.pDynamicPath!
    PATH_SetType(path, PATHTYPE_ASTAR)
    PATH_SetNewDistance(path, 50)

    // Vertical wall at x=114, y=106 through y=114
    for (let y = 106; y <= 114; y++) {
      r0.grid!.set(114, y, COLLIDE_WALL)
    }

    D2COMMON_10170_PathSetTargetPos(path, 118, 110)
    const nPts = D2Common_10142(path, mon, 0)
    expect(nPts).toBeGreaterThan(1)
    const pts = readPathPoints(mon)
    expect(pts[pts.length - 1]).toEqual({ X: 118, Y: 110 })
    // Must route around the wall (either y < 106 or y > 114 when crossing x=114)
    expect(pts.some(p => p.Y < 106 || p.Y > 114)).toBe(true)
  })

  it('computes PATHTYPE_IDASTAR (0) around an obstacle when within IDA* budget', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    const plr = createTestUnit(UNIT_PLAYER, 0, 1, r0, 110, 110, true)
    const path = plr.pDynamicPath!
    PATH_SetType(path, PATHTYPE_IDASTAR)
    PATH_SetIDAStarInitFScore(path, 70)

    // Small obstacle at x=113, y=109 through y=111
    for (let y = 109; y <= 111; y++) {
      r0.grid!.set(113, y, COLLIDE_WALL)
    }

    D2COMMON_10170_PathSetTargetPos(path, 116, 110)
    const nPts = D2Common_10142(path, plr, 0)
    expect(nPts).toBeGreaterThan(1)
    const pts = readPathPoints(plr)
    expect(pts[pts.length - 1]).toEqual({ X: 116, Y: 110 })
  })

  it('PATHTYPE_STRAIGHT (7) falls back from TOWARD to A* when squared remaining distance <= 324 (18 sub-tiles)', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    const mon = createTestUnit(UNIT_MONSTER, 0, 1, r0, 110, 120, true)
    const path = mon.pDynamicPath!

    // Construct a U-shaped cup (x=115, y=116 through 124, with arms going left at y=116 and y=124 from x=111 through 115)
    // so greedy TOWARD gets trapped inside the cup at a point within 18 sub-tiles of (120, 120),
    // whereas STRAIGHT (7) invokes A* because dist^2 <= 324 and routes outside the cup to (120, 120).
    for (let y = 116; y <= 124; y++) r0.grid!.set(115, y, COLLIDE_WALL)
    for (let x = 111; x <= 115; x++) {
      r0.grid!.set(x, 116, COLLIDE_WALL)
      r0.grid!.set(x, 124, COLLIDE_WALL)
    }

    // 1. TOWARD (2) cannot reach (120, 120)
    PATH_SetType(path, PATHTYPE_TOWARD)
    PATH_SetNewDistance(path, 50)
    D2COMMON_10170_PathSetTargetPos(path, 120, 120)
    D2Common_10142(path, mon, 0)
    const towardEnd = readPathPoints(mon).at(-1)
    expect(towardEnd).not.toEqual({ X: 120, Y: 120 })

    // 2. STRAIGHT (7) runs TOWARD, sees remaining dist^2 <= 324, switches to A*, and reaches (120, 120)
    PATH_SetType(path, PATHTYPE_STRAIGHT)
    PATH_SetNewDistance(path, 50)
    D2COMMON_10170_PathSetTargetPos(path, 120, 120)
    const nStraight = D2Common_10142(path, mon, 0)
    expect(nStraight).toBeGreaterThan(1)
    const straightPts = readPathPoints(mon)
    expect(straightPts[straightPts.length - 1]).toEqual({ X: 120, Y: 120 })
  })

  it('PATHTYPE_WALL_FOLLOW (15) slides along obstacles via Bresenham + subpath replacement', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    const mon = createTestUnit(UNIT_MONSTER, 0, 1, r0, 110, 120, true)
    const path = mon.pDynamicPath!
    PATH_SetType(path, PATHTYPE_WALL_FOLLOW)
    PATH_SetNewDistance(path, 40)

    for (let y = 118; y <= 122; y++) r0.grid!.set(114, y, COLLIDE_WALL)
    D2COMMON_10170_PathSetTargetPos(path, 120, 120)
    const nPts = D2Common_10142(path, mon, 0)
    expect(nPts).toBeGreaterThan(0)
    expect(readPathPoints(mon).at(-1)).toEqual({ X: 120, Y: 120 })
  })

  it('PATHTYPE_WALL_FOLLOW (15) terminates per 1.13c 0x6FD68AA6..0x6FD68AB3 when a synced probe finishes', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    const mon = createTestUnit(UNIT_MONSTER, 0, 1, r0, 110, 120, true)
    const path = mon.pDynamicPath!
    PATH_SetType(path, PATHTYPE_WALL_FOLLOW)
    PATH_SetNewDistance(path, 7)

    // Pocket where tCache1 (CW) and tCache2 (CCW) converge at (109, 119) with tCache1.nPoints == 2
    // and tCache2 reaches nLastSyncPointWithOtherPathIndex = 2 right as bPathFinished becomes true.
    const walls: Array<[number, number]> = [
      [111, 120],
      [111, 121],
      [110, 121],
      [111, 119],
      [109, 121],
      [108, 120],
      [110, 118],
    ]
    for (const [wx, wy] of walls) {
      r0.grid!.set(wx, wy, COLLIDE_WALL)
    }
    D2COMMON_10170_PathSetTargetPos(path, 114, 120)
    expect(() => D2Common_10142(path, mon, 0)).not.toThrow()
  })

  it('PATHTYPE_KNOCKBACK_CLIENT (11) raytraces and stops at the last collision-free cell before a wall', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    // Use wraith1 (38, SizeX=2, pattern SMALL_UNIT_PRESENCE, mask 0x804; 0x4 = COLLIDE_MISSILE_BARRIER)
    const mon = createTestUnit(UNIT_MONSTER, 38, 1, r0, 110, 120, true)
    const path = mon.pDynamicPath!
    PATH_SetType(path, PATHTYPE_KNOCKBACK_CLIENT)

    // Barrier at x=116, y=120 -> SizeX=2 (+ cross) touches x=116 from center x=115, so last collision-free center is x=114
    r0.grid!.set(116, 120, 0x0004)
    D2COMMON_10170_PathSetTargetPos(path, 120, 120)
    const nPts = D2Common_10142(path, mon, 0)
    expect(nPts).toBe(1)
    expect(readPathPoints(mon)).toEqual([{ X: 114, Y: 120 }])
  })

  it('supports PATHTYPE_KNOCKBACK_SERVER (8), PATHTYPE_LEAP (9), and PATHTYPE_BACKUP_TURN (12)', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    const mon = createTestUnit(UNIT_MONSTER, 38, 1, r0, 120, 120, true)
    const path = mon.pDynamicPath!

    PATH_SetType(path, PATHTYPE_KNOCKBACK_SERVER)
    D2COMMON_10190_PATH_SetDistance(path, 5)
    D2COMMON_10170_PathSetTargetPos(path, 130, 120)
    expect(D2Common_10142(path, mon, 0)).toBeGreaterThan(0)

    PATH_SetType(path, PATHTYPE_LEAP)
    D2COMMON_10170_PathSetTargetPos(path, 128, 120)
    expect(D2Common_10142(path, mon, 0)).toBe(1)
    expect(readPathPoints(mon)[0]).toEqual({ X: 128, Y: 120 })

    PATH_SetType(path, PATHTYPE_BACKUP_TURN)
    D2COMMON_10170_PathSetTargetPos(path, 125, 120)
    expect(D2Common_10142(path, mon, 0)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 4. Per-Tick Step (D2Common_10226 / #10342), Velocity Math & Re-Target
// ---------------------------------------------------------------------------

describe('1.13c Per-Tick Step (D2Common_10226 / #10342) & Fixed-Point Velocity Math', () => {
  it('moves 1 sub-tile/tick at dwVelocity=4096 on a cardinal axis and matches exact 16.16 math at 75% MonStats Velocity=1 (dwVelocity=192)', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])

    const mon = createTestUnit(UNIT_MONSTER, 38, 1, r0, 110, 120, true)
    const path = mon.pDynamicPath!
    PATH_SetType(path, PATHTYPE_TOWARD)
    D2COMMON_10170_PathSetTargetPos(path, 120, 120)

    // Test 1: dwVelocity = 4096 due East (direction vector = (4096, 0)):
    // In sub_6FD5CEB0(path, 0):
    //   nVelocityMagnitude = (4096 * 1024) >> 6 = 65536
    //   tVelocityVector.nX = (4096 * 65536) >> 12 = 65536 = 0x10000 = 1.0 sub-tile/tick
    PATH_SetVelocity(path, 4096, __FILE__, __LINE__)
    expect(D2Common_10142(path, mon, 0)).toBeGreaterThan(0)

    const startPrecX = PATH_GetPrecisionX(path)
    expect(startPrecX).toBe(toFP16Center(110))
    expect(D2Common_10226(mon, 0)).toBe(1)
    expect(PATH_GetPrecisionX(path)).toBe(toFP16Center(111))
    expect(PATH_GetXPosition(path)).toBe(111)

    // Test 2: MonStats Velocity = 1 at 75% -> packet velPct = 75 -> dwVelocity = floor(75 * (1 << 8) / 100) = 192
    // In sub_6FD5CEB0(path, 0):
    //   nVelocityMagnitude = (192 * 1024) >> 6 = 3072
    //   tVelocityVector.nX = (4096 * 3072) >> 12 = 3072 (3072 / 65536 = 192 / 4096 sub-tiles/tick)
    D2Common_10230(path, mon, r0, 110, 120)
    PATH_SetVelocity(path, 192, __FILE__, __LINE__)
    D2COMMON_10170_PathSetTargetPos(path, 115, 120)
    expect(D2Common_10142(path, mon, 0)).toBeGreaterThan(0)

    const basePrecX = toFP16Center(110)
    const seq: number[] = []
    for (let tick = 1; tick <= 5; tick++) {
      expect(D2Common_10226(mon, 0)).toBe(1)
      seq.push(PATH_GetPrecisionX(path))
    }
    expect(seq).toEqual([
      basePrecX + 3072 * 1,
      basePrecX + 3072 * 2,
      basePrecX + 3072 * 3,
      basePrecX + 3072 * 4,
      basePrecX + 3072 * 5,
    ])
  })

  it('stops on unexpected obstacle during D2Common_10226 and sets nCollidedWithMask', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])

    // Server monster (bClientFlag = false): stops when blocked and records nCollidedWithMask
    const srvMon = createTestUnit(UNIT_MONSTER, 0, 1, r0, 110, 120, false)
    const srvPath = srvMon.pDynamicPath!
    PATH_SetVelocity(srvPath, 4096, __FILE__, __LINE__)
    D2COMMON_10170_PathSetTargetPos(srvPath, 115, 120)
    expect(D2Common_10142(srvPath, srvMon, 0)).toBeGreaterThan(0)

    // Drop a wall at x=112 after the path was computed (pattern 1 SMALL_UNIT_PRESENCE extends to x+1, so stepping to x=111 touches x=112)
    for (let y = 115; y <= 125; y++) r0.grid!.set(112, y, COLLIDE_WALL)
    expect(D2Common_10226(srvMon, 0)).toBe(0)
    expect(srvPath.nCollidedWithMask & COLLIDE_WALL).toBe(COLLIDE_WALL)
    expect(srvPath.dwFlags & PATH_UNKNOWN_FLAG_0x00020).toBe(0)
    expect(srvPath.dwPathPoints).toBe(0)
  })

  it('upgrades open-doors mask 0x3401 to 0x3C01 during sub_6FD5D420 so monsters stop at closed doors', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    // skeleton1 (hcIdx 0) has opendoors=1 -> nMoveTestCollisionMask = 0x3401 (ignores COLLIDE_DOOR 0x800 during pathfind)
    const zombie = createTestUnit(UNIT_MONSTER, 0, 2, r0, 110, 120, false)
    const zPath = zombie.pDynamicPath!
    expect(zPath.nMoveTestCollisionMask).toBe(0x3401)

    // Closed door at x=113
    for (let y = 118; y <= 122; y++) r0.grid!.set(113, y, COLLIDE_DOOR)
    PATH_SetVelocity(zPath, 4096, __FILE__, __LINE__)
    D2COMMON_10170_PathSetTargetPos(zPath, 116, 120)
    // Path computation succeeds through the door because 0x3401 & 0x800 == 0
    expect(D2Common_10142(zPath, zombie, 0)).toBeGreaterThan(0)

    // Stepping upgrades 0x3401 to 0x3C01 and stops when the footprint hits COLLIDE_DOOR (0x800)
    let ticks = 0
    while (D2Common_10226(zombie, 0) !== 0 && ticks < 10) ticks++
    expect(zPath.nCollidedWithMask & COLLIDE_DOOR).toBe(COLLIDE_DOOR)
    expect(PATH_GetXPosition(zPath)).toBeLessThan(113)
  })

  it('enforces sub_6FD5DB70 target-following rules: stop when D2Common_10399 <= nStepNum, keep path when target moves <= 5, re-path when > 5', () => {
    const r0 = createRoom(100, 100, 80, 80)
    linkWorld([r0])

    const player = createTestUnit(UNIT_PLAYER, 0, 1, r0, 130, 120, true)
    const mon = createTestUnit(UNIT_MONSTER, 0, 2, r0, 110, 120, true)
    const mPath = mon.pDynamicPath!

    PATH_SetType(mPath, PATHTYPE_TOWARD)
    PATH_SetVelocity(mPath, 2048, __FILE__, __LINE__)
    PATH_SetTargetUnit(mPath, player)
    PATH_SetStepNum(mPath, 2) // nStepNum = 1
    expect(D2Common_10142(mPath, mon, 0)).toBeGreaterThan(0)
    expect(mPath.tPrevTargetCoord).toEqual({ X: 130, Y: 120 })

    // 1. Move player by (dx=4, dy=3) -> <= 5 on both axes -> keeps existing path without re-computing
    D2Common_10230(player.pDynamicPath!, player, r0, 134, 123)
    expect(D2Common_10226(mon, 0)).toBe(1)
    expect(mPath.tPrevTargetCoord).toEqual({ X: 130, Y: 120 }) // still (130, 120), not re-pathed

    // 2. Move player by (dx=6, dy=0) from tPrevTargetCoord (130 to 136) -> > 5 -> re-paths via D2Common_10236
    D2Common_10230(player.pDynamicPath!, player, r0, 136, 120)
    expect(D2Common_10226(mon, 0)).toBe(1)
    expect(mPath.tPrevTargetCoord).toEqual({ X: 136, Y: 120 }) // updated by D2Common_10142

    // 3. Teleport player right next to monster so D2Common_10399(player, mon) <= nStepNum (1) -> stops immediately
    const monX = PATH_GetXPosition(mPath)
    const monY = PATH_GetYPosition(mPath)
    D2Common_10230(player.pDynamicPath!, player, r0, monX + 1, monY)
    expect(D2Common_10399(player, mon)).toBeLessThanOrEqual(mPath.nStepNum)
    expect(D2Common_10226(mon, 0)).toBe(0)
    expect(mPath.dwFlags & PATH_UNKNOWN_FLAG_0x00020).toBe(0)
  })

  it('D2Common_10213 (#10340) triggers a client re-path on every second tick when UNITFLAGEX_UNK_PATH_RELATED is set', () => {
    const r0 = createRoom(100, 100, 60, 60)
    linkWorld([r0])
    const player = createTestUnit(UNIT_PLAYER, 0, 1, r0, 125, 120, true)
    const mon = createTestUnit(UNIT_MONSTER, 0, 2, r0, 110, 120, true)
    const mPath = mon.pDynamicPath!

    PATH_SetTargetUnit(mPath, player)
    D2COMMON_10212_PATH_SetMoveFlags(mon, true)

    // First call: increments unk0x38 from 0 to 1 -> returns false
    expect(D2Common_10213(mon)).toBe(false)
    expect(mPath.unk0x38).toBe(1)

    // Second call: unk0x38 becomes 2 (> 1), resets to 0, calls D2Common_10236 -> computes path and returns true
    expect(D2Common_10213(mon)).toBe(true)
    expect(mPath.unk0x38).toBe(0)
    expect(mPath.dwPathPoints).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 5. Teleports, Snaps & Ordinal Table
// ---------------------------------------------------------------------------

describe('1.13c Teleports (#10533, #10906, #10075, #10223) & Ordinal Map', () => {
  it('teleports across rooms, updates footprints, and sets unk0x38 = 15 on D2Common_10230 (#10906)', () => {
    const r0 = createRoom(100, 100, 40, 40)
    const r1 = createRoom(140, 100, 40, 40)
    linkWorld([r0, r1])

    const mon = createTestUnit(UNIT_MONSTER, 38, 1, r0, 115, 115, true)
    const path = mon.pDynamicPath!
    expect(r0.grid!.get(115, 115) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)

    // D2Common_10230 (#10906): drift/stop snap
    expect(D2Common_10230(path, mon, r1, 155, 115)).toBe(1)
    expect(path.pRoom).toBe(r1)
    expect(PATH_GetXPosition(path)).toBe(155)
    expect(PATH_GetYPosition(path)).toBe(115)
    expect(path.unk0x38).toBe(15)
    expect(r0.grid!.get(115, 115) & COLLIDE_MONSTER).toBe(0)
    expect(r1.grid!.get(155, 115) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)

    // D2Common_10229 (#10533): teleport and zero points
    expect(D2Common_10229(path, mon, r0, 120, 120)).toBe(1)
    expect(path.pRoom).toBe(r0)
    expect(PATH_GetXPosition(path)).toBe(120)
    expect(r1.grid!.get(155, 115) & COLLIDE_MONSTER).toBe(0)
    expect(r0.grid!.get(120, 120) & COLLIDE_MONSTER).toBe(COLLIDE_MONSTER)

    // D2Common_10231 (#10075): force teleport to (nX, nY) (fixes D2MOO wPosX/wPosY bug)
    expect(D2Common_10231(path, mon, r1, 160, 125)).toBe(1)
    expect(path.pRoom).toBe(r1)
    expect(PATH_GetXPosition(path)).toBe(160)
    expect(PATH_GetYPosition(path)).toBe(125)

    // D2Common_10232 (#10223): collision-checked teleport fails when destination is blocked
    r0.grid!.set(130, 130, 0x0004) // wraith1 mask is 0x804
    expect(D2Common_10232(path, mon, r0, 130, 130)).toBe(0)
    expect(PATH_GetXPosition(path)).toBe(160)
    expect(D2Common_10232(path, mon, r0, 125, 125)).toBe(1)
    expect(PATH_GetXPosition(path)).toBe(125)
  })

  it('exposes all D2Client-used 1.13c ordinals in D2COMMON_ORDINALS_113C', () => {
    expect(D2COMMON_ORDINALS_113C['#10334']).toBe(D2Common_10142)
    expect(D2COMMON_ORDINALS_113C['#10342']).toBe(D2Common_10226)
    expect(D2COMMON_ORDINALS_113C['#10906']).toBe(D2Common_10230)
    expect(D2COMMON_ORDINALS_113C['#10533']).toBe(D2Common_10229)
    expect(D2COMMON_ORDINALS_113C['#10075']).toBe(D2Common_10231)
    expect(D2COMMON_ORDINALS_113C['#10647']).toBe(PATH_SetType)
    expect(D2COMMON_ORDINALS_113C['#10168']).toBe(PATH_SetNewDistance)
    expect(D2COMMON_ORDINALS_113C['#11005']).toBe(PATH_SetStepNum)
    expect(D2COMMON_ORDINALS_113C['#10527']).toBe(D2COMMON_10190_PATH_SetDistance)
    expect(D2COMMON_ORDINALS_113C['#10286']).toBe(D2COMMON_10170_PathSetTargetPos)
    expect(D2COMMON_ORDINALS_113C['#10336']).toBe(PATH_SetTargetUnit)
    expect(D2COMMON_ORDINALS_113C['#10159']).toBe(D2Common_10153)
    expect(D2COMMON_ORDINALS_113C['#10434']).toBe(D2Common_10434_FaceSubtile)
    expect(D2COMMON_ORDINALS_113C['#10488']).toBe(PATH_SetVelocity)
    expect(D2COMMON_ORDINALS_113C['#10084']).toBe(PATH_SetUnitDeadCollision)
    expect(D2COMMON_ORDINALS_113C['#10407']).toBe(D2Common_10399)
    expect(D2COMMON_ORDINALS_113C['#10340']).toBe(D2Common_10213)
    expect(D2COMMON_ORDINALS_113C['#10369']).toBe(D2Common_10227)
    expect(D2COMMON_ORDINALS_113C['#10269']).toBe(PATH_GetDirection)
    expect(D2COMMON_ORDINALS_113C['#11022']).toBe(DUNGEON_GetRoomAtPosition)
  })
})

const __FILE__ = 'd2common-path-113c.test.ts'
const __LINE__ = 0
