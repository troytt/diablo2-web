/**
 * Milestone 33 [K2] Wave 3 Batch 7 (`w3b7`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FC88150..0x6FC97D90`.
 *
 * Clean-room 1:1 binary-accurate translations from `D2Game.dll` v1.13c.
 */

import {
  UNITS_GetField7C_113c,
  UNITS_GetObjectShrineTxt113c,
  UNITS_GetObjectTxt113c,
  UNITS_GetPlayerData113c,
} from '../common/composit.js'
import {
  COLLISION_CheckMaskWithSizeXY113c,
  COLLISION_FindFreeCoordsNear113c,
  COLLISION_FindFreePositionBasic113c,
  COLLISION_FindFreePositionSimple113c,
} from '../common/collision.js'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.js'
import { MONSTER_GetMonStatsInteractBit113c } from '../common/drlg/drlg-ver.js'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon.js'
import { D2CommonAssertError } from '../common/inline-helpers.js'
import { imul32 } from '../common/int-math.js'
import {
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_SetCursorItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.js'
import {
  ITEMS_CheckEtherealFlag113c,
  ITEMS_CheckItemIdMatchesItemType113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemLevel113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetMaxSockets113c,
  ITEMS_GetMaxSocketsFromItemType113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_SetItemFlag113c,
} from '../common/items.js'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_GetWeaponMasteryBonusMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.js'
import {
  MISSILE_GetClassId113c,
  MISSILE_GetLevel113c,
  MISSILE_GetRemainingFrames113c,
} from '../common/missile.js'
import {
  PATH_Compute113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_ResetToDefaultType113c,
  PATH_SetDistance113c,
  PATH_SetStepNum113c,
  PATH_SetType113c,
  PATH_Step113c,
} from '../common/path.js'
import {
  SKILLS_GetSkillsTxtFromSkill113c,
  SKILLS_SetParam0C113c,
} from '../common/skills.js'
import {
  ENVIRONMENT_GetTimeOfDayAndAngle113c,
  STATES_CheckState113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitFullStatsCount113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatBonus113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.js'
import {
  CHAT_AllocHoverMsg113c,
  CHAT_FreeHoverMsg113c,
  CHAT_GetTimeoutFromHoverMsg113c,
} from '../common/text.js'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_AdvanceAnimFrame113c,
  UNITS_AllocStaticPath113c,
  UNITS_AreUnitsAligned113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetPathRoomRefreshFlag113c,
  UNITS_GetPlayerBaseToHit113c,
  UNITS_GetRoom113c,
  UNITS_GetUnitSizeX113c,
  UNITS_GetUnitSizeY113c,
  UNITS_HasAnimFinished113c,
  UNITS_SetCollisionMaskAtCoords113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNITS_SetUnitUpdateFlags113c,
  UNITS_TestCollisionBetweenUnits113c,
  UNIT_Alloc113c,
  UNIT_GetAlignment113c,
} from '../common/unit.js'
import {
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
} from '../common/unit-finds.js'
import {
  WAYPOINT_ActivateWaypoint113c,
  WAYPOINT_CopyAndValidateWaypointData113c,
  WAYPOINT_GetWaypointNoFromLevelId113c,
} from '../common/waypoint.js'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.js'
import {
  DATATBLS_GetChestTreasureClass113c,
  DATATBLS_GetLevelMonsterLevel113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
  MONSTERS_IsDead113c,
  fogGetRowFromTxt113c,
} from '../tables/datatbls-113c.js'
import { DATATBLS_GetItemIdFromItemCode113c } from '../tables/item-tbls-113c.js'
import {
  DATATBLS_GetItemDataTables113c,
} from '../tables/item-tbls-113c.js'
import { SKILLS_DoUsedSkillAction113c } from './a1c-post150-f786-f1040-113c.js'
import {
  AI_CastSkillWithMode113c,
  MONSTER_CheckTypeFlagsMask113c,
  SUNITDMG_FreeAttackerCombatList113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c.js'
import {
  NET_QueuePacketToClientBuffer113c,
  NET_SendFixed40BytePacketToClient113c,
} from './boot-init-gap-a-113c.js'
import {
  ITEMS_DropGoldPileAtUnit113c,
  ITEMS_GetDropItemLevel113c,
  MONSTER_SetDeathPathAndAnim113c,
  MONSTER_StartMode113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplyResistancesAndAbsorb113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
} from './combat-a1c-113c.js'
import { SUNIT_GetServerUnit113c } from './game-strc.js'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_ChooseTreasureClassAndDrop_6FC32380_113c,
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
  ITEMS_GetDropItemLevel_6FC2E5D0_113c,
} from './k2-real-itemdrop-113c.js'
import { MONSTER_StartMode113c as MONSTER_StartModeReal113c } from './k2-real-s2c-combat-113c.js'
import {
  DATATBLS_GetItemStatCostRecordFast113c,
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c.js'
import {
  MISSILE_CreateServerProjectile113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c.js'
import { MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c } from './k2-laneH-0x6fc2-w1-113c.js'
import { MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c } from './k2-laneL-0x6fc6-w1-113c.js'
import {
  ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c,
  ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c,
  ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c,
  ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c,
} from './k2-w2b1-113c.js'
import {
  ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c,
  OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c,
  OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c,
  OBJECTS_GrantUnitDexterity_6FC896F0_113c,
  OBJECTS_GrantUnitEnergy_6FC89710_113c,
  OBJECTS_GrantUnitSkillPoints_6FC89650_113c,
  OBJECTS_GrantUnitStrength_6FC896B0_113c,
  OBJECTS_GrantUnitVitality_6FC896D0_113c,
  OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c,
  OBJECTS_OperateToggleObjectMode012_6FC89A80_113c,
  SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c,
  SHRINES_ApplyHealthExchangeEffect_6FC89800_113c,
  SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c,
  SHRINES_ApplyManaExchangeEffect_6FC897A0_113c,
  SHRINES_ApplyManaRechargeEffect_6FC89860_113c,
} from './k2-w2b2-113c.js'
import {
  NET_SendPacketBuffer21B_6FCAAA70_113c,
  NET_SendPacketBuffer32B_6FCAAA10_113c,
  NET_SendPacketBuffer7B_6FCAAB20_113c,
  OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c,
  OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c,
  OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c,
} from './k2-w2b3-113c.js'
import { STATES_PurgeExpStateStatLists_6FCDC920_113c } from './k2-w2b6-113c.js'
import {
  MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c,
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c,
} from './k2-w2b8-113c.js'
import {
  OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c,
  OBJ_OperateFn20_WeaponRack_6FC8B280_113c,
  OBJ_OperateFn28_Urn_6FC8D7B0_113c,
  OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c,
} from './k2-w4b3-113c.js'
import {
  OBJ_OperateAuraStatShrine_6FC8ABB0_113c,
  OBJ_OperateCombatShrine_6FC8ACE0_113c,
  OBJ_OperateStaminaShrine_6FC8AC30_113c,
  OBJ_OperateTomeOrScrollStand_6FC8B340_113c,
  OBJ_OperateWirtsBody_6FC8D960_113c,
} from './k2-w4b4-113c.js'
import {
  ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c,
  OBJ_OperateChestAndDropTreasure_6FC8EC20_113c,
  OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c,
  OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c,
  OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c,
  OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c,
} from './k2-w5b2-113c.js'
import { ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c } from './k2-w5b5-113c.js'
import { OBJ_OperateWell_6FC8CEE0_113c } from './k2-w6b2-113c.js'
import {
  ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c,
  ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c,
  ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c,
} from './k2-w6b5-113c.js'
import {
  ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c,
  ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c,
  ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c,
  ACT3Q3_OperateSewerLeverObject_6FD09F60_113c,
} from './k2-w6b6-113c.js'
import {
  OBJECTS_OperateBankStash_6FC91290_113c,
  OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c,
  OBJECTS_OperateGemShrine_6FC8B430_113c,
  OBJECTS_OperatePortalShrine_6FC8B9B0_113c,
} from './k2-w7b2-113c.js'
import { OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c } from './k2-w7b4-113c.js'
import {
  ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70_113c,
  ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c,
  OBJ_OperateChestAndSparkyChest_6FC8F040_113c,
  OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c,
} from './k2-w8b2-113c.js'
import {
  ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c,
  ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c,
} from './k2-w8b3-113c.js'
import {
  ACT1Q4_OperateInifussTree_6FC85B40_113c,
  ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c,
} from './k2-w9b1-113c.js'
import {
  OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c,
  OBJ_OperateFn_SkillShrine_6FC8AB60_113c,
  OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c,
} from './k2-w11b1-113c.js'
import {
  OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c,
  OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c,
  OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c,
  OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c,
} from './k2-w12b1-113c.js'
import {
  D2Game_6FC7D690_113c,
  D2Game_6FC7DF70_113c,
  D2Game_6FC7E2A0_113c,
  D2Game_6FC8D620_113c,
  D2Game_6FC8F4F0_113c,
  D2Game_6FD095E0_113c,
} from './k2-w13b1-113c.js'
import {
  ACT3Q2_OperateGidbinnAltar_6FD09C80_113c,
  ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c,
} from './k2-w14b1-113c.js'
import {
  ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c,
  ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c,
  ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c,
  OBJ_OperateDuranceStairs_6FC8CD40_113c,
} from './k2-w15b1-113c.js'
import {
  ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c,
  ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c,
  ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c,
  ACT4Q3_OnSeal1Operate_6FCDC580_113c,
  ACT4Q3_OnSeal3Operate_6FCDC510_113c,
  ACT4Q3_OnSeal5Operate_6FCDC4A0_113c,
  ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c,
} from './k2-w16b1-113c.js'
import {
  AI_RunMonsterAI113c,
  MONSTER_ClearModeEvents113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.js'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c.js'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_CheckModeBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  MONSTER_Create113c,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_SpawnAtCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.js'
import {
  MONSTER_EndToAiOrNeutral113c,
  SKILLS_GetFlags113c,
} from './replay-kernel-113c.js'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel.js'
import { SUNIT_UpdateUnitPositionAndRoom113c } from './town-runtime-gap-113c.js'
import { hitD2GameVa113c } from '../va-trace-113c.js'

export type D2KernMemory113c = Memory113c

// Keep unused pre-indexed callee references available for parts 2 & 3
void AI_CastSkillWithMode113c
void CHAT_AllocHoverMsg113c
void CHAT_FreeHoverMsg113c
void CHAT_GetTimeoutFromHoverMsg113c
void COLLISION_FindFreeCoordsNear113c
void COLLISION_FindFreePositionBasic113c
void COLLISION_FindFreePositionSimple113c
void DATATBLS_GetChestTreasureClass113c
void DATATBLS_GetItemStatCostRecordFast113c
void DATATBLS_GetItemsTxtRecordMemPort113c
void DATATBLS_GetLevelMonsterLevel113c
void DATATBLS_GetObjectsTxtRecord113c
void DUNGEON_GetRoomCoordinates113c
void ENVIRONMENT_GetTimeOfDayAndAngle113c
void EVENT_FreeNode113c
void INVENTORY_AppendItemGuidNode113c
void INVENTORY_GetFirstItem113c
void INVENTORY_GetNextItem113c
void INVENTORY_SetCursorItem113c
void INVENTORY_UnitIsItem113c
void ITEMS_CheckEtherealFlag113c
void ITEMS_CheckItemIdMatchesItemType113c
void ITEMS_CheckItemTypeIdMemPort113c
void ITEMS_DropGoldPileAtUnit113c
void ITEMS_GetBaseCode113c
void ITEMS_GetCommandFlags113c
void ITEMS_GetDropItemLevel113c
void ITEMS_GetInvPage113c
void ITEMS_GetItemCell113c
void ITEMS_GetItemLevel113c
void ITEMS_GetItemQuality113c
void ITEMS_GetMaxSockets113c
void ITEMS_GetMaxSocketsFromItemType113c
void ITEMS_GetTwoHandedFlag113c
void ITEMS_SetItemFlag113c
void MISSILE_CreateServerProjectile113c
void MISSILE_GetClassId113c
void MISSILE_GetLevel113c
void MISSILE_GetRemainingFrames113c
void MONSTER_Create113c
void MONSTER_GetBaseIdFromUnit113c
void MONSTER_SetDeathPathAndAnim113c
void MONSTER_SpawnAtCoords113c
void NET_QueuePacketToClientBuffer113c
void NET_SendFixed40BytePacketToClient113c
void NET_SendPacketBuffer21B_6FCAAA70_113c
void NET_SendPacketBuffer32B_6FCAAA10_113c
void OBJECTS_InitObjectUnit113c
void OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c
void OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c
void PATH_Compute113c
void PATH_GetFirstPointX113c
void PATH_GetFirstPointY113c
void PATH_GetPosX113c
void PATH_GetPosY113c
void PATH_GetTargetUnit113c
void PATH_ResetToDefaultType113c
void PATH_SetDistance113c
void PATH_SetType113c
void PATH_Step113c
void ROOM_FindRoomContainingSubtile113c
void SEED_RollLimitedFast113c
void SKILLS_DoUsedSkillAction113c
void SKILLS_GetFlags113c
void SKILLS_GetUsedSkillMemPort113c
void SKILLS_SetParam0C113c
void STATES_CheckState113c
void STATES_CreateOrUpdateAuraStatList113c
void STATLIST_AddUnitStatMemPort113c
void STATLIST_GetUnitBaseStat113c
void STATLIST_GetUnitFullStatsCount113c
void STATLIST_GetUnitStatBonus113c
void SUNITDMG_ApplyDamage113c
void SUNITDMG_ApplyResistancesAndAbsorb113c
void SUNITDMG_ApplySideEffectsAndKill113c
void SUNITDMG_FreeAttackerCombatList113c
void SUNIT_InitUnitSeed113c
void SUNIT_IsDeadOrDying113c
void SUNIT_PlaceServerUnitInRoom113c
void SUNIT_UpdateUnitPositionAndRoom113c
void SUNIT_ValidatePathTargetUnit113c
void UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c
void UNITFINDS_FreeUnitFindData113c
void UNITFINDS_InitUnitFindData113c
void UNITS_AdvanceAnimFrame113c
void UNITS_AllocStaticPath113c
void UNITS_GetApproximateDistance113c
void UNITS_GetObjectShrineTxt113c
void UNITS_GetPathRoomRefreshFlag113c
void UNITS_HasAnimFinished113c
void UNITS_SetCollisionMaskAtCoords113c
void UNITS_SetTargetUnitForDynamicUnitEx113c
void UNITS_SetUnitUpdateFlags113c
void UNITS_TestCollisionBetweenUnits113c
void UNIT_Alloc113c
void UNIT_GetPosX113c
void UNIT_GetPosY113c
void WAYPOINT_ActivateWaypoint113c
void WAYPOINT_CopyAndValidateWaypointData113c
void WAYPOINT_GetWaypointNoFromLevelId113c

const D2GAME_SHRINE_EFFECT_COUNT_VA_113C = 0x6fd27e4c
const D2GAME_SHRINE_EFFECT_TABLE_VA_113C = 0x6fd27d50
const D2GAME_OBJECT_OPERATE_TABLE_VA_113C = 0x6fd27bb8
const D2GAME_IAT_IS_BAD_CODE_PTR_VA_113C = 0x6fd18d14

let k2W3B7StackPtr = 0x7e780000

function allocStackFrame113c(size: number): number {
  const ptr = k2W3B7StackPtr >>> 0
  k2W3B7StackPtr = (ptr + ((size + 7) & ~7)) >>> 0
  return ptr
}

function freeStackFrame113c(ptr: number): void {
  k2W3B7StackPtr = ptr >>> 0
}

// Exact D2Game.dll .rdata table at 0x6FD1BD8C (5 acts x [startLevelId, endLevelId])
const ACT_CHEST_LEVEL_RANGE_113C = [
  [2, 37],
  [41, 73],
  [76, 102],
  [104, 108],
  [109, 136],
] as const

function resolveSgptDataTables113c(m: D2KernMemory113c): number {
  const pSgptSlot = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (pSgptSlot !== 0) {
    const pTables = m.u32(pSgptSlot) >>> 0
    if (pTables !== 0) {
      return pTables
    }
  }
  return 0
}

/** Exact internal `0x6FCFEEE0` (`SUNITDMG_KillMonster`) path for `pAttacker == 0, bAwardExp == 1`. */
function sunitdmgKillUnit_6FCFEEE0(
  m: D2KernMemory113c,
  pGame: number,
  pDefender: number,
): void {
  const def = pDefender >>> 0
  const game = pGame >>> 0
  hitD2GameVa113c(0x6FCFEEE0)
  if (def === 0) return
  const defType = m.u32(def) | 0
  if (defType === 1) {
    const curMode = m.u32((def + 0x10) >>> 0) | 0
    if (curMode === 0 || curMode === 0x0c) return
    if ((MONSTATS_CheckFlagBit113c(m, m.u32((def + 4) >>> 0) | 0, 0x0f) | 0) === 0) return
    SUNITDMG_FreeAttackerCombatList113c(m, def, game)
    MONSTER_ClearModeEvents113c(m, game, def)
    UNITS_ChangeAnimMode113c(m, def, 0)
    m.setU32((def + 0xc4) >>> 0, (m.u32((def + 0xc4) >>> 0) | 0x10000) >>> 0)
    if (game !== 0) {
      const nextFrame = ((m.u32((game + 0xa8) >>> 0) | 0) + 1) | 0
      EVENT_SetEventFull113c(m, game, def, 1, nextFrame, 0, 0, 0)
    }
  } else if (defType === 0) {
    const curMode = m.u32((def + 0x10) >>> 0) | 0
    if (curMode === 0 || curMode === 0x11) return
    SUNITDMG_FreeAttackerCombatList113c(m, def, game)
    MONSTER_ClearModeEvents113c(m, game, def)
    UNITS_ChangeAnimMode113c(m, def, 0)
    m.setU32((def + 0xc4) >>> 0, (m.u32((def + 0xc4) >>> 0) | 0x10000) >>> 0)
  }
}

/** Exact internal `0x6FD01930` (`MONSTER_StepPath`): returns `1` (moving) or `2` (arrived). */
function stepMonsterPathRaw_6FD01930(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
): number {
  const game = pGame >>> 0
  const mon = pMonster >>> 0
  if (game === 0) {
    throw new D2CommonAssertError('SUnitMove.cpp', 0x72f)
  }
  hitD2GameVa113c(0x6FD01930)
  SUNIT_ValidatePathTargetUnit113c(m, mon, game)
  const nStepped = PATH_Step113c(m, mon, 0x400) | 0
  const nRes = nStepped !== 0 ? 1 : 2
  if ((UNITS_GetPathRoomRefreshFlag113c(m, mon) | 0) !== 0) {
    SUNIT_UpdateUnitPositionAndRoom113c(m, 0, mon, game)
  }
  return nRes
}

function stepSeed64InPlace113c(m: D2KernMemory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

/**
 * [1/45] Act 1 Quest 4 (`Search for Cain`) Deckard Cain (`dwClassId == 0x92 = 146`) mode/interact callback:
 * If Cain has an active NPC interaction (`[pNode + 0] != 0`), closes all interactions and sends quest alert `0x5D`
 * (`0x6FC82A30` via `0x6FC68410`); otherwise clears Cain's used skill, enters mode `0` (`0x6FC95E10`), and sets
 * `pQuestEx->bCainPortalReady` (`[pQuestEx + 0x61] = 1`) on Quest `4`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = arg4)` (`ret 4`).
 *
 * @va D2Game:0x6FC88150
 */
export function ACT1Q4_OnCainModeOrInteract_6FC88150_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg4 = 0,
): number {
  hitD2GameVa113c(0x6FC88150)
  if (pUnit === 0) return 0
  if ((m.u32((pUnit + 0x04) >>> 0) | 0) !== 0x92) return 0

  let pMonInteract = 0
  if ((m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonsterData !== 0) {
      pMonInteract = m.u32((pMonsterData + 0x30) >>> 0) >>> 0
    }
  }

  let pNode = pMonInteract !== 0 ? m.u32(pMonInteract >>> 0) >>> 0 : 0
  while (pNode !== 0) {
    if (m.u32(pNode >>> 0) !== 0) {
      MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(
        m,
        pGame >>> 0,
        pUnit >>> 0,
        0x6fc82a30,
        (mem, pPlayer) => {
          ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c(mem, pPlayer >>> 0)
        },
      )
      return 1
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }

  SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
  MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 0, 0, 0, 0)

  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl !== 0) {
    let pQuest = m.u32(pQuestControl >>> 0) >>> 0
    while (pQuest !== 0) {
      if ((m.u32(pQuest >>> 0) | 0) === 4) {
        const pQuestEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
        if (pQuestEx !== 0) {
          m.setU8((pQuestEx + 0x61) >>> 0, 1)
        }
        return 1
      }
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }
  }
  return 1
}

/**
 * [2/45] Act 1 Quest 4 (`Search for Cain`) Cain cage / portal object timer step (`0x6FC88F00`):
 * Steps `pObject->dwAnimMode` (`1 -> 2`, `2 -> 3` when town tick counter `+0x80 > 5` or `+0x92 != 0` in level `1`,
 * or `+0x91 != 0` outside level `1`, `3 -> 4`) and reschedules event `7` at `dwGameFrame + 25` (`+0x19`).
 *
 * Binary convention: `ebx = pQuestData`, `edi = pObject` (`ret`).
 *
 * @va D2Game:0x6FC88F00
 */
export function ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC88F00)
  const nMode = pObject !== 0 ? m.u32((pObject + 0x10) >>> 0) | 0 : 0
  if (nMode === 1) {
    UNITS_ChangeAnimMode113c(m, pObject >>> 0, 2)
  } else if (nMode === 2) {
    const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    const pRoom = UNITS_GetRoom113c(m, pObject >>> 0) >>> 0
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
    if (nLevelId === 1) {
      const nTicks = ((m.u32((pQuestEx + 0x80) >>> 0) | 0) + 1) | 0
      m.setU32((pQuestEx + 0x80) >>> 0, nTicks >>> 0)
      if (nTicks > 5) {
        m.setU8((pQuestEx + 0x92) >>> 0, 1)
      }
      if (m.u8((pQuestEx + 0x92) >>> 0) !== 0) {
        UNITS_ChangeAnimMode113c(m, pObject >>> 0, 3)
      }
    } else if (m.u8((pQuestEx + 0x91) >>> 0) !== 0) {
      UNITS_ChangeAnimMode113c(m, pObject >>> 0, 3)
    }
  } else if (nMode === 3) {
    UNITS_ChangeAnimMode113c(m, pObject >>> 0, 4)
  }

  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const dwTriggerFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + 0x19) >>> 0
  EVENT_SetEventFull113c(m, pGame, pObject >>> 0, 7, dwTriggerFrame, 0, 0, 0)
}

/**
 * [3/45] Frees a quest bit-buffer pair structure (`[pPair + 0]` and `[pPair + 4]` `D2BitBufferStrc*`
 * and their backing 8-byte buffers) via `Fog.#10046`.
 *
 * Binary convention: `esi = pPair`, `edi = pGame` (`ret`).
 *
 * @va D2Game:0x6FC892D0
 */
export function QUESTS_FreeBitBufferPair_6FC892D0_113c(
  m: D2KernMemory113c,
  pPair: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC892D0)
  const pFirst = m.u32(pPair >>> 0) >>> 0
  if (pFirst !== 0) {
    m.u32(pFirst)
    m.u32((pGame + 0x1c) >>> 0)
    m.u32(pPair >>> 0)
    m.u32((pGame + 0x1c) >>> 0)
    m.setU32(pPair >>> 0, 0)
  }
  const pSecond = m.u32((pPair + 0x04) >>> 0) >>> 0
  if (pSecond !== 0) {
    m.u32(pSecond)
    m.u32((pGame + 0x1c) >>> 0)
    m.u32((pPair + 0x04) >>> 0)
    m.u32((pGame + 0x1c) >>> 0)
    m.setU32((pPair + 0x04) >>> 0, 0)
  }
  m.u32((pGame + 0x1c) >>> 0)
}

/**
 * [4/45] Allocates an 8-byte quest bit-buffer pair structure (`[+0]` and `[+4]`), each pointing to
 * a 20-byte `D2BitBufferStrc` initialized over a zeroed 8-byte (`64-bit`) buffer via `Fog.#10126`.
 *
 * Binary convention: `esi = pGame` (`ret`).
 *
 * @va D2Game:0x6FC89360
 */
export function QUESTS_AllocBitBufferPair_6FC89360_113c(
  m: D2KernMemory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC89360)
  m.u32((pGame + 0x1c) >>> 0)
  const pPair = m.alloc(0x08) >>> 0

  m.u32((pGame + 0x1c) >>> 0)
  const pBitBuf0 = m.alloc(0x14) >>> 0
  m.u32((pGame + 0x1c) >>> 0)
  const pBuf0 = m.alloc(0x08) >>> 0
  m.setU32(pBuf0, 0)
  m.setU32((pBuf0 + 0x04) >>> 0, 0)
  m.setU32(pBitBuf0, pBuf0)
  m.setU32((pBitBuf0 + 0x04) >>> 0, 0x40)
  m.setU32((pBitBuf0 + 0x08) >>> 0, 0)
  m.setU32((pBitBuf0 + 0x0c) >>> 0, 0)
  m.setU32((pBitBuf0 + 0x10) >>> 0, 0)
  m.setU32(pPair, pBitBuf0)

  m.u32((pGame + 0x1c) >>> 0)
  const pBitBuf1 = m.alloc(0x14) >>> 0
  m.u32((pGame + 0x1c) >>> 0)
  const pBuf1 = m.alloc(0x08) >>> 0
  m.setU32(pBuf1, 0)
  m.setU32((pBuf1 + 0x04) >>> 0, 0)
  m.setU32(pBitBuf1, pBuf1)
  m.setU32((pBitBuf1 + 0x04) >>> 0, 0x40)
  m.setU32((pBitBuf1 + 0x08) >>> 0, 0)
  m.setU32((pBitBuf1 + 0x0c) >>> 0, 0)
  m.setU32((pBitBuf1 + 0x10) >>> 0, 0)
  m.setU32((pPair + 0x04) >>> 0, pBitBuf1)

  return pPair
}

/**
 * [5/45] Computes a unit's total skill Attack Rating into `*pOutToHit`, combining `UNITS_GetPlayerBaseToHit113c`
 * (zeroed for missile potions `ITYPE_MISSILE_POTION = 38`), `SKILLS_GetWeaponMasteryBonusMemPort113c` (`0`),
 * `STAT_ITEM_TOHIT_PERCENT` (`119`), `SkillsTxt.dwToHit + (nSkillLevel - 1) * SkillsTxt.dwLevToHit`, and
 * `CharStatsTxt.dwToHitFactor` (`+0x3C`) for players.
 *
 * Binary convention: `eax = pWeapon`, `ecx = pSkill`, `edx = pUnit`, `[esp+4] = pOutToHit`, `[esp+8] = nSkillLevel` (`ret 8`).
 *
 * @va D2Game:0x6FC89B00
 */
export function SKILLS_CalcUnitSkillToHit_6FC89B00_113c(
  m: D2KernMemory113c,
  pWeapon: number,
  pSkill: number,
  pUnit: number,
  pOutToHit: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FC89B00)
  const nBaseToHit = UNITS_GetPlayerBaseToHit113c(m, pUnit >>> 0) | 0
  m.setU32(pOutToHit >>> 0, nBaseToHit >>> 0)
  if (pSkill === 0) {
    throw new D2CommonAssertError('Skills.cpp', 0x963)
  }

  let pCurWeapon = pWeapon >>> 0
  if (pCurWeapon === 0) {
    const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
    pCurWeapon = INVENTORY_GetCompositWeaponMemPort113c(m, pInventory) >>> 0
  }
  if (pCurWeapon !== 0) {
    const nItemType = ITEMS_GetItemTypeFromItem113c(m, pCurWeapon) | 0
    if (nItemType === 0x26) {
      m.setU32(pOutToHit >>> 0, 0)
    }
  }

  const nMasteryPct = SKILLS_GetWeaponMasteryBonusMemPort113c(
    m,
    pUnit >>> 0,
    pCurWeapon,
    pSkill >>> 0,
    0,
  ) | 0
  const nItemToHitPct = STATLIST_GetUnitStatWithLayer113c(m, pUnit >>> 0, 0x77, 0) | 0
  const nBonusPct = (nMasteryPct + nItemToHitPct) | 0

  const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(m, pSkill >>> 0) >>> 0
  const nSkillToHit = m.u32((pSkillsTxt + 0x198) >>> 0) | 0
  const nLevToHit = m.u32((pSkillsTxt + 0x19c) >>> 0) | 0
  const nCurToHit = m.u32(pOutToHit >>> 0) | 0

  const nTotalPct = (imul32((nSkillLevel - 1) | 0, nLevToHit) + nSkillToHit + nBonusPct) | 0
  const nScaledBonus = Math.trunc(imul32(nTotalPct, nCurToHit) / 100) | 0
  const nUpdatedToHit = (nCurToHit + nScaledBonus) | 0
  m.setU32(pOutToHit >>> 0, nUpdatedToHit >>> 0)

  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 0) {
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    if (nClassId >= 0) {
      const pDataTables = resolveSgptDataTables113c(m)
      if (pDataTables !== 0) {
        const nCharStatsCount = m.u32((pDataTables + 0xbc8) >>> 0) | 0
        if (nClassId < nCharStatsCount) {
          const pCharStatsTxt = m.u32((pDataTables + 0xbc4) >>> 0) >>> 0
          const pRecord = (pCharStatsTxt + imul32(nClassId, 0xc4)) >>> 0
          if (pRecord !== 0) {
            const nToHitFactor = m.u32((pRecord + 0x3c) >>> 0) | 0
            m.setU32(pOutToHit >>> 0, ((nUpdatedToHit + nToHitFactor) | 0) >>> 0)
          }
        }
      }
    }
  }
}

/**
 * [6/45] Increments a well object's charge counter (`pObjectData->bCharges` at `+0x04`) up to
 * `2 * ObjectsTxt.dwParm[0]` (`+0x180`), updates the well's animation mode (`2 - charges / dwParm[0]`),
 * refreshes the unit in its room (`D2Common.#10158`), and sets unit flag `0x01`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pObject)` (`ret`).
 *
 * @va D2Game:0x6FC89CA0
 */
export function OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC89CA0)
  const pObjData0 = m.u32((pObject + 0x14) >>> 0) >>> 0
  const bl = m.u8((pObjData0 + 0x04) >>> 0)
  const edi = bl
  const pObjectsTxt = UNITS_GetObjectTxt113c(m, pObject >>> 0) >>> 0
  const nParm0 = m.u32((pObjectsTxt + 0x180) >>> 0) | 0
  const q0 = Math.trunc(edi / nParm0) | 0
  if (q0 >= 2) {
    throw new D2CommonAssertError('Objects.cpp', 0xdc)
  }

  const pObjData1 = m.u32((pObject + 0x14) >>> 0) >>> 0
  const al = (bl + 1) & 0xff
  m.setU8((pObjData1 + 0x04) >>> 0, al)
  const dl = (m.u8((pObjectsTxt + 0x180) >>> 0) << 1) & 0xff
  if (((dl - edi) | 0) < 0) {
    const alCap = (m.u8((pObjectsTxt + 0x180) >>> 0) << 1) & 0xff
    const pObjData2 = m.u32((pObject + 0x14) >>> 0) >>> 0
    m.setU8((pObjData2 + 0x04) >>> 0, alCap)
    const alCapCheck = (m.u8((pObjectsTxt + 0x180) >>> 0) << 1) & 0xff
    if (((alCapCheck - edi) | 0) < 0) {
      throw new D2CommonAssertError('Objects.cpp', 0xe3)
    }
    return
  }

  if (al <= dl) {
    const nHalfMax = dl >>> 1
    if ((al % nHalfMax) === 0) {
      const nFullSteps = Math.trunc(al / (m.u32((pObjectsTxt + 0x180) >>> 0) | 0)) | 0
      UNITS_ChangeAnimMode113c(m, pObject >>> 0, (2 - nFullSteps) | 0)
    }
  }
  UNITROOM_RefreshUnit113c(m, pObject >>> 0)
  m.setU32((pObject + 0xc4) >>> 0, (m.u32((pObject + 0xc4) >>> 0) | 1) >>> 0)
}

/**
 * [7/45] Restores `pUnit`'s hitpoints (`STAT_HITPOINTS = 6`) to maximum if damaged (setting `*pbHealedOut = 1`),
 * removes `STATE_POISON` (`2`) and `STATE_FREEZE` (`1`) stat lists, and purges experience-shrine / timed
 * state stat lists via `STATES_PurgeExpStateStatLists_6FCDC920_113c`.
 *
 * Binary convention: `__stdcall([esp+4] = pUnit, [esp+8] = pbHealedOut)` (`ret 8`).
 *
 * @va D2Game:0x6FC89DE0
 */
export function OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pbHealedOut: number,
): number {
  hitD2GameVa113c(0x6FC89DE0)
  const nCurLife = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0
  const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0
  if (nCurLife < nMaxLife) {
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 6, nMaxLife, 0)
    m.setU8(pbHealedOut >>> 0, 1)
  }

  const pPoisonList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 2) >>> 0
  if (pPoisonList !== 0) {
    STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pPoisonList)
    STATLIST_FreeStatListIfNonExtended113c(m, pPoisonList)
  }

  const pFreezeList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 1) >>> 0
  if (pFreezeList !== 0) {
    STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pFreezeList)
    STATLIST_FreeStatListIfNonExtended113c(m, pFreezeList)
  }

  return STATES_PurgeExpStateStatLists_6FCDC920_113c(m, pUnit >>> 0) | 0
}

/**
 * [8/45] Rolls a 0..99 random number on `pObject->tSeed` (`+0x20`) against entry `nIndex` in the
 * 12-byte object shrine/trap effect table at `0x6FD27D50` (count at `0x6FD27E4C`), asserts
 * `!IsBadCodePtr(entry.pfnHandler)` (line `0x10F5`), and dispatches `entry.pfnHandler(pGame, pObject, entry.dwArg)`.
 *
 * Binary convention: `cl = nIndex`, `edi = pObject`, `[esp+4] = pGame` (`ret 4`).
 *
 * @va D2Game:0x6FC89E50
 */
export function OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c(
  m: D2KernMemory113c,
  nIndex: number,
  pObject: number,
  pGame: number,
  onDispatchEffect?: (
    m: D2KernMemory113c,
    pfnHandlerVa: number,
    pGame: number,
    pObject: number,
    dwArg: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FC89E50)
  const nTableCount = m.u32(D2GAME_SHRINE_EFFECT_COUNT_VA_113C) | 0
  const idx = nIndex & 0xff
  if (idx >= nTableCount) {
    return 0
  }

  const newSeedLo = stepSeed64InPlace113c(m, (pObject + 0x20) >>> 0) >>> 0
  const nRoll = (newSeedLo % 100) >>> 0
  const pEntry = (D2GAME_SHRINE_EFFECT_TABLE_VA_113C + imul32(idx, 12)) >>> 0
  const dwChance = m.u32((pEntry + 0x04) >>> 0) >>> 0
  if (nRoll >= dwChance) {
    return 0
  }

  const pfnHandler = m.u32(pEntry) >>> 0
  const bBadCodePtr = pfnHandler === 0 || m.u32(D2GAME_IAT_IS_BAD_CODE_PTR_VA_113C) !== 0
  if (bBadCodePtr) {
    throw new D2CommonAssertError('Objects.cpp', 0x10f5)
  }

  const dwArg = m.u32((pEntry + 0x08) >>> 0) >>> 0
  if (onDispatchEffect !== undefined) {
    return onDispatchEffect(m, pfnHandler, pGame >>> 0, pObject >>> 0, dwArg) | 0
  }
  switch (pfnHandler) {
    case 0x6fc89730:
      return OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c(
        m,
        pGame >>> 0,
        pObject >>> 0,
        dwArg | 0,
      ) | 0
    case 0x6fc89710:
      return OBJECTS_GrantUnitEnergy_6FC89710_113c(m, pGame >>> 0, pObject >>> 0, dwArg | 0) | 0
    case 0x6fc896f0:
      return OBJECTS_GrantUnitDexterity_6FC896F0_113c(m, pGame >>> 0, pObject >>> 0, dwArg | 0) | 0
    case 0x6fc896d0:
      return OBJECTS_GrantUnitVitality_6FC896D0_113c(m, pGame >>> 0, pObject >>> 0, dwArg | 0) | 0
    case 0x6fc896b0:
      return OBJECTS_GrantUnitStrength_6FC896B0_113c(m, pGame >>> 0, pObject >>> 0, dwArg | 0) | 0
    case 0x6fc89670:
      return OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c(
        m,
        pGame >>> 0,
        pObject >>> 0,
        dwArg | 0,
      ) | 0
    case 0x6fc89650:
      return (
        OBJECTS_GrantUnitSkillPoints_6FC89650_113c(m, pGame >>> 0, pObject >>> 0, dwArg | 0) | 0
      )
    default:
      return 0
  }
}

/**
 * [9/45] Spawns a monster (`nMonsterId`) from an operated object (`pOperateArgs`) in concentric rings
 * (`nMaxRadius = -1`, then `1`, then `3`) via `MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c`,
 * blocking Flying Scimitar (`0xEA = 234`) in Act 1 (`DRLG_GetActNoFromLevelId113c == 0`).
 *
 * Binary convention: `ebx = nMonsterId`, `esi = pOperateArgs`, `[esp+4] = nMode` (`ret 4`).
 *
 * @va D2Game:0x6FC8A050
 */
export function OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c(
  m: D2KernMemory113c,
  nMonsterId: number,
  pOperateArgs: number,
  nMode: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FC8A050)
  const monId = nMonsterId | 0
  if (monId < 0) return 0

  const pDataTables = resolveSgptDataTables113c(m)
  if (pDataTables === 0 || monId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)) {
    return 0
  }

  const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, pObject0) >>> 0
  if (monId === 0xea && pRoom !== 0) {
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
    if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) === 0) {
      return 0
    }
  }

  let pSpawned =
    MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c(
      m,
      m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
      nMode | 0,
      monId,
      m.u32(pOperateArgs >>> 0) >>> 0,
      -1,
      0,
      hooks,
    ) >>> 0
  if (pSpawned !== 0) {
    return pSpawned | 0
  }

  pSpawned =
    MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c(
      m,
      m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
      nMode | 0,
      monId,
      m.u32(pOperateArgs >>> 0) >>> 0,
      1,
      0,
      hooks,
    ) >>> 0
  if (pSpawned !== 0) {
    return pSpawned | 0
  }

  return (
    MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c(
      m,
      m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
      nMode | 0,
      monId,
      m.u32(pOperateArgs >>> 0) >>> 0,
      3,
      0,
      hooks,
    ) | 0
  )
}

/**
 * [10/45] Clears the owner player GUID (`*pOwnerGuid = 0xFFFFFFFF`) on object class `0x151` (`337`)
 * when `pPlayer == 0` or when the resolved player in `pGame->pUnitHash[0]` matches `pPlayer`.
 *
 * Binary convention: `eax = pGame`, `ecx = pObject`, `edi = pPlayer` (`ret`).
 *
 * @va D2Game:0x6FC8A1A0
 */
export function OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObject: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC8A1A0)
  if (pObject === 0) return
  if ((m.u32((pObject + 0x04) >>> 0) | 0) !== 0x151) return

  const pField7C = UNITS_GetField7C_113c(m, pObject >>> 0) >>> 0
  const pOwnerGuidPtr = pField7C !== 0 ? m.u32(pField7C) >>> 0 : 0
  if (pPlayer === 0) {
    if (pOwnerGuidPtr !== 0) {
      m.setU32(pOwnerGuidPtr, 0xffffffff)
    }
    return
  }
  if (pOwnerGuidPtr === 0) return

  const dwOwnerGuid = m.u32(pOwnerGuidPtr) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
  }

  const bucketIdx = dwOwnerGuid & 0x7f
  let pUnit = m.u32((pGame + 0x1120 + (bucketIdx << 2)) >>> 0) >>> 0
  while (pUnit !== 0) {
    if ((m.u32((pUnit + 0x0c) >>> 0) >>> 0) === dwOwnerGuid) {
      break
    }
    pUnit = m.u32((pUnit + 0xe4) >>> 0) >>> 0
  }

  if (pUnit === (pPlayer >>> 0)) {
    m.setU32(pOwnerGuidPtr, 0xffffffff)
  }
}

/**
 * [11/45] Resolves an object unit by `dwObjectGuid` in `pGame->pUnitHash[2]` (`+0x1520`), checks
 * collision mask `0x8180` across its footprint (`D2Common.#11008`), and switches its animation mode
 * between `2` (unblocked) and `5` (blocked).
 *
 * Binary convention: `eax = pGame`, `ecx = dwObjectGuid` (`ret`).
 *
 * @va D2Game:0x6FC8A220
 */
export function OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwObjectGuid: number,
): void {
  hitD2GameVa113c(0x6FC8A220)
  if (pGame === 0) {
    throw new D2CommonAssertError('SUnit.cpp', 0x2d3)
  }

  const bucketIdx = dwObjectGuid & 0x7f
  let pObject = m.u32((pGame + 0x1520 + (bucketIdx << 2)) >>> 0) >>> 0
  while (pObject !== 0) {
    if ((m.u32((pObject + 0x0c) >>> 0) >>> 0) === (dwObjectGuid >>> 0)) {
      break
    }
    pObject = m.u32((pObject + 0xe4) >>> 0) >>> 0
  }
  if (pObject === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0xd37)
  }

  const pRoom = UNITS_GetRoom113c(m, pObject) >>> 0
  const pCoords = allocStackFrame113c(8)
  try {
    PATH_GetTargetTypeAndPosition113c(m, pObject, pCoords)
    const nX = m.u32(pCoords) | 0
    const nY = m.u32((pCoords + 0x04) >>> 0) | 0
    const nSizeX = UNITS_GetUnitSizeX113c(m, pObject) | 0
    const nSizeY = UNITS_GetUnitSizeY113c(m, pObject) | 0
    const nMode = m.u32((pObject + 0x10) >>> 0) | 0

    if (nMode === 0) {
      COLLISION_CheckMaskWithSizeXY113c(m, pRoom, nX, nY, nSizeX, nSizeY, 0x8180)
      return
    }
    if (nMode === 2 || nMode === 5) {
      const wHit =
        COLLISION_CheckMaskWithSizeXY113c(m, pRoom, nX, nY, nSizeX, nSizeY, 0x8180) & 0xffff
      if (wHit === 0) {
        if (nMode !== 2) {
          UNITS_ChangeAnimMode113c(m, pObject, 2)
        }
      } else if (nMode !== 5) {
        UNITS_ChangeAnimMode113c(m, pObject, 5)
      }
    }
  } finally {
    freeStackFrame113c(pCoords)
  }
}

function dispatchObjectOperateFnByVa113c(
  m: D2KernMemory113c,
  pfnOperate: number,
  pOperateArgs: number,
): number {
  const sm = m as SparseMemory113c
  switch (pfnOperate) {
    case 0x6fc8ef40:
      return OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c(m, pOperateArgs) | 0
    case 0x6fc8da00:
      return OBJ_OperateShrine_6FC8DA00_113c(m, pOperateArgs) | 0
    case 0x6fc8ecd0:
      return OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c(m, pOperateArgs) | 0
    case 0x6fc8f040:
      return OBJ_OperateChestAndSparkyChest_6FC8F040_113c(sm, pOperateArgs) | 0
    case 0x6fc8d7b0:
      return OBJ_OperateFn28_Urn_6FC8D7B0_113c(m, pOperateArgs) | 0
    case 0x6fc88d70:
      return ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70_113c(sm, pOperateArgs) | 0
    case 0x6fc8d740:
      return OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c(m, pOperateArgs) | 0
    case 0x6fc8a9d0:
      return OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c(sm, pOperateArgs) | 0
    case 0x6fc864f0:
      ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c(m, pOperateArgs)
      return 0
    case 0x6fc88fc0:
      return ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c(m, pOperateArgs) | 0
    case 0x6fc89a80:
      return OBJECTS_OperateToggleObjectMode012_6FC89A80_113c(m, pOperateArgs) | 0
    case 0x6fc85b40:
      return ACT1Q4_OperateInifussTree_6FC85B40_113c(sm, pOperateArgs) | 0
    case 0x6fc89ad0:
      return OBJ_ToggleNeutralAndOperatingMode_6FC89AD0_113c(m, pOperateArgs) | 0
    case 0x6fc8ec20:
      return OBJ_OperateChestAndDropTreasure_6FC8EC20_113c(m, pOperateArgs) | 0
    case 0x6fc8d0f0:
      return OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c(sm, pOperateArgs) | 0
    case 0x6fc8bcb0:
      return OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c(sm, pOperateArgs) | 0
    case 0x6fc8a7a0:
      return OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c(m, pOperateArgs) | 0
    case 0x6fc8d8f0:
      return OBJ_OperateBreakawayObject_6FC8D8F0_113c(m, pOperateArgs) | 0
    case 0x6fc8b2e0:
      return OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c(m, pOperateArgs) | 0
    case 0x6fc8b280:
      return OBJ_OperateFn20_WeaponRack_6FC8B280_113c(m, pOperateArgs) | 0
    case 0x6fc85d40:
      return ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c(sm, pOperateArgs) | 0
    case 0x6fc8cee0:
      return OBJ_OperateWell_6FC8CEE0_113c(m, pOperateArgs) | 0
    case 0x6fc8cf90:
      return OBJ_OperateWaypoint_6FC8CF90_113c(m, pOperateArgs) | 0
    case 0x6fce76b0:
      return ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c(sm, pOperateArgs) | 0
    case 0x6fce6240:
      return ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c(m, pOperateArgs) | 0
    case 0x6fc8b340:
      return OBJ_OperateTomeOrScrollStand_6FC8B340_113c(m, pOperateArgs) | 0
    case 0x6fc8be40:
      return OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c(sm, pOperateArgs) | 0
    case 0x6fd094c0:
      return ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c(sm, pOperateArgs) | 0
    case 0x6fc8de00:
      return OBJ_OperateGenericMode0To1_6FC8DE00_113c(m, pOperateArgs) | 0
    case 0x6fc8e0e0:
      return OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c(sm, pOperateArgs) | 0
    case 0x6fd09c80:
      return ACT3Q2_OperateGidbinnAltar_6FD09C80_113c(sm, pOperateArgs) | 0
    case 0x6fc91290:
      return OBJECTS_OperateBankStash_6FC91290_113c(sm, pOperateArgs) | 0
    case 0x6fc8d960:
      return OBJ_OperateWirtsBody_6FC8D960_113c(m, pOperateArgs) | 0
    case 0x6fc8d620:
      return D2Game_6FC8D620_113c(sm, pOperateArgs) | 0
    case 0x6fcea050:
      return ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c(m, pOperateArgs) | 0
    case 0x6fcea290:
      return ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c(m, pOperateArgs) | 0
    case 0x6fcea170:
      return ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c(m, pOperateArgs) | 0
    case 0x6fce9a80:
      return ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c(sm, pOperateArgs) | 0
    case 0x6fc8bb60:
      return OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c(sm, pOperateArgs) | 0
    case 0x6fd095e0:
      return D2Game_6FD095E0_113c(sm, pOperateArgs) | 0
    case 0x6fd09f60:
      return ACT3Q3_OperateSewerLeverObject_6FD09F60_113c(m, pOperateArgs) | 0
    case 0x6fc8cd40:
      return OBJ_OperateDuranceStairs_6FC8CD40_113c(m, pOperateArgs) | 0
    case 0x6fc8dfc0:
      return OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c(sm, pOperateArgs) | 0
    case 0x6fc8ce10:
      return OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c(m, pOperateArgs) | 0
    case 0x6fcdb8d0:
      return ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c(sm, pOperateArgs) | 0
    case 0x6fc8f4f0:
      return D2Game_6FC8F4F0_113c(sm, pOperateArgs) | 0
    case 0x6fc8eb40:
      return OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c(m, pOperateArgs) | 0
    case 0x6fcdbf30:
      return ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c(sm, pOperateArgs) | 0
    case 0x6fd0a140:
      return ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c(m, pOperateArgs) | 0
    case 0x6fcdc580:
      return ACT4Q3_OnSeal1Operate_6FCDC580_113c(sm, pOperateArgs) | 0
    case 0x6fcdc510:
      return ACT4Q3_OnSeal3Operate_6FCDC510_113c(sm, pOperateArgs) | 0
    case 0x6fcdc4a0:
      return ACT4Q3_OnSeal5Operate_6FCDC4A0_113c(sm, pOperateArgs) | 0
    case 0x6fd0a5f0:
      return ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c(m, pOperateArgs) | 0
    case 0x6fd0a4c0:
      return ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c(m, pOperateArgs) | 0
    case 0x6fd0a390:
      return ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c(m, pOperateArgs) | 0
    case 0x6fc8dec0:
      return OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c(m, pOperateArgs) | 0
    case 0x6fc79b00:
      return ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c(m, pOperateArgs) | 0
    case 0x6fc79ab0:
      return ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c(m, pOperateArgs) | 0
    case 0x6fc79a60:
      return ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c(m, pOperateArgs) | 0
    case 0x6fc7d0a0:
      return ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c(sm, pOperateArgs) | 0
    case 0x6fc7e2a0:
      return D2Game_6FC7E2A0_113c(sm, pOperateArgs) | 0
    case 0x6fc7cd50:
      ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c(m, pOperateArgs)
      return 0
    case 0x6fc8edb0:
      return OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c(sm, pOperateArgs) | 0
    case 0x6fc78da0:
      return ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c(m, pOperateArgs) | 0
    case 0x6fc7df70:
      return D2Game_6FC7DF70_113c(sm, pOperateArgs) | 0
    case 0x6fc7d690:
      return D2Game_6FC7D690_113c(sm, pOperateArgs) | 0
    case 0x6fc7fd00:
      return ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c(sm, pOperateArgs) | 0
    case 0x6fcdb550:
      return ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c(sm, pOperateArgs) | 0
    default:
      return 0
  }
}

/**
 * [12/45] Validates and dispatches an object operation from `pPlayer` on `(wUnitType, dwObjectId)`:
 * sets `*pOutFlag = 1`, verifies player trade/cursor state (allowing cursor items only on Stash `0x10B`),
 * asserts `ObjectsTxt.bOperateFn < 0x65` (line `0xCF8`), skips town portal / waypoint classes (`0x79`, `0x7A`, `0x16`),
 * and invokes `gpObjectOperateFnTable[bOperateFn](&tOperateArgs)`.
 *
 * Binary convention: `eax = pOutFlag`, `edx = dwObjectId`, `ebx = pGame`, `edi = pPlayer`, `[esp+4] = wUnitType` (`ret 4`).
 *
 * @va D2Game:0x6FC8A330
 */
export function OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c(
  m: D2KernMemory113c,
  pOutFlag: number,
  dwObjectId: number,
  pGame: number,
  pPlayer: number,
  wUnitType: number,
  onDispatchOperate?: (
    m: D2KernMemory113c,
    pfnOperateVa: number,
    pOperateArgs: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FC8A330)
  m.setU32(pOutFlag >>> 0, 1)
  const pObject = SUNIT_GetServerUnit113c(
    m,
    pGame >>> 0,
    wUnitType & 0xffff,
    dwObjectId >>> 0,
  ) >>> 0
  const nClassId = pObject !== 0 ? m.u32((pObject + 0x04) >>> 0) | 0 : -1
  const pObjectsTxt = UNITS_GetObjectTxt113c(m, pObject) >>> 0

  if (pPlayer !== 0 && (m.u32(pPlayer >>> 0) | 0) === 0) {
    if (m.u8((pPlayer + 0x6c) >>> 0) !== 0) {
      return 0
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    if (m.u32((pPlayerData + 0x4c) >>> 0) !== 0) {
      return 0
    }
    const pInventory = m.u32((pPlayer + 0x60) >>> 0) >>> 0
    const pCursorItem = INVENTORY_GetCursorItem113c(m, pInventory) >>> 0
    if (pCursorItem !== 0 && nClassId !== 0x10b) {
      return 0
    }
  }

  const bOperateFn = m.u8((pObjectsTxt + 0x1b3) >>> 0)
  if (bOperateFn >= 0x65) {
    throw new D2CommonAssertError('Objects.cpp', 0xcf8)
  }
  if (nClassId === 0x79 || nClassId === 0x7a || nClassId === 0x16) {
    return 0
  }

  const pfnOperateCheck =
    m.u32((D2GAME_OBJECT_OPERATE_TABLE_VA_113C + (bOperateFn << 2)) >>> 0) >>> 0
  if (pfnOperateCheck === 0) {
    return 0
  }

  const pOperateArgs = allocStackFrame113c(0x18)
  try {
    m.setU32(pOperateArgs, pGame >>> 0)
    m.setU32((pOperateArgs + 0x04) >>> 0, pObject)
    m.setU32((pOperateArgs + 0x08) >>> 0, pPlayer >>> 0)
    UNITS_GetRoom113c(m, pObject)
    m.setU32((pOperateArgs + 0x0c) >>> 0, m.u32((pGame + 0x10f0) >>> 0) >>> 0)
    m.setU32((pOperateArgs + 0x10) >>> 0, nClassId >>> 0)
    const bOperateFnCall = m.u8((pObjectsTxt + 0x1b3) >>> 0)
    const pfnOperate =
      m.u32((D2GAME_OBJECT_OPERATE_TABLE_VA_113C + (bOperateFnCall << 2)) >>> 0) >>> 0
    if (onDispatchOperate !== undefined) {
      return onDispatchOperate(m, pfnOperate, pOperateArgs) | 0
    }
    return dispatchObjectOperateFnByVa113c(m, pfnOperate, pOperateArgs) | 0
  } finally {
    freeStackFrame113c(pOperateArgs)
  }
}

/**
 * [13/45] Filter callback that returns `1` if `pCandidateUnit` is an alive, unaligned (`UNIT_GetAlignment113c == 0`),
 * hostile (`!UNITS_AreUnitsAligned113c`) normal monster in mode `1` (`NU`) or `2` (`WL`) whose `MonStats2`
 * supports mode `2` (`MONSTATS2_CheckModeBit113c`), has `bCritter == 0` (`+0x0B != 0`), is not a boss/champion
 * (`MONSTER_CheckTypeFlagsMask113c(0x1F) == 0`), and is not an NPC/interactable monster.
 *
 * Binary convention: `__fastcall(ecx = pCandidateUnit, edx = pSourceUnit)` (`ret`).
 *
 * @va D2Game:0x6FC8A440
 */
export function OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c(
  m: D2KernMemory113c,
  pCandidateUnit: number,
  pSourceUnit: number,
): number {
  hitD2GameVa113c(0x6FC8A440)
  if ((pCandidateUnit >>> 0) === (pSourceUnit >>> 0) || pCandidateUnit === 0) return 0
  if ((m.u32(pCandidateUnit >>> 0) | 0) !== 1) return 0
  if ((UNITS_AreUnitsAligned113c(m, pSourceUnit >>> 0, pCandidateUnit >>> 0) | 0) === 1) return 0
  if ((UNIT_GetAlignment113c(m, pCandidateUnit >>> 0) | 0) !== 0) return 0
  if ((MONSTERS_IsDead113c(m, pCandidateUnit >>> 0) | 0) !== 0) return 0

  const nMode = m.u32((pCandidateUnit + 0x10) >>> 0) | 0
  if (nMode !== 1 && nMode !== 2) return 0

  const nClassId = m.u32((pCandidateUnit + 0x04) >>> 0) | 0
  if ((MONSTATS2_CheckModeBit113c(m, nClassId, 2) | 0) === 0) return 0

  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, nClassId) >>> 0
  if (pMonStats2 === 0 || m.u8((pMonStats2 + 0x0b) >>> 0) === 0) return 0

  const pMonStatsTxt = MONSTER_GetMonStatsTxtFromUnit_6FC21540_113c(m, pCandidateUnit >>> 0) >>> 0
  if (pMonStatsTxt === 0) return 0
  if ((MONSTERS_CheckMonStatsFlagBit6_113c(m, pMonStatsTxt, pCandidateUnit >>> 0) | 0) !== 0) {
    return 0
  }
  if ((MONSTER_GetMonStatsInteractBit113c(m, pCandidateUnit >>> 0) | 0) !== 0) return 0

  const bHasSpecialFlags = MONSTER_CheckTypeFlagsMask113c(m, pCandidateUnit >>> 0, 0x1f) | 0
  return bHasSpecialFlags === 0 ? 1 : 0
}

/**
 * [14/45] Operates a special book/tome/altar object (`0x6FC8A7A0`):
 * - If the object is already in mode `3` and the player is interacting with it, clears the player's
 *   interaction fields (`+0x64 = -1`, `+0x68 = 6`, `+0x6C = 0`) and sets object mode to `1`.
 * - If the object is in mode `0`, checks that the player has an item of type `0x14` (`20`) via `0x6FC898E0`
 *   (playing error sound `0x13` if missing), records the object interaction via `0x6FCFFAE0`, sets object
 *   mode to `3`, and sends 7-byte UI open packet `0x58` via `0x6FCAAB20`.
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs)` (`ret`).
 *
 * @va D2Game:0x6FC8A7A0
 */
export function OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8A7A0)
  const pGame = m.u32(pOperateArgs >>> 0) >>> 0
  const pPlayer0 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  let pInteractingUnit = 0
  if (m.u8((pPlayer0 + 0x6c) >>> 0) !== 0) {
    const dwTargetId = m.u32((pPlayer0 + 0x64) >>> 0) >>> 0
    const dwTargetType = m.u32((pPlayer0 + 0x68) >>> 0) >>> 0
    pInteractingUnit = SUNIT_GetServerUnit113c(m, pGame, dwTargetType, dwTargetId) >>> 0
  }

  const pPlayer1 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  let pClient = 0
  if (pPlayer1 !== 0 && (m.u32(pPlayer1) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer1) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  if (pObject0 !== 0) {
    const nMode = m.u32((pObject0 + 0x10) >>> 0) | 0
    if (nMode !== 0) {
      if (nMode !== 3 || pInteractingUnit !== pObject0) {
        return 1
      }
      const pPlayerClose = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
      m.setU32((pPlayerClose + 0x64) >>> 0, 0xffffffff)
      m.setU32((pPlayerClose + 0x68) >>> 0, 6)
      m.setU8((pPlayerClose + 0x6c) >>> 0, 0)
      UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0, 1)
      return 1
    }
  }

  const pPlayer2 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  if (pPlayer2 !== 0 && (m.u32(pPlayer2) | 0) === 0) {
    if (m.u8((pPlayer2 + 0x6c) >>> 0) !== 0) {
      return 1
    }
    const pInventory = m.u32((pPlayer2 + 0x60) >>> 0) >>> 0
    if (INVENTORY_GetCursorItem113c(m, pInventory) !== 0) {
      return 1
    }
    const pPlayerData2 = UNITS_GetPlayerData113c(m, pPlayer2) >>> 0
    if ((m.u32((pPlayerData2 + 0x4c) >>> 0) | 0) === 1) {
      return 1
    }
  }

  const pPlayer3 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  if ((OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c(m, pPlayer3, 0x14) | 0) === 0) {
    const pPlayerNoItem = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
    SUNIT_SetUnitEventSound113c(m, pPlayerNoItem, 0x13, pPlayerNoItem)
    return 1
  }

  const pObject1 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  const dwObjGuid1 = pObject1 !== 0 ? m.u32((pObject1 + 0x0c) >>> 0) >>> 0 : 0xffffffff
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c(
    m,
    m.u32((pOperateArgs + 0x08) >>> 0) >>> 0,
    2,
    dwObjGuid1,
  )
  UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0, 3)

  const pObject2 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  const dwObjGuid2 = pObject2 !== 0 ? m.u32((pObject2 + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const pPkt = allocStackFrame113c(8)
  try {
    m.setU8(pPkt, 0x58)
    m.setU32((pPkt + 0x01) >>> 0, dwObjGuid2)
    m.setU8((pPkt + 0x05) >>> 0, 0)
    NET_SendPacketBuffer7B_6FCAAB20_113c(m, pPkt, pClient)
  } finally {
    freeStackFrame113c(pPkt)
  }
  return 1
}

/**
 * [15/45] Stamina shrine timed-state removal callback (`0x6FC8A900`):
 * Invokes `STATES_OnTimedStateRemoved113c` (`0x6FCBF7A0`) and sets `STAT_STAMINA` (`0x0A`)
 * to `STATLIST_GetMaxStaminaFromUnit113c(pUnit)`.
 *
 * Binary convention: `__fastcall(ecx = pUnit, edx = nState, [esp+4] = pStatList)` (`ret 4`).
 *
 * @va D2Game:0x6FC8A900
 */
export function OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
  pStatList: number,
): void {
  hitD2GameVa113c(0x6FC8A900)
  STATES_OnTimedStateRemoved113c(m, pUnit >>> 0, nState | 0, pStatList >>> 0)
  const nMaxStamina = STATLIST_GetMaxStaminaFromUnit113c(m, pUnit >>> 0) | 0
  STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0a, nMaxStamina, 0)
}


/**
 * [16/45] Builds a 9-dword (`0x24`-byte) aura stat-list setup struct on the stack and invokes
 * `STATES_CreateOrUpdateAuraStatList113c` (`0x6FCC00B0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = arg0, [esp+8] = arg1, [esp+0xC] = arg2, [esp+0x10] = arg3, [esp+0x14] = arg4)` (`ret 0x14`).
 *
 * @va D2Game:0x6FC8A960
 */
export function OBJ_ApplyShrineAuraStatList_6FC8A960_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  dwStateOrSkill: number,
  dwParam18: number,
  dwStatId: number,
  dwStatValue: number,
  dwExpireFrame: number,
): number {
  hitD2GameVa113c(0x6FC8A960)
  const pSetup = allocStackFrame113c(0x24)
  try {
    m.setU32(pSetup, pGame >>> 0)
    m.setU32((pSetup + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSetup + 0x08) >>> 0, 0)
    m.setU32((pSetup + 0x0c) >>> 0, 0)
    m.setU32((pSetup + 0x10) >>> 0, dwStateOrSkill >>> 0)
    m.setU32((pSetup + 0x14) >>> 0, dwStatId >>> 0)
    m.setU32((pSetup + 0x18) >>> 0, dwParam18 >>> 0)
    m.setU32((pSetup + 0x1c) >>> 0, dwStatValue >>> 0)
    m.setU32((pSetup + 0x20) >>> 0, dwExpireFrame >>> 0)
    return STATES_CreateOrUpdateAuraStatList113c(m, pSetup) | 0
  } finally {
    freeStackFrame113c(pSetup)
  }
}

/**
 * [17/45] Spawns an item by 4-char item code (`dwItemCode`) at free ground coordinates near `pUnit`
 * with quality `nQuality` (`[ebp+0xC]`) and item level `ITEMS_GetDropItemLevel113c(pGame, pUnit, 0)`.
 *
 * Binary convention: `eax = dwItemCode`, `ebx = pUnit`, `[ebp+8] = pGame`, `[ebp+0xC] = nQuality` (`ret 8`).
 *
 * @va D2Game:0x6FC8AFA0
 */
export function OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(
  m: D2KernMemory113c,
  dwItemCode: number,
  pUnit: number,
  pGame: number,
  nQuality: number,
  onFindFreeDropRoom?: (
    m: D2KernMemory113c,
    pRoom: number,
    pInCoords: number,
    pOutCoords: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FC8AFA0)
  const nItemId = DATATBLS_GetItemIdFromItemCode113c(m, dwItemCode >>> 0) | 0
  if (nItemId === -1) {
    return 0
  }

  const pFrame = allocStackFrame113c(0xa0)
  try {
    const pInCoords = (pFrame + 0x18) >>> 0
    const pOutCoords = (pFrame + 0x10) >>> 0
    const pItemDrop = (pFrame + 0x20) >>> 0

    PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, pInCoords)
    const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
    let pDropRoom = 0
    if (onFindFreeDropRoom !== undefined) {
      pDropRoom = onFindFreeDropRoom(m, pRoom, pInCoords, pOutCoords) >>> 0
    } else {
      pDropRoom =
        ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, pRoom, pInCoords, pOutCoords, 1) >>> 0
    }
    if (pDropRoom === 0) {
      return 0
    }

    for (let i = 0; i < 0x21; i++) {
      m.setU32((pItemDrop + (i << 2)) >>> 0, 0)
    }
    const wItemFormat = pGame !== 0 ? m.u16((pGame + 0x78) >>> 0) : 0
    m.setU32(pItemDrop, pUnit >>> 0)
    m.setU32((pItemDrop + 0x04) >>> 0, 0)
    m.setU32((pItemDrop + 0x08) >>> 0, pGame >>> 0)
    m.setU32((pItemDrop + 0x14) >>> 0, nItemId >>> 0)
    m.setU32((pItemDrop + 0x18) >>> 0, 3)
    m.setU32((pItemDrop + 0x1c) >>> 0, m.u32(pOutCoords) >>> 0)
    m.setU32((pItemDrop + 0x20) >>> 0, m.u32((pOutCoords + 0x04) >>> 0) >>> 0)
    m.setU32((pItemDrop + 0x24) >>> 0, pDropRoom)
    m.setU16((pItemDrop + 0x28) >>> 0, 1)
    m.setU16((pItemDrop + 0x2a) >>> 0, wItemFormat)
    m.setU32((pItemDrop + 0x30) >>> 0, nQuality >>> 0)

    const nIlvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, pGame >>> 0, pUnit >>> 0, 0) | 0
    m.setU32((pItemDrop + 0x0c) >>> 0, nIlvl >>> 0)
    return D2GAME_CreateItemEx_6FC31490_113c(m, pGame >>> 0, pItemDrop, 0) | 0
  } finally {
    freeStackFrame113c(pFrame)
  }
}

/**
 * [18/45] Computes the chest treasure-class tier (`0..2`) for an operated chest/container (`pOperateArgs`)
 * from the level's monster level relative to the Act's min/max level monster levels (`0x6FD1BD8C`/`0x6FD1BD90`),
 * resolves the chest `TreasureClass` via `DATATBLS_GetChestTreasureClass113c`, and drops items via
 * `ITEMS_ChooseTreasureClassItem113c`.
 *
 * Binary convention: `__stdcall([esp+4] = pOperateArgs, [esp+8] = nDropArg)` (`ret 8`).
 *
 * @va D2Game:0x6FC8B570
 */
export function OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  nDropArg: number,
): number {
  hitD2GameVa113c(0x6FC8B570)
  const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  if (pObject0 === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0x1313)
  }
  const pGame = m.u32((pObject0 + 0x80) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0x1315)
  }
  if (UNITS_GetObjectTxt113c(m, pObject0) === 0) {
    throw new D2CommonAssertError('Objects.cpp', 0x1317)
  }

  const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, pObject) >>> 0
  if (pRoom === 0) {
    return 0
  }

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0)
  const bExpansion = m.u32((pGame + 0x70) >>> 0) >>> 0
  const nCurMlvl = DATATBLS_GetLevelMonsterLevel113c(m, nLevelId, nDifficulty, bExpansion) | 0

  const nActStartMem = m.u32((0x6fd1bd8c + (nAct << 3)) >>> 0) | 0
  const nActStartLvl =
    nActStartMem !== 0 ? nActStartMem : nAct < 5 ? ACT_CHEST_LEVEL_RANGE_113C[nAct]![0] : 0
  const nMinMlvl = DATATBLS_GetLevelMonsterLevel113c(m, nActStartLvl, nDifficulty, bExpansion) | 0
  const nActEndMem = m.u32((0x6fd1bd90 + (nAct << 3)) >>> 0) | 0
  const nActEndLvl =
    nActEndMem !== 0 ? nActEndMem : nAct < 5 ? ACT_CHEST_LEVEL_RANGE_113C[nAct]![1] : 0
  const nMaxMlvl = DATATBLS_GetLevelMonsterLevel113c(m, nActEndLvl, nDifficulty, bExpansion) | 0

  let nSpan = (nMaxMlvl - nMinMlvl) | 0
  if (nSpan < 0) nSpan = -nSpan
  const nStep = Math.trunc(((nSpan + 1) | 0) / 3) | 0
  let nTier = 0
  if (nCurMlvl >= ((nMinMlvl + nStep) | 0)) {
    nTier = nCurMlvl >= ((nMinMlvl + (nStep << 1)) | 0) ? 2 : 1
  }

  const pTc = DATATBLS_GetChestTreasureClass113c(m, nDifficulty, nAct, nTier) >>> 0
  if (pTc === 0) {
    return 0
  }

  const pKiller = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  const pOutBuf = allocStackFrame113c(0x1c)
  try {
    for (let i = 0; i < 7; i++) {
      m.setU32((pOutBuf + (i << 2)) >>> 0, 0)
    }
    const pnItemsDropped = pOutBuf
    const ppOutItems = (pOutBuf + 0x04) >>> 0
    ITEMS_ChooseTreasureClassAndDrop_6FC32380_113c(
      m,
      pGame,
      pObject,
      pKiller,
      pTc,
      nDropArg | 0,
      nTier | 0,
      0,
      ppOutItems,
      pnItemsDropped,
      6,
    )
    return m.u32(ppOutItems) >>> 0
  } finally {
    freeStackFrame113c(pOutBuf)
  }
}

/**
 * [19/45] Spawns a single monster of class `nMonsterId` (`[esp+0x44]`) in mode `1` (`NU`) at `pObject`'s
 * coordinates via `MONSTER_Create113c` (`0x6FD0EF10`, flags `0x88`), falling back to `COLLISION_FindFreeCoordsNear113c`
 * (mask `0x3F11`) and `MONSTER_SpawnAtCoords113c` (`0x6FD0F650`, radius `3`, flags `8`).
 *
 * Binary convention: `esi = pObject`, `[esp+4] = pGame`, `[esp+8] = nMonsterId` (`ret 8`).
 *
 * @va D2Game:0x6FC8B7A0
 */
export function OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(
  m: D2KernMemory113c,
  pObject: number,
  pGame: number,
  nMonsterId: number,
  hooks?: RegpopSpawnHooks113c,
): number {
  hitD2GameVa113c(0x6FC8B7A0)
  const pFrame = allocStackFrame113c(0x38)
  try {
    const pCoords = pFrame
    const pSpawnArgs = (pFrame + 0x08) >>> 0
    const ppRoomOut = (pFrame + 0x30) >>> 0

    PATH_GetTargetTypeAndPosition113c(m, pObject >>> 0, pCoords)
    const nX = m.u32(pCoords) | 0
    const nY = m.u32((pCoords + 0x04) >>> 0) | 0
    const pRoom = UNITS_GetRoom113c(m, pObject >>> 0) >>> 0

    m.setU32(pSpawnArgs, pGame >>> 0)
    m.setU32((pSpawnArgs + 0x04) >>> 0, pRoom)
    m.setU32((pSpawnArgs + 0x08) >>> 0, 0)
    m.setU32((pSpawnArgs + 0x0c) >>> 0, nMonsterId >>> 0)
    m.setU32((pSpawnArgs + 0x10) >>> 0, 1)
    m.setU32((pSpawnArgs + 0x14) >>> 0, 0)
    m.setU32((pSpawnArgs + 0x18) >>> 0, nX >>> 0)
    m.setU32((pSpawnArgs + 0x1c) >>> 0, nY >>> 0)
    m.setU32((pSpawnArgs + 0x20) >>> 0, 0xffffffff)
    m.setU16((pSpawnArgs + 0x24) >>> 0, 0x88)

    let pMonster = MONSTER_Create113c(m, pSpawnArgs, hooks) >>> 0
    if (pMonster === 0) {
      const pRoomRetry = UNITS_GetRoom113c(m, pObject >>> 0) >>> 0
      m.setU32(ppRoomOut, 0)
      COLLISION_FindFreeCoordsNear113c(m, pRoomRetry, pCoords, 0, 0x3f11, ppRoomOut)
      const pFreeRoom = m.u32(ppRoomOut) >>> 0
      if (pFreeRoom !== 0) {
        pMonster =
          MONSTER_SpawnAtCoords113c(
            m,
            nMonsterId | 0,
            1,
            pGame >>> 0,
            pFreeRoom,
            m.u32(pCoords) | 0,
            m.u32((pCoords + 0x04) >>> 0) | 0,
            3,
            8,
            hooks,
          ) >>> 0
      }
    }
    return pMonster | 0
  } finally {
    freeStackFrame113c(pFrame)
  }
}

/**
 * [20/45] Spawns fire/explosion hazard object `0xA2` (`162`) at `pSourceUnit`'s subtile `(x, y)`
 * and, if `(x + 1)` lies within the room's subtile X bounds (`[roomX, roomX + roomW)`), also spawns
 * companion object `0xA0` (`160`) at `(x + 1, y)`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pSourceUnit)` (`ret`).
 *
 * @va D2Game:0x6FC8BF00
 */
export function OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pSourceUnit: number,
): void {
  hitD2GameVa113c(0x6FC8BF00)
  const pFrame = allocStackFrame113c(0x28)
  try {
    const pCoords = pFrame
    const pRoomCoords = (pFrame + 0x08) >>> 0

    PATH_GetTargetTypeAndPosition113c(m, pSourceUnit >>> 0, pCoords)
    const pRoom0 = UNITS_GetRoom113c(m, pSourceUnit >>> 0) >>> 0
    const nX0 = m.u32(pCoords) | 0
    const nY0 = m.u32((pCoords + 0x04) >>> 0) | 0
    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0

    const pObjA2 = UNIT_Alloc113c(m, 2) >>> 0
    if (pObjA2 !== 0) {
      m.setU32(pObjA2, 2)
      m.setU32((pObjA2 + 0x04) >>> 0, 0xa2)
      m.setU32((pObjA2 + 0x08) >>> 0, pMemPool)
      m.setU32((pObjA2 + 0x80) >>> 0, pGame >>> 0)
      let dwFlagsC8 = m.u32((pObjA2 + 0xc8) >>> 0) >>> 0
      dwFlagsC8 = m.u32((pGame + 0x70) >>> 0) !== 0 ? dwFlagsC8 | 0x02000000 : dwFlagsC8 & 0xfdffffff
      m.setU32((pObjA2 + 0xc8) >>> 0, (dwFlagsC8 | 0x04000000) >>> 0)

      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom0) | 0
      const bAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
      m.setU8((pObjA2 + 0x18) >>> 0, bAct)
      m.setU32((pObjA2 + 0x1c) >>> 0, m.u32((pGame + 0xbc + (bAct << 2)) >>> 0) >>> 0)
      m.setU32((pObjA2 + 0x74) >>> 0, 0)
      SUNIT_InitUnitSeed113c(m, pObjA2, (pGame + 0xd0) >>> 0)
      m.setU32((pObjA2 + 0xc4) >>> 0, (m.u32((pObjA2 + 0xc4) >>> 0) | 0x10) >>> 0)
      m.setU32((pObjA2 + 0xd0) >>> 0, 0x0b)

      let dwNextId = ((m.u32((pGame + 0x98) >>> 0) | 0) + 1) >>> 0
      if (dwNextId === 0xffffffff) dwNextId = 1
      m.setU32((pGame + 0x98) >>> 0, dwNextId)

      const pObjData = m.alloc(0x38) >>> 0
      m.setU32((pObjA2 + 0x14) >>> 0, pObjData)
      m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, 0xa2) >>> 0)
      m.setU32((pObjA2 + 0x10) >>> 0, 1)
      UNITS_AllocStaticPath113c(m, pObjA2)
      OBJECTS_InitObjectUnit113c(m, pObjA2, pGame >>> 0, dwNextId, pRoom0, nX0, nY0)
      SUNIT_PlaceServerUnitInRoom113c(m, pRoom0, nY0, pObjA2, nX0, pGame >>> 0, 1)
      m.setU8((pObjA2 + 0x78) >>> 0, 2)
    }

    DUNGEON_GetRoomCoordinates113c(m, pRoom0, pRoomCoords)
    const nNextX = (nX0 + 1) | 0
    const nRoomSubX = m.u32(pRoomCoords) | 0
    const nRoomSubW = m.u32((pRoomCoords + 0x08) >>> 0) | 0
    if (nNextX >= nRoomSubX && nNextX < ((nRoomSubX + nRoomSubW) | 0)) {
      const pRoom1 = UNITS_GetRoom113c(m, pSourceUnit >>> 0) >>> 0
      const pObjA0 = UNIT_Alloc113c(m, 2) >>> 0
      if (pObjA0 === 0) {
        throw new D2CommonAssertError('Objects.cpp', 0xa48)
      }
      m.setU32(pObjA0, 2)
      m.setU32((pObjA0 + 0x04) >>> 0, 0xa0)
      m.setU32((pObjA0 + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0) >>> 0)
      m.setU32((pObjA0 + 0x80) >>> 0, pGame >>> 0)
      let dwFlagsC8 = m.u32((pObjA0 + 0xc8) >>> 0) >>> 0
      dwFlagsC8 = m.u32((pGame + 0x70) >>> 0) !== 0 ? dwFlagsC8 | 0x02000000 : dwFlagsC8 & 0xfdffffff
      m.setU32((pObjA0 + 0xc8) >>> 0, (dwFlagsC8 | 0x04000000) >>> 0)

      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom1) | 0
      const bAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
      m.setU8((pObjA0 + 0x18) >>> 0, bAct)
      m.setU32((pObjA0 + 0x1c) >>> 0, m.u32((pGame + 0xbc + (bAct << 2)) >>> 0) >>> 0)
      m.setU32((pObjA0 + 0x74) >>> 0, 0)
      SUNIT_InitUnitSeed113c(m, pObjA0, (pGame + 0xd0) >>> 0)
      m.setU32((pObjA0 + 0xc4) >>> 0, (m.u32((pObjA0 + 0xc4) >>> 0) | 0x10) >>> 0)
      m.setU32((pObjA0 + 0xd0) >>> 0, 0x0b)

      let dwNextId = ((m.u32((pGame + 0x98) >>> 0) | 0) + 1) >>> 0
      if (dwNextId === 0xffffffff) dwNextId = 1
      m.setU32((pGame + 0x98) >>> 0, dwNextId)

      const pObjData = m.alloc(0x38) >>> 0
      m.setU32((pObjA0 + 0x14) >>> 0, pObjData)
      m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, 0xa0) >>> 0)
      m.setU32((pObjA0 + 0x10) >>> 0, 1)
      UNITS_AllocStaticPath113c(m, pObjA0)
      OBJECTS_InitObjectUnit113c(m, pObjA0, pGame >>> 0, dwNextId, pRoom1, nNextX, nY0)
      SUNIT_PlaceServerUnitInRoom113c(m, pRoom1, nY0, pObjA0, nNextX, pGame >>> 0, 1)
      m.setU8((pObjA0 + 0x78) >>> 0, 2)
    }
  } finally {
    freeStackFrame113c(pFrame)
  }
}


function getObjectOrUnitSubtileX113c(m: D2KernMemory113c, pUnit: number): number {
  const dwType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    return m.u32((pPath + 0x0c) >>> 0) | 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function getObjectOrUnitSubtileY113c(m: D2KernMemory113c, pUnit: number): number {
  const dwType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    return m.u32((pPath + 0x10) >>> 0) | 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

function runExplodingOrPoisonShrine113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  pShrineTxt: number,
  dwPotionCode: number,
  nAssertLine: number,
  nMissileId: number,
): void {
  const pFrame = allocStackFrame113c(0xb0)
  try {
    const pCoords = pFrame
    const pDropCoords = (pFrame + 0x08) >>> 0
    const pItemDrop = (pFrame + 0x20) >>> 0
    const pMissileParams = (pFrame + 0x20) >>> 0

    const nMin = m.u32((pShrineTxt + 0x04) >>> 0) | 0
    const nMax = m.u32((pShrineTxt + 0x08) >>> 0) | 0
    const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    const nSpan = (nMax - nMin) | 0
    let nRoll = 0
    if (nSpan > 0) {
      const pSeed = (pObject0 + 0x20) >>> 0
      const prod =
        BigInt(m.u32(pSeed) >>> 0) * 0x6ac690c5n + BigInt(m.u32((pSeed + 4) >>> 0) >>> 0)
      const lo = Number(prod & 0xffffffffn) >>> 0
      const hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
      m.setU32((pSeed + 4) >>> 0, hi)
      m.setU32(pSeed, lo)
      nRoll = (nSpan & (nSpan - 1)) === 0 ? (lo & (nSpan - 1)) | 0 : (lo % (nSpan >>> 0)) | 0
    }
    const nDropCount = (nMin + nRoll) | 0

    for (let i = 0; i < nDropCount; i++) {
      const nItemId = DATATBLS_GetItemIdFromItemCode113c(m, dwPotionCode >>> 0) | 0
      if (nItemId === -1) {
        throw new D2CommonAssertError('Objects.cpp', nAssertLine)
      }
      const pPlayer0 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
      PATH_GetTargetTypeAndPosition113c(m, pPlayer0, pCoords)
      const pRoom = UNITS_GetRoom113c(m, pPlayer0) >>> 0
      const nBaseX = m.u32(pCoords) | 0
      const nBaseY = m.u32((pCoords + 0x04) >>> 0) | 0
      const nTryX = (nBaseX + 2) | 0
      const nTryY = (nBaseY + 3) | 0
      if (ROOM_FindRoomContainingSubtile113c(m, pRoom, nTryX, nTryY) !== 0) {
        m.setU32(pDropCoords, nTryX >>> 0)
        m.setU32((pDropCoords + 0x04) >>> 0, nTryY >>> 0)
      } else {
        m.setU32(pDropCoords, nBaseX >>> 0)
        m.setU32((pDropCoords + 0x04) >>> 0, nBaseY >>> 0)
      }

      const pDropRoom =
        COLLISION_FindFreePositionBasic113c(
          m,
          pRoom,
          pDropCoords,
          pCoords,
          1,
          0x3e01,
          0x801,
          1,
        ) >>> 0
      if (pDropRoom !== 0) {
        for (let k = 0; k < 0x21; k++) {
          m.setU32((pItemDrop + (k << 2)) >>> 0, 0)
        }
        const pGame0 = m.u32(pOperateArgs >>> 0) >>> 0
        const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
        m.setU32((pItemDrop + 0x08) >>> 0, pGame0)
        m.setU16((pItemDrop + 0x2a) >>> 0, m.u16((pGame0 + 0x78) >>> 0))
        m.setU32((pItemDrop + 0x14) >>> 0, nItemId >>> 0)
        m.setU32((pItemDrop + 0x18) >>> 0, 3)
        m.setU32((pItemDrop + 0x1c) >>> 0, m.u32(pDropCoords) >>> 0)
        m.setU32((pItemDrop + 0x20) >>> 0, m.u32((pDropCoords + 0x04) >>> 0) >>> 0)
        m.setU32((pItemDrop + 0x24) >>> 0, pDropRoom)
        m.setU16((pItemDrop + 0x28) >>> 0, 1)

        let nIlvl = 1
        if (pPlayer !== 0) {
          const dwType = m.u32(pPlayer) | 0
          if (dwType === 1) {
            nIlvl = STATLIST_GetUnitStat113c(m, pPlayer, 12, 0) | 0
          } else if (dwType === 0) {
            nIlvl = STATLIST_GetUnitBaseStat113c(m, pPlayer, 12, 0) | 0
          } else {
            const pUnitRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
            const nLvl = DUNGEON_GetLevelIdFromRoom113c(m, pUnitRoom) | 0
            const pUnitGame = m.u32((pPlayer + 0x80) >>> 0) >>> 0
            nIlvl =
              DATATBLS_GetLevelMonsterLevel113c(
                m,
                nLvl,
                m.u8((pUnitGame + 0x6d) >>> 0),
                m.u32((pUnitGame + 0x70) >>> 0),
              ) | 0
          }
          if (nIlvl <= 1) nIlvl = 1
        }
        m.setU32((pItemDrop + 0x0c) >>> 0, nIlvl >>> 0)
        m.setU32((pItemDrop + 0x54) >>> 0, 1)
        const pItem = D2GAME_CreateItemEx_6FC31490_113c(m, pGame0, pItemDrop, 0) >>> 0
        if (pItem !== 0) {
          STATLIST_SetUnitStat113c(m, pItem, 0x46, 1, 0)
          UNITROOM_RefreshUnit113c(m, pItem)
          m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) | 1) >>> 0)
        }
      }
    }

    const dxTable = [-6, -6, 0, 0, 6, 6]
    const dyTable = [6, -6, 6, -6, 6, -6]
    for (let idx = 0; idx < 6; idx++) {
      for (let k = 0; k < 0x17; k++) {
        m.setU32((pMissileParams + (k << 2)) >>> 0, 0)
      }
      const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
      const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
      const nObjX = getObjectOrUnitSubtileX113c(m, pObject)
      const nObjY = getObjectOrUnitSubtileY113c(m, pObject)
      let nSkillLvl = Math.trunc((STATLIST_GetUnitStat113c(m, pPlayer, 12, 0) | 0) / 5) | 0
      if (nSkillLvl < 1) nSkillLvl = 1
      else if (nSkillLvl > 8) nSkillLvl = 8

      m.setU32(pMissileParams, 0x520)
      m.setU32((pMissileParams + 0x04) >>> 0, pPlayer)
      m.setU32((pMissileParams + 0x08) >>> 0, pObject)
      m.setU32((pMissileParams + 0x10) >>> 0, nMissileId >>> 0)
      m.setU32((pMissileParams + 0x14) >>> 0, nObjX >>> 0)
      m.setU32((pMissileParams + 0x18) >>> 0, nObjY >>> 0)
      m.setU32((pMissileParams + 0x1c) >>> 0, ((nObjX + dxTable[idx]!) | 0) >>> 0)
      m.setU32((pMissileParams + 0x20) >>> 0, ((nObjY + dyTable[idx]!) | 0) >>> 0)
      m.setU32((pMissileParams + 0x24) >>> 0, 1)
      m.setU32((pMissileParams + 0x30) >>> 0, nSkillLvl >>> 0)
      MISSILE_CreateServerProjectile113c(m, m.u32(pOperateArgs >>> 0) >>> 0, pMissileParams)
    }
  } finally {
    freeStackFrame113c(pFrame)
  }
}

/**
 * [21/45] Poison Shrine effect (`0x6FC8C200`): drops `dwArg0 + rand(dwArg1 - dwArg0)` Strangling Gas
 * potions (`'gpm ' = 0x206D7067`) around `pPlayer` and fires 6 poison cloud missiles (`0x30 = 48`) from `pObject`.
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs, edx = pShrineTxt)` (`ret`).
 *
 * @va D2Game:0x6FC8C200
 */
export function OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  pShrineTxt: number,
): void {
  hitD2GameVa113c(0x6FC8C200)
  runExplodingOrPoisonShrine113c(m, pOperateArgs, pShrineTxt, 0x206d7067, 0x8f4, 0x30)
}

/**
 * [22/45] Exploding Shrine effect (`0x6FC8C580`): drops `dwArg0 + rand(dwArg1 - dwArg0)` Fulminating
 * potions (`'opm ' = 0x206D706F`) around `pPlayer` and fires 6 explosion missiles (`0x2D = 45`) from `pObject`.
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs, edx = pShrineTxt)` (`ret`).
 *
 * @va D2Game:0x6FC8C580
 */
export function OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  pShrineTxt: number,
): void {
  hitD2GameVa113c(0x6FC8C580)
  runExplodingOrPoisonShrine113c(m, pOperateArgs, pShrineTxt, 0x206d706f, 0x8b2, 0x2d)
}

/**
 * [23/45] Fire Shrine effect (`0x6FC8C900`): finds all living players and monsters within `pShrineTxt->dwArg1`
 * around `pObject`, reduces each target's current hitpoints (`STAT_HITPOINTS = 6`) by `dwArg0%`, and
 * launches a perimeter ring of fireballs (`0x3E = 62`).
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs, edx = pShrineTxt)` (`ret`).
 *
 * @va D2Game:0x6FC8C900
 */
export function OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  pShrineTxt: number,
): void {
  hitD2GameVa113c(0x6FC8C900)
  const pFrame = allocStackFrame113c(0xe0)
  try {
    const pUnitFindData = (pFrame + 0x10) >>> 0
    const pMissileParams = (pFrame + 0x40) >>> 0
    const pFilterData = (pFrame + 0xa0) >>> 0

    const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    const pRoom = UNITS_GetRoom113c(m, pObject0) >>> 0
    const nObjX0 = getObjectOrUnitSubtileX113c(m, pObject0)
    const nObjY0 = getObjectOrUnitSubtileY113c(m, pObject0)

    for (let i = 0; i < 0x0e; i++) {
      m.setU32((pFilterData + (i << 2)) >>> 0, 0)
    }
    const dwRadius = m.u32((pShrineTxt + 0x08) >>> 0) >>> 0
    m.setU32(pFilterData, 0x583)
    m.setU32((pFilterData + 0x0c) >>> 0, nObjX0 >>> 0)
    m.setU32((pFilterData + 0x10) >>> 0, nObjY0 >>> 0)
    m.setU32((pFilterData + 0x14) >>> 0, dwRadius)

    const pGame0 = m.u32(pOperateArgs >>> 0) >>> 0
    UNITFINDS_InitUnitFindData113c(
      m,
      m.u32((pGame0 + 0x1c) >>> 0) >>> 0,
      pUnitFindData,
      pRoom,
      nObjX0,
      nObjY0,
      dwRadius,
      0x6fc89c60,
      pFilterData,
    )
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pUnitFindData, (mem, pCandidate) =>
      OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c(mem, pCandidate),
    )

    const nCount = m.u32((pUnitFindData + 0x18) >>> 0) | 0
    const pUnitsArray = m.u32((pUnitFindData + 0x04) >>> 0) >>> 0
    for (let i = 0; i < nCount; i++) {
      const pTarget = m.u32((pUnitsArray + (i << 2)) >>> 0) >>> 0
      if (pTarget === 0) continue
      const dwType = m.u32(pTarget) | 0
      if (dwType !== 0 && dwType !== 1) continue
      if ((m.u8((pTarget + 0xc6) >>> 0) & 1) !== 0) continue
      const nMode = m.u32((pTarget + 0x10) >>> 0) | 0
      if (dwType === 0) {
        if (nMode === 0 || nMode === 0x11) continue
      } else if (nMode === 0 || nMode === 0x0c) {
        continue
      }
      const nCurHpWhole = (STATLIST_GetUnitStat113c(m, pTarget, 6, 0) | 0) >> 8
      const nPct = m.u32((pShrineTxt + 0x04) >>> 0) | 0
      const nDeltaHp = (Math.trunc(-imul32(nPct, nCurHpWhole) / 100) << 8) | 0
      STATLIST_AddUnitStatMemPort113c(m, pTarget, 6, nDeltaHp, 0)
    }
    UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)

    let nStepIdxOuter = 1
    let nNegOuter = -5
    for (let nPosOuter = 5; nPosOuter < 0x19; nPosOuter += 5, nNegOuter -= 5, nStepIdxOuter++) {
      const bUsePosOuter = nStepIdxOuter & 1
      let nNegInner = -5
      let nStepIdxInner = 1
      for (let nPosInner = 5; nPosInner < 0x19; nPosInner += 5, nNegInner -= 5, nStepIdxInner++) {
        for (let k = 0; k < 0x17; k++) {
          m.setU32((pMissileParams + (k << 2)) >>> 0, 0)
        }
        const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
        const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
        const nObjX = getObjectOrUnitSubtileX113c(m, pObject)
        const nObjY = getObjectOrUnitSubtileY113c(m, pObject)
        const nDx = bUsePosOuter !== 0 ? nPosOuter : nNegOuter
        const nDy = (nStepIdxInner & 1) !== 0 ? nPosInner : nNegInner
        let nSkillLvl = Math.trunc((STATLIST_GetUnitStat113c(m, pPlayer, 12, 0) | 0) / 5) | 0
        if (nSkillLvl < 1) nSkillLvl = 1
        else if (nSkillLvl > 8) nSkillLvl = 8

        m.setU32(pMissileParams, 3)
        m.setU32((pMissileParams + 0x04) >>> 0, pPlayer)
        m.setU32((pMissileParams + 0x10) >>> 0, 0x3e)
        m.setU32((pMissileParams + 0x14) >>> 0, nObjX >>> 0)
        m.setU32((pMissileParams + 0x18) >>> 0, nObjY >>> 0)
        m.setU32((pMissileParams + 0x1c) >>> 0, nDx >>> 0)
        m.setU32((pMissileParams + 0x20) >>> 0, nDy >>> 0)
        m.setU32((pMissileParams + 0x30) >>> 0, nSkillLvl >>> 0)
        MISSILE_CreateServerProjectile113c(m, m.u32(pOperateArgs >>> 0) >>> 0, pMissileParams)
      }
    }
  } finally {
    freeStackFrame113c(pFrame)
  }
}

/**
 * [24/45] Waypoint object operate handler (`0x6FC8CF90`): activates the level's waypoint bit in
 * `pPlayerData->pWaypointData[nDifficulty]`, transitions an unactivated waypoint (`mode == 0`) to
 * `mode = 1` with event `1`, or sends the 21-byte waypoint menu packet `0x63` (`0x6FCAAA70`).
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs)` (`ret`).
 *
 * @va D2Game:0x6FC8CF90
 */
export function OBJ_OperateWaypoint_6FC8CF90_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8CF90)
  const pFrame = allocStackFrame113c(0x20)
  try {
    const pWpNo = pFrame
    const pPkt = (pFrame + 0x04) >>> 0

    const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    const pRoom = UNITS_GetRoom113c(m, pObject0) >>> 0
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
    const pGame = m.u32(pOperateArgs >>> 0) >>> 0
    const pPlayer0 = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
    const pPlayerData0 = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const pWaypointData = m.u32((pPlayerData0 + (nDiff << 2) + 0x1c) >>> 0) >>> 0

    if ((WAYPOINT_GetWaypointNoFromLevelId113c(m, nLevelId, pWpNo) | 0) !== 0) {
      WAYPOINT_ActivateWaypoint113c(m, pWaypointData, (m.u16(pWpNo) << 16) >> 16)
    }

    const pObject1 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    if (pObject1 === 0 || (m.u32((pObject1 + 0x10) >>> 0) | 0) === 0) {
      UNITS_ChangeAnimMode113c(m, pObject1, 1)
      const pObjectsTxt =
        DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0) | 0) >>> 0
      const dwAnimLen = (m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) >>> 0
      const pGameCur = m.u32(pOperateArgs >>> 0) >>> 0
      const dwTriggerFrame = ((m.u32((pGameCur + 0xa8) >>> 0) + dwAnimLen + 1) | 0) >>> 0
      EVENT_SetEventFull113c(
        m,
        pGameCur,
        m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
        1,
        dwTriggerFrame,
        0,
        0,
        0,
      )
      return 1
    }

    const nMode = m.u32((pObject1 + 0x10) >>> 0) | 0
    if (nMode !== 2 && nMode !== 1) {
      return 1
    }

    const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
    if (pPlayer !== 0 && (m.u32(pPlayer) | 0) === 0) {
      if (m.u8((pPlayer + 0x6c) >>> 0) !== 0) return 1
      if (INVENTORY_GetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0) >>> 0) !== 0) return 1
      const pPlrData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
      if (m.u32((pPlrData + 0x4c) >>> 0) !== 0) return 1
    }

    const pObjCur = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    const dwObjGuid = pObjCur !== 0 ? m.u32((pObjCur + 0x0c) >>> 0) >>> 0 : 0xffffffff
    m.setU8(pPkt, 0x63)
    m.setU32((pPkt + 0x01) >>> 0, dwObjGuid)
    WAYPOINT_CopyAndValidateWaypointData113c(m, pWaypointData, (pPkt + 0x05) >>> 0)

    const pPlayerForClient = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
    let pClient = 0
    if (pPlayerForClient !== 0 && (m.u32(pPlayerForClient) | 0) === 0) {
      const pPlrData = UNITS_GetPlayerData113c(m, pPlayerForClient) >>> 0
      pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    }
    NET_SendPacketBuffer21B_6FCAAA70_113c(m, pPkt, pClient)

    const pObjFinal = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    const dwFinalGuid = pObjFinal !== 0 ? m.u32((pObjFinal + 0x0c) >>> 0) >>> 0 : 0xffffffff
    SUNIT_SetLastKillerInfo_6FCFFAE0_113c(
      m,
      m.u32((pOperateArgs + 0x08) >>> 0) >>> 0,
      2,
      dwFinalGuid,
    )
    return 1
  } finally {
    freeStackFrame113c(pFrame)
  }
}

/**
 * [25/45] Operates a destructible/breakaway object (`0x6FC8D8F0`): if in mode `0`, sets mode to `1`,
 * clears unit flag `0x02` (`UNITFLAG_CANBEATTACKED`), schedules event `1` after `dwFrameCnt1 >> 8 + 1` frames,
 * and calls `UNITS_SetTargetUnitForDynamicUnitEx113c`.
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs)` (`ret`).
 *
 * @va D2Game:0x6FC8D8F0
 */
export function OBJ_OperateBreakawayObject_6FC8D8F0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8D8F0)
  const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  if (pObject0 === 0 || (m.u32((pObject0 + 0x10) >>> 0) | 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pObject0, 1)
    const pObject1 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    if (pObject1 !== 0) {
      m.setU32((pObject1 + 0xc4) >>> 0, (m.u32((pObject1 + 0xc4) >>> 0) & ~2) >>> 0)
    }
    const pObjectsTxt =
      DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0) | 0) >>> 0
    const dwAnimLen = (m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) >>> 0
    const pGame = m.u32(pOperateArgs >>> 0) >>> 0
    const dwTriggerFrame = ((m.u32((pGame + 0xa8) >>> 0) + dwAnimLen + 1) | 0) >>> 0
    EVENT_SetEventFull113c(
      m,
      pGame,
      m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
      1,
      dwTriggerFrame,
      0,
      0,
      0,
    )
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0)
  }
  return 1
}


function dispatchShrineEffectByVa113c(
  m: D2KernMemory113c,
  pfnEffect: number,
  pOperateArgs: number,
  pShrineTxt: number,
): void {
  const sm = m as SparseMemory113c
  switch (pfnEffect) {
    case 0x6fc89c00:
      OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c(m, pOperateArgs)
      return
    case 0x6fc898a0:
      SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c(m, pOperateArgs)
      return
    case 0x6fc89860:
      SHRINES_ApplyManaRechargeEffect_6FC89860_113c(m, pOperateArgs)
      return
    case 0x6fc89800:
      SHRINES_ApplyHealthExchangeEffect_6FC89800_113c(m, pOperateArgs, pShrineTxt)
      return
    case 0x6fc897a0:
      SHRINES_ApplyManaExchangeEffect_6FC897A0_113c(m, pOperateArgs, pShrineTxt)
      return
    case 0x6fc8abb0:
      OBJ_OperateAuraStatShrine_6FC8ABB0_113c(m, pOperateArgs, pShrineTxt)
      return
    case 0x6fc8ace0:
      OBJ_OperateCombatShrine_6FC8ACE0_113c(m, pOperateArgs, pShrineTxt)
      return
    case 0x6fc8ab60:
      OBJ_OperateFn_SkillShrine_6FC8AB60_113c(sm, pOperateArgs, pShrineTxt)
      return
    case 0x6fc8ac30:
      OBJ_OperateStaminaShrine_6FC8AC30_113c(m, pOperateArgs, pShrineTxt)
      return
    case 0x6fc89770:
      SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c(m, pOperateArgs, pShrineTxt)
      return
    case 0x6fc8b9b0:
      OBJECTS_OperatePortalShrine_6FC8B9B0_113c(sm, pOperateArgs)
      return
    case 0x6fc8b430:
      OBJECTS_OperateGemShrine_6FC8B430_113c(sm, pOperateArgs)
      return
    case 0x6fc8c900:
      OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c(m, pOperateArgs, pShrineTxt)
      return
    case 0x6fc8b8a0:
      OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c(m, pOperateArgs)
      return
    case 0x6fc8c580:
      OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c(m, pOperateArgs, pShrineTxt)
      return
    case 0x6fc8c200:
      OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c(m, pOperateArgs, pShrineTxt)
      return
    default:
      return
  }
}

/**
 * [26/45] Shrine object operate handler (`0x6FC8DA00`): claims the shrine for `pPlayer`, transitions
 * the object to mode `1`, creates the shrine hover message (`"%d"` with `bShrineIdx + 0xE63`) and
 * schedules event `6` (`+0x12C` frames), dispatches the shrine effect from `gpShrineEffectTable[nCode]`
 * (`0x6FD1A5F8`, defaulting to `0x6FC89C00`), and schedules shrine recharge event `5` (`nResetMin * 0x4B0 + 1`)
 * and optional animation event `1`.
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs)` (`ret`).
 *
 * @va D2Game:0x6FC8DA00
 */
export function OBJ_OperateShrine_6FC8DA00_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  onShrineEffect?: (
    m: D2KernMemory113c,
    pfnEffectVa: number,
    pOperateArgs: number,
    pShrineTxt: number,
  ) => void,
  onIsBadCodePtr?: (pfnEffectVa: number) => boolean,
): number {
  hitD2GameVa113c(0x6FC8DA00)
  const pPlayer = m.u32((pOperateArgs + 0x08) >>> 0) >>> 0
  const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  const pObjData0 = m.u32((pObject0 + 0x14) >>> 0) >>> 0
  if (m.u32((pObjData0 + 0x0c) >>> 0) !== 0 || m.u32((pObject0 + 0x10) >>> 0) !== 0) {
    return 0
  }

  const dwClaimVal = pPlayer === 0 ? 0xffffffff : (m.u32((pPlayer + 0x0c) >>> 0) >>> 0)
  m.setU32((pObjData0 + 0x0c) >>> 0, ((dwClaimVal | 0) + 1) >>> 0)
  UNITROOM_RefreshUnit113c(m, pObject0)
  m.setU32((pObject0 + 0xc4) >>> 0, (m.u32((pObject0 + 0xc4) >>> 0) | 1) >>> 0)
  UNITS_ChangeAnimMode113c(m, pObject0, 1)

  const pObject1 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  if (pObject1 !== 0) {
    const pOldHover = m.u32((pObject1 + 0xa4) >>> 0) >>> 0
    if (pOldHover !== 0) {
      const pGame0 = m.u32(pOperateArgs >>> 0) >>> 0
      CHAT_FreeHoverMsg113c(m, m.u32((pGame0 + 0x1c) >>> 0) >>> 0, pOldHover)
    }
  }

  const pHoverBuf = allocStackFrame113c(0x20)
  try {
    const pObject2 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    const pObjData2 = m.u32((pObject2 + 0x14) >>> 0) >>> 0
    const wStrId = (m.u8((pObjData2 + 0x04) >>> 0) + 0x0e63) & 0xffff
    const hoverStr = String(wStrId)
    for (let i = 0; i < hoverStr.length; i++) {
      m.setU8((pHoverBuf + i) >>> 0, hoverStr.charCodeAt(i) & 0xff)
    }
    m.setU8((pHoverBuf + hoverStr.length) >>> 0, 0)

    const pGame1 = m.u32(pOperateArgs >>> 0) >>> 0
    const pNewHover =
      CHAT_AllocHoverMsg113c(
        m,
        m.u32((pGame1 + 0x1c) >>> 0) >>> 0,
        pHoverBuf,
        m.u32((pGame1 + 0xa8) >>> 0) >>> 0,
      ) >>> 0
    if (pNewHover !== 0) {
      const pObjHover = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
      if (pObjHover !== 0) {
        m.setU32((pObjHover + 0xa4) >>> 0, pNewHover)
      }
      UNITROOM_RefreshUnit113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0)
      const pObjFlags = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
      if (pObjFlags !== 0) {
        m.setU32((pObjFlags + 0xc4) >>> 0, (m.u32((pObjFlags + 0xc4) >>> 0) | 0x100) >>> 0)
      }
      const pGameEvt = m.u32(pOperateArgs >>> 0) >>> 0
      EVENT_SetEventFull113c(
        m,
        pGameEvt,
        m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
        6,
        ((m.u32((pGameEvt + 0xa8) >>> 0) + 0x12c) | 0) >>> 0,
        0,
        0,
        0,
      )
    }
  } finally {
    freeStackFrame113c(pHoverBuf)
  }

  const pShrineTxt = UNITS_GetObjectShrineTxt113c(m, pObject0) >>> 0
  const nCode = m.u8(pShrineTxt) | 0
  const nMaxCode = m.u32(0x6fd27d4c) | 0
  let pfnEffect = 0
  if (nCode >= 0 && nCode < nMaxCode) {
    pfnEffect = m.u32((0x6fd1a5f8 + imul32(nCode, 12)) >>> 0) >>> 0
  }
  if (pfnEffect !== 0) {
    const bBadCodePtr =
      (onIsBadCodePtr !== undefined && onIsBadCodePtr(pfnEffect)) ||
      m.u32(D2GAME_IAT_IS_BAD_CODE_PTR_VA_113C) !== 0
    if (bBadCodePtr) {
      throw new D2CommonAssertError('Objects.cpp', 0xa5d)
    }
    if (onShrineEffect !== undefined) {
      onShrineEffect(m, pfnEffect, pOperateArgs, pShrineTxt)
    } else {
      dispatchShrineEffectByVa113c(m, pfnEffect, pOperateArgs, pShrineTxt)
    }
  } else {
    OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c(m, pOperateArgs)
  }

  const bResetMinutes = m.u8((pShrineTxt + 0x10) >>> 0)
  if (bResetMinutes !== 0) {
    const pGameRech = m.u32(pOperateArgs >>> 0) >>> 0
    const dwRechFrame =
      ((imul32(bResetMinutes, 0x4b0) + m.u32((pGameRech + 0xa8) >>> 0) + 1) | 0) >>> 0
    EVENT_SetEventFull113c(m, pGameRech, pObject0, 5, dwRechFrame, 0, 0, 0)
  }

  if ((m.u32((pObject0 + 0x10) >>> 0) | 0) === 1) {
    const pObjectsTxt =
      DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0) | 0) >>> 0
    if (
      m.u8((pObjectsTxt + 0x109) >>> 0) === 0 &&
      m.u8((pObjectsTxt + 0x141) >>> 0) !== 0
    ) {
      const dwAnimLen = (m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) >>> 0
      const pGameAnim = m.u32(pOperateArgs >>> 0) >>> 0
      EVENT_SetEventFull113c(
        m,
        pGameAnim,
        m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
        1,
        ((m.u32((pGameAnim + 0xa8) >>> 0) + dwAnimLen + 1) | 0) >>> 0,
        0,
        0,
        0,
      )
    }
  }
  return 1
}

/**
 * [27/45] Generic object operate handler (`0x6FC8DE00`): transitions an object in mode `0` to mode `1`,
 * calls `UNITS_SetTargetUnitForDynamicUnitEx113c`, updates `UNITFLAG_CANBEATTACKED` (`0x02`) from
 * `ObjectsTxt.bSelectable[nMode]` (`+0xC4`), and schedules event `1` when `bMode[1]` (`+0x141`) is non-zero.
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs)` (`ret`).
 *
 * @va D2Game:0x6FC8DE00
 */
export function OBJ_OperateGenericMode0To1_6FC8DE00_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
): number {
  hitD2GameVa113c(0x6FC8DE00)
  const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  if (pObject0 !== 0 && (m.u32((pObject0 + 0x10) >>> 0) | 0) !== 0) {
    return 1
  }

  UNITS_ChangeAnimMode113c(m, pObject0, 1)
  UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0)

  const pObject1 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  const nMode = pObject1 !== 0 ? m.u32((pObject1 + 0x10) >>> 0) >>> 0 : 0
  const pObjectsTxt0 =
    DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0) | 0) >>> 0
  const bSelectable = m.u8((pObjectsTxt0 + nMode + 0xc4) >>> 0)

  const pObject2 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
  if (pObject2 !== 0) {
    const dwFlags = m.u32((pObject2 + 0xc4) >>> 0) >>> 0
    m.setU32((pObject2 + 0xc4) >>> 0, (bSelectable !== 0 ? dwFlags | 2 : dwFlags & ~2) >>> 0)
  }

  const pObjectsTxt1 =
    DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0) | 0) >>> 0
  if (m.u8((pObjectsTxt1 + 0x141) >>> 0) !== 0) {
    const pGame = m.u32(pOperateArgs >>> 0) >>> 0
    const pObjectsTxt2 =
      DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0) | 0) >>> 0
    const dwAnimLen = (m.u32((pObjectsTxt2 + 0xdc) >>> 0) >>> 8) >>> 0
    EVENT_SetEventFull113c(
      m,
      pGame,
      m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
      1,
      ((m.u32((pGame + 0xa8) >>> 0) + dwAnimLen + 1) | 0) >>> 0,
      0,
      0,
      0,
    )
  }
  return 1
}

/**
 * [28/45] Door/gate toggle operate handler (`0x6FC8DEC0`): enforces a `500ms` (`0x1F4`) tick-count
 * debounce on `pObject->dwInteractTick` (`+0xD4`), opening a closed door (`mode == 0` -> `1` + event `1`)
 * or closing an open door (`mode == 2` -> `0` + `UNITS_SetCollisionMaskAtCoords113c`).
 *
 * Binary convention: `__fastcall(ecx = pOperateArgs)` (`ret`).
 *
 * @va D2Game:0x6FC8DEC0
 */
export function OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c(
  m: D2KernMemory113c,
  pOperateArgs: number,
  dwTickCount = 0x1000,
): number {
  hitD2GameVa113c(0x6FC8DEC0)
  const pCoords = allocStackFrame113c(8)
  try {
    const pObject0 = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    const pRoom = UNITS_GetRoom113c(m, pObject0) >>> 0
    PATH_GetTargetTypeAndPosition113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0, pCoords)
    UNITS_GetUnitSizeX113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0)
    UNITS_GetUnitSizeY113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0)

    const pObject = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
    const nMode = pObject !== 0 ? m.u32((pObject + 0x10) >>> 0) | 0 : 0
    const dwCooldownEnd = ((m.u32((pObject + 0xd4) >>> 0) + 0x1f4) | 0) >>> 0
    if ((dwTickCount >>> 0) < dwCooldownEnd) {
      return 1
    }

    const pObjectsTxt =
      DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pOperateArgs + 0x10) >>> 0) | 0) >>> 0
    if (nMode === 0) {
      UNITS_SetTargetUnitForDynamicUnitEx113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0)
      UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0, 1)
      const pObjAfter = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
      m.setU32((pObjAfter + 0xd4) >>> 0, dwTickCount >>> 0)
      const pGame = m.u32(pOperateArgs >>> 0) >>> 0
      const dwAnimLen = (m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) >>> 0
      EVENT_SetEventFull113c(
        m,
        pGame,
        m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
        1,
        ((m.u32((pGame + 0xa8) >>> 0) + dwAnimLen + 1) | 0) >>> 0,
        0,
        0,
        0,
      )
    } else if (nMode === 2) {
      const nX = m.u32(pCoords) | 0
      const nY = m.u32((pCoords + 0x04) >>> 0) | 0
      UNITS_SetCollisionMaskAtCoords113c(
        m,
        m.u32((pOperateArgs + 0x04) >>> 0) >>> 0,
        pRoom,
        nX,
        nY,
      )
      UNITS_ChangeAnimMode113c(m, m.u32((pOperateArgs + 0x04) >>> 0) >>> 0, 0)
      const pObjAfter = m.u32((pOperateArgs + 0x04) >>> 0) >>> 0
      m.setU32((pObjAfter + 0xd4) >>> 0, dwTickCount >>> 0)
    }
    return 1
  } finally {
    freeStackFrame113c(pCoords)
  }
}

/**
 * [29/45] Object hover-message timeout event (`0x06`) handler (`0x6FC8E470`): if the hover message's
 * timeout frame (`CHAT_GetTimeoutFromHoverMsg113c`) exceeds `pGame->dwGameFrame` (`+0xA8`), reschedules
 * event `6` for that timeout frame; otherwise frees the hover message, clears `pObject->pHoverMsg` (`+0xA4`),
 * refreshes the unit room, and sets `UNITFLAG_HOVERMSG` (`0x100`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pObject)` (`ret`).
 *
 * @va D2Game:0x6FC8E470
 */
export function OBJ_EventHoverMsgTimeout_6FC8E470_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC8E470)
  if (pObject === 0) return
  const pHoverMsg = m.u32((pObject + 0xa4) >>> 0) >>> 0
  if (pHoverMsg === 0) return

  const dwTimeout = CHAT_GetTimeoutFromHoverMsg113c(m, pHoverMsg) >>> 0
  if (dwTimeout > (m.u32((pGame + 0xa8) >>> 0) >>> 0)) {
    EVENT_SetEventFull113c(m, pGame >>> 0, pObject >>> 0, 6, dwTimeout, 0, 0, 0)
    return
  }

  CHAT_FreeHoverMsg113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, pHoverMsg)
  m.setU32((pObject + 0xa4) >>> 0, 0)
  UNITROOM_RefreshUnit113c(m, pObject >>> 0)
  m.setU32((pObject + 0xc4) >>> 0, (m.u32((pObject + 0xc4) >>> 0) | 0x100) >>> 0)
}

/**
 * [30/45] Object periodic/environment event (`0x08`) handler (`0x6FC8E4E0`):
 * - For object class `0x18F` (`399`) in mode `0` or `2`, schedules next event `8` after `25 + rand(250)` frames,
 *   sets mode to `1`, and schedules event `1` after `dwFrameCnt1 >> 8 + 1` frames.
 * - For other objects, queries `ENVIRONMENT_GetTimeOfDayAndAngle113c(pGame->pAct[0])` and toggles between
 *   day (`period == 0` -> mode `0`, `+1000` frames) and night (`1 <= period <= 3` -> mode `1` + event `1`, `+1000` frames).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pObject)` (`ret`).
 *
 * @va D2Game:0x6FC8E4E0
 */
export function OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC8E4E0)
  let wMode = 0
  if (pObject !== 0) {
    wMode = m.u32((pObject + 0x10) >>> 0) & 0xffff
    if ((m.u32((pObject + 0x04) >>> 0) | 0) === 0x18f) {
      if (wMode === 0 || wMode === 2) {
        UNITS_GetRoom113c(m, pObject >>> 0)
        const pGameSeed = m.u32((pGame + 0x10f0) >>> 0) >>> 0
        const nRoll = ((stepSeed64InPlace113c(m, pGameSeed) >>> 0) % 0xfa) >>> 0
        const dwCurFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
        EVENT_SetEventFull113c(
          m,
          pGame >>> 0,
          pObject >>> 0,
          8,
          ((dwCurFrame + nRoll + 0x19) | 0) >>> 0,
          0,
          0,
          0,
        )
        UNITS_ChangeAnimMode113c(m, pObject >>> 0, 1)
        const pObjectsTxt =
          DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pObject + 0x04) >>> 0) | 0) >>> 0
        const dwAnimLen = (m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) >>> 0
        EVENT_SetEventFull113c(
          m,
          pGame >>> 0,
          pObject >>> 0,
          1,
          ((m.u32((pGame + 0xa8) >>> 0) + dwAnimLen + 1) | 0) >>> 0,
          0,
          0,
          0,
        )
      }
      return
    }
  }

  const pAct0 = m.u32((pGame + 0xbc) >>> 0) >>> 0
  const envRes = ENVIRONMENT_GetTimeOfDayAndAngle113c(m, pAct0) as unknown
  const envObj = envRes as { period?: number; timeOfDay?: number } | null | undefined
  const nPeriod =
    typeof envRes === 'number'
      ? envRes | 0
      : ((envObj !== null && envObj !== undefined && envObj.period !== undefined
          ? envObj.period
          : envObj !== null && envObj !== undefined && envObj.timeOfDay !== undefined
            ? envObj.timeOfDay
            : 0) |
        0)

  if (nPeriod === 0) {
    if (wMode === 2 || wMode === 1) {
      UNITS_ChangeAnimMode113c(m, pObject >>> 0, 0)
    }
    EVENT_SetEventFull113c(
      m,
      pGame >>> 0,
      pObject >>> 0,
      8,
      ((m.u32((pGame + 0xa8) >>> 0) + 0x3e8) | 0) >>> 0,
      0,
      0,
      0,
    )
    return
  }

  if (nPeriod < 0 || nPeriod > 3) {
    EVENT_SetEventFull113c(
      m,
      pGame >>> 0,
      pObject >>> 0,
      8,
      ((m.u32((pGame + 0xa8) >>> 0) + 0x258) | 0) >>> 0,
      0,
      0,
      0,
    )
    return
  }

  if (wMode === 0) {
    UNITS_ChangeAnimMode113c(m, pObject >>> 0, 1)
    const nClassId = pObject !== 0 ? m.u32((pObject + 0x04) >>> 0) | 0 : -1
    const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nClassId) >>> 0
    const dwAnimLen = (m.u32((pObjectsTxt + 0xdc) >>> 0) >>> 8) >>> 0
    EVENT_SetEventFull113c(
      m,
      pGame >>> 0,
      pObject >>> 0,
      1,
      ((m.u32((pGame + 0xa8) >>> 0) + dwAnimLen + 1) | 0) >>> 0,
      0,
      0,
      0,
    )
  }

  EVENT_SetEventFull113c(
    m,
    pGame >>> 0,
    pObject >>> 0,
    8,
    ((m.u32((pGame + 0xa8) >>> 0) + 0x3e8) | 0) >>> 0,
    0,
    0,
    0,
  )
}


/**
 * [31/45] Builds and sends the 32-byte server-to-client missile sync packet (`0x73`) via
 * `NET_SendPacketBuffer32B_6FCAAA10_113c` when `pMissile` is a missile unit (`dwType == 3`) with
 * `UNITFLAGEX_TELEPORTED` (`0x400` at `+0xC8`), a valid owner unit, and `MissilesTxt` flag bit `0x20`.
 *
 * Binary convention: `ecx = pGame`, `esi = pMissile`, `[esp+4] = pClient`, `[esp+8] = bIncludeTargetPos` (`ret 8`).
 *
 * @va D2Game:0x6FC8F740
 */
export function MISSILE_SendSyncPacket73_6FC8F740_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pClient: number,
  bIncludeTargetPos: number,
): void {
  hitD2GameVa113c(0x6FC8F740)
  if (pMissile === 0) return
  if ((m.u32(pMissile >>> 0) | 0) !== 3) return
  if (((m.u32((pMissile + 0xc8) >>> 0) >>> 10) & 1) === 0) return

  const dwOwnerType = m.u32((pMissile + 0x94) >>> 0) >>> 0
  const dwOwnerId = m.u32((pMissile + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, pGame >>> 0, dwOwnerType, dwOwnerId) >>> 0
  if (pOwner === 0) return

  const nClassId = m.u32((pMissile + 0x04) >>> 0) | 0
  if (nClassId < 0) return
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return
  if (nClassId >= (m.u32((pDataTables + 0xb6c) >>> 0) | 0)) return

  const pMissilesTxtBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  const pMissilesTxt = (pMissilesTxtBase + imul32(nClassId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return

  const bMissileFlags = m.u8((pMissilesTxt + 0x04) >>> 0)
  const pBitMasks = m.u32(0x6fd18be0) >>> 0
  const bMaskBit5 = pBitMasks !== 0 ? m.u8((pBitMasks + 0x14) >>> 0) : 0x20
  if ((bMissileFlags & bMaskBit5) === 0) return

  const pPkt = allocStackFrame113c(0x20)
  try {
    for (let i = 0; i < 8; i++) {
      m.setU32((pPkt + (i << 2)) >>> 0, 0)
    }
    m.setU8(pPkt, 0x73)
    m.setU16((pPkt + 0x05) >>> 0, MISSILE_GetClassId113c(m, pMissile >>> 0) & 0xffff)
    m.setU32((pPkt + 0x07) >>> 0, UNIT_GetPosX113c(m, pMissile >>> 0) >>> 0)
    m.setU32((pPkt + 0x0b) >>> 0, UNIT_GetPosY113c(m, pMissile >>> 0) >>> 0)
    if (bIncludeTargetPos !== 0) {
      const pPath = m.u32((pMissile + 0x2c) >>> 0) >>> 0
      m.setU32((pPkt + 0x0f) >>> 0, PATH_GetFirstPointX113c(m, pPath) >>> 0)
      m.setU32((pPkt + 0x13) >>> 0, PATH_GetFirstPointY113c(m, pPath) >>> 0)
    }
    m.setU16((pPkt + 0x17) >>> 0, MISSILE_GetRemainingFrames113c(m, pMissile >>> 0) & 0xffff)
    m.setU8((pPkt + 0x19) >>> 0, m.u32(pOwner) & 0xff)
    m.setU32((pPkt + 0x1a) >>> 0, m.u32((pOwner + 0x0c) >>> 0) >>> 0)
    m.setU8((pPkt + 0x1e) >>> 0, MISSILE_GetLevel113c(m, pMissile >>> 0) & 0xff)
    m.setU8((pPkt + 0x1f) >>> 0, STATLIST_GetUnitStat113c(m, pMissile >>> 0, 0x148, 0) & 0xff)
    NET_SendPacketBuffer32B_6FCAAA10_113c(m, pPkt, pClient >>> 0)
  } finally {
    freeStackFrame113c(pPkt)
  }
}

/**
 * [32/45] Frees `pPlayerData->pPlayerUnk5C` (`+0x5C`), including its inner buffer at `+0x04` and
 * singly-linked list of nodes at `+0x08` (`pNode->pNext` at `+0x08`), and clears `+0x5C` to `0`.
 *
 * Binary convention: `eax = pPlayer`, `ebx = pGame` (`ret`).
 *
 * @va D2Game:0x6FC900C0
 */
export function PLAYER_FreePlayerDataField5CList_6FC900C0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC900C0)
  void pGame
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const pStruct5C = m.u32((pPlayerData + 0x5c) >>> 0) >>> 0
  if (pStruct5C === 0) return

  const pBuf04 = m.u32((pStruct5C + 0x04) >>> 0) >>> 0
  if (pBuf04 !== 0) {
    void pBuf04
  }

  let pNode = m.u32((pStruct5C + 0x08) >>> 0) >>> 0
  while (pNode !== 0) {
    const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
    pNode = pNext
  }

  m.setU32((pStruct5C + 0x08) >>> 0, 0)
  m.setU32((pPlayerData + 0x5c) >>> 0, 0)
}

/**
 * [33/45] Validates a Horadric Cube recipe input slot (`nInputSlotIdx` in `pCubeMainTxt`) against
 * items in the Horadric Cube inventory page (`page == 3`) and populates `pCubeOutputCtx` when
 * `nInputSlotIdx == 0`.
 *
 * Binary convention: `esi = pCubeMainTxt`, `[esp+4] = pGame`, `[esp+8] = pInventory`, `[esp+0xC] = nInputSlotIdx`,
 * `[esp+0x10] = pCubeOutputCtx`, `[esp+0x14] = pUsedItemFlags` (`ret 0x14`).
 *
 * @va D2Game:0x6FC90240
 */
export function CUBE_ValidateRecipeInputSlot_6FC90240_113c(
  m: D2KernMemory113c,
  pCubeMainTxt: number,
  pGame: number,
  pInventory: number,
  nInputSlotIdx: number,
  pCubeOutputCtx: number,
  pUsedItemFlags: number,
): number {
  hitD2GameVa113c(0x6FC90240)
  if (pInventory === 0) return 0

  const pInParam = (pCubeMainTxt + (nInputSlotIdx << 3) + 0x14) >>> 0
  const wInFlags = m.u16(pInParam)
  if ((wInFlags & 3) === 0) {
    return 1
  }

  const bQty = m.u8((pInParam + 0x07) >>> 0)
  const nReqCount = bQty > 0 ? bQty : 1
  let bNoTwoHanded = 1
  let nMatchedCount = 0
  let pTargetItemsTxt = 0

  if ((wInFlags & 1) !== 0) {
    const wReqId = m.u16((pInParam + 0x02) >>> 0)
    if (wReqId !== 0xffff) {
      pTargetItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, wReqId) >>> 0
    }
  }

  let nCubeItemIndex = 0
  let pCurItem = INVENTORY_GetFirstItem113c(m, pInventory >>> 0) >>> 0
  while (pCurItem !== 0) {
    const pValidItem = INVENTORY_UnitIsItem113c(m, pCurItem) >>> 0
    const pNextItem = INVENTORY_GetNextItem113c(m, pCurItem) >>> 0
    pCurItem = pNextItem

    if (pValidItem === 0) continue
    if ((ITEMS_GetInvPage113c(m, pValidItem) & 0xff) !== 3) continue

    nCubeItemIndex = (nCubeItemIndex + 1) | 0
    const pItemTxt =
      DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pValidItem + 0x04) >>> 0) | 0) >>> 0
    if (pItemTxt === 0) continue

    const dwBaseCode = ITEMS_GetBaseCode113c(m, pValidItem) >>> 0
    const wFlags = m.u16((pCubeMainTxt + (nInputSlotIdx << 3) + 0x14) >>> 0)
    if ((wFlags & 1) !== 0) {
      const wReqId = m.u16((pCubeMainTxt + (nInputSlotIdx << 3) + 0x16) >>> 0)
      if (wReqId !== 0xffff) {
        if ((wFlags & 0x80) !== 0) {
          const dwNormCode = m.u32((pItemTxt + 0x84) >>> 0) >>> 0
          const dwUberCode = m.u32((pItemTxt + 0x88) >>> 0) >>> 0
          const dwUltraCode = m.u32((pItemTxt + 0x8c) >>> 0) >>> 0
          const dwTargetCode = pTargetItemsTxt !== 0 ? m.u32((pTargetItemsTxt + 0x80) >>> 0) >>> 0 : 0
          if (dwBaseCode === dwNormCode) {
            if (dwTargetCode !== dwNormCode) continue
          } else if (dwBaseCode === dwUberCode) {
            if (dwTargetCode !== dwNormCode && dwTargetCode !== dwUberCode) continue
          } else if (dwBaseCode === dwUltraCode) {
            if (
              dwTargetCode !== dwNormCode &&
              dwTargetCode !== dwUberCode &&
              dwTargetCode !== dwUltraCode
            ) {
              continue
            }
          } else {
            continue
          }
        } else if ((m.u32((pValidItem + 0x04) >>> 0) >>> 0) !== (wReqId >>> 0)) {
          continue
        }
      }
    } else if ((wFlags & 2) !== 0) {
      const wReqType = m.u16((pCubeMainTxt + (nInputSlotIdx << 3) + 0x16) >>> 0)
      if ((ITEMS_CheckItemTypeIdMemPort113c(m, pValidItem, wReqType) | 0) === 0) {
        continue
      }
    }

    const bReqQual = m.u8((pCubeMainTxt + (nInputSlotIdx << 3) + 0x1a) >>> 0)
    if (bReqQual !== 0) {
      const nQual = ITEMS_GetItemQuality113c(m, pValidItem) | 0
      if (nQual !== bReqQual) {
        if (bReqQual === 9) {
          STATLIST_GetUnitFullStatsCount113c(m, pValidItem)
        }
        continue
      }
    }

    if ((wFlags & 0x40) !== 0) {
      const nCells = ITEMS_GetItemCell113c(m, pValidItem) | 0
      const nExpected = (m.u16((pCubeMainTxt + (nInputSlotIdx << 3) + 0x18) >>> 0) - 1) | 0
      if (nCells !== nExpected) continue
    }

    if ((wFlags & 4) !== 0) {
      if ((ITEMS_GetMaxSockets113c(m, pValidItem) & 0xff) > 0) continue
    } else if ((wFlags & 8) !== 0) {
      if ((ITEMS_GetMaxSockets113c(m, pValidItem) & 0xff) === 0) continue
    }

    if ((wFlags & 0x20) !== 0) {
      if ((ITEMS_CheckEtherealFlag113c(m, pValidItem) | 0) !== 0) continue
    } else if ((wFlags & 0x10) !== 0) {
      if ((ITEMS_CheckEtherealFlag113c(m, pValidItem) | 0) === 0) continue
    }

    if ((wFlags & 0x100) !== 0) {
      if (dwBaseCode !== (m.u32((pItemTxt + 0x84) >>> 0) >>> 0)) continue
    } else if ((wFlags & 0x200) !== 0) {
      if (dwBaseCode !== (m.u32((pItemTxt + 0x88) >>> 0) >>> 0)) continue
    } else if ((wFlags & 0x400) !== 0) {
      if (dwBaseCode !== (m.u32((pItemTxt + 0x8c) >>> 0) >>> 0)) continue
    }

    if ((wFlags & 0x800) !== 0) {
      if ((ITEMS_GetCommandFlags113c(m, pValidItem) & 0x4000000) !== 0) continue
    }

    if (m.u8((pCubeMainTxt + 0x04) >>> 0) === 0x1c) {
      if (m.u8((pItemTxt + 0x12a) >>> 0) !== 0 && m.u8((pItemTxt + 0x12b) >>> 0) !== 0) {
        const nStat164 = STATLIST_GetUnitStat113c(m, pValidItem, 0x164, 0) | 0
        if (nStat164 < m.u8((pGame + 0x6d) >>> 0)) continue
      }
    }

    if (nInputSlotIdx === 0) {
      const bOutType0 = m.u8((pCubeMainTxt + 0x54) >>> 0)
      if (
        (bOutType0 === 0xff || bOutType0 === 0xfe) &&
        (m.u8((pCubeMainTxt + 0x4c) >>> 0) & 2) !== 0
      ) {
        if ((ITEMS_GetMaxSocketsFromItemType113c(m, pValidItem) & 0xff) === 0) continue
      }
    }

    if (nCubeItemIndex < 0x30) {
      if (m.u32((pUsedItemFlags + ((nCubeItemIndex - 1) << 2)) >>> 0) !== 0) continue
    }

    if (nInputSlotIdx === 0) {
      const bOp = m.u8((pCubeMainTxt + 0x04) >>> 0)
      if (bOp >= 0x0f && bOp <= 0x1b) {
        if (bOp === 0x1b) {
          if ((ITEMS_GetItemCell113c(m, pValidItem) | 0) === (m.u32((pCubeMainTxt + 0x0c) >>> 0) | 0)) {
            continue
          }
        } else {
          const nStatId = m.u32((pCubeMainTxt + 0x08) >>> 0) | 0
          const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
          const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
          const nMaxStatId = pDataTables !== 0 ? m.u32((pDataTables + 0xbd4) >>> 0) | 0 : 0x1ff
          if (nStatId >= 0 && nStatId <= nMaxStatId) {
            const pIsc = DATATBLS_GetItemStatCostRecordFast113c(m, nStatId) >>> 0
            if (pIsc === 0) continue
            const bValShift = m.u8((pIsc + 0x18) >>> 0) & 0x1f
            const nTargetVal = (m.u32((pCubeMainTxt + 0x0c) >>> 0) | 0) >> bValShift
            let nActualVal = 0
            if (bOp <= 0x12) {
              nActualVal = STATLIST_GetUnitStat113c(m, pValidItem, nStatId, 0) | 0
            } else if (bOp <= 0x16) {
              nActualVal = STATLIST_GetUnitBaseStat113c(m, pValidItem, nStatId, 0) | 0
            } else {
              nActualVal = STATLIST_GetUnitStatBonus113c(m, pValidItem, nStatId, 0) | 0
            }
            const nCmpKind = (bOp - 0x0f) & 3
            if (nCmpKind === 0 && nActualVal < nTargetVal) continue
            if (nCmpKind === 1 && nActualVal > nTargetVal) continue
            if (nCmpKind === 2 && nActualVal === nTargetVal) continue
            if (nCmpKind === 3 && nActualVal !== nTargetVal) continue
          }
        }
      }

      for (let outIdx = 0; outIdx < 3; outIdx++) {
        const pOutSlot = (pCubeOutputCtx + imul32(outIdx, 0x0c)) >>> 0
        m.setU32((pOutSlot + 0x08) >>> 0, ITEMS_GetItemLevel113c(m, pValidItem) >>> 0)
        const wOutFlags = m.u16((pCubeMainTxt + 0x4c) >>> 0)
        if ((wOutFlags & 1) !== 0) {
          m.setU32(pOutSlot, pValidItem)
        }
        const bOutCodeType = m.u8((pCubeMainTxt + 0x54) >>> 0)
        if (bOutCodeType === 0xff || bOutCodeType === 0xfe) {
          m.setU32(pOutSlot, pValidItem)
          m.setU32(
            (pOutSlot + 0x04) >>> 0,
            bOutCodeType === 0xff ? m.u32((pValidItem + 0x04) >>> 0) >>> 0 : 0xffffffff,
          )
          let dwUpgradeCode = 0x20202020
          if ((wOutFlags & 0x80) !== 0) {
            dwUpgradeCode = m.u32((pItemTxt + 0x88) >>> 0) >>> 0
          } else if ((wOutFlags & 0x100) !== 0) {
            dwUpgradeCode = m.u32((pItemTxt + 0x8c) >>> 0) >>> 0
          }
          if (dwUpgradeCode !== 0x20202020) {
            const pDtSlot = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
            const pDt = pDtSlot !== 0 ? m.u32(pDtSlot) >>> 0 : 0
            const pItemsLinker = pDt !== 0 ? m.u32((pDt + 0x94) >>> 0) >>> 0 : 0
            const nUpgradedId =
              pItemsLinker !== 0 ? fogGetRowFromTxt113c(m, pItemsLinker, dwUpgradeCode, 0) | 0 : -1
            if (nUpgradedId >= 0) {
              const pUpgradedTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nUpgradedId) >>> 0
              if (
                pUpgradedTxt !== 0 &&
                (m.u32((pGame + 0x70) >>> 0) !== 0 || m.u16((pUpgradedTxt + 0xf6) >>> 0) < 0x64)
              ) {
                m.setU32((pOutSlot + 0x04) >>> 0, nUpgradedId >>> 0)
              }
            }
          }
        }
      }
    }

    if (nCubeItemIndex < 0x30) {
      m.setU32((pUsedItemFlags + ((nCubeItemIndex - 1) << 2)) >>> 0, 1)
    }
    nMatchedCount = (nMatchedCount + 1) | 0
    if ((ITEMS_GetTwoHandedFlag113c(m, pValidItem) | 0) !== 0) {
      bNoTwoHanded = 0
    }
  }

  if (bNoTwoHanded === 0) {
    return nMatchedCount >= nReqCount ? 1 : 0
  }
  return nMatchedCount === nReqCount ? 1 : 0
}

/**
 * [34/45] Builds a 40-byte server-to-client event notification packet (`0x5A`, `bEventType = dl`),
 * copies up to 16 bytes of `szName` into `+0x08..+0x17`, and dispatches it via
 * `NET_SendFixed40BytePacketToClient113c` (`0x6FCAB400`).
 *
 * Binary convention: `eax = szName`, `dl = bEventType`, `esi = pPlayer` (`ret`).
 *
 * @va D2Game:0x6FC90BF0
 */
export function NET_SendEventMessagePacket5A_6FC90BF0_113c(
  m: D2KernMemory113c,
  szName: number,
  bEventType: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC90BF0)
  const pPkt = allocStackFrame113c(0x28)
  try {
    for (let i = 0; i < 10; i++) {
      m.setU32((pPkt + (i << 2)) >>> 0, 0)
    }
    m.setU8(pPkt, 0x5a)
    m.setU8((pPkt + 0x01) >>> 0, bEventType & 0xff)
    m.setU8((pPkt + 0x02) >>> 0, 0)
    m.setU32((pPkt + 0x03) >>> 0, 0)

    if (szName !== 0) {
      for (let i = 0; i < 15; i++) {
        const ch = m.u8((szName + i) >>> 0)
        m.setU8((pPkt + 0x08 + i) >>> 0, ch)
        if (ch === 0) break
      }
      m.setU8((pPkt + 0x17) >>> 0, 0)
    } else {
      m.setU8((pPkt + 0x08) >>> 0, 0)
    }

    let pClient = 0
    if (pPlayer !== 0 && (m.u32(pPlayer >>> 0) | 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
      pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
    }
    NET_SendFixed40BytePacketToClient113c(m, pClient, pPkt)
  } finally {
    freeStackFrame113c(pPkt)
  }
}

/**
 * [35/45] Randomly selects an item class ID (`0..dwItemsCount - 1`) matching `nItemType`,
 * `bSpawnable != 0` (`+0x133`), expansion version check (`wVersion < 100 || pGame->wItemFormat >= 100`),
 * and `bLevel <= nMaxItemLevel` (`+0xFD`) using `pGame->pGameSeed` (`+0xD0`).
 *
 * Binary convention: `__stdcall([esp+4] = pGame, [esp+8] = nMaxItemLevel, [esp+0xC] = nItemType)` (`ret 0xC`).
 *
 * @va D2Game:0x6FC91060
 */
export function CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c(
  m: D2KernMemory113c,
  pGame: number,
  nMaxItemLevel: number,
  nItemType: number,
): number {
  hitD2GameVa113c(0x6FC91060)
  const pItemDataTables = DATATBLS_GetItemDataTables113c(m) >>> 0
  if (pItemDataTables === 0) {
    throw new D2CommonAssertError('Cube.cpp', 0x381)
  }

  const nTotalItems = m.u32(pItemDataTables) | 0
  const pItemsTxtBase = m.u32((pItemDataTables + 0x04) >>> 0) >>> 0
  const pSeed = (pGame + 0xd0) >>> 0
  const nStartIdx = SEED_RollLimitedFast113c(m, pSeed, nTotalItems) | 0
  let nStopIdx = (nStartIdx - 1) | 0
  if (nStopIdx < 0) {
    nStopIdx = (nTotalItems - 1) | 0
  }
  if (nStartIdx === nStopIdx) {
    return 0
  }

  const candidates: number[] = []
  let nCurIdx = nStartIdx
  while (nCurIdx !== nStopIdx && candidates.length < 0x100) {
    if ((ITEMS_CheckItemIdMatchesItemType113c(m, nCurIdx, nItemType) | 0) !== 0) {
      const pRec = (pItemsTxtBase + imul32(nCurIdx, 0x1a8)) >>> 0
      if (m.u8((pRec + 0x133) >>> 0) !== 0) {
        const wVersion = m.u16((pRec + 0xf6) >>> 0)
        if (wVersion < 0x64 || m.u16((pGame + 0x78) >>> 0) >= 0x64) {
          const bLevel = m.u8((pRec + 0xfd) >>> 0)
          if (bLevel <= (nMaxItemLevel | 0)) {
            candidates.push(nCurIdx & 0xffff)
          }
        }
      }
    }
    nCurIdx = (nCurIdx + 1) | 0
    if (nCurIdx >= nTotalItems) {
      nCurIdx = 0
    }
  }

  if (candidates.length === 0) {
    return 0
  }
  const nPickedIdx = SEED_RollLimitedFast113c(m, pSeed, candidates.length) | 0
  const picked = candidates[nPickedIdx]
  return picked !== undefined ? picked : 0
}


/**
 * [36/45] Monster knockback (`0x0D`) mode transition handler (`0x6FC95160`): verifies that the monster's
 * `MonStats2` supports both mode `3` (`GH`) and mode `0x0D` (`KB`), configures knockback path type `8`
 * with distance `10` (for base class `0x4E = 78`) or `5` (all others), computes the path, frees the
 * attacker combat list, and sets animation mode `0x0D`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pModeChangeArgs)` (`ret`).
 *
 * @va D2Game:0x6FC95160
 */
export function MONSTER_ModeChangeKnockback_6FC95160_113c(
  m: D2KernMemory113c,
  pGame: number,
  pModeChangeArgs: number,
): number {
  hitD2GameVa113c(0x6FC95160)
  const pMonster = m.u32((pModeChangeArgs + 0x04) >>> 0) >>> 0
  const nClassId0 = pMonster !== 0 ? m.u32((pMonster + 0x04) >>> 0) | 0 : -1
  if ((MONSTATS2_CheckModeBit113c(m, nClassId0, 3) | 0) === 0) {
    return 0
  }

  const nClassId1 = pMonster !== 0 ? m.u32((pMonster + 0x04) >>> 0) | 0 : -1
  if ((MONSTATS2_CheckModeBit113c(m, nClassId1, 0x0d) | 0) === 0) {
    return 0
  }

  if (pMonster !== 0 && (m.u32((pMonster + 0x10) >>> 0) | 0) !== 0) {
    const pPath = m.u32((pMonster + 0x2c) >>> 0) >>> 0
    PATH_SetType113c(m, pPath, 8)
    const nBaseId = MONSTER_GetBaseIdFromUnit113c(m, pMonster) | 0
    let nDist = 5
    if (nBaseId >= 0) {
      const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
      const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
      const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0x300
      if (nBaseId < nMonStatsCount && nBaseId === 0x4e) {
        nDist = 0x0a
      }
    }
    PATH_SetDistance113c(m, pPath, nDist)
    PATH_Compute113c(m, pPath, pMonster, 0)
    SUNITDMG_FreeAttackerCombatList113c(m, pMonster, pGame >>> 0)
    UNITS_ChangeAnimMode113c(m, pMonster, 0x0d)
  }
  return 1
}

/**
 * [37/45] Monster corpse (`0x0C`) mode transition handler (`0x6FC95460`): runs `MONSTER_SetDeathPathAndAnim113c`,
 * frees the attacker combat list, transitions animation mode to `0x0C`, and removes any queued events of
 * type `8` and type `9` from `pMonster->pEventList` (`+0xDC`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pModeChangeArgs)` (`ret`).
 *
 * @va D2Game:0x6FC95460
 */
export function MONSTER_ModeChangeCorpse_6FC95460_113c(
  m: D2KernMemory113c,
  pGame: number,
  pModeChangeArgs: number,
): number {
  hitD2GameVa113c(0x6FC95460)
  const pMonster = m.u32((pModeChangeArgs + 0x04) >>> 0) >>> 0
  if (pMonster !== 0 && (m.u32((pMonster + 0x10) >>> 0) | 0) !== 0) {
    const bFlag14 = m.u8((pModeChangeArgs + 0x14) >>> 0)
    MONSTER_SetDeathPathAndAnim113c(m, pGame >>> 0, pMonster, bFlag14)
  }

  SUNITDMG_FreeAttackerCombatList113c(m, pMonster, pGame >>> 0)
  UNITS_ChangeAnimMode113c(m, pMonster, 0x0c)

  if (pMonster !== 0) {
    let pEvt8 = m.u32((pMonster + 0xdc) >>> 0) >>> 0
    while (pEvt8 !== 0) {
      const pNext = m.u32((pEvt8 + 0x24) >>> 0) >>> 0
      if (m.u8(pEvt8) === 8) {
        EVENT_FreeNode113c(m, pGame >>> 0, pEvt8)
      }
      pEvt8 = pNext
    }

    let pEvt9 = m.u32((pMonster + 0xdc) >>> 0) >>> 0
    while (pEvt9 !== 0) {
      const pNext = m.u32((pEvt9 + 0x24) >>> 0) >>> 0
      if (m.u8(pEvt9) === 9) {
        EVENT_FreeNode113c(m, pGame >>> 0, pEvt9)
      }
      pEvt9 = pNext
    }
  }
  return 1
}

/**
 * [38/45] Applies contact crush/stomp damage from `pMonster` (`ebx`) to all living players in the same
 * room within distance `<= 2` and unobstructed line-of-sight (`0x3C01`), dealing `curHp >> 5` physical
 * damage (`wResultFlags = 1`, `bHitFlags |= 4` unless target has state `0x36`).
 *
 * Binary convention: `ebx = pMonster`, `[ebp+8] = pGame` (`ret 4`).
 *
 * @va D2Game:0x6FC955C0
 */
export function MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC955C0)
  const pRoom = UNITS_GetRoom113c(m, pMonster >>> 0) >>> 0
  if (pRoom === 0) return

  const pDmg = allocStackFrame113c(0x70)
  try {
    let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
    while (pUnit !== 0) {
      if (
        (m.u32(pUnit) | 0) === 0 &&
        (m.u32((pUnit + 0x10) >>> 0) | 0) !== 0x11 &&
        (UNITS_GetApproximateDistance113c(m, pMonster >>> 0, pUnit) | 0) <= 2 &&
        (UNITS_TestCollisionBetweenUnits113c(m, pUnit, pMonster >>> 0, 0x3c01) | 0) === 0
      ) {
        for (let i = 0; i < 0x1c; i++) {
          m.setU32((pDmg + (i << 2)) >>> 0, 0)
        }
        const nHp = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
        m.setU32((pDmg + 0x08) >>> 0, (nHp >> 5) >>> 0)
        m.setU16((pDmg + 0x04) >>> 0, 1)
        if ((STATES_CheckState113c(m, pUnit, 0x36) | 0) === 0) {
          m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 4) & 0xff)
        }
        SUNITDMG_ApplyResistancesAndAbsorb113c(m, pMonster >>> 0, pUnit, pDmg)
        SUNITDMG_ApplyDamage113c(m, pGame >>> 0, pMonster >>> 0, pUnit, pDmg, 1, undefined, 1)
        SUNITDMG_ApplySideEffectsAndKill113c(m, pGame >>> 0, pMonster >>> 0, pUnit, pDmg)
      }
      pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
    }
  } finally {
    freeStackFrame113c(pDmg)
  }
}

/**
 * [39/45] Handles minion/egg/nest death notification (`0x6FC960F0`) to its owner monster (`+0x94`/`+0x98`):
 * if the dead unit had `UNITFLAGEX_TELEPORTED` (`0x400`), resolves its owner monster, checks for a free
 * spawn position near the owner (`0x3C01`), and either triggers the owner's `Skill[0]` (`+0x170`/`+0x180`)
 * via `AI_CastSkillWithMode113c` (clearing owner event `2`) or distributes experience via `0x6FCFEEE0`.
 *
 * Binary convention: `eax = pMonster`, `[esp+4] = pGame` (`ret 4`).
 *
 * @va D2Game:0x6FC960F0
 */
export function MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC960F0)
  if (pMonster === 0) return
  if (((m.u32((pMonster + 0xc8) >>> 0) >>> 10) & 1) === 0) return

  const dwOwnerType = m.u32((pMonster + 0x94) >>> 0) >>> 0
  const dwOwnerId = m.u32((pMonster + 0x98) >>> 0) >>> 0
  const pOwner = SUNIT_GetServerUnit113c(m, pGame >>> 0, dwOwnerType, dwOwnerId) >>> 0
  if (pOwner === 0) return

  const nOwnerClassId = m.u32((pOwner + 0x04) >>> 0) | 0
  if (nOwnerClassId < 0) return
  const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
  if (pDataTables === 0) return
  if (nOwnerClassId >= (m.u32((pDataTables + 0xa80) >>> 0) | 0)) return

  const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
  const pOwnerMonStats = (pMonStatsBase + imul32(nOwnerClassId, 0x1a8)) >>> 0
  if (pOwnerMonStats === 0) return

  const nOwnerX = getObjectOrUnitSubtileX113c(m, pOwner)
  const nOwnerY = getObjectOrUnitSubtileY113c(m, pOwner)
  const pCoords = allocStackFrame113c(8)
  try {
    m.setU32(pCoords, nOwnerX >>> 0)
    m.setU32((pCoords + 0x04) >>> 0, nOwnerY >>> 0)
    const nSizeX = UNITS_GetUnitSizeX113c(m, pOwner) | 0
    const pOwnerRoom = UNITS_GetRoom113c(m, pOwner) >>> 0
    const pFreeRoom =
      COLLISION_FindFreePositionSimple113c(m, pOwnerRoom, pCoords, nSizeX, 0x3c01, 0) >>> 0
    const bHasFreePos = pFreeRoom !== 0 ? 1 : 0

    if ((UNIT_GetAlignment113c(m, pMonster >>> 0) | 0) === 0 && bHasFreePos !== 0) {
      const nSkillId = (m.u16((pOwnerMonStats + 0x170) >>> 0) << 16) >> 16
      const bSkillMode = m.u8((pOwnerMonStats + 0x180) >>> 0)
      const nCastOk =
        AI_CastSkillWithMode113c(
          m,
          bSkillMode,
          pOwner,
          pGame >>> 0,
          nSkillId,
          0,
          m.u32(pCoords) | 0,
          m.u32((pCoords + 0x04) >>> 0) | 0,
        ) | 0
      if (nCastOk !== 0) {
        let pEvt = m.u32((pOwner + 0xdc) >>> 0) >>> 0
        while (pEvt !== 0) {
          const pNext = m.u32((pEvt + 0x24) >>> 0) >>> 0
          if (m.u8(pEvt) === 2) {
            EVENT_FreeNode113c(m, pGame >>> 0, pEvt)
          }
          pEvt = pNext
        }
        return
      }
    }

    sunitdmgKillUnit_6FCFEEE0(m, pGame >>> 0, pOwner)
  } finally {
    freeStackFrame113c(pCoords)
  }
}

/**
 * [40/45] Monster hover-message timeout event (`0x06`) handler (`0x6FC96570`): reschedules event `6`
 * if `CHAT_GetTimeoutFromHoverMsg113c(pHoverMsg) > pGame->dwGameFrame`, or frees the hover message,
 * clears `pMonster->pHoverMsg` (`+0xA4`), refreshes the unit room, and sets `UNITFLAG_HOVERMSG` (`0x100`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pMonster, [esp+4] = arg0, [esp+8] = arg1)` (`ret 8`).
 *
 * @va D2Game:0x6FC96570
 */
export function MONSTER_EventHoverMsgTimeout_6FC96570_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  _dwArg0 = 0,
  _dwArg1 = 0,
): void {
  hitD2GameVa113c(0x6FC96570)
  void _dwArg0
  void _dwArg1
  if (pMonster === 0) return
  const pHoverMsg = m.u32((pMonster + 0xa4) >>> 0) >>> 0
  if (pHoverMsg === 0) return

  const dwTimeout = CHAT_GetTimeoutFromHoverMsg113c(m, pHoverMsg) >>> 0
  if (dwTimeout > (m.u32((pGame + 0xa8) >>> 0) >>> 0)) {
    EVENT_SetEventFull113c(m, pGame >>> 0, pMonster >>> 0, 6, dwTimeout, 0, 0, 0)
    return
  }

  CHAT_FreeHoverMsg113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, pHoverMsg)
  m.setU32((pMonster + 0xa4) >>> 0, 0)
  UNITROOM_RefreshUnit113c(m, pMonster >>> 0)
  m.setU32((pMonster + 0xc4) >>> 0, (m.u32((pMonster + 0xc4) >>> 0) | 0x100) >>> 0)
}


/**
 * [41/45] Monster stun/get-hit mode initiation handler (`0x6FC965E0`): resets `pMonster->pDynamicPath`
 * to its default path type, schedules AI event `2` (`+1` frame if `MonStats2` lacks mode `3`, or `+45`/`+15`
 * frames for base class `0x4E` depending on state `0x15`), or clears used skill, sets `dwLastHitClass = 0xA0`
 * (`+0xB0`), and initiates mode `3` (`GH`) via `MONSTER_StartMode113c`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pMonster)` (`ret`).
 *
 * @va D2Game:0x6FC965E0
 */
export function MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
): void {
  hitD2GameVa113c(0x6FC965E0)
  const pPath = m.u32((pMonster + 0x2c) >>> 0) >>> 0
  PATH_ResetToDefaultType113c(m, pPath)

  let nClassId = m.u32((pMonster + 0x04) >>> 0) | 0
  if ((MONSTATS2_CheckModeBit113c(m, nClassId, 3) | 0) === 0) {
    const dwNextFrame = ((m.u32((pGame + 0xa8) >>> 0) + 1) | 0) >>> 0
    EVENT_SetEventFull113c(m, pGame >>> 0, pMonster >>> 0, 2, dwNextFrame, 0, 0, 0)
    return
  }

  if ((m.u32(pMonster >>> 0) | 0) === 1 && nClassId >= 0) {
    const pDataTablesPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    const pDataTables = pDataTablesPtr !== 0 ? m.u32(pDataTablesPtr) >>> 0 : 0
    if (pDataTables !== 0) {
      const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
      if (nClassId < nMonStatsCount) {
        const pMonStatsBase = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
        if (pMonStatsBase !== 0) {
          nClassId = (m.u16((pMonStatsBase + imul32(nClassId, 0x1a8) + 0x02) >>> 0) << 16) >> 16
        }
      }
      if (nClassId >= 0 && nClassId < nMonStatsCount && nClassId === 0x4e) {
        const bHasState15 = STATES_CheckState113c(m, pMonster >>> 0, 0x15) | 0
        const nDelay = bHasState15 !== 0 ? 0x2d : 0x0f
        const dwTargetFrame = ((m.u32((pGame + 0xa8) >>> 0) + nDelay) | 0) >>> 0
        EVENT_SetEventFull113c(m, pGame >>> 0, pMonster >>> 0, 2, dwTargetFrame, 0, 0, 0)
        return
      }
    }
  }

  SKILLS_SetUsedSkillMemPort113c(m, pMonster >>> 0, 0)
  m.setU32((pMonster + 0xb0) >>> 0, 0xa0)
  MONSTER_StartMode113c(m, pGame >>> 0, pMonster >>> 0, 3, 0, 0, 0)
}

function startMonsterMode8WithTargetValidation113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  onPostModeCallback?: (m: D2KernMemory113c, pGame: number, pMonster: number) => void,
): void {
  const mon = pMonster >>> 0
  const game = pGame >>> 0
  SKILLS_SetUsedSkillMemPort113c(m, mon, 0)
  const sp = allocStackFrame113c(0x20)
  try {
    for (let off = 0; off < 0x20; off += 4) {
      m.setU32((sp + off) >>> 0, 0)
    }
    m.setU32(sp, 8)
    m.setU32((sp + 0x04) >>> 0, mon)
    let blPathMode = 0x64
    if (mon !== 0) {
      const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((mon + 0x04) >>> 0) | 0) >>> 0
      if (pMonStats2 !== 0) {
        const bFlags105 = m.u8((pMonStats2 + 0x105) >>> 0)
        const pBitMasks = m.u32(0x6fd18be0) >>> 0
        const mask0 = pBitMasks !== 0 ? m.u32(pBitMasks) >>> 0 : 1
        if ((bFlags105 & mask0) !== 0) {
          blPathMode = 0x65
        }
      }
    }
    m.setU8((sp + 0x15) >>> 0, blPathMode)

    SUNIT_ValidatePathTargetUnit113c(m, mon, game)
    const pPath = mon !== 0 ? m.u32((mon + 0x2c) >>> 0) >>> 0 : 0
    const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
    const pEffectiveTarget = pTarget === mon ? 0 : pTarget
    m.setU32((sp + 0x08) >>> 0, pEffectiveTarget)

    hitD2GameVa113c(0x6FC95E10)
    MONSTER_StartModeReal113c(m, game, mon, 8, pEffectiveTarget, 0, 0, blPathMode, 1)

    const bHasState1 = STATES_CheckState113c(m, mon, 1) | 0
    if (bHasState1 === 0 || (SUNIT_IsDeadOrDying113c(m, mon) | 0) !== 0) {
      const pfnAiRun = m.u32(0x6fd1bc1c) >>> 0
      if (pfnAiRun !== 0) {
        if (onPostModeCallback !== undefined) {
          onPostModeCallback(m, game, mon)
        } else if (pfnAiRun === 0x6fcbd3b0) {
          AI_RunMonsterAI113c(m, game, mon, 0, 0)
        }
      } else if (onPostModeCallback !== undefined) {
        onPostModeCallback(m, game, mon)
      }
    }
  } finally {
    freeStackFrame113c(sp)
  }
}

/**
 * [42/45] Initiates monster mode `8` (`S1`) after clearing `pUsedSkill`, validating the path target unit,
 * and invoking `MONSTER_StartMode113c` (`0x6FC96A50`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pMonster)` (`ret`).
 *
 * @va D2Game:0x6FC96A50
 */
export function MONSTER_StartMode8CastA_6FC96A50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  onPostModeCallback?: (m: D2KernMemory113c, pGame: number, pMonster: number) => void,
): void {
  hitD2GameVa113c(0x6FC96A50)
  startMonsterMode8WithTargetValidation113c(m, pGame, pMonster, onPostModeCallback)
}

/**
 * [43/45] Initiates monster mode `8` (`S1`) after clearing `pUsedSkill`, validating the path target unit,
 * and invoking `MONSTER_StartMode113c` (`0x6FC96B20`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pMonster)` (`ret`).
 *
 * @va D2Game:0x6FC96B20
 */
export function MONSTER_StartMode8CastB_6FC96B20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  onPostModeCallback?: (m: D2KernMemory113c, pGame: number, pMonster: number) => void,
): void {
  hitD2GameVa113c(0x6FC96B20)
  startMonsterMode8WithTargetValidation113c(m, pGame, pMonster, onPostModeCallback)
}

/**
 * [44/45] Advances a monster's skill-cast animation frame (`0x6FC96F20`):
 * - If `UNITS_HasAnimFinished113c(pMonster)` is non-zero, transitions back to AI/neutral via
 *   `MONSTER_EndToAiOrNeutral113c` (`0x6FC96BF0`) and returns `2`.
 * - Otherwise steps skill path movement when `(SKILLS_GetFlags113c(pSkill) & 1) != 0`, triggers
 *   `SKILLS_DoUsedSkillAction113c` (`0x6FCC2060`) on path completion (`step == 2`) or action frame
 *   (`bActionFlag == 4` or `1`/`2` when not in `UNITFLAG_SKILLMODE`), advances animation frame, and returns `1`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pMonster)` (`ret`).
 *
 * @va D2Game:0x6FC96F20
 */
export function MONSTER_StepSkillCastAnim_6FC96F20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  stepPathOverride?: (m: D2KernMemory113c, pMonster: number) => number,
): number {
  hitD2GameVa113c(0x6FC96F20)
  if ((UNITS_HasAnimFinished113c(m, pMonster >>> 0) | 0) !== 0) {
    MONSTER_EndToAiOrNeutral113c(m, pGame >>> 0, pMonster >>> 0)
    return 2
  }

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pMonster >>> 0) >>> 0
  const dwSkillFlags = SKILLS_GetFlags113c(m, pSkill) >>> 0
  let bAllowFrameTrigger = 1

  if ((dwSkillFlags & 1) !== 0) {
    SUNIT_ValidatePathTargetUnit113c(m, pMonster >>> 0, pGame >>> 0)
    const nStepRes =
      stepPathOverride !== undefined
        ? stepPathOverride(m, pMonster >>> 0) | 0
        : stepMonsterPathRaw_6FD01930(m, pGame >>> 0, pMonster >>> 0)
    if (nStepRes === 2) {
      SKILLS_SetParam0C113c(m, pSkill, (dwSkillFlags | 2) >>> 0)
      SKILLS_DoUsedSkillAction113c(m, pMonster >>> 0, pGame >>> 0)
      bAllowFrameTrigger = 0
    }
  }

  const bActionFlag = m.u8((pMonster + 0x4e) >>> 0)
  if (bActionFlag === 4) {
    SKILLS_DoUsedSkillAction113c(m, pMonster >>> 0, pGame >>> 0)
  } else if (bAllowFrameTrigger !== 0) {
    const bInSkillMode = (m.u32((pMonster + 0xc4) >>> 0) >>> 6) & 1
    if (bInSkillMode === 0 && (bActionFlag === 1 || bActionFlag === 2)) {
      SKILLS_DoUsedSkillAction113c(m, pMonster >>> 0, pGame >>> 0)
    }
  }

  UNITS_AdvanceAnimFrame113c(m, pMonster >>> 0)
  return 1
}

/**
 * [45/45] Clears the player's cursor item (`0x6FC97D90`): queues the 6-byte clear-cursor packet `0x42`
 * to the player's client, clears the inventory cursor slot (`INVENTORY_SetCursorItem113c(pInv, 0)`),
 * sets item flag `0x01`, appends the item GUID node to `pInventory`, and sets unit update flags on `pPlayer`.
 *
 * Binary convention: `esi = pPlayer`, `ebx = pItem` (`ret`).
 *
 * @va D2Game:0x6FC97D90
 */
export function PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pItem: number,
): void {
  hitD2GameVa113c(0x6FC97D90)
  const pInventory = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  let pClient = 0
  if ((m.u32(pPlayer >>> 0) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const pPkt = allocStackFrame113c(8)
  try {
    m.setU32(pPkt, 0)
    m.setU16((pPkt + 0x04) >>> 0, 0)
    m.setU8(pPkt, 0x42)
    m.setU8((pPkt + 0x01) >>> 0, m.u32(pPlayer >>> 0) & 0xff)
    m.setU32((pPkt + 0x02) >>> 0, m.u32((pPlayer + 0x0c) >>> 0) >>> 0)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 6)
  } finally {
    freeStackFrame113c(pPkt)
  }

  INVENTORY_SetCursorItem113c(m, pInventory, 0)
  ITEMS_SetItemFlag113c(m, pItem >>> 0, 1, 1)
  INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem >>> 0)
  UNITS_SetUnitUpdateFlags113c(m, pPlayer >>> 0, 1)
}
