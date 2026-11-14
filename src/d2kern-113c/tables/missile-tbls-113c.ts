/**
 * Diablo II v1.13c `D2Common.dll` `DRLG\DrlgRoom.cpp` & `DATATBLS\MissileTbls.cpp` pure-leaf functions
 * (`0x6FDCBB70..0x6FDCC4A0`, image base `0x6FD50000`).
 *
 * Batch `B006` (5 functions in this module):
 * - `0x6FDCBB70` `DRLGROOM_SetStatusLink113c` (internal)
 * - `0x6FDCBC60` `DRLGROOM_SetStatusLink3_113c` (internal)
 * - `0x6FDCBCD0` `DRLGROOM_SetStatusLink1_113c` (internal)
 * - `0x6FDCBD40` `DRLGROOM_SetStatusLink0_113c` (internal)
 * - `0x6FDCC4A0` `DATATBLS_CalcMissileSubLoopFrames113c` (`#11169`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import { sdiv32 } from '../common/int-math.ts'
import {
  D2DrlgLevelStrc,
  D2MissilesTxt,
  D2MissilesTxt_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
} from '../mem/layout.generated.ts'

/** `.data` `D2MissilesTxt* sgpMissilesTxt` at `0x6FDF0A3C` (`0x6FDCC4B0 mov ecx, ds:0x6fdf0a3c`). */
export const SGP_MISSILES_TXT_VA_113C = 0x6fdf0a3c
/** `.data` `int32 sgnMissilesTxtRecordCount` at `0x6FDF0A44` (`0x6FDCC4A8 cmp eax, ds:0x6fdf0a44`). */
export const SGN_MISSILES_TXT_COUNT_VA_113C = 0x6fdf0a44

/** `D2DrlgStrc->tStatusRoomsLists[4]` base offset (`0x6FDCBBC0 lea ecx, [ecx+edx+0xA0]`). */
export const DRLG_STATUS_ROOMS_LIST_OFF_113C = 0xa0

/**
 * `@va D2Common:0x6FDCBB70` (internal, custom reg `eax=pRoomEx, ebx(bl)=nNewStatus -> EAX = pRoomEx`).
 *
 * Unlinks `pRoomEx` from its current doubly-linked status list if both `pStatusNext` (`+0xE8`) and
 * `pStatusPrev` (`+0x1C`) are non-null, and if `(nNewStatus & 0xFF) < 4`, inserts `pRoomEx` after
 * the sentinel node `pRoomEx->pLevel (+0x58)->pDrlg (+0x1B4) + 0xA0 + (nNewStatus & 0xFF) * 0xEC`
 * and updates `pRoomEx->nRoomStatus (+0x44) = nNewStatus & 0xFF`.
 * Preserves `EAX = pRoomEx` on all return paths as relied upon by all 4 callers (`mov byte [eax+0x44], bl`).
 */
export function DRLGROOM_SetStatusLink113c(m: Memory113c, pRoomEx: number, nNewStatus: number): number {
  const room = pRoomEx >>> 0
  const bl = nNewStatus & 0xff
  if (m.get(room, D2RoomExStrc.nRoomStatus) === bl) return room

  const pNext = m.get(room, D2RoomExStrc.pStatusNext)
  if (pNext !== 0) {
    const pPrev = m.get(room, D2RoomExStrc.pStatusPrev)
    if (pPrev !== 0) {
      m.set(pNext, D2RoomExStrc.pStatusPrev, pPrev)
      const pPrevReload = m.get(room, D2RoomExStrc.pStatusPrev)
      const pNextReload = m.get(room, D2RoomExStrc.pStatusNext)
      m.set(pPrevReload, D2RoomExStrc.pStatusNext, pNextReload)
      m.set(room, D2RoomExStrc.pStatusNext, 0)
      m.set(room, D2RoomExStrc.pStatusPrev, 0)
    }
  }

  if (bl >= 4) return room

  const pLevel = m.get(room, D2RoomExStrc.pLevel)
  const pDrlg = m.get(pLevel, D2DrlgLevelStrc.pDrlg)
  const pSentinel = (pDrlg + DRLG_STATUS_ROOMS_LIST_OFF_113C + Math.imul(bl, D2RoomExStrc_SIZE)) >>> 0
  m.set(room, D2RoomExStrc.pStatusPrev, pSentinel)
  const pOldNext = m.get(pSentinel, D2RoomExStrc.pStatusNext)
  m.set(room, D2RoomExStrc.pStatusNext, pOldNext)
  const pOldNextReload = m.get(pSentinel, D2RoomExStrc.pStatusNext)
  m.set(pOldNextReload, D2RoomExStrc.pStatusPrev, room)
  m.set(pSentinel, D2RoomExStrc.pStatusNext, room)
  m.set(room, D2RoomExStrc.nRoomStatus, bl)
  return room
}

/**
 * `@va D2Common:0x6FDCBC60` (internal, custom reg `eax=pRoomEx -> void`).
 * Constant-specialized clone of `0x6FDCBB70` for `nNewStatus = 3` (`0xA0 + 3 * 0xEC = 0x364`).
 */
export function DRLGROOM_SetStatusLink3_113c(m: Memory113c, pRoomEx: number): void {
  DRLGROOM_SetStatusLink113c(m, pRoomEx, 3)
}

/**
 * `@va D2Common:0x6FDCBCD0` (internal, custom reg `eax=pRoomEx -> void`).
 * Constant-specialized clone of `0x6FDCBB70` for `nNewStatus = 1` (`0xA0 + 1 * 0xEC = 0x18C`).
 */
export function DRLGROOM_SetStatusLink1_113c(m: Memory113c, pRoomEx: number): void {
  DRLGROOM_SetStatusLink113c(m, pRoomEx, 1)
}

/**
 * `@va D2Common:0x6FDCBD40` (internal, custom reg `eax=pRoomEx -> void`).
 * Constant-specialized clone of `0x6FDCBB70` for `nNewStatus = 0` (`0xA0 + 0 * 0xEC = 0xA0`).
 */
export function DRLGROOM_SetStatusLink0_113c(m: Memory113c, pRoomEx: number): void {
  DRLGROOM_SetStatusLink113c(m, pRoomEx, 0)
}

/**
 * `@va D2Common:0x6FDCC4A0` (`D2Common.#11169`, `DATATBLS_CalcMissileSubLoopFrames`, `__stdcall(nMissileId, nLevel) -> int`).
 *
 * - If `(nMissileId | 0) < 0` (`jl`) or `(nMissileId | 0) >= sgnMissilesTxtRecordCount (0x6FDF0A44)` (`jge`), returns `0`.
 * - Computes `pRec = (m.u32(0x6FDF0A3C) + Math.imul(nMissileId | 0, 0x1A4)) >>> 0`; if `pRec === 0`, returns `0`.
 * - Reads `u8_9B = pRec->nSubStart (+0x9B)` and `u8_9A = pRec->nSubLoop (+0x9A)`, and returns
 *   `(sdiv32(Math.imul(u8_9B, nLevel | 0), 8) + u8_9A) >>> 0` (`cdq; and edx, 7; add eax, edx; sar eax, 3; add eax, ecx`).
 */
export function DATATBLS_CalcMissileSubLoopFrames113c(
  m: Memory113c,
  nMissileId: number,
  nLevel: number,
): number {
  const id = nMissileId | 0
  if (id < 0) return 0
  const nCount = m.u32(SGN_MISSILES_TXT_COUNT_VA_113C) | 0
  if (id >= nCount) return 0
  const pBase = m.u32(SGP_MISSILES_TXT_VA_113C)
  const pRec = (pBase + Math.imul(id, D2MissilesTxt_SIZE)) >>> 0
  if (pRec === 0) return 0
  const nSubStart = m.get(pRec, D2MissilesTxt.nSubStart)
  const prod = Math.imul(nSubStart, nLevel | 0)
  const nSubLoop = m.get(pRec, D2MissilesTxt.nSubLoop)
  return (sdiv32(prod, 8) + nSubLoop) >>> 0
}

// ============================================================================
// K1r3 Iteration 9 Lane B — Batch I9B-B (missile-tbls-113c.ts): RoomEx status refresh helpers
// ============================================================================

/**
 * Shared body of the four byte-identical `DRLGROOM_RefreshStatusFromCounts*` clones
 * (0x6FDCBC20 / 0x6FDCBE10 / 0x6FDCBE50 / 0x6FDCBE90).
 *
 * - `s = pRoomEx->nRoomStatus (+0x44)`; if `s <u 4` (`cmp cl, 4; jae`) and `pRoomEx->wStatusCount[s] (+0xC + 2*s) != 0`,
 *   returns `pRoomEx` without writing.
 * - Otherwise `b` = first index in `0..3` whose `wStatusCount[b] != 0` (`inc bl; cmp bl, 4; jb`), or `4` when all are 0.
 * - `r = DRLGROOM_SetStatusLink113c(pRoomEx, b)` (`call 0x6FDCBB70`, returns `pRoomEx` in `eax`), then
 *   `r->nRoomStatus = b` (`mov [eax+0x44], bl`) and returns `r`.
 */
function drlgRoomRefreshStatusFromCounts(m: Memory113c, pRoomEx: number): number {
  const room = pRoomEx >>> 0
  const s = m.get(room, D2RoomExStrc.nRoomStatus)
  if (s < 4 && m.get(room, D2RoomExStrc.wStatusCount, s) !== 0) {
    return room
  }
  let b = 0
  do {
    if (m.get(room, D2RoomExStrc.wStatusCount, b) !== 0) break
    b = (b + 1) & 0xff
  } while (b < 4)
  const r = DRLGROOM_SetStatusLink113c(m, room, b)
  m.set(r, D2RoomExStrc.nRoomStatus, b)
  return r
}

/** `@va D2Common:0x6FDCBC20` (internal, custom reg `eax = pRoomEx` -> `eax = pRoomEx`, `ebx` preserved). */
export function DRLGROOM_RefreshStatusFromCountsEax113c(m: Memory113c, pRoomEx: number): number {
  return drlgRoomRefreshStatusFromCounts(m, pRoomEx)
}

/** `@va D2Common:0x6FDCBE10` (internal, `__fastcall(ecx = pRoomEx)` -> `eax = pRoomEx`; `mov eax, ecx` then the 0x6FDCBC20 body). */
export function DRLGROOM_RefreshStatusFromCountsA113c(m: Memory113c, pRoomEx: number): number {
  return drlgRoomRefreshStatusFromCounts(m, pRoomEx)
}

/** `@va D2Common:0x6FDCBE50` (internal, `__fastcall(ecx = pRoomEx)` -> `eax = pRoomEx`; byte-identical to 0x6FDCBE10). */
export function DRLGROOM_RefreshStatusFromCountsB113c(m: Memory113c, pRoomEx: number): number {
  return drlgRoomRefreshStatusFromCounts(m, pRoomEx)
}

/** `@va D2Common:0x6FDCBE90` (internal, `__fastcall(ecx = pRoomEx)` -> `eax = pRoomEx`; byte-identical to 0x6FDCBE10). */
export function DRLGROOM_RefreshStatusFromCounts113c(m: Memory113c, pRoomEx: number): number {
  return drlgRoomRefreshStatusFromCounts(m, pRoomEx)
}

/** `@va D2Common:0x6FDCBED0` (internal, `__fastcall(ecx = pRoomEx)` -> void; `mov eax, ecx; jmp 0x6FDCBD40`). */
export function DRLGROOM_SetStatusLink0Fastcall113c(m: Memory113c, pRoomEx: number): void {
  DRLGROOM_SetStatusLink0_113c(m, pRoomEx)
}
