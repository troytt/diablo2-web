/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 5 Batch 7 (w5b7).
 *
 * Clean-room 1:1 binary-isomorphic port of 45 D2Game.dll v1.13c functions in
 * the 0x6FCEFF30..0x6FD02F00 address range (C2S packet handlers, ItemMode
 * inventory/belt/cursor/equip/socket/scroll/charm operations, SUnit lifecycle,
 * and SUnitDmg skill/weapon damage calculation).
 */

import {
  ANIMSEQ_GetEventAtFrame113c,
  UNITS_GetPlayerData113c,
} from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { CHAT_SetUsed113c } from '../common/drlg/drlg-ver'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_FindRoomBySubtileCoordinates113c,
  DUNGEON_FindRoomBySubtileCoords113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import {
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_AutoPlaceItemInBelt113c,
  INVENTORY_AutoPlaceItemInGrid113c,
  INVENTORY_EmptyInventory113c,
  INVENTORY_GetBeltItem113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemBodyLocFromX113c,
  INVENTORY_GetItemDimensionsCallback113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_NoOpRet20113c,
  INVENTORY_NoOpRet8A113c,
  INVENTORY_NoOpRet8B113c,
  INVENTORY_PlaceItemInSocket113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UpdateWeaponGuidOnRemoval113c,
  ITEMS_CanPlayerClassUseItem113c,
  UNITS_GetInventoryRecordId113c,
  UNITS_SetStaticPathPosX113c,
  UNITS_SetStaticPathPosY113c,
} from '../common/inventory'
import {
  ITEMS_AutoPlaceIntoBelt113c,
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckItemFlag113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetInvWidthFromItem113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetItemTypeQuiverFromItem113c,
  ITEMS_GetItemTypeShootsFromItem113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_IsBeltable113c,
  ITEMS_NoOpReturnZero113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOrClearFlagMask113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_AllocDynamicPath113c,
  PATH_ClearPathPointsAndFlag0x20_113c,
  PATH_FreeDynamicPath113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_RemoveUnitCollisionFootprint113c,
  PATH_SetCollisionMask113c,
  PATH_SetUnitCollisionPattern113c,
} from '../common/path'
import {
  UNITS_GetRightSkill113c,
  UNITS_InitStaticPathCoords113c,
} from '../common/quest-record'
import {
  ITEMS_CheckItemTypeIdEquivalent113c,
  SKILLS_GetCharges113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_GetSkillUseFailReason113c,
  SKILLS_GetSkillsTxtFromSkill113c,
  SKILLS_SetCharges113c,
  SKILLS_TestLineOfSightFromUnitToTarget113c,
} from '../common/skills'
import {
  ITEMMODS_UpdateSetItemEquipmentState113c,
  ITEMS_AddChargedSkillStatToItemOrSocket113c,
  STATES_CheckState113c,
  STATES_CheckStateMaskExpOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetExtendedUnitStatsById113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  STATLIST_GetUnitGoldBankLimit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_SetUnitStat113c,
  STATLIST_SetWeaponStatListActive113c,
  STATLIST_UnlinkUnitStatList113c,
} from '../common/statlist'
import {
  CHAT_AllocHoverMsg113c,
  CHAT_FreeHoverMsg113c,
  CHAT_GetTimeoutFromHoverMsg113c,
} from '../common/text'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITROOM_SortUnitListByY113c,
  UNITS_FindFreeCoords113c,
  UNITS_GetAnimOrSeqMode113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetPlayerTargetLeft113c,
  UNITS_GetPlayerTargetRight113c,
  UNITS_GetRoom113c,
  UNITS_SetCollisionMaskAtCoords113c,
  UNITS_SetPathRoomRefreshFlag113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNITS_SetUnitAnimMode113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit'
import {
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
} from '../common/unit-finds'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory'
import {
  DATATBLS_GetQualityItemsTxtRecord113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c'
import {
  SUNITDMG_FreeAttackerCombatList113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import {
  D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c,
  D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c,
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import { SUNITDMG_ComputeWeaponBaseDamage113c } from './combat-a1c-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  ITEMS_AreAffixesEqual113c,
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c,
  ITEMS_DoItemRecordsMatchCodePair113c,
  ITEMS_GetOppositeHandOrRingBodyLoc113c,
  NET_SendRemoveUnitPacket0A113c,
} from './k2-combat-core-w1-113c'
import {
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_DeactivateEquippedItemStats113c,
  ITEMS_GetScrollOrTomeSkillId113c,
  ITEMS_OnEquipScrollOrTome113c,
  ITEMS_OnUnequipScrollOrTome113c,
} from './k2-gap-itemdef-113c'
import {
  MISSILE_ApplyDamageStrcToTarget113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
} from './k2-gap-melee-dot-113c'
import { ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  DRLG_PopulateSingleRoom_6FC4CB80_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_TriggerItemDropped_6FC545A0_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { PLAYER_InitPlacedModesAndEvents_6FC57E20_113c } from './k2-laneK-0x6fc5-w1-113c'
import { ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c } from './k2-w2b1-113c'
import { NET_SendPacket42_ClearCursor_6FCAAF10_113c } from './k2-w2b3-113c'
import {
  ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c,
  ITEMS_OnCharmPlacedInInventory_6FCF6710_113c,
} from './k2-w2b8-113c'
import { ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c } from './k2-w4b1-113c'
import {
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c,
  PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c,
} from './k2-w4b5-113c'
import { SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c } from './k2-w4b6-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import {
  MONSTATS_GetRecordPtr113c,
  MONSTER_InitPlacedMonsterPathAndMode113c,
  MONSTER_ScheduleInitialAiEvent113c,
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_DeactivateUnitStatesAndEvents113c,
  SUNIT_IsUnitInActiveClientRoom113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

/** Isolated reentrant scratch stack pointer for `w5b7` local stack frames. */
let k2W5B7StackPtr = 0x7eb80000

function allocW5B7Stack(m: D2KernMemory113c, size: number): number {
  const aligned = (size + 15) & ~15
  const base = k2W5B7StackPtr >>> 0
  k2W5B7StackPtr = (base + aligned) >>> 0
  for (let i = 0; i < aligned; i += 4) {
    m.setU32((base + i) >>> 0, 0)
  }
  return base
}

function freeW5B7Stack(base: number): void {
  k2W5B7StackPtr = base >>> 0
}

/** `Storm.dll!#501` (`SStrNCpy`): bounded copy with guaranteed NUL termination. */
function stormStrNCpy113c(m: D2KernMemory113c, pDst: number, pSrc: number, maxLen: number): number {
  if (pDst === 0 || pSrc === 0 || maxLen >>> 0 === 0) return 0
  const limit = ((maxLen >>> 0) - 1) >>> 0
  let i = 0
  while (i < limit) {
    const ch = m.u8((pSrc + i) >>> 0)
    if (ch === 0) break
    m.setU8((pDst + i) >>> 0, ch)
    i++
  }
  m.setU8((pDst + i) >>> 0, 0)
  return i
}

/** `Storm.dll!#506` (`SStrLen`): byte length of NUL-terminated string. */
function stormStrLen113c(m: D2KernMemory113c, pStr: number): number {
  if (pStr === 0) return 0
  let len = 0
  while (m.u8((pStr + len) >>> 0) !== 0) {
    len++
  }
  return len
}

/** `Storm.dll!#571` (`SStrChr`): pointer to first occurrence of non-NUL `ch`, or `0`. */
function stormStrChr113c(m: D2KernMemory113c, pStr: number, ch: number): number {
  if (pStr === 0) return 0
  const target = ch & 0xff
  let cur = pStr >>> 0
  let b = m.u8(cur)
  if (b === 0) return 0
  while (true) {
    if (b === target) return cur
    cur = (cur + 1) >>> 0
    b = m.u8(cur)
    if (b === 0) return 0
  }
}

/**
 * C2S `0x59` (`MakeEntityMove`) handler: validates town NPC flags (`inTown` & `isNpc`),
 * clears path points and pending `EVENTTYPE_AITHINK` (`2`) events, schedules `AITHINK` at
 * `dwGameFrame + 1`, and writes `(40, nTargetX, nTargetY)` into `pAiGeneral + 0x14..0x1C`.
 *
 * @va D2Game:0x6FCEFF30
 */
export function PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEFF30)
  if ((nPacketSize >>> 0) !== 0x11) {
    return 3
  }
  const dwEntityType = m.u32((pPacket + 1) >>> 0) >>> 0
  const dwEntityGuid = m.u32((pPacket + 5) >>> 0) >>> 0
  const nTargetX = m.u32((pPacket + 9) >>> 0) >>> 0
  const nTargetY = m.u32((pPacket + 13) >>> 0) >>> 0
  if (dwEntityType >= 6) {
    return 2
  }
  const pNpc = SUNIT_GetServerUnit113c(m, pGame, dwEntityType, dwEntityGuid) >>> 0
  if (pNpc === 0) {
    return 1
  }
  if ((UNITS_GetDistanceToOtherUnit113c(m, pPlayer, pNpc) | 0) > 0x32) {
    return 1
  }
  const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, m.u32((pNpc + 4) >>> 0) | 0) >>> 0
  if (pMonStatsTxt === 0) {
    return 1
  }
  const bMonFlags1 = m.u8((pMonStatsTxt + 0x0d) >>> 0)
  const pBitMasks = m.u32(0x6fd18be0) >>> 0
  if ((m.u32((pBitMasks + 4) >>> 0) & bMonFlags1) === 0) {
    return 1
  }
  if ((m.u32(pBitMasks) & bMonFlags1) === 0) {
    return 1
  }
  const pPath = m.u32((pNpc + 0x2c) >>> 0) >>> 0
  if (pPath !== 0) {
    PATH_ClearPathPointsAndFlag0x20_113c(m, pPath)
  }
  let pEv = m.u32((pNpc + 0xdc) >>> 0) >>> 0
  while (pEv !== 0) {
    const pNextEv = m.u32((pEv + 0x24) >>> 0) >>> 0
    if (m.u8(pEv) === 2) {
      EVENT_FreeNode113c(m, pGame, pEv)
    }
    pEv = pNextEv
  }
  const nNextFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, pNpc, 2, nNextFrame, 0, 0, 0)
  if (m.u32(pNpc) === 1) {
    const pMonData0 = m.u32((pNpc + 0x14) >>> 0) >>> 0
    if (pMonData0 !== 0) {
      const pAiGen0 = m.u32((pMonData0 + 0x28) >>> 0) >>> 0
      if (pAiGen0 !== 0) {
        m.setU32((pAiGen0 + 0x14) >>> 0, 0x28)
      }
    }
  }
  if (m.u32(pNpc) === 1) {
    const pMonData1 = m.u32((pNpc + 0x14) >>> 0) >>> 0
    if (pMonData1 !== 0) {
      const pAiGen1 = m.u32((pMonData1 + 0x28) >>> 0) >>> 0
      if (pAiGen1 !== 0) {
        m.setU32((pAiGen1 + 0x18) >>> 0, nTargetX)
      }
    }
  }
  if (m.u32(pNpc) === 1) {
    const pMonData2 = m.u32((pNpc + 0x14) >>> 0) >>> 0
    if (pMonData2 !== 0) {
      const pAiGen2 = m.u32((pMonData2 + 0x28) >>> 0) >>> 0
      if (pAiGen2 !== 0) {
        m.setU32((pAiGen2 + 0x1c) >>> 0, nTargetY)
      }
    }
  }
  return 0
}

/**
 * C2S `0x14` (`OverheadChat`) inner handler: validates packet bounds (`4..275`), rejects
 * `0xFF` color-escape bytes, replaces `pUnit->pHoverText (+0xA4)`, sets unit update flag
 * `0x100`, and schedules `EVENTTYPE_FREEHOVER` (`6`).
 *
 * @va D2Game:0x6FCF00A0
 */
export function PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCF00A0)
  const sz = nPacketSize >>> 0
  if (sz < 4 || sz > 0x113) {
    return 3
  }
  const frameBase = allocW5B7Stack(m, 0x110)
  try {
    const pNameBuf = frameBase >>> 0
    const pMsgBuf = (frameBase + 0x10) >>> 0
    const pSrcMsg = (pPacket + 3) >>> 0
    stormStrNCpy113c(m, pMsgBuf, pSrcMsg, 0x100)
    const msgLen = stormStrLen113c(m, pSrcMsg) | 0
    if (msgLen >= 0x100) {
      return 2
    }
    stormStrNCpy113c(m, pNameBuf, (pPacket + msgLen + 4) >>> 0, 0x10)
    if (stormStrChr113c(m, pMsgBuf, 0xff) !== 0) {
      return 0
    }
    if (pUnit !== 0) {
      const pOldHover = m.u32((pUnit + 0xa4) >>> 0) >>> 0
      if (pOldHover !== 0) {
        CHAT_FreeHoverMsg113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, pOldHover)
      }
    }
    const pHover =
      CHAT_AllocHoverMsg113c(
        m,
        m.u32((pGame + 0x1c) >>> 0) >>> 0,
        pMsgBuf,
        m.u32((pGame + 0xa8) >>> 0) >>> 0,
      ) >>> 0
    if (pHover !== 0) {
      CHAT_SetUsed113c(m, pHover, m.u8((pPacket + 2) >>> 0))
      if (pUnit !== 0) {
        m.setU32((pUnit + 0xa4) >>> 0, pHover)
      }
      UNITROOM_RefreshUnit113c(m, pUnit)
      if (pUnit !== 0) {
        m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x100) >>> 0)
      }
      let nTimeout = CHAT_GetTimeoutFromHoverMsg113c(m, pHover) | 0
      const nMinFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 1) | 0
      if (nMinFrame > nTimeout) {
        nTimeout = nMinFrame
      }
      EVENT_SetEventFull113c(m, pGame, pUnit, 6, nTimeout >>> 0, 0, 0, 0)
    }
    return 0
  } finally {
    freeW5B7Stack(frameBase)
  }
}

/**
 * Resolves the `Books.txt` book skill (`+0x0C` for `ITEMTYPE_BOOK = 0x12`) or scroll skill
 * (`+0x08` for `ITEMTYPE_SCROLL = 0x16`), returning `-1` otherwise.
 *
 * @va D2Game:0x6FCF17B0
 */
export function ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(
  m: D2KernMemory113c,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FCF17B0)
  let nSkillId = -1
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x12) !== 0) {
    const nBookIdx = ITEMS_GetMagicSuffix113c(m, pItem, 0) & 0xffff
    const pBookTxt = DATATBLS_GetQualityItemsTxtRecord113c(m, nBookIdx) >>> 0
    if (pBookTxt === 0) {
      throw new D2CommonAssertError('ItemMode.cpp', 0xfa5)
    }
    nSkillId = m.u32((pBookTxt + 0x0c) >>> 0) | 0
    return nSkillId
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x16) !== 0) {
    const nBookIdx = ITEMS_GetMagicSuffix113c(m, pItem, 0) & 0xffff
    const pBookTxt = DATATBLS_GetQualityItemsTxtRecord113c(m, nBookIdx) >>> 0
    if (pBookTxt === 0) {
      throw new D2CommonAssertError('ItemMode.cpp', 0xfac)
    }
    nSkillId = m.u32((pBookTxt + 0x08) >>> 0) | 0
  }
  return nSkillId
}

/**
 * Searches `pUnit->pInventory (+0x60)` on page `0` for an `ITEMTYPE_BOOK` (`0x12`) with
 * matching affixes (`ITEMS_AreAffixesEqual`) and room remaining below `ITEMS_GetTotalMaxStack`,
 * writing `(nMaxStack - nQty)` to `*pOutSpaceRemaining`.
 *
 * @va D2Game:0x6FCF1B20
 */
export function ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c(
  m: D2KernMemory113c,
  pScrollItem: number,
  pUnit: number,
  pOutSpaceRemaining: number,
): number {
  hitD2GameVa113c(0x6FCF1B20)
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pScrollItem, 0x16) === 0) {
    return 0
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return 0
  }
  let pCur = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (pCur !== 0) {
    const pCandidate = INVENTORY_UnitIsItem113c(m, pCur) >>> 0
    pCur = INVENTORY_GetNextItem113c(m, pCur) >>> 0
    if (pCandidate === 0) {
      continue
    }
    if ((ITEMS_GetItemTypeFromItem113c(m, pCandidate) | 0) !== 0x12) {
      continue
    }
    if ((ITEMS_GetInvPage113c(m, pCandidate) & 0xff) !== 0) {
      continue
    }
    if (ITEMS_AreAffixesEqual113c(m, pCandidate, pScrollItem) === 0) {
      continue
    }
    let nQty = STATLIST_GetUnitStat113c(m, pCandidate, 0x46, 0) | 0
    if (nQty < 0) {
      nQty = 0
    }
    const nMaxStack = ITEMS_GetTotalMaxStack113c(m, pCandidate) | 0
    if (nQty >= nMaxStack) {
      continue
    }
    m.setU32(pOutSpaceRemaining >>> 0, (nMaxStack - nQty) >>> 0)
    return pCandidate
  }
  return 0
}

/**
 * Checks paired weapon/shield/quiver/ring slot compatibility when auto-equipping `pItem` on `pUnit`,
 * swapping `*ppPrimaryItem` / `*ppSecondaryItem` and `*pInOutBodyLoc` when the secondary slot holds
 * the existing item.
 *
 * @va D2Game:0x6FCF1C00
 */
export function ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c(
  m: D2KernMemory113c,
  pInOutBodyLoc: number,
  pItem: number,
  ppPrimaryItem: number,
  pUnit: number,
  ppSecondaryItem: number,
): number {
  hitD2GameVa113c(0x6FCF1C00)
  if (pUnit === 0 || pItem === 0 || m.u32(pItem >>> 0) !== 4) {
    return 0
  }
  const pSec0 = m.u32(ppSecondaryItem >>> 0) >>> 0
  const pPri0 = m.u32(ppPrimaryItem >>> 0) >>> 0
  if (pSec0 === 0) {
    if (pPri0 === 0) {
      return 1
    }
  } else if (pPri0 !== 0) {
    return 0
  }
  const oppBodyLoc = ITEMS_GetOppositeHandOrRingBodyLoc113c(m, m.u32(pInOutBodyLoc >>> 0) | 0)
  if (pSec0 !== 0) {
    m.setU32(ppSecondaryItem >>> 0, pPri0)
    m.setU32(ppPrimaryItem >>> 0, pSec0)
    m.setU32(pInOutBodyLoc >>> 0, oppBodyLoc >>> 0)
  }
  const nBodyLoc = m.u32(pInOutBodyLoc >>> 0) | 0
  const rel = (nBodyLoc - 4) >>> 0
  if (rel > 8 || (rel >= 2 && rel <= 6)) {
    return m.u32(ppSecondaryItem >>> 0) === 0 ? 1 : 0
  }
  const nQuiverA = ITEMS_GetItemTypeQuiverFromItem113c(m, pItem) | 0
  if (nQuiverA > 0) {
    const pPri = m.u32(ppPrimaryItem >>> 0) >>> 0
    if (pPri === 0) {
      return 1
    }
    const reqType = ITEMS_GetItemTypeQuiverFromItem113c(m, pItem) | 0
    return ITEMS_CheckItemTypeIdMemPort113c(m, pPri, reqType) !== 0 ? 1 : 0
  }
  const nShootsA = ITEMS_GetItemTypeShootsFromItem113c(m, pItem) | 0
  if (nShootsA !== 0) {
    const pPri = m.u32(ppPrimaryItem >>> 0) >>> 0
    if (pPri === 0) {
      return 1
    }
    if ((ITEMS_GetItemTypeQuiverFromItem113c(m, pPri) | 0) <= 0) {
      return 0
    }
    const reqQuiv = ITEMS_GetItemTypeQuiverFromItem113c(m, pPri) | 0
    return ITEMS_CheckItemTypeIdMemPort113c(m, pItem, reqQuiv) !== 0 ? 1 : 0
  }
  const pPriQuiv = m.u32(ppPrimaryItem >>> 0) >>> 0
  if ((ITEMS_GetItemTypeQuiverFromItem113c(m, pPriQuiv) | 0) > 0) {
    const reqQuiv = ITEMS_GetItemTypeQuiverFromItem113c(m, pPriQuiv) | 0
    return ITEMS_CheckItemTypeIdMemPort113c(m, pItem, reqQuiv) !== 0 ? 1 : 0
  }
  const pPriShoots = m.u32(ppPrimaryItem >>> 0) >>> 0
  if ((ITEMS_GetItemTypeShootsFromItem113c(m, pPriShoots) | 0) > 0) {
    const reqShoots = ITEMS_GetItemTypeShootsFromItem113c(m, pPriShoots) | 0
    return ITEMS_CheckItemTypeIdMemPort113c(m, pItem, reqShoots) !== 0 ? 1 : 0
  }
  if (ITEMS_GetInvWidthFromItem113c(m, pItem) !== 0) {
    if (ITEMS_CanPlayerClassUseItem113c(m, pUnit, pItem) === 0) {
      return 0
    }
  }
  const pPri2H = m.u32(ppPrimaryItem >>> 0) >>> 0
  if (ITEMS_GetInvWidthFromItem113c(m, pPri2H) !== 0) {
    if (ITEMS_CanPlayerClassUseItem113c(m, pUnit, pPri2H) === 0) {
      return 0
    }
  }
  const bIsWepA = ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x2d)
  const pPriWep = m.u32(ppPrimaryItem >>> 0) >>> 0
  const bIsWepB = ITEMS_CheckItemTypeIdMemPort113c(m, pPriWep, 0x2d)
  if (bIsWepA === 0) {
    if (bIsWepB === 0) {
      return 0
    }
    return m.u32(ppSecondaryItem >>> 0) === 0 ? 1 : 0
  }
  if (bIsWepB === 0) {
    return m.u32(ppSecondaryItem >>> 0) === 0 ? 1 : 0
  }
  if (m.u32(pUnit >>> 0) === 1) {
    return 1
  }
  const nClassId = m.u32((pUnit + 4) >>> 0) | 0
  if (nClassId === 4) {
    return 1
  }
  if (nClassId !== 6) {
    return 0
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x43) === 0) {
    return 0
  }
  const pPriClaw = m.u32(ppPrimaryItem >>> 0) >>> 0
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pPriClaw, 0x43) === 0) {
    return 0
  }
  return 1
}

/**
 * Populates a `0x28`-byte `D2HandItemFlagsStrc` (`pOutHandFlags`) describing bow/crossbow/quiver/
 * shield/weapon/two-handed/dual-wield/throwable/ring properties of `pItem` for `pUnit`.
 *
 * @va D2Game:0x6FCF1F60
 */
export function ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  pOutHandFlags: number,
): void {
  hitD2GameVa113c(0x6FCF1F60)
  if (pItem === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x676)
  }
  if (pUnit === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x677)
  }
  const out = pOutHandFlags >>> 0
  for (let off = 0; off < 0x28; off += 4) {
    m.setU32((out + off) >>> 0, 0)
  }
  if (m.u32(pUnit >>> 0) === 0 && m.u32((pUnit + 4) >>> 0) === 4) {
    m.setU32((out + 0x1c) >>> 0, 1)
  }
  if (
    m.u32(pUnit >>> 0) === 0 &&
    m.u32((pUnit + 4) >>> 0) === 6 &&
    ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x43) !== 0
  ) {
    m.setU32((out + 0x1c) >>> 0, 1)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x1b) !== 0) {
    m.setU32(out, 1)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x23) !== 0) {
    m.setU32((out + 0x04) >>> 0, 1)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x05) !== 0) {
    m.setU32((out + 0x08) >>> 0, 1)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x06) !== 0) {
    m.setU32((out + 0x0c) >>> 0, 1)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x33) !== 0) {
    m.setU32((out + 0x10) >>> 0, 1)
  }
  if (ITEMS_GetInvWidthFromItem113c(m, pItem) !== 0) {
    m.setU32((out + 0x18) >>> 0, 1)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x2d) !== 0) {
    m.setU32((out + 0x14) >>> 0, 1)
  }
  if (
    ITEMS_CheckIfThrowItemMemPort113c(m, pItem) !== 0 ||
    STATLIST_GetUnitStatWithLayer113c(m, pItem, 0x7d, 0) !== 0
  ) {
    m.setU32((out + 0x20) >>> 0, 1)
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, 0x0a) !== 0) {
    m.setU32((out + 0x24) >>> 0, 1)
  }
}

/**
 * Checks if any item in `pFirstInvItem` (stopping before `pCandidateItem`, ignoring `invPage == 1`)
 * conflicts with `pCandidateItem` via `UniqueItems.txt` `carry1` (`bit 2`) or duplicate/composite
 * quest item codes (`j34`/`g34`, `bks`/`bkd`, `d33`/`g33`, `hst`/`msf`/`vip`, `qf2`/`qf1`/`qhr`/`qey`/`qbr`).
 *
 * @va D2Game:0x6FCF2070
 */
export function ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c(
  m: D2KernMemory113c,
  pFirstInvItem: number,
  pCandidateItemsTxt: number,
  pCandidateItem: number,
): number {
  hitD2GameVa113c(0x6FCF2070)
  let nCarry1UniqueId = -1
  if (pCandidateItem !== 0 && m.u32(pCandidateItem >>> 0) === 4) {
    if ((ITEMS_GetItemQuality113c(m, pCandidateItem) | 0) === 7) {
      if ((ITEMS_GetItemCell113c(m, pCandidateItem) | 0) >= 0) {
        const nFileIdx = ITEMS_GetItemCell113c(m, pCandidateItem) | 0
        if (nFileIdx >= 0) {
          const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
          if (nFileIdx < (m.u32((pDataTables + 0xc28) >>> 0) | 0)) {
            const pUniqBase = m.u32((pDataTables + 0xc24) >>> 0) >>> 0
            const pUniqTxt = (pUniqBase + Math.imul(nFileIdx, 0x14c)) >>> 0
            if (pUniqTxt !== 0) {
              const bFlags = m.u8((pUniqTxt + 0x2c) >>> 0)
              const pBitMasks = m.u32(0x6fd18be0) >>> 0
              if ((m.u8((pBitMasks + 8) >>> 0) & bFlags) !== 0) {
                nCarry1UniqueId = (m.u16(pUniqTxt) << 16) >> 16
              }
            }
          }
        }
      }
    }
  }
  if (pFirstInvItem === 0) {
    return 0
  }
  let pCur = pFirstInvItem >>> 0
  while (pCur !== 0) {
    const pItem = INVENTORY_UnitIsItem113c(m, pCur) >>> 0
    const pNext = INVENTORY_GetNextItem113c(m, pCur) >>> 0
    if (pItem === (pCandidateItem >>> 0)) {
      return 0
    }
    if (pItem !== 0 && m.u32(pItem) === 4) {
      if (nCarry1UniqueId >= 0) {
        if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) !== 1) {
          if ((ITEMS_GetItemQuality113c(m, pItem) | 0) === 7) {
            if ((ITEMS_GetItemCell113c(m, pItem) | 0) === nCarry1UniqueId) {
              return 1
            }
          }
        }
      }
      const pItemTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pItem + 4) >>> 0) | 0) >>> 0
      const bQuest = m.u8((pItemTxt + 0x12a) >>> 0)
      if (bQuest !== 0 && (ITEMS_GetInvPage113c(m, pItem) & 0xff) !== 1) {
        if (bQuest === m.u8((pCandidateItemsTxt + 0x12a) >>> 0)) {
          const cA = m.u32((pCandidateItemsTxt + 0x80) >>> 0) >>> 0
          const cB = m.u32((pItemTxt + 0x80) >>> 0) >>> 0
          if (cA === cB) return 1
          if (
            (cA === 0x2034336a && cB === 0x20343367) ||
            (cA === 0x20343367 && cB === 0x2034336a) ||
            (cA === 0x20736b62 && cB === 0x20646b62) ||
            (cA === 0x20646b62 && cB === 0x20736b62) ||
            (cA === 0x20333364 && cB === 0x20333367) ||
            (cA === 0x20333367 && cB === 0x20333364) ||
            (cA === 0x20747368 && cB === 0x2066736d) ||
            (cA === 0x2066736d && cB === 0x20747368) ||
            (cA === 0x20747368 && cB === 0x20706976) ||
            (cA === 0x20706976 && cB === 0x20747368) ||
            (cA === 0x20326671 && cB === 0x20316671) ||
            (cA === 0x20316671 && cB === 0x20326671)
          ) {
            return 1
          }
          if (
            ITEMS_DoItemRecordsMatchCodePair113c(m, pCandidateItemsTxt, pItemTxt, 0x20326671, 0x20726871) !== 0 ||
            ITEMS_DoItemRecordsMatchCodePair113c(m, pCandidateItemsTxt, pItemTxt, 0x20326671, 0x20796571) !== 0 ||
            ITEMS_DoItemRecordsMatchCodePair113c(m, pCandidateItemsTxt, pItemTxt, 0x20326671, 0x20726271) !== 0
          ) {
            return 1
          }
        }
      }
    }
    pCur = pNext
  }
  return 0
}

/**
 * Returns `1` iff `pSkill` requires a missile weapon (`wITypeA[0]` equivalent to `0x30`),
 * has `bRange == 2` (`+0x14`), and is not blocked with fail reason `2` or `7` on `pUnit`.
 *
 * @va D2Game:0x6FCF22C0
 */
export function ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c(
  m: D2KernMemory113c,
  pSkill: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCF22C0)
  if (pSkill === 0) {
    return 0
  }
  const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(m, pSkill) >>> 0
  if (pSkillsTxt === 0) {
    return 0
  }
  const nItypeA0 = (m.u16((pSkillsTxt + 0x18) >>> 0) << 16) >> 16
  if (nItypeA0 <= 0) {
    return 0
  }
  if (ITEMS_CheckItemTypeIdEquivalent113c(m, nItypeA0, 0x30) === 0) {
    return 0
  }
  if (m.u8((pSkillsTxt + 0x14) >>> 0) !== 2) {
    return 0
  }
  return ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c(m, pUnit, pSkill) !== 0 ? 1 : 0
}

/**
 * Restores a player's saved weapon-switch hand skill (`bLeft != 0` via `0x6FD7F7A0`,
 * `bLeft == 0` via `0x6FD7F800`) if it differs from `pCurrentSkill` and does not fail
 * with reason `2` or `7`.
 *
 * @va D2Game:0x6FCF2310
 */
export function ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pCurrentSkill: number,
  bLeft: number,
): void {
  hitD2GameVa113c(0x6FCF2310)
  if (pUnit === 0 || pCurrentSkill === 0) {
    return
  }
  const frameBase = allocW5B7Stack(m, 0x10)
  try {
    const pOutGuid = frameBase >>> 0
    const pOutSkillId = (frameBase + 4) >>> 0
    if (bLeft !== 0) {
      UNITS_GetPlayerTargetRight113c(m, pUnit, pOutSkillId, pOutGuid)
    } else {
      UNITS_GetPlayerTargetLeft113c(m, pUnit, pOutSkillId, pOutGuid)
    }
    const dwGuid = m.u32(pOutGuid) >>> 0
    const nSkillId = m.u32(pOutSkillId) | 0
    const pSkill = SKILLS_GetSkillById113c(m, pUnit, nSkillId, dwGuid) >>> 0
    if (pSkill === 0 || pSkill === (pCurrentSkill >>> 0)) {
      return
    }
    const nFail = SKILLS_GetSkillUseFailReason113c(m, pUnit, pSkill) | 0
    if (nFail === 2 || nFail === 7) {
      return
    }
    SKILLS_AssignHandSkillAndSyncAura113c(m, pUnit, bLeft, m.u32(pOutSkillId) | 0, m.u32(pOutGuid) >>> 0)
  } finally {
    freeW5B7Stack(frameBase)
  }
}

/**
 * Recharges all `STAT_ITEM_CHARGED_SKILL` (`0xCC`) entries on `pItem` where `curCharges < maxCharges`
 * up to `maxCharges`, syncing each updated stat via S2C `0x3E` if `pOwnerUnit` is a player with a client.
 *
 * @va D2Game:0x6FCF2380
 */
export function ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOwnerUnit: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FCF2380)
  if (pGame === 0 || pItem === 0 || m.u32(pItem >>> 0) !== 4) {
    return 0
  }
  let pClient = 0
  if (pOwnerUnit !== 0 && m.u32(pOwnerUnit >>> 0) === 0) {
    const pPlrData = UNITS_GetPlayerData113c(m, pOwnerUnit) >>> 0
    pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
  }
  const pStatsBuf = allocW5B7Stack(m, 0x200)
  try {
    const nCount = STATLIST_GetExtendedUnitStatsById113c(m, pItem, 0xcc, pStatsBuf, 0x40) | 0
    let bRecharged = 0
    if (nCount > 0) {
      for (let i = 0; i < nCount; i++) {
        const wLayer = m.u16((pStatsBuf + i * 8) >>> 0)
        const pDataTables0 = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
        const dwLevelMask = m.u32((pDataTables0 + 0xc70) >>> 0)
        const nShift = m.u32((pDataTables0 + 0xc6c) >>> 0) & 0x1f
        const nLevel = (dwLevelMask & wLayer) | 0
        const nSkillId = wLayer >> nShift
        const dwVal = m.u32((pStatsBuf + i * 8 + 4) >>> 0)
        const nMaxCharges = (dwVal | 0) >> 8
        const nCurCharges = dwVal & 0xff
        if ((nCurCharges | 0) < nMaxCharges) {
          ITEMS_AddChargedSkillStatToItemOrSocket113c(m, pItem, nSkillId, nLevel, nMaxCharges)
          bRecharged = 1
          if (pClient !== 0) {
            const pDataTables1 = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
            const nShift1 = m.u32((pDataTables1 + 0xc6c) >>> 0) & 0x1f
            const wMask1 = m.u16((pDataTables1 + 0xc70) >>> 0)
            const wOutLayer = ((nSkillId << nShift1) + (wMask1 & nLevel)) >>> 0
            const dwOutVal = ((nMaxCharges & 0xff) + (nMaxCharges << 8)) >>> 0
            NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, wOutLayer, pClient, 1, 0xcc, dwOutVal)
          }
        }
      }
    }
    return bRecharged
  } finally {
    freeW5B7Stack(pStatsBuf)
  }
}

/**
 * Snapshots `pUnit` stats/skills, unlinks and re-attaches all owned inventory item stat lists
 * preserving their dynamic/weapon active flags, and restores hand skills from snapshot.
 *
 * @va D2Game:0x6FCF24B0
 */
export function ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c(
  m: D2KernMemory113c,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCF24B0)
  if (pUnit === 0) {
    return
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return
  }
  const frameBase = allocW5B7Stack(m, 0x20)
  try {
    const pFlagOut = frameBase >>> 0
    const pSnapshot = (frameBase + 4) >>> 0
    D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c(m, pUnit, pSnapshot)
    let pCur = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
    while (pCur !== 0) {
      const pNext = INVENTORY_GetNextItem113c(m, pCur) >>> 0
      const pItem = INVENTORY_UnitIsItem113c(m, pCur) >>> 0
      m.setU32(pFlagOut, 0)
      if (pItem !== 0 && m.u32(pItem) === 4) {
        if (STATLIST_GetOwnerAndDynamicFlag113c(m, pItem, pFlagOut) !== 0) {
          STATLIST_UnlinkUnitStatList113c(m, pUnit, pItem)
          STATLIST_SetWeaponStatListActive113c(m, pUnit, pItem, m.u32(pFlagOut) | 0)
        }
      }
      pCur = pNext
    }
    D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c(m, pUnit, pSnapshot, {
      assignUnitSkill: SKILLS_AssignHandSkillAndSyncAura113c,
    })
  } finally {
    freeW5B7Stack(frameBase)
  }
}

/**
 * Compacts belt column `nBeltSlot & 3` downward across rows `0..3` on `pUnit`, updating
 * command flags (`0x400`, `0x1`, clearing `0x4000`), unit update flags, and inventory GUID nodes.
 *
 * @va D2Game:0x6FCF2540
 */
export function ITEMS_CompactBeltColumnDown_6FCF2540_113c(
  m: D2KernMemory113c,
  nBeltSlot: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCF2540)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  let col = nBeltSlot & 3
  if (col <= 0) {
    col = 0
  } else if (col >= 3) {
    col = 3
  }
  let nDstRow = 0
  let nSrcRow = 0
  let nSrcSlot = col
  let nDstSlot = col
  while (nSrcRow < 4) {
    const pItem = INVENTORY_GetBeltItem113c(m, pInventory, nSrcSlot) >>> 0
    if (pItem !== 0) {
      if (nDstRow !== nSrcRow) {
        ITEMS_AutoPlaceIntoBelt113c(m, pInventory, pItem, nDstSlot)
        ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x400, 1)
        ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1)
        if (ITEMS_CheckCommandFlags113c(m, pItem, 0x4000, 0x1314, 0x6fd1b14c) !== 0) {
          ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x4000, 0)
        }
        UNITS_SetUnitUpdateFlags113c(m, pUnit, 1)
        INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem)
        INVENTORY_NoOpRet8A113c(m, pInventory, nSrcSlot)
      }
      nDstRow++
      nDstSlot += 4
    }
    nSrcRow++
    nSrcSlot += 4
  }
}

/**
 * Registers `pItem` in its room portal/delete node list, clears `invPage` (`0xFF`), sets item flag
 * `0x1000` and ground mode (`3`), and records `wActionType` + owner refresh (`0x400`) on `pOwnerUnit`.
 *
 * @va D2Game:0x6FCF2840
 */
export function ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c(
  m: D2KernMemory113c,
  pItem: number,
  pOwnerUnit: number,
  wActionType: number,
): void {
  hitD2GameVa113c(0x6FCF2840)
  const dwUnitType = pItem === 0 ? 6 : (m.u32(pItem >>> 0) >>> 0)
  const dwUnitGuid = pItem === 0 ? 0xffffffff : (m.u32((pItem + 0x0c) >>> 0) >>> 0)
  const pRoom = UNITS_GetRoom113c(m, pItem) >>> 0
  DUNGEON_AddRoomPortalNode113c(m, pRoom, dwUnitType, dwUnitGuid)
  ITEMS_SetInvPage113c(m, pItem, 0xff)
  if (pItem !== 0) {
    m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) | 0x1000) >>> 0)
  }
  UNITS_ChangeAnimMode113c(m, pItem, 3)
  if (pOwnerUnit === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x558)
  }
  m.setU16((pOwnerUnit + 0x6e) >>> 0, wActionType & 0xffff)
  m.setU32((pOwnerUnit + 0x70) >>> 0, pOwnerUnit >>> 0)
  UNITROOM_RefreshUnit113c(m, pOwnerUnit)
  m.setU32((pOwnerUnit + 0xc4) >>> 0, (m.u32((pOwnerUnit + 0xc4) >>> 0) | 0x400) >>> 0)
}

/**
 * Zeros scroll/tome skill charges on `pUnit` for `pItem` and sends S2C `0x22` (`bCount = 0`).
 *
 * @va D2Game:0x6FCF2BE0
 */
export function ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCF2BE0)
  const nSkillId = ITEMS_GetScrollOrTomeSkillId113c(m, pItem) | 0
  if (nSkillId === -1) {
    return
  }
  STATLIST_GetUnitStat113c(m, pItem, 0x46, 0)
  const pSkill = SKILLS_GetSkillById113c(m, pUnit, nSkillId, -1) >>> 0
  if (pSkill !== 0) {
    SKILLS_GetCharges113c(m, pSkill)
  }
  SKILLS_SetCharges113c(m, pSkill, 0)
  if (pUnit === 0) {
    NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, 0, 6, 0xffffffff, nSkillId, 0)
    return
  }
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  const dwUnitGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0
  if (dwUnitType !== 0) {
    NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, 0, dwUnitType, dwUnitGuid, nSkillId, 0)
    return
  }
  const pPlrData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
  const pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, pClient, 0, dwUnitGuid, nSkillId, 0)
}

/**
 * Destroys `pItem` if it matches `pUnit`'s cursor item, sending S2C `0x42` clear-cursor,
 * unlinking from all living players' inventories/cursors, and freeing `pItem`.
 *
 * @va D2Game:0x6FCF2C70
 */
export function ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pItem: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCF2C70)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pItem === 0) {
    return 0
  }
  if ((INVENTORY_GetCursorItem113c(m, pInventory) >>> 0) !== (pItem >>> 0)) {
    return 0
  }
  let pClient = 0
  if (m.u32(pUnit >>> 0) === 0) {
    const pPlrData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
    pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
  }
  const pMaskScratch = allocW5B7Stack(m, 0x10)
  try {
    m.setU32(pMaskScratch, 0)
    ITEMS_SetOrClearFlagMask113c(m, pMaskScratch, 0x20, 1)
  } finally {
    freeW5B7Stack(pMaskScratch)
  }
  NET_SendPacket42_ClearCursor_6FCAAF10_113c(m, pUnit, pClient)
  INVENTORY_SetCursorItem113c(m, pInventory, 0)
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (mem, _g, pPlr, pTargetItem) => {
      ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlr, pTargetItem)
    },
    pItem,
  )
  SUNIT_FreeUnit113c(m, pGame, pItem)
  return 1
}

/**
 * Removes `pItem` from `pUnit`'s belt inventory, unlinks it from all living players'
 * inventories/cursors, and frees `pItem`.
 *
 * @va D2Game:0x6FCF2CF0
 */
export function ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pItem: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCF2CF0)
  if (pItem !== 0) {
    m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0)
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInventory, pItem) >>> 0
  if (pRemoved === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x12ea)
  }
  if (pRemoved !== (pItem >>> 0)) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x12eb)
  }
  const dwType = m.u32(pItem >>> 0) | 0
  let nPosX = 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    const pStaticPath = m.u32((pItem + 0x2c) >>> 0) >>> 0
    nPosX = m.u32((pStaticPath + 0x0c) >>> 0) | 0
  } else {
    const pDynPath = m.u32((pItem + 0x2c) >>> 0) >>> 0
    nPosX = pDynPath !== 0 ? (PATH_GetPosX113c(m, pDynPath) | 0) : 0
  }
  INVENTORY_NoOpRet8A113c(m, pInventory, nPosX)
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (mem, _g, pPlr, pTargetItem) => {
      ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlr, pTargetItem)
    },
    pItem,
  )
  SUNIT_FreeUnit113c(m, pGame, pItem)
}

/**
 * Removes `pItem` from `pUnit`'s grid inventory, optionally sends S2C `0x0A` remove-unit packet,
 * unlinks from all living players, and frees `pItem`.
 *
 * @va D2Game:0x6FCF2D90
 */
export function ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pItem: number,
  pGame: number,
  bSendRemovePacket: number,
): void {
  hitD2GameVa113c(0x6FCF2D90)
  if (pGame === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0xf70)
  }
  if (pUnit === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0xf71)
  }
  if (pItem !== 0) {
    m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0)
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInventory, pItem) >>> 0
  if (pRemoved === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0xf77)
  }
  if (pRemoved !== (pItem >>> 0)) {
    throw new D2CommonAssertError('ItemMode.cpp', 0xf78)
  }
  const bPage = ITEMS_GetInvPage113c(m, pItem) & 0xff
  const bLoD = m.u32((pGame + 0x70) >>> 0) | 0
  const nInvRecId = UNITS_GetInventoryRecordId113c(m, pUnit, bPage, bLoD)
  const nPosY = UNIT_GetPosY113c(m, pItem)
  const nPosX = UNIT_GetPosX113c(m, pItem)
  INVENTORY_NoOpRet20113c(m, 0x6fd1b14c, 0xf7c, pInventory, nPosX, nPosY, nInvRecId, 0, bPage)
  ITEMS_SetInvPage113c(m, pItem, 0xff)
  if (bSendRemovePacket !== 0) {
    let pClient = 0
    if (m.u32(pUnit >>> 0) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
      pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    }
    NET_SendRemoveUnitPacket0A113c(m, pItem, pClient)
  }
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (mem, _g, pPlr, pTargetItem) => {
      ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlr, pTargetItem)
    },
    pItem,
  )
  SUNIT_FreeUnit113c(m, pGame, pItem)
}

/**
 * Adds `nDeltaCharges` to the scroll/tome skill on `pUnit` associated with `pItem` and syncs S2C `0x22`.
 *
 * @va D2Game:0x6FCF31D0
 */
export function ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  nDeltaCharges: number,
): void {
  hitD2GameVa113c(0x6FCF31D0)
  if (pUnit === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x203)
  }
  if (pItem === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x204)
  }
  const nSkillId = ITEMS_GetScrollOrTomeSkillId113c(m, pItem) | 0
  if (nSkillId === -1) {
    return
  }
  const pSkill = SKILLS_GetSkillById113c(m, pUnit, nSkillId, -1) >>> 0
  if (pSkill === 0) {
    return
  }
  const nUpdated = ((SKILLS_GetCharges113c(m, pSkill) | 0) + (nDeltaCharges | 0)) | 0
  SKILLS_SetCharges113c(m, pSkill, nUpdated)
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  const dwUnitGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0
  let pClient = 0
  if (dwUnitType === 0) {
    const pPlrData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
    pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
  }
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(
    m,
    pClient,
    dwUnitType,
    dwUnitGuid,
    nSkillId,
    nUpdated,
  )
}

/**
 * Places cursor item `dwItemGuid` into `pUnit`'s belt (either auto-placed when `bAutoPlace != 0`
 * or into explicit `nBeltSlot`), updating item flags, mode `2`, and inventory GUID nodes.
 *
 * @va D2Game:0x6FCF4E80
 */
export function ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c(
  m: D2KernMemory113c,
  dwItemGuid: number,
  pGame: number,
  pUnit: number,
  nBeltSlot: number,
  bAutoPlace: number,
  pOutRejectReason: number,
): number {
  hitD2GameVa113c(0x6FCF4E80)
  if (pGame === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x11fc)
  }
  if (pUnit === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x11fd)
  }
  m.setU32(pOutRejectReason >>> 0, 0)
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit)
  const targetGuid = dwItemGuid >>> 0
  let pItem = m.u32((pGame + 0x1720 + ((targetGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pItem !== 0) {
    if ((m.u32((pItem + 0x0c) >>> 0) >>> 0) === targetGuid) {
      break
    }
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if (m.u32(pItem) !== 4) {
    return 0
  }
  if (m.u32((pItem + 0x10) >>> 0) !== 4) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if (ITEMS_IsBeltable113c(m, pItem) === 0) {
    return 0
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (bAutoPlace !== 0) {
    if (INVENTORY_AutoPlaceItemInBelt113c(m, pInventory, pItem) === 0) {
      return 0
    }
  } else {
    const pDimScratch = allocW5B7Stack(m, 0x10)
    try {
      INVENTORY_GetItemDimensionsCallback113c(
        m,
        pItem,
        pDimScratch,
        (pDimScratch + 4) >>> 0,
        0x6fd1b14c,
        0x1223,
      )
    } finally {
      freeW5B7Stack(pDimScratch)
    }
    if (ITEMS_AutoPlaceIntoBelt113c(m, pInventory, pItem, nBeltSlot) === 0) {
      return 0
    }
    ITEMS_SetInvPage113c(m, pItem, 0xff)
  }
  if (INVENTORY_PlaceItemInSocket113c(m, pInventory, pItem, 2) === 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  INVENTORY_SetCursorItem113c(m, pInventory, 0)
  ITEMS_OnEquipScrollOrTome113c(m, pItem, pUnit)
  m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0)
  if (ITEMS_CanUseCharmInInventory113c(m, pItem, pUnit) !== 0) {
    ITEMS_ActivateEquippedItemStats113c(m, pUnit, pItem, 0)
  }
  UNITS_ChangeAnimMode113c(m, pItem, 2)
  ITEMS_SetInvPage113c(m, pItem, 0xff)
  ITEMS_SetItemFlag113c(m, pItem, 0x400, 1)
  UNITS_SetUnitUpdateFlags113c(m, pUnit, 1)
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem)
  return 1
}

/**
 * Strips equipped (`nodePosOther == 3`) and active charm (`nodePosOther == 1` & usable charm)
 * items from `pUnit`, deactivating their stats and emptying `pUnit->pInventory`.
 *
 * @va D2Game:0x6FCF5590
 */
export function ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF5590)
  if (pUnit === 0) {
    return
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return
  }
  let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (pNode !== 0) {
    const pNext = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    if (pItem === 0) {
      throw new D2CommonAssertError('ItemMode.cpp', 0x19fe)
    }
    const bStrip =
      (INVENTORY_GetItemNodePositionOther113c(m, pNode) | 0) === 3 ||
      ((INVENTORY_GetItemNodePositionOther113c(m, pNode) | 0) === 1 &&
        ITEMS_CanUseCharmInInventory113c(m, pItem, pUnit) !== 0)
    if (bStrip) {
      ITEMS_NoOpReturnZero113c(m, pUnit, pItem)
      INVENTORY_UpdateWeaponGuidOnRemoval113c(m, pInventory, pItem)
      const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInventory, pItem) >>> 0
      if (pRemoved === 0) {
        throw new D2CommonAssertError('ItemMode.cpp', 0x1a10)
      }
      if (pRemoved !== pItem) {
        throw new D2CommonAssertError('ItemMode.cpp', 0x1a11)
      }
      if ((INVENTORY_GetItemNodePositionOther113c(m, pNode) | 0) === 3) {
        const nBodyLoc = INVENTORY_GetItemBodyLocFromX113c(m, pInventory, pItem)
        INVENTORY_NoOpRet8B113c(m, pInventory, nBodyLoc)
      }
      ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pItem, pGame, 0, 1)
      D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 0)
    }
    pNode = pNext
  }
  INVENTORY_EmptyInventory113c(m, pInventory)
}

/**
 * Marks `pItem` broken at `0` durability (`STAT_DURABILITY = 0x48`), deactivates its equipped
 * stats, updates set item state and S2C `0x3E`, and triggers broken-item event sound `9`.
 *
 * @va D2Game:0x6FCF5740
 */
export function ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF5740)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x100, 1)
  INVENTORY_UpdateWeaponGuidOnRemoval113c(m, m.u32((pUnit + 0x60) >>> 0) >>> 0, pItem)
  if ((UNITS_GetAnimOrSeqMode113c(m, pItem) | 0) === 1) {
    ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pItem, pGame, 1, 1)
  }
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 0)
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem)
  UNITS_SetUnitUpdateFlags113c(m, pUnit, 1)
  STATLIST_SetUnitStat113c(m, pItem, 0x48, 0, 0)
  let pClient = 0
  if (m.u32(pUnit >>> 0) === 0) {
    const pPlrData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
    pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
  }
  NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pClient, 1, 0x48, 0)
  ITEMMODS_UpdateSetItemEquipmentState113c(m, pUnit, pItem, 1, 1)
  m.setU16((pUnit + 0x6e) >>> 0, 9)
  m.setU32((pUnit + 0x70) >>> 0, pUnit >>> 0)
  UNITROOM_RefreshUnit113c(m, pUnit)
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x400) >>> 0)
}

/**
 * Swaps beltable cursor item `dwCursorItemGuid` with existing belt item `dwBeltItemGuid` on `pUnit`.
 *
 * @va D2Game:0x6FCF5A00
 */
export function ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  dwCursorItemGuid: number,
  dwBeltItemGuid: number,
  pOutRejectReason: number,
): number {
  hitD2GameVa113c(0x6FCF5A00)
  if (pGame === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x128b)
  if (pUnit === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x128c)
  m.setU32(pOutRejectReason >>> 0, 0)
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit)
  const curGuid = dwCursorItemGuid >>> 0
  let pCursorItem = m.u32((pGame + 0x1720 + ((curGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pCursorItem !== 0 && (m.u32((pCursorItem + 0x0c) >>> 0) >>> 0) !== curGuid) {
    pCursorItem = m.u32((pCursorItem + 0xe4) >>> 0) >>> 0
  }
  if (pCursorItem === 0 || m.u32(pCursorItem) !== 4 || m.u32((pCursorItem + 0x10) >>> 0) !== 4) {
    return 0
  }
  if (ITEMS_IsBeltable113c(m, pCursorItem) === 0) return 0
  const beltGuid = dwBeltItemGuid >>> 0
  let pBeltItem = m.u32((pGame + 0x1720 + ((beltGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pBeltItem !== 0 && (m.u32((pBeltItem + 0x0c) >>> 0) >>> 0) !== beltGuid) {
    pBeltItem = m.u32((pBeltItem + 0xe4) >>> 0) >>> 0
  }
  if (pBeltItem === 0 || m.u32(pBeltItem) !== 4) return 0
  if (m.u32((pBeltItem + 0x10) >>> 0) !== 2) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInventory, pBeltItem) >>> 0
  if (pRemoved === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x12b9)
  if (pRemoved !== pBeltItem) throw new D2CommonAssertError('ItemMode.cpp', 0x12ba)
  INVENTORY_NoOpRet8A113c(m, pInventory, UNIT_GetPosX113c(m, pBeltItem))
  INVENTORY_SetCursorItem113c(m, pInventory, pBeltItem)
  ITEMS_OnUnequipScrollOrTome113c(m, pBeltItem, pUnit)
  m.setU32((pBeltItem + 0xc4) >>> 0, (m.u32((pBeltItem + 0xc4) >>> 0) & ~2) >>> 0)
  ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pBeltItem, pGame, 0, 1)
  UNITS_ChangeAnimMode113c(m, pBeltItem, 4)
  ITEMS_SetItemFlag113c(m, pBeltItem, 0x1000, 1)
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pBeltItem)
  if (ITEMS_AutoPlaceIntoBelt113c(m, pInventory, pCursorItem, UNIT_GetPosX113c(m, pBeltItem)) === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x12d9)
  }
  UNITS_SetStaticPathPosX113c(m, pCursorItem, UNIT_GetPosX113c(m, pBeltItem))
  UNITS_SetStaticPathPosY113c(m, pCursorItem, 0)
  if (INVENTORY_PlaceItemInSocket113c(m, pInventory, pCursorItem, 2) === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x12d5)
  }
  ITEMS_OnEquipScrollOrTome113c(m, pCursorItem, pUnit)
  m.setU32((pCursorItem + 0xc4) >>> 0, (m.u32((pCursorItem + 0xc4) >>> 0) & ~2) >>> 0)
  if (ITEMS_CanUseCharmInInventory113c(m, pCursorItem, pUnit) !== 0) {
    ITEMS_ActivateEquippedItemStats113c(m, pUnit, pCursorItem, 0)
  }
  UNITS_ChangeAnimMode113c(m, pCursorItem, 2)
  ITEMS_SetInvPage113c(m, pCursorItem, 0xff)
  ITEMS_SetItemFlag113c(m, pCursorItem, 0x1000, 1)
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pCursorItem)
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 0)
  return 1
}

/**
 * Auto-places `pItem` into `nInvPage` of `pUnit`'s grid inventory, unlinking from room if
 * `bFromGroundRoom != 0`, activating scroll/charm stats, and firing quest drop callbacks.
 *
 * @va D2Game:0x6FCF6590
 */
export function ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  pGame: number,
  bFromGroundRoom: number,
  nInvPage: number,
  szFile: number,
  nLine: number,
): number {
  hitD2GameVa113c(0x6FCF6590)
  if (pGame === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x747)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x74a)
  const nInvRecordId = UNITS_GetInventoryRecordId113c(m, pUnit, nInvPage, m.u32((pGame + 0x70) >>> 0) | 0)
  if (INVENTORY_AutoPlaceItemInGrid113c(m, pInventory, pItem, nInvRecordId, 0, 0, szFile, nLine) === 0) {
    return 0
  }
  if (bFromGroundRoom !== 0) {
    const pRoom = UNITS_GetRoom113c(m, pItem) >>> 0
    if (pRoom !== 0) {
      const dwType = pItem === 0 ? 6 : (m.u32(pItem >>> 0) >>> 0)
      const dwGuid = pItem === 0 ? 0xffffffff : (m.u32((pItem + 0x0c) >>> 0) >>> 0)
      DUNGEON_AddRoomPortalNode113c(m, pRoom, dwType, dwGuid)
      UNITS_SetTargetUnitForDynamicUnitEx113c(m, pItem)
      UNITROOM_RemoveUnitFromRoom113c(m, pItem)
    }
  }
  if (INVENTORY_PlaceItemInSocket113c(m, pInventory, pItem, 1) === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x770)
  }
  INVENTORY_SetCursorItem113c(m, pInventory, 0)
  ITEMS_OnEquipScrollOrTome113c(m, pItem, pUnit)
  if (ITEMS_CanUseCharmInInventory113c(m, pItem, pUnit) !== 0) {
    ITEMS_ActivateEquippedItemStats113c(m, pUnit, pItem, 0)
  }
  if (pItem !== 0) m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0)
  UNITS_ChangeAnimMode113c(m, pItem, 0)
  ITEMS_SetItemFlag113c(m, pItem, 0x80, 1)
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem)
  UNITS_SetUnitUpdateFlags113c(m, pUnit, 1)
  if (pItem !== 0) m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~0x02000000) >>> 0)
  ITEMS_SetInvPage113c(m, pItem, nInvPage)
  QUESTS_TriggerItemDropped_6FC545A0_113c(m, pGame, pItem, pUnit)
  if (ITEMS_CanUseCharmInInventory113c(m, pItem, pUnit) !== 0) {
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 0)
    UNITS_SetUnitUpdateFlags113c(m, pUnit, 1)
  }
  return 1
}

/**
 * Finalizes an inventory item (`pItem`) on `pUnit` (e.g. upon identification), activating charm
 * stats, updating command flags, appending inventory GUID node, and setting event sound `6`.
 *
 * @va D2Game:0x6FCF6BC0
 */
export function ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pItem: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF6BC0)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (ITEMS_CheckCommandFlags113c(m, pItem, 0x10, 0x1381, 0x6fd1b14c) !== 0 || pInventory === 0) {
    return
  }
  if (ITEMS_CheckItemFlag113c(m, pItem, 0x100000) !== 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x1384)
  }
  ITEMS_OnCharmPlacedInInventory_6FCF6710_113c(m, pUnit, pItem, pGame)
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1)
  if (ITEMS_CheckCommandFlags113c(m, pItem, 0x4000, 0x138a, 0x6fd1b14c) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x4000, 0)
  }
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem)
  UNITS_SetUnitUpdateFlags113c(m, pUnit, 1)
  SUNIT_SetUnitEventSound113c(m, pUnit, 6, pUnit)
}

/**
 * Picks up `pGoldItem` for `pPlayer` in `pGame`, distributing party gold (unless player-dropped),
 * freeing `pGoldItem`, and spawning remainder gold piles with sound `0x17` when over gold cap.
 *
 * @va D2Game:0x6FCF6C80
 */
export function ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pGoldItem: number,
): void {
  hitD2GameVa113c(0x6FCF6C80)
  const nMaxGold = STATLIST_GetUnitGoldBankLimit113c(m, pPlayer) | 0
  const nCurGold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0) | 0
  const nPileGold = STATLIST_GetUnitStat113c(m, pGoldItem, 0x0e, 0) | 0
  let nRemainder = 0
  let nToAdd = nPileGold
  if (((nPileGold + nCurGold) | 0) > nMaxGold) {
    const nRoom = (nMaxGold - nCurGold) | 0
    nRemainder = (nPileGold - nRoom) | 0
    nToAdd = nRoom
  }
  let bPlayerDropped = 0
  if (pGoldItem !== 0 && ((m.u32((pGoldItem + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    const pDropper =
      SUNIT_GetServerUnit113c(
        m,
        pGame,
        m.u32((pGoldItem + 0x94) >>> 0),
        m.u32((pGoldItem + 0x98) >>> 0),
      ) >>> 0
    if (pDropper !== 0 && m.u32(pDropper) === 0) {
      bPlayerDropped = 1
    }
  }
  let bHandledByParty = false
  if (bPlayerDropped === 0) {
    if (pPlayer === 0) {
      bHandledByParty = true
    } else {
      const pPlayerGame = m.u32((pPlayer + 0x80) >>> 0) >>> 0
      if (
        pPlayerGame !== 0 &&
        m.u32(pPlayer) === 0 &&
        (D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayer, pPlayerGame) & 0xffff) !== 0xffff
      ) {
        nRemainder = PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c(m, pGame, pPlayer, nPileGold) | 0
        bHandledByParty = true
      }
    }
  }
  if (!bHandledByParty && pPlayer !== 0) {
    const nNow = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0) | 0
    const nSum = (nNow + nToAdd) | 0
    if (nSum < 0) {
      STATLIST_SetUnitStat113c(m, pPlayer, 0x0e, 0, 0)
    } else if (m.u32(pPlayer) === 0 && nSum > (STATLIST_GetUnitGoldBankLimit113c(m, pPlayer) | 0)) {
      STATLIST_SetUnitStat113c(m, pPlayer, 0x0e, 0, 0)
    } else {
      STATLIST_AddUnitStatMemPort113c(m, pPlayer, 0x0e, nToAdd, 0)
    }
  }
  const dwType = pGoldItem === 0 ? 6 : (m.u32(pGoldItem >>> 0) >>> 0)
  const dwGuid = pGoldItem === 0 ? 0xffffffff : (m.u32((pGoldItem + 0x0c) >>> 0) >>> 0)
  DUNGEON_AddRoomPortalNode113c(m, UNITS_GetRoom113c(m, pGoldItem) >>> 0, dwType, dwGuid)
  UNITS_SetTargetUnitForDynamicUnitEx113c(m, pGoldItem)
  UNITROOM_RemoveUnitFromRoom113c(m, pGoldItem)
  if (pGoldItem !== 0) m.setU32((pGoldItem + 0xc4) >>> 0, (m.u32((pGoldItem + 0xc4) >>> 0) & ~2) >>> 0)
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    (mem, _g, pPlr, pTargetItem) => {
      ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlr, pTargetItem)
    },
    pGoldItem,
  )
  SUNIT_FreeUnit113c(m, pGame, pGoldItem)
  if (nRemainder > 0) {
    ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, pGame, pPlayer, nRemainder >>> 0)
    if (pPlayer === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x558)
    m.setU16((pPlayer + 0x6e) >>> 0, 0x17)
    m.setU32((pPlayer + 0x70) >>> 0, pPlayer >>> 0)
    UNITROOM_RefreshUnit113c(m, pPlayer)
    m.setU32((pPlayer + 0xc4) >>> 0, (m.u32((pPlayer + 0xc4) >>> 0) | 0x400) >>> 0)
  }
}

/**
 * Decrements charges on `pUnit`'s non-item-bound skill `nSkillId` (`ownerGuid = -1`), resetting
 * right-hand skill to Attack (`0`) if depleted while active, and sends S2C `0x22`.
 *
 * @va D2Game:0x6FCF8DE0
 */
export function ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
): void {
  hitD2GameVa113c(0x6FCF8DE0)
  const pSkill = SKILLS_GetSkillById113c(m, pUnit, nSkillId, -1) >>> 0
  if (pSkill === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0xfc5)
  }
  let nCharges = ((SKILLS_GetCharges113c(m, pSkill) | 0) - 1) | 0
  if (nCharges <= 0) {
    if ((UNITS_GetRightSkill113c(m, pUnit) >>> 0) === pSkill) {
      SKILLS_AssignHandSkillAndSyncAura113c(m, pUnit, 0, 0, 0xffffffff)
    }
    nCharges = 0
  }
  SKILLS_SetCharges113c(m, pSkill, nCharges)
  if (pUnit === 0) {
    NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, 0, 6, 0xffffffff, nSkillId, nCharges)
    return
  }
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  const dwUnitGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0
  if (dwUnitType !== 0) {
    NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, 0, dwUnitType, dwUnitGuid, nSkillId, nCharges)
    return
  }
  const pPlrData = UNITS_GetPlayerData113c(m, pUnit) >>> 0
  const pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
  NET_SendPacket22_UnitSkillAmmoCount_6FCAD570_113c(m, pClient, 0, dwUnitGuid, nSkillId, nCharges)
}

/**
 * Searches `pUnit`'s current room for an object (`dwUnitType == 2`) with `dwClassId == dwObjectClassId`
 * at identical `(x, y)` coordinates, transitioning it to mode `2` (`OBJMODE_OPENED`).
 *
 * @va D2Game:0x6FCFAB00
 */
export function SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c(
  m: D2KernMemory113c,
  pUnit: number,
  dwObjectClassId: number,
): void {
  hitD2GameVa113c(0x6FCFAB00)
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (pRoom === 0) {
    return
  }
  let pCur = m.u32((pRoom + 0x74) >>> 0) >>> 0
  if (pCur === 0) {
    return
  }
  const frameBase = allocW5B7Stack(m, 0x10)
  try {
    const pObjPos = frameBase >>> 0
    const pUnitPos = (frameBase + 8) >>> 0
    while (pCur !== 0) {
      const pNext = m.u32((pCur + 0xe8) >>> 0) >>> 0
      if (m.u32(pCur) === 2 && (m.u32((pCur + 4) >>> 0) >>> 0) === (dwObjectClassId >>> 0)) {
        PATH_GetTargetTypeAndPosition113c(m, pCur, pObjPos)
        PATH_GetTargetTypeAndPosition113c(m, pUnit, pUnitPos)
        if (
          m.u32(pObjPos) === m.u32(pUnitPos) &&
          m.u32((pObjPos + 4) >>> 0) === m.u32((pUnitPos + 4) >>> 0)
        ) {
          UNITS_ChangeAnimMode113c(m, pCur, 2)
          UNITS_SetTargetUnitForDynamicUnitEx113c(m, pCur)
          return
        }
      }
      pCur = pNext
    }
  } finally {
    freeW5B7Stack(frameBase)
  }
}

function isUnitLivingPlayerOrMonster113c(m: D2KernMemory113c, pUnit: number): boolean {
  if (pUnit === 0) return false
  if ((m.u8((pUnit + 0xc6) >>> 0) & 1) !== 0) return false
  const dwType = m.u32(pUnit >>> 0) | 0
  const dwMode = m.u32((pUnit + 0x10) >>> 0) >>> 0
  if (dwType === 0) {
    return dwMode !== 0 && dwMode !== 0x11
  }
  if (dwType === 1) {
    return dwMode !== 0 && dwMode !== 0x0c
  }
  return false
}

/**
 * Party iterator callback collecting living party members within `80` subtiles (`distSq <= 0x1900`)
 * of `pExpCtx->pDefender` (`+0x00`) into `pExpCtx` (`pMembers[8]`, `nLevels[8]`, `nCount`, `nLevelSum`).
 *
 * @va D2Game:0x6FCFAED0
 */
export function SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pMember: number,
  pExpCtx: number,
): void {
  hitD2GameVa113c(0x6FCFAED0)
  if (!isUnitLivingPlayerOrMonster113c(m, pMember)) {
    return
  }
  const pDefender = m.u32(pExpCtx >>> 0) >>> 0
  if (pDefender !== 0) {
    const defType0 = m.u32(pDefender) | 0
    let defX = 0
    if (defType0 === 2 || (defType0 > 3 && defType0 <= 5)) {
      defX = m.u32((m.u32((pDefender + 0x2c) >>> 0) + 0x0c) >>> 0) | 0
    } else {
      const pPathX = m.u32((pDefender + 0x2c) >>> 0) >>> 0
      defX = pPathX !== 0 ? (PATH_GetPosX113c(m, pPathX) | 0) : 0
    }
    const defType1 = m.u32(pDefender) | 0
    let defY = 0
    if (defType1 === 2 || (defType1 > 3 && defType1 <= 5)) {
      defY = m.u32((m.u32((pDefender + 0x2c) >>> 0) + 0x10) >>> 0) | 0
    } else {
      const pPathY = m.u32((pDefender + 0x2c) >>> 0) >>> 0
      defY = pPathY !== 0 ? (PATH_GetPosY113c(m, pPathY) | 0) : 0
    }
    if (defX === 0) {
      return
    }
    const memX = UNIT_GetPosX113c(m, pMember) | 0
    const memY = UNIT_GetPosY113c(m, pMember) | 0
    if (memX === 0) {
      return
    }
    const dx = (defX - memX) | 0
    const dy = (defY - memY) | 0
    const distSq = (Math.imul(dy, dy) + Math.imul(dx, dx)) >>> 0
    if (distSq > 0x1900) {
      return
    }
  }
  const nIdx = m.u32((pExpCtx + 0x44) >>> 0) | 0
  if (nIdx >= 8) {
    throw new D2CommonAssertError('SUnitDmg.cpp', 0xf22)
  }
  m.setU32((pExpCtx + 0x04 + nIdx * 4) >>> 0, pMember >>> 0)
  const nLvl = STATLIST_GetUnitStat113c(m, pMember, 0x0c, 0) | 0
  const nIdx1 = m.u32((pExpCtx + 0x44) >>> 0) | 0
  m.setU32((pExpCtx + 0x24 + nIdx1 * 4) >>> 0, nLvl >>> 0)
  const nIdx2 = m.u32((pExpCtx + 0x44) >>> 0) | 0
  const nStoredLvl = m.u32((pExpCtx + 0x24 + nIdx2 * 4) >>> 0) | 0
  const nSum = ((m.u32((pExpCtx + 0x48) >>> 0) | 0) + nStoredLvl) >>> 0
  m.setU32((pExpCtx + 0x48) >>> 0, nSum)
  m.setU32((pExpCtx + 0x44) >>> 0, (nIdx2 + 1) >>> 0)
}

/**
 * Freeze state expiration callback: clears `nState` (and `STATE_SHATTER = 0x6B` if still alive)
 * unless dead with `fStateMasksExp` set, then refreshes animation speed via `UNITS_SetUnitAnimMode`.
 *
 * @va D2Game:0x6FCFB4C0
 */
export function SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FCFB4C0)
  if (!isUnitLivingPlayerOrMonster113c(m, pUnit)) {
    if (STATES_CheckStateMaskExpOnUnit113c(m, pUnit, nState) !== 0) {
      return
    }
  }
  STATES_ToggleGfxStateFlag113c(m, pUnit, nState, 0)
  if (isUnitLivingPlayerOrMonster113c(m, pUnit)) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x6b, 0)
  }
  UNITS_SetUnitAnimMode113c(m, pUnit, 0x6fd1b0ec, 0x14e)
}

/**
 * Stun/knockback/freeze recovery callback: clears `nState`, frees `pUnit`'s combat list, sets
 * neutral anim mode (`1`), and reschedules monster `EVENTTYPE_AITHINK` (`2`) using `MonStats.txt` `nAiDelay`.
 *
 * @va D2Game:0x6FCFBD90
 */
export function SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  _pStatList = 0,
): void {
  hitD2GameVa113c(0x6FCFBD90)
  if (!isUnitLivingPlayerOrMonster113c(m, pUnit)) {
    if (STATES_CheckStateMaskExpOnUnit113c(m, pUnit, nState) !== 0) {
      return
    }
  }
  STATES_ToggleGfxStateFlag113c(m, pUnit, nState, 0)
  if (pUnit === 0) {
    throw new D2CommonAssertError('SUnitDmg.cpp', 0xa2a)
  }
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, m.u32((pUnit + 0x80) >>> 0) >>> 0)
  UNITS_ChangeAnimMode113c(m, pUnit, 1)
  if (m.u32(pUnit) !== 1) {
    return
  }
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0) {
    return
  }
  const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonData === 0) {
    return
  }
  const pMonStatsTxt = m.u32(pMonData) >>> 0
  if (pMonStatsTxt === 0) {
    return
  }
  let nAiDelay = 0
  if (m.u8((pGame + 0x6a) >>> 0) === 0 && m.u32((pGame + 0x74) >>> 0) === 0) {
    nAiDelay = m.u8((pMonStatsTxt + 0x4f) >>> 0)
  } else {
    const bDiff = m.u8((pGame + 0x6d) >>> 0)
    nAiDelay = m.u8((pMonStatsTxt + bDiff + 0x4f) >>> 0)
  }
  if ((nAiDelay | 0) <= 0) {
    nAiDelay = 0x0f
  }
  let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
  while (pEv !== 0) {
    const pNextEv = m.u32((pEv + 0x24) >>> 0) >>> 0
    if (m.u8(pEv) === 2) {
      EVENT_FreeNode113c(m, pGame, pEv)
    }
    pEv = pNextEv
  }
  const nFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + nAiDelay) >>> 0
  EVENT_SetEventFull113c(m, pGame, pUnit, 2, nFrame, 0, 0, 0)
}

/**
 * Rolls skill physical damage (`dwPhysDamage` at `pDmg + 0x08`) and elemental damage for
 * `(pAttacker, nSkillId, nSkillLevel)`.
 *
 * @va D2Game:0x6FCFCE00
 */
export function SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  nSkillId: number,
  nSkillLevel: number,
  pDmg: number,
): void {
  hitD2GameVa113c(0x6FCFCE00)
  if ((nSkillId | 0) < 0) {
    return
  }
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  if ((nSkillId | 0) >= (m.u32((pDataTables + 0xba0) >>> 0) | 0)) {
    return
  }
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(nSkillId | 0, 0x23c)) >>> 0
  if (pSkillsTxt === 0) {
    return
  }
  const nMinDmg = SKILLS_GetSkillPhysMinDamage113c(m, pAttacker, nSkillId, nSkillLevel, 0) | 0
  const nMaxDmg = SKILLS_GetSkillPhysMaxDamage113c(m, pAttacker, nSkillId, nSkillLevel, 0) | 0
  const dwPhys =
    SUNITDMG_ComputeWeaponBaseDamage113c(m, pAttacker, 0, pDmg, 0, 0, 0, {
      min256: nMinDmg,
      max256: nMaxDmg,
      nSrcDamage: 0x80,
    }) >>> 0
  m.setU32((pDmg + 0x08) >>> 0, dwPhys)
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, nSkillId, pAttacker, pDmg, nSkillLevel)
}

/**
 * Applies radial splash damage (`pBaseDmg`) from `pMissile` around `(nCenterX, nCenterY)` within
 * `nRadius`, filtering owner/grandowner, hostility, line-of-sight (`0x805`), and optional callback.
 *
 * @va D2Game:0x6FCFE380
 */
export function SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  nCenterX: number,
  nCenterY: number,
  nRadius: number,
  pBaseDmg: number,
  bAllowOwnerHit: number,
  bAllowGrandOwnerHit: number,
  pfnFilterCallback:
    | number
    | ((m: D2KernMemory113c, pGame: number, pMissile: number, pTarget: number) => number),
  dwFindFlags: number,
): number {
  hitD2GameVa113c(0x6FCFE380)
  const pStartRoom = UNITS_GetRoom113c(m, pMissile) >>> 0
  const pRoom = ROOM_FindRoomContainingSubtile113c(m, pStartRoom, nCenterX, nCenterY) >>> 0
  const effFlags = dwFindFlags === 0 ? 0x583 : (dwFindFlags >>> 0)
  const frameBase = allocW5B7Stack(m, 0xf0)
  try {
    const pFindData = frameBase >>> 0
    const pFindArg = (frameBase + 0x30) >>> 0
    const pDmgCopy = (frameBase + 0x70) >>> 0
    m.setU32(pFindArg, effFlags)
    m.setU32((pFindArg + 0x0c) >>> 0, nCenterX >>> 0)
    m.setU32((pFindArg + 0x10) >>> 0, nCenterY >>> 0)
    m.setU32((pFindArg + 0x14) >>> 0, nRadius >>> 0)
    UNITFINDS_InitUnitFindData113c(
      m,
      m.u32((pGame + 0x1c) >>> 0) >>> 0,
      pFindData,
      pRoom,
      nCenterX,
      nCenterY,
      nRadius,
      0,
      pFindArg,
    )
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pFindData)
    if (pMissile === 0 || ((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) {
      UNITFINDS_FreeUnitFindData113c(m, pFindData)
      return 0
    }
    const pOwner =
      SUNIT_GetServerUnit113c(
        m,
        pGame,
        m.u32((pMissile + 0x94) >>> 0),
        m.u32((pMissile + 0x98) >>> 0),
      ) >>> 0
    if (pOwner === 0) {
      UNITFINDS_FreeUnitFindData113c(m, pFindData)
      return 0
    }
    let pGrandOwner = 0
    if (((m.u32((pOwner + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
      pGrandOwner =
        SUNIT_GetServerUnit113c(
          m,
          pGame,
          m.u32((pOwner + 0x94) >>> 0),
          m.u32((pOwner + 0x98) >>> 0),
        ) >>> 0
    }
    const nFound = m.u32((pFindData + 0x18) >>> 0) | 0
    let bAnyHit = 0
    for (let i = 0; i < nFound; i++) {
      const pUnitsArr = m.u32((pFindData + 0x04) >>> 0) >>> 0
      const pTarget = m.u32((pUnitsArr + i * 4) >>> 0) >>> 0
      if (pGrandOwner === pTarget && bAllowGrandOwnerHit === 0) continue
      if (pOwner === pTarget && bAllowOwnerHit === 0) continue
      if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pOwner, pTarget, pGame) === 0) continue
      if (SKILLS_TestLineOfSightFromUnitToTarget113c(m, nCenterX, nCenterY, pTarget, 0x805) === 0) {
        continue
      }
      for (let w = 0; w < 0x1c; w++) {
        m.setU32((pDmgCopy + w * 4) >>> 0, m.u32((pBaseDmg + w * 4) >>> 0))
      }
      if (typeof pfnFilterCallback === 'function') {
        if (pfnFilterCallback(m, pGame, pMissile, pTarget) === 0) continue
      }
      MISSILE_ApplyDamageStrcToTarget113c(m, pDmgCopy, pGame, pMissile, pTarget)
      bAnyHit = 1
    }
    UNITFINDS_FreeUnitFindData113c(m, pFindData)
    return bAnyHit
  } finally {
    freeW5B7Stack(frameBase)
  }
}

/**
 * Walks player (`dwUnitType == 0`, `+0x1120`) or monster (`dwUnitType == 1`, `+0x1320`) hash
 * buckets in `pGame`, returning the first unit without `STATE_MORPH` (`7`) where `pfnPredicate` returns `1`.
 *
 * @va D2Game:0x6FCFFCC0
 */
export function SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pfnPredicate:
    | number
    | ((m: D2KernMemory113c, pGame: number, pUnit: number, pArg: number) => number),
  dwUnitType: number,
  pArg: number,
): number {
  hitD2GameVa113c(0x6FCFFCC0)
  if (pGame === 0) throw new D2CommonAssertError('SUnit.cpp', 0x7b3)
  if (pfnPredicate === 0) throw new D2CommonAssertError('SUnit.cpp', 0x7b4)
  let pBuckets = 0
  if (dwUnitType === 0) {
    pBuckets = (pGame + 0x1120) >>> 0
  } else if (dwUnitType === 1) {
    pBuckets = (pGame + 0x1320) >>> 0
  } else {
    return 0
  }
  for (let b = 0; b < 0x80; b++) {
    let pCur = m.u32((pBuckets + b * 4) >>> 0) >>> 0
    while (pCur !== 0) {
      if (STATES_CheckState113c(m, pCur, 7) === 0) {
        if (typeof pfnPredicate === 'function' && pfnPredicate(m, pGame, pCur, pArg) === 1) {
          return pCur
        }
      }
      pCur = m.u32((pCur + 0xe4) >>> 0) >>> 0
    }
  }
  return 0
}

function readUnitPosXY113c(m: D2KernMemory113c, pUnit: number): [number, number] {
  const t0 = m.u32(pUnit >>> 0) | 0
  let x = 0
  if (t0 === 2 || (t0 > 3 && t0 <= 5)) {
    x = m.u32((m.u32((pUnit + 0x2c) >>> 0) + 0x0c) >>> 0) >>> 0
  } else {
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    x = pPath !== 0 ? (PATH_GetPosX113c(m, pPath) >>> 0) : 0
  }
  const t1 = m.u32(pUnit >>> 0) | 0
  let y = 0
  if (t1 === 2 || (t1 > 3 && t1 <= 5)) {
    y = m.u32((m.u32((pUnit + 0x2c) >>> 0) + 0x10) >>> 0) >>> 0
  } else {
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    y = pPath !== 0 ? (PATH_GetPosY113c(m, pPath) >>> 0) : 0
  }
  return [x, y]
}

/**
 * Cross-links two portal object units (`pPortalA`, `pPortalB`), storing each portal's `(x, y)`
 * and room coordinates (`+0x10`, `+0x14` of `D2RoomCoordListStrc`) into the opposite `pObjectData`.
 *
 * @va D2Game:0x6FCFFDC0
 */
export function SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c(
  m: D2KernMemory113c,
  pPortalA: number,
  pPortalB: number,
): void {
  hitD2GameVa113c(0x6FCFFDC0)
  if (pPortalA === 0) throw new D2CommonAssertError('SUnit.cpp', 0x754)
  if (pPortalB === 0) throw new D2CommonAssertError('SUnit.cpp', 0x756)
  const [xB, yB] = readUnitPosXY113c(m, pPortalB)
  const pDataA0 = m.u32((pPortalA + 0x14) >>> 0) >>> 0
  m.setU32((pDataA0 + 0x20) >>> 0, xB)
  m.setU32((pDataA0 + 0x24) >>> 0, yB)
  const [xA, yA] = readUnitPosXY113c(m, pPortalA)
  const pDataB0 = m.u32((pPortalB + 0x14) >>> 0) >>> 0
  m.setU32((pDataB0 + 0x20) >>> 0, xA)
  m.setU32((pDataB0 + 0x24) >>> 0, yA)
  const pCoords = allocW5B7Stack(m, 0x20)
  try {
    const pRoomB = UNITS_GetRoom113c(m, pPortalB) >>> 0
    if (pRoomB !== 0) {
      DUNGEON_GetRoomCoordinates113c(m, pRoomB, pCoords)
      const pDataA1 = m.u32((pPortalA + 0x14) >>> 0) >>> 0
      m.setU32((pDataA1 + 0x18) >>> 0, m.u32((pCoords + 0x10) >>> 0))
      m.setU32((pDataA1 + 0x1c) >>> 0, m.u32((pCoords + 0x14) >>> 0))
    }
    const pRoomA = UNITS_GetRoom113c(m, pPortalA) >>> 0
    if (pRoomA !== 0) {
      DUNGEON_GetRoomCoordinates113c(m, pRoomA, pCoords)
      const pDataB1 = m.u32((pPortalB + 0x14) >>> 0) >>> 0
      m.setU32((pDataB1 + 0x18) >>> 0, m.u32((pCoords + 0x10) >>> 0))
      m.setU32((pDataB1 + 0x1c) >>> 0, m.u32((pCoords + 0x14) >>> 0))
    }
  } finally {
    freeW5B7Stack(pCoords)
  }
}

/**
 * Places `pUnit` (`dwUnitType = 0..5`) into `pRoom` at `(nX, nY)` in `pGame`, allocating or
 * initializing its dynamic/static path, collision mask, AI/player events, and room refresh flags.
 *
 * @va D2Game:0x6FD00D00
 */
export function SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c(
  m: D2KernMemory113c,
  nY: number,
  pRoom: number,
  pUnit: number,
  pGame: number,
  nX: number,
): void {
  hitD2GameVa113c(0x6FD00D00)
  if (pGame === 0) throw new D2CommonAssertError('SUnit.cpp', 0x45d)
  if (pUnit === 0) throw new D2CommonAssertError('SUnit.cpp', 0x45e)
  const nAct = DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom)) & 0xff
  m.setU8((pUnit + 0x18) >>> 0, nAct)
  m.setU32((pUnit + 0x1c) >>> 0, m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0)
  m.setU32((pUnit + 0xc8) >>> 0, (m.u32((pUnit + 0xc8) >>> 0) & 0xfffffeff) >>> 0)
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  if (dwUnitType > 5) throw new D2CommonAssertError('SUnit.cpp', 0x4ab)
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  switch (dwUnitType) {
    case 0: {
      PATH_FreeDynamicPath113c(m, pMemPool, m.u32((pUnit + 0x2c) >>> 0) >>> 0)
      m.setU32((pUnit + 0x2c) >>> 0, 0)
      PATH_AllocDynamicPath113c(m, pMemPool, pRoom, nX, nY, pUnit, 0)
      PLAYER_InitPlacedModesAndEvents_6FC57E20_113c(m, pGame, pUnit, nX, nY)
      const dwMode = m.u32((pUnit + 0x10) >>> 0) >>> 0
      if (dwMode === 0 || dwMode === 0x11) {
        PATH_RemoveUnitCollisionFootprint113c(m, pUnit, 1)
        PATH_SetUnitCollisionPattern113c(m, pUnit, 5)
        PATH_SetCollisionMask113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0, 0x8000)
      }
      break
    }
    case 1: {
      PATH_FreeDynamicPath113c(m, pMemPool, m.u32((pUnit + 0x2c) >>> 0) >>> 0)
      m.setU32((pUnit + 0x2c) >>> 0, 0)
      PATH_AllocDynamicPath113c(m, pMemPool, pRoom, nX, nY, pUnit, 0)
      MONSTER_InitPlacedMonsterPathAndMode113c(m, pUnit, pGame, nX, nY)
      if (SUNIT_IsUnitInActiveClientRoom113c(m, pUnit) !== 0) {
        MONSTER_ScheduleInitialAiEvent113c(m, pGame, pUnit)
      } else {
        SUNIT_DeactivateUnitStatesAndEvents113c(m, pUnit, pGame)
      }
      if (MONSTERS_IsDead113c(m, pUnit) !== 0) {
        PATH_RemoveUnitCollisionFootprint113c(m, pUnit, 1)
        PATH_SetUnitCollisionPattern113c(m, pUnit, 5)
        PATH_SetCollisionMask113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0, 0x8000)
      }
      break
    }
    case 2: {
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pUnit + 4) >>> 0) | 0) >>> 0
      UNITS_InitStaticPathCoords113c(m, pUnit, pRoom, nX, nY)
      const dwMode = m.u32((pUnit + 0x10) >>> 0) >>> 0
      if (m.u8((pObjTxt + dwMode + 0x120) >>> 0) !== 0) {
        UNITS_SetCollisionMaskAtCoords113c(m, pUnit, pRoom, nX, nY)
      }
      UNITROOM_SortUnitListByY113c(m, pUnit, pRoom)
      break
    }
    case 3: {
      PATH_FreeDynamicPath113c(m, pMemPool, m.u32((pUnit + 0x2c) >>> 0) >>> 0)
      m.setU32((pUnit + 0x2c) >>> 0, 0)
      PATH_AllocDynamicPath113c(m, pMemPool, pRoom, nX, nY, pUnit, 0)
      break
    }
    case 4: {
      if (m.u32((pUnit + 0x10) >>> 0) === 3) {
        UNITS_InitStaticPathCoords113c(m, pUnit, pRoom, nX, nY)
        UNITS_SetCollisionMaskAtCoords113c(m, pUnit, pRoom, nX, nY)
        UNITROOM_SortUnitListByY113c(m, pUnit, pRoom)
        const dwExpire = ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c(m, pGame, pUnit) >>> 0
        m.setU32((m.u32((pUnit + 0x14) >>> 0) + 0x24) >>> 0, dwExpire)
      }
      break
    }
    case 5: {
      UNITS_InitStaticPathCoords113c(m, pUnit, pRoom, nX, nY)
      UNITS_SetCollisionMaskAtCoords113c(m, pUnit, pRoom, nX, nY)
      UNITROOM_SortUnitListByY113c(m, pUnit, pRoom)
      break
    }
    default:
      break
  }
  if (UNITS_GetRoom113c(m, pUnit) !== 0) {
    UNITROOM_RefreshUnit113c(m, pUnit)
  }
  UNITS_SetPathRoomRefreshFlag113c(m, pUnit, 1)
}

/**
 * Ensures `pPortalUnit`'s destination room is loaded and populated (`DRLG_PopulateSingleRoom`),
 * then resolves and returns the portal's owner server unit (`+0x94`, `+0x98`).
 *
 * @va D2Game:0x6FD01570
 */
export function SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPortalUnit: number,
): number {
  hitD2GameVa113c(0x6FD01570)
  if (pPortalUnit === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x78b)
  }
  const pObjData0 = m.u32((pPortalUnit + 0x14) >>> 0) >>> 0
  const nAct = DRLG_GetActNoFromLevelId113c(m, m.u8((pObjData0 + 4) >>> 0)) & 0xff
  const pObjData1 = m.u32((pPortalUnit + 0x14) >>> 0) >>> 0
  const nDestY = m.u32((pObjData1 + 0x1c) >>> 0) | 0
  const nDestX = m.u32((pObjData1 + 0x18) >>> 0) | 0
  const pAct0 = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
  let pRoom = DUNGEON_FindRoomBySubtileCoordinates113c(m, pAct0, nDestX, nDestY) >>> 0
  if (pRoom === 0) {
    const pAct1 = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
    pRoom = DUNGEON_FindRoomBySubtileCoords113c(m, pAct1, nDestX, nDestY) >>> 0
    if (pRoom !== 0) {
      DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, pGame)
    }
  }
  return (
    SUNIT_GetServerUnit113c(
      m,
      pGame,
      m.u32((pPortalUnit + 0x94) >>> 0),
      m.u32((pPortalUnit + 0x98) >>> 0),
    ) >>> 0
  )
}

function clearUnitAnimEvents0And1_113c(m: D2KernMemory113c, pGame: number, pUnit: number): void {
  if (pUnit === 0) return
  let pEv0 = m.u32((pUnit + 0xdc) >>> 0) >>> 0
  while (pEv0 !== 0) {
    const pNext = m.u32((pEv0 + 0x24) >>> 0) >>> 0
    if (m.u8(pEv0) === 0) {
      EVENT_FreeNode113c(m, pGame, pEv0)
    }
    pEv0 = pNext
  }
  let pEv1 = m.u32((pUnit + 0xdc) >>> 0) >>> 0
  while (pEv1 !== 0) {
    const pNext = m.u32((pEv1 + 0x24) >>> 0) >>> 0
    if (m.u8(pEv1) === 1) {
      EVENT_FreeNode113c(m, pGame, pEv1)
    }
    pEv1 = pNext
  }
}

function scheduleUnitAnimEventsFromFrame113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nCurFrame: number,
  nGameFrame: number,
): void {
  m.setU32((pUnit + 0x44) >>> 0, ((nGameFrame - nCurFrame) << 8) >>> 0)
  const pSeq0 = m.u32((pUnit + 0x30) >>> 0) >>> 0
  const nSpeedFp8 =
    pSeq0 !== 0
      ? m.u32((pUnit + 0x3c) >>> 0) | 0
      : ((m.u16((pUnit + 0x4c) >>> 0) << 16) >> 16) | 0
  const nTotalFp8 = pSeq0 !== 0 ? m.u32((pUnit + 0x34) >>> 0) | 0 : m.u32((pUnit + 0x48) >>> 0) | 0
  if (nSpeedFp8 === 0) {
    const nNext = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 1) >>> 0
    EVENT_SetEventFull113c(m, pGame, pUnit, 1, nNext, 0, 0, 0)
    return
  }
  const pAnimData = m.u32((pUnit + 0x50) >>> 0) >>> 0
  let nCheckFrame = (nCurFrame - 1) | 0
  let nFpPos = (nCurFrame << 8) | 0
  let nNextFpPos = (nFpPos + nSpeedFp8) | 0
  let nTargetGameFrame = nGameFrame | 0
  if (nNextFpPos < nTotalFp8) {
    const pEvScratch = allocW5B7Stack(m, 0x10)
    try {
      do {
        nFpPos = (nFpPos + nSpeedFp8) | 0
        nNextFpPos = (nNextFpPos + nSpeedFp8) | 0
        const nEndWhole = nFpPos >> 8
        nTargetGameFrame = (nTargetGameFrame + 1) | 0
        while (nCheckFrame <= nEndWhole) {
          let nEvCode = 0
          const pSeqNow = m.u32((pUnit + 0x30) >>> 0) >>> 0
          if (pSeqNow !== 0) {
            ANIMSEQ_GetEventAtFrame113c(m, pSeqNow, (nCheckFrame << 8) >>> 0, pEvScratch)
            nEvCode = m.u32(pEvScratch) | 0
          } else {
            nEvCode = m.u8((pAnimData + nCheckFrame + 0x10) >>> 0)
          }
          if (nEvCode > 0 && nEvCode <= 4) {
            EVENT_SetEventFull113c(m, pGame, pUnit, 0, nTargetGameFrame >>> 0, 0, nEvCode >>> 0, 0)
          }
          nCheckFrame = (nCheckFrame + 1) | 0
        }
      } while (nNextFpPos < nTotalFp8)
    } finally {
      freeW5B7Stack(pEvScratch)
    }
  }
  if (nTargetGameFrame === (m.u32((pGame + 0xa8) >>> 0) | 0)) {
    nTargetGameFrame = (nTargetGameFrame + 1) | 0
  }
  nTargetGameFrame = (nTargetGameFrame + 1) | 0
  EVENT_SetEventFull113c(m, pGame, pUnit, 1, nTargetGameFrame >>> 0, 0, 0, 0)
}

/**
 * Clears pending `EVENTTYPE_MODECHANGE` (`0`) and `EVENTTYPE_ENDANIM` (`1`) events on `pUnit`
 * and schedules frame-action (`0`) + end-anim (`1`) events starting at `nStartFrame`.
 *
 * @va D2Game:0x6FD02310
 */
export function SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nStartFrame: number,
): void {
  hitD2GameVa113c(0x6FD02310)
  clearUnitAnimEvents0And1_113c(m, pGame, pUnit)
  const nGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  scheduleUnitAnimEventsFromFrame113c(m, pGame, pUnit, nStartFrame | 0, nGameFrame)
}

/**
 * Rewinds `pUnit`'s current animation progress by `nRewindFrames` (if `> 0`) and reschedules
 * all remaining `EVENTTYPE_MODECHANGE` (`0`) and `EVENTTYPE_ENDANIM` (`1`) timer events.
 *
 * @va D2Game:0x6FD02480
 */
export function SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nRewindFrames: number,
): void {
  hitD2GameVa113c(0x6FD02480)
  if ((nRewindFrames | 0) <= 0) {
    return
  }
  clearUnitAnimEvents0And1_113c(m, pGame, pUnit)
  const nGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const nBaseShift = (m.u32((pUnit + 0x44) >>> 0) | 0) >> 8
  const nCurFrame = ((nGameFrame - nBaseShift) - (nRewindFrames | 0)) | 0
  scheduleUnitAnimEventsFromFrame113c(m, pGame, pUnit, nCurFrame, nGameFrame)
}

/**
 * Scales `pUnit`'s elapsed animation frames by `(100 - nSlowPct) / 100` and reschedules
 * remaining `EVENTTYPE_MODECHANGE` (`0`) and `EVENTTYPE_ENDANIM` (`1`) timer events.
 *
 * @va D2Game:0x6FD02600
 */
export function SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nSlowPct: number,
): void {
  hitD2GameVa113c(0x6FD02600)
  clearUnitAnimEvents0And1_113c(m, pGame, pUnit)
  const nGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const nBaseShift = (m.u32((pUnit + 0x44) >>> 0) | 0) >> 8
  const nElapsed = (nGameFrame - nBaseShift) | 0
  const prod = Math.imul(nElapsed, (100 - (nSlowPct | 0)) | 0)
  const hi = Number((BigInt(prod) * 0x51eb851fn) >> 32n) | 0
  const sar5 = hi >> 5
  const nCurFrame = (sar5 + (sar5 >>> 31)) | 0
  scheduleUnitAnimEventsFromFrame113c(m, pGame, pUnit, nCurFrame, nGameFrame)
}

/**
 * Probes free town spawn coordinates (`mask 0x3C01`) for Act 5 Quest 3 (`0x1C` Prison of Ice)
 * around `(pQuestFilter + 4, pQuestFilter + 8)`, caching the chosen `(x, y)` into `pOutCoords` and `pQuestFilter`.
 *
 * @va D2Game:0x6FD02780
 */
export function ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pOutCoords: number,
): number {
  hitD2GameVa113c(0x6FD02780)
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0 && m.u32(pQuest) !== 0x1c) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return 0
  const pFilter = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8(pFilter) === 0) return 0
  const baseX = m.u32((pFilter + 4) >>> 0)
  const baseY = m.u32((pFilter + 8) >>> 0)
  m.setU32(pOutCoords >>> 0, baseX)
  m.setU32((pOutCoords + 4) >>> 0, baseY)
  if (m.u8((pFilter + 2) >>> 0) !== 0) {
    return 1
  }
  m.setU32((pOutCoords + 4) >>> 0, (baseY - 20) >>> 0)
  m.setU8((pFilter + 2) >>> 0, 1)
  if (
    UNITS_FindFreeCoords113c(m, pUnit, m.u32(pOutCoords >>> 0) | 0, m.u32((pOutCoords + 4) >>> 0) | 0, 0x3c01) !== 0
  ) {
    const y2 = (m.u32((pOutCoords + 4) >>> 0) + 9) >>> 0
    m.setU32((pOutCoords + 4) >>> 0, y2)
    if (UNITS_FindFreeCoords113c(m, pUnit, m.u32(pOutCoords >>> 0) | 0, y2 | 0, 0x3c01) !== 0) {
      const x3 = (m.u32(pOutCoords >>> 0) + 2) >>> 0
      m.setU32(pOutCoords >>> 0, x3)
      if (UNITS_FindFreeCoords113c(m, pUnit, x3 | 0, m.u32((pOutCoords + 4) >>> 0) | 0, 0x3c01) !== 0) {
        const x4 = (m.u32(pOutCoords >>> 0) - 4) >>> 0
        m.setU32(pOutCoords >>> 0, x4)
        if (UNITS_FindFreeCoords113c(m, pUnit, x4 | 0, m.u32((pOutCoords + 4) >>> 0) | 0, 0x3c01) !== 0) {
          const rx = m.u32((pFilter + 4) >>> 0)
          const ry = (m.u32((pFilter + 8) >>> 0) - 8) >>> 0
          m.setU32(pOutCoords >>> 0, rx)
          m.setU32((pOutCoords + 4) >>> 0, ry)
          if (UNITS_FindFreeCoords113c(m, pUnit, rx | 0, ry | 0, 0x3c01) !== 0) {
            m.setU32((pOutCoords + 4) >>> 0, (m.u32((pOutCoords + 4) >>> 0) + 5) >>> 0)
          }
        }
      }
    }
  }
  m.setU32((pFilter + 4) >>> 0, m.u32(pOutCoords >>> 0))
  m.setU32((pFilter + 8) >>> 0, m.u32((pOutCoords + 4) >>> 0))
  return 1
}

export type QuestStatusFilterHook113c = (
  m: D2KernMemory113c,
  pQuestData: number,
  fnVa: number,
) => number

function invokeQuestStatusFilter113c(
  m: D2KernMemory113c,
  pTargetQuest: number,
  onStatusFilter?: QuestStatusFilterHook113c,
): number {
  const fnVa = m.u32((pTargetQuest + 0xf0) >>> 0) >>> 0
  switch (fnVa) {
    case 0x6fd02a40:
      return QUESTS_ChainStatusFilterNotState7_6FD02A40_113c(m, pTargetQuest, onStatusFilter)
    case 0x6fd02b70:
      return QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c(m, pTargetQuest, onStatusFilter)
    case 0x6fd02d40:
      return QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c(m, pTargetQuest, onStatusFilter)
    case 0x6fd02e80:
      return QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c(m, pTargetQuest, onStatusFilter)
    case 0x6fd02f00:
      return QUESTS_ChainStatusFilterNotState5_6FD02F00_113c(m, pTargetQuest, onStatusFilter)
    default:
      if (onStatusFilter !== undefined) {
        return onStatusFilter(m, pTargetQuest, fnVa) & 0xff
      }
      return 0
  }
}

/**
 * Quest status filter (`pfStatusFilter`) returning `1` if `bLastState != 7` and `bNotIntro != 0`,
 * otherwise delegating to `QUESTS_GetQuestData(pGame, nChainQuestId)->pfStatusFilter`.
 *
 * @va D2Game:0x6FD02A40
 */
export function QUESTS_ChainStatusFilterNotState7_6FD02A40_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  onStatusFilter?: QuestStatusFilterHook113c,
): number {
  hitD2GameVa113c(0x6FD02A40)
  if (m.u8((pQuestData + 0x0c) >>> 0) !== 7 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    return 1
  }
  const pPrev =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pPrev === 0) {
    return 0
  }
  if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 0x1f5)
  }
  return invokeQuestStatusFilter113c(m, pPrev, onStatusFilter) & 0xff
}

/**
 * Quest status filter (`pfStatusFilter`) returning `1` if `bLastState != 5` and `bNotIntro != 0`,
 * otherwise evaluating the prerequisite quest (`+0x10`) OR Quest `0x11` (`Khalim's Will`).
 *
 * @va D2Game:0x6FD02B70
 */
export function QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  onStatusFilter?: QuestStatusFilterHook113c,
): number {
  hitD2GameVa113c(0x6FD02B70)
  if (m.u8((pQuestData + 0x0c) >>> 0) !== 5 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    return 1
  }
  const pPrev =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  let bPrevRes = 0
  if (pPrev !== 0) {
    if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
      throw new D2CommonAssertError('Quests.cpp', 0x284)
    }
    bPrevRes = invokeQuestStatusFilter113c(m, pPrev, onStatusFilter) & 0xff
  }
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl !== 0) {
    let pCur = m.u32(pQuestCtrl) >>> 0
    while (pCur !== 0 && m.u32(pCur) !== 0x11) {
      pCur = m.u32((pCur + 0xf4) >>> 0) >>> 0
    }
    if (pCur !== 0) {
      if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
        throw new D2CommonAssertError('Quests.cpp', 0x28a)
      }
      const bQuest17Res = invokeQuestStatusFilter113c(m, pCur, onStatusFilter) & 0xff
      return bQuest17Res !== 0 || bPrevRes !== 0 ? 1 : 0
    }
  }
  return bPrevRes
}

/**
 * Quest status filter (`pfStatusFilter`) promoting `bLastState == 0 -> 1` and returning `1` when
 * `bLastState != 5` and `bNotIntro != 0`, otherwise delegating to prerequisite quest (`line 0x2DC`).
 *
 * @va D2Game:0x6FD02D40
 */
export function QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  onStatusFilter?: QuestStatusFilterHook113c,
): number {
  hitD2GameVa113c(0x6FD02D40)
  const bLastState = m.u8((pQuestData + 0x0c) >>> 0)
  if (bLastState !== 5 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    if (bLastState === 0) {
      m.setU8((pQuestData + 0x0c) >>> 0, 1)
    }
    return 1
  }
  const pPrev =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pPrev === 0) {
    return 0
  }
  if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 0x2dc)
  }
  return invokeQuestStatusFilter113c(m, pPrev, onStatusFilter) & 0xff
}

/**
 * Quest status filter (`pfStatusFilter`) promoting `bLastState == 0 -> 1` and returning `1` when
 * `bLastState != 5` and `bNotIntro != 0`, otherwise delegating to prerequisite quest (`line 0x21B`).
 *
 * @va D2Game:0x6FD02E80
 */
export function QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  onStatusFilter?: QuestStatusFilterHook113c,
): number {
  hitD2GameVa113c(0x6FD02E80)
  const bLastState = m.u8((pQuestData + 0x0c) >>> 0)
  if (bLastState !== 5 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    if (bLastState === 0) {
      m.setU8((pQuestData + 0x0c) >>> 0, 1)
    }
    return 1
  }
  const pPrev =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pPrev === 0) {
    return 0
  }
  if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 0x21b)
  }
  return invokeQuestStatusFilter113c(m, pPrev, onStatusFilter) & 0xff
}

/**
 * Quest status filter (`pfStatusFilter`) returning `1` if `bLastState != 5` and `bNotIntro != 0`,
 * otherwise delegating to `QUESTS_GetQuestData(pGame, nChainQuestId)->pfStatusFilter` (`line 0x328`).
 *
 * @va D2Game:0x6FD02F00
 */
export function QUESTS_ChainStatusFilterNotState5_6FD02F00_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  onStatusFilter?: QuestStatusFilterHook113c,
): number {
  hitD2GameVa113c(0x6FD02F00)
  if (m.u8((pQuestData + 0x0c) >>> 0) !== 5 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    return 1
  }
  const pPrev =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      m.u32((pQuestData + 0x10) >>> 0) | 0,
    ) >>> 0
  if (pPrev === 0) {
    return 0
  }
  if (m.u32((pQuestData + 0xf0) >>> 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 0x328)
  }
  return invokeQuestStatusFilter113c(m, pPrev, onStatusFilter) & 0xff
}
