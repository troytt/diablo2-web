/**
 * Diablo II v1.13c `D2Common.dll` unit animation speed (`Units.cpp`) and waypoint (`Waypoint.cpp`)
 * leaf functions (image base `0x6FD50000`).
 *
 * Binary evidence (`objdump -d -M intel` on 1.13c `D2Common.dll`):
 * - `#10441` (`0x6FD80B40`): `UNITS_SetAnimSpeed` (`__stdcall(pUnit, nSpeed)`, `ret 0x8`)
 * - `#10436` (`0x6FDB7E50`): `WAYPOINT_GetWaypointNoFromLevelId` (`__stdcall(nLevelId, pWaypointNoOut)`, `ret 0x8`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2DynamicPathStrc,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c,
  DATATBLS_ValidateMonStatsIdInline113c,
  MONSTERS_GetBaseIdFromMonsterUnitInline113c,
} from './inline-helpers.ts'
import { imul32 } from './int-math.ts'
import { STATES_CheckStateMask33OnUnit113c } from './statlist.ts'

/** Byte offsets of `pLevelsTxt` and `nLevelsTxtRecordCount` in `sgptDataTables` (`0x6FDB7E64..0x6FDB7E70`). */
export const DATATABLES_LEVELS_TXT_PTR_OFF_113C = 0xc58
export const DATATABLES_LEVELS_TXT_COUNT_OFF_113C = 0xc5c

/**
 * `@va D2Common:0x6FD80B40` (`D2Common.#10441` `UNITS_SetAnimSpeed`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nSpeed`, `ret 8`, void).
 *
 * Clamps signed `nSpeed` to `[0, 0x7FFF]` (`0x6FD80B44..0x6FD80B70`: `<= 0 -> 0`, `< 0x7FFF -> nSpeed`,
 * `>= 0x7FFF -> 0x7FFF`) and writes `pUnit->wAnimSpeed (+0x4C)`.
 */
export function UNITS_SetAnimSpeed113c(m: Memory113c, pUnit: number, nSpeed: number): void {
  const u = pUnit >>> 0
  const s = nSpeed | 0
  let clamped: number
  if (s <= 0) {
    clamped = 0
  } else if (s < 0x7fff) {
    clamped = s
  } else {
    clamped = 0x7fff
  }
  m.set(u, D2UnitStrc.wAnimSpeed, clamped & 0xffff)
}

/**
 * `@va D2Common:0x6FDB7E50` (`D2Common.#10436` `WAYPOINT_GetWaypointNoFromLevelId`,
 * stdcall `[esp+4] = nLevelId`, `[esp+8] = pWaypointNoOut`, `ret 8` -> `1` if valid waypoint `< 0xFF`, else `0`).
 *
 * Initializes `*pWaypointNoOut = 0x00FF` (`0x6FDB7E58 mov word [edx], 0xFF`).
 * Checks `0 < nLevelId < sgptDataTables->nLevelsTxtRecordCount (+0xC5C)` (`0x6FDB7E64..0x6FDB7E6E`, signed `jge`/`jle`),
 * indexes `sgptDataTables->pLevelsTxt (+0xC58)` with stride `0x220` (`D2LevelsTxt_SIZE`), zero-extends
 * `pRecord->nWaypoint (+0xE4)` into `u16`, writes `*pWaypointNoOut`, and returns `1` if `nWaypoint != 0xFF`, else `0`.
 */
export function WAYPOINT_GetWaypointNoFromLevelId113c(
  m: Memory113c,
  nLevelId: number,
  pWaypointNoOut: number,
): number {
  const outPtr = pWaypointNoOut >>> 0
  const lvlId = nLevelId | 0
  m.setU16(outPtr, 0x00ff)

  const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const count = m.u32((dt + DATATABLES_LEVELS_TXT_COUNT_OFF_113C) >>> 0) | 0
  if (lvlId >= count || lvlId <= 0) {
    return 0
  }

  const pLevelsBase = m.u32((dt + DATATABLES_LEVELS_TXT_PTR_OFF_113C) >>> 0)
  const pRec = (pLevelsBase + imul32(lvlId, D2LevelsTxt_SIZE)) >>> 0
  if (pRec === 0) {
    return 0
  }

  const wp = m.get(pRec, D2LevelsTxt.nWaypoint) & 0xff
  m.setU16(outPtr, wp)
  return wp === 0xff ? 0 : 1
}

const WAYPOINT_ASSERT_FILE_113C = '..\\Source\\D2Common\\WayPoint\\Waypoint.cpp'
export const GW_WAYPOINT_TABLE_BASE_VA_113C = 0x6fde9c58
export const GDW_WAYPOINT_TABLE_COUNT_VA_113C = 0x6fde9e18

/**
 * `@va D2Common:0x6FD80E80` (`D2Common.#11129` `UNITS_SetTargetUnitForDynamicUnit`, 90 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pTargetUnit`, `ret 0x8`, void).
 */
export function UNITS_SetTargetUnitForDynamicUnit113c(
  m: Memory113c,
  pUnit: number,
  pTargetUnit: number,
): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0x8ac)
  }
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType) | 0
  if (unitType < 0 || (unitType > 1 && unitType !== 3)) {
    throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0x8ae)
  }
  const pDynamicPath = m.get(pUnit, D2UnitStrc.pPath)
  m.set(pDynamicPath, D2DynamicPathStrc.pTargetUnit, pTargetUnit >>> 0)
  if (pTargetUnit >>> 0 !== 0) {
    m.set(
      pDynamicPath,
      D2DynamicPathStrc.dwTargetType,
      m.get(pTargetUnit, D2UnitStrc.dwUnitType),
    )
    m.set(pDynamicPath, D2DynamicPathStrc.dwTargetId, m.get(pTargetUnit, D2UnitStrc.dwUnitId))
  }
}

/**
 * `@va D2Common:0x6FDB7C20` (`D2Common.#11154` `WAYPOINT_ActivateWaypoint`, 103 bytes,
 * stdcall `[esp+4] = pWaypointData`, `[esp+8] = nWaypoint`, `ret 0x8`, void).
 */
export function WAYPOINT_ActivateWaypoint113c(
  m: Memory113c,
  pWaypointData: number,
  nWaypoint: number,
): void {
  if (pWaypointData >>> 0 === 0) {
    throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0xed)
  }
  if (m.u32(GDW_WAYPOINT_TABLE_COUNT_VA_113C) !== 0x70) {
    throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0xee)
  }
  const wpIdx = nWaypoint & 0xffff
  if (wpIdx >= 0x70) {
    throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0xf1)
  }
  const wordIdx = m.u16((GW_WAYPOINT_TABLE_BASE_VA_113C + wpIdx * 4) >>> 0)
  const bitMask = m.u16((GW_WAYPOINT_TABLE_BASE_VA_113C + 2 + wpIdx * 4) >>> 0)
  const wordAddr = (pWaypointData + wordIdx * 2) >>> 0
  m.setU16(wordAddr, (m.u16(wordAddr) | bitMask) & 0xffff)
}

/**
 * `@va D2Common:0x6FDB7C90` (`D2Common.#10373` `WAYPOINT_GetWaypointState`, 102 bytes,
 * stdcall `[esp+4] = pWaypointData`, `[esp+8] = nWaypoint`, `ret 0x8` -> `number`).
 */
export function WAYPOINT_GetWaypointState113c(
  m: Memory113c,
  pWaypointData: number,
  nWaypoint: number,
): number {
  if (pWaypointData >>> 0 === 0) {
    throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0xdd)
  }
  if (m.u32(GDW_WAYPOINT_TABLE_COUNT_VA_113C) !== 0x70) {
    throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0xde)
  }
  const wpIdx = nWaypoint & 0xffff
  if (wpIdx >= 0x70) {
    throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0xe1)
  }
  const wordIdx = m.u16((GW_WAYPOINT_TABLE_BASE_VA_113C + wpIdx * 4) >>> 0)
  const bitMask = m.u16((GW_WAYPOINT_TABLE_BASE_VA_113C + 2 + wpIdx * 4) >>> 0)
  return (m.u16((pWaypointData + wordIdx * 2) >>> 0) & bitMask) >>> 0
}

/**
 * `@va D2Common:0x6FDB7D00` (`D2Common.#10027` `WAYPOINT_CopyAndValidateWaypointData`, 91 bytes,
 * stdcall `[esp+4] = pSrc`, `[esp+8] = pDst`, `ret 0x8`, void).
 */
export function WAYPOINT_CopyAndValidateWaypointData113c(
  m: Memory113c,
  pSrc: number,
  pDst: number,
): void {
  const wMagic = m.u16(pSrc >>> 0)
  if (wMagic !== 0x0102) {
    if (wMagic === 0 || wMagic === 0x0101) {
      m.setU16(pSrc >>> 0, 0x0102)
    } else {
      throw new D2CommonAssertError(WAYPOINT_ASSERT_FILE_113C, 0x113)
    }
  }
  for (let i = 0; i < 0x10; i += 4) {
    m.setU32((pDst + i) >>> 0, m.u32((pSrc + i) >>> 0))
  }
}

const UNITS_ASSERT_FILE_113C = '..\\Source\\D2Common\\Units\\Units.cpp'

/** `UNITS_IsInMovingMode` monster mode (`mode - 2` in `0..13`) case index byte table at `0x6FD81490`. */
const MON_MOVING_MODE_INDEX_6FD81490 = Uint8Array.from([
  0, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 0,
])

/**
 * `@va D2Common:0x6FD811B0` (`D2Common.#10965` `UNITS_IsCorpseUseable`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0` or `1`).
 *
 * Returns `0` unless `pUnit != NULL && pUnit->dwUnitType == 1 && pUnit->dwAnimMode (+0x10) == 12`.
 * Resolves `pMonStats2 = DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline(pUnit->dwClassId)` (`0x6FD513B0`);
 * returns `0` if null, if `(pMonStats2[+0x06] & gdwBitMasks[3]) != 0`, or if
 * `(pMonStats2[+0x04] & gdwBitMasks[7]) == 0`; otherwise returns `STATES_CheckStateMask33OnUnit(pUnit) == 0 ? 1 : 0`.
 */
export function UNITS_IsCorpseUseable113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0 || m.get(u, D2UnitStrc.dwUnitType) !== 1) return 0
  if (m.get(u, D2UnitStrc.dwAnimMode) !== 0x0c) return 0
  const pMonStats2 = DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(
    m,
    m.get(u, D2UnitStrc.dwClassId),
  )
  if (pMonStats2 === 0) return 0
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  if ((m.u8((pBitMasks + 0x0c) >>> 0) & m.u8((pMonStats2 + 0x06) >>> 0)) !== 0) return 0
  if ((m.u8((pBitMasks + 0x1c) >>> 0) & m.u8((pMonStats2 + 0x04) >>> 0)) === 0) return 0
  return STATES_CheckStateMask33OnUnit113c(m, u) === 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD813F0` (`D2Common.#10143` `UNITS_IsInMovingMode`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0` or `1`).
 *
 * Returns `0` if `pUnit == NULL`.
 * - Player (`dwUnitType == 0`): reads `mode = pAnimSeq (+0x30) != 0 ? dwSeqMode (+0x40) : dwAnimMode (+0x10)`
 *   and returns `1` iff `mode` is `2`, `3`, or `6` (unsigned compares).
 * - Monster (`dwUnitType == 1`): indexes `MON_MOVING_MODE_INDEX_6FD81490[dwAnimMode - 2]` (`0..13`):
 *   case `0` (`mode` `2` or `15`) -> `1`; case `1` (`mode` `8` or `9`) -> `1` iff validated base monster ID is `0x6E` (`110`);
 *   otherwise `0`.
 * - Missile (`dwUnitType == 3`): asserts at `Units.cpp:0x1325` (`4901`).
 * - All other unit types return `0`.
 */
export function UNITS_IsInMovingMode113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const dwUnitType = m.get(u, D2UnitStrc.dwUnitType) | 0
  if (dwUnitType === 0) {
    const mode =
      m.get(u, D2UnitStrc.pAnimSeq) !== 0
        ? m.get(u, D2UnitStrc.dwSeqMode) >>> 0
        : m.get(u, D2UnitStrc.dwAnimMode) >>> 0
    if (mode < 2) return 0
    if (mode <= 3) return 1
    return mode === 6 ? 1 : 0
  }
  if (dwUnitType === 1) {
    const idx = (m.get(u, D2UnitStrc.dwAnimMode) - 2) >>> 0
    if (idx > 0x0d) return 0
    const cls = MON_MOVING_MODE_INDEX_6FD81490[idx]!
    if (cls === 0) return 1
    if (cls === 1) {
      const baseId = MONSTERS_GetBaseIdFromMonsterUnitInline113c(m, u)
      return DATATBLS_ValidateMonStatsIdInline113c(m, baseId) === 0x6e ? 1 : 0
    }
    return 0
  }
  if (dwUnitType === 3) {
    throw new D2CommonAssertError(UNITS_ASSERT_FILE_113C, 0x1325)
  }
  return 0
}

