/**
 * Diablo II v1.13c Monster Event Dispatch (`0x6FC969A0`), Mode Tables (`0x6FD1A498` / `0x6FD1BC50`),
 * `SUNIT_IsDeadOrDying` (`0x6FCFFA90`), Null-Handler Fallback (`0x6FC950F0` -> `0x6FC94E60`),
 * Two-Pass `MONSTER_ClearModeEvents` (`0x6FD00750`), and Continuous Mode Registration (`0x6FD00B40`).
 *
 * Binary evidence: `kb/monsters/d2game-monster-events-113c.md`.
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2AiGeneralStrc,
  D2EventStrc,
  D2GameStrc,
  D2MonsterDataStrc,
  D2TimerStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  STATLIST_ExpireStateListsOnModeChange113c,
  STATES_CheckState113c,
} from '../common/statlist.ts'
import {
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITROOM_RefreshUnit113c,
  UNITS_UpdateAnimFrame113c,
} from '../common/unit.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { SKILLS_SetUsedSkillMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FLAG_DEFERRED_FREE,
  EVENT_FLAG_FIRING,
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_SetEventFull113c,
  EVENT_SetPersistentEventFull113c,
  type EventDispatchCallback113c,
} from './timer-wheel.ts'
import { hitD2CommonVa113c, hitD2GameVa113c } from '../va-trace-113c.ts'

export const MON_EVENT_MODE_STEP = 0
export const MON_EVENT_MODE_END = 1
export const MON_EVENT_AI_THINK = 2
export const MON_EVENT_STAT_REGEN = 3

export const UNITFLAG_DEAD_113C = 0x00010000
export const STATE_STUNNED_113C = 0x15

/**
 * `D2Game 0x6FD1BC14[0..14]` monster event handler VA table (`D2Game.dll` base `0x6FC20000`).
 */
export const MONSTER_EVENT_HANDLER_VAS_113C: readonly number[] = [
  0x6fc952e0, // 0: MONSTER_Event0_ModeStep
  0x6fc952a0, // 1: MONSTER_Event1_ModeEnd
  0x6fcbd3b0, // 2: AI_RunMonsterAI
  0x6fc96740, // 3: MONSTER_Event3_HpRegen
  0x00000000, // 4: NULL
  0x6fcbe8e0, // 5: MONSTER_Event5_Timed
  0x6fc96570, // 6: MONSTER_Event6_UnsummonOrExpire
  0x6fc469b0, // 7: MONSTER_Event7_ConvertEnd
  0x6fcc1e80, // 8: MONSTER_Event8_AuraPulse
  0x6fcc37d0, // 9: MONSTER_Event9_BossEvent
  0x6fc94e40, // 10: MONSTER_Event10_Timed
  0x00000000, // 11: NULL
  0x6fc94870, // 12: MONSTER_Event12_Destroy
  0x00000000, // 13: NULL
  0x00000000, // 14: NULL
]

/**
 * Bitmask of `nEventType` (`0..14`) that bypass `STATE_FREEZE` (`state 1`) in `0x6FC969A0`
 * (`0x6FC969F8` + `0x6FC96A00[nEventType - 3] == 0`): `{3, 4, 5, 8, 12}`.
 */
export const MONSTER_EVENT_FREEZE_BYPASS_MASK_113C =
  (1 << 3) | (1 << 4) | (1 << 5) | (1 << 8) | (1 << 12)

export interface MonsterModeEntry113c {
  readonly mode: number
  readonly pfnStart: number
  readonly pfnStep: number
  readonly pfnEnd: number
  readonly scheduleEvents: number
}

/**
 * `D2Game 0x6FD1A498[0..15]` base monster mode table (`16` bytes per entry:
 * `{pfnStart, pfnStep, pfnEnd, bScheduleEvents}`), verified via `objdump -s 0x6fd1a498`.
 */
export const MONSTER_MODE_TABLE_113C: readonly MonsterModeEntry113c[] = [
  { mode: 0, pfnStart: 0x6fc96270, pfnStep: 0x6fc959f0, pfnEnd: 0x6fc96040, scheduleEvents: 1 }, // DT
  { mode: 1, pfnStart: 0x6fc94e60, pfnStep: 0x6fc95320, pfnEnd: 0x00000000, scheduleEvents: 0 }, // NU
  { mode: 2, pfnStart: 0x6fc94c60, pfnStep: 0x6fc97010, pfnEnd: 0x00000000, scheduleEvents: 1 }, // WL
  { mode: 3, pfnStart: 0x6fc95210, pfnStep: 0x6fc95320, pfnEnd: 0x6fc96bf0, scheduleEvents: 1 }, // GH
  { mode: 4, pfnStart: 0x6fc95510, pfnStep: 0x6fc95ce0, pfnEnd: 0x6fc96bf0, scheduleEvents: 1 }, // A1
  { mode: 5, pfnStart: 0x6fc95510, pfnStep: 0x6fc95ce0, pfnEnd: 0x6fc96bf0, scheduleEvents: 1 }, // A2
  { mode: 6, pfnStart: 0x6fc94c10, pfnStep: 0x6fc95320, pfnEnd: 0x6fc96bf0, scheduleEvents: 1 }, // BL
  { mode: 7, pfnStart: 0x6fc95510, pfnStep: 0x6fc95ce0, pfnEnd: 0x6fc96bf0, scheduleEvents: 1 }, // SC
  { mode: 8, pfnStart: 0x6fc95510, pfnStep: 0x6fc95ce0, pfnEnd: 0x6fc96bf0, scheduleEvents: 1 }, // S1
  { mode: 9, pfnStart: 0x6fc95510, pfnStep: 0x6fc95ce0, pfnEnd: 0x6fc96bf0, scheduleEvents: 1 }, // S2
  { mode: 10, pfnStart: 0x6fc94c90, pfnStep: 0x6fc959b0, pfnEnd: 0x6fc94890, scheduleEvents: 0 }, // S3
  { mode: 11, pfnStart: 0x6fc96700, pfnStep: 0x6fc95320, pfnEnd: 0x00000000, scheduleEvents: 0 }, // S4
  { mode: 12, pfnStart: 0x6fc95460, pfnStep: 0x6fc95320, pfnEnd: 0x00000000, scheduleEvents: 0 }, // DD
  { mode: 13, pfnStart: 0x6fc95160, pfnStep: 0x6fc96a10, pfnEnd: 0x6fc965e0, scheduleEvents: 1 }, // KB
  { mode: 14, pfnStart: 0x6fc954E0, pfnStep: 0x6fc96f20, pfnEnd: 0x6fc96bf0, scheduleEvents: 1 }, // SQ
  { mode: 15, pfnStart: 0x6fc94c30, pfnStep: 0x6fc96fe0, pfnEnd: 0x00000000, scheduleEvents: 1 }, // RN
]

/**
 * `MonStats.bin + 0x1A5` (`SplGetModeChart`, 20 rows out of 734 in official 1.13c `monstats.bin`).
 * Checked at `0x6FC949E7: mov al, [edx + 0x1A5]; test al, al; je base_table`.
 */
export const SPL_GET_MODE_CHART_HCIDX_SET_113C: ReadonlySet<number> = new Set<number>([
  243, 333, 403, 404, 417, 418, 543, 544, 546, 547, 548, 549, 550, 559, 570, 571, 572, 573, 705, 709,
])

// 0x6FD1A598: Diablo (243, 333, 705) mode 11 (S4)
const SPECIAL_MODE_DIABLO_S4: MonsterModeEntry113c = {
  mode: 11,
  pfnStart: 0x6fc95510,
  pfnStep: 0x6fc95ce0,
  pfnEnd: 0x6fc96bf0,
  scheduleEvents: 1,
}
// 0x6FD1A5A8: Diablo (243, 333, 705) mode 10 (S3)
const SPECIAL_MODE_DIABLO_S3: MonsterModeEntry113c = {
  mode: 10,
  pfnStart: 0x6fc95510,
  pfnStep: 0x6fc95ce0,
  pfnEnd: 0x6fc96bf0,
  scheduleEvents: 1,
}
// 0x6FD1A5B8: TrappedSoul1 (403) modes 4 (A1) & 5 (A2)
const SPECIAL_MODE_403_A1: MonsterModeEntry113c = {
  mode: 4,
  pfnStart: 0x6fc95510,
  pfnStep: 0x6fc95ce0,
  pfnEnd: 0x6fc96b20,
  scheduleEvents: 1,
}
const SPECIAL_MODE_403_A2: MonsterModeEntry113c = {
  mode: 5,
  pfnStart: 0x6fc95510,
  pfnStep: 0x6fc95ce0,
  pfnEnd: 0x6fc96b20,
  scheduleEvents: 1,
}
// 0x6FD1A5C8: TrappedSoul1 (403) modes 8 (S1) & 9 (S2)
const SPECIAL_MODE_403_S1: MonsterModeEntry113c = {
  mode: 8,
  pfnStart: 0x6fc95510,
  pfnStep: 0x6fc95ce0,
  pfnEnd: 0x6fc96a50,
  scheduleEvents: 1,
}
const SPECIAL_MODE_403_S2: MonsterModeEntry113c = {
  mode: 9,
  pfnStart: 0x6fc95510,
  pfnStep: 0x6fc95ce0,
  pfnEnd: 0x6fc96a50,
  scheduleEvents: 1,
}
// 0x6FD1A5D8: ShadowWarrior/Master (417, 418) mode 11 (S4)
const SPECIAL_MODE_SHADOW_S4: MonsterModeEntry113c = {
  mode: 11,
  pfnStart: 0x6fc95510,
  pfnStep: 0x6fc95ce0,
  pfnEnd: 0x6fc96bf0,
  scheduleEvents: 1,
}
// 0x6FD1A508: Baal (543, 544, 570, 709) mode 10 (S3)
const SPECIAL_MODE_BAAL_S3: MonsterModeEntry113c = {
  mode: 10,
  pfnStart: 0x6fc95510,
  pfnStep: 0x6fc95ce0,
  pfnEnd: 0x6fc96bf0,
  scheduleEvents: 1,
}

export interface ContinuousModeRule113c {
  readonly alwaysTrue: number
  readonly alwaysFalse: number
  readonly checkMonStats2MoveBit: number
}

/**
 * `D2Game 0x6FD1BC50[0..15]` 12-byte (`3 * uint32`) continuous-mode dispatch table:
 * - `+0x00 alwaysTrue == 1`: `{2 WL, 13 KB, 14 SQ, 15 RN}` -> returns `true`
 * - `+0x04 alwaysFalse == 1`: `{0 DT, 1 NU, 3 GH, 6 BL, 12 DD}` -> returns `false`
 * - `+0x08 checkMonStats2MoveBit == 1`: `{4 A1, 5 A2, 7 SC, 8 S1, 9 S2, 10 S3, 11 S4}` ->
 *   reads `MonStats2[MonStats[hcIdx].wMonStatsEx].wMoveFlags (+0x104) & (1 << mode)`.
 */
export const MONSTER_CONTINUOUS_MODE_TABLE_113C: readonly ContinuousModeRule113c[] = [
  { alwaysTrue: 0, alwaysFalse: 1, checkMonStats2MoveBit: 0 }, // 0: DT
  { alwaysTrue: 0, alwaysFalse: 1, checkMonStats2MoveBit: 0 }, // 1: NU
  { alwaysTrue: 1, alwaysFalse: 0, checkMonStats2MoveBit: 0 }, // 2: WL
  { alwaysTrue: 0, alwaysFalse: 1, checkMonStats2MoveBit: 0 }, // 3: GH
  { alwaysTrue: 0, alwaysFalse: 0, checkMonStats2MoveBit: 1 }, // 4: A1
  { alwaysTrue: 0, alwaysFalse: 0, checkMonStats2MoveBit: 1 }, // 5: A2
  { alwaysTrue: 0, alwaysFalse: 1, checkMonStats2MoveBit: 0 }, // 6: BL
  { alwaysTrue: 0, alwaysFalse: 0, checkMonStats2MoveBit: 1 }, // 7: SC
  { alwaysTrue: 0, alwaysFalse: 0, checkMonStats2MoveBit: 1 }, // 8: S1
  { alwaysTrue: 0, alwaysFalse: 0, checkMonStats2MoveBit: 1 }, // 9: S2
  { alwaysTrue: 0, alwaysFalse: 0, checkMonStats2MoveBit: 1 }, // 10: S3
  { alwaysTrue: 0, alwaysFalse: 0, checkMonStats2MoveBit: 1 }, // 11: S4
  { alwaysTrue: 0, alwaysFalse: 1, checkMonStats2MoveBit: 0 }, // 12: DD
  { alwaysTrue: 1, alwaysFalse: 0, checkMonStats2MoveBit: 0 }, // 13: KB
  { alwaysTrue: 1, alwaysFalse: 0, checkMonStats2MoveBit: 0 }, // 14: SQ
  { alwaysTrue: 1, alwaysFalse: 0, checkMonStats2MoveBit: 0 }, // 15: RN
]

/**
 * Exact `MonStats2.bin + 0x104` (`wMoveFlags`: `A1mv=1<<4`, `A2mv=1<<5`, `SCmv=1<<7`, `S1mv=1<<8`,
 * `S2mv=1<<9`, `S3mv=1<<10`, `S4mv=1<<11`) indexed by `MonStats.hcIdx` (`30` non-zero rows out of `734`
 * in official 1.13c `monstats.bin` + `monstats2.bin`).
 */
export const MONSTATS2_MOVE_FLAGS_BY_HCIDX_113C: ReadonlyMap<number, number> = new Map<number, number>([
  [110, 0x0300], // vulture1: S1mv | S2mv
  [111, 0x0300], // vulture2
  [112, 0x0300], // vulture3
  [113, 0x0300], // vulture4
  [149, 0x0100], // anubisguard4 (carrionbird): S1mv
  [157, 0x0100], // batdemon1: S1mv
  [158, 0x0100], // batdemon2
  [159, 0x0100], // batdemon3
  [244, 0x0020], // maggot1: A2mv
  [245, 0x0020], // maggot2
  [246, 0x0020], // maggot3
  [251, 0x0020], // sandleaper1: A2mv
  [252, 0x0020], // sandleaper2
  [253, 0x0020], // sandleaper3
  [254, 0x0020], // sandleaper4
  [255, 0x0020], // sandleaper5
  [256, 0x0020], // scarab1: A2mv
  [257, 0x0020], // scarab2
  [264, 0x0020], // maggot4
  [265, 0x0020], // maggot5
  [268, 0x0100], // vulture5: S1mv
  [283, 0x0100], // batdemon4: S1mv
  [297, 0x0020], // scarab3: A2mv
  [367, 0x0020], // tyrael1: A2mv
  [520, 0x0020], // snowdrifter1: A2mv
  [521, 0x0020], // snowdrifter2
  [527, 0x0020], // snowdrifter3
  [556, 0x0100], // batdemon5: S1mv
  [608, 0x0300], // vulture6: S1mv | S2mv
  [706, 0x0020], // uberduriel: A2mv
])

/**
 * `D2Game 0x6FD2F14C[0..15]` inline-AI-on-mode-end flags (`1` ONLY for `2 WL` and `15 RN`).
 * Used by `0x6FC96BF0` (`MONSTER_EndToAiOrNeutral`) to transition directly `dwAnimMode = 1`
 * without `MONSTER_ClearModeEvents` and immediately invoke `AI_RunMonsterAI` (`0x6FCBD3B0`).
 */
export const MONSTER_INLINE_AI_ON_END_TABLE_113C: readonly number[] = [
  0, // 0: DT
  0, // 1: NU
  1, // 2: WL
  0, // 3: GH
  0, // 4: A1
  0, // 5: A2
  0, // 6: BL
  0, // 7: SC
  0, // 8: S1
  0, // 9: S2
  0, // 10: S3
  0, // 11: S4
  0, // 12: DD
  0, // 13: KB
  0, // 14: SQ
  1, // 15: RN
]

const D2GAME_IAT_SGPT_DATATABLES_SLOT = 0x6fd1829c

/** `@va D2Game:0x6FC949A0` (`MONSTER_GetModeEntry`, `ecx = pUnit`, `eax = nMode`). */
export function MONSTER_GetModeEntry113c(
  m: Memory113c,
  pUnit: number,
  mode: number,
): MonsterModeEntry113c | null {
  hitD2GameVa113c(0x6FC949A0)
  if (pUnit === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) {
    return null
  }
  const classId = m.get(pUnit, D2UnitStrc.dwClassId) | 0
  const modeSigned = mode | 0

  const sgptPtr = safeReadU32MonEvt113c(m, D2GAME_IAT_SGPT_DATATABLES_SLOT)
  const sgpt = sgptPtr !== 0 ? safeReadU32MonEvt113c(m, sgptPtr) : 0
  let useSpecial = false
  if (sgpt !== 0) {
    const count = m.u32((sgpt + 0xa80) >>> 0) | 0
    const pMonStatsBase = m.u32((sgpt + 0xa78) >>> 0) >>> 0
    if (classId < 0 || classId >= count) {
      return null
    }
    const pMonStats = (pMonStatsBase + Math.imul(classId, 0x1a8)) >>> 0
    if (pMonStats === 0) {
      return null
    }
    if (modeSigned < 0 || modeSigned >= 16) {
      return null
    }
    // `0x6FC949E7: mov bl, byte ptr [ecx + 0x1A5]; test bl, bl; je base_table` (`SplGetModeChart`)
    useSpecial = m.u8((pMonStats + 0x1a5) >>> 0) !== 0
  } else {
    if (classId < 0 || classId >= 734) {
      return null
    }
    if (modeSigned < 0 || modeSigned >= 16) {
      return null
    }
    useSpecial = SPL_GET_MODE_CHART_HCIDX_SET_113C.has(classId)
  }

  if (useSpecial) {
    if (classId === 243 || classId === 333 || classId === 705) {
      if (modeSigned === 11) return SPECIAL_MODE_DIABLO_S4
      if (modeSigned === 10) return SPECIAL_MODE_DIABLO_S3
    } else if (classId === 403) {
      if (modeSigned === 4) return SPECIAL_MODE_403_A1
      if (modeSigned === 5) return SPECIAL_MODE_403_A2
      if (modeSigned === 8) return SPECIAL_MODE_403_S1
      if (modeSigned === 9) return SPECIAL_MODE_403_S2
    } else if (classId === 417 || classId === 418) {
      if (modeSigned === 11) return SPECIAL_MODE_SHADOW_S4
    } else if (classId === 543 || classId === 544 || classId === 570 || classId === 709) {
      if (modeSigned === 10) return SPECIAL_MODE_BAAL_S3
    }
  }

  const baseEntry = MONSTER_MODE_TABLE_113C[modeSigned]
  if (baseEntry === undefined) {
    throw new RangeError(`MONSTER_GetModeEntry113c: missing base mode table entry for mode=${mode}`)
  }
  return baseEntry
}

/** Returns the raw `0x6FD1A498..0x6FD1A5D8` `.rdata` table pointer VA returned by `MONSTER_GetModeEntry`. */
export function MONSTER_GetModeEntryVa113c(
  m: Memory113c,
  pUnit: number,
  mode: number,
): number {
  const entry = MONSTER_GetModeEntry113c(m, pUnit, mode)
  if (entry === null) return 0
  if (entry === SPECIAL_MODE_DIABLO_S4) return 0x6fd1a598
  if (entry === SPECIAL_MODE_DIABLO_S3) return 0x6fd1a5a8
  if (entry === SPECIAL_MODE_403_A1 || entry === SPECIAL_MODE_403_A2) return 0x6fd1a5b8
  if (entry === SPECIAL_MODE_403_S1 || entry === SPECIAL_MODE_403_S2) return 0x6fd1a5c8
  if (entry === SPECIAL_MODE_SHADOW_S4) return 0x6fd1a5d8
  if (entry === SPECIAL_MODE_BAAL_S3) return 0x6fd1a508
  const idx = MONSTER_MODE_TABLE_113C.indexOf(entry)
  return idx >= 0 ? ((0x6fd1a498 + (idx << 4)) >>> 0) : 0
}

/**
 * `@va D2Game:0x6FC94F20` (`MONSTER_IsContinuousMode`, `ecx = pUnit`, `eax = nMode`).
 * Evaluates the 12-byte `0x6FD1BC50[nMode]` entry and, for `{4,5,7,8,9,10,11}`, checks
 * `MonStats2[wMonStatsEx].wMoveFlags (+0x104) & (1 << nMode)` (`0x6FC94F48..0x6FC94F7A`).
 */
export function MONSTER_IsContinuousMode113c(
  m: Memory113c,
  pUnit: number,
  mode: number,
): boolean {
  hitD2GameVa113c(0x6FC94F20)
  if (pUnit === 0 || (mode >>> 0) >= 16) return false
  const rule = MONSTER_CONTINUOUS_MODE_TABLE_113C[mode >>> 0]
  if (rule === undefined) {
    throw new RangeError(`MONSTER_IsContinuousMode113c: missing rule for mode=${mode}`)
  }
  if (rule.alwaysTrue === 1) return true
  if (rule.alwaysFalse === 1) return false
  if (rule.checkMonStats2MoveBit === 1) {
    const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
    if (classId >= 734) return false
    const moveFlags = MONSTATS2_MOVE_FLAGS_BY_HCIDX_113C.get(classId)
    if (moveFlags === undefined) return false
    return (moveFlags & (1 << (mode & 31))) !== 0
  }
  return false
}

/**
 * `@va D2Game:0x6FCFFA90` (`SUNIT_IsDeadOrDying`, `eax = pUnit`).
 * - `pUnit == 0` -> returns `1` (`0x6FCFFA93: mov eax, 1; ret`)
 * - `(pUnit->dwFlags & 0x10000) != 0` -> returns `1` (`0x6FCFFA9A`)
 * - `dwUnitType == 0` (`UNIT_PLAYER`): `dwAnimMode == 0 || dwAnimMode == 17` -> `1`, else `0`
 * - `dwUnitType == 1` (`UNIT_MONSTER`): `dwAnimMode == 0 || dwAnimMode == 12` -> `1`, else `0`
 * - Any other `dwUnitType` (`object`, `missile`, `item`, `tile`) -> returns `1` (`0x6FCFFAAD`).
 */
export function SUNIT_IsDeadOrDying113c(m: Memory113c, pUnit: number): number {
  hitD2GameVa113c(0x6FCFFA90)
  if (pUnit === 0) return 1
  if ((m.get(pUnit, D2UnitStrc.dwFlags) & UNITFLAG_DEAD_113C) !== 0) return 1
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const animMode = m.get(pUnit, D2UnitStrc.dwAnimMode)
  if (unitType === UNIT_PLAYER) {
    return animMode === 0 || animMode === 17 ? 1 : 0
  }
  if (unitType === UNIT_MONSTER) {
    return animMode === 0 || animMode === 12 ? 1 : 0
  }
  return 1
}

/** `@va D2Game:0x6FCAE940`: wrapper around `0x6FCAE810` with explicit `pfnHandler`. */
export function EVENT_SetPersistentEventWithHandler113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  type: number,
  arg14: number,
  arg18: number,
  handler: number,
): number {
  return EVENT_SetPersistentEventFull113c(m, pGame, pUnit, type, handler, arg14, arg18)
}

/** `@va D2Game:0x6FCAE960`: wrapper around `0x6FCAE810` with `pfnHandler = 0`. */
export function EVENT_SetPersistentUnitEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  type: number,
  arg14: number,
  arg18: number,
): number {
  return EVENT_SetPersistentEventFull113c(m, pGame, pUnit, type, 0, arg14, arg18)
}

/**
 * `@va D2Game:0x6FD00750` (`MONSTER_ClearModeEvents`, `eax = pGame`, `ebx = pUnit`):
 * Runs TWO separate `nType`-only passes — first `nType == 0` (`0x6FD00762: cmp byte ptr [eax], 0`),
 * then `nType == 1` (`0x6FD00780: cmp byte ptr [eax], 1`) — without filtering on `pfnHandler`, matching
 * exact `D2Game.dll` chunk free-list LIFO order when both types coexist on `pUnit` while preserving
 * `nType == 2` (`AI_THINK`) and `nType == 3` (`STAT_REGEN`).
 */
export function MONSTER_ClearModeEvents113c(m: Memory113c, pGame: number, pUnit: number): void {
  hitD2GameVa113c(0x6FD00750)
  if (pGame === 0 || pUnit === 0) return
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_MODE_STEP, 0)
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_MODE_END, 0)
}

/**
 * `@va D2Game:0x6FC95320` (`MONSTER_ClearStepEvents`, `ecx = pGame`, `edx = pUnit`):
 * `pfnStep` handler for `NU (1)`, `GH (3)`, `BL (6)`, `S4 (11)`, `DD (12)`:
 * frees all `nType == 0` (`MODE_STEP`, `0x6FC95332: cmp byte ptr [eax], 0`) nodes on `pUnit` and returns `1`.
 */
export function MONSTER_ClearStepEvents113c(m: Memory113c, pGame: number, pUnit: number): number {
  hitD2GameVa113c(0x6FC95320)
  if (pUnit === 0) return 1
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_MODE_STEP, 0)
  return 1
}

/**
 * `@va D2Common:0x6FD803E0` (`D2Common.#11103` `SKILLS_SetUsedSkill`):
 * Sets `pUnit->pSkills->pUsedSkill (+0x10) = pSkill` when `pSkills (+0xA8) != 0`.
 */
export function SKILLS_SetUsedSkill113c(m: Memory113c, pUnit: number, pSkill: number): void {
  if (pUnit === 0) return
  const pSkills = m.get(pUnit, D2UnitStrc.pSkills)
  if (pSkills !== 0) {
    m.setU32(pSkills + 0x10, pSkill >>> 0)
  }
}

export const SKILLS_SetSkillMode113c = SKILLS_SetUsedSkill113c

function safeReadU32MonEvt113c(m: Memory113c, addr: number): number {
  try {
    return m.u32(addr >>> 0) >>> 0
  } catch {
    return 0
  }
}

function isAddrLoadedMonEvt113c(m: Memory113c, addr: number): boolean {
  try {
    m.u32(addr >>> 0)
    return true
  } catch {
    return false
  }
}

function shouldRunUpdateAnimFrame113c(m: Memory113c, pUnit: number, uType: number, nextMode: number): boolean {
  if (uType === 4) return true
  if (uType === 2) {
    if (nextMode >= 8) return true
    const pObjBase = safeReadU32MonEvt113c(m, 0x6fdf0b94)
    const nObjCnt = safeReadU32MonEvt113c(m, 0x6fdf0b98) | 0
    const cls = m.u32((pUnit + 4) >>> 0) | 0
    return pObjBase !== 0 && cls >= 0 && cls < nObjCnt
  }
  const pTbl = safeReadU32MonEvt113c(m, 0x6fde9e1c)
  if (pTbl === 0) return false
  if (uType === 3) {
    return safeReadU32MonEvt113c(m, (pTbl + 0xb68) >>> 0) !== 0
  }
  if (uType === 0 || uType === 1) {
    if (
      safeReadU32MonEvt113c(m, 0x6fdf0b4c) === 0 ||
      safeReadU32MonEvt113c(m, 0x6fde461c) === 0 ||
      safeReadU32MonEvt113c(m, 0x6fdef020) === 0 ||
      !isAddrLoadedMonEvt113c(m, 0x6fddc7a0)
    ) {
      return false
    }
    if (uType === 0) {
      return safeReadU32MonEvt113c(m, 0x6fdf13c4) !== 0
    }
    return safeReadU32MonEvt113c(m, 0x6fdf13a4) !== 0
  }
  return false
}

/**
 * `@va D2Common:0x6FD83920` (`D2Common.#11090` `UNITS_ChangeAnimMode`):
 * Sets `pUnit->dwAnimMode (+0x10) = nMode`, refreshes the unit in its room (`D2Common.#10158` `0x6FDB65C0`),
 * expires mode-bound statlists (`0x6FD8AE60` with `bIsClient = 0`), and updates animation frame/speed/path
 * velocity via `UNITS_UpdateAnimFrame113c` (`0x6FD835F0`).
 */
export function UNITS_ChangeAnimMode113c(m: Memory113c, pUnit: number, nMode: number): number {
  hitD2CommonVa113c(0x6FD83920)
  if (pUnit === 0) return 0
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0
  if (uType === 5) return 0
  const curMode = m.get(pUnit, D2UnitStrc.dwAnimMode) >>> 0
  const nextMode = nMode >>> 0
  if (curMode === nextMode) {
    if (!(uType === 1 && curMode === 1)) {
      UNITROOM_RefreshUnit113c(m, pUnit)
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x01) >>> 0)
    }
    return 0
  }
  UNITROOM_RefreshUnit113c(m, pUnit)
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x01) >>> 0)
  m.set(pUnit, D2UnitStrc.dwAnimMode, nextMode)
  STATLIST_ExpireStateListsOnModeChange113c(m, pUnit, 0)
  if (shouldRunUpdateAnimFrame113c(m, pUnit, uType, nextMode)) {
    UNITS_UpdateAnimFrame113c(m, pUnit)
  }
  return 1
}

/**
 * `@va D2Game:0x6FC94E60` (`MONSTER_StartNeutral`, `ecx = pGame`, `edx = pModeChange { eMode=1, pUnit }`):
 * Frees attacker combat list (`0x6FCFA750`), forces `pUnit` into `MONMODE_NEUTRAL (1)` via `D2Common.#11090`
 * (`0x6FD83920`) and, if no future `Event 2` (`AI_THINK`) is scheduled past `dwGameFrame`, schedules `Event 2`
 * at `dwGameFrame + 45` (when `STATE_STUNNED = 0x15` is active) or `dwGameFrame + (aidel > 0 ? aidel : 15)`
 * using `pUnit->pMonsterData->pMonStatsTxt (+0x4F + diff)` (returning `1` without scheduling if null).
 */
export function MONSTER_StartNeutral113c(m: Memory113c, pGame: number, pUnit: number): number {
  hitD2GameVa113c(0x6FC94E60)
  if (pGame === 0 || pUnit === 0) return 0
  if (registeredFreeAttackerCombatListFn !== undefined) {
    registeredFreeAttackerCombatListFn(m, pUnit, pGame)
  } else {
    let pCur = m.u32((pUnit + 0xac) >>> 0)
    if (pCur !== 0) {
      const selfType = m.u32(pUnit) | 0
      const selfGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0
      let pPrev = 0
      while (pCur !== 0) {
        const pNext = m.u32((pCur + 0x84) >>> 0)
        if (
          (m.u32((pCur + 0x04) >>> 0) | 0) === selfType &&
          (m.u32((pCur + 0x08) >>> 0) >>> 0) === selfGuid
        ) {
          if (pPrev === 0) m.setU32((pUnit + 0xac) >>> 0, pNext)
          else m.setU32((pPrev + 0x84) >>> 0, pNext)
        } else {
          pPrev = pCur
        }
        pCur = pNext
      }
    }
  }
  UNITS_ChangeAnimMode113c(m, pUnit, 1)
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) | 0
  const nextAiFrame = EVENT_GetNextEventFrame113c(m, pUnit, MON_EVENT_AI_THINK) | 0
  if (nextAiFrame > gameFrame) {
    return 1
  }
  if (STATES_CheckState113c(m, pUnit, STATE_STUNNED_113C) !== 0) {
    EVENT_SetEventFull113c(m, pGame, pUnit, MON_EVENT_AI_THINK, (gameFrame + 0x2d) >>> 0, 0, 0, 0)
    return 1
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    const pMonData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
    if (pMonData === 0) return 1
    const pMonStatsTxt = m.get(pMonData, D2MonsterDataStrc.pMonStatsTxt) >>> 0
    if (pMonStatsTxt === 0) return 1
    // 0x6FC94ED3..0x6FC94EF4: `cmp byte ptr [ebx+0x6A], 0; jnz exp; cmp dword ptr [ebx+0x74], 0; jz classic`
    const isExp = m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0
    const diff = isExp ? (m.u8((pGame + 0x6d) >>> 0) & 0xff) : 0
    const rawAidel = m.u8((pMonStatsTxt + 0x4f + diff) >>> 0)
    const delay = rawAidel > 0 ? rawAidel : 15
    EVENT_SetEventFull113c(m, pGame, pUnit, MON_EVENT_AI_THINK, (gameFrame + delay) >>> 0, 0, 0, 0)
  }
  return 1
}

/**
 * `@va D2Game:0x6FC950F0` (`MONSTER_NullModeEventFallback`, `esi = pUnit`, `edi = nMode`, `[esp+4] = pGame`):
 * Invoked by `MONSTER_Event0_ModeStep` (`0x6FC952E0`) / `MONSTER_Event1_ModeEnd` (`0x6FC952A0`) when
 * `entry == NULL` or `pfnStep` / `pfnEnd == 0`:
 * 1. Calls `D2Common.#11103(pUnit, 0)` (`0x6FD803E0`).
 * 2. If `nMode != 0 && nMode != 12 && SUNIT_IsDeadOrDying(pUnit) != 0`, returns `1`.
 * 3. Otherwise forces `MONMODE_NEUTRAL (1)` via `0x6FC94E60` (`MONSTER_StartNeutral113c`) and returns `0`.
 */
export function MONSTER_NullModeEventFallback113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  mode: number,
): number {
  hitD2GameVa113c(0x6FC950F0)
  SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0)
  if (mode !== 0 && mode !== 12 && SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) {
    return 1
  }
  MONSTER_StartNeutral113c(m, pGame, pUnit)
  return 0
}

/**
 * `@va D2Game:0x6FD00B40` (`MONSTER_RegisterContinuousModeEvent`, `eax = pGame`, `[esp+4] = pUnit`):
 * Deletes any existing `nType == 0` node on `pUnit`, then registers a persistent `nType = 0`
 * (`dwFrame = 0xFFFFFFFF`, `fFlags |= 0x04`) node at the LIFO head of `pTimer->pPersistentHead[1]`.
 */
export function MONSTER_RegisterContinuousModeEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FD00B40)
  if (pGame === 0 || pUnit === 0) return 0
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_MODE_STEP, 0)
  return EVENT_SetPersistentEventFull113c(m, pGame, pUnit, MON_EVENT_MODE_STEP, 0, 0, 0)
}

export interface MonsterEventCallbacks113c {
  /** Override freeze check when `D2StatListEx` is not mirrored on `pUnit`. */
  readonly isFrozen?: (m: Memory113c, pUnit: number) => boolean
  readonly onModeStep?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    entry: MonsterModeEntry113c,
    arg14: number,
    arg18: number,
  ) => void
  readonly onModeEnd?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    entry: MonsterModeEntry113c,
    arg14: number,
    arg18: number,
  ) => void
  readonly onAiThink?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pAiGeneral: number,
    pfnThink: number,
    arg14: number,
    arg18: number,
  ) => void
  readonly onStatRegen?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    arg14: number,
    arg18: number,
  ) => void
  readonly onOtherEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    eventType: number,
    handlerVa: number,
    arg14: number,
    arg18: number,
  ) => void
}

/** `@va D2Game:0x6FC952E0` (`MONSTER_Event0_ModeStep`). */
export function MONSTER_Event0_ModeStep113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  arg14: number,
  arg18: number,
  callbacks: MonsterEventCallbacks113c,
): void {
  hitD2GameVa113c(0x6FC952E0)
  if (pUnit === 0) return
  const mode = m.get(pUnit, D2UnitStrc.dwAnimMode)
  const entry = MONSTER_GetModeEntry113c(m, pUnit, mode)
  if (entry === null || entry.pfnStep === 0) {
    MONSTER_NullModeEventFallback113c(m, pGame, pUnit, mode)
    return
  }
  callbacks.onModeStep?.(m, pGame, pUnit, entry, arg14, arg18)
}

/** `@va D2Game:0x6FC952A0` (`MONSTER_Event1_ModeEnd`). */
export function MONSTER_Event1_ModeEnd113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  arg14: number,
  arg18: number,
  callbacks: MonsterEventCallbacks113c,
): void {
  hitD2GameVa113c(0x6FC952A0)
  if (pUnit === 0) return
  const mode = m.get(pUnit, D2UnitStrc.dwAnimMode)
  const entry = MONSTER_GetModeEntry113c(m, pUnit, mode)
  if (entry === null || entry.pfnEnd === 0) {
    MONSTER_NullModeEventFallback113c(m, pGame, pUnit, mode)
    return
  }
  callbacks.onModeEnd?.(m, pGame, pUnit, entry, arg14, arg18)
}

let defaultMonsterAiThinkCallback113c:
  | ((
      m: Memory113c,
      pGame: number,
      pUnit: number,
      pAiGeneral: number,
      pfnThink: number,
      arg14: number,
      arg18: number,
    ) => void)
  | undefined

export function setDefaultMonsterAiThinkCallback113c(
  cb: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pAiGeneral: number,
    pfnThink: number,
    arg14: number,
    arg18: number,
  ) => void,
): void {
  defaultMonsterAiThinkCallback113c = cb
}

let k2MonsterDropLootHook113c:
  | ((m: Memory113c, pGame: number, pMonster: number, pKiller: number, allocateLootUnitInMem: boolean) => void)
  | undefined

export function setK2MonsterDropLootHook113c(
  fn:
    | ((m: Memory113c, pGame: number, pMonster: number, pKiller: number, allocateLootUnitInMem: boolean) => void)
    | undefined,
): void {
  k2MonsterDropLootHook113c = fn
}

export function getK2MonsterDropLootHook113c():
  | ((m: Memory113c, pGame: number, pMonster: number, pKiller: number, allocateLootUnitInMem: boolean) => void)
  | undefined {
  return k2MonsterDropLootHook113c
}

export interface MonsterAiPipelineHooks113c {
  readonly handleStunDoorOrLeaderFollow: (
    m: Memory113c,
    pUnit: number,
    pGame: number,
    pAiTickArgs: number,
  ) => number
  readonly dispatchTargetByAiFlag: (
    m: Memory113c,
    pUnit: number,
    pAiTickArgs: number,
    pGame: number,
  ) => number
  readonly acquireOrValidateCombatTarget: (
    m: Memory113c,
    pAiTickArgs: number,
    pUnit: number,
    pGame: number,
  ) => number
  readonly runRogueTownAi?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pAiTickArgs: number,
  ) => void
}

let monsterAiPipelineHooks113c: MonsterAiPipelineHooks113c | undefined
let monsterEventsAiStackPtr = 0x7e940000

export function registerMonsterAiPipeline113c(hooks: MonsterAiPipelineHooks113c): void {
  monsterAiPipelineHooks113c = hooks
}

function lookupMonsterAiRecordPtrs113c(
  m: Memory113c,
  pUnit: number,
): { tablesLoaded: boolean; pMonStats: number; pMonStats2: number } {
  const pTablesSlot = safeReadU32MonEvt113c(m, 0x6fd1829c)
  const pTables = pTablesSlot !== 0 ? safeReadU32MonEvt113c(m, pTablesSlot) : 0
  if (pTables === 0) return { tablesLoaded: false, pMonStats: 0, pMonStats2: 0 }
  if (pUnit === 0) return { tablesLoaded: true, pMonStats: 0, pMonStats2: 0 }
  const classId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (classId < 0) return { tablesLoaded: true, pMonStats: 0, pMonStats2: 0 }
  const nMonStats = m.u32((pTables + 0xa80) >>> 0) | 0
  if (classId >= nMonStats) return { tablesLoaded: true, pMonStats: 0, pMonStats2: 0 }
  const pMonStatsBase = m.u32((pTables + 0xa78) >>> 0) >>> 0
  const pMonStats = pMonStatsBase !== 0 ? (pMonStatsBase + Math.imul(classId, 0x1a8)) >>> 0 : 0
  let pMonStats2 = 0
  if (pMonStats !== 0) {
    const extIdx = (m.u16((pMonStats + 0x18) >>> 0) << 16) >> 16
    const nMonStats2 = m.u32((pTables + 0xa98) >>> 0) | 0
    const pMonStats2Base = m.u32((pTables + 0xa90) >>> 0) >>> 0
    if (extIdx >= 0 && extIdx < nMonStats2 && pMonStats2Base !== 0) {
      pMonStats2 = (pMonStats2Base + Math.imul(extIdx, 0x134)) >>> 0
    }
  }
  return { tablesLoaded: true, pMonStats, pMonStats2 }
}

function runLegacyMonsterAiThinkFallback113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiGeneral: number,
  arg14: number,
  arg18: number,
  cb?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pAiGeneral: number,
    pfnThink: number,
    arg14: number,
    arg18: number,
  ) => void,
): void {
  if (pUnit === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) return
  if (STATES_CheckState113c(m, pUnit, STATE_STUNNED_113C) !== 0) {
    SKILLS_SetUsedSkill113c(m, pUnit, 0)
    if (m.get(pUnit, D2UnitStrc.dwAnimMode) !== 1) {
      UNITS_ChangeAnimMode113c(m, pUnit, 1)
    }
    if (pGame !== 0) {
      EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_AI_THINK, 0)
      const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
      EVENT_SetEventFull113c(m, pGame, pUnit, MON_EVENT_AI_THINK, (frame + 15) >>> 0, 0, 0, 0)
    }
    return
  }
  if (pAiGeneral === 0) return
  const pfnThink = m.get(pAiGeneral, D2AiGeneralStrc.pfnThink)
  cb?.(m, pGame, pUnit, pAiGeneral, pfnThink, arg14, arg18)
}

/** `@va D2Game:0x6FCBD3B0` (`AI_RunMonsterAI` -> `0x6FCBCD90` -> `0x6FCBD160` -> `0x6FCBCFE0`). */
export function AI_RunMonsterAI113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  arg14 = 0,
  arg18 = 0,
  callbacks?: MonsterEventCallbacks113c,
): void {
  hitD2GameVa113c(0x6FCBD3B0)
  let pMonsterData = 0
  let pAiGeneral = 0
  if (pUnit !== 0 && m.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    pMonsterData = m.get(pUnit, D2UnitStrc.pUnitData)
    if (pMonsterData !== 0) {
      pAiGeneral = m.get(pMonsterData, D2MonsterDataStrc.pAiGeneral)
    }
  }

  if (callbacks?.onAiThink !== undefined) {
    runLegacyMonsterAiThinkFallback113c(
      m,
      pGame,
      pUnit,
      pAiGeneral,
      arg14,
      arg18,
      callbacks.onAiThink,
    )
    return
  }

  const { tablesLoaded, pMonStats, pMonStats2 } = lookupMonsterAiRecordPtrs113c(m, pUnit)
  if (tablesLoaded && (pMonStats === 0 || pMonStats2 === 0)) return
  const hasMonsterStatsTxt = pMonsterData !== 0 && safeReadU32MonEvt113c(m, pMonsterData) !== 0
  if (!tablesLoaded || !hasMonsterStatsTxt) {
    runLegacyMonsterAiThinkFallback113c(
      m,
      pGame,
      pUnit,
      pAiGeneral,
      arg14,
      arg18,
      defaultMonsterAiThinkCallback113c,
    )
    return
  }

  const sp = monsterEventsAiStackPtr
  monsterEventsAiStackPtr = (sp + 0x30) >>> 0
  try {
    m.fill(sp, 0x24, 0)
    m.setU32(sp, pAiGeneral >>> 0)
    m.setU32((sp + 0x1c) >>> 0, pMonStats >>> 0)
    m.setU32((sp + 0x20) >>> 0, pMonStats2 >>> 0)

    const hooks = monsterAiPipelineHooks113c
    if (hooks !== undefined) {
      if (hooks.handleStunDoorOrLeaderFollow(m, pUnit, pGame, sp) !== 0) return
      if (hooks.dispatchTargetByAiFlag(m, pUnit, sp, pGame) !== 0) return
      if (hooks.acquireOrValidateCombatTarget(m, sp, pUnit, pGame) !== 0) return
    } else if (STATES_CheckState113c(m, pUnit, STATE_STUNNED_113C) !== 0) {
      SKILLS_SetUsedSkill113c(m, pUnit, 0)
      if (m.get(pUnit, D2UnitStrc.dwAnimMode) !== 1) {
        UNITS_ChangeAnimMode113c(m, pUnit, 1)
      }
      if (pGame !== 0) {
        EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, MON_EVENT_AI_THINK, 0)
        const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
        EVENT_SetEventFull113c(m, pGame, pUnit, MON_EVENT_AI_THINK, (frame + 15) >>> 0, 0, 0, 0)
      }
      return
    }

    const activeAiGen = m.u32(sp) >>> 0
    const pfnThink = activeAiGen !== 0 ? m.get(activeAiGen, D2AiGeneralStrc.pfnThink) >>> 0 : 0
    if (pfnThink < 0x6fc20000 || pfnThink >= 0x6fd17000) {
      throw new D2CommonAssertError('D2Game\\MONSTER\\MonsterAI.cpp', 0x39e)
    }

    if (pfnThink === 0x6fcbc990 || pfnThink === 0x6fcd6c80 || pfnThink === 0x6fc9b4e0 || pfnThink === 0x6fcc39d0) {
      return
    }
    if (pfnThink === 0x6fcbcb00 && hooks?.runRogueTownAi !== undefined) {
      hooks.runRogueTownAi(m, pGame, pUnit, sp)
      return
    }
    if (defaultMonsterAiThinkCallback113c !== undefined) {
      defaultMonsterAiThinkCallback113c(m, pGame, pUnit, activeAiGen, pfnThink, arg14, arg18)
    }
  } finally {
    monsterEventsAiStackPtr = sp
  }
}

/**
 * `@va D2Game:0x6FC969A0` (`MONSTER_DispatchEvent`):
 * Bounds check (`0 <= eventType < 15`), `STATE_FREEZE` guard (`0x6FC969A9..0x6FC969D4` + `0x6FCFFA90`),
 * and `0x6FD1BC14[eventType]` handler dispatch.
 */
export function MONSTER_DispatchEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  eventType: number,
  arg14: number,
  arg18: number,
  callbacks: MonsterEventCallbacks113c,
): void {
  hitD2GameVa113c(0x6FC969A0)
  const ev = eventType | 0
  if (ev < 0 || ev >= 15 || pUnit === 0) return

  if (((MONSTER_EVENT_FREEZE_BYPASS_MASK_113C >>> ev) & 1) === 0) {
    const frozen = callbacks.isFrozen
      ? callbacks.isFrozen(m, pUnit)
      : STATES_CheckState113c(m, pUnit, 1) !== 0
    if (frozen && SUNIT_IsDeadOrDying113c(m, pUnit) === 0) {
      return
    }
  }

  const handlerVa = MONSTER_EVENT_HANDLER_VAS_113C[ev]
  if (handlerVa === undefined) {
    throw new RangeError(`MONSTER_DispatchEvent113c: missing handler table entry for eventType=${ev}`)
  }
  if (handlerVa === 0) return

  switch (ev) {
    case MON_EVENT_MODE_STEP:
      MONSTER_Event0_ModeStep113c(m, pGame, pUnit, arg14, arg18, callbacks)
      return
    case MON_EVENT_MODE_END:
      MONSTER_Event1_ModeEnd113c(m, pGame, pUnit, arg14, arg18, callbacks)
      return
    case MON_EVENT_AI_THINK:
      AI_RunMonsterAI113c(m, pGame, pUnit, arg14, arg18, callbacks)
      return
    case MON_EVENT_STAT_REGEN:
      callbacks.onStatRegen?.(m, pGame, pUnit, arg14, arg18)
      return
    default:
      callbacks.onOtherEvent?.(m, pGame, pUnit, ev, handlerVa, arg14, arg18)
  }
}

/**
 * Runs one partition of `EVENT_UpdateTimers` (`0x6FCAF070`), e.g. `partition = 1` (`UNIT_MONSTER`),
 * executing persistent events LIFO (`pPersistentHead[partition]`) followed by current slot (`frame & 63`)
 * FIFO (`pSlotTail -> pWheelNewer`).
 */
export function EVENT_UpdatePartition113c(
  m: Memory113c,
  pGame: number,
  partition: number,
  dispatch: EventDispatchCallback113c,
): number {
  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  if (pTimer === 0) return 0
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const slotMod = frame & 63
  m.set(pTimer, D2TimerStrc.nCurrentSlot, slotMod)

  let firedCount = 0

  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, partition)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    const fn = m.get(node, D2EventStrc.pfnHandler)
    firedCount++
    dispatch(m, pGame, pUnit, evType, arg14, arg18, fn, node)

    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = partition * 64 + slotMod
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      const fn = m.get(node, D2EventStrc.pfnHandler)
      firedCount++
      dispatch(m, pGame, pUnit, evType, arg14, arg18, fn, node)

      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

export type AiTargetModeCallback113c = (
  m: Memory113c,
  pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pCtx: number,
) => number

const registeredAiTargetModeCallbacks = new Map<number, AiTargetModeCallback113c>()

export function registerAiTargetModeCallback113c(
  cbId: number,
  cb: AiTargetModeCallback113c,
): void {
  registeredAiTargetModeCallbacks.set(cbId >>> 0, cb)
}

export function getRegisteredAiTargetModeCallback113c(
  cbId: number,
): AiTargetModeCallback113c | undefined {
  return registeredAiTargetModeCallbacks.get(cbId >>> 0)
}

export type MonsterAiThinkVaHandler113c = (
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
) => void

const registeredMonsterAiThinkVaHandlers = new Map<number, MonsterAiThinkVaHandler113c>()

export function registerMonsterAiThinkVaHandler113c(
  va: number,
  fn: MonsterAiThinkVaHandler113c,
): void {
  registeredMonsterAiThinkVaHandlers.set(va >>> 0, fn)
}

export function getRegisteredMonsterAiThinkVaHandler113c(
  va: number,
): MonsterAiThinkVaHandler113c | undefined {
  return registeredMonsterAiThinkVaHandlers.get(va >>> 0)
}

export type FreeAttackerCombatListFn113c = (m: Memory113c, pUnit: number, pGame: number) => void

let registeredFreeAttackerCombatListFn: FreeAttackerCombatListFn113c | undefined

export function registerFreeAttackerCombatList113c(fn: FreeAttackerCombatListFn113c): void {
  registeredFreeAttackerCombatListFn = fn
}

export type SliceFrameBoundaryHook113c = () => void

let registeredPreSliceFrameSetupHook: SliceFrameBoundaryHook113c | undefined
let registeredPostActRoomsUpdateHook: SliceFrameBoundaryHook113c | undefined
let registeredPostSliceFrameCleanupHook: SliceFrameBoundaryHook113c | undefined

export function registerPreSliceFrameSetupHook113c(fn: SliceFrameBoundaryHook113c): void {
  registeredPreSliceFrameSetupHook = fn
}

export function runPreSliceFrameSetupHooks113c(): void {
  if (registeredPreSliceFrameSetupHook !== undefined) {
    registeredPreSliceFrameSetupHook()
  }
}

export function registerPostActRoomsUpdateHook113c(fn: SliceFrameBoundaryHook113c): void {
  registeredPostActRoomsUpdateHook = fn
}

export function runPostActRoomsUpdateHooks113c(): void {
  if (registeredPostActRoomsUpdateHook !== undefined) {
    registeredPostActRoomsUpdateHook()
  }
}

export function registerPostSliceFrameCleanupHook113c(fn: SliceFrameBoundaryHook113c): void {
  registeredPostSliceFrameCleanupHook = fn
}

export function runPostSliceFrameCleanupHooks113c(): void {
  if (registeredPostSliceFrameCleanupHook !== undefined) {
    registeredPostSliceFrameCleanupHook()
  }
}
