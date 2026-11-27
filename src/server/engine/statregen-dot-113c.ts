/**
 * Diablo II: Lord of Destruction v1.13c per-frame `Event 3` (`EVENT_STATREGEN`) & `PLAYER_UpdateHpRegen`
 * life tick formulas and `d2oracle/1` `"dot"` trace observer (`kb/combat/d2game-statregen-dot-113c.md`).
 *
 * Authoritative binary evidence (`D2Game.dll` base `0x6FC20000`, `D2Common.dll` base `0x6FD50000`):
 * - `MONSTER_InitStats` (`0x6FCD00ED..0x6FCD011C`): sets monster base `stat 74` (`hpregen`) to
 *   `(maxHp256 * MonStats.DamageRegen) >> 12` (with 32-bit signed overflow guard `0x7fffffff / dmgRegen`).
 *   Summoned pets override base `stat 74 = 0` (`0x6FC669BE`).
 * - `D2Common.#10372` (`0x6FD83D80`): tests `sgptDataTables + 0x14C` (`pStateMasks[32]`, `States.txt`
 *   `life = 1` column -> states `2` `poison`, `52` `preventheal`, `62` `openwounds`).
 * - `MONSTER_Event3_HpRegen` (`0x6FC96740..0x6FC9698E`, `SetUnitStat` hook site `0x6FC9684A`):
 *   1. Reads accrued `stat 74`; if `#10372` is non-zero, subtracts base `stat 74` (`#10587`), suppressing
 *      innate `damageRegen` while keeping modifier `stat 74` (`-poisonBitrate256`, burning ground, etc.).
 *   2. If `STATE_PREVENTHEAL` (`52`) is active and effective `stat 74 >= 0`, returns without rescheduling.
 *   3. Reschedules `Event 3` at `dwGameFrame + 1`; if effective `stat 74 == 0`, deletes `Event 3` and returns.
 *   4. Town survival guard (`0x6FC967E6..0x6FC9680A`): if effective `stat 74 < 0`, `hp0 < 0x100` (`256`),
 *      and the unit has no room or `DUNGEON_IsRoomInTown` (`#10057`) != 0, returns without calling `SetUnitStat`.
 *   5. `hp1 = hp0 + effective74`; if `hp1 > maxHp256`, deletes `Event 3` and clamps `hp1 = maxHp256`;
 *      if `hp1 < 1`, clamps `hp1 = 0`. Writes `STATLIST_SetUnitStat(pUnit, 6, hp1, 0)` at `0x6FC9684A`;
 *      kills monster when `hp1 === 0` (`mode != 0 && mode != 12`).
 * - `PLAYER_UpdateHpRegen` (`0x6FC97CB0..0x6FC97D8E`, `SetUnitStat` hook site `0x6FC97D12`):
 *   Reads accrued `stat 74`; if `0`, returns without calling `SetUnitStat`. Otherwise `hp1 = hp0 + stat74`,
 *   clamping `hp1 > maxHp256` to `maxHp256` (clearing `STATE_HEALTHPOT` `100`) and `hp1 < 0x100` to `0x100` (`256`).
 */

/** One non-zero `STATLIST_SetUnitStat(u, 6, hp1, 0)` tick from `0x6FC9684A` or `0x6FC97D12`. */
export interface DotTraceEvent113c {
  readonly unitType: number
  readonly unitId: number
  readonly hp0: number
  readonly hp1: number
}

let dotTraceObserver113c: ((ev: DotTraceEvent113c) => void) | null = null

/** Install or clear an observer notified for every non-zero per-frame `stat 6` DoT / regen tick. */
export function setDotTraceObserver113c(
  observer: ((ev: DotTraceEvent113c) => void) | null,
): void {
  dotTraceObserver113c = observer
}

const event3SeqByHost113c = new WeakMap<object, number>()

/** Monotonic per-game sequence counter matching 1.13c's FIFO `EVENT_SetEvent(..., 3, frame)` bucket append (`0x6FCAEA80`). */
export function allocateEvent3Seq113c(host: object): number {
  const next = (event3SeqByHost113c.get(host) ?? 0) + 1
  event3SeqByHost113c.set(host, next)
  return next
}

/** Notify the active DoT trace observer when a per-frame `stat 6` write changed raw hitpoints (`hp1 !== hp0`). */
export function emitDotTraceEvent113c(ev: DotTraceEvent113c): void {
  if (dotTraceObserver113c !== null && ev.hp1 !== ev.hp0) {
    dotTraceObserver113c(ev)
  }
}

/**
 * `D2Common.#10372` (`0x6FD83D80`): `States.txt` rows with `life = 1` (`pStateMasks[32]` at `sgptDataTables + 0x14C`).
 * Active `poison` (`2`), `preventheal` (`52`), or `openwounds` (`62`) suppresses monster base `stat 74` (`damageRegen`).
 */
export const LIFE_MASK_STATE_IDS_113C = [2, 52, 62] as const

export function hasLifeMaskState113c(hasState: (stateId: number) => boolean): boolean {
  return hasState(2) || hasState(52) || hasState(62)
}

/**
 * `MONSTER_InitStats` (`D2Game.dll` `0x6FCD00ED..0x6FCD011C`) + `0x6FC669BE` (summoned pet override):
 * computes base `stat 74` (`hpregen`) in `1/256` HP/frame from `maxHp256` and `MonStats.DamageRegen`.
 */
export function computeMonsterBaseDamageRegen113c(
  maxHp256: number,
  damageRegen: number,
  isSummonedPet = false,
): number {
  if (isSummonedPet) return 0
  const maxHp = Math.trunc(maxHp256)
  const regen = Math.trunc(damageRegen)
  if (maxHp <= 0 || regen <= 0) return 0
  // 0x6FCD00F5..0x6FCD010E: `if (maxHp > 0x7fffffff / regen) return (maxHp >> 12) * regen; else return (maxHp * regen) >> 12`
  const overflowThreshold = Math.trunc(0x7fffffff / regen)
  if (maxHp > overflowThreshold) {
    return (maxHp >> 12) * regen
  }
  return Math.floor((maxHp * regen) / 4096)
}

export interface MonsterEvent3Input113c {
  readonly hp0: number
  readonly maxHp256: number
  readonly baseRegen256: number
  readonly modRegen256: number
  readonly hasLifeMaskState: boolean
  readonly hasPreventHeal: boolean
  readonly inTown: boolean
}

export interface MonsterEvent3Outcome113c {
  readonly hp1: number
  readonly effectiveRegen256: number
  readonly calledSetStat: boolean
  readonly changed: boolean
  readonly reschedule: boolean
  readonly clampedToMax: boolean
  readonly killed: boolean
}

/**
 * Pure 1.13c `MONSTER_Event3_HpRegen` (`D2Game.dll` `0x6FC96740..0x6FC9698E`) step.
 */
export function stepMonsterEvent3HpRegen113c(input: MonsterEvent3Input113c): MonsterEvent3Outcome113c {
  const hp0 = Math.trunc(input.hp0)
  const maxHp256 = Math.trunc(input.maxHp256)
  const baseRegen256 = Math.trunc(input.baseRegen256)
  const modRegen256 = Math.trunc(input.modRegen256)
  const accrued74 = baseRegen256 + modRegen256
  // 0x6FC9675B..0x6FC9676E: `#10372` life-mask state subtracts base `stat 74` (`#10587`).
  const effective74 = input.hasLifeMaskState ? accrued74 - baseRegen256 : accrued74

  // 0x6FC96770..0x6FC96782: `STATES_CheckState(u, 52)` (`preventheal`) with `ebx >= 0` returns before reschedule.
  if (input.hasPreventHeal && effective74 >= 0) {
    return {
      hp1: hp0,
      effectiveRegen256: effective74,
      calledSetStat: false,
      changed: false,
      reschedule: false,
      clampedToMax: false,
      killed: false,
    }
  }

  // 0x6FC9679D..0x6FC967D0: `ebx == 0` deletes `Event 3` and returns without `SetUnitStat`.
  if (effective74 === 0) {
    return {
      hp1: hp0,
      effectiveRegen256: 0,
      calledSetStat: false,
      changed: false,
      reschedule: false,
      clampedToMax: false,
      killed: false,
    }
  }

  // 0x6FC967E6..0x6FC9680A: negative `ebx` with `hp0 < 0x100` in town (`#10057`) returns after reschedule.
  if (effective74 < 0 && hp0 < 0x100 && input.inTown) {
    return {
      hp1: hp0,
      effectiveRegen256: effective74,
      calledSetStat: false,
      changed: false,
      reschedule: true,
      clampedToMax: false,
      killed: false,
    }
  }

  let hp1 = hp0 + effective74
  let reschedule = true
  let clampedToMax = false
  // 0x6FC96810..0x6FC9683B: `if (hp1 > maxHp256) { EVENT_DeleteTimers(u, 3); hp1 = maxHp256; }`
  if (hp1 > maxHp256) {
    hp1 = maxHp256
    reschedule = false
    clampedToMax = true
  }
  // 0x6FC9683D..0x6FC96842: `if (hp1 < 1) hp1 = 0;`
  if (hp1 < 1) {
    hp1 = 0
  }

  return {
    hp1,
    effectiveRegen256: effective74,
    calledSetStat: true,
    changed: hp1 !== hp0,
    reschedule,
    clampedToMax,
    killed: hp1 === 0,
  }
}

export interface PlayerHpRegenInput113c {
  readonly hp0: number
  readonly maxHp256: number
  readonly hpRegen256: number
}

export interface PlayerHpRegenOutcome113c {
  readonly hp1: number
  readonly calledSetStat: boolean
  readonly changed: boolean
  readonly clearHealthPot: boolean
}

/**
 * Pure 1.13c `PLAYER_UpdateHpRegen` (`D2Game.dll` `0x6FC97CB0..0x6FC97D8E`) step.
 */
export function stepPlayerUpdateHpRegen113c(input: PlayerHpRegenInput113c): PlayerHpRegenOutcome113c {
  const hp0 = Math.trunc(input.hp0)
  const maxHp256 = Math.trunc(input.maxHp256)
  const hpRegen256 = Math.trunc(input.hpRegen256)
  // 0x6FC97CC1..0x6FC97CC3: `if (ebx == 0) return;`
  if (hpRegen256 === 0) {
    return {
      hp1: hp0,
      calledSetStat: false,
      changed: false,
      clearHealthPot: false,
    }
  }
  let hp1 = hp0 + hpRegen256
  let clearHealthPot = false
  // 0x6FC97CDE..0x6FC97CFF: `if (hp1 > maxHp256) { hp1 = maxHp256; clear state 100; }`
  if (hp1 > maxHp256) {
    hp1 = maxHp256
    clearHealthPot = true
  }
  // 0x6FC97CFF..0x6FC97D0C: `if (hp1 < 0x100) hp1 = 0x100;`
  if (hp1 < 0x100) {
    hp1 = 0x100
  }
  return {
    hp1,
    calledSetStat: true,
    changed: hp1 !== hp0,
    clearHealthPot,
  }
}
