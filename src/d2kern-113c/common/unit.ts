/**
 * Diablo II v1.13c `D2UnitStrc` & `D2ActiveRoomStrc` unit/room primitives.
 *
 * Binary evidence (`D2Common.dll`, image base `0x6FD50000`):
 * - `UNIT_Alloc` (`#11153` @ `0x6FD7F370`): `D2UnitStrc` unified layout (`0xF4` bytes: `mov edx, 0xF4` at `0x6FD7F383`).
 * - `UNITS_GetX` (`0x6FD51050`, `ecx = pUnit`) / `UNITS_GetY` (`0x6FD51080`, `ecx = pUnit`):
 *   - `dwUnitType` in `{2, 4, 5}` (object, item, tile -> `D2StaticPathStrc` at `+0x2C`):
 *     X = `u32(pPath + 0x0C)`, Y = `u32(pPath + 0x10)`.
 *   - `dwUnitType` in `{0, 1, 3}` (player, monster, missile -> `D2DynamicPathStrc` at `+0x2C`):
 *     X = `u16(pPath + 0x02)` (`wPosX`), Y = `u16(pPath + 0x06)` (`wPosY`), or `0` if `pPath == 0`.
 * - `UNITROOM_RefreshUnit` (`#10158 0x6FDB65C0`): sets `unit.dwFlags |= 0x2000`, `*room.pActUpdateFlag = 1`,
 *   and head-inserts `unit` into `room.pUpdateList (+0x1C)` via `unit.pRoomUpdateNext (+0xE0)`.
 * - `UNITROOM_ClearUpdateQueue` (`#10796 0x6FDB63B0`): walks `room.pUpdateList (+0x1C)`, clearing
 *   `unit.dwFlags &= ~0x2000` and `unit.pRoomUpdateNext = 0`, then sets `room.pUpdateList = 0`.
 * - `UNITROOM_AddUnitToRoom` (`#10531 0x6FDB6800`): head-inserts `unit` into `room.pUnitFirst (+0x74)`
 *   via `unit.pRoomUnitNext (+0xE8)` (does NOT write `pPath->pRoom`!), calls `UNITROOM_RefreshUnit`,
 *   and increments `room.nAlliedCount (+0x28)` for players (`dwUnitType == 0`) or alignment-2 monsters (`0x6FDB687B..89`).
 * - `UNITROOM_RemoveUnitFromRoom` (`#11016 0x6FDB6700`): unlinks `unit` from `room.pUnitFirst (+0x74)`
 *   chain, decrements `room.nAlliedCount (+0x28)` for players or alignment-2 monsters (`0x6FDB67B0..C6`),
 *   unlinks from `room.pUpdateList (+0x1C)`, clears `unit.dwFlags &= ~0x2000`, and zeroes `pPath->pRoom`.
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import type { D2SeedStrc } from '../prng.ts'
import { D2ActiveRoomStrc, D2StatListStrc, D2UnitStrc } from '../mem/layout.generated.ts'
import { STATES_CheckState113c, STATLIST_FLAG_EXTENDED } from './statlist.ts'

export const UNIT_PLAYER = 0
export const UNIT_MONSTER = 1
export const UNIT_OBJECT = 2
export const UNIT_MISSILE = 3
export const UNIT_ITEM = 4
export const UNIT_TILE = 5

export const UNITFLAG_ISUPDATE = 0x00002000

/** `D2Common.#11153` (`0x6FD7F370`): `sizeof(D2UnitStrc) = 0xF4` (`244` bytes). */
export const D2UNIT_ALLOC_SIZE_113C = 0xf4

const DYNPATH_SIZE = 0x40
const STATICPATH_SIZE = 0x20

/** `@va D2Common:0x6FD7F370` (`D2Common.#11153` `UNIT_Alloc`): allocate a `0xF4`-byte `D2UnitStrc`. */
export function UNIT_Alloc113c(m: Memory113c, unitType = 0): number {
  const pUnit = m.alloc(D2UNIT_ALLOC_SIZE_113C)
  m.set(pUnit, D2UnitStrc.dwUnitType, unitType >>> 0)
  return pUnit
}

export function UNITS_Create113c(
  m: Memory113c,
  unitType: number,
  classId: number,
  unitId: number,
  pGame = 0,
): number {
  const pUnit = UNIT_Alloc113c(m, unitType)
  m.set(pUnit, D2UnitStrc.dwClassId, classId >>> 0)
  m.set(pUnit, D2UnitStrc.dwUnitId, unitId >>> 0)
  m.set(pUnit, D2UnitStrc.pGame, pGame >>> 0)
  return pUnit
}

/** Allocate and attach an isomorphic path (`D2DynamicPathStrc` for `0,1,3` or `D2StaticPathStrc` for `2,4,5`). */
export function UNITS_InitPath113c(m: Memory113c, pUnit: number, x: number, y: number, pRoom = 0): number {
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const isStatic = unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE
  const pPath = m.alloc(isStatic ? STATICPATH_SIZE : DYNPATH_SIZE)
  m.set(pUnit, D2UnitStrc.pPath, pPath)
  if (isStatic) {
    // D2StaticPathStrc: +0x00 pRoom, +0x0C dwPosX, +0x10 dwPosY
    m.setU32(pPath + 0x00, pRoom >>> 0)
    m.setU32(pPath + 0x0c, x >>> 0)
    m.setU32(pPath + 0x10, y >>> 0)
  } else {
    // D2DynamicPathStrc: +0x00 wOffsetX, +0x02 wPosX, +0x04 wOffsetY, +0x06 wPosY, +0x1C pRoom
    m.setU16(pPath + 0x02, x & 0xffff)
    m.setU16(pPath + 0x06, y & 0xffff)
    m.setU32(pPath + 0x1c, pRoom >>> 0)
  }
  return pPath
}

export function UNITS_GetRoom113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return 0
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const isStatic = unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE
  return isStatic ? m.u32(pPath + 0x00) : m.u32(pPath + 0x1c)
}

export function UNITS_SetRoom113c(m: Memory113c, pUnit: number, pRoom: number): void {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const isStatic = unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE
  m.setU32(pPath + (isStatic ? 0x00 : 0x1c), pRoom >>> 0)
}

/** `D2Common 0x6FD51050` (`UNITS_GetX`, `ecx = pUnit`). */
export function UNITS_GetX113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return 0
  if (unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE) {
    return m.u32(pPath + 0x0c) | 0
  }
  return m.u16(pPath + 0x02)
}

/** `D2Common 0x6FD51080` (`UNITS_GetY`, `ecx = pUnit`). */
export function UNITS_GetY113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return 0
  if (unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE) {
    return m.u32(pPath + 0x10) | 0
  }
  return m.u16(pPath + 0x06)
}

/** `D2Common.#10158` (`0x6FDB65C0` `UNITROOM_RefreshUnit`). */
export function UNITROOM_RefreshUnit113c(m: Memory113c, pUnit: number): void {
  if (pUnit === 0) return
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return
  if ((m.get(pRoom, D2ActiveRoomStrc.dwFlags) & 0x04) !== 0) return
  const flags = m.get(pUnit, D2UnitStrc.dwFlags)
  if ((flags & UNITFLAG_ISUPDATE) !== 0) return

  m.set(pUnit, D2UnitStrc.dwFlags, (flags | UNITFLAG_ISUPDATE) >>> 0)
  const pActFlag = m.get(pRoom, D2ActiveRoomStrc.pActUpdateFlag)
  if (pActFlag !== 0) {
    m.setU32(pActFlag, 1)
  }
  const prevHead = m.get(pRoom, D2ActiveRoomStrc.pUpdateList)
  m.set(pUnit, D2UnitStrc.pRoomUpdateNext, prevHead)
  m.set(pRoom, D2ActiveRoomStrc.pUpdateList, pUnit)
}

/**
 * `D2Common.#10830` (`0x6FD891F0` -> `0x6FD8B650` `STATLIST_GetUnitAlignment`):
 * Returns `2` (allied/player) for `UNIT_PLAYER`, or for `UNIT_MONSTER` when state `17` (`conversion`)
 * is active (`0x6FD8920F`) or `pStatListEx->dwFlags` has bit `0x200` set (`0x6FD8B685`);
 * returns `1` when bit `0x400` is set; otherwise `0` (evil).
 */
export function UNIT_GetAlignment113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 2
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (uType !== UNIT_MONSTER) return 2
  if (STATES_CheckState113c(m, pUnit, 17) !== 0) return 2
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0) return 0
  const fl = m.get(pListEx, D2StatListStrc.dwFlags)
  if ((fl & STATLIST_FLAG_EXTENDED) === 0) return 0
  if ((fl & 0x0700) === 0) return 0
  if ((fl & 0x0100) !== 0) return 0
  if ((fl & 0x0400) !== 0) return 1
  return (fl & 0x0200) !== 0 ? 2 : 0
}

/**
 * `@va D2Common:0x6FDB63B0` (`D2Common.#10796` `UNITROOM_ClearUpdateQueue`):
 * Walks `pRoom->pUpdateList (+0x1C)`, clearing `UNITFLAG_ISUPDATE` (`0x2000`) and
 * `pRoomUpdateNext (+0xE0)` on each unit, then zeroes `pRoom->pUpdateList`.
 */
export function UNITROOM_ClearUpdateQueue113c(m: Memory113c, pRoom: number): void {
  if (pRoom === 0) return
  let cur = m.get(pRoom, D2ActiveRoomStrc.pUpdateList)
  while (cur !== 0) {
    const next = m.get(cur, D2UnitStrc.pRoomUpdateNext)
    m.set(cur, D2UnitStrc.dwFlags, (m.get(cur, D2UnitStrc.dwFlags) & ~UNITFLAG_ISUPDATE) >>> 0)
    m.set(cur, D2UnitStrc.pRoomUpdateNext, 0)
    cur = next
  }
  m.set(pRoom, D2ActiveRoomStrc.pUpdateList, 0)
}

/** `D2Common.#10531` (`0x6FDB6800` `UNITROOM_AddUnitToRoom`). */
export function UNITROOM_AddUnitToRoom113c(m: Memory113c, pUnit: number, pRoom: number): void {
  if (pUnit === 0 || pRoom === 0) return
  const prevFirst = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
  m.set(pUnit, D2UnitStrc.pRoomUnitNext, prevFirst)
  m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pUnit)
  UNITROOM_RefreshUnit113c(m, pUnit)
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (uType === UNIT_PLAYER || (uType === UNIT_MONSTER && UNIT_GetAlignment113c(m, pUnit) === 2)) {
    m.setU32(pRoom + 0x28, (m.u32(pRoom + 0x28) + 1) >>> 0)
  }
}

/** `D2Common.#11016` (`0x6FDB6700` `UNITROOM_RemoveUnitFromRoom`). */
export function UNITROOM_RemoveUnitFromRoom113c(m: Memory113c, pUnit: number): void {
  if (pUnit === 0) return
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return

  let prev = 0
  let cur = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
  while (cur !== 0 && cur !== pUnit) {
    prev = cur
    cur = m.get(cur, D2UnitStrc.pRoomUnitNext)
  }
  if (cur === pUnit) {
    const next = m.get(pUnit, D2UnitStrc.pRoomUnitNext)
    if (prev === 0) m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, next)
    else m.set(prev, D2UnitStrc.pRoomUnitNext, next)
    m.set(pUnit, D2UnitStrc.pRoomUnitNext, 0)
    const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
    if (uType === UNIT_PLAYER || (uType === UNIT_MONSTER && UNIT_GetAlignment113c(m, pUnit) === 2)) {
      m.setU32(pRoom + 0x28, (m.u32(pRoom + 0x28) - 1) >>> 0)
    }
  }
  // Unlink from room update list if present (`0x6FDB6410`)
  const flags = m.get(pUnit, D2UnitStrc.dwFlags)
  if ((flags & UNITFLAG_ISUPDATE) !== 0) {
    let uPrev = 0
    let uCur = m.get(pRoom, D2ActiveRoomStrc.pUpdateList)
    while (uCur !== 0 && uCur !== pUnit) {
      uPrev = uCur
      uCur = m.get(uCur, D2UnitStrc.pRoomUpdateNext)
    }
    if (uCur === pUnit) {
      const uNext = m.get(pUnit, D2UnitStrc.pRoomUpdateNext)
      if (uPrev === 0) m.set(pRoom, D2ActiveRoomStrc.pUpdateList, uNext)
      else m.set(uPrev, D2UnitStrc.pRoomUpdateNext, uNext)
    }
    m.set(pUnit, D2UnitStrc.pRoomUpdateNext, 0)
    m.set(pUnit, D2UnitStrc.dwFlags, (flags & ~UNITFLAG_ISUPDATE) >>> 0)
  }
  if (cur === pUnit) {
    UNITS_SetRoom113c(m, pUnit, 0)
  }
}

/** Read `pUnit->sSeed` (`+0x20` `lo`, `+0x24` `hi`). */
export function UNITS_GetSeed113c(m: Memory113c, pUnit: number): D2SeedStrc {
  if (pUnit === 0) return { lo: 0, hi: 0 }
  return {
    lo: m.get(pUnit, D2UnitStrc.seedLo) >>> 0,
    hi: m.get(pUnit, D2UnitStrc.seedHi) >>> 0,
  }
}

/** Write `pUnit->sSeed` (`+0x20` `lo`, `+0x24` `hi`). */
export function UNITS_SetSeed113c(m: Memory113c, pUnit: number, lo: number, hi: number): void {
  if (pUnit === 0) return
  m.set(pUnit, D2UnitStrc.seedLo, lo >>> 0)
  m.set(pUnit, D2UnitStrc.seedHi, hi >>> 0)
}
