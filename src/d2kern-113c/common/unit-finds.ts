/**
 * Diablo II v1.13c `D2Common.dll` unit search primitives (`UnitFinds.cpp`, image base `0x6FD50000`).
 *
 * Binary evidence (`objdump -d -M intel` on 1.13c `D2Common.dll`):
 * - `#10344` (`0x6FD62000`): `UNITFINDS_FreeUnitFindData` (`__stdcall(pUnitFindData)`, `ret 4`)
 * - `#10591` (`0x6FD62030`): `UNITFINDS_InitUnitFindData` (`__stdcall(...)`, `ret 0x20`)
 * - `0x6FD620F0`: `UNITFINDS_GrowUnitsArray` (custom LTCG `esi = pUnitFindData`, `ret`)
 * - `#10754` (`0x6FD622B0`): `UNITFINDS_FindUnitInAdjacentRooms` (`__stdcall(pRoom, nUnitType, nClassId)`, `ret 0xC`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2ActiveRoomStrc,
  D2UnitFindDataStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  DRLG_IsTownLevel113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_IsSquareOutsideRoomInterior113c,
  DUNGEON_IsSquareTouchingRoomBounds113c,
} from './dungeon.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATABLES_OFF_113C,
  DATATBLS_GetMissilesTxtRecordInline113c,
} from './inline-helpers.ts'
import { imul32 } from './int-math.ts'
import { COLLISION_CheckSubtileMask113c } from './collision.ts'
import { UNITS_GetRoom113c, UNITS_GetX113c, UNITS_GetY113c } from './unit.ts'
import { UNITS_GetUnitDistanceToCoordinates113c } from './skills.ts'
import { MONSTERS_IsDemonOrUndead113c } from '../tables/datatbls-113c.ts'
import { FIELD_StepFieldCoords113c } from '../tables/field-tbls-113c.ts'

/**
 * `@va D2Common:0x6FD62000` (`D2Common.#10344` `UNITFINDS_FreeUnitFindData`,
 * stdcall `[esp+4] = pUnitFindData`, `ret 4`, void).
 *
 * If `pUnitFindData != 0` and `pUnitFindData->pUnitsArray (+0x04) != 0`, reads `pMemPool (+0x00)`,
 * frees `pUnitsArray` via `Fog.#10046` (line `0xFF` = `255`), and zeroes `pUnitFindData->pUnitsArray (+0x04)`.
 */
export function UNITFINDS_FreeUnitFindData113c(m: Memory113c, pUnitFindData: number): void {
  const pData = pUnitFindData >>> 0
  if (pData === 0) return
  const pUnitsArray = m.get(pData, D2UnitFindDataStrc.pUnitsArray)
  if (pUnitsArray === 0) return
  const pMemPool = m.get(pData, D2UnitFindDataStrc.pMemPool)
  void pMemPool
  ;(m as { free?: (p: number) => void }).free?.(pUnitsArray)
  m.set(pData, D2UnitFindDataStrc.pUnitsArray, 0)
}

/**
 * `@va D2Common:0x6FD62030` (`D2Common.#10591` `UNITFINDS_InitUnitFindData`,
 * stdcall `[esp+4] = pMemPool`, `[esp+8] = pUnitFindData`, `[esp+0xC] = pRoom`,
 * `[esp+0x10] = nX`, `[esp+0x14] = nY`, `[esp+0x18] = dwSize`,
 * `[esp+0x1C] = pfnCallback`, `[esp+0x20] = pFilterUnit`, `ret 0x20`, void).
 */
export function UNITFINDS_InitUnitFindData113c(
  m: Memory113c,
  pMemPool: number,
  pUnitFindData: number,
  pRoom: number,
  nX: number,
  nY: number,
  dwSize: number,
  pfnCallback: number,
  pFilterUnit: number,
): void {
  const pData = pUnitFindData >>> 0
  if (pData === 0) {
    throw new D2CommonAssertError('UnitFinds.cpp', 0xe2)
  }
  const pUnitsArray = m.alloc(0x3c)
  m.set(pData, D2UnitFindDataStrc.pUnitsArray, pUnitsArray)
  if (pUnitsArray === 0) {
    throw new D2CommonAssertError('UnitFinds.cpp', 0xe5)
  }
  for (let i = 0; i < 15; i++) {
    m.setU32((pUnitsArray + i * 4) >>> 0, 0)
  }
  m.set(pData, D2UnitFindDataStrc.nIndex, 0)
  m.set(pData, D2UnitFindDataStrc.dwFlags, 0)
  m.set(pData, D2UnitFindDataStrc.pRoom, pRoom >>> 0)
  m.set(pData, D2UnitFindDataStrc.nX, nX >>> 0)
  m.set(pData, D2UnitFindDataStrc.nY, nY >>> 0)
  m.set(pData, D2UnitFindDataStrc.pMemPool, pMemPool >>> 0)
  m.set(pData, D2UnitFindDataStrc.nMaxCount, 0x0f)
  m.set(pData, D2UnitFindDataStrc.dwSize, dwSize >>> 0)
  m.set(pData, D2UnitFindDataStrc.pfnCallback, pfnCallback >>> 0)
  m.set(pData, D2UnitFindDataStrc.pFilterUnit, pFilterUnit >>> 0)
}

/**
 * `@va D2Common:0x6FD620F0` (`UNITFINDS_GrowUnitsArray`,
 * custom LTCG `esi = pUnitFindData`, plain `ret` -> `pNewArray`).
 *
 * Asserts `pUnitFindData != 0` (line `0xC0` = `192`), reads `pOldArray (+0x04)`, `pMemPool (+0x00)`,
 * and `nMaxCount (+0x1C)`, grows `nMaxCount` by `+15` (`0x0F`), reallocates `(newMax << 2)` bytes
 * via `Fog.#10047` (line `0xC5` = `197`), updates `+0x1C` and `+0x04`, and returns `pNewArray`.
 */
export function UNITFINDS_GrowUnitsArray113c(m: Memory113c, pUnitFindData: number): number {
  const pData = pUnitFindData >>> 0
  if (pData === 0) {
    throw new D2CommonAssertError('UnitFinds.cpp', 0xc0)
  }
  const pOldArray = m.get(pData, D2UnitFindDataStrc.pUnitsArray)
  const pMemPool = m.get(pData, D2UnitFindDataStrc.pMemPool)
  void pMemPool
  const oldMax = m.get(pData, D2UnitFindDataStrc.nMaxCount) | 0
  const newMax = (oldMax + 0x0f) | 0
  const newByteSize = (newMax << 2) >>> 0
  const pNewArray = m.alloc(newByteSize)
  if (pOldArray !== 0) {
    const copyDwords = Math.max(0, Math.min(oldMax, newMax))
    for (let i = 0; i < copyDwords; i++) {
      m.setU32((pNewArray + i * 4) >>> 0, m.u32((pOldArray + i * 4) >>> 0))
    }
    ;(m as { free?: (p: number) => void }).free?.(pOldArray)
  }
  m.set(pData, D2UnitFindDataStrc.nMaxCount, newMax >>> 0)
  m.set(pData, D2UnitFindDataStrc.pUnitsArray, pNewArray >>> 0)
  return pNewArray >>> 0
}

/**
 * `@va D2Common:0x6FD622B0` (`D2Common.#10754` `UNITFINDS_FindUnitInAdjacentRooms`,
 * stdcall `[esp+4] = pRoom`, `[esp+8] = nUnitType`, `[esp+0xC] = nClassId`, `ret 0xC` -> `pUnit` or `0`).
 *
 * Asserts `pRoom != 0` (line `0x31` = `49`), iterates `i = 0 .. pRoom->nNumRooms (+0x24) - 1`
 * over `pRoom->ppRoomList[i] (+0x00)`, walks each near room's `pUnitFirst (+0x74)` chain via
 * `pRoomUnitNext (+0xE8)`, and returns the first unit whose `dwUnitType (+0x00) == nUnitType`
 * and `dwClassId (+0x04) == nClassId`.
 */
export function UNITFINDS_FindUnitInAdjacentRooms113c(
  m: Memory113c,
  pRoom: number,
  nUnitType: number,
  nClassId: number,
): number {
  const room = pRoom >>> 0
  if (room === 0) {
    throw new D2CommonAssertError('UnitFinds.cpp', 0x31)
  }
  const ppRoomsNear = m.get(room, D2ActiveRoomStrc.ppRoomsNear)
  const nNumRooms = m.get(room, D2ActiveRoomStrc.nRoomsNear) | 0
  const targetType = nUnitType | 0
  const targetClassId = nClassId | 0
  for (let i = 0; i < nNumRooms; i++) {
    const pNearRoom = m.u32((ppRoomsNear + i * 4) >>> 0)
    let pUnit = m.get(pNearRoom, D2ActiveRoomStrc.pUnitFirst)
    while (pUnit !== 0) {
      const uType = m.get(pUnit, D2UnitStrc.dwUnitType) | 0
      if (uType === targetType) {
        const uClassId = m.get(pUnit, D2UnitStrc.dwClassId) | 0
        if (uClassId === targetClassId) {
          return pUnit >>> 0
        }
      }
      pUnit = m.get(pUnit, D2UnitStrc.pRoomUnitNext)
    }
  }
  return 0
}

// ============================================================================
// Iteration 13 Lane A — I13A-1 (#06..#07) UnitFinds Ports
// ============================================================================

const UNITFINDS_STACK_BASE = 0x7fff0100
const UNITFINDS_STACK_SIZE = 0x10
const _ufBuf = new ArrayBuffer(UNITFINDS_STACK_SIZE)
const _ufDv = new DataView(_ufBuf)

function withUnitFindsScratch113c(m: Memory113c): Memory113c {
  if ((m as { __hasUfScratch?: boolean }).__hasUfScratch) return m
  const isScratch = (p: number): boolean => {
    const u = p >>> 0
    return u >= UNITFINDS_STACK_BASE && u < UNITFINDS_STACK_BASE + UNITFINDS_STACK_SIZE
  }
  const wrapped: Memory113c & { __hasUfScratch: boolean } = {
    __hasUfScratch: true,
    alloc: (size) => m.alloc(size),
    u8: (p) => (isScratch(p) ? _ufDv.getUint8((p >>> 0) - UNITFINDS_STACK_BASE) : m.u8(p)),
    u16: (p) => (isScratch(p) ? _ufDv.getUint16((p >>> 0) - UNITFINDS_STACK_BASE, true) : m.u16(p)),
    u32: (p) => (isScratch(p) ? _ufDv.getUint32((p >>> 0) - UNITFINDS_STACK_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isScratch(p)) _ufDv.setUint8((p >>> 0) - UNITFINDS_STACK_BASE, v & 0xff)
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isScratch(p)) _ufDv.setUint16((p >>> 0) - UNITFINDS_STACK_BASE, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isScratch(p)) _ufDv.setUint32((p >>> 0) - UNITFINDS_STACK_BASE, v >>> 0, true)
      else m.setU32(p, v)
    },
    get: (base, field, index = 0) => m.get(base, field, index),
    set: (base, field, value, index = 0) => m.set(base, field, value, index),
    fill: (p, len, v) => m.fill(p, len, v),
  }
  return wrapped
}

function checkRoomIsTownMem113c(m: Memory113c, pRoom: number): boolean {
  const r = pRoom >>> 0
  if (r === 0) return false
  const pRoomEx = m.u32((r + 0x10) >>> 0)
  if (pRoomEx === 0) return false
  const pLevel = m.u32((pRoomEx + 0x58) >>> 0)
  if (pLevel === 0) return false
  const levelId = m.u32((pLevel + 0x1d0) >>> 0) | 0
  return levelId === 1 || levelId === 40 || levelId === 75 || levelId === 103 || levelId === 109
}

export type UnitFindNearestCallback113c = (
  m: Memory113c,
  pCandidate: number,
  pUnit: number,
) => number

export type UnitFindCandidateCallback113c = (
  m: Memory113c,
  pCandidate: number,
  pSearch: number,
) => number

/**
 * `@va D2Common:0x6FD62330` (`D2Common.#10314` `UNITFINDS_FindNearestUnitInRange`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nX`, `[esp+0xC] = nY`, `[esp+0x10] = nMaxDist`,
 * `[esp+0x14] = pfnCallback`, `ret 0x14` -> `pBestUnit | 0`).
 */
export function UNITFINDS_FindNearestUnitInRange113c(
  m: Memory113c,
  pUnit: number,
  nX: number,
  nY: number,
  nMaxDist: number,
  pfnCallback: number | UnitFindNearestCallback113c,
  cb?: UnitFindNearestCallback113c,
): number {
  const u = pUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, u)
  if (pRoom === 0) {
    throw new D2CommonAssertError('UnitFinds.cpp', 0x90)
  }
  const maxDist = (nMaxDist | 0) !== 0 ? (nMaxDist | 0) : 0x10000
  const callbackFn = typeof pfnCallback === 'function' ? pfnCallback : cb
  const hasCbPtr = typeof pfnCallback === 'function' ? 1 : (pfnCallback >>> 0)
  if (hasCbPtr === 0) {
    throw new D2CommonAssertError('UnitFinds.cpp', 0x9f)
  }

  const nRooms = m.u32((pRoom + 0x24) >>> 0) | 0
  const ppRooms = m.u32(pRoom)
  const x = nX | 0
  const y = nY | 0
  let bestUnit = 0
  let bestDist = 0xffff

  for (let i = 0; i < nRooms; i++) {
    const pNearRoom = m.u32((ppRooms + i * 4) >>> 0)
    if (DUNGEON_IsSquareTouchingRoomBounds113c(m, y, pNearRoom, x, maxDist) !== 0) {
      let cand = m.u32((pNearRoom + 0x74) >>> 0)
      while (cand !== 0) {
        const dist = UNITS_GetUnitDistanceToCoordinates113c(m, cand, x, y) | 0
        if (dist < maxDist && dist < bestDist) {
          const accepted = callbackFn !== undefined ? (callbackFn(m, cand, u) | 0) : 1
          if (accepted !== 0) {
            bestUnit = cand >>> 0
            bestDist = dist
          }
        }
        cand = m.u32((cand + 0xe8) >>> 0)
      }
    }
  }
  return bestUnit >>> 0
}

/**
 * `@va D2Common:0x6FD624E0` (`D2Common.#11106` `UNITFINDS_MatchUnitCandidate`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pSearch`, `ret 8` -> `0 | 1`).
 */
export function UNITFINDS_MatchUnitCandidate113c(
  m: Memory113c,
  pUnit: number,
  pSearch: number,
  pfnCallback?: UnitFindCandidateCallback113c,
): number {
  const search = pSearch >>> 0
  if (search === 0) return 0
  let flags = m.u32(search)
  if ((flags & 0x40) !== 0) {
    if ((m.u32((search + 0x1c) >>> 0) | 0) >= (m.u32((search + 0x18) >>> 0) | 0)) {
      return 0
    }
  }

  const cand = pUnit >>> 0
  const uType = m.u32(cand) >>> 0
  const candX = UNITS_GetX113c(m, cand)
  const candY = UNITS_GetY113c(m, cand)
  const dx = (candX - (m.u32((search + 0x0c) >>> 0) | 0)) | 0
  const dy = (candY - (m.u32((search + 0x10) >>> 0) | 0)) | 0
  const range = m.u32((search + 0x14) >>> 0) | 0
  if (((imul32(dy, dy) + imul32(dx, dx)) | 0) > imul32(range, range)) {
    return 0
  }

  if (uType > 4) return 0
  if (uType === 0) {
    if ((flags & 0x01) === 0) return 0
    const mode = m.u32((cand + 0x10) >>> 0) | 0
    if ((flags & 0x1000) !== 0) {
      if (mode !== 0x11) return 0
    } else if (mode === 0x11 || mode === 0) {
      return 0
    }
    if (cand === m.u32((search + 0x08) >>> 0)) return 0
  } else if (uType === 1) {
    if ((flags & 0x02) === 0) return 0
    const mode = m.u32((cand + 0x10) >>> 0) | 0
    if ((flags & 0x1000) !== 0) {
      if (mode !== 0x0c) return 0
    } else if (mode === 0x0c || mode === 0) {
      return 0
    }
    if ((flags & 0x04) !== 0 && MONSTERS_IsDemonOrUndead113c(m, cand) === 0) {
      return 0
    }
  } else if (uType === 2) {
    if ((flags & 0x10) === 0) return 0
  } else if (uType === 3) {
    if ((flags & 0x08) === 0) return 0
    const pMisTxt = DATATBLS_GetMissilesTxtRecordInline113c(m, m.u32((cand + 4) >>> 0))
    if (pMisTxt === 0) return 0
    const misFlags = m.u8((pMisTxt + 0x04) >>> 0)
    const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
    if ((m.u8((pBitMasks + 0x04) >>> 0) & misFlags) !== 0) {
      return 0
    }
  } else {
    // uType === 4
    if ((flags & 0x20) === 0) return 0
  }

  if ((flags & 0x80) !== 0) {
    if (((m.u32((cand + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0
  }
  if ((flags & 0x400) !== 0) {
    if (((m.u32((cand + 0xc4) >>> 0) >>> 3) & 1) === 0) return 0
  }
  if ((flags & 0x100) !== 0) {
    if (checkRoomIsTownMem113c(m, UNITS_GetRoom113c(m, cand))) return 0
  }

  flags = m.u32(search)
  if ((flags & 0x200) !== 0) {
    const pRoom = UNITS_GetRoom113c(m, cand)
    if (pRoom !== 0) {
      const pField = m.u32((search + 0x20) >>> 0)
      const sm = withUnitFindsScratch113c(m)
      sm.setU32(UNITFINDS_STACK_BASE, candX >>> 0)
      sm.setU32(UNITFINDS_STACK_BASE + 4, candY >>> 0)
      while (
        FIELD_StepFieldCoords113c(
          sm,
          pField,
          UNITFINDS_STACK_BASE,
          UNITFINDS_STACK_BASE + 4,
        ) !== 0
      ) {
        const fx = sm.u32(UNITFINDS_STACK_BASE) | 0
        const fy = sm.u32(UNITFINDS_STACK_BASE + 4) | 0
        if ((COLLISION_CheckSubtileMask113c(m, pRoom, fx, fy, 4) & 0xffff) === 4) {
          return 0
        }
      }
    }
  }

  flags = m.u32(search)
  if ((flags & 0x800) !== 0) {
    const cbPtr = m.u32((search + 0x24) >>> 0)
    if (cbPtr !== 0 && pfnCallback !== undefined) {
      if ((pfnCallback(m, cand, search) | 0) !== 0) {
        return 0
      }
    }
  }

  m.setU32((search + 0x1c) >>> 0, (m.u32((search + 0x1c) >>> 0) + 1) >>> 0)
  return 1
}


/**
 * `@va D2Common:0x6FD62720` (`D2Common.#10052` `UNITFINDS_FindAllMatchingUnitsInAdjacentRooms`,
 * stdcall `[esp+4] = pUnitFindData`, `ret 4` -> `nUnits`).
 */
export function UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(
  m: Memory113c,
  pUnitFindData: number,
  pfnCallback?: UnitFindCandidateCallback113c,
): number {
  const pData = pUnitFindData >>> 0
  if (pData === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITFINDS\\UnitFinds.cpp', 0x10a)
  }
  const pRoom = m.u32((pData + D2UnitFindDataStrc.pRoom.off) >>> 0)
  if (pRoom === 0) {
    m.setU32((pData + D2UnitFindDataStrc.nIndex.off) >>> 0, 0)
    return 0
  }

  const nX = m.u32((pData + D2UnitFindDataStrc.nX.off) >>> 0) | 0
  const nY = m.u32((pData + D2UnitFindDataStrc.nY.off) >>> 0) | 0
  const dwSize = m.u32((pData + D2UnitFindDataStrc.dwSize.off) >>> 0) | 0

  let ppRoomsNear: number
  let nRoomsNear: number
  if (DUNGEON_IsSquareOutsideRoomInterior113c(m, nY, pRoom, nX, dwSize) === 0) {
    ppRoomsNear = (pData + D2UnitFindDataStrc.pRoom.off) >>> 0
    nRoomsNear = 1
  } else {
    const sm = withUnitFindsScratch113c(m)
    const pRoomsPtr = (UNITFINDS_STACK_BASE + 8) >>> 0
    const pCountPtr = (UNITFINDS_STACK_BASE + 12) >>> 0
    DUNGEON_GetAdjacentRoomsListFromRoom113c(sm, pRoom, pRoomsPtr, pCountPtr)
    ppRoomsNear = sm.u32(pRoomsPtr)
    nRoomsNear = sm.u32(pCountPtr) >>> 0
  }

  let nFound = 0
  for (let i = 0; i >>> 0 < nRoomsNear >>> 0; i = (i + 1) >>> 0) {
    const flags = m.u32((pData + D2UnitFindDataStrc.dwFlags.off) >>> 0)
    if ((flags & 0x2000) !== 0) {
      const r = m.u32((ppRoomsNear + ((i << 2) >>> 0)) >>> 0)
      if (r !== 0) {
        const pRoomEx = m.u32((r + 0x10) >>> 0)
        const pLevel = m.u32((pRoomEx + 0x58) >>> 0)
        const nLevelId = m.u32((pLevel + 0x1d0) >>> 0) | 0
        if (DRLG_IsTownLevel113c(nLevelId) !== 0) {
          continue
        }
      }
    }

    const r = m.u32((ppRoomsNear + ((i << 2) >>> 0)) >>> 0)
    if (DUNGEON_IsSquareTouchingRoomBounds113c(m, nY, r, nX, dwSize) === 0) {
      continue
    }

    let pUnit = m.u32((r + 0x74) >>> 0)
    while (pUnit !== 0) {
      const pNext = m.u32((pUnit + 0xe8) >>> 0)
      const cbPtr = m.u32((pData + D2UnitFindDataStrc.pfnCallback.off) >>> 0)
      let matched: number
      if (cbPtr !== 0) {
        if (pfnCallback === undefined) {
          throw new D2CommonAssertError('..\\Source\\D2Common\\UNITFINDS\\UnitFinds.cpp', 0x13e)
        }
        const pFilterUnit = m.u32((pData + D2UnitFindDataStrc.pFilterUnit.off) >>> 0)
        matched = pfnCallback(m, pUnit, pFilterUnit) | 0
      } else {
        const pFilterUnit = m.u32((pData + D2UnitFindDataStrc.pFilterUnit.off) >>> 0)
        matched = UNITFINDS_MatchUnitCandidate113c(m, pUnit, pFilterUnit, undefined) | 0
      }
      if (matched !== 0) {
        const pUnitsArray = m.u32((pData + D2UnitFindDataStrc.pUnitsArray.off) >>> 0)
        m.setU32((pUnitsArray + ((nFound << 2) >>> 0)) >>> 0, pUnit)
        nFound = (nFound + 1) >>> 0
        const nMaxUnits = m.u32((pData + D2UnitFindDataStrc.nMaxCount.off) >>> 0)
        if (nFound === nMaxUnits) {
          UNITFINDS_GrowUnitsArray113c(m, pData)
        }
      }
      pUnit = pNext
    }
  }

  m.setU32((pData + D2UnitFindDataStrc.nIndex.off) >>> 0, nFound)
  return nFound | 0
}
