/**
 * Diablo II v1.13c `D2Common.dll` `DATATBLS\ItemTbls.cpp` & `PATH\AStar.cpp` pure-leaf functions
 * (`0x6FDC1280..0x6FDCAF20`, image base `0x6FD50000`).
 *
 * Batch `B006` (7 functions in this module):
 * - `0x6FDC1280` `DATATBLS_GetGambleDataTables113c` (`#10041`)
 * - `0x6FDC17E0` `DATATBLS_GetRareAffixDataTables113c` (`#10220`)
 * - `0x6FDC1870` `DATATBLS_GetMagicAffixDataTables113c` (`#10492`)
 * - `0x6FDC1A40` `DATATBLS_GetItemDataTables113c` (`#10535`)
 * - `0x6FDCAC50` `PATH_AStar_PropagateNewFScoreToChildren113c` (internal)
 * - `0x6FDCAED0` `PATH_AStar_FindPointInVisitedCache113c` (internal)
 * - `0x6FDCAF20` `PATH_AStar_GetNodeFromPendingCache113c` (internal)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import { D2AStarNodeStrc } from '../mem/layout.generated.ts'
import { fogGetRowFromTxt113c, SGPT_ITEMS_LINKER_PTR_VA } from './datatbls-113c.ts'

/** `.data` `&sgItemDataTables` at `0x6FDEFB94` (`0x6FDC1A40 mov eax, 0x6fdefb94`). */
export const SG_ITEM_DATATABLES_VA_113C = 0x6fdefb94
/** `.data` `&sgMagicAffixDataTables` at `0x6FDEFBB8` (`0x6FDC1870 mov eax, 0x6fdefbb8`). */
export const SG_MAGIC_AFFIX_DATATABLES_VA_113C = 0x6fdefbb8
/** `.data` `&sgRareAffixDataTables` at `0x6FDEFBDC` (`0x6FDC17E0 mov eax, 0x6fdefbdc`). */
export const SG_RARE_AFFIX_DATATABLES_VA_113C = 0x6fdefbdc
/** `.data` `&sgGambleDataTables` at `0x6FDEFBF0` (`0x6FDC1280 mov eax, 0x6fdefbf0`). */
export const SG_GAMBLE_DATATABLES_VA_113C = 0x6fdefbf0

/** `.rdata` `ASTAR_HASH_X[128]` at `0x6FDDB458` (`0x6FDCAEEF add eax, [esi*4+0x6fddb458]`). */
export const ASTAR_HASH_X_VA_113C = 0x6fddb458
/** `.rdata` `ASTAR_HASH_Y[128]` at `0x6FDDB658` (`0x6FDCAEDF mov eax, [eax*4+0x6fddb658]`). */
export const ASTAR_HASH_Y_VA_113C = 0x6fddb658

/** `D2AStarContextStrc` offsets (`0x6FDCAC50`, `0x6FDCAED0`, `0x6FDCAF20`). */
export const ASTAR_CTX_PENDING_CACHE_OFF_113C = 0x0000
export const ASTAR_CTX_VISITED_CACHE_OFF_113C = 0x0200
export const ASTAR_CTX_POINTS_STACK_OFF_113C = 0x2fc8
export const ASTAR_CTX_STACK_COUNT_OFF_113C = 0x32e8

function i16(v: number): number {
  return (v << 16) >> 16
}

/**
 * `@va D2Common:0x6FDC1280` (`D2Common.#10041`, 0-arg -> `eax`).
 * Returns constant `.data` address `0x6FDEFBF0` (`&sgGambleDataTables`).
 */
export function DATATBLS_GetGambleDataTables113c(_m: Memory113c): number {
  return SG_GAMBLE_DATATABLES_VA_113C
}

/**
 * `@va D2Common:0x6FDC17E0` (`D2Common.#10220`, 0-arg -> `eax`).
 * Returns constant `.data` address `0x6FDEFBDC` (`&sgRareAffixDataTables`).
 */
export function DATATBLS_GetRareAffixDataTables113c(_m: Memory113c): number {
  return SG_RARE_AFFIX_DATATABLES_VA_113C
}

/**
 * `@va D2Common:0x6FDC1870` (`D2Common.#10492`, 0-arg -> `eax`).
 * Returns constant `.data` address `0x6FDEFBB8` (`&sgMagicAffixDataTables`).
 */
export function DATATBLS_GetMagicAffixDataTables113c(_m: Memory113c): number {
  return SG_MAGIC_AFFIX_DATATABLES_VA_113C
}

/**
 * `@va D2Common:0x6FDC1A40` (`D2Common.#10535`, 0-arg -> `eax`).
 * Returns constant `.data` address `0x6FDEFB94` (`&sgItemDataTables`).
 */
export function DATATBLS_GetItemDataTables113c(_m: Memory113c): number {
  return SG_ITEM_DATATABLES_VA_113C
}

/**
 * `@va D2Common:0x6FDCAC50` (internal, custom reg `eax=pContext, edx=pNewNode -> void`).
 *
 * Pushes `pNewNode` onto `pContext->aPointsStack` (`+0x2FC8`, count at `+0x32E8`) and iteratively
 * propagates improved `g`/`f` scores across up to 8 children (`+0x10..+0x2C`), breaking out of the
 * child loop immediately on the first NULL child pointer (`je 0x6fdcadfc`).
 */
export function PATH_AStar_PropagateNewFScoreToChildren113c(
  m: Memory113c,
  pContext: number,
  pNewNode: number,
): void {
  const ctx = pContext >>> 0
  const initCount = m.u32((ctx + ASTAR_CTX_STACK_COUNT_OFF_113C) >>> 0) | 0
  m.setU32((ctx + ASTAR_CTX_POINTS_STACK_OFF_113C + ((initCount << 2) >>> 0)) >>> 0, pNewNode >>> 0)
  m.setU32((ctx + ASTAR_CTX_STACK_COUNT_OFF_113C) >>> 0, (initCount + 1) >>> 0)

  while ((m.u32((ctx + ASTAR_CTX_STACK_COUNT_OFF_113C) >>> 0) | 0) !== 0) {
    const nextCount = ((m.u32((ctx + ASTAR_CTX_STACK_COUNT_OFF_113C) >>> 0) | 0) - 1) | 0
    m.setU32((ctx + ASTAR_CTX_STACK_COUNT_OFF_113C) >>> 0, nextCount >>> 0)
    const pCur = m.u32((ctx + ASTAR_CTX_POINTS_STACK_OFF_113C + ((nextCount << 2) >>> 0)) >>> 0)

    for (let k = 0; k < 8; k++) {
      const pChild = m.get(pCur, D2AStarNodeStrc.pChildren, k)
      if (pChild === 0) break

      const curX = m.get(pCur, D2AStarNodeStrc.wX)
      const childX = m.get(pChild, D2AStarNodeStrc.wX)
      let stepCost = 3
      if (curX === childX || m.get(pCur, D2AStarNodeStrc.wY) === m.get(pChild, D2AStarNodeStrc.wY)) {
        stepCost = 2
      }
      const newG = i16(i16(m.get(pCur, D2AStarNodeStrc.nBestDistanceFromStart)) + stepCost)
      const oldChildG = i16(m.get(pChild, D2AStarNodeStrc.nBestDistanceFromStart))
      if (newG < oldChildG) {
        m.set(pChild, D2AStarNodeStrc.pBestParent, pCur)
        m.set(pChild, D2AStarNodeStrc.nBestDistanceFromStart, newG & 0xffff)
        const childH = i16(m.get(pChild, D2AStarNodeStrc.nHeuristicDistanceToTarget))
        m.set(pChild, D2AStarNodeStrc.nFScore, (childH + newG) & 0xffff)

        const pushIdx = m.u32((ctx + ASTAR_CTX_STACK_COUNT_OFF_113C) >>> 0) | 0
        m.setU32((ctx + ASTAR_CTX_POINTS_STACK_OFF_113C + ((pushIdx << 2) >>> 0)) >>> 0, pChild)
        m.setU32((ctx + ASTAR_CTX_STACK_COUNT_OFF_113C) >>> 0, (pushIdx + 1) >>> 0)
      }
    }
  }
}

/**
 * `@va D2Common:0x6FDCAED0` (internal, `__stdcall(pContext, packedPointXY) -> D2AStarNodeStrc*`).
 *
 * Hashes `(wX = packedPointXY & 0xFFFF, wY = (packedPointXY >>> 16) & 0xFFFF)` via
 * `(ASTAR_HASH_Y[wY & 0x7F] + ASTAR_HASH_X[wX & 0x7F]) & 0x7F`, then walks the singly-linked list
 * rooted at `pContext->pVisitedCache[bucket]` (`pContext + 0x200 + bucket*4`) via `pNextCachePoint` (`+0x30`).
 */
export function PATH_AStar_FindPointInVisitedCache113c(
  m: Memory113c,
  pContext: number,
  packedPointXY: number,
): number {
  const wX = packedPointXY & 0xffff
  const wY = (packedPointXY >>> 16) & 0xffff
  const hashY = m.u32((ASTAR_HASH_Y_VA_113C + ((wY & 0x7f) << 2)) >>> 0)
  const hashX = m.u32((ASTAR_HASH_X_VA_113C + ((wX & 0x7f) << 2)) >>> 0)
  const bucket = (hashY + hashX) & 0x7f
  let pNode = m.u32(((pContext >>> 0) + ASTAR_CTX_VISITED_CACHE_OFF_113C + (bucket << 2)) >>> 0)
  while (pNode !== 0) {
    if (m.get(pNode, D2AStarNodeStrc.wX) === wX && m.get(pNode, D2AStarNodeStrc.wY) === wY) {
      return pNode
    }
    pNode = m.get(pNode, D2AStarNodeStrc.pNextCachePoint)
  }
  return 0
}

/**
 * `@va D2Common:0x6FDCAF20` (internal, `__stdcall(pContext, packedPointXY) -> D2AStarNodeStrc*`).
 *
 * Identical to `0x6FDCAED0`, except it indexes `pContext->pPendingCache[bucket]` (`pContext + 0x00 + bucket*4`).
 */
export function PATH_AStar_GetNodeFromPendingCache113c(
  m: Memory113c,
  pContext: number,
  packedPointXY: number,
): number {
  const wX = packedPointXY & 0xffff
  const wY = (packedPointXY >>> 16) & 0xffff
  const hashY = m.u32((ASTAR_HASH_Y_VA_113C + ((wY & 0x7f) << 2)) >>> 0)
  const hashX = m.u32((ASTAR_HASH_X_VA_113C + ((wX & 0x7f) << 2)) >>> 0)
  const bucket = (hashY + hashX) & 0x7f
  let pNode = m.u32(((pContext >>> 0) + ASTAR_CTX_PENDING_CACHE_OFF_113C + (bucket << 2)) >>> 0)
  while (pNode !== 0) {
    if (m.get(pNode, D2AStarNodeStrc.wX) === wX && m.get(pNode, D2AStarNodeStrc.wY) === wY) {
      return pNode
    }
    pNode = m.get(pNode, D2AStarNodeStrc.pNextCachePoint)
  }
  return 0
}

// ============================================================================
// K1r2 Iteration 7 Lane B — Batch B036 (item-tbls-113c.ts)
// ============================================================================

/**
 * `@va D2Common:0x6FDC1940` (`D2Common.#10814` `DATATBLS_GetItemIdFromItemCode`,
 * stdcall `[esp+4] = dwCode`, `ret 4` -> `int32_t` item row index or `-1`).
 */
export function DATATBLS_GetItemIdFromItemCode113c(m: Memory113c, dwCode: number): number {
  return fogGetRowFromTxt113c(m, m.u32(SGPT_ITEMS_LINKER_PTR_VA), dwCode >>> 0, 0) >>> 0
}

