/**
 * D2Game.dll 1.13c — [K2] Wave 13 Batch 1 (w13b1).
 *
 * Clean-room 1:1 binary-isomorphic port of 44 D2Game.dll v1.13c functions in
 * the 0x6FC3E3D0..0x6FD095E0 address range.
 */

import { COLLISION_FindFreePositionBasic113c } from '../common/collision'
import {
  UNITS_GetObjectPortalFlags113c,
  UNITS_GetObjectTxt113c,
  UNITS_GetPlayerData113c,
  UNITS_SetObjectPortalFlags113c,
} from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_FindLevelSpawnRoom113c,
  DUNGEON_FindRoomBySubtileCoordinates113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordListIndexAtSubtile113c,
  DUNGEON_IsTownLevelId113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32 } from '../common/int-math'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_AutoPlaceItemInGrid113c,
  INVENTORY_CanAutoEquipItem113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemCount113c,
  INVENTORY_GetItemGridXIfInInventory113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_GetSwapWeaponItem113c,
  INVENTORY_NoOpRet20113c,
  INVENTORY_NoOpRet8B113c,
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_PlaceItemInGridCell113c,
  INVENTORY_PlaceItemInSocket113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UpdateWeaponGuidOnInsert113c,
  INVENTORY_UpdateWeaponGuidOnRemoval113c,
  UNITS_GetInventoryRecordId113c,
  UNITS_SetStaticPathPosX113c,
  UNITS_SetStaticPathPosY113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_ApplySinglePropAndEthereal113c,
  ITEMS_CanItemBeAutoBeltOrStacked113c,
  ITEMS_CanItemBeRepairedByNpc113c,
  ITEMS_CanItemBeShownInTradeOrStash113c,
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckRequirements113c,
  ITEMS_GetActiveWeaponClassCodeIdx113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemLevel113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_GetMaxSocketsFromItemType113c,
  ITEMS_GetMissileWeaponVelocity113c,
  ITEMS_GetStorePage113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_GetTransactionCost113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_IsAutoStack113c,
  ITEMS_NoOpReturnZero113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetCmdFlagsByte113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetItemQuality113c,
  ITEMS_SetMagicPrefix113c,
  ITEMS_SetNodePage113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOrClearFlagMask113c,
  ITEMS_SetRarePrefix113c,
  ITEMS_SetRareSuffix113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_SetStepNum113c,
} from '../common/path'
import {
  HIRELING_GetActIndex113c,
  UNITS_GetLeftSkill113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetFirstSkillFromSkillList113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetLeftSkillFromSkillList113c,
  SKILLS_GetNextSkill113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillNumTargetsOrShots113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../common/skills'
import {
  DUNGEON_GetActLevelId113c,
  HIRELING_RollAndPopulateStatsEntry113c,
  ITEMMODS_UpdateSetItemEquipmentState113c,
  STATES_CheckState113c,
  STATES_CheckStateMask4OnUnit113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxDurabilityFromUnit113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetStatListFromUnitStateOrFlag113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_Alloc113c,
  UNITROOM_RefreshUnit113c,
  UNITS_AllocStaticPath113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNITS_SetInteractItem113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit'
import {
  WAYPOINT_GetWaypointNoFromLevelId113c,
  WAYPOINT_GetWaypointState113c,
} from '../common/waypoint'
import type { SparseMemory113c } from '../mem/sparse-memory'
import { DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c } from './k2-w10b1-113c'
import {
  AI_PetMoveActionDispatch_6FC3CAE0_113c,
  type PetMoveActionOps113c,
} from './k2-w11b1-113c'
import {
  ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c,
  ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c,
  AI_FollowOwnerOrTeleportIfFar_6FC3E140_113c,
  C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c,
  HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c,
  ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c,
  ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c,
  ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c,
  OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c,
  PLAYER_ChangeLevelOrActTransition_6FCBE170_113c,
  PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c,
  PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c,
  PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c,
  SKILLS_RegisterSummonedMonsterPet_6FCC3090_113c,
} from './k2-w12b1-113c'
import {
  DATATBLS_GetBooksTxtRecord113c,
  DATATBLS_GetItemsTxtRecordByCode113c,
  DATATBLS_GetMaxLevel113c,
  DATATBLS_GetMonLvlTxtRecord113c,
  DATATBLS_GetQualityItemsTxtRecord113c,
} from '../tables/datatbls-113c'
import { DATATBLS_GetGambleDataTables113c } from '../tables/item-tbls-113c'
import { DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c } from '../tables/monster-tbls-113c'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c'
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  AIGENERAL_GetPackLeaderUnit113c,
  MONSTER_InitModeChangeStrc113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import { PLAYER_StartModeAtCoords113c } from './c2s-packet-113c'
import {
  AI_FindNearestPlayerOrAlly113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  ITEMS_GetDropItemLevel113c,
  ITEMS_InitCreatedItemStats113c,
  MONSTER_StartMode113c,
} from './combat-a1c-113c'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_InitCreatedItemStats_6FC31070_113c,
  isSgptDataTablesLoaded113c,
} from './k2-real-itemdrop-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c,
  ITEMS_HasSocketedSubItems113c,
  PLRTRADE_CanModifyBeltDuringTrade113c,
  PLRTRADE_IsInteractingWithValidPlayer113c,
  PLRTRADE_SyncClonedItemEarOrPersonalizedData113c,
  PLRTRADE_TradeButtonNoopAction2_113c,
  PLRTRADE_TradeButtonNoopAction3_113c,
} from './k2-combat-core-w1-113c'
import {
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_DeactivateEquippedItemStats113c,
  ITEMS_OnEquipScrollOrTome113c,
  ITEMS_OnUnequipScrollOrTome113c,
} from './k2-gap-itemdef-113c'
import {
  MISSILES_GetTxtRecordFast113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
} from './k2-gap-melee-dot-113c'
import { PLAYER_IsBusyWithCursorOrNpcInteract113c } from './k2-items-tc-w1-113c'
import {
  MONSTER_GetInteractDataPtr_6FC21370_113c,
  MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c,
  OBJRGN_PrependObjectCoordNode_6FC2B800_113c,
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
  PLAYER_GetWaypointDataForDifficulty_6FC21720_113c,
  SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c,
  STATLIST_AddUnitStatGoldGuarded_6FC21670_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import {
  ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c,
  ITEMS_SpawnItemWithParams_6FC31980_113c,
} from './k2-laneI-0x6fc3-w1-113c'
import {
  ACT3Q3_OnKhalimsWillCubed113c,
  MONSTER_CountInteractingPlayers113c,
} from './k2-sunit-spawn-w1-113c'
import {
  ITEMS_IsUniqueItemDisabled_6FC217E0_113c,
  ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c,
} from './k2-w2b1-113c'
import {
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c,
  NET_SendPacket77_ButtonAction_6FCAB340_113c,
  NET_SendPacketBuffer15B_6FCAABF0_113c,
} from './k2-w2b3-113c'
import {
  SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c,
  SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c,
  SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c,
} from './k2-w2b4-113c'
import { MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c } from './k2-w2b5-113c'
import {
  HIRELING_GetVendorNameIdRange_6FCDC7D0_113c,
  NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c,
} from './k2-w2b6-113c'
import {
  AI_ApproachTargetPathType13_6FD13000_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
} from './k2-w2b8-113c'
import {
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c,
  ITEMS_RollRarePrefixId_6FC34210_113c,
  ITEMS_RollRareSuffixId_6FC34370_113c,
} from './k2-w3b1-113c'
import { QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c } from './k2-w3b3-113c'
import {
  CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c,
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c,
} from './k2-w3b7-113c'
import { ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c } from './k2-w4b3-113c'
import {
  ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c,
  NPCS_QueueOrFreeVendorItem_6FCB0260_113c,
  PETS_GetFirstPetUnitByType_6FCB6A40_113c,
} from './k2-w4b5-113c'
import {
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c,
  STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c,
} from './k2-w4b6-113c'
import {
  MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c,
  MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c,
  MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c,
  MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c,
  MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c,
} from './k2-w4b7-113c'
import { PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c } from './k2-w5b1-113c'
import { NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c } from './k2-w5b2-113c'
import {
  ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c,
  MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c,
} from './k2-w5b3-113c'
import {
  NPC_DeductPlayerGoldAndStash_6FCDCC60_113c,
  NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c,
  NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c,
  NPC_RollStoreItemUpgrade_6FCDD040_113c,
  QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c,
} from './k2-w5b4-113c'
import { C2S_ValidateCursorItem_6FCECF70_113c } from './k2-w5b6-113c'
import {
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c,
  ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c,
  ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c,
  ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c,
  ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c,
  ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c,
} from './k2-w5b7-113c'
import {
  AI_CircleStrafeTarget_6FD126B0_113c,
  AI_RunFleeFromUnit_6FD12C10_113c,
  AI_WalkWanderAroundSelf_6FD129B0_113c,
} from './k2-w5b10-113c'
import {
  NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c,
  NPC_SendHirelingListPacketsToClient_6FCDD330_113c,
} from './k2-w6b2-113c'
import { ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c } from './k2-w6b4-113c'
import { PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c } from './k2-w6b5-113c'
import {
  ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c,
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c,
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c,
} from './k2-w6b6-113c'
import { ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c } from './k2-w7b1-113c'
import { MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c } from './k2-w7b3-113c'
import {
  ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c,
  ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c,
} from './k2-w7b4-113c'
import { CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c } from './k2-w8b2-113c'
import {
  ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c,
  NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c,
} from './k2-w8b3-113c'
import { NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c } from './k2-w9b1-113c'
import { ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c } from './k2-w9b2-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_Create113c,
  MONSTER_ScheduleInitialAiEvent113c,
  MONSTER_SpawnAtCoords113c,
  MONSTER_SpawnPartyMinionInRing113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel'
import { AI_StepRelativeToTargetUnit113c } from './town-npc-ai-113c'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'


type D2KernMemory113c = SparseMemory113c

function i32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}
function i16(m: D2KernMemory113c, addr: number): number {
  return (m.u16(addr >>> 0) << 16) >> 16
}


let k2W13B1StackPtr = 0x7f180000

const D2GAME_SEED_MULTIPLIER_113C = 0x6ac690c5n

function stepSeed64At113c(m: D2KernMemory113c, pSeed: number): number {
  const low = BigInt(m.u32(pSeed >>> 0) >>> 0)
  const high = BigInt(m.u32((pSeed + 4) >>> 0) >>> 0)
  const prod = low * D2GAME_SEED_MULTIPLIER_113C + high
  const nextLow = Number(prod & 0xffffffffn) >>> 0
  const nextHigh = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed >>> 0, nextLow)
  m.setU32((pSeed + 4) >>> 0, nextHigh)
  return nextLow | 0
}

function getUnitPosX(m: D2KernMemory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const unitType = m.u32(pUnit >>> 0) >>> 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) return 0
  if (unitType === 0 || unitType === 1 || unitType === 3) {
    return PATH_GetPosX113c(m, pPath) | 0
  }
  return m.u32((pPath + 0x0c) >>> 0) | 0
}

function getUnitPosY(m: D2KernMemory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const unitType = m.u32(pUnit >>> 0) >>> 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) return 0
  if (unitType === 0 || unitType === 1 || unitType === 3) {
    return PATH_GetPosY113c(m, pPath) | 0
  }
  return m.u32((pPath + 0x10) >>> 0) | 0
}

function getMonsterAiGeneralPtr(m: D2KernMemory113c, pUnit: number): number {
  if (pUnit === 0 || (m.u32(pUnit >>> 0) >>> 0) !== 1) return 0
  const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  return pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
}

function D2Game_6FD019C0_113c(
  m: D2KernMemory113c,
  nX: number,
  nY: number,
  pDestRoom: number,
  pGame: number,
  pUnit: number,
  bKeepInSameRoom: number,
  bNoPortalUpdate: number,
): number {
  return DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
    m,
    nX,
    pDestRoom,
    nY,
    pGame,
    pUnit,
    bKeepInSameRoom,
    bNoPortalUpdate,
  )
}

function D2Game_6FC3CAE0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pTarget: number,
  nAction: number,
  bRunFlag: number,
  nOffset: number,
  nDirOverride: number,
  ops?: PetMoveActionOps113c,
): number {
  return AI_PetMoveActionDispatch_6FC3CAE0_113c(
    m,
    pUnit,
    pGame,
    pTarget,
    nAction,
    bRunFlag,
    nOffset,
    nDirOverride,
    ops,
  )
}

function D2Game_6FC3E140_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pTarget: number,
  pObstacle: number,
  bUnk1: number,
  nMaxDist: number,
  nDirOverride: number,
  ops?: PetMoveActionOps113c,
): number {
  return AI_FollowOwnerOrTeleportIfFar_6FC3E140_113c(
    m,
    pUnit,
    pGame,
    pTarget,
    pObstacle,
    bUnk1,
    nMaxDist,
    nDirOverride,
    ops,
  )
}

function D2Game_6FC68FC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pMercUnit: number,
  wMercHireFlag: number,
  pMercSaveData: number,
  bSkipSubParty: number,
): void {
  HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c(
    m,
    pGame,
    pPlayerUnit,
    pMercUnit,
    wMercHireFlag,
    pMercSaveData,
    bSkipSubParty,
  )
}

function D2Game_6FC8DFC0_113c(m: D2KernMemory113c, pObjInteractArg: number): number {
  return OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c(m, pObjInteractArg)
}

function D2Game_6FC916D0_113c(m: D2KernMemory113c, pGame: number, pPlayer: number): void {
  PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c(m, pGame, pPlayer)
}

function D2Game_6FC919A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer1: number,
  pPlayer2: number,
  pData1: number,
  pData2: number,
  nState1: number,
): void {
  PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(
    m,
    pGame,
    pPlayer1,
    pPlayer2,
    pData1,
    pData2,
    nState1,
  )
}

function D2Game_6FC91B00_113c(
  m: D2KernMemory113c,
  pItem: number,
  pGame: number,
  pPlayer: number,
): void {
  PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c(m, pItem, pGame, pPlayer)
}

function D2Game_6FCBE170_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  nDestLevelId: number,
  pGame: number,
  nWarpType: number,
): void {
  PLAYER_ChangeLevelOrActTransition_6FCBE170_113c(m, pPlayer, nDestLevelId, pGame, nWarpType)
}

function D2Game_6FCC3090_113c(
  m: D2KernMemory113c,
  pSpawnInfo: number,
  pMonster: number,
  pGame: number,
): void {
  SKILLS_RegisterSummonedMonsterPet_6FCC3090_113c(m, pSpawnInfo, pMonster, pGame)
}

function D2Game_6FCE8950_113c(m: D2KernMemory113c, pObjInteractArg: number): void {
  ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c(m, pObjInteractArg)
}

function D2Game_6FCF01D0_113c(
  m: D2KernMemory113c,
  nTargetType: number,
  pGame: number,
  bShiftFlag: number,
  pPlayer: number,
  nTargetGuid: number,
): number {
  return C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c(
    m,
    nTargetType,
    pGame,
    bShiftFlag,
    pPlayer,
    nTargetGuid,
  ) | 0
}

function D2Game_6FCF76A0_113c(
  m: D2KernMemory113c,
  szFile: number,
  nLine: number,
  pGame: number,
  pUnit: number,
  nItemGuid: number,
  nPosX: number,
  nPosY: number,
  bAutoPlace: number,
  bSyncClient: number,
  pInventory: number,
): number {
  return ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c(
    m,
    szFile,
    nLine,
    pGame,
    pUnit,
    nItemGuid,
    nPosX,
    nPosY,
    bAutoPlace,
    bSyncClient,
    pInventory,
  )
}

function D2Game_6FCF7E30_113c(
  m: D2KernMemory113c,
  pBeltItem: number,
  pPlayer: number,
  pGame: number,
  _arg4?: number,
): void {
  ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c(m, pBeltItem, pPlayer, pGame)
}

function D2Game_6FCF8970_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nBodyLoc: number,
  bSync: number,
  pOutErr: number,
): number {
  return ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c(
    m,
    pGame,
    pUnit,
    nBodyLoc,
    bSync,
    pOutErr,
  )
}

function signedU32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}
function signedU16(m: D2KernMemory113c, addr: number): number {
  return (m.u16(addr >>> 0) << 16) >> 16
}
function D2Game_6FD08780_113c(
  m: D2KernMemory113c,
  pQData: number,
  pRoom: number,
  pGame: number,
): void {
  ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c(m, pQData, pRoom, pGame)
}

function QUESTS_GetGlobalState113c(...args: Parameters<typeof DRLGWARP_TestRoomTileBit113c>): ReturnType<typeof DRLGWARP_TestRoomTileBit113c> {
  return DRLGWARP_TestRoomTileBit113c(...args)
}
function DUNGEON_ToggleRoomTileStandableFlag113c(...args: Parameters<typeof DUNGEON_ToggleHasPortalFlag113c>): ReturnType<typeof DUNGEON_ToggleHasPortalFlag113c> {
  return DUNGEON_ToggleHasPortalFlag113c(...args)
}
function UNITS_GetObjectTxtRecordFromObject113c(...args: Parameters<typeof UNITS_GetObjectTxt113c>): ReturnType<typeof UNITS_GetObjectTxt113c> {
  return UNITS_GetObjectTxt113c(...args)
}
function PLAYER_GetWaypointHistoryFlags113c(...args: Parameters<typeof PLAYER_GetWaypointDataForDifficulty_6FC21720_113c>): ReturnType<typeof PLAYER_GetWaypointDataForDifficulty_6FC21720_113c> {
  return PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(...args)
}
function DATATBLS_GetWaypointIndexByLevelId113c(...args: Parameters<typeof WAYPOINT_GetWaypointNoFromLevelId113c>): ReturnType<typeof WAYPOINT_GetWaypointNoFromLevelId113c> {
  return WAYPOINT_GetWaypointNoFromLevelId113c(...args)
}
function WAYPOINTS_GetWaypointFlag113c(...args: Parameters<typeof WAYPOINT_GetWaypointState113c>): ReturnType<typeof WAYPOINT_GetWaypointState113c> {
  return WAYPOINT_GetWaypointState113c(...args)
}
function DUNGEON_FindActSpawnLocation113c(...args: Parameters<typeof DUNGEON_FindLevelSpawnRoom113c>): ReturnType<typeof DUNGEON_FindLevelSpawnRoom113c> {
  return DUNGEON_FindLevelSpawnRoom113c(...args)
}
function UNITS_GetCoords113c(...args: Parameters<typeof PATH_GetTargetTypeAndPosition113c>): ReturnType<typeof PATH_GetTargetTypeAndPosition113c> {
  return PATH_GetTargetTypeAndPosition113c(...args)
}
function ITEMS_Duplicate113c(...args: Parameters<typeof ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c>): ReturnType<typeof ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c> {
  return ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(...args)
}
function ITEMS_SetItemPage113c(...args: Parameters<typeof ITEMS_SetInvPage113c>): ReturnType<typeof ITEMS_SetInvPage113c> {
  return ITEMS_SetInvPage113c(...args)
}
function UNITS_GetInventoryGridType113c(...args: Parameters<typeof UNITS_GetInventoryRecordId113c>): ReturnType<typeof UNITS_GetInventoryRecordId113c> {
  return UNITS_GetInventoryRecordId113c(...args)
}
function INVENTORY_PlaceItemAtFreePosition113c(...args: Parameters<typeof INVENTORY_AutoPlaceItemInGrid113c>): ReturnType<typeof INVENTORY_AutoPlaceItemInGrid113c> {
  return INVENTORY_AutoPlaceItemInGrid113c(...args)
}
function INVENTORY_AddItemToTradeInventory113c(...args: Parameters<typeof INVENTORY_PlaceItemInSocket113c>): ReturnType<typeof INVENTORY_PlaceItemInSocket113c> {
  return INVENTORY_PlaceItemInSocket113c(...args)
}
function ITEMS_CanUpdateSocketStats113c(...args: Parameters<typeof ITEMS_CanUseCharmInInventory113c>): ReturnType<typeof ITEMS_CanUseCharmInInventory113c> {
  return ITEMS_CanUseCharmInInventory113c(...args)
}
function INVENTORY_SetInventoryUpdateFlag113c(...args: Parameters<typeof INVENTORY_SetCursorItem113c>): ReturnType<typeof INVENTORY_SetCursorItem113c> {
  return INVENTORY_SetCursorItem113c(...args)
}
function UNITS_ToggleFlag113c(...args: Parameters<typeof ITEMS_SetOrClearCommandFlags113c>): ReturnType<typeof ITEMS_SetOrClearCommandFlags113c> {
  return ITEMS_SetOrClearCommandFlags113c(...args)
}
function UNITS_UpdateInventoryItems113c(...args: Parameters<typeof UNITS_SetUnitUpdateFlags113c>): ReturnType<typeof UNITS_SetUnitUpdateFlags113c> {
  return UNITS_SetUnitUpdateFlags113c(...args)
}
function INVENTORY_AppendRecord113c(...args: Parameters<typeof INVENTORY_AppendItemGuidNode113c>): ReturnType<typeof INVENTORY_AppendItemGuidNode113c> {
  return INVENTORY_AppendItemGuidNode113c(...args)
}
function ITEMS_IsSocketable113c(...args: Parameters<typeof ITEMS_GetSubTypeFromItem113c>): ReturnType<typeof ITEMS_GetSubTypeFromItem113c> {
  return ITEMS_GetSubTypeFromItem113c(...args)
}
function INVENTORY_AllocTradeRecord113c(...args: Parameters<typeof ITEMS_SetOrClearFlagMask113c>): ReturnType<typeof ITEMS_SetOrClearFlagMask113c> {
  return ITEMS_SetOrClearFlagMask113c(...args)
}
function ITEMS_SerializeItemToBitstream113c(...args: Parameters<typeof ITEMS_SetOrClearFlagMask113c>): ReturnType<typeof ITEMS_SetOrClearFlagMask113c> {
  return ITEMS_SetOrClearFlagMask113c(...args)
}
function ITEMS_GetHoradricCubeFlag113c(...args: Parameters<typeof ITEMS_SetNodePage113c>): ReturnType<typeof ITEMS_SetNodePage113c> {
  return ITEMS_SetNodePage113c(...args)
}
function STATLIST_UnitGetStatValue113c(...args: Parameters<typeof STATLIST_GetUnitStat113c>): ReturnType<typeof STATLIST_GetUnitStat113c> {
  return STATLIST_GetUnitStat113c(...args)
}
function STATLIST_AddUnitStat113c(...args: Parameters<typeof STATLIST_AddUnitStatMemPort113c>): ReturnType<typeof STATLIST_AddUnitStatMemPort113c> {
  return STATLIST_AddUnitStatMemPort113c(...args)
}
function STATLIST_GetUnitMaxLife113c(...args: Parameters<typeof STATLIST_GetMaxLifeFromUnit113c>): ReturnType<typeof STATLIST_GetMaxLifeFromUnit113c> {
  return STATLIST_GetMaxLifeFromUnit113c(...args)
}
function STATLIST_GetUnitMaxMana113c(...args: Parameters<typeof STATLIST_GetMaxManaFromUnit113c>): ReturnType<typeof STATLIST_GetMaxManaFromUnit113c> {
  return STATLIST_GetMaxManaFromUnit113c(...args)
}
function ITEMS_GetFileIndex113c(...args: Parameters<typeof ITEMS_GetItemCell113c>): ReturnType<typeof ITEMS_GetItemCell113c> {
  return ITEMS_GetItemCell113c(...args)
}
function ITEMS_GetCompactItemDataFromUnit113c(...args: Parameters<typeof ITEMS_GetItemCell113c>): ReturnType<typeof ITEMS_GetItemCell113c> {
  return ITEMS_GetItemCell113c(...args)
}
function STATLIST_GetUnitAlignment113c(...args: Parameters<typeof ITEMS_GetCommandFlags113c>): ReturnType<typeof ITEMS_GetCommandFlags113c> {
  return ITEMS_GetCommandFlags113c(...args)
}
function ITEMS_SetEarLevel113c(...args: Parameters<typeof ITEMS_SetMagicPrefix113c>): ReturnType<typeof ITEMS_SetMagicPrefix113c> {
  return ITEMS_SetMagicPrefix113c(...args)
}
function STATLIST_GetStatListFromUnitAndState113c(...args: Parameters<typeof STATLIST_GetStatListFromUnitStateOrFlag113c>): ReturnType<typeof STATLIST_GetStatListFromUnitStateOrFlag113c> {
  return STATLIST_GetStatListFromUnitStateOrFlag113c(...args)
}
function STATLIST_UnlinkStatList113c(...args: Parameters<typeof STATLIST_UnlinkSubList113c>): ReturnType<typeof STATLIST_UnlinkSubList113c> {
  return STATLIST_UnlinkSubList113c(...args)
}
function STATLIST_FreeStatListEx113c(...args: Parameters<typeof STATLIST_FreeStatListIfNonExtended113c>): ReturnType<typeof STATLIST_FreeStatListIfNonExtended113c> {
  return STATLIST_FreeStatListIfNonExtended113c(...args)
}
function ITEMS_AssignProperty113c(...args: Parameters<typeof ITEMS_ApplySinglePropAndEthereal113c>): ReturnType<typeof ITEMS_ApplySinglePropAndEthereal113c> {
  return ITEMS_ApplySinglePropAndEthereal113c(...args)
}
function ITEMS_CheckIfStackable113c(...args: Parameters<typeof ITEMS_GetTwoHandedFlag113c>): ReturnType<typeof ITEMS_GetTwoHandedFlag113c> {
  return ITEMS_GetTwoHandedFlag113c(...args)
}
function ITEMS_CanBeStacked113c(...args: Parameters<typeof ITEMS_GetTwoHandedFlag113c>): ReturnType<typeof ITEMS_GetTwoHandedFlag113c> {
  return ITEMS_GetTwoHandedFlag113c(...args)
}
function ITEMS_GetMaxSockets113c(...args: Parameters<typeof ITEMS_GetMaxSocketsFromItemType113c>): ReturnType<typeof ITEMS_GetMaxSocketsFromItemType113c> {
  return ITEMS_GetMaxSocketsFromItemType113c(...args)
}
function ITEMS_AddSockets113c(...args: Parameters<typeof ITEMS_GetMissileWeaponVelocity113c>): ReturnType<typeof ITEMS_GetMissileWeaponVelocity113c> {
  return ITEMS_GetMissileWeaponVelocity113c(...args)
}
function UNITS_RefreshInventory113c(...args: Parameters<typeof UNITROOM_RefreshUnit113c>): ReturnType<typeof UNITROOM_RefreshUnit113c> {
  return UNITROOM_RefreshUnit113c(...args)
}
function SUNIT_RemoveUnit113c(...args: Parameters<typeof SUNIT_FreeUnit113c>): ReturnType<typeof SUNIT_FreeUnit113c> {
  return SUNIT_FreeUnit113c(...args)
}
function DATATBLS_GetItemsTxtRecord113c(...args: Parameters<typeof DATATBLS_GetItemsTxtRecordMemPort113c>): ReturnType<typeof DATATBLS_GetItemsTxtRecordMemPort113c> {
  return DATATBLS_GetItemsTxtRecordMemPort113c(...args)
}
function ACT3Q2_OnKhalimFlailCreated113c(...args: Parameters<typeof ACT3Q3_OnKhalimsWillCubed113c>): ReturnType<typeof ACT3Q3_OnKhalimsWillCubed113c> {
  return ACT3Q3_OnKhalimsWillCubed113c(...args)
}
function ITEMS_StopAllItemFunctions113c(...args: Parameters<typeof ITEMS_NoOpReturnZero113c>): ReturnType<typeof ITEMS_NoOpReturnZero113c> {
  return ITEMS_NoOpReturnZero113c(...args)
}
function INVENTORY_UpdateWeaponGUIDOnRemove113c(...args: Parameters<typeof INVENTORY_UpdateWeaponGuidOnRemoval113c>): ReturnType<typeof INVENTORY_UpdateWeaponGuidOnRemoval113c> {
  return INVENTORY_UpdateWeaponGuidOnRemoval113c(...args)
}
function ITEMS_GetItemType113c(...args: Parameters<typeof ITEMS_GetItemTypeFromItem113c>): ReturnType<typeof ITEMS_GetItemTypeFromItem113c> {
  return ITEMS_GetItemTypeFromItem113c(...args)
}
function UNITS_AttachAndSync113c(...args: Parameters<typeof ITEMMODS_UpdateSetItemEquipmentState113c>): ReturnType<typeof ITEMMODS_UpdateSetItemEquipmentState113c> {
  return ITEMMODS_UpdateSetItemEquipmentState113c(...args)
}
function DUNGEON_FindRoomBySubtileCoords113c(...args: Parameters<typeof ROOM_FindRoomContainingSubtile113c>): ReturnType<typeof ROOM_FindRoomContainingSubtile113c> {
  return ROOM_FindRoomContainingSubtile113c(...args)
}
function MONSTER_SpawnFromSubpreset113c(...args: Parameters<typeof MONSTER_Create113c>): ReturnType<typeof MONSTER_Create113c> {
  return MONSTER_Create113c(...args)
}
function AI_SetNextThinkDelay113c(...args: Parameters<typeof AI_Stall113c>): ReturnType<typeof AI_Stall113c> {
  return AI_Stall113c(...args)
}
function AI_DelayNextThink113c(...args: Parameters<typeof AI_ScheduleAiThinkTimer_6FD120C0_113c>): ReturnType<typeof AI_ScheduleAiThinkTimer_6FD120C0_113c> {
  return AI_ScheduleAiThinkTimer_6FD120C0_113c(...args)
}
function AI_UseSkillOrAttack113c(...args: Parameters<typeof AI_CastSkillWithMode113c>): ReturnType<typeof AI_CastSkillWithMode113c> {
  return AI_CastSkillWithMode113c(...args)
}
function UNITS_GetDistanceToOtherUnit113c(...args: Parameters<typeof UNITS_GetApproximateDistance113c>): ReturnType<typeof UNITS_GetApproximateDistance113c> {
  return UNITS_GetApproximateDistance113c(...args)
}
function SUNIT_GetXPos113c(...args: Parameters<typeof UNIT_GetPosX113c>): ReturnType<typeof UNIT_GetPosX113c> {
  return UNIT_GetPosX113c(...args)
}
function SUNIT_GetYPos113c(...args: Parameters<typeof UNIT_GetPosY113c>): ReturnType<typeof UNIT_GetPosY113c> {
  return UNIT_GetPosY113c(...args)
}
function DUNGEON_IsRoomInTown113c(...args: Parameters<typeof DUNGEON_CheckRoomIsTownMemPort113c>): ReturnType<typeof DUNGEON_CheckRoomIsTownMemPort113c> {
  return DUNGEON_CheckRoomIsTownMemPort113c(...args)
}
function UNITS_CanAttackWithSkill113c(...args: Parameters<typeof UNITS_CanUnitMeleeAttackTarget113c>): ReturnType<typeof UNITS_CanUnitMeleeAttackTarget113c> {
  return UNITS_CanUnitMeleeAttackTarget113c(...args)
}
function DUNGEON_CheckLineOfSight113c(...args: Parameters<typeof UNITS_CanUnitMeleeAttackTarget113c>): ReturnType<typeof UNITS_CanUnitMeleeAttackTarget113c> {
  return UNITS_CanUnitMeleeAttackTarget113c(...args)
}
function DATATBLS_GetSkillsTxtRecord113c(...args: Parameters<typeof SKILLS_GetRecordPtrFast113c>): ReturnType<typeof SKILLS_GetRecordPtrFast113c> {
  return SKILLS_GetRecordPtrFast113c(...args)
}
function SKILLS_GetSkillLevel113c(...args: Parameters<typeof SKILLS_EvaluateSkillLevel113c>): ReturnType<typeof SKILLS_EvaluateSkillLevel113c> {
  return SKILLS_EvaluateSkillLevel113c(...args)
}
function SKILLS_EvaluateSkillFormula113c(...args: Parameters<typeof SKILLS_EvalCalcByOffset113c>): ReturnType<typeof SKILLS_EvalCalcByOffset113c> {
  return SKILLS_EvalCalcByOffset113c(...args)
}
function MONSTER_GetSummonPet113c(...args: Parameters<typeof STATLIST_GetStatListFromUnitAndStateMemPort113c>): ReturnType<typeof STATLIST_GetStatListFromUnitAndStateMemPort113c> {
  return STATLIST_GetStatListFromUnitAndStateMemPort113c(...args)
}
function DATATBLS_GetMissilesTxtRecord113c(...args: Parameters<typeof MISSILES_GetTxtRecordFast113c>): ReturnType<typeof MISSILES_GetTxtRecordFast113c> {
  return MISSILES_GetTxtRecordFast113c(...args)
}
function UNITS_GetUsedSkill113c(...args: Parameters<typeof UNITS_GetLeftSkill113c>): ReturnType<typeof UNITS_GetLeftSkill113c> {
  return UNITS_GetLeftSkill113c(...args)
}
function SKILLS_SetLeftActiveSkill113c(...args: Parameters<typeof SKILLS_SetLeftSkill113c>): ReturnType<typeof SKILLS_SetLeftSkill113c> {
  return SKILLS_SetLeftSkill113c(...args)
}
function UNITS_GetSkillFromSkillId113c(...args: Parameters<typeof SKILLS_GetSkillById113c>): ReturnType<typeof SKILLS_GetSkillById113c> {
  return SKILLS_GetSkillById113c(...args)
}
function SKILLS_CheckSkillDelay113c(...args: Parameters<typeof SKILLS_GetSkillNumTargetsOrShots113c>): ReturnType<typeof SKILLS_GetSkillNumTargetsOrShots113c> {
  return SKILLS_GetSkillNumTargetsOrShots113c(...args)
}
function SKILLS_GetSkillModeFromSkill113c(...args: Parameters<typeof SKILLS_GetLeftSkillFromSkillList113c>): ReturnType<typeof SKILLS_GetLeftSkillFromSkillList113c> {
  return SKILLS_GetLeftSkillFromSkillList113c(...args)
}
function MONSTERAI_GetLifePct113c(...args: Parameters<typeof STATLIST_GetUnitLifePercent113c>): ReturnType<typeof STATLIST_GetUnitLifePercent113c> {
  return STATLIST_GetUnitLifePercent113c(...args)
}
function DUNGEON_CheckRoomFlags113c(...args: Parameters<typeof STATES_CheckStateMask4OnUnit113c>): ReturnType<typeof STATES_CheckStateMask4OnUnit113c> {
  return STATES_CheckStateMask4OnUnit113c(...args)
}
function DUNGEON_CheckCollisionMask113c(...args: Parameters<typeof UNITS_HasCollisionBetweenUnits113c>): ReturnType<typeof UNITS_HasCollisionBetweenUnits113c> {
  return UNITS_HasCollisionBetweenUnits113c(...args)
}
function SKILLS_AssignSkill113c(...args: Parameters<typeof SKILLS_SetSkillLevelOnUnit113c>): ReturnType<typeof SKILLS_SetSkillLevelOnUnit113c> {
  return SKILLS_SetSkillLevelOnUnit113c(...args)
}
function DATATBLS_GetGambleRecord113c(...args: Parameters<typeof DATATBLS_GetGambleDataTables113c>): ReturnType<typeof DATATBLS_GetGambleDataTables113c> {
  return DATATBLS_GetGambleDataTables113c(...args)
}
function DATATBLS_GetDifficultyLevelsTxtRecord113c(...args: Parameters<typeof DATATBLS_GetMonLvlTxtRecord113c>): ReturnType<typeof DATATBLS_GetMonLvlTxtRecord113c> {
  return DATATBLS_GetMonLvlTxtRecord113c(...args)
}
function DATATBLS_GetItemIdFromItemCode113c(...args: Parameters<typeof DATATBLS_GetItemsTxtRecordByCode113c>): ReturnType<typeof DATATBLS_GetItemsTxtRecordByCode113c> {
  return DATATBLS_GetItemsTxtRecordByCode113c(...args)
}
function ITEMS_CheckIfThrowable113c(...args: Parameters<typeof ITEMS_CheckIfThrowItemMemPort113c>): ReturnType<typeof ITEMS_CheckIfThrowItemMemPort113c> {
  return ITEMS_CheckIfThrowItemMemPort113c(...args)
}
function ITEMS_CheckIfAutoStack113c(...args: Parameters<typeof ITEMS_IsAutoStack113c>): ReturnType<typeof ITEMS_IsAutoStack113c> {
  return ITEMS_IsAutoStack113c(...args)
}
function ITEMS_GetMaxDurabilityFromUnit113c(...args: Parameters<typeof STATLIST_GetMaxDurabilityFromUnit113c>): ReturnType<typeof STATLIST_GetMaxDurabilityFromUnit113c> {
  return STATLIST_GetMaxDurabilityFromUnit113c(...args)
}
function ITEMS_CheckItemTypeId113c(...args: Parameters<typeof ITEMS_CheckItemTypeIdMemPort113c>): ReturnType<typeof ITEMS_CheckItemTypeIdMemPort113c> {
  return ITEMS_CheckItemTypeIdMemPort113c(...args)
}
function INVENTORY_CanItemBePlaced113c(...args: Parameters<typeof ITEMS_CanItemBeAutoBeltOrStacked113c>): ReturnType<typeof ITEMS_CanItemBeAutoBeltOrStacked113c> {
  return ITEMS_CanItemBeAutoBeltOrStacked113c(...args)
}
function INVENTORY_GetBeltItem113c(...args: Parameters<typeof INVENTORY_GetCompositWeaponMemPort113c>): ReturnType<typeof INVENTORY_GetCompositWeaponMemPort113c> {
  return INVENTORY_GetCompositWeaponMemPort113c(...args)
}
function UNITS_GetBeltType113c(...args: Parameters<typeof ITEMS_GetActiveWeaponClassCodeIdx113c>): ReturnType<typeof ITEMS_GetActiveWeaponClassCodeIdx113c> {
  return ITEMS_GetActiveWeaponClassCodeIdx113c(...args)
}
function ITEMS_GetPrefixId113c(...args: Parameters<typeof ITEMS_GetMagicSuffix113c>): ReturnType<typeof ITEMS_GetMagicSuffix113c> {
  return ITEMS_GetMagicSuffix113c(...args)
}
function ITEMS_CheckIfTradable113c(...args: Parameters<typeof ITEMS_CanItemBeShownInTradeOrStash113c>): ReturnType<typeof ITEMS_CanItemBeShownInTradeOrStash113c> {
  return ITEMS_CanItemBeShownInTradeOrStash113c(...args)
}
function DATATBLS_GetHirelingTxtRecord113c(...args: Parameters<typeof DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c>): ReturnType<typeof DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c> {
  return DATATBLS_GetHirelingTxtRecordFromVendorAndDifficulty113c(...args)
}
function RANDOM_RollBounded113c(...args: Parameters<typeof SEED_RollLimitedFast113c>): ReturnType<typeof SEED_RollLimitedFast113c> {
  return SEED_RollLimitedFast113c(...args)
}

function SUNIT_SendUnitSpeech113c(m: D2KernMemory113c, pPlayer: number, wSpeech: number): void {
  SUNIT_SetUnitEventSound113c(m, pPlayer, wSpeech, pPlayer)
}

function ITEMS_CheckItemFlag113c(
  m: D2KernMemory113c,
  pItem: number,
  dwFlag: number,
  _nLine?: number,
  _szFile?: number,
): number {
  return ITEMS_CheckCommandFlags113c(m, pItem, dwFlag)
}

function ITEMS_SetItemCMDFlag113c(m: D2KernMemory113c, pItem: number, nMode: number): void {
  UNITS_ChangeAnimMode113c(m, pItem, nMode)
}

function ACT2Q2_OnStaffTransmuted113c(m: D2KernMemory113c, pPlayer: number, pGame: number): void {
  ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c(m, pGame, pPlayer)
}

function FOG_Assertion113c(_m: D2KernMemory113c, nLine: number, szFileVa: number): never {
  throw new D2CommonAssertError('0x' + (szFileVa >>> 0).toString(16), nLine | 0)
}

function FOG_AllocPool113c(
  m: D2KernMemory113c,
  _pMemPool: number,
  nSize: number,
  _szFile: number,
  _nLine: number,
  _nNull: number,
): number {
  const ptr = m.alloc(nSize >>> 0) >>> 0
  m.fill(ptr, nSize >>> 0, 0)
  return ptr
}

function CRT_alldiv113c(a: bigint, b: bigint): number {
  return Number(a / b) | 0
}

function clearAurasType2(m: D2KernMemory113c, pGame: number, pUnit: number): void {
  if (pUnit === 0) return
  let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
    if (m.u8(pEvent) === 2) {
      EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
    }
    pEvent = pNext
  }
}

function aiFindTarget6FCD1C90(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiControl: number,
  pOutDistance: number,
  pOutInMeleeRange: number,
): number {
  const unitRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (unitRoom === 0) {
    if (pOutInMeleeRange !== 0) m.setU32(pOutInMeleeRange >>> 0, 0)
    if (pOutDistance !== 0) m.setU32(pOutDistance >>> 0, 0)
    return 0
  }
  if (pAiControl !== 0) {
    const wAiFlags = m.u16((pAiControl + 0x08) >>> 0)
    if ((wAiFlags & 0x40) !== 0) {
      m.setU16((pAiControl + 0x08) >>> 0, wAiFlags & 0xffbf)
    }
  }
  const found = AI_FindNearestPlayerOrAlly113c(m, pGame >>> 0, pUnit >>> 0)
  if ((found.pTarget >>> 0) !== 0) {
    if (pAiControl !== 0) {
      m.setU8((pAiControl + 0x08) >>> 0, (m.u8((pAiControl + 0x08) >>> 0) | 0x08) & 0xff)
    }
    if (pOutInMeleeRange !== 0) m.setU32(pOutInMeleeRange >>> 0, found.inMeleeRange >>> 0)
    if (pOutDistance !== 0) m.setU32(pOutDistance >>> 0, found.distance >>> 0)
    return found.pTarget >>> 0
  }
  if (pOutInMeleeRange !== 0) m.setU32(pOutInMeleeRange >>> 0, 0)
  if (pOutDistance !== 0) {
    const outDist = found.distance === 0x7fffffff ? 0 : found.distance >>> 0
    m.setU32(pOutDistance >>> 0, outDist)
  }
  return 0
}

function AI_ApproachTarget113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  nX: number,
  nY: number,
  nStepNum: number,
  dwFlags: number,
): number {
  let mode = nMode | 0
  if (mode === 0x0f && (STATES_CheckState113c(m, pUnit >>> 0, 0x3c) | 0) !== 0) {
    let pAiControl = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    if (pAiControl !== 0) {
      m.setU32((pAiControl + 0x18) >>> 0, 0)
      m.setU32((pAiControl + 0x1c) >>> 0, 0)
      m.setU8((pAiControl + 0x20) >>> 0, 0)
    }
    mode = 2
  }

  PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0), nStepNum | 0)

  const sp = k2W13B1StackPtr
  k2W13B1StackPtr = (sp + 0x20) >>> 0
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, mode)
    if (pTarget !== 0) {
      m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    } else {
      m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
      m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    }
    const res = MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, mode, pTarget >>> 0, nX | 0, nY | 0) | 0
    if (res !== 0) {
      return res
    }
    const flagsByte = dwFlags & 0xff
    if ((flagsByte & 4) !== 0) {
      clearAurasType2(m, pGame, pUnit)
    }
    if ((flagsByte & 1) !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pAiGeneral = getMonsterAiGeneralPtr(m, pUnit)
      if (pAiGeneral !== 0) {
        m.setU8((pAiGeneral + 8) >>> 0, (m.u8((pAiGeneral + 8) >>> 0) | 0x40) & 0xff)
      }
    }
    if ((flagsByte & 2) !== 0) {
      const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
      if (roll < 0x46) {
        AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0)
        return 1
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
      return 1
    }
    return res
  } finally {
    k2W13B1StackPtr = sp
  }
}

function initMonsterSpecialAiThink6FCBD230(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiGeneral: number,
  nSpecAi: number,
): void {
  if (STATES_CheckState113c(m, pMonster >>> 0, 0x36) !== 0) {
    FOG_Assertion113c(m, 0x1a6, 0x6fd19ff9)
  }
  if (pGame === 0 || pMonster === 0 || pAiGeneral === 0 || (nSpecAi | 0) >= 0x12) {
    return
  }
  if ((m.u32(pMonster >>> 0) | 0) !== 1) {
    return
  }
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0
  const monClassId = m.u32((pMonster + 0x04) >>> 0) | 0
  const effSpecAi = nMonStatsCount > 0 && monClassId >= nMonStatsCount ? 1 : nSpecAi | 0
  m.setU32((pAiGeneral + 0x14) >>> 0, 0)
  m.setU32((pAiGeneral + 0x18) >>> 0, 0)
  m.setU32((pAiGeneral + 0x1c) >>> 0, 0)
  m.setU32(pAiGeneral >>> 0, effSpecAi >>> 0)
  AI_InitMonsterAiThinkFn113c(m, pMonster >>> 0)
}

function findItemDropPosition6FC2E930(
  m: D2KernMemory113c,
  _pUnit: number,
  pRoom: number,
  pSrcCoords: number,
  pOutCoords: number,
  bAllowFallback: number,
): number {
  const sx = i32(m, pSrcCoords)
  const sy = i32(m, (pSrcCoords + 4) >>> 0)
  const r2 = ROOM_FindRoomContainingSubtile113c(m, pRoom >>> 0, (sx + 2) | 0, (sy + 3) | 0) >>> 0
  if (r2 !== 0) {
    m.setU32(pOutCoords >>> 0, ((sx + 2) | 0) >>> 0)
    m.setU32((pOutCoords + 4) >>> 0, ((sy + 3) | 0) >>> 0)
  } else {
    m.setU32(pOutCoords >>> 0, sx >>> 0)
    m.setU32((pOutCoords + 4) >>> 0, sy >>> 0)
  }
  return COLLISION_FindFreePositionBasic113c(
    m,
    pRoom >>> 0,
    pOutCoords >>> 0,
    pSrcCoords >>> 0,
    bAllowFallback | 0,
    0x3e01,
    0x0801,
    1,
  ) >>> 0
}

function findTargetForPlayerOrPet6FCD1C90W13B1(
  m: D2KernMemory113c,
  pGame: number,
  pOriginUnit: number,
  pAiControl: number,
  pnOutDist: number,
  pbOutInMelee: number,
): number {
  if (pnOutDist !== 0) m.setU32(pnOutDist >>> 0, 0)
  if (pbOutInMelee !== 0) m.setU32(pbOutInMelee >>> 0, 0)
  if (pOriginUnit === 0) return 0
  const uType = m.u32(pOriginUnit >>> 0) | 0
  if (uType < 0 || uType > 1) return 0

  const sp = k2W13B1StackPtr
  k2W13B1StackPtr = (sp + 0x20) >>> 0
  try {
    const pScanCtx = sp >>> 0
    const pRoom = UNITS_GetRoom113c(m, pOriginUnit) >>> 0
    const posX = UNIT_GetPosX113c(m, pOriginUnit) | 0
    const posY = UNIT_GetPosY113c(m, pOriginUnit) | 0
    const coordIdx =
      pRoom !== 0 ? (DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pRoom, posX, posY) | 0) : 0

    let radius = 35
    if (uType === 1) {
      const pMonData = m.u32((pOriginUnit + 0x14) >>> 0) >>> 0
      const pMonTxt = pMonData !== 0 ? (m.u32((pMonData + 0x00) >>> 0) >>> 0) : 0
      if (pMonTxt !== 0) {
        const diff = m.u8((pGame + 0x6d) >>> 0) % 3
        const rawAidist = m.u8((pMonTxt + 0x6a + diff) >>> 0)
        if (rawAidist > 0) radius = rawAidist
      }
    }

    m.setU32(pScanCtx, 0)
    m.setU32((pScanCtx + 0x04) >>> 0, 0x7fffffff)
    m.setU32((pScanCtx + 0x08) >>> 0, 1)
    m.setU32((pScanCtx + 0x0c) >>> 0, radius >>> 0)
    m.setU32((pScanCtx + 0x10) >>> 0, coordIdx >>> 0)
    m.setU32((pScanCtx + 0x14) >>> 0, 0)
    m.setU32((pScanCtx + 0x18) >>> 0, 0x7fffffff)

    MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(
      m,
      pOriginUnit,
      0x6fcd1660,
      pGame,
      pScanCtx,
      (mem, pg, pOrig, pCand, pCtx) =>
        MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c(mem, pg, pOrig, pCand, pCtx),
    )

    let pBest = 0
    let bestDist = 0
    const pBlockedTarget = m.u32((pScanCtx + 0x14) >>> 0) >>> 0
    if (pBlockedTarget !== 0) {
      const blockedDist = m.u32((pScanCtx + 0x18) >>> 0) | 0
      const useBlocked = MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c(
        m,
        pOriginUnit,
        pScanCtx,
        (pScanCtx + 0x04) >>> 0,
        pBlockedTarget,
        blockedDist,
      )
      if (useBlocked !== 0) {
        pBest = m.u32((pScanCtx + 0x14) >>> 0) >>> 0
        bestDist = m.u32((pScanCtx + 0x18) >>> 0) | 0
      } else {
        pBest = m.u32(pScanCtx) >>> 0
        bestDist = m.u32((pScanCtx + 0x04) >>> 0) | 0
      }
    } else {
      pBest = m.u32(pScanCtx) >>> 0
      bestDist = m.u32((pScanCtx + 0x04) >>> 0) | 0
    }
    if (pBest === 0) return 0

    if (pAiControl !== 0 && uType !== 0) {
      const wFlags = m.u8((pAiControl + 0x08) >>> 0)
      m.setU8((pAiControl + 0x08) >>> 0, (wFlags | 0x08) & 0xff)
    }
    if (pnOutDist !== 0) m.setU32(pnOutDist >>> 0, bestDist >>> 0)

    if (pBest !== 0 && pbOutInMelee !== 0) {
      const inMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pOriginUnit, pBest, 0) !== 0 ? 1 : 0
      m.setU32(pbOutInMelee >>> 0, inMelee)
    }
    return pBest
  } finally {
    k2W13B1StackPtr = sp
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC3E3D0
 * @ordinalOrName D2Game_6FC3E3D0
 */
export function D2Game_6FC3E3D0_113c(
  m: D2KernMemory113c,
  pAiTickArgs: number,
  pUnit: number,
  pGame: number,
  ops?: PetMoveActionOps113c,
): void {
  hitD2GameVa113c(0x6FC3E3D0)
  const pMonStatsTxt = m.u32((pAiTickArgs + 0x1c) >>> 0) >>> 0
  const pAiParam = m.u32(pAiTickArgs >>> 0) >>> 0

  let pOwner = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1) {
    const pAiGen = getMonsterAiGeneralPtr(m, pUnit)
    if (pAiGen !== 0 && m.u32((pAiGen + 0x28) >>> 0) !== 0) {
      pOwner = SUNIT_GetServerUnit113c(
        m,
        m.u32((pAiGen + 0x28) >>> 0),
        m.u32((pAiGen + 0x30) >>> 0),
        m.u32((pAiGen + 0x2c) >>> 0),
      ) >>> 0
    }
  }

  if (pOwner === 0) {
    const savedOwnerGuid = pAiParam !== 0 ? m.u32((pAiParam + 0x1c) >>> 0) >>> 0 : 0
    if (savedOwnerGuid !== 0) {
      if (pGame === 0) {
        FOG_Assertion113c(m, 0x2d3, 0x6fd19ff9)
      }
      let pPlr = m.u32((pGame + 0x1120 + ((savedOwnerGuid & 0x7f) << 2)) >>> 0) >>> 0
      while (pPlr !== 0) {
        if ((m.u32((pPlr + 0x0c) >>> 0) >>> 0) === savedOwnerGuid) {
          D2Game_6FC3CAE0_113c(m, pUnit, pGame, pPlr, 3, 0, 0, 0, ops)
          return
        }
        pPlr = m.u32((pPlr + 0xe4) >>> 0) >>> 0
      }
    }
    if (ops !== undefined) ops.stall(pUnit, 0x0a)
    else AI_Stall113c(m, pGame, pUnit, 0x0a)
    return
  }

  if (pAiParam !== 0) {
    m.setU32((pAiParam + 0x1c) >>> 0, m.u32((pOwner + 0x0c) >>> 0))
  }
  AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwner)

  const sp = k2W13B1StackPtr
  k2W13B1StackPtr = (sp + 0x10) >>> 0
  let pTarget = 0
  let bInMelee = 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 4) >>> 0, 0)
    let pOwnerTarget =
      ops !== undefined
        ? findTargetForPlayerOrPet6FCD1C90W13B1(m, pGame, pOwner, pAiParam, sp, (sp + 4) >>> 0)
        : aiFindTarget6FCD1C90(m, pGame, pOwner, pAiParam, sp, (sp + 4) >>> 0)
    if (pOwnerTarget !== 0) {
      const deadFlag = (m.u32((pOwnerTarget + 0xc4) >>> 0) >>> 0x1e) & 1
      m.setU32((sp + 4) >>> 0, deadFlag)
      if (deadFlag !== 0) {
        pOwnerTarget = 0
      }
    }
    pTarget = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(
      m,
      pUnit,
      pGame,
      sp,
      (sp + 4) >>> 0,
    ) >>> 0
    if (pTarget === 0 || (i32(m, (sp + 4) >>> 0) | 0) > 0x0f) {
      pTarget = 0
      if (pOwnerTarget !== 0) {
        if (UNITS_HasCollisionBetweenUnits113c(m, pUnit, pOwnerTarget, 4) === 0) {
          if ((AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwnerTarget) | 0) < 0x14) {
            pTarget = pOwnerTarget
          }
        }
      }
    }
    bInMelee = m.u32(sp) >>> 0
  } finally {
    k2W13B1StackPtr = sp
  }

  const leashRoll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
  const followRc =
    leashRoll < 0x0f
      ? D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInMelee, 1, 8, ops)
      : D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInMelee, 0, 7, ops)
  if (followRc !== 0) {
    return
  }

  if (pTarget === 0 || DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, pUnit)) !== 0) {
    AI_WalkWanderAroundSelf_6FD129B0_113c(
      m,
      4,
      pGame,
      pUnit,
      ops !== undefined ? { world: ops.world } : undefined,
    )
    return
  }

  const pSeed = (pUnit + 0x20) >>> 0
  if ((SEED_RollLimitedFast113c(m, pSeed, 100) | 0) < 0x50) {
    if (pMonStatsTxt !== 0) {
      const nSkillId = i16(m, (pMonStatsTxt + 0x170) >>> 0)
      const nMode = m.u8((pMonStatsTxt + 0x180) >>> 0)
      AI_CastSkillWithMode113c(m, nMode, pUnit, pGame, nSkillId, pTarget, 0, 0)
    }
    return
  }
  if ((SEED_RollLimitedFast113c(m, pSeed, 100) | 0) < 0x4b) {
    if (ops !== undefined) ops.stall(pUnit, 0x0a)
    else AI_Stall113c(m, pGame, pUnit, 0x0a)
    return
  }
  AI_CircleStrafeTarget_6FD126B0_113c(m, pUnit, 0, pGame, pTarget, 3)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC3E640
 * @ordinalOrName D2Game_6FC3E640
 */
export function D2Game_6FC3E640_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pAiTickArgs: number,
  pGame: number,
  ops?: PetMoveActionOps113c,
): void {
  hitD2GameVa113c(0x6FC3E640)
  const pAiParam = m.u32(pAiTickArgs >>> 0) >>> 0
  const pMonData =
    pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1 ? (m.u32((pUnit + 0x14) >>> 0) >>> 0) : 0
  const pAiControl =
    pMonData !== 0 && m.u32((pMonData + 0x2c) >>> 0) !== 0
      ? (m.u32((pMonData + 0x2c) >>> 0) >>> 0)
      : pAiParam

  let pOwner = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) >>> 0) === 1) {
    const pAiGen = getMonsterAiGeneralPtr(m, pUnit)
    if (pAiGen !== 0 && m.u32((pAiGen + 0x28) >>> 0) !== 0) {
      pOwner = SUNIT_GetServerUnit113c(
        m,
        m.u32((pAiGen + 0x28) >>> 0),
        m.u32((pAiGen + 0x30) >>> 0),
        m.u32((pAiGen + 0x2c) >>> 0),
      ) >>> 0
    }
  }

  if (pOwner === 0) {
    const savedOwnerGuid = pAiParam !== 0 ? m.u32((pAiParam + 0x1c) >>> 0) >>> 0 : 0
    if (savedOwnerGuid !== 0) {
      if (pGame === 0) {
        FOG_Assertion113c(m, 0x2d3, 0x6fd19ff9)
      }
      let pPlr = m.u32((pGame + 0x1120 + ((savedOwnerGuid & 0x7f) << 2)) >>> 0) >>> 0
      while (pPlr !== 0) {
        if ((m.u32((pPlr + 0x0c) >>> 0) >>> 0) === savedOwnerGuid) {
          D2Game_6FC3CAE0_113c(m, pUnit, pGame, pPlr, 3, 0, 0, 0, ops)
          return
        }
        pPlr = m.u32((pPlr + 0xe4) >>> 0) >>> 0
      }
    }
    if (ops !== undefined) ops.stall(pUnit, 0x0a)
    else AI_Stall113c(m, pGame, pUnit, 0x0a)
    return
  }

  if (pAiParam !== 0) {
    m.setU32((pAiParam + 0x1c) >>> 0, m.u32((pOwner + 0x0c) >>> 0))
  }
  const pMonStatsTxt = m.u32((pAiTickArgs + 0x1c) >>> 0) >>> 0
  const ownerDist = AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwner) | 0
  if (ownerDist > 0x32) {
    D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 3, 0, 0, 0, ops)
    return
  }

  const walkFrames = pMonStatsTxt !== 0 ? i16(m, (pMonStatsTxt + 0x32) >>> 0) : 0
  let speedBonus = 100
  if (walkFrames > 0) {
    speedBonus = (Math.trunc(imul32(i16(m, (pMonStatsTxt + 0x34) >>> 0), 100) / walkFrames) - 100) | 0
    if (speedBonus >= 100) {
      speedBonus = 100
    }
  }
  if (ownerDist > 0x1c) {
    D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, speedBonus, 0, ops)
    return
  }

  const sp = k2W13B1StackPtr
  k2W13B1StackPtr = (sp + 0x10) >>> 0
  let pTarget = 0
  let bInMelee = 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 4) >>> 0, 0)
    let pOwnerTarget =
      ops !== undefined
        ? findTargetForPlayerOrPet6FCD1C90W13B1(m, pGame, pOwner, pAiControl, sp, (sp + 4) >>> 0)
        : aiFindTarget6FCD1C90(m, pGame, pOwner, pAiControl, sp, (sp + 4) >>> 0)
    if (pOwnerTarget !== 0) {
      const deadFlag = (m.u32((pOwnerTarget + 0xc4) >>> 0) >>> 0x1e) & 1
      m.setU32((sp + 4) >>> 0, deadFlag)
      if (deadFlag !== 0) {
        pOwnerTarget = 0
      }
    }
    const pSelfTarget =
      ops !== undefined
        ? findTargetForPlayerOrPet6FCD1C90W13B1(m, pGame, pUnit, pAiControl, sp, (sp + 4) >>> 0)
        : aiFindTarget6FCD1C90(m, pGame, pUnit, pAiControl, sp, (sp + 4) >>> 0)
    const selfDist = i32(m, sp)
    if (pSelfTarget !== 0 && selfDist <= 0x18 && selfDist <= 6) {
      pTarget = pSelfTarget
    } else {
      pTarget = 0
      if (pOwnerTarget !== 0 && (AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwnerTarget) | 0) < 0x24) {
        pTarget = pOwnerTarget
      }
    }
    if (ops !== undefined) {
      if (pTarget !== 0) {
        bInMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pUnit, pTarget, 0) !== 0 ? 1 : 0
      }
    } else {
      bInMelee = m.u32((sp + 4) >>> 0) >>> 0
    }
  } finally {
    k2W13B1StackPtr = sp
  }

  if (MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, pUnit, pTarget) === 0) {
    pTarget = 0
  }

  const leashRoll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
  const followRc =
    leashRoll < 0x0f
      ? D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInMelee, 1, 8, ops)
      : D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInMelee, 0, 7, ops)
  if (followRc !== 0) {
    return
  }

  if (pTarget === 0 || DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, pUnit)) !== 0) {
    AI_WalkWanderAroundSelf_6FD129B0_113c(
      m,
      4,
      pGame,
      pUnit,
      ops !== undefined ? { world: ops.world } : undefined,
    )
    return
  }

  if (bInMelee !== 0) {
    if ((SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, 100) | 0) < 0x50) {
      if (ops !== undefined) {
        AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget, undefined, {
          onMonsterStartMode: () => {
            ops.startMode(pUnit, 4, pTarget, 0, 0)
            return 1
          },
        })
      } else {
        AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget)
      }
      return
    }
    if (ops !== undefined) ops.stall(pUnit, 0x0a)
    else AI_Stall113c(m, pGame, pUnit, 0x0a)
    return
  }

  if (ops !== undefined) {
    AI_ApproachTargetPathType13_6FD13000_113c(m, pUnit, pTarget, pGame, 7, {
      onMonsterStartMode: () => 1,
    })
    if (pAiControl !== 0) {
      m.setU32((pAiControl + 0x18) >>> 0, 0x0d)
      m.setU8((pAiControl + 0x20) >>> 0, 0x0c)
    }
    ops.approachTarget(pUnit, pTarget, 2, 0, 0, 1, 7)
    return
  }

  let pAiCtrlField2C = 0
  if ((m.u32(pUnit >>> 0) >>> 0) === 1) {
    const pMonData2 = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData2 !== 0) {
      pAiCtrlField2C = m.u32((pMonData2 + 0x2c) >>> 0) >>> 0
    }
  }
  if (pAiCtrlField2C !== 0) {
    m.setU8((pAiCtrlField2C + 0x20) >>> 0, 0x0c)
  }
  AI_ApproachTargetPathType13_6FD13000_113c(m, pUnit, pTarget, pGame, 7)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC56470
 * @ordinalOrName D2Game_6FC56470
 */
export function D2Game_6FC56470_113c(
  m: D2KernMemory113c,
  nIlvlOverride: number,
  dwItemCode: number,
  pUnit: number,
  pGame: number,
  nQuality: number,
  bDropOnGround: number,
): number {
  hitD2GameVa113c(0x6FC56470)
  const sp = k2W13B1StackPtr
  k2W13B1StackPtr = (sp + 0x18) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 4) >>> 0, 0)
    m.setU32((sp + 8) >>> 0, 0)
    m.setU32((sp + 12) >>> 0, 0)
    if (DATATBLS_GetItemsTxtRecordByCode113c(m, dwItemCode >>> 0, sp) === 0) {
      return 0
    }
    const nClassId = i32(m, sp)
    const dropIlvl = ITEMS_GetDropItemLevel113c(m, pGame, pUnit, 0)
    const nIlvl = nIlvlOverride !== 0 ? nIlvlOverride | 0 : dropIlvl | 0
    const pItem = ITEMS_SpawnItemWithParams_6FC31980_113c(
      m,
      nIlvl,
      0,
      1,
      pUnit,
      nClassId,
      pGame,
      4,
      nQuality,
      0,
      0,
      0,
      isSgptDataTablesLoaded113c(m)
        ? {
            onCreateItemEx: (mem, g, pDrop, bSend) =>
              D2GAME_CreateItemEx_6FC31490_113c(mem, g, pDrop, bSend),
          }
        : undefined,
    ) >>> 0
    if (pItem === 0) {
      return 0
    }
    const maxDur = STATLIST_GetMaxDurabilityFromUnit113c(m, pItem) | 0
    if (maxDur > 0) {
      STATLIST_SetUnitStat113c(m, pItem, 0x48, maxDur, 0)
    }
    ITEMS_SetInvPage113c(m, pItem, 0)
    const itemGuid = m.u32((pItem + 0x0c) >>> 0) >>> 0
    if (
      D2Game_6FCF76A0_113c(m, 0x6fd1cc74, 0x9cf, pGame, pUnit, itemGuid, 0, 0, 1, 1, 0) !== 0
    ) {
      if (ITEMS_CheckCommandFlags113c(m, pItem, 0x10) === 0) {
        ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c(m, pUnit, pItem, pGame)
      }
      return pItem
    }
    if (bDropOnGround !== 0) {
      const spCoord = (sp + 4) >>> 0
      const spOutRoom = (sp + 12) >>> 0
      PATH_GetTargetTypeAndPosition113c(m, pUnit, spCoord)
      QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(
        m,
        UNITS_GetRoom113c(m, pUnit),
        spCoord,
        1,
        0x3e01,
        spOutRoom,
        0x64,
      )
      const dropX = i32(m, spCoord)
      const dropY = i32(m, (spCoord + 4) >>> 0)
      const pOutRoom = m.u32(spOutRoom) >>> 0
      ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(m, dropY, pItem, pOutRoom, pGame, 0, dropX)
      return pItem
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
    return 0
  } finally {
    k2W13B1StackPtr = sp
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC565E0
 * @ordinalOrName D2Game_6FC565E0
 */
export function D2Game_6FC565E0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pPlayer: number,
  pGame: number,
  pInventory: number,
): void {
  hitD2GameVa113c(0x6FC565E0)
  let pClient = 0
  if (pPlayer !== 0 && (m.u32(pPlayer >>> 0) >>> 0) === 0) {
    const pPlrData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    if (pPlrData !== 0) {
      pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    }
  }
  const sp = k2W13B1StackPtr
  k2W13B1StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 4) >>> 0, 0)
    ITEMS_SetOrClearFlagMask113c(m, sp, 0x20, 1)
    const itemMode = pItem !== 0 ? m.u32((pItem + 0x10) >>> 0) >>> 0 : 0
    if (itemMode === 0) {
      ITEMS_SetNodePage113c(m, pItem, ITEMS_GetInvPage113c(m, pItem))
      NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(
        m,
        pItem,
        pPlayer,
        pClient,
        m.u32(sp),
      )
      ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, pPlayer, pItem, pGame, 0)
      return
    }
    if (itemMode === 1) {
      const bodyLoc = INVENTORY_GetItemGridXIfInInventory113c(m, pInventory, pItem)
      D2Game_6FCF8970_113c(m, pGame, pPlayer, bodyLoc, 1, (sp + 4) >>> 0)
      return
    }
    if (itemMode === 4) {
      ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pPlayer, pItem, pGame)
      INVENTORY_SetCursorItem113c(m, pInventory, 0)
    }
  } finally {
    k2W13B1StackPtr = sp
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7D690
 * @ordinalOrName D2Game_6FC7D690
 */
export function D2Game_6FC7D690_113c(m: D2KernMemory113c, pObjInteractArg: number): number {
  hitD2GameVa113c(0x6FC7D690)
  const pGame = m.u32(pObjInteractArg >>> 0) >>> 0
  const pQuestCtrl = pGame !== 0 ? m.u32((pGame + 0x10f4) >>> 0) >>> 0 : 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) >>> 0) === 0x23) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return 0

  const pObject = m.u32((pObjInteractArg + 0x04) >>> 0) >>> 0
  const pQuestData = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const objMode = pObject !== 0 ? m.u32((pObject + 0x10) >>> 0) >>> 0 : 0

  if (objMode === 0) {
    if (m.u8(pQuestData) === 0) {
      UNITS_ChangeAnimMode113c(m, pObject, 1)
      m.setU32((pQuestData + 0x60) >>> 0, 2)
      return 0
    }
    D2Game_6FCE8950_113c(m, pObjInteractArg)
    return 0
  }

  if (objMode === 2) {
    if (m.u8(pQuestData) === 0) {
      const pPlayer = m.u32((pObjInteractArg + 0x08) >>> 0) >>> 0
      SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer)
    } else if (m.u8((pQuestData + 0x48) >>> 0) !== 0) {
      UNITS_ChangeAnimMode113c(m, pObject, 0)
      m.setU32((pQuestData + 0x60) >>> 0, 0)
    }
  } else if (objMode !== 1) {
    return 0
  }

  if (m.u8(pQuestData) === 0) {
    const pPlayer = m.u32((pObjInteractArg + 0x08) >>> 0) >>> 0
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer)
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInteractArg + 0x04) >>> 0), 2)
    return 0
  }
  m.setU32((pQuestData + 0x60) >>> 0, 0)
  UNITS_ChangeAnimMode113c(m, m.u32((pObjInteractArg + 0x04) >>> 0), 0)
  return 0
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7DF70
 * @ordinalOrName D2Game_6FC7DF70
 */
export function D2Game_6FC7DF70_113c(m: D2KernMemory113c, pObjInteractArg: number): number {
  hitD2GameVa113c(0x6FC7DF70)
  const pGame = m.u32(pObjInteractArg);
  const pQuestCtrl = m.u32(pGame + 0x10f4);
  if (pQuestCtrl === 0) return 0;
  let pQuest = m.u32(pQuestCtrl);
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x24) break;
    pQuest = m.u32(pQuest + 0xf4);
  }
  if (pQuest === 0) return 0;
  const pPlayer = m.u32(pObjInteractArg + 8);
  const pRoom = UNITS_GetRoom113c(m, pPlayer);
  if (pRoom === 0) return 0;
  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom);
  if (levelId === 0x83) {
    const pQuestData = m.u32(pQuest + 0x18);
    if (m.u8(pQuestData + 0x86) === 1) {
      D2Game_6FCBE170_113c(m, pPlayer, 0x84, pGame, 0x0b);
    }
    return 0;
  }
  D2Game_6FCBE170_113c(m, pPlayer, 0x83, pGame, 0);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC7E2A0
 * @ordinalOrName D2Game_6FC7E2A0
 */
export function D2Game_6FC7E2A0_113c(m: D2KernMemory113c, pObjInteractArg: number): number {
  hitD2GameVa113c(0x6FC7E2A0)
  const pGame = m.u32(pObjInteractArg);
  const pQuestCtrl = m.u32(pGame + 0x10f4);
  if (pQuestCtrl === 0) return 0;
  let pQuest = m.u32(pQuestCtrl);
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x23) break;
    pQuest = m.u32(pQuest + 0xf4);
  }
  if (pQuest === 0) return 0;
  const pPlayer = m.u32(pObjInteractArg + 8);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDiff = m.u8(pGame + 0x6d);
  const pQuestFlags = m.u32(pPlayerData + nDiff * 4 + 0x10);
  const nQuestId = m.u32(pQuest + 0xe0);
  const done0 = QUESTS_GetGlobalState113c(m, pQuestFlags, nQuestId, 0);
  const done1 = done0 !== 0 ? 1 : QUESTS_GetGlobalState113c(m, pQuestFlags, nQuestId, 1);
  const pQuestData = m.u32(pQuest + 0x18);
  if (
    done1 === 0 ||
    (m.u8(pQuest + 9) !== 0 && m.u8(pQuestData) === 0) ||
    (m.u8(pQuestData + 0x48) !== 0 && m.u8(pQuestData) === 0)
  ) {
    SUNIT_SendUnitSpeech113c(m, pPlayer, 0x13);
    return 0;
  }
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32(pObjInteractArg + 0x10));
  const pObject = m.u32(pObjInteractArg + 4);
  const mode = pObject !== 0 ? m.u32(pObject + 0x10) : 0;
  if (mode === 0) {
    UNITS_ChangeAnimMode113c(m, pObject, 1);
    const pRoom = UNITS_GetRoom113c(m, pObject);
    DUNGEON_ToggleRoomTileStandableFlag113c(m, pRoom, 0);
    const frame = ((m.u32(pObjTxt + 0xdc) >>> 8) + m.u32(pGame + 0xa8)) >>> 0;
    EVENT_SetEventFull113c(m, pGame, pObject, 1, frame, 0, 0, 0);
    return 0;
  }
  if (mode === 2) {
    D2Game_6FCE8950_113c(m, pObjInteractArg);
    const pRoom = UNITS_GetRoom113c(m, m.u32(pObjInteractArg + 4));
    DUNGEON_ToggleRoomTileStandableFlag113c(m, pRoom, 1);
    return 0;
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8D620
 * @ordinalOrName D2Game_6FC8D620
 */
export function D2Game_6FC8D620_113c(m: D2KernMemory113c, pObjInteractArg: number): number {
  hitD2GameVa113c(0x6FC8D620)
  const pObject = m.u32(pObjInteractArg + 4);
  const pRoom = UNITS_GetRoom113c(m, pObject);
  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom);
  if (pObject === 0 || m.u32(pObject + 0x10) === 0) {
    UNITS_ChangeAnimMode113c(m, pObject, 1);
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32(pObjInteractArg + 0x10));
    const pGame = m.u32(pObjInteractArg);
    const frame = ((m.u32(pObjTxt + 0xdc) >>> 8) + m.u32(pGame + 0xa8) + 1) >>> 0;
    EVENT_SetEventFull113c(m, pGame, pObject, 1, frame, 0, 0, 0);
    return 0;
  }
  if (levelId === 0x4a) {
    const pGame = m.u32(pObjInteractArg);
    D2Game_6FCBE170_113c(m, m.u32(pObjInteractArg + 8), 0x36, pGame, 0);
    const pQuestCtrl = m.u32(pGame + 0x10f4);
    if (pQuestCtrl !== 0) {
      let pQuest = m.u32(pQuestCtrl);
      while (pQuest !== 0) {
        if (m.u32(pQuest) === 0x0b) {
          const pQData = m.u32(pQuest + 0x18);
          if (m.u16(pQData + 0x44) === 0) {
            m.setU16(pQData + 0x44, 1);
            m.setU16(pQData + 0x42, 2);
          }
          break;
        }
        pQuest = m.u32(pQuest + 0xf4);
      }
    }
    return 0;
  }
  if (levelId === 0x36) {
    const pGame = m.u32(pObjInteractArg);
    D2Game_6FCBE170_113c(m, m.u32(pObjInteractArg + 8), 0x4a, pGame, 0x0b);
    const pQuestCtrl = m.u32(pGame + 0x10f4);
    if (pQuestCtrl !== 0) {
      let pQuest = m.u32(pQuestCtrl);
      while (pQuest !== 0) {
        if (m.u32(pQuest) === 0x0b) {
          const pQData = m.u32(pQuest + 0x18);
          if (m.u16(pQData + 0x42) === 0) {
            m.setU16(pQData + 0x42, 1);
            m.setU16(pQData + 0x44, 2);
          }
          break;
        }
        pQuest = m.u32(pQuest + 0xf4);
      }
    }
    return 0;
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8E930
 * @ordinalOrName D2Game_6FC8E930
 */
export function D2Game_6FC8E930_113c(
  m: D2KernMemory113c,
  nWaypointUnitGuid: number,
  pGame: number,
  pPlayer: number,
  wDestLevelId: number,
): void {
  hitD2GameVa113c(0x6FC8E930)
  if (pGame === 0) {
    FOG_Assertion113c(m, 0x2d3, 0x6fd19ff9);
  }
  let pWpObj = m.u32(pGame + ((nWaypointUnitGuid & 0x7f) * 4 + 0x1520));
  while (pWpObj !== 0 && m.u32(pWpObj + 0x0c) !== (nWaypointUnitGuid >>> 0)) {
    pWpObj = m.u32(pWpObj + 0xe4);
  }
  if (pWpObj === 0) return;
  const pObjTxt = UNITS_GetObjectTxtRecordFromObject113c(m, pWpObj);
  if (pObjTxt === 0) return;
  const opFnIdx = m.u8(pObjTxt + 0x1b3);
  if (opFnIdx >= 0x65 || m.u32(0x6fd27bb8 + opFnIdx * 4) !== 0x6fc8cf90) return;
  const destLevelId = wDestLevelId & 0xffff;
  const wpRoom = UNITS_GetRoom113c(m, pWpObj);
  const wpLevelId = DUNGEON_GetLevelIdFromRoom113c(m, wpRoom);
  m.setU32(pPlayer + 0x64, 0xffffffff);
  m.setU32(pPlayer + 0x68, 6);
  m.setU8(pPlayer + 0x6c, 0);
  if (wpLevelId === destLevelId || destLevelId === 0) return;
  const pWpHistory = PLAYER_GetWaypointHistoryFlags113c(m, pPlayer, pGame);
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x40) >>> 0;
  try {
    if (DATATBLS_GetWaypointIndexByLevelId113c(m, destLevelId, sp + 0x10) === 0) return;
    if (WAYPOINTS_GetWaypointFlag113c(m, pWpHistory, m.u16(sp + 0x10)) === 0) return;
    const bIsTown = DUNGEON_IsTownLevelId113c(m, destLevelId);
    const nWarpType =
      bIsTown !== 0 ||
      destLevelId === 0x2e ||
      destLevelId === 0x4a ||
      destLevelId === 0x85 ||
      destLevelId === 0x86 ||
      destLevelId === 0x87 ||
      destLevelId === 0x88
        ? 0x0d
        : 0;
    D2Game_6FCBE170_113c(m, pPlayer, destLevelId, pGame, nWarpType);
    const pNewRoom = UNITS_GetRoom113c(m, pPlayer);
    if (pNewRoom !== 0) {
      const destAct = DRLG_GetActNoFromLevelId113c(m, destLevelId) & 0xff;
      const pAct = m.u32(pGame + destAct * 4 + 0xbc);
      const pFoundRoom = DUNGEON_FindActSpawnLocation113c(m, pAct, destLevelId, nWarpType, sp + 0x1c, sp + 0x14);
      if (pNewRoom === pFoundRoom) {
        let pClient = 0;
        if (m.u32(pPlayer) === 0) {
          const pPData = UNITS_GetPlayerData113c(m, pPlayer);
          pClient = m.u32(pPData + 0x9c);
        }
        const playerGuid = m.u32(pPlayer + 0x0c);
        UNITS_GetCoords113c(m, pPlayer, sp + 0x24);
        const x = m.u32(sp + 0x24);
        const y = m.u32(sp + 0x28);
        PLAYER_StartModeAtCoords113c(m, pGame, pPlayer, 2, x, y, 0);
        const pkt = sp + 0x24;
        m.setU16(pkt + 7, (x + 3) & 0xffff);
        m.setU8(pkt, 0x0d);
        m.setU8(pkt + 1, 0);
        m.setU32(pkt + 2, playerGuid);
        m.setU8(pkt + 6, 1);
        m.setU16(pkt + 9, (y + 3) & 0xffff);
        m.setU8(pkt + 11, 0);
        m.setU8(pkt + 12, 0);
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt, 0x0d);
      }
    }
    OBJRGN_PrependObjectCoordNode_6FC2B800_113c(m, pGame, pPlayer, pNewRoom);
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC8F4F0
 * @ordinalOrName D2Game_6FC8F4F0
 */
export function D2Game_6FC8F4F0_113c(m: D2KernMemory113c, pObjInteractArg: number): number {
  hitD2GameVa113c(0x6FC8F4F0)
  const pObject = m.u32(pObjInteractArg + 4);
  if (pObject !== 0) {
    const mode = m.u32(pObject + 0x10) & 0xffff;
    if (mode === 2) {
      return D2Game_6FC8DFC0_113c(m, pObjInteractArg);
    }
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC91E10
 * @ordinalOrName D2Game_6FC91E10
 */
export function D2Game_6FC91E10_113c(
  m: D2KernMemory113c,
  pPlayer1: number,
  pGame: number,
  pPlayer2: number,
): number {
  hitD2GameVa113c(0x6FC91E10)
  let pClient2 = 0;
  if (pPlayer2 !== 0 && m.u32(pPlayer2) === 0) {
    const pPData2 = UNITS_GetPlayerData113c(m, pPlayer2);
    pClient2 = m.u32(pPData2 + 0x9c);
  }
  const bExpansion = m.u8(pClient2 + 0x0a) & 4;
  let pItem = INVENTORY_GetFirstItem113c(m, m.u32(pPlayer2 + 0x60));
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x30) >>> 0;
  try {
    while (pItem !== 0) {
      const pRealItem = INVENTORY_UnitIsItem113c(m, pItem);
      const pNextItem = INVENTORY_GetNextItem113c(m, pItem);
      if ((ITEMS_GetInvPage113c(m, pRealItem) & 0xff) === 2) {
        const pDup = ITEMS_Duplicate113c(m, pGame, pRealItem, 0);
        if (pDup !== 0) {
          PLRTRADE_SyncClonedItemEarOrPersonalizedData113c(m, pDup, pRealItem, bExpansion);
          UNITS_ChangeAnimMode113c(m, pDup, 4);
          ITEMS_SetInvPage113c(m, pDup, 0);
          const dupGuid = m.u32(pDup + 0x0c);
          let bOk = false;
          if (pGame !== 0 && pPlayer1 !== 0) {
            ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer1);
            let pFoundItem = m.u32(pGame + ((dupGuid & 0x7f) * 4 + 0x1720));
            while (pFoundItem !== 0 && m.u32(pFoundItem + 0x0c) !== dupGuid) {
              pFoundItem = m.u32(pFoundItem + 0xe4);
            }
            if (pFoundItem !== 0 && m.u32(pFoundItem) === 4 && m.u32(pFoundItem + 0x10) === 4) {
              const invPage = ITEMS_GetInvPage113c(m, pFoundItem) & 0xff;
              const pInv1 = m.u32(pPlayer1 + 0x60);
              if (pInv1 !== 0) {
                let bUpdate1 = 1;
                let bUpdateMerc = 0;
                const gridType = UNITS_GetInventoryGridType113c(m, pPlayer1, invPage, m.u32(pGame + 0x70));
                if (m.u32(pPlayer1) === 0) {
                  if (invPage === 1) {
                    bUpdate1 = 0;
                  } else if (invPage === 2) {
                    bUpdateMerc = 1;
                  }
                }
                if (
                  INVENTORY_PlaceItemAtFreePosition113c(m, pInv1, pFoundItem, gridType, 0, invPage, 0x6fd1bd3c, 0x9cc) !== 0 &&
                  INVENTORY_AddItemToTradeInventory113c(m, pInv1, pFoundItem, 1) !== 0
                ) {
                  if ((ITEMS_GetInvPage113c(m, pFoundItem) & 0xff) !== 4) {
                    ITEMS_OnEquipScrollOrTome113c(m, pFoundItem, pPlayer1);
                  }
                  m.setU32(pFoundItem + 0xc4, (m.u32(pFoundItem + 0xc4) & ~2) >>> 0);
                  if (ITEMS_CanUpdateSocketStats113c(m, pFoundItem, pPlayer1) !== 0) {
                    ITEMS_ActivateEquippedItemStats113c(m, pPlayer1, pFoundItem, 0);
                  }
                  if (bUpdate1 !== 0) {
                    INVENTORY_SetInventoryUpdateFlag113c(m, pInv1, 0);
                  }
                  UNITS_ChangeAnimMode113c(m, pFoundItem, 0);
                  ITEMS_SetItemFlag113c(m, pFoundItem, 2, 1);
                  if (ITEMS_HasSocketedSubItems113c(m, pFoundItem) !== 0) {
                    ITEMS_SetOrClearCommandFlags113c(m, pFoundItem, 1, 1);
                  }
                  if (ITEMS_CheckItemFlag113c(m, pFoundItem, 0x4000, 0x8ef, 0x6fd1b14c) !== 0) {
                    ITEMS_SetOrClearCommandFlags113c(m, pFoundItem, 0x4000, 0);
                  }
                  UNITS_UpdateInventoryItems113c(m, pPlayer1, 1);
                  INVENTORY_AppendRecord113c(m, pInv1, pFoundItem);
                  if (bUpdateMerc === 1) {
                    D2Game_6FC91B00_113c(m, pFoundItem, pGame, pPlayer1);
                  }
                  if (ITEMS_CanUpdateSocketStats113c(m, pFoundItem, pPlayer1) !== 0) {
                    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlayer1, 0);
                    UNITS_UpdateInventoryItems113c(m, pPlayer1, 1);
                  }
                  bOk = true;
                  if (
                    m.u32(pRealItem) === 4 &&
                    ITEMS_IsSocketable113c(m, pRealItem) !== 0 &&
                    m.u32(pRealItem + 0x60) !== 0 &&
                    INVENTORY_GetItemCount113c(m, m.u32(pRealItem + 0x60)) > 0
                  ) {
                    if (ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c(m, pRealItem, pGame, pPlayer1, pDup, 1) === 0) {
                      let c2 = 0;
                      if (m.u32(pPlayer2) === 0) {
                        c2 = m.u32(UNITS_GetPlayerData113c(m, pPlayer2) + 0x9c);
                      }
                      m.setU8(sp, 0x77);
                      m.setU8(sp + 1, 0x0a);
                      NET_QueuePacketToClientBuffer113c(m, c2, 1, sp, 2);
                      let c1 = 0;
                      if (pPlayer1 !== 0 && m.u32(pPlayer1) === 0) {
                        c1 = m.u32(UNITS_GetPlayerData113c(m, pPlayer1) + 0x9c);
                      }
                      m.setU8(sp, 0x77);
                      m.setU8(sp + 1, 0x09);
                      NET_QueuePacketToClientBuffer113c(m, c1, 1, sp, 2);
                      return 0;
                    }
                  }
                }
              }
            }
          }
          if (!bOk) {
            let c2 = 0;
            if (m.u32(pPlayer2) === 0) {
              c2 = m.u32(UNITS_GetPlayerData113c(m, pPlayer2) + 0x9c);
            }
            m.setU8(sp, 0x77);
            m.setU8(sp + 1, 0x0a);
            NET_QueuePacketToClientBuffer113c(m, c2, 1, sp, 2);
            let c1 = 0;
            if (pPlayer1 !== 0 && m.u32(pPlayer1) === 0) {
              c1 = m.u32(UNITS_GetPlayerData113c(m, pPlayer1) + 0x9c);
            }
            m.setU8(sp, 0x77);
            m.setU8(sp + 1, 0x09);
            NET_QueuePacketToClientBuffer113c(m, c1, 1, sp, 2);
            return 0;
          }
        }
      }
      pItem = pNextItem;
    }
    let c2 = 0;
    if (m.u32(pPlayer2) === 0) {
      c2 = m.u32(UNITS_GetPlayerData113c(m, pPlayer2) + 0x9c);
    }
    pItem = INVENTORY_GetFirstItem113c(m, m.u32(pPlayer2 + 0x60));
    while (pItem !== 0) {
      const pNext = INVENTORY_GetNextItem113c(m, pItem);
      const pReal = INVENTORY_UnitIsItem113c(m, pItem);
      const page = ITEMS_GetInvPage113c(m, pReal) & 0xff;
      if (page === 1 || page === 2) {
        if (page === 2) {
          ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c(m, pReal, pPlayer2);
        }
        m.setU32(sp + 0x10, 0);
        INVENTORY_AllocTradeRecord113c(m, sp + 0x10, 0x20, 1);
        ITEMS_GetHoradricCubeFlag113c(m, pReal, page);
        NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(m, pReal, pPlayer2, c2, m.u32(sp + 0x10));
        ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, pPlayer2, pReal, pGame, 0);
      }
      pItem = pNext;
    }
    return 1;
  } finally {
    k2W13B1StackPtr = sp;
  }
}

function scaleCubeLevelFactor113c(val: number, pct: number): number {
  if ((val | 0) > 0x100000) {
    if (((val & 0xfffffff0) | 0) < 0x640) {
      return CRT_alldiv113c(BigInt(val | 0) * BigInt(pct | 0), 100n);
    }
    return Math.imul(Math.trunc((val | 0) / 100), pct | 0) | 0;
  }
  if ((pct | 0) > 0x10000) {
    if (((pct & 0xfffffff0) | 0) < 0x640) {
      return CRT_alldiv113c(BigInt(val | 0) * BigInt(pct | 0), 100n);
    }
    return Math.imul(Math.trunc((pct | 0) / 100), val | 0) | 0;
  }
  return Math.trunc(Math.imul(val | 0, pct | 0) / 100) | 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FC92220
 * @ordinalOrName D2Game_6FC92220
 */
export function D2Game_6FC92220_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pCubeTxt: number,
  pOutputArgs: number,
): number {
  hitD2GameVa113c(0x6FC92220)
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x130) >>> 0;
  try {
    for (let k = 0; k < 0x48; k += 4) m.setU32(sp + k, 0);
    let bApplyMods = 1;
    let bHasOutput = 0;
    let nSocketReturnCount = 0;

    for (let i = 0; i < 3; i++) {
      const pOutDef = (pCubeTxt + i * 0x54 + 0x4c) >>> 0;
      const flags0 = m.u8(pOutDef);
      m.setU32(sp + 0x28 + i * 4, 0);
      if ((flags0 & 0x30) !== 0) {
        m.setU32(sp + 0x3c + i * 4, 1);
      }
      let ilvl = 0;
      const lvlFixed = m.u8(pOutDef + 9);
      if (lvlFixed !== 0) {
        ilvl = lvlFixed;
      } else {
        const plvlPct = m.u8(pOutDef + 0x0a);
        if (plvlPct !== 0) {
          const clvl = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0c, 0);
          ilvl = scaleCubeLevelFactor113c(clvl, plvlPct);
        }
        const ilvlPct = m.u8(pOutDef + 0x0b);
        if (ilvlPct !== 0) {
          const srcIlvl = signedU32(m, pOutputArgs + i * 12 + 8);
          ilvl = (ilvl + scaleCubeLevelFactor113c(srcIlvl, ilvlPct)) | 0;
        }
      }
      const maxLvl = DATATBLS_GetMaxLevel113c(m, 0);
      let clampedIlvl = ilvl > 1 ? ilvl : 1;
      if (clampedIlvl >= (maxLvl | 0)) clampedIlvl = maxLvl | 0;
      let nQuality = m.u8(pOutDef + 8);
      if (nQuality > 0 && nQuality < 4) {
        const fnPtr = m.u32((0x6fd1a5e8 + nQuality * 4) >>> 0) >>> 0;
        if (fnPtr !== 0) {
          switch (fnPtr) {
            case 0x6fc92210:
              bHasOutput = CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c(m, pGame, pPlayer) | 0;
              break;
            case 0x6fc90180:
              bHasOutput = PLRTRADE_TradeButtonNoopAction2_113c(m, pGame, pPlayer) | 0;
              break;
            case 0x6fc90170:
              bHasOutput = PLRTRADE_TradeButtonNoopAction3_113c(m, pGame, pPlayer) | 0;
              break;
            default:
              bHasOutput = 0;
              break;
          }
        }
      }
      const wFlags = m.u16(pOutDef);
      if ((wFlags & 1) !== 0) {
        const pEntry = (pOutputArgs + i * 12) >>> 0;
        const pSrcItem = m.u32(pEntry);
        ITEMS_SetInvPage113c(m, pSrcItem, 0xff);
        UNITS_ChangeAnimMode113c(m, pSrcItem, 4);
        const bCopySockets = m.u32(sp + 0x3c + i * 4) === 0 ? 1 : 0;
        const pDup = ITEMS_Duplicate113c(m, pGame, pSrcItem, bCopySockets);
        let newCode = 0;
        nQuality = m.u8(pOutDef + 8);
        if (nQuality === 0xfe) {
          const c = signedU32(m, pEntry + 4);
          if (c >= 0) newCode = c >>> 0;
        } else if (nQuality === 0xff) {
          newCode = m.u32(pEntry + 4);
        } else if (nQuality === 0xfc) {
          newCode = m.u16(pOutDef + 2);
        } else if (nQuality === 0xfd) {
          newCode = CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c(m, pGame, clampedIlvl, m.u16(pOutDef + 2)) & 0xffff;
        }
        if (pDup !== 0) {
          m.setU32(pDup + 4, newCode);
        }
        m.setU32(sp + 0x18, pDup);
        ITEMS_InitCreatedItemStats_6FC31070_113c(m, pGame, sp + 0x18, 0, 0);
        const pInitDup = m.u32(sp + 0x18);
        m.setU32(sp + 0x28 + i * 4, pInitDup);
        UNITS_ChangeAnimMode113c(m, pInitDup, 4);
        ITEMS_SetInvPage113c(m, pSrcItem, 3);
      } else if (nQuality === 0xfe) {
        const pSrcItem = m.u32(pOutputArgs + i * 12);
        ITEMS_SetInvPage113c(m, pSrcItem, 0xff);
        UNITS_ChangeAnimMode113c(m, pSrcItem, 4);
        const bCopySockets = m.u32(sp + 0x3c + i * 4) === 0 ? 1 : 0;
        const pDup = ITEMS_Duplicate113c(m, pGame, pSrcItem, bCopySockets);
        m.setU32(sp + 0x28 + i * 4, pDup);
        UNITS_ChangeAnimMode113c(m, pDup, 4);
        ITEMS_SetInvPage113c(m, pSrcItem, 3);
        if (m.u8(pOutDef + 6) === 9) {
          const fmt = ITEMS_GetItemFormat113c(m, pDup) & 0xffff;
          const prefix =
            fmt >= 1 ? ITEMS_RollRarePrefixId_6FC34210_113c(m, 1, pDup) : ITEMS_RollRareSuffixId_6FC34370_113c(m, 1, pDup);
          const fmt2 = ITEMS_GetItemFormat113c(m, pDup) & 0xffff;
          const suffix =
            fmt2 >= 1 ? ITEMS_RollRarePrefixId_6FC34210_113c(m, 0, pDup) : ITEMS_RollRareSuffixId_6FC34370_113c(m, 0, pDup);
          if ((prefix & 0xffff) !== 0 && (suffix & 0xffff) !== 0) {
            ITEMS_SetItemQuality113c(m, pDup, 9);
            ITEMS_SetRarePrefix113c(m, pDup, prefix);
            ITEMS_SetRareSuffix113c(m, pDup, suffix);
          } else {
            bApplyMods = 0;
          }
        }
      } else {
        let wParam = m.u16(pOutDef + 4);
        let bOutQual = m.u8(pOutDef + 6);
        let nUniqueIdx = -1;
        let outCode = 0;
        let bSpawned = true;
        if (nQuality === 0xff) {
          const pEntry = (pOutputArgs + i * 12) >>> 0;
          outCode = m.u32(pEntry + 4);
          if ((wFlags & 0x40) !== 0) {
            const pSrcItem = m.u32(pEntry);
            if (pSrcItem !== 0) {
              bOutQual = ITEMS_GetItemQuality113c(m, pSrcItem) & 0xff;
              const fileIdx = ITEMS_GetFileIndex113c(m, pSrcItem);
              wParam = ((fileIdx | 0) + 1) & 0xffff;
              clampedIlvl = ITEMS_GetItemLevel113c(m, pSrcItem);
              if (bOutQual === 7) {
                const maskWord = m.u32(pGame + (fileIdx >> 5) * 4 + 0x1b24);
                const bitTbl = m.u32(0x6fd18be0);
                const bit = bitTbl !== 0 ? m.u32(bitTbl + (fileIdx & 0x1f) * 4) : (1 << (fileIdx & 0x1f)) >>> 0;
                if ((maskWord & bit) === 0) {
                  nUniqueIdx = fileIdx;
                }
              }
            }
          }
        } else if (nQuality === 0xfc) {
          outCode = m.u16(pOutDef + 2);
        } else if (nQuality === 0xfd) {
          outCode = CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c(m, pGame, clampedIlvl, m.u16(pOutDef + 2)) & 0xffff;
        } else {
          bSpawned = false;
        }
        if (bSpawned) {
          const dropBase = (sp + 0x58) >>> 0;
          for (let k = 0; k < 0x84; k += 4) m.setU32(dropBase + k, 0);
          m.setU32(dropBase, pPlayer);
          m.setU32(dropBase + 0x08, pGame);
          m.setU32(dropBase + 0x0c, clampedIlvl);
          m.setU32(dropBase + 0x14, outCode);
          m.setU32(dropBase + 0x18, 4);
          m.setU16(dropBase + 0x28, 1);
          m.setU16(dropBase + 0x2a, m.u16(pGame + 0x78));
          m.setU32(dropBase + 0x30, bOutQual);
          m.setU32(dropBase + 0x40, wParam);
          m.setU32(dropBase + 0x68, m.u16(pOutDef + 0x0c));
          m.setU32(dropBase + 0x6c, m.u16(pOutDef + 0x0e));
          m.setU32(dropBase + 0x70, m.u16(pOutDef + 0x10));
          m.setU32(dropBase + 0x74, m.u16(pOutDef + 0x12));
          m.setU32(dropBase + 0x78, m.u16(pOutDef + 0x14));
          m.setU32(dropBase + 0x7c, m.u16(pOutDef + 0x16));
          let dropFlags = (wFlags & 2) !== 0 && m.u8(pOutDef + 7) === 0 ? 0x10 : 0x08;
          dropFlags |= (wFlags & 4) !== 0 ? 4 : 2;
          m.setU32(dropBase + 0x80, dropFlags);
          const pCreated = D2GAME_CreateItemEx_6FC31490_113c(m, pGame, dropBase, 0) >>> 0;
          m.setU32(sp + 0x28 + i * 4, pCreated);
          if (nUniqueIdx >= 0) {
            const invTbl = m.u32(0x6fd18bac);
            const invMask =
              invTbl !== 0 ? m.u32(invTbl + (nUniqueIdx & 0x1f) * 4) : ~(1 << (nUniqueIdx & 0x1f)) >>> 0;
            const slotAddr = (pGame + (nUniqueIdx >> 5) * 4 + 0x1b24) >>> 0;
            m.setU32(slotAddr, (m.u32(slotAddr) & invMask) >>> 0);
          }
        }
      }

      const pOutItem = m.u32(sp + 0x28 + i * 4);
      if (pOutItem === 0) continue;
      bHasOutput = 1;
      if (m.u32(sp + 0x3c + i * 4) !== 0) {
        if (m.u32(pOutItem) === 4 && (STATLIST_GetUnitAlignment113c(m, pOutItem) & 0x4000000) !== 0) {
          ITEMS_SetOrClearCommandFlags113c(m, pOutItem, 0x4000000, 0);
          ITEMS_SetEarLevel113c(m, pOutItem, 0, 0);
          const pStatList = STATLIST_GetStatListFromUnitAndState113c(m, pOutItem, 0xab, 0x40);
          if (pStatList !== 0) {
            STATLIST_UnlinkStatList113c(m, pOutItem, pStatList);
            STATLIST_FreeStatListEx113c(m, pStatList);
          }
        }
        if ((m.u8(pOutDef) & 0x20) !== 0) {
          const pSrcItem = m.u32(pOutputArgs + i * 12);
          if (pSrcItem !== 0 && m.u32(pSrcItem + 0x60) !== 0) {
            let pSockNode = INVENTORY_GetFirstItem113c(m, m.u32(pSrcItem + 0x60));
            while (pSockNode !== 0) {
              const pNextSock = INVENTORY_GetNextItem113c(m, pSockNode);
              const pSockItem = INVENTORY_UnitIsItem113c(m, pSockNode);
              if (pSockItem !== 0) {
                const pSockDup = ITEMS_Duplicate113c(m, pGame, pSockItem, 1);
                if (pSockDup !== 0) {
                  ITEMS_SetInvPage113c(m, pSockDup, 0xff);
                  UNITS_ChangeAnimMode113c(m, pSockDup, 4);
                  m.setU32(sp + 0xdc + nSocketReturnCount * 4, pSockDup);
                  nSocketReturnCount++;
                }
              }
              pSockNode = pNextSock;
            }
          }
        }
      }

      if (bApplyMods !== 0) {
        for (let mIdx = 0; mIdx < 5; mIdx++) {
          const pMod = (pOutDef + 0x18 + mIdx * 12) >>> 0;
          const modId = signedU32(m, pMod);
          if (modId >= 0) {
            const chance = m.u8(pMod + 10);
            let bPass = true;
            if (chance > 0 && chance < 100) {
              const roll = (stepSeed64At113c(m, (pOutItem + 0x20) >>> 0) >>> 0) % 100;
              if (roll > chance) bPass = false;
            }
            if (bPass) {
              m.setU32(sp + 0x48, modId);
              m.setU32(sp + 0x4c, signedU16(m, pMod + 4));
              m.setU32(sp + 0x50, signedU16(m, pMod + 6));
              m.setU32(sp + 0x54, signedU16(m, pMod + 8));
              ITEMS_AssignProperty113c(m, pOutItem, sp + 0x48, m.u32(pGame + 0x70));
            }
          }
        }
      }

      if ((m.u8(pOutDef + 1) & 2) !== 0) {
        if (ITEMS_CheckIfStackable113c(m, pOutItem) !== 0) {
          const maxQtyCfg = m.u8(pOutDef + 7);
          if (maxQtyCfg > 0) {
            let maxStack = ITEMS_GetTotalMaxStack113c(m, pOutItem);
            if ((maxStack | 0) >= maxQtyCfg) maxStack = maxQtyCfg;
            STATLIST_SetUnitStat113c(m, pOutItem, 0x46, maxStack, 0);
          }
        }
        if (ITEMS_CheckItemFlag113c(m, pOutItem, 0x100, 0x501, 0x6fd1bd3c) !== 0) {
          ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c(m, pPlayer, pOutItem, pGame);
        } else {
          const maxDur = STATLIST_UnitGetStatValue113c(m, pOutItem, 0x49, 0);
          const curDur = STATLIST_GetUnitBaseStat113c(m, pOutItem, 0x48, 0);
          if ((curDur | 0) < (maxDur | 0)) {
            STATLIST_SetUnitStat113c(m, pOutItem, 0x48, maxDur, 0);
          }
        }
      }

      if ((m.u8(pOutDef + 1) & 4) !== 0) {
        ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(m, pGame, pPlayer, pOutItem);
      }

      const qtyOrSock = m.u8(pOutDef + 7);
      if ((m.u8(pOutDef) & 2) !== 0) {
        if (
          qtyOrSock !== 0 &&
          STATLIST_UnitGetStatValue113c(m, pOutItem, 0xc2, 0) === 0 &&
          (STATLIST_GetUnitAlignment113c(m, pOutItem) & 0x800) === 0
        ) {
          let nSockets = ITEMS_GetMaxSockets113c(m, pOutItem) & 0xff;
          if (nSockets >= qtyOrSock) nSockets = qtyOrSock;
          const qIdx = (ITEMS_GetItemQuality113c(m, pOutItem) - 4) >>> 0;
          if (qIdx === 0 || qIdx === 5) {
            if (nSockets > 3) nSockets = 3;
          } else if (qIdx >= 1 && qIdx <= 4) {
            if (nSockets > 1) nSockets = 1;
          }
          if (nSockets > 0) {
            ITEMS_SetOrClearCommandFlags113c(m, pOutItem, 0x800, 1);
            ITEMS_AddSockets113c(m, pOutItem, nSockets);
          }
        }
      } else if (qtyOrSock !== 0 && ITEMS_CheckIfStackable113c(m, pOutItem) !== 0) {
        let maxStack = ITEMS_GetTotalMaxStack113c(m, pOutItem);
        if ((maxStack | 0) >= qtyOrSock) maxStack = qtyOrSock;
        STATLIST_SetUnitStat113c(m, pOutItem, 0x46, maxStack, 0);
      }
    }

    if (bHasOutput === 0) return 0;

    let pClient = 0;
    if (pPlayer !== 0 && m.u32(pPlayer) === 0) {
      pClient = m.u32(UNITS_GetPlayerData113c(m, pPlayer) + 0x9c);
    }
    ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c(m, pPlayer, pClient, pGame);
    if (pPlayer === 0) {
      FOG_Assertion113c(m, 0x558, 0x6fd19ff9);
      return 0;
    }
    m.setU16(pPlayer + 0x6e, 4);
    m.setU32(pPlayer + 0x70, pPlayer);
    UNITS_RefreshInventory113c(m, pPlayer);
    m.setU32(pPlayer + 0xc4, (m.u32(pPlayer + 0xc4) | 0x400) >>> 0);

    const placeCubeItem = (pItemUnit: number, lineNo: number): boolean => {
      ITEMS_SetInvPage113c(m, pItemUnit, 3);
      const guid = m.u32(pItemUnit + 0x0c);
      if (pGame === 0) return false;
      ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer);
      let pFound = m.u32(pGame + ((guid & 0x7f) * 4 + 0x1720));
      while (pFound !== 0 && m.u32(pFound + 0x0c) !== guid) {
        pFound = m.u32(pFound + 0xe4);
      }
      if (pFound === 0 || m.u32(pFound) !== 4 || m.u32(pFound + 0x10) !== 4) return false;
      const invPage = ITEMS_GetInvPage113c(m, pFound) & 0xff;
      const pInv = m.u32(pPlayer + 0x60);
      if (pInv === 0) return false;
      let bUpd1 = 1;
      let bUpdMerc = 0;
      const gridType = UNITS_GetInventoryGridType113c(m, pPlayer, invPage, m.u32(pGame + 0x70));
      if (m.u32(pPlayer) === 0) {
        if (invPage === 1) bUpd1 = 0;
        else if (invPage === 2) bUpdMerc = 1;
      }
      if (
        INVENTORY_PlaceItemAtFreePosition113c(m, pInv, pFound, gridType, 0, invPage, 0x6fd1bd3c, lineNo) === 0 ||
        INVENTORY_AddItemToTradeInventory113c(m, pInv, pFound, 1) === 0
      ) {
        return false;
      }
      if ((ITEMS_GetInvPage113c(m, pFound) & 0xff) !== 4) {
        ITEMS_OnEquipScrollOrTome113c(m, pFound, pPlayer);
      }
      m.setU32(pFound + 0xc4, (m.u32(pFound + 0xc4) & ~2) >>> 0);
      if (ITEMS_CanUpdateSocketStats113c(m, pFound, pPlayer) !== 0) {
        ITEMS_ActivateEquippedItemStats113c(m, pPlayer, pFound, 0);
      }
      if (bUpd1 !== 0) {
        INVENTORY_SetInventoryUpdateFlag113c(m, pInv, 0);
      }
      UNITS_ChangeAnimMode113c(m, pFound, 0);
      ITEMS_SetItemFlag113c(m, pFound, 2, 1);
      if (ITEMS_HasSocketedSubItems113c(m, pFound) !== 0) {
        ITEMS_SetOrClearCommandFlags113c(m, pFound, 1, 1);
      }
      if (ITEMS_CheckItemFlag113c(m, pFound, 0x4000, 0x8ef, 0x6fd1b14c) !== 0) {
        ITEMS_SetOrClearCommandFlags113c(m, pFound, 0x4000, 0);
      }
      UNITS_UpdateInventoryItems113c(m, pPlayer, 1);
      INVENTORY_AppendRecord113c(m, pInv, pFound);
      if (bUpdMerc === 1) {
        D2Game_6FC91B00_113c(m, pFound, pGame, pPlayer);
      }
      if (ITEMS_CanUpdateSocketStats113c(m, pFound, pPlayer) !== 0) {
        D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlayer, 0);
        UNITS_UpdateInventoryItems113c(m, pPlayer, 1);
      }
      return true;
    };

    for (let i = 0; i < 3; i++) {
      const pOutItem = m.u32(sp + 0x28 + i * 4);
      if (pOutItem === 0) continue;
      if (!placeCubeItem(pOutItem, 0x558)) {
        SUNIT_RemoveUnit113c(m, pGame, pOutItem);
        continue;
      }
      ITEMS_SetOrClearCommandFlags113c(m, pOutItem, 0x10, 1);
      const pItemTxt = DATATBLS_GetItemsTxtRecord113c(m, m.u32(pOutItem + 4));
      if (m.u8(pItemTxt + 0x12a) !== 0) {
        const dwCode = m.u32(pItemTxt + 0x80);
        if (dwCode === 0x20747368) {
          ACT2Q2_OnStaffTransmuted113c(m, pPlayer, pGame);
        } else if (dwCode === 0x20326671) {
          ACT3Q2_OnKhalimFlailCreated113c(m, pPlayer, pGame);
        }
      }
    }

    for (let i = 0; i < nSocketReturnCount; i++) {
      const pSockDup = m.u32(sp + 0xdc + i * 4);
      if (pSockDup === 0) continue;
      if (!placeCubeItem(pSockDup, 0x579)) {
        SUNIT_RemoveUnit113c(m, pGame, pSockDup);
        continue;
      }
      ITEMS_SetOrClearCommandFlags113c(m, pSockDup, 0x10, 1);
    }

    return m.u32(sp + 0x28);
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC93570
 * @ordinalOrName D2Game_6FC93570
 */
export function D2Game_6FC93570_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _arg1 = 0,
  _arg2 = 0,
): void {
  hitD2GameVa113c(0x6FC93570)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const state = signedU32(m, pPlayerData + 0x50);
  if (state <= 4) return;
  if (state === 7) {
    m.setU32(pPlayerData + 0x50, 8);
    EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 1) >>> 0, 0, 0, 0);
    return;
  }
  if (state === 0x0e) {
    m.setU32(pPlayerData + 0x50, 0x0f);
    EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 1) >>> 0, 0, 0, 0);
    return;
  }
  const pTrade = m.u32(pPlayerData + 0x5c);
  if (state === 8) {
    if (pPlayer !== 0) {
      m.setU32(pPlayer + 0xc8, (m.u32(pPlayer + 0xc8) & 0xffbfffff) >>> 0);
    }
    if (m.u32(pTrade + 0x14) !== 0) {
      m.setU32(pPlayerData + 0x50, 0x0b);
      EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 0x7d) >>> 0, 0, 0, 0);
      return;
    }
    m.setU32(pPlayerData + 0x50, 3);
    return;
  }
  if (state === 0x0f) {
    if (pPlayer !== 0) {
      m.setU32(pPlayer + 0xc8, (m.u32(pPlayer + 0xc8) & 0xffbfffff) >>> 0);
    }
    m.setU32(pPlayerData + 0x50, 0x10);
    EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 5) >>> 0, 0, 0, 0);
    return;
  }
  if (state === 0x10) {
    if (m.u8(pPlayer + 0x6c) === 0 || m.u32(pPlayer + 0x68) !== 0) {
      EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 5) >>> 0, 0, 0, 0);
      return;
    }
    const pPartner = SUNIT_GetServerUnit113c(m, pGame, 0, m.u32(pPlayer + 0x64));
    if (pPartner === 0) {
      EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 5) >>> 0, 0, 0, 0);
      return;
    }
    const pPData1 = UNITS_GetPlayerData113c(m, pPlayer);
    const pPData2 = UNITS_GetPlayerData113c(m, pPartner);
    const s1 = m.u32(pPData1 + 0x50);
    const s2 = m.u32(pPData2 + 0x50);
    if (!((s1 === 1 || s1 === 2) && (s2 === 1 || s2 === 2))) {
      if (
        ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPlayer, pGame) !== 0 ||
        ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPartner, pGame) !== 0
      ) {
        EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 5) >>> 0, 0, 0, 0);
        return;
      }
    }
    D2Game_6FC919A0_113c(m, pGame, pPlayer, pPartner, pPData1, pPData2, 0x0c);
    const tick = m.u32(0x6fd18d10);
    m.setU32(pPData2 + 0x58, tick);
    m.setU32(pPData1 + 0x58, tick);
    return;
  }

  switch (state) {
    case 5: {
      m.setU32(pPlayerData + 0x50, 6);
      EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 1) >>> 0, 0, 0, 0);
      return;
    }
    case 6: {
      m.setU32(pPlayerData + 0x50, 3);
      if (pPlayer !== 0) {
        m.setU32(pPlayer + 0xc8, (m.u32(pPlayer + 0xc8) & 0xff3fffff) >>> 0);
      }
      return;
    }
    case 9: {
      m.setU32(pPlayerData + 0x50, 0x0a);
      EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 1) >>> 0, 0, 0, 0);
      return;
    }
    case 10:
    case 13: {
      m.setU32(pPlayerData + 0x50, 0);
      if (pPlayer !== 0) {
        m.setU32(pPlayer + 0xc8, (m.u32(pPlayer + 0xc8) & 0xff3fffff) >>> 0);
      }
      return;
    }
    case 11: {
      const tick = m.u32(0x6fd18d10);
      if ((m.u32(pTrade + 0x14) >>> 0) >= (tick >>> 0)) {
        EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 0x19) >>> 0, 0, 0, 0);
        return;
      }
      m.setU32(pPlayerData + 0x50, 3);
      if (pPlayer !== 0) {
        m.setU32(pPlayer + 0xc8, (m.u32(pPlayer + 0xc8) & 0xff3fffff) >>> 0);
      }
      m.setU32(pTrade + 0x14, 0);
      let pClient = 0;
      if (pPlayer !== 0 && m.u32(pPlayer) === 0) {
        pClient = m.u32(UNITS_GetPlayerData113c(m, pPlayer) + 0x9c);
      }
      NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x0f, pClient);
      return;
    }
    case 12: {
      m.setU32(pPlayerData + 0x50, 0x0d);
      EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 4) >>> 0, 0, 0, 0);
      return;
    }
    default:
      return;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC93AA0
 * @ordinalOrName D2Game_6FC93AA0
 */
export function D2Game_6FC93AA0_113c(m: D2KernMemory113c, pGame: number, pPlayer: number): void {
  hitD2GameVa113c(0x6FC93AA0)
  if (m.u8(pPlayer + 0x6c) === 0 || m.u32(pPlayer + 0x68) !== 0) return;
  const pTarget = SUNIT_GetServerUnit113c(m, pGame, 0, m.u32(pPlayer + 0x64));
  if (pTarget === 0) return;
  m.setU32(pPlayer + 0x64, 0xffffffff);
  m.setU32(pPlayer + 0x68, 6);
  m.setU8(pPlayer + 0x6c, 0);
  if (
    m.u8(pTarget + 0x6c) === 0 ||
    m.u32(pTarget + 0x68) !== 0 ||
    m.u32(pTarget + 0x64) !== m.u32(pPlayer + 0x0c)
  ) {
    return;
  }
  const pPData1 = UNITS_GetPlayerData113c(m, pPlayer);
  m.setU32(pPData1 + 0x50, 9);
  EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0d, (m.u32(pGame + 0xa8) + 1) >>> 0, 0, 0, 0);
  D2Game_6FC916D0_113c(m, pGame, pPlayer);
  D2Game_6FC916D0_113c(m, pGame, pTarget);
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pPlayer, pGame);
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pTarget, pGame);
  let pClient2 = 0;
  if (m.u32(pTarget) === 0) {
    pClient2 = m.u32(UNITS_GetPlayerData113c(m, pTarget) + 0x9c);
  }
  NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x0c, pClient2);
  m.setU32(pTarget + 0x64, 0xffffffff);
  m.setU32(pTarget + 0x68, 6);
  m.setU8(pTarget + 0x6c, 0);
  const pPData2 = UNITS_GetPlayerData113c(m, pTarget);
  m.setU32(pPData2 + 0x50, 9);
  EVENT_SetEventFull113c(m, pGame, pTarget, 0x0d, (m.u32(pGame + 0xa8) + 1) >>> 0, 0, 0, 0);
}

/**
 * @dll D2Game.dll
 * @va 0x6FC93BA0
 * @ordinalOrName D2Game_6FC93BA0
 */
export function D2Game_6FC93BA0_113c(
  m: D2KernMemory113c,
  pPlayer1: number,
  pPlayer2: number,
  pGame: number,
  pPlayerData1: number,
  pPlayerData2: number,
): void {
  hitD2GameVa113c(0x6FC93BA0)
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pPlayer1);
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pPlayer2);
  UNITS_UpdateInventoryItems113c(m, pPlayer1, 1);
  UNITS_UpdateInventoryItems113c(m, pPlayer2, 1);
  if (pPlayer1 !== 0) {
    m.setU32(pPlayer1 + 0xc8, (m.u32(pPlayer1 + 0xc8) | 0x800000) >>> 0);
  }
  if (pPlayer2 !== 0) {
    m.setU32(pPlayer2 + 0xc8, (m.u32(pPlayer2 + 0xc8) | 0x800000) >>> 0);
  }
  m.setU32(m.u32(pPlayerData1 + 0x5c) + 0x0c, 0);
  m.setU32(m.u32(pPlayerData2 + 0x5c) + 0x0c, 0);
  D2Game_6FC916D0_113c(m, pGame, pPlayer1);
  D2Game_6FC916D0_113c(m, pGame, pPlayer2);
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x10) >>> 0;
  try {
    const getClient = (pPlr: number): number => {
      if (pPlr !== 0 && m.u32(pPlr) === 0) {
        return m.u32(UNITS_GetPlayerData113c(m, pPlr) + 0x9c);
      }
      return 0;
    };
    m.setU8(sp, 0x79);
    m.setU8(sp + 1, 0);
    m.setU32(sp + 2, 0);
    NET_QueuePacketToClientBuffer113c(m, getClient(pPlayer1), 1, sp, 6);
    m.setU8(sp, 0x79);
    m.setU8(sp + 1, 1);
    m.setU32(sp + 2, 0);
    NET_QueuePacketToClientBuffer113c(m, getClient(pPlayer1), 1, sp, 6);
    m.setU8(sp, 0x79);
    m.setU8(sp + 1, 0);
    m.setU32(sp + 2, 0);
    NET_QueuePacketToClientBuffer113c(m, getClient(pPlayer2), 1, sp, 6);
    m.setU8(sp, 0x79);
    m.setU8(sp + 1, 1);
    m.setU32(sp + 2, 0);
    NET_QueuePacketToClientBuffer113c(m, getClient(pPlayer2), 1, sp, 6);
    m.setU8(sp + 8, 0x77);
    m.setU8(sp + 9, 6);
    NET_QueuePacketToClientBuffer113c(m, getClient(pPlayer1), 1, sp + 8, 2);
    m.setU8(sp + 8, 0x77);
    m.setU8(sp + 9, 6);
    NET_QueuePacketToClientBuffer113c(m, getClient(pPlayer2), 1, sp + 8, 2);
    m.setU32(pPlayerData1 + 0x50, 5);
    m.setU32(pPlayerData2 + 0x50, 5);
    ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pPlayer1);
    ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pPlayer2);
    EVENT_SetEventFull113c(m, pGame, pPlayer1, 0x0d, (m.u32(pGame + 0xa8) + 1) >>> 0, 0, 0, 0);
    EVENT_SetEventFull113c(m, pGame, pPlayer2, 0x0d, (m.u32(pGame + 0xa8) + 1) >>> 0, 0, 0, 0);
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC98D00
 * @ordinalOrName D2Game_6FC98D00
 */
export function D2Game_6FC98D00_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pItem: number,
  pGame: number,
  nLocation: number,
): void {
  hitD2GameVa113c(0x6FC98D00)
  const pInv = m.u32(pPlayer + 0x60);
  ITEMS_StopAllItemFunctions113c(m, pPlayer, pItem);
  INVENTORY_UpdateWeaponGUIDOnRemove113c(m, pInv, pItem);
  const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInv, pItem);
  if (pRemoved === 0) {
    FOG_Assertion113c(m, 0x25c, 0x6fd19ff9);
    return;
  }
  if (pItem !== pRemoved) {
    FOG_Assertion113c(m, 0x25d, 0x6fd19ff9);
    return;
  }
  INVENTORY_NoOpRet8B113c(m, pInv, nLocation);
  if (ITEMS_GetItemType113c(m, pItem) === 0x13) {
    D2Game_6FCF7E30_113c(m, 0, pPlayer, pGame);
  }
  if (pItem !== 0) {
    m.setU32(pItem + 0xc4, (m.u32(pItem + 0xc4) & ~2) >>> 0);
  }
  ITEMS_DeactivateEquippedItemStats113c(m, pPlayer, pItem, pGame, 0, 1);
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x20, 1);
  ITEMS_SetItemFlag113c(m, pItem, 1, 1);
  ITEMS_SetItemFlag113c(m, pItem, 0x10, 1);
  INVENTORY_AppendRecord113c(m, pInv, pItem);
  UNITS_AttachAndSync113c(m, pPlayer, pItem, 1, 1);
  UNITS_UpdateInventoryItems113c(m, pPlayer, 1);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCC3610
 * @ordinalOrName D2Game_6FCC3610
 */
export function D2Game_6FCC3610_113c(m: D2KernMemory113c, pSpawnDesc: number, pGame: number): number {
  hitD2GameVa113c(0x6FCC3610)
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x40) >>> 0;
  try {
    let x = 0;
    let y = 0;
    if ((m.u8(pSpawnDesc) & 1) !== 0) {
      x = m.u32(pSpawnDesc + 0x14);
      y = m.u32(pSpawnDesc + 0x18);
    } else {
      SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, m.u32(pSpawnDesc + 4), pGame, sp + 8, sp + 4);
      x = m.u32(sp + 8);
      y = m.u32(sp + 4);
    }
    const pRoom0 = UNITS_GetRoom113c(m, m.u32(pSpawnDesc + 4));
    const pRoom = DUNGEON_FindRoomBySubtileCoords113c(m, pRoom0, x, y);
    if (pRoom === 0) return 0;
    const spawnArg = (sp + 0x10) >>> 0;
    m.setU32(spawnArg, pGame);
    m.setU32(spawnArg + 4, pRoom);
    m.setU32(spawnArg + 8, 0);
    m.setU32(spawnArg + 0x0c, m.u32(pSpawnDesc + 8));
    m.setU32(spawnArg + 0x10, m.u32(pSpawnDesc + 0x10));
    m.setU32(spawnArg + 0x14, 0);
    m.setU32(spawnArg + 0x18, x);
    m.setU32(spawnArg + 0x1c, y);
    m.setU32(spawnArg + 0x20, 0xffffffff);
    m.setU16(spawnArg + 0x24, 0x42);
    let pMonster = MONSTER_SpawnFromSubpreset113c(m, spawnArg);
    if (pMonster === 0) {
      if ((m.u8(pSpawnDesc) & 4) !== 0) return 0;
      pMonster = MONSTER_SpawnAtCoords113c(
        m,
        m.u32(pSpawnDesc + 8),
        m.u32(pSpawnDesc + 0x10),
        pGame,
        pRoom,
        x,
        y,
        4,
        0x42,
      );
      if (pMonster === 0) return 0;
    }
    D2Game_6FCC3090_113c(m, pSpawnDesc, pMonster, pGame);
    if (pMonster !== 0) {
      m.setU32(pMonster + 0xc4, (m.u32(pMonster + 0xc4) | 0x20000) >>> 0);
    }
    const pOwner = m.u32(pSpawnDesc + 4);
    const ownerType = pOwner !== 0 ? m.u32(pOwner) : 6;
    const ownerGuid = pOwner !== 0 ? m.u32(pOwner + 0x0c) : 0xffffffff;
    if (pMonster !== 0 && m.u32(pMonster) === 1) {
      const pAiGen = getMonsterAiGeneralPtr(m, pMonster);
      m.setU32(pAiGen + 0x2c, ownerGuid);
      m.setU32(pAiGen + 0x30, ownerType);
      m.setU32(pAiGen + 0x28, pGame);
    }
    if (STATES_CheckState113c(m, pMonster, 0x36) !== 0) {
      FOG_Assertion113c(m, 0x100c, 0x6fd19ff9);
      return 0;
    }
    const pAiGen = pMonster !== 0 && m.u32(pMonster) === 1 ? getMonsterAiGeneralPtr(m, pMonster) : 0;
    initMonsterSpecialAiThink6FCBD230(m, pGame, pMonster, pAiGen, m.u32(pSpawnDesc + 0x0c));
    MONSTER_ScheduleInitialAiEvent113c(m, pGame, pMonster);
    clearAurasType2(m, pGame, pMonster);
    EVENT_SetEventFull113c(m, pGame, pMonster, 2, (m.u32(pGame + 0xa8) + 0x19) >>> 0, 0, 0, 0);
    return pMonster;
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCA4D0
 * @ordinalOrName D2Game_6FCCA4D0
 */
export function D2Game_6FCCA4D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCCA4D0)
  let pOwner = 0;
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pAiGen = getMonsterAiGeneralPtr(m, pUnit);
    if (pAiGen !== 0 && m.u32(pAiGen + 0x28) !== 0) {
      pOwner = SUNIT_GetServerUnit113c(
        m,
        m.u32(pAiGen + 0x28),
        m.u32(pAiGen + 0x30),
        m.u32(pAiGen + 0x2c),
      );
    }
  }
  if (pOwner === 0) {
    AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x0a);
    return;
  }
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x20) >>> 0;
  try {
    const pAiControl = m.u32(pAiTickArgs);
    const pMonStats = m.u32(pAiTickArgs + 0x1c);
    let pTarget = aiFindTarget6FCD1C90(m, pGame, pUnit, pAiControl, sp + 4, sp);
    if (pTarget === 0 || signedU32(m, sp + 4) > 0x18) {
      pTarget = 0;
    }
    let bInSight = m.u32(sp);
    const diff = m.u8(pGame + 0x6d);
    if (bInSight !== 0 && pTarget !== 0) {
      const roll1 = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100;
      if (roll1 < signedU16(m, pMonStats + diff * 2 + 0x56)) {
        if (AI_FleeFrom113c(m, pGame, pUnit, pTarget, 6, 1) !== 0) return;
      }
    }
    const roll2 = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100;
    if (roll2 < signedU16(m, pMonStats + diff * 2 + 0x5c)) {
      pTarget = 0;
      bInSight = 0;
    }
    const ownerDist = UNITS_GetDistanceToOtherUnit113c(m, pUnit, pOwner);
    if ((ownerDist | 0) > signedU16(m, pMonStats + diff * 2 + 0x62)) {
      const oy = getUnitPosY(m, pOwner);
      const ox = getUnitPosX(m, pOwner);
      const pOwnerRoom = UNITS_GetRoom113c(m, pOwner);
      if (D2Game_6FD019C0_113c(m, ox, oy, pOwnerRoom, pGame, pUnit, 0, 0) !== 0) {
        AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x19);
        return;
      }
    }
    const ownerMode = m.u32(pOwner + 0x10);
    if ((ownerDist | 0) > signedU16(m, pMonStats + diff * 2 + 0x68)) {
      if (ownerMode === 2 || ownerMode === 6) {
        if (D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, 0, 0) !== 0) return;
      }
      if (ownerMode === 3) {
        if (D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, 0x3c, 0) !== 0) return;
      }
    }
    if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInSight, 0, 6) === 0) {
      AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x19);
    }
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCA710
 * @ordinalOrName D2Game_6FCCA710
 */
export function D2Game_6FCCA710_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  _unused: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCCA710)
  const pAiControl = m.u32(pAiTickArgs);
  const pMonStats = m.u32(pAiTickArgs + 0x1c);
  let pOwner = 0;
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pAiGen = getMonsterAiGeneralPtr(m, pUnit);
    if (pAiGen !== 0 && m.u32(pAiGen + 0x28) !== 0) {
      pOwner = SUNIT_GetServerUnit113c(
        m,
        m.u32(pAiGen + 0x28),
        m.u32(pAiGen + 0x30),
        m.u32(pAiGen + 0x2c),
      );
    }
  }
  if (pOwner === 0) {
    const corpseGuid = m.u32(pAiControl + 0x1c);
    if (corpseGuid === 0) {
      AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x0a);
      return;
    }
    if (pGame === 0) {
      FOG_Assertion113c(m, 0x2d3, 0x6fd19ff9);
      return;
    }
    let pCorpse = m.u32(pGame + ((corpseGuid & 0x7f) * 4 + 0x1120));
    while (pCorpse !== 0 && m.u32(pCorpse + 0x0c) !== corpseGuid) {
      pCorpse = m.u32(pCorpse + 0xe4);
    }
    if (signedU16(m, pMonStats + 0x172) >= 0 && pCorpse !== 0) {
      const cy = SUNIT_GetYPos113c(m, pCorpse);
      const cx = SUNIT_GetXPos113c(m, pCorpse);
      AI_UseSkillOrAttack113c(m, m.u8(pMonStats + 0x181), pUnit, pGame, signedU16(m, pMonStats + 0x172), 0, cx, cy);
      EVENT_SetEventFull113c(m, pGame, pUnit, 0, (m.u32(pGame + 0xa8) + 6) >>> 0, 0, 0, 0);
      AI_DelayNextThink113c(m, pGame, pUnit, 8);
      return;
    }
    AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x0a);
    return;
  }

  m.setU32(pAiControl + 0x1c, m.u32(pOwner + 0x0c));
  if (DUNGEON_IsRoomInTown113c(m, UNITS_GetRoom113c(m, pUnit)) !== 0) {
    if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, 0, 0, 0, 6) === 0) {
      AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x21);
    }
    return;
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x20) >>> 0;
  try {
    const diff = m.u8(pGame + 0x6d);
    const maxEngageDist = signedU16(m, pMonStats + diff * 2 + 0x68);
    let pTarget = aiFindTarget6FCD1C90(m, pGame, pUnit, pAiControl, sp + 4, sp);
    if (pTarget === 0 || signedU32(m, sp + 4) > maxEngageDist) {
      pTarget = 0;
    }
    const bInSight = m.u32(sp);
    const pOwnerTarget = aiFindTarget6FCD1C90(m, pGame, pOwner, pAiControl, sp + 0x0c, sp + 8);
    if (pTarget !== 0) {
      if (MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, pUnit, pTarget) === 0) {
        pTarget = 0;
      }
    }
    if (pTarget === 0 && pOwnerTarget !== 0 && signedU32(m, sp + 0x0c) < maxEngageDist) {
      if (MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, pUnit, pOwnerTarget) !== 0) {
        pTarget = pOwnerTarget;
      }
    }
    const ownerDist = UNITS_GetDistanceToOtherUnit113c(m, pOwner, pUnit);
    if (pTarget !== 0 && (ownerDist | 0) > maxEngageDist) {
      if ((UNITS_GetDistanceToOtherUnit113c(m, pOwner, pTarget) | 0) > maxEngageDist) {
        pTarget = 0;
      }
    }
    const walkFrames = signedU16(m, pMonStats + 0x32);
    let speedBonus = 100;
    if (walkFrames > 0) {
      speedBonus = (Math.trunc(Math.imul(signedU16(m, pMonStats + 0x34), 100) / walkFrames) - 100) | 0;
      if (speedBonus >= 100) speedBonus = 100;
    }
    if (signedU16(m, pMonStats + 0x172) >= 0 && (ownerDist | 0) > 0x32) {
      const oy = SUNIT_GetYPos113c(m, pOwner);
      const ox = SUNIT_GetXPos113c(m, pOwner);
      AI_UseSkillOrAttack113c(m, m.u8(pMonStats + 0x181), pUnit, pGame, signedU16(m, pMonStats + 0x172), 0, ox, oy);
      EVENT_SetEventFull113c(m, pGame, pUnit, 0, (m.u32(pGame + 0xa8) + 2) >>> 0, 0, 0, 0);
      AI_DelayNextThink113c(m, pGame, pUnit, 0x0a);
      return;
    }
    const ownerMode = m.u32(pOwner + 0x10);
    if ((ownerDist | 0) > signedU16(m, pMonStats + diff * 2 + 0x6e) || ((ownerDist | 0) > maxEngageDist && ownerMode === 3)) {
      D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 1, 0x64, 0);
      return;
    }
    if ((ownerDist | 0) > maxEngageDist && (ownerMode === 2 || ownerMode === 6)) {
      D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, 0, 0);
      return;
    }
    if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInSight, 1, 6) !== 0) return;

    const hasState8a = STATES_CheckState113c(m, pUnit, 0x8a);
    let bCheckCorpse = false;
    if (signedU16(m, pMonStats + 0x170) >= 0 && hasState8a === 0) {
      const roll = RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 100);
      if ((roll | 0) < signedU16(m, pMonStats + diff * 2 + 0x62) || pTarget === 0 || m.u32(pAiControl + 0x14) !== 0) {
        bCheckCorpse = true;
      }
    }
    if (bCheckCorpse) {
      const pDeadUnit = SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c(m, pUnit, pGame, 0x0a);
      if (pDeadUnit !== 0) {
        const deadDist = UNITS_GetDistanceToOtherUnit113c(m, pDeadUnit, pUnit);
        if ((deadDist | 0) < Math.trunc(maxEngageDist / 2)) {
          if (UNITS_CanAttackWithSkill113c(m, pUnit, pDeadUnit, 0) !== 0) {
            m.setU32(pAiControl + 0x14, 0);
            AI_UseSkillOrAttack113c(
              m,
              m.u8(pMonStats + 0x180),
              pUnit,
              pGame,
              signedU16(m, pMonStats + 0x170),
              pDeadUnit,
              0,
              0,
            );
            return;
          }
          if (bInSight === 0) {
            AI_ApproachTarget113c(m, pGame, pUnit, pDeadUnit, 0x0f, 0, 0, 1, 0);
            m.setU32(pAiControl + 0x14, 1);
            m.setU32(pAiControl + 0x18, m.u32(pDeadUnit + 0x0c));
            return;
          }
        }
      }
    } else {
      m.setU32(pAiControl + 0x14, 0);
    }

    if (bInSight !== 0) {
      AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget);
      AI_DelayNextThink113c(m, pGame, pUnit, signedU16(m, pMonStats + diff * 2 + 0x56));
      return;
    }
    if (pTarget !== 0) {
      if (speedBonus < -126 || speedBonus > 126) {
        FOG_Assertion113c(m, 0x110, 0x6fd19ff9);
        return;
      }
      if (m.u32(pUnit) === 1 && m.u32(pUnit + 0x14) !== 0) {
        const pAiParam = m.u32(m.u32(pUnit + 0x14) + 0x2c);
        if (speedBonus !== 0) {
          m.setU32(pAiParam + 0x1c, speedBonus);
        }
      }
      AI_ApproachTarget113c(m, pGame, pUnit, pTarget, 0x0f, 0, 0, 1, 0);
      return;
    }
    const idleRoll = RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 100);
    if ((idleRoll | 0) < signedU16(m, pMonStats + diff * 2 + 0x5c)) {
      AI_IdleWander113c(m, pGame, pUnit, 0x0a);
      return;
    }
    AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x0f);
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCAC30
 * @ordinalOrName D2Game_6FCCAC30
 */
export function D2Game_6FCCAC30_113c(
  m: D2KernMemory113c,
  pAiTickArgs: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCCAC30)
  const pMonStats = m.u32(pAiTickArgs + 0x1c);
  const pAiControl = m.u32(pAiTickArgs);
  let pOwner = 0;
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pAiGen = getMonsterAiGeneralPtr(m, pUnit);
    if (pAiGen !== 0 && m.u32(pAiGen + 0x28) !== 0) {
      pOwner = SUNIT_GetServerUnit113c(
        m,
        m.u32(pAiGen + 0x28),
        m.u32(pAiGen + 0x30),
        m.u32(pAiGen + 0x2c),
      );
    }
  }
  if (pOwner === 0) {
    const savedGuid = m.u32(pAiControl + 0x1c);
    if (savedGuid !== 0) {
      if (pGame === 0) {
        FOG_Assertion113c(m, 0x2d3, 0x6fd19ff9);
        return;
      }
      let pSaved = m.u32(pGame + ((savedGuid & 0x7f) * 4 + 0x1120));
      while (pSaved !== 0 && m.u32(pSaved + 0x0c) !== savedGuid) {
        pSaved = m.u32(pSaved + 0xe4);
      }
      if (pSaved !== 0 && signedU16(m, pMonStats + 0x170) >= 0) {
        const sy = SUNIT_GetYPos113c(m, pSaved);
        const sx = SUNIT_GetXPos113c(m, pSaved);
        AI_UseSkillOrAttack113c(m, m.u8(pMonStats + 0x180), pUnit, pGame, signedU16(m, pMonStats + 0x170), 0, sx, sy);
        EVENT_SetEventFull113c(m, pGame, pUnit, 0, (m.u32(pGame + 0xa8) + 6) >>> 0, 0, 0, 0);
        AI_DelayNextThink113c(m, pGame, pUnit, 8);
        return;
      }
    }
    AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x0a);
    return;
  }

  m.setU32(pAiControl + 0x1c, m.u32(pOwner + 0x0c));
  if (DUNGEON_IsRoomInTown113c(m, UNITS_GetRoom113c(m, pUnit)) !== 0) {
    if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, 0, 0, 0, 6) === 0) {
      AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x21);
    }
    return;
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x20) >>> 0;
  try {
    const diff = m.u8(pGame + 0x6d);
    const maxEngageDist = signedU16(m, pMonStats + diff * 2 + 0x68);
    let pTarget = aiFindTarget6FCD1C90(m, pGame, pUnit, pAiControl, sp + 4, sp);
    if (pTarget === 0 || signedU32(m, sp + 4) > maxEngageDist) {
      pTarget = 0;
    }
    const bInSight = m.u32(sp);
    const pOwnerTarget = aiFindTarget6FCD1C90(m, pGame, pOwner, pAiControl, sp + 0x0c, sp + 8);
    if (pTarget !== 0) {
      if (MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, pUnit, pTarget) === 0) {
        pTarget = 0;
      }
    }
    if (pTarget === 0 && pOwnerTarget !== 0) {
      if ((AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwnerTarget) | 0) < maxEngageDist) {
        if (MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, pUnit, pOwnerTarget) === 0) {
          pTarget = pOwnerTarget;
        }
      }
    }
    const walkFrames = signedU16(m, pMonStats + 0x32);
    let speedBonus = 100;
    if (walkFrames > 0) {
      speedBonus = (Math.trunc(Math.imul(signedU16(m, pMonStats + 0x34), 100) / walkFrames) - 100) | 0;
      if (speedBonus >= 100) speedBonus = 100;
    }
    const ownerDist = UNITS_GetDistanceToOtherUnit113c(m, pOwner, pUnit);
    if (signedU16(m, pMonStats + 0x170) >= 0 && (ownerDist | 0) > 0x32) {
      const oy = SUNIT_GetYPos113c(m, pOwner);
      const ox = SUNIT_GetXPos113c(m, pOwner);
      AI_UseSkillOrAttack113c(m, m.u8(pMonStats + 0x180), pUnit, pGame, signedU16(m, pMonStats + 0x170), 0, ox, oy);
      EVENT_SetEventFull113c(m, pGame, pUnit, 0, (m.u32(pGame + 0xa8) + 4) >>> 0, 0, 0, 0);
      AI_DelayNextThink113c(m, pGame, pUnit, 0x0a);
      return;
    }
    if ((ownerDist | 0) > signedU16(m, pMonStats + diff * 2 + 0x6e)) {
      if (D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 1, 0x64, 0) !== 0) return;
    }
    const ownerMode = m.u32(pOwner + 0x10);
    if ((ownerDist | 0) > signedU16(m, pMonStats + diff * 2 + 0x62)) {
      if (ownerMode === 2 || ownerMode === 6) {
        if (D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, 0, 0) !== 0) return;
      }
      if (ownerMode === 3) {
        if (D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 1, 0x64, 0) !== 0) return;
      }
    }
    if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInSight, 1, 6) !== 0) return;
    if (pTarget !== 0) {
      if (bInSight !== 0) {
        AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget);
        AI_DelayNextThink113c(m, pGame, pUnit, signedU16(m, pMonStats + diff * 2 + 0x56));
        return;
      }
      if ((UNITS_GetDistanceToOtherUnit113c(m, pOwner, pTarget) | 0) < maxEngageDist) {
        if (speedBonus < -126 || speedBonus > 126) {
          FOG_Assertion113c(m, 0x110, 0x6fd19ff9);
          return;
        }
        if (m.u32(pUnit) === 1 && m.u32(pUnit + 0x14) !== 0) {
          const pAiParam = m.u32(m.u32(pUnit + 0x14) + 0x2c);
          if (speedBonus !== 0) {
            m.setU32(pAiParam + 0x1c, speedBonus);
          }
        }
        AI_ApproachTarget113c(m, pGame, pUnit, pTarget, 0x0f, 0, 0, 1, 0);
        return;
      }
      if ((ownerDist | 0) > 0x0a) {
        AI_StepRelativeToTargetUnit113c(m, pGame, pUnit, pOwner, 8, 2, 6);
        return;
      }
      AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x0f);
      return;
    }
    const idleRoll = RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 100);
    if ((idleRoll | 0) < signedU16(m, pMonStats + diff * 2 + 0x5c)) {
      AI_IdleWander113c(m, pGame, pUnit, 0x0a);
      return;
    }
    AI_SetNextThinkDelay113c(m, pGame, pUnit, 0x0f);
  } finally {
    k2W13B1StackPtr = sp;
  }
}
/**
 * @dll D2Game.dll
 * @va 0x6FCCB070
 * @ordinalOrName D2Game_6FCCB070
 */
export function D2Game_6FCCB070_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
): void {
  hitD2GameVa113c(0x6FCCB070)
  const pAiParam = m.u32(pAiTickParam + 0x1c);
  const pAiControl = m.u32(pAiTickParam);
  if (pUnit === 0 || signedU32(m, pUnit) !== 1) return;
  const pMonsterData = m.u32(pUnit + 0x14);
  if (pMonsterData === 0) return;
  const pAiGeneral = m.u32(pMonsterData + 0x28);
  if (pAiGeneral === 0) return;
  const ownerGame = m.u32(pAiGeneral + 0x28);
  if (ownerGame === 0) return;
  const pOwner = SUNIT_GetServerUnit113c(m, ownerGame, m.u32(pAiGeneral + 0x30), m.u32(pAiGeneral + 0x2c));
  if (pOwner === 0) return;

  let pTarget = m.u32(pAiTickParam + 0x08);
  let bInCombat = signedU32(m, pAiTickParam + 0x18);
  let bValidOwner = 1;
  let bTargetLineOfSight = 0;
  let distToTarget = 0;
  let pAttackTarget = 0;

  const distToOwner = UNITS_GetDistanceToOtherUnit113c(m, pUnit, pOwner);
  const diff0 = m.u8(pGame + 0x6d);
  if (distToOwner >= signedU16(m, pAiParam + diff0 * 2 + 0x6e)) {
    if (D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 3, 0, 0, 6) !== 0) {
      return;
    }
  }

  if (pTarget !== 0) {
    if (SUNIT_IsDeadOrDying113c(m, pTarget) !== 0) {
      pTarget = 0;
      bInCombat = 0;
    }
  }

  const wSkillId = signedU16(m, pAiParam + 0x170);
  if (wSkillId > 0) {
    const pSkillsTxt = DATATBLS_GetSkillsTxtRecord113c(m, wSkillId);
    const pRightSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, wSkillId);
    if (pSkillsTxt !== 0 && pRightSkill !== 0) {
      const nSkillLevel = SKILLS_GetSkillLevel113c(m, pUnit, pRightSkill, 1);
      let nRange = SKILLS_EvaluateSkillFormula113c(
        m,
        pUnit,
        m.u32(pSkillsTxt + 0x64),
        signedU16(m, pAiParam + 0x170),
        nSkillLevel,
      );
      if (nRange <= 5) {
        nRange = 5;
      } else if (nRange >= 50) {
        nRange = 50;
      }
      pAttackTarget = SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c(m, pUnit, pGame, nRange);
      if (pAttackTarget !== 0) {
        distToTarget = UNITS_GetDistanceToOtherUnit113c(m, pUnit, pAttackTarget);
      }
    }
  }

  const diff1 = m.u8(pGame + 0x6d);
  if (distToTarget >= signedU16(m, pAiParam + diff1 * 2 + 0x5c)) {
    pAttackTarget = 0;
  } else if (pAttackTarget !== 0) {
    bTargetLineOfSight = DUNGEON_CheckLineOfSight113c(m, pUnit, pAttackTarget, 0);
  }

  if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pAttackTarget, bTargetLineOfSight, 0, 6) !== 0) {
    return;
  }

  const dwClassId = m.u32(pUnit + 0x04);
  if (dwClassId === 0x1aa) {
    const curLife = STATLIST_UnitGetStatValue113c(m, pOwner, 6, 0);
    const maxLife = STATLIST_GetUnitMaxLife113c(m, pOwner);
    if (curLife >= maxLife) {
      bValidOwner = 0;
    }
  } else if (dwClassId === 0x1ab) {
    const curMana = STATLIST_UnitGetStatValue113c(m, pOwner, 8, 0);
    const maxMana = STATLIST_GetUnitMaxMana113c(m, pOwner);
    if (curMana >= maxMana) {
      bValidOwner = 0;
    }
  }

  if (pAttackTarget !== 0 && bTargetLineOfSight !== 0 && bValidOwner !== 0) {
    const diff2 = m.u8(pGame + 0x6d);
    const nextCastFrame = (signedU16(m, pAiParam + diff2 * 2 + 0x56) + signedU32(m, pAiControl + 0x18)) | 0;
    if (nextCastFrame < signedU32(m, pGame + 0xa8)) {
      AI_CastSkillWithMode113c(m, 8, pUnit, pGame, signedU16(m, pAiParam + 0x170), pAttackTarget, 0, 0);
      m.setU32(pAiControl + 0x18, m.u32(pGame + 0xa8));
      return;
    }
  }

  if (bInCombat !== 0 && pTarget !== 0) {
    if (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 100) < 25) {
      const diff3 = m.u8(pGame + 0x6d);
      const pct = m.u8(pAiParam + diff3 * 2 + 0x68);
      AI_FleeFrom113c(m, pGame, pUnit, pTarget, pct, 0);
      return;
    }
  }

  if (pAttackTarget !== 0) {
    AI_ApproachTarget113c(m, pGame, pUnit, pAttackTarget, 2, 0, 0, 1, 7);
    return;
  }

  const diff4 = m.u8(pGame + 0x6d);
  AI_Stall113c(m, pGame, pUnit, signedU16(m, pAiParam + diff4 * 2 + 0x62));
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCB360
 * @ordinalOrName D2Game_6FCCB360
 */
export function D2Game_6FCCB360_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
): void {
  hitD2GameVa113c(0x6FCCB360)
  const pAiParam = m.u32(pAiTickParam + 0x1c);
  const pAiControl = m.u32(pAiTickParam);
  let pOwner = 0;
  if (pUnit !== 0 && signedU32(m, pUnit) === 1) {
    const pMonsterData = m.u32(pUnit + 0x14);
    if (pMonsterData !== 0) {
      const pAiGeneral = m.u32(pMonsterData + 0x28);
      if (pAiGeneral !== 0) {
        const ownerGame = m.u32(pAiGeneral + 0x28);
        if (ownerGame !== 0) {
          pOwner = SUNIT_GetServerUnit113c(m, ownerGame, m.u32(pAiGeneral + 0x30), m.u32(pAiGeneral + 0x2c));
        }
      }
    }
  }

  if (pOwner === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }

  const distToOwner = UNITS_GetDistanceToOtherUnit113c(m, pUnit, pOwner);
  const diff0 = m.u8(pGame + 0x6d);
  if (distToOwner >= signedU16(m, pAiParam + diff0 * 2 + 0x6e)) {
    if (D2Game_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 3, 0, 0, 6) !== 0) {
      return;
    }
  }

  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (DUNGEON_IsRoomInTown113c(m, pRoom) !== 0) {
    if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, 0, 0, 0, 6) !== 0) {
      return;
    }
    const diff1 = m.u8(pGame + 0x6d);
    AI_Stall113c(m, pGame, pUnit, signedU16(m, pAiParam + diff1 * 2 + 0x62));
    return;
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x10) >>> 0;
  let pTarget = 0;
  let bLineOfSight = 0;
  let targetDist = 0;
  try {
    m.setU32(sp, 0);
    m.setU32(sp + 4, 0);
    pTarget = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, pUnit, pGame, sp, (sp + 4) >>> 0);
    bLineOfSight = signedU32(m, sp);
    targetDist = signedU32(m, sp + 4);
  } finally {
    k2W13B1StackPtr = sp;
  }

  const diff2 = m.u8(pGame + 0x6d);
  if (targetDist >= signedU16(m, pAiParam + diff2 * 2 + 0x5c)) {
    pTarget = 0;
  }

  if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bLineOfSight, 0, 6) !== 0) {
    return;
  }

  if (pTarget !== 0) {
    if (
      STATES_CheckState113c(m, pTarget, 2) !== 0 ||
      STATLIST_UnitGetStatValue113c(m, pTarget, 0x2d, 0) === 100
    ) {
      const diff3 = m.u8(pGame + 0x6d);
      const pct = m.u8(pAiParam + diff3 * 2 + 0x68);
      AI_FleeFrom113c(m, pGame, pUnit, pTarget, pct, 0);
      return;
    }

    if (bLineOfSight === 0) {
      AI_ApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 7);
      return;
    }

    const wSkillId = signedU16(m, pAiParam + 0x170);
    if (wSkillId >= 0) {
      const diff4 = m.u8(pGame + 0x6d);
      const nextCastFrame = (signedU16(m, pAiParam + diff4 * 2 + 0x56) + signedU32(m, pAiControl + 0x18)) | 0;
      if (nextCastFrame < signedU32(m, pGame + 0xa8)) {
        AI_CastSkillWithMode113c(m, m.u8(pAiParam + 0x180), pUnit, pGame, wSkillId, pTarget, 0, 0);
        m.setU32(pAiControl + 0x18, m.u32(pGame + 0xa8));
        return;
      }
    }
  }

  const diff5 = m.u8(pGame + 0x6d);
  AI_Stall113c(m, pGame, pUnit, signedU16(m, pAiParam + diff5 * 2 + 0x62));
}

function scoreSkillCandidate6FCCB580(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pAiParam: number,
  pOwner: number,
  pTarget: number,
  pSkill: number,
  nSkillId: number,
  pSkillsTxt: number,
  nBaseRange: number,
  nLifePct: number,
  distTargetSq: number,
  bHasRoomFlag: number,
  bNotBlocked: number,
  pHealAlly: number,
  nVal90: number,
  nEnemyCount: number,
  nNearbyEnemies: number,
  nVal44: number,
  nAllyHpCase: number,
  bInCombat: number,
  sumPetStatRef: { val: number },
  candTargetRef: { val: number },
): number {
  const wRangeDiv = signedU16(m, pSkillsTxt + 0x174);
  const wBaseScore = signedU16(m, pSkillsTxt + 0x232);
  let score = (wBaseScore + (wRangeDiv >> 2) + (wRangeDiv < 0 && (wRangeDiv & 3) !== 0 ? 1 : 0) + nBaseRange) | 0;
  candTargetRef.val = pTarget;

  const dc = m.u8(pSkillsTxt + 0x1dc);
  let statVal = 0;
  if (dc === 0) statVal = STATLIST_UnitGetStatValue113c(m, pTarget, 0x24, 0);
  else if (dc === 1) statVal = STATLIST_UnitGetStatValue113c(m, pTarget, 0x27, 0);
  else if (dc === 2) statVal = STATLIST_UnitGetStatValue113c(m, pTarget, 0x29, 0);
  else if (dc === 3) statVal = STATLIST_UnitGetStatValue113c(m, pTarget, 0x25, 0);
  else if (dc === 4 || dc === 12) statVal = STATLIST_UnitGetStatValue113c(m, pTarget, 0x2b, 0);
  else if (dc === 5) statVal = STATLIST_UnitGetStatValue113c(m, pTarget, 0x2d, 0);

  const mulHi = Number((BigInt(statVal | 0) * -0x66666667n) >> 32n) | 0;
  const div10 = ((mulHi >> 2) + (mulHi >>> 31)) | 0;
  score = (score + div10) | 0;

  const skillCat = (m.u8(pSkillsTxt + 0x230) - 1) >>> 0;
  const nRandRange = signedU16(m, pAiParam + 0x5c);
  if (skillCat > 12) return 0;

  if (skillCat === 0) {
    const wState = signedU16(m, pSkillsTxt + 0x80);
    if (wState > 0 && STATES_CheckState113c(m, pUnit, wState) === 0) return 0;
    if (nVal44 <= 0x19) score = (score - 6) | 0;
    if (STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c(m, pUnit, wState) !== 0) {
      score = (score - 10) | 0;
    } else {
      score = (score + 10) | 0;
    }
    const r = RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange);
    candTargetRef.val = pUnit;
    return (r + score) | 0;
  }
  if (skillCat === 1) {
    const wState0 = signedU16(m, pSkillsTxt + 0x80);
    if (wState0 > 0 && STATES_CheckState113c(m, pUnit, wState0) !== 0) return 0;
    const wState1 = signedU16(m, pSkillsTxt + 0x82);
    if (wState1 > 0 && STATES_CheckState113c(m, pTarget, wState1) !== 0) return 0;
    if (nVal44 <= 0x19) score = (score - 10) | 0;
    return (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange) + score) | 0;
  }
  if (skillCat === 2) {
    if (nVal90 > 5) score = (score - nVal90 * 2) | 0;
    if (nVal44 <= 0x19) score = (score - 7) | 0;
    if (nNearbyEnemies < 3) score = (score - 10) | 0;
    const r = RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange);
    return (r + score + nNearbyEnemies * 3 - 9) | 0;
  }
  if (skillCat === 3) {
    const wDist = signedU16(m, pAiParam + 0x56);
    if (distTargetSq > ((wDist * wDist) | 0)) score = (score - 10) | 0;
    score = (score + signedU16(m, pAiParam + 0x58)) | 0;
    if (bInCombat !== 0 || distTargetSq <= 0x19) score = (score + 10) | 0;
    const pDataTables = m.u32(0x6fd18be0);
    if ((m.u8(pDataTables + 0x08) & m.u8(pSkillsTxt + 0x04)) !== 0) {
      const wState = signedU16(m, pSkillsTxt + 0x80);
      if (wState > 0 && STATES_CheckState113c(m, pUnit, wState) !== 0) {
        const pStatList = MONSTER_GetSummonPet113c(m, pUnit, wState);
        if (pStatList !== 0) {
          const statSum = STATLIST_GetStatValue113c(m, pStatList, signedU16(m, pSkillsTxt + 0x54), 0);
          sumPetStatRef.val = (sumPetStatRef.val + statSum) | 0;
          if (statSum >= 3) return 0;
        }
      }
      score = (score + signedU16(m, pAiParam + 0x5a)) | 0;
    } else if (signedU16(m, pAiParam + 0x5a) > 0 && bHasRoomFlag === 0) {
      score = (score - 10) | 0;
    } else {
      score = (score + sumPetStatRef.val * 4 + 3) | 0;
    }
    return (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange) + score) | 0;
  }
  if (skillCat === 4 || skillCat === 10) {
    if (bNotBlocked === 0) return 0;
    if (signedU16(m, pSkillsTxt + 0x46) < 0) {
      const wMissile = signedU16(m, pSkillsTxt + 0x48);
      if (wMissile >= 0) {
        const pMissilesTxt = DATATBLS_GetMissilesTxtRecord113c(m, wMissile);
        if (pMissilesTxt !== 0) {
          const r = (signedU16(m, pMissilesTxt + 0x96) - 1) | 0;
          if (distTargetSq >= ((r * r) | 0)) return 0;
        }
      }
    }
    if (nVal44 <= 0x19) score = (score - 5) | 0;
    if (distTargetSq <= 0x19) score = (score - 5) | 0;
    if (bHasRoomFlag !== 0) score = (score - 5) | 0;
    const r = RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange);
    return skillCat === 10 ? (r + score + nNearbyEnemies * 3) | 0 : (r + score) | 0;
  }
  if (skillCat === 5) {
    const used = UNITS_GetUsedSkill113c(m, pUnit);
    const limit = used === 0 ? 0x14 : 0x06;
    if (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 100) < limit) {
      SKILLS_SetLeftActiveSkill113c(m, pUnit, nSkillId, -1);
    }
    return 0;
  }
  if (skillCat === 6) {
    let s = (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange) + score) | 0;
    if (nLifePct > 0x42) return 0;
    candTargetRef.val = 0;
    if (pOwner === 0) {
      getUnitPosX(m, pUnit);
      RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 0x28);
      getUnitPosX(m, pUnit);
      RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 0x28);
    } else {
      getUnitPosX(m, pOwner);
      getUnitPosX(m, pTarget);
      getUnitPosX(m, pOwner);
      getUnitPosX(m, pTarget);
      getUnitPosX(m, pOwner);
      getUnitPosY(m, pOwner);
    }
    s = (s + 10) | 0;
    if (nLifePct < 0x2d) s = (s + 10) | 0;
    return s;
  }
  if (skillCat === 7) {
    const r = (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange) + score) | 0;
    if (nLifePct > 0x42) return 0;
    candTargetRef.val = pUnit;
    return nLifePct >= 0x2d ? (r * 2) | 0 : (r * 4) | 0;
  }
  if (skillCat === 11) {
    if (pTarget !== 0 && signedU32(m, pTarget) === 1) {
      const pMonStats = MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, pTarget);
      if (pMonStats === 0) return 0;
      if (m.u8(pMonStats + m.u8(pGame + 0x6d) + 0xa0) < 0x19) return 0;
    }
    const wDist = signedU16(m, pAiParam + 0x56);
    if (distTargetSq > ((wDist * wDist) | 0)) score = (score - 10) | 0;
    score = (score + signedU16(m, pAiParam + 0x58)) | 0;
    if (bInCombat !== 0 || distTargetSq <= 0x19) score = (score + 10) | 0;
    const pDataTables = m.u32(0x6fd18be0);
    if ((m.u8(pDataTables + 0x08) & m.u8(pSkillsTxt + 0x04)) !== 0) {
      const wState = signedU16(m, pSkillsTxt + 0x80);
      if (wState > 0 && STATES_CheckState113c(m, pUnit, wState) !== 0) {
        const pStatList = MONSTER_GetSummonPet113c(m, pUnit, wState);
        if (pStatList !== 0) {
          const statSum = STATLIST_GetStatValue113c(m, pStatList, signedU16(m, pSkillsTxt + 0x54), 0);
          sumPetStatRef.val = (sumPetStatRef.val + statSum) | 0;
          if (statSum >= 3) return 0;
        }
      }
    }
    let s = (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange) + score) | 0;
    if (nLifePct < 0x4b) s = (s + 8) | 0;
    if (nLifePct < 0x32) s = (s + 12) | 0;
    return s;
  }
  if (skillCat === 12) {
    score = (score + signedU16(m, pAiParam + 0x58)) | 0;
    if (signedU16(m, pAiParam + 0x5a) > 0 && bHasRoomFlag === 0) {
      score = (score - 5) | 0;
    } else {
      score = (score + sumPetStatRef.val) | 0;
    }
    let useHealAlly = false;
    if (nLifePct < 0x32 || nEnemyCount > 3) {
      if (pHealAlly !== 0 && nAllyHpCase < 4 && UNIT_CalcSqDistSubtiles113c(m, pUnit, pHealAlly) > 0x19) {
        score = (score + 0x14) | 0;
        candTargetRef.val = pHealAlly;
        useHealAlly = true;
      }
    }
    if (!useHealAlly) {
      if (distTargetSq < 0x19) return 0;
      if (distTargetSq > 0x144) score = (score + 10) | 0;
    }
    return (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, nRandRange) + score) | 0;
  }
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCB580
 * @ordinalOrName D2Game_6FCCB580
 */
export function D2Game_6FCCB580_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
): void {
  hitD2GameVa113c(0x6FCCB580)
  let pTarget = m.u32(pAiTickParam + 0x08);
  const pAiParam = m.u32(pAiTickParam + 0x1c);
  const bInCombat = signedU32(m, pAiTickParam + 0x18);
  const targetDist = signedU32(m, pAiTickParam + 0x14);
  const pAiControl = m.u32(pAiTickParam);
  const pSkillList = m.u32(pUnit + 0xa8);
  if (pSkillList === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x64);
    return;
  }

  let pOwner = 0;
  if (signedU32(m, pUnit) === 1) {
    const pMonsterData = m.u32(pUnit + 0x14);
    if (pMonsterData !== 0) {
      const pAiGeneral = m.u32(pMonsterData + 0x28);
      if (pAiGeneral !== 0) {
        const ownerGame = m.u32(pAiGeneral + 0x28);
        if (ownerGame !== 0) {
          pOwner = SUNIT_GetServerUnit113c(m, ownerGame, m.u32(pAiGeneral + 0x30), m.u32(pAiGeneral + 0x2c));
        }
      }
    }
  }

  clearAurasType2(m, pGame, pUnit);

  if (pOwner !== 0) {
    const distOwnerSq = UNIT_CalcSqDistSubtiles113c(m, pUnit, pOwner);
    const maxLeash = signedU16(m, pAiParam + 0x60);
    if (distOwnerSq > ((maxLeash * maxLeash) | 0)) {
      if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, 0, bInCombat, 0, 6) !== 0) {
        return;
      }
    }
  }

  if (signedU32(m, pAiControl + 0x14) > 0) {
    SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
    const pPathTarget = PATH_GetTargetUnit113c(m, m.u32(pUnit + 0x2c));
    if (pPathTarget !== pUnit && pPathTarget !== 0) {
      pTarget = pPathTarget;
    }
    if (pTarget === 0) {
      m.setU32(pAiControl + 0x14, 0);
      m.setU32(pAiControl + 0x18, 0);
    } else {
      m.setU32(pAiControl + 0x14, (signedU32(m, pAiControl + 0x14) - 1) | 0);
      if (
        MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c(
          m,
          pOwner,
          pTarget,
          pUnit,
          signedU32(m, pAiControl + 0x18),
          pGame,
          bInCombat,
          0,
          0,
        ) !== 0
      ) {
        return;
      }
    }
  }

  if (targetDist > signedU16(m, pAiParam + 0x5e)) {
    pTarget = 0;
  }

  if (pTarget === 0) {
    for (
      let pSkill = SKILLS_GetFirstSkillFromSkillList113c(m, pSkillList);
      pSkill !== 0;
      pSkill = SKILLS_GetNextSkill113c(m, pSkill)
    ) {
      const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1b6b0, 0xd73);
      const pSkillsTxt = DATATBLS_GetSkillsTxtRecord113c(m, nSkillId);
      if (pSkillsTxt !== 0) {
        const bType = m.u8(pSkillsTxt + 0x230);
        if (bType === 6) {
          if (UNITS_GetUsedSkill113c(m, pUnit) === 0) {
            if (((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) < 0x14) {
              SKILLS_SetLeftActiveSkill113c(m, pUnit, nSkillId, -1);
            }
          }
        } else if (bType === 1) {
          const wState = signedU16(m, pSkillsTxt + 0x80);
          if (wState > 0 && STATES_CheckState113c(m, pUnit, wState) === 0) {
            if (
              STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c(m, pUnit, wState) === 0 ||
              RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 100) < 4
            ) {
              if (((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) < 0x3c) {
                const pFoundSkill = UNITS_GetSkillFromSkillId113c(m, pUnit, nSkillId, -1);
                if (pFoundSkill !== 0) {
                  let acted = 0;
                  if (SKILLS_CheckSkillDelay113c(m, pUnit, pFoundSkill) === 1 && bInCombat === 0) {
                    acted = AI_ApproachTarget113c(m, pGame, pUnit, 0, 0x0f, 0, 0, 1, 4);
                  } else {
                    const mode = SKILLS_GetSkillModeFromSkill113c(m, pFoundSkill);
                    acted = AI_CastSkillWithMode113c(m, mode, pUnit, pGame, nSkillId, 0, 0, 0);
                  }
                  if (acted !== 0) return;
                }
              }
            }
          }
        }
      }
    }
  }

  let pOwnerTarget = 0;
  if (pOwner !== 0) {
    SUNIT_ValidatePathTargetUnit113c(m, pOwner, pGame);
    const pCandidate = PATH_GetTargetUnit113c(m, m.u32(pOwner + 0x2c));
    if (pCandidate !== pOwner && pCandidate !== 0) {
      if (SUNIT_IsDeadOrDying113c(m, pCandidate) === 0 && SUNIT_AreUnitsHostileOrUnaligned113c(m, pCandidate, pUnit, pGame) !== 0) {
        pOwnerTarget = pCandidate;
        pTarget = pCandidate;
      }
    }
    if (UNIT_CalcSqDistSubtiles113c(m, pUnit, pOwner) <= 0x90) {
      if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInCombat, 0, 6) !== 0) {
        return;
      }
    }
  }

  if (pTarget === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }

  let nCount = signedU32(m, pAiControl + 0x1c);
  if (nCount <= 1) nCount = 1;
  const diff = m.u8(pGame + 0x6d);
  let chance = (signedU16(m, pAiParam + diff * 2 + 0x62) - nCount * 2) | 0;
  if (chance <= 5) chance = 5;
  else if (chance >= 100) chance = 100;

  if (bInCombat !== 0) {
    if (RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 100) < chance) {
      if (MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c(m, pOwner, pTarget, pUnit, 0, pGame, bInCombat, 0, 0) !== 0) {
        return;
      }
    }
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x30) >>> 0;
  let pHealAlly = 0;
  let nVal90 = 0;
  let nEnemyCount = 0;
  let nNearbyEnemies = 0;
  let nVal44 = 0;
  let nAllyHpCase = 0;
  try {
    m.setU32(sp + 0x00, pOwner);
    m.setU32(sp + 0x04, 0);
    m.setU32(sp + 0x08, 0x7fffffff);
    m.setU32(sp + 0x0c, 0);
    m.setU32(sp + 0x10, 0);
    m.setU32(sp + 0x14, 0x7fffffff);
    m.setU32(sp + 0x18, 0);
    m.setU32(sp + 0x1c, 0);
    m.setU32(sp + 0x20, 0);
    m.setU32(sp + 0x24, 0);
    AITARGET_ScanUnitsByModeTable113c(m, 1, sp, pGame, pUnit, 0x6fcc5230);
    if (bInCombat === 0) {
      if (pOwnerTarget !== 0) {
        pTarget = pOwnerTarget;
      } else if (m.u32(sp + 0x10) !== 0) {
        pTarget = m.u32(sp + 0x10);
      } else if (m.u32(sp + 0x24) !== 0 && UNIT_CalcSqDistSubtiles113c(m, pUnit, m.u32(sp + 0x24)) < 0x400) {
        pTarget = m.u32(sp + 0x24);
      }
      if (SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c(m, pTarget, pUnit) === 0) {
        const pClosest = AIGENERAL_GetPackLeaderUnit113c(m, pTarget);
        if (
          pClosest !== 0 &&
          SUNIT_IsDeadOrDying113c(m, pClosest) === 0 &&
          UNIT_CalcSqDistSubtiles113c(m, pUnit, pClosest) < 0x400
        ) {
          pTarget = pClosest;
        }
      }
    }
    pHealAlly = m.u32(sp + 0x10);
    nVal90 = signedU32(m, sp + 0x20);
    nEnemyCount = signedU32(m, sp + 0x0c);
    nNearbyEnemies = signedU32(m, sp + 0x1c);
    nVal44 = signedU32(m, sp + 0x08);
    nAllyHpCase = signedU32(m, sp + 0x18);
  } finally {
    k2W13B1StackPtr = sp;
  }

  const nLifePct = MONSTERAI_GetLifePct113c(m, pUnit);
  const distTargetSq = UNIT_CalcSqDistSubtiles113c(m, pUnit, pTarget);
  const bHasRoomFlag = signedU16(m, pAiParam + 0x5a) > 0 && DUNGEON_CheckRoomFlags113c(m, pUnit) !== 0 ? 1 : 0;
  const bNotBlocked = DUNGEON_CheckCollisionMask113c(m, pUnit, pTarget, 4) === 0 ? 1 : 0;

  if (nEnemyCount > 3 && RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 32) < nEnemyCount * 2) {
    if (pOwner !== 0 && UNIT_CalcSqDistSubtiles113c(m, pUnit, pOwner) > 0x24) {
      AI_ApproachTarget113c(m, pGame, pUnit, pOwner, 0x0f, 0, 0, 1, 0);
      return;
    }
    if (AI_RunFleeFromUnit_6FD12C10_113c(m, pTarget, pUnit, pGame, 8, 1) !== 0) {
      return;
    }
  }

  const candidates: Array<{ target: number; skillId: number; score: number }> = [
    { target: pTarget, skillId: 0, score: 0 },
  ];
  let bestScore = 0;
  const sumPetStatRef = { val: 0 };
  const candTargetRef = { val: pTarget };

  for (
    let pSkill = SKILLS_GetFirstSkillFromSkillList113c(m, pSkillList);
    pSkill !== 0;
    pSkill = SKILLS_GetNextSkill113c(m, pSkill)
  ) {
    const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1b6b0, 0xe3d);
    const nBaseRange = SKILLS_GetSkillLevel113c(m, pUnit, pSkill, 1);
    const pSkillsTxt = DATATBLS_GetSkillsTxtRecord113c(m, nSkillId);
    if (pSkillsTxt !== 0) {
      const score = scoreSkillCandidate6FCCB580(
        m,
        pUnit,
        pGame,
        pAiParam,
        pOwner,
        pTarget,
        pSkill,
        nSkillId,
        pSkillsTxt,
        nBaseRange,
        nLifePct,
        distTargetSq,
        bHasRoomFlag,
        bNotBlocked,
        pHealAlly,
        nVal90,
        nEnemyCount,
        nNearbyEnemies,
        nVal44,
        nAllyHpCase,
        bInCombat,
        sumPetStatRef,
        candTargetRef,
      );
      if (score > bestScore) {
        bestScore = score;
        candidates.push({ target: candTargetRef.val, skillId: nSkillId, score });
      }
    }
  }

  for (let i = candidates.length - 1; i >= 0; i--) {
    const lo = m.u32(pUnit + 0x20) >>> 0;
    const hi = m.u32(pUnit + 0x24) >>> 0;
    const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi);
    const newLo = Number(prod & 0xffffffffn) >>> 0;
    const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0;
    m.setU32(pUnit + 0x20, newLo);
    m.setU32(pUnit + 0x24, newHi);
    if ((newLo & 3) !== 0) {
      const cand = candidates[i];
      const los = DUNGEON_CheckLineOfSight113c(m, pUnit, cand.target, 0);
      if (MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c(m, pOwner, cand.target, pUnit, cand.skillId, pGame, los, 0, 0) !== 0) {
        const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, cand.skillId);
        if (pSkillsTxt !== 0 && signedU16(m, pSkillsTxt + 0x2e) === 0x13) {
          m.setU32(pAiControl + 0x18, cand.skillId);
          m.setU32(pAiControl + 0x14, 0x19);
        }
        return;
      }
    }
  }

  if (pTarget !== 0) {
    const los = DUNGEON_CheckLineOfSight113c(m, pUnit, pTarget, 0);
    if (MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c(m, pOwner, pTarget, pUnit, 0, pGame, los, 0, 0) !== 0) {
      return;
    }
  }

  AI_Stall113c(m, pGame, pUnit, 0x0f);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCCC410
 * @ordinalOrName D2Game_6FCCC410
 */
export function D2Game_6FCCC410_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
): void {
  hitD2GameVa113c(0x6FCCC410)
  const pAiParam = m.u32(pAiTickParam + 0x1c);
  const bInCombat = signedU32(m, pAiTickParam + 0x18);
  let pTarget = m.u32(pAiTickParam + 0x08);
  const targetDist = signedU32(m, pAiTickParam + 0x14);
  if (pUnit === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x64);
    return;
  }

  clearAurasType2(m, pGame, pUnit);

  if (signedU32(m, pUnit) !== 1) {
    AI_Stall113c(m, pGame, pUnit, 0x64);
    return;
  }
  const pMonsterData = m.u32(pUnit + 0x14);
  if (pMonsterData === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x64);
    return;
  }
  const pAiGeneral = m.u32(pMonsterData + 0x28);
  if (pAiGeneral === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x64);
    return;
  }
  const ownerGame = m.u32(pAiGeneral + 0x28);
  if (ownerGame === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x64);
    return;
  }
  const pOwner = SUNIT_GetServerUnit113c(m, ownerGame, m.u32(pAiGeneral + 0x30), m.u32(pAiGeneral + 0x2c));
  if (pOwner === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x64);
    return;
  }

  let nMaxCounter = signedU16(m, m.u32(pAiTickParam + 0x1c) + 0x84);
  if (nMaxCounter <= 1) nMaxCounter = 1;
  else if (nMaxCounter >= 0x100) nMaxCounter = 0x100;

  const diff0 = m.u8(pGame + 0x6d);
  const wDec = signedU16(m, pAiParam + diff0 * 2 + 0x68);
  const pAiControl = m.u32(pAiTickParam);
  const nextCounter = (signedU32(m, pAiControl + 0x18) + (-1 - wDec)) | 0;
  m.setU32(pAiControl + 0x18, nextCounter);
  if (nextCounter < 0 || nextCounter > (nMaxCounter << 6)) {
    m.setU32(pAiControl + 0x18, 0);
  }

  const distToOwner = UNITS_GetDistanceToOtherUnit113c(m, pUnit, pOwner);
  const diff1 = m.u8(pGame + 0x6d);
  if (
    targetDist > signedU16(m, pAiParam + diff1 * 2 + 0x56) ||
    distToOwner > signedU16(m, pAiParam + diff1 * 2 + 0x5c)
  ) {
    pTarget = 0;
  }

  if (D2Game_6FC3E140_113c(m, pOwner, pGame, pUnit, pTarget, bInCombat, 0, 6) !== 0) {
    return;
  }

  if (pTarget === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }

  const pLeftSkill = UNITS_GetRightSkill113c(m, pOwner);
  const pUsedSkill = UNITS_GetLeftSkill113c(m, pOwner);
  if (pLeftSkill === 0 || pUsedSkill === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }

  const nLeftId = SKILLS_GetSkillIdFromSkill113c(m, pLeftSkill, 0x6fd1b6b0, 0xb53);
  const nUsedId = SKILLS_GetSkillIdFromSkill113c(m, pUsedSkill, 0x6fd1b6b0, 0xb54);
  const nLeftLvl = MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c(m, pOwner, pLeftSkill, pAiTickParam);
  const nUsedLvl = MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c(m, pOwner, pUsedSkill, pAiTickParam);

  SKILLS_AssignSkill113c(m, pUnit, nLeftId, nLeftLvl, 0, 0x6fd1b6b0, 0xb59);
  SKILLS_AssignSkill113c(m, pUnit, nUsedId, nUsedLvl, 0, 0x6fd1b6b0, 0xb5a);

  const pUnitLeftSkill = UNITS_GetSkillFromSkillId113c(m, pUnit, nLeftId, -1);
  const pUnitUsedSkill = UNITS_GetSkillFromSkillId113c(m, pUnit, nUsedId, -1);
  if (pUnitLeftSkill === 0 || pUnitUsedSkill === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }

  let pChosenSkill =
    RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 2) !== 0 ? pUnitUsedSkill : pUnitLeftSkill;
  let nChosenId = SKILLS_GetSkillIdFromSkill113c(m, pChosenSkill, 0x6fd1b6b0, 0xb66);

  let nCount = signedU32(m, m.u32(pAiTickParam) + 0x1c);
  if (nCount <= 1) nCount = 1;
  const diff2 = m.u8(pGame + 0x6d);
  let chance = (signedU16(m, pAiParam + diff2 * 2 + 0x62) - nCount * 2) | 0;
  if (chance <= 5) chance = 5;
  else if (chance >= 100) chance = 100;

  if (bInCombat !== 0 && RANDOM_RollBounded113c(m, (pUnit + 0x20) >>> 0, 100) < chance) {
    pChosenSkill = UNITS_GetSkillFromSkillId113c(m, pUnit, 0, -1);
    nChosenId = 0;
  }

  if (MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c(m, nChosenId, pOwner, pUnit, pGame, pChosenSkill, pAiTickParam) === 0) {
    pChosenSkill = pChosenSkill === pUnitUsedSkill ? pUnitLeftSkill : pUnitUsedSkill;
    const nAltId = SKILLS_GetSkillIdFromSkill113c(m, pChosenSkill, 0x6fd1b6b0, 0xb79);
    if (MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c(m, nAltId, pOwner, pUnit, pGame, pChosenSkill, pAiTickParam) === 0) {
      pChosenSkill = UNITS_GetSkillFromSkillId113c(m, pUnit, 0, -1);
      if (pChosenSkill === 0) {
        SKILLS_AssignSkill113c(m, pUnit, 0, 1, 0, 0x6fd1b6b0, 0xb81);
        pChosenSkill = UNITS_GetSkillFromSkillId113c(m, pUnit, 0, -1);
      }
    }
  }

  if (pChosenSkill === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }

  const nFinalSkillId = SKILLS_GetSkillIdFromSkill113c(m, pChosenSkill, 0x6fd1b6b0, 0xb8f);
  if (SKILLS_CheckSkillDelay113c(m, pUnit, pChosenSkill) === 1) {
    if (bInCombat === 0) {
      AI_ApproachTarget113c(m, pGame, pUnit, pTarget, 0x0f, 0, 0, 1, 0);
      return;
    }
    const nSkillIdCast = SKILLS_GetSkillIdFromSkill113c(m, pChosenSkill, 0x6fd1b6b0, 0xb96);
    const mode = SKILLS_GetSkillModeFromSkill113c(m, pChosenSkill);
    AI_CastSkillWithMode113c(m, mode, pUnit, pGame, nSkillIdCast, pTarget, 0, 0);
  } else {
    const nSkillIdCast = SKILLS_GetSkillIdFromSkill113c(m, pChosenSkill, 0x6fd1b6b0, 0xba8);
    const mode = SKILLS_GetSkillModeFromSkill113c(m, pChosenSkill);
    AI_CastSkillWithMode113c(m, mode, pUnit, pGame, nSkillIdCast, pTarget, 0, 0);
  }

  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nFinalSkillId);
  let nSkillLevel = SKILLS_GetSkillLevel113c(m, pUnit, pChosenSkill, 1);
  if (nSkillLevel <= 1) nSkillLevel = 1;
  const nDelay = SKILLS_EvaluateSkillFormula113c(
    m,
    pUnit,
    m.u32(pSkillsTxt + 0x190),
    nFinalSkillId,
    nSkillLevel,
  );
  const mulHi = Number((BigInt(nDelay | 0) * 0x55555556n) >> 32n) | 0;
  const div3 = (mulHi + (mulHi >>> 31)) | 0;
  const nextFrame = (div3 + signedU32(m, pGame + 0xa8) + 0x12) | 0;
  m.setU32(m.u32(pAiTickParam) + 0x14, nextFrame);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDB4F0
 * @ordinalOrName D2Game_6FCDB4F0
 */
export function D2Game_6FCDB4F0_113c(
  m: D2KernMemory113c,
  eax: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCDB4F0)
  D2Game_6FCBE170_113c(m, pUnit, 0x67, eax, 0);
  let pClient = 0;
  if (pUnit !== 0 && signedU32(m, pUnit) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit);
    pClient = m.u32(pPlayerData + 0x9c);
  }
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x10) >>> 0;
  try {
    m.setU32(sp, 0x0001175d);
    m.setU16(sp + 4, 0);
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 6);
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDE2A0
 * @ordinalOrName D2Game_6FCDE2A0
 */
export function D2Game_6FCDE2A0_113c(
  m: D2KernMemory113c,
  pShop: number,
  pPlayer: number,
  pGame: number,
  pNpc: number,
): void {
  hitD2GameVa113c(0x6FCDE2A0)
  const pGambleTbl = DATATBLS_GetGambleRecord113c(m);
  if (pGambleTbl === 0) return;
  const pDiffLvl = DATATBLS_GetDifficultyLevelsTxtRecord113c(m, m.u8(pGame + 0x6d));
  if (pDiffLvl === 0) return;

  const totalOdds = (signedU32(m, pDiffLvl + 0x44) + signedU32(m, pDiffLvl + 0x48) + signedU32(m, pDiffLvl + 0x4c)) | 0;
  if (m.u32(0x6fd31f80) === 0) {
    DATATBLS_GetItemIdFromItemCode113c(m, 0x206e6972, 0x6fd31f80);
  }
  if (m.u32(0x6fd31f7c) === 0) {
    DATATBLS_GetItemIdFromItemCode113c(m, 0x20756d61, 0x6fd31f7c);
  }

  const pNode = FOG_AllocPool113c(m, m.u32(pGame + 0x1c), 0x0c, 0x6fd1b3a4, 0xd94, 0);
  if (pNode === 0) return;

  const pInv = INVENTORY_AllocInventory113c(m, m.u32(pGame + 0x1c), 0);
  m.setU32(pNode + 0x00, pInv);
  m.setU32(pNode + 0x04, pPlayer !== 0 ? m.u32(pPlayer + 0x0c) : -1);
  m.setU32(pNode + 0x08, m.u32(pShop + 0x08));
  m.setU32(pShop + 0x08, pNode);

  const nPlayerLvl = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0c, 0);
  const pSeed = (m.u32(pGame + 0x1d24) + 0x08) >>> 0;
  let count = 0;

  do {
    const r10 = SEED_RollLimitedFast113c(m, pSeed, 10);
    let itemLvl = (nPlayerLvl + r10 - 5) | 0;
    if (itemLvl <= 5) itemLvl = 5;
    else if (itemLvl >= 0x63) itemLvl = 0x63;

    const nBucketCount = signedU32(m, pGambleTbl + itemLvl * 4 + 0x08);
    let idx = 0;
    if (nBucketCount > 0) {
      if ((nBucketCount & (nBucketCount - 1)) === 0) {
        const lo = m.u32(pSeed) >>> 0;
        const hi = m.u32(pSeed + 4) >>> 0;
        const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi);
        const newLo = Number(prod & 0xffffffffn) >>> 0;
        const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0;
        m.setU32(pSeed, newLo);
        m.setU32(pSeed + 4, newHi);
        idx = (newLo & (nBucketCount - 1)) | 0;
      } else {
        idx = SEED_RollLimitedFast113c(m, pSeed, nBucketCount);
      }
    }

    let nItemId = signedU32(m, m.u32(pGambleTbl + 0x04) + idx * 4);
    if (signedU32(m, pGame + 0x70) === 0) {
      const pItemsTxt = DATATBLS_GetItemsTxtRecord113c(m, nItemId);
      if (pItemsTxt === 0) return;
      if (m.u16(pItemsTxt + 0xf6) >= 0x64) {
        continue;
      }
    }

    if (count < 2) {
      nItemId = count === 0 ? signedU32(m, 0x6fd31f80) : signedU32(m, 0x6fd31f7c);
    }

    nItemId = NPC_RollStoreItemUpgrade_6FCDD040_113c(
      m,
      itemLvl,
      pGame,
      nItemId,
      signedU32(m, pDiffLvl + 0x50),
      signedU32(m, pDiffLvl + 0x54),
    );

    let nQuality = 4;
    if (totalOdds > 0) {
      const roll = SEED_RollLimitedFast113c(m, pSeed, 0x186a0);
      if (roll < totalOdds) {
        const uniqueOdds = signedU32(m, pDiffLvl + 0x4c);
        if (roll < uniqueOdds) {
          nQuality = 7;
        } else {
          const setEnd = (uniqueOdds + signedU32(m, pDiffLvl + 0x48)) | 0;
          nQuality = roll >= setEnd ? 6 : 5;
        }
      }
    }

    count = (count + 1) | 0;
    const pItem = ITEMS_SpawnItemWithParams_6FC31980_113c(
      m,
      itemLvl,
      1,
      0,
      pNpc,
      nItemId,
      pGame,
      4,
      nQuality,
      0,
      0,
      0,
    );
    if (pItem !== 0) {
      ITEMS_SetItemPage113c(m, pItem, 0);
      if (ITEMS_CanItemBeRepairedByNpc113c(m, pItem) !== 0) {
        if (
          ITEMS_CheckIfThrowable113c(m, pItem) !== 0 &&
          ITEMS_GetTwoHandedFlag113c(m, pItem) !== 0
        ) {
          const maxStack = ITEMS_GetTotalMaxStack113c(m, pItem);
          STATLIST_SetUnitStat113c(m, pItem, 0x46, maxStack, 0);
        }
        ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(m, pGame, 0, pItem);
        if (ITEMS_CheckItemFlag113c(m, pItem, 0x100, 0xba, 0x6fd1b3a4) !== 0) {
          ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c(m, 0, pItem, pGame);
        } else {
          const maxDur = ITEMS_GetMaxDurabilityFromUnit113c(m, pItem);
          if (maxDur > 0) {
            STATLIST_SetUnitStat113c(m, pItem, 0x48, maxDur, 0);
          }
        }
      }
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x10, 0);
      const y = getUnitPosY(m, pItem);
      const x = getUnitPosX(m, pItem);
      if (
        D2Game_6FCF76A0_113c(
          m,
          0x6fd1b3a4,
          0xde4,
          pGame,
          pNpc,
          m.u32(pItem + 0x0c),
          x,
          y,
          1,
          0,
          m.u32(pNode),
        ) === 0
      ) {
        ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pItem);
        return;
      }
    }
  } while (count < 14);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDE640
 * @ordinalOrName D2Game_6FCDE640
 */
export function D2Game_6FCDE640_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pNpc: number,
  dwItemGuid: number,
  nBuyMode: number,
  bFillStack: number,
): number {
  hitD2GameVa113c(0x6FCDE640)
  if (pGame === 0) {
    FOG_Assertion113c(m, 0x7d5, 0x6fd19ff9);
  }

  let pItem = m.u32(pGame + 0x1720 + (dwItemGuid & 0x7f) * 4);
  while (pItem !== 0 && m.u32(pItem + 0x0c) !== (dwItemGuid >>> 0)) {
    pItem = m.u32(pItem + 0xe4);
  }

  const getPlayerClient = (): number => {
    if (pPlayer !== 0 && signedU32(m, pPlayer) === 0) {
      return m.u32(UNITS_GetPlayerData113c(m, pPlayer) + 0x9c);
    }
    return 0;
  };

  const sendResult = (code: number, guid: number, flag: number): void => {
    const gold = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0e, 0);
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, code, gold, getPlayerClient(), guid, flag);
  };

  if (pItem === 0) {
    const pClient = getPlayerClient();
    const gold = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0e, 0);
    const sp = k2W13B1StackPtr;
    k2W13B1StackPtr = (sp + 0x10) >>> 0;
    try {
      m.setU8(sp + 0, 0x2a);
      m.setU8(sp + 1, 0);
      m.setU8(sp + 2, 7);
      m.setU32(sp + 3, 0);
      m.setU32(sp + 7, dwItemGuid);
      m.setU32(sp + 11, gold);
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x0f);
    } finally {
      k2W13B1StackPtr = sp;
    }
    return 1;
  }

  const wBuyMode = nBuyMode & 0xffff;
  if (wBuyMode === 0) {
    if (ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pNpc, pItem) === 0) {
      sendResult(7, dwItemGuid, 0);
      return 1;
    }
  } else if (wBuyMode === 2) {
    const pGambleInv = SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(m, pNpc, pGame, pPlayer);
    if (pGambleInv === 0 || ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pNpc, pItem, pGambleInv) !== 1) {
      sendResult(7, dwItemGuid, 0);
      return 1;
    }
  }

  const npcClassId = pNpc !== 0 ? signedU32(m, pNpc + 0x04) : -1;
  const diff = m.u8(pGame + 0x6d);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  let nCost = ITEMS_GetTransactionCost113c(
    m,
    pPlayer,
    pItem,
    diff,
    m.u32(pPlayerData + diff * 4 + 0x10),
    npcClassId,
    wBuyMode,
  );
  const totalGold = (
    STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0e, 0) +
    STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0f, 0)
  ) | 0;
  if (nCost > totalGold) {
    sendResult(0x0c, -1, 0);
    return 0;
  }

  const pInv = m.u32(pPlayer + 0x60);
  if (INVENTORY_GetCursorItem113c(m, pInv) !== 0) {
    sendResult(7, -1, 0);
    return 1;
  }

  if ((NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c(m, pNpc, pGame, pItem) & 0xff) === 0) {
    bFillStack = 0;
  }

  if (ITEMS_CheckItemTypeId113c(m, pItem, 0x16) !== 0) {
    const sp = k2W13B1StackPtr;
    k2W13B1StackPtr = (sp + 0x10) >>> 0;
    let pTome = 0;
    let maxScrolls = 0;
    try {
      m.setU32(sp, 0);
      pTome = ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c(m, pItem, pPlayer, sp);
      maxScrolls = signedU32(m, sp);
    } finally {
      k2W13B1StackPtr = sp;
    }
    if (pTome !== 0) {
      let nToBuy = 1;
      if (bFillStack !== 0) {
        nToBuy = ((totalGold >>> 0) / (nCost >>> 0)) | 0;
        if (nToBuy > maxScrolls) nToBuy = maxScrolls;
      }
      if (NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayer, (nToBuy * nCost) | 0) === 0) {
        sendResult(0x0c, -1, 0);
        return 0;
      }
      ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c(m, pTome, pPlayer, nToBuy);
      NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c(m, pItem, pGame, pNpc, pPlayer, wBuyMode);
      sendResult(0, m.u32(pTome + 0x0c), 5);
      return 0;
    }
  }

  let nOrigQty = STATLIST_UnitGetStatValue113c(m, pItem, 0x46, 0);
  if (bFillStack !== 0 && ITEMS_IsAutoStack113c(m, pItem) !== 0) {
    const savedQty = STATLIST_UnitGetStatValue113c(m, pItem, 0x46, 0);
    STATLIST_SetUnitStat113c(m, pItem, 0x46, 1, 0);
    const qFlag = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
    const unitCost = ITEMS_GetTransactionCost113c(
      m,
      pPlayer,
      pItem,
      m.u8(pGame + 0x6d),
      qFlag,
      npcClassId,
      0,
    );
    STATLIST_SetUnitStat113c(m, pItem, 0x46, savedQty, 0);
    const maxAffordable = ((totalGold >>> 0) / (unitCost >>> 0)) | 0;
    const sp = k2W13B1StackPtr;
    k2W13B1StackPtr = (sp + 0x10) >>> 0;
    let pStackTarget = 0;
    let availSpace = 0;
    try {
      m.setU32(sp, 0);
      pStackTarget = ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c(m, pPlayer, pItem, sp);
      availSpace = signedU32(m, sp);
    } finally {
      k2W13B1StackPtr = sp;
    }
    const clampedQty = availSpace < maxAffordable ? availSpace : maxAffordable;
    if (pStackTarget !== 0) {
      if (clampedQty <= 0 || NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayer, (clampedQty * unitCost) | 0) === 0) {
        sendResult(0x0c, -1, 0);
        return 0;
      }
      NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c(m, pItem, pGame, pNpc, pPlayer, wBuyMode);
      STATLIST_AddUnitStat113c(m, pStackTarget, 0x46, clampedQty, 0);
      const newQty = STATLIST_UnitGetStatValue113c(m, pStackTarget, 0x46, 0);
      NET_SendPacket0x3E_ItemStatBitStream113c(m, pStackTarget, 0, getPlayerClient(), 1, 0x46, newQty);
      sendResult(0, m.u32(pStackTarget + 0x0c), 5);
      return 0;
    }
    nOrigQty = clampedQty > 1 ? clampedQty : 1;
    nCost = (nOrigQty * unitCost) | 0;
  }

  if (INVENTORY_CanItemBePlaced113c(m, pInv, pItem) === 0) {
    bFillStack = 0;
  }

  let bBoughtOnce = 0;
  while (bBoughtOnce === 0 || bFillStack !== 0) {
    const savedGoldInv = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0e, 0);
    const savedGoldStash = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0f, 0);
    const pDupItem = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, pGame, pItem, 1);
    if (pDupItem === 0) {
      sendResult(9, -1, 0);
      return 1;
    }
    if (bFillStack !== 0 && ITEMS_GetTwoHandedFlag113c(m, pDupItem) !== 0 && nOrigQty !== 0) {
      STATLIST_SetUnitStat113c(m, pDupItem, 0x46, nOrigQty, 0);
    }
    if (NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayer, nCost) === 0) {
      sendResult(0x0c, -1, 0);
      return 0;
    }
    m.setU32(UNITS_GetPlayerData113c(m, pPlayer) + 0x6c, m.u32(pDupItem + 0x0c));
    ITEMS_SetItemCMDFlag113c(m, pDupItem, 4);

    let bPlaced = 0;
    let bShouldAutoEquip = 1;
    if (INVENTORY_CanItemBePlaced113c(m, pInv, pDupItem) !== 0) {
      const sp = k2W13B1StackPtr;
      k2W13B1StackPtr = (sp + 0x10) >>> 0;
      try {
        m.setU32(sp, 0);
        bPlaced = ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c(m, m.u32(pDupItem + 0x0c), pGame, pPlayer, 0, 1, sp);
        if (bPlaced === 0) bFillStack = 0;
      } finally {
        k2W13B1StackPtr = sp;
      }
    }
    if (bPlaced === 0) {
      bShouldAutoEquip = 1;
      const bHasBelt = INVENTORY_GetBeltItem113c(m, pInv) !== 0 ? 1 : 0;
      const nBeltSlots = UNITS_GetBeltType113c(m, pPlayer);
      const dwCode = m.u32(pDupItem + 0x04);
      const tscId = m.u32(0x6fd31c0c);
      const ibkId = m.u32(0x6fd31c10);
      if (dwCode === tscId && bHasBelt !== 0 && nBeltSlots !== 7) {
        bShouldAutoEquip = 0;
      }
      if (dwCode === ibkId) {
        if (bHasBelt !== 0 && nBeltSlots !== 1) bShouldAutoEquip = 0;
      }
      let skipAutoEquip = false;
      if (bHasBelt !== 0) {
        if (ITEMS_CheckItemTypeId113c(m, pDupItem, 0x2d) !== 0) skipAutoEquip = true;
      } else if (dwCode === tscId || dwCode === ibkId) {
        skipAutoEquip = true;
      }
      if (!skipAutoEquip && bShouldAutoEquip !== 0) {
        bPlaced = ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c(m, pDupItem, pPlayer, 0);
      }
      if (bPlaced === 0) {
        if (bBoughtOnce === 0) {
          ITEMS_SetItemPage113c(m, pDupItem, 0);
          bPlaced = D2Game_6FCF76A0_113c(
            m,
            0x6fd1b3a4,
            0x907,
            pGame,
            pPlayer,
            m.u32(pDupItem + 0x0c),
            0,
            0,
            1,
            1,
            0,
          );
        }
        if (bPlaced === 0) {
          const curGoldInv = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0e, 0);
          if (savedGoldInv !== curGoldInv) {
            const diffInv = (savedGoldInv - STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0e, 0)) | 0;
            STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 0x0e, diffInv);
          }
          const curGoldStash = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0f, 0);
          if (savedGoldStash !== curGoldStash) {
            const diffStash = (savedGoldStash - STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0f, 0)) | 0;
            STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 0x0f, diffStash);
          }
          ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pDupItem);
          if (bBoughtOnce === 0) {
            sendResult(0x0a, -1, 0);
          }
          return 0;
        }
      }
    }

    NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c(m, pItem, pGame, pNpc, pPlayer, wBuyMode);
    ITEMS_SetOrClearCommandFlags113c(m, pDupItem, 2, 1);
    sendResult(0, m.u32(pDupItem + 0x0c), 4);
    bBoughtOnce = 1;
  }

  return 0;
}

function cstrEqCi113c(m: D2KernMemory113c, ptrA: number, ptrB: number): boolean {
  let offset = 0;
  while (true) {
    let a = m.u8(ptrA + offset);
    let b = m.u8(ptrB + offset);
    if (a >= 0x41 && a <= 0x5a) a += 0x20;
    if (b >= 0x41 && b <= 0x5a) b += 0x20;
    if (a !== b) return false;
    if (a === 0) return true;
    offset++;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDEE30
 * @ordinalOrName D2Game_6FCDEE30
 */
export function D2Game_6FCDEE30_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwItemCode: number,
  pNpc: number,
  pShop: number,
  nQuality: number,
  nItemLevel: number,
  nPlayerLevel: number,
): number {
  hitD2GameVa113c(0x6FCDEE30)
  if (pGame === 0) {
    FOG_Assertion113c(m, 0xfd, 0x6fd19ff9);
  }
  if (pNpc === 0) {
    FOG_Assertion113c(m, 0xfe, 0x6fd19ff9);
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x10) >>> 0;
  let pItemsTxt = 0;
  let nItemId = 0;
  let chosenCode = dwItemCode;
  try {
    m.setU32(sp, 0);
    pItemsTxt = DATATBLS_GetItemIdFromItemCode113c(m, dwItemCode, sp);
    nItemId = signedU32(m, sp);
    const diff = m.u8(pGame + 0x6d);
    if (diff > 0 && nPlayerLevel > 0x19) {
      const pSeed = (m.u32(pGame + 0x1d24) + 0x08) >>> 0;
      const roll = SEED_RollLimitedFast113c(m, pSeed, 0x186a0) >>> 0;
      if (diff === 1) {
        if (roll < (((nItemLevel << 6) + 0xfa0) >>> 0)) {
          const normCode = m.u32(pItemsTxt + 0x88);
          if (normCode !== 0 && normCode !== 0x20202020) {
            DATATBLS_GetItemIdFromItemCode113c(m, normCode, sp);
            nItemId = signedU32(m, sp);
            chosenCode = normCode;
          } else {
            const uberCode = m.u32(pItemsTxt + 0x19c);
            if (uberCode !== 0x20787878) {
              DATATBLS_GetItemIdFromItemCode113c(m, uberCode, sp);
              nItemId = signedU32(m, sp);
              chosenCode = uberCode;
            }
          }
        } else {
          const uberCode = m.u32(pItemsTxt + 0x19c);
          if (uberCode !== 0x20787878) {
            DATATBLS_GetItemIdFromItemCode113c(m, uberCode, sp);
            nItemId = signedU32(m, sp);
            chosenCode = uberCode;
          }
        }
      } else {
        let matchedUltra = false;
        if (signedU32(m, pGame + 0x70) !== 0 && roll < (((nItemLevel << 4) + 0x3e8) >>> 0)) {
          const ultraCode = m.u32(pItemsTxt + 0x8c);
          if (ultraCode !== 0 && ultraCode !== 0x20202020) {
            DATATBLS_GetItemIdFromItemCode113c(m, ultraCode, sp);
            nItemId = signedU32(m, sp);
            chosenCode = ultraCode;
            matchedUltra = true;
          }
        }
        if (!matchedUltra && roll < (((nItemLevel << 7) + 0x1388) >>> 0)) {
          const normCode = m.u32(pItemsTxt + 0x88);
          if (normCode !== 0x20202020 && normCode !== 0) {
            DATATBLS_GetItemIdFromItemCode113c(m, normCode, sp);
            nItemId = signedU32(m, sp);
            chosenCode = normCode;
          }
        }
        const ultraAlt = m.u32(pItemsTxt + 0x1a0);
        if (ultraAlt !== 0x20787878) {
          DATATBLS_GetItemIdFromItemCode113c(m, ultraAlt, sp);
          nItemId = signedU32(m, sp);
          chosenCode = ultraAlt;
        }
      }
    }
  } finally {
    k2W13B1StackPtr = sp;
  }

  let outerTries = 0;
  let curQuality = nQuality;
  let pItem = 0;
  while (outerTries < 2) {
    let innerTries = 0;
    let bValid = 0;
    do {
      pItem = ITEMS_SpawnItemWithParams_6FC31980_113c(
        m,
        nItemLevel,
        1,
        0,
        pNpc,
        nItemId,
        pGame,
        4,
        curQuality,
        0,
        0,
        0,
      );
      bValid = 1;
      if (ITEMS_GetItemQuality113c(m, pItem) === 1) {
        const fileIdx = ITEMS_GetItemCell113c(m, pItem);
        const pLowQual = DATATBLS_GetBooksTxtRecord113c(m, fileIdx);
        if (cstrEqCi113c(m, pLowQual, 0x6fd1b39c)) {
          D2GAME_SUNIT_IterateAllLivingPlayers113c(m, pGame, (mem, _g, pPlr, pTargetItem) => {
            ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlr, pTargetItem);
          }, pItem);
          SUNIT_FreeUnit113c(m, pGame, pItem);
          pItem = 0;
          bValid = 0;
        }
      }
      innerTries++;
    } while (bValid === 0 && innerTries < 5);

    if (bValid === 0) return 0;

    if ((ITEMS_GetBaseCode113c(m, pItem) >>> 0) === (chosenCode >>> 0)) {
      outerTries = 3;
    } else {
      D2GAME_SUNIT_IterateAllLivingPlayers113c(m, pGame, (mem, _g, pPlr, pTargetItem) => {
        ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(mem, pPlr, pTargetItem);
      }, pItem);
      SUNIT_FreeUnit113c(m, pGame, pItem);
      curQuality = 2;
      pItem = 0;
      outerTries++;
    }
  }

  if (pItem === 0) return 0;

  const bPage = ITEMS_GetStorePage113c(m, pItem) & 0xff;
  if (bPage === 0xff) {
    ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pItem);
    return 0;
  }

  ITEMS_SetItemPage113c(m, pItem, bPage);
  NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, 0, pItem, pGame);
  const guid = m.u32(pItem + 0x0c);
  const y = UNIT_GetPosY113c(m, pItem);
  const x = UNIT_GetPosX113c(m, pItem);
  if (D2Game_6FCF76A0_113c(m, 0x6fd1b3a4, 0x167, pGame, pNpc, guid, x, y, 1, 1, 0) !== 0) {
    NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c(m, pItem, pNpc, pShop);
    return pItem;
  }

  if (bPage === 1) {
    ITEMS_SetItemPage113c(m, pItem, 2);
    const guid2 = m.u32(pItem + 0x0c);
    const y2 = UNIT_GetPosY113c(m, pItem);
    const x2 = UNIT_GetPosX113c(m, pItem);
    if (D2Game_6FCF76A0_113c(m, 0x6fd1b3a4, 0x16d, pGame, pNpc, guid2, x2, y2, 1, 1, 0) !== 0) {
      NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c(m, pItem, pNpc, pShop);
      return pItem;
    }
  }

  NPCS_QueueOrFreeVendorItem_6FCB0260_113c(m, pGame, pNpc, pItem, 0);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDF990
 * @ordinalOrName D2Game_6FCDF990
 */
export function D2Game_6FCDF990_113c(
  m: D2KernMemory113c,
  dwNpcGuid: number,
  pGame: number,
  pPlayer: number,
  dwItemGuid: number,
  nSellMode: number,
): number {
  hitD2GameVa113c(0x6FCDF990)
  if (pGame === 0) {
    FOG_Assertion113c(m, 0x4a9, 0x6fd19ff9);
  }

  const pInteractingUnit =
    m.u8(pPlayer + 0x6c) !== 0
      ? SUNIT_GetServerUnit113c(m, pGame, m.u32(pPlayer + 0x68), m.u32(pPlayer + 0x64))
      : 0;

  let pNpc = m.u32(pGame + 0x1320 + (dwNpcGuid & 0x7f) * 4);
  while (pNpc !== 0 && m.u32(pNpc + 0x0c) !== (dwNpcGuid >>> 0)) {
    pNpc = m.u32(pNpc + 0xe4);
  }

  let pItem = m.u32(pGame + 0x1720 + (dwItemGuid & 0x7f) * 4);
  if (pItem === 0) return 1;
  while (pItem !== 0 && m.u32(pItem + 0x0c) !== (dwItemGuid >>> 0)) {
    pItem = m.u32(pItem + 0xe4);
  }
  if (pItem === 0) return 1;

  const getPlayerClient = (): number =>
    signedU32(m, pPlayer) === 0 ? m.u32(UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) : 0;

  const sendResult = (code: number, guid: number, flag: number): void => {
    const gold = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0e, 0);
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, code, gold, getPlayerClient(), guid, flag);
  };

  if (pNpc === 0 || pInteractingUnit !== pNpc) {
    const pClient = getPlayerClient();
    const gold = STATLIST_UnitGetStatValue113c(m, pPlayer, 0x0e, 0);
    const sp = k2W13B1StackPtr;
    k2W13B1StackPtr = (sp + 0x10) >>> 0;
    try {
      m.setU8(sp + 0, 0x2a);
      m.setU8(sp + 1, 0);
      m.setU8(sp + 2, 9);
      m.setU32(sp + 3, 0);
      m.setU32(sp + 7, -1);
      m.setU32(sp + 11, gold);
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x0f);
    } finally {
      k2W13B1StackPtr = sp;
    }
    return 1;
  }

  if (ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, pItem) === 0) {
    sendResult(0x0b, -1, 0);
    return 3;
  }

  const wSellMode = nSellMode & 0xffff;
  if (signedU32(m, pItem + 0x10) !== wSellMode || ITEMS_CheckIfTradable113c(m, pItem) === 0) {
    sendResult(9, -1, 0);
    return 3;
  }

  const qFlag = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
  let nSellPrice = ITEMS_GetTransactionCost113c(
    m,
    pPlayer,
    pItem,
    m.u8(pGame + 0x6d),
    qFlag,
    signedU32(m, pNpc + 0x04),
    1,
  );

  let bCanResell = 1;
  if (ITEMS_GetItemQuality113c(m, pItem) === 1) {
    const fileIdx = ITEMS_GetItemCell113c(m, pItem);
    const pLowQual = DATATBLS_GetBooksTxtRecord113c(m, fileIdx);
    if (cstrEqCi113c(m, pLowQual, 0x6fd1b39c)) bCanResell = 0;
  }
  if (ITEMS_CheckItemFlag113c(m, pItem, 0x100, 0x500, 0x6fd1b3a4) !== 0) bCanResell = 0;
  if (ITEMS_GetItemTypeFromItem113c(m, pItem) === 7) bCanResell = 0;
  if (ITEMS_CheckItemFlag113c(m, pItem, 0x1000000, 0x508, 0x6fd1b3a4) !== 0) bCanResell = 0;
  if (ITEMS_CheckItemFlag113c(m, pItem, 0x400000, 0x50c, 0x6fd1b3a4) !== 0) bCanResell = 0;
  if (ITEMS_HasSocketedSubItems113c(m, pItem) !== 0) bCanResell = 0;
  if (ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pItem) !== 0) bCanResell = 0;

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x28) >>> 0;
  let pNpcRecord = 0;
  try {
    m.setU32(sp, 0);
    pNpcRecord = SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c(m, pNpc, pGame, sp);
  } finally {
    k2W13B1StackPtr = sp;
  }
  const pTrade = SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c(m, pPlayer, pNpcRecord, pGame);
  if (m.u8(pTrade + 0x04) !== 0) bCanResell = 0;

  let pShopItem = 0;
  if (bCanResell !== 0 && (NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c(m, pNpc, pGame, pItem) & 0xff) === 0) {
    pShopItem = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, pGame, pItem, 1);
    if (pShopItem === 0) {
      sendResult(9, -1, 0);
      return 3;
    }
    ITEMS_SetItemCMDFlag113c(m, pShopItem, 4);
    const bPage = ITEMS_GetStorePage113c(m, pShopItem) & 0xff;
    if (bPage === 0xff) {
      ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pShopItem);
      pShopItem = 0;
    } else {
      ITEMS_SetItemPage113c(m, pShopItem, bPage);
      const guid = m.u32(pShopItem + 0x0c);
      const y = UNIT_GetPosY113c(m, pShopItem);
      const x = UNIT_GetPosX113c(m, pShopItem);
      let placed = D2Game_6FCF76A0_113c(m, 0x6fd1b3a4, 0x553, pGame, pNpc, guid, x, y, 1, 1, 0);
      if (placed === 0 && bPage === 1) {
        ITEMS_SetItemPage113c(m, pShopItem, 2);
        const guid2 = m.u32(pShopItem + 0x0c);
        const y2 = UNIT_GetPosY113c(m, pShopItem);
        const x2 = UNIT_GetPosX113c(m, pShopItem);
        placed = D2Game_6FCF76A0_113c(m, 0x6fd1b3a4, 0x559, pGame, pNpc, guid2, x2, y2, 1, 1, 0);
      }
      if (placed === 0) {
        ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pShopItem);
        pShopItem = 0;
      } else {
        NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c(m, pShopItem, pNpc, 1);
        STATLIST_SetUnitStat113c(m, pShopItem, 0x48, ITEMS_GetMaxDurabilityFromUnit113c(m, pShopItem), 0);
        STATLIST_SetUnitStat113c(m, pShopItem, 0x46, ITEMS_GetTotalMaxStack113c(m, pShopItem), 0);
        const qFlag2 = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, pPlayer, pGame);
        const resaleCost = ITEMS_GetTransactionCost113c(
          m,
          pPlayer,
          pShopItem,
          m.u8(pGame + 0x6d),
          qFlag2,
          signedU32(m, pNpc + 0x04),
          1,
        );
        if (nSellPrice > resaleCost) nSellPrice = resaleCost;
      }
    }
  }

  if (wSellMode === 0) {
    if (ITEMS_CheckItemTypeId113c(m, pItem, 0x16) !== 0) {
      const bookIdx = ITEMS_GetMagicSuffix113c(m, pItem, 0) & 0xffff;
      const pBooksTxt = DATATBLS_GetQualityItemsTxtRecord113c(m, bookIdx);
      QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c(m, pPlayer, m.u32(pBooksTxt + 0x08), 1);
    } else if (ITEMS_CheckItemTypeId113c(m, pItem, 0x12) !== 0) {
      const qty = STATLIST_UnitGetStatValue113c(m, pItem, 0x46, 0);
      if (qty >= 0) {
        const bookIdx = ITEMS_GetMagicSuffix113c(m, pItem, 0) & 0xffff;
        const pBooksTxt = DATATBLS_GetQualityItemsTxtRecord113c(m, bookIdx);
        QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c(m, pPlayer, m.u32(pBooksTxt + 0x0c), qty);
      }
    }
    const sp2 = k2W13B1StackPtr;
    k2W13B1StackPtr = (sp2 + 0x10) >>> 0;
    try {
      m.setU32(sp2, 0);
      ITEMS_SerializeItemToBitstream113c(m, sp2, 0x20, 1);
      const cell = ITEMS_GetInvPage113c(m, pItem);
      ITEMS_SetNodePage113c(m, pItem, cell);
      NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(m, pItem, pPlayer, getPlayerClient(), m.u32(sp2));
    } finally {
      k2W13B1StackPtr = sp2;
    }
    ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, pPlayer, pItem, pGame, 0);
  } else if (wSellMode === 4) {
    if (ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pPlayer, pItem, pGame) === 0) {
      sendResult(9, -1, 0);
      return 1;
    }
  } else {
    const sp3 = k2W13B1StackPtr;
    k2W13B1StackPtr = (sp3 + 0x10) >>> 0;
    let bodyLoc = 0;
    bodyLoc = ITEMS_GetBodyLocation113c(m, pItem);
    let unequipRc = 0;
    try {
      m.setU32(sp3, wSellMode);
      unequipRc = D2Game_6FCF8970_113c(m, pGame, pPlayer, bodyLoc, 1, sp3);
    } finally {
      k2W13B1StackPtr = sp3;
    }
    if (unequipRc === 0) {
      if (pShopItem !== 0) {
        ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, pGame, pShopItem);
      }
      return 1;
    }
  }

  ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(m, pPlayer, pGame, nSellPrice);
  sendResult(1, dwItemGuid, 3);
  return 0;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCE1030
 * @ordinalOrName D2Game_6FCE1030
 */
export function D2Game_6FCE1030_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  nSellerClassId: number,
): void {
  hitD2GameVa113c(0x6FCE1030)
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (sp + 0x10) >>> 0;
  let pNpcRecord = 0;
  try {
    m.setU32(sp, 0);
    pNpcRecord = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, sp, pGame, nSellerClassId);
  } finally {
    k2W13B1StackPtr = sp;
  }
  if (pNpcRecord === 0) return;
  const pShop = m.u32(pNpcRecord + 0x10);
  if (pShop === 0) return;

  if (signedU32(m, pGame + 0x70) !== 0) {
    if (PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, pPlayer, 7, 1, pGame) !== 0) {
      NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c(m, pGame, pNpcRecord, nSellerClassId);
      return;
    }
  }

  if (signedU32(m, pGame + 0x70) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
    if (pPlayerData !== 0) {
      const pDataTables = m.u32(m.u32(0x6fd1829c));
      if (signedU32(m, pDataTables + 0xbf0) > 7) {
        const pQuestData = m.u32(pPlayerData + 0x44);
        if (pQuestData !== 0) {
          const pHead = (m.u32(pQuestData) + 0x54) >>> 0;
          if (pHead !== 0) {
            let pNode = m.u32(pHead);
            while (pNode !== 0 && (m.u8(pNode) & 1) !== 0) {
              pNode = m.u32(pNode + 0x14);
            }
            if (pNode !== 0 && (m.u8(pNode) & 1) === 0) {
              const targetGuid = m.u32(pNode + 0x04);
              let pMon = m.u32(pGame + 0x1320 + (targetGuid & 0x7f) * 4);
              while (pMon !== 0 && m.u32(pMon + 0x0c) !== targetGuid) {
                pMon = m.u32(pMon + 0xe4);
              }
              if (pMon !== 0) return;
            }
          }
        }
      }
    }
  }

  const pHirelingTxt = DATATBLS_GetHirelingTxtRecord113c(
    m,
    signedU32(m, pGame + 0x70),
    nSellerClassId,
    m.u8(pGame + 0x6d),
    0,
  );
  if (pHirelingTxt === 0) {
    FOG_Assertion113c(m, 0xfa2, 0x6fd19ff9);
    return;
  }

  const nEndId = m.u16(pHirelingTxt + 0x116);
  const nStartId = m.u16(pHirelingTxt + 0x114);
  const dwType = signedU32(m, pHirelingTxt + 0x08);
  const nCount = (nEndId - nStartId + 1) | 0;

  if (nStartId <= nEndId) {
    let curId = nStartId;
    for (let idx = 0; idx < nCount && curId <= nEndId; idx++, curId++) {
      const pSlot = (pShop + idx * 16) >>> 0;
      if (signedU32(m, pSlot + 0x08) !== 1 && signedU32(m, pSlot + 0x0c) === 1) {
        const wHireId = m.u16(pSlot);
        m.setU32(pSlot + 0x08, 1);
        const pClient =
          pPlayer !== 0 && signedU32(m, pPlayer) === 0
            ? m.u32(UNITS_GetPlayerData113c(m, pPlayer) + 0x9c)
            : 0;
        const sp2 = k2W13B1StackPtr;
        k2W13B1StackPtr = (sp2 + 0x10) >>> 0;
        try {
          m.setU8(sp2 + 0, 0x50);
          m.setU16(sp2 + 1, 2);
          m.setU16(sp2 + 3, wHireId);
          NET_SendPacketBuffer15B_6FCAABF0_113c(m, sp2, pClient);
        } finally {
          k2W13B1StackPtr = sp2;
        }
        let pTarget = MONSTER_SpawnPartyMinionInRing113c(m, dwType, pPlayer, 1, pGame, 4, 0);
        if (pTarget === 0) {
          pTarget = MONSTER_SpawnPartyMinionInRing113c(m, dwType, pPlayer, 1, pGame, 6, 0);
        }
        if (pTarget === 0) {
          pTarget = MONSTER_SpawnPartyMinionInRing113c(m, dwType, pPlayer, 1, pGame, 0x0c, 0);
        }
        if (pTarget === 0) return;
        D2Game_6FC68FC0_113c(m, pGame, pPlayer, pTarget, 0xffff, pSlot, 0);
        break;
      }
    }
  }

  NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c(m, pGame, pNpcRecord, nSellerClassId);
}


/**
 * @dll D2Game.dll
 * @va 0x6FCE1510
 * @ordinalOrName D2Game_6FCE1510
 */
export function D2Game_6FCE1510_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  pNpc: number,
  wHireId: number,
): void {
  hitD2GameVa113c(0x6FCE1510)
  const sp = k2W13B1StackPtr
  k2W13B1StackPtr = (sp + 0x70) >>> 0
  try {
    const spUnk0 = sp
    const spStartId = (sp + 0x04) >>> 0
    const spEndId = (sp + 0x08) >>> 0
    const spNpcAddr = (sp + 0x0c) >>> 0
    const spPacket = (sp + 0x10) >>> 0
    const spStats = (sp + 0x20) >>> 0
    m.setU32(spNpcAddr, pNpc >>> 0)

    const nPlrLvl = STATLIST_GetUnitStat113c(m, pPlayer, 0x0c, 0)
    const nMercLvl = NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c(m, pGame, pNpc, nPlrLvl)
    UNITS_GetPlayerData113c(m, pPlayer)

    if (pNpc !== 0) {
      const npcClass = m.u32((pNpc + 0x04) >>> 0) | 0
      let bQuestFail = false
      if (npcClass === 0x203) {
        const pPlrData = UNITS_GetPlayerData113c(m, pPlayer)
        const pQuests = m.u32((pPlrData + m.u8((pGame + 0x6d) >>> 0) * 4 + 0x10) >>> 0)
        if (DRLGWARP_TestRoomTileBit113c(m, pQuests, 0x24, 0) === 0) {
          bQuestFail = true
        }
      }
      if (!bQuestFail && npcClass === 0x96 && nMercLvl < 8) {
        const pPlrData = UNITS_GetPlayerData113c(m, pPlayer)
        const pQuests = m.u32((pPlrData + m.u8((pGame + 0x6d) >>> 0) * 4 + 0x10) >>> 0)
        if (DRLGWARP_TestRoomTileBit113c(m, pQuests, 2, 0) === 0) {
          bQuestFail = true
        }
      }
      if (bQuestFail) {
        const pClient =
          pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0
            ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
            : 0
        const gold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0)
        m.setU8(spPacket, 0x2a)
        m.setU8((spPacket + 1) >>> 0, 0)
        m.setU8((spPacket + 2) >>> 0, 0x0b)
        m.setU32((spPacket + 3) >>> 0, 0)
        m.setU32((spPacket + 7) >>> 0, 0xffffffff)
        m.setU32((spPacket + 0x0b) >>> 0, gold >>> 0)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, spPacket, 0x0f)
        return
      }
    }

    const nSellerClassId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1
    const pNpcRecord = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, spNpcAddr, pGame, nSellerClassId)
    if (pNpcRecord === 0) {
      const pClient =
        pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
          : 0
      const gold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0)
      m.setU8(spPacket, 0x2a)
      m.setU8((spPacket + 1) >>> 0, 0)
      m.setU8((spPacket + 2) >>> 0, 0x09)
      m.setU32((spPacket + 3) >>> 0, 0)
      m.setU32((spPacket + 7) >>> 0, 0xffffffff)
      m.setU32((spPacket + 0x0b) >>> 0, gold >>> 0)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, spPacket, 0x0f)
      return
    }

    HIRELING_GetVendorNameIdRange_6FCDC7D0_113c(
      m,
      nSellerClassId,
      spStartId,
      spEndId,
      spUnk0,
      pGame,
    )

    const hireIdU16 = wHireId & 0xffff
    const startId = m.u32(spStartId) | 0
    const endId = m.u32(spEndId) | 0
    if (hireIdU16 < startId || hireIdU16 > endId) {
      const pClient =
        pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
          : 0
      const gold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0)
      m.setU8(spPacket, 0x2a)
      m.setU8((spPacket + 1) >>> 0, 0)
      m.setU8((spPacket + 2) >>> 0, 0x09)
      m.setU32((spPacket + 3) >>> 0, 0)
      m.setU32((spPacket + 7) >>> 0, 0xffffffff)
      m.setU32((spPacket + 0x0b) >>> 0, gold >>> 0)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, spPacket, 0x0f)
      return
    }

    const pSlot = (m.u32((pNpcRecord + 0x10) >>> 0) + ((hireIdU16 - startId) << 4)) >>> 0
    if (m.u16(pSlot) !== hireIdU16 || (m.u32((pSlot + 0x08) >>> 0) | 0) !== 0) {
      const pClient =
        pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
          : 0
      const gold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0)
      NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, 0x09, gold, pClient, -1, 0)
      return
    }

    const bExpansion = m.u32((pGame + 0x70) >>> 0) | 0
    const nActIdx = HIRELING_GetActIndex113c(m, bExpansion, 0, hireIdU16)
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    if (
      HIRELING_RollAndPopulateStatsEntry113c(
        m,
        bExpansion,
        pPlayer,
        m.u32((pSlot + 0x04) >>> 0),
        nActIdx,
        nDiff,
        spStats,
      ) === 0
    ) {
      return
    }

    const nCost = m.u32((spStats + 0x14) >>> 0) | 0
    if (NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(m, pPlayer, nCost) === 0) {
      const pClient =
        pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0
          ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
          : 0
      const gold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0)
      NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, 0x0c, gold, pClient, -1, 0)
      return
    }

    const nMonClass = m.u32(spUnk0) | 0
    let pMerc = MONSTER_SpawnPartyMinionInRing113c(m, nMonClass, pNpc, 1, pGame, 4, 0)
    if (pMerc === 0) {
      pMerc = MONSTER_SpawnPartyMinionInRing113c(m, nMonClass, pPlayer, 1, pGame, 4, 0)
      if (pMerc === 0) {
        const pClient =
          pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0
            ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
            : 0
        const gold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0)
        NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, 0x0f, gold, pClient, -1, 0)
        return
      }
    }

    m.setU32((pSlot + 0x08) >>> 0, 1)
    D2Game_6FC68FC0_113c(m, pGame, pPlayer, pMerc, 0xffff, pSlot, 0)
    const pInteract = MONSTER_GetInteractDataPtr_6FC21370_113c(m, pNpc)
    MONSTER_CountInteractingPlayers113c(m, pInteract)

    const pClient1 =
      pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
        : 0
    NPC_SendHirelingListPacketsToClient_6FCDD330_113c(m, pNpc, pGame, pClient1)

    const mercGuid = pMerc !== 0 ? m.u32((pMerc + 0x0c) >>> 0) : -1
    const pClient2 =
      pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0
        ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
        : 0
    const gold = STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0)
    NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, 0x2a, 5, gold, pClient2, mercGuid, 0)
    NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c(m, pGame, pNpcRecord, nSellerClassId)
  } finally {
    k2W13B1StackPtr = sp
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF0E0
 * @ordinalOrName D2Game_6FCEF0E0
 */
export function D2Game_6FCEF0E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEF0E0)
  if (nPacketLen !== 0x11) {
    return 3
  }
  const dwItemGuid = m.u32((pPacket + 1) >>> 0)
  const nX = m.u32((pPacket + 5) >>> 0) | 0
  const nY = m.u32((pPacket + 9) >>> 0) | 0
  const dwPage = m.u32((pPacket + 0x0d) >>> 0)

  const rc = C2S_ValidateCursorItem_6FCECF70_113c(m, pGame, dwItemGuid, pPlayer)
  if (rc !== 0) {
    return rc
  }

  if (pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0) {
    if (PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayer) === 0 && dwPage !== 0) {
      return 2
    }
    if (dwPage === 4) {
      const pRoom = UNITS_GetRoom113c(m, pPlayer)
      if (pRoom === 0 || DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) === 0) {
        return 3
      }
    } else if (dwPage === 3 || dwPage === 2 || dwPage === 0) {
      if (dwPage === 2 && PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayer, pGame) === 0) {
        return 3
      }
    } else {
      return 2
    }
  } else if ((dwPage >>> 0) >= 5) {
    return 2
  }

  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
  }
  let pItem = m.u32((pGame + 0x1720 + ((dwItemGuid & 0x7f) << 2)) >>> 0)
  while (pItem !== 0) {
    if (m.u32((pItem + 0x0c) >>> 0) === dwItemGuid) {
      ITEMS_SetInvPage113c(m, pItem, dwPage)
      const placed = D2Game_6FCF76A0_113c(
        m,
        0x6fd1b188,
        0xba3,
        pGame,
        pPlayer,
        dwItemGuid,
        nX,
        nY,
        0,
        1,
        0,
      )
      return placed !== 0 ? 0 : 3
    }
    pItem = m.u32((pItem + 0xe4) >>> 0)
  }
  return 2
}

/**
 * @dll D2Game.dll
 * @va 0x6FCEF810
 * @ordinalOrName D2Game_6FCEF810
 */
export function D2Game_6FCEF810_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
  nDestLevel: number,
  dwObjectId: number,
): void {
  hitD2GameVa113c(0x6FCEF810)
  const destAct = DRLG_GetActNoFromLevelId113c(m, nDestLevel) & 0xff
  const pRoom = UNITS_GetRoom113c(m, pPlayer)
  const nSrcLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const srcAct = DRLG_GetActNoFromLevelId113c(m, nSrcLevel) & 0xff

  if (nDestLevel === 0) {
    const nTownLevel = DUNGEON_GetActLevelId113c(m, srcAct)
    D2Game_6FCBE170_113c(m, pPlayer, nTownLevel, pGame, dwObjectId)
    return
  }
  if (destAct !== srcAct) {
    D2Game_6FCBE170_113c(m, pPlayer, nDestLevel, pGame, dwObjectId)
    return
  }

  const startX = (getUnitPosX(m, pPlayer) - 5) | 0
  const startY = getUnitPosY(m, pPlayer)
  if (pRoom === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xe42)
  }
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x18, pPlayer)
    return
  }

  const destAct2 = DRLG_GetActNoFromLevelId113c(m, nDestLevel) & 0xff
  const nSrcLevel2 = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const srcAct2 = DRLG_GetActNoFromLevelId113c(m, nSrcLevel2) & 0xff
  if (destAct2 !== srcAct2) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xe5c)
  }

  const sp = k2W13B1StackPtr
  k2W13B1StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU32(sp, startX >>> 0)
    m.setU32((sp + 4) >>> 0, startY >>> 0)
    if (COLLISION_FindFreePositionBasic113c(m, pRoom, sp, sp, 3, 0x3e01, 0x0c01, 0) === 0) {
      return
    }
    const outX = m.u32(sp) | 0
    const outY = m.u32((sp + 4) >>> 0) | 0
    const pPortalRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, outX, outY)
    if (pPortalRoom === 0) {
      return
    }
    const pPortal = UNIT_Alloc113c(m, 2)
    if (pPortal !== 0) {
      m.setU32(pPortal, 2)
      m.setU32((pPortal + 0x04) >>> 0, 0x3b)
      m.setU32((pPortal + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0))
      m.setU32((pPortal + 0x80) >>> 0, pGame >>> 0)
      let fC8 = m.u32((pPortal + 0xc8) >>> 0)
      fC8 =
        (m.u32((pGame + 0x70) >>> 0) | 0) !== 0
          ? (fC8 | 0x02000000) >>> 0
          : (fC8 & 0xfdffffff) >>> 0
      m.setU32((pPortal + 0xc8) >>> 0, (fC8 | 0x04000000) >>> 0)
      const actNo =
        DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pPortalRoom)) & 0xff
      m.setU8((pPortal + 0x18) >>> 0, actNo)
      m.setU32((pPortal + 0x1c) >>> 0, m.u32((pGame + actNo * 4 + 0xbc) >>> 0))
      m.setU32((pPortal + 0x74) >>> 0, 0)
      SUNIT_InitUnitSeed113c(m, pPortal, (pGame + 0xd0) >>> 0)
      m.setU32((pPortal + 0xc4) >>> 0, (m.u32((pPortal + 0xc4) >>> 0) | 0x10) >>> 0)
      m.setU32((pPortal + 0xd0) >>> 0, 0x0b)
      let nextGuid = ((m.u32((pGame + 0x98) >>> 0) | 0) + 1) | 0
      if (nextGuid === -1) {
        nextGuid = 1
      }
      m.setU32((pGame + 0x98) >>> 0, nextGuid >>> 0)
      const pObjData = m.alloc(0x38)
      for (let i = 0; i < 0x38; i += 4) {
        m.setU32((pObjData + i) >>> 0, 0)
      }
      m.setU32((pPortal + 0x14) >>> 0, pObjData >>> 0)
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, 0x3b)
      m.setU32(m.u32((pPortal + 0x14) >>> 0), pObjTxt >>> 0)
      m.setU32((pPortal + 0x10) >>> 0, 1)
      UNITS_AllocStaticPath113c(m, pPortal)
      OBJECTS_InitObjectUnit113c(m, pPortal, pGame, nextGuid >>> 0, pPortalRoom, outX, outY)
      SUNIT_PlaceServerUnitInRoom113c(m, pPortalRoom, outY, pPortal, outX, pGame, 1)
    }
    UNITS_ChangeAnimMode113c(m, pPortal, 1)
    const pDestPortal = PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
      m,
      pGame,
      pPortal,
      nDestLevel,
      nSrcLevel2,
    )
    if (pDestPortal !== 0) {
      const pf = (UNITS_GetObjectPortalFlags113c(m, pDestPortal) | 3) & 0xff
      UNITS_SetObjectPortalFlags113c(m, pDestPortal, pf)
      DUNGEON_ToggleHasPortalFlag113c(m, pPortalRoom, 0)
      DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pDestPortal), 0)
    }
  } finally {
    k2W13B1StackPtr = sp
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF08B0
 * @ordinalOrName D2Game_6FCF08B0
 */
export function D2Game_6FCF08B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCF08B0)
  if (nPacketLen !== 0x0d) {
    return 3
  }
  const nType = m.u32((pPacket + 1) >>> 0)
  const dwGuid = m.u32((pPacket + 5) >>> 0)
  const dwArg = m.u32((pPacket + 9) >>> 0)
  if ((nType >>> 0) >= 6) {
    return 2
  }
  const plrGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) : 0xffffffff
  if (plrGuid === dwGuid && nType === 0) {
    return 3
  }
  return D2Game_6FCF01D0_113c(m, nType, pGame, dwArg, pPlayer, dwGuid)
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF0910
 * @ordinalOrName D2Game_6FCF0910
 */
export function D2Game_6FCF0910_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCF0910)
  if (nPacketLen !== 9) {
    return 3
  }
  const nType = m.u32((pPacket + 1) >>> 0)
  const dwGuid = m.u32((pPacket + 5) >>> 0)
  if ((nType >>> 0) >= 6) {
    return 2
  }
  return D2Game_6FCF01D0_113c(m, nType, pGame, 0, pPlayer, dwGuid)
}
/**
 * @dll D2Game.dll
 * @va 0x6FCF12E0
 * @ordinalOrName sub_6FCF12E0
 */
export function D2Game_6FCF12E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCF12E0)
  if (nPacketLen !== 3) {
    return 3;
  }
  const wBodyLoc = m.u16((pPacket + 1) >>> 0);
  if ((wBodyLoc | 0) <= 0 || (wBodyLoc | 0) >= 0x0b) {
    return 2;
  }
  const pItem = INVENTORY_GetItemFromBodyLocMemPort113c(
    m,
    m.u32((pPlayer + 0x60) >>> 0),
    wBodyLoc,
  );
  if (
    PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(
      m,
      pPlayer,
      pGame,
      pItem,
    ) === 0
  ) {
    return 0;
  }
  if (
    wBodyLoc === 8 &&
    PLRTRADE_CanModifyBeltDuringTrade113c(m, pPlayer) === 0
  ) {
    return 0;
  }
  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (k2W13B1StackPtr + 0x10) >>> 0;
  try {
    m.setU32(sp, 0);
    const rc = D2Game_6FCF8970_113c(m, pGame, pPlayer, wBodyLoc, 0, sp);
    if (rc === 0 && m.u32(sp) !== 0) {
      return 3;
    }
    return 0;
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF7300
 * @ordinalOrName sub_6FCF7300
 */
export function D2Game_6FCF7300_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  dwCursorItemGuid: number,
  dwTargetItemGuid: number,
  nX: number,
  nY: number,
  pOutSwapped: number,
  pOutFailed: number = pOutSwapped,
): number {
  hitD2GameVa113c(0x6FCF7300)
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xec1);
  }
  if (pUnit === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xec2);
  }
  if (pOutSwapped !== 0) {
    m.setU32(pOutSwapped, 0);
  }
  if (pOutFailed !== 0 && pOutFailed !== pOutSwapped) {
    m.setU32(pOutFailed, 0);
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pUnit);

  let pCursorItem = m.u32((pGame + 0x1720 + ((dwCursorItemGuid & 0x7f) << 2)) >>> 0);
  while (pCursorItem !== 0 && m.u32((pCursorItem + 0x0c) >>> 0) !== (dwCursorItemGuid >>> 0)) {
    pCursorItem = m.u32((pCursorItem + 0xe4) >>> 0);
  }
  if (
    pCursorItem === 0 ||
    m.u32(pCursorItem) !== 4 ||
    m.u32((pCursorItem + 0x10) >>> 0) !== 4
  ) {
    return 0;
  }

  let pTargetItem = m.u32((pGame + 0x1720 + ((dwTargetItemGuid & 0x7f) << 2)) >>> 0);
  while (pTargetItem !== 0 && m.u32((pTargetItem + 0x0c) >>> 0) !== (dwTargetItemGuid >>> 0)) {
    pTargetItem = m.u32((pTargetItem + 0xe4) >>> 0);
  }
  if (pTargetItem === 0 || m.u32(pTargetItem) !== 4) {
    return 0;
  }

  const nInvPage = ITEMS_GetInvPage113c(m, pTargetItem) & 0xff;
  if (nInvPage === 3) {
    if (m.u8(0x6fd31f78) === 0) {
      if (DATATBLS_GetItemsTxtRecordByCode113c(m, 0x20786f62, 0x6fd31f74) === 0) {
        return 0;
      }
      m.setU8(0x6fd31f78, 1);
    }
    if (m.u32((pCursorItem + 0x04) >>> 0) === m.u32(0x6fd31f74)) {
      return 0;
    }
  } else if (nInvPage === 2) {
    m.setU32(pOutFailed, 1);
    return 0;
  }

  if (m.u32((pTargetItem + 0x10) >>> 0) !== 0) {
    return 0;
  }

  const pInv = m.u32((pUnit + 0x60) >>> 0);
  const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInv, pTargetItem);
  if (pRemoved === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xf13);
  }
  if (pRemoved !== pTargetItem) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xf14);
  }

  ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pTargetItem, pGame, 0, 1);
  const nGridPage1 = UNITS_GetInventoryRecordId113c(
    m,
    pUnit,
    nInvPage,
    m.u32((pGame + 0x70) >>> 0),
  );
  const targetY = getUnitPosY(m, pTargetItem);
  const targetX = getUnitPosX(m, pTargetItem);
  INVENTORY_NoOpRet20113c(
    m,
    0x6fd1b14c,
    0xf16,
    pInv,
    targetX,
    targetY,
    nGridPage1,
    0,
    nInvPage,
  );
  ITEMS_SetInvPage113c(m, pTargetItem, 0xff);
  INVENTORY_SetCursorItem113c(m, pInv, pTargetItem);
  ITEMS_OnUnequipScrollOrTome113c(m, pTargetItem, pUnit);
  ITEMS_SetCmdFlagsByte113c(m, pTargetItem, nInvPage);
  m.setU32((pTargetItem + 0xc4) >>> 0, (m.u32((pTargetItem + 0xc4) >>> 0) & ~2) >>> 0);
  UNITS_ChangeAnimMode113c(m, pTargetItem, 4);
  ITEMS_SetItemFlag113c(m, pTargetItem, 0x40000, 1);
  if (ITEMS_HasSocketedSubItems113c(m, pTargetItem) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pTargetItem, 1, 1);
  }
  if (ITEMS_CheckCommandFlags113c(m, pTargetItem, 0x4000) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pTargetItem, 0x4000, 0);
  }
  INVENTORY_AppendItemGuidNode113c(m, pInv, pTargetItem);

  const nGridPage2 = UNITS_GetInventoryRecordId113c(
    m,
    pUnit,
    nInvPage,
    m.u32((pGame + 0x70) >>> 0),
  );
  if (
    INVENTORY_PlaceItemInGridCell113c(
      m,
      pInv,
      pCursorItem,
      nX,
      nY,
      nGridPage2,
      0,
      nInvPage,
    ) === 0
  ) {
    m.setU32(pOutFailed, 1);
    return 0;
  }

  ITEMS_SetCmdFlagsByte113c(m, pCursorItem, 0);
  ITEMS_SetInvPage113c(m, pCursorItem, nInvPage);
  UNITS_SetStaticPathPosX113c(m, pCursorItem, nX);
  UNITS_SetStaticPathPosY113c(m, pCursorItem, nY);
  if (INVENTORY_PlaceItemInSocket113c(m, pInv, pCursorItem, 1) === 0) {
    m.setU32(pOutFailed, 1);
    return 0;
  }

  m.setU32((pCursorItem + 0xc4) >>> 0, (m.u32((pCursorItem + 0xc4) >>> 0) & ~2) >>> 0);
  ITEMS_OnEquipScrollOrTome113c(m, pCursorItem, pUnit);
  if (ITEMS_CanUseCharmInInventory113c(m, pCursorItem, pUnit) !== 0) {
    ITEMS_ActivateEquippedItemStats113c(m, pUnit, pCursorItem, 0);
  }
  UNITS_ChangeAnimMode113c(m, pCursorItem, 0);
  if (ITEMS_HasSocketedSubItems113c(m, pCursorItem) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pCursorItem, 1, 1);
  }
  if (ITEMS_CheckCommandFlags113c(m, pCursorItem, 0x4000) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pCursorItem, 0x4000, 0);
  }
  ITEMS_SetItemFlag113c(m, pCursorItem, 0x40000, 1);
  INVENTORY_AppendItemGuidNode113c(m, pInv, pCursorItem);
  if (nInvPage === 2) {
    D2Game_6FC91B00_113c(m, pCursorItem, pGame, pUnit);
  }
  UNITS_SetUnitUpdateFlags113c(m, pUnit, 1);
  if (ITEMS_CanUseCharmInInventory113c(m, pTargetItem, pUnit) !== 0) {
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 0);
    UNITS_SetUnitUpdateFlags113c(m, pUnit, 1);
  }
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF78C0
 * @ordinalOrName sub_6FCF78C0
 */
export function D2Game_6FCF78C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pCubeItem: number,
): void {
  hitD2GameVa113c(0x6FCF78C0)
  const nItemClass = pCubeItem !== 0 ? m.u32((pCubeItem + 0x04) >>> 0) | 0 : -1;
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemClass);
  if (pItemsTxt === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x800);
  }
  if (m.u32((pItemsTxt + 0x80) >>> 0) !== 0x20786f62) {
    return;
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (k2W13B1StackPtr + 0x40) >>> 0;
  try {
    const pInv = m.u32((pPlayer + 0x60) >>> 0);
    let pNode = INVENTORY_GetFirstItem113c(m, pInv);
    while (pNode !== 0) {
      const pItem = INVENTORY_UnitIsItem113c(m, pNode);
      const pNext = INVENTORY_GetNextItem113c(m, pNode);
      if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) === 3) {
        m.setU32(sp, 0);
        ITEMS_SetOrClearFlagMask113c(m, sp, 0x20, 1);
        ITEMS_SetNodePage113c(m, pCubeItem, 3);
        const pClient =
          (m.u32(pPlayer) | 0) === 0
            ? m.u32((UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) >>> 0)
            : 0;
        NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(
          m,
          pItem,
          pPlayer,
          pClient,
          m.u32(sp),
        );
        const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInv, pItem);
        if (pRemoved === 0) {
          throw new D2CommonAssertError('0x6fd19ff9', 0x810);
        }
        if (pRemoved !== pItem) {
          throw new D2CommonAssertError('0x6fd19ff9', 0x811);
        }
        const oldPage = ITEMS_GetInvPage113c(m, pItem) & 0xff;
        const nGridPage = UNITS_GetInventoryRecordId113c(
          m,
          pPlayer,
          oldPage,
          m.u32((pGame + 0x70) >>> 0),
        );
        const itemY = getUnitPosY(m, pItem);
        const itemX = getUnitPosX(m, pItem);
        INVENTORY_NoOpRet20113c(
          m,
          0x6fd1b14c,
          0x814,
          pInv,
          itemX,
          itemY,
          nGridPage,
          0,
          oldPage,
        );
        UNITS_ChangeAnimMode113c(m, pRemoved, 4);
        ITEMS_SetInvPage113c(m, pItem, 0);

        const itemGuid = m.u32((pItem + 0x0c) >>> 0);
        ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer);
        let pFound = m.u32((pGame + 0x1720 + ((itemGuid & 0x7f) << 2)) >>> 0);
        while (pFound !== 0 && m.u32((pFound + 0x0c) >>> 0) !== itemGuid) {
          pFound = m.u32((pFound + 0xe4) >>> 0);
        }

        let bPlaced = false;
        if (
          pFound !== 0 &&
          m.u32(pFound) === 4 &&
          m.u32((pFound + 0x10) >>> 0) === 4 &&
          m.u32((pPlayer + 0x60) >>> 0) !== 0
        ) {
          const foundPage = ITEMS_GetInvPage113c(m, pFound) & 0xff;
          let bClearCursor = 1;
          let bNotifyTrade = 0;
          const foundGrid = UNITS_GetInventoryRecordId113c(
            m,
            pPlayer,
            foundPage,
            m.u32((pGame + 0x70) >>> 0),
          );
          if ((m.u32(pPlayer) | 0) === 0) {
            if (foundPage === 1) {
              bClearCursor = 0;
            } else if (foundPage === 2) {
              bNotifyTrade = 1;
            }
          }
          if (
            INVENTORY_AutoPlaceItemInGrid113c(
              m,
              m.u32((pPlayer + 0x60) >>> 0),
              pFound,
              foundGrid,
              0,
              foundPage,
              0x6fd1b14c,
              0x818,
            ) !== 0 &&
            INVENTORY_PlaceItemInSocket113c(m, m.u32((pPlayer + 0x60) >>> 0), pFound, 1) !== 0
          ) {
            if ((ITEMS_GetInvPage113c(m, pFound) & 0xff) !== 4) {
              ITEMS_OnEquipScrollOrTome113c(m, pFound, pPlayer);
            }
            m.setU32((pFound + 0xc4) >>> 0, (m.u32((pFound + 0xc4) >>> 0) & ~2) >>> 0);
            if (ITEMS_CanUseCharmInInventory113c(m, pFound, pPlayer) !== 0) {
              ITEMS_ActivateEquippedItemStats113c(m, pPlayer, pFound, 0);
            }
            if (bClearCursor !== 0) {
              INVENTORY_SetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0), 0);
            }
            UNITS_ChangeAnimMode113c(m, pFound, 0);
            ITEMS_SetItemFlag113c(m, pFound, 2, 1);
            if (ITEMS_HasSocketedSubItems113c(m, pFound) !== 0) {
              ITEMS_SetOrClearCommandFlags113c(m, pFound, 1, 1);
            }
            if (ITEMS_CheckCommandFlags113c(m, pFound, 0x4000) !== 0) {
              ITEMS_SetOrClearCommandFlags113c(m, pFound, 0x4000, 0);
            }
            UNITS_SetUnitUpdateFlags113c(m, pPlayer, 1);
            INVENTORY_AppendItemGuidNode113c(m, m.u32((pPlayer + 0x60) >>> 0), pFound);
            if (bNotifyTrade === 1) {
              D2Game_6FC91B00_113c(m, pFound, pGame, pPlayer);
            }
            if (ITEMS_CanUseCharmInInventory113c(m, pFound, pPlayer) !== 0) {
              D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlayer, 0);
              UNITS_SetUnitUpdateFlags113c(m, pPlayer, 1);
            }
            bPlaced = true;
          }
        }
        if (!bPlaced) {
          ITEMS_SetInvPage113c(m, pItem, 0xff);
          PATH_GetTargetTypeAndPosition113c(m, pPlayer, (sp + 0x10) >>> 0);
          const pRoom = UNITS_GetRoom113c(m, pPlayer);
          const pDropRoom = findItemDropPosition6FC2E930(
            m,
            pPlayer,
            pRoom,
            (sp + 0x10) >>> 0,
            (sp + 0x08) >>> 0,
            1,
          );
          if (pDropRoom !== 0) {
            ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
              m,
              m.u32((sp + 0x0c) >>> 0),
              pItem,
              pDropRoom,
              pGame,
              pPlayer,
              m.u32((sp + 0x08) >>> 0),
            );
          }
        }
      }
      pNode = pNext;
    }
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF7CC0
 * @ordinalOrName sub_6FCF7CC0
 */
export function D2Game_6FCF7CC0_113c(
  m: D2KernMemory113c,
  dwCubeItemGuid: number,
  pPlayer: number,
  pGame: number,
  dwCursorItemGuid: number,
  pOutFailed: number,
): number {
  hitD2GameVa113c(0x6FCF7CC0)
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x14a8);
  }
  if (pPlayer === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x14a9);
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer);
  m.setU32(pOutFailed, 0);

  let pCubeItem = m.u32((pGame + 0x1720 + ((dwCubeItemGuid & 0x7f) << 2)) >>> 0);
  while (pCubeItem !== 0 && m.u32((pCubeItem + 0x0c) >>> 0) !== (dwCubeItemGuid >>> 0)) {
    pCubeItem = m.u32((pCubeItem + 0xe4) >>> 0);
  }
  if (pCubeItem === 0 || m.u32((pCubeItem + 0x10) >>> 0) !== 0) {
    m.setU32(pOutFailed, 1);
    return 0;
  }
  if (ITEMS_GetBaseCode113c(m, pCubeItem) !== 0x20786f62) {
    m.setU32(pOutFailed, 1);
    return 0;
  }
  if (
    PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayer, pGame) !== 0 &&
    (ITEMS_GetInvPage113c(m, pCubeItem) & 0xff) !== 0
  ) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer);
    return 0;
  }

  let pCursorItem = m.u32((pGame + 0x1720 + ((dwCursorItemGuid & 0x7f) << 2)) >>> 0);
  while (pCursorItem !== 0 && m.u32((pCursorItem + 0x0c) >>> 0) !== (dwCursorItemGuid >>> 0)) {
    pCursorItem = m.u32((pCursorItem + 0xe4) >>> 0);
  }
  if (pCursorItem === 0) {
    m.setU32(pOutFailed, 1);
    return 0;
  }
  if (m.u32(pCursorItem) !== 4) {
    return 0;
  }
  const cursorMode = m.u32((pCursorItem + 0x10) >>> 0);
  if (cursorMode !== 3 && cursorMode !== 4) {
    m.setU32(pOutFailed, 1);
    return 0;
  }
  if (m.u32(pCubeItem) !== 4) {
    return 0;
  }
  if (m.u32((pCubeItem + 0x10) >>> 0) !== 0) {
    m.setU32(pOutFailed, 1);
    return 0;
  }
  ITEMS_SetInvPage113c(m, pCursorItem, 3);
  D2Game_6FCF76A0_113c(
    m,
    0x6fd1b14c,
    0x14ed,
    pGame,
    pPlayer,
    m.u32((pCursorItem + 0x0c) >>> 0),
    0,
    0,
    1,
    1,
    0,
  );
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF8020
 * @ordinalOrName sub_6FCF8020
 */
export function D2Game_6FCF8020_113c(
  m: D2KernMemory113c,
  dwItemGuid: number,
  pPlayer: number,
  pGame: number,
  nBodyLoc: number,
  bForce: number,
  pOutFailed: number,
): number {
  hitD2GameVa113c(0x6FCF8020)
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xb7c);
  }
  if (pPlayer === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xb7d);
  }
  m.setU32(pOutFailed, 0);
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer);

  let pItem = m.u32((pGame + 0x1720 + ((dwItemGuid & 0x7f) << 2)) >>> 0);
  while (pItem !== 0 && m.u32((pItem + 0x0c) >>> 0) !== (dwItemGuid >>> 0)) {
    pItem = m.u32((pItem + 0xe4) >>> 0);
  }
  if (pItem === 0) {
    m.setU32(pOutFailed, 1);
    return 0;
  }
  if (m.u32(pItem) !== 4) {
    return 0;
  }
  if (m.u32((pItem + 0x10) >>> 0) !== 4) {
    m.setU32(pOutFailed, 1);
    return 0;
  }

  const bodyLocByte = nBodyLoc & 0xff;
  let otherBodyLoc = 0;
  if (bodyLocByte === 5) {
    otherBodyLoc = 4;
  } else if (bodyLocByte === 4) {
    otherBodyLoc = 5;
  } else {
    m.setU32(pOutFailed, 1);
    return 0;
  }

  const pInv = m.u32((pPlayer + 0x60) >>> 0);
  const pOtherItemInit = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, otherBodyLoc);
  if (pOtherItemInit === 0) {
    m.setU32(pOutFailed, 1);
    return 0;
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (k2W13B1StackPtr + 0x10) >>> 0;
  try {
    m.setU32(sp, pOtherItemInit);
    m.setU32((sp + 4) >>> 0, otherBodyLoc);
    INVENTORY_GetSwapWeaponItem113c(m, pPlayer, pInv, sp, otherBodyLoc);
    const pTargetItem = m.u32(sp);
    if (pTargetItem === 0) {
      m.setU32(pOutFailed, 1);
      return 0;
    }
    if (
      INVENTORY_CanAutoEquipItem113c(m, pPlayer, bodyLocByte, pItem, bForce) !== 2
    ) {
      m.setU32(pOutFailed, 1);
      return 0;
    }

    ITEMS_DeactivateEquippedItemStats113c(m, pPlayer, pTargetItem, pGame, 0, 1);
    if (bForce === 0) {
      if (ITEMS_CheckRequirements113c(m, pItem, pPlayer, 0, 0, 0, 0) === 0) {
        ITEMS_ActivateEquippedItemStats113c(m, pPlayer, pTargetItem, 0);
        SUNIT_SetUnitEventSound113c(m, pPlayer, 0x14, 0);
        return 0;
      }
    }

    const pSwapItem = INVENTORY_GetCompositWeaponMemPort113c(m, pInv);
    if (pSwapItem !== 0) {
      UNITS_SetInteractItem113c(m, pPlayer, pSwapItem);
    }
    ITEMS_NoOpReturnZero113c(m, pPlayer, pTargetItem);
    INVENTORY_UpdateWeaponGuidOnRemoval113c(m, pInv, pTargetItem);

    const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInv, pTargetItem);
    if (pRemoved === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0xbc9);
    }
    if (pTargetItem !== pRemoved) {
      throw new D2CommonAssertError('0x6fd19ff9', 0xbca);
    }

    const resolvedLoc = m.u32((sp + 4) >>> 0);
    INVENTORY_NoOpRet8B113c(m, pInv, resolvedLoc);
    if (ITEMS_GetItemTypeFromItem113c(m, pRemoved) === 0x13) {
      D2Game_6FCF7E30_113c(m, 0, pPlayer, pGame);
    }
    INVENTORY_SetCursorItem113c(m, pInv, pTargetItem);
    if (pTargetItem !== 0) {
      m.setU32((pTargetItem + 0xc4) >>> 0, (m.u32((pTargetItem + 0xc4) >>> 0) & ~2) >>> 0);
    }
    UNITS_ChangeAnimMode113c(m, pTargetItem, 4);

    if (INVENTORY_PlaceItemInBodyLoc113c(m, pInv, pItem, bodyLocByte) !== 0) {
      if (INVENTORY_PlaceItemInSocket113c(m, pInv, pItem, 3) === 0) {
        m.setU32(pOutFailed, 1);
        return 0;
      }
      ITEMS_SetBodyLocation113c(m, pItem, bodyLocByte);
      INVENTORY_UpdateWeaponGuidOnInsert113c(m, pInv, pItem);
      ITEMS_ActivateEquippedItemStats113c(m, pPlayer, pItem, 0);
      m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0);
      UNITS_ChangeAnimMode113c(m, pItem, 1);
      ITEMS_SetInvPage113c(m, pItem, 0xff);
      ITEMS_SetItemFlag113c(m, pItem, 0x10000, 1);
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1);
      if (ITEMS_CheckCommandFlags113c(m, pItem, 0x4000) !== 0) {
        ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x4000, 0);
      }
      INVENTORY_AppendItemGuidNode113c(m, pInv, pItem);
      ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, pPlayer);
      D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlayer, 0);
    }
    UNITS_SetUnitUpdateFlags113c(m, pPlayer, 1);
    return 1;
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCF8600
 * @ordinalOrName sub_6FCF8600
 */
export function D2Game_6FCF8600_113c(
  m: D2KernMemory113c,
  dwItemGuid: number,
  pPlayer: number,
  pGame: number,
  nBodyLoc: number,
  bForce: number,
  pOutFailed: number,
): number {
  hitD2GameVa113c(0x6FCF8600)
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xca8);
  }
  if (pPlayer === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xca9);
  }
  const bodyLocByte = nBodyLoc & 0xff;
  if (bodyLocByte >= 0x0b) {
    return 0;
  }

  m.setU32(pOutFailed, 0);
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer);

  let pItem = m.u32((pGame + 0x1720 + ((dwItemGuid & 0x7f) << 2)) >>> 0);
  while (pItem !== 0 && m.u32((pItem + 0x0c) >>> 0) !== (dwItemGuid >>> 0)) {
    pItem = m.u32((pItem + 0xe4) >>> 0);
  }
  if (pItem === 0) {
    m.setU32(pOutFailed, 0);
    return 0;
  }
  if (m.u32(pItem) !== 4) {
    return 0;
  }
  if (m.u32((pItem + 0x10) >>> 0) !== 4) {
    m.setU32(pOutFailed, 0);
    return 0;
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (k2W13B1StackPtr + 0x10) >>> 0;
  try {
    if (
      INVENTORY_CanAutoEquipItem113c(m, pPlayer, bodyLocByte, pItem, bForce) !== 5
    ) {
      m.setU32(pOutFailed, 0);
      return 0;
    }

    const pInv = m.u32((pPlayer + 0x60) >>> 0);
    const pSwapItem = INVENTORY_GetCompositWeaponMemPort113c(m, pInv);
    if (pSwapItem !== 0) {
      UNITS_SetInteractItem113c(m, pPlayer, pSwapItem);
    }

    const pBodyItemInit = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, bodyLocByte);
    m.setU32(sp, pBodyItemInit);
    m.setU32((sp + 4) >>> 0, bodyLocByte);
    INVENTORY_GetSwapWeaponItem113c(m, pPlayer, pInv, sp, bodyLocByte);
    const pTargetItem = m.u32(sp);
    if (pTargetItem === 0 || m.u32((pTargetItem + 0x10) >>> 0) !== 1) {
      m.setU32(pOutFailed, 1);
      return 0;
    }

    ITEMS_DeactivateEquippedItemStats113c(m, pPlayer, pTargetItem, pGame, 0, 1);
    if (bForce === 0) {
      if (ITEMS_CheckRequirements113c(m, pItem, pPlayer, 0, 0, 0, 0) === 0) {
        ITEMS_ActivateEquippedItemStats113c(m, pPlayer, pTargetItem, 0);
        SUNIT_SetUnitEventSound113c(m, pPlayer, 0x14, 0);
        return 0;
      }
    }

    if (ITEMS_GetItemTypeFromItem113c(m, pItem) === 0x13) {
      D2Game_6FCF7E30_113c(m, pItem, pPlayer, pGame);
    }
    ITEMS_NoOpReturnZero113c(m, pPlayer, pTargetItem);
    INVENTORY_UpdateWeaponGuidOnRemoval113c(m, pInv, pTargetItem);

    const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInv, pTargetItem);
    if (pRemoved === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0xcef);
    }
    if (pTargetItem !== pRemoved) {
      throw new D2CommonAssertError('0x6fd19ff9', 0xcf0);
    }

    const resolvedLoc = m.u32((sp + 4) >>> 0);
    INVENTORY_NoOpRet8B113c(m, pInv, resolvedLoc);
    INVENTORY_SetCursorItem113c(m, pInv, pTargetItem);
    if (pTargetItem !== 0) {
      m.setU32((pTargetItem + 0xc4) >>> 0, (m.u32((pTargetItem + 0xc4) >>> 0) & ~2) >>> 0);
    }
    UNITS_ChangeAnimMode113c(m, pTargetItem, 4);
    ITEMS_SetOrClearCommandFlags113c(m, pTargetItem, 0x80, 1);
    ITEMS_SetItemFlag113c(m, pTargetItem, 0x20, 1);
    ITEMS_SetOrClearCommandFlags113c(m, pTargetItem, 1, 1);
    if (ITEMS_CheckCommandFlags113c(m, pTargetItem, 0x4000) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pTargetItem, 0x4000, 0);
    }
    INVENTORY_AppendItemGuidNode113c(m, pInv, pTargetItem);

    if (INVENTORY_PlaceItemInBodyLoc113c(m, pInv, pItem, resolvedLoc) === 0) {
      m.setU32(pOutFailed, 1);
      return 0;
    }
    if (INVENTORY_PlaceItemInSocket113c(m, pInv, pItem, 3) === 0) {
      m.setU32(pOutFailed, 1);
      return 0;
    }
    ITEMS_SetBodyLocation113c(m, pItem, bodyLocByte);
    INVENTORY_UpdateWeaponGuidOnInsert113c(m, pInv, pItem);
    ITEMS_ActivateEquippedItemStats113c(m, pPlayer, pItem, 0);
    m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & ~2) >>> 0);
    UNITS_ChangeAnimMode113c(m, pItem, 1);
    ITEMS_SetInvPage113c(m, pItem, 0xff);
    ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x40, 1);
    ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1);
    ITEMS_SetItemFlag113c(m, pItem, 0x20, 1);
    ITEMS_SetOrClearCommandFlags113c(m, pItem, 1, 1);
    if (ITEMS_CheckCommandFlags113c(m, pItem, 0x4000) !== 0) {
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x4000, 0);
    }
    INVENTORY_AppendItemGuidNode113c(m, pInv, pItem);
    ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, pPlayer);
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlayer, 0);
    return 1;
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD08EB0
 * @ordinalOrName sub_6FD08EB0
 */
export function D2Game_6FD08EB0_113c(
  m: D2KernMemory113c,
  pObjInteractArg: number,
): void {
  hitD2GameVa113c(0x6FD08EB0)
  const pGame = m.u32(pObjInteractArg);
  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0);
  let pQuest = pQuestChain !== 0 ? m.u32(pQuestChain) : 0;
  while (pQuest !== 0 && m.u32(pQuest) !== 0x11) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0);
  }
  if (pQuest === 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInteractArg + 0x04) >>> 0), 2);
    return;
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInteractArg + 0x04) >>> 0), 2);
    return;
  }
  const pQData = m.u32((pQuest + 0x18) >>> 0);
  m.setU8((pQData + 0x18) >>> 0, 1);
  m.setU32((pQData + 0x08) >>> 0, m.u32((pObjInteractArg + 0x14) >>> 0));
  m.setU32((pQData + 0x0c) >>> 0, m.u32((pObjInteractArg + 0x18) >>> 0));
  if (m.u8((pQData + 0x03) >>> 0) !== 0 && m.u8((pQData + 0x02) >>> 0) === 0) {
    D2Game_6FD08780_113c(
      m,
      pQData,
      m.u32((pObjInteractArg + 0x08) >>> 0),
      m.u32(pObjInteractArg),
    );
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD08F30
 * @ordinalOrName sub_6FD08F30
 */
export function D2Game_6FD08F30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuest: number,
): number {
  hitD2GameVa113c(0x6FD08F30)
  const pQData = m.u32((pQuest + 0x18) >>> 0);
  const bFlag18 = m.u8((pQData + 0x18) >>> 0) === 1;
  m.setU8((pQData + 0x05) >>> 0, 0);
  if (
    !bFlag18 ||
    m.u8((pQData + 0x03) >>> 0) === 0 ||
    m.u8((pQData + 0x02) >>> 0) !== 0
  ) {
    return 1;
  }
  const pAct2 = m.u32((pGame + 0xc4) >>> 0);
  if (pAct2 === 0) {
    return 1;
  }
  const pRoom = DUNGEON_FindRoomBySubtileCoordinates113c(
    m,
    pAct2,
    m.u32((pQData + 0x08) >>> 0),
    m.u32((pQData + 0x0c) >>> 0),
  );
  if (pRoom === 0) {
    return 1;
  }

  const sp = k2W13B1StackPtr;
  k2W13B1StackPtr = (k2W13B1StackPtr + 0x10) >>> 0;
  try {
    m.setU32(sp, 0);
    m.setU32((sp + 4) >>> 0, 0);
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, (sp + 4) >>> 0, sp);
    const nRooms = m.u32(sp);
    const ppRooms = m.u32((sp + 4) >>> 0);
    for (let i = 0; i < nRooms; i = (i + 1) >>> 0) {
      const pAdjRoom = m.u32((ppRooms + (i << 2)) >>> 0);
      let pUnit = m.u32((pAdjRoom + 0x74) >>> 0);
      while (pUnit !== 0) {
        if (m.u32(pUnit) === 0) {
          D2Game_6FD08780_113c(m, pQData, pRoom, pGame);
          m.setU32((pQuest + 0xc0) >>> 0, 0x6fd08140);
          return 1;
        }
        pUnit = m.u32((pUnit + 0xe8) >>> 0);
      }
    }
    return 1;
  } finally {
    k2W13B1StackPtr = sp;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FD095E0
 * @ordinalOrName sub_6FD095E0
 */
export function D2Game_6FD095E0_113c(
  m: D2KernMemory113c,
  pObjInteractArg: number,
): number {
  hitD2GameVa113c(0x6FD095E0)
  const pObject = m.u32((pObjInteractArg + 0x04) >>> 0);
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) === 2) {
    D2Game_6FCE8950_113c(m, pObjInteractArg);
  }
  return 0;
}
