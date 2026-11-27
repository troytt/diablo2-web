/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 1 (`Lane K2-L`) routines across
 * `0x6FC62C70..0x6FC73260` (`SKILLS` Druid/Necromancer/start/do/event helpers,
 * `REGPOP` pack spawn, `MONSTER` NPC interaction teardown, `CLIENTS` state/save/
 * room/rate-limit accessors, `GAMETIME` QPC/tick timer, and `PLAYERSAVE` item count).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DUNGEON_GetRoomCoordListFromSubtile113c } from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, sdiv32, umod32 } from '../common/int-math.ts'
import {
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
  ITEMS_CheckItemFlagCompactSaveByClassId113c,
} from '../common/inventory.ts'
import { ITEMS_CheckCommandFlags113c } from '../common/items.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  PATH_ComputeSquaredDistance113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
} from '../common/path.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_IsSelectableCorpse11157_113c,
  SKILLS_IsSelectableCorpseWithVelocity113c,
} from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  UNITS_GetRoom113c,
  UNITS_GetTransformGfx113c,
  UNITS_SetUnitAnimMode113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { seedNext, type D2SeedStrc } from '../prng.ts'
import { SUNIT_UnlinkFromRoomUpdateList113c } from './a1c-post150-f150-f276-113c.ts'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c.ts'
import { CLIENTS_SetPlayerCurrentRoom113c } from './act-rooms-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import {
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_ExecuteEvents113c,
} from './combat-a1c-113c.ts'
import { SKILLS_SetNecroSkeletonComponents113c } from './k2-sunit-spawn-w1-113c.ts'
import { SUNIT_IsDeadOrDying113c } from './monster-events.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_SpawnPackLeader113c,
  MONSTER_SpawnPackMember113c,
  MONSTATS2_CheckModeBit113c,
  SEED_RollLimitedFast113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** `D2Game.dll` `.rdata` `0x6FD1C3A8`: `"..\\Source\\D2Game\\SKILLS\\SkillDruid.cpp"`. */
const D2GAME_STR_SKILL_DRUID_CPP_VA_113C = 0x6fd1c3a8

/** `D2Game.dll` `.rdata` `0x6FD1C1DC`: `"..\\Source\\D2Game\\SKILLS\\SkillNec.cpp"`. */
const D2GAME_STR_SKILL_NEC_CPP_VA_113C = 0x6fd1c1dc

/** `D2Game.dll` `.idata` `0x6FD18D08`: `KERNEL32.QueryPerformanceCounter` IAT slot. */
const D2GAME_IAT_QUERY_PERFORMANCE_COUNTER_VA_113C = 0x6fd18d08

/** `D2Game.dll` `.idata` `0x6FD18D10`: `KERNEL32.GetTickCount` IAT slot. */
const D2GAME_IAT_GET_TICK_COUNT_VA_113C = 0x6fd18d10

/** `D2Game.dll` `.data` `0x6FD303A0` / `0x6FD303A4`: 64-bit QPC frequency (`LARGE_INTEGER`). */
const D2GAME_PERF_FREQ_LO_VA_113C = 0x6fd303a0
const D2GAME_PERF_FREQ_HI_VA_113C = 0x6fd303a4

/** `D2Game.dll` `.data` `0x6FD303B0`: `BOOL gbUsePerfCounter`. */
const D2GAME_USE_PERF_COUNTER_VA_113C = 0x6fd303b0

let k2LaneLStackPtr = 0x7efa0000

export interface GameTimeHostHooks113c {
  readonly queryPerformanceCounter?: (m: Memory113c, pLargeIntegerOut: number) => number
  readonly getTickCount?: (m: Memory113c) => number
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function lookupSkillsTxtPtr113c(m: Memory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = m.u32(pSgptPtr) >>> 0
  const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (id >= nSkillsCount) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  return (pSkillsBase + imul32(id, 0x23c)) >>> 0
}

function isValidItemStatCostId113c(m: Memory113c, nStatId: number): boolean {
  const id = nStatId | 0
  if (id < 0) return false
  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = m.u32(pSgptPtr) >>> 0
  const nIscCount = m.u32((pDataTables + 0xbd4) >>> 0) | 0
  if (id >= nIscCount) return false
  const pIscBase = m.u32((pDataTables + 0xbcc) >>> 0) >>> 0
  const pRec = (pIscBase + imul32(id, 0x144)) >>> 0
  return pRec !== 0
}

function readUnitPosXInline113c(m: Memory113c, pUnit: number): number {
  const uType = m.u32(pUnit >>> 0) | 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    return m.u32((pStaticPath + 0x0c) >>> 0) | 0
  }
  const pDynPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  return pDynPath !== 0 ? PATH_GetPosX113c(m, pDynPath) | 0 : 0
}

function readUnitPosYInline113c(m: Memory113c, pUnit: number): number {
  const uType = m.u32(pUnit >>> 0) | 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    return m.u32((pStaticPath + 0x10) >>> 0) | 0
  }
  const pDynPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  return pDynPath !== 0 ? PATH_GetPosY113c(m, pDynPath) | 0 : 0
}

function resolveNecroSkeletonTierFromState61_113c(m: Memory113c, pOwnerUnit: number): number {
  let nTier = 1
  if (STATES_CheckState113c(m, pOwnerUnit, 0x61) !== 0) {
    const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pOwnerUnit, 0x61) >>> 0
    if (pStatList !== 0) {
      STATLIST_GetStatValue113c(m, pStatList, 0x15e, 0)
      nTier = STATLIST_GetStatValue113c(m, pStatList, 0x15f, 0) | 0
    }
  }
  return nTier
}

/**
 * `gpfnSkillEventFunc[2]` (`0x6FD277B0`) combat event callback (`ecx = pGame`, `edx = nEvent`,
 * stack `(pUnit, pTarget, pDamage, nSkillId, nSkillLevel)`, `ret 0x14`):
 * validates `pUnit != 0`, `pTarget` is player (`0`) or monster (`1`), and `pDamage == 0 || pDamage->dwPhysDamage > 0`,
 * evaluates `SkillsTxt[nSkillId].dwCalc1` (`+0x138`) into `dmg.dwFrzLen` (`+0x34`) with `wResultFlags |= 0x20`,
 * calls `SUNITDMG_ApplyDamage113c`, and sets `SkillsTxt.wAuraTargetState` (`+0x110`) icon on `pTarget` when in `[0, nStatesCount)`.
 *
 * @va D2Game:0x6FC62C70
 */
export function SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(
  m: Memory113c,
  pGame: number,
  _nEvent: number,
  pUnit: number,
  pTarget: number,
  pDamage: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC62C70)
  if (pUnit === 0 || pTarget === 0) return 0
  const targetType = m.u32(pTarget >>> 0) >>> 0
  if (targetType !== 0 && targetType !== 1) return 0
  if (pDamage !== 0 && (m.u32((pDamage + 0x08) >>> 0) | 0) <= 0) {
    return 0
  }
  const pSkillsTxt = lookupSkillsTxtPtr113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0

  let slvl = nSkillLevel | 0
  if (slvl < 0) {
    slvl = 1
  }

  const sp = k2LaneLStackPtr
  k2LaneLStackPtr = (sp + 0x80) >>> 0
  try {
    m.fill(sp, 0x70, 0)
    m.setU8((sp + 0x04) >>> 0, (m.u8((sp + 0x04) >>> 0) | 0x20) & 0xff)
    const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0) >>> 0
    const frzLen = SKILLS_EvalCalcByOffset113c(m, pUnit, dwCalc1, nSkillId | 0, slvl)
    m.setU32((sp + 0x34) >>> 0, frzLen >>> 0)
    // 0x6fc62d2f: push 0x1 (bApplyResists = 1), call 0x6fcfe0c0 only (does NOT call 0x6fcfcf20)
    SUNITDMG_ApplyDamage113c(m, pGame, pUnit, pTarget, sp, 1, undefined, 1)
  } finally {
    k2LaneLStackPtr = sp
  }

  const stateId = sx16(m.u16((pSkillsTxt + 0x110) >>> 0))
  if (stateId >= 0) {
    const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = m.u32(pSgptPtr) >>> 0
    const nStatesCount = m.u32((pDataTables + 0xbc0) >>> 0) | 0
    if (stateId < nStatesCount) {
      STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, stateId, 0)
    }
  }
  return 1
}

/**
 * Clears GFX state `0x0C` (`12`) on `pUnit` (`ebx`), frees all `nType == 0` event nodes on
 * `pUnit->pEventFirst` (`+0xDC`, next at `+0x24`), resolves `MonStats2Txt.bByte108` (`+0x108`,
 * defaulting to `1`), and schedules unit event `1` at `pGame->dwGameFrame + delay` (`eax = pGame`).
 *
 * @va D2Game:0x6FC63CA0
 */
export function SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC63CA0)
  let delay = 1
  STATES_ToggleGfxStateFlag113c(m, pUnit, 0x0c, 0)
  if (pUnit !== 0) {
    let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pEv !== 0) {
      const evType = m.u8(pEv)
      const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
      if (evType === 0) {
        EVENT_FreeNode113c(m, pGame, pEv)
      }
      pEv = pNext
    }

    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    if (nClassId >= 0) {
      const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
      const pDataTables = m.u32(pSgptPtr) >>> 0
      if (nClassId < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
        const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
        const wMonStatsEx = sx16(m.u16((pMonStatsBase + imul32(nClassId, 0x1a8) + 0x18) >>> 0))
        if (wMonStatsEx >= 0 && wMonStatsEx < (m.u32((pDataTables + 0xa98) >>> 0) | 0)) {
          const pMonStats2Base = m.u32((pDataTables + 0xa90) >>> 0) >>> 0
          const pMonStats2 = (pMonStats2Base + imul32(wMonStatsEx, 0x134)) >>> 0
          if (pMonStats2 !== 0) {
            delay = m.u8((pMonStats2 + 0x108) >>> 0)
          }
        }
      }
    }
  }
  const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + delay) >>> 0
  EVENT_SetEventFull113c(m, pGame, pUnit, 1, nextFrame, 0, 0, 0)
}

/**
 * Evaluates the `5` `(wPassiveStat, dwPassiveCalc)` pairs (`+0x98`, `+0xA4`) on `pSkillsTxt`
 * (`eax = pSkillsTxt`, resolving from `nSkillId` when `0`; stack `(pUnit, pStatList, nSkillId, nSkillLevel)`,
 * `ret 0x10`), writes non-zero values into `pStatList` (mirroring stat `0x44` to `0x45`), and refreshes
 * `UNITS_SetUnitAnimMode113c` (`line 0x12C`).
 *
 * @va D2Game:0x6FC647D0
 */
export function SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c(
  m: Memory113c,
  pSkillsTxtIn: number,
  pUnit: number,
  pStatList: number,
  nSkillId: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FC647D0)
  if (pUnit === 0 || pStatList === 0) return
  const pSkillsTxt =
    pSkillsTxtIn !== 0 ? pSkillsTxtIn >>> 0 : lookupSkillsTxtPtr113c(m, nSkillId)
  if (pSkillsTxt === 0) return

  for (let i = 0; i < 5; i++) {
    const statId = sx16(m.u16((pSkillsTxt + 0x98 + i * 2) >>> 0))
    if (!isValidItemStatCostId113c(m, statId)) continue
    const dwCalc = m.u32((pSkillsTxt + 0xa4 + i * 4) >>> 0) >>> 0
    const val = SKILLS_EvalCalcByOffset113c(m, pUnit, dwCalc, nSkillId | 0, nSkillLevel | 0) | 0
    if (val === 0) continue
    STATLIST_SetStat113c(m, pStatList, statId, val, 0)
    if (statId === 0x44) {
      STATLIST_SetStat113c(m, pStatList, 0x45, val, 0)
    }
  }
  UNITS_SetUnitAnimMode113c(m, pUnit, D2GAME_STR_SKILL_DRUID_CPP_VA_113C, 0x12c)
}

/**
 * Evaluates the `6` `(wAuraStat, dwAuraStatCalc)` pairs (`+0x54`, `+0x68`) on `pSkillsTxt`
 * (`eax = pSkillsTxt`, resolving from `nSkillId` when `0`; stack `(pUnit, pStatList, nSkillId, nSkillLevel)`,
 * `ret 0x10`), writes non-zero values into `pStatList` (mirroring stat `0x44` to `0x45`), and refreshes
 * `UNITS_SetUnitAnimMode113c` (`line 0xF8`).
 *
 * @va D2Game:0x6FC648E0
 */
export function SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(
  m: Memory113c,
  pSkillsTxtIn: number,
  pUnit: number,
  pStatList: number,
  nSkillId: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FC648E0)
  if (pUnit === 0 || pStatList === 0) return
  const pSkillsTxt =
    pSkillsTxtIn !== 0 ? pSkillsTxtIn >>> 0 : lookupSkillsTxtPtr113c(m, nSkillId)
  if (pSkillsTxt === 0) return

  for (let i = 0; i < 6; i++) {
    const statId = sx16(m.u16((pSkillsTxt + 0x54 + i * 2) >>> 0))
    if (!isValidItemStatCostId113c(m, statId)) continue
    const dwCalc = m.u32((pSkillsTxt + 0x68 + i * 4) >>> 0) >>> 0
    const val = SKILLS_EvalCalcByOffset113c(m, pUnit, dwCalc, nSkillId | 0, nSkillLevel | 0) | 0
    if (val === 0) continue
    STATLIST_SetStat113c(m, pStatList, statId, val, 0)
    if (statId === 0x44) {
      STATLIST_SetStat113c(m, pStatList, 0x45, val, 0)
    }
  }
  UNITS_SetUnitAnimMode113c(m, pUnit, D2GAME_STR_SKILL_DRUID_CPP_VA_113C, 0xf8)
}

/**
 * Resolves transformed animation mode via `UNITS_GetTransformGfx113c` (`eax = pUnit`,
 * `[esp+4] = nAnimMode`, `ret 4`): returns `nAnimMode` unchanged for `UNIT_PLAYER` (`dwUnitType == 0`),
 * and invokes `D2Common.#10350` (`line 0x9C`) for `pUnit == 0` or `dwUnitType != 0`.
 *
 * @va D2Game:0x6FC649F0
 */
export function SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c(
  m: Memory113c,
  pUnit: number,
  nAnimMode: number,
): number {
  hitD2GameVa113c(0x6FC649F0)
  if (pUnit !== 0 && m.u32(pUnit >>> 0) === 0) {
    return nAnimMode | 0
  }
  const dwUnitType = pUnit === 0 ? 6 : m.u32(pUnit >>> 0) >>> 0
  const dwClassId = pUnit === 0 ? 0xffffffff : m.u32((pUnit + 0x04) >>> 0) >>> 0

  const sp = k2LaneLStackPtr
  k2LaneLStackPtr = (sp + 0x10) >>> 0
  try {
    const pLocalClassId = sp
    const pLocalUnitType = (sp + 4) >>> 0
    const pInOutMode = (sp + 8) >>> 0
    m.setU32(pLocalClassId, dwClassId)
    m.setU32(pLocalUnitType, dwUnitType)
    m.setU32(pInOutMode, nAnimMode >>> 0)
    UNITS_GetTransformGfx113c(
      m,
      pUnit,
      pLocalUnitType,
      pLocalClassId,
      pInOutMode,
      D2GAME_STR_SKILL_DRUID_CPP_VA_113C,
      0x9c,
    )
    return m.u32(pInOutMode) | 0
  } finally {
    k2LaneLStackPtr = sp
  }
}

/**
 * Spawns a monster pack of `nClassId` (`ebx`) at subtile `(nSubtileX = ecx, nSubtileY = eax)` in `pRoom`
 * (`[esp+4] = pGame`, `[esp+8] = pRoom`, `ret 8`): validates `MonStatsTxt.bMinGrp` (`+0x2F`) and
 * `bMaxGrp` (`+0x30`) (`1 <= minGrp <= maxGrp`), spawns the pack leader via `MONSTER_SpawnPackLeader113c`,
 * rolls `(minGrp - 1) .. (maxGrp - 1)` companions on `&pLeader->tSeed` (`+0x20`), and spawns each member
 * within radius `3` via `MONSTER_SpawnPackMember113c`.
 *
 * @va D2Game:0x6FC670F0
 */
export function REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c(
  m: Memory113c,
  nSubtileY: number,
  nSubtileX: number,
  nClassId: number,
  pGame: number,
  pRoom: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FC670F0)
  let pMonStatsTxt = 0
  const id = nClassId | 0
  if (id >= 0) {
    const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = m.u32(pSgptPtr) >>> 0
    if (id < (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
      const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
      pMonStatsTxt = (pMonStatsBase + imul32(id, 0x1a8)) >>> 0
    }
  }
  if (pMonStatsTxt === 0) return 0

  const bMinGrp = m.u8((pMonStatsTxt + 0x2f) >>> 0)
  const bMaxGrp = m.u8((pMonStatsTxt + 0x30) >>> 0)
  if (bMinGrp === 0 || bMaxGrp === 0 || bMaxGrp < bMinGrp) {
    return 0
  }

  const pCoordNode = DUNGEON_GetRoomCoordListFromSubtile113c(m, pRoom, nSubtileX | 0, nSubtileY | 0) >>> 0
  if (pCoordNode === 0) {
    return 0
  }

  const pLeader = MONSTER_SpawnPackLeader113c(
    m,
    id,
    pRoom,
    1,
    pGame,
    pCoordNode,
    nSubtileX | 0,
    nSubtileY | 0,
    -1,
    0,
    hooks,
  ) >>> 0
  if (pLeader === 0) {
    return 0
  }

  const minExtra = (bMinGrp - 1) & 0xff
  const maxExtra = (bMaxGrp - 1) & 0xff
  const range = (maxExtra - minExtra + 1) | 0
  const roll = SEED_RollLimitedFast113c(m, (pLeader + 0x20) >>> 0, range) | 0
  const nMembers = (roll + minExtra) | 0
  for (let i = 0; i < nMembers; i++) {
    MONSTER_SpawnPackMember113c(m, id, pLeader, 1, pGame, pCoordNode, 3, 0, hooks)
  }
  return pLeader
}

/**
 * Unlinks and frees (`Fog.#10046`) the singly-linked interaction node matching `pPlayer` (`edi`)
 * from `[pInteract + 0x00]` (`esi`, next pointer at `+0x08`, `[esp+4] = pGame`, `ret 4`).
 *
 * @va D2Game:0x6FC68300
 */
export function MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c(
  m: Memory113c,
  pInteract: number,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC68300)
  if (pInteract === 0) return
  const head = m.u32(pInteract >>> 0) >>> 0
  if (head === 0) return

  const target = pPlayer >>> 0
  let prev = 0
  let cur = head
  while (cur !== 0) {
    if ((m.u32(cur) >>> 0) === target) {
      const next = m.u32((cur + 0x08) >>> 0) >>> 0
      if (cur === head) {
        m.setU32(pInteract >>> 0, next)
      } else {
        m.setU32((prev + 0x08) >>> 0, next)
      }
      if (pGame !== 0) {
        m.u32((pGame + 0x1c) >>> 0)
      }
      return
    }
    prev = cur
    cur = m.u32((cur + 0x08) >>> 0) >>> 0
  }
}

/**
 * Cancels and frees all active NPC interaction records on `pMonster` (`__stdcall(pGame, pMonster, pfnCallback)`,
 * `ret 0x0C`): queues S2C packet `0x62` (`[0x62, 0x01, dwMonsterGuid, 0x00]`, `7` bytes) to each player's client,
 * resets `pPlayer + 0x64 = 0xFFFFFFFF`, `+0x68 = 6`, `+0x6C = 0`, optionally invokes `pfnCallback`,
 * and zeroes `*pInteract = 0`.
 *
 * @va D2Game:0x6FC68410
 */
export function MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pfnCallbackVa = 0,
  onCancelPlayer?: (m: Memory113c, pPlayer: number, pfnCallbackVa: number) => void,
): void {
  hitD2GameVa113c(0x6FC68410)
  if (pMonster === 0) return
  if (m.u32(pMonster >>> 0) !== 1) return
  const pMonsterData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return
  const pInteract = m.u32((pMonsterData + 0x30) >>> 0) >>> 0
  if (pInteract === 0) return

  let pNode = m.u32(pInteract) >>> 0
  if (pNode !== 0) {
    const sp = k2LaneLStackPtr
    k2LaneLStackPtr = (sp + 0x10) >>> 0
    try {
      while (pNode !== 0) {
        const pPlayer = m.u32(pNode) >>> 0
        const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
        const dwMonsterGuid = m.u32((pMonster + 0x0c) >>> 0) >>> 0

        let pClient = 0
        if (pPlayer !== 0 && m.u32(pPlayer) === 0) {
          const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
          pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
        }

        m.setU8(sp, 0x62)
        m.setU8((sp + 1) >>> 0, 1)
        m.setU32((sp + 2) >>> 0, dwMonsterGuid)
        m.setU8((sp + 6) >>> 0, 0)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 7)

        const pPlayerAfter = m.u32(pNode) >>> 0
        m.setU32((pPlayerAfter + 0x64) >>> 0, 0xffffffff)
        m.setU32((pPlayerAfter + 0x68) >>> 0, 6)
        m.setU8((pPlayerAfter + 0x6c) >>> 0, 0)

        if (pfnCallbackVa !== 0 && onCancelPlayer !== undefined) {
          onCancelPlayer(m, m.u32(pNode) >>> 0, pfnCallbackVa >>> 0)
        }
        if (pGame !== 0) {
          m.u32((pGame + 0x1c) >>> 0)
        }
        pNode = pNext
      }
    } finally {
      k2LaneLStackPtr = sp
    }
  }
  m.setU32(pInteract, 0)
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:3324`) and returns `(pClient + 0x48C) >>> 0` (`eax = pClient`).
 *
 * @va D2Game:0x6FC69240
 */
export function CLIENTS_GetSaveHeaderPtr_6FC69240_113c(
  _m: Memory113c,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FC69240)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xcfc)
  }
  return (pClient + 0x48c) >>> 0
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2971`) and sets bit `0x20` on `pClient->dwClientFlags` (`+0x3D4`, `eax = pClient`).
 *
 * @va D2Game:0x6FC69580
 */
export function CLIENTS_SetClientFlag20_6FC69580_113c(
  m: Memory113c,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC69580)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xb9b)
  }
  const addr = (pClient + 0x3d4) >>> 0
  m.setU32(addr, (m.u32(addr) | 0x20) >>> 0)
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2921`, `esi = pClient`), frees `pClient->pSaveData` (`+0x17C`) via
 * `Fog.#10046` when non-NULL, zeroes `+0x17C`, `+0x180`, `+0x188`, `+0x184`, and clears bit `0x10` in `pClient + 0x3D4`.
 *
 * @va D2Game:0x6FC69630
 */
export function CLIENTS_FreeSaveDataBuffer_6FC69630_113c(
  m: Memory113c,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC69630)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xb69)
  }
  const pSaveData = m.u32((pClient + 0x17c) >>> 0) >>> 0
  if (pSaveData !== 0) {
    const pGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
    if (pGame !== 0) {
      m.u32((pGame + 0x1c) >>> 0)
    }
    m.setU32((pClient + 0x17c) >>> 0, 0)
  }
  const flags = (m.u32((pClient + 0x3d4) >>> 0) & 0xffffffef) >>> 0
  m.setU32((pClient + 0x180) >>> 0, 0)
  m.setU32((pClient + 0x188) >>> 0, 0)
  m.setU32((pClient + 0x184) >>> 0, 0)
  m.setU32((pClient + 0x3d4) >>> 0, flags)
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2901`, `ecx = pClient`, `eax = nSize`, `[esp+4] = pSrcData`, `ret 4`),
 * allocates a new `nSize`-byte buffer via `Fog.#10045` into `pClient + 0x17C` / `+0x180` whenever
 * `pClient->dwSaveSize != nSize || pClient->pSaveData != 0` (freeing any prior `pSaveData` first),
 * and copies `nSize` bytes from `pSrcData` into `pClient->pSaveData`.
 *
 * @va D2Game:0x6FC696B0
 */
export function CLIENTS_StoreSaveDataBuffer_6FC696B0_113c(
  m: Memory113c,
  pClient: number,
  nSize: number,
  pSrcData: number,
): void {
  hitD2GameVa113c(0x6FC696B0)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xb55)
  }
  const size = nSize >>> 0
  const curSize = m.u32((pClient + 0x180) >>> 0) >>> 0
  const curPtr = m.u32((pClient + 0x17c) >>> 0) >>> 0

  if (curSize !== size || curPtr !== 0) {
    if (curPtr !== 0) {
      const pGame0 = m.u32((pClient + 0x1a8) >>> 0) >>> 0
      if (pGame0 !== 0) {
        m.u32((pGame0 + 0x1c) >>> 0)
      }
    }
    const pGame1 = m.u32((pClient + 0x1a8) >>> 0) >>> 0
    if (pGame1 !== 0) {
      m.u32((pGame1 + 0x1c) >>> 0)
    }
    const pNewBuf = m.alloc(size) >>> 0
    m.setU32((pClient + 0x17c) >>> 0, pNewBuf)
    m.setU32((pClient + 0x180) >>> 0, size)
  }

  const dst = m.u32((pClient + 0x17c) >>> 0) >>> 0
  const src = pSrcData >>> 0
  const dwords = size >>> 2
  for (let i = 0; i < dwords; i++) {
    m.setU32((dst + i * 4) >>> 0, m.u32((src + i * 4) >>> 0))
  }
  const remBase = (dwords * 4) >>> 0
  const rem = size & 3
  for (let b = 0; b < rem; b++) {
    m.setU8((dst + remBase + b) >>> 0, m.u8((src + remBase + b) >>> 0))
  }
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2891`) and returns `pClient->dwSaveDataSize` (`+0x180`, `eax = pClient`).
 *
 * @va D2Game:0x6FC69760
 */
export function CLIENTS_GetSaveDataSize_6FC69760_113c(
  m: Memory113c,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FC69760)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xb4b)
  }
  return m.u32((pClient + 0x180) >>> 0) >>> 0
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2881`) and returns `pClient->pSaveData` (`+0x17C`, `eax = pClient`).
 *
 * @va D2Game:0x6FC69790
 */
export function CLIENTS_GetSaveDataPtr_6FC69790_113c(
  m: Memory113c,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FC69790)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xb41)
  }
  return m.u32((pClient + 0x17c) >>> 0) >>> 0
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2521`) and returns `(pClient + 0x0D) >>> 0` (`&pClient->szName`, `eax = pClient`).
 *
 * @va D2Game:0x6FC69A20
 */
export function CLIENTS_GetClientNamePtr_6FC69A20_113c(
  _m: Memory113c,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FC69A20)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0x9d9)
  }
  return (pClient + 0x0d) >>> 0
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2454`) and returns `pClient->pGame` (`+0x1A8`, `eax = pClient`).
 *
 * @va D2Game:0x6FC69A80
 */
export function CLIENTS_GetClientGame_6FC69A80_113c(
  m: Memory113c,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FC69A80)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0x996)
  }
  return m.u32((pClient + 0x1a8) >>> 0) >>> 0
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2443`) and returns `m.u32(pClient + 0x488)` (`eax = pClient`).
 *
 * @va D2Game:0x6FC69AB0
 */
export function CLIENTS_GetClientField488_6FC69AB0_113c(
  m: Memory113c,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FC69AB0)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0x98b)
  }
  return m.u32((pClient + 0x488) >>> 0) >>> 0
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2399`) and writes `pClient->dwInitState` (`+0x04`, `eax = pClient`, `[esp+4] = dwState`, `ret 4`).
 *
 * @va D2Game:0x6FC69B70
 */
export function CLIENTS_SetClientInitState_6FC69B70_113c(
  m: Memory113c,
  pClient: number,
  dwState: number,
): void {
  hitD2GameVa113c(0x6FC69B70)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0x95f)
  }
  m.setU32((pClient + 0x04) >>> 0, dwState >>> 0)
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2212`) and returns zero-extended byte `m.u8(pClient + 0x08)` (`eax = pClient`).
 *
 * @va D2Game:0x6FC69BF0
 */
export function CLIENTS_GetClientByte08_6FC69BF0_113c(
  m: Memory113c,
  pClient: number,
): number {
  hitD2GameVa113c(0x6FC69BF0)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0x8a4)
  }
  return m.u8((pClient + 0x08) >>> 0)
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:2006`) and `(nAct & 0xFF) < 5` (`Clients.cpp:2007`),
 * then writes `pClient->nAct` (`+0x1AC = nAct & 0xFF`, `eax = pClient`, `cl = nAct`).
 *
 * @va D2Game:0x6FC69D70
 */
export function CLIENTS_SetClientActNo_6FC69D70_113c(
  m: Memory113c,
  pClient: number,
  nAct: number,
): void {
  hitD2GameVa113c(0x6FC69D70)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0x7d6)
  }
  const actByte = nAct & 0xff
  if (actByte >= 5) {
    throw new D2CommonAssertError('Clients.cpp', 0x7d7)
  }
  m.setU8((pClient + 0x1ac) >>> 0, actByte)
}

/**
 * Asserts `pGame != 0` (`Clients.cpp:233`, `eax = pGame`, `ecx = dwClientId`), walks `pGame->pClientList`
 * (`+0x88`, next at `+0x4A8`), and returns the matching `D2ClientStrc*` (`[pClient + 0x00] == dwClientId`) or `0`.
 *
 * @va D2Game:0x6FC69FE0
 */
export function CLIENTS_FindClientByIdInGame_6FC69FE0_113c(
  m: Memory113c,
  pGame: number,
  dwClientId: number,
): number {
  hitD2GameVa113c(0x6FC69FE0)
  if (pGame === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xe9)
  }
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  const target = dwClientId >>> 0
  while (pClient !== 0) {
    if ((m.u32(pClient) >>> 0) === target) {
      return pClient
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
  }
  return 0
}

/**
 * Zeroes `pClient->dwTrackedUnitCount` (`+0x3BC`, `esi = pClient`, `[esp+4] = pNodeArray`, `ret 4`)
 * and walks the 12-byte indexed chain starting at `pNodeArray[0]` (`[pUnit, _, nextIdx]`, continuing while
 * `pNodeArray[nextIdx].nextIdx != 0`), writing 9-byte entries `(bType, dwUnitId, wPosX, wPosY)` at
 * `pClient + 0x1CC + idx * 9` and incrementing `pClient + 0x3BC`.
 *
 * @va D2Game:0x6FC6A370
 */
export function CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c(
  m: Memory113c,
  pClient: number,
  pNodeArray: number,
): void {
  hitD2GameVa113c(0x6FC6A370)
  m.setU32((pClient + 0x3bc) >>> 0, 0)
  const base = pNodeArray >>> 0
  let pCur = base

  while (true) {
    const pUnit = m.u32(pCur) >>> 0
    const bUnitType = pUnit === 0 ? 6 : m.u32(pUnit) & 0xff
    const idx0 = m.u32((pClient + 0x3bc) >>> 0) >>> 0
    m.setU8((pClient + 0x1cc + imul32(idx0, 9)) >>> 0, bUnitType)

    const pUnit2 = m.u32(pCur) >>> 0
    const dwUnitId = pUnit2 === 0 ? 0xffffffff : m.u32((pUnit2 + 0x0c) >>> 0) >>> 0
    const idx1 = m.u32((pClient + 0x3bc) >>> 0) >>> 0
    m.setU32((pClient + 0x1cd + imul32(idx1, 9)) >>> 0, dwUnitId)

    const pUnit3 = m.u32(pCur) >>> 0
    const posX = pUnit3 !== 0 ? readUnitPosXInline113c(m, pUnit3) : 0
    const idx2 = m.u32((pClient + 0x3bc) >>> 0) >>> 0
    m.setU16((pClient + 0x1d1 + imul32(idx2, 9)) >>> 0, posX & 0xffff)

    const pUnit4 = m.u32(pCur) >>> 0
    const posY = pUnit4 !== 0 ? readUnitPosYInline113c(m, pUnit4) : 0
    const idx3 = m.u32((pClient + 0x3bc) >>> 0) >>> 0
    m.setU16((pClient + 0x1d3 + imul32(idx3, 9)) >>> 0, posY & 0xffff)

    m.setU32((pClient + 0x3bc) >>> 0, (m.u32((pClient + 0x3bc) >>> 0) + 1) >>> 0)

    const nextIdx = m.u32((pCur + 0x08) >>> 0) | 0
    pCur = (base + imul32(nextIdx, 12)) >>> 0
    if (m.u32((pCur + 0x08) >>> 0) === 0) {
      break
    }
  }
}

/**
 * Checks whether all `5` frame-stamp slots at `pClient + 0x3C0` (`eax = pPlayer`, `esi = pGame`)
 * are non-zero and within `0x8CA` (`2250`) frames of `pGame->dwGameFrame` (`+0xA8`), asserting on
 * invalid player (`Clients.cpp:3353`) or NULL client (`Clients.cpp:3356`).
 *
 * @va D2Game:0x6FC6A660
 */
export function CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC6A660)
  if (pPlayer === 0 || m.u32(pPlayer >>> 0) !== 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xd19)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xd1c)
  }
  for (let i = 0; i < 5; i++) {
    const slotFrame = m.u32((pClient + 0x3c0 + i * 4) >>> 0) >>> 0
    if (slotFrame === 0) {
      return 0
    }
    const elapsed = (m.u32((pGame + 0xa8) >>> 0) - slotFrame) >>> 0
    if (elapsed > 0x8ca) {
      return 0
    }
  }
  return 1
}

/**
 * Records `pGame->dwGameFrame` (`+0xA8`, `eax = pPlayer`, `edi = pGame`) into the first empty (`0`)
 * or expired (`(dwGameFrame - slot) >>> 0 > 0x8CA`) slot among `pClient + 0x3C0 .. +0x3D0`, asserting
 * on invalid player (`Clients.cpp:3335`) or NULL client (`Clients.cpp:3338`).
 *
 * @va D2Game:0x6FC6A6E0
 */
export function CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC6A6E0)
  if (pPlayer === 0 || m.u32(pPlayer >>> 0) !== 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xd07)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0xd0a)
  }
  for (let i = 0; i < 5; i++) {
    const slotFrame = m.u32((pClient + 0x3c0 + i * 4) >>> 0) >>> 0
    if (slotFrame === 0 || ((m.u32((pGame + 0xa8) >>> 0) - slotFrame) >>> 0) > 0x8ca) {
      m.setU32((pClient + 0x3c0 + i * 4) >>> 0, m.u32((pGame + 0xa8) >>> 0) >>> 0)
      return
    }
  }
}

/**
 * Asserts `pClient != 0` (`Clients.cpp:1931`, `eax = pClient`, `edi = pRoom`), calls
 * `CLIENTS_SetPlayerCurrentRoom113c` (`0x6FC6B1D0`) when `pRoom != pClient->pRoom` (`+0x1B4`),
 * and writes `pClient->pRoom = pRoom`.
 *
 * @va D2Game:0x6FC6B3C0
 */
export function CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(
  m: Memory113c,
  pClient: number,
  pRoom: number,
): void {
  hitD2GameVa113c(0x6FC6B3C0)
  if (pClient === 0) {
    throw new D2CommonAssertError('Clients.cpp', 0x78b)
  }
  const curRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
  if ((pRoom >>> 0) !== curRoom) {
    CLIENTS_SetPlayerCurrentRoom113c(m, pClient, pRoom >>> 0)
  }
  m.setU32((pClient + 0x1b4) >>> 0, pRoom >>> 0)
}

/**
 * Adds signed `nDelta` (`edx`) to `pUnit`'s (`ecx`) `STAT_DAMAGEPERCENT` (`0x19`, layer `0`)
 * when `nDelta != 0`.
 *
 * @va D2Game:0x6FC6C190
 */
export function SKILLS_AddDamagePercentStat_6FC6C190_113c(
  m: Memory113c,
  pUnit: number,
  nDelta: number,
): void {
  hitD2GameVa113c(0x6FC6C190)
  const delta = nDelta | 0
  if (delta === 0) return
  const cur = STATLIST_GetUnitStat113c(m, pUnit, 0x19, 0) | 0
  STATLIST_SetUnitStat113c(m, pUnit, 0x19, (cur + delta) | 0, 0)
}

/**
 * `Skills.txt` `SrvStFunc = 5` (`0x6FD2734C`, `__fastcall(ecx = pGame, edx = pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * validates `SkillsTxt[nSkillId] != 0`, refreshes `SUNIT_ValidatePathTargetUnit113c`, and returns `1`
 * when `PATH_GetTargetUnit113c(pUnit->pPath)` is non-NULL and distinct from `pUnit` (else `0`).
 *
 * @va D2Game:0x6FC6C1C0
 */
export function SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6C1C0)
  if (lookupSkillsTxtPtr113c(m, nSkillId) === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  if (pUnit === 0) return 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  return 1
}

/**
 * Heals `pUnit` (`ebx`) by up to `nHealAmount` (`eax`) hitpoints (`STAT_HITPOINTS = 6`), clamping
 * at `STATLIST_GetMaxLifeFromUnit113c(pUnit)` and returning the actual amount added (`0` if `nHealAmount <= 0`).
 *
 * @va D2Game:0x6FC6DF20
 */
export function SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(
  m: Memory113c,
  nHealAmount: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC6DF20)
  let heal = nHealAmount | 0
  if (heal <= 0) return 0
  const curLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0
  let nextLife = (curLife + heal) | 0
  if (nextLife > maxLife) {
    heal = (heal + ((maxLife - nextLife) | 0)) | 0
    nextLife = maxLife
  }
  STATLIST_SetUnitStat113c(m, pUnit, 6, nextLife, 0)
  return heal
}

/**
 * Reads `pOwner`'s (`eax`) Summon Resist stat (`0x15D`), allocates a `D2StatListStrc` merged onto
 * `pPet` (`edi`) with `bType = 1`, and populates fire (`0x27`, unless `stat 0x8E > 0`), lightning
 * (`0x29`, unless `stat 0x90 > 0`), cold (`0x2B`, unless `stat 0x94 > 0`), and poison (`0x2D`) resists.
 *
 * @va D2Game:0x6FC6E180
 */
export function SKILLS_ApplySummonResistStatList_6FC6E180_113c(
  m: Memory113c,
  pOwner: number,
  pPet: number,
): void {
  hitD2GameVa113c(0x6FC6E180)
  const resBonus = STATLIST_GetUnitStat113c(m, pOwner, 0x15d, 0) | 0
  if (resBonus === 0) return

  const ownerType = pPet === 0 ? 6 : m.u32(pPet >>> 0) >>> 0
  const ownerId = pPet === 0 ? 0xffffffff : m.u32((pPet + 0x0c) >>> 0) >>> 0
  const pStatList = STATLIST_AllocList113c(m, 0, ownerType, ownerId, 0, 0) >>> 0
  if (pStatList === 0) return

  STATLIST_MergeStatLists113c(m, pPet, pStatList, 1)
  if ((STATLIST_GetUnitStat113c(m, pPet, 0x8e, 0) | 0) <= 0) {
    STATLIST_SetStat113c(m, pStatList, 0x27, resBonus, 0)
  }
  if ((STATLIST_GetUnitStat113c(m, pPet, 0x90, 0) | 0) <= 0) {
    STATLIST_SetStat113c(m, pStatList, 0x29, resBonus, 0)
  }
  if ((STATLIST_GetUnitStat113c(m, pPet, 0x94, 0) | 0) <= 0) {
    STATLIST_SetStat113c(m, pStatList, 0x2b, resBonus, 0)
  }
  STATLIST_SetStat113c(m, pStatList, 0x2d, resBonus, 0)
}

/**
 * Sets `pPet`'s (`STAT_LEVEL = 0x0C`) level (`eax = pOwner`, `ecx = nOverrideLevel`,
 * stack `(pGame, pPet, nLevelBonus)`, `ret 0x0C`: using `nOverrideLevel` when `> 0`, else
 * `clamp(trunc((ownerLvl * 3) / 4) + nLevelBonus, 1, ownerLvl)`) and adds `MonLvlTxt` AC (`0x1F`)
 * and ToHit (`0x13`) for `(difficulty, isExpansion)`.
 *
 * @va D2Game:0x6FC6E2A0
 */
export function SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(
  m: Memory113c,
  pOwner: number,
  nOverrideLevel: number,
  pGame: number,
  pPet: number,
  nLevelBonus: number,
): number {
  hitD2GameVa113c(0x6FC6E2A0)
  let lvl = nOverrideLevel | 0
  if (lvl <= 0) {
    const ownerLvl = STATLIST_GetUnitStat113c(m, pOwner, 0x0c, 0) | 0
    let computed = (sdiv32(imul32(ownerLvl, 3), 4) + (nLevelBonus | 0)) | 0
    if (computed <= 1) {
      computed = 1
    }
    lvl = computed < ownerLvl ? computed : ownerLvl
    if (lvl !== 0) {
      STATLIST_SetUnitStat113c(m, pPet, 0x0c, lvl, 0)
    }
  } else {
    STATLIST_SetUnitStat113c(m, pPet, 0x0c, lvl, 0)
  }

  const pSgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = m.u32(pSgptPtr) >>> 0
  const nMonLvlCount = m.u32((pDataTables + 0xb74) >>> 0) | 0
  const maxIdx = (nMonLvlCount - 1) | 0
  const rowIdx = lvl < maxIdx ? lvl : maxIdx
  if (rowIdx < 0 || rowIdx >= nMonLvlCount) {
    return 0
  }
  const pMonLvlBase = m.u32((pDataTables + 0xb70) >>> 0) >>> 0
  const pMonLvlRec = (pMonLvlBase + imul32(rowIdx, 0x78)) >>> 0
  if (pMonLvlRec === 0) {
    return 0
  }

  const rawDiff = m.u8((pGame + 0x6d) >>> 0)
  const diff = rawDiff <= 0 ? 0 : rawDiff < 2 ? rawDiff : 2
  const isExp =
    m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 ? 1 : 0

  const acIdx = (diff + isExp * 3) | 0
  const acVal = m.u32((pMonLvlRec + acIdx * 4) >>> 0) | 0
  STATLIST_AddUnitStatMemPort113c(m, pPet, 0x1f, acVal, 0)

  const thIdx = (diff + (isExp + 2) * 3) | 0
  const thVal = m.u32((pMonLvlRec + thIdx * 4) >>> 0) | 0
  STATLIST_AddUnitStatMemPort113c(m, pPet, 0x13, thVal, 0)
  return 1
}

/**
 * Resolves Necromancer skeleton mastery tier from state `0x61` (`stat 0x15F`, defaulting to `1`)
 * on `pOwnerUnit` (`eax`) and applies Skeletal Mage components (`bHasShield = 0`, `bIsMage = 1`)
 * to `pMonster` (`[esp+4]`, `ret 4`) via `SKILLS_SetNecroSkeletonComponents113c` (`0x6FC6E390`).
 *
 * @va D2Game:0x6FC6E900
 */
export function SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c(
  m: Memory113c,
  pOwnerUnit: number,
  pMonster: number,
): void {
  hitD2GameVa113c(0x6FC6E900)
  const nTier = resolveNecroSkeletonTierFromState61_113c(m, pOwnerUnit)
  SKILLS_SetNecroSkeletonComponents113c(m, nTier, pMonster, pOwnerUnit, 0, 1)
}

/**
 * Resolves Necromancer skeleton mastery tier from state `0x61` (`stat 0x15F`, defaulting to `1`)
 * on `pOwnerUnit` (`ecx`), rolls shield appearance against `SkillsTxt[nSkillId].dwParam3` (`+0x148`,
 * `eax = nSkillId`) on `pOwnerUnit->pSeed` (`+0x20/+0x24`) when `nSkillLevel > 2` (`[esp+8]`),
 * and applies Skeleton warrior components (`bIsMage = 0`) to `pMonster` (`[esp+4]`, `ret 8`).
 *
 * @va D2Game:0x6FC6E960
 */
export function SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c(
  m: Memory113c,
  nSkillId: number,
  pOwnerUnit: number,
  pMonster: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FC6E960)
  const nTier = resolveNecroSkeletonTierFromState61_113c(m, pOwnerUnit)
  let bHasShield = 0
  if ((nSkillLevel | 0) > 2) {
    const pSkillsTxt = lookupSkillsTxtPtr113c(m, nSkillId)
    const shieldPct = pSkillsTxt !== 0 ? m.u32((pSkillsTxt + 0x148) >>> 0) | 0 : 0
    const seed: D2SeedStrc = {
      lo: m.u32((pOwnerUnit + 0x20) >>> 0),
      hi: m.u32((pOwnerUnit + 0x24) >>> 0),
    }
    const nextLo = seedNext(seed) >>> 0
    m.setU32((pOwnerUnit + 0x20) >>> 0, seed.lo)
    m.setU32((pOwnerUnit + 0x24) >>> 0, seed.hi)
    const roll = umod32(nextLo, 100) | 0
    if (roll < shieldPct) {
      bHasShield = 1
    }
  }
  SKILLS_SetNecroSkeletonComponents113c(m, nTier, pMonster, pOwnerUnit, bHasShield, 0)
}

/**
 * Curse expiration callback A (`ecx = pUnit`, `edx = nStateId`, `[esp+4] = _pArg`, `ret 4`):
 * resets alignment to `0` (`SUNIT_SetMonsterAlignmentState113c(m, pUnit, 0, 1)`), clears GFX state
 * `nStateId`, asserts `pUnit != 0` (`line 0xA2A`), and unlinks `pUnit` from `pUnit->pGame`'s room update list.
 *
 * @va D2Game:0x6FC6EB90
 */
export function SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c(
  m: Memory113c,
  pUnit: number,
  nStateId: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC6EB90)
  SUNIT_SetMonsterAlignmentState113c(m, pUnit, 0, 1)
  STATES_ToggleGfxStateFlag113c(m, pUnit, nStateId, 0)
  if (pUnit === 0) {
    throw new D2CommonAssertError('SkillNec.cpp', 0xa2a)
  }
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit)
}

/**
 * Curse expiration callback B (`ecx = pUnit`, `edx = nStateId`, `[esp+4] = _pArg`, `ret 4`):
 * resets alignment to `0` (`SUNIT_SetMonsterAlignmentState113c(m, pUnit, 0, 1)`), clears GFX state
 * `nStateId`, asserts `pUnit != 0` (`line 0xA2A`), and unlinks `pUnit` from `pUnit->pGame`'s room update list.
 *
 * @va D2Game:0x6FC6EBE0
 */
export function SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c(
  m: Memory113c,
  pUnit: number,
  nStateId: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC6EBE0)
  SUNIT_SetMonsterAlignmentState113c(m, pUnit, 0, 1)
  STATES_ToggleGfxStateFlag113c(m, pUnit, nStateId, 0)
  if (pUnit === 0) {
    throw new D2CommonAssertError('SkillNec.cpp', 0xa2a)
  }
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit)
}

/**
 * Checks whether Necromancer curse from `pCaster` (`[esp+8]`) in `pGame` (`[esp+4]`) can affect
 * `pTarget` (`esi`, `ret 8`): for `UNIT_MONSTER` requires `MONSTATS2_CheckModeBit113c(classId, 2) != 0`
 * and `(pMonsterData->bTypeFlags (+0x16) & 0x20) == 0`; requires `pTarget->dwFlags (+0xC4)` bits `1, 2, 3`
 * all set, `!SUNIT_IsDeadOrDying113c(pTarget)`, and `SUNIT_AreUnitsHostileOrUnaligned113c != 0`.
 *
 * @va D2Game:0x6FC6ECD0
 */
export function SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c(
  m: Memory113c,
  pTarget: number,
  pGame: number,
  pCaster: number,
): number {
  hitD2GameVa113c(0x6FC6ECD0)
  if (pTarget === 0) return 0
  const uType = m.u32(pTarget >>> 0) >>> 0
  if (uType === 1) {
    const nClassId = m.u32((pTarget + 0x04) >>> 0) | 0
    if (MONSTATS2_CheckModeBit113c(m, nClassId, 2) === 0) {
      return 0
    }
    const pMonData = m.u32((pTarget + 0x14) >>> 0) >>> 0
    if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 0x20) !== 0) {
      return 0
    }
  }
  const dwFlags = m.u32((pTarget + 0xc4) >>> 0) >>> 0
  if (((dwFlags >>> 2) & 1) === 0) return 0
  if (((dwFlags >>> 3) & 1) === 0) return 0
  if (((dwFlags >>> 1) & 1) === 0) return 0
  if (SUNIT_IsDeadOrDying113c(m, pTarget) !== 0) return 0
  return SUNIT_AreUnitsHostileOrUnaligned113c(m, pTarget, pCaster, pGame) !== 0 ? 1 : 0
}

/**
 * `Skills.txt` `SrvStFunc = 20` (`0x6FD27388`, `__fastcall(ecx = pGame, edx = pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * validates that `pUnit`'s path target is a distinct `UNIT_ITEM (4)` on ground (`mode == 3`) with
 * `ITEMS_CheckItemFlagCompactSaveByClassId113c != 0` (metal), `ITEMS_CheckCommandFlags113c(0x10) != 0`,
 * and `STATLIST_GetOwnerAndDynamicFlag113c == 0`.
 *
 * @va D2Game:0x6FC6EDD0
 */
export function SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6EDD0)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  if (pUnit === 0) return 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  if (m.u32(pTarget) !== 4) return 0
  if (m.u32((pTarget + 0x10) >>> 0) !== 3) return 0
  const nItemId = m.u32((pTarget + 0x04) >>> 0) | 0
  if (ITEMS_CheckItemFlagCompactSaveByClassId113c(m, nItemId) === 0) {
    return 0
  }
  if (
    ITEMS_CheckCommandFlags113c(m, pTarget, 0x10, 0x100, D2GAME_STR_SKILL_NEC_CPP_VA_113C) === 0
  ) {
    return 0
  }
  return STATLIST_GetOwnerAndDynamicFlag113c(m, pTarget, 0) === 0 ? 1 : 0
}

/**
 * `Skills.txt` `SrvStFunc = 19` (`0x6FD27384`, `__fastcall(ecx = pGame, edx = pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * validates `pUnit`'s path target and returns `1` iff the target unit is in a non-town room.
 *
 * @va D2Game:0x6FC6EE40
 */
export function SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6EE40)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  if (pUnit === 0) return 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  const pRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
  return DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) === 0 ? 1 : 0
}

/**
 * `Skills.txt` `SrvStFunc = 17` (`0x6FD2737C`, `__fastcall(ecx = pGame, edx = pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * validates `pUnit`'s path target is outside town and satisfies `SKILLS_IsSelectableCorpse11157_113c`.
 *
 * @va D2Game:0x6FC6EEE0
 */
export function SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6EEE0)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  if (pUnit === 0) return 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  const pRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
    return 0
  }
  return SKILLS_IsSelectableCorpse11157_113c(m, pTarget)
}

/**
 * `Skills.txt` `SrvStFunc = 15` (`0x6FD27374`, `__fastcall(ecx = pGame, edx = pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * validates `pUnit`'s path target is outside town and satisfies `SKILLS_IsSelectableCorpseWithVelocity113c(pTarget, 0)`.
 *
 * @va D2Game:0x6FC6EF20
 */
export function SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6EF20)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  if (pUnit === 0) return 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  const pRoom = UNITS_GetRoom113c(m, pTarget) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
    return 0
  }
  return SKILLS_IsSelectableCorpseWithVelocity113c(m, pTarget, 0)
}

/**
 * Corpse Explosion AoE target callback (`__fastcall(ecx = pAuraCtx, edx = pTarget)`):
 * copies the `0x70`-byte template `D2DamageStrc` from `pAuraCtx->pSubCtx->pDmg` (`[[ecx+0x0C]]`),
 * zeroes `dwPhysDamage` (`+0x08`) when `PATH_ComputeSquaredDistance113c(center, targetPos) > maxPhysDistSq`,
 * and applies damage + side effects via `SUNITDMG_ApplyDamage113c` and `SUNITDMG_ApplySideEffectsAndKill113c`.
 *
 * @va D2Game:0x6FC6F370
 */
export function SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(
  m: Memory113c,
  pAuraCtx: number,
  pTarget: number,
): number {
  hitD2GameVa113c(0x6FC6F370)
  const pSubCtx = m.u32((pAuraCtx + 0x0c) >>> 0) >>> 0
  if (pSubCtx === 0) return 0

  const pSrcDmg = m.u32(pSubCtx) >>> 0
  const sp = k2LaneLStackPtr
  k2LaneLStackPtr = (sp + 0x80) >>> 0
  try {
    for (let i = 0; i < 0x1c; i++) {
      m.setU32((sp + i * 4) >>> 0, m.u32((pSrcDmg + i * 4) >>> 0))
    }
    const posY = readUnitPosYInline113c(m, pTarget)
    const posX = readUnitPosXInline113c(m, pTarget)
    const centerX = m.u32((pSubCtx + 0x04) >>> 0) | 0
    const centerY = m.u32((pSubCtx + 0x08) >>> 0) | 0
    const distSq = PATH_ComputeSquaredDistance113c(centerX, centerY, posX, posY) | 0
    if ((m.u32((pSubCtx + 0x0c) >>> 0) | 0) < distSq) {
      m.setU32((sp + 0x08) >>> 0, 0)
    }

    const pGame1 = m.u32(pAuraCtx >>> 0) >>> 0
    const pAttacker1 = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
    // 0x6fc6f41a: push 0x1 (bApplyResists = 1), call 0x6fcfe0c0; 0x6fc6f433: call 0x6fcfcf20 once
    SUNITDMG_ApplyDamage113c(m, pGame1, pAttacker1, pTarget, sp, 1, undefined, 1)

    const pGame2 = m.u32(pAuraCtx >>> 0) >>> 0
    const pAttacker2 = m.u32((pAuraCtx + 0x04) >>> 0) >>> 0
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame2, pAttacker2, pTarget, sp)
    return 1
  } finally {
    k2LaneLStackPtr = sp
  }
}

/**
 * Applies `trunc(maxLife / 8)` self-damage (`dwHitFlags = 0x1000`, `wResultFlags = 0x04`) to `pUnit`
 * (`esi`, `ebx = pGame`) when `pUnit` is `UNIT_PLAYER (0)` with `dwClassId == 3` (Paladin).
 *
 * @va D2Game:0x6FC6F450
 */
export function SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC6F450)
  if (pUnit === 0) return
  if (m.u32(pUnit >>> 0) !== 0) return
  if (m.u32((pUnit + 0x04) >>> 0) !== 3) return

  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0
  const dmg = sdiv32(maxLife, 8)

  const sp = k2LaneLStackPtr
  k2LaneLStackPtr = (sp + 0x80) >>> 0
  try {
    m.fill(sp, 0x70, 0)
    m.setU32(sp, 0x1000)
    m.setU8((sp + 0x04) >>> 0, 0x04)
    m.setU32((sp + 0x08) >>> 0, dmg >>> 0)
    m.setU32((sp + 0x4c) >>> 0, dmg >>> 0)
    // 0x6fc6f499: push 0x0 (bApplyResists = 0), call 0x6fcfe0c0; 0x6fc6f4b7: call 0x6fcfcf20
    SUNITDMG_ApplyDamage113c(m, pGame, pUnit, pUnit, sp, 0, undefined, 1)
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pUnit, pUnit, sp)
  } finally {
    k2LaneLStackPtr = sp
  }
}

/**
 * `Skills.txt` `SrvDoFunc = 32` (`0x6FD27528`, `__fastcall(ecx = pGame, edx = pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * sets `pUnit->dwFlags |= 0x40`, validates `pUnit`'s path target, and executes combat events on `(pGame, pUnit, pTarget)`
 * via `SUNITDMG_ExecuteEvents113c` when a distinct target unit exists.
 *
 * @va D2Game:0x6FC6F920
 */
export function SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  _nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6F920)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  if (pUnit === 0) return 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  SUNITDMG_ExecuteEvents113c(m, pGame, pUnit, pTarget)
  return 1
}

/**
 * Maps `SkillsTxt[nSkillId].wSummonAi` (`+0x82`: `0x17 -> 10`, `0x1B -> 12`, `0x38 -> 11`, else `0`)
 * (`eax = nSkillId`, `edx = pMonster`, `[esp+4] = pGame`, `ret 4`) and transitions `pMonster`'s
 * `D2AiGeneralStrc` (`+0x28`) via `0x6FCBD230` (`AI_InitMonsterAiThinkFn113c`).
 *
 * @va D2Game:0x6FC700A0
 */
export function SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(
  m: Memory113c,
  nSkillId: number,
  pMonster: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC700A0)
  const pSkillsTxt = lookupSkillsTxtPtr113c(m, nSkillId)
  if (pSkillsTxt === 0) return

  const wSummonAi = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  let nSpecAi = 0
  if (wSummonAi === 0x17) {
    nSpecAi = 0x0a
  } else if (wSummonAi === 0x1b) {
    nSpecAi = 0x0c
  } else if (wSummonAi === 0x38) {
    nSpecAi = 0x0b
  }

  let pAiGeneral = 0
  if (pMonster !== 0 && m.u32(pMonster >>> 0) === 1) {
    const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
    }
  }

  // 0x6fc7010b / 0x6fc7011c: call 0x6fcbd230 (AI_InitMonsterAiThinkFn(pGame, pMonster, pAiGeneral, nSpecAi))
  AI_InitMonsterAiThinkFn113c(m, pMonster, pGame >>> 0, pAiGeneral, nSpecAi)
}

/**
 * Returns elapsed milliseconds: when `gbUsePerfCounter` (`[0x6FD303B0]`) is non-zero, queries
 * `QueryPerformanceCounter` and computes `_alldiv(_allmul(counter, 1000), gllPerfFreq)` (`[0x6FD303A0..0x6FD303A4]`);
 * otherwise returns `GetTickCount()` (`[0x6FD18D10]`).
 *
 * @va D2Game:0x6FC72020
 */
export function GAMETIME_GetElapsedMilliseconds_6FC72020_113c(
  m: Memory113c,
  hooks?: GameTimeHostHooks113c,
): number {
  hitD2GameVa113c(0x6FC72020)
  const useQpc = m.u32(D2GAME_USE_PERF_COUNTER_VA_113C) >>> 0
  if (useQpc !== 0) {
    const sp = k2LaneLStackPtr
    k2LaneLStackPtr = (sp + 0x10) >>> 0
    let counterLo = 0
    let counterHi = 0
    try {
      m.setU32(sp, 0)
      m.setU32((sp + 4) >>> 0, 0)
      if (hooks !== undefined && hooks.queryPerformanceCounter !== undefined) {
        hooks.queryPerformanceCounter(m, sp)
        counterLo = m.u32(sp) >>> 0
        counterHi = m.u32((sp + 4) >>> 0) >>> 0
      } else {
        const pQpcSource = m.u32(D2GAME_IAT_QUERY_PERFORMANCE_COUNTER_VA_113C) >>> 0
        if (pQpcSource !== 0) {
          counterLo = m.u32(pQpcSource) >>> 0
          counterHi = m.u32((pQpcSource + 4) >>> 0) >>> 0
        }
      }
    } finally {
      k2LaneLStackPtr = sp
    }

    const counter64 = BigInt.asIntN(
      64,
      (BigInt(counterHi) << 32n) | BigInt(counterLo),
    )
    const prod64 = BigInt.asIntN(64, counter64 * 1000n)

    const freqLo = m.u32(D2GAME_PERF_FREQ_LO_VA_113C) >>> 0
    const freqHi = m.u32(D2GAME_PERF_FREQ_HI_VA_113C) >>> 0
    const freq64 = BigInt.asIntN(64, (BigInt(freqHi) << 32n) | BigInt(freqLo))
    if (freq64 === 0n) {
      throw new RangeError('GAMETIME_GetElapsedMilliseconds_6FC72020_113c: division by zero (freq == 0)')
    }
    const quot64 = prod64 / freq64
    return Number(BigInt.asUintN(32, quot64)) >>> 0
  }

  if (hooks !== undefined && hooks.getTickCount !== undefined) {
    return hooks.getTickCount(m) >>> 0
  }
  return m.u32(D2GAME_IAT_GET_TICK_COUNT_VA_113C) >>> 0
}

/**
 * Counts saveable `UNIT_ITEM` entries in `pInventory` (`eax`), starting at `1` when
 * `INVENTORY_GetCursorItem113c(pInventory) != 0` and incrementing for each node along
 * `INVENTORY_GetFirstItem113c` / `INVENTORY_GetNextItem113c` that satisfies `INVENTORY_UnitIsItem113c`,
 * returning the 16-bit `uint16` count (`mov ax, bx`).
 *
 * @va D2Game:0x6FC73260
 */
export function PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c(
  m: Memory113c,
  pInventory: number,
): number {
  hitD2GameVa113c(0x6FC73260)
  if (pInventory === 0) {
    return 0
  }
  let count = 0
  if (INVENTORY_GetCursorItem113c(m, pInventory) !== 0) {
    count = 1
  }
  let pItem = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (pItem !== 0) {
    const isItem = INVENTORY_UnitIsItem113c(m, pItem)
    const pNext = INVENTORY_GetNextItem113c(m, pItem) >>> 0
    if (isItem !== 0) {
      count = (count + 1) | 0
    }
    pItem = pNext
  }
  return count & 0xffff
}
