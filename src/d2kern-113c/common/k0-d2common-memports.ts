/**
 * Pure `Memory113c` 1:1 binary ports for K0 `D2Common.dll` functions (Iteration 14 Lane D).
 *
 * Isolates exact `SparseMemory113c`-backed ports of the 18 K0 `D2Common.dll` functions previously
 * marked `"ported"` so `src/d2kern-113c/game/fallen-ai-113c.ts` and shared K1 files remain
 * untouched for parallel lanes while all 18 K0 VAs achieve real-DLL Wine differential parity.
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import { D2ActiveRoomStrc, D2RoomExStrc } from '../mem/layout.generated.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
} from './inline-helpers.ts'
import { imul32 } from './int-math.ts'
import {
  ITEMS_GetComponentFromItem113c,
  ITEMS_GetWeaponClassCodeIdx113c,
  isItemNotBrokenInvMem113c,
} from './inventory.ts'
import { ITEMS_IsTome113c } from './items.ts'
import {
  ITEMS_GetItemTypeFromItemMem113c,
  SKILLS_GetThrowingWeaponMasteryBonus113c,
  STATLIST_GetStatsByIdFromList113c,
} from './missile.ts'
import {
  STATLIST_FindStatIndex113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_SetBaseStatEx113c,
  STATES_CheckStateMaskOnUnit113c,
} from './statlist.ts'
import { UNIT_ITEM, UNITROOM_RefreshUnit113c } from './unit.ts'

const INV_SIGNATURE_113C = 0x01020304
const BODYLOC_COUNT_113C = 13
const BODYLOC_RARM = 4
const BODYLOC_LARM = 5
const ITYPE_WEAPON_113C = 45
const LEVEL_OFF_DWLEVELNO = 0x1d0

const D2COMMON_ITEMS_TXT_COUNT_VA_MEMPORT_113C = 0x6fdefb94
const D2COMMON_ITEMS_TXT_PTR_VA_MEMPORT_113C = 0x6fdefb98
const D2COMMON_GRID0_INFO_VA_MEMPORT_113C = 0x6fded378
const D2COMMON_GDWINVBITMASKS_IAT_VA_MEMPORT_113C = 0x6fdd9078

function s16MemPort(v: number): number {
  return (v << 16) >> 16
}

/**
 * `@va D2Common:0x6FDC19A0` (`D2Common.#10695` `DATATBLS_GetItemsTxtRecord`,
 * `stdcall (nItemId) -> D2ItemsTxt*`, `ret 4`).
 */
export function DATATBLS_GetItemsTxtRecordMemPort113c(m: Memory113c, nItemId: number): number {
  if ((nItemId >>> 0) >= m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_MEMPORT_113C)) return 0
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_MEMPORT_113C)
  if (base === 0) {
    throw new D2CommonAssertError('DataTbls.cpp', 0x1ef)
  }
  return (base + imul32(nItemId | 0, 0x1a8)) >>> 0
}

/**
 * `@va D2Common:0x6FD72970` (`D2Common.#10120` `ITEMS_GetDexBonus`,
 * `stdcall (pItem) -> uint16`, `ret 4`, `retMask = 0xFFFF`).
 */
export function ITEMS_GetDexBonusMemPort113c(m: Memory113c, pItem: number): number {
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 100
  const rec = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((itm + 4) >>> 0))
  if (rec === 0) return 100
  const val = m.u16((rec + 0x108) >>> 0)
  return val === 1 ? 100 : val
}

/**
 * `@va D2Common:0x6FD729A0` (`D2Common.#10213` `ITEMS_GetStrBonus`,
 * `stdcall (pItem) -> uint16`, `ret 4`, `retMask = 0xFFFF`).
 */
export function ITEMS_GetStrBonusMemPort113c(m: Memory113c, pItem: number): number {
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 100
  const rec = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((itm + 4) >>> 0))
  if (rec === 0) return 100
  const val = m.u16((rec + 0x106) >>> 0)
  return val === 1 ? 100 : val
}

/**
 * `@va D2Common:0x6FD74430` (`D2Common.#10744` `ITEMS_CheckItemTypeId`,
 * `stdcall (pItem, nItemType) -> uint32`, `ret 8`).
 */
export function ITEMS_CheckItemTypeIdMemPort113c(
  m: Memory113c,
  pItem: number,
  nItemType: number,
): number {
  const itm = pItem >>> 0
  if (itm === 0) return 0
  const t = nItemType | 0
  if (t < 0) return 0
  if (t >= (m.u32((m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) + 0xbfc) >>> 0) | 0)) return 0
  const wType0 = ITEMS_IsTome113c(m, m.u32((itm + 4) >>> 0)) | 0
  const col = t >> 5
  const bitOff = (t & 0x1f) * 4
  const sgpt0 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const row0 = (imul32(m.u32((sgpt0 + 0xc00) >>> 0) | 0, wType0) + col) | 0
  const word0 = m.u32((m.u32((sgpt0 + 0xc04) >>> 0) + imul32(row0, 4)) >>> 0)
  const mask0 = m.u32((m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C) + bitOff) >>> 0)
  if ((word0 & mask0) !== 0) return 1
  const pTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((itm + 4) >>> 0))
  if (pTxt === 0) return 0
  const wType1 = s16MemPort(m.u16((pTxt + 0x120) >>> 0))
  if (wType1 <= 0) return 0
  const sgpt1 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (wType1 >= (m.u32((sgpt1 + 0xbfc) >>> 0) | 0)) return 0
  const row1 = (imul32(m.u32((sgpt1 + 0xc00) >>> 0) | 0, wType1) + col) | 0
  const word1 = m.u32((m.u32((sgpt1 + 0xc04) >>> 0) + imul32(row1, 4)) >>> 0)
  const mask1 = m.u32((m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C) + bitOff) >>> 0)
  return (word1 & mask1) >>> 0
}

/**
 * `@va D2Common:0x6FD74C30` (`D2Common.#10711` `ITEMS_CheckIfThrowItem`,
 * `stdcall (pItem) -> uint8`, `ret 4`).
 */
export function ITEMS_CheckIfThrowItemMemPort113c(m: Memory113c, pItem: number): number {
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  const nType = ITEMS_GetItemTypeFromItemMem113c(m, itm)
  if (nType < 0) return 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (nType >= (m.u32((sgpt + 0xbfc) >>> 0) | 0)) return 0
  const pTypeTxt = (m.u32((sgpt + 0xbf8) >>> 0) + imul32(nType, 0xe4)) >>> 0
  if (pTypeTxt === 0) return 0
  return m.u8((pTypeTxt + 0x10) >>> 0)
}

/**
 * `@va D2Common:0x6FD6E1B0` (`INVENTORY_GetOrInitGrid`,
 * custom LTCG `eax = gridIdx`, `ebx = pInventory`, `[esp+4] = pGridDef`, `ret 4` -> `D2InvGridStrc*`).
 */
export function INVENTORY_GetOrInitGridMemPort113c(
  m: Memory113c,
  pInventory: number,
  gridIdx: number,
  pGridDef: number,
): number {
  const inv = pInventory >>> 0
  const idx = gridIdx | 0
  const nGridCount = m.u32((inv + 0x18) >>> 0) | 0
  const def = pGridDef >>> 0
  if (nGridCount <= idx) {
    if (def === 0) return 0
    m.u32((inv + 0x04) >>> 0)
    const pOld = m.u32((inv + 0x14) >>> 0)
    const pNew = m.alloc(((idx << 4) + 0x10) >>> 0)
    for (let i = 0; i < nGridCount * 16; i++) {
      m.setU8((pNew + i) >>> 0, m.u8((pOld + i) >>> 0))
    }
    // 0x6FD6E282..0x6FD6E29D: rep stos zero-fills the newly grown grid slots [nGridCount..idx].
    m.fill((pNew + nGridCount * 16) >>> 0, ((idx - nGridCount + 1) * 16) >>> 0, 0)
    m.setU32((inv + 0x14) >>> 0, pNew)
    m.setU32((inv + 0x18) >>> 0, (idx + 1) >>> 0)
    const pGrid = (m.u32((inv + 0x14) >>> 0) + (idx << 4)) >>> 0
    const gx = m.u8(def)
    const gy = m.u8((def + 1) >>> 0)
    m.setU8((pGrid + 0x08) >>> 0, gx)
    m.setU8((pGrid + 0x09) >>> 0, gy)
    m.u32((inv + 0x04) >>> 0)
    const pItems = m.alloc(imul32(gx, gy) * 4)
    // 0x6FD6E2E2..0x6FD6E2F8: rep stos zero-fills the gx * gy item slot array.
    m.fill(pItems, (imul32(gx, gy) * 4) >>> 0, 0)
    m.setU32((pGrid + 0x0c) >>> 0, pItems)
    return pGrid
  }
  const pGrid = (m.u32((inv + 0x14) >>> 0) + (idx << 4)) >>> 0
  const ppItems = m.u32((pGrid + 0x0c) >>> 0)
  if (def === 0) return ppItems !== 0 ? pGrid : 0
  if (ppItems === 0) {
    const gx = m.u8(def)
    const gy = m.u8((def + 1) >>> 0)
    m.setU8((pGrid + 0x08) >>> 0, gx)
    m.setU8((pGrid + 0x09) >>> 0, gy)
    m.u32((inv + 0x04) >>> 0)
    const pItems = m.alloc(imul32(gx, gy) * 4)
    // 0x6FD6E21B..0x6FD6E234: rep stos zero-fills the gx * gy item slot array.
    m.fill(pItems, (imul32(gx, gy) * 4) >>> 0, 0)
    m.setU32((pGrid + 0x0c) >>> 0, pItems)
  }
  if (m.u8((pGrid + 0x08) >>> 0) !== m.u8(def)) return 0
  if (m.u8((pGrid + 0x09) >>> 0) !== m.u8((def + 1) >>> 0)) return 0
  return pGrid
}

/**
 * `@va D2Common:0x6FD6E670` (`D2Common.#11139` `INVENTORY_GetItemFromBodyLoc`,
 * `stdcall (pInventory, bodyLoc) -> D2UnitStrc*`, `ret 8`).
 */
export function INVENTORY_GetItemFromBodyLocMemPort113c(
  m: Memory113c,
  pInventory: number,
  bodyLoc: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INV_SIGNATURE_113C) return 0
  const loc = bodyLoc | 0
  if (loc < 0 || loc >= BODYLOC_COUNT_113C) return 0
  const pGrid0 = INVENTORY_GetOrInitGridMemPort113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_MEMPORT_113C)
  if (pGrid0 === 0) return 0
  return m.u32((m.u32((pGrid0 + 0x0c) >>> 0) + loc * 4) >>> 0)
}

/**
 * `@va D2Common:0x6FD70320` (`D2Common.#10061` `INVENTORY_GetCompositWeapon`,
 * `stdcall (pInventory) -> D2UnitStrc*`, `ret 4`).
 */
export function INVENTORY_GetCompositWeaponMemPort113c(m: Memory113c, pInventory: number): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INV_SIGNATURE_113C) return 0
  if (m.u32((inv + 0x1c) >>> 0) === 0xffffffff) return 0
  const pGridA = INVENTORY_GetOrInitGridMemPort113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_MEMPORT_113C)
  if (pGridA !== 0) {
    const pLeft = m.u32((m.u32((pGridA + 0x0c) >>> 0) + 0x14) >>> 0)
    if (
      pLeft !== 0 &&
      ITEMS_CheckItemTypeIdMemPort113c(m, pLeft, ITYPE_WEAPON_113C) !== 0 &&
      m.u32((pLeft + 0x0c) >>> 0) === m.u32((inv + 0x1c) >>> 0)
    ) {
      return pLeft
    }
  }
  if (m.u32(inv) !== INV_SIGNATURE_113C) return 0
  const pGridB = INVENTORY_GetOrInitGridMemPort113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_MEMPORT_113C)
  if (pGridB === 0) return 0
  const pRight = m.u32((m.u32((pGridB + 0x0c) >>> 0) + 0x10) >>> 0)
  if (
    pRight !== 0 &&
    ITEMS_CheckItemTypeIdMemPort113c(m, pRight, ITYPE_WEAPON_113C) !== 0 &&
    m.u32((pRight + 0x0c) >>> 0) === m.u32((inv + 0x1c) >>> 0)
  ) {
    return pRight
  }
  return 0
}

/**
 * `@va D2Common:0x6FD70700` (`D2Common.#10101` `INVENTORY_GetActiveWeapon`,
 * `stdcall (pInventory, ppWeapon, pBodyLoc, pbIsActive) -> BOOL`, `ret 0x10`).
 */
export function INVENTORY_GetActiveWeaponMemPort113c(
  m: Memory113c,
  pInventory: number,
  ppWeapon: number,
  pBodyLoc: number,
  pbIsActive: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  const outWeapon = ppWeapon >>> 0
  const outBodyLoc = pBodyLoc >>> 0
  const outActive = pbIsActive >>> 0
  m.setU32(outActive, 0)
  const pComp = INVENTORY_GetCompositWeaponMemPort113c(m, inv)
  if (m.u32(inv) === INV_SIGNATURE_113C) {
    const pGridA = INVENTORY_GetOrInitGridMemPort113c(
      m,
      inv,
      0,
      D2COMMON_GRID0_INFO_VA_MEMPORT_113C,
    )
    if (pGridA !== 0) {
      const pRight = m.u32((m.u32((pGridA + 0x0c) >>> 0) + 0x10) >>> 0)
      if (
        pRight !== 0 &&
        isItemNotBrokenInvMem113c(m, pRight) !== 0 &&
        ITEMS_CheckItemTypeIdMemPort113c(m, pRight, ITYPE_WEAPON_113C) !== 0
      ) {
        m.setU32(outWeapon, pRight)
        m.setU32(outBodyLoc, BODYLOC_RARM)
        if (pRight === pComp) {
          m.setU32(outActive, 1)
        }
        return 1
      }
    }
  }
  let pLeft = 0
  if (m.u32(inv) === INV_SIGNATURE_113C) {
    const pGridB = INVENTORY_GetOrInitGridMemPort113c(
      m,
      inv,
      0,
      D2COMMON_GRID0_INFO_VA_MEMPORT_113C,
    )
    if (pGridB !== 0) {
      pLeft = m.u32((m.u32((pGridB + 0x0c) >>> 0) + 0x14) >>> 0)
    }
  }
  if (
    isItemNotBrokenInvMem113c(m, pLeft) !== 0 &&
    ITEMS_CheckItemTypeIdMemPort113c(m, pLeft, ITYPE_WEAPON_113C) !== 0
  ) {
    m.setU32(outWeapon, pLeft)
    m.setU32(outBodyLoc, BODYLOC_LARM)
    if (pLeft === pComp) {
      m.setU32(outActive, 1)
    }
    return 1
  }
  m.setU32(outWeapon, 0)
  return 0
}

/**
 * `@va D2Common:0x6FD70830` (`D2Common.#10062` `INVENTORY_GetWeaponByHandSlot`,
 * `stdcall (pInventory, nSlotCode) -> D2UnitStrc*`, `ret 8`).
 */
export function INVENTORY_GetWeaponByHandSlotMemPort113c(
  m: Memory113c,
  pInventory: number,
  nSlotCode: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INV_SIGNATURE_113C) return 0
  const pGrid = INVENTORY_GetOrInitGridMemPort113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_MEMPORT_113C)
  if (pGrid === 0) return 0
  const pComp = INVENTORY_GetCompositWeaponMemPort113c(m, inv)
  const slot = nSlotCode | 0
  for (let off = 0; off < 0x2c; off += 4) {
    const pItem = m.u32((m.u32((pGrid + 0x0c) >>> 0) + off) >>> 0)
    if (pItem === 0) continue
    const wc = ITEMS_GetWeaponClassCodeIdx113c(m, pItem) & 0xffff
    if (wc === 2 || wc === 3 || wc === 12) {
      if (slot === 6) {
        if (pItem !== pComp) return pItem
      } else if (slot === 5 && pItem === pComp) {
        return pItem
      }
    } else if ((ITEMS_GetComponentFromItem113c(m, pItem) & 0xff) === slot) {
      return pItem
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD8C390` (`D2Common.#10057` `DUNGEON_CheckRoomIsTown`,
 * `stdcall (pRoom) -> BOOL`, `ret 4`).
 */
export function DUNGEON_CheckRoomIsTownMemPort113c(m: Memory113c, pRoom: number): number {
  if ((pRoom >>> 0) === 0) return 0
  const pRoomEx = m.get(pRoom, D2ActiveRoomStrc.pRoomEx)
  const pLevel = m.get(pRoomEx, D2RoomExStrc.pLevel)
  const levelId = m.u32((pLevel + LEVEL_OFF_DWLEVELNO) >>> 0) | 0
  return levelId === 1 || levelId === 40 || levelId === 75 || levelId === 103 || levelId === 109
    ? 1
    : 0
}

/**
 * `@va D2Common:0x6FD9F640` (`D2Common.#10804` `SKILLS_GetWeaponMasteryBonus`,
 * `stdcall (pUnit, pWeapon, pSkill, nBonusType) -> int32`, `ret 0x10`).
 */
export function SKILLS_GetWeaponMasteryBonusMemPort113c(
  m: Memory113c,
  pUnit: number,
  pWeapon: number,
  pSkill: number,
  nBonusType: number,
): number {
  const u = pUnit >>> 0
  const w = pWeapon >>> 0
  if (u === 0 || w === 0) return 0
  const effSkill = pSkill !== 0 ? pSkill >>> 0 : SKILLS_GetUsedSkillMemPort113c(m, u) >>> 0
  const ranged = SKILLS_GetThrowingWeaponMasteryBonus113c(m, u, w, effSkill, nBonusType)
  if (ranged !== null) return ranged >>> 0
  let nStatId: number
  if (nBonusType === 0) nStatId = 0x156
  else if (nBonusType === 1) nStatId = 0x157
  else if (nBonusType === 2) nStatId = 0x158
  else return 0
  const pStatList = m.u32((u + 0x5c) >>> 0)
  const entries =
    pStatList !== 0 && (m.u32((pStatList + 0x10) >>> 0) | 0) < 0
      ? STATLIST_GetStatsByIdFromList113c(m, pStatList, nStatId, 0x20)
      : []
  let best = 0
  for (const [dwKey, dwValue] of entries) {
    if (ITEMS_CheckItemTypeIdMemPort113c(m, w, dwKey & 0xffff) !== 0 && (dwValue | 0) > best) {
      best = dwValue | 0
    }
  }
  return best >>> 0
}

/**
 * `@va D2Common:0x6FD8A330` (`D2Common.#10245` `STATLIST_AddStat`,
 * `stdcall (pStatList, nStatId, nDelta, nLayer) -> void`, `ret 0x10`).
 */
export function STATLIST_AddStatMemPort113c(
  m: Memory113c,
  pStatList: number,
  nStatId: number,
  nDelta: number,
  nLayer = 0,
): number {
  const s = pStatList >>> 0
  const d = nDelta | 0
  if (s === 0 || d === 0) return 0
  const dwKey = ((nStatId << 16) + (nLayer & 0xffff)) >>> 0
  const pBaseHdr = (s + 0x24) >>> 0
  const oldCount = (m.u16((pBaseHdr + 4) >>> 0) << 16) >> 16
  const idx = STATLIST_FindStatIndex113c(m, pBaseHdr, dwKey)
  const curVal = idx >= 0 ? m.u32((m.u32(pBaseHdr) + idx * 8 + 4) >>> 0) | 0 : 0
  const nextVal = (curVal + d) | 0
  const res = STATLIST_SetBaseStatEx113c(m, s, nStatId, nextVal, nLayer, 0)
  if (nextVal === 0 && idx >= 0 && idx === oldCount - 1) {
    m.setU32((m.u32(pBaseHdr) + idx * 8 + 4) >>> 0, 0)
  }
  return res
}

/**
 * `@va D2Common:0x6FD8A710` (`D2Common.#10551` `STATLIST_AddUnitStat`,
 * `stdcall (pUnit, nStatId, nDelta, nLayer) -> void`, `ret 0x10`).
 */
export function STATLIST_AddUnitStatMemPort113c(
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  nDelta: number,
  nLayer = 0,
): number {
  const d = nDelta | 0
  if (d === 0) return 0
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pList = m.u32((u + 0x5c) >>> 0)
  return STATLIST_AddStatMemPort113c(m, pList, nStatId, d, nLayer)
}

function clearUnitStateZeroMemPort113c(m: Memory113c, pUnit: number, stateId: number): void {
  const edi = m.u32((pUnit + 0x5c) >>> 0)
  if ((m.u32((edi + 0x10) >>> 0) | 0) >= 0) return
  const bitOff = (stateId & 0x1f) * 4
  const wordIdx = stateId >> 5
  const mask = m.u32((m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C) + bitOff) >>> 0)
  const pStateFlags = m.u32((edi + 0x58) >>> 0)
  const wasSet = (m.u32((pStateFlags + wordIdx * 4) >>> 0) & mask) >>> 0
  const invMask = m.u32((m.u32(D2COMMON_GDWINVBITMASKS_IAT_VA_MEMPORT_113C) + bitOff) >>> 0)
  m.setU32(
    (pStateFlags + wordIdx * 4) >>> 0,
    (m.u32((pStateFlags + wordIdx * 4) >>> 0) & invMask) >>> 0,
  )
  if (wasSet === 0) return
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nStates = m.u32((sgpt + 0xc4) >>> 0) | 0
  const t = (nStates + 0x1f) | 0
  const dirtyWords = (t + ((t >> 31) & 0x1f)) >> 5
  const dirtyAddr = (pStateFlags + (dirtyWords + wordIdx) * 4) >>> 0
  const mask2 = m.u32((m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C) + bitOff) >>> 0)
  m.setU32(dirtyAddr, (m.u32(dirtyAddr) | mask2) >>> 0)
  const pStatesTxt = (m.u32((sgpt + 0xbc) >>> 0) + imul32(stateId, 0x3c)) >>> 0
  if ((m.u8((pStatesTxt + 0x12) >>> 0) & m.u8(m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C))) === 0) {
    return
  }
  const pMask16 = m.u32((m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) + 0x10c) >>> 0)
  if (STATES_CheckStateMaskOnUnit113c(m, pUnit, pMask16) === 0) {
    m.setU32((pUnit + 0xc8) >>> 0, (m.u32((pUnit + 0xc8) >>> 0) & 0xfffffff7) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD8AE60` (`D2Common.#10196` `STATLIST_ExpireStateListsOnModeChange`,
 * `stdcall (pUnit) -> void`, `ret 4`).
 */
export function STATLIST_ExpireStateListsOnModeChangeMemPort113c(
  m: Memory113c,
  pUnit: number,
): void {
  const u = pUnit >>> 0
  const pListEx = m.u32((u + 0x5c) >>> 0)
  if (pListEx === 0 || (m.u8((pListEx + 0x10) >>> 0) & 0x02) === 0) return
  let sub = m.u32((pListEx + 0x3c) >>> 0)
  while (sub !== 0) {
    let nextSub = m.u32((sub + 0x2c) >>> 0)
    if ((m.u8((sub + 0x10) >>> 0) & 0x04) !== 0) {
      const stateNo = m.u32((sub + 0x14) >>> 0) | 0
      if (stateNo > 0) {
        const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
        if (stateNo < (m.u32((sgpt + 0xc4) >>> 0) | 0)) {
          clearUnitStateZeroMemPort113c(m, u, stateNo)
          UNITROOM_RefreshUnit113c(m, u)
        }
      }
      if ((m.u32((sub + 0x10) >>> 0) | 0) >= 0) {
        STATLIST_FreeStatListIfNonExtended113c(m, sub)
      }
      nextSub = m.u32((pListEx + 0x3c) >>> 0)
    }
    sub = nextSub
  }
  m.setU32((pListEx + 0x10) >>> 0, (m.u32((pListEx + 0x10) >>> 0) & 0xfffffffd) >>> 0)
}

/**
 * `@va D2Common:0x6FD803A0` (`D2Common.#10321` `SKILLS_GetUsedSkill`,
 * `stdcall (pUnit) -> D2SkillStrc*`, `ret 4`).
 *
 * Disassembly (`0x6FD803A0..0x6FD803D5`):
 * - If `pUnit == 0`, calls `Fog.#10023("ptUnit", "...\\Skills.cpp", 0x65c)` and `exit(-1)`.
 * - Reads `pSkills = *(uint32_t*)(pUnit + 0xA8)`; returns `0` if `pSkills == 0`, else `*(uint32_t*)(pSkills + 0x10)`.
 */
export function SKILLS_GetUsedSkillMemPort113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x65c)
  }
  const pSkills = m.u32((u + 0xa8) >>> 0)
  if (pSkills === 0) return 0
  return m.u32((pSkills + 0x10) >>> 0)
}

/**
 * `@va D2Common:0x6FD803E0` (`D2Common.#10322` `SKILLS_SetUsedSkill`,
 * `stdcall (pUnit, pSkill) -> void`, `ret 8`).
 *
 * Disassembly (`0x6FD803E0..0x6FD80416`):
 * - If `pUnit == 0`, calls `Fog.#10023("ptUnit", "...\\Skills.cpp", 0x653)` and `exit(-1)`.
 * - Reads `pSkills = *(uint32_t*)(pUnit + 0xA8)`; if non-zero, writes `*(uint32_t*)(pSkills + 0x10) = pSkill`.
 */
export function SKILLS_SetUsedSkillMemPort113c(
  m: Memory113c,
  pUnit: number,
  pSkill: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x653)
  }
  const pSkills = m.u32((u + 0xa8) >>> 0)
  if (pSkills !== 0) {
    m.setU32((pSkills + 0x10) >>> 0, pSkill >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD88520` (`D2Common.#10480` `STATLIST_GetStatListFromUnitAndState`,
 * `stdcall (pUnit, nState) -> D2StatListStrc*`, `ret 8`).
 *
 * Disassembly (`0x6FD88520..0x6FD8853F`):
 * - Reads `pListEx = *(uint32_t*)(pUnit + 0x5C)`.
 * - If `pListEx != 0` and `(int32_t)*(uint32_t*)(pListEx + 0x10) < 0`, tail-calls `0x6FD880B0(pListEx, nState, 0)`.
 * - Otherwise returns `0`.
 */
export function STATLIST_GetStatListFromUnitAndStateMemPort113c(
  m: Memory113c,
  pUnit: number,
  stateId: number,
): number {
  return STATLIST_GetStatListFromUnitAndState113c(m, pUnit >>> 0, stateId)
}

