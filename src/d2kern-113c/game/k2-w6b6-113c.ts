/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 6 Batch 6 (w6b6).
 *
 * Clean-room 1:1 binary-isomorphic port of 45 D2Game.dll v1.13c functions in
 * the 0x6FCEEC70..0x6FD10390 address range.
 */

import { UNITS_GetPlayerData113c, UNITS_GetPlayerName113c } from '../common/composit'
import { DUNGEON_AddRoomPortalNode113c, DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_FindReagentForTome113c,
  INVENTORY_FindStackableCompatItemInBelt113c,
  INVENTORY_FindStackableCompatItemInGrid0_113c,
  INVENTORY_GetBeltAutoPlaceSlot113c,
  INVENTORY_GetCorpseUnitId113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstCorpse113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemCount113c,
  INVENTORY_GetItemDimensionsCallback113c,
  INVENTORY_GetNextCorpse113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_NoOpRet20113c,
  INVENTORY_NoOpRet8A113c,
  INVENTORY_PlaceItemInSocket113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UpdateEquippedGfxAndColor113c,
  UNITS_GetInventoryRecordId113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_ApplyRunewordProps113c,
  ITEMS_AreStackableWeaponsCompatible113c,
  ITEMS_AutoPlaceIntoBelt113c,
  ITEMS_CanBeEquipped113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckIfSocketFiller113c,
  ITEMS_CheckRequirements113c,
  ITEMS_FindMatchingRunesTxtRecord113c,
  ITEMS_GetAllowedBodyLocations113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetItemTypeQuiverFromItem113c,
  ITEMS_GetItemTypeShoots113c,
  ITEMS_GetItemTypeShootsFromItem113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_GetMaxSockets113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_GetTransactionCost113c,
  ITEMS_IsAutoStack113c,
  ITEMS_IsBeltable113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetNodePage113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOrClearFlagMask113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
} from '../common/path'
import {
  HIRELING_GetExpForLevel113c,
  PLAYER_StoreLeftSkill113c,
  PLAYER_StoreRightSkill113c,
  QUESTRECORD_SetQuestState113c,
  UNITS_GetLeftSkill113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record'
import {
  SKILLS_GetOwnerItemGuid113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillUseFailReason113c,
} from '../common/skills'
import {
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UpdateUnitByTimeStats113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetPlayerSubtargetLeft113c,
  UNITS_GetPlayerSubtargetRight113c,
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory'
import {
  DATATBLS_GetCurrentLevelFromExp113c,
  DATATBLS_GetMaxLevel113c,
  DATATBLS_GetStartExpForLevel113c,
} from '../tables/datatbls-113c'
import { DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c } from '../tables/monster-tbls-113c'
import {
  S2C_SendPacket9C_ItemActionWorld113c,
  SUNIT_DispatchItemEventCallbacks113c,
} from './a1c-post150-f786-f1040-113c'
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import { ITEMS_CheckNotBrokenOrUnequipping113c } from './replay-kernel-113c'
import {
  ITEMS_AreWeaponSlotTypesCompatible113c,
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c,
  NET_SendEventMessage5A_Type0E_113c,
} from './k2-combat-core-w1-113c'
import {
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_DeactivateEquippedItemStats113c,
  ITEMS_OnUnequipScrollOrTome113c,
  ITEMS_UpdateScrollOrTomeSkillCharges113c,
} from './k2-gap-itemdef-113c'
import {
  NET_SendPacket0x3E_ItemStatBitStream113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
} from './k2-gap-melee-dot-113c'
import {
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c'
import { OBJECTS_OperateContainer_6FC56B90_113c } from './k2-laneK-0x6fc5-w1-113c'
import {
  CLIENTS_GetClientByte08_6FC69BF0_113c,
  CLIENTS_GetClientField488_6FC69AB0_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import {
  ACT3Q0_MarkWandererSeenCallback113c,
  ACT3Q1_HratliIntroActiveFilter113c,
  ACT3Q1_HratliIntroStatusFilter113c,
  ACT3Q2_DarkWandererStatusFilter113c,
  ACT3Q5_SyncCouncilQuestFlagsCallback113c,
} from './k2-sunit-spawn-w1-113c'
import {
  ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
} from './k2-w2b1-113c'
import { NET_SendPacket42_ClearCursor_6FCAAF10_113c } from './k2-w2b3-113c'
import { ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c } from './k2-w2b4-113c'
import {
  ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c,
  ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c,
  ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c,
  ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c,
} from './k2-w2b8-113c'
import { ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c } from './k2-w3b1-113c'
import { QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c } from './k2-w3b3-113c'
import {
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c,
} from './k2-w3b7-113c'
import { MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c } from './k2-w4b2-113c'
import { ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c } from './k2-w4b3-113c'
import { NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c } from './k2-w4b4-113c'
import {
  NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c,
  PETS_FindPetArgByGuid_6FCB6570_113c,
} from './k2-w4b5-113c'
import { PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c } from './k2-w5b1-113c'
import { NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c } from './k2-w5b2-113c'
import { SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c } from './k2-w5b3-113c'
import {
  C2S_ValidateBeltItemOwnership_6FCECDB0_113c,
  C2S_ValidateCursorItem_6FCECF70_113c,
  C2S_ValidateStoredItem_6FCECF00_113c,
  HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c,
} from './k2-w5b6-113c'
import {
  ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c,
  ITEMS_CompactBeltColumnDown_6FCF2540_113c,
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c,
  ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c,
  ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c,
  ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c,
  ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c,
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c,
  ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c,
  ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c,
  ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c,
  ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c,
  ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c,
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c,
} from './k2-w5b7-113c'
import {
  ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c,
  ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c,
  ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c,
  ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
  ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c,
  ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
  ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c,
  ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
  ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
  ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c,
  ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c,
  ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c,
  ACT3_CainIntroActiveFilter_6FD055C0_113c,
  ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c,
} from './k2-w5b8-113c'
import {
  MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c,
  MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c,
  PARTY_SendRosterUpdateCallback_6FD0B070_113c,
  PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c,
  PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c,
  PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c,
  PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c,
  PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c,
  PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c,
  QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c,
} from './k2-w5b9-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import {
  MONSTER_SpawnAtCoords113c,
  SUNIT_AllocUnitData113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import {
  ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c,
  ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c,
} from './k2-real-itemdrop-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { EVENT_SetEventFull113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

export type { D2KernMemory113c }

let k2W6B6StackPtr = 0x7ef60000

function allocW6B6Stack(m: D2KernMemory113c, size: number): number {
  const aligned = (size + 15) & ~15
  const base = k2W6B6StackPtr >>> 0
  k2W6B6StackPtr = (base + aligned) >>> 0
  for (let i = 0; i < aligned; i += 4) {
    m.setU32((base + i) >>> 0, 0)
  }
  return base
}

function freeW6B6Stack(base: number): void {
  k2W6B6StackPtr = base >>> 0
}

/**
 * [1/45] C2S `0x23` (`ITEM_TO_BELT`) packet handler: validates cursor item and places into belt slot.
 *
 * @dll D2Game.dll
 * @va 0x6FCEEC70
 * @ordinalOrName D2Game_6FCEEC70
 */
export function C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEEC70)
  if ((nPacketSize >>> 0) !== 9) return 3
  const nBeltSlot = m.u32((pPacket + 5) >>> 0) | 0
  const dwItemGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  const rc = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame, dwItemGuid, pPlayer) | 0
  if (rc !== 0) return rc
  const sp = allocW6B6Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    const placed = ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c(m, dwItemGuid, pGame, pPlayer, nBeltSlot, 0, sp)
    if (placed !== 0) return 0
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    freeW6B6Stack(sp)
  }
}

/**
 * [2/45] C2S `0x25` (`SWAP_BELT_ITEM`) packet handler: validates cursor + belt items and swaps them.
 *
 * @dll D2Game.dll
 * @va 0x6FCEEDE0
 * @ordinalOrName D2Game_6FCEEDE0
 */
export function C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEEDE0)
  if ((nPacketSize >>> 0) !== 9) return 3
  const dwBeltItemGuid = m.u32((pPacket + 5) >>> 0) >>> 0
  const dwCursorItemGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  const rcCur = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame, dwCursorItemGuid, pPlayer) | 0
  if (rcCur !== 0) return rcCur
  const rcBelt = C2S_ValidateBeltItemOwnership_6FCECDB0_113c(m, pGame, dwBeltItemGuid, pPlayer) | 0
  if (rcBelt !== 0) return rcBelt
  const sp = allocW6B6Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    const swapped = ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c(
      m,
      pPlayer,
      pGame,
      dwCursorItemGuid,
      dwBeltItemGuid,
      sp,
    )
    if (swapped !== 0) return 0
    return m.u32(sp) !== 0 ? 3 : 0
  } finally {
    freeW6B6Stack(sp)
  }
}

/**
 * [3/45] C2S `0x63` (`SHIFT_ITEM_TO_BELT`) packet handler: moves an inventory grid item directly into belt.
 *
 * @dll D2Game.dll
 * @va 0x6FCF0950
 * @ordinalOrName D2Game_6FCF0950
 */
export function C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCF0950)
  if ((nPacketSize >>> 0) !== 5) return 3
  const dwItemGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  const rc = C2S_ValidateStoredItem_6FCECF00_113c(m, pGame, dwItemGuid, pPlayer) | 0
  if (rc !== 0) return rc
  if (INVENTORY_GetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0)) !== 0) {
    NET_SendEventMessage5A_Type0E_113c(m, pPlayer)
    return 2
  }
  if (pGame === 0) throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
  let pItem = m.u32((pGame + 0x1720 + ((dwItemGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== dwItemGuid) {
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) return 2
  if (ITEMS_IsBeltable113c(m, pItem) === 0) return 2
  if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) !== 0) return 3
  const sp = allocW6B6Stack(m, 0x20)
  try {
    const pOutSlot = sp
    const pOutWidth = (sp + 4) >>> 0
    const pOutHeight = (sp + 8) >>> 0
    m.setU32(pOutSlot, 0)
    if (INVENTORY_GetBeltAutoPlaceSlot113c(m, m.u32((pPlayer + 0x60) >>> 0), pItem, pOutSlot) === 0) return 0
    if ((m.u32(pOutSlot) | 0) < 0) return 0
    if (PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(m, pPlayer, pGame, pItem) === 0) return 0
    const pInventory = m.u32((pPlayer + 0x60) >>> 0) >>> 0
    if (pInventory === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x1778)
    if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) !== 0) return 2
    if (m.u32((pItem + 0x10) >>> 0) !== 0) return 2
    const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInventory, pItem) >>> 0
    if (pRemoved === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x1781)
    if (pRemoved !== pItem) throw new D2CommonAssertError('ItemMode.cpp', 0x1782)
    const bInvPage = ITEMS_GetInvPage113c(m, pItem) & 0xff
    const nInvRecordId = UNITS_GetInventoryRecordId113c(m, pPlayer, bInvPage, m.u32((pGame + 0x70) >>> 0) | 0)
    const nPosY = UNIT_GetPosY113c(m, pItem)
    const nPosX = UNIT_GetPosX113c(m, pItem)
    INVENTORY_NoOpRet20113c(m, 0x6fd1b188, 0x1787, pInventory, nPosX, nPosY, nInvRecordId, 0, bInvPage)
    ITEMS_SetNodePage113c(m, pItem, bInvPage)
    ITEMS_SetInvPage113c(m, pItem, 0xff)
    const pClient0 =
      m.u32(pPlayer >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0) >>> 0) : 0
    NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(m, pItem, pPlayer, pClient0, 0)
    UNITS_ChangeAnimMode113c(m, pItem, 4)
    m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0)
    INVENTORY_GetItemDimensionsCallback113c(m, pItem, pOutWidth, pOutHeight, 0x6fd1b188, 0x1792)
    if (ITEMS_AutoPlaceIntoBelt113c(m, pInventory, pItem, m.u32(pOutSlot) | 0) !== 0) {
      ITEMS_SetInvPage113c(m, pItem, 0xff)
      if (INVENTORY_PlaceItemInSocket113c(m, pInventory, pItem, 2) !== 0) {
        UNITS_ChangeAnimMode113c(m, pItem, 2)
        const pClient1 =
          m.u32(pPlayer >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0) >>> 0) : 0
        ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c(m, pPlayer, pClient1, pItem, 0)
      }
    }
    UNITS_SetUnitUpdateFlags113c(m, pPlayer, 1)
    return 0
  } finally {
    freeW6B6Stack(sp)
  }
}

/**
 * [4/45] Finds an empty, weapon-slot-compatible body location (`*pOutBodyLoc`) for auto-equipping `pItem` on `pUnit`.
 *
 * @dll D2Game.dll
 * @va 0x6FCF2610
 * @ordinalOrName D2Game_6FCF2610
 */
export function ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  pOutBodyLoc: number,
  bSkipRequirements: number,
): number {
  hitD2GameVa113c(0x6FCF2610)
  if (pUnit === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x6dd)
  if (pItem === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x6de)
  if (bSkipRequirements !== 0) {
    if (ITEMS_CanBeEquipped113c(m, pItem) === 0) return 0
    if (ITEMS_CheckCommandFlags113c(m, pItem, 0x10, 0x6e3, 0x6fd1b14c) === 0) return 0
    if (ITEMS_CheckNotBrokenOrUnequipping113c(m, pItem) === 0) return 0
    if ((ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 0x26) return 0
  } else {
    if (ITEMS_CheckRequirements113c(m, pItem, pUnit, 0, 0, 0, 0) === 0) return 0
    if (ITEMS_CanBeEquipped113c(m, pItem) === 0) return 0
    if (ITEMS_CheckCommandFlags113c(m, pItem, 0x10, 0x6ec, 0x6fd1b14c) === 0) return 0
    if (ITEMS_CheckNotBrokenOrUnequipping113c(m, pItem) === 0) return 0
    if ((ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 0x26) return 0
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  const pRightArm = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, 4) >>> 0
  const pLeftArm = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, 5) >>> 0
  const nItemType = ITEMS_GetItemTypeFromItem113c(m, pItem)
  if (ITEMS_GetItemTypeShoots113c(m, nItemType) !== 0) {
    let bAmmoMatches = 0
    if (pRightArm !== 0) {
      const nQuiverR = ITEMS_GetItemTypeQuiverFromItem113c(m, pRightArm)
      if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, nQuiverR) !== 0) {
        bAmmoMatches = 1
      }
    }
    if (bAmmoMatches === 0) {
      if (pLeftArm === 0) return 0
      const nQuiverL = ITEMS_GetItemTypeQuiverFromItem113c(m, pLeftArm)
      if (ITEMS_CheckItemTypeIdMemPort113c(m, pItem, nQuiverL) === 0) return 0
    }
  }
  const sp = allocW6B6Stack(m, 0x60)
  try {
    const pHandExisting = sp
    const pHandCandidate = (sp + 0x28) >>> 0
    const pLoc1 = (sp + 0x50) >>> 0
    const pLoc2 = (sp + 0x54) >>> 0
    ITEMS_GetAllowedBodyLocations113c(m, pItem, pLoc1, pLoc2)
    const bLoc1 = m.u8(pLoc1)
    const bLoc2 = m.u8(pLoc2)
    if (bLoc1 === bLoc2) {
      if (INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, bLoc1) !== 0) return 0
      m.setU32(pOutBodyLoc >>> 0, bLoc1)
      return 1
    }
    ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c(m, pItem, pUnit, pHandCandidate)
    const pItemLoc1 = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, bLoc1) >>> 0
    const pItemLoc2 = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, bLoc2) >>> 0
    if (pItemLoc1 !== 0) {
      if (pItemLoc2 !== 0) return 0
      ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c(m, pItemLoc1, pUnit, pHandExisting)
      if (ITEMS_AreWeaponSlotTypesCompatible113c(m, pHandCandidate, pHandExisting) === 0) return 0
      m.setU32(pOutBodyLoc >>> 0, bLoc2)
      return 1
    }
    if (pItemLoc2 === 0) {
      m.setU32(pOutBodyLoc >>> 0, bLoc1)
      return 1
    }
    ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c(m, pItemLoc2, pUnit, pHandExisting)
    if (ITEMS_AreWeaponSlotTypesCompatible113c(m, pHandCandidate, pHandExisting) === 0) return 0
    m.setU32(pOutBodyLoc >>> 0, bLoc1)
    return 1
  } finally {
    freeW6B6Stack(sp)
  }
}

/**
 * [5/45] Validates left/right hand skills on `pUnit` against equipped primary/secondary weapons,
 * falling back to Throw (`2`) / Unsummon? (`4`) or restoring saved hand skills when blocked (`2` or `7`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF28D0
 * @ordinalOrName D2Game_6FCF28D0
 */
export function ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(
  m: D2KernMemory113c,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCF28D0)
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 0) return
  const sp = allocW6B6Stack(m, 0x10)
  try {
    const pOutPrimary = sp
    const pOutSecondary = (sp + 4) >>> 0
    ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c(m, pUnit, pOutPrimary, pOutSecondary)
    const pPrimary = m.u32(pOutPrimary) >>> 0
    if (pPrimary === 0) return
    const bPrimRangedNonJav =
      ITEMS_CheckItemTypeIdMemPort113c(m, pPrimary, 0x30) !== 0 &&
      ITEMS_CheckItemTypeIdMemPort113c(m, pPrimary, 0x2e) === 0
        ? 1
        : 0
    let pLeftSkill = UNITS_GetLeftSkill113c(m, pUnit) >>> 0
    if (bPrimRangedNonJav !== 0 && ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c(m, pLeftSkill, pUnit) === 0) {
      PLAYER_StoreLeftSkill113c(m, pUnit)
      SKILLS_AssignHandSkillAndSyncAura113c(m, pUnit, 1, 2, 0xffffffff)
      pLeftSkill = UNITS_GetLeftSkill113c(m, pUnit) >>> 0
    }
    const nLeftFail = SKILLS_GetSkillUseFailReason113c(m, pUnit, pLeftSkill) | 0
    if (nLeftFail === 2 || nLeftFail === 7) {
      ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c(m, pUnit, pLeftSkill, 1)
    }
    const pSecondary = m.u32(pOutSecondary) >>> 0
    const bSecRangedNonJav =
      pSecondary !== 0 &&
      ITEMS_CheckItemTypeIdMemPort113c(m, pSecondary, 0x30) !== 0 &&
      ITEMS_CheckItemTypeIdMemPort113c(m, pSecondary, 0x2e) === 0
        ? 1
        : 0
    let pRightSkill = UNITS_GetRightSkill113c(m, pUnit) >>> 0
    if (bSecRangedNonJav !== 0 && ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c(m, pRightSkill, pUnit) === 0) {
      PLAYER_StoreRightSkill113c(m, pUnit)
      SKILLS_AssignHandSkillAndSyncAura113c(m, pUnit, 0, 4, 0xffffffff)
      pRightSkill = UNITS_GetRightSkill113c(m, pUnit) >>> 0
    }
    const nRightFail = SKILLS_GetSkillUseFailReason113c(m, pUnit, pRightSkill) | 0
    if (nRightFail === 2 || nRightFail === 7) {
      ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c(m, pUnit, pRightSkill, 0)
    }
  } finally {
    freeW6B6Stack(sp)
  }
}

const QUEST_ITEM_COMPLETE_QUEST_IDS_6FD22CC0 = [3, 0x12, 0x13, 0x1b] as const
const QUEST_ITEM_COMPLETE_ITEM_BYTES_6FD22CC4 = [4, 0x11, 0x12, 0x19] as const

/**
 * [6/45] Checks whether `pPlayer` may pick up `pCandidateItem` under `UniqueItems.txt` `carry1`
 * and per-quest completion/duplicate rules across player inventory and corpses.
 *
 * @dll D2Game.dll
 * @va 0x6FCF2F00
 * @ordinalOrName D2Game_6FCF2F00
 */
export function ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pCandidateItem: number,
): number {
  hitD2GameVa113c(0x6FCF2F00)
  const pInventory = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  const pFirstInvItem = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  if (pInventory === 0) return 0
  const nClassId = pCandidateItem === 0 ? -1 : (m.u32((pCandidateItem + 4) >>> 0) | 0)
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nClassId) >>> 0
  if (pItemsTxt === 0) return 0
  if (pCandidateItem !== 0 && m.u32(pCandidateItem >>> 0) === 4) {
    if ((ITEMS_GetItemQuality113c(m, pCandidateItem) | 0) === 7) {
      if ((ITEMS_GetItemCell113c(m, pCandidateItem) | 0) >= 0) {
        const nUniqueId = ITEMS_GetItemCell113c(m, pCandidateItem) | 0
        const pUniqueTxt = UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c(m, nUniqueId) >>> 0
        if (pUniqueTxt !== 0) {
          const pMasks = m.u32(0x6fd18be0) >>> 0
          const bMask2 = pMasks !== 0 ? m.u8((pMasks + 8) >>> 0) : 4
          if ((bMask2 & m.u8((pUniqueTxt + 0x2c) >>> 0)) !== 0) {
            if (ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c(m, pFirstInvItem, pItemsTxt, pCandidateItem) !== 0) {
              return 0
            }
          }
        }
      }
    }
  }
  const bQuest = m.u8((pItemsTxt + 0x12a) >>> 0)
  if (bQuest === 0) return 1
  const dwCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0
  if (dwCode === 0x20737361) {
    const pPlrData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const pQuestRec = m.u32((pPlrData + nDiff * 4 + 0x10) >>> 0) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 9, 5) === 0) return 0
  } else if (dwCode === 0x2034336a) {
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x14, 0) !== 0) return 0
  } else if (dwCode === 0x207a7978) {
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x14, 5) === 0) return 0
  } else if (dwCode === 0x20333367) {
    const pQuestRec0 = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec0, 0x13, 7) !== 0) return 0
    const pQuestRec1 = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec1, 0x13, 8) !== 0) return 0
  } else if (dwCode === 0x20327274) {
    const pQuestRec0 = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec0, 0x25, 8) === 0) return 0
    const pQuestRec1 = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec1, 0x25, 7) !== 0) return 0
  }
  const nQuestDec = (m.u8((pItemsTxt + 0x12a) >>> 0) - 1) | 0
  if (nQuestDec === 9) {
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x0a, 0) !== 0 &&
      (m.u32((pItemsTxt + 0x80) >>> 0) >>> 0) !== 0x20786f62
    ) {
      return 0
    }
  } else if (nQuestDec === 4) {
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 4, 0) !== 0 &&
      (m.u32((pItemsTxt + 0x80) >>> 0) >>> 0) !== 0x2067656c
    ) {
      return 0
    }
  } else {
    const hasMemTbl = m.u8(0x6fd22cc4) !== 0
    for (let i = 0; i < 4; i++) {
      const bTblQuest = hasMemTbl ? m.u8((0x6fd22cc4 + i * 8) >>> 0) : QUEST_ITEM_COMPLETE_ITEM_BYTES_6FD22CC4[i]!
      if (m.u8((pItemsTxt + 0x12a) >>> 0) === bTblQuest) {
        const nTblQuestId = hasMemTbl ? (m.u32((0x6fd22cc0 + i * 8) >>> 0) | 0) : QUEST_ITEM_COMPLETE_QUEST_IDS_6FD22CC0[i]!
        const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame) >>> 0
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, nTblQuestId, 0) !== 0) return 0
      }
    }
  }
  if (ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c(m, pFirstInvItem, pItemsTxt, pCandidateItem) !== 0) {
    return 0
  }
  let pCorpse = INVENTORY_GetFirstCorpse113c(m, m.u32((pPlayer + 0x60) >>> 0)) >>> 0
  while (pCorpse !== 0) {
    const dwCorpseGuid = INVENTORY_GetCorpseUnitId113c(m, pCorpse) >>> 0
    if (pGame === 0) throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
    let pCorpseUnit = m.u32((pGame + 0x1120 + ((dwCorpseGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pCorpseUnit !== 0 && (m.u32((pCorpseUnit + 0x0c) >>> 0) >>> 0) !== dwCorpseGuid) {
      pCorpseUnit = m.u32((pCorpseUnit + 0xe4) >>> 0) >>> 0
    }
    if (pCorpseUnit !== 0) {
      const pCorpseInv = m.u32((pCorpseUnit + 0x60) >>> 0) >>> 0
      if (pCorpseInv !== 0) {
        const pCorpseFirst = INVENTORY_GetFirstItem113c(m, pCorpseInv) >>> 0
        if (
          pCorpseFirst !== 0 &&
          ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c(m, pCorpseFirst, pItemsTxt, pCandidateItem) !== 0
        ) {
          return 0
        }
      }
    }
    pCorpse = INVENTORY_GetNextCorpse113c(m, pCorpse) >>> 0
  }
  return 1
}

/**
 * [7/45] Adds `nDelta` to `STAT_QUANTITY` (`0x46`) on `pItem`, syncs packet `0x3E`, and updates scroll/tome skill charges (`0x22`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF3450
 * @ordinalOrName D2Game_6FCF3450
 */
export function ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  nDelta: number,
): void {
  hitD2GameVa113c(0x6FCF3450)
  STATLIST_AddUnitStatMemPort113c(m, pItem, 0x46, nDelta, 0)
  const pClient =
    pUnit !== 0 && m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
  const dwNewQty = STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) >>> 0
  NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pClient, 1, 0x46, dwNewQty)
  ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pItem, pUnit, nDelta)
}

/**
 * [8/45] Inserts scroll `dwScrollGuid` (ground mode `3` or cursor mode `4`) into inventory tome `dwTomeGuid` on `pUnit`.
 *
 * @dll D2Game.dll
 * @va 0x6FCF34B0
 * @ordinalOrName D2Game_6FCF34B0
 */
export function ITEMS_InsertScrollIntoTome_6FCF34B0_113c(
  m: D2KernMemory113c,
  dwScrollGuid: number,
  pGame: number,
  pUnit: number,
  dwTomeGuid: number,
  pOutRejectReason: number,
): number {
  hitD2GameVa113c(0x6FCF34B0)
  if (pGame === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x144f)
  if (pUnit === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x1450)
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit)
  m.setU32(pOutRejectReason >>> 0, 0)
  const scrGuid = dwScrollGuid >>> 0
  let pScroll = m.u32((pGame + 0x1720 + ((scrGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pScroll !== 0 && (m.u32((pScroll + 0x0c) >>> 0) >>> 0) !== scrGuid) {
    pScroll = m.u32((pScroll + 0xe4) >>> 0) >>> 0
  }
  if (pScroll === 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if (m.u32(pScroll) !== 4) return 0
  const nScrollMode = m.u32((pScroll + 0x10) >>> 0)
  if (nScrollMode !== 3 && nScrollMode !== 4) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if (ITEMS_CheckItemTypeIdMemPort113c(m, pScroll, 0x16) === 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  const tomeGuid = dwTomeGuid >>> 0
  let pTome = m.u32((pGame + 0x1720 + ((tomeGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pTome !== 0 && (m.u32((pTome + 0x0c) >>> 0) >>> 0) !== tomeGuid) {
    pTome = m.u32((pTome + 0xe4) >>> 0) >>> 0
  }
  if (pTome === 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if (m.u32(pTome) !== 4) return 0
  if (m.u32((pTome + 0x10) >>> 0) !== 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if ((ITEMS_GetItemTypeFromItem113c(m, pTome) | 0) !== 0x12) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x1482)
  if ((ITEMS_GetMagicSuffix113c(m, pTome, 0) & 0xffff) !== (ITEMS_GetMagicSuffix113c(m, pScroll, 0) & 0xffff)) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x149d)
  }
  const nCurQty = STATLIST_GetUnitStat113c(m, pTome, 0x46, 0) | 0
  if (nCurQty >= (ITEMS_GetTotalMaxStack113c(m, pTome) | 0)) return 0
  if (ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pUnit, pScroll, pGame) === 0) {
    const pRoom = UNITS_GetRoom113c(m, pScroll) >>> 0
    if (pRoom !== 0) {
      DUNGEON_AddRoomPortalNode113c(m, pRoom, m.u32(pScroll) | 0, m.u32((pScroll + 0x0c) >>> 0) | 0)
      UNITS_SetTargetUnitForDynamicUnitEx113c(m, pScroll)
      UNITROOM_RemoveUnitFromRoom113c(m, pScroll)
    }
    m.setU32((pScroll + 0xc4) >>> 0, (m.u32((pScroll + 0xc4) >>> 0) & ~2) >>> 0)
    ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pScroll)
    INVENTORY_SetCursorItem113c(m, pInventory, 0)
  }
  STATLIST_AddUnitStatMemPort113c(m, pTome, 0x46, 1, 0)
  const pClient = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
  const dwNewQty = STATLIST_GetUnitStat113c(m, pTome, 0x46, 0) >>> 0
  NET_SendPacket0x3E_ItemStatBitStream113c(m, pTome, 0, pClient, 1, 0x46, dwNewQty)
  ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pTome, pUnit, 1)
  return 1
}

/**
 * [9/45] Merges stackable cursor item `pSourceItem` into `pTargetItem` on `pUnit`, handling both
 * overflow (`nCombined > nMaxStack`, leaving remainder on cursor and setting cmdFlag `8`) and full consumption.
 *
 * @dll D2Game.dll
 * @va 0x6FCF36D0
 * @ordinalOrName D2Game_6FCF36D0
 */
export function ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c(
  m: D2KernMemory113c,
  pTargetItem: number,
  pGame: number,
  pUnit: number,
  pSourceItem: number,
): void {
  hitD2GameVa113c(0x6FCF36D0)
  if (ITEMS_AreStackableWeaponsCompatible113c(m, pSourceItem, pTargetItem) === 0) return
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  const nSrcQty = STATLIST_GetUnitStat113c(m, pSourceItem, 0x46, 0) | 0
  if (nSrcQty < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x114c)
  const nDstQty = STATLIST_GetUnitStat113c(m, pTargetItem, 0x46, 0) | 0
  if (nDstQty < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x114e)
  const nMaxStack = ITEMS_GetTotalMaxStack113c(m, pTargetItem) | 0
  if (nMaxStack < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x1150)
  const nCombined = (nDstQty + nSrcQty) | 0
  if (nCombined > nMaxStack) {
    STATLIST_SetUnitStat113c(m, pTargetItem, 0x46, nMaxStack, 0)
    const pClient0 = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
    NET_SendPacket0x3E_ItemStatBitStream113c(m, pTargetItem, 0, pClient0, 1, 0x46, nMaxStack >>> 0)
    const nRemQty = ((nDstQty - nMaxStack) + nSrcQty) | 0
    if (nRemQty < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x1159)
    STATLIST_SetUnitStat113c(m, pSourceItem, 0x46, nRemQty, 0)
    const pClient1 = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
    NET_SendPacket0x3E_ItemStatBitStream113c(m, pSourceItem, 0, pClient1, 1, 0x46, nRemQty >>> 0)
    if (
      (ITEMS_GetItemTypeFromItem113c(m, pSourceItem) | 0) === 0x12 &&
      (ITEMS_GetItemTypeFromItem113c(m, pTargetItem) | 0) === 0x12
    ) {
      const nAdded = (ITEMS_GetTotalMaxStack113c(m, pTargetItem) - nDstQty) | 0
      ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pTargetItem, pUnit, nAdded)
    }
    ITEMS_SetOrClearCommandFlags113c(m, pTargetItem, 8, 1)
    return
  }
  if (ITEMS_CanItemLoseDurability113c(m, pSourceItem) !== 0) {
    const nSrcDur = STATLIST_GetUnitStat113c(m, pSourceItem, 0x48, 0) | 0
    const nDstDur = STATLIST_GetUnitStat113c(m, pTargetItem, 0x48, 0) | 0
    if (nSrcDur < nDstDur) {
      STATLIST_SetUnitStat113c(m, pTargetItem, 0x48, nSrcDur, 0)
      const pClientDur = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
      NET_SendPacket0x3E_ItemStatBitStream113c(m, pTargetItem, 0, pClientDur, 1, 0x48, nSrcDur >>> 0)
    }
  }
  if (nCombined < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x1177)
  STATLIST_SetUnitStat113c(m, pTargetItem, 0x46, nCombined, 0)
  const pClientQty = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
  NET_SendPacket0x3E_ItemStatBitStream113c(m, pTargetItem, 0, pClientQty, 1, 0x46, nCombined >>> 0)
  if (
    (ITEMS_GetItemTypeFromItem113c(m, pSourceItem) | 0) === 0x12 &&
    (ITEMS_GetItemTypeFromItem113c(m, pTargetItem) | 0) === 0x12
  ) {
    ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pTargetItem, pUnit, nSrcQty)
  }
  INVENTORY_SetCursorItem113c(m, pInventory, 0)
  const pClientClear = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
  NET_SendPacket42_ClearCursor_6FCAAF10_113c(m, pUnit, pClientClear)
  ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pSourceItem)
}

/**
 * [10/45] Sends S2C `0x9C` belt action `0x0F` (`nCmdFlags = 0x20`) and removes/frees belt item `pItem` on `pUnit`.
 *
 * @dll D2Game.dll
 * @va 0x6FCF3950
 * @ordinalOrName D2Game_6FCF3950
 */
export function ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF3950)
  const pClient =
    pUnit !== 0 && m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
  const sp = allocW6B6Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    ITEMS_SetOrClearFlagMask113c(m, sp, 0x20, 1)
    const nCmdFlags = m.u32(sp) | 0
    S2C_SendPacket9C_ItemActionWorld113c(m, pClient, pItem, 0x0f, nCmdFlags, 0)
    ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c(m, pGame, pItem, pUnit)
  } finally {
    freeW6B6Stack(sp)
  }
}

function w6b6BitInit113c(m: D2KernMemory113c, pBs: number, pBuf: number, nBytes: number): void {
  m.setU32(pBs >>> 0, pBuf >>> 0)
  m.setU32((pBs + 0x04) >>> 0, ((nBytes | 0) << 3) >>> 0)
  m.setU32((pBs + 0x08) >>> 0, 0)
  m.setU32((pBs + 0x0c) >>> 0, 0)
  m.setU32((pBs + 0x10) >>> 0, 0)
}

function w6b6BitWrite113c(m: D2KernMemory113c, pBs: number, nValue: number, nBits: number): void {
  const bs = pBs >>> 0
  const curBit0 = m.u32((bs + 0x0c) >>> 0) | 0
  const curByte0 = m.u32((bs + 0x08) >>> 0) | 0
  const maxBits = m.u32((bs + 0x04) >>> 0) | 0
  let rem = nBits | 0
  if (((curBit0 + (curByte0 << 3) + rem) | 0) > maxBits) {
    m.setU32((bs + 0x10) >>> 0, 1)
    m.setU32((bs + 0x08) >>> 0, (((maxBits + ((maxBits >> 31) & 7)) | 0) >> 3) >>> 0)
    m.setU32((bs + 0x0c) >>> 0, 0)
    return
  }
  if (curBit0 === 0) m.setU8(m.u32(bs), 0)
  if (rem <= 0) return
  let val = nValue >>> 0
  while (rem > 0) {
    const curBit = m.u32((bs + 0x0c) >>> 0) | 0
    let chunk = (8 - curBit) | 0
    if (chunk > rem) chunk = rem
    const mask = ((1 << chunk) - 1) & 0xff
    const pOut = m.u32(bs)
    m.setU8(pOut, (m.u8(pOut) | (((val & mask) << (curBit & 31)) & 0xff)) & 0xff)
    const nextBit = (curBit + chunk) | 0
    m.setU32((bs + 0x0c) >>> 0, nextBit >>> 0)
    if (nextBit === 8) {
      m.setU32(bs, (pOut + 1) >>> 0)
      m.setU32((bs + 0x08) >>> 0, (m.u32((bs + 0x08) >>> 0) + 1) >>> 0)
      m.setU32((bs + 0x0c) >>> 0, 0)
    }
    val = val >>> chunk
    rem = (rem - chunk) | 0
  }
}

function w6b6BitSize113c(m: D2KernMemory113c, pBs: number): number {
  const bs = pBs >>> 0
  const nPos = m.u32((bs + 0x08) >>> 0) | 0
  return m.u32((bs + 0x0c) >>> 0) !== 0 ? (nPos + 1) | 0 : nPos
}

/**
 * [11/45] Sends S2C `0x9D` action `0x05` (`nCmdFlags = 0x20`) and removes/frees grid item `pItem` on `pUnit`.
 *
 * @dll D2Game.dll
 * @va 0x6FCF39B0
 * @ordinalOrName D2Game_6FCF39B0
 */
export function ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF39B0)
  const pClient =
    pUnit !== 0 && m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
  const sp = allocW6B6Stack(m, 0x10)
  try {
    m.setU32(sp, 0)
    ITEMS_SetOrClearFlagMask113c(m, sp, 0x20, 1)
    const nCmdFlags = m.u32(sp) | 0
    NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(m, pItem, pUnit, pClient, nCmdFlags)
    ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, pUnit, pItem, pGame, 0)
  } finally {
    freeW6B6Stack(sp)
  }
}

/**
 * [12/45] Auto-stacks a picked-up scroll `pScrollItem` into a matching inventory tome on `pUnit`.
 *
 * @dll D2Game.dll
 * @va 0x6FCF3A10
 * @ordinalOrName D2Game_6FCF3A10
 */
export function ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pScrollItem: number,
): number {
  hitD2GameVa113c(0x6FCF3A10)
  if (pGame === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x623)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  const pTome = INVENTORY_FindReagentForTome113c(m, pInventory, pScrollItem, 0) >>> 0
  if (pTome === 0) return 0
  const nSrcQty = STATLIST_GetUnitStat113c(m, pScrollItem, 0x46, 0) | 0
  if (nSrcQty < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x62f)
  const nTomeQty = STATLIST_GetUnitStat113c(m, pTome, 0x46, 0) | 0
  if (nTomeQty < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x631)
  const nMaxStack = ITEMS_GetTotalMaxStack113c(m, pTome) | 0
  if (nMaxStack < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x633)
  const nCombined = (nTomeQty + nSrcQty) | 0
  if (nCombined > nMaxStack) {
    STATLIST_SetUnitStat113c(m, pTome, 0x46, nMaxStack, 0)
    const pClient0 = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
    NET_SendPacket0x3E_ItemStatBitStream113c(m, pTome, 0, pClient0, 1, 0x46, nMaxStack >>> 0)
    const nRemQty = ((nTomeQty - nMaxStack) + nSrcQty) | 0
    if (nRemQty < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x63b)
    STATLIST_SetUnitStat113c(m, pScrollItem, 0x46, nRemQty, 0)
    const pClient1 = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
    NET_SendPacket0x3E_ItemStatBitStream113c(m, pScrollItem, 0, pClient1, 1, 0x46, nRemQty >>> 0)
    ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pTome, pUnit, (nMaxStack - nTomeQty) | 0)
    return 1
  }
  if (nCombined < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x646)
  STATLIST_SetUnitStat113c(m, pTome, 0x46, nCombined, 0)
  const pClient = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
  NET_SendPacket0x3E_ItemStatBitStream113c(m, pTome, 0, pClient, 1, 0x46, nCombined >>> 0)
  ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pTome, pUnit, nSrcQty)
  const pRoom = UNITS_GetRoom113c(m, pScrollItem) >>> 0
  if (pRoom !== 0) {
    const dwType = pScrollItem === 0 ? 6 : (m.u32(pScrollItem) | 0)
    const dwGuid = pScrollItem === 0 ? -1 : (m.u32((pScrollItem + 0x0c) >>> 0) | 0)
    DUNGEON_AddRoomPortalNode113c(m, pRoom, dwType, dwGuid)
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, pScrollItem)
    UNITROOM_RemoveUnitFromRoom113c(m, pScrollItem)
  }
  if (pScrollItem !== 0) {
    m.setU32((pScrollItem + 0xc4) >>> 0, (m.u32((pScrollItem + 0xc4) >>> 0) & ~2) >>> 0)
  }
  ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pScrollItem)
  INVENTORY_SetCursorItem113c(m, pInventory, 0)
  return 1
}

/**
 * [13/45] Auto-stacks ground item `pItem` into compatible belt/inventory stacks on `pUnit`,
 * building inline S2C `0x3E` bitstreams on partial stack fills and freeing `pItem` when fully absorbed.
 *
 * @dll D2Game.dll
 * @va 0x6FCF3CB0
 * @ordinalOrName D2Game_6FCF3CB0
 */
export function ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FCF3CB0)
  let pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  let pTarget = 0
  let nIters = 0
  if ((STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) | 0) <= 0) return 0
  while (true) {
    nIters = (nIters + 1) | 0
    if (ITEMS_IsAutoStack113c(m, pItem) !== 0) {
      if (ITEMS_GetItemTypeShootsFromItem113c(m, pItem) !== 0) {
        pTarget = INVENTORY_FindStackableCompatItemInGrid0_113c(m, pInventory, pItem, pTarget) >>> 0
        if (pTarget === 0) {
          pTarget = INVENTORY_FindStackableCompatItemInBelt113c(m, pInventory, pItem, 0) >>> 0
        }
      } else {
        pTarget = INVENTORY_FindStackableCompatItemInBelt113c(m, pInventory, pItem, pTarget) >>> 0
      }
    }
    if (pTarget === 0) return 0
    if (ITEMS_AreStackableWeaponsCompatible113c(m, pItem, pTarget) !== 0) {
      const nSrcQty = STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) | 0
      const nDstQty = STATLIST_GetUnitStat113c(m, pTarget, 0x46, 0) | 0
      const nMaxStack = ITEMS_GetTotalMaxStack113c(m, pTarget) | 0
      if (((nDstQty + nSrcQty) | 0) <= nMaxStack) {
        const nNewQty = (nSrcQty + nDstQty) | 0
        if (nNewQty < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x5d8)
        if (ITEMS_CanItemLoseDurability113c(m, pItem) !== 0) {
          const nSrcDur = STATLIST_GetUnitStat113c(m, pItem, 0x48, 0) | 0
          const nDstDur = STATLIST_GetUnitStat113c(m, pTarget, 0x48, 0) | 0
          if (nSrcDur < nDstDur) {
            STATLIST_SetUnitStat113c(m, pTarget, 0x48, nSrcDur, 0)
            const pClientDur =
              m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
            NET_SendPacket0x3E_ItemStatBitStream113c(m, pTarget, 0, pClientDur, 1, 0x48, nSrcDur >>> 0)
          }
        }
        STATLIST_SetUnitStat113c(m, pTarget, 0x46, nNewQty, 0)
        STATLIST_SetUnitStat113c(m, pItem, 0x46, 0, 0)
        const pClientQty =
          m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
        NET_SendPacket0x3E_ItemStatBitStream113c(m, pTarget, 0, pClientQty, 1, 0x46, nNewQty >>> 0)
        if (
          (ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 0x12 &&
          (ITEMS_GetItemTypeFromItem113c(m, pTarget) | 0) === 0x12
        ) {
          ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pTarget, pUnit, nSrcQty)
        }
        const pRoom = UNITS_GetRoom113c(m, pItem) >>> 0
        if (pRoom !== 0) {
          const dwType = pItem === 0 ? 6 : (m.u32(pItem) | 0)
          const dwGuid = pItem === 0 ? -1 : (m.u32((pItem + 0x0c) >>> 0) | 0)
          DUNGEON_AddRoomPortalNode113c(m, pRoom, dwType, dwGuid)
          UNITS_SetTargetUnitForDynamicUnitEx113c(m, pItem)
          UNITROOM_RemoveUnitFromRoom113c(m, pItem)
        }
        if (pItem !== 0) {
          m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0)
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
        INVENTORY_SetCursorItem113c(m, pInventory, 0)
        return 1
      }
      const nMax = ITEMS_GetTotalMaxStack113c(m, pTarget) | 0
      if (nMax < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x5c8)
      STATLIST_SetUnitStat113c(m, pTarget, 0x46, nMax, 0)
      const pClient = m.u32(pUnit >>> 0) === 0 ? (m.u32((UNITS_GetPlayerData113c(m, pUnit) + 0x9c) >>> 0) >>> 0) : 0
      const sp = allocW6B6Stack(m, 0x40)
      try {
        const pBs = sp
        const pPkt = (sp + 0x18) >>> 0
        m.setU8(pPkt, 0x3e)
        w6b6BitInit113c(m, pBs, (pPkt + 2) >>> 0, 0x20)
        const dwTargetGuid = pTarget === 0 ? 0xffffffff : (m.u32((pTarget + 0x0c) >>> 0) >>> 0)
        if (pTarget !== 0 && dwTargetGuid < 0x100) {
          w6b6BitWrite113c(m, pBs, 0, 1)
          w6b6BitWrite113c(m, pBs, dwTargetGuid, 8)
        } else {
          w6b6BitWrite113c(m, pBs, 1, 1)
          if (dwTargetGuid < 0x10000) {
            w6b6BitWrite113c(m, pBs, 0, 1)
            w6b6BitWrite113c(m, pBs, dwTargetGuid, 16)
          } else {
            w6b6BitWrite113c(m, pBs, 1, 1)
            w6b6BitWrite113c(m, pBs, dwTargetGuid, 32)
          }
        }
        w6b6BitWrite113c(m, pBs, 1, 1)
        w6b6BitWrite113c(m, pBs, 0x46, 9)
        const uMax = nMax >>> 0
        if (uMax < 0x100) {
          w6b6BitWrite113c(m, pBs, 0, 1)
          w6b6BitWrite113c(m, pBs, uMax, 8)
        } else {
          w6b6BitWrite113c(m, pBs, 1, 1)
          if (uMax < 0x10000) {
            w6b6BitWrite113c(m, pBs, 0, 1)
            w6b6BitWrite113c(m, pBs, uMax, 16)
          } else {
            w6b6BitWrite113c(m, pBs, 1, 1)
            w6b6BitWrite113c(m, pBs, uMax, 32)
          }
        }
        w6b6BitWrite113c(m, pBs, 0, 1)
        w6b6BitWrite113c(m, pBs, 0, 8)
        const nBitBytes = w6b6BitSize113c(m, pBs)
        m.setU8((pPkt + 1) >>> 0, (nBitBytes + 2) & 0xff)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x22)
      } finally {
        freeW6B6Stack(sp)
      }
      const nRemQty = ((nDstQty - nMax) + nSrcQty) | 0
      if (nRemQty < 0) throw new D2CommonAssertError('ItemMode.cpp', 0x5cd)
      STATLIST_SetUnitStat113c(m, pItem, 0x46, nRemQty, 0)
      if (
        (ITEMS_GetItemTypeFromItem113c(m, pItem) | 0) === 0x12 &&
        (ITEMS_GetItemTypeFromItem113c(m, pTarget) | 0) === 0x12
      ) {
        const nAdded = (ITEMS_GetTotalMaxStack113c(m, pTarget) - nDstQty) | 0
        ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, pTarget, pUnit, nAdded)
      }
      pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
    }
    if ((STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) | 0) <= 0) break
  }
  if (nIters !== 0) throw new D2CommonAssertError('ItemMode.cpp', 0x607)
  return 0
}

/**
 * [14/45] Resets scroll/tome skill charges across stored inventory items on `pUnit` and recounts page-0 items.
 *
 * @dll D2Game.dll
 * @va 0x6FCF4570
 * @ordinalOrName D2Game_6FCF4570
 */
export function ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(
  m: D2KernMemory113c,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCF4570)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  let nPage0Count = 0
  if (pNode === 0) return
  while (pNode !== 0) {
    const pNext = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    if (pItem === 0 || m.u32((pItem + 0x10) >>> 0) === 0) {
      ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c(m, pItem, pUnit)
      if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) === 0) {
        nPage0Count = (nPage0Count + 1) | 0
      }
    }
    pNode = pNext
  }
  if (nPage0Count === 0) return
  pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (pNode !== 0) {
    const pNext = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    if ((pItem === 0 || m.u32((pItem + 0x10) >>> 0) === 0) && (ITEMS_GetInvPage113c(m, pItem) & 0xff) === 0) {
      ITEMS_UpdateScrollOrTomeSkillCharges113c(m, pItem, pUnit, 1)
      nPage0Count = (nPage0Count - 1) | 0
      if (nPage0Count === 0) break
    }
    pNode = pNext
  }
}

/**
 * [15/45] Sockets cursor filler item `dwFillerItemGuid` into `dwTargetItemGuid`, activating socket stats
 * and applying matching `Runes.txt` runeword properties when completed.
 *
 * @dll D2Game.dll
 * @va 0x6FCF4A70
 * @ordinalOrName D2Game_6FCF4A70
 */
export function ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(
  m: D2KernMemory113c,
  dwFillerItemGuid: number,
  pGame: number,
  pUnit: number,
  dwTargetItemGuid: number,
  pOutRejectReason: number,
  bSyncInventoryOnNonRuneword: number,
  bClearUnitCursor: number,
  bRequireStoredOrEquippedTarget: number,
  bRechargeChargedSkills: number,
): number {
  hitD2GameVa113c(0x6FCF4A70)
  if (pGame === 0) throw new D2CommonAssertError('ItemMode.cpp', 0x13aa)
  m.setU32(pOutRejectReason >>> 0, 0)
  if (pUnit !== 0) ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit)
  const filGuid = dwFillerItemGuid >>> 0
  let pFiller = m.u32((pGame + 0x1720 + ((filGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pFiller !== 0 && (m.u32((pFiller + 0x0c) >>> 0) >>> 0) !== filGuid) {
    pFiller = m.u32((pFiller + 0xe4) >>> 0) >>> 0
  }
  if (pFiller === 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if (m.u32(pFiller) !== 4) return 0
  if (m.u32((pFiller + 0x10) >>> 0) !== 4) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  const tgtGuid = dwTargetItemGuid >>> 0
  let pTarget = m.u32((pGame + 0x1720 + ((tgtGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pTarget !== 0 && (m.u32((pTarget + 0x0c) >>> 0) >>> 0) !== tgtGuid) {
    pTarget = m.u32((pTarget + 0xe4) >>> 0) >>> 0
  }
  if (pTarget === 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if (m.u32(pTarget) !== 4) return 0
  if (ITEMS_CheckCommandFlags113c(m, pTarget, 0x10, 0x13dc, 0x6fd1b14c) === 0) return 0
  if (bRequireStoredOrEquippedTarget !== 0) {
    const nMode = m.u32((pTarget + 0x10) >>> 0)
    if (nMode !== 0 && nMode !== 1) return 0
  }
  if (m.u32(pFiller) !== 4 || m.u32(pTarget) !== 4) return 0
  if (ITEMS_CheckIfSocketFiller113c(m, pFiller) === 0) return 0
  if (ITEMS_CheckCommandFlags113c(m, pFiller, 0x10, 0x13eb, 0x6fd1b14c) === 0) return 0
  if (ITEMS_CheckCommandFlags113c(m, pTarget, 0x800, 0x13ec, 0x6fd1b14c) === 0) return 0
  if (ITEMS_GetSubTypeFromItem113c(m, pTarget) === 0) return 0
  let pTargetInv = m.u32((pTarget + 0x60) >>> 0) >>> 0
  if (pTargetInv === 0) {
    pTargetInv = INVENTORY_AllocInventory113c(m, 0, pTarget) >>> 0
    if (pTargetInv === 0) return 0
  }
  const nMaxSockets = ITEMS_GetMaxSockets113c(m, pTarget) & 0xff
  if ((INVENTORY_GetItemCount113c(m, pTargetInv) >>> 0) >= (nMaxSockets >>> 0)) return 0
  if (INVENTORY_PlaceItemInSocket113c(m, pTargetInv, pFiller, 1) === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x1445)
  }
  m.setU32((pFiller + 0xc4) >>> 0, (m.u32((pFiller + 0xc4) >>> 0) & ~2) >>> 0)
  if (bClearUnitCursor !== 0 && pUnit !== 0) {
    INVENTORY_SetCursorItem113c(m, m.u32((pUnit + 0x60) >>> 0), 0)
  }
  ITEMS_ActivateEquippedItemStats113c(m, pTarget, pFiller, 0)
  STATLIST_UpdateUnitByTimeStats113c(m, pFiller, pTarget)
  UNITS_ChangeAnimMode113c(m, pFiller, 6)
  const pRunesTxt = ITEMS_FindMatchingRunesTxtRecord113c(m, pTarget) >>> 0
  let bCompletedRuneword = 0
  if (pRunesTxt !== 0) {
    const bLadderOnly = m.u8((pRunesTxt + 0x81) >>> 0)
    if (bLadderOnly === 0 || m.u32((pGame + 0x74) >>> 0) !== 0) {
      bCompletedRuneword = 1
    }
  }
  if (bCompletedRuneword !== 0) {
    ITEMS_ApplyRunewordProps113c(m, pTarget, pFiller, 0)
    ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c(m, pGame, pTarget)
    ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(m, pGame, pTarget)
    if (bRechargeChargedSkills !== 0) {
      ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(m, pGame, pUnit, pTarget)
    }
  } else if (bSyncInventoryOnNonRuneword === 0) {
    return 1
  }
  ITEMS_SetOrClearCommandFlags113c(m, pTarget, 1, 1)
  if (ITEMS_CheckCommandFlags113c(m, pTarget, 0x4000, 0x143b, 0x6fd1b14c) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pTarget, 0x4000, 0)
  }
  if (pUnit !== 0) {
    UNITS_SetUnitUpdateFlags113c(m, pUnit, 1)
    INVENTORY_AppendItemGuidNode113c(m, m.u32((pUnit + 0x60) >>> 0), pTarget)
  }
  return 1
}


/**
 * [16/45] Removes a belt item (`ITEMMODE_INBELT = 2`) to the unit's cursor and compacts the belt column.
 *
 * @dll D2Game.dll
 * @va 0x6FCF4D30
 * @ordinalOrName D2Game_6FCF4D30
 */
export function ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  dwBeltItemGuid: number,
  pOutRejectReason: number,
): number {
  hitD2GameVa113c(0x6FCF4D30)
  if (pGame === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x124a)
  }
  if (pUnit === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x124b)
  }
  m.setU32(pOutRejectReason >>> 0, 0)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x1250)
  }
  if (INVENTORY_GetCursorItem113c(m, pInventory) !== 0) {
    return 0
  }
  const guid = dwBeltItemGuid >>> 0
  let pItem = m.u32((pGame + 0x1720 + ((guid & 0x7f) << 2)) >>> 0) >>> 0
  while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== guid) {
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  if (m.u32(pItem) !== 4) {
    return 0
  }
  if (m.u32((pItem + 0x10) >>> 0) !== 2) {
    m.setU32(pOutRejectReason >>> 0, 1)
    return 0
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit)
  const nBeltSlot = UNIT_GetPosX113c(m, pItem)
  INVENTORY_RemoveItemFromInventory113c(m, pInventory, pItem)
  INVENTORY_NoOpRet8A113c(m, pInventory, nBeltSlot)
  INVENTORY_SetCursorItem113c(m, pInventory, pItem)
  ITEMS_OnUnequipScrollOrTome113c(m, pItem, pUnit)
  m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0)
  ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pItem, pGame, 0, 1)
  UNITS_ChangeAnimMode113c(m, pItem, 4)
  ITEMS_SetItemFlag113c(m, pItem, 0x800, 1)
  UNITS_SetUnitUpdateFlags113c(m, pUnit, 1)
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem)
  ITEMS_CompactBeltColumnDown_6FCF2540_113c(m, nBeltSlot, pUnit)
  return 1
}

/**
 * [17/45] Grants shared experience (`nExpGain * 2`) to a player's active hireling and levels it up if eligible.
 *
 * @dll D2Game.dll
 * @va 0x6FCFDCB0
 * @ordinalOrName D2Game_6FCFDCB0
 */
export function HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c(
  m: D2KernMemory113c,
  nExpGain: number,
  pGame: number,
  pPlayer: number,
  pPetUnit: number,
  nCurrentLevel: number,
): void {
  hitD2GameVa113c(0x6FCFDCB0)
  if ((nExpGain | 0) <= 0) return
  const dwPetGuid = pPetUnit !== 0 ? m.u32((pPetUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const pPetArg = PETS_FindPetArgByGuid_6FCB6570_113c(m, pPlayer, dwPetGuid) >>> 0
  if (pPetArg === 0) return
  const nSubTypeId = m.u32((pPetArg + 0x08) >>> 0)
  const bExpansion = m.u32((pGame + 0x70) >>> 0)
  const pHirelingTxt =
    DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(m, bExpansion, nSubTypeId, nCurrentLevel) >>> 0
  if (pHirelingTxt === 0) return
  const nPlayerLevel = STATLIST_GetUnitStat113c(m, pPlayer, 0x0c, 0) | 0
  if ((nCurrentLevel | 0) >= nPlayerLevel) return
  const dwCurExp = STATLIST_GetUnitBaseStat113c(m, pPetUnit, 0x0d, 0) >>> 0
  const dwNewExp = (dwCurExp + ((nExpGain | 0) * 2)) >>> 0
  const nMaxLevelMinus1 = (DATATBLS_GetMaxLevel113c(m, 0) - 1) | 0
  if ((nCurrentLevel | 0) >= nMaxLevelMinus1) return
  STATLIST_SetUnitStat113c(m, pPetUnit, 0x0d, dwNewExp, 0)
  let pClient = 0
  if (pPlayer !== 0 && m.u32(pPlayer) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  NET_SendPacketA0A1A2_StatDelta_6FCABB10_113c(m, pClient, 0x0d, dwNewExp, dwCurExp, pPetUnit)
  let nTargetLevel = nCurrentLevel | 0
  do {
    const nExpPerLvl = m.u32((pHirelingTxt + 0x20) >>> 0)
    const nNextLevel = (nTargetLevel + 1) | 0
    const dwReqExp = HIRELING_GetExpForLevel113c(nNextLevel, nExpPerLvl) >>> 0
    if (dwReqExp > dwNewExp) break
    nTargetLevel = nNextLevel
  } while (nTargetLevel < nMaxLevelMinus1)
  if (nTargetLevel > (nCurrentLevel | 0)) {
    HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c(m, pGame, pPlayer, pPetUnit, nTargetLevel)
    MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c(m, pPlayer, pGame)
    SUNIT_SetUnitEventSound113c(m, pPetUnit, 0x5b, pPlayer)
    SUNIT_DispatchItemEventCallbacks113c(m, pPetUnit, pGame, 0x0c, 0, 0)
  }
}

const WANDERER_FLESH_BEAST_OFFSETS_6FD228D0: readonly [number, number][] = [
  [-3, -3],
  [-3, 0],
  [-3, 3],
  [0, -3],
  [0, 3],
  [3, -3],
  [3, 0],
  [-3, 3],
]

/**
 * [18/45] Act 3 Dark Wanderer encounter callback: marks wanderer seen and spawns Flesh Beast objects (`0x83`) around him.
 *
 * @dll D2Game.dll
 * @va 0x6FD057D0
 * @ordinalOrName D2Game_6FD057D0
 */
export function ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FD057D0)
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestExt + 0x0c) >>> 0) !== 0) {
    return 1
  }
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame,
    ACT3Q0_MarkWandererSeenCallback113c,
    0,
    0,
  )
  m.setU8((pQuestExt + 0x0c) >>> 0, 1)
  m.setU8((pQuestExt + 0x0d) >>> 0, 0)
  const dwWandererGuid = m.u32((pQuestExt + 0x10) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x2d3)
  }
  let pWanderer = m.u32((pGame + 0x1320 + ((dwWandererGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pWanderer !== 0 && (m.u32((pWanderer + 0x0c) >>> 0) >>> 0) !== dwWandererGuid) {
    pWanderer = m.u32((pWanderer + 0xe4) >>> 0) >>> 0
  }
  if (pWanderer === 0) {
    return 1
  }
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x1fb)
  }
  const seedLo = m.u32((pQuestCtrl + 0x18) >>> 0) >>> 0
  const seedHi = m.u32((pQuestCtrl + 0x1c) >>> 0) >>> 0
  const prod = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pQuestCtrl + 0x18) >>> 0, newLo)
  m.setU32((pQuestCtrl + 0x1c) >>> 0, newHi)
  let idx = newLo & 1
  const pRoom = UNITS_GetRoom113c(m, pWanderer) >>> 0
  const frame = allocW6B6Stack(m, 32)
  const pOutRoom = frame
  const pIoCoord = (frame + 4) >>> 0
  const pBaseCoord = (frame + 12) >>> 0
  try {
    PATH_GetTargetTypeAndPosition113c(m, pWanderer, pBaseCoord)
    while ((idx >>> 0) < 8) {
      const pair = WANDERER_FLESH_BEAST_OFFSETS_6FD228D0[idx]!
      const targetX = ((m.u32(pBaseCoord) | 0) + pair[0]) | 0
      const targetY = ((m.u32((pBaseCoord + 4) >>> 0) | 0) + pair[1]) | 0
      m.setU32(pIoCoord, targetX >>> 0)
      m.setU32((pIoCoord + 4) >>> 0, targetY >>> 0)
      QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
        m,
        pRoom,
        pIoCoord,
        3,
        0x3f11,
        pOutRoom,
        0x64,
      )
      const pSpawnRoom = m.u32(pOutRoom) >>> 0
      if (pSpawnRoom !== 0) {
        SUNIT_AllocUnitData113c(
          m,
          2,
          0x83,
          (m.u32(pIoCoord) | 0),
          (m.u32((pIoCoord + 4) >>> 0) | 0),
          pGame,
          pSpawnRoom,
          1,
          0,
          0,
        )
      }
      idx = (idx + 1) | 0
    }
  } finally {
    freeW6B6Stack(frame)
  }
  return 1
}

/**
 * [19/45] Act 3 Quest 7 (`The Guardian` / Mephisto) player callback: completes quest and advances player to Act 4 if in Durance 3 (`0x66`).
 *
 * @dll D2Game.dll
 * @va 0x6FD05C40
 * @ordinalOrName D2Game_6FD05C40
 */
export function ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD05C40)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pRoom === 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) !== 0) return 0
  if (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) !== 0x66) return 0
  let pQuestNode = 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl !== 0) {
    let pCur = m.u32(pQuestCtrl) >>> 0
    while (pCur !== 0) {
      if (m.u32(pCur) === 0x14) {
        pQuestNode = pCur
        break
      }
      pCur = m.u32((pCur + 0xf4) >>> 0) >>> 0
    }
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0b) === 0) {
    ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c(m, pQuestFlags, pPlayer, pGame)
    const pExt = m.u32((pQuestNode + 0x18) >>> 0) >>> 0
    m.setU32((pExt + 0x1c) >>> 0, (m.u32((pExt + 0x1c) >>> 0) + 1) >>> 0)
  }
  return 0
}

/**
 * [20/45] Act 3 Quest 2 (`Blade of the Old Religion` / Gidbinn) player init handler (`pfnFilter[2]`).
 *
 * @dll D2Game.dll
 * @va 0x6FD06000
 * @ordinalOrName D2Game_6FD06000
 */
export function ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD06000)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const pFoundGidbinn =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg),
      0x20333367,
    ) >>> 0
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (pFoundGidbinn !== 0) {
    m.setU32((pQuestExt + 0x1c) >>> 0, (m.u32((pQuestExt + 0x1c) >>> 0) + 1) >>> 0)
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) !== 0) {
    m.setU32((pQuestExt + 0x2c) >>> 0, 2)
    return
  }
  if (pFoundGidbinn !== 0) {
    m.setU8((pQuestData + 0x0b) >>> 0, 4)
    m.setU8((pQuestData + 0x0c) >>> 0, 4)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
    0,
    0,
  )
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6) === 1) {
    m.setU32((pQuestExt + 0x2c) >>> 0, 2)
    m.setU8((pQuestData + 0x0c) >>> 0, 5)
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7) === 0) {
      m.setU8((pQuestData + 0x0b) >>> 0, 5)
      return
    }
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8) === 0) {
      m.setU8((pQuestData + 0x0b) >>> 0, 6)
      return
    }
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 0)
    m.setU8((pQuestData + 0x09) >>> 0, 0)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 5) === 1) {
    m.setU8((pQuestData + 0x0c) >>> 0, 3)
    m.setU8((pQuestData + 0x0b) >>> 0, 2)
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 4) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 3) === 1
  ) {
    m.setU8((pQuestData + 0x0c) >>> 0, 2)
    m.setU8((pQuestData + 0x0b) >>> 0, 2)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 2) === 1) {
    m.setU8((pQuestData + 0x0c) >>> 0, 3)
    m.setU8((pQuestData + 0x0b) >>> 0, 1)
  }
}


let k2W6B6QuestHeapPtr = 0x7ef70000

export const ACT3Q0_HRATLI_CALLBACK_REFS_113C = {
  addDialog: ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c,
  onSpeechDone: ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c,
  syncFromPlayer: ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c,
  statusFilter: ACT3Q1_HratliIntroStatusFilter113c,
  activeFilter: ACT3Q1_HratliIntroActiveFilter113c,
} as const

/**
 * [21/45] Initializes Act 3 Hratli intro quest descriptor (`nQuestNo = 0x10`) callback table and 28-byte state struct.
 *
 * @dll D2Game.dll
 * @va 0x6FD06660
 * @ordinalOrName D2Game_6FD06660
 */
export function ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FD06660)
  for (let i = 0; i < 15; i = (i + 1) | 0) {
    m.setU32((pQuestData + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU8((pQuestData + 0x0c) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 0)
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  if (pGame !== 0) {
    m.u32((pGame + 0x1c) >>> 0)
  }
  m.setU32((pQuestData + 0xa0) >>> 0, 0x6fd054c0)
  m.setU32((pQuestData + 0xcc) >>> 0, 0x6fd05540)
  m.setU32((pQuestData + 0xd4) >>> 0, 0x6fd05450)
  m.setU32((pQuestData + 0xdc) >>> 0, 0x6fd1fe38)
  m.setU8((pQuestData + 0x0a) >>> 0, 1)
  const pExt = m.alloc(0x1c) >>> 0
  m.setU32((pQuestData + 0x18) >>> 0, pExt)
  for (let i = 0; i < 7; i = (i + 1) | 0) {
    m.setU32((pExt + i * 4) >>> 0, 0)
  }
  m.setU32((pQuestData + 0xe0) >>> 0, 0x10)
  m.setU32((pQuestData + 0xe8) >>> 0, 0x6fd03030)
  m.setU32((pQuestData + 0xec) >>> 0, 0x6fd03000)
}

export const ACT3_KURAST_INTRO_CALLBACK_REFS_113C = {
  addDialog: ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c,
  onSpeechDone: ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c,
  statusFilter: ACT3Q2_DarkWandererStatusFilter113c,
  activeFilter: ACT3_CainIntroActiveFilter_6FD055C0_113c,
} as const

/**
 * [22/45] Initializes Act 3 Kurast NPC intro quest descriptor (`nQuestNo = 0x2a`) callback table.
 *
 * @dll D2Game.dll
 * @va 0x6FD06700
 * @ordinalOrName D2Game_6FD06700
 */
export function ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FD06700)
  for (let i = 0; i < 15; i = (i + 1) | 0) {
    m.setU32((pQuestData + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU32((pQuestData + 0xa0) >>> 0, 0x6fd055f0)
  m.setU32((pQuestData + 0xcc) >>> 0, 0x6fd056e0)
  m.setU32((pQuestData + 0xdc) >>> 0, 0x6fd1fbe8)
  m.setU8((pQuestData + 0x0a) >>> 0, 1)
  m.setU8((pQuestData + 0x0c) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 0)
  m.setU32((pQuestData + 0x18) >>> 0, 0)
  m.setU32((pQuestData + 0xe0) >>> 0, 0x2a)
  m.setU32((pQuestData + 0xe8) >>> 0, 0x6fd03040)
  m.setU32((pQuestData + 0xec) >>> 0, 0x6fd055c0)
}

/**
 * [23/45] Act 3 Quest 7 (`The Guardian` / Mephisto) timer callback: advances `bLastState` to `4` and broadcasts quest alert.
 *
 * @dll D2Game.dll
 * @va 0x6FD068B0
 * @ordinalOrName D2Game_6FD068B0
 */
export function ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FD068B0)
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x0b) >>> 0) !== 4) {
    m.setU8((pQuestData + 0x0b) >>> 0, 4)
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c,
    0,
    0,
  )
  }
  m.setU8(pQuestExt, 0)
  return 1
}

/**
 * [24/45] Act 3 Quest 7 (`The Guardian` / Mephisto) NPC activate handler (`pfnFilter[2]`): triggers state `2` when talking to Ormus (`0xff`).
 *
 * @dll D2Game.dll
 * @va 0x6FD06910
 * @ordinalOrName D2Game_6FD06910
 */
export function ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD06910)
  const pTargetUnit = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pTargetUnit === 0) return
  if (m.u16((pTargetUnit + 0x04) >>> 0) !== 0xff) return
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestExt + 0x03) >>> 0) !== 1) return
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c,
    0,
    0,
  )
  m.setU8((pQuestExt + 0x03) >>> 0, 0)
  m.setU32((pQuestData + 0xa8) >>> 0, 0)
}

/**
 * [25/45] Act 3 Quest 5 (`The Blackened Temple` / Travincal) NPC activate handler: triggers state `2` and syncs Council flags on Ormus (`0xff`).
 *
 * @dll D2Game.dll
 * @va 0x6FD069E0
 * @ordinalOrName D2Game_6FD069E0
 */
export function ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD069E0)
  const pTargetUnit = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pTargetUnit === 0) return
  if (m.u16((pTargetUnit + 0x04) >>> 0) !== 0xff) return
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestExt + 0x04) >>> 0) !== 1) return
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
    0,
    0,
  )
  m.setU8((pQuestExt + 0x04) >>> 0, 0)
  m.setU32((pQuestData + 0xa8) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q5_SyncCouncilQuestFlagsCallback113c,
    0,
    0,
  )
}


/**
 * [26/45] Act 3 Quest 1 (`The Golden Bird`) player-picked-up-item / enter-game handler: tracks `'j34 '` and `'g34 '` count.
 *
 * @dll D2Game.dll
 * @va 0x6FD06A60
 * @ordinalOrName D2Game_6FD06A60
 */
export function ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD06A60)
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  let bHasGoldenBird = 0
  const pJadeFigurine =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg),
      0x2034336a,
    ) >>> 0
  if (pJadeFigurine !== 0) {
    m.setU32((pQuestExt + 0x10) >>> 0, (m.u32((pQuestExt + 0x10) >>> 0) + 1) >>> 0)
  }
  const pGoldenBird =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg),
      0x20343367,
    ) >>> 0
  if (pGoldenBird !== 0) {
    m.setU32((pQuestExt + 0x10) >>> 0, (m.u32((pQuestExt + 0x10) >>> 0) + 1) >>> 0)
    bHasGoldenBird = 1
  }
  if (
    m.u32((pQuestExt + 0x10) >>> 0) === 1 &&
    m.u8((pQuestData + 0x09) >>> 0) !== 0 &&
    m.u8((pQuestExt + 0x15) >>> 0) !== 0
  ) {
    m.setU8((pQuestExt + 0x15) >>> 0, 0)
    m.setU8((pQuestData + 0x14) >>> 0, 0)
    m.setU8((pQuestData + 0x0b) >>> 0, bHasGoldenBird === 0 ? 1 : 3)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
    0,
    0,
  )
  }
}

/**
 * [27/45] Act 3 Quest 1 (`The Golden Bird`) item dropped/removed handler: decrements active item count and sets state `6` when zeroed.
 *
 * @dll D2Game.dll
 * @va 0x6FD06B20
 * @ordinalOrName D2Game_6FD06B20
 */
export function ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  _pQuestArg: number = 0,
): void {
  hitD2GameVa113c(0x6FD06B20)
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const nRemaining = (m.u32((pQuestExt + 0x10) >>> 0) - 1) >>> 0
  m.setU32((pQuestExt + 0x10) >>> 0, nRemaining)
  if (nRemaining !== 0) return
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  if (m.u8((pQuestExt + 0x14) >>> 0) === 0) return
  if (m.u8((pQuestData + 0x0c) >>> 0) >= 4) return
  m.setU8((pQuestExt + 0x15) >>> 0, 1)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 6)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
    0,
    0,
  )
}

/**
 * [28/45] Act 3 Quest 1 (`The Golden Bird`) NPC activate handler: advances quest state on Alkor (`0xfe`), Cain (`0xf5`), or Meshif (`0x108`).
 *
 * @dll D2Game.dll
 * @va 0x6FD06BD0
 * @ordinalOrName D2Game_6FD06BD0
 */
export function ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD06BD0)
  const pTargetUnit = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nClassId = pTargetUnit !== 0 ? m.u16((pTargetUnit + 0x04) >>> 0) : 0xffff
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (nClassId === 0xfe) {
    if (m.u8((pQuestExt + 0x08) >>> 0) === 1) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 5)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
    0,
    0,
  )
      m.setU8((pQuestExt + 0x08) >>> 0, 0)
      m.setU8(pQuestExt, 1)
    }
    return
  }
  if (nClassId === 0xf5) {
    if (m.u8((pQuestExt + 0x09) >>> 0) === 1) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
    0,
    0,
  )
      m.setU8((pQuestExt + 0x09) >>> 0, 0)
    }
    if (m.u8((pQuestExt + 0x0a) >>> 0) === 1) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 4)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
    0,
    0,
  )
      m.setU8((pQuestExt + 0x0a) >>> 0, 0)
    }
    return
  }
  if (nClassId === 0x108) {
    if (m.u8((pQuestExt + 0x0b) >>> 0) === 1) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c,
    0,
    0,
  )
      m.setU8((pQuestExt + 0x0b) >>> 0, 0)
    }
  }
}

/**
 * [29/45] Act 3 Quest 2 (`Blade of the Old Religion` / Gidbinn) NPC activate handler: handles Hratli (`0xfd`) and Ormus (`0xff`).
 *
 * @dll D2Game.dll
 * @va 0x6FD06CF0
 * @ordinalOrName D2Game_6FD06CF0
 */
export function ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD06CF0)
  const pTargetUnit = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nClassId = pTargetUnit !== 0 ? m.u16((pTargetUnit + 0x04) >>> 0) : 0xffff
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (nClassId === 0xfd) {
    if (m.u8((pQuestExt + 0x01) >>> 0) === 1) {
      m.setU8((pQuestData + 0x14) >>> 0, 0)
      m.setU8((pQuestData + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c,
    0,
    0,
  )
      m.setU8((pQuestExt + 0x01) >>> 0, 0)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c,
    0,
    0,
  )
    }
    return
  }
  if (nClassId === 0xff) {
    if (m.u8((pQuestExt + 0x07) >>> 0) !== 0) {
      m.setU8((pQuestExt + 0x07) >>> 0, 0)
      m.setU8((pQuestExt + 0x06) >>> 0, 1)
    }
  }
}

/**
 * [30/45] Act 3 Quest 3 (`Khalim's Will`) NPC activate handler: triggers state `1` alert when talking to Cain (`0xf5`).
 *
 * @dll D2Game.dll
 * @va 0x6FD06D90
 * @ordinalOrName D2Game_6FD06D90
 */
export function ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD06D90)
  const pTargetUnit = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pTargetUnit === 0) return
  if (m.u16((pTargetUnit + 0x04) >>> 0) !== 0xf5) return
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestExt + 0x01) >>> 0) !== 1) return
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 1)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c,
    0,
    0,
  )
  m.setU32((pQuestData + 0xa8) >>> 0, 0)
}


/**
 * [31/45] Act 3 Quest 4 (`Lam Esen's Tome`) player-picked-up-item / enter-game handler: checks `'bbb '` count and sends state `2` alert.
 *
 * @dll D2Game.dll
 * @va 0x6FD06F60
 * @ordinalOrName D2Game_6FD06F60
 */
export function ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD06F60)
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const pTome =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32(pQuestArg),
      0x20626262,
    ) >>> 0
  if (pTome === 0) return
  const nCount = (m.u32((pQuestExt + 0x08) >>> 0) + 1) >>> 0
  m.setU32((pQuestExt + 0x08) >>> 0, nCount)
  if (nCount !== 1) return
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  if (m.u8((pQuestExt + 0x05) >>> 0) === 0) return
  m.setU8((pQuestExt + 0x05) >>> 0, 0)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 2)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
    0,
    0,
  )
}

/**
 * [32/45] Act 3 Quest 4 (`Lam Esen's Tome`) item dropped/removed handler: decrements active Tome count and sets state `8` when zeroed.
 *
 * @dll D2Game.dll
 * @va 0x6FD06FE0
 * @ordinalOrName D2Game_6FD06FE0
 */
export function ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  _pQuestArg: number = 0,
): void {
  hitD2GameVa113c(0x6FD06FE0)
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const nRemaining = (m.u32((pQuestExt + 0x08) >>> 0) - 1) >>> 0
  m.setU32((pQuestExt + 0x08) >>> 0, nRemaining)
  if (nRemaining !== 0) return
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  if (m.u8((pQuestExt + 0x02) >>> 0) === 0) return
  if (m.u8((pQuestData + 0x0c) >>> 0) > 3) return
  m.setU8((pQuestExt + 0x05) >>> 0, 1)
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  m.setU8((pQuestData + 0x0b) >>> 0, 8)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
    0,
    0,
  )
}

/**
 * [33/45] Act 3 Sewer Lever (`366`) object operate handler: opens sewer stairs when Khalim's Will lever flag is active.
 *
 * @dll D2Game.dll
 * @va 0x6FD09F60
 * @ordinalOrName D2Game_6FD09F60
 */
export function ACT3Q3_OperateSewerLeverObject_6FD09F60_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FD09F60)
  const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) {
    return 0
  }
  const pGame = m.u32(pOperateArgs) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuestNode = m.u32(pQuestCtrl) >>> 0
  if (pQuestNode === 0) return 0
  while (m.u32(pQuestNode) !== 0x10) {
    pQuestNode = m.u32((pQuestNode + 0xf4) >>> 0) >>> 0
    if (pQuestNode === 0) return 0
  }
  const pQuestExt = m.u32((pQuestNode + 0x18) >>> 0) >>> 0
  if (m.u8(pQuestExt) !== 1) return 0
  const dwStairsObjGuid = m.u32((pQuestExt + 0x04) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x2d3)
  }
  let pStairsObj = m.u32((pGame + 0x1520 + ((dwStairsObjGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pStairsObj !== 0 && (m.u32((pStairsObj + 0x0c) >>> 0) >>> 0) !== dwStairsObjGuid) {
    pStairsObj = m.u32((pStairsObj + 0xe4) >>> 0) >>> 0
  }
  if (pStairsObj === 0) return 0
  UNITS_ChangeAnimMode113c(m, pObject, 1)
  const pObjectsTxt =
    DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0)) >>> 0
  const pGameCur = m.u32(pOperateArgs) >>> 0
  const nFrameDelta = m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8
  const dwCurFrame = m.u32((pGameCur + 0xa8) >>> 0) >>> 0
  EVENT_SetEventFull113c(
    m,
    pGameCur,
    m.u32((pOperateArgs + 0x04) >>> 0),
    1,
    (dwCurFrame + nFrameDelta) >>> 0,
    0,
    0,
    0,
  )
  m.setU32((pQuestExt + 0x08) >>> 0, 2)
  const pGameCur2 = m.u32(pOperateArgs) >>> 0
  EVENT_SetEventFull113c(
    m,
    pGameCur2,
    m.u32((pOperateArgs + 0x04) >>> 0),
    7,
    (m.u32((pGameCur2 + 0xa8) >>> 0) + 0x1e) >>> 0,
    0,
    0,
    0,
  )
  const pGameQuest = m.u32((pQuestNode + 0x04) >>> 0) >>> 0
  const pQuestCtrl2 = m.u32((pGameQuest + 0x10f4) >>> 0) >>> 0
  m.setU8((pQuestCtrl2 + 0x20) >>> 0, 9)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGameQuest,
    QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
    0,
    0,
  )
  return 0
}

/**
 * [34/45] Act 3 Quest 3 (`Khalim's Will`) Khalim's Brain chest operate handler (`'qbr '`).
 *
 * @dll D2Game.dll
 * @va 0x6FD0A390
 * @ordinalOrName D2Game_6FD0A390
 */
export function ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FD0A390)
  if (OBJECTS_OperateContainer_6FC56B90_113c(m, pOperateArgs) === 0) {
    return 0
  }
  const pGame = m.u32(pOperateArgs) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x1fb)
  }
  const seedLo = m.u32((pQuestCtrl + 0x18) >>> 0) >>> 0
  const seedHi = m.u32((pQuestCtrl + 0x1c) >>> 0) >>> 0
  const prod = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pQuestCtrl + 0x1c) >>> 0, newHi)
  m.setU32((pQuestCtrl + 0x18) >>> 0, newLo)
  const nGoldDrops = ((newLo % 5) + 5) | 0
  for (let i = 0; i < nGoldDrops; i = (i + 1) | 0) {
    OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
      m,
      0x20646c67,
      m.u32((pOperateArgs + 0x04) >>> 0),
      m.u32(pOperateArgs),
      2,
    )
  }
  const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  m.setU32((pObject + 0xb8) >>> 0, 0x20726271)
  const pGameCur = m.u32(pOperateArgs) >>> 0
  const pQuestCtrlCur = m.u32((pGameCur + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrlCur !== 0) {
    let pQuestNode = m.u32(pQuestCtrlCur) >>> 0
    while (pQuestNode !== 0 && m.u32(pQuestNode) !== 0x10) {
      pQuestNode = m.u32((pQuestNode + 0xf4) >>> 0) >>> 0
    }
    if (pQuestNode === 0) {
      OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOperateArgs, 4)
      return 0
    }
    const pQuestExt = m.u32((pQuestNode + 0x18) >>> 0) >>> 0
    m.setU32((pQuestExt + 0x0c) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(pOperateArgs),
    ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c,
    0,
    m.u32((pOperateArgs + 0x08) >>> 0),
    )
    const frame = allocW6B6Stack(m, 16)
    try {
      for (let i = 0; i < ((m.u32((pQuestExt + 0x0c) >>> 0) | 0) | 0); i = (i + 1) | 0) {
        const pDropped =
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
            m,
            m.u32(pOperateArgs),
            m.u32((pOperateArgs + 0x04) >>> 0),
            2,
            frame,
            0,
            -1,
            1,
          ) >>> 0
        if (pDropped !== 0) {
          m.setU32((pQuestExt + 0x14) >>> 0, (m.u32((pQuestExt + 0x14) >>> 0) + 1) >>> 0)
          m.setU8((pQuestExt + 0x25) >>> 0, 1)
        }
      }
    } finally {
      freeW6B6Stack(frame)
    }
  }
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOperateArgs, 4)
  return 0
}

/**
 * [35/45] Act 3 Quest 3 (`Khalim's Will`) Khalim's Eye chest operate handler (`'qey '`).
 *
 * @dll D2Game.dll
 * @va 0x6FD0A4C0
 * @ordinalOrName D2Game_6FD0A4C0
 */
export function ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FD0A4C0)
  if (OBJECTS_OperateContainer_6FC56B90_113c(m, pOperateArgs) === 0) {
    return 0
  }
  const pGame = m.u32(pOperateArgs) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x1fb)
  }
  const seedLo = m.u32((pQuestCtrl + 0x18) >>> 0) >>> 0
  const seedHi = m.u32((pQuestCtrl + 0x1c) >>> 0) >>> 0
  const prod = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pQuestCtrl + 0x1c) >>> 0, newHi)
  m.setU32((pQuestCtrl + 0x18) >>> 0, newLo)
  const nGoldDrops = ((newLo % 5) + 5) | 0
  for (let i = 0; i < nGoldDrops; i = (i + 1) | 0) {
    OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
      m,
      0x20646c67,
      m.u32((pOperateArgs + 0x04) >>> 0),
      m.u32(pOperateArgs),
      2,
    )
  }
  const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  m.setU32((pObject + 0xb8) >>> 0, 0x20796571)
  const pGameCur = m.u32(pOperateArgs) >>> 0
  const pQuestCtrlCur = m.u32((pGameCur + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrlCur !== 0) {
    let pQuestNode = m.u32(pQuestCtrlCur) >>> 0
    while (pQuestNode !== 0 && m.u32(pQuestNode) !== 0x10) {
      pQuestNode = m.u32((pQuestNode + 0xf4) >>> 0) >>> 0
    }
    if (pQuestNode === 0) {
      OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOperateArgs, 4)
      return 0
    }
    const pQuestExt = m.u32((pQuestNode + 0x18) >>> 0) >>> 0
    m.setU32((pQuestExt + 0x0c) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(pOperateArgs),
    ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c,
    0,
    m.u32((pOperateArgs + 0x08) >>> 0),
    )
    const frame = allocW6B6Stack(m, 16)
    try {
      for (let i = 0; i < ((m.u32((pQuestExt + 0x0c) >>> 0) | 0) | 0); i = (i + 1) | 0) {
        const pDropped =
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
            m,
            m.u32(pOperateArgs),
            m.u32((pOperateArgs + 0x04) >>> 0),
            2,
            frame,
            0,
            -1,
            1,
          ) >>> 0
        if (pDropped !== 0) {
          m.setU32((pQuestExt + 0x10) >>> 0, (m.u32((pQuestExt + 0x10) >>> 0) + 1) >>> 0)
          m.setU8((pQuestExt + 0x24) >>> 0, 1)
        }
      }
    } finally {
      freeW6B6Stack(frame)
    }
  }
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOperateArgs, 4)
  return 0
}


/**
 * [36/45] Act 3 Quest 3 (`Khalim's Will`) Khalim's Heart chest operate handler (`'qhr '`).
 *
 * @dll D2Game.dll
 * @va 0x6FD0A5F0
 * @ordinalOrName D2Game_6FD0A5F0
 */
export function ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FD0A5F0)
  if (OBJECTS_OperateContainer_6FC56B90_113c(m, pOperateArgs) === 0) {
    return 0
  }
  const pGame = m.u32(pOperateArgs) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x1fb)
  }
  const seedLo = m.u32((pQuestCtrl + 0x18) >>> 0) >>> 0
  const seedHi = m.u32((pQuestCtrl + 0x1c) >>> 0) >>> 0
  const prod = BigInt(seedLo) * 0x6ac690c5n + BigInt(seedHi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pQuestCtrl + 0x1c) >>> 0, newHi)
  m.setU32((pQuestCtrl + 0x18) >>> 0, newLo)
  const nGoldDrops = ((newLo % 5) + 5) | 0
  for (let i = 0; i < nGoldDrops; i = (i + 1) | 0) {
    OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
      m,
      0x20646c67,
      m.u32((pOperateArgs + 0x04) >>> 0),
      m.u32(pOperateArgs),
      2,
    )
  }
  const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  m.setU32((pObject + 0xb8) >>> 0, 0x20726871)
  const pGameCur = m.u32(pOperateArgs) >>> 0
  const pQuestCtrlCur = m.u32((pGameCur + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrlCur !== 0) {
    let pQuestNode = m.u32(pQuestCtrlCur) >>> 0
    while (pQuestNode !== 0 && m.u32(pQuestNode) !== 0x10) {
      pQuestNode = m.u32((pQuestNode + 0xf4) >>> 0) >>> 0
    }
    if (pQuestNode === 0) {
      OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOperateArgs, 4)
      return 0
    }
    const pQuestExt = m.u32((pQuestNode + 0x18) >>> 0) >>> 0
    m.setU32((pQuestExt + 0x0c) >>> 0, 0)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32(pOperateArgs),
    ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c,
    0,
    m.u32((pOperateArgs + 0x08) >>> 0),
    )
    const frame = allocW6B6Stack(m, 16)
    try {
      for (let i = 0; i < ((m.u32((pQuestExt + 0x0c) >>> 0) | 0) | 0); i = (i + 1) | 0) {
        const pDropped =
          ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
            m,
            m.u32(pOperateArgs),
            m.u32((pOperateArgs + 0x04) >>> 0),
            2,
            frame,
            0,
            -1,
            1,
          ) >>> 0
        if (pDropped !== 0) {
          m.setU32((pQuestExt + 0x18) >>> 0, (m.u32((pQuestExt + 0x18) >>> 0) + 1) >>> 0)
          m.setU8((pQuestExt + 0x26) >>> 0, 1)
        }
      }
    } finally {
      freeW6B6Stack(frame)
    }
  }
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOperateArgs, 4)
  return 0
}

/**
 * [37/45] Act 3 Compelling Orb smashed effect: corrupts nearby monsters with UMod `21` and fires projectile `0x15b`.
 *
 * @dll D2Game.dll
 * @va 0x6FD0A930
 * @ordinalOrName D2Game_6FD0A930
 */
export function ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c(
  m: D2KernMemory113c,
  pCenterUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD0A930)
  const ppDataTables = m.u32(0x6fd1829c) >>> 0
  const pDataTables = ppDataTables !== 0 ? m.u32(ppDataTables) >>> 0 : 0
  let pMonRec = 0
  if (pDataTables !== 0 && ((m.u32((pDataTables + 0xb6c) >>> 0) | 0) | 0) > 0x15b) {
    pMonRec = (m.u32((pDataTables + 0xb64) >>> 0) + 0x2394c) >>> 0
  }
  let nMaxDelay = (((m.u16((pMonRec + 0x96) >>> 0) << 16) >> 16) - 0x64) | 0
  if (nMaxDelay < 0x64) {
    nMaxDelay = 0x64
  }
  QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c(
    m,
    pGame,
    pCenterUnit,
    0x23,
    0x28,
    nMaxDelay,
    0,
  )
  const nTypeY = (m.u32(pCenterUnit) | 0)
  const pPathOrStaticY = m.u32((pCenterUnit + 0x2c) >>> 0) >>> 0
  let nPosY = 0
  if (nTypeY === 2 || (nTypeY > 3 && nTypeY <= 5)) {
    nPosY = (m.u32((pPathOrStaticY + 0x10) >>> 0) | 0)
  } else if (pPathOrStaticY !== 0) {
    nPosY = PATH_GetPosY113c(m, pPathOrStaticY)
  }
  const nTypeX = (m.u32(pCenterUnit) | 0)
  const pPathOrStaticX = m.u32((pCenterUnit + 0x2c) >>> 0) >>> 0
  let nPosX = 0
  if (nTypeX === 2 || (nTypeX > 3 && nTypeX <= 5)) {
    nPosX = (m.u32((pPathOrStaticX + 0x0c) >>> 0) | 0)
  } else if (pPathOrStaticX !== 0) {
    nPosX = PATH_GetPosX113c(m, pPathOrStaticX)
  }
  SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
    m,
    pCenterUnit,
    pGame,
    0,
    1,
    0x15b,
    nPosX,
    nPosY,
  )
}

/**
 * [38/45] Pandemonium Event (Uber Tristram) boss death handler (`0x2c0`, `0x2c1`, `0x2c5`): drops Hellfire Torch (`'cm2 '`) and Standards of Heroes (`'std '`).
 *
 * @dll D2Game.dll
 * @va 0x6FD0AA30
 * @ordinalOrName D2Game_6FD0AA30
 */
export function QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pBossUnit: number,
): void {
  hitD2GameVa113c(0x6FD0AA30)
  const nClassId = pBossUnit !== 0 ? (m.u32((pBossUnit + 0x04) >>> 0) | 0) : -1
  if (nClassId === 0x2c0) {
    m.setU32((pGame + 0x1df0) >>> 0, 1)
  } else if (nClassId === 0x2c1) {
    m.setU32((pGame + 0x1dec) >>> 0, 1)
  } else if (nClassId === 0x2c5) {
    m.setU32((pGame + 0x1de8) >>> 0, 1)
  } else {
    throw new D2CommonAssertError('ItemMode.cpp', 0xe6)
  }
  if (
    m.u32((pGame + 0x1df0) >>> 0) === 0 ||
    m.u32((pGame + 0x1dec) >>> 0) === 0 ||
    m.u32((pGame + 0x1de8) >>> 0) === 0
  ) {
    return
  }
  const frame = allocW6B6Stack(m, 16)
  try {
    m.setU32((pBossUnit + 0xb8) >>> 0, 0x20326d63)
    const pTorch =
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
        m,
        pGame,
        pBossUnit,
        7,
        frame,
        0,
        -1,
        0,
      ) >>> 0
    ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(m, pGame, 0, pTorch)
    m.setU32((pBossUnit + 0xb8) >>> 0, 0x20647473)
    const nNumPlayers = (m.u32((pGame + 0x8c) >>> 0) | 0) | 0
    for (let i = 0; i < nNumPlayers; i = (i + 1) | 0) {
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(m, pGame, pBossUnit, 2, frame, 0, -1, 0)
    }
  } finally {
    freeW6B6Stack(frame)
  }
}

/**
 * [39/45] Allocates 1 stat point into Strength (`0`), Energy (`1`), Dexterity (`2`), or Vitality (`3`) if `statpts > 0`.
 *
 * @dll D2Game.dll
 * @va 0x6FD0AEE0
 * @ordinalOrName D2Game_6FD0AEE0
 */
export function PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  nStatId: number,
): number {
  hitD2GameVa113c(0x6FD0AEE0)
  if (STATLIST_GetUnitStat113c(m, pPlayerUnit, 4, 0) === 0) {
    return 0
  }
  if ((nStatId >>> 0) > 3) {
    return 0
  }
  switch (nStatId >>> 0) {
    case 0:
      STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 4, -1, 0)
      STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 0, 1, 0)
      UNITROOM_RefreshUnit113c(m, pPlayerUnit)
      return 1
    case 1:
      PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c(m, 1, pPlayerUnit)
      return 1
    case 2:
      STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 4, -1, 0)
      STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 2, 1, 0)
      UNITROOM_RefreshUnit113c(m, pPlayerUnit)
      return 1
    case 3:
      PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c(m, 1, pPlayerUnit)
      return 1
    default:
      return 0
  }
}

/**
 * [40/45] Resets a player's base Strength, Energy, Dexterity, and Vitality back to `CharStats.txt` starting values and refunds `statpts`.
 *
 * @dll D2Game.dll
 * @va 0x6FD0AF80
 * @ordinalOrName D2Game_6FD0AF80
 */
export function PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FD0AF80)
  if (pPlayerUnit === 0) return
  if (m.u32(pPlayerUnit) !== 0) return
  const nClass = (m.u32((pPlayerUnit + 0x04) >>> 0) | 0)
  if (nClass < 0) return
  const ppDataTables = m.u32(0x6fd1829c) >>> 0
  const pDataTables = ppDataTables !== 0 ? m.u32(ppDataTables) >>> 0 : 0
  if (pDataTables === 0 || nClass >= ((m.u32((pDataTables + 0xbc8) >>> 0) | 0) | 0)) return
  const pCharStatsBase = m.u32((pDataTables + 0xbc4) >>> 0) >>> 0
  const pCharStats = (pCharStatsBase + nClass * 0xc4) >>> 0
  if (pCharStats === 0) return
  const nDeltaStr =
    (m.u8((pCharStats + 0x30) >>> 0) - STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 0, 0)) | 0
  if (nDeltaStr !== 0) {
    STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 4, -nDeltaStr | 0, 0)
    STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 0, nDeltaStr, 0)
    UNITROOM_RefreshUnit113c(m, pPlayerUnit)
  }
  const nDeltaEnr =
    (m.u8((pCharStats + 0x32) >>> 0) - STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 1, 0)) | 0
  PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c(m, nDeltaEnr, pPlayerUnit)
  const nDeltaDex =
    (m.u8((pCharStats + 0x31) >>> 0) - STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 2, 0)) | 0
  if (nDeltaDex !== 0) {
    STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 4, -nDeltaDex | 0, 0)
    STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 2, nDeltaDex, 0)
    UNITROOM_RefreshUnit113c(m, pPlayerUnit)
  }
  const nDeltaVit =
    (m.u8((pCharStats + 0x33) >>> 0) - STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 3, 0)) | 0
  PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c(m, nDeltaVit, pPlayerUnit)
}


/**
 * [41/45] Levels up a player unit based on current experience, granting life, mana, stamina, `statpts`, and `newskills`.
 *
 * @dll D2Game.dll
 * @va 0x6FD0B090
 * @ordinalOrName PLAYER_LevelUp
 */
export function PLAYER_LevelUp_6FD0B090_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
  onLevelUpCallback?: (
    m: D2KernMemory113c,
    pfnCallback: number,
    wGameId: number,
    pPlayerName: number,
    nClass: number,
    nNewLevel: number,
  ) => void,
): void {
  hitD2GameVa113c(0x6FD0B090)
  const nClass = pPlayerUnit !== 0 ? (m.u32((pPlayerUnit + 0x04) >>> 0) | 0) : -1
  const nOldLevel = STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 0x0c, 0) | 0
  const dwExp = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0x0d, 0) >>> 0
  const nNewLevel = DATATBLS_GetCurrentLevelFromExp113c(m, nClass, dwExp) | 0
  STATLIST_SetUnitStat113c(m, pPlayerUnit, 0x0c, nNewLevel, 0)
  const dwNextExp = DATATBLS_GetStartExpForLevel113c(m, nClass, nNewLevel) >>> 0
  STATLIST_SetUnitStat113c(m, pPlayerUnit, 0x1e, dwNextExp, 0)
  const nLevelsGained = (nNewLevel - nOldLevel) | 0
  if (nLevelsGained <= 0) return
  let pCharStats = 0
  if (nClass >= 0) {
    const ppDataTables = m.u32(0x6fd1829c) >>> 0
    const pDataTables = ppDataTables !== 0 ? m.u32(ppDataTables) >>> 0 : 0
    if (pDataTables !== 0 && nClass < ((m.u32((pDataTables + 0xbc8) >>> 0) | 0) | 0)) {
      pCharStats = (m.u32((pDataTables + 0xbc4) >>> 0) + nClass * 0xc4) >>> 0
    }
  }
  const nCurMaxLife = STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 7, 0) | 0
  const nLifeGain = ((m.u8((pCharStats + 0x43) >>> 0) * nLevelsGained) << 6) | 0
  STATLIST_SetUnitStat113c(m, pPlayerUnit, 7, (nCurMaxLife + nLifeGain) | 0, 0)
  const nMaxLifeTotal = STATLIST_GetMaxLifeFromUnit113c(m, pPlayerUnit) | 0
  if ((STATLIST_GetUnitStat113c(m, pPlayerUnit, 6, 0) | 0) > 0) {
    STATLIST_SetUnitStat113c(m, pPlayerUnit, 6, nMaxLifeTotal, 0)
  }
  const nCurMaxMana = STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 9, 0) | 0
  const nManaGain = ((m.u8((pCharStats + 0x45) >>> 0) * nLevelsGained) << 6) | 0
  STATLIST_SetUnitStat113c(m, pPlayerUnit, 9, (nCurMaxMana + nManaGain) | 0, 0)
  const nMaxManaTotal = STATLIST_GetMaxManaFromUnit113c(m, pPlayerUnit) | 0
  STATLIST_SetUnitStat113c(m, pPlayerUnit, 8, nMaxManaTotal, 0)
  const nCurMaxStam = STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 0x0b, 0) | 0
  const nStamGain = ((m.u8((pCharStats + 0x44) >>> 0) * nLevelsGained) << 6) | 0
  STATLIST_SetUnitStat113c(m, pPlayerUnit, 0x0b, (nCurMaxStam + nStamGain) | 0, 0)
  const nMaxStamTotal = STATLIST_GetMaxStaminaFromUnit113c(m, pPlayerUnit) | 0
  STATLIST_SetUnitStat113c(m, pPlayerUnit, 0x0a, nMaxStamTotal, 0)
  const nStatPtsPerLvl = ((m.u8((pCharStats + 0x50) >>> 0) << 24) >> 24)
  STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 4, (nStatPtsPerLvl * nLevelsGained) | 0, 0)
  STATLIST_AddUnitStatMemPort113c(m, pPlayerUnit, 5, nLevelsGained, 0)
  NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c(m, pGame, nNewLevel >>> 0)
  if (pPlayerUnit === 0) {
    throw new D2CommonAssertError('ItemMode.cpp', 0x558)
  }
  m.setU16((pPlayerUnit + 0x6e) >>> 0, 2)
  m.setU32((pPlayerUnit + 0x70) >>> 0, pPlayerUnit >>> 0)
  UNITROOM_RefreshUnit113c(m, pPlayerUnit)
  m.setU32((pPlayerUnit + 0xc4) >>> 0, (m.u32((pPlayerUnit + 0xc4) >>> 0) | 0x400) >>> 0)
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    PARTY_SendRosterUpdateCallback_6FD0B070_113c,
    pPlayerUnit,
  )
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c(m, pPlayerUnit)
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlayerUnit, 0)
  UNITS_SetUnitUpdateFlags113c(m, pPlayerUnit, 1)
  let pCallbackTable = 0
  try {
    pCallbackTable = m.u32(0x6fd31c3c) >>> 0
  } catch {
    pCallbackTable = 0
  }
  if (pCallbackTable !== 0) {
    const pfnCallback = m.u32((pCallbackTable + 0x2c) >>> 0) >>> 0
    if (pfnCallback !== 0) {
      const pPlayerName = UNITS_GetPlayerName113c(m, pPlayerUnit) >>> 0
      const wGameId = m.u16((pGame + 0x28) >>> 0)
      if (onLevelUpCallback !== undefined) {
        onLevelUpCallback(m, pfnCallback, wGameId, pPlayerName, nClass, nNewLevel)
      }
    }
  }
}

/**
 * [42/45] Serializes a player's most valuable corpse and its inventory items into the `.d2s` save buffer (`'JM'` corpse section).
 *
 * @dll D2Game.dll
 * @va 0x6FD0C260
 * @ordinalOrName D2Game_6FD0C260
 */
export function PLAYERSAVE_WriteCorpseSection_6FD0C260_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  ppIoBuf: number,
  pBufEnd: number,
  arg4: number,
  arg5: number,
): number {
  hitD2GameVa113c(0x6FD0C260)
  let pWritePos = m.u32(ppIoBuf >>> 0) >>> 0
  const pInventory = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return 2
  }
  let pCorpseRecord = INVENTORY_GetFirstCorpse113c(m, pInventory) >>> 0
  let pBestCorpseUnit = 0
  let dwBestGoldValue = 0
  while (pCorpseRecord !== 0) {
    const dwCorpseUnitGuid = INVENTORY_GetCorpseUnitId113c(m, pCorpseRecord) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('ItemMode.cpp', 0x2d3)
    }
    let pCorpseUnit = m.u32((pGame + 0x1120 + ((dwCorpseUnitGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pCorpseUnit !== 0 && (m.u32((pCorpseUnit + 0x0c) >>> 0) >>> 0) !== dwCorpseUnitGuid) {
      pCorpseUnit = m.u32((pCorpseUnit + 0xe4) >>> 0) >>> 0
    }
    if (pCorpseUnit !== 0) {
      const pCorpseInv = m.u32((pCorpseUnit + 0x60) >>> 0) >>> 0
      if (pCorpseInv !== 0 && (INVENTORY_GetItemCount113c(m, pCorpseInv) >>> 0) > 0) {
        let pItem = INVENTORY_GetFirstItem113c(m, pCorpseInv) >>> 0
        let dwCorpseValue = 1
        while (pItem !== 0) {
          const pValidItem = INVENTORY_UnitIsItem113c(m, pItem) >>> 0
          if (ITEMS_CheckItemTypeIdMemPort113c(m, pValidItem, 4) === 0) {
            const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
            const nDiff = m.u8((pGame + 0x6d) >>> 0)
            const pQuestRec = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
            dwCorpseValue =
              (dwCorpseValue +
                ITEMS_GetTransactionCost113c(m, pPlayer, pValidItem, 3, pQuestRec, 0x201, 0)) >>>
              0
          }
          pItem = INVENTORY_GetNextItem113c(m, pItem) >>> 0
        }
        if (dwCorpseValue >= dwBestGoldValue) {
          dwBestGoldValue = dwCorpseValue
          pBestCorpseUnit = pCorpseUnit
        }
      }
    }
    pCorpseRecord = INVENTORY_GetNextCorpse113c(m, pCorpseRecord) >>> 0
  }
  const nCorpseCount = pBestCorpseUnit !== 0 ? 1 : 0
  if ((pWritePos + 4) >>> 0 > pBufEnd >>> 0) {
    return 1
  }
  m.setU16(pWritePos, 0x4d4a)
  pWritePos = (pWritePos + 2) >>> 0
  m.setU16(pWritePos, nCorpseCount & 0xffff)
  pWritePos = (pWritePos + 2) >>> 0
  if (pBestCorpseUnit !== 0 && (nCorpseCount & 0xffff) !== 0) {
    const pAfterCorpseHdr = (pWritePos + 0x0c) >>> 0
    if (pAfterCorpseHdr > pBufEnd >>> 0) {
      return 1
    }
    const nCorpseX = UNIT_GetPosX113c(m, pBestCorpseUnit)
    const nCorpseY = UNIT_GetPosY113c(m, pBestCorpseUnit)
    m.setU32(pWritePos, 0)
    m.setU32((pWritePos + 4) >>> 0, nCorpseX >>> 0)
    m.setU32((pWritePos + 8) >>> 0, nCorpseY >>> 0)
    const frame = allocW6B6Stack(m, 16)
    try {
      m.setU32(frame, pAfterCorpseHdr)
      const nErr = PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c(
        m,
        pBufEnd,
        arg5,
        arg4,
        frame,
        pGame,
        pBestCorpseUnit,
        0,
      )
      if (nErr !== 0) {
        return 4
      }
      pWritePos = m.u32(frame) >>> 0
    } finally {
      freeW6B6Stack(frame)
    }
  }
  m.setU32(ppIoBuf >>> 0, pWritePos)
  return 0
}

/**
 * [43/45] Populates and writes the 335-byte (`0x14f`) `.d2s` v96 (`0x60`) header (`0xaa55aa55`) into the save buffer.
 *
 * @dll D2Game.dll
 * @va 0x6FD0C470
 * @ordinalOrName D2Game_6FD0C470
 */
export function PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
  ppIoBuf: number,
  pBufEnd: number,
): number {
  hitD2GameVa113c(0x6FD0C470)
  const pWritePos = m.u32(ppIoBuf >>> 0) >>> 0
  if (pPlayerUnit === 0 || m.u32(pPlayerUnit) !== 0) {
    return 2
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  if (pClient === 0) {
    return 2
  }
  let nameLen = 0
  while (nameLen < 16 && m.u8((pClient + 0x0d + nameLen) >>> 0) !== 0) {
    nameLen = (nameLen + 1) | 0
  }
  if (nameLen >= 16 || nameLen < 1) {
    return 2
  }
  const pNextPos = (pWritePos + 0x14f) >>> 0
  if (pNextPos > pBufEnd >>> 0) {
    return 1
  }
  const frame = allocW6B6Stack(m, 0x170)
  const hdr = (frame + 0x10) >>> 0
  const pSubType = frame
  const pSubGuid = (frame + 4) >>> 0
  try {
    m.setU32(hdr, 0xaa55aa55)
    m.setU32((hdr + 0x04) >>> 0, 0x60)
    for (let i = 0; i < 16; i = (i + 1) | 0) {
      const ch = m.u8((pClient + 0x0d + i) >>> 0)
      m.setU8((hdr + 0x14 + i) >>> 0, ch)
      if (ch === 0) break
    }
    let dwFlags = m.u16((pClient + 0x0a) >>> 0)
    if (m.u32((pGame + 0x70) >>> 0) !== 0) {
      dwFlags |= 0x20
    }
    if (m.u32((pGame + 0x74) >>> 0) !== 0) {
      dwFlags |= 0x40
    }
    m.setU32((hdr + 0x24) >>> 0, dwFlags >>> 0)
    m.setU8((hdr + 0x28) >>> 0, CLIENTS_GetClientByte08_6FC69BF0_113c(m, pClient) & 0xff)
    m.setU8((hdr + 0x2b) >>> 0, STATLIST_GetUnitStat113c(m, pPlayerUnit, 0x0c, 0) & 0xff)
    m.setU32((hdr + 0x2c) >>> 0, CLIENTS_GetClientField488_6FC69AB0_113c(m, pClient) >>> 0)
    m.setU32((hdr + 0x30) >>> 0, 0)
    m.setU32((hdr + 0xab) >>> 0, m.u32((pGame + 0x7c) >>> 0))
    m.setU32((hdr + 0x34) >>> 0, 0xffffffff)
    m.setU8((hdr + 0x29) >>> 0, 0x10)
    const ppDataTables = m.u32(0x6fd1829c) >>> 0
    const pDataTables = ppDataTables !== 0 ? m.u32(ppDataTables) >>> 0 : 0
    m.setU8(
      (hdr + 0x2a) >>> 0,
      pDataTables !== 0 ? m.u8((pDataTables + 0xba8) >>> 0) : 0,
    )
    const pClientCur =
      m.u32(pPlayerUnit) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) >>> 0) >>> 0
        : 0
    if (pClientCur !== 0 && m.u8((pClientCur + 0x45c) >>> 0) !== 0) {
      m.setU32((hdr + 0x10) >>> 0, (m.u32((hdr + 0x10) >>> 0) | 1) >>> 0)
    }
    for (let i = 0; i < 16; i = (i + 1) | 0) {
      const pSlot = (pClient + 0x3de + i * 8) >>> 0
      const nSkillId = ((m.u16((pSlot - 2) >>> 0) << 16) >> 16)
      const dwItemGuid = m.u32((pSlot + 2) >>> 0) >>> 0
      const bLeft = m.u8(pSlot)
      if (nSkillId >= 0x8000) {
        throw new D2CommonAssertError('ItemMode.cpp', 0x1eb)
      }
      const wEncoded = ((bLeft !== 0 ? 0x8000 : 0) | (nSkillId & 0xffff)) & 0xffff
      m.setU16((hdr + 0x38 + i * 4) >>> 0, wEncoded)
      const wIdx =
        PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(m, pPlayerUnit, dwItemGuid) & 0xffff
      m.setU16((hdr + 0x3a + i * 4) >>> 0, wIdx)
    }
    const pLeftSkill = UNITS_GetLeftSkill113c(m, pPlayerUnit) >>> 0
    if (pLeftSkill !== 0) {
      const wLeftId = SKILLS_GetSkillIdFromSkill113c(m, pLeftSkill, 0x6fd19fd4, 0x1f5) & 0xffff
      m.setU16((hdr + 0x78) >>> 0, wLeftId)
      const dwLeftOwner = SKILLS_GetOwnerItemGuid113c(m, pLeftSkill) >>> 0
      m.setU16(
        (hdr + 0x7a) >>> 0,
        PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(m, pPlayerUnit, dwLeftOwner) & 0xffff,
      )
    }
    const pRightSkill = UNITS_GetRightSkill113c(m, pPlayerUnit) >>> 0
    const wRightId = SKILLS_GetSkillIdFromSkill113c(m, pRightSkill, 0x6fd19fd4, 0x1fc) & 0xffff
    m.setU16((hdr + 0x7c) >>> 0, wRightId)
    const dwRightOwner = SKILLS_GetOwnerItemGuid113c(m, pRightSkill) >>> 0
    m.setU16(
      (hdr + 0x7e) >>> 0,
      PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(m, pPlayerUnit, dwRightOwner) & 0xffff,
    )
    UNITS_GetPlayerSubtargetRight113c(m, pPlayerUnit, pSubType, pSubGuid)
    m.setU16((hdr + 0x80) >>> 0, m.u16(pSubType))
    m.setU16(
      (hdr + 0x82) >>> 0,
      PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(m, pPlayerUnit, m.u32(pSubGuid)) &
        0xffff,
    )
    UNITS_GetPlayerSubtargetLeft113c(m, pPlayerUnit, pSubType, pSubGuid)
    m.setU16((hdr + 0x84) >>> 0, m.u16(pSubType))
    m.setU16(
      (hdr + 0x86) >>> 0,
      PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c(m, pPlayerUnit, m.u32(pSubGuid)) &
        0xffff,
    )
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    m.setU8((hdr + 0xa8 + nDiff) >>> 0, (m.u8((pClient + 0x1ac) >>> 0) | 0x80) & 0xff)
    for (let i = 0; i < 8; i = (i + 1) | 0) {
      m.setU32((hdr + 0x88 + i * 4) >>> 0, 0xffffffff)
    }
    INVENTORY_UpdateEquippedGfxAndColor113c(
      m,
      pPlayerUnit,
      (hdr + 0x88) >>> 0,
      (hdr + 0x98) >>> 0,
    )
    PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c(m, pGame, pPlayerUnit, hdr)
    m.setU8((hdr + 0xcf) >>> 0, m.u8((pClient + 0x480) >>> 0))
    for (let i = 0; i < 0x14f; i = (i + 1) | 0) {
      m.setU8((pWritePos + i) >>> 0, m.u8((hdr + i) >>> 0))
    }
  } finally {
    freeW6B6Stack(frame)
  }
  m.setU32(ppIoBuf >>> 0, pNextPos)
  return 0
}

/**
 * [44/45] Spawns a preset monster pack table (`pPackTable`) at `(nBaseX, nBaseY)` using 6 spawn-mode cases (`0..5`).
 *
 * @dll D2Game.dll
 * @va 0x6FD0F940
 * @ordinalOrName D2Game_6FD0F940
 */
export function MONSTER_SpawnPresetPackTable_6FD0F940_113c(
  m: D2KernMemory113c,
  pPackTable: number,
  pRoom: number,
  pGame: number,
  nBaseX: number,
  nBaseY: number,
  nBaseClassId: number,
  pOwnerUnit: number,
  nDefaultMode: number,
  dwSpawnFlags: number,
): number {
  hitD2GameVa113c(0x6FD0F940)
  const bIncrementClassId = (m.u8((pPackTable + 0x08) >>> 0) & 1) !== 0 ? 1 : 0
  const bForceCase4 = (dwSpawnFlags & 1) !== 0 ? 1 : 0
  const nCount = (m.u32(pPackTable) | 0) | 0
  let bSpawnedAny = 0
  let pLastLeader = 0
  let nCurClassId = nBaseClassId | 0
  let pEntry = pPackTable >>> 0
  for (let i = 0; i < nCount; i = (i + 1) | 0) {
    pEntry = (pEntry + 0x0c) >>> 0
    const nCase = bForceCase4 !== 0 ? 4 : m.u32((pEntry + 0x08) >>> 0) >>> 0
    const nSpawnX = ((m.u32(pEntry) | 0) + (nBaseX | 0)) | 0
    const nSpawnY = ((m.u32((pEntry + 0x04) >>> 0) | 0) + (nBaseY | 0)) | 0
    switch (nCase) {
      case 0: {
        const pSpawned =
          MONSTER_SpawnAtCoords113c(
            m,
            nCurClassId,
            nDefaultMode,
            pGame,
            pRoom,
            nSpawnX,
            nSpawnY,
            -1,
            dwSpawnFlags,
          ) >>> 0
        if (pSpawned !== 0) {
          bSpawnedAny = 1
        }
        break
      }
      case 1: {
        const pSpawned =
          MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c(
            m,
            nCurClassId,
            nDefaultMode,
            pRoom,
            pGame,
            nSpawnX,
            nSpawnY,
            -1,
            0,
            0,
          ) >>> 0
        pLastLeader = pSpawned
        if (pSpawned !== 0) {
          bSpawnedAny = 1
        }
        break
      }
      case 2: {
        const pSpawned =
          MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c(
            m,
            nCurClassId,
            nDefaultMode,
            pRoom,
            pGame,
            nSpawnX,
            nSpawnY,
            -1,
            1,
            0,
          ) >>> 0
        pLastLeader = pSpawned
        if (pSpawned !== 0) {
          bSpawnedAny = 1
        }
        break
      }
      case 3: {
        if (pLastLeader !== 0) {
          const pSpawned =
            MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c(
              m,
              1,
              pGame,
              pLastLeader,
              nSpawnX,
              nSpawnY,
              nCurClassId,
              nDefaultMode,
              -1,
              0,
            ) >>> 0
          if (pSpawned !== 0) {
            bSpawnedAny = 1
          }
        }
        break
      }
      case 4: {
        const pSpawned =
          MONSTER_SpawnAtCoords113c(
            m,
            nCurClassId,
            nDefaultMode,
            pGame,
            pRoom,
            nSpawnX,
            nSpawnY,
            -1,
            dwSpawnFlags,
          ) >>> 0
        if (pSpawned === 0) {
          return 0
        }
        bSpawnedAny = 1
        break
      }
      case 5: {
        if (pOwnerUnit !== 0) {
          const pSpawned =
            MONSTER_SpawnAtCoords113c(
              m,
              nCurClassId,
              nDefaultMode,
              pGame,
              pRoom,
              nSpawnX,
              nSpawnY,
              -1,
              0,
            ) >>> 0
          if (pSpawned !== 0) {
            const dwOwnerType = m.u32(pOwnerUnit) >>> 0
            const dwOwnerGuid = m.u32((pOwnerUnit + 0x0c) >>> 0) >>> 0
            if (m.u32(pSpawned) === 1) {
              const pMonData = m.u32((pSpawned + 0x14) >>> 0) >>> 0
              const pAiGeneral = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
              m.setU32((pAiGeneral + 0x2c) >>> 0, dwOwnerGuid)
              m.setU32((pAiGeneral + 0x30) >>> 0, dwOwnerType)
              m.setU32((pAiGeneral + 0x28) >>> 0, pGame >>> 0)
            }
            bSpawnedAny = 1
          }
        }
        break
      }
      default:
        break
    }
    if (bIncrementClassId !== 0) {
      nCurClassId = (nCurClassId + 1) | 0
    }
  }
  return bSpawnedAny
}

/**
 * [45/45] Removes a player's relation nodes from all living players and frees its `pPlayerData + 0x38` relation list.
 *
 * @dll D2Game.dll
 * @va 0x6FD10390
 * @ordinalOrName D2Game_6FD10390
 */
export function PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD10390)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c,
    pPlayerUnit,
  )
  let pNode = m.u32((pPlayerData + 0x38) >>> 0) >>> 0
  while (pNode !== 0) {
    m.u32((pGame + 0x1c) >>> 0)
    const pNext = m.u32((pNode + 0x10) >>> 0) >>> 0
    pNode = pNext
  }
  m.setU32((pPlayerData + 0x38) >>> 0, 0)
}
