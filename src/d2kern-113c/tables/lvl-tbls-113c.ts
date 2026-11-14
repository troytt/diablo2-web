/**
 * Diablo II v1.13c `D2Common.dll` `DATATBLS\LvlTbls.cpp` table lookups (image base `0x6FD50000`).
 *
 * The neighbours `0x6FDBC780` and `0x6FDBCB50` cite the `DATATBLS\LvlTbls.cpp` source string (`0x6FDDFA68`), which is
 * why the lookup below lives under `tables/`. Data-table globals are declared here with the instruction VAs that read
 * them, because the layout generator has no notion of globals.
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2LevelDefBin_SIZE,
  D2LevelsTxt_SIZE,
  D2LvlPrestTxt,
  D2LvlPrestTxt_SIZE,
  D2LvlTypesTxt_SIZE,
} from '../mem/layout.generated.ts'

/** `.data` `D2DataTablesStrc* sgptDataTables` at `0x6FDE9E1C` (initialised to the static block `0x6FDEFED8`); read at `0x6FDBC950`. */
export const SGPT_DATATABLES_VA_113C = 0x6fde9e1c
/** `sgptDataTables->pLevelsTxt` (`0x6FDBCCD6 mov edx, [ecx+0xC58]`). */
export const DATATABLES_LEVELS_TXT_OFF_113C = 0xc58
/** `sgptDataTables->nLevelsTxtRecordCount` (`0x6FDBCB2C cmp eax, [ecx+0xC5C]`, `0x6FDBCCCE cmp eax, [ecx+0xC5C]`). */
export const DATATABLES_LEVELS_COUNT_OFF_113C = 0xc5c
/** `sgptDataTables->nLvlPrestTxtRecordCount` / `nLvlTypesTxtRecordCount` (`0x6FDBC956 mov edx, [ecx+0xC68]`, `0x6FDBC99E cmp eax, [ecx+0xC68]`). */
export const DATATABLES_LVLPREST_COUNT_OFF_113C = 0xc68
/** `sgptDataTables->pLevelDefBin` accessed absolutely at `0x6FDF0B38` (`0x6FDBCB34 mov ecx, ds:0x6fdf0b38`). */
export const G_LEVELDEF_BIN_VA_113C = 0x6fdf0b38
/**
 * `sgptDataTables->pLvlPrestTxt` / `sgpLvlTypesTxt` accessed **absolutely** at `0x6FDF0B3C` (`0x6FDBC963 mov edi, ds:0x6fdf0b3c`).
 * `0x6FDF0B3C == 0x6FDEFED8 + 0xC64`, i.e. the same field of the static data-tables block, but the binary reads it
 * through the absolute address rather than through `sgptDataTables`.
 */
export const G_LVLPREST_TXT_VA_113C = 0x6fdf0b3c

/**
 * `@va D2Common:0x6FDBC230` (`D2Common.#10469`, `__stdcall(a0, a1) -> void`, `ret 8`).
 * 3-byte empty stub (`c2 08 00`).
 */
export function DATATBLS_UnusedStub10469_113c(_m: Memory113c, _a0 = 0, _a1 = 0): void {}

/**
 * `@va D2Common:0x6FDBC950` (`DATATBLS_GetLvlPrestTxtRecordFromLevelId`, not exported; LTCG `esi = nLevelId`, plain `ret`).
 * Callers `0x6FD5BBC0` (`0x6FD5BBE7 mov esi, [edi+0x1d0]; ...; call 0x6fdbc950`) and `0x6FD5CD10`.
 *
 * - `n = (*(u8**)0x6FDE9E1C)[+0xC68]`; `n <= 0` (signed `jle`) -> `0`.
 * - `base = *(u8**)0x6FDF0B3C`; for `i` in `0 .. n)` (signed `jl`): if `*(int*)(base + 0x1B0*i + 4) == nLevelId`
 *   return `base + 0x1B0*i` (`0x6FDBC983 imul eax, eax, 0x1B0; add eax, edi`, 32-bit wrapping); else `0`.
 */
export function DATATBLS_GetLvlPrestTxtRecordFromLevelId113c(m: Memory113c, nLevelId: number): number {
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const n = m.u32((pDataTables + DATATABLES_LVLPREST_COUNT_OFF_113C) >>> 0) | 0
  if (n <= 0) return 0
  const pBase = m.u32(G_LVLPREST_TXT_VA_113C)
  for (let i = 0; i < n; i++) {
    const pRec = (pBase + Math.imul(i, D2LvlPrestTxt_SIZE)) >>> 0
    if ((m.get(pRec, D2LvlPrestTxt.dwLevelId) | 0) === (nLevelId | 0)) return pRec
  }
  return 0
}

/**
 * `@va D2Common:0x6FDBC990` (`D2Common.#10986`, `DATATBLS_GetLvlTypesTxtRecord`, `__stdcall(nLevelType) -> D2LvlTypesTxt*`).
 *
 * - If `(nLevelType | 0) < 0` (`jl`) or `(nLevelType | 0) >= sgptDataTables->nLvlTypesTxtRecordCount (+0xC68)` (`jge`), returns `0`.
 * - Returns `(m.u32(0x6FDF0B3C) + Math.imul(nLevelType | 0, 0x1B0)) >>> 0`.
 */
export function DATATBLS_GetLvlTypesTxtRecord113c(m: Memory113c, nLevelType: number): number {
  const id = nLevelType | 0
  if (id < 0) return 0
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const nCount = m.u32((pDataTables + DATATABLES_LVLPREST_COUNT_OFF_113C) >>> 0) | 0
  if (id >= nCount) return 0
  const pBase = m.u32(G_LVLPREST_TXT_VA_113C)
  return (pBase + Math.imul(id, D2LvlTypesTxt_SIZE)) >>> 0
}

/**
 * `@va D2Common:0x6FDBCB20` (`D2Common.#10749`, `DATATBLS_GetLevelDefRecord`, `__fastcall(ecx=nLevelId) -> D2LevelDefBin*`).
 *
 * - If `(nLevelId | 0) < 0` (`jl`) or `(nLevelId | 0) >= sgptDataTables->nLevelsTxtRecordCount (+0xC5C)` (`jge`), returns `0`.
 * - Returns `(m.u32(0x6FDF0B38) + Math.imul(nLevelId | 0, 0x9C)) >>> 0`.
 */
export function DATATBLS_GetLevelDefRecord113c(m: Memory113c, nLevelId: number): number {
  const id = nLevelId | 0
  if (id < 0) return 0
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const nCount = m.u32((pDataTables + DATATABLES_LEVELS_COUNT_OFF_113C) >>> 0) | 0
  if (id >= nCount) return 0
  const pBase = m.u32(G_LEVELDEF_BIN_VA_113C)
  return (pBase + Math.imul(id, D2LevelDefBin_SIZE)) >>> 0
}

/**
 * `@va D2Common:0x6FDBCCC0` (`D2Common.#10014`, `DATATBLS_GetLevelsTxtRecord`, `__stdcall(nLevelId) -> D2LevelsTxt*`).
 *
 * - Note: uses `jle` (`0x6FDBCCC6`), so `nLevelId <= 0` returns `0`!
 * - If `(nLevelId | 0) >= sgptDataTables->nLevelsTxtRecordCount (+0xC5C)` (`jge`), returns `0`.
 * - Returns `(sgptDataTables->pLevelsTxt (+0xC58) + Math.imul(nLevelId | 0, 0x220)) >>> 0`.
 */
export function DATATBLS_GetLevelsTxtRecord113c(m: Memory113c, nLevelId: number): number {
  const id = nLevelId | 0
  if (id <= 0) return 0
  const pDataTables = m.u32(SGPT_DATATABLES_VA_113C)
  const nCount = m.u32((pDataTables + DATATABLES_LEVELS_COUNT_OFF_113C) >>> 0) | 0
  if (id >= nCount) return 0
  const pBase = m.u32((pDataTables + DATATABLES_LEVELS_TXT_OFF_113C) >>> 0)
  return (pBase + Math.imul(id, D2LevelsTxt_SIZE)) >>> 0
}

