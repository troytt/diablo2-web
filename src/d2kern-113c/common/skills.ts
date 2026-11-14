/**
 * Diablo II v1.13c `D2Common.dll` skills, item-type equivalence, and unit state-mask pure-leaf functions
 * (`0x6FD72820..0x6FD9E550`, image base `0x6FD50000`).
 *
 * Batch `B003` (14 functions):
 * - `0x6FD72820` `ITEMS_CheckItemTypeIdEquivalent113c` (`#11034`)
 * - `0x6FD87DB0` `STATES_CheckStateMaskOnUnitFast113c` (internal)
 * - `0x6FD9DC30` `SKILLS_CalcDiminishingReturns113c` (`#10115`)
 * - `0x6FD9DDB0` `SKILLS_Calc5BandLinear113c` (internal)
 * - `0x6FD9E180` `SKILLS_GetLeftSkillFromSkillList113c` (`#10136`)
 * - `0x6FD9E1A0` `SKILLS_SetSkillSlotIndex113c` (`#10368`)
 * - `0x6FD9E1C0` `SKILLS_GetSkillsTxtFromSkill113c` (`#10858`)
 * - `0x6FD9E1D0` `SKILLS_GetSkillIdFromSkill113c` (`#10601`)
 * - `0x6FD9E3B0` `SKILLS_GetNextSkill113c` (`#10784`)
 * - `0x6FD9E3D0` `SKILLS_GetFirstSkillFromSkillList113c` (`#10273`)
 * - `0x6FD9E460` `SKILLS_GetSkillSlotIndex113c` (`#10952`)
 * - `0x6FD9E480` `SKILLS_GetHighestLevelSkillFromUnitAndId113c` (internal)
 * - `0x6FD9E520` `SKILLS_GetClassSkillCount113c` (`#11120`)
 * - `0x6FD9E550` `SKILLS_GetClassSkillId113c` (`#10044`)
 *
 * Batch `B012` (13 functions):
 * - `0x6FD9E8C0` `SKILLS_GetClassIdFromSkillId113c` (`#10847`)
 * - `0x6FD9EA00` `SKILLS_EvaluateManaCost256ths113c` (`#10090`)
 * - `0x6FD9EB00` `SKILLS_GetReqLevel113c` (`#11070`)
 * - `0x6FD9F080` `SKILLS_GetSkillById113c` (`#10708`)
 * - `0x6FD9F0C0` `SKILLS_CalcMaxCallback113c` (internal)
 * - `0x6FD9F0D0` `SKILLS_CalcMinCallback113c` (internal)
 * - `0x6FD9F0E0` `SKILLS_GetPassiveState113c` (`#10313`)
 * - `0x6FD9F4C0` `SKILLS_GetBaseSkillLevelById113c` (internal)
 * - `0x6FD9F510` `SKILLS_GetRequiredLevelForNextRank113c` (`#10339`)
 * - `0x6FD9F780` `SKILLS_MapPlayerAnimModeToMonsterMode113c` (`#10568`)
 * - `0x6FDA2E00` `DATATBLS_GetMonSeqTableRecord113c` (`#10194`)
 * - `0x6FDB9DC0` `MISSILE_EvaluateElementalLength113c` (`#10242`)
 * - `0x6FDCF5E0` `UNITS_GetUnitDistanceToCoordinates113c` (`#10080`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_FindFreePosition113c,
  COLLISION_RayTrace113c,
} from './collision.ts'
import { DRLG_IsTownLevel113c, DUNGEON_GetRoomAtPosition113c } from './dungeon.ts'
import {
  D2CommonAssertError,
  DATATBLS_CalcSkillLinearParam12Inline113c,
  DATATBLS_CalcSkillLinearParam34Inline113c,
  DATATBLS_CalcSkillLinearParam56Inline113c,
  DATATBLS_CalcSkillLinearParam78Inline113c,
  DATATBLS_CheckMonStats2FlagInline113c,
  DATATBLS_CheckMonStats2ModeFlagInline113c,
  DATATBLS_GetMissilesTxtRecordInline113c,
  DATATBLS_GetMonStatsTxtRecordInline113c,
  DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c,
  DATATBLS_GetSkillsTxtMaxLvlInline113c,
  DATATBLS_GetSkillsTxtParam1Inline113c,
  DATATBLS_GetSkillsTxtParam2Inline113c,
  DATATBLS_GetSkillsTxtParam3Inline113c,
  DATATBLS_GetSkillsTxtParam4Inline113c,
  DATATBLS_GetSkillsTxtParam5Inline113c,
  DATATBLS_GetSkillsTxtParam6Inline113c,
  DATATBLS_GetSkillsTxtRecordInline113c,
  DATATBLS_GetStatesTxtRecordInline113c,
  SEED_RollLimitedRandomNumberInline113c,
} from './inline-helpers.ts'
import { COMPOSIT_IsUnitUsingBowOrCrossbow113c } from './composit.ts'
import { imul32, mulDiv113c, sar32, sdiv32 } from './int-math.ts'
import {
  INVENTORY_GetCompositWeaponMem113c,
  INVENTORY_GetEquippedWeaponHandClass113c,
  INVENTORY_GetOrInitGridMem113c,
  ITEMS_GetWeaponClassCodeIdx113c,
} from './inventory.ts'
import {
  ITEMS_CalcWeaponAttackSpeed113c,
  ITEMS_CheckItemTypeIdMem113c,
  ITEMS_GetActiveWeaponForAttack113c,
  ITEMS_GetItemTypeQuiverFromItem113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_IsTome113c,
  checkIfThrowItemMem113c,
  checkNotBrokenOrUnequippingMem113c,
  lookupItemsTxtRecord113c,
  statListGetUnitBaseStatMem113c,
  unitsCanDualWieldMem113c,
} from './items.ts'
import {
  STATE_DWORDS_113C,
  STATES_ApplyMonSkillIconToUnit113c,
  STATES_CheckState113c,
  STATES_CheckStateMaskOnUnit113c,
  STATES_SetUnitSourceUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_FindStatIndex113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetBaseStatFromListInline113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_GetUnitMaxDamage113c,
  STATLIST_GetUnitMinDamage113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_RemoveSubList113c,
  STATLIST_SetWeaponStatListActive113c,
} from './statlist.ts'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetPlayerBaseToHit113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
} from './unit.ts'
import {
  D2DynamicPathStrc,
  D2InventoryGridStrc,
  D2InventoryStrc,
  D2ItemStatCostTxt_SIZE,
  D2MissilesTxt,
  D2MissilesTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2SkillListStrc,
  D2SkillListStrc_SIZE,
  D2SkillsTxt,
  D2SkillsTxt_SIZE,
  D2SkillStrc,
  D2StaticPathStrc,
  D2StatListExStrc,
  D2UnitStrc,
  type FieldLayout113c,
} from '../mem/layout.generated.ts'

/**
 * `@va D2Common:0x6FD803A0` (`D2Common.#10511` `SKILLS_GetUsedSkill`):
 * Returns `pUnit->pSkills (+0xA8)->pUsedSkill (+0x10)`.
 */
export function SKILLS_GetUsedSkill113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const pSkills = m.get(pUnit, D2UnitStrc.pSkills)
  return pSkills !== 0 ? m.u32(pSkills + 0x10) : 0
}

/** `.data` `D2DataTablesStrc* sgptDataTables` at `0x6FDE9E1C`. */
export const SGPT_DATATABLES_VA_113C = 0x6fde9e1c
/** `.rdata` IAT slot for `Fog.dll!gdwBitMasks` (`uint32[32]`) at `0x6FDD90B0`. */
export const GDW_BITMASKS_IAT_VA_113C = 0x6fdd90b0

/** `sgptDataTables` field offsets accessed by `B003` and `B012` functions. */
export const DATATABLES_MONSTATS_TXT_OFF_113C = 0xa78
export const DATATABLES_MONSTATS_COUNT_OFF_113C = 0xa80
export const DATATABLES_MONSTATS2_TXT_OFF_113C = 0xa90
export const DATATABLES_MONSTATS2_COUNT_OFF_113C = 0xa98
export const DATATABLES_MISSILES_TXT_OFF_113C = 0xb64
export const DATATABLES_MISSILES_COUNT_OFF_113C = 0xb6c
export const DATATABLES_SKILLS_TXT_OFF_113C = 0xb98
export const DATATABLES_SKILLS_COUNT_OFF_113C = 0xba0
export const DATATABLES_PLAYER_CLASS_SKILL_COUNT_OFF_113C = 0xba4
export const DATATABLES_MAX_CLASS_SKILLS_STRIDE_OFF_113C = 0xba8
export const DATATABLES_PLAYER_CLASS_SKILL_LIST_OFF_113C = 0xbac
export const DATATABLES_ITEMTYPES_COUNT_OFF_113C = 0xbfc
export const DATATABLES_ITEMTYPES_STRIDE_OFF_113C = 0xc00
export const DATATABLES_ITEMTYPES_EQUIV_MASK_OFF_113C = 0xc04

/** `.data` `sgptDataTables->pMonSeqTable` (`0x6FDA2E14 mov ecx, ds:0x6fdf0a5c`) and count (`0x6FDA2E06 cmp eax, ds:0x6fdf0a60`). */
export const G_MONSEQ_TABLE_VA_113C = 0x6fdf0a5c
export const G_MONSEQ_COUNT_VA_113C = 0x6fdf0a60
export const D2MONSEQ_TABLE_RECORD_SIZE_113C = 12

/** `.rdata` `int32[]` player-mode -> monster-mode mapping at `0x6FDE3088` (`0x6FD9F784 mov eax, [eax*4+0x6fde3088]`). */
export const PLR_TO_MON_MODE_TABLE_VA_113C = 0x6fde3088

function i16(v: number): number {
  return (v << 16) >> 16
}

/**
 * `@va D2Common:0x6FD72820` (`D2Common.#11034`, `ITEMS_CheckItemTypeIdEquivalent`, `__stdcall(nItemType1, nItemType2) -> BOOL`).
 *
 * - Checks `0 <= (nItemType1 | 0) < sgptDataTables->nItemTypesTxtRecordCount (+0xBFC)` (`jl` / `jge`).
 * - Checks `0 <= (nItemType2 | 0) < sgptDataTables->nItemTypesTxtRecordCount (+0xBFC)` (`jl` / `jge`).
 * - Reads `stride = sgptDataTables->nItemTypesIndexStride (+0xC00)` and `pMask = sgptDataTables->pItemTypesEquivMask (+0xC04)`.
 * - Computes `idx = (Math.imul(stride, nItemType1) + (nItemType2 >> 5)) | 0`, reads `word = pMask[idx]`,
 *   and masks it with `gdwBitMasks[nItemType2 & 31]`.
 */
export function ITEMS_CheckItemTypeIdEquivalent113c(
  m: Memory113c,
  nItemType1: number,
  nItemType2: number,
): number {
  const t1 = nItemType1 | 0
  if (t1 < 0) return 0
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const nCount = m.u32((pDataTables + DATATABLES_ITEMTYPES_COUNT_OFF_113C) >>> 0) | 0
  if (t1 >= nCount) return 0
  const t2 = nItemType2 | 0
  if (t2 < 0 || t2 >= nCount) return 0

  const nStride = m.u32((pDataTables + DATATABLES_ITEMTYPES_STRIDE_OFF_113C) >>> 0) | 0
  const pMask = m.u32((pDataTables + DATATABLES_ITEMTYPES_EQUIV_MASK_OFF_113C) >>> 0)
  const wordIdx = (Math.imul(nStride, t1) + (t2 >> 5)) | 0
  const maskVal = m.u32((pMask + ((wordIdx << 2) >>> 0)) >>> 0)
  const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C)
  const bitMask = m.u32((pBitMasks + ((t2 & 0x1f) << 2)) >>> 0)
  return (maskVal & bitMask) >>> 0
}

/**
 * `@va D2Common:0x6FD87DB0` (internal, custom reg `eax=pUnit, ecx=nStateId -> uint32`).
 *
 * - If `pUnit === 0` or `pStatListEx = pUnit->pStatListEx (+0x5C) === 0`, returns `0`.
 * - If `(pStatListEx->dwFlags (+0x10) & 0x80000000) === 0` (`test edx, edx; js`), returns `0`.
 * - Reads `pStateFlags = pStatListEx->pStateFlags (+0x58)`, `word = pStateFlags[nStateId >> 5]`,
 *   and returns `(word & gdwBitMasks[nStateId & 31]) >>> 0`.
 */
export function STATES_CheckStateMaskOnUnitFast113c(
  m: Memory113c,
  pUnit: number,
  nStateId: number,
): number {
  if (pUnit === 0) return 0
  const pStatListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pStatListEx === 0) return 0
  const dwFlags = m.get(pStatListEx, D2StatListExStrc.dwFlags)
  if ((dwFlags | 0) >= 0) return 0

  const st = nStateId | 0
  const pStateFlags = m.get(pStatListEx, D2StatListExStrc.pStateFlags)
  const word = m.u32((pStateFlags + (((st >> 5) << 2) >>> 0)) >>> 0)
  const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C)
  const bitMask = m.u32((pBitMasks + ((st & 0x1f) << 2)) >>> 0)
  return (word & bitMask) >>> 0
}

/**
 * `@va D2Common:0x6FD9DC30` (`D2Common.#10115`, `SKILLS_CalcDiminishingReturns`, `__stdcall(nLevel, nMin, nMax) -> int`).
 *
 * - Computes `factor = sdiv32(Math.imul(nLevel | 0, 110), (nLevel + 6) | 0)`.
 * - Computes `res = (sdiv32(Math.imul(factor, (nMax - nMin) | 0), 100) + nMin) | 0`.
 * - If `(res | 0) > (nMax | 0)` (`cmp eax, esi; jle`), clamps `res = nMax | 0`.
 */
export function SKILLS_CalcDiminishingReturns113c(
  _m: Memory113c,
  nLevel: number,
  nMin: number,
  nMax: number,
): number {
  const lvl = nLevel | 0
  const p1 = nMin | 0
  const p2 = nMax | 0
  const factor = sdiv32(Math.imul(lvl, 110), (lvl + 6) | 0)
  const scaled = Math.imul(factor, (p2 - p1) | 0)
  let res = (sdiv32(scaled, 100) + p1) | 0
  if (res > p2) {
    res = p2
  }
  return res >>> 0
}

/**
 * `@va D2Common:0x6FD9DDB0` (internal, custom reg `eax=nLevel, ecx=pCoeffs -> int`).
 *
 * Evaluates a 5-band piecewise-linear progression from `pCoeffs` (`int32[5]` at `+0x00..+0x10`):
 * - `nLevel <= 1 || pCoeffs == 0`: `0`
 * - `1 < nLevel <= 8`: `(nLevel - 1) * c0`
 * - `8 < nLevel <= 16`: `7 * c0 + (nLevel - 8) * c1`
 * - `16 < nLevel <= 22`: `7 * c0 + 8 * c1 + (nLevel - 16) * c2`
 * - `22 < nLevel <= 28`: `7 * c0 + 8 * c1 + 6 * c2 + (nLevel - 22) * c3`
 * - `nLevel > 28`: `7 * c0 + 8 * c1 + 6 * (c2 + c3) + (nLevel - 28) * c4`
 */
export function SKILLS_Calc5BandLinear113c(
  m: Memory113c,
  nLevel: number,
  pCoeffs: number,
): number {
  const lvl = nLevel | 0
  if (lvl <= 1 || pCoeffs === 0) return 0
  const c0 = m.u32(pCoeffs) | 0
  if (lvl <= 8) {
    return Math.imul((lvl - 1) | 0, c0) >>> 0
  }
  const c1 = m.u32((pCoeffs + 4) >>> 0) | 0
  const t1 = Math.imul(7, c0)
  if (lvl <= 16) {
    return (t1 + Math.imul((lvl - 8) | 0, c1)) >>> 0
  }
  const c2 = m.u32((pCoeffs + 8) >>> 0) | 0
  const t2 = (t1 + (c1 << 3)) | 0
  if (lvl <= 22) {
    return (t2 + Math.imul((lvl - 16) | 0, c2)) >>> 0
  }
  const c3 = m.u32((pCoeffs + 12) >>> 0) | 0
  if (lvl <= 28) {
    const t3 = (t2 + Math.imul(6, c2)) | 0
    return (t3 + Math.imul((lvl - 22) | 0, c3)) >>> 0
  }
  const c4 = m.u32((pCoeffs + 16) >>> 0) | 0
  const t4 = (t2 + Math.imul(6, (c2 + c3) | 0)) | 0
  return (t4 + Math.imul((lvl - 28) | 0, c4)) >>> 0
}

/**
 * `@va D2Common:0x6FD9E180` (`D2Common.#10136`, `SKILLS_GetLeftSkillFromSkillList`, `__stdcall(pSkillList) -> D2SkillStrc*`).
 */
export function SKILLS_GetLeftSkillFromSkillList113c(m: Memory113c, pSkillList: number): number {
  if (pSkillList === 0) return 0
  return m.get(pSkillList, D2SkillListStrc.pLeftSkill)
}

/**
 * `@va D2Common:0x6FD9E1A0` (`D2Common.#10368`, `SKILLS_SetSkillSlotIndex`, `__stdcall(pSkill, nSlotIndex) -> void`).
 *
 * Writes `pSkill->nSlotIndex (+0x08) = nSlotIndex` iff `pSkill !== 0` and `0 <= (nSlotIndex | 0) <= 32` (`0x20`).
 */
export function SKILLS_SetSkillSlotIndex113c(
  m: Memory113c,
  pSkill: number,
  nSlotIndex: number,
): void {
  if (pSkill === 0) return
  const slot = nSlotIndex | 0
  if (slot < 0 || slot > 0x20) return
  m.set(pSkill, D2SkillStrc.nSlotIndex, slot >>> 0)
}

/**
 * `@va D2Common:0x6FD9E1C0` (`D2Common.#10858`, `SKILLS_GetSkillsTxtFromSkill`, `__fastcall(ecx=pSkill) -> D2SkillsTxt*`).
 */
export function SKILLS_GetSkillsTxtFromSkill113c(m: Memory113c, pSkill: number): number {
  if (pSkill === 0) return 0
  return m.get(pSkill, D2SkillStrc.pSkillsTxt)
}

/**
 * `@va D2Common:0x6FD9E1D0` (`D2Common.#10601`, `SKILLS_GetSkillIdFromSkill`, `__stdcall(pSkill, pFile, nLine) -> int`).
 *
 * - If `pSkill === 0`, returns `0` (`test eax, eax; jne; ret 0xc`).
 * - Otherwise reads `pSkillsTxt = pSkill->pSkillsTxt (+0x00)` and returns sign-extended `(int16)pSkillsTxt->wSkillId (+0x00)`.
 */
export function SKILLS_GetSkillIdFromSkill113c(
  m: Memory113c,
  pSkill: number,
  _pFile = 0,
  _nLine = 0,
): number {
  if (pSkill === 0) return 0
  const pSkillsTxt = m.get(pSkill, D2SkillStrc.pSkillsTxt)
  return i16(m.get(pSkillsTxt, D2SkillsTxt.wSkillId)) >>> 0
}

/**
 * `@va D2Common:0x6FD9E3B0` (`D2Common.#10784`, `SKILLS_GetNextSkill`, `__stdcall(pSkill) -> D2SkillStrc*`).
 */
export function SKILLS_GetNextSkill113c(m: Memory113c, pSkill: number): number {
  if (pSkill === 0) return 0
  return m.get(pSkill, D2SkillStrc.pNextSkill)
}

/**
 * `@va D2Common:0x6FD9E3D0` (`D2Common.#10273`, `SKILLS_GetFirstSkillFromSkillList`, `__stdcall(pSkillList) -> D2SkillStrc*`).
 */
export function SKILLS_GetFirstSkillFromSkillList113c(m: Memory113c, pSkillList: number): number {
  if (pSkillList === 0) return 0
  return m.get(pSkillList, D2SkillListStrc.pFirstSkill)
}

/**
 * `@va D2Common:0x6FD9E460` (`D2Common.#10952`, `SKILLS_GetSkillSlotIndex`, `__stdcall(pUnit, pSkill) -> int`).
 *
 * - If `pUnit === 0` or `pSkill === 0`, returns `0`.
 * - Otherwise returns `pSkill->nSlotIndex (+0x08)`.
 */
export function SKILLS_GetSkillSlotIndex113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
): number {
  if (pUnit === 0 || pSkill === 0) return 0
  return m.get(pSkill, D2SkillStrc.nSlotIndex)
}

/**
 * `@va D2Common:0x6FD9E480` (internal, custom reg `eax=pUnit, esi=nSkillId -> D2SkillStrc*`).
 *
 * Walks `pUnit->pSkills (+0xA8)->pFirstSkill (+0x04)` for skills with `(int16)pSkillsTxt->wSkillId == nSkillId`
 * and `dwFlags (+0x3C) == 0`:
 * - First matching skill becomes `pBestSkill`.
 * - Any matching skill with `nOwnerItemGuid (+0x34) == -1` (`0xFFFFFFFF`) replaces `pBestSkill`.
 * - Otherwise, if `pBestSkill->nOwnerItemGuid != -1`, a candidate replaces `pBestSkill` iff
 *   `(candidate->nSkillLevel (+0x28) | 0) > (pBestSkill->nSkillLevel (+0x28) | 0)`.
 */
export function SKILLS_GetHighestLevelSkillFromUnitAndId113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const pSkills = m.get(pUnit, D2UnitStrc.pSkills)
  if (pSkills === 0) return 0
  let pCur = m.get(pSkills, D2SkillListStrc.pFirstSkill)
  if (pCur === 0) return 0

  const targetId = nSkillId | 0
  let pBest = 0
  while (pCur !== 0) {
    const pSkillsTxt = m.get(pCur, D2SkillStrc.pSkillsTxt)
    const wSkillId = i16(m.get(pSkillsTxt, D2SkillsTxt.wSkillId))
    if (wSkillId === targetId && m.get(pCur, D2SkillStrc.dwFlags) === 0) {
      if (pBest === 0) {
        pBest = pCur
      } else if ((m.get(pCur, D2SkillStrc.nOwnerItemGuid) | 0) === -1) {
        pBest = pCur
      } else if ((m.get(pBest, D2SkillStrc.nOwnerItemGuid) | 0) !== -1) {
        const curLvl = m.get(pCur, D2SkillStrc.nSkillLevel) | 0
        const bestLvl = m.get(pBest, D2SkillStrc.nSkillLevel) | 0
        if (curLvl > bestLvl) {
          pBest = pCur
        }
      }
    }
    pCur = m.get(pCur, D2SkillStrc.pNextSkill)
  }
  return pBest
}

/**
 * `@va D2Common:0x6FD9E520` (`D2Common.#11120`, `SKILLS_GetClassSkillCount`, `__stdcall(nCharClass) -> int`).
 *
 * Returns `sgptDataTables->pPlayerClassSkillCount (+0xBA4)[nCharClass]` if `0 <= (nCharClass | 0) < 7`, else `0`.
 */
export function SKILLS_GetClassSkillCount113c(m: Memory113c, nCharClass: number): number {
  const cls = nCharClass | 0
  if (cls < 0 || cls >= 7) return 0
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const pCounts = m.u32((pDataTables + DATATABLES_PLAYER_CLASS_SKILL_COUNT_OFF_113C) >>> 0)
  return m.u32((pCounts + (cls << 2)) >>> 0)
}

/**
 * `@va D2Common:0x6FD9E550` (`D2Common.#10044`, `SKILLS_GetClassSkillId`, `__stdcall(nCharClass, nIndex) -> int`).
 *
 * - If `(nCharClass | 0) < 0` or `(nCharClass | 0) >= 7` or `(nIndex | 0) < 0`, returns `-1` (`0xFFFFFFFF`).
 * - Reads `nCount = sgptDataTables->pPlayerClassSkillCount (+0xBA4)[nCharClass]`; if `(nIndex | 0) >= (nCount | 0)`, returns `-1`.
 * - Reads `nStride = sgptDataTables->nMaxClassSkillsStride (+0xBA8)` and `pList = sgptDataTables->pPlayerClassSkillList (+0xBAC)`,
 *   and returns sign-extended `(int16)pList[nCharClass * nStride + nIndex]`.
 */
export function SKILLS_GetClassSkillId113c(
  m: Memory113c,
  nCharClass: number,
  nIndex: number,
): number {
  const cls = nCharClass | 0
  if (cls < 0 || cls >= 7) return 0xffffffff
  const idx = nIndex | 0
  if (idx < 0) return 0xffffffff
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const pCounts = m.u32((pDataTables + DATATABLES_PLAYER_CLASS_SKILL_COUNT_OFF_113C) >>> 0)
  const nCount = m.u32((pCounts + (cls << 2)) >>> 0) | 0
  if (idx >= nCount) return 0xffffffff
  const nStride = m.u32((pDataTables + DATATABLES_MAX_CLASS_SKILLS_STRIDE_OFF_113C) >>> 0) | 0
  const pList = m.u32((pDataTables + DATATABLES_PLAYER_CLASS_SKILL_LIST_OFF_113C) >>> 0)
  const elemIdx = (Math.imul(nStride, cls) + idx) | 0
  return i16(m.u16((pList + ((elemIdx << 1) >>> 0)) >>> 0)) >>> 0
}

function getSkillsTxtRecord(m: Memory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const nCount = m.u32((pDataTables + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0
  if (id >= nCount) return 0
  const pBase = m.u32((pDataTables + DATATABLES_SKILLS_TXT_OFF_113C) >>> 0)
  const pRec = (pBase + Math.imul(id, D2SkillsTxt_SIZE)) >>> 0
  return pRec
}

/**
 * `@va D2Common:0x6FD9E8C0` (`D2Common.#10847`, `SKILLS_GetClassIdFromSkillId`, `__stdcall(nSkillId) -> int`, `ret 4`).
 *
 * Looks up `pSkillsTxt` for `nSkillId`; if null or `(int8)pSkillsTxt->nCharClass (+0x0C) < 0`, returns `7`,
 * else returns `(int8)pSkillsTxt->nCharClass`.
 */
export function SKILLS_GetClassIdFromSkillId113c(m: Memory113c, nSkillId: number): number {
  const pRec = getSkillsTxtRecord(m, nSkillId)
  if (pRec === 0) return 7
  const c = (m.get(pRec, D2SkillsTxt.nCharClass) << 24) >> 24
  return (c < 0 ? 7 : c) >>> 0
}

/**
 * `@va D2Common:0x6FD9EA00` (`D2Common.#10090`, `SKILLS_EvaluateManaCost256ths`,
 * `__stdcall(nSkillId, nSkillLevel) -> int`, `ret 8`).
 *
 * Computes `(((nSkillLevel - 1) * (int16)wLvlMana (+0x18C) + (int16)wMana (+0x18A)) << (nManaShift (+0x188) & 0x1F))`.
 */
export function SKILLS_EvaluateManaCost256ths113c(
  m: Memory113c,
  nSkillId: number,
  nSkillLevel: number,
): number {
  const pRec = getSkillsTxtRecord(m, nSkillId)
  if (pRec === 0) return 0
  const wLvlMana = i16(m.get(pRec, D2SkillsTxt.wLvlMana))
  const wMana = i16(m.get(pRec, D2SkillsTxt.wMana))
  const nManaShift = m.get(pRec, D2SkillsTxt.nManaShift) & 0x1f
  const base = (Math.imul(wLvlMana, ((nSkillLevel | 0) - 1) | 0) + wMana) | 0
  return (base << nManaShift) >>> 0
}

/**
 * `@va D2Common:0x6FD9EB00` (`D2Common.#11070`, `SKILLS_GetReqLevel`, `__stdcall(nSkillId) -> int`, `ret 4`).
 *
 * Returns `(int16)pSkillsTxt->wReqLevel (+0x174)` if `nSkillId` is valid, else `0x7FFFFFFF`.
 */
export function SKILLS_GetReqLevel113c(m: Memory113c, nSkillId: number): number {
  const pRec = getSkillsTxtRecord(m, nSkillId)
  if (pRec === 0) return 0x7fffffff
  return i16(m.get(pRec, D2SkillsTxt.wReqLevel)) >>> 0
}

/**
 * `@va D2Common:0x6FD9F080` (`D2Common.#10708`, `SKILLS_GetSkillById`,
 * custom `__fastcall(ecx=pUnit, edx=nSkillId, [esp+4]=nOwnerItemGuid) -> D2SkillStrc*`, `ret 4`).
 *
 * Walks `pUnit->pSkills (+0xA8)->pFirstSkill (+0x04)` for the first node matching
 * `(int16)pSkill->pSkillsTxt->wSkillId === nSkillId` and `pSkill->nOwnerItemGuid (+0x34) === nOwnerItemGuid`.
 */
export function SKILLS_GetSkillById113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  nOwnerItemGuid: number,
): number {
  const pSkills = m.get(pUnit, D2UnitStrc.pSkills)
  if (pSkills === 0) return 0
  let pCur = m.get(pSkills, D2SkillListStrc.pFirstSkill)
  const targetId = nSkillId | 0
  const targetGuid = nOwnerItemGuid >>> 0
  while (pCur !== 0) {
    const pSkillsTxt = m.get(pCur, D2SkillStrc.pSkillsTxt)
    if (
      i16(m.get(pSkillsTxt, D2SkillsTxt.wSkillId)) === targetId &&
      m.get(pCur, D2SkillStrc.nOwnerItemGuid) === targetGuid
    ) {
      return pCur
    }
    pCur = m.get(pCur, D2SkillStrc.pNextSkill)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD9F0C0` (internal, `ecx=a, edx=b, [esp+4]=arg0, [esp+8]=arg1 -> int`, `ret 8`).
 *
 * Signed max callback (`mov eax, ecx; cmp eax, edx; jg +2; mov eax, edx; ret 8`).
 */
export function SKILLS_CalcMaxCallback113c(
  _m: Memory113c,
  a: number,
  b: number,
  _arg0 = 0,
  _arg1 = 0,
): number {
  const x = a | 0
  const y = b | 0
  return (x > y ? x : y) >>> 0
}

/**
 * `@va D2Common:0x6FD9F0D0` (internal, `ecx=a, edx=b, [esp+4]=arg0, [esp+8]=arg1 -> int`, `ret 8`).
 *
 * Signed min callback (`mov eax, ecx; cmp eax, edx; jl +2; mov eax, edx; ret 8`).
 */
export function SKILLS_CalcMinCallback113c(
  _m: Memory113c,
  a: number,
  b: number,
  _arg0 = 0,
  _arg1 = 0,
): number {
  const x = a | 0
  const y = b | 0
  return (x < y ? x : y) >>> 0
}

/**
 * `@va D2Common:0x6FD9F0E0` (`D2Common.#10313`, `SKILLS_GetPassiveState`, `__stdcall(nSkillId) -> int`, `ret 4`).
 *
 * Returns `(int16)pSkillsTxt->wPassiveState (+0x94)` if positive (`jg`), else `0`.
 */
export function SKILLS_GetPassiveState113c(m: Memory113c, nSkillId: number): number {
  const pRec = getSkillsTxtRecord(m, nSkillId)
  if (pRec === 0) return 0
  const st = i16(m.get(pRec, D2SkillsTxt.wPassiveState))
  return st > 0 ? st >>> 0 : 0
}

/**
 * `@va D2Common:0x6FD9F4C0` (internal, custom reg `eax=pUnit, edx=nSkillId -> int`, `ret`).
 *
 * Returns `pSkill->nSkillLevel (+0x28)` for the unit's base skill (`nOwnerItemGuid (+0x34) == -1`) matching `nSkillId`,
 * or `0` if not found.
 */
export function SKILLS_GetBaseSkillLevelById113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  if (pUnit === 0) return 0
  const pSkills = m.get(pUnit, D2UnitStrc.pSkills)
  if (pSkills === 0) return 0
  let pCur = m.get(pSkills, D2SkillListStrc.pFirstSkill)
  const targetId = nSkillId | 0
  while (pCur !== 0) {
    const pSkillsTxt = m.get(pCur, D2SkillStrc.pSkillsTxt)
    if (
      i16(m.get(pSkillsTxt, D2SkillsTxt.wSkillId)) === targetId &&
      (m.get(pCur, D2SkillStrc.nOwnerItemGuid) | 0) === -1
    ) {
      return m.get(pCur, D2SkillStrc.nSkillLevel)
    }
    pCur = m.get(pCur, D2SkillStrc.pNextSkill)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD9F510` (`D2Common.#10339`, `SKILLS_GetRequiredLevelForNextRank`,
 * `__stdcall(pUnit, nSkillId) -> int`, `ret 8`).
 *
 * Returns `(int16)pSkillsTxt->wReqLevel (+0x174) + baseSkillLevel`, or `0x7FFFFFFF` if `nSkillId` is invalid.
 */
export function SKILLS_GetRequiredLevelForNextRank113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const pRec = getSkillsTxtRecord(m, nSkillId)
  if (pRec === 0) return 0x7fffffff
  let reqLvl = i16(m.get(pRec, D2SkillsTxt.wReqLevel))
  const pSkills = m.get(pUnit, D2UnitStrc.pSkills)
  if (pSkills !== 0) {
    let pCur = m.get(pSkills, D2SkillListStrc.pFirstSkill)
    const targetId = nSkillId | 0
    while (pCur !== 0) {
      const pSkillsTxt = m.get(pCur, D2SkillStrc.pSkillsTxt)
      if (
        i16(m.get(pSkillsTxt, D2SkillsTxt.wSkillId)) === targetId &&
        (m.get(pCur, D2SkillStrc.nOwnerItemGuid) | 0) === -1
      ) {
        reqLvl = (reqLvl + (m.get(pCur, D2SkillStrc.nSkillLevel) | 0)) | 0
        break
      }
      pCur = m.get(pCur, D2SkillStrc.pNextSkill)
    }
  }
  return reqLvl >>> 0
}

/**
 * `@va D2Common:0x6FD9F780` (`D2Common.#10568`, `SKILLS_MapPlayerAnimModeToMonsterMode`,
 * `__stdcall(nPlrMode, nMonClassId) -> int`, `ret 8`).
 */
export function SKILLS_MapPlayerAnimModeToMonsterMode113c(
  m: Memory113c,
  nPlrMode: number,
  nMonClassId: number,
): number {
  let mode = m.u32((PLR_TO_MON_MODE_TABLE_VA_113C + Math.imul(nPlrMode | 0, 4)) >>> 0) | 0
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const monId = nMonClassId | 0
  const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C)

  while (true) {
    const nMonCount = m.u32((pDataTables + DATATABLES_MONSTATS_COUNT_OFF_113C) >>> 0) | 0
    if (monId >= 0 && monId < nMonCount) {
      const pMonBase = m.u32((pDataTables + DATATABLES_MONSTATS_TXT_OFF_113C) >>> 0)
      const pMonStats = (pMonBase + Math.imul(monId, D2MonStatsTxt_SIZE)) >>> 0
      const wMonStatsEx = i16(m.get(pMonStats, D2MonStatsTxt.wMonStatsEx))
      const nMon2Count = m.u32((pDataTables + DATATABLES_MONSTATS2_COUNT_OFF_113C) >>> 0) | 0
      if (wMonStatsEx >= 0 && wMonStatsEx < nMon2Count) {
        const pMon2Base = m.u32((pDataTables + DATATABLES_MONSTATS2_TXT_OFF_113C) >>> 0)
        const pMonStats2 = (pMon2Base + Math.imul(wMonStatsEx, D2MonStats2Txt_SIZE)) >>> 0
        if (pMonStats2 !== 0) {
          const byteVal = m.u8((pMonStats2 + 0xf0 + (mode >> 3)) >>> 0)
          const bitMask = m.u32((pBitMasks + ((mode & 7) << 2)) >>> 0)
          if ((byteVal & bitMask) !== 0) {
            return mode >>> 0
          }
        }
      }
    }

    if (mode === 1) return 1
    if (mode === 15) {
      mode = 2
    } else if (mode === 9 || mode === 10 || mode === 11) {
      mode = 8
    } else if (mode === 6) {
      mode = 3
    } else if (mode === 5 || mode === 7) {
      mode = 4
    } else {
      mode = 1
    }
  }
}

/**
 * `@va D2Common:0x6FDA2E00` (`D2Common.#10194`, `DATATBLS_GetMonSeqTableRecord`,
 * `__stdcall(nSeqId) -> D2MonSeqTableStrc*`, `ret 4`).
 */
export function DATATBLS_GetMonSeqTableRecord113c(m: Memory113c, nSeqId: number): number {
  const id = nSeqId | 0
  if (id < 0) return 0
  const nCount = m.u32(G_MONSEQ_COUNT_VA_113C) | 0
  if (id >= nCount) return 0
  const pBase = m.u32(G_MONSEQ_TABLE_VA_113C)
  return (pBase + Math.imul(id, D2MONSEQ_TABLE_RECORD_SIZE_113C)) >>> 0
}

/**
 * `@va D2Common:0x6FDB9DC0` (`D2Common.#10242`, `MISSILE_EvaluateElementalLength`,
 * `__stdcall(pOwner, pUnit, nMissileId, nLevel) -> int`, `ret 0x10`).
 */
export function MISSILE_EvaluateElementalLength113c(
  m: Memory113c,
  _pOwner: number,
  _pUnit: number,
  nMissileId: number,
  nLevel: number,
): number {
  const id = nMissileId | 0
  if (id < 0) return 0
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const nCount = m.u32((pDataTables + DATATABLES_MISSILES_COUNT_OFF_113C) >>> 0) | 0
  if (id >= nCount) return 0
  const pBase = m.u32((pDataTables + DATATABLES_MISSILES_TXT_OFF_113C) >>> 0)
  const pRec = (pBase + Math.imul(id, D2MissilesTxt_SIZE)) >>> 0
  if (pRec === 0) return 0

  const eLen = m.get(pRec, D2MissilesTxt.dwELen) | 0
  const eLev1 = m.get(pRec, D2MissilesTxt.dwELevLen1) | 0
  const eLev2 = m.get(pRec, D2MissilesTxt.dwELevLen2) | 0
  const eLev3 = m.get(pRec, D2MissilesTxt.dwELevLen3) | 0
  const lvl = nLevel | 0

  if (lvl <= 0) return eLen >>> 0
  if (lvl <= 8) return (eLen + Math.imul((lvl - 1) | 0, eLev1)) >>> 0
  const t1 = Math.imul(7, eLev1)
  if (lvl <= 16) return (eLen + t1 + Math.imul((lvl - 8) | 0, eLev2)) >>> 0
  const t2 = (t1 + (eLev2 << 3)) | 0
  return (eLen + t2 + Math.imul((lvl - 16) | 0, eLev3)) >>> 0
}

/**
 * `@va D2Common:0x6FDCF5E0` (`D2Common.#10080`, `UNITS_GetUnitDistanceToCoordinates` / `UNITS_GetDistanceToCoordinates`,
 * `__stdcall(pUnit, nTargetX, nTargetY) -> int`, `ret 0xC`).
 */
export function UNITS_GetUnitDistanceToCoordinates113c(
  m: Memory113c,
  pUnit: number,
  nTargetX: number,
  nTargetY: number,
): number {
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType) | 0
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  let unitX = 0
  let unitY = 0

  if (unitType === 2 || (unitType > 3 && unitType <= 5)) {
    unitX = m.get(pPath, D2StaticPathStrc.nPosX) | 0
    unitY = m.get(pPath, D2StaticPathStrc.nPosY) | 0
  } else if (pPath !== 0) {
    unitX = m.get(pPath, D2DynamicPathStrc.wPosX)
    unitY = m.get(pPath, D2DynamicPathStrc.wPosY)
  }

  let dx = ((nTargetX | 0) - unitX) | 0
  if (dx < 0) dx = -dx | 0
  if (dx < 0) dx = 0

  let dy = ((nTargetY | 0) - unitY) | 0
  if (dy < 0) dy = -dy | 0
  if (dy < 0) dy = 0

  const sum = (dx > dy ? dy + (dx << 1) : dx + (dy << 1)) | 0
  return sdiv32(sum, 2) >>> 0
}

// ============================================================================
// K1r2 Iteration 7 Lane B — Batch B036 (19 D2Common hostImport functions)
// ============================================================================

/**
 * `@va D2Common:0x6FD9DD30` (`D2Common.#10252` `SKILLS_SetCharges`,
 * stdcall `[esp+4] = pSkill`, `[esp+8] = nCharges`, `ret 8`, void).
 */
export function SKILLS_SetCharges113c(m: Memory113c, pSkill: number, nCharges: number): void {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xdae)
  }
  m.set(ptr, D2SkillStrc.nQuantity, nCharges >>> 0)
}

/**
 * `@va D2Common:0x6FD9DD70` (`D2Common.#10353` `SKILLS_GetCharges`,
 * stdcall `[esp+4] = pSkill`, `ret 4` -> `int32_t`).
 */
export function SKILLS_GetCharges113c(m: Memory113c, pSkill: number): number {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xda5)
  }
  return m.get(ptr, D2SkillStrc.nQuantity)
}

/**
 * `@va D2Common:0x6FD9DE60` (`D2Common.#10137` `SKILLS_SetParam0C`,
 * stdcall `[esp+4] = pSkill`, `[esp+8] = nVal`, `ret 8`, void).
 */
export function SKILLS_SetParam0C113c(m: Memory113c, pSkill: number, nVal: number): void {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa9b)
  }
  m.set(ptr, D2SkillStrc.dwParam0C, nVal >>> 0)
}

/**
 * `@va D2Common:0x6FD9DEA0` (`D2Common.#11031` `SKILLS_SetParam4`,
 * stdcall `[esp+4] = pSkill`, `[esp+8] = nVal`, `ret 8`, void).
 */
export function SKILLS_SetParam4113c(m: Memory113c, pSkill: number, nVal: number): void {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa92)
  }
  m.set(ptr, D2SkillStrc.dwParam4, nVal >>> 0)
}

/**
 * `@va D2Common:0x6FD9DEE0` (`D2Common.#10748` `SKILLS_SetParam3`,
 * stdcall `[esp+4] = pSkill`, `[esp+8] = nVal`, `ret 8`, void).
 */
export function SKILLS_SetParam3113c(m: Memory113c, pSkill: number, nVal: number): void {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa89)
  }
  m.set(ptr, D2SkillStrc.dwParam3, nVal >>> 0)
}

/**
 * `@va D2Common:0x6FD9DF20` (`D2Common.#10554` `SKILLS_SetParam2`,
 * stdcall `[esp+4] = pSkill`, `[esp+8] = nVal`, `ret 8`, void).
 */
export function SKILLS_SetParam2113c(m: Memory113c, pSkill: number, nVal: number): void {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa80)
  }
  m.set(ptr, D2SkillStrc.dwParam2, nVal >>> 0)
}

/**
 * `@va D2Common:0x6FD9DF60` (`D2Common.#10243` `SKILLS_SetParam1`,
 * stdcall `[esp+4] = pSkill`, `[esp+8] = nVal`, `ret 8`, void).
 */
export function SKILLS_SetParam1113c(m: Memory113c, pSkill: number, nVal: number): void {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa77)
  }
  m.set(ptr, D2SkillStrc.dwParam1, nVal >>> 0)
}

/**
 * `@va D2Common:0x6FD9DFA0` (`D2Common.#10631` `SKILLS_GetParam4`,
 * stdcall `[esp+4] = pSkill`, `ret 4` -> `int32_t`).
 */
export function SKILLS_GetParam4113c(m: Memory113c, pSkill: number): number {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa6e)
  }
  return m.get(ptr, D2SkillStrc.dwParam4)
}

/**
 * `@va D2Common:0x6FD9DFD0` (`D2Common.#10179` `SKILLS_GetParam3`,
 * stdcall `[esp+4] = pSkill`, `ret 4` -> `int32_t`).
 */
export function SKILLS_GetParam3113c(m: Memory113c, pSkill: number): number {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa65)
  }
  return m.get(ptr, D2SkillStrc.dwParam3)
}

/**
 * `@va D2Common:0x6FD9E000` (`D2Common.#10649` `SKILLS_GetParam2`,
 * stdcall `[esp+4] = pSkill`, `ret 4` -> `int32_t`).
 */
export function SKILLS_GetParam2113c(m: Memory113c, pSkill: number): number {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa5c)
  }
  return m.get(ptr, D2SkillStrc.dwParam2)
}

/**
 * `@va D2Common:0x6FD9E030` (`D2Common.#10980` `SKILLS_GetParam1`,
 * stdcall `[esp+4] = pSkill`, `ret 4` -> `int32_t`).
 */
export function SKILLS_GetParam1113c(m: Memory113c, pSkill: number): number {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xa53)
  }
  return m.get(ptr, D2SkillStrc.dwParam1)
}

/**
 * `@va D2Common:0x6FD9E240` (`D2Common.#10537` `SKILLS_GetItemSkillInfo`,
 * stdcall `[esp+4] = pSkill`, `[esp+8] = pOutItemGuid`, `[esp+0xC] = pOutSkillId`,
 * `[esp+0x10] = pOutLevel`, `[esp+0x14] = pOutCharges`, `ret 0x14` -> `BOOL`).
 */
export function SKILLS_GetItemSkillInfo113c(
  m: Memory113c,
  pSkill: number,
  pOutItemGuid: number,
  pOutSkillId: number,
  pOutLevel: number,
  pOutCharges: number,
): number {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x642)
  }
  const ownerGuid = m.get(ptr, D2SkillStrc.nOwnerItemGuid)
  if (ownerGuid === 0xffffffff) {
    return 0
  }
  const outGuid = pOutItemGuid >>> 0
  if (outGuid !== 0) {
    m.setU32(outGuid, ownerGuid)
  }
  const outSkillId = pOutSkillId >>> 0
  if (outSkillId !== 0) {
    const pSkillsTxt = m.get(ptr, D2SkillStrc.pSkillsTxt)
    const skillId = i16(m.get(pSkillsTxt, D2SkillsTxt.wSkillId))
    m.setU32(outSkillId, skillId >>> 0)
  }
  const outLevel = pOutLevel >>> 0
  if (outLevel !== 0) {
    m.setU32(outLevel, m.get(ptr, D2SkillStrc.nSkillLevel))
  }
  const outCharges = pOutCharges >>> 0
  if (outCharges !== 0) {
    m.setU32(outCharges, m.get(ptr, D2SkillStrc.nCharges))
  }
  return 1
}

/**
 * `@va D2Common:0x6FD9E2B0` (`D2Common.#10304` `SKILLS_GetOwnerItemGuid`,
 * stdcall `[esp+4] = pSkill`, `ret 4` -> `uint32_t`).
 */
export function SKILLS_GetOwnerItemGuid113c(m: Memory113c, pSkill: number): number {
  const ptr = pSkill >>> 0
  if (ptr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x638)
  }
  return m.get(ptr, D2SkillStrc.nOwnerItemGuid)
}

/**
 * `@va D2Common:0x6FD9E3F0` (`D2Common.#10856` `SKILLS_AllocSkillList`,
 * stdcall `[esp+4] = pMemPool`, `ret 4` -> `D2SkillListStrc*`).
 */
export function SKILLS_AllocSkillList113c(m: Memory113c, pMemPool: number): number {
  const pList = m.alloc(D2SkillListStrc_SIZE) >>> 0
  m.set(pList, D2SkillListStrc.pMemPool, 0)
  m.set(pList, D2SkillListStrc.pFirstSkill, 0)
  m.set(pList, D2SkillListStrc.pLeftSkill, 0)
  m.set(pList, D2SkillListStrc.pRightSkill, 0)
  m.set(pList, D2SkillListStrc.pUsedSkill, 0)
  m.set(pList, D2SkillListStrc.dwFlags, 0)
  m.set(pList, D2SkillListStrc.pMemPool, pMemPool >>> 0)
  return pList
}

/**
 * `@va D2Common:0x6FD9E6D0` (`D2Common.#10102` `SKILLS_EvaluateSkillManaCost`,
 * stdcall `[esp+4] = nSkillId`, `[esp+8] = nLevel`, `ret 8` -> `int32_t`).
 */
export function SKILLS_EvaluateSkillManaCost113c(
  m: Memory113c,
  nSkillId: number,
  nLevel: number,
): number {
  const skillId = nSkillId | 0
  if (skillId < 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x100d)
  }
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
  if (skillId >= (m.u32((sgpt + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0)) {
    throw new D2CommonAssertError('Skills.cpp', 0x100d)
  }
  const pSkillsTxt =
    (m.u32((sgpt + DATATABLES_SKILLS_TXT_OFF_113C) >>> 0) + imul32(skillId, D2SkillsTxt_SIZE)) >>> 0
  if (pSkillsTxt === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x100d)
  }
  const wLvlMana = i16(m.get(pSkillsTxt, D2SkillsTxt.wLvlMana))
  const wMana = i16(m.get(pSkillsTxt, D2SkillsTxt.wMana))
  const nManaShift = m.get(pSkillsTxt, D2SkillsTxt.nManaShift) & 0x1f
  const val = sar32(
    ((imul32(wLvlMana, ((nLevel | 0) - 1) | 0) + wMana) | 0) << nManaShift,
    8,
  )
  return val < 0 ? 0 : val >>> 0
}

/**
 * `@va D2Common:0x6FD9EB40` (internal LTCG helper `SKILLS_HasSkillByTxtRecord`,
 * custom reg `eax = pUnit`, `ecx = pSkillsTxt`, `ret` -> `BOOL`).
 */
export function SKILLS_HasSkillByTxtRecord113c(
  m: Memory113c,
  eax: number,
  ecx: number,
): number {
  const pUnit = eax >>> 0
  if (pUnit === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x638)
  }
  const pSkills = m.get(pUnit, D2UnitStrc.pSkills)
  let pSkill = pSkills !== 0 ? m.get(pSkills, D2SkillListStrc.pFirstSkill) : 0
  if (pSkill === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0xab1)
  }
  const targetTxt = ecx >>> 0
  while (pSkill !== 0) {
    if (m.get(pSkill, D2SkillStrc.pSkillsTxt) === targetTxt) {
      return 1
    }
    pSkill = m.get(pSkill, D2SkillStrc.pNextSkill)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD9ECC0` (`D2Common.#10978` `SKILLS_SetRightSkill`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nSkillId`, `[esp+0xC] = dwOwnerGuid`, `ret 0xC`, void).
 */
export function SKILLS_SetRightSkill113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  dwOwnerGuid: number,
): void {
  const skillId = nSkillId | 0
  if (skillId < 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x680)
  }
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
  if (skillId >= (m.u32((sgpt + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0)) {
    throw new D2CommonAssertError('Skills.cpp', 0x680)
  }
  const pSkillsTxt =
    (m.u32((sgpt + DATATABLES_SKILLS_TXT_OFF_113C) >>> 0) + imul32(skillId, D2SkillsTxt_SIZE)) >>> 0
  if (pSkillsTxt === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x680)
  }
  const unitPtr = pUnit >>> 0
  if (unitPtr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x638)
  }
  const pSkills = m.get(unitPtr, D2UnitStrc.pSkills)
  let pSkill = pSkills !== 0 ? m.get(pSkills, D2SkillListStrc.pFirstSkill) : 0
  const targetOwner = dwOwnerGuid >>> 0
  while (pSkill !== 0) {
    if (
      m.get(pSkill, D2SkillStrc.pSkillsTxt) === pSkillsTxt &&
      m.get(pSkill, D2SkillStrc.nOwnerItemGuid) === targetOwner
    ) {
      m.set(pSkills, D2SkillListStrc.pRightSkill, pSkill)
      return
    }
    pSkill = m.get(pSkill, D2SkillStrc.pNextSkill)
  }
}

/**
 * `@va D2Common:0x6FD9ED60` (`D2Common.#10546` `SKILLS_SetLeftSkill`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nSkillId`, `[esp+0xC] = dwOwnerGuid`, `ret 0xC`, void).
 */
export function SKILLS_SetLeftSkill113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  dwOwnerGuid: number,
): void {
  const skillId = nSkillId | 0
  if (skillId < 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x669)
  }
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
  if (skillId >= (m.u32((sgpt + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0)) {
    throw new D2CommonAssertError('Skills.cpp', 0x669)
  }
  const pSkillsTxt =
    (m.u32((sgpt + DATATABLES_SKILLS_TXT_OFF_113C) >>> 0) + imul32(skillId, D2SkillsTxt_SIZE)) >>> 0
  if (pSkillsTxt === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x669)
  }
  const unitPtr = pUnit >>> 0
  if (unitPtr === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x638)
  }
  const pSkills = m.get(unitPtr, D2UnitStrc.pSkills)
  let pSkill = pSkills !== 0 ? m.get(pSkills, D2SkillListStrc.pFirstSkill) : 0
  const targetOwner = dwOwnerGuid >>> 0
  while (pSkill !== 0) {
    if (
      m.get(pSkill, D2SkillStrc.pSkillsTxt) === pSkillsTxt &&
      m.get(pSkill, D2SkillStrc.nOwnerItemGuid) === targetOwner
    ) {
      m.set(pSkills, D2SkillListStrc.pLeftSkill, pSkill)
      return
    }
    pSkill = m.get(pSkill, D2SkillStrc.pNextSkill)
  }
}

/**
 * `@va D2Common:0x6FD9F000` (`D2Common.#10335` `SKILLS_FreeSkillList`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 */
export function SKILLS_FreeSkillList113c(m: Memory113c, pUnit: number): void {
  const unitPtr = pUnit >>> 0
  if (unitPtr === 0) {
    return
  }
  const pSkills = m.get(unitPtr, D2UnitStrc.pSkills)
  if (pSkills === 0) {
    return
  }
  let pSkill = m.get(pSkills, D2SkillListStrc.pFirstSkill)
  while (pSkill !== 0) {
    m.get(unitPtr, D2UnitStrc.pMemPool)
    const pNext = m.get(pSkill, D2SkillStrc.pNextSkill)
    ;(m as { free?: (p: number) => void }).free?.(pSkill)
    pSkill = pNext
  }
  m.get(unitPtr, D2UnitStrc.pMemPool)
  ;(m as { free?: (p: number) => void }).free?.(pSkills)
  m.set(unitPtr, D2UnitStrc.pSkills, 0)
}

// ============================================================================
// Batch B039 & B049 — skills.ts functions (B039-06..10, B049-16)
// ============================================================================

/** `.data` `D2InventoryGridInfoStrc` body grid definition at `0x6FDED378` (`bGridX = 13, bGridY = 1`). */
export const BODY_GRID_DEF_VA_113C = 0x6fded378
/** `.bss` `D2ExperienceTxt*` at `0x6FDF0B50` (`+0x00` = `nMaxLevel`). */
export const SGPT_EXPERIENCE_TXT_PTR_VA_113C = 0x6fdf0b50
/** `sgptDataTables` offsets used by `B039` / `B049` skills functions. */
export const DATATABLES_STATES_COUNT_OFF_113C = 0xc4
export const DATATABLES_FSTATEMASKS_PTR_OFF_113C = 0x110
export const DATATABLES_ISC_TXT_OFF_113C = 0xbcc
export const DATATABLES_ISC_COUNT_OFF_113C = 0xbd4

const INV_SIGNATURE_113C = 0x01020304
const INV_OFF_PGRIDS_113C = 0x14
const INV_OFF_NGRIDS_113C = 0x18

/**
 * Exact 1:1 `Memory113c`-backed `0x6FD6E1B0` (`INVENTORY_GetOrInitGrid`,
 * custom reg `eax = gridIdx`, `ebx = pInventory`, stack `[esp+4] = pGridDef`, `ret 4`).
 */
function inventoryGetOrInitGridMem113c(
  m: Memory113c,
  gridIdx: number,
  pInventory: number,
  pGridDef: number,
): number {
  const idx = gridIdx | 0
  const inv = pInventory >>> 0
  const def = pGridDef >>> 0
  const nGrids = m.u32((inv + INV_OFF_NGRIDS_113C) >>> 0) | 0
  if (nGrids > idx) {
    const pGrids = m.u32((inv + INV_OFF_PGRIDS_113C) >>> 0)
    const pGrid = (pGrids + ((idx << 4) >>> 0)) >>> 0
    const ppItems = m.u32((pGrid + D2InventoryGridStrc.ppItems.off) >>> 0)
    if (def === 0) {
      return ppItems !== 0 ? pGrid : 0
    }
    if (ppItems === 0) {
      const gx = m.u8(def)
      m.set(pGrid, D2InventoryGridStrc.nGridWidth, gx)
      const gy = m.u8((def + 1) >>> 0)
      const countBytes = (imul32(m.get(pGrid, D2InventoryGridStrc.nGridWidth), gy) << 2) >>> 0
      m.set(pGrid, D2InventoryGridStrc.nGridHeight, gy)
      const newItems = m.alloc(countBytes) >>> 0
      const zeroCount = (imul32(m.get(pGrid, D2InventoryGridStrc.nGridWidth), m.get(pGrid, D2InventoryGridStrc.nGridHeight)) << 2) >>> 0
      m.set(pGrid, D2InventoryGridStrc.ppItems, newItems)
      m.fill(newItems, zeroCount, 0)
    }
    if (m.get(pGrid, D2InventoryGridStrc.nGridWidth) !== m.u8(def)) return 0
    if (m.get(pGrid, D2InventoryGridStrc.nGridHeight) !== m.u8((def + 1) >>> 0)) return 0
    return pGrid
  }
  if (def === 0) return 0
  const oldGrids = m.u32((inv + INV_OFF_PGRIDS_113C) >>> 0)
  const newCount = (idx + 1) | 0
  const newByteSize = (newCount << 4) >>> 0
  const newGrids = m.alloc(newByteSize) >>> 0
  if (oldGrids !== 0 && nGrids > 0) {
    const copyBytes = (nGrids << 4) >>> 0
    for (let i = 0; i < copyBytes; i++) {
      m.setU8((newGrids + i) >>> 0, m.u8((oldGrids + i) >>> 0))
    }
  }
  const oldCount = m.u32((inv + INV_OFF_NGRIDS_113C) >>> 0) | 0
  m.setU32((inv + INV_OFF_PGRIDS_113C) >>> 0, newGrids)
  const clearBytes = (((idx - oldCount + 1) | 0) << 4) >>> 0
  m.fill((newGrids + ((oldCount << 4) >>> 0)) >>> 0, clearBytes, 0)
  m.setU32((inv + INV_OFF_NGRIDS_113C) >>> 0, newCount >>> 0)
  const gx = m.u8(def)
  const pGrid = (m.u32((inv + INV_OFF_PGRIDS_113C) >>> 0) + ((idx << 4) >>> 0)) >>> 0
  m.set(pGrid, D2InventoryGridStrc.nGridWidth, gx)
  const gy = m.u8((def + 1) >>> 0)
  m.set(pGrid, D2InventoryGridStrc.nGridHeight, gy)
  const allocBytes = (imul32(gx, gy) << 2) >>> 0
  const newItems = m.alloc(allocBytes) >>> 0
  const zeroBytes = (imul32(m.get(pGrid, D2InventoryGridStrc.nGridWidth), m.get(pGrid, D2InventoryGridStrc.nGridHeight)) << 2) >>> 0
  m.set(pGrid, D2InventoryGridStrc.ppItems, newItems)
  m.fill(newItems, zeroBytes, 0)
  return pGrid
}

/**
 * Exact 1:1 `Memory113c`-backed `0x6FD88A80` (`STATLIST_GetTotalStatWithMin`,
 * custom reg `ebx = pStatList`, `edi = dwKey`, stack `[esp+4] = pIsc` -> `i32`).
 */
function statListGetTotalStatWithMinMem113c(
  m: Memory113c,
  pStatList: number,
  dwKey: number,
  pIsc: number,
): number {
  const ebx = pStatList >>> 0
  const ebp = (m.u32((ebx + 0x10) >>> 0) & 0x80000000) >>> 0
  const pHdr = ebp !== 0 ? (ebx + 0x48) >>> 0 : (ebx + 0x24) >>> 0
  const idx = STATLIST_FindStatIndex113c(m, pHdr, dwKey >>> 0)
  if (idx < 0) return 0
  const pEntry = (m.u32(pHdr) + idx * 8) >>> 0
  if (pEntry === 0) return 0
  let val = m.u32((pEntry + 4) >>> 0) | 0
  const esi = pIsc >>> 0
  if (esi !== 0) {
    const dl = m.u8((esi + 0x05) >>> 0)
    const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C)
    if ((m.u8((pBitMasks + 0x08) >>> 0) & dl) !== 0 && ebp !== 0) {
      const pUnit = m.u32((ebx + 0x44) >>> 0)
      if (pUnit !== 0) {
        const uType = m.u32(pUnit)
        if (uType === 0 || uType === 1) {
          const minAccr = m.u32((esi + 0x2c) >>> 0) | 0
          if (val < minAccr) {
            const shift = m.u8((esi + 0x18) >>> 0) & 31
            val = (minAccr << shift) | 0
          }
        }
      }
    }
  }
  return val | 0
}

/**
 * Exact 1:1 `Memory113c`-backed `0x6FD88B70` (`STATLIST_GetUnitStat`,
 * `__stdcall(pUnit, nStatId, wLayer) -> i32`, `ret 0xC`).
 */
function statListGetUnitStatMem113c(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  wLayer: number,
): number {
  const unitPtr = pUnit >>> 0
  if (unitPtr === 0) return 0
  const pStatList = m.get(unitPtr, D2UnitStrc.pStatListEx)
  if (pStatList === 0) return 0
  const statId = nStatId | 0
  if (statId < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
  if (statId >= (m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0)) return 0
  const pIsc = (m.u32((sgpt + DATATABLES_ISC_TXT_OFF_113C) >>> 0) + imul32(statId, D2ItemStatCostTxt_SIZE)) >>> 0
  if (pIsc === 0) return 0
  const dwKey = ((statId << 16) + (wLayer & 0xffff)) >>> 0
  return statListGetTotalStatWithMinMem113c(m, pStatList, dwKey, pIsc)
}

/**
 * `@va D2Common:0x6FD83F40` (internal `STATES_CheckUnitAnyActiveStateMask`,
 * `__stdcall(pUnit) -> BOOL`, `ret 4`).
 */
export function STATES_CheckUnitAnyActiveStateMask113c(m: Memory113c, pUnit: number): number {
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((sgpt + DATATABLES_FSTATEMASKS_PTR_OFF_113C) >>> 0)
  const unitPtr = pUnit >>> 0
  if (unitPtr === 0) return 0
  const pListEx = m.get(unitPtr, D2UnitStrc.pStatListEx)
  if (pListEx === 0) return 0
  if ((m.get(pListEx, D2StatListExStrc.dwFlags) | 0) >= 0) return 0
  const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
  if (pStateFlags === 0) return 0
  const nStates = m.u32((sgpt + DATATABLES_STATES_COUNT_OFF_113C) >>> 0) | 0
  const plus31 = (nStates + 31) | 0
  const nDwords = sar32((plus31 + ((plus31 >> 31) & 31)) | 0, 5)
  for (let i = 0; i < nDwords; i++) {
    const maskWord = m.u32((pMask + i * 4) >>> 0)
    if (maskWord !== 0 && (m.u32((pStateFlags + i * 4) >>> 0) & maskWord) !== 0) {
      return 1
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD9EBF0` (internal `SKILLS_GetWeaponFromArmSlot`,
 * custom reg `eax = nArmCode`, `ecx = pInventory` -> `pItem`, `ret`).
 */
export function SKILLS_GetWeaponFromArmSlot113c(
  m: Memory113c,
  nArmCode: number,
  pInventory: number,
): number {
  const inv = pInventory >>> 0
  if ((nArmCode | 0) === 5) {
    if (inv === 0 || m.get(inv, D2InventoryStrc.dwSignature) !== INV_SIGNATURE_113C) return 0
    const pGrid = inventoryGetOrInitGridMem113c(m, 0, inv, BODY_GRID_DEF_VA_113C)
    if (pGrid === 0) return 0
    const ppItems = m.get(pGrid, D2InventoryGridStrc.ppItems)
    return m.u32((ppItems + 0x10) >>> 0)
  }
  if (inv === 0 || m.get(inv, D2InventoryStrc.dwSignature) !== INV_SIGNATURE_113C) return 0
  const pGrid = inventoryGetOrInitGridMem113c(m, 0, inv, BODY_GRID_DEF_VA_113C)
  if (pGrid === 0) return 0
  const ppItems = m.get(pGrid, D2InventoryGridStrc.ppItems)
  return m.u32((ppItems + 0x14) >>> 0)
}

/**
 * `@va D2Common:0x6FD9F870` (internal `SKILLS_ApplyElementalMasteryBonus`,
 * custom reg `eax = pUnit`, `ecx = nElemType`, `esi = nDamage` -> `i32`, `ret`).
 */
export function SKILLS_ApplyElementalMasteryBonus113c(
  m: Memory113c,
  pUnit: number,
  nElemType: number,
  nDamage: number,
): number {
  const elemIdx = ((nElemType | 0) - 1) >>> 0
  if (elemIdx > 11) return 0
  switch (elemIdx) {
    case 0: {
      const bonus = statListGetUnitStatMem113c(m, pUnit, 0x149, 0)
      return bonus !== 0 ? mulDiv113c(bonus, nDamage | 0, 100) >>> 0 : 0
    }
    case 1: {
      const bonus = statListGetUnitStatMem113c(m, pUnit, 0x14a, 0)
      return bonus !== 0 ? mulDiv113c(bonus, nDamage | 0, 100) >>> 0 : 0
    }
    case 3:
    case 11: {
      const unitPtr = pUnit >>> 0
      if (unitPtr === 0) return 0
      const pStatList = m.get(unitPtr, D2UnitStrc.pStatListEx)
      if (pStatList === 0) return 0
      const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
      if ((m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0) <= 0x14b) return 0
      const pIsc = (m.u32((sgpt + DATATABLES_ISC_TXT_OFF_113C) >>> 0) + 0x1a2ec) >>> 0
      if (pIsc === 0) return 0
      const bonus = statListGetTotalStatWithMinMem113c(m, pStatList, 0x14b0000, pIsc)
      return bonus !== 0 ? mulDiv113c(bonus, nDamage | 0, 100) >>> 0 : 0
    }
    case 4: {
      const bonus = statListGetUnitStatMem113c(m, pUnit, 0x14c, 0)
      return bonus !== 0 ? mulDiv113c(bonus, nDamage | 0, 100) >>> 0 : 0
    }
    default:
      return 0
  }
}

/**
 * `@va D2Common:0x6FD9F930` (internal `SKILLS_GetBasePhysDamageMinOrMax`,
 * custom reg `eax = pUnit`, stack `[esp+4] = bIsMin` -> `i32`, `ret 4`).
 */
export function SKILLS_GetBasePhysDamageMinOrMax113c(
  m: Memory113c,
  pUnit: number,
  bIsMin: number,
): number {
  const unitPtr = pUnit >>> 0
  let ecx = 0
  if (unitPtr !== 0) {
    if (m.get(unitPtr, D2UnitStrc.dwUnitType) === 0) {
      const pStatList = m.get(unitPtr, D2UnitStrc.pStatListEx)
      const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
      let str = 0
      if (pStatList !== 0 && (m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0) > 0) {
        const pIsc0 = m.u32((sgpt + DATATABLES_ISC_TXT_OFF_113C) >>> 0)
        if (pIsc0 !== 0) {
          str = statListGetTotalStatWithMinMem113c(m, pStatList, 0, pIsc0)
        }
      }
      let dex = 0
      if (pStatList !== 0 && (m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0) > 2) {
        const pIsc2 = (m.u32((sgpt + DATATABLES_ISC_TXT_OFF_113C) >>> 0) + 0x288) >>> 0
        if (pIsc2 !== 0) {
          dex = statListGetTotalStatWithMinMem113c(m, pStatList, 0x20000, pIsc2)
        }
      }
      ecx = (dex + str - 0x14) | 0
    } else {
      const pStatList = m.get(unitPtr, D2UnitStrc.pStatListEx)
      let lvl = 0
      if (pStatList !== 0) {
        const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
        if ((m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0) > 0x0c) {
          const pIsc12 = (m.u32((sgpt + DATATABLES_ISC_TXT_OFF_113C) >>> 0) + 0xf30) >>> 0
          if (pIsc12 !== 0) {
            lvl = statListGetTotalStatWithMinMem113c(m, pStatList, 0xc0000, pIsc12)
          }
        }
      }
      ecx = (lvl * 3) | 0
    }
  }
  if (ecx < 1) ecx = 1
  if ((bIsMin | 0) !== 0) {
    const q4 = sar32((ecx + ((ecx >> 31) & 3)) | 0, 2)
    return (q4 << 8) >>> 0
  }
  const q3 = Math.trunc(ecx / 3) | 0
  return (q3 << 8) >>> 0
}

/**
 * `@va D2Common:0x6FDA0870` (internal `SKILLS_CheckItemChargedSkillHasCharges`,
 * custom reg `ecx = pUnit`, `eax = pSkill` -> `BOOL`, `ret`).
 */
export function SKILLS_CheckItemChargedSkillHasCharges113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
): number {
  const unitPtr = pUnit >>> 0
  const skillPtr = pSkill >>> 0
  if (unitPtr === 0 || skillPtr === 0) return 0
  const pInv = m.get(unitPtr, D2UnitStrc.pInventory)
  if (pInv === 0) return 1
  const ownerGuid = m.get(skillPtr, D2SkillStrc.nOwnerItemGuid)
  if (ownerGuid === 0xffffffff) return 1
  const pSkillsTxt = m.get(skillPtr, D2SkillStrc.pSkillsTxt)
  const wSkillId = (m.get(pSkillsTxt, D2SkillsTxt.wSkillId) << 16) >> 16
  const rawLvl = m.get(skillPtr, D2SkillStrc.nSkillLevel) | 0
  const pExp = m.u32(SGPT_EXPERIENCE_TXT_PTR_VA_113C)
  const maxLvl = m.u32(pExp) | 0
  let lvl = rawLvl <= 0 ? 0 : rawLvl
  if (lvl >= maxLvl) lvl = maxLvl
  const wLayer = ((lvl & 0x3f) + (wSkillId << 6)) | 0
  if (m.get(pInv, D2InventoryStrc.dwSignature) !== INV_SIGNATURE_113C) return 1
  let pItem = m.get(pInv, D2InventoryStrc.pFirstItem)
  while (pItem !== 0) {
    if (m.get(pItem, D2UnitStrc.dwUnitType) !== 4) return 1
    if (m.get(pItem, D2UnitStrc.dwUnitId) === ownerGuid) {
      const val = statListGetUnitStatMem113c(m, pItem, 0xcc, wLayer)
      return (val & 0xff) > 0 ? 1 : 0
    }
    const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
    if (pItemData === 0) return 1
    const pExtra = (pItemData + 0x5c) >>> 0
    if (pExtra === 0) return 1
    pItem = m.u32((pExtra + 0x08) >>> 0)
  }
  return 1
}

/**
 * `@va D2Common:0x6FD9EE00` (internal `SKILLS_AddOrRemoveItemChargedSkill`,
 * custom reg `eax = nSkillId`, stack `[esp+4] = pUnit`, `[esp+8] = dwItemGuid`,
 * `[esp+0xC] = nLevel`, `[esp+0x10] = nCharges`, `[esp+0x14] = bRemove`, `ret 0x14`, void).
 */
export function SKILLS_AddOrRemoveItemChargedSkill113c(
  m: Memory113c,
  nSkillId: number,
  pUnit: number,
  dwItemGuid: number,
  nLevel: number,
  nCharges: number,
  bRemove: number,
): void {
  const unitPtr = pUnit >>> 0
  if (unitPtr === 0) return
  if (m.get(unitPtr, D2UnitStrc.dwUnitType) !== 0) return
  const lvl = nLevel | 0
  if (lvl <= 0) return
  const skillId = nSkillId | 0
  if (skillId < 0) return
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C)
  if (skillId >= (m.u32((sgpt + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0)) return
  const pSkillsTxt =
    (m.u32((sgpt + DATATABLES_SKILLS_TXT_OFF_113C) >>> 0) + imul32(skillId, D2SkillsTxt_SIZE)) >>> 0
  if (pSkillsTxt === 0) return
  const pSkills = m.get(unitPtr, D2UnitStrc.pSkills)
  if (pSkills === 0) return
  const itemGuid = dwItemGuid >>> 0

  if ((bRemove | 0) !== 0) {
    const pRight = m.get(pSkills, D2SkillListStrc.pRightSkill)
    const rightSkillId = (m.get(m.get(pRight, D2SkillStrc.pSkillsTxt), D2SkillsTxt.wSkillId) << 16) >> 16
    const pLeft = m.get(pSkills, D2SkillListStrc.pLeftSkill)
    const leftSkillId = (m.get(m.get(pLeft, D2SkillStrc.pSkillsTxt), D2SkillsTxt.wSkillId) << 16) >> 16
    if (skillId === leftSkillId && m.get(pLeft, D2SkillStrc.nOwnerItemGuid) === itemGuid) {
      SKILLS_SetLeftSkill113c(m, unitPtr, 0, 0xffffffff)
    }
    if (skillId === rightSkillId && m.get(pRight, D2SkillStrc.nOwnerItemGuid) === itemGuid) {
      SKILLS_SetRightSkill113c(m, unitPtr, 0, 0xffffffff)
    }
    const pUsed = m.get(pSkills, D2SkillListStrc.pUsedSkill)
    if (pUsed !== 0) {
      const usedSkillId = (m.get(m.get(pUsed, D2SkillStrc.pSkillsTxt), D2SkillsTxt.wSkillId) << 16) >> 16
      if (skillId === usedSkillId) {
        m.set(pSkills, D2SkillListStrc.pUsedSkill, 0)
      }
    }
    let prev = 0
    let curr = m.get(pSkills, D2SkillListStrc.pFirstSkill)
    while (curr !== 0) {
      if (
        m.get(curr, D2SkillStrc.nOwnerItemGuid) === itemGuid &&
        m.get(curr, D2SkillStrc.pSkillsTxt) === pSkillsTxt
      ) {
        const next = m.get(curr, D2SkillStrc.pNextSkill)
        if (prev !== 0) {
          m.set(prev, D2SkillStrc.pNextSkill, next)
        } else {
          m.set(pSkills, D2SkillListStrc.pFirstSkill, next)
        }
        m.get(unitPtr, D2UnitStrc.pMemPool)
        ;(m as { free?: (p: number) => void }).free?.(curr)
        return
      }
      prev = curr
      curr = m.get(curr, D2SkillStrc.pNextSkill)
    }
    return
  }

  let last = 0
  let curr = m.get(pSkills, D2SkillListStrc.pFirstSkill)
  while (curr !== 0) {
    if (
      m.get(curr, D2SkillStrc.nOwnerItemGuid) === itemGuid &&
      m.get(curr, D2SkillStrc.pSkillsTxt) === pSkillsTxt
    ) {
      m.set(curr, D2SkillStrc.nSkillLevel, lvl >>> 0)
      m.set(curr, D2SkillStrc.dwFlags, 1)
      m.setU32((curr + 0x38) >>> 0, nCharges >>> 0)
      return
    }
    last = curr
    curr = m.get(curr, D2SkillStrc.pNextSkill)
  }

  m.get(pSkills, D2SkillListStrc.pMemPool)
  const pNew = m.alloc(0x40) >>> 0
  m.fill(pNew, 0x40, 0)
  m.set(pNew, D2SkillStrc.pSkillsTxt, pSkillsTxt)
  const nAnim = (m.u8((pSkillsTxt + 0x10) >>> 0) << 24) >> 24
  if (nAnim === 7 || nAnim === 8 || nAnim === 10 || nAnim === 11 || nAnim === 18) {
    m.set(pNew, D2SkillStrc.nSlotIndex, nAnim >>> 0)
  } else {
    m.set(pNew, D2SkillStrc.nSlotIndex, 0x0a)
  }
  m.set(pNew, D2SkillStrc.nSkillLevel, lvl >>> 0)
  m.set(pNew, D2SkillStrc.dwFlags, 1)
  m.setU32((pNew + 0x38) >>> 0, nCharges >>> 0)
  m.set(pNew, D2SkillStrc.nOwnerItemGuid, itemGuid)
  m.set(pNew, D2SkillStrc.pNextSkill, 0)
  if (last !== 0) {
    m.set(last, D2SkillStrc.pNextSkill, pNew)
  } else {
    m.set(pSkills, D2SkillListStrc.pFirstSkill, pNew)
  }
}

// ============================================================================
// K1r3 Iteration 9 Lane B — Batch I9B-B (skills.ts)
// ============================================================================

/** `sgptDataTables` `+0x150`: state-mask word array read by the corpse-selection predicates (`mov ecx, [eax+0x150]` at 0x6FD9FF9B). */
export const DATATABLES_CORPSE_STATE_MASK_OFF_113C = 0x150
/** `D2UnitStrc.dwUnitType` value tested by 0x6FD9FF80..0x6FDA0150 (`cmp eax, 1`): monsters. */
const UNIT_MONSTER_113C = 1
/** `D2UnitStrc.dwAnimMode` tested by 0x6FD9FF80..0x6FDA0150 (`cmp dword [esi+0x10], 0xc`): monster mode 12 (dead). */
const MONMODE_DEAD_113C = 0xc
/** MonStats2 `dwFlags` bit indices passed in `edx` to 0x6FD51470 by the corpse predicates (`mov edx, 7` / `mov edx, 0xc`). */
const MONSTATS2_FLAG_BIT7_113C = 7
const MONSTATS2_FLAG_BIT12_113C = 0xc

/**
 * Lazily-dereferenced view of the `ecx = pMaskWords` pointer handed to 0x6FD83C20: element `i` is read from
 * `pMaskWords + 4*i` only when the callee consumes it (the DLL passes a raw pointer, never a copy).
 */
function stateMaskWordsAt(m: Memory113c, pMaskWords: number): ArrayLike<number> {
  const view: { length: number; [i: number]: number } = { length: STATE_DWORDS_113C }
  for (let i = 0; i < STATE_DWORDS_113C; i++) {
    Object.defineProperty(view, i, { get: () => m.u32((pMaskWords + i * 4) >>> 0) })
  }
  return view
}

/**
 * Shared body of 0x6FD9E5E0 / 0x6FD9E630 / 0x6FD9E680 (`__stdcall(nLevel, nSkillId) -> int`, `ret 8`):
 * signed bounds check of `nSkillId` against `nSkillsTxtRecordCount (+0xBA0)`, `rec = pSkillsTxt (+0xB98) + id*0x23C`,
 * `rec == 0 -> 0`, then `nLevel > 0` (signed `jg`) else `0`; returns
 * `SKILLS_CalcDiminishingReturns113c(nLevel, rec[offLo], rec[offHi])` (`push hi; push lo; push nLevel`).
 */
function skillsEvalParamPairDimReturns(
  m: Memory113c,
  nLevel: number,
  nSkillId: number,
  fLo: FieldLayout113c,
  fHi: FieldLayout113c,
): number {
  const rec = getSkillsTxtRecord(m, nSkillId)
  if (rec === 0) return 0
  const lvl = nLevel | 0
  if (!(lvl > 0)) return 0
  const pHi = m.get(rec, fHi)
  const pLo = m.get(rec, fLo)
  return SKILLS_CalcDiminishingReturns113c(m, lvl, pLo, pHi)
}

/** `@va D2Common:0x6FD9E5E0` (`D2Common.#10832`, `__stdcall(nLevel, nSkillId) -> int`, `ret 8`): Param5/Param6 (`+0x158/+0x15C`). */
export function SKILLS_EvalParam56DimReturns113c(m: Memory113c, nLevel: number, nSkillId: number): number {
  return skillsEvalParamPairDimReturns(m, nLevel, nSkillId, D2SkillsTxt.dwParam5, D2SkillsTxt.dwParam6)
}

/** `@va D2Common:0x6FD9E630` (`D2Common.#10400`, `__stdcall(nLevel, nSkillId) -> int`, `ret 8`): Param3/Param4 (`+0x150/+0x154`). */
export function SKILLS_EvalParam34DimReturns113c(m: Memory113c, nLevel: number, nSkillId: number): number {
  return skillsEvalParamPairDimReturns(m, nLevel, nSkillId, D2SkillsTxt.dwParam3, D2SkillsTxt.dwParam4)
}

/** `@va D2Common:0x6FD9E680` (`D2Common.#10703`, `__stdcall(nLevel, nSkillId) -> int`, `ret 8`): Param1/Param2 (`+0x148/+0x14C`). */
export function SKILLS_EvalParam12DimReturns113c(m: Memory113c, nLevel: number, nSkillId: number): number {
  return skillsEvalParamPairDimReturns(m, nLevel, nSkillId, D2SkillsTxt.dwParam1, D2SkillsTxt.dwParam2)
}

/**
 * `@va D2Common:0x6FD9F070` (`D2Common.#10630`, `__fastcall(ecx = pUnit, edx = nSkillId) -> D2SkillStrc*`, `ret`):
 * `push esi; mov eax, ecx; mov esi, edx; call 0x6FD9E480; pop esi`.
 */
export function SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  return SKILLS_GetHighestLevelSkillFromUnitAndId113c(m, pUnit, nSkillId)
}

/**
 * Common prefix of the corpse predicates after the unit/mode gate: `STATES_CheckStateMaskOnUnit113c(pUnit,
 * sgptDataTables->[+0x150]) == 0` then `DATATBLS_CheckMonStats2FlagInline113c(pUnit->dwClassId, 7) != 0`.
 */
function corpseStateAndFlag7Pass(m: Memory113c, pUnit: number): boolean {
  const dt = m.u32(SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((dt + DATATABLES_CORPSE_STATE_MASK_OFF_113C) >>> 0)
  if (STATES_CheckStateMaskOnUnit113c(m, pUnit, stateMaskWordsAt(m, pMask)) !== 0) return false
  return DATATBLS_CheckMonStats2FlagInline113c(m, m.get(pUnit, D2UnitStrc.dwClassId), MONSTATS2_FLAG_BIT7_113C) !== 0
}

/**
 * Body of the byte-identical 0x6FD9FF80 / 0x6FD9FFD0 / 0x6FDA0090 (`__stdcall(pUnit) -> BOOL`, `ret 4`): returns `1`
 * only if `pUnit != 0`, `pUnit->dwUnitType == 1`, `pUnit->dwAnimMode (+0x10) == 0xC`, the `[sgpt+0x150]` state mask
 * misses the unit, and MonStats2 flag bit 7 is set for `pUnit->dwClassId`; else `0`.
 */
function skillsIsSelectableCorpse(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  if (m.get(u, D2UnitStrc.dwUnitType) !== UNIT_MONSTER_113C) return 0
  if (m.get(u, D2UnitStrc.dwAnimMode) !== MONMODE_DEAD_113C) return 0
  return corpseStateAndFlag7Pass(m, u) ? 1 : 0
}

/** `@va D2Common:0x6FD9FF80` (`D2Common.#10501`, `__stdcall(pUnit) -> BOOL`, `ret 4`). */
export function SKILLS_IsSelectableCorpse10501_113c(m: Memory113c, pUnit: number): number {
  return skillsIsSelectableCorpse(m, pUnit)
}

/** `@va D2Common:0x6FD9FFD0` (`D2Common.#11157`, `__stdcall(pUnit) -> BOOL`, `ret 4`; byte-identical to 0x6FD9FF80). */
export function SKILLS_IsSelectableCorpse11157_113c(m: Memory113c, pUnit: number): number {
  return skillsIsSelectableCorpse(m, pUnit)
}

/** `@va D2Common:0x6FDA0090` (`D2Common.#10678`, `__stdcall(pUnit) -> BOOL`, `ret 4`; byte-identical to 0x6FD9FF80). */
export function SKILLS_IsSelectableCorpse10678_113c(m: Memory113c, pUnit: number): number {
  return skillsIsSelectableCorpse(m, pUnit)
}

/**
 * `@va D2Common:0x6FDA00E0` (`D2Common.#10096`, `__stdcall(pUnit) -> BOOL`, `ret 4`): the 0x6FD9FF80 predicate plus
 * `DATATBLS_CheckMonStats2FlagInline113c(classId, 0xC) != 0`. The `cmp edi, edi; jne` at 0x6FDA0122 compares a
 * register with itself and never branches, so it has no TS counterpart.
 */
export function SKILLS_IsSelectableCorpseWithFlag12_113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  if (m.get(u, D2UnitStrc.dwUnitType) !== UNIT_MONSTER_113C) return 0
  if (m.get(u, D2UnitStrc.dwAnimMode) !== MONMODE_DEAD_113C) return 0
  if (!corpseStateAndFlag7Pass(m, u)) return 0
  const classId = m.get(u, D2UnitStrc.dwClassId)
  return DATATBLS_CheckMonStats2FlagInline113c(m, classId, MONSTATS2_FLAG_BIT12_113C) !== 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FDA0150` (`D2Common.#10444`, `__stdcall(pUnit, bAllowMode0) -> BOOL`, `ret 8`).
 *
 * - `pUnit == 0` or `dwUnitType != 1` -> `0`.
 * - Mode gate: `dwAnimMode == 0xC` passes; otherwise passes only if `bAllowMode0 != 0 && dwAnimMode == 0`.
 * - State mask / MonStats2 flag 7 as 0x6FD9FF80 (`sgptDataTables` cached in `edi` at 0x6FDA0173).
 * - `id = dwClassId`; `rec = (id >= 0 && id < nMonStatsTxtRecordCount (+0xA80)) ? pMonStatsTxt (+0xA78) + id*0x1A8 : 0`
 *   (0x6FDA01CC `xor esi, esi` on the out-of-range path, no NULL test); returns `rec->wVelocity (+0x32) != 0`.
 */
export function SKILLS_IsSelectableCorpseWithVelocity113c(
  m: Memory113c,
  pUnit: number,
  bAllowMode0: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  if (m.get(u, D2UnitStrc.dwUnitType) !== UNIT_MONSTER_113C) return 0
  const mode = m.get(u, D2UnitStrc.dwAnimMode)
  if (mode !== MONMODE_DEAD_113C) {
    if ((bAllowMode0 >>> 0) === 0) return 0
    if (mode !== 0) return 0
  }
  const dt = m.u32(SGPT_DATATABLES_VA_113C)
  const pMask = m.u32((dt + DATATABLES_CORPSE_STATE_MASK_OFF_113C) >>> 0)
  if (STATES_CheckStateMaskOnUnit113c(m, u, stateMaskWordsAt(m, pMask)) !== 0) return 0
  const id = m.get(u, D2UnitStrc.dwClassId) | 0
  if (DATATBLS_CheckMonStats2FlagInline113c(m, id >>> 0, MONSTATS2_FLAG_BIT7_113C) === 0) return 0
  let rec = 0
  if (id >= 0 && id < (m.u32((dt + DATATABLES_MONSTATS_COUNT_OFF_113C) >>> 0) | 0)) {
    rec = (m.u32((dt + DATATABLES_MONSTATS_TXT_OFF_113C) >>> 0) + imul32(id, D2MonStatsTxt_SIZE)) >>> 0
  }
  return m.get(rec, D2MonStatsTxt.wVelocity) !== 0 ? 1 : 0
}

// ============================================================================
// K1r7 Iteration 10 Lane B — Sub-Batches I10B-1 & I10B-2 (skills.ts)
// ============================================================================

const LOS_SCRATCH_PT1_VA_113C = 0x6fdf1f00
const LOS_SCRATCH_PT2_VA_113C = 0x6fdf1f08
const DATATABLES_ITEMTYPES_TXT_OFF_113C = 0xbf8
const ITEMTYPES_TXT_STRIDE_113C = 0xe4

function isWeaponActiveEligible113c(m: Memory113c, pItem: number): boolean {
  const item = pItem >>> 0
  if (item === 0) return false
  if (m.u32(item) === 4) {
    const pData = m.u32((item + 0x14) >>> 0) >>> 0
    if (pData !== 0) {
      const flags = m.u32((pData + 0x18) >>> 0) >>> 0
      if ((flags & 0x4000) !== 0 || (flags & 0x100) !== 0) return false
    }
  }
  return ITEMS_CheckItemTypeIdMem113c(m, item, 0x2d) !== 0
}

/**
 * 4-output `Memory113c` port of `D2Common:0x6FD70700` (`#10101` `INVENTORY_GetActiveWeapon`)
 * returning `{ found, pItem, nBodyLoc, bIsComposit }` for `0x6FDA0930` (`B1-15`).
 */
export function inventoryGetActiveWeaponFullMem113c(
  m: Memory113c,
  pInventory: number,
): { found: number; pItem: number; nBodyLoc: number; bIsComposit: number } {
  const inv = pInventory >>> 0
  if (inv === 0) return { found: 0, pItem: 0, nBodyLoc: 0, bIsComposit: 0 }
  const pComp = INVENTORY_GetCompositWeaponMem113c(m, inv) >>> 0
  if (m.u32(inv) === INV_SIGNATURE_113C) {
    const pGridA = INVENTORY_GetOrInitGridMem113c(m, inv, 0, BODY_GRID_DEF_VA_113C) >>> 0
    if (pGridA !== 0) {
      const pRight = m.u32((m.u32((pGridA + 0x0c) >>> 0) + 0x10) >>> 0) >>> 0
      if (isWeaponActiveEligible113c(m, pRight)) {
        return { found: 1, pItem: pRight, nBodyLoc: 4, bIsComposit: pRight === pComp ? 1 : 0 }
      }
    }
  }
  let pLeft = 0
  if (m.u32(inv) === INV_SIGNATURE_113C) {
    const pGridB = INVENTORY_GetOrInitGridMem113c(m, inv, 0, BODY_GRID_DEF_VA_113C) >>> 0
    if (pGridB !== 0) {
      pLeft = m.u32((m.u32((pGridB + 0x0c) >>> 0) + 0x14) >>> 0) >>> 0
    }
  }
  if (isWeaponActiveEligible113c(m, pLeft)) {
    return { found: 1, pItem: pLeft, nBodyLoc: 5, bIsComposit: pLeft === pComp ? 1 : 0 }
  }
  return { found: 0, pItem: 0, nBodyLoc: 0, bIsComposit: 0 }
}

/**
 * `@va D2Common:0x6FD81200` (`D2Common.#11085` `SKILLS_CanMonsterReviveInMode2_113c`,
 * fastcall `ecx = nMonsterId`, `ret` -> `BOOL`).
 */
export function SKILLS_CanMonsterReviveInMode2_113c(m: Memory113c, nMonsterId: number): number {
  const id = nMonsterId | 0
  if (id < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (id >= (m.u32((sgpt + DATATABLES_MONSTATS_COUNT_OFF_113C) >>> 0) | 0)) return 0
  const pMonTxt = (m.u32((sgpt + DATATABLES_MONSTATS_TXT_OFF_113C) >>> 0) + imul32(id, D2MonStatsTxt_SIZE)) >>> 0
  if (DATATBLS_CheckMonStats2ModeFlagInline113c(m, id, 2) === 0) return 0
  const pMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
  if ((m.u8((pMonTxt + 0x0c) >>> 0) & m.u8((pMasks + 0x18) >>> 0)) !== 0) return 0
  return (m.u8((pMonTxt + 0x0e) >>> 0) & m.u8(pMasks)) !== 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD9E750` (`D2Common.#10864` `SKILLS_CheckLineOfSight113c`,
 * stdcall `x1, y1, x2, y2, pRoom, dwMask`, `ret 0x18` -> `BOOL`).
 */
export function SKILLS_CheckLineOfSight113c(
  m: Memory113c,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pRoom: number,
  dwMask: number,
): number {
  const s0 = m.u32(LOS_SCRATCH_PT1_VA_113C)
  const s1 = m.u32((LOS_SCRATCH_PT1_VA_113C + 4) >>> 0)
  const s2 = m.u32(LOS_SCRATCH_PT2_VA_113C)
  const s3 = m.u32((LOS_SCRATCH_PT2_VA_113C + 4) >>> 0)
  m.setU32(LOS_SCRATCH_PT1_VA_113C, x1 >>> 0)
  m.setU32((LOS_SCRATCH_PT1_VA_113C + 4) >>> 0, y1 >>> 0)
  m.setU32(LOS_SCRATCH_PT2_VA_113C, x2 >>> 0)
  m.setU32((LOS_SCRATCH_PT2_VA_113C + 4) >>> 0, y2 >>> 0)
  const hit = COLLISION_RayTrace113c(
    m,
    pRoom >>> 0,
    LOS_SCRATCH_PT1_VA_113C,
    LOS_SCRATCH_PT2_VA_113C,
    dwMask >>> 0,
  )
  m.setU32(LOS_SCRATCH_PT1_VA_113C, s0)
  m.setU32((LOS_SCRATCH_PT1_VA_113C + 4) >>> 0, s1)
  m.setU32(LOS_SCRATCH_PT2_VA_113C, s2)
  m.setU32((LOS_SCRATCH_PT2_VA_113C + 4) >>> 0, s3)
  return hit === 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD9EBA0` (`D2Common.#10497` `SKILLS_GetShrineSkillBonus113c`,
 * stdcall `pUnit`, `ret 4` -> `0` or `2`).
 */
export function SKILLS_GetShrineSkillBonus113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = m.u32(u) | 0
  if (!((uType >= 0 && uType <= 1) || uType === 3)) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if ((m.u32((sgpt + DATATABLES_STATES_COUNT_OFF_113C) >>> 0) | 0) <= 0x86) return 0
  return STATES_CheckStateMaskOnUnitFast113c(m, u, 0x86) !== 0 ? 2 : 0
}

/**
 * `@va D2Common:0x6FD9EC50` (`D2Common.#10030` `SKILLS_GetUnitSkillRequiredOrMonLevel113c`,
 * fastcall `ecx = pUnit, edx = pSkill`, `ret` -> `i32`).
 */
export function SKILLS_GetUnitSkillRequiredOrMonLevel113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
): number {
  const u = pUnit >>> 0
  const sk = pSkill >>> 0
  if (u === 0 || sk === 0) return 0
  const uType = m.u32(u) >>> 0
  const clsId = m.u32((u + 4) >>> 0) >>> 0
  const pSkTxt = m.u32(sk) >>> 0
  if (uType === 0) {
    return m.u8((pSkTxt + 0x13) >>> 0)
  }
  const skId = i16(m.u16(pSkTxt))
  if (skId === 0xc7) return 0
  const pMonTxt = DATATBLS_GetMonStatsTxtRecordInline113c(m, clsId) >>> 0
  for (let i = 0; i < 8; i++) {
    if (i16(m.u16((pMonTxt + 0x170 + i * 2) >>> 0)) === skId) {
      return i16(m.u16((pMonTxt + 0x188 + i * 2) >>> 0))
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD9F120` (internal `SKILLS_IsUnitPosNotInTown113c`,
 * custom `eax = pUnit, edi = nX, esi = nY`, `ret` -> `BOOL`).
 */
export function SKILLS_IsUnitPosNotInTown113c(
  m: Memory113c,
  pUnit: number,
  nX: number,
  nY: number,
): number {
  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (pRoom === 0) return 0
  const pTargetRoom = DUNGEON_GetRoomAtPosition113c(m, pRoom, nX | 0, nY | 0) >>> 0
  if (pTargetRoom === 0) return 0
  const pRoomEx = m.u32((pTargetRoom + 0x10) >>> 0) >>> 0
  const pLevel = m.u32((pRoomEx + 0x58) >>> 0) >>> 0
  const nLevelId = m.u32((pLevel + 0x1d0) >>> 0) | 0
  return DRLG_IsTownLevel113c(nLevelId) === 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD9F590` (internal `SKILLS_CheckSkillStateRestriction113c`,
 * custom `eax = pSkill, ebx = pUnit`, `ret` -> `BOOL`).
 */
export function SKILLS_CheckSkillStateRestriction113c(
  m: Memory113c,
  pSkill: number,
  pUnit: number,
): number {
  const u = pUnit >>> 0
  const sk = pSkill >>> 0
  if (u === 0 || sk === 0) return 0
  const pSkTxt = m.u32(sk) >>> 0
  if (pSkTxt === 0) return 0
  const restrict = m.u8((pSkTxt + 0x228) >>> 0)
  if (restrict === 0) {
    return STATES_CheckUnitAnyActiveStateMask113c(m, u) === 0 ? 1 : 0
  }
  if (restrict === 2) {
    if (STATES_CheckUnitAnyActiveStateMask113c(m, u) === 0) return 0
    for (let i = 0; i < 3; i++) {
      const st = i16(m.u16((pSkTxt + 0x22a + i * 2) >>> 0))
      if (st < 0) return 0
      if (STATES_CheckState113c(m, u, st) !== 0) return 1
    }
    return 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD9F610` (`D2Common.#10029` `SKILLS_AssignItemChargedSkillStdcall113c`,
 * stdcall `pUnit, dwItemGuid, nSkillId, nLevel, nCharges, bRemove`, `ret 0x18`, void).
 */
export function SKILLS_AssignItemChargedSkillStdcall113c(
  m: Memory113c,
  pUnit: number,
  dwItemGuid: number,
  nSkillId: number,
  nLevel: number,
  nCharges: number,
  bRemove: number,
): void {
  SKILLS_AddOrRemoveItemChargedSkill113c(m, nSkillId, pUnit, dwItemGuid, nLevel, nCharges, bRemove)
}

/**
 * `@va D2Common:0x6FD9FDC0` (internal `SKILLS_CheckSkillStartMana113c`,
 * stdcall `pUnit, pSkill`, `ret 8` -> `BOOL`).
 */
export function SKILLS_CheckSkillStartMana113c(m: Memory113c, pUnit: number, pSkill: number): number {
  const u = pUnit >>> 0
  if (u === 0 || m.u32(u) !== 0) return 1
  const pSkTxt = m.u32(pSkill >>> 0) >>> 0
  const wStartMana = i16(m.u16((pSkTxt + 0x184) >>> 0))
  if (wStartMana <= 0) return 1
  let curMana = 0
  const pStatList = m.u32((u + 0x5c) >>> 0) >>> 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (pStatList !== 0 && (m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0) > 8) {
    const pIsc = (m.u32((sgpt + DATATABLES_ISC_TXT_OFF_113C) >>> 0) + 0xa20) >>> 0
    curMana = statListGetTotalStatWithMinMem113c(m, pStatList, 0x00080000, pIsc) | 0
  }
  if (curMana >= (wStartMana << 8)) return 1
  const sgpt2 = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (
    (m.u32((sgpt2 + DATATABLES_STATES_COUNT_OFF_113C) >>> 0) | 0) > 0x0c &&
    STATES_CheckStateMaskOnUnitFast113c(m, u, 0x0c) !== 0
  ) {
    return 1
  }
  return 0
}

/**
 * `@va D2Common:0x6FDA0610` (internal `SKILLS_CheckWeaponPairMatchesSkill113c`,
 * custom `eax = nSlotIdx`, stack `[esp+4] = pPrimaryItem, [esp+8] = pSecondaryItem, [esp+0xC] = pSkillsTxt`,
 * `ret 0xC` -> `BOOL`).
 */
export function SKILLS_CheckWeaponPairMatchesSkill113c(
  m: Memory113c,
  nSlotIdx: number,
  pPrimaryItem: number,
  pSecondaryItem: number,
  pSkillsTxt: number,
): number {
  const idx = nSlotIdx | 0
  const prim = pPrimaryItem >>> 0
  const sec = pSecondaryItem >>> 0
  const skTxt = pSkillsTxt >>> 0
  if (prim === 0) {
    if (
      i16(m.u16((skTxt + 0x24 + idx * 4) >>> 0)) <= 0 &&
      i16(m.u16((skTxt + 0x18 + idx * 6) >>> 0)) <= 0
    ) {
      return 1
    }
    const itypeA1 = i16(m.u16((skTxt + 0x18) >>> 0))
    const itypeB1 = i16(m.u16((skTxt + 0x1e) >>> 0))
    return (itypeA1 === 0x2d || itypeA1 === 0x2e || itypeA1 === 0x43) &&
      itypeB1 <= 0 &&
      ITEMS_CheckItemTypeIdMem113c(m, sec, 0x2d) === 0
      ? 1
      : 0
  }
  for (let k = 0; k < 2; k++) {
    const et = i16(m.u16((skTxt + 0x24 + idx * 4 + k * 2) >>> 0))
    if (et <= 0) break
    if (ITEMS_CheckItemTypeIdMem113c(m, prim, et) !== 0) return 0
  }
  let matched = false
  for (let k = 0; k < 3; k++) {
    const it = i16(m.u16((skTxt + 0x18 + idx * 6 + k * 2) >>> 0))
    if (it <= 0) return k === 0 ? 1 : 0
    if (ITEMS_CheckItemTypeIdMem113c(m, prim, it) !== 0) {
      matched = true
      break
    }
  }
  if (!matched) return 0
  const pData = m.u32((prim + 0x14) >>> 0) >>> 0
  if (pData !== 0) {
    const flags = m.u32((pData + 0x18) >>> 0) >>> 0
    if ((flags & 0x4000) !== 0 || (flags & 0x100) !== 0) {
      return m.u16(skTxt) === 0 ? 1 : 0
    }
  }
  const wType1 = ITEMS_IsTome113c(m, m.u32((prim + 4) >>> 0)) | 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (wType1 < 0 || wType1 >= (m.u32((sgpt + DATATABLES_ITEMTYPES_COUNT_OFF_113C) >>> 0) | 0)) {
    return 1
  }
  const pTypeRec =
    (m.u32((sgpt + DATATABLES_ITEMTYPES_TXT_OFF_113C) >>> 0) +
      imul32(wType1, ITEMTYPES_TXT_STRIDE_113C)) >>>
    0
  if (i16(m.u16((pTypeRec + 0x0c) >>> 0)) === 0) return 1
  const pMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
  if ((m.u8((skTxt + 0x06) >>> 0) & m.u8(pMasks)) !== 0) return 1
  if (m.u16(skTxt) === 0) {
    const pStatList = m.u32((prim + 0x5c) >>> 0) >>> 0
    if (pStatList !== 0 && (m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0) > 0x9d) {
      const pIsc = (m.u32((sgpt + DATATABLES_ISC_TXT_OFF_113C) >>> 0) + 0xc6b4) >>> 0
      if (statListGetTotalStatWithMinMem113c(m, pStatList, 0x009d0000, pIsc) !== 0) {
        return 1
      }
    }
  }
  if (sec === 0) return 0
  const quivType = ITEMS_GetItemTypeQuiverFromItem113c(m, prim)
  if (ITEMS_CheckItemTypeIdMem113c(m, sec, quivType) === 0) return 0
  if (m.u16(skTxt) === 0 && statListGetUnitStatMem113c(m, sec, 0x9d, 0) !== 0) return 1
  if (ITEMS_GetTotalMaxStack113c(m, sec) === 0) return 1
  return (statListGetUnitStatMem113c(m, sec, 0x46, 0) | 0) > 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FDA0930` (internal `SKILLS_CheckSkillWeaponAndQuantity113c`,
 * custom `ecx = pSkill`, stack `[esp+4] = pUnit`, `ret 4` -> `BOOL`).
 */
export function SKILLS_CheckSkillWeaponAndQuantity113c(
  m: Memory113c,
  pSkill: number,
  pUnit: number,
): number {
  const u = pUnit >>> 0
  const sk = pSkill >>> 0
  if (u === 0 || sk === 0) return 0
  const pSkTxt = m.u32(sk) >>> 0
  const pInv = m.u32((u + 0x60) >>> 0) >>> 0
  if (pSkTxt !== 0) {
    const pMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
    if ((m.u8((pSkTxt + 0x08) >>> 0) & m.u8((pMasks + 0x10) >>> 0)) !== 0) {
      if (pInv === 0) return 0
      return (m.u32((sk + 0x30) >>> 0) | 0) > 0 ? 1 : 0
    }
  }
  const skId = i16(m.u16(pSkTxt))
  let pWeap = 0
  if (skId === 2) {
    if (pInv === 0) return 0
    const canDW = unitsCanDualWieldMem113c(m, u)
    const act = inventoryGetActiveWeaponFullMem113c(m, pInv)
    if (act.found === 0) return 0
    if (canDW !== 0) {
      pWeap =
        act.bIsComposit !== 0 ? act.pItem : SKILLS_GetWeaponFromArmSlot113c(m, act.nBodyLoc, pInv)
      if (pWeap === 0) return 0
    } else {
      if (act.bIsComposit === 0) return 0
      pWeap = act.pItem
    }
  } else if (skId === 4) {
    if (pInv === 0) return 0
    const act = inventoryGetActiveWeaponFullMem113c(m, pInv)
    if (act.found === 0) return 0
    pWeap =
      act.bIsComposit === 0 ? act.pItem : SKILLS_GetWeaponFromArmSlot113c(m, act.nBodyLoc, pInv)
    if (pWeap === 0) return 0
  } else if (skId === 5) {
    if (pInv === 0 || unitsCanDualWieldMem113c(m, u) === 0) return 0
    const act = inventoryGetActiveWeaponFullMem113c(m, pInv)
    if (act.found === 0) return 0
    pWeap =
      act.bIsComposit !== 0 ? SKILLS_GetWeaponFromArmSlot113c(m, act.nBodyLoc, pInv) : act.pItem
    if (pWeap === 0) return 0
    return ITEMS_CheckItemTypeIdMem113c(m, pWeap, 0x2d)
  } else {
    return 1
  }
  const isThrow = checkIfThrowItemMem113c(m, pWeap)
  if (isThrow !== 0) return isThrow
  return statListGetUnitStatMem113c(m, pWeap, 0x7d, 0)
}

/**
 * `@va D2Common:0x6FDA0C30` (internal `SKILLS_EvalUnitStatFormulaHelper113c`,
 * custom `ecx = nStatId, edx = nMode`, stack `[esp+4] = _unused, [esp+8] = ppUnit`, `ret 8` -> `i32`).
 */
export function SKILLS_EvalUnitStatFormulaHelper113c(
  m: Memory113c,
  nStatId: number,
  nMode: number,
  _unused: number,
  ppUnit: number,
): number {
  const pp = ppUnit >>> 0
  if (pp === 0) return 0
  const pUnit = m.u32(pp) >>> 0
  if (pUnit === 0) return 0
  const statId = nStatId | 0
  if (statId < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (statId >= (m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0)) return 0
  if (statId === 0x13) return UNITS_GetPlayerBaseToHit113c(m, pUnit) | 0
  if ((nMode | 0) === 1) return statListGetUnitBaseStatMem113c(m, pUnit, statId, 0) | 0
  return statListGetUnitStatMem113c(m, pUnit, statId, 0) | 0
}

/**
 * `@va D2Common:0x6FDA0CB0` (internal `SKILLS_EvalUnitRandFormulaHelper113c`,
 * custom `ecx = nMin, edx = nMax`, stack `[esp+4] = _unused, [esp+8] = ppUnit`, `ret 8` -> `i32`).
 */
export function SKILLS_EvalUnitRandFormulaHelper113c(
  m: Memory113c,
  nMin: number,
  nMax: number,
  _unused: number,
  ppUnit: number,
): number {
  const pp = ppUnit >>> 0
  if (pp === 0) return 0
  const pUnit = m.u32(pp) >>> 0
  return SEED_RollLimitedRandomNumberInline113c(m, (pUnit + 0x20) >>> 0, nMin | 0, nMax | 0) | 0
}

/**
 * `@va D2Common:0x6FD9FCB0` (internal `SKILLS_GetSkillBonusLevel113c`,
 * custom `eax = pSkill, esi = pUnit`, `ret` -> `i32`).
 */
export function SKILLS_GetSkillBonusLevel113c(m: Memory113c, pSkill: number, pUnit: number): number {
  const sk = pSkill >>> 0
  if (sk === 0) return 0
  const pSkTxt = m.u32(sk) >>> 0
  if (pSkTxt === 0) return 0
  const skId = i16(m.u16(pSkTxt))
  if (skId < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (skId >= (m.u32((sgpt + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0)) return 0
  const u = pUnit >>> 0
  let total =
    (statListGetUnitStatMem113c(m, u, 0x7f, 0) +
      SKILLS_GetShrineSkillBonus113c(m, u) +
      (m.u32((sk + 0x2c) >>> 0) | 0)) |
    0
  if (u !== 0 && m.u32(u) === 0) {
    const skCharClass = (m.u8((pSkTxt + 0x0c) >>> 0) << 24) >> 24
    const unitClass = m.u32((u + 4) >>> 0) | 0
    if (skCharClass === unitClass) {
      total = (total + statListGetUnitStatMem113c(m, u, 0x53, unitClass)) | 0
      const pDesc = DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m, skId) >>> 0
      const skillPage = (m.u8((pDesc + 2) >>> 0) << 24) >> 24
      if (skillPage !== 0) {
        const tabLayer = (skillPage + unitClass * 8 - 1) | 0
        total = (total + statListGetUnitStatMem113c(m, u, 0xbc, tabLayer)) | 0
      }
      let oskill = statListGetUnitStatMem113c(m, u, 0x61, skId) | 0
      if (oskill > 3) oskill = 3
      total = (total + oskill) | 0
    } else {
      total = (total + statListGetUnitStatMem113c(m, u, 0x61, skId)) | 0
    }
  } else {
    const baseLvl = m.u32((sk + 0x28) >>> 0) | 0
    let oskill = statListGetUnitStatMem113c(m, u, 0x61, skId) | 0
    if (baseLvl > 0 && oskill > 3) {
      oskill = 3
    }
    total = (total + oskill) | 0
  }
  const eType = m.u8((pSkTxt + 0x1dc) >>> 0)
  if (eType > 0) {
    total = (total + statListGetUnitStatMem113c(m, u, 0x7e, eType)) | 0
  }
  return (total + statListGetUnitStatMem113c(m, u, 0x6b, skId)) | 0
}

/**
 * `@va D2Common:0x6FDA0560` (`D2Common.#11146` `SKILLS_GetUnitSkillBonusBySkillId113c`,
 * stdcall `pUnit, nSkillId`, `ret 8` -> `i32`).
 */
export function SKILLS_GetUnitSkillBonusBySkillId113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pSkillList = m.u32((u + 0xa8) >>> 0) >>> 0
  if (pSkillList === 0) return 0
  const targetId = nSkillId | 0
  let pSkill = m.u32((pSkillList + 4) >>> 0) >>> 0
  while (pSkill !== 0) {
    const skId = i16(m.u16(m.u32(pSkill) >>> 0))
    if (skId === targetId && m.u32((pSkill + 0x34) >>> 0) === 0xffffffff) {
      return SKILLS_GetSkillBonusLevel113c(m, pSkill, u)
    }
    pSkill = m.u32((pSkill + 4) >>> 0) >>> 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FDA05C0` (`D2Common.#10306` `SKILLS_EvaluateSkillLevel113c`,
 * stdcall `pUnit, pSkill, bBonus`, `ret 0xC` -> `i32`).
 */
export function SKILLS_EvaluateSkillLevel113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
  bBonus: number,
): number {
  const u = pUnit >>> 0
  const sk = pSkill >>> 0
  if (u === 0 || sk === 0) return 0
  let lvl = m.u32((sk + 0x28) >>> 0) | 0
  if ((bBonus | 0) !== 0 && m.u32((sk + 0x34) >>> 0) === 0xffffffff) {
    lvl = (lvl + SKILLS_GetSkillBonusLevel113c(m, sk, u)) | 0
  }
  const maxLvl = m.u32(m.u32(SGPT_EXPERIENCE_TXT_PTR_VA_113C) >>> 0) | 0
  return Math.min(Math.max(lvl, 0), maxLvl)
}

/**
 * `@va D2Common:0x6FDA0AF0` (internal `SKILLS_CheckSkillManaOrCharges113c`,
 * custom `eax = pSkill, ecx = pUnit`, `ret` -> `BOOL`).
 */
export function SKILLS_CheckSkillManaOrCharges113c(
  m: Memory113c,
  pSkill: number,
  pUnit: number,
): number {
  const sk = pSkill >>> 0
  if (sk === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x638)
  }
  if (m.u32((sk + 0x34) >>> 0) !== 0xffffffff) {
    return (m.u32((sk + 0x38) >>> 0) | 0) > 0 ? 1 : 0
  }
  const pSkTxt = m.u32(sk) >>> 0
  const u = pUnit >>> 0
  let effLvl = 0
  if (u !== 0) {
    const lvl = (m.u32((sk + 0x28) >>> 0) + SKILLS_GetSkillBonusLevel113c(m, sk, u)) | 0
    const maxLvl = m.u32(m.u32(SGPT_EXPERIENCE_TXT_PTR_VA_113C) >>> 0) | 0
    effLvl = Math.min(Math.max(lvl, 0), maxLvl)
  }
  effLvl = (effLvl - 1) | 0
  if (pSkTxt === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x6ef)
  }
  effLvl = Math.max(effLvl, 0)
  const wLvlMana = i16(m.u16((pSkTxt + 0x18c) >>> 0))
  const wMana = i16(m.u16((pSkTxt + 0x18a) >>> 0))
  const shift = m.u8((pSkTxt + 0x188) >>> 0) & 31
  const manaCost = ((imul32(wLvlMana, effLvl) + wMana) << shift) | 0
  if (u !== 0) {
    const uType = m.u32(u) | 0
    if (
      ((uType >= 0 && uType <= 1) || uType === 3) &&
      (m.u32((m.u32(SGPT_DATATABLES_VA_113C) + DATATABLES_STATES_COUNT_OFF_113C) >>> 0) | 0) >
        0x72 &&
      STATES_CheckStateMaskOnUnitFast113c(m, u, 0x72) !== 0
    ) {
      return (statListGetUnitStatMem113c(m, u, 6, 0) | 0) >= manaCost ? 1 : 0
    }
  }
  if (
    i16(m.u16((pSkTxt + 0x2e) >>> 0)) === 0x74 &&
    u !== 0 &&
    ((m.u32((u + 0xc8) >>> 0) >>> 3) & 1) !== 0
  ) {
    return 1
  }
  return (statListGetUnitStatMem113c(m, u, 8, 0) | 0) >= manaCost ? 1 : 0
}

/**
 * `@va D2Common:0x6FDA0EA0` (`D2Common.#11008` `SKILLS_GetSkillLevelByIdWithBonus113c`,
 * stdcall `pUnit, nSkillId`, `ret 8` -> `i32`).
 */
export function SKILLS_GetSkillLevelByIdWithBonus113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndId113c(m, u, nSkillId | 0) >>> 0
  if (pSkill === 0) return 0
  let lvl = m.u32((pSkill + 0x28) >>> 0) | 0
  if (m.u32((pSkill + 0x34) >>> 0) === 0xffffffff) {
    lvl = (lvl + SKILLS_GetSkillBonusLevel113c(m, pSkill, u)) | 0
  }
  const maxLvl = m.u32(m.u32(SGPT_EXPERIENCE_TXT_PTR_VA_113C) >>> 0) | 0
  return Math.min(Math.max(lvl, 0), maxLvl)
}

/**
 * `@va D2Common:0x6FDA0F00` (internal `SKILLS_CheckUnitEquippedWeaponsMatchSkill113c`,
 * custom `eax = pSkill`, stack `[esp+4] = pUnit`, `ret 4` -> `BOOL`).
 */
export function SKILLS_CheckUnitEquippedWeaponsMatchSkill113c(
  m: Memory113c,
  pSkill: number,
  pUnit: number,
): number {
  const sk = pSkill >>> 0
  if (sk === 0) return 0
  const pSkTxt = m.u32(sk) >>> 0
  if (pSkTxt === 0) return 0
  if (i16(m.u16((pSkTxt + 0x24) >>> 0)) <= 0 && i16(m.u16((pSkTxt + 0x18) >>> 0)) <= 0) {
    return 1
  }
  const pInv = m.u32(((pUnit >>> 0) + 0x60) >>> 0) >>> 0
  if (pInv === 0) return 0
  let pRight = 0
  let pLeft = 0
  if (m.u32(pInv) === INV_SIGNATURE_113C) {
    const pGridA = INVENTORY_GetOrInitGridMem113c(m, pInv, 0, BODY_GRID_DEF_VA_113C) >>> 0
    if (pGridA !== 0) {
      pRight = m.u32((m.u32((pGridA + 0x0c) >>> 0) + 0x10) >>> 0) >>> 0
    }
    const pGridB = INVENTORY_GetOrInitGridMem113c(m, pInv, 0, BODY_GRID_DEF_VA_113C) >>> 0
    if (pGridB !== 0) {
      pLeft = m.u32((m.u32((pGridB + 0x0c) >>> 0) + 0x14) >>> 0) >>> 0
    }
  }
  const skId = m.u16(pSkTxt)
  if (skId === 4 || skId === 5) {
    const pComp = INVENTORY_GetCompositWeaponMem113c(m, pInv) >>> 0
    if (pComp === pRight) {
      pRight = 0
    } else if (pComp === pLeft) {
      pLeft = 0
    }
  }
  if (SKILLS_CheckWeaponPairMatchesSkill113c(m, 0, pRight, pLeft, pSkTxt) !== 0) {
    return SKILLS_CheckWeaponPairMatchesSkill113c(m, 1, pLeft, pRight, pSkTxt)
  }
  if (SKILLS_CheckWeaponPairMatchesSkill113c(m, 1, pRight, pLeft, pSkTxt) !== 0) {
    return SKILLS_CheckWeaponPairMatchesSkill113c(m, 0, pLeft, pRight, pSkTxt)
  }
  return 0
}

// ============================================================================
// Iteration 11 Lane B — I11B-1 (B1-06..B1-15) & I11B-2 (B2-01, B2-05..B2-07, B2-11, B2-12)
// ============================================================================

/** `.rdata` IAT slot for `Fog.dll!gdwInvBitMasks` (`uint32[32]`) at `0x6FDD9078`. */
const GDW_INV_BITMASKS_IAT_VA_113C = 0x6fdd9078

function removeAndFreeSubListIfNonExtended113c(m: Memory113c, pSub: number): void {
  const esi = pSub >>> 0
  if ((m.u32((esi + 0x10) >>> 0) | 0) >= 0) {
    STATLIST_FreeStatListIfNonExtended113c(m, esi)
  } else {
    STATLIST_RemoveSubList113c(m, esi)
  }
}

function statesToggleStateMem113c(m: Memory113c, nStateId: number, pUnit: number, bSet: number): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const edi = m.u32((u + 0x5c) >>> 0) >>> 0
  if (edi === 0 || (m.u32((edi + 0x10) >>> 0) | 0) >= 0) return
  const ebx = nStateId | 0
  const ecx = (ebx & 0x1f) << 2
  const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
  const edx = m.u32((pBitMasks + ecx) >>> 0)
  const pFlags = m.u32((edi + 0x58) >>> 0) >>> 0
  const esi = ebx >> 5
  const wordAddr = (pFlags + esi * 4) >>> 0
  const curWord = m.u32(wordAddr)
  const wasSet = (curWord & edx) >>> 0
  const setFlag = (bSet | 0) !== 0
  if (setFlag) {
    m.setU32(wordAddr, (curWord | edx) >>> 0)
    if (wasSet !== 0) return
  } else {
    const invMask = m.u32((m.u32(GDW_INV_BITMASKS_IAT_VA_113C) + ecx) >>> 0)
    m.setU32(wordAddr, (curWord & invMask) >>> 0)
    if (wasSet === 0) return
  }
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  const nStates = m.u32((sgpt + 0xc4) >>> 0) | 0
  const cnt = (nStates + 0x1f) | 0
  const strideWords = (cnt + ((cnt >> 31) & 0x1f)) >> 5
  const dirtyAddr = (m.u32((edi + 0x58) >>> 0) + ((strideWords + esi) << 2)) >>> 0
  const bitMask = m.u32((m.u32(GDW_BITMASKS_IAT_VA_113C) + ecx) >>> 0)
  m.setU32(dirtyAddr, (m.u32(dirtyAddr) | bitMask) >>> 0)
  if (ebx < 0 || ebx >= nStates) return
  const pStateTxt = (m.u32((sgpt + 0xbc) >>> 0) + imul32(ebx, 0x3c)) >>> 0
  if (pStateTxt === 0) return
  if ((m.u8((pStateTxt + 0x12) >>> 0) & m.u8(m.u32(GDW_BITMASKS_IAT_VA_113C))) === 0) return
  if (setFlag) {
    m.setU32((u + 0xc8) >>> 0, (m.u32((u + 0xc8) >>> 0) | 0x08) >>> 0)
    return
  }
  const pDisguiseMask = m.u32((sgpt + 0x10c) >>> 0) >>> 0
  let anyDisguise = 0
  for (let i = 0; i < strideWords; i++) {
    if ((m.u32((pFlags + i * 4) >>> 0) & m.u32((pDisguiseMask + i * 4) >>> 0)) !== 0) {
      anyDisguise = 1
      break
    }
  }
  if (anyDisguise === 0) {
    m.setU32((u + 0xc8) >>> 0, (m.u32((u + 0xc8) >>> 0) & 0xfffffff7) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FDA22C0` (internal `SKILLS_GetOrCreateSkillStatList113c`,
 * custom `edi = pUnit, ebx = nStateId, [esp+4] = bCreate`, `ret 4` -> `D2StatListStrc*`).
 */
export function SKILLS_GetOrCreateSkillStatList113c(
  m: Memory113c,
  pUnit: number,
  nStateId: number,
  bCreate: number,
): number {
  const u = pUnit >>> 0
  const st = nStateId | 0
  const pListEx = m.u32((u + 0x5c) >>> 0) >>> 0
  let esi =
    pListEx !== 0 && (m.u32((pListEx + 0x10) >>> 0) | 0) < 0
      ? STATLIST_GetStatListFromUnitAndState113c(m, u, st) >>> 0
      : 0
  if ((bCreate | 0) !== 0) {
    if (esi === 0) {
      const dwOwnerId = m.u32((u + 0x0c) >>> 0)
      const eOwnerType = m.u32(u)
      const pMemPool = m.u32((u + 0x08) >>> 0)
      esi = m.alloc(0x3c) >>> 0
      if (esi !== 0) {
        m.fill(esi, 0x3c, 0)
        m.setU32(esi, pMemPool)
        m.setU32((esi + 0x08) >>> 0, eOwnerType)
        m.setU32((esi + 0x0c) >>> 0, dwOwnerId)
        m.setU32((esi + 0x14) >>> 0, st >>> 0)
      }
      STATLIST_MergeStatLists113c(m, u, esi, 1)
    }
    return esi >>> 0
  }
  if (esi !== 0) {
    removeAndFreeSubListIfNonExtended113c(m, esi)
  }
  return 0
}
export const SKILLS_GetOrCreateUnitStateStatList113c = SKILLS_GetOrCreateSkillStatList113c

/**
 * `@va D2Common:0x6FD9F160` (`D2Common.#10479` `SKILLS_TestLineOfSightFromUnitToTarget113c`,
 * stdcall `nTargetX, nTargetY, pUnit, dwMask`, `ret 0x10` -> `BOOL`).
 */
export function SKILLS_TestLineOfSightFromUnitToTarget113c(
  m: Memory113c,
  nTargetX: number,
  nTargetY: number,
  pUnit: number,
  dwMask: number,
): number {
  const u = pUnit >>> 0
  const uType = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  const isStatic = uType === 2 || (uType > 3 && uType <= 5)
  const edi = isStatic ? m.u32((pPath + 0x10) >>> 0) : pPath !== 0 ? m.u16((pPath + 0x06) >>> 0) : 0
  const esi = isStatic ? m.u32((pPath + 0x0c) >>> 0) : pPath !== 0 ? m.u16((pPath + 0x02) >>> 0) : 0
  const pRoom = UNITS_GetRoom113c(m, u) >>> 0
  return SKILLS_CheckLineOfSight113c(m, nTargetX >>> 0, nTargetY >>> 0, esi, edi, pRoom, dwMask >>> 0)
}
export const SKILLS_CheckLineOfSightToUnit113c = SKILLS_TestLineOfSightFromUnitToTarget113c

/**
 * `@va D2Common:0x6FD83020` (`D2Common.#10210` `STATES_UpdateOrClearState98Transform113c`,
 * stdcall `pUnit, pOwner`, `ret 8`, void).
 */
export function STATES_UpdateOrClearState98Transform113c(
  m: Memory113c,
  pUnit: number,
  pOwner: number,
): void {
  const edi = pUnit >>> 0
  const owner = pOwner >>> 0
  if (owner !== 0) {
    STATES_SetUnitSourceUnit113c(m, edi, m.u32(owner), m.u32((owner + 0x0c) >>> 0))
    return
  }
  if (edi === 0) return
  const pList0 = m.u32((edi + 0x5c) >>> 0) >>> 0
  m.setU32((edi + 0x94) >>> 0, 0)
  m.setU32((edi + 0x98) >>> 0, 0)
  if (pList0 !== 0) {
    const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
    if ((m.u32((sgpt + 0xc4) >>> 0) | 0) > 0x62) {
      statesToggleStateMem113c(m, 0x62, edi, 0)
      UNITROOM_RefreshUnit113c(m, edi)
    }
    const esi = STATLIST_GetStatListFromUnitAndState113c(m, edi, 0x62) >>> 0
    if (esi !== 0) {
      removeAndFreeSubListIfNonExtended113c(m, esi)
    }
  }
  m.setU32((edi + 0xc8) >>> 0, (m.u32((edi + 0xc8) >>> 0) & 0xfffffbff) >>> 0)
}
export const STATES_UpdateOrClearUnitSourceUnit113c = STATES_UpdateOrClearState98Transform113c

function missileEvalBandDamage113c(
  m: Memory113c,
  pMissile: number,
  pOwner: number,
  nMissileId: number,
  nLevel: number,
  bandOff: number,
  baseOff: number,
  symCalcOff: number,
): number {
  const ebp = pMissile >>> 0
  if (ebp !== 0 && m.u32(ebp) !== 3) return 0
  let esi = nMissileId | 0
  if (esi < 0 && ebp !== 0) {
    esi = m.u32((ebp + 4) >>> 0) | 0
  }
  let ebx = nLevel | 0
  if (ebx <= 0 && ebp !== 0) {
    const pData = m.u32((ebp + 0x14) >>> 0) >>> 0
    ebx = pData !== 0 ? i16(m.u16((pData + 0x0c) >>> 0)) : 0
  }
  if (esi < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (esi >= (m.u32((sgpt + 0xb6c) >>> 0) | 0)) return 0
  const pRec = (m.u32((sgpt + 0xb64) >>> 0) + imul32(esi, 0x1a4)) >>> 0
  if (pRec === 0) return 0
  let edi =
    (SKILLS_Calc5BandLinear113c(m, ebx, (pRec + bandOff) >>> 0) +
      (m.u32((pRec + baseOff) >>> 0) | 0)) |
    0
  const symCalc = m.u32((pRec + symCalcOff) >>> 0)
  if (symCalc !== 0xffffffff) {
    const synPct = MISSILE_ResolveSkillIdByCodeOrRef113c(m, ebp, pOwner >>> 0, symCalc, esi, ebx) | 0
    if (synPct !== 0) {
      edi = (edi + mulDiv113c(synPct, edi, 100)) | 0
    }
  }
  const shift = m.u8((pRec + 0x196) >>> 0) & 31
  return (edi << shift) | 0
}

/**
 * `@va D2Common:0x6FDBA3E0` (`D2Common.#10532` `MISSILE_EvaluateElementalMaxDamage113c`,
 * stdcall `pMissile, pOwner, nMissileId, nLevel`, `ret 0x10` -> `i32`).
 */
export function MISSILE_EvaluateElementalMaxDamage113c(
  m: Memory113c,
  pMissile: number,
  pOwner: number,
  nMissileId: number,
  nLevel: number,
): number {
  return missileEvalBandDamage113c(m, pMissile, pOwner, nMissileId, nLevel, 0x104, 0xec, 0x118)
}

/**
 * `@va D2Common:0x6FDBA4B0` (`D2Common.#10256` `MISSILE_EvaluatePhysMaxDamage113c`,
 * stdcall `pMissile, pOwner, nMissileId, nLevel`, `ret 0x10` -> `i32`).
 */
export function MISSILE_EvaluatePhysMaxDamage113c(
  m: Memory113c,
  pMissile: number,
  pOwner: number,
  nMissileId: number,
  nLevel: number,
): number {
  return missileEvalBandDamage113c(m, pMissile, pOwner, nMissileId, nLevel, 0xcc, 0xb4, 0xe0)
}

/**
 * `@va D2Common:0x6FDBA580` (`D2Common.#10040` `MISSILE_EvaluatePhysMinDamage113c`,
 * stdcall `pMissile, pOwner, nMissileId, nLevel`, `ret 0x10` -> `i32`).
 */
export function MISSILE_EvaluatePhysMinDamage113c(
  m: Memory113c,
  pMissile: number,
  pOwner: number,
  nMissileId: number,
  nLevel: number,
): number {
  return missileEvalBandDamage113c(m, pMissile, pOwner, nMissileId, nLevel, 0xb8, 0xb0, 0xe0)
}

const MISSILE_PARAM_FIELD_OFFS_113C = [
  0x38, 0x3c, 0x40, 0x44, 0x48, 0x58, 0x5c, 0x60, 0x64, 0x68, 0x4c, 0x50, 0x54, 0x6c, 0x70, 0x74,
  0x78, 0x7c,
] as const

const MISSILE_PAIR_BASE_OFFS_113C = [0x38, 0x40, 0x58, 0x60, 0x4c, 0x6c, 0x78] as const

/**
 * `@va D2Common:0x6FDBA790` (`D2Common.#10347` `MISSILE_EvaluateMissCalcFormula113c`,
 * stdcall `pMissile, pOwner, nParamId, nMissileId, nLevel`, `ret 0x14` -> `i32`).
 */
export function MISSILE_EvaluateMissCalcFormula113c(
  m: Memory113c,
  pMissile: number,
  pOwner: number,
  nParamId: number,
  nMissileId: number,
  nLevel: number,
): number {
  const edx = pMissile >>> 0
  if (edx !== 0 && m.u32(edx) !== 3) return 0
  const eax = nMissileId | 0
  if (eax < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (eax >= (m.u32((sgpt + 0xb6c) >>> 0) | 0)) return 0
  const ecx = (m.u32((sgpt + 0xb64) >>> 0) + imul32(eax, 0x1a4)) >>> 0
  if (ecx === 0) return 0
  const esi = nParamId & 0xff
  if (esi > 0x2a) return 0
  if (esi < 18) {
    return m.u32((ecx + MISSILE_PARAM_FIELD_OFFS_113C[esi]!) >>> 0) | 0
  }
  const lvl = nLevel | 0
  if (esi >= 29) {
    const baseOff = MISSILE_PAIR_BASE_OFFS_113C[(esi - 29) >> 1]!
    const parA = m.u32((ecx + baseOff) >>> 0) | 0
    const parB = m.u32((ecx + baseOff + 4) >>> 0) | 0
    if (((esi - 29) & 1) === 0) {
      return (imul32((lvl - 1) | 0, parB) + parA) | 0
    }
    return SKILLS_CalcDiminishingReturns113c(m, lvl, parA, parB) | 0
  }
  if (esi === 18) return lvl
  if (esi === 21) return MISSILE_EvaluateElementalLength113c(m, edx, pOwner, eax, lvl) | 0
  if (esi === 28) {
    return (imul32(i16(m.u16((ecx + 0x98) >>> 0)), lvl) + i16(m.u16((ecx + 0x96) >>> 0))) | 0
  }
  if (esi === 19 || esi === 22) {
    const v = MISSILE_EvaluateElementalMinDamage113c(m, edx, pOwner, eax, lvl) | 0
    return esi === 19 ? sar32(v, 8) : v
  }
  if (esi === 20 || esi === 23) {
    const v = MISSILE_EvaluateElementalMaxDamage113c(m, edx, pOwner, eax, lvl) | 0
    return esi === 20 ? sar32(v, 8) : v
  }
  if (esi === 24 || esi === 26) {
    const v = MISSILE_EvaluatePhysMinDamage113c(m, edx, pOwner, eax, lvl) | 0
    return esi === 24 ? sar32(v, 8) : v
  }
  const v = MISSILE_EvaluatePhysMaxDamage113c(m, edx, pOwner, eax, lvl) | 0
  return esi === 25 ? sar32(v, 8) : v
}
export const MISSILE_EvalMissCalcParamById113c = MISSILE_EvaluateMissCalcFormula113c

/**
 * `@va D2Common:0x6FDBB160` (internal `MISSILE_EvalMissCalcParamCallback113c`,
 * fastcall `ecx = nParamId, edx = pCtx`, `ret` -> `i32`).
 */
export function MISSILE_EvalMissCalcParamCallback113c(
  m: Memory113c,
  nParamId: number,
  pCtx: number,
): number {
  const edx = pCtx >>> 0
  if (edx === 0) return 0
  return MISSILE_EvaluateMissCalcFormula113c(
    m,
    m.u32(edx),
    m.u32((edx + 4) >>> 0),
    nParamId | 0,
    m.u32((edx + 8) >>> 0) | 0,
    m.u32((edx + 0x0c) >>> 0) | 0,
  )
}

const SKILL_CALC_FIELD_OFFS_113C = [
  0x60, 0x138, 0x13c, 0x140, 0x144, 0x64, 0x68, 0x6c, 0x70, 0x74, 0x78, 0x7c, 0xa4, 0xa8, 0xac, 0xb0,
  0xb4, 0xc0, 0x170,
] as const

function rollLimitedSeedPair113c(seed: [number, number], nMin: number, nMax: number): number {
  const lo = nMin | 0
  const hi = nMax | 0
  if (lo >= hi) return lo
  const range = (hi - lo + 1) | 0
  if (range <= 0) return lo
  const prod = BigInt(seed[0] >>> 0) * 0x6ac690c5n + BigInt(seed[1] >>> 0)
  seed[0] = Number(prod & 0xffffffffn) >>> 0
  seed[1] = Number((prod >> 32n) & 0xffffffffn) >>> 0
  const rem = (range & (range - 1)) === 0 ? seed[0] & (range - 1) : seed[0] % (range >>> 0)
  return (lo + rem) | 0
}

/**
 * `@va D2Common:0x6FDA0460` (`D2Common.#10121` `SKILLS_GetSkillElemMinDamage`,
 * stdcall `pOwner, nSkillId, nLevel, bApplyMastery`, `ret 0x10` -> `i32`).
 */
export function SKILLS_GetSkillElemMinDamage113c(
  m: Memory113c,
  pOwner: number,
  nSkillId: number,
  nLevel: number,
  bApplyMastery: number,
): number {
  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, nSkillId) >>> 0
  const lvl = nLevel | 0
  if (pSkTxt === 0 || lvl <= 0) return 0
  const sh = m.u8((pSkTxt + 0x1a4) >>> 0) & 31
  let val =
    ((SKILLS_Calc5BandLinear113c(m, lvl, (pSkTxt + 0x1e8) >>> 0) +
      (m.u32((pSkTxt + 0x1e0) >>> 0) | 0)) <<
      sh) |
    0
  const calcOff = m.u32((pSkTxt + 0x210) >>> 0) >>> 0
  if (calcOff !== 0xffffffff && (val > 0x100 || m.u32((pSkTxt + 0x1e8) >>> 0) !== 0)) {
    const pct = evalSkillCalcRpnMem113c(m, calcOff, pOwner, nSkillId, lvl) | 0
    if (pct !== 0) {
      val = (val + mulDiv113c(pct, val, 100)) | 0
    }
  }
  if ((bApplyMastery | 0) !== 0 && pOwner !== 0) {
    val = (val + SKILLS_ApplyElementalMasteryBonus113c(m, pOwner, m.u8((pSkTxt + 0x1dc) >>> 0), val)) | 0
  }
  return val
}

/**
 * `@va D2Common:0x6FDA0360` (`D2Common.#11091` `SKILLS_GetSkillElemMaxDamage`,
 * stdcall `pOwner, nSkillId, nLevel, bApplyMastery`, `ret 0x10` -> `i32`).
 */
export function SKILLS_GetSkillElemMaxDamage113c(
  m: Memory113c,
  pOwner: number,
  nSkillId: number,
  nLevel: number,
  bApplyMastery: number,
): number {
  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, nSkillId) >>> 0
  const lvl = nLevel | 0
  if (pSkTxt === 0 || lvl <= 0) return 0
  const sh = m.u8((pSkTxt + 0x1a4) >>> 0) & 31
  let val =
    ((SKILLS_Calc5BandLinear113c(m, lvl, (pSkTxt + 0x1fc) >>> 0) +
      (m.u32((pSkTxt + 0x1e4) >>> 0) | 0)) <<
      sh) |
    0
  const calcOff = m.u32((pSkTxt + 0x210) >>> 0) >>> 0
  if (calcOff !== 0xffffffff) {
    const pct = evalSkillCalcRpnMem113c(m, calcOff, pOwner, nSkillId, lvl) | 0
    if (pct !== 0) {
      val = (val + mulDiv113c(pct, val, 100)) | 0
    }
  }
  if ((bApplyMastery | 0) !== 0 && pOwner !== 0) {
    val = (val + SKILLS_ApplyElementalMasteryBonus113c(m, pOwner, m.u8((pSkTxt + 0x1dc) >>> 0), val)) | 0
  }
  return val
}

/**
 * `@va D2Common:0x6FDA1BF0` (`D2Common.#10786` `SKILLS_EvalCalcByOffset`,
 * stdcall `pOwner, dwCalcOffset, nSkillId, nLevel`, `ret 0x10` -> `i32`).
 */
export function SKILLS_EvalCalcByOffset113c(
  m: Memory113c,
  pOwner: number,
  dwCalcOffset: number,
  nSkillId: number,
  nLevel: number,
): number {
  return evalSkillCalcRpnMem113c(m, dwCalcOffset, pOwner, nSkillId, nLevel)
}

function evalSkillElemMinForCalc113c(
  m: Memory113c,
  pOwner: number,
  nSkillId: number,
  nLevel: number,
  bApplyMastery: number,
): number {
  return SKILLS_GetSkillElemMinDamage113c(m, pOwner, nSkillId, nLevel, bApplyMastery)
}

function evalSkillElemMaxForCalc113c(
  m: Memory113c,
  pOwner: number,
  nSkillId: number,
  nLevel: number,
  bApplyMastery: number,
): number {
  return SKILLS_GetSkillElemMaxDamage113c(m, pOwner, nSkillId, nLevel, bApplyMastery)
}

function evalSkillCalcRpnMem113c(
  m: Memory113c,
  dwCalcOffset: number,
  pOwner: number,
  nSkillId: number,
  nLevel: number,
): number {
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  const pCodeBase = m.u32((sgpt + 0x40) >>> 0) >>> 0
  const codeSize = m.u32((sgpt + 0x44) >>> 0) >>> 0
  const calcOff = dwCalcOffset >>> 0
  if (pCodeBase === 0 || calcOff >= codeSize) return 0
  const size = (codeSize - calcOff) | 0
  const base = (pCodeBase + calcOff) >>> 0
  const stack = new Int32Array(64)
  let sp = 0
  const pop = (): number => (sp > 0 ? stack[--sp]! : 0)
  const push = (v: number): void => {
    if (sp < 64) stack[sp++] = v | 0
  }
  let cur = base
  while (((cur - base) | 0) < size) {
    const op = m.u8(cur)
    cur = (cur + 1) >>> 0
    if (op === 0 || op > 22 || op === 2 || op === 3) {
      return sp > 0 ? stack[sp - 1]! | 0 : 0
    }
    if (op === 1) {
      const fnIdx = m.u8(cur)
      cur = (cur + 1) >>> 0
      if (fnIdx >= 7) {
        push(0)
      } else if (fnIdx === 6) {
        const a3 = pop()
        const a2 = pop()
        const a1 = pop()
        const lvl = evalSkillCalcFieldMem113c(m, pOwner, a2, nSkillId, nLevel)
        push(evalSkillCalcFieldMem113c(m, pOwner, a3, a1, lvl))
      } else {
        const a2 = pop()
        const a1 = pop()
        if (fnIdx === 0) {
          push(a1 < a2 ? a1 : a2)
        } else if (fnIdx === 1) {
          push(a1 > a2 ? a1 : a2)
        } else if (fnIdx === 2) {
          push(pOwner !== 0 ? SEED_RollLimitedRandomNumberInline113c(m, (pOwner + 0x20) >>> 0, a1, a2) : 0)
        } else if (fnIdx === 3) {
          const effLvl = pOwner !== 0 ? SKILLS_GetSkillLevelByIdWithBonus113c(m, pOwner, a1) : 0
          push(evalSkillCalcFieldMem113c(m, pOwner, a2, a1, effLvl))
        } else if (fnIdx === 4) {
          push(MISSILE_EvaluateMissCalcFormula113c(m, 0, pOwner, a2, a1, nLevel))
        } else {
          const sc = m.u32((sgpt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0
          if (pOwner === 0 || a1 < 0 || a1 >= sc) {
            push(0)
          } else if (a1 === 0x13) {
            push(UNITS_GetPlayerBaseToHit113c(m, pOwner))
          } else if (a2 === 1) {
            push(statListGetUnitBaseStatMem113c(m, pOwner, a1, 0) | 0)
          } else if (a2 === 2) {
            push(STATLIST_GetUnitStatWithLayer113c(m, pOwner, a1, 0) | 0)
          } else {
            push(statListGetUnitStatMem113c(m, pOwner, a1, 0) | 0)
          }
        }
      }
    } else if (op >= 4 && op <= 6) {
      const varId = op === 4 ? m.u8(cur) : op === 5 ? i16(m.u16(cur)) : m.u32(cur) | 0
      cur = (cur + (1 << (op - 4))) >>> 0
      push(evalSkillCalcFieldMem113c(m, pOwner, varId, nSkillId, nLevel))
    } else if (op >= 7 && op <= 9) {
      const imm = op === 7 ? (m.u8(cur) << 24) >> 24 : op === 8 ? i16(m.u16(cur)) : m.u32(cur) | 0
      cur = (cur + (1 << (op - 7))) >>> 0
      push(imm)
    } else if (op === 20) {
      const exp = pop()
      const baseVal = pop()
      if (exp <= 0) {
        push(1)
      } else {
        let acc = baseVal | 0
        for (let k = (exp - 1) | 0; k > 0; k--) {
          acc = imul32(acc, baseVal)
        }
        push(acc)
      }
    } else if (op === 21) {
      push((-pop()) | 0)
    } else if (op === 22) {
      const fVal = pop()
      const tVal = pop()
      push(pop() !== 0 ? tVal : fVal)
    } else {
      const rhs = pop()
      const lhs = pop()
      const res =
        op === 16
          ? (lhs + rhs) | 0
          : op === 17
            ? (lhs - rhs) | 0
            : op === 18
              ? imul32(lhs, rhs)
              : op === 19
                ? rhs === 0
                  ? 0
                  : Math.trunc(lhs / rhs) | 0
                : op === 10
                  ? lhs < rhs
                    ? 1
                    : 0
                  : op === 11
                    ? lhs > rhs
                      ? 1
                      : 0
                    : op === 12
                      ? lhs <= rhs
                        ? 1
                        : 0
                      : op === 13
                        ? lhs >= rhs
                          ? 1
                          : 0
                        : op === 14
                          ? lhs === rhs
                            ? 1
                            : 0
                          : lhs !== rhs
                            ? 1
                            : 0
      push(res)
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD9E7A0` (`D2Common.#10548` `SKILLS_EvalSkillSynergyOrMasteryCalc`,
 * stdcall `pOwner, nSkillId, nLevel, nCalcGroup`, `ret 0x10` -> `i32`).
 */
export function SKILLS_EvalSkillSynergyOrMasteryCalc113c(
  m: Memory113c,
  pOwner: number,
  nSkillId: number,
  nLevel: number,
  nCalcGroup: number,
): number {
  const skId = nSkillId | 0
  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, skId) >>> 0
  const lvl = nLevel | 0
  if (pSkTxt === 0 || lvl <= 0) return 0
  const grp = nCalcGroup | 0
  if (grp !== 0 && grp !== 1 && grp !== 2) return 0
  const s1 = grp === 0 ? 0x156 : grp === 1 ? 0x157 : 0x158
  const s2 = grp === 0 ? 0x159 : grp === 1 ? 0x15a : 0x15b
  for (let i = 0; i < 5; i++) {
    const w = i16(m.u16((pSkTxt + 0x98 + i * 2) >>> 0))
    if (w === s1 || w === s2) {
      return SKILLS_EvalCalcByOffset113c(
        m,
        pOwner,
        m.u32((pSkTxt + 0xa4 + i * 4) >>> 0),
        skId,
        lvl,
      )
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD9E900` (`D2Common.#10510` `SKILLS_GetSkillPeriodicDelayOrLength`,
 * stdcall `pOwner, nSkillId, nLevel, _unused`, `ret 0x10` -> `i32`).
 */
export function SKILLS_GetSkillPeriodicDelayOrLength113c(
  m: Memory113c,
  pOwner: number,
  nSkillId: number,
  nLevel: number,
  _unused = 0,
): number {
  const skId = nSkillId | 0
  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, skId) >>> 0
  const lvl = nLevel | 0
  if (pSkTxt === 0 || lvl <= 0) return 0
  const i1 = m.u32((pSkTxt + 0x218) >>> 0) | 0
  const i2 = m.u32((pSkTxt + 0x21c) >>> 0) | 0
  const i3 = m.u32((pSkTxt + 0x220) >>> 0) | 0
  const add =
    lvl > 16
      ? (imul32(lvl - 16, i3) + (i2 << 3) + imul32(i1, 7)) | 0
      : lvl > 8
        ? (imul32(lvl - 8, i2) + imul32(i1, 7)) | 0
        : imul32(lvl - 1, i1)
  let len = (m.u32((pSkTxt + 0x214) >>> 0) + add) | 0
  const calcOff = m.u32((pSkTxt + 0x224) >>> 0) >>> 0
  if (calcOff !== 0xffffffff) {
    const pct = SKILLS_EvalCalcByOffset113c(m, pOwner, calcOff, skId, lvl) | 0
    if (pct !== 0) len = (len + mulDiv113c(pct, len, 100)) | 0
  }
  return len
}

/**
 * `@va D2Common:0x6FD9EA50` (`D2Common.#10653` `SKILLS_GetSkillToHitBonus`,
 * stdcall `pOwner, nSkillId, nLevel`, `ret 0xC` -> `i32`).
 */
export function SKILLS_GetSkillToHitBonus113c(
  m: Memory113c,
  pOwner: number,
  nSkillId: number,
  nLevel: number,
): number {
  const skId = nSkillId | 0
  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, skId) >>> 0
  const lvl = nLevel | 0
  if (pSkTxt === 0 || lvl <= 0) return 0
  const calcOff = m.u32((pSkTxt + 0x1a0) >>> 0) >>> 0
  if (calcOff !== 0xffffffff) return SKILLS_EvalCalcByOffset113c(m, pOwner, calcOff, skId, lvl)
  return (
    (m.u32((pSkTxt + 0x198) >>> 0) + imul32((lvl - 1) | 0, m.u32((pSkTxt + 0x19c) >>> 0) | 0)) | 0
  )
}

/**
 * `@va D2Common:0x6FDA1070` (`D2Common.#10147` `SKILLS_GetSkillCalcFieldById`,
 * stdcall `pOwner, nFieldCode, nSkillId, nLevel`, `ret 0x10` -> `i32`).
 */
export function SKILLS_GetSkillCalcFieldById113c(
  m: Memory113c,
  pOwner: number,
  nFieldCode: number,
  nSkillId: number,
  nLevel: number,
): number {
  const skId = nSkillId | 0
  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, skId) >>> 0
  if (pSkTxt === 0) return 0
  const code = nFieldCode & 0xff
  if (code > 0x48) return 0
  const lvl = nLevel | 0
  const owner = pOwner >>> 0
  switch (code) {
    case 0:
      return DATATBLS_CalcSkillLinearParam12Inline113c(m, skId, lvl) | 0
    case 1:
      return SKILLS_EvalParam12DimReturns113c(m, lvl, skId) | 0
    case 2:
      return DATATBLS_CalcSkillLinearParam34Inline113c(m, skId, lvl) | 0
    case 3:
      return SKILLS_EvalParam34DimReturns113c(m, lvl, skId) | 0
    case 4:
      return DATATBLS_CalcSkillLinearParam56Inline113c(m, skId, lvl) | 0
    case 5:
      return SKILLS_EvalParam56DimReturns113c(m, lvl, skId) | 0
    case 6:
      return DATATBLS_CalcSkillLinearParam78Inline113c(m, skId, lvl) | 0
    case 7:
      return (
        SKILLS_CalcDiminishingReturns113c(
          m,
          lvl,
          m.u32((pSkTxt + 0x160) >>> 0) | 0,
          m.u32((pSkTxt + 0x164) >>> 0) | 0,
        ) | 0
      )
    case 8:
      return DATATBLS_GetSkillsTxtParam1Inline113c(m, skId) | 0
    case 9:
      return DATATBLS_GetSkillsTxtParam2Inline113c(m, skId) | 0
    case 10:
      return DATATBLS_GetSkillsTxtParam3Inline113c(m, skId) | 0
    case 11:
      return DATATBLS_GetSkillsTxtParam4Inline113c(m, skId) | 0
    case 12:
      return DATATBLS_GetSkillsTxtParam5Inline113c(m, skId) | 0
    case 13:
      return DATATBLS_GetSkillsTxtParam6Inline113c(m, skId) | 0
    case 14:
      return m.u32((pSkTxt + 0x160) >>> 0) | 0
    case 15:
      return m.u32((pSkTxt + 0x164) >>> 0) | 0
    case 16:
      return lvl
    case 17:
      return sar32(SKILLS_GetSkillElemMinDamage113c(m, owner, skId, lvl, 0), 8)
    case 18:
      return sar32(SKILLS_GetSkillElemMaxDamage113c(m, owner, skId, lvl, 0), 8)
    case 19:
    case 51:
      return SKILLS_GetSkillPeriodicDelayOrLength113c(m, owner, skId, lvl, 0)
    case 20:
      return SKILLS_GetSkillToHitBonus113c(m, owner, skId, lvl)
    case 21: {
      if (lvl <= 0) return 0
      const base =
        (imul32(i16(m.u16((pSkTxt + 0x18c) >>> 0)), lvl - 1) +
          i16(m.u16((pSkTxt + 0x18a) >>> 0))) |
        0
      return sar32((base << (m.u8((pSkTxt + 0x188) >>> 0) & 31)) | 0, 8)
    }
    case 22: {
      if (lvl <= 0) return 0
      const base =
        (imul32(i16(m.u16((pSkTxt + 0x18c) >>> 0)), lvl - 1) +
          i16(m.u16((pSkTxt + 0x18a) >>> 0))) |
        0
      const half = Math.trunc(imul32(base, 0x19) / 2) | 0
      return sar32((half << (m.u8((pSkTxt + 0x188) >>> 0) & 31)) | 0, 8)
    }
    case 23:
    case 24:
    case 25:
      return SKILLS_EvalSkillSynergyOrMasteryCalc113c(m, owner, skId, lvl, (code - 23) | 0)
    case 26:
    case 29:
    case 32: {
      if (lvl <= 0) return 0
      const pSkDesc = DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m, skId) >>> 0
      if (pSkDesc === 0) return 0
      const idx = Math.trunc((code - 26) / 3)
      const misId = i16(m.u16((pSkDesc + 0x3c + idx * 2) >>> 0))
      if (DATATBLS_GetMissilesTxtRecordInline113c(m, misId) === 0) return 0
      return sar32(MISSILE_EvaluateElementalMinDamage113c(m, 0, owner, misId, lvl), 8)
    }
    case 27:
    case 30:
    case 33: {
      if (lvl <= 0) return 0
      const pSkDesc = DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m, skId) >>> 0
      if (pSkDesc === 0) return 0
      const idx = Math.trunc((code - 27) / 3)
      const misId = i16(m.u16((pSkDesc + 0x3c + idx * 2) >>> 0))
      if (DATATBLS_GetMissilesTxtRecordInline113c(m, misId) === 0) return 0
      return sar32(MISSILE_EvaluateElementalMaxDamage113c(m, 0, owner, misId, lvl), 8)
    }
    case 28:
    case 31:
    case 34: {
      if (lvl <= 0) return 0
      const pSkDesc = DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m, skId) >>> 0
      if (pSkDesc === 0) return 0
      const idx = Math.trunc((code - 28) / 3)
      const misId = i16(m.u16((pSkDesc + 0x3c + idx * 2) >>> 0))
      if (DATATBLS_GetMissilesTxtRecordInline113c(m, misId) === 0) return 0
      return MISSILE_EvaluateElementalLength113c(m, 0, owner, misId, lvl) | 0
    }
    case 35:
    case 36:
    case 37: {
      const pSkDesc = DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m, skId) >>> 0
      if (pSkDesc === 0) return 0
      const misId = i16(m.u16((pSkDesc + code * 2 - 0x0a) >>> 0))
      const pMis = DATATBLS_GetMissilesTxtRecordInline113c(m, misId) >>> 0
      if (pMis === 0) return 0
      return (
        (imul32(i16(m.u16((pMis + 0x98) >>> 0)), lvl) + i16(m.u16((pMis + 0x96) >>> 0))) | 0
      )
    }
    case 38:
      return SKILLS_GetSkillElemMinDamage113c(m, owner, skId, lvl, 0)
    case 39:
      return SKILLS_GetSkillElemMaxDamage113c(m, owner, skId, lvl, 0)
    case 40:
      return owner !== 0 ? statListGetUnitStatMem113c(m, owner, 0x0c, 0) | 0 : 0
    case 41: {
      if (owner === 0) return 0
      const pSk = SKILLS_GetHighestLevelSkillFromUnitAndId113c(m, owner, skId) >>> 0
      if (pSk === 0) return 0
      const rawLvl = m.u32((pSk + 0x28) >>> 0) | 0
      const maxLvl = m.u32(m.u32(SGPT_EXPERIENCE_TXT_PTR_VA_113C) >>> 0) | 0
      return Math.min(Math.max(rawLvl, 0), maxLvl)
    }
    case 42: {
      if (lvl <= 0) return 0
      const base =
        (imul32(i16(m.u16((pSkTxt + 0x18c) >>> 0)), lvl - 1) +
          i16(m.u16((pSkTxt + 0x18a) >>> 0))) |
        0
      return (base << (m.u8((pSkTxt + 0x188) >>> 0) & 31)) | 0
    }
    case 43:
    case 45:
    case 47: {
      if (lvl <= 0) return 0
      const pSkDesc = DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m, skId) >>> 0
      if (pSkDesc === 0) return 0
      const idx = Math.trunc((code - 43) / 3)
      const misId = i16(m.u16((pSkDesc + 0x3c + idx * 2) >>> 0))
      if (DATATBLS_GetMissilesTxtRecordInline113c(m, misId) === 0) return 0
      return MISSILE_EvaluateElementalMinDamage113c(m, 0, owner, misId, lvl) | 0
    }
    case 44:
    case 46:
    case 48: {
      if (lvl <= 0) return 0
      const pSkDesc = DATATBLS_GetSkillDescTxtRecordFromSkillIdInline113c(m, skId) >>> 0
      if (pSkDesc === 0) return 0
      const idx = Math.trunc((code - 44) / 3)
      const misId = i16(m.u16((pSkDesc + 0x3c + idx * 2) >>> 0))
      if (DATATBLS_GetMissilesTxtRecordInline113c(m, misId) === 0) return 0
      return MISSILE_EvaluateElementalMaxDamage113c(m, 0, owner, misId, lvl) | 0
    }
    case 49:
      return sar32(SKILLS_GetSkillElemMinDamage113c(m, owner, skId, lvl, 1), 8)
    case 50:
      return sar32(SKILLS_GetSkillElemMaxDamage113c(m, owner, skId, lvl, 1), 8)
    case 52:
      return SKILLS_GetSkillElemMinDamage113c(m, owner, skId, lvl, 1)
    case 53:
      return SKILLS_GetSkillElemMaxDamage113c(m, owner, skId, lvl, 1)
    default: {
      const off = SKILL_CALC_FIELD_OFFS_113C[code - 54]
      if (off === undefined) return 0
      return SKILLS_EvalCalcByOffset113c(m, owner, m.u32((pSkTxt + off) >>> 0), skId, lvl)
    }
  }
}

function evalSkillCalcFieldMem113c(
  m: Memory113c,
  pOwner: number,
  nFieldCode: number,
  nSkillId: number,
  nLevel: number,
): number {
  return SKILLS_GetSkillCalcFieldById113c(m, pOwner, nFieldCode & 0xff, nSkillId, nLevel)
}

function fogEvalMissilePostFix113c(
  m: Memory113c,
  pBuf: number,
  nBufSize: number,
  pMissile: number,
  pOwner: number,
  nMissileId: number,
  nLevel: number,
  rawMissileIdArg: number,
  rawLevelArg: number,
): number {
  const size = nBufSize | 0
  const stack = new Int32Array(64)
  let sp = 0
  const pop = (): number => (sp > 0 ? stack[--sp]! : 0)
  const push = (v: number): void => {
    if (sp < 64) stack[sp++] = v | 0
  }
  const randSeed: [number, number] = [rawMissileIdArg >>> 0, rawLevelArg >>> 0]
  const base = pBuf >>> 0
  let cur = base
  while (((cur - base) | 0) < size) {
    const op = m.u8(cur)
    cur = (cur + 1) >>> 0
    if (op === 0 || op > 22 || op === 2 || op === 3) {
      return sp > 0 ? stack[sp - 1]! | 0 : 0
    }
    if (op === 1) {
      const fnIdx = m.u8(cur)
      cur = (cur + 1) >>> 0
      if (fnIdx >= 4) {
        push(0)
      } else {
        const a2 = pop()
        const a1 = pop()
        if (fnIdx === 0) {
          push(a1 < a2 ? a1 : a2)
        } else if (fnIdx === 1) {
          push(a1 > a2 ? a1 : a2)
        } else if (fnIdx === 2) {
          push(rollLimitedSeedPair113c(randSeed, a1, a2))
        } else {
          const owner = pOwner >>> 0
          const effLvl = owner !== 0 ? SKILLS_GetSkillLevelByIdWithBonus113c(m, owner, a1) : 0
          push(evalSkillCalcFieldMem113c(m, owner, a2, a1, effLvl))
        }
      }
    } else if (op >= 4 && op <= 6) {
      const varId =
        op === 4 ? m.u8(cur) : op === 5 ? i16(m.u16(cur)) : m.u32(cur) | 0
      cur = (cur + (1 << (op - 4))) >>> 0
      push(MISSILE_EvaluateMissCalcFormula113c(m, pMissile, pOwner, varId, nMissileId, nLevel))
    } else if (op >= 7 && op <= 9) {
      const imm =
        op === 7 ? (m.u8(cur) << 24) >> 24 : op === 8 ? i16(m.u16(cur)) : m.u32(cur) | 0
      cur = (cur + (1 << (op - 7))) >>> 0
      push(imm)
    } else if (op === 20) {
      const exp = pop()
      const baseVal = pop()
      if (exp <= 0) {
        push(1)
      } else {
        let acc = baseVal | 0
        for (let k = (exp - 1) | 0; k > 0; k--) {
          acc = imul32(acc, baseVal)
        }
        push(acc)
      }
    } else if (op === 21) {
      push((-pop()) | 0)
    } else if (op === 22) {
      const fVal = pop()
      const tVal = pop()
      push(pop() !== 0 ? tVal : fVal)
    } else {
      const rhs = pop()
      const lhs = pop()
      const res =
        op === 16
          ? (lhs + rhs) | 0
          : op === 17
            ? (lhs - rhs) | 0
            : op === 18
              ? imul32(lhs, rhs)
              : op === 19
                ? rhs === 0
                  ? 0
                  : Math.trunc(lhs / rhs) | 0
                : op === 10
                  ? lhs < rhs
                    ? 1
                    : 0
                  : op === 11
                    ? lhs > rhs
                      ? 1
                      : 0
                    : op === 12
                      ? lhs <= rhs
                        ? 1
                        : 0
                      : op === 13
                        ? lhs >= rhs
                          ? 1
                          : 0
                        : op === 14
                          ? lhs === rhs
                            ? 1
                            : 0
                          : lhs !== rhs
                            ? 1
                            : 0
      push(res)
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FDBB2B0` (`D2Common.#10231` `MISSILE_ResolveSkillIdByCodeOrRef113c`,
 * stdcall `pMissile, pOwner, dwCalcOffset, nMissileId, nLevel`, `ret 0x14` -> `i32`).
 */
export function MISSILE_ResolveSkillIdByCodeOrRef113c(
  m: Memory113c,
  pMissile: number,
  pOwner: number,
  dwCalcOffset: number,
  nMissileId: number,
  nLevel: number,
): number {
  const esi = pMissile >>> 0
  let edi = nMissileId | 0
  let edx = nLevel | 0
  if (esi !== 0) {
    if (m.u32(esi) !== 3) return 0
    if (edi < 0) {
      edi = m.u32((esi + 4) >>> 0) | 0
    }
    if (edx < 0) {
      const pData = m.u32((esi + 0x14) >>> 0) >>> 0
      edx = pData !== 0 ? i16(m.u16((pData + 0x0c) >>> 0)) : 0
    }
  }
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  const pCodeBase = m.u32((sgpt + 0x60) >>> 0) >>> 0
  if (pCodeBase === 0) return 0
  const calcOff = dwCalcOffset >>> 0
  const codeSize = m.u32((sgpt + 0x64) >>> 0) >>> 0
  if (calcOff >= codeSize) return 0
  return fogEvalMissilePostFix113c(
    m,
    (pCodeBase + calcOff) >>> 0,
    (codeSize - calcOff) >>> 0,
    esi,
    pOwner >>> 0,
    edi,
    edx,
    nMissileId | 0,
    nLevel | 0,
  )
}
export const MISSILE_EvaluateMissCalc113c = MISSILE_ResolveSkillIdByCodeOrRef113c

/**
 * `@va D2Common:0x6FDBB360` (`D2Common.#10205` `MISSILE_EvaluateElementalMinDamage113c`,
 * stdcall `pMissile, pOwner, nMissileId, nLevel`, `ret 0x10` -> `i32`).
 */
export function MISSILE_EvaluateElementalMinDamage113c(
  m: Memory113c,
  pMissile: number,
  pOwner: number,
  nMissileId: number,
  nLevel: number,
): number {
  return missileEvalBandDamage113c(m, pMissile, pOwner, nMissileId, nLevel, 0xf0, 0xe8, 0x118)
}

/**
 * `@va D2Common:0x6FDA0C90` (internal `SKILLS_EvalMissileParamCallback113c`,
 * custom `ecx = nMissileId, edx = nParamId, [esp+4] = _unused, [esp+8] = pSkillCalcCtx`, `ret 8` -> `i32`).
 */
export function SKILLS_EvalMissileParamCallback113c(
  m: Memory113c,
  nMissileId: number,
  nParamId: number,
  _unused: number,
  pSkillCalcCtx: number,
): number {
  const eax = pSkillCalcCtx >>> 0
  if (eax === 0) return 0
  return MISSILE_EvaluateMissCalcFormula113c(
    m,
    0,
    m.u32(eax),
    nParamId | 0,
    nMissileId | 0,
    m.u32((eax + 8) >>> 0) | 0,
  )
}

/**
 * `@va D2Common:0x6FD9FE80` (internal `SKILLS_ScaleValueByMasteryAndSkillParam1113c`,
 * stdcall `pUnit, nSkillId`, `ret 8` -> `i32`).
 */
export function SKILLS_ScaleValueByMasteryAndSkillParam1113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const edi = pUnit >>> 0
  if (edi === 0) return 0
  const uType = m.u32(edi) | 0
  if ((uType < 0 || uType > 1) && uType !== 3) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if ((m.u32((sgpt + 0xc4) >>> 0) | 0) <= 0x2a) return 0
  if (STATES_CheckStateMaskOnUnitFast113c(m, edi, 0x2a) === 0) return 0
  const esi = STATLIST_GetStatListFromUnitAndState113c(m, edi, 0x2a) >>> 0
  if (esi === 0) return 0
  const baseStat = STATLIST_GetBaseStatFromListInline113c(m, esi, 0x19, 0) | 0
  const skId = nSkillId | 0
  let param1 = 0
  if (skId >= 0 && skId < (m.u32((sgpt + 0xba0) >>> 0) | 0)) {
    const pSkillsTxt = (m.u32((sgpt + 0xb98) >>> 0) + imul32(skId, D2SkillsTxt_SIZE)) >>> 0
    if (pSkillsTxt !== 0) {
      param1 = m.u32((pSkillsTxt + 0x148) >>> 0) | 0
    }
  }
  const prod = imul32(baseStat, param1)
  return sar32((prod + ((prod >> 31) & 7)) | 0, 3)
}

/**
 * `@va D2Common:0x6FD9FA30` (internal `SKILLS_CanUnitAllocateSkillPoint113c`,
 * stdcall `pUnit, nSkillId`, `ret 8` -> `BOOL`).
 */
export function SKILLS_CanUnitAllocateSkillPoint113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const skId = nSkillId | 0
  if (skId < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if (skId >= (m.u32((sgpt + 0xba0) >>> 0) | 0)) return 0
  const esi = (m.u32((sgpt + 0xb98) >>> 0) + imul32(skId, D2SkillsTxt_SIZE)) >>> 0
  if (esi === 0) return 0
  const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
  if ((m.u8((esi + 5) >>> 0) & m.u8((pBitMasks + 8) >>> 0)) === 0) return 0
  const ebx = pUnit >>> 0
  const unitLvl = statListGetUnitStatMem113c(m, ebx, 0x0c, 0) | 0
  const reqLvl = SKILLS_GetRequiredLevelForNextRank113c(m, ebx, skId) | 0
  if (reqLvl > unitLvl) return 0
  if ((statListGetUnitStatMem113c(m, ebx, 0, 0) | 0) < i16(m.u16((esi + 0x176) >>> 0))) return 0
  if ((statListGetUnitStatMem113c(m, ebx, 2, 0) | 0) < i16(m.u16((esi + 0x178) >>> 0))) return 0
  if ((statListGetUnitStatMem113c(m, ebx, 1, 0) | 0) < i16(m.u16((esi + 0x17a) >>> 0))) return 0
  if ((statListGetUnitStatMem113c(m, ebx, 3, 0) | 0) < i16(m.u16((esi + 0x17c) >>> 0))) return 0
  return 1
}

/**
 * `@va D2Common:0x6FDA1ED0` (`D2Common.#10483` `SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c`,
 * stdcall `pUnit`, `ret 4` -> `BOOL`).
 */
export function SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c(
  m: Memory113c,
  pUnit: number,
): number {
  const edi = pUnit >>> 0
  if (edi === 0) return 0
  if (((m.u32((edi + 0xc8) >>> 0) >>> 3) & 1) === 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  const count = i16(m.u16((sgpt + 0x180) >>> 0))
  for (let i = 0; i < count; i++) {
    const pArr = m.u32((m.u32(SGPT_DATATABLES_VA_113C) + 0x17c) >>> 0) >>> 0
    const ebx = i16(m.u16((pArr + i * 2) >>> 0))
    const uType = m.u32(edi) | 0
    if ((uType < 0 || uType > 1) && uType !== 3) continue
    const nStates = m.u32((m.u32(SGPT_DATATABLES_VA_113C) + 0xc4) >>> 0) | 0
    if (ebx < 0 || ebx >= nStates) continue
    if (STATES_CheckStateMaskOnUnitFast113c(m, edi, ebx) === 0) continue
    const esi = STATLIST_GetStatListFromUnitAndState113c(m, edi, ebx) >>> 0
    if (esi !== 0) {
      removeAndFreeSubListIfNonExtended113c(m, esi)
    }
    if (ebx < (m.u32((m.u32(SGPT_DATATABLES_VA_113C) + 0xc4) >>> 0) | 0)) {
      statesToggleStateMem113c(m, ebx, edi, 0)
      UNITROOM_RefreshUnit113c(m, edi)
    }
  }
  return 1
}

/**
 * `@va D2Common:0x6FDA0D40` (`D2Common.#10709` `SKILLS_GetWeaponMasteryPassiveStatId113c`,
 * stdcall `pUnit, pOutBonus`, `ret 8` -> `i32`).
 */
export function SKILLS_GetWeaponMasteryPassiveStatId113c(
  m: Memory113c,
  pUnit: number,
  pOutBonus: number,
): number {
  const esi = pUnit >>> 0
  if (esi === 0) return 0
  const pOut = pOutBonus >>> 0
  const tryStat = (statId: number, retId: number): number => {
    const val = statListGetUnitStatMem113c(m, esi, statId, 0) | 0
    if (val <= 0) return -1
    if (pOut !== 0) m.setU32(pOut, val >>> 0)
    return retId
  }
  if (m.u32(esi) !== 0) {
    const r0 = tryStat(0x9d, 0x1b)
    if (r0 >= 0) return r0
    const r1 = tryStat(0x9e, 0x29)
    return r1 >= 0 ? r1 : 0
  }
  const pWeap = ITEMS_GetActiveWeaponForAttack113c(m, esi, 1) >>> 0
  if (pWeap === 0) return -1
  const wClass = ITEMS_GetWeaponClassCodeIdx113c(m, pWeap) & 0xffff
  if (wClass !== 1 && wClass !== 7) return -1
  const r0 = tryStat(0x9d, 0x1b)
  if (r0 >= 0) return r0
  const r1 = tryStat(0x9e, 0x29)
  if (r1 >= 0) return r1
  return wClass === 7 ? 0x1f : 0
}

/**
 * `@va D2Common:0x6FD9FB30` (internal `SKILLS_CheckSkillLevelAndPrereqs113c`,
 * stdcall `pUnit, nSkillId`, `ret 8` -> `BOOL`).
 */
export function SKILLS_CheckSkillLevelAndPrereqs113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const skId = nSkillId | 0
  const ebp = DATATBLS_GetSkillsTxtRecordInline113c(m, skId) >>> 0
  if (ebp === 0) return 0
  const ebx = pUnit >>> 0
  const unitLvl = statListGetUnitStatMem113c(m, ebx, 0x0c, 0) | 0
  if ((SKILLS_GetRequiredLevelForNextRank113c(m, ebx, skId) | 0) > unitLvl) return 0
  for (let i = 0; i < 3; i++) {
    const reqSkId = i16(m.u16((ebp + 0x17e + i * 2) >>> 0))
    if (reqSkId >= 0) {
      const pReqTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, reqSkId) >>> 0
      if (pReqTxt === 0) return 0
      if (SKILLS_HasSkillByTxtRecord113c(m, ebx, pReqTxt) === 0) return 0
      if ((SKILLS_GetBaseSkillLevelById113c(m, ebx, reqSkId) | 0) <= 0) return 0
    }
  }
  return 1
}
export const SKILLS_CanUnitLearnSkillWithPrereqs113c = SKILLS_CheckSkillLevelAndPrereqs113c

// ============================================================================
// K1r9 Iteration 12 Lane B — Batch I12B-1 / I12B-2 remaining skills.ts functions
// ============================================================================

/**
 * `@va D2Common:0x6FDA0CE0` (`D2Common.#10639` `SKILLS_CalcUnitVelocityDivided`,
 * stdcall `pUnit`, `ret 4` -> `i32`).
 */
export function SKILLS_CalcUnitVelocityDivided113c(m: Memory113c, pUnit: number): number {
  const unit = pUnit >>> 0
  if (unit === 0 || m.get(unit, D2UnitStrc.dwUnitType) !== 0) return 0
  if (((m.u32((unit + 0xc8) >>> 0) >>> 3) & 1) === 0) return 0
  let denom = 0x13
  const pWeap = ITEMS_GetActiveWeaponForAttack113c(m, unit, 0) >>> 0
  if (pWeap !== 0) {
    denom = ITEMS_CalcWeaponAttackSpeed113c(m, unit, pWeap) | 0
    if (denom <= 0) return 0
  }
  return sdiv32((m.u32((unit + 0x48) >>> 0) & 0xffffff00) | 0, denom)
}

/**
 * `@va D2Common:0x6FDA1B60` (`SKILLS_SkillCalcVarCallback`,
 * fastcall `ecx=nVarId, edx=pCtx`, `ret` -> `i32`).
 */
export function SKILLS_SkillCalcVarCallback113c(
  m: Memory113c,
  nVarId: number,
  pCtx: number,
): number {
  const ctx = pCtx >>> 0
  if (ctx === 0) return 0
  return SKILLS_GetSkillCalcFieldById113c(
    m,
    m.u32(ctx),
    nVarId | 0,
    m.u32((ctx + 0x04) >>> 0) | 0,
    m.u32((ctx + 0x08) >>> 0) | 0,
  )
}

/**
 * `@va D2Common:0x6FDA1AB0` (`SKILLS_EvalCalcSkillFieldPair`,
 * fastcall `ecx=nSkillId, edx=nFieldId1`, stack `[nFieldId2, pCtx]`, `ret 8` -> `i32`).
 */
export function SKILLS_EvalCalcSkillFieldPair113c(
  m: Memory113c,
  nSkillId: number,
  nFieldId1: number,
  nFieldId2: number,
  pCtx: number,
): number {
  const ctx = pCtx >>> 0
  if (ctx === 0) return 0
  const pUnit = m.u32(ctx) >>> 0
  const lvl =
    SKILLS_GetSkillCalcFieldById113c(
      m,
      pUnit,
      nFieldId1 | 0,
      m.u32((ctx + 0x04) >>> 0) | 0,
      m.u32((ctx + 0x08) >>> 0) | 0,
    ) | 0
  return SKILLS_GetSkillCalcFieldById113c(m, pUnit, nFieldId2 | 0, nSkillId | 0, lvl)
}

function getUnitSkillEffectiveLevelClamped113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const unit = pUnit >>> 0
  if (unit === 0) return 0
  const pSk = SKILLS_GetHighestLevelSkillFromUnitAndId113c(m, unit, nSkillId | 0) >>> 0
  if (pSk === 0) return 0
  let lvl = m.u32((pSk + 0x28) >>> 0) | 0
  if ((m.u32((pSk + 0x34) >>> 0) | 0) === -1) {
    lvl = (lvl + SKILLS_GetSkillBonusLevel113c(m, pSk, unit)) | 0
  }
  const maxLvl = m.u32(m.u32(SGPT_EXPERIENCE_TXT_PTR_VA_113C) >>> 0) | 0
  if (lvl <= 0) lvl = 0
  return lvl < maxLvl ? lvl : maxLvl
}

/**
 * `@va D2Common:0x6FDA1AF0` (`SKILLS_EvalCalcUnitSkillFieldByCtx`,
 * fastcall `ecx=nSkillId, edx=nFieldId`, stack `[_unused, pCtx]`, `ret 8` -> `i32`).
 */
export function SKILLS_EvalCalcUnitSkillFieldByCtx113c(
  m: Memory113c,
  nSkillId: number,
  nFieldId: number,
  _unused: number,
  pCtx: number,
): number {
  const ctx = pCtx >>> 0
  if (ctx === 0) return 0
  const pUnit = m.u32(ctx) >>> 0
  const lvl = getUnitSkillEffectiveLevelClamped113c(m, pUnit, nSkillId | 0)
  return SKILLS_GetSkillCalcFieldById113c(m, pUnit, nFieldId | 0, nSkillId | 0, lvl)
}

/**
 * `@va D2Common:0x6FDBB430` (`MISSILE_EvalCalcOwnerSkillFieldByCtx`,
 * fastcall `ecx=nSkillId, edx=nFieldId`, stack `[_unused, pCtx]`, `ret 8` -> `i32`).
 */
export function MISSILE_EvalCalcOwnerSkillFieldByCtx113c(
  m: Memory113c,
  nSkillId: number,
  nFieldId: number,
  _unused: number,
  pCtx: number,
): number {
  const ctx = pCtx >>> 0
  if (ctx === 0) return 0
  const pOwner = m.u32((ctx + 0x04) >>> 0) >>> 0
  const lvl = getUnitSkillEffectiveLevelClamped113c(m, pOwner, nSkillId | 0)
  return SKILLS_GetSkillCalcFieldById113c(m, pOwner, nFieldId | 0, nSkillId | 0, lvl)
}

/**
 * `@va D2Common:0x6FDA1000` (`D2Common.#10002` `SKILLS_GetSkillNumTargetsOrShots`,
 * stdcall `pUnit, pSkill`, `ret 8` -> `i32`).
 */
export function SKILLS_GetSkillNumTargetsOrShots113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
): number {
  const sk = pSkill >>> 0
  if (sk === 0) return 0
  const pSkTxt = m.u32(sk) >>> 0
  if (pSkTxt === 0) return 0
  const elem = (m.u8((pSkTxt + 0x14) >>> 0) << 24) >> 24
  if (elem !== 3) return elem
  const unit = pUnit >>> 0
  const nShots = COMPOSIT_IsUnitUsingBowOrCrossbow113c(m, unit) !== 0 ? 2 : 1
  if (unit !== 0 && m.get(unit, D2UnitStrc.dwUnitType) === 0 && nShots !== 1) {
    const dt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
    const maskWords = m.u32((dt + 0x164) >>> 0) >>> 0
    if (STATES_CheckStateMaskOnUnit113c(m, unit, maskWords) !== 0) {
      return 1
    }
  }
  return nShots
}

function isWeaponStatListActiveOnOwner113c(m: Memory113c, pItem: number): boolean {
  const item = pItem >>> 0
  if (item === 0) return false
  if (ITEMS_CheckItemTypeIdMem113c(m, item, 0x2d) === 0) return false
  if (checkNotBrokenOrUnequippingMem113c(m, item) === 0) return false
  const pEx = m.get(item, D2UnitStrc.pStatListEx) >>> 0
  if (pEx === 0) return false
  const pList = m.u32((pEx + 0x34) >>> 0) >>> 0
  if (pList === 0) return false
  if ((m.u32((pList + 0x10) >>> 0) & 0x80000000) === 0) return false
  return m.u32((pList + 0x44) >>> 0) !== 0
}

function getItemStrBonusInline113c(m: Memory113c, pItem: number): number {
  const item = pItem >>> 0
  if (item === 0 || m.get(item, D2UnitStrc.dwUnitType) !== 4) return 100
  const pTxt = lookupItemsTxtRecord113c(m, m.get(item, D2UnitStrc.dwClassId)) >>> 0
  if (pTxt === 0) return 100
  const v = i16(m.u16((pTxt + 0x106) >>> 0))
  return v === 1 ? 100 : v
}

function getItemDexBonusInline113c(m: Memory113c, pItem: number): number {
  const item = pItem >>> 0
  if (item === 0 || m.get(item, D2UnitStrc.dwUnitType) !== 4) return 100
  const pTxt = lookupItemsTxtRecord113c(m, m.get(item, D2UnitStrc.dwClassId)) >>> 0
  if (pTxt === 0) return 100
  const v = i16(m.u16((pTxt + 0x108) >>> 0))
  return v === 1 ? 100 : v
}

/**
 * `@va D2Common:0x6FDA1C60` (`D2Common.#10323` `SKILLS_CalcKickBootDamage`,
 * stdcall `pUnit, pOutMin, pOutMax, pOutPct`, `ret 0x10`, void).
 */
export function SKILLS_CalcKickBootDamage113c(
  m: Memory113c,
  pUnit: number,
  pOutMin: number,
  pOutMax: number,
  pOutPct: number,
): void {
  const unit = pUnit >>> 0
  if (unit === 0) return
  let kickPct = 0
  const pStatListEx = m.get(unit, D2UnitStrc.pStatListEx) >>> 0
  if (pStatListEx !== 0) {
    const dt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
    const iscCount = m.u32((dt + DATATABLES_ISC_COUNT_OFF_113C) >>> 0) | 0
    const pIsc =
      iscCount > 0x89 ? (m.u32((dt + DATATABLES_ISC_TXT_OFF_113C) >>> 0) + 0xad64) >>> 0 : 0
    if (pIsc !== 0) {
      kickPct = statListGetTotalStatWithMinMem113c(m, pStatListEx, 0x890000, pIsc) | 0
    }
  }
  const outMin = pOutMin >>> 0
  const outMax = pOutMax >>> 0
  const outPct = pOutPct >>> 0
  m.setU32(outMin, (m.u32(outMin) + kickPct) >>> 0)
  m.setU32(outMax, (m.u32(outMax) + kickPct) >>> 0)

  const inv = m.get(unit, D2UnitStrc.pInventory) >>> 0
  if (inv === 0) return

  let pMain = INVENTORY_GetCompositWeaponMem113c(m, inv) >>> 0
  let pOther = 0
  if (pMain !== 0) {
    let bodyLoc = 0
    if (m.get(pMain, D2UnitStrc.dwUnitType) === 4) {
      const pData = m.get(pMain, D2UnitStrc.pUnitData) >>> 0
      if (pData !== 0) bodyLoc = m.u8((pData + 0x44) >>> 0)
    }
    const otherSlot = bodyLoc === 4 ? 5 : 4
    const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, BODY_GRID_DEF_VA_113C) >>> 0
    if (pGrid0 !== 0) {
      const ppItems = m.u32((pGrid0 + D2InventoryGridStrc.ppItems.off) >>> 0) >>> 0
      if (ppItems !== 0) {
        pOther = m.u32((ppItems + otherSlot * 4) >>> 0) >>> 0
      }
    }
  }

  if (isWeaponStatListActiveOnOwner113c(m, pMain)) {
    STATLIST_SetWeaponStatListActive113c(m, unit, pMain, 0)
  } else {
    pMain = 0
  }

  if (pOther !== 0 && pOther !== pMain && isWeaponStatListActiveOnOwner113c(m, pOther)) {
    STATLIST_SetWeaponStatListActive113c(m, unit, pOther, 0)
  }

  if (m.get(inv, D2InventoryStrc.dwSignature) === 0x01020304) {
    const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, BODY_GRID_DEF_VA_113C) >>> 0
    if (pGrid0 !== 0) {
      const ppItems = m.u32((pGrid0 + D2InventoryGridStrc.ppItems.off) >>> 0) >>> 0
      const pBoots = ppItems !== 0 ? m.u32((ppItems + 0x24) >>> 0) >>> 0 : 0
      if (pBoots !== 0 && m.get(pBoots, D2UnitStrc.dwUnitType) === 4) {
        const pBootsTxt = lookupItemsTxtRecord113c(m, m.get(pBoots, D2UnitStrc.dwClassId)) >>> 0
        if (pBootsTxt !== 0) {
          const kickMin = (m.u8((pBootsTxt + 0xfe) >>> 0) + kickPct) | 0
          let kickMax = (m.u8((pBootsTxt + 0xff) >>> 0) + kickPct) | 0
          let bonusPct = 0
          const strBonus = getItemStrBonusInline113c(m, pBoots) | 0
          if (strBonus !== 0) {
            const strVal = statListGetUnitStatMem113c(m, unit, 0, 0) | 0
            bonusPct = mulDiv113c(strBonus, strVal, 100) | 0
          }
          const dexBonus = getItemDexBonusInline113c(m, pBoots) | 0
          if (dexBonus !== 0) {
            const dexVal = statListGetUnitStatMem113c(m, unit, 2, 0) | 0
            bonusPct = (bonusPct + mulDiv113c(dexBonus, dexVal, 100)) | 0
          }
          bonusPct = (bonusPct + (statListGetUnitStatMem113c(m, unit, 0x19, 0) | 0)) | 0
          if (bonusPct <= -90) bonusPct = -90
          const skillPct = statListGetUnitStatMem113c(m, unit, 0x11, 0) | 0
          if (kickMin >= kickMax) kickMax = kickMin
          m.setU32(outPct, (m.u32(outPct) + ((skillPct + bonusPct) | 0)) >>> 0)
          m.setU32(outMin, (m.u32(outMin) + kickMin) >>> 0)
          m.setU32(outMax, (m.u32(outMax) + kickMax) >>> 0)
        }
      }
    }
  }

  if (pMain !== 0) {
    STATLIST_SetWeaponStatListActive113c(m, unit, pMain, 1)
  }
}

/**
 * `@va D2Common:0x6FDA1FF0` (`D2Common.#10297` `SKILLS_GetSkillPhysMaxDamage`,
 * stdcall `pUnit, nSkillId, nLevel, bIncludeSrcDmg`, `ret 0x10` -> `i32`).
 */
export function SKILLS_GetSkillPhysMaxDamage113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
  bIncludeSrcDmg: number,
): number {
  const skId = nSkillId | 0
  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, skId) >>> 0
  if (pSkTxt === 0) return 2
  const unit = pUnit >>> 0
  const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
  if ((m.u8((pSkTxt + 0x05) >>> 0) & m.u8((pBitMasks + 0x04) >>> 0)) !== 0) {
    return SKILLS_GetBasePhysDamageMinOrMax113c(m, unit, 0) | 0
  }
  const lvl = nLevel | 0
  let basePart = 0
  const srcDmg = m.u8((pSkTxt + 0x1a5) >>> 0)
  if (srcDmg !== 0 && (bIncludeSrcDmg | 0) !== 0) {
    const pWeap = ITEMS_GetActiveWeaponForAttack113c(m, unit, 0) >>> 0
    let wMax = 0
    if (
      pWeap !== 0 &&
      INVENTORY_GetEquippedWeaponHandClass113c(m, unit, m.get(unit, D2UnitStrc.pInventory)) === 2
    ) {
      wMax = STATLIST_GetUnitMaxDamage113c(m, pWeap, 0x18) | 0
    } else {
      wMax = statListGetUnitStatMem113c(m, unit, 0x16, 0) | 0
    }
    basePart = Math.trunc(imul32(srcDmg, wMax) / 128) | 0
  }
  let val =
    (basePart +
      (SKILLS_Calc5BandLinear113c(m, lvl, (pSkTxt + 0x1c4) >>> 0) | 0) +
      (m.u32((pSkTxt + 0x1ac) >>> 0) | 0)) |
    0
  const calcOff = m.u32((pSkTxt + 0x1d8) >>> 0) >>> 0
  if (calcOff !== 0xffffffff) {
    const pct = SKILLS_EvalCalcByOffset113c(m, unit, calcOff, skId, lvl) | 0
    if (pct !== 0) {
      val = (val + mulDiv113c(pct, val, 100)) | 0
    }
  }
  return (val << (m.u8((pSkTxt + 0x1a4) >>> 0) & 31)) | 0
}

/**
 * `@va D2Common:0x6FDA2100` (`D2Common.#10567` `SKILLS_GetSkillPhysMinDamage`,
 * stdcall `pUnit, nSkillId, nLevel, bIncludeSrcDmg`, `ret 0x10` -> `i32`).
 */
export function SKILLS_GetSkillPhysMinDamage113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
  bIncludeSrcDmg: number,
): number {
  const skId = nSkillId | 0
  const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, skId) >>> 0
  if (pSkTxt === 0) return 1
  const unit = pUnit >>> 0
  const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
  if ((m.u8((pSkTxt + 0x05) >>> 0) & m.u8((pBitMasks + 0x04) >>> 0)) !== 0) {
    return SKILLS_GetBasePhysDamageMinOrMax113c(m, unit, 1) | 0
  }
  const lvl = nLevel | 0
  let basePart = 0
  const srcDmg = m.u8((pSkTxt + 0x1a5) >>> 0)
  if (srcDmg !== 0 && (bIncludeSrcDmg | 0) !== 0) {
    const pWeap = ITEMS_GetActiveWeaponForAttack113c(m, unit, 0) >>> 0
    let wMin = 0
    if (
      pWeap !== 0 &&
      INVENTORY_GetEquippedWeaponHandClass113c(m, unit, m.get(unit, D2UnitStrc.pInventory)) === 2
    ) {
      wMin = STATLIST_GetUnitMinDamage113c(m, pWeap, 1) | 0
    } else {
      wMin = statListGetUnitStatMem113c(m, unit, 0x15, 0) | 0
    }
    basePart = Math.trunc(imul32(srcDmg, wMin) / 128) | 0
  }
  let val =
    (basePart +
      (SKILLS_Calc5BandLinear113c(m, lvl, (pSkTxt + 0x1b0) >>> 0) | 0) +
      (m.u32((pSkTxt + 0x1a8) >>> 0) | 0)) |
    0
  const calcOff = m.u32((pSkTxt + 0x1d8) >>> 0) >>> 0
  if (calcOff !== 0xffffffff) {
    const pct = SKILLS_EvalCalcByOffset113c(m, unit, calcOff, skId, lvl) | 0
    if (pct !== 0) {
      val = (val + mulDiv113c(pct, val, 100)) | 0
    }
  }
  return (val << (m.u8((pSkTxt + 0x1a4) >>> 0) & 31)) | 0
}

/**
 * `@va D2Common:0x6FDA2210` (`SKILLS_IsSkillBlockedByState`,
 * custom reg `eax=pUnit`, stack `[pSkill]`, `ret 4` -> `0 | 1`).
 */
export function SKILLS_IsSkillBlockedByState113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
): number {
  const unit = pUnit >>> 0
  if (unit === 0 || m.get(unit, D2UnitStrc.dwUnitType) !== 0) return 1
  const dt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  if ((m.u32((dt + 0xc4) >>> 0) | 0) <= 0x79) return 1
  if (STATES_CheckStateMaskOnUnitFast113c(m, unit, 0x79) === 0) return 1
  const sk = pSkill >>> 0
  if (sk === 0) return 1
  const pSkTxt = m.u32(sk) >>> 0
  if (pSkTxt === 0) return 1
  let lvl = m.u32((sk + 0x28) >>> 0) | 0
  if ((m.u32((sk + 0x34) >>> 0) | 0) === -1) {
    lvl = (lvl + SKILLS_GetSkillBonusLevel113c(m, sk, unit)) | 0
  }
  const maxLvl = m.u32(m.u32(SGPT_EXPERIENCE_TXT_PTR_VA_113C) >>> 0) | 0
  if (lvl <= 0) lvl = 0
  if (lvl >= maxLvl) lvl = maxLvl
  const skId = i16(m.u16(pSkTxt))
  const calcOff = m.u32((pSkTxt + 0x190) >>> 0) >>> 0
  const val = SKILLS_EvalCalcByOffset113c(m, unit, calcOff, skId, lvl) | 0
  return val <= 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FDA2340` (`D2Common.#10787` `SKILLS_GetSkillUseFailReason`,
 * stdcall `pUnit, pSkill`, `ret 8` -> `i32`).
 */
export function SKILLS_GetSkillUseFailReason113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
): number {
  const sk = pSkill >>> 0
  if (sk === 0) throw new D2CommonAssertError('Skills.cpp', 0x8ea)
  const pSkTxt = m.u32(sk) >>> 0
  const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
  if (pSkTxt === 0 || (m.u8((pSkTxt + 0x05) >>> 0) & m.u8((pBitMasks + 0x08) >>> 0)) === 0) {
    return 3
  }
  const unit = pUnit >>> 0
  if (unit === 0) return 7
  let lvl = m.u32((sk + 0x28) >>> 0) | 0
  if ((m.u32((sk + 0x34) >>> 0) | 0) === -1) {
    lvl = (lvl + SKILLS_GetSkillBonusLevel113c(m, sk, unit)) | 0
  }
  const maxLvl = m.u32(m.u32(SGPT_EXPERIENCE_TXT_PTR_VA_113C) >>> 0) | 0
  if (lvl <= 0) lvl = 0
  if (lvl >= maxLvl) lvl = maxLvl
  if (lvl === 0) return 7

  const flagByte0 = m.u8((pSkTxt + 0x04) >>> 0)
  if ((flagByte0 & m.u32((pBitMasks + 0x14) >>> 0)) !== 0) return 6
  if ((flagByte0 & m.u32((pBitMasks + 0x10) >>> 0)) !== 0) return 5
  if (SKILLS_CheckSkillWeaponAndQuantity113c(m, sk, unit) === 0) return 2
  if (SKILLS_CheckUnitEquippedWeaponsMatchSkill113c(m, sk, unit) === 0) return 2
  if (SKILLS_CheckSkillManaOrCharges113c(m, sk, unit) === 0) return 1
  if (SKILLS_CheckSkillStateRestriction113c(m, sk, unit) === 0) return 4
  if (SKILLS_CheckSkillStartMana113c(m, unit, sk) === 0) return 1
  if (SKILLS_CheckItemChargedSkillHasCharges113c(m, unit, sk) === 0) return 2
  return SKILLS_IsSkillBlockedByState113c(m, unit, sk) !== 0 ? 0 : 8
}

const SKILLS_STACK_BASE = 0x7ff70000
const SKILLS_STACK_SIZE = 0x40
const _skillsStackBuf = new ArrayBuffer(SKILLS_STACK_SIZE)
const _skillsStackU8 = new Uint8Array(_skillsStackBuf)
const _skillsStackDV = new DataView(_skillsStackBuf)

function withSkillsStackScratch113c(m: Memory113c): Memory113c {
  const isStack = (p: number): boolean => {
    const u = p >>> 0
    return u >= SKILLS_STACK_BASE && u < SKILLS_STACK_BASE + SKILLS_STACK_SIZE
  }
  const mExt = m as Memory113c & {
    free?: (p: number) => void
    realloc?: (p: number, sz: number) => number
  }
  const self: Memory113c & {
    free?: ((p: number) => void) | undefined
    realloc?: ((p: number, sz: number) => number) | undefined
  } = {
    alloc: size => m.alloc(size),
    free: p => mExt.free?.(p),
    realloc: mExt.realloc ? (p, sz) => mExt.realloc!(p, sz) : undefined,
    u8: p => (isStack(p) ? _skillsStackU8[(p >>> 0) - SKILLS_STACK_BASE]! : m.u8(p)),
    u16: p => (isStack(p) ? _skillsStackDV.getUint16((p >>> 0) - SKILLS_STACK_BASE, true) : m.u16(p)),
    u32: p => (isStack(p) ? _skillsStackDV.getUint32((p >>> 0) - SKILLS_STACK_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isStack(p)) _skillsStackU8[(p >>> 0) - SKILLS_STACK_BASE] = v & 0xff
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isStack(p)) _skillsStackDV.setUint16((p >>> 0) - SKILLS_STACK_BASE, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isStack(p)) _skillsStackDV.setUint32((p >>> 0) - SKILLS_STACK_BASE, v >>> 0, true)
      else m.setU32(p, v)
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const addr = ((base >>> 0) + f.off + idx * width) >>> 0
      return width === 1 ? self.u8(addr) : width === 2 ? self.u16(addr) : self.u32(addr)
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const addr = ((base >>> 0) + f.off + idx * width) >>> 0
      if (width === 1) self.setU8(addr, v)
      else if (width === 2) self.setU16(addr, v)
      else self.setU32(addr, v)
    },
    fill: (p, len, v) => {
      if (isStack(p)) {
        const off = (p >>> 0) - SKILLS_STACK_BASE
        _skillsStackU8.fill(v & 0xff, off, off + len)
      } else {
        m.fill(p, len, v)
      }
    },
  }
  return self
}

function getUnitPosXY113c(m: Memory113c, u: number): [number, number] {
  const uType = m.u32(u) >>> 0
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return [m.u32((pPath + 0x0c) >>> 0) | 0, m.u32((pPath + 0x10) >>> 0) | 0]
  }
  if (pPath === 0) return [0, 0]
  return [m.u16((pPath + 0x02) >>> 0), m.u16((pPath + 0x06) >>> 0)]
}

/**
 * `@va D2Common:0x6FDA1870` (`D2Common.#10566` `SKILLS_FindMeleeTargetPosition113c`,
 * `__stdcall(pUnit, pTarget, pOutX, pOutY) -> bSuccess`, `ret 0x10`).
 */
export function SKILLS_FindMeleeTargetPosition113c(
  m: Memory113c,
  pUnit: number,
  pTarget: number,
  pOutX: number,
  pOutY: number,
): number {
  const unit = pUnit >>> 0
  const target = pTarget >>> 0
  if (target !== 0 && UNITS_CanUnitMeleeAttackTarget113c(m, unit, target, 0) !== 0) {
    return 0
  }
  const [unitX, unitY] = getUnitPosXY113c(m, unit)
  let tgtX: number
  let tgtY: number
  if (target !== 0) {
    ;[tgtX, tgtY] = getUnitPosXY113c(m, target)
  } else {
    const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
    tgtX = m.u16((pPath + 0x10) >>> 0)
    tgtY = m.u16((pPath + 0x12) >>> 0)
  }
  const dist = UNITS_GetUnitDistanceToCoordinates113c(m, unit, tgtX, tgtY) | 0
  if (dist === 0) return 0

  let outX = (tgtX + sdiv32(((tgtX - unitX) | 0) << 1, dist)) | 0
  let outY = (tgtY + sdiv32(((tgtY - unitY) | 0) << 1, dist)) | 0
  let pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  if (pRoom === 0) {
    throw new D2CommonAssertError('', 4287)
  }
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  const nPat = m.u32((pPath + 0x48) >>> 0) >>> 0
  if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, outX, outY, nPat, 0x1c09) !== 0) {
    const sm = withSkillsStackScratch113c(m)
    const pt = SKILLS_STACK_BASE
    sm.setU32(pt, tgtX | 0)
    sm.setU32((pt + 4) >>> 0, tgtY | 0)
    const nSize = UNITS_GetUnitSizeX113c(m, unit) | 0
    pRoom = COLLISION_FindFreePosition113c(
      sm,
      pRoom,
      pt,
      0,
      nSize,
      0x1c09,
      0x1c09,
      0,
      0x32,
      1,
    ) >>> 0
    if (pRoom === 0) return 0
    outX = sm.u32(pt) | 0
    outY = sm.u32((pt + 4) >>> 0) | 0
  }
  const [srcX, srcY] = getUnitPosXY113c(m, unit)
  if (SKILLS_CheckLineOfSight113c(m, srcX, srcY, outX, outY, pRoom, 0x804) === 0) {
    return 0
  }
  m.setU32(pOutX >>> 0, outX | 0)
  m.setU32(pOutY >>> 0, outY | 0)
  return SKILLS_IsUnitPosNotInTown113c(m, unit, outX, outY) !== 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FDA2660` (`D2Common.#10008` `SKILLS_AddSkillToUnit113c`,
 * `__stdcall(pUnit, nSkillId) -> pSkill`, `ret 0x8`).
 */
export function SKILLS_AddSkillToUnit113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
): number {
  const unit = pUnit >>> 0
  if (unit === 0) return 0
  const skId = nSkillId | 0
  if (skId < 0) return 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  const nSkillsCount = m.u32((sgpt + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0
  if (skId >= nSkillsCount) return 0
  const pSkillsBase = m.u32((sgpt + DATATABLES_SKILLS_TXT_OFF_113C) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(skId, D2SkillsTxt_SIZE)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nPassiveState = SKILLS_GetPassiveState113c(m, skId) | 0
  const nStatesCount = m.u32((sgpt + 0xc4) >>> 0) | 0
  if (nPassiveState > 0 && nPassiveState < nStatesCount) {
    const pStatListEx = m.u32((unit + 0x5c) >>> 0) >>> 0
    if (pStatListEx !== 0 && (m.u32((pStatListEx + 0x10) >>> 0) | 0) < 0) {
      const pStateFlags = m.u32((pStatListEx + 0x58) >>> 0) >>> 0
      const pBitMasks = m.u32(GDW_BITMASKS_IAT_VA_113C) >>> 0
      const wordIdx = nPassiveState >> 5
      const bitMask = m.u32((pBitMasks + ((nPassiveState & 0x1f) << 2)) >>> 0) >>> 0
      const curFlags = m.u32((pStateFlags + (wordIdx << 2)) >>> 0) >>> 0
      m.setU32((pStateFlags + (wordIdx << 2)) >>> 0, (curFlags | bitMask) >>> 0)
      if ((curFlags & bitMask) === 0) {
        const nWords = ((nStatesCount + 0x1f) >> 5) | 0
        const gfxOff = ((nWords + wordIdx) << 2) >>> 0
        m.setU32((pStateFlags + gfxOff) >>> 0, (m.u32((pStateFlags + gfxOff) >>> 0) | bitMask) >>> 0)
        const pStTxt = DATATBLS_GetStatesTxtRecordInline113c(m, nPassiveState) >>> 0
        if (pStTxt !== 0 && (m.u8((pStTxt + 0x12) >>> 0) & m.u8(pBitMasks)) !== 0) {
          m.setU32((unit + 0xc8) >>> 0, (m.u32((unit + 0xc8) >>> 0) | 0x08) >>> 0)
        }
      }
    }
    UNITROOM_RefreshUnit113c(m, unit)
  }

  const pSkillList = m.u32((unit + 0xa8) >>> 0) >>> 0
  let sk = pSkillList !== 0 ? (m.u32((pSkillList + 0x04) >>> 0) >>> 0) : 0
  while (sk !== 0) {
    if ((m.u32(sk) >>> 0) === pSkillsTxt && (m.u32((sk + 0x34) >>> 0) | 0) === -1) {
      let lvl = m.u32((sk + 0x28) >>> 0) | 0
      if (lvl < DATATBLS_GetSkillsTxtMaxLvlInline113c(m, skId) || (m.u32(unit) >>> 0) === 1) {
        lvl = (lvl + 1) | 0
        m.setU32((sk + 0x28) >>> 0, lvl | 0)
      }
      STATES_ApplyMonSkillIconToUnit113c(m, unit, skId)
      return sk
    }
    sk = m.u32((sk + 0x04) >>> 0) >>> 0
  }

  if (pSkillList === 0) return 0
  const newSk = m.alloc(0x40) >>> 0
  m.setU32(newSk, pSkillsTxt)
  const uType = m.u32(unit) >>> 0
  if (uType === 1) {
    m.setU32((newSk + 0x08) >>> 0, ((m.u8((pSkillsTxt + 0x11) >>> 0) << 24) >> 24) | 0)
  } else if (uType === 0 && (m.u32((unit + 0x04) >>> 0) >>> 0) === 6 && skId === 5) {
    m.setU32((newSk + 0x08) >>> 0, 0x10)
  } else {
    m.setU32((newSk + 0x08) >>> 0, ((m.u8((pSkillsTxt + 0x10) >>> 0) << 24) >> 24) | 0)
  }
  m.setU32((newSk + 0x28) >>> 0, 1)
  m.setU32((newSk + 0x34) >>> 0, 0xffffffff)
  m.setU32((newSk + 0x04) >>> 0, 0)

  let tail = m.u32((pSkillList + 0x04) >>> 0) >>> 0
  if (tail !== 0) {
    while ((m.u32((tail + 0x04) >>> 0) >>> 0) !== 0) {
      tail = m.u32((tail + 0x04) >>> 0) >>> 0
    }
    m.setU32((tail + 0x04) >>> 0, newSk)
  } else {
    m.setU32((pSkillList + 0x04) >>> 0, newSk)
  }
  STATES_ApplyMonSkillIconToUnit113c(m, unit, skId)
  return newSk
}

/**
 * `@va D2Common:0x6FDA28B0` (`SKILLS_RemoveOrDecrementSkillFromUnit113c`,
 * `__usercall(pUnit@<ebx>, nSkillId@<stack+4>, bDecrement@<stack+8>) -> void`, `ret 0x8`).
 */
export function SKILLS_RemoveOrDecrementSkillFromUnit113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  bDecrement: number,
): void {
  const unit = pUnit >>> 0
  if (unit === 0) return
  const pSkillList = m.u32((unit + 0xa8) >>> 0) >>> 0
  if (pSkillList === 0) return
  let sk = m.u32((pSkillList + 0x04) >>> 0) >>> 0
  if (sk === 0) return

  const skId = nSkillId | 0
  const nPassiveState = SKILLS_GetPassiveState113c(m, skId) | 0
  if (nPassiveState !== 0) {
    STATES_ToggleGfxStateFlag113c(m, unit, nPassiveState, 0)
  }

  const pLeft = m.u32((pSkillList + 0x08) >>> 0) >>> 0
  if (pLeft !== 0) {
    const leftId = (m.u16(m.u32(pLeft) >>> 0) << 16) >> 16
    if (skId === leftId && (m.u32((pLeft + 0x34) >>> 0) | 0) === -1) {
      SKILLS_SetLeftSkill113c(m, unit, 0, -1)
    }
  }
  const pRight = m.u32((pSkillList + 0x0c) >>> 0) >>> 0
  if (pRight !== 0) {
    const rightId = (m.u16(m.u32(pRight) >>> 0) << 16) >> 16
    if (skId === rightId && (m.u32((pRight + 0x34) >>> 0) | 0) === -1) {
      SKILLS_SetRightSkill113c(m, unit, 0, -1)
    }
  }
  const pUsed = m.u32((pSkillList + 0x10) >>> 0) >>> 0
  if (pUsed !== 0) {
    const usedId = (m.u16(m.u32(pUsed) >>> 0) << 16) >> 16
    if (skId === usedId && (m.u32((pUsed + 0x34) >>> 0) | 0) === -1) {
      m.setU32((pSkillList + 0x10) >>> 0, 0)
    }
  }

  let prev = 0
  while (sk !== 0) {
    const curId = (m.u16(m.u32(sk) >>> 0) << 16) >> 16
    if (curId === skId && (m.u32((sk + 0x34) >>> 0) | 0) === -1) {
      if ((bDecrement | 0) !== 0) {
        const newLvl = ((m.u32((sk + 0x28) >>> 0) | 0) - 1) | 0
        m.setU32((sk + 0x28) >>> 0, newLvl | 0)
        if (newLvl > 0) {
          STATES_ApplyMonSkillIconToUnit113c(m, unit, skId)
          return
        }
      }
      const next = m.u32((sk + 0x04) >>> 0) >>> 0
      if (prev !== 0) {
        m.setU32((prev + 0x04) >>> 0, next)
      } else {
        m.setU32((pSkillList + 0x04) >>> 0, next)
      }
      void m.u32((unit + 0x08) >>> 0)
      ;(m as { free?: (p: number) => void }).free?.(sk)
      break
    }
    prev = sk
    sk = m.u32((sk + 0x04) >>> 0) >>> 0
  }
  STATES_ApplyMonSkillIconToUnit113c(m, unit, skId)
}

/**
 * `@va D2Common:0x6FDA29E0` (`D2Common.#10506` `SKILLS_InitCharStartSkills113c`,
 * `__stdcall(pUnit) -> void`, `ret 0x4`).
 */
export function SKILLS_InitCharStartSkills113c(m: Memory113c, pUnit: number): void {
  const unit = pUnit >>> 0
  let pSkillList = m.u32((unit + 0xa8) >>> 0) >>> 0
  let hasAttack = false
  if (pSkillList !== 0) {
    let sk = m.u32((pSkillList + 0x04) >>> 0) >>> 0
    while (sk !== 0) {
      if (((m.u16(m.u32(sk) >>> 0) << 16) >> 16) === 0 && (m.u32((sk + 0x34) >>> 0) | 0) === -1) {
        hasAttack = true
        break
      }
      sk = m.u32((sk + 0x04) >>> 0) >>> 0
    }
  }
  if (!hasAttack) {
    const classId = m.u32((unit + 0x04) >>> 0) | 0
    const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
    if (classId < 0 || classId >= (m.u32((sgpt + 0xbc8) >>> 0) | 0)) return
    const pCharBase = m.u32((sgpt + 0xbc4) >>> 0) >>> 0
    const pCharStats = (pCharBase + imul32(classId, 0xc4)) >>> 0
    if (pCharStats === 0) return
    SKILLS_AddSkillToUnit113c(m, unit, 0)
    const nSkillsCount = m.u32((sgpt + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0
    for (let i = 0; i < 10; i++) {
      const startSk = (m.u16((pCharStats + 0xae + i * 2) >>> 0) << 16) >> 16
      if (startSk >= 0 && startSk < nSkillsCount) {
        SKILLS_AddSkillToUnit113c(m, unit, startSk)
      }
    }
  }

  pSkillList = m.u32((unit + 0xa8) >>> 0) >>> 0
  if (pSkillList === 0) {
    throw new D2CommonAssertError('', 1002)
  }
  if ((m.u32((pSkillList + 0x08) >>> 0) >>> 0) === 0) {
    SKILLS_SetLeftSkill113c(m, unit, 0, -1)
  }
  pSkillList = m.u32((unit + 0xa8) >>> 0) >>> 0
  if (pSkillList === 0) {
    throw new D2CommonAssertError('', 1039)
  }
  if ((m.u32((pSkillList + 0x0c) >>> 0) >>> 0) === 0) {
    SKILLS_SetRightSkill113c(m, unit, 0, -1)
  }
}

/**
 * `@va D2Common:0x6FDA2AE0` (`D2Common.#10418` `SKILLS_RefreshPassiveAuraSkills113c`,
 * `__stdcall(pUnit) -> void`, `ret 0x4`).
 */
export function SKILLS_RefreshPassiveAuraSkills113c(m: Memory113c, pUnit: number): void {
  const unit = pUnit >>> 0
  const sgpt = m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  const nAuraCount = m.u32((sgpt + 0xbb0) >>> 0) | 0
  for (let i = 0; i < nAuraCount; i++) {
    const skId =
      i >= 0 && i < (m.u32((sgpt + 0xbb0) >>> 0) | 0)
        ? ((m.u16((m.u32((sgpt + 0xbb4) >>> 0) + i * 2) >>> 0) << 16) >> 16)
        : -1
    if (skId < 0 || skId >= (m.u32((sgpt + DATATABLES_SKILLS_COUNT_OFF_113C) >>> 0) | 0)) continue
    const pSkTxt = (m.u32((sgpt + DATATABLES_SKILLS_TXT_OFF_113C) >>> 0) + imul32(skId, D2SkillsTxt_SIZE)) >>> 0
    if (pSkTxt === 0) continue
    const wAuraState = (m.u16((pSkTxt + 0x94) >>> 0) << 16) >> 16
    if (wAuraState <= 0) continue
    if (SKILLS_GetHighestLevelSkillFromUnitAndId113c(m, unit, skId) === 0) continue
    if (unit !== 0) {
      const uType = m.u32(unit) | 0
      if ((uType >= 0 && uType <= 1) || uType === 3) {
        if (wAuraState >= 0 && wAuraState < (m.u32((sgpt + 0xc4) >>> 0) | 0)) {
          if (STATES_CheckStateMaskOnUnitFast113c(m, unit, wAuraState) !== 0) {
            STATES_ApplyMonSkillIconToUnit113c(m, unit, skId)
          }
        }
      }
    }
  }
}

/**
 * `@va D2Common:0x6FDA2BC0` (`D2Common.#10302` `SKILLS_SetSkillLevelOnUnit113c`,
 * `__stdcall(pUnit, nSkillId, nLvl, bRemZero, u5, u6) -> void`, `ret 0x18`).
 */
export function SKILLS_SetSkillLevelOnUnit113c(
  m: Memory113c,
  pUnit: number,
  nSkillId: number,
  nLvl: number,
  bRemZero: number,
  _u5: number,
  _u6: number,
): void {
  const unit = pUnit >>> 0
  const skId = nSkillId | 0
  const lvl = nLvl | 0
  if (lvl === 0) {
    if ((bRemZero | 0) !== 0) {
      SKILLS_RemoveOrDecrementSkillFromUnit113c(m, unit, skId, 0)
      STATES_ApplyMonSkillIconToUnit113c(m, unit, skId)
      return
    }
    let sk = SKILLS_GetSkillById113c(m, unit, skId, -1) >>> 0
    if (sk === 0) {
      SKILLS_AddSkillToUnit113c(m, unit, skId)
      sk = SKILLS_GetSkillById113c(m, unit, skId, -1) >>> 0
      if (sk === 0) return
    }
    m.setU32((sk + 0x28) >>> 0, 0)
    STATES_ApplyMonSkillIconToUnit113c(m, unit, skId)
    return
  }

  const pSkillList = m.u32((unit + 0xa8) >>> 0) >>> 0
  let sk = pSkillList !== 0 ? (m.u32((pSkillList + 0x04) >>> 0) >>> 0) : 0
  while (sk !== 0) {
    if (((m.u16(m.u32(sk) >>> 0) << 16) >> 16) === skId && (m.u32((sk + 0x34) >>> 0) | 0) === -1) {
      break
    }
    sk = m.u32((sk + 0x04) >>> 0) >>> 0
  }
  if (sk === 0) {
    sk = SKILLS_AddSkillToUnit113c(m, unit, skId) >>> 0
  }
  if (sk !== 0) {
    m.setU32((sk + 0x28) >>> 0, lvl | 0)
  }
  STATES_ApplyMonSkillIconToUnit113c(m, unit, skId)
}

