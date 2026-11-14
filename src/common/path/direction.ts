/**
 * Diablo II 1.13c D2Common direction helpers (Refs #808).
 *
 * The 64-direction / 4096-scaled direction-vector math shared by the path setters (`D2Common_10216`),
 * the finders and the step code. Ported from the 1.13c disassembly (D2Common.dll, ImageBase
 * 0x6FD50000); D2MOO equivalents are cited per function.
 */

import { TAN_TO_DIRECTION } from './tables.ts'
import { type PathCoord, type PathPoint, u32 } from './types.ts'

/** `PATH_NormalizeDirection` (D2MOO `Path.h`): `nDirection & 0x3F` (64 directions). */
export function PATH_NormalizeDirection(nDirection: number): number {
  return nDirection & 0x3f
}

/** Result of {@link PATH_GetDirectionVector}: 4096-scaled unit vector + 64-direction index. */
export interface DirectionVectorResult {
  /** `D2CoordStrc` direction vector, each component in [-4096, 4096]. */
  readonly vector: PathCoord
  /** Direction 0..63 (written as a dword by 1.13c; callers read the low byte). */
  readonly direction: number
}

/**
 * `PATH_GetDirectionVector` (1.13c 0x6FD5CF40, stdcall `(x1, y1, x2, y2, D2CoordStrc* pVector,
 * int* pDirection)`; D2MOO Step.cpp:157, 1.10f 0x6FDAC5E0 with a fastcall argument order).
 *
 * All four inputs are unsigned 16.16 precise coordinates. The 1.13c code orders each axis with
 * unsigned compares (`ja`), compares the axis spans as SIGNED ints (`jg`), computes the tangent as
 * `idiv(minorSpan * 127, majorSpan)` (0 when the major span is 0), looks the 128-entry
 * {@link TAN_TO_DIRECTION} table up and folds the octant back exactly like the listing:
 * x-major -> swap vector components, `angle = ~angle & 0xF`; start Y above target Y -> negate Y,
 * `angle = ~angle & 0x1F`; start X <= target X -> `angle = ~angle & 0x3F`, else negate X;
 * `direction = (angle + 8) & 0x3F`. Identical to D2MOO.
 */
export function PATH_GetDirectionVector(
  dwStartPrecisionX: number,
  dwStartPrecisionY: number,
  dwTargetPrecisionX: number,
  dwTargetPrecisionY: number,
): DirectionVectorResult {
  const x1 = u32(dwStartPrecisionX)
  const y1 = u32(dwStartPrecisionY)
  const x2 = u32(dwTargetPrecisionX)
  const y2 = u32(dwTargetPrecisionY)

  let maxX: number
  let minX: number
  let bXStartLessOrEqual: boolean
  if (x1 > x2) {
    maxX = x1
    minX = x2
    bXStartLessOrEqual = false
  } else {
    maxX = x2
    minX = x1
    bXStartLessOrEqual = true
  }

  let maxY: number
  let minY: number
  let bYStartLessOrEqual: boolean
  if (y1 > y2) {
    maxY = y1
    minY = y2
    bYStartLessOrEqual = false
  } else {
    maxY = y2
    minY = y1
    bYStartLessOrEqual = true
  }

  // `sub edi,edx` / `sub ebx,esi` then `cmp ebx,edi; jg` (signed 32-bit spans).
  let bXMajor: boolean
  let minorSpan: number
  let majorSpan: number
  if (((maxX - minX) | 0) > ((maxY - minY) | 0)) {
    bXMajor = true
    minorSpan = (maxY - minY) | 0
    majorSpan = (maxX - minX) | 0
  } else {
    bXMajor = false
    minorSpan = (maxX - minX) | 0
    majorSpan = (maxY - minY) | 0
  }

  // `imul eax,eax,0x7f; cdq; idiv ecx` (0 when the major span is 0).
  const nTangent = majorSpan === 0 ? 0 : Math.trunc(Math.imul(minorSpan, 0x7f) / majorSpan) | 0
  const o = nTangent * 3
  const lutA = TAN_TO_DIRECTION[o]
  const lutB = TAN_TO_DIRECTION[o + 1]
  const lutAngle = TAN_TO_DIRECTION[o + 2]
  if (lutA === undefined || lutB === undefined || lutAngle === undefined) {
    throw new RangeError(`PATH_GetDirectionVector: tangent ${nTangent} outside lutTanToDirection`)
  }

  let vx: number
  let vy: number
  let nAngle: number
  if (bXMajor) {
    vy = lutA
    vx = lutB
    nAngle = ~lutAngle & 0xf
  } else {
    vx = lutA
    vy = lutB
    nAngle = lutAngle
  }
  if (!bYStartLessOrEqual) {
    vy = -vy | 0
    nAngle = ~nAngle & 0x1f
  }
  if (bXStartLessOrEqual) {
    nAngle = ~nAngle & 0x3f
  } else {
    vx = -vx | 0
  }
  return { vector: { nX: vx, nY: vy }, direction: (nAngle + 8) & 0x3f }
}

/**
 * Direction between two precise positions (1.13c 0x6FD5D150, stdcall `(x1, y1, x2, y2)`: calls
 * {@link PATH_GetDirectionVector} and returns the direction; D2MOO
 * `PATH_ComputeDirectionFromPreciseCoords_6FDAC760` PathMisc.cpp:1001).
 */
export function PATH_ComputeDirectionFromPreciseCoords_6FDAC760(
  dwStartPrecisionX: number,
  dwStartPrecisionY: number,
  dwTargetPrecisionX: number,
  dwTargetPrecisionY: number,
): number {
  return PATH_GetDirectionVector(dwStartPrecisionX, dwStartPrecisionY, dwTargetPrecisionX, dwTargetPrecisionY).direction
}

/**
 * Sub-tile direction (D2Common #10493, 1.13c 0x6FD5D180: `PATH_GetDirectionVector` on the sub-tile
 * centres `(n << 16) + 0x8000`, returns the direction only; D2MOO `PATH_ComputeDirection` (1.10f
 * #10215) PathMisc.cpp:990). Inputs are truncated to 32 bits like the `shl reg,0x10` of the listing.
 */
export function PATH_ComputeDirection(nX1: number, nY1: number, nX2: number, nY2: number): number {
  return PATH_GetDirectionVector(subtileCenter(nX1), subtileCenter(nY1), subtileCenter(nX2), subtileCenter(nY2)).direction
}

/** `(n << 16) + 0x8000` with 32-bit wrap-around (`shl reg,0x10; add reg,0x8000`). */
export function subtileCenter(n: number): number {
  return ((n << 16) + 0x8000) >>> 0
}

/**
 * 1.13c `byte_6FDE4F68` 64-entry LUT used by `D2Common_11053` (`0x6FDA5600`, D2MOO `Monsters.cpp:693`)
 * to map a 64-direction index (`0..63`) to an 8-direction index (`0..7`).
 */
export const DIR64_TO_DIR8_11053: readonly number[] = Object.freeze([
  0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4,
  4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 0, 0, 0, 0,
])

/**
 * `D2Common_11053` (1.13c `0x6FDA5600`, D2MOO `Monsters.cpp:693`):
 * Converts a 64-direction index (`0..63`) to an 8-direction index (`0..7`).
 * Returns `0` when `nDirection >= 64` or `< 0`, matching `cmp eax, 0x40; jge`.
 */
export function D2Common_11053(nDirection: number): number {
  const idx = nDirection | 0
  if (idx < 0 || idx >= 64) {
    return 0
  }
  return DIR64_TO_DIR8_11053[idx] ?? 0
}

/**
 * `UNITS_GetDirectionToCoords` (D2MOO `Units.cpp:259`):
 * Computes the 64-direction index (`0..63`) from unit coordinates `(fromX, fromY)` toward `(toX, toY)`
 * via `PATH_ComputeDirection`.
 */
export function UNITS_GetDirectionToCoords(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  if (
    (fromX | 0) === (toX | 0) &&
    (fromY | 0) === (toY | 0) &&
    (fromX !== toX || fromY !== toY)
  ) {
    return PATH_ComputeDirectionFromPreciseCoords_6FDAC760(
      Math.round(fromX * 65536),
      Math.round(fromY * 65536),
      Math.round(toX * 65536),
      Math.round(toY * 65536),
    )
  }
  return PATH_ComputeDirection(fromX, fromY, toX, toY)
}

/** 1.13c `Overlay.txt` row indices for Sorceress reactive hit overlays (`Skills.txt` `cltoverlaya` / `prgoverlay`). */
export const OVERLAY_INDEX_FROZEN_ARMOR_HIT = 42
export const OVERLAY_INDEX_SHIVER_ARMOR_HIT = 43
export const OVERLAY_INDEX_CHILL_ARMOR_HIT = 44
export const OVERLAY_INDEX_ENERGY_SHIELD_HIT_BASE = 87

/**
 * 1.13c `SKILLS_EventFunc24_EnergyShield` (`0x6FD17820`, D2MOO `SkillSor.cpp:1067`):
 * `nOverlay = D2Common_11053(UNITS_GetDirectionToCoords(pAttacker, CLIENTS_GetUnitX(pUnit), CLIENTS_GetUnitY(pUnit))) + pSkillsTxtRecord->wPrgOverlay`
 * where `pAttacker` is the defending Sorceress (`defenderX, defenderY`) and `pUnit` is the damage source (`attackerX, attackerY`).
 */
export function computeEnergyShieldHitOverlay113c(
  defenderX: number,
  defenderY: number,
  attackerX: number,
  attackerY: number,
  prgOverlayBaseIndex = OVERLAY_INDEX_ENERGY_SHIELD_HIT_BASE,
): {
  readonly dir64: number
  readonly dir8: number
  readonly overlayIndex: number
  readonly overlayToken: string
} {
  const dir64 = UNITS_GetDirectionToCoords(defenderX, defenderY, attackerX, attackerY)
  const dir8 = D2Common_11053(dir64)
  const overlayIndex = prgOverlayBaseIndex + dir8
  const overlayToken = `energyshieldhit${String(dir8)}`
  return {
    dir64,
    dir8,
    overlayIndex,
    overlayToken,
  }
}


