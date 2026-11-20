/**
 * Diablo II 1.13c unit facing in the engine's 64-direction space ("dir64").
 *
 * dir64 0 faces screen south (world +X+Y) and the index grows clockwise on screen. The
 * engine quantises the eight compass vectors to: S (+1,+1) = 0, SW (0,+1) = 7,
 * W (−1,+1) = 15, NW (−1,0) = 23, N (−1,−1) = 32, NE (0,−1) = 40, E (+1,−1) = 47,
 * SE (+1,0) = 56.
 *
 * Every unit facing in the client is a dir64 value. It becomes an animation (COF)
 * direction only when a clip is drawn, through {@link dir64ToClipDirection}.
 */

import { dir64ToCof, dir64ToDcc } from './character.ts'

export { dir64ToDcc }

/** dir64 values are integers in `0..DIR64_COUNT - 1`. */
export const DIR64_COUNT = 64

/** World sub-tile → 16.16 fixed point, the engine's precise unit coordinates. */
const FP16_ONE = 65536

/**
 * Angle column of the D2Common.dll 1.13c path direction table at VA **0x6FDDD470**
 * (128 × `{ int32 x, int32 y, int32 angle }`), indexed by `trunc(127 · minor / major)`.
 * The values step at indices 13, 26, 39, 53, 68, 85 and 105.
 */
const PATH_DIRECTION_ANGLE: readonly number[] = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2,
  2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
]

/** Throws unless `value` is a dir64 (an integer in `0..63`). */
export function assertDir64(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= DIR64_COUNT) {
    throw new RangeError(`${what} must be an integer dir64 in 0..63, got ${String(value)}`)
  }
}

function toFp16(value: number, what: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${what} must be a finite sub-tile coordinate, got ${String(value)}`)
  }
  return Math.round(value * FP16_ONE)
}

/**
 * The dir64 facing from a start point toward a target point, both in world sub-tiles.
 *
 * Exact port of D2Common.dll 1.13c **0x6FD5CF40** (D2MOO `PATH_GetDirectionVector`,
 * `Step.cpp`), which runs on 16.16 fixed-point coordinates:
 *  1. take `|dx|`, `|dy|`; if `|dx| > |dy|` swap them, so `minor <= major`;
 *  2. `a = ANGLE[trunc(127 · minor / major)]` (table at 0x6FDDD470);
 *  3. if swapped, `a = (−1 − a) & 15`; if `start.y > target.y`, `a = (−1 − a) & 31`;
 *     if `start.x <= target.x`, `a = (−1 − a) & 63`;
 *  4. the result is `(a + 8) & 63`.
 *
 * The engine computes `127 · minor` in 32 bits, which wraps once `minor` reaches about
 * 258 sub-tiles. It never asks for a facing across a segment that long, so the port uses
 * exact arithmetic instead of reproducing the wrap.
 *
 * For identical points the raw routine would return 7 (tangent 0, both "start <= target"
 * branches), but the engine never calls it that way: it only computes a facing when a unit
 * starts a segment toward a path point, and path points never include the unit's own
 * position. So when the points coincide (to 1/65536 of a sub-tile) this returns
 * `fallbackDir64` — callers pass the unit's current facing, i.e. no new segment and no
 * facing change.
 *
 * @throws RangeError when a coordinate is not finite or `fallbackDir64` is not a dir64.
 */
export function dir64FromPoints(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  fallbackDir64: number,
): number {
  assertDir64(fallbackDir64, 'fallbackDir64')
  const sx = toFp16(startX, 'startX')
  const sy = toFp16(startY, 'startY')
  const tx = toFp16(targetX, 'targetX')
  const ty = toFp16(targetY, 'targetY')

  const absDx = Math.abs(tx - sx)
  const absDy = Math.abs(ty - sy)
  if (absDx === 0 && absDy === 0) return fallbackDir64

  const swapped = absDx > absDy
  const minor = swapped ? absDy : absDx
  const major = swapped ? absDx : absDy
  // Integer division without floating-point rounding: every operand stays below 2^53.
  const scaled = 127 * minor
  const tangent = (scaled - (scaled % major)) / major
  const tableAngle = PATH_DIRECTION_ANGLE[tangent]
  if (tableAngle === undefined) {
    throw new RangeError(`direction tangent index ${String(tangent)} outside 0..127`)
  }

  let angle = tableAngle
  if (swapped) angle = (-1 - angle) & 0x0f
  if (sy > ty) angle = (-1 - angle) & 0x1f
  if (sx <= tx) angle = (-1 - angle) & 0x3f
  return (angle + 8) & 0x3f
}

/**
 * The animation (COF) direction to draw for a dir64 facing.
 *
 * Port of D2CMP.dll 1.13c ordinal **#10020** (0x6FE21FB0), which reads row
 * `bsf(directions) + 1` of the int32 table at 0x6FE2F4D8 and asserts that `dir64 < 64` and
 * that `directions` is a power of two no greater than 64:
 *  - 1 direction: always 0 (row 0x6FE2F5D8 is all zeros);
 *  - 2 directions: dir64 16..47 → 1, otherwise 0 (row 0x6FE2F6D8);
 *  - 4 / 8 / 16 / 32 / 64 directions: rows 0x6FE2F7D8 / 8D8 / 9D8 / AD8 / BD8, which equal
 *    {@link dir64ToCof}'s tables.
 *
 * @throws RangeError when `dir64` is not a dir64 or `directions` is not one the engine
 * supports (instead of `dir64ToCof`'s silent 0).
 */
export function dir64ToClipDirection(dir64: number, directions: number): number {
  assertDir64(dir64, 'dir64')
  switch (directions) {
    case 1:
      return 0
    case 2:
      return dir64 >= 16 && dir64 < 48 ? 1 : 0
    case 4:
    case 8:
    case 16:
    case 32:
    case 64:
      return dir64ToCof(dir64, directions)
    default:
      throw new RangeError(
        `animation direction count must be 1, 2, 4, 8, 16, 32 or 64, got ${String(directions)}`,
      )
  }
}

/** 25Hz game tick period in milliseconds (`1000 / 25 = 40ms`). */
export const D2_TURN_TICK_MS = 40
export const D2_UNIT_TURN_TICK_MS = D2_TURN_TICK_MS

/**
 * 64-entry turn step lookup table from `D2Common.dll` 1.13c VA **0x6FDE41C8** (RVA `0x941C8`,
 * file offset `0x925C8` / `.rdata` raw offset `0x941C8`), indexed by `diff = (targetDir64 - dir64) & 63`:
 *  - `diff = 0`      → `0`
 *  - `diff = 1..8`   → `+1`
 *  - `diff = 9..16`  → `+4`
 *  - `diff = 17..31` → `+8`
 *  - `diff = 32..47` → `-8`
 *  - `diff = 48..55` → `-4`
 *  - `diff = 56..63` → `-1`
 */
export const TURN_STEP_TABLE_113C: readonly number[] = [
  0, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4,
  4, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
  -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8, -8,
  -4, -4, -4, -4, -4, -4, -4, -4, -1, -1, -1, -1, -1, -1, -1, -1,
]

export const TURN_STEP_TABLE = TURN_STEP_TABLE_113C

/**
 * `D2DynamicPathStrc` facing state (`+0x64` `nDirection`, `+0x65` `nNewDirection`,
 * `+0x66` `nStepDir`) plus a sub-tick millisecond accumulator for 25Hz (`40ms`) updates.
 */
export interface UnitTurnState {
  /** Current facing (`D2DynamicPathStrc` `+0x64` `nDirection`, integer in `0..63`). */
  dir64: number
  /** Target facing (`D2DynamicPathStrc` `+0x65` `nNewDirection`, integer in `0..63`). */
  targetDir64: number
  /** Cached turn step per 25Hz tick (`D2DynamicPathStrc` `+0x66` `nStepDir`: `0, ±1, ±4, ±8`). */
  stepDir: number
  /** Accumulated fractional milliseconds toward the next 40ms (25Hz) turn tick. */
  turnTickRemainderMs: number
}

/**
 * Look up the 1.13c turn step (`0, ±1, ±4, ±8`) for turning from `dir64` toward `targetDir64`.
 */
export function computeTurnStepDir64(dir64: number, targetDir64: number): number {
  assertDir64(dir64, 'dir64')
  assertDir64(targetDir64, 'targetDir64')
  return TURN_STEP_TABLE_113C[(targetDir64 - dir64) & 0x3f]!
}

/**
 * Create a `UnitTurnState` initialized at `initialDir64` (`bInstant = 1` settled state).
 */
export function createUnitTurnState(initialDir64 = 0): UnitTurnState {
  assertDir64(initialDir64, 'initialDir64')
  return {
    dir64: initialDir64,
    targetDir64: initialDir64,
    stepDir: 0,
    turnTickRemainderMs: 0,
  }
}

/**
 * Instantaneously snap both `dir64` (`+0x64`) and `targetDir64` (`+0x65`) to `dir64` and clear
 * `stepDir` (`+0x66`), matching `bInstant = 1` in `D2Common.#10739` (**0x6FD852F0**).
 */
export function snapUnitTurnDirection(state: UnitTurnState, dir64: number): UnitTurnState {
  assertDir64(dir64, 'dir64')
  state.dir64 = dir64
  state.targetDir64 = dir64
  state.stepDir = 0
  state.turnTickRemainderMs = 0
  return state
}

/**
 * Set a unit's target facing (`D2Common` **0x6FD850B0** / ordinal **#10425** **0x6FD85270** /
 * **0x6FD5D370**, or **#10739** **0x6FD852F0** with `instant = true`):
 *  - When `instant = true` (`bInstant = 1`), snaps both `dir64` and `targetDir64` immediately.
 *  - When `instant = false` (`bInstant = 0`), if `targetDir64 === state.targetDir64` this is a
 *    no-op so an in-progress turn preserves its cached `stepDir` without decelerating; otherwise
 *    updates `targetDir64` and caches `stepDir = TURN_STEP_TABLE_113C[(targetDir64 - dir64) & 63]`.
 */
export function setUnitTargetDirection(
  state: UnitTurnState,
  targetDir64: number,
  instant = false,
): UnitTurnState {
  assertDir64(state.dir64, 'state.dir64')
  assertDir64(state.targetDir64, 'state.targetDir64')
  assertDir64(targetDir64, 'targetDir64')
  if (
    !Number.isInteger(state.stepDir) ||
    (state.stepDir !== 0 &&
      state.stepDir !== 1 &&
      state.stepDir !== -1 &&
      state.stepDir !== 4 &&
      state.stepDir !== -4 &&
      state.stepDir !== 8 &&
      state.stepDir !== -8)
  ) {
    throw new RangeError(
      `state.stepDir must be a valid 1.13c turn step (0, ±1, ±4, ±8), got ${String(state.stepDir)}`,
    )
  }
  if (!Number.isFinite(state.turnTickRemainderMs) || state.turnTickRemainderMs < 0) {
    throw new RangeError(
      `state.turnTickRemainderMs must be a finite non-negative number, got ${String(state.turnTickRemainderMs)}`,
    )
  }
  if (instant) {
    return snapUnitTurnDirection(state, targetDir64)
  }
  if (targetDir64 === state.targetDir64) {
    return state
  }
  state.targetDir64 = targetDir64
  state.stepDir = TURN_STEP_TABLE_113C[(targetDir64 - state.dir64) & 0x3f]!
  if (state.dir64 === state.targetDir64) {
    state.turnTickRemainderMs = 0
  }
  return state
}

/**
 * Port of `D2Common.#10739` (**0x6FD852F0**): compute the `dir64` from `(startX, startY)` toward
 * `(targetX, targetY)` via `0x6FD5CF40` and apply it with `bInstant = 0` (`instant = false`) or
 * `bInstant = 1` (`instant = true`). Coincident points keep the existing target/current facing.
 */
export function targetUnitTurnTowardPoint(
  state: UnitTurnState,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  instant = false,
): UnitTurnState {
  assertDir64(state.dir64, 'state.dir64')
  assertDir64(state.targetDir64, 'state.targetDir64')
  const fallback = instant ? state.dir64 : state.targetDir64
  const nextTarget = dir64FromPoints(startX, startY, targetX, targetY, fallback)
  return setUnitTargetDirection(state, nextTarget, instant)
}

/**
 * Advance `state` by one 25Hz (`40ms`) tick, exact port of `D2Common.#10603` (**0x6FD84D70**):
 *  - If `dir64 === targetDir64`, does nothing.
 *  - Otherwise sets `next = (dir64 + stepDir) & 63`, computes `rem = (next - targetDir64) & 63`,
 *    and clamps `dir64 = targetDir64` when `(stepDir < 0 && rem > 31) || (stepDir > 0 && rem < 31)`.
 */
export function stepUnitTurnTick(state: UnitTurnState): number {
  assertDir64(state.dir64, 'state.dir64')
  assertDir64(state.targetDir64, 'state.targetDir64')
  if (
    !Number.isInteger(state.stepDir) ||
    (state.stepDir !== 0 &&
      state.stepDir !== 1 &&
      state.stepDir !== -1 &&
      state.stepDir !== 4 &&
      state.stepDir !== -4 &&
      state.stepDir !== 8 &&
      state.stepDir !== -8)
  ) {
    throw new RangeError(
      `state.stepDir must be a valid 1.13c turn step (0, ±1, ±4, ±8), got ${String(state.stepDir)}`,
    )
  }
  if (!Number.isFinite(state.turnTickRemainderMs) || state.turnTickRemainderMs < 0) {
    throw new RangeError(
      `state.turnTickRemainderMs must be a finite non-negative number, got ${String(state.turnTickRemainderMs)}`,
    )
  }
  if (state.dir64 === state.targetDir64) {
    state.stepDir = 0
    state.turnTickRemainderMs = 0
    return state.dir64
  }
  const stepDir =
    state.stepDir !== 0
      ? state.stepDir
      : TURN_STEP_TABLE_113C[(state.targetDir64 - state.dir64) & 0x3f]!
  state.stepDir = stepDir
  const next = (state.dir64 + stepDir) & 0x3f
  const rem = (next - state.targetDir64) & 0x3f
  if ((stepDir < 0 && rem > 31) || (stepDir > 0 && rem < 31)) {
    state.dir64 = state.targetDir64
  } else {
    state.dir64 = next
  }
  if (state.dir64 === state.targetDir64) {
    state.stepDir = 0
    state.turnTickRemainderMs = 0
  }
  return state.dir64
}

/**
 * Advance `state` by `ticks` 25Hz game ticks (`ticks * 40ms`).
 */
export function advanceUnitTurnByTicks(state: UnitTurnState, ticks = 1): number {
  assertDir64(state.dir64, 'state.dir64')
  assertDir64(state.targetDir64, 'state.targetDir64')
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new RangeError(`ticks must be a non-negative integer, got ${String(ticks)}`)
  }
  for (let i = 0; i < ticks; i++) {
    stepUnitTurnTick(state)
    if (state.dir64 === state.targetDir64) break
  }
  return state.dir64
}

export const advanceUnitTurnTicks = advanceUnitTurnByTicks

/**
 * Advance `state` by `dtMs` milliseconds using a 25Hz (`40ms`) tick accumulator.
 */
export function advanceUnitTurnByDtMs(state: UnitTurnState, dtMs: number): number {
  assertDir64(state.dir64, 'state.dir64')
  assertDir64(state.targetDir64, 'state.targetDir64')
  if (!Number.isFinite(dtMs)) {
    throw new RangeError(`dtMs must be a finite number, got ${String(dtMs)}`)
  }
  if (!Number.isFinite(state.turnTickRemainderMs) || state.turnTickRemainderMs < 0) {
    throw new RangeError(
      `state.turnTickRemainderMs must be a finite non-negative number, got ${String(state.turnTickRemainderMs)}`,
    )
  }
  if (dtMs <= 0) return state.dir64
  if (state.dir64 === state.targetDir64) {
    state.turnTickRemainderMs = 0
    return state.dir64
  }
  state.turnTickRemainderMs += dtMs
  while (state.turnTickRemainderMs + 1e-9 >= D2_TURN_TICK_MS && state.dir64 !== state.targetDir64) {
    state.turnTickRemainderMs = Math.max(0, state.turnTickRemainderMs - D2_TURN_TICK_MS)
    stepUnitTurnTick(state)
  }
  if (state.dir64 === state.targetDir64) {
    state.turnTickRemainderMs = 0
  }
  return state.dir64
}

