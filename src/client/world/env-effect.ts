/**
 * Diablo II v1.13c EnvEffect objects — D2Client.dll switches every object whose Objects.txt
 * `EnvEffect` is set between its day mode (0) and its night mode (1) when the act's period of day
 * changes.
 *
 * | VA          | Function                                                                     |
 * |-------------|------------------------------------------------------------------------------|
 * | 0x6fad5280  | period-of-day switch for one object (returns 1 when it acted)                |
 * | 0x6fad4920  | object light from `Lit[mode]` + Objects.txt Red/Green/Blue                   |
 * | 0x6fad5490  | object init: the switch with ebx = 1, for every S2C 0x51 (new unit each time) |
 * | 0x6fad53d0  | ClientFn 14: the switch every 500 ms (`GetTickCount() > unit[0xd4]`)         |
 * | 0x6fb56680  | refresh: the switch on every object once the period differs from the cache   |
 *
 * The switch (0x6fad5280) reads the period with D2Common #11044 (period of the client act):
 * - Day (0): an object in mode 1 or 2 goes to mode 0 and takes the `Lit[0]` light; any other mode
 *   is left alone (returns 0).
 * - Dusk, Night, Dawn (1..3): an object in mode 0 goes to mode 1; the light is always set from
 *   `Lit[mode]` (returns 1).
 * - Any other period asserts.
 * A mode change also restarts the mode's animation and copies `Selectable[mode]` into unit flag 0x2;
 * every EnvEffect row has Selectable0..2 = 0, so the flag never changes.
 *
 * The refresh (0x6fb56680) compares the period with `[0x6fbd3420]`, a process-wide variable that
 * starts at Day and is never reset (not even between games). It runs from the 25 Hz frame
 * (0x6faf4a80) when #10135 reports a period change, and from the S2C 0x53 handler. The ClientFn
 * polls run earlier in the same frame (0x6faf4a93 → 0x6fb58110 → 0x6fadb1e0 → 0x6fad5b40).
 *
 * The light is unit state (unit+0x64, #827): the switch sets it through SetObjectLight 0x6fad4920
 * (`object-light.ts`), which allocates a new light at full radius, only moves the target radius of
 * an existing one (eased by the light-grid build) and frees it at once for `Lit` 0. Objects.txt
 * `Flicker` is not loaded by 1.13c (no binfield), so these lights never flicker.
 */

import { OBJECTS_TXT_113C, getObjectsTxtRecord113c } from '../../common/world/objects-txt-113c.ts'
import { PeriodOfDay } from '../../common/world/environment.ts'
import type { ClientUnit } from './client-unit.ts'
import { objectLitForMode, resetObjectAnim, setObjectLight } from './object-light.ts'

/** Objects.txt row of an object with `EnvEffect` = 1. */
export interface EnvEffectObjectDef {
  readonly classId: number
  /** Objects.txt Lit0..Lit7 (record +0x110). */
  readonly lit: readonly number[]
  /** Objects.txt Red / Green / Blue (record +0x164..+0x166). */
  readonly red: number
  readonly green: number
  readonly blue: number
  /** Objects.txt ClientFn (record +0x1b4). */
  readonly clientFn: number
}

/** Every Objects.txt record with `EnvEffect` set (record +0x139), from the generated 1.13c table. */
export const ENV_EFFECT_OBJECTS: ReadonlyMap<number, EnvEffectObjectDef> = new Map(
  OBJECTS_TXT_113C.flatMap((record, classId) =>
    record.envEffect !== 0
      ? [
          [
            classId,
            {
              classId,
              lit: record.lit,
              red: record.red,
              green: record.green,
              blue: record.blue,
              clientFn: record.clientFn,
            },
          ] as const,
        ]
      : [],
  ),
)

/** ClientFn whose poll (0x6fad53d0) re-runs the switch. */
export const ENV_EFFECT_POLL_CLIENT_FN = 14
/** `unit[0xd4] = GetTickCount() + 0x1f4` (0x6fad53ee). */
export const ENV_EFFECT_POLL_INTERVAL_MS = 500

/**
 * Mode the switch (0x6fad5280) moves an object in `mode` to, or `null` when it keeps the mode.
 *
 * @throws when `period` is not a period of day (the 1.13c switch asserts).
 */
export function envEffectTargetMode(mode: number, period: PeriodOfDay): 0 | 1 | null {
  switch (period) {
    case PeriodOfDay.Day:
      return mode === 1 || mode === 2 ? 0 : null
    case PeriodOfDay.Dusk:
    case PeriodOfDay.Night:
    case PeriodOfDay.Dawn:
      return mode === 0 ? 1 : null
    default:
      throw new RangeError(`EnvEffect switch: period ${String(period)} is not 0..3`)
  }
}

/**
 * Apply the switch (0x6fad5280) to one object. A mode change restarts the mode's animation
 * (#10595) as a cycling one (no one-shot timer: the EnvEffect modes are not operate animations).
 * When it acts, the light is set from `Lit[mode]` (0x6fad538c by day with mode 0, 0x6fad5311 in the
 * other periods, also without a mode change).
 *
 * @returns whether the switch acted (its return value).
 */
export function applyEnvEffect(unit: ClientUnit, period: PeriodOfDay, nowMs: number): boolean {
  if (!ENV_EFFECT_OBJECTS.has(unit.classId)) return false
  const target = envEffectTargetMode(unit.mode, period)
  if (target === null && period === PeriodOfDay.Day) return false
  const record = getObjectsTxtRecord113c(unit.classId)
  if (target !== null) {
    unit.mode = target
    unit.modeStartedAtMs = nowMs
    unit.animStartedAtMs = nowMs
    unit.modeElapsedMs = 0
    unit.modeUntilMs = undefined
    unit.modeDurationMs = undefined
    unit.animStepSpeed256 = undefined
    unit.animEffRate = undefined
    resetObjectAnim(unit, record)
  }
  setObjectLight(unit, record, objectLitForMode(record, unit.mode))
  return true
}

/**
 * Per-session EnvEffect state: the refresh cache `[0x6fbd3420]` and the ClientFn 14 deadlines
 * `unit[0xd4]`.
 */
export class EnvEffectController {
  /** `[0x6fbd3420]`: starts at Day and is never reset (it is process-wide in 1.13c). */
  private refreshedPeriodValue: PeriodOfDay = PeriodOfDay.Day
  /** `unit[0xd4]` of each object; a new unit starts at 0 (0x6fb57444). */
  private readonly nextPollMs = new WeakMap<ClientUnit, number>()

  /** The period the last refresh ran for. */
  get refreshedPeriod(): PeriodOfDay {
    return this.refreshedPeriodValue
  }

  /**
   * Object init (0x6fb57400 → 0x6fad5490) for an object the server just assigned (S2C 0x51 always
   * builds a new unit, so the poll deadline starts over).
   *
   * @returns whether the switch acted; when it did not, init sets the light from `Lit[mode]`
   *   itself (0x6fad561c → 0x6fad564e).
   */
  onObjectCreated(unit: ClientUnit, period: PeriodOfDay, nowMs: number): boolean {
    this.nextPollMs.delete(unit)
    return applyEnvEffect(unit, period, nowMs)
  }

  /** 0x6fb56680: run the switch on every object when `period` differs from the cache. */
  refresh(objects: Iterable<ClientUnit>, period: PeriodOfDay, nowMs: number): void {
    if (period === this.refreshedPeriodValue) return
    this.refreshedPeriodValue = period
    for (const unit of objects) applyEnvEffect(unit, period, nowMs)
  }

  /** ClientFn 14 (0x6fad53d0) for every object of the 25 Hz unit update (0x6fb58110). */
  poll(objects: Iterable<ClientUnit>, period: PeriodOfDay, nowMs: number): void {
    for (const unit of objects) {
      if (ENV_EFFECT_OBJECTS.get(unit.classId)?.clientFn !== ENV_EFFECT_POLL_CLIENT_FN) continue
      if (!(nowMs > (this.nextPollMs.get(unit) ?? 0))) continue
      applyEnvEffect(unit, period, nowMs)
      this.nextPollMs.set(unit, nowMs + ENV_EFFECT_POLL_INTERVAL_MS)
    }
  }
}
