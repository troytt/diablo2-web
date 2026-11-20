/**
 * D2Game.dll 1.13c — [K2] Wave 12 Batch 1 (w12b1).
 *
 * Clean-room 1:1 binary-isomorphic port of 34 D2Game.dll v1.13c functions in
 * the 0x6FC2DBD0..0x6FD08780 address range.
 */

import {
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_CheckSubtileMask113c,
  COLLISION_FindFreeCoordsNear113c,
  COLLISION_FindFreePositionBasic113c,
  COLLISION_FindFreePositionSimple113c,
  COLLISION_FindFreePositionWithStep113c,
  COLLISION_ResetMaskWithPattern113c,
  COLLISION_SetUnitCollisionMaskWithPattern113c,
} from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { DRLG_ResolveMonsterSubClassIdForRoom113c } from '../common/drlg/drlg-ver'
import { PATH_WarpUnitToRoomAndCoord113c } from '../common/drlg/maze'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_FindFreeSpawnPositionInLevel113c,
  DUNGEON_FindWarpPortalUnitInTargetLevel113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordListFromSubtile113c,
  DUNGEON_GetRoomCoordListIndexAtSubtile113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { C2S_RunToTargetAndSetQueuedSkill113c } from './c2s-packet-113c'
import { imul32, mulDiv113c, sdiv32 } from '../common/int-math'
import {
  DATATBLS_GetInventoryTxtRecord113c,
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_AutoPlaceItemInGrid113c,
  INVENTORY_CanAutoEquipItem113c,
  INVENTORY_GetBeltItem113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemCount113c,
  INVENTORY_GetItemGridXIfInInventory113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_GetSwapWeaponItem113c,
  INVENTORY_NoOpRet8A113c,
  INVENTORY_NoOpRet8B113c,
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_PlaceItemInGridCell113c,
  INVENTORY_PlaceItemInSocket113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UpdateWeaponGuidOnRemoval113c,
  ITEMS_DecodeItemCompactBitstream113c,
  UNITS_GetBeltTypeFromItem113c,
  UNITS_GetInventoryRecordId113c,
} from '../common/inventory'
import {
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_FindMatchingRunesTxtRecord113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_NoOpReturnZero113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetNodePage113c,
  ITEMS_SetOrClearCommandFlags113c,
  ITEMS_SetOrClearFlagMask113c,
} from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_ClearPathPointsAndFlag0x20_113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetPrevTargetX113c,
  PATH_GetPrevTargetY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_RefreshUnitCollisionPattern113c,
  PATH_SetMoveTestCollisionMask113c,
  PATH_SetStepNum113c,
  PATH_SetUnitCollisionPattern113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path'
import { HIRELING_GetActIndex113c, UNITS_GetRightSkill113c } from '../common/quest-record'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_RefreshPassiveAuraSkills113c,
  SKILLS_RemoveAllCurseAndDebuffStatesFromUnit113c,
  SKILLS_SetRightSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../common/skills'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  HIRELING_RollAndPopulateStatsEntry113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitHirelingResurrectCost113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
  UNITS_GetUnitSizeY113c,
  UNITS_IsUnitInObjRectRange113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNITS_SetUnitUpdateFlags113c,
  UNITS_TestCollisionBetweenUnits113c,
} from '../common/unit'
import type { SparseMemory113c } from '../mem/sparse-memory'
import { type D2SeedStrc, seedRoll } from '../prng'
import {
  DATATBLS_GetDirectionOffset113c,
  DATATBLS_NormalizeDirection113c,
} from '../tables/datatbls-113c'
import {
  DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c,
  DATATBLS_GetSuperUniquesTxtRecord113c,
} from '../tables/monster-tbls-113c'
import { NPCS_OnPlayerLevelChange113c } from './a1c-post150-f150-f276-113c'
import { S2C_SendPacket9C_ItemActionWorld113c } from './a1c-post150-f786-f1040-113c'
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillMode14_113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  MONSTER_InitModeChangeStrc113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import {
  PLAYER_StartModeAtCoords113c,
  PLAYER_StartModeOnUnit113c,
} from './c2s-packet-113c'
import {
  AI_ApproachTarget113c,
  AI_FindNearestPlayerOrAlly113c,
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_DistributeExperience113c,
} from './k2-real-s2c-combat-113c'
import { ITEMS_FindFreeGroundDropCoords_6FC2E930_113c } from './k2-real-itemdrop-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c,
  ITEMS_HasSocketedSubItems113c,
  PLRTRADE_BroadcastClearMercUnitCallback113c,
  PLRTRADE_IsInteractingWithValidPlayer113c,
  PLRTRADE_SendTradeAcceptButtonAndSetState3_113c,
} from './k2-combat-core-w1-113c'
import {
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_DeactivateEquippedItemStats113c,
  ITEMS_OnEquipScrollOrTome113c,
  ITEMS_OnUnequipScrollOrTome113c,
  ITEMS_RegisterItemEventCallback113c,
  UNITEVENT_RegisterTimerOrItemEventNode113c,
} from './k2-gap-itemdef-113c'
import {
  ITEMEVENT_RemoveByTypeAndState113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
} from './k2-gap-melee-dot-113c'
import {
  MONUMOD_CountUnitUMods113c,
  MONUMOD_GetUModListPtr113c,
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
  MONUMOD_SetSuperUniqueId113c,
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  SUNIT_FindItemEventNode113c,
} from './k2-items-tc-w1-113c'
import {
  MONSTER_GetInteractDataPtr_6FC21370_113c,
  MONSTER_GetMonsterDataField2C_6FC21DD0_113c,
  SKILLS_EvalLinearParam56_6FC21A90_113c,
  STATLIST_AddUnitStatGoldGuarded_6FC21670_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import {
  AI_CountAdjacentUnitsCallback_6FC35590_113c,
  ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c,
} from './k2-laneI-0x6fc3-w1-113c'
import {
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_TriggerItemDropped_6FC545A0_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import {
  CLIENTS_SetClientActNo_6FC69D70_113c,
  CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c,
  SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c'
import {
  DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c,
  MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c,
  SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c,
} from './k2-w10b1-113c'
import {
  ACT_WarpClientPlayerToActTown_6FCBDF40_113c,
  AI_MercMoveActionDispatch_6FC3D3C0_113c,
  AI_PetMoveActionDispatch_6FC3CAE0_113c,
  DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c,
  type PetMoveActionOps113c,
  MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c,
  MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c,
  NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c,
  OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c,
  PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c,
  PETS_RegisterSummonPetAndClampCount_6FCB7F50_113c,
  SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c,
  SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c,
} from './k2-w11b1-113c'
import {
  ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c,
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c,
} from './k2-w2b1-113c'
import {
  NET_SendPacket9B_MercReviveInfo_6FCAA690_113c,
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c,
  PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c,
} from './k2-w2b3-113c'
import { S2C_QueueSingleBytePacket1_6FCAC490_113c } from './k2-w2b4-113c'
import {
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  AI_StartModeAtCoordsStep1_6FD11FF0_113c,
  ITEMS_PlaceItemInSocketInventory_6FCF1650_113c,
} from './k2-w2b8-113c'
import {
  ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c,
  SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c,
  SKILLS_MountImpOnSiegeBeast_6FC2D040_113c,
} from './k2-w3b1-113c'
import {
  QUESTS_AttachUnitToQuest_6FC55890_113c,
  QUESTS_CheckLevelTransitionBlocked_6FC54020_113c,
} from './k2-w3b3-113c'
import { SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c } from './k2-w3b5-113c'
import {
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c,
} from './k2-w3b7-113c'
import {
  AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c,
  AI_UnburrowAndScheduleThink_6FC9BE10_113c,
} from './k2-w3b8-113c'
import {
  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c,
  MONUMOD_RollRandomUniqueBossMod_6FC43980_113c,
} from './k2-w4b1-113c'
import { MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c } from './k2-w4b2-113c'
import {
  MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c,
  OBJ_TryOperateObjectIfInRange_6FC8A720_113c,
  PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c,
} from './k2-w4b3-113c'
import {
  MONSTER_SpawnChampionPackMembers_6FC67880_113c,
  NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c,
  OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c,
} from './k2-w4b4-113c'
import {
  PETS_ForEachPlayerPetUnit_6FCB6AF0_113c,
  PETS_GetFirstPetUnitByType_6FCB6A40_113c,
} from './k2-w4b5-113c'
import {
  ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c,
  AI_SetStateDirAndStartWalkMode_6FCC41B0_113c,
  CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c,
  SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
} from './k2-w4b6-113c'
import { MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c } from './k2-w4b7-113c'
import { NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c } from './k2-w5b2-113c'
import { MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c } from './k2-w5b3-113c'
import { NPC_DeductPlayerGoldAndStash_6FCDCC60_113c } from './k2-w5b4-113c'
import { HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c } from './k2-w5b6-113c'
import {
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c,
  ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c,
  ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c,
  ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c,
} from './k2-w5b7-113c'
import {
  MONSTER_SpawnMinionPackInRing_6FD0DE90_113c,
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c,
} from './k2-w5b9-113c'
import {
  AI_CircleStrafeTarget_6FD126B0_113c,
  AI_WalkToLeashDistanceFromUnit_6FD11C30_113c,
  AI_WalkWanderAroundSelf_6FD129B0_113c,
  AI_WalkWanderAroundUnitOrSelf_6FD12870_113c,
} from './k2-w5b10-113c'
import { SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c } from './k2-w6b1-113c'
import { AI_ExecuteHirelingCombatStep_6FC3C8A0_113c } from './k2-w6b3-113c'
import {
  ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c,
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c,
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c,
} from './k2-w6b6-113c'
import {
  ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c,
  NPC_StartPlayerNpcInteraction_6FC687A0_113c,
} from './k2-w7b1-113c'
import { PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c } from './k2-w7b3-113c'
import {
  ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c,
  ITEMS_PickupGroundItemToCursor_6FCF7160_113c,
} from './k2-w7b4-113c'
import { QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c } from './k2-w8b1-113c'
import { ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c } from './k2-w8b3-113c'
import { PLAYER_LootPlayerCorpseUnit_6FC99910_113c } from './k2-w9b1-113c'
import { ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c } from './k2-w9b2-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import {
  AI_InitMonsterAiThinkFn113c,
  MONSTATS2_CheckModeBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTER_Create113c,
  MONSTER_SpawnAtCoords113c,
  MONSTER_SpawnPartyMinionInRing113c,
  REGPOP_FindPackSpawnCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SEED_RollMaskFast113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { bindK2KernelGlobals113c } from './k2-d2tv-evaluators-113c'
import {
  ensureSliceWorldPathMemory113c,
  type FallenSliceWorld113c,
} from './replay-kernel-113c'
import { CLIENTS_GetPlayerUnit113c, SUNIT_FreeUnit113c } from './replay-final11-113c'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
} from './timer-wheel'
import {
  AI_StepRelativeToTargetUnit113c,
  UNITS_GetOctileDistanceToCoordinates113c,
} from './town-npc-ai-113c'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

const K2_W12B1_SCRATCH_BASE = 0x00ff7000

const u8 = (m: SparseMemory113c, a: number): number => m.u8(a >>> 0) & 0xff
const u16 = (m: SparseMemory113c, a: number): number => m.u16(a >>> 0) & 0xffff
const i16 = (m: SparseMemory113c, a: number): number => (m.u16(a >>> 0) << 16) >> 16
const u32 = (m: SparseMemory113c, a: number): number => m.u32(a >>> 0) >>> 0
const i32 = (m: SparseMemory113c, a: number): number => m.u32(a >>> 0) | 0
const w8 = (m: SparseMemory113c, a: number, v: number): void => m.setU8(a >>> 0, v & 0xff)
const w16 = (m: SparseMemory113c, a: number, v: number): void => m.setU16(a >>> 0, v & 0xffff)
const w32 = (m: SparseMemory113c, a: number, v: number): void => m.setU32(a >>> 0, v >>> 0)

function readSgptDataTablesPtr(m: SparseMemory113c): number {
  const ind = u32(m, 0x6fd1829c)
  if (ind !== 0) {
    const ptr = u32(m, ind)
    if (ptr !== 0) return ptr
  }
  return u32(m, 0x6fde9e1c)
}

function unitSeedOf(m: SparseMemory113c, seedAddr: number): D2SeedStrc {
  const addr = seedAddr >>> 0
  return {
    get lo() {
      return u32(m, addr)
    },
    set lo(v: number) {
      w32(m, addr, v >>> 0)
    },
    get hi() {
      return u32(m, (addr + 4) >>> 0)
    },
    set hi(v: number) {
      w32(m, (addr + 4) >>> 0, v >>> 0)
    },
  }
}

function getUnitPosXInline113c(m: SparseMemory113c, pUnit: number): number {
  const uType = i32(m, pUnit)
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStaticPath = u32(m, pUnit + 0x2c)
    return i32(m, pStaticPath + 0x0c)
  }
  const pPath = u32(m, pUnit + 0x2c)
  if (pPath === 0) return 0
  return PATH_GetPosX113c(m, pPath) | 0
}

function getUnitPosYInline113c(m: SparseMemory113c, pUnit: number): number {
  const uType = i32(m, pUnit)
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    const pStaticPath = u32(m, pUnit + 0x2c)
    return i32(m, pStaticPath + 0x10)
  }
  const pPath = u32(m, pUnit + 0x2c)
  if (pPath === 0) return 0
  return PATH_GetPosY113c(m, pPath) | 0
}

function c2sRunToUnitAndQueueInteract_6FCEE120(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pTargetUnit: number,
  dwUnitType: number,
  dwTargetGuid: number,
  nInteractType: number,
): void {
  C2S_RunToTargetAndSetQueuedSkill113c(
    m,
    pGame,
    pPlayerUnit,
    pTargetUnit,
    dwUnitType,
    dwTargetGuid,
    nInteractType,
  )
}
/**
 * @dll D2Game.dll
 * @va 0x6FC2DBD0
 * @ordinalOrName D2Game_6FC2DBD0
 */
export function SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2DBD0)
  if (nSkillId < 0) return 0
  const sgpt = readSgptDataTablesPtr(m)
  if (sgpt === 0 || nSkillId >= i32(m, sgpt + 0xba0)) return 0
  const pSkillsTxtBase = u32(m, sgpt + 0xb98)
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const wSrvMissile = i16(m, pSkillsTxt + 0x80)
  if (wSrvMissile < 0 || wSrvMissile >= i32(m, sgpt + 0xc4)) return 0

  const pOwner = SUNIT_GetOwnerUnit113c(m, pUnit, pGame)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame)
  const pRawTarget = PATH_GetTargetUnit113c(m, u32(m, pUnit + 0x2c))
  const pTarget = pRawTarget === pUnit ? 0 : pRawTarget

  if (pOwner !== 0) {
    const pOutX = K2_W12B1_SCRATCH_BASE + 0x00
    const pOutY = K2_W12B1_SCRATCH_BASE + 0x04
    w32(m, pOutX, 0)
    w32(m, pOutY, 0)
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, pOutX, pOutY)
    DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
      m,
      i32(m, pOutX),
      0,
      i32(m, pOutY),
      pGame,
      pUnit,
      0,
      0,
    )
    SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c(m, pOwner, pUnit, pGame, nSkillId)
    return 1
  }

  if (pTarget === 0) {
    return SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c(
      m,
      pGame,
      pUnit,
      nSkillId,
      nSkillLevel,
    )
  }

  if (
    SUNIT_GetOwnerUnit113c(m, pTarget, pGame) !== 0 ||
    SUNIT_IsDeadOrDying113c(m, pTarget) !== 0
  ) {
    return 0
  }

  const nTargetY = UNIT_GetPosY113c(m, pTarget)
  const nTargetX = UNIT_GetPosX113c(m, pTarget)
  const pTargetRoom = UNITS_GetRoom113c(m, pTarget)
  if (
    DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
      m,
      nTargetX,
      pTargetRoom,
      nTargetY,
      pGame,
      pUnit,
      1,
      0,
    ) === 0
  ) {
    return 0
  }
  SKILLS_MountImpOnSiegeBeast_6FC2D040_113c(m, pTarget, pUnit, nSkillId, pGame, nSkillLevel)
  return 1
}

function isFallenSliceWorldW12B1_113c(
  v: SparseMemory113c | FallenSliceWorld113c,
): v is FallenSliceWorld113c {
  return !('u32' in v)
}

/**
 * @dll D2Game.dll
 * @va 0x6FC3DD40
 * @ordinalOrName D2Game_6FC3DD40
 */
export function AI_ThinkMercenaryMain_6FC3DD40_113c(
  arg0: SparseMemory113c | FallenSliceWorld113c,
  arg1: number,
  arg2 = 0,
  arg3 = 0,
): void {
  hitD2GameVa113c(0x6FC3DD40)
  if (isFallenSliceWorldW12B1_113c(arg0)) {
    const world = arg0
    const pMerc = arg1 >>> 0
    const { m, pGame } = world
    ensureSliceWorldPathMemory113c(world)
    bindK2KernelGlobals113c(m)

    if (pMerc === 0 || m.u32(pMerc) !== 1) return
    const nClassId = m.u32((pMerc + 0x04) >>> 0) | 0
    const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
    if (pMonStatsTxt === 0) return

    const pMonData = m.u32((pMerc + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
    const pAiCtrl = pMonData !== 0 ? (m.u32((pMonData + 0x2c) >>> 0) >>> 0) : 0
    if (pAiGen === 0 || pAiCtrl === 0) return

    let pOwner = 0
    if (m.u32((pAiGen + 0x28) >>> 0) !== 0) {
      const ownerGuid = m.u32((pAiGen + 0x2c) >>> 0) >>> 0
      const ownerType = m.u32((pAiGen + 0x30) >>> 0) | 0
      pOwner = SUNIT_GetServerUnit113c(m, pGame, ownerType, ownerGuid) >>> 0
    }
    if (pOwner === 0 || m.u32(pOwner) !== 0) {
      AI_Stall113c(world, pMerc, 10)
      return
    }

    if (STATES_CheckState113c(m, pMerc, 0x0c) !== 0) {
      STATES_ToggleGfxStateFlag113c(m, pMerc, 0x0c, 0)
    }

    const mercMode = m.u32((pMerc + 0x10) >>> 0) | 0
    if (mercMode === 2 || mercMode === 15) return

    const aiField14 = m.u32((pAiCtrl + 0x14) >>> 0) | 0
    let farDist = 0x18
    let midDist = 0x10
    let closeArg = 5
    if (aiField14 > 0x10 && aiField14 < 0x14) {
      farDist = (aiField14 * 2) | 0
      midDist = aiField14
      closeArg = aiField14 >> 1
    }

    const distOwner = AI_CalcApproxUnitDistSubtiles113c(m, pMerc, pOwner)
    const ownerMode = m.u32((pOwner + 0x10) >>> 0) | 0

    if ((distOwner >>> 0) > 100) {
      AI_MercMoveActionDispatch_6FC3D3C0_113c(world, pMerc, pOwner, 3, 0, 0, 0)
      return
    }
    if ((distOwner >>> 0) > (farDist >>> 0)) {
      AI_MercMoveActionDispatch_6FC3D3C0_113c(world, pMerc, pOwner, 1, 1, 0x3c, 0)
      return
    }
    if ((distOwner >>> 0) > (midDist >>> 0)) {
      if (ownerMode === 2 || ownerMode === 6) {
        AI_MercMoveActionDispatch_6FC3D3C0_113c(world, pMerc, pOwner, 0, 0, 0, 0)
        return
      }
      if (ownerMode === 3) {
        AI_MercMoveActionDispatch_6FC3D3C0_113c(world, pMerc, pOwner, 0, 1, 0x3c, 0)
        return
      }
    }

    if (mercMode !== 1) {
      EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
      AI_Stall113c(world, pMerc, 5)
      return
    }

    const doorwayChance =
      nClassId === 0x152 || (nClassId > 0x22f && nClassId <= 0x231) ? 6 : 12
    let onDoorwayMask = false
    const pMercRoom = UNITS_GetRoom113c(m, pMerc) >>> 0
    const collPat = PATH_GetUnitCollisionPattern113c(m, pMerc)
    const mx = UNIT_GetPosX113c(m, pMerc) | 0
    const my = UNIT_GetPosY113c(m, pMerc) | 0
    const pSeed = (pMerc + 0x20) >>> 0
    const rollSeedLim = (nMax: number): number => {
      const max = nMax | 0
      if (max <= 0) return 0
      const s: D2SeedStrc = { lo: m.u32(pSeed) >>> 0, hi: m.u32((pSeed + 4) >>> 0) >>> 0 }
      const r = seedRoll(s, max) | 0
      m.setU32(pSeed, s.lo >>> 0)
      m.setU32((pSeed + 4) >>> 0, s.hi >>> 0)
      return r
    }

    if (
      pMercRoom !== 0 &&
      COLLISION_CheckMaskWithPattern2_113c(m, pMercRoom, mx, my, collPat, 0x40) !== 0
    ) {
      onDoorwayMask = true
      if (rollSeedLim(0x80) < doorwayChance) {
        AI_IdleWander113c(world, pMerc, 5)
        return
      }
    }

    const isInTown = pMercRoom !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pMercRoom) !== 0
    if (!isInTown) {
      const sp = m.alloc(0x10)
      m.setU32(sp, 0)
      m.setU32((sp + 4) >>> 0, 0x7fffffff)
      const pTarget =
        MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(
          m,
          pMerc,
          pGame,
          sp,
          (sp + 4) >>> 0,
        ) >>> 0
      const targetDist = m.u32((sp + 4) >>> 0) >>> 0
      if (pTarget !== 0 && targetDist < 0x19) {
        AI_ExecuteHirelingCombatStep_6FC3C8A0_113c(
          world,
          pMerc,
          nClassId,
          pOwner,
          pTarget,
          pSeed,
          pAiCtrl,
          pMonStatsTxt,
        )
        return
      }
    }

    if (onDoorwayMask) {
      AI_IdleWander113c(world, pMerc, 5)
      return
    }

    const pOwnerRoom = UNITS_GetRoom113c(m, pOwner) >>> 0
    const ox = UNIT_GetPosX113c(m, pOwner) | 0
    const oy = UNIT_GetPosY113c(m, pOwner) | 0
    const ownerCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pOwnerRoom, ox, oy)
    const mercCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pMercRoom, mx, my)
    if (mercCoordIdx !== ownerCoordIdx) {
      AI_MercMoveActionDispatch_6FC3D3C0_113c(world, pMerc, pOwner, 0, 1, 0x3c, 0)
      return
    }

    if ((distOwner >>> 0) <= 1) {
      AI_MercMoveActionDispatch_6FC3D3C0_113c(world, pMerc, pOwner, 5, 0, 0, (closeArg - 1) & 0xff)
      return
    }

    if (rollSeedLim(100) >= 5) {
      EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
      AI_Stall113c(world, pMerc, 5)
      return
    }
    AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pOwner, midDist & 0xff, pGame, pMerc, { world })
    return
  }

  const m = arg0
  const pGame = arg1
  const pUnit = arg2
  const pAiTickParam = arg3
  if (pUnit === 0) {
    AI_InitMonsterAiThinkFn113c(m, pUnit)
    AI_Stall113c(m, pGame, pUnit, 10)
    return
  }

  const dwUnitType = u32(m, pUnit)
  const nClassId = i32(m, pUnit + 0x04)
  let pOwner = 0
  if (dwUnitType === 1) {
    const pMonData = u32(m, pUnit + 0x14)
    const pAiGeneral = pMonData !== 0 ? u32(m, pMonData + 0x28) : 0
    if (pAiGeneral !== 0 && u32(m, pAiGeneral + 0x28) !== 0) {
      pOwner = SUNIT_GetServerUnit113c(
        m,
        pGame,
        u32(m, pAiGeneral + 0x30),
        u32(m, pAiGeneral + 0x2c),
      )
    }
  }

  if (pOwner === 0 || u32(m, pOwner) !== 0) {
    const nThinkIdx = nClassId === 0x10f ? 5 : 6
    const pMonData = u32(m, pUnit + 0x14)
    const pAiGeneral = pMonData !== 0 ? u32(m, pMonData + 0x28) : 0
    if (pAiGeneral !== 0) {
      w32(m, pAiGeneral, nThinkIdx)
    }
    AI_InitMonsterAiThinkFn113c(m, pUnit)
    AI_Stall113c(m, pGame, pUnit, 10)
    return
  }

  if (STATES_CheckState113c(m, pUnit, 0x0c) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x0c, 0)
  }

  const dwAnimMode = i32(m, pUnit + 0x10)
  if (dwAnimMode === 2 || dwAnimMode === 0x0f) {
    return
  }

  const pAiControl = u32(m, pAiTickParam)
  const nField14 = i32(m, pAiControl + 0x14)
  let nMaxDist = 0x18
  let nMidDist = 0x10
  let nHalfDist = 5
  if (nField14 > 0x10 && nField14 < 0x14) {
    nMaxDist = (nField14 + nField14) | 0
    nMidDist = nField14
    nHalfDist = nField14 >> 1
  }

  const nDistToOwner = AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwner) >>> 0
  const dwOwnerMode = i32(m, pOwner + 0x10)
  if (nDistToOwner > 0x64) {
    AI_MercMoveActionDispatch_6FC3D3C0_113c(m, pUnit, pGame, pOwner, 3, 0, 0, 0)
    return
  }
  if (nDistToOwner > (nMaxDist >>> 0)) {
    AI_MercMoveActionDispatch_6FC3D3C0_113c(m, pUnit, pGame, pOwner, 1, 1, 0x3c, 0)
    return
  }
  if (nDistToOwner > (nMidDist >>> 0)) {
    if (dwOwnerMode === 2 || dwOwnerMode === 6) {
      AI_MercMoveActionDispatch_6FC3D3C0_113c(m, pUnit, pGame, pOwner, 0, 0, 0, 0)
      return
    }
    if (dwOwnerMode === 3) {
      AI_MercMoveActionDispatch_6FC3D3C0_113c(m, pUnit, pGame, pOwner, 0, 1, 0x3c, 0)
      return
    }
  }

  if (dwAnimMode !== 1) {
    let pEvent = u32(m, pUnit + 0xdc)
    while (pEvent !== 0) {
      const pNext = u32(m, pEvent + 0x24)
      if (u8(m, pEvent) === 2) {
        EVENT_FreeNode113c(m, pGame, pEvent)
      }
      pEvent = pNext
    }
    AI_Stall113c(m, pGame, pUnit, 5)
    return
  }

  const bNotAct3Or5Merc =
    nClassId === 0x152 || (nClassId > 0x22f && nClassId <= 0x231) ? 0 : 1
  let bBlocked = 0
  const wCollPattern = PATH_GetUnitCollisionPattern113c(m, pUnit)
  const nPosY = UNIT_GetPosY113c(m, pUnit)
  const nPosX = UNIT_GetPosX113c(m, pUnit)
  const pUnitRoom = UNITS_GetRoom113c(m, pUnit)
  if (
    COLLISION_CheckMaskWithPattern2_113c(m, pUnitRoom, nPosX, nPosY, wCollPattern, 0x40) !== 0
  ) {
    bBlocked = 1
    const nRollCap = bNotAct3Or5Merc !== 0 ? 12 : 6
    if (SEED_RollMaskFast113c(m, (pUnit + 0x20) >>> 0, 0x80) < nRollCap) {
      AI_IdleWander113c(m, pGame, pUnit)
      return
    }
  }

  if (DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, pUnit)) === 0) {
    const pTargetDist = K2_W12B1_SCRATCH_BASE + 0x08
    const pTargetCombat = K2_W12B1_SCRATCH_BASE + 0x0c
    w32(m, pTargetDist, 0)
    w32(m, pTargetCombat, 0)
    const pTarget = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(
      m,
      pUnit,
      pGame,
      pTargetDist,
      pTargetCombat,
    )
    if (pTarget !== 0 && u32(m, pTargetDist) < 0x19) {
      AI_ExecuteHirelingCombatStep_6FC3C8A0_113c(
        m,
        pUnit,
        pGame,
        nClassId,
        pOwner,
        pTarget,
        (pUnit + 0x20) >>> 0,
        pAiTickParam,
      )
      return
    }
  }

  if (bBlocked !== 0) {
    AI_IdleWander113c(m, pGame, pUnit)
    return
  }

  const nOwnerCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(
    m,
    UNITS_GetRoom113c(m, pOwner),
    UNIT_GetPosX113c(m, pOwner),
    UNIT_GetPosY113c(m, pOwner),
  )
  const nUnitCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(
    m,
    UNITS_GetRoom113c(m, pUnit),
    UNIT_GetPosX113c(m, pUnit),
    UNIT_GetPosY113c(m, pUnit),
  )
  if (nUnitCoordIdx !== nOwnerCoordIdx) {
    AI_MercMoveActionDispatch_6FC3D3C0_113c(m, pUnit, pGame, pOwner, 0, 1, 0x3c, 0)
    return
  }

  if (AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwner) >>> 0 <= 1) {
    AI_MercMoveActionDispatch_6FC3D3C0_113c(
      m,
      pUnit,
      pGame,
      pOwner,
      5,
      0,
      0,
      (nHalfDist - 1) & 0xff,
    )
    return
  }

  if (seedRoll(unitSeedOf(m, pUnit + 0x20), 100) >= 5) {
    AI_Stall113c(m, pGame, pUnit, 5)
    return
  }
  AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pOwner, nMidDist & 0xff, pGame, pUnit)
}
/**
 * @dll D2Game.dll
 * @va 0x6FC3E140
 * @ordinalOrName D2Game_6FC3E140
 */
export function AI_FollowOwnerOrTeleportIfFar_6FC3E140_113c(
  m: SparseMemory113c,
  pOwnerUnit: number,
  pGame: number,
  pPetUnit: number,
  bCanTeleportInDungeon: number,
  bForceNoRepositionOnClose: number,
  bSkipCase2: number,
  nMaxFollowDist: number,
  ops?: PetMoveActionOps113c,
): number {
  hitD2GameVa113c(0x6FC3E140)
  const pOwnerPath = u32(m, pOwnerUnit + 0x2c)
  const nDist = AI_CalcApproxUnitDistSubtiles113c(m, pPetUnit, pOwnerUnit) | 0
  const dwOwnerMode = i32(m, pOwnerUnit + 0x10)
  const pPlrData = u32(m, pOwnerUnit) === 0 ? UNITS_GetPlayerData113c(m, pOwnerUnit) : 0
  if (pPlrData !== 0) {
    const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
    const known = memInternal.known
    if (known !== undefined) {
      for (let i = 0; i < 0xcc; i++) {
        const addr = (pPlrData + 0xa0 + i) >>> 0
        const kp = known.get(addr >>> 12)
        if (kp === undefined || kp[addr & 0xfff] === 0) {
          m.setU8(addr, 0)
        }
      }
    }
  }

  let nTotalPets = 0
  if (pPlrData !== 0) {
    const pPetTable = u32(m, pPlrData + 0x44)
    if (pPetTable !== 0) {
      const sgpt = readSgptDataTablesPtr(m)
      const nPetTypes = sgpt !== 0 ? i32(m, sgpt + 0xbf0) : 0
      const pSlotArray = u32(m, pPetTable)
      if (nPetTypes > 0 && pSlotArray !== 0) {
        for (let i = 0; i < nPetTypes; i += 1) {
          nTotalPets = (nTotalPets + i32(m, pSlotArray + 4 + i * 12)) | 0
        }
      }
    }
  }

  let nAdjustedMaxDist = (nMaxFollowDist + (nTotalPets >> 1)) | 0
  if (nAdjustedMaxDist > 0x24) {
    nAdjustedMaxDist = 0x24
  }

  if (nDist <= 1 && dwOwnerMode === 1 && bForceNoRepositionOnClose === 0) {
    return AI_PetMoveActionDispatch_6FC3CAE0_113c(
      m,
      pPetUnit,
      pGame,
      pOwnerUnit,
      5,
      0,
      0,
      nAdjustedMaxDist,
      ops,
    )
  }

  if (
    bCanTeleportInDungeon !== 0 &&
    DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, pPetUnit)) === 0
  ) {
    if (nDist > 0x50) {
      return AI_PetMoveActionDispatch_6FC3CAE0_113c(
        m,
        pPetUnit,
        pGame,
        pOwnerUnit,
        3,
        0,
        0,
        nAdjustedMaxDist,
        ops,
      )
    }
    return 0
  }

  const nOwnerX = UNIT_GetPosX113c(m, pOwnerUnit)
  const nOwnerY = UNIT_GetPosY113c(m, pOwnerUnit)
  const nOwnerCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(
    m,
    UNITS_GetRoom113c(m, pOwnerUnit),
    nOwnerX,
    nOwnerY,
  )

  const nPetX = UNIT_GetPosX113c(m, pPetUnit)
  const nPetY = UNIT_GetPosY113c(m, pPetUnit)
  const nPetCoordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(
    m,
    UNITS_GetRoom113c(m, pPetUnit),
    nPetX,
    nPetY,
  )

  const nFirstX = pOwnerPath !== 0 ? PATH_GetFirstPointX113c(m, pOwnerPath) : 0
  const nFirstY = pOwnerPath !== 0 ? PATH_GetFirstPointY113c(m, pOwnerPath) : 0
  const nPrevX = pOwnerPath !== 0 ? PATH_GetPrevTargetX113c(m, pOwnerPath) : 0
  const nPrevY = pOwnerPath !== 0 ? PATH_GetPrevTargetY113c(m, pOwnerPath) : 0

  let nAction = 2
  if (dwOwnerMode === 2 || dwOwnerMode === 6 || dwOwnerMode === 3) {
    nAction = 0
  }
  if (nFirstX !== nPrevX && nFirstY !== nPrevY) {
    nAction = 0
  }
  if (nOwnerCoordIdx !== nPetCoordIdx) {
    nAction = 1
  }
  if (nDist > nAdjustedMaxDist) {
    nAction = 1
  }
  if (nDist > 0x32) {
    nAction = 3
  }

  const histTargetX = pPlrData !== 0 ? i32(m, pPlrData + 0x148) : 0
  const histTargetY = pPlrData !== 0 ? i32(m, pPlrData + 0x14c) : 0
  const nHistDist =
    UNITS_GetOctileDistanceToCoordinates113c(
      m,
      pPetUnit,
      histTargetX,
      histTargetY,
    ) >>> 0
  if (nHistDist < 0x1c) {
    if (nAction === 1) {
      if (nDist < 0x1e) {
        nAction = 4
      }
    } else if (nAction === 2) {
      nAction = 4
    }
  }

  if (bSkipCase2 !== 0 && nAction === 2) {
    return 0
  }

  return AI_PetMoveActionDispatch_6FC3CAE0_113c(
    m,
    pPetUnit,
    pGame,
    pOwnerUnit,
    nAction,
    0,
    0,
    nAdjustedMaxDist,
    ops,
  )
}

/**
 * @dll D2Game.dll
 * @va 0x6FC44C70
 * @ordinalOrName D2Game_6FC44C70
 */
export function MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  nAnimMode: number,
  nX: number,
  nY: number,
  _nUnusedArg: number,
  bIsChampion: number,
  nMonHcIdx: number,
): number {
  hitD2GameVa113c(0x6FC44C70)
  const pMonster = MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
    m,
    nMonHcIdx,
    nAnimMode,
    1,
    pGame,
    pRoom,
    nX & 0xffff,
    nY & 0xffff,
    -1,
  )
  if (pMonster === 0) return 0
  MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(m, pGame, pMonster, bIsChampion)
  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 1, pRoom, pGame, pMonster)
  return pMonster
}

function attachSuperUniqueQuestById(
  m: SparseMemory113c,
  pGame: number,
  pMonster: number,
  nQuestId: number,
): void {
  const pQuestChainPtr = u32(m, pGame + 0x10f4)
  if (pQuestChainPtr === 0) return
  let pQuest = u32(m, pQuestChainPtr)
  while (pQuest !== 0) {
    if (i32(m, pQuest) === nQuestId) {
      QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuest, pMonster, pGame)
      return
    }
    pQuest = u32(m, pQuest + 0xf4)
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC44E70
 * @ordinalOrName D2Game_6FC44E70
 */
export function MONUMOD_SpawnPresetUniqueOrSuperUnique_6FC44E70_113c(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  nMonHcIdx: number,
  nX: number,
  nY: number,
  nMaxSearchSteps: number,
  wBossNameId: number,
  bSetFlag04: number,
  bIsSuperUnique: number,
  wSuperUniqueId: number,
  pUModBytes: number,
): number {
  hitD2GameVa113c(0x6FC44E70)
  const pMonster = MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
    m,
    nMonHcIdx,
    0,
    1,
    pGame,
    pRoom,
    nX,
    nY,
    nMaxSearchSteps,
  )
  if (pMonster === 0) return 0
  if (u32(m, pMonster) !== 1) return pMonster
  const pMonData = u32(m, pMonster + 0x14)
  if (pMonData === 0) return pMonster
  const pMonUMods = (pMonData + 0x1c) >>> 0
  if (pMonUMods === 0) return pMonster

  if (bSetFlag04 !== 0) {
    w8(m, pMonData + 0x16, u8(m, pMonData + 0x16) | 0x04)
  } else {
    w8(m, pMonData + 0x16, u8(m, pMonData + 0x16) & 0xfb)
  }

  let bHasAuraMod = 0
  for (let i = 0; i < 9; i += 1) {
    const bMod = u8(m, pUModBytes + i)
    w8(m, pMonUMods + i, bMod)
    if (bMod === 0x1e) {
      bHasAuraMod = 1
    }
  }

  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 0, pRoom, pGame, pMonster)
  if (u32(m, pMonster) === 1) {
    const pMonDataNow = u32(m, pMonster + 0x14)
    if (pMonDataNow !== 0) {
      w16(m, pMonDataNow + 0x14, wBossNameId & 0xffff)
    }
  }

  if (bHasAuraMod !== 0) {
    MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(m, pMonster, 1)
  }

  if (bIsSuperUnique === 0) return pMonster

  if (u32(m, pMonster) === 1) {
    const pMonData1 = u32(m, pMonster + 0x14)
    if (pMonData1 !== 0) {
      w8(m, pMonData1 + 0x16, u8(m, pMonData1 + 0x16) | 0x02)
    }
    const pMonData2 = u32(m, pMonster + 0x14)
    if (pMonData2 !== 0) {
      w16(m, pMonData2 + 0x26, wSuperUniqueId & 0xffff)
    }
  }

  const nSuId = (wSuperUniqueId << 16) >> 16
  switch (nSuId) {
    case 6:
      STATES_ToggleGfxStateFlag113c(m, pMonster, 0x76, 1)
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x05)
      break
    case 26:
    case 27:
    case 29:
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x13)
      break
    case 36:
    case 37:
    case 38:
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x17)
      break
    case 39:
      QUESTS_AttachUnitToQuest_6FC55890_113c(m, pMonster, 4, pGame)
      break
    case 42:
      STATES_ToggleGfxStateFlag113c(m, pMonster, 0x76, 1)
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x1f)
      break
    case 43:
    case 44:
    case 45:
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x23)
      break
    case 60:
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x22)
      break
    default:
      break
  }

  return pMonster
}
/**
 * @dll D2Game.dll
 * @va 0x6FC451F0
 * @ordinalOrName D2Game_6FC451F0
 */
export function MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  nX: number,
  nY: number,
  nSuperUniqueId: number,
): number {
  hitD2GameVa113c(0x6FC451F0)
  if (u8(m, pGame + 0x6d) >= 3) return 0
  const pSuRec = DATATBLS_GetSuperUniquesTxtRecord113c(m, nSuperUniqueId)
  if (pSuRec === 0) return 0
  const nMonHcIdx = i32(m, pSuRec + 0x04)
  if (nMonHcIdx < 0) return 0

  if (u8(m, pSuRec + 0x26) === 0) {
    const byteOff = (pGame + 0x1d30 + (nSuperUniqueId >> 3)) >>> 0
    const bitMask = 1 << (nSuperUniqueId & 7)
    if ((u8(m, byteOff) & bitMask) !== 0) {
      return 0
    }
  }

  const bReplaceable = u8(m, pSuRec + 0x24)
  const spawnX = bReplaceable !== 0 ? 0 : nX
  const spawnY = bReplaceable !== 0 ? 0 : nY

  const pMonster = MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
    m,
    nMonHcIdx,
    0,
    0,
    pGame,
    pRoom,
    spawnX,
    spawnY,
    -1,
  )
  if (pMonster === 0) return 0

  const pUModList = MONUMOD_GetUModListPtr113c(m, pMonster)
  if (pUModList === 0) return pMonster

  const byteOff = (pGame + 0x1d30 + (nSuperUniqueId >> 3)) >>> 0
  w8(m, byteOff, u8(m, byteOff) | (1 << (nSuperUniqueId & 7)))

  if (u32(m, pMonster) === 1) {
    const pMonData = u32(m, pMonster + 0x14)
    if (pMonData !== 0) {
      w8(m, pMonData + 0x16, u8(m, pMonData + 0x16) | 0x02)
    }
  }

  MONUMOD_SetSuperUniqueId113c(m, pMonster, nSuperUniqueId)

  const sgpt = readSgptDataTablesPtr(m)
  const nTotalUMods = sgpt !== 0 ? i32(m, sgpt + 0xc54) : 0x2c
  const pUsedFlags = K2_W12B1_SCRATCH_BASE + 0x100
  const clearCount = nTotalUMods > 0 && nTotalUMods <= 0x100 ? nTotalUMods : 0x2c
  for (let i = 0; i < clearCount; i += 1) {
    w8(m, pUsedFlags + i, 0)
  }

  const nExistingMods = MONUMOD_CountUnitUMods113c(m, pUModList)
  if (nExistingMods >= 5) return pMonster

  let pWriteMod = (pUModList + nExistingMods) >>> 0
  let bHasAuraMod = 0
  for (let i = 0; i < 3; i += 1) {
    const dwMod = i32(m, pSuRec + 0x0c + i * 4)
    if (dwMod === 0) break
    if (dwMod === 0x1e) {
      bHasAuraMod = 1
      w8(m, pWriteMod, dwMod)
      w8(m, pUsedFlags + dwMod, 1)
      pWriteMod = (pWriteMod + 1) >>> 0
    } else if (dwMod !== 0x18) {
      w8(m, pWriteMod, dwMod)
      w8(m, pUsedFlags + dwMod, 1)
      pWriteMod = (pWriteMod + 1) >>> 0
    }
  }

  const nDiff = u8(m, pGame + 0x6d)
  for (let rolled = 0; rolled < nDiff; rolled += 1) {
    const nRolledMod = MONUMOD_RollRandomUniqueBossMod_6FC43980_113c(
      m,
      pGame,
      pMonster,
      pUsedFlags,
    )
    if (nRolledMod === 0) break
    w8(m, pWriteMod, nRolledMod)
    pWriteMod = (pWriteMod + 1) >>> 0
    w8(m, pUsedFlags + nRolledMod, 1)
  }

  let nMinGrp = i32(m, pSuRec + 0x1c)
  let nMaxGrp = i32(m, pSuRec + 0x20)
  if (nMinGrp !== 0 && nMaxGrp !== 0) {
    const diffAdd = u8(m, pGame + 0x6d)
    nMinGrp = (nMinGrp + diffAdd) | 0
    nMaxGrp = (nMaxGrp + diffAdd) | 0
  }

  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 1, pRoom, pGame, pMonster)

  if (bHasAuraMod !== 0) {
    MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(m, pMonster, 1)
  }

  let pAiGeneral = 0
  if (u32(m, pMonster) === 1) {
    const pMonData = u32(m, pMonster + 0x14)
    if (pMonData !== 0) {
      pAiGeneral = u32(m, pMonData + 0x28)
    }
  }

  let nSuHcIdx = -1
  if (nSuperUniqueId >= 0 && sgpt !== 0 && nSuperUniqueId < i32(m, sgpt + 0xadc)) {
    const pSuTable = u32(m, sgpt + 0xad4)
    nSuHcIdx = i32(m, pSuTable + Math.imul(nSuperUniqueId, 0x34) + 0x08)
  }

  switch (nSuHcIdx) {
    case 6:
      STATES_ToggleGfxStateFlag113c(m, pMonster, 0x76, 1)
      attachSuperUniqueQuestById(m, pGame, pMonster, 5)
      AI_InitMonsterAiThinkFn113c(m, pMonster, pGame, pAiGeneral, 0x0d)
      break
    case 10: {
      const nCount = (seedRoll(unitSeedOf(m, pMonster + 0x20), 5) + 2) | 0
      for (let i = 0; i < nCount; i += 1) {
        MONSTER_SpawnPartyMinionInRing113c(m, 4, pMonster, 1, pGame, 4, 0x40)
      }
      MONSTER_SpawnPartyMinionInRing113c(m, 0x114, pMonster, 1, pGame, 4, 0x40)
      MONSTER_SpawnPartyMinionInRing113c(m, 0x17e, pMonster, 1, pGame, 4, 0x40)
      MONSTER_SpawnPartyMinionInRing113c(m, 0x181, pMonster, 1, pGame, 4, 0x40)
      MONSTER_SpawnPartyMinionInRing113c(m, 0x185, pMonster, 1, pGame, 4, 0x40)
      break
    }
    case 26:
    case 27:
    case 29:
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x13)
      QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c(m, pMonster, pGame)
      break
    case 36:
    case 37:
    case 38:
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x17)
      break
    case 39:
      QUESTS_AttachUnitToQuest_6FC55890_113c(m, pMonster, 4, pGame)
      break
    case 42:
      MONSTER_SpawnMinionPackInRing_6FD0DE90_113c(m, 0x14, pGame, pMonster, 1, 0x1c5, 0x14, 0)
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x1f)
      QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c(m, pMonster, pGame)
      STATES_ToggleGfxStateFlag113c(m, pMonster, 0x76, 1)
      break
    case 43:
    case 44:
    case 45:
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x23)
      QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c(m, pMonster, pGame)
      break
    case 60: {
      if (u32(m, pMonster) === 1 && pAiGeneral !== 0) {
        w16(m, pAiGeneral + 0x08, u16(m, pAiGeneral + 0x08) | 1)
        w32(m, pAiGeneral + 0x2c, u32(m, pMonster + 0x0c))
        w32(m, pAiGeneral + 0x30, 1)
        w32(m, pAiGeneral + 0x28, pGame)
      }
      const nSubClassId = DRLG_ResolveMonsterSubClassIdForRoom113c(
        m,
        UNITS_GetRoom113c(m, pMonster),
        0x1c5,
      )
      MONSTER_SpawnMinionPackInRing_6FD0DE90_113c(
        m,
        0x14,
        pGame,
        pMonster,
        1,
        nSubClassId,
        0x0a,
        0x40,
      )
      attachSuperUniqueQuestById(m, pGame, pMonster, 0x22)
      break
    }
    case 62:
      MONSTER_SpawnMinionPackInRing_6FD0DE90_113c(
        m,
        0x0a,
        pGame,
        pMonster,
        1,
        0x17d,
        0x14,
        0x40,
      )
      break
    default:
      break
  }

  if (u32(m, pMonster) === 1) {
    const pMonData = u32(m, pMonster + 0x14)
    if (pMonData !== 0) {
      const pMods = (pMonData + 0x1c) >>> 0
      MONUMOD_MarkBossAndIncrementUniqueCount113c(m, pMonster, pGame)
      for (let i = 0; i < 9; i += 1) {
        if (u8(m, pMods + i) === 0) {
          w8(m, pMods + i, 0x16)
          break
        }
      }
    }
  }

  return pMonster
}

/**
 * @dll D2Game.dll
 * @va 0x6FC679B0
 * @ordinalOrName D2Game_6FC679B0
 */
export function MONSTER_SpawnUniqueBossWithChampionMinionPack_6FC679B0_113c(
  m: SparseMemory113c,
  pCoordNode: number,
  pRoom: number,
  pGame: number,
  nMonHcIdx: number,
): number {
  hitD2GameVa113c(0x6FC679B0)
  const pMonster = MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
    m,
    nMonHcIdx,
    pCoordNode,
    1,
    pGame,
    pRoom,
    0,
    0,
    -1,
  )
  if (pMonster === 0) return 0
  MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(m, pGame, pMonster, 1)
  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 1, pRoom, pGame, pMonster, pCoordNode, 3, 6)
  MONSTER_SpawnChampionPackMembers_6FC67880_113c(m, pMonster, nMonHcIdx, pGame, pCoordNode)
  return 1
}
/**
 * @dll D2Game.dll
 * @va 0x6FC68FC0
 * @ordinalOrName D2Game_6FC68FC0
 */
export function HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pMercUnit: number,
  wMercHireFlag: number,
  pMercSaveData: number,
  bSkipSubParty: number,
): void {
  hitD2GameVa113c(0x6FC68FC0)
  if (
    pPlayerUnit === 0 ||
    pMercUnit === 0 ||
    pMercSaveData === 0 ||
    u32(m, pPlayerUnit) !== 0
  ) {
    return
  }

  w32(m, pMercUnit + 0xc4, (u32(m, pMercUnit + 0xc4) | 0x04020200) >>> 0)
  SUNIT_SetMonsterAlignmentState113c(m, pMercUnit, 2, 0)
  if (bSkipSubParty === 0) {
    SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
      m,
      pGame,
      pMercUnit,
      u32(m, pPlayerUnit + 0xd0),
      0,
    )
  }

  const pOldMerc = PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, pPlayerUnit, 7, 1, pGame)
  if (pOldMerc !== 0) {
    const pClient =
      u32(m, pPlayerUnit) === 0
        ? u32(m, UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c)
        : 0
    NET_SendPacket9B_MercReviveInfo_6FCAA690_113c(m, 0xffff, 0, pClient)
    if (u32(m, pOldMerc) === 1) {
      const pOldMonData = u32(m, pOldMerc + 0x14)
      const pOldAi = pOldMonData !== 0 ? u32(m, pOldMonData + 0x28) : 0
      w32(m, pOldAi + 0x2c, 0xffffffff)
      w32(m, pOldAi + 0x30, 1)
      w32(m, pOldAi + 0x28, pGame)
    }
    PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
      m,
      pGame,
      pPlayerUnit,
      u32(m, pOldMerc + 0x0c),
      0,
    )
    DUNGEON_AddRoomPortalNode113c(
      m,
      UNITS_GetRoom113c(m, pOldMerc),
      1,
      u32(m, pOldMerc + 0x0c),
    )
    SUNIT_FreeUnit113c(m, pGame, pOldMerc)
  }

  const dwSeed = u32(m, pMercSaveData + 0x04)
  const wNameIdx = u16(m, pMercSaveData)
  const nAct = HIRELING_GetActIndex113c(m, u32(m, pGame + 0x70), 0, wNameIdx)
  const pHireStats = (K2_W12B1_SCRATCH_BASE + 0x220) >>> 0
  for (let i = 0; i < 16; i += 1) {
    w32(m, pHireStats + i * 4, 0)
  }
  const bRolled = HIRELING_RollAndPopulateStatsEntry113c(
    m,
    u32(m, pGame + 0x70),
    pPlayerUnit,
    dwSeed,
    nAct,
    u8(m, pGame + 0x6d),
    pHireStats,
  )
  if (bRolled === 0) return

  const pPetInfo = (K2_W12B1_SCRATCH_BASE + 0x210) >>> 0
  w32(m, pPetInfo + 0x00, dwSeed)
  w32(m, pPetInfo + 0x04, wNameIdx)
  w32(m, pPetInfo + 0x08, u32(m, pHireStats + 0x00))
  PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c(
    m,
    pPlayerUnit,
    pGame,
    pMercUnit,
    7,
    pPetInfo,
  )

  w32(m, pMercUnit + 0xc4, (u32(m, pMercUnit + 0xc4) | 0x80000000) >>> 0)
  if (u32(m, pMercUnit) === 1) {
    const pMonData = u32(m, pMercUnit + 0x14)
    const pAi = pMonData !== 0 ? u32(m, pMonData + 0x28) : 0
    w32(m, pAi + 0x2c, u32(m, pPlayerUnit + 0x0c))
    w32(m, pAi + 0x30, u32(m, pPlayerUnit))
    w32(m, pAi + 0x28, pGame)
  }

  if ((wMercHireFlag & 0xffff) === 0xffff) {
    const wSubTypeId = u16(m, pHireStats + 0x00)
    const nRolledLevel = i32(m, pHireStats + 0x04)
    const pHireRec = DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(
      m,
      u32(m, pGame + 0x70),
      wSubTypeId,
      nRolledLevel,
    )
    if (pHireRec === 0) return
    STATLIST_SetUnitStat113c(m, pMercUnit, 0x0d, i32(m, pHireStats + 0x18), 0)
    HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c(
      m,
      pGame,
      pPlayerUnit,
      pMercUnit,
      nRolledLevel,
    )
    MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c(m, pPlayerUnit, pGame)
  }

  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, pMercUnit, 0x13, pGame, 0)
  if (u32(m, pMercUnit) === 1) {
    const pMonData = u32(m, pMercUnit + 0x14)
    if (pMonData !== 0) {
      w8(m, pMonData + 0x04, 0)
      w8(m, pMonData + 0x09, 0)
      w8(m, pMonData + 0x0a, 0)
      w8(m, pMonData + 0x0b, 0)
      w8(m, pMonData + 0x05, 0)
    }
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FC71340
 * @ordinalOrName D2Game_6FC71340
 */
export function SKILLS_SrvDo_MonsterConvert_6FC71340_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC71340)
  const sgpt = readSgptDataTablesPtr(m)
  let pSkillsTxt = 0
  if (nSkillId >= 0 && sgpt !== 0 && nSkillId < i32(m, sgpt + 0xba0)) {
    pSkillsTxt = (u32(m, sgpt + 0xb98) + Math.imul(nSkillId, 0x23c)) >>> 0
  }
  if (nSkillId === 0 || pSkillsTxt === 0) return 0

  let nPetType = u8(m, pSkillsTxt + 0xbe)
  if (sgpt === 0 || nPetType >= i32(m, sgpt + 0xbf0)) {
    nPetType = 0
  }

  SUNIT_ValidatePathTargetUnit113c(m, pPlayerUnit, pGame)
  const pTarget = PATH_GetTargetUnit113c(m, u32(m, pPlayerUnit + 0x2c))
  if (
    pTarget === pPlayerUnit ||
    pTarget === 0 ||
    SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c(m, pTarget) === 0
  ) {
    return 0
  }

  SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c(m, pPlayerUnit, pGame)
  SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c(m, pTarget, pGame)

  const bExpansion = u8(m, pGame + 0x6a) !== 0 || u32(m, pGame + 0x74) !== 0 ? 1 : 0
  const pMonStatsBuf = K2_W12B1_SCRATCH_BASE + 0x260
  for (let i = 0; i < 14; i += 1) {
    w32(m, pMonStatsBuf + i * 4, 0)
  }

  const nTargetLvl = STATLIST_GetUnitStat113c(m, pTarget, 0x0c, 0)
  DATATBLS_CalculateMonsterStatsByLevel113c(
    m,
    i32(m, pTarget + 0x04),
    bExpansion,
    u8(m, pGame + 0x6d),
    nTargetLvl,
    1,
    pMonStatsBuf,
  )

  const nMinHp = i32(m, pMonStatsBuf + 0x00)
  const nMaxHp = i32(m, pMonStatsBuf + 0x04)
  const nRange = (nMaxHp - nMinHp + 1) | 0
  const nRoll = SEED_RollLimitedFast113c(m, (pTarget + 0x20) >>> 0, nRange)
  let nLife = ((nRoll + nMinHp) << 8) | 0
  STATLIST_SetUnitStat113c(m, pTarget, 7, nLife, 0)
  STATLIST_SetUnitStat113c(m, pTarget, 6, nLife, 0)

  const nPlrLvl = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0x0c, 0)
  const nMonLvl = STATLIST_GetUnitStat113c(m, pTarget, 0x0c, 0)
  if (nMonLvl !== 0 && nPlrLvl < nMonLvl) {
    nLife = mulDiv113c(nPlrLvl, nLife, nMonLvl)
    if (nLife < 1) nLife = 1
    STATLIST_SetUnitStat113c(m, pTarget, 7, nLife, 0)
    STATLIST_SetUnitStat113c(m, pTarget, 6, nLife, 0)
    STATLIST_SetUnitStat113c(m, pTarget, 0x0c, nPlrLvl, 0)
  }

  SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(
    m,
    pGame,
    pPlayerUnit,
    pTarget,
    nSkillId,
    nSkillLevel,
    0,
  )
  SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c(
    m,
    pPlayerUnit,
    pGame,
    pTarget,
    nSkillId,
    nSkillLevel,
  )

  const nMaxPets = SKILLS_EvalCalcByOffset113c(
    m,
    pPlayerUnit,
    i32(m, pSkillsTxt + 0xc0),
    nSkillId,
    nSkillLevel,
  )
  PETS_RegisterSummonPetAndClampCount_6FCB7F50_113c(
    m,
    nPetType,
    pPlayerUnit,
    pGame,
    pTarget,
    nMaxPets,
    0,
  )
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
    m,
    pGame,
    pTarget,
    u32(m, pPlayerUnit + 0xd0),
    0,
  )
  PATH_RefreshUnitCollisionPattern113c(m, pTarget)
  return 1
}

/**
 * @dll D2Game.dll
 * @va 0x6FC74420
 * @ordinalOrName D2Game_6FC74420
 */
export function ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c(
  m: SparseMemory113c,
  pItemUnit: number,
  pSocketTargetItem: number,
  pGame: number,
  pOwnerUnit: number,
): number {
  hitD2GameVa113c(0x6FC74420)
  const dwAnimMode = pItemUnit !== 0 ? i32(m, pItemUnit + 0x10) : 0
  if (dwAnimMode === 0) {
    UNITS_ChangeAnimMode113c(m, pItemUnit, 4)
    const nPosY = getUnitPosYInline113c(m, pItemUnit)
    const nPosX = getUnitPosXInline113c(m, pItemUnit)
    const dwItemGuid = u32(m, pItemUnit + 0x0c)
    if (
      ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c(
        m,
        0x6fd1c138,
        0x219,
        pGame,
        pOwnerUnit,
        dwItemGuid,
        nPosX,
        nPosY,
        0,
        0,
        0,
      ) !== 0
    ) {
      return 0
    }
    return 0x0d
  }

  if (dwAnimMode === 1) {
    const pInventory = u32(m, pOwnerUnit + 0x60)
    const nBodyLoc = ITEMS_GetBodyLocation113c(m, pItemUnit) & 0xff
    if (nBodyLoc === 0) return 0x0d
    if (INVENTORY_PlaceItemInBodyLoc113c(m, pInventory, pItemUnit, nBodyLoc) === 0) {
      return 0x0d
    }
    const nEquipFlag = nBodyLoc === 0x0b || nBodyLoc === 0x0c ? 4 : 3
    if (INVENTORY_PlaceItemInSocket113c(m, pInventory, pItemUnit, nEquipFlag) === 0) {
      return 0x0d
    }
    ITEMS_SetBodyLocation113c(m, pItemUnit, nBodyLoc)
    if (pItemUnit !== 0) {
      w32(m, pItemUnit + 0xc4, (u32(m, pItemUnit + 0xc4) & 0xfffffffd) >>> 0)
    }
    UNITS_ChangeAnimMode113c(m, pItemUnit, 1)
    ITEMS_SetInvPage113c(m, pItemUnit, 0xff)
    ITEMS_SetItemFlag113c(m, pItemUnit, 8, 1)
    if (pItemUnit !== 0) {
      w32(m, pItemUnit + 0xc4, (u32(m, pItemUnit + 0xc4) & 0xfdffffff) >>> 0)
    }
    INVENTORY_AppendItemGuidNode113c(m, pInventory, pItemUnit)
    UNITS_SetUnitUpdateFlags113c(m, pOwnerUnit, 1)
    QUESTS_TriggerItemDropped_6FC545A0_113c(m, pGame, pItemUnit, pOwnerUnit)
    return 0
  }

  if (dwAnimMode === 6) {
    if (pSocketTargetItem === 0) return 0x0d
    UNITS_ChangeAnimMode113c(m, pItemUnit, 4)
    const dwFillerGuid = pItemUnit !== 0 ? u32(m, pItemUnit + 0x0c) : 0xffffffff
    const dwTargetGuid = u32(m, pSocketTargetItem + 0x0c)
    const pOutOk = K2_W12B1_SCRATCH_BASE + 0x2a0
    w32(m, pOutOk, 0)
    if (
      ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(
        m,
        dwFillerGuid,
        pGame,
        pOwnerUnit,
        dwTargetGuid,
        pOutOk,
        0,
        1,
        0,
        0,
      ) !== 0
    ) {
      return 0
    }
    return 0x0d
  }

  return 0x0d
}

/**
 * [11/34] Dispatches item placement for a loaded player item according to its animation mode (`0..6`).
 *
 * @dll D2Game.dll
 * @va 0x6FC745D0
 * @ordinalOrName D2Game_6FC745D0
 */
export function ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c(
  m: SparseMemory113c,
  pSocketTargetItem: number,
  pItemUnit: number,
  pOwnerUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC745D0)
  const dwAnimMode = pItemUnit !== 0 ? i32(m, pItemUnit + 0x10) : 0
  const pOutErr = (K2_W12B1_SCRATCH_BASE + 0x230) >>> 0
  w32(m, pOutErr, 0)
  switch (dwAnimMode) {
    case 0: {
      UNITS_ChangeAnimMode113c(m, pItemUnit, 4)
      const dwGuid = pItemUnit !== 0 ? u32(m, pItemUnit + 0x0c) : 0xffffffff
      const nY = UNIT_GetPosY113c(m, pItemUnit)
      const nX = UNIT_GetPosX113c(m, pItemUnit)
      const bPlaced = ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c(
        m,
        0x6fd1c138,
        0x140,
        pGame,
        pOwnerUnit,
        dwGuid,
        nX,
        nY,
        0,
        1,
        0,
      )
      return bPlaced !== 0 ? 0 : 0x0c
    }
    case 1: {
      UNITS_ChangeAnimMode113c(m, pItemUnit, 4)
      const dwGuid = pItemUnit !== 0 ? u32(m, pItemUnit + 0x0c) : 0xffffffff
      const bBodyLoc = ITEMS_GetBodyLocation113c(m, pItemUnit) & 0xff
      const bEquipped = ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c(
        m,
        dwGuid,
        pOwnerUnit,
        pGame,
        bBodyLoc,
        1,
        pOutErr,
      )
      return bEquipped !== 0 ? 0 : 0x0c
    }
    case 2: {
      UNITS_ChangeAnimMode113c(m, pItemUnit, 4)
      const dwGuid = pItemUnit !== 0 ? u32(m, pItemUnit + 0x0c) : 0xffffffff
      const nX = UNIT_GetPosX113c(m, pItemUnit)
      const bBelt = ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c(
        m,
        dwGuid,
        pGame,
        pOwnerUnit,
        nX,
        0,
        pOutErr,
      )
      return bBelt !== 0 ? 0 : 0x0c
    }
    case 4: {
      UNITS_ChangeAnimMode113c(m, pItemUnit, 4)
      INVENTORY_SetCursorItem113c(m, u32(m, pOwnerUnit + 0x60), pItemUnit)
      const bCursor = ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(m, pOwnerUnit, pItemUnit)
      return bCursor !== 0 ? 0 : 0x0c
    }
    case 6: {
      UNITS_ChangeAnimMode113c(m, pItemUnit, 4)
      if (pSocketTargetItem === 0) return 0x0c
      const dwTargetGuid = u32(m, pSocketTargetItem + 0x0c)
      const dwItemGuid = pItemUnit !== 0 ? u32(m, pItemUnit + 0x0c) : 0xffffffff
      const bSocketed = ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(
        m,
        dwItemGuid,
        pGame,
        pOwnerUnit,
        dwTargetGuid,
        pOutErr,
        0,
        0,
        0,
        0,
      )
      return bSocketed !== 0 ? 0 : 0x0c
    }
    default:
      return 0x0c
  }
}

/**
 * [12/34] Deserializes a `JM`-prefixed item list stream, places each item and socketed sub-item, and validates runeword flags.
 *
 * @dll D2Game.dll
 * @va 0x6FC74810
 * @ordinalOrName D2Game_6FC74810
 */
export function ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c(
  m: SparseMemory113c,
  pBitstream: number,
  pGame: number,
  pOwnerUnit: number,
  nSaveVersion: number,
  nMaxBufferSize: number,
  bIsMercOrDirect: number,
  pOutBytesRead: number,
): number {
  hitD2GameVa113c(0x6FC74810)
  if (u16(m, pBitstream) !== 0x4d4a) return 0x0e
  const nItemCount = u16(m, pBitstream + 2)
  let pCur = (pBitstream + 4) >>> 0
  const pHeader = (K2_W12B1_SCRATCH_BASE + 0x240) >>> 0
  const pBytesRead = (K2_W12B1_SCRATCH_BASE + 0x268) >>> 0

  for (let i = 0; i < nItemCount; i += 1) {
    const nRem = (pBitstream + nMaxBufferSize - pCur) | 0
    ITEMS_DecodeItemCompactBitstream113c(m, pCur, nRem, 1, pHeader, nSaveVersion)
    if (i32(m, pHeader + 0x00) === -1) return 0x0e

    w32(m, pBytesRead, 0)
    const pItem = ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
      m,
      pGame,
      pHeader,
      0,
      pCur,
      nRem,
      1,
      pBytesRead,
      nSaveVersion,
    )
    const nStep = i32(m, pBytesRead)
    if (pItem === 0 && nStep <= 0) return 0x0e
    pCur = (pCur + nStep) >>> 0

    let nPlaceErr = 0
    if (pItem !== 0) {
      nPlaceErr =
        bIsMercOrDirect !== 0
          ? ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c(m, pItem, 0, pGame, pOwnerUnit)
          : ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c(m, 0, pItem, pOwnerUnit, pGame)
    }

    const nSocketedCount = i32(m, pHeader + 0x14)
    let pParentItem = pItem
    if (nPlaceErr !== 0) {
      if (pItem !== 0) {
        SUNIT_FreeUnit113c(m, pGame, pItem)
      }
      pParentItem = 0
    }

    for (let s = 0; s < nSocketedCount; s += 1) {
      const nSubRem = (pBitstream + nMaxBufferSize - pCur) | 0
      ITEMS_DecodeItemCompactBitstream113c(m, pCur, nSubRem, 1, pHeader, nSaveVersion)
      w32(m, pBytesRead, 0)
      const pSubItem = ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c(
        m,
        pGame,
        pHeader,
        0,
        pCur,
        nSubRem,
        1,
        pBytesRead,
        nSaveVersion,
      )
      const nSubStep = i32(m, pBytesRead)
      if (pSubItem === 0 && nSubStep <= 0) return 0x0e
      pCur = (pCur + nSubStep) >>> 0

      if (pParentItem === 0) {
        if (pSubItem !== 0) {
          SUNIT_FreeUnit113c(m, pGame, pSubItem)
        }
      } else if (pSubItem !== 0) {
        if (bIsMercOrDirect !== 0) {
          ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c(
            m,
            pSubItem,
            pParentItem,
            pGame,
            pOwnerUnit,
          )
        } else {
          ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c(
            m,
            pParentItem,
            pSubItem,
            pOwnerUnit,
            pGame,
          )
        }
      }
    }

    if (
      pParentItem !== 0 &&
      (ITEMS_GetCommandFlags113c(m, pParentItem) & 0x04000000) !== 0 &&
      ITEMS_FindMatchingRunesTxtRecord113c(m, pParentItem) === 0
    ) {
      ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c(m, pParentItem, pOwnerUnit, pGame)
    }
  }

  if (pOutBytesRead !== 0) {
    w32(m, pOutBytesRead, (pCur - pBitstream) >>> 0)
  }
  return 0
}

/**
 * [13/34] Object operate handler for dungeon stair/warp objects that open on mode 0 and warp through room tile units on mode 2.
 *
 * @dll D2Game.dll
 * @va 0x6FC8BCB0
 * @ordinalOrName D2Game_6FC8BCB0
 */
export function OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8BCB0)
  const pObj = u32(m, pOperateArgs + 4)
  UNITS_GetRoom113c(m, pObj)
  PATH_GetTargetTypeAndPosition113c(m, pObj, (K2_W12B1_SCRATCH_BASE + 0x270) >>> 0)
  UNITS_GetUnitSizeX113c(m, pObj)
  UNITS_GetUnitSizeY113c(m, pObj)

  const nMode = pObj !== 0 ? i32(m, pObj + 0x10) : 0
  if (nMode === 0) {
    UNITS_ChangeAnimMode113c(m, pObj, 2)
    return 1
  }
  if (nMode === 2) {
    const pRoom = UNITS_GetRoom113c(m, pObj)
    let pUnit = u32(m, pRoom + 0x74)
    while (pUnit !== 0 && u32(m, pUnit) !== 5) {
      pUnit = u32(m, pUnit + 0xe8)
    }
    if (pUnit === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Game\\Objects\\ObjEval.cpp', 0x40e)
    }
    DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c(
      m,
      pUnit,
      u32(m, pOperateArgs + 8),
      u32(m, pOperateArgs),
    )
  }
  return 1
}

/**
 * [14/34] Object operate handler that finds a paired object of the same class ID in the current or adjacent rooms and teleports the player to it.
 *
 * @dll D2Game.dll
 * @va 0x6FC8BE40
 * @ordinalOrName D2Game_6FC8BE40
 */
export function OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8BE40)
  const pObj = u32(m, pOperateArgs + 4)
  const pRoom = UNITS_GetRoom113c(m, pObj)
  if (pRoom === 0) return 0

  let pUnit = u32(m, pRoom + 0x74)
  const nClassId = pObj !== 0 ? i32(m, pObj + 4) : -1
  while (pUnit !== 0) {
    if (u32(m, pUnit) === 2 && pUnit !== pObj && i32(m, pUnit + 4) === nClassId) {
      OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c(m, pUnit, u32(m, pOperateArgs + 8), pRoom)
      return 0
    }
    pUnit = u32(m, pUnit + 0xe8)
  }

  const pAdjListPtr = (K2_W12B1_SCRATCH_BASE + 0x278) >>> 0
  const pAdjCountPtr = (K2_W12B1_SCRATCH_BASE + 0x27c) >>> 0
  w32(m, pAdjListPtr, 0)
  w32(m, pAdjCountPtr, 0)
  DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, pAdjListPtr, pAdjCountPtr)
  const pAdjList = u32(m, pAdjListPtr)
  const nAdjCount = i32(m, pAdjCountPtr)
  for (let i = 0; i < nAdjCount; i += 1) {
    const pAdjRoom = u32(m, pAdjList + i * 4)
    if (pAdjRoom !== pRoom) {
      let pCand = u32(m, pAdjRoom + 0x74)
      while (pCand !== 0) {
        if (u32(m, pCand) === 2 && pCand !== pObj && i32(m, pCand + 4) === nClassId) {
          OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c(m, pCand, u32(m, pOperateArgs + 8), pAdjRoom)
          return 0
        }
        pCand = u32(m, pCand + 0xe8)
      }
    }
  }
  return 0
}

/**
 * [15/34] Object operate handler for trapdoors that schedules mode transition event 1 on mode 0 and warps via room/adjacent tile unit on mode 2.
 *
 * @dll D2Game.dll
 * @va 0x6FC8DFC0
 * @ordinalOrName D2Game_6FC8DFC0
 */
export function OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8DFC0)
  const pObj = u32(m, pOperateArgs + 4)
  const pRoom = UNITS_GetRoom113c(m, pObj)
  PATH_GetTargetTypeAndPosition113c(m, pObj, (K2_W12B1_SCRATCH_BASE + 0x280) >>> 0)
  UNITS_GetUnitSizeX113c(m, pObj)
  UNITS_GetUnitSizeY113c(m, pObj)

  const nMode = pObj !== 0 ? i32(m, pObj + 0x10) : 0
  if (nMode === 0) {
    UNITS_ChangeAnimMode113c(m, pObj, 1)
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, i32(m, pOperateArgs + 0x10))
    const pGame = u32(m, pOperateArgs)
    const nFrame = (i32(m, pGame + 0xa8) + (u32(m, pObjTxt + 0xdc) >>> 8) + 1) | 0
    EVENT_SetEventFull113c(m, pGame, pObj, 1, nFrame, 0, 0, 0)
    return 1
  }
  if (nMode === 2) {
    let pTile = u32(m, pRoom + 0x74)
    while (pTile !== 0 && u32(m, pTile) !== 5) {
      pTile = u32(m, pTile + 0xe8)
    }
    if (pTile === 0) {
      const pAdjListPtr = (K2_W12B1_SCRATCH_BASE + 0x288) >>> 0
      const pAdjCountPtr = (K2_W12B1_SCRATCH_BASE + 0x28c) >>> 0
      w32(m, pAdjListPtr, 0)
      w32(m, pAdjCountPtr, 0)
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, pAdjListPtr, pAdjCountPtr)
      const pAdjList = u32(m, pAdjListPtr)
      const nAdjCount = i32(m, pAdjCountPtr)
      for (let i = 0; i < nAdjCount; i += 1) {
        const pAdjRoom = u32(m, pAdjList + i * 4)
        if (pAdjRoom === pRoom) continue
        let pCand = u32(m, pAdjRoom + 0x74)
        while (pCand !== 0) {
          if (u32(m, pCand) === 5) {
            pTile = pCand
            break
          }
          pCand = u32(m, pCand + 0xe8)
        }
        if (pTile !== 0) break
      }
      if (pTile === 0) return 1
    }
    DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c(
      m,
      pTile,
      u32(m, pOperateArgs + 8),
      u32(m, pOperateArgs),
    )
  }
  return 1
}

/**
 * [16/34] Object operate handler for sparkly/trapped chests that drops treasure, rolls monster ambush from RegPop table, and triggers traps.
 *
 * @dll D2Game.dll
 * @va 0x6FC8EDB0
 * @ordinalOrName D2Game_6FC8EDB0
 */
export function OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8EDB0)
  const pObj = u32(m, pOperateArgs + 0x04)
  if (pObj !== 0 && u32(m, pObj + 0x10) !== 0) {
    return 1
  }
  if (OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOperateArgs, 0) === 0) {
    return 1
  }

  const pRoomInit = UNITS_GetRoom113c(m, u32(m, pOperateArgs + 0x04))
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoomInit)
  UNITS_ChangeAnimMode113c(m, u32(m, pOperateArgs + 0x04), 1)

  const pObjAfterMode = u32(m, pOperateArgs + 0x04)
  if (pObjAfterMode !== 0) {
    w32(m, pObjAfterMode + 0xc4, (u32(m, pObjAfterMode + 0xc4) & 0xfffffffd) >>> 0)
  }

  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, i32(m, pOperateArgs + 0x10))
  const pGame = u32(m, pOperateArgs)
  const nFrame = (i32(m, pGame + 0xa8) + (u32(m, pObjTxt + 0xdc) >>> 8) + 1) | 0
  EVENT_SetEventFull113c(m, pGame, u32(m, pOperateArgs + 0x04), 1, nFrame, 0, 0, 0)

  const pSeed = u32(m, pOperateArgs + 0x0c)
  const mul = BigInt(u32(m, pSeed)) * 0x6ac690c5n + BigInt(u32(m, pSeed + 0x04))
  const newLow = Number(mul & 0xffffffffn) >>> 0
  const newHigh = Number((mul >> 32n) & 0xffffffffn) >>> 0
  w32(m, pSeed + 0x04, newHigh)
  w32(m, pSeed, newLow)
  const rem = (newLow >>> 0) % 0xff

  if (rem >>> 0 <= u32(m, pObjTxt + 0x194) >>> 0) {
    const pRegPop = u32(m, pGame + nLevelId * 4 + 0xf0)
    const nMonCount = u8(m, pRegPop + 0x10)
    if (nMonCount > 0) {
      let pEntry = (pRegPop + 0x14) >>> 0
      for (let i = 0; i < nMonCount; i += 1) {
        const nMonId = i16(m, pEntry)
        if (MONSTATS2_CheckModeBit113c(m, nMonId, 2) !== 0) {
          const pRoom = UNITS_GetRoom113c(m, u32(m, pOperateArgs + 0x04))
          const pMonster = MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
            m,
            nMonId,
            0,
            1,
            pGame,
            pRoom,
            0,
            0,
            -1,
          )
          if (pMonster !== 0) {
            MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(m, pGame, pMonster, 1)
            MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 1, pRoom, pGame, pMonster)
          }
          break
        }
        pEntry = (pEntry + 0x34) >>> 0
      }
    }
  }

  if (u8(m, pObjTxt + 0x121) === 0) {
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, u32(m, pOperateArgs + 0x04))
  }

  const pObjFinal = u32(m, pOperateArgs + 0x04)
  const pObjData = u32(m, pObjFinal + 0x14)
  const nTrapType = u8(m, pObjData + 0x04) & 0x7f
  OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c(m, pOperateArgs, nTrapType)
  return 1
}

/**
 * [17/34] Restores a player's inventory items and gold from their saved trade snapshot record.
 *
 * @dll D2Game.dll
 * @va 0x6FC915E0
 * @ordinalOrName D2Game_6FC915E0
 */
export function PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot_6FC915E0_113c(
  m: SparseMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC915E0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Player\\PlrTrade.cpp', 0x87d)
  }

  for (let nLoc = 1; nLoc < 0x0d; nLoc += 1) {
    INVENTORY_NoOpRet8B113c(m, u32(m, pPlayerUnit + 0x60), nLoc)
  }

  const pTradeRecord = u32(m, pPlayerData + 0x5c)
  if (pTradeRecord === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Player\\PlrTrade.cpp', 0x885)
  }

  let pEvent = u32(m, pPlayerUnit + 0xdc)
  while (pEvent !== 0) {
    const pNext = u32(m, pEvent + 0x24)
    if (u8(m, pEvent) === 9) {
      EVENT_FreeNode113c(m, pGame, pEvent)
    }
    pEvent = pNext
  }

  const pOutBytesRead = (K2_W12B1_SCRATCH_BASE + 0x2b0) >>> 0
  w32(m, pOutBytesRead, 0)
  ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c(
    m,
    u32(m, pTradeRecord + 0x04),
    pGame,
    pPlayerUnit,
    0x60,
    0x2000,
    0,
    pOutBytesRead,
  )

  const nCurGold = STATLIST_GetUnitStat113c(m, pPlayerUnit, 0x0e, 0)
  const nAnimMode = i32(m, pPlayerUnit + 0x10)
  if (nCurGold > 0 && nAnimMode !== 0 && nAnimMode !== 0x11) {
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayerUnit, 0x0e, (-nCurGold) | 0)
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(
      m,
      pPlayerUnit,
      0x0e,
      i32(m, pTradeRecord + 0x10),
    )
  }
}

/**
 * [18/34] Rolls back a player's current inventory and cursor items and restores their pre-trade snapshot.
 *
 * @dll D2Game.dll
 * @va 0x6FC916D0
 * @ordinalOrName D2Game_6FC916D0
 */
export function PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FC916D0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  if (u32(m, pPlayerData + 0x5c) === 0) {
    return
  }

  let dwPlayerGuid = 0xffffffff
  let pClient = 0
  if (pPlayerUnit !== 0) {
    dwPlayerGuid = u32(m, pPlayerUnit + 0x0c)
    if (u32(m, pPlayerUnit) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, pPlayerUnit)
      pClient = u32(m, pPlrData + 0x9c)
    }
  }

  const pPkt92 = (K2_W12B1_SCRATCH_BASE + 0x2b8) >>> 0
  w8(m, pPkt92, 0x92)
  w8(m, pPkt92 + 1, 0x00)
  w32(m, pPkt92 + 2, dwPlayerGuid)
  NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt92, 6)

  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    pGame,
    PLRTRADE_BroadcastClearMercUnitCallback113c,
    pPlayerUnit,
  )

  let pNode = INVENTORY_GetFirstItem113c(m, u32(m, pPlayerUnit + 0x60))
  while (pNode !== 0) {
    const pItem = INVENTORY_UnitIsItem113c(m, pNode)
    const pNext = INVENTORY_GetNextItem113c(m, pNode)
    if (pItem !== 0 && u32(m, pItem) === 4) {
      if (i32(m, pItem + 0x10) === 0) {
        ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c(m, pItem, pPlayerUnit)
      }
      INVENTORY_AppendItemGuidNode113c(m, u32(m, pPlayerUnit + 0x60), pItem)
      ITEMS_SetItemFlag113c(m, pItem, 1, 1)
    }
    pNode = pNext
  }

  const pCursorItem = INVENTORY_GetCursorItem113c(m, u32(m, pPlayerUnit + 0x60))
  if (pCursorItem !== 0 && u32(m, pCursorItem) === 4) {
    INVENTORY_AppendItemGuidNode113c(m, u32(m, pPlayerUnit + 0x60), pCursorItem)
    ITEMS_SetItemFlag113c(m, pCursorItem, 1, 1)
  }

  ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c(m, pPlayerUnit, pGame)
  PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot_6FC915E0_113c(m, pPlayerUnit, pGame)
}

/**
 * [19/34] Aborts an active player-to-player trade, rolls back both players' items/gold, sends `0x77` (`0x0c`), and schedules event `0x0d`.
 *
 * @dll D2Game.dll
 * @va 0x6FC919A0
 * @ordinalOrName D2Game_6FC919A0
 */
export function PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer1: number,
  pPlayer2: number,
  pPlrData1: number,
  pPlrData2: number,
  nTradeState1: number,
): void {
  hitD2GameVa113c(0x6FC919A0)
  UNITS_SetUnitUpdateFlags113c(m, pPlayer1, 1)
  UNITS_SetUnitUpdateFlags113c(m, pPlayer2, 1)

  if (pPlayer1 !== 0) {
    w32(m, pPlayer1 + 0xc8, (u32(m, pPlayer1 + 0xc8) | 0x800000) >>> 0)
  }
  if (pPlayer2 !== 0) {
    w32(m, pPlayer2 + 0xc8, (u32(m, pPlayer2 + 0xc8) | 0x800000) >>> 0)
  }

  w32(m, pPlayer1 + 0x64, 0xffffffff)
  w32(m, pPlayer1 + 0x68, 6)
  w8(m, pPlayer1 + 0x6c, 0)
  w32(m, pPlayer2 + 0x64, 0xffffffff)
  w32(m, pPlayer2 + 0x68, 6)
  w8(m, pPlayer2 + 0x6c, 0)

  PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c(m, pGame, pPlayer1)
  PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c(m, pGame, pPlayer2)
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pPlayer1, pGame)
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pPlayer2, pGame)

  w32(m, pPlrData1 + 0x50, nTradeState1 >>> 0)
  w32(m, pPlrData2 + 0x50, 9)

  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pPlayer1)
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, pPlayer2)

  const pPkt77 = (K2_W12B1_SCRATCH_BASE + 0x2c0) >>> 0
  const pClient1 =
    u32(m, pPlayer1) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPlayer1) + 0x9c) : 0
  w8(m, pPkt77, 0x77)
  w8(m, pPkt77 + 1, 0x0c)
  NET_QueuePacketToClientBuffer113c(m, pClient1, 1, pPkt77, 2)

  const pClient2 =
    u32(m, pPlayer2) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPlayer2) + 0x9c) : 0
  w8(m, pPkt77, 0x77)
  w8(m, pPkt77 + 1, 0x0c)
  NET_QueuePacketToClientBuffer113c(m, pClient2, 1, pPkt77, 2)

  let pEvent1 = u32(m, pPlayer1 + 0xdc)
  while (pEvent1 !== 0) {
    const pNext = u32(m, pEvent1 + 0x24)
    if (u8(m, pEvent1) === 0x0d) {
      EVENT_FreeNode113c(m, pGame, pEvent1)
    }
    pEvent1 = pNext
  }

  let pEvent2 = u32(m, pPlayer2 + 0xdc)
  while (pEvent2 !== 0) {
    const pNext = u32(m, pEvent2 + 0x24)
    if (u8(m, pEvent2) === 0x0d) {
      EVENT_FreeNode113c(m, pGame, pEvent2)
    }
    pEvent2 = pNext
  }

  EVENT_SetEventFull113c(m, pGame, pPlayer1, 0x0d, (i32(m, pGame + 0xa8) + 1) | 0, 0, 0, 0)
  EVENT_SetEventFull113c(m, pGame, pPlayer2, 0x0d, (i32(m, pGame + 0xa8) + 1) | 0, 0, 0, 0)
}

/**
 * [20/34] Duplicates a trade-box item (and socketed sub-items) into the trade partner's trade grid and resets trade accept state if needed.
 *
 * @dll D2Game.dll
 * @va 0x6FC91B00
 * @ordinalOrName D2Game_6FC91B00
 */
export function PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c(
  m: SparseMemory113c,
  pItemUnit: number,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FC91B00)
  const pPkt = (K2_W12B1_SCRATCH_BASE + 0x2c8) >>> 0
  const dwPartnerGuid = u32(m, pPlayerUnit + 0x64)
  if (u8(m, pPlayerUnit + 0x6c) !== 0 && u32(m, pPlayerUnit + 0x68) !== 0) {
    const pClient =
      u32(m, pPlayerUnit) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) : 0
    w8(m, pPkt, 0x77)
    w8(m, pPkt + 1, 0x0c)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 2)
    return
  }

  if (pGame === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Player\\PlrTrade.cpp', 0x2d3)
  }

  let pPartnerUnit = u32(m, pGame + 0x1120 + (dwPartnerGuid & 0x7f) * 4)
  while (pPartnerUnit !== 0 && u32(m, pPartnerUnit + 0x0c) !== dwPartnerGuid) {
    pPartnerUnit = u32(m, pPartnerUnit + 0xe4)
  }

  if (pPartnerUnit === 0) {
    const pClient =
      u32(m, pPlayerUnit) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) : 0
    w8(m, pPkt, 0x77)
    w8(m, pPkt + 1, 0x0c)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 2)
    return
  }

  const pDupItem = ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, pGame, pItemUnit, 0)
  const nPosX = getUnitPosXInline113c(m, pItemUnit)
  const nPosY = getUnitPosYInline113c(m, pItemUnit)

  UNITS_ChangeAnimMode113c(m, pDupItem, 4)
  ITEMS_SetInvPage113c(m, pDupItem, 1)

  const dwDupGuid = pDupItem !== 0 ? u32(m, pDupItem + 0x0c) : 0xffffffff
  const bPlaced = ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c(
    m,
    0x6fd1bd3c,
    0xcaa,
    pGame,
    pPartnerUnit,
    dwDupGuid,
    nPosX,
    nPosY,
    0,
    1,
    0,
  )

  if (bPlaced === 0) {
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      pGame,
      ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c,
      pDupItem,
    )
    SUNIT_FreeUnit113c(m, pGame, pDupItem)
    const pPlrData1 = UNITS_GetPlayerData113c(m, pPlayerUnit)
    const pPlrData2 = UNITS_GetPlayerData113c(m, pPartnerUnit)
    PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(
      m,
      pGame,
      pPlayerUnit,
      pPartnerUnit,
      pPlrData1,
      pPlrData2,
      9,
    )
    return
  }

  if (u32(m, pItemUnit) === 4 && ITEMS_GetSubTypeFromItem113c(m, pItemUnit) !== 0) {
    const pItemInv = u32(m, pItemUnit + 0x60)
    if (pItemInv !== 0 && INVENTORY_GetItemCount113c(m, pItemInv) !== 0) {
      ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c(
        m,
        pItemUnit,
        pGame,
        pPartnerUnit,
        pDupItem,
        1,
      )
    }
  }

  const dwDupGuidFinal = pDupItem !== 0 ? u32(m, pDupItem + 0x0c) : 0xffffffff
  const dwSrcGuid = u32(m, pItemUnit + 0x0c)
  PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c(m, pPlayerUnit, pGame, dwSrcGuid, dwDupGuidFinal)

  const pPlrData1 = UNITS_GetPlayerData113c(m, pPlayerUnit)
  const pPlrData2 = UNITS_GetPlayerData113c(m, pPartnerUnit)
  if (i32(m, pPlrData1 + 0x50) === 4 || i32(m, pPlrData2 + 0x50) === 4) {
    const pClient1 =
      u32(m, pPlayerUnit) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) : 0
    w8(m, pPkt, 0x79)
    w8(m, pPkt + 1, 0x00)
    w32(m, pPkt + 2, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient1, 1, pPkt, 6)

    const pClient1b =
      u32(m, pPlayerUnit) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPlayerUnit) + 0x9c) : 0
    w8(m, pPkt, 0x79)
    w8(m, pPkt + 1, 0x01)
    w32(m, pPkt + 2, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient1b, 1, pPkt, 6)

    const pClient2 =
      u32(m, pPartnerUnit) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPartnerUnit) + 0x9c) : 0
    w8(m, pPkt, 0x79)
    w8(m, pPkt + 1, 0x00)
    w32(m, pPkt + 2, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient2, 1, pPkt, 6)

    const pClient2b =
      u32(m, pPartnerUnit) === 0 ? u32(m, UNITS_GetPlayerData113c(m, pPartnerUnit) + 0x9c) : 0
    w8(m, pPkt, 0x79)
    w8(m, pPkt + 1, 0x01)
    w32(m, pPkt + 2, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient2b, 1, pPkt, 6)

    PLRTRADE_SendTradeAcceptButtonAndSetState3_113c(
      m,
      pPlayerUnit,
      pPartnerUnit,
      pPlrData1,
      pPlrData2,
    )
  }
}

/**
 * [21/34] Sand Maggot AI think callback.
 *
 * @dll D2Game.dll
 * @va 0x6FCA9870
 * @ordinalOrName D2Game_6FCA9870
 */
export function AI_Think_SandMaggot_6FCA9870_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCA9870)
  const pTarget = u32(m, pAiTickArgs + 0x08)
  const nTargetDist = i32(m, pAiTickArgs + 0x14)
  const bInCombat = u32(m, pAiTickArgs + 0x18)
  const pMonStatsTxt = u32(m, pAiTickArgs + 0x1c)
  const pAiControl = u32(m, pAiTickArgs)
  const nAiState = i32(m, pAiControl + 0x1c)
  const pSeed = (pUnit + 0x20) >>> 0

  if (nAiState === 0) {
    const wSkill1 = i16(m, pMonStatsTxt + 0x170)
    if (wSkill1 >= 0 && nTargetDist > 12) {
      AI_CastSkillWithMode113c(
        m,
        u8(m, pMonStatsTxt + 0x180),
        pUnit,
        pGame,
        wSkill1,
        pTarget,
        0,
        0,
      )
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 8)
      w32(m, pAiControl + 0x1c, 1)
      AI_UnburrowAndScheduleThink_6FC9BE10_113c(m, pGame, pUnit)
      return
    }
    const wSkill2 = i16(m, pMonStatsTxt + 0x172)
    if (wSkill2 >= 0 && MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pUnit, pGame) !== 0) {
      AI_CastSkillWithMode113c(
        m,
        u8(m, pMonStatsTxt + 0x181),
        pUnit,
        pGame,
        wSkill2,
        pUnit,
        0,
        0,
      )
      w32(m, pAiControl + 0x1c, 2)
      return
    }
    const nUnitY = getUnitPosYInline113c(m, pUnit)
    const nUnitX = getUnitPosXInline113c(m, pUnit)
    const pRoom = UNITS_GetRoom113c(m, pUnit)
    if ((COLLISION_CheckSubtileMask113c(m, pRoom, nUnitX, nUnitY, 0x0c01) & 0xffff) === 0) {
      w32(m, pAiControl + 0x1c, 2)
    }
    AI_Stall113c(m, pGame, pUnit, 0x0c)
    return
  }

  if (nAiState === 1) {
    const wSkill2 = i16(m, pMonStatsTxt + 0x172)
    if (wSkill2 >= 0) {
      const nDiff = u8(m, pGame + 0x6d)
      if (
        nTargetDist < i16(m, pMonStatsTxt + nDiff * 2 + 0x80) &&
        MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pUnit, pGame) !== 0
      ) {
        AI_CastSkillWithMode113c(
          m,
          u8(m, pMonStatsTxt + 0x181),
          pUnit,
          pGame,
          wSkill2,
          pUnit,
          0,
          0,
        )
        w32(m, pAiControl + 0x1c, 2)
        return
      }
      if (
        nTargetDist < 0x14 &&
        i32(m, pAiControl + 0x18) > 0x40 &&
        MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pUnit, pGame) !== 0
      ) {
        AI_CastSkillWithMode113c(
          m,
          u8(m, pMonStatsTxt + 0x181),
          pUnit,
          pGame,
          wSkill2,
          pUnit,
          0,
          0,
        )
        w32(m, pAiControl + 0x1c, 2)
        return
      }
    }
    AI_UnburrowAndScheduleThink_6FC9BE10_113c(m, pGame, pUnit)
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x18)
    w32(m, pAiControl + 0x1c, 1)
    w32(m, pAiControl + 0x18, (i32(m, pAiControl + 0x18) + 1) >>> 0)
    return
  }

  if (pTarget === 0) {
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x20)
    return
  }

  if (bInCombat !== 0) {
    if (seedRoll(unitSeedOf(m, pSeed), 100) < i16(m, pMonStatsTxt + u8(m, pGame + 0x6d) * 2 + 0x5c)) {
      AI_StartAttackMode113c(m, 5, pUnit, pGame, pTarget)
      return
    }
    if (seedRoll(unitSeedOf(m, pSeed), 100) < i16(m, pMonStatsTxt + u8(m, pGame + 0x6d) * 2 + 0x56)) {
      AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget)
      return
    }
    const nDiff = u8(m, pGame + 0x6d)
    if (seedRoll(unitSeedOf(m, pSeed), 100) < i16(m, pMonStatsTxt + nDiff * 2 + 0x62)) {
      AI_CircleStrafeTarget_6FD126B0_113c(m, pUnit, 0, pGame, pTarget, 3)
      return
    }
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, i16(m, pMonStatsTxt + nDiff * 2 + 0x7a))
    return
  }

  if (nTargetDist < i16(m, pMonStatsTxt + u8(m, pGame + 0x6d) * 2 + 0x74)) {
    if (seedRoll(unitSeedOf(m, pSeed), 100) < i16(m, pMonStatsTxt + u8(m, pGame + 0x6d) * 2 + 0x6e)) {
      AI_StartAttackMode113c(m, 5, pUnit, pGame, pTarget)
      return
    }
    const nDiff = u8(m, pGame + 0x6d)
    if (seedRoll(unitSeedOf(m, pSeed), 100) < i16(m, pMonStatsTxt + nDiff * 2 + 0x68)) {
      AI_CircleStrafeTarget_6FD126B0_113c(m, pUnit, 0, pGame, pTarget, 4)
      return
    }
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, i16(m, pMonStatsTxt + nDiff * 2 + 0x7a))
    return
  }

  if (seedRoll(unitSeedOf(m, pSeed), 100) < i16(m, pMonStatsTxt + u8(m, pGame + 0x6d) * 2 + 0x68)) {
    AI_CircleStrafeTarget_6FD126B0_113c(m, pUnit, 0, pGame, pTarget, 3)
    return
  }
  AI_ApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 4, 0)
}

/**
 * [22/34] Burrowing Scarab / Frog AI think callback.
 *
 * @dll D2Game.dll
 * @va 0x6FCA9C30
 * @ordinalOrName D2Game_6FCA9C30
 */
export function AI_Think_BurrowingScarabOrFrog_6FCA9C30_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCA9C30)
  const pAiControl = u32(m, pAiTickArgs)
  const pTarget = u32(m, pAiTickArgs + 0x08)
  const nTargetDist = i32(m, pAiTickArgs + 0x14)
  const bInCombat = u32(m, pAiTickArgs + 0x18)
  const pMonStatsTxt = u32(m, pAiTickArgs + 0x1c)
  let nState = i32(m, pAiControl + 0x14)
  const pSeed = (pUnit + 0x20) >>> 0

  if (pTarget === 0) {
    if (nState < 1) {
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
      return
    }
    if (MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pUnit, pGame) !== 0) {
      AI_StepRelativeToTargetUnit113c(m, pGame, pUnit, pUnit, 2, 9, 3)
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
      w32(m, pAiControl + 0x14, 0xffffffff)
      return
    }
  }

  const nSqDist = UNIT_CalcSqDistSubtiles113c(m, pUnit, pTarget) | 0
  const bFar = nSqDist > 0x90 ? 1 : 0
  if (pTarget !== 0) {
    const pTargetRoom = UNITS_GetRoom113c(m, pTarget)
    const pUnitRoom = UNITS_GetRoom113c(m, pUnit)
    if (pTargetRoom !== pUnitRoom && bFar !== 0) {
      if (nState < 1) {
        AI_StepRelativeToTargetUnit113c(m, pGame, pUnit, pTarget, 9, 2, 0)
        return
      }
      if (MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pUnit, pGame) !== 0) {
        AI_StepRelativeToTargetUnit113c(m, pGame, pUnit, pUnit, 2, 9, 3)
        AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
        w32(m, pAiControl + 0x14, 0xffffffff)
        return
      }
    }
  }

  if (nState === 0) {
    let pOwner = 0
    if (pUnit !== 0 && u32(m, pUnit) === 1) {
      const pMonData = u32(m, pUnit + 0x14)
      if (pMonData !== 0) {
        const pAiGen = u32(m, pMonData + 0x28)
        if (pAiGen !== 0) {
          const pOwnerGame = u32(m, pAiGen + 0x28)
          if (pOwnerGame !== 0) {
            pOwner = SUNIT_GetServerUnit113c(
              m,
              pOwnerGame,
              u32(m, pAiGen + 0x30),
              u32(m, pAiGen + 0x2c),
            )
          }
        }
      }
    }
    if (pOwner === 0 && pTarget !== 0 && bFar !== 0) {
      if (seedRoll(unitSeedOf(m, pSeed), 100) < 0x3c) {
        AI_UnburrowAndScheduleThink_6FC9BE10_113c(m, pGame, pUnit)
        const nBurrowTicks = (SEED_RollMaskFast113c(m, pSeed, 8) + 0x18) | 0
        w32(m, pAiControl + 0x14, nBurrowTicks >>> 0)
        AI_StepRelativeToTargetUnit113c(m, pGame, pUnit, pTarget, 8, 8, 8)
        AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
        return
      }
    }
  }

  const pScanCtx = (K2_W12B1_SCRATCH_BASE + 0x410) >>> 0
  w32(m, pScanCtx + 0x00, 0)
  w32(m, pScanCtx + 0x04, 0x79)
  w32(m, pScanCtx + 0x08, i16(m, pMonStatsTxt + u8(m, pGame + 0x6d) * 2 + 0x62) >>> 0)
  AITARGET_ScanUnitsByModeTable113c(m, 1, pScanCtx, pGame, pUnit, 0x6fc9b860)

  if (nState > 1) {
    if (
      u32(m, pScanCtx + 0x00) !== 0 ||
      (nTargetDist < 6 && seedRoll(unitSeedOf(m, pSeed), 100) < 0x0f)
    ) {
      w32(m, pAiControl + 0x14, 1)
      nState = 1
    } else {
      AI_UnburrowAndScheduleThink_6FC9BE10_113c(m, pGame, pUnit)
      const nUnitX = getUnitPosXInline113c(m, pUnit)
      const nUnitY = getUnitPosYInline113c(m, pUnit)
      const nDestX = i32(m, pAiControl + 0x18)
      const nDestY = i32(m, pAiControl + 0x1c)
      if (
        nDestX !== 0 &&
        nDestY !== 0 &&
        (UNITS_GetOctileDistanceToCoordinates113c(m, pUnit, nDestX, nDestY) >>> 0) > 1
      ) {
        const pCoords = (K2_W12B1_SCRATCH_BASE + 0x420) >>> 0
        w32(m, pCoords + 0x00, nDestX >>> 0)
        w32(m, pCoords + 0x04, nDestY >>> 0)
        let bFound = 0
        if (pTarget !== 0) {
          if (
            COLLISION_FindFreePositionSimple113c(
              m,
              UNITS_GetRoom113c(m, pTarget),
              pCoords,
              UNITS_GetUnitSizeX113c(m, pUnit),
              0xffff,
              1,
            ) !== 0
          ) {
            bFound = 1
          }
        }
        if (bFound === 0) {
          if (
            COLLISION_FindFreePositionSimple113c(
              m,
              UNITS_GetRoom113c(m, pUnit),
              pCoords,
              UNITS_GetUnitSizeX113c(m, pUnit),
              0xffff,
              1,
            ) !== 0
          ) {
            bFound = 1
          }
        }
        if (bFound !== 0) {
          w32(m, pAiControl + 0x18, u32(m, pCoords + 0x00))
          w32(m, pAiControl + 0x1c, u32(m, pCoords + 0x04))
        }
        w32(m, pAiControl + 0x14, (i32(m, pAiControl + 0x14) - 1) >>> 0)
        let pUnitAiCtrl = 0
        if (u32(m, pUnit) === 1) {
          const pMonData = u32(m, pUnit + 0x14)
          if (pMonData !== 0) {
            pUnitAiCtrl = u32(m, pMonData + 0x2c)
          }
        }
        if (pUnitAiCtrl !== 0) {
          w32(m, pUnitAiCtrl + 0x18, 7)
        }
        AI_StartModeAtCoordsStep1_6FD11FF0_113c(
          m,
          pUnit,
          8,
          pGame,
          i32(m, pAiControl + 0x18),
          i32(m, pAiControl + 0x1c),
        )
        AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
        return
      }

      const nRadius = (nState + 8) | 0
      const nTgtX = getUnitPosXInline113c(m, pTarget)
      let nCandX =
        (SEED_RollLimitedFast113c(m, pSeed, (nRadius + nRadius) | 0) + (nTgtX - nRadius)) | 0
      const nTgtY = getUnitPosYInline113c(m, pTarget)
      let nCandY =
        (SEED_RollLimitedFast113c(m, pSeed, (nRadius + nRadius) | 0) + (nTgtY - nRadius)) | 0
      let nMinDist = (nRadius + nRadius) | 0
      if (nMinDist < 0x0c) {
        nMinDist = 0x0c
      } else if (nMinDist > 0x24) {
        nMinDist = 0x24
      }
      while ((UNITS_GetOctileDistanceToCoordinates113c(m, pUnit, nCandX, nCandY) | 0) < nMinDist) {
        if (nCandX < nUnitX) {
          nCandX = (nCandX - 1) | 0
        } else if (nCandX > nUnitX) {
          nCandX = (nCandX + 1) | 0
        }
        if (nCandY < nUnitY) {
          nCandY = (nCandY - 1) | 0
        } else if (nCandY > nUnitY) {
          nCandY = (nCandY + 1) | 0
        }
        if (nCandX === nUnitX && nCandY === nUnitY) {
          nCandX = (nCandX + 1) | 0
          nCandY = (nCandY + 1) | 0
        }
      }
      w32(m, pAiControl + 0x18, nCandX >>> 0)
      w32(m, pAiControl + 0x1c, nCandY >>> 0)
      let pUnitAiCtrl = 0
      if (u32(m, pUnit) === 1) {
        const pMonData = u32(m, pUnit + 0x14)
        if (pMonData !== 0) {
          pUnitAiCtrl = u32(m, pMonData + 0x2c)
        }
      }
      if (pUnitAiCtrl !== 0) {
        w32(m, pUnitAiCtrl + 0x18, 7)
      }
      AI_StartModeAtCoordsStep1_6FD11FF0_113c(m, pUnit, 8, pGame, nCandX, nCandY)
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
      w32(m, pAiControl + 0x14, (i32(m, pAiControl + 0x14) - 1) >>> 0)
      return
    }
  }

  if (nState === 1) {
    if (MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, pUnit, pGame) !== 0) {
      AI_StepRelativeToTargetUnit113c(m, pGame, pUnit, pTarget, 2, 9, 3)
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
      w32(m, pAiControl + 0x14, 0xffffffff)
      return
    }
    w32(m, pAiControl + 0x14, 8)
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
  }

  if (bInCombat !== 0) {
    const mul = BigInt(u32(m, pSeed)) * 0x6ac690c5n + BigInt(u32(m, pSeed + 0x04))
    const newLo = Number(mul & 0xffffffffn) >>> 0
    const newHi = Number((mul >> 32n) & 0xffffffffn) >>> 0
    w32(m, pSeed + 0x04, newHi)
    w32(m, pSeed, newLo)
    const nRem = (newLo >>> 0) % 100
    const nDiff = u8(m, pGame + 0x6d)
    if (nRem < i16(m, pMonStatsTxt + nDiff * 2 + 0x56)) {
      AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget)
      return
    }
    AI_ScheduleAiThinkTimer_6FD120C0_113c(
      m,
      pGame,
      pUnit,
      i16(m, pMonStatsTxt + nDiff * 2 + 0x5c),
    )
    return
  }

  if (nState !== -1) {
    const nDiff = u8(m, pGame + 0x6d)
    if (seedRoll(unitSeedOf(m, pSeed), 100) >= i16(m, pMonStatsTxt + nDiff * 2 + 0x6e)) {
      AI_ScheduleAiThinkTimer_6FD120C0_113c(
        m,
        pGame,
        pUnit,
        i16(m, pMonStatsTxt + nDiff * 2 + 0x5c),
      )
      return
    }
  }

  if (seedRoll(unitSeedOf(m, pSeed), 100) < i16(m, pMonStatsTxt + u8(m, pGame + 0x6d) * 2 + 0x68)) {
    AI_CircleStrafeTarget_6FD126B0_113c(m, pUnit, 0, pGame, pTarget, 6)
  } else {
    AI_StepRelativeToTargetUnit113c(m, pGame, pUnit, pTarget, 9, 2, 0)
  }
  w32(m, pAiControl + 0x14, 0)
  AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x0c)
}

/**
 * [23/34] Player level or act transition handler.
 *
 * @dll D2Game.dll
 * @va 0x6FCBE170
 * @ordinalOrName D2Game_6FCBE170
 */
export function PLAYER_ChangeLevelOrActTransition_6FCBE170_113c(
  m: SparseMemory113c,
  pPlayerUnit: number,
  nTargetLevelId: number,
  pGame: number,
  bAllowCollisionFallback: number,
): void {
  hitD2GameVa113c(0x6FCBE170)
  const nTargetAct = DRLG_GetActNoFromLevelId113c(m, nTargetLevelId) & 0xff
  if (pPlayerUnit === 0 || u32(m, pPlayerUnit) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Player\\PlrMod.cpp', 0x1fb)
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit)
  const pClient = u32(m, pPlayerData + 0x9c)
  if (pClient === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Player\\PlrMod.cpp', 0x1fb)
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayerUnit)
  const nFromLevel = pRoom !== 0 ? DUNGEON_GetLevelIdFromRoom113c(m, pRoom) : 0
  if (nTargetAct !== u8(m, pClient + 0x1ac)) {
    NPCS_OnPlayerLevelChange113c(m, pGame, nFromLevel, pPlayerUnit, nTargetLevelId)
    ACT_WarpClientPlayerToActTown_6FCBDF40_113c(
      m,
      pGame,
      pClient,
      nTargetLevelId,
      bAllowCollisionFallback,
    )
    return
  }
  const pOutX = (K2_W12B1_SCRATCH_BASE + 0x428) >>> 0
  const pOutY = (K2_W12B1_SCRATCH_BASE + 0x42c) >>> 0
  const nUnitSizeX = UNITS_GetUnitSizeX113c(m, pPlayerUnit)
  const pSpawnRoom = DUNGEON_FindFreeSpawnPositionInLevel113c(
    m,
    u32(m, pGame + 0xbc + nTargetAct * 4),
    nTargetLevelId,
    bAllowCollisionFallback,
    pOutX,
    pOutY,
    nUnitSizeX,
  )
  if (pSpawnRoom !== 0) {
    DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
      m,
      i32(m, pOutX),
      pSpawnRoom,
      i32(m, pOutY),
      pGame,
      pPlayerUnit,
      0,
      0,
    )
  }
}

/**
 * [24/34] Registers a summoned monster pet and updates linked monster owner state.
 *
 * @dll D2Game.dll
 * @va 0x6FCC3090
 * @ordinalOrName D2Game_6FCC3090
 */
export function SKILLS_RegisterSummonedMonsterPet_6FCC3090_113c(
  m: SparseMemory113c,
  pSummonArg: number,
  pPetUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCC3090)
  if ((u8(m, pSummonArg) & 0x08) === 0 && pPetUnit !== 0) {
    w32(m, pPetUnit + 0xc4, (u32(m, pPetUnit + 0xc4) | 0x80000000) >>> 0)
  }
  if ((u8(m, pSummonArg) & 0x02) !== 0) {
    const pOwner = u32(m, pSummonArg + 0x04)
    SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c(m, pGame, pOwner)
    const dwPetGuid = pPetUnit !== 0 ? u32(m, pPetUnit + 0x0c) : 0xffffffff
    if (pOwner === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Game\\Skills\\Skills.cpp', 0xa33)
    }
    const pMonsterData = u32(m, pOwner + 0x14)
    w32(m, pMonsterData + 0x40, dwPetGuid)
  }
  const nCount = i32(m, pSummonArg + 0x20)
  const nMaxPets = nCount < 1 ? 1 : nCount
  PETS_RegisterSummonPetAndClampCount_6FCB7F50_113c(
    m,
    i32(m, pSummonArg + 0x1c),
    u32(m, pSummonArg + 0x04),
    pGame,
    pPetUnit,
    nMaxPets,
    0,
  )
}

/**
 * [25/34] Shadow Warrior and Shadow Master AI think callback.
 *
 * @dll D2Game.dll
 * @va 0x6FCC9E80
 * @ordinalOrName D2Game_6FCC9E80
 */
export function AI_Think_ShadowWarriorAndMaster_6FCC9E80_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCC9E80)
  const pAiControl = u32(m, pAiTickArgs)

  let pOwner = 0
  if (pUnit !== 0 && u32(m, pUnit) === 1) {
    const pMonsterData = u32(m, pUnit + 0x14)
    if (pMonsterData !== 0) {
      const pAiGeneral = u32(m, pMonsterData + 0x28)
      if (pAiGeneral !== 0) {
        const pOwnerGame = u32(m, pAiGeneral + 0x28)
        if (pOwnerGame !== 0) {
          pOwner = SUNIT_GetServerUnit113c(
            m,
            pOwnerGame,
            u32(m, pAiGeneral + 0x30),
            u32(m, pAiGeneral + 0x2c),
          )
        }
      }
    }
  }

  if (pOwner === 0) {
    const dwFallbackGuid = u32(m, pAiControl + 0x1c)
    if (dwFallbackGuid !== 0) {
      if (pGame === 0) {
        throw new D2CommonAssertError('..\\Source\\D2Game\\AI\\AiThink.cpp', 0x2d3)
      }
      let pPlr = u32(m, pGame + 0x1120 + (dwFallbackGuid & 0x7f) * 4)
      while (pPlr !== 0 && u32(m, pPlr + 0x0c) !== dwFallbackGuid) {
        pPlr = u32(m, pPlr + 0xe4)
      }
      if (pPlr !== 0) {
        AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pPlr, 3, 0, 0, 0)
        return
      }
    }
    AI_Stall113c(m, pGame, pUnit, 0x0a)
    return
  }

  w32(m, pAiControl + 0x1c, u32(m, pOwner + 0x0c))
  const nOwnerDist = AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwner) | 0
  const dwOwnerMode = i32(m, pOwner + 0x10)
  const pMonStatsTxt = u32(m, pAiTickArgs + 0x1c)
  if (nOwnerDist > 0x32) {
    AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 3, 0, 0, 0)
    return
  }

  let nSpeedPct = 100
  const wBaseRun = i16(m, pMonStatsTxt + 0x32)
  if (wBaseRun > 0) {
    const nCalc = (sdiv32(imul32(i16(m, pMonStatsTxt + 0x34), 100), wBaseRun) - 100) | 0
    if (nCalc < 100) {
      nSpeedPct = nCalc
    }
  }

  if (nOwnerDist > 0x1c) {
    AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, 0x64, 0)
    return
  }

  if (nOwnerDist > 0x12) {
    if (dwOwnerMode === 2 || dwOwnerMode === 6) {
      if (AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, 0, 0) !== 0) {
        return
      }
    }
    if (dwOwnerMode === 3) {
      if (AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, 0x64, 0) !== 0) {
        return
      }
    }
  }

  const nearestOwner = AI_FindNearestPlayerOrAlly113c(m, pGame, pOwner)
  const pOwnerTarget = nearestOwner.pTarget
  const nearestUnit = AI_FindNearestPlayerOrAlly113c(m, pGame, pUnit)
  const pUnitTarget = nearestUnit.pTarget
  const nUnitDist = nearestUnit.distance | 0
  const bUnitInCombat = nearestUnit.inMeleeRange | 0

  let pChosenTarget = 0
  if (
    pUnitTarget !== 0 &&
    nUnitDist <= 0x1c &&
    MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, pUnit, pUnitTarget) !== 0
  ) {
    pChosenTarget = pUnitTarget
  } else if (
    pOwnerTarget !== 0 &&
    (AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwnerTarget) | 0) < 0x1c &&
    MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(m, pUnit, pOwnerTarget) !== 0
  ) {
    pChosenTarget = pOwnerTarget
  }

  if (bUnitInCombat !== 0) {
    if (pChosenTarget !== 0) {
      const nRoll = seedRoll(unitSeedOf(m, (pUnit + 0x20) >>> 0), 100)
      const nDiff = u8(m, pGame + 0x6d)
      if (nRoll < i16(m, pMonStatsTxt + nDiff * 2 + 0x62)) {
        AI_CastSkillMode14_113c(
          m,
          pUnit,
          i16(m, pMonStatsTxt + 0x170),
          pGame,
          pChosenTarget,
          0,
          0,
        )
        return
      }
      AI_StartAttackMode113c(m, 4, pUnit, pGame, pChosenTarget)
      AI_ScheduleAiThinkTimer_6FD120C0_113c(
        m,
        pGame,
        pUnit,
        i16(m, pMonStatsTxt + u8(m, pGame + 0x6d) * 2 + 0x56),
      )
      return
    }
  } else if (pChosenTarget !== 0) {
    const nRoll = seedRoll(unitSeedOf(m, (pUnit + 0x20) >>> 0), 100)
    const nDiff = u8(m, pGame + 0x6d)
    if (nRoll < i16(m, pMonStatsTxt + nDiff * 2 + 0x5c)) {
      if (nSpeedPct < -0x7e || nSpeedPct > 0x7e) {
        throw new D2CommonAssertError('..\\Source\\D2Game\\AI\\AiThink.cpp', 0x110)
      }
      let pUnitAiCtrl = 0
      if (u32(m, pUnit) === 1) {
        const pMonData = u32(m, pUnit + 0x14)
        if (pMonData !== 0) {
          pUnitAiCtrl = u32(m, pMonData + 0x2c)
        }
      }
      if (pUnitAiCtrl !== 0) {
        if (nSpeedPct !== 0) {
          w32(m, pUnitAiCtrl + 0x1c, nSpeedPct >>> 0)
        }
        w8(m, pUnitAiCtrl + 0x20, 0x28)
      }
    }
    AI_ApproachTarget113c(m, pGame, pUnit, pChosenTarget, 2, 0, 0, 1, 0)
    return
  }

  if (nOwnerDist > 0x10) {
    AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, 0, 0)
    return
  }
  AI_Stall113c(m, pGame, pUnit, 0x0f)
}

/**
 * [26/34] Raven AI think callback.
 *
 * @dll D2Game.dll
 * @va 0x6FCCA1D0
 * @ordinalOrName D2Game_6FCCA1D0
 */
export function AI_Think_Raven_6FCCA1D0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCCA1D0)
  const pAiControl = u32(m, pAiTickArgs)

  let pOwner = 0
  if (pUnit !== 0 && u32(m, pUnit) === 1) {
    const pMonsterData = u32(m, pUnit + 0x14)
    if (pMonsterData !== 0) {
      const pAiGeneral = u32(m, pMonsterData + 0x28)
      if (pAiGeneral !== 0) {
        const pOwnerGame = u32(m, pAiGeneral + 0x28)
        if (pOwnerGame !== 0) {
          pOwner = SUNIT_GetServerUnit113c(
            m,
            pOwnerGame,
            u32(m, pAiGeneral + 0x30),
            u32(m, pAiGeneral + 0x2c),
          )
        }
      }
    }
  }

  const pMonStatsTxt = pOwner !== 0 ? u32(m, pAiTickArgs + 0x1c) : 0
  if (pOwner === 0 || pMonStatsTxt === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x0a)
    return
  }

  const nHitsLeft = i32(m, pAiControl + 0x14)
  if (nHitsLeft === -1) {
    w32(m, pAiControl + 0x14, 3)
    const wSkill = i16(m, pMonStatsTxt + 0x170)
    if (wSkill >= 0) {
      const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pOwner, wSkill)
      const nSlvl = SKILLS_EvaluateSkillLevel113c(m, pOwner, pSkill, 1)
      const nInitHits = SKILLS_EvalLinearParam56_6FC21A90_113c(m, wSkill, nSlvl)
      w32(m, pAiControl + 0x14, nInitHits >>> 0)
    }
  } else if (nHitsLeft === 0) {
    SUNITDMG_DistributeExperience113c(m, pGame, pUnit, pUnit, true)
    return
  }

  const nOwnerDist = AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pOwner) | 0
  if (nOwnerDist > 0x32) {
    AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 3, 0, 0, 0)
    return
  }

  let nSpeedPct = 100
  const wBaseRun = i16(m, pMonStatsTxt + 0x32)
  if (wBaseRun > 0) {
    const nCalc = (sdiv32(imul32(i16(m, pMonStatsTxt + 0x34), 100), wBaseRun) - 100) | 0
    if (nCalc < 100) {
      nSpeedPct = nCalc
    }
  }

  if (nOwnerDist > 0x1c) {
    AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 0, 0, nSpeedPct, 0)
    return
  }

  const nearestRaven = AI_FindNearestPlayerOrAlly113c(m, pGame, pOwner)
  if (nearestRaven.pTarget !== 0) {
    UNITS_GetApproximateDistance113c(m, pUnit, nearestRaven.pTarget)
  }

  const bInCombat = u32(m, pAiTickArgs + 0x18)
  const pTarget = u32(m, pAiTickArgs + 0x08)
  const nTargetDist = i32(m, pAiTickArgs + 0x14)
  const nDiff0 = u8(m, pGame + 0x6d)
  const nSumLeash =
    (i16(m, pMonStatsTxt + nDiff0 * 2 + 0x5c) + i16(m, pMonStatsTxt + nDiff0 * 2 + 0x56)) | 0
  const nAvgLeash = sdiv32(nSumLeash, 2)

  if (pTarget !== 0 && i32(m, pAiControl + 0x18) < i32(m, pGame + 0xa8)) {
    const nDiff = u8(m, pGame + 0x6d)
    const nRoll = seedRoll(unitSeedOf(m, (pUnit + 0x20) >>> 0), 100)
    if (
      nRoll < i16(m, pMonStatsTxt + nDiff * 2 + 0x68) &&
      nTargetDist < i16(m, pMonStatsTxt + nDiff * 2 + 0x6e)
    ) {
      if (bInCombat !== 0) {
        AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget)
        const nDiffNow = u8(m, pGame + 0x6d)
        const nAip3 = i16(m, pMonStatsTxt + nDiffNow * 2 + 0x62)
        const nNextFrame = (i32(m, pGame + 0xa8) + imul32(nAip3, 10)) >>> 0
        w32(m, pAiControl + 0x18, nNextFrame)
        w32(m, pAiControl + 0x14, (i32(m, pAiControl + 0x14) - 1) >>> 0)
        return
      }
      AI_ApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 0)
      return
    }
  }

  const nDiffLeash = u8(m, pGame + 0x6d)
  if (
    nOwnerDist <= i16(m, pMonStatsTxt + nDiffLeash * 2 + 0x56) &&
    nOwnerDist >= i16(m, pMonStatsTxt + nDiffLeash * 2 + 0x5c)
  ) {
    const nDirFlag = i32(m, pAiControl + 0x1c)
    const nStateDir1 = nDirFlag !== 0 ? 5 : 6
    if (AI_SetStateDirAndStartWalkMode_6FCC41B0_113c(m, nStateDir1, 4, pUnit, pGame, pOwner) !== 0) {
      return
    }
    const nToggle = i32(m, pAiControl + 0x1c) === 0 ? 1 : 0
    w32(m, pAiControl + 0x1c, nToggle)
    const nStateDir2 = nToggle !== 0 ? 5 : 6
    if (AI_SetStateDirAndStartWalkMode_6FCC41B0_113c(m, nStateDir2, 4, pUnit, pGame, pOwner) !== 0) {
      return
    }
  }

  if (AI_WalkToLeashDistanceFromUnit_6FD11C30_113c(m, pOwner, pUnit, pGame, nAvgLeash) === 0) {
    AI_PetMoveActionDispatch_6FC3CAE0_113c(m, pUnit, pGame, pOwner, 1, 0, 0, 0)
  }
}

/**
 * [27/34] Warps the operating player through the room tile unit in Act 2 Quest 6.
 *
 * @dll D2Game.dll
 * @va 0x6FCE8950
 * @ordinalOrName D2Game_6FCE8950
 */
export function ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c(
  m: SparseMemory113c,
  pOperateArgs: number,
): void {
  hitD2GameVa113c(0x6FCE8950)
  const pRoom = UNITS_GetRoom113c(m, u32(m, pOperateArgs + 0x04))
  let pUnit = u32(m, pRoom + 0x74)
  while (pUnit !== 0) {
    if (u32(m, pUnit) === 5) {
      DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c(
        m,
        pUnit,
        u32(m, pOperateArgs + 0x08),
        u32(m, pOperateArgs),
      )
    }
    pUnit = u32(m, pUnit + 0xe8)
  }
}

/**
 * [28/34] C2S packet 0x23 handler for mercenary resurrection at a town NPC.
 *
 * @dll D2Game.dll
 * @va 0x6FCEFB90
 * @ordinalOrName D2Game_6FCEFB90
 */
export function C2S_Packet23_MercReviveHandler_6FCEFB90_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEFB90)
  if (u32(m, pGame + 0x70) === 0 || nPacketLen !== 5) {
    return 3
  }
  NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c(m, u32(m, pPacket + 1), pGame, pPlayerUnit)
  return 0
}

/**
 * [29/34] Executes player interaction with a world entity or issues a run-to-target command.
 *
 * @dll D2Game.dll
 * @va 0x6FCF01D0
 * @ordinalOrName D2Game_6FCF01D0
 */
export function C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c(
  m: SparseMemory113c,
  nTargetUnitType: number,
  pGame: number,
  bAltFlag: number,
  pPlayerUnit: number,
  dwTargetGuid: number,
): number {
  hitD2GameVa113c(0x6FCF01D0)
  switch (nTargetUnitType >>> 0) {
    case 0: {
      const pTarget = SUNIT_GetServerUnit113c(m, pGame, 0, dwTargetGuid)
      if (pTarget === 0) {
        return 1
      }
      const nDist = UNITS_GetDistanceToOtherUnit113c(m, pPlayerUnit, pTarget)
      if (nDist >>> 0 > 0x32) {
        return 1
      }
      if (nDist >>> 0 > 8) {
        const nInteractType = bAltFlag !== 0 ? -2 : -1
        c2sRunToUnitAndQueueInteract_6FCEE120(
          m,
          pGame,
          pPlayerUnit,
          pTarget,
          0,
          dwTargetGuid,
          nInteractType,
        )
        return 0
      }
      if (i32(m, pTarget + 0x10) === 0x11) {
        if (
          PLRTRADE_IsInteractingWithValidPlayer113c(m, pPlayerUnit, pGame) === 0 &&
          PLRTRADE_IsInteractingWithValidPlayer113c(m, pTarget, pGame) === 0
        ) {
          PLAYER_LootPlayerCorpseUnit_6FC99910_113c(m, pPlayerUnit, pGame, pTarget)
          return 0
        }
      }
      PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c(m, pPlayerUnit, pTarget, pGame)
      return 0
    }

    case 1: {
      const pTarget = SUNIT_GetServerUnit113c(m, pGame, 1, dwTargetGuid)
      if (pTarget === 0) {
        return 1
      }
      const nDist = UNITS_GetDistanceToOtherUnit113c(m, pPlayerUnit, pTarget)
      if (nDist > 0x32) {
        return 1
      }
      const pMonStatsTxt = MONSTATS_GetRecordPtr113c(m, i32(m, pTarget + 0x04))
      if (pMonStatsTxt !== 0) {
        const nAlign = u8(m, pMonStatsTxt + 0x0d)
        if ((nAlign & 2) !== 0 && (nAlign & 1) !== 0) {
          PATH_ClearPathPointsAndFlag0x20_113c(m, u32(m, pTarget + 0x2c))
          if (u32(m, pTarget) === 1) {
            const pMonData = u32(m, pTarget + 0x14)
            if (pMonData !== 0) {
              const pAiCtrl = u32(m, pMonData + 0x28)
              if (pAiCtrl !== 0) {
                w32(m, pAiCtrl + 0x14, 0x28)
              }
            }
          }
          let pNode = u32(m, pTarget + 0xdc)
          while (pNode !== 0) {
            const pNext = u32(m, pNode + 0x24)
            if (u8(m, pNode) === 2) {
              EVENT_FreeNode113c(m, pGame, pNode)
            }
            pNode = pNext
          }
          EVENT_SetEventFull113c(
            m,
            pGame,
            pTarget,
            2,
            (i32(m, pGame + 0xa8) + 1) | 0,
            0,
            0,
            0,
          )
        }
      }
      if (nDist > 6) {
        if (nDist >= 9) {
          return 0
        }
        const nInteractType = bAltFlag !== 0 ? -2 : -1
        c2sRunToUnitAndQueueInteract_6FCEE120(
          m,
          pGame,
          pPlayerUnit,
          pTarget,
          1,
          dwTargetGuid,
          nInteractType,
        )
        return 0
      }
      if (PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayerUnit) === 0) {
        PATH_ClearPathPointsAndFlag0x20_113c(m, u32(m, pPlayerUnit + 0x2c))
        const ppInteract = MONSTER_GetInteractDataPtr_6FC21370_113c(m, pTarget)
        NPC_StartPlayerNpcInteraction_6FC687A0_113c(
          m,
          pPlayerUnit,
          pTarget,
          pGame,
          ppInteract,
          0,
        )
      }
      return 0
    }

    case 2: {
      const pTarget = SUNIT_GetServerUnit113c(m, pGame, 2, dwTargetGuid)
      if (pTarget === 0) {
        return 1
      }
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, i32(m, pTarget + 0x04))
      if (pObjTxt === 0) {
        throw new D2CommonAssertError('..\\Source\\D2Game\\PackHdlr\\PackDflt.cpp', 0x290)
      }
      if (i32(m, pTarget + 0x10) >= 8) {
        return 3
      }
      const nDist = UNITS_GetDistanceToOtherUnit113c(m, pPlayerUnit, pTarget)
      if (nDist > 0x32) {
        return 1
      }
      if (
        UNITS_IsUnitInObjRectRange113c(m, pPlayerUnit, pTarget) !== 0 &&
        UNITS_TestCollisionBetweenUnits113c(m, pPlayerUnit, pTarget, 0x0804) === 0
      ) {
        PATH_ClearPathPointsAndFlag0x20_113c(m, u32(m, pPlayerUnit + 0x2c))
        if (
          OBJ_TryOperateObjectIfInRange_6FC8A720_113c(m, 2, pPlayerUnit, pGame, dwTargetGuid) === 0
        ) {
          return 3
        }
        return 0
      }
      const nInteractType = bAltFlag !== 0 ? -2 : -1
      c2sRunToUnitAndQueueInteract_6FCEE120(
        m,
        pGame,
        pPlayerUnit,
        pTarget,
        2,
        dwTargetGuid,
        nInteractType,
      )
      return 0
    }

    case 4: {
      const pTarget = SUNIT_GetServerUnit113c(m, pGame, 4, dwTargetGuid)
      if (pTarget === 0) {
        return 1
      }
      if (i32(m, pTarget + 0x10) !== 3) {
        return 1
      }
      const nDist = UNITS_GetDistanceToOtherUnit113c(m, pPlayerUnit, pTarget)
      if (nDist > 0x32) {
        return 1
      }
      if (
        nDist <= 4 &&
        UNITS_TestCollisionBetweenUnits113c(m, pPlayerUnit, pTarget, 0x0804) === 0
      ) {
        const pErrCode = (K2_W12B1_SCRATCH_BASE + 0x440) >>> 0
        w32(m, pErrCode, dwTargetGuid)
        if (bAltFlag !== 0) {
          ITEMS_PickupGroundItemToCursor_6FCF7160_113c(
            m,
            pPlayerUnit,
            pGame,
            dwTargetGuid,
            pErrCode,
          )
        } else {
          ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c(
            m,
            pGame,
            pPlayerUnit,
            dwTargetGuid,
            pErrCode,
          )
        }
        if (u32(m, pErrCode) !== 0) {
          return 3
        }
        return 0
      }
      const nInteractType = bAltFlag !== 0 ? -2 : -1
      c2sRunToUnitAndQueueInteract_6FCEE120(
        m,
        pGame,
        pPlayerUnit,
        pTarget,
        4,
        dwTargetGuid,
        nInteractType,
      )
      return 0
    }

    case 5: {
      const pTarget = SUNIT_GetServerUnit113c(m, pGame, 5, dwTargetGuid)
      if (pTarget === 0) {
        return 1
      }
      const nDist = UNITS_GetDistanceToOtherUnit113c(m, pPlayerUnit, pTarget)
      if (nDist > 0x32) {
        return 1
      }
      if (nDist > 4) {
        const nInteractType = bAltFlag !== 0 ? -2 : -1
        c2sRunToUnitAndQueueInteract_6FCEE120(
          m,
          pGame,
          pPlayerUnit,
          pTarget,
          5,
          dwTargetGuid,
          nInteractType,
        )
        return 0
      }
      DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c(m, pTarget, pPlayerUnit, pGame)
      return 0
    }

    default:
      return 1
  }
}

/**
 * [30/34] Removes or unequips an item with an invalid runeword flag from its owner.
 *
 * @dll D2Game.dll
 * @va 0x6FCF3280
 * @ordinalOrName D2Game_6FCF3280
 */
export function ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c(
  m: SparseMemory113c,
  pItemUnit: number,
  pOwnerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF3280)
  if (pGame === 0 || pOwnerUnit === 0 || pItemUnit === 0 || u32(m, pItemUnit) !== 4) {
    return
  }
  const pInventory = u32(m, pOwnerUnit + 0x60)
  if (pInventory === 0) {
    return
  }
  const nItemMode = i32(m, pItemUnit + 0x10)
  if (nItemMode === 0) {
    const nInvPage = ITEMS_GetInvPage113c(m, pItemUnit)
    ITEMS_SetNodePage113c(m, pItemUnit, nInvPage)
    if (u32(m, pOwnerUnit) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit)
      const pClient = u32(m, pPlayerData + 0x9c)
      if (pClient !== 0) {
        const pFlags = (K2_W12B1_SCRATCH_BASE + 0x444) >>> 0
        w32(m, pFlags, 0)
        ITEMS_SetOrClearFlagMask113c(m, pFlags, 0x20, 1)
        NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(
          m,
          pItemUnit,
          pOwnerUnit,
          pClient,
          u32(m, pFlags),
        )
      }
    }
    ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c(m, pOwnerUnit, pItemUnit, pGame, 0)
    return
  }
  if (nItemMode === 1) {
    const nBodyLoc = INVENTORY_GetItemGridXIfInInventory113c(m, pInventory, pItemUnit)
    const pOutResult = (K2_W12B1_SCRATCH_BASE + 0x448) >>> 0
    ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c(
      m,
      pGame,
      pOwnerUnit,
      nBodyLoc,
      1,
      pOutResult,
    )
    return
  }
  if (nItemMode === 4) {
    ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pOwnerUnit, pItemUnit, pGame)
  }
}

/**
 * [31/34] Places an item unit into a unit's inventory grid (either at exact cell coordinates or via auto-placement).
 *
 * @dll D2Game.dll
 * @va 0x6FCF76A0
 * @ordinalOrName D2Game_6FCF76A0
 */
export function ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c(
  m: SparseMemory113c,
  szFile: number,
  nLine: number,
  pGame: number,
  pOwnerUnit: number,
  dwItemGuid: number,
  nPosX: number,
  nPosY: number,
  bAutoPlace: number,
  bUpdateClient: number,
  nInvPageOrInvPtr: number,
): number {
  hitD2GameVa113c(0x6FCF76A0)
  if (pGame === 0 || pOwnerUnit === 0) {
    return 0
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pOwnerUnit)
  let pItem = u32(m, pGame + 0x1720 + (dwItemGuid & 0x7f) * 4)
  while (pItem !== 0 && u32(m, pItem + 0x0c) !== dwItemGuid) {
    pItem = u32(m, pItem + 0xe4)
  }
  if (pItem === 0 || u32(m, pItem) !== 4 || i32(m, pItem + 0x10) !== 4) {
    return 0
  }
  const nInvPage = ITEMS_GetInvPage113c(m, pItem) & 0xff
  const pInventory = nInvPageOrInvPtr !== 0 ? nInvPageOrInvPtr : u32(m, pOwnerUnit + 0x60)
  if (pInventory === 0) {
    return 0
  }
  let bTradeSync = 0
  let bClearCursor = 1
  const nInvGridId = UNITS_GetInventoryRecordId113c(m, pOwnerUnit, nInvPage, u32(m, pGame + 0x70))
  if (u32(m, pOwnerUnit) === 0) {
    if (nInvPage === 1) {
      bClearCursor = 0
    } else if (nInvPage === 2) {
      bTradeSync = 1
    }
  }
  let bPlaced = 0
  if (bAutoPlace !== 0) {
    bPlaced = INVENTORY_AutoPlaceItemInGrid113c(
      m,
      pInventory,
      pItem,
      nInvGridId,
      0,
      nInvPage,
      szFile,
      nLine,
    )
  } else {
    const nClampedX = nPosX < 0 ? 0 : nPosX
    const nClampedY = nPosY < 0 ? 0 : nPosY
    bPlaced = INVENTORY_PlaceItemInGridCell113c(
      m,
      pInventory,
      pItem,
      nClampedX,
      nClampedY,
      nInvGridId,
      0,
      nInvPage,
    )
  }
  if (bPlaced === 0) {
    return 0
  }
  if (INVENTORY_PlaceItemInSocket113c(m, pInventory, pItem, 1) === 0) {
    return 0
  }
  if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) !== 4) {
    ITEMS_OnEquipScrollOrTome113c(m, pItem, pOwnerUnit)
  }
  w32(m, pItem + 0xc4, (u32(m, pItem + 0xc4) & 0xfffffffd) >>> 0)
  if (ITEMS_CanUseCharmInInventory113c(m, pItem, pOwnerUnit) !== 0) {
    ITEMS_ActivateEquippedItemStats113c(m, pOwnerUnit, pItem, 0)
  }
  if (bClearCursor !== 0) {
    INVENTORY_SetCursorItem113c(m, pInventory, 0)
  }
  UNITS_ChangeAnimMode113c(m, pItem, 0)
  if (bUpdateClient !== 0) {
    ITEMS_SetItemFlag113c(m, pItem, 2, 1)
    if (ITEMS_HasSocketedSubItems113c(m, pItem) !== 0) {
      ITEMS_SetItemFlag113c(m, pItem, 1, 1)
    }
    if (ITEMS_CheckCommandFlags113c(m, pItem, 0x4000, 0x8ef, 0x6fd1b14c) !== 0) {
      ITEMS_SetItemFlag113c(m, pItem, 0x4000, 0)
    }
    UNITS_SetUnitUpdateFlags113c(m, pOwnerUnit, 1)
    INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem)
  }
  if (bTradeSync === 1) {
    PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c(m, pItem, pGame, pOwnerUnit)
  }
  if (ITEMS_CanUseCharmInInventory113c(m, pItem, pOwnerUnit) !== 0) {
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pOwnerUnit, 0)
    UNITS_SetUnitUpdateFlags113c(m, pOwnerUnit, 1)
  }
  return 1
}

/**
 * [32/34] Removes belt items from slots exceeding the new belt capacity when unequipping or changing belts.
 *
 * @dll D2Game.dll
 * @va 0x6FCF7E30
 * @ordinalOrName D2Game_6FCF7E30
 */
export function ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c(
  m: SparseMemory113c,
  pBeltItem: number,
  pOwnerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCF7E30)
  const pInventory = u32(m, pOwnerUnit + 0x60)
  if (pInventory === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Items\\Items.cpp', 0xc0d)
  }
  const pInvTxtBuf = (K2_W12B1_SCRATCH_BASE + 0x460) >>> 0
  for (let i = 0; i < 66; i += 1) {
    w32(m, pInvTxtBuf + i * 4, 0)
  }
  if (pBeltItem !== 0) {
    const nBeltType = UNITS_GetBeltTypeFromItem113c(m, pBeltItem)
    DATATBLS_GetInventoryTxtRecord113c(m, nBeltType, 0, pInvTxtBuf)
  } else {
    DATATBLS_GetInventoryTxtRecord113c(m, 2, 0, pInvTxtBuf)
  }

  for (let nSlot = 0; nSlot < 0x10; nSlot += 1) {
    const pCurInv = u32(m, pOwnerUnit + 0x60)
    const pBeltPot = INVENTORY_GetBeltItem113c(m, pCurInv, nSlot)
    const nMaxSlots = u8(m, pInvTxtBuf + 0x04)
    if (nSlot >= nMaxSlots && pBeltPot !== 0) {
      const pFlagMask = (K2_W12B1_SCRATCH_BASE + 0x580) >>> 0
      w32(m, pFlagMask, 0)
      ITEMS_SetOrClearFlagMask113c(m, pFlagMask, 0x20, 1)
      let pClient = 0
      if (u32(m, pOwnerUnit) === 0) {
        const pPlrData = UNITS_GetPlayerData113c(m, pOwnerUnit)
        pClient = u32(m, pPlrData + 0x9c)
      }
      S2C_SendPacket9C_ItemActionWorld113c(m, pClient, pBeltPot, 0x0f, u32(m, pFlagMask), 0)
      const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pCurInv, pBeltPot)
      if (pRemoved === 0) {
        throw new D2CommonAssertError('..\\Source\\D2Game\\Items\\Items.cpp', 0xc23)
      }
      if (pBeltPot !== pRemoved) {
        throw new D2CommonAssertError('..\\Source\\D2Game\\Items\\Items.cpp', 0xc24)
      }
      const nPotX = getUnitPosXInline113c(m, pBeltPot)
      INVENTORY_NoOpRet8A113c(m, pCurInv, nPotX)
      UNITS_ChangeAnimMode113c(m, pRemoved, 4)
      ITEMS_OnUnequipScrollOrTome113c(m, pBeltPot, pOwnerUnit)
      ITEMS_SetInvPage113c(m, pBeltPot, 0)
      if (
        ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c(
          m,
          0x6fd1b14c,
          0xc2a,
          pGame,
          pOwnerUnit,
          u32(m, pBeltPot + 0x0c),
          0,
          0,
          1,
          1,
          0,
        ) === 0
      ) {
        const pOwnerPos = (K2_W12B1_SCRATCH_BASE + 0x588) >>> 0
        PATH_GetTargetTypeAndPosition113c(m, pOwnerUnit, pOwnerPos)
        const pDropCoords = (K2_W12B1_SCRATCH_BASE + 0x598) >>> 0
        w32(m, pDropCoords, 0)
        w32(m, pDropCoords + 4, 0)
        const pOwnerRoom = UNITS_GetRoom113c(m, pOwnerUnit)
        const pDropRoom = ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(
          m,
          pOwnerRoom,
          pOwnerPos,
          pDropCoords,
          1,
        )
        if (pDropRoom !== 0) {
          ITEMS_DeactivateEquippedItemStats113c(m, pOwnerUnit, pBeltPot, pGame, 0, 1)
          ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c(
            m,
            i32(m, pDropCoords + 4),
            pBeltPot,
            pDropRoom,
            pGame,
            pOwnerUnit,
            i32(m, pDropCoords),
          )
        }
      }
    }
  }
}

/**
 * [33/34] Unequips an item from a body location onto the cursor (or marks it removed) and updates stats and hand skills.
 *
 * @dll D2Game.dll
 * @va 0x6FCF8970
 * @ordinalOrName D2Game_6FCF8970
 */
export function ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c(
  m: SparseMemory113c,
  pGame: number,
  pOwnerUnit: number,
  nBodyLoc: number,
  bToCursor: number,
  pOutResult: number,
): number {
  hitD2GameVa113c(0x6FCF8970)
  if (pGame === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Items\\Items.cpp', 0xc45)
  }
  if (pOwnerUnit === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Items\\Items.cpp', 0xc46)
  }
  w32(m, pOutResult, 0)
  const pInventory = u32(m, pOwnerUnit + 0x60)
  if (pInventory === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Items\\Items.cpp', 0xc4b)
  }
  if (INVENTORY_GetCursorItem113c(m, pInventory) !== 0) {
    return 0
  }
  const bLoc = nBodyLoc & 0xff
  const pEquipped = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, bLoc)
  if (pEquipped === 0) {
    w32(m, pOutResult, 0)
    return 0
  }
  if (u32(m, pEquipped) !== 4) {
    return 0
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pOwnerUnit)
  const nCanUnequip = INVENTORY_CanAutoEquipItem113c(m, pOwnerUnit, bLoc, 0, 0)
  if (nCanUnequip !== 3 && nCanUnequip !== 4) {
    w32(m, pOutResult, 1)
    return 0
  }
  const pOutSwappedItem = (K2_W12B1_SCRATCH_BASE + 0x5b0) >>> 0
  w32(m, pOutSwappedItem, pEquipped)
  INVENTORY_GetSwapWeaponItem113c(m, pOwnerUnit, pInventory, pOutSwappedItem, bLoc)
  const pItemToUnequip = u32(m, pOutSwappedItem)
  if (pItemToUnequip === 0) {
    w32(m, pOutResult, 1)
    return 0
  }
  ITEMS_NoOpReturnZero113c(m, pOwnerUnit, pItemToUnequip)
  INVENTORY_UpdateWeaponGuidOnRemoval113c(m, pInventory, pItemToUnequip)
  const pRemoved = INVENTORY_RemoveItemFromInventory113c(m, pInventory, pItemToUnequip)
  if (pRemoved === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Items\\Items.cpp', 0xc77)
  }
  if (pItemToUnequip !== pRemoved) {
    throw new D2CommonAssertError('..\\Source\\D2Game\\Items\\Items.cpp', 0xc78)
  }
  INVENTORY_NoOpRet8B113c(m, pInventory, bLoc)
  if (ITEMS_GetItemTypeFromItem113c(m, pRemoved) === 0x13) {
    ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c(m, 0, pOwnerUnit, pGame)
  }
  if (bToCursor !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pItemToUnequip, 0x20, 1)
  } else {
    INVENTORY_SetCursorItem113c(m, pInventory, pItemToUnequip)
  }
  ITEMS_DeactivateEquippedItemStats113c(m, pOwnerUnit, pItemToUnequip, pGame, 0, 1)
  if (pItemToUnequip !== 0) {
    w32(m, pItemToUnequip + 0xc4, (u32(m, pItemToUnequip + 0xc4) & 0xfffffffd) >>> 0)
  }
  UNITS_ChangeAnimMode113c(m, pItemToUnequip, 4)
  ITEMS_SetItemFlag113c(m, pItemToUnequip, 0x10, 1)
  if (ITEMS_HasSocketedSubItems113c(m, pItemToUnequip) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pItemToUnequip, 1, 1)
  }
  if (ITEMS_CheckCommandFlags113c(m, pItemToUnequip, 0x4000, 0xc8f, 0x6fd1b14c) !== 0) {
    ITEMS_SetOrClearCommandFlags113c(m, pItemToUnequip, 0x4000, 0)
  }
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pItemToUnequip)
  UNITS_SetUnitUpdateFlags113c(m, pOwnerUnit, 1)
  ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c(m, pOwnerUnit)
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pOwnerUnit, 0)
  return 1
}

/**
 * [34/34] Spawns The Smith superunique boss in the Act 1 Quest 4 Barracks room and records its GUID on the quest state.
 *
 * @dll D2Game.dll
 * @va 0x6FD08780
 * @ordinalOrName D2Game_6FD08780
 */
export function ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c(
  m: SparseMemory113c,
  pQuestState: number,
  pRoom: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD08780)
  w8(m, pQuestState + 0x04, 1)
  const pSmith = MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c(
    m,
    0x197,
    0,
    1,
    pGame,
    pRoom,
    0,
    0,
    -1,
  )
  if (pSmith !== 0) {
    MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(m, pGame, pSmith, 1)
    MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, 1, pRoom, pGame, pSmith)
    w8(m, pQuestState + 0x03, 0)
    w8(m, pQuestState + 0x02, 1)
    w32(m, pQuestState + 0x24, u32(m, pSmith + 0x0c))
  }
  w8(m, pQuestState + 0x04, 0)
}
