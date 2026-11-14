/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 1 (`Lane K2-I`) routines across
 * `0x6FC2DE20..0x6FC42B10` (`SKILLS` think-event reset, `ITEMS` drop timeout /
 * diminishing MF / inventory lookup / affix reset / unique spawn bitmask /
 * vendor potion codes / quest item search / base weapon stats / bitstream decode /
 * spawnable filter / sub-inventory teardown / parameterized spawn, `AI` scan
 * callbacks & turret/trap/guard thinkers, `MONREG` inactive monster list
 * management, `AIGENERAL` minion pack lifecycle, and `MONUMOD` boss modifiers).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import { DRLG_ResolveMonsterSubClassIdForRoom113c } from '../common/drlg/drlg-ver.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DRLGPRESET_FreeSaveHeaderBlock113c } from '../common/drlg/preset.ts'
import {
  DUNGEON_FindRoomBySubtileCoordinates113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetLevelIdIfNotHidden113c,
} from '../common/dungeon.ts'
import { imul32, sdiv32 } from '../common/int-math.ts'
import {
  INVENTORY_FreeInventory113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts'
import {
  ITEMS_CheckIfSocketFiller113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetComponentByte113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetMagicSuffix113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
} from '../common/items.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { PATH_SetStepNum113c } from '../common/path.ts'
import {
  ITEMS_LoadStatsFromBitstream113c,
  ITEMS_SetItemCell113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  UNIT_GetAlignment113c,
  UNITS_AreUnitsAligned113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SEED_InitLowSeed113c, seedRoll } from '../prng.ts'
import { MONSTERS_IsDead113c } from '../tables/datatbls-113c.ts'
import { DATATBLS_GetItemDataTables113c } from '../tables/item-tbls-113c.ts'
import {
  SUNIT_ClearUnitInventoryItems113c,
  type Post150LaneI1Hooks113c,
} from './a1c-post150-f150-f276-113c.ts'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c.ts'
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  MONSTER_CheckTypeFlagsMask113c,
  type AiFallenHooks113c,
} from './ai-fallen-113c.ts'
import { MONREG_FindOrAllocActRoomNode113c } from './boot-init-gap-a-113c.ts'
import {
  AI_FindNearestPlayerOrAlly113c,
  AI_IdleWander113c,
  AI_Stall113c,
  ITEMS_FinalizeCreatedItem113c,
  ITEMS_GetDropItemLevel113c,
  ITEMS_GetQualityBonusDivisor113c,
  ITEMS_GetQualityMinValue113c,
  MONSTER_StartMode113c,
} from './combat-a1c-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import { SUNIT_IsDeadOrDying113c } from './monster-events.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_SpawnPartyMinionInRing113c,
  MONSTATS2_GetRecordPtr113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SUNIT_AllocUnitData113c,
  UNIT_CalcSqDistSubtiles113c,
} from './regpop-spawn-113c.ts'
import { SUNIT_FreeUnit113c } from './replay-final11-113c.ts'
import {
  AI_ApproachTarget113c,
  AI_IdleWander113c as AI_IdleWanderWorld113c,
  AI_Stall113c as AI_StallWorld113c,
  MONSTER_StartMode113c as MONSTER_StartModeWorld113c,
  type FallenSliceWorld113c,
} from './replay-kernel-113c.ts'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'

/**
 * `D2Game.dll` `.data` `0x6FD2F870..0x6FD2F87F` (`count = 4` at `0x6FD2F86C`):
 * vendor mana potion fourcc codes (`'mp1 '`, `'mp2 '`, `'mp3 '`, `'mp4 '`).
 */
const VENDOR_MANA_POTION_CODES: readonly number[] = [
  0x2031706d,
  0x2032706d,
  0x2033706d,
  0x2034706d,
]

/**
 * `D2Game.dll` `.data` `0x6FD2F884..0x6FD2F893` (`count = 4` at `0x6FD2F880`):
 * vendor healing potion fourcc codes (`'hp1 '`, `'hp2 '`, `'hp3 '`, `'hp4 '`).
 */
const VENDOR_HEALTH_POTION_CODES: readonly number[] = [
  0x20317068,
  0x20327068,
  0x20337068,
  0x20347068,
]

let k2LaneIStackPtr = 0x7ef80000

export type PackMemberCallbackFn113c = (
  m: Memory113c,
  pMemberUnit: number,
  pArg1: number,
  pArg2: number,
) => void

export interface LaneIHooks113c extends AiFallenHooks113c, Post150LaneI1Hooks113c {
  onCreateItemEx?: (
    m: Memory113c,
    pGame: number,
    pItemDrop: number,
    bSendClient: number,
  ) => number
  onFreePoolMem?: (
    m: Memory113c,
    pMemPool: number,
    pMem: number,
    nLine: number,
  ) => void
  onPackMemberCallback?: (
    m: Memory113c,
    callbackVa: number,
    pMemberUnit: number,
    pArg1: number,
    pArg2: number,
  ) => void
  pActMonReg?: number
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function stepSeed64At(m: Memory113c, pSeed: number): number {
  const addr = pSeed >>> 0
  const lo = m.u32(addr) >>> 0
  const hi = m.u32((addr + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 4) >>> 0, newHi)
  m.setU32(addr, newLo)
  return newLo
}

function rollUnitSeedLimited(m: Memory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  const seed = {
    lo: m.u32(addr) >>> 0,
    hi: m.u32((addr + 4) >>> 0) >>> 0,
  }
  const res = seedRoll(seed, nMax) | 0
  m.setU32(addr, seed.lo >>> 0)
  m.setU32((addr + 4) >>> 0, seed.hi >>> 0)
  return res
}

function findMonsterInGameHash(m: Memory113c, pGame: number, dwUnitId: number): number {
  const guid = dwUnitId >>> 0
  const bucket = guid & 0x7f
  let pNode = m.u32((pGame + bucket * 4 + 0x1320) >>> 0) >>> 0
  while (pNode !== 0) {
    if ((m.u32((pNode + 0x0c) >>> 0) >>> 0) === guid) {
      return pNode
    }
    pNode = m.u32((pNode + 0xe4) >>> 0) >>> 0
  }
  return 0
}

function resolveMonsterAttackPathByte15(m: Memory113c, pMonster: number): number {
  if ((pMonster >>> 0) === 0) return 0x64
  const classId = m.u32((pMonster + 0x04) >>> 0) | 0
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, classId) >>> 0
  if (pMonStats2 === 0) return 0x64
  const flagsByte = m.u8((pMonStats2 + 0x104) >>> 0)
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask4 = m.u32((pBitMasks + 0x10) >>> 0)
  return (flagsByte & mask4) !== 0 ? 0x65 : 0x64
}

function executeMonsterModeTransition(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  mode: number,
  pTarget: number,
  byte15: number,
  world?: FallenSliceWorld113c,
  hooks?: LaneIHooks113c,
): number {
  const savedSp = k2LaneIStackPtr
  const pModeArgs = savedSp
  k2LaneIStackPtr = (savedSp + 0x20) >>> 0
  try {
    m.fill(pModeArgs, 0x20, 0)
    m.setU32(pModeArgs, mode >>> 0)
    m.setU32((pModeArgs + 0x04) >>> 0, pMonster >>> 0)
    m.setU32((pModeArgs + 0x08) >>> 0, pTarget >>> 0)
    m.setU8((pModeArgs + 0x15) >>> 0, byte15 & 0xff)
    if (hooks !== undefined && hooks.onMonsterStartMode !== undefined) {
      return hooks.onMonsterStartMode(m, pGame, pModeArgs, 1) | 0
    }
    if (world !== undefined) {
      return MONSTER_StartModeWorld113c(world, pMonster, mode, pTarget, 0, 0) ? 1 : 0
    }
    return MONSTER_StartMode113c(m, pGame, pMonster, mode, pTarget, 0, 0) | 0
  } finally {
    k2LaneIStackPtr = savedSp
  }
}

function executeAiStall(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  nDelay: number,
  world?: FallenSliceWorld113c,
): void {
  if (world !== undefined) {
    AI_StallWorld113c(world, pMonster, nDelay)
    return
  }
  AI_Stall113c(m, pGame, pMonster, nDelay)
}

function executeAiApproachTarget(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pTarget: number,
  mode: number,
  targetX: number,
  targetY: number,
  stepNum: number,
  flags: number,
  world?: FallenSliceWorld113c,
): number {
  if (world !== undefined) {
    return AI_ApproachTarget113c(world, pMonster, pTarget, mode, targetX, targetY, stepNum, flags) ? 1 : 0
  }
  let actualMode = mode | 0
  if (actualMode === 15 && STATES_CheckState113c(m, pMonster, 0x3c) !== 0) {
    if ((pMonster >>> 0) !== 0 && m.u32(pMonster >>> 0) === 1) {
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      const pAiCtrl = pMonData !== 0 ? m.u32((pMonData + 0x2c) >>> 0) >>> 0 : 0
      if (pAiCtrl !== 0) {
        m.setU32((pAiCtrl + 0x18) >>> 0, 0)
        m.setU32((pAiCtrl + 0x1c) >>> 0, 0)
        m.setU8((pAiCtrl + 0x20) >>> 0, 0)
      }
    }
    actualMode = 2
  }
  const pPath = (pMonster >>> 0) !== 0 ? m.u32((pMonster + 0x2c) >>> 0) >>> 0 : 0
  if (pPath !== 0) {
    PATH_SetStepNum113c(m, pPath, stepNum)
  }
  const ok = MONSTER_StartMode113c(m, pGame, pMonster, actualMode, pTarget, targetX, targetY) | 0
  if (ok === 0) {
    if ((flags & 4) !== 0) {
      EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, 2, 0)
    }
    if ((flags & 1) !== 0 && (pMonster >>> 0) !== 0 && m.u32(pMonster >>> 0) === 1) {
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
      if (pAiGen !== 0) {
        m.setU16((pAiGen + 0x08) >>> 0, (m.u16((pAiGen + 0x08) >>> 0) | 0x40) & 0xffff)
      }
    }
    if ((flags & 2) !== 0 && (pMonster >>> 0) !== 0) {
      const roll = (stepSeed64At(m, (pMonster + 0x20) >>> 0) % 100) | 0
      if (roll < 70) {
        AI_IdleWander113c(m, pGame, pMonster)
      } else {
        AI_Stall113c(m, pGame, pMonster, 10)
      }
    }
  }
  return ok
}

function scheduleReplenishStatEvent(
  m: Memory113c,
  pGame: number,
  pItem: number,
  statId: number,
): void {
  const rate = STATLIST_GetUnitStat113c(m, pItem, statId, 0) | 0
  if (rate === 0) return
  if (EVENT_GetNextEventFrame113c(m, pItem, 3) !== 0) return
  const period = sdiv32(0x9c4, rate)
  const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + period + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, pItem, 3, nextFrame, 0, 0, 0)
}

function createItemFromDropRecord(
  m: Memory113c,
  pGame: number,
  pDrop: number,
  bSendClient: number,
  hooks?: LaneIHooks113c,
): number {
  if (hooks !== undefined && hooks.onCreateItemEx !== undefined) {
    return hooks.onCreateItemEx(m, pGame, pDrop, bSendClient) >>> 0
  }
  const nClassId = m.u32((pDrop + 0x14) >>> 0) | 0
  if (m.u32((pGame + 0x70) >>> 0) === 0) {
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nClassId) >>> 0
    if (pItemsTxt === 0 || m.u16((pItemsTxt + 0xf6) >>> 0) >= 0x64) {
      return 0
    }
  }
  const pItemTbls = DATATBLS_GetItemDataTables113c(m) >>> 0
  if (pItemTbls === 0) {
    throw new Error('ITEMS_CreateItemEx: DATATBLS_GetItemDataTables == NULL (line 2032)')
  }
  const nItemsCount = m.u32(pItemTbls) | 0
  if (nClassId < 0 || nClassId >= nItemsCount) {
    return 0
  }
  const nX = m.u32((pDrop + 0x1c) >>> 0) | 0
  const nY = m.u32((pDrop + 0x20) >>> 0) | 0
  const pRoom = m.u32((pDrop + 0x04) >>> 0) >>> 0
  const wFlags = m.u16((pDrop + 0x28) >>> 0)
  const nMode = m.u32((pDrop + 0x18) >>> 0) | 0
  const pItem = SUNIT_AllocUnitData113c(m, 4, nClassId, nX, nY, pGame, pRoom, wFlags, nMode, 0) >>> 0
  if (pItem === 0) {
    throw new Error('ITEMS_CreateItemEx: SUNIT_AllocUnitData == NULL (line 2057)')
  }
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x80000, 1)
  const pItemData = m.u32((pItem + 0x14) >>> 0) >>> 0
  if (pItemData !== 0) {
    m.setU16((pItemData + 0x3c) >>> 0, m.u16((pDrop + 0x2a) >>> 0))
    m.setU32(pItemData, m.u32((pDrop + 0x30) >>> 0) >>> 0)
    m.setU32((pItemData + 0x2c) >>> 0, m.u32((pDrop + 0x0c) >>> 0) >>> 0)
    const dwFlags2 = m.u32((pDrop + 0x80) >>> 0) >>> 0
    if ((dwFlags2 & 2) !== 0) {
      m.setU32((pItemData + 0x18) >>> 0, (m.u32((pItemData + 0x18) >>> 0) | 0x10) >>> 0)
    }
  }
  const dwSeed = m.u32((pDrop + 0x48) >>> 0) >>> 0
  const dwInitSeed = m.u32((pDrop + 0x4c) >>> 0) >>> 0
  if (dwSeed !== 0 || dwInitSeed !== 0) {
    m.setU32((pItem + 0x28) >>> 0, dwSeed)
    SEED_InitLowSeed113c(m, (pItem + 0x20) >>> 0, dwSeed)
    if (pItemData !== 0) {
      m.setU32((pItemData + 0x04) >>> 0, dwInitSeed)
    }
  }
  ITEMS_FinalizeCreatedItem113c(m, pGame, pItem)
  scheduleReplenishStatEvent(m, pGame, pItem, 0xfc)
  scheduleReplenishStatEvent(m, pGame, pItem, 0xfd)
  return pItem
}

/**
 * Frees all `UNITEVENT_MODE` (`nType == 0`) nodes on `pUnit` (`ebx`, walking `pUnit->pEventFirst`
 * at `+0xDC` via `pNode->pUnitNext` at `+0x24`), then schedules `UNITEVENT_AITHINK` (`2`) on
 * `pUnit` in `pGame` (`eax`) at `pGame->dwGameFrame + 13` (`+0xA8 + 0x0D`).
 *
 * @va D2Game:0x6FC2DE20
 */
export function SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  const unit = pUnit >>> 0
  const game = pGame >>> 0
  if (unit !== 0) {
    let pEvent = m.u32((unit + 0xdc) >>> 0) >>> 0
    while (pEvent !== 0) {
      const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
      if (m.u8(pEvent) === 0) {
        EVENT_FreeNode113c(m, game, pEvent)
      }
      pEvent = pNext
    }
  }
  const frame = (m.u32((game + 0xa8) >>> 0) + 0x0d) >>> 0
  return EVENT_SetEventFull113c(m, game, unit, 2, frame, 0, 0, 0)
}

/**
 * Computes the ground-drop expiration frame for `pItem` (`esi`) in `pGame` (`edi`):
 * - Returns `0` (never expires) if `ITEMS_GetComponentByte(pItem) != 0`.
 * - Magic (`quality == 4`): `dwGameFrame + 30000` (`0x7530`).
 * - Set / Rare / Unique / Crafted / Tempered (`5 <= quality <= 9`): `dwGameFrame + 45000` (`0xAFC8`).
 * - Gold (`itemType == 4`): `dwGameFrame + 15000` (`0x3A98`) when `STAT_GOLD <= 10000`, else `+ 45000`.
 * - Socket fillers (`ITEMS_CheckIfSocketFiller != 0`): `dwGameFrame + 30000`, else `dwGameFrame + 15000`.
 *
 * @va D2Game:0x6FC2E0A0
 */
export function ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
): number {
  if (ITEMS_GetComponentByte113c(m, pItem) !== 0) {
    return 0
  }
  const gameFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
  const quality = ITEMS_GetItemQuality113c(m, pItem) | 0
  if (quality === 4) {
    return (gameFrame + 0x7530) >>> 0
  }
  if (quality > 4 && quality <= 9) {
    return (gameFrame + 0xafc8) >>> 0
  }
  if ((ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 4) {
    const gold = STATLIST_GetUnitStat113c(m, pItem, 0x0e, 0) | 0
    if (gold <= 0x2710) {
      return (gameFrame + 0x3a98) >>> 0
    }
    return (gameFrame + 0xafc8) >>> 0
  }
  if (ITEMS_CheckIfSocketFiller113c(m, pItem) !== 0) {
    return (gameFrame + 0x7530) >>> 0
  }
  return (gameFrame + 0x3a98) >>> 0
}

/**
 * Applies the diminishing-returns Magic Find curve (`ecx = nMfPercent`, `edx = nFactor`,
 * `[esp+4] = nScale`, `ret 4`): returns `nMfPercent` when `nMfPercent <= 110`, else
 * `sdiv32(imul32(nMfPercent - 100, nScale), (nMfPercent - 100) + nFactor) + 100`.
 *
 * @va D2Game:0x6FC2E130
 */
export function ITEMS_CalcDiminishingMfPercent_6FC2E130_113c(
  _m: Memory113c,
  nMfPercent: number,
  nFactor: number,
  nScale: number,
): number {
  const mf = nMfPercent | 0
  if (mf <= 0x6e) {
    return mf
  }
  const excess = (mf - 0x64) | 0
  const num = imul32(excess, nScale | 0)
  const den = (excess + (nFactor | 0)) | 0
  return (sdiv32(num, den) + 0x64) | 0
}

/**
 * Checks whether `pTargetItem` (`edi`) is either the cursor item or a linked inventory item
 * in `pInventoryOverride ? pInventoryOverride : pOwnerUnit->pInventory` (`ecx = pOwnerUnit`,
 * `eax = pInventoryOverride`). Asserts `pOwnerUnit->pInventory != NULL` (`line 2740`).
 *
 * @va D2Game:0x6FC2E150
 */
export function ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(
  m: Memory113c,
  pOwnerUnit: number,
  pTargetItem: number,
  pInventoryOverride = 0,
): number {
  let pInv = m.u32((pOwnerUnit + 0x60) >>> 0) >>> 0
  if (pInv === 0) {
    throw new Error('ITEMS_IsItemInUnitInventoryOrCursor: pUnit->pInventory == NULL (line 2740)')
  }
  if ((pInventoryOverride >>> 0) !== 0) {
    pInv = pInventoryOverride >>> 0
  }
  const target = pTargetItem >>> 0
  if ((INVENTORY_GetCursorItem113c(m, pInv) >>> 0) === target) {
    return 1
  }
  let pNode = INVENTORY_GetFirstItem113c(m, pInv) >>> 0
  while (pNode !== 0) {
    if ((INVENTORY_UnitIsItem113c(m, pNode) >>> 0) === target) {
      return 1
    }
    pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
  }
  return 0
}

/**
 * Removes `pTargetItem` (`ebx`) from `pInventory` (`edi`): detaches it via
 * `INVENTORY_RemoveItemFromInventory` if present in the item list, or clears
 * `INVENTORY_SetCursorItem(pInventory, 0)` if it matches the cursor item.
 *
 * @va D2Game:0x6FC2E1C0
 */
export function ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c(
  m: Memory113c,
  pInventory: number,
  pTargetItem: number,
): void {
  const inv = pInventory >>> 0
  const target = pTargetItem >>> 0
  let pNode = INVENTORY_GetFirstItem113c(m, inv) >>> 0
  while (pNode !== 0) {
    if ((INVENTORY_UnitIsItem113c(m, pNode) >>> 0) === target) {
      INVENTORY_RemoveItemFromInventory113c(m, inv, target)
      return
    }
    pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
  }
  const pCursor = INVENTORY_GetCursorItem113c(m, inv) >>> 0
  if (pCursor !== 0 && pCursor === target) {
    INVENTORY_SetCursorItem113c(m, inv, 0)
  }
}

/**
 * Clears all 3 magic prefix/suffix slots (`0..2`), rare prefix/suffix, and sets `nItemCell = -1`
 * on `*ppItem` (`edi = ppItem`, reloading `[edi]` before every call).
 *
 * @va D2Game:0x6FC2E210
 */
export function ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(
  m: Memory113c,
  ppItem: number,
): void {
  const ptr = ppItem >>> 0
  for (let i = 0; i < 3; i++) {
    ITEMS_SetMagicPrefix113c(m, m.u32(ptr) >>> 0, 0, i)
    ITEMS_SetMagicSuffix113c(m, m.u32(ptr) >>> 0, 0, i)
  }
  ITEMS_SetRarePrefix113c(m, m.u32(ptr) >>> 0, 0)
  ITEMS_SetRareSuffix113c(m, m.u32(ptr) >>> 0, 0)
  ITEMS_SetItemCell113c(m, m.u32(ptr) >>> 0, -1)
}

/**
 * Tests whether unique item `nUniqueId` (`ecx`) has already spawned in `pGame` (`eax`,
 * `pGame->dwUniqueFlags` bitarray at `+0x1B24`): returns `0` when `pGame == 0`, `1` when
 * `nUniqueId < 0` or `nUniqueId > 0x1000`, else `(dwUniqueFlags[nUniqueId >> 5] & gdwBitMasks[nUniqueId & 31])`.
 *
 * @va D2Game:0x6FC2E250
 */
export function ITEMS_TestUniqueSpawnedBit_6FC2E250_113c(
  m: Memory113c,
  pGame: number,
  nUniqueId: number,
): number {
  const game = pGame >>> 0
  if (game === 0) return 0
  const id = nUniqueId | 0
  if (id < 0 || id > 0x1000) return 1
  const word = m.u32((game + (id >> 5) * 4 + 0x1b24) >>> 0)
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask = m.u32((pBitMasks + (id & 0x1f) * 4) >>> 0)
  return (word & mask) | 0
}

/**
 * Resolves the vendor mana potion base code (`'mp1 '..'mp4 '`) for NPC `pUnit` (`eax`) from
 * `DRLG_GetActNoFromLevelId` (`+ 2` in Nightmare/Hell when `pGame->nDifficulty > 0`).
 *
 * @va D2Game:0x6FC2E310
 */
export function ITEMS_GetVendorManaPotionCode_6FC2E310_113c(
  m: Memory113c,
  pUnit: number,
): number {
  const unit = pUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  if (pRoom === 0) {
    throw new Error('ITEMS_GetVendorManaPotionCode: UNITS_GetRoom == NULL (line 3424)')
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  let actIdx = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (unit === 0) {
    throw new Error('ITEMS_GetVendorManaPotionCode: pUnit == NULL (line 2602)')
  }
  const pGame = m.u32((unit + 0x80) >>> 0) >>> 0
  if (pGame !== 0) {
    const bDiff = m.u8((pGame + 0x6d) >>> 0)
    if (bDiff > 0) {
      actIdx = (actIdx + 2) & 0xff
    }
  }
  if (actIdx >= VENDOR_MANA_POTION_CODES.length) {
    return VENDOR_MANA_POTION_CODES[3]!
  }
  return VENDOR_MANA_POTION_CODES[actIdx]!
}

/**
 * Resolves the vendor healing potion base code (`'hp1 '..'hp4 '`) for NPC `pUnit` (`eax`) from
 * `DRLG_GetActNoFromLevelId` (`+ 2` in Nightmare/Hell when `pGame->nDifficulty > 0`).
 *
 * @va D2Game:0x6FC2E390
 */
export function ITEMS_GetVendorHealthPotionCode_6FC2E390_113c(
  m: Memory113c,
  pUnit: number,
): number {
  const unit = pUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  if (pRoom === 0) {
    throw new Error('ITEMS_GetVendorHealthPotionCode: UNITS_GetRoom == NULL (line 3393)')
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  let actIdx = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (unit === 0) {
    throw new Error('ITEMS_GetVendorHealthPotionCode: pUnit == NULL (line 2602)')
  }
  const pGame = m.u32((unit + 0x80) >>> 0) >>> 0
  if (pGame !== 0) {
    const bDiff = m.u8((pGame + 0x6d) >>> 0)
    if (bDiff > 0) {
      actIdx = (actIdx + 2) & 0xff
    }
  }
  if (actIdx >= VENDOR_HEALTH_POTION_CODES.length) {
    return VENDOR_HEALTH_POTION_CODES[3]!
  }
  return VENDOR_HEALTH_POTION_CODES[actIdx]!
}

/**
 * Searches `pUnit->pInventory` (`eax = pUnit`, `ebx = pGame`, `[esp+4] = dwBaseCode`, `ret 4`)
 * for an item matching `dwBaseCode` (cursor first, then non-page-1 inventory items) whose quest
 * difficulty (`STAT_QUESTITEMDIFFICULTY = 0x164`) satisfies `pGame->nDifficulty <= itemDiff`.
 *
 * @va D2Game:0x6FC2E660
 */
export function ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  dwBaseCode: number,
): number {
  const pInv = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInv === 0) return 0
  const targetCode = dwBaseCode >>> 0
  const game = pGame >>> 0

  const pCursor = INVENTORY_GetCursorItem113c(m, pInv) >>> 0
  if (pCursor !== 0 && (ITEMS_GetBaseCode113c(m, pCursor) >>> 0) === targetCode) {
    const classId = m.u32((pCursor + 0x04) >>> 0) | 0
    const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, classId) >>> 0
    if (pItemsTxt === 0 || m.u8((pItemsTxt + 0x12a) >>> 0) === 0) {
      return pCursor
    }
    const itemDiff = STATLIST_GetUnitStat113c(m, pCursor, 0x164, 0) | 0
    const gameDiff = m.u8((game + 0x6d) >>> 0)
    if (gameDiff <= itemDiff) {
      return pCursor
    }
  }

  let pNode = INVENTORY_GetFirstItem113c(m, pInv) >>> 0
  while (pNode !== 0) {
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    if ((ITEMS_GetBaseCode113c(m, pItem) >>> 0) === targetCode) {
      if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) !== 1) {
        const classId = pItem !== 0 ? m.u32((pItem + 0x04) >>> 0) | 0 : -1
        const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, classId) >>> 0
        if (
          pItemsTxt === 0 ||
          m.u8((pItemsTxt + 0x12a) >>> 0) === 0 ||
          m.u8((pItemsTxt + 0x12b) >>> 0) === 0
        ) {
          return pItem
        }
        const itemDiff = STATLIST_GetUnitStat113c(m, pItem, 0x164, 0) | 0
        const gameDiff = m.u8((game + 0x6d) >>> 0)
        if (gameDiff <= itemDiff) {
          return pItem
        }
      }
    }
    pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
  }
  return 0
}

/**
 * Checks whether a `ITEMQUAL_UNIQUE` (`7`) item `pItem` (`eax`) has its unique file index
 * (`ITEMS_GetItemCell`) already marked in `pGame->dwUniqueFlags` (`edi = pGame`, `+0x1B24`).
 *
 * @va D2Game:0x6FC2E800
 */
export function ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c(
  m: Memory113c,
  pItem: number,
  pGame: number,
): number {
  if ((ITEMS_GetItemQuality113c(m, pItem) | 0) !== 7) {
    return 0
  }
  const nCell = ITEMS_GetItemCell113c(m, pItem) | 0
  const game = pGame >>> 0
  if (game === 0) return 0
  if (nCell < 0 || nCell > 0x1000) return 1
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask = m.u32((pBitMasks + (nCell & 0x1f) * 4) >>> 0)
  const word = m.u32((game + (nCell >> 5) * 4 + 0x1b24) >>> 0)
  return (word & mask) | 0
}

/**
 * Initializes base 1H, 2H, and throw min/max damage stats (`0x15..0x18`, `0x9F`, `0xA0`) on
 * `pItem` (`edi`) from `D2ItemsTxt` bytes `+0xFE..+0x103`. Asserts `pItemsTxt != NULL` (`line 475`).
 *
 * @va D2Game:0x6FC2E860
 */
export function ITEMS_InitBaseWeaponDamageStats_6FC2E860_113c(
  m: Memory113c,
  pItem: number,
): void {
  const item = pItem >>> 0
  const classId = item !== 0 ? m.u32((item + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, classId) >>> 0
  if (pItemsTxt === 0) {
    throw new Error('ITEMS_InitBaseWeaponDamageStats: pItemsTxt == NULL (line 475)')
  }
  const maxDam = m.u8((pItemsTxt + 0xff) >>> 0)
  if (maxDam !== 0) {
    STATLIST_SetUnitStat113c(m, item, 0x16, maxDam, 0)
  }
  const minDam = m.u8((pItemsTxt + 0xfe) >>> 0)
  if (minDam !== 0) {
    STATLIST_SetUnitStat113c(m, item, 0x15, minDam, 0)
  }
  const twoHandMin = m.u8((pItemsTxt + 0x102) >>> 0)
  if (twoHandMin !== 0) {
    STATLIST_SetUnitStat113c(m, item, 0x17, twoHandMin, 0)
  }
  const twoHandMax = m.u8((pItemsTxt + 0x103) >>> 0)
  if (twoHandMax !== 0) {
    STATLIST_SetUnitStat113c(m, item, 0x18, twoHandMax, 0)
  }
  const misMax = m.u8((pItemsTxt + 0x101) >>> 0)
  if (misMax !== 0) {
    const misMin = m.u8((pItemsTxt + 0x100) >>> 0)
    STATLIST_SetUnitStat113c(m, item, 0x9f, misMin, 0)
    STATLIST_SetUnitStat113c(m, item, 0xa0, m.u8((pItemsTxt + 0x101) >>> 0), 0)
  }
}

/**
 * Allocates an item unit from `pItemHeader` (`esi`) in `pGame` (`edi`), loads its stats via
 * `ITEMS_LoadStatsFromBitstream`, writes `*pOutBytesRead`, sets `ITEMCMDFLAG_INIT` (`0x80000`),
 * clears `0x2000`, and schedules replenish durability/quantity events (`0xFC` / `0xFD`).
 * Frees the item and returns `0` if `ITEMS_LoadStatsFromBitstream` fails.
 *
 * @va D2Game:0x6FC2EAE0
 */
export function ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
  m: Memory113c,
  pGame: number,
  pItemHeader: number,
  pRoom: number,
  pBitstream: number,
  nBitstreamSize: number,
  bHasVersionCoords: number,
  pOutBytesRead: number,
  nSaveVersion: number,
): number {
  const game = pGame >>> 0
  if (game === 0) {
    return 0
  }
  const hdr = pItemHeader >>> 0
  const outBytesPtr = pOutBytesRead >>> 0
  const nClassId = m.u32(hdr) | 0
  if (nClassId < 0) {
    m.setU32(outBytesPtr, 0)
    return 0
  }
  const pItemTbls = DATATBLS_GetItemDataTables113c(m) >>> 0
  const nItemsCount = pItemTbls !== 0 ? m.u32(pItemTbls) | 0 : 0
  if (nClassId >= nItemsCount) {
    m.setU32(outBytesPtr, 0)
    return 0
  }

  const nMode = m.u8((hdr + 0x08) >>> 0)
  const nY = m.u16((hdr + 0x06) >>> 0)
  const nX = m.u16((hdr + 0x04) >>> 0)
  const pItem = SUNIT_AllocUnitData113c(m, 4, nClassId, nX, nY, game, pRoom, 1, nMode, 0) >>> 0
  if (pItem === 0) {
    return 0
  }

  const savedSp = k2LaneIStackPtr
  const pFailed = savedSp
  k2LaneIStackPtr = (savedSp + 8) >>> 0
  let bytesRead = 0
  let failed = 0
  try {
    m.setU32(pFailed, 0)
    bytesRead =
      ITEMS_LoadStatsFromBitstream113c(
        m,
        pItem,
        pBitstream,
        nBitstreamSize,
        bHasVersionCoords,
        0,
        nSaveVersion,
        pFailed,
      ) | 0
    failed = m.u32(pFailed) | 0
  } finally {
    k2LaneIStackPtr = savedSp
  }

  m.setU32(outBytesPtr, bytesRead >>> 0)
  if (bytesRead === 0 || failed !== 0) {
    SUNIT_FreeUnit113c(m, game, pItem)
    return 0
  }

  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x80000, 1)
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x2000, 0)
  void ITEMS_GetQualityMinValue113c(m, 0, 0)
  void ITEMS_GetQualityBonusDivisor113c(m, 0, 0)
  scheduleReplenishStatEvent(m, game, pItem, 0xfc)
  scheduleReplenishStatEvent(m, game, pItem, 0xfd)
  return pItem
}

/**
 * Checks whether `pItemsTxt` (`edi`) is eligible for vendor/drop table generation at `nLevelId`
 * (`eax`, clamped `>= 1`) with optional item type filter `nRequiredType` (`ebx`, `-1` = any)
 * and rarity roll (`[esp+4] = pSeed`, `[esp+8] = bSkipRarityRoll`, `ret 8`).
 *
 * @va D2Game:0x6FC2F180
 */
export function ITEMS_CheckItemTxtSpawnable_6FC2F180_113c(
  m: Memory113c,
  pItemsTxt: number,
  nLevelId: number,
  nRequiredType: number,
  pSeed: number,
  bSkipRarityRoll: number,
): number {
  let lvl = nLevelId | 0
  if (lvl <= 0) {
    lvl = 1
  }
  const rec = pItemsTxt >>> 0
  if (m.u8((rec + 0x133) >>> 0) === 0) return 0
  if (m.u8((rec + 0x12a) >>> 0) !== 0) return 0
  if (m.u8((rec + 0xfd) >>> 0) > lvl) return 0

  if ((bSkipRarityRoll | 0) === 0) {
    const actNo = DRLG_GetActNoFromLevelId113c(m, lvl) & 0xff
    const rarity = m.u8((rec + 0xfc) >>> 0)
    const diff = (rarity - actNo) | 0
    if (diff > 0) {
      if (SEED_RollLimitedFast113c(m, pSeed >>> 0, diff) !== 0) {
        return 0
      }
    }
  }

  const reqType = nRequiredType | 0
  if (reqType !== -1) {
    if (sx16(m.u16((rec + 0x11e) >>> 0)) !== reqType) {
      return 0
    }
  }
  return 1
}

/**
 * Tears down sub-inventory items and `pItem->pInventory` (`+0x60`) when `ITEMS_GetSubTypeFromItem`
 * is non-zero, then removes all scheduled unit events on `pItem` (`esi`) in `pGame` (`edi`).
 *
 * @va D2Game:0x6FC30700
 */
export function ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c(
  m: Memory113c,
  pGame: number,
  pItem: number,
  hooks?: LaneIHooks113c,
): void {
  const game = pGame >>> 0
  const item = pItem >>> 0
  if (ITEMS_GetSubTypeFromItem113c(m, item) !== 0) {
    SUNIT_ClearUnitInventoryItems113c(m, game, item, hooks)
    const pInv = m.u32((item + 0x60) >>> 0) >>> 0
    INVENTORY_FreeInventory113c(m, pInv)
  }
  EVENT_RemoveUnitEvents113c(m, game, item)
}

/**
 * Populates a `0x84`-byte `D2ItemDropStrc` from explicit item creation parameters (`eax = nItemLevel`,
 * `edx = bFlag8`, `ecx = bIdentified`, plus 8 stack dwords, `ret 0x20`), invokes `ITEMS_CreateItemEx`,
 * and sets command flag `0x10` on the created item.
 *
 * @va D2Game:0x6FC31980
 */
export function ITEMS_SpawnItemWithParams_6FC31980_113c(
  m: Memory113c,
  nItemLevel: number,
  bFlag8: number,
  bIdentified: number,
  pOwnerUnit: number,
  nClassId: number,
  pGame: number,
  nSpawnMode: number,
  nQuality: number,
  bSendClient: number,
  dwSeed: number,
  dwInitSeed: number,
  hooks?: LaneIHooks113c,
): number {
  let clampedLvl = nItemLevel | 0
  if (clampedLvl <= 0) {
    clampedLvl = 1
  }
  const game = pGame >>> 0
  const flags2 = ((bFlag8 !== 0 ? 8 : 0) | (bIdentified !== 0 ? 2 : 0)) >>> 0

  const savedSp = k2LaneIStackPtr
  const pDrop = savedSp
  k2LaneIStackPtr = (savedSp + 0x88) >>> 0
  try {
    m.fill(pDrop, 0x84, 0)
    m.setU32(pDrop, pOwnerUnit >>> 0)
    m.setU32((pDrop + 0x08) >>> 0, game)
    m.setU32((pDrop + 0x14) >>> 0, nClassId >>> 0)
    m.setU32((pDrop + 0x18) >>> 0, nSpawnMode >>> 0)
    m.setU16((pDrop + 0x28) >>> 0, 1)
    m.setU16((pDrop + 0x2a) >>> 0, m.u16((game + 0x78) >>> 0))
    m.setU32((pDrop + 0x30) >>> 0, nQuality >>> 0)
    m.setU32((pDrop + 0x48) >>> 0, dwSeed >>> 0)
    m.setU32((pDrop + 0x4c) >>> 0, dwInitSeed >>> 0)
    m.setU32((pDrop + 0x80) >>> 0, flags2)

    let ilvl = clampedLvl === -1 ? ITEMS_GetDropItemLevel113c(m, game, pOwnerUnit, 0) | 0 : clampedLvl
    if (ilvl <= 0) {
      ilvl = 1
    }
    m.setU32((pDrop + 0x0c) >>> 0, ilvl >>> 0)

    const pItem = createItemFromDropRecord(m, game, pDrop, bSendClient, hooks)
    if (pItem !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x10, 1)
    }
    return pItem
  } finally {
    k2LaneIStackPtr = savedSp
  }
}

/**
 * Room/unit scan callback (`[esp+4] = pCandidateUnit`, `[esp+8] = pScanCtx`, `ret 8`):
 * when `pCandidateUnit != pScanCtx->pOriginUnit (+0x00)` and `AI_CalcApproxUnitDistSubtiles <= 1`,
 * increments `pScanCtx->nCount (+0x08)` and records `pScanCtx->pLastAdjacentUnit (+0x04) = pCandidateUnit`.
 *
 * @va D2Game:0x6FC35590
 */
export function AI_CountAdjacentUnitsCallback_6FC35590_113c(
  m: Memory113c,
  pCandidateUnit: number,
  pScanCtx: number,
): void {
  const ctx = pScanCtx >>> 0
  const candidate = pCandidateUnit >>> 0
  const origin = m.u32(ctx) >>> 0
  if (origin === candidate) return
  if ((AI_CalcApproxUnitDistSubtiles113c(m, origin, candidate) | 0) <= 1) {
    m.setU32((ctx + 0x08) >>> 0, (m.u32((ctx + 0x08) >>> 0) + 1) >>> 0)
    m.setU32((ctx + 0x04) >>> 0, candidate)
  }
}

/**
 * Healer AI room-scan callback (`ecx = _pGame`, `edx = pHealerUnit`, `[esp+4] = pCandidateUnit`,
 * `[esp+8] = pHealScanCtx`, `ret 8`): selects the lowest-life% alive evil aligned monster within
 * `pHealScanCtx->nMaxSqDist (+0x08)` whose life% is `<= 75` (`0x4B`) and `< pHealScanCtx->nBestLifePct (+0x04)`.
 *
 * @va D2Game:0x6FC35660
 */
export function AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c(
  m: Memory113c,
  _pGame: number,
  pHealerUnit: number,
  pCandidateUnit: number,
  pHealScanCtx: number,
): number {
  const candidate = pCandidateUnit >>> 0
  if (candidate === 0) return 0
  if (m.u32(candidate) !== 1) return 0
  if (MONSTERS_IsDead113c(m, candidate) !== 0) return 0
  const healer = pHealerUnit >>> 0
  if (UNITS_AreUnitsAligned113c(m, healer, candidate) === 0) return 0
  if (UNIT_GetAlignment113c(m, candidate) !== 0) return 0
  const ctx = pHealScanCtx >>> 0
  const sqDist = UNIT_CalcSqDistSubtiles113c(m, healer, candidate) | 0
  if (sqDist > (m.u32((ctx + 0x08) >>> 0) | 0)) return 0
  const lifePct = STATLIST_GetUnitLifePercent113c(m, candidate) | 0
  if (lifePct > 0x4b) return 0
  if (lifePct < (m.u32((ctx + 0x04) >>> 0) | 0)) {
    m.setU32((ctx + 0x04) >>> 0, lifePct >>> 0)
    m.setU32(ctx, candidate)
  }
  return 0
}

/**
 * Room-scan callback (`ecx = _pGame`, `edx = pOriginUnit`, `[esp+4] = pCandidateUnit`,
 * `[esp+8] = pOutCount`, `ret 8`): increments `*pOutCount` for every alive evil monster
 * (`pCandidateUnit != pOriginUnit`) whose `MONSTER_GetBaseIdFromUnit` is `0x1C5` (`453`) or `0x1CD` (`461`).
 *
 * @va D2Game:0x6FC35890
 */
export function AI_CountNearbyMinion453Or461Callback_6FC35890_113c(
  m: Memory113c,
  _pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pOutCount: number,
): number {
  const candidate = pCandidateUnit >>> 0
  if ((pOriginUnit >>> 0) === candidate) return 0
  if (candidate === 0) return 0
  if (m.u32(candidate) !== 1) return 0
  if (MONSTERS_IsDead113c(m, candidate) !== 0) return 0

  let baseId = MONSTER_GetBaseIdFromUnit113c(m, candidate) | 0
  if (baseId >= 0) {
    const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
    const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
    if (baseId >= nMonStatsCount) {
      baseId = -1
    }
  } else {
    baseId = -1
  }

  if (baseId !== 0x1c5 && baseId !== 0x1cd) return 0
  if (UNIT_GetAlignment113c(m, candidate) !== 0) return 0
  const cntPtr = pOutCount >>> 0
  m.setU32(cntPtr, (m.u32(cntPtr) + 1) >>> 0)
  return 0
}

/**
 * Updates `pMonster->pMonsterData->pAiGeneral->dwTrackedGuid` (`+0x14`) toward `pCandidateTarget`
 * (`esi = pMonster`, `[esp+4] = pCandidateTarget`, `ret 4`): writes `0xFFFFFFFF` if `pCandidateTarget == 0`,
 * or replaces `+0x14` with `pCandidateTarget->dwUnitId` if the previous tracked monster GUID is absent
 * from `pGame->pUnitList[1]` (`+0x1320`) or `pCandidateTarget` is at `<=` squared subtile distance.
 *
 * @va D2Game:0x6FC358F0
 */
export function AI_UpdateCloserTrackedTargetGuid_6FC358F0_113c(
  m: Memory113c,
  pMonster: number,
  pCandidateTarget: number,
): void {
  const mon = pMonster >>> 0
  let pAiGen = 0
  if (mon !== 0 && m.u32(mon) === 1) {
    const pMonData = m.u32((mon + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
    }
  }
  const candidate = pCandidateTarget >>> 0
  if (candidate === 0) {
    m.setU32((pAiGen + 0x14) >>> 0, 0xffffffff)
    return
  }
  if (mon === 0) {
    throw new Error('AI_UpdateCloserTrackedTargetGuid: pMonster == NULL (line 2602)')
  }
  const pGame = m.u32((mon + 0x80) >>> 0) >>> 0
  const curGuid = m.u32((pAiGen + 0x14) >>> 0) >>> 0
  if (pGame === 0) {
    throw new Error('AI_UpdateCloserTrackedTargetGuid: pGame == NULL (line 723)')
  }
  const pCurTarget = findMonsterInGameHash(m, pGame, curGuid)
  if (pCurTarget === 0) {
    m.setU32((pAiGen + 0x14) >>> 0, m.u32((candidate + 0x0c) >>> 0) >>> 0)
    return
  }
  const curSqDist = UNIT_CalcSqDistSubtiles113c(m, mon, pCurTarget) | 0
  const candSqDist = UNIT_CalcSqDistSubtiles113c(m, mon, candidate) | 0
  if (candSqDist <= curSqDist) {
    m.setU32((pAiGen + 0x14) >>> 0, m.u32((candidate + 0x0c) >>> 0) >>> 0)
  }
}

/**
 * Checks whether any player is currently interacting with `pMonster` (`esi`, via
 * `pMonster->pMonsterData->pMonInteract` at `+0x30`); if none, clears `pUsedSkill` and
 * transitions `pMonster` into `MONMODE_DEATH` (`0`) via `MONSTER_StartMode`, returning `1` (else `0`).
 *
 * @va D2Game:0x6FC35BB0
 */
export function AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c(
  m: Memory113c,
  pMonster: number,
  pGame: number,
  world?: FallenSliceWorld113c,
  hooks?: LaneIHooks113c,
): number {
  const mon = pMonster >>> 0
  let pInteract = 0
  if (mon !== 0 && m.u32(mon) === 1) {
    const pMonData = m.u32((mon + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pInteract = m.u32((pMonData + 0x30) >>> 0) >>> 0
    }
  }
  let pNode = pInteract !== 0 ? m.u32(pInteract) >>> 0 : 0
  while (pNode !== 0) {
    if (m.u32(pNode) !== 0) {
      return 0
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  SKILLS_SetUsedSkillMemPort113c(m, mon, 0)
  executeMonsterModeTransition(m, pGame >>> 0, mon, 0, 0, 0x64, world, hooks)
  return 1
}

/**
 * Overlord/Overseer minion-scan callback (`ecx = pGame`, `edx = pOriginUnit`,
 * `[esp+4] = pCandidateUnit`, `[esp+8] = pScanCtx`, `ret 8`): counts allied alive `baseId == 0x1C5`
 * (`453`) minions lacking state `0x8D` (`141`), filling `pScanCtx + 0x0C` (injured minion) and
 * `pScanCtx + 0x10` (whippable non-flag-8 minion).
 *
 * @va D2Game:0x6FC35C40
 */
export function AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c(
  m: Memory113c,
  pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pScanCtx: number,
): number {
  const origin = pOriginUnit >>> 0
  const candidate = pCandidateUnit >>> 0
  if (origin === candidate) return 0
  if (candidate === 0 || m.u32(candidate) !== 1) return 0

  const baseId = MONSTER_GetBaseIdFromUnit113c(m, candidate) | 0
  if (baseId < 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (baseId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)) return 0
  if (baseId !== 0x1c5) return 0
  if (MONSTERS_IsDead113c(m, candidate) !== 0) return 0
  if (SUNIT_AreUnitsHostileOrUnaligned113c(m, candidate, origin, pGame >>> 0) !== 0) return 0
  if (STATES_CheckState113c(m, candidate, 0x8d) !== 0) return 0

  const ctx = pScanCtx >>> 0
  m.setU32((ctx + 0x14) >>> 0, (m.u32((ctx + 0x14) >>> 0) + 1) >>> 0)

  if (m.u32((ctx + 0x0c) >>> 0) === 0) {
    const sqDist = UNIT_CalcSqDistSubtiles113c(m, origin, candidate) | 0
    if (sqDist <= (m.u32(ctx) | 0)) {
      const lifePct = STATLIST_GetUnitLifePercent113c(m, candidate) | 0
      if (lifePct < (m.u32((ctx + 0x08) >>> 0) | 0)) {
        m.setU32((ctx + 0x0c) >>> 0, candidate)
      }
    }
  }

  if (m.u32((ctx + 0x10) >>> 0) === 0) {
    const sqDist = UNIT_CalcSqDistSubtiles113c(m, origin, candidate) | 0
    if (sqDist <= (m.u32((ctx + 0x04) >>> 0) | 0)) {
      if (MONSTER_CheckTypeFlagsMask113c(m, candidate, 8) === 0) {
        m.setU32((ctx + 0x10) >>> 0, candidate)
      }
    }
  }
  return 0
}

/**
 * Casts `MonStatsTxt.wSkill1` (`+0x170`, mode `4`) at the next preset patrol coordinate entry
 * (`pAiControl->pSaveBlock` at `+0x38`, indexed by `pAiControl + 0x14`, stride `12` bytes),
 * advancing `+0x14` and stamping `+0x18 = pGame->dwGameFrame`. Resets `+0x14 = 0` when exhausted
 * and `|dwGameFrame - (+0x18)| > 700` (`0x2BC`).
 *
 * @va D2Game:0x6FC35F90
 */
export function AI_CastNextPatrolPointSkill_6FC35F90_113c(
  m: Memory113c,
  pAiArgs: number,
  pGame: number,
  pMonster: number,
  world?: FallenSliceWorld113c,
  hooks?: LaneIHooks113c,
): number {
  const game = pGame >>> 0
  const pAiCtrl = m.u32(pAiArgs >>> 0) >>> 0
  const pSaveBlock = m.u32((pAiCtrl + 0x38) >>> 0) >>> 0
  if (pSaveBlock !== 0) {
    const idx = m.u32((pAiCtrl + 0x14) >>> 0) | 0
    if (idx < (m.u32(pSaveBlock) | 0)) {
      const mon = pMonster >>> 0
      if (mon === 0) return 0
      const classId = m.u32((mon + 0x04) >>> 0) | 0
      if (classId < 0) return 0
      const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
      if (classId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)) return 0
      const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
      const pMonStats = (pMonStatsBase + imul32(classId, 0x1a8)) >>> 0
      if (pMonStats === 0) return 0
      const nSkillId = sx16(m.u16((pMonStats + 0x170) >>> 0))
      if (nSkillId < 0 || nSkillId >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) return 0

      const pEntries = m.u32((pSaveBlock + 0x04) >>> 0) >>> 0
      const pEntry = (pEntries + imul32(idx, 12)) >>> 0
      const targetY = m.u32((pEntry + 0x08) >>> 0) | 0
      const targetX = m.u32((pEntry + 0x04) >>> 0) | 0
      AI_CastSkillWithMode113c(m, 4, mon, game, nSkillId, 0, targetX, targetY, world, hooks)
      m.setU32((pAiCtrl + 0x14) >>> 0, (m.u32((pAiCtrl + 0x14) >>> 0) + 1) >>> 0)
      m.setU32((pAiCtrl + 0x18) >>> 0, m.u32((game + 0xa8) >>> 0) >>> 0)
      return 1
    }
  }

  let delta = ((m.u32((game + 0xa8) >>> 0) | 0) - (m.u32((pAiCtrl + 0x18) >>> 0) | 0)) | 0
  if (delta < 0) {
    delta = (-delta) | 0
  }
  if (delta > 0x2bc) {
    m.setU32((pAiCtrl + 0x14) >>> 0, 0)
  }
  return 0
}

/**
 * Monster AI init callback (`ecx = pGame`, `edx = pMonster`, `[esp+4] = pAiInitArgs`, `ret 4`):
 * clears `STATE_FREEZE` (`0x0C`) if active on `pMonster`, initializes the AI think function via
 * `AI_InitMonsterAiThinkFn`, and stalls `1` frame via `AI_Stall`.
 *
 * @va D2Game:0x6FC36060
 */
export function AI_InitClearFreezeAndStall_6FC36060_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pAiInitArgs: number,
  world?: FallenSliceWorld113c,
): void {
  const pAiGen = m.u32(pAiInitArgs >>> 0) >>> 0
  const mon = pMonster >>> 0
  if (STATES_CheckState113c(m, mon, 0x0c) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, mon, 0x0c, 0)
  }
  void m.u32(pAiGen)
  AI_InitMonsterAiThinkFn113c(m, mon)
  executeAiStall(m, pGame >>> 0, mon, 1, world)
}

/**
 * Single-strike turret AI think routine (`MonAI[97]`, `ecx = pGame`, `edx = pMonster`,
 * `[esp+4] = pAiArgs`, `ret 4`): stalls `50` frames once `pAiControl->dwState (+0x14) != 0`,
 * stalls `10` frames when `bInMelee (+0x18) == 0`, else sets `+0x14 = 1`, clears `pUsedSkill`,
 * and fires `MONMODE_ATTACK1` (`4`) at `pTarget (+0x08)`.
 *
 * @va D2Game:0x6FC360B0
 */
export function AI_ThinkSingleStrikeTurret_6FC360B0_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pAiArgs: number,
  world?: FallenSliceWorld113c,
  hooks?: LaneIHooks113c,
): void {
  const args = pAiArgs >>> 0
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  const pTarget = m.u32((args + 0x08) >>> 0) >>> 0
  const bInMelee = m.u32((args + 0x18) >>> 0) | 0
  const pAiCtrl = m.u32(args) >>> 0

  if (m.u32((pAiCtrl + 0x14) >>> 0) !== 0) {
    executeAiStall(m, game, mon, 0x32, world)
    return
  }
  if (bInMelee === 0) {
    executeAiStall(m, game, mon, 0x0a, world)
    return
  }
  m.setU32((pAiCtrl + 0x14) >>> 0, 1)
  SKILLS_SetUsedSkillMemPort113c(m, mon, 0)
  const byte15 = resolveMonsterAttackPathByte15(m, mon)
  executeMonsterModeTransition(m, game, mon, 4, pTarget, byte15, world, hooks)
}

/**
 * Static trap AI think routine (`MonAI[123]`, `ecx = pGame`, `edx = pMonster`, `[esp+4] = pAiArgs`,
 * `ret 4`): steps `pMonster->tSeed` (`+0x20`), compares `roll % 100 < MonStatsTxt.aip1[diff]` (`+0x56`),
 * and either starts untargeted `MONMODE_ATTACK1` (`4`) or stalls `15` frames.
 *
 * @va D2Game:0x6FC36190
 */
export function AI_ThinkStaticTrapAttack_6FC36190_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pAiArgs: number,
  world?: FallenSliceWorld113c,
  hooks?: LaneIHooks113c,
): void {
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  const pMonStatsTxt = m.u32((pAiArgs + 0x1c) >>> 0) >>> 0
  const roll = (stepSeed64At(m, (mon + 0x20) >>> 0) % 0x64) | 0
  const bDiff = m.u8((game + 0x6d) >>> 0)
  const aip1 = sx16(m.u16((pMonStatsTxt + bDiff * 2 + 0x56) >>> 0))
  if (roll >= aip1) {
    executeAiStall(m, game, mon, 0x0f, world)
    return
  }
  SKILLS_SetUsedSkillMemPort113c(m, mon, 0)
  const byte15 = resolveMonsterAttackPathByte15(m, mon)
  executeMonsterModeTransition(m, game, mon, 4, 0, byte15, world, hooks)
}

/**
 * Timed summon/trap expiration AI think routine (`MonAI[84]`, `ecx = pGame`, `edx = pMonster`,
 * `[esp+4] = pAiArgs`, `ret 4`): stalls `15` frames while `pAiControl->nExpireFrame (+0x14) >= dwGameFrame`,
 * else clears `pUsedSkill` and transitions `pMonster` to `MONMODE_DEATH` (`0`).
 *
 * @va D2Game:0x6FC36410
 */
export function AI_ThinkTimedExpireOrStall_6FC36410_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pAiArgs: number,
  world?: FallenSliceWorld113c,
  hooks?: LaneIHooks113c,
): void {
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  const pAiCtrl = m.u32(pAiArgs >>> 0) >>> 0
  const gameFrame = m.u32((game + 0xa8) >>> 0) | 0
  const expireFrame = m.u32((pAiCtrl + 0x14) >>> 0) | 0
  if (expireFrame >= gameFrame) {
    executeAiStall(m, game, mon, 0x0f, world)
    return
  }
  SKILLS_SetUsedSkillMemPort113c(m, mon, 0)
  executeMonsterModeTransition(m, game, mon, 0, 0, 0x64, world, hooks)
}

/**
 * Melee / approach AI think routine (`MonAI[90]`, `ecx = pGame`, `edx = pMonster`,
 * `[esp+4] = pAiArgs`, `ret 4`): when `bInMelee != 0`, attacks (`80%` chance) or stalls `10` frames;
 * when `bInMelee == 0`, approaches `pTarget` with `flags = 7` (`50%` chance) or stalls `10` frames.
 *
 * @va D2Game:0x6FC372B0
 */
export function AI_ThinkMeleeOrApproach7_6FC372B0_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pAiArgs: number,
  world?: FallenSliceWorld113c,
  hooks?: LaneIHooks113c,
): void {
  const args = pAiArgs >>> 0
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  const pTarget = m.u32((args + 0x08) >>> 0) >>> 0
  const bInMelee = m.u32((args + 0x18) >>> 0) | 0

  if (bInMelee !== 0) {
    const roll = (stepSeed64At(m, (mon + 0x20) >>> 0) % 0x64) | 0
    if (roll >= 0x50) {
      executeAiStall(m, game, mon, 0x0a, world)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, mon, 0)
    const byte15 = resolveMonsterAttackPathByte15(m, mon)
    executeMonsterModeTransition(m, game, mon, 4, pTarget, byte15, world, hooks)
    return
  }

  const roll = (stepSeed64At(m, (mon + 0x20) >>> 0) % 0x64) | 0
  if (roll >= 0x32) {
    executeAiStall(m, game, mon, 0x0a, world)
    return
  }
  executeAiApproachTarget(m, game, mon, pTarget, 2, 0, 0, 1, 7, world)
}

/**
 * Special guard AI think routine (`SpecialAI[6]`, `ecx = pGame`, `edx = pMonster`,
 * `[esp+4] = pAiArgs`, `ret 4`): stalls `5` frames if not in `MONMODE_NEUTRAL` (`1`), scans
 * non-town rooms for targets (`80%` `AI_StartAttackMode` in melee, `30%` `AI_ApproachTarget` at range),
 * or idle-wanders (`20%`, radius `5`) / stalls `10` frames.
 *
 * @va D2Game:0x6FC39640
 */
export function AI_ThinkSpecialGuard_6FC39640_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pAiArgs: number,
  world?: FallenSliceWorld113c,
  hooks?: LaneIHooks113c,
): void {
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  if (mon === 0 || m.u32((mon + 0x10) >>> 0) !== 1) {
    executeAiStall(m, game, mon, 5, world)
    return
  }

  const pRoom = UNITS_GetRoom113c(m, mon) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) === 0) {
    void m.u32(pAiArgs >>> 0)
    const targetInfo = AI_FindNearestPlayerOrAlly113c(m, game, mon)
    if (targetInfo.pTarget !== 0) {
      if (targetInfo.inMeleeRange !== 0) {
        if (rollUnitSeedLimited(m, (mon + 0x20) >>> 0, 0x64) < 0x50) {
          AI_StartAttackMode113c(m, 4, mon, game, targetInfo.pTarget, world, hooks)
          return
        }
        executeAiStall(m, game, mon, 0x0a, world)
        return
      }
      if (rollUnitSeedLimited(m, (mon + 0x20) >>> 0, 0x64) < 0x1e) {
        executeAiApproachTarget(m, game, mon, targetInfo.pTarget, 2, 0, 0, 1, 7, world)
        return
      }
      executeAiStall(m, game, mon, 0x0a, world)
      return
    }
  }

  const wanderRoll = (stepSeed64At(m, (mon + 0x20) >>> 0) % 0x64) | 0
  if (wanderRoll < 0x14) {
    if (world !== undefined) {
      AI_IdleWanderWorld113c(world, mon, 5)
    } else {
      AI_IdleWander113c(m, game, mon)
    }
    return
  }
  executeAiStall(m, game, mon, 0x0a, world)
}

/**
 * Unlinks and frees the first saved inactive monster matching `wClassId` (`cx`) from
 * `pGame->pInactiveMonsterNodes[nAct]` (`ebx = pGame`, `al = nAct`, `+0xD8 + nAct * 4`),
 * freeing its minion list (`+0x20`) and `D2SaveHeaderBlock` (`+0x24`).
 *
 * @va D2Game:0x6FC3EC40
 */
export function MONREG_DeleteInactiveMonsterByClassId_6FC3EC40_113c(
  m: Memory113c,
  pGame: number,
  nAct: number,
  wClassId: number,
  hooks?: LaneIHooks113c,
): void {
  const game = pGame >>> 0
  const actIdx = nAct & 0xff
  const targetClassId = wClassId & 0xffff
  let pRoomNode = m.u32((game + actIdx * 4 + 0xd8) >>> 0) >>> 0

  while (pRoomNode !== 0) {
    let pMon = m.u32((pRoomNode + 0x0c) >>> 0) >>> 0
    let pPrev = 0
    while (pMon !== 0) {
      if ((m.u32((pMon + 0x08) >>> 0) >>> 0) === targetClassId) {
        const pNextMon = m.u32((pMon + 0x58) >>> 0) >>> 0
        if (pMon === (m.u32((pRoomNode + 0x0c) >>> 0) >>> 0)) {
          m.setU32((pRoomNode + 0x0c) >>> 0, pNextMon)
        } else {
          m.setU32((pPrev + 0x58) >>> 0, pNextMon)
        }

        let pMinion = m.u32((pMon + 0x20) >>> 0) >>> 0
        while (pMinion !== 0) {
          const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
          const pNextMinion = m.u32((pMinion + 0x04) >>> 0) >>> 0
          if (hooks !== undefined && hooks.onFreePoolMem !== undefined) {
            hooks.onFreePoolMem(m, pMemPool, pMinion, 0x246)
          }
          pMinion = pNextMinion
        }

        const pSaveBlock = m.u32((pMon + 0x24) >>> 0) >>> 0
        if (pSaveBlock !== 0) {
          const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
          DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, pSaveBlock)
        }

        const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
        if (hooks !== undefined && hooks.onFreePoolMem !== undefined) {
          hooks.onFreePoolMem(m, pMemPool, pMon, 0x8d)
        }
        return
      }
      pPrev = pMon
      pMon = m.u32((pMon + 0x58) >>> 0) >>> 0
    }
    pRoomNode = m.u32((pRoomNode + 0x14) >>> 0) >>> 0
  }
}

/**
 * Checks whether a monster of `nClassId` (`[esp+0xC]`) is dead/dying at subtile `(nX, nY)`
 * (`ecx = nX`, `eax = nY`, `[esp+4] = pGame`, `[esp+8] = pOriginRoom`, `ret 0xC`), scanning
 * both the active room unit list (`+0x74`) and the inactive room node (`+0xD8`, flag `0x04` at `+0x18`).
 *
 * @va D2Game:0x6FC3EE50
 */
export function MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(
  m: Memory113c,
  nX: number,
  nY: number,
  pGame: number,
  pOriginRoom: number,
  nClassId: number,
  hooks?: LaneIHooks113c,
): number {
  const game = pGame >>> 0
  const originRoom = pOriginRoom >>> 0
  const x = nX | 0
  const y = nY | 0
  if (game === 0) {
    throw new Error('MONREG_IsMonsterDeadAtCoords: pGame == NULL (line 1755)')
  }
  if (originRoom === 0) {
    throw new Error('MONREG_IsMonsterDeadAtCoords: pOriginRoom == NULL (line 1756)')
  }
  if (x === 0 || y === 0) {
    throw new Error('MONREG_IsMonsterDeadAtCoords: nX == 0 || nY == 0 (line 1757)')
  }

  let pRoom = ROOM_FindRoomContainingSubtile113c(m, originRoom, x, y) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, originRoom) | 0
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (pRoom === 0) {
    const pAct = m.u32((game + nAct * 4 + 0xbc) >>> 0) >>> 0
    pRoom = DUNGEON_FindRoomBySubtileCoordinates113c(m, pAct, x, y) >>> 0
  }

  const targetClassId = nClassId | 0
  if (pRoom !== 0) {
    let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
    while (pUnit !== 0) {
      if (m.u32(pUnit) === 1 && (m.u32((pUnit + 0x04) >>> 0) | 0) === targetClassId) {
        if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) {
          return 1
        }
      }
      pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
    }
  }

  let pNode = 0
  if (hooks !== undefined && hooks.pActMonReg !== undefined && pRoom !== 0) {
    pNode = MONREG_FindOrAllocActRoomNode113c(m, hooks.pActMonReg, game, pRoom) >>> 0
  } else {
    let cur = m.u32((game + nAct * 4 + 0xd8) >>> 0) >>> 0
    while (cur !== 0) {
      const nodeX = m.u32(cur) | 0
      if (x === nodeX && y === (m.u32((cur + 0x04) >>> 0) | 0)) {
        pNode = cur
        break
      }
      if (x > nodeX) {
        break
      }
      cur = m.u32((cur + 0x14) >>> 0) >>> 0
    }
  }

  if (pNode !== 0) {
    let pMon = m.u32((pNode + 0x0c) >>> 0) >>> 0
    while (pMon !== 0) {
      if (
        (m.u32((pMon + 0x08) >>> 0) | 0) === targetClassId &&
        (m.u8((pMon + 0x18) >>> 0) & 0x04) !== 0
      ) {
        return 1
      }
      pMon = m.u32((pMon + 0x58) >>> 0) >>> 0
    }
  }
  return 0
}

/**
 * Walks and frees a singly-linked `D2MinionListStrc` chain (`edx = pMinionListHead`,
 * next at `+0x04`, `edi = pGame`, reading `pGame->pMemoryPool` at `+0x1C` on each node).
 *
 * @va D2Game:0x6FC40B30
 */
export function AIGENERAL_FreeMinionList_6FC40B30_113c(
  m: Memory113c,
  pGame: number,
  pMinionListHead: number,
  hooks?: LaneIHooks113c,
): void {
  const game = pGame >>> 0
  let pNode = pMinionListHead >>> 0
  while (pNode !== 0) {
    const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
    const pNext = m.u32((pNode + 0x04) >>> 0) >>> 0
    if (hooks !== undefined && hooks.onFreePoolMem !== undefined) {
      hooks.onFreePoolMem(m, pMemPool, pNode, 0x246)
    }
    pNode = pNext
  }
}

/**
 * Clears leader ownership (`+0x2C = 0xFFFFFFFF`, `+0x30 = 1`, `+0x28 = pGame`) on every active
 * monster in `pAiGeneral->pMinionList` (`eax = pAiGeneral`, `+0x34`). Asserts `pGame != NULL` (`line 723`).
 *
 * @va D2Game:0x6FC41040
 */
export function AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c(
  m: Memory113c,
  pAiGeneral: number,
): void {
  const aiGen = pAiGeneral >>> 0
  const pGame = m.u32((aiGen + 0x28) >>> 0) >>> 0
  let pNode = m.u32((aiGen + 0x34) >>> 0) >>> 0
  while (pNode !== 0) {
    const minionGuid = m.u32(pNode) >>> 0
    if (pGame === 0) {
      throw new Error('AIGENERAL_DissolveMinionPackLeaderRefs: pGame == NULL (line 723)')
    }
    const pMinion = findMonsterInGameHash(m, pGame, minionGuid)
    if (pMinion !== 0 && m.u32(pMinion) === 1) {
      const pMonData = m.u32((pMinion + 0x14) >>> 0) >>> 0
      const pMinionAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
      m.setU32((pMinionAiGen + 0x2c) >>> 0, 0xffffffff)
      m.setU32((pMinionAiGen + 0x30) >>> 0, 1)
      m.setU32((pMinionAiGen + 0x28) >>> 0, pGame)
    }
    pNode = m.u32((pNode + 0x04) >>> 0) >>> 0
  }
}

/**
 * Resolves `pMonster`'s pack leader via `SUNIT_GetServerUnit` and invokes `pfnCallback`
 * (`eax = pMonster`, `ebx = pfnCallback`, `[esp+4] = pArg1`, `[esp+8] = pArg2`, `ret 8`)
 * on every active monster in `pLeader->pMonsterData->pAiGeneral->pMinionList` (`+0x34`).
 * Asserts `!IsBadCodePtr(pfnCallback)` (`line 590`) and `pLeaderAiGen->pGame != NULL` (`line 723`).
 *
 * @va D2Game:0x6FC41490
 */
export function AIGENERAL_ForEachPackMember_6FC41490_113c(
  m: Memory113c,
  pMonster: number,
  pfnCallback: PackMemberCallbackFn113c | number,
  pArg1: number,
  pArg2: number,
  hooks?: LaneIHooks113c,
): void {
  if (typeof pfnCallback === 'number' && (pfnCallback >>> 0) === 0) {
    throw new Error('AIGENERAL_ForEachPackMember: IsBadCodePtr(pfnCallback) (line 590)')
  }
  const mon = pMonster >>> 0
  if (mon === 0 || m.u32(mon) !== 1) return
  const pMonData = m.u32((mon + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGen === 0) return
  const pGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
  if (pGame === 0) return

  const leaderGuid = m.u32((pAiGen + 0x2c) >>> 0) >>> 0
  const leaderType = m.u32((pAiGen + 0x30) >>> 0) | 0
  const pLeader = SUNIT_GetServerUnit113c(m, pGame, leaderType, leaderGuid) >>> 0
  if (pLeader === 0 || m.u32(pLeader) !== 1) return

  const pLeaderMonData = m.u32((pLeader + 0x14) >>> 0) >>> 0
  const pLeaderAiGen = pLeaderMonData !== 0 ? m.u32((pLeaderMonData + 0x28) >>> 0) >>> 0 : 0
  const pLeaderGame = m.u32((pLeaderAiGen + 0x28) >>> 0) >>> 0
  let pNode = m.u32((pLeaderAiGen + 0x34) >>> 0) >>> 0

  while (pNode !== 0) {
    const pNext = m.u32((pNode + 0x04) >>> 0) >>> 0
    const memberGuid = m.u32(pNode) >>> 0
    if (pLeaderGame === 0) {
      throw new Error('AIGENERAL_ForEachPackMember: pGame == NULL (line 723)')
    }
    const pMember = findMonsterInGameHash(m, pLeaderGame, memberGuid)
    if (pMember !== 0) {
      if (typeof pfnCallback === 'function') {
        pfnCallback(m, pMember, pArg1, pArg2)
      } else if (hooks !== undefined && hooks.onPackMemberCallback !== undefined) {
        hooks.onPackMemberCallback(m, pfnCallback >>> 0, pMember, pArg1, pArg2)
      }
    }
    pNode = pNext
  }
}

/**
 * When `pMonster` (`eax`) is its own pack boss (`SUNIT_GetServerUnit == pMonster`), resets
 * owner references (`+0x2C = 0xFFFFFFFF`, `+0x30 = 1`) on every active minion in `pMinionList`
 * (`+0x34`), frees every `D2MinionListStrc` node, and zeroes `pAiGeneral->pMinionList = 0`.
 *
 * @va D2Game:0x6FC41590
 */
export function AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c(
  m: Memory113c,
  pMonster: number,
  hooks?: LaneIHooks113c,
): void {
  const mon = pMonster >>> 0
  if (mon === 0 || m.u32(mon) !== 1) return
  const pMonData = m.u32((mon + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGen === 0) return
  const pGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
  if (pGame === 0) return

  const leaderGuid = m.u32((pAiGen + 0x2c) >>> 0) >>> 0
  const leaderType = m.u32((pAiGen + 0x30) >>> 0) | 0
  const pLeader = SUNIT_GetServerUnit113c(m, pGame, leaderType, leaderGuid) >>> 0
  if (pLeader === 0 || pLeader !== mon || m.u32(pLeader) !== 1) return

  const pLeaderMonData = m.u32((pLeader + 0x14) >>> 0) >>> 0
  const pBossAiGen = pLeaderMonData !== 0 ? m.u32((pLeaderMonData + 0x28) >>> 0) >>> 0 : 0
  let pNode = m.u32((pBossAiGen + 0x34) >>> 0) >>> 0
  const pBossGame = m.u32((pBossAiGen + 0x28) >>> 0) >>> 0

  while (pNode !== 0) {
    const pNext = m.u32((pNode + 0x04) >>> 0) >>> 0
    const memberGuid = m.u32(pNode) >>> 0
    if (pBossGame === 0) {
      throw new Error('AIGENERAL_FreeBossMinionListAndClearRefs: pGame == NULL (line 723)')
    }
    const pMember = findMonsterInGameHash(m, pBossGame, memberGuid)
    if (pMember !== 0 && m.u32(pMember) === 1) {
      const pMemMonData = m.u32((pMember + 0x14) >>> 0) >>> 0
      const pMemAiGen = pMemMonData !== 0 ? m.u32((pMemMonData + 0x28) >>> 0) >>> 0 : 0
      m.setU32((pMemAiGen + 0x2c) >>> 0, 0xffffffff)
      m.setU32((pMemAiGen + 0x30) >>> 0, 1)
      m.setU32((pMemAiGen + 0x28) >>> 0, pBossGame)
    }
    const pMemPool = m.u32((pBossGame + 0x1c) >>> 0) >>> 0
    if (hooks !== undefined && hooks.onFreePoolMem !== undefined) {
      hooks.onFreePoolMem(m, pMemPool, pNode, 0x237)
    }
    pNode = pNext
  }
  m.setU32((pBossAiGen + 0x34) >>> 0, 0)
}

/**
 * `MonUMod` death callback (`ecx = _pGame`, `edx = pMonster`, `[esp+4] = _nUModId`,
 * `[esp+8] = _bUnique`, `ret 8`): sets `STATE_SHATTER` (`0x6B`) on `pMonster` when
 * `pMonster == 0` or `pMonster->dwAnimMode (+0x10) == 0`.
 *
 * @va D2Game:0x6FC41A70
 */
export function MONUMOD_SetShatterOnDeath_6FC41A70_113c(
  m: Memory113c,
  _pGame: number,
  pMonster: number,
  _nUModId: number,
  _bUnique: number,
): void {
  const mon = pMonster >>> 0
  if (mon === 0 || m.u32((mon + 0x10) >>> 0) === 0) {
    STATES_ToggleGfxStateFlag113c(m, mon, 0x6b, 1)
  }
}

/**
 * `MonUMod` death-event scheduler (`ecx = pGame`, `edx = pMonster`, `[esp+4] = nUModId`,
 * `[esp+8] = bUnique`, `ret 8`): schedules `UNITEVENT_MONUMOD` (`7`) at `dwGameFrame + 4`
 * when `(bUnique != 0 || nUModId != 0x12)` and `(pMonster == 0 || pMonster->dwAnimMode == 0)`.
 *
 * @va D2Game:0x6FC41A90
 */
export function MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  nUModId: number,
  bUnique: number,
): void {
  if ((bUnique | 0) === 0 && (nUModId | 0) === 0x12) return
  const mon = pMonster >>> 0
  if (mon !== 0 && m.u32((mon + 0x10) >>> 0) !== 0) return
  const game = pGame >>> 0
  const frame = (m.u32((game + 0xa8) >>> 0) + 4) >>> 0
  EVENT_SetEventFull113c(m, game, mon, 7, frame, 0, 0, 0)
}

/**
 * `MonUMod` get-hit scheduler (`ecx = pGame`, `edx = pMonster`, `[esp+4] = _nUModId`,
 * `[esp+8] = bUnique`, `ret 8`): schedules `UNITEVENT_MONUMOD` (`7`) at `dwGameFrame + 2`
 * when `bUnique != 0`, `pMonster != 0`, and `pMonster->dwAnimMode (+0x10) == 3` (`MONMODE_GETHIT`).
 *
 * @va D2Game:0x6FC41AD0
 */
export function MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  _nUModId: number,
  bUnique: number,
): void {
  if ((bUnique | 0) === 0) return
  const mon = pMonster >>> 0
  if (mon === 0) return
  if (m.u32((mon + 0x10) >>> 0) !== 3) return
  const game = pGame >>> 0
  const frame = (m.u32((game + 0xa8) >>> 0) + 2) >>> 0
  EVENT_SetEventFull113c(m, game, mon, 7, frame, 0, 0, 0)
}

/**
 * `MonUMod` get-hit/death scheduler (`ecx = pGame`, `edx = pMonster`, `[esp+4] = _nUModId`,
 * `[esp+8] = _bUnique`, `ret 8`): schedules `UNITEVENT_MONUMOD` (`7`) at `dwGameFrame + 2`
 * when `pMonster == 0` or `pMonster->dwAnimMode (+0x10)` is `3` (`MONMODE_GETHIT`) or `0` (`MONMODE_DEATH`).
 *
 * @va D2Game:0x6FC41B00
 */
export function MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  _nUModId: number,
  _bUnique: number,
): void {
  const mon = pMonster >>> 0
  if (mon !== 0) {
    const mode = m.u32((mon + 0x10) >>> 0) >>> 0
    if (mode !== 3 && mode !== 0) return
  }
  const game = pGame >>> 0
  const frame = (m.u32((game + 0xa8) >>> 0) + 2) >>> 0
  EVENT_SetEventFull113c(m, game, mon, 7, frame, 0, 0, 0)
}

/**
 * `MonUMod` damage combiner (`ecx = _pGame`, `edx = pMonster`, `[esp+4] = _nUModId`,
 * `[esp+8] = _bUnique`, `ret 8`): when `STAT_MAXDAMAGE (0x16) > 0` and `dwClassId != 0x10F`,
 * folds `STAT_SECONDARY_MINDAMAGE - 1` (`0x17`) and `STAT_SECONDARY_MAXDAMAGE - 1` (`0x18`)
 * (clamped `>= 0`) onto `pMonster`'s flag-`1` statlist.
 *
 * @va D2Game:0x6FC41B30
 */
export function MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c(
  m: Memory113c,
  _pGame: number,
  pMonster: number,
  _nUModId: number,
  _bUnique: number,
): void {
  const mon = pMonster >>> 0
  let minDmg = STATLIST_GetUnitStat113c(m, mon, 0x15, 0) | 0
  let maxDmg = STATLIST_GetUnitStat113c(m, mon, 0x16, 0) | 0
  if (maxDmg <= 0) return
  if (mon !== 0 && (m.u32((mon + 0x04) >>> 0) | 0) === 0x10f) return

  const secMin = STATLIST_GetUnitStat113c(m, mon, 0x17, 0) | 0
  const secMax = STATLIST_GetUnitStat113c(m, mon, 0x18, 0) | 0
  minDmg = (minDmg + secMin - 1) | 0
  maxDmg = (maxDmg + secMax - 1) | 0
  if (minDmg < 0) minDmg = 0
  if (maxDmg < 0) maxDmg = 0

  const pStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, mon, 1) >>> 0
  STATLIST_SetStat113c(m, pStatList, 0x15, minDmg, 0)
  STATLIST_SetStat113c(m, pStatList, 0x16, maxDmg, 0)
}

/**
 * `MonUMod` unique death scheduler (`ecx = pGame`, `edx = pMonster`, `[esp+4] = _nUModId`,
 * `[esp+8] = bUnique`, `ret 8`): schedules `UNITEVENT_MONUMOD` (`7`) at `dwGameFrame + 4`
 * when `bUnique != 0` and `(pMonster == 0 || pMonster->dwAnimMode == 0)`.
 *
 * @va D2Game:0x6FC41BB0
 */
export function MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  _nUModId: number,
  bUnique: number,
): void {
  if ((bUnique | 0) === 0) return
  const mon = pMonster >>> 0
  if (mon !== 0 && m.u32((mon + 0x10) >>> 0) !== 0) return
  const game = pGame >>> 0
  const frame = (m.u32((game + 0xa8) >>> 0) + 4) >>> 0
  EVENT_SetEventFull113c(m, game, mon, 7, frame, 0, 0, 0)
}

/**
 * `MonUMod` slot `4` (`UMOD_LEVELADD`, `ecx = pMonster`, `edx = _nUModId`, `[esp+4] = _bUnique`,
 * `ret 4`): adds `+3` to `STAT_LEVEL` (`0x0C`) and multiplies base `STAT_EXPERIENCE` (`0x0D`) by `5`.
 *
 * @va D2Game:0x6FC41E80
 */
export function MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c(
  m: Memory113c,
  pMonster: number,
  _nUModId = 0,
  _bUnique = 0,
): void {
  const mon = pMonster >>> 0
  if (mon === 0 || m.u32(mon) !== 1) return
  const curLvl = STATLIST_GetUnitStat113c(m, mon, 0x0c, 0) | 0
  STATLIST_SetUnitStat113c(m, mon, 0x0c, (curLvl + 3) | 0, 0)
  const baseExp = STATLIST_GetUnitBaseStat113c(m, mon, 0x0d, 0) | 0
  STATLIST_SetUnitStat113c(m, mon, 0x0d, imul32(baseExp, 5), 0)
}

/**
 * Scales `pMonster` (`ebx`) max life (`STAT_MAXHP = 7`) and current life (`STAT_HITPOINTS = 6`)
 * by `nLifePctBonus` (`edi`), preserving the exact 3-branch overflow-safe `MonsterScalePercent`
 * integer arithmetic (`> 0x100000`, `> 0x10000`, and `__alldiv` 64-bit signed fallback).
 *
 * @va D2Game:0x6FC41EC0
 */
export function MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(
  m: Memory113c,
  pMonster: number,
  nLifePctBonus: number,
): void {
  const mon = pMonster >>> 0
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, mon) | 0
  const pct = nLifePctBonus | 0
  let delta = 0

  if (maxLife > 0x100000) {
    if (((maxLife & -16) | 0) < 0x640) {
      delta = Number((BigInt(maxLife) * BigInt(pct)) / 100n) | 0
    } else {
      delta = imul32(sdiv32(maxLife, 100), pct)
    }
  } else if (pct > 0x10000) {
    if (((pct & -16) | 0) >= 0x640) {
      delta = imul32(sdiv32(pct, 100), maxLife)
    } else {
      delta = Number((BigInt(maxLife) * BigInt(pct)) / 100n) | 0
    }
  } else {
    delta = sdiv32(imul32(maxLife, pct), 100)
  }

  const scaledLife = (maxLife + delta) | 0
  STATLIST_SetUnitStat113c(m, mon, 7, scaledLife, 0)
  STATLIST_SetUnitStat113c(m, mon, 6, scaledLife, 0)
}

/**
 * `MonUMod` slot `6` (`UMOD_FAST` Extra Fast, `ecx = pMonster`, `edx = _nUModId`,
 * `[esp+4] = _bUnique`, `ret 4`): computes `clamp(sdiv32(0x800, MonStatsTxt.wVelocity) - 0x80, 10, 100)`
 * and adds it to `STAT_VELOCITYPERCENT` (`0x43`) via `STATLIST_AddUnitStat`.
 *
 * @va D2Game:0x6FC42880
 */
export function MONUMOD_ApplyExtraFastVelocity_6FC42880_113c(
  m: Memory113c,
  pMonster: number,
  _nUModId = 0,
  _bUnique = 0,
): void {
  const mon = pMonster >>> 0
  if (mon === 0 || m.u32(mon) !== 1) return
  const classId = m.u32((mon + 0x04) >>> 0) | 0
  if (classId < 0) return
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
  if (classId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)) return
  const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
  const pMonStats = (pMonStatsBase + imul32(classId, 0x1a8)) >>> 0
  if (pMonStats === 0) return

  const baseVel = sx16(m.u16((pMonStats + 0x32) >>> 0))
  if (baseVel <= 0) return

  let bonus = (sdiv32(0x800, baseVel) - 0x80) | 0
  if (bonus <= 0x0a) {
    bonus = 0x0a
  } else if (bonus >= 0x64) {
    bonus = 0x64
  }
  STATLIST_AddUnitStatMemPort113c(m, mon, 0x43, bonus, 0)
}

/**
 * `MonUMod` Pain Worm death-spawn callback (`ecx = pGame`, `edx = pMonster`, `[esp+4] = _nUModId`,
 * `[esp+8] = _bUnique`, `ret 8`): when `pMonster == 0 || pMonster->dwAnimMode == 0`, spawns a
 * room-resolved `0x227` (`551`) Pain Worm minion in radius `1` (if room level is non-hidden) and
 * sets `STATE_CORPSE_NODRAW` (`0x68`) on `pMonster`.
 *
 * @va D2Game:0x6FC42B10
 */
export function MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  _nUModId: number,
  _bUnique: number,
  hooks?: LaneIHooks113c,
): void {
  const mon = pMonster >>> 0
  if (mon !== 0 && m.u32((mon + 0x10) >>> 0) !== 0) return
  const pRoom = UNITS_GetRoom113c(m, mon) >>> 0
  if (DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) !== 0) {
    const subClassId = DRLG_ResolveMonsterSubClassIdForRoom113c(m, pRoom, 0x227) | 0
    MONSTER_SpawnPartyMinionInRing113c(m, subClassId, mon, 1, pGame >>> 0, 1, 0, hooks)
  }
  STATES_ToggleGfxStateFlag113c(m, mon, 0x68, 1)
}
