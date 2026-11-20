/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 8 Batch 3 (w8b3).
 *
 * Clean-room 1:1 binary-isomorphic port of 30 D2Game.dll v1.13c functions in
 * the 0x6FCDD880..0x6FD07080 address range.
 */

import { COLLISION_FindFreePositionBasic113c } from '../common/collision'
import {
  UNITS_GetObjectPortalFlags113c,
  UNITS_GetPlayerData113c,
  UNITS_SetObjectPortalFlags113c,
} from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_AutoPlaceItemInBelt113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_NoOpRet8B113c,
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_PlaceItemInSocket113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UpdateWeaponGuidOnInsert113c,
  ITEMS_GetCellOverwrite113c,
  UNITS_SetStaticPathPosX113c,
  UNITS_SetStaticPathPosY113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_B043_GetMaxDurabilityFromUnit113c,
  ITEMS_CanItemBeRepairedByNpc113c,
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckRequirements113c,
  ITEMS_GetAllowedBodyLocations113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_IsAutoStack113c,
  ITEMS_IsBeltable113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
} from '../common/path'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record'
import { SKILLS_GetUsedSkill113c } from '../common/skills'
import {
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_GetRoom113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit'
import type { Memory113c as SparseMemory113c } from '../mem/sparse-memory'
import { ACT2Q1_Callback03_LevelChanged113c } from './a1c-post150-f150-f276-113c'
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import { C2S_CheckCoordDeltaExceeded113c } from './c2s-packet-113c'
import {
  ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c,
  ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c,
} from './k2-real-itemdrop-113c'
import {
  ITEMS_GetOppositeHandOrRingBodyLoc113c,
  NET_SendEventMessage5A_Type0E_113c,
} from './k2-combat-core-w1-113c'
import {
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_DeactivateEquippedItemStats113c,
  ITEMS_OnEquipScrollOrTome113c,
  ITEMS_UpdateScrollOrTomeSkillCharges113c,
} from './k2-gap-itemdef-113c'
import { NET_SendPacket0x3E_ItemStatBitStream113c } from './k2-gap-melee-dot-113c'
import {
  QUESTS_GuidListAdd113c,
  QUESTS_SendNpcMessagePacket27_113c,
} from './k2-items-tc-w1-113c'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_CheckGlobalQuestState_6FC538D0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
  QUESTS_TriggerItemDropped_6FC545A0_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c } from './k2-w2b1-113c'
import { SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c } from './k2-w2b4-113c'
import {
  ACT2Q2_AddStaffCount_6FCE2380_113c,
  ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c,
  ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c,
  ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c,
  ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c,
  ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c,
} from './k2-w2b7-113c'
import { ITEMS_PlaceItemInSocketInventory_6FCF1650_113c } from './k2-w2b8-113c'
import { ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c } from './k2-w3b1-113c'
import {
  QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c,
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c,
} from './k2-w3b3-113c'
import {
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c,
} from './k2-w3b7-113c'
import { ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c } from './k2-w4b3-113c'
import { PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c } from './k2-w5b1-113c'
import {
  ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c,
  ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c,
  ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c,
  ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
  ACT2Q5_ActiveFilter_6FCE1E10_113c,
  ACT2Q5_Callback00_NpcActivate_6FCE3080_113c,
  ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c,
} from './k2-w5b4-113c'
import {
  ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c,
  ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
  ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c,
  ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c,
  ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
  ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c,
} from './k2-w5b5-113c'
import {
  C2S_ValidateBeltItemOwnership_6FCECDB0_113c,
  C2S_ValidateCursorItem_6FCECF70_113c,
  C2S_ValidateInventoryOrCursorItem_6FCECE20_113c,
  C2S_ValidateStoredItem_6FCECF00_113c,
} from './k2-w5b6-113c'
import {
  ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c,
  ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c,
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c,
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from './k2-w5b7-113c'
import {
  ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c,
  ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c,
  NET_BroadcastSystemChatMessage_6FCEBE70_113c,
} from './k2-w6b3-113c'
import {
  QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c,
  QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c,
} from './k2-w6b4-113c'
import {
  ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c,
  ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c,
  ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c,
  PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c,
} from './k2-w6b5-113c'
import {
  ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c,
  ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c,
  ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c,
  ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c,
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c,
} from './k2-w6b6-113c'
import {
  ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c,
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c,
} from './k2-w7b1-113c'
import {
  ACT2Q3_StartEclipseEvent_6FCE6A30_113c as ACT2Q3_ActivateTaintedSunQuest_6FCE6A30_113c,
  ACT2Q5_OnScrollMessage_6FCE67C0_113c as ACT2Q5_Callback02_MonsterKilled_6FCE67C0_113c,
  ACT2Q5_OnSummonerKilled_6FCE66B0_113c,
} from './k2-w7b3-113c'
import {
  ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c,
  ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c,
  ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c,
  ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c,
  ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c as ITEMS_RemoveItemFromInventoryGridOrCursor_6FCF62E0_113c,
  ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c,
  ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c,
  ITEMS_SwitchWeaponSlots_6FCF8EA0_113c as ITEMS_SwapMainAndAlternateWeapons_6FCF8EA0_113c,
  ITEMS_UseBeltItem_6FCF8BA0_113c as ITEMS_UseBeltConsumableOrScroll_6FCF8BA0_113c,
  ITEMS_UseInventoryItem_6FCF9BF0_113c as ITEMS_UseStoredConsumableOrBook_6FCF9BF0_113c,
  ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c as ITEMS_IdentifyItemFromScrollOrTome_6FCF9FB0_113c,
} from './k2-w7b4-113c'
import {
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events'
import {
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_AllocUnitData113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { ITEMS_CheckItemTypeId113c } from './replay-kernel-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

export type { SparseMemory113c }

let k2W8B3StackPtr = 0x7ef83000

function allocW8B3Stack(m: SparseMemory113c, size: number): number {
  const aligned = (size + 15) & ~15
  const base = k2W8B3StackPtr >>> 0
  k2W8B3StackPtr = (base + aligned) >>> 0
  for (let i = 0; i < aligned; i += 4) {
    m.setU32((base + i) >>> 0, 0)
  }
  return base
}

function freeW8B3Stack(base: number): void {
  k2W8B3StackPtr = base >>> 0
}

/**
 * [1/30] Returns a gambled or sold item back into the player's inventory grid, or removes and frees it.
 *
 * @dll D2Game.dll
 * @va 0x6FCDD880
 * @ordinalOrName D2Game_6FCDD880
 */
export function NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c(
  m: SparseMemory113c,
  pItem: number,
  pGame: number,
  pPlayer: number,
  bKeepItem = 0,
): number {
  hitD2GameVa113c(0x6FCDD880)
  if (pGame === 0) throw new D2CommonAssertError('0x6fd19ff9', 0x1a2)
  if (pPlayer === 0) throw new D2CommonAssertError('0x6fd19ff9', 0x1a3)
  if (pItem === 0) throw new D2CommonAssertError('0x6fd19ff9', 0x1a4)
  const sp = allocW8B3Stack(m, 0x10)
  try {
    const dwItemGuid = m.u32((pItem + 0x0c) >>> 0) >>> 0
    ITEMS_RemoveItemFromInventoryGridOrCursor_6FCF62E0_113c(
      m,
      0,
      pPlayer,
      pGame,
      dwItemGuid,
      sp,
      0,
      0,
      0,
    )
    if ((bKeepItem | 0) !== 0) {
      m.setU32((pItem + 0xc8) >>> 0, (m.u32((pItem + 0xc8) >>> 0) | 0x10) >>> 0)
      UNITS_SetUnitUpdateFlags113c(m, pPlayer, 1)
      INVENTORY_AppendItemGuidNode113c(m, m.u32((pPlayer + 0x60) >>> 0), pItem)
      ITEMS_SetItemFlag113c(m, pItem, 1, 1)
      return 1
    }
    ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pItem)
    return 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * [2/30] Places a gambled/bought item into the player's NPC proxy inventory slot, or removes and frees it.
 *
 * @dll D2Game.dll
 * @va 0x6FCDD920
 * @ordinalOrName D2Game_6FCDD920
 */
export function NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c(
  m: SparseMemory113c,
  pNpcUnit: number,
  pPlayerUnit: number,
  pItem: number,
  pGame: number,
  bKeepItem = 0,
): number {
  hitD2GameVa113c(0x6FCDD920)
  if (pItem === 0 || pNpcUnit === 0) return 0
  const pNpcInv = SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(
    m,
    pNpcUnit,
    pGame,
    pPlayerUnit,
  ) >>> 0
  if (pNpcInv === 0) return 0
  const sp = allocW8B3Stack(m, 0x10)
  try {
    const dwItemGuid = m.u32((pItem + 0x0c) >>> 0) >>> 0
    ITEMS_RemoveItemFromInventoryGridOrCursor_6FCF62E0_113c(
      m,
      pNpcInv,
      pNpcUnit,
      pGame,
      dwItemGuid,
      sp,
      0,
      0,
      0,
    )
    if ((bKeepItem | 0) !== 0) {
      m.setU32((pItem + 0xc8) >>> 0, (m.u32((pItem + 0xc8) >>> 0) | 0x10) >>> 0)
      UNITS_SetUnitUpdateFlags113c(m, pNpcUnit, 1)
      INVENTORY_AppendItemGuidNode113c(m, pNpcInv, pItem)
      ITEMS_SetItemFlag113c(m, pItem, 1, 1)
      return 1
    }
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      pGame,
      (mem, _g, pLivingPlayer, pTargetItem) =>
        ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pLivingPlayer, pTargetItem),
      pItem,
    )
    SUNIT_FreeUnit113c(m, pGame, pItem)
    return 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * [3/30] Repairs durability, replenishes throwable stack quantity, and recharges skill charges on an item.
 *
 * @dll D2Game.dll
 * @va 0x6FCDD9B0
 * @ordinalOrName D2Game_6FCDD9B0
 */
export function NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(
  m: SparseMemory113c,
  pPlayer: number,
  pItem: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCDD9B0)
  if (ITEMS_CanItemBeRepairedByNpc113c(m, pItem) === 0) return
  if (
    ITEMS_CheckIfThrowItemMemPort113c(m, pItem) !== 0 &&
    ITEMS_GetTwoHandedFlag113c(m, pItem) !== 0
  ) {
    const nMaxStack = ITEMS_GetTotalMaxStack113c(m, pItem) | 0
    STATLIST_SetUnitStat113c(m, pItem, 0x46, nMaxStack, 0)
    if (pPlayer !== 0) {
      let pClient = 0
      if (m.u32(pPlayer >>> 0) === 0) {
        const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
        pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
      }
      NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pClient, 1, 0x46, nMaxStack)
    }
  }
  ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(m, pGame, pPlayer, pItem)
  if (ITEMS_CheckCommandFlags113c(m, pItem, 0x100, 0xba, 0x6fd1b3a4) !== 0) {
    ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c(m, pPlayer, pItem, pGame)
    return
  }
  const nMaxDurability = ITEMS_B043_GetMaxDurabilityFromUnit113c(m, pItem) | 0
  if (nMaxDurability > 0) {
    STATLIST_SetUnitStat113c(m, pItem, 0x48, nMaxDurability, 0)
    if (pPlayer !== 0) {
      let pClient = 0
      if (m.u32(pPlayer >>> 0) === 0) {
        const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
        pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
      }
      NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pClient, 1, 0x48, nMaxDurability)
    }
  }
}

/**
 * [4/30] Act 2 Quest 5 (The Summoner): activates quest state 2 when a player enters the sanctuary area.
 *
 * @dll D2Game.dll
 * @va 0x6FCE6600
 * @ordinalOrName D2Game_6FCE6600
 */
export function ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c(
  m: SparseMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCE6600)
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x0c) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return
  if (m.u8((pQuest + 0x09) >>> 0) !== 1) return
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestState + 0x01) >>> 0) === 0) {
    m.setU8((pQuestState + 0x01) >>> 0, 1)
  }
  if (m.u8((pQuest + 0x0c) >>> 0) === 0) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 1)
  }
  if (m.u8((pQuest + 0x0b) >>> 0) >= 2) return
  m.setU8((pQuest + 0x14) >>> 0, 0)
  m.setU8((pQuest + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0),
    ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c,
    0,
    0,
  )
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0),
    ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c,
    0,
    0,
  )
}

/**
 * [5/30] Act 2 Quest 4 (Arcane Sanctuary): activates quest state 1 or opens the Harem-to-Arcane portal.
 *
 * @dll D2Game.dll
 * @va 0x6FCE6920
 * @ordinalOrName D2Game_6FCE6920
 */
export function ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c(
  m: SparseMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCE6920)
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x0b) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c(m, pQuestState, pQuest)
    return
  }
  if (m.u8((pQuest + 0x0c) >>> 0) === 0) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 1)
  }
  if (m.u8((pQuest + 0x0b) >>> 0) !== 0) return
  m.setU8((pQuest + 0x14) >>> 0, 0)
  m.setU8((pQuest + 0x0b) >>> 0, 1)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0),
    ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
    0,
    0,
  )
}

/**
 * [6/30] Act 2 Quest 3 (Tainted Sun): timer callback that activates the eclipse or syncs quest progress.
 *
 * @dll D2Game.dll
 * @va 0x6FCE6AF0
 * @ordinalOrName D2Game_6FCE6AF0
 */
export function ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c(
  m: SparseMemory113c,
  pQuestOrGame: number,
  pQuestAlt = 0,
): number {
  hitD2GameVa113c(0x6FCE6AF0)
  const pQuest = (pQuestAlt !== 0 ? pQuestAlt : pQuestOrGame) >>> 0
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const bAlreadyStarted = m.u8((pQuestState + 0x02) >>> 0)
  m.setU8((pQuestState + 0x01) >>> 0, 0)
  if (bAlreadyStarted === 0) {
    const bActivated = ACT2Q3_ActivateTaintedSunQuest_6FCE6A30_113c(m, pQuest) & 0xff
    if (bActivated === 0) {
      m.setU8((pQuestState + 0x03) >>> 0, 1)
      return 1
    }
    m.setU8((pQuestState + 0x02) >>> 0, 1)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c,
      0,
      0,
    )
  }
  return 1
}

/**
 * [7/30] Act 2 Quest 3 (Tainted Sun) Callback 01 (NPC Deactivate): handles Drognan intro and completion.
 *
 * @dll D2Game.dll
 * @va 0x6FCE6B30
 * @ordinalOrName D2Game_6FCE6B30
 */
export function ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c(
  m: SparseMemory113c,
  pQuest: number,
  pQuestArg: number,
  onQuestChainCallback?: (m: SparseMemory113c, pQuest: number) => void,
): void {
  hitD2GameVa113c(0x6FCE6B30)
  const wMessageId = m.u16((pQuestArg + 0x18) >>> 0)
  if (wMessageId === 0x15c) {
    if (m.u8((pQuest + 0x09) >>> 0) === 0) return
    if (m.u32((pQuestArg + 0x14) >>> 0) !== 0xb1) return
    if (m.u8((pQuest + 0x0b) >>> 0) === 1) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 2)
    }
    if (m.u8((pQuest + 0x0c) >>> 0) !== 1) return
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 2)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c,
      0,
      0,
    )
    return
  }
  if ((wMessageId | 0) <= 0x169 || (wMessageId | 0) > 0x174) return
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (m.u8((pQuest + 0x0c) >>> 0) !== 5 && m.u8((pQuest + 0x09) >>> 0) === 1) {
    const nQuestId = m.u32((pQuest + 0xe0) >>> 0)
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, nQuestId, 0x0d) !== 0) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 0x0d)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 5)
      if (m.u32((pQuest + 0xf0) >>> 0) === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0xdd)
      }
      if (onQuestChainCallback !== undefined) {
        onQuestChainCallback(m, pQuest)
      }
    }
  }
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
    m,
    m.u32((pQuestArg + 0x08) >>> 0),
    m.u32((pQuestArg + 0x0c) >>> 0),
    m.u32(pQuestArg >>> 0),
  )
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, m.u32((pQuest + 0xe0) >>> 0), 1) !== 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x0b, 0)
    QUESTRECORD_ClearQuestState113c(m, pQuestRecord, 0x0b, 1)
    const pPlayerUnit = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    const dwPlayerGuid = pPlayerUnit === 0 ? 0xffffffff : m.u32((pPlayerUnit + 0x0c) >>> 0) >>> 0
    QUESTS_GuidListAdd113c(m, (pQuest + 0x1c) >>> 0, dwPlayerGuid)
    if (m.u8((pQuest + 0x09) >>> 0) === 0) {
      QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32((pQuest + 0x04) >>> 0), 0x0b, 0x0d)
    }
  }
}

/**
 * [8/30] Act 2 Quest 1 (Radament's Lair): advances quest to state 3 when a player enters Sewers Level 3 (`0x31`).
 *
 * @dll D2Game.dll
 * @va 0x6FCE6D20
 * @ordinalOrName D2Game_6FCE6D20
 */
export function ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCE6D20)
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return
  let pQuest = m.u32(pQuestControl) >>> 0
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 8) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return
  if (m.u8((pQuest + 0x09) >>> 0) !== 1) return
  if (m.u8((pQuest + 0x0c) >>> 0) >= 3 && m.u8((pQuest + 0x0b) >>> 0) >= 2) return
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  if (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) !== 0x31) return
  let bUpdatedSubState = 0
  m.setU32((pQuest + 0xa8) >>> 0, 0)
  if (m.u8((pQuest + 0x0c) >>> 0) < 3) {
    bUpdatedSubState = 1
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
  }
  if (m.u8((pQuest + 0x0b) >>> 0) < 2) {
    const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
    m.setU8((pQuest + 0x14) >>> 0, 0)
    let bNotifyPlayers = 0
    if (m.u8((pQuestState + 0x09) >>> 0) === 0) {
      m.setU8((pQuestState + 0x09) >>> 0, 1)
      bNotifyPlayers = 1
    }
    QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c(
      m,
      ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
      pQuest,
      0,
      2,
      bNotifyPlayers,
    )
  } else if (bUpdatedSubState === 0) {
    return
  }
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuest + 0x04) >>> 0),
    ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c,
    0,
    0,
  )
}

/**
 * [9/30] Act 2 Quest 1 (Radament's Lair) Callback 01 (NPC Deactivate): handles Atma intro (`0x130`) and reward (`0x14E`).
 *
 * @dll D2Game.dll
 * @va 0x6FCE6E90
 * @ordinalOrName D2Game_6FCE6E90
 */
export function ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c(
  m: SparseMemory113c,
  pQuest: number,
  pQuestArg: number,
  onQuestChainCallback?: (m: SparseMemory113c, pTargetQuest: number) => void,
): void {
  hitD2GameVa113c(0x6FCE6E90)
  const wMessageId = m.u16((pQuestArg + 0x18) >>> 0)
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (wNpcClassId !== 0xb0) return
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (wMessageId === 0x130) {
    m.setU8((pQuestState + 0x08) >>> 0, 1)
    m.setU8((pQuest + 0x0c) >>> 0, 2)
    if (m.u32(0x6fd31c20) !== 0) {
      const sp = allocW8B3Stack(m, 0x100)
      try {
        const msg = 'changing state to 2\n'
        for (let i = 0; i < msg.length; i++) m.setU8((sp + i) >>> 0, msg.charCodeAt(i))
        m.setU8((sp + msg.length) >>> 0, 0)
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, sp, m.u32((pQuest + 0x04) >>> 0), 4)
      } finally {
        freeW8B3Stack(sp)
      }
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c,
      0,
      0,
    )
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      m.u32((pQuestArg + 0x0c) >>> 0),
      pGame,
    )
    return
  }
  if (wMessageId !== 0x14e) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, m.u32((pQuest + 0xe0) >>> 0), 1) === 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, m.u32((pQuest + 0xe0) >>> 0), 0x0d) !== 0) {
    if (m.u8((pQuest + 0x0c) >>> 0) !== 5) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 0x0d)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0),
        ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
        0,
        0,
      )
      m.setU32((pQuest + 0xa8) >>> 0, 0)
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 5)
      if (m.u32((pQuest + 0xf0) >>> 0) === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0xfe)
      }
      if (onQuestChainCallback !== undefined) {
        onQuestChainCallback(m, pQuest)
      }
    }
    if (m.u8((pQuest + 0x09) >>> 0) === 0) {
      QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32((pQuest + 0x04) >>> 0), 9, 0x0d)
    }
  } else if (m.u8((pQuestState + 0x10) >>> 0) !== 0) {
    const pChainedQuest = QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      m.u32((pQuest + 0x10) >>> 0),
    ) >>> 0
    if (pChainedQuest !== 0) {
      if (m.u32((pQuest + 0xf0) >>> 0) === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x10d)
      }
      if (onQuestChainCallback !== undefined) {
        onQuestChainCallback(m, pChainedQuest)
      }
    }
  }
  const nQuestId = m.u32((pQuest + 0xe0) >>> 0)
  QUESTRECORD_SetQuestState113c(m, pQuestRecord, nQuestId, 0)
  QUESTRECORD_ClearQuestState113c(m, pQuestRecord, nQuestId, 1)
  const pPlayer2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const dwPlayerGuid = pPlayer2 === 0 ? 0xffffffff : m.u32((pPlayer2 + 0x0c) >>> 0) >>> 0
  QUESTS_GuidListAdd113c(m, (pQuest + 0x1c) >>> 0, dwPlayerGuid)
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
    m,
    m.u32((pQuestArg + 0x08) >>> 0),
    m.u32((pQuestArg + 0x0c) >>> 0),
    m.u32(pQuestArg >>> 0),
  )
}

/**
 * [10/30] Act 2 Quest 5 (The Summoner): initializes quest data structure and callback table.
 *
 * @dll D2Game.dll
 * @va 0x6FCE7080
 * @ordinalOrName D2Game_6FCE7080
 */
export function ACT2Q5_InitQuestData_6FCE7080_113c(
  m: SparseMemory113c,
  pQuest: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FCE7080)
  for (let i = 0; i < 15; i++) {
    m.setU32((pQuest + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd24ff8)
  m.setU8((pQuest + 0x0a) >>> 0, 1)
  m.setU8((pQuest + 0x0c) >>> 0, 0)
  const pState = (pPreallocatedState !== 0 ? pPreallocatedState : allocW8B3Stack(m, 0x10)) >>> 0
  m.setU32((pQuest + 0xe8) >>> 0, 0)
  m.setU32((pQuest + 0x18) >>> 0, pState)
  m.setU32((pQuest + 0xe0) >>> 0, 0x0d)
  m.setU8((pQuest + 0x0d) >>> 0, 2)
  m.setU32((pQuest + 0xec) >>> 0, 0x6fce1e10)
  m.setU32((pQuest + 0xac) >>> 0, 0x6fce2e20)
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fce67c0)
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fce2f00)
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fce2dc0)
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fce66b0)
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fce3080)
  m.setU8(pState, 0)
  m.setU8((pState + 0x01) >>> 0, 0)
  m.setU8((pState + 0x08) >>> 0, 0)
  m.setU32((pState + 0x04) >>> 0, 0)
}

/**
 * [11/30] Act 2 Quest 3 (Tainted Sun): activates eclipse or sends quest update packet `0x5D` (`0x0A, 0x01`) to player.
 *
 * @dll D2Game.dll
 * @va 0x6FCE7130
 * @ordinalOrName D2Game_6FCE7130
 */
export function ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c(
  m: SparseMemory113c,
  pQuest: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FCE7130)
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const bActivated = ACT2Q3_ActivateTaintedSunQuest_6FCE6A30_113c(m, pQuest) & 0xff
  if (bActivated !== 0) {
    m.setU8((pQuestState + 0x02) >>> 0, 1)
    return
  }
  m.setU8((pQuestState + 0x03) >>> 0, 1)
  const sp = allocW8B3Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    m.setU8(sp, 0x5d)
    m.setU8((sp + 1) >>> 0, 0x0a)
    m.setU8((sp + 2) >>> 0, 0x01)
    m.setU16((sp + 4) >>> 0, 0)
    let pClient = 0
    if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
      pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
    }
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 6)
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * [12/30] Act 2 Quest 3 (Tainted Sun): initializes Tainted Sun Altar object and advances quest state on spawn.
 *
 * @dll D2Game.dll
 * @va 0x6FCE71A0
 * @ordinalOrName D2Game_6FCE71A0
 */
export function ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c(
  m: SparseMemory113c,
  pQuest: number,
  pOpStrc: number,
): number {
  hitD2GameVa113c(0x6FCE71A0)
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pQuestState + 0x05) >>> 0, 1)
  const pObjectUnit = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
  const dwObjectGuid = pObjectUnit === 0 ? 0xffffffff : m.u32((pObjectUnit + 0x0c) >>> 0) >>> 0
  m.setU32((pQuestState + 0x0c) >>> 0, dwObjectGuid)
  if (m.u8((pQuest + 0x09) >>> 0) === 1) {
    if (m.u8((pQuest + 0x0c) >>> 0) <= 1) {
      const bActivated = ACT2Q3_ActivateTaintedSunQuest_6FCE6A30_113c(m, pQuest) & 0xff
      if (bActivated === 0) {
        m.setU8((pQuestState + 0x03) >>> 0, 1)
      } else {
        m.setU8((pQuestState + 0x02) >>> 0, 1)
      }
      m.setU8((pQuest + 0x0c) >>> 0, 3)
      m.setU8((pQuest + 0x14) >>> 0, 0)
    }
    if (m.u8((pQuest + 0x0b) >>> 0) === 0) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0),
        ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c,
        0,
        0,
      )
    }
  }
  const nAnimMode = m.u32((pQuestState + 0x08) >>> 0)
  return UNITS_ChangeAnimMode113c(m, m.u32((pOpStrc + 0x04) >>> 0), nAnimMode)
}

function advanceQuestControlLcgMod5Plus5_113c(m: SparseMemory113c, pQuestControl: number): number {
  const low = BigInt(m.u32((pQuestControl + 0x18) >>> 0))
  const high = BigInt(m.u32((pQuestControl + 0x1c) >>> 0))
  const prod = low * 0x6ac690c5n + high
  const newLow = Number(prod & 0xffffffffn) >>> 0
  const newHigh = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pQuestControl + 0x1c) >>> 0, newHigh)
  m.setU32((pQuestControl + 0x18) >>> 0, newLow)
  return ((newLow % 5) + 5) | 0
}

/**
 * [13/30] Act 2 Quest 3 (Tainted Sun): operates the Tainted Sun Altar object, drops Viper Amulet(s), ends eclipse, and completes quest.
 *
 * @dll D2Game.dll
 * @va 0x6FCE76B0
 * @ordinalOrName D2Game_6FCE76B0
 */
export function ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): number {
  hitD2GameVa113c(0x6FCE76B0)
  const pGame = m.u32(pOpStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x0a) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return 0
  const pPlayer = m.u32((pOpStrc + 0x08) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0b, 1) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0b, 0) === 1
  ) {
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0a, 0) === 1 ||
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20706976) !== 0 ||
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20747368) !== 0
    ) {
      SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer)
      return 0
    }
  }
  const pObjectUnit = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
  if (pObjectUnit !== 0 && m.u32((pObjectUnit + 0x10) >>> 0) !== 0) return 0
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const sp = allocW8B3Stack(m, 0x10)
  try {
    if (m.u8((pQuest + 0x09) >>> 0) === 0) {
      UNITS_ChangeAnimMode113c(m, pObjectUnit, 1)
      m.setU8((pQuestState + 0x04) >>> 0, 1)
      m.setU32((pQuestState + 0x08) >>> 0, 2)
      m.setU32((pQuestState + 0x9c) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(pOpStrc >>> 0),
        ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c,
        0,
        m.u32((pOpStrc + 0x08) >>> 0),
      )
      const pObj = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, UNITS_GetRoom113c(m, pObj))
      m.setU32(sp, nLevelId)
      m.setU32((pObj + 0xb8) >>> 0, 0x20706976)
      let nSpawned = 0
      for (let i = 0; i < (m.u32((pQuestState + 0x9c) >>> 0) | 0); i++) {
        const pDrop = ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
          m,
          m.u32(pOpStrc >>> 0),
          m.u32((pOpStrc + 0x04) >>> 0),
          7,
          sp,
          0,
          -1,
          0,
        ) >>> 0
        if (pDrop !== 0) {
          ITEMS_SetOrClearCommandFlags113c(m, pDrop, 0x10, 1)
          nSpawned++
        }
      }
      OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOpStrc, 4)
      const pQC = m.u32((m.u32(pOpStrc >>> 0) + 0x10f4) >>> 0) >>> 0
      if (pQC === 0) throw new D2CommonAssertError('0x6fd19ff9', 0x1fb)
      const nGoldPiles = advanceQuestControlLcgMod5Plus5_113c(m, pQC)
      for (let i = 0; i < nGoldPiles; i++) {
        OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
          m,
          0x20646c67,
          m.u32((pOpStrc + 0x04) >>> 0),
          m.u32(pOpStrc >>> 0),
          2,
        )
      }
      const pQC2 = m.u32((m.u32((pQuest + 0x04) >>> 0) + 0x10f4) >>> 0) >>> 0
      if (pQC2 !== 0) {
        let pNode = m.u32(pQC2) >>> 0
        while (pNode !== 0) {
          if (m.u32(pNode) === 9) {
            const pStaffState = m.u32((pNode + 0x18) >>> 0) >>> 0
            m.setU32(
              (pStaffState + 0x24) >>> 0,
              (m.u32((pStaffState + 0x24) >>> 0) + nSpawned) >>> 0,
            )
            break
          }
          pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
        }
      }
      return 0
    }
    const pRoom = UNITS_GetRoom113c(m, pObjectUnit) >>> 0
    m.setU32((pQuestState + 0x10) >>> 0, pRoom)
    m.setU32((pQuestState + 0x98) >>> 0, DUNGEON_GetLevelIdFromRoom113c(m, pRoom))
    const pObj = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
    UNITS_ChangeAnimMode113c(m, pObj, 1)
    m.setU32((pQuestState + 0x08) >>> 0, 2)
    m.setU8((pQuestState + 0x05) >>> 0, 1)
    const pObj2 = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
    m.setU32((pQuestState + 0x0c) >>> 0, pObj2 === 0 ? 0xffffffff : m.u32((pObj2 + 0x0c) >>> 0))
    m.setU8((pQuestState + 0x04) >>> 0, 1)
    if (m.u8((pQuest + 0x09) >>> 0) !== 0) {
      ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c(m, m.u32((pQuest + 0x04) >>> 0), pQuest)
      if (m.u32(0x6fd31c20) !== 0) {
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, 0x6fd1b2e0, m.u32((pQuest + 0x04) >>> 0), 4)
      }
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 4)
      QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c(m, m.u32((pQuest + 0x04) >>> 0), 6)
    }
    m.setU32((pQuestState + 0x9c) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(pOpStrc >>> 0),
      ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c,
      0,
      m.u32((pOpStrc + 0x08) >>> 0),
    )
    if (m.u8((pQuest + 0x09) >>> 0) !== 0) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0b, 0) === 0) {
        QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x0b, 1)
        QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x0b, 0x0d)
        QUESTRECORD_ClearQuestState113c(m, pQuestRecord, 0x0b, 0x0e)
      }
      const pAltarObj = m.u32((pOpStrc + 0x04) >>> 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(pOpStrc >>> 0),
        ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c,
        0,
        pAltarObj,
      )
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(pOpStrc >>> 0),
        ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c,
        0,
        pAltarObj,
      )
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(pOpStrc >>> 0),
        ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c,
        0,
        pAltarObj,
      )
      QUESTS_SetGlobalQuestState_6FC53920_113c(
        m,
        m.u32(pOpStrc >>> 0),
        m.u32((pQuest + 0xe0) >>> 0),
        0x0d,
      )
    }
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, m.u32((pQuestState + 0x10) >>> 0))
    m.setU32(sp, nLevelId)
    const pObj3 = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
    m.setU32((pObj3 + 0xb8) >>> 0, 0x20706976)
    let nSpawned = 0
    for (let i = 0; i < (m.u32((pQuestState + 0x9c) >>> 0) | 0); i++) {
      const pDrop = ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        m.u32(pOpStrc >>> 0),
        m.u32((pOpStrc + 0x04) >>> 0),
        7,
        sp,
        0,
        -1,
        0,
      ) >>> 0
      if (pDrop !== 0) {
        ITEMS_SetOrClearCommandFlags113c(m, pDrop, 0x10, 1)
        nSpawned++
      }
    }
    ACT2Q2_AddStaffCount_6FCE2380_113c(m, pQuest, nSpawned)
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOpStrc, 4)
    const pQC = m.u32((m.u32(pOpStrc >>> 0) + 0x10f4) >>> 0) >>> 0
    if (pQC === 0) throw new D2CommonAssertError('0x6fd19ff9', 0x1fb)
    const nGoldPiles = advanceQuestControlLcgMod5Plus5_113c(m, pQC)
    for (let i = 0; i < nGoldPiles; i++) {
      OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
        m,
        0x20646c67,
        m.u32((pOpStrc + 0x04) >>> 0),
        m.u32(pOpStrc >>> 0),
        2,
      )
    }
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c,
      0,
      0,
    )
    QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 10, pQuest, 0x6fce5e30)
    return 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * [14/30] Act 2 Quest 4 (Arcane Sanctuary) Callback 01 (NPC Deactivate): handles Kaelan, Horazon's Journal portal (`0x18C`), Drognan (`0x175`), and Jerhyn (`0x179`).
 *
 * @dll D2Game.dll
 * @va 0x6FCE85A0
 * @ordinalOrName D2Game_6FCE85A0
 */
export function ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c(
  m: SparseMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE85A0)
  if (pQuest === 0) return
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const wMessageId = m.u16((pQuestArg + 0x18) >>> 0)
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (wNpcClassId === 0x14b) {
    if (wMessageId === 0xba) {
      QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x0c, 7)
      return
    }
    if ((wMessageId | 0) > 0xba && (wMessageId | 0) <= 0xbd) {
      QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x0c, 8)
    }
    return
  }
  if (wMessageId >= 0x18d && wMessageId <= 0x197) {
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg >>> 0),
    )
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0c, 1) !== 0) {
      QUESTRECORD_ClearQuestState113c(m, pQuestRecord, 0x0c, 1)
      const pPlr = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
      const dwPlayerGuid = pPlr === 0 ? 0xffffffff : m.u32((pPlr + 0x0c) >>> 0) >>> 0
      QUESTS_GuidListAdd113c(m, (pQuest + 0x1c) >>> 0, dwPlayerGuid)
    }
  }
  if (wMessageId === 0x18c) {
    if (m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0b) >>> 0) < 5) {
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 5)
    }
    if (m.u8((pQuestState + 0x16) >>> 0) === 0) {
      const pPlayerRoom = UNITS_GetRoom113c(m, m.u32((pQuestArg + 0x0c) >>> 0)) >>> 0
      if (pPlayerRoom === m.u32((pQuestState + 0x08) >>> 0) >>> 0) {
        const sp = allocW8B3Stack(m, 0x30)
        try {
          m.setU32(sp, 0)
          PATH_GetTargetTypeAndPosition113c(m, m.u32((pQuestArg + 0x0c) >>> 0), (sp + 0x08) >>> 0)
          QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
            m,
            m.u32((pQuestState + 0x08) >>> 0),
            (sp + 0x08) >>> 0,
            2,
            0xbe11,
            sp,
            100,
          )
          const pFoundRoom = m.u32(sp) >>> 0
          if (pFoundRoom !== 0) {
            const pPlr = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
            const nTargetX = m.u32((sp + 0x08) >>> 0)
            const nTargetY = m.u32((sp + 0x0c) >>> 0)
            const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
            if (pPlr !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pFoundRoom) !== 0) {
              SUNIT_SetUnitEventSound113c(m, pPlr, 0x18, pPlr)
            } else {
              const nDestAct = DRLG_GetActNoFromLevelId113c(m, 0x2e) & 0xff
              const nSrcLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pFoundRoom)
              const nSrcAct = DRLG_GetActNoFromLevelId113c(m, nSrcLevelId) & 0xff
              if (nDestAct !== nSrcAct) {
                throw new D2CommonAssertError('0x6fd19ff9', 0xe5c)
              }
              m.setU32((sp + 0x10) >>> 0, nTargetX)
              m.setU32((sp + 0x14) >>> 0, nTargetY)
              if (
                COLLISION_FindFreePositionBasic113c(
                  m,
                  pFoundRoom,
                  (sp + 0x10) >>> 0,
                  (sp + 0x10) >>> 0,
                  3,
                  0x3e01,
                  0x0c01,
                  0,
                ) !== 0
              ) {
                const nFreeX = m.u32((sp + 0x10) >>> 0)
                const nFreeY = m.u32((sp + 0x14) >>> 0)
                const pPortalRoom = ROOM_FindRoomContainingSubtile113c(
                  m,
                  pFoundRoom,
                  nFreeX,
                  nFreeY,
                ) >>> 0
                if (pPortalRoom !== 0) {
                  const pSourcePortal = SUNIT_AllocUnitData113c(
                    m,
                    2,
                    0x3c,
                    nFreeX,
                    nFreeY,
                    pQuestGame,
                    pPortalRoom,
                    1,
                    1,
                    0,
                  ) >>> 0
                  UNITS_ChangeAnimMode113c(m, pSourcePortal, 1)
                  const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
                    m,
                    pQuestGame,
                    pSourcePortal,
                    0x2e,
                    nSrcLevelId,
                  ) >>> 0
                  if (pDestPortal !== 0) {
                    const nFlags = (UNITS_GetObjectPortalFlags113c(m, pDestPortal) | 3) & 0xff
                    UNITS_SetObjectPortalFlags113c(m, pDestPortal, nFlags)
                    DUNGEON_ToggleHasPortalFlag113c(m, pPortalRoom, 0)
                    DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pDestPortal), 0)
                    m.setU8((pQuestState + 0x16) >>> 0, 1)
                    QUESTS_SetGlobalQuestState_6FC53920_113c(
                      m,
                      m.u32(pQuestArg >>> 0),
                      m.u32((pQuest + 0xe0) >>> 0),
                      0x0d,
                    )
                  }
                }
              }
            }
          }
        } finally {
          freeW8B3Stack(sp)
        }
      }
    }
  }
  if (wNpcClassId === 0xb1) {
    if (wMessageId !== 0x175) return
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 2)
    m.setU8((pQuestState + 0x04) >>> 0, 1)
    ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c(m, pQuestState, pQuest)
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg >>> 0),
    )
    return
  }
  if (wNpcClassId === 0xc9 && wMessageId === 0x179) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 3)
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((pQuestArg + 0x08) >>> 0),
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg >>> 0),
    )
    m.setU8((pQuest + 0x14) >>> 0, 0)
    m.setU8((pQuest + 0x0b) >>> 0, 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
      0,
      0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c,
      0,
      0,
    )
  }
}

/**
 * [15/30] Act 2 Quest 4 (Arcane Sanctuary): operates Horazon's Journal object (`0x18C`) and completes Arcane Sanctuary quest.
 *
 * @dll D2Game.dll
 * @va 0x6FCE9A80
 * @ordinalOrName D2Game_6FCE9A80
 */
export function ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): number {
  hitD2GameVa113c(0x6FCE9A80)
  const pObjectUnit = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
  if (pObjectUnit === 0 || m.u32((pObjectUnit + 0x10) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pObjectUnit, 1)
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOpStrc + 0x10) >>> 0)) >>> 0
    const pGame = m.u32(pOpStrc >>> 0) >>> 0
    const nFrameDelta = m.u32((pObjTxt + 0xdc) >>> 0) >>> 8
    const nTargetFrame = (nFrameDelta + m.u32((pGame + 0xa8) >>> 0)) >>> 0
    EVENT_SetEventFull113c(m, pGame, m.u32((pOpStrc + 0x04) >>> 0), 1, nTargetFrame, 0, 0, 0)
  }
  const pGame = m.u32(pOpStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x0b) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return 0
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  QUESTS_SendNpcMessagePacket27_113c(
    m,
    m.u32((pOpStrc + 0x08) >>> 0),
    m.u32((pOpStrc + 0x04) >>> 0),
    0x18c,
  )
  m.setU32((pQuestState + 0x08) >>> 0, UNITS_GetRoom113c(m, m.u32((pOpStrc + 0x04) >>> 0)))
  if (m.u8((pQuest + 0x09) >>> 0) !== 0 && m.u8((pQuest + 0x0c) >>> 0) !== 5) {
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 5)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c,
      0,
      0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c,
      0,
      0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32((pQuest + 0x04) >>> 0),
      ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c,
      0,
      0,
    )
  }
  return 0
}

/**
 * [16/30] C2S `0x21` (`STACK_ITEMS`) packet handler: validates two inventory/cursor items and merges stackable quantities.
 *
 * @dll D2Game.dll
 * @va 0x6FCEE4B0
 * @ordinalOrName D2Game_6FCEE4B0
 */
export function C2S_Packet21_MergeStackableItems_6FCEE4B0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEE4B0)
  if ((nPacketSize >>> 0) !== 9) return 3
  const dwTargetItemGuid = m.u32((pPacket + 5) >>> 0) >>> 0
  const dwSourceItemGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  let rc = C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(m, pGame, dwSourceItemGuid, pPlayer) | 0
  if (rc !== 0) return rc
  rc = C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(m, pGame, dwTargetItemGuid, pPlayer) | 0
  if (rc !== 0) return rc
  if (dwSourceItemGuid === dwTargetItemGuid) return 3
  const sp = allocW8B3Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    const merged = ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c(
      m,
      dwSourceItemGuid,
      dwTargetItemGuid,
      pGame,
      pPlayer,
      sp,
    )
    if (merged !== 0) return 0
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * [17/30] Unequips an item from a hireling body location (`1..10`) onto the owning player's cursor.
 *
 * @dll D2Game.dll
 * @va 0x6FCEECE0
 * @ordinalOrName D2Game_6FCEECE0
 */
export function ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c(
  m: SparseMemory113c,
  nBodyLoc: number,
  pMercUnit: number,
  pGame: number,
  pPlayerUnit: number,
): number {
  hitD2GameVa113c(0x6FCEECE0)
  const pPlayerInv = m.u32((pPlayerUnit + 0x60) >>> 0) >>> 0
  if (m.u32((pGame + 0x70) >>> 0) === 0) return 3
  const pMercInv = m.u32((pMercUnit + 0x60) >>> 0) >>> 0
  if (pMercInv === 0) return 3
  if ((nBodyLoc | 0) <= 0 || (nBodyLoc | 0) >= 0x0b) return 3
  const pItem = INVENTORY_GetItemFromBodyLocMemPort113c(m, pMercInv, nBodyLoc) >>> 0
  if (pItem === 0) return 2
  if (m.u32((pItem + 0x10) >>> 0) !== 1) return 2
  if ((INVENTORY_RemoveItemFromInventory113c(m, m.u32((pMercUnit + 0x60) >>> 0), pItem) >>> 0) !== pItem) {
    return 2
  }
  INVENTORY_NoOpRet8B113c(m, m.u32((pMercUnit + 0x60) >>> 0), nBodyLoc)
  ITEMS_DeactivateEquippedItemStats113c(m, pMercUnit, pItem, pGame, 0, 0)
  ITEMS_SetItemFlag113c(m, pItem, 0x10, 1)
  INVENTORY_AppendItemGuidNode113c(m, m.u32((pMercUnit + 0x60) >>> 0), pItem)
  UNITS_SetUnitUpdateFlags113c(m, pMercUnit, 1)
  const pClonedItem = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, pGame, pItem, 1) >>> 0
  INVENTORY_SetCursorItem113c(m, pPlayerInv, pClonedItem)
  ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(m, pPlayerUnit, pClonedItem)
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x20, 1)
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pMercUnit, 0)
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c(m, pMercUnit)
  return 0
}

/**
 * [18/30] C2S `0x1A` (`EQUIP_ITEM`) packet handler: validates cursor item and equips into body location (`1..10`).
 *
 * @dll D2Game.dll
 * @va 0x6FCEEE60
 * @ordinalOrName D2Game_6FCEEE60
 */
export function C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEEE60)
  if ((nPacketSize >>> 0) !== 9) return 3
  const nBodyLoc = m.u8((pPacket + 5) >>> 0)
  const dwItemGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  const rc = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame, dwItemGuid, pPlayer) | 0
  if (rc !== 0) return rc
  if (nBodyLoc <= 0 || nBodyLoc >= 0x0b) return 2
  const sp = allocW8B3Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    const equipped = ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c(
      m,
      dwItemGuid,
      pPlayer,
      pGame,
      nBodyLoc,
      0,
      sp,
    )
    if (equipped !== 0) return 0
    if (m.u32(sp) === 0) return 0
    if (pGame === 0) throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
    const nBucket = dwItemGuid & 0x7f
    let pNode = m.u32((pGame + nBucket * 4 + 0x1720) >>> 0) >>> 0
    while (pNode !== 0) {
      if ((m.u32((pNode + 0x0c) >>> 0) >>> 0) === dwItemGuid) break
      pNode = m.u32((pNode + 0xe4) >>> 0) >>> 0
    }
    return 3
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * [19/30] C2S `0x60` (`SWAP_WEAPONS`) packet handler: swaps active and alternate weapon sets for a living idle player.
 *
 * @dll D2Game.dll
 * @va 0x6FCEF510
 * @ordinalOrName D2Game_6FCEF510
 */
export function C2S_Packet60_SwapWeapons_6FCEF510_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  _pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEF510)
  if ((nPacketSize >>> 0) !== 1) return 3
  if (m.u32((pGame + 0x70) >>> 0) === 0) return 3
  if (SKILLS_GetUsedSkill113c(m, pPlayer) !== 0) return 0
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return 0
  const sp = allocW8B3Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    const swapped = ITEMS_SwapMainAndAlternateWeapons_6FCF8EA0_113c(m, pPlayer, pGame, sp)
    if (swapped !== 0) return 0
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * [20/30] C2S `0x26` (`USE_BELT_ITEM`) packet handler: validates belt item and consumes or applies it to player/hireling.
 *
 * @dll D2Game.dll
 * @va 0x6FCEF5B0
 * @ordinalOrName D2Game_6FCEF5B0
 */
export function C2S_Packet26_UseBeltItem_6FCEF5B0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEF5B0)
  if ((nPacketSize >>> 0) !== 0x0d) return 3
  const dwItemGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  const bShiftToMerc = m.u32((pPacket + 5) >>> 0) | 0
  const nUnitType = m.u32(pPlayer >>> 0) | 0
  const pPath = m.u32((pPlayer + 0x2c) >>> 0) >>> 0
  let nPosX = 0
  if (nUnitType === 2 || (nUnitType > 3 && nUnitType <= 5)) {
    nPosX = m.u32((pPath + 0x0c) >>> 0) | 0
  } else if (pPath !== 0) {
    nPosX = PATH_GetPosX113c(m, pPath) | 0
  }
  const nUnitType2 = m.u32(pPlayer >>> 0) | 0
  const pPath2 = m.u32((pPlayer + 0x2c) >>> 0) >>> 0
  let nPosY = 0
  if (nUnitType2 === 2 || (nUnitType2 > 3 && nUnitType2 <= 5)) {
    nPosY = m.u32((pPath2 + 0x10) >>> 0) | 0
  } else if (pPath2 !== 0) {
    nPosY = PATH_GetPosY113c(m, pPath2) | 0
  }
  let rc = C2S_ValidateBeltItemOwnership_6FCECDB0_113c(m, pGame, dwItemGuid, pPlayer) | 0
  if (rc !== 0) return rc
  rc = C2S_CheckCoordDeltaExceeded113c(m, pPlayer, nPosX, nPosY, 0x32) | 0
  if (rc !== 0) return rc
  const sp = allocW8B3Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    const used = ITEMS_UseBeltConsumableOrScroll_6FCF8BA0_113c(
      m,
      sp,
      dwItemGuid,
      pGame,
      pPlayer,
      nPosX,
      nPosY,
      bShiftToMerc,
    )
    if (used !== 0) return 0
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF6B0
 * @ordinalOrName D2Game_6FCEF6B0
 */
export function C2S_Packet27_IdentifyItem_6FCEF6B0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEF6B0)
  if ((nPacketSize | 0) !== 9) {
    return 3
  }
  const dwTargetItemGuid = m.u32(pPacket + 1)
  const dwScrollItemGuid = m.u32(pPacket + 5)
  let rc = C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(
    m,
    pGame,
    dwTargetItemGuid,
    pPlayer,
  )
  if (rc !== 0) {
    return rc
  }
  rc = C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(
    m,
    pGame,
    dwScrollItemGuid,
    pPlayer,
  )
  if (rc !== 0) {
    return rc
  }
  const sp = allocW8B3Stack(m, 16)
  try {
    m.setU32(sp, 0)
    const ok = ITEMS_IdentifyItemFromScrollOrTome_6FCF9FB0_113c(
      m,
      dwScrollItemGuid,
      pPlayer,
      dwTargetItemGuid,
      pGame,
      sp,
    )
    if (ok !== 0) {
      return 0
    }
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF730
 * @ordinalOrName D2Game_6FCEF730
 */
export function C2S_Packet20_UseInventoryItem_6FCEF730_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEF730)
  if ((nPacketSize | 0) !== 0x0d) {
    return 3
  }
  const dwItemGuid = m.u32(pPacket + 1)
  const nPosX = m.u32(pPacket + 5)
  const nPosY = m.u32(pPacket + 9)
  let rc = C2S_ValidateStoredItem_6FCECF00_113c(m, pGame, dwItemGuid, pPlayer)
  if (rc !== 0) {
    return rc
  }
  rc = C2S_CheckCoordDeltaExceeded113c(m, pPlayer, nPosX, nPosY, 0x32)
  if (rc !== 0) {
    return rc
  }
  const sp = allocW8B3Stack(m, 16)
  try {
    m.setU32(sp, 0)
    const ok = ITEMS_UseStoredConsumableOrBook_6FCF9BF0_113c(
      m,
      dwItemGuid,
      pGame,
      pPlayer,
      nPosX,
      nPosY,
      sp,
    )
    if (ok !== 0 || m.u32(sp) === 0) {
      return 0
    }
    if (pGame === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
    }
    let pCur = m.u32(pGame + (dwItemGuid & 0x7f) * 4 + 0x1720)
    while (pCur !== 0 && m.u32(pCur + 0x0c) !== dwItemGuid) {
      pCur = m.u32(pCur + 0xe4)
    }
    return 3
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEFBC0
 * @ordinalOrName D2Game_6FCEFBC0
 */
export function ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c(
  m: SparseMemory113c,
  pGame: number,
  pMercUnit: number,
  pPlayerUnit: number,
  pCursorItem: number,
): number {
  hitD2GameVa113c(0x6FCEFBC0)
  if (m.u32(pGame + 0x70) === 0) {
    return 3
  }
  const pPlayerInv = m.u32(pPlayerUnit + 0x60)
  if (pPlayerInv === 0) {
    return 0
  }
  if (m.u32(pMercUnit + 0x60) === 0) {
    INVENTORY_AllocInventory113c(m, 0, pMercUnit)
  }
  const pMercInv = m.u32(pMercUnit + 0x60)
  if (pMercInv === 0) {
    return 0
  }
  const sp = allocW8B3Stack(m, 16)
  try {
    ITEMS_GetAllowedBodyLocations113c(m, pCursorItem, sp, (sp + 4) >>> 0)
    const nLoc1 = m.u8(sp)
    const nLoc2 = m.u8(sp + 4)
    const pOldItem1 = INVENTORY_GetItemFromBodyLocMemPort113c(m, pMercInv, nLoc1)
    const pOldItem2 = INVENTORY_GetItemFromBodyLocMemPort113c(m, pMercInv, nLoc2)
    let pOldItem = pOldItem1
    let nTargetBodyLoc = nLoc1
    if (
      m.u32(pMercUnit + 4) === 0x167 &&
      ITEMS_CheckItemTypeId113c(m, pCursorItem, 2) !== 0
    ) {
      pOldItem = pOldItem2
      nTargetBodyLoc = nLoc2
    }
    if (pOldItem !== 0) {
      if (INVENTORY_RemoveItemFromInventory113c(m, pMercInv, pOldItem) !== pOldItem) {
        return 0
      }
      INVENTORY_NoOpRet8B113c(m, pMercInv, nTargetBodyLoc)
      ITEMS_DeactivateEquippedItemStats113c(m, pMercUnit, pOldItem, pGame, 0, 0)
      D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pMercUnit, 0)
      if (ITEMS_CheckRequirements113c(m, pCursorItem, pMercUnit, 0, 0, 0, 0) === 0) {
        INVENTORY_PlaceItemInBodyLoc113c(m, pMercInv, pOldItem, nTargetBodyLoc)
        INVENTORY_PlaceItemInSocket113c(m, pMercInv, pOldItem, 3)
        ITEMS_SetBodyLocation113c(m, pOldItem, nTargetBodyLoc)
        UNITS_ChangeAnimMode113c(m, pOldItem, 1)
        ITEMS_SetInvPage113c(m, pOldItem, 0xff)
        ITEMS_ActivateEquippedItemStats113c(m, pMercUnit, pOldItem, 0)
        return 0
      }
      ITEMS_SetItemFlag113c(m, pOldItem, 0x10, 1)
      INVENTORY_AppendItemGuidNode113c(m, pMercInv, pOldItem)
      ITEMS_SetOrClearCommandFlags113c(m, pOldItem, 0x20, 1)
      UNITS_SetUnitUpdateFlags113c(m, pMercUnit, 1)
    }
    const pClonedCursor = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(
      m,
      pGame,
      pCursorItem,
      1,
    )
    UNITS_ChangeAnimMode113c(m, pClonedCursor, 4)
    let pEv = m.u32(pMercUnit + 0xdc)
    while (pEv !== 0) {
      const pNext = m.u32(pEv + 0x24)
      if (m.u8(pEv) === 9) {
        EVENT_FreeNode113c(m, pGame, pEv)
      }
      pEv = pNext
    }
    const dwClonedGuid =
      pClonedCursor === 0 ? 0xffffffff : m.u32(pClonedCursor + 0x0c)
    ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c(
      m,
      dwClonedGuid,
      pMercUnit,
      pGame,
      nTargetBodyLoc,
      1,
      (sp + 8) >>> 0,
    )
    ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(
      m,
      pPlayerUnit,
      pCursorItem,
      pGame,
    )
    INVENTORY_SetCursorItem113c(m, pPlayerInv, 0)
    if (pOldItem !== 0) {
      const pClonedOld = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(
        m,
        pGame,
        pOldItem,
        1,
      )
      INVENTORY_SetCursorItem113c(m, pPlayerInv, pClonedOld)
      ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(m, pPlayerUnit, pClonedOld)
    }
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pMercUnit, 0)
    pEv = m.u32(pMercUnit + 0xdc)
    while (pEv !== 0) {
      const pNext = m.u32(pEv + 0x24)
      if (m.u8(pEv) === 3) {
        EVENT_FreeNode113c(m, pGame, pEv)
      }
      pEv = pNext
    }
    EVENT_SetEventFull113c(
      m,
      pGame,
      pMercUnit,
      3,
      (m.u32(pGame + 0xa8) + 1) >>> 0,
      0,
      0,
      0,
    )
    return 1
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF1140
 * @ordinalOrName D2Game_6FCF1140
 */
export function C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCF1140)
  if ((nPacketSize | 0) !== 9) {
    return 3
  }
  const nBodyLoc = m.u8(pPacket + 5)
  const dwItemGuid = m.u32(pPacket + 1)
  const rc = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame, dwItemGuid, pPlayer)
  if (rc !== 0) {
    return rc
  }
  if (nBodyLoc <= 0 || nBodyLoc >= 0x0b) {
    return 2
  }
  if (nBodyLoc !== 4 && nBodyLoc !== 5) {
    return 3
  }
  const pEquipped = INVENTORY_GetItemFromBodyLocMemPort113c(
    m,
    m.u32(pPlayer + 0x60),
    nBodyLoc,
  )
  if (pEquipped === 0) {
    return 1
  }
  if (
    PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(
      m,
      pPlayer,
      pGame,
      pEquipped,
    ) === 0
  ) {
    return 0
  }
  const sp = allocW8B3Stack(m, 16)
  try {
    m.setU32(sp, 0)
    const ok = ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c(
      m,
      dwItemGuid,
      pGame,
      pPlayer,
      nBodyLoc,
      sp,
    )
    if (ok !== 0) {
      return 0
    }
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF1370
 * @ordinalOrName D2Game_6FCF1370
 */
export function C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCF1370)
  if ((nPacketSize | 0) !== 5) {
    return 3
  }
  const dwItemGuid = m.u32(pPacket + 1)
  const rc = C2S_ValidateStoredItem_6FCECF00_113c(m, pGame, dwItemGuid, pPlayer)
  if (rc !== 0) {
    return rc
  }
  if (INVENTORY_GetCursorItem113c(m, m.u32(pPlayer + 0x60)) !== 0) {
    NET_SendEventMessage5A_Type0E_113c(m, pPlayer)
    return 2
  }
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
  }
  let pItem = m.u32(pGame + (dwItemGuid & 0x7f) * 4 + 0x1720)
  while (pItem !== 0 && m.u32(pItem + 0x0c) !== dwItemGuid) {
    pItem = m.u32(pItem + 0xe4)
  }
  if (pItem === 0) {
    return 2
  }
  if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) === 1) {
    return 3
  }
  if (
    PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(
      m,
      pPlayer,
      pGame,
      pItem,
    ) === 0
  ) {
    return 0
  }
  const sp = allocW8B3Stack(m, 16)
  try {
    m.setU32(sp, 0)
    const ok = ITEMS_RemoveItemFromInventoryGridOrCursor_6FCF62E0_113c(
      m,
      0,
      pPlayer,
      pGame,
      dwItemGuid,
      sp,
      1,
      0,
      0,
    )
    if (ok !== 0) {
      return 0
    }
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF4360
 * @ordinalOrName D2Game_6FCF4360
 */
export function ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FCF4360)
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x660)
  }
  if (ITEMS_CheckItemTypeId113c(m, pItem, 0x16) !== 0) {
    return ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c(
      m,
      pItem,
      pGame,
      pUnit,
    )
  }
  if (ITEMS_CheckItemTypeId113c(m, pItem, 0x12) !== 0) {
    return ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c(
      m,
      pGame,
      pUnit,
      pItem,
    )
  }
  if (
    ITEMS_GetTwoHandedFlag113c(m, pItem) !== 0 &&
    ITEMS_IsAutoStack113c(m, pItem) !== 0
  ) {
    return ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c(
      m,
      pGame,
      pUnit,
      pItem,
    )
  }
  return 0
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF5080
 * @ordinalOrName D2Game_6FCF5080
 */
export function ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c(
  m: SparseMemory113c,
  pSourceItem: number,
  pGame: number,
  pOwnerUnit: number,
  pDestItem: number,
  bSyncClient: number,
): number {
  hitD2GameVa113c(0x6FCF5080)
  if (ITEMS_GetSubTypeFromItem113c(m, pSourceItem) === 0) {
    return 1
  }
  const pSrcInv = m.u32(pSourceItem + 0x60)
  if (pSrcInv === 0) {
    return 0
  }
  let pNode = INVENTORY_GetFirstItem113c(m, pSrcInv)
  if (pNode === 0) {
    return 1
  }
  const sp = allocW8B3Stack(m, 16)
  try {
    while (pNode !== 0) {
      const pSubItem = INVENTORY_UnitIsItem113c(m, pNode)
      const pClonedSub = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(
        m,
        pGame,
        pSubItem,
        1,
      )
      UNITS_ChangeAnimMode113c(m, pClonedSub, 4)
      const nTypeX = m.u32(pSubItem) | 0
      const pPathX = m.u32(pSubItem + 0x2c)
      let posX = 0
      if (nTypeX === 2 || (nTypeX > 3 && nTypeX <= 5)) {
        posX = m.u32(pPathX + 0x0c)
      } else if (pPathX !== 0) {
        posX = PATH_GetPosX113c(m, pPathX)
      }
      UNITS_SetStaticPathPosX113c(m, pClonedSub, posX)
      const nTypeY = m.u32(pSubItem) | 0
      const pPathY = m.u32(pSubItem + 0x2c)
      let posY = 0
      if (nTypeY === 2 || (nTypeY > 3 && nTypeY <= 5)) {
        posY = m.u32(pPathY + 0x10)
      } else if (pPathY !== 0) {
        posY = PATH_GetPosY113c(m, pPathY)
      }
      UNITS_SetStaticPathPosY113c(m, pClonedSub, posY)
      const dwDestGuid =
        pDestItem === 0 ? 0xffffffff : m.u32(pDestItem + 0x0c)
      const dwFillerGuid =
        pClonedSub === 0 ? 0xffffffff : m.u32(pClonedSub + 0x0c)
      const ok = ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(
        m,
        dwFillerGuid,
        pGame,
        pOwnerUnit,
        dwDestGuid,
        sp,
        bSyncClient,
        0,
        1,
        0,
      )
      if (ok === 0) {
        return 0
      }
      pNode = INVENTORY_GetNextItem113c(m, pNode)
    }
    return 1
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF6760
 * @ordinalOrName D2Game_6FCF6760
 */
export function ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c(
  m: SparseMemory113c,
  pCorpseUnit: number,
  pGame: number,
  pPlayerUnit: number,
): number {
  hitD2GameVa113c(0x6FCF6760)
  if (pPlayerUnit === 0 || pCorpseUnit === 0) {
    return 0
  }
  const pCorpseInv = m.u32(pCorpseUnit + 0x60)
  const pPlayerInv = m.u32(pPlayerUnit + 0x60)
  if (pPlayerInv === 0 || pCorpseInv === 0) {
    return 0
  }
  const sp = allocW8B3Stack(m, 32)
  const pInOutBodyLoc = sp
  const ppPrimaryItem = (sp + 4) >>> 0
  const ppSecondaryItem = (sp + 8) >>> 0
  try {
    let nRemainingOnCorpse = 0
    let bMovedAnyInPass = 0
    do {
      nRemainingOnCorpse = 0
      bMovedAnyInPass = 0
      for (let nBodyLoc = 1; nBodyLoc < 0x0d; nBodyLoc++) {
        m.setU32(pInOutBodyLoc, nBodyLoc)
        const pCorpseItem = INVENTORY_GetItemFromBodyLocMemPort113c(
          m,
          pCorpseInv,
          nBodyLoc,
        )
        if (pCorpseItem === 0) {
          continue
        }
        nRemainingOnCorpse++
        if (
          ITEMS_CheckRequirements113c(
            m,
            pCorpseItem,
            pPlayerUnit,
            0,
            0,
            0,
            0,
          ) === 0
        ) {
          continue
        }
        const pExisting1 = INVENTORY_GetItemFromBodyLocMemPort113c(
          m,
          pPlayerInv,
          nBodyLoc,
        )
        m.setU32(ppPrimaryItem, pExisting1)
        const nOppLoc = ITEMS_GetOppositeHandOrRingBodyLoc113c(m, nBodyLoc)
        const pExisting2 =
          nOppLoc === 0
            ? pExisting1
            : INVENTORY_GetItemFromBodyLocMemPort113c(m, pPlayerInv, nOppLoc)
        m.setU32(ppSecondaryItem, pExisting2)
        let bTransferred = 0
        if (
          ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c(
            m,
            pInOutBodyLoc,
            pCorpseItem,
            ppSecondaryItem,
            pPlayerUnit,
            ppPrimaryItem,
          ) !== 0
        ) {
          const nEquipLoc = m.u32(pInOutBodyLoc)
          if (
            INVENTORY_GetItemFromBodyLocMemPort113c(m, pPlayerInv, nEquipLoc) !==
            0
          ) {
            throw new D2CommonAssertError('0x6fd19ff9', 0x1776)
          }
          if (
            INVENTORY_PlaceItemInBodyLoc113c(
              m,
              pPlayerInv,
              pCorpseItem,
              nEquipLoc,
            ) !== 0
          ) {
            const nSocketType =
              nEquipLoc === 0x0b || nEquipLoc === 0x0c ? 4 : 3
            if (
              INVENTORY_PlaceItemInSocket113c(
                m,
                pPlayerInv,
                pCorpseItem,
                nSocketType,
              ) !== 0
            ) {
              INVENTORY_SetCursorItem113c(m, pPlayerInv, 0)
              ITEMS_SetBodyLocation113c(m, pCorpseItem, nEquipLoc)
              m.setU32(
                pCorpseItem + 0xc4,
                (m.u32(pCorpseItem + 0xc4) & 0xfffffffd) >>> 0,
              )
              UNITS_ChangeAnimMode113c(m, pCorpseItem, 1)
              ITEMS_SetItemFlag113c(m, pCorpseItem, 8, 1)
              INVENTORY_AppendItemGuidNode113c(m, pPlayerInv, pCorpseItem)
              UNITS_SetUnitUpdateFlags113c(m, pPlayerUnit, 1)
              m.setU32(
                pCorpseItem + 0xc4,
                (m.u32(pCorpseItem + 0xc4) & 0xfdffffff) >>> 0,
              )
              ITEMS_SetInvPage113c(m, pCorpseItem, 0xff)
              if (nSocketType === 3) {
                INVENTORY_UpdateWeaponGuidOnInsert113c(
                  m,
                  pPlayerInv,
                  pCorpseItem,
                )
                ITEMS_ActivateEquippedItemStats113c(
                  m,
                  pPlayerUnit,
                  pCorpseItem,
                  0,
                )
                ITEMS_OnEquipScrollOrTome113c(m, pCorpseItem, pPlayerUnit)
                ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(
                  m,
                  pPlayerUnit,
                )
              }
              QUESTS_TriggerItemDropped_6FC545A0_113c(
                m,
                pGame,
                pCorpseItem,
                pPlayerUnit,
              )
              bTransferred = 1
            } else {
              INVENTORY_NoOpRet8B113c(m, pPlayerInv, nEquipLoc)
            }
          }
        } else if (
          ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c(
            m,
            pCorpseItem,
            pPlayerUnit,
            pGame,
            0,
            0,
            0x6fd1b14c,
            0x176c,
          ) !== 0
        ) {
          bTransferred = 1
        }
        if (bTransferred !== 0) {
          ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(m, pGame, pCorpseItem)
          ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(m, pGame, pCorpseItem)
          ITEMS_SetOrClearCommandFlags113c(m, pCorpseItem, 1, 1)
          INVENTORY_RemoveItemFromInventory113c(m, pCorpseInv, pCorpseItem)
          INVENTORY_NoOpRet8B113c(m, pCorpseInv, nBodyLoc)
          nRemainingOnCorpse--
          bMovedAnyInPass = 1
        }
      }
    } while (nRemainingOnCorpse !== 0 && bMovedAnyInPass !== 0)
    let bSecondBeltPass = 0
    let nItemsTransferredInPass = 0
    let bAllTransferred = 1
    let pNode = INVENTORY_GetFirstItem113c(m, pCorpseInv)
    while (pNode !== 0) {
      while (pNode !== 0) {
        const pNextNode = INVENTORY_GetNextItem113c(m, pNode)
        const pItem = INVENTORY_UnitIsItem113c(m, pNode)
        if (
          ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c(
            m,
            pPlayerUnit,
            pGame,
            pItem,
          ) === 0
        ) {
          bAllTransferred = 0
        } else if (
          ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c(
            m,
            pItem,
            pPlayerUnit,
            0,
            pGame,
          ) !== 0
        ) {
          nItemsTransferredInPass++
          ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1)
        } else if (
          ITEMS_IsBeltable113c(m, pItem) !== 0 &&
          INVENTORY_AutoPlaceItemInBelt113c(m, pPlayerInv, pItem) !== 0
        ) {
          if (INVENTORY_PlaceItemInSocket113c(m, pPlayerInv, pItem, 2) !== 0) {
            INVENTORY_SetCursorItem113c(m, pPlayerInv, 0)
            if (pItem === 0) {
              throw new D2CommonAssertError('0x6fd19ff9', 0x24f)
            }
            if (m.u32(pPlayerUnit) === 0) {
              ITEMS_UpdateScrollOrTomeSkillCharges113c(m, pItem, pPlayerUnit, 1)
            }
            m.setU32(pItem + 0xc4, (m.u32(pItem + 0xc4) & 0xfffffffd) >>> 0)
            if (ITEMS_CanUseCharmInInventory113c(m, pItem, pPlayerUnit) !== 0) {
              ITEMS_ActivateEquippedItemStats113c(m, pPlayerUnit, pItem, 0)
            }
            UNITS_ChangeAnimMode113c(m, pItem, 2)
            m.setU32(pItem + 0xc4, (m.u32(pItem + 0xc4) & 0xfdffffff) >>> 0)
            ITEMS_SetItemFlag113c(m, pItem, 0x2000, 1)
            ITEMS_SetInvPage113c(m, pItem, 0xff)
            INVENTORY_AppendItemGuidNode113c(m, pPlayerInv, pItem)
            UNITS_SetUnitUpdateFlags113c(m, pPlayerUnit, 1)
            nItemsTransferredInPass++
            ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1)
          }
        } else if (bSecondBeltPass !== 0) {
          if (
            ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c(
              m,
              pItem,
              pPlayerUnit,
              pGame,
              0,
              0,
              0x6fd1b14c,
              0x17f2,
            ) !== 0
          ) {
            nItemsTransferredInPass++
            ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1)
          } else {
            bAllTransferred = 0
          }
        }
        pNode = pNextNode
      }
      if (nItemsTransferredInPass === 0) {
        if (bSecondBeltPass !== 0) {
          break
        }
        bSecondBeltPass = 1
      }
      nItemsTransferredInPass = 0
      bAllTransferred = 1
      pNode = INVENTORY_GetFirstItem113c(m, pCorpseInv)
    }
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(
      m,
      pGame,
      pPlayerUnit,
      0,
    )
    return bAllTransferred
  } finally {
    freeW8B3Stack(sp)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCFA350
 * @ordinalOrName D2Game_6FCFA350
 */
export function ITEMS_ProcessReplenishStatTick_6FCFA350_113c(
  m: SparseMemory113c,
  nReplenishStatId: number,
  nCurrentValStatId: number,
  pGame: number,
  pItem: number,
  nMaxVal: number,
): number {
  hitD2GameVa113c(0x6FCFA350)
  const nReplenishRate =
    STATLIST_GetUnitStat113c(m, pItem, nReplenishStatId, 0) | 0
  if (nReplenishRate === 0) {
    return 0
  }
  const nCurVal = STATLIST_GetUnitStat113c(m, pItem, nCurrentValStatId, 0) | 0
  const nNewVal = (nCurVal + 1) | 0
  if (nNewVal <= (nMaxVal | 0)) {
    STATLIST_SetUnitStat113c(m, pItem, nCurrentValStatId, nNewVal, 0)
    const dwOwnerGuid = ITEMS_GetCellOverwrite113c(m, pItem) >>> 0
    if (dwOwnerGuid !== 0xffffffff) {
      if (pGame === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
      }
      let pOwnerUnit = m.u32(pGame + (dwOwnerGuid & 0x7f) * 4 + 0x1120)
      while (pOwnerUnit !== 0 && m.u32(pOwnerUnit + 0x0c) !== dwOwnerGuid) {
        pOwnerUnit = m.u32(pOwnerUnit + 0xe4)
      }
      if (pOwnerUnit !== 0 && m.u32(pOwnerUnit) === 0) {
        const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit)
        const pClient = m.u32(pPlayerData + 0x9c)
        if (pClient !== 0) {
          NET_SendPacket0x3E_ItemStatBitStream113c(
            m,
            pItem,
            0,
            pClient,
            1,
            nCurrentValStatId,
            nNewVal,
          )
          if (
            nNewVal >= 1 &&
            ITEMS_CheckCommandFlags113c(
              m,
              pItem,
              0x100,
              0x1587,
              0x6fd1b14c,
            ) !== 0
          ) {
            ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c(
              m,
              pOwnerUnit,
              pItem,
              pGame,
            )
          }
        }
      }
    }
    let nDelay = (Math.trunc(0x9c4 / nReplenishRate) + 1) | 0
    if (nDelay < 0x7d) {
      nDelay = 0x7d
    }
    EVENT_SetEventFull113c(
      m,
      pGame,
      pItem,
      3,
      (m.u32(pGame + 0xa8) + nDelay) >>> 0,
      0,
      0,
      0,
    )
  }
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FD07080
 * @ordinalOrName D2Game_6FD07080
 */
export function ACT3Q7_Callback00_NpcActivate_6FD07080_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD07080)
  const wMessageIndex = m.u16(pQuestArg + 0x14)
  const wScrollIndex = m.u16(pQuestArg + 0x18)
  const pGame = m.u32(pQuestArg)
  const pPlayerData = UNITS_GetPlayerData113c(m, m.u32(pQuestArg + 0x0c))
  const pQuestRecord = m.u32(pPlayerData + m.u8(pGame + 0x6d) * 4 + 0x10)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x16, 0x0b) === 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x16, 0) !== 0) {
      return
    }
  }
  if (wMessageIndex === 0xff && wScrollIndex === 0x274) {
    const isComplete = QUESTS_CheckGlobalQuestState_6FC538D0_113c(
      m,
      m.u32(pQuestArg),
      0x11,
      0x0d,
    )
    const nNewState = isComplete === 1 ? 2 : 3
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(
      m,
      pQuestData,
      nNewState,
    )
    const pState = m.u32(pQuestData + 0x18)
    m.setU8(pState + 3, 1)
  } else {
    if (
      wScrollIndex !== 0x292 &&
      wScrollIndex !== 0x291 &&
      wScrollIndex !== 0x293 &&
      wScrollIndex !== 0x294 &&
      wScrollIndex !== 0x295 &&
      wScrollIndex !== 0x296 &&
      wScrollIndex !== 0x297
    ) {
      return
    }
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x16, 0x0b) !== 0) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x16, 0x0d) !== 0) {
        m.setU8(pQuestData + 0x14, 0)
        m.setU8(pQuestData + 0x0b, 0x0d)
        m.setU8(pQuestData + 0x0c, 7)
        if (m.u32(0x6fd31c20) !== 0) {
          const sp = allocW8B3Stack(m, 128)
          try {
            const msg = 'changing state to 7\n'
            for (let i = 0; i < msg.length; i++) {
              m.setU8((sp + i) >>> 0, msg.charCodeAt(i))
            }
            m.setU8((sp + msg.length) >>> 0, 0)
            NET_BroadcastSystemChatMessage_6FCEBE70_113c(
              m,
              sp,
              m.u32(pQuestData + 4),
              4,
            )
          } finally {
            freeW8B3Stack(sp)
          }
        }
      }
      QUESTRECORD_ClearQuestState113c(m, pQuestRecord, 0x16, 0x0b)
      const pPlr = m.u32(pQuestArg + 0x0c)
      const dwPlrGuid = pPlr === 0 ? 0xffffffff : m.u32(pPlr + 0x0c)
      QUESTS_GuidListAdd113c(m, (pQuestData + 0x1c) >>> 0, dwPlrGuid)
    }
  }
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
    m,
    m.u32(pQuestArg + 8),
    m.u32(pQuestArg + 0x0c),
    m.u32(pQuestArg),
  )
}
