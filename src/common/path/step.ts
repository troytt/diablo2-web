/**
 * Diablo II 1.13c D2Common per-tick step, velocity/direction vectors, re-target,
 * unit-size distance, and teleport primitives (Refs #808).
 *
 * Ported instruction-by-instruction from `D2Common.dll` 1.13c (ImageBase 0x6FD50000):
 * - `0x6FD5CEB0..0x6FD5E345` (`Step.cpp` / `PathMisc.cpp`)
 * - `0x6FD86650` (`#10340` ≡ `D2Common_10213`)
 * - `0x6FD817F0` (`#10434` ≡ `UNITS_SetTargetUnitForDynamicUnit`)
 * - `0x6FD8E080..0x6FD8E3FD` (`PathUtil.cpp`)
 * - `0x6FDCFCD0` (`#10407` ≡ `D2Common_10399`)
 */

import {
  COLLIDE_MISSILE_BARRIER,
  COLLIDE_WALL,
  COLLISION_CheckMaskWithSize,
  COLLISION_ResetMaskWithPattern,
  COLLISION_ResetMaskWithSize,
  COLLISION_SetMaskWithPattern,
  COLLISION_SetMaskWithSize,
  COLLISION_SetUnitCollisionMask,
  COLLISION_TryMoveUnitCollisionMask,
  COLLISION_TrySetUnitCollisionMask,
  COLLISION_TryTeleportUnitCollisionMask,
  DUNGEON_GetRoomAtPosition,
} from './collision.ts'
import { PATH_GetDirectionVector, PATH_NormalizeDirection, subtileCenter } from './direction.ts'
import {
  PATH_AddToDistance,
  PATH_GetDirection,
  PATH_GetDistance,
  PATH_GetXPosition,
  PATH_GetYPosition,
  PATH_RecacheRoomAtCoordIfNeeded,
  PATH_RecacheRoomIfNeeded,
  UNITROOM_RefreshUnit,
  sub_6FDA9720,
} from './path.ts'
import { UNIT_DISTANCE_TABLE } from './tables.ts'
import {
  type DynamicPath,
  type PathCoord,
  type PathPoint,
  type PathRoom,
  type PathUnit,
  D2AssertError,
  PATHTYPE_KNOCKBACK_CLIENT,
  PATHTYPE_KNOCKBACK_SERVER,
  PATHTYPE_MISSILE,
  PATHTYPE_MON_CIRCLE_CCW,
  PATHTYPE_MON_CIRCLE_CW,
  PATHTYPE_TOWARD,
  PATHTYPE_TOWARD_FINISH,
  PATHTYPE_WALL_FOLLOW,
  PATH_MAX_STEP_LEN,
  PATH_MISSILE_MASK,
  PATH_UNKNOWN_FLAG_0x00001,
  PATH_UNKNOWN_FLAG_0x00008,
  PATH_UNKNOWN_FLAG_0x00010,
  PATH_UNKNOWN_FLAG_0x00020,
  PATH_UNKNOWN_FLAG_0x00200,
  PATH_UNUSED_FLAG_0x00004,
  UNITFLAGEX_UNK_PATH_RELATED,
  UNITFLAG_DOUPDATE,
  UNITFLAG_ISASYNC,
  UNIT_ITEM,
  UNIT_MISSILE,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNIT_TILE,
  d2Assert,
  i32,
  u16,
  u32,
} from './types.ts'
import { UNITS_GetUnitSizeX } from './units.ts'

// Late-bound reference to D2Common_10142 (installed by path-compute.ts to avoid circular init).
type PathComputeFn = (pDynamicPath: DynamicPath | null, pUnit: PathUnit | null, bAllowInTown: number | boolean) => number
let computePathImpl: PathComputeFn | null = null

/** Internal hook used by `path-compute.ts` to wire `D2Common_10142` into `D2Common_10236`. */
export function _registerPathComputeImpl(fn: PathComputeFn): void {
  computePathImpl = fn
}

function invokeComputePath(pDynamicPath: DynamicPath | null, pUnit: PathUnit | null, bAllowInTown: number | boolean): number {
  if (!computePathImpl) {
    throw new D2AssertError('D2Common_10142 not registered before step re-path')
  }
  return computePathImpl(pDynamicPath, pUnit, bAllowInTown)
}

// ---------------------------------------------------------------------------
// Unit-size-adjusted distance (#10407 / D2Common_10399) & target-reached check
// ---------------------------------------------------------------------------

/**
 * `D2Common_10399` (#10407, 1.13c 0x6FDCFCD0; D2MOO #10399 Units.cpp / PathMisc.cpp).
 * Computes the sub-tile distance between `pUnit1` and `pUnit2` adjusted for their `SizeX`:
 * - When `|dx| < 8 && |dy| < 8 && size1 < 4 && size2 < 4`: uses {@link UNIT_DISTANCE_TABLE}
 *   (`0x6FDDABC0`), decrements by 1 if either unit has `size == 3` (clamped at 0), and adds 1 if
 *   either unit has `size <= 1`.
 * - Otherwise subtracts `(size1 >> 1) + (size2 >> 1)` from both `|dx|` and `|dy|` (clamped at 0)
 *   and returns `2 * max(dx, dy) + min(dx, dy)`.
 */
export function D2Common_10399(pUnit1: PathUnit | null, pUnit2: PathUnit | null): number {
  d2Assert(pUnit1 && pUnit2, 'D2Common_10399: pUnit1 && pUnit2')
  const x1 = getUnitSubtileX(pUnit1)
  const x2 = getUnitSubtileX(pUnit2)
  let dx = (x1 - x2) | 0
  if (dx < 0) dx = -dx | 0

  const y1 = getUnitSubtileY(pUnit1)
  const y2 = getUnitSubtileY(pUnit2)
  let dy = (y1 - y2) | 0
  if (dy < 0) dy = -dy | 0

  const size1 = UNITS_GetUnitSizeX(pUnit1) | 0
  const size2 = UNITS_GetUnitSizeX(pUnit2) | 0

  return unitSizeAdjustedDistance10407(dx, dy, size1, size2)
}

/**
 * Coordinate form of `D2Common_10399` (#10407, 1.13c 0x6FDCFCD0) for callers that hold plain
 * integer sub-tile positions instead of `PathUnit`s (e.g. the D2Client NPC click / arrival range
 * checks 0x6facb0f1 and 0x6fac9f02). `(x, y)` are the units' integer sub-tile positions (`#10407`
 * reads `pDynamicPath->wPosX/wPosY` or `pStaticPath->x/y`) and `size1` / `size2` are their
 * `UNITS_GetUnitSizeX` (0x6FD80F80) values (player = 2, monster = MonStats2 `SizeX`).
 *
 * Fails fast with a `RangeError` on non-integer coordinates or sizes that are not non-negative
 * integers, instead of guessing a distance.
 */
export function D2Common_10399_AtSubtiles(
  x1: number,
  y1: number,
  size1: number,
  x2: number,
  y2: number,
  size2: number,
): number {
  if (!Number.isInteger(x1) || !Number.isInteger(y1) || !Number.isInteger(x2) || !Number.isInteger(y2)) {
    throw new RangeError(
      `D2Common_10399_AtSubtiles: sub-tile coordinates must be integers, got (${String(x1)}, ${String(y1)}) -> (${String(x2)}, ${String(y2)})`,
    )
  }
  if (!Number.isInteger(size1) || size1 < 0 || !Number.isInteger(size2) || size2 < 0) {
    throw new RangeError(
      `D2Common_10399_AtSubtiles: unit sizes must be non-negative integers, got size1=${String(size1)}, size2=${String(size2)}`,
    )
  }
  return unitSizeAdjustedDistance10407(Math.abs(x1 - x2) | 0, Math.abs(y1 - y2) | 0, size1 | 0, size2 | 0)
}

/**
 * Shared body of #10407 after the position / size fetches (1.13c 0x6FDCFD90..0x6FDCFE36), on the
 * absolute sub-tile deltas `dx`, `dy` and the two `UNITS_GetUnitSizeX` results.
 */
function unitSizeAdjustedDistance10407(dx: number, dy: number, size1: number, size2: number): number {
  if (dx < 8 && dy < 8 && size1 < 4 && size2 < 4) {
    let val = UNIT_DISTANCE_TABLE[dx + dy * 8]!
    if (val < 0) return 0
    if (size1 === 3 || size2 === 3) {
      val = (val - 1) | 0
      if (val < 0) val = 0
    }
    if (size1 <= 1 || size2 <= 1) return (val + 1) | 0
    return val
  }

  let halfSum = ((size1 >>> 1) + (size2 >>> 1)) | 0
  if (halfSum < 0) halfSum = -halfSum | 0
  dx = (dx - halfSum) | 0
  dy = (dy - halfSum) | 0
  if (dx < 0) dx = 0
  if (dy < 0) dy = 0
  return dx > dy ? (dy + dx * 2) | 0 : (dx + dy * 2) | 0
}

function getUnitSubtileX(pUnit: PathUnit): number {
  const t = pUnit.dwUnitType
  if (t === UNIT_OBJECT || t === UNIT_ITEM || t === UNIT_TILE) {
    d2Assert(pUnit.pStaticPath, 'getUnitSubtileX: static unit without pStaticPath')
    return pUnit.pStaticPath.x | 0
  }
  return pUnit.pDynamicPath ? pUnit.pDynamicPath.wPosX : 0
}

function getUnitSubtileY(pUnit: PathUnit): number {
  const t = pUnit.dwUnitType
  if (t === UNIT_OBJECT || t === UNIT_ITEM || t === UNIT_TILE) {
    d2Assert(pUnit.pStaticPath, 'getUnitSubtileY: static unit without pStaticPath')
    return pUnit.pStaticPath.y | 0
  }
  return pUnit.pDynamicPath ? pUnit.pDynamicPath.wPosY : 0
}

/**
 * `D2Common_10227` (#10369, 1.13c 0x6FD5D3D0; D2MOO #10227 PathMisc.cpp:1269).
 * Returns TRUE when `pUnit` has no dynamic path, or when it is within `nStepNum` of its target
 * unit (`D2Common_10399 <= nStepNum`), or when its current sub-tile equals `tTargetCoord`.
 */
export function D2Common_10227(pUnit: PathUnit): boolean {
  const pDynamicPath = pUnit.pDynamicPath
  if (!pDynamicPath) return true
  if (pDynamicPath.pTargetUnit && D2Common_10399(pDynamicPath.pTargetUnit, pUnit) <= pDynamicPath.nStepNum) {
    return true
  }
  return pDynamicPath.wPosX === pDynamicPath.tTargetCoord.X && pDynamicPath.wPosY === pDynamicPath.tTargetCoord.Y
}

// ---------------------------------------------------------------------------
// PathUtil helpers (0x6FD8E080, 0x6FD8E110, 0x6FD8E310) & #10434 (0x6FD817F0)
// ---------------------------------------------------------------------------

/**
 * `PATHUtil_AdvanceTowardsTarget_6FDAB890` (1.13c 0x6FD8E080, esi=ptPath; D2MOO PathUtil.cpp:7).
 * Offsets `tTargetCoord` by `dwSpeed` along `(8 * targetDir - (dwSpeed << 5) * 8) & 0x1FF` using
 * the 512-entry trig LUT (`Fog#10083` cos / `Fog#10084` sin) and C `__ftol2` truncation toward 0.
 * Note: `dwSpeed` is only ever non-zero when `D2Common_10207` (#10219) was called.
 */
export function PATHUtil_AdvanceTowardsTarget_6FDAB890(ptPath: DynamicPath | null): void {
  d2Assert(ptPath, 'PATHUtil_AdvanceTowardsTarget_6FDAB890: ptPath (0x1EA)')
  const ptTarget = ptPath.pTargetUnit
  d2Assert(ptTarget, 'PATHUtil_AdvanceTowardsTarget_6FDAB890: ptTarget (0x1EB)')
  const nDirection = ptTarget.pDynamicPath ? PATH_GetDirection(ptTarget.pDynamicPath) : 0
  const nSpeed = ptPath.dwSpeed & 0xff
  const nAngleRad512 = ((nDirection - (nSpeed << 5)) << 3) & 0x1ff
  const rad = (nAngleRad512 * 2 * Math.PI) / 512
  const dx = Math.trunc(Math.cos(rad) * Math.fround(nSpeed)) | 0
  const dy = Math.trunc(Math.sin(rad) * Math.fround(nSpeed)) | 0
  ptPath.tTargetCoord.X = u16(ptPath.tTargetCoord.X + dx)
  ptPath.tTargetCoord.Y = u16(ptPath.tTargetCoord.Y + dy)
}

/**
 * `sub_6FDAB940` (1.13c 0x6FD8E310, edx=ptPath edi=pOutPathPoint; D2MOO PathUtil.cpp:23).
 * Writes the target unit's current sub-tile into `pOutPathPoint`. Notice in 1.13c (`c_util.txt:274-305`):
 * when `dwSpeed != 0`, 1.13c adds the trig offset into `pOutPathPoint` (`add w[edi],ax` / `add w[edi+2],ax`),
 * NOT `ptPath->tTargetCoord` (D2MOO calls `PATHUtil_AdvanceTowardsTarget_6FDAB890(ptPath)` by mistake).
 */
export function sub_6FDAB940(pOutPathPoint: PathPoint, ptPath: DynamicPath | null): void {
  d2Assert(ptPath, 'sub_6FDAB940: ptPath (0x201)')
  const pTargetUnit = ptPath.pTargetUnit
  d2Assert(pTargetUnit, 'sub_6FDAB940: ptPath->pTargetUnit (0x202)')
  pOutPathPoint.X = u16(getUnitSubtileX(pTargetUnit))
  pOutPathPoint.Y = u16(getUnitSubtileY(pTargetUnit))

  const nSpeed = ptPath.dwSpeed & 0xff
  if (nSpeed !== 0) {
    const nDirection = pTargetUnit.pDynamicPath ? PATH_GetDirection(pTargetUnit.pDynamicPath) : 0
    const nAngleRad512 = ((nDirection - (nSpeed << 5)) << 3) & 0x1ff
    const rad = (nAngleRad512 * 2 * Math.PI) / 512
    const dx = Math.trunc(Math.cos(rad) * Math.fround(nSpeed)) | 0
    const dy = Math.trunc(Math.sin(rad) * Math.fround(nSpeed)) | 0
    pOutPathPoint.X = u16(pOutPathPoint.X + dx)
    pOutPathPoint.Y = u16(pOutPathPoint.Y + dy)
  }
}

/**
 * Halves `(nX, nY)` with arithmetic shifts (`sar 1`) until both components lie in `[-0x10000, 0x10000]`
 * (1.13c 0x6FD8E110, eax=&x ecx=&y; D2MOO `sub_6FDAC700` Step.cpp:260).
 */
export function halveUntilSubtileStep(vec: PathCoord): void {
  if (vec.nX >= 0) {
    while (vec.nX > 0x10000) {
      vec.nX >>= 1
      vec.nY >>= 1
    }
  } else {
    while (vec.nX < -0x10000) {
      vec.nX >>= 1
      vec.nY >>= 1
    }
  }
  if (vec.nY >= 0) {
    while (vec.nY > 0x10000) {
      vec.nX >>= 1
      vec.nY >>= 1
    }
  } else {
    while (vec.nY < -0x10000) {
      vec.nX >>= 1
      vec.nY >>= 1
    }
  }
}

/**
 * `UNITS_SetTargetUnitForDynamicUnit` / face sub-tile (#10434, 1.13c 0x6FD817F0, stdcall `(pUnit, nX, nY)`).
 * Turns `pUnit->pDynamicPath` toward the sub-tile centre `(nX, nY)` via `PATH_GetDirectionVector` +
 * `sub_6FDA9720` (gradual turn for players/monsters). Does nothing when `pUnit->pDynamicPath` is NULL.
 */
export function D2Common_10434_FaceSubtile(pUnit: PathUnit, nX: number, nY: number): void {
  const pPath = pUnit.pDynamicPath
  if (!pPath) return
  const dir = PATH_GetDirectionVector(pPath.dwPrecisionX, pPath.dwPrecisionY, subtileCenter(nX), subtileCenter(nY)).direction
  sub_6FDA9720(pPath, dir & 0xff)
}

// ---------------------------------------------------------------------------
// Velocity and direction vectors
// ---------------------------------------------------------------------------

/**
 * `PATH_ComputeVelocityAndDirectionVectorsToNextPoint` (1.13c 0x6FD5D240, esi=pPath + stdcall
 * `(bNormalizeDirectionIfSamePos, bForceDirectionNormalization)`; D2MOO PathMisc.cpp:1014).
 *
 * Advances `dwCurrentPointIdx` past any points whose sub-tile centre equals the current precise
 * position. If all points are exhausted, zeroes `tDirectionVector`, `tVelocityVector`, `dwVelocity`,
 * sets `dwCurrentPointIdx = dwPathPoints`, and returns 1. Otherwise computes the direction vector to
 * the next point, flips direction by 32 if `PATH_UNKNOWN_FLAG_0x00200` is set, sets
 * `tVelocityVector = (tDirectionVector * dwVelocity) >> 8`, and updates direction via `sub_6FDA9720`
 * when `bForceDirectionNormalization` or (`nextPosInSamePoint && bNormalizeDirectionIfSamePos`).
 */
export function PATH_ComputeVelocityAndDirectionVectorsToNextPoint(
  pPath: DynamicPath,
  bNormalizeDirectionIfSamePos: boolean | number,
  bForceDirectionNormalization: boolean | number,
): number {
  const dwPrecisionX = pPath.dwPrecisionX
  const dwPrecisionY = pPath.dwPrecisionY
  const curPt = pPath.PathPoints[pPath.dwCurrentPointIdx]!
  let nPointFP16X = subtileCenter(curPt.X)
  let nPointFP16Y = subtileCenter(curPt.Y)

  while (nPointFP16X === dwPrecisionX && nPointFP16Y === dwPrecisionY) {
    const idx = pPath.dwCurrentPointIdx
    pPath.dwCurrentPointIdx = (idx + 1) | 0
    if (idx >= pPath.dwPathPoints - 1) {
      pPath.tDirectionVector.nX = 0
      pPath.tDirectionVector.nY = 0
      pPath.tVelocityVector.nX = 0
      pPath.tVelocityVector.nY = 0
      pPath.dwCurrentPointIdx = pPath.dwPathPoints
      pPath.dwVelocity = 0
      return 1
    }
    const nextPt = pPath.PathPoints[pPath.dwCurrentPointIdx]!
    nPointFP16X = subtileCenter(nextPt.X)
    nPointFP16Y = subtileCenter(nextPt.Y)
  }

  const res = PATH_GetDirectionVector(dwPrecisionX, dwPrecisionY, nPointFP16X, nPointFP16Y)
  let nDirection = res.direction & 0xff
  if (pPath.dwFlags & PATH_UNKNOWN_FLAG_0x00200) {
    nDirection = PATH_NormalizeDirection(nDirection - 32)
  }

  pPath.tDirectionVector.nX = res.vector.nX
  pPath.tDirectionVector.nY = res.vector.nY
  pPath.tVelocityVector.nX = Math.imul(res.vector.nX, pPath.dwVelocity) >> 8
  pPath.tVelocityVector.nY = Math.imul(res.vector.nY, pPath.dwVelocity) >> 8

  const nextSubX = u32(dwPrecisionX + pPath.tVelocityVector.nX) >>> 16
  const nextSubY = u32(dwPrecisionY + pPath.tVelocityVector.nY) >>> 16
  const nextPosInSamePoint = nextSubX === nPointFP16X >>> 16 && nextSubY === nPointFP16Y >>> 16

  if (bForceDirectionNormalization || (nextPosInSamePoint && bNormalizeDirectionIfSamePos)) {
    sub_6FDA9720(pPath, nDirection)
  }
  return 1
}

/**
 * `sub_6FD5CEB0` (1.13c 0x6FD5CEB0, eax=nBaseVelocity ecx=pDynamicPath; D2MOO PathMisc.cpp:1121).
 * Substitutes 1024 when `nBaseVelocity <= 0`, ticks `dwAcceleration` every 5 calls (clamping
 * `dwVelocity` to `[0, dwMaxVelocity]`), and computes:
 * - `nVelocityMagnitude = (nBaseVelocity * dwVelocity) >> 6`
 * - `tVelocityVector = (tDirectionVector * nVelocityMagnitude) >> 12`
 */
export function sub_6FD5CEB0(pDynamicPath: DynamicPath, nBaseVelocity: number): void {
  const base = (nBaseVelocity | 0) > 0 ? nBaseVelocity | 0 : 1024
  const nAcc = pDynamicPath.dwAcceleration | 0
  if (nAcc !== 0) {
    pDynamicPath.dwAccelerationsCounter = (pDynamicPath.dwAccelerationsCounter + 1) | 0
    if (pDynamicPath.dwAccelerationsCounter >= 5) {
      const nMaxVel = pDynamicPath.dwMaxVelocity | 0
      const newVel = (pDynamicPath.dwVelocity + nAcc) | 0
      pDynamicPath.dwVelocity = newVel
      if (newVel > nMaxVel) {
        pDynamicPath.dwVelocity = nMaxVel
        pDynamicPath.dwAcceleration = 0
      } else if (newVel < 0) {
        pDynamicPath.dwVelocity = 0
      }
      pDynamicPath.dwAccelerationsCounter = 0
    }
  }
  const nVelocityMagnitude = Math.imul(pDynamicPath.dwVelocity, base) >> 6
  pDynamicPath.tVelocityVector.nX = Math.imul(pDynamicPath.tDirectionVector.nX, nVelocityMagnitude) >> 12
  pDynamicPath.tVelocityVector.nY = Math.imul(pDynamicPath.tDirectionVector.nY, nVelocityMagnitude) >> 12
}

/**
 * `sub_6FD5D0A0` (1.13c 0x6FD5D0A0, eax=pPath ecx=pOutMoveVec; D2MOO `sub_6FDAC7E0` Step.cpp:209).
 * Copies `tVelocityVector` into `pOutMoveVec`. For non-MISSILE paths, if the distance to the
 * current waypoint's sub-tile centre is `<= max(|velX|, |velY|)` on both axes, clamps `pOutMoveVec`
 * to reach the waypoint centre exactly and returns 1 (waypoint reached); otherwise returns 0.
 */
export function sub_6FD5D0A0(pDynamicPath: DynamicPath, pOutMoveVec: PathCoord): number {
  const vx = pDynamicPath.tVelocityVector.nX | 0
  const vy = pDynamicPath.tVelocityVector.nY | 0
  pOutMoveVec.nX = vx
  pOutMoveVec.nY = vy
  if (pDynamicPath.dwPathType === PATHTYPE_MISSILE) return 0

  const pt = pDynamicPath.PathPoints[pDynamicPath.dwCurrentPointIdx]!
  const dx = (subtileCenter(pt.X) - pDynamicPath.dwPrecisionX) | 0
  const dy = (subtileCenter(pt.Y) - pDynamicPath.dwPrecisionY) | 0
  const absDx = dx < 0 ? -dx | 0 : dx
  const absDy = dy < 0 ? -dy | 0 : dy
  const absVx = vx < 0 ? -vx | 0 : vx
  const absVy = vy < 0 ? -vy | 0 : vy
  const maxVel = absVx <= absVy ? absVy : absVx

  if (absDx <= maxVel && absDy <= maxVel) {
    pOutMoveVec.nX = dx
    pOutMoveVec.nY = dy
    return 1
  }
  return 0
}

// ---------------------------------------------------------------------------
// Step collision & sub-tile stepping
// ---------------------------------------------------------------------------

/**
 * `sub_6FD5D420` (1.13c 0x6FD5D420, eax=pPath + stdcall `(tPrev, tNext)`; D2MOO `sub_6FDAC8F0` Step.cpp:300).
 * Tests moving the unit's collision footprint from sub-tile `tPrev` to `tNext`:
 * - When `PATH_UNUSED_FLAG_0x00004` (`0x4`) is set: asserts player or monster (line 0x2AF),
 *   unconditionally resets the footprint at `tPrev` and stamps it at `tNext` when `pRoom != NULL`,
 *   and returns 1.
 * - Otherwise, upgrades `nMoveTestCollisionMask == 0x3401` (monster that can open doors) to `0x3C01`
 *   so stepping stops at closed doors, calls `COLLISION_TryMoveUnitCollisionMask` (missiles) or
 *   `COLLISION_TryTeleportUnitCollisionMask` (units), ORs the result into `nCollidedWithMask`, and
 *   returns 1 on success (`(nCollidedWithMask & 5) == 0` for missiles, `nCollidedWithMask == 0` for units).
 */
export function sub_6FD5D420(pDynamicPath: DynamicPath, tPrev: PathPoint, tNext: PathPoint): number {
  if (pDynamicPath.dwFlags & PATH_UNUSED_FLAG_0x00004) {
    const pUnit = pDynamicPath.pUnit
    d2Assert(
      pUnit && (pUnit.dwUnitType === UNIT_PLAYER || pUnit.dwUnitType === UNIT_MONSTER),
      'sub_6FD5D420: pUnit && (PLAYER || MONSTER) (0x2AF)',
    )
    if (pDynamicPath.pRoom) {
      COLLISION_ResetMaskWithPattern(
        pDynamicPath.pRoom,
        tPrev.X,
        tPrev.Y,
        pDynamicPath.dwCollisionPattern | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
      COLLISION_SetMaskWithPattern(
        pDynamicPath.pRoom,
        tNext.X,
        tNext.Y,
        pDynamicPath.dwCollisionPattern | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
    }
    return 1
  }

  const bMissile = (pDynamicPath.dwFlags & PATH_MISSILE_MASK) !== 0
  let nMoveMask = pDynamicPath.nMoveTestCollisionMask
  if (nMoveMask === 0x3401) nMoveMask = 0x3c01

  let coll: number
  if (bMissile) {
    coll = COLLISION_TryMoveUnitCollisionMask(
      pDynamicPath.pRoom,
      tPrev.X,
      tPrev.Y,
      tNext.X,
      tNext.Y,
      pDynamicPath.dwUnitSize | 0,
      pDynamicPath.nFootprintCollisionMask,
      nMoveMask,
    )
  } else {
    coll = COLLISION_TryTeleportUnitCollisionMask(
      pDynamicPath.pRoom,
      tPrev.X,
      tPrev.Y,
      tNext.X,
      tNext.Y,
      pDynamicPath.dwCollisionPattern | 0,
      pDynamicPath.nFootprintCollisionMask,
      nMoveMask,
    )
  }
  pDynamicPath.nCollidedWithMask = u16(pDynamicPath.nCollidedWithMask | coll)
  if (bMissile) {
    return (pDynamicPath.nCollidedWithMask & (COLLIDE_WALL | COLLIDE_MISSILE_BARRIER)) === 0 ? 1 : 0
  }
  return pDynamicPath.nCollidedWithMask === 0 ? 1 : 0
}

/**
 * `sub_6FD5D580` (1.13c 0x6FD5D580, edi=pPath + stdcall `(tMoveVecX, tMoveVecY, pOutPrec, pOutSteps)`;
 * D2MOO `sub_6FDAC9A0` Step.cpp:355).
 * Steps from `(dwPrecisionX, dwPrecisionY)` by `(tMoveVec.nX, tMoveVec.nY)` (halved until each axis
 * is at most 1 sub-tile per sub-step), checking collision via {@link sub_6FD5D420} whenever the
 * sub-tile changes and recording each entered sub-tile in `SavedSteps` (up to 10).
 * - On collision failure: snaps `pOutPrec` to the sub-tile centre of the last valid sub-tile and
 *   returns 1 (blocked).
 * - On success: sets `PATH_UNKNOWN_FLAG_0x00008` when `nSavedStepsCount > 0`, writes the exact target
 *   precise coordinates into `pOutPrec`, and returns 0.
 */
export function sub_6FD5D580(
  pDynamicPath: DynamicPath,
  tMoveVec: PathCoord,
  pOutPrec: { dwPrecisionX: number; dwPrecisionY: number },
): { readonly blocked: number; readonly savedSteps: number } {
  let curPrecX = pDynamicPath.dwPrecisionX
  let curPrecY = pDynamicPath.dwPrecisionY
  const targetPrecX = u32(curPrecX + tMoveVec.nX)
  const targetPrecY = u32(curPrecY + tMoveVec.nY)
  const targetSubX = targetPrecX >>> 16
  const targetSubY = targetPrecY >>> 16

  const stepVec: PathCoord = { nX: tMoveVec.nX | 0, nY: tMoveVec.nY | 0 }
  halveUntilSubtileStep(stepVec)

  let nSteps = 0
  pDynamicPath.nSavedStepsCount = 0

  while (curPrecX >>> 16 !== targetSubX || curPrecY >>> 16 !== targetSubY) {
    const nextPrecX = u32(curPrecX + stepVec.nX)
    const nextPrecY = u32(curPrecY + stepVec.nY)
    const prevPt: PathPoint = { X: curPrecX >>> 16, Y: curPrecY >>> 16 }
    const nextPt: PathPoint = { X: nextPrecX >>> 16, Y: nextPrecY >>> 16 }

    if (prevPt.X !== nextPt.X || prevPt.Y !== nextPt.Y) {
      if (!sub_6FD5D420(pDynamicPath, prevPt, nextPt)) {
        pOutPrec.dwPrecisionX = u32((curPrecX & 0xffff0000) + 0x8000)
        pOutPrec.dwPrecisionY = u32((curPrecY & 0xffff0000) + 0x8000)
        return { blocked: 1, savedSteps: nSteps }
      }
      pDynamicPath.SavedSteps[nSteps]!.X = nextPt.X
      pDynamicPath.SavedSteps[nSteps]!.Y = nextPt.Y
      nSteps = (nSteps + 1) | 0
      pDynamicPath.nSavedStepsCount = nSteps
    }
    curPrecX = nextPrecX
    curPrecY = nextPrecY
    if (nSteps >= PATH_MAX_STEP_LEN) break
  }

  if (nSteps > 0) {
    pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags | PATH_UNKNOWN_FLAG_0x00008)
  }
  pOutPrec.dwPrecisionX = targetPrecX
  pOutPrec.dwPrecisionY = targetPrecY
  return { blocked: 0, savedSteps: nSteps }
}

// ---------------------------------------------------------------------------
// Re-path (#10831 / D2Common_10236) & re-target (0x6FD5DB70)
// ---------------------------------------------------------------------------

/**
 * `D2Common_10236` (#10831, 1.13c 0x6FD5D820; D2MOO #10236 PathMisc.cpp:1069).
 * Re-computes `pUnit`'s path when blocked or when its target moves:
 * - Server units (`!(dwFlags & 0x10)`): if monster and `nDistance == 0`, returns 0; else refreshes
 *   the unit in its room, sets `UNITFLAG_DOUPDATE`, and subtracts `dwCurrentPointIdx` from `nDistance`.
 * - For `PATHTYPE_TOWARD` (2), `PATHTYPE_TOWARD_FINISH` (13), or `PATHTYPE_WALL_FOLLOW` (15):
 *   switches to `TOWARD_FINISH` (when `bHasTarget != 0`) or `TOWARD` toward `tFinalTargetCoord`,
 *   runs `D2Common_10142`, and if that returns 0 falls back to `PATHTYPE_WALL_FOLLOW` (15) and
 *   runs `D2Common_10142` again.
 * - For all other path types: runs `D2Common_10142(pDynamicPath, pUnit, 0)`.
 */
export function D2Common_10236(pUnit: PathUnit | null, bHasTarget: number | boolean): number {
  if (!pUnit) return 0
  const pDynamicPath = pUnit.pDynamicPath
  if (!pDynamicPath) return 0

  if (!(pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00010)) {
    if (pUnit.dwUnitType === UNIT_MONSTER && PATH_GetDistance(pDynamicPath) === 0) {
      return 0
    }
    UNITROOM_RefreshUnit(pUnit)
    pUnit.dwFlags = u32(pUnit.dwFlags | UNITFLAG_DOUPDATE)
    PATH_AddToDistance(pDynamicPath, -pDynamicPath.dwCurrentPointIdx)
  }

  const pt = pDynamicPath.dwPathType
  if (pt !== PATHTYPE_TOWARD && pt !== PATHTYPE_TOWARD_FINISH && pt !== PATHTYPE_WALL_FOLLOW) {
    return invokeComputePath(pDynamicPath, pUnit, 0)
  }

  if (bHasTarget) {
    pDynamicPath.dwPathType = PATHTYPE_TOWARD_FINISH
  } else {
    pDynamicPath.dwPathType = PATHTYPE_TOWARD
    pDynamicPath.tTargetCoord.X = pDynamicPath.tFinalTargetCoord.X
    pDynamicPath.tTargetCoord.Y = pDynamicPath.tFinalTargetCoord.Y
  }

  let nResult = invokeComputePath(pDynamicPath, pUnit, 0)
  if (!nResult) {
    pDynamicPath.dwPathType = PATHTYPE_WALL_FOLLOW
    nResult = invokeComputePath(pDynamicPath, pUnit, 0)
  }
  return nResult
}

/**
 * `sub_6FD5DB70` (1.13c 0x6FD5DB70, esi=pDynamicPath; D2MOO PathMisc.cpp:1157).
 * Pre-step target check called by {@link D2Common_10226}:
 * - Circle paths (`MON_CIRCLE_CW` 5 / `MON_CIRCLE_CCW` 6) that have reached `dwPathPoints` return 1.
 * - Without a `pTargetUnit`: if `dwCurrentPointIdx >= dwPathPoints` and current sub-tile !=
 *   `tFinalTargetCoord`, re-paths via `D2Common_10236(pUnit, 0)`; else returns 1.
 * - With a `pTargetUnit`:
 *   - If `D2Common_10399(pTargetUnit, pUnit) <= nStepNum`, returns 0 (stops movement!).
 *   - Queries the target's current sub-tile via `sub_6FDAB940`. For player/monster targets, if
 *     `|tPrevTargetCoord.X - target.X| <= 5 && |tPrevTargetCoord.Y - target.Y| <= 5`, keeps the
 *     current path when `dwCurrentPointIdx < dwPathPoints` or the unit is already at
 *     `tFinalTargetCoord`; otherwise re-paths via `D2Common_10236(pUnit, 1)`.
 *   - For non-player/monster targets: keeps the current path when `dwCurrentPointIdx < dwPathPoints`
 *     or at `tFinalTargetCoord`, else re-paths via `D2Common_10236(pUnit, 1)`.
 */
export function sub_6FD5DB70(pDynamicPath: DynamicPath): number {
  const pt = pDynamicPath.dwPathType
  if ((pt === PATHTYPE_MON_CIRCLE_CW || pt === PATHTYPE_MON_CIRCLE_CCW) && pDynamicPath.dwCurrentPointIdx >= pDynamicPath.dwPathPoints) {
    return 1
  }

  const pTargetUnit = pDynamicPath.pTargetUnit
  const pUnit = pDynamicPath.pUnit
  if (!pTargetUnit) {
    if (
      pDynamicPath.dwCurrentPointIdx >= pDynamicPath.dwPathPoints &&
      (pDynamicPath.wPosX !== pDynamicPath.tFinalTargetCoord.X || pDynamicPath.wPosY !== pDynamicPath.tFinalTargetCoord.Y)
    ) {
      return D2Common_10236(pUnit, 0)
    }
    return 1
  }

  if (D2Common_10399(pTargetUnit, pUnit) <= pDynamicPath.nStepNum) {
    return 0
  }

  const curPosX = pDynamicPath.wPosX
  const curPosY = pDynamicPath.wPosY
  const targetPos: PathPoint = { X: 0, Y: 0 }
  sub_6FDAB940(targetPos, pDynamicPath)

  const targetNow = pDynamicPath.pTargetUnit
  if (targetNow && (targetNow.dwUnitType === UNIT_PLAYER || targetNow.dwUnitType === UNIT_MONSTER)) {
    let diffX = (pDynamicPath.tPrevTargetCoord.X - targetPos.X) | 0
    let diffY = (pDynamicPath.tPrevTargetCoord.Y - targetPos.Y) | 0
    if (diffX < 0) diffX = -diffX | 0
    if (diffY < 0) diffY = -diffY | 0
    if (diffX > 5 || diffY > 5) {
      return D2Common_10236(pUnit, 1)
    }
  }

  if (
    pDynamicPath.dwCurrentPointIdx < pDynamicPath.dwPathPoints ||
    (pDynamicPath.tFinalTargetCoord.X === curPosX && pDynamicPath.tFinalTargetCoord.Y === curPosY)
  ) {
    return 1
  }
  return D2Common_10236(pUnit, 1)
}

/**
 * `sub_6FDACEC0` (1.13c 0x6FD5D8E0, esi=pPath + stdcall `(pOutPrec, pOutSavedSteps)`;
 * D2MOO Step.cpp:416).
 * Computes one tick's movement and runs sub-tile collision stepping when crossing a sub-tile boundary:
 * - If `tVelocityVector` is `{0, 0}`: zeroes `dwPathPoints` and `dwCurrentPointIdx`, snaps `pOutPrec`
 *   to the current sub-tile centre, and returns 0.
 * - Calls {@link sub_6FD5D0A0} for the tick displacement `moveVec` and `bReachedPoint`.
 * - If `(dwPrecision + moveVec)` enters a different sub-tile:
 *   - Decrements `nDist` (when `nDist != 0` and path type is neither `KNOCKBACK_SERVER` 8 nor
 *     `KNOCKBACK_CLIENT` 11).
 *   - Calls {@link sub_6FD5D580}; if blocked:
 *     - When the unit is a client monster (`dwUnitType == UNIT_MONSTER && (dwFlags & 0x10)`),
 *       attempts a re-path via `D2Common_10236(pUnit, pTargetUnit != NULL)` and returns `1` if that
 *       succeeded or `0` if it failed.
 *     - Otherwise sets `dwCurrentPointIdx = dwPathPoints` and returns 0.
 * - Otherwise writes `dwPrecision + moveVec` into `pOutPrec`.
 * - If `bReachedPoint != 0`, increments `dwCurrentPointIdx` and returns 1; else returns 0.
 */
export function sub_6FDACEC0(
  pDynamicPath: DynamicPath,
  pOutPrec: { dwPrecisionX: number; dwPrecisionY: number },
): { readonly reachedWaypoint: number; readonly savedSteps: number } {
  pDynamicPath.nCollidedWithMask = 0
  const pUnit = pDynamicPath.pUnit
  const bClientMonster =
    pUnit !== null && pUnit.dwUnitType === UNIT_MONSTER && (pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00010) !== 0

  if (pDynamicPath.tVelocityVector.nX === 0 && pDynamicPath.tVelocityVector.nY === 0) {
    pOutPrec.dwPrecisionX = u32((pDynamicPath.dwPrecisionX & 0xffff0000) + 0x8000)
    pOutPrec.dwPrecisionY = u32((pDynamicPath.dwPrecisionY & 0xffff0000) + 0x8000)
    pDynamicPath.dwPathPoints = 0
    pDynamicPath.dwCurrentPointIdx = 0
    return { reachedWaypoint: 0, savedSteps: 0 }
  }

  const moveVec: PathCoord = { nX: 0, nY: 0 }
  const bReachedPoint = sub_6FD5D0A0(pDynamicPath, moveVec)
  const nextPrecX = u32(pDynamicPath.dwPrecisionX + moveVec.nX)
  const nextPrecY = u32(pDynamicPath.dwPrecisionY + moveVec.nY)

  let savedSteps = 0
  if (nextPrecX >>> 16 !== pDynamicPath.wPosX || nextPrecY >>> 16 !== pDynamicPath.wPosY) {
    if (
      pDynamicPath.nDist !== 0 &&
      pDynamicPath.dwPathType !== PATHTYPE_KNOCKBACK_SERVER &&
      pDynamicPath.dwPathType !== PATHTYPE_KNOCKBACK_CLIENT
    ) {
      pDynamicPath.nDist = (pDynamicPath.nDist - 1) & 0xff
    }
    const stepRes = sub_6FD5D580(pDynamicPath, moveVec, pOutPrec)
    savedSteps = stepRes.savedSteps
    if (stepRes.blocked) {
      if (bClientMonster) {
        const repathed = D2Common_10236(pUnit, pDynamicPath.pTargetUnit !== null)
        return { reachedWaypoint: repathed !== 0 ? 1 : 0, savedSteps }
      }
      pDynamicPath.dwCurrentPointIdx = pDynamicPath.dwPathPoints
      return { reachedWaypoint: 0, savedSteps }
    }
  } else {
    pOutPrec.dwPrecisionX = nextPrecX
    pOutPrec.dwPrecisionY = nextPrecY
  }

  if (bReachedPoint) {
    pDynamicPath.dwCurrentPointIdx = (pDynamicPath.dwCurrentPointIdx + 1) | 0
    return { reachedWaypoint: 1, savedSteps }
  }
  return { reachedWaypoint: 0, savedSteps }
}

// ---------------------------------------------------------------------------
// Stop / Reset movement & per-tick step (#10342 / D2Common_10226)
// ---------------------------------------------------------------------------

/**
 * `PATH_StopMovement` (1.13c 0x6FD5DC80, eax=pDynamicPath; D2MOO `PATH_StopMovement` Step.cpp:696 /
 * `PATH_ResetMovement` Step.cpp:786). Snaps the precise position to the current sub-tile centre,
 * recaches the room if needed, clears `PATH_UNKNOWN_FLAG_0x00020`, `dwPathPoints`,
 * `dwCurrentPointIdx`, and `tVelocityVector`.
 */
export function PATH_StopMovement(pDynamicPath: DynamicPath): void {
  PATH_RecacheRoomIfNeeded(pDynamicPath)
  pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00020)
  pDynamicPath.dwPathPoints = 0
  pDynamicPath.dwCurrentPointIdx = 0
  pDynamicPath.tVelocityVector.nX = 0
  pDynamicPath.tVelocityVector.nY = 0
}

/**
 * `sub_6FD5D050` (1.13c 0x6FD5D050, ecx=pUnit edx=pDynamicPath; inlined at 0x6FD5E277 in `D2Common_10226`
 * where its result is stored to a dead stack slot before `sub_6FDACEC0` overwrites it).
 * Returns 0 for a server player (`!(dwFlags & 0x10)`) or a client monster without `UNITFLAG_ISASYNC`;
 * returns 1 otherwise.
 */
export function sub_6FD5D050(pUnit: PathUnit | null, pDynamicPath: DynamicPath): number {
  const nType = pUnit ? pUnit.dwUnitType : 6
  if (nType === UNIT_PLAYER) {
    return pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00010 ? 1 : 0
  }
  if (nType === UNIT_MONSTER && pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00010) {
    if (!pUnit || (pUnit.dwFlags & UNITFLAG_ISASYNC) === 0) return 0
  }
  return 1
}

/**
 * `D2Common_10226` (#10342, 1.13c 0x6FD5E230; D2MOO #10226 PathMisc.cpp:1205).
 * Advances `pUnit`'s dynamic path by one 25 Hz game tick:
 * 1. Clears `PATH_UNKNOWN_FLAG_0x00008` (and `nCollidedWithMask` for missiles).
 * 2. Requires `(dwFlags & 0x20) != 0 && dwPathPoints > 0 && dwVelocity != 0`.
 * 3. Runs `sub_6FD5DB70` (for non-missiles) and verifies `dwCurrentPointIdx < dwPathPoints`.
 * 4. Computes `tVelocityVector` via `sub_6FD5CEB0(pDynamicPath, nBaseVelocity)`.
 * 5. Steps via `sub_6FDACEC0`, updates coords/room via `PATH_RecacheRoomAtCoordIfNeeded`, and (for
 *    non-PATHTYPE_MISSILE when `dwCurrentPointIdx < dwPathPoints`) updates the next waypoint
 *    direction/velocity via `PATH_ComputeVelocityAndDirectionVectorsToNextPoint(pDynamicPath, 1, 1)`.
 * 6. Returns `1` (TRUE) if `dwCurrentPointIdx < dwPathPoints`, else calls `PATH_StopMovement` and
 *    returns `0` (FALSE).
 */
export function D2Common_10226(pUnit: PathUnit, nBaseVelocity = 0): number {
  const pDynamicPath = pUnit.pDynamicPath
  if (!pDynamicPath) return 0

  pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00008)
  if (pDynamicPath.dwFlags & PATH_MISSILE_MASK) {
    pDynamicPath.nCollidedWithMask = 0
  }

  if (
    (pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00020) !== 0 &&
    pDynamicPath.dwPathPoints > 0 &&
    pDynamicPath.dwVelocity !== 0
  ) {
    // 0x6FD5E277..0x6FD5E2B8: inlined sub_6FD5D050 whose result is stored into [esp+0x10] (never branched on).
    sub_6FD5D050(pUnit, pDynamicPath)

    if (
      ((pDynamicPath.dwFlags & PATH_MISSILE_MASK) !== 0 || sub_6FD5DB70(pDynamicPath) !== 0) &&
      pDynamicPath.dwCurrentPointIdx < pDynamicPath.dwPathPoints
    ) {
      sub_6FD5CEB0(pDynamicPath, nBaseVelocity)
      if (pDynamicPath.tVelocityVector.nX !== 0 || pDynamicPath.tVelocityVector.nY !== 0) {
        const tCoord = { dwPrecisionX: 0, dwPrecisionY: 0 }
        sub_6FDACEC0(pDynamicPath, tCoord)
        PATH_RecacheRoomAtCoordIfNeeded(pDynamicPath, tCoord.dwPrecisionX, tCoord.dwPrecisionY, null)
        if (
          pDynamicPath.dwPathType !== PATHTYPE_MISSILE &&
          pDynamicPath.dwCurrentPointIdx < pDynamicPath.dwPathPoints
        ) {
          PATH_ComputeVelocityAndDirectionVectorsToNextPoint(pDynamicPath, 1, 1)
        }
        if (pDynamicPath.dwCurrentPointIdx < pDynamicPath.dwPathPoints) {
          return 1
        }
      }
    }
  }

  PATH_StopMovement(pDynamicPath)
  return 0
}

// ---------------------------------------------------------------------------
// Teleports & Snaps (#10533 / #10906 / #10075 / #10223)
// ---------------------------------------------------------------------------

/**
 * `sub_6FDAD5E0` (1.13c 0x6FD5DF30, eax=pDynamicPath + stdcall `(pRoomDest, tDest)`).
 * Teleports `pDynamicPath` to `tDest` in `pRoomDest`, updating its footprint and recording
 * `nCollidedWithMask` / `SavedSteps[0]` when `pUnit` is a missile (for non-missiles, resets the old
 * pattern footprint and sets the new one without checking `nMoveTestCollisionMask`). Asserts that
 * `tDest == {0,0}` or `DUNGEON_GetRoomAtPosition(pRoomDest, tDest.X, tDest.Y) != NULL` (line 0x489),
 * then calls {@link PATH_StopMovement} and returns 1.
 */
export function sub_6FDAD5E0(pDynamicPath: DynamicPath, pRoomDest: PathRoom | null, tDest: PathPoint): number {
  const destX = tDest.X & 0xffff
  const destY = tDest.Y & 0xffff
  const curX = pDynamicPath.wPosX
  const curY = pDynamicPath.wPosY
  const pUnit = pDynamicPath.pUnit

  if (pUnit && pUnit.dwUnitType === UNIT_MISSILE) {
    if (destX === 0 && destY === 0) {
      COLLISION_ResetMaskWithSize(
        pDynamicPath.pRoom,
        curX,
        curY,
        pDynamicPath.dwUnitSize | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
      pDynamicPath.nCollidedWithMask = 0
    } else {
      if (curX === destX && curY === destY) {
        pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00008)
      } else {
        pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags | PATH_UNKNOWN_FLAG_0x00008)
      }
      if (pDynamicPath.pRoom) {
        COLLISION_ResetMaskWithSize(
          pDynamicPath.pRoom,
          curX,
          curY,
          pDynamicPath.dwUnitSize | 0,
          pDynamicPath.nFootprintCollisionMask,
        )
      }
      const coll = COLLISION_CheckMaskWithSize(
        pRoomDest,
        destX,
        destY,
        pDynamicPath.dwUnitSize | 0,
        pDynamicPath.nMoveTestCollisionMask,
      )
      COLLISION_SetMaskWithSize(
        pRoomDest,
        destX,
        destY,
        pDynamicPath.dwUnitSize | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
      pDynamicPath.nCollidedWithMask = u16(coll)
      pDynamicPath.nSavedStepsCount = 1
      pDynamicPath.SavedSteps[0]!.X = destX
      pDynamicPath.SavedSteps[0]!.Y = destY
    }
  } else {
    if (destX === 0 && destY === 0) {
      COLLISION_ResetMaskWithPattern(
        pDynamicPath.pRoom,
        curX,
        curY,
        pDynamicPath.dwCollisionPattern | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
    } else if (pDynamicPath.pRoom) {
      COLLISION_ResetMaskWithPattern(
        pDynamicPath.pRoom,
        curX,
        curY,
        pDynamicPath.dwCollisionPattern | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
      COLLISION_SetMaskWithPattern(
        pRoomDest,
        destX,
        destY,
        pDynamicPath.dwCollisionPattern | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
    }
  }

  if (pDynamicPath.pRoom !== pRoomDest) {
    pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags | PATH_UNKNOWN_FLAG_0x00001)
  }
  PATH_RecacheRoomAtCoordIfNeeded(pDynamicPath, subtileCenter(destX), subtileCenter(destY), pRoomDest)
  d2Assert(
    (destX === 0 && destY === 0) || DUNGEON_GetRoomAtPosition(pRoomDest, destX, destY) !== null,
    'sub_6FDAD5E0: destination in room (0x489)',
  )
  PATH_StopMovement(pDynamicPath)
  return 1
}

/**
 * `D2Common_10231_Impl` (1.13c 0x6FD5DDC0, eax=pDynamicPath + stdcall `(pRoomDest, tDest)`;
 * D2MOO Step.cpp:709). Moves the footprint from `(wPosX, wPosY)` in `pRoom` to `tDest` in `pRoomDest`
 * unconditionally, updates the precise coordinates to the sub-tile centre of `tDest`, asserts the
 * destination room (line 0x4CC), calls {@link PATH_StopMovement}, and returns 1.
 */
export function D2Common_10231_Impl(pDynamicPath: DynamicPath, pRoomDest: PathRoom | null, tDest: PathPoint): number {
  const destX = tDest.X & 0xffff
  const destY = tDest.Y & 0xffff
  const curX = pDynamicPath.wPosX
  const curY = pDynamicPath.wPosY
  const pUnit = pDynamicPath.pUnit

  if (pUnit && pUnit.dwUnitType === UNIT_MISSILE) {
    if (destX === 0 && destY === 0) {
      COLLISION_ResetMaskWithSize(
        pDynamicPath.pRoom,
        curX,
        curY,
        pDynamicPath.dwUnitSize | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
    } else {
      if (pDynamicPath.pRoom) {
        COLLISION_ResetMaskWithSize(
          pDynamicPath.pRoom,
          curX,
          curY,
          pDynamicPath.dwUnitSize | 0,
          pDynamicPath.nFootprintCollisionMask,
        )
      }
      COLLISION_SetMaskWithSize(
        pRoomDest,
        destX,
        destY,
        pDynamicPath.dwUnitSize | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
    }
  } else {
    if (destX === 0 && destY === 0) {
      COLLISION_ResetMaskWithPattern(
        pDynamicPath.pRoom,
        curX,
        curY,
        pDynamicPath.dwCollisionPattern | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
    } else {
      COLLISION_SetUnitCollisionMask(
        pDynamicPath.pRoom,
        curX,
        curY,
        pRoomDest,
        destX,
        destY,
        pDynamicPath.dwCollisionPattern | 0,
        pDynamicPath.nFootprintCollisionMask,
      )
    }
  }

  if (pDynamicPath.pRoom !== pRoomDest) {
    pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags | PATH_UNKNOWN_FLAG_0x00001)
  }
  PATH_RecacheRoomAtCoordIfNeeded(pDynamicPath, subtileCenter(destX), subtileCenter(destY), pRoomDest)
  d2Assert(
    (destX === 0 && destY === 0) || DUNGEON_GetRoomAtPosition(pRoomDest, destX, destY) !== null,
    'D2Common_10231_Impl: destination in room (0x4CC)',
  )
  PATH_StopMovement(pDynamicPath)
  return 1
}

/**
 * `D2Common_10229` (#10533, 1.13c 0x6FD5E1E0; D2MOO #10229 PathMisc.cpp:1291).
 * Teleports `pDynamicPath` to `(nDestX, nDestY)` in `pDestRoom` via {@link sub_6FDAD5E0} and clears
 * `dwPathPoints = 0`.
 */
export function D2Common_10229(
  pDynamicPath: DynamicPath,
  _pUnit: PathUnit | null,
  pDestRoom: PathRoom | null,
  nDestX: number,
  nDestY: number,
): number {
  if (sub_6FDAD5E0(pDynamicPath, pDestRoom, { X: u16(nDestX), Y: u16(nDestY) })) {
    pDynamicPath.dwPathPoints = 0
    return 1
  }
  return 0
}

/**
 * `D2Common_10230` (#10906, 1.13c 0x6FD5E150; D2MOO #10230 Step.cpp:678).
 * Teleports `pDynamicPath` to `(nDestX, nDestY)` in `pDestRoom` via {@link sub_6FDAD5E0} and sets
 * `unk0x38 = 15`. Called by D2Client `0x6FB1E860` / `0x6FADA1B0` on drift snap and `0x6FB5F2B0` (`0x6D`).
 */
export function D2Common_10230(
  pDynamicPath: DynamicPath,
  _pUnit: PathUnit | null,
  pDestRoom: PathRoom | null,
  nDestX: number,
  nDestY: number,
): number {
  const res = sub_6FDAD5E0(pDynamicPath, pDestRoom, { X: u16(nDestX), Y: u16(nDestY) })
  if (res) {
    pDynamicPath.unk0x38 = 15
    return 1
  }
  return 0
}

/**
 * `D2Common_10231` (#10075, 1.13c 0x6FD5E1A0; D2MOO #10231 Step.cpp:751).
 * Force-teleports `pDynamicPath` to `(nX, nY)` in `pRoomDest` via {@link D2Common_10231_Impl} and
 * clears `dwPathPoints = 0`. (Note: D2MOO's decompilation had a bug passing `wPosX, wPosY` instead of
 * `nX, nY`; 1.13c `0x6FD5E1A0` packs `[esp+0x10]` and `[esp+0x14]` into `tDest` and passes that.)
 */
export function D2Common_10231(
  pDynamicPath: DynamicPath,
  _pUnit: PathUnit | null,
  pRoomDest: PathRoom | null,
  nX: number,
  nY: number,
): number {
  D2Common_10231_Impl(pDynamicPath, pRoomDest, { X: u16(nX), Y: u16(nY) })
  pDynamicPath.dwPathPoints = 0
  return 1
}

/**
 * `D2Common_10232` (#10223, 1.13c 0x6FD5DCE0; D2MOO #10232 Step.cpp:804).
 * Asserts `pUnit` is a player or monster (line 0x50D). Attempts to move the footprint to
 * `(nTargetX, nTargetY)` in `pDestRoom` via {@link COLLISION_TrySetUnitCollisionMask}; returns 0 if
 * blocked. On success updates the precise coords, asserts the destination room (line 0x524), calls
 * {@link PATH_StopMovement}, and returns 1.
 */
export function D2Common_10232(
  pPath: DynamicPath,
  pUnit: PathUnit | null,
  pDestRoom: PathRoom | null,
  nTargetX: number,
  nTargetY: number,
): number {
  d2Assert(
    pUnit && (pUnit.dwUnitType === UNIT_PLAYER || pUnit.dwUnitType === UNIT_MONSTER),
    'D2Common_10232: pUnit && (PLAYER || MONSTER) (0x50D)',
  )
  const tx = i32(nTargetX)
  const ty = i32(nTargetY)
  if (
    COLLISION_TrySetUnitCollisionMask(
      pPath.pRoom,
      pPath.wPosX,
      pPath.wPosY,
      pDestRoom,
      tx,
      ty,
      pPath.dwCollisionPattern | 0,
      pPath.nFootprintCollisionMask,
      pPath.nMoveTestCollisionMask,
    ) !== 0
  ) {
    return 0
  }
  if (pPath.pRoom !== pDestRoom) {
    pPath.dwFlags = u32(pPath.dwFlags | PATH_UNKNOWN_FLAG_0x00001)
  }
  PATH_RecacheRoomAtCoordIfNeeded(pPath, subtileCenter(tx), subtileCenter(ty), pDestRoom)
  d2Assert(DUNGEON_GetRoomAtPosition(pDestRoom, tx, ty) !== null, 'D2Common_10232: destination in room (0x524)')
  PATH_StopMovement(pPath)
  return 1
}

/**
 * `D2Common_10213` (#10340, 1.13c 0x6FD86650, stdcall `(pUnit)`; D2MOO Path.cpp:1621).
 * Client-side per-tick re-path trigger called by D2Client `0x6FAFF4A0` while a monster has
 * `UNITFLAGEX_UNK_PATH_RELATED` (`0x2000`) set and `!UNITFLAG_ISASYNC`:
 * Increments `pDynamicPath->unk0x38`; once `unk0x38 > 1`, resets `unk0x38 = 0` and, if
 * `!D2Common_10227(pUnit)`, calls `D2Common_10236(pUnit, pTargetUnit != NULL)`. Returns TRUE (`1`)
 * when `D2Common_10236` succeeded so the caller can switch the monster to `MONMODE_WALK` (`2`).
 */
export function D2Common_10213(pUnit: PathUnit | null): boolean {
  if (!pUnit) return false
  if ((pUnit.dwFlags & UNITFLAG_ISASYNC) !== 0) return false
  if ((pUnit.dwFlagEx & UNITFLAGEX_UNK_PATH_RELATED) === 0) return false
  const pPath = pUnit.pDynamicPath
  d2Assert(pPath, 'D2Common_10213: pUnit->pDynamicPath (0x9B5)')
  const nextCount = (pPath.unk0x38 + 1) | 0
  pPath.unk0x38 = nextCount
  if (nextCount <= 1) return false
  pPath.unk0x38 = 0
  if (D2Common_10227(pUnit)) return false
  const bHasTarget = pPath.pTargetUnit !== null
  return D2Common_10236(pUnit, bHasTarget) !== 0
}

