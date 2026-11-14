/**
 * Diablo II v1.13c `D2Common.dll` inventory grid, item-extra node, and item-gfx cache primitives
 * (`Inventory.cpp`, `0x6FD6E360..0x6FD6F8F0`).
 *
 * Binary evidence (`objdump -d -M intel ~/d2-data/D2Common.dll`, image base `0x6FD50000`):
 * - `D2UnitStrc.dwUnitType == 4` (`UNIT_ITEM`): `cmp dword [reg], 4` at `0x6FD6E40F`, `0x6FD6E794`, `0x6FD6E893`, etc.
 * - `D2ItemExtraDataStrc` is embedded at `pItemData + 0x5C` (`add eax, 0x5C` at `0x6FD6E7A0`, `0x6FD6E89F`, `0x6FD6E8D6`,
 *   `0x6FD6E906`, `0x6FD6F642`, `0x6FD6F6A2`, `0x6FD6F701`, `0x6FD6F906`):
 *   - `+0x00` `pOwnerInventory` (`[eax]` at `0x6FD6E8A5`, `[edx]` at `0x6FD6F649`, `0x6FD6F6CD`)
 *   - `+0x04` `pPrevItem` (`[edx+0x4]` at `0x6FD6F6C7`, `[eax+0x4]` at `0x6FD6F90B`)
 *   - `+0x08` `pNextItem` (`[eax+0x8]` at `0x6FD6E910`, `0x6FD6F6C1`, `0x6FD6F903`)
 *   - `+0x0D` `nNodePosOther` (`movsx eax, byte [eax+0xD]` at `0x6FD6E8E0`)
 *   - `+0x10` `pPrevGridItem` (`[edx+0x10]` at `0x6FD6F66F`)
 *   - `+0x14` `pNextGridItem` (`[eax+0x14]` at `0x6FD6F669`)
 * - `INVENTORY_InitItemGfxCodeTable` (`0x6FD6E920`):
 *   - Guard flag `0x6FDF1488` (`mov eax, ds:0x6FDF1488; test eax,eax; jne` at `0x6FD6E920..0x6FD6E92A`)
 *   - Cache array `0x6FDF0BA8` (`255` entries x `8` bytes `{ u32 dwCode, i32 nItemType }`, zeroed via `mov ecx, 0x1FE; rep stosd` at `0x6FD6E933..0x6FD6E93D`)
 *   - Count dword `0x6FDF13A0` set to `0xFF` at `0x6FD6EC1D`
 *   - Reads `nItemsTxtRecordCount` at `0x6FDEFB94`, `pItemsTxt` at `0x6FDEFB98` (stride `0x1A8`, `dwCode` `+0x80`, `dwAlternateGfx` `+0x90`, `wType[0]` `+0x11E`),
 *     `sgptDataTables` at `0x6FDE9E1C` (`nItemTypesTxtRecordCount` `+0xBFC`, `nItemTypesEquivDwords` `+0xC00`, `pItemTypesEquiv` `+0xC04`),
 *     Fog `gdwBitMasks` IAT slot `0x6FDD90B0`, and static reference table at `0x6FDED888` (`mov esi, [edx*8+0x6FDED88C]` at `0x6FD6EB04`).
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2CorpseStrc,
  D2InventoryGridStrc,
  D2InventoryNodeStrc,
  D2InventoryStrc,
  D2ItemDataStrc,
  D2ItemsTxt,
  D2StaticPathStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATABLES_OFF_113C,
  DATATBLS_ValidateMonStatsIdInline113c,
} from './inline-helpers.ts'
import {
  SGPT_INVENTORY_TXT_MAX_VA,
  SGPT_INVENTORY_TXT_PTR_VA,
  DATATBLS_GetItemsTxtRecordByCode113c,
} from '../tables/datatbls-113c.ts'
import { imul32 } from './int-math.ts'
import { COMPOSIT_GetUnitWeaponClassCode113c } from './composit.ts'
import { DUNGEON_AddRoomPortalNode113c } from './dungeon.ts'
import { INVENTORY_GetWeaponByHandSlotMemPort113c } from './k0-d2common-memports.ts'
import {
  ITEMS_AreStackableWeaponsCompatible113c,
  ITEMS_CheckBodyLocation113c,
  ITEMS_CheckRequirements113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetItemColorColormap113c,
  ITEMS_GetItemTypeQuiverFromItem113c,
  ITEMS_GetItemTypeShootsFromItem113c,
  ITEMS_GetInvWidthFromItem113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_IsBeltable113c,
  ITEMS_IsTome113c,
  ITEMS_SetInvPage113c,
  unitsCanDualWieldMem113c,
} from './items.ts'
import {
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_UnlinkUnitStatList113c,
  getBaseStatWithMinFromList113c,
  getTotalStatWithMinFromList113c,
} from './statlist.ts'
import {
  UNIT_ITEM,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetRoom113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from './unit.ts'

export const INVENTORY_SIGNATURE_113C = 0x01020304

/** Offsets inside the embedded `D2ItemExtraDataStrc` at `pItemData + 0x5C` (evidence in file header). */
export const ITEM_EXTRA_OFF_113C = {
  pOwnerInventory: 0x00,
  pPrevItem: 0x04,
  pNextItem: 0x08,
  nNodePosOther: 0x0d,
  pPrevGridItem: 0x10,
  pNextGridItem: 0x14,
} as const

/** Globals read and written by `INVENTORY_InitItemGfxCodeTable` (`0x6FD6E920`). */
export const D2COMMON_ITEM_GFX_STATIC_TABLE_VA_113C = 0x6fded888
export const D2COMMON_ITEMS_TXT_COUNT_VA_113C = 0x6fdefb94
export const D2COMMON_ITEMS_TXT_PTR_VA_113C = 0x6fdefb98
export const D2COMMON_ITEM_GFX_CACHE_VA_113C = 0x6fdf0ba8
export const D2COMMON_ITEM_GFX_CACHE_COUNT_VA_113C = 0x6fdf13a0
export const D2COMMON_ITEM_GFX_INIT_FLAG_VA_113C = 0x6fdf1488

export const ITEMS_TXT_STRIDE_113C = 0x1a8
export const ITEMS_TXT_OFF_DWCODE_113C = 0x80
export const ITEMS_TXT_OFF_DWALTERNATEGFX_113C = 0x90
export const ITEMS_TXT_OFF_WTYPE0_113C = 0x11e

function s8(v: number): number {
  return (v << 24) >> 24
}

function s16(v: number): number {
  return (v << 16) >> 16
}

/**
 * Shared item-extra pointer resolution (`test reg,reg; je 0; cmp [reg],4; jne 0; mov eax,[reg+0x14];
 * test eax,eax; je 0; add eax,0x5C`). Note that callers after `0x6FD6E790` also test the post-add `eax != 0`.
 */
function itemExtraOrZero(m: Memory113c, pItem: number, checkPostAddZero: boolean): number {
  if (pItem === 0) return 0
  if (m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
  if (pItemData === 0) return 0
  const pExtra = (pItemData + D2ItemDataStrc.pExtraOwnerInventory.off) >>> 0
  if (checkPostAddZero && pExtra === 0) return 0
  return pExtra
}

/**
 * `@va D2Common:0x6FD6DC70` (`D2Common.#10155` `INVENTORY_GetCorpseUnitId`,
 * stdcall `[esp+4] = pCorpse`, `ret 4` -> `pCorpse->dwUnitId (+0x04)` or `0`).
 */
export function INVENTORY_GetCorpseUnitId113c(m: Memory113c, pCorpse: number): number {
  if (pCorpse === 0) return 0
  return m.get(pCorpse, D2CorpseStrc.dwUnitId) >>> 0
}

/**
 * `@va D2Common:0x6FD6DC90` (`D2Common.#10348` `INVENTORY_GetNextCorpse`,
 * stdcall `[esp+4] = pCorpse`, `ret 4` -> `pCorpse->pNextCorpse (+0x0C)` or `0`).
 */
export function INVENTORY_GetNextCorpse113c(m: Memory113c, pCorpse: number): number {
  if (pCorpse === 0) return 0
  return m.get(pCorpse, D2CorpseStrc.pNextCorpse) >>> 0
}

/**
 * `@va D2Common:0x6FD6DCB0` (`D2Common.#11096` `INVENTORY_GetCorpseCount`,
 * stdcall `[esp+4] = pInventory`, `ret 4` -> `pInventory->nCorpseCount (+0x3C)` or `0`).
 */
export function INVENTORY_GetCorpseCount113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0) return 0
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return 0
  return m.get(pInventory, D2InventoryStrc.nCorpseCount) >>> 0
}

/**
 * `@va D2Common:0x6FD6DD20` (`D2Common.#10284` `INVENTORY_GetFirstCorpse`,
 * stdcall `[esp+4] = pInventory`, `ret 4` -> `pInventory->pFirstCorpse (+0x34)` or `0`).
 */
export function INVENTORY_GetFirstCorpse113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0) return 0
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return 0
  return m.get(pInventory, D2InventoryStrc.pFirstCorpse) >>> 0
}

/**
 * `@va D2Common:0x6FD6DE50` (`D2Common.#11134` `INVENTORY_GetLeftItemGuid`,
 * stdcall `[esp+4] = pInventory`, `ret 4` -> `pInventory->dwLeftItemGuid (+0x24)` or `-1` (`0xFFFFFFFF`)).
 */
export function INVENTORY_GetLeftItemGuid113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0) return -1
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return -1
  return m.get(pInventory, D2InventoryStrc.dwLeftItemGuid) >>> 0
}

/**
 * `@va D2Common:0x6FD6DE70` (`D2Common.#10268` `INVENTORY_SetLeftItemGuid`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = dwItemGuid`, `ret 8`, void).
 */
export function INVENTORY_SetLeftItemGuid113c(
  m: Memory113c,
  pInventory: number,
  dwItemGuid: number,
): void {
  if (pInventory === 0) return
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return
  m.set(pInventory, D2InventoryStrc.dwLeftItemGuid, dwItemGuid >>> 0)
}

/**
 * `@va D2Common:0x6FD6DE90` (`D2Common.#10508` `INVENTORY_GetItemCount`,
 * stdcall `[esp+4] = pInventory`, `ret 4` -> `pInventory->dwItemCount (+0x28)` or `0`).
 */
export function INVENTORY_GetItemCount113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0) return 0
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return 0
  return m.get(pInventory, D2InventoryStrc.dwItemCount) >>> 0
}

/**
 * `@va D2Common:0x6FD6DEB0` (`D2Common.#10727` `INVENTORY_GetNodeItemGuid`,
 * stdcall `[esp+4] = pNode`, `ret 4` -> `pNode->dwItemId (+0x00)` or `0`).
 */
export function INVENTORY_GetNodeItemGuid113c(m: Memory113c, pNode: number): number {
  if (pNode === 0) return 0
  return m.get(pNode, D2InventoryNodeStrc.dwItemId) >>> 0
}

/**
 * `@va D2Common:0x6FD6DEC0` (`D2Common.#10691` `INVENTORY_GetNextNode`,
 * stdcall `[esp+4] = pNode`, `ret 4` -> `pNode->pNext (+0x04)` or `0`).
 */
export function INVENTORY_GetNextNode113c(m: Memory113c, pNode: number): number {
  if (pNode === 0) return 0
  return m.get(pNode, D2InventoryNodeStrc.pNext) >>> 0
}

/**
 * `@va D2Common:0x6FD6DEE0` (`D2Common.#10642` `INVENTORY_CheckNodeExists`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = dwItemId`, `ret 8` -> `1` if found, else `0`).
 */
export function INVENTORY_CheckNodeExists113c(
  m: Memory113c,
  pInventory: number,
  dwItemId: number,
): number {
  if (pInventory === 0) return 0
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return 0
  let pNode = m.get(pInventory, D2InventoryStrc.pFirstNode)
  const target = dwItemId >>> 0
  while (pNode !== 0) {
    if (m.get(pNode, D2InventoryNodeStrc.dwItemId) === target) return 1
    pNode = m.get(pNode, D2InventoryNodeStrc.pNext)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD6DF70` (`D2Common.#10170` `INVENTORY_GetFirstNode`,
 * stdcall `[esp+4] = pInventory`, `ret 4` -> `pInventory->pFirstNode (+0x2C)` or `0`).
 */
export function INVENTORY_GetFirstNode113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0) return 0
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return 0
  return m.get(pInventory, D2InventoryStrc.pFirstNode) >>> 0
}

/**
 * `@va D2Common:0x6FD6DF90` (`D2Common.#10267` `INVENTORY_NoOpRet8A`,
 * stdcall 2 stack args, `ret 8`, void).
 */
export function INVENTORY_NoOpRet8A113c(_m: Memory113c, _a0: number, _a1: number): void {}

/**
 * `@va D2Common:0x6FD6DFB0` (`D2Common.#11017` `INVENTORY_GetCursorItem`,
 * stdcall `[esp+4] = pInventory`, `ret 4` -> `pInventory->pCursorItem (+0x20)` or `0`).
 */
export function INVENTORY_GetCursorItem113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0) return 0
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return 0
  return m.get(pInventory, D2InventoryStrc.pCursorItem) >>> 0
}

/**
 * `@va D2Common:0x6FD6DFD0` (`D2Common.#10608` `INVENTORY_NoOpRet8B`,
 * stdcall 2 stack args, `ret 8`, void).
 */
export function INVENTORY_NoOpRet8B113c(_m: Memory113c, _a0: number, _a1: number): void {}

/**
 * `@va D2Common:0x6FD6DFF0` (`D2Common.#10869` `INVENTORY_NoOpRet20`,
 * stdcall 8 stack args, `ret 0x20`, void).
 */
export function INVENTORY_NoOpRet20113c(
  _m: Memory113c,
  _a0: number,
  _a1: number,
  _a2: number,
  _a3: number,
  _a4: number,
  _a5: number,
  _a6: number,
  _a7: number,
): void {}

/**
 * `@va D2Common:0x6FD6E010` (`INVENTORY_ScoreGridRectPlacement`,
 * custom LTCG `eax = nY`, `cl = nHeight`, stack `[esp+4] = pGrid`, `[esp+8] = nX`, `[esp+0xC] = nWidth`,
 * `ret 0xC` -> placement adjacency/border score, clamped to `0xFF` when `score >= 2 * (w + h)`).
 */
export function INVENTORY_ScoreGridRectPlacement113c(
  m: Memory113c,
  nY: number,
  nHeight: number,
  pGrid: number,
  nX: number,
  nWidth: number,
): number {
  const y0 = nY | 0
  const h = nHeight & 0xff
  const x0 = nX | 0
  const w = nWidth & 0xff
  let score = 0
  const yEnd = (y0 + h) | 0

  if (x0 <= 0) {
    score = (score + h) | 0
  } else if (y0 < yEnd) {
    const ppItems = m.get(pGrid, D2InventoryGridStrc.ppItems)
    const gw = m.get(pGrid, D2InventoryGridStrc.nGridWidth)
    const rowStrideBytes = (gw * 4) | 0
    let pCell = (ppItems + imul32(imul32(gw, y0) + ((x0 - 1) | 0), 4)) >>> 0
    for (let y = y0; y < yEnd; y = (y + 1) | 0) {
      if (m.u32(pCell) !== 0) {
        score = (score + 1) | 0
      }
      pCell = (pCell + rowStrideBytes) >>> 0
    }
  }

  const gw = m.get(pGrid, D2InventoryGridStrc.nGridWidth)
  const xEnd = (x0 + w) | 0
  if (xEnd >= gw) {
    score = (score + h) | 0
  } else if (y0 < yEnd) {
    const ppItems = m.get(pGrid, D2InventoryGridStrc.ppItems)
    const rowStrideBytes = (gw * 4) | 0
    let pCell = (ppItems + imul32(imul32(gw, y0) + xEnd, 4)) >>> 0
    for (let y = y0; y < yEnd; y = (y + 1) | 0) {
      if (m.u32(pCell) !== 0) {
        score = (score + 1) | 0
      }
      pCell = (pCell + rowStrideBytes) >>> 0
    }
  }

  if (y0 <= 0) {
    score = (score + w) | 0
  } else if (x0 < xEnd) {
    const ppItems = m.get(pGrid, D2InventoryGridStrc.ppItems)
    const pRow = (ppItems + imul32(imul32(gw, (y0 - 1) | 0), 4)) >>> 0
    for (let x = x0; x < xEnd; x = (x + 1) | 0) {
      if (m.u32((pRow + imul32(x, 4)) >>> 0) !== 0) {
        score = (score + 1) | 0
      }
    }
  }

  const gh = m.get(pGrid, D2InventoryGridStrc.nGridHeight)
  if (yEnd >= gh) {
    score = (score + w) | 0
  } else if (x0 < xEnd) {
    const ppItems = m.get(pGrid, D2InventoryGridStrc.ppItems)
    const pRow = (ppItems + imul32(imul32(gw, yEnd), 4)) >>> 0
    for (let x = x0; x < xEnd; x = (x + 1) | 0) {
      if (m.u32((pRow + imul32(x, 4)) >>> 0) !== 0) {
        score = (score + 1) | 0
      }
    }
  }

  const maxPerimeter = ((w + h) << 1) | 0
  if (score >= maxPerimeter) return 0xff
  return score >>> 0
}

/**
 * `@va D2Common:0x6FD6E190` (`D2Common.#10460` `INVENTORY_GetFirstItem`,
 * stdcall `[esp+4] = pInventory`, `ret 4` -> `pInventory->pFirstItem (+0x0C)` or `0`).
 */
export function INVENTORY_GetFirstItem113c(m: Memory113c, pInventory: number): number {
  if (pInventory === 0) return 0
  if (m.get(pInventory, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return 0
  return m.get(pInventory, D2InventoryStrc.pFirstItem) >>> 0
}

/**
 * `@va D2Common:0x6FD6E310` (`INVENTORY_FillGridRect`,
 * custom LTCG `al = nHeight`, `ecx = nY`, `edx = nX`, stack `[esp+4] = pGrid`, `[esp+8] = nWidth`, `[esp+0xC] = pItem`,
 * `ret 0xC`, void).
 */
export function INVENTORY_FillGridRect113c(
  m: Memory113c,
  nHeight: number,
  nY: number,
  nX: number,
  pGrid: number,
  nWidth: number,
  pItem: number,
): void {
  const y0 = nY | 0
  const yEnd = ((nHeight & 0xff) + y0) | 0
  if (y0 >= yEnd) return
  const x0 = nX | 0
  const xEnd = (x0 + (nWidth & 0xff)) | 0
  const gw = m.get(pGrid, D2InventoryGridStrc.nGridWidth)
  const rowStrideBytes = (gw * 4) | 0
  const ppItems = m.get(pGrid, D2InventoryGridStrc.ppItems)
  let pRow = (ppItems + imul32(imul32(gw, y0), 4)) >>> 0
  const itemVal = pItem >>> 0
  for (let y = y0; y < yEnd; y = (y + 1) | 0) {
    for (let x = x0; x < xEnd; x = (x + 1) | 0) {
      m.setU32((pRow + imul32(x, 4)) >>> 0, itemVal)
    }
    pRow = (pRow + rowStrideBytes) >>> 0
  }
}

/**
 * `@va D2Common:0x6FD6E360` (`INVENTORY_IsGridRectEmpty`, `eax = pGrid`, `ecx = nY`, `dl = nWidth`,
 * stack `[esp+4] = nX`, `[esp+8] = nHeight`, `ret 8` -> `0` or `1`).
 *
 * Notice how `0x6FD6E363` reads `movzx esi, byte [esp+0x14]` after 3 pushes (`ebx, ebp, esi`), which is
 * stack arg 2 (`nHeight`), then pushes `edi` at `0x6FD6E36C` and reads `mov eax, [esp+0x14]` at `0x6FD6E373`,
 * which is now stack arg 1 (`nX`). If `nY >= nY + (u8)nHeight` (`cmp ecx, esi; jge 0x6FD6E3B2`), returns `1`
 * immediately without dereferencing `pGrid`.
 */
export function INVENTORY_IsGridRectEmpty113c(
  m: Memory113c,
  pGrid: number,
  nY: number,
  nWidth: number,
  nX: number,
  nHeight: number,
): number {
  const yStart = nY | 0
  const yEnd = ((nHeight & 0xff) + yStart) | 0
  if (yStart >= yEnd) return 1

  const xStart = nX | 0
  const xEnd = (xStart + (nWidth & 0xff)) | 0
  const gridWidth = m.get(pGrid, D2InventoryGridStrc.nGridWidth)
  const rowStrideBytes = (gridWidth * 4) | 0
  const initialWordOff = imul32(gridWidth, yStart)
  const ppItems = m.get(pGrid, D2InventoryGridStrc.ppItems)
  let rowPtr = (ppItems + imul32(initialWordOff, 4)) >>> 0

  for (let y = yStart; y < yEnd; y = (y + 1) | 0) {
    if (xStart < xEnd) {
      for (let x = xStart; x < xEnd; x = (x + 1) | 0) {
        const cellAddr = (rowPtr + imul32(x, 4)) >>> 0
        if (m.u32(cellAddr) !== 0) return 0
      }
    }
    rowPtr = (rowPtr + rowStrideBytes) >>> 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD6E400` (`D2Common.#11147` `INVENTORY_UnitIsItem`, stdcall `[esp+4] = pUnit`, `ret 4`
 * -> `pUnit` if `pUnit != NULL && pUnit->dwUnitType == 4`, else `0`).
 */
export function INVENTORY_UnitIsItem113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  return m.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_ITEM ? pUnit >>> 0 : 0
}

/**
 * `@va D2Common:0x6FD6E790` (`INVENTORY_GetItemExtraData`, `eax = pItem`, `ret`
 * -> `pItemData + 0x5C` or `0`).
 */
export function INVENTORY_GetItemExtraData113c(m: Memory113c, pItem: number): number {
  return itemExtraOrZero(m, pItem, false)
}

/**
 * `@va D2Common:0x6FD6E880` (`D2Common.#10004` `INVENTORY_GetItemIfOwnedByInventory`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8` -> `pItem` or `0`).
 */
export function INVENTORY_GetItemIfOwnedByInventory113c(m: Memory113c, pInventory: number, pItem: number): number {
  if (pInventory === 0) return 0
  const pExtra = itemExtraOrZero(m, pItem, true)
  if (pExtra === 0) return 0
  return m.u32(pExtra) === pInventory >>> 0 ? pItem >>> 0 : 0
}

/**
 * `@va D2Common:0x6FD6E8C0` (`D2Common.#10698` `INVENTORY_GetItemNodePositionOther`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> signed `int8` at `pExtra + 0x0D` or `0`).
 */
export function INVENTORY_GetItemNodePositionOther113c(m: Memory113c, pItem: number): number {
  const pExtra = itemExtraOrZero(m, pItem, true)
  if (pExtra === 0) return 0
  return s8(m.u8((pExtra + ITEM_EXTRA_OFF_113C.nNodePosOther) >>> 0))
}

/**
 * `@va D2Common:0x6FD6E8F0` (`D2Common.#10464` `INVENTORY_GetNextItem`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `pExtra->pNextItem (+0x08)` or `0`).
 */
export function INVENTORY_GetNextItem113c(m: Memory113c, pItem: number): number {
  const pExtra = itemExtraOrZero(m, pItem, true)
  if (pExtra === 0) return 0
  return m.u32((pExtra + ITEM_EXTRA_OFF_113C.pNextItem) >>> 0)
}

/**
 * `@va D2Common:0x6FD6E920` (`INVENTORY_InitItemGfxCodeTable`, no args, `ret`, void).
 *
 * One-shot initializer for the 255-slot item gfx code lookup table at `0x6FDF0BA8` (`255 * 8` bytes).
 * Seeds slots `1..3` with `'lit '`, `'med '`, `'hvy '` (type `3`), sets `0x6FDF1488 = 1`, scans
 * `nItemsTxtRecordCount` (`0x6FDEFB94`) records at `pItemsTxt` (`0x6FDEFB98`, stride `0x1A8`), tests
 * `ItemTypes` equivalence bits (`45` weapon, `3` body armor, `51` shield, `37` helm, excluding `75` circlet),
 * resolves slot collisions against the static table at `0x6FDED888` (`45` weapon / `50` any armor) and
 * existing cache entries, clamps `s >= 255` back to `nextFree`, and writes `0xFF` to `0x6FDF13A0`.
 */
export function INVENTORY_InitItemGfxCodeTable113c(m: Memory113c): void {
  if (m.u32(D2COMMON_ITEM_GFX_INIT_FLAG_VA_113C) !== 0) return

  for (let i = 0; i < 0x1fe; i++) {
    m.setU32((D2COMMON_ITEM_GFX_CACHE_VA_113C + i * 4) >>> 0, 0)
  }
  m.setU32(0x6fdf0bb4, 3)
  m.setU32(0x6fdf0bbc, 3)
  m.setU32(0x6fdf0bc4, 3)

  const nItems = m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C) | 0
  m.setU32(D2COMMON_ITEM_GFX_INIT_FLAG_VA_113C, 1)
  m.setU32(0x6fdf0bb0, 0x2074696c) // 'lit '
  m.setU32(0x6fdf0bb8, 0x2064656d) // 'med '
  m.setU32(0x6fdf0bc0, 0x20797668) // 'hvy '

  let nextFree = 4
  if (nItems > 0) {
    let edx = (m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) + ITEMS_TXT_OFF_WTYPE0_113C) >>> 0
    const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)

    const checkEquiv = (typeId: number, gateType: number, dwordOff: number, bmByteOff: number): boolean => {
      if (typeId < 0) return false
      const nt = m.u32(dt + DATATABLES_OFF_113C.nItemTypesTxtRecordCount) | 0
      if (typeId >= nt || nt <= gateType) return false
      const w = m.u32(dt + DATATABLES_OFF_113C.nItemTypesEquivDwords) | 0
      const equiv = m.u32(dt + DATATABLES_OFF_113C.pItemTypesEquiv)
      const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
      const mask = m.u32((pBitMasks + bmByteOff) >>> 0)
      const val = m.u32((equiv + imul32(w, typeId) * 4 + dwordOff) >>> 0)
      return (val & mask) !== 0
    }

    for (let rem = nItems; rem !== 0; rem = (rem - 1) | 0) {
      let code = m.u32((edx - 0x8e) >>> 0) // rec + 0x90 (dwAlternateGfx)
      if (code === 0) {
        code = m.u32((edx - 0x9e) >>> 0) // rec + 0x80 (dwCode)
      }
      const t = s16(m.u16(edx))
      let ok = 0
      if (t >= 0) {
        const matched =
          checkEquiv(t, 0x2d, 0x4, 0x34) ||
          checkEquiv(t, 0x03, 0x0, 0x0c) ||
          checkEquiv(t, 0x33, 0x4, 0x4c) ||
          checkEquiv(t, 0x25, 0x4, 0x14)
        if (matched && !checkEquiv(t, 0x4b, 0x8, 0x2c)) {
          ok = 1
        }
      }

      let dup = false
      if (nextFree > 0) {
        for (let i = 0; i < nextFree; i++) {
          if (m.u32((D2COMMON_ITEM_GFX_CACHE_VA_113C + i * 8) >>> 0) === code) {
            dup = true
            break
          }
        }
      }

      if (!dup && ok === 1) {
        const tRec = s16(m.u16(edx))
        let s = nextFree
        while (true) {
          const tt = m.u32((D2COMMON_ITEM_GFX_STATIC_TABLE_VA_113C + 4 + s * 8) >>> 0) | 0
          if (checkEquiv(tt, 0x2d, 0x4, 0x34) && checkEquiv(tRec, 0x2d, 0x4, 0x34)) {
            s = (s + 1) | 0
            continue
          }
          if (checkEquiv(tt, 0x32, 0x4, 0x48) && checkEquiv(tRec, 0x32, 0x4, 0x48)) {
            s = (s + 1) | 0
            continue
          }
          if (m.u32((D2COMMON_ITEM_GFX_CACHE_VA_113C + s * 8) >>> 0) !== 0) {
            s = (s + 1) | 0
            continue
          }
          break
        }
        if (s >= 0xff) {
          s = nextFree
        }
        m.setU32((D2COMMON_ITEM_GFX_CACHE_VA_113C + s * 8) >>> 0, code)
        m.setU32((D2COMMON_ITEM_GFX_CACHE_VA_113C + 4 + s * 8) >>> 0, s16(m.u16(edx)) >>> 0)
        if (s === nextFree) {
          nextFree = (nextFree + 1) | 0
        }
      }

      edx = (edx + ITEMS_TXT_STRIDE_113C) >>> 0
    }
  }

  m.setU32(D2COMMON_ITEM_GFX_CACHE_COUNT_VA_113C, 0xff)
}

/**
 * `@va D2Common:0x6FD6F630` (`INVENTORY_LinkItemToGridList`, `ecx = pItem`, `esi = pGrid`,
 * stack `[esp+4] = pInventory`, `ret 4`, void).
 */
export function INVENTORY_LinkItemToGridList113c(
  m: Memory113c,
  pItem: number,
  pGrid: number,
  pInventory: number,
): void {
  const pExtra = itemExtraOrZero(m, pItem, true)
  if (pExtra === 0) return
  if (m.u32(pExtra) !== pInventory >>> 0) return

  const pLast = m.get(pGrid, D2InventoryGridStrc.pLastItem)
  if (pLast === 0) {
    m.set(pGrid, D2InventoryGridStrc.pFirstItem, pItem >>> 0)
  } else {
    const pLastExtra = itemExtraOrZero(m, pLast, true)
    if (pLastExtra !== 0) {
      m.setU32((pLastExtra + ITEM_EXTRA_OFF_113C.pNextGridItem) >>> 0, pItem >>> 0)
    }
  }
  const prevLast = m.get(pGrid, D2InventoryGridStrc.pLastItem)
  m.setU32((pExtra + ITEM_EXTRA_OFF_113C.pPrevGridItem) >>> 0, prevLast)
  m.set(pGrid, D2InventoryGridStrc.pLastItem, pItem >>> 0)
}

/**
 * `@va D2Common:0x6FD6F690` (`INVENTORY_LinkItemToInventoryList`, `ecx = pItem`, `esi = pInventory`,
 * `ret`, void).
 */
export function INVENTORY_LinkItemToInventoryList113c(m: Memory113c, pItem: number, pInventory: number): void {
  const pExtra = itemExtraOrZero(m, pItem, true)
  if (pExtra === 0) return

  const pLast = m.get(pInventory, D2InventoryStrc.pLastItem)
  if (pLast === 0) {
    m.set(pInventory, D2InventoryStrc.pFirstItem, pItem >>> 0)
  } else {
    const pLastExtra = itemExtraOrZero(m, pLast, true)
    if (pLastExtra !== 0) {
      m.setU32((pLastExtra + ITEM_EXTRA_OFF_113C.pNextItem) >>> 0, pItem >>> 0)
    }
  }
  const prevLast = m.get(pInventory, D2InventoryStrc.pLastItem)
  m.setU32((pExtra + ITEM_EXTRA_OFF_113C.pPrevItem) >>> 0, prevLast)
  m.set(pInventory, D2InventoryStrc.pLastItem, pItem >>> 0)
  m.setU32(pExtra, pInventory >>> 0)
}

/**
 * `@va D2Common:0x6FD6F6E0` (`D2Common.#10391` `INVENTORY_IsItemOwnedByInventory`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8` -> `0` or `1`).
 */
export function INVENTORY_IsItemOwnedByInventory113c(m: Memory113c, pInventory: number, pItem: number): number {
  if (pInventory === 0) return 0
  const pExtra = itemExtraOrZero(m, pItem, true)
  if (pExtra === 0) return 0
  return m.u32(pExtra) === pInventory >>> 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD6F8F0` (`INVENTORY_UnlinkItemFromList`, `edx = pItem`, `esi = pListHeader`
 * (`{ pFirstItem (+0), pLastItem (+4) }`, e.g. `pInventory + 0x0C`), `ret`, void).
 */
export function INVENTORY_UnlinkItemFromList113c(m: Memory113c, pItem: number, pListHeader: number): void {
  const pExtra = itemExtraOrZero(m, pItem, true)
  if (pExtra === 0) return

  const pPrev = m.u32((pExtra + ITEM_EXTRA_OFF_113C.pPrevItem) >>> 0)
  if (pPrev === 0) {
    if (m.u32(pListHeader >>> 0) === pItem >>> 0) {
      const pNext0 = m.u32((pExtra + ITEM_EXTRA_OFF_113C.pNextItem) >>> 0)
      m.setU32(pListHeader >>> 0, pNext0)
    }
  } else {
    const pPrevExtra = itemExtraOrZero(m, pPrev, true)
    if (pPrevExtra !== 0) {
      const pNext0 = m.u32((pExtra + ITEM_EXTRA_OFF_113C.pNextItem) >>> 0)
      m.setU32((pPrevExtra + ITEM_EXTRA_OFF_113C.pNextItem) >>> 0, pNext0)
    }
  }

  const pNext = m.u32((pExtra + ITEM_EXTRA_OFF_113C.pNextItem) >>> 0)
  if (pNext === 0) {
    if (m.u32((pListHeader + 0x4) >>> 0) === pItem >>> 0) {
      const pPrev0 = m.u32((pExtra + ITEM_EXTRA_OFF_113C.pPrevItem) >>> 0)
      m.setU32((pListHeader + 0x4) >>> 0, pPrev0)
    }
  } else {
    const pNextExtra = itemExtraOrZero(m, pNext, true)
    if (pNextExtra !== 0) {
      const pPrev0 = m.u32((pExtra + ITEM_EXTRA_OFF_113C.pPrevItem) >>> 0)
      m.setU32((pNextExtra + ITEM_EXTRA_OFF_113C.pPrevItem) >>> 0, pPrev0)
    }
  }

  m.setU32((pExtra + ITEM_EXTRA_OFF_113C.pNextItem) >>> 0, 0)
  m.setU32((pExtra + ITEM_EXTRA_OFF_113C.pPrevItem) >>> 0, 0)
}

/** `.bss` `gpInventoryTxtTable` (`D2InventoryTxt*`, stride `0x108`) at `0x6FDF13DC` (`0x6FD632AA add eax, ds:0x6fdf13dc`). */
export const G_INVENTORY_TXT_TABLE_VA_113C = 0x6fdf13dc
/** `.bss` `sgptDataTables_nWeapClassCount` (`u32`) at `0x6FDEF020` (`0x6FD7247C mov edx, ds:0x6fdef020`). */
export const D2COMMON_WEAP_CLASS_COUNT_VA_113C = 0x6fdef020
/** `.bss` `sgptDataTables_WeapClassTable` (`{ u32 dwCode, u16 wIdx, u16 pad }[]`) at `0x6FDEF028` (`0x6FD7248B cmp [ecx*8+0x6fdef028], eax`). */
export const D2COMMON_WEAP_CLASS_TABLE_VA_113C = 0x6fdef028
/** `.bss` `sgptDataTables_pItemsCodeIndex` (`D2TxtLinkStrc*`) at `0x6FDEFF6C` (`0x6FD72145 mov ecx, ds:0x6fdeff6c`). */
export const D2COMMON_ITEMS_CODE_LINK_VA_113C = 0x6fdeff6c

/** `.data` `sgptCharInvRecCount` (`u32`) at `0x6FDEEFE4` (`0x6FD7FBBA mov edx, ds:0x6fdeefe4`). */
export const D2COMMON_CHAR_INV_REC_COUNT_VA_113C = 0x6fdeefe4
/** `.data` `sgptCharInvRecTable` (`{ u32 dwClassId, u32 nInvRecId }[7]`) at `0x6FDEEFE8` (`0x6FD7FBC9 cmp [ecx*8+0x6fdeefe8], eax`). */
export const D2COMMON_CHAR_INV_REC_TABLE_VA_113C = 0x6fdeefe8

interface FogBitBufferState113c {
  pBuffer: number
  nBits: number
  nPos: number
  nPosBits: number
  bFull: number
}

/**
 * Exact 1.13c `Fog:0x6FF63CD0` core bit reader invoked by `Fog.#10129` (`BITMANIP_ReadSigned`)
 * and `Fog.#10130` (`BITMANIP_Read`).
 */
function fogBitManipReadCore113c(
  m: Memory113c,
  bitBuf: FogBitBufferState113c,
  nBitsToRead: number,
): number {
  const nBits = bitBuf.nBits | 0
  let overflow = (((bitBuf.nPos << 3) - nBits + nBitsToRead + bitBuf.nPosBits) | 0)
  if (overflow < 0) {
    overflow = 0
  }
  let edx = (nBitsToRead - overflow) | 0
  if (overflow !== 0) {
    bitBuf.bFull = 1
  }
  let edi = 0
  let eax = 0
  while (edx > 0) {
    let ebx = (8 - bitBuf.nPosBits) | 0
    if (ebx >= edx) {
      ebx = edx
    }
    const rawByte = m.u8((bitBuf.pBuffer + bitBuf.nPos) >>> 0)
    const shifted = rawByte >>> (bitBuf.nPosBits & 31)
    const masked = (shifted & ((1 << ebx) - 1)) >>> 0
    eax = (eax | ((masked << (edi & 31)) >>> 0)) >>> 0
    edi = (edi + ebx) | 0
    bitBuf.nPosBits = (bitBuf.nPosBits + ebx) | 0
    if (bitBuf.nPosBits === 8) {
      bitBuf.nPos = (bitBuf.nPos + 1) | 0
      bitBuf.nPosBits = 0
    }
    edx = (edx - ebx) | 0
  }
  return eax >>> 0
}

/**
 * Exact 1.13c `Fog.#10130` (`0x6FF64060` `BITMANIP_Read`, `__stdcall(pBitBuf, nBits)`).
 */
export function fogBitManipReadUnsigned113c(
  m: Memory113c,
  bitBuf: FogBitBufferState113c,
  nBitsToRead: number,
): number {
  return fogBitManipReadCore113c(m, bitBuf, nBitsToRead)
}

/**
 * Exact 1.13c `Fog.#10129` (`0x6FF640C0` `BITMANIP_ReadSigned`, `__stdcall(pBitBuf, nBits)`).
 */
export function fogBitManipReadSigned113c(
  m: Memory113c,
  bitBuf: FogBitBufferState113c,
  nBitsToRead: number,
): number {
  const eax = fogBitManipReadCore113c(m, bitBuf, nBitsToRead)
  if ((nBitsToRead | 0) < 32) {
    const signBit = (1 << ((nBitsToRead - 1) & 31)) >>> 0
    if ((eax & signBit) !== 0) {
      const negMask = (~((signBit - 1) >>> 0)) >>> 0
      return (eax | negMask) | 0
    }
  }
  return eax | 0
}

/**
 * Exact 1.13c `Fog.#10213` (`0x6FF61F00` `DATATBLS_GetLinkIndex`, `__stdcall(pLinker, dwCode, bLogError)`).
 * Performs half-open `[0, nRecords)` binary search over `pLinker->nRecords` (`+0x00`) sorted entries
 * at `pLinker->pEntries` (`+0x08`, 8-byte `{ u32 dwCode, u32 nIndex }` stride).
 */
export function fogGetLinkIndex113c(m: Memory113c, pLinker: number, dwCode: number): number {
  const linker = pLinker >>> 0
  let hi = m.u32(linker) | 0
  let lo = 0
  const pEntries = m.u32((linker + 0x08) >>> 0) >>> 0
  if (hi <= 0) return -1
  const target = dwCode >>> 0
  while (lo < hi) {
    const mid = (lo + (((hi - lo) / 2) | 0)) | 0
    const entryAddr = (pEntries + ((mid * 8) | 0)) >>> 0
    const entryCode = m.u32(entryAddr) >>> 0
    if (target === entryCode) {
      return m.u32((entryAddr + 4) >>> 0) | 0
    }
    if (target < entryCode) {
      hi = mid
    } else {
      lo = (mid + 1) | 0
    }
  }
  return -1
}

/**
 * `@va D2Common:0x6FD632A0` (`D2Common.#10691` `DATATBLS_GetInventoryTxtRecord`,
 * stdcall `[esp+4] = nInvId`, `[esp+8] = bHigherRes`, `[esp+0xC] = pOutRecord`, `ret 0xC`, void).
 *
 * Asserts `(m.u32(0x6FDF13DC) + nInvId * 0x108) != 0` (`line 0x83`), then copies 66 dwords (`0x108` bytes)
 * from `m.u32(0x6FDF13DC) + (bHigherRes * 7 + nInvId) * 0x108` into `pOutRecord`.
 */
export function DATATBLS_GetInventoryTxtRecord113c(
  m: Memory113c,
  nInvId: number,
  bHigherRes: number,
  pOutRecord: number,
): void {
  const base = m.u32(G_INVENTORY_TXT_TABLE_VA_113C)
  const checkAddr = (base + imul32(nInvId | 0, 0x108)) >>> 0
  if (checkAddr === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\InvTbls.cpp', 0x83)
  }
  const idx = (imul32(bHigherRes | 0, 7) + (nInvId | 0)) | 0
  const src = (m.u32(G_INVENTORY_TXT_TABLE_VA_113C) + imul32(idx, 0x108)) >>> 0
  const dst = pOutRecord >>> 0
  for (let i = 0; i < 0x108; i += 4) {
    m.setU32((dst + i) >>> 0, m.u32((src + i) >>> 0))
  }
}

/**
 * `@va D2Common:0x6FD6DD40` (`D2Common.#10617` `INVENTORY_FreeCorpse`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = dwUnitId`, `[esp+0xC] = bCountAsCorpse`, `ret 0xC` -> `BOOL`).
 *
 * Validates `pInventory != 0` and `dwSignature == 0x01020304`, searches `pFirstCorpse` (`+0x34`) for
 * `dwUnitId (+0x04) == dwUnitId && bCountAsCorpse (+0x00) == bCountAsCorpse`, unlinks it (updating
 * `pFirstCorpse` / `pLastCorpse`), decrements `nCorpseCount (+0x3C)` if `pCorpse->bCountAsCorpse != 0`,
 * and returns `1` (`0` if not found).
 */
export function INVENTORY_FreeCorpse113c(
  m: Memory113c,
  pInventory: number,
  dwUnitId: number,
  bCountAsCorpse: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  if (m.get(inv, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return 0
  let pCur = m.get(inv, D2InventoryStrc.pFirstCorpse)
  if (pCur === 0) return 0
  let pPrev = 0
  const targetId = dwUnitId >>> 0
  const targetCountFlag = bCountAsCorpse >>> 0
  while (pCur !== 0) {
    if (
      m.get(pCur, D2CorpseStrc.dwUnitId) === targetId &&
      m.get(pCur, D2CorpseStrc.bCountAsCorpse) === targetCountFlag
    ) {
      break
    }
    pPrev = pCur
    pCur = m.get(pCur, D2CorpseStrc.pNextCorpse)
  }
  if (pCur === 0) return 0
  const pNext = m.get(pCur, D2CorpseStrc.pNextCorpse)
  if (pPrev !== 0) {
    m.set(pPrev, D2CorpseStrc.pNextCorpse, pNext)
    if (m.get(pPrev, D2CorpseStrc.pNextCorpse) === 0) {
      m.set(inv, D2InventoryStrc.pLastCorpse, pPrev)
    }
  } else {
    m.set(inv, D2InventoryStrc.pFirstCorpse, pNext)
    if (m.get(inv, D2InventoryStrc.pFirstCorpse) === 0) {
      m.set(inv, D2InventoryStrc.pLastCorpse, 0)
    }
  }
  if (m.get(pCur, D2CorpseStrc.bCountAsCorpse) !== 0) {
    m.set(
      inv,
      D2InventoryStrc.nCorpseCount,
      (m.get(inv, D2InventoryStrc.nCorpseCount) - 1) >>> 0,
    )
  }
  m.u32((inv + 0x04) >>> 0)
  return 1
}

/**
 * `@va D2Common:0x6FD6DDD0` (`D2Common.#10903` `INVENTORY_AllocCorpse`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = dwUnitId`, `[esp+0xC] = eClass`, `[esp+0x10] = bCountAsCorpse`, `ret 0x10` -> `D2CorpseStrc*`).
 *
 * Returns `0` if `pInventory == 0 || pInventory->dwSignature != 0x01020304`. Otherwise allocates a 16-byte
 * `D2CorpseStrc`, appends it to the tail of `pFirstCorpse` / `pLastCorpse` (`+0x34` / `+0x38`), increments
 * `nCorpseCount (+0x3C)` if `pCorpse->bCountAsCorpse != 0`, and returns the allocated `D2CorpseStrc*`.
 */
export function INVENTORY_AllocCorpse113c(
  m: Memory113c,
  pInventory: number,
  dwUnitId: number,
  eClass: number,
  bCountAsCorpse: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.get(inv, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) {
    return 0
  }
  m.u32((inv + 0x04) >>> 0)
  const pLast = m.get(inv, D2InventoryStrc.pLastCorpse)
  const pCorpse = m.alloc(0x10) >>> 0
  m.set(pCorpse, D2CorpseStrc.bCountAsCorpse, bCountAsCorpse >>> 0)
  m.set(pCorpse, D2CorpseStrc.dwUnitId, dwUnitId >>> 0)
  m.set(pCorpse, D2CorpseStrc.eClass, eClass >>> 0)
  m.set(pCorpse, D2CorpseStrc.pNextCorpse, 0)
  const pFirst = m.get(inv, D2InventoryStrc.pFirstCorpse)
  m.set(inv, D2InventoryStrc.pLastCorpse, pCorpse)
  if (pFirst === 0) {
    m.set(inv, D2InventoryStrc.pFirstCorpse, pCorpse)
  } else {
    m.set(pLast, D2CorpseStrc.pNextCorpse, pCorpse)
  }
  if (m.get(pCorpse, D2CorpseStrc.bCountAsCorpse) !== 0) {
    m.set(
      inv,
      D2InventoryStrc.nCorpseCount,
      (m.get(inv, D2InventoryStrc.nCorpseCount) + 1) >>> 0,
    )
  }
  return pCorpse
}

/**
 * `@va D2Common:0x6FD6DF20` (`D2Common.#10652` `INVENTORY_FreeAllNodes`,
 * stdcall `[esp+4] = pInventory`, `ret 4`, void).
 *
 * If `pInventory != 0 && dwSignature == 0x01020304`, walks `pFirstNode` (`+0x2C`) via `pNode->pNext` (`+0x04`,
 * `0x6FD6DF3F mov esi, [edx+4]`), frees each node via `Fog.#10046`, and zeroes `pFirstNode (+0x2C)` and `pLastNode (+0x30)`.
 */
export function INVENTORY_FreeAllNodes113c(m: Memory113c, pInventory: number): void {
  const inv = pInventory >>> 0
  if (inv === 0) return
  if (m.get(inv, D2InventoryStrc.dwSignature) !== INVENTORY_SIGNATURE_113C) return
  let pNode = m.get(inv, D2InventoryStrc.pFirstNode)
  while (pNode !== 0) {
    m.u32((inv + 0x04) >>> 0)
    const pNext = m.get(pNode, D2InventoryNodeStrc.pNext)
    pNode = pNext
  }
  m.set(inv, D2InventoryStrc.pFirstNode, 0)
  m.set(inv, D2InventoryStrc.pLastNode, 0)
}

/**
 * `@va D2Common:0x6FD6E420` (internal LTCG `INVENTORY_GetItemSaveGridPageLimits`,
 * custom reg `eax = pItem`, `ecx = pOutPageLimits6`, `ret`, void).
 *
 * If `pItem == 0`, zeroes 6 bytes at `pOutPageLimits6` (`u32 +0x00 = 0`, `u16 +0x04 = 0`) and returns.
 * Otherwise looks up `pItemsTxt[pItem->dwClassId]` (asserting `dwClassId < nItemsTxtRecordCount` at `line 0x121F`
 * and `pItemsTxt != 0` at `line 0x1EF`) and copies the 6 page-limit bytes `pRec + 0x116 .. pRec + 0x11B` into
 * `pOutPageLimits6[0..5]`.
 */
export function INVENTORY_GetItemSaveGridPageLimits113c(
  m: Memory113c,
  pItem: number,
  pOutPageLimits6: number,
): void {
  const item = pItem >>> 0
  const out = pOutPageLimits6 >>> 0
  if (item === 0) {
    m.setU32(out, 0)
    m.setU16((out + 4) >>> 0, 0)
    return
  }
  const dwClassId = m.get(item, D2UnitStrc.dwClassId) >>> 0
  if (dwClassId >= (m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C) >>> 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\INVENTORY\\Inventory.cpp', 0x121f)
  }
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) >>> 0
  if (base === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\ItemTbls.cpp', 0x1ef)
  }
  const pRec = (base + imul32(dwClassId | 0, ITEMS_TXT_STRIDE_113C)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\INVENTORY\\Inventory.cpp', 0x121f)
  }
  m.setU8(out, m.u8((pRec + 0x116) >>> 0))
  m.setU8((out + 1) >>> 0, m.u8((pRec + 0x117) >>> 0))
  m.setU8((out + 2) >>> 0, m.u8((pRec + 0x118) >>> 0))
  m.setU8((out + 3) >>> 0, m.u8((pRec + 0x119) >>> 0))
  m.setU8((out + 4) >>> 0, m.u8((pRec + 0x11a) >>> 0))
  m.setU8((out + 5) >>> 0, m.u8((pRec + 0x11b) >>> 0))
}

/**
 * `@va D2Common:0x6FD6E710` (`D2Common.#10523` `INVENTORY_AllocInventory`,
 * stdcall `[esp+4] = pMemPool`, `[esp+8] = pOwnerUnit`, `ret 8` -> `D2InventoryStrc*`).
 *
 * Resolves `pMemPool` (falling back to `pOwnerUnit->pMemPool (+0x08)` if `pMemPool == 0 && pOwnerUnit != 0`),
 * allocates a 64-byte (`0x40`) `D2InventoryStrc` via `Fog.#10045`, zeroes all 16 dwords, sets `dwSignature = 0x01020304`,
 * `pMemPool (+0x04)`, `pOwner (+0x08)`, and if `pOwnerUnit != 0` links `pOwnerUnit->pInventory (+0x60) = pInv`
 * and `pInv->dwLeftItemGuid (+0x24) = pOwnerUnit->dwUnitId (+0x0C)`.
 */
export function INVENTORY_AllocInventory113c(
  m: Memory113c,
  pMemPool: number,
  pOwnerUnit: number,
): number {
  let ebx = pMemPool >>> 0
  const esi = pOwnerUnit >>> 0
  if (ebx === 0 && esi !== 0) {
    ebx = m.get(esi, D2UnitStrc.pMemPool)
  }
  const pInv = m.alloc(0x40) >>> 0
  if (pInv === 0) {
    return 0
  }
  for (let i = 0; i < 0x40; i += 4) {
    m.setU32((pInv + i) >>> 0, 0)
  }
  m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
  m.setU32((pInv + 0x04) >>> 0, ebx)
  m.setU32((pInv + 0x08) >>> 0, esi)
  if (esi !== 0) {
    m.set(esi, D2UnitStrc.pInventory, pInv)
    m.set(pInv, D2InventoryStrc.dwLeftItemGuid, m.get(esi, D2UnitStrc.dwUnitId))
  }
  return pInv
}

/**
 * `@va D2Common:0x6FD72000` (internal `ITEMS_DecodeItemCompactBitstream`,
 * stdcall `[esp+4] = pBitstreamData`, `[esp+8] = nDataSize`, `[esp+0xC] = bCheckHeader`,
 * `[esp+0x10] = pOutHeader`, `[esp+0x14] = nVersion`, `ret 0x14` -> `BOOL`).
 *
 * Initializes a local `D2BitBufferStrc` (`Fog.#10126`), optionally checks the 16-bit `'JM'` (`0x4D4A`) magic via
 * `Fog.#10129`, unpacks `dwItemFlags (+0x0C)`, discards 10-bit format, unpacks 3-bit `nItemMode (+0x08)`, unpacks
 * either 16-bit `nPosX (+0x04)` / `nPosY (+0x06)` (when `mode == 3 || mode == 5`) or `nBodyLoc (+0x11)`, `nGridX (+0x04)`,
 * `nGridY (+0x06)`, `nInvPage (+0x10)`, resolves the 4-byte item code (or `'ear '` when `edi & 0x10000`, remapping `'nec '` -> `'neg '`
 * when `nVersion <= 0x5C`) via `Fog.#10213(m.u32(0x6FDEFF6C), dwCode, 0)` into `nClassId (+0x00)`, and unpacks
 * `nGemSockets (+0x14)` (`0` when `edi & 0x02200000`, else 3 bits).
 */
export function ITEMS_DecodeItemCompactBitstream113c(
  m: Memory113c,
  pBitstreamData: number,
  nDataSize: number,
  bCheckHeader: number,
  pOutHeader: number,
  nVersion: number,
): number {
  const out = pOutHeader >>> 0
  const bitBuf: FogBitBufferState113c = {
    pBuffer: pBitstreamData >>> 0,
    nBits: imul32(nDataSize | 0, 8),
    nPos: 0,
    nPosBits: 0,
    bFull: 0,
  }

  if ((bCheckHeader | 0) !== 0) {
    const hdr = fogBitManipReadSigned113c(m, bitBuf, 16)
    if (hdr !== 0x4d4a) {
      return 0
    }
  }

  const edi = fogBitManipReadUnsigned113c(m, bitBuf, 32)
  m.setU32((out + 0x0c) >>> 0, edi)
  fogBitManipReadUnsigned113c(m, bitBuf, 10)

  const mode = fogBitManipReadUnsigned113c(m, bitBuf, 3) & 0xff
  m.setU8((out + 0x08) >>> 0, mode)

  const al = m.u8((out + 0x08) >>> 0)
  if (al === 3 || al === 5) {
    const posX = fogBitManipReadUnsigned113c(m, bitBuf, 16) & 0xffff
    m.setU16((out + 0x04) >>> 0, posX)
    const posY = fogBitManipReadUnsigned113c(m, bitBuf, 16) & 0xffff
    m.setU16((out + 0x06) >>> 0, posY)
  } else {
    const bodyLoc = fogBitManipReadUnsigned113c(m, bitBuf, 4) & 0xff
    m.setU8((out + 0x11) >>> 0, bodyLoc)
    const gridX = fogBitManipReadUnsigned113c(m, bitBuf, 4) & 0xffff
    m.setU16((out + 0x04) >>> 0, gridX)
    const gridY = fogBitManipReadUnsigned113c(m, bitBuf, 4) & 0xffff
    m.setU16((out + 0x06) >>> 0, gridY)
    const invPage = (fogBitManipReadUnsigned113c(m, bitBuf, 3) - 1) & 0xff
    m.setU8((out + 0x10) >>> 0, invPage)
  }

  let dwCode = 0x20726165
  if ((edi & 0x00010000) === 0) {
    dwCode = fogBitManipReadUnsigned113c(m, bitBuf, 32) >>> 0
    if ((nVersion | 0) <= 0x5c && dwCode === 0x2063656e) {
      dwCode = 0x2067656e
    }
  }

  const pLinker = m.u32(D2COMMON_ITEMS_CODE_LINK_VA_113C)
  const linkIdx = fogGetLinkIndex113c(m, pLinker, dwCode) >>> 0
  m.setU32((out + 0x00) >>> 0, linkIdx)

  if ((edi & 0x02200000) !== 0) {
    m.setU32((out + 0x14) >>> 0, 0)
    return 1
  }

  const nSockets = fogBitManipReadUnsigned113c(m, bitBuf, 3) >>> 0
  m.setU32((out + 0x14) >>> 0, nSockets)
  return 1
}

/**
 * `@va D2Common:0x6FD72170` (`D2Common.#10075` `ITEMS_SetItemFormat`,
 * stdcall `[esp+4] = pItem`, `[esp+8] = wFormat`, `ret 8`, void).
 *
 * Asserts `pItem != 0` (`line 0x1510`), `pItem->dwUnitType == 4` (`line 0x1511`), and `pItemData != 0` (`line 0x1513`),
 * then writes `pItemData->wItemFormat (+0x30) = wFormat & 0xFFFF`.
 */
export function ITEMS_SetItemFormat113c(m: Memory113c, pItem: number, wFormat: number): void {
  const item = pItem >>> 0
  if (item === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x1510)
  }
  if (m.get(item, D2UnitStrc.dwUnitType) !== UNIT_ITEM) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x1511)
  }
  const pItemData = m.get(item, D2UnitStrc.pUnitData)
  if (pItemData === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x1513)
  }
  m.setU16((pItemData + 0x30) >>> 0, wFormat & 0xffff)
}

/**
 * `@va D2Common:0x6FD72310` (`D2Common.#10906` `ITEMS_CanPlayerClassUseItem`,
 * stdcall `[esp+4] = pPlayer`, `[esp+8] = pItem`, `ret 8` -> `BOOL`).
 *
 * Asserts `pItem != 0` (`line 0x119C`) and `pPlayer != 0` (`line 0x119E`). If `pPlayer->dwUnitType != 0`
 * or `pPlayer->dwClassId != 4` (`PLAYERCLASS_BARBARIAN`), returns `0`. Otherwise resolves `pItemsTxt` via
 * `DATATBLS_GetItemsTxtRecord` (`0x6FDC19A0`, asserting `pRec != 0` at `line 0x11A6`) and returns
 * `m.u8(pRec + 0x13D) != 0 ? 1 : 0`.
 */
export function ITEMS_CanPlayerClassUseItem113c(
  m: Memory113c,
  pPlayer: number,
  pItem: number,
): number {
  const item = pItem >>> 0
  if (item === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x119c)
  }
  const player = pPlayer >>> 0
  if (player === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x119e)
  }
  if (m.get(player, D2UnitStrc.dwUnitType) !== 0) {
    return 0
  }
  if (m.get(player, D2UnitStrc.dwClassId) !== 4) {
    return 0
  }
  const classId = m.get(item, D2UnitStrc.dwClassId) >>> 0
  if (classId >= (m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C) >>> 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x11a6)
  }
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) >>> 0
  if (base === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\ItemTbls.cpp', 0x1ef)
  }
  const pRec = (base + imul32(classId | 0, ITEMS_TXT_STRIDE_113C)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x11a6)
  }
  return m.u8((pRec + 0x13d) >>> 0) !== 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD72430` (`D2Common.#10633` `ITEMS_GetWeaponClassCodeIdx`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `AX` `u16`).
 *
 * Resolves `dwClassId = pItem != 0 ? pItem->dwClassId : -1`, looks up `pItemsTxt[dwClassId]`
 * (asserting `dwClassId < nItemsTxtRecordCount` at `line 0x1146` and `pItemsTxt != 0` at `line 0x1EF`),
 * reads `dwWeapClass = m.u32(pRec + 0xC0)`, and scans `sgptDataTables_WeapClassTable` (`0x6FDEF028`,
 * count at `0x6FDEF020`) returning the matching `u16` index at `0x6FDEF02C + i * 8` (or `0` if not found).
 */
export function ITEMS_GetWeaponClassCodeIdx113c(m: Memory113c, pItem: number): number {
  const item = pItem >>> 0
  const dwClassId = item !== 0 ? m.get(item, D2UnitStrc.dwClassId) >>> 0 : 0xffffffff
  if (dwClassId >= (m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C) >>> 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x1146)
  }
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) >>> 0
  if (base === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\ItemTbls.cpp', 0x1ef)
  }
  const pRec = (base + imul32(dwClassId | 0, ITEMS_TXT_STRIDE_113C)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x1146)
  }
  const count = m.u32(D2COMMON_WEAP_CLASS_COUNT_VA_113C) >>> 0
  if (count === 0) return 0
  const dwWeapClass = m.u32((pRec + 0xc0) >>> 0) >>> 0
  for (let ecx = 0; ecx < count; ecx++) {
    const entryAddr = (D2COMMON_WEAP_CLASS_TABLE_VA_113C + ecx * 8) >>> 0
    if (m.u32(entryAddr) === dwWeapClass) {
      return m.u16((entryAddr + 4) >>> 0)
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD724C0` (`D2Common.#10815` `ITEMS_GetCellOverwrite`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `pItemData->dwItemFlags2 (+0x0C)`).
 *
 * Asserts `pItem != 0` (`line 0x10C8`), `pItem->dwUnitType == 4` (`line 0x10C9`), and `pItemData != 0` (`line 0x10CB`),
 * then returns `m.u32(pItemData + 0x0C)`.
 */
export function ITEMS_GetCellOverwrite113c(m: Memory113c, pItem: number): number {
  const item = pItem >>> 0
  if (item === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x10c8)
  }
  if (m.get(item, D2UnitStrc.dwUnitType) !== UNIT_ITEM) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x10c9)
  }
  const pItemData = m.get(item, D2UnitStrc.pUnitData)
  if (pItemData === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x10cb)
  }
  return m.u32((pItemData + 0x0c) >>> 0)
}

/**
 * `@va D2Common:0x6FD72510` (`D2Common.#10485` `ITEMS_SetCellOverwrite`,
 * stdcall `[esp+4] = pItem`, `[esp+8] = nCell`, `ret 8`, void).
 *
 * Asserts `pItem != 0` (`line 0x10BD`), `pItem->dwUnitType == 4` (`line 0x10BE`), and `pItemData != 0` (`line 0x10C0`),
 * then writes `m.setU32(pItemData + 0x0C, nCell)`.
 */
export function ITEMS_SetCellOverwrite113c(m: Memory113c, pItem: number, nCell: number): void {
  const item = pItem >>> 0
  if (item === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x10bd)
  }
  if (m.get(item, D2UnitStrc.dwUnitType) !== UNIT_ITEM) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x10be)
  }
  const pItemData = m.get(item, D2UnitStrc.pUnitData)
  if (pItemData === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x10c0)
  }
  m.setU32((pItemData + 0x0c) >>> 0, nCell >>> 0)
}

/**
 * `@va D2Common:0x6FD72760` (`D2Common.#10751` `ITEMS_CheckItemFlagCompactSaveByClassId`,
 * stdcall `[esp+4] = nItemId`, `ret 4` -> `(m.u32(pRec + 0xDC) & 0x2) >>> 0`).
 *
 * Looks up `pItemsTxt[nItemId]` (asserting `(nItemId >>> 0) < nItemsTxtRecordCount` at `line 0x104B`
 * and `pItemsTxt != 0` at `line 0x1EF`) and returns `(m.u32(pRec + 0xDC) & 0x2) >>> 0`.
 */
export function ITEMS_CheckItemFlagCompactSaveByClassId113c(
  m: Memory113c,
  nItemId: number,
): number {
  const id = nItemId >>> 0
  if (id >= (m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C) >>> 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x104b)
  }
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) >>> 0
  if (base === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\ItemTbls.cpp', 0x1ef)
  }
  const pRec = (base + imul32(id | 0, ITEMS_TXT_STRIDE_113C)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x104b)
  }
  return (m.u32((pRec + 0xdc) >>> 0) & 0x2) >>> 0
}

/**
 * `@va D2Common:0x6FD72E70` (`D2Common.#10599` `ITEMS_GetInvWidthFromId`,
 * stdcall `[esp+4] = nItemId`, `ret 4` -> `m.u8(pRec + 0x11C)`).
 *
 * Looks up `pItemsTxt[nItemId]` (asserting `(nItemId >>> 0) < nItemsTxtRecordCount` at `line 0x907`
 * and `pItemsTxt != 0` at `line 0x1EF`) and returns `m.u8(pRec + 0x11C)`.
 */
export function ITEMS_GetInvWidthFromId113c(m: Memory113c, nItemId: number): number {
  const id = nItemId >>> 0
  if (id >= (m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C) >>> 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x907)
  }
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) >>> 0
  if (base === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\ItemTbls.cpp', 0x1ef)
  }
  const pRec = (base + imul32(id | 0, ITEMS_TXT_STRIDE_113C)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x907)
  }
  return m.u8((pRec + 0x11c) >>> 0)
}

/**
 * `@va D2Common:0x6FD731E0` (`D2Common.#10505` `ITEMS_GetComponentFromItem`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `AL` `m.u8(pRec + 0x115)`).
 *
 * Asserts `pItem != 0` (`line 0x635`) and `pItem->dwUnitType == 4` (`line 0x636`), resolves `pItemsTxt`
 * via `DATATBLS_GetItemsTxtRecord` (`0x6FDC19A0`, asserting `pRec != 0` at `line 0x639`), and returns
 * `m.u8(pRec + 0x115)`.
 */
export function ITEMS_GetComponentFromItem113c(m: Memory113c, pItem: number): number {
  const item = pItem >>> 0
  if (item === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x635)
  }
  if (m.get(item, D2UnitStrc.dwUnitType) !== UNIT_ITEM) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x636)
  }
  const classId = m.get(item, D2UnitStrc.dwClassId) >>> 0
  if (classId >= (m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C) >>> 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x639)
  }
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) >>> 0
  if (base === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\ItemTbls.cpp', 0x1ef)
  }
  const pRec = (base + imul32(classId | 0, ITEMS_TXT_STRIDE_113C)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ITEMS\\Items.cpp', 0x639)
  }
  return m.u8((pRec + 0x115) >>> 0)
}

/**
 * `@va D2Common:0x6FD7F270` (`D2Common.#11124` `UNITS_SetStaticPathPosY`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nPosY`, `ret 8`, void).
 *
 * Asserts `pUnit != 0` (`line 0x706`) and `dwUnitType == 2 || (dwUnitType > 3 && dwUnitType <= 5)` (`line 0x711`),
 * then writes `pUnit->pPath->nPosY (+0x10) = nPosY`.
 */
export function UNITS_SetStaticPathPosY113c(m: Memory113c, pUnit: number, nPosY: number): void {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0x706)
  }
  const unitType = m.get(u, D2UnitStrc.dwUnitType) | 0
  if (unitType !== 2 && (unitType <= 3 || unitType > 5)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0x711)
  }
  const pPath = m.get(u, D2UnitStrc.pPath)
  m.set(pPath, D2StaticPathStrc.nPosY, nPosY >>> 0)
}

/**
 * `@va D2Common:0x6FD7F2C0` (`D2Common.#10500` `UNITS_SetStaticPathPosX`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nPosX`, `ret 8`, void).
 *
 * Asserts `pUnit != 0` (`line 0x6EF`) and `dwUnitType == 2 || (dwUnitType > 3 && dwUnitType <= 5)` (`line 0x6FA`),
 * then writes `pUnit->pPath->nPosX (+0x0C) = nPosX`.
 */
export function UNITS_SetStaticPathPosX113c(m: Memory113c, pUnit: number, nPosX: number): void {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0x6ef)
  }
  const unitType = m.get(u, D2UnitStrc.dwUnitType) | 0
  if (unitType !== 2 && (unitType <= 3 || unitType > 5)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0x6fa)
  }
  const pPath = m.get(u, D2UnitStrc.pPath)
  m.set(pPath, D2StaticPathStrc.nPosX, nPosX >>> 0)
}

/**
 * `@va D2Common:0x6FD7F8A0` (`D2Common.#10817` `UNITS_GetBeltTypeFromItem`,
 * stdcall `[esp+4] = pItem`, `ret 4` -> `m.u8(pRec + 0x130)`).
 *
 * Asserts `pItem != 0 && pItem->dwUnitType == 4` (`line 0xF20`), looks up `pItemsTxt[pItem->dwClassId]`
 * (asserting `dwClassId < nItemsTxtRecordCount` at `line 0xF24` and `pItemsTxt != 0` at `line 0x1EF`),
 * and returns `m.u8(pRec + 0x130)`.
 */
export function UNITS_GetBeltTypeFromItem113c(m: Memory113c, pItem: number): number {
  const item = pItem >>> 0
  if (item === 0 || m.get(item, D2UnitStrc.dwUnitType) !== UNIT_ITEM) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0xf20)
  }
  const classId = m.get(item, D2UnitStrc.dwClassId) >>> 0
  if (classId >= (m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C) >>> 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0xf24)
  }
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C) >>> 0
  if (base === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\ItemTbls.cpp', 0x1ef)
  }
  const pRec = (base + imul32(classId | 0, ITEMS_TXT_STRIDE_113C)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0xf24)
  }
  return m.u8((pRec + 0x130) >>> 0)
}

/**
 * `@va D2Common:0x6FD7FB60` (`D2Common.#10402` `UNITS_GetInventoryRecordId`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nInvPage`, `[esp+0xC] = bLoD`, `ret 0xC` -> `nInvRecordId`).
 *
 * Asserts `pUnit != 0` (`line 0xA2F` / `2607`), then dispatches on `pUnit->dwUnitType`:
 * - `0` (`UNIT_PLAYER`): switches on `nInvPage & 0xFF` (`1 -> 6`, `2 -> 7`, `3 -> 9`, `4 -> bLoD ? 12 : 8`,
 *   default scans `sgptCharInvRecTable` at `0x6FDEEFE8` with count at `0x6FDEEFE4` for `pUnit->dwClassId`).
 * - `1` (`UNIT_MONSTER`): returns `5`.
 * - `2` (`UNIT_OBJECT`): returns `10` for `dwClassId == 0x152`, `11` for `dwClassId == 0x153`, else `-1`.
 * - Otherwise returns `-1` (`0xFFFFFFFF`).
 */
export function UNITS_GetInventoryRecordId113c(
  m: Memory113c,
  pUnit: number,
  nInvPage: number,
  bLoD: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\UNITS\\Units.cpp', 0xa2f)
  }
  const dwUnitType = m.get(u, D2UnitStrc.dwUnitType) >>> 0
  if (dwUnitType === 0) {
    switch (nInvPage & 0xff) {
      case 1:
        return 6
      case 2:
        return 7
      case 3:
        return 9
      case 4:
        return (bLoD | 0) !== 0 ? 12 : 8
      default: {
        const count = m.u32(D2COMMON_CHAR_INV_REC_COUNT_VA_113C) | 0
        if (count <= 0) return 0xffffffff
        const dwClassId = m.get(u, D2UnitStrc.dwClassId) >>> 0
        for (let ecx = 0; ecx < count; ecx++) {
          if (m.u32((D2COMMON_CHAR_INV_REC_TABLE_VA_113C + ecx * 8) >>> 0) === dwClassId) {
            return m.u32((D2COMMON_CHAR_INV_REC_TABLE_VA_113C + 4 + ecx * 8) >>> 0) >>> 0
          }
        }
        return 0xffffffff
      }
    }
  }
  if (dwUnitType === 1) {
    return 5
  }
  if (dwUnitType === 2) {
    const dwClassId = m.get(u, D2UnitStrc.dwClassId) >>> 0
    if (dwClassId === 0x152) return 10
    if (dwClassId === 0x153) return 11
    return 0xffffffff
  }
  return 0xffffffff
}

/**
 * `@va D2Common:0x6FD93710` (`D2Common.#10698` `COMPOSIT_GetItemPageLimitByBodyLoc`,
 * stdcall `[esp+4] = nBodyLoc`, `[esp+8] = pPageLimits6`, `ret 8` -> `u8` page limit).
 *
 * Asserts `nBodyLoc < 0x10` (`line 0x265` / `613`), switches on `(nBodyLoc - 1) >>> 0`
 * (`0 -> [ptr+2]`, `1 -> [ptr+3]`, `2 -> [ptr+0]`, `3 -> [ptr+1]`, `7 -> [ptr+4]`, `8 -> [ptr+5]`),
 * and asserts at `line 0x274` (`628`) on any other `nBodyLoc`.
 */
export function COMPOSIT_GetItemPageLimitByBodyLoc113c(
  m: Memory113c,
  nBodyLoc: number,
  pPageLimits6: number,
): number {
  if ((nBodyLoc | 0) >= 0x10) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\COMPOSIT\\Composit.cpp', 0x265)
  }
  const ptr = pPageLimits6 >>> 0
  switch (((nBodyLoc | 0) - 1) >>> 0) {
    case 0:
      return m.u8((ptr + 2) >>> 0)
    case 1:
      return m.u8((ptr + 3) >>> 0)
    case 2:
      return m.u8(ptr)
    case 3:
      return m.u8((ptr + 1) >>> 0)
    case 7:
      return m.u8((ptr + 4) >>> 0)
    case 8:
      return m.u8((ptr + 5) >>> 0)
    default:
      throw new D2CommonAssertError('..\\Source\\D2Common\\COMPOSIT\\Composit.cpp', 0x274)
  }
}

export const D2COMMON_GRID0_INFO_VA_113C = 0x6fded378
const D2COMMON_GRID1_INFO_VA_113C = 0x6fded390

/**
 * Memory port of `D2Common 0x6FD6E1B0` (`INVENTORY_GetOrInitGrid`, usercall `ebx = pInventory`,
 * `eax = gridIdx`, `[esp+4] = pGridDef`, `ret 4`). No signature check (callers do it).
 * - `nGridCount (+0x18) <= gridIdx` (0x6FD6E1B8 `jle`): returns `0` without a def; otherwise Fog-reallocs
 *   `pGrids (+0x14)` to `(gridIdx << 4) + 0x10` bytes (0x6FD6E275), zeroes the new tail (0x6FD6E296),
 *   sets `nGridCount = gridIdx + 1`, copies `bGridX/bGridY` from the def and Fog-allocs a zeroed
 *   `ppItems` of `bGridX * bGridY * 4` bytes (0x6FD6E2D2); returns the grid (0x6FD6E2FA).
 * - Otherwise without a def returns the grid iff `ppItems != 0` (0x6FD6E1D2); with a def lazily
 *   allocates `ppItems` (0x6FD6E1E6..0x6FD6E234) and returns the grid iff its dims equal the def's
 *   (0x6FD6E236..0x6FD6E244).
 */
export function INVENTORY_GetOrInitGridMem113c(
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
    const pOld = m.u32((inv + 0x14) >>> 0)
    const pNew = m.alloc(((idx << 4) + 0x10) >>> 0)
    for (let i = 0; i < nGridCount * 16; i++) {
      m.setU8((pNew + i) >>> 0, m.u8((pOld + i) >>> 0))
    }
    m.setU32((inv + 0x14) >>> 0, pNew)
    m.fill((pNew + (nGridCount << 4)) >>> 0, (((idx - nGridCount + 1) << 4) >>> 0), 0)
    m.setU32((inv + 0x18) >>> 0, (idx + 1) >>> 0)
    const pGrid = (m.u32((inv + 0x14) >>> 0) + (idx << 4)) >>> 0
    const gx = m.u8(def)
    m.setU8((pGrid + 8) >>> 0, gx)
    const gy = m.u8((def + 1) >>> 0)
    m.setU8((pGrid + 9) >>> 0, gy)
    const pItems = m.alloc(imul32(gx, gy) * 4)
    m.setU32((pGrid + 0x0c) >>> 0, pItems)
    return pGrid
  }
  const pGrid = (m.u32((inv + 0x14) >>> 0) + (idx << 4)) >>> 0
  const ppItems = m.u32((pGrid + 0x0c) >>> 0)
  if (def === 0) return ppItems !== 0 ? pGrid : 0
  if (ppItems === 0) {
    m.setU8((pGrid + 8) >>> 0, m.u8(def))
    const gy = m.u8((def + 1) >>> 0)
    m.setU8((pGrid + 9) >>> 0, gy)
    const pItems = m.alloc(imul32(m.u8((pGrid + 8) >>> 0), gy) * 4)
    m.setU32((pGrid + 0x0c) >>> 0, pItems)
  }
  if (m.u8((pGrid + 8) >>> 0) !== m.u8(def)) return 0
  if (m.u8((pGrid + 9) >>> 0) !== m.u8((def + 1) >>> 0)) return 0
  return pGrid
}

/**
 * `@va D2Common:0x6FDC19A0` (`DATATBLS_GetItemsTxtRecord`): `nItemId >= count`
 * (unsigned `jb`) -> `0` (no assert); null table -> assert `0x1EF` (0x6FDC19BB).
 */
export function getItemsTxtRecordInvMem113c(m: Memory113c, nItemId: number): number {
  const count = m.u32(D2COMMON_ITEMS_TXT_COUNT_VA_113C)
  if (nItemId >>> 0 >= count) return 0
  const base = m.u32(D2COMMON_ITEMS_TXT_PTR_VA_113C)
  // 0x6FDC19B7 `test ecx, ecx; jne` else `push 0x1ef` -> assert thunk 0x6FD5921C (no null return).
  if (base === 0) {
    throw new D2CommonAssertError('DataTbls.cpp', 0x1ef)
  }
  return (base + imul32(nItemId | 0, ITEMS_TXT_STRIDE_113C)) >>> 0
}

/**
 * Memory port of `D2Common 0x6FD73EF0` (`#11006` `ITEMS_CheckNotBrokenOrUnequipping`): `0` for a null
 * item, `1` for non-items, and for items `0` iff `pItemData != 0` and `dwFlags & 0x100` or `& 0x4000`.
 */
export function isItemNotBrokenInvMem113c(m: Memory113c, pItem: number): number {
  const u = pItem >>> 0
  if (u === 0) return 0
  if (m.u32(u) === UNIT_ITEM) {
    const pData = m.u32((u + 0x14) >>> 0)
    if (pData !== 0 && (m.u32((pData + 0x18) >>> 0) & 0x100) !== 0) return 0
    if (pData !== 0 && (m.u32((pData + 0x18) >>> 0) & 0x4000) !== 0) return 0
  }
  return 1
}

/**
 * Memory port of `D2Common 0x6FD74430` (`#10744` `ITEMS_CheckItemTypeId`, stdcall `(pItem, nItemType)`,
 * `ret 8`). No unit-type and no broken check:
 * - `pItem == 0` -> `0` (0x6FD74437); `nItemType < 0` or `>= nItemTypesTxtRecordCount (+0xBFC)` (signed) -> `0`.
 * - `wType[0]` via `0x6FD730A0` (`ITEMS_IsTome113c`: asserts `0x68E` for `classId >= count`, `0x1EF` for a
 *   null table); if the ItemTypes equivalence bit-matrix row (`+0xC00` dwords, base `+0xC04`) has the
 *   `nItemType` bit (`gdwBitMasks` at `0x6FDD90B0`) -> `1` (0x6FD74499).
 * - Otherwise re-looks the record up via `0x6FDC19A0` (null -> `0`), reads signed `wType[1] (+0x120)`;
 *   `<= 0` or `>= count` -> `0`; else returns the raw `row & mask` dword (0x6FD744F2, not normalised).
 */
function ITEMS_CheckItemTypeIdMem113c(m: Memory113c, pItem: number, nItemType: number): number {
  const itm = pItem >>> 0
  if (itm === 0) return 0
  const t = nItemType | 0
  if (t < 0) return 0
  if (t >= (m.u32((m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) + 0xbfc) >>> 0) | 0)) return 0
  const wType0 = ITEMS_IsTome113c(m, m.u32((itm + 4) >>> 0)) | 0
  const col = t >> 5
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const row0 = (imul32(m.u32((sgpt + 0xc00) >>> 0) | 0, wType0) + col) | 0
  const word0 = m.u32((m.u32((sgpt + 0xc04) >>> 0) + imul32(row0, 4)) >>> 0)
  const mask0 = m.u32((m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C) + (t & 0x1f) * 4) >>> 0)
  if ((word0 & mask0) !== 0) return 1
  const pTxt = getItemsTxtRecordInvMem113c(m, m.u32((itm + 4) >>> 0))
  if (pTxt === 0) return 0
  const wType1 = s16(m.u16((pTxt + 0x120) >>> 0))
  if (wType1 <= 0) return 0
  const sgpt1 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (wType1 >= (m.u32((sgpt1 + 0xbfc) >>> 0) | 0)) return 0
  const row1 = (imul32(m.u32((sgpt1 + 0xc00) >>> 0) | 0, wType1) + col) | 0
  const word1 = m.u32((m.u32((sgpt1 + 0xc04) >>> 0) + imul32(row1, 4)) >>> 0)
  const mask1 = m.u32((m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C) + (t & 0x1f) * 4) >>> 0)
  return (word1 & mask1) >>> 0
}
export { ITEMS_CheckItemTypeIdMem113c as checkItemTypeIdInvMem113c }

/**
 * Memory port of `D2Common 0x6FD70320` (`INVENTORY_GetCompositWeapon`, stdcall `(pInventory)`): `0` unless
 * the signature matches and `dwWeaponId (+0x1C) != -1`; then grid 0 slot 5 (`+0x14`) and slot 4 (`+0x10`)
 * are each returned if `ITEMS_CheckItemTypeId(pItem, 0x2D)` and `dwUnitId (+0x0C) == dwWeaponId`.
 */
export function INVENTORY_GetCompositWeaponMem113c(m: Memory113c, pInventory: number): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  if (m.u32((inv + 0x1c) >>> 0) === 0xffffffff) return 0
  const pGridA = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  if (pGridA !== 0) {
    const pItem = m.u32((m.u32((pGridA + 0x0c) >>> 0) + 0x14) >>> 0)
    if (
      pItem !== 0 &&
      ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x2d) !== 0 &&
      m.u32((pItem + 0x0c) >>> 0) === m.u32((inv + 0x1c) >>> 0)
    ) {
      return pItem
    }
  }
  if (m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pGridB = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  if (pGridB === 0) return 0
  const pItem = m.u32((m.u32((pGridB + 0x0c) >>> 0) + 0x10) >>> 0)
  if (
    pItem !== 0 &&
    ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x2d) !== 0 &&
    m.u32((pItem + 0x0c) >>> 0) === m.u32((inv + 0x1c) >>> 0)
  ) {
    return pItem
  }
  return 0
}

/**
 * Memory port of `D2Common 0x6FD70700` (`#10101` `INVENTORY_GetActiveWeapon`), returning the item written to
 * `*ppItem` when the function returns `1` (else `0`). Calls `0x6FD70320` first (0x6FD7071E; only feeds the
 * third out-param but can lazily allocate grid 0), then tries grid 0 slot 4 (`+0x10`) with the inline
 * not-broken test (0x6FD7074B..0x6FD70777) and `0x6FD74430(pItem, 0x2D)`, then slot 5 (`+0x14`, `0` without a
 * signature/grid) with `0x6FD73EF0` and `0x6FD74430(pItem, 0x2D)`.
 */
export function INVENTORY_GetActiveWeaponMem113c(m: Memory113c, pInventory: number): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  INVENTORY_GetCompositWeaponMem113c(m, inv)
  if (m.u32(inv) === INVENTORY_SIGNATURE_113C) {
    const pGridA = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
    if (pGridA !== 0) {
      const pRight = m.u32((m.u32((pGridA + 0x0c) >>> 0) + 0x10) >>> 0)
      if (
        pRight !== 0 &&
        isItemNotBrokenInvMem113c(m, pRight) !== 0 &&
        ITEMS_CheckItemTypeIdMem113c(m, pRight, 0x2d) !== 0
      ) {
        return pRight
      }
    }
  }
  let pLeft = 0
  if (m.u32(inv) === INVENTORY_SIGNATURE_113C) {
    const pGridB = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
    if (pGridB !== 0) pLeft = m.u32((m.u32((pGridB + 0x0c) >>> 0) + 0x14) >>> 0)
  }
  if (isItemNotBrokenInvMem113c(m, pLeft) !== 0 && ITEMS_CheckItemTypeIdMem113c(m, pLeft, 0x2d) !== 0) {
    return pLeft
  }
  return 0
}

/**
 * `@va D2Common:0x6FD6E5B0` (`D2Common.#10455` `INVENTORY_GetBeltItem`, 65 bytes,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = nBeltSlot`, `ret 0x8` -> `D2UnitStrc*` or `0`).
 */
export function INVENTORY_GetBeltItem113c(
  m: Memory113c,
  pInventory: number,
  nBeltSlot: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pGrid1 = INVENTORY_GetOrInitGridMem113c(m, inv, 1, D2COMMON_GRID1_INFO_VA_113C)
  const slot = nBeltSlot | 0
  if (pGrid1 === 0 || slot < 0 || slot >= 16) return 0
  const ppItems = m.u32((pGrid1 + 0x0c) >>> 0)
  return m.u32((ppItems + slot * 4) >>> 0) >>> 0
}

/**
 * `@va D2Common:0x6FD6E600` (`D2Common.#10036` `INVENTORY_GetItemGridXIfInInventory`, 42 bytes,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 0x8` -> grid X or `0`).
 */
export function INVENTORY_GetItemGridXIfInInventory113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): number {
  const inv = pInventory >>> 0
  const itm = pItem >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  return UNITS_GetX113c(m, itm) >>> 0
}

/**
 * `@va D2Common:0x6FD6E630` (`D2Common.#10475` `INVENTORY_GetItemBodyLocFromX`, 53 bytes,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 0x8` -> body loc `0..10` or `0`).
 */
export function INVENTORY_GetItemBodyLocFromX113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): number {
  const inv = pInventory >>> 0
  const itm = pItem >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  const x = UNITS_GetX113c(m, itm) | 0
  return x >= 11 ? 0 : x >>> 0
}

/**
 * `@va D2Common:0x6FD6F720` (`INVENTORY_RemoveItemFromGrid`, 455 bytes,
 * custom LTCG `edx = pItem`, `[esp+4] = pGrid`, `[esp+8] = bUseItemDimensions`, `ret 0x8`, void).
 */
export function INVENTORY_RemoveItemFromGrid113c(
  m: Memory113c,
  pItem: number,
  pGrid: number,
  bUseItemDimensions: number,
): void {
  const itm = pItem >>> 0
  const grid = pGrid >>> 0
  const pExtra = itemExtraOrZero(m, itm, true)
  if (pExtra === 0) return

  const pPrev = m.u32((pExtra + 0x10) >>> 0)
  const pNext = m.u32((pExtra + 0x14) >>> 0)
  if (pPrev === 0) {
    if (m.u32(grid) === itm) {
      m.setU32(grid, pNext)
    }
  } else {
    const pPrevExtra = itemExtraOrZero(m, pPrev, true)
    if (pPrevExtra !== 0) {
      m.setU32((pPrevExtra + 0x14) >>> 0, pNext)
    }
  }
  if (pNext === 0) {
    if (m.u32((grid + 4) >>> 0) === itm) {
      m.setU32((grid + 4) >>> 0, pPrev)
    }
  } else {
    const pNextExtra = itemExtraOrZero(m, pNext, true)
    if (pNextExtra !== 0) {
      m.setU32((pNextExtra + 0x10) >>> 0, pPrev)
    }
  }

  const ppItems = m.u32((grid + 0x0c) >>> 0)
  if (ppItems !== 0) {
    const x = UNITS_GetX113c(m, itm) | 0
    const y = UNITS_GetY113c(m, itm) | 0
    const gridW = m.u8((grid + 8) >>> 0)
    if ((bUseItemDimensions | 0) !== 0) {
      // 0x6FD6F82D `mov al, [esp+0x18]` / 0x6FD6F831 `mov cl, [esp+0x18]`: 5 pushes deep this slot is
      // arg1 (`pGrid`; 0x6FD6F85F reloads `edi = [esp+0x18]` as the grid), so a NULL ItemsTxt record
      // (classId >= count, no assert in 0x6FDC19A0) falls back to `pGrid & 0xff` for width and height.
      let w = grid & 0xff
      let h = grid & 0xff
      const pTxt = getItemsTxtRecordInvMem113c(m, m.u32((itm + 4) >>> 0))
      if (pTxt !== 0) {
        w = m.u8((pTxt + 0x10f) >>> 0)
        h = m.u8((pTxt + 0x110) >>> 0)
      }
      for (let r = y; r < y + h; r++) {
        for (let c = x; c < x + w; c++) {
          m.setU32((ppItems + (imul32(r, gridW) + c) * 4) >>> 0, 0)
        }
      }
    } else {
      m.setU32((ppItems + (imul32(y, gridW) + x) * 4) >>> 0, 0)
    }
  }

  m.setU32((pExtra + 0x14) >>> 0, 0)
  m.setU32((pExtra + 0x10) >>> 0, 0)
  m.setU8((pExtra + 0x0c) >>> 0, 0)
}

/**
 * `@va D2Common:0x6FD6FF40` (`D2Common.#10854` `INVENTORY_GetEquippedShield`, 208 bytes,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = ppOutItem`, `ret 0x8` -> `1` or `0`).
 */
export function INVENTORY_GetEquippedShield113c(
  m: Memory113c,
  pInventory: number,
  ppOutItem: number,
): number {
  const inv = pInventory >>> 0
  const ppOut = ppOutItem >>> 0
  if (inv === 0) return 0
  if (ppOut !== 0) m.setU32(ppOut, 0)
  if (m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  const ppItems = pGrid0 !== 0 ? m.u32((pGrid0 + 0x0c) >>> 0) : 0
  const pRight = ppItems !== 0 ? m.u32((ppItems + 4 * 4) >>> 0) : 0
  if (
    pRight !== 0 &&
    isItemNotBrokenInvMem113c(m, pRight) !== 0 &&
    ITEMS_CheckItemTypeIdMem113c(m, pRight, 0x33) !== 0
  ) {
    if (ppOut !== 0) m.setU32(ppOut, pRight)
    return 1
  }
  const pLeft = ppItems !== 0 ? m.u32((ppItems + 5 * 4) >>> 0) : 0
  if (
    pLeft !== 0 &&
    isItemNotBrokenInvMem113c(m, pLeft) !== 0 &&
    ITEMS_CheckItemTypeIdMem113c(m, pLeft, 0x33) !== 0
  ) {
    if (ppOut !== 0) m.setU32(ppOut, pLeft)
    return 1
  }
  return 0
}

/**
 * `@va D2Common:0x6FD70270` (`D2Common.#10962` `INVENTORY_GetSecondaryWeapon`, 169 bytes,
 * stdcall `[esp+4] = pInventory`, `ret 0x4` -> `D2UnitStrc*` or `0`).
 */
export function INVENTORY_GetSecondaryWeapon113c(m: Memory113c, pInventory: number): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const activeGuid = m.u32((inv + 0x1c) >>> 0) | 0
  if (activeGuid === -1) return 0
  const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  const ppItems = pGrid0 !== 0 ? m.u32((pGrid0 + 0x0c) >>> 0) : 0
  let pLeft = ppItems !== 0 ? m.u32((ppItems + 5 * 4) >>> 0) : 0
  if (ITEMS_CheckItemTypeIdMem113c(m, pLeft, 0x2d) === 0) {
    pLeft = 0
  }
  let pRight = ppItems !== 0 ? m.u32((ppItems + 4 * 4) >>> 0) : 0
  if (ITEMS_CheckItemTypeIdMem113c(m, pRight, 0x2d) === 0) {
    pRight = 0
  }
  if (pLeft !== 0 && (m.u32((pLeft + 0x0c) >>> 0) | 0) === activeGuid) {
    return pRight >>> 0
  }
  if (pRight !== 0 && (m.u32((pRight + 0x0c) >>> 0) | 0) === activeGuid) {
    return pLeft >>> 0
  }
  return 0
}

const STACKABLE_GROUPS_VA_113C: ReadonlyArray< readonly [number, number] > = [
  [0x6fdef08c, 0x6fdef090],
  [0x6fdef074, 0x6fdef078],
  [0x6fdef068, 0x6fdef06c],
]

/**
 * `@va D2Common:0x6FD72CD0` (`D2Common.#10700` `ITEMS_AreStackablesCompatible`, 327 bytes,
 * stdcall `[esp+4] = pItem1`, `[esp+8] = pItem2`, `ret 0x8` -> `1` or `0`).
 */
export function ITEMS_AreStackablesCompatible113c(
  m: Memory113c,
  pItem1: number,
  pItem2: number,
): number {
  const itm1 = pItem1 >>> 0
  const itm2 = pItem2 >>> 0
  if (itm1 === 0 || itm2 === 0) return 0
  const cls1 = m.u32((itm1 + 4) >>> 0)
  const cls2 = m.u32((itm2 + 4) >>> 0)
  if (cls1 === cls2) return 1
  // 0x6FD72CFF/0x6FD72D08: both records come from 0x6FDC19A0 and are dereferenced (`[rec+0x80]`) with no
  // null test; the codes are re-read per entry until each one has been matched (0x6FD72D20..0x6FD72D56).
  const pTxt1 = getItemsTxtRecordInvMem113c(m, cls1)
  const pTxt2 = getItemsTxtRecordInvMem113c(m, cls2)
  for (const [countAddr, arrAddr] of STACKABLE_GROUPS_VA_113C) {
    const count = m.u32(countAddr) >>> 0
    let found1 = false
    let found2 = false
    for (let i = 0; i < count; i++) {
      const code = m.u32((arrAddr + i * 4) >>> 0)
      if (!found1 && m.u32((pTxt1 + ITEMS_TXT_OFF_DWCODE_113C) >>> 0) === code) found1 = true
      if (!found2 && m.u32((pTxt2 + ITEMS_TXT_OFF_DWCODE_113C) >>> 0) === code) found2 = true
      if (found1 && found2) return 1
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD731A0` (`INVENTORY_GetItemDimensionsCallback`, 53 bytes,
 * stdcall `[esp+4] = pItem`, `[esp+8] = pOutW`, `[esp+0xC] = pOutH`, `[esp+0x10] = a4`, `[esp+0x14] = a5`, `ret 0x14`, void).
 */
export function INVENTORY_GetItemDimensionsCallback113c(
  m: Memory113c,
  pItem: number,
  pOutWidth: number,
  pOutHeight: number,
  _a4: number,
  _a5: number,
): void {
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return
  const pTxt = getItemsTxtRecordInvMem113c(m, m.u32((itm + 4) >>> 0))
  if (pTxt === 0) return
  m.setU8(pOutWidth >>> 0, m.u8((pTxt + 0x10f) >>> 0))
  m.setU8(pOutHeight >>> 0, m.u8((pTxt + 0x110) >>> 0))
}

// ============================================================================
// Iteration 9 Lane A — B051' (#1..#12) & B048' (#24) Inventory / Items Ports
// ============================================================================

function readInvTxtGridDims113c(m: Memory113c, nIndex: number): readonly [number, number] {
  const idx = nIndex >>> 0
  const pBase = m.u32(SGPT_INVENTORY_TXT_PTR_VA)
  if (pBase === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\InvTbls.cpp', 0x7f)
  }
  if (idx > m.u32(SGPT_INVENTORY_TXT_MAX_VA)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\InvTbls.cpp', 0x97)
  }
  const pRec = (pBase + imul32(idx | 0, 0xf0)) >>> 0
  if (pRec === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\InvTbls.cpp', 0x97)
  }
  const src = (pRec + 0x10) >>> 0
  const d0 = m.u32(src)
  m.u32((src + 0x04) >>> 0)
  m.u32((src + 0x08) >>> 0)
  m.u32((src + 0x0c) >>> 0)
  m.u32((src + 0x10) >>> 0)
  m.u32((src + 0x14) >>> 0)
  return [d0 & 0xff, (d0 >>> 8) & 0xff]
}

function getOrInitGridWithDims113c(
  m: Memory113c,
  pInventory: number,
  gridIdx: number,
  gridX: number,
  gridY: number,
): number {
  const inv = pInventory >>> 0
  const idx = gridIdx | 0
  const gx = gridX & 0xff
  const gy = gridY & 0xff
  const nGridCount = m.u32((inv + 0x18) >>> 0) | 0
  if (nGridCount <= idx) {
    m.u32((inv + 0x04) >>> 0)
    const pOld = m.u32((inv + 0x14) >>> 0)
    const pNew = m.alloc(((idx << 4) + 0x10) >>> 0)
    for (let i = 0; i < nGridCount * 16; i++) {
      m.setU8((pNew + i) >>> 0, m.u8((pOld + i) >>> 0))
    }
    m.setU32((inv + 0x14) >>> 0, pNew)
    m.fill((pNew + (nGridCount << 4)) >>> 0, (((idx - nGridCount + 1) << 4) >>> 0), 0)
    m.setU32((inv + 0x18) >>> 0, (idx + 1) >>> 0)
    const pGrid = (m.u32((inv + 0x14) >>> 0) + (idx << 4)) >>> 0
    m.setU8((pGrid + 8) >>> 0, gx)
    m.setU8((pGrid + 9) >>> 0, gy)
    m.u32((inv + 0x04) >>> 0)
    const pItems = m.alloc(imul32(gx, gy) * 4)
    m.setU32((pGrid + 0x0c) >>> 0, pItems)
    return pGrid
  }
  const pGrid = (m.u32((inv + 0x14) >>> 0) + (idx << 4)) >>> 0
  const ppItems = m.u32((pGrid + 0x0c) >>> 0)
  if (ppItems === 0) {
    m.setU8((pGrid + 8) >>> 0, gx)
    m.setU8((pGrid + 9) >>> 0, gy)
    m.u32((inv + 0x04) >>> 0)
    const pItems = m.alloc(imul32(m.u8((pGrid + 8) >>> 0), gy) * 4)
    m.setU32((pGrid + 0x0c) >>> 0, pItems)
  }
  if (m.u8((pGrid + 8) >>> 0) !== gx) return 0
  if (m.u8((pGrid + 9) >>> 0) !== gy) return 0
  return pGrid
}

/**
 * `@va D2Common:0x6FD6E7B0` (internal LTCG `INVENTORY_CopyGrid2Cells`,
 * custom reg `ecx = pDstInv`, `eax = pUnit`, `ret` -> `0 | 1`).
 */
export function INVENTORY_CopyGrid2Cells113c(
  m: Memory113c,
  pDstInv: number,
  pUnit: number,
): number {
  const dstInv = pDstInv >>> 0
  const u = pUnit >>> 0
  if (dstInv === 0 || m.u32(dstInv) !== INVENTORY_SIGNATURE_113C) return 0
  const recId = UNITS_GetInventoryRecordId113c(m, u, 0, 1)
  const [gx, gy] = readInvTxtGridDims113c(m, recId)
  const pDstGrid2 = getOrInitGridWithDims113c(m, dstInv, 2, gx, gy)
  if (pDstGrid2 === 0) return 0
  const srcInv = m.u32((u + 0x60) >>> 0)
  if (srcInv === 0 || m.u32(srcInv) !== INVENTORY_SIGNATURE_113C) return 0
  const pSrcGrid2 = getOrInitGridWithDims113c(m, srcInv, 2, gx, gy)
  if (pSrcGrid2 === 0) return 0
  const srcW = m.u8((pSrcGrid2 + 8) >>> 0)
  if (srcW === 0) return 0
  const srcH = m.u8((pSrcGrid2 + 9) >>> 0)
  if (srcH === 0) return 0
  if (srcW !== m.u8((pDstGrid2 + 8) >>> 0)) return 0
  if (srcH !== m.u8((pDstGrid2 + 9) >>> 0)) return 0
  const pSrcCells = m.u32((pSrcGrid2 + 0x0c) >>> 0)
  if (pSrcCells === 0) return 0
  const pDstCells = m.u32((pDstGrid2 + 0x0c) >>> 0)
  if (pDstCells === 0) return 0
  const cellCount = imul32(srcH, srcW)
  for (let i = 0; i < cellCount; i++) {
    m.setU32((pDstCells + i * 4) >>> 0, m.u32((pSrcCells + i * 4) >>> 0))
  }
  return 1
}

/**
 * `@va D2Common:0x6FD6EEE0` (`D2Common.#10149` `INVENTORY_CanStackIntoBeltRow`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8` -> `0 | 1`).
 */
export function INVENTORY_CanStackIntoBeltRow113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  const pTxt = getItemsTxtRecordInvMem113c(m, m.u32((itm + 4) >>> 0))
  if (pTxt === 0) return 0
  const dwCode = m.u32((pTxt + ITEMS_TXT_OFF_DWCODE_113C) >>> 0)
  if (dwCode === 0x20637369 || dwCode === 0x20637374) return 0
  const pGrid1 = INVENTORY_GetOrInitGridMem113c(m, inv, 1, D2COMMON_GRID1_INFO_VA_113C)
  if (pGrid1 === 0) return 0
  for (let off = 0; off < 0x10; off += 4) {
    const pSlotItem = m.u32((m.u32((pGrid1 + 0x0c) >>> 0) + off) >>> 0)
    if (pSlotItem !== 0 && ITEMS_AreStackablesCompatible113c(m, itm, pSlotItem) !== 0) {
      return 1
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD6F370` (internal LTCG `INVENTORY_FindFirstFitColMajor`,
 * custom reg `bl = nHeight`, stack `[esp+4] = pGrid`, `[esp+8] = pOutX`, `[esp+0xC] = pOutY`, `[esp+0x10] = nWidth`,
 * `ret 0x10` -> `0 | 1`).
 */
export function INVENTORY_FindFirstFitColMajor113c(
  m: Memory113c,
  nHeight: number,
  pGrid: number,
  pOutX: number,
  pOutY: number,
  nWidth: number,
): number {
  const grid = pGrid >>> 0
  const h = nHeight & 0xff
  const w = nWidth & 0xff
  let gw = m.u8((grid + 8) >>> 0)
  if (gw <= 0) return 0
  for (let x = 0; x < gw; x++) {
    let gh = m.u8((grid + 9) >>> 0)
    if (gh > 0) {
      const rowStride = (gw << 2) | 0
      let pCell = (m.u32((grid + 0x0c) >>> 0) + x * 4) >>> 0
      for (let y = 0; y < gh; y++) {
        if (m.u32(pCell) === 0) {
          const curW = m.u8((grid + 8) >>> 0)
          if (((w + x) | 0) <= curW && ((h + y) | 0) <= gh) {
            if (INVENTORY_IsGridRectEmpty113c(m, grid, y, w, x, h) !== 0) {
              m.setU32(pOutX >>> 0, x >>> 0)
              m.setU32(pOutY >>> 0, y >>> 0)
              return 1
            }
          }
        }
        pCell = (pCell + rowStride) >>> 0
        gh = m.u8((grid + 9) >>> 0)
      }
    }
    gw = m.u8((grid + 8) >>> 0)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD6F410` (internal LTCG `INVENTORY_FindBestFitRowMajor`,
 * custom reg `bl = nHeight`, stack `[esp+4] = pGrid`, `[esp+8] = pOutX`, `[esp+0xC] = pOutY`, `[esp+0x10] = nWidth`,
 * `ret 0x10` -> `0 | 1`).
 */
export function INVENTORY_FindBestFitRowMajor113c(
  m: Memory113c,
  nHeight: number,
  pGrid: number,
  pOutX: number,
  pOutY: number,
  nWidth: number,
): number {
  const grid = pGrid >>> 0
  const h = nHeight & 0xff
  const w = nWidth & 0xff
  let bestScore = 0
  let gh = m.u8((grid + 9) >>> 0)
  if (gh === 0) return 0
  for (let y = 0; y < gh; y++) {
    let gw = m.u8((grid + 8) >>> 0)
    for (let x = 0; x < gw; x++) {
      const ppItems = m.u32((grid + 0x0c) >>> 0)
      if (m.u32((ppItems + (imul32(gw, y) + x) * 4) >>> 0) === 0) {
        const curH = m.u8((grid + 9) >>> 0)
        if (((w + x) | 0) <= gw && ((h + y) | 0) <= curH) {
          if (INVENTORY_IsGridRectEmpty113c(m, grid, y, w, x, h) !== 0) {
            const score = INVENTORY_ScoreGridRectPlacement113c(m, y, h, grid, x, nWidth) & 0xff
            if (score > bestScore) {
              m.setU32(pOutX >>> 0, x >>> 0)
              bestScore = score
              m.setU32(pOutY >>> 0, y >>> 0)
              if (score === 0xff) return 1
            }
          }
        }
      }
      gw = m.u8((grid + 8) >>> 0)
    }
    gh = m.u8((grid + 9) >>> 0)
  }
  return bestScore !== 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD6F4E0` (internal LTCG `INVENTORY_FindFirstFitRightToLeft`,
 * custom reg `bl = nHeight`, stack `[esp+4] = pGrid`, `[esp+8] = pOutX`, `[esp+0xC] = pOutY`, `[esp+0x10] = nWidth`,
 * `ret 0x10` -> `0 | 1`).
 */
export function INVENTORY_FindFirstFitRightToLeft113c(
  m: Memory113c,
  nHeight: number,
  pGrid: number,
  pOutX: number,
  pOutY: number,
  nWidth: number,
): number {
  const grid = pGrid >>> 0
  const h = nHeight & 0xff
  const w = nWidth & 0xff
  for (let x = (m.u8((grid + 8) >>> 0) - 1) | 0; x >= 0; x--) {
    let gh = m.u8((grid + 9) >>> 0)
    if (gh > 0) {
      const rowStride = (m.u8((grid + 8) >>> 0) << 2) | 0
      let pCell = (m.u32((grid + 0x0c) >>> 0) + x * 4) >>> 0
      for (let y = 0; y < gh; y++) {
        if (m.u32(pCell) === 0) {
          const curW = m.u8((grid + 8) >>> 0)
          if (((w + x) | 0) <= curW && ((h + y) | 0) <= gh) {
            if (INVENTORY_IsGridRectEmpty113c(m, grid, y, w, x, h) !== 0) {
              m.setU32(pOutX >>> 0, x >>> 0)
              m.setU32(pOutY >>> 0, y >>> 0)
              return 1
            }
          }
        }
        pCell = (pCell + rowStride) >>> 0
        gh = m.u8((grid + 9) >>> 0)
      }
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD6F580` (internal LTCG `INVENTORY_FindBestFitReverse`,
 * custom reg `bl = nHeight`, stack `[esp+4] = pGrid`, `[esp+8] = pOutX`, `[esp+0xC] = pOutY`, `[esp+0x10] = nWidth`,
 * `ret 0x10` -> `0 | 1`).
 */
export function INVENTORY_FindBestFitReverse113c(
  m: Memory113c,
  nHeight: number,
  pGrid: number,
  pOutX: number,
  pOutY: number,
  nWidth: number,
): number {
  const grid = pGrid >>> 0
  const h = nHeight & 0xff
  const w = nWidth & 0xff
  let bestScore = 0
  for (let x = (m.u8((grid + 8) >>> 0) - 1) | 0; x >= 0; x--) {
    for (let y = (m.u8((grid + 9) >>> 0) - 1) | 0; y >= 0; y--) {
      const gw = m.u8((grid + 8) >>> 0)
      const ppItems = m.u32((grid + 0x0c) >>> 0)
      if (m.u32((ppItems + (imul32(gw, y) + x) * 4) >>> 0) === 0) {
        const gh = m.u8((grid + 9) >>> 0)
        if (((w + x) | 0) <= gw && ((h + y) | 0) <= gh) {
          if (INVENTORY_IsGridRectEmpty113c(m, grid, y, w, x, h) !== 0) {
            const score = INVENTORY_ScoreGridRectPlacement113c(m, y, h, grid, x, nWidth) & 0xff
            if (score > bestScore) {
              m.setU32(pOutX >>> 0, x >>> 0)
              bestScore = score
              m.setU32(pOutY >>> 0, y >>> 0)
              if (score === 0xff) return 1
            }
          }
        }
      }
    }
  }
  return bestScore !== 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD6FB50` (internal LTCG `INVENTORY_FindItemGfxCodeIndex`,
 * custom reg `esi = dwCode1`, `edi = dwCode2`, `ret` -> `0..254`).
 */
export function INVENTORY_FindItemGfxCodeIndex113c(
  m: Memory113c,
  dwCode1: number,
  dwCode2: number,
): number {
  const c1 = dwCode1 >>> 0
  const c2 = dwCode2 >>> 0
  INVENTORY_InitItemGfxCodeTable113c(m)
  for (let idx = 1; idx < 0xff; idx++) {
    const code = m.u32((D2COMMON_ITEM_GFX_CACHE_VA_113C + idx * 8) >>> 0)
    if (code === c1 || code === c2) return idx
  }
  return 0
}

/**
 * `@va D2Common:0x6FD6FC70` (`D2Common.#10694` `INVENTORY_UpdateWeaponGuidOnRemoval`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8`, void).
 */
export function INVENTORY_UpdateWeaponGuidOnRemoval113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): void {
  const inv = pInventory >>> 0
  if (inv === 0) return
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return
  if (ITEMS_CheckItemTypeIdMem113c(m, itm, 0x2d) === 0) return
  const sig = m.u32(inv)
  if (sig === INVENTORY_SIGNATURE_113C && m.u32((inv + 0x1c) >>> 0) === m.u32((itm + 0x0c) >>> 0)) {
    m.setU32((inv + 0x1c) >>> 0, 0xffffffff)
  }
  const bodyLoc = ITEMS_GetBodyLocation113c(m, itm) & 0xff
  let pOther = 0
  if (bodyLoc === 4) {
    if (sig !== INVENTORY_SIGNATURE_113C) return
    const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
    if (pGrid0 === 0) return
    pOther = m.u32((m.u32((pGrid0 + 0x0c) >>> 0) + 0x14) >>> 0)
  } else if (bodyLoc === 5) {
    if (sig !== INVENTORY_SIGNATURE_113C) return
    const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
    if (pGrid0 === 0) return
    pOther = m.u32((m.u32((pGrid0 + 0x0c) >>> 0) + 0x10) >>> 0)
  } else {
    return
  }
  if (pOther === 0) return
  if (isItemNotBrokenInvMem113c(m, pOther) === 0) return
  if (m.u32(inv) !== INVENTORY_SIGNATURE_113C) return
  if (m.u32(pOther) !== UNIT_ITEM) return
  m.setU32((inv + 0x1c) >>> 0, m.u32((pOther + 0x0c) >>> 0))
}

/**
 * `@va D2Common:0x6FD6FE10` (`D2Common.#10010` `INVENTORY_FindBackpackItemByType`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = nItemType`, `[esp+0xC] = pAfterItem`, `ret 0xC` -> `D2UnitStrc* | 0`).
 */
export function INVENTORY_FindBackpackItemByType113c(
  m: Memory113c,
  pInventory: number,
  nItemType: number,
  pAfterItem: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pOwner = m.u32((inv + 0x08) >>> 0)
  let pGrid2 = 0
  if (pOwner !== 0 && m.u32(pOwner) === 0) {
    const recId = UNITS_GetInventoryRecordId113c(m, pOwner, 0, 1)
    const [gx, gy] = readInvTxtGridDims113c(m, recId)
    pGrid2 = getOrInitGridWithDims113c(m, inv, 2, gx, gy)
  } else {
    pGrid2 = INVENTORY_GetOrInitGridMem113c(m, inv, 2, 0)
  }
  if (pGrid2 === 0) return 0
  const after = pAfterItem >>> 0
  let cur = m.u32(pGrid2)
  if (after !== 0) {
    if (cur === 0) return 0
    while (cur !== after) {
      const pExtra = itemExtraOrZero(m, cur, true)
      if (pExtra === 0) return 0
      cur = m.u32((pExtra + 0x14) >>> 0)
      if (cur === 0) return 0
    }
    const pAfterExtra = INVENTORY_GetItemExtraData113c(m, cur)
    if (pAfterExtra === 0) return 0
    cur = m.u32((pAfterExtra + 0x14) >>> 0)
  }
  while (cur !== 0) {
    if (ITEMS_CheckItemTypeIdMem113c(m, cur, nItemType) !== 0) {
      return cur
    }
    const pExtra = itemExtraOrZero(m, cur, true)
    if (pExtra === 0) return 0
    cur = m.u32((pExtra + 0x14) >>> 0)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD70620` (`D2Common.#10138` `INVENTORY_UpdateWeaponGuidOnInsert`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8`, void).
 */
export function INVENTORY_UpdateWeaponGuidOnInsert113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): void {
  const inv = pInventory >>> 0
  if (inv === 0) return
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return
  if (ITEMS_CheckItemTypeIdMem113c(m, itm, 0x2d) === 0) return
  const bodyLoc = ITEMS_GetBodyLocation113c(m, itm) & 0xff
  if (bodyLoc !== 4 && bodyLoc !== 5) return
  if (isItemNotBrokenInvMem113c(m, itm) === 0) {
    if (
      m.u32(inv) === INVENTORY_SIGNATURE_113C &&
      m.u32((inv + 0x1c) >>> 0) === m.u32((itm + 0x0c) >>> 0)
    ) {
      m.setU32((inv + 0x1c) >>> 0, 0xffffffff)
    }
    return
  }
  const pComp = INVENTORY_GetCompositWeaponMem113c(m, inv)
  if (
    pComp === 0 ||
    ITEMS_CheckItemTypeIdMem113c(m, pComp, 0x2d) === 0 ||
    ITEMS_CheckItemTypeIdMem113c(m, pComp, 0x26) !== 0
  ) {
    if (m.u32(inv) === INVENTORY_SIGNATURE_113C) {
      m.setU32((inv + 0x1c) >>> 0, m.u32((itm + 0x0c) >>> 0))
    }
    return
  }
  if (
    m.u32(inv) === INVENTORY_SIGNATURE_113C &&
    m.u32((inv + 0x1c) >>> 0) === m.u32((itm + 0x0c) >>> 0)
  ) {
    m.setU32((inv + 0x1c) >>> 0, 0xffffffff)
  }
}

/**
 * `@va D2Common:0x6FD71640` (internal LTCG `INVENTORY_RemoveItemInternal`,
 * custom reg `eax = pItem`, `ret` -> `0 | 1`).
 */
export function INVENTORY_RemoveItemInternal113c(m: Memory113c, pItem: number): number {
  const itm = pItem >>> 0
  const pExtra = itemExtraOrZero(m, itm, true)
  if (pExtra === 0) return 0
  const inv = m.u32(pExtra)
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const nodePos = s8(m.u8((pExtra + 0x0c) >>> 0))
  if (nodePos > 0) {
    const nGridCount = m.u32((inv + 0x18) >>> 0) | 0
    const gridIdx = (nodePos - 1) | 0
    if (nGridCount > gridIdx) {
      const pGrid = (m.u32((inv + 0x14) >>> 0) + (gridIdx << 4)) >>> 0
      const bUseDims = gridIdx >= 1 ? 1 : 0
      INVENTORY_RemoveItemFromGrid113c(m, itm, pGrid, bUseDims)
    }
  }
  if (m.u32((inv + 0x20) >>> 0) === itm) {
    m.setU32((inv + 0x20) >>> 0, 0)
  } else {
    INVENTORY_UnlinkItemFromList113c(m, itm, (inv + 0x0c) >>> 0)
    m.setU32((inv + 0x28) >>> 0, (m.u32((inv + 0x28) >>> 0) - 1) >>> 0)
  }
  m.setU32(pExtra, 0)
  m.setU8((pExtra + 0x0c) >>> 0, 0)
  m.setU8((pExtra + 0x0d) >>> 0, 0)
  ITEMS_SetCellOverwrite113c(m, itm, 0xffffffff)
  const pOwner = m.u32((inv + 0x08) >>> 0)
  if (pOwner !== 0) {
    STATLIST_UnlinkUnitStatList113c(m, pOwner, itm)
  }
  const itemGuid = m.u32((itm + 0x0c) >>> 0)
  if (m.u32((inv + 0x1c) >>> 0) === itemGuid) {
    m.setU32((inv + 0x1c) >>> 0, 0xffffffff)
  }
  return 1
}

/**
 * `@va D2Common:0x6FD72150` (`D2Common.#11105` `ITEMS_DecodeItemCompactBitstreamV96`,
 * stdcall `[esp+4] = pBitstreamData`, `[esp+8] = nDataSize`, `[esp+0xC] = bCheckHeader`,
 * `[esp+0x10] = pOutHeader`, `ret 0x10` -> `BOOL`).
 */
export function ITEMS_DecodeItemCompactBitstreamV96_113c(
  m: Memory113c,
  pBitstreamData: number,
  nDataSize: number,
  bCheckHeader: number,
  pOutHeader: number,
): number {
  return ITEMS_DecodeItemCompactBitstream113c(m, pBitstreamData, nDataSize, bCheckHeader, pOutHeader, 0x60)
}

/**
 * `@va D2Common:0x6FD6E4F0` (`D2Common.#10050` `INVENTORY_AppendItemGuidNode`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8`, void).
 */
export function INVENTORY_AppendItemGuidNode113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): void {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return
  const guid = m.u32((itm + 0x0c) >>> 0)
  if (INVENTORY_CheckNodeExists113c(m, inv, guid) !== 0) return
  m.u32((inv + 0x04) >>> 0)
  const pNode = m.alloc(8) >>> 0
  if (pNode === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\INVENTORY\\Inventory.cpp', 0xd0b)
  }
  m.setU32(pNode, guid)
  m.setU32((pNode + 4) >>> 0, 0)
  const pFirst = m.u32((inv + 0x2c) >>> 0)
  if (pFirst === 0) {
    m.setU32((inv + 0x2c) >>> 0, pNode)
    m.setU32((inv + 0x30) >>> 0, pNode)
    return
  }
  const pLast = m.u32((inv + 0x30) >>> 0)
  m.setU32((pLast + 4) >>> 0, pNode)
  m.setU32((inv + 0x30) >>> 0, pNode)
}

/**
 * `@va D2Common:0x6FD6FB80` (`D2Common.#10051` `INVENTORY_GetEquippedWeaponHandClass`,
 * stdcall `[esp+4] = pPlayer`, `[esp+8] = pInventory`, `ret 8` -> `int32` `-1 | 1 | 2`).
 */
export function INVENTORY_GetEquippedWeaponHandClass113c(
  m: Memory113c,
  pPlayer: number,
  pInventory: number,
): number {
  const ebx = pInventory >>> 0
  if (ebx === 0) return 0xffffffff
  let edi = 0
  if (m.u32(ebx) === INVENTORY_SIGNATURE_113C) {
    const g0 = INVENTORY_GetOrInitGridMem113c(m, ebx, 0, D2COMMON_GRID0_INFO_VA_113C)
    if (g0 !== 0) {
      edi = m.u32((m.u32((g0 + 0x0c) >>> 0) + 0x14) >>> 0)
    }
  }
  let esi = 0
  if (m.u32(ebx) === INVENTORY_SIGNATURE_113C) {
    const g0b = INVENTORY_GetOrInitGridMem113c(m, ebx, 0, D2COMMON_GRID0_INFO_VA_113C)
    if (g0b !== 0) {
      esi = m.u32((m.u32((g0b + 0x0c) >>> 0) + 0x10) >>> 0)
    }
  }
  const plr = pPlayer >>> 0
  if (edi !== 0) {
    if (esi !== 0) {
      if (ITEMS_CanPlayerClassUseItem113c(m, plr, edi) !== 0) return 1
      if (ITEMS_CanPlayerClassUseItem113c(m, plr, esi) !== 0) return 1
      if (ITEMS_GetInvWidthFromItem113c(m, edi) !== 0) return 2
      return ITEMS_GetInvWidthFromItem113c(m, esi) !== 0 ? 2 : 0xffffffff
    }
    if (m.u32(edi) === UNIT_ITEM) {
      if (ITEMS_GetInvWidthFromId113c(m, m.u32((edi + 0x04) >>> 0)) !== 0) return 2
    }
    return ITEMS_CanPlayerClassUseItem113c(m, plr, edi) !== 0 ? 2 : 0xffffffff
  }
  if (esi !== 0) {
    if (m.u32(esi) === UNIT_ITEM) {
      if (ITEMS_GetInvWidthFromId113c(m, m.u32((esi + 0x04) >>> 0)) !== 0) return 2
    }
    return ITEMS_CanPlayerClassUseItem113c(m, plr, esi) !== 0 ? 2 : 0xffffffff
  }
  return 0xffffffff
}

/**
 * `@va D2Common:0x6FD81260` (`D2Common.#10921` `INVENTORY_GetItemEquipLocation`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pItem`, `ret 8`, `retMask = 0xFF`).
 */
export function INVENTORY_GetItemEquipLocation113c(
  m: Memory113c,
  pUnit: number,
  pItem: number,
): number {
  const ebp = pItem >>> 0
  let loc = 0
  if (ebp !== 0 && m.u32(ebp) === UNIT_ITEM) {
    const pData = m.u32((ebp + 0x14) >>> 0)
    if (pData !== 0) {
      loc = m.u8((pData + 0x44) >>> 0)
    }
  }

  if (loc === 4 || loc === 5) {
    const ebx = m.u32(((pUnit >>> 0) + 0x60) >>> 0)
    let edi = 0
    if (ebx !== 0 && m.u32(ebx) === INVENTORY_SIGNATURE_113C) {
      const g0 = INVENTORY_GetOrInitGridMem113c(m, ebx, 0, D2COMMON_GRID0_INFO_VA_113C)
      if (g0 !== 0) {
        const pRight = m.u32((m.u32((g0 + 0x0c) >>> 0) + 0x10) >>> 0)
        if (pRight !== 0 && isItemNotBrokenInvMem113c(m, pRight) !== 0) {
          edi = pRight
        }
      }
    }
    let esi = 0
    if (ebx !== 0 && m.u32(ebx) === INVENTORY_SIGNATURE_113C) {
      const g0b = INVENTORY_GetOrInitGridMem113c(m, ebx, 0, D2COMMON_GRID0_INFO_VA_113C)
      if (g0b !== 0) {
        const pLeft = m.u32((m.u32((g0b + 0x0c) >>> 0) + 0x14) >>> 0)
        if (pLeft !== 0 && isItemNotBrokenInvMem113c(m, pLeft) !== 0) {
          esi = pLeft
        }
      }
    }
    if (edi !== 0 && esi !== 0) {
      const wRight = m.u32(edi) === UNIT_ITEM ? ITEMS_GetInvWidthFromId113c(m, m.u32((edi + 0x04) >>> 0)) : 0
      if (wRight === 0) {
        const wLeft = m.u32(esi) === UNIT_ITEM ? ITEMS_GetInvWidthFromId113c(m, m.u32((esi + 0x04) >>> 0)) : 0
        if (wLeft === 0 && unitsCanDualWieldMem113c(m, pUnit) !== 0) {
          if (ebp !== INVENTORY_GetCompositWeaponMem113c(m, ebx)) {
            return 6
          }
        }
      }
    }
  }

  if (ebp === 0) {
    throw new D2CommonAssertError('', 0x635)
  }
  if (m.u32(ebp) !== UNIT_ITEM) {
    throw new D2CommonAssertError('', 0x636)
  }
  const pRec = getItemsTxtRecordInvMem113c(m, m.u32((ebp + 0x04) >>> 0))
  if (pRec === 0) {
    throw new D2CommonAssertError('', 0x639)
  }
  return m.u8((pRec + 0x115) >>> 0)
}

/**
 * `@va D2Common:0x6FD70520` (internal LTCG `INVENTORY_FindGridPlacementMode0`,
 * custom reg `edi = pGrid`, `esi = pOutX`, `edx = pOutY`, `ecx = nWidth`,
 * stack `[esp+4] = pInventory`, `[esp+8] = nHeight`, `ret 8` -> `0 | 1`).
 */
export function INVENTORY_FindGridPlacementMode0_113c(
  m: Memory113c,
  pGrid: number,
  pOutX: number,
  pOutY: number,
  nWidth: number,
  pInventory: number,
  nHeight: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  const pOwner = m.u32((inv + 0x08) >>> 0)
  if (pOwner !== 0 && m.u32(pOwner) === 0) {
    return INVENTORY_FindBestFitRowMajor113c(m, nHeight, pGrid, pOutX, pOutY, nWidth)
  }
  return INVENTORY_FindFirstFitColMajor113c(m, nHeight, pGrid, pOutX, pOutY, nWidth)
}

/**
 * `@va D2Common:0x6FD70560` (internal LTCG `INVENTORY_FindGridPlacementMode1`,
 * custom reg `edi = pGrid`, `esi = pOutX`, `edx = pOutY`, `ecx = nWidth`,
 * stack `[esp+4] = pInventory`, `[esp+8] = nHeight`, `ret 8` -> `0 | 1`).
 */
export function INVENTORY_FindGridPlacementMode1_113c(
  m: Memory113c,
  pGrid: number,
  pOutX: number,
  pOutY: number,
  nWidth: number,
  pInventory: number,
  nHeight: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  const pOwner = m.u32((inv + 0x08) >>> 0)
  if (pOwner !== 0 && m.u32(pOwner) === 0) {
    return INVENTORY_FindBestFitRowMajor113c(m, nHeight, pGrid, pOutX, pOutY, nWidth)
  }
  return INVENTORY_FindFirstFitColMajor113c(m, nHeight, pGrid, pOutX, pOutY, nWidth)
}

/**
 * `@va D2Common:0x6FD705A0` (internal LTCG `INVENTORY_FindGridPlacementMode2`,
 * custom reg `edi = pGrid`, `esi = pOutX`, `edx = pOutY`, `ecx = nWidth`,
 * stack `[esp+4] = pInventory`, `[esp+8] = nHeight`, `ret 8` -> `0 | 1`).
 */
export function INVENTORY_FindGridPlacementMode2_113c(
  m: Memory113c,
  pGrid: number,
  pOutX: number,
  pOutY: number,
  nWidth: number,
  pInventory: number,
  nHeight: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  const pOwner = m.u32((inv + 0x08) >>> 0)
  if (pOwner !== 0 && m.u32(pOwner) === 0) {
    return INVENTORY_FindBestFitRowMajor113c(m, nHeight, pGrid, pOutX, pOutY, nWidth)
  }
  return INVENTORY_FindFirstFitColMajor113c(m, nHeight, pGrid, pOutX, pOutY, nWidth)
}

/**
 * `@va D2Common:0x6FD705E0` (internal LTCG `INVENTORY_FindGridPlacementMode3`,
 * custom reg `edi = pGrid`, `esi = pOutX`, `edx = pOutY`, `ecx = nWidth`,
 * stack `[esp+4] = pInventory`, `[esp+8] = nHeight`, `ret 8` -> `0 | 1`).
 */
export function INVENTORY_FindGridPlacementMode3_113c(
  m: Memory113c,
  pGrid: number,
  pOutX: number,
  pOutY: number,
  nWidth: number,
  pInventory: number,
  nHeight: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  const pOwner = m.u32((inv + 0x08) >>> 0)
  if (pOwner !== 0 && m.u32(pOwner) === 0) {
    return INVENTORY_FindBestFitReverse113c(m, nHeight, pGrid, pOutX, pOutY, nWidth)
  }
  return INVENTORY_FindFirstFitRightToLeft113c(m, nHeight, pGrid, pOutX, pOutY, nWidth)
}

/**
 * `@va D2Common:0x6FD71710` (`D2Common.#11162` `INVENTORY_EmptyInventory`,
 * stdcall `[esp+4] = pInventory`, `ret 4` -> `0 | 1`).
 */
export function INVENTORY_EmptyInventory113c(m: Memory113c, pInventory: number): number {
  const esi = pInventory >>> 0
  if (esi === 0 || m.u32(esi) !== INVENTORY_SIGNATURE_113C) return 0
  let pItem = m.u32((esi + 0x0c) >>> 0)
  m.setU32((esi + 0x20) >>> 0, 0)
  m.setU32((esi + 0x1c) >>> 0, 0xffffffff)
  while (pItem !== 0) {
    const cur = m.u32((esi + 0x0c) >>> 0)
    if (INVENTORY_RemoveItemInternal113c(m, cur) === 0) {
      return 0
    }
    pItem = m.u32((esi + 0x0c) >>> 0)
  }
  return 1
}

/**
 * `@va D2Common:0x6FD71790` (`D2Common.#10466` `INVENTORY_SetCursorItem`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8`, void).
 */
export function INVENTORY_SetCursorItem113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): void {
  const edx = pInventory >>> 0
  if (edx === 0 || m.u32(edx) !== INVENTORY_SIGNATURE_113C) return
  const ecx = pItem >>> 0
  if (ecx === 0) {
    const pCur = m.u32((edx + 0x20) >>> 0)
    if (itemExtraOrZero(m, pCur, true) === 0) return
    INVENTORY_RemoveItemInternal113c(m, pCur)
    return
  }
  const pExtra = itemExtraOrZero(m, ecx, true)
  if (pExtra === 0) return
  m.setU32((edx + 0x20) >>> 0, ecx)
  m.setU32(pExtra, edx)
}

/**
 * `@va D2Common:0x6FD71B00` (`D2Common.#10646` `INVENTORY_RemoveItemFromInventory`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8` -> `D2UnitStrc* | 0`).
 */
export function INVENTORY_RemoveItemFromInventory113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  const esi = pItem >>> 0
  if (esi === 0 || m.u32(esi) !== UNIT_ITEM) return 0
  if (INVENTORY_IsItemOwnedByInventory113c(m, inv, esi) === 0) return 0
  INVENTORY_RemoveItemInternal113c(m, esi)
  return esi >>> 0
}

// ============================================================================
// Iteration 12 Lane A — I12A-1 (#01..#07) Inventory Ports
// ============================================================================

function readItemGridDimsMem113c(m: Memory113c, pItem: number): readonly [number, number] {
  const pTxt = getItemsTxtRecordInvMem113c(m, m.u32(((pItem >>> 0) + 4) >>> 0))
  if (pTxt === 0) return [0, 0]
  return [m.u8((pTxt + 0x10f) >>> 0), m.u8((pTxt + 0x110) >>> 0)]
}

function getBodyLocItemMem113c(
  m: Memory113c,
  pInventory: number,
  bodyLoc: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const loc = bodyLoc | 0
  if (loc < 0 || loc >= 0x0d) return 0
  const g0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  if (g0 === 0) return 0
  const pp = m.u32((g0 + 0x0c) >>> 0)
  return pp !== 0 ? m.u32((pp + loc * 4) >>> 0) : 0
}

/**
 * `@va D2Common:0x6FD6F980` (`INVENTORY_CanDualWieldItems`,
 * custom LTCG `ebx = pUnit`, `esi = pItem1`, `edi = pItem2`, plain `ret` -> `0 | 1`).
 */
export function INVENTORY_CanDualWieldItems113c(
  m: Memory113c,
  pUnit: number,
  pItem1: number,
  pItem2: number,
): number {
  const esi = pItem1 >>> 0
  const edi = pItem2 >>> 0
  if (esi === 0 || edi === 0) return 1

  const q1 = ITEMS_GetItemTypeQuiverFromItem113c(m, esi)
  if (q1 !== 0 && ITEMS_CheckItemTypeIdMem113c(m, edi, q1) !== 0) return 1

  const q2 = ITEMS_GetItemTypeQuiverFromItem113c(m, edi)
  if (q2 !== 0 && ITEMS_CheckItemTypeIdMem113c(m, esi, q2) !== 0) return 1

  if (ITEMS_GetItemTypeShootsFromItem113c(m, esi) !== 0) return 0
  if (ITEMS_GetItemTypeShootsFromItem113c(m, edi) !== 0) return 0

  const ebx = pUnit >>> 0
  if (ITEMS_GetInvWidthFromItem113c(m, esi) !== 0) {
    if (ITEMS_CanPlayerClassUseItem113c(m, ebx, esi) === 0) return 0
  }
  if (ITEMS_GetInvWidthFromItem113c(m, edi) !== 0) {
    if (ITEMS_CanPlayerClassUseItem113c(m, ebx, edi) === 0) return 0
  }

  if (
    ITEMS_CheckItemTypeIdMem113c(m, esi, 0x2d) === 0 ||
    ITEMS_CheckItemTypeIdMem113c(m, edi, 0x2d) === 0
  ) {
    if (ITEMS_CheckItemTypeIdMem113c(m, esi, 0x2d) !== 0) return 1
    return ITEMS_CheckItemTypeIdMem113c(m, edi, 0x2d) !== 0 ? 1 : 0
  }

  if (ebx === 0) return 0
  const uType = m.u32(ebx)
  if (uType === 1) {
    const baseId = DATATBLS_ValidateMonStatsIdInline113c(m, m.u32((ebx + 4) >>> 0))
    const rel = ((baseId + 0xfffffe5f) | 0) >>> 0
    if (rel > 0x7d) return 0
    if (rel <= 1) {
      return ITEMS_CheckItemTypeIdMem113c(m, esi, 0x43) !== 0 &&
        ITEMS_CheckItemTypeIdMem113c(m, edi, 0x43) !== 0
        ? 1
        : 0
    }
    if (rel >= 0x7b) return 1
    return 0
  }
  if (uType === 0) {
    const cls = m.u32((ebx + 4) >>> 0)
    if (cls === 4) return 1
    if (cls === 6) {
      return ITEMS_CheckItemTypeIdMem113c(m, esi, 0x43) !== 0 &&
        ITEMS_CheckItemTypeIdMem113c(m, edi, 0x43) !== 0
        ? 1
        : 0
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD700D0` (`D2Common.#10842` `INVENTORY_GetBeltAutoPlaceSlot`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `[esp+0xC] = pOutSlot`, `ret 0xC` -> `0 | 1`).
 */
export function INVENTORY_GetBeltAutoPlaceSlot113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  pOutSlot: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  if (ITEMS_IsBeltable113c(m, itm) === 0) return 0

  const [bW, bH] = readItemGridDimsMem113c(m, itm)
  if (bW !== 1 || bH !== 1) return 0

  const pBelt = getBodyLocItemMem113c(m, inv, 8)
  const nBeltType = pBelt !== 0 ? UNITS_GetBeltTypeFromItem113c(m, pBelt) : 2
  const beltBase = m.u32(G_INVENTORY_TXT_TABLE_VA_113C)
  if (((beltBase + imul32(nBeltType | 0, 0x108)) >>> 0) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\InvTbls.cpp', 0x83)
  }
  const nBoxes = m.u8((beltBase + imul32(nBeltType | 0, 0x108) + 0x04) >>> 0)

  const pGrid1 = INVENTORY_GetOrInitGridMem113c(m, inv, 1, D2COMMON_GRID1_INFO_VA_113C)
  if (pGrid1 === 0) return 0
  const ppItems = m.u32((pGrid1 + 0x0c) >>> 0)

  for (let col = 0; col < 4; col++) {
    const baseItem = m.u32((ppItems + col * 4) >>> 0)
    if (baseItem !== 0 && ITEMS_AreStackablesCompatible113c(m, itm, baseItem) !== 0) {
      let slot = col
      while (slot < nBoxes) {
        if (m.u32((ppItems + slot * 4) >>> 0) === 0) {
          m.setU32(pOutSlot >>> 0, slot >>> 0)
          return 1
        }
        slot += 4
      }
    }
  }

  const pTxt = getItemsTxtRecordInvMem113c(m, m.u32((itm + 4) >>> 0))
  if (pTxt !== 0 && m.u8((pTxt + 0x131) >>> 0) !== 0) {
    for (let col = 0; col < 4; col++) {
      if (m.u32((ppItems + col * 4) >>> 0) === 0) {
        m.setU32(pOutSlot >>> 0, col >>> 0)
        return 1
      }
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD70490` (`D2Common.#10605` `INVENTORY_GetSwapWeaponItem`,
 * stdcall `[esp+4] = pPlayer`, `[esp+8] = pInventory`, `[esp+0xC] = ppOtherItemOut`, `[esp+0x10] = nBodyLoc`, `ret 0x10`, void).
 */
export function INVENTORY_GetSwapWeaponItem113c(
  m: Memory113c,
  pPlayer: number,
  pInventory: number,
  ppOtherItemOut: number,
  nBodyLoc: number,
): void {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return
  const handClass = INVENTORY_GetEquippedWeaponHandClass113c(m, pPlayer, inv)
  const is2Hand = (handClass | 0) === 2
  const outPtr = ppOtherItemOut >>> 0
  if (m.u32(outPtr) !== 0) return
  const loc = nBodyLoc | 0
  if (loc < 0 || loc >= 0x0d) return
  const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  if (pGrid0 === 0) return
  if (loc === 4 && is2Hand) {
    m.setU32(outPtr, m.u32((m.u32((pGrid0 + 0x0c) >>> 0) + 0x14) >>> 0))
  } else if (loc === 5 && is2Hand) {
    m.setU32(outPtr, m.u32((m.u32((pGrid0 + 0x0c) >>> 0) + 0x10) >>> 0))
  }
}

/**
 * `@va D2Common:0x6FD708E0` (`D2Common.#10956` `INVENTORY_GetFreePosition`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `[esp+0xC] = nInvRecordId`, `[esp+0x10] = pOutX`, `[esp+0x14] = pOutY`, `[esp+0x18] = nInvPage`, `ret 0x18` -> `0 | 1`).
 */
export function INVENTORY_GetFreePosition113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  nInvRecordId: number,
  pOutX: number,
  pOutY: number,
  nInvPage: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  const pData = m.u32((itm + 0x14) >>> 0)
  if (pData === 0 || ((pData + 0x5c) >>> 0) === 0) return 0

  const [bW, bH] = readItemGridDimsMem113c(m, itm)
  if (bW <= 0 || bH <= 0) return 0

  const [gridW, gridH] = readInvTxtGridDims113c(m, nInvRecordId)
  const pGrid = getOrInitGridWithDims113c(m, inv, (nInvPage & 0xff) + 2, gridW, gridH)
  if (pGrid === 0) return 0

  if (bH === 1) {
    return INVENTORY_FindGridPlacementMode3_113c(m, pGrid, pOutX, pOutY, bW, inv, 1)
  }
  if (bH === 3 && bW <= 2) {
    return INVENTORY_FindGridPlacementMode2_113c(m, pGrid, pOutX, pOutY, bW, inv, 3)
  }
  if (bH === 2 && bW === 2) {
    return INVENTORY_FindGridPlacementMode1_113c(m, pGrid, pOutX, pOutY, 2, inv, 2)
  }
  return INVENTORY_FindGridPlacementMode0_113c(m, pGrid, pOutX, pOutY, bW, inv, bH)
}

/**
 * `@va D2Common:0x6FD717F0` (`D2Common.#10405` `INVENTORY_PlaceItemInSocket`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `[esp+0xC] = _unused`, `ret 0xC` -> `0 | 1`).
 */
export function INVENTORY_PlaceItemInSocket113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  _unused = 0,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pOwner = m.u32((inv + 0x08) >>> 0)
  if (pOwner === 0) return 1
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  if (m.u32(pOwner) !== UNIT_ITEM) return 1
  const pExtra = INVENTORY_GetItemExtraData113c(m, itm)
  if (pExtra === 0) return 0
  INVENTORY_RemoveItemInternal113c(m, itm)
  INVENTORY_LinkItemToInventoryList113c(m, itm, inv)
  const itemIdx = m.u32((inv + 0x28) >>> 0)
  UNITS_SetStaticPathPosX113c(m, itm, itemIdx)
  UNITS_SetStaticPathPosY113c(m, itm, 0)
  m.setU8((pExtra + 0x0c) >>> 0, 0)
  m.setU8((pExtra + 0x0d) >>> 0, 1)
  m.setU32((inv + 0x28) >>> 0, (itemIdx + 1) >>> 0)
  ITEMS_SetCellOverwrite113c(m, itm, 0xffffffff)
  return 1
}

/**
 * `@va D2Common:0x6FD718A0` (`INVENTORY_PlaceItemInGridPage`,
 * custom LTCG `eax = pInventory`, `edi = pItem`, stack `(nX, nY, nGridPage, nInvRecordId)`, `ret 0x10` -> `0 | 1`).
 */
export function INVENTORY_PlaceItemInGridPage113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  nX: number,
  nY: number,
  nGridPage: number,
  nInvRecordId: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  const pData = m.u32((itm + 0x14) >>> 0)
  if (pData === 0) return 0
  const pExtra = (pData + 0x5c) >>> 0
  if (pExtra === 0) return 0

  let [bW, bH] = readItemGridDimsMem113c(m, itm)
  if (bW <= 0 || bH <= 0) return 0

  const page = nGridPage | 0
  const x = nX | 0
  const y = nY | 0
  let pGrid = 0
  if (page >= 2) {
    const [gridW, gridH] = readInvTxtGridDims113c(m, nInvRecordId)
    if (x < 0 || (x + bW) > gridW || y < 0 || (y + bH) > gridH) return 0
    pGrid = getOrInitGridWithDims113c(m, inv, page, gridW, gridH)
  } else {
    bW = 1
    bH = 1
    if (page === 0) {
      pGrid = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
    } else if (page === 1) {
      pGrid = INVENTORY_GetOrInitGridMem113c(m, inv, 1, D2COMMON_GRID1_INFO_VA_113C)
    } else {
      return 0
    }
  }
  if (pGrid === 0) return 0
  if (INVENTORY_IsGridRectEmpty113c(m, pGrid, y, bW, x, bH) === 0) return 0

  if (m.u32((itm + 0x10) >>> 0) === 3 && UNITS_GetRoom113c(m, itm) !== 0) {
    if (((m.u32((itm + 0xc8) >>> 0) >>> 0x1a) & 1) !== 0) {
      DUNGEON_AddRoomPortalNode113c(
        m,
        UNITS_GetRoom113c(m, itm),
        m.u32(itm),
        m.u32((itm + 0x0c) >>> 0),
      )
    }
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, itm)
    UNITROOM_RemoveUnitFromRoom113c(m, itm)
  }

  INVENTORY_RemoveItemInternal113c(m, itm)
  INVENTORY_LinkItemToInventoryList113c(m, itm, inv)
  INVENTORY_LinkItemToGridList113c(m, itm, pGrid, inv)
  INVENTORY_FillGridRect113c(m, bH, y, x, pGrid, bW, itm)

  m.setU8((pExtra + 0x0c) >>> 0, (page + 1) & 0xff)
  m.setU32((inv + 0x28) >>> 0, (m.u32((inv + 0x28) >>> 0) + 1) >>> 0)
  UNITS_SetStaticPathPosX113c(m, itm, x)
  UNITS_SetStaticPathPosY113c(m, itm, y)

  const pOwner = m.u32((inv + 0x08) >>> 0)
  const ownerId =
    pOwner !== 0 && m.u32(pOwner) === 0 ? m.u32((pOwner + 0x0c) >>> 0) : 0xffffffff
  ITEMS_SetCellOverwrite113c(m, itm, ownerId)

  if (page >= 2) {
    ITEMS_SetInvPage113c(m, itm, ((page & 0xff) - 2) & 0xff)
  }

  if (page === 0) {
    m.setU8((pExtra + 0x0d) >>> 0, x >= 0x0b ? 4 : 3)
  } else if (page === 1) {
    m.setU8((pExtra + 0x0d) >>> 0, 2)
  } else {
    m.setU8((pExtra + 0x0d) >>> 0, 1)
  }
  return 1
}

/**
 * `@va D2Common:0x6FD71B40` (`D2Common.#10820` `INVENTORY_FreeInventory`,
 * stdcall `[esp+4] = pInventory`, `ret 4`, void).
 */
export function INVENTORY_FreeInventory113c(m: Memory113c, pInventory: number): void {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return
  const curItem = m.u32((inv + 0x20) >>> 0)
  if (curItem !== 0) {
    INVENTORY_RemoveItemInternal113c(m, curItem)
  }
  while (m.u32((inv + 0x0c) >>> 0) !== 0) {
    INVENTORY_RemoveItemInternal113c(m, m.u32((inv + 0x0c) >>> 0))
  }
  const nGridCount = m.u32((inv + 0x18) >>> 0) | 0
  for (let i = 0; i < nGridCount; i++) {
    const pGrid = (m.u32((inv + 0x14) >>> 0) + i * 0x10) >>> 0
    const ppItems = m.u32((pGrid + 0x0c) >>> 0)
    if (ppItems !== 0) {
      ;(m as { free?: (p: number) => void }).free?.(ppItems)
    }
  }
  const pGrids = m.u32((inv + 0x14) >>> 0)
  if (pGrids !== 0) {
    ;(m as { free?: (p: number) => void }).free?.(pGrids)
  }
  const pOwner = m.u32((inv + 0x08) >>> 0)
  if (pOwner !== 0) {
    m.setU32((pOwner + 0x60) >>> 0, 0)
  }
  let pNode = m.u32((inv + 0x2c) >>> 0)
  while (pNode !== 0) {
    const nextNode = m.u32((pNode + 0x04) >>> 0)
    ;(m as { free?: (p: number) => void }).free?.(pNode)
    pNode = nextNode
  }
  let pCorpse = m.u32((inv + 0x34) >>> 0)
  while (pCorpse !== 0) {
    const nextCorpse = m.u32((pCorpse + 0x0c) >>> 0)
    ;(m as { free?: (p: number) => void }).free?.(pCorpse)
    pCorpse = nextCorpse
  }
  ;(m as { free?: (p: number) => void }).free?.(inv)
}

// ============================================================================
// Iteration 12 Lane A — I12A-2 (#01..#11) Inventory Ports
// ============================================================================

const INV_STACK_SCRATCH_BASE = 0x7fff0000
const INV_STACK_SCRATCH_SIZE = 0x40
const _invStackBuf = new ArrayBuffer(INV_STACK_SCRATCH_SIZE)
const _invStackU8 = new Uint8Array(_invStackBuf)
const _invStackDV = new DataView(_invStackBuf)

function withInvStackScratch113c(m: Memory113c): Memory113c {
  if ((m as { __hasInvStackScratch?: boolean }).__hasInvStackScratch) return m
  const isStack = (p: number): boolean => {
    const u = p >>> 0
    return u >= INV_STACK_SCRATCH_BASE && u < INV_STACK_SCRATCH_BASE + INV_STACK_SCRATCH_SIZE
  }
  const wrapped: Memory113c & { __hasInvStackScratch: boolean; free?: (p: number) => void } = {
    __hasInvStackScratch: true,
    alloc: (size) => m.alloc(size),
    free: (p) => (m as { free?: (addr: number) => void }).free?.(p),
    u8: (p) => (isStack(p) ? _invStackU8[(p >>> 0) - INV_STACK_SCRATCH_BASE]! : m.u8(p)),
    u16: (p) => (isStack(p) ? _invStackDV.getUint16((p >>> 0) - INV_STACK_SCRATCH_BASE, true) : m.u16(p)),
    u32: (p) => (isStack(p) ? _invStackDV.getUint32((p >>> 0) - INV_STACK_SCRATCH_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isStack(p)) _invStackU8[(p >>> 0) - INV_STACK_SCRATCH_BASE] = v & 0xff
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isStack(p)) _invStackDV.setUint16((p >>> 0) - INV_STACK_SCRATCH_BASE, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isStack(p)) _invStackDV.setUint32((p >>> 0) - INV_STACK_SCRATCH_BASE, v >>> 0, true)
      else m.setU32(p, v)
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const addr = (base + f.off + idx * width) >>> 0
      if (isStack(addr)) {
        return width === 1 ? wrapped.u8(addr) : width === 2 ? wrapped.u16(addr) : wrapped.u32(addr)
      }
      return m.get(base, f, idx)
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const addr = (base + f.off + idx * width) >>> 0
      if (isStack(addr)) {
        if (width === 1) wrapped.setU8(addr, v)
        else if (width === 2) wrapped.setU16(addr, v)
        else wrapped.setU32(addr, v)
      } else {
        m.set(base, f, v, idx)
      }
    },
    fill: (p, len, v) => {
      if (isStack(p)) {
        for (let i = 0; i < len; i++) wrapped.setU8((p + i) >>> 0, v)
      } else {
        m.fill(p, len, v)
      }
    },
  }
  return wrapped
}

/**
 * `@va D2Common:0x6FD70A30` (`INVENTORY_ReserveGridFreePosition`,
 * custom LTCG `eax = pInventory`, stack `[esp+4] = pUnit`, `[esp+8] = pItem`, `ret 8` -> `0 | 1`).
 */
export function INVENTORY_ReserveGridFreePosition113c(
  m: Memory113c,
  pInventory: number,
  pUnit: number,
  pItem: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const itm = pItem >>> 0
  const invRecId = UNITS_GetInventoryRecordId113c(m, pUnit, 0, 1)
  const [gridW, gridH] = readInvTxtGridDims113c(m, invRecId)
  const pGrid2 = getOrInitGridWithDims113c(m, inv, 2, gridW, gridH)
  if (pGrid2 === 0) return 0

  const sm = withInvStackScratch113c(m)
  const pOutX = INV_STACK_SCRATCH_BASE
  const pOutY = INV_STACK_SCRATCH_BASE + 4
  if (INVENTORY_GetFreePosition113c(sm, inv, itm, invRecId, pOutX, pOutY, 0) === 0) {
    return 0
  }
  const [bW, bH] = readItemGridDimsMem113c(m, itm)
  if (bW === 0 || bH === 0) return 0
  const outX = sm.u32(pOutX) | 0
  const outY = sm.u32(pOutY) | 0
  const gw = m.u8((pGrid2 + 8) >>> 0)
  const gh = m.u8((pGrid2 + 9) >>> 0)
  if (outX < 0 || (outX + bW) > gw || outY < 0 || (outY + bH) > gh) return 0
  const ppItems = m.u32((pGrid2 + 0x0c) >>> 0)
  for (let y = outY; y < outY + bH; y++) {
    for (let x = outX; x < outX + bW; x++) {
      m.setU32((ppItems + (y * gw + x) * 4) >>> 0, 0xffffffff)
    }
  }
  return 1
}

/**
 * `@va D2Common:0x6FD70B50` (`D2Common.#10489` `INVENTORY_CanBodyLocFitInGrid`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `[esp+0xC] = nBodyLoc`, `[esp+0x10] = nInvRecordId`, `ret 0x10` -> `0 | 1`).
 */
export function INVENTORY_CanBodyLocFitInGrid113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  nBodyLoc: number,
  nInvRecordId: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const loc = nBodyLoc | 0
  if (loc < 0 || loc >= 0x0d) return 0
  const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  if (pGrid0 === 0) return 0
  const pBodyItem = m.u32((m.u32((pGrid0 + 0x0c) >>> 0) + loc * 4) >>> 0)
  if (pBodyItem === 0) return 0
  if ((pItem >>> 0) === 0) return 0
  const sm = withInvStackScratch113c(m)
  return INVENTORY_GetFreePosition113c(
    sm,
    inv,
    pBodyItem,
    nInvRecordId,
    INV_STACK_SCRATCH_BASE,
    INV_STACK_SCRATCH_BASE + 4,
    0,
  ) !== 0
    ? 1
    : 0
}

/**
 * `@va D2Common:0x6FD70D20` (`INVENTORY_CheckGrid2ItemsFitClone`,
 * custom LTCG `eax = pUnit`, `edi = pDstInv`, stack `[esp+4] = pOtherUnit`, `ret 4` -> `0 | 1`).
 */
export function INVENTORY_CheckGrid2ItemsFitClone113c(
  m: Memory113c,
  pUnit: number,
  pDstInv: number,
  pOtherUnit: number,
): number {
  const u = pUnit >>> 0
  const pInv = m.u32((u + 0x60) >>> 0)
  if (pInv === 0 || m.u32(pInv) !== INVENTORY_SIGNATURE_113C) return 1
  let cur = m.u32((pInv + 0x0c) >>> 0)
  while (cur !== 0) {
    let itm = 0
    let next = 0
    if (m.u32(cur) === UNIT_ITEM) {
      itm = cur
      const pData = m.u32((cur + 0x14) >>> 0)
      if (pData !== 0 && ((pData + 0x5c) >>> 0) !== 0) {
        next = m.u32((pData + 0x5c + 0x08) >>> 0)
      }
    }
    if (itm !== 0 && m.u32(itm) === UNIT_ITEM) {
      const pData = m.u32((itm + 0x14) >>> 0)
      if (pData !== 0 && m.u8((pData + 0x45) >>> 0) === 2) {
        if (INVENTORY_ReserveGridFreePosition113c(m, pDstInv, pOtherUnit, itm) === 0) {
          return 0
        }
      }
    }
    cur = next
  }
  return 1
}

/**
 * `@va D2Common:0x6FD70DB0` (`INVENTORY_CanAutoEquipToBodyLoc`,
 * custom LTCG `eax = pItemA`, `ecx = pItemB`, `edx = pItemNew`, stack `[esp+4] = pUnit`, `[esp+8] = nOtherLoc`, `ret 8` -> `0..7`).
 */
export function INVENTORY_CanAutoEquipToBodyLoc113c(
  m: Memory113c,
  pItemA: number,
  pItemB: number,
  pItemNew: number,
  pUnit: number,
  nOtherLoc: number,
): number {
  const u = pUnit >>> 0
  const pInv = m.u32((u + 0x60) >>> 0)
  const itemA = pItemA >>> 0
  const itemB = pItemB >>> 0
  const itemNew = pItemNew >>> 0
  if (itemNew !== 0) {
    if (itemA !== 0) {
      if (ITEMS_AreStackableWeaponsCompatible113c(m, itemA, itemNew) !== 0) {
        return 6
      }
      if (INVENTORY_CanDualWieldItems113c(m, u, itemNew, itemB) !== 0) {
        return 5
      }
      const invRecId = UNITS_GetInventoryRecordId113c(m, u, 0, 1)
      return INVENTORY_CanBodyLocFitInGrid113c(m, pInv, itemNew, nOtherLoc, invRecId) !== 0 ? 7 : 0
    }
    if (itemB !== 0) {
      return INVENTORY_CanDualWieldItems113c(m, u, itemNew, itemB) !== 0 ? 1 : 2
    }
    return 1
  }
  if (itemA !== 0) return 3
  if (
    itemB !== 0 &&
    m.u32(itemB) === UNIT_ITEM &&
    ITEMS_GetInvWidthFromId113c(m, m.u32((itemB + 4) >>> 0)) !== 0
  ) {
    return 4
  }
  return 0
}

/**
 * `@va D2Common:0x6FD711D0` (`D2Common.#10946` `INVENTORY_CanAutoEquipItem`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nBodyLoc`, `[esp+0xC] = pItem`, `[esp+0x10] = bSkipReq`, `ret 0x10` -> `0..7`).
 */
export function INVENTORY_CanAutoEquipItem113c(
  m: Memory113c,
  pUnit: number,
  nBodyLoc: number,
  pItem: number,
  bSkipReq: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pInv = m.u32((u + 0x60) >>> 0)
  if (pInv === 0) return 0
  const itm = pItem >>> 0
  const loc = nBodyLoc >>> 0
  if (itm !== 0) {
    if (ITEMS_CheckBodyLocation113c(m, itm, loc) === 0) return 0
    if ((bSkipReq | 0) === 0 && ITEMS_CheckRequirements113c(m, itm, u, 1, 0, 0, 0) === 0) {
      return 0
    }
  }
  if (loc === 0) return 0
  if (loc === 4 || loc === 5) {
    const otherLoc = loc !== 5 ? 5 : 4
    const pA = getBodyLocItemMem113c(m, pInv, loc)
    const pB = getBodyLocItemMem113c(m, pInv, otherLoc)
    return INVENTORY_CanAutoEquipToBodyLoc113c(m, pA, pB, itm, u, otherLoc)
  }
  if (loc === 11 || loc === 12) {
    const otherLoc = loc !== 12 ? 12 : 11
    const pA = getBodyLocItemMem113c(m, pInv, loc)
    const pB = getBodyLocItemMem113c(m, pInv, otherLoc)
    return INVENTORY_CanAutoEquipToBodyLoc113c(m, pA, pB, itm, u, otherLoc)
  }
  const pExisting = getBodyLocItemMem113c(m, pInv, loc)
  if (itm !== 0) {
    return pExisting !== 0 ? 5 : 1
  }
  return pExisting !== 0 ? 3 : 0
}

/**
 * `@va D2Common:0x6FD71C50` (`D2Common.#10762` `INVENTORY_CanTradeInventoriesSwap`,
 * stdcall `[esp+4] = pMemPool`, `[esp+8] = pUnit1`, `[esp+0xC] = pUnit2`, `[esp+0x10] = pOutFailedSide`, `ret 0x10` -> `0 | 1`).
 */
export function INVENTORY_CanTradeInventoriesSwap113c(
  m: Memory113c,
  pMemPool: number,
  pUnit1: number,
  pUnit2: number,
  pOutFailedSide: number,
): number {
  const pool = pMemPool >>> 0
  const inv1 = m.alloc(0x40)
  if (inv1 !== 0) {
    m.setU32(inv1, INVENTORY_SIGNATURE_113C)
    m.setU32((inv1 + 0x04) >>> 0, pool)
    m.setU32((inv1 + 0x08) >>> 0, 0)
  }
  const inv2 = m.alloc(0x40)
  if (inv2 !== 0) {
    m.setU32((inv2 + 0x04) >>> 0, pool)
    m.setU32(inv2, INVENTORY_SIGNATURE_113C)
    m.setU32((inv2 + 0x08) >>> 0, 0)
  }
  let ok = 0
  const outSide = pOutFailedSide >>> 0
  if (inv1 !== 0 && inv2 !== 0) {
    if (
      INVENTORY_CopyGrid2Cells113c(m, inv1, pUnit1) !== 0 &&
      INVENTORY_CopyGrid2Cells113c(m, inv2, pUnit2) !== 0
    ) {
      if (INVENTORY_CheckGrid2ItemsFitClone113c(m, pUnit1, inv2, pUnit2) === 0) {
        if (outSide !== 0) m.setU32(outSide, 0)
      } else if (INVENTORY_CheckGrid2ItemsFitClone113c(m, pUnit2, inv1, pUnit1) === 0) {
        if (outSide !== 0) m.setU32(outSide, 1)
      } else {
        ok = 1
      }
    }
  }
  INVENTORY_FreeInventory113c(m, inv1)
  INVENTORY_FreeInventory113c(m, inv2)
  return ok
}

/**
 * `@va D2Common:0x6FD71D70` (`INVENTORY_AutoPlaceItemInBeltSlot`,
 * custom LTCG `eax = pInventory`, `edx = pItem`, `ecx = nBeltSlot`, plain `ret` -> `0 | 1`).
 */
export function INVENTORY_AutoPlaceItemInBeltSlot113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  nBeltSlot: number,
): number {
  const inv = pInventory >>> 0
  const itm = pItem >>> 0
  const slot = nBeltSlot | 0
  if (inv === 0 || itm === 0 || m.u32(itm) !== UNIT_ITEM || slot < 0 || slot >= 0x10) {
    return 0
  }
  return INVENTORY_PlaceItemInGridPage113c(m, inv, itm, slot, 0, 1, 0)
}

/**
 * `@va D2Common:0x6FD71DA0` (`D2Common.#11041` `INVENTORY_PlaceItemInBodyLoc`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `[esp+0xC] = nBodyLoc`, `ret 0xC` -> `0 | 1`).
 */
export function INVENTORY_PlaceItemInBodyLoc113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  nBodyLoc: number,
): number {
  const inv = pInventory >>> 0
  const loc = nBodyLoc | 0
  if (inv === 0 || loc < 0 || loc >= 0x0d) return 0
  return INVENTORY_PlaceItemInGridPage113c(m, inv, pItem, loc, 0, 0, 0)
}

/**
 * `@va D2Common:0x6FD71DD0` (`D2Common.#11107` `INVENTORY_PlaceItemInGridCell`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `[esp+0xC] = nX`, `[esp+0x10] = nY`, `[esp+0x14] = nInvRecordId`, `[esp+0x18] = _unused`, `[esp+0x1C] = nPage`, `ret 0x1C` -> `0 | 1`).
 */
export function INVENTORY_PlaceItemInGridCell113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  nX: number,
  nY: number,
  nInvRecordId: number,
  _unused = 0,
  nPage = 0,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  return INVENTORY_PlaceItemInGridPage113c(
    m,
    inv,
    pItem,
    nX,
    nY,
    ((nPage & 0xff) + 2) | 0,
    nInvRecordId,
  )
}

/**
 * `@va D2Common:0x6FD71E10` (`D2Common.#10133` `INVENTORY_AutoPlaceItemInGrid`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `[esp+0xC] = nInvRecordId`, `[esp+0x10] = _unused0`, `[esp+0x14] = nPage`, `[esp+0x18] = _unused1`, `[esp+0x1C] = _unused2`, `ret 0x1C` -> `0 | 1`).
 */
export function INVENTORY_AutoPlaceItemInGrid113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
  nInvRecordId: number,
  _unused0 = 0,
  nPage = 0,
  _unused1 = 0,
  _unused2 = 0,
): number {
  const inv = pInventory >>> 0
  if (inv === 0) return 0
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  const sm = withInvStackScratch113c(m)
  const pOutX = INV_STACK_SCRATCH_BASE
  const pOutY = INV_STACK_SCRATCH_BASE + 4
  if (INVENTORY_GetFreePosition113c(sm, inv, itm, nInvRecordId, pOutX, pOutY, nPage) === 0) {
    return 0
  }
  return INVENTORY_PlaceItemInGridPage113c(
    m,
    inv,
    itm,
    sm.u32(pOutX),
    sm.u32(pOutY),
    ((nPage & 0xff) + 2) | 0,
    nInvRecordId,
  )
}

/**
 * `@va D2Common:0x6FD71E80` (`D2Common.#10729` `INVENTORY_AutoPlaceItemInBelt`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pItem`, `ret 8` -> `0 | 1`).
 */
export function INVENTORY_AutoPlaceItemInBelt113c(
  m: Memory113c,
  pInventory: number,
  pItem: number,
): number {
  const inv = pInventory >>> 0
  const itm = pItem >>> 0
  const sm = withInvStackScratch113c(m)
  const pOutSlot = INV_STACK_SCRATCH_BASE
  sm.setU32(pOutSlot, 0)
  if (INVENTORY_GetBeltAutoPlaceSlot113c(sm, inv, itm, pOutSlot) === 0) return 0
  if (inv === 0 || itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0
  const slot = sm.u32(pOutSlot) | 0
  if (slot < 0 || slot >= 0x10) return 0
  return INVENTORY_PlaceItemInGridPage113c(m, inv, itm, slot, 0, 1, 0)
}

// ============================================================================
// Iteration 13 Lane A — I13A-1 (#01..#05) Inventory Ports
// ============================================================================

function inventoryGetWeaponByHandSlotInvMem113c(
  m: Memory113c,
  pInventory: number,
  nHandSlot: number,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pGrid = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  if (pGrid === 0) return 0
  const pComp = INVENTORY_GetCompositWeaponMem113c(m, inv)
  const slot = nHandSlot | 0
  const ppItems = m.u32((pGrid + 0x0c) >>> 0)
  for (let off = 0; off < 0x2c; off += 4) {
    const pItem = m.u32((ppItems + off) >>> 0)
    if (pItem === 0) continue
    const wClassIdx = ITEMS_GetWeaponClassCodeIdx113c(m, pItem) & 0xffff
    if (wClassIdx === 2 || wClassIdx === 3 || wClassIdx === 0x0c) {
      if (slot === 6) {
        if (pItem !== pComp) return pItem
      } else if (slot === 5) {
        if (pItem === pComp) return pItem
      }
    } else {
      const compByte = ITEMS_GetComponentFromItem113c(m, pItem) & 0xff
      if (compByte === slot) return pItem
    }
  }
  return 0
}

function getNextGridItemInvMem113c(m: Memory113c, pItem: number): number {
  if (pItem === 0 || m.u32(pItem) !== UNIT_ITEM) return 0
  const pData = m.u32((pItem + 0x14) >>> 0)
  if (pData === 0) return 0
  return m.u32((pData + 0x5c + 0x14) >>> 0)
}

/**
 * `@va D2Common:0x6FD70BC0` (`D2Common.#10964` `INVENTORY_FindReagentForTome`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pMatchTome`, `[esp+0xC] = pStartAfterItem`, `ret 0xC` -> `pItem | 0`).
 */
export function INVENTORY_FindReagentForTome113c(
  m: Memory113c,
  pInventory: number,
  pMatchTome: number,
  pStartAfterItem = 0,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pOwner = m.u32((inv + 0x08) >>> 0)
  let pGrid2 = 0
  if (pOwner !== 0 && m.u32(pOwner) === 0) {
    const recId = UNITS_GetInventoryRecordId113c(m, pOwner, 0, 1)
    const [gx, gy] = readInvTxtGridDims113c(m, recId)
    pGrid2 = getOrInitGridWithDims113c(m, inv, 2, gx, gy)
  } else {
    pGrid2 = INVENTORY_GetOrInitGridMem113c(m, inv, 2, 0)
  }
  if (pGrid2 === 0) return 0

  let cur = m.u32(pGrid2)
  const startItem = pStartAfterItem >>> 0
  if (startItem !== 0) {
    while (cur !== 0 && cur !== startItem) {
      cur = getNextGridItemInvMem113c(m, cur)
    }
    if (cur === 0) return 0
  }

  const matchTome = pMatchTome >>> 0
  let matchSuffix = 0
  if (matchTome !== 0 && m.u32(matchTome) === UNIT_ITEM) {
    const pMatchData = m.u32((matchTome + 0x14) >>> 0)
    if (pMatchData !== 0) {
      matchSuffix = m.u16((pMatchData + 0x3e) >>> 0)
    }
  }

  while (cur !== 0 && m.u32(cur) === UNIT_ITEM) {
    const type0 = ITEMS_IsTome113c(m, m.u32((cur + 4) >>> 0)) | 0
    if (type0 === 0x12) {
      const pCurData = m.u32((cur + 0x14) >>> 0)
      const curSuffix = pCurData !== 0 ? m.u16((pCurData + 0x3e) >>> 0) : 0
      if (curSuffix === matchSuffix) {
        let qty = 0
        const pEx = m.u32((cur + 0x5c) >>> 0)
        if (pEx !== 0) {
          const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
          if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x46) {
            const pIscBase = m.u32((sgpt + 0xbcc) >>> 0)
            const pIsc46 = (pIscBase + 0x5898) >>> 0
            if (pIsc46 !== 0) {
              qty = getTotalStatWithMinFromList113c(m, pEx, 0x00460000, pIsc46) | 0
            }
          }
        }
        const maxQty = ITEMS_GetTotalMaxStack113c(m, cur) | 0
        if (qty < maxQty) {
          return cur >>> 0
        }
      }
    }
    cur = getNextGridItemInvMem113c(m, cur)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD70E80` (internal LTCG `INVENTORY_UpdateQuiverComponentDisplay`,
 * custom reg `ecx = pPlayer`, `ebx = pItem`, stack `[esp+4] = pCompArr1`, `[esp+8] = pCompArr2`, `ret 8`, void).
 */
export function INVENTORY_UpdateQuiverComponentDisplay113c(
  m: Memory113c,
  pPlayer: number,
  pItem: number,
  pCompArr1: number,
  pCompArr2: number,
): void {
  const player = pPlayer >>> 0
  if (player === 0) {
    throw new D2CommonAssertError('Inventory.cpp', 0x13b4)
  }
  const itm = pItem >>> 0
  if (itm === 0) {
    throw new D2CommonAssertError('Inventory.cpp', 0x13b5)
  }
  if (m.u32(itm) !== UNIT_ITEM) return
  const pItemData = m.u32((itm + 0x14) >>> 0)
  if (pItemData === 0) return
  const bodyLoc = m.u8((pItemData + 0x44) >>> 0)
  if (bodyLoc !== 4 && bodyLoc !== 5) return

  const pInv = m.u32((player + 0x60) >>> 0)
  const sm = withInvStackScratch113c(m)
  const weapCode = COMPOSIT_GetUnitWeaponClassCode113c(
    sm,
    player,
    pInv,
    INV_STACK_SCRATCH_BASE,
    -1,
    1,
  ) >>> 0
  const comp = ITEMS_GetComponentFromItem113c(m, itm) & 0xff
  const arr1 = pCompArr1 >>> 0
  const arr2 = pCompArr2 >>> 0

  if (weapCode === 0x20776278 /* 'xbw ' */) {
    if (comp !== 5 && comp !== 6) return
    if (pInv === 0) return
    const pOffhand = inventoryGetWeaponByHandSlotInvMem113c(m, pInv, 5)
    if (pOffhand === 0) return
    const pTxt = getItemsTxtRecordInvMem113c(m, m.u32((pOffhand + 4) >>> 0))
    if (pTxt === 0) {
      throw new D2CommonAssertError('Inventory.cpp', 0x13d0)
    }
    const gfx = INVENTORY_FindItemGfxCodeIndex113c(
      m,
      m.u32((pTxt + 0x80) >>> 0),
      m.u32((pTxt + 0x90) >>> 0),
    ) | 0
    if (gfx <= 0) {
      m.setU8((arr1 + 6) >>> 0, 0xff)
      m.setU8((arr2 + 6) >>> 0, 0xff)
    } else {
      m.setU8((arr1 + 6) >>> 0, gfx & 0xff)
    }
  } else if (weapCode === 0x20776f62 /* 'bow ' */ && comp === 6) {
    const pTxt = DATATBLS_GetItemsTxtRecordByCode113c(
      sm,
      0x2074696c /* 'lit ' */,
      INV_STACK_SCRATCH_BASE,
    )
    if (pTxt === 0) return
    const gfx = INVENTORY_FindItemGfxCodeIndex113c(
      m,
      m.u32((pTxt + 0x80) >>> 0),
      m.u32((pTxt + 0x90) >>> 0),
    ) | 0
    if (gfx === 0) {
      m.setU8((arr1 + 5) >>> 0, 0xff)
      m.setU8((arr2 + 5) >>> 0, 0xff)
    } else {
      m.setU8((arr1 + 5) >>> 0, gfx & 0xff)
    }
  }
}

/**
 * `@va D2Common:0x6FD70FD0` (`D2Common.#10643` `INVENTORY_FindStackableCompatItemInGrid0`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pMatchItem`, `[esp+0xC] = pStartAfterItem`, `ret 0xC` -> `pItem | 0`).
 */
export function INVENTORY_FindStackableCompatItemInGrid0_113c(
  m: Memory113c,
  pInventory: number,
  pMatchItem: number,
  pStartAfterItem = 0,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, inv, 0, D2COMMON_GRID0_INFO_VA_113C)
  if (pGrid0 === 0) return 0

  let cur = m.u32(pGrid0)
  const startItem = pStartAfterItem >>> 0
  if (startItem !== 0) {
    while (cur !== 0 && cur !== startItem) {
      cur = getNextGridItemInvMem113c(m, cur)
    }
    if (cur === 0) return 0
  }

  const matchItem = pMatchItem >>> 0
  while (cur !== 0) {
    if (ITEMS_AreStackableWeaponsCompatible113c(m, cur, matchItem) !== 0) {
      let qty = 0
      const pEx = m.u32((cur + 0x5c) >>> 0)
      if (pEx !== 0) {
        const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
        if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x46) {
          const pIscBase = m.u32((sgpt + 0xbcc) >>> 0)
          const pIsc46 = (pIscBase + 0x5898) >>> 0
          if (pIsc46 !== 0) {
            qty = getTotalStatWithMinFromList113c(m, pEx, 0x00460000, pIsc46) | 0
          }
        }
      }
      const maxQty = ITEMS_GetTotalMaxStack113c(m, cur) | 0
      if (qty < maxQty) {
        return cur >>> 0
      }
    }
    cur = getNextGridItemInvMem113c(m, cur)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD710B0` (`D2Common.#10836` `INVENTORY_FindStackableCompatItemInBelt`,
 * stdcall `[esp+4] = pInventory`, `[esp+8] = pMatchItem`, `[esp+0xC] = pStartAfterItem`, `ret 0xC` -> `pItem | 0`).
 * Note: despite the legacy export name, `0x6FD710B0` initializes grid 2 (backpack/storage), matching `0x6FD70BC0`.
 */
export function INVENTORY_FindStackableCompatItemInBelt113c(
  m: Memory113c,
  pInventory: number,
  pMatchItem: number,
  pStartAfterItem = 0,
): number {
  const inv = pInventory >>> 0
  if (inv === 0 || m.u32(inv) !== INVENTORY_SIGNATURE_113C) return 0
  const pOwner = m.u32((inv + 0x08) >>> 0)
  let pGrid2 = 0
  if (pOwner !== 0 && m.u32(pOwner) === 0) {
    const recId = UNITS_GetInventoryRecordId113c(m, pOwner, 0, 1)
    const [gx, gy] = readInvTxtGridDims113c(m, recId)
    pGrid2 = getOrInitGridWithDims113c(m, inv, 2, gx, gy)
  } else {
    pGrid2 = INVENTORY_GetOrInitGridMem113c(m, inv, 2, 0)
  }
  if (pGrid2 === 0) return 0

  let cur = m.u32(pGrid2)
  const startItem = pStartAfterItem >>> 0
  if (startItem !== 0) {
    while (cur !== 0 && cur !== startItem) {
      cur = getNextGridItemInvMem113c(m, cur)
    }
    if (cur === 0) return 0
  }

  const matchItem = pMatchItem >>> 0
  while (cur !== 0) {
    if (ITEMS_AreStackableWeaponsCompatible113c(m, cur, matchItem) !== 0) {
      let qty = 0
      const pEx = m.u32((cur + 0x5c) >>> 0)
      if (pEx !== 0) {
        const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
        if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x46) {
          const pIscBase = m.u32((sgpt + 0xbcc) >>> 0)
          const pIsc46 = (pIscBase + 0x5898) >>> 0
          if (pIsc46 !== 0) {
            qty = getTotalStatWithMinFromList113c(m, pEx, 0x00460000, pIsc46) | 0
          }
        }
      }
      const maxQty = ITEMS_GetTotalMaxStack113c(m, cur) | 0
      if (qty < maxQty) {
        return cur >>> 0
      }
    }
    cur = getNextGridItemInvMem113c(m, cur)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD96600` (`D2Common.#10699` `INVENTORY_FindEquippedSkillChargeItem`,
 * stdcall `[esp+4] = pItem`, `[esp+8] = nSkillId`, `[esp+0xC] = nLevel`, `[esp+0x10] = pOutCharges`,
 * `[esp+0x14] = pOutStatList`, `ret 0x14` -> `0 | 1`).
 */
export function INVENTORY_FindEquippedSkillChargeItem113c(
  m: Memory113c,
  pItem: number,
  nSkillId: number,
  nLevel: number,
  pOutCharges: number,
  pOutStatList: number,
): number {
  const outCharges = pOutCharges >>> 0
  const outStatList = pOutStatList >>> 0
  if (outCharges !== 0) {
    m.setU32(outCharges, 0)
  }
  if (outStatList !== 0) {
    m.setU32(outStatList, 0)
  }
  const itm = pItem >>> 0
  if (itm === 0 || m.u32(itm) !== UNIT_ITEM) return 0

  const skId = nSkillId | 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (skId < 0 || skId >= (m.u32((sgpt + 0xba0) >>> 0) | 0)) return 0
  const lvl = nLevel | 0
  if (lvl <= 0 || lvl > 0x3f) return 0

  const shift = m.u32((sgpt + 0xc6c) >>> 0) & 0x1f
  const mask = m.u32((sgpt + 0xc70) >>> 0)
  const packed = ((skId << shift) + (mask & lvl)) & 0xffff
  const dwKey = (0x00cc0000 + packed) >>> 0

  let pStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, itm, 0x40)
  while (pStatList !== 0) {
    if ((m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0xcc) {
      const pIscBase = m.u32((sgpt + 0xbcc) >>> 0)
      const pIsc204 = (pIscBase + 0x10230) >>> 0
      if (pIsc204 !== 0) {
        const val = getBaseStatWithMinFromList113c(m, pStatList, dwKey, pIsc204)
        if (val !== 0) {
          if (outCharges !== 0) {
            m.setU32(outCharges, val & 0xff)
          }
          if (outStatList !== 0) {
            m.setU32(outStatList, pStatList >>> 0)
          }
          return 1
        }
      }
    }
    let pParent = m.u32((pStatList + 0x2c) >>> 0)
    while (pParent !== 0 && (m.u32((pParent + 0x10) >>> 0) & 0x40) === 0) {
      pParent = m.u32((pParent + 0x2c) >>> 0)
    }
    pStatList = pParent
  }

  const pInv = m.u32((itm + 0x60) >>> 0)
  if (pInv === 0) return 0
  let pSock = INVENTORY_GetFirstItem113c(m, pInv)
  while (pSock !== 0) {
    const sockUnit = m.u32(pSock) === UNIT_ITEM ? pSock : 0
    if (
      INVENTORY_FindEquippedSkillChargeItem113c(
        m,
        sockUnit,
        skId,
        lvl,
        outCharges,
        outStatList,
      ) !== 0
    ) {
      return 1
    }
    pSock = INVENTORY_GetNextItem113c(m, pSock)
  }
  return 0
}

/**
 * `D2Common.dll` `0x6FD71300` (internal `__stdcall(pUnit, pOutComp, pOutColor, pItem)`).
 */
export function INVENTORY_UpdateItemBodyLocGfx113c(
  m: Memory113c,
  pUnit: number,
  pOutComp: number,
  pOutColor: number,
  pItem: number,
): void {
  const unit = pUnit >>> 0
  const pInv = m.u32((unit + 0x60) >>> 0)
  if (pInv === 0) return
  const pRight = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, 5)
  const pLeft = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, 6)
  const item = pItem >>> 0
  const classId = item !== 0 ? (m.u32((item + 0x04) >>> 0) >>> 0) : 0xffffffff
  const maxItems = m.u32(0x6fdefb94) >>> 0
  const pItemsTxt = m.u32(0x6fdefb98)
  if (classId >= maxItems) {
    throw new D2CommonAssertError('', 0x140d)
  }
  if (pItemsTxt === 0) {
    throw new D2CommonAssertError('', 0x1ef)
  }
  const pTxt = (pItemsTxt + imul32(classId | 0, 0x1a8)) >>> 0
  let compIdx = ITEMS_GetComponentFromItem113c(m, item) & 0xff
  const dwCode = m.u32((pTxt + 0x80) >>> 0)
  const dwAltGfx = m.u32((pTxt + 0x90) >>> 0)
  const gfxCode = INVENTORY_FindItemGfxCodeIndex113c(m, dwCode, dwAltGfx) & 0xff
  const outComp = pOutComp >>> 0
  const outColor = pOutColor >>> 0

  if (gfxCode === 0) {
    if (compIdx < 0x10) {
      m.setU8((outComp + compIdx) >>> 0, 0xff)
      m.setU8((outColor + compIdx) >>> 0, 0xff)
    }
    return
  }

  if (item === pRight) {
    compIdx = 5
  } else if (item === pLeft) {
    compIdx = 6
  } else if (compIdx >= 0x10) {
    return
  }

  m.setU8((outComp + compIdx) >>> 0, gfxCode)
  INVENTORY_UpdateQuiverComponentDisplay113c(m, unit, item, outComp, outColor)
  const colorPtr = (outColor + compIdx) >>> 0
  if (ITEMS_GetItemColorColormap113c(m, unit, item, colorPtr, 0) === 0) {
    m.setU8(colorPtr, 0xff)
  } else {
    m.setU8(colorPtr, (m.u8(colorPtr) + 1) & 0xff)
  }
}

/**
 * `D2Common.dll` `0x6FD71420` (Ord `10457`, `__stdcall(pUnit, pOutComp, pOutColor)`).
 */
export function INVENTORY_UpdateEquippedGfxAndColor113c(
  m: Memory113c,
  pUnit: number,
  pOutComp: number,
  pOutColor: number,
): void {
  const unit = pUnit >>> 0
  const pInv = m.u32((unit + 0x60) >>> 0)
  if (pInv === 0 || m.u32(pInv) !== 0x01020304) return

  let pItem = m.u32((pInv + 0x0c) >>> 0)
  if (pItem === 0) return

  const outComp = pOutComp >>> 0
  const outColor = pOutColor >>> 0
  const compDelta = ((outComp - outColor) | 0)

  while (pItem !== 0) {
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if (m.u32(pItem) === 4 && m.u32((pItem + 0x10) >>> 0) === 1) {
      const classId = m.u32((pItem + 0x04) >>> 0) >>> 0
      if (classId >= (m.u32(0x6fdefb94) >>> 0)) {
        throw new D2CommonAssertError('', 0x1447)
      }
      const pItemsTxt = m.u32(0x6fdefb98)
      if (pItemsTxt === 0) {
        throw new D2CommonAssertError('', 0x1ef)
      }
      const pTxt = (pItemsTxt + imul32(classId | 0, 0x1a8)) >>> 0
      const pItemData = m.u32((pItem + 0x14) >>> 0)
      if (pItemData !== 0) {
        const page = m.u8((pItemData + 0x44) >>> 0)
        if (page === 3) {
          const sm = withInvStackScratch113c(m)
          const pLimits6 = (INV_STACK_SCRATCH_BASE + 0x20) >>> 0
          INVENTORY_GetItemSaveGridPageLimits113c(sm, pItem, pLimits6)
          for (let slot = 0; slot < 0x10; slot++) {
            if (slot === 1 || slot === 2 || slot === 3 || slot === 4 || slot === 8 || slot === 9) {
              const pageLimit = COMPOSIT_GetItemPageLimitByBodyLoc113c(sm, slot, pLimits6) | 0
              const pComposit = (m.u32(0x6fdf13d4) + imul32(pageLimit, 0x34)) >>> 0
              if (pComposit === 0) {
                throw new D2CommonAssertError('', 0x150)
              }
              const gfxCode =
                (m.u32((pItem + 0x04) >>> 0) | 0) > 0
                  ? (INVENTORY_FindItemGfxCodeIndex113c(
                      m,
                      m.u32((pComposit + 0x20) >>> 0),
                      m.u32((pComposit + 0x20) >>> 0),
                    ) &
                    0xff)
                  : 0
              const dstColor = (outColor + slot) >>> 0
              const dstComp = (dstColor + compDelta) >>> 0
              if (gfxCode !== 0) {
                m.setU8(dstComp, gfxCode)
                if (ITEMS_GetItemColorColormap113c(m, unit, pItem, dstColor, 0) === 0) {
                  m.setU8(dstColor, 0xff)
                } else {
                  m.setU8(dstColor, (m.u8(dstColor) + 1) & 0xff)
                }
              } else {
                m.setU8(dstComp, 0xff)
                m.setU8(dstColor, 0xff)
              }
            }
          }
        } else if (page === 1 || page === 4 || page === 5) {
          const wType = (m.u16((pTxt + 0x11e) >>> 0) << 16) >> 16
          let isQuiver = false
          if (wType >= 0) {
            const nTypes = m.u32((sgpt + 0xbfc) >>> 0) | 0
            if (wType < nTypes && nTypes > 0x4b) {
              const stride = m.u32((sgpt + 0xc00) >>> 0) | 0
              const pEquiv = m.u32((sgpt + 0xc04) >>> 0)
              const eqVal = m.u32((pEquiv + imul32(wType, stride) * 4 + 0x08) >>> 0)
              const bitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
              if ((eqVal & m.u32((bitMasks + 0x2c) >>> 0)) !== 0) {
                isQuiver = true
              }
            }
          }
          if (!isQuiver) {
            INVENTORY_UpdateItemBodyLocGfx113c(m, unit, outComp, outColor, pItem)
          }
        }
      }
    }
    if (m.u32(pItem) !== 4) break
    const pItemData = m.u32((pItem + 0x14) >>> 0)
    if (pItemData === 0) break
    pItem = m.u32((pItemData + 0x5c + 0x08) >>> 0)
  }
}




