/**
 * Diablo II v1.13c act environment clock — D2Common.dll `D2DrlgEnvironmentStrc` (0x38 bytes at pAct+4).
 *
 * Bit-exact port of the D2Common functions the 1.13c client runs (every VA below was checked in the
 * 1.13c disassembly; see docs/environment_daynight_113c.md):
 *
 * | VA / ordinal          | Function                     | Client call site                                  |
 * |-----------------------|------------------------------|---------------------------------------------------|
 * | 0x6fd87ba0            | ENVIRONMENT_Alloc            | client act allocation (S2C 0x03 LoadAct)          |
 * | #10135 0x6fd87af0     | UpdatePeriodOfDay            | 25 Hz frame 0x6faf4a80 @0x6faf4afe (indoors too)  |
 * | #10358 0x6fd87920     | InitializeEnvironment        | S2C 0x53 handler 0x6fb5e9c0                       |
 * | 0x6fd87570            | UpdateTicks                  |                                                   |
 * | 0x6fd876f0            | UpdateLightIntensity         |                                                   |
 * | 0x6fd871c0            | UpdateLightColor             |                                                   |
 * | 0x6fd87170            | snap ticks to the cycle row  | eclipse branch of InitializeEnvironment           |
 *
 * Cycle tables (D2Common .data, 12-byte rows `{u32 begin°, u32 period, u8 r, u8 g, u8 b, pad}`):
 * normal 0x6fdeb160, Act IV 0x6fdeb1a8, eclipse 0x6fdeb1f0. The time rate comes from 0x6fdeb238
 * indexed by `rateIndex` (+0x2C); the client never receives a rate index, so it is always 128.
 *
 * Quirks that are kept on purpose (they are what 1.13c does):
 * - The clock belongs to the act, not to the level: it also advances inside caves and dungeons.
 * - A cycle advances when `ticks > nextBegin * rate` and ticks snap to `rate * begin` of the row the
 *   cycle lands on (taken from the normal or eclipse table even in Act IV), so the 340° "morning" row
 *   lasts exactly one frame and sunrise jumps from warm (I=106) to white (I=128).
 * - Night adds +1 tick per frame (+8 more in Act III); Act IV always adds +15 (non-eclipse).
 * - Colour interpolation uses an unclamped ratio and wraps each channel to a byte.
 * - InitializeEnvironment computes the intensity once before storing the eclipse flag, and the
 *   non-eclipse path does not recompute the colour (the next frame does).
 */

import { DRLG_GetActNoFromLevelId } from '../drlg/drlg-drlg.ts'

/** Ticks per degree: `gnTimeRates[0]` (D2Common 0x6fdeb238). The client always uses index 0. */
export const ENV_TIME_RATE = 128
/** Number of rows in each environment cycle table. */
export const NUM_ENVIRONMENT_CYCLES = 6

/** `D2DrlgEnvironmentStrc.period` (+0x04) values stored in the cycle tables. */
export enum PeriodOfDay {
  Day = 0,
  Dusk = 1,
  Night = 2,
  Dawn = 3,
}

/** Row index into the normal cycle table (`D2DrlgEnvironmentStrc.cycleIndex`, +0x00). */
export enum EnvCycleIndex {
  /** 320° dawn (cold blue). */
  Sunrise = 0,
  /** 340° dawn (warm gold); lasts one frame. */
  Morning = 1,
  /** 0° day. */
  Noon = 2,
  /** 160° dusk. */
  Afternoon = 3,
  /** 180° dusk (purple). */
  Sunset = 4,
  /** 200° night. */
  Night = 5,
}

export interface EnvCycleDef {
  /** Row start in degrees (`* rate` gives ticks). */
  readonly ticksBegin: number
  readonly period: PeriodOfDay
  readonly red: number
  readonly green: number
  readonly blue: number
}

/** Normal cycle table, D2Common 0x6fdeb160. */
export const NORMAL_ENV_CYCLES: readonly EnvCycleDef[] = [
  { ticksBegin: 320, period: PeriodOfDay.Dawn, red: 125, green: 144, blue: 243 },
  { ticksBegin: 340, period: PeriodOfDay.Dawn, red: 208, green: 184, blue: 131 },
  { ticksBegin: 0, period: PeriodOfDay.Day, red: 255, green: 255, blue: 255 },
  { ticksBegin: 160, period: PeriodOfDay.Dusk, red: 255, green: 255, blue: 255 },
  { ticksBegin: 180, period: PeriodOfDay.Dusk, red: 194, green: 152, blue: 193 },
  { ticksBegin: 200, period: PeriodOfDay.Night, red: 125, green: 144, blue: 243 },
]

/** Act IV cycle table, D2Common 0x6fdeb1a8 (colours only, plus the eclipse next-row lookup). */
export const ACT4_ENV_CYCLES: readonly EnvCycleDef[] = [
  { ticksBegin: 340, period: PeriodOfDay.Dawn, red: 243, green: 70, blue: 243 },
  { ticksBegin: 350, period: PeriodOfDay.Dawn, red: 208, green: 184, blue: 131 },
  { ticksBegin: 0, period: PeriodOfDay.Day, red: 255, green: 20, blue: 20 },
  { ticksBegin: 180, period: PeriodOfDay.Dusk, red: 255, green: 255, blue: 30 },
  { ticksBegin: 190, period: PeriodOfDay.Dusk, red: 20, green: 152, blue: 193 },
  { ticksBegin: 200, period: PeriodOfDay.Night, red: 125, green: 144, blue: 243 },
]

/** Eclipse (Tainted Sun) cycle table, D2Common 0x6fdeb1f0. */
export const ECLIPSE_ENV_CYCLES: readonly EnvCycleDef[] = [
  { ticksBegin: 300, period: PeriodOfDay.Dawn, red: 0, green: 30, blue: 243 },
  { ticksBegin: 0, period: PeriodOfDay.Day, red: 0, green: 30, blue: 244 },
  { ticksBegin: 60, period: PeriodOfDay.Dusk, red: 0, green: 30, blue: 243 },
  { ticksBegin: 120, period: PeriodOfDay.Night, red: 0, green: 30, blue: 243 },
  { ticksBegin: 180, period: PeriodOfDay.Night, red: 0, green: 30, blue: 244 },
  { ticksBegin: 240, period: PeriodOfDay.Night, red: 0, green: 30, blue: 243 },
]

/** `(double)(float)π`, D2Common 0x6fde6f28. */
const PI_F = 3.1415927410125732
/** `1.0 / 180.0`, D2Common 0x6fde6f30. */
const INV_180 = 1 / 180
/** Act IV intensity targets (jump table at 0x6fd87824; every other Act IV level aims at 16). */
const ACT4_INTENSITY_TARGET: Readonly<Record<number, number>> = { 103: 128, 104: 64, 105: 56, 106: 48 }
const ACT4_DEFAULT_TARGET = 16
/** Arreat Summit: fixed intensity 200 (0x6fd8775d) and colour (245, 240, 255) (0x6fd87a10). */
const LEVEL_ARREAT_SUMMIT = 120
/** 0-based act numbers as returned by `DRLG_GetActNoFromLevelId` (D2Common 0x6fd7d2c0). */
const ACT_III = 2
const ACT_IV = 3
const ACT_V = 4

/**
 * One act environment clock. Create it with {@link Environment.alloc}, the way the client allocates
 * a fresh one with every client act (S2C 0x03).
 */
export class Environment {
  /** +0x00 */
  cycleIndex = 0
  /** +0x04 */
  period: PeriodOfDay = PeriodOfDay.Day
  /** +0x08 */
  ticks = 0
  /** +0x0C */
  intensity = 0
  /** +0x18..+0x1A */
  red = 0
  green = 0
  blue = 0
  /** +0x1C / +0x20 / +0x24 (f32) */
  fCos = 0
  fLast = 0
  fSin = 0
  /** +0x28: `gnTimeRates[rateIndex]` with rateIndex 0. */
  readonly rate = ENV_TIME_RATE
  /** +0x30 */
  eclipse = false

  private constructor() {}

  /** ENVIRONMENT_Alloc (0x6fd87ba0): noon, ticks 0, intensity 128, white light. */
  static alloc(): Environment {
    const env = new Environment()
    env.cycleIndex = EnvCycleIndex.Noon
    const row = NORMAL_ENV_CYCLES[EnvCycleIndex.Noon]!
    env.period = row.period
    env.ticks = env.rate * row.ticksBegin
    env.updateLightIntensity(0, 0)
    env.updateLightColor(0)
    env.eclipse = false
    return env
  }

  /**
   * #10135 ENVIRONMENT_UpdatePeriodOfDay (0x6fd87af0), called once per 25 Hz client frame with the
   * player's room. `levelId` is that room's level (0 when the player has no room).
   *
   * @returns whether the period of day changed (the client then refreshes EnvEffect objects).
   */
  updatePeriodOfDay(levelId: number): boolean {
    const act = DRLG_GetActNoFromLevelId(levelId)
    const previous = this.period
    this.updateTicks(act)
    this.updateLightIntensity(levelId, act)
    this.updateLightColor(act)
    if (levelId === LEVEL_ARREAT_SUMMIT) this.setArreatSummitColor()
    return this.period !== previous
  }

  /**
   * #10358 ENVIRONMENT_InitializeEnvironment (0x6fd87920), applied by the S2C 0x53 handler with the
   * player's room. `levelId` is that room's level (0 when the player has no room).
   */
  initialize(levelId: number, cycleIndex: number, ticks: number, eclipse: boolean): void {
    if (!Number.isInteger(cycleIndex) || cycleIndex < 0 || cycleIndex >= NUM_ENVIRONMENT_CYCLES) {
      throw new RangeError(`InitializeEnvironment: cycle index ${String(cycleIndex)} out of 0..5`)
    }
    if (!Number.isInteger(ticks) || ticks < 0) {
      throw new RangeError(`InitializeEnvironment: negative tick count ${String(ticks)}`)
    }
    this.cycleIndex = cycleIndex
    this.ticks = ticks > 360 * this.rate ? 0 : ticks
    this.period = (eclipse ? ECLIPSE_ENV_CYCLES : NORMAL_ENV_CYCLES)[cycleIndex]!.period
    const act = DRLG_GetActNoFromLevelId(levelId)
    // 0x6fd879e6: the first intensity update runs before the eclipse flag is stored.
    this.updateLightIntensity(levelId, act)
    this.eclipse = eclipse
    if (eclipse) {
      this.snapToCycleBegin()
      this.updateLightIntensity(levelId, act)
      this.updateLightColor(act)
    }
    if (levelId === LEVEL_ARREAT_SUMMIT) this.setArreatSummitColor()
  }

  /** ENVIRONMENT_UpdateTicks (0x6fd87570); `act` is 0-based. */
  private updateTicks(act: number): void {
    this.ticks += 1
    if (!this.eclipse) {
      if (act === ACT_IV) {
        this.ticks += 15
      } else if (NORMAL_ENV_CYCLES[this.cycleIndex]!.period === PeriodOfDay.Night) {
        this.ticks += 1
        if (act === ACT_III) this.ticks += 8
      }
    }
    if (this.ticks >= 360 * this.rate) this.ticks = 0

    const next = this.cycleIndex + 1 >= NUM_ENVIRONMENT_CYCLES ? 0 : this.cycleIndex + 1
    const nextTable = !this.eclipse ? NORMAL_ENV_CYCLES : act === ACT_IV ? ACT4_ENV_CYCLES : ECLIPSE_ENV_CYCLES
    if (this.ticks > nextTable[next]!.ticksBegin * this.rate) {
      this.cycleIndex = next
      const row = (this.eclipse ? ECLIPSE_ENV_CYCLES : NORMAL_ENV_CYCLES)[next]!
      this.period = row.period
      this.ticks = row.ticksBegin * this.rate
    }
  }

  /** ENVIRONMENT_UpdateLightIntensity (0x6fd876f0); `act` is 0-based. */
  private updateLightIntensity(levelId: number, act: number): void {
    if (act === ACT_IV) {
      const target = ACT4_INTENSITY_TARGET[levelId] ?? ACT4_DEFAULT_TARGET
      if (this.intensity < target) this.intensity += 1
      if (this.intensity > target) this.intensity -= 1
      if (this.intensity === 0) this.intensity = target
      return
    }
    if (this.eclipse) {
      if (this.intensity > 32) this.intensity -= 8
      if (this.intensity < 32) this.intensity = 32
      return
    }
    if (levelId === LEVEL_ARREAT_SUMMIT) {
      this.intensity = 200
      return
    }
    const angle = (this.ticks / this.rate) * INV_180 * PI_F
    this.fCos = Math.fround(-Math.cos(angle))
    this.fSin = Math.fround(Math.sin(angle) * (this.ticks >= 180 * this.rate ? 0.5 : 1))
    this.fLast = 0
    const raw = Math.trunc(this.fSin * 128 + 128 + 0.5)
    const cap = act === ACT_V ? 170 : 255
    this.intensity = Math.min(Math.max(raw, 0), cap)
  }

  /** ENVIRONMENT_UpdateLightColor (0x6fd871c0): unclamped ratio, byte-wrapped channels (G, B, R order). */
  private updateLightColor(act: number): void {
    const table = act === ACT_IV ? ACT4_ENV_CYCLES : this.eclipse ? ECLIPSE_ENV_CYCLES : NORMAL_ENV_CYCLES
    const next = this.cycleIndex + 1 === NUM_ENVIRONMENT_CYCLES ? 0 : this.cycleIndex + 1
    const cur = table[this.cycleIndex]!
    const nxt = table[next]!
    const curBegin = this.rate * cur.ticksBegin
    const span = this.rate * nxt.ticksBegin - curBegin
    if (span === 0) throw new Error(`UpdateLightColor: zero-length cycle row ${String(this.cycleIndex)}`)
    const ratio = (this.ticks - curBegin) / span
    const lerp = (from: number, to: number): number => (from + Math.trunc((to - from) * ratio + 0.5)) & 0xff
    this.green = lerp(cur.green, nxt.green)
    this.blue = lerp(cur.blue, nxt.blue)
    this.red = lerp(cur.red, nxt.red)
  }

  /** 0x6fd87170: ticks and period from the current row (eclipse table when the eclipse flag is set). */
  private snapToCycleBegin(): void {
    const row = (this.eclipse ? ECLIPSE_ENV_CYCLES : NORMAL_ENV_CYCLES)[this.cycleIndex]!
    this.period = row.period
    this.ticks = this.rate * row.ticksBegin
  }

  private setArreatSummitColor(): void {
    this.red = 245
    this.green = 240
    this.blue = 255
  }
}
