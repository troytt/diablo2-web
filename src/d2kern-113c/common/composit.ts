/**
 * Diablo II v1.13c `D2Common.dll` animation-sequence (`AnimSeq.cpp`), unit object/gold (`Units.cpp`),
 * and composite weapon-class (`Composit.cpp`) leaf functions (image base `0x6FD50000`).
 *
 * Binary evidence (`objdump -d -M intel` on 1.13c `D2Common.dll`):
 * - `0x6FD7E6B0`: `ANIMSEQ_GetEventAtFrame` (`__stdcall(pSeqRecord, dwFrameFp8, pEventOut)`, `ret 0xC`)
 * - `0x6FD7E6E0`: `ANIMSEQ_EvaluateSequenceFrame` (`__stdcall(pSeqRecord, dwCurrFrameFp8, dwPrevFrameFp8, pModeOut, pFrameOut, pDirOut, pEventOut)`, `ret 0x1C`)
 * - `#11060` (`0x6FD7E9C0`): `UNITS_GetStashGoldLimit` (`__stdcall(pUnit)`, `ret 0x4`)
 * - `#10934` (`0x6FD7ED30`): `UNITS_HasObjectSubClassBit0` (`__stdcall(pUnit)`, `ret 0x4`)
 * - `#10923` (`0x6FD937F0`): `COMPOSIT_GetWeaponClassIdFromCode` (`__stdcall(dwWeaponClassCode)`, `ret 0x4`)
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2AnimSeqTxt,
  D2AnimSeqTxt_SIZE,
  D2ObjectDataStrc,
  D2ObjectsTxt,
  D2PlayerDataStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c,
} from './inline-helpers.ts'
import { imul32 } from './int-math.ts'
import {
  D2COMMON_GRID0_INFO_VA_113C,
  INVENTORY_GetCompositWeaponMem113c,
  INVENTORY_GetEquippedWeaponHandClass113c,
  INVENTORY_GetOrInitGridMem113c,
  INVENTORY_SIGNATURE_113C,
  INVENTORY_UpdateWeaponGuidOnInsert113c,
  isItemNotBrokenInvMem113c,
  checkItemTypeIdInvMem113c as ITEMS_CheckItemTypeIdMem113c,
  ITEMS_GetComponentFromItem113c,
  ITEMS_GetWeaponClassCodeIdx113c,
} from './inventory.ts'
import { ITEMS_Get2HandedWClass113c, ITEMS_GetWeaponClassCode113c } from '../tables/datatbls-113c.ts'
import { unitsGetTransformGfxValues113c } from './unit.ts'

const UNIT_OBJECT = 2

/**
 * `.rdata` weapon-class lookup table at `0x6FDE3368` (`13` entries × `8` bytes = `104` bytes:
 * `{ uint32_t dwCode; uint32_t nWeaponClassId; }`).
 * Read by `COMPOSIT_GetWeaponClassIdFromCode` (`0x6FD937F6 cmp [eax*8+0x6FDE3368], ecx` /
 * `0x6FD9380A mov eax, [eax*8+0x6FDE336C]`).
 */
export const D2COMMON_WEAPON_CLASS_TABLE_VA_113C = 0x6fde3368
export const WEAPON_CLASS_TABLE_COUNT_113C = 13

export const WEAPON_CLASS_CODE_TABLE_6FDE3368: readonly (readonly [number, number])[] = [
  [0x20736831, 2], // '1hs ' -> 2
  [0x20746831, 3], // '1ht ' -> 3
  [0x20776f62, 1], // 'bow ' -> 1
  [0x20736832, 5], // '2hs ' -> 5
  [0x20746832, 6], // '2ht ' -> 6
  [0x20736a31, 8], // '1js ' -> 8
  [0x20746a31, 9], // '1jt ' -> 9
  [0x20737331, 10], // '1ss ' -> 10
  [0x20747331, 11], // '1st ' -> 11
  [0x20667473, 4], // 'stf ' -> 4
  [0x20776278, 7], // 'xbw ' -> 7
  [0x20317468, 12], // 'ht1 ' -> 12
  [0x20327468, 13], // 'ht2 ' -> 13
]

/**
 * `@va D2Common:0x6FD7E6B0` (`ANIMSEQ_GetEventAtFrame`,
 * stdcall `[esp+4] = pSeqRecord`, `[esp+8] = dwFrameFp8`, `[esp+0xC] = pEventOut`, `ret 0xC`, void).
 *
 * If `pSeqRecord == 0`, writes `*pEventOut = 0` (`0x6FD7E6B8..0x6FD7E6BE`).
 * Otherwise computes `frameIdx = (dwFrameFp8 | 0) >> 8` (`0x6FD7E6C5 sar eax, 8`), indexes
 * `pSeqRecord + frameIdx * 6` (`lea edx, [eax+eax*2]; movzx eax, byte [ecx+edx*2+5]`), and stores
 * `nEvent` (`+0x05`) into `*pEventOut`.
 */
export function ANIMSEQ_GetEventAtFrame113c(
  m: Memory113c,
  pSeqRecord: number,
  dwFrameFp8: number,
  pEventOut: number,
): void {
  const seq = pSeqRecord >>> 0
  const out = pEventOut >>> 0
  if (seq === 0) {
    m.setU32(out, 0)
    return
  }
  const frameIdx = (dwFrameFp8 | 0) >> 8
  const rec = (seq + imul32(frameIdx, D2AnimSeqTxt_SIZE)) >>> 0
  const ev = m.get(rec, D2AnimSeqTxt.nEvent) & 0xff
  m.setU32(out, ev >>> 0)
}

/**
 * `@va D2Common:0x6FD7E6E0` (`ANIMSEQ_EvaluateSequenceFrame`,
 * stdcall `[esp+4] = pSeqRecord`, `[esp+8] = dwCurrFrameFp8`, `[esp+0xC] = dwPrevFrameFp8`,
 * `[esp+0x10] = pModeOut`, `[esp+0x14] = pFrameOut`, `[esp+0x18] = pDirOut`, `[esp+0x1C] = pEventOut`,
 * `ret 0x1C`, void).
 *
 * If `pSeqRecord == 0`, zeros `*pModeOut`, `*pFrameOut`, `*pDirOut`, and `*pEventOut` (`0x6FD7E6E9..0x6FD7E702`).
 * Otherwise reads `rec = pSeqRecord + ((dwCurrFrameFp8 | 0) >> 8) * 6`, writes `nMode (+0x02)`,
 * `nFrame (+0x03)`, and `nDir (+0x04)`. If `dwCurrFrameFp8 == dwPrevFrameFp8`, writes `*pEventOut = rec->nEvent (+0x05)`.
 * Otherwise initializes `*pEventOut = 0` and scans `idx` from `((dwPrevFrameFp8 | 0) >> 8) + 1` through
 * `(dwCurrFrameFp8 | 0) >> 8` inclusive (`0x6FD7E750..0x6FD7E77F`), overwriting `*pEventOut` whenever
 * `pSeqRecord[idx].nEvent != 0`.
 */
export function ANIMSEQ_EvaluateSequenceFrame113c(
  m: Memory113c,
  pSeqRecord: number,
  dwCurrFrameFp8: number,
  dwPrevFrameFp8: number,
  pModeOut: number,
  pFrameOut: number,
  pDirOut: number,
  pEventOut: number,
): void {
  const seq = pSeqRecord >>> 0
  const modePtr = pModeOut >>> 0
  const framePtr = pFrameOut >>> 0
  const dirPtr = pDirOut >>> 0
  const eventPtr = pEventOut >>> 0

  if (seq === 0) {
    m.setU32(modePtr, 0)
    m.setU32(framePtr, 0)
    m.setU32(dirPtr, 0)
    m.setU32(eventPtr, 0)
    return
  }

  const currFp8 = dwCurrFrameFp8 | 0
  const prevFp8 = dwPrevFrameFp8 | 0
  const currIdx = currFp8 >> 8
  const currRec = (seq + imul32(currIdx, D2AnimSeqTxt_SIZE)) >>> 0

  m.setU32(modePtr, m.get(currRec, D2AnimSeqTxt.nMode) & 0xff)
  m.setU32(framePtr, m.get(currRec, D2AnimSeqTxt.nFrame) & 0xff)
  m.setU32(dirPtr, m.get(currRec, D2AnimSeqTxt.nDir) & 0xff)

  if (currFp8 === prevFp8) {
    m.setU32(eventPtr, m.get(currRec, D2AnimSeqTxt.nEvent) & 0xff)
    return
  }

  const startIdx = ((prevFp8 >> 8) + 1) | 0
  m.setU32(eventPtr, 0)
  if (startIdx > currIdx) {
    return
  }

  let count = ((currIdx - startIdx) + 1) | 0
  let recPtr = (seq + imul32(startIdx, D2AnimSeqTxt_SIZE)) >>> 0
  while (count !== 0) {
    const ev = m.get(recPtr, D2AnimSeqTxt.nEvent) & 0xff
    if (ev !== 0) {
      m.setU32(eventPtr, ev >>> 0)
    }
    recPtr = (recPtr + D2AnimSeqTxt_SIZE) >>> 0
    count = (count - 1) | 0
  }
}

/**
 * `@va D2Common:0x6FD7E9C0` (`D2Common.#11060` `UNITS_GetStashGoldLimit`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0x2625A0` (`2500000`)).
 */
export function UNITS_GetStashGoldLimit113c(_pUnit: number): number {
  return 0x2625a0
}

/**
 * `@va D2Common:0x6FD7ED30` (`D2Common.#10934` `UNITS_HasObjectSubClassBit0`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `1` if `pUnit->dwUnitType == 2` and `(pUnit->pObjectData->pObjectTxt->nSubClass & 1) != 0`, else `0`).
 */
export function UNITS_HasObjectSubClassBit0113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (m.get(u, D2UnitStrc.dwUnitType) !== UNIT_OBJECT) {
    return 0
  }
  const pObjData = m.get(u, D2UnitStrc.pUnitData)
  const pObjTxt = m.get(pObjData, D2ObjectDataStrc.pObjectTxt)
  const nSubClass = m.get(pObjTxt, D2ObjectsTxt.nSubClass) & 0xff
  return (nSubClass & 1) !== 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD937F0` (`D2Common.#10923` `COMPOSIT_GetWeaponClassIdFromCode`,
 * stdcall `[esp+4] = dwWeaponClassCode`, `ret 4` -> `nWeaponClassId` (`1..13`) or `0`).
 *
 * Scans the 13-entry `(dwCode, nWeaponClassId)` table at `0x6FDE3368` (`0x6FD937F6..0x6FD93811`).
 */
export function COMPOSIT_GetWeaponClassIdFromCode113c(
  m: Memory113c,
  dwWeaponClassCode: number,
): number {
  const target = dwWeaponClassCode >>> 0
  for (let i = 0; i < WEAPON_CLASS_TABLE_COUNT_113C; i++) {
    const code = m.u32((D2COMMON_WEAPON_CLASS_TABLE_VA_113C + i * 8) >>> 0)
    if (code === target) {
      return m.u32((D2COMMON_WEAPON_CLASS_TABLE_VA_113C + i * 8 + 4) >>> 0)
    }
  }
  return 0
}

const COMPOSIT_UNITS_CPP_FILE_113C = '..\\Source\\D2Common\\UNITS\\Units.cpp'

/**
 * `@va D2Common:0x6FD7E960` (`D2Common.#10181` `UNITS_GetField7C`, 39 bytes,
 * fastcall `ecx = pUnit`, `ret` -> `number`).
 */
export function UNITS_GetField7C_113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0x1513)
  }
  return m.get(pUnit, D2UnitStrc.dwField7C)
}

/**
 * `@va D2Common:0x6FD7E990` (`D2Common.#10169` `UNITS_SetField7C`, 39 bytes,
 * fastcall `ecx = pUnit`, `edx = dwValue`, `ret`, void).
 */
export function UNITS_SetField7C_113c(m: Memory113c, pUnit: number, dwValue: number): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0x150b)
  }
  m.set(pUnit, D2UnitStrc.dwField7C, dwValue >>> 0)
}

/**
 * `@va D2Common:0x6FD7EA30` (`D2Common.#10111` `UNITS_SetObjectPortalFlags`, 64 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nFlags`, `ret 0x8`, void).
 */
export function UNITS_SetObjectPortalFlags113c(
  m: Memory113c,
  pUnit: number,
  nFlags: number,
): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfef)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_OBJECT) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xff0)
  }
  const pObjectData = m.get(pUnit, D2UnitStrc.pUnitData)
  m.set(pObjectData, D2ObjectDataStrc.nPortalFlags, nFlags & 0xff)
}

/**
 * `@va D2Common:0x6FD7EA70` (`D2Common.#10258` `UNITS_GetObjectPortalFlags`, 60 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4`, `retMask: 0xFF`).
 */
export function UNITS_GetObjectPortalFlags113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfe4)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_OBJECT) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfe5)
  }
  const pObjectData = m.get(pUnit, D2UnitStrc.pUnitData)
  return m.get(pObjectData, D2ObjectDataStrc.nPortalFlags)
}

/**
 * `@va D2Common:0x6FD7EAF0` (`D2Common.#10187` `UNITS_GetPlayerActiveWeaponFlags`, 60 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetPlayerActiveWeaponFlags113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfc9)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfca)
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  return m.get(pPlayerData, D2PlayerDataStrc.dwActiveWeaponFlags)
}

/**
 * `@va D2Common:0x6FD7EB30` (`D2Common.#10073` `UNITS_SetPlayerActiveWeaponFlags`, 64 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = dwFlags`, `ret 0x8`, void).
 */
export function UNITS_SetPlayerActiveWeaponFlags113c(
  m: Memory113c,
  pUnit: number,
  dwFlags: number,
): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfbf)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfc0)
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  m.set(pPlayerData, D2PlayerDataStrc.dwActiveWeaponFlags, dwFlags >>> 0)
}

/**
 * `@va D2Common:0x6FD7EB70` (`D2Common.#10920` `UNITS_GetPlayerData`, 57 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `D2PlayerDataStrc*`).
 */
export function UNITS_GetPlayerData113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfb4)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfb6)
  }
  return m.get(pUnit, D2UnitStrc.pUnitData)
}

/**
 * `@va D2Common:0x6FD7EBB0` (`D2Common.#10746` `UNITS_GetPlayerName`, 68 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `char*`).
 */
export function UNITS_GetPlayerName113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfa5)
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfa7)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xfa8)
  }
  return pPlayerData
}

/**
 * `@va D2Common:0x6FD7EC00` (`D2Common.#10140` `UNITS_SetPlayerName`, 84 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = szName`, `ret 0x8`, void).
 */
export function UNITS_SetPlayerName113c(m: Memory113c, pUnit: number, szName: number): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xf97)
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xf99)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xf9a)
  }
  if (szName >>> 0 !== 0) {
    const maxIdx = 0x7ffffffe
    let i = 0
    while (i < maxIdx) {
      const ch = m.u8((szName + i) >>> 0)
      m.setU8((pPlayerData + i) >>> 0, ch)
      if (ch === 0) {
        return
      }
      i++
    }
    m.setU8((pPlayerData + i) >>> 0, 0)
  }
}

/**
 * `@va D2Common:0x6FD7EC60` (`D2Common.#10128` `UNITS_SetObjectShrineTxt`, 65 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pShrineTxt`, `ret 0x8`, void).
 */
export function UNITS_SetObjectShrineTxt113c(
  m: Memory113c,
  pUnit: number,
  pShrineTxt: number,
): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xe60)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_OBJECT) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xe67)
  }
  const pObjectData = m.get(pUnit, D2UnitStrc.pUnitData)
  m.set(pObjectData, D2ObjectDataStrc.pShrineTxt, pShrineTxt >>> 0)
}

/**
 * `@va D2Common:0x6FD7ECB0` (`D2Common.#10092` `UNITS_GetObjectShrineTxt`, 61 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `D2ShrinesTxt*`).
 */
export function UNITS_GetObjectShrineTxt113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xe4e)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_OBJECT) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xe55)
  }
  const pObjectData = m.get(pUnit, D2UnitStrc.pUnitData)
  return m.get(pObjectData, D2ObjectDataStrc.pShrineTxt)
}

/**
 * `@va D2Common:0x6FD7ECF0` (`D2Common.#10296` `UNITS_GetObjectTxt`, 60 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `D2ObjectsTxt*`).
 */
export function UNITS_GetObjectTxt113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xe3c)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_OBJECT) {
    throw new D2CommonAssertError(COMPOSIT_UNITS_CPP_FILE_113C, 0xe43)
  }
  const pObjectData = m.get(pUnit, D2UnitStrc.pUnitData)
  return m.get(pObjectData, D2ObjectDataStrc.pObjectTxt)
}

/**
 * Internal helper computing `{ code, wcid, hasWcid }` for `0x6FD93860`.
 * When `hasWcid === false`, the `0x6FD93966` early return was taken without writing `*pOutWeaponClassId`.
 */
export function compositGetWeaponClassCodeAndId113c(
  m: Memory113c,
  pUnit: number,
  nUnitType: number,
  nClass: number,
  nMode: number,
  pInventory: number,
): { code: number; wcid: number; hasWcid: boolean } {
  const uType = nUnitType | 0
  if (uType === 0) {
    const ebx = pInventory >>> 0
    let esi = 0
    let bComp = 0
    if (ebx !== 0) {
      if (m.u32(ebx) === INVENTORY_SIGNATURE_113C) {
        const g0 = INVENTORY_GetOrInitGridMem113c(m, ebx, 0, D2COMMON_GRID0_INFO_VA_113C)
        if (g0 !== 0) {
          esi = m.u32((m.u32((g0 + 0x0c) >>> 0) + 0x10) >>> 0)
          if (esi !== 0 && isItemNotBrokenInvMem113c(m, esi) !== 0) {
            if (m.u32(esi) !== 4) {
              return { code: 0, wcid: 0, hasWcid: false }
            }
            bComp = ITEMS_GetComponentFromItem113c(m, esi) & 0xff
          }
        }
      }
      if (bComp !== 5 && bComp !== 6) {
        if (m.u32(ebx) === INVENTORY_SIGNATURE_113C) {
          const g0b = INVENTORY_GetOrInitGridMem113c(m, ebx, 0, D2COMMON_GRID0_INFO_VA_113C)
          if (g0b === 0) {
            esi = 0
          } else {
            esi = m.u32((m.u32((g0b + 0x0c) >>> 0) + 0x14) >>> 0)
            if (esi !== 0) {
              if (isItemNotBrokenInvMem113c(m, esi) === 0) {
                esi = 0
              } else {
                bComp = ITEMS_GetComponentFromItem113c(m, esi) & 0xff
              }
            }
          }
        } else {
          esi = 0
        }
      }
    }

    let pCharStats = 0
    const cls = nClass | 0
    if (cls >= 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if (cls < (m.u32((sgpt + 0xbc8) >>> 0) | 0)) {
        pCharStats = (m.u32((sgpt + 0xbc4) >>> 0) + imul32(cls, 0xc4)) >>> 0
      }
    }

    const mode = nMode | 0
    if (mode === 0 || mode === 0x11 || esi === 0 || (bComp !== 5 && bComp !== 6)) {
      const code0 = m.u32((pCharStats + 0x4c) >>> 0)
      const wcid = COMPOSIT_GetWeaponClassIdFromCode113c(m, code0)
      const code1 = m.u32((pCharStats + 0x4c) >>> 0)
      return { code: code1 >>> 0, wcid: wcid >>> 0, hasWcid: true }
    }

    let edi = 0
    if (ebx !== 0 && m.u32(ebx) === INVENTORY_SIGNATURE_113C) {
      const g0 = INVENTORY_GetOrInitGridMem113c(m, ebx, 0, D2COMMON_GRID0_INFO_VA_113C)
      if (g0 !== 0) {
        edi = m.u32((m.u32((g0 + 0x0c) >>> 0) + 0x10) >>> 0)
      }
    }
    if (isItemNotBrokenInvMem113c(m, edi) === 0) {
      edi = 0
    }

    let ebp = 0
    if (ebx !== 0 && m.u32(ebx) === INVENTORY_SIGNATURE_113C) {
      const g0b = INVENTORY_GetOrInitGridMem113c(m, ebx, 0, D2COMMON_GRID0_INFO_VA_113C)
      if (g0b !== 0) {
        ebp = m.u32((m.u32((g0b + 0x0c) >>> 0) + 0x14) >>> 0)
      }
    }
    if (isItemNotBrokenInvMem113c(m, ebp) === 0) {
      ebp = 0
    }

    if (cls === 4) {
      if (
        ITEMS_CheckItemTypeIdMem113c(m, edi, 0x2d) !== 0 &&
        ITEMS_CheckItemTypeIdMem113c(m, ebp, 0x2d) !== 0
      ) {
        let pPrim = INVENTORY_GetCompositWeaponMem113c(m, ebx)
        if (pPrim === 0) {
          INVENTORY_UpdateWeaponGuidOnInsert113c(m, ebx, edi)
          pPrim = edi
        }
        const w1 = ITEMS_GetWeaponClassCodeIdx113c(m, pPrim) & 0xffff
        const w2 = ITEMS_GetWeaponClassCodeIdx113c(m, edi === pPrim ? ebp : edi) & 0xffff
        let code = 0x20737331
        if (w1 === 2) {
          if (w2 === 3) {
            code = 0x20736a31
          }
        } else if (w1 === 3) {
          if (w2 === 3) {
            code = 0x20746a31
          } else if (w2 === 2) {
            code = 0x20747331
          }
        }
        const wcid = COMPOSIT_GetWeaponClassIdFromCode113c(m, code)
        return { code: code >>> 0, wcid: wcid >>> 0, hasWcid: true }
      }
    } else if (cls === 6) {
      if (
        ITEMS_CheckItemTypeIdMem113c(m, edi, 0x2d) !== 0 &&
        ITEMS_CheckItemTypeIdMem113c(m, ebp, 0x2d) !== 0
      ) {
        const wcid = COMPOSIT_GetWeaponClassIdFromCode113c(m, 0x20327468)
        return { code: 0x20327468, wcid: wcid >>> 0, hasWcid: true }
      }
    }

    const handCls = INVENTORY_GetEquippedWeaponHandClass113c(m, pUnit, ebx)
    const code =
      handCls === 2
        ? ITEMS_Get2HandedWClass113c(m, esi) >>> 0
        : ITEMS_GetWeaponClassCode113c(m, esi) >>> 0
    const wcid = COMPOSIT_GetWeaponClassIdFromCode113c(m, code)
    return { code: code >>> 0, wcid: wcid >>> 0, hasWcid: true }
  }

  if (uType === 1) {
    const pMonStats2 = DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(m, nClass)
    if (pMonStats2 !== 0) {
      const mode = nMode | 0
      let useDefault = false
      if (mode === 0 || mode === 12) {
        const pMask = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
        const flagByte = m.u8((pMonStats2 + 0x06) >>> 0)
        if ((m.u8(pMask) & flagByte) === 0) {
          useDefault = true
        }
      }
      if (!useDefault) {
        const code0 = m.u32((pMonStats2 + 0x10) >>> 0)
        const wcid = COMPOSIT_GetWeaponClassIdFromCode113c(m, code0)
        const code1 = m.u32((pMonStats2 + 0x10) >>> 0)
        return { code: code1 >>> 0, wcid: wcid >>> 0, hasWcid: true }
      }
    }
    const wcid = COMPOSIT_GetWeaponClassIdFromCode113c(m, 0x20687468)
    return { code: 0x20687468, wcid: wcid >>> 0, hasWcid: true }
  }

  if (uType === 2) {
    for (let i = 0; i < WEAPON_CLASS_TABLE_COUNT_113C; i++) {
      if (m.u32((D2COMMON_WEAPON_CLASS_TABLE_VA_113C + i * 8) >>> 0) === 0x20687468) {
        const wcid = m.u32((D2COMMON_WEAPON_CLASS_TABLE_VA_113C + i * 8 + 4) >>> 0)
        return { code: 0x20687468, wcid: wcid >>> 0, hasWcid: true }
      }
    }
    return { code: 0x20687468, wcid: 0, hasWcid: true }
  }

  return { code: 0, wcid: 0, hasWcid: true }
}

/**
 * `@va D2Common:0x6FD93860` (`D2Common.#10908` `COMPOSIT_GetWeaponClassCode`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nUnitType`, `[esp+0xC] = nClass`, `[esp+0x10] = nMode`,
 * `[esp+0x14] = pInventory`, `[esp+0x18] = pOutWeaponClassId`, `ret 0x18` -> `dwWeaponClassCode`).
 */
export function COMPOSIT_GetWeaponClassCode113c(
  m: Memory113c,
  pUnit: number,
  nUnitType: number,
  nClass: number,
  nMode: number,
  pInventory: number,
  pOutWeaponClassId: number,
): number {
  const { code, wcid, hasWcid } = compositGetWeaponClassCodeAndId113c(
    m,
    pUnit,
    nUnitType,
    nClass,
    nMode,
    pInventory,
  )
  if (hasWcid) {
    m.setU32(pOutWeaponClassId >>> 0, wcid >>> 0)
  }
  return code >>> 0
}

/**
 * `@va D2Common:0x6FD941E0` (`D2Common.#10431` `COMPOSIT_GetUnitWeaponClassCode`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pInventory`, `[esp+0xC] = pOutWeaponClassId`,
 * `[esp+0x10] = nAnimMode`, `[esp+0x14] = bUseShiftedMode`, `ret 0x14` -> `dwWeaponClassCode`).
 */
export function COMPOSIT_GetUnitWeaponClassCode113c(
  m: Memory113c,
  pUnit: number,
  pInventory: number,
  pOutWeaponClassId: number,
  nAnimMode: number,
  bUseShiftedMode: number,
): number {
  const esi = pUnit >>> 0
  if (esi === 0) {
    return 0x20687468
  }
  let uClass = m.u32((esi + 0x04) >>> 0)
  let uType = m.u32(esi)
  let mode = nAnimMode | 0
  if (mode === -1) {
    if ((uType === 0 || uType === 1) && m.u32((esi + 0x30) >>> 0) !== 0) {
      mode = m.u32((esi + 0x40) >>> 0)
    } else {
      mode = m.u32((esi + 0x10) >>> 0)
    }
  }
  if (((m.u32((esi + 0xc8) >>> 0) >>> 3) & 1) !== 0) {
    const [t, c, shiftedMode] = unitsGetTransformGfxValues113c(m, esi, uType, uClass, mode)
    uType = t
    uClass = c
    if (bUseShiftedMode !== 0) {
      mode = shiftedMode
    }
  }
  return COMPOSIT_GetWeaponClassCode113c(m, esi, uType, uClass, mode, pInventory, pOutWeaponClassId)
}

/**
 * `@va D2Common:0x6FD94350` (`D2Common.#10889` `COMPOSIT_IsUnitUsingBowOrCrossbow`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0 | 1`).
 */
export function COMPOSIT_IsUnitUsingBowOrCrossbow113c(m: Memory113c, pUnit: number): number {
  const esi = pUnit >>> 0
  let uType = m.u32(esi)
  let uClass = m.u32((esi + 0x04) >>> 0)
  const pInv = m.u32((esi + 0x60) >>> 0)
  let uMode =
    (uType === 0 || uType === 1) && m.u32((esi + 0x30) >>> 0) !== 0
      ? m.u32((esi + 0x40) >>> 0)
      : m.u32((esi + 0x10) >>> 0)
  if (((m.u32((esi + 0xc8) >>> 0) >>> 3) & 1) !== 0) {
    const [t, c, md] = unitsGetTransformGfxValues113c(m, esi, uType, uClass, uMode)
    uType = t
    uClass = c
    uMode = md
  }
  const { wcid } = compositGetWeaponClassCodeAndId113c(m, esi, uType, uClass, uMode, pInv)
  return wcid === 1 || wcid === 7 ? 1 : 0
}


