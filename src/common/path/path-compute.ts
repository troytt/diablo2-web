/**
 * Diablo II 1.13c D2Common path computation (`D2Common_10142` / `#10334`) and all non-missile
 * pathfinder algorithms (Refs #808).
 *
 * Ported instruction-by-instruction from `D2Common.dll` 1.13c (ImageBase 0x6FD50000):
 * - `0x6FD86230` (`#10334` ≡ `D2Common_10142`) and its helpers (`0x6FD85470`, `0x6FD85160`,
 *   `0x6FD856E0`, `0x6FD85E00`, `0x6FD85D40`, `0x6FD84E70`)
 * - `0x6FDC0E40` (`PATH_IdaStar_6FDA7970`) + `0x6FDC0BB0` + `0x6FDC08F0` + `0x6FDC0840` +
 *   `0x6FDC07E0` + `0x6FDC0650` (`IDAStar.cpp`)
 * - `0x6FDCB630` (`PATH_AStar_ComputePath`) + `0x6FDCB2C0` + `0x6FDCB220` + `0x6FDCB3C0` +
 *   `0x6FDCAFB0` + `0x6FDCAC50` + `0x6FDCAE20` + `0x6FDCAF20` + `0x6FDCAED0` + `0x6FDCAF70` +
 *   `0x6FDCAB50` (`AStar.cpp`)
 * - `0x6FDB78B0` (`PATH_Toward_6FDAA9F0`) + `0x6FDB74C0` (`sub_6FDAA720`) + `0x6FDB71B0`
 *   (`sub_6FDAA880`) + `0x6FDB7630` (`PATH_CheckCollisionsToNextPosition`) + `0x6FDB6C20`
 *   (`PATH_RayTrace`) + `0x6FD8E190` (`sub_6FDAB610`/`sub_6FDAB6A0`) + `0x6FD8E2B0` (`sub_6FDABA50`)
 * - `0x6FDB7B70` (`sub_6FDAB0B0`, type 3)
 * - `0x6FDB7AD0` (`PATH_Straight_Compute`, type 7)
 * - `0x6FDB7390` (`PATH_Knockback_Server`, type 8)
 * - `0x6FDB77F0` (`PATH_Leap_6FDAB1E0`, type 9)
 * - `0x6FDB77C0` (`PATH_Knockback_Client`, type 11)
 * - `0x6FDB7850` (`PATH_BackupTurn_Compute`, type 12)
 * - `0x6FD68C40` (`PATH_ComputePathOrSlideAlongObstacles`, type 15) + `0x6FD684C0`
 *   (`PATH_BresenhamLine`) + `0x6FD68830` (`PATH_FindSubpathWithoutObstacles`) + `0x6FD686D0`
 *   (`PATH_FindNonCollidingTargetPoint`) + `0x6FD68400` (`PATH_ReplaceSubpathPoints`) +
 *   `0x6FD68310` (`PATH_SimplifyToLines`)
 *
 * Missile path types (4, 10, 14, 17; `PATH_MISSILE_MASK`) are out of scope for client monster
 * motion and throw {@link D2AssertError} if invoked.
 */

import {
  COLLISION_CheckAnyCollisionWithPattern,
  DUNGEON_GetRoomAtPosition,
} from './collision.ts'
import {
  D2COMMON_10170_PathSetTargetPos,
  PATH_AddCollisionFootprintForUnit,
  PATH_RemoveCollisionFootprintForUnit,
  sub_6FDA8220,
} from './path.ts'
import {
  PATHUtil_AdvanceTowardsTarget_6FDAB890,
  PATH_ComputeVelocityAndDirectionVectorsToNextPoint,
  _registerPathComputeImpl,
} from './step.ts'
import {
  ASTAR_HASH_X,
  ASTAR_HASH_Y,
  ASTAR_HEURISTIC,
  CHARGED_BOLT_DIR_OFFSETS,
  DIRECTION_TO_OFFSET_A,
  IDASTAR_COORD_OFFSETS,
  IDASTAR_NEIGHBORS_SEQUENCE,
  PREPARE_TARGET_DIRECTIONS,
  SNAP_TO_CARDINAL,
  TOWARD_DIRECTIONS,
} from './tables.ts'
import {
  type DynamicPath,
  type PathCoord,
  type PathInfo,
  type PathPoint,
  type PathRoom,
  type PathUnit,
  D2AssertError,
  MAXPATHLEN,
  PATHTYPE_ASTAR,
  PATHTYPE_BACKUP_TURN,
  PATHTYPE_COUNT,
  PATHTYPE_IDASTAR,
  PATHTYPE_KNOCKBACK_CLIENT,
  PATHTYPE_KNOCKBACK_SERVER,
  PATHTYPE_LEAP,
  PATHTYPE_MISSILE,
  PATHTYPE_MISSILE_STREAM,
  PATHTYPE_MON_CIRCLE_CCW,
  PATHTYPE_MON_CIRCLE_CW,
  PATHTYPE_STRAIGHT,
  PATHTYPE_TOWARD,
  PATHTYPE_TOWARD_FINISH,
  PATHTYPE_UNKNOWN_3,
  PATHTYPE_WALL_FOLLOW,
  PATH_DIR_NULL,
  PATH_MISSILE_MASK,
  PATH_UNKNOWN_FLAG_0x00010,
  PATH_UNKNOWN_FLAG_0x00020,
  PATH_UNKNOWN_FLAG_0x00800,
  PATH_UNKNOWN_FLAG_0x01000,
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNIT_TYPES_COUNT,
  copyPoint,
  createPathInfo,
  d2Assert,
  i16,
  i32,
  idiv,
  pointsEqual,
  u16,
  u32,
  u8,
} from './types.ts'
import {
  MONSTERS_CanBeInTown,
  UNITS_GetUnitSizeX,
  UNITS_GetXPosition,
  UNITS_GetYPosition,
  UNITS_IsDoor,
} from './units.ts'

// ---------------------------------------------------------------------------
// Direction octant / sector helpers (0x6FD8E190, 0x6FD8E2B0)
// ---------------------------------------------------------------------------

/**
 * `sub_6FDAB610` / `sub_6FDAB6A0` (1.13c 0x6FD8E190, stdcall pPoint1, pPoint2; D2MOO PathMisc.cpp:768).
 * Maps `(pPoint2 - pPoint1)` into a 0..24 sector index for {@link TOWARD_DIRECTIONS} (`0x6FDDC320`)
 * and {@link PREPARE_TARGET_DIRECTIONS} (`0x6FDDC450`).
 */
export function sub_6FDAB610(nX1: number, nY1: number, nX2: number, nY2: number): number {
  let nDiffX = (nX2 - nX1) | 0
  let nDiffY = (nY2 - nY1) | 0
  const nAbsDiffX = nDiffX < 0 ? -nDiffX | 0 : nDiffX
  const nAbsDiffY = nDiffY < 0 ? -nDiffY | 0 : nDiffY

  if (nAbsDiffX < ((2 * nAbsDiffY) | 0)) {
    if (nAbsDiffY >= ((2 * nAbsDiffX) | 0)) {
      if (nDiffX < 0) {
        if (nDiffY < -1) return 5
        if (nDiffY > 1) nDiffY = 2
        return (nDiffY + 7) | 0
      }
      nDiffX &= 1
    }
  } else {
    if (nDiffY >= 0) {
      nDiffY &= 1
    } else {
      nDiffY = -1
    }
  }

  if (nDiffX < -1) {
    nDiffX = -2
  } else if (nDiffX > 1) {
    nDiffX = 2
  }

  if (nDiffY < -1) {
    return (5 * nDiffX + 10) | 0
  }
  if (nDiffY > 1) {
    nDiffY = 2
  }
  return (nDiffY + 5 * nDiffX + 12) | 0
}

/** `sub_6FDAB6A0` (1.13c 0x6FD8E190; D2MOO PathMisc.cpp:847). */
export function sub_6FDAB6A0(pPoint1: PathPoint, pPoint2: PathPoint): number {
  return sub_6FDAB610(pPoint1.X, pPoint1.Y, pPoint2.X, pPoint2.Y)
}

/** `sub_6FDAB770` (1.13c 0x6FD8E5F0, inlined in IDA*; D2MOO PathMisc.cpp:860): primary direction 0..7. */
export function sub_6FDAB770(pPoint1: PathPoint, pPoint2: PathPoint): number {
  const idx = sub_6FDAB6A0(pPoint1, pPoint2)
  return TOWARD_DIRECTIONS[idx * 3]!
}

/** `PATH_GetDirections_6FDAB790` (inlined in 1.13c; D2MOO PathMisc.cpp:866): 3 candidate directions from `stru_6FDD2158`. */
export function PATH_GetDirections_6FDAB790(pTestDir: [number, number, number], pPoint1: PathPoint, pPoint2: PathPoint): void {
  const base = sub_6FDAB6A0(pPoint1, pPoint2) * 3
  pTestDir[0] = TOWARD_DIRECTIONS[base]!
  pTestDir[1] = TOWARD_DIRECTIONS[base + 1]!
  pTestDir[2] = TOWARD_DIRECTIONS[base + 2]!
}

/** `sub_6FDAB7D0` (inlined in 1.13c 0x6FD85E98; D2MOO PathMisc.cpp:879): 3 candidate directions from `byte_6FDD2288`. */
export function sub_6FDAB7D0(pTestDir: [number, number, number], pPoint1: PathPoint, pPoint2: PathPoint): void {
  const base = sub_6FDAB6A0(pPoint1, pPoint2) * 3
  pTestDir[0] = PREPARE_TARGET_DIRECTIONS[base]!
  pTestDir[1] = PREPARE_TARGET_DIRECTIONS[base + 1]!
  pTestDir[2] = PREPARE_TARGET_DIRECTIONS[base + 2]!
}

/**
 * `sub_6FDABA50` (1.13c 0x6FD8E2B0; D2MOO PathMisc.cpp:890).
 * Short-range 8x8 lookup (`0x6FDE3F20`) when `|dx| < 8 && |dy| < 8`, else `min + 2 * max`.
 */
export function sub_6FDABA50(pPoint1: PathPoint, pPoint2: PathPoint): number {
  let dx = (pPoint1.X - pPoint2.X) | 0
  if (dx < 0) dx = -dx | 0
  let dy = (pPoint1.Y - pPoint2.Y) | 0
  if (dy < 0) dy = -dy | 0

  if (dx >= 8 || dy >= 8) {
    return dx <= dy ? (dx + 2 * dy) | 0 : (dy + 2 * dx) | 0
  }
  const res = ASTAR_HEURISTIC[dx + 8 * dy]!
  return res >= 0 ? (res + 1) | 0 : 0
}

// ---------------------------------------------------------------------------
// RayTrace & TOWARD / STRAIGHT / KNOCKBACK / LEAP / BACKUP_TURN (PathMisc.cpp)
// ---------------------------------------------------------------------------

/**
 * `PATH_RayTrace` (1.13c 0x6FDB6C20; D2MOO PathMisc.cpp:377).
 * Walks a supercover-like line from `tStartCoord` to `*pPathDestination`, testing
 * `COLLISION_CheckAnyCollisionWithPattern` at each stepped sub-tile. On collision, overwrites
 * `*pPathDestination` with the last collision-free point and returns `false`; if the entire
 * segment is clear, leaves `*pPathDestination` at the target and returns `true`.
 */
export function PATH_RayTrace(pDynamicPath: DynamicPath, pPathDestination: PathPoint, tStartCoord: PathPoint): boolean {
  const nCollisionPattern = pDynamicPath.dwCollisionPattern
  const nMoveTestCollisionMask = pDynamicPath.nMoveTestCollisionMask
  const pPathRoom = pDynamicPath.pRoom
  const tTargetPoint: PathPoint = { X: pPathDestination.X, Y: pPathDestination.Y }

  const tLastPointWithoutCollision: PathPoint = { X: tStartCoord.X, Y: tStartCoord.Y }
  const tCurPoint: PathPoint = { X: tStartCoord.X, Y: tStartCoord.Y }
  const nDeltaX = (tTargetPoint.X - tStartCoord.X) | 0
  const nDeltaY = (tTargetPoint.Y - tStartCoord.Y) | 0
  const nPointsX = (Math.abs(nDeltaX) + 1) | 0
  const nPointsY = (Math.abs(nDeltaY) + 1) | 0

  if (nPointsX > nPointsY) {
    if (nDeltaX === 0) {
      if (tStartCoord.Y !== tTargetPoint.Y) {
        const nYIncrement = nDeltaY >= 0 ? 1 : -1
        let nCurY = tStartCoord.Y
        while (nCurY !== tTargetPoint.Y) {
          nCurY = u16(nCurY + nYIncrement)
          tCurPoint.Y = nCurY
          if (COLLISION_CheckAnyCollisionWithPattern(pPathRoom, tStartCoord.X, nCurY, nCollisionPattern, nMoveTestCollisionMask)) {
            copyPoint(pPathDestination, tLastPointWithoutCollision)
            return false
          }
          copyPoint(tLastPointWithoutCollision, tCurPoint)
        }
        return true
      }
    } else if (tStartCoord.X !== tTargetPoint.X) {
      const nXIncrement = nDeltaX >= 0 ? 1 : -1
      const nYIncrement = nDeltaY >= 0 ? 1 : -1
      let nYOffset = nPointsY
      while (true) {
        tCurPoint.X = u16(tCurPoint.X + nXIncrement)
        if (COLLISION_CheckAnyCollisionWithPattern(pPathRoom, tCurPoint.X, tCurPoint.Y, nCollisionPattern, nMoveTestCollisionMask)) {
          copyPoint(pPathDestination, tLastPointWithoutCollision)
          return false
        }
        nYOffset = (nYOffset + nPointsY) | 0
        if (nYOffset >= nPointsX) {
          nYOffset = (nYOffset - nPointsX) | 0
          tCurPoint.Y = u16(tCurPoint.Y + nYIncrement)
          if (nYOffset > 0) {
            if (COLLISION_CheckAnyCollisionWithPattern(pPathRoom, tCurPoint.X, tCurPoint.Y, nCollisionPattern, nMoveTestCollisionMask)) {
              copyPoint(pPathDestination, tLastPointWithoutCollision)
              return false
            }
          }
        }
        copyPoint(tLastPointWithoutCollision, tCurPoint)
        if (tCurPoint.X === tTargetPoint.X) return true
      }
    }
    return true
  }

  if (nPointsX >= nPointsY) {
    const nXIncrement = nDeltaX >= 0 ? 1 : -1
    const nYIncrement = nDeltaY >= 0 ? 1 : -1
    if (tStartCoord.X === tTargetPoint.X) return true
    tCurPoint.X = tStartCoord.X
    while (tCurPoint.X !== tTargetPoint.X) {
      tCurPoint.Y = u16(tCurPoint.Y + nYIncrement)
      tCurPoint.X = u16(tCurPoint.X + nXIncrement)
      if (COLLISION_CheckAnyCollisionWithPattern(pPathRoom, tCurPoint.X, tCurPoint.Y, nCollisionPattern, nMoveTestCollisionMask)) {
        copyPoint(pPathDestination, tLastPointWithoutCollision)
        return false
      }
      copyPoint(tLastPointWithoutCollision, tCurPoint)
    }
    return true
  }

  if (nDeltaY === 0) {
    const nXIncrement = nDeltaX >= 0 ? 1 : -1
    if (tStartCoord.X === tTargetPoint.X) return true
    tCurPoint.X = tStartCoord.X
    while (tCurPoint.X !== tTargetPoint.X) {
      tCurPoint.X = u16(tCurPoint.X + nXIncrement)
      if (COLLISION_CheckAnyCollisionWithPattern(pPathRoom, tCurPoint.X, tStartCoord.Y, nCollisionPattern, nMoveTestCollisionMask)) {
        copyPoint(pPathDestination, tLastPointWithoutCollision)
        return false
      }
      copyPoint(tLastPointWithoutCollision, tCurPoint)
    }
    return true
  }

  const nXIncrement = nDeltaX >= 0 ? 1 : -1
  const nYIncrement = nDeltaY >= 0 ? 1 : -1
  if (tStartCoord.Y === tTargetPoint.Y) return true
  let nEndOffsetX = nPointsX
  while (tCurPoint.Y !== tTargetPoint.Y) {
    tCurPoint.Y = u16(tCurPoint.Y + nYIncrement)
    if (COLLISION_CheckAnyCollisionWithPattern(pPathRoom, tCurPoint.X, tCurPoint.Y, nCollisionPattern, nMoveTestCollisionMask)) {
      copyPoint(pPathDestination, tLastPointWithoutCollision)
      return false
    }
    nEndOffsetX = (nEndOffsetX + nPointsX) | 0
    if (nEndOffsetX >= nPointsY) {
      nEndOffsetX = (nEndOffsetX - nPointsY) | 0
      tCurPoint.X = u16(tCurPoint.X + nXIncrement)
      if (nEndOffsetX > 0) {
        if (COLLISION_CheckAnyCollisionWithPattern(pPathRoom, tCurPoint.X, tCurPoint.Y, nCollisionPattern, nMoveTestCollisionMask)) {
          copyPoint(pPathDestination, tLastPointWithoutCollision)
          return false
        }
      }
    }
    copyPoint(tLastPointWithoutCollision, tCurPoint)
  }
  return true
}

/**
 * `PATH_CheckCollisionsToNextPosition` (1.13c 0x6FDB7630; D2MOO PathMisc.cpp:341).
 * Asserts unit is player/monster, path type != PATHTYPE_MISSILE, and `pGameCoord` is non-zero.
 * Computes velocity/direction vectors to `PathPoints[0]` and ray-traces from the current sub-tile.
 */
export function PATH_CheckCollisionsToNextPosition(pDynamicPath: DynamicPath, pGameCoord: PathPoint): boolean {
  const pUnit = pDynamicPath.pUnit
  d2Assert(
    pUnit && (pUnit.dwUnitType === UNIT_PLAYER || pUnit.dwUnitType === UNIT_MONSTER),
    'PATH_CheckCollisionsToNextPosition: unit is player or monster (0x1BB)',
  )
  d2Assert(pDynamicPath.dwPathType !== PATHTYPE_MISSILE, 'PATH_CheckCollisionsToNextPosition: dwPathType != PATHTYPE_MISSILE (0x1BD)')
  d2Assert(pGameCoord.X !== 0, 'PATH_CheckCollisionsToNextPosition: pGameCoord.X != 0 (0x1BF)')
  d2Assert(pGameCoord.Y !== 0, 'PATH_CheckCollisionsToNextPosition: pGameCoord.Y != 0 (0x1C0)')

  if (pDynamicPath.dwVelocity === 0) {
    pGameCoord.X = pDynamicPath.wPosX
    pGameCoord.Y = pDynamicPath.wPosY
    return false
  }

  PATH_ComputeVelocityAndDirectionVectorsToNextPoint(pDynamicPath, 1, 1)

  if (pDynamicPath.dwVelocity !== 0) {
    const pPoint: PathPoint = { X: pDynamicPath.wPosX, Y: pDynamicPath.wPosY }
    return PATH_RayTrace(pDynamicPath, pGameCoord, pPoint)
  }
  pGameCoord.X = pDynamicPath.wPosX
  pGameCoord.Y = pDynamicPath.wPosY
  return false
}

function dirOffsetX(dir: number): number {
  return DIRECTION_TO_OFFSET_A[(dir & 7) * 2]!
}

function dirOffsetY(dir: number): number {
  return DIRECTION_TO_OFFSET_A[(dir & 7) * 2 + 1]!
}

/**
 * `sub_6FDAA880` (1.13c 0x6FDB71B0; D2MOO PathMisc.cpp:160).
 * Tests up to 3 candidate directions `pTestDir[0..2]` from `pPoint`. Returns the first collision-free
 * direction in `outDir.dir` and `true`, or `false` if all 3 collide.
 */
export function sub_6FDAA880(
  pPathInfo: PathInfo,
  pTestDir: readonly [number, number, number],
  pPoint: PathPoint,
  outDir: { dir: number },
): boolean {
  const pUnit = pPathInfo.pDynamicPath.pUnit
  d2Assert(
    pUnit && (pUnit.dwUnitType === UNIT_PLAYER || pUnit.dwUnitType === UNIT_MONSTER),
    'sub_6FDAA880: unit is player or monster (0xB7)',
  )

  const d0 = pTestDir[0]
  if (
    !COLLISION_CheckAnyCollisionWithPattern(
      pPathInfo.pStartRoom,
      u16(pPoint.X + dirOffsetX(d0)),
      u16(pPoint.Y + dirOffsetY(d0)),
      pPathInfo.nCollisionPattern,
      pPathInfo.nCollisionMask,
    )
  ) {
    outDir.dir = d0
    return true
  }

  const d1 = pTestDir[1]
  if (
    !COLLISION_CheckAnyCollisionWithPattern(
      pPathInfo.pStartRoom,
      u16(pPoint.X + dirOffsetX(d1)),
      u16(pPoint.Y + dirOffsetY(d1)),
      pPathInfo.nCollisionPattern,
      pPathInfo.nCollisionMask,
    )
  ) {
    outDir.dir = d1
    return true
  }

  const d2 = pTestDir[2]
  d2Assert(d2 !== PATH_DIR_NULL, 'sub_6FDAA880: pTestDir[2] != PATH_DIR_NULL (0xC5)')
  if (
    !COLLISION_CheckAnyCollisionWithPattern(
      pPathInfo.pStartRoom,
      u16(pPoint.X + dirOffsetX(d2)),
      u16(pPoint.Y + dirOffsetY(d2)),
      pPathInfo.nCollisionPattern,
      pPathInfo.nCollisionMask,
    )
  ) {
    outDir.dir = d2
    return true
  }

  return false
}

/**
 * `sub_6FDAA720` (1.13c 0x6FDB74C0; D2MOO PathMisc.cpp:108).
 * Stepwise direction-offset path builder (used when `nDirOffset != 0`, i.e. `PATHTYPE_MON_CIRCLE_CW`,
 * `PATHTYPE_MON_CIRCLE_CCW`, and `PATHTYPE_BACKUP_TURN`).
 * Note 1.13c disassembly (`c_finders.txt:818-843`):
 * - Direction offset addition uses `& 7` (`and eax,7`), not signed C `% 8`.
 * - 180-degree reversal check is `((nDirection - 4) & 7) === nPrevDirection` (`lea edx,[eax-4]; and edx,7`).
 */
export function sub_6FDAA720(pPathInfo: PathInfo): number {
  const pDynamicPath = pPathInfo.pDynamicPath
  let nbPathPoints = pDynamicPath.dwPathPoints
  if (pPathInfo.nDistMax > 0) {
    const nDirectionOffset = pDynamicPath.nDirOffset
    const tTargetCoord = pPathInfo.tTargetCoord
    let nPrevDirection = PATH_DIR_NULL
    const tLastSegmentEndCoord: PathPoint = { X: pPathInfo.tStartCoord.X, Y: pPathInfo.tStartCoord.Y }
    let bSegmentEndAlreadyAdded = false
    const tCurCoords: PathPoint = { X: tLastSegmentEndCoord.X, Y: tLastSegmentEndCoord.Y }
    const nDirections: [number, number, number] = [0, 0, 0]
    const outDir = { dir: 0 }

    let nCurDistance = 0
    for (; nCurDistance < pPathInfo.nDistMax; nCurDistance++) {
      if (pointsEqual(tCurCoords, tTargetCoord)) break
      bSegmentEndAlreadyAdded = false
      PATH_GetDirections_6FDAB790(nDirections, tLastSegmentEndCoord, tTargetCoord)
      nDirections[0] = (nDirections[0] + nDirectionOffset) & 7
      nDirections[1] = (nDirections[1] + nDirectionOffset) & 7
      nDirections[2] = (nDirections[2] + nDirectionOffset) & 7
      if (!sub_6FDAA880(pPathInfo, nDirections, tLastSegmentEndCoord, outDir)) {
        break
      }
      const nDirection = outDir.dir
      if (((nDirection - 4) & 7) === nPrevDirection) {
        break
      }
      tCurCoords.X = u16(tCurCoords.X + dirOffsetX(nDirection))
      tCurCoords.Y = u16(tCurCoords.Y + dirOffsetY(nDirection))
      if (nDirection !== nPrevDirection) {
        if (nbPathPoints < MAXPATHLEN) {
          copyPoint(pDynamicPath.PathPoints[nbPathPoints]!, tLastSegmentEndCoord)
        }
        nbPathPoints++
        bSegmentEndAlreadyAdded = true
      }
      copyPoint(tLastSegmentEndCoord, tCurCoords)
      nPrevDirection = nDirection
    }
    if (!bSegmentEndAlreadyAdded && nCurDistance !== 0) {
      if (nbPathPoints < MAXPATHLEN) {
        copyPoint(pDynamicPath.PathPoints[nbPathPoints]!, tLastSegmentEndCoord)
      }
      nbPathPoints++
    }
  }
  pDynamicPath.dwPathPoints = nbPathPoints
  return nbPathPoints
}

/**
 * `PATH_Toward_6FDAA9F0` (1.13c 0x6FDB78B0; D2MOO PathMisc.cpp:267).
 * Finder for `PATHTYPE_TOWARD` (2), `PATHTYPE_MON_CIRCLE_CW` (5), `PATHTYPE_MON_CIRCLE_CCW` (6),
 * and `PATHTYPE_TOWARD_FINISH` (13).
 */
export function PATH_Toward_6FDAA9F0(pPathInfo: PathInfo): number {
  const pPath = pPathInfo.pDynamicPath
  pPath.dwCurrentPointIdx = 0
  pPath.dwPathPoints = 0
  if (pPath.nDirOffset !== 0) {
    return sub_6FDAA720(pPathInfo)
  }

  const nNextPoint: PathPoint = { X: pPathInfo.tTargetCoord.X, Y: pPathInfo.tTargetCoord.Y }
  copyPoint(pPath.PathPoints[0]!, nNextPoint)

  const rayClear = PATH_CheckCollisionsToNextPosition(pPath, nNextPoint)
  if (!rayClear && sub_6FDABA50(nNextPoint, pPathInfo.tTargetCoord) > pPathInfo.field_14) {
    const tPoint: PathPoint = { X: pPathInfo.tStartCoord.X, Y: pPathInfo.tStartCoord.Y }
    const tCurCoords: PathPoint = { X: pPathInfo.tStartCoord.X, Y: pPathInfo.tStartCoord.Y }
    if (!pointsEqual(pPathInfo.tStartCoord, nNextPoint)) {
      copyPoint(pPath.PathPoints[pPath.dwPathPoints]!, nNextPoint)
      pPath.dwPathPoints++
      copyPoint(tPoint, nNextPoint)
      copyPoint(tCurCoords, nNextPoint)
    }
    copyPoint(nNextPoint, pPathInfo.tTargetCoord)
    let nPrevDir = PATH_DIR_NULL
    let nNewPointsCount = pPath.dwPathPoints
    let bNotStraightLine = false
    let nCurDist = 0
    if (pPathInfo.nDistMax > 0) {
      const aTestDir: [number, number, number] = [0, 0, 0]
      const outDir = { dir: 0 }
      let stoppedEarly = false
      do {
        if (pointsEqual(tCurCoords, nNextPoint)) break
        bNotStraightLine = false
        PATH_GetDirections_6FDAB790(aTestDir, tPoint, nNextPoint)
        if (!sub_6FDAA880(pPathInfo, aTestDir, tPoint, outDir) || ((outDir.dir - 4) & 7) === nPrevDir) {
          stoppedEarly = true
          break
        }
        const nDirection = outDir.dir
        tCurCoords.X = u16(tCurCoords.X + dirOffsetX(nDirection))
        tCurCoords.Y = u16(tCurCoords.Y + dirOffsetY(nDirection))
        if (nDirection !== nPrevDir) {
          if (!pointsEqual(tPoint, pPathInfo.tStartCoord)) {
            if (nNewPointsCount < MAXPATHLEN) {
              copyPoint(pPath.PathPoints[nNewPointsCount]!, tPoint)
            }
            nNewPointsCount++
          }
          bNotStraightLine = true
        }
        copyPoint(tPoint, tCurCoords)
        nPrevDir = nDirection
        nCurDist++
      } while (nCurDist < pPathInfo.nDistMax)

      if (stoppedEarly || !bNotStraightLine) {
        if (nCurDist !== 0) {
          if (nNewPointsCount < MAXPATHLEN) {
            copyPoint(pPath.PathPoints[nNewPointsCount]!, tPoint)
          }
          nNewPointsCount++
        }
      }
    }
    pPath.dwPathPoints = nNewPointsCount
  } else {
    copyPoint(pPath.PathPoints[pPath.dwPathPoints]!, nNextPoint)
    pPath.dwPathPoints++
  }
  return pPath.dwPathPoints
}

/** `sub_6FDAB0B0` (1.13c 0x6FDB7B70; D2MOO PathMisc.cpp:542): finder for `PATHTYPE_UNKNOWN_3` (3). */
export function sub_6FDAB0B0(pPathInfo: PathInfo): number {
  pPathInfo.pDynamicPath.dwCurrentPointIdx = 0
  return PATH_Toward_6FDAA9F0(pPathInfo)
}

/** `PATH_BackupTurn_Compute` (1.13c 0x6FDB7850; D2MOO PathMisc.cpp:549): finder for `PATHTYPE_BACKUP_TURN` (12). */
export function PATH_BackupTurn_Compute(pPathInfo: PathInfo): number {
  const pDynamicPath = pPathInfo.pDynamicPath
  pDynamicPath.dwCurrentPointIdx = 0
  pDynamicPath.nDirOffset = -4
  const result = sub_6FDAA720(pPathInfo)
  if (!result) return 0

  pDynamicPath.dwPathPoints = result
  pDynamicPath.nDirOffset = -2
  let v5 = (sub_6FDAA720(pPathInfo) - result) | 0
  if (!v5) {
    pDynamicPath.nDirOffset = 2
    v5 = (sub_6FDAA720(pPathInfo) - result) | 0
  }
  pDynamicPath.nDirOffset = -4
  return (result + v5) | 0
}

/**
 * `PATH_Straight_Compute` (1.13c 0x6FDB7AD0; D2MOO PathMisc.cpp:583): finder for `PATHTYPE_STRAIGHT` (7).
 * Runs `PATH_Toward_6FDAA9F0` first; if the last point is not within `field_14` of the target (or equals
 * `tStartCoord`) and the squared Euclidean distance is `<= 18*18` (324), falls back to `PATH_AStar_ComputePath`.
 */
export function PATH_Straight_Compute(pPathInfo: PathInfo): number {
  const pDynamicPath = pPathInfo.pDynamicPath
  pDynamicPath.dwCurrentPointIdx = 0
  pDynamicPath.dwPathPoints = 0

  let nPathPoints = PATH_Toward_6FDAA9F0(pPathInfo)
  if (nPathPoints !== 0) {
    const tPathLastPoint = pDynamicPath.PathPoints[nPathPoints - 1]!
    if (
      sub_6FDABA50(tPathLastPoint, pPathInfo.tTargetCoord) <= pPathInfo.field_14 &&
      !pointsEqual(tPathLastPoint, pPathInfo.tStartCoord)
    ) {
      return nPathPoints
    }
  }

  const nDiffX = Math.abs((pPathInfo.tStartCoord.X - pPathInfo.tTargetCoord.X) | 0)
  const nDiffY = Math.abs((pPathInfo.tStartCoord.Y - pPathInfo.tTargetCoord.Y) | 0)
  const nSquaredDistance = (nDiffX * nDiffX + nDiffY * nDiffY) | 0
  if (nSquaredDistance <= 324) {
    const nAStarPathPoints = PATH_AStar_ComputePath(pPathInfo)
    if (nAStarPathPoints !== 0) {
      return nAStarPathPoints
    }
    if (nPathPoints !== 0) {
      nPathPoints = PATH_Toward_6FDAA9F0(pPathInfo)
    }
  }
  return nPathPoints
}

/** `PATH_Leap_6FDAB1E0` (1.13c 0x6FDB77F0; D2MOO PathMisc.cpp:624): finder for `PATHTYPE_LEAP` (9). */
export function PATH_Leap_6FDAB1E0(pPathInfo: PathInfo): number {
  const pDynamicPath = pPathInfo.pDynamicPath
  pDynamicPath.dwCurrentPointIdx = 0
  const pGameCoord: PathPoint = { X: pPathInfo.tTargetCoord.X, Y: pPathInfo.tTargetCoord.Y }
  copyPoint(pDynamicPath.PathPoints[0]!, pGameCoord)
  PATH_CheckCollisionsToNextPosition(pDynamicPath, pGameCoord)
  if (pointsEqual(pPathInfo.tStartCoord, pGameCoord)) return 0
  copyPoint(pDynamicPath.PathPoints[0]!, pGameCoord)
  pDynamicPath.dwPathPoints = 1
  return 1
}

/** `PATH_Knockback_Client` (1.13c 0x6FDB77C0; D2MOO PathMisc.cpp:640): finder for `PATHTYPE_KNOCKBACK_CLIENT` (11). */
export function PATH_Knockback_Client(pPathInfo: PathInfo): number {
  const pDynamicPath = pPathInfo.pDynamicPath
  pDynamicPath.dwCurrentPointIdx = 0
  copyPoint(pDynamicPath.PathPoints[0]!, pPathInfo.tTargetCoord)
  PATH_CheckCollisionsToNextPosition(pDynamicPath, pDynamicPath.PathPoints[0]!)
  return 1
}

/** `PATH_Knockback_Server` (1.13c 0x6FDB7390; D2MOO PathMisc.cpp:649): finder for `PATHTYPE_KNOCKBACK_SERVER` (8). */
export function PATH_Knockback_Server(pPathInfo: PathInfo): number {
  const pDynamicPath = pPathInfo.pDynamicPath
  const nHalfDist = ((pDynamicPath.nDist >> 1) + 1) | 0
  const tFinalCoords: PathPoint = { X: 0, Y: 0 }
  const pTargetUnit = pDynamicPath.pTargetUnit
  if (pTargetUnit) {
    copyPoint(tFinalCoords, pPathInfo.tStartCoord)
    const nTargetUnitX = UNITS_GetXPosition(pTargetUnit)
    const nTargetUnitY = UNITS_GetYPosition(pTargetUnit)
    let nDeltaX = (pPathInfo.tStartCoord.X - nTargetUnitX) | 0
    let nDeltaY = (pPathInfo.tStartCoord.Y - nTargetUnitY) | 0
    const nMaxAbsDelta = Math.max(Math.abs(nDeltaX), Math.abs(nDeltaY))
    if (nMaxAbsDelta !== 0) {
      nDeltaX = idiv((nDeltaX * nHalfDist) | 0, nMaxAbsDelta)
      nDeltaY = idiv((nDeltaY * nHalfDist) | 0, nMaxAbsDelta)
    }
    tFinalCoords.X = u16(tFinalCoords.X + nDeltaX)
    tFinalCoords.Y = u16(tFinalCoords.Y + nDeltaY)
  } else {
    copyPoint(tFinalCoords, pPathInfo.tTargetCoord)
  }
  copyPoint(pDynamicPath.PathPoints[0]!, tFinalCoords)
  PATH_RayTrace(pDynamicPath, tFinalCoords, pPathInfo.tStartCoord)
  D2COMMON_10170_PathSetTargetPos(pDynamicPath, tFinalCoords.X, tFinalCoords.Y)
  if (pointsEqual(tFinalCoords, pPathInfo.tStartCoord)) return 0
  copyPoint(pDynamicPath.PathPoints[0]!, tFinalCoords)
  pDynamicPath.dwPathPoints = 1
  return 1
}

// ---------------------------------------------------------------------------
// A* pathfinder (AStar.cpp, 1.13c 0x6FDCAB50..0x6FDCB78C)
// ---------------------------------------------------------------------------

const ASTAR_CACHE_SIZE = 128
const ASTAR_MAX_NODES = 200

interface AStarNode {
  tPoint: PathPoint
  nFScore: number
  nHeuristicDistanceToTarget: number
  nBestDistanceFromStart: number
  pBestParent: AStarNode | null
  pChildren: (AStarNode | null)[]
  pNextCachePoint: AStarNode | null
  pNextSortedByFScore: AStarNode | null
}

interface AStarContext {
  aPendingCache: (AStarNode | null)[]
  aVisitedCache: (AStarNode | null)[]
  pSortedListByFScore: AStarNode | null
  aNodesStorage: AStarNode[]
  nNodesCount: number
  aPointsStack: (AStarNode | null)[]
  nStackCount: number
}

function createAStarNode(): AStarNode {
  return {
    tPoint: { X: 0, Y: 0 },
    nFScore: 0,
    nHeuristicDistanceToTarget: 0,
    nBestDistanceFromStart: 0,
    pBestParent: null,
    pChildren: [null, null, null, null, null, null, null, null],
    pNextCachePoint: null,
    pNextSortedByFScore: null,
  }
}

function resetAStarNode(n: AStarNode): void {
  n.tPoint.X = 0
  n.tPoint.Y = 0
  n.nFScore = 0
  n.nHeuristicDistanceToTarget = 0
  n.nBestDistanceFromStart = 0
  n.pBestParent = null
  for (let i = 0; i < 8; i++) n.pChildren[i] = null
  n.pNextCachePoint = null
  n.pNextSortedByFScore = null
}

function createAStarContext(): AStarContext {
  const aNodesStorage: AStarNode[] = []
  for (let i = 0; i < ASTAR_MAX_NODES; i++) aNodesStorage.push(createAStarNode())
  return {
    aPendingCache: new Array<AStarNode | null>(ASTAR_CACHE_SIZE).fill(null),
    aVisitedCache: new Array<AStarNode | null>(ASTAR_CACHE_SIZE).fill(null),
    pSortedListByFScore: null,
    aNodesStorage,
    nNodesCount: 0,
    aPointsStack: new Array<AStarNode | null>(ASTAR_MAX_NODES).fill(null),
    nStackCount: 0,
  }
}

const SHARED_ASTAR_CONTEXT: AStarContext = createAStarContext()
let astarPoolInUse = false

function resetAStarContext(ctx: AStarContext): void {
  ctx.aPendingCache.fill(null)
  ctx.aVisitedCache.fill(null)
  ctx.pSortedListByFScore = null
  const limit = Math.max(1, ctx.nNodesCount)
  for (let i = 0; i < limit; i++) {
    resetAStarNode(ctx.aNodesStorage[i]!)
  }
  ctx.nNodesCount = 0
  ctx.nStackCount = 0
}

function astarPointHash(pt: PathPoint): number {
  return (ASTAR_HASH_X[pt.X & 0x7f]! + ASTAR_HASH_Y[pt.Y & 0x7f]!) & 0x7f
}

/**
 * `PATH_AStar_Heuristic` (1.13c 0x6FDCAF70; D2MOO AStar.cpp:234).
 * Diagonal distance with D=2 and D2=3: `min(|dx|, |dy|) + 2 * max(|dx|, |dy|)`.
 */
export function PATH_AStar_Heuristic(tPoint1: PathPoint, tPoint2: PathPoint): number {
  const nDiffX = Math.abs((tPoint1.X - tPoint2.X) | 0)
  const nDiffY = Math.abs((tPoint1.Y - tPoint2.Y) | 0)
  return nDiffX < nDiffY ? (nDiffX + 2 * nDiffY) | 0 : (nDiffY + 2 * nDiffX) | 0
}

/** `PATH_AStar_HeuristicForNeighbor` (inlined in 1.13c; D2MOO AStar.cpp:249): 2 orthogonal, 3 diagonal. */
export function PATH_AStar_HeuristicForNeighbor(tPoint: PathPoint, tNeighbor: PathPoint): number {
  return tPoint.X === tNeighbor.X || tPoint.Y === tNeighbor.Y ? 2 : 3
}

/** `PATH_AStar_TargetLocationHasEnoughRoom` (1.13c 0x6FDCB2C0; D2MOO AStar.cpp:39). */
export function PATH_AStar_TargetLocationHasEnoughRoom(pPathInfo: PathInfo): boolean {
  if (!pPathInfo.pDynamicPath.pTargetUnit) return true
  const pStartRoom = pPathInfo.pStartRoom
  const nTargetX = pPathInfo.tTargetCoord.X
  const nTargetY = pPathInfo.tTargetCoord.Y
  const nCollisionPattern = pPathInfo.nCollisionPattern
  const nCollisionMask = pPathInfo.nCollisionMask
  return (
    !COLLISION_CheckAnyCollisionWithPattern(pStartRoom, nTargetX - 2, nTargetY - 2, nCollisionPattern, nCollisionMask) ||
    !COLLISION_CheckAnyCollisionWithPattern(pStartRoom, nTargetX - 2, nTargetY + 2, nCollisionPattern, nCollisionMask) ||
    !COLLISION_CheckAnyCollisionWithPattern(pStartRoom, nTargetX + 2, nTargetY - 2, nCollisionPattern, nCollisionMask) ||
    !COLLISION_CheckAnyCollisionWithPattern(pStartRoom, nTargetX + 2, nTargetY + 2, nCollisionPattern, nCollisionMask) ||
    !COLLISION_CheckAnyCollisionWithPattern(pStartRoom, nTargetX - 2, nTargetY, nCollisionPattern, nCollisionMask) ||
    !COLLISION_CheckAnyCollisionWithPattern(pStartRoom, nTargetX, nTargetY - 2, nCollisionPattern, nCollisionMask) ||
    !COLLISION_CheckAnyCollisionWithPattern(pStartRoom, nTargetX + 2, nTargetY, nCollisionPattern, nCollisionMask) ||
    !COLLISION_CheckAnyCollisionWithPattern(pStartRoom, nTargetX, nTargetY + 2, nCollisionPattern, nCollisionMask)
  )
}

function astarMakeCandidate(pContext: AStarContext, pNode: AStarNode): void {
  const nHash = astarPointHash(pNode.tPoint)
  pNode.pNextCachePoint = pContext.aPendingCache[nHash]!
  pContext.aPendingCache[nHash] = pNode

  let pInsertionPoint: AStarNode | null = null
  for (let pCurrent = pContext.pSortedListByFScore; pCurrent !== null; pCurrent = pCurrent.pNextSortedByFScore) {
    if (pCurrent.nFScore >= pNode.nFScore) break
    pInsertionPoint = pCurrent
  }
  if (pInsertionPoint) {
    pNode.pNextSortedByFScore = pInsertionPoint.pNextSortedByFScore
    pInsertionPoint.pNextSortedByFScore = pNode
  } else {
    pNode.pNextSortedByFScore = pContext.pSortedListByFScore
    pContext.pSortedListByFScore = pNode
  }
}

function astarPopBestScoreForVisit(pContext: AStarContext): AStarNode | null {
  const pPopped = pContext.pSortedListByFScore
  if (pPopped) {
    pContext.pSortedListByFScore = pPopped.pNextSortedByFScore
    const nCacheIndex = astarPointHash(pPopped.tPoint)
    let pPreviousPoint: AStarNode | null = null
    for (let pCacheEntry = pContext.aPendingCache[nCacheIndex]!; pCacheEntry !== null; pCacheEntry = pCacheEntry.pNextCachePoint!) {
      if (pCacheEntry === pPopped) break
      pPreviousPoint = pCacheEntry
    }
    if (pPreviousPoint) {
      pPreviousPoint.pNextCachePoint = pPopped.pNextCachePoint
    } else {
      pContext.aPendingCache[nCacheIndex] = pPopped.pNextCachePoint
    }
    pPopped.pNextCachePoint = pContext.aVisitedCache[nCacheIndex]!
    pContext.aVisitedCache[nCacheIndex] = pPopped
  }
  return pPopped
}

function astarGetNodeFromPendingCache(pContext: AStarContext, tPathPoint: PathPoint): AStarNode | null {
  const nHash = astarPointHash(tPathPoint)
  for (let pNode = pContext.aPendingCache[nHash]!; pNode !== null; pNode = pNode.pNextCachePoint!) {
    if (pointsEqual(tPathPoint, pNode.tPoint)) return pNode
  }
  return null
}

function astarFindPointInVisitedCache(pContext: AStarContext, tPathPoint: PathPoint): AStarNode | null {
  const nHash = astarPointHash(tPathPoint)
  for (let pNode = pContext.aVisitedCache[nHash]!; pNode !== null; pNode = pNode.pNextCachePoint!) {
    if (pointsEqual(tPathPoint, pNode.tPoint)) return pNode
  }
  return null
}

function astarAddChildToNode(pNode: AStarNode, pChild: AStarNode): void {
  for (let i = 0; i < 8; i++) {
    if (pNode.pChildren[i] === null) {
      pNode.pChildren[i] = pChild
      break
    }
  }
}

function astarPropagateNewFScoreToChildren(pContext: AStarContext, pNewNode: AStarNode): void {
  pContext.aPointsStack[pContext.nStackCount++] = pNewNode
  while (pContext.nStackCount !== 0) {
    const pCurrentPoint = pContext.aPointsStack[--pContext.nStackCount]!
    for (let i = 0; i < 8; i++) {
      const pChild = pCurrentPoint.pChildren[i]
      if (!pChild) break
      const nDistanceBetweenPoints = PATH_AStar_HeuristicForNeighbor(pCurrentPoint.tPoint, pChild.tPoint)
      const nDistanceFromStart = i16(nDistanceBetweenPoints + pCurrentPoint.nBestDistanceFromStart)
      if (nDistanceFromStart < pChild.nBestDistanceFromStart) {
        pChild.pBestParent = pCurrentPoint
        pChild.nBestDistanceFromStart = nDistanceFromStart
        pChild.nFScore = i16(nDistanceFromStart + pChild.nHeuristicDistanceToTarget)
        pContext.aPointsStack[pContext.nStackCount++] = pChild
      }
    }
  }
}

function astarEvaluateNeighbor(
  pContext: AStarContext,
  pCurrentNode: AStarNode,
  tNewPointCoord: PathPoint,
  tTargetCoord: PathPoint,
): boolean {
  const nDistanceBetweenPoints = PATH_AStar_HeuristicForNeighbor(pCurrentNode.tPoint, tNewPointCoord)
  const nNewPointDistance = i16(pCurrentNode.nBestDistanceFromStart + nDistanceBetweenPoints)

  const pending = astarGetNodeFromPendingCache(pContext, tNewPointCoord)
  if (pending) {
    astarAddChildToNode(pCurrentNode, pending)
    if (nNewPointDistance < pending.nBestDistanceFromStart) {
      pending.pBestParent = pCurrentNode
      pending.nBestDistanceFromStart = nNewPointDistance
      pending.nFScore = i16(nNewPointDistance + pending.nHeuristicDistanceToTarget)
    }
    return true
  }

  const visited = astarFindPointInVisitedCache(pContext, tNewPointCoord)
  if (visited) {
    astarAddChildToNode(pCurrentNode, visited)
    if (nNewPointDistance < visited.nBestDistanceFromStart) {
      visited.pBestParent = pCurrentNode
      visited.nBestDistanceFromStart = nNewPointDistance
      visited.nFScore = i16(nNewPointDistance + visited.nHeuristicDistanceToTarget)
      astarPropagateNewFScoreToChildren(pContext, visited)
    }
    return true
  }

  if (pContext.nNodesCount === ASTAR_MAX_NODES) {
    return false
  }
  const pNewNode = pContext.aNodesStorage[pContext.nNodesCount++]!
  resetAStarNode(pNewNode)
  astarAddChildToNode(pCurrentNode, pNewNode)
  copyPoint(pNewNode.tPoint, tNewPointCoord)
  pNewNode.nHeuristicDistanceToTarget = i16(PATH_AStar_Heuristic(tNewPointCoord, tTargetCoord))
  pNewNode.pBestParent = pCurrentNode
  pNewNode.nBestDistanceFromStart = nNewPointDistance
  pNewNode.nFScore = i16(nNewPointDistance + pNewNode.nHeuristicDistanceToTarget)
  astarMakeCandidate(pContext, pNewNode)
  return true
}

const ASTAR_OFFSETS: readonly PathCoord[] = [
  { nX: -1, nY: -1 },
  { nX: -1, nY: 1 },
  { nX: 1, nY: -1 },
  { nX: 1, nY: 1 },
  { nX: -1, nY: 0 },
  { nX: 0, nY: -1 },
  { nX: 1, nY: 0 },
  { nX: 0, nY: 1 },
]

function astarExploreChildren(
  pPathInfo: PathInfo,
  pContext: AStarContext,
  a3: AStarNode,
  tTargetCoord: PathPoint,
): boolean {
  for (let i = 0; i < 8; i++) {
    const off = ASTAR_OFFSETS[i]!
    const tNewPointCoord: PathPoint = {
      X: u16(a3.tPoint.X + off.nX),
      Y: u16(a3.tPoint.Y + off.nY),
    }
    if (
      !COLLISION_CheckAnyCollisionWithPattern(
        pPathInfo.pStartRoom,
        tNewPointCoord.X,
        tNewPointCoord.Y,
        pPathInfo.nCollisionPattern,
        pPathInfo.nCollisionMask,
      ) &&
      !astarEvaluateNeighbor(pContext, a3, tNewPointCoord, tTargetCoord)
    ) {
      return false
    }
  }
  return true
}

/** `PATH_AStar_FlushNodeToDynamicPath` (1.13c 0x6FDCAB50; D2MOO AStar.cpp:428). */
function astarFlushNodeToDynamicPath(pNode: AStarNode | null, pPathInfo: PathInfo): number {
  if (!pNode) return 0
  let nbPoints = 0
  const tempPathPoints: PathPoint[] = new Array<PathPoint>(MAXPATHLEN)
  let prevDeltaX = -2
  let prevDeltaY = -2
  let cur: AStarNode | null = pNode
  while (cur && cur.pBestParent && nbPoints < MAXPATHLEN) {
    const pNextPoint: AStarNode = cur.pBestParent
    const deltaX = (cur.tPoint.X - pNextPoint.tPoint.X) | 0
    const deltaY = (cur.tPoint.Y - pNextPoint.tPoint.Y) | 0
    if (deltaX !== prevDeltaX || deltaY !== prevDeltaY) {
      nbPoints++
      tempPathPoints[MAXPATHLEN - nbPoints] = { X: cur.tPoint.X, Y: cur.tPoint.Y }
      prevDeltaX = deltaX
      prevDeltaY = deltaY
    }
    cur = pNextPoint
  }
  if (nbPoints < 1 || nbPoints >= MAXPATHLEN) return 0
  const out = pPathInfo.pDynamicPath.PathPoints
  for (let i = 0; i < nbPoints; i++) {
    copyPoint(out[i]!, tempPathPoints[MAXPATHLEN - nbPoints + i]!)
  }
  return nbPoints
}

/**
 * `PATH_AStar_ComputePath` (1.13c 0x6FDCB630; D2MOO AStar.cpp:130).
 * Finder for `PATHTYPE_ASTAR` (1) and the close-range obstacle fallback of `PATHTYPE_STRAIGHT` (7).
 */
export function PATH_AStar_ComputePath(pPathInfo: PathInfo): number {
  if (!PATH_AStar_TargetLocationHasEnoughRoom(pPathInfo)) return 0

  const tStartCoord = pPathInfo.tStartCoord
  const tTargetCoord = pPathInfo.tTargetCoord
  const useShared = !astarPoolInUse
  if (useShared) astarPoolInUse = true
  try {
    const tContext = useShared ? SHARED_ASTAR_CONTEXT : createAStarContext()
    if (useShared) resetAStarContext(tContext)
    tContext.nNodesCount = 1

    const nDistToTarget = i16(PATH_AStar_Heuristic(tTargetCoord, tStartCoord))
    const startNode = tContext.aNodesStorage[0]!
    startNode.nBestDistanceFromStart = 0
    startNode.nHeuristicDistanceToTarget = nDistToTarget
    startNode.nFScore = nDistToTarget
    copyPoint(startNode.tPoint, tStartCoord)
    astarMakeCandidate(tContext, startNode)

    let pBestNode: AStarNode | null = null
    for (
      let pCurNodeToVisit = astarPopBestScoreForVisit(tContext);
      pCurNodeToVisit !== null;
      pCurNodeToVisit = astarPopBestScoreForVisit(tContext)
    ) {
      if (
        pBestNode === null ||
        pCurNodeToVisit.nHeuristicDistanceToTarget < pBestNode.nHeuristicDistanceToTarget ||
        (pCurNodeToVisit.nHeuristicDistanceToTarget === pBestNode.nHeuristicDistanceToTarget &&
          pCurNodeToVisit.nBestDistanceFromStart > ((pBestNode.nBestDistanceFromStart + 5) | 0))
      ) {
        pBestNode = pCurNodeToVisit
      }

      if (
        pCurNodeToVisit.nHeuristicDistanceToTarget === 0 ||
        !astarExploreChildren(pPathInfo, tContext, pCurNodeToVisit, tTargetCoord)
      ) {
        break
      }
    }
    if (pBestNode) {
      return astarFlushNodeToDynamicPath(pBestNode, pPathInfo)
    }
    return 0
  } finally {
    if (useShared) astarPoolInUse = false
  }
}

// ---------------------------------------------------------------------------
// IDA* pathfinder (IDAStar.cpp, 1.13c 0x6FDC0650..0x6FDC0F2B)
// ---------------------------------------------------------------------------

const IDASTAR_MAX_NODES = 900
const IDASTAR_MAXPROOM = 50000

const IDASTAR_RAND_OFFSETS: readonly number[] = [
  -2, -1, 0, 1, 2, -2, -1, 0, 1, 2, -2, -1, 0, 1, 2, -2,
  -1, 0, 1, 2, -2, -1, 0, 1, 2, -2, -1, 0, 1, 2, -1, 1,
]

interface IDAStarNode {
  nFScore: number
  nHeuristicDistanceToTarget: number
  nBestDistanceFromStart: number
  nEvaluationsCount: number
  tCoord: PathPoint
  /** Index into `IDASTAR_NEIGHBORS_SEQUENCE` (64-element flat array of 8x8 rows). */
  nSequenceIdx: number
  nNextNeighborIndex: number
  pParent: IDAStarNode | null
  pBestChild: IDAStarNode | null
}

interface IDAStarContext {
  pCurrentNode: IDAStarNode
  aNodesStorage: IDAStarNode[]
  nNodesCount: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  nStride: number
  nXOffset: number
  nYOffset: number
  aCoordData: Int32Array
  bRandomDirection: boolean
  seedLow: number
  seedHigh: number
}

function createIDAStarNode(): IDAStarNode {
  return {
    nFScore: 0,
    nHeuristicDistanceToTarget: 0,
    nBestDistanceFromStart: 0,
    nEvaluationsCount: 0,
    tCoord: { X: 0, Y: 0 },
    nSequenceIdx: 0,
    nNextNeighborIndex: 0,
    pParent: null,
    pBestChild: null,
  }
}

function resetIDAStarNode(n: IDAStarNode): void {
  n.nFScore = 0
  n.nHeuristicDistanceToTarget = 0
  n.nBestDistanceFromStart = 0
  n.nEvaluationsCount = 0
  n.tCoord.X = 0
  n.tCoord.Y = 0
  n.nSequenceIdx = 0
  n.nNextNeighborIndex = 0
  n.pParent = null
  n.pBestChild = null
}

function createIDAStarNodesPool(): IDAStarNode[] {
  const pool: IDAStarNode[] = []
  for (let i = 0; i < IDASTAR_MAX_NODES; i++) pool.push(createIDAStarNode())
  return pool
}

const SHARED_IDASTAR_NODES: IDAStarNode[] = createIDAStarNodesPool()
const SHARED_IDASTAR_START_NODE: IDAStarNode = createIDAStarNode()
let SHARED_IDASTAR_COORD_DATA = new Int32Array(IDASTAR_MAXPROOM + 4096)
let idastarPoolInUse = false
let idastarMaxNodesTouched = 1

function copyIDAStarNode(dst: IDAStarNode, src: IDAStarNode): void {
  dst.nFScore = src.nFScore
  dst.nHeuristicDistanceToTarget = src.nHeuristicDistanceToTarget
  dst.nBestDistanceFromStart = src.nBestDistanceFromStart
  dst.nEvaluationsCount = src.nEvaluationsCount
  dst.tCoord.X = src.tCoord.X
  dst.tCoord.Y = src.tCoord.Y
  dst.nSequenceIdx = src.nSequenceIdx
  dst.nNextNeighborIndex = src.nNextNeighborIndex
  dst.pParent = src.pParent
  dst.pBestChild = src.pBestChild
}

function idastarGetNextNeighborIndex(pNode: IDAStarNode, pContext: IDAStarContext): void {
  const seqVal = IDASTAR_NEIGHBORS_SEQUENCE[pNode.nSequenceIdx]!
  if (pContext.bRandomDirection) {
    // 64-bit LCG: seed = seed * 0x6AC690C5 + seedHigh (1.13c 0x6FDC07F0)
    const prod = BigInt(pContext.seedLow >>> 0) * 0x6ac690c5n + BigInt(pContext.seedHigh >>> 0)
    const low = Number(prod & 0xffffffffn) >>> 0
    const high = Number((prod >> 32n) & 0xffffffffn) >>> 0
    pContext.seedLow = low
    pContext.seedHigh = high
    const rndOff = IDASTAR_RAND_OFFSETS[low & 0x1f]!
    pNode.nNextNeighborIndex = (pNode.nNextNeighborIndex + seqVal + rndOff) & 7
  } else {
    pNode.nNextNeighborIndex = (pNode.nNextNeighborIndex + seqVal) & 7
  }
}

function sub_6FDC0840(pNode: IDAStarNode, pContext: IDAStarContext): IDAStarNode | null {
  let cur: IDAStarNode = pNode
  if (cur.nEvaluationsCount < 4) {
    cur.nSequenceIdx++
    idastarGetNextNeighborIndex(cur, pContext)
  }
  cur.nEvaluationsCount = i16(cur.nEvaluationsCount + 1)
  if (cur.nEvaluationsCount === 5) {
    while (cur !== pContext.pCurrentNode) {
      cur = cur.pParent!
      cur.nSequenceIdx++
      idastarGetNextNeighborIndex(cur, pContext)
      cur.nEvaluationsCount = i16(cur.nEvaluationsCount + 1)
      if (cur.nEvaluationsCount !== 5) {
        return cur
      }
    }
    return null
  }
  return cur
}

function idastarVisitNodes(pContext: IDAStarContext, nFScoreCutoff: number, pPathInfo: PathInfo): IDAStarNode | null {
  let pCurrentNode: IDAStarNode | null = pContext.pCurrentNode
  let nIterations = 0
  while (!pointsEqual(pCurrentNode.tCoord, pPathInfo.tTargetCoord)) {
    if (++nIterations > 10000) return null
    if (
      pCurrentNode.tCoord.X < pContext.minX ||
      pCurrentNode.tCoord.X > pContext.maxX ||
      pCurrentNode.tCoord.Y < pContext.minY ||
      pCurrentNode.tCoord.Y > pContext.maxY
    ) {
      break
    }

    const dirIdx = pCurrentNode.nNextNeighborIndex & 7
    const tNeighborCoords: PathPoint = {
      X: u16(pCurrentNode.tCoord.X + IDASTAR_COORD_OFFSETS[dirIdx * 2]!),
      Y: u16(pCurrentNode.tCoord.Y + IDASTAR_COORD_OFFSETS[dirIdx * 2 + 1]!),
    }

    const nDataIndex =
      ((tNeighborCoords.X + pContext.nXOffset) | 0) +
      Math.imul(pContext.nStride, (tNeighborCoords.Y + pContext.nYOffset) | 0)
    const curBestDist = pContext.aCoordData[nDataIndex]!

    let bShouldEvaluateNextNeighbor = true
    let bMayEvaluateNode = true
    if (curBestDist === 0) {
      if (
        COLLISION_CheckAnyCollisionWithPattern(
          pPathInfo.pStartRoom,
          tNeighborCoords.X,
          tNeighborCoords.Y,
          pPathInfo.nCollisionPattern,
          pPathInfo.nCollisionMask,
        )
      ) {
        pContext.aCoordData[nDataIndex] = 1
        bMayEvaluateNode = false
      }
    }

    if (bMayEvaluateNode) {
      const nDistanceBetweenPoints = PATH_AStar_HeuristicForNeighbor(pCurrentNode.tCoord, tNeighborCoords)
      const nNewDistanceFromStart = i16(nDistanceBetweenPoints + pCurrentNode.nBestDistanceFromStart)
      const stored = pContext.aCoordData[nDataIndex]!
      if (stored === 0 || (stored >>> 0) >= (nNewDistanceFromStart >>> 0)) {
        pContext.aCoordData[nDataIndex] = nNewDistanceFromStart
        const nHeuristicDistanceToTarget = i16(PATH_AStar_Heuristic(pPathInfo.tTargetCoord, tNeighborCoords))
        const nNewNodeFScore = i16(nHeuristicDistanceToTarget + nNewDistanceFromStart)
        if (nNewNodeFScore <= nFScoreCutoff) {
          if (!pCurrentNode.pBestChild) {
            if (pContext.nNodesCount === IDASTAR_MAX_NODES) return null
            const pNewSubposition = pContext.aNodesStorage[pContext.nNodesCount++]!
            resetIDAStarNode(pNewSubposition)
            pCurrentNode.pBestChild = pNewSubposition
            pNewSubposition.pParent = pCurrentNode
          }
          pCurrentNode = pCurrentNode.pBestChild
          copyPoint(pCurrentNode.tCoord, tNeighborCoords)
          pCurrentNode.nBestDistanceFromStart = nNewDistanceFromStart
          pCurrentNode.nFScore = nNewNodeFScore
          pCurrentNode.nHeuristicDistanceToTarget = nHeuristicDistanceToTarget
          pCurrentNode.nEvaluationsCount = 0
          const row = (sub_6FDAB770(tNeighborCoords, pPathInfo.tTargetCoord) - pCurrentNode.pParent!.nNextNeighborIndex) & 7
          pCurrentNode.nSequenceIdx = row * 8
          idastarGetNextNeighborIndex(pCurrentNode, pContext)

          if (pCurrentNode.nHeuristicDistanceToTarget < pPathInfo.field_14) {
            return pCurrentNode
          }
          bShouldEvaluateNextNeighbor = false
        }
      }
    }

    if (bShouldEvaluateNextNeighbor) {
      pCurrentNode = sub_6FDC0840(pCurrentNode, pContext)
      if (!pCurrentNode) return null
    }
  }
  return pCurrentNode
}

function idastarFlushNodeToDynamicPath(pNode: IDAStarNode | null, pPathInfo: PathInfo): number {
  if (!pNode) return 0
  let nbPoints = 0
  const aTempPathPoints: PathPoint[] = new Array<PathPoint>(MAXPATHLEN)
  let prevDeltaX = -2
  let prevDeltaY = -2
  let cur: IDAStarNode | null = pNode
  while (cur && cur.pParent && nbPoints < MAXPATHLEN) {
    const pNextPoint: IDAStarNode = cur.pParent
    const deltaX = (cur.tCoord.X - pNextPoint.tCoord.X) | 0
    const deltaY = (cur.tCoord.Y - pNextPoint.tCoord.Y) | 0
    if (deltaX !== prevDeltaX || deltaY !== prevDeltaY) {
      nbPoints++
      aTempPathPoints[MAXPATHLEN - nbPoints] = { X: cur.tCoord.X, Y: cur.tCoord.Y }
      prevDeltaX = deltaX
      prevDeltaY = deltaY
    }
    cur = pNextPoint
  }
  if (nbPoints <= 1 || nbPoints >= MAXPATHLEN) return 0
  const out = pPathInfo.pDynamicPath.PathPoints
  for (let i = 0; i < nbPoints; i++) {
    copyPoint(out[i]!, aTempPathPoints[MAXPATHLEN - nbPoints + i]!)
  }
  return nbPoints
}

function idastarComputePathWithRooms(
  roomSubX: number,
  roomSubY: number,
  roomSubW: number,
  roomSubH: number,
  pPathInfo: PathInfo,
): number {
  d2Assert(
    Math.imul(roomSubW, roomSubH) <= IDASTAR_MAXPROOM,
    'PATH_IdaStar_ComputePathWithRooms: nSubtileHeight * nSubtileWidth <= IDASTAR_MAXPROOM (0x171)',
  )
  const nMaxNodes = Math.imul(roomSubH + 6, roomSubW + 6)
  const useShared = !idastarPoolInUse
  if (useShared) idastarPoolInUse = true
  try {
    let aNodesStorage: IDAStarNode[]
    let aCoordData: Int32Array
    let tStartNode: IDAStarNode
    if (useShared) {
      aNodesStorage = SHARED_IDASTAR_NODES
      for (let i = 0; i < idastarMaxNodesTouched; i++) {
        resetIDAStarNode(aNodesStorage[i]!)
      }
      idastarMaxNodesTouched = 1
      if (nMaxNodes > SHARED_IDASTAR_COORD_DATA.length) {
        SHARED_IDASTAR_COORD_DATA = new Int32Array(nMaxNodes)
      }
      aCoordData = SHARED_IDASTAR_COORD_DATA.subarray(0, nMaxNodes)
      aCoordData.fill(0)
      tStartNode = SHARED_IDASTAR_START_NODE
      resetIDAStarNode(tStartNode)
    } else {
      aNodesStorage = createIDAStarNodesPool()
      aCoordData = new Int32Array(nMaxNodes)
      tStartNode = createIDAStarNode()
    }

    const tContext: IDAStarContext = {
      pCurrentNode: aNodesStorage[0]!,
      aNodesStorage,
      nNodesCount: 1,
      minX: u16(roomSubX),
      minY: u16(roomSubY),
      maxX: u16(roomSubX + roomSubW),
      maxY: u16(roomSubY + roomSubH),
      nStride: (roomSubW + 6) | 0,
      nXOffset: (3 - (roomSubX & 0xffff)) | 0,
      nYOffset: (3 - (roomSubY & 0xffff)) | 0,
      aCoordData,
      bRandomDirection: pPathInfo.nPathType === PATHTYPE_MISSILE_STREAM,
      seedLow: 0,
      seedHigh: 0,
    }

    const tStartCoord = pPathInfo.tStartCoord
    const tTargetCoord = pPathInfo.tTargetCoord
    const heur = i16(PATH_AStar_Heuristic(tStartCoord, tTargetCoord))

    tStartNode.nBestDistanceFromStart = 0
    tStartNode.nHeuristicDistanceToTarget = heur
    tStartNode.nFScore = heur
    copyPoint(tStartNode.tCoord, tStartCoord)
    tStartNode.nEvaluationsCount = -3
    tStartNode.nSequenceIdx = 0
    tStartNode.pBestChild = null
    tStartNode.pParent = null
    tStartNode.nNextNeighborIndex = sub_6FDAB770(tStartCoord, tTargetCoord) & 7

    // 1.13c 0x6FDC0D6A..0x6FDC0DC7 cutoff & maxFScore setup:
    let nFScoreCutoff = heur
    let nMaxFScore = heur
    if (pPathInfo.nPathType === PATHTYPE_IDASTAR) {
      const minEval = pPathInfo.nMinimumFScoreToEvaluate & 0xff
      nMaxFScore = nFScoreCutoff > minEval ? nFScoreCutoff : i16(minEval)
    } else if (pPathInfo.nPathType === PATHTYPE_MISSILE_STREAM) {
      // 1.13c 0x6FDC0D97: eax = (heur / 2) + field_10; if (ebx <= minEval) ebx = minEval
      const halfPlus = i16(idiv(nFScoreCutoff, 2) + i16(pPathInfo.field_10 >>> 16))
      nFScoreCutoff = halfPlus
      const minEval = pPathInfo.nMinimumFScoreToEvaluate & 0xff
      nMaxFScore = nFScoreCutoff > minEval ? nFScoreCutoff : i16(minEval)
    }

    let pValidPathNode: IDAStarNode | null = null
    do {
      copyIDAStarNode(tContext.pCurrentNode, tStartNode)
      pValidPathNode = idastarVisitNodes(tContext, nFScoreCutoff, pPathInfo)
      if (useShared && tContext.nNodesCount > idastarMaxNodesTouched) {
        idastarMaxNodesTouched = tContext.nNodesCount
      }
      nFScoreCutoff = (nFScoreCutoff + 5) | 0
      if (!pValidPathNode && tContext.nNodesCount === IDASTAR_MAX_NODES) break
      tContext.nNodesCount = 1
      if (pValidPathNode) break
    } while (nFScoreCutoff < nMaxFScore)

    if (pValidPathNode) {
      const nPathPoints = idastarFlushNodeToDynamicPath(pValidPathNode, pPathInfo)
      if (nPathPoints < MAXPATHLEN) return nPathPoints
    }
    return 0
  } finally {
    if (useShared) idastarPoolInUse = false
  }
}

/**
 * `PATH_IdaStar_6FDA7970` (1.13c 0x6FDC0E40; D2MOO IDAStar.cpp:132).
 * Finder for `PATHTYPE_IDASTAR` (0) and `PATHTYPE_MISSILE_STREAM` (16).
 */
export function PATH_IdaStar_6FDA7970(pPathInfo: PathInfo): number {
  pPathInfo.field_14 = u8(pPathInfo.field_14 * 2)
  const startRoom = pPathInfo.pStartRoom
  d2Assert(startRoom, 'PATH_IdaStar_6FDA7970: pStartRoom')

  let aabbX = startRoom.subX
  let aabbY = startRoom.subY
  let aabbW = startRoom.subW
  let aabbH = startRoom.subH

  const targetRoom = pPathInfo.pTargetRoom
  if (targetRoom && targetRoom !== startRoom) {
    if (targetRoom.subX >= startRoom.subX) {
      aabbX = startRoom.subX
      aabbW = targetRoom.subX + targetRoom.subW - startRoom.subX
    } else {
      aabbX = targetRoom.subX
      aabbW = startRoom.subX + startRoom.subW - targetRoom.subX
    }
    if (targetRoom.subY >= startRoom.subY) {
      aabbY = startRoom.subY
      aabbH = targetRoom.subY + targetRoom.subH - startRoom.subY
    } else {
      aabbY = targetRoom.subY
      aabbH = startRoom.subY + startRoom.subH - targetRoom.subY
    }
  }

  if (aabbW === startRoom.subW) {
    aabbX -= 10
    aabbW += 20
  }
  if (aabbH === startRoom.subH) {
    aabbY -= 10
    aabbH += 20
  }
  return idastarComputePathWithRooms(aabbX, aabbY, aabbW, aabbH, pPathInfo)
}

// ---------------------------------------------------------------------------
// Wall-follow pathfinder (`PATHTYPE_WALL_FOLLOW` = 15, PathWF.cpp 0x6FD68310..0x6FD68C40)
// ---------------------------------------------------------------------------

const WF_CELL_OFFSETS_TO_DIRS: readonly number[] = [7, 0, 1, 6, -1, 2, 5, 4, 3]
const WF_DIRS_TO_ADJ_CELL_OFFSETS: readonly PathCoord[] = [
  { nX: 0, nY: -1 },
  { nX: 1, nY: -1 },
  { nX: 1, nY: 0 },
  { nX: 1, nY: 1 },
  { nX: 0, nY: 1 },
  { nX: -1, nY: 1 },
  { nX: -1, nY: 0 },
  { nX: -1, nY: -1 },
  { nX: 0, nY: -1 },
  { nX: 1, nY: -1 },
  { nX: 1, nY: 0 },
  { nX: 1, nY: 1 },
  { nX: 0, nY: 1 },
  { nX: -1, nY: 1 },
  { nX: -1, nY: 0 },
  { nX: -1, nY: -1 },
]
const WF_PREV_DIR_1: readonly number[] = [6, 6, 0, 0, 2, 2, 4, 4, 6, 6, 0, 0, 2, 2, 4, 4]
const WF_PREV_DIR_2: readonly number[] = [2, 2, 4, 4, 6, 6, 0, 0, 2, 2, 4, 4, 6, 6, 0, 0]
const WF_NEXT_DIR_1: readonly number[] = [2, 2, 4, 4, 6, 6, 0, 0, 2, 2, 4, 4, 6, 6, 0, 0]
const WF_NEXT_DIR_2: readonly number[] = [6, 0, 0, 2, 2, 4, 4, 6, 6, 0, 0, 2, 2, 4, 4, 6]

interface PathMovStrc {
  nDirectionIndex: number
  nPoints: number
  tCurrentCoord: PathPoint
  tTargetCoord: PathPoint
  bReachedDeadEnd: boolean
  pPrevDirection: readonly number[]
  pNextDirection: readonly number[]
  nLastSyncPointWithOtherPathIndex: number
  bPathFinished: boolean
  pPoints: PathPoint[]
}

function createPathMov(prevDir: readonly number[], nextDir: readonly number[]): PathMovStrc {
  const pPoints: PathPoint[] = []
  for (let i = 0; i < 200; i++) pPoints.push({ X: 0, Y: 0 })
  return {
    nDirectionIndex: 0,
    nPoints: 0,
    tCurrentCoord: { X: 0, Y: 0 },
    tTargetCoord: { X: 0, Y: 0 },
    bReachedDeadEnd: false,
    pPrevDirection: prevDir,
    pNextDirection: nextDir,
    nLastSyncPointWithOtherPathIndex: 0,
    bPathFinished: false,
    pPoints,
  }
}

function wfReplaceSubpathPoints(
  pMov: PathMovStrc,
  pPoints: PathPoint[],
  subState: { nSubPathStartIdx: number; nMaxIndex: number },
  nSubPathLastIdx: number,
): void {
  const nPointsDiff = (subState.nSubPathStartIdx - nSubPathLastIdx + (pMov.nPoints - 1)) | 0
  const nLastReplacedPointIdx = (nSubPathLastIdx + nPointsDiff) | 0
  const tailCount = (subState.nMaxIndex - nSubPathLastIdx - 1) | 0
  if (tailCount > 0) {
    const tmp: PathPoint[] = []
    for (let i = 0; i < tailCount; i++) {
      const src = pPoints[nSubPathLastIdx + 1 + i]!
      tmp.push({ X: src.X, Y: src.Y })
    }
    for (let i = 0; i < tailCount; i++) {
      copyPoint(pPoints[nLastReplacedPointIdx + 1 + i]!, tmp[i]!)
    }
  }
  for (let i = 0; i < pMov.nPoints; i++) {
    copyPoint(pPoints[subState.nSubPathStartIdx + i]!, pMov.pPoints[i]!)
  }
  subState.nMaxIndex = (subState.nMaxIndex + nPointsDiff) | 0
  subState.nSubPathStartIdx = (nLastReplacedPointIdx + 1) | 0
}

function wfFindNonCollidingTargetPoint(pInfo: PathInfo, pMov: PathMovStrc): boolean {
  const pUnit = pInfo.pDynamicPath.pUnit
  d2Assert(
    pUnit && (pUnit.dwUnitType === UNIT_PLAYER || pUnit.dwUnitType === UNIT_MONSTER),
    'PATH_FindNonCollidingTargetPoint: unit is player or monster',
  )
  const checkNewTarget = (): boolean => {
    const off = WF_DIRS_TO_ADJ_CELL_OFFSETS[pMov.nDirectionIndex]!
    pMov.tTargetCoord.X = u16(pMov.tCurrentCoord.X + off.nX)
    pMov.tTargetCoord.Y = u16(pMov.tCurrentCoord.Y + off.nY)
    return (
      COLLISION_CheckAnyCollisionWithPattern(
        pInfo.pStartRoom,
        pMov.tTargetCoord.X,
        pMov.tTargetCoord.Y,
        pInfo.nCollisionPattern,
        pInfo.nCollisionMask & 0xffff,
      ) !== 0
    )
  }

  pMov.bReachedDeadEnd = false
  if (!checkNewTarget()) return true
  pMov.nDirectionIndex = pMov.pNextDirection[pMov.nDirectionIndex]!
  if (!checkNewTarget()) return true
  pMov.nDirectionIndex = pMov.pNextDirection[pMov.nDirectionIndex]!
  if (!checkNewTarget()) return true
  pMov.nDirectionIndex = pMov.pNextDirection[pMov.nDirectionIndex]!
  pMov.bReachedDeadEnd = true
  return !checkNewTarget()
}

function squaredDist(a: PathPoint, b: PathPoint): number {
  const dx = (a.X - b.X) | 0
  const dy = (a.Y - b.Y) | 0
  return (Math.imul(dx, dx) + Math.imul(dy, dy)) | 0
}

function wfFindSubpathWithoutObstacles(
  pInfo: PathInfo,
  tSubPathStart: PathPoint,
  pPathPoints: PathPoint[],
  subState: { nSubPathStartIdx: number; nMaxIndex: number },
  nMaxLength: number,
  nMajorDirection: number,
): number {
  const tCache1 = createPathMov(WF_PREV_DIR_1, WF_NEXT_DIR_1)
  const tCache2 = createPathMov(WF_PREV_DIR_2, WF_NEXT_DIR_2)

  const curPt = pPathPoints[subState.nSubPathStartIdx]!
  const nDirX = (curPt.X - tSubPathStart.X) | 0
  const nDirY = (curPt.Y - tSubPathStart.Y) | 0
  d2Assert(nDirX >= -1 && nDirX <= 1, 'PATH_FindSubpathWithoutObstacles: nDirX in -1..1')
  d2Assert(nDirY >= -1 && nDirY <= 1, 'PATH_FindSubpathWithoutObstacles: nDirY in -1..1')

  const nAdjacentCellIndex = WF_CELL_OFFSETS_TO_DIRS[4 + nDirY * 3 + nDirX]!
  tCache1.nDirectionIndex = nAdjacentCellIndex + 1
  tCache2.nDirectionIndex = nAdjacentCellIndex + 7
  copyPoint(tCache1.tCurrentCoord, tSubPathStart)
  copyPoint(tCache2.tCurrentCoord, tSubPathStart)

  let pCurPath = tCache1
  let pOtherPath = tCache2

  // 1.13c 0x6FD68AA6..0x6FD68AB3:
  //   cmp [esp+0x388], edx (0) ; jne 0x6FD68AB9
  //   cmp [esp+0x40],  edx (0) ; je  0x6FD68950
  // Exits as soon as EITHER probe sets bPathFinished (not both; D2MOO's `!(a && b)`
  // spins forever when pCurPath finishes with nLastSyncPointWithOtherPathIndex != 0).
  while (!tCache1.bPathFinished && !tCache2.bPathFinished) {
    if (!pCurPath.bPathFinished) {
      if (!wfFindNonCollidingTargetPoint(pInfo, pCurPath)) {
        pCurPath.bPathFinished = true
      } else {
        if (pCurPath.nPoints > 0) {
          let nMajorDirectionDistance = 0
          switch (nMajorDirection) {
            case 0:
              nMajorDirectionDistance = (tSubPathStart.Y - pCurPath.tTargetCoord.Y) | 0
              break
            case 1:
              nMajorDirectionDistance = (pCurPath.tTargetCoord.X - tSubPathStart.X) | 0
              break
            case 2:
              nMajorDirectionDistance = (pCurPath.tTargetCoord.Y - tSubPathStart.Y) | 0
              break
            case 3:
              nMajorDirectionDistance = (tSubPathStart.X - pCurPath.tTargetCoord.X) | 0
              break
          }
          if (nMajorDirectionDistance > 0) {
            const nPointInMajorDirectionWithDistance = (nMajorDirectionDistance - 1 + subState.nSubPathStartIdx) | 0
            if (
              nPointInMajorDirectionWithDistance < subState.nMaxIndex &&
              pointsEqual(pCurPath.tTargetCoord, pPathPoints[nPointInMajorDirectionWithDistance]!)
            ) {
              d2Assert(pCurPath.nPoints < nMaxLength, 'PATH_FindSubpathWithoutObstacles: nPoints < nMaxLength (0x1BB)')
              copyPoint(pCurPath.pPoints[pCurPath.nPoints]!, pCurPath.tTargetCoord)
              pCurPath.nPoints++
              pCurPath.pPoints[pCurPath.nPoints]!.X = 0
              wfReplaceSubpathPoints(pCurPath, pPathPoints, subState, nPointInMajorDirectionWithDistance)
              return pCurPath.nPoints
            }
          }
        }

        if (pOtherPath.nPoints > 1) {
          if (pCurPath.nLastSyncPointWithOtherPathIndex > 0) {
            if (pointsEqual(pCurPath.tTargetCoord, pOtherPath.pPoints[pCurPath.nLastSyncPointWithOtherPathIndex - 2]!)) {
              pPathPoints[subState.nSubPathStartIdx]!.X = 0
              subState.nMaxIndex = subState.nSubPathStartIdx
              return 0
            }
            pCurPath.nLastSyncPointWithOtherPathIndex = 0
          }
          if (pointsEqual(pCurPath.tTargetCoord, pOtherPath.tCurrentCoord)) {
            pCurPath.nLastSyncPointWithOtherPathIndex = pOtherPath.nPoints
          }
        }

        pCurPath.nDirectionIndex = pCurPath.pPrevDirection[pCurPath.nDirectionIndex]!
        copyPoint(pCurPath.pPoints[pCurPath.nPoints]!, pCurPath.tTargetCoord)
        pCurPath.nPoints++
        copyPoint(pCurPath.tCurrentCoord, pCurPath.tTargetCoord)

        if (nMaxLength - subState.nMaxIndex - 1 <= pCurPath.nPoints) {
          pCurPath.bPathFinished = true
        }
      }
    }

    if (pCurPath.nLastSyncPointWithOtherPathIndex === 0) {
      const tmp = pCurPath
      pCurPath = pOtherPath
      pOtherPath = tmp
    }
  }

  if (nMaxLength > 80) {
    pPathPoints[subState.nSubPathStartIdx]!.X = 0
    subState.nMaxIndex = subState.nSubPathStartIdx
    return 0
  }

  // 1.13c 0x6FD68B31..0x6FD68B61: when nPoints == 0, `pPoints[nPoints - 1]` reads `bPathFinished`
  // at offset -4 in the struct (which is {X: bPathFinished ? 1 : 0, Y: 0}).
  const pt1: PathPoint = tCache1.nPoints > 0 ? tCache1.pPoints[tCache1.nPoints - 1]! : { X: tCache1.bPathFinished ? 1 : 0, Y: 0 }
  const pt2: PathPoint = tCache2.nPoints > 0 ? tCache2.pPoints[tCache2.nPoints - 1]! : { X: tCache2.bPathFinished ? 1 : 0, Y: 0 }
  const nSquaredDist1 = squaredDist(pt1, pInfo.tTargetCoord)
  const nSquaredDist2 = squaredDist(pt2, pInfo.tTargetCoord)
  const nSquaredDistStartToTarget = squaredDist(pInfo.tStartCoord, pInfo.tTargetCoord)

  let pBestPath: PathMovStrc
  if (nSquaredDist1 < nSquaredDist2) {
    if (nSquaredDistStartToTarget < nSquaredDist1) return 0
    pBestPath = tCache1
  } else {
    if (nSquaredDistStartToTarget < nSquaredDist2) return 0
    pBestPath = tCache2
  }

  if (pBestPath.nPoints > 0) {
    for (let i = 0; i < pBestPath.nPoints; i++) {
      copyPoint(pPathPoints[subState.nSubPathStartIdx + i]!, pBestPath.pPoints[i]!)
    }
  }
  const nNewSubPathStart = (subState.nSubPathStartIdx + pBestPath.nPoints) | 0
  subState.nSubPathStartIdx = nNewSubPathStart
  subState.nMaxIndex = nNewSubPathStart
  pPathPoints[nNewSubPathStart]!.X = 0
  return pCurPath.nPoints
}

/**
 * `PATH_SimplifyToLines` (1.13c 0x6FD68310; D2MOO PathWF.cpp:322).
 * Collapses collinear intermediate points in `pInputPoints[0..nbTempPoints-1]`.
 */
export function PATH_SimplifyToLines(
  pOutPathPoints: PathPoint[],
  pInputPoints: readonly PathPoint[],
  tStartCoord: PathPoint,
  nbTempPoints: number,
): number {
  if (nbTempPoints >= 2) {
    let nbOutPoints = 0
    let prevDeltaX = (pInputPoints[0]!.X - tStartCoord.X) | 0
    let prevDeltaY = (pInputPoints[0]!.Y - tStartCoord.Y) | 0
    let nbPointsInLine = 0
    let nCurrentPointIdx = 0
    for (; nCurrentPointIdx < nbTempPoints - 1; nCurrentPointIdx++) {
      let deltaX = (pInputPoints[nCurrentPointIdx + 1]!.X - pInputPoints[nCurrentPointIdx]!.X) | 0
      const deltaY = (pInputPoints[nCurrentPointIdx + 1]!.Y - pInputPoints[nCurrentPointIdx]!.Y) | 0
      if (deltaX === prevDeltaX && deltaY === prevDeltaY) {
        nbPointsInLine++
      } else if (nbPointsInLine <= 0 && prevDeltaX !== deltaX && prevDeltaY !== deltaY) {
        deltaX = -2
        nbPointsInLine = 1
      } else {
        copyPoint(pOutPathPoints[nbOutPoints++]!, pInputPoints[nCurrentPointIdx]!)
        nbPointsInLine = 0
      }
      prevDeltaY = deltaY
      prevDeltaX = deltaX
    }
    if (nCurrentPointIdx < nbTempPoints) {
      copyPoint(pOutPathPoints[nbOutPoints++]!, pInputPoints[nCurrentPointIdx]!)
    }
    return nbOutPoints
  }
  if (nbTempPoints === 1) {
    copyPoint(pOutPathPoints[0]!, pInputPoints[0]!)
    return 1
  }
  return 0
}

/** `PATH_BresenhamLine` (1.13c 0x6FD684C0; D2MOO PathWF.cpp:371). */
export function PATH_BresenhamLine(
  tStartPoint: PathPoint,
  tTargetPoint: PathPoint,
  nDistMax: number,
  outMajor: { nMajorDirection: number },
  pOutPoints: PathPoint[],
): number {
  const nMaxManhattanDistMinusOne = (nDistMax - 1) | 0
  outMajor.nMajorDirection = 0

  let nAbsDiffX = (tTargetPoint.X - tStartPoint.X) | 0
  let nAbsDiffY = (tTargetPoint.Y - tStartPoint.Y) | 0
  let nStepX = 1
  let nStepY = 1
  if (nAbsDiffX < 0) {
    nAbsDiffX = -nAbsDiffX | 0
    nStepX = -1
  }
  if (nAbsDiffY < 0) {
    nAbsDiffY = -nAbsDiffY | 0
    nStepY = -1
  }

  let nbPoints = 0
  if (nAbsDiffX === 0 && nAbsDiffY === 0) {
    return 0
  }
  if (nAbsDiffX === 0 && nAbsDiffY !== 0) {
    outMajor.nMajorDirection = nStepY <= 0 ? 0 : 2
    if (nAbsDiffY > nMaxManhattanDistMinusOne) return 0
    let nY = tStartPoint.Y
    do {
      nY = u16(nY + nStepY)
      pOutPoints[nbPoints]!.X = tStartPoint.X
      pOutPoints[nbPoints]!.Y = nY
      nbPoints++
      nAbsDiffY--
    } while (nAbsDiffY !== 0)
  } else if (nAbsDiffX !== 0 && nAbsDiffY === 0) {
    outMajor.nMajorDirection = nStepX <= 0 ? 3 : 1
    if (nAbsDiffX > nMaxManhattanDistMinusOne) return 0
    let nX = tStartPoint.X
    do {
      nX = u16(nX + nStepX)
      pOutPoints[nbPoints]!.X = nX
      pOutPoints[nbPoints]!.Y = tStartPoint.Y
      nbPoints++
      nAbsDiffX--
    } while (nAbsDiffX !== 0)
  } else if (nAbsDiffX < nAbsDiffY) {
    outMajor.nMajorDirection = nStepY <= 0 ? 0 : 2
    if (nAbsDiffY > nMaxManhattanDistMinusOne) return 0
    const tCurrentPoint: PathPoint = { X: tStartPoint.X, Y: tStartPoint.Y }
    let nDeviation = 0
    let nRemainingStepsY = nAbsDiffY
    do {
      nDeviation = (nDeviation + nAbsDiffX) | 0
      tCurrentPoint.Y = u16(tCurrentPoint.Y + nStepY)
      if (nDeviation >= nAbsDiffY) {
        nDeviation = (nDeviation - nAbsDiffY) | 0
        tCurrentPoint.X = u16(tCurrentPoint.X + nStepX)
      }
      copyPoint(pOutPoints[nbPoints]!, tCurrentPoint)
      nbPoints++
      nRemainingStepsY--
    } while (nRemainingStepsY !== 0)
  } else {
    outMajor.nMajorDirection = nStepX <= 0 ? 3 : 1
    if (nAbsDiffX > nMaxManhattanDistMinusOne) return 0
    let nRemainingStepsX = nAbsDiffX
    let nDeviation = 0
    const tCurrentCoord: PathPoint = { X: tStartPoint.X, Y: tStartPoint.Y }
    do {
      nDeviation = (nDeviation + nAbsDiffY) | 0
      tCurrentCoord.X = u16(tCurrentCoord.X + nStepX)
      if (nDeviation >= nAbsDiffX) {
        nDeviation = (nDeviation - nAbsDiffX) | 0
        tCurrentCoord.Y = u16(tCurrentCoord.Y + nStepY)
      }
      copyPoint(pOutPoints[nbPoints]!, tCurrentCoord)
      nbPoints++
      nRemainingStepsX--
    } while (nRemainingStepsX !== 0)
  }

  pOutPoints[nbPoints]!.X = 0
  return nbPoints
}

/**
 * `PATH_ComputePathOrSlideAlongObstacles` (1.13c 0x6FD68C40; D2MOO PathWF.cpp:501).
 * Finder for `PATHTYPE_WALL_FOLLOW` (15).
 */
export function PATH_ComputePathOrSlideAlongObstacles(ptPathInfo: PathInfo): number {
  const pUnit = ptPathInfo.pDynamicPath.pUnit
  d2Assert(
    pUnit && (pUnit.dwUnitType === UNIT_PLAYER || pUnit.dwUnitType === UNIT_MONSTER),
    'PATH_ComputePathOrSlideAlongObstacles: unit is player or monster (0x2AD)',
  )

  let nDist = ptPathInfo.pDynamicPath.nDistMax
  if (ptPathInfo.pDynamicPath.pTargetUnit && nDist < 40) {
    nDist = 40
  }

  const outMajor = { nMajorDirection: 0 }
  const aPathPoints: PathPoint[] = []
  for (let i = 0; i < 200; i++) aPathPoints.push({ X: 0, Y: 0 })

  const pStartPoint: PathPoint = { X: ptPathInfo.tStartCoord.X, Y: ptPathInfo.tStartCoord.Y }
  const nMovementPoints = PATH_BresenhamLine(pStartPoint, ptPathInfo.tTargetCoord, nDist, outMajor, aPathPoints)
  if (nMovementPoints > 2) {
    const tSubPathStartPoint: PathPoint = { X: pStartPoint.X, Y: pStartPoint.Y }
    const subState = { nSubPathStartIdx: 0, nMaxIndex: nMovementPoints }
    for (; subState.nSubPathStartIdx < subState.nMaxIndex; subState.nSubPathStartIdx++) {
      const pt = aPathPoints[subState.nSubPathStartIdx]!
      if (
        COLLISION_CheckAnyCollisionWithPattern(
          ptPathInfo.pStartRoom,
          pt.X,
          pt.Y,
          ptPathInfo.nCollisionPattern,
          ptPathInfo.nCollisionMask & 0xffff,
        )
      ) {
        const nCacheIndex = wfFindSubpathWithoutObstacles(
          ptPathInfo,
          tSubPathStartPoint,
          aPathPoints,
          subState,
          (nDist - subState.nSubPathStartIdx) | 0,
          outMajor.nMajorDirection,
        )
        if (!nCacheIndex) {
          return PATH_SimplifyToLines(ptPathInfo.pDynamicPath.PathPoints, aPathPoints, pStartPoint, subState.nSubPathStartIdx)
        }
      }
      copyPoint(tSubPathStartPoint, aPathPoints[subState.nSubPathStartIdx]!)
    }

    if (subState.nMaxIndex !== 0) {
      return PATH_SimplifyToLines(ptPathInfo.pDynamicPath.PathPoints, aPathPoints, pStartPoint, subState.nMaxIndex)
    }
  }
  return 0
}

// ---------------------------------------------------------------------------
// D2Common_10142 (#10334) and pre/post helpers (0x6FD85160..0x6FD86599)
// ---------------------------------------------------------------------------

/**
 * `PATH_AdvanceToDoor` (1.13c 0x6FD85160, eax=pPathInfo; D2MOO Path.cpp:580).
 * Offsets `tTargetCoord` by +/-2 sub-tiles across the door according to the door's `orientation`.
 */
export function PATH_AdvanceToDoor(pPathInfo: PathInfo): number {
  const pTargetUnit = pPathInfo.pDynamicPath.pTargetUnit
  d2Assert(pTargetUnit && UNITS_IsDoor(pTargetUnit), 'PATH_AdvanceToDoor: UNITS_IsDoor(pTargetUnit) (0x2AF)')
  const orientIs1 = pTargetUnit.objectTxt ? pTargetUnit.objectTxt.orientation === 1 : false
  if (!orientIs1) {
    if (pPathInfo.pDynamicPath.wPosX >= UNITS_GetXPosition(pTargetUnit)) {
      pPathInfo.pDynamicPath.tTargetCoord.X = u16(pPathInfo.pDynamicPath.tTargetCoord.X + 2)
    } else {
      pPathInfo.pDynamicPath.tTargetCoord.X = u16(pPathInfo.pDynamicPath.tTargetCoord.X - 2)
    }
  } else {
    if (pPathInfo.pDynamicPath.wPosY >= UNITS_GetYPosition(pTargetUnit)) {
      pPathInfo.pDynamicPath.tTargetCoord.Y = u16(pPathInfo.pDynamicPath.tTargetCoord.Y + 2)
    } else {
      pPathInfo.pDynamicPath.tTargetCoord.Y = u16(pPathInfo.pDynamicPath.tTargetCoord.Y - 2)
    }
  }
  return 2
}

/**
 * `PATH_UpdateTargetUnit` (1.13c 0x6FD85470, edi=pPathInfo; D2MOO Path.cpp:314).
 * Copies the target unit's current sub-tile into `pPath->tTargetCoord` and returns `field_14` (0, 1, or 2).
 */
export function PATH_UpdateTargetUnit(pPathInfo: PathInfo): number {
  const pPath = pPathInfo.pDynamicPath
  const pPathTargetUnit = pPath.pTargetUnit
  if (pPathTargetUnit) {
    pPath.tTargetCoord.X = u16(UNITS_GetXPosition(pPathTargetUnit))
    pPath.tTargetCoord.Y = u16(UNITS_GetYPosition(pPathTargetUnit))
    if (pPath.tTargetCoord.X === 0 && pPath.tTargetCoord.Y === 0) {
      return 0
    }
    switch (pPathTargetUnit.dwUnitType) {
      case UNIT_PLAYER:
      case UNIT_MONSTER:
        if (pPath.dwSpeed !== 0) {
          PATHUtil_AdvanceTowardsTarget_6FDAB890(pPath)
        }
        return 1
      case UNIT_OBJECT:
        if (!UNITS_IsDoor(pPathTargetUnit)) return 2
        return PATH_AdvanceToDoor(pPathInfo)
      case UNIT_ITEM:
        return 2
      default:
        return 1
    }
  }
  return 1
}

/**
 * `PATH_IsTargetDestinationAllowed` (1.13c 0x6FD856E0, esi=pPathInfo edx=pUnit; D2MOO Path.cpp:253).
 * Monsters that cannot be in town (`!MONSTERS_CanBeInTown`) may not path into a town room.
 */
export function PATH_IsTargetDestinationAllowed(pPathInfo: PathInfo, pUnit: PathUnit | null): boolean {
  if (pUnit && pUnit.dwUnitType === UNIT_MONSTER) {
    if (MONSTERS_CanBeInTown(pUnit)) return true
    let pTargetRoom = pPathInfo.pTargetRoom
    if (!pTargetRoom) {
      const midX = (pPathInfo.tStartCoord.X + idiv((pPathInfo.tTargetCoord.X - pPathInfo.tStartCoord.X) | 0, 2)) | 0
      const midY = (pPathInfo.tStartCoord.Y + idiv((pPathInfo.tTargetCoord.Y - pPathInfo.tStartCoord.Y) | 0, 2)) | 0
      const pRoomHalfway = DUNGEON_GetRoomAtPosition(pPathInfo.pStartRoom, midX, midY)
      pTargetRoom = DUNGEON_GetRoomAtPosition(pRoomHalfway, pPathInfo.tTargetCoord.X, pPathInfo.tTargetCoord.Y)
    }
    if (pTargetRoom && pTargetRoom.isTown) {
      return false
    }
  }
  return true
}

/**
 * `PATH_FindValidTargetCoordsByMovingOrthogonally` (1.13c 0x6FD85D40, esi=pPathInfo; D2MOO Path.cpp:545).
 * When `|dx| < 5 && |dy| < 5 && (dx != 0 || dy != 0)`, steps `tTargetCoord` outward along the
 * snapped cardinal direction (`SNAP_TO_CARDINAL` at `0x6FDE4338`) up to Chebyshev distance 5 while
 * collision-free.
 */
export function PATH_FindValidTargetCoordsByMovingOrthogonally(pPathInfo: PathInfo): void {
  const tCoords: PathPoint = { X: pPathInfo.tTargetCoord.X, Y: pPathInfo.tTargetCoord.Y }
  const nDeltaX = (tCoords.X - pPathInfo.tStartCoord.X) | 0
  const nDeltaY = (tCoords.Y - pPathInfo.tStartCoord.Y) | 0
  const nAbsDeltaX = Math.abs(nDeltaX)
  const nAbsDeltaY = Math.abs(nDeltaY)
  if (nAbsDeltaX < 5 && nAbsDeltaY < 5 && (nDeltaX !== 0 || nDeltaY !== 0)) {
    const nRemappedX = (nDeltaX + 4) | 0
    const nRemappedY = (nDeltaY + 4) | 0
    const nOffsetX = SNAP_TO_CARDINAL[nRemappedY * 9 + nRemappedX]!
    const nOffsetY = SNAP_TO_CARDINAL[nRemappedX * 9 + nRemappedY]!
    let nChebyshevDistance = Math.max(nAbsDeltaX, nAbsDeltaY)
    while (nChebyshevDistance < 5) {
      tCoords.X = u16(tCoords.X + nOffsetX)
      tCoords.Y = u16(tCoords.Y + nOffsetY)
      if (
        COLLISION_CheckAnyCollisionWithPattern(
          pPathInfo.pStartRoom,
          tCoords.X,
          tCoords.Y,
          pPathInfo.nCollisionPattern,
          pPathInfo.nCollisionMask,
        )
      ) {
        break
      }
      nChebyshevDistance++
      pPathInfo.tTargetCoord.X = tCoords.X
      pPathInfo.tTargetCoord.Y = tCoords.Y
    }
  }
}

/**
 * `PATH_PreparePathTargetForPathUpdate` (1.13c 0x6FD85E00, eax=pPathInfo; D2MOO PathMisc.cpp:229).
 * Walks 3 candidate directions from `tTargetCoord` toward `tStartCoord` until a collision-free
 * sub-tile is found.
 * Note 1.13c vs D2MOO difference (`c_84600.txt:1962-1993`):
 * - When candidate `i` (0, 1, or 2) is collision-free, 1.13c compares THAT candidate (`aTestDirPathPoints[i]`)
 *   against `tStartCoord` (returning `false` if equal), whereas D2MOO mistakenly compared `aTestDirPathPoints[0]`.
 * - 1.13c reads `nUnitType = pUnit ? pUnit->dwUnitType : 6` (`UNIT_TYPES_COUNT`) before the loop and calls
 *   `PATH_FindValidTargetCoordsByMovingOrthogonally` when `nUnitType == 0` (`UNIT_PLAYER`).
 */
export function PATH_PreparePathTargetForPathUpdate(pPathInfo: PathInfo): boolean {
  const pPath = pPathInfo.pDynamicPath
  d2Assert(!(pPath.dwFlags & PATH_MISSILE_MASK), 'PATH_PreparePathTargetForPathUpdate: !(dwFlags & PATH_MISSILE_MASK) (0xC7)')

  const nUnitType = pPath.pUnit ? pPath.pUnit.dwUnitType : UNIT_TYPES_COUNT
  const p0: PathPoint = { X: pPathInfo.tTargetCoord.X, Y: pPathInfo.tTargetCoord.Y }
  const p1: PathPoint = { X: pPathInfo.tTargetCoord.X, Y: pPathInfo.tTargetCoord.Y }
  const p2: PathPoint = { X: pPathInfo.tTargetCoord.X, Y: pPathInfo.tTargetCoord.Y }
  const pTestDir: [number, number, number] = [0, 0, 0]
  sub_6FDAB7D0(pTestDir, pPathInfo.tTargetCoord, pPathInfo.tStartCoord)

  const maxSteps =
    Math.abs(p0.X - pPathInfo.tStartCoord.X) + Math.abs(p0.Y - pPathInfo.tStartCoord.Y) + 8
  if (!Number.isFinite(maxSteps)) {
    return false
  }

  for (let step = 0; step < maxSteps; step++) {
    if (pointsEqual(pPathInfo.tStartCoord, p0)) {
      return false
    }

    let chosen: PathPoint | null = null
    p0.X = u16(p0.X + dirOffsetX(pTestDir[0]))
    p0.Y = u16(p0.Y + dirOffsetY(pTestDir[0]))
    if (
      !COLLISION_CheckAnyCollisionWithPattern(
        pPathInfo.pStartRoom,
        p0.X,
        p0.Y,
        pPathInfo.nCollisionPattern,
        pPathInfo.nCollisionMask,
      )
    ) {
      chosen = p0
    } else {
      p1.X = u16(p1.X + dirOffsetX(pTestDir[1]))
      p1.Y = u16(p1.Y + dirOffsetY(pTestDir[1]))
      if (
        !COLLISION_CheckAnyCollisionWithPattern(
          pPathInfo.pStartRoom,
          p1.X,
          p1.Y,
          pPathInfo.nCollisionPattern,
          pPathInfo.nCollisionMask,
        )
      ) {
        chosen = p1
      } else if (pTestDir[2] !== PATH_DIR_NULL) {
        p2.X = u16(p2.X + dirOffsetX(pTestDir[2]))
        p2.Y = u16(p2.Y + dirOffsetY(pTestDir[2]))
        if (
          !COLLISION_CheckAnyCollisionWithPattern(
            pPathInfo.pStartRoom,
            p2.X,
            p2.Y,
            pPathInfo.nCollisionPattern,
            pPathInfo.nCollisionMask,
          )
        ) {
          chosen = p2
        }
      }
    }

    if (chosen) {
      copyPoint(pPathInfo.tTargetCoord, chosen)
      if (pointsEqual(chosen, pPathInfo.tStartCoord)) {
        return false
      }
      if (nUnitType === UNIT_PLAYER) {
        PATH_FindValidTargetCoordsByMovingOrthogonally(pPathInfo)
      }
      return true
    }

    pTestDir[0] = PREPARE_TARGET_DIRECTIONS[sub_6FDAB6A0(p0, pPathInfo.tStartCoord) * 3]!
  }
  return false
}

type PathFinderFn = (pPathInfo: PathInfo) => number

/**
 * 1.13c pathfinder dispatch table at `D2Common.dll` `0x6FDE42F0` (`peread.py` verified).
 * Entries 4, 10, 14, 17 are NULL (missile path types, guarded by `PATH_MISSILE_MASK`).
 */
export const PATH_FINDER_TABLE_113C: readonly (PathFinderFn | null)[] = Object.freeze([
  /* [ 0] PATHTYPE_IDASTAR */ PATH_IdaStar_6FDA7970,
  /* [ 1] PATHTYPE_ASTAR */ PATH_AStar_ComputePath,
  /* [ 2] PATHTYPE_TOWARD */ PATH_Toward_6FDAA9F0,
  /* [ 3] PATHTYPE_UNKNOWN_3 */ sub_6FDAB0B0,
  /* [ 4] PATHTYPE_MISSILE */ null,
  /* [ 5] PATHTYPE_MON_CIRCLE_CW */ PATH_Toward_6FDAA9F0,
  /* [ 6] PATHTYPE_MON_CIRCLE_CCW */ PATH_Toward_6FDAA9F0,
  /* [ 7] PATHTYPE_STRAIGHT */ PATH_Straight_Compute,
  /* [ 8] PATHTYPE_KNOCKBACK_SERVER */ PATH_Knockback_Server,
  /* [ 9] PATHTYPE_LEAP */ PATH_Leap_6FDAB1E0,
  /* [10] PATHTYPE_CHARGEDBOLT */ null,
  /* [11] PATHTYPE_KNOCKBACK_CLIENT */ PATH_Knockback_Client,
  /* [12] PATHTYPE_BACKUP_TURN */ PATH_BackupTurn_Compute,
  /* [13] PATHTYPE_TOWARD_FINISH */ PATH_Toward_6FDAA9F0,
  /* [14] PATHTYPE_BLESSEDHAMMER */ null,
  /* [15] PATHTYPE_WALL_FOLLOW */ PATH_ComputePathOrSlideAlongObstacles,
  /* [16] PATHTYPE_MISSILE_STREAM */ PATH_IdaStar_6FDA7970,
  /* [17] PATHTYPE_UNKNOWN_17 */ null,
])

/**
 * `D2Common_10142` (#10334, 1.13c 0x6FD86230; D2MOO #10142 Path.cpp:353).
 * Top-level path computation entry point called by D2Client (0x6FAFDC70 / 0x6FAFF4A0) and by
 * `D2Common_10236` during per-tick re-pathing.
 */
export function D2Common_10142(
  pPath: DynamicPath | null,
  pUnit: PathUnit | null,
  bAllowInTown: number | boolean,
): number {
  if (!pPath) return 0
  d2Assert(pPath.pUnit === pUnit, 'D2Common_10142: pPath->pUnit == pUnit (0x2E8)')

  if (pPath.dwFlags & PATH_MISSILE_MASK) {
    throw new D2AssertError('D2Common_10142: missile path types (PATH_MISSILE_MASK) are out of scope for the client monster path port')
  }

  pPath.nCollidedWithMask = 0
  const pTargetUnit = pPath.pTargetUnit
  if (pTargetUnit && (UNITS_GetXPosition(pTargetUnit) === 0 || UNITS_GetYPosition(pTargetUnit) === 0)) {
    return 0
  }

  const tStart: PathPoint = { X: pPath.wPosX, Y: pPath.wPosY }
  const tPathInfo = createPathInfo(pPath)
  copyPoint(tPathInfo.tStartCoord, tStart)

  if (tStart.X !== 0 || tStart.Y !== 0) {
    tPathInfo.nUnitSize = pPath.dwUnitSize
    tPathInfo.nCollisionPattern = pPath.dwCollisionPattern
    tPathInfo.nCollisionMask = pPath.nMoveTestCollisionMask
    tPathInfo.nDistMax = pPath.nDistMax
    tPathInfo.nMinimumFScoreToEvaluate = pPath.nIDAStarInitFScore
    tPathInfo.field_14 = PATH_UpdateTargetUnit(tPathInfo)

    if (pPath.tTargetCoord.X !== 0 || pPath.tTargetCoord.Y !== 0) {
      copyPoint(tPathInfo.tTargetCoord, pPath.tTargetCoord)
      const dx = (tPathInfo.tTargetCoord.X - tPathInfo.tStartCoord.X) | 0
      const dy = (tPathInfo.tTargetCoord.Y - tPathInfo.tStartCoord.Y) | 0
      if (
        !pointsEqual(tPathInfo.tStartCoord, tPathInfo.tTargetCoord) &&
        dx <= 100 &&
        -dx <= 100 &&
        dy <= 100 &&
        -dy <= 100
      ) {
        tPathInfo.pStartRoom = pPath.pRoom
        tPathInfo.pTargetRoom = DUNGEON_GetRoomAtPosition(
          tPathInfo.pStartRoom,
          tPathInfo.tTargetCoord.X,
          tPathInfo.tTargetCoord.Y,
        )

        if (
          tPathInfo.pStartRoom &&
          tPathInfo.pTargetRoom &&
          (PATH_IsTargetDestinationAllowed(tPathInfo, pUnit) || Boolean(bAllowInTown))
        ) {
          tPathInfo.nPathType = pPath.dwPathType

          let bRemovedTargetUnitFootprint = false
          if (pUnit) {
            PATH_RemoveCollisionFootprintForUnit(pUnit, false)
          }
          if (
            pPath.pTargetUnit &&
            UNITS_GetUnitSizeX(pPath.pTargetUnit) !== 0 &&
            (pPath.dwFlags & PATH_UNKNOWN_FLAG_0x00800) !== 0
          ) {
            bRemovedTargetUnitFootprint = PATH_RemoveCollisionFootprintForUnit(pPath.pTargetUnit, false)
          }

          let bUpdatePath = true
          if (
            (pPath.dwFlags & PATH_UNKNOWN_FLAG_0x01000) !== 0 &&
            COLLISION_CheckAnyCollisionWithPattern(
              tPathInfo.pStartRoom,
              tPathInfo.tTargetCoord.X,
              tPathInfo.tTargetCoord.Y,
              pPath.dwCollisionPattern,
              pPath.nMoveTestCollisionMask,
            )
          ) {
            bUpdatePath = PATH_PreparePathTargetForPathUpdate(tPathInfo)
          }

          pPath.dwCurrentPointIdx = 0
          pPath.dwPathPoints = 0
          copyPoint(pPath.tFinalTargetCoord, tPathInfo.tTargetCoord)

          if (bUpdatePath) {
            d2Assert(
              tPathInfo.nPathType >= 0 && tPathInfo.nPathType < PATHTYPE_COUNT,
              `D2Common_10142: invalid path type ${tPathInfo.nPathType}`,
            )
            const fn = PATH_FINDER_TABLE_113C[tPathInfo.nPathType]
            d2Assert(fn, `D2Common_10142: null pathfinder for path type ${tPathInfo.nPathType} (0x37E)`)
            pPath.dwPathPoints = fn(tPathInfo)
          }

          d2Assert(pointsEqual(tPathInfo.tStartCoord, tStart), 'D2Common_10142: tPathInfo.tStartCoord == tStart (0x389)')
          if (bRemovedTargetUnitFootprint && pPath.pTargetUnit) {
            PATH_AddCollisionFootprintForUnit(pPath.pTargetUnit)
          }
          if (pUnit) {
            PATH_AddCollisionFootprintForUnit(pUnit)
          }

          if (!pPath.dwPathPoints) {
            pPath.dwFlags = u32(pPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00020)
            return 0
          }

          PATH_ComputeVelocityAndDirectionVectorsToNextPoint(pPath, 1, 1)
          if (pPath.dwCurrentPointIdx < pPath.dwPathPoints) {
            sub_6FDA8220(pPath)
            copyPoint(pPath.tPrevTargetCoord, pPath.tTargetCoord)
            pPath.unk0x38 = 0
            if ((pPath.dwFlags & PATH_UNKNOWN_FLAG_0x00010) === 0 && !pPath.pTargetUnit) {
              copyPoint(pPath.tTargetCoord, pPath.PathPoints[pPath.dwPathPoints - 1]!)
            }
            if (pPath.dwPathPoints) {
              pPath.dwFlags = u32(pPath.dwFlags | PATH_UNKNOWN_FLAG_0x00020)
            } else {
              pPath.dwFlags = u32(pPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00020)
            }
            return pPath.dwPathPoints
          }
        }
      }
    }
  }

  pPath.dwCurrentPointIdx = 0
  pPath.dwPathPoints = 0
  pPath.dwFlags = u32(pPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00020)
  return 0
}

// Wire D2Common_10142 into step.ts so D2Common_10236 can invoke it.
_registerPathComputeImpl(D2Common_10142)

// ---------------------------------------------------------------------------
// Room adjacency helper (D2MOO DrlgDrlgRoom.cpp:601 sub_6FD77BB0 + :747 DRLGROOM_SortRoomListByPosition)
// ---------------------------------------------------------------------------

/**
 * Builds the `ppRoomList` (`adjacentRooms`) for each room in `rooms` using the exact D2Common
 * `sub_6FD77BB0` + `DRLGROOM_SortRoomListByPosition` rule (D2MOO `DrlgDrlgRoom.cpp:601-652, 747-766`):
 * - Converts sub-tile coordinates to tile coordinates (`tile = Math.floor(sub / 5)`).
 * - Includes every room `B` where the tile-coordinate gap between `A` and `B` is `< 6` on both X and Y
 *   (in sub-tiles: gap `< 30`).
 * - Sorts the near-room list with the exact bubble-sort comparator from `DRLGROOM_SortRoomListByPosition`:
 *   swaps `(r[i], r[i+1])` when `r[i].tileX >= r[i+1].tileX + r[i+1].tileW || r[i].tileY >= r[i+1].tileY + r[i+1].tileH`.
 */
export function buildAdjacentRoomLists<T extends { readonly subX: number; readonly subY: number; readonly subW: number; readonly subH: number }>(
  rooms: readonly T[],
): Map<T, T[]> {
  const result = new Map<T, T[]>()
  for (const roomA of rooms) {
    const aTileX = Math.floor(roomA.subX / 5)
    const aTileY = Math.floor(roomA.subY / 5)
    const aTileW = Math.floor(roomA.subW / 5)
    const aTileH = Math.floor(roomA.subH / 5)
    const near: T[] = []
    for (const roomB of rooms) {
      const bTileX = Math.floor(roomB.subX / 5)
      const bTileY = Math.floor(roomB.subY / 5)
      const bTileW = Math.floor(roomB.subW / 5)
      const bTileH = Math.floor(roomB.subH / 5)
      const nX = aTileX >= bTileX ? aTileX - bTileW - bTileX : bTileX - aTileW - aTileX
      const nY = aTileY >= bTileY ? aTileY - bTileH - bTileY : bTileY - aTileH - aTileY
      if (nX < 6 && nY < 6) {
        near.push(roomB)
      }
    }
    const nListSize = near.length
    for (let j = nListSize - 1; j > 0; --j) {
      for (let i = 0; i < nListSize - 1; ++i) {
        const r1 = near[i + 1]!
        const r2 = near[i]!
        const r1TileX = Math.floor(r1.subX / 5)
        const r1TileY = Math.floor(r1.subY / 5)
        const r1TileW = Math.floor(r1.subW / 5)
        const r1TileH = Math.floor(r1.subH / 5)
        const r2TileX = Math.floor(r2.subX / 5)
        const r2TileY = Math.floor(r2.subY / 5)
        if (r2TileX >= r1TileX + r1TileW || r2TileY >= r1TileY + r1TileH) {
          near[i] = r1
          near[i + 1] = r2
        }
      }
    }
    result.set(roomA, near)
  }
  return result
}

/**
 * `PATH_ComputePathChargedBolt` (`D2Common.dll` 1.13c `0x6FDB6AA0`, `PATHTYPE_CHARGEDBOLT` = 10).
 * Generates the jagged 8-directional random-walk waypoint array for a Charged Bolt missile:
 * - Clamps `nDistMax` to `77` (`0x4d`) and sets `nSteps = Math.max(1, clampedDist >> 1)`.
 * - Determines `mainDir = TOWARD_DIRECTIONS[sub_6FDAB610(start, target) * 3]` (0..7 octant).
 * - At each step, advances the missile's 64-bit LCG (`0x6AC690C5`, initial high dword `0x29A` = 666
 *   from `SEED_InitLowSeed` `#10614` at `0x6FD86740`), indexes `CHARGED_BOLT_DIR_OFFSETS[low & 31]`
 *   (`0x6FDDDC78`, 32-entry table of `{-1, 0, +1}`), computes `stepDir = (mainDir + delta) & 7`,
 *   and advances cumulative coordinates by `2 * DIRECTION_TO_OFFSET_A[stepDir]`.
 */
export function PATH_ComputePathChargedBolt_6FDB6AA0(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  nDistMax: number,
  lowSeed: number,
  highSeed = 0x29a,
): { readonly x: number; readonly y: number }[] {
  const clampedDist = Math.min(77, Math.max(2, Math.trunc(nDistMax)))
  const nSteps = Math.max(1, clampedDist >> 1)
  const sx = Math.floor(startX)
  const sy = Math.floor(startY)
  const tx = Math.floor(targetX)
  const ty = Math.floor(targetY)
  const sector =
    sx === tx && sy === ty
      ? sub_6FDAB610(0, 0, Math.round((targetX - startX) * 16), Math.round((targetY - startY) * 16))
      : sub_6FDAB610(sx, sy, tx, ty)
  const mainDir = TOWARD_DIRECTIONS[sector * 3] ?? 0

  let seedLow = lowSeed >>> 0
  let seedHigh = highSeed >>> 0
  let cumDx = 0
  let cumDy = 0
  const waypoints: { readonly x: number; readonly y: number }[] = []

  for (let i = 0; i < nSteps; i++) {
    const prod = BigInt(seedLow) * 0x6ac690c5n + BigInt(seedHigh)
    seedLow = Number(prod & 0xffffffffn) >>> 0
    seedHigh = Number((prod >> 32n) & 0xffffffffn) >>> 0
    const delta = CHARGED_BOLT_DIR_OFFSETS[seedLow & 31]!
    const stepDir = (mainDir + delta) & 7
    cumDx += DIRECTION_TO_OFFSET_A[stepDir * 2]! * 2
    cumDy += DIRECTION_TO_OFFSET_A[stepDir * 2 + 1]! * 2
    waypoints.push({ x: startX + cumDx, y: startY + cumDy })
  }

  return waypoints
}

