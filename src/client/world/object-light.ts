/**
 * Diablo II v1.13c generic object lights (#827) and the client object animation tick that drives them.
 *
 * | VA (D2Client.dll unless noted) | Function                                                                    |
 * |--------------------------------|-----------------------------------------------------------------------------|
 * | 0x6fad4920                     | SetObjectLight: the only function that creates, changes or frees unit+0x64  |
 * | 0x6fb58c20                     | LIGHT_Alloc: radius <= 0 → no light; clamp 18; current = target = r*8      |
 * | 0x6fb58be0                     | LIGHT_SetRadius: r <= 0 → no-op; clamp 18; writes the target (+0x1C) only   |
 * | 0x6fb58630                     | LIGHT_Free: immediate (objects never fade out)                              |
 * | 0x6fb59b50                     | LightUpdate: current radius moves ±8 (1 sub-tile) toward the target         |
 * | 0x6fad5660                     | object animation tick (25 Hz), incl. the client auto transition 1 → 2      |
 * | D2Common #10595 0x6fd835f0     | animation reset on a mode set (object branch 0x6fd8378d..0x6fd8381e)        |
 *
 * SetObjectLight has exactly five call sites, ported as the only callers of {@link setObjectLight}:
 * - 0x6fad564e: object init after S2C 0x51, `Lit[mode]`, unless the EnvEffect switch acted (online-session);
 * - 0x6fad538c / 0x6fad5311: the EnvEffect day/night switch 0x6fad5280 (env-effect.ts);
 * - 0x6fad57c5: the client auto transition 1 → 2 at the end of a one-shot mode-1 animation, `Lit[2]`
 *   ({@link tickObjectAnim});
 * - 0x6fad5af9: S2C 0x0E event 3 on a non-door, `Lit[packet mode]`, even when the mode is unchanged
 *   (ClientWorld `UnitMode`).
 * Mode changes made on the client by ClientFn 2/3/7/10/16, the door handlers and the class-189 2 → 3 → 4 steps never
 * touch the light.
 *
 * The light: radius `Lit >> 1` sub-tiles (clamp 18, never reached by shipped data), intensity 255, colour =
 * Objects.txt Red/Green/Blue captured when the light is allocated (never rewritten), light type 2. There is no flicker:
 * Objects.txt `Flicker` has no binfield in the 1.13c loader and dLightMap (0x6fb58000..0x6fb59f00) has no RNG.
 * Occlusion and the type-2 cache are the light grid's (#830, src/common/drlg/light-grid.ts): unit-drawables.ts hands
 * this light to it as a type-2 record each frame.
 */

import { SEED_RollLimitedRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'
import type { ObjectsTxtRecord113c } from '../../common/world/objects-txt-113c.ts'

/** Radius clamp of LIGHT_Alloc 0x6fb58c20 and LIGHT_SetRadius 0x6fb58be0, in sub-tiles. */
export const OBJECT_LIGHT_MAX_RADIUS = 18
/** Intensity SetObjectLight passes to LIGHT_Alloc (0x6fad496a). */
export const OBJECT_LIGHT_INTENSITY = 255
/** Largest animation speed #10595 stores (s16 at unit+0x4C). */
const MAX_ANIM_SPEED = 0x7fff
/** Class-specific frame stepping in 0x6fad5660. */
const REVERSE_LOOP_CLASS = 12
const CAIN_PORTAL_CLASS = 189

/** unit+0x64: the object's type-2 light (dLightMap struct of 0x34 bytes allocated by 0x6fb58c20). */
export interface ObjectLight113c {
  /** +0x1C target radius ×8, moved by LIGHT_SetRadius 0x6fb58be0. */
  targetR8: number
  /** +0x18 current radius ×8, eased by LightUpdate 0x6fb59b50; the drawn radius is `currentR8 >> 3`. */
  currentR8: number
  /** +0x25 red, set by LIGHT_Alloc only. */
  readonly red: number
  /** +0x26 green, set by LIGHT_Alloc only. */
  readonly green: number
  /** +0x27 blue, set by LIGHT_Alloc only. */
  readonly blue: number
}

/** Object animation state as D2Common #10595 sets it. */
export interface ObjectAnim113c {
  /** Mode the parameters were derived for (unit+0x10 at the last reset). */
  mode: number
  /** unit+0x44: current frame, 8.8 fixed point (int32). */
  frame8: number
  /** unit+0x4C: frames per 25 Hz game frame, 8.8 fixed point, 0..0x7FFF. */
  speed8: number
}

/** The ClientUnit fields the object light and animation paths read and write. */
export interface ObjectLightUnit {
  readonly id: number
  readonly classId: number
  readonly seed: D2SeedStrc
  mode: number
  objectLight: ObjectLight113c | null
  objectAnim?: ObjectAnim113c | undefined
  modeStartedAtMs?: number | undefined
  animStartedAtMs?: number | undefined
  modeUntilMs?: number | undefined
  modeDurationMs?: number | undefined
  modeElapsedMs?: number | undefined
  animStepSpeed256?: number | undefined
  animEffRate?: number | undefined
}

/**
 * Index of `mode` in the per-mode Objects.txt columns.
 *
 * @throws RangeError when `mode` is not an object mode (0..7).
 */
function modeIndex(record: ObjectsTxtRecord113c, mode: number): number {
  if (!Number.isInteger(mode) || mode < 0 || mode >= record.lit.length) {
    throw new RangeError(`Objects.txt '${record.name}': ${String(mode)} is not an object mode (0..${String(record.lit.length - 1)})`)
  }
  return mode
}

/**
 * Objects.txt `Lit[mode]` of a record.
 *
 * @throws RangeError when `mode` is not an object mode (0..7).
 */
export function objectLitForMode(record: ObjectsTxtRecord113c, mode: number): number {
  return record.lit[modeIndex(record, mode)]!
}

/**
 * SetObjectLight 0x6fad4920.
 *
 * - `Lit` 0 frees the light at once (LIGHT_Free 0x6fb58630; no fade-out).
 * - No light yet: LIGHT_Alloc 0x6fb58c20 with radius `min(Lit >> 1, 18)`; it refuses radius 0 (`Lit` 1), and a new
 *   light starts at full radius (current = target, no fade-in) with the record's colour.
 * - Existing light: LIGHT_SetRadius 0x6fb58be0 moves the target only (radius 0 is a no-op); the colour is kept.
 *
 * @param unit - the object.
 * @param record - the object's compiled Objects.txt record (colour source).
 * @param lit - `Lit[mode]` (u8).
 * @throws RangeError when `lit` is not a u8.
 */
export function setObjectLight(unit: ObjectLightUnit, record: ObjectsTxtRecord113c, lit: number): void {
  if (!Number.isInteger(lit) || lit < 0 || lit > 0xff) {
    throw new RangeError(`SetObjectLight: Lit ${String(lit)} of object ${String(unit.id)} is not 0..255`)
  }
  if (lit === 0) {
    unit.objectLight = null
    return
  }
  const radius = Math.min(lit >> 1, OBJECT_LIGHT_MAX_RADIUS)
  if (radius <= 0) return // Alloc refuses radius 0; SetRadius(0) is a no-op on an existing light
  if (unit.objectLight === null) {
    unit.objectLight = { targetR8: radius * 8, currentR8: radius * 8, red: record.red, green: record.green, blue: record.blue }
    return
  }
  unit.objectLight.targetR8 = radius * 8
}

/**
 * D2Common #10595 (`UNITS_UpdateAnimRateAndVelocity`, `0x6fd835f0`, object branch `0x6fd8378d..0x6fd8381e`):
 * restart the animation of the object's current mode.
 *
 * - `frame8 = Start[mode] << 8` (`unit+0x44`)
 * - `speed8 = FrameDelta[mode]` when `Sync != 0`, else
 *   `FrameDelta - (FrameDelta >> 4) + SEED_RollLimitedRandomNumber(&unit->pSeed, FrameDelta >> 3)`
 *   (`0x6fd837af..0x6fd837cf`, calling `0x6fd51100`); clamped to `0..0x7FFF` (`unit+0x4C`).
 *
 * @throws Error when `unit.seed` is missing or malformed.
 * @throws RangeError when the unit's mode is not an object mode (0..7).
 */
export function resetObjectAnim(unit: ObjectLightUnit, record: ObjectsTxtRecord113c): void {
  if (!unit.seed || typeof unit.seed.lo !== 'number' || typeof unit.seed.hi !== 'number') {
    throw new Error(`resetObjectAnim: object ${String(unit.id)} is missing a valid D2SeedStrc unit.seed`)
  }
  const mode = modeIndex(record, unit.mode)
  const frameDelta = record.frameDelta[mode]!
  const speed =
    record.sync !== 0
      ? frameDelta
      : frameDelta - (frameDelta >> 4) + SEED_RollLimitedRandomNumber(unit.seed, frameDelta >> 3)
  unit.objectAnim = {
    mode,
    frame8: record.start[mode]! << 8,
    speed8: Math.min(Math.max(speed, 0), MAX_ANIM_SPEED),
  }
}

/** A client-side mode change restarts the port's draw clocks (1.13c: GfxRefresh 0x6fb1a220). */
function restartModeClocks(unit: ObjectLightUnit, nowMs: number): void {
  unit.modeStartedAtMs = nowMs
  unit.animStartedAtMs = nowMs
  unit.modeElapsedMs = 0
  unit.modeUntilMs = undefined
  unit.modeDurationMs = undefined
  unit.animStepSpeed256 = undefined
  unit.animEffRate = undefined
}

/**
 * One 25 Hz animation step of an object (0x6fad5660; run by the per-object update 0x6fad5b40 before its ClientFn).
 *
 * With `fc = FrameCnt[mode] << 8`: a one-frame animation (`fc` = 0x100) never advances. In a one-shot mode
 * (`CycleAnim` 0) whose last frame is reached (`frame >= fc - 0x100`, signed, so `FrameCnt` 0 ends at once):
 * class 189 steps 2 → 3 → 4 (no light), mode 1 becomes mode 2 — #10595 and `SetObjectLight(Lit[2])` (0x6fad57c5) —
 * and any other mode holds its last frame. Otherwise the frame advances by the speed (class 12 and class 189 in
 * mode 3 play backwards; class 189 then goes to mode 4) and a one-shot animation stops on its last frame.
 *
 * Doors are skipped: their branch (DoorAnim 0x6fad5400) is not ported and never touches a light (no lit row is a
 * door). Not ported either, because they are outside the light path: the OrderFlag[2] flag, the Parm7 sound, the
 * overlay of classes 354..407, Selectable[2] and the HasCollision[2] collision removal at the 1 → 2 transition.
 *
 * @returns whether the auto transition 1 → 2 happened on this step.
 * @throws RangeError when the unit's mode is not an object mode (0..7).
 */
export function tickObjectAnim(unit: ObjectLightUnit, record: ObjectsTxtRecord113c, nowMs: number): boolean {
  if (record.isDoor !== 0) return false
  if (unit.objectAnim === undefined || unit.objectAnim.mode !== unit.mode) resetObjectAnim(unit, record)
  const anim = unit.objectAnim!
  let mode = modeIndex(record, unit.mode)
  if (mode === 0 && record.frameCnt[0] === 0 && (record.frameCnt[1]! > 0 || record.frameCnt[2]! > 0)) {
    unit.mode = record.frameCnt[2]! > 0 ? 2 : 1
    resetObjectAnim(unit, record)
    setObjectLight(unit, record, objectLitForMode(record, unit.mode))
    restartModeClocks(unit, nowMs)
    mode = modeIndex(record, unit.mode)
  }
  const fc = (record.frameCnt[mode]! << 8) | 0
  if (fc === 0x100) return false
  const cycle = record.cycleAnim[mode]!
  if (cycle === 0 && anim.frame8 >= fc - 0x100) {
    if (unit.classId === CAIN_PORTAL_CLASS && (mode === 2 || mode === 3)) {
      // 0x6fad56cc: mode++ and frame = Start[mode] << 8 (the speed is kept); no light.
      unit.mode = mode + 1
      anim.mode = unit.mode
      anim.frame8 = record.start[modeIndex(record, unit.mode)]! << 8
      restartModeClocks(unit, nowMs)
      return false
    }
    if (mode !== 1) return false
    unit.mode = 2 // 0x6fad56e7
    resetObjectAnim(unit, record)
    setObjectLight(unit, record, objectLitForMode(record, 2)) // 0x6fad57c5: Lit[2] (record +0x112)
    restartModeClocks(unit, nowMs)
    return true
  }
  // 0x6fad57f5: advance.
  if (unit.classId === REVERSE_LOOP_CLASS) {
    anim.frame8 = (anim.frame8 - anim.speed8) | 0
    if (anim.frame8 < 0) anim.frame8 = (anim.frame8 + fc) | 0
    return false
  }
  if (unit.classId === CAIN_PORTAL_CLASS && mode === 3) {
    anim.frame8 = (anim.frame8 - anim.speed8) | 0
    if (anim.frame8 < 0) {
      // 0x6fad582b..0x6fad583a: mode 4, frame = Start[4] << 8, D2Common.#10595; no light.
      unit.mode = 4
      resetObjectAnim(unit, record)
      restartModeClocks(unit, nowMs)
    }
    return false
  }
  anim.frame8 = (anim.frame8 + anim.speed8) | 0
  if (anim.frame8 >= fc) {
    anim.frame8 = cycle !== 0 ? ((record.start[mode]! << 8) - fc + anim.frame8) | 0 : (fc - 0x100) | 0
  }
  return false
}

/**
 * LightUpdate 0x6fb59b50, radius part: the current radius moves one sub-tile (±8) toward the target per light-grid
 * build, and a value >= 0x100 is clamped to 0xF8 (unreachable for objects: their target is at most 18 × 8 = 0x90).
 */
export function easeObjectLight(light: ObjectLight113c): void {
  if (light.currentR8 !== light.targetR8) light.currentR8 += light.targetR8 > light.currentR8 ? 8 : -8
  if (light.currentR8 >= 0x100) light.currentR8 = 0xf8
}

/** LIGHT_GetRadius 0x6fb58710: the drawn radius in sub-tiles (`current >> 3`). */
export function objectLightRadius(light: ObjectLight113c): number {
  return light.currentR8 >> 3
}

/** What the scene draws for an object's light: drawn radius (sub-tiles) and the colour captured at allocation. */
export interface RenderableObjectLight {
  readonly radius: number
  readonly r: number
  readonly g: number
  readonly b: number
}

/** Snapshot of unit+0x64 for the scene, or `undefined` when the object has no light. */
export function objectLightRenderInput(light: ObjectLight113c | null): RenderableObjectLight | undefined {
  if (light === null) return undefined
  return { radius: objectLightRadius(light), r: light.red, g: light.green, b: light.blue }
}
