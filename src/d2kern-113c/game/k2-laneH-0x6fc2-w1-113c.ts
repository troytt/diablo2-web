/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 1 (`Lane K2-H`) routines across
 * `0x6FC21020..0x6FC2C310` (`PLAYER` quest/waypoint accessors, gold-cap-guarded
 * `STATLIST` mutators, fast `.txt` table/param lookups, `MONSTATS`/`MONTYPE`
 * hierarchy helpers, `STORM` `TSList`/`TSHashTable`/`TSGrowableArray` primitives,
 * `CHECKSUM` CRC-32, `OBJRGN` spacing/coord nodes, Blood Mana `0x72`, Impregnate
 * `0x6E` Pain Worm spawn/eligibility, and `SKILLS` `SrvSt59`/`SrvDo128`/`SrvDo147`).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import { UNITS_GetPlayerData113c, UNITS_GetStashGoldLimit113c } from '../common/composit.ts'
import { DRLG_ResolveMonsterSubClassIdForRoom113c } from '../common/drlg/drlg-ver.ts'
import { DUNGEON_GetLevelIdIfNotHidden113c } from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32 } from '../common/int-math.ts'
import {
  SKILLS_GetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  PATH_CopyPositionFromUnit113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
} from '../common/path.ts'
import { SKILLS_EvalCalcByOffset113c, SKILLS_SetParam1113c } from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetSkillId113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.ts'
import {
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
} from '../common/unit-finds.ts'
import { UNITS_GetRoom113c, UNIT_GetAlignment113c } from '../common/unit.ts'
import { UNITS_IsCorpseUseable113c } from '../common/waypoint.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c.ts'
import { AIGENERAL_BroadcastCmdToMinions113c } from './ai-fallen-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import { SUNIT_IsDeadOrDying113c } from './monster-events.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_SpawnPartyMinionInRing113c,
  SUNIT_ValidatePathTargetUnit113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'

/** Optional host/spawn hooks for `Fog.#10045` pool allocation and `MONSTER_Create` dispatch. */
export interface LaneH0x6fc2Hooks113c {
  readonly allocPoolMemory?: (
    m: Memory113c,
    pMemPool: number,
    nSize: number,
    szFileVa: number,
    nLine: number,
    nZero: number,
  ) => number
  readonly regpop?: RegpopSpawnHooks113c
}

const OBJRGN_CPP_VA_113C = 0x6fd1d174

/** Reentrant scratch stack region for local structs (`D2UnitFindDataStrc`, `D2AiCmdStrc`). */
let k2LaneHStackPtr = 0x7ef60000

/**
 * Authoritative 256-entry IEEE 802.3 CRC-32 lookup table (`poly = 0xEDB88320`)
 * from `D2Game.dll` `.rdata` at `0x6FD1AA78..0x6FD1AE77`.
 */
const CRC32_TABLE_113C: Uint32Array = (() => {
  const tbl = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i >>> 0
    for (let b = 0; b < 8; b++) {
      c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : (c >>> 1) >>> 0
    }
    tbl[i] = c >>> 0
  }
  return tbl
})()

function sx8(v: number): number {
  return (v << 24) >> 24
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function getDataTablesPtr113c(m: Memory113c): number {
  return m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
}

function lookupTableRecordFast113c(
  m: Memory113c,
  nIndex: number,
  ptrOff: number,
  countOff: number,
  stride: number,
): number {
  const idx = nIndex | 0
  if (idx < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  const count = m.u32((pDataTables + countOff) >>> 0) | 0
  if (idx >= count) return 0
  const base = m.u32((pDataTables + ptrOff) >>> 0) >>> 0
  return (base + imul32(idx, stride)) >>> 0
}

function lookupSkillsTxtNonNull113c(m: Memory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  const count = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (id >= count) return 0
  const base = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  return (base + imul32(id, 0x23c)) >>> 0
}

function readSkillParamFast113c(m: Memory113c, nSkillId: number, paramOff: number): number {
  const pRec = lookupSkillsTxtNonNull113c(m, nSkillId)
  if (pRec === 0) return 0
  return m.u32((pRec + paramOff) >>> 0) | 0
}

function evalSkillLinearParamPair113c(
  m: Memory113c,
  nSkillId: number,
  nLevel: number,
  baseOff: number,
  stepOff: number,
): number {
  const pRec = lookupSkillsTxtNonNull113c(m, nSkillId)
  const lvl = nLevel | 0
  if (pRec === 0 || lvl <= 0) return 0
  const step = m.u32((pRec + stepOff) >>> 0) | 0
  const base = m.u32((pRec + baseOff) >>> 0) | 0
  return (imul32((lvl - 1) | 0, step) + base) | 0
}

function readMonsterDataDword113c(m: Memory113c, pUnit: number, fieldOff: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  if (m.u32(u) !== 1) return 0
  const pMonsterData = m.u32((u + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return 0
  return m.u32((pMonsterData + fieldOff) >>> 0) >>> 0
}

function readUnitPosXInline113c(m: Memory113c, pUnit: number): number {
  const uType = m.u32(pUnit >>> 0) | 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    return m.u32((pStaticPath + 0x0c) >>> 0) | 0
  }
  const pDynPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pDynPath === 0) return 0
  return PATH_GetPosX113c(m, pDynPath) | 0
}

function readUnitPosYInline113c(m: Memory113c, pUnit: number): number {
  const uType = m.u32(pUnit >>> 0) | 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    return m.u32((pStaticPath + 0x10) >>> 0) | 0
  }
  const pDynPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pDynPath === 0) return 0
  return PATH_GetPosY113c(m, pDynPath) | 0
}

function removeUnitStateStatList113c(m: Memory113c, pUnit: number, nState: number): void {
  const pSubList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, nState)
  if (pSubList !== 0) {
    STATLIST_UnlinkSubList113c(m, pUnit, pSubList)
    STATLIST_FreeStatListIfNonExtended113c(m, pSubList)
  }
}

/**
 * Returns `UNITS_GetPlayerData(pPlayer)->pQuestRecord[pGame->nDifficulty]`
 * (`eax = pPlayer`, `[esp+4] = pGame`, `ret 4`; reads `u8 [pGame + 0x6D]` and
 * `u32 [pPlayerData + nDifficulty*4 + 0x10]`).
 *
 * @va D2Game:0x6FC21020
 */
export function PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0)
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0)
  return m.u32((pPlayerData + (nDifficulty << 2) + 0x10) >>> 0) >>> 0
}

/**
 * Sets `nStatId` (`ebx`) on `pUnit` (`esi`) to `nValue` (`edi`) on layer `0` with
 * negative-value clamping and player gold-cap overflow zeroing (`STAT_GOLD = 14` via
 * `STATLIST_GetUnitGoldBankLimit`, `STAT_GOLDBANK = 15` via `UNITS_GetStashGoldLimit`).
 *
 * @va D2Game:0x6FC21040
 */
export function STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  nValue: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const statId = nStatId | 0
  const val = nValue | 0
  if (val < 0) {
    STATLIST_SetUnitStat113c(m, u, statId, 0, 0)
    return
  }
  if (m.u32(u) === 0) {
    if (statId === 0x0e) {
      const limit = STATLIST_GetUnitGoldBankLimit113c(m, u) | 0
      if (val > limit) {
        STATLIST_SetUnitStat113c(m, u, 0x0e, 0, 0)
        return
      }
    } else if (statId === 0x0f) {
      const limit = UNITS_GetStashGoldLimit113c(u) | 0
      if (val > limit) {
        STATLIST_SetUnitStat113c(m, u, 0x0f, 0, 0)
        return
      }
    }
  }
  STATLIST_SetUnitStat113c(m, u, statId, val, 0)
}

/**
 * Looks up `D2CharStatsTxt*` (`sgptDataTables->pCharStatsTxt + nClassId * 0xC4`,
 * `eax = nClassId`, count at `+0xBC8`, base at `+0xBC4`). Returns `0` when out of bounds.
 *
 * @va D2Game:0x6FC210A0
 */
export function CHARSTATS_GetRecordPtrFast_6FC210A0_113c(
  m: Memory113c,
  nClassId: number,
): number {
  return lookupTableRecordFast113c(m, nClassId, 0xbc4, 0xbc8, 0xc4)
}

/**
 * Steps 64-bit LCG `D2SeedStrc` at `pSeed` (`ecx`):
 * `next = uint64(dwLoSeed) * 0x6AC690C5 + uint64(dwHiSeed)`, storing `dwHiSeed` (`+0x04`)
 * then `dwLoSeed` (`+0x00`) and returning the new unsigned 32-bit `dwLoSeed` (`eax`).
 *
 * @va D2Game:0x6FC21160
 */
export function SEED_StepSeed64Fast_6FC21160_113c(
  m: Memory113c,
  pSeed: number,
): number {
  const addr = pSeed >>> 0
  const lo = BigInt(m.u32(addr))
  const hi = BigInt(m.u32((addr + 0x04) >>> 0))
  const next = lo * 0x6ac690c5n + hi
  const newLo = Number(next & 0xffffffffn) >>> 0
  const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 0x04) >>> 0, newHi)
  m.setU32(addr, newLo)
  return newLo
}

/**
 * Returns `pUnit->pMonsterData->pMonsterInteract` (`+0x30`, `eax = pUnit`) when `pUnit`
 * is a non-NULL `UNIT_MONSTER (1)` with non-NULL `pMonsterData`, or `0` otherwise.
 *
 * @va D2Game:0x6FC21370
 */
export function MONSTER_GetInteractDataPtr_6FC21370_113c(
  m: Memory113c,
  pUnit: number,
): number {
  return readMonsterDataDword113c(m, pUnit, 0x30)
}

/**
 * Returns `pUnit->pMonsterData->pMonStatsTxt` (`+0x00`, `eax = pUnit`) when `pUnit`
 * is a non-NULL `UNIT_MONSTER (1)` with non-NULL `pMonsterData`, or `0` otherwise.
 *
 * @va D2Game:0x6FC21540
 */
export function MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(
  m: Memory113c,
  pUnit: number,
): number {
  return readMonsterDataDword113c(m, pUnit, 0x00)
}

/**
 * Tests bit `nBitMonType` (`ecx`) in row `nRowMonType` (`eax`) of `sgptDataTables->pMonTypeNest`
 * (`+0xC44`, count `+0xC40`, row stride dwords `+0xC48`) using `Fog!gdwBitMasks`.
 * Requires both `nBitMonType > 0` and `nRowMonType > 0` (`jle` returns `0`).
 *
 * @va D2Game:0x6FC21620
 */
export function MONTYPE_TestNestedBit_6FC21620_113c(
  m: Memory113c,
  nBitMonType: number,
  nRowMonType: number,
): number {
  const bitType = nBitMonType | 0
  const rowType = nRowMonType | 0
  if (bitType <= 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  const count = m.u32((pDataTables + 0xc40) >>> 0) | 0
  if (bitType >= count) return 0
  if (rowType <= 0 || rowType >= count) return 0
  const rowStrideDwords = m.u32((pDataTables + 0xc48) >>> 0) | 0
  const pMonTypeNest = m.u32((pDataTables + 0xc44) >>> 0) >>> 0
  const dwordIdx = (imul32(rowStrideDwords, rowType) + (bitType >> 5)) | 0
  const wordVal = m.u32((pMonTypeNest + ((dwordIdx << 2) >>> 0)) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask = m.u32((pMasks + ((bitType & 0x1f) << 2)) >>> 0)
  return (wordVal & mask) >>> 0
}

/**
 * Adds `nDelta` (`[esp+4]`) to `nStatId` (`ebx`) on `pUnit` (`esi`, `ret 4`):
 * - Zeroes `nStatId` via `STATLIST_SetUnitStat(..., 0, 0)` if `(cur + nDelta) | 0 < 0` (`add + jns`).
 * - Zeroes player gold stat (`14` or `15`) if `(cur + nDelta) | 0` exceeds the respective gold limit.
 * - Otherwise applies `STATLIST_AddUnitStat(pUnit, nStatId, nDelta, 0)`.
 *
 * @va D2Game:0x6FC21670
 */
export function STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  nDelta: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const statId = nStatId | 0
  const delta = nDelta | 0
  const cur = STATLIST_GetUnitStat113c(m, u, statId, 0) | 0
  const nextVal = (cur + delta) | 0
  if (nextVal < 0) {
    STATLIST_SetUnitStat113c(m, u, statId, 0, 0)
    return
  }
  if (m.u32(u) === 0) {
    if (statId === 0x0e) {
      const limit = STATLIST_GetUnitGoldBankLimit113c(m, u) | 0
      if (nextVal > limit) {
        STATLIST_SetUnitStat113c(m, u, 0x0e, 0, 0)
        return
      }
    } else if (statId === 0x0f) {
      const limit = UNITS_GetStashGoldLimit113c(u) | 0
      if (nextVal > limit) {
        STATLIST_SetUnitStat113c(m, u, 0x0f, 0, 0)
        return
      }
    }
  }
  STATLIST_AddUnitStatMemPort113c(m, u, statId, delta, 0)
}

/**
 * Looks up `D2UniqueItemsTxt*` (`sgptDataTables->pUniqueItemsTxt + nUniqueId * 0x14C`,
 * `eax = nUniqueId`, count at `+0xC28`, base at `+0xC24`). Returns `0` when out of bounds.
 *
 * @va D2Game:0x6FC216F0
 */
export function UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c(
  m: Memory113c,
  nUniqueId: number,
): number {
  return lookupTableRecordFast113c(m, nUniqueId, 0xc24, 0xc28, 0x14c)
}

/**
 * Returns `UNITS_GetPlayerData(pPlayer)->pWaypointData[pGame->nDifficulty]`
 * (`eax = pPlayer`, `[esp+4] = pGame`, `ret 4`; reads `u8 [pGame + 0x6D]` and
 * `u32 [pPlayerData + nDifficulty*4 + 0x1C]`).
 *
 * @va D2Game:0x6FC21720
 */
export function PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0)
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0)
  return m.u32((pPlayerData + (nDifficulty << 2) + 0x1c) >>> 0) >>> 0
}

/**
 * Returns `SkillsTxt[nSkillId].wMaxLvl` (`s16` at `+0x12C`, `eax = nSkillId`) when
 * `0 <= nSkillId < nSkillsTxtRecordCount` and `wMaxLvl > 0`, or default `20` (`0x14`) otherwise.
 *
 * @va D2Game:0x6FC21740
 */
export function SKILLS_GetMaxSkillLevel_6FC21740_113c(
  m: Memory113c,
  nSkillId: number,
): number {
  const id = nSkillId | 0
  if (id < 0) return 0x14
  const pDataTables = getDataTablesPtr113c(m)
  const count = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (id >= count) return 0x14
  const base = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const maxLvl = sx16(m.u16((base + imul32(id, 0x23c) + 0x12c) >>> 0))
  return maxLvl > 0 ? maxLvl : 0x14
}

/**
 * Reads `uint16` entry `sgptDataTables->wTableAE0[nIndex]` (`[pDataTables + nIndex*2 + 0xAE0]`,
 * `eax = nIndex`) when `0 <= nIndex < 0x42` (`66`), or returns `-1` otherwise.
 *
 * @va D2Game:0x6FC21830
 */
export function DATATBLS_GetTableWordAE0_6FC21830_113c(
  m: Memory113c,
  nIndex: number,
): number {
  const idx = nIndex | 0
  if (idx < 0 || idx >= 0x42) return -1
  const pDataTables = getDataTablesPtr113c(m)
  return m.u16((pDataTables + (idx << 1) + 0xae0) >>> 0)
}

/**
 * Returns `pUnit->pMonsterData->pAiGeneral` (`+0x28`, `eax = pUnit`) when `pUnit`
 * is a non-NULL `UNIT_MONSTER (1)` with non-NULL `pMonsterData`, or `0` otherwise.
 *
 * @va D2Game:0x6FC218E0
 */
export function MONSTER_GetAiGeneralPtr_6FC218E0_113c(
  m: Memory113c,
  pUnit: number,
): number {
  return readMonsterDataDword113c(m, pUnit, 0x28)
}

/**
 * Evaluates `SkillsTxt[nSkillId].dwParam3 + (nLevel - 1) * SkillsTxt[nSkillId].dwParam4`
 * (`+0x150` / `+0x154`, `eax = nSkillId`, `edx = nLevel`), returning `0` when invalid or `nLevel <= 0`.
 *
 * @va D2Game:0x6FC21A40
 */
export function SKILLS_EvalLinearParam34_6FC21A40_113c(
  m: Memory113c,
  nSkillId: number,
  nLevel: number,
): number {
  return evalSkillLinearParamPair113c(m, nSkillId, nLevel, 0x150, 0x154)
}

/**
 * Evaluates `SkillsTxt[nSkillId].dwParam5 + (nLevel - 1) * SkillsTxt[nSkillId].dwParam6`
 * (`+0x158` / `+0x15C`, `eax = nSkillId`, `edx = nLevel`), returning `0` when invalid or `nLevel <= 0`.
 *
 * @va D2Game:0x6FC21A90
 */
export function SKILLS_EvalLinearParam56_6FC21A90_113c(
  m: Memory113c,
  nSkillId: number,
  nLevel: number,
): number {
  return evalSkillLinearParamPair113c(m, nSkillId, nLevel, 0x158, 0x15c)
}

/**
 * Looks up `D2OverlayTxt*` (`sgptDataTables->pOverlayTxt + nOverlayId * 0x3C`,
 * `eax = nOverlayId`, count at `+0xC4`, base at `+0xBC`). Returns `0` when out of bounds.
 *
 * @va D2Game:0x6FC21AE0
 */
export function OVERLAY_GetRecordPtrFast_6FC21AE0_113c(
  m: Memory113c,
  nOverlayId: number,
): number {
  return lookupTableRecordFast113c(m, nOverlayId, 0xbc, 0xc4, 0x3c)
}

/**
 * Evaluates `SkillsTxt[nSkillId].dwParam1 + (nLevel - 1) * SkillsTxt[nSkillId].dwParam2`
 * (`+0x148` / `+0x14C`, `eax = nSkillId`, `edx = nLevel`), returning `0` when invalid or `nLevel <= 0`.
 *
 * @va D2Game:0x6FC21B10
 */
export function SKILLS_EvalLinearParam12_6FC21B10_113c(
  m: Memory113c,
  nSkillId: number,
  nLevel: number,
): number {
  return evalSkillLinearParamPair113c(m, nSkillId, nLevel, 0x148, 0x14c)
}

/**
 * Looks up `D2PetTypeTxt*` (`sgptDataTables->pPetTypeTxt + nPetType * 0xE0`,
 * `eax = nPetType`, count at `+0xBF0`, base at `+0xBE8`). Returns `0` when out of bounds.
 *
 * @va D2Game:0x6FC21B60
 */
export function PETTYPE_GetRecordPtrFast_6FC21B60_113c(
  m: Memory113c,
  nPetType: number,
): number {
  return lookupTableRecordFast113c(m, nPetType, 0xbe8, 0xbf0, 0xe0)
}

/**
 * Returns `SkillsTxt[nSkillId].dwParam1` (`+0x148`, `eax = nSkillId`), or `0` if invalid.
 *
 * @va D2Game:0x6FC21B90
 */
export function SKILLS_GetParam1Fast_6FC21B90_113c(m: Memory113c, nSkillId: number): number {
  return readSkillParamFast113c(m, nSkillId, 0x148)
}

/**
 * Returns `SkillsTxt[nSkillId].dwParam2` (`+0x14C`, `eax = nSkillId`), or `0` if invalid.
 *
 * @va D2Game:0x6FC21BC0
 */
export function SKILLS_GetParam2Fast_6FC21BC0_113c(m: Memory113c, nSkillId: number): number {
  return readSkillParamFast113c(m, nSkillId, 0x14c)
}

/**
 * Returns `SkillsTxt[nSkillId].dwParam3` (`+0x150`, `eax = nSkillId`), or `0` if invalid.
 *
 * @va D2Game:0x6FC21BF0
 */
export function SKILLS_GetParam3Fast_6FC21BF0_113c(m: Memory113c, nSkillId: number): number {
  return readSkillParamFast113c(m, nSkillId, 0x150)
}

/**
 * Returns `SkillsTxt[nSkillId].dwParam4` (`+0x154`, `eax = nSkillId`), or `0` if invalid.
 *
 * @va D2Game:0x6FC21C20
 */
export function SKILLS_GetParam4Fast_6FC21C20_113c(m: Memory113c, nSkillId: number): number {
  return readSkillParamFast113c(m, nSkillId, 0x154)
}

/**
 * Returns `SkillsTxt[nSkillId].dwParam5` (`+0x158`, `eax = nSkillId`), or `0` if invalid.
 *
 * @va D2Game:0x6FC21C50
 */
export function SKILLS_GetParam5Fast_6FC21C50_113c(m: Memory113c, nSkillId: number): number {
  return readSkillParamFast113c(m, nSkillId, 0x158)
}

/**
 * Resolves `MonStatsTxt[nClassId]` (`ecx = nClassId`, `ebx = nSteps`):
 * - Returns `-1` if `nClassId` is out of bounds or record pointer is NULL.
 * - Reads `wBaseId` (`s16` at `+0x02`) and returns it directly when `nSteps <= 0`.
 * - When `nSteps > 0`, advances `nSteps` times along `wNextInClass` (`s16` at `+0x04`),
 *   stopping early and returning that `wNextInClass` value if `< 0`, `>= count`, or record NULL.
 *
 * @va D2Game:0x6FC21D30
 */
export function MONSTATS_FollowSubClassChain_6FC21D30_113c(
  m: Memory113c,
  nClassId: number,
  nSteps: number,
): number {
  const cls = nClassId | 0
  if (cls < 0) return -1
  const pDataTables = getDataTablesPtr113c(m)
  const count = m.u32((pDataTables + 0xa80) >>> 0) | 0
  if (cls >= count) return -1
  const base = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
  let pRec = (base + imul32(cls, 0x1a8)) >>> 0
  if (pRec === 0) return -1

  let result = sx16(m.u16((pRec + 0x02) >>> 0))
  const steps = nSteps | 0
  if (steps <= 0) return result

  let i = 0
  while (i < steps) {
    result = sx16(m.u16((pRec + 0x04) >>> 0))
    if (result < 0 || result >= count) break
    pRec = (base + imul32(result, 0x1a8)) >>> 0
    if (pRec === 0) break
    i = (i + 1) | 0
  }
  return result
}

/**
 * Returns `u32 [pMonsterData + 0x2C]` (`eax = pUnit`) when `pUnit` is a non-NULL
 * `UNIT_MONSTER (1)` with non-NULL `pMonsterData`, or `0` otherwise.
 *
 * @va D2Game:0x6FC21DD0
 */
export function MONSTER_GetMonsterDataField2C_6FC21DD0_113c(
  m: Memory113c,
  pUnit: number,
): number {
  return readMonsterDataDword113c(m, pUnit, 0x2c)
}

/**
 * Looks up `D2MonLvlTxt*` (`sgptDataTables->pMonLvlTxt + nLevel * 0x78`,
 * `eax = nLevel`, count at `+0xB74`, base at `+0xB70`). Returns `0` when out of bounds.
 *
 * @va D2Game:0x6FC21E90
 */
export function MONLVL_GetRecordPtrFast_6FC21E90_113c(
  m: Memory113c,
  nLevel: number,
): number {
  return lookupTableRecordFast113c(m, nLevel, 0xb70, 0xb74, 0x78)
}

/**
 * Returns `SkillsTxt[nSkillId].dwParam6` (`+0x15C`, `eax = nSkillId`), or `0` if invalid.
 *
 * @va D2Game:0x6FC21EC0
 */
export function SKILLS_GetParam6Fast_6FC21EC0_113c(m: Memory113c, nSkillId: number): number {
  return readSkillParamFast113c(m, nSkillId, 0x15c)
}

/**
 * Returns `SkillsTxt[nSkillId].dwParam7` (`+0x160`, `eax = nSkillId`), or `0` if invalid.
 *
 * @va D2Game:0x6FC21EF0
 */
export function SKILLS_GetParam7Fast_6FC21EF0_113c(m: Memory113c, nSkillId: number): number {
  return readSkillParamFast113c(m, nSkillId, 0x160)
}

/**
 * Looks up `dwKey` (`esi`) in Storm `TSHashTable` at `pHashTable` (`edx`):
 * hashes into `pBuckets = [pHashTable + 0x1C]` using `dwKey & [pHashTable + 0x24]`
 * (stride `12` bytes) and walks intrusive `TSLink` nodes while `(pNode | 0) > 0`,
 * returning `pNode` when `[pNode] == dwKey` or `0` if absent.
 *
 * @va D2Game:0x6FC22130
 */
export function STORM_TSHashTableLookup_6FC22130_113c(
  m: Memory113c,
  pHashTable: number,
  dwKey: number,
): number {
  const tbl = pHashTable >>> 0
  const key = dwKey >>> 0
  const mask0 = m.u32((tbl + 0x24) >>> 0)
  const bucketIdx0 = (key & mask0) >>> 0
  const pBuckets0 = m.u32((tbl + 0x1c) >>> 0) >>> 0
  const pBucket0 = (pBuckets0 + imul32(bucketIdx0, 12)) >>> 0
  let pNode = m.u32((pBucket0 + 0x08) >>> 0) >>> 0
  if ((pNode | 0) <= 0) return 0

  while ((pNode | 0) > 0) {
    if ((m.u32(pNode) >>> 0) === key) {
      return pNode
    }
    const mask = m.u32((tbl + 0x24) >>> 0)
    const bucketIdx = (key & mask) >>> 0
    const pBuckets = m.u32((tbl + 0x1c) >>> 0) >>> 0
    const linkOffset = m.u32((pBuckets + imul32(bucketIdx, 12)) >>> 0)
    const pLink = (pNode + linkOffset) >>> 0
    pNode = m.u32((pLink + 0x04) >>> 0) >>> 0
  }
  return 0
}

/**
 * Unlinks all nodes in intrusive Storm `TSExplicitList` at `pList` (`edi`, 12 bytes:
 * `+0x00 = m_linkoffset`, `+0x04 = m_terminator.m_prevlink`, `+0x08 = m_terminator.m_next`),
 * zeroing each unlinked node's `{ m_prevlink, m_next }` pair until `(m_next | 0) <= 0`.
 *
 * @va D2Game:0x6FC22180
 */
export function STORM_TSListUnlinkAll_6FC22180_113c(
  m: Memory113c,
  pList: number,
): void {
  const list = pList >>> 0
  while (true) {
    const pHead = m.u32((list + 0x08) >>> 0) >>> 0
    if ((pHead | 0) <= 0) return
    const linkOffset = m.u32(list)
    const pLink = (pHead + linkOffset) >>> 0
    const pPrevLink = m.u32(pLink) >>> 0
    if (pPrevLink === 0) continue

    const rawNext = m.u32((pLink + 0x04) >>> 0) >>> 0
    let pNextTargetLink: number
    if ((rawNext | 0) < 0) {
      pNextTargetLink = (~rawNext) >>> 0
    } else {
      const pPrevNextNode = m.u32((pPrevLink + 0x04) >>> 0) >>> 0
      const computedOff = (pLink - pPrevNextNode) >>> 0
      pNextTargetLink = (rawNext + computedOff) >>> 0
    }
    m.setU32(pNextTargetLink, pPrevLink)

    const pPrevReload = m.u32(pLink) >>> 0
    const pNextReload = m.u32((pLink + 0x04) >>> 0) >>> 0
    m.setU32((pPrevReload + 0x04) >>> 0, pNextReload)
    m.setU32(pLink, 0)
    m.setU32((pLink + 0x04) >>> 0, 0)
  }
}

/**
 * Default-constructs a 12-byte Storm `TSExplicitList` at `pList` (`[esp+4]`, `ret 4`),
 * writing uninitialized sentinel `m_linkoffset = 0xDDDDDDDD` (`+0x00`), self-referential
 * `m_terminator.m_prevlink = pList + 4` (`+0x04`), and `m_terminator.m_next = ~(pList + 4)` (`+0x08`).
 *
 * @va D2Game:0x6FC224B0
 */
export function STORM_TSListInitDefault_6FC224B0_113c(
  m: Memory113c,
  pList: number,
): number {
  const addr = pList >>> 0
  const term = (addr + 0x04) >>> 0
  const notTerm = (~term) >>> 0
  m.setU32(term, 0)
  m.setU32((term + 0x04) >>> 0, 0)
  m.setU32(addr, 0)
  m.setU32(term, term)
  m.setU32((addr + 0x08) >>> 0, notTerm)
  m.setU32(addr, 0xdddddddd)
  m.setU32(term, term)
  m.setU32((addr + 0x08) >>> 0, notTerm)
  return addr
}

/**
 * Computes Storm `TSGrowableArray` chunk size (`eax = nCount`, `[esp+4] = pArray`, `ret 4`):
 * - When `(nCount >>> 0) >= 0x15` (`21`), writes `[pArray + 0x0C] = 0x15` and returns `0x15`.
 * - Otherwise strips low bits down to the highest power of two (`>= 1`, returning `1` for `0`).
 *
 * @va D2Game:0x6FC225F0
 */
export function STORM_TSArrayCalcChunkSize_6FC225F0_113c(
  m: Memory113c,
  nCount: number,
  pArray: number,
): number {
  let v = nCount >>> 0
  if (v >= 0x15) {
    m.setU32((pArray + 0x0c) >>> 0, 0x15)
    return 0x15
  }
  let c = (v & ((v - 1) >>> 0)) >>> 0
  while (c !== 0) {
    v = c
    c = (v & ((v - 1) >>> 0)) >>> 0
  }
  return v >= 1 ? v : 1
}

/**
 * Placement-constructs a 12-byte Storm `TSExplicitList` at `pDstList` (`[esp+4]`) copying
 * `m_linkoffset` from `[pSrcList]` (`[esp+8]`, `ret 8`) and initializing an empty terminator
 * (`[pDstList + 4] = pDstList + 4`, `[pDstList + 8] = ~(pDstList + 4)`).
 *
 * @va D2Game:0x6FC22740
 */
export function STORM_TSListInitFromPrototype_6FC22740_113c(
  m: Memory113c,
  pDstList: number,
  pSrcList: number,
): number {
  const dst = pDstList >>> 0
  const term = (dst + 0x04) >>> 0
  m.setU32(term, 0)
  m.setU32((term + 0x04) >>> 0, 0)
  const linkOffset = m.u32(pSrcList >>> 0)
  m.setU32(term, term)
  const notTerm = (~term) >>> 0
  m.setU32(dst, linkOffset)
  m.setU32((dst + 0x08) >>> 0, notTerm)
  return dst
}

/**
 * Tests whether `UNIT_MONSTER` `pUnit`'s (`eax`) `MonStatsTxt.wMonType` (`s16` at `+0x1C`)
 * bit is set in row `nMonType` (`edi`) of `sgptDataTables->pMonTypeNest` (`+0xC44`,
 * count `+0xC40`, row stride dwords `+0xC48`). Allows `0 <= type < count` (`jl` returns `0`).
 *
 * @va D2Game:0x6FC22790
 */
export function MONSTER_TestUnitMonTypeFlag_6FC22790_113c(
  m: Memory113c,
  pUnit: number,
  nMonType: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  if (m.u32(u) !== 1) return 0
  const cls = m.u32((u + 0x04) >>> 0) | 0
  if (cls < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
  if (cls >= nMonStatsCount) return 0
  const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
  const pMonStats = (pMonStatsBase + imul32(cls, 0x1a8)) >>> 0
  if (pMonStats === 0) return 0

  const unitMonType = sx16(m.u16((pMonStats + 0x1c) >>> 0))
  if (unitMonType < 0) return 0
  const nMonTypeCount = m.u32((pDataTables + 0xc40) >>> 0) | 0
  if (unitMonType >= nMonTypeCount) return 0

  const rowMonType = nMonType | 0
  if (rowMonType < 0 || rowMonType >= nMonTypeCount) return 0

  const unitMonTypeReload = sx16(m.u16((pMonStats + 0x1c) >>> 0))
  const rowStrideDwords = m.u32((pDataTables + 0xc48) >>> 0) | 0
  const pMonTypeNest = m.u32((pDataTables + 0xc44) >>> 0) >>> 0
  const dwordIdx = (imul32(rowStrideDwords, rowMonType) + (unitMonTypeReload >> 5)) | 0
  const wordVal = m.u32((pMonTypeNest + ((dwordIdx << 2) >>> 0)) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask = m.u32((pMasks + ((unitMonTypeReload & 0x1f) << 2)) >>> 0)
  return (wordVal & mask) >>> 0
}

/**
 * Computes standard IEEE 802.3 CRC-32 (`0x6FD1AA78` lookup table) over `nLen` (`edx`)
 * bytes starting at `pData` (`ecx`). Asserts via `Fog.#10024` (line `0x40`) when `nLen == 0`.
 *
 * @va D2Game:0x6FC2B470
 */
export function CHECKSUM_ComputeCrc32_6FC2B470_113c(
  m: Memory113c,
  pData: number,
  nLen: number,
): number {
  const len = nLen >>> 0
  if (len === 0) {
    throw new D2CommonAssertError('', 0x40)
  }
  const base = pData >>> 0
  let crc = 0xffffffff
  for (let i = 0; i < len; i++) {
    const b = m.u8((base + i) >>> 0)
    const idx = (b ^ (crc & 0xff)) & 0xff
    crc = ((crc >>> 8) ^ CRC32_TABLE_113C[idx]!) >>> 0
  }
  return (~crc) >>> 0
}

/**
 * Checks object-region coordinate spacing in `pGame->pObjectControl->pObjectRegion[nAct]`
 * (`ecx = pGame`, `edx = nAct`, `[esp+4] = nX`, `[esp+8] = nY`, `ret 8`):
 * iterates `nCount = [pRegion + 0x14]` `(x, y)` pairs starting at `pRegion + 0x40` and
 * returns `0` if any entry has `|x - nX| < 50` (`0x32`) OR `|y - nY| < 50`, else `1`.
 *
 * @va D2Game:0x6FC2B670
 */
export function OBJRGN_CheckCoordSpacing40_6FC2B670_113c(
  m: Memory113c,
  pGame: number,
  nAct: number,
  nX: number,
  nY: number,
): number {
  const pObjectCtrl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const pRegion = m.u32((pObjectCtrl + imul32(nAct | 0, 4) + 0x48) >>> 0) >>> 0
  const count = m.u32((pRegion + 0x14) >>> 0) | 0
  if (count <= 0) return 1
  const targetX = nX | 0
  const targetY = nY | 0
  let pCoordY = (pRegion + 0x44) >>> 0
  for (let i = 0; i < count; i++) {
    let dx = ((m.u32((pCoordY - 0x04) >>> 0) | 0) - targetX) | 0
    if (dx < 0) dx = (-dx) | 0
    if (dx < 0x32) return 0
    let dy = ((m.u32(pCoordY) | 0) - targetY) | 0
    if (dy < 0) dy = (-dy) | 0
    if (dy < 0x32) return 0
    pCoordY = (pCoordY + 0x08) >>> 0
  }
  return 1
}

/**
 * Checks object-region coordinate spacing in `pGame->pObjectControl->pObjectRegion[nAct]`
 * (`ecx = pGame`, `edx = nAct`, `[esp+4] = nX`, `[esp+8] = nY`, `ret 8`):
 * iterates `nCount = [pRegion + 0x18]` `(x, y)` pairs starting at `pRegion + 0x20` and
 * returns `0` if any entry has `|x - nX| < 100` (`0x64`) OR `|y - nY| < 100`, else `1`.
 *
 * @va D2Game:0x6FC2B700
 */
export function OBJRGN_CheckCoordSpacing20_6FC2B700_113c(
  m: Memory113c,
  pGame: number,
  nAct: number,
  nX: number,
  nY: number,
): number {
  const pObjectCtrl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  const pRegion = m.u32((pObjectCtrl + imul32(nAct | 0, 4) + 0x48) >>> 0) >>> 0
  const count = m.u32((pRegion + 0x18) >>> 0) | 0
  if (count <= 0) return 1
  const targetX = nX | 0
  const targetY = nY | 0
  let pCoordY = (pRegion + 0x24) >>> 0
  for (let i = 0; i < count; i++) {
    let dx = ((m.u32((pCoordY - 0x04) >>> 0) | 0) - targetX) | 0
    if (dx < 0) dx = (-dx) | 0
    if (dx < 0x64) return 0
    let dy = ((m.u32(pCoordY) | 0) - targetY) | 0
    if (dy < 0) dy = (-dy) | 0
    if (dy < 0x64) return 0
    pCoordY = (pCoordY + 0x08) >>> 0
  }
  return 1
}

/**
 * Allocates a 16-byte `{ dwParam, nX, nY, pNext }` node via `Fog.#10045` (`objrgn.cpp:375`)
 * and prepends it to `pGame->pObjectControl->pNodeList` (`+0x1110`; `eax = pGame`,
 * `ecx = pUnit`, `[esp+4] = dwParam`, `ret 4`).
 *
 * @va D2Game:0x6FC2B800
 */
export function OBJRGN_PrependObjectCoordNode_6FC2B800_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  dwParam: number,
  hooks?: LaneH0x6fc2Hooks113c,
): void {
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pObjectCtrl = m.u32((game + 0x10f0) >>> 0) >>> 0
  const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
  const pNode =
    hooks !== undefined && hooks.allocPoolMemory !== undefined
      ? hooks.allocPoolMemory(m, pMemPool, 0x10, OBJRGN_CPP_VA_113C, 0x177, 0) >>> 0
      : m.alloc(0x10)

  const posX = readUnitPosXInline113c(m, unit)
  m.setU32((pNode + 0x04) >>> 0, posX >>> 0)

  const posY = readUnitPosYInline113c(m, unit)
  m.setU32((pNode + 0x08) >>> 0, posY >>> 0)
  m.setU32(pNode, dwParam >>> 0)

  const prevHead = m.u32((pObjectCtrl + 0x1110) >>> 0) >>> 0
  m.setU32((pNode + 0x0c) >>> 0, prevHead)
  m.setU32((pObjectCtrl + 0x1110) >>> 0, pNode)
}

/**
 * Applies `STATE_BLOOD_MANA (0x72)` skill health cost `nHpCostFixed` (`eax`, 8.8 fixed-point)
 * against `pUnit`'s (`esi`) `STAT_HITPOINTS (6)`:
 * - When `curHp >= nHpCostFixed`: subtracts `nHpCostFixed`, removes state `0x72` if remaining HP
 *   drops below `SkillsTxt[skillId].dwParam5 << 8`, and returns `1`.
 * - When `curHp < nHpCostFixed`: removes state `0x72`, clamps `STAT_HITPOINTS` to `0x100` (1 HP),
 *   and returns `0`.
 *
 * @va D2Game:0x6FC2BE20
 */
export function SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c(
  m: Memory113c,
  pUnit: number,
  nHpCostFixed: number,
): number {
  const u = pUnit >>> 0
  const cost = nHpCostFixed | 0
  const pStateList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, u, 0x72)
  const nSkillId = STATLIST_GetSkillId113c(m, pStateList) | 0
  const curHp = STATLIST_GetUnitStat113c(m, u, 6, 0) | 0

  if (curHp < cost) {
    removeUnitStateStatList113c(m, u, 0x72)
    STATLIST_SetUnitStat113c(m, u, 6, 0x100, 0)
    return 0
  }

  STATLIST_AddUnitStatMemPort113c(m, u, 6, (-cost) | 0, 0)
  const pSkillsTxt = lookupSkillsTxtNonNull113c(m, nSkillId)
  const newHp = STATLIST_GetUnitStat113c(m, u, 6, 0) | 0
  const minHpFixed = (m.u32((pSkillsTxt + 0x158) >>> 0) << 8) | 0
  if (newHp < minHpFixed) {
    removeUnitStateStatList113c(m, u, 0x72)
  }
  return 1
}

/**
 * `skillsSrvStFuncTable[59]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * evaluates `dur = max(1, EvalCalc1)`, writes `pGame->dwGameFrame + dur` into `SKILLS_SetParam1`,
 * and sets `STATE_INFERNO / SUBMERGE (0x0C)` gfx state flag if not already active.
 *
 * @va D2Game:0x6FC2BEE0
 */
export function SKILLS_SrvSt59_Submerge_6FC2BEE0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  const pSkillsTxt = lookupSkillsTxtNonNull113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0
  const u = pUnit >>> 0
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, u)
  if (pSkill === 0) return 0

  const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0)
  let dur = SKILLS_EvalCalcByOffset113c(m, u, dwCalc1, nSkillId | 0, nSkillLevel | 0) | 0
  if (dur < 1) dur = 1

  const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  SKILLS_SetParam1113c(m, pSkill, (dwGameFrame + dur) | 0)

  if (STATES_CheckState113c(m, u, 0x0c) === 0) {
    STATES_ToggleGfxStateFlag113c(m, u, 0x0c, 1)
  }
  return 1
}

/**
 * State removal callback for `STATE_IMPREGNATED (0x6E)` (`__fastcall(pUnit, nState, pStatList)`, `ret 4`):
 * clears `nState` gfx flag, resolves summon monster class (`SkillsTxt.wSumMon` `+0xBC`, default `0x227`
 * Pain Worm) and mode (`SkillsTxt.nSumUMode` `+0xBF`, default `1`), asserts if `pUnit == NULL`, and
 * spawns the monster in a ring around `pUnit` when `pUnit` is dead/dying in a non-hidden level.
 *
 * @va D2Game:0x6FC2C000
 */
export function STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  pStatList: number,
  hooks?: LaneH0x6fc2Hooks113c,
): void {
  const u = pUnit >>> 0
  STATES_ToggleGfxStateFlag113c(m, u, nState | 0, 0)

  let nSpawnClassId = 0x227
  let nSpawnMode = 1
  const statList = pStatList >>> 0
  if (statList !== 0) {
    const nSkillId = STATLIST_GetSkillId113c(m, statList) | 0
    if (nSkillId >= 0) {
      const pDataTables = getDataTablesPtr113c(m)
      const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
      if (nSkillId < nSkillsCount) {
        const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
        const pSkillsTxt = (pSkillsBase + imul32(nSkillId, 0x23c)) >>> 0
        if (pSkillsTxt !== 0) {
          const wSumMon = sx16(m.u16((pSkillsTxt + 0xbc) >>> 0))
          if (wSumMon > 0) {
            const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
            if (wSumMon < nMonStatsCount) {
              nSpawnClassId = wSumMon
            }
          }
          const nSumUMode = sx8(m.u8((pSkillsTxt + 0xbf) >>> 0))
          if (nSumUMode >= 0 && nSumUMode < 0x10) {
            nSpawnMode = nSumUMode
          }
        }
      }
    }
  }

  if (u === 0) {
    throw new D2CommonAssertError('', 0xa2a)
  }

  const deadFlag = m.u8((u + 0xc6) >>> 0) & 1
  let shouldSpawn = true
  if (deadFlag === 0) {
    const uType = m.u32(u) >>> 0
    if (uType === 0) {
      const mode = m.u32((u + 0x10) >>> 0) >>> 0
      shouldSpawn = mode === 0 || mode === 0x11
    } else if (uType === 1) {
      const mode = m.u32((u + 0x10) >>> 0) >>> 0
      shouldSpawn = mode === 0 || mode === 0x0c
    }
  }

  if (!shouldSpawn) return

  const pGame = m.u32((u + 0x80) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, u)
  if (DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) !== 0) {
    const resolvedClassId = DRLG_ResolveMonsterSubClassIdForRoom113c(m, pRoom, nSpawnClassId)
    MONSTER_SpawnPartyMinionInRing113c(
      m,
      resolvedClassId,
      u,
      nSpawnMode,
      pGame,
      1,
      0,
      hooks !== undefined ? hooks.regpop : undefined,
    )
  }
}

/**
 * Checks whether `pUnit` (`esi`) is a live, non-friendly `UNIT_MONSTER (1)` eligible for
 * Putrid Defiler Impregnate (`STATE_IMPREGNATED = 0x6E`): rejects Putrid Defiler (`wBaseId == 0x222`),
 * Pain Worm (`wBaseId == 0x227`), already-impregnated monsters (`state 0x6E`), and good alignment (`2`).
 *
 * @va D2Game:0x6FC2C110
 */
export function SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(
  m: Memory113c,
  pUnit: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  if (m.u32(u) !== 1) return 0
  if (SUNIT_IsDeadOrDying113c(m, u) !== 0) return 0

  let baseId = MONSTER_GetBaseIdFromUnit113c(m, u) | 0
  if (baseId >= 0) {
    const pDataTables = getDataTablesPtr113c(m)
    const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
    if (baseId >= nMonStatsCount) {
      baseId = -1
    }
  } else {
    baseId = -1
  }

  if (baseId === 0x222 || baseId === 0x227) return 0
  if (STATES_CheckState113c(m, u, 0x6e) !== 0) return 0
  return UNIT_GetAlignment113c(m, u) !== 2 ? 1 : 0
}

/**
 * `skillsSrvDoFuncTable[147]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * when `pUnit != NULL` and `(pUnit->dwFlagsEx & 0x400) != 0` (`+0xC8` bit 10), resolves
 * `pUnit`'s owner (`+0x94 = dwOwnerType`, `+0x98 = dwOwnerId`) via `SUNIT_GetServerUnit`
 * and copies its position via `PATH_CopyPositionFromUnit`. Always returns `1`.
 *
 * @va D2Game:0x6FC2C170
 */
export function SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  const u = pUnit >>> 0
  if (u !== 0) {
    const dwFlagsEx = m.u32((u + 0xc8) >>> 0)
    if (((dwFlagsEx >>> 10) & 1) !== 0) {
      const dwOwnerId = m.u32((u + 0x98) >>> 0)
      const dwOwnerType = m.u32((u + 0x94) >>> 0)
      const pOwner = SUNIT_GetServerUnit113c(m, pGame >>> 0, dwOwnerType, dwOwnerId)
      if (pOwner !== 0) {
        PATH_CopyPositionFromUnit113c(m, u, pOwner)
      }
    }
  }
  return 1
}

/**
 * Searches adjacent rooms around `pUnit` (`esi`) within `nRange` (`[esp+8]`, `[esp+4] = pGame`, `ret 8`)
 * using `UNITFINDS` (`dwFlags = 0x1002`) for the first useable monster corpse (`UNITS_IsCorpseUseable`)
 * that is hostile/unaligned to `pUnit` (`SUNIT_AreUnitsHostileOrUnaligned`), freeing `UnitFindData`
 * before returning the corpse unit pointer (or `0` if none).
 *
 * @va D2Game:0x6FC2C1F0
 */
export function SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nRange: number,
): number {
  const sp = k2LaneHStackPtr
  k2LaneHStackPtr = (sp + 0x70) >>> 0
  try {
    const u = pUnit >>> 0
    const game = pGame >>> 0
    const pRoom = UNITS_GetRoom113c(m, u)
    const posX = readUnitPosXInline113c(m, u)
    const posY = readUnitPosYInline113c(m, u)

    const pUnitFindData = sp
    const pFindArg = (sp + 0x2c) >>> 0
    m.fill(sp, 0x64, 0)

    m.setU32((pFindArg + 0x10) >>> 0, posY >>> 0)
    m.setU32((pFindArg + 0x14) >>> 0, nRange >>> 0)
    const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
    m.setU32(pFindArg, 0x1002)
    m.setU32((pFindArg + 0x08) >>> 0, u)
    m.setU32((pFindArg + 0x0c) >>> 0, posX >>> 0)

    UNITFINDS_InitUnitFindData113c(m, pMemPool, pUnitFindData, pRoom, posX, posY, nRange | 0, 0, pFindArg)
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pUnitFindData)

    let count = m.u32((pUnitFindData + 0x18) >>> 0) | 0
    let idx = 0
    while (idx < count) {
      const pUnitsArray = m.u32((pUnitFindData + 0x04) >>> 0) >>> 0
      const pCand = m.u32((pUnitsArray + (idx << 2)) >>> 0) >>> 0
      if (UNITS_IsCorpseUseable113c(m, pCand) !== 0) {
        if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pCand, u, game) !== 0) {
          UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)
          return pCand
        }
      }
      count = m.u32((pUnitFindData + 0x18) >>> 0) | 0
      idx = (idx + 1) | 0
    }

    UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)
    return 0
  } finally {
    k2LaneHStackPtr = sp
  }
}

/**
 * `skillsSrvDoFuncTable[128]` (`__fastcall(pGame, pUnit, nSkillId, nSkillLevel)`, `ret 8`):
 * validates `pUnit`'s (`UNIT_MONSTER`) path target (`!= pUnit && != NULL`), broadcasts AI command `1`
 * (`{ 1, targetType, targetGuid, dwGameFrame + max(1, EvalCalc1) }`) to pack minions via
 * `AIGENERAL_BroadcastCmdToMinions`, optionally sets `SkillsTxt.wAuraTargetState` (`+0x4E`) icon on
 * `pTarget` via `STATES_SetMonsterSkillIconOnUnit`, and returns `1`.
 *
 * @va D2Game:0x6FC2C310
 */
export function SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  const pSkillsTxt = lookupSkillsTxtNonNull113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0

  const u = pUnit >>> 0
  const game = pGame >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, u, game)

  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath)
  if (pTarget === u || pTarget === 0) return 0
  if (m.u32(u) !== 1) return 0

  const sp = k2LaneHStackPtr
  k2LaneHStackPtr = (sp + 0x20) >>> 0
  try {
    m.fill(sp, 0x20, 0)
    const targetType = m.u32(pTarget)
    const targetGuid = m.u32((pTarget + 0x0c) >>> 0)
    m.setU32((sp + 0x08) >>> 0, 1)
    m.setU32((sp + 0x0c) >>> 0, targetType)
    m.setU32((sp + 0x10) >>> 0, targetGuid)

    const dwCalc1 = m.u32((pSkillsTxt + 0x138) >>> 0)
    let dur = SKILLS_EvalCalcByOffset113c(m, u, dwCalc1, nSkillId | 0, nSkillLevel | 0) | 0
    if (dur < 1) dur = 1

    const dwGameFrame = m.u32((game + 0xa8) >>> 0) | 0
    m.setU32((sp + 0x14) >>> 0, ((dwGameFrame + dur) | 0) >>> 0)

    AIGENERAL_BroadcastCmdToMinions113c(m, u, game, sp)

    const wAuraTargetState = sx16(m.u16((pSkillsTxt + 0x4e) >>> 0))
    if (wAuraTargetState > 0) {
      const pDataTables = getDataTablesPtr113c(m)
      const nStatesCount = m.u32((pDataTables + 0xbc0) >>> 0) | 0
      if (wAuraTargetState < nStatesCount) {
        STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, wAuraTargetState, 0)
      }
    }
    return 1
  } finally {
    k2LaneHStackPtr = sp
  }
}
