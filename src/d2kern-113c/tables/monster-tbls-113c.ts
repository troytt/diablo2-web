/**
 * Diablo II v1.13c `D2Common.dll` `DATATBLS\MonsterTbls.cpp` and `Hireling.cpp` / `TreasureClassEx` table lookups
 * (`0x6FDA3050..0x6FDA3850`, image base `0x6FD50000`).
 *
 * Batch `B009` (9 functions):
 * - `0x6FDA3050` `DATATBLS_GetHirelingTxtRecordFromActAndDifficulty113c` (`#10453`)
 * - `0x6FDA30F0` `DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c` (`#10427`)
 * - `0x6FDA3190` `DATATBLS_GetHirelingTxtRecordFromClassId113c` (`#10317`)
 * - `0x6FDA3220` `DATATBLS_GetHirelingTxtRecordFromNameId113c` (`#10676`)
 * - `0x6FDA32C0` `DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c` (`#11156`)
 * - `0x6FDA3360` `DATATBLS_GetSuperUniquesTxtRecordCount113c` (`#10288`)
 * - `0x6FDA3370` `DATATBLS_GetSuperUniquesTxtRecord113c` (`#10038`)
 * - `0x6FDA3420` `DATATBLS_GetTreasureClassExRecordFromIdAndLevel113c` (`#10634`)
 * - `0x6FDA3850` `DATATBLS_GetMonsterChainInfo113c` (`#10035`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import { sdiv32 } from '../common/int-math.ts'
import {
  D2HirelingTxt,
  D2HirelingTxt_SIZE,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2SuperUniquesTxt_SIZE,
  D2TreasureClassExStrc,
  D2TreasureClassExStrc_SIZE,
} from '../mem/layout.generated.ts'

/** `.data` `sgptDataTables->pHirelingTxt` at `0x6FDF0078` (`0x6FDA3050`). */
export const G_HIRELING_TXT_VA_113C = 0x6fdf0078
/** `.data` `sgptDataTables->nHirelingTxtRecordCount` at `0x6FDF007C` (`0x6FDA30A2`). */
export const G_HIRELING_COUNT_VA_113C = 0x6fdf007c
/** `.data` `sgptDataTables->nHirelingSubTypeStartIndices[2][256]` at `0x6FDF0080` (`0x6FDA32EE`). */
export const G_HIRELING_SUBTYPE_LUT_VA_113C = 0x6fdf0080

/** `.data` `sgptDataTables->pTreasureClassEx` at `0x6FDF0894` (`0x6FDA3443`). */
export const G_TREASURECLASSEX_VA_113C = 0x6fdf0894
/** `.data` `sgptDataTables->nTreasureClassExCount` at `0x6FDF0898` (`0x6FDA3433`). */
export const G_TREASURECLASSEX_COUNT_VA_113C = 0x6fdf0898

/** `.data` `sgptDataTables->pMonStatsTxt` at `0x6FDF0950` (`0x6FDA3876`). */
export const G_MONSTATS_TXT_VA_113C = 0x6fdf0950
/** `.data` `sgptDataTables->nMonStatsTxtRecordCount` at `0x6FDF0958` (`0x6FDA385A`). */
export const G_MONSTATS_COUNT_VA_113C = 0x6fdf0958

/** `.data` `sgptDataTables->pSuperUniquesTxt` at `0x6FDF09AC` (`0x6FDA3381`). */
export const G_SUPERUNIQUES_TXT_VA_113C = 0x6fdf09ac
/** `.data` `sgptDataTables->nSuperUniquesTxtRecordCount` at `0x6FDF09B4` (`0x6FDA3360`, `0x6FDA3374`). */
export const G_SUPERUNIQUES_COUNT_VA_113C = 0x6fdf09b4

/** `D2HirelingTxt` field offsets accessed via shifted inner pointers in `0x6FDA3050` and `0x6FDA30F0`. */
export const HIRELING_TXT_ACT_OFF_113C = 0x0c
export const HIRELING_TXT_SELLER_OFF_113C = 0x14

/**
 * `@va D2Common:0x6FDA3050` (`D2Common.#10453`, `DATATBLS_GetHirelingTxtRecordFromActAndDifficulty`,
 * `__stdcall(bExpansion, nAct, nDifficulty, pPrevRecord) -> D2HirelingTxt*`, `ret 0x10`).
 */
export function DATATBLS_GetHirelingTxtRecordFromActAndDifficulty113c(
  m: Memory113c,
  bExpansion: number,
  nAct: number,
  nDifficulty: number,
  pPrevRecord: number,
): number {
  const targetAct = ((nAct | 0) + 1) | 0
  const targetDiff = ((nDifficulty | 0) + 1) | 0
  const targetVer = (bExpansion | 0) !== 0 ? 100 : 0
  const pBase = m.u32(G_HIRELING_TXT_VA_113C)

  let startIdx = 0
  let prevLvl = 0
  if (pPrevRecord !== 0) {
    startIdx = (sdiv32((pPrevRecord - pBase) | 0, D2HirelingTxt_SIZE) + 1) | 0
    prevLvl = m.get(pPrevRecord, D2HirelingTxt.dwHirelingLevel) | 0
  }

  const nCount = m.u32(G_HIRELING_COUNT_VA_113C) | 0
  for (let i = startIdx; i < nCount; i++) {
    const pRec = (pBase + Math.imul(i, D2HirelingTxt_SIZE)) >>> 0
    if (
      (m.u32((pRec + HIRELING_TXT_ACT_OFF_113C) >>> 0) | 0) === targetAct &&
      (m.get(pRec, D2HirelingTxt.dwDifficulty) | 0) === targetDiff &&
      m.get(pRec, D2HirelingTxt.wVersion) === targetVer &&
      (prevLvl === 0 || (m.get(pRec, D2HirelingTxt.dwHirelingLevel) | 0) === prevLvl)
    ) {
      return pRec
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FDA30F0` (`D2Common.#10427`, `DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty`,
 * `__stdcall(bExpansion, nSeller, nDifficulty, pPrevRecord) -> D2HirelingTxt*`, `ret 0x10`).
 */
export function DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c(
  m: Memory113c,
  bExpansion: number,
  nSeller: number,
  nDifficulty: number,
  pPrevRecord: number,
): number {
  const targetSeller = nSeller | 0
  const targetDiff = ((nDifficulty | 0) + 1) | 0
  const targetVer = (bExpansion | 0) !== 0 ? 100 : 0
  const pBase = m.u32(G_HIRELING_TXT_VA_113C)

  let startIdx = 0
  if (pPrevRecord !== 0) {
    startIdx = (sdiv32((pPrevRecord - pBase) | 0, D2HirelingTxt_SIZE) + 1) | 0
  }

  const nCount = m.u32(G_HIRELING_COUNT_VA_113C) | 0
  for (let i = startIdx; i < nCount; i++) {
    const pRec = (pBase + Math.imul(i, D2HirelingTxt_SIZE)) >>> 0
    if (
      (m.u32((pRec + HIRELING_TXT_SELLER_OFF_113C) >>> 0) | 0) === targetSeller &&
      (m.get(pRec, D2HirelingTxt.dwDifficulty) | 0) === targetDiff &&
      m.get(pRec, D2HirelingTxt.wVersion) === targetVer
    ) {
      return pRec
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FDA3190` (`D2Common.#10317`, `DATATBLS_GetHirelingTxtRecordFromClassId`,
 * `__stdcall(bExpansion, nClassId, pPrevRecord) -> D2HirelingTxt*`, `ret 0xC`).
 */
export function DATATBLS_GetHirelingTxtRecordFromClassId113c(
  m: Memory113c,
  bExpansion: number,
  nClassId: number,
  pPrevRecord: number,
): number {
  const targetClass = nClassId | 0
  const targetVer = (bExpansion | 0) !== 0 ? 100 : 0
  const pBase = m.u32(G_HIRELING_TXT_VA_113C)

  let startIdx = 0
  if (pPrevRecord !== 0) {
    startIdx = (sdiv32((pPrevRecord - pBase) | 0, D2HirelingTxt_SIZE) + 1) | 0
  }

  const nCount = m.u32(G_HIRELING_COUNT_VA_113C) | 0
  for (let i = startIdx; i < nCount; i++) {
    const pRec = (pBase + Math.imul(i, D2HirelingTxt_SIZE)) >>> 0
    if (
      (m.get(pRec, D2HirelingTxt.dwClass) | 0) === targetClass &&
      m.get(pRec, D2HirelingTxt.wVersion) === targetVer
    ) {
      return pRec
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FDA3220` (`D2Common.#10676`, `DATATBLS_GetHirelingTxtRecordFromNameId`,
 * `__stdcall(bExpansion, wNameId, pPrevRecord) -> D2HirelingTxt*`, `ret 0xC`).
 */
export function DATATBLS_GetHirelingTxtRecordFromNameId113c(
  m: Memory113c,
  bExpansion: number,
  wNameId: number,
  pPrevRecord: number,
): number {
  const nameId = wNameId & 0xffff
  const targetVer = (bExpansion | 0) !== 0 ? 100 : 0
  const pBase = m.u32(G_HIRELING_TXT_VA_113C)

  let startIdx = 0
  if (pPrevRecord !== 0) {
    startIdx = (sdiv32((pPrevRecord - pBase) | 0, D2HirelingTxt_SIZE) + 1) | 0
  }

  const nCount = m.u32(G_HIRELING_COUNT_VA_113C) | 0
  for (let i = startIdx; i < nCount; i++) {
    const pRec = (pBase + Math.imul(i, D2HirelingTxt_SIZE)) >>> 0
    if (
      m.get(pRec, D2HirelingTxt.wNameFirst) <= nameId &&
      m.get(pRec, D2HirelingTxt.wNameLast) >= nameId &&
      m.get(pRec, D2HirelingTxt.wVersion) === targetVer
    ) {
      return pRec
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FDA32C0` (`D2Common.#11156`, `DATATBLS_GetHirelingTxtRecordFromIdAndLevel`,
 * `__stdcall(bExpansion, nSubTypeId, nLevel) -> D2HirelingTxt*`, `ret 0xC`).
 */
export function DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(
  m: Memory113c,
  bExpansion: number,
  nSubTypeId: number,
  nLevel: number,
): number {
  const id = nSubTypeId | 0
  if (id >= 0x100) return 0
  const targetVer = (bExpansion | 0) !== 0 ? 100 : 0
  const lutIdx = (((bExpansion | 0) !== 0 ? 0x100 : 0) + id) | 0
  const startIdx = m.u32((G_HIRELING_SUBTYPE_LUT_VA_113C + lutIdx * 4) >>> 0) | 0
  if (startIdx < 0) return 0

  const nCount = m.u32(G_HIRELING_COUNT_VA_113C) | 0
  const pBase = m.u32(G_HIRELING_TXT_VA_113C)
  const lvl = nLevel | 0
  let bestRec = 0

  for (let i = startIdx; i < nCount; i++) {
    const pRec = (pBase + Math.imul(i, D2HirelingTxt_SIZE)) >>> 0
    const recId = m.get(pRec, D2HirelingTxt.dwSubTypeId) | 0
    if (recId === id) {
      if (m.get(pRec, D2HirelingTxt.wVersion) === targetVer) {
        if (bestRec === 0) {
          bestRec = pRec
        } else if ((m.get(pRec, D2HirelingTxt.dwHirelingLevel) | 0) > lvl) {
          break
        } else {
          bestRec = pRec
        }
      }
    } else if (recId > id) {
      break
    }
  }
  return bestRec
}

/**
 * `@va D2Common:0x6FDA3360` (`D2Common.#10288`, `DATATBLS_GetSuperUniquesTxtRecordCount`, `__stdcall() -> int`, `ret`).
 *
 * Returns `sgptDataTables->nSuperUniquesTxtRecordCount` at `0x6FDF09B4`.
 */
export function DATATBLS_GetSuperUniquesTxtRecordCount113c(m: Memory113c): number {
  return m.u32(G_SUPERUNIQUES_COUNT_VA_113C)
}

/**
 * `@va D2Common:0x6FDA3370` (`D2Common.#10038`, `DATATBLS_GetSuperUniquesTxtRecord`,
 * `__stdcall(nSuperUniqueId) -> D2SuperUniquesTxt*`, `ret 4`).
 *
 * Note: the original binary checks `(nSuperUniqueId | 0) < (m.u32(0x6FDF09B4) | 0)` (`jl`) without a `< 0` guard.
 */
export function DATATBLS_GetSuperUniquesTxtRecord113c(
  m: Memory113c,
  nSuperUniqueId: number,
): number {
  const id = nSuperUniqueId | 0
  const nCount = m.u32(G_SUPERUNIQUES_COUNT_VA_113C) | 0
  if (id < nCount) {
    const pBase = m.u32(G_SUPERUNIQUES_TXT_VA_113C)
    return (pBase + Math.imul(id, D2SuperUniquesTxt_SIZE)) >>> 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FDA3420` (`D2Common.#10634`, `DATATBLS_GetTreasureClassExRecordFromIdAndLevel`,
 * `__stdcall(wTcId, nLevel) -> D2TreasureClassExStrc*`, `ret 8`).
 */
export function DATATBLS_GetTreasureClassExRecordFromIdAndLevel113c(
  m: Memory113c,
  wTcId: number,
  nLevel: number,
): number {
  const tcId = wTcId & 0xffff
  if (tcId === 0) return 0
  const nCount = m.u32(G_TREASURECLASSEX_COUNT_VA_113C) | 0
  if (tcId >= nCount) return 0

  let pRec = (m.u32(G_TREASURECLASSEX_VA_113C) + Math.imul(tcId, D2TreasureClassExStrc_SIZE)) >>> 0
  const lvl = nLevel | 0
  if (lvl <= 0) return pRec

  const wGroup = m.get(pRec, D2TreasureClassExStrc.wGroup)
  if (wGroup === 0) return pRec

  while (m.get((pRec + D2TreasureClassExStrc_SIZE) >>> 0, D2TreasureClassExStrc.wGroup) === wGroup) {
    const pNext = (pRec + D2TreasureClassExStrc_SIZE) >>> 0
    const nextLvl = (m.get(pNext, D2TreasureClassExStrc.wLevel) << 16) >> 16
    if (nextLvl > lvl) {
      break
    }
    pRec = pNext
  }
  return pRec
}

/**
 * `@va D2Common:0x6FDA3850` (`D2Common.#10035`, `DATATBLS_GetMonsterChainInfo`,
 * `__stdcall(nMonsterId, pOutSubClassCount, pOutSubClassIndex) -> int`, `ret 0xC`).
 */
export function DATATBLS_GetMonsterChainInfo113c(
  m: Memory113c,
  nMonsterId: number,
  pOutSubClassCount: number,
  pOutSubClassIndex: number,
): number {
  const id = nMonsterId | 0
  const nCount = m.u32(G_MONSTATS_COUNT_VA_113C) | 0
  if (id < 0 || id >= nCount) {
    if (pOutSubClassCount !== 0) m.setU32(pOutSubClassCount, 0)
    if (pOutSubClassIndex !== 0) m.setU32(pOutSubClassIndex, 0)
    return 0
  }

  const pBase = m.u32(G_MONSTATS_TXT_VA_113C)
  const pRec = (pBase + Math.imul(id, D2MonStatsTxt_SIZE)) >>> 0
  if (pOutSubClassCount !== 0) {
    m.setU32(pOutSubClassCount, m.get(pRec, D2MonStatsTxt.nSubClassCount))
  }
  if (pOutSubClassIndex !== 0) {
    m.setU32(pOutSubClassIndex, m.get(pRec, D2MonStatsTxt.nSubClassIndex))
  }
  return m.get(pRec, D2MonStatsTxt.nSubClassIndex)
}
