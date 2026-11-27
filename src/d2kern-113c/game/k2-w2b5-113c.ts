/**
 * Diablo II v1.13c `D2Game.dll` Core, Skills, Monster AI, and Arena Pipeline (`[K2]` Wave 2 Batch 5 `w2b5`):
 * 45 `SKILLS`, `MONAI`, and `ARENA` functions (`0x6FCBE4F0..0x6FCD2620`, 2,691B total).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of its
 * corresponding `D2Game.dll` v1.13c machine-code routine operating on `Memory113c`.
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32 } from '../common/int-math.ts'
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts'
import { ITEMS_GetItemCell113c } from '../common/items.ts'
import { STATLIST_AddUnitStatMemPort113c } from '../common/k0-d2common-memports.ts'
import { SKILLS_GetThrowingWeaponMasteryBonus113c } from '../common/missile.ts'
import { PATH_GetTargetUnit113c } from '../common/path.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_GetSkillToHitBonus113c,
} from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_CheckStateMask33OnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNITS_GetSpawnedMonsterOrSkillSummonInfo113c,
  UNITS_IsDoor113c,
  UNITS_SetUnitAnimMode113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c.ts'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  AI_CalcApproxUnitDistSubtiles113c,
} from './ai-fallen-113c.ts'
import {
  AI_Stall113c,
  SUNITDMG_ExecuteEvents113c,
} from './combat-a1c-113c.ts'
import { SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c } from './k2-real-s2c-combat-113c.ts'
import { UNITS_GetDistanceToCoordinates113c } from './replay-kernel-113c.ts'
import {
  SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c,
  SKILLS_CanMonsterBeImpregnated_6FC2C110_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import { MONSTER_SetLastInteractTarget113c } from './k2-sunit-spawn-w1-113c.ts'
import { SUNIT_IsDeadOrDying113c } from './monster-events.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  SEED_RollLimitedFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** `D2Game.dll` `.rdata` `0x6FD1B980`: `"..\\Source\\D2Game\\SKILLS\\Skills.cpp"`. */
export const D2GAME_SKILLS_CPP_VA_113C = 0x6fd1b980

/** `D2Game.dll` `.rdata` `0x6FD1B568`: `"..\\Source\\D2Game\\GAME\\Arena.cpp"`. */
export const D2GAME_ARENA_CPP_VA_113C = 0x6fd1b568

/** Optional host callbacks for pool allocation/deallocation, melee hit-flag override, and unit-find filter dispatch. */
export interface K2W2B5Hooks113c {
  readonly allocPoolMemory?: (
    m: Memory113c,
    pMemPool: number,
    nSize: number,
    szFileVa: number,
    nLine: number,
    nZero: number,
  ) => number
  readonly freePoolMemory?: (
    m: Memory113c,
    pMemPool: number,
    pMem: number,
    szFileVa: number,
    nLine: number,
    nZero: number,
  ) => void
  readonly onUnitFindFilter?: (
    m: Memory113c,
    pfnFilter: number,
    pGame: number,
    pSelfUnit: number,
    pCandidateUnit: number,
    pUserContext: number,
  ) => number
  readonly onRollMeleeToHitFlags?: (
    m: Memory113c,
    pAttacker: number,
    pDefender: number,
    pGame: number,
    nToHitBonus: number,
    nWeaponRangePenalty: number,
  ) => number
}

function getDataTablesPtr113c(m: Memory113c): number {
  const ppDataTables = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (ppDataTables !== 0) {
    const pDataTables = m.u32(ppDataTables) >>> 0
    if (pDataTables !== 0) return pDataTables
  }
  return m.u32(0x6fde9e1c) >>> 0
}

function lookupSkillsTxtRecord113c(m: Memory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  if (pDataTables === 0) return 0
  const count = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (id >= count) return 0
  const base = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (base === 0) return 0
  return (base + imul32(id, 0x23c)) >>> 0
}

function lookupMonStatsTxtRecord113c(m: Memory113c, nClassId: number): number {
  const id = nClassId | 0
  if (id < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  if (pDataTables === 0) return 0
  const count = m.u32((pDataTables + 0xa80) >>> 0) | 0
  if (id >= count) return 0
  const base = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
  if (base === 0) return 0
  return (base + imul32(id, 0x1a8)) >>> 0
}

/**
 * Pure-memory helper for `D2Game:0x6FCFE5A0` (`SUNITDMG_RollMeleeToHitAndBlock`,
 * `edi = pAttacker`, `eax = pDefender`, `[esp+4] = pGame`, `[esp+8] = nToHitBonus`, `[esp+0xC] = nWeaponRangePenalty` -> `ax = wResultFlags`).
 */
function rollMeleeToHitAndBlock6FCFE5A0(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pGame: number,
  nToHitBonus: number,
  nWeaponRangePenalty: number,
  hooks?: K2W2B5Hooks113c,
): number {
  if (hooks !== undefined && hooks.onRollMeleeToHitFlags !== undefined) {
    return (
      hooks.onRollMeleeToHitFlags(
        m,
        pAttacker >>> 0,
        pDefender >>> 0,
        pGame >>> 0,
        nToHitBonus | 0,
        nWeaponRangePenalty | 0,
      ) & 0xffff
    )
  }
  const att = pAttacker >>> 0
  const def = pDefender >>> 0
  if (
    att !== 0 &&
    def !== 0 &&
    ((m.u32(att) | 0) === 0 || (m.u32(att) | 0) === 1) &&
    ((m.u32(def) | 0) === 0 || (m.u32(def) | 0) === 1) &&
    (SUNIT_AreUnitsHostileOrUnaligned113c(m, def, att, pGame >>> 0) | 0) === 0
  ) {
    SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(m, 0, def, pGame >>> 0, 0, 0)
    return 0
  }
  return (
    SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(
      m,
      att,
      def,
      pGame >>> 0,
      nToHitBonus | 0,
      nWeaponRangePenalty | 0,
    ) & 0xffff
  )
}

/**
 * [1/45] Applies throwing weapon mastery ToHit (`STAT_TOHIT = 0x13`) and DamagePercent (`STAT_DAMAGEPERCENT = 0x19`)
 * bonuses from `pUnit` + `pWeapon` (`D2Common.#10228`) onto `pMissile`.
 *
 * Binary convention: `edi = pUnit`, `esi = pMissile`, `ebx = pWeapon` (`ret`).
 *
 * @va D2Game.dll@0x6fcbe4f0
 * @va D2Game:0x6FCBE4F0 (77B)
 */
export function SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c(
  m: Memory113c,
  pUnit: number,
  pMissile: number,
  pWeapon: number,
): void {
  hitD2GameVa113c(0x6FCBE4F0)
  if (pUnit === 0 || pMissile === 0 || pWeapon === 0) return
  const curToHit = STATLIST_GetUnitStat113c(m, pMissile >>> 0, 0x13, 0) | 0
  const rawBonusToHit = SKILLS_GetThrowingWeaponMasteryBonus113c(
    m,
    pUnit >>> 0,
    pWeapon >>> 0,
    0,
    0,
    0,
  )
  const bonusToHit = rawBonusToHit === null ? 0 : rawBonusToHit | 0
  STATLIST_SetUnitStat113c(m, pMissile >>> 0, 0x13, (bonusToHit + curToHit) | 0, 0)

  const rawBonusDmg = SKILLS_GetThrowingWeaponMasteryBonus113c(
    m,
    pUnit >>> 0,
    pWeapon >>> 0,
    0,
    1,
    0,
  )
  const bonusDmg = rawBonusDmg === null ? 0 : rawBonusDmg | 0
  STATLIST_AddUnitStatMemPort113c(m, pMissile >>> 0, 0x19, bonusDmg, 0)
}

/**
 * [2/45] Unit-find callback that increments the dword counter pointed to by `[pFindData + 0x0C]`
 * and returns `1`.
 *
 * Binary convention: `ecx = pFindData` (`ret`).
 *
 * @va D2Game.dll@0x6fcbe600
 * @va D2Game:0x6FCBE600 (11B)
 */
export function SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c(
  m: Memory113c,
  pFindData: number,
): number {
  hitD2GameVa113c(0x6FCBE600)
  const pCount = m.u32((pFindData + 0x0c) >>> 0) >>> 0
  m.setU32(pCount, ((m.u32(pCount) | 0) + 1) >>> 0)
  return 1
}

/**
 * [3/45] Allocates a `D2StatListStrc` (`flags = 4`), merges it into `pUnit` (`bType = 1`),
 * sets `STAT_VELOCITYPERCENT (0x44) = nVelPct`, and refreshes `pUnit`'s animation mode (`D2Common.#10819`).
 *
 * Binary convention: `edi = pUnit`, `[esp+4] = nVelPct` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcbe7b0
 * @va D2Game:0x6FCBE7B0 (83B)
 */
export function SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c(
  m: Memory113c,
  pUnit: number,
  nVelPct: number,
): void {
  hitD2GameVa113c(0x6FCBE7B0)
  const dwOwnerId = pUnit === 0 ? 0xffffffff : m.u32((pUnit + 0x0c) >>> 0) >>> 0
  const dwOwnerType = pUnit === 0 ? 6 : m.u32(pUnit >>> 0) >>> 0
  const pStatList = STATLIST_AllocList113c(m, 4, dwOwnerType, dwOwnerId, 0, 0) >>> 0
  if (pStatList !== 0) {
    STATLIST_MergeStatLists113c(m, pUnit >>> 0, pStatList, 1)
    STATLIST_SetStat113c(m, pStatList, 0x44, nVelPct | 0, 0)
    UNITS_SetUnitAnimMode113c(m, pUnit >>> 0, D2GAME_SKILLS_CPP_VA_113C, 0x12ab)
  }
}

/**
 * [4/45] Evaluates `pSkillsTxt->dwPerDelay (+0x128)` via `D2Common.#10786`, clamps `nPeriod`
 * to a minimum of `5`, and returns `Math.trunc((pGame->dwGameFrame + nPeriod - 1) / nPeriod) * nPeriod + 1`.
 *
 * Binary convention: `eax = nSkillLevel`, `ecx = nSkillId`, `edx = pSkillsTxt`,
 * `[esp+4] = pGame`, `[esp+8] = pUnit` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcbe970
 * @va D2Game:0x6FCBE970 (55B)
 */
export function SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c(
  m: Memory113c,
  nSkillLevel: number,
  nSkillId: number,
  pSkillsTxt: number,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCBE970)
  const dwCalc = m.u32((pSkillsTxt + 0x128) >>> 0) >>> 0
  let nPeriod =
    SKILLS_EvalCalcByOffset113c(m, pUnit >>> 0, dwCalc, nSkillId | 0, nSkillLevel | 0) | 0
  if (nPeriod <= 5) {
    nPeriod = 5
  }
  const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const numer = (dwGameFrame + nPeriod - 1) | 0
  const quot = Math.trunc(numer / nPeriod) | 0
  return (imul32(quot, nPeriod) + 1) | 0
}

/**
 * [5/45] Writes `nDuration` into the elemental length field of `pDmg` according to
 * `pSkillsTxt->bEType (+0x1DC)`: `4 -> +0x30` (ColdLen), `5 -> +0x2C` (PoisLen),
 * `9 -> +0x44` (StunLen), `11 -> +0x18` (BurnLen), `12 -> +0x34` (FrzLen).
 *
 * Binary convention: `eax = nSkillId`, `edx = nDuration`, `esi = pDmg` (`ret`).
 *
 * @va D2Game.dll@0x6fcbe9b0
 * @va D2Game:0x6FCBE9B0 (86B)
 */
export function SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c(
  m: Memory113c,
  nSkillId: number,
  nDuration: number,
  pDmg: number,
): void {
  hitD2GameVa113c(0x6FCBE9B0)
  const pSkillsTxt = lookupSkillsTxtRecord113c(m, nSkillId)
  if (pSkillsTxt === 0) return
  const bEType = m.u8((pSkillsTxt + 0x1dc) >>> 0)
  switch (bEType) {
    case 4:
      m.setU32((pDmg + 0x30) >>> 0, nDuration >>> 0)
      return
    case 5:
      m.setU32((pDmg + 0x2c) >>> 0, nDuration >>> 0)
      return
    case 9:
      m.setU32((pDmg + 0x44) >>> 0, nDuration >>> 0)
      return
    case 11:
      m.setU32((pDmg + 0x18) >>> 0, nDuration >>> 0)
      return
    case 12:
      m.setU32((pDmg + 0x34) >>> 0, nDuration >>> 0)
      return
    default:
      return
  }
}

/**
 * [6/45] Returns `1` iff `pUnit` is a player (`dwUnitType == 0`) whose `dwClassId (+0x04)`
 * equals the signed byte `pSkillsTxt->nCharClass (+0x0C)`.
 *
 * Binary convention: `eax = nSkillId`, `edx = pUnit` (`ret`).
 *
 * @va D2Game.dll@0x6fcbeb30
 * @va D2Game:0x6FCBEB30 (71B)
 */
export function SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c(
  m: Memory113c,
  nSkillId: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCBEB30)
  if (pUnit === 0) return 0
  if ((m.u32(pUnit >>> 0) | 0) !== 0) return 0
  const pSkillsTxt = lookupSkillsTxtRecord113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0
  const nCharClass = (m.u8((pSkillsTxt + 0x0c) >>> 0) << 24) >> 24
  const dwClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  return nCharClass === dwClassId ? 1 : 0
}

/**
 * [7/45] Consumes `nManaCostFixed` from `pUnit`: returns `1` immediately for non-player units;
 * delegates to `SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c` when `STATE_BLOOD_MANA (0x72)` is active;
 * otherwise requires `STAT_MANA (8) >= nManaCostFixed` and subtracts `nManaCostFixed` from `STAT_MANA`.
 *
 * Binary convention: `ecx = pUnit`, `eax = nManaCostFixed` (`ret`).
 *
 * @va D2Game.dll@0x6fcbed20
 * @va D2Game:0x6FCBED20 (77B)
 */
export function SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c(
  m: Memory113c,
  pUnit: number,
  nManaCostFixed: number,
): number {
  hitD2GameVa113c(0x6FCBED20)
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 0) return 1
  if ((STATES_CheckState113c(m, pUnit >>> 0, 0x72) | 0) !== 0) {
    return SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c(m, pUnit >>> 0, nManaCostFixed | 0) | 0
  }
  const curMana = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 8, 0) | 0
  if (curMana < (nManaCostFixed | 0)) {
    return 0
  }
  STATLIST_AddUnitStatMemPort113c(m, pUnit >>> 0, 8, -(nManaCostFixed | 0), 0)
  return 1
}

/**
 * [8/45] Unit-find callback that tracks the smallest unsigned unit GUID strictly greater than
 * `pCtx->dwPrevGuid (+0x10)` in `pCtx->pBestAfter (+0x00)` / `pCtx->dwBestAfterGuid (+0x04)`,
 * and the overall minimum unsigned GUID in `pCtx->pMinUnit (+0x08)` / `pCtx->dwMinGuid (+0x0C)`,
 * while incrementing `pCtx->nCount (+0x14)`.
 *
 * Binary convention: `ecx = pFindData`, `edx = pCandidateUnit` (`ret`).
 *
 * @va D2Game.dll@0x6fcbed70
 * @va D2Game:0x6FCBED70 (63B)
 */
export function SKILLS_TargetRingScanCallback_6FCBED70_113c(
  m: Memory113c,
  pFindData: number,
  pCandidateUnit: number,
): number {
  hitD2GameVa113c(0x6FCBED70)
  const pCtx = m.u32((pFindData + 0x0c) >>> 0) >>> 0
  const dwGuid =
    pCandidateUnit === 0 ? 0xffffffff : m.u32((pCandidateUnit + 0x0c) >>> 0) >>> 0
  const dwPrevGuid = m.u32((pCtx + 0x10) >>> 0) >>> 0
  const dwBestAfterGuid = m.u32((pCtx + 0x04) >>> 0) >>> 0
  if (dwGuid > dwPrevGuid && dwGuid < dwBestAfterGuid) {
    m.setU32((pCtx + 0x04) >>> 0, dwGuid)
    const nextCount = ((m.u32((pCtx + 0x14) >>> 0) | 0) + 1) >>> 0
    m.setU32(pCtx, pCandidateUnit >>> 0)
    m.setU32((pCtx + 0x14) >>> 0, nextCount)
    return 1
  }
  const dwMinGuid = m.u32((pCtx + 0x0c) >>> 0) >>> 0
  if (dwGuid <= dwMinGuid) {
    m.setU32((pCtx + 0x0c) >>> 0, dwGuid)
    m.setU32((pCtx + 0x08) >>> 0, pCandidateUnit >>> 0)
  }
  m.setU32((pCtx + 0x14) >>> 0, ((m.u32((pCtx + 0x14) >>> 0) | 0) + 1) >>> 0)
  return 1
}

/**
 * [9/45] Queries `UNITS_GetSpawnedMonsterOrSkillSummonInfo113c` (`D2Common.#11086`) and validates
 * the returned monster class ID against `nMonStatsTxtRecordCount (+0xA80)`; if out of range, falls back
 * to `pUnit->pMonsterData->pMonStatsTxt->wMinion1 (+0x3C)` when `> 0` and `< nMonStatsTxtRecordCount`,
 * or returns `-1`.
 *
 * Binary convention: `eax = pOutY`, `ecx = pOutX`, `edx = pOutMode`,
 * `[esp+4] = pUnit`, `[esp+8] = bIsMonsterSpawn`, `[esp+0xC] = nSkillId`, `[esp+0x10] = nArg4` (`ret 0x10`).
 *
 * @va D2Game.dll@0x6fcbee50
 * @va D2Game:0x6FCBEE50 (96B)
 */
export function SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(
  m: Memory113c,
  pOutY: number,
  pOutX: number,
  pOutMode: number,
  pUnit: number,
  bIsMonsterSpawn: number,
  nSkillId: number,
  nArg4: number,
): number {
  hitD2GameVa113c(0x6FCBEE50)
  let nMonId =
    UNITS_GetSpawnedMonsterOrSkillSummonInfo113c(
      m,
      pUnit >>> 0,
      bIsMonsterSpawn | 0,
      nSkillId | 0,
      nArg4 | 0,
      pOutMode >>> 0,
      pOutX >>> 0,
      pOutY >>> 0,
    ) | 0
  const pDataTables = getDataTablesPtr113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0
  if (nMonId >= 0 && nMonId < nMonStatsCount) {
    return nMonId
  }
  let pMonStatsTxt = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pMonStatsTxt = m.u32((pMonData + 0x28) >>> 0) >>> 0
    }
  }
  nMonId = m.u32((pMonStatsTxt + 0x3c) >>> 0) | 0
  if (nMonId > 0 && nMonId < nMonStatsCount) {
    return nMonId
  }
  return -1
}

/**
 * [10/45] Evaluates skill physical min/max damage (`D2Common.#10567` / `D2Common.#10297`),
 * rolls `[0, max - min)` on `pUnit->pSeed (+0x20)` (`0x6FC211D0`), and adds `min + roll`
 * into `pDmg->dwPhysDamage (+0x08)`.
 *
 * Binary convention: `ebx = pUnit`, `eax = nSkillId`, `[esp+4] = pDmg`, `[esp+8] = nSkillLevel` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcbf1a0
 * @va D2Game:0x6FCBF1A0 (100B)
 */
export function SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  pDmg: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FCBF1A0)
  const pSkillsTxt = lookupSkillsTxtRecord113c(m, nSkillId)
  if (pSkillsTxt === 0) return
  const nMinDmg =
    SKILLS_GetSkillPhysMinDamage113c(m, pUnit >>> 0, nSkillId | 0, nSkillLevel | 0, 0) | 0
  const nMaxDmg =
    SKILLS_GetSkillPhysMaxDamage113c(m, pUnit >>> 0, nSkillId | 0, nSkillLevel | 0, 0) | 0
  const nRoll =
    SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, (nMaxDmg - nMinDmg) | 0) | 0
  const curPhys = m.u32((pDmg + 0x08) >>> 0) | 0
  m.setU32((pDmg + 0x08) >>> 0, (curPhys + nMinDmg + nRoll) >>> 0)
}

/**
 * [11/45] Resolves `pDmg->wResultFlags (+0x04)` for a skill melee attack: if `pSkillsTxt->wResultFlags (+0x12E)`
 * has bit `0` (`RESULTFLAG_HIT`) set, copies `wResultFlags` directly; otherwise computes `SKILLS_GetSkillToHitBonus113c`
 * (`D2Common.#10653`), rolls `0x6FCFE5A0`, writes `pDmg->wResultFlags`, and ORs in `pSkillsTxt->wResultFlags` when bit `0` hit.
 *
 * Binary convention: `ebx = pSkillsTxt`, `esi = pDmg`, `ecx = nSkillLevel`, `edx = nSkillId`,
 * `[esp+4] = pGame`, `[esp+8] = pAttacker`, `[esp+0xC] = pDefender`, `[esp+0x10] = nWeaponRangePenalty` (`ret 0x10`).
 *
 * @va D2Game.dll@0x6fcc11b0
 * @va D2Game:0x6FCC11B0 (85B)
 */
export function SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c(
  m: Memory113c,
  pSkillsTxt: number,
  pDmg: number,
  nSkillLevel: number,
  nSkillId: number,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  nWeaponRangePenalty: number,
  hooks?: K2W2B5Hooks113c,
): number {
  hitD2GameVa113c(0x6FCC11B0)
  const wSkillFlags = m.u16((pSkillsTxt + 0x12e) >>> 0)
  if ((wSkillFlags & 1) !== 0) {
    m.setU16((pDmg + 0x04) >>> 0, wSkillFlags)
    return m.u16((pDmg + 0x04) >>> 0)
  }
  const nToHitBonus =
    SKILLS_GetSkillToHitBonus113c(m, pAttacker >>> 0, nSkillId | 0, nSkillLevel | 0) | 0
  const wHitFlags = rollMeleeToHitAndBlock6FCFE5A0(
    m,
    pAttacker >>> 0,
    pDefender >>> 0,
    pGame >>> 0,
    nToHitBonus,
    nWeaponRangePenalty | 0,
    hooks,
  )
  m.setU16((pDmg + 0x04) >>> 0, wHitFlags)
  if ((wHitFlags & 1) !== 0) {
    const wCombined = (m.u16((pSkillsTxt + 0x12e) >>> 0) | wHitFlags) & 0xffff
    m.setU16((pDmg + 0x04) >>> 0, wCombined)
    return wCombined
  }
  return m.u16((pDmg + 0x04) >>> 0)
}

/**
 * [12/45] Sets `UNITFLAG_IN_SKILL_ACTION (0x40)` on `pUnit->dwFlags (+0xC4)`, validates `pUnit`'s path target
 * (`0x6FD007A0`), and if `pTarget != 0 && pTarget != pUnit`, executes damage events (`0x6FCFED30`) and returns `1`.
 *
 * Binary convention: `edi = pGame`, `esi = pUnit` (`ret`).
 *
 * @va D2Game.dll@0x6fcc20c0
 * @va D2Game:0x6FCC20C0 (54B)
 */
export function SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCC20C0)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) {
    return 0
  }
  SUNITDMG_ExecuteEvents113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 1, 0)
  return 1
}

/**
 * [13/45] Empty AI callback stub (`ret 4`).
 *
 * Binary convention: `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc3880
 * @va D2Game:0x6FCC3880 (3B)
 */
export function MONAI_NoOpRet4_6FCC3880_113c(
  _m: Memory113c,
  _pGame = 0,
  _pUnit = 0,
  _pAiArgs = 0,
): void {
  hitD2GameVa113c(0x6FCC3880)
}

/**
 * [14/45] Asserts `pUnit1 != 0` (line `0x15CA`) and `pUnit2 != 0` (line `0x15CB`),
 * then returns `1` iff both units' rooms belong to the same level ID (`D2Common.#10331` + `D2Common.#10826`).
 *
 * Binary convention: `__fastcall(ecx = pUnit1, edx = pUnit2)` (`ret`).
 *
 * @va D2Game.dll@0x6fcc38c0
 * @va D2Game:0x6FCC38C0 (88B)
 */
export function MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
): number {
  hitD2GameVa113c(0x6FCC38C0)
  if (pUnit1 === 0) {
    throw new D2CommonAssertError('', 0x15ca)
  }
  if (pUnit2 === 0) {
    throw new D2CommonAssertError('', 0x15cb)
  }
  const pRoom1 = UNITS_GetRoom113c(m, pUnit1 >>> 0) >>> 0
  const nLevel1 = DUNGEON_GetLevelIdFromRoom113c(m, pRoom1) | 0
  const pRoom2 = UNITS_GetRoom113c(m, pUnit2 >>> 0) >>> 0
  const nLevel2 = DUNGEON_GetLevelIdFromRoom113c(m, pRoom2) | 0
  return nLevel1 === nLevel2 ? 1 : 0
}

/**
 * [15/45] Empty AI callback stub (`ret 4`).
 *
 * Binary convention: `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc3920
 * @va D2Game:0x6FCC3920 (3B)
 */
export function MONAI_NoOpRet4_6FCC3920_113c(
  _m: Memory113c,
  _pGame = 0,
  _pUnit = 0,
  _pAiArgs = 0,
): void {
  hitD2GameVa113c(0x6FCC3920)
}

/**
 * [16/45] Empty AI callback stub (`ret 4`).
 *
 * Binary convention: `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc3930
 * @va D2Game:0x6FCC3930 (3B)
 */
export function MONAI_NoOpRet4_6FCC3930_113c(
  _m: Memory113c,
  _pGame = 0,
  _pUnit = 0,
  _pAiArgs = 0,
): void {
  hitD2GameVa113c(0x6FCC3930)
}

/**
 * [17/45] Clears `pAiControl->dwAiParam0 (+0x14) = 0` where `pAiControl = [pAiArgs]`.
 *
 * Binary convention: `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc3980
 * @va D2Game:0x6FCC3980 (16B)
 */
export function MONAI_ClearAiControlParam0_6FCC3980_113c(
  m: Memory113c,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC3980)
  const pAiControl = m.u32(pAiArgs >>> 0) >>> 0
  m.setU32((pAiControl + 0x14) >>> 0, 0)
}

/**
 * [18/45] Initializes `pAiControl = [pAiArgs]` with `dwAiParam0 (+0x14) = -1`,
 * `dwAiParam1 (+0x18) = 1`, and `dwAiParam2 (+0x1C) = 0`.
 *
 * Binary convention: `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc3990
 * @va D2Game:0x6FCC3990 (30B)
 */
export function MONAI_InitAiControlDefaultParams_6FCC3990_113c(
  m: Memory113c,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC3990)
  const pAiControl = m.u32(pAiArgs >>> 0) >>> 0
  m.setU32((pAiControl + 0x14) >>> 0, 0xffffffff)
  m.setU32((pAiControl + 0x18) >>> 0, 1)
  m.setU32((pAiControl + 0x1c) >>> 0, 0)
}

/**
 * [19/45] Initializes `pAiControl = [pAiArgs]` with `dwAiParam0 (+0x14) = pGame->dwGameFrame (+0xA8)`
 * and `dwAiParam1 (+0x18) = -1`.
 *
 * Binary convention: `ecx = pGame`, `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc39b0
 * @va D2Game:0x6FCC39B0 (25B)
 */
export function MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c(
  m: Memory113c,
  pGame: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC39B0)
  const pAiControl = m.u32(pAiArgs >>> 0) >>> 0
  const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
  m.setU32((pAiControl + 0x14) >>> 0, dwGameFrame)
  m.setU32((pAiControl + 0x18) >>> 0, 0xffffffff)
}

/**
 * [20/45] Empty AI callback stub (`ret 4`).
 *
 * Binary convention: `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc39d0
 * @va D2Game:0x6FCC39D0 (3B)
 */
export function MONAI_NoOpRet4_6FCC39D0_113c(
  _m: Memory113c,
  _pGame = 0,
  _pUnit = 0,
  _pAiArgs = 0,
): void {
  hitD2GameVa113c(0x6FCC39D0)
}

/**
 * [21/45] Unit-find filter callback that matches an object unit (`dwUnitType == 2`) with
 * `dwClassId == 0x233` (`563`, Worldstone Chamber object) whose `UNITS_GetApproximateDistance113c`
 * (`D2Common.#10522`) to `pSelfUnit` is `<= [pScanCtx + 0x04]`, returning `pCandidateUnit` (or `0`).
 *
 * Binary convention: `ecx = pGame`, `edx = pSelfUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pScanCtx` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcc39e0
 * @va D2Game:0x6FCC39E0 (61B)
 */
export function MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c(
  m: Memory113c,
  _pGame: number,
  pSelfUnit: number,
  pCandidateUnit: number,
  pScanCtx: number,
): number {
  hitD2GameVa113c(0x6FCC39E0)
  if (pCandidateUnit === 0) return 0
  if ((m.u32(pCandidateUnit >>> 0) | 0) !== 2) return 0
  if ((m.u32((pCandidateUnit + 0x04) >>> 0) | 0) !== 0x233) return 0
  const nDist =
    UNITS_GetApproximateDistance113c(m, pCandidateUnit >>> 0, pSelfUnit >>> 0) | 0
  const nMaxDist = m.u32((pScanCtx + 0x04) >>> 0) | 0
  return nDist <= nMaxDist ? pCandidateUnit >>> 0 : 0
}

/**
 * [22/45] Evaluates `nSkillLvl = pUnit != 0 ? SKILLS_EvaluateSkillLevel113c(pUnit, pSkill, 1) : 1`
 * (`D2Common.#10306`), adds `Math.trunc(pAiControl->dwAiParam2 / 3) + Math.trunc(nSkillLvl / 2)`,
 * and clamps the result to a minimum of `1`.
 *
 * Binary convention: `eax = pUnit`, `ecx = pSkill`, `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc3ae0
 * @va D2Game:0x6FCC3AE0 (68B)
 */
export function MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
  pAiArgs: number,
): number {
  hitD2GameVa113c(0x6FCC3AE0)
  let nSkillLvl = 1
  if (pUnit !== 0) {
    nSkillLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit >>> 0, pSkill >>> 0, 1) | 0
  }
  const pAiControl = m.u32(pAiArgs >>> 0) >>> 0
  const nParam2 = m.u32((pAiControl + 0x1c) >>> 0) | 0
  const nTotal = (Math.trunc(nParam2 / 3) + Math.trunc(nSkillLvl / 2)) | 0
  return nTotal > 1 ? nTotal : 1
}

/**
 * [23/45] Initializes `pAiControl = [pAiArgs]` with `dwAiParam0 (+0x14) = -1`,
 * `dwAiParam1 (+0x18) = sx16(pMonStatsTxt->wAiParam[2][bDifficulty] (+0x62)) + 1`,
 * steps `pUnit->pSeed (+0x20)` (`64`-bit LCG `* 0x6AC690C5 + carry`), and sets
 * `dwAiParam2 (+0x1C) = seedLo & 1`.
 *
 * Binary convention: `ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc3c30
 * @va D2Game:0x6FCC3C30 (71B)
 */
export function MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC3C30)
  const pMonStatsTxt = m.u32((pAiArgs + 0x1c) >>> 0) >>> 0
  const pAiControl = m.u32(pAiArgs >>> 0) >>> 0
  m.setU32((pAiControl + 0x14) >>> 0, 0xffffffff)
  const bDifficulty = m.u8((pGame + 0x6d) >>> 0)
  const wAip3 = (m.u16((pMonStatsTxt + 0x62 + bDifficulty * 2) >>> 0) << 16) >> 16
  m.setU32((pAiControl + 0x18) >>> 0, ((wAip3 + 1) | 0) >>> 0)

  const lo = BigInt(m.u32((pUnit + 0x20) >>> 0) >>> 0)
  const hi = BigInt(m.u32((pUnit + 0x24) >>> 0) >>> 0)
  const prod = lo * 0x6ac690c5n + hi
  const nextLo = Number(prod & 0xffffffffn) >>> 0
  const nextHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pUnit + 0x20) >>> 0, nextLo)
  m.setU32((pUnit + 0x24) >>> 0, nextHi)
  m.setU32((pAiControl + 0x1c) >>> 0, (nextLo & 1) >>> 0)
}

/**
 * [24/45] Resolves `pUnit`'s base skill level for `nSkillId` (`D2Common.#10708` + `D2Common.#10306`,
 * defaulting to `1`), computes `Math.trunc(nSkillLvl / 2) + Math.trunc(nBaseBonus / 2)`,
 * and clamps the result to `[1, 0x18]`.
 *
 * Binary convention: `esi = pUnit`, `eax = nSkillId`, `[esp+4] = nBaseBonus` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc3d00
 * @va D2Game:0x6FCC3D00 (83B)
 */
export function MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  nBaseBonus: number,
): number {
  hitD2GameVa113c(0x6FCC3D00)
  let nSkillLvl = 1
  if (pUnit !== 0) {
    const pSkill = SKILLS_GetSkillById113c(m, pUnit >>> 0, nSkillId | 0, -1) >>> 0
    if (pSkill !== 0) {
      nSkillLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit >>> 0, pSkill, 0) | 0
    }
  }
  const nSum = (Math.trunc(nSkillLvl / 2) + Math.trunc((nBaseBonus | 0) / 2)) | 0
  if (nSum <= 1) return 1
  return nSum < 0x18 ? nSum : 0x18
}

/**
 * [25/45] Asserts `pUnit1 != 0` (line `0x36C`) and `pUnit2 != 0` (line `0x36D`), checks
 * `pUnit1->bAct (+0x18) == pUnit2->bAct (+0x18)`, and returns `1` iff the unsigned octile distance
 * (`0x6FCD08F0`) between `pUnit1` and `pUnit2` is `< 0x3FC` (`1020`).
 *
 * Binary convention: `__fastcall(ecx = pUnit1, edx = pUnit2)` (`ret`).
 *
 * @va D2Game.dll@0x6fcc3e10
 * @va D2Game:0x6FCC3E10 (100B)
 */
export function MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
): number {
  hitD2GameVa113c(0x6FCC3E10)
  if (pUnit1 === 0) {
    throw new D2CommonAssertError('', 0x36c)
  }
  if (pUnit2 === 0) {
    throw new D2CommonAssertError('', 0x36d)
  }
  if (m.u8((pUnit1 + 0x18) >>> 0) !== m.u8((pUnit2 + 0x18) >>> 0)) {
    return 0
  }
  const y1 = UNIT_GetPosY113c(m, pUnit1 >>> 0) | 0
  const x1 = UNIT_GetPosX113c(m, pUnit1 >>> 0) | 0
  const dist = UNITS_GetDistanceToCoordinates113c(m, pUnit2 >>> 0, x1, y1) >>> 0
  return dist < 0x3fc ? 1 : 0
}

/**
 * [26/45] Unit-find filter callback that checks `SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(pCandidateUnit)`
 * and `AI_CalcApproxUnitDistSubtiles113c(pSelfUnit, pCandidateUnit) <= 0x19` (`25`), returning `pCandidateUnit` (or `0`).
 *
 * Binary convention: `ecx = pGame`, `edx = pSelfUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pContext` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcc4180
 * @va D2Game:0x6FCC4180 (46B)
 */
export function MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c(
  m: Memory113c,
  _pGame: number,
  pSelfUnit: number,
  pCandidateUnit: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCC4180)
  if (SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, pCandidateUnit >>> 0) === 0) {
    return 0
  }
  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pSelfUnit >>> 0, pCandidateUnit >>> 0) >>> 0
  return (0x19 >>> 0) >= dist ? pCandidateUnit >>> 0 : 0
}

/**
 * [27/45] Validates `pUnit`'s path target (`0x6FD007A0`), retrieves `pTarget = PATH_GetTargetUnit113c(pUnit->pPath)`,
 * and when `pTarget != 0 && pTarget != pUnit`, records `pTarget->dwUnitId (+0x0C)` via `0x6FC68750`
 * (`MONSTER_SetLastInteractTarget113c`) with interact type `1` (`UNIT_PLAYER`), `2` (`UNIT_MONSTER`), or `4` (`UNIT_MISSILE`).
 *
 * Binary convention: `ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc5ac0
 * @va D2Game:0x6FCC5AC0 (100B)
 */
export function MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pAiArgs = 0,
): void {
  hitD2GameVa113c(0x6FCC5AC0)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pUnit >>> 0) || pTarget === 0) return
  const dwTargetType = m.u32(pTarget) | 0
  const dwTargetGuid = m.u32((pTarget + 0x0c) >>> 0) >>> 0
  if (dwTargetType === 0) {
    MONSTER_SetLastInteractTarget113c(m, pUnit >>> 0, 1, dwTargetGuid)
  } else if (dwTargetType === 1) {
    MONSTER_SetLastInteractTarget113c(m, pUnit >>> 0, 2, dwTargetGuid)
  } else if (dwTargetType === 3) {
    MONSTER_SetLastInteractTarget113c(m, pUnit >>> 0, 4, dwTargetGuid)
  }
}

/**
 * [28/45] If `UNITS_GetRoom113c(pUnit) != 0` (`D2Common.#10331`), stalls `pUnit` for `200` (`0xC8`)
 * frames via `AI_Stall113c` (`0x6FD122C0`).
 *
 * Binary convention: `ecx = pGame`, `edx = pUnit`, `[esp+4] = pAiArgs` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcc5d40
 * @va D2Game:0x6FCC5D40 (33B)
 */
export function MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pAiArgs = 0,
): void {
  hitD2GameVa113c(0x6FCC5D40)
  if (UNITS_GetRoom113c(m, pUnit >>> 0) !== 0) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0xc8)
  }
}

/**
 * [29/45] If `pUnit != 0 && pTarget != 0`, sets GfxState flag `0xAC` (`172`) on `pTarget`
 * (`D2Common.#10945`) and returns `1` (otherwise `0`).
 *
 * Binary convention: `[esp+4] = pUnit`, `[esp+8] = pTarget`, `[esp+0xC..0x14]` (`ret 0x14`).
 *
 * @va D2Game.dll@0x6fccc910
 * @va D2Game:0x6FCCC910 (42B)
 */
export function MONAI_EnableState172OnTarget_6FCCC910_113c(
  m: Memory113c,
  pUnit: number,
  pTarget: number,
  _a3 = 0,
  _a4 = 0,
  _a5 = 0,
): number {
  hitD2GameVa113c(0x6FCCC910)
  if (pUnit === 0 || pTarget === 0) return 0
  STATES_ToggleGfxStateFlag113c(m, pTarget >>> 0, 0xac, 1)
  return 1
}

/**
 * [30/45] Walks `pUnit->pInventory (+0x60)` (`D2Common.#10460` / `#11147` / `#10464`) and
 * returns `1` iff `pTargetItem` is present in the inventory list.
 *
 * Binary convention: `eax = pUnit`, `edi = pTargetItem` (`ret`).
 *
 * @va D2Game.dll@0x6fccc9e0
 * @va D2Game:0x6FCCC9E0 (54B)
 */
export function MONAI_InventoryContainsItemPointer_6FCCC9E0_113c(
  m: Memory113c,
  pUnit: number,
  pTargetItem: number,
): number {
  hitD2GameVa113c(0x6FCCC9E0)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return 0
  let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (pNode !== 0) {
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    if (pItem === (pTargetItem >>> 0)) {
      return 1
    }
    pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
  }
  return 0
}

/**
 * [31/45] Reads `nStatId = ITEMS_GetItemCell113c(pItem)` (`D2Common.#10620`), validates
 * `0 <= nStatId < pDataTables->nItemStatCostTxtRecordCount (+0xBD4)`, reads `nVal = STATLIST_GetUnitStat113c(pItem, 0x47, 0)`,
 * and if `nVal != 0`, adds `nVal` to `nStatId` on `pDestUnit` (`D2Common.#10551`) and returns `1`.
 *
 * Binary convention: `edx = pDestUnit`, `[esp+4] = pItem`, `[esp+8..0x14]` (`ret 0x14`).
 *
 * @va D2Game.dll@0x6fccca20
 * @va D2Game:0x6FCCCA20 (79B)
 */
export function MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c(
  m: Memory113c,
  pDestUnit: number,
  pItem: number,
  _a2 = 0,
  _a3 = 0,
  _a4 = 0,
  _a5 = 0,
): number {
  hitD2GameVa113c(0x6FCCCA20)
  const nStatId = ITEMS_GetItemCell113c(m, pItem >>> 0) | 0
  if (nStatId < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  const nStatCount = pDataTables !== 0 ? m.u32((pDataTables + 0xbd4) >>> 0) | 0 : 0
  if (nStatId >= nStatCount) return 0
  const nVal = STATLIST_GetUnitStat113c(m, pItem >>> 0, 0x47, 0) | 0
  if (nVal === 0) return 0
  STATLIST_AddUnitStatMemPort113c(m, pDestUnit >>> 0, nStatId, nVal, 0)
  return 1
}

/**
 * [32/45] If `[pOutResult] == 0`, invokes `pFilterArgs->pfnFilter (+0x00)` with
 * `(ecx = pFilterArgs->pGame (+0x04), edx = pFilterArgs->pSelfUnit (+0x08), [esp+4] = pCandidateUnit, [esp+8] = pFilterArgs->pUserContext (+0x0C))`
 * and stores non-zero return values into `[pOutResult]`.
 *
 * Binary convention: `ecx = pCandidateUnit`, `edx = pFilterArgs`, `[esp+4] = pOutResult` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcd06f0
 * @va D2Game:0x6FCD06F0 (43B)
 */
export function MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c(
  m: Memory113c,
  pCandidateUnit: number,
  pFilterArgs: number,
  pOutResult: number,
  hooks?: K2W2B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FCD06F0)
  if (m.u32(pOutResult >>> 0) !== 0) return
  const pfnFilter = m.u32(pFilterArgs >>> 0) >>> 0
  const pGame = m.u32((pFilterArgs + 0x04) >>> 0) >>> 0
  const pSelfUnit = m.u32((pFilterArgs + 0x08) >>> 0) >>> 0
  const pUserContext = m.u32((pFilterArgs + 0x0c) >>> 0) >>> 0

  let res = 0
  if (hooks !== undefined && hooks.onUnitFindFilter !== undefined) {
    res =
      hooks.onUnitFindFilter(m, pfnFilter, pGame, pSelfUnit, pCandidateUnit >>> 0, pUserContext) |
      0
  } else {
    switch (pfnFilter) {
      case 0x6fcc39e0:
        res = MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c(
          m,
          pGame,
          pSelfUnit,
          pCandidateUnit >>> 0,
          pUserContext,
        )
        break
      case 0x6fcc4180:
        res = MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c(
          m,
          pGame,
          pSelfUnit,
          pCandidateUnit >>> 0,
          pUserContext,
        )
        break
      case 0x6fcd0db0:
        res = MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c(
          m,
          pGame,
          pSelfUnit,
          pCandidateUnit >>> 0,
          pUserContext,
        )
        break
      case 0x6fcd0df0:
        res = MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c(
          m,
          pGame,
          pSelfUnit,
          pCandidateUnit >>> 0,
          pUserContext,
        )
        break
      case 0x6fcd0e30:
        res = MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c(
          m,
          pGame,
          pSelfUnit,
          pCandidateUnit >>> 0,
          pUserContext,
        )
        break
      case 0x6fcd12b0:
        res = MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c(
          m,
          pGame,
          pSelfUnit,
          pCandidateUnit >>> 0,
          pUserContext,
        )
        break
      default:
        res = 0
        break
    }
  }
  if (res !== 0) {
    m.setU32(pOutResult >>> 0, res >>> 0)
  }
}

/**
 * [33/45] Checks whether monster unit `pUnit` (`dwUnitType == 1`) has `nSkillId` in any of the
 * 8 `wSkill[0..7]` slots at `pMonStatsTxt + 0x170..0x17E`.
 *
 * Binary convention: `eax = pUnit`, `edx = nSkillId` (`ret`).
 *
 * @va D2Game.dll@0x6fcd0840
 * @va D2Game:0x6FCD0840 (94B)
 */
export function MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  hitD2GameVa113c(0x6FCD0840)
  if (pUnit === 0) return 0
  if ((m.u32(pUnit >>> 0) | 0) !== 1) return 0
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pMonStatsTxt = lookupMonStatsTxtRecord113c(m, nClassId)
  if (pMonStatsTxt === 0) return 0
  for (let i = 0; i < 8; i = (i + 1) | 0) {
    const wSkill = (m.u16((pMonStatsTxt + 0x170 + i * 2) >>> 0) << 16) >> 16
    if (wSkill === (nSkillId | 0)) {
      return 1
    }
  }
  return 0
}

/**
 * [34/45] Returns `14` (`0x0E`) for player units (`dwUnitType == 0`), `pMonStatsTxt->nVelocity (+0x4E)`
 * for monster units (`dwUnitType == 1`), or `0` otherwise.
 *
 * Binary convention: `ecx = pUnit` (`ret`).
 *
 * @va D2Game.dll@0x6fcd08a0
 * @va D2Game:0x6FCD08A0 (69B)
 */
export function MONAI_GetUnitMeleeVelocity_6FCD08A0_113c(
  m: Memory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCD08A0)
  if (pUnit === 0) return 0
  const dwUnitType = m.u32(pUnit >>> 0) | 0
  if (dwUnitType === 0) return 0x0e
  if (dwUnitType !== 1) return 0
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pMonStatsTxt = lookupMonStatsTxtRecord113c(m, nClassId)
  if (pMonStatsTxt === 0) return 0
  return m.u8((pMonStatsTxt + 0x4e) >>> 0)
}

/**
 * [35/45] Sets `pAiGeneral->dwOwnerGuid (+0x0C)` and `pAiGeneral->eOwnerType (+0x10)` on monster
 * `pMonster` (`pMonster->pMonsterData->pAiGeneral (+0x28)`) from `pTargetUnit` (or `-1` and `1` when `pTargetUnit == 0`).
 *
 * Binary convention: `ecx = pMonster`, `edx = pTargetUnit` (`ret`).
 *
 * @va D2Game.dll@0x6fcd0ba0
 * @va D2Game:0x6FCD0BA0 (56B)
 */
export function MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c(
  m: Memory113c,
  pMonster: number,
  pTargetUnit: number,
): void {
  hitD2GameVa113c(0x6FCD0BA0)
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) | 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  const pAiGeneral = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
  if (pTargetUnit !== 0) {
    m.setU32((pAiGeneral + 0x0c) >>> 0, m.u32((pTargetUnit + 0x0c) >>> 0) >>> 0)
    m.setU32((pAiGeneral + 0x10) >>> 0, m.u32(pTargetUnit >>> 0) >>> 0)
  } else {
    m.setU32((pAiGeneral + 0x0c) >>> 0, 0xffffffff)
    m.setU32((pAiGeneral + 0x10) >>> 0, 1)
  }
}

/**
 * [36/45] Unit-find callback that increments `[pCountCtx + 0x08]` for each alive (`!0x6FCFFA90`)
 * monster (`dwUnitType == 1`) with `dwClassId == [pCountCtx + 0x00]` whose `AI_CalcApproxUnitDistSubtiles113c`
 * (`0x6FCD0A20`) to `pSelfUnit` is `<= [pCountCtx + 0x04]`. Returns `0`.
 *
 * Binary convention: `ecx = pGame`, `edx = pSelfUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pCountCtx` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcd0db0
 * @va D2Game:0x6FCD0DB0 (62B)
 */
export function MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c(
  m: Memory113c,
  _pGame: number,
  pSelfUnit: number,
  pCandidateUnit: number,
  pCountCtx: number,
): number {
  hitD2GameVa113c(0x6FCD0DB0)
  if (pCandidateUnit !== 0 && (m.u32(pCandidateUnit >>> 0) | 0) === 1) {
    if ((m.u32((pCandidateUnit + 0x04) >>> 0) | 0) === (m.u32(pCountCtx >>> 0) | 0)) {
      if ((SUNIT_IsDeadOrDying113c(m, pCandidateUnit >>> 0) | 0) === 0) {
        const nDist =
          AI_CalcApproxUnitDistSubtiles113c(m, pSelfUnit >>> 0, pCandidateUnit >>> 0) | 0
        if (nDist <= (m.u32((pCountCtx + 0x04) >>> 0) | 0)) {
          m.setU32(
            (pCountCtx + 0x08) >>> 0,
            ((m.u32((pCountCtx + 0x08) >>> 0) | 0) + 1) >>> 0,
          )
        }
      }
    }
  }
  return 0
}

/**
 * [37/45] Unit-find callback that locates the closest closed (`dwAnimMode == 0`) door object
 * (`dwUnitType == 2 && UNITS_IsDoor113c != 0`), updating `pDoorOut->pBestDoor (+0x00)` and
 * `pDoorOut->nBestSqDist (+0x04)` when `UNIT_CalcSqDistSubtiles113c < nBestSqDist`. Returns `0`.
 *
 * Binary convention: `ecx = pGame`, `edx = pSelfUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pDoorOut` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcd0df0
 * @va D2Game:0x6FCD0DF0 (62B)
 */
export function MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c(
  m: Memory113c,
  _pGame: number,
  pSelfUnit: number,
  pCandidateUnit: number,
  pDoorOut: number,
): number {
  hitD2GameVa113c(0x6FCD0DF0)
  if (pCandidateUnit !== 0 && (m.u32(pCandidateUnit >>> 0) | 0) === 2) {
    if ((UNITS_IsDoor113c(m, pCandidateUnit >>> 0) | 0) !== 0) {
      if ((m.u32((pCandidateUnit + 0x10) >>> 0) | 0) === 0) {
        const nSqDist =
          UNIT_CalcSqDistSubtiles113c(m, pCandidateUnit >>> 0, pSelfUnit >>> 0) | 0
        if (nSqDist < (m.u32((pDoorOut + 0x04) >>> 0) | 0)) {
          m.setU32(pDoorOut >>> 0, pCandidateUnit >>> 0)
          m.setU32((pDoorOut + 0x04) >>> 0, nSqDist >>> 0)
        }
      }
    }
  }
  return 0
}

/**
 * [38/45] Unit-find filter callback that matches a monster (`dwUnitType == 1`) in `dwAnimMode == 0`
 * whose `AI_CalcApproxUnitDistSubtiles113c(pCandidateUnit, pSelfUnit)` (`0x6FCD0A20`) is strictly `< [pMaxRadiusPtr]`,
 * returning `pCandidateUnit` (or `0`).
 *
 * Binary convention: `ecx = pGame`, `edx = pSelfUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pMaxRadiusPtr` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcd0e30
 * @va D2Game:0x6FCD0E30 (47B)
 */
export function MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c(
  m: Memory113c,
  _pGame: number,
  pSelfUnit: number,
  pCandidateUnit: number,
  pMaxRadiusPtr: number,
): number {
  hitD2GameVa113c(0x6FCD0E30)
  if (pCandidateUnit === 0) return 0
  if ((m.u32(pCandidateUnit >>> 0) | 0) !== 1) return 0
  if ((m.u32((pCandidateUnit + 0x10) >>> 0) | 0) !== 0) return 0
  const nDist =
    AI_CalcApproxUnitDistSubtiles113c(m, pCandidateUnit >>> 0, pSelfUnit >>> 0) >>> 0
  const nMaxRadius = m.u32(pMaxRadiusPtr >>> 0) >>> 0
  return nDist < nMaxRadius ? pCandidateUnit >>> 0 : 0
}

/**
 * [39/45] Unit-find callback that checks whether `pCandidateUnit` is within `[pCorpseTrackCtx + 0x0C]`
 * subtiles of `pSelfUnit`, is a dead monster (`dwUnitType == 1 && dwAnimMode == 0x0C`) with
 * `UNITFLAG_CANBEATTACKED (0x02)` set, has no active `StateMask33` (`D2Common.#10541 == 0`),
 * and has `AIGENERAL_GetPackLeaderUnit113c(pCandidateUnit) == pSelfUnit` (`0x6FC41260`), recording
 * `[pCorpseTrackCtx + 0x00] = pCandidateUnit`, `++[pCorpseTrackCtx + 0x04]`, and `[pCorpseTrackCtx + 0x08] = nDist`.
 *
 * Binary convention: `ecx = pGame`, `edx = pSelfUnit`, `[esp+4] = pCandidateUnit`, `[esp+8] = pCorpseTrackCtx` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcd12b0
 * @va D2Game:0x6FCD12B0 (99B)
 */
export function MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c(
  m: Memory113c,
  _pGame: number,
  pSelfUnit: number,
  pCandidateUnit: number,
  pCorpseTrackCtx: number,
): number {
  hitD2GameVa113c(0x6FCD12B0)
  const nDist =
    AI_CalcApproxUnitDistSubtiles113c(m, pSelfUnit >>> 0, pCandidateUnit >>> 0) | 0
  if (nDist <= (m.u32((pCorpseTrackCtx + 0x0c) >>> 0) | 0)) {
    if (
      pCandidateUnit !== 0 &&
      (m.u32(pCandidateUnit >>> 0) | 0) === 1 &&
      (m.u32((pCandidateUnit + 0x10) >>> 0) | 0) === 0x0c
    ) {
      if (((m.u32((pCandidateUnit + 0xc4) >>> 0) >>> 1) & 1) !== 0) {
        if ((STATES_CheckStateMask33OnUnit113c(m, pCandidateUnit >>> 0) | 0) === 0) {
          if (
            (AIGENERAL_GetPackLeaderUnit113c(m, pCandidateUnit >>> 0) >>> 0) ===
            (pSelfUnit >>> 0)
          ) {
            m.setU32(
              (pCorpseTrackCtx + 0x04) >>> 0,
              ((m.u32((pCorpseTrackCtx + 0x04) >>> 0) | 0) + 1) >>> 0,
            )
            m.setU32(pCorpseTrackCtx >>> 0, pCandidateUnit >>> 0)
            m.setU32((pCorpseTrackCtx + 0x08) >>> 0, nDist >>> 0)
          }
        }
      }
    }
  }
  return 0
}

/**
 * [40/45] Returns `1` iff `pTargetUnit` is a player or monster (`0 <= dwUnitType <= 1`),
 * is not dead/dying (`0x6FCFFA90 == 0`), has `UNITFLAG_ISVALIDTARGET (0x04)` set on `dwFlags (+0xC4)`,
 * and is hostile/unaligned with `pSelfUnit` (`0x6FD00A60`).
 *
 * Binary convention: `edx = pTargetUnit`, `[esp+4] = pGame`, `[esp+8] = pSelfUnit` (`ret 8`).
 *
 * @va D2Game.dll@0x6fcd13b0
 * @va D2Game:0x6FCD13B0 (70B)
 */
export function MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c(
  m: Memory113c,
  pTargetUnit: number,
  pGame: number,
  pSelfUnit: number,
): number {
  hitD2GameVa113c(0x6FCD13B0)
  if (pTargetUnit === 0) return 0
  const dwUnitType = m.u32(pTargetUnit >>> 0) | 0
  if (dwUnitType < 0 || dwUnitType > 1) return 0
  if ((SUNIT_IsDeadOrDying113c(m, pTargetUnit >>> 0) | 0) !== 0) return 0
  if (((m.u32((pTargetUnit + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0
  return (
    SUNIT_AreUnitsHostileOrUnaligned113c(
      m,
      pTargetUnit >>> 0,
      pSelfUnit >>> 0,
      pGame >>> 0,
    ) | 0
  )
}

/**
 * [41/45] Asserts `pGame->pArenaCtrl (+0x1D28) != 0` (line `0x172`) and returns
 * `pArenaCtrl->bArenaMode (+0x0C)`.
 *
 * Binary convention: `eax = pGame` (`ret`).
 *
 * @va D2Game.dll@0x6fcd22d0
 * @va D2Game:0x6FCD22D0 (46B)
 */
export function ARENA_GetModeByte_6FCD22D0_113c(m: Memory113c, pGame: number): number {
  hitD2GameVa113c(0x6FCD22D0)
  const pArena = m.u32((pGame + 0x1d28) >>> 0) >>> 0
  if (pArena === 0) {
    throw new D2CommonAssertError('', 0x172)
  }
  return m.u8((pArena + 0x0c) >>> 0)
}

/**
 * [42/45] Retrieves `pPlayerData = UNITS_GetPlayerData113c(pPlayer)` (`D2Common.#10920`,
 * asserting at line `0x52` if null), frees `pPlayerData->pArenaUnit (+0x34)` via `Fog.#10046`
 * when non-null, and clears `pPlayerData->pArenaUnit = 0`.
 *
 * Binary convention: `eax = pPlayer`, `[esp+4] = pGame` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcd2480
 * @va D2Game:0x6FCD2480 (80B)
 */
export function ARENA_FreePlayerArenaUnit_6FCD2480_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
  hooks?: K2W2B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FCD2480)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('', 0x52)
  }
  const pArenaUnit = m.u32((pPlayerData + 0x34) >>> 0) >>> 0
  if (pArenaUnit !== 0) {
    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    if (hooks !== undefined && hooks.freePoolMemory !== undefined) {
      hooks.freePoolMemory(m, pMemPool, pArenaUnit, D2GAME_ARENA_CPP_VA_113C, 0x57, 0)
    }
    m.setU32((pPlayerData + 0x34) >>> 0, 0)
  }
}

/**
 * [43/45] Allocates an 8-byte `D2ArenaUnitStrc` from `pGame->pMemPool (+0x1C)` (`Fog.#10045`, line `0x47`),
 * zeroes both dwords, resolves `pPlayerData = UNITS_GetPlayerData113c(pPlayer)` (`D2Common.#10920`,
 * asserting at line `0x4A` if null), and stores `pPlayerData->pArenaUnit (+0x34) = pArenaUnit`.
 *
 * Binary convention: `eax = pGame`, `[esp+4] = pPlayer` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcd24d0
 * @va D2Game:0x6FCD24D0 (83B)
 */
export function ARENA_AllocPlayerArenaUnit_6FCD24D0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  hooks?: K2W2B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FCD24D0)
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  const pArenaUnit =
    (hooks !== undefined && hooks.allocPoolMemory !== undefined
      ? hooks.allocPoolMemory(m, pMemPool, 8, D2GAME_ARENA_CPP_VA_113C, 0x47, 0)
      : m.alloc(8)) >>> 0
  m.setU32(pArenaUnit, 0)
  m.setU32((pArenaUnit + 0x04) >>> 0, 0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('', 0x4a)
  }
  m.setU32((pPlayerData + 0x34) >>> 0, pArenaUnit)
}

/**
 * [44/45] Allocates a 16-byte `D2ArenaStrc` from `pGame->pMemPool (+0x1C)` (`Fog.#10045`, line `0x32`),
 * zeroes all 4 dwords, stores `pGame->pArenaCtrl (+0x1D28) = pArena`, writes
 * `pArena->dwFlags (+0x08) = dwArenaFlags & 0x3179C7`, and sets `pArena->bArenaMode (+0x0C) = bArenaMode`.
 *
 * Binary convention: `edi = pGame`, `eax = dwArenaFlags`, `[esp+4] = bArenaMode` (`ret 4`).
 *
 * @va D2Game.dll@0x6fcd2560
 * @va D2Game:0x6FCD2560 (66B)
 */
export function ARENA_AllocGameArenaCtrl_6FCD2560_113c(
  m: Memory113c,
  pGame: number,
  dwArenaFlags: number,
  bArenaMode: number,
  hooks?: K2W2B5Hooks113c,
): void {
  hitD2GameVa113c(0x6FCD2560)
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  const pArena =
    (hooks !== undefined && hooks.allocPoolMemory !== undefined
      ? hooks.allocPoolMemory(m, pMemPool, 0x10, D2GAME_ARENA_CPP_VA_113C, 0x32, 0)
      : m.alloc(0x10)) >>> 0
  m.setU32(pArena, 0)
  m.setU32((pArena + 0x04) >>> 0, 0)
  m.setU32((pArena + 0x08) >>> 0, 0)
  m.setU32((pArena + 0x0c) >>> 0, 0)
  const maskedFlags = (dwArenaFlags & 0x3179c7) >>> 0
  m.setU32((pGame + 0x1d28) >>> 0, pArena)
  m.setU32((pArena + 0x08) >>> 0, maskedFlags)
  m.setU8((pArena + 0x0c) >>> 0, bArenaMode & 0xff)
}

/**
 * [45/45] Asserts `pGame->pArenaCtrl (+0x1D28) != 0` (line `0x27`) and returns bit `8`
 * (`(pArenaCtrl->dwFlags >> 8) & 1`).
 *
 * Binary convention: `eax = pGame` (`ret`).
 *
 * @va D2Game.dll@0x6fcd2620
 * @va D2Game:0x6FCD2620 (48B)
 */
export function ARENA_CheckFlagBit8_6FCD2620_113c(m: Memory113c, pGame: number): number {
  hitD2GameVa113c(0x6FCD2620)
  const pArena = m.u32((pGame + 0x1d28) >>> 0) >>> 0
  if (pArena === 0) {
    throw new D2CommonAssertError('', 0x27)
  }
  return (m.u32((pArena + 0x08) >>> 0) >>> 8) & 1
}
