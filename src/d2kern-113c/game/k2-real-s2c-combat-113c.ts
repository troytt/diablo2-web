/**
 * Diablo II v1.13c Pure Kernel — Real `D2Game.dll` Non-Item Combat (`67` VAs), Timed-State `D2StatListStrc`
 * + `0x6FC9A5E0` State S2C (`0xA7`/`0xA8`/`0xA9`), Room/Warriv (`6` VAs), Pure `fallen-ai` (`30` VAs), and
 * `0x6FCAA3E0` S2C Packet Emission Pipeline.
 *
 * Strictly 100% `Memory113c`-native: zero JS gameplay caches, zero array sorting, zero permissive fallbacks,
 * zero `./combat-a1c-113c.ts` dependencies, and `hitD2GameVa113c` instrumentation on every `D2Game` VA.
 */
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import {
  D2ActiveRoomStrc,
  D2AiCmdStrc,
  D2AiCmdStrc_SIZE,
  D2AiControlStrc,
  D2AiGeneralStrc,
  D2DamageStrc,
  D2DamageStrc_SIZE,
  D2DynamicPathStrc,
  D2GameStrc,
  D2ItemDataStrc,
  D2MonsterDataStrc,
  D2StatListExStrc,
  D2StatListStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import { seedNext, seedRoll, type D2SeedStrc } from '../prng.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, mulDiv113c, sar32, sdiv32 } from '../common/int-math.ts'
import { COLLISION_CheckMaskWithPattern2_113c } from '../common/collision.ts'
import {
  DUNGEON_CheckLOSDraw113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordListIndexAtSubtile113c,
  DUNGEON_IsTownLevelId113c,
} from '../common/dungeon.ts'
import {
  MONSTER_CheckMonTypeFlag0x20_113c,
  MONSTER_GetMonStatsInteractBit113c,
} from '../common/drlg/drlg-ver.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetActiveWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  INVENTORY_GetWeaponByHandSlotMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  ITEMS_GetDexBonusMemPort113c,
  ITEMS_GetStrBonusMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_GetWeaponMasteryBonusMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  ITEMS_ApplyItemQualityMods113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckItemTypeIdMem113c,
  ITEMS_GetBodyLocation113c,
  ITEMS_GetCommandFlags113c,
  ITEMS_GetItemFormat113c,
  ITEMS_GetItemQuality113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_GetUnitHitClass113c,
  ITEMS_IsHighQualityItem113c,
  ITEMS_IsReEquip113c,
  ITEMS_IsReload113c,
  ITEMS_SerializeItemToBuffer113c,
  ITEMS_SetAutoAffix113c,
  ITEMS_SetItemFlag113c,
  ITEMS_TestFlagMask113c,
  unitsCanDualWieldMem113c,
} from '../common/items.ts'
import { MONSTERS_GetCompCode113c } from '../common/monsters.ts'
import {
  INVENTORY_FindBackpackItemByType113c,
  INVENTORY_GetEquippedWeaponHandClass113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemEquipLocation113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts'
import {
  PATH_AddUnitCollisionFootprint113c,
  PATH_AllocDynamicPath113c,
  PATH_Compute113c,
  PATH_ComputeDirection113c,
  PATH_ForceDirection113c,
  PATH_GetDirection113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_MarkUnitDeadCollision113c,
  PATH_SetDistance113c,
  PATH_SetNewDistance113c,
  PATH_SetStepDistance113c,
  PATH_SetStepNum113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_SetType113c,
  PATH_SetVelocity113c,
  PATH_Step113c,
  UNITS_GetDirectionToCoords113c,
} from '../common/path.ts'
import { AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import { UNITS_GetLeftSkill113c, UNITS_GetRightSkill113c, HIRELING_GetExpForLevel113c } from '../common/quest-record.ts'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile.ts'
import {
  SKILLS_GetOwnerItemGuid113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillUseFailReason113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetRightSkill113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  STATLIST_FLAG_TIMED,
  STATLIST_AddUnitStat113c,
  STATLIST_AllocList113c,
  STATLIST_ExpireOrphanStateSubLists113c,
  STATLIST_ExpireStateListsOnModeChange113c,
  STATLIST_FreeStatListImpl113c,
  STATLIST_GetExpireFrame113c,
  STATLIST_GetExtendedUnitStatsById113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetOwnerId113c,
  STATLIST_GetOwnerType113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrame113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
  STATES_CheckState113c,
  STATES_CheckStateMask2OnUnit113c,
  STATES_CheckStateMask30OnUnit113c,
  STATES_ClearGfxStateFlag113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATES_ToggleState113c,
} from '../common/statlist.ts'
import {
  COMPOSIT_GetUnitWeaponClassCode113c,
  UNITS_GetPlayerData113c,
} from '../common/composit.ts'
import { UNITS_IsInMovingMode113c } from '../common/waypoint.ts'
import { CHAT_FreeHoverMsg113c } from '../common/text.ts'
import {
  STATES_UpdateGfxStateFlagsByMask113c,
  UNIT_GetAlignment113c,
  UNIT_GetAlignmentMemPort113c,
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNITROOM_ClearUpdateQueue113c,
  UNITROOM_RefreshUnit113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetAnimStartFrame113c,
  UNITS_GetBaseWalkVelocity113c,
  UNITS_GetBlockChance113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetEquippedWeaponAdder113c,
  UNITS_GetPathRoomRefreshFlag113c,
  UNITS_GetPlayerBaseToHit113c,
  UNITS_GetRoom113c,
  UNITS_GetSeed113c,
  UNITS_GetVelocity113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNITS_SetOwner113c,
  UNITS_SetSeed113c,
  UNITS_GetTransformGfx113c,
  UNITS_SetSeqFrameFromLowByte113c,
  UNITS_SetUnitAnimMode113c,
  UNITS_UpdateAnimFrame113c,
  unitsGetTransformGfxValues113c,
} from '../common/unit.ts'
import {
  DATATBLS_GetCurrentLevelFromExp113c,
  DATATBLS_GetExpRatio113c,
  DATATBLS_GetMagicAffixTxtRecord113c,
  DATATBLS_GetMaxLevel113c,
  DATATBLS_GetMonLvlTxtRecord113c,
  DATATBLS_GetStartExpForLevel113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
  MONSTERS_IsDead113c,
  MONSTERS_IsDemonOrUndead113c,
} from '../tables/datatbls-113c.ts'
import { DATATBLS_UnusedStub10469_113c } from '../tables/lvl-tbls-113c.ts'
import { DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c } from '../tables/monster-tbls-113c.ts'
import {
  NET_QueuePacketPtrToClient113c,
  NET_QueuePacketToClient113c,
  drainClientS2CPackets113c,
  drainFrameS2CPackets113c,
} from '../net/packet-sink.ts'
import {
  CLIENTS_SetPlayerCurrentRoom113c,
  GAME_UpdateActRooms113c,
  ROOM_ActivateRoomForClient113c,
  ROOM_DeactivateMonsterInRoom113c,
  ROOM_DeactivateRoomForClient113c,
  ROOM_DeactivateUnitInRoom113c,
  ROOM_RefreshUnitsAndLoadSaved113c,
  ROOM_SaveInactiveMonsterNode113c,
  ROOM_SaveInactiveUnitToActNode113c,
} from './act-rooms-113c.ts'
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CheckApproachTauntSound113c,
  AI_FallenShaman113c,
  AI_LookupDispatchTableRow113c,
  AI_Skeleton113c,
  AI_StartAttackMode113c,
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_GetPackLeaderUnit113c,
  AIGENERAL_ReassignPackOnBossDeath113c,
  MONSTER_ApplyCritDamage113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_HasAlwaysChaseFlag113c,
  MONSTER_InitModeChangeStrc113c,
  MONSTER_StartAttackOrCast113c,
  SUNIT_SetUnitEventSound113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  MONMODE_EnterAnimMode10_6FC94C90_113c,
  MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c,
} from './k2-w2b3-113c.ts'
import { SUNITDMG_GetDefenderColdEffect113c } from './k2-combat-core-w1-113c.ts'
import {
  D2GAME_FP_REMOVE_TIMED_STATE_VA_113C,
  MONSTER_Event03_RegenAndPoisonTick113c,
  MONSTER_Event12_ExpireTimedStats113c,
  MONSTER_ExpireDeathStateSubLists113c,
  MONSTER_StartGetHitMode113c,
  NET_SendPacket0x23_AssignSkill113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
  NET_SendPacket0xAB_UnitHeal113c,
  SEED_RollRangeWithMinFast113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
  STATES_ClearCurseStatesOnUnit113c,
} from './k2-gap-melee-dot-113c.ts'
import {
  AI_RunMonsterAI113c,
  MON_EVENT_AI_THINK,
  MON_EVENT_MODE_END,
  MON_EVENT_MODE_STEP,
  MON_EVENT_STAT_REGEN,
  MONSTER_ClearModeEvents113c,
  MONSTER_GetModeEntry113c,
  MONSTER_INLINE_AI_ON_END_TABLE_113C,
  MONSTER_IsContinuousMode113c,
  MONSTER_NullModeEventFallback113c,
  MONSTER_RegisterContinuousModeEvent113c,
  MONSTER_StartNeutral113c,
  SKILLS_SetUsedSkill113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
  getK2MonsterDropLootHook113c,
  getRegisteredMonsterAiThinkVaHandler113c,
  runPostSliceFrameCleanupHooks113c,
  runPreSliceFrameSetupHooks113c,
  setDefaultMonsterAiThinkCallback113c,
  setK2MonsterDropLootHook113c,
} from './monster-events.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS2_CheckModeBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_GetBossMinionField34_113c,
  MONSTER_ScheduleInitialAiEvent113c,
  SEED_RollLimitedFast113c,
  SEED_RollMaskFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_InitUnitAnimData113c,
  SUNIT_IsUnitInActiveClientRoom113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import {
  MONSTER_SetLastHitModeField54_113c,
  MONSTER_StartModeRun113c,
  SKILLS_ItemEventThorns113c,
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c.ts'
import {
  CLIENTS_GetPlayerUnit113c,
  MONSTER_ApplyModeVelocityOverride113c,
  MONSTER_StartModeWalk113c,
} from './replay-final11-113c.ts'
import {
  ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c,
  MONSTER_DropDeathItems_6FC95900_113c,
  isItemRatioTableLoaded113c,
  isSgptDataTablesLoaded113c,
} from './k2-real-itemdrop-113c.ts'
import { ITEMS_RollMagicAffixByFormat_6FC34B50_113c } from './k2-w4b1-113c.ts'
import { SUNIT_UnlinkFromRoomUpdateList113c } from './a1c-post150-f150-f276-113c.ts'
import {
  ARENA_ProcessKillScoreUpdate113c,
  MONSTER_DeleteAiAndRegenEvents113c,
  PARTY_ForEachPartyMemberInSameLevel113c,
  PLAYER_SetActiveDualWeaponStatLists113c,
  PLAYER_UpdateDualWieldWeaponStatLists113c,
  QUESTS_OnMonsterKill113c,
  SKILLS_DoUsedSkillAction113c,
  SKILLS_StartUsedSkill113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
  SUNIT_DispatchItemEventCallbacks113c,
  SUNITDMG_ApplyOpenWoundsAndCrushingBlowSideEffects113c,
  UNITROOM_IsClientInUnitRoom113c,
} from './a1c-post150-f786-f1040-113c.ts'
import {
  ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c,
  SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c,
  SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c,
} from './k2-w5b7-113c.ts'
import {
  AI_AcquireOrValidateCombatTarget113c,
  AI_HandleStunDoorOrLeaderFollow113c,
  AITARGET_ScanUnitsByModeTable113c,
  AITHINK_CanPlayerStartSkillOrCast113c,
  AITHINK_CanPlayerSwitchToMode113c,
  PLAYER_RecalcTargetUnitPath113c,
  PLAYER_SetNeutralOrTownNeutralMode113c,
  PLAYER_StartWalkOrRunMode113c,
  SUNIT_FindValidNextRoomInAct113c,
  SUNIT_UpdateUnitPositionAndRoom113c,
  registerAiTargetModeCallback113c,
} from './town-runtime-gap-113c.ts'
import {
  MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c,
} from './k2-w2b3-113c.ts'
import {
  HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c,
  PLAYER_LevelUp_6FD0B090_113c,
} from './k2-w6b6-113c.ts'
import { ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c } from './k2-w7b4-113c.ts'
import {
  MONSTER_AutoEquipInteractItem_6FC98B60_113c,
  PETS_OnPetOrMercKilled_6FCB8120_113c,
} from './k2-w8b2-113c.ts'
import { ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c } from './k2-w12b1-113c.ts'
import {
  MONSTER_ApplyElementalDamageAndResistStats113c,
  MONSTER_DispatchMinionComponentCallbacks113c,
  NET_QueuePacketToClientBuffer113c,
} from './boot-init-gap-a-113c.ts'
import {
  D2GAME_PACKET_SendMonsterAssign113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
} from './boot-init-gap-b-113c.ts'
import {
  EXP_RATIOS_113C,
  bindRoomCollisionGrid113c,
  calculateKillExperienceGainPure113c,
  computeFrwDiminishingPure113c,
  computeRawPlayerAnimSpeedPure113c,
  ensureD2CommonPathGlobals113c,
  getCharAnimClipPure113c,
  getCharStatsPure113c,
  getItemTypeClosurePure113c,
  getItemsTxtRecordPure113c,
  getMonLvlXpRow113c,
  getMonStatsRowByClassId113c,
  getMonStatsTxtPtrPure113c,
  getMonsterCritPure113c,
  getMonsterModeBaseAnimSpeed256Pure113c,
  getMonsterModeBaseFrameCountPure113c,
  getMonsterModeFlagsPure113c,
  isItemCodeShieldPure113c,
  playerAnimStartFramePure113c,
  rollTreasureClassSeedOnly113c,
  type MonStatsRow113c,
  type PureCharAnimClip113c,
} from './tables-bootstrap-113c.ts'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_DeleteEventByType113c,
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_SetEventFull113c,
  EVENT_UpdateTimers113c,
  MONSTER_RefreshAiEvent113c,
} from './timer-wheel.ts'
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c.ts'
import { SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c } from './k2-w3b4-113c.ts'
import {
  MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c,
  MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c,
} from './k2-w3b7-113c.ts'
import {
  MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c,
  MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c,
  MONSTER_MorphMonsterClassId_6FCCFC50_113c,
} from './k2-w4b7-113c.ts'
import { SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c } from './k2-w4b8-113c.ts'
import { SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c } from './k2-w5b7-113c.ts'
import { SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c } from './k2-w6b2-113c.ts'
import {
  PLAYER_GetEquippedWeapon113c,
  SKILLS_GetFlags113c,
  SUNIT_ScheduleModeAnimEvents113c,
} from './replay-kernel-113c.ts'
import { MONTYPE_TestNestedBit_6FC21620_113c } from './k2-laneH-0x6fc2-w1-113c.ts'
import { SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c } from './k2-w2b8-113c.ts'
import { PETS_FindPetArgByGuid_6FCB6570_113c } from './k2-w4b5-113c.ts'
import { hitD2CommonVa113c, hitD2GameVa113c } from '../va-trace-113c.ts'

export {
  AI_RunMonsterAI113c,
  GAME_UpdateActRooms113c,
  NET_QueuePacketPtrToClient113c,
  NET_QueuePacketToClient113c,
  PATH_AllocDynamicPath113c,
  ROOM_ActivateRoomForClient113c,
  ROOM_DeactivateMonsterInRoom113c,
  ROOM_DeactivateRoomForClient113c,
  ROOM_DeactivateUnitInRoom113c,
  ROOM_RefreshUnitsAndLoadSaved113c,
  ROOM_SaveInactiveMonsterNode113c,
  ROOM_SaveInactiveUnitToActNode113c,
  drainClientS2CPackets113c,
  drainFrameS2CPackets113c,
  setK2MonsterDropLootHook113c,
}

export const D2GAME_FP_REMOVE_COLD_VA_113C = 0x6fcfb4c0
export const D2GAME_FP_REMOVE_FREEZE_VA_113C = 0x6fcfbd90
export const D2CombatStrc_SIZE_113C = 0x88

/** Authoritative 7-entry armor durability slot table at `D2Game.dll:0x6FD2E628` (`bodyLoc, weight`). */
export const D2GAME_ARMOR_DURABILITY_SLOTS_6FD2E62C: ReadonlyArray<
  readonly [bodyLoc: number, weight: number]
> = [
  [1, 3], // Head
  [3, 5], // Torso
  [4, 4], // Right Arm
  [5, 4], // Left Arm
  [8, 2], // Belt
  [9, 2], // Feet
  [10, 2], // Gloves
]

/**
 * Authoritative 12-entry resistance & absorb channel descriptor table at `D2Game.dll:0x6FD22AB0` (`12 * 0x2C`):
 * `[dmgOff, resStat, maxResStat, pierceStat, absorbPctStat, absorbFlatStat, drFlatIdx, onlyPvP, scalePvP]`.
 */
export const D2GAME_RES_ABSORB_CHANNELS_6FD22AB0: ReadonlyArray<
  readonly [
    dmgOff: number,
    resStat: number,
    maxResStat: number,
    pierceStat: number,
    absorbPctStat: number,
    absorbFlatStat: number,
    drFlatIdx: number,
    onlyPvP: number,
    scalePvP: number,
  ]
> = [
  [0x08, 36, -1, -1, -1, -1, 1, 0, 1],
  [0x10, 39, 40, 333, 142, 143, 2, 0, 1],
  [0x1c, 41, 42, 334, 144, 145, 2, 0, 1],
  [0x24, 43, 44, 335, 148, 149, 2, 0, 1],
  [0x20, 37, 38, -1, 146, 147, 2, 0, 1],
  [0x30, 43, 44, 335, -1, -1, 0, 0, 0],
  [0x34, 43, 44, 335, -1, -1, 0, 0, 0],
  [0x2c, 110, -1, 336, -1, -1, 0, 0, 0],
  [0x28, 45, 46, 336, -1, -1, 0, 0, 1],
  [0x38, -1, -1, -1, -1, -1, 0, 1, 1],
  [0x3c, -1, -1, -1, -1, -1, 0, 1, 1],
  [0x40, -1, -1, -1, -1, -1, 0, 1, 1],
]

/** Authoritative 4-entry elemental death overlay table at `D2Game.dll:0x6FD1B050` (`[dmgOff, hitClass]`). */
export const D2GAME_ELEM_DEATH_OVERLAYS_6FD1B050: ReadonlyArray<readonly [dmgOff: number, hitClass: number]> = [
  [0x24, 0x30], // Cold
  [0x10, 0x20], // Fire
  [0x1c, 0x40], // Lightning
  [0x28, 0x50], // Poison
]

/** Authoritative level-diff XP ratio tables `/ 256` at `D2Game.dll:0x6FD1A01C` & `0x6FD1A048`. */
export const D2GAME_XP_RATIO_UNDER25_6FD1A01C: readonly number[] = [
  256, 256, 256, 256, 256, 256, 207, 159, 110, 61, 13,
]
export const D2GAME_XP_RATIO_OVER_6FD1A048: readonly number[] = [
  256, 256, 256, 256, 256, 256, 225, 174, 92, 38, 5,
]

const D2GAME_DEATH_OVERLAY_ROTOR_VA_113C = 0x6fd31f98
const D2GAME_BLOCK_ACTION_MODES_6FD22CE4: readonly number[] = [
  0x08, 0x07, 0x01, 0x17, 0x06, 0x07, 0x01, 0x15, 0x15, 0x12, 0x15, 0x15, 0x15, 0x15,
]
const D2GAME_GETHIT_DIVISOR_BY_HITTYPE_113C: readonly number[] = [
  16, 8, 16, 32, 64, 8, 16, 32, 16, 8, 8, 16,
]
var k2DeathOverlayRotor = 0

function isDeathOverlayRotorMappedK2(m: Memory113c): boolean {
  try {
    m.u8(D2GAME_DEATH_OVERLAY_ROTOR_VA_113C)
    return true
  } catch {
    return false
  }
}

function scaleDivRatioDll113c(val: number, scale: number, div: 100 | 128): number {
  const a = val | 0
  const b = scale | 0
  const thresh = div === 128 ? 0x800 : 0x640
  if (a > 0x100000) {
    if ((a & 0xfffffff0) < thresh) {
      return Number((BigInt(a) * BigInt(b)) / BigInt(div)) | 0
    }
    const q = div === 128 ? sdiv32(a, 128) : Math.trunc(a / 100) | 0
    return imul32(q, b)
  }
  if (b > 0x10000) {
    if ((b & 0xfffffff0) < thresh) {
      return Number((BigInt(a) * BigInt(b)) / BigInt(div)) | 0
    }
    const q = div === 128 ? sdiv32(b, 128) : Math.trunc(b / 100) | 0
    return imul32(q, a)
  }
  const prod = imul32(a, b)
  return div === 128 ? sdiv32(prod, 128) : Math.trunc(prod / 100) | 0
}

function applySingleChannelResistanceDll113c(
  m: Memory113c,
  pCombat: number,
  dmgOff: number,
  resStat: number,
  maxResStat: number,
  pierceStat: number,
  absPctStat: number,
  absFlatStat: number,
  drIdx: number,
  bSkipAbsorb: number,
): number {
  const combat = pCombat >>> 0
  const pDmg = m.u32((combat + 0x18) >>> 0) >>> 0
  const dmgPtr = (pDmg + (dmgOff >>> 0)) >>> 0
  let dmgVal = m.u32(dmgPtr) | 0
  if (dmgVal <= 0) {
    m.setU32(dmgPtr, 0)
    return 0
  }
  hitD2GameVa113c(0x6FCFB3C0)
  const att = m.u32((combat + 0x08) >>> 0) >>> 0
  const def = m.u32((combat + 0x0c) >>> 0) >>> 0
  const bDefNonHireMon = m.u32((combat + 0x14) >>> 0) | 0
  let res = resStat !== -1 ? (STATLIST_GetUnitStat113c(m, def, resStat, 0) | 0) : 0
  if (pierceStat !== -1 && (res < 100 || bDefNonHireMon === 0)) {
    const pierce = STATLIST_GetUnitStat113c(m, att, pierceStat, 0) | 0
    if (pierce !== 0) res = (res - pierce) | 0
  }
  if (bDefNonHireMon === 0 && resStat !== 0x24 && resStat !== 0x25) {
    const pGame = m.u32(combat) >>> 0
    if (m.u32((pGame + 0x70) >>> 0) !== 0) {
      const pMonLvl = m.u32((combat + 4) >>> 0) >>> 0
      res = (res + (m.u32(pMonLvl) | 0)) | 0
    } else {
      const diff = m.u8((pGame + 0x6d) >>> 0)
      if (diff === 1) res = (res - 0x14) | 0
      else if (diff === 2) res = (res - 0x32) | 0
    }
  }
  if (res <= 0) {
    if (res <= -100) res = -100
  } else {
    if (bDefNonHireMon === 0) {
      let cap =
        maxResStat === -1
          ? resStat === 0x24
            ? 0x32
            : 0x4b
          : ((STATLIST_GetUnitStat113c(m, def, maxResStat, 0) | 0) + 0x4b) | 0
      if (maxResStat !== -1 && cap >= 0x5f) cap = 0x5f
      if (res <= -100) res = -100
      if (res >= cap) res = cap
    }
    if (
      resStat === 0x24 &&
      STATES_CheckState113c(m, att, 0x2f) !== 0 &&
      MONSTERS_IsDemonOrUndead113c(m, def) !== 0
    ) {
      res = 0
    }
  }

  if (bSkipAbsorb !== 0) {
    if (res > 0) res = 0
  } else {
    dmgVal = (dmgVal - (m.u32((combat + (drIdx | 0) * 4 + 0x1c) >>> 0) | 0)) | 0
  }
  if (dmgVal > 0 && res !== 0) {
    const effRes = res < 100 ? res : 100
    dmgVal = mulDiv113c(100 - effRes, dmgVal, 100) | 0
  }
  if (bSkipAbsorb === 0) {
    hitD2GameVa113c(0x6FCFAD00)
    if (absPctStat !== -1) {
      let absPct = STATLIST_GetUnitStat113c(m, def, absPctStat, 0) | 0
      if (absPct >= 0x28) absPct = 0x28
      if (absPct > 0) {
        const abs = mulDiv113c(absPct, dmgVal, 100) | 0
        m.setU32((pDmg + 0x48) >>> 0, ((m.u32((pDmg + 0x48) >>> 0) | 0) + abs) >>> 0)
        dmgVal = (dmgVal - abs) | 0
      }
    }
    const flat = (STATLIST_GetUnitStat113c(m, def, absFlatStat, 0) | 0) << 8
    if (flat > 0) {
      const take = flat < dmgVal ? flat : dmgVal
      m.setU32((pDmg + 0x48) >>> 0, ((m.u32((pDmg + 0x48) >>> 0) | 0) + take) >>> 0)
      dmgVal = (dmgVal - take) | 0
    }
  }
  m.setU32(dmgPtr, dmgVal >>> 0)
  return dmgVal >>> 0
}

function applyTimedDotEffectDll113c(
  m: Memory113c,
  stateId: number,
  pDefender: number,
  pAttacker: number,
  dmg: number,
  len: number,
): void {
  const rate = dmg | 0
  const dur = len | 0
  if (rate <= 0 || dur <= 0) return
  const def = pDefender >>> 0
  const att = pAttacker >>> 0
  const pOld = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, def, stateId) >>> 0
  if (att === 0) {
    throw new D2CommonAssertError('SUnitDmg.cpp', 0xa2a)
  }
  const pGame = m.u32((att + 0x80) >>> 0) >>> 0
  if (def !== 0 && m.u32(def) === 1) {
    let ev = m.u32((def + 0xdc) >>> 0) >>> 0
    while (ev !== 0) {
      const next = m.u32((ev + 0x24) >>> 0) >>> 0
      if (m.u8(ev) === 3) {
        EVENT_FreeNode113c(m, pGame, ev)
      }
      ev = next
    }
    const curFrame = m.u32((pGame + 0xa8) >>> 0) | 0
    EVENT_SetEventFull113c(m, pGame, def, 3, (curFrame + 1) >>> 0, 0, 0, 0)
  }
  const expire = ((m.u32((pGame + 0xa8) >>> 0) | 0) + dur) | 0
  if (pOld === 0) {
    STATES_ToggleGfxStateFlag113c(m, def, stateId, 1)
    const pList = STATLIST_AllocList113c(
      m,
      2,
      m.u32(att) | 0,
      m.u32((att + 0x0c) >>> 0),
      0,
      expire >>> 0,
    )
    EVENT_SetEventFull113c(m, pGame, def, 0x0c, expire >>> 0, 0, 0, 0)
    STATLIST_SetStat113c(m, pList, 0x4a, (-rate) | 0, 0)
    STATLIST_SetState113c(m, pList, stateId)
    STATLIST_SetStatRemoveProc113c(m, pList, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
    STATLIST_MergeStatLists113c(m, def, pList, 1)
  } else {
    const oldVal = STATLIST_GetStatValue113c(m, pOld, 0x4a, 0) | 0
    if (((-oldVal) | 0) > rate) return
    STATLIST_SetExpireFrameEx113c(m, pOld, expire >>> 0)
    EVENT_SetEventFull113c(m, pGame, def, 0x0c, expire >>> 0, 0, 0, 0)
    STATLIST_SetStat113c(m, pOld, 0x4a, (-rate) | 0, 0)
  }
}

export interface SUnitDmgHooks113c {
  onPreClampDamageResolved?: (
    m: Memory113c,
    pAttacker: number,
    pDefender: number,
    preClampTotalDmg: number,
  ) => void
  onDamagedInMeleeEvents?: (
    m: Memory113c,
    pGame: number,
    pAttacker: number,
    pDefender: number,
    pDmg: number,
  ) => void
  onMonsterAttackerHit?: (m: Memory113c, pGame: number, pAttacker: number) => void
  onApplyPoison?: (
    m: Memory113c,
    pGame: number,
    pAttacker: number,
    pDefender: number,
    poisDmg: number,
    poisLen: number,
  ) => void
  onKillUnit?: (
    m: Memory113c,
    pGame: number,
    pDefender: number,
    pAttacker: number,
    bAwardExp: number,
  ) => void
  onPlayerDodgeOrAvoid?: (
    m: Memory113c,
    pGame: number,
    pDefender: number,
    pAttacker: number,
    wResultFlags: number,
  ) => void
  onPlayerBlock?: (m: Memory113c, pGame: number, pDefender: number) => void
  onMonsterStartMode?: (
    m: Memory113c,
    pGame: number,
    pDefender: number,
    mode: number,
    pAttacker: number,
  ) => void
  onUnitFlagsUpdated?: (m: Memory113c, pUnit: number, nextFlags: number) => void
  suppressDirectS2c?: boolean
}

let k2DefaultSUnitDmgHooks: SUnitDmgHooks113c | undefined

export function setDefaultSUnitDmgHooks113c(hooks: SUnitDmgHooks113c | undefined): void {
  const prev = k2DefaultSUnitDmgHooks
  k2DefaultSUnitDmgHooks = hooks
  if (prev === undefined && hooks !== undefined) {
    runPreSliceFrameSetupHooks113c()
  } else if (prev !== undefined && hooks === undefined) {
    runPostSliceFrameCleanupHooks113c()
  }
}

export function getDefaultSUnitDmgHooks113c(): SUnitDmgHooks113c | undefined {
  return k2DefaultSUnitDmgHooks
}

function checkItemTypePureOrMemK2(m: Memory113c, pItem: number, targetTypeId: number): number {
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const sgptPtr = safeReadU32K2(m, 0x6fde9e1c)
  if (
    isSgptDataTablesLoaded113c(m) &&
    sgptPtr !== 0 &&
    safeReadU32K2(m, (sgptPtr + 0xbfc) >>> 0) !== 0 &&
    safeReadU32K2(m, 0x6fdd90b0) !== 0
  ) {
    return ITEMS_CheckItemTypeIdMemPort113c(m, pItem, targetTypeId) !== 0 ? 1 : 0
  }
  if (ITEMS_CheckItemTypeIdMem113c(m, pItem, targetTypeId) !== 0) return 1
  const rec = getItemsTxtRecordPure113c(m.get(pItem, D2UnitStrc.dwClassId) | 0)
  if (rec === null) return 0
  const closure = getItemTypeClosurePure113c()
  const anc1 = closure.ancestorsByIndex[rec.wType1]
  if (anc1 !== undefined && anc1.has(targetTypeId)) return 1
  if (rec.wType2 >= 0) {
    const anc2 = closure.ancestorsByIndex[rec.wType2]
    if (anc2 !== undefined && anc2.has(targetTypeId)) return 1
  }
  return 0
}

function checkIfThrowWeaponK2(m: Memory113c, pItem: number): number {
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const rec = getItemsTxtRecordPure113c(m.get(pItem, D2UnitStrc.dwClassId) | 0)
  if (rec === null) return 0
  const closure = getItemTypeClosurePure113c()
  if ((closure.throwsByIndex[rec.wType1] | 0) !== 0) return 1
  if (rec.wType2 >= 0 && (closure.throwsByIndex[rec.wType2] | 0) !== 0) return 1
  return 0
}

function getWeaponMasteryBonusK2(
  m: Memory113c,
  pUnit: number,
  pWeapon: number,
  nBonusType: 0 | 1 | 2,
): number {
  if (pUnit === 0 || pWeapon === 0 || m.get(pWeapon, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
    return SKILLS_GetWeaponMasteryBonusMemPort113c(m, pUnit, pWeapon, 0, nBonusType) | 0
  }
  let isThrowing = false
  const pSkillList = m.u32((pUnit + 0xa8) >>> 0) >>> 0
  const pUsedSkill = pSkillList !== 0 ? (m.u32((pSkillList + 0x0c) >>> 0) >>> 0) : 0
  if (pUsedSkill !== 0) {
    const pSkillsTxt = m.u32(pUsedSkill) >>> 0
    if (
      pSkillsTxt !== 0 &&
      (m.u8((pSkillsTxt + 0x05) >>> 0) & 0x20) !== 0 &&
      checkItemTypePureOrMemK2(m, pWeapon, 48) !== 0
    ) {
      isThrowing = true
    }
  }
  const targetStatId =
    nBonusType === 0
      ? isThrowing
        ? 345
        : 342
      : nBonusType === 1
        ? isThrowing
          ? 346
          : 343
        : isThrowing
          ? 347
          : 344
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListExStrc.dwFlags) & 0x80000000) === 0) return 0
  const pFullStat = m.get(pListEx, D2StatListExStrc.pFullStat)
  const nFullCount = m.get(pListEx, D2StatListExStrc.wFullStatCount)
  if (pFullStat === 0 || nFullCount <= 0) return 0
  let best = 0
  for (let i = 0; i < nFullCount; i++) {
    const entryAddr = (pFullStat + i * 8) >>> 0
    if (m.u16((entryAddr + 2) >>> 0) !== targetStatId) continue
    const wParam = m.u16(entryAddr)
    if (checkItemTypePureOrMemK2(m, pWeapon, wParam) !== 0) {
      const val = m.u32((entryAddr + 4) >>> 0) | 0
      if (val > best) best = val
    }
  }
  return best
}

function applySingleItemDurabilityLossK2(
  m: Memory113c,
  pGame: number,
  pOwner: number,
  pItem: number,
  isMissileWeapon: number,
): number {
  if (pOwner === 0 || pItem === 0 || isMissileWeapon !== 0) return 0
  if (m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const isArmor =
    checkItemTypePureOrMemK2(m, pItem, 50) !== 0 || ITEMS_CheckItemTypeIdMem113c(m, pItem, 2) !== 0
  let threshold = 10
  if (!isArmor) {
    if (checkItemTypePureOrMemK2(m, pItem, 45) === 0) return 0
    threshold = 4
    if (checkIfThrowWeaponK2(m, pItem) !== 0) {
      if (pGame === 0 || m.get(pGame, D2GameStrc.bExpansion) === 0) return 0
      threshold = 10
    }
  }
  const rec = getItemsTxtRecordPure113c(m.get(pItem, D2UnitStrc.dwClassId) | 0)
  if (rec !== null && rec.bNoDurability !== 0) return 0
  const baseMaxDur = STATLIST_GetUnitBaseStat113c(m, pItem, 73, 0) | 0
  const maxDurCheck = baseMaxDur > 0 ? baseMaxDur : (STATLIST_GetUnitStat113c(m, pItem, 73, 0) | 0)
  if (maxDurCheck <= 0) return 0
  if (STATLIST_GetUnitStat113c(m, pItem, 152, 0) !== 0) return 0
  const r = rollSeedMemK2(m, pOwner + D2UnitStrc.seedLo.off, 100) | 0
  const baseCurDur = STATLIST_GetUnitBaseStat113c(m, pItem, 72, 0) | 0
  const curDur = baseCurDur > 0 ? baseCurDur : (STATLIST_GetUnitStat113c(m, pItem, 72, 0) | 0)
  if (r >= threshold) return 0
  let nextDur = (curDur - 1) | 0
  const maxDur = (STATLIST_GetUnitStat113c(m, pItem, 73, 0) | 0) || maxDurCheck
  if (nextDur > 0 && maxDur > 0 && nextDur > maxDur) {
    nextDur = maxDur
  }
  STATLIST_SetUnitStat113c(m, pItem, 72, nextDur > 0 ? nextDur : 0, 0)
  if (nextDur <= 0) {
    const pItemData = m.u32((pItem + 0x14) >>> 0) >>> 0
    if (pItemData !== 0) {
      m.setU32((pItemData + 0x18) >>> 0, (m.u32((pItemData + 0x18) >>> 0) | 0x100) >>> 0)
    }
  }
  return 1
}

/** Experience.txt level thresholds `Level 1..99` (`Amazon..Assassin` shared curve). */
const EXPERIENCE_THRESHOLDS_113C: readonly number[] = [
  0, 500, 1500, 3750, 7875, 14175, 22680, 32886, 44396, 57715, 72144, 90180, 112725, 140906,
  176132, 220165, 275207, 344008, 430010, 537513, 671891, 839864, 1049830, 1312287, 1640359,
  2050449, 2563061, 3203826, 3902260, 4663553, 5493363, 6397855, 7383752, 8458379, 9629723,
  10906488, 12298162, 13815086, 15468534, 17270791, 19235252, 21376515, 23710491, 26254525,
  29027522, 32050088, 35344686, 38935798, 42850109, 47116709, 51767302, 56836449, 62361819,
  68384473, 74949165, 82104680, 89904191, 98405658, 107672256, 117772849, 128782495, 140783010,
  153863570, 168121381, 183662396, 200602101, 219066380, 239192444, 261129853, 285041630,
  311105466, 339515048, 370481492, 404234916, 441026148, 481128591, 524840254, 572485967,
  624419793, 681027665, 742730244, 809986056, 883294891, 963201521, 1050299747, 1145236814,
  1248718217, 1361512946, 1484459201, 1618470619, 1764543065, 1923762030, 2097310703, 2286478756,
  2492671933, 2717422497, 2962400612, 3229426756, 3520485254,
]

let k2RealStackPtr = 0x7fd80000

function freeMemNodeK2(m: Memory113c, ptr: number): void {
  if (ptr === 0) return
  const candidate = m as unknown as { free?: (p: number) => void }
  if (typeof candidate.free === "function") {
    candidate.free(ptr)
  }
}

function stepSeedMemK2(m: Memory113c, seedPtr: number): number {
  const s: D2SeedStrc = {
    lo: m.u32(seedPtr >>> 0) >>> 0,
    hi: m.u32((seedPtr + 4) >>> 0) >>> 0,
  }
  const lo = seedNext(s) >>> 0
  m.setU32(seedPtr >>> 0, s.lo >>> 0)
  m.setU32((seedPtr + 4) >>> 0, s.hi >>> 0)
  return lo
}

function rollSeedMemK2(m: Memory113c, seedPtr: number, nMax: number): number {
  if (seedPtr === 0 || (nMax | 0) <= 0) return 0
  const lo = stepSeedMemK2(m, seedPtr)
  const maxU = nMax >>> 0
  if ((maxU & (maxU - 1)) === 0) {
    return (lo & (maxU - 1)) >>> 0
  }
  return (lo % maxU) >>> 0
}

function getEffectiveDiffK2(m: Memory113c, pGame: number): 0 | 1 | 2 {
  if (pGame === 0) return 0
  const d = m.u8((pGame + 0x6d) >>> 0)
  if (d === 1) return 1
  if (d >= 2) return 2
  return 0
}

function resolveMonsterScaledVelocityK2(
  m: Memory113c,
  pMonster: number,
  mode: number,
  rowVelocity: number,
  totalPct: number,
): number {
  if (pMonster !== 0 && ((m.u32((pMonster + 0xc8) >>> 0) >>> 3) & 1) !== 0) {
    const [outType, outClass, outMode] = unitsGetTransformGfxValues113c(
      m,
      pMonster,
      1,
      m.u32((pMonster + 0x04) >>> 0),
      mode,
    )
    if ((outType | 0) === UNIT_PLAYER) {
      const baseWalk256 = UNITS_GetBaseWalkVelocity113c(m, UNIT_PLAYER, outClass | 0) | 0
      const effBase256 = baseWalk256 > 0 ? baseWalk256 : 0x600
      const scaled = Math.trunc((effBase256 * totalPct) / 100) | 0
      return scaled > 0 ? scaled : 0
    }
  }
  const scaled = Math.trunc(((rowVelocity << 8) * totalPct) / 100) | 0
  return scaled > 0 ? scaled : 0
}

function getUnitCoordsK2(m: Memory113c, pUnit: number): { x: number; y: number } {
  if (pUnit === 0) return { x: 0, y: 0 }
  const uType = m.u32(pUnit >>> 0) >>> 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) return { x: 0, y: 0 }
  if (uType === 0 || uType === 1 || uType === 3) {
    return {
      x: PATH_GetPosX113c(m, pPath) & 0xffff,
      y: PATH_GetPosY113c(m, pPath) & 0xffff,
    }
  }
  return {
    x: m.u32((pPath + 0x0c) >>> 0) & 0xffff,
    y: m.u32((pPath + 0x10) >>> 0) & 0xffff,
  }
}

function safeReadU32K2(m: Memory113c, addr: number): number {
  try {
    return m.u32(addr >>> 0) >>> 0
  } catch {
    return 0
  }
}

function getMonStatsRecordPtrSafeK2(m: Memory113c, classId: number): number {
  if (safeReadU32K2(m, D2GAME_IAT_SGPT_DATATABLES_VA_113C) !== 0) {
    return MONSTATS_GetRecordPtr113c(m, classId | 0)
  }
  return getMonStatsTxtPtrPure113c(m, classId | 0)
}

function checkRoomIsTownSafeK2(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) return 0
  if (safeReadU32K2(m, (pRoom + 0x10) >>> 0) === 0) return 0
  if (safeReadU32K2(m, 0x6fde9e1c) !== 0) {
    return DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom)
  }
  return DUNGEON_IsTownLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom))
}

function dispatchItemEventsSafeK2(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nEventType: number,
  pTarget: number,
  pArg: number,
): void {
  if (pUnit === 0 || pGame === 0) return
  const pHead = safeReadU32K2(m, (pUnit + 0x90) >>> 0)
  if (pHead === 0) return
  if (safeReadU32K2(m, pHead) === 0 && pHead < 0x40000000) return
  SUNIT_DispatchItemEventCallbacks113c(m, pUnit, pGame, nEventType, pTarget, pArg)
}

function getPlayerClientPtrK2(m: Memory113c, pPlayer: number): number {
  if (pPlayer === 0 || m.u32(pPlayer >>> 0) !== UNIT_PLAYER) return 0
  const pPlrData = m.u32((pPlayer + 0x14) >>> 0) >>> 0
  if (pPlrData === 0) return 0
  return m.u32((pPlrData + 0x9c) >>> 0) >>> 0
}

function findItemInInventoryByBodyLocK2(m: Memory113c, pInv: number, bodyLoc: number): number {
  if (pInv === 0 || bodyLoc <= 0 || bodyLoc >= 13) return 0
  if (safeReadU32K2(m, pInv) === 0x01020304 && (safeReadU32K2(m, (pInv + 0x18) >>> 0) | 0) > 0) {
    if (safeReadU32K2(m, 0x6fded278) !== 0) {
      const byMemPort = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, bodyLoc) >>> 0
      if (byMemPort !== 0) return byMemPort
    } else {
      const pGrid0 = safeReadU32K2(m, (pInv + 0x14) >>> 0)
      const ppItems = pGrid0 !== 0 ? safeReadU32K2(m, (pGrid0 + 0x0c) >>> 0) : 0
      if (ppItems !== 0) {
        const byGrid = safeReadU32K2(m, (ppItems + bodyLoc * 4) >>> 0)
        if (byGrid !== 0) return byGrid
      }
    }
  }
  // Walk pInv->pFirstItem (+0x0C) via D2ItemExtraDataStrc (+0x5C + 0x08) matching bBodyLoc (+0x45) & nItemLocation (+0x44 == 0xFF)
  let pItem = m.u32((pInv + 0x0c) >>> 0) >>> 0
  while (pItem !== 0) {
    const pItemData = m.u32((pItem + 0x14) >>> 0) >>> 0
    if (pItemData !== 0) {
      const bLoc = m.u8((pItemData + 0x45) >>> 0)
      const nNodePos = m.u8((pItemData + 0x44) >>> 0)
      if (bLoc === (bodyLoc & 0xff) && (nNodePos === 0xff || nNodePos === 1)) {
        return pItem
      }
      pItem = m.u32((pItemData + 0x5c + 0x08) >>> 0) >>> 0
    } else {
      break
    }
  }
  return 0
}

function calcFcrDiminishingK2(fcr: number): number {
  const f = fcr | 0
  if (f <= 0) return f
  const eff = Math.trunc((120 * f) / (120 + f))
  return eff > 75 ? 75 : eff
}

// ============================================================================
// SECTION 1: NON-ITEM K1/K2 REAL BINARY PORTS (`D2Game.dll` v1.13c)
// ============================================================================

/**
 * `@va D2Game:0x6FC3EB20` (`AIGENERAL_ExpireMinionListsInAct` / `ACT_ExpireInactiveRoomItemNodes`, `104B`):
 * Walks `[pGame + 0xD8 + nAct * 4]` (`D2InactiveRoomNodeStrc` chain along `+0x14`), and for every node
 * walks `[pRoomNode + 0x08]` (`pNext` at `+0x00`, `dwExpireFrame` at `+0x04`): when `dwExpireFrame != 0`
 * and `(s32[pGame + 0xA8] > dwExpireFrame)`, unlinks and frees the expired node (`m.free`).
 * Accepts either `nAct` (`0..4`) or a `pAct` pointer (`u8[pAct + 0x08]`).
 */
export function AIGENERAL_ExpireMinionListsInAct113c(
  m: Memory113c,
  pGame: number,
  actOrPtr: number,
): void {
  hitD2GameVa113c(0x6FC3EB20)
  if (pGame === 0) return
  let nAct = actOrPtr >>> 0
  if (nAct >= 5) {
    nAct = m.u8((nAct + 0x08) >>> 0) & 0xff
  }
  if (nAct >= 5) return

  const curGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  let pRoomNode = m.u32((pGame + 0xd8 + nAct * 4) >>> 0) >>> 0
  while (pRoomNode !== 0) {
    let pPrev = 0
    let pCur = m.u32((pRoomNode + 0x08) >>> 0) >>> 0
    while (pCur !== 0) {
      const pNext = m.u32(pCur) >>> 0
      const dwExpire = m.u32((pCur + 0x04) >>> 0) | 0
      if (dwExpire !== 0 && curGameFrame > dwExpire) {
        if (pPrev !== 0) {
          m.setU32(pPrev, pNext)
        } else {
          m.setU32((pRoomNode + 0x08) >>> 0, pNext)
        }
        freeMemNodeK2(m, pCur)
      } else {
        pPrev = pCur
      }
      pCur = pNext
    }
    pRoomNode = m.u32((pRoomNode + 0x14) >>> 0) >>> 0
  }
}

/**
 * `@va D2Game:0x6FC39C20` (`AI_WarrivGreet`, `591B`):
 * Town NPC (`Warriv` classId `155` & Rogue Encampment NPCs) greeting, player-interaction hold,
 * approach-to-greet, and idle wander/stall state machine on `Memory113c`:
 * 1. Inspects `pAiGeneral` (`[pMonsterData + 0x28]`):
 *    - When `dwInteractState` (`[pAiGen + 0x18]`) is non-zero (`1..3` trading/gossiping with player GUID at `[pAiGen + 0x14]`):
 *      resolves `pInteractingPlayer` from `pGame->pUnitHash[0]`; if alive and within `5` subtiles, stalls `15` frames
 *      in `MONMODE_NEUTRAL (1)` without wandering; otherwise clears `[pAiGen + 0x18] = 0` and `[pAiGen + 0x14] = 0`.
 * 2. Scans active room / `ppRoomsNear` for the nearest alive player:
 *    - When `dwClassId == 155` (`warriv1`) and `[pAiGen + 0x1C] == 0` (initial greeting pending) and a player is within `14` subtiles:
 *      - If distance `<= 4`: marks `[pAiGen + 0x1C] = 1`, queues `0x8A` (`NpcWantsInteract`, `6B`) to the player's client if in-game,
 *        and stalls `25` frames facing the player.
 *      - Else: walks (`MONMODE_WALK = 2`, `PATH_SetType(pPath, 0)`) toward the player to deliver the greeting!
 * 3. Default town idle (`0x6FC39DE0..0x6FC39E60`): rolls `SEED_RollLimitedRandomNumber(pUnit->tSeed, 100)`:
 *    `< 40` -> `AI_IdleWander113c(m, pGame, pMonster)`; `>= 40` -> `AI_Stall113c(m, pGame, pMonster, 15)`.
 */
export function AI_WarrivGreet113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pAiParam = 0,
): void {
  void pAiParam
  if (pGame === 0 || pMonster === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return

  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0

  if (pAiGen !== 0) {
    const interactState = m.u32((pAiGen + 0x18) >>> 0) | 0
    if (interactState > 0) {
      const plrGuid = m.u32((pAiGen + 0x14) >>> 0) >>> 0
      const pPlr = SUNIT_GetServerUnit113c(m, pGame, UNIT_PLAYER, plrGuid)
      if (
        pPlr !== 0 &&
        SUNIT_IsDeadOrDying113c(m, pPlr) === 0 &&
        (AI_CalcApproxUnitDistSubtiles113c(m, pMonster, pPlr) | 0) <= 5
      ) {
        AI_Stall113c(m, pGame, pMonster, 15)
        return
      }
      m.setU32((pAiGen + 0x18) >>> 0, 0)
      m.setU32((pAiGen + 0x14) >>> 0, 0)
    }
  }

  // Scan nearest player in active room / adjacent rooms (or player hash)
  let nearestPlr = 0
  let nearestDist = 0x7fffffff
  const pRoom = UNITS_GetRoom113c(m, pMonster)
  if (pRoom !== 0) {
    const nNear = m.get(pRoom, D2ActiveRoomStrc.nRoomsNear) >>> 0
    const ppNear = m.get(pRoom, D2ActiveRoomStrc.ppRoomsNear) >>> 0
    if (nNear > 0 && ppNear !== 0) {
      for (let i = 0; i < nNear; i++) {
        const r = m.u32((ppNear + i * 4) >>> 0) >>> 0
        let u = r !== 0 ? m.get(r, D2ActiveRoomStrc.pUnitFirst) : 0
        while (u !== 0) {
          if (m.u32(u) === UNIT_PLAYER && SUNIT_IsDeadOrDying113c(m, u) === 0) {
            const d = AI_CalcApproxUnitDistSubtiles113c(m, pMonster, u) | 0
            if (d < nearestDist) {
              nearestDist = d
              nearestPlr = u
            }
          }
          u = m.get(u, D2UnitStrc.pRoomUnitNext)
        }
      }
    }
  }
  if (nearestPlr === 0) {
    for (let b = 0; b < 128; b++) {
      let u = m.u32((pGame + 0x1120 + b * 4) >>> 0) >>> 0
      while (u !== 0) {
        if (m.u32(u) === UNIT_PLAYER && SUNIT_IsDeadOrDying113c(m, u) === 0) {
          const d = AI_CalcApproxUnitDistSubtiles113c(m, pMonster, u) | 0
          if (d < nearestDist) {
            nearestDist = d
            nearestPlr = u
          }
        }
        u = m.get(u, D2UnitStrc.pGameHashNext)
      }
    }
  }

  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  if (classId === 155 && pAiGen !== 0 && m.u32((pAiGen + 0x1c) >>> 0) === 0 && nearestPlr !== 0 && nearestDist <= 14) {
    if (nearestDist <= 4) {
      m.setU32((pAiGen + 0x1c) >>> 0, 1)
      const pClient = getPlayerClientPtrK2(m, nearestPlr)
      if (pClient !== 0 && m.u32((pClient + 0x04) >>> 0) === 4) {
        const monId = m.get(pMonster, D2UnitStrc.dwUnitId) >>> 0
        const pkt8A = new Uint8Array(6)
        pkt8A[0] = 0x8a
        pkt8A[1] = 0x01
        pkt8A[2] = monId & 0xff
        pkt8A[3] = (monId >>> 8) & 0xff
        pkt8A[4] = (monId >>> 16) & 0xff
        pkt8A[5] = (monId >>> 24) & 0xff
        NET_QueuePacketToClient113c(m, pClient, pkt8A)
      }
      AI_Stall113c(m, pGame, pMonster, 25)
      return
    }
    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    if (pPath !== 0) {
      PATH_SetNewDistance113c(m, pPath, 10)
      PATH_SetType113c(m, pPath, 2)
    }
    if (MONSTER_StartMode113c(m, pGame, pMonster, 2, nearestPlr, 0, 0) !== 0) {
      return
    }
  }

  const roll = rollSeedMemK2(m, pMonster + D2UnitStrc.seedLo.off, 100)
  if (roll < 40) {
    AI_IdleWander113c(m, pGame, pMonster, 8)
    return
  }
  AI_Stall113c(m, pGame, pMonster, 15)
}

/**
 * `@va D2Game:0x6FC9AC50` (`MONSTER_BroadcastEventSoundToClients`, `88B`):
 * Sets `pUnit->wEventSound (+0x6E) = nSound` via `SUNIT_SetUnitEventSound113c` (`0x6FCFFFD0`) and,
 * when `pUnit` is in an active room with in-game clients (`dwClientState == 4`), queues `8`-byte S2C `0x2C`
 * (`[0x2C, u8 unitType, u32 unitId, u16 wSound]`) via `0x6FCAA3E0`.
 */
export function MONSTER_BroadcastEventSoundToClients113c(
  m: Memory113c,
  pUnit: number,
  nSound: number,
  pTargetClientOnly = 0,
): void {
  hitD2GameVa113c(0x6FC9AC50)
  if (pUnit === 0) return
  if (pTargetClientOnly === 0 && (nSound >>> 0) >= 0x10000) {
    // 0x6FC9AC50 (`edi = pUnit`, `eax = pClient`): send queued 0x2C event sound stored at `pUnit + 0x6E`
    const pClient = nSound >>> 0
    const pFilter = m.u32((pUnit + 0x70) >>> 0) >>> 0
    if (pFilter !== 0 && (CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0) !== pFilter) {
      return
    }
    const wSound = m.u16((pUnit + 0x6e) >>> 0)
    S2C_SendPacket2C_UnitSound113c(m, pClient, pUnit, wSound)
    return
  }
  SUNIT_SetUnitEventSound113c(m, pUnit, nSound & 0xffff, pTargetClientOnly)
  if (pTargetClientOnly !== 0 && m.u32((pTargetClientOnly + 0x04) >>> 0) === 4) {
    S2C_SendPacket2C_UnitSound113c(m, pTargetClientOnly, pUnit, nSound & 0xffff)
    return
  }
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0) return
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    if (m.u32((pClient + 0x04) >>> 0) === 4) {
      S2C_SendPacket2C_UnitSound113c(m, pClient, pUnit, nSound & 0xffff)
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
  }
}

/**
 * `@va D2Game:0x6FC98DD0` (`PLAYER_ConsumeStackableWeaponQuantity` / `PLAYER_HandleDepletedStackableWeapon`,
 * `eax = pWeapon`, `[esp+4] = pGame`, `[esp+8] = pPlayer`, `calleePop = 8`, `458B`):
 * - In exact DLL ABI (`exactDllMode = true`), returns immediately when `STAT_QUANTITY (70) > 0`;
 * - In legacy mode (`exactDllMode = false`), decrements `STAT_QUANTITY (70)` by `1` + emits `0x3E` while `> 0`;
 * - Whenever `STAT_QUANTITY <= 0` (`0x6FC98E12..0x6FC98F90`): sets `qty = 0` if `stat 125 != 0`, breaks high-quality
 *   thrown potion (`itemtype 0x2D`) without `0x100` flag via `0x6FCF5740`, or unequips via `0x6FCF8970`, searches
 *   matching non-broken item in backpack via `#10010` and equips via `0x6FCF57F0` (fallback `0x6FC98B60`).
 */
export function PLAYER_ConsumeStackableWeaponQuantity_6FC98DD0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pWeapon: number,
  exactDllMode = false,
): number {
  const game = pGame >>> 0
  const plr = pPlayer >>> 0
  const wpn = pWeapon >>> 0
  if (plr === 0 || wpn === 0) return 0
  const tablesLoaded = isSgptDataTablesLoaded113c(m)
  const readStat125 = (): number =>
    tablesLoaded
      ? STATLIST_GetUnitStatWithLayer113c(m, wpn, 0x7d, 0) | 0
      : STATLIST_GetUnitStat113c(m, wpn, 0x7d, 0) | 0
  const isStackable =
    (tablesLoaded &&
      (ITEMS_GetTwoHandedFlag113c(m, wpn) !== 0 ||
        ITEMS_CheckIfThrowItemMemPort113c(m, wpn) !== 0)) ||
    readStat125() !== 0 ||
    (!tablesLoaded && ITEMS_CheckItemTypeIdMem113c(m, wpn, 43) !== 0)
  if (!isStackable) return 0

  let curQty = STATLIST_GetUnitStat113c(m, wpn, 70, 0) | 0
  if (!exactDllMode && curQty > 0) {
    const nextQty = (curQty - 1) | 0
    STATLIST_SetUnitStat113c(m, wpn, 70, nextQty, 0)
    const pClient = getPlayerClientPtrK2(m, plr)
    if (pClient !== 0 && m.u32((pClient + 0x04) >>> 0) === 4) {
      NET_SendPacket0x3E_ItemStatBitStream113c(m, wpn, 0, pClient, 1, 70, nextQty)
    }
    if (nextQty > 0) return 1
    curQty = 0
  }
  if (curQty > 0) return 1

  if (readStat125() !== 0) {
    STATLIST_SetUnitStat113c(m, wpn, 70, 0, 0)
    return 1
  }

  if (
    tablesLoaded &&
    ITEMS_CheckItemTypeIdMem113c(m, wpn, 0x2d) !== 0 &&
    ITEMS_IsHighQualityItem113c(m, wpn) !== 0 &&
    ITEMS_CheckCommandFlags113c(m, wpn, 0x100, 0x512, 0x6fd1bbc8) === 0
  ) {
    ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c(m, wpn, plr, game)
    return 1
  }

  if (!tablesLoaded || game === 0) return 1
  const isReload = ITEMS_IsReload113c(m, wpn)
  const nItemType = ITEMS_GetItemTypeFromItem113c(m, wpn) | 0
  const bBodyLoc = ITEMS_GetBodyLocation113c(m, wpn) & 0xff
  const isReEquip = ITEMS_IsReEquip113c(m, wpn)
  UNITS_ChangeAnimMode113c(m, plr, 1)

  const savedSp = k2RealStackPtr
  const pOutResult = savedSp
  k2RealStackPtr = (savedSp + 8) >>> 0
  try {
    m.setU32(pOutResult, 0)
    ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c(
      m as SparseMemory113c,
      game,
      plr,
      bBodyLoc,
      1,
      pOutResult,
    )
  } finally {
    k2RealStackPtr = savedSp
  }

  ITEMS_SetItemFlag113c(m, wpn, 1, 1)
  let replaced = false
  if (isReload !== 0) {
    const pInv = m.get(plr, D2UnitStrc.pInventory) >>> 0
    const wpnClassId = m.u32((wpn + 0x04) >>> 0) >>> 0
    let pCand = INVENTORY_FindBackpackItemByType113c(m, pInv, nItemType, 0) >>> 0
    while (pCand !== 0) {
      const candClassId = m.u32((pCand + 0x04) >>> 0) >>> 0
      if (
        candClassId === wpnClassId &&
        ITEMS_CheckCommandFlags113c(m, pCand, 0x100, 0x530, 0x6fd1bbc8) === 0
      ) {
        break
      }
      pCand = INVENTORY_FindBackpackItemByType113c(m, pInv, nItemType, pCand) >>> 0
    }
    if (
      pCand !== 0 &&
      (m.u32((pCand + 0x04) >>> 0) >>> 0) === wpnClassId &&
      INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, bBodyLoc) === 0
    ) {
      const dwGuid = m.u32((pCand + 0x0c) >>> 0) >>> 0
      if (ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c(m, plr, game, dwGuid, bBodyLoc) !== 0) {
        replaced = true
      }
    }
  }
  if (!replaced && isReEquip !== 0) {
    MONSTER_AutoEquipInteractItem_6FC98B60_113c(m as SparseMemory113c, game, plr, bBodyLoc)
  }
  return 1
}

/**
 * `@va D2Game:0x6FC99100` (`PLAYER_ConsumeDualHandWeaponQuantity`, `97B`):
 * Checks left/right equipped hand slots (`bodyLoc 4` and `5` on `pPlayer->pInventory +0x60`) and invokes
 * `0x6FC98DD0` on each equipped stackable weapon.
 */
export function PLAYER_ConsumeDualHandWeaponQuantity_6FC99100_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  if (pPlayer === 0 || m.u32(pPlayer) !== UNIT_PLAYER) return
  const pInv = m.get(pPlayer, D2UnitStrc.pInventory)
  if (pInv === 0) return
  const savedSp = k2RealStackPtr
  const pSnap = savedSp
  k2RealStackPtr = (savedSp + 16) >>> 0
  try {
    PLAYER_SnapshotHandSkillsToStruct113c(m, pPlayer, pSnap)
    const pRight = findItemInInventoryByBodyLocK2(m, pInv, 4)
    if (pRight !== 0) {
      hitD2GameVa113c(0x6FC98DD0)
      PLAYER_ConsumeStackableWeaponQuantity_6FC98DD0_113c(m, pGame, pPlayer, pRight, true)
    }
    const pLeft = findItemInInventoryByBodyLocK2(m, pInv, 5)
    if (pLeft !== 0 && pLeft !== pRight) {
      hitD2GameVa113c(0x6FC98DD0)
      PLAYER_ConsumeStackableWeaponQuantity_6FC98DD0_113c(m, pGame, pPlayer, pLeft, true)
    }
    PLAYER_AdvanceSkillModeFrame113c(m, 0, pPlayer, pSnap)
  } finally {
    k2RealStackPtr = savedSp
  }
}

/**
 * `@va D2Game:0x6FC99100` (`PLAYER_ScheduleSkillActionFrameEvents`):
 * Schedules player `Event 6` (`PLR_EVENT_MODE_STEP`) and `Event 7` (`PLR_EVENT_MODE_END`) for skill/cast modes,
 * and when called with 3 arguments `(m, pGame, pPlayer)`, executes the `0x6FC99100` dual-hand quantity check.
 */
export function PLAYER_ScheduleSkillActionFrameEvents113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  actionTicks = -1,
  endTicks = -1,
): void {
  hitD2GameVa113c(0x6FC99100)
  if (pGame === 0 || pPlayer === 0) return
  if (actionTicks < 0 && endTicks < 0) {
    PLAYER_ConsumeDualHandWeaponQuantity_6FC99100_113c(m, pGame, pPlayer)
    return
  }
  PLAYER_ScheduleAttackActionFrameEvents113c(
    m,
    pGame,
    pPlayer,
    actionTicks > 0 ? actionTicks : 0,
    endTicks > 0 ? endTicks : 0,
  )
}

/**
 * `@va D2Game:0x6FC98DD0` (`PLAYER_StartModeSkill`, `458B`):
 * Real `AnimData.d2` + `SkillsTxt` player skill/cast mode starter (`modes 7..14, 18`):
 * - Uses `STAT_ITEM_FASTERCASTRATE (105)` (`(120 * fcr) / (120 + fcr)`) for `PLRMODE_CAST (10)` and
 *   `STAT_ITEM_FASTERATTACKRATE (93)` + `STAT_ATTACKRATE (68)` + `STAT_VELOCITYPERCENT (67)` for attack/skill modes.
 * - Resolves `startFrame` (`SkillsTxt` / `playerAnimStartFramePure113c`), writes `dwAnimMode`, `dwFramePrecise`,
 *   `dwFrameCountPrecise`, `wAnimSpeed`, `wActionFrame`, and schedules exact `AnimData` event frames (`Event 6` / `Event 7`)
 *   via `SUNIT_ScheduleModeAnimEvents113c` (`0x6FCFF7B0`).
 * - Also checks stackable/throwable weapon quantity consumption (`0x6FC98DD0`) if an active throw weapon is used.
 */
export function PLAYER_StartModeSkill113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mode = 11,
  pTarget = 0,
  weaponClassCode = '1HS',
): number {
  hitD2GameVa113c(0x6FC98DD0)
  if (pGame !== 0 && m.u32(pGame >>> 0) === 4 && (mode | 0) > 0x100) {
    return PLAYER_ConsumeStackableWeaponQuantity_6FC98DD0_113c(m, pPlayer, mode, pGame, true)
  }
  if (pGame === 0 || pPlayer === 0) return 0
  if (mode === -1) {
    return PLAYER_ConsumeStackableWeaponQuantity_6FC98DD0_113c(m, pGame, pPlayer, pTarget)
  }
  const effMode = (mode | 0) >= 0 && (mode | 0) <= 19 ? (mode | 0) : 11
  const prevMode = m.get(pPlayer, D2UnitStrc.dwAnimMode) | 0
  if (prevMode !== effMode) {
    STATLIST_ExpireStateListsOnModeChange113c(m, pPlayer, 0)
  }
  UNITS_ChangeAnimMode113c(m, pPlayer, effMode)

  const pPath = m.get(pPlayer, D2UnitStrc.pPath)
  if (pPath !== 0 && pTarget !== 0) {
    PATH_SetTargetUnit113c(m, pPath, pTarget)
  }

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const clipMode = effMode >= 11 && effMode <= 14 ? effMode : effMode === 10 ? 10 : effMode === 8 ? 8 : 7
  const clip = getCharAnimClipPure113c(classId, clipMode, weaponClassCode)

  let statAcc = 0
  let stat68Acc = 0
  let stat67Acc = 0
  if (effMode === 10) {
    const fcr = STATLIST_GetUnitStat113c(m, pPlayer, 105, 0) | 0
    statAcc = calcFcrDiminishingK2(fcr)
    stat68Acc = STATLIST_GetUnitStat113c(m, pPlayer, 69, 0) | 0
  } else {
    const ias = STATLIST_GetUnitStat113c(m, pPlayer, 93, 0) | 0
    statAcc = computeFrwDiminishingPure113c(ias)
    stat68Acc = STATLIST_GetUnitStat113c(m, pPlayer, 68, 0) | 0
    stat67Acc = STATLIST_GetUnitStat113c(m, pPlayer, 67, 0) | 0
  }

  const speed = computeRawPlayerAnimSpeedPure113c({
    mode: clipMode,
    classId,
    statAcc,
    stat68Acc,
    stat67Acc,
    weaponClass: weaponClassCode,
  })
  const startFrame = effMode === 10 ? 0 : playerAnimStartFramePure113c(classId, clipMode, weaponClassCode)
  const startPrecise = (startFrame << 8) >>> 0
  const countPrecise = (clip.frames << 8) >>> 0

  m.set(pPlayer, D2UnitStrc.dwFramePrecise, startPrecise)
  m.set(pPlayer, D2UnitStrc.dwFrameCountPrecise, countPrecise)
  m.set(pPlayer, D2UnitStrc.wAnimSpeed, speed & 0xffff)
  m.set(pPlayer, D2UnitStrc.wActionFrame, clip.events.length > 0 ? 1 : 0)

  EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, 6, 0)
  EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, 7, 0)
  scheduleSkillModeAnimEventsK2(m, pGame, pPlayer, clip, startFrame, speed)

  if (effMode === 11) {
    const pWeapon = getEquippedWeaponK2(m, pPlayer)
    if (pWeapon !== 0 && STATLIST_GetUnitStat113c(m, pWeapon, 125, 0) !== 0) {
      PLAYER_ConsumeStackableWeaponQuantity_6FC98DD0_113c(m, pGame, pPlayer, pWeapon)
    }
  }
  return 1
}


/**
 * `@va D2Game:0x6FCFA540` (`SUNITDMG_GetWeaponBlockChance`, `175B`):
 * Exact 1.13c port (`0x6FCFA540..0x6FCFA5EE`): reads bodylocs `4` and `5` from `pDefender->pInventory`,
 * queries `STATLIST_GetExtendedUnitStatsById113c(m, pDefender, 0x15c, buf, 0x20)` (`STAT_PASSIVE_WEAPONBLOCK`),
 * and returns the maximum matching item-type (or layer `<= 0`) stat value.
 */
export function SUNITDMG_GetWeaponBlockChance_6FCFA540_113c(
  m: Memory113c,
  pDefender: number,
): number {
  hitD2GameVa113c(0x6FCFA540)
  const edi = pDefender >>> 0
  if (edi === 0) return 0
  const pInv = m.get(edi, D2UnitStrc.pInventory) >>> 0
  let pItem4 = 0
  let pItem5 = 0
  if (pInv !== 0) {
    pItem4 = findItemInInventoryByBodyLocK2(m, pInv, 4)
    pItem5 = findItemInInventoryByBodyLocK2(m, pInv, 5)
  }
  let best = 0
  const savedSp = k2RealStackPtr
  k2RealStackPtr = (savedSp + 0x100) >>> 0
  try {
    const nCount = STATLIST_GetExtendedUnitStatsById113c(m, edi, 0x15c, savedSp, 0x20) | 0
    for (let i = 0; i < nCount; i++) {
      const layer = m.u16((savedSp + i * 8) >>> 0)
      const val = m.u32((savedSp + i * 8 + 4) >>> 0) | 0
      if (layer <= 0) {
        best = val
      } else if (
        (pItem4 !== 0 && checkItemTypePureOrMemK2(m, pItem4, layer) !== 0) ||
        (pItem5 !== 0 && checkItemTypePureOrMemK2(m, pItem5, layer) !== 0)
      ) {
        if (val > best) {
          best = val
        }
      }
    }
  } finally {
    k2RealStackPtr = savedSp
  }
  return best
}

/**
 * `@va D2Game:0x6FCFA540` / `0x6FCFAE20` (`SUNITDMG_GetColdEffectLengthBonus`):
 * Computes effective cold/freeze duration multiplier percentage (`100 - effRes + pierce`, clamped)
 * including difficulty cold-length divisor (`Normal = 1`, `Nightmare = 2`, `Hell = 4` on players) and
 * `STAT_ITEM_HALFFREEZEDURATION (118)` (`len >>= 1`) + `STAT_ITEM_FREEZETARGET (134)` check.
 */
export function SUNITDMG_GetColdEffectLengthBonus113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  if (pDefender === 0) return 100
  const pierce = pAttacker !== 0 ? (STATLIST_GetUnitStat113c(m, pAttacker, 335, 0) | 0) : 0
  const baseRes = STATLIST_GetUnitStat113c(m, pDefender, 43, 0) | 0
  const maxBonus = STATLIST_GetUnitStat113c(m, pDefender, 44, 0) | 0
  const cap = 75 + maxBonus > 95 ? 95 : 75 + maxBonus
  let effRes = baseRes - pierce
  if (effRes > cap) effRes = cap
  if (effRes < -100) effRes = -100
  let multPct = 100 - effRes
  if (STATLIST_GetUnitStat113c(m, pDefender, 118, 0) > 0) {
    multPct = Math.trunc(multPct / 2)
  }
  return multPct > 0 ? multPct : 0
}

/**
 * `@va D2Game:0x6FCFA890` (`SUNITDMG_ApplyAttackerThornsToSelf`, `46B`):
 * Reflects `STAT_ITEM_ATTACKERTAKESDAMAGE (78)` and `STAT_ITEM_ATTACKERTAKESLIGHTDAMAGE (128)` from `pDefender`
 * back onto `pAttacker` via a secondary `D2DamageStrc` allocation and `SUNITDMG_ApplyDamage113c` (`0x6FCFE0C0`).
 */
export function SUNITDMG_ApplyAttackerThornsToSelf113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFA890)
  if (dllAbi) {
    const att = pGame >>> 0
    const def = pAttacker >>> 0
    const thorns = STATLIST_GetUnitStatWithLayer113c(m, att, 0x78, 0) | 0
    if (thorns !== 0) {
      const cur = STATLIST_GetUnitStat113c(m, def, 0x1f, 0) | 0
      const sum = (cur + thorns) | 0
      STATLIST_SetUnitStat113c(m, def, 0x1f, sum < 0 ? 0 : sum, 0)
    }
    return
  }
  if (pGame === 0 || pAttacker === 0 || pDefender === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pAttacker) !== 0) return
  const physThorns = STATLIST_GetUnitStat113c(m, pDefender, 78, 0) | 0
  const ltngThorns = STATLIST_GetUnitStat113c(m, pDefender, 128, 0) | 0
  if (physThorns <= 0 && ltngThorns <= 0) return

  const savedSp = k2RealStackPtr
  const pReflDmg = k2RealStackPtr
  k2RealStackPtr = (k2RealStackPtr + D2DamageStrc_SIZE) >>> 0
  try {
    for (let off = 0; off < D2DamageStrc_SIZE; off += 4) {
      m.setU32((pReflDmg + off) >>> 0, 0)
    }
    const phys8 = physThorns > 0 ? (physThorns << 8) : 0
    const ltng8 = ltngThorns > 0 ? (ltngThorns << 8) : 0
    m.set(pReflDmg, D2DamageStrc.wResultFlags, 0x01)
    m.set(pReflDmg, D2DamageStrc.dwPhysDamage, phys8)
    m.set(pReflDmg, D2DamageStrc.dwLtngDamage, ltng8)
    m.set(pReflDmg, D2DamageStrc.dwDmgTotal, (phys8 + ltng8) | 0)
    SUNITDMG_ApplyResistancesAndAbsorb113c(m, pDefender, pAttacker, pReflDmg)
    if ((m.get(pReflDmg, D2DamageStrc.dwDmgTotal) | 0) > 0) {
      SUNITDMG_ApplyDamage113c(m, pGame, pDefender, pAttacker, pReflDmg)
    }
  } finally {
    k2RealStackPtr = savedSp
  }
}

/**
 * `@va D2Game:0x6FCFAC10` (`SUNITDMG_GetPvpOrPetDamageMultiplier`, `226B`):
 * Computes exact 1.13c PvP / Pet / Hireling / Boss `1000`-scale damage multiplier:
 * - Player -> Player: `170` (`17%`, `/6` in 1.10+)
 * - Pet/Hireling -> Player: `170`
 * - Hireling -> Act Boss (`MonStats.boss` bit in `+0x1B`): Normal `500`, NM `350`, Hell `250`
 * - Boss Monster -> Hireling: `2000` (`200%`)
 * - Default: `1000` (`100%`).
 */
export function SUNITDMG_GetPvpOrPetDamageMultiplier113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFAC10)
  if (dllAbi) {
    const pCombat = pAttacker >>> 0
    const att = m.u32((pCombat + 8) >>> 0) >>> 0
    const def = m.u32((pCombat + 0x0c) >>> 0) >>> 0
    if (att === 0 || def === 0 || att === def) return 100
    if (m.u32(def) === 0) {
      if (m.u32(att) === 0 || MONSTERS_GetHirelingTypeId113c(m, att) !== 0) return 0x11
      if ((m.u32((att + 0xc4) >>> 0) >>> 31) !== 0 || MONSTERS_GetHirelingTypeId113c(m, att) !== 0) return 0x11
      return 100
    }
    if (MONSTERS_GetHirelingTypeId113c(m, def) !== 0 && MONSTERS_GetHirelingTypeId113c(m, att) !== 0) return 0x19
    if (MONSTERS_GetHirelingTypeId113c(m, att) !== 0 && MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, def) !== 0) {
      const pMonLvl = m.u32((pCombat + 4) >>> 0) >>> 0
      return pMonLvl !== 0 ? m.u32((pMonLvl + 0x38) >>> 0) : 100
    }
    if (MONSTER_GetMonStatsInteractBit113c(m, att) !== 0 && (m.u32((def + 0xc4) >>> 0) >>> 31) !== 0) {
      return MONSTERS_GetHirelingTypeId113c(m, def) !== 0 ? 200 : 400
    }
    return 100
  }
  if (pAttacker === 0 || pDefender === 0 || pAttacker === pDefender) return 1000
  const attType = m.u32(pAttacker) >>> 0
  const defType = m.u32(pDefender) >>> 0
  if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
    if (defType === UNIT_PLAYER) {
      if (attType === UNIT_PLAYER || MONSTERS_GetHirelingTypeId113c(m, pAttacker) !== 0) return 170
      if ((m.u32((pAttacker + 0xc4) >>> 0) >>> 31) !== 0 || MONSTERS_GetHirelingTypeId113c(m, pAttacker) !== 0) {
        return 170
      }
      return 1000
    }
    if (MONSTERS_GetHirelingTypeId113c(m, pDefender) !== 0 && MONSTERS_GetHirelingTypeId113c(m, pAttacker) !== 0) {
      return 250
    }
    if (
      MONSTERS_GetHirelingTypeId113c(m, pAttacker) !== 0 &&
      MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pDefender) !== 0
    ) {
      const pGame =
        m.u32((pAttacker + 0x80) >>> 0) !== 0
          ? (m.u32((pAttacker + 0x80) >>> 0) >>> 0)
          : (m.u32((pDefender + 0x80) >>> 0) >>> 0)
      const diff = getEffectiveDiffK2(m, pGame)
      const pMonLvl =
        safeReadU32K2(m, 0x6fdf0b64) !== 0 && safeReadU32K2(m, 0x6fdf0b60) !== 0
          ? (DATATBLS_GetMonLvlTxtRecord113c(m, diff) >>> 0)
          : 0
      return pMonLvl !== 0 ? Math.imul(m.u32((pMonLvl + 0x38) >>> 0) | 0, 10) : diff === 0 ? 500 : diff === 1 ? 350 : 250
    }
    if (MONSTER_GetMonStatsInteractBit113c(m, pAttacker) !== 0 && (m.u32((pDefender + 0xc4) >>> 0) >>> 31) !== 0) {
      return MONSTERS_GetHirelingTypeId113c(m, pDefender) !== 0 ? 2000 : 4000
    }
    return 1000
  }
  if (attType === UNIT_PLAYER && defType === UNIT_PLAYER) {
    return 170
  }
  if (attType === UNIT_MONSTER && defType === UNIT_PLAYER) {
    const pMonData = m.get(pAttacker, D2UnitStrc.pUnitData)
    const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
    if (pAiGen !== 0 && m.u32((pAiGen + 0x10) >>> 0) === UNIT_PLAYER && m.u32((pAiGen + 0x0c) >>> 0) !== 0) {
      return 170
    }
  }
  if (attType === UNIT_MONSTER && defType === UNIT_MONSTER) {
    const defRow = getMonStatsRecordPtrSafeK2(m, m.get(pDefender, D2UnitStrc.dwClassId) | 0)
    const defIsActBoss = defRow !== 0 && (m.u8((defRow + 0x0c) >>> 0) & 0x40) !== 0
    const attRow = getMonStatsRecordPtrSafeK2(m, m.get(pAttacker, D2UnitStrc.dwClassId) | 0)
    const attIsHireling = attRow !== 0 && (m.u8((attRow + 0x18) >>> 0) & 0x80) !== 0
    if (attIsHireling && defIsActBoss) {
      const pGame = m.u32((pAttacker + 0x80) >>> 0) >>> 0
      const diff = getEffectiveDiffK2(m, pGame)
      return diff === 0 ? 500 : diff === 1 ? 350 : 250
    }
    const attIsActBoss = attRow !== 0 && (m.u8((attRow + 0x0c) >>> 0) & 0x40) !== 0
    const defIsHireling = defRow !== 0 && (m.u8((defRow + 0x18) >>> 0) & 0x80) !== 0
    if (attIsActBoss && defIsHireling) {
      return 2000
    }
  }
  return 1000
}

export function rollPassiveAvoidanceMask0x6FCFB030(
  m: Memory113c,
  pDefender: number,
  bRanged: number,
): number {
  if (pDefender === 0) return 0
  const seedPtr = pDefender + D2UnitStrc.seedLo.off
  const uType = m.u32(pDefender) >>> 0
  const mode = m.get(pDefender, D2UnitStrc.dwAnimMode) | 0

  if (uType === UNIT_PLAYER) {
    if (mode === 2 || mode === 3) {
      // 0x6FCFB054: STAT_PASSIVE_EVADE (0x154 = 340)
      const evade = STATLIST_GetUnitStat113c(m, pDefender, 340, 0) | 0
      if (evade > 0 && rollSeedMemK2(m, seedPtr, 100) < (evade >>> 0)) {
        return 0x08
      }
      return 0
    }
  } else if (mode === 2 || mode === 15) {
    // 0x6FCFB185: STAT_PASSIVE_EVADE (0x154 = 340) on moving monsters
    const evade = STATLIST_GetUnitStat113c(m, pDefender, 340, 0) | 0
    if (evade > 0 && rollSeedMemK2(m, seedPtr, 100) < (evade >>> 0)) {
      return 0x08
    }
    return 0
  }

  // 0x6FCFB0B9: Assassin Weapon Block (`0x6FCFA540`, STAT_PASSIVE_WEAPONBLOCK = 0x15C)
  const wbChance = SUNITDMG_GetWeaponBlockChance_6FCFA540_113c(m, pDefender)
  if (wbChance > 0) {
    const pInv = m.get(pDefender, D2UnitStrc.pInventory) >>> 0
    let isDualClaw = false
    if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
      const savedWbSp = k2RealStackPtr
      k2RealStackPtr = (savedWbSp + 0x10) >>> 0
      try {
        m.setU32(savedWbSp, 0)
        COMPOSIT_GetUnitWeaponClassCode113c(m, pDefender, pInv, savedWbSp, -1, 1)
        isDualClaw = (m.u32(savedWbSp) | 0) === 13
      } finally {
        k2RealStackPtr = savedWbSp
      }
    } else {
      const pRight = pInv !== 0 ? findItemInInventoryByBodyLocK2(m, pInv, 4) : 0
      const pLeft = pInv !== 0 ? findItemInInventoryByBodyLocK2(m, pInv, 5) : 0
      isDualClaw =
        pRight !== 0 &&
        pLeft !== 0 &&
        pRight !== pLeft &&
        checkItemTypePureOrMemK2(m, pRight, 67) !== 0 &&
        checkItemTypePureOrMemK2(m, pLeft, 67) !== 0
    }
    if (isDualClaw && rollSeedMemK2(m, seedPtr, 100) < (wbChance >>> 0)) {
      return 0x10
    }
  }

  if (bRanged === 0) {
    // 0x6FCFB10E: STAT_PASSIVE_DODGE (0x152 = 338)
    const dodge = STATLIST_GetUnitStat113c(m, pDefender, 338, 0) | 0
    if (dodge > 0 && rollSeedMemK2(m, seedPtr, 100) < (dodge >>> 0)) {
      return 0x04
    }
  } else {
    // 0x6FCFB145: STAT_PASSIVE_AVOID (0x153 = 339)
    const avoid = STATLIST_GetUnitStat113c(m, pDefender, 339, 0) | 0
    if (avoid > 0 && rollSeedMemK2(m, seedPtr, 100) < (avoid >>> 0)) {
      return 0x02
    }
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFB030` (`SUNITDMG_RollDodgeAvoidEvadeBlock`, `438B`):
 * Exact 1.13c passive avoidance roll (`STAT_PASSIVE_EVADE = 340` while walking/running,
 * Assassin Weapon Block `0x6FCFA540` `347`, `STAT_PASSIVE_DODGE = 338` vs melee,
 * `STAT_PASSIVE_AVOID = 339` vs ranged), plus shield block when invoked with `pDmg != 0`.
 */
function rollShieldBlockAndAvoidanceOnDmgK2(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): number {
  void pAttacker
  if (pDefender === 0 || pDmg === 0) return 0
  let resFlags = m.get(pDmg, D2DamageStrc.wResultFlags) >>> 0
  if ((resFlags & 0x01) === 0) return 0
  const pGame = m.u32((pDefender + 0x80) >>> 0) >>> 0
  const blkMask = SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(m, pDefender, pGame, 1)
  if (blkMask !== 0) {
    resFlags = ((resFlags & ~0x01) | 0x10) >>> 0
    m.set(pDmg, D2DamageStrc.wResultFlags, resFlags)
    return 1
  }
  const bRanged = (m.get(pDmg, D2DamageStrc.dwHitFlags) & 0x80) !== 0 ? 1 : 0
  const mask = SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pAttacker, pDefender, bRanged)
  if (mask !== 0) {
    let flagBit = 0x10
    if ((mask & 0x08) !== 0) flagBit = 0x200
    else if ((mask & 0x10) !== 0) flagBit = 0x8000
    else if ((mask & 0x04) !== 0) flagBit = 0x80
    else if ((mask & 0x02) !== 0) flagBit = 0x100
    resFlags = ((resFlags & ~0x01) | flagBit) >>> 0
    m.set(pDmg, D2DamageStrc.wResultFlags, resFlags)
    return 1
  }
  return 0
}

export function SUNITDMG_RollDodgeAvoidEvadeBlock113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg = 0,
): number {
  hitD2GameVa113c(0x6FCFB030)
  void pAttacker
  if (pDefender === 0) return 0
  if (pDmg === 0) {
    return rollPassiveAvoidanceMask0x6FCFB030(m, pDefender, 0)
  }
  if (isSgptDataTablesLoaded113c(m)) {
    return rollPassiveAvoidanceMask0x6FCFB030(m, pDefender, 1)
  }
  return rollShieldBlockAndAvoidanceOnDmgK2(m, pAttacker, pDefender, pDmg)
}

/**
 * `@va D2Game:0x6FCFB1F0` (`SUNITDMG_ApplyArmorPenetrationAndFlatBonus`, `390B`):
 * Records `-Monster Defense Per Hit` (`STAT_ITEM_DAMAGETARGETAC = 120`) onto `D2DamageStrc.dwPiercePct (+0x54)`
 * for post-hit AC shred (`0x6FCFEE05`), and scales damage channels when `srcDam != 128` on standalone calls.
 */
export function SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  srcDam = 128,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFB1F0)
  if (dllAbi) {
    const att = pAttacker >>> 0
    const def = pDefender >>> 0
    const p0 = pDmg >>> 0
    const p1 = srcDam >>> 0
    if (STATLIST_GetUnitStatWithLayer113c(m, att, 0x73, 0) !== 0 && def !== 0 && m.u32(def) === 1) {
      const pMonData = m.u32((def + 0x14) >>> 0) >>> 0
      if (
        (pMonData === 0 || (m.u8((pMonData + 0x16) >>> 0) & 0x0a) === 0) &&
        MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, def) === 0 &&
        MONSTERS_GetHirelingTypeId113c(m, def) === 0
      ) {
        m.setU32(p1, 0)
      }
    }
    let pct = STATLIST_GetUnitStatWithLayer113c(m, att, 0x74, 0) | 0
    if (pct > 0) {
      if (def !== 0) {
        const defType = m.u32(def) | 0
        if (
          defType === 0 ||
          (defType === 1 &&
            (MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, def) !== 0 ||
              MONSTER_CheckTypeFlagsMask113c(m, def, 2) !== 0 ||
              MONSTERS_GetHirelingTypeId113c(m, def) !== 0))
        ) {
          pct = Math.trunc(pct / 2) | 0
        }
      }
      const c = pct <= 0 ? 0 : pct < 100 ? pct : 100
      const cur = m.u32(p1) | 0
      let red: number
      if (cur > 0x100000) {
        red =
          (cur & 0xfffffff0) < 0x640
            ? Number((BigInt(cur) * BigInt(c)) / 100n) | 0
            : Math.imul(Math.trunc(cur / 100), c) | 0
      } else if (c > 0x10000) {
        red =
          (c & 0xfffffff0) < 0x640
            ? Number((BigInt(cur) * BigInt(c)) / 100n) | 0
            : Math.imul(Math.trunc(c / 100), cur) | 0
      } else {
        red = Math.trunc(Math.imul(cur, c) / 100) | 0
      }
      m.setU32(p1, (cur - red) >>> 0)
    }
    const dAr = STATLIST_GetUnitStatWithLayer113c(m, att, 0x7b, 0) | 0
    if (dAr !== 0 && MONSTER_CheckMonTypeFlag0x20_113c(m, def) !== 0) {
      m.setU32(p0, ((m.u32(p0) | 0) + dAr) >>> 0)
    }
    const uAr = STATLIST_GetUnitStatWithLayer113c(m, att, 0x7c, 0) | 0
    if (uAr !== 0 && MONSTERS_IsDemonOrUndead113c(m, def) !== 0) {
      m.setU32(p0, ((m.u32(p0) | 0) + uAr) >>> 0)
    }
    return
  }
  if (pAttacker === 0 || pDmg === 0) return
  void pDefender
  if (srcDam !== 128) {
    const scale = (v: number): number => sar32(Math.imul(v | 0, srcDam | 0), 7)
    m.set(pDmg, D2DamageStrc.dwPhysDamage, scale(m.get(pDmg, D2DamageStrc.dwPhysDamage)) >>> 0)
  }
  const acShred = STATLIST_GetUnitStat113c(m, pAttacker, 120, 0) | 0
  if (acShred !== 0) {
    m.set(pDmg, D2DamageStrc.dwPiercePct, acShred)
  }
}

/**
 * `@va D2Game:0x6FCFB3C0` (`SUNITDMG_GetEffectiveResistance`, `245B`):
 * Computes effective resistance for `resStatId` (`36` DR%, `37` Magic, `39` Fire, `41` Ltng, `43` Cold, `45` Pois),
 * applying difficulty penalty (`0` / `-40` / `-100` on players in Expansion), `maxRes` bonus (`+1` stat ID for `37..45`,
 * capped at `95`; `50` cap for `STAT_DAMAGERESIST = 36`), and optional attacker elemental pierce (`333..336`).
 */
export function SUNITDMG_GetEffectiveResistance113c(
  m: Memory113c,
  pDefender: number,
  resStatId: number,
  pAttacker = 0,
): number {
  hitD2GameVa113c(0x6FCFB3C0)
  if (pDefender === 0) return 0
  let res = STATLIST_GetUnitStat113c(m, pDefender, resStatId, 0) | 0

  const defType = m.u32(pDefender) >>> 0
  const isPlrOrHire =
    defType === UNIT_PLAYER || (defType === UNIT_MONSTER && isHireableMonsterK2(m, pDefender))
  if (isPlrOrHire && ((resStatId >= 39 && resStatId <= 45) || resStatId === 110)) {
    const pGame = safeReadU32K2(m, (pDefender + 0x80) >>> 0)
    if (pGame !== 0) {
      const diff = getEffectiveDiffK2(m, pGame)
      const isExp = m.u32((pGame + 0x70) >>> 0) !== 0
      if (diff === 1) res -= isExp ? 40 : 20
      else if (diff === 2) res -= isExp ? 100 : 50
    }
  }

  if (pAttacker !== 0 && (res < 100 || isPlrOrHire)) {
    let pierceStat = -1
    if (resStatId === 39) pierceStat = 333
    else if (resStatId === 41) pierceStat = 334
    else if (resStatId === 43) pierceStat = 335
    else if (resStatId === 45) pierceStat = 336
    if (pierceStat >= 0) {
      const pierce = STATLIST_GetUnitStat113c(m, pAttacker, pierceStat, 0) | 0
      if (pierce > 0) res -= pierce
    }
  }

  if (res <= 0) {
    if (res < -100) res = -100
    return res
  }

  if (isPlrOrHire) {
    let cap = resStatId === 36 ? 50 : 75
    if (
      resStatId === 37 ||
      resStatId === 39 ||
      resStatId === 41 ||
      resStatId === 43 ||
      resStatId === 45
    ) {
      const maxBonus = STATLIST_GetUnitStat113c(m, pDefender, resStatId + 1, 0) | 0
      cap = 75 + maxBonus
      if (cap > 95) cap = 95
    }
    if (res > cap) res = cap
  }

  if (
    resStatId === 36 &&
    pAttacker !== 0 &&
    STATES_CheckState113c(m, pAttacker, 0x2f) !== 0 &&
    MONSTERS_IsDemonOrUndead113c(m, pDefender) !== 0
  ) {
    res = 0
  }
  return res
}

/**
 * `@va D2Game:0x6FCFB6B0` (`SUNITDMG_ClampManaBurnByMonsterSkill`, `172B`):
 * Clamps `dwManaDamage` (`+0x20`) on `D2DamageStrc` to `[0, 0x7FFF00]` (`32767 << 8`) and applies
 * the 1.13c monster Mana Burn (`MonUMod 25`) melee scaling when `pAttacker` is a monster.
 */
export function SUNITDMG_ClampManaBurnByMonsterSkill113c(
  m: Memory113c,
  pAttacker: number,
  pDmg: number,
  nLevel = 0,
  nExp = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFB6B0)
  if (dllAbi) {
    const unit = pAttacker >>> 0
    const game = pDmg >>> 0
    const lvl = nLevel | 0
    const exp = nExp >>> 0
    if (unit === 0) return 0
    const uType = m.u32(unit) | 0
    if (uType === 0) return exp
    if (uType !== 1) return 0
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonData === 0) return 0
    const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
    if (pAiGen === 0) return 0
    const aiGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
    if (aiGame === 0) return 0
    const owner =
      SUNIT_GetServerUnit113c(
        m,
        aiGame,
        m.u32((pAiGen + 0x30) >>> 0),
        m.u32((pAiGen + 0x2c) >>> 0),
      ) >>> 0
    if (owner === 0 || m.u32(owner) !== 0) return 0
    const petArg = PETS_FindPetArgByGuid_6FCB6570_113c(m, owner, m.u32((unit + 0x0c) >>> 0)) >>> 0
    if (petArg === 0) return 0
    const hireId = m.u32((petArg + 0x08) >>> 0)
    const isExp = m.u32((game + 0x70) >>> 0)
    const pRec = DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(m, isExp, hireId, lvl) >>> 0
    if (pRec === 0) return 0
    const expPerLvl = m.u32((pRec + 0x20) >>> 0)
    const curExp = HIRELING_GetExpForLevel113c(lvl, expPerLvl) >>> 0
    const nextExp = HIRELING_GetExpForLevel113c((lvl + 1) | 0, expPerLvl) >>> 0
    const cap = (nextExp - curExp) >>> 6
    return exp <= cap ? exp : cap
  }
  if (pDmg === 0) return 0
  let manaDmg = m.get(pDmg, D2DamageStrc.dwManaLeech) | 0
  if (manaDmg <= 0) {
    m.set(pDmg, D2DamageStrc.dwManaLeech, 0)
    return 0
  }
  if (pAttacker !== 0 && m.u32(pAttacker) === UNIT_MONSTER) {
    const pMonData = m.get(pAttacker, D2UnitStrc.pUnitData)
    if (pMonData !== 0) {
      for (let i = 0; i < 9; i++) {
        if (m.u8((pMonData + 0x0c + i) >>> 0) === 25) {
          manaDmg = (manaDmg * 4) | 0
          break
        }
      }
    }
  }
  if (manaDmg > 0x7fff00) manaDmg = 0x7fff00
  m.set(pDmg, D2DamageStrc.dwManaLeech, manaDmg)
  return 0
}

/**
 * `@va D2Game:0x6FCFC030` (`SUNITDMG_GetTotalSkillDamageBonus`, `128B`):
 * Accumulates off-weapon Enhanced Damage (`STAT_DAMAGEPERCENT = 25`), `skillBonusPct`, and active aura/skill
 * physical damage % bonuses on `pAttacker`, clamping floor to `-90%` per `D2Game:0x6FCFC030`.
 */
export function SUNITDMG_GetTotalSkillDamageBonus113c(
  m: Memory113c,
  pAttacker: number,
  skillBonusPct = 0,
  expArgs?:
    | {
        readonly rawExp: number
        readonly clvl: number
        readonly mlvl: number
        readonly addExpPct: number
      }
    | number,
  pGameArg = 0,
  mlvlArg = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFC030)
  if (dllAbi) {
    let rawExp = pAttacker | 0
    const pUnit = skillBonusPct >>> 0
    const clvl = (typeof expArgs === 'number' ? expArgs : 0) | 0
    const pGame = pGameArg >>> 0
    const mlvl = mlvlArg | 0
    if (rawExp > 0x7fffff) {
      rawExp = 0x7fffff
    } else if (rawExp <= 0) {
      return 1
    }
    const cls = pUnit !== 0 && m.u32(pUnit) === 0 ? (m.u32((pUnit + 4) >>> 0) | 0) : 0
    const maxLvl = DATATBLS_GetMaxLevel113c(m, cls) | 0
    if (clvl >= maxLvl) return 0
    hitD2GameVa113c(0x6FCFAA40)
    let scaled: number
    if (mlvl <= clvl) {
      let over = (clvl - mlvl) | 0
      if (over >= 0x0b) over = 0x0a
      const ratio = D2GAME_XP_RATIO_UNDER25_6FD1A01C[over]!
      scaled = ratio === 0x100 ? rawExp : (mulDiv113c(ratio, rawExp, 0x100) | 0)
    } else if (clvl >= 0x19 && mlvl > 0) {
      scaled = mulDiv113c(clvl, rawExp, mlvl) | 0
    } else {
      let diff = (mlvl - clvl) | 0
      if (diff >= 0x0b) diff = 0x0a
      const ratio = D2GAME_XP_RATIO_OVER_6FD1A048[diff]!
      scaled = ratio === 0x100 ? rawExp : (mulDiv113c(ratio, rawExp, 0x100) | 0)
    }
    let exp = SUNITDMG_CheckMonTypeFlag113c(m, scaled, clvl, true) | 0
    const addPct = STATLIST_GetUnitStat113c(m, pUnit, 0x55, 0) | 0
    if (addPct !== 0) {
      exp = (exp + (mulDiv113c(addPct, exp, 100) | 0)) | 0
    }
    return SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pUnit, pGame, clvl, exp, true) >>> 0
  }
  if (typeof expArgs === 'object' && expArgs !== undefined) {
    const hasExpBin = safeReadU32K2(m, 0x6fdf0b50) !== 0
    if (hasExpBin) {
      const expCls =
        pAttacker !== 0 && m.u32(pAttacker) === UNIT_PLAYER ? (m.u32((pAttacker + 4) >>> 0) | 0) : 0
      DATATBLS_GetMaxLevel113c(m, expCls)
    }
    const characterLevel = Math.max(1, Math.floor(expArgs.clvl))
    if (characterLevel >= 99) return 0
    let exp = Math.trunc(expArgs.rawExp)
    if (exp > 0x7fffff) exp = 0x7fffff
    else if (exp <= 0) return 1
    const monsterLevel = expArgs.mlvl > 0 ? Math.floor(expArgs.mlvl) : characterLevel
    exp = SUNITDMG_ApplyLevelDiffExpRatio_6FCFAA40_113c(exp, characterLevel, monsterLevel)
    if (hasExpBin) {
      hitD2GameVa113c(0x6FCFA9E0)
    }
    if (exp > 0) {
      const clampedLv = Math.max(1, Math.min(99, characterLevel))
      if (hasExpBin) {
        DATATBLS_GetExpRatio113c(m, clampedLv)
        DATATBLS_GetExpRatio113c(m, 0)
      }
      const expRatio = EXP_RATIOS_113C[clampedLv]!
      const shift = 10
      const limit = 0x7fffffff >> ((shift + (expRatio >> shift)) & 31)
      exp = exp > limit ? Math.imul(exp >> shift, expRatio) : Math.imul(expRatio, exp) >> shift
    } else {
      exp = 0
    }
    const stat85 = Math.trunc(expArgs.addExpPct)
    if (stat85 !== 0) {
      exp += mulDiv113c(stat85, exp, 100)
    }
    if (hasExpBin) {
      hitD2GameVa113c(0x6FCFB6B0)
    }
    return exp > 0 ? exp : 0
  }
  if (pAttacker === 0) return skillBonusPct | 0
  const basePct = STATLIST_GetUnitStat113c(m, pAttacker, 25, 0) | 0
  const secMinPct = STATLIST_GetUnitStat113c(m, pAttacker, 17, 0) | 0
  const total = (basePct + (secMinPct > 0 && basePct === 0 ? secMinPct : 0) + (skillBonusPct | 0)) | 0
  return total < -90 ? -90 : total
}

function lookupChillEffectiveness113c(m: Memory113c, pDefender: number, diff: 0 | 1 | 2): number {
  if (m.u32(pDefender) === UNIT_PLAYER) return -50
  if (m.u32(pDefender) !== UNIT_MONSTER) return -50
  const classId = m.get(pDefender, D2UnitStrc.dwClassId) | 0
  const monRow = getMonStatsRecordPtrSafeK2(m, classId)
  if (monRow !== 0) {
    // MonStatsTxt.nColdEffect[3] (`int8_t[3]` at +0x168..+0x16A in 1.13c D2MonStatsTxt, `0x6FCFAE5A`)
    const ce = (m.u8((monRow + 0x168 + diff) >>> 0) << 24) >> 24
    if (ce !== 0 || m.u8((monRow + 0x168) >>> 0) === 0) {
      return ce
    }
  }
  return -50
}

/**
 * `@va D2Game:0x6FCFB4C0` (`STATES_OnColdStateRemoved`):
 * `fpRemove` callback on `STATE_COLD (11)` (`D2StatListStrc`): clears `STATES_ToggleState(pUnit, 11, 0)`
 * and `STATES_ToggleState(pUnit, 107, 0)` (`STATE_SHATTER`), recomputes movement/anim speed, and queues `0xA9`.
 */
export function STATES_OnColdStateRemoved_6FCFB4C0_113c(
  m: Memory113c,
  pUnit: number,
): void {
  if (pUnit === 0) return
  STATES_ToggleGfxStateFlag113c(m, pUnit, 11, 0)
  STATES_ToggleGfxStateFlag113c(m, pUnit, 107, 0)
}

/**
 * `@va D2Game:0x6FCFBD90` (`STATES_OnFreezeStateRemoved`):
 * `fpRemove` callback on `STATE_FREEZE (1)` (`D2StatListStrc`): clears `STATES_ToggleState(pUnit, 1, 0)`,
 * wakes monster AI (`Event 2` at `curFrame + 1`), and flags GFX state dirty (`0xA9`).
 */
export function STATES_OnFreezeStateRemoved_6FCFBD90_113c(
  m: Memory113c,
  pUnit: number,
): void {
  if (pUnit === 0) return
  STATES_ToggleGfxStateFlag113c(m, pUnit, 1, 0)
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  if (pGame !== 0 && m.u32(pUnit) === UNIT_MONSTER && SUNIT_IsDeadOrDying113c(m, pUnit) === 0) {
    const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
    EVENT_SetEventFull113c(m, pGame, pUnit, MON_EVENT_AI_THINK, (curFrame + 1) >>> 0, 0, 0, 0)
  }
}

/**
 * `@va D2Game:0x6FCFC780` (`SUNITDMG_ApplyColdChilledEffect`, `445B`):
 * Exact 1.13c binary implementation of `STATE_COLD (11)` (`0x0B`) on `Memory113c`:
 * 1. Rejects non-player/non-monster targets, dead targets, `coldLen <= 0`, and monsters with `chillEff >= 0`
 *    (`MonStatsTxt.nColdEffect[diff] >= 0`, i.e. chill-immune).
 * 2. Scales `coldLen` by `SUNITDMG_GetColdEffectLengthBonus113c(m, pAttacker, pDefender)` (`100 - ColdRes + Pierce`,
 *    halved by `STAT_ITEM_HALFFREEZEDURATION = 118`), and divides by `2` in Nightmare / `4` in Hell vs players/mercs.
 * 3. Checks existing `STATE_COLD (11)` `D2StatListStrc`: if an active stronger/longer chill already exists, keeps max `expireFrame`.
 * 4. Allocates/updates real timed `D2StatListStrc` (`STATLIST_FLAG_TIMED = 0x40`, `state = 11`, `fpRemove = 0x6FCFB4C0`),
 *    writes `STAT_VELOCITYPERCENT (67) = chillEff`, `STAT_ATTACKRATE (68) = chillEff`, `STAT_OTHER_ANIMRATE (69) = chillEff`,
 *    merges onto `pDefender`, toggles `STATE_COLD (11)` + `STATES_ToggleGfxStateFlag`, schedules `Event 0x0C` (`12`) at
 *    `expireFrame`, and rolls `20%` (`SEED_RollLimitedRandomNumber < 20`) to set `STATE_SHATTER (107)` (`0x6B`).
 */
export function SUNITDMG_ApplyColdChilledEffect113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  coldLen: number,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFC780)
  if (dllAbi) {
    const def = pDefender >>> 0
    const att = pAttacker >>> 0
    let len = coldLen | 0
    if (len <= 0) return
    const pOld = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, def, 0x0b) >>> 0
    if (att === 0) {
      throw new D2CommonAssertError('SUnitDmg.cpp', 0xa2a)
    }
    const pGameLocal = m.u32((att + 0x80) >>> 0) >>> 0
    const chillEff = SUNITDMG_GetDefenderColdEffect113c(m, def, pGameLocal) | 0
    if (chillEff === 0) return
    if (def !== 0 && m.u32(def) === 1 && chillEff < 0) {
      const diff = m.u8((pGameLocal + 0x6d) >>> 0)
      const pMonLvl = DATATBLS_GetMonLvlTxtRecord113c(m, diff) >>> 0
      const coldDiv = m.u32((pMonLvl + 0x18) >>> 0) | 0
      if (coldDiv !== 0) {
        len = sdiv32(len, coldDiv)
      }
    }
    if (len <= 1) len = 1
    const expire = ((m.u32((pGameLocal + 0xa8) >>> 0) | 0) + len) | 0
    if (pOld === 0) {
      STATES_ToggleGfxStateFlag113c(m, def, 0x0b, 1)
      const pList = STATLIST_AllocList113c(
        m,
        2,
        m.u32(att) | 0,
        m.u32((att + 0x0c) >>> 0),
        0,
        expire >>> 0,
      )
      EVENT_SetEventFull113c(m, pGameLocal, def, 0x0c, expire >>> 0, 0, 0, 0)
      STATLIST_SetState113c(m, pList, 0x0b)
      STATLIST_SetStatRemoveProc113c(m, pList, D2GAME_FP_REMOVE_COLD_VA_113C)
      STATLIST_MergeStatLists113c(m, def, pList, 1)
      STATLIST_SetStat113c(m, pList, 0x43, chillEff, 0)
      STATLIST_SetStat113c(m, pList, 0x44, chillEff, 0)
      STATLIST_SetStat113c(m, pList, 0x45, chillEff, 0)
      UNITS_SetUnitAnimMode113c(m, def, 0x6fd1b0ec, 0x1d8)
    } else if ((STATLIST_GetExpireFrame113c(m, pOld) | 0) < expire) {
      STATLIST_SetExpireFrame113c(m, pOld, expire >>> 0)
      EVENT_SetEventFull113c(m, pGameLocal, def, 0x0c, expire >>> 0, 0, 0, 0)
    }
    const lo = stepSeedMemK2(m, (def + 0x20) >>> 0) >>> 0
    const rem = lo % 100
    if (
      rem < 0x14 &&
      def !== 0 &&
      m.u32(def) === 1 &&
      MONSTATS2_CheckFlagBit113c(m, m.u32((def + 0x04) >>> 0) | 0, 0x13) === 0
    ) {
      STATES_ToggleGfxStateFlag113c(m, def, 0x6b, 1)
    } else {
      STATES_ToggleGfxStateFlag113c(m, def, 0x6b, 0)
    }
    return
  }
  if (pGame === 0 || pDefender === 0 || (coldLen | 0) <= 0) return
  const defType = m.u32(pDefender) >>> 0
  if (defType !== UNIT_PLAYER && defType !== UNIT_MONSTER) return
  if (SUNIT_IsDeadOrDying113c(m, pDefender) !== 0) return
  if (STATES_CheckState113c(m, pDefender, 1) !== 0) return

  // Cannot Be Frozen (`STAT_ITEM_CANNOTBEFROZEN = 153`) blocks chill on players & hirelings (unless Holy Freeze, which uses aura state)
  if (STATLIST_GetUnitStat113c(m, pDefender, 153, 0) > 0) return

  const diff = getEffectiveDiffK2(m, pGame)
  const pMonLvl = isSgptDataTablesLoaded113c(m)
    ? (DATATBLS_GetMonLvlTxtRecord113c(m, diff) >>> 0)
    : 0
  const hasTables = pMonLvl !== 0
  const chillEff = hasTables
    ? (SUNITDMG_GetDefenderColdEffect113c(m, pDefender, pGame) | 0)
    : lookupChillEffectiveness113c(m, pDefender, diff)
  if (chillEff >= 0) return

  let effLen = coldLen | 0
  if (!hasTables) {
    const lenBonusPct = SUNITDMG_GetColdEffectLengthBonus113c(m, pAttacker, pDefender)
    if (lenBonusPct <= 0) return
    effLen = mulDiv113c(effLen, lenBonusPct, 100)
  }
  if (defType === UNIT_MONSTER && chillEff < 0 && hasTables) {
    const coldDiv = m.u32((pMonLvl + 0x18) >>> 0) | 0
    if (coldDiv !== 0) {
      effLen = sdiv32(effLen, coldDiv)
    }
  } else if (defType === UNIT_PLAYER && m.u32((pGame + 0x70) >>> 0) !== 0) {
    if (diff === 1) effLen = effLen >> 1
    else if (diff === 2) effLen = effLen >> 2
  }
  if (hasTables) {
    if (effLen <= 1) effLen = 1
  } else if (effLen <= 0) {
    return
  }

  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const expireFrame = (curFrame + (effLen >>> 0)) >>> 0
  const attType = pAttacker !== 0 ? (m.u32(pAttacker) >>> 0) : 6
  const attId = pAttacker !== 0 ? (m.get(pAttacker, D2UnitStrc.dwUnitId) >>> 0) : 0

  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, 11) >>> 0
  if (pStatList !== 0) {
    const oldExpire = STATLIST_GetExpireFrame113c(m, pStatList) >>> 0
    const oldEff = STATLIST_GetStatValue113c(m, pStatList, 67, 0) | 0
    if ((oldEff | 0) >= (chillEff | 0)) {
      if ((expireFrame | 0) > (oldExpire | 0)) {
        STATLIST_SetExpireFrame113c(m, pStatList, expireFrame)
        if (!hasTables) {
          STATLIST_SetStat113c(m, pStatList, 67, chillEff, 0)
          STATLIST_SetStat113c(m, pStatList, 68, chillEff, 0)
          STATLIST_SetStat113c(m, pStatList, 69, chillEff, 0)
        }
        EVENT_SetEventFull113c(m, pGame, pDefender, 12, expireFrame, 0, 0, 0)
      }
    } else if (!hasTables) {
      return
    }
  } else {
    pStatList = STATLIST_AllocList113c(m, STATLIST_FLAG_TIMED, attType, attId, 11, expireFrame)
    if (pStatList === 0) return
    STATES_ToggleGfxStateFlag113c(m, pDefender, 11, 1)
    if (!hasTables) {
      STATES_ToggleState113c(m, pDefender, 11, 1)
    }
    EVENT_SetEventFull113c(m, pGame, pDefender, 12, expireFrame, 0, 0, 0)
    STATLIST_SetState113c(m, pStatList, 11)
    STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
    STATLIST_SetStatRemoveProc113c(m, pStatList, D2GAME_FP_REMOVE_COLD_VA_113C)
    STATLIST_MergeStatLists113c(m, pDefender, pStatList, 1)
    STATLIST_SetStat113c(m, pStatList, 67, chillEff, 0)
    STATLIST_SetStat113c(m, pStatList, 68, chillEff, 0)
    STATLIST_SetStat113c(m, pStatList, 69, chillEff, 0)
    if (hasHydratedAnimDataTableK2(m)) {
      UNITS_SetUnitAnimMode113c(m, pDefender, 0x6fd1b0ec, 0x1d8)
    }
  }

  if (hasTables) {
    const roll = rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, 100)
    if (
      roll < 20 &&
      defType === UNIT_MONSTER &&
      MONSTATS_CheckFlagBit113c(m, m.u32((pDefender + 0x04) >>> 0) | 0, 0x13) === 0
    ) {
      STATES_ToggleGfxStateFlag113c(m, pDefender, 107, 1)
    } else {
      STATES_ToggleGfxStateFlag113c(m, pDefender, 107, 0)
    }
  } else if (defType === UNIT_MONSTER) {
    const roll = rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, 100)
    if (roll < 20) {
      STATES_ToggleState113c(m, pDefender, 107, 1)
    }
  }
}

/**
 * `@va D2Game:0x6FCFC940` (`SUNITDMG_ApplyBurnEffect`, `356B`):
 * Exact binary function at `0x6FCFC940`: creates/merges a timed `STATE_BURNING (115)` (`0x73`) `D2StatListStrc`
 * with `STAT_HPREGEN (74) = -burnRate`, `fpRemove = 0x6FCBF7A0`, and schedules `Event 3` (DoT regen tick)
 * plus `Event 12` (timed state expiry).
 */
export function SUNITDMG_ApplyBurnEffect_6FCFC940_113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  burnDmg: number,
  burnLen: number,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFC940)
  if (dllAbi) {
    applyTimedDotEffectDll113c(m, 0x73, pDefender, pAttacker, burnDmg, burnLen)
    return
  }
  if (pGame === 0 || pDefender === 0 || (burnDmg | 0) <= 0 || (burnLen | 0) <= 0) return
  if (SUNIT_IsDeadOrDying113c(m, pDefender) !== 0) return
  const fireRes = SUNITDMG_GetEffectiveResistance113c(m, pDefender, 39, pAttacker)
  if (fireRes >= 100) return
  const effRate = mulDiv113c(burnDmg | 0, 100 - fireRes, 100)
  if (effRate <= 0) return

  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const expireFrame = (curFrame + (burnLen >>> 0)) >>> 0
  const attType = pAttacker !== 0 ? (m.u32(pAttacker) >>> 0) : 6
  const attId = pAttacker !== 0 ? (m.get(pAttacker, D2UnitStrc.dwUnitId) >>> 0) : 0

  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, 115) >>> 0
  if (pStatList === 0) {
    pStatList = STATLIST_AllocList113c(m, STATLIST_FLAG_TIMED, attType, attId, 115, expireFrame)
    if (pStatList === 0) return
    STATLIST_SetState113c(m, pStatList, 115)
    STATLIST_SetStatRemoveProc113c(m, pStatList, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
    STATLIST_MergeStatLists113c(m, pDefender, pStatList, 1)
    STATES_ToggleState113c(m, pDefender, 115, 1)
    STATES_ToggleGfxStateFlag113c(m, pDefender, 115, 1)
  }
  STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
  STATLIST_SetStat113c(m, pStatList, 74, -effRate, 0)
  EVENT_SetEventFull113c(m, pGame, pDefender, 3, (curFrame + 1) >>> 0, 0, 0, 0)
  EVENT_SetEventFull113c(m, pGame, pDefender, 12, expireFrame, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FCFDAC0` (`SUNITDMG_ApplyFreezeEffect`, `492B`):
 * Exact 1.13c freeze state application (`STATE_FREEZE = 1`):
 * - Players, Unique/SuperUnique/Boss/Champion monsters (`MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x0E)` or Act Boss),
 *   and units with `STAT_ITEM_CANNOTBEFROZEN (153)` downgrade `frzLen` to `SUNITDMG_ApplyColdChilledEffect113c`!
 * - Monsters with `chillEff >= 0` (`nColdEffect == 0`) are immune to freeze.
 * - Scales `frzLen` by `SUNITDMG_GetColdEffectLengthBonus113c`, allocates/updates timed `D2StatListStrc` (`state = 1`,
 *   `fpRemove = 0x6FCFBD90`), removes any active `STATE_COLD (11)` sublist, sets `STATES_ToggleState(pDefender, 1, 1)` +
 *   `STATES_ToggleGfxStateFlag`, halts monster movement/AI until `expireFrame`, and schedules `Event 12` at `expireFrame`.
 */
export function SUNITDMG_ApplyFreezeEffect113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  frzLen: number,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFDAC0)
  if (dllAbi) {
    const def = pDefender >>> 0
    const att = pAttacker >>> 0
    let len = frzLen | 0
    if (len <= 0) return
    const defType = def !== 0 ? (m.u32(def) | 0) : 6
    if (defType === 0) {
      SUNITDMG_ApplyColdChilledEffect113c(m, 0, att, def, len, true)
      return
    }
    if (defType === 1) {
      if (STATES_CheckState113c(m, def, 0x36) !== 0) return
      const cid = def !== 0 ? (m.u32((def + 4) >>> 0) | 0) : -1
      const pMonTxt = MONSTATS_GetRecordPtr113c(m, cid) >>> 0
      if (MONSTERS_CheckMonStatsFlagBit6_113c(m, pMonTxt, def) !== 0) {
        SUNITDMG_ApplyColdChilledEffect113c(m, 0, att, def, len, true)
        return
      }
      if (MONSTER_CheckTypeFlagsMask113c(m, def, 8) !== 0) {
        SUNITDMG_ApplyColdChilledEffect113c(m, 0, att, def, len, true)
        return
      }
      if (MONSTERS_GetHirelingTypeId113c(m, def) !== 0) {
        SUNITDMG_ApplyColdChilledEffect113c(m, 0, att, def, len, true)
        return
      }
    }
    const pOld = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, def, 1) >>> 0
    if (att === 0) {
      throw new D2CommonAssertError('SUnitDmg.cpp', 0xa2a)
    }
    const pGameLocal = m.u32((att + 0x80) >>> 0) >>> 0
    const chillEff = SUNITDMG_GetDefenderColdEffect113c(m, def, pGameLocal) | 0
    if (chillEff >= 0) return
    if (def !== 0 && m.u32(def) === 1) {
      const diff = m.u8((pGameLocal + 0x6d) >>> 0)
      const pMonLvl = DATATBLS_GetMonLvlTxtRecord113c(m, diff) >>> 0
      const frzDiv = m.u32((pMonLvl + 0x14) >>> 0) | 0
      if (frzDiv === 0) {
        throw new D2CommonAssertError('SUnitDmg.cpp', 0x250)
      }
      len = sdiv32(len, frzDiv)
    }
    const curFrame = m.u32((pGameLocal + 0xa8) >>> 0) | 0
    let expire = (curFrame + len) | 0
    if (pOld === 0) {
      STATES_ToggleGfxStateFlag113c(m, def, 1, 1)
      const pList = STATLIST_AllocList113c(
        m,
        2,
        m.u32(att) | 0,
        m.u32((att + 0x0c) >>> 0),
        0,
        expire >>> 0,
      )
      STATLIST_SetState113c(m, pList, 1)
      STATLIST_SetStatRemoveProc113c(m, pList, D2GAME_FP_REMOVE_FREEZE_VA_113C)
      STATLIST_MergeStatLists113c(m, def, pList, 1)
    } else {
      const oldExp = STATLIST_GetExpireFrame113c(m, pOld) | 0
      if (oldExp < expire) {
        STATLIST_SetExpireFrame113c(m, pOld, expire >>> 0)
      } else {
        expire = oldExp
      }
    }
    EVENT_SetEventFull113c(m, pGameLocal, def, 0x0c, expire >>> 0, 0, 0, 0)
    if (def === 0 || m.u32(def) !== 1) {
      throw new D2CommonAssertError('SUnitDmg.cpp', 0x272)
    }
    let ev = m.u32((def + 0xdc) >>> 0) >>> 0
    while (ev !== 0) {
      const next = m.u32((ev + 0x24) >>> 0) >>> 0
      if (m.u8(ev) === 2) {
        EVENT_FreeNode113c(m, pGameLocal, ev)
      }
      ev = next
    }
    EVENT_SetEventFull113c(
      m,
      pGameLocal,
      def,
      2,
      (((m.u32((pGameLocal + 0xa8) >>> 0) | 0) + len + 1) | 0) >>> 0,
      0,
      0,
      0,
    )
    return
  }
  if (pGame === 0 || pDefender === 0 || (frzLen | 0) <= 0) return
  if (SUNIT_IsDeadOrDying113c(m, pDefender) !== 0) return

  const defType = m.u32(pDefender) >>> 0
  if (defType === UNIT_PLAYER) {
    SUNITDMG_ApplyColdChilledEffect113c(m, pGame, pAttacker, pDefender, frzLen)
    return
  }
  if (defType !== UNIT_MONSTER) return

  if (STATLIST_GetUnitStat113c(m, pDefender, 153, 0) > 0) return

  const diff = getEffectiveDiffK2(m, pGame)
  const chillEff = lookupChillEffectiveness113c(m, pDefender, diff)
  if (chillEff >= 0) return

  // Boss / Unique / Champion monsters cannot be solid-frozen; downgrade to Cold Chilled (`0x6FCFDAC0`)
  const monRow = getMonStatsRecordPtrSafeK2(m, m.get(pDefender, D2UnitStrc.dwClassId) | 0)
  const isBossFlag = monRow !== 0 && (m.u8((monRow + 0x0c) >>> 0) & 0x40) !== 0
  if (isBossFlag || MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x0e) !== 0) {
    SUNITDMG_ApplyColdChilledEffect113c(m, pGame, pAttacker, pDefender, frzLen)
    return
  }

  const lenBonusPct = SUNITDMG_GetColdEffectLengthBonus113c(m, pAttacker, pDefender)
  if (lenBonusPct <= 0) return
  let effLen = mulDiv113c(frzLen | 0, lenBonusPct, 100)
  if (m.u32((pGame + 0x70) >>> 0) !== 0) {
    if (diff === 1) effLen = effLen >> 1
    else if (diff === 2) effLen = effLen >> 2
  }
  if (effLen <= 0) return

  // Remove any active STATE_COLD (11) sublist since STATE_FREEZE (1) supersedes it
  const pOldCold = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, 11) >>> 0
  if (pOldCold !== 0) {
    STATLIST_UnlinkSubList113c(m, pDefender, pOldCold)
    STATLIST_FreeStatListImpl113c(m, pOldCold)
    STATES_ToggleState113c(m, pDefender, 11, 0)
  }

  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const expireFrame = (curFrame + (effLen >>> 0)) >>> 0
  const attType = pAttacker !== 0 ? (m.u32(pAttacker) >>> 0) : 6
  const attId = pAttacker !== 0 ? (m.get(pAttacker, D2UnitStrc.dwUnitId) >>> 0) : 0

  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, 1) >>> 0
  if (pStatList !== 0) {
    const oldExp = STATLIST_GetExpireFrame113c(m, pStatList) >>> 0
    const nextExp = (expireFrame | 0) > (oldExp | 0) ? expireFrame : oldExp
    STATLIST_SetExpireFrame113c(m, pStatList, nextExp)
    EVENT_SetEventFull113c(m, pGame, pDefender, 12, nextExp, 0, 0, 0)
    return
  }

  pStatList = STATLIST_AllocList113c(m, STATLIST_FLAG_TIMED, attType, attId, 1, expireFrame)
  if (pStatList === 0) return
  STATLIST_SetState113c(m, pStatList, 1)
  STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
  STATLIST_SetStatRemoveProc113c(m, pStatList, D2GAME_FP_REMOVE_FREEZE_VA_113C)
  STATLIST_MergeStatLists113c(m, pDefender, pStatList, 1)
  STATES_ToggleState113c(m, pDefender, 1, 1)
  STATES_ToggleGfxStateFlag113c(m, pDefender, 1, 1)

  // Pause monster step/AI events until freeze expires (`0x6FCFDC40`)
  MONSTER_ClearModeEvents113c(m, pGame, pDefender)
  EVENT_DeleteEventByType113c(m, pGame, pDefender, MON_EVENT_AI_THINK)
  EVENT_SetEventFull113c(m, pGame, pDefender, MON_EVENT_AI_THINK, (expireFrame + 1) >>> 0, 0, 0, 0)
  EVENT_SetEventFull113c(m, pGame, pDefender, 12, expireFrame, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FCFDAC0` (`SUNITDMG_ApplyColdOrFreezeState`, `492B`):
 * Dispatches `dwFrzLen` (`+0x38`) + `STAT_ITEM_FREEZETARGET (134)` hit-freezes-target roll to
 * `SUNITDMG_ApplyFreezeEffect113c`, and `dwColdLen` (`+0x34`) to `SUNITDMG_ApplyColdChilledEffect113c`,
 * plus `dwBurnLen` (`+0x28`) / `dwBurnDmg` (`+0x24`) to `SUNITDMG_ApplyBurnEffect_6FCFC940_113c`.
 */
export function SUNITDMG_ApplyColdOrFreezeState113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
): void {
  if (pGame === 0 || pDefender === 0 || pDmg === 0) return
  let frzLen = m.get(pDmg, D2DamageStrc.dwFrzLen) | 0
  if (
    frzLen <= 0 &&
    pAttacker !== 0 &&
    (m.get(pDmg, D2DamageStrc.wResultFlags) & 0x20) === 0 &&
    safeReadU32K2(m, (pAttacker + 0x90) >>> 0) === 0
  ) {
    const hitFreeze = STATLIST_GetUnitStat113c(m, pAttacker, 134, 0) | 0
    if (hitFreeze > 0) {
      const aLvl = STATLIST_GetUnitStat113c(m, pAttacker, 12, 0) | 0
      const dLvl = STATLIST_GetUnitStat113c(m, pDefender, 12, 0) | 0
      const bRanged = (m.get(pDmg, D2DamageStrc.dwHitFlags) & 0x20) !== 0
      let chance = 50 + (aLvl + hitFreeze * 4 - dLvl - (bRanged ? 6 : 0)) * 5
      if (bRanged) chance = Math.trunc(chance / 3)
      if (chance > 0 && rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100) < (chance > 100 ? 100 : chance >>> 0)) {
        frzLen = (chance - (rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100) | 0)) * 2 + 25
        if (frzLen < 25) frzLen = 25
        if (frzLen > 250) frzLen = 250
      }
    }
  }
  const coldLen = m.get(pDmg, D2DamageStrc.dwColdLen) | 0
  SUNITDMG_ApplyColdChilledEffect113c(m, pGame, pAttacker, pDefender, coldLen)
  SUNITDMG_ApplyFreezeEffect113c(m, pGame, pAttacker, pDefender, frzLen)
  const burnDmg = m.get(pDmg, D2DamageStrc.dwBurnDamage) | 0
  const burnLen = m.get(pDmg, D2DamageStrc.dwBurnLen) | 0
  SUNITDMG_ApplyBurnEffect_6FCFC940_113c(m, pGame, pAttacker, pDefender, burnDmg, burnLen)
}

/**
 * `@va D2Game:0x6FCFCAB0` (`SUNITDMG_ApplyPoisonEffect`, `356B`):
 * Exact 1.13c binary implementation of `STATE_POISON (2)` on `Memory113c`:
 * 1. Rejects poison-immune targets (`PoisonRes >= 100` or `PoisonLengthResist >= 100`), dead targets, and `poisDmg <= 0` / `poisLen <= 0`.
 * 2. Applies `STAT_ITEM_POISONLENGTHRESIST (110)` (capped `[-100, 75]` on players in NM/Hell with `-40`/`-100` penalty)
 *    to `poisLen` (`effLen = mulDiv(poisLen, 100 - plr, 100)`).
 * 3. Creates or updates real timed `D2StatListStrc` (`STATLIST_FLAG_TIMED = 0x40`, `state = 2` `STATE_POISON`,
 *    `fpRemove = 0x6FCBF7A0`), writes:
 *    - `STAT_HPREGEN (74) = -effRate` (consumed by `MONSTER_Event03_RegenAndPoisonTick113c` / `PLAYER_Event3_RegenTick113c`!),
 *    - `STAT_POISONMINDAM (57) = effRate`, `STAT_POISONMAXDAM (58) = effRate`, `STAT_POISONLENGTH (59) = effLen`,
 *      `STAT_POISON_COUNT (326) = 1`,
 *    toggles `STATES_ToggleState(pDefender, 2, 1)` + `STATES_ToggleGfxStateFlag`, and schedules `Event 3` (`curFrame + 1`)
 *    and `Event 12` (`expireFrame`).
 */
export function SUNITDMG_ApplyPoisonEffect113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  poisDmg: number,
  poisLen: number,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFCAB0)
  if (
    dllAbi ||
    (isSgptDataTablesLoaded113c(m) &&
      pAttacker !== 0 &&
      m.u32(((pAttacker >>> 0) + 0x80) >>> 0) !== 0)
  ) {
    applyTimedDotEffectDll113c(m, 2, pDefender, pAttacker, poisDmg, poisLen)
    return
  }
  if (pGame === 0 || pDefender === 0 || (poisDmg | 0) <= 0 || (poisLen | 0) <= 0) return
  const defType = m.u32(pDefender) >>> 0
  if (defType !== UNIT_PLAYER && defType !== UNIT_MONSTER) return
  if (SUNIT_IsDeadOrDying113c(m, pDefender) !== 0) return

  const poisRes = SUNITDMG_GetEffectiveResistance113c(m, pDefender, 45, pAttacker)
  if (poisRes >= 100) return

  let plr = STATLIST_GetUnitStat113c(m, pDefender, 110, 0) | 0
  if (defType === UNIT_PLAYER && m.u32((pGame + 0x70) >>> 0) !== 0) {
    const diff = getEffectiveDiffK2(m, pGame)
    if (diff === 1) plr -= 40
    else if (diff === 2) plr -= 100
  }
  if (plr >= 100) return
  if (plr > 75 && defType === UNIT_PLAYER) plr = 75
  if (plr < -100) plr = -100

  const effLen = mulDiv113c(poisLen | 0, 100 - plr, 100)
  if (effLen <= 0) return

  const effRate = poisDmg | 0
  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const expireFrame = (curFrame + (effLen >>> 0)) >>> 0
  const attType = pAttacker !== 0 ? (m.u32(pAttacker) >>> 0) : 6
  const attId = pAttacker !== 0 ? (m.get(pAttacker, D2UnitStrc.dwUnitId) >>> 0) : 0

  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, 2) >>> 0
  if (pStatList !== 0) {
    const oldRegen = STATLIST_GetStatValue113c(m, pStatList, 74, 0) | 0
    const oldRate = oldRegen < 0 ? -oldRegen : 0
    if (oldRate > effRate) return
    STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
    STATLIST_SetStat113c(m, pStatList, 74, -effRate, 0)
    STATLIST_SetStat113c(m, pStatList, 57, effRate, 0)
    STATLIST_SetStat113c(m, pStatList, 58, effRate, 0)
    STATLIST_SetStat113c(m, pStatList, 59, effLen, 0)
    STATLIST_SetStat113c(m, pStatList, 326, 1, 0)
    EVENT_SetEventFull113c(m, pGame, pDefender, 3, (curFrame + 1) >>> 0, 0, 0, 0)
    EVENT_SetEventFull113c(m, pGame, pDefender, 12, expireFrame, 0, 0, 0)
    return
  }

  pStatList = STATLIST_AllocList113c(m, STATLIST_FLAG_TIMED, attType, attId, 2, expireFrame)
  if (pStatList === 0) return
  STATLIST_SetState113c(m, pStatList, 2)
  STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
  STATLIST_SetStatRemoveProc113c(m, pStatList, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
  STATLIST_MergeStatLists113c(m, pDefender, pStatList, 1)
  STATLIST_SetStat113c(m, pStatList, 74, -effRate, 0)
  STATLIST_SetStat113c(m, pStatList, 57, effRate, 0)
  STATLIST_SetStat113c(m, pStatList, 58, effRate, 0)
  STATLIST_SetStat113c(m, pStatList, 59, effLen, 0)
  STATLIST_SetStat113c(m, pStatList, 326, 1, 0)
  STATES_ToggleState113c(m, pDefender, 2, 1)
  STATES_ToggleGfxStateFlag113c(m, pDefender, 2, 1)
  EVENT_SetEventFull113c(m, pGame, pDefender, 3, (curFrame + 1) >>> 0, 0, 0, 0)
  EVENT_SetEventFull113c(m, pGame, pDefender, 12, expireFrame, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FCFCC20` (`SUNITDMG_ApplyStunEffect`, `337B`):
 * Exact 1.13c binary implementation of `STATE_STUNNED (21)` (`0x15`) on `Memory113c`:
 * - Boss / SuperUnique monsters (`MonStats.boss` or `MONSTER_CheckTypeFlagsMask113c(0x0A)`) are stun-immune.
 * - Champion monsters (`typeFlags & 0x04`) only suffer stun on a `10%` roll (`rollSeedMemK2(100) < 10`).
 * - Clamps `stunLen` to `250` frames (`10s`) on monsters and `13` frames on players (`0x6FCFCC95`).
 * - Allocates/updates real timed `D2StatListStrc` (`STATLIST_FLAG_TIMED = 0x40`, `state = 21`,
 *   `fpRemove = 0x6FCBF7A0`), merges onto `pDefender`, toggles `STATES_ToggleState(pDefender, 21, 1)` +
 *   `STATES_ToggleGfxStateFlag`, and schedules `Event 12` at `expireFrame`.
 */
export function SUNITDMG_ApplyStunEffect113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  stunLen: number,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFCC20)
  if (dllAbi) {
    const att = pAttacker >>> 0
    const def = pDefender >>> 0
    let len = stunLen | 0
    if (len <= 0) return
    if (def !== 0 && m.u32(def) === 1) {
      const pMonData = m.u32((def + 0x14) >>> 0) >>> 0
      if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 8) !== 0) {
        const rem = (stepSeedMemK2(m, (att + 0x20) >>> 0) >>> 0) % 100
        if (rem < 0x5a) return
      }
      if (MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, def) !== 0) return
      const pMonTxt = MONSTATS_GetRecordPtr113c(m, m.u32((def + 4) >>> 0) | 0) >>> 0
      if (pMonTxt === 0 || m.u16((pMonTxt + 0x32) >>> 0) === 0) return
      if (MONSTERS_GetHirelingTypeId113c(m, def) !== 0 && len >= 0x0d) {
        len = 0x0d
      } else if (len > 0xfa) {
        len = 0xfa
      }
    } else if (len > 0xfa) {
      len = 0xfa
    }
    const pOld = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, def, 0x15) >>> 0
    if (att === 0) {
      throw new D2CommonAssertError('SUnitDmg.cpp', 0xa2a)
    }
    const pGameLocal = m.u32((att + 0x80) >>> 0) >>> 0
    const expire = ((m.u32((pGameLocal + 0xa8) >>> 0) | 0) + len) | 0
    if (pOld === 0) {
      const pList = STATLIST_AllocList113c(
        m,
        2,
        m.u32(att) | 0,
        m.u32((att + 0x0c) >>> 0),
        0,
        expire >>> 0,
      )
      EVENT_SetEventFull113c(m, pGameLocal, def, 0x0c, expire >>> 0, 0, 0, 0)
      STATLIST_SetState113c(m, pList, 0x15)
      STATLIST_SetStatRemoveProc113c(m, pList, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
      STATLIST_MergeStatLists113c(m, def, pList, 1)
      STATES_ToggleGfxStateFlag113c(m, def, 0x15, 1)
    } else {
      STATLIST_SetExpireFrame113c(m, pOld, expire >>> 0)
      EVENT_SetEventFull113c(m, pGameLocal, def, 0x0c, expire >>> 0, 0, 0, 0)
    }
    return
  }
  if (pGame === 0 || pDefender === 0 || (stunLen | 0) <= 0) return
  const defType = m.u32(pDefender) >>> 0
  if (defType !== UNIT_PLAYER && defType !== UNIT_MONSTER) return
  // 0x6FCFCC20 does not check SUNIT_IsDeadOrDying; SUNITDMG_ApplyDamage calls it after HP hits 0 and before death mode.

  let effLen = stunLen | 0
  if (defType === UNIT_MONSTER) {
    const monRow = getMonStatsRecordPtrSafeK2(m, m.get(pDefender, D2UnitStrc.dwClassId) | 0)
    if (monRow !== 0 && (m.u8((monRow + 0x0c) >>> 0) & 0x40) !== 0) return
    if (MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x0a) !== 0) return
    if (MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x04) !== 0) {
      if (rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, 100) >= 10) return
    }
    if (isSgptDataTablesLoaded113c(m) && MONSTERS_GetHirelingTypeId113c(m, pDefender) !== 0) {
      if (effLen >= 13) effLen = 13
    } else if (effLen > 250) {
      effLen = 250
    }
  } else {
    // D2Game@0x6FCFCC35..0x6FCFCCBF: players jump directly to the 250f (0xFA) cap; only hirelings cap at 13f (0x0D).
    if (effLen > 250) effLen = 250
  }

  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const expireFrame = (curFrame + (effLen >>> 0)) >>> 0
  const attType = pAttacker !== 0 ? (m.u32(pAttacker) >>> 0) : 6
  const attId = pAttacker !== 0 ? (m.get(pAttacker, D2UnitStrc.dwUnitId) >>> 0) : 0

  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, 21) >>> 0
  if (pStatList !== 0) {
    const oldExp = STATLIST_GetExpireFrame113c(m, pStatList) >>> 0
    const nextExp = (expireFrame | 0) > (oldExp | 0) ? expireFrame : oldExp
    STATLIST_SetExpireFrame113c(m, pStatList, nextExp)
    EVENT_SetEventFull113c(m, pGame, pDefender, 12, nextExp, 0, 0, 0)
    return
  }

  pStatList = STATLIST_AllocList113c(m, STATLIST_FLAG_TIMED, attType, attId, 21, expireFrame)
  if (pStatList === 0) return
  STATLIST_SetState113c(m, pStatList, 21)
  STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
  STATLIST_SetStatRemoveProc113c(m, pStatList, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
  STATLIST_MergeStatLists113c(m, pDefender, pStatList, 1)
  STATES_ToggleState113c(m, pDefender, 21, 1)
  STATES_ToggleGfxStateFlag113c(m, pDefender, 21, 1)
  EVENT_SetEventFull113c(m, pGame, pDefender, 12, expireFrame, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FCFCE70` (`SUNITDMG_TriggerAttackerBlindOrFlee`, `162B`):
 * Evaluates Hit Blinds Target (`STAT_ITEM_HITBLINDSTARGET = 117` -> `STATE_DIMVISION = 23`) and
 * Hit Causes Monster To Flee (`STAT_ITEM_HOWL = 112` -> `STATE_TERROR = 19` + `AIGENERAL_CopyAiCommandParams113c`
 * command `1` flee) against non-boss monsters.
 */
export function SUNITDMG_TriggerAttackerBlindOrFlee113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFCE70)
  if (dllAbi) {
    const att = pAttacker >>> 0
    const def = pDefender >>> 0
    if (att === 0 || m.u32(att) !== 0) return
    if (def === 0 || m.u32(def) !== 1) return
    if (STATLIST_GetUnitStatWithLayer113c(m, att, 0x75, 0) === 0) return
    const cid = m.u32((def + 4) >>> 0) | 0
    if (cid >= 0x2c0 && cid <= 0x2c5) return
    const savedSp = k2RealStackPtr
    const pAuraSetup = savedSp >>> 0
    k2RealStackPtr = (savedSp + 0x24) >>> 0
    try {
      m.fill(pAuraSetup, 0x24, 0)
      m.setU32(pAuraSetup, att)
      m.setU32((pAuraSetup + 0x04) >>> 0, def)
      m.setU32((pAuraSetup + 0x0c) >>> 0, 1)
      m.setU32((pAuraSetup + 0x10) >>> 0, 0x1d4c0)
      m.setU32((pAuraSetup + 0x14) >>> 0, 0x1f)
      m.setU32((pAuraSetup + 0x1c) >>> 0, 0x34)
      STATES_CreateOrUpdateAuraStatList113c(m, pAuraSetup)
    } finally {
      k2RealStackPtr = savedSp
    }
    return
  }
  if (pGame === 0 || pAttacker === 0 || pDefender === 0) return
  void pDmg
  if (m.u32(pDefender) !== UNIT_MONSTER || SUNIT_IsDeadOrDying113c(m, pDefender) !== 0) return
  const monRow = getMonStatsRecordPtrSafeK2(m, m.get(pDefender, D2UnitStrc.dwClassId) | 0)
  if (monRow !== 0 && (m.u8((monRow + 0x0c) >>> 0) & 0x40) !== 0) return
  if (MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x0e) !== 0) return

  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const seedPtr = pAttacker + D2UnitStrc.seedLo.off
  const aLvl = STATLIST_GetUnitStat113c(m, pAttacker, 12, 0) | 0
  const dLvl = STATLIST_GetUnitStat113c(m, pDefender, 12, 0) | 0

  const blind = STATLIST_GetUnitStat113c(m, pAttacker, 117, 0) | 0
  if (blind > 0) {
    let chance = 50 + (aLvl + (blind - 1) * 4 - dLvl) * 5
    if (chance > 0 && rollSeedMemK2(m, seedPtr, 100) < (chance > 100 ? 100 : chance >>> 0)) {
      const dur = 50 + blind * 25
      const exp = (curFrame + (dur >>> 0)) >>> 0
      STATES_ClearCurseStatesOnUnit113c(m, pDefender)
      const pSl = STATLIST_AllocList113c(m, STATLIST_FLAG_TIMED | 0x20, m.u32(pAttacker) >>> 0, m.get(pAttacker, D2UnitStrc.dwUnitId) >>> 0, 23, exp)
      if (pSl !== 0) {
        STATLIST_SetState113c(m, pSl, 23)
        STATLIST_SetExpireFrameEx113c(m, pSl, exp)
        STATLIST_SetStatRemoveProc113c(m, pSl, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
        STATLIST_MergeStatLists113c(m, pDefender, pSl, 1)
        STATES_ToggleState113c(m, pDefender, 23, 1)
        STATES_ToggleGfxStateFlag113c(m, pDefender, 23, 1)
        EVENT_SetEventFull113c(m, pGame, pDefender, 12, exp, 0, 0, 0)
      }
    }
  }

  const howl = STATLIST_GetUnitStat113c(m, pAttacker, 112, 0) | 0
  if (howl > 0 && rollSeedMemK2(m, seedPtr, 128) < (howl >>> 0)) {
    const exp = (curFrame + 150) >>> 0
    STATES_ClearCurseStatesOnUnit113c(m, pDefender)
    const pSl = STATLIST_AllocList113c(m, STATLIST_FLAG_TIMED | 0x20, m.u32(pAttacker) >>> 0, m.get(pAttacker, D2UnitStrc.dwUnitId) >>> 0, 19, exp)
    if (pSl !== 0) {
      STATLIST_SetState113c(m, pSl, 19)
      STATLIST_SetExpireFrameEx113c(m, pSl, exp)
      STATLIST_SetStatRemoveProc113c(m, pSl, D2GAME_FP_REMOVE_TIMED_STATE_VA_113C)
      STATLIST_MergeStatLists113c(m, pDefender, pSl, 1)
      STATES_ToggleState113c(m, pDefender, 19, 1)
      STATES_ToggleGfxStateFlag113c(m, pDefender, 19, 1)
      EVENT_SetEventFull113c(m, pGame, pDefender, 12, exp, 0, 0, 0)
    }
    AIGENERAL_CopyAiCommandParams113c(
      m,
      pDefender,
      1,
      m.get(pAttacker, D2UnitStrc.dwUnitId) | 0,
      150,
      0,
      0,
    )
  }
}

/**
 * `@va D2Game:0x6FCFDE90` (`SUNITDMG_CheckToHit`, `546B`):
 * Pure `SparseMemory113c` exact binary port of `SUNITDMG_CheckToHit`:
 * - Supports both 4-arg combat signature `(m, pAttacker, pDefender, pDmg, arBonusPct)` AND 5-arg `fallen-ai`
 *   signature `(m, pGame, pAttacker, pDefender, arBonus)` seamlessly (`pAttacker` vs `pGame` disambiguated by
 *   `D2UnitStrc.dwUnitType <= 5` vs `D2GameStrc` pointer).
 * - Running player defender (`dwAnimMode == 3` and `bRunFlag`) auto-hits (`100%`) before Dodge/Evade!
 * - `STAT_ITEM_IGNORETARGETAC (115)` zeroes target defense on non-player, non-unique/boss monsters;
 *   `STAT_ITEM_FRACTIONALTARGETAC (122)` reduces target defense % (`halved` vs players/bosses).
 * - Computes `toHit = clamp(2 * 100 * AR / (AR + DR) * alvl / (alvl + dlvl), 5, 95)`, rolls `pAttacker->tSeed` (`100`),
 *   and if `pDmg != 0` sets `D2DamageStrc.wResultFlags |= 0x01` and chains `SUNITDMG_RollDodgeAvoidEvadeBlock113c` (`0x6FCFB030`).
 */
/**
 * Computes exact 1.13c melee/physical hit chance (`[5, 95]`) inside `0x6FCFDE90` (`SUNITDMG_CheckToHit`).
 */
export function SUNITDMG_ComputeHitChance113c(
  m: Memory113c,
  _pGame: number,
  pAttacker: number,
  pDefender: number,
  arBonusPct = 0,
  pDmg = 0,
): number {
  if (pAttacker === 0 || pDefender === 0) return 5
  const attType = m.u32(pAttacker) >>> 0
  const defType = m.u32(pDefender) >>> 0

  const aLvl = STATLIST_GetUnitStat113c(m, pAttacker, 12, 0) | 0
  const dLvl = STATLIST_GetUnitStat113c(m, pDefender, 12, 0) | 0

  let ar = 0
  if (attType === UNIT_PLAYER) {
    if (isSgptDataTablesLoaded113c(m)) {
      const savedPenSp = k2RealStackPtr
      k2RealStackPtr = (savedPenSp + 0x10) >>> 0
      try {
        const tmpAr = UNITS_GetPlayerBaseToHit113c(m, pAttacker) | 0
        m.setU32(savedPenSp, tmpAr >>> 0)
        m.setU32((savedPenSp + 4) >>> 0, 0)
        SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(
          m,
          pAttacker,
          pDefender,
          savedPenSp,
          (savedPenSp + 4) >>> 0,
          true,
        )
      } finally {
        k2RealStackPtr = savedPenSp
      }
      if (defType === UNIT_MONSTER) {
        const defMonRow = getMonStatsRecordPtrSafeK2(m, m.get(pDefender, D2UnitStrc.dwClassId) | 0)
        if (defMonRow !== 0 && ((m.u16((defMonRow + 0x1c) >>> 0) << 16) >> 16) > 0) {
          const savedHitSp = k2RealStackPtr
          k2RealStackPtr = (savedHitSp + 0x400) >>> 0
          try {
            STATLIST_GetExtendedUnitStatsById113c(m, pAttacker, 0xb3, savedHitSp, 0x80)
          } finally {
            k2RealStackPtr = savedHitSp
          }
        }
      }
    }
    const dex = STATLIST_GetUnitStat113c(m, pAttacker, 2, 0) | 0
    const flatAr = STATLIST_GetUnitStat113c(m, pAttacker, 19, 0) | 0
    const classId = m.get(pAttacker, D2UnitStrc.dwClassId) >>> 0
    const toHitFactor = getCharStatsPure113c(classId).toHitFactor | 0
    const baseAr = (dex * 5 - 35 + toHitFactor + flatAr) | 0
    const pWeapon = getEquippedWeaponK2(m, pAttacker)
    const masteryArPct = getWeaponMasteryBonusK2(m, pAttacker, pWeapon, 0)
    const pctAr =
      ((STATLIST_GetUnitStat113c(m, pAttacker, 119, 0) | 0) + (arBonusPct | 0) + masteryArPct) | 0
    ar = pctAr !== 0 ? (baseAr + mulDiv113c(pctAr, baseAr, 100)) | 0 : baseAr
    const arPerLvl = STATLIST_GetUnitStat113c(m, pAttacker, 224, 0) | 0
    if (arPerLvl > 0 && aLvl > 0) ar = (ar + ((arPerLvl * aLvl) >> 3)) | 0
  } else if (attType === UNIT_MONSTER) {
    const dex = STATLIST_GetUnitStat113c(m, pAttacker, 2, 0) | 0
    let statToHit = STATLIST_GetUnitStat113c(m, pAttacker, 19, 0) | 0
    if (statToHit <= 0 && dex === 0 && !isSgptDataTablesLoaded113c(m)) {
      statToHit = m.get(pAttacker, D2UnitStrc.dwClassId) === 1 ? 26 : 21
    }
    const baseAr = (statToHit + dex * 5 + (arBonusPct | 0)) | 0
    const pctAr = STATLIST_GetUnitStat113c(m, pAttacker, 119, 0) | 0
    ar = pctAr !== 0 ? (baseAr + mulDiv113c(pctAr, baseAr, 100)) | 0 : baseAr
  } else {
    ar = STATLIST_GetUnitStat113c(m, pAttacker, 19, 0) | 0
  }

  const hasFullDefenseTables = isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0
  let dr = 0
  let ignoreAc = STATLIST_GetUnitStat113c(m, pAttacker, 115, 0) > 0
  if (ignoreAc) {
    if (defType === UNIT_PLAYER) ignoreAc = false
    else if (defType === UNIT_MONSTER) {
      const monRow = getMonStatsRecordPtrSafeK2(m, m.get(pDefender, D2UnitStrc.dwClassId) | 0)
      if (
        (monRow !== 0 && (m.u8((monRow + 0x0c) >>> 0) & 0x40) !== 0) ||
        MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x0a) !== 0
      ) {
        ignoreAc = false
      }
    }
  }
  if (!ignoreAc) {
    if (defType === UNIT_PLAYER && (m.get(pDefender, D2UnitStrc.dwAnimMode) | 0) === 3) {
      if (hasFullDefenseTables) UNITS_GetVelocity113c(m, pDefender)
      dr = 0
    } else if (hasFullDefenseTables) {
      const bRanged = pDmg !== 0 && (m.get(pDmg, D2DamageStrc.dwHitFlags) & 0x80) !== 0
      dr =
        ((UNITS_GetVelocity113c(m, pDefender) | 0) +
          (STATLIST_GetUnitStat113c(m, pDefender, bRanged ? 32 : 33, 0) | 0)) |
        0
    } else {
      let baseAc = STATLIST_GetUnitStat113c(m, pDefender, 31, 0) | 0
      if (defType === UNIT_PLAYER) {
        const dex = STATLIST_GetUnitStat113c(m, pDefender, 2, 0) | 0
        baseAc = (baseAc + (dex >> 2)) | 0
      }
      if (pDmg !== 0) {
        const bRanged = (m.get(pDmg, D2DamageStrc.dwHitFlags) & 0x80) !== 0
        baseAc = (baseAc + (STATLIST_GetUnitStat113c(m, pDefender, bRanged ? 32 : 33, 0) | 0)) | 0
      }
      dr = baseAc
    }
  } else if (hasFullDefenseTables) {
    UNITS_GetVelocity113c(m, pDefender)
  }

  // 0x6FCFDFA2..0x6FCFDFB8: negative `dr` transfers `-dr` to `ar`; negative `ar` transfers `-ar` to `dr`.
  if (dr < 0) {
    ar = (ar - dr) | 0
    dr = 0
  }
  if (ar < 0) {
    dr = (dr - ar) | 0
    ar = 0
  }

  const denom = (ar + dr) | 0
  const arRatio = denom > 0 ? mulDiv113c(ar, 100, denom) : 0
  const lvlSum = (aLvl + dLvl) | 0
  const toHit = lvlSum > 0 ? Math.trunc((2 * aLvl * arRatio) / lvlSum) | 0 : 0
  return toHit < 5 ? 5 : toHit > 95 ? 95 : toHit
}

/** `@va D2Game:0x6FCFDE90` (`SUNITDMG_CheckToHit`). */
export function SUNITDMG_CheckToHit113c(
  m: Memory113c,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4 = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFDE90)
  if (dllAbi) {
    const att = arg1 >>> 0
    const def = arg2 >>> 0
    const arBonusPct = arg3 | 0
    const bRanged = arg4 | 0
    if (def === 0 || att === 0) return 0
    const dLvl = STATLIST_GetUnitStat113c(m, def, 0x0c, 0) | 0
    let defAc = UNITS_GetVelocity113c(m, def) | 0
    defAc = (defAc + (STATLIST_GetUnitStat113c(m, def, bRanged !== 0 ? 0x20 : 0x21, 0) | 0)) | 0
    const aLvl = STATLIST_GetUnitStat113c(m, att, 0x0c, 0) | 0
    let ar = 0
    let arPct = 0
    const savedSp = k2RealStackPtr
    const pPenBuf = savedSp >>> 0
    k2RealStackPtr = (savedSp + 0x408) >>> 0
    try {
      if (m.u32(att) === 0) {
        ar = UNITS_GetPlayerBaseToHit113c(m, att) | 0
        m.setU32(pPenBuf, ar >>> 0)
        m.setU32((pPenBuf + 4) >>> 0, defAc >>> 0)
        SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(m, att, def, pPenBuf, (pPenBuf + 4) >>> 0, true)
        ar = m.u32(pPenBuf) | 0
        defAc = m.u32((pPenBuf + 4) >>> 0) | 0
        if (bRanged === 0) {
          const wpn = PLAYER_GetEquippedWeapon113c(m, att) >>> 0
          if (wpn !== 0) {
            arPct = SKILLS_GetWeaponMasteryBonusMemPort113c(m, att, wpn, 0, 0) | 0
          }
        }
        arPct = (arPct + (STATLIST_GetUnitStatWithLayer113c(m, att, 0x77, 0) | 0) + arBonusPct) | 0
        if (m.u32(def) === 1) {
          const pMon = MONSTATS_GetRecordPtr113c(m, m.u32((def + 4) >>> 0) | 0) >>> 0
          if (pMon !== 0) {
            const monType = (m.u16((pMon + 0x1c) >>> 0) << 16) >> 16
            if (monType > 0) {
              const n = STATLIST_GetExtendedUnitStatsById113c(m, att, 0xb3, (pPenBuf + 8) >>> 0, 0x80) | 0
              for (let i = 0; i < n; i++) {
                const layer = m.u16((pPenBuf + 8 + i * 8) >>> 0)
                if (MONTYPE_TestNestedBit_6FC21620_113c(m, layer, monType) !== 0) {
                  arPct = (arPct + (m.u32((pPenBuf + 8 + i * 8 + 4) >>> 0) | 0)) | 0
                }
              }
            }
          }
        }
      } else {
        const flat13 = STATLIST_GetUnitStat113c(m, att, 0x13, 0) | 0
        const dex2 = STATLIST_GetUnitStat113c(m, att, 2, 0) | 0
        ar = (flat13 + arBonusPct + imul32(dex2, 5)) | 0
        arPct = STATLIST_GetUnitStatWithLayer113c(m, att, 0x77, 0) | 0
      }
    } finally {
      k2RealStackPtr = savedSp
    }
    ar = (ar + (mulDiv113c(arPct, ar, 100) | 0)) | 0
    if (defAc < 0) {
      ar = (ar - defAc) | 0
      defAc = 0
    }
    if (ar < 0) {
      defAc = (defAc - ar) | 0
      ar = 0
    }
    const sum = (defAc + ar) | 0
    const arRatio = sum === 0 ? 100 : (sdiv32(imul32(ar, 100), sum) | 0)
    const lvlSum = (aLvl + dLvl) | 0
    let chance = lvlSum !== 0 ? (sdiv32(imul32(arRatio, aLvl) << 1, lvlSum) | 0) : 0
    if (chance <= 5) chance = 5
    else if (chance >= 0x5f) chance = 0x5f
    const rem = (stepSeedMemK2(m, (att + 0x20) >>> 0) >>> 0) % 100
    if (rem >= chance) return 0
    SUNITDMG_TriggerAttackerBlindOrFlee113c(m, 0, att, def, 0, true)
    return 1
  }
  let pGame = 0
  let pAttacker = arg1 >>> 0
  let pDefender = arg2 >>> 0
  let pDmg = arg3 >>> 0
  let arBonusPct = arg4 | 0

  // Detect 5-arg `(m, pGame, pAttacker, pDefender, arBonus)` vs `(m, pAttacker, pDefender, pDmg, arBonus)`
  if (
    arg1 !== 0 &&
    arg2 !== 0 &&
    arg3 !== 0 &&
    safeReadU32K2(m, arg2 >>> 0) <= 5 &&
    safeReadU32K2(m, arg3 >>> 0) <= 5 &&
    (safeReadU32K2(m, (arg2 + 0x80) >>> 0) === (arg1 >>> 0) ||
      safeReadU32K2(m, (arg3 + 0x80) >>> 0) === (arg1 >>> 0) ||
      safeReadU32K2(m, arg1 >>> 0) > 5)
  ) {
    pGame = arg1 >>> 0
    pAttacker = arg2 >>> 0
    pDefender = arg3 >>> 0
    pDmg = 0
    arBonusPct = arg4 | 0
  }

  if (pAttacker === 0 || pDefender === 0) return 0

  // Running player defense bypass (`0x6FCFE5F1`: `pDefender->dwUnitType == 0 && pDefender->dwAnimMode == 3`)
  const defType = m.u32(pDefender) >>> 0
  if (defType === UNIT_PLAYER && (m.get(pDefender, D2UnitStrc.dwAnimMode) | 0) === 3) {
    if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
      UNITS_GetVelocity113c(m, pDefender)
    }
    if (pDmg !== 0) {
      m.set(pDmg, D2DamageStrc.wResultFlags, (m.get(pDmg, D2DamageStrc.wResultFlags) | 0x01) >>> 0)
      if (rollShieldBlockAndAvoidanceOnDmgK2(m, pAttacker, pDefender, pDmg) !== 0) {
        return 0
      }
    }
    return 1
  }

  const toHit = SUNITDMG_ComputeHitChance113c(m, pGame, pAttacker, pDefender, arBonusPct, pDmg)
  const roll = rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100)
  const hit = (roll | 0) < toHit ? 1 : 0
  if (pDmg !== 0) {
    if (hit !== 0) {
      m.set(pDmg, D2DamageStrc.wResultFlags, (m.get(pDmg, D2DamageStrc.wResultFlags) | 0x01) >>> 0)
      if (rollShieldBlockAndAvoidanceOnDmgK2(m, pAttacker, pDefender, pDmg) !== 0) {
        return 0
      }
    } else {
      m.set(pDmg, D2DamageStrc.wResultFlags, (m.get(pDmg, D2DamageStrc.wResultFlags) & ~0x01) >>> 0)
    }
  }
  return hit
}

/**
 * `@va D2Game:0x6FCFE6D0` (`SUNITDMG_AddPlayerExperienceAndCheckLevelUp`, `127B`):
 * Adds `xpGain` to `STAT_EXPERIENCE (13)`, loops across `EXPERIENCE_THRESHOLDS_113C` (`Level 1..99`) to advance
 * `STAT_LEVEL (12)`, awards `+5 STAT_STATPTS (4)` and `+1 STAT_SKILLPTS (5)` plus `CharStatsTxt` `LifePerLevel` /
 * `StaminaPerLevel` / `ManaPerLevel` (`<< 6`) per level gained, updates `STAT_NEXTEXP (14)`, and queues `0x1D`/`0x1E`/`0x1F`
 * stat updates to `pClient` (`0x6FCAA3E0`).
 */
export function SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  xpGain: number,
  bSuppressS2c = false,
  nOldLevel?: number,
): number {
  hitD2GameVa113c(0x6FCFE6D0)
  if (pPlayer === 0 || m.u32(pPlayer) !== UNIT_PLAYER) return 0
  const pExpBin = safeReadU32K2(m, 0x6fdf0b50)
  const hasExpBin = pExpBin !== 0 && safeReadU32K2(m, (pExpBin + 0x60) >>> 0) !== 0
  const expClassId = m.u32((pPlayer + 4) >>> 0) | 0
  if (hasExpBin) {
    const oldExp = STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x0d, 0) >>> 0
    const maxLvl = DATATBLS_GetMaxLevel113c(m, expClassId) | 0
    const maxCap = DATATBLS_GetStartExpForLevel113c(m, expClassId, (maxLvl - 1) | 0) >>> 0
    let nextExp = (oldExp + (xpGain | 0)) >>> 0
    if (nextExp > maxCap) nextExp = maxCap
    STATLIST_SetUnitStat113c(m, pPlayer, 0x1d, (nextExp - oldExp) | 0, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0d, nextExp | 0, 0)
    const newLvl = DATATBLS_GetCurrentLevelFromExp113c(m, expClassId, nextExp) | 0
    const prevLvl =
      nOldLevel !== undefined
        ? (nOldLevel | 0)
        : (STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x0c, 0) | 0)
    if (prevLvl !== newLvl) {
      PLAYER_LevelUp_6FD0B090_113c(m, pPlayer, pGame >>> 0)
      SUNIT_DispatchItemEventCallbacks113c(m, pPlayer, pGame >>> 0, 0x0c, 0, 0)
    }
    return nextExp >>> 0
  }

  if ((xpGain | 0) <= 0) {
    return 0
  }

  let curLvl =
    nOldLevel !== undefined
      ? (nOldLevel | 0)
      : (STATLIST_GetUnitStat113c(m, pPlayer, 12, 0) | 0)
  if (curLvl < 1) curLvl = 1
  if (curLvl >= 99) return STATLIST_GetUnitStat113c(m, pPlayer, 13, 0) >>> 0

  const curExp = STATLIST_GetUnitStat113c(m, pPlayer, 13, 0) >>> 0
  const maxCap = EXPERIENCE_THRESHOLDS_113C[98]! >>> 0
  let nextExp = curExp + (xpGain >>> 0)
  if (nextExp > maxCap) nextExp = maxCap
  STATLIST_SetUnitStat113c(m, pPlayer, 0x1d, (nextExp - curExp) | 0, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 13, nextExp | 0, 0)

  const pClient = bSuppressS2c ? 0 : getPlayerClientPtrK2(m, pPlayer)
  if (pClient !== 0 && m.u32((pClient + 0x04) >>> 0) === 4) {
    S2C_SendPacket1D_1E_1F_SetAttribute113c(m, pClient, 13, nextExp >>> 0)
  }

  let newLvl = curLvl
  while (newLvl < 99 && nextExp >= (EXPERIENCE_THRESHOLDS_113C[newLvl]! >>> 0)) {
    newLvl++
  }

  if (newLvl > curLvl) {
    const gained = newLvl - curLvl
    const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
    const cs = getCharStatsPure113c(classId)
    const hpPerLvl = cs.lifePerLevel !== undefined ? cs.lifePerLevel : 8
    const stamPerLvl = cs.staminaPerLevel !== undefined ? cs.staminaPerLevel : 4
    const manaPerLvl = cs.manaPerLevel !== undefined ? cs.manaPerLevel : 4
    const hpAdd = (hpPerLvl << 6) * gained
    const stamAdd = (stamPerLvl << 6) * gained
    const manaAdd = (manaPerLvl << 6) * gained

    STATLIST_SetUnitStat113c(m, pPlayer, 12, newLvl, 0)
    const nextThreshold = newLvl < 99 ? (EXPERIENCE_THRESHOLDS_113C[newLvl]! | 0) : (maxCap | 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x1e, nextThreshold, 0)
    STATLIST_AddUnitStat113c(m, pPlayer, 4, 5 * gained, 0)
    STATLIST_AddUnitStat113c(m, pPlayer, 5, gained, 0)
    STATLIST_AddUnitStat113c(m, pPlayer, 7, hpAdd, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 6, STATLIST_GetMaxLifeFromUnit113c(m, pPlayer) | 0, 0)
    STATLIST_AddUnitStat113c(m, pPlayer, 9, manaAdd, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 8, STATLIST_GetUnitStat113c(m, pPlayer, 9, 0) | 0, 0)
    STATLIST_AddUnitStat113c(m, pPlayer, 11, stamAdd, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 10, STATLIST_GetUnitStat113c(m, pPlayer, 11, 0) | 0, 0)
    SUNIT_DispatchItemEventCallbacks113c(m, pPlayer, pGame >>> 0, 0x0c, 0, 0)

    if (pClient !== 0 && m.u32((pClient + 0x04) >>> 0) === 4) {
      S2C_SendPacket1D_1E_1F_SetAttribute113c(m, pClient, 12, newLvl)
      S2C_SendPacket1D_1E_1F_SetAttribute113c(m, pClient, 4, STATLIST_GetUnitStat113c(m, pPlayer, 4, 0) >>> 0)
      S2C_SendPacket1D_1E_1F_SetAttribute113c(m, pClient, 5, STATLIST_GetUnitStat113c(m, pPlayer, 5, 0) >>> 0)
    }
  }
  return nextExp >>> 0
}

/**
 * `@va D2Game:0x6FCFE8F0` (`SUNITDMG_DistributePartyExperience` / `SUNITDMG_ComputeExperienceGain`, `261B`):
 * Exact 1.13c party experience distribution:
 * - Allocates 19-dword `D2PartyExpStrc` (`+0x00=pMonster`, `+0x04..+0x20=pMembers[8]`, `+0x24..+0x40=nLevels[8]`,
 *   `+0x44=nCount`, `+0x48=nTotalLevel`), collects same-level party members within `0x1900` dist² via
 *   `PARTY_ForEachPartyMemberInSameLevel113c` (`0x6FCBC070`) + `SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c` (`0x6FCFAED0`).
 * - `nCount <= 0 || nTotalLevel <= 0`: returns `0`.
 * - `nCount == 1`: scales via `SUNITDMG_GetTotalSkillDamageBonus113c` (`0x6FCFC030`) and grants via
 *   `SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c` (`0x6FCFE6D0`).
 * - `nCount > 1`: applies `+((nCount - 1) * baseExp * 0x59) / 256` party bonus (`sar 8` with negative bias),
 *   computes `float32(totalExp / nTotalLevel)`, and grants each collected member `trunc(nLevels[i] * expPerLevel)`.
 * - Legacy 5-arg pure-compute call (omitting `pMonster`) preserves scalar return for existing unit callers.
 */
export function SUNITDMG_ComputeExperienceGain113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mlvl: number,
  baseExp: number,
  pMonster?: number,
  bSuppressS2c = false,
  nPlayerLvl?: number,
): number {
  hitD2GameVa113c(0x6FCFE8F0)
  if (pMonster === undefined) {
    if (pPlayer === 0 || (baseExp | 0) <= 0) return 0
    const clvl =
      nPlayerLvl !== undefined ? (nPlayerLvl | 0) : (STATLIST_GetUnitStat113c(m, pPlayer, 12, 0) | 0)
    const addExpPct = STATLIST_GetUnitStat113c(m, pPlayer, 85, 0) | 0
    return calculateKillExperienceGainPure113c({
      rawExp: baseExp | 0,
      clvl: clvl > 0 ? clvl : 1,
      mlvl: mlvl > 0 ? mlvl : 1,
      addExpPct,
    })
  }
  const savedSp = k2RealStackPtr
  const pExpCtx = k2RealStackPtr
  k2RealStackPtr = (savedSp + 0x50) >>> 0
  try {
    for (let i = 0; i < 0x13; i++) {
      m.setU32((pExpCtx + i * 4) >>> 0, 0)
    }
    m.setU32(pExpCtx, pMonster >>> 0)
    PARTY_ForEachPartyMemberInSameLevel113c(
      m,
      pPlayer >>> 0,
      pGame >>> 0,
      (mem, cbGame, cbMember, cbArg) => {
        SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c(
          mem,
          cbGame,
          cbMember,
          cbArg,
        )
      },
      pExpCtx,
    )
    const nCount = m.u32((pExpCtx + 0x44) >>> 0) | 0
    const nTotalLevel = m.u32((pExpCtx + 0x48) >>> 0) | 0
    if (nCount <= 0 || nTotalLevel <= 0) {
      return 0
    }
    const rawBase = baseExp | 0
    if (nCount === 1) {
      const killerLvl =
        nPlayerLvl !== undefined ? (nPlayerLvl | 0) : (STATLIST_GetUnitStat113c(m, pPlayer, 12, 0) | 0)
      const addExpPct = STATLIST_GetUnitStat113c(m, pPlayer, 85, 0) | 0
      const gain = SUNITDMG_GetTotalSkillDamageBonus113c(m, pPlayer, 0, {
        rawExp: rawBase,
        clvl: killerLvl > 0 ? killerLvl : 1,
        mlvl,
        addExpPct,
      })
      SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(
        m,
        pGame,
        pPlayer,
        gain,
        bSuppressS2c,
        killerLvl,
      )
      return gain
    }
    const bonusNum = Math.imul(Math.imul(nCount - 1, rawBase), 0x59)
    const totalExp = (sdiv32(bonusNum, 256) + rawBase) | 0
    const expPerLevel = Math.fround(totalExp / nTotalLevel)
    let killerGain = 0
    for (let i = 0; i < nCount; i++) {
      const pMember = m.u32((pExpCtx + 0x04 + i * 4) >>> 0) >>> 0
      const memberLvl = m.u32((pExpCtx + 0x24 + i * 4) >>> 0) | 0
      const share = Math.trunc(memberLvl * expPerLevel) | 0
      const addExpPct = STATLIST_GetUnitStat113c(m, pMember, 85, 0) | 0
      const gain = SUNITDMG_GetTotalSkillDamageBonus113c(m, pMember, 0, {
        rawExp: share,
        clvl: memberLvl > 0 ? memberLvl : 1,
        mlvl,
        addExpPct,
      })
      SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(
        m,
        pGame,
        pMember,
        gain,
        bSuppressS2c,
        memberLvl,
      )
      if (pMember === (pPlayer >>> 0)) {
        killerGain = gain
      }
    }
    return killerGain
  } finally {
    k2RealStackPtr = savedSp
  }
}

/**
 * `@va D2Game:0x6FCFEBA0` (`SUNITDMG_ApplyWeaponAndArmorDurabilityLoss`, `387B`):
 * Exact 1.13c weapon + 7-slot circular weighted armor durability roll (`D2Game.dll:0x6FD2E628`):
 * - Attacker player (`pWeaponItem` or active hand weapon): calls `0x6FC32EE0` (`4%` chance on melee, `10%` throw in expansion)
 *   and queues `34`-byte `0x3E` (`NET_SendPacket0x3E_ItemStatBitStream113c`) when `STAT_DURABILITY (72)` drops.
 * - Defender player (`pDefender->dwUnitType == 0`): inspects the 7 armor slots in `D2GAME_ARMOR_DURABILITY_SLOTS_6FD2E62C`
 *   (`[1:3, 3:5, 4:4, 5:4, 8:2, 9:2, 10:2]`) for `ITYPE_ANY_ARMOR (50)`, draws `idx = SEED_RollLimited(pDefender->pSeed, 7)`
 *   and `pick = SEED_RollLimited(pDefender->pSeed, totalWeight)`, walks circularly `(idx + 1) % 7` subtracting slot weight
 *   until `pick < slotWeight`, and calls `0x6FC32EE0` (`10%` roll) + `0x3E` sync.
 */
export function SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pWeaponItem = 0,
  hooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FCFEBA0)
  const effHooks = hooks !== undefined ? hooks : k2DefaultSUnitDmgHooks
  const suppressS2c = effHooks !== undefined && effHooks.suppressDirectS2c === true
  let lost = 0

  if (pAttacker !== 0 && m.u32(pAttacker) === UNIT_PLAYER) {
    const wpn = pWeaponItem !== 0 ? pWeaponItem : getEquippedWeaponK2(m, pAttacker)
    if (wpn !== 0) {
      const beforeDur = STATLIST_GetUnitStat113c(m, wpn, 72, 0) | 0
      const usedRealDurFn = isSgptDataTablesLoaded113c(m) && isItemRatioTableLoaded113c(m)
      if (usedRealDurFn) {
        ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c(m, pGame, pAttacker, wpn)
      } else {
        applySingleItemDurabilityLossK2(m, pGame, pAttacker, wpn, 0)
      }
      const afterDur = STATLIST_GetUnitStat113c(m, wpn, 72, 0) | 0
      if (afterDur !== beforeDur) {
        lost = 1
        if (!usedRealDurFn && !suppressS2c) {
          const pAttClient = getPlayerClientPtrK2(m, pAttacker)
          if (pAttClient !== 0 && m.u32((pAttClient + 0x04) >>> 0) === 4) {
            NET_SendPacket0x3E_ItemStatBitStream113c(m, wpn, 0, pAttClient, 1, 72, afterDur)
          }
        }
      }
    } else if (
      m.get(pAttacker, D2UnitStrc.pInventory) === 0 &&
      (STATLIST_GetUnitStat113c(m, pAttacker, 21, 0) | 0) > 0
    ) {
      rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100)
    }
  }

  if (pDefender !== 0 && m.u32(pDefender) === UNIT_PLAYER) {
    const pInv = m.get(pDefender, D2UnitStrc.pInventory)
    if (pInv === 0) {
      if ((STATLIST_GetUnitStat113c(m, pDefender, 31, 0) | 0) > 0) {
        rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, 7)
        rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, 4)
        rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, 100)
      }
      return lost
    }
    const slotItems = [0, 0, 0, 0, 0, 0, 0]
    const slotWeights = [0, 0, 0, 0, 0, 0, 0]
    let totalWeight = 0
    for (let i = 0; i < D2GAME_ARMOR_DURABILITY_SLOTS_6FD2E62C.length; i++) {
      const [bodyLoc, weight] = D2GAME_ARMOR_DURABILITY_SLOTS_6FD2E62C[i]!
      const pItem = findItemInInventoryByBodyLocK2(m, pInv, bodyLoc)
      if (
        pItem === 0 ||
        (checkItemTypePureOrMemK2(m, pItem, 50) === 0 && ITEMS_CheckItemTypeIdMem113c(m, pItem, 2) === 0)
      ) {
        continue
      }
      slotItems[i] = pItem
      slotWeights[i] = weight
      totalWeight += weight
    }
    if (totalWeight <= 0) return lost

    let idx = (rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, 7) >>> 0) % 7
    let pick = rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, totalWeight) | 0
    while (pick >= slotWeights[idx]!) {
      pick -= slotWeights[idx]!
      idx = (idx + 1) % 7
    }
    const chosen = slotItems[idx]!
    if (chosen !== 0) {
      const beforeDur = STATLIST_GetUnitStat113c(m, chosen, 72, 0) | 0
      const usedRealDurFn = isSgptDataTablesLoaded113c(m) && isItemRatioTableLoaded113c(m)
      if (usedRealDurFn) {
        ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c(m, pGame, pDefender, chosen)
      } else {
        applySingleItemDurabilityLossK2(m, pGame, pDefender, chosen, 0)
      }
      const afterDur = STATLIST_GetUnitStat113c(m, chosen, 72, 0) | 0
      if (afterDur !== beforeDur) {
        lost = 1
        if (!usedRealDurFn && !suppressS2c) {
          const pDefClient = getPlayerClientPtrK2(m, pDefender)
          if (pDefClient !== 0 && m.u32((pDefClient + 0x04) >>> 0) === 4) {
            NET_SendPacket0x3E_ItemStatBitStream113c(m, chosen, 0, pDefClient, 1, 72, afterDur)
          }
        }
      }
    }
  }
  return lost
}

/**
 * `@va D2Game:0x6FCEBBB0` (`SUNITDMG_ApplyArmorDurabilityAndGetHit`, `179B`):
 * Triggers armor durability loss on melee hits, applies `RESULTFLAG_GETHIT (0x04)` (`PLRMODE_GETHIT = 4` /
 * `MONMODE_GETHIT = 3`), and when `pDefender` is a player entering GetHit (`0x6FCEBBDA`), broadcasts `13`-byte
 * S2C `0x0D` (`PlayerStop`, `mode = 0x13`, `hitClass`, `lifePct`) to in-room clients via `0x6FCAA3E0`!
 */
export function SUNITDMG_ApplyArmorDurabilityAndGetHit113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  pClientOnly = 0,
): void {
  hitD2GameVa113c(0x6FCEBBB0)
  if (pDefender === 0) return
  // 0x6FC98A11 (`UNIT_SyncStateAndStatsToClient` `dwFlags & 0x8000`) -> exact 13-byte `0x0D` `0x13` sync to `pClientOnly`
  // (plus `0x6FCED2C0` / `0x6FC9B0A0` + `0x6FCEB950` player death & corpse sync when `dwAnimMode` is `0` or `0x11`).
  if (pDmg === 0 && pClientOnly !== 0) {
    const pPath = m.get(pDefender, D2UnitStrc.pPath)
    const wX = pPath !== 0 ? (PATH_GetPosX113c(m, pPath) & 0xffff) : 0
    const wY = pPath !== 0 ? (PATH_GetPosY113c(m, pPath) & 0xffff) : 0
    const uId = m.get(pDefender, D2UnitStrc.dwUnitId) >>> 0
    const hitClass = m.u8((pDefender + 0xb0) >>> 0)
    const lifePct = STATLIST_GetUnitLifePercent113c(m, pDefender) & 0xff
    const emit0D = (actionByte: number): void => {
      const pkt = new Uint8Array(13)
      pkt[0] = 0x0d
      pkt[1] = 0x00
      pkt[2] = uId & 0xff
      pkt[3] = (uId >>> 8) & 0xff
      pkt[4] = (uId >>> 16) & 0xff
      pkt[5] = (uId >>> 24) & 0xff
      pkt[6] = actionByte & 0xff
      pkt[7] = wX & 0xff
      pkt[8] = (wX >>> 8) & 0xff
      pkt[9] = wY & 0xff
      pkt[10] = (wY >>> 8) & 0xff
      pkt[11] = hitClass
      pkt[12] = lifePct
      NET_QueuePacketToClient113c(m, pClientOnly, pkt)
    }
    emit0D(0x13)
    return
  }
  if (pGame === 0 || pDmg === 0) return
  const hitFlags = m.get(pDmg, D2DamageStrc.dwHitFlags) >>> 0
  if ((hitFlags & 0x80) === 0) {
    SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(m, pGame, 0, pDefender, 0)
  }

  if (SUNIT_IsDeadOrDying113c(m, pDefender) !== 0) return
  const resFlags = m.get(pDmg, D2DamageStrc.wResultFlags) >>> 0
  if ((resFlags & 0x04) === 0) return

  const defType = m.u32(pDefender) >>> 0
  const hitClass = m.get(pDmg, D2DamageStrc.dwHitClass) & 0xff
  if (defType === UNIT_MONSTER) {
    MONSTER_StartMode113c(m, pGame, pDefender, 3, pAttacker, 0, 0)
    let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pClient !== 0) {
      if (m.u32((pClient + 0x04) >>> 0) === 4) {
        S2C_SendPacket0C_NpcHit113c(m, pClient, pDefender, 0x13, hitClass)
      }
      pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    }
  } else if (defType === UNIT_PLAYER) {
    PLAYER_StartModeSkill113c(m, pGame, pDefender, 4, pAttacker, '1HS')
    let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pClient !== 0) {
      if (m.u32((pClient + 0x04) >>> 0) === 4) {
        S2C_SendPacket0D_PlayerStop113c(m, pClient, pDefender, 0x13, hitClass)
      }
      pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    }
  }
}

/**
 * `@va D2Game:0x6FCFE0C0` (`SUNITDMG_ApplyDamage`, `692B`):
 * Exact 1.13c damage application (`D2Game.dll:0x6FCFE0C0`):
 * - Hostility (`0x6FD00A60`) & town (`D2Common.#10057` `0x6FD8C390`) & `MonStats.killable` (`0x6FC215D0`) checks.
 * - Optional `bApplyResists` (`0x6FCFC0B0` `SUNITDMG_ApplyResistancesAndAbsorb113c`).
 * - Pre-HP item events `1`/`5` (melee) or `2`/`6` (`bApplyResists && (dwHitFlags & 0x20)`).
 * - Clamps `dwPhysDamage = min(dwPhysDamage, curHp)` (`0x6FCFE205`), dispatches monster minion hit callback (`3`),
 *   subtracts `dwDmgTotal` from `STAT_HITPOINTS (6)` with **`newHp < 0x100 -> 0` fixed-point death clamp at `0x6FCFE255`**.
 * - Applies Life/Mana/Stamina Steal (`0x6FCFBA40`), Cold/Freeze/Burn (`0x6FCFDAC0`/`0x6FCFC780`/`0x6FCFC940`),
 *   Poison (`0x6FCFCAB0`), Stun (`0x6FCFCC20`), Blind/Flee (`0x6FCFCE70`), Prevent Monster Heal (`116 -> 113`),
 *   Mana Burn / Damage-to-Mana (`114`), and `-Monster Defense Per Hit` (`dwPiercePct`).
 * - Reschedules monster `Event 3` when `STAT_HPREGEN (74) != 0` (`0x6FCFE2E2..0x6FCFE336`) else `STATES_ClearCurseStatesOnUnit113c`,
 *   sets `RESULTFLAG_DEATH (0x02)` or `RESULTFLAG_GETHIT (0x04)`, and dispatches kill item events `10` / `9`.
 */
export function SUNITDMG_ApplyDamage113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  bApplyResists = 1,
  hooks?: SUnitDmgHooks113c,
  bDeferPostResultTo6FCFCF20 = 0,
): number {
  hitD2GameVa113c(0x6FCFE0C0)
  if (pDefender === 0 || pDmg === 0) return 0
  const effHooks = hooks !== undefined ? hooks : k2DefaultSUnitDmgHooks
  const def = pDefender >>> 0
  const att = pAttacker >>> 0
  const g = pGame >>> 0
  const dmg = pDmg >>> 0
  const combatFlags = m.get(dmg, D2DamageStrc.dwHitFlags) >>> 0
  const hasHydratedGdw =
    safeReadU32K2(m, D2GAME_IAT_GDW_BITMASKS_VA_113C) !== 0 && isItemRatioTableLoaded113c(m)

  if (att !== 0 && att !== def && g !== 0 && safeReadU32K2(m, 0x6fde9e1c) !== 0 && hasHydratedGdw) {
    const hostile = SUNIT_AreUnitsHostileOrUnaligned113c(m, att, def, g)
    if (hostile === 0 && (combatFlags & 0x1000) === 0) {
      m.setU8((dmg + 0x04) >>> 0, m.u8((dmg + 0x04) >>> 0) & 0xfc)
      return 0
    }
  }

  const pDefRoom = UNITS_GetRoom113c(m, def)
  if (pDefRoom === 0) {
    if (hasHydratedGdw) {
      m.setU8((dmg + 0x04) >>> 0, m.u8((dmg + 0x04) >>> 0) & 0xfc)
      return 0
    }
  } else if (checkRoomIsTownSafeK2(m, pDefRoom) !== 0) {
    let allowTownDmg = 0
    if (att !== 0 && m.u32(att) === UNIT_MONSTER) {
      const pAttMonTxt = getMonStatsRecordPtrSafeK2(m, m.u32((att + 4) >>> 0) | 0)
      if (pAttMonTxt !== 0 && (m.u8((pAttMonTxt + 0x0d) >>> 0) & 0x01) !== 0) {
        allowTownDmg = 1
      }
    }
    if (allowTownDmg === 0) {
      m.setU8((dmg + 0x04) >>> 0, m.u8((dmg + 0x04) >>> 0) & 0xfd)
      return 0
    }
  }

  const defType = m.u32(def) >>> 0
  if (defType === UNIT_MONSTER && hasHydratedGdw) {
    if (MONSTATS_CheckFlagBit113c(m, m.u32((def + 4) >>> 0) | 0, 0x0f) === 0) return 0
  }
  if (SUNIT_IsDeadOrDying113c(m, def) !== 0) return 0
  UNITS_SetOwner113c(m, def, att)

  let resFlags = m.get(dmg, D2DamageStrc.wResultFlags) >>> 0
  if ((resFlags & 0x01) === 0 && (combatFlags & 0x1000) === 0 && bApplyResists === 0) return 0

  if (bApplyResists !== 0) {
    const bSkipMeleeDotPreScaled = effHooks !== undefined && effHooks.onApplyPoison !== undefined
    SUNITDMG_ApplyResistancesAndAbsorb113c(m, att, def, dmg, g, false, bSkipMeleeDotPreScaled)
    resFlags = m.get(dmg, D2DamageStrc.wResultFlags) >>> 0
  }

  if ((resFlags & 0x10) !== 0 && bApplyResists === 0) {
    return 0
  }

  // 0x6FCFE195..0x6FCFE1EC: pre-damage item events `1`/`5` (melee) or `2`/`6` (`bApplyResists` + missile `0x20`)
  if ((resFlags & 0x01) !== 0) {
    if (effHooks !== undefined && effHooks.onDamagedInMeleeEvents !== undefined) {
      effHooks.onDamagedInMeleeEvents(m, g, att, def, dmg)
    } else if (g !== 0 && (resFlags & 0x20) === 0) {
      if (bApplyResists !== 0) {
        if ((combatFlags & 0x20) !== 0) {
          if ((combatFlags & 0x80) === 0 && att !== 0) {
            dispatchItemEventsSafeK2(m, att, g, 6, def, dmg)
          }
          dispatchItemEventsSafeK2(m, def, g, 2, att, dmg)
        }
      } else {
        if (att !== 0) {
          dispatchItemEventsSafeK2(m, att, g, 5, def, dmg)
        }
        dispatchItemEventsSafeK2(m, def, g, 1, att, dmg)
      }
    }
  }

  const oldHp = STATLIST_GetUnitStat113c(m, def, 6, 0) | 0
  const clampedOldHp = oldHp > 0 ? oldHp : 0
  let phys = m.get(dmg, D2DamageStrc.dwPhysDamage) | 0
  if (phys > clampedOldHp) {
    phys = clampedOldHp
    m.set(dmg, D2DamageStrc.dwPhysDamage, phys >>> 0)
  }

  const fire = m.get(dmg, D2DamageStrc.dwFireDamage) | 0
  const burn = m.get(dmg, D2DamageStrc.dwBurnDamage) | 0
  const burnLen = m.get(dmg, D2DamageStrc.dwBurnLen) | 0
  const ltng = m.get(dmg, D2DamageStrc.dwLtngDamage) | 0
  const mag = m.get(dmg, D2DamageStrc.dwMagDamage) | 0
  const cold = m.get(dmg, D2DamageStrc.dwColdDamage) | 0
  const pois = m.get(dmg, D2DamageStrc.dwPoisDamage) | 0
  const poisLen = m.get(dmg, D2DamageStrc.dwPoisLen) | 0
  const inlineBurn = !isSgptDataTablesLoaded113c(m) && burnLen <= 0 && burn > 0 ? burn : 0
  const inlinePois = poisLen <= 0 || bApplyResists !== 0 ? pois : 0
  const channelSum = (phys + fire + inlineBurn + ltng + mag + cold + inlinePois) | 0
  const presetTotal = m.get(dmg, D2DamageStrc.dwDmgTotal) | 0
  // 0x6FCFE242: `mov edi, [ebp+0x4c]` reads `dwDmgTotal` directly rather than re-summing
  // `dwPhysDamage` (e.g., `0x6FC4755B` Bash adds `calc2 << 8` to `+0x08` after `0x6FCFDDE0`).
  const hitTotal = presetTotal > 0 ? presetTotal : channelSum > 0 ? channelSum : 0
  if (presetTotal <= 0) {
    m.set(dmg, D2DamageStrc.dwDmgTotal, hitTotal >>> 0)
  }

  // Mana burn & Damage Taken Goes To Mana (`STAT_ITEM_DAMAGETOMANA = 114`)
  const dmgToMana = STATLIST_GetUnitStat113c(m, def, 114, 0) | 0
  if (dmgToMana > 0 && hitTotal > 0 && defType === UNIT_PLAYER && safeReadU32K2(m, (def + 0x90) >>> 0) === 0) {
    const manaGain = mulDiv113c(dmgToMana, hitTotal, 100)
    if (manaGain > 0) {
      SUNITDMG_AddLeechedLifeToUnit113c(m, def, 8, 9, manaGain)
    }
  }

  // -Monster Defense Per Hit (`dwPiercePct` when used as melee AC shred)
  if (bApplyResists === 0) {
    const acShred = m.get(dmg, D2DamageStrc.dwPiercePct) | 0
    if (acShred > 0 && defType === UNIT_MONSTER) {
      const curAc = STATLIST_GetUnitStat113c(m, def, 31, 0) | 0
      const nextAc = curAc > acShred ? curAc - acShred : 0
      STATLIST_SetUnitStat113c(m, def, 31, nextAc, 0)
    }
  }

  // 0x6FCFE226: monster attacker minion hit callback (`slot = 3`)
  if (att !== 0 && m.u32(att) === UNIT_MONSTER && (m.u8((dmg + 0x04) >>> 0) & 0x01) !== 0) {
    if (effHooks !== undefined && effHooks.onMonsterAttackerHit !== undefined) {
      effHooks.onMonsterAttackerHit(m, g, att)
    } else if (g !== 0) {
      MONSTER_DispatchMinionComponentCallbacks113c(m, g, att, 3)
    }
  }

  // 0x6FCFE23D: `SUNITDMG_AddLeechedLifeToUnit(pDefender, dwAbsorbLife)` (no-op when <= 0; avoids double heal if ApplyResistances already healed)
  const absorbLifeInDmg = m.get(dmg, D2DamageStrc.dwAbsorbLife) | 0
  if (absorbLifeInDmg <= 0) {
    SUNITDMG_AddLeechedLifeToUnit113c(m, def, 6, 7, 0)
  }

  // 0x6FCFE23D..0x6FCFE25F: subtract HP with `< 0x100 -> 0` fixed-point clamp at `0x6FCFE255`
  if (hitTotal > 0) {
    const curHpNow = STATLIST_GetUnitStat113c(m, def, 6, 0) | 0
    let nextHp = (curHpNow - (hitTotal < curHpNow ? hitTotal : curHpNow)) | 0
    if (nextHp < 0x100) nextHp = 0
    STATLIST_SetUnitStat113c(m, def, 6, nextHp, 0)
  }

  // 0x6FCFE26E..0x6FCFE276: unconditional mana/stamina drain calls (`<= 0` guard inside callee;
  // attacker leech/stamina-drain `%` in `+0x3C`/`+0x40` is applied in `SUNITDMG_ApplyLifeManaSteal113c` below)
  SUNITDMG_ConsumeManaCost113c(m, def, 0)
  SUNITDMG_ConsumeStaminaCost113c(m, def, 0)

  // Non-lethal & elemental timed states + leech (`0x6FCFBA40`, `0x6FCFCC20`, `0x6FCFC780`, `0x6FCFDAC0`, `0x6FCFCAB0`, `0x6FCFC940`)
  if (att !== 0) {
    if (hasHydratedGdw && g !== 0 && isSgptDataTablesLoaded113c(m)) {
      if (STATES_CheckState113c(m, def, 58) !== 0 && phys > 0) {
        SUNITDMG_AddLeechedLifeToUnit113c(m, att, 6, 7, phys >> 1, true)
        STATES_SetMonsterSkillIconOnUnit113c(m, att, 0x97, 0)
      }
      SUNITDMG_ApplyLifeManaSteal113c(m, att, def, dmg, g, true)
    } else {
      SUNITDMG_ApplyLifeManaSteal113c(m, att, def, dmg)
    }
  }
  const stunLenVal = m.get(dmg, D2DamageStrc.dwStunLen) | 0
  if (g !== 0) {
    // 0x6FCFE27B..0x6FCFE287: SUNITDMG_ApplyStunEffect runs unconditionally before afterHp <= 0 check
    SUNITDMG_ApplyStunEffect113c(m, g, att, def, stunLenVal)
    // 0x6FCFE292..0x6FCFE2BD: Cold (`0x6FCFC780`), Freeze (`0x6FCFDAC0`), Burn (`0x6FCFC940`) run before `afterHp <= 0`
    SUNITDMG_ApplyColdOrFreezeState113c(m, g, att, def, dmg)
  }
  const afterHp = STATLIST_GetUnitStat113c(m, def, 6, 0) | 0
  const pDmgVal = m.get(dmg, D2DamageStrc.dwPoisDamage) | 0
  const pLenVal = m.get(dmg, D2DamageStrc.dwPoisLen) | 0
  if (afterHp > 0 && g !== 0) {
    if (att !== 0 && STATLIST_GetUnitStat113c(m, att, 116, 0) > 0 && defType === UNIT_MONSTER) {
      STATES_ToggleState113c(m, def, 113, 1)
    }
    if (effHooks !== undefined && effHooks.onApplyPoison !== undefined && pDmgVal > 0 && pLenVal > 0) {
      effHooks.onApplyPoison(m, g, att, def, pDmgVal, pLenVal)
    } else {
      SUNITDMG_ApplyPoisonEffect113c(m, g, att, def, pDmgVal, pLenVal)
    }
    if (
      att !== 0 &&
      (resFlags & 0x20) === 0 &&
      safeReadU32K2(m, (att + 0x90) >>> 0) === 0
    ) {
      SUNITDMG_TriggerAttackerBlindOrFlee113c(m, g, att, def, dmg)
    }
  } else if (g !== 0) {
    if (effHooks !== undefined && effHooks.onApplyPoison !== undefined && pDmgVal > 0 && pLenVal > 0) {
      effHooks.onApplyPoison(m, g, att, def, pDmgVal, pLenVal)
    } else {
      SUNITDMG_ApplyPoisonEffect113c(m, g, att, def, 0, 0)
    }
  }

  // 0x6FCFE2E2..0x6FCFE352: `RESULTFLAG_DEATH (0x02)` vs `RESULTFLAG_GETHIT (0x04)` & monster `Event 3` regen reschedule
  resFlags = m.get(dmg, D2DamageStrc.wResultFlags) >>> 0
  if (afterHp > 0) {
    resFlags = (resFlags & ~0x02) >>> 0
    m.set(dmg, D2DamageStrc.wResultFlags, resFlags & 0xffff)
    if (hitTotal !== 0 && defType === UNIT_MONSTER && g !== 0) {
      if ((STATLIST_GetUnitStat113c(m, def, 74, 0) | 0) !== 0) {
        EVENT_DeleteEventByType113c(m, g, def, 3)
        const nextFrame = ((m.get(g, D2GameStrc.dwGameFrame) | 0) + 1) >>> 0
        EVENT_SetEventFull113c(m, g, def, 3, nextFrame, 0, 0, 0)
      }
      if (safeReadU32K2(m, 0x6fde9e1c) !== 0) {
        STATES_ClearCurseStatesOnUnit113c(m, def)
      }
    }
  } else if (oldHp > 0 || hitTotal > 0) {
    resFlags = (resFlags | 0x02) >>> 0
    m.set(dmg, D2DamageStrc.wResultFlags, resFlags & 0xffff)
    if (!isDeathOverlayRotorMappedK2(m)) {
      SUNITDMG_SelectDeathOverlayFlag113c(m, def, dmg)
    }
  }

  // 0x6FCFE35A..0x6FCFE37E: kill item events `10` (defender killed) & `9` (attacker killed target)
  const finalFlags = m.get(dmg, D2DamageStrc.wResultFlags) >>> 0
  if ((finalFlags & 0x20) === 0 && (finalFlags & 0x02) !== 0 && g !== 0) {
    dispatchItemEventsSafeK2(m, def, g, 0x0a, att, dmg)
    if (att !== 0) {
      dispatchItemEventsSafeK2(m, att, g, 0x09, def, dmg)
    }
  }

  if (bDeferPostResultTo6FCFCF20 === 0) {
    return SUNITDMG_ApplySideEffectsAndKill113c(m, g, att, def, dmg, effHooks)
  }
  return (finalFlags & 0x02) !== 0 ? 1 : 0
}

/**
 * `@va D2Game:0x6FCFEA00` (`SUNITDMG_TriggerPostCombatEvents`, `410B`):
 * Exact 1.13c post-combat event dispatcher:
 * - Dispatches `SUNIT_DispatchItemEventCallbacks113c` (`0x6FCFD2D0`) for:
 *   - Melee/Ranged Hit (`event 1` melee / `event 2` ranged on `pAttacker`, `event 3`/`4` `When Struck` on `pDefender`,
 *     emitting `0x99` CtC skill proc packets when item `cast-skill` / `gethit-skill` triggers!)
 *   - Damage Dealt (`event 5` on `pAttacker`) -> `SUNITDMG_ApplyLifeManaSteal113c` + `SUNITDMG_ApplyAttackerThornsToSelf113c`
 *   - Block (`event 11` when `RESULTFLAG_BLOCK = 0x10`)
 *   - Kill (`event 10` when `RESULTFLAG_DEATH = 0x02`, applying `+Life After Each Kill` `STAT_ITEM_HEALAFTERKILL = 138`
 *     and `+Mana After Each Kill` `STAT_ITEM_MANAAFTERKILL = 86` + `+Life After Demon Kill` `STAT_ITEM_RESTINPEACE / DEMONHEAL = 139`).
 * - Applies attacker weapon durability loss (`SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c`) on melee hits.
 */
export function SUNITDMG_TriggerPostCombatEvents113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  bSuppressS2c = false,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFEA00)
  if (pGame === 0) return 0
  // True 1.13c `0x6FCFEA00` (`SUNITDMG_AwardKillExpToKillerAndMerc`) when invoked from `0x6FC977F0` with `pDmg === 0`
  if (pDmg === 0) {
    if (pAttacker === 0 || pDefender === 0) return 0
    const attType = m.u32(pAttacker) >>> 0
    if (attType !== UNIT_PLAYER && attType !== UNIT_MONSTER) return 0
    const diff = getEffectiveDiffK2(m, pGame)
    const mlvl = dllAbi
      ? (STATLIST_GetUnitBaseStat113c(m, pDefender, 12, 0) | 0)
      : Math.max(1, STATLIST_GetUnitStat113c(m, pDefender, 12, 0) | 0)
    let rawExp = dllAbi
      ? (STATLIST_GetUnitBaseStat113c(m, pDefender, 13, 0) | 0)
      : (STATLIST_GetUnitStat113c(m, pDefender, 13, 0) | 0)
    if (rawExp <= 0 && !dllAbi) {
      const row = getMonStatsRowByClassId113c(m.get(pDefender, D2UnitStrc.dwClassId) >>> 0)
      if (row !== undefined) {
        const monExpFactor = row.exp[diff]!
        if (monExpFactor > 0) {
          rawExp = row.noRatio ? monExpFactor : Math.trunc((getMonLvlXpRow113c(mlvl)[diff]! * monExpFactor) / 100)
        }
      }
    }
    if (rawExp <= 0) return 0
    const pKillerPlayer = SUNITDMG_ResolveAttackerPlayer113c(m, pGame, pAttacker)
    if (pKillerPlayer === 0 || m.get(pKillerPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return 0

    // 0x6FCFEA66..0x6FCFEB3E: shared hireling XP (`0x6FCFC030` -> `0x6FCFDCB0`)
    let pLiveMerc = 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pKillerPlayer) >>> 0
    if (pPlayerData !== 0) {
      const pPetWrap = safeReadU32K2(m, (pPlayerData + 0x44) >>> 0)
      const pSlots = pPetWrap !== 0 ? safeReadU32K2(m, pPetWrap) : 0
      if (pSlots !== 0) {
        let pNode = safeReadU32K2(m, (pSlots + 0x54) >>> 0)
        while (pNode !== 0) {
          if ((m.u8(pNode) & 1) === 0) {
            const mercGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
            pLiveMerc = SUNIT_GetServerUnit113c(m, pGame, 1, mercGuid) >>> 0
            break
          }
          pNode = safeReadU32K2(m, (pNode + 0x14) >>> 0)
        }
      }
    }
    if (pLiveMerc !== 0 && SUNIT_IsDeadOrDying113c(m, pLiveMerc) === 0) {
      const mercLvl = dllAbi
        ? (STATLIST_GetUnitBaseStat113c(m, pLiveMerc, 12, 0) | 0)
        : (STATLIST_GetUnitStat113c(m, pLiveMerc, 12, 0) | 0)
      const mercAddExpPct = STATLIST_GetUnitStat113c(m, pLiveMerc, 85, 0) | 0
      let mercGain = dllAbi
        ? (SUNITDMG_GetTotalSkillDamageBonus113c(m, rawExp, pLiveMerc, mercLvl, pGame, mlvl, true) | 0)
        : SUNITDMG_GetTotalSkillDamageBonus113c(m, pLiveMerc, 0, {
            rawExp,
            clvl: mercLvl,
            mlvl,
            addExpPct: mercAddExpPct,
          })
      if (pAttacker !== pLiveMerc) {
        mercGain = sdiv32(Math.imul(mercGain, 0x56), 256)
      }
      HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c(
        m,
        mercGain,
        pGame,
        pKillerPlayer,
        pLiveMerc,
        mercLvl,
      )
    }

    // 0x6FCFEB4C..0x6FCFEB8D: check party (`0x6FCFFA60`): if partied (!= 0xFFFF) distribute via `0x6FCFE8F0`,
    // else solo XP scale (`0x6FCFC030` -> `0x6FCFAA40`) + grant (`0x6FCFE6D0`).
    const wPartyId = SUNITDMG_GetPlayerClientClassId113c(m, pKillerPlayer) & 0xffff
    if (wPartyId !== 0xffff) {
      return SUNITDMG_ComputeExperienceGain113c(
        m,
        pGame,
        pKillerPlayer,
        mlvl,
        rawExp,
        pDefender,
        bSuppressS2c,
      )
    }
    const clvl = dllAbi
      ? (STATLIST_GetUnitBaseStat113c(m, pKillerPlayer, 12, 0) | 0)
      : (STATLIST_GetUnitStat113c(m, pKillerPlayer, 12, 0) | 0)
    const addExpPct = STATLIST_GetUnitStat113c(m, pKillerPlayer, 85, 0) | 0
    const gain = dllAbi
      ? (SUNITDMG_GetTotalSkillDamageBonus113c(m, rawExp, pKillerPlayer, clvl, pGame, mlvl, true) | 0)
      : SUNITDMG_GetTotalSkillDamageBonus113c(m, pKillerPlayer, 0, {
          rawExp,
          clvl,
          mlvl,
          addExpPct,
        })
    SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c(m, pGame, pKillerPlayer, gain, bSuppressS2c, clvl)
    return gain
  }

  const resFlags = m.get(pDmg, D2DamageStrc.wResultFlags) >>> 0
  const hitFlags = m.get(pDmg, D2DamageStrc.dwHitFlags) >>> 0
  const bRanged = (hitFlags & 0x20) !== 0

  if ((resFlags & 0x10) !== 0 && pDefender !== 0) {
    SUNIT_DispatchItemEventCallbacks113c(m, pDefender, pGame, 11, pAttacker, pDmg)
    SUNITDMG_RemoveCombatNode113c(m, pAttacker, pDefender)
    return 0
  }
  if ((resFlags & 0x01) === 0) {
    SUNITDMG_RemoveCombatNode113c(m, pAttacker, pDefender)
    return 0
  }

  if (pAttacker !== 0) {
    SUNIT_DispatchItemEventCallbacks113c(m, pAttacker, pGame, bRanged ? 2 : 1, pDefender, pDmg)
  }
  if (pDefender !== 0) {
    SUNIT_DispatchItemEventCallbacks113c(m, pDefender, pGame, bRanged ? 4 : 3, pAttacker, pDmg)
  }

  if (pAttacker !== 0 && pDefender !== 0) {
    SUNITDMG_ApplyLifeManaSteal113c(m, pAttacker, pDefender, pDmg)
    if (!bRanged) {
      SUNITDMG_ApplyAttackerThornsToSelf113c(m, pGame, pAttacker, pDefender)
      SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(m, pGame, pAttacker, 0, 0)
    }
  }

  if ((resFlags & 0x02) !== 0 && pAttacker !== 0) {
    const pRealKiller = SUNITDMG_ResolveAttackerPlayer113c(m, pGame, pAttacker)
    const kUnit = pRealKiller !== 0 ? pRealKiller : pAttacker
    SUNIT_DispatchItemEventCallbacks113c(m, kUnit, pGame, 10, pDefender, pDmg)
    const laek = STATLIST_GetUnitStat113c(m, kUnit, 138, 0) | 0
    if (laek > 0) {
      SUNITDMG_AddLeechedLifeToUnit113c(m, kUnit, 6, 7, laek << 8)
    }
    const maek = STATLIST_GetUnitStat113c(m, kUnit, 86, 0) | 0
    if (maek > 0) {
      SUNITDMG_AddLeechedLifeToUnit113c(m, kUnit, 8, 9, maek << 8)
    }
    if (pDefender !== 0 && SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x08) !== 0) {
      const demonHeal = STATLIST_GetUnitStat113c(m, kUnit, 139, 0) | 0
      if (demonHeal > 0) {
        SUNITDMG_AddLeechedLifeToUnit113c(m, kUnit, 6, 7, demonHeal << 8)
      }
    }
  }
  SUNITDMG_RemoveCombatNode113c(m, pAttacker, pDefender)
  return 0
}


// ============================================================================
// SECTION 1B: FULL 1:1 PORTS FOR ALL REMAINING NON-ITEM `combat-a1c` VAs
// ============================================================================

const D2CombatStrcOffK2 = {
  pGame: 0x00,
  dwAttackerType: 0x04,
  dwAttackerId: 0x08,
  dwDefenderType: 0x0c,
  dwDefenderId: 0x10,
  tDamage: 0x14,
  pNext: 0x84,
} as const

const D2AiParamStrcOffK2 = {
  pAiControl: 0x00,
  pAiFn: 0x04,
  pTarget: 0x08,
  nStallFrames: 0x0c,
  bEngaged: 0x10,
  nDistanceToTarget: 0x14,
  bInMeleeRange: 0x18,
  pMonStatsTxt: 0x1c,
  pMonStats2Txt: 0x20,
} as const
const D2AiParamStrc_SIZE_K2 = 0x24

export interface MonsterSlicePathRoomLike113c {
  readonly ptr: number
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  readonly grid: { get(x: number, y: number): number }
}

export interface MonsterSlicePathUnitLike113c {
  readonly pUnit: number
  readonly pPath: number
  dwAnimMode: number
  dwFlags: number
  dwFlagEx: number
}

export interface MonsterSliceWorldLike113c {
  readonly m: Memory113c
  readonly pGame: number
  readonly hasFullDrlg?: boolean
  readonly playerKillsById?: Map<number, number>
  readonly dirtyKillPlayerIds?: Set<number>
  readonly monsterById: Map<number, number>
  readonly playerById: Map<number, number>
  readonly pathUnitByPtr: Map<number, MonsterSlicePathUnitLike113c>
  readonly roomByPtr: Map<number, MonsterSlicePathRoomLike113c>
  readonly minionIdsByLeaderId: Map<number, number[]>
  onTownNpcAi?: (world: MonsterSliceWorldLike113c, pMonster: number) => void
  onRogueTownAi?: (world: MonsterSliceWorldLike113c, pMonster: number) => void
  onNecroPetAi?: (world: MonsterSliceWorldLike113c, pMonster: number) => void
  onMonsterDropItems?: (world: MonsterSliceWorldLike113c, pMonster: number, pKiller: number) => void
  onHireableAiThink?: (world: MonsterSliceWorldLike113c, pMonster: number) => void
  onMonsterStartSkillMode?: (m: Memory113c, pGame: number, pMonster: number) => void
  onApplyHireableVelocityOverride?: (m: Memory113c, pMonster: number, pAiCtrl: number) => boolean
  onMonsterExpireDeathSubLists?: (m: Memory113c, pMonster: number) => void
  onUnitEnteredClientRoom?: (m: Memory113c, pGame: number, pUnit: number, pClient: number) => void
  findAlliedMonsterTarget?: (
    m: Memory113c,
    pGame: number,
    pMonster: number,
  ) => { pTarget: number; distance: number; inMeleeRange: number }
  onTownNpcThink?: (
    world: MonsterSliceWorldLike113c,
    pMonster: number,
    pfnThink: number,
    pAiTickParam: number,
  ) => boolean
  onMonsterAwardKillExp?: (
    world: MonsterSliceWorldLike113c,
    pMonster: number,
    pKiller: number,
    row: MonStatsRow113c,
  ) => void
}

const VA_AI_HIREABLE_K2 = 0x6fc3dd40

function isHireableMonsterK2(m: Memory113c, pMonster: number): boolean {
  if (pMonster === 0 || m.get(pMonster, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return false
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) | 0
  if (
    classId === 0x10f ||
    classId === 0x152 ||
    classId === 0x167 ||
    classId === 0x230 ||
    classId === 0x231
  ) {
    return true
  }
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return false
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGen === 0) return false
  return (m.get(pAiGen, D2AiGeneralStrc.pfnThink) >>> 0) === VA_AI_HIREABLE_K2
}

function expireHireableModeStateListsK2(
  m: Memory113c,
  pMonster: number,
  prevMode: number,
  nextMode: number,
): void {
  if ((prevMode >>> 0) === (nextMode >>> 0)) return
  if (!isHireableMonsterK2(m, pMonster)) return
  STATLIST_ExpireStateListsOnModeChange113c(m, pMonster, 0)
}

const PATHTYPE_TOWARD_FINISH_K2 = 13
const PATHTYPE_WALL_FOLLOW_K2 = 15
const UNITFLAG_MODE_CHANGED_TICK_K2 = 0x00080000
const UNITFLAG2_CORPSE_SELECTABLE_K2 = 0x00020000
const MON_STAT_CALC_SCRATCH_VA_K2 = 0x6fc1dc00
const MON_MODE_CHANGE_SCRATCH_VA_K2 = 0x6fc1dc80
let monModeScratchDepthK2 = 0
export const VA_AI_FALLEN_K2 = 0x6fca3130
export const VA_AI_ZOMBIE_K2 = 0x6fca38b0

function isMonsterSliceWorldK2(arg: unknown): arg is MonsterSliceWorldLike113c {
  return typeof arg === 'object' && arg !== null && 'm' in arg && !('u32' in arg)
}

function hasHydratedAnimDataTableK2(m: Memory113c): boolean {
  return safeReadU32K2(m, 0x6fdf0b4c) !== 0
}

function stepUnitSeedObjK2(m: Memory113c, pUnit: number): D2SeedStrc {
  const s = UNITS_GetSeed113c(m, pUnit)
  seedNext(s)
  UNITS_SetSeed113c(m, pUnit, s.lo, s.hi)
  return s
}

function rollUnitLimitedObjK2(m: Memory113c, pUnit: number, limit: number): number {
  const s = UNITS_GetSeed113c(m, pUnit)
  const v = seedRoll(s, limit)
  UNITS_SetSeed113c(m, pUnit, s.lo, s.hi)
  return v
}

function writeUnitAnimStateK2(
  m: Memory113c,
  pUnit: number,
  dwFrame0x40: number,
  dwFrame0x44: number,
  dwFrameCount0x48: number,
  wAnimSpeed: number,
  wActionFrame: number,
): void {
  m.setU32((pUnit + 0x40) >>> 0, dwFrame0x40 >>> 0)
  m.setU32((pUnit + 0x44) >>> 0, dwFrame0x44 >>> 0)
  m.setU32((pUnit + 0x48) >>> 0, dwFrameCount0x48 >>> 0)
  m.set(pUnit, D2UnitStrc.wAnimSpeed, wAnimSpeed & 0xffff)
  m.set(pUnit, D2UnitStrc.wActionFrame, wActionFrame & 0xffff)
}

function getUnitPosSubtileK2(m: Memory113c, pUnit: number): { x: number; y: number } {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return { x: 0, y: 0 }
  return {
    x: m.get(pPath, D2DynamicPathStrc.wPosX),
    y: m.get(pPath, D2DynamicPathStrc.wPosY),
  }
}

function getMonStatsRowStrictK2(m: Memory113c, pMonster: number): MonStatsRow113c {
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  if (row === undefined) {
    throw new RangeError(`Missing MonStats.bin row for classId=${classId}`)
  }
  return row
}

function ensureSliceWorldPathMemoryK2(world: MonsterSliceWorldLike113c): void {
  const { m } = world
  ensureD2CommonPathGlobals113c(m)
  if (world.roomByPtr !== undefined) {
    for (const [rPtr, roomObj] of world.roomByPtr) {
    if (m.u32((rPtr + 0x20) >>> 0) === 0) {
      bindRoomCollisionGrid113c(
        m,
        rPtr,
        roomObj.subX,
        roomObj.subY,
        roomObj.subW,
        roomObj.subH,
        (x, y) => roomObj.grid.get(x, y),
      )
    }
  }
  }
}

function scheduleUnitModeAnimEventsFromMemK2(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evStepType: number,
  evEndType: number,
): number {
  const bridge = KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C.get(m)
  if (bridge !== undefined && bridge.scheduleModeAnimEventsFromMem !== undefined) {
    return bridge.scheduleModeAnimEventsFromMem(pGame, pUnit, evStepType, evEndType)
  }
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const stepSpeed = (m.u16((pUnit + 0x4c) >>> 0) << 16) >> 16
  if (stepSpeed <= 0) {
    const endF = (gameFrame + 1) >>> 0
    EVENT_SetEventFull113c(m, pGame, pUnit, evEndType, endF, 0, 0, 0)
    m.setU32((pUnit + 0x44) >>> 0, (gameFrame << 8) >>> 0)
    return endF
  }
  const frameCount256 = m.u32((pUnit + 0x48) >>> 0) | 0
  const pAnimData = m.u32((pUnit + 0x50) >>> 0)
  let edi = UNITS_GetAnimStartFrame113c(m, pUnit) | 0
  let acc = ((edi << 8) + stepSpeed) | 0
  let ebx = gameFrame
  let hitIdx = 0

  while (acc < frameCount256) {
    const frameIdx = acc >> 8
    ebx = (ebx + 1) >>> 0
    while (edi <= frameIdx && edi < 0x90) {
      const evCode = pAnimData !== 0 ? m.u8((pAnimData + 0x10 + edi) >>> 0) : 0
      if (evCode >= 1 && evCode <= 4) {
        const arg18 = evCode === 1 || evCode === 2 ? hitIdx++ : 0
        EVENT_SetEventFull113c(m, pGame, pUnit, evStepType, ebx, 0, evCode, arg18)
      }
      edi++
    }
    acc = (acc + stepSpeed) | 0
  }
  if (ebx === gameFrame) {
    ebx = (ebx + 1) >>> 0
  }
  const endFrame = (ebx + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, pUnit, evEndType, endFrame, 0, 0, 0)
  m.setU32((pUnit + 0x44) >>> 0, (gameFrame << 8) >>> 0)
  return endFrame
}

/**
 * `@va D2Game:0x6FC95350` (`MONSTER_SetDeathPathAndAnim`, `164B`):
 * Configures monster death path target/direction, dead collision (`0x6FDAB750`), `dwAnimMode = 0` (`MONMODE_DEATH`),
 * state expiry, and `MON_EVENT_MODE_END` (`Event 1`) scheduling across both `MonsterSliceWorldLike113c` and `Memory113c`.
 */
export function MONSTER_SetDeathPathAndAnim113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4 = 0,
  forceZeroHitDir = false,
): number {
  hitD2GameVa113c(0x6FC95350)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const pKiller = arg2
    const nextFlags = arg3 >>> 0
    const nextFlags2 = arg4 >>> 0
    const { m } = world
    if (world.pGame !== 0) {
      SUNIT_UnlinkFromRoomUpdateList113c(m, world.pGame, pMonster)
    }
    if ((m.u32(pMonster >>> 0) | 0) === 1) {
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
      if (pAiGen !== 0 && (m.u16((pAiGen + 0x08) >>> 0) & 3) === 1) {
        AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c(m, pAiGen)
      }
    }
    const animHydrated = hasHydratedAnimDataTableK2(m)
    const pu = world.pathUnitByPtr.get(pMonster)
    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    if (pPath !== 0) {
      ensureSliceWorldPathMemoryK2(world)
      if (!forceZeroHitDir) {
        if (pKiller !== 0) {
          PATH_SetTargetUnit113c(m, pPath, pKiller)
        }
        PATH_SetDistance113c(m, pPath, 20)
      }
      const killerPos = !forceZeroHitDir && pKiller !== 0 ? getUnitPosSubtileK2(m, pKiller) : null
      const monX = m.get(pPath, D2DynamicPathStrc.wPosX)
      const monY = m.get(pPath, D2DynamicPathStrc.wPosY)
      const hitDir = forceZeroHitDir
        ? 0
        : killerPos !== null
          ? PATH_ComputeDirection113c(m, monX, monY, killerPos.x, killerPos.y)
          : m.get(pPath, D2DynamicPathStrc.nDirection)
      m.set(pMonster, D2UnitStrc.dwAnimMode, 0)
      if (animHydrated) {
        STATLIST_ExpireStateListsOnModeChange113c(m, pMonster, 0)
        if (world.onMonsterExpireDeathSubLists !== undefined && STATES_CheckState113c(m, pMonster, 11) !== 0) {
          world.onMonsterExpireDeathSubLists(m, pMonster)
        } else {
          MONSTER_ExpireDeathStateSubLists113c(m, pMonster)
        }
        if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
          const savedC4 = m.u32((pMonster + 0xc4) >>> 0)
          const savedC8 = m.u32((pMonster + 0xc8) >>> 0)
          const savedDc = m.u32((pMonster + 0xdc) >>> 0)
          const pDeathRoom = UNITS_GetRoom113c(m, pMonster)
          const savedRoom38 = pDeathRoom !== 0 ? m.u32((pDeathRoom + 0x38) >>> 0) : 0
          const isNoDeathAnim = MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pMonster)
          STATES_UpdateGfxStateFlagsByMask113c(m, pMonster, isNoDeathAnim)
          STATES_CheckStateMask2OnUnit113c(m, pMonster)
          m.setU32((pMonster + 0xc4) >>> 0, savedC4)
          m.setU32((pMonster + 0xc8) >>> 0, savedC8)
          m.setU32((pMonster + 0xdc) >>> 0, savedDc)
          if (pDeathRoom !== 0) {
            m.setU32((pDeathRoom + 0x38) >>> 0, savedRoom38)
          }
        }
      }
      if (pu !== undefined) {
        pu.dwAnimMode = 0
        pu.dwFlags = nextFlags
        pu.dwFlagEx = nextFlags2
      }
      PATH_MarkUnitDeadCollision113c(m, pMonster, 1)
      PATH_ForceDirection113c(m, pPath, hitDir)
    } else {
      m.set(pMonster, D2UnitStrc.dwAnimMode, 0)
      if (animHydrated) {
        STATLIST_ExpireStateListsOnModeChange113c(m, pMonster, 0)
        if (world.onMonsterExpireDeathSubLists !== undefined && STATES_CheckState113c(m, pMonster, 11) !== 0) {
          world.onMonsterExpireDeathSubLists(m, pMonster)
        } else {
          MONSTER_ExpireDeathStateSubLists113c(m, pMonster)
        }
        if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
          const savedC4 = m.u32((pMonster + 0xc4) >>> 0)
          const savedC8 = m.u32((pMonster + 0xc8) >>> 0)
          const savedDc = m.u32((pMonster + 0xdc) >>> 0)
          const pDeathRoom = UNITS_GetRoom113c(m, pMonster)
          const savedRoom38 = pDeathRoom !== 0 ? m.u32((pDeathRoom + 0x38) >>> 0) : 0
          const isNoDeathAnim = MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pMonster)
          STATES_UpdateGfxStateFlagsByMask113c(m, pMonster, isNoDeathAnim)
          STATES_CheckStateMask2OnUnit113c(m, pMonster)
          m.setU32((pMonster + 0xc4) >>> 0, savedC4)
          m.setU32((pMonster + 0xc8) >>> 0, savedC8)
          m.setU32((pMonster + 0xdc) >>> 0, savedDc)
          if (pDeathRoom !== 0) {
            m.setU32((pDeathRoom + 0x38) >>> 0, savedRoom38)
          }
        }
      }
    }
    return 1
  }

  const m = arg0
  const pGame = arg1 >>> 0
  const pUnit = arg2 >>> 0
  const bFlag14 = arg3 & 0xff
  if (pGame === 0 || pUnit === 0) return 0
  if (
    isSgptDataTablesLoaded113c(m) &&
    safeReadU32K2(m, 0x6fde461c) !== 0 &&
    safeReadU32K2(m, 0x6fdef020) !== 0
  ) {
    // Real D2Game.dll@0x6FC95350 (`MONSTER_SetDeathPathAndAnim`, `eax = pUnit`, `ecx = pGame`, `[esp+4] = bFlag14`):
    const pHover = m.u32((pUnit + 0xa4) >>> 0) >>> 0
    if (pHover !== 0) {
      CHAT_FreeHoverMsg113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, pHover)
      m.setU32((pUnit + 0xa4) >>> 0, 0)
      UNITROOM_RefreshUnit113c(m, pUnit)
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x100) >>> 0)
    }
    let pAiGen = 0
    if ((m.u32(pUnit) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
      }
    }
    if (pAiGen !== 0) {
      const wFlags = m.u16((pAiGen + 0x08) >>> 0)
      if ((wFlags & 1) !== 0) {
        if ((wFlags & 2) !== 0) {
          AIGENERAL_ReassignPackOnBossDeath113c(m, pAiGen, pUnit)
        } else {
          AIGENERAL_DissolveMinionPackLeaderRefs_6FC41040_113c(m, pAiGen)
        }
      }
    }
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    const pMonStats = MONSTATS_GetRecordPtr113c(m, nClassId) >>> 0
    SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit)
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xffff7ff3) >>> 0)
    STATLIST_ExpireOrphanStateSubLists113c(m, pUnit)
    const isNoDeathAnim = MONSTERS_CheckMonStatsFlagBit6_113c(m, pMonStats, pUnit)
    STATES_UpdateGfxStateFlagsByMask113c(m, pUnit, isNoDeathAnim)
    if (STATES_CheckStateMask2OnUnit113c(m, pUnit) !== 0) {
      m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
    }
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    if (MONSTATS2_CheckFlagBit113c(m, nClassId, 0x13) === 0) {
      PATH_MarkUnitDeadCollision113c(m, pUnit, 1)
    }
    PATH_ForceDirection113c(m, pPath, bFlag14)
    MONSTER_DeleteAiAndRegenEvents113c(m, pGame, pUnit)
    return 1
  }
  SUNIT_UnlinkFromRoomUpdateList113c(m, pGame, pUnit)
  MONSTER_ClearModeEvents113c(m, pGame, pUnit)
  const pMonData = m.get(pUnit, D2UnitStrc.pUnitData)
  const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
  if (pAiGen !== 0 && (m.u8((pAiGen + 0x08) >>> 0) & 3) === 3) {
    AIGENERAL_ReassignPackOnBossDeath113c(m, pAiGen, pUnit)
  }

  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath !== 0) {
    PATH_MarkUnitDeadCollision113c(m, pUnit, 0)
  }

  UNITS_ChangeAnimMode113c(m, pUnit, 0)
  const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
  const baseFrames = Math.max(1, getMonsterModeBaseFrameCountPure113c(classId, 0) | 0)
  const speed256 = Math.max(16, getMonsterModeBaseAnimSpeed256Pure113c(classId, 0) | 0)
  const frameCountPrecise = (baseFrames << 8) >>> 0
  m.set(pUnit, D2UnitStrc.dwFramePrecise, 0)
  m.set(pUnit, D2UnitStrc.dwFrameCountPrecise, frameCountPrecise)
  m.set(pUnit, D2UnitStrc.wAnimSpeed, speed256 & 0xffff)

  const endTicks = Math.max(1, Math.ceil(frameCountPrecise / speed256))
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pUnit, MON_EVENT_MODE_END, (gameFrame + endTicks) >>> 0, 0, 0, 0)
  return 1
}

/**
 * `@va D2Game:0x6FC971D0` (`MONSTER_CheckSandLeaperMidAir` / `MONSTER_ApplySandLeaperKnockback`, `109B`):
 * Exact `D2Game:0x6FC971D0`:
 * - When called with `(m, pDmg, pDefender)`: if `pDefender` is a monster whose `MonStats.hcIdx` base chain (`+0x02`)
 *   is `0x4E` (`78`, Sand Leaper family `78..82` / `251..255`), is not frozen (`STATE_FREEZE = 1`), and `wResultFlags & 0x04`
 *   (`RESULTFLAG_GETHIT`), promotes `wResultFlags |= 0x08` (`RESULTFLAG_KNOCKBACK`) and returns `1`.
 * - When called with 2 arguments `(m, pUnit)`: returns `1` if Sand Leaper in mid-air/leap (`mode 5` or `14`), else `0`.
 */
export function MONSTER_CheckSandLeaperMidAir113c(
  m: Memory113c,
  pUnitOrDmg: number,
  pDefenderOpt = 0,
): number {
  hitD2GameVa113c(0x6FC971D0)
  if (pUnitOrDmg === 0) return 0
  if (pDefenderOpt !== 0) {
    const pDmg = pUnitOrDmg >>> 0
    const pDef = pDefenderOpt >>> 0
    if (m.u32(pDef) !== UNIT_MONSTER) return 0
    if (STATES_CheckState113c(m, pDef, 1) !== 0) return 0
    const cls = m.get(pDef, D2UnitStrc.dwClassId) | 0
    const monRow = getMonStatsRecordPtrSafeK2(m, cls)
    const baseId = monRow !== 0 ? ((m.u16((monRow + 0x02) >>> 0) << 16) >> 16) : cls
    const isLeaper = baseId === 0x4e || (cls >= 78 && cls <= 82) || (cls >= 251 && cls <= 255)
    if (!isLeaper) return 0
    const rf = m.get(pDmg, D2DamageStrc.wResultFlags) >>> 0
    if ((rf & 0x04) === 0) return 0
    m.set(pDmg, D2DamageStrc.wResultFlags, (rf | 0x08) & 0xffff)
    return 1
  }
  if (m.get(pUnitOrDmg, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const classId = m.get(pUnitOrDmg, D2UnitStrc.dwClassId) >>> 0
  const monRow = getMonStatsRecordPtrSafeK2(m, classId | 0)
  const baseId = monRow !== 0 ? ((m.u16((monRow + 0x02) >>> 0) << 16) >> 16) : (classId | 0)
  if (baseId !== 0x4e && (classId < 78 || classId > 82) && (classId < 251 || classId > 255)) {
    return 0
  }
  const mode = m.get(pUnitOrDmg, D2UnitStrc.dwAnimMode) | 0
  return mode === 5 || mode === 14 ? 1 : 0
}

/**
 * `@va D2Game:0x6FC977F0` (`MONSTER_ExecuteEventsWrapper`, `46B`):
 * Verifies `pGame != 0`, `pDefender != 0`, and `(pDefender->dwFlags & 0x04000000) == 0`
 * (`UNITFLAG_NOEXP`), then invokes kill experience / post-combat resolution (`0x6FCFEA00`).
 */
export function MONSTER_ExecuteEventsWrapper113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg = 0,
  bSuppressS2cOrOnAwardKillExp?: boolean | (() => void),
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FC977F0)
  if (pDefender === 0 || (pGame === 0 && pAttacker === 0)) return 0
  // 0x6FC977F9: `mov edx, [eax + 0xc4]; shr edx, 0x1a; and edx, 1` (`dwFlags & 0x04000000` = `UNITFLAG_NOEXP`)
  if ((m.get(pDefender, D2UnitStrc.dwFlags) & 0x04000000) !== 0) return 0
  if (pDmg === 0) {
    if (typeof bSuppressS2cOrOnAwardKillExp === 'function') {
      bSuppressS2cOrOnAwardKillExp()
      return 1
    }
    if (pAttacker === 0) return 0
    return SUNITDMG_TriggerPostCombatEvents113c(
      m,
      pGame,
      pAttacker,
      pDefender,
      0,
      bSuppressS2cOrOnAwardKillExp === true,
      dllAbi,
    )
  }
  return SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, pDmg)
}

/**
 * `@va D2Game:0x6FC978A0` (`PLAYER_SnapshotHandSkillsToStruct`, `94B`):
 * Exact binary function at `0x6FC978A0` (`eax = pPlayer`, `ecx = pOutStruct16B`):
 * Snapshots right & left hand `[rightSkillId, leftSkillId, rightOwnerGuid, leftOwnerGuid]` into `pOutStruct16B`.
 */
export function PLAYER_SnapshotHandSkillsToStruct113c(
  m: Memory113c,
  pPlayer: number,
  pOutStruct: number,
): void {
  hitD2GameVa113c(0x6FC978A0)
  const out = pOutStruct >>> 0
  const pLeft = UNITS_GetLeftSkill113c(m, pPlayer) >>> 0
  if (pLeft !== 0) {
    m.setU32((out + 0x0c) >>> 0, SKILLS_GetOwnerItemGuid113c(m, pLeft) >>> 0)
    m.setU32(
      (out + 0x04) >>> 0,
      SKILLS_GetSkillIdFromSkill113c(m, pLeft, 0x6fd1bbc8, 0x56d) >>> 0,
    )
  } else {
    m.setU32((out + 0x0c) >>> 0, 0xffffffff)
    m.setU32((out + 0x04) >>> 0, 0)
  }
  const pRight = UNITS_GetRightSkill113c(m, pPlayer) >>> 0
  if (pRight !== 0) {
    m.setU32((out + 0x08) >>> 0, SKILLS_GetOwnerItemGuid113c(m, pRight) >>> 0)
    m.setU32(
      out,
      SKILLS_GetSkillIdFromSkill113c(m, pRight, 0x6fd1bbc8, 0x579) >>> 0,
    )
  } else {
    m.setU32((out + 0x08) >>> 0, 0xffffffff)
    m.setU32(out, 0)
  }
}

/**
 * `@va D2Game:0x6FC978A0` (`PLAYER_EndAttackOrBlockAnim`):
 * Completes player attack (`7`/`8`), block (`9`), or cast/skill (`10..14`) animation (`Event 7`),
 * deleting `Event 6` / `Event 7` and returning `pPlayer` to town-neutral (`5`) in town or neutral (`1`) outside.
 */
export function PLAYER_EndAttackOrBlockAnim113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): number {
  if (pPlayer === 0) return 0
  if (pGame !== 0) {
    EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, 6, 0)
    EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, 7, 0)
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer)
  const inTown = pRoom !== 0 && DUNGEON_IsTownLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom))
  UNITS_ChangeAnimMode113c(m, pPlayer, inTown ? 5 : 1)
  return 1
}

/**
 * `@va D2Game:0x6FC97B20` (`PLAYER_RestoreHandSkillsFromSnapshot`, `102B`):
 * Exact binary function at `0x6FC97B20` (`eax = pPlayer`, `ecx = pSnapshot16B`):
 * Restores right & left hand skills from `pSnapshot16B` via `SKILLS_AssignHandSkillAndSyncAura113c` (`0x6FCC2100`).
 */
export function PLAYER_RestoreHandSkillsFromSnapshot113c(
  m: Memory113c,
  pPlayer: number,
  pSnapshot: number,
): number {
  if (pPlayer === 0 || pSnapshot === 0) return 0
  const snap = pSnapshot >>> 0
  const leftId = m.u32((snap + 0x04) >>> 0) | 0
  if (leftId > 0) {
    const leftGuid = m.u32((snap + 0x0c) >>> 0) | 0
    const pFoundLeft = SKILLS_GetSkillById113c(m, pPlayer, leftId, leftGuid) >>> 0
    if (pFoundLeft !== 0 && pFoundLeft !== (UNITS_GetLeftSkill113c(m, pPlayer) >>> 0)) {
      const failReason = SKILLS_GetSkillUseFailReason113c(m, pPlayer, pFoundLeft) | 0
      if (failReason !== 2 && failReason !== 7) {
        SKILLS_AssignHandSkillAndSyncAura113c(m, pPlayer, 1, leftId, leftGuid >>> 0)
      }
    }
  }
  const rightId = m.u32(snap) | 0
  if (rightId > 0) {
    const rightGuid = m.u32((snap + 0x08) >>> 0) | 0
    const pFoundRight = SKILLS_GetSkillById113c(m, pPlayer, rightId, rightGuid) >>> 0
    if (pFoundRight !== 0 && pFoundRight !== (UNITS_GetRightSkill113c(m, pPlayer) >>> 0)) {
      const failReason = SKILLS_GetSkillUseFailReason113c(m, pPlayer, pFoundRight) | 0
      if (failReason !== 2 && failReason !== 7) {
        SKILLS_AssignHandSkillAndSyncAura113c(m, pPlayer, 0, rightId, rightGuid >>> 0)
      }
    }
  }
  return 1
}

/**
 * `@va D2Game:0x6FC97B20` (`PLAYER_AdvanceSkillModeFrame`):
 * Fires on player `Event 6` (`PLR_EVENT_MODE_STEP`) at the melee/skill action frame: clears `wActionFrame`
 * and executes the queued melee hit against `pTargetOverride` or `pPath->pTargetUnit`.
 * When `pGame === 0 && pTargetOverride !== 0`, executes the exact `0x6FC97B20` hand-skill snapshot restore.
 */
export function PLAYER_AdvanceSkillModeFrame113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pTargetOverride = 0,
): number {
  hitD2GameVa113c(0x6FC97B20)
  if (pPlayer === 0) return 0
  if (pGame === 0 && pTargetOverride !== 0) {
    return PLAYER_RestoreHandSkillsFromSnapshot113c(m, pPlayer, pTargetOverride)
  }
  if (pGame === 0) return 0
  m.set(pPlayer, D2UnitStrc.wActionFrame, 0)
  let pTarget = pTargetOverride
  if (pTarget === 0) {
    const pPath = m.get(pPlayer, D2UnitStrc.pPath)
    if (pPath !== 0) {
      pTarget = m.get(pPath, D2DynamicPathStrc.pTargetUnit)
    }
  }
  if (pTarget === 0 || SUNIT_IsDeadOrDying113c(m, pTarget) !== 0) return 0
  const savedSp = k2RealStackPtr
  const pDmg = k2RealStackPtr
  k2RealStackPtr = (k2RealStackPtr + D2DamageStrc_SIZE) >>> 0
  try {
    m.fill(pDmg, D2DamageStrc_SIZE, 0)
    SUNITDMG_FillDamageValues113c(m, pGame, pPlayer, pTarget, pDmg, 0, 128)
    SUNITDMG_AllocCombat113c(m, pGame, pPlayer, pTarget, pDmg, 128)
    SUNITDMG_ExecuteEvents113c(m, pGame, pPlayer, pTarget, 1, 0)
    return 1
  } finally {
    k2RealStackPtr = savedSp
  }
}

/**
 * `@va D2Game:0x6FC98760` (`PLAYER_ScheduleAttackActionFrameEvents`, `96B`):
 * Deletes existing player `Event 6` (`PLR_EVENT_MODE_STEP`) and `Event 7` (`PLR_EVENT_MODE_END`) nodes
 * and schedules new `Event 6` (at `dwGameFrame + actionTicks`) and `Event 7` (at `dwGameFrame + endTicks`).
 */
export function PLAYER_ScheduleAttackActionFrameEvents113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  actionTicks: number,
  endTicks: number,
  pTargetUnit = 0,
): void {
  hitD2GameVa113c(0x6FC98760)
  if (actionTicks === -2) {
    // True 1.13c `0x6FC98760` (`PLAYER_SetPathTargetUnitAndWalk`): `endTicks` = `nMode`, `pTargetUnit` = target unit
    if (pGame === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Game\\PLAYER\\PlrMode.cpp', 0x16f)
    }
    if (pPlayer === 0) return
    const nMode = endTicks | 0
    if (nMode === 19 && (m.get(pPlayer, D2UnitStrc.dwAnimMode) | 0) === 19) {
      return
    }
    const pPath = m.get(pPlayer, D2UnitStrc.pPath)
    if (pPath !== 0) {
      PATH_SetTargetUnit113c(m, pPath, pTargetUnit)
    }
    PLAYER_StartWalkOrRunMode113c(m, nMode, pPlayer, pGame)
    return
  }
  if (pGame === 0 || pPlayer === 0) return
  EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, 6, 0)
  EVENT_DeleteEventByArg14_113c(m, pGame, pPlayer, 7, 0)
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  if ((actionTicks | 0) > 0) {
    EVENT_SetEventFull113c(m, pGame, pPlayer, 6, (gameFrame + (actionTicks >>> 0)) >>> 0, 0, 0, 0)
  }
  if ((endTicks | 0) > 0) {
    EVENT_SetEventFull113c(m, pGame, pPlayer, 7, (gameFrame + (endTicks >>> 0)) >>> 0, 0, 0, 0)
  }
}

/**
 * `@va D2Game:0x6FC981C0` (`PLAYER_StartBlockMode`, `612B`):
 * Transitions `pPlayer` into `PLRMODE_BLOCK (9)`, computes block speed from `AnimData.d2` +
 * `STAT_ITEM_FASTERBLOCKRATE (102)` diminishing returns, and schedules `Event 7` (`PLR_EVENT_MODE_END`).
 */
export function PLAYER_StartBlockMode113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  weaponClassCode = '1HS',
  onHydratedSchedule?: (m: Memory113c, pGame: number, pPlayer: number) => void,
): number {
  hitD2GameVa113c(0x6FC981C0)
  if (pGame === 0 || pPlayer === 0) return 0
  if (onHydratedSchedule !== undefined || hasHydratedAnimDataTableK2(m)) {
    // True 1.13c `0x6FC981C0` (`0x6FCFA750` -> `#11090` -> `0x6FCFFF10` -> `#11103` -> `0x6FD00750` -> `0x6FCFF7B0`)
    SUNITDMG_FreeAttackerCombatList113c(m, pPlayer, pGame)
    UNITS_ChangeAnimMode113c(m, pPlayer, 9)
    SUNIT_InitUnitAnimData113c(m, pPlayer)
    SKILLS_SetUsedSkill113c(m, pPlayer, 0)
    MONSTER_ClearModeEvents113c(m, pGame, pPlayer)
    if (onHydratedSchedule !== undefined) {
      onHydratedSchedule(m, pGame, pPlayer)
    } else {
      const nextFlags = ((m.get(pPlayer, D2UnitStrc.dwFlags) & ~0x40) | 0x01) >>> 0
      m.set(pPlayer, D2UnitStrc.dwFlags, nextFlags)
      UNITS_SetUnitAnimMode113c(m, pPlayer, 0, 0)
      UNITS_UpdateAnimFrame113c(m, pPlayer)
      SUNIT_ScheduleModeAnimEvents113c(m, pGame, pPlayer, 0, 1)
    }
    return 1
  }
  const prevMode = m.get(pPlayer, D2UnitStrc.dwAnimMode) | 0
  if (prevMode !== 9) {
    STATLIST_ExpireStateListsOnModeChange113c(m, pPlayer, 0)
  }
  UNITS_ChangeAnimMode113c(m, pPlayer, 9)
  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const clip = getCharAnimClipPure113c(classId, 9, weaponClassCode)
  const fbr = STATLIST_GetUnitStat113c(m, pPlayer, 102, 0) | 0
  const effFbr = computeFrwDiminishingPure113c(fbr)
  const speed = computeRawPlayerAnimSpeedPure113c({
    mode: 9,
    classId,
    statAcc: effFbr,
    stat68Acc: 0,
    stat67Acc: 0,
    weaponClass: weaponClassCode,
  })
  const frameCountPrecise = (clip.frames << 8) >>> 0
  m.set(pPlayer, D2UnitStrc.dwFramePrecise, 0)
  m.set(pPlayer, D2UnitStrc.dwFrameCountPrecise, frameCountPrecise)
  m.set(pPlayer, D2UnitStrc.wAnimSpeed, speed & 0xffff)
  m.set(pPlayer, D2UnitStrc.wActionFrame, 0)

  const endTicks = speed > 0 ? Math.max(1, Math.floor((frameCountPrecise - 1) / speed)) : 6
  PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pPlayer, 0, endTicks)
  return 1
}

/**
 * `@va D2Game:0x6FC98430` (`PLAYER_StartModeAttack`, `804B`):
 * Transitions `pPlayer` into `PLRMODE_ATTACK1 (7)` or `PLRMODE_ATTACK2 (8)` (or skill clip mode),
 * computes exact `AnimData` speed from `STAT_ITEM_FASTERATTACKRATE (93)` + `STAT_ATTACKRATE (68)`,
 * sets `startFrame << 8`, and schedules `Event 6` (action frame) & `Event 7` (end frame).
 */
export function PLAYER_StartModeAttack113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mode = 7,
  pTarget = 0,
  weaponClassCode = '1HS',
): number {
  if (pGame === 0 || pPlayer === 0) return 0
  const atkMode = mode === 8 ? 8 : 7
  const prevMode = m.get(pPlayer, D2UnitStrc.dwAnimMode) | 0
  if (prevMode !== atkMode) {
    STATLIST_ExpireStateListsOnModeChange113c(m, pPlayer, 0)
  }
  UNITS_ChangeAnimMode113c(m, pPlayer, atkMode)

  const pPath = m.get(pPlayer, D2UnitStrc.pPath)
  if (pPath !== 0 && pTarget !== 0) {
    PATH_SetTargetUnit113c(m, pPath, pTarget)
  }

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const clip = getCharAnimClipPure113c(classId, atkMode, weaponClassCode)
  const ias = STATLIST_GetUnitStat113c(m, pPlayer, 93, 0) | 0
  const effIas = computeFrwDiminishingPure113c(ias)
  const atkRate = STATLIST_GetUnitStat113c(m, pPlayer, 68, 0) | 0
  const velPct = STATLIST_GetUnitStat113c(m, pPlayer, 67, 0) | 0
  const speed = computeRawPlayerAnimSpeedPure113c({
    mode: atkMode,
    classId,
    statAcc: effIas,
    stat68Acc: atkRate,
    stat67Acc: velPct,
    weaponClass: weaponClassCode,
  })
  const startFrame = playerAnimStartFramePure113c(classId, atkMode, weaponClassCode)
  const startPrecise = (startFrame << 8) >>> 0
  const countPrecise = (clip.frames << 8) >>> 0

  m.set(pPlayer, D2UnitStrc.dwFramePrecise, startPrecise)
  m.set(pPlayer, D2UnitStrc.dwFrameCountPrecise, countPrecise)
  m.set(pPlayer, D2UnitStrc.wAnimSpeed, speed & 0xffff)
  m.set(pPlayer, D2UnitStrc.wActionFrame, 1)

  const firstEvent = clip.events[0]
  const actionFrameIdx = firstEvent !== undefined ? firstEvent.f : Math.max(1, clip.frames >> 1)
  let actionTicks = 0
  let curPrecise = startPrecise
  for (let tick = 1; tick <= 64; tick++) {
    curPrecise = (curPrecise + speed) >>> 0
    const frameIdx = curPrecise >>> 8
    if (actionTicks === 0 && frameIdx >= actionFrameIdx) {
      actionTicks = tick
    }
    if (curPrecise >= countPrecise) {
      PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pPlayer, actionTicks, tick)
      return 1
    }
  }
  PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pPlayer, 6, 15)
  return 1
}

/**
 * `@va D2Game:0x6FC98A90` (`PLAYER_StartModeCast` / `PLAYER_CheckEquippedWeaponsBroken`, `832B`):
 * Inspects equipped right/left weapons for `STAT_DURABILITY (72) <= 0` when `STAT_MAXDURABILITY (73) > 0`
 * and `STAT_ITEM_INDESTRUCTIBLE (152) == 0` (marking `ITEMFLAG_BROKEN = 0x100`), then starts `PLRMODE_CAST (10)`
 * via `PLAYER_StartModeSkill113c` (with `STAT_ITEM_FASTERCASTRATE = 105`).
 */
export function PLAYER_StartModeCast113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pTarget = 0,
  weaponClassCode = '1HS',
  bCheckBrokenOnly = false,
): number {
  hitD2GameVa113c(0x6FC98A90)
  if (pPlayer === 0 || (m.u32(pPlayer >>> 0) | 0) !== UNIT_PLAYER) return 0
  if (bCheckBrokenOnly) {
    const pInv = m.get(pPlayer, D2UnitStrc.pInventory) >>> 0
    if (pInv === 0) return 1
    let didSetNeutral = false
    let pNode = INVENTORY_GetFirstItem113c(m, pInv) >>> 0
    while (pNode !== 0) {
      if ((INVENTORY_GetItemNodePositionOther113c(m, pNode) | 0) === 3) {
        const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
        if (
          pItem !== 0 &&
          ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x2d) !== 0 &&
          ITEMS_CanItemLoseDurability113c(m, pItem) !== 0 &&
          (STATLIST_GetUnitStat113c(m, pItem, 0x48, 0) | 0) <= 0 &&
          ITEMS_CheckCommandFlags113c(m, pItem, 0x100) === 0
        ) {
          if (!didSetNeutral) {
            UNITS_ChangeAnimMode113c(m, pPlayer, 1)
            didSetNeutral = true
          }
          ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c(m, pItem, pPlayer, pGame)
          pNode = INVENTORY_GetFirstItem113c(m, pInv) >>> 0
          continue
        }
      }
      pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    }
    return 1
  }
  if (pGame === 0) return 0
  const pInv = m.get(pPlayer, D2UnitStrc.pInventory)
  if (pInv !== 0) {
    for (let slot = 4; slot <= 5; slot++) {
      const pWpn = findItemInInventoryByBodyLocK2(m, pInv, slot)
      if (
        pWpn !== 0 &&
        STATLIST_GetUnitStat113c(m, pWpn, 73, 0) > 0 &&
        STATLIST_GetUnitStat113c(m, pWpn, 152, 0) === 0 &&
        STATLIST_GetUnitStat113c(m, pWpn, 72, 0) <= 0
      ) {
        const pItemData = m.u32((pWpn + 0x14) >>> 0) >>> 0
        if (pItemData !== 0) {
          m.setU32((pItemData + 0x18) >>> 0, (m.u32((pItemData + 0x18) >>> 0) | 0x100) >>> 0)
        }
      }
    }
  }
  return PLAYER_StartModeSkill113c(m, pGame, pPlayer, 10, pTarget, weaponClassCode)
}

/**
 * `@va D2Game:0x6FC99170` (`PLAYER_StartModeDispatch`, `2280B`):
 * Top-level player animation mode dispatcher (`0..19`) routing `PLRMODE_ATTACK1/2 (7/8)`,
 * `PLRMODE_BLOCK (9)`, `PLRMODE_CAST (10)`, `PLRMODE_THROW/KICK/SKILL (11..14, 18)`, and base modes.
 */
export function PLAYER_StartModeDispatch113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mode: number,
  pTarget = 0,
  weaponClassCode = '1HS',
  onKeyframeDoSkill?: (m: Memory113c, pGame: number, pPlayer: number, eventArg: number, seqArg: number) => number,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FC99170)
  if (dllAbi) {
    const plr = pPlayer >>> 0
    const game = pGame >>> 0
    const arg14 = mode | 0
    const arg18 = pTarget | 0
    const pSkill = SKILLS_GetUsedSkillMemPort113c(m, plr) >>> 0
    if (pSkill === 0) return 2
    UNITS_SetSeqFrameFromLowByte113c(m, plr, arg18)
    const flags = SKILLS_GetFlags113c(m, pSkill) | 0
    let shouldDoSkill = false
    if ((flags & 1) !== 0) {
      SUNIT_ValidatePathTargetUnit113c(m, plr, game)
      if (MONSTER_StepPath113c(m, plr, game, true) === 2) {
        SKILLS_SetParam0C113c(m, pSkill, (flags | 2) >>> 0)
        shouldDoSkill = true
      }
    }
    if (!shouldDoSkill) {
      const bit6 = plr !== 0 ? ((m.u32((plr + 0xc4) >>> 0) >>> 6) & 1) : 0
      if (bit6 === 0 && (arg14 === 1 || arg14 === 2)) {
        shouldDoSkill = true
      }
    }
    if (shouldDoSkill) {
      const unitType = m.get(plr, D2UnitStrc.dwUnitType) >>> 0
      const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) | 0
      const pSkillsTxt = nSkillId >= 0 ? SKILLS_GetRecordPtrFast113c(m, nSkillId) >>> 0 : 0
      if (
        pSkillsTxt !== 0 &&
        (unitType === 0 || unitType === 1) &&
        (flags & 1) === 0 &&
        (m.u8((pSkillsTxt + 5) >>> 0) & 1) === 0
      ) {
        const pRoom = UNITS_GetRoom113c(m, plr) >>> 0
        if (pRoom === 0 || DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
          SKILLS_SetUsedSkill113c(m, plr, 0)
          if (unitType === 0 && AITHINK_CanPlayerSwitchToMode113c(m, plr, game, 5) !== 0) {
            PLAYER_SetNeutralOrTownNeutralMode113c(m, game, plr, 5, 0, 0)
          }
          return (SUNIT_IsDeadOrDying113c(m, plr) !== 0 ? 1 : 0) + 1
        }
      }
      if (onKeyframeDoSkill !== undefined) {
        onKeyframeDoSkill(m, game, plr, arg14, arg18)
      } else {
        SKILLS_DoUsedSkillAction113c(m, plr, game)
      }
    }
    return (SUNIT_IsDeadOrDying113c(m, plr) !== 0 ? 1 : 0) + 1
  }
  if (pGame === 0 || pPlayer === 0) return 0
  if (onKeyframeDoSkill !== undefined) {
    // True 1.13c `0x6FC99170` (`PLRMODE_DoSkillActionEvent`): `mode` carries `eventArg` (`1` or `2`), `pTarget` carries `seqArg`
    const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pPlayer) >>> 0
    if (pSkill === 0) return 2
    const savedSeqFrame = m.get(pPlayer, D2UnitStrc.dwSeqFramePrecise)
    UNITS_SetSeqFrameFromLowByte113c(m, pPlayer, mode)
    m.set(pPlayer, D2UnitStrc.dwSeqFramePrecise, savedSeqFrame)
    const alreadyFired = ((m.u32((pPlayer + 0xc4) >>> 0) >>> 6) & 1) !== 0
    if (!alreadyFired && (mode === 1 || mode === 2)) {
      onKeyframeDoSkill(m, pGame, pPlayer, mode, pTarget)
    }
    return SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0 ? 1 : 0
  }
  if (mode === 7 || mode === 8) {
    return PLAYER_StartModeAttackWithTarget113c(m, pGame, pPlayer, mode, pTarget, weaponClassCode)
  }
  if (mode === 9) {
    return PLAYER_StartBlockMode113c(m, pGame, pPlayer, weaponClassCode)
  }
  if (mode === 10) {
    return PLAYER_StartModeCast113c(m, pGame, pPlayer, pTarget, weaponClassCode)
  }
  if ((mode >= 11 && mode <= 14) || mode === 18) {
    return PLAYER_StartModeSkill113c(m, pGame, pPlayer, mode, pTarget, weaponClassCode)
  }
  return UNITS_ChangeAnimMode113c(m, pPlayer, mode)
}

function monGetThreatPriorityK2(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const uType = m.u32(pUnit >>> 0) | 0
  if (uType === 0) return 0x0e
  if (uType !== 1) return 0
  const classId = m.u32((pUnit + 0x04) >>> 0) | 0
  if (classId < 0) return 0
  const pMonStats = getMonStatsRecordPtrSafeK2(m, classId) >>> 0
  return pMonStats !== 0 ? m.u8((pMonStats + 0x4e) >>> 0) : 0
}

registerAiTargetModeCallback113c(5, (m, pGame, pOriginUnit, pCandidateUnit, pCtx) => {
  if (isSgptDataTablesLoaded113c(m)) {
    return MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c(
      m as SparseMemory113c,
      pGame,
      pOriginUnit,
      pCandidateUnit,
      pCtx,
    )
  }
  if (pCandidateUnit !== 0) {
    const candType = m.u32(pCandidateUnit >>> 0) | 0
    if (
      candType >= 0 &&
      candType <= 1 &&
      SUNIT_IsDeadOrDying113c(m, pCandidateUnit) === 0 &&
      ((m.u32((pCandidateUnit + 0xc4) >>> 0) >>> 2) & 1) !== 0 &&
      SUNIT_AreUnitsHostileOrUnaligned113c(m, pCandidateUnit, pOriginUnit, pGame) !== 0
    ) {
      const dist = UNITS_GetDistanceToOtherUnit113c(m, pCandidateUnit, pOriginUnit) | 0
      if (dist > (m.u32((pCtx + 0x0c) >>> 0) | 0)) return 0
      const prio = monGetThreatPriorityK2(m, pCandidateUnit) | 0
      if (prio > 1) {
        if (dist >= (m.u32((pCtx + 0x04) >>> 0) | 0)) return 0
      } else {
        if (dist >= (m.u32((pCtx + 0x18) >>> 0) | 0)) return 0
      }
      if (m.u32((pCtx + 0x08) >>> 0) !== 0) {
        if (UNITS_HasCollisionBetweenUnits113c(m, pCandidateUnit, pOriginUnit, 4) !== 0) {
          return 0
        }
      }
      if (prio > 1) {
        m.setU32(pCtx >>> 0, pCandidateUnit >>> 0)
        m.setU32((pCtx + 0x04) >>> 0, dist >>> 0)
      } else {
        m.setU32((pCtx + 0x14) >>> 0, pCandidateUnit >>> 0)
        m.setU32((pCtx + 0x18) >>> 0, dist >>> 0)
      }
      return 0
    }
  }
  if (
    pCandidateUnit !== 0 &&
    (m.u32(pCandidateUnit >>> 0) | 0) === 1 &&
    (pOriginUnit === 0 || (m.u32(pOriginUnit >>> 0) | 0) !== 0) &&
    UNIT_GetAlignment113c(m, pOriginUnit) === 0 &&
    m.u32((pCtx + 0x08) >>> 0) !== 0 &&
    MONSTERS_IsDead113c(m, pCandidateUnit) === 0
  ) {
    const pCandMonData = m.u32((pCandidateUnit + 0x14) >>> 0) >>> 0
    const pCandAiGen = pCandMonData !== 0 ? (m.u32((pCandMonData + 0x28) >>> 0) >>> 0) : 0
    if (pCandAiGen !== 0 && (m.u8((pCandAiGen + 0x08) >>> 0) & 8) !== 0) {
      const candRoom = UNITS_GetRoom113c(m, pCandidateUnit) >>> 0
      const candX = UNIT_GetPosX113c(m, pCandidateUnit) | 0
      const candY = UNIT_GetPosY113c(m, pCandidateUnit) | 0
      const candIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, candRoom, candX, candY) | 0
      if (candIdx === (m.u32((pCtx + 0x10) >>> 0) | 0)) {
        m.setU16((pCandAiGen + 0x08) >>> 0, m.u16((pCandAiGen + 0x08) >>> 0) | 8)
        m.setU32((pCtx + 0x08) >>> 0, 0)
      }
    }
  }
  return 0
})

/**
 * `@va D2Game:0x6FCD1820` (`AI_FindTargetScanRoomCallback`, `468B`):
 * Evaluates cached/provoked target or monster-confusion room scan (`case 1..4` on `pMonData->+0x38`),
 * plus legacy JS-caller `bestTargetState` room-scan callback overload.
 */
export function AI_FindTargetScanRoomCallback113c(
  m: Memory113c,
  pMonster: number,
  arg2: number,
  arg3: number,
  arg4: { pBestUnit: number; bestDist: number } | number,
  arg5: boolean | number = false,
  arg6 = 0,
): number {
  hitD2GameVa113c(0x6FCD1820)
  if (typeof arg4 === 'number') {
    const pGame = arg2 >>> 0
    const bCheckLosForMode5 = arg3 | 0
    const bMode6 = arg4 | 0
    const ppOutTarget = (arg5 as number) >>> 0
    const pnOutDist = arg6 >>> 0
    if (pMonster === 0 || (m.u32(pMonster >>> 0) | 0) !== UNIT_MONSTER) return 0
    const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonData === 0) return 0
    const state = m.u32((pMonData + 0x38) >>> 0) >>> 0
    if (state === 0) return 0

    const clearAndReturn0 = (): number => {
      if ((m.u32(pMonster >>> 0) | 0) === UNIT_MONSTER) {
        const mdNow = m.u32((pMonster + 0x14) >>> 0) >>> 0
        if (mdNow !== 0) {
          m.setU32((mdNow + 0x38) >>> 0, 0)
          m.setU32((mdNow + 0x34) >>> 0, 0)
        }
      }
      return 0
    }

    let pFound = 0
    let foundDist = 0
    const findInHashTable = (tableOff: number): boolean => {
      const dwGuid = MONSTER_GetBossMinionField34_113c(m, pMonster) >>> 0
      if (pGame === 0) {
        throw new D2CommonAssertError('AiThink.cpp', 0x2d3)
      }
      let node = m.u32((pGame + tableOff + ((dwGuid & 0x7f) << 2)) >>> 0) >>> 0
      while (node !== 0) {
        if ((m.u32((node + 0x0c) >>> 0) >>> 0) === dwGuid) {
          pFound = node
          break
        }
        node = m.u32((node + 0xe4) >>> 0) >>> 0
      }
      if (pFound === 0) return false
      foundDist = UNITS_GetDistanceToOtherUnit113c(m, pFound, pMonster) | 0
      if (bCheckLosForMode5 !== 0) {
        if (UNITS_HasCollisionBetweenUnits113c(m, pFound, pMonster, 4) !== 0) {
          pFound = 0
          return false
        }
      }
      return true
    }

    if (state === 1) {
      if (!findInHashTable(0x1120)) return clearAndReturn0()
    } else if (state === 2) {
      if (!findInHashTable(0x1320)) return clearAndReturn0()
    } else if (state === 4) {
      if (!findInHashTable(0x1920)) return clearAndReturn0()
    } else if (state === 3) {
      const origAlign = UNIT_GetAlignment113c(m, pMonster) | 0
      const coinFlip = SEED_RollMaskFast113c(m, (pMonster + 0x20) >>> 0, 2) | 0
      if (origAlign === 1) {
        SUNIT_SetMonsterAlignmentState113c(m, pMonster, coinFlip === 0 ? 0 : 2, 1)
      } else if (coinFlip !== 0 && origAlign === 0) {
        SUNIT_SetMonsterAlignmentState113c(m, pMonster, 2, 1)
      } else if (coinFlip !== 0 && origAlign === 2) {
        SUNIT_SetMonsterAlignmentState113c(m, pMonster, 0, 1)
      }

      const savedSp = k2RealStackPtr
      k2RealStackPtr = (savedSp + 0x20) >>> 0
      try {
        m.fill(savedSp, 0x1c, 0)
        m.setU32(savedSp, 0)
        m.setU32((savedSp + 0x04) >>> 0, 0x7fffffff)
        if (bMode6 === 0) {
          const monRoom = UNITS_GetRoom113c(m, pMonster) >>> 0
          const monX = UNIT_GetPosX113c(m, pMonster) | 0
          const monY = UNIT_GetPosY113c(m, pMonster) | 0
          const roomIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, monRoom, monX, monY) | 0
          m.setU32((savedSp + 0x08) >>> 0, bCheckLosForMode5 >>> 0)
          m.setU32((savedSp + 0x0c) >>> 0, 0x23)
          m.setU32((savedSp + 0x10) >>> 0, roomIdx >>> 0)
          m.setU32((savedSp + 0x14) >>> 0, 0)
          m.setU32((savedSp + 0x18) >>> 0, 0x7fffffff)
          AITARGET_ScanUnitsByModeTable113c(m, 5, savedSp, pGame, pMonster, 0)
        } else {
          m.setU32((savedSp + 0x08) >>> 0, 0)
          m.setU32((savedSp + 0x0c) >>> 0, 0x7fffffff)
          m.setU32((savedSp + 0x10) >>> 0, 0x7fffffff)
          AITARGET_ScanUnitsByModeTable113c(m, 6, savedSp, pGame, pMonster, 0)
        }
        pFound = m.u32(savedSp) >>> 0
        foundDist = m.u32((savedSp + 0x04) >>> 0) | 0
      } finally {
        k2RealStackPtr = savedSp
      }
      SUNIT_SetMonsterAlignmentState113c(m, pMonster, origAlign & 0xff, 1)
    } else {
      return clearAndReturn0()
    }

    if (pFound === 0) return clearAndReturn0()
    const foundType = m.u32(pFound >>> 0) | 0
    if (foundType < 0 || (foundType > 1 && foundType !== 3)) {
      return clearAndReturn0()
    }
    if (foundType <= 1 && SUNIT_IsDeadOrDying113c(m, pFound) !== 0) {
      return clearAndReturn0()
    }
    if (ppOutTarget !== 0) m.setU32(ppOutTarget, pFound >>> 0)
    if (pnOutDist !== 0) m.setU32(pnOutDist, foundDist >>> 0)
    return 1
  }

  const pCandidate = arg2
  const maxDist = arg3
  const bestTargetState = arg4
  const enforceTownAnd55Cap = Boolean(arg5)
  if (pMonster === 0 || pCandidate === 0 || pCandidate === pMonster) return 0
  if (enforceTownAnd55Cap) {
    if (SUNIT_IsDeadOrDying113c(m, pCandidate) !== 0) return 0
    const pPlrRoom = UNITS_GetRoom113c(m, pCandidate) >>> 0
    if (pPlrRoom !== 0 && checkRoomIsTownSafeK2(m, pPlrRoom) !== 0) return 0
    const { x: mx, y: my } = getUnitPosSubtileK2(m, pMonster)
    const { x: px, y: py } = getUnitPosSubtileK2(m, pCandidate)
    const d = UNITS_GetDistanceToCoordinates113c(px, py, mx, my)
    if (d < bestTargetState.bestDist) {
      bestTargetState.bestDist = d
      if (d < 55 && d < (maxDist | 0)) {
        bestTargetState.pBestUnit = pCandidate
        return 1
      }
    }
    return 0
  }
  const candType = m.get(pCandidate, D2UnitStrc.dwUnitType)
  if (candType !== UNIT_PLAYER && candType !== UNIT_MONSTER) return 0
  if (SUNIT_IsDeadOrDying113c(m, pCandidate) !== 0) return 0
  const monAlign = UNIT_GetAlignment113c(m, pMonster)
  const candAlign = UNIT_GetAlignment113c(m, pCandidate)
  if (monAlign === candAlign || candAlign === 1) return 0
  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pMonster, pCandidate) | 0
  if (dist > (maxDist | 0)) return 0
  if (dist < bestTargetState.bestDist) {
    bestTargetState.bestDist = dist
    bestTargetState.pBestUnit = pCandidate
    return 1
  }
  return 0
}

/**
 * `@va D2Game:0x6FCD1C90` (`AI_FindNearestPlayerOrAlly`, `356B`):
 * Scans active candidates via `AI_FindTargetScanRoomCallback113c` (`0x6FCD1820`) up to `MonStats.aidist[diff]`
 * (default `35`, clamped to `1` when `STATE_DIMVISION = 23` is active on `pMonster`).
 */
export function AI_FindNearestPlayerOrAlly113c<A3 extends number | undefined = undefined>(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2 = 0,
  arg3?: A3,
  arg4 = 0,
  arg5 = 0,
  dllAbi = false,
): A3 extends number ? number : { pTarget: number; distance: number; inMeleeRange: number } {
  hitD2GameVa113c(0x6FCD1C90)
  if ((dllAbi || arg3 !== undefined) && !isMonsterSliceWorldK2(arg0)) {
    return (aiFindNearestPlayerOrAllyDirect113c(
      arg0,
      arg1 >>> 0,
      arg2 >>> 0,
      (arg3 === undefined ? 0 : arg3) >>> 0,
      arg4 >>> 0,
      arg5 >>> 0,
    ) >>> 0) as never
  }
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const { m, pGame } = world
    if (pMonster === 0) return { pTarget: 0, distance: 0x7fffffff, inMeleeRange: 0 } as never
    const row = getMonStatsRowStrictK2(m, pMonster)
    const diff = getEffectiveDiffK2(m, pGame)
    const rawAidist = row.aidist[diff]
    const radius = rawAidist > 0 ? rawAidist : 35
    const state = { pBestUnit: 0, bestDist: 0x7fffffff }
    const checkTown = world.hasFullDrlg !== undefined
    const pMonData0 = m.get(pMonster, D2UnitStrc.pUnitData) >>> 0
    const pAiGen0 = pMonData0 !== 0 ? (m.get(pMonData0, D2MonsterDataStrc.pAiGeneral) >>> 0) : 0
    let hasSubPartyBuckets = false
    if (checkTown && pGame !== 0 && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
      for (let sb = 0; sb < 10; sb++) {
        if (safeReadU32K2(m, (pGame + 0x10f8 + sb * 4) >>> 0) !== 0) {
          hasSubPartyBuckets = true
          break
        }
      }
    }
    if (
      checkTown &&
      isSgptDataTablesLoaded113c(m) &&
      (hasSubPartyBuckets ||
        (pAiGen0 !== 0 && (m.u16((pAiGen0 + 0x08) >>> 0) & 0x40) !== 0) ||
        (pMonData0 !== 0 && m.u32((pMonData0 + 0x38) >>> 0) !== 0) ||
        UNIT_GetAlignment113c(m, pMonster) !== 0)
    ) {
      ensureSliceWorldPathMemoryK2(world)
      const spDirect = k2RealStackPtr
      k2RealStackPtr = (spDirect + 0x10) >>> 0
      try {
        m.setU32(spDirect, 0x7fffffff)
        m.setU32((spDirect + 0x04) >>> 0, 0)
        const pTarget =
          aiFindNearestPlayerOrAllyDirect113c(
            m,
            pGame,
            pMonster,
            pAiGen0,
            spDirect,
            (spDirect + 0x04) >>> 0,
          ) >>> 0
        const distance = m.u32(spDirect) | 0
        const inMeleeRange = pTarget !== 0 ? (m.u32((spDirect + 0x04) >>> 0) | 0) : 0
        return { pTarget, distance, inMeleeRange } as never
      } finally {
        k2RealStackPtr = spDirect
      }
    }
    let monRoomLosDraw = 0
    if (checkTown) {
      const pMonRoom0 = UNITS_GetRoom113c(m, pMonster) >>> 0
      if (pMonRoom0 !== 0 && m.u32((pMonRoom0 + 0x10) >>> 0) !== 0) {
        monRoomLosDraw = DUNGEON_CheckLOSDraw113c(m, pMonRoom0) | 0
      }
    }
    if (checkTown && UNIT_GetAlignment113c(m, pMonster) !== 0 && world.findAlliedMonsterTarget !== undefined) {
      return world.findAlliedMonsterTarget(m, pGame, pMonster) as never
    }
    for (const pPlayer of world.playerById.values()) {
      if (!checkTown) {
        if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) continue
        const { x: mx, y: my } = getUnitPosSubtileK2(m, pMonster)
        const { x: px, y: py } = getUnitPosSubtileK2(m, pPlayer)
        const d = UNITS_GetDistanceToCoordinates113c(px, py, mx, my)
        if (d < state.bestDist) {
          state.bestDist = d
          if (d < 55 && d < radius) {
            state.pBestUnit = pPlayer
          }
        }
      } else {
        if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pPlayer, pMonster, pGame) === 0) continue
        AI_FindTargetScanRoomCallback113c(m, pMonster, pPlayer, radius, state, true)
      }
    }
    if (checkTown) {
      for (const pCand of world.monsterById.values()) {
        if (pCand === pMonster || !isHireableMonsterK2(m, pCand)) continue
        if (((m.u32((pCand + 0xc4) >>> 0) >>> 2) & 1) === 0) continue
        if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pCand, pMonster, pGame) === 0) continue
        AI_FindTargetScanRoomCallback113c(m, pMonster, pCand, radius, state, true)
      }
    }
    if (checkTown && UNIT_GetAlignment113c(m, pMonster) === 0) {
      const { x: mx, y: my } = getUnitPosSubtileK2(m, pMonster)
      const monAct = m.u8((pMonster + 0x18) >>> 0)
      let bestTargetDist =
        state.pBestUnit !== 0 && state.bestDist < radius ? state.bestDist : (radius | 0)
      if (bestTargetDist > 55) bestTargetDist = 55
      const checkAllyLos =
        monRoomLosDraw === 0 &&
        (pAiGen0 === 0 || ((m.u8((pAiGen0 + 0x08) >>> 0) >>> 3) & 1) === 0)
      // D2Game@0x6FCD1EF5..0x6FCD1F4A: scan `pGame + 0x1118` (`alignment == 1` Attract/Confuse units)
      let allyHead = pGame !== 0 ? (m.u32((pGame + 0x1118) >>> 0) >>> 0) : 0
      if (allyHead !== 0) {
        ensureSliceWorldPathMemoryK2(world)
        while (allyHead !== 0) {
          const pCand = m.u32(allyHead) >>> 0
          if (
            pCand !== 0 &&
            pCand !== pMonster &&
            m.u8((pCand + 0x18) >>> 0) === monAct &&
            SUNIT_IsDeadOrDying113c(m, pCand) === 0 &&
            ((m.get(pCand, D2UnitStrc.dwFlags) >>> 2) & 1) !== 0
          ) {
            const { x: cx, y: cy } = getUnitPosSubtileK2(m, pCand)
            const d = UNITS_GetDistanceToCoordinates113c(cx, cy, mx, my) | 0
            if (d >= 0 && d < bestTargetDist) {
              if (!checkAllyLos || UNITS_HasCollisionBetweenUnits113c(m, pMonster, pCand, 4) === 0) {
                bestTargetDist = d
                state.pBestUnit = pCand
                state.bestDist = d
              }
            }
          }
          allyHead = m.u32((allyHead + 0x08) >>> 0) >>> 0
        }
      } else {
        const align1List: number[] = []
        for (const pCand of world.monsterById.values()) {
          if (pCand === 0 || pCand === pMonster) continue
          if (m.u8((pCand + 0x18) >>> 0) !== monAct) continue
          if (SUNIT_IsDeadOrDying113c(m, pCand) !== 0) continue
          if (((m.get(pCand, D2UnitStrc.dwFlags) >>> 2) & 1) === 0) continue
          if (UNIT_GetAlignment113c(m, pCand) !== 1) continue
          align1List.push(pCand >>> 0)
        }
        if (align1List.length > 0) {
          ensureSliceWorldPathMemoryK2(world)
          for (let i = align1List.length - 1; i >= 0; i--) {
            const pCand = align1List[i]!
            const { x: cx, y: cy } = getUnitPosSubtileK2(m, pCand)
            const d = UNITS_GetDistanceToCoordinates113c(cx, cy, mx, my) | 0
            if (d >= 0 && d < bestTargetDist) {
              if (!checkAllyLos || UNITS_HasCollisionBetweenUnits113c(m, pMonster, pCand, 4) === 0) {
                bestTargetDist = d
                state.pBestUnit = pCand
                state.bestDist = d
              }
            }
          }
        }
      }
      const petList: number[] = []
      for (const pCand of world.monsterById.values()) {
        if (pCand === 0 || pCand === pMonster || isHireableMonsterK2(m, pCand)) continue
        if (m.u8((pCand + 0x18) >>> 0) !== monAct) continue
        if (SUNIT_IsDeadOrDying113c(m, pCand) !== 0) continue
        if (((m.get(pCand, D2UnitStrc.dwFlags) >>> 2) & 1) === 0) continue
        if (UNIT_GetAlignment113c(m, pCand) !== 2) continue
        const pCandRoom = UNITS_GetRoom113c(m, pCand) >>> 0
        if (pCandRoom !== 0 && checkRoomIsTownSafeK2(m, pCandRoom) !== 0) continue
        // D2Game@0x6FCD1D90..0x6FCD1DFD: skip owner player's summons when owner is out of act/town or d_plr >= 55
        const pCandData = m.get(pCand, D2UnitStrc.pUnitData)
        const pCandAiGen = pCandData !== 0 ? m.get(pCandData, D2MonsterDataStrc.pAiGeneral) : 0
        let ownerId = -1
        if (pCandAiGen !== 0 && m.get(pCandAiGen, D2AiGeneralStrc.dwLeaderType) === 0) {
          ownerId = m.get(pCandAiGen, D2AiGeneralStrc.dwLeaderId) >>> 0
        } else if (
          ((m.u32((pCand + 0xc8) >>> 0) >>> 10) & 1) !== 0 &&
          m.u32((pCand + 0x94) >>> 0) === 0
        ) {
          ownerId = m.u32((pCand + 0x98) >>> 0) >>> 0
        }
        if (ownerId >= 0) {
          const pOwnerPlr = world.playerById.get(ownerId)
          if (pOwnerPlr !== undefined && pOwnerPlr !== 0) {
            if (m.u8((pOwnerPlr + 0x18) >>> 0) !== monAct) continue
            const pOwnerRoom = UNITS_GetRoom113c(m, pOwnerPlr) >>> 0
            if (pOwnerRoom === 0 || checkRoomIsTownSafeK2(m, pOwnerRoom) !== 0) continue
            const { x: ox, y: oy } = getUnitPosSubtileK2(m, pOwnerPlr)
            if (UNITS_GetDistanceToCoordinates113c(ox, oy, mx, my) >= 55) continue
          }
        }
        petList.push(pCand >>> 0)
      }
      if (petList.length > 0) {
        ensureSliceWorldPathMemoryK2(world)
        let bestObstacle = 0
        let bestObstacleDist = 0x7fffffff
        for (let i = petList.length - 1; i >= 0; i--) {
          const pCand = petList[i]!
          const { x: cx, y: cy } = getUnitPosSubtileK2(m, pCand)
          const d = UNITS_GetDistanceToCoordinates113c(cx, cy, mx, my) | 0
          if (isSgptDataTablesLoaded113c(m) && monGetThreatPriorityK2(m, pCand) <= 1) {
            if (d >= 0 && d < bestObstacleDist) {
              if (!checkAllyLos || UNITS_HasCollisionBetweenUnits113c(m, pMonster, pCand, 4) === 0) {
                bestObstacleDist = d
                bestObstacle = pCand
              }
            }
          } else if (d >= 0 && d < bestTargetDist) {
            if (UNITS_HasCollisionBetweenUnits113c(m, pMonster, pCand, 4) === 0) {
              bestTargetDist = d
              state.pBestUnit = pCand
              state.bestDist = d
            }
          }
        }
        if (bestObstacle !== 0) {
          const spObs = k2RealStackPtr
          k2RealStackPtr = (spObs + 0x10) >>> 0
          try {
            m.setU32(spObs, state.pBestUnit >>> 0)
            m.setU32((spObs + 0x04) >>> 0, bestTargetDist >>> 0)
            if (
              MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c(
                m as SparseMemory113c,
                pMonster,
                spObs,
                (spObs + 0x04) >>> 0,
                bestObstacle,
                bestObstacleDist,
              ) !== 0
            ) {
              state.pBestUnit = bestObstacle
              state.bestDist = bestObstacleDist
            } else {
              const outUnit = m.u32(spObs) >>> 0
              if (outUnit !== 0) {
                state.pBestUnit = outUnit
                state.bestDist = m.u32((spObs + 0x04) >>> 0) | 0
              }
            }
          } finally {
            k2RealStackPtr = spObs
          }
        }
      }
    }
    if (state.pBestUnit === 0) {
      return { pTarget: 0, distance: state.bestDist, inMeleeRange: 0 } as never
    }
    ensureSliceWorldPathMemoryK2(world)
    const inMelee = hasHydratedAnimDataTableK2(m)
      ? UNITS_CanUnitMeleeAttackTarget113c(m, pMonster, state.pBestUnit, 0) !== 0
      : UNITS_GetDistanceToOtherUnit113c(m, state.pBestUnit, pMonster) <=
        (row.meleeRng > 0 ? row.meleeRng : 1)
    return { pTarget: state.pBestUnit, distance: state.bestDist, inMeleeRange: inMelee ? 1 : 0 } as never
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  if (pMonster === 0) return { pTarget: 0, distance: 0x7fffffff, inMeleeRange: 0 } as never
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  const diff = getEffectiveDiffK2(m, pGame)
  const rawAidist = row !== undefined ? row.aidist[diff]! : 0
  let maxDist = rawAidist > 0 ? rawAidist : 35
  if (STATES_CheckState113c(m, pMonster, 23) !== 0) {
    maxDist = 1
  }

  const state = { pBestUnit: 0, bestDist: 0x7fffffff }
  const pRoom = UNITS_GetRoom113c(m, pMonster)
  if (pRoom !== 0) {
    const nRoomsNear = m.get(pRoom, D2ActiveRoomStrc.nRoomsNear) >>> 0
    const ppRoomsNear = m.get(pRoom, D2ActiveRoomStrc.ppRoomsNear) >>> 0
    if (nRoomsNear > 0 && ppRoomsNear !== 0) {
      for (let i = 0; i < nRoomsNear; i++) {
        const nearRoom = m.u32((ppRoomsNear + i * 4) >>> 0) >>> 0
        let u = nearRoom !== 0 ? m.get(nearRoom, D2ActiveRoomStrc.pUnitFirst) : 0
        while (u !== 0) {
          AI_FindTargetScanRoomCallback113c(m, pMonster, u, maxDist, state)
          u = m.get(u, D2UnitStrc.pRoomUnitNext)
        }
      }
    } else {
      let u = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
      while (u !== 0) {
        AI_FindTargetScanRoomCallback113c(m, pMonster, u, maxDist, state)
        u = m.get(u, D2UnitStrc.pRoomUnitNext)
      }
    }
  }

  if (state.pBestUnit === 0 && pGame !== 0) {
    // 0x6FCD1D29..0x6FCD1EEF: scan pGame->pPlayerList[0..7] (+0x10F8), NOT pGame->pUnitHash (+0x1120)
    const monAct = m.u8((pMonster + 0x18) >>> 0)
    for (let slot = 0; slot < 8; slot++) {
      let node = m.u32((pGame + 0x10f8 + slot * 4) >>> 0) >>> 0
      while (node !== 0) {
        const u = m.u32(node) >>> 0
        if (u !== 0 && m.u32(u) === 0 && m.u8((u + 0x18) >>> 0) === monAct) {
          AI_FindTargetScanRoomCallback113c(m, pMonster, u, maxDist, state)
        }
        node = m.u32((node + 0x08) >>> 0) >>> 0
      }
    }
  }

  if (state.pBestUnit === 0) {
    return { pTarget: 0, distance: 0x7fffffff, inMeleeRange: 0 } as never
  }
  if (UNIT_GetAlignment113c(m, pMonster) !== 2 && m.u32(pMonster) === UNIT_MONSTER) {
    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    if (pMonData !== 0) {
      const pAiCtrl = m.get(pMonData, D2MonsterDataStrc.pAiControl)
      if (pAiCtrl !== 0) {
        m.setU8((pAiCtrl + 0x08) >>> 0, (m.u8((pAiCtrl + 0x08) >>> 0) | 0x08) & 0xff)
      }
    }
  }
  const meleeRng = row !== undefined ? Math.max(1, row.meleeRng + 1) : 2
  const inMeleeRange = state.bestDist <= meleeRng ? 1 : 0
  return { pTarget: state.pBestUnit, distance: state.bestDist, inMeleeRange } as never
}

function writeD2AiParamStrcK2(
  m: Memory113c,
  pAiParam: number,
  pAiGen: number,
  pMonTxt: number,
  pMon2Txt: number,
  pfnThink: number,
  pTarget: number,
  dist: number,
  inMelee: boolean,
): void {
  m.setU32((pAiParam + D2AiParamStrcOffK2.pAiControl) >>> 0, pAiGen >>> 0)
  m.setU32((pAiParam + D2AiParamStrcOffK2.pAiFn) >>> 0, pfnThink >>> 0)
  m.setU32((pAiParam + D2AiParamStrcOffK2.pTarget) >>> 0, pTarget >>> 0)
  m.setU32((pAiParam + D2AiParamStrcOffK2.nStallFrames) >>> 0, 0)
  m.setU32((pAiParam + D2AiParamStrcOffK2.bEngaged) >>> 0, pTarget !== 0 ? 1 : 0)
  m.setU32((pAiParam + D2AiParamStrcOffK2.nDistanceToTarget) >>> 0, dist >>> 0)
  m.setU32((pAiParam + D2AiParamStrcOffK2.bInMeleeRange) >>> 0, inMelee ? 1 : 0)
  m.setU32((pAiParam + D2AiParamStrcOffK2.pMonStatsTxt) >>> 0, pMonTxt >>> 0)
  m.setU32((pAiParam + D2AiParamStrcOffK2.pMonStats2Txt) >>> 0, pMon2Txt >>> 0)
}

function dispatchCoreAiThinkByVaK2(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
  pfnThink: number,
): boolean {
  switch (pfnThink >>> 0) {
    case 0x6fc39c20:
      AI_WarrivGreet113c(m, pGame, pUnit, pAiParam)
      return true
    case 0x6fca3130:
      AiFallen113c(m, pGame, pUnit, pAiParam)
      return true
    case 0x6fca3550:
      AI_Skeleton113c(m, pGame, pUnit, pAiParam)
      return true
    case 0x6fca38b0:
      AiZombie113c(m, pGame, pUnit, pAiParam)
      return true
    case 0x6fca90a0:
      AI_FallenShaman113c(m, pGame, pUnit, pAiParam)
      return true
    default:
      return false
  }
}

function runSliceWorldAiThinkWithStackK2(
  world: MonsterSliceWorldLike113c,
  pMonster: number,
  pfnThink: number,
  bestTarget: number,
  minDist: number,
  inMelee: boolean,
  validateCombatTarget: boolean,
): void {
  const { m, pGame } = world
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
  const rawMonTxt = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pMonStatsTxt) : 0
  const cls = m.get(pMonster, D2UnitStrc.dwClassId) | 0
  const tablesLoaded = isSgptDataTablesLoaded113c(m)
  const pMonTxt = rawMonTxt !== 0 ? rawMonTxt : (tablesLoaded ? (MONSTATS_GetRecordPtr113c(m, cls) >>> 0) : 0)
  const pMon2Txt = tablesLoaded ? (MONSTATS2_GetRecordPtr113c(m, cls) >>> 0) : 0
  const savedSp = k2RealStackPtr
  k2RealStackPtr = (savedSp + D2AiParamStrc_SIZE_K2) >>> 0
  try {
    writeD2AiParamStrcK2(
      m,
      savedSp,
      pAiGen,
      pMonTxt,
      pMon2Txt,
      pfnThink,
      bestTarget,
      minDist,
      inMelee,
    )
    if (validateCombatTarget && tablesLoaded && pAiGen !== 0) {
      if (AI_AcquireOrValidateCombatTarget113c(m, savedSp, pMonster, pGame) !== 0) {
        return
      }
    }
    const registeredThink = getRegisteredMonsterAiThinkVaHandler113c(pfnThink)
    ensureSliceWorldPathMemoryK2(world)
    const prevSiegeThinkC = inSiegeMinionThinkC0x64K2
    if (pfnThink === 0x6fcc7530 && cls === 0x21c) {
      inSiegeMinionThinkC0x64K2 = true
    }
    try {
      if (registeredThink !== undefined) {
        registeredThink(m, pGame, pMonster, savedSp)
      } else if (!dispatchCoreAiThinkByVaK2(m, pGame, pMonster, savedSp, pfnThink)) {
        throw new Error(`Unsupported monster pfnThink VA: 0x${pfnThink.toString(16)}`)
      }
    } finally {
      inSiegeMinionThinkC0x64K2 = prevSiegeThinkC
    }
  } finally {
    k2RealStackPtr = savedSp
  }
}

/**
 * `@va D2Game:0x6FD13220` (`AI_GeneralFindTargetOrThrottle`, `312B`):
 * Acquires the nearest hostile target via `AI_FindNearestPlayerOrAlly113c` (`0x6FCD1C90`), handles
 * no-target always-chase / border-overhang wander / distance-proportional `AI_Stall113c`, and dispatches
 * `pAiGeneral->pfnThink` (`AiFallen` `0x6FCA3130`, `AiZombie` `0x6FCA38B0`, etc.).
 */
export function AI_GeneralFindTargetOrThrottle113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4 = 0,
  arg5 = 0,
  dllAbi = false,
): number | void {
  hitD2GameVa113c(0x6FD13220)
  if (dllAbi && !isMonsterSliceWorldK2(arg0)) {
    return aiFindTargetOrStallDirect113c(
      arg0,
      arg2 >>> 0,
      arg3 >>> 0,
      arg1 >>> 0,
      arg4 >>> 0,
      arg5 >>> 0,
    ) >>> 0
  }
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const pfnThink = arg2 >>> 0
    const { m } = world
    if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return

    if (pfnThink === VA_AI_HIREABLE_K2) {
      world.onHireableAiThink?.(world, pMonster)
      return
    }

    const row = getMonStatsRowStrictK2(m, pMonster)
    const targetInfo = AI_FindNearestPlayerOrAlly113c(world, pMonster)
    const minDist = targetInfo.distance
    const bestTarget = targetInfo.pTarget

    if (bestTarget === 0) {
      if (world.hasFullDrlg !== undefined) {
        if (MONSTER_HasAlwaysChaseFlag113c(m, pMonster) !== 0 && row.modeFrames[2] > 0) {
          ensureSliceWorldPathMemoryK2(world)
          AI_IdleWander113c(world, pMonster, 5)
          return
        }
        const pPath = m.get(pMonster, D2UnitStrc.pPath)
        const pat = pPath !== 0 ? PATH_GetUnitCollisionPattern113c(m, pMonster) : 0
        const pMonRoom = UNITS_GetRoom113c(m, pMonster) >>> 0
        const { x: mx, y: my } = getUnitPosSubtileK2(m, pMonster)
        if (
          pMonRoom !== 0 &&
          COLLISION_CheckMaskWithPattern2_113c(m, pMonRoom, mx, my, pat, 0x40) !== 0 &&
          row.modeFrames[2] > 0
        ) {
          ensureSliceWorldPathMemoryK2(world)
          AI_IdleWander113c(world, pMonster, 5)
          return
        }
      }

      let delay: number
      if (minDist >= 35) delay = 25
      else if (minDist < 25) delay = 10
      else delay = minDist - 10
      AI_Stall113c(world, pMonster, delay)
      return
    }

    if (isSgptDataTablesLoaded113c(m)) {
      const pMonDataVal = m.get(pMonster, D2UnitStrc.pUnitData)
      const pAiGenVal = pMonDataVal !== 0 ? m.get(pMonDataVal, D2MonsterDataStrc.pAiGeneral) : 0
      if (pAiGenVal !== 0) {
        const clsVal = m.get(pMonster, D2UnitStrc.dwClassId) | 0
        const pAiParamVal = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
        monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
        let abortedByTargetVal = false
        try {
          m.fill(pAiParamVal, 0x24, 0)
          m.setU32(pAiParamVal, pAiGenVal >>> 0)
          m.setU32((pAiParamVal + 0x08) >>> 0, bestTarget >>> 0)
          m.setU32((pAiParamVal + 0x14) >>> 0, minDist >>> 0)
          m.setU32((pAiParamVal + 0x18) >>> 0, targetInfo.inMeleeRange >>> 0)
          m.setU32((pAiParamVal + 0x1c) >>> 0, MONSTATS_GetRecordPtr113c(m, clsVal) >>> 0)
          m.setU32((pAiParamVal + 0x20) >>> 0, MONSTATS2_GetRecordPtr113c(m, clsVal) >>> 0)
          if (AI_AcquireOrValidateCombatTarget113c(m, pAiParamVal, pMonster, world.pGame) !== 0) {
            abortedByTargetVal = true
          }
        } finally {
          monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
        }
        if (abortedByTargetVal) return
      }
    }

    const inMelee = targetInfo.inMeleeRange !== 0
    if (pfnThink === VA_AI_FALLEN_K2) {
      AiFallen113c(world, pMonster, bestTarget, minDist, inMelee)
    } else if (pfnThink === VA_AI_ZOMBIE_K2) {
      AiZombie113c(world, pMonster, bestTarget, minDist, inMelee)
    } else {
      runSliceWorldAiThinkWithStackK2(world, pMonster, pfnThink, bestTarget, minDist, inMelee, false)
    }
    return
  }

  const m = arg0
  const pGame = arg1
  const pUnit = arg2
  const pAiTickArgs = arg3
  if (pGame === 0 || pUnit === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) return

  const pMonsterData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pMonsterData === 0) return
  const pAiGeneral = m.get(pMonsterData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGeneral === 0) return
  const pfnThink = m.get(pAiGeneral, D2AiGeneralStrc.pfnThink) >>> 0

  const targetInfo = AI_FindNearestPlayerOrAlly113c(m, pGame, pUnit)
  if (targetInfo.pTarget === 0) {
    // 0x6FD1323F..0x6FD1334C: no hostile target -> check always-chase / overhang wander, else AI_Stall
    const clsNoTgt = m.get(pUnit, D2UnitStrc.dwClassId) | 0
    const subType = m.u32((pMonsterData + 0x54) >>> 0) | 0
    if ((subType === 3 || subType === 0x13) && MONSTATS2_CheckModeBit113c(m, clsNoTgt, 2) !== 0) {
      AI_IdleWander113c(m, pGame, pUnit, 5)
      return
    }
    const pMonRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    const pPath = m.get(pUnit, D2UnitStrc.pPath)
    if (pMonRoom !== 0 && pPath !== 0) {
      const pat = PATH_GetUnitCollisionPattern113c(m, pUnit)
      const { x: mx, y: my } = getUnitPosSubtileK2(m, pUnit)
      if (
        COLLISION_CheckMaskWithPattern2_113c(m, pMonRoom, mx, my, pat, 0x40) !== 0 &&
        MONSTATS2_CheckModeBit113c(m, clsNoTgt, 2) !== 0
      ) {
        AI_IdleWander113c(m, pGame, pUnit, 5)
        return
      }
    }
    const minDist = targetInfo.distance | 0
    const delay = minDist >= 35 ? 25 : minDist < 25 ? 10 : (minDist - 10) | 0
    AI_Stall113c(m, pGame, pUnit, delay)
    return
  }
  const savedSp = k2RealStackPtr
  const pAiParam =
    pAiTickArgs !== 0
      ? (pAiTickArgs >>> 0)
      : ((k2RealStackPtr = (k2RealStackPtr + D2AiParamStrc_SIZE_K2) >>> 0), savedSp)
  try {
    const cls = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
    const pMon2Txt = isSgptDataTablesLoaded113c(m) ? (MONSTATS2_GetRecordPtr113c(m, cls | 0) >>> 0) : 0
    writeD2AiParamStrcK2(
      m,
      pAiParam,
      pAiGeneral,
      m.get(pMonsterData, D2MonsterDataStrc.pMonStatsTxt),
      pMon2Txt,
      pfnThink,
      targetInfo.pTarget,
      targetInfo.distance,
      targetInfo.inMeleeRange !== 0,
    )

    if (targetInfo.pTarget !== 0) {
      AI_CheckApproachTauntSound113c(m, pGame, pUnit, pAiParam)
    }

    if (pfnThink === 0x6fc39c20 || cls === 155) {
      AI_WarrivGreet113c(m, pGame, pUnit, pAiParam)
      return
    }
    const registeredThinkRaw = getRegisteredMonsterAiThinkVaHandler113c(pfnThink)
    if (registeredThinkRaw !== undefined) {
      registeredThinkRaw(m, pGame, pUnit, pAiParam)
      return
    }
    if (dispatchCoreAiThinkByVaK2(m, pGame, pUnit, pAiParam, pfnThink)) {
      return
    }
    AiFallen113c(m, pGame, pUnit, pAiParam)
  } finally {
    k2RealStackPtr = savedSp
  }
}

function aiFindNearestPlayerOrAllyDirect113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pAiGen: number,
  pOutDist: number,
  pOutInMelee: number,
): number {
  const pRoom = UNITS_GetRoom113c(m, pMonster) >>> 0
  if (pRoom === 0) return 0

  const pMonData0 = (m.u32(pMonster) | 0) === UNIT_MONSTER ? (m.u32((pMonster + 0x14) >>> 0) >>> 0) : 0
  let pAiCache = 0
  let savedCacheVal = 0
  let losCheck = 0
  const wFlags = pAiGen !== 0 ? m.u16((pAiGen + 0x08) >>> 0) : 0
  if (pAiGen !== 0 && (wFlags & 0x40) !== 0) {
    m.setU16((pAiGen + 0x08) >>> 0, wFlags & 0xffbf)
    losCheck = 1
  } else if (DUNGEON_CheckLOSDraw113c(m, pRoom) !== 0) {
    losCheck = 0
  } else {
    losCheck = pAiGen !== 0 && ((m.u8((pAiGen + 0x08) >>> 0) >>> 3) & 1) !== 0 ? 0 : 1
    if ((m.u32(pMonster) | 0) === UNIT_MONSTER && pMonData0 !== 0) {
      pAiCache = m.u32((pMonData0 + 0x50) >>> 0) >>> 0
      if (losCheck !== 0 && pAiCache !== 0) {
        savedCacheVal = m.u32((pAiCache + 0x24) >>> 0) >>> 0
        losCheck = savedCacheVal === 0 ? 1 : 0
      }
    }
  }

  let bestUnit = 0
  let bestDist = 0x7fffffff
  let bestRawDist = 0x7fffffff

  const finishWithTarget = (tgt: number, distVal: number): number => {
    if (UNIT_GetAlignment113c(m, pMonster) !== 2) {
      if (pAiGen !== 0) {
        m.setU8((pAiGen + 0x08) >>> 0, (m.u8((pAiGen + 0x08) >>> 0) | 0x08) & 0xff)
      }
      if (pAiCache !== 0) {
        m.setU32((pAiCache + 0x24) >>> 0, savedCacheVal === 0 ? 1 : 0)
      }
    }
    const inMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pMonster, tgt, 0) | 0
    if (pOutInMelee !== 0) m.setU32(pOutInMelee >>> 0, inMelee >>> 0)
    if (pOutDist !== 0) m.setU32(pOutDist >>> 0, distVal >>> 0)
    return tgt >>> 0
  }

  const spScan = k2RealStackPtr
  k2RealStackPtr = (spScan + 0x30) >>> 0
  try {
    m.setU32(spScan, 0)
    m.setU32((spScan + 0x04) >>> 0, bestRawDist >>> 0)
    if (
      AI_FindTargetScanRoomCallback113c(
        m,
        pMonster,
        pGame,
        losCheck,
        0,
        spScan,
        (spScan + 0x04) >>> 0,
      ) !== 0
    ) {
      const cachedTgt = m.u32(spScan) >>> 0
      const cachedDist = m.u32((spScan + 0x04) >>> 0) | 0
      if (cachedTgt !== 0) {
        return finishWithTarget(cachedTgt, cachedDist)
      }
      if (pOutInMelee !== 0) m.setU32(pOutInMelee >>> 0, 0)
      if (pOutDist !== 0) m.setU32(pOutDist >>> 0, bestRawDist >>> 0)
      return 0
    }

    if ((UNIT_GetAlignment113c(m, pMonster) | 0) !== 0) {
      const monX = UNIT_GetPosX113c(m, pMonster) | 0
      const monY = UNIT_GetPosY113c(m, pMonster) | 0
      const roomIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pRoom, monX, monY) | 0
      const pCtx = (spScan + 0x08) >>> 0
      m.fill(pCtx, 0x1c, 0)
      m.setU32(pCtx, 0)
      m.setU32((pCtx + 0x04) >>> 0, 0x7fffffff)
      m.setU32((pCtx + 0x08) >>> 0, losCheck >>> 0)
      m.setU32((pCtx + 0x0c) >>> 0, 0x23)
      m.setU32((pCtx + 0x10) >>> 0, roomIdx >>> 0)
      m.setU32((pCtx + 0x14) >>> 0, 0)
      m.setU32((pCtx + 0x18) >>> 0, 0x7fffffff)
      AITARGET_ScanUnitsByModeTable113c(m, 5, pCtx, pGame, pMonster, 0)
      const candLow = m.u32((pCtx + 0x14) >>> 0) >>> 0
      if (candLow !== 0) {
        const distLow = m.u32((pCtx + 0x18) >>> 0) | 0
        const useBlocked = MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c(
          m,
          pMonster,
          pCtx,
          (pCtx + 0x04) >>> 0,
          candLow,
          distLow,
        )
        if (useBlocked !== 0) {
          bestUnit = m.u32((pCtx + 0x14) >>> 0) >>> 0
          bestDist = m.u32((pCtx + 0x18) >>> 0) | 0
        } else {
          bestUnit = m.u32(pCtx) >>> 0
          bestDist = m.u32((pCtx + 0x04) >>> 0) | 0
        }
      } else {
        bestUnit = m.u32(pCtx) >>> 0
        bestDist = m.u32((pCtx + 0x04) >>> 0) | 0
      }
      if (bestUnit === 0) {
        if (pOutInMelee !== 0) m.setU32(pOutInMelee >>> 0, 0)
        if (pOutDist !== 0) m.setU32(pOutDist >>> 0, bestRawDist >>> 0)
        return 0
      }
      return finishWithTarget(bestUnit, bestDist)
    }

    let maxDist = 0x23
    if (pMonster !== 0 && (m.u32(pMonster) | 0) === UNIT_MONSTER && pMonData0 !== 0) {
      const pMonTxt = m.u32(pMonData0) >>> 0
      if (pMonTxt !== 0) {
        const diff = pGame !== 0 ? m.u8((pGame + 0x6d) >>> 0) : 0
        const rawAiDist = m.u8((pMonTxt + diff + 0x52) >>> 0)
        if (rawAiDist !== 0) maxDist = rawAiDist
      }
    }

    const monAct = m.u8((pMonster + 0x18) >>> 0)
    const monX = UNIT_GetPosX113c(m, pMonster) | 0
    const monY = UNIT_GetPosY113c(m, pMonster) | 0
    if (pGame !== 0) {
      for (let slot = 0; slot < 8; slot++) {
        let node = m.u32((pGame + 0x10f8 + slot * 4) >>> 0) >>> 0
        if (node === 0) continue
        const headUnit = m.u32(node) >>> 0
        if (headUnit === 0 || (m.u32(headUnit) | 0) !== UNIT_PLAYER) {
          throw new D2CommonAssertError('AiThink.cpp', 0x5f6)
        }
        if (m.u8((headUnit + 0x18) >>> 0) !== monAct) continue
        const uRoom = UNITS_GetRoom113c(m, headUnit) >>> 0
        if (uRoom === 0 || DUNGEON_CheckRoomIsTownMemPort113c(m, uRoom) !== 0) continue

        let d = UNITS_GetDistanceToCoordinates113c(m, headUnit, monX, monY) | 0
        if ((d >>> 0) < (bestRawDist >>> 0)) {
          bestRawDist = d
        }
        if ((d >>> 0) >= 0x37) continue
        if (SUNIT_IsDeadOrDying113c(m, headUnit) !== 0) {
          d = 0x7fffffff
        }
        let cand = headUnit
        while (true) {
          if ((d >>> 0) < (maxDist >>> 0)) {
            if (losCheck === 0 || UNITS_HasCollisionBetweenUnits113c(m, pMonster, cand, 4) === 0) {
              maxDist = d
              bestUnit = cand
            }
          }
          node = m.u32((node + 0x08) >>> 0) >>> 0
          if (node === 0) break
          cand = m.u32(node) >>> 0
          d = UNITS_GetDistanceToCoordinates113c(m, cand, monX, monY) | 0
        }
      }

      let allyNode = m.u32((pGame + 0x1118) >>> 0) >>> 0
      while (allyNode !== 0) {
        const cand = m.u32(allyNode) >>> 0
        if (cand !== 0 && m.u8((cand + 0x18) >>> 0) === monAct) {
          const d = UNITS_GetDistanceToCoordinates113c(m, cand, monX, monY) | 0
          if ((d >>> 0) < (maxDist >>> 0)) {
            if (losCheck === 0 || UNITS_HasCollisionBetweenUnits113c(m, pMonster, cand, 4) === 0) {
              maxDist = d
              bestUnit = cand
            }
          }
        }
        allyNode = m.u32((allyNode + 0x08) >>> 0) >>> 0
      }

      let petNode = m.u32((pGame + 0x111c) >>> 0) >>> 0
      let bestPet = 0
      let bestPetDist = 0x7fffffff
      while (petNode !== 0) {
        const cand = m.u32(petNode) >>> 0
        if (cand !== 0 && m.u8((cand + 0x18) >>> 0) === monAct) {
          const d = UNITS_GetDistanceToCoordinates113c(m, cand, monX, monY) | 0
          if ((d >>> 0) < (bestPetDist >>> 0)) {
            if (losCheck === 0 || UNITS_HasCollisionBetweenUnits113c(m, pMonster, cand, 4) === 0) {
              bestPetDist = d
              bestPet = cand
            }
          }
        }
        petNode = m.u32((petNode + 0x08) >>> 0) >>> 0
      }
      if (bestPet !== 0) {
        m.setU32(spScan, bestUnit >>> 0)
        m.setU32((spScan + 0x04) >>> 0, maxDist >>> 0)
        if (
          MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c(
            m,
            pMonster,
            spScan,
            (spScan + 0x04) >>> 0,
            bestPet,
            bestPetDist,
          ) !== 0
        ) {
          bestUnit = bestPet
          maxDist = bestPetDist
        }
      }
    }

    if (bestUnit === 0) {
      if (pOutInMelee !== 0) m.setU32(pOutInMelee >>> 0, 0)
      if (pOutDist !== 0) m.setU32(pOutDist >>> 0, bestRawDist >>> 0)
      return 0
    }
    return finishWithTarget(bestUnit, maxDist)
  } finally {
    k2RealStackPtr = spScan
  }
}

function aiFindTargetOrStallDirect113c(
  m: Memory113c,
  pMonster: number,
  pAiGen: number,
  pGame: number,
  pOutInMelee: number,
  pOutDist: number,
): number {
  const target = aiFindNearestPlayerOrAllyDirect113c(
    m,
    pGame,
    pMonster,
    pAiGen,
    pOutDist,
    pOutInMelee,
  ) >>> 0
  if (target !== 0) {
    return target
  }
  if (pMonster !== 0 && m.u32(pMonster) === UNIT_MONSTER) {
    const pMonsterData = m.get(pMonster, D2UnitStrc.pUnitData)
    if (pMonsterData !== 0) {
      const subType = m.u32((pMonsterData + 0x54) >>> 0) | 0
      const clsNoTgt = m.get(pMonster, D2UnitStrc.dwClassId) | 0
      if ((subType === 3 || subType === 0x13) && MONSTATS2_CheckModeBit113c(m, clsNoTgt, 2) !== 0) {
        AI_IdleWander113c(m, pGame, pMonster, 5)
        return 0
      }
    }
  }
  const pat = PATH_GetUnitCollisionPattern113c(m, pMonster)
  const pMonRoom = UNITS_GetRoom113c(m, pMonster) >>> 0
  const uType = m.u32(pMonster) | 0
  const pPath = m.get(pMonster, D2UnitStrc.pPath) >>> 0
  let mx = 0
  let my = 0
  if (uType === 2 || (uType >= 4 && uType <= 5)) {
    mx = m.u32((pPath + 0x0c) >>> 0) | 0
    my = m.u32((pPath + 0x10) >>> 0) | 0
  } else if (pPath !== 0) {
    mx = PATH_GetPosX113c(m, pPath) | 0
    my = PATH_GetPosY113c(m, pPath) | 0
  }
  const clsOverhang = m.get(pMonster, D2UnitStrc.dwClassId) | 0
  if (
    COLLISION_CheckMaskWithPattern2_113c(m, pMonRoom, mx, my, pat, 0x40) !== 0 &&
    MONSTATS2_CheckModeBit113c(m, clsOverhang, 2) !== 0
  ) {
    AI_IdleWander113c(m, pGame, pMonster, 5)
    return 0
  }
  const minDist = pOutDist !== 0 ? (m.u32(pOutDist >>> 0) | 0) : 0x7fffffff
  const delay = minDist >= 35 ? 25 : minDist < 25 ? 10 : (minDist - 10) | 0
  AI_Stall113c(m, pGame, pMonster, delay)
  return 0
}

export function aiFindTargetOrUnstickOverlapMem113c(
  m: Memory113c,
  pOutInMeleeRange: number,
  pOutDistance: number,
  pAiControl: number,
  pGame: number,
  pUnit: number,
): number {
  const unitRoom0 = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (unitRoom0 !== 0) {
    const foundTarget = aiFindNearestPlayerOrAllyDirect113c(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      pAiControl >>> 0,
      pOutDistance >>> 0,
      pOutInMeleeRange >>> 0,
    ) >>> 0
    if (foundTarget !== 0) {
      return foundTarget
    }
  }
  const nCollisionPattern = PATH_GetUnitCollisionPattern113c(m, pUnit >>> 0) | 0
  const { x: unitX, y: unitY } = getUnitPosSubtileK2(m, pUnit >>> 0)
  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, unitX, unitY, nCollisionPattern, 0x40) !== 0) {
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    if ((MONSTATS2_CheckModeBit113c(m, nClassId, 2) | 0) !== 0) {
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 5)
      return 0
    }
  }
  hitD2GameVa113c(0x6FD120C0)
  EVENT_DeleteEventByType113c(m, pGame >>> 0, pUnit >>> 0, 2)
  const curFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 2, (curFrame + 0x14) >>> 0, 0, 0, 0)
  return 0
}

/**
 * `@va D2Game:0x6FCBD160` (`AI_DispatchTargetByAiFlag`, `584B`):
 * Evaluates town NPC AI dispatch, active-client-room dormancy (`0x6FCBD230`), freeze/stun overrides,
 * and dispatches `AI_GeneralFindTargetOrThrottle113c` (`0x6FD13220`).
 */
export function AI_DispatchTargetByAiFlag113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2: number,
  arg3?: number,
): number | void {
  hitD2GameVa113c(0x6FCBD160)
  if (arg3 !== undefined && !isMonsterSliceWorldK2(arg0)) {
    const m = arg0
    const pAiTickParam = arg1 >>> 0
    const pMonsterUnit = arg2 >>> 0
    const pGame = arg3 >>> 0
    const pAiCtrl = m.u32(pAiTickParam) >>> 0
    const nSpecialAiIdx = m.u32(pAiCtrl) | 0
    const pRow = AI_LookupDispatchTableRow113c(m, pMonsterUnit, nSpecialAiIdx) >>> 0
    const aiMode = m.u32(pRow) >>> 0
    const pOutDist = (pAiTickParam + 0x14) >>> 0
    const pOutInMelee = (pAiTickParam + 0x18) >>> 0
    switch (aiMode) {
      case 0:
        return 0
      case 1: {
        const target = aiFindTargetOrStallDirect113c(
          m,
          pMonsterUnit,
          pAiCtrl,
          pGame,
          pOutInMelee,
          pOutDist,
        ) >>> 0
        m.setU32((pAiTickParam + 0x08) >>> 0, target)
        return target === 0 ? 1 : 0
      }
      case 2: {
        const target = aiFindNearestPlayerOrAllyDirect113c(
          m,
          pGame,
          pMonsterUnit,
          pAiCtrl,
          pOutDist,
          pOutInMelee,
        ) >>> 0
        m.setU32((pAiTickParam + 0x08) >>> 0, target)
        return 0
      }
      case 3:
        return 1
      case 4: {
        const target = aiFindTargetOrUnstickOverlapMem113c(
          m,
          pOutInMelee,
          pOutDist,
          pAiCtrl,
          pGame,
          pMonsterUnit,
        ) >>> 0
        m.setU32((pAiTickParam + 0x08) >>> 0, target)
        return target === 0 ? 1 : 0
      }
      case 5: {
        const target = aiFindTargetOrUnstickOverlapMem113c(
          m,
          pOutInMelee,
          pOutDist,
          pAiCtrl,
          pGame,
          pMonsterUnit,
        ) >>> 0
        m.setU32((pAiTickParam + 0x08) >>> 0, target)
        return 0
      }
      default:
        return 1
    }
  }
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const pfnThink = arg2 >>> 0
    const { m, pGame } = world
    if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return

    let pAiParamPre = 0
    if (isSgptDataTablesLoaded113c(m)) {
      const pMonDataPre = m.get(pMonster, D2UnitStrc.pUnitData)
      const pAiGenPre = pMonDataPre !== 0 ? m.get(pMonDataPre, D2MonsterDataStrc.pAiGeneral) : 0
      if (pAiGenPre !== 0) {
        const clsPre = m.get(pMonster, D2UnitStrc.dwClassId) | 0
        pAiParamPre = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
        monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
        let abortedPre = false
        try {
          m.fill(pAiParamPre, 0x24, 0)
          m.setU32(pAiParamPre, pAiGenPre >>> 0)
          m.setU32((pAiParamPre + 0x1c) >>> 0, MONSTATS_GetRecordPtr113c(m, clsPre) >>> 0)
          m.setU32((pAiParamPre + 0x20) >>> 0, MONSTATS2_GetRecordPtr113c(m, clsPre) >>> 0)
          if (AI_HandleStunDoorOrLeaderFollow113c(m, pMonster, pGame, pAiParamPre) !== 0) {
            abortedPre = true
          }
        } finally {
          monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
        }
        if (abortedPre) return
      }
    }

    const validateNoTarget = (): void => {
      if (pAiParamPre === 0) return
      const pAiParamTmp = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
      monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
      try {
        m.fill(pAiParamTmp, 0x24, 0)
        AI_AcquireOrValidateCombatTarget113c(m, pAiParamTmp, pMonster, pGame)
      } finally {
        monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
      }
    }

    if (pfnThink === VA_AI_HIREABLE_K2) {
      validateNoTarget()
      world.onHireableAiThink?.(world, pMonster)
      return
    }
    if (
      pfnThink === 0x6fc3db40 ||
      pfnThink === 0x6fc3bc60 ||
      pfnThink === 0x6fcbcb00 ||
      pfnThink === 0x6fc39880 ||
      pfnThink === 0x6fcca4d0
    ) {
      validateNoTarget()
      if (world.onTownNpcThink !== undefined) {
        const pMonDataTown = m.get(pMonster, D2UnitStrc.pUnitData) >>> 0
        const pAiGenTown = pMonDataTown !== 0 ? (m.get(pMonDataTown, D2MonsterDataStrc.pAiGeneral) >>> 0) : 0
        const clsTown = m.get(pMonster, D2UnitStrc.dwClassId) | 0
        const pAiTickParam = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
        monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
        let handledTown = false
        try {
          m.fill(pAiTickParam, 0x28, 0)
          m.setU32(pAiTickParam, pAiGenTown)
          m.setU32((pAiTickParam + 0x1c) >>> 0, MONSTATS_GetRecordPtr113c(m, clsTown) >>> 0)
          m.setU32((pAiTickParam + 0x20) >>> 0, MONSTATS2_GetRecordPtr113c(m, clsTown) >>> 0)
          handledTown = world.onTownNpcThink(world, pMonster, pfnThink, pAiTickParam)
        } finally {
          monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
        }
        if (handledTown) {
          return
        }
      }
      const aiBridge = KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C.get(m)
      if (aiBridge?.tryRunTownNpcThink !== undefined && aiBridge.tryRunTownNpcThink(pMonster, pfnThink)) {
        return
      }
    }

    if (world.hasFullDrlg !== undefined) {
      const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
      if (classId === 147 || classId === 148 || classId === 150 || classId === 154 || classId === 155) {
        validateNoTarget()
        world.onTownNpcAi?.(world, pMonster)
        return
      }
      if (classId === 152) {
        validateNoTarget()
        world.onRogueTownAi?.(world, pMonster)
        return
      }
      if (classId === 149 || classId === 179) {
        validateNoTarget()
        AI_Stall113c(world, pMonster, 20)
        return
      }
      if (pfnThink === 0x6fc3e900 && world.onNecroPetAi !== undefined) {
        world.onNecroPetAi(world, pMonster)
        return
      }
    }

    let aiMode = -1
    if (isSgptDataTablesLoaded113c(m)) {
      const pMonDataD = m.get(pMonster, D2UnitStrc.pUnitData)
      const pAiGenD = pMonDataD !== 0 ? m.get(pMonDataD, D2MonsterDataStrc.pAiGeneral) : 0
      if (pAiGenD !== 0) {
        const nSpecialAiIdx = m.u32(pAiGenD) | 0
        const pRow = AI_LookupDispatchTableRow113c(m, pMonster, nSpecialAiIdx) >>> 0
        aiMode = m.u32(pRow) >>> 0
      }
    }
    if (aiMode === 0 || (aiMode === -1 && pfnThink === 0x6fcc9e80)) {
      runSliceWorldAiThinkWithStackK2(world, pMonster, pfnThink, 0, 0, false, true)
      return
    }
    if (aiMode === 2 || (aiMode === -1 && pfnThink === 0x6fccb580)) {
      const targetInfo = AI_FindNearestPlayerOrAlly113c(world, pMonster)
      runSliceWorldAiThinkWithStackK2(
        world,
        pMonster,
        pfnThink,
        targetInfo.pTarget,
        targetInfo.distance,
        targetInfo.inMeleeRange !== 0,
        true,
      )
      return
    }
    if (aiMode === 3 || aiMode > 5) {
      return
    }
    if (aiMode === 4 || aiMode === 5) {
      hitD2GameVa113c(0x6FD13150)
      const pMonRoom0 = UNITS_GetRoom113c(m, pMonster) >>> 0
      const targetInfo =
        pMonRoom0 !== 0
          ? AI_FindNearestPlayerOrAlly113c(world, pMonster)
          : { pTarget: 0, distance: 0x7fffffff, inMeleeRange: 0 }
      if (targetInfo.pTarget === 0) {
        ensureSliceWorldPathMemoryK2(world)
        const nCollisionPattern = PATH_GetUnitCollisionPattern113c(m, pMonster >>> 0) | 0
        const { x: unitX, y: unitY } = getUnitPosSubtileK2(m, pMonster >>> 0)
        const pRoom = UNITS_GetRoom113c(m, pMonster >>> 0) >>> 0
        if (COLLISION_CheckMaskWithPattern2_113c(m, pRoom, unitX, unitY, nCollisionPattern, 0x40) !== 0) {
          const nClassId = m.get(pMonster, D2UnitStrc.dwClassId) | 0
          if ((MONSTATS2_CheckModeBit113c(m, nClassId, 2) | 0) !== 0) {
            AI_IdleWander113c(world, pMonster, 5)
            if (aiMode === 4) return
          } else {
            hitD2GameVa113c(0x6FD120C0)
            EVENT_DeleteEventByType113c(m, pGame >>> 0, pMonster >>> 0, 2)
            const curFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
            EVENT_SetEventFull113c(m, pGame >>> 0, pMonster >>> 0, 2, (curFrame + 0x14) >>> 0, 0, 0, 0)
            if (aiMode === 4) return
          }
        } else {
          hitD2GameVa113c(0x6FD120C0)
          EVENT_DeleteEventByType113c(m, pGame >>> 0, pMonster >>> 0, 2)
          const curFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
          EVENT_SetEventFull113c(m, pGame >>> 0, pMonster >>> 0, 2, (curFrame + 0x14) >>> 0, 0, 0, 0)
          if (aiMode === 4) return
        }
      }
      runSliceWorldAiThinkWithStackK2(
        world,
        pMonster,
        pfnThink,
        targetInfo.pTarget,
        targetInfo.distance,
        targetInfo.inMeleeRange !== 0,
        true,
      )
      return
    }

    AI_GeneralFindTargetOrThrottle113c(world, pMonster, pfnThink)
    return
  }

  const m = arg0
  const pGame = arg1
  const pUnit = arg2
  if (pGame === 0 || pUnit === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) return
  if (isSgptDataTablesLoaded113c(m)) {
    const pMonDataPre = m.get(pUnit, D2UnitStrc.pUnitData)
    const pAiGenPre = pMonDataPre !== 0 ? m.get(pMonDataPre, D2MonsterDataStrc.pAiGeneral) : 0
    if (pAiGenPre !== 0) {
      const clsPre = m.get(pUnit, D2UnitStrc.dwClassId) | 0
      const pAiParamPre = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
      monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
      let abortedPre = false
      try {
        m.fill(pAiParamPre, 0x24, 0)
        m.setU32(pAiParamPre, pAiGenPre >>> 0)
        m.setU32((pAiParamPre + 0x1c) >>> 0, MONSTATS_GetRecordPtr113c(m, clsPre) >>> 0)
        m.setU32((pAiParamPre + 0x20) >>> 0, MONSTATS2_GetRecordPtr113c(m, clsPre) >>> 0)
        if (AI_HandleStunDoorOrLeaderFollow113c(m, pUnit, pGame, pAiParamPre) !== 0) {
          abortedPre = true
        }
      } finally {
        monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
      }
      if (abortedPre) return
    }
  }
  if (STATES_CheckState113c(m, pUnit, 1) !== 0 || STATES_CheckState113c(m, pUnit, 21) !== 0) {
    AI_Stall113c(m, pGame, pUnit, 15)
    return
  }
  AI_GeneralFindTargetOrThrottle113c(m, pGame, pUnit, 0)
}

setDefaultMonsterAiThinkCallback113c((m, pGame, pUnit) => {
  AI_DispatchTargetByAiFlag113c(m, pGame, pUnit)
})

/**
 * `@va D2Game:0x6FCFFA60` (`SUNIT_GetPartyId` / legacy symbol `SUNITDMG_GetPlayerClientClassId`, `33B`):
 * Exact 1.13c port: if `pUnit != 0 && (pGame = u32[pUnit + 0x80]) != 0 && dwUnitType == UNIT_PLAYER (0)`,
 * returns `D2GAME_PARTY_GetPartyIdForUnit113c(m, pUnit, pGame) & 0xFFFF` (`0x6FCBBEB0`); otherwise returns `0xFFFF`.
 */
export function SUNITDMG_GetPlayerClientClassId113c(m: Memory113c, pUnit: number): number {
  hitD2GameVa113c(0x6FCFFA60)
  if (pUnit === 0) return 0xffff
  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  if (pGame === 0) return 0xffff
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return 0xffff
  return D2GAME_PARTY_GetPartyIdForUnit113c(m, pUnit, pGame) & 0xffff
}

/**
 * `@va D2Game:0x6FCFB5E0` (`SUNITDMG_ResolveAttackerPlayer`, `196B`):
 * Resolves `pUnit` (or a missile/summon/hireling's owner chain via `D2AiGeneralStrc` / `dwOwnerType`)
 * back to its owning `UNIT_PLAYER` pointer.
 */
export function SUNITDMG_ResolveAttackerPlayer113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCFB5E0)
  if (pUnit === 0) return 0
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (uType === UNIT_PLAYER) return pUnit
  if (uType === UNIT_MONSTER) {
    let ediOwner = 0
    const pMonData = m.get(pUnit, D2UnitStrc.pUnitData)
    const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
    if (pAiGen !== 0) {
      const ownerGame28 = safeReadU32K2(m, (pAiGen + 0x28) >>> 0)
      if (ownerGame28 !== 0 && safeReadU32K2(m, (pAiGen + 0x30) >>> 0) === UNIT_PLAYER) {
        const ownerGuid2c = safeReadU32K2(m, (pAiGen + 0x2c) >>> 0)
        const lookupGame = pGame !== 0 ? pGame : ownerGame28
        if (lookupGame !== 0) {
          const found2c = SUNIT_GetServerUnit113c(m, lookupGame, UNIT_PLAYER, ownerGuid2c)
          if (found2c !== 0 && m.get(found2c, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
            ediOwner = found2c
          }
        }
      }
      if (ediOwner === 0 && m.u32((pAiGen + 0x10) >>> 0) === UNIT_PLAYER) {
        const ownerGuid = m.u32((pAiGen + 0x0c) >>> 0) >>> 0
        if (ownerGuid !== 0 && pGame !== 0) {
          const found = SUNIT_GetServerUnit113c(m, pGame, UNIT_PLAYER, ownerGuid)
          if (found !== 0) ediOwner = found
        }
      }
    }
    if (isSgptDataTablesLoaded113c(m) && STATES_CheckStateMask30OnUnit113c(m, pUnit) !== 0) {
      const pConvList = STATLIST_GetStatListFromUnitAndFlag113c(m, pUnit, 0x800)
      if (pConvList !== 0 && pGame !== 0) {
        const convType = STATLIST_GetOwnerType113c(m, pConvList)
        const convId = STATLIST_GetOwnerId113c(m, pConvList)
        ediOwner = SUNIT_GetServerUnit113c(m, pGame, convType, convId)
      }
    }
    if (ediOwner !== 0 && m.get(ediOwner, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
      return ediOwner
    }
  }
  const ownerType = m.get(pUnit, D2UnitStrc.dwOwnerType)
  const ownerId = m.get(pUnit, D2UnitStrc.dwOwnerId)
  if (ownerType === UNIT_PLAYER && pGame !== 0) {
    return SUNIT_GetServerUnit113c(m, pGame, UNIT_PLAYER, ownerId)
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFAB90` (`SUNITDMG_PrependCombatNode`, `36B`):
 * Prepends `pCombat` (`0x88` bytes) to the LIFO head of `pAttacker->pCombat (+0xAC)`.
 */
export function SUNITDMG_PrependCombatNode113c(
  m: Memory113c,
  pAttacker: number,
  pCombat: number,
  pGameArg = 0,
  pDefArg = 0,
  pDmgArg = 0,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFAB90)
  if (dllAbi) {
    const def = pDefArg >>> 0
    if (def !== 0 && m.u32(def) === 2) {
      const cls = m.u32((def + 4) >>> 0) >>> 0
      if (cls === 7 || cls === 0x0b) return
    }
    const defType = m.u32(def) >>> 0
    if (defType !== 1 && defType !== 0) return
    const att = pAttacker >>> 0
    const game = pGameArg >>> 0
    const dmg = pDmgArg >>> 0
    const node = m.alloc(0x88) >>> 0
    m.setU32(node, game)
    m.setU32((node + 4) >>> 0, m.u32(att))
    m.setU32((node + 8) >>> 0, m.u32((att + 0x0c) >>> 0))
    m.setU32((node + 0x0c) >>> 0, defType)
    m.setU32((node + 0x10) >>> 0, m.u32((def + 0x0c) >>> 0))
    for (let i = 0; i < 0x1c; i++) {
      m.setU32((node + 0x14 + i * 4) >>> 0, m.u32((dmg + i * 4) >>> 0))
    }
    m.setU32((node + 0x84) >>> 0, m.u32((att + 0xac) >>> 0))
    m.setU32((att + 0xac) >>> 0, node)
    return
  }
  if (pAttacker === 0 || pCombat === 0) return
  const prevHead = m.get(pAttacker, D2UnitStrc.pCombat) >>> 0
  if (prevHead === (pCombat >>> 0)) return
  m.setU32((pCombat + D2CombatStrcOffK2.pNext) >>> 0, prevHead)
  m.set(pAttacker, D2UnitStrc.pCombat, pCombat >>> 0)
}

/**
 * `@va D2Game:0x6FCFA6D0` (`SUNITDMG_RemoveCombatNode`, `118B`):
 * Unlinks and frees (`m.free`) the `D2CombatStrc` node matching `(pAttacker, pDefender)` from `pAttacker->pCombat (+0xAC)`.
 */
export function SUNITDMG_RemoveCombatNode113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  hitD2GameVa113c(0x6FCFA6D0)
  if (pAttacker === 0) return 0
  const attType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  const attId = m.get(pAttacker, D2UnitStrc.dwUnitId)
  const defType = pDefender !== 0 ? m.get(pDefender, D2UnitStrc.dwUnitType) : 0
  const defId = pDefender !== 0 ? m.get(pDefender, D2UnitStrc.dwUnitId) : 0
  let removed = 0
  let prev = 0
  let cur = m.get(pAttacker, D2UnitStrc.pCombat) >>> 0
  while (cur !== 0) {
    const next = m.u32((cur + D2CombatStrcOffK2.pNext) >>> 0) >>> 0
    if (
      pDefender === 0 ||
      (m.u32((cur + D2CombatStrcOffK2.dwAttackerType) >>> 0) === attType &&
        m.u32((cur + D2CombatStrcOffK2.dwAttackerId) >>> 0) === attId &&
        m.u32((cur + D2CombatStrcOffK2.dwDefenderType) >>> 0) === defType &&
        m.u32((cur + D2CombatStrcOffK2.dwDefenderId) >>> 0) === defId)
    ) {
      if (prev === 0) {
        m.set(pAttacker, D2UnitStrc.pCombat, next)
      } else {
        m.setU32((prev + D2CombatStrcOffK2.pNext) >>> 0, next)
      }
      freeMemNodeK2(m, cur)
      removed = 1
    } else {
      prev = cur
    }
    cur = next
  }
  return removed
}

/**
 * `@va D2Game:0x6FCFAA90` (`SUNITDMG_FindCombatDamageData`, `80B`):
 * Walks `pAttacker->pCombat (+0xAC)` matching `(dwDefenderType, dwDefenderId)` and returns `&pCombat->tDamage (+0x14)`.
 */
export function SUNITDMG_FindCombatDamageData113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
): number {
  hitD2GameVa113c(0x6FCFAA90)
  if (pAttacker === 0 || pDefender === 0) return 0
  const attType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  const attId = m.get(pAttacker, D2UnitStrc.dwUnitId)
  const defType = m.get(pDefender, D2UnitStrc.dwUnitType)
  const defId = m.get(pDefender, D2UnitStrc.dwUnitId)
  let cur = m.get(pAttacker, D2UnitStrc.pCombat) >>> 0
  while (cur !== 0) {
    if (
      m.u32((cur + D2CombatStrcOffK2.dwAttackerType) >>> 0) === attType &&
      m.u32((cur + D2CombatStrcOffK2.dwAttackerId) >>> 0) === attId &&
      m.u32((cur + D2CombatStrcOffK2.dwDefenderType) >>> 0) === defType &&
      m.u32((cur + D2CombatStrcOffK2.dwDefenderId) >>> 0) === defId
    ) {
      return (cur + D2CombatStrcOffK2.tDamage) >>> 0
    }
    cur = m.u32((cur + D2CombatStrcOffK2.pNext) >>> 0) >>> 0
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFAA40` (`SUNITDMG_ApplyLevelDiffExpRatio`, `80B`):
 * Exact binary function at `0x6FCFAA40`: scales monster experience by `D2GAME_XP_RATIO_UNDER25_6FD1A01C`
 * (`clvl < 25` and `mlvl > clvl`), `mulDiv(exp, clvl, mlvl)` (`clvl >= 25` and `mlvl > clvl`), or
 * `D2GAME_XP_RATIO_OVER_6FD1A048` (`clvl >= mlvl`).
 */
export function SUNITDMG_ApplyLevelDiffExpRatio_6FCFAA40_113c(
  baseExp: number,
  clvl: number,
  mlvl: number,
): number {
  hitD2GameVa113c(0x6FCFAA40)
  if ((baseExp | 0) <= 0) return 0
  const pLvl = clvl > 0 ? (clvl | 0) : 1
  const mLvl = mlvl > 0 ? (mlvl | 0) : 1
  if (mLvl > pLvl) {
    if (pLvl >= 25) {
      return mulDiv113c(pLvl, baseExp | 0, mLvl)
    }
    const diff = Math.min(10, mLvl - pLvl)
    const mod = D2GAME_XP_RATIO_OVER_6FD1A048[diff]!
    return mod === 256 ? (baseExp | 0) : mulDiv113c(mod, baseExp | 0, 256)
  }
  const over = Math.min(10, pLvl - mLvl)
  const mod = D2GAME_XP_RATIO_UNDER25_6FD1A01C[over]!
  return mod === 256 ? (baseExp | 0) : mulDiv113c(mod, baseExp | 0, 256)
}

/**
 * `@va D2Game:0x6FCFAA40` (`SUNITDMG_GetAttackerDamageData`):
 * Returns `&pCombat->tDamage (+0x14)` from `pAttacker->pCombat` (matching `pDefender` when non-zero, else head).
 */
export function SUNITDMG_GetAttackerDamageData113c(
  m: Memory113c,
  pAttacker: number,
  pDefender = 0,
): number {
  if (pAttacker === 0) return 0
  if (pDefender !== 0) {
    const found = SUNITDMG_FindCombatDamageData113c(m, pAttacker, pDefender)
    if (found !== 0) return found
  }
  const head = m.get(pAttacker, D2UnitStrc.pCombat) >>> 0
  return head !== 0 ? (head + D2CombatStrcOffK2.tDamage) >>> 0 : 0
}

/**
 * `@va D2Game:0x6FCFA660` (`SUNITDMG_SelectDeathOverlayFlag`, `104B`):
 * Walks `D2GAME_ELEM_DEATH_OVERLAYS_6FD1B050` starting from `k2DeathOverlayRotor` (`Cold 0x30`, `Fire 0x20`,
 * `Ltng 0x40`, `Pois 0x50`) to assign `pDmg->dwHitClass` when elemental damage contributed to the kill,
 * and sets `RESULTFLAG_DEATH (0x0002)` on `pDmg->wResultFlags`.
 */
export function SUNITDMG_SelectDeathOverlayFlag113c(
  m: Memory113c,
  pDefender: number,
  pDmg: number,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFA660)
  if (dllAbi) {
    const baseClass = pDefender | 0
    const dmg = pDmg >>> 0
    const rotor = m.u8(D2GAME_DEATH_OVERLAY_ROTOR_VA_113C)
    m.setU8(D2GAME_DEATH_OVERLAY_ROTOR_VA_113C, (rotor + 1) & 0xff)
    const startIdx = rotor & 3
    let overlay = 0
    for (let i = 0; i < 4; i++) {
      const [dmgOff, ovl] = D2GAME_ELEM_DEATH_OVERLAYS_6FD1B050[(startIdx + i) & 3]!
      if ((m.u32((dmg + dmgOff) >>> 0) | 0) > 0) {
        overlay = ovl
        break
      }
    }
    if (overlay === 0 && (m.u8((dmg + 5) >>> 0) & 0x20) !== 0) {
      overlay = 0x10
    }
    return (overlay | (baseClass === 0 ? 0x0d : baseClass)) >>> 0
  }
  if (pDefender === 0 || pDmg === 0) return 0
  const flags = (m.get(pDmg, D2DamageStrc.wResultFlags) | 0x0002) & 0xffff
  m.set(pDmg, D2DamageStrc.wResultFlags, flags)
  if ((m.get(pDmg, D2DamageStrc.dwHitClass) & 0xf0) === 0) {
    for (let i = 0; i < 4; i++) {
      const idx = (k2DeathOverlayRotor + i) & 3
      const [dmgOff, overlayClass] = D2GAME_ELEM_DEATH_OVERLAYS_6FD1B050[idx]!
      if ((m.u32((pDmg + dmgOff) >>> 0) | 0) > 0) {
        m.set(pDmg, D2DamageStrc.dwHitClass, overlayClass)
        k2DeathOverlayRotor = (idx + 1) & 3
        break
      }
    }
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFA930` (`SUNITDMG_ConsumeStaminaCost`, `60B`):
 * Subtracts `staminaCost` from `STAT_STAMINA (10)` on `pAttacker`, clamped at `0`.
 */
export function SUNITDMG_ConsumeStaminaCost113c(
  m: Memory113c,
  pAttacker: number,
  staminaCost = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFA930)
  if (dllAbi) {
    const cost = staminaCost | 0
    if (cost <= 0) return 0
    const cur = STATLIST_GetUnitStat113c(m, pAttacker >>> 0, 10, 0) | 0
    let rem = (cur - cost) | 0
    if (rem < 0x100) rem = 0
    STATLIST_SetUnitStat113c(m, pAttacker >>> 0, 10, rem, 0)
    return (rem !== 0 ? cost : 0) >>> 0
  }
  if (pAttacker === 0 || (staminaCost | 0) <= 0) return 0
  const cur = STATLIST_GetUnitStat113c(m, pAttacker, 10, 0) | 0
  const next = cur > (staminaCost | 0) ? cur - (staminaCost | 0) : 0
  STATLIST_SetUnitStat113c(m, pAttacker, 10, next, 0)
  return 0
}

/**
 * `@va D2Game:0x6FCFA970` (`SUNITDMG_ConsumeManaCost`, `104B`):
 * Subtracts `manaCost` from `STAT_MANA (8)` on `pAttacker`, clamped at `0`.
 */
export function SUNITDMG_ConsumeManaCost113c(
  m: Memory113c,
  pAttacker: number,
  manaCost = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFA970)
  if (dllAbi) {
    const cost = manaCost | 0
    if (cost <= 0) return 0
    const cur = STATLIST_GetUnitStat113c(m, pAttacker >>> 0, 8, 0) | 0
    let rem = (cur - cost) | 0
    if (rem < 0x100) rem = 0
    STATLIST_SetUnitStat113c(m, pAttacker >>> 0, 8, rem, 0)
    return (rem !== 0 ? cost : 0) >>> 0
  }
  if (pAttacker === 0 || (manaCost | 0) <= 0) return 0
  const cur = STATLIST_GetUnitStat113c(m, pAttacker, 8, 0) | 0
  const next = cur > (manaCost | 0) ? cur - (manaCost | 0) : 0
  STATLIST_SetUnitStat113c(m, pAttacker, 8, next, 0)
  return 0
}

/**
 * `@va D2Game:0x6FCFA9E0` (`SUNITDMG_ScaleByDifficultyRatio`, `90B`):
 * Scales `val` by the `DifficultyLevels.txt` percentage ratio (`Normal 100`, `NM 50`, `Hell 33` for leech / chill).
 */
export function SUNITDMG_ScaleByDifficultyRatio_6FCFA9E0_113c(
  m: Memory113c,
  pGame: number,
  val: number,
  nmPct = 50,
  hellPct = 33,
): number {
  if ((val | 0) === 0) return 0
  const diff = getEffectiveDiffK2(m, pGame)
  if (diff === 0) return val | 0
  return mulDiv113c(val | 0, diff === 1 ? nmPct : hellPct, 100)
}

/**
 * `@va D2Game:0x6FCFA9E0` (`SUNITDMG_CheckMonTypeFlag`):
 * Checks `MonStatsTxt` undead / demon flags (`0x02` lUndead, `0x04` hUndead, `0x08` demon) and `D2Common.#10635`
 * (`MONSTERS_IsDemonOrUndead113c`).
 */
export function SUNITDMG_CheckMonTypeFlag113c(
  m: Memory113c,
  pUnit: number,
  typeMask: number,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFA9E0)
  if (dllAbi) {
    const baseExp = pUnit | 0
    if (baseExp <= 0) return baseExp >>> 0
    const nLevel = typeMask | 0
    const ratio = DATATBLS_GetExpRatio113c(m, nLevel) | 0
    const shift = DATATBLS_GetExpRatio113c(m, 0) | 0
    if (shift <= 0 || shift >= 0x20) return baseExp >>> 0
    const limShift = ((ratio >> shift) + shift) & 0x1f
    const limit = 0x7fffffff >> limShift
    if (baseExp > limit) {
      return Math.imul(baseExp >> shift, ratio) >>> 0
    }
    return (Math.imul(ratio, baseExp) >> shift) >>> 0
  }
  if (pUnit === 0) return 0
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const classId = m.get(pUnit, D2UnitStrc.dwClassId) | 0
  const monRow = getMonStatsRecordPtrSafeK2(m, classId)
  if (monRow !== 0 && isSgptDataTablesLoaded113c(m)) {
    const flags0d = m.u8((monRow + 0x0d) >>> 0)
    if ((typeMask & 0x08) !== 0 && (flags0d & 0x20) !== 0) return 1
    if ((typeMask & 0x06) !== 0 && (flags0d & 0x18) !== 0) return 1
    return 0
  }
  if (MONSTER_CheckTypeFlagsMask113c(m, pUnit, typeMask) !== 0) return 1
  if (monRow !== 0) {
    const flags0d = m.u8((monRow + 0x0d) >>> 0)
    if ((typeMask & 0x08) !== 0 && (flags0d & 0x28) !== 0) return 1
    if ((typeMask & 0x06) !== 0 && (flags0d & 0x1e) !== 0) return 1
    const flags18 = m.u32((monRow + 0x18) >>> 0) >>> 0
    if ((typeMask & 0x08) !== 0 && (flags18 & 0x200000) !== 0) return 1
    if ((typeMask & 0x06) !== 0 && (flags18 & 0x180000) !== 0) return 1
  }
  const pureTxt = getMonStatsTxtPtrPure113c(m, classId >>> 0)
  if (pureTxt !== 0) {
    const f1 = m.u8((pureTxt + 0x0d) >>> 0)
    if ((typeMask & 0x08) !== 0 && (f1 & 0x20) !== 0) return 1
    if ((typeMask & 0x06) !== 0 && (f1 & 0x18) !== 0) return 1
  }
  const row = getMonStatsRowByClassId113c(classId >>> 0)
  if (row !== undefined && (row.bitField1 & typeMask) !== 0) return 1
  return 0
}

/**
 * `@va D2Game:0x6FCFA8C0` (`SUNITDMG_AddDemonDamageBonus`, `108B`):
 * Returns `STAT_ITEM_DEMONDAMAGE_PERCENT (121)` when `pDefender` is a Demon (`mask 0x08`), else `0`.
 */
export function SUNITDMG_AddDemonDamageBonus113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFA8C0)
  if (dllAbi) {
    const def = pAttacker >>> 0
    const att = pDefender >>> 0
    const dmg = pDmg >>> 0
    if (MONSTERS_IsDemonOrUndead113c(m, def) === 0) return 0
    let bonus = 0
    const weapon = PLAYER_GetEquippedWeapon113c(m, att) >>> 0
    if (weapon !== 0 && ITEMS_CheckItemTypeIdMemPort113c(m, weapon, 0x39) !== 0) {
      bonus = 0x32
    }
    bonus = (bonus + (STATLIST_GetUnitStatWithLayer113c(m, att, 0x7a, 0) | 0)) | 0
    if (bonus > 0) {
      m.setU32((dmg + 0x0c) >>> 0, ((m.u32((dmg + 0x0c) >>> 0) | 0) + bonus) >>> 0)
    }
    return 0
  }
  if (pAttacker === 0 || pDefender === 0) return 0
  if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
    MONSTERS_IsDemonOrUndead113c(m, pDefender)
  }
  if (SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x08) === 0) return 0
  return STATLIST_GetUnitStat113c(m, pAttacker, 121, 0) | 0
}

/**
 * `@va D2Game:0x6FCFAD70` (`SUNITDMG_AddMonsterTypeDamageBonus`, `172B`):
 * Accumulates Demon (`STAT_ITEM_DEMONDAMAGE_PERCENT = 121`) and Undead (`STAT_ITEM_UNDEADDAMAGE_PERCENT = 122`
 * plus `+50%` blunt weapon bonus `ITYPE_BLUNT = 57`) damage bonuses on `pAttacker` against `pDefender`.
 */
export function SUNITDMG_AddMonsterTypeDamageBonus113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFAD70)
  if (dllAbi) {
    const def = pAttacker >>> 0
    const att = pDefender >>> 0
    const dmg = pDmg >>> 0
    if (def === 0 || m.u32(def) !== UNIT_MONSTER) return 0
    const classId = m.u32((def + 4) >>> 0) | 0
    const pMonStats = getMonStatsRecordPtrSafeK2(m, classId)
    if (pMonStats === 0) return 0
    const monType = (m.u16((pMonStats + 0x1c) >>> 0) << 16) >> 16
    if (monType <= 0) return 0
    const sp = k2RealStackPtr
    k2RealStackPtr = (sp + 0x400) >>> 0
    try {
      const n = STATLIST_GetExtendedUnitStatsById113c(m, att, 0xb4, sp, 0x80) | 0
      for (let i = 0; i < n; i++) {
        const statLayer = m.u16((sp + i * 8) >>> 0)
        if (MONTYPE_TestNestedBit_6FC21620_113c(m, statLayer, monType) !== 0) {
          const addVal = m.u32((sp + i * 8 + 4) >>> 0) | 0
          m.setU32((dmg + 0x0c) >>> 0, ((m.u32((dmg + 0x0c) >>> 0) | 0) + addVal) >>> 0)
        }
      }
    } finally {
      k2RealStackPtr = sp
    }
    return 0
  }
  if (pAttacker === 0 || pDefender === 0) return 0
  let bonus = SUNITDMG_AddDemonDamageBonus113c(m, pAttacker, pDefender)
  if (SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x06) !== 0) {
    let bluntBonus = 0
    const pWeapon = getEquippedWeaponK2(m, pAttacker)
    if (pWeapon !== 0 && checkItemTypePureOrMemK2(m, pWeapon, 57) !== 0) {
      bluntBonus = 50
    }
    bonus = (bonus + bluntBonus + (STATLIST_GetUnitStat113c(m, pAttacker, 122, 0) | 0)) | 0
  }
  return bonus
}

/**
 * `@va D2Game:0x6FCFB570` (`SUNITDMG_AddLeechedLifeToUnit`, `104B`):
 * Adds `addAmount` (`<< 8` fixed-point) to `statId` (`6` HP, `8` Mana, `10` Stamina), clamped to `maxStatId` (`7`, `9`, `11`).
 */
export function SUNITDMG_AddLeechedLifeToUnit113c(
  m: Memory113c,
  pUnit: number,
  statId: number,
  maxStatId: number,
  addAmount: number,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFB570)
  if (dllAbi) {
    const u = pUnit >>> 0
    const add = addAmount | 0
    if (add <= 0 || SUNIT_IsDeadOrDying113c(m, u) !== 0 || STATES_CheckState113c(m, u, 0x5c) !== 0) {
      return 0
    }
    const max = STATLIST_GetMaxLifeFromUnit113c(m, u) | 0
    const cur = STATLIST_GetUnitStat113c(m, u, 6, 0) | 0
    let next = (add + cur) | 0
    if (next >= max) next = max
    STATLIST_SetUnitStat113c(m, u, 6, next, 0)
    return (next === max ? max - cur : add) >>> 0
  }
  if (pUnit === 0 || (addAmount | 0) <= 0) return 0
  const cur = STATLIST_GetUnitStat113c(m, pUnit, statId, 0) | 0
  let max =
    maxStatId === 7
      ? (STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0)
      : (STATLIST_GetUnitStat113c(m, pUnit, maxStatId, 0) | 0)
  if (max <= 0 && maxStatId === 7) {
    max = STATLIST_GetUnitStat113c(m, pUnit, 7, 0) | 0
  }
  const sum = (cur + (addAmount | 0)) | 0
  const next = max > 0 && sum > max ? max : sum
  STATLIST_SetUnitStat113c(m, pUnit, statId, next, 0)
  return 0
}

/**
 * `@va D2Game:0x6FCFBA40` (`SUNITDMG_ApplyLifeManaSteal`, `690B`):
 * Applies Life Tap (`STATE_LIFETAP = 58`, `50%` unpenalized heal ignoring drain immunity),
 * Life Steal (`dwLifeLeech` / `STAT_LIFEDRAINMINDAM = 60`), Mana Steal (`dwManaLeech` / `STAT_MANADRAINMINDAM = 62`),
 * and Stamina Drain (`dwStamLeech` / `STAT_STAMDRAINMINDAM = 64`), scaled by `MonStatsTxt.nDrain[diff]` (`+0x172..+0x174`)
 * and Expansion difficulty leech penalty (`1/2` NM, `1/3` Hell).
 */
export function SUNITDMG_ApplyLifeManaSteal113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  pGameArg = 0,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFBA40)
  if (dllAbi) {
    const att = pAttacker >>> 0
    const def = pDefender >>> 0
    const dmg = pDmg >>> 0
    const game = pGameArg >>> 0
    let lifePct = m.u32((dmg + 0x38) >>> 0) | 0
    let manaPct = m.u32((dmg + 0x3c) >>> 0) | 0
    if (lifePct === 0 && manaPct === 0) return
    let drainFactor = 0x64
    if (def !== 0 && m.u32(def) === 1) {
      const pMonData = m.u32((def + 0x14) >>> 0) >>> 0
      if (pMonData === 0) return
      const pMonStats = m.u32(pMonData) >>> 0
      if (pMonStats === 0) return
      const nDiff = m.u8((game + 0x6d) >>> 0) & 0xff
      drainFactor = m.u8((pMonStats + nDiff + 0xa0) >>> 0) | 0
      if (drainFactor <= 0) return
    }
    lifePct = (lifePct << 6) | 0
    manaPct = (manaPct << 6) | 0
    m.setU32((dmg + 0x38) >>> 0, lifePct >>> 0)
    m.setU32((dmg + 0x3c) >>> 0, manaPct >>> 0)
    const div64 = (v: number): number => ((v < 0 ? v + 0x3f : v) >> 6) | 0
    let useMonsterDrain = false
    if (att === 0) {
      useMonsterDrain = true
    } else {
      const attType = m.u32(att) | 0
      if (attType === 0) {
        const attGame = m.u32((att + 0x80) >>> 0) >>> 0
        const pDiff = DATATBLS_GetMonLvlTxtRecord113c(m, m.u8((attGame + 0x6d) >>> 0)) >>> 0
        const lifeDiv = m.u32((pDiff + 0x28) >>> 0) | 0
        if (lifeDiv !== 0) {
          lifePct = Math.trunc(lifePct / lifeDiv) | 0
          m.setU32((dmg + 0x38) >>> 0, lifePct >>> 0)
        }
        const manaDiv = m.u32((pDiff + 0x2c) >>> 0) | 0
        if (manaDiv !== 0) {
          manaPct = Math.trunc(manaPct / manaDiv) | 0
          m.setU32((dmg + 0x3c) >>> 0, manaPct >>> 0)
        }
      } else if (attType !== 1 || MONSTERS_GetHirelingTypeId113c(m, att) === 0) {
        useMonsterDrain = true
      }
    }
    if (useMonsterDrain) {
      const sp = k2RealStackPtr
      k2RealStackPtr = (sp + 0x10) >>> 0
      let outType = 0
      try {
        m.setU32(sp, att === 0 ? 6 : m.u32(att))
        m.setU32((sp + 4) >>> 0, att === 0 ? 0xffffffff : m.u32((att + 4) >>> 0))
        m.setU32((sp + 8) >>> 0, att === 0 ? 0 : m.u32((att + 0x10) >>> 0))
        UNITS_GetTransformGfx113c(m, att, sp, (sp + 4) >>> 0, (sp + 8) >>> 0, 0, 0)
        outType = m.u32(sp) >>> 0
      } finally {
        k2RealStackPtr = sp
      }
      if (outType !== 0) {
        const curMana = STATLIST_GetUnitStat113c(m, def, 8, 0) | 0
        const curStam = STATLIST_GetUnitStat113c(m, def, 0x0a, 0) | 0
        const lifeDiv = div64(lifePct)
        const manaDiv = div64(manaPct)
        m.setU32((dmg + 0x38) >>> 0, lifeDiv >>> 0)
        m.setU32((dmg + 0x3c) >>> 0, manaDiv >>> 0)
        const phys = m.u32((dmg + 8) >>> 0) | 0
        const lGain = lifeDiv < phys ? lifeDiv : phys
        const mGain = manaDiv < curMana ? manaDiv : curMana
        const rawStam = m.u32((dmg + 0x40) >>> 0) | 0
        const sGain = rawStam < curStam ? rawStam : curStam
        let total = (lGain + mGain + sGain) | 0
        if (total === 0) return
        if (drainFactor !== 100) {
          total = mulDiv113c(drainFactor, total, 100)
        }
        const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, att) | 0
        const curHp = STATLIST_GetUnitStat113c(m, att, 6, 0) | 0
        const missing = (maxHp - curHp) | 0
        const heal = total < missing ? total : missing
        if (heal <= 0) return
        STATLIST_AddUnitStat113c(m, att, 6, heal, 0)
        STATES_SetMonsterSkillIconOnUnit113c(m, att, 0x97, 0)
        return
      }
    }
    const phys = m.u32((dmg + 8) >>> 0) | 0
    if (phys <= 0) return
    let didMana = 0
    const mScaled = m.u32((dmg + 0x3c) >>> 0) | 0
    if (mScaled !== 0) {
      let amt = mulDiv113c(mScaled, phys, 100)
      if (drainFactor !== 100) amt = mulDiv113c(drainFactor, amt, 100)
      SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c(m, att, div64(amt))
      didMana = 1
    }
    const lScaled = m.u32((dmg + 0x38) >>> 0) | 0
    if (lScaled !== 0) {
      let amt = mulDiv113c(lScaled, phys, 100)
      if (drainFactor !== 100) amt = mulDiv113c(drainFactor, amt, 100)
      SUNITDMG_AddLeechedLifeToUnit113c(m, att, 6, 7, div64(amt), true)
      if (didMana !== 0) {
        const r = rollSeedMemK2(m, (att + 0x20) >>> 0, 2)
        STATES_SetMonsterSkillIconOnUnit113c(m, att, r === 0 ? 0x97 : 0x98, 0)
      } else {
        STATES_SetMonsterSkillIconOnUnit113c(m, att, 0x97, 0)
      }
    } else if (didMana !== 0) {
      STATES_SetMonsterSkillIconOnUnit113c(m, att, 0x98, 0)
    }
    return
  }
  if (pAttacker === 0 || pDefender === 0 || pDmg === 0) return
  const phys = m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0
  if (phys <= 0) return
  const resFlags = m.get(pDmg, D2DamageStrc.wResultFlags) >>> 0
  if ((resFlags & 0x4020) === 0x4020) return
  const allowDirectStatFallback = m.get(pDmg, D2DamageStrc.dwHitFlags) === 0 && (resFlags & 0x20) === 0

  // Life Tap (`STATE_LIFETAP = 58` on `pDefender`) heals `50%` of physical damage dealt, ignoring drain immunity!
  if (STATES_CheckState113c(m, pDefender, 58) !== 0) {
    SUNITDMG_AddLeechedLifeToUnit113c(m, pAttacker, 6, 7, phys >> 1)
  }

  const pGame = m.u32((pAttacker + 0x80) >>> 0) >>> 0
  const diff = getEffectiveDiffK2(m, pGame)
  let drainEff = 100
  if (m.u32(pDefender) === UNIT_MONSTER) {
    const cls = m.get(pDefender, D2UnitStrc.dwClassId) | 0
    const monRow = getMonStatsRecordPtrSafeK2(m, cls)
    if (monRow !== 0) {
      const rawDrain = m.u8((monRow + 0x172 + diff) >>> 0)
      const normDrain = m.u8((monRow + 0x172) >>> 0)
      if (rawDrain > 0 || normDrain > 0) {
        drainEff = rawDrain
      }
    }
  }
  if (drainEff <= 0) return

  const dmgLifeLeech = m.get(pDmg, D2DamageStrc.dwLifeLeech) | 0
  const lifePct =
    dmgLifeLeech > 0
      ? dmgLifeLeech
      : allowDirectStatFallback
        ? STATLIST_GetUnitStat113c(m, pAttacker, 60, 0) | 0
        : 0
  if (lifePct > 0) {
    let leeched = mulDiv113c(lifePct, phys, 100)
    if (drainEff !== 100) leeched = mulDiv113c(drainEff, leeched, 100)
    if (m.u32(pAttacker) === UNIT_PLAYER && pGame !== 0 && m.u32((pGame + 0x70) >>> 0) !== 0) {
      if (diff === 1) leeched = leeched >> 1
      else if (diff === 2) leeched = Math.trunc(leeched / 3)
    }
    if (leeched > 0) SUNITDMG_AddLeechedLifeToUnit113c(m, pAttacker, 6, 7, leeched)
  }

  const dmgManaLeech = m.get(pDmg, D2DamageStrc.dwManaLeech) | 0
  const manaPct =
    dmgManaLeech > 0
      ? dmgManaLeech
      : allowDirectStatFallback
        ? STATLIST_GetUnitStat113c(m, pAttacker, 62, 0) | 0
        : 0
  if (manaPct > 0) {
    let leeched = mulDiv113c(manaPct, phys, 100)
    if (drainEff !== 100) leeched = mulDiv113c(drainEff, leeched, 100)
    if (m.u32(pAttacker) === UNIT_PLAYER && pGame !== 0 && m.u32((pGame + 0x70) >>> 0) !== 0) {
      if (diff === 1) leeched = leeched >> 1
      else if (diff === 2) leeched = Math.trunc(leeched / 3)
    }
    if (leeched > 0) SUNITDMG_AddLeechedLifeToUnit113c(m, pAttacker, 8, 9, leeched)
  }

  const dmgStamLeech = m.get(pDmg, D2DamageStrc.dwStamLeech) | 0
  const stamDrain =
    dmgStamLeech > 0
      ? dmgStamLeech
      : allowDirectStatFallback
        ? STATLIST_GetUnitStat113c(m, pAttacker, 64, 0) | 0
        : 0
  if (stamDrain > 0) {
    SUNITDMG_AddLeechedLifeToUnit113c(m, pAttacker, 10, 11, stamDrain << 8)
    if (m.u32(pDefender) === UNIT_PLAYER) {
      const curStam = STATLIST_GetUnitStat113c(m, pDefender, 10, 0) | 0
      const loss = stamDrain << 8
      STATLIST_SetUnitStat113c(m, pDefender, 10, curStam > loss ? curStam - loss : 0, 0)
    }
  }
}

/**
 * `@va D2Game:0x6FCFB790` (`SUNITDMG_RollPassiveWeaponBlockOrShieldBlock`, `203B`):
 * Checks passive avoidance (`0x6FCFB030` when `bSkipAvoidance == 0`), computes effective shield block chance
 * via `UNITS_GetBlockChance113c` (`D2Common.#10212` `0x6FD81D20`), applies `1/3` running block penalty on players
 * (`dwAnimMode != 2` while moving), and rolls `pDefender->tSeed` (`100`).
 */
export function SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(
  m: Memory113c,
  pDefender: number,
  pGame = 0,
  bSkipAvoidance = 0,
  bRanged = 0,
  pAttacker = 0,
  bHasPhysDmg = 1,
): number {
  hitD2GameVa113c(0x6FCFB790)
  if (pDefender === 0) return 0
  if (bHasPhysDmg === 0) {
    if (pAttacker === 0) return 0
    return SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pAttacker, pDefender, bRanged)
  }
  if (bSkipAvoidance === 0) {
    const avoidMask = SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pAttacker, pDefender, bRanged)
    if (avoidMask !== 0) return avoidMask
  }
  const effGame = pGame !== 0 ? (pGame >>> 0) : (m.u32((pDefender + 0x80) >>> 0) >>> 0)
  const defType = m.get(pDefender, D2UnitStrc.dwUnitType)
  let blockChance = 0

  if (defType === UNIT_MONSTER) {
    const sgpt = safeReadU32K2(m, 0x6fde9e1c)
    if (sgpt !== 0 && (safeReadU32K2(m, (sgpt + 0xa80) >>> 0) | 0) > 0 && safeReadU32K2(m, 0x6fdd90b0) !== 0) {
      UNITS_GetBlockChance113c(m, pDefender, 0)
    }
    const pTxt = getMonStatsTxtPtrPure113c(m, m.get(pDefender, D2UnitStrc.dwClassId) | 0)
    const hasMonBlock = pTxt !== 0 && (m.u8((pTxt + 0x0f) >>> 0) & 0x04) !== 0
    if (!hasMonBlock) {
      if (sgpt === 0 || safeReadU32K2(m, (sgpt + 0xa80) >>> 0) === 0) return 0
      const pMonData = m.get(pDefender, D2UnitStrc.pUnitData)
      if (pMonData === 0) return 0
      const varIdx = m.u8((pMonData + 0x0b) >>> 0)
      const compCode = MONSTERS_GetCompCode113c(m, pDefender, 7, varIdx) >>> 0
      if (!isItemCodeShieldPure113c(compCode)) return 0
    }
    blockChance = STATLIST_GetUnitStat113c(m, pDefender, 20, 0) | 0
  } else if (defType === UNIT_PLAYER) {
    const pInv = m.get(pDefender, D2UnitStrc.pInventory)
    const isExp =
      effGame !== 0 &&
      (m.u32((effGame + 0x70) >>> 0) !== 0 ||
        m.u8((effGame + 0x6a) >>> 0) !== 0 ||
        m.u32((effGame + 0x74) >>> 0) !== 0)
    const sgpt = safeReadU32K2(m, 0x6fde9e1c)
    if (pInv !== 0) {
      if (sgpt !== 0 && (safeReadU32K2(m, (sgpt + 0xbd4) >>> 0) | 0) > 0x14 && safeReadU32K2(m, 0x6fdf0b4c) !== 0) {
        blockChance = UNITS_GetBlockChance113c(m, pDefender, isExp ? 1 : 0) | 0
      }
      let hasShield = false
      for (let slot = 4; slot <= 5; slot++) {
        const pItem = findItemInInventoryByBodyLocK2(m, pInv, slot)
        if (
          pItem !== 0 &&
          (checkItemTypePureOrMemK2(m, pItem, 2) !== 0 ||
            checkItemTypePureOrMemK2(m, pItem, 51) !== 0 ||
            checkItemTypePureOrMemK2(m, pItem, 69) !== 0 ||
            checkItemTypePureOrMemK2(m, pItem, 70) !== 0)
        ) {
          hasShield = true
          break
        }
      }
      if (!hasShield) return 0
      if (blockChance <= 0) {
        const baseBlock = STATLIST_GetUnitStat113c(m, pDefender, 20, 0) | 0
        if (baseBlock > 0) {
          if (isExp) {
            const dex = STATLIST_GetUnitStat113c(m, pDefender, 2, 0) | 0
            const clvl = Math.max(1, STATLIST_GetUnitStat113c(m, pDefender, 12, 0) | 0)
            blockChance = Math.trunc((baseBlock * (dex - 15)) / (clvl * 2)) | 0
          } else {
            blockChance = baseBlock
          }
        }
      }
    } else {
      blockChance = STATLIST_GetUnitStat113c(m, pDefender, 20, 0) | 0
    }
    if (
      blockChance > 0 &&
      UNITS_IsInMovingMode113c(m, pDefender) !== 0 &&
      (m.get(pDefender, D2UnitStrc.dwAnimMode) | 0) !== 2
    ) {
      blockChance = Math.trunc(blockChance / 3) | 0
    }
  } else {
    return 0
  }

  if (blockChance <= 0) return 0
  if (blockChance > 75) blockChance = 75
  const roll = rollSeedMemK2(m, pDefender + D2UnitStrc.seedLo.off, 100)
  return (roll | 0) < blockChance ? 1 : 0
}

/**
 * `@va D2Game:0x6FCEB950` (`SUNITDMG_TriggerBlockEvents`, `228B`):
 * Triggered when `wResultFlags & 0x10` (`RESULTFLAG_BLOCK`): transitions `pDefender` into block animation
 * (`PLAYER_StartBlockMode113c` `mode 9` for players, `MONSTER_StartMode113c` `mode 6` for monsters)
 * and broadcasts `0x0D` (`mode = 0x09`) / `0x0C` (`mode = 0x06`) to in-game clients via `0x6FCAA3E0`.
 */
export function SUNITDMG_TriggerBlockEvents113c(
  m: Memory113c,
  pGame: number,
  pDefender: number,
  hooks?: SUnitDmgHooks113c,
  actionIdx = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCEB950)
  if (dllAbi) {
    const pClient = pGame >>> 0
    const def = pDefender >>> 0
    const idx = actionIdx | 0
    const modeByte =
      idx >= 0 && idx < D2GAME_BLOCK_ACTION_MODES_6FD22CE4.length
        ? (D2GAME_BLOCK_ACTION_MODES_6FD22CE4[idx] as number)
        : 0
    const cl = m.u8((def + 0xb0) >>> 0) & 0xff
    const lifePct = STATLIST_GetUnitLifePercent113c(m, def) & 0xff
    const uType = m.u32(def) | 0
    const pPath = m.u32((def + 0x2c) >>> 0) >>> 0
    let y = 0
    let x = 0
    if (uType === 2 || uType === 4 || uType === 5) {
      y = pPath !== 0 ? m.u32((pPath + 0x10) >>> 0) : 0
      x = pPath !== 0 ? m.u32((pPath + 0x0c) >>> 0) : 0
    } else {
      y = pPath !== 0 ? PATH_GetPosY113c(m, pPath) : 0
      x = pPath !== 0 ? PATH_GetPosX113c(m, pPath) : 0
    }
    const unitId = m.u32((def + 0x0c) >>> 0)
    const sp = k2RealStackPtr
    k2RealStackPtr = (sp + 0x10) >>> 0
    try {
      m.setU8(sp, 0x0d)
      m.setU8((sp + 1) >>> 0, 0)
      m.setU32((sp + 2) >>> 0, unitId)
      m.setU8((sp + 6) >>> 0, modeByte & 0xff)
      m.setU16((sp + 7) >>> 0, x & 0xffff)
      m.setU16((sp + 9) >>> 0, y & 0xffff)
      m.setU8((sp + 11) >>> 0, cl)
      m.setU8((sp + 12) >>> 0, lifePct)
      NET_QueuePacketToClientBuffer113c(m, pClient, 0, sp, 0x0d)
    } finally {
      k2RealStackPtr = sp
    }
    return 1
  }
  if (pDefender === 0) return 0
  const effHooks = hooks !== undefined ? hooks : k2DefaultSUnitDmgHooks
  const suppressS2c = effHooks !== undefined && effHooks.suppressDirectS2c === true
  const uType = m.get(pDefender, D2UnitStrc.dwUnitType)
  if (uType === UNIT_PLAYER) {
    if (effHooks !== undefined && effHooks.onPlayerBlock !== undefined) {
      effHooks.onPlayerBlock(m, pGame, pDefender)
      return 1
    }
    const ok = PLAYER_StartBlockMode113c(m, pGame, pDefender, '1HS')
    if (pGame !== 0 && !suppressS2c) {
      let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
      while (pClient !== 0) {
        if (m.u32((pClient + 0x04) >>> 0) === 4) {
          S2C_SendPacket0D_PlayerStop113c(m, pClient, pDefender, 0x09, 0)
        }
        pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
      }
    }
    return ok
  }
  if (uType === UNIT_MONSTER) {
    if (effHooks !== undefined && effHooks.onMonsterStartMode !== undefined) {
      effHooks.onMonsterStartMode(m, pGame, pDefender, 6, 0)
      return 1
    }
    return MONSTER_StartMode113c(m, pGame, pDefender, 6, 0, 0, 0)
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFBD00` (`SUNITDMG_ApplySingleChannelResistance`, `140B`):
 * Reduces `dmgValue` (`<< 8`) by `SUNITDMG_GetEffectiveResistance113c(m, pDefender, resStatId, pAttacker)`
 * (`0` when `effRes >= 100`).
 */
export function SUNITDMG_ApplySingleChannelResistance113c(
  m: Memory113c,
  pDefender: number,
  dmgValue: number,
  resStatId: number,
  pAttacker = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFBD00)
  if (dllAbi) {
    const resDesc = pDefender >>> 0
    const pCombat = dmgValue >>> 0
    const bSkipAbsorb = resStatId | 0
    return applySingleChannelResistanceDll113c(
      m,
      pCombat,
      m.u32(resDesc) | 0,
      m.u32((resDesc + 0x04) >>> 0) | 0,
      m.u32((resDesc + 0x08) >>> 0) | 0,
      m.u32((resDesc + 0x0c) >>> 0) | 0,
      m.u32((resDesc + 0x10) >>> 0) | 0,
      m.u32((resDesc + 0x14) >>> 0) | 0,
      m.u32((resDesc + 0x18) >>> 0) | 0,
      bSkipAbsorb,
    )
  }
  if ((dmgValue | 0) <= 0) return 0
  const res = SUNITDMG_GetEffectiveResistance113c(m, pDefender, resStatId, pAttacker)
  if (res >= 100) return 0
  if (res === 0) return dmgValue | 0
  const reduced = mulDiv113c(100 - res, dmgValue | 0, 100)
  return reduced > 0 ? reduced : 0
}

/**
 * `@va D2Game:0x6FCFAD00` (`SUNITDMG_ApplyElementalAbsorb`, `108B`):
 * Applies percentage absorb (`absPctStatId`, capped at `40%`) + flat absorb (`absFlatStatId << 8`),
 * subtracting absorbed damage from `dmgValue` and crediting `pDmg->dwAbsorbLife`.
 */
export function SUNITDMG_ApplyElementalAbsorb113c(
  m: Memory113c,
  pDefender: number,
  dmgValue: number,
  absPctStatId: number,
  absFlatStatId: number,
  pDmg = 0,
): number {
  hitD2GameVa113c(0x6FCFAD00)
  if (pDefender === 0 || (dmgValue | 0) <= 0) return (dmgValue | 0) > 0 ? (dmgValue | 0) : 0
  let pct = absPctStatId >= 0 ? (STATLIST_GetUnitStat113c(m, pDefender, absPctStatId, 0) | 0) : 0
  if (pct > 40) pct = 40
  if (pct < 0) pct = 0
  const flat = absFlatStatId >= 0 ? ((STATLIST_GetUnitStat113c(m, pDefender, absFlatStatId, 0) | 0) << 8) : 0
  let absorbed = (pct > 0 ? mulDiv113c(pct, dmgValue | 0, 100) : 0) + (flat > 0 ? flat : 0)
  if (absorbed > (dmgValue | 0)) absorbed = dmgValue | 0
  const remaining = (dmgValue | 0) - absorbed
  if (pDmg !== 0 && absorbed > 0) {
    m.set(
      pDmg,
      D2DamageStrc.dwAbsorbLife,
      ((m.get(pDmg, D2DamageStrc.dwAbsorbLife) | 0) + absorbed) >>> 0,
    )
  }
  return remaining > 0 ? remaining : 0
}

/**
 * `@va D2Game:0x6FCFA7B0` (`SUNITDMG_ApplyCannotBeFrozenAndShrineImmunities`, `220B`):
 * Exact binary function at `0x6FCFA7B0`:
 * - `STAT_ITEM_CANNOTBEFROZEN (153) > 0`: zeroes `dwColdLen` & `dwFrzLen`.
 * - `STAT_ITEM_HALFFREEZEDURATION (118) > 0`: halves `dwColdLen` & `dwFrzLen`.
 * - `STATE_SHRINE_RESIST_POISON (133)`: zeroes `dwPoisDamage` & `dwPoisLen`.
 * - `STATE_SHRINE_RESIST_FIRE (131)`: zeroes `dwBurnDamage` & `dwBurnLen`.
 */
export function SUNITDMG_ApplyCannotBeFrozenAndShrineImmunities_6FCFA7B0_113c(
  m: Memory113c,
  pDefender: number,
  pDmg: number,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCFA7B0)
  if (dllAbi) {
    const pCombat = pDefender >>> 0
    const dmg = m.u32((pCombat + 0x18) >>> 0) >>> 0
    const def = m.u32((pCombat + 0x0c) >>> 0) >>> 0
    const coldLen = m.u32((dmg + 0x30) >>> 0) | 0
    const frzLen = m.u32((dmg + 0x34) >>> 0) | 0
    if (coldLen > 0 || frzLen > 0) {
      if (STATLIST_GetUnitStatWithLayer113c(m, def, 0x99, 0) !== 0) {
        m.setU32((dmg + 0x30) >>> 0, 0)
        m.setU32((dmg + 0x34) >>> 0, 0)
      } else if (STATLIST_GetUnitStatWithLayer113c(m, def, 0x76, 0) !== 0) {
        m.setU32((dmg + 0x30) >>> 0, (Math.trunc(coldLen / 2) | 0) >>> 0)
        m.setU32((dmg + 0x34) >>> 0, (Math.trunc(frzLen / 2) | 0) >>> 0)
      }
    }
    if ((m.u32((dmg + 0x2c) >>> 0) | 0) > 0 && STATES_CheckState113c(m, def, 0x85) !== 0) {
      m.setU32((dmg + 0x2c) >>> 0, 0)
    }
    if ((m.u32((dmg + 0x18) >>> 0) | 0) > 0 && STATES_CheckState113c(m, def, 0x83) !== 0) {
      m.setU32((dmg + 0x18) >>> 0, 0)
    }
    return
  }
  if (pDefender === 0 || pDmg === 0) return
  if ((m.get(pDmg, D2DamageStrc.dwColdLen) | 0) > 0 || (m.get(pDmg, D2DamageStrc.dwFrzLen) | 0) > 0) {
    if (STATLIST_GetUnitStat113c(m, pDefender, 153, 0) > 0) {
      m.set(pDmg, D2DamageStrc.dwColdLen, 0)
      m.set(pDmg, D2DamageStrc.dwFrzLen, 0)
    } else if (STATLIST_GetUnitStat113c(m, pDefender, 118, 0) > 0) {
      m.set(pDmg, D2DamageStrc.dwColdLen, (m.get(pDmg, D2DamageStrc.dwColdLen) >>> 1) >>> 0)
      m.set(pDmg, D2DamageStrc.dwFrzLen, (m.get(pDmg, D2DamageStrc.dwFrzLen) >>> 1) >>> 0)
    }
  }
  if ((m.get(pDmg, D2DamageStrc.dwPoisLen) | 0) > 0 && STATES_CheckState113c(m, pDefender, 133) !== 0) {
    m.set(pDmg, D2DamageStrc.dwPoisDamage, 0)
    m.set(pDmg, D2DamageStrc.dwPoisLen, 0)
  }
  if ((m.get(pDmg, D2DamageStrc.dwBurnLen) | 0) > 0 && STATES_CheckState113c(m, pDefender, 131) !== 0) {
    m.set(pDmg, D2DamageStrc.dwBurnDamage, 0)
    m.set(pDmg, D2DamageStrc.dwBurnLen, 0)
  }
}

/**
 * `@va D2Game:0x6FCFC0B0` (`SUNITDMG_ApplyResistancesAndAbsorb`, `1152B`):
 * Full 1.13c multi-channel damage mitigation pipeline (`D2Game.dll:0x6FD22AB0`):
 * 1. Applies `0x6FCFA7B0` CBF / half-freeze / resist-shrine immunities.
 * 2. Applies flat Damage Reduced (`STAT_NORMAL_DAMAGE_REDUCTION = 34 << 8`) to `dwPhysDamage` and
 *    flat Magic Damage Reduced (`STAT_MAGIC_DAMAGE_REDUCTION = 35 << 8`) across `Mag`, `Fire`, `Ltng`, `Cold`.
 * 3. Applies effective resistances + attacker pierce (`0x6FCFBD00`) and elemental absorb (`0x6FCFAD00`).
 * 4. Applies `SUNITDMG_GetPvpOrPetDamageMultiplier113c` (`0x6FCFAC10`, `/ 1000`),
 *    heals `dwAbsorbLife` onto `pDefender` if alive, and writes `dwDmgTotal`.
 */
export function SUNITDMG_ApplyResistancesAndAbsorb113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  pDmgArg = 0,
  dllAbi = false,
  bSkipMeleeDotPreScaled = false,
): number {
  hitD2GameVa113c(0x6FCFC0B0)
  if (dllAbi) {
    const pGame = pAttacker >>> 0
    const att = pDefender >>> 0
    const def = pDmg >>> 0
    const dmg = pDmgArg >>> 0
    const diff = m.u8((pGame + 0x6d) >>> 0)
    const pMonLvl = DATATBLS_GetMonLvlTxtRecord113c(m, diff) >>> 0
    const bAttNonHireMon =
      att !== 0 && m.u32(att) === 1 && MONSTERS_GetHirelingTypeId113c(m, att) === 0 ? 1 : 0
    const bDefNonHireMon =
      def !== 0 && m.u32(def) === 1 && MONSTERS_GetHirelingTypeId113c(m, def) === 0 ? 1 : 0
    const dmgPierce = m.u32((dmg + 0x54) >>> 0) | 0
    let dr = (STATLIST_GetUnitStat113c(m, def, 0x22, 0) | 0) << 8
    if (dr > 0 && dmgPierce > 0) dr = mulDiv113c(dmgPierce, dr, 0x400) | 0
    let mdr = (STATLIST_GetUnitStat113c(m, def, 0x23, 0) | 0) << 8
    if (mdr > 0 && dmgPierce > 0) mdr = mulDiv113c(dmgPierce, mdr, 0x400) | 0

    const savedSp = k2RealStackPtr
    const pCombat = savedSp >>> 0
    k2RealStackPtr = (savedSp + 0x28) >>> 0
    try {
      m.setU32(pCombat, pGame)
      m.setU32((pCombat + 0x04) >>> 0, pMonLvl)
      m.setU32((pCombat + 0x08) >>> 0, att)
      m.setU32((pCombat + 0x0c) >>> 0, def)
      m.setU32((pCombat + 0x10) >>> 0, bAttNonHireMon >>> 0)
      m.setU32((pCombat + 0x14) >>> 0, bDefNonHireMon >>> 0)
      m.setU32((pCombat + 0x18) >>> 0, dmg)
      m.setU32((pCombat + 0x1c) >>> 0, 0)
      m.setU32((pCombat + 0x20) >>> 0, dr >>> 0)
      m.setU32((pCombat + 0x24) >>> 0, mdr >>> 0)

      const mult = SUNITDMG_GetPvpOrPetDamageMultiplier113c(m, pCombat, 0, true) | 0
      if (mult !== 0x64) {
        for (const row of D2GAME_RES_ABSORB_CHANNELS_6FD22AB0) {
          if (row[8] === 0) continue
          const ptr = (dmg + row[0]) >>> 0
          const cur = m.u32(ptr) | 0
          if (cur > 0) {
            m.setU32(ptr, scaleDivRatioDll113c(cur, mult, 100) >>> 0)
          }
        }
      }

      SUNIT_DispatchItemEventCallbacks113c(m, def, pGame, 0x0b, att, dmg)
      SUNITDMG_ApplyCannotBeFrozenAndShrineImmunities_6FCFA7B0_113c(m, pCombat, 0, true)

      let bSkipAbsorb = 0
      const hitFlags = m.u32(dmg) >>> 0
      if (def !== 0 && m.u32(def) === 1) {
        const isDemUnd = MONSTERS_IsDemonOrUndead113c(m, def) | 0
        const isDemFlag20 = MONSTER_CheckMonTypeFlag0x20_113c(m, def) | 0
        if (isDemUnd !== 0 && (hitFlags & 0x100) !== 0) bSkipAbsorb = 1
        if (isDemFlag20 !== 0 && (hitFlags & 0x200) !== 0) bSkipAbsorb = 1
        if (isDemUnd === 0 && isDemFlag20 === 0 && (hitFlags & 0x400) !== 0) bSkipAbsorb = 1
      } else if ((hitFlags & 0x400) !== 0) {
        bSkipAbsorb = 1
      }

      for (const row of D2GAME_RES_ABSORB_CHANNELS_6FD22AB0) {
        if (row[7] !== 0 && bAttNonHireMon === 0) break
        applySingleChannelResistanceDll113c(
          m,
          pCombat,
          row[0],
          row[1],
          row[2],
          row[3],
          row[4],
          row[5],
          row[6],
          bSkipAbsorb,
        )
      }

      let total =
        ((m.u32((dmg + 0x28) >>> 0) | 0) +
          (m.u32((dmg + 0x24) >>> 0) | 0) +
          (m.u32((dmg + 0x20) >>> 0) | 0) +
          (m.u32((dmg + 0x1c) >>> 0) | 0) +
          (m.u32((dmg + 0x10) >>> 0) | 0) +
          (m.u32((dmg + 0x08) >>> 0) | 0)) |
        0
      m.setU32((dmg + 0x4c) >>> 0, total >>> 0)
      if (bAttNonHireMon !== 0) {
        total = (total + (m.u32((dmg + 0x38) >>> 0) | 0)) | 0
        m.setU32((dmg + 0x4c) >>> 0, total >>> 0)
      }
      return total >>> 0
    } finally {
      k2RealStackPtr = savedSp
    }
  }
  if (pDefender === 0 || pDmg === 0) return 0
  const pResGame =
    pDmgArg !== 0
      ? (pDmgArg >>> 0)
      : safeReadU32K2(m, (pDefender + 0x80) >>> 0) !== 0
        ? safeReadU32K2(m, (pDefender + 0x80) >>> 0)
        : pAttacker !== 0
          ? safeReadU32K2(m, (pAttacker + 0x80) >>> 0)
          : 0
  if (safeReadU32K2(m, 0x6fdf0b64) !== 0 && safeReadU32K2(m, 0x6fdf0b60) !== 0) {
    DATATBLS_GetMonLvlTxtRecord113c(m, pResGame !== 0 ? getEffectiveDiffK2(m, pResGame) : 0)
  }
  if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0 && pResGame !== 0) {
    dispatchItemEventsSafeK2(m, pDefender, pResGame, 0x0b, pAttacker, pDmg)
  }
  if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, 0x6fdd90b0) !== 0 && m.u32(pDefender) === UNIT_MONSTER) {
    MONSTERS_IsDemonOrUndead113c(m, pDefender)
    MONSTER_CheckMonTypeFlag0x20_113c(m, pDefender)
  }

  SUNITDMG_ApplyCannotBeFrozenAndShrineImmunities_6FCFA7B0_113c(m, pDefender, pDmg)

  const flatDr = (STATLIST_GetUnitStat113c(m, pDefender, 34, 0) | 0) << 8
  let phys = m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0
  if (flatDr > 0 && phys > 0) {
    phys = phys > flatDr ? phys - flatDr : 0
  }

  let mdrPool = (STATLIST_GetUnitStat113c(m, pDefender, 35, 0) | 0) << 8
  const subMdr = (v: number): number => {
    if (mdrPool <= 0 || v <= 0) return v
    const take = mdrPool >= v ? v : mdrPool
    mdrPool -= take
    return v - take
  }
  let mag = subMdr(m.get(pDmg, D2DamageStrc.dwMagDamage) | 0)
  let fire = subMdr(m.get(pDmg, D2DamageStrc.dwFireDamage) | 0)
  let ltng = subMdr(m.get(pDmg, D2DamageStrc.dwLtngDamage) | 0)
  let cold = subMdr(m.get(pDmg, D2DamageStrc.dwColdDamage) | 0)

  phys = SUNITDMG_ApplySingleChannelResistance113c(m, pDefender, phys, 36, pAttacker)
  fire = SUNITDMG_ApplySingleChannelResistance113c(m, pDefender, fire, 39, pAttacker)
  fire = SUNITDMG_ApplyElementalAbsorb113c(m, pDefender, fire, 142, 143, pDmg)
  let burn = SUNITDMG_ApplySingleChannelResistance113c(
    m,
    pDefender,
    m.get(pDmg, D2DamageStrc.dwBurnDamage) | 0,
    39,
    pAttacker,
  )
  ltng = SUNITDMG_ApplySingleChannelResistance113c(m, pDefender, ltng, 41, pAttacker)
  ltng = SUNITDMG_ApplyElementalAbsorb113c(m, pDefender, ltng, 144, 145, pDmg)
  mag = SUNITDMG_ApplySingleChannelResistance113c(m, pDefender, mag, 37, pAttacker)
  mag = SUNITDMG_ApplyElementalAbsorb113c(m, pDefender, mag, 146, 147, pDmg)
  cold = SUNITDMG_ApplySingleChannelResistance113c(m, pDefender, cold, 43, pAttacker)
  cold = SUNITDMG_ApplyElementalAbsorb113c(m, pDefender, cold, 148, 149, pDmg)
  let pois = SUNITDMG_ApplySingleChannelResistance113c(
    m,
    pDefender,
    m.get(pDmg, D2DamageStrc.dwPoisDamage) | 0,
    45,
    pAttacker,
  )
  let poisLen = m.get(pDmg, D2DamageStrc.dwPoisLen) | 0
  if (pois <= 0) {
    poisLen = 0
  } else {
    const plr = SUNITDMG_GetEffectiveResistance113c(m, pDefender, 110, pAttacker)
    if (plr !== 0) {
      const effPlr = plr < 100 ? plr : 100
      poisLen = mulDiv113c(100 - effPlr, poisLen, 100) | 0
      if (poisLen < 0) poisLen = 0
    }
  }

  let alreadyPreScaledByMeleeDot = false
  if (bSkipMeleeDotPreScaled && pAttacker !== 0 && pDefender !== 0 && pAttacker !== pDefender) {
    const attType0 = m.u32(pAttacker >>> 0) >>> 0
    const defType0 = m.u32(pDefender >>> 0) >>> 0
    if (defType0 === UNIT_PLAYER && attType0 === UNIT_MONSTER) {
      const pMonData0 = m.u32((pAttacker + 0x14) >>> 0) >>> 0
      const pAiGen0 = pMonData0 !== 0 ? (m.u32((pMonData0 + 0x28) >>> 0) >>> 0) : 0
      const legacyHandled0 =
        pAiGen0 !== 0 &&
        m.u32((pAiGen0 + 0x10) >>> 0) === 0 &&
        m.u32((pAiGen0 + 0x0c) >>> 0) !== 0
      if (
        !legacyHandled0 &&
        ((m.u32((pAttacker + 0xc4) >>> 0) >>> 31) !== 0 ||
          MONSTERS_GetHirelingTypeId113c(m, pAttacker) !== 0)
      ) {
        alreadyPreScaledByMeleeDot = true
      }
    } else if (
      attType0 === UNIT_MONSTER &&
      defType0 === UNIT_MONSTER &&
      MONSTERS_GetHirelingTypeId113c(m, pDefender) !== 0 &&
      MONSTERS_GetHirelingTypeId113c(m, pAttacker) !== 0
    ) {
      alreadyPreScaledByMeleeDot = true
    } else if (
      attType0 === UNIT_MONSTER &&
      defType0 === UNIT_MONSTER &&
      (m.u32((pDefender + 0xc4) >>> 0) >>> 31) !== 0 &&
      MONSTERS_GetHirelingTypeId113c(m, pDefender) === 0
    ) {
      const pAttStats0 = getMonStatsRecordPtrSafeK2(m, m.u32((pAttacker + 0x04) >>> 0) | 0)
      if (pAttStats0 !== 0 && (m.u8((pAttStats0 + 0x0c) >>> 0) & 0x40) !== 0) {
        alreadyPreScaledByMeleeDot = true
      }
    }
  }
  const pvpMult =
    pAttacker !== 0 && !alreadyPreScaledByMeleeDot
      ? SUNITDMG_GetPvpOrPetDamageMultiplier113c(m, pAttacker, pDefender)
      : 1000
  if (pvpMult !== 1000) {
    phys = mulDiv113c(pvpMult, phys, 1000)
    fire = mulDiv113c(pvpMult, fire, 1000)
    burn = mulDiv113c(pvpMult, burn, 1000)
    ltng = mulDiv113c(pvpMult, ltng, 1000)
    mag = mulDiv113c(pvpMult, mag, 1000)
    cold = mulDiv113c(pvpMult, cold, 1000)
    pois = mulDiv113c(pvpMult, pois, 1000)
  }

  m.set(pDmg, D2DamageStrc.dwPhysDamage, phys >>> 0)
  m.set(pDmg, D2DamageStrc.dwFireDamage, fire >>> 0)
  m.set(pDmg, D2DamageStrc.dwBurnDamage, burn >>> 0)
  m.set(pDmg, D2DamageStrc.dwLtngDamage, ltng >>> 0)
  m.set(pDmg, D2DamageStrc.dwMagDamage, mag >>> 0)
  m.set(pDmg, D2DamageStrc.dwColdDamage, cold >>> 0)
  m.set(pDmg, D2DamageStrc.dwPoisDamage, pois >>> 0)
  m.set(pDmg, D2DamageStrc.dwPoisLen, poisLen >>> 0)

  const absorbHeal = m.get(pDmg, D2DamageStrc.dwAbsorbLife) | 0
  if (absorbHeal > 0) {
    SUNITDMG_AddLeechedLifeToUnit113c(m, pDefender, 6, 7, absorbHeal)
  }

  const burnLen = m.get(pDmg, D2DamageStrc.dwBurnLen) | 0
  const inlineBurn = !isSgptDataTablesLoaded113c(m) && burnLen <= 0 && burn > 0 ? burn : 0
  const total = phys + fire + inlineBurn + ltng + mag + cold + pois
  m.set(pDmg, D2DamageStrc.dwDmgTotal, (total > 0 ? total : 0) >>> 0)
  return total > 0 ? total : 0
}

/**
 * `@va D2Game:0x6FCFBED0` (`SUNITDMG_RollDamageValue`, `348B`):
 * Scales `(minDmg, maxDmg)` by `(str * strBonusWeight) / 100 + (dex * dexBonusWeight) / 100 + enhDmgPct`
 * and rolls `lo + rollSeedMemK2(pUnit->tSeed, hi - lo)`.
 */
export function SUNITDMG_RollDamageValue113c(
  m: Memory113c,
  pUnit: number,
  minDmg: number,
  maxDmg: number,
  strBonusWeight = 0,
  dexBonusWeight = 0,
  enhDmgPct = 0,
  minEdBonus = 0,
  maxEdBonus = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFBED0)
  if (dllAbi) {
    const unit = pUnit >>> 0
    let base = minDmg | 0
    let minVal = maxDmg | 0
    let maxVal = strBonusWeight | 0
    const minEd = dexBonusWeight | 0
    const maxEd = enhDmgPct | 0
    if (maxVal > 0) {
      minVal = (minVal + scaleDivRatioDll113c(minVal, minEd, 100)) | 0
      maxVal = (maxVal + scaleDivRatioDll113c(maxVal, maxEd, 100)) | 0
      base = (base + minVal) | 0
      if (maxVal > minVal) {
        base = (base + (SEED_RollLimitedFast113c(m, (unit + 0x20) >>> 0, (maxVal - minVal) | 0) | 0)) | 0
      }
    }
    return base < 0 ? 0 : base
  }
  let lo = minDmg | 0
  let hi = maxDmg | 0
  if (lo < 0) lo = 0
  if (hi <= lo) hi = lo
  let totalPct = enhDmgPct | 0
  if ((strBonusWeight !== 0 || dexBonusWeight !== 0) && pUnit !== 0) {
    const str = STATLIST_GetUnitStat113c(m, pUnit, 0, 0) | 0
    const dex = STATLIST_GetUnitStat113c(m, pUnit, 2, 0) | 0
    totalPct =
      (totalPct + Math.trunc((str * strBonusWeight) / 100) + Math.trunc((dex * dexBonusWeight) / 100)) | 0
  }
  if (totalPct < -90) totalPct = -90
  const loPct = (totalPct + (minEdBonus | 0)) | 0
  const hiPct = (totalPct + (maxEdBonus | 0)) | 0
  if (loPct !== 0) lo = (lo + Math.trunc((lo * loPct) / 100)) | 0
  if (hiPct !== 0) hi = (hi + Math.trunc((hi * hiPct) / 100)) | 0
  if (lo < 0) lo = 0
  if (hi < 0) hi = 0
  const delta = hi > lo ? hi - lo : 0
  let rolled = lo
  if (delta > 0 && pUnit !== 0) {
    rolled = (lo + (rollSeedMemK2(m, pUnit + D2UnitStrc.seedLo.off, delta) | 0)) | 0
  }
  return rolled > 0 ? rolled : 0
}

/**
 * `@va D2Game:0x6FCFC530` (`SUNITDMG_ComputeWeaponBaseDamage`, `588B`):
 * Computes `256`-fixed-point weapon physical damage from `STAT_MINDAMAGE (21)` / `STAT_MAXDAMAGE (22)`
 * (or `23`/`24` two-handed), `STAT_ITEM_NORMALDAMAGE (111)`, `STAT_MINDAMAGE_PERCENT (18)`,
 * `STAT_MAXDAMAGE_PERCENT (17)`, weapon `strBonus`/`dexBonus` + passive Weapon Mastery (`#10804`),
 * `SUNITDMG_GetTotalSkillDamageBonus113c`, and `SUNITDMG_AddMonsterTypeDamageBonus113c`.
 */
function isUnitWieldingTwoHandedWeaponK2(m: Memory113c, pUnit: number, pWeapon: number): boolean {
  if (pUnit === 0 || pWeapon === 0) return false
  const pAttInv = m.get(pUnit, D2UnitStrc.pInventory)
  if (pAttInv === 0) return false
  if (isSgptDataTablesLoaded113c(m) && safeReadU32K2(m, pAttInv) === 0x01020304) {
    return (INVENTORY_GetEquippedWeaponHandClass113c(m, pUnit, pAttInv) | 0) === 2
  }
  if (findItemInInventoryByBodyLocK2(m, pAttInv, 4) !== 0 && findItemInInventoryByBodyLocK2(m, pAttInv, 5) !== 0) {
    return false
  }
  const itemClassId = m.get(pWeapon, D2UnitStrc.dwClassId) | 0
  const pItemsTxtBase = safeReadU32K2(m, 0x6fdefb98)
  const nItemsCount = safeReadU32K2(m, 0x6fdefb94) | 0
  if (pItemsTxtBase !== 0 && itemClassId >= 0 && itemClassId < nItemsCount) {
    const pTxt = (pItemsTxtBase + Math.imul(itemClassId, 0x1a8)) >>> 0
    return m.u8((pTxt + 0x137) >>> 0) !== 0
  }
  const sgpt = safeReadU32K2(m, 0x6fde9e1c)
  if (sgpt !== 0) {
    const pAltBase = safeReadU32K2(m, sgpt)
    if (pAltBase !== 0 && itemClassId >= 0) {
      const pTxt = (pAltBase + Math.imul(itemClassId, 0x1a8)) >>> 0
      return m.u8((pTxt + 0x137) >>> 0) !== 0
    }
  }
  return false
}

export function SUNITDMG_ComputeWeaponBaseDamage113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  strBonusWeight = 90,
  dexBonusWeight = 0,
  bUseAttack2 = 0,
  skillPhysOverride?: { min256: number; max256: number; nSrcDamage?: number },
  dllArg6 = 0,
  dllArg7 = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFC530)
  if (dllAbi) {
    const att = pAttacker >>> 0
    let edPct = pDefender | 0
    let maxVal = pDmg | 0
    const bUseWeapon = strBonusWeight | 0
    let wpn = dexBonusWeight >>> 0
    let minVal = bUseAttack2 | 0
    const physBase = dllArg6 | 0
    const srcDam = dllArg7 & 0xff
    if (bUseWeapon !== 0) {
      if (wpn === 0) {
        wpn = PLAYER_GetEquippedWeapon113c(m, att) >>> 0
      }
      if (wpn !== 0) {
        const handCls = INVENTORY_GetEquippedWeaponHandClass113c(m, att, m.u32((att + 0x60) >>> 0)) | 0
        if (handCls === 2) {
          minVal = STATLIST_GetUnitStat113c(m, att, 0x17, 0) | 0
          maxVal = STATLIST_GetUnitStat113c(m, att, 0x18, 0) | 0
        } else {
          minVal = STATLIST_GetUnitStat113c(m, att, 0x15, 0) | 0
          maxVal = STATLIST_GetUnitStat113c(m, att, 0x16, 0) | 0
        }
      } else {
        minVal = STATLIST_GetUnitStat113c(m, att, 0x15, 0) | 0
        if (minVal <= 0) minVal = 1
        maxVal = STATLIST_GetUnitStat113c(m, att, 0x16, 0) | 0
        if (maxVal <= 1) maxVal = 2
      }
      minVal = (minVal << 8) | 0
      maxVal = (maxVal << 8) | 0
    }
    const norm256 = ((STATLIST_GetUnitStatWithLayer113c(m, att, 0x6f, 0) | 0) << 8) | 0
    minVal = (minVal + norm256) | 0
    maxVal = (maxVal + norm256) | 0
    if (minVal < 1) minVal = 0x100
    if (maxVal <= minVal) maxVal = (minVal + 0x100) | 0
    edPct = (edPct + (STATLIST_GetUnitStat113c(m, att, 0x19, 0) | 0)) | 0
    const minEd = STATLIST_GetUnitStat113c(m, att, 0x12, 0) | 0
    const maxEd = STATLIST_GetUnitStat113c(m, att, 0x11, 0) | 0
    if (wpn !== 0) {
      const strB = (ITEMS_GetStrBonusMemPort113c(m, wpn) << 16) >> 16
      if (strB !== 0) {
        edPct = (edPct + (Math.trunc(imul32(STATLIST_GetUnitStat113c(m, att, 0, 0) | 0, strB) / 100) | 0)) | 0
      }
      const dexB = (ITEMS_GetDexBonusMemPort113c(m, wpn) << 16) >> 16
      if (dexB !== 0) {
        edPct = (edPct + (Math.trunc(imul32(STATLIST_GetUnitStat113c(m, att, 2, 0) | 0, dexB) / 100) | 0)) | 0
      }
      edPct = (edPct + (SKILLS_GetWeaponMasteryBonusMemPort113c(m, att, wpn, 0, 1) | 0)) | 0
    } else if (bUseWeapon !== 0) {
      edPct = (edPct + (STATLIST_GetUnitStat113c(m, att, 0, 0) | 0)) | 0
    }
    if (edPct <= -0x5a) edPct = -0x5a
    const rolled = SUNITDMG_RollDamageValue113c(
      m,
      att,
      physBase,
      minVal,
      maxVal,
      (minEd + edPct) | 0,
      (maxEd + edPct) | 0,
      0,
      0,
      true,
    )
    if (srcDam === 0x80) return rolled
    return scaleDivRatioDll113c(rolled, srcDam, 128)
  }
  if (pAttacker === 0 || pDmg === 0) return 0
  if (skillPhysOverride !== undefined) {
    // 1.13c D2Game:0x6FCFC530 bUseWeapon == 0 path (0x6FCFC545: je 0x6fcfc5d3):
    // uses caller-supplied 256-fixed-point skill phys min/max directly, skips weapon/STR/DEX,
    // adds stat 111 (normal damage) << 8, clamps min < 1 -> 0x100 and max <= min -> min + 0x100,
    // applies stat 25 (clamped >= -90) + stat 18/17, rolls via 0x6FCFBED0, and scales by nSrcDamage.
    const normDmg256 = (STATLIST_GetUnitStat113c(m, pAttacker, 111, 0) | 0) << 8
    let min256 = ((skillPhysOverride.min256 | 0) + normDmg256) | 0
    let max256 = ((skillPhysOverride.max256 | 0) + normDmg256) | 0
    if (min256 < 1) min256 = 0x100
    if (max256 <= min256) max256 = (min256 + 0x100) | 0
    let edBase = STATLIST_GetUnitStat113c(m, pAttacker, 25, 0) | 0
    const minEd = STATLIST_GetUnitStat113c(m, pAttacker, 18, 0) | 0
    const maxEd = STATLIST_GetUnitStat113c(m, pAttacker, 17, 0) | 0
    if (edBase <= -90) edBase = -90
    let phys = SUNITDMG_RollDamageValue113c(m, pAttacker, min256, max256, 0, 0, edBase, minEd, maxEd)
    const srcDmg = skillPhysOverride.nSrcDamage !== undefined ? (skillPhysOverride.nSrcDamage & 0xff) : 0x80
    if (srcDmg !== 0x80) {
      phys = Math.trunc((phys * srcDmg) / 0x80) | 0
    }
    m.set(pDmg, D2DamageStrc.dwPhysDamage, phys >>> 0)
    return phys
  }
  const attType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  const pWeapon = getEquippedWeaponK2(m, pAttacker)

  let minRaw = STATLIST_GetUnitStat113c(m, pAttacker, 21, 0) | 0
  let maxRaw = STATLIST_GetUnitStat113c(m, pAttacker, 22, 0) | 0
  const secMin = STATLIST_GetUnitStat113c(m, pAttacker, 23, 0) | 0
  const secMax = STATLIST_GetUnitStat113c(m, pAttacker, 24, 0) | 0
  if (pWeapon !== 0) {
    if (isUnitWieldingTwoHandedWeaponK2(m, pAttacker, pWeapon)) {
      minRaw = secMin
      maxRaw = secMax
    }
  } else if (attType === UNIT_MONSTER) {
    if (bUseAttack2 !== 0) {
      minRaw = secMin
      maxRaw = secMax
    }
    if (maxRaw <= 0 && !isSgptDataTablesLoaded113c(m)) {
      minRaw = 1
      maxRaw = 2
    }
  } else if (secMax > maxRaw) {
    const pAttInv = m.get(pAttacker, D2UnitStrc.pInventory)
    const bothHandsOccupied =
      pAttInv !== 0 &&
      findItemInInventoryByBodyLocK2(m, pAttInv, 4) !== 0 &&
      findItemInInventoryByBodyLocK2(m, pAttInv, 5) !== 0
    if (!bothHandsOccupied) {
      minRaw = secMin
      maxRaw = secMax
    }
  }
  const normDmg256 = (STATLIST_GetUnitStat113c(m, pAttacker, 111, 0) | 0) << 8
  let min256 = ((minRaw << 8) + normDmg256) | 0
  let max256 = ((maxRaw << 8) + normDmg256) | 0
  if (min256 < 256) min256 = 256
  if (max256 <= min256) max256 = (min256 + 256) | 0

  let effStrWeight = strBonusWeight
  let effDexWeight = dexBonusWeight
  let masteryDmgPct = 0
  if (pWeapon !== 0) {
    if (isSgptDataTablesLoaded113c(m)) {
      effStrWeight = ITEMS_GetStrBonusMemPort113c(m, pWeapon) | 0
      effDexWeight = ITEMS_GetDexBonusMemPort113c(m, pWeapon) | 0
    } else {
      const rec = getItemsTxtRecordPure113c(m.get(pWeapon, D2UnitStrc.dwClassId) | 0)
      if (rec !== null) {
        effStrWeight = rec.strBonus | 0
        effDexWeight = rec.dexBonus | 0
      }
    }
    masteryDmgPct = getWeaponMasteryBonusK2(m, pAttacker, pWeapon, 1)
  } else if (attType === UNIT_PLAYER) {
    if (m.get(pAttacker, D2UnitStrc.pInventory) !== 0) {
      effStrWeight = 100
      effDexWeight = 0
    }
  } else {
    effStrWeight = 0
    effDexWeight = 0
  }

  const minEd = STATLIST_GetUnitStat113c(m, pAttacker, 18, 0) | 0
  const maxEd = STATLIST_GetUnitStat113c(m, pAttacker, 17, 0) | 0
  const presetEnh = m.get(pDmg, D2DamageStrc.dwEnhDmgPct) | 0
  const baseStat25 = STATLIST_GetUnitStat113c(m, pAttacker, 25, 0) | 0
  const enhPct =
    (presetEnh +
      baseStat25 +
      masteryDmgPct +
      SUNITDMG_AddMonsterTypeDamageBonus113c(m, pAttacker, pDefender)) |
    0
  if (attType === UNIT_PLAYER || pWeapon !== 0) {
    SUNITDMG_GetTotalSkillDamageBonus113c(m, pAttacker, presetEnh)
  }

  const phys = SUNITDMG_RollDamageValue113c(
    m,
    pAttacker,
    min256,
    max256,
    effStrWeight,
    effDexWeight,
    enhPct,
    minEd,
    maxEd,
  )
  m.set(pDmg, D2DamageStrc.dwPhysDamage, phys >>> 0)
  return phys
}

/**
 * `@va D2Game:0x6FCFCD80` (`SUNITDMG_RollElementalStatDamage`, `236B`):
 * Rolls `Fire (48..49)`, `Ltng (50..51)`, `Cold (54..56)`, `Mag (52..53)`, `Pois (57..59)`, and
 * `Life/Mana/Stam Steal (60, 62, 64)` from `pAttacker` into `pDmg` in exact 1.13c `0x6FCFD664..0x6FCFD8ED` order.
 */
export function SUNITDMG_RollElementalStatDamage113c(
  m: Memory113c,
  pAttacker: number,
  pDmg: number,
  srcDam = 128,
  arg3 = 0,
  arg4 = 0,
  arg5 = 0,
  arg6 = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFCD80)
  if (dllAbi) {
    const unit = pAttacker >>> 0
    const minStat = pDmg | 0
    const maxStat = srcDam | 0
    const mastStat = arg3 | 0
    let minEd = arg4 | 0
    let maxEd = arg5 | 0
    const base = arg6 | 0
    const max256 = ((STATLIST_GetUnitStat113c(m, unit, maxStat, 0) | 0) << 8) | 0
    if (max256 < 8) {
      return base < 0 ? 0 : base
    }
    const min256 = ((STATLIST_GetUnitStat113c(m, unit, minStat, 0) | 0) << 8) | 0
    if (mastStat !== -1) {
      const mast = STATLIST_GetUnitStat113c(m, unit, mastStat, 0) | 0
      minEd = (minEd + mast) | 0
      maxEd = (maxEd + mast) | 0
    }
    return SUNITDMG_RollDamageValue113c(m, unit, base, min256, max256, minEd, maxEd, 0, 0, true)
  }
  if (pAttacker === 0 || pDmg === 0) return 0
  const scaleSrc = (v: number): number =>
    srcDam === 128 ? v : (sar32(Math.imul(v | 0, srcDam | 0), 7) | 0)

  const rollElem = (minStat: number, maxStat: number, masteryStat: number): number => {
    const max256 = (STATLIST_GetUnitStat113c(m, pAttacker, maxStat, 0) | 0) << 8
    if (max256 < 8) return 0
    const min256 = (STATLIST_GetUnitStat113c(m, pAttacker, minStat, 0) | 0) << 8
    const masteryPct =
      masteryStat >= 0 ? (STATLIST_GetUnitStat113c(m, pAttacker, masteryStat, 0) | 0) : 0
    const rolled = SUNITDMG_RollDamageValue113c(m, pAttacker, min256, max256, 0, 0, masteryPct, 0, 0)
    return scaleSrc(rolled)
  }

  const fireDmg = rollElem(48, 49, 329)
  if (fireDmg > 0) m.set(pDmg, D2DamageStrc.dwFireDamage, fireDmg >>> 0)
  const ltngDmg = rollElem(50, 51, 330)
  if (ltngDmg > 0) m.set(pDmg, D2DamageStrc.dwLtngDamage, ltngDmg >>> 0)
  const coldDmg = rollElem(54, 55, 331)
  if (coldDmg > 0) m.set(pDmg, D2DamageStrc.dwColdDamage, coldDmg >>> 0)
  const magDmg = rollElem(52, 53, 357)
  if (magDmg > 0) m.set(pDmg, D2DamageStrc.dwMagDamage, magDmg >>> 0)

  const attType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  const pInv = m.get(pAttacker, D2UnitStrc.pInventory)
  const monHasItems =
    attType === UNIT_MONSTER &&
    pInv !== 0 &&
    (findItemInInventoryByBodyLocK2(m, pInv, 4) !== 0 ||
      findItemInInventoryByBodyLocK2(m, pInv, 5) !== 0 ||
      findItemInInventoryByBodyLocK2(m, pInv, 3) !== 0)
  if (attType === UNIT_PLAYER || monHasItems || !isSgptDataTablesLoaded113c(m)) {
    m.set(pDmg, D2DamageStrc.dwLifeLeech, (STATLIST_GetUnitStat113c(m, pAttacker, 60, 0) | 0) >>> 0)
    m.set(pDmg, D2DamageStrc.dwManaLeech, (STATLIST_GetUnitStat113c(m, pAttacker, 62, 0) | 0) >>> 0)
    m.set(pDmg, D2DamageStrc.dwStamLeech, (STATLIST_GetUnitStat113c(m, pAttacker, 64, 0) | 0) >>> 0)
  } else {
    const lifeLeech = rollElem(60, 61, -1)
    if (lifeLeech > 0) m.set(pDmg, D2DamageStrc.dwLifeLeech, lifeLeech >>> 0)
    const manaLeech = rollElem(62, 63, -1)
    if (manaLeech > 0) m.set(pDmg, D2DamageStrc.dwManaLeech, manaLeech >>> 0)
    const stamLeech = rollElem(64, 65, -1)
    if (stamLeech > 0) m.set(pDmg, D2DamageStrc.dwStamLeech, stamLeech >>> 0)
  }

  const poisMin = STATLIST_GetUnitStat113c(m, pAttacker, 57, 0) | 0
  const poisMax = STATLIST_GetUnitStat113c(m, pAttacker, 58, 0) | 0
  if (poisMax > 0) {
    const poisMastery = STATLIST_GetUnitStat113c(m, pAttacker, 332, 0) | 0
    const rolledPois = SUNITDMG_RollDamageValue113c(m, pAttacker, poisMin, poisMax, 0, 0, poisMastery, 0, 0)
    const scaledPois = scaleSrc(rolledPois)
    if (scaledPois > 0) {
      m.set(pDmg, D2DamageStrc.dwPoisDamage, scaledPois >>> 0)
      const overrideLen = STATLIST_GetUnitStat113c(m, pAttacker, 101, 0) | 0
      if (overrideLen > 0) {
        m.set(pDmg, D2DamageStrc.dwPoisLen, overrideLen >>> 0)
      } else {
        const rawLen = STATLIST_GetUnitStat113c(m, pAttacker, 59, 0) | 0
        const cnt = STATLIST_GetUnitStat113c(m, pAttacker, 326, 0) | 0
        const effLen = cnt > 1 ? Math.trunc(rawLen / cnt) | 0 : rawLen
        m.set(pDmg, D2DamageStrc.dwPoisLen, (effLen > 0 ? effLen : 0) >>> 0)
      }
    }
  }
  if (coldDmg > 0) {
    const rawColdLen = STATLIST_GetUnitStat113c(m, pAttacker, 56, 0) | 0
    m.set(pDmg, D2DamageStrc.dwColdLen, scaleSrc(rawColdLen) >>> 0)
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFD450` (`SUNITDMG_FillDamageValues`, `1588B`):
 * Populates `D2DamageStrc` for melee/ranged/monster swings (`D2Game.dll:0x6FCFD450`).
 */
export function SUNITDMG_FillDamageValues113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  bUseAttack2 = 0,
  srcDam = 128,
  bSkipAutoToHit = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFD450)
  const useHydratedDllAbi =
    dllAbi ||
    (pAttacker !== 0 &&
      pDefender !== 0 &&
      pDmg !== 0 &&
      (m.u32(pAttacker >>> 0) | 0) === UNIT_PLAYER &&
      isSgptDataTablesLoaded113c(m) &&
      hasHydratedAnimDataTableK2(m) &&
      (bSkipAutoToHit !== 0 || (m.get(pDmg, D2DamageStrc.wResultFlags) & 0x8391) !== 0))
  if (useHydratedDllAbi) {
    const game = pGame >>> 0
    const att = pAttacker >>> 0
    const def = pDefender >>> 0
    const dmg = pDmg >>> 0
    if (att === 0 || dmg === 0 || def === 0) return 0
    let effSrc = srcDam & 0xff
    if (effSrc === 0) effSrc = 0x80
    const bUseWpnStats = bUseAttack2 | 0
    PLAYER_UpdateDualWieldWeaponStatLists113c(m, bUseWpnStats, att)
    const attType = m.u32(att) | 0
    const defType = m.u32(def) | 0
    m.setU32(dmg, (m.u32(dmg) | (dllAbi ? 0x20 : 0x22)) >>> 0)
    if ((attType === 0 || UNIT_GetAlignmentMemPort113c(m, att) === 2) && defType === 1) {
      SUNITDMG_ApplyAttackerThornsToSelf113c(m, att, def, 0, true)
      if (MONSTER_CheckMonTypeFlag0x20_113c(m, def) !== 0) {
        const demFlat = STATLIST_GetUnitStatWithLayer113c(m, att, 0x79, 0) | 0
        if (demFlat > 0) {
          m.setU32((dmg + 0x0c) >>> 0, ((m.u32((dmg + 0x0c) >>> 0) | 0) + demFlat) >>> 0)
        }
      }
      SUNITDMG_AddDemonDamageBonus113c(m, def, att, dmg, true)
      SUNITDMG_AddMonsterTypeDamageBonus113c(m, def, att, dmg, true)
    }
    if ((m.u8(dmg) & 1) === 0) {
      const phys = SUNITDMG_ComputeWeaponBaseDamage113c(
        m,
        att,
        m.u32((dmg + 0x0c) >>> 0) | 0,
        0,
        1,
        0,
        0,
        undefined,
        m.u32((dmg + 0x08) >>> 0) | 0,
        effSrc,
        true,
      )
      m.setU32((dmg + 0x08) >>> 0, phys >>> 0)
      let isCrit = false
      if (bUseWpnStats === 0) {
        const wpn = PLAYER_GetEquippedWeapon113c(m, att) >>> 0
        if (wpn !== 0) {
          const mCrit = SKILLS_GetWeaponMasteryBonusMemPort113c(m, att, wpn, 0, 2) | 0
          if (mCrit > 0 && SEED_RollRangeWithMinFast113c(m, (att + 0x20) >>> 0, 0, 100) < mCrit) {
            isCrit = true
          }
        }
      }
      if (!isCrit) {
        const cs = STATLIST_GetUnitStat113c(m, att, 0x151, 0) | 0
        if (cs > 0 && SEED_RollRangeWithMinFast113c(m, (att + 0x20) >>> 0, 0, 100) < cs) {
          isCrit = true
        }
      }
      if (!isCrit) {
        const ds = STATLIST_GetUnitStatWithLayer113c(m, att, 0x8d, 0) | 0
        if (ds > 0 && SEED_RollRangeWithMinFast113c(m, (att + 0x20) >>> 0, 0, 100) < ds) {
          isCrit = true
        }
      }
      if (isCrit) {
        m.setU32((dmg + 0x08) >>> 0, (m.u32((dmg + 0x08) >>> 0) << 1) >>> 0)
        m.setU8((dmg + 0x05) >>> 0, (m.u8((dmg + 0x05) >>> 0) | 0x20) & 0xff)
      }
    }
    const scaleIfSrc = (v: number): number =>
      effSrc === 0x80 ? (v | 0) : sdiv32(imul32(v | 0, effSrc), 128)
    m.setU32(
      (dmg + 0x10) >>> 0,
      scaleIfSrc(
        SUNITDMG_RollElementalStatDamage113c(
          m,
          att,
          0x30,
          0x31,
          0x149,
          0,
          0,
          m.u32((dmg + 0x10) >>> 0) | 0,
          true,
        ),
      ) >>> 0,
    )
    m.setU32(
      (dmg + 0x1c) >>> 0,
      scaleIfSrc(
        SUNITDMG_RollElementalStatDamage113c(
          m,
          att,
          0x32,
          0x33,
          0x14a,
          0,
          0,
          m.u32((dmg + 0x1c) >>> 0) | 0,
          true,
        ),
      ) >>> 0,
    )
    m.setU32(
      (dmg + 0x24) >>> 0,
      scaleIfSrc(
        SUNITDMG_RollElementalStatDamage113c(
          m,
          att,
          0x36,
          0x37,
          0x14b,
          0,
          0,
          m.u32((dmg + 0x24) >>> 0) | 0,
          true,
        ),
      ) >>> 0,
    )
    m.setU32(
      (dmg + 0x20) >>> 0,
      scaleIfSrc(
        SUNITDMG_RollElementalStatDamage113c(
          m,
          att,
          0x34,
          0x35,
          0x165,
          0,
          0,
          m.u32((dmg + 0x20) >>> 0) | 0,
          true,
        ),
      ) >>> 0,
    )

    const hireId = MONSTERS_GetHirelingTypeId113c(m, att) | 0
    if (attType === 1 && hireId === 0) {
      if ((m.u8(dmg) & 0x04) === 0) {
        const add = sdiv32(
          imul32(SUNITDMG_RollElementalStatDamage113c(m, att, 0x3c, 0x3d, -1, 0, 0, m.u32((dmg + 0x38) >>> 0) | 0, true), effSrc),
          128,
        )
        m.setU32((dmg + 0x38) >>> 0, ((m.u32((dmg + 0x38) >>> 0) | 0) + add) >>> 0)
      }
      if ((m.u8(dmg) & 0x08) === 0) {
        const add = sdiv32(
          imul32(SUNITDMG_RollElementalStatDamage113c(m, att, 0x3e, 0x3f, -1, 0, 0, m.u32((dmg + 0x3c) >>> 0) | 0, true), effSrc),
          128,
        )
        m.setU32((dmg + 0x3c) >>> 0, ((m.u32((dmg + 0x3c) >>> 0) | 0) + add) >>> 0)
      }
      if ((m.u8(dmg) & 0x10) === 0) {
        const add = sdiv32(
          imul32(SUNITDMG_RollElementalStatDamage113c(m, att, 0x40, 0x41, -1, 0, 0, m.u32((dmg + 0x40) >>> 0) | 0, true), effSrc),
          128,
        )
        m.setU32((dmg + 0x40) >>> 0, ((m.u32((dmg + 0x40) >>> 0) | 0) + add) >>> 0)
      }
    } else if (attType === 0 || hireId !== 0) {
      if ((m.u8(dmg) & 0x04) === 0) {
        const v = STATLIST_GetUnitStat113c(m, att, 0x3c, 0) | 0
        m.setU32((dmg + 0x38) >>> 0, ((m.u32((dmg + 0x38) >>> 0) | 0) + v) >>> 0)
      }
      if ((m.u8(dmg) & 0x08) === 0) {
        const v = STATLIST_GetUnitStat113c(m, att, 0x3e, 0) | 0
        m.setU32((dmg + 0x3c) >>> 0, ((m.u32((dmg + 0x3c) >>> 0) | 0) + v) >>> 0)
      }
      if ((STATLIST_GetUnitStat113c(m, att, 0x67, 0) | 0) !== 0) {
        m.setU32(dmg, (m.u32(dmg) | 0x100) >>> 0)
      }
      if ((STATLIST_GetUnitStat113c(m, att, 0x68, 0) | 0) !== 0) {
        m.setU32(dmg, (m.u32(dmg) | 0x200) >>> 0)
      }
      if ((STATLIST_GetUnitStat113c(m, att, 0x6a, 0) | 0) !== 0) {
        m.setU32(dmg, (m.u32(dmg) | 0x400) >>> 0)
      }
    }

    const pMin = STATLIST_GetUnitStat113c(m, att, 0x39, 0) | 0
    const pMax = STATLIST_GetUnitStat113c(m, att, 0x3a, 0) | 0
    const pMast = pMax > 0 ? (STATLIST_GetUnitStat113c(m, att, 0x14c, 0) | 0) : 0
    const poisRolled = SUNITDMG_RollDamageValue113c(
      m,
      att,
      m.u32((dmg + 0x28) >>> 0) | 0,
      pMin,
      pMax,
      pMast,
      pMast,
      0,
      0,
      true,
    )
    const poisScaled = sdiv32(imul32(poisRolled, effSrc), 128)
    m.setU32((dmg + 0x28) >>> 0, poisScaled >>> 0)
    if (poisScaled !== 0) {
      const ovLen = STATLIST_GetUnitStat113c(m, att, 0x65, 0) | 0
      if (ovLen > 0) {
        m.setU32((dmg + 0x2c) >>> 0, ((m.u32((dmg + 0x2c) >>> 0) | 0) + ovLen) >>> 0)
      } else {
        const rawLen = STATLIST_GetUnitStat113c(m, att, 0x3b, 0) | 0
        let sumLen = ((m.u32((dmg + 0x2c) >>> 0) | 0) + rawLen) | 0
        const cnt = STATLIST_GetUnitStat113c(m, att, 0x146, 0) | 0
        if (cnt > 1) sumLen = sdiv32(sumLen, cnt)
        m.setU32((dmg + 0x2c) >>> 0, sumLen >>> 0)
      }
    }
    if ((m.u32((dmg + 0x24) >>> 0) | 0) > 0) {
      const addCold = sdiv32(imul32(STATLIST_GetUnitStat113c(m, att, 0x38, 0) | 0, effSrc), 128)
      m.setU32((dmg + 0x30) >>> 0, ((m.u32((dmg + 0x30) >>> 0) | 0) + addCold) >>> 0)
    }
    if (m.u32((dmg + 0x44) >>> 0) === 0) {
      const addStun = sdiv32(imul32(STATLIST_GetUnitStat113c(m, att, 0x42, 0) | 0, effSrc), 128)
      m.setU32((dmg + 0x44) >>> 0, ((m.u32((dmg + 0x44) >>> 0) | 0) + addStun) >>> 0)
    }
    const burnBase = m.u32((dmg + 0x14) >>> 0) | 0
    const burnRoll = SEED_RollLimitedFast113c(m, (att + 0x20) >>> 0, 1) | 0
    const burnSum = (imul32(burnBase, effSrc) + 0x13c + burnRoll) | 0
    const burnAdd = burnSum < 0 ? 0 : sdiv32(burnSum, 128)
    m.setU32((dmg + 0x14) >>> 0, (burnBase + burnAdd) >>> 0)
    if (m.u32((dmg + 0x18) >>> 0) !== 0) {
      const addBurnLen = sdiv32(imul32(STATLIST_GetUnitStat113c(m, att, 0x13b, 0) | 0, effSrc), 128)
      m.setU32((dmg + 0x18) >>> 0, ((m.u32((dmg + 0x18) >>> 0) | 0) + addBurnLen) >>> 0)
    }
    if ((attType === 0 || hireId !== 0) && (m.u8((dmg + 0x04) >>> 0) & 0x20) === 0) {
      SUNIT_DispatchItemEventCallbacks113c(m, att, game, 3, def, dmg)
    }
    let convType = m.u8((dmg + 0x65) >>> 0)
    if (convType > 0) {
      const convPct = m.u32((dmg + 0x68) >>> 0) | 0
      const convAmt = mulDiv113c(convPct, m.u32((dmg + 0x08) >>> 0) | 0, 100) | 0
      const remPhys = ((m.u32((dmg + 0x08) >>> 0) | 0) - convAmt) | 0
      m.setU32((dmg + 0x08) >>> 0, (remPhys > 0 ? remPhys : 0) >>> 0)
      if (convType === 10) {
        convType = ((rollSeedMemK2(m, (att + 0x20) >>> 0, 5) | 0) + 1) & 0xff
      }
      if (convType === 1) {
        m.setU32((dmg + 0x10) >>> 0, ((m.u32((dmg + 0x10) >>> 0) | 0) + convAmt) >>> 0)
      } else if (convType === 2) {
        m.setU32((dmg + 0x1c) >>> 0, ((m.u32((dmg + 0x1c) >>> 0) | 0) + convAmt) >>> 0)
      } else if (convType === 3) {
        m.setU32((dmg + 0x20) >>> 0, ((m.u32((dmg + 0x20) >>> 0) | 0) + convAmt) >>> 0)
      } else if (convType === 4) {
        m.setU32((dmg + 0x24) >>> 0, ((m.u32((dmg + 0x24) >>> 0) | 0) + convAmt) >>> 0)
        if ((m.u32((dmg + 0x30) >>> 0) | 0) < 0x32) m.setU32((dmg + 0x30) >>> 0, 0x32)
      } else if (convType === 5) {
        m.setU32((dmg + 0x28) >>> 0, ((m.u32((dmg + 0x28) >>> 0) | 0) + sdiv32(convAmt, 8)) >>> 0)
        if ((m.u32((dmg + 0x2c) >>> 0) | 0) < 0x32) m.setU32((dmg + 0x2c) >>> 0, 0x32)
      } else if (convType === 11) {
        m.setU32((dmg + 0x10) >>> 0, ((m.u32((dmg + 0x10) >>> 0) | 0) + convAmt) >>> 0)
        if ((m.u32((dmg + 0x18) >>> 0) | 0) < 0x32) m.setU32((dmg + 0x18) >>> 0, 0x32)
      } else if (convType === 12) {
        m.setU32((dmg + 0x24) >>> 0, ((m.u32((dmg + 0x24) >>> 0) | 0) + convAmt) >>> 0)
        if ((m.u32((dmg + 0x34) >>> 0) | 0) < 0x32) m.setU32((dmg + 0x34) >>> 0, 0x32)
      }
    }
    MONSTER_ApplyCritDamage113c(m, att, dmg, def)
    PLAYER_SetActiveDualWeaponStatLists113c(m, bUseWpnStats, att)
    return 0
  }
  void pGame
  if (pAttacker === 0 || pDefender === 0 || pDmg === 0) return 0
  if (bSkipAutoToHit === 0 && (m.get(pDmg, D2DamageStrc.wResultFlags) & 0x8391) === 0) {
    if (SUNITDMG_CheckToHit113c(m, pAttacker, pDefender, pDmg, 0) === 0) return 0
  }

  const attackerType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  if (isSgptDataTablesLoaded113c(m)) {
    PLAYER_UpdateDualWieldWeaponStatLists113c(m, bUseAttack2, pAttacker)
    if (safeReadU32K2(m, 0x6fdd90b0) !== 0 && m.u32(pDefender) === UNIT_MONSTER) {
      MONSTER_CheckMonTypeFlag0x20_113c(m, pDefender)
    }
  }
  // 0x6FCFD492: `or dword ptr [ebp], 0x20` (`DAMAGEFLAG_SRC_WEAPON_FILL`) + `0x02` (`DAMAGEFLAG_ALREADY_FILLED`)
  m.set(pDmg, D2DamageStrc.dwHitFlags, (m.get(pDmg, D2DamageStrc.dwHitFlags) | 0x22) >>> 0)
  const attackerWeapon = getEquippedWeaponK2(m, pAttacker)
  if (attackerType === UNIT_PLAYER || attackerType === UNIT_MONSTER || attackerWeapon !== 0) {
    SUNITDMG_ComputeWeaponBaseDamage113c(
      m,
      pAttacker,
      pDefender,
      pDmg,
      attackerType === UNIT_PLAYER ? 90 : 0,
      0,
      bUseAttack2,
    )
    SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c(m, pAttacker, pDefender, pDmg, srcDam)
    SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pAttacker, pDmg)
  }

  // 0x6FCFD520..0x6FCFD5B4: Weapon Mastery crit (`#10804`), Critical Strike (`337`), Deadly Strike (`141`)
  // MUST run BEFORE `0x6FCFD664` (`SUNITDMG_RollElementalStatDamage113c`) to match `pAttacker->pSeed` LCG order!
  let physAfterBase = m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0
  if (physAfterBase > 0) {
    let isCrit = false
    const pWeapon = attackerWeapon
    if (pWeapon !== 0 && checkItemTypePureOrMemK2(m, pWeapon, 46) !== 0) {
      const masteryCrit = getWeaponMasteryBonusK2(m, pAttacker, pWeapon, 2)
      if (masteryCrit > 0 && (rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100) | 0) < masteryCrit) {
        isCrit = true
      }
    }
    if (!isCrit) {
      const csChance = STATLIST_GetUnitStat113c(m, pAttacker, 337, 0) | 0
      if (csChance > 0 && (rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100) | 0) < csChance) {
        isCrit = true
      }
    }
    if (!isCrit) {
      const dsChance = STATLIST_GetUnitStat113c(m, pAttacker, 141, 0) | 0
      if (dsChance > 0 && (rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100) | 0) < dsChance) {
        isCrit = true
      }
    }
    if (isCrit) {
      physAfterBase = (physAfterBase << 1) | 0
      m.set(pDmg, D2DamageStrc.dwPhysDamage, physAfterBase >>> 0)
      // `0x6FCFD5AD: or byte ptr [ebp + 5], 0x20` -> `wResultFlags |= 0x2000` (`RESULTFLAG_CRITICAL_STRIKE`)
      m.set(pDmg, D2DamageStrc.wResultFlags, (m.get(pDmg, D2DamageStrc.wResultFlags) | 0x2000) & 0xffff)
    }
  }

  // 0x6FCFD5B4..0x6FCFD8ED: Elemental & Poison stat rolls AFTER Critical/Deadly Strike!
  if (attackerType === UNIT_PLAYER || attackerType === UNIT_MONSTER) {
    SUNITDMG_RollElementalStatDamage113c(m, pAttacker, pDmg, srcDam)
  }

  // 0x6FCFD8F0..0x6FCFD92D: burn damage rounding (`SEED_RollLimited(pAttacker->pSeed, 1)` at `0x6FCFD908`)
  const rawBurn = m.get(pDmg, D2DamageStrc.dwBurnDamage) | 0
  const burnScaled = (Math.imul(rawBurn, srcDam | 0) + 0x13c) | 0
  const burnRoll = rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 1) | 0
  const burnTotal = (burnScaled + burnRoll - 0x13c) | 0
  m.set(pDmg, D2DamageStrc.dwBurnDamage, (burnTotal > 0 ? burnTotal >> 7 : 0) >>> 0)

  // 0x6FC970E0 (`MONSTER_ApplyCritDamage`, called on monster swings after `0x6FCFD450`)
  if (attackerType === UNIT_MONSTER) {
    const classId = m.get(pAttacker, D2UnitStrc.dwClassId) | 0
    const pTablesPtr = safeReadU32K2(m, D2GAME_IAT_SGPT_DATATABLES_VA_113C)
    const pTables = pTablesPtr !== 0 ? safeReadU32K2(m, pTablesPtr) : 0
    if (pTables !== 0 && classId >= 0 && classId < (m.u32((pTables + 0xa80) >>> 0) | 0)) {
      const pMonRow = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(classId, 0x1a8)) >>> 0
      const rowCrit = pMonRow !== 0 ? m.u8((pMonRow + 0xa6) >>> 0) : 0
      MONSTER_ApplyCritDamage113c(m, pAttacker, pDmg, pDefender)
      if (rowCrit !== 0) {
        // Note: MONSTER_ApplyCritDamage113c already rolled & doubled damage channels when < rowCrit
      }
    } else {
      const bCrit = getMonsterCritPure113c(classId)
      if (bCrit > 0 && (rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100) | 0) < bCrit) {
        m.set(pDmg, D2DamageStrc.dwPhysDamage, ((m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0) << 1) >>> 0)
        m.set(pDmg, D2DamageStrc.dwBurnDamage, ((m.get(pDmg, D2DamageStrc.dwBurnDamage) | 0) << 1) >>> 0)
        m.set(pDmg, D2DamageStrc.wResultFlags, (m.get(pDmg, D2DamageStrc.wResultFlags) | 0x2000) & 0xffff)
      }
    }
  }

  // Crushing Blow (`STAT_ITEM_CRUSHINGBLOW = 136`): `1/4` curHP vs normal monster, `1/8` vs player/boss (`1/2` if ranged)
  const cbChance =
    safeReadU32K2(m, (pAttacker + 0x90) >>> 0) === 0
      ? STATLIST_GetUnitStat113c(m, pAttacker, 136, 0) | 0
      : 0
  if (cbChance > 0 && rollSeedMemK2(m, pAttacker + D2UnitStrc.seedLo.off, 100) < (cbChance > 100 ? 100 : cbChance >>> 0)) {
    const defHp = STATLIST_GetUnitStat113c(m, pDefender, 6, 0) | 0
    if (defHp > 0) {
      const bRanged = (m.get(pDmg, D2DamageStrc.dwHitFlags) & 0x80) !== 0
      const defIsPlayerOrBoss =
        m.u32(pDefender) === UNIT_PLAYER || MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x0a) !== 0
      let div = defIsPlayerOrBoss ? 8 : 4
      if (bRanged) div *= 2
      const cbDmg = Math.trunc(defHp / div)
      if (cbDmg > 0) {
        m.set(pDmg, D2DamageStrc.dwPhysDamage, ((m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0) + cbDmg) >>> 0)
      }
    }
  }

  const burnInline =
    (m.get(pDmg, D2DamageStrc.dwBurnLen) | 0) <= 0 ? (m.get(pDmg, D2DamageStrc.dwBurnDamage) | 0) : 0
  const total =
    (m.get(pDmg, D2DamageStrc.dwPhysDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwFireDamage) | 0) +
    burnInline +
    (m.get(pDmg, D2DamageStrc.dwLtngDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwMagDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwColdDamage) | 0) +
    (m.get(pDmg, D2DamageStrc.dwPoisDamage) | 0)
  m.set(pDmg, D2DamageStrc.dwDmgTotal, (total > 0 ? total : 0) >>> 0)
  if (isSgptDataTablesLoaded113c(m)) {
    PLAYER_SetActiveDualWeaponStatLists113c(m, bUseAttack2, pAttacker)
  }
  return 1
}

/**
 * `@va D2Game:0x6FCFDDE0` (`SUNITDMG_AllocCombat`, `176B`):
 * Allocates a `0x88`-byte `D2CombatStrc` on `Memory113c`, copies `pDmg` into `+0x14`, and prepends it onto
 * `pAttacker->pCombat (+0xAC)` via `SUNITDMG_PrependCombatNode113c` (`0x6FCFAB90`).
 */
export function SUNITDMG_AllocCombat113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  srcDam = 128,
): number {
  hitD2GameVa113c(0x6FCFDDE0)
  if (pAttacker === 0 || pDefender === 0) return 0
  const attType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  const defType = m.get(pDefender, D2UnitStrc.dwUnitType)
  const hydrated = hasHydratedAnimDataTableK2(m)
  if (hydrated && pDmg !== 0) {
    const wFlags = m.get(pDmg, D2DamageStrc.wResultFlags) >>> 0
    if ((wFlags & 0x8380) === 0 && (wFlags & 0x0001) !== 0) {
      if ((m.u8(pDmg >>> 0) & 0x02) === 0) {
        SUNITDMG_FillDamageValues113c(m, pGame, pAttacker, pDefender, pDmg, 0, srcDam, 1)
      }
      SUNITDMG_ApplyResistancesAndAbsorb113c(m, pAttacker, pDefender, pDmg, pGame)
      let sum =
        ((m.u32((pDmg + 0x28) >>> 0) | 0) +
          (m.u32((pDmg + 0x24) >>> 0) | 0) +
          (m.u32((pDmg + 0x20) >>> 0) | 0) +
          (m.u32((pDmg + 0x1c) >>> 0) | 0) +
          (m.u32((pDmg + 0x10) >>> 0) | 0) +
          (m.u32((pDmg + 0x08) >>> 0) | 0)) |
        0
      if (attType === UNIT_MONSTER) {
        sum = (sum + (m.u32((pDmg + 0x38) >>> 0) | 0)) | 0
      }
      const defHp = STATLIST_GetUnitStat113c(m, pDefender, 6, 0) | 0
      if (((sum & ~0xff) | 0) > ((defHp & ~0xff) | 0)) {
        m.setU8((pDmg + 0x04) >>> 0, (m.u8((pDmg + 0x04) >>> 0) | 0x02) & 0xff)
      }
    }
    if (defType !== UNIT_PLAYER && defType !== UNIT_MONSTER) {
      return 0
    }
  }
  const pCombat = m.alloc(D2CombatStrc_SIZE_113C)
  m.fill(pCombat, D2CombatStrc_SIZE_113C, 0)
  m.setU32((pCombat + D2CombatStrcOffK2.pGame) >>> 0, pGame >>> 0)
  m.setU32((pCombat + D2CombatStrcOffK2.dwAttackerType) >>> 0, attType)
  m.setU32((pCombat + D2CombatStrcOffK2.dwAttackerId) >>> 0, m.get(pAttacker, D2UnitStrc.dwUnitId))
  m.setU32((pCombat + D2CombatStrcOffK2.dwDefenderType) >>> 0, defType)
  m.setU32((pCombat + D2CombatStrcOffK2.dwDefenderId) >>> 0, m.get(pDefender, D2UnitStrc.dwUnitId))
  if (pDmg !== 0) {
    for (let off = 0; off < D2DamageStrc_SIZE; off += 4) {
      m.setU32((pCombat + D2CombatStrcOffK2.tDamage + off) >>> 0, m.u32((pDmg + off) >>> 0))
    }
  }
  SUNITDMG_PrependCombatNode113c(m, pAttacker, pCombat)
  return pCombat
}

function calcUnitLifePct128K2(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0x80
  const hpShr8 = (STATLIST_GetUnitStat113c(m, u, 6, 0) | 0) >> 8
  const maxRaw = STATLIST_GetMaxLifeFromUnit113c(m, u) | 0
  const maxShr8 = (maxRaw > 0 ? maxRaw : (STATLIST_GetUnitStat113c(m, u, 7, 0) | 0)) >> 8
  if (maxShr8 <= 0 || hpShr8 >= maxShr8) return 0x80
  return sdiv32(hpShr8 << 7, maxShr8) & 0xff
}

/**
 * `@va D2Game:0x6FCFB910` (`SUNITDMG_TriggerGetHitStateAndMode`, `244B`):
 * Exact 1.13c monster GetHit recovery check (`D2Game.dll:0x6FCFB910`):
 * - Stunned (`STATE_STUNNED = 21`) enters `MONMODE_GETHIT (3)` unconditionally without rolling `pDefender->tSeed`.
 * - Otherwise compares `dwDmgTotal` against `maxHp / div` (`<` returns without GetHit), then runs two
 *   sequential threshold rolls (`< maxHp / (div >> 1)` with `SEED_RollMaskFast113c(..., 2) == 0`, followed by
 *   `< maxHp / (div >> 2)` with `SEED_RollMaskFast113c(..., 4) == 0`), matching `0x6FCFB986..0x6FCFB9D5` fallthrough.
 * - Promotes Sand Leaper knockback (`0x6FC971D0`), sets `RESULTFLAG_GETHIT (0x04)`, and starts `MONMODE_GETHIT (3)`.
 */
export function SUNITDMG_TriggerGetHitStateAndMode113c(
  m: Memory113c,
  pGame: number,
  pDefender: number,
  pDmg: number,
  hooks?: SUnitDmgHooks113c,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFB910)
  if (dllAbi) {
    const u = pGame >>> 0
    const dmg = pDefender >>> 0
    const hitType = pDmg | 0
    if (STATES_CheckState113c(m, u, 1) !== 0) return 1
    const pois = m.u32((dmg + 0x28) >>> 0) | 0
    const tot = m.u32((dmg + 0x4c) >>> 0) | 0
    if (pois !== 0 && pois === tot) return 1
    if (tot < 0x100) return 1
    const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, u) | 0
    const idx = (hitType - 1) >>> 0
    const div = idx <= 0x0b ? D2GAME_GETHIT_DIVISOR_BY_HITTYPE_113C[idx]! : 16
    if (tot < Math.trunc(maxHp / div)) return 1
    if (tot < Math.trunc(maxHp / (div >> 1))) {
      if (SEED_RollMaskFast113c(m, (u + 0x20) >>> 0, 2) === 0) return 1
    }
    if (tot < Math.trunc(maxHp / (div >> 2))) {
      if (SEED_RollMaskFast113c(m, (u + 0x20) >>> 0, 4) === 0) return 1
    }
    if (u !== 0 && m.u32(u) === 1 && MONSTATS2_CheckModeBit113c(m, m.u32((u + 4) >>> 0) | 0, 3) === 0) {
      return 1
    }
    return 0
  }
  if (pDefender === 0 || pDmg === 0) return 0
  const effHooks = hooks !== undefined ? hooks : k2DefaultSUnitDmgHooks
  if (STATES_CheckState113c(m, pDefender, 1) !== 0) return 0
  const dmgTotal = m.get(pDmg, D2DamageStrc.dwDmgTotal) | 0
  const poisDmg = m.get(pDmg, D2DamageStrc.dwPoisDamage) | 0
  if (poisDmg !== 0 && poisDmg === dmgTotal) return 0
  if (dmgTotal < 256) return 0

  const stunned =
    STATES_CheckState113c(m, pDefender, 21) !== 0 ||
    STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pDefender, 21) !== 0
  if (!stunned) {
    let maxHp = STATLIST_GetMaxLifeFromUnit113c(m, pDefender) | 0
    if (maxHp <= 0) maxHp = STATLIST_GetUnitStat113c(m, pDefender, 7, 0) | 0
    if (maxHp < 256) maxHp = 256
    const hitClassLow = m.get(pDmg, D2DamageStrc.dwHitClass) & 0xff
    let div = 16
    if (
      hitClassLow === 2 ||
      hitClassLow === 6 ||
      hitClassLow === 10 ||
      hitClassLow === 11
    ) {
      div = 8
    } else if (hitClassLow === 4 || hitClassLow === 8) {
      div = 32
    } else if (hitClassLow === 5) {
      div = 64
    }
    if (dmgTotal < Math.trunc(maxHp / div)) return 0
    if (dmgTotal < Math.trunc(maxHp / (div >> 1))) {
      if (SEED_RollMaskFast113c(m, (pDefender + D2UnitStrc.seedLo.off) >>> 0, 2) === 0) return 0
    }
    if (dmgTotal < Math.trunc(maxHp / (div >> 2))) {
      if (SEED_RollMaskFast113c(m, (pDefender + D2UnitStrc.seedLo.off) >>> 0, 4) === 0) return 0
    }
  }

  if (m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    const flags = (m.get(pDmg, D2DamageStrc.wResultFlags) | 0x0004) & 0xffff
    m.set(pDmg, D2DamageStrc.wResultFlags, flags)
    MONSTER_CheckSandLeaperMidAir113c(m, pDmg, pDefender)
    if (pGame !== 0) {
      const classId = m.get(pDefender, D2UnitStrc.dwClassId) >>> 0
      const hasGdw = safeReadU32K2(m, D2GAME_IAT_GDW_BITMASKS_VA_113C) !== 0
      const canGetHit = hasGdw
        ? MONSTATS2_CheckModeBit113c(m, classId | 0, 3) !== 0
        : (getMonsterModeBaseFrameCountPure113c(classId, 3) | 0) > 0
      if (canGetHit) {
        if (effHooks !== undefined && effHooks.onMonsterStartMode !== undefined) {
          effHooks.onMonsterStartMode(m, pGame, pDefender, 3, 0)
        } else {
          MONSTER_StartMode113c(m, pGame, pDefender, 3, 0, 0, 0)
        }
        MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pDefender, 4)
        return 1
      }
      return 0
    }
  }
  return 1
}

/**
 * `@va D2Game:0x6FCFCF20` (`SUNITDMG_ApplySideEffectsAndKill` / `SUNITDMG_ExecuteDamageResult`, `1324B`):
 * Exact 1.13c post-damage reaction, mode transition, and kill execution (`D2Game.dll:0x6FCFCF20`):
 * - Town check (`D2Common.#10057`), `+0xB0` `dwHitClass` write on `RESULTFLAG_HIT (0x01)`, and
 *   `STATE_UNINTERRUPTABLE (0x36)` -> `0x5C` GFX state flag short-circuit.
 * - `UNIT_PLAYER`:
 *   - `0x180` (`Dodge 0x80` / `Avoid 0x100`) -> `onPlayerDodgeOrAvoid` / `PLRMODE_SPECIAL1 (13)`.
 *   - `0x8010` (`WeaponBlock 0x8000` / `Block 0x10`) -> `stat 95` (`0x5F`) cooldown `> (fbr >> 3) + 15` -> `PLRMODE_BLOCK (9)`.
 *   - `0x02` (`Death`) -> `onKillUnit` / `PLRMODE_DEATH (0)`.
 *   - `0x04` / `0x4000` -> `UNITROOM_RefreshUnit` + `dwFlags |= 0x8000` (and `0x0D` S2C when not `suppressDirectS2c`).
 * - `UNIT_MONSTER`:
 *   - Dead/dying guard (`mode == 0 || mode == 12`).
 *   - Knockback (`0x08`) downgrade to `0x04` when `MONSTATS2_CheckModeBit(0x0D) == 0`.
 *   - `0x02` (`Death`) -> `onKillUnit` or `SUNITDMG_DistributeExperience113c` (`0x6FCFEEE0`) + `MONSTER_StartDeath113c` (`0x6FC96270`), returning before `0x6FCFB910`.
 *   - `0x10` (`Block`) -> `MONMODE_BLOCK (6)` when monster has `BL` mode frames.
 *   - `0x04` (`GetHit`) -> `SUNITDMG_TriggerGetHitStateAndMode113c` (`0x6FCFB910`).
 *   - `0x4000` or life-pct delta `> 4` (`stat 0x160` vs `calcUnitLifePct128K2`) -> `UNITROOM_RefreshUnit` + `dwFlags |= 0x8000`.
 */
export function SUNITDMG_ApplySideEffectsAndKill113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  pDmg: number,
  hooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FCFCF20)
  if (pDefender === 0 || pDmg === 0) return 0
  const effHooks = hooks !== undefined ? hooks : k2DefaultSUnitDmgHooks
  const suppressS2c =
    (effHooks !== undefined && effHooks.suppressDirectS2c === true) ||
    hasHydratedAnimDataTableK2(m)
  const def = pDefender >>> 0
  const att = pAttacker >>> 0
  const g = pGame >>> 0
  const dmg = pDmg >>> 0

  const pRoom = UNITS_GetRoom113c(m, def)
  if (pRoom !== 0 && checkRoomIsTownSafeK2(m, pRoom) !== 0) {
    let allowTown = 0
    if (att !== 0 && m.u32(att) === UNIT_MONSTER) {
      const pMonTxt = getMonStatsRecordPtrSafeK2(m, m.u32((att + 4) >>> 0) | 0)
      if (pMonTxt !== 0 && (m.u8((pMonTxt + 0x0d) >>> 0) & 0x01) !== 0) {
        allowTown = 1
      }
    }
    if (allowTown === 0) return 0
  }

  let flags = m.get(dmg, D2DamageStrc.wResultFlags) >>> 0
  const dmgTotal = m.get(dmg, D2DamageStrc.dwDmgTotal) | 0

  // Legacy standalone unit-test call compatibility when invoked directly with `wResultFlags == 0` & `dwDmgTotal > 0`
  if (!hasHydratedAnimDataTableK2(m) && hooks === undefined && flags === 0 && dmgTotal > 0) {
    const curHp = STATLIST_GetUnitStat113c(m, def, 6, 0) | 0
    let newHp = (curHp - dmgTotal) | 0
    if (newHp < 0x100) newHp = 0
    STATLIST_SetUnitStat113c(m, def, 6, newHp, 0)
    if (newHp <= 0) {
      SUNITDMG_SelectDeathOverlayFlag113c(m, def, dmg)
      return 1
    }
    return 0
  }

  if ((flags & 0x01) !== 0) {
    let hitClass = m.get(dmg, D2DamageStrc.dwHitClass) >>> 0
    if (m.u8((dmg + 0x64) >>> 0) === 0 && (hitClass & 0xf0) === 0) {
      // 0x6FCFCF88..0x6FCFCFA1 -> 0x6FCFA660: resolve elemental/critical overlay & default 0x0d hitClass
      if (isDeathOverlayRotorMappedK2(m)) {
        hitClass = SUNITDMG_SelectDeathOverlayFlag113c(m, hitClass | 0, dmg, true) >>> 0
      } else {
        let overlay = 0
        const startIdx = k2DeathOverlayRotor & 3
        k2DeathOverlayRotor = (k2DeathOverlayRotor + 1) & 0xff
        for (let i = 0; i < 4; i++) {
          const [dmgOff, overlayClass] = D2GAME_ELEM_DEATH_OVERLAYS_6FD1B050[(startIdx + i) & 3]!
          if ((m.u32((dmg + dmgOff) >>> 0) | 0) > 0) {
            overlay = overlayClass
            break
          }
        }
        if (overlay === 0 && (m.u8((dmg + 0x05) >>> 0) & 0x20) !== 0) {
          overlay = 0x10
        }
        const baseClass = hitClass !== 0 ? hitClass : 0x0d
        hitClass = (overlay | baseClass) >>> 0
      }
      m.set(dmg, D2DamageStrc.dwHitClass, hitClass)
    }
    m.setU32((def + 0xb0) >>> 0, hitClass)
  }

  if (STATES_CheckState113c(m, def, 0x36) !== 0) {
    if ((flags & 0x02) !== 0) {
      STATES_ToggleGfxStateFlag113c(m, def, 0x5c, 1)
    }
    return (flags & 0x02) !== 0 ? 1 : 0
  }

  const defType = m.u32(def) >>> 0
  if (defType === UNIT_PLAYER) {
    if ((flags & 0x02) !== 0) {
      if (effHooks !== undefined && effHooks.onKillUnit !== undefined) {
        effHooks.onKillUnit(m, g, def, att, 0)
      } else {
        const curMode = m.get(def, D2UnitStrc.dwAnimMode) | 0
        if (curMode !== 0 && curMode !== 0x11) {
          UNITS_ChangeAnimMode113c(m, def, 0)
          m.setU32((def + 0xc4) >>> 0, (m.u32((def + 0xc4) >>> 0) | 0x10000) >>> 0)
        }
      }
      return 1
    }
    if ((flags & 0x180) !== 0 && g !== 0) {
      if (effHooks !== undefined && effHooks.onPlayerDodgeOrAvoid !== undefined) {
        effHooks.onPlayerDodgeOrAvoid(m, g, def, att, flags)
      } else {
        PLAYER_StartModeSkill113c(m, g, def, 13, att, '1HS')
      }
      return 0
    }
    if ((flags & 0x8010) !== 0) {
      if (g !== 0) {
        const lastBlockFrame = STATLIST_GetUnitStat113c(m, def, 0x5f, 0) | 0
        const fbr = STATLIST_GetUnitStat113c(m, def, 0x66, 0) | 0
        const curFrame = m.get(g, D2GameStrc.dwGameFrame) | 0
        if (lastBlockFrame === 0 || curFrame - lastBlockFrame > ((fbr >> 3) + 15)) {
          SUNITDMG_TriggerBlockEvents113c(m, g, def, effHooks)
          STATLIST_SetUnitStat113c(m, def, 0x5f, curFrame, 0)
        }
      } else {
        SUNITDMG_TriggerBlockEvents113c(m, g, def, effHooks)
      }
      return 0
    }
    // 0x6FCFD3A6..0x6FCFD3EA: player knockback (`RESULTFLAG_KNOCKBACK = 0x08`) -> `0x6FC98430` (`PLRMODE_KNOCKBACK = 19`)
    if ((flags & 0x08) !== 0) {
      if (g !== 0) {
        hitD2GameVa113c(0x6FC98430)
        const kbTarget =
          att !== 0
            ? (SUNIT_GetServerUnit113c(
                m,
                g,
                m.u32(att) >>> 0,
                m.u32((att + 0x0c) >>> 0) >>> 0,
              ) >>> 0)
            : 0
        if (
          kbTarget !== 0 &&
          AITHINK_CanPlayerSwitchToMode113c(m, def, g, 0x13) !== 0 &&
          AITHINK_CanPlayerStartSkillOrCast113c(m, def, g, 0x13, 1, 0, () => {}) !== 0
        ) {
          const pPlrData = m.u32((def + 0x14) >>> 0) >>> 0
          if (pPlrData !== 0) {
            m.setU32((pPlrData + 0x154) >>> 0, 0)
            m.setU32((pPlrData + 0x150) >>> 0, 0)
          }
          PLAYER_ScheduleAttackActionFrameEvents113c(m, g, def, -2, 0x13, kbTarget)
        }
      }
      return 0
    }
    if ((flags & 0x04) !== 0) {
      const playerStunned =
        STATES_CheckState113c(m, def, 21) !== 0 ||
        STATLIST_GetStatListFromUnitAndStateMemPort113c(m, def, 21) !== 0
      const playerEnteredGh =
        playerStunned ||
        SUNITDMG_TriggerGetHitStateAndMode113c(m, g, def, dmg, effHooks) !== 0
      if (playerEnteredGh) {
        if (g !== 0) {
          hitD2GameVa113c(0x6FC98550)
          if (
            AITHINK_CanPlayerSwitchToMode113c(m, def, g, 4) !== 0 &&
            AITHINK_CanPlayerStartSkillOrCast113c(m, def, g, 4, 1, 0, () => {}) !== 0
          ) {
            const dmgTotal = m.get(dmg, D2DamageStrc.dwDmgTotal) | 0
            if (m.get(g, D2GameStrc.pTimer) !== 0) {
              MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c(m, g, def, 4, dmgTotal, 0)
            } else {
              m.set(def, D2UnitStrc.dwAnimMode, 4)
            }
          }
        }
        return 0
      }
    }
    if ((flags & 0x4004) !== 0) {
      if (pRoom !== 0) {
        UNITROOM_RefreshUnit113c(m, def)
      }
      const nextPlrFlags = (m.get(def, D2UnitStrc.dwFlags) | 0x8000) >>> 0
      m.set(def, D2UnitStrc.dwFlags, nextPlrFlags)
      if (effHooks !== undefined && effHooks.onUnitFlagsUpdated !== undefined) {
        effHooks.onUnitFlagsUpdated(m, def, nextPlrFlags)
      }
    }
    return 0
  }

  if (defType === UNIT_MONSTER) {
    const curMode = m.get(def, D2UnitStrc.dwAnimMode) | 0
    if (curMode === 0 || curMode === 0x0c) return 0

    if ((flags & 0x08) !== 0 && safeReadU32K2(m, D2GAME_IAT_GDW_BITMASKS_VA_113C) !== 0) {
      if (MONSTATS2_CheckModeBit113c(m, m.u32((def + 4) >>> 0) | 0, 0x0d) === 0) {
        flags = ((flags & 0xfff7) | 0x04) & 0xffff
        m.set(dmg, D2DamageStrc.wResultFlags, flags)
      }
    }

    // 0x6FCFD039: MONSTER_CheckSandLeaperMidAir runs on every monster hit before the death check
    MONSTER_CheckSandLeaperMidAir113c(m, dmg, def)
    flags = m.get(dmg, D2DamageStrc.wResultFlags) >>> 0

    if ((flags & 0x02) !== 0) {
      if (effHooks !== undefined && effHooks.onKillUnit !== undefined) {
        effHooks.onKillUnit(m, g, def, att, 1)
      } else {
        SUNITDMG_DistributeExperience113c(m, g, att, def)
        const pRealKiller = att !== 0 ? SUNITDMG_ResolveAttackerPlayer113c(m, g, att) : 0
        MONSTER_StartDeath113c(m, g, def, pRealKiller !== 0 ? pRealKiller : att)
      }
      return 1
    }

    if ((flags & 0x08) !== 0) {
      if (g !== 0) {
        if (effHooks !== undefined && effHooks.onMonsterStartMode !== undefined) {
          effHooks.onMonsterStartMode(m, g, def, 0x0d, att)
        } else {
          MONSTER_StartMode113c(m, g, def, 0x0d, att, 0, 0)
        }
      }
      return 0
    }

    if ((flags & 0x10) !== 0) {
      const classId = m.get(def, D2UnitStrc.dwClassId) >>> 0
      const hasGdw = safeReadU32K2(m, D2GAME_IAT_GDW_BITMASKS_VA_113C) !== 0
      const canBlock =
        (flags & 0x4000) === 0 &&
        classId !== 0xf3 &&
        classId !== 0x14d &&
        classId !== 0x2c1 &&
        (hasGdw
          ? MONSTATS2_CheckModeBit113c(m, classId | 0, 6) !== 0
          : (getMonsterModeBaseFrameCountPure113c(classId, 6) | 0) > 0)
      if (!canBlock) {
        MONSTER_SetLastHitModeField54_113c(m, def, 0x13)
        return 0
      }
      if (g !== 0) {
        if (effHooks !== undefined && effHooks.onMonsterStartMode !== undefined) {
          effHooks.onMonsterStartMode(m, g, def, 6, att)
        } else {
          MONSTER_StartMode113c(m, g, def, 6, att, 0, 0)
        }
      }
      return 0
    }

    let enteredGh = false
    if ((flags & 0x04) !== 0) {
      enteredGh = SUNITDMG_TriggerGetHitStateAndMode113c(m, g, def, dmg, effHooks) !== 0
      if (enteredGh && !suppressS2c && g !== 0) {
        const hitClass = m.get(dmg, D2DamageStrc.dwHitClass) & 0xff
        let pClient = m.u32((g + 0x88) >>> 0) >>> 0
        while (pClient !== 0) {
          if (m.u32((pClient + 0x04) >>> 0) === 4) {
            S2C_SendPacket0C_NpcHit113c(m, pClient, def, 0x13, hitClass)
          }
          pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
        }
      }
    }

    // 0x6FCFD115 -> 0x6FCFD14D & 0x6FCFD148 -> 0x6FCFD14D: when GetHit was requested (`0x04`) but did not trigger, or `0x4000` is set
    if (!enteredGh && (flags & 0x4004) !== 0) {
      if (pRoom !== 0) {
        UNITROOM_RefreshUnit113c(m, def)
      }
      const nextMonFlags = (m.get(def, D2UnitStrc.dwFlags) | 0x8000) >>> 0
      m.set(def, D2UnitStrc.dwFlags, nextMonFlags)
      MONSTER_SetLastHitModeField54_113c(m, def, 0x13)
      if (effHooks !== undefined && effHooks.onUnitFlagsUpdated !== undefined) {
        effHooks.onUnitFlagsUpdated(m, def, nextMonFlags)
      }
      if (g !== 0) {
        MONSTER_DispatchMinionComponentCallbacks113c(m, g, def, 4)
      }
      return 0
    }

    if (!enteredGh && (flags & 0x01) !== 0 && dmgTotal > 0) {
      const prevPct = STATLIST_GetUnitStat113c(m, def, 0x160, 0) & 0xff
      const curPct = calcUnitLifePct128K2(m, def) & 0xff
      const diff = prevPct >= curPct ? prevPct - curPct : curPct - prevPct
      if (diff > 4) {
        if (pRoom !== 0) {
          UNITROOM_RefreshUnit113c(m, def)
        }
        const nextMonFlags = (m.get(def, D2UnitStrc.dwFlags) | 0x8000) >>> 0
        m.set(def, D2UnitStrc.dwFlags, nextMonFlags)
        if (effHooks !== undefined && effHooks.onUnitFlagsUpdated !== undefined) {
          effHooks.onUnitFlagsUpdated(m, def, nextMonFlags)
        }
        if (!suppressS2c && g !== 0) {
          const hitClass = m.get(dmg, D2DamageStrc.dwHitClass) & 0xff
          let pClient = m.u32((g + 0x88) >>> 0) >>> 0
          while (pClient !== 0) {
            if (m.u32((pClient + 0x04) >>> 0) === 4) {
              S2C_SendPacket0C_NpcHit113c(
                m,
                pClient,
                def,
                m.get(def, D2UnitStrc.dwAnimMode) & 0xff,
                hitClass,
              )
            }
            pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
          }
        }
      }
    }
  }
  return 0
}

/**
 * `@va D2Game:0x6FCFE5A0` (`SUNITDMG_RollMeleeToHitAndBlock`, `291B`):
 * Exact 1.13c melee to-hit + passive avoidance/shield block resolver (`D2Game.dll:0x6FCFE5A0`):
 * checks hostility (`0x6FD00A60`), running-player auto-hit (`dwAnimMode == 3`), melee reach
 * (`D2Common.#11138` with slack `3` monster / `1` player), `SUNITDMG_CheckToHit113c` (`0x6FCFDE90`),
 * `SUNITDMG_RollDodgeAvoidEvadeBlock113c` (`0x6FCFB030` / `0x6FCFB790`), and `STATE_UNINTERRUPTABLE (0x36)` -> `0x04`.
 */
export function SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(
  m: Memory113c,
  pAttacker: number,
  pDefender: number,
  pGame: number,
  nToHitBonus = 0,
  nWeaponRangePenalty = 0,
  pDmg = 0,
): number {
  hitD2GameVa113c(0x6FCFE5A0)
  const att = pAttacker >>> 0
  const def = pDefender >>> 0
  if (att === 0 || def === 0) return 0
  const attType = m.u32(att) | 0
  if (attType !== UNIT_PLAYER && attType !== UNIT_MONSTER) return 0
  const defType = m.u32(def) | 0
  if (defType !== UNIT_PLAYER && defType !== UNIT_MONSTER) return 0
  if (isSgptDataTablesLoaded113c(m) && (SUNIT_AreUnitsHostileOrUnaligned113c(m, def, att, pGame >>> 0) | 0) === 0) {
    return 0
  }

  let wFlags = 0
  if (defType === UNIT_PLAYER && (m.get(def, D2UnitStrc.dwAnimMode) | 0) === 3) {
    wFlags = 1
  }

  let nAdder = attType === UNIT_MONSTER ? 3 : 1
  if ((nWeaponRangePenalty | 0) !== 0) {
    const wpAdder = UNITS_GetEquippedWeaponAdder113c(m, att) | 0
    nAdder = (nAdder - (wpAdder + (nWeaponRangePenalty | 0))) | 0
  }
  if ((UNITS_CanUnitMeleeAttackTarget113c(m, att, def, nAdder) | 0) === 0) {
    return 0
  }

  if ((wFlags & 1) === 0) {
    if ((SUNITDMG_CheckToHit113c(m, pGame, att, def, nToHitBonus | 0) | 0) !== 0) {
      wFlags |= 1
    }
  }

  if ((wFlags & 1) !== 0) {
    if (pDmg !== 0) {
      m.set(pDmg, D2DamageStrc.wResultFlags, wFlags & 0xffff)
      if (rollShieldBlockAndAvoidanceOnDmgK2(m, att, def, pDmg) !== 0) {
        wFlags = m.get(pDmg, D2DamageStrc.wResultFlags) & 0xffff
      }
    } else {
      const blockMask = SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(m, def, pGame, 0) | 0
      if ((blockMask & 2) !== 0) wFlags |= 0x100
      if ((blockMask & 4) !== 0) wFlags |= 0x80
      if ((blockMask & 0x10) !== 0) wFlags |= 0x8000
      if ((blockMask & 1) !== 0) wFlags |= 0x10
      if (blockMask !== 0) wFlags &= 0xfffe
    }
  }

  if ((wFlags & 0x10) !== 0) {
    wFlags &= 0xfffe
  }

  if ((wFlags & 1) !== 0) {
    if ((STATES_CheckState113c(m, def, 0x36) | 0) === 0) {
      wFlags |= 4
    }
  }
  if (pDmg !== 0) {
    m.set(pDmg, D2DamageStrc.wResultFlags, wFlags & 0xffff)
  }
  return wFlags & 0xffff
}

/**
 * Helper computing monster base XP from `MonStats.exp[diff]` scaled by `MonLvl.txt` (`getMonLvlXpRow113c`),
 * or direct `STAT_EXPERIENCE (13)` on `pDefender` when set.
 */
export function SUNITDMG_CalcMonsterExperience113c(
  m: Memory113c,
  pGame: number,
  pDefender: number,
): { exp: number; mlvl: number } {
  if (pDefender === 0) return { exp: 0, mlvl: 1 }
  const mlvl = Math.max(1, STATLIST_GetUnitStat113c(m, pDefender, 12, 0) | 0)
  const directExp = STATLIST_GetUnitStat113c(m, pDefender, 13, 0) | 0
  if (directExp > 0) return { exp: directExp, mlvl }
  const classId = m.get(pDefender, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  if (row === undefined) return { exp: 0, mlvl }
  const diff = getEffectiveDiffK2(m, pGame)
  const baseExpPct = row.exp[diff]!
  const monLvlXp = getMonLvlXpRow113c(mlvl)
  const exp = row.noRatio ? baseExpPct : Math.trunc((monLvlXp[diff]! * baseExpPct) / 100)
  return { exp, mlvl }
}

/**
 * `@va D2Game:0x6FCFEEE0` (`SUNITDMG_DistributeExperience` / `SUNITDMG_KillMonsterAndAwardExp`, `391B`):
 * Delegates kill experience distribution through `0x6FC977F0` (`MONSTER_ExecuteEventsWrapper113c`) ->
 * `0x6FCFEA00` (`SUNITDMG_TriggerPostCombatEvents113c`) -> `0x6FCFC030` (`SUNITDMG_GetTotalSkillDamageBonus113c`) ->
 * `0x6FCFAA40` (`SUNITDMG_ApplyLevelDiffExpRatio_6FCFAA40_113c`) + `0x6FCFFA60` + `0x6FCFE6D0`.
 */
export function SUNITDMG_DistributeExperience113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  bSuppressS2c: boolean | number = false,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FCFEEE0)
  if (dllAbi) {
    const game = pGame >>> 0
    const def = pAttacker >>> 0
    const att = pDefender >>> 0
    const bUpdatePetKill = Boolean(bSuppressS2c)
    const defType = def !== 0 ? (m.u32(def) | 0) : 6
    if (defType === 1) {
      if (def === 0) return 0
      const mode = m.u32((def + 0x10) >>> 0) | 0
      if (mode === 0 || mode === 0x0c) return 0
      if (MONSTATS_CheckFlagBit113c(m, m.u32((def + 4) >>> 0) | 0, 0x0f) === 0) return 0
      const leader = AIGENERAL_GetPackLeaderUnit113c(m, def) >>> 0
      if (bUpdatePetKill && leader !== 0 && m.u32(leader) === 0) {
        PETS_OnPetOrMercKilled_6FCB8120_113c(m as SparseMemory113c, game, leader, def)
      }
    } else if (defType === 0) {
      if (def === 0) return 0
      const mode = m.u32((def + 0x10) >>> 0) | 0
      if (mode === 0 || mode === 0x11) return 0
    } else {
      return 0
    }
    if (att !== 0) {
      MONSTER_ExecuteEventsWrapper113c(m, game, att, def, 0, undefined, true)
      ARENA_ProcessKillScoreUpdate113c(m, game, att, def)
      const pTablesPtr = safeReadU32K2(m, D2GAME_IAT_SGPT_DATATABLES_VA_113C)
      const pTables = pTablesPtr !== 0 ? safeReadU32K2(m, pTablesPtr) : 0
      const defCid = m.u32((def + 4) >>> 0) >>> 0
      if (pTables !== 0 && defCid < (m.u32((pTables + 0xa80) >>> 0) >>> 0) && m.u32(att) === 0) {
        DATATBLS_UnusedStub10469_113c(m, att, defCid)
      }
    }
    if ((m.u32(def) | 0) === 1) {
      const savedSp = k2RealStackPtr
      const pModeChange = savedSp >>> 0
      k2RealStackPtr = (savedSp + 0x20) >>> 0
      try {
        MONSTER_InitModeChangeStrc113c(m, def, pModeChange, 0)
        const dir =
          att !== 0
            ? UNITS_GetDirectionToCoords113c(m, def, UNIT_GetPosX113c(m, att), UNIT_GetPosY113c(m, att))
            : PATH_GetDirection113c(m, m.u32((def + 0x2c) >>> 0) >>> 0)
        m.setU32((pModeChange + 0x08) >>> 0, att)
        m.setU8((pModeChange + 0x14) >>> 0, dir & 0xff)
        MONSTER_StartMode113c(m, game, pModeChange, 1, 0, 0, 0, 0, 1, true)
      } finally {
        k2RealStackPtr = savedSp
      }
      if ((m.u32((def + 0xc4) >>> 0) >>> 31) === 0) {
        QUESTS_OnMonsterKill113c(m, game, att, def)
      }
      const cid = m.u32((def + 4) >>> 0) | 0
      if (MONSTATS2_CheckFlagBit113c(m, cid, 0x12) !== 0) {
        if (cid === 0x1b0) {
          SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c(m, def, 0x23b)
        } else if (cid === 0x1b1) {
          SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c(m, def, 0x23c)
        }
      }
    }
    return 0
  }
  if (pDefender === 0) return 0
  const defType = m.u32(pDefender >>> 0) | 0
  if (!bSuppressS2c) {
    const curMode = m.u32((pDefender + 0x10) >>> 0) | 0
    if (defType === UNIT_MONSTER) {
      if (curMode === 0 || curMode === 0x0c) return 0
      if (
        isSgptDataTablesLoaded113c(m) &&
        safeReadU32K2(m, D2GAME_IAT_GDW_BITMASKS_VA_113C) !== 0 &&
        MONSTATS_CheckFlagBit113c(m, m.u32((pDefender + 4) >>> 0) | 0, 0x0f) === 0
      ) {
        return 0
      }
    } else if (defType === UNIT_PLAYER) {
      if (curMode === 0 || curMode === 0x11) return 0
    } else {
      return 0
    }
  }
  if (defType === UNIT_MONSTER && isSgptDataTablesLoaded113c(m)) {
    const defModeNow = m.u32((pDefender + 0x10) >>> 0) | 0
    if (defModeNow !== 0 && defModeNow !== 0x0c) {
      AIGENERAL_GetPackLeaderUnit113c(m, pDefender)
    }
  }
  if (pAttacker === 0) {
    if (!bSuppressS2c && hasHydratedAnimDataTableK2(m)) {
      return SUNITDMG_DistributeExperience113c(m, pGame, pDefender, 0, 1, true)
    }
    return 0
  }
  if (isSgptDataTablesLoaded113c(m) && m.u32(pAttacker) === UNIT_PLAYER) {
    DATATBLS_UnusedStub10469_113c(m, pAttacker, m.u32((pDefender + 4) >>> 0))
  }
  if (defType === UNIT_MONSTER && m.u32((pDefender + 0x2c) >>> 0) !== 0) {
    const attPos = getUnitPosSubtileK2(m, pAttacker)
    UNITS_GetDirectionToCoords113c(m, pDefender, attPos.x, attPos.y)
  }
  return MONSTER_ExecuteEventsWrapper113c(m, pGame, pAttacker, pDefender, 0, Boolean(bSuppressS2c))
}

/**
 * `@va D2Game:0x6FCFED30` (`SUNITDMG_ExecuteEvents`, `421B`):
 * Full 1.13c combat resolution pipeline (`D2Game.dll:0x6FCFED30`):
 * 1. Resolves `pDmg` from `pDmgArg` or `pAttacker->pCombat` (`0x6FCFAA40` / `0x6FCFAA90`).
 * 2. If hit (`wResultFlags & 0x01`), mitigates via `SUNITDMG_ApplyResistancesAndAbsorb113c` (`0x6FCFC0B0`),
 *    resolves `dwHitClass` (`D2Common.#10531` `0x6FD821E0`), applies damage + states + item events (`0x6FCFE0C0`),
 *    drains weapon/armor durability (`0x6FCFEBA0`), enforces the dead-attacker guard (`0x6FCFEE67`) before
 *    `SKILLS_ItemEventThorns113c` (`0x6FCB8A70`) / `SUNITDMG_ApplyAttackerThornsToSelf113c` (`0x6FCFA890`),
 *    and executes post-damage death/gethit/refresh (`0x6FCFCF20`).
 * 3. Otherwise (block `0x8010` or dodge/avoid `0x180`), executes `SUNITDMG_ApplySideEffectsAndKill113c` (`0x6FCFCF20`).
 * 4. Unlinks the consumed `D2CombatStrc` node (`0x6FCFA6D0`) when `bUnlinkCombat != 0`.
 */
export function SUNITDMG_ExecuteEvents113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  bUnlinkCombat = 1,
  pDmgArg = 0,
  hooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FCFED30)
  if (pAttacker === 0 || pDefender === 0) return 0
  const effHooks = hooks !== undefined ? hooks : k2DefaultSUnitDmgHooks
  const hydrated = hasHydratedAnimDataTableK2(m)
  const attType = m.u32(pAttacker >>> 0) >>> 0

  let pCombatDmg = 0
  if (hydrated) {
    pCombatDmg = SUNITDMG_FindCombatDamageData113c(m, pAttacker, pDefender)
    if (pCombatDmg === 0 && pDmgArg === 0) return 0
  } else if (pDmgArg === 0) {
    pCombatDmg = SUNITDMG_GetAttackerDamageData113c(m, pAttacker, pDefender)
    if (pCombatDmg === 0) return 0
  }
  const hydratedCombat = hydrated && pCombatDmg !== 0

  const savedSpDmg = k2RealStackPtr
  let pDmg = hydratedCombat ? 0 : (pDmgArg >>> 0)
  if (pDmg === 0) {
    pDmg = savedSpDmg
    k2RealStackPtr = (savedSpDmg + D2DamageStrc_SIZE) >>> 0
    for (let off = 0; off < D2DamageStrc_SIZE; off += 4) {
      m.setU32((pDmg + off) >>> 0, m.u32((pCombatDmg + off) >>> 0))
    }
  }

  try {
    // 0x6FCFEDAF: `D2Common.#11138` (`UNITS_CanUnitMeleeAttackTarget`) melee reach gate
    if (hydratedCombat) {
      const meleeSlack = attType === UNIT_MONSTER ? 3 : 1
      if ((UNITS_CanUnitMeleeAttackTarget113c(m, pAttacker, pDefender, meleeSlack) | 0) === 0) {
        return bUnlinkCombat !== 0 ? SUNITDMG_RemoveCombatNode113c(m, pAttacker, pDefender) : 0
      }
    }

    const preFlags = m.get(pDmg, D2DamageStrc.wResultFlags) >>> 0
    if ((preFlags & 0x0001) !== 0) {
      // 0x6FCFEDC3..0x6FCFEDD8: pre-damage dead-attacker guard (`dwAnimMode == 0` on player/monster returns without unlinking)
      if (hydratedCombat && (attType === UNIT_PLAYER || attType === UNIT_MONSTER)) {
        if ((m.get(pAttacker, D2UnitStrc.dwAnimMode) | 0) === 0) {
          return 0
        }
      }

      if (!hydratedCombat) {
        SUNITDMG_ApplyResistancesAndAbsorb113c(m, pAttacker, pDefender, pDmg, pGame)
      }
      const preClampTotalDmg = m.get(pDmg, D2DamageStrc.dwDmgTotal) | 0
      effHooks?.onPreClampDamageResolved?.(m, pAttacker, pDefender, preClampTotalDmg)

      if (hydratedCombat) {
        // 0x6FCFEDF0: `mov dword ptr [esp+0x20], 0x20` (`tDmg.dwHitFlags = 0x20`)
        m.set(pDmg, D2DamageStrc.dwHitFlags, 0x20)
      } else {
        let resolvedHitClass = m.get(pDmg, D2DamageStrc.dwHitClass) >>> 0
        if (
          resolvedHitClass === 0 &&
          (attType === UNIT_PLAYER ? isSgptDataTablesLoaded113c(m) : safeReadU32K2(m, 0x6fde9e1c) !== 0)
        ) {
          resolvedHitClass = ITEMS_GetUnitHitClass113c(m, pAttacker) >>> 0
        }
        if ((resolvedHitClass & 0x0f) === 0) {
          resolvedHitClass = (resolvedHitClass | 0x0d) >>> 0
        }
        if (
          attType === UNIT_PLAYER &&
          (m.get(pDmg, D2DamageStrc.wResultFlags) & 0x2020) !== 0 &&
          (resolvedHitClass & 0xf0) === 0
        ) {
          resolvedHitClass = (resolvedHitClass | 0x10) >>> 0
        }
        m.set(pDmg, D2DamageStrc.dwHitClass, resolvedHitClass)
      }

      SUNITDMG_ApplyDamage113c(m, pGame, pAttacker, pDefender, pDmg, 0, effHooks, 1)

      if (hydratedCombat) {
        // 0x6FCFEDFD..0x6FCFEE09: `if ((int)tDmg.nOverlays > 0) D2Common.#10689(pDefender, nOverlays, 0)`
        const nOverlays = m.get(pDmg, D2DamageStrc.nOverlays) | 0
        if (nOverlays > 0) {
          STATES_SetMonsterSkillIconOnUnit113c(m, pDefender, nOverlays, 0)
        }
        // 0x6FCFEE0E..0x6FCFEE24: `if (!bHitClassActiveSet && !(dwHitClass & 0x0f)) dwHitClass |= D2Common.#10862(pAttacker)`
        if (m.u8((pDmg + 0x64) >>> 0) === 0 && (m.get(pDmg, D2DamageStrc.dwHitClass) & 0x0f) === 0) {
          const unitHc = ITEMS_GetUnitHitClass113c(m, pAttacker) >>> 0
          m.set(pDmg, D2DamageStrc.dwHitClass, (m.get(pDmg, D2DamageStrc.dwHitClass) | unitHc) >>> 0)
        }
      }

      const bMissile = (m.get(pDmg, D2DamageStrc.dwHitFlags) & 0x80) !== 0
      if (!bMissile) {
        SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c(m, pGame, pAttacker, pDefender, 0, effHooks)
      }

      if (hydratedCombat && pGame !== 0) {
        // 0x6FCFEE40..0x6FCFEE66: `ITEMEVENT` `7` on defender and `3` on attacker
        dispatchItemEventsSafeK2(m, pDefender, pGame, 7, pAttacker, pDmg)
        dispatchItemEventsSafeK2(m, pAttacker, pGame, 3, pDefender, pDmg)
      }

      // 0x6FCFEE67..0x6FCFEE8E: dead-attacker guard before `0x6FCB8A70` Thorns
      if (attType === UNIT_PLAYER || attType === UNIT_MONSTER) {
        const attMode = m.get(pAttacker, D2UnitStrc.dwAnimMode) | 0
        if (attMode === 0 || (!hydrated && attMode === 12)) {
          if (!hydrated && bUnlinkCombat !== 0) {
            SUNITDMG_RemoveCombatNode113c(m, pAttacker, pDefender)
          }
          return 1
        }
      }

      if (pGame !== 0) {
        if ((STATLIST_GetUnitStat113c(m, pDefender, 0x83, 0) | 0) > 0) {
          const savedSp = k2RealStackPtr
          const pThornsDmg = k2RealStackPtr
          k2RealStackPtr = (k2RealStackPtr + D2DamageStrc_SIZE) >>> 0
          try {
            m.fill(pThornsDmg, D2DamageStrc_SIZE, 0)
            m.set(pThornsDmg, D2DamageStrc.wResultFlags, m.get(pDmg, D2DamageStrc.wResultFlags) & 0xffff)
            m.set(pThornsDmg, D2DamageStrc.dwPhysDamage, m.get(pDmg, D2DamageStrc.dwPhysDamage) >>> 0)
            m.set(pThornsDmg, D2DamageStrc.dwAbsorbLife, preClampTotalDmg >>> 0)
            m.set(pThornsDmg, D2DamageStrc.dwDmgTotal, preClampTotalDmg >>> 0)
            SKILLS_ItemEventThorns113c(m, pGame, pDefender, pAttacker, pThornsDmg)
          } finally {
            k2RealStackPtr = savedSp
          }
        } else {
          // 0x6FCFEE8E: 1.13c calls `0x6FCB8A70` unconditionally (`STAT 0x83 <= 0` early-return inside callee)
          SUNITDMG_ApplyOpenWoundsAndCrushingBlowSideEffects113c(m, pAttacker, pGame, pDefender, pDmg)
        }
      }
      if (!bMissile && safeReadU32K2(m, (pDefender + 0x90) >>> 0) === 0) {
        SUNITDMG_ApplyAttackerThornsToSelf113c(m, pGame, pAttacker, pDefender)
      }

      SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pAttacker, pDefender, pDmg, effHooks)

      if (!hydrated && (m.get(pDmg, D2DamageStrc.wResultFlags) & 0x02) !== 0 && pAttacker !== 0) {
        const pRealKiller = SUNITDMG_ResolveAttackerPlayer113c(m, pGame, pAttacker)
        const kUnit = pRealKiller !== 0 ? pRealKiller : pAttacker
        const laek = STATLIST_GetUnitStat113c(m, kUnit, 138, 0) | 0
        if (laek > 0) SUNITDMG_AddLeechedLifeToUnit113c(m, kUnit, 6, 7, laek << 8)
        const maek = STATLIST_GetUnitStat113c(m, kUnit, 86, 0) | 0
        if (maek > 0) SUNITDMG_AddLeechedLifeToUnit113c(m, kUnit, 8, 9, maek << 8)
        if (SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x08) !== 0) {
          const demonHeal = STATLIST_GetUnitStat113c(m, kUnit, 139, 0) | 0
          if (demonHeal > 0) SUNITDMG_AddLeechedLifeToUnit113c(m, kUnit, 6, 7, demonHeal << 8)
        }
      }
    } else {
      if (hydratedCombat && pGame !== 0) {
        dispatchItemEventsSafeK2(m, pDefender, pGame, 7, pAttacker, pDmg)
        dispatchItemEventsSafeK2(m, pAttacker, pGame, 3, pDefender, pDmg)
      }
      if (hydrated || (preFlags & 0x8190) !== 0) {
        SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pAttacker, pDefender, pDmg, effHooks)
      }
    }

    if (bUnlinkCombat !== 0) {
      SUNITDMG_RemoveCombatNode113c(m, pAttacker, pDefender)
    }
    return 1
  } finally {
    k2RealStackPtr = savedSpDmg
  }
}

/**
 * `@va D2Game:0x6FCFA7B0` (`SUNITDMG_ExecuteSingleHit`):
 * One-shot melee hit helper: allocates `D2DamageStrc` on stack scratch, rolls `CheckToHit` (`0x6FCFDE90`) +
 * `FillDamageValues` (`0x6FCFD450`), links `D2CombatStrc` (`0x6FCFDDE0`), and runs `ExecuteEvents` (`0x6FCFED30`).
 */
export function SUNITDMG_ExecuteSingleHit113c(
  m: Memory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  bUseAttack2 = 0,
  srcDam = 128,
): number {
  if (pAttacker === 0 || pDefender === 0) return 0
  const savedSp = k2RealStackPtr
  const pDmg = k2RealStackPtr
  k2RealStackPtr = (k2RealStackPtr + D2DamageStrc_SIZE) >>> 0
  try {
    m.fill(pDmg, D2DamageStrc_SIZE, 0)
    const hit = SUNITDMG_CheckToHit113c(m, pAttacker, pDefender, pDmg, 0)
    if (hit !== 0) {
      if (STATES_CheckState113c(m, pDefender, 0x36) === 0) {
        m.set(pDmg, D2DamageStrc.wResultFlags, (m.get(pDmg, D2DamageStrc.wResultFlags) | 0x04) & 0xffff)
      }
      SUNITDMG_FillDamageValues113c(m, pGame, pAttacker, pDefender, pDmg, bUseAttack2, srcDam)
    } else if ((m.get(pDmg, D2DamageStrc.wResultFlags) & 0x0010) !== 0) {
      SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, pDmg, srcDam)
      return SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, 0)
    }
    SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, pDmg, srcDam)
    return SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, 0)
  } finally {
    k2RealStackPtr = savedSp
  }
}

// ============================================================================
// SECTION 2: PURE `SparseMemory113c` PORTS FOR ALL 30 `fallen-ai-113c.ts` VAs
// ============================================================================

/**
 * `@va D2Game:0x6FC40F30` (`AIGENERAL_AllocAiCommand`, `138B`):
 * Allocates a zeroed `D2AiCmdStrc` node and appends it to `pAiGeneral`'s circular
 * doubly-linked command list (`pCommandHead` `+0x20`, `pCommandTail` `+0x24`).
 */
export function AIGENERAL_AllocAiCommand113c(m: Memory113c, pMonster: number): number {
  hitD2GameVa113c(0x6FC40F30)
  if (pMonster === 0 || m.get(pMonster, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return 0
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGen === 0) return 0
  const node = m.alloc(D2AiCmdStrc_SIZE)
  for (let off = 0; off < D2AiCmdStrc_SIZE; off += 4) {
    m.setU32((node + off) >>> 0, 0)
  }
  const tail = m.get(pAiGen, D2AiGeneralStrc.pCommandTail)
  if (tail === 0) {
    m.set(pAiGen, D2AiGeneralStrc.pCommandTail, node)
    m.set(pAiGen, D2AiGeneralStrc.pCommandHead, node)
    m.set(node, D2AiCmdStrc.pNext, node)
    m.set(node, D2AiCmdStrc.pPrev, node)
  } else {
    const head = m.get(pAiGen, D2AiGeneralStrc.pCommandHead)
    if (tail === head) {
      m.set(pAiGen, D2AiGeneralStrc.pCommandTail, node)
    }
    m.set(node, D2AiCmdStrc.pNext, head)
    const prevLast = head !== 0 ? m.get(head, D2AiCmdStrc.pPrev) : 0
    m.set(node, D2AiCmdStrc.pPrev, prevLast)
    if (head !== 0) m.set(head, D2AiCmdStrc.pPrev, node)
    if (prevLast !== 0) m.set(prevLast, D2AiCmdStrc.pNext, node)
  }
  return node
}

/**
 * `@va D2Game:0x6FC41290` (`AIGENERAL_CopyAiCommandParams`, `85B`):
 * Exact DLL form: `AIGENERAL_CopyAiCommandParams113c(m, pGame, pMonster, pSrcCmd)`
 * (`eax = pGame`, `ecx = pMonster`, stack `pSrcCmd`, `ret 4`), allocating a node via `0x6FC40F30`,
 * copying 5 `uint32` parameters (`+0x08..+0x18`), and setting `pAiGeneral->pCommandHead (+0x20) = node`.
 * Also preserves `(m, pMonster, cmdType, arg1, arg2, arg3, arg4)` compatibility overload.
 */
export function AIGENERAL_CopyAiCommandParams113c(
  m: Memory113c,
  pGameOrMonster: number,
  pMonsterOrCmdType: number,
  pSrcCmdOrArg1 = 0,
  arg2?: number,
  arg3?: number,
  arg4?: number,
): number {
  hitD2GameVa113c(0x6FC41290)
  const isDllForm = arg2 === undefined && arg3 === undefined && arg4 === undefined
  const pMonster = isDllForm ? (pMonsterOrCmdType >>> 0) : (pGameOrMonster >>> 0)
  const node = AIGENERAL_AllocAiCommand113c(m, pMonster)
  if (node === 0) return 0
  if (isDllForm) {
    const pSrcCmd = pSrcCmdOrArg1 >>> 0
    for (let off = 0x08; off <= 0x18; off += 4) {
      m.setU32((node + off) >>> 0, m.u32((pSrcCmd + off) >>> 0) >>> 0)
    }
  } else {
    m.set(node, D2AiCmdStrc.dwCmdType, pMonsterOrCmdType >>> 0)
    m.set(node, D2AiCmdStrc.dwParam1, pSrcCmdOrArg1 >>> 0)
    m.set(node, D2AiCmdStrc.dwParam2, (arg2 !== undefined ? arg2 : 0) >>> 0)
    m.set(node, D2AiCmdStrc.dwParam3, (arg3 !== undefined ? arg3 : 0) >>> 0)
    m.set(node, D2AiCmdStrc.dwParam4, (arg4 !== undefined ? arg4 : 0) >>> 0)
  }
  if (pMonster !== 0 && m.get(pMonster, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    if (pMonData !== 0) {
      const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
      if (pAiGen !== 0) {
        m.set(pAiGen, D2AiGeneralStrc.pCommandHead, node)
      }
    }
  }
  return node
}

export const AIGENERAL_InitAiCommand113c = AIGENERAL_CopyAiCommandParams113c

/**
 * `@va D2Game:0x6FC40EC0` (`AIGENERAL_PopAiCommand`, `107B`):
 * Pops and frees (`m.free`) the current head `D2AiCmdStrc` node at `pAiGeneral->pCommandHead (+0x20)`.
 */
export function AIGENERAL_PopAiCommand113c(m: Memory113c, pMonster: number): void {
  hitD2GameVa113c(0x6FC40EC0)
  if (pMonster === 0 || m.get(pMonster, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGen === 0) return
  const head = m.get(pAiGen, D2AiGeneralStrc.pCommandHead)
  if (head === 0) return
  const next = m.get(head, D2AiCmdStrc.pNext)
  if (head === next) {
    m.set(pAiGen, D2AiGeneralStrc.pCommandTail, 0)
    m.set(pAiGen, D2AiGeneralStrc.pCommandHead, 0)
  } else {
    if (m.get(pAiGen, D2AiGeneralStrc.pCommandTail) === head) {
      m.set(pAiGen, D2AiGeneralStrc.pCommandTail, next)
    }
    const nextHead = m.get(head, D2AiCmdStrc.pNext)
    m.set(pAiGen, D2AiGeneralStrc.pCommandHead, nextHead)
    const prev = m.get(head, D2AiCmdStrc.pPrev)
    m.set(prev, D2AiCmdStrc.pNext, m.get(head, D2AiCmdStrc.pNext))
    const nextNode = m.get(head, D2AiCmdStrc.pNext)
    m.set(nextNode, D2AiCmdStrc.pPrev, m.get(head, D2AiCmdStrc.pPrev))
  }
  freeMemNodeK2(m, head)
}

function getEquippedWeaponK2(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0
  const bridge = KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C.get(m)
  if (bridge !== undefined && bridge.getEquippedWeapon !== undefined) {
    return bridge.getEquippedWeapon(pUnit)
  }
  const pInv = m.get(pUnit, D2UnitStrc.pInventory)
  if (pInv === 0) return 0

  const isNotBrokenOrUneq = (pItem: number): boolean => {
    if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return false
    const pItemData = safeReadU32K2(m, (pItem + 0x14) >>> 0)
    if (pItemData !== 0) {
      const iFlags = safeReadU32K2(m, (pItemData + 0x18) >>> 0)
      if ((iFlags & 0x4100) !== 0) return false
    }
    return true
  }
  const isUsableWeapon = (pItem: number): boolean =>
    isNotBrokenOrUneq(pItem) && checkItemTypePureOrMemK2(m, pItem, 45) !== 0

  const hasMemGrid =
    isSgptDataTablesLoaded113c(m) &&
    safeReadU32K2(m, 0x6fdd90b0) !== 0 &&
    safeReadU32K2(m, 0x6fded278) !== 0 &&
    safeReadU32K2(m, pInv) === 0x01020304

  let pDefault = 0
  if (hasMemGrid) {
    const savedSp = k2RealStackPtr
    const pOutWpn = k2RealStackPtr
    const pOutLoc = (k2RealStackPtr + 4) >>> 0
    const pOutAct = (k2RealStackPtr + 8) >>> 0
    k2RealStackPtr = (k2RealStackPtr + 16) >>> 0
    try {
      m.setU32(pOutWpn, 0)
      m.setU32(pOutLoc, 0)
      m.setU32(pOutAct, 0)
      if (INVENTORY_GetActiveWeaponMemPort113c(m, pInv, pOutWpn, pOutLoc, pOutAct) !== 0) {
        pDefault = m.u32(pOutWpn) >>> 0
      }
    } finally {
      k2RealStackPtr = savedSp
    }
  } else {
    const pR = findItemInInventoryByBodyLocK2(m, pInv, 4)
    const pL = findItemInInventoryByBodyLocK2(m, pInv, 5)
    if (isUsableWeapon(pR)) pDefault = pR
    else if (isUsableWeapon(pL)) pDefault = pL
  }

  const canDual =
    m.u32(pUnit) === UNIT_PLAYER
      ? (m.get(pUnit, D2UnitStrc.dwClassId) === 4 || m.get(pUnit, D2UnitStrc.dwClassId) === 6)
      : unitsCanDualWieldMem113c(m, pUnit) !== 0
  if (!canDual) return pDefault

  const pUsedSkill = hasMemGrid
    ? (SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0)
    : (() => {
        const pSl = safeReadU32K2(m, (pUnit + 0xa8) >>> 0)
        return pSl !== 0 ? safeReadU32K2(m, (pSl + 0x0c) >>> 0) : 0
      })()
  if (pUsedSkill === 0) return pDefault
  const pSkillsTxt = safeReadU32K2(m, pUsedSkill)
  if (pSkillsTxt === 0) return pDefault

  const getHandSlotWeapon = (slotCode: 5 | 6): number => {
    if (hasMemGrid) {
      return INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, slotCode) >>> 0
    }
    const pRight = findItemInInventoryByBodyLocK2(m, pInv, 4)
    const pLeft = findItemInInventoryByBodyLocK2(m, pInv, 5)
    const wpnId = safeReadU32K2(m, (pInv + 0x1c) >>> 0) | 0
    let pComp = 0
    if (wpnId !== -1) {
      if (pLeft !== 0 && isUsableWeapon(pLeft) && (m.get(pLeft, D2UnitStrc.dwUnitId) | 0) === wpnId) {
        pComp = pLeft
      } else if (pRight !== 0 && isUsableWeapon(pRight) && (m.get(pRight, D2UnitStrc.dwUnitId) | 0) === wpnId) {
        pComp = pRight
      }
    }
    let first = pRight
    let second = pLeft
    if (slotCode === 5) {
      if (pLeft !== 0 && pLeft === pComp) {
        first = pLeft
        second = pRight
      }
    } else if (pRight !== 0 && pRight === pComp) {
      first = pLeft
      second = pRight
    }
    if (isUsableWeapon(first)) return first
    if (isUsableWeapon(second)) return second
    return 0
  }

  const weapSel = m.u8((pSkillsTxt + 0x168) >>> 0)
  let pChosen = 0
  if (weapSel === 1) {
    pChosen = getHandSlotWeapon(6)
  } else if (weapSel === 2) {
    const useRight = (m.u32((pUsedSkill + 0x0c) >>> 0) & 0x2000) !== 0
    const pLeft = getHandSlotWeapon(5)
    const pRight = getHandSlotWeapon(6)
    if (pLeft === 0 || checkItemTypePureOrMemK2(m, pLeft, 45) === 0) {
      pChosen = pRight
    } else if (pRight === 0 || checkItemTypePureOrMemK2(m, pRight, 45) === 0) {
      pChosen = pLeft
    } else {
      pChosen = useRight ? pRight : pLeft
    }
  } else if (weapSel === 3) {
    const frameIdx = (m.u32((pUnit + 0x38) >>> 0) | 0) >> 8
    pChosen = getHandSlotWeapon((frameIdx & 1) !== 0 ? 6 : 5)
  } else if (weapSel === 4) {
    pDefault = 0
    pChosen = 0
  } else {
    pChosen = getHandSlotWeapon(5)
    if (pChosen === 0 || checkItemTypePureOrMemK2(m, pChosen, 45) === 0) {
      pChosen = getHandSlotWeapon(6)
    }
  }

  if (isUsableWeapon(pChosen)) return pChosen
  return pDefault
}

/**
 * `@va D2Game:0x6FCD08F0` (`UNITS_GetDistanceToCoordinates`, `140B`):
 * Exact 1.13c integer octagonal distance approximation `((2 * max + min) >> 1)` (accepts either
 * `(x1, y1, x2, y2)` or `(m, pUnit, x2, y2)`).
 */
export function UNITS_GetDistanceToCoordinates113c(
  arg0: Memory113c | number,
  arg1: number,
  arg2: number,
  arg3: number,
): number {
  hitD2GameVa113c(0x6FCD08F0)
  let x1: number
  let y1: number
  const x2 = arg2 | 0
  const y2 = arg3 | 0
  if (typeof arg0 === 'object' && arg0 !== null) {
    const c = getUnitCoordsK2(arg0, arg1)
    x1 = c.x | 0
    y1 = c.y | 0
  } else {
    x1 = arg0 | 0
    y1 = arg1 | 0
  }
  const dx = Math.abs((x1 - x2) | 0)
  const dy = Math.abs((y1 - y2) | 0)
  const hi = dx >= dy ? dx : dy
  const lo = dx >= dy ? dy : dx
  return ((hi * 2 + lo) >> 1) | 0
}

/**
 * `@va D2Common:0x6FD8AFD0` (`D2Common.#10873` `ROOM_RecordMonsterDeath`):
 * Records `dwUnitId` in `pRoom->dwDeathRing[bDeathRingIdx]` (`+0x38..+0x44`) and advances
 * `bDeathRingIdx (+0x14) = (idx + 1) & 3`.
 */
export function ROOM_RecordMonsterDeath113c(m: Memory113c, pRoom: number, unitOrId: number): void {
  hitD2CommonVa113c(0x6FD8AFD0)
  if (pRoom === 0) return
  const resolvedId =
    unitOrId >= 0x10000 && safeReadU32K2(m, unitOrId) === UNIT_MONSTER
      ? (m.get(unitOrId, D2UnitStrc.dwUnitId) >>> 0)
      : (unitOrId >>> 0)
  const idx = m.get(pRoom, D2ActiveRoomStrc.bDeathRingIdx) & 3
  m.set(pRoom, D2ActiveRoomStrc.dwDeathRing, resolvedId, idx)
  m.set(pRoom, D2ActiveRoomStrc.bDeathRingIdx, (idx + 1) & 3)
}

/**
 * `@va D2Game:0x6FC40D50` (`AIGENERAL_GetOwnerData`, `58B`):
 * Exact 1.13c port (`eax = pUnit`, `edx = pOutOwnerId`, `[esp+4] = pOutOwnerType`):
 * If `pUnit != 0 && dwUnitType == UNIT_MONSTER (1)` and `pMonData->pAiGeneral->pOwner (+0x28) != 0`,
 * writes `dwOwnerId (+0x2C)` to `*pOutOwnerId` and `dwOwnerType (+0x30)` to `*pOutOwnerType`;
 * otherwise writes `0xFFFFFFFF` (`-1`) to `*pOutOwnerId`.
 */
export function AIGENERAL_GetOwnerData_6FC40D50_113c(
  m: Memory113c,
  pUnit: number,
  pOutOwnerId: number,
  pOutOwnerType: number,
): void {
  hitD2GameVa113c(0x6FC40D50)
  const unit = pUnit >>> 0
  if (unit !== 0 && (m.u32(unit) | 0) === UNIT_MONSTER) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
    if (pAiGen !== 0 && m.u32((pAiGen + 0x28) >>> 0) !== 0) {
      if (pOutOwnerId !== 0) {
        m.setU32(pOutOwnerId >>> 0, m.u32((pAiGen + 0x2c) >>> 0) >>> 0)
      }
      if (pOutOwnerType !== 0) {
        m.setU32(pOutOwnerType >>> 0, m.u32((pAiGen + 0x30) >>> 0) >>> 0)
      }
      return
    }
  }
  if (pOutOwnerId !== 0) {
    m.setU32(pOutOwnerId >>> 0, 0xffffffff)
  }
}

/**
 * Promotes the head living minion in `minionIdsByLeaderId` when a pack leader dies and updates
 * `D2AiGeneralStrc.dwLeaderId (+0x2C)` across the dying leader and all pack members.
 */
export function promotePackLeaderOnDeath113c(
  world: MonsterSliceWorldLike113c,
  pMonster: number,
): void {
  const { m } = world
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
  if (pAiGen === 0) return
  const pGroup = m.get(pAiGen, D2AiGeneralStrc.pGroup)
  if (pGroup === 0) return
  const selfId = m.get(pMonster, D2UnitStrc.dwUnitId)
  const leaderId = m.get(pAiGen, D2AiGeneralStrc.dwLeaderId)
  const leaderType = m.get(pAiGen, D2AiGeneralStrc.dwLeaderType)
  if (leaderType !== 1 || leaderId !== selfId) return

  if (m.u32((pAiGen + 0x34) >>> 0) !== 0) {
    AIGENERAL_ReassignPackOnBossDeath113c(m, pAiGen, pMonster)
  }

  const minions = world.minionIdsByLeaderId.get(selfId)
  if (minions === undefined || minions.length === 0) return

  let newLeaderId = 0
  let newLeaderIdx = -1
  for (let i = 0; i < minions.length; i++) {
    const candId = minions[i]!
    const pCand = world.monsterById.get(candId)
    if (pCand !== undefined && SUNIT_IsDeadOrDying113c(m, pCand) === 0) {
      newLeaderId = candId
      newLeaderIdx = i
      break
    }
  }
  if (newLeaderIdx < 0) return

  const remaining = minions.filter((_, idx) => idx !== newLeaderIdx)
  world.minionIdsByLeaderId.delete(selfId)
  world.minionIdsByLeaderId.set(newLeaderId, remaining)

  m.set(pAiGen, D2AiGeneralStrc.dwLeaderId, newLeaderId >>> 0)
  for (const memberId of [newLeaderId, ...remaining]) {
    const pMember = world.monsterById.get(memberId)
    if (pMember === undefined) continue
    const pMemData = m.get(pMember, D2UnitStrc.pUnitData)
    if (pMemData === 0) continue
    const pMemAi = m.get(pMemData, D2MonsterDataStrc.pAiGeneral)
    if (pMemAi !== 0) {
      m.set(pMemAi, D2AiGeneralStrc.dwLeaderId, newLeaderId >>> 0)
    }
  }
}

/**
 * `@va D2Game:0x6FC95260` (`MONSTER_SavePrevMode`, `63B`):
 * Records `prevMode` into `pMonData->dwAlwaysChaseField (+0x54)` (`0x6FC95271..0x6FC9529A`).
 */
export function MONSTER_SavePrevMode113c(
  m: Memory113c,
  pMonster: number,
  prevMode: number,
): void {
  hitD2GameVa113c(0x6FC95260)
  if (pMonster === 0) return
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  if (pMonData === 0) return
  const cur54 = m.get(pMonData, D2MonsterDataStrc.dwAlwaysChaseField) >>> 0
  let next54: number
  if (cur54 >= 16) {
    next54 = (cur54 - 16) >>> 0
  } else if (cur54 === 13 && prevMode === 3) {
    next54 = cur54
  } else {
    next54 = prevMode >>> 0
  }
  m.set(pMonData, D2MonsterDataStrc.dwAlwaysChaseField, next54)
}

function computeMonsterMoveVelocityK2(m: Memory113c, pMonster: number, mode: number): number {
  const hcIdx = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const monRow = getMonStatsRowByClassId113c(hcIdx)
  let baseSpd = 4
  if (monRow) {
    baseSpd = mode === 15 ? monRow.run : monRow.velocity
  }
  const velPct = STATLIST_GetUnitStat113c(m, pMonster, 67, 0) | 0
  const scaled = Math.trunc((((baseSpd << 8) * (100 + velPct)) | 0) / 100)
  return scaled < 64 ? 64 : scaled
}

function setMonsterAttackStatsForModeK2(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  mode: number,
  row: MonStatsRow113c,
): void {
  if (pGame === 0 || pMonster === 0 || !hasHydratedAnimDataTableK2(m)) return
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) | 0
  const nDiff = getEffectiveDiffK2(m, pGame)
  const dwExpansion = m.u32((pGame + 0x70) >>> 0)
  const bExpansion =
    m.u8((pGame + 0x6a) >>> 0) !== 0 || m.u32((pGame + 0x74) >>> 0) !== 0 || dwExpansion !== 0
      ? 1
      : 0
  const mlvl = STATLIST_GetUnitStat113c(m, pMonster, 12, 0) | 0
  const pCalcBlock = MON_STAT_CALC_SCRATCH_VA_K2
  m.fill(pCalcBlock, 0x38, 0)
  let flags = 0x08
  let minOff = 0x14
  let maxOff = 0x18
  if (mode === 5) {
    flags = 0x10
    minOff = 0x1c
    maxOff = 0x20
  } else if (mode === 7 || mode === 8) {
    flags = 0x20
    minOff = 0x24
    maxOff = 0x28
  }
  DATATBLS_CalculateMonsterStatsByLevel113c(m, classId, bExpansion, nDiff, mlvl, flags, pCalcBlock)
  let minD = m.u32((pCalcBlock + minOff) >>> 0) | 0
  let maxD = m.u32((pCalcBlock + maxOff) >>> 0) | 0
  let toHit = m.u32((pCalcBlock + 0x0c) >>> 0) | 0

  if (dwExpansion === 0 && nDiff > 0 && !row.noRatio) {
    minD = Math.trunc((minD * 10) / 6) | 0
    maxD = Math.trunc((maxD * 10) / 6) | 0
    toHit = Math.trunc((toHit * 10) / 9) | 0
  }
  STATLIST_SetUnitStat113c(m, pMonster, 21, minD, 0)
  STATLIST_SetUnitStat113c(m, pMonster, 22, maxD, 0)
  STATLIST_SetUnitStat113c(m, pMonster, 19, toHit, 0)
}

/**
 * `@va D2Game:0x6FC94F90` (`MONSTER_StartMove`, `170B`):
 * Computes path (`PATH_Compute113c`), velocity (`PATH_SetVelocity113c`), `D2AiControlStrc` overrides,
 * and `D2GameStrc.dwMonSpawnCount` / `dwMonSpawnTotal` updates.
 */
export function MONSTER_StartMove113c<T extends MonsterSliceWorldLike113c | Memory113c>(
  arg0: T,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4 = 0,
  arg5 = 0,
  arg6: number | boolean = 0,
  arg7?: MonStatsRow113c,
  dllAbi = false,
): T extends MonsterSliceWorldLike113c ? { ok: number; moveAnimSpeed: number; abortedMoving: boolean } : number {
  hitD2GameVa113c(0x6FC94F90)
  if (dllAbi && !isMonsterSliceWorldK2(arg0)) {
    const m = arg0 as Memory113c
    const pGame = arg1 >>> 0
    const pMonster = arg2 >>> 0
    const pAiCtrl = arg3 >>> 0
    let pathType = arg4 | 0
    let velArg = arg5 | 0
    let distByte = Number(arg6) & 0xff
    if (pAiCtrl !== 0) {
      const ptOv = m.u32((pAiCtrl + 0x18) >>> 0) | 0
      if (ptOv !== 0) pathType = ptOv
      const velOv = m.u32((pAiCtrl + 0x1c) >>> 0) | 0
      if (velOv !== 0) velArg = velOv
      const distOv = m.u8((pAiCtrl + 0x20) >>> 0)
      if (distOv !== 0) distByte = distOv
      m.setU32((pAiCtrl + 0x18) >>> 0, 0)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0)
      m.setU8((pAiCtrl + 0x20) >>> 0, 0)
    }
    const pPath = m.u32((pMonster + 0x2c) >>> 0) >>> 0
    let resDist = -1
    let resType = 0
    if (pathType === 0x64) {
      velArg = 0
      resType = 0
    } else {
      const effDist = distByte !== 0 ? distByte : 5
      const effType = pathType === 0x65 ? 0x0d : pathType
      resType = PLAYER_RecalcTargetUnitPath113c(m, effDist, pAiCtrl, pMonster, effType) | 0
      if (resType !== 1 && pPath !== 0 && (PATH_GetTargetUnit113c(m, pPath) >>> 0) !== 0) {
        resDist = 10
      }
    }
    if (pAiCtrl !== 0) {
      m.setU32((pAiCtrl + 0x10) >>> 0, velArg >>> 0)
      m.setU32((pAiCtrl + 0x14) >>> 0, resDist >>> 0)
    }
    const cntAddr = (pGame + 0x1d70 + (resType << 2)) >>> 0
    m.setU32(cntAddr, (m.u32(cntAddr) + 1) >>> 0)
    if (resType !== 0) {
      m.setU32((pGame + 0x1db4) >>> 0, (m.u32((pGame + 0x1db4) >>> 0) + 1) >>> 0)
    }
    return 0 as never
  }
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const mode = arg2
    const pTarget = arg3
    const targetX = arg4
    const targetY = arg5
    const isMoving = Boolean(arg6)
    const row = arg7 !== undefined ? arg7 : getMonStatsRowStrictK2(world.m, pMonster)
    const { m, pGame } = world
    const syncRoomFlags = world.hasFullDrlg !== undefined
    const pu = world.pathUnitByPtr.get(pMonster)
    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
    let moveAnimSpeed = 256

    if (pTarget !== 0) {
      PATH_SetTargetUnit113c(m, pPath, pTarget)
    } else {
      PATH_SetTargetPos113c(m, pPath, targetX, targetY)
    }
    PATH_SetStepDistance113c(m, pPath, 20)

    let ptOv = pendingBridgePathTypeOverrideK2
    pendingBridgePathTypeOverrideK2 = 0
    if (
      ptOv === 0 &&
      inSiegeMinionThinkC0x64K2 &&
      pTarget === 0 &&
      (targetX !== 0 || targetY !== 0)
    ) {
      ptOv = 0x64
    }
    let velOverride = 0
    let ovDist = 0
    if (pAiCtrl !== 0) {
      const ctrlPtOv = m.get(pAiCtrl, D2AiControlStrc.dwPathTypeOverride) | 0
      if (ctrlPtOv !== 0) ptOv = ctrlPtOv
      velOverride = m.get(pAiCtrl, D2AiControlStrc.dwVelocityOverride) | 0
      ovDist = m.get(pAiCtrl, D2AiControlStrc.bNewDistOverride) & 0xff
      m.set(pAiCtrl, D2AiControlStrc.dwPathTypeOverride, 0)
      m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 0)
      m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, 0)
    }

    const rawPathType = ptOv !== 0 ? ptOv : isMoving ? 0x65 : 0x64
    if (rawPathType !== 0x64) {
      const pathType = rawPathType === 0x65 ? PATHTYPE_TOWARD_FINISH_K2 : rawPathType
      const newDist = ovDist !== 0 ? ovDist : 5

      const statVelPct = STATLIST_GetUnitStat113c(m, pMonster, 67, 0) | 0
      const frwStat = STATLIST_GetUnitStat113c(m, pMonster, 96, 0) | 0
      let totalPct =
        (statVelPct !== 0 ? statVelPct : 100) + computeFrwDiminishingPure113c(frwStat) + velOverride
      if (totalPct < 25) totalPct = 25

      const baseVel = syncRoomFlags ? row.velocity : mode === 15 ? row.run : row.velocity
      const scaledVel = syncRoomFlags
        ? resolveMonsterScaledVelocityK2(m, pMonster, mode, baseVel, totalPct)
        : (Math.trunc(((baseVel << 8) * totalPct) / 100) | 0)

      const baseAnimSpeed = mode === 15 ? row.runAnimSpeed : row.walkAnimSpeed
      const rawAnimSpeed = Math.trunc((baseAnimSpeed * totalPct) / 100) | 0
      moveAnimSpeed = rawAnimSpeed <= 0 ? 0 : rawAnimSpeed >= 0x7fff ? 0x7fff : rawAnimSpeed

      let ok = 0
      let moveStatus = pathType
      if (pAiCtrl !== 0) {
        moveStatus = PLAYER_RecalcTargetUnitPath113c(m, newDist, pAiCtrl, pMonster, pathType)
        ok = PATH_GetNumberOfPathPoints113c(m, pPath) !== 0 ? 1 : 0
        if (pu !== undefined) pu.dwFlags = m.get(pMonster, D2UnitStrc.dwFlags)
      } else {
        PATH_SetNewDistance113c(m, pPath, newDist)
        PATH_SetType113c(m, pPath, pathType)
        ok = PATH_Compute113c(m, pPath, pMonster, 0)
        if (ok !== 0) {
          const nextUFlags = (m.get(pMonster, D2UnitStrc.dwFlags) | 1) >>> 0
          m.set(pMonster, D2UnitStrc.dwFlags, nextUFlags)
          if (pu !== undefined) pu.dwFlags = nextUFlags
        } else if (
          pathType === 2 ||
          pathType === 7 ||
          pathType === 9 ||
          pathType === PATHTYPE_TOWARD_FINISH_K2
        ) {
          const nextUFlags = (m.get(pMonster, D2UnitStrc.dwFlags) | 1) >>> 0
          m.set(pMonster, D2UnitStrc.dwFlags, nextUFlags)
          if (pu !== undefined) pu.dwFlags = nextUFlags
          PATH_SetType113c(m, pPath, PATHTYPE_WALL_FOLLOW_K2)
          ok = PATH_Compute113c(m, pPath, pMonster, 0)
          moveStatus = PATHTYPE_WALL_FOLLOW_K2
        }
      }

      if (ok !== 0 && isMoving && mode !== 0x0d && mode !== 0x0e) {
        PATH_SetVelocity113c(m, pPath, scaledVel > 0 ? scaledVel : 0)
      }

      if (pAiCtrl !== 0) {
        m.setU32((pAiCtrl + 0x10) >>> 0, velOverride >>> 0)
        m.setU32(
          (pAiCtrl + 0x14) >>> 0,
          moveStatus !== 1 && m.get(pPath, D2DynamicPathStrc.pTargetUnit) !== 0 ? 0x0a : 0xffffffff,
        )
      }

      if (pGame !== 0 && moveStatus >= 0 && moveStatus < 17) {
        m.set(
          pGame,
          D2GameStrc.dwMonSpawnCount,
          (m.get(pGame, D2GameStrc.dwMonSpawnCount, moveStatus) + 1) >>> 0,
          moveStatus,
        )
        if (moveStatus !== 0) {
          m.set(
            pGame,
            D2GameStrc.dwMonSpawnTotal,
            (m.get(pGame, D2GameStrc.dwMonSpawnTotal) + 1) >>> 0,
          )
        }
      }

      if (isMoving && mode !== 0x0d && mode !== 0x0e && ok === 0) {
        const animHydratedMoveFail = hasHydratedAnimDataTableK2(m)
        if (animHydratedMoveFail) {
          const hadFlag1List = STATLIST_GetStatListFromUnitAndFlag113c(m, pMonster, 1) !== 0
          MONSTER_ApplyElementalDamageAndResistStats113c(m, pGame, pMonster, mode)
          if (!hadFlag1List && !isHireableMonsterK2(m, pMonster)) {
            setMonsterAttackStatsForModeK2(m, pGame, pMonster, mode, row)
          }
        } else if (!isHireableMonsterK2(m, pMonster)) {
          setMonsterAttackStatsForModeK2(m, pGame, pMonster, mode, row)
        }
        MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 0)
        SKILLS_SetUsedSkill113c(m, pMonster, 0)
        if (mode !== 0 && mode !== 12 && SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) {
          return { ok: 1, moveAnimSpeed, abortedMoving: true } as never
        }
        MONSTER_ClearModeEvents113c(m, pGame, pMonster)
        const failPrevMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
        if (syncRoomFlags && failPrevMode !== 1) {
          UNITROOM_RefreshUnit113c(m, pMonster)
        }
        const flagBits =
          syncRoomFlags && failPrevMode !== 1
            ? (UNITFLAG_MODE_CHANGED_TICK_K2 | 0x01)
            : UNITFLAG_MODE_CHANGED_TICK_K2
        const failFlags = (m.get(pMonster, D2UnitStrc.dwFlags) | flagBits) >>> 0
        m.set(pMonster, D2UnitStrc.dwFlags, failFlags)
        m.set(pMonster, D2UnitStrc.dwAnimMode, 1)
        expireHireableModeStateListsK2(m, pMonster, failPrevMode, 1)
        if (pu !== undefined) {
          pu.dwAnimMode = 1
          pu.dwFlags = failFlags
        }
        const nuFrames = getMonsterModeBaseFrameCountPure113c(row.hcIdx, 1)
        writeUnitAnimStateK2(m, pMonster, 0, 0, nuFrames << 8, 256, 0)
        if (pAiCtrl !== 0) {
          MONSTER_ApplyModeVelocityOverride113c(m, pAiCtrl, pMonster)
        }
        MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 1)
        if (pGame !== 0) {
          const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
          const nextThink = EVENT_GetNextEventFrame113c(m, pMonster, MON_EVENT_AI_THINK) | 0
          if (nextThink <= (frame | 0)) {
            if (STATES_CheckState113c(m, pMonster, 21) !== 0) {
              EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_AI_THINK, (frame + 45) >>> 0, 0, 0, 0)
            } else {
              const bExp =
                m.u8((pGame + 0x6a) >>> 0) !== 0 ||
                m.u32((pGame + 0x74) >>> 0) !== 0 ||
                m.get(pGame, D2GameStrc.bExpansion) !== 0
              const diff: 0 | 1 | 2 = bExp ? getEffectiveDiffK2(m, pGame) : 0
              const rawAidel = row.aidel[diff]
              const aidel = rawAidel > 0 ? rawAidel : 15
              EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_AI_THINK, (frame + aidel) >>> 0, 0, 0, 0)
            }
          }
        }
        return { ok: 0, moveAnimSpeed, abortedMoving: true } as never
      }
    } else {
      if (pAiCtrl !== 0) {
        m.setU32((pAiCtrl + 0x10) >>> 0, 0)
        m.setU32((pAiCtrl + 0x14) >>> 0, 0xffffffff)
      }
      if (pGame !== 0) {
        m.set(
          pGame,
          D2GameStrc.dwMonSpawnCount,
          (m.get(pGame, D2GameStrc.dwMonSpawnCount, 0) + 1) >>> 0,
          0,
        )
      }
    }
    return { ok: 1, moveAnimSpeed, abortedMoving: false } as never
  }

  const m = arg0 as Memory113c
  const pGame = arg1
  const pMonster = arg2
  const mode = arg3
  const pTargetUnit = arg4
  const targetX = arg5
  const targetY = Number(arg6) | 0
  if (pGame === 0 || pMonster === 0) return 0 as never
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  if (pPath === 0) return 0 as never

  ensureD2CommonPathGlobals113c(m)
  m.set(pPath, D2DynamicPathStrc.pUnit, pMonster)
  if (m.get(pPath, D2DynamicPathStrc.dwUnitSize) === 0) {
    m.set(pPath, D2DynamicPathStrc.dwUnitSize, 2)
    m.set(pPath, D2DynamicPathStrc.dwCollisionPattern, 1)
  }
  if (m.get(pPath, D2DynamicPathStrc.nFootprintCollisionMask) === 0) {
    m.set(pPath, D2DynamicPathStrc.nFootprintCollisionMask, 0x100)
  }
  if (m.get(pPath, D2DynamicPathStrc.nMoveTestCollisionMask) === 0) {
    m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, 0x3c01)
  }
  if (m.get(pPath, D2DynamicPathStrc.nDistMax) === 0) {
    m.set(pPath, D2DynamicPathStrc.nDistMax, 14)
  }
  const curPathType = m.get(pPath, D2DynamicPathStrc.dwPathType) | 0
  if (curPathType === 0 || curPathType === 4) {
    PATH_SetType113c(m, pPath, 2)
  }

  if (pTargetUnit !== 0) {
    PATH_SetTargetUnit113c(m, pPath, pTargetUnit)
  } else {
    PATH_SetTargetUnit113c(m, pPath, 0)
    PATH_SetTargetPos113c(m, pPath, targetX & 0xffff, targetY & 0xffff)
  }

  const vel = computeMonsterMoveVelocityK2(m, pMonster, mode)
  PATH_SetVelocity113c(m, pPath, vel)
  const pRoom = m.get(pPath, D2DynamicPathStrc.pRoom)
  const pRoomEx = pRoom !== 0 ? safeReadU32K2(m, (pRoom + 0x10) >>> 0) : 0
  const hasRoomGrid =
    pRoom !== 0 &&
    (safeReadU32K2(m, (pRoom + 0x20) >>> 0) !== 0 ||
      (pRoomEx !== 0 && safeReadU32K2(m, (pRoomEx + 0x6c) >>> 0) !== 0))
  let steps = 1
  if (hasRoomGrid) {
    steps = PATH_Compute113c(m, pPath, pMonster, 0) | 0
    if (steps <= 0) {
      PATH_SetType113c(m, pPath, 15)
      steps = PATH_Compute113c(m, pPath, pMonster, 0) | 0
    }
  } else {
    m.set(pPath, D2DynamicPathStrc.dwPathPoints, 1)
  }
  if (steps <= 0) return 0 as never

  const prevMoveMode = m.get(pMonster, D2UnitStrc.dwAnimMode) | 0
  if (prevMoveMode !== 1) {
    MONSTER_SavePrevMode113c(m, pMonster, prevMoveMode)
  }
  UNITS_ChangeAnimMode113c(m, pMonster, mode)
  MONSTER_ClearModeEvents113c(m, pGame, pMonster)
  MONSTER_RegisterContinuousModeEvent113c(m, pGame, pMonster)

  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    if (m.u32((pClient + 0x04) >>> 0) === 4) {
      if (pTargetUnit !== 0) {
        S2C_SendPacket68_NpcMoveToTarget113c(m, pClient, pMonster, pTargetUnit, mode === 15 ? 0x18 : 0x00)
      } else {
        S2C_SendPacket67_NpcMove113c(m, pClient, pMonster, targetX & 0xffff, targetY & 0xffff, mode === 15 ? 0x17 : 0x01)
      }
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
  }
  return 1 as never
}

export interface KernelMonsterAiBridge113c {
  readonly startMode: (
    pUnit: number,
    mode: number,
    pTargetUnit: number,
    targetX: number,
    targetY: number,
  ) => number
  readonly stall: (pUnit: number, nDelay: number) => void
  readonly idleWander: (pUnit: number, range: number) => number
  readonly tryRunTownNpcThink?: (pMonster: number, pfnThink: number) => boolean
  readonly getEquippedWeapon?: (pUnit: number) => number
  readonly scheduleModeAnimEventsFromMem?: (
    pGame: number,
    pUnit: number,
    evStepType: number,
    evEndType: number,
  ) => number
}

const KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C = new WeakMap<Memory113c, KernelMonsterAiBridge113c>()

export function registerKernelMonsterAiBridge113c(
  m: Memory113c,
  bridge: KernelMonsterAiBridge113c,
): void {
  KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C.set(m, bridge)
}

let monsterModeKnockbackHook113c:
  | ((m: Memory113c, pGame: number, pModeChangeArgs: number) => number)
  | undefined

export function registerMonsterModeKnockbackHook113c(
  fn: (m: Memory113c, pGame: number, pModeChangeArgs: number) => number,
): void {
  monsterModeKnockbackHook113c = fn
}

/**
 * Shared `D2Game.dll@0x6FC95160` (`MONSTER_ModeChangeKnockback`) transition helper for both
 * `MonsterSliceWorldLike113c` and raw `Memory113c` execution paths of `MONSTER_StartMode113c`.
 */
function applyMonsterModeChangeKnockbackK2(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pModeChange = 0,
): number {
  if (pModeChange !== 0 && monsterModeKnockbackHook113c !== undefined) {
    return monsterModeKnockbackHook113c(m, pGame, pModeChange) | 0
  }
  const nCid = m.u32((pMonster + 0x04) >>> 0) | 0
  if (MONSTATS2_CheckModeBit113c(m, nCid, 3) === 0 || MONSTATS2_CheckModeBit113c(m, nCid, 0x0d) === 0) {
    return 0
  }
  if ((m.u32((pMonster + 0x10) >>> 0) | 0) !== 0) {
    const pPathKb = m.u32((pMonster + 0x2c) >>> 0) >>> 0
    PATH_SetType113c(m, pPathKb, 8)
    const baseIdKb = MONSTER_GetBaseIdFromUnit113c(m, pMonster) | 0
    PATH_SetDistance113c(m, pPathKb, baseIdKb === 0x4e ? 0x0a : 5)
    PATH_Compute113c(m, pPathKb, pMonster, 0)
    SUNITDMG_FreeAttackerCombatList113c(m, pMonster, pGame)
    UNITS_ChangeAnimMode113c(m, pMonster, 0x0d)
  }
  return 1
}

function dispatchMonsterModeStartEntryK2(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  mMode: number,
  pModeChange: number,
  pfnStart: number,
  useDllStartDeath: boolean,
): number {
  if (pfnStart === 0x6fc94e60) {
    return MONSTER_StartNeutral113c(m, pGame, pMonster) | 0
  }
  if (pfnStart === 0x6fc94c60) {
    return MONSTER_StartModeWalk113c(m, pGame, pModeChange) | 0
  }
  if (pfnStart === 0x6fc94c30) {
    return MONSTER_StartModeRun113c(m, pGame, pModeChange) | 0
  }
  if (pfnStart === 0x6fc95210) {
    return MONSTER_StartGetHitMode113c(m, pGame, pModeChange) | 0
  }
  if (pfnStart === 0x6fc95510) {
    return MONSTER_StartAttackOrCast113c(m, pGame, pModeChange) | 0
  }
  if (pfnStart === 0x6fc954e0) {
    hitD2GameVa113c(0x6FC954E0)
    SUNITDMG_FreeAttackerCombatList113c(m, pMonster, pGame)
    UNITS_ChangeAnimMode113c(m, pMonster, 0x0e)
    m.setU32((pMonster + 0xc4) >>> 0, (m.u32((pMonster + 0xc4) >>> 0) & 0xffffffbf) >>> 0)
    return SKILLS_StartUsedSkill113c(m, pMonster, pGame) | 0
  }
  if (pfnStart === 0x6fc94c90) {
    return MONMODE_EnterAnimMode10_6FC94C90_113c(m, pGame, pModeChange) | 0
  }
  if (pfnStart === 0x6fc94c10) {
    SUNITDMG_FreeAttackerCombatList113c(m, pMonster, pGame)
    UNITS_ChangeAnimMode113c(m, pMonster, mMode)
    return 1
  }
  if (pfnStart === 0x6fc96700) {
    return MONMODE_EnterMode11AndScheduleEndAnim15_6FC96700_113c(m, pGame, pModeChange) | 0
  }
  if (pfnStart === 0x6fc95460) {
    hitD2GameVa113c(0x6FC95460)
    if ((m.u32((pMonster + 0x10) >>> 0) | 0) !== 0) {
      MONSTER_SetDeathPathAndAnim113c(m, pGame >>> 0, pMonster, m.u8((pModeChange + 0x14) >>> 0))
    }
    SUNITDMG_FreeAttackerCombatList113c(m, pMonster, pGame)
    UNITS_ChangeAnimMode113c(m, pMonster, 0x0c)
    let pEvt8 = m.u32((pMonster + 0xdc) >>> 0) >>> 0
    while (pEvt8 !== 0) {
      const pNext = m.u32((pEvt8 + 0x24) >>> 0) >>> 0
      if (m.u8(pEvt8) === 8) EVENT_FreeNode113c(m, pGame >>> 0, pEvt8)
      pEvt8 = pNext
    }
    let pEvt9 = m.u32((pMonster + 0xdc) >>> 0) >>> 0
    while (pEvt9 !== 0) {
      const pNext = m.u32((pEvt9 + 0x24) >>> 0) >>> 0
      if (m.u8(pEvt9) === 9) EVENT_FreeNode113c(m, pGame >>> 0, pEvt9)
      pEvt9 = pNext
    }
    return 1
  }
  if (pfnStart === 0x6fc96270) {
    if (useDllStartDeath) {
      return (MONSTER_StartDeath113c(m, pGame, pModeChange, 0, false, true) as number) | 0
    }
    hitD2GameVa113c(0x6FC96270)
    SUNITDMG_FreeAttackerCombatList113c(m, pMonster, pGame)
    UNITS_ChangeAnimMode113c(m, pMonster, 0)
    MONSTER_SetDeathPathAndAnim113c(m, pGame >>> 0, pMonster, m.u8((pModeChange + 0x14) >>> 0))
    const pTargetUnit = m.u32((pModeChange + 0x08) >>> 0) >>> 0
    const prevDropGuid = pGame !== 0 ? (m.u32((pGame + 0xa0) >>> 0) >>> 0) : 0
    MONSTER_DropDeathItems_6FC95900_113c(m, pGame >>> 0, pMonster, pTargetUnit)
    const nextDropGuid = pGame !== 0 ? (m.u32((pGame + 0xa0) >>> 0) >>> 0) : 0
    applyMissingNormalInferiorAutoAffixInRange113c(m, pGame >>> 0, prevDropGuid, nextDropGuid)
    const pMonDataD = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pMonDataD === 0 || (m.u8((pMonDataD + 0x5c) >>> 0) & 2) === 0) {
      const lvlIdD = pMonDataD !== 0 ? (m.u32((pMonDataD + 0x58) >>> 0) >>> 0) : 0
      const pMonRegD = m.u32((pGame + 0xf0 + (lvlIdD << 2)) >>> 0) >>> 0
      if (pMonRegD !== 0 && UNIT_GetAlignment113c(m, pMonster) === 0) {
        m.setU32((pMonRegD + 0x2d0) >>> 0, (m.u32((pMonRegD + 0x2d0) >>> 0) + 1) >>> 0)
      }
    }
    const pDeathRoom = UNITS_GetRoom113c(m, pMonster) >>> 0
    ROOM_RecordMonsterDeath113c(m, pDeathRoom, m.u32((pMonster + 0x0c) >>> 0) >>> 0)
    return 1
  }
  if (pfnStart === 0x6fc95160) {
    return applyMonsterModeChangeKnockbackK2(m, pGame, pMonster, pModeChange)
  }
  UNITS_ChangeAnimMode113c(m, pMonster, mMode)
  return 1
}

let pendingBridgePathTypeOverrideK2 = 0
let pendingBridgeClearUsedSkillK2 = -1
let inSiegeMinionThinkC0x64K2 = false

/**
 * `@va D2Game:0x6FC95E10` (`MONSTER_StartMode`, `560B`):
 * Canonical monster mode transition across `MonsterSliceWorldLike113c` and `Memory113c`.
 */
export function MONSTER_StartMode113c<T extends MonsterSliceWorldLike113c | Memory113c>(
  arg0: T,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4 = 0,
  arg5 = 0,
  arg6 = 0,
  arg7 = 0,
  arg8 = 1,
  dllAbi = false,
): T extends MonsterSliceWorldLike113c ? boolean : number {
  hitD2GameVa113c(0x6FC95E10)
  if (!dllAbi && !isMonsterSliceWorldK2(arg0)) {
    const bridge = KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C.get(arg0 as Memory113c)
    if (bridge !== undefined) {
      if (arg1 === 0 || arg2 === 0) return 0 as never
      const prevPtOv = pendingBridgePathTypeOverrideK2
      const prevClrSk = pendingBridgeClearUsedSkillK2
      pendingBridgePathTypeOverrideK2 = arg7 | 0
      pendingBridgeClearUsedSkillK2 = arg8 | 0
      try {
        return bridge.startMode(arg2, arg3 | 0, arg4, arg5, arg6) as never
      } finally {
        pendingBridgePathTypeOverrideK2 = prevPtOv
        pendingBridgeClearUsedSkillK2 = prevClrSk
      }
    }
  }
  if (isMonsterSliceWorldK2(arg0)) {
    const bClearUsedSkill = pendingBridgeClearUsedSkillK2
    pendingBridgeClearUsedSkillK2 = -1
    const world = arg0
    const pMonster = arg1
    const mode = arg2
    const pTarget = arg3
    const targetX = arg4
    const targetY = arg5
    const { m, pGame } = world
    const syncRoomFlags = world.hasFullDrlg !== undefined
    const pu = world.pathUnitByPtr.get(pMonster)
    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    if (pPath === 0 || (pu !== undefined && pu.pPath === 0)) return false as never
    ensureSliceWorldPathMemoryK2(world)
    if (pu !== undefined) {
      pu.dwAnimMode = m.get(pu.pUnit, D2UnitStrc.dwAnimMode)
      pu.dwFlags = m.get(pu.pUnit, D2UnitStrc.dwFlags)
      pu.dwFlagEx = m.get(pu.pUnit, D2UnitStrc.dwFlags2)
    }

    const entry = MONSTER_GetModeEntry113c(m, pMonster, mode)
    if (entry === null) {
      throw new RangeError(
        `MONSTER_StartMode113c: missing mode entry for classId=${m.get(pMonster, D2UnitStrc.dwClassId)} mode=${mode}`,
      )
    }

    const animHydrated = hasHydratedAnimDataTableK2(m)
    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
    const row = getMonStatsRowStrictK2(m, pMonster)
    const isMoving = MONSTER_IsContinuousMode113c(m, pMonster, mode)
    let moveAnimSpeed = 256

    if (syncRoomFlags && SUNIT_IsDeadOrDying113c(m, pMonster) === 0) {
      PATH_AddUnitCollisionFootprint113c(m, pMonster)
    }

    const prevMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
    if (prevMode !== 1) {
      MONSTER_SavePrevMode113c(m, pMonster, prevMode)
    }

    if (mode !== 3) {
      const moveRes = MONSTER_StartMove113c(world, pMonster, mode, pTarget, targetX, targetY, isMoving, row)
      moveAnimSpeed = moveRes.moveAnimSpeed
      if (moveRes.abortedMoving) {
        return (moveRes.ok !== 0) as never
      }
      if (animHydrated) {
        const hadFlag1List = STATLIST_GetStatListFromUnitAndFlag113c(m, pMonster, 1) !== 0
        MONSTER_ApplyElementalDamageAndResistStats113c(m, pGame, pMonster, mode)
        if (!hadFlag1List && !isHireableMonsterK2(m, pMonster)) {
          setMonsterAttackStatsForModeK2(m, pGame, pMonster, mode, row)
        }
      } else if (!isHireableMonsterK2(m, pMonster)) {
        setMonsterAttackStatsForModeK2(m, pGame, pMonster, mode, row)
      }
      MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 0)
      if (
        !(animHydrated && entry.pfnStart === 0x6fc954e0) &&
        !(bClearUsedSkill !== 0 && (mode === 1 || mode === 6 || mode === 12 || mode === 13))
      ) {
        world.onMonsterStartSkillMode?.(m, pGame, pMonster)
      }
    } else if (isSgptDataTablesLoaded113c(m) && pGame !== 0) {
      const savedSp = k2RealStackPtr
      const pModeChange = k2RealStackPtr
      k2RealStackPtr = (k2RealStackPtr + 0x20) >>> 0
      try {
        m.fill(pModeChange, 0x20, 0)
        m.setU32((pModeChange + 0x04) >>> 0, pMonster >>> 0)
        MONSTER_StartGetHitMode113c(m, pGame, pModeChange)
      } finally {
        k2RealStackPtr = savedSp
      }
    }

    // 0x6FC95F58..0x6FC95F96: dispatch canonical mode pfnStart(pGame, pModeChange)
    const pModeChange = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
    monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
    let startOk = 1
    try {
      m.setU32(pModeChange, mode >>> 0)
      m.setU32((pModeChange + 0x04) >>> 0, pMonster >>> 0)
      m.setU32((pModeChange + 0x08) >>> 0, pTarget >>> 0)
      m.setU32((pModeChange + 0x0c) >>> 0, targetX >>> 0)
      m.setU32((pModeChange + 0x10) >>> 0, targetY >>> 0)
      m.setU32((pModeChange + 0x14) >>> 0, 0)
      m.setU32((pModeChange + 0x18) >>> 0, 0)
      if (entry.pfnStart === 0x6fc96270) {
        MONSTER_StartDeath113c(world, pMonster, pTarget, 0, false, false, true)
        return true as never
      } else if (animHydrated) {
        startOk = dispatchMonsterModeStartEntryK2(
          m,
          pGame,
          pMonster,
          mode,
          pModeChange,
          entry.pfnStart,
          false,
        )
      } else if (entry.pfnStart === 0x6fc94e60) {
        startOk = MONSTER_StartNeutral113c(m, pGame, pMonster)
      } else if (entry.pfnStart === 0x6fc94c60) {
        startOk = MONSTER_StartModeWalk113c(m, pGame, pModeChange)
      } else if (entry.pfnStart === 0x6fc94c30) {
        startOk = MONSTER_StartModeRun113c(m, pGame, pModeChange)
      } else if (entry.pfnStart === 0x6fc95210) {
        startOk = MONSTER_StartGetHitMode113c(m, pGame, pModeChange)
        if (startOk === 0) {
          UNITS_ChangeAnimMode113c(m, pMonster, 3)
          startOk = 1
        }
      } else if (entry.pfnStart === 0x6fc95510) {
        startOk = MONSTER_StartAttackOrCast113c(m, pGame, pModeChange)
      } else if (entry.pfnStart === 0x6fc95160) {
        startOk = applyMonsterModeChangeKnockbackK2(m, pGame, pMonster, pModeChange)
      } else {
        m.set(pMonster, D2UnitStrc.dwAnimMode, mode >>> 0)
        expireHireableModeStateListsK2(m, pMonster, prevMode, mode >>> 0)
        if (syncRoomFlags) {
          UNITROOM_RefreshUnit113c(m, pMonster)
        }
        if (syncRoomFlags && prevMode !== (mode >>> 0) && !isHireableMonsterK2(m, pMonster)) {
          STATLIST_ExpireStateListsOnModeChange113c(m, pMonster, 0)
        }
      }
      if (startOk === 0) {
        SKILLS_SetUsedSkill113c(m, pMonster, 0)
        if (mode !== 0 && mode !== 12 && SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) {
          return true as never
        }
        MONSTER_StartNeutral113c(m, pGame, pMonster)
      }
    } finally {
      monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
    }

    const actualMode = m.get(pMonster, D2UnitStrc.dwAnimMode) >>> 0
    const modeBits =
      syncRoomFlags && !(prevMode === 1 && actualMode === 1)
        ? (UNITFLAG_MODE_CHANGED_TICK_K2 | 0x01)
        : UNITFLAG_MODE_CHANGED_TICK_K2
    const updatedFlags = (m.get(pMonster, D2UnitStrc.dwFlags) | modeBits) >>> 0
    m.set(pMonster, D2UnitStrc.dwFlags, updatedFlags)
    if (pu !== undefined) {
      pu.dwAnimMode = actualMode
      pu.dwFlags = updatedFlags
    }

    const frames = getMonsterModeBaseFrameCountPure113c(row.hcIdx, actualMode)
    const actualIsMoving = MONSTER_IsContinuousMode113c(m, pMonster, actualMode)
    if (animHydrated) {
      SUNIT_InitUnitAnimData113c(m, pMonster)
      let appliedVelOv = false
      if (mode !== 3 && pAiCtrl !== 0) {
        const velOvBefore = m.u32((pAiCtrl + 0x10) >>> 0) | 0
        MONSTER_ApplyModeVelocityOverride113c(m, pAiCtrl, pMonster)
        if (velOvBefore !== 0) {
          appliedVelOv = true
        }
      } else if (actualIsMoving && world.onApplyHireableVelocityOverride !== undefined) {
        appliedVelOv = world.onApplyHireableVelocityOverride(m, pMonster, pAiCtrl)
      }
      if (actualIsMoving && !appliedVelOv && actualMode !== 0x0d && actualMode !== 0x0e) {
        if (((m.u32((pMonster + 0xc8) >>> 0) >>> 3) & 1) === 0) {
          m.setU16((pMonster + 0x4c) >>> 0, moveAnimSpeed & 0xffff)
        }
        const pPathCur = m.get(pMonster, D2UnitStrc.pPath)
        if (pPathCur !== 0) {
          const baseVel = row.velocity
          const statVelPct = STATLIST_GetUnitStat113c(m, pMonster, 67, 0) | 0
          const frwStat = STATLIST_GetUnitStat113c(m, pMonster, 96, 0) | 0
          const velOv = pAiCtrl !== 0 ? (m.u32((pAiCtrl + 0x10) >>> 0) | 0) : 0
          let totalPct =
            (statVelPct !== 0 ? statVelPct : 100) + computeFrwDiminishingPure113c(frwStat) + velOv
          if (totalPct < 25) totalPct = 25
          const scaledVel = resolveMonsterScaledVelocityK2(m, pMonster, actualMode, baseVel, totalPct)
          PATH_SetVelocity113c(m, pPathCur, scaledVel > 0 ? scaledVel : 0)
        }
      }
    } else {
      writeUnitAnimStateK2(
        m,
        pMonster,
        0,
        0,
        frames << 8,
        actualIsMoving ? moveAnimSpeed : 256,
        0,
      )
    }

    MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 1)
    if (
      bClearUsedSkill !== 0 &&
      actualMode === (mode >>> 0) &&
      (actualMode === 1 || actualMode === 3 || actualMode === 6 || actualMode === 12 || actualMode === 13)
    ) {
      SKILLS_SetUsedSkill113c(m, pMonster, 0)
    }
    MONSTER_ClearModeEvents113c(m, pGame, pMonster)

    const actualEntry = MONSTER_GetModeEntry113c(m, pMonster, actualMode)
    if (actualEntry !== null && actualEntry.scheduleEvents !== 0) {
      if (actualIsMoving) {
        MONSTER_RegisterContinuousModeEvent113c(m, pGame, pMonster)
      } else if (animHydrated) {
        const endFrame = scheduleUnitModeAnimEventsFromMemK2(
          m,
          pGame,
          pMonster,
          0,
          MON_EVENT_MODE_END,
        )
        if (!syncRoomFlags) {
          const bExp =
            m.u8((pGame + 0x6a) >>> 0) !== 0 ||
            m.u32((pGame + 0x74) >>> 0) !== 0 ||
            m.get(pGame, D2GameStrc.bExpansion) !== 0
          const diff: 0 | 1 | 2 = bExp ? getEffectiveDiffK2(m, pGame) : 0
          const rawAidel = row.aidel[diff]
          const aidel = rawAidel > 0 ? rawAidel : 15
          EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
          EVENT_SetEventFull113c(
            m,
            pGame,
            pMonster,
            MON_EVENT_AI_THINK,
            (endFrame + aidel) >>> 0,
            0,
            0,
            0,
          )
        }
      } else {
        const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
        EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_MODE_END, (frame + frames) >>> 0, 0, 0, 0)
        if (!syncRoomFlags) {
          const bExp = m.get(pGame, D2GameStrc.bExpansion)
          const diff: 0 | 1 | 2 = bExp !== 0 ? getEffectiveDiffK2(m, pGame) : 0
          const rawAidel = row.aidel[diff]
          const aidel = rawAidel > 0 ? rawAidel : 15
          EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
          EVENT_SetEventFull113c(
            m,
            pGame,
            pMonster,
            MON_EVENT_AI_THINK,
            (frame + frames + aidel) >>> 0,
            0,
            0,
            0,
          )
        }
      }
    }
    // 0x6FC9601B..0x6FC96034 (`MONSTER_StartMode` tail):
    // When entering mode 3 (`MONMODE_GETHIT`), D2Game forces `PATH_SetType(pPath, 0)` and `PATH_SetNewDistance(pPath, 0)`.
    if (actualMode === 3) {
      const pPathMode3 = m.get(pMonster, D2UnitStrc.pPath) >>> 0
      PATH_SetType113c(m, pPathMode3, 0)
      PATH_SetNewDistance113c(m, pPathMode3, 0)
    }
    return (startOk !== 0) as never
  }

  const m = arg0 as Memory113c
  if (dllAbi) {
    const pGame = arg1 >>> 0
    const pModeChange = arg2 >>> 0
    const bClearUsedSkill = arg3 | 0
    const pMonster = pModeChange !== 0 ? (m.u32((pModeChange + 0x04) >>> 0) >>> 0) : 0
    if (pMonster === 0 || (m.u32(pMonster) | 0) !== 1) return 0 as never
    const pPath = m.u32((pMonster + 0x2c) >>> 0) >>> 0
    const mMode = m.u32(pModeChange) | 0
    if (STATES_CheckState113c(m, pMonster, 0x36) !== 0) {
      throw new D2CommonAssertError('AiUtil.cpp', 0x753)
    }
    if (SUNIT_IsDeadOrDying113c(m, pMonster) === 0) {
      PATH_AddUnitCollisionFootprint113c(m, pMonster)
    }
    const prevModeReal = m.u32((pMonster + 0x10) >>> 0) | 0
    if (prevModeReal !== 1) {
      MONSTER_SavePrevMode113c(m, pMonster, prevModeReal)
    }
    let pAiCtrl = 0
    const pTargetUnit = m.u32((pModeChange + 0x08) >>> 0) >>> 0
    if (mMode !== 3) {
      if (pTargetUnit !== 0) {
        PATH_SetTargetUnit113c(m, pPath, pTargetUnit)
      } else {
        PATH_SetTargetPos113c(
          m,
          pPath,
          m.u32((pModeChange + 0x0c) >>> 0) | 0,
          m.u32((pModeChange + 0x10) >>> 0) | 0,
        )
      }
      PATH_SetStepDistance113c(m, pPath, 0x14)
      if ((m.u32(pMonster) | 0) === 1) {
        const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          pAiCtrl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
        }
      }
      MONSTER_StartMove113c(
        m,
        pGame,
        pMonster,
        pAiCtrl,
        m.u8((pModeChange + 0x15) >>> 0),
        m.u32((pModeChange + 0x18) >>> 0) | 0,
        m.u8((pModeChange + 0x1c) >>> 0),
        undefined,
        true,
      )
      MONSTER_ApplyElementalDamageAndResistStats113c(m, pGame, pMonster, mMode)
      MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 0)
    }
    const entry = MONSTER_GetModeEntry113c(m, pMonster, mMode)
    if (entry === null || entry.pfnStart === 0) {
      MONSTER_NullModeEventFallback113c(m, pGame, pMonster, mMode)
      return 0 as never
    }
    const startOk = dispatchMonsterModeStartEntryK2(m, pGame, pMonster, mMode, pModeChange, entry.pfnStart, true)
    if (startOk === 0) {
      SKILLS_SetUsedSkill113c(m, pMonster, 0)
      if (mMode !== 0 && mMode !== 12 && SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) {
        return 1 as never
      }
      MONSTER_StartNeutral113c(m, pGame, pMonster)
    }
    m.setU32((pMonster + 0xc4) >>> 0, (m.u32((pMonster + 0xc4) >>> 0) | 0x80000) >>> 0)
    SUNIT_InitUnitAnimData113c(m, pMonster)
    if (pAiCtrl !== 0) {
      MONSTER_ApplyModeVelocityOverride113c(m, pAiCtrl, pMonster)
    }
    MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 1)
    const actualMode = m.u32((pMonster + 0x10) >>> 0) | 0
    if (bClearUsedSkill !== 0 && actualMode === mMode) {
      SKILLS_SetUsedSkill113c(m, pMonster, 0)
    }
    MONSTER_ClearModeEvents113c(m, pGame, pMonster)
    const actualEntry = MONSTER_GetModeEntry113c(m, pMonster, actualMode)
    if (actualEntry === null) {
      MONSTER_NullModeEventFallback113c(m, pGame, pMonster, actualMode)
      return 0 as never
    }
    if (actualEntry.scheduleEvents !== 0) {
      if (MONSTER_IsContinuousMode113c(m, pMonster, actualMode)) {
        MONSTER_RegisterContinuousModeEvent113c(m, pGame, pMonster)
      } else {
        SUNIT_ScheduleModeAnimEvents113c(m, pGame, pMonster, MON_EVENT_MODE_STEP, MON_EVENT_MODE_END)
      }
    }
    if (actualMode === 3) {
      PATH_SetType113c(m, pPath, 0)
      PATH_SetNewDistance113c(m, pPath, 0)
    }
    return startOk as never
  }

  const pGame = arg1
  const pMonster = arg2
  const mMode = arg3 | 0
  const pTargetUnit = arg4
  const targetX = arg5
  const targetY = arg6
  const pathTypeArg = arg7 | 0
  const bClearUsedSkill = arg8 | 0
  if (pGame === 0 || pMonster === 0) return 0 as never
  if (
    hasHydratedAnimDataTableK2(m) &&
    safeReadU32K2(m, 0x6fde461c) !== 0 &&
    safeReadU32K2(m, 0x6fdef020) !== 0 &&
    safeReadU32K2(m, 0x6fdf13a4) !== 0 &&
    (m.u32(pMonster >>> 0) | 0) === 1
  ) {
    // Real D2Game.dll@0x6FC95E10 (`MONSTER_StartMode`) on hydrated Memory113c.
    if (STATES_CheckState113c(m, pMonster, 0x36) !== 0) {
      throw new D2CommonAssertError('AiUtil.cpp', 0x753)
    }
    const pPath = m.get(pMonster, D2UnitStrc.pPath) >>> 0
    if (SUNIT_IsDeadOrDying113c(m, pMonster) === 0) {
      PATH_AddUnitCollisionFootprint113c(m, pMonster)
    }
    const prevModeReal = m.get(pMonster, D2UnitStrc.dwAnimMode) | 0
    if (prevModeReal !== 1) {
      MONSTER_SavePrevMode113c(m, pMonster, prevModeReal)
    }
    let pAiCtrl = 0
    if (mMode !== 3) {
      if (pPath !== 0) {
        if (pTargetUnit !== 0) {
          PATH_SetTargetUnit113c(m, pPath, pTargetUnit)
        } else {
          PATH_SetTargetPos113c(m, pPath, targetX, targetY)
        }
        PATH_SetStepDistance113c(m, pPath, 0x14)
      }
      const pMonData = m.get(pMonster, D2UnitStrc.pUnitData) >>> 0
      pAiCtrl = pMonData !== 0 ? (m.get(pMonData, D2MonsterDataStrc.pAiControl) >>> 0) : 0
      if (pAiCtrl !== 0) {
        // 0x6FC94F90: consume overrides on pAiCtrl (+0x18/+0x1C/+0x20), call 0x6FC94D50,
        // write +0x10/+0x14, bump pGame+0x1D70[idx] and pGame+0x1DB4 when idx != 0.
        hitD2GameVa113c(0x6FC94F90)
        const ovType = m.get(pAiCtrl, D2AiControlStrc.dwPathTypeOverride) | 0
        const ovVel = m.get(pAiCtrl, D2AiControlStrc.dwVelocityOverride) | 0
        const ovDist = m.get(pAiCtrl, D2AiControlStrc.bNewDistOverride) & 0xff
        m.set(pAiCtrl, D2AiControlStrc.dwPathTypeOverride, 0)
        m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 0)
        m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, 0)
        const defaultPathType = MONSTER_IsContinuousMode113c(m, pMonster, mMode) ? 0x65 : 0x64
        const effType = ovType !== 0 ? ovType : pathTypeArg !== 0 ? pathTypeArg : defaultPathType
        let resVel = ovVel
        let resDist = -1
        let pathIdx = 0
        if (effType === 0x64) {
          resVel = 0
          pathIdx = 0
        } else if (pPath !== 0) {
          const effNewDist = ovDist !== 0 ? ovDist : 5
          const finalPathType = effType === 0x65 ? 0x0d : effType
          pathIdx = PLAYER_RecalcTargetUnitPath113c(m, effNewDist, pAiCtrl, pMonster, finalPathType) | 0
          if (pathIdx !== 1 && (PATH_GetTargetUnit113c(m, pPath) >>> 0) !== 0) {
            resDist = 10
          }
        }
        m.setU32((pAiCtrl + 0x10) >>> 0, resVel >>> 0)
        m.setU32((pAiCtrl + 0x14) >>> 0, resDist >>> 0)
        const statAddr = (pGame + 0x1d70 + ((pathIdx & 0xff) << 2)) >>> 0
        m.setU32(statAddr, (m.u32(statAddr) + 1) >>> 0)
        if (pathIdx !== 0) {
          m.setU32((pGame + 0x1db4) >>> 0, (m.u32((pGame + 0x1db4) >>> 0) + 1) >>> 0)
        }
      }
      MONSTER_ApplyElementalDamageAndResistStats113c(m, pGame, pMonster, mMode)
      MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 0)
    }
    const entry = MONSTER_GetModeEntry113c(m, pMonster, mMode)
    if (entry === null || entry.pfnStart === 0) {
      MONSTER_NullModeEventFallback113c(m, pGame, pMonster, mMode)
      return 0 as never
    }
    const pModeChange = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
    monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
    let startOk = 1
    try {
      m.fill(pModeChange, 0x20, 0)
      m.setU32(pModeChange, mMode >>> 0)
      m.setU32((pModeChange + 0x04) >>> 0, pMonster >>> 0)
      m.setU32((pModeChange + 0x08) >>> 0, pTargetUnit >>> 0)
      m.setU32((pModeChange + 0x0c) >>> 0, targetX >>> 0)
      m.setU32((pModeChange + 0x10) >>> 0, targetY >>> 0)
      if (pathTypeArg !== 0) {
        m.setU8((pModeChange + 0x15) >>> 0, pathTypeArg & 0xff)
      }
      startOk = dispatchMonsterModeStartEntryK2(m, pGame, pMonster, mMode, pModeChange, entry.pfnStart, false)
      if (startOk === 0) {
        SKILLS_SetUsedSkill113c(m, pMonster, 0)
        if (mMode !== 0 && mMode !== 12 && SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) {
          return 1 as never
        }
        MONSTER_StartNeutral113c(m, pGame, pMonster)
      }
    } finally {
      monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
    }
    m.setU32((pMonster + 0xc4) >>> 0, (m.u32((pMonster + 0xc4) >>> 0) | 0x80000) >>> 0)
    SUNIT_InitUnitAnimData113c(m, pMonster)
    if (pAiCtrl !== 0) {
      MONSTER_ApplyModeVelocityOverride113c(m, pAiCtrl, pMonster)
    }
    MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 1)
    const actualMode = m.get(pMonster, D2UnitStrc.dwAnimMode) | 0
    if (bClearUsedSkill !== 0 && actualMode === mMode) {
      SKILLS_SetUsedSkill113c(m, pMonster, 0)
    }
    MONSTER_ClearModeEvents113c(m, pGame, pMonster)
    const actualEntry = MONSTER_GetModeEntry113c(m, pMonster, actualMode)
    if (actualEntry === null) {
      MONSTER_NullModeEventFallback113c(m, pGame, pMonster, actualMode)
      return 0 as never
    }
    if (actualEntry.scheduleEvents !== 0) {
      if (MONSTER_IsContinuousMode113c(m, pMonster, actualMode)) {
        MONSTER_RegisterContinuousModeEvent113c(m, pGame, pMonster)
      } else {
        scheduleUnitModeAnimEventsFromMemK2(m, pGame, pMonster, MON_EVENT_MODE_STEP, MON_EVENT_MODE_END)
      }
    }
    // 0x6FC9601B..0x6FC96034 (`MONSTER_StartMode` tail):
    if ((actualMode | 0) === 3) {
      const pPathMode3 = m.get(pMonster, D2UnitStrc.pPath) >>> 0
      PATH_SetType113c(m, pPathMode3, 0)
      PATH_SetNewDistance113c(m, pPathMode3, 0)
    }
    return startOk as never
  }
  if (mMode === 2 || mMode === 15) {
    return MONSTER_StartMove113c(m, pGame, pMonster, mMode, pTargetUnit, targetX, targetY) as never
  }
  if (mMode === 0) {
    MONSTER_StartDeath113c(m, pGame, pMonster, pTargetUnit)
    return 1 as never
  }
  if (mMode !== 3 && pathTypeArg !== 0 && pathTypeArg !== 0x64) {
    const pPathFb = m.get(pMonster, D2UnitStrc.pPath) >>> 0
    if (pPathFb !== 0) {
      PATH_SetType113c(m, pPathFb, pathTypeArg === 0x65 ? 0x0d : pathTypeArg)
    }
  }

  const prevMode = m.get(pMonster, D2UnitStrc.dwAnimMode) | 0
  if (prevMode !== 1) {
    MONSTER_SavePrevMode113c(m, pMonster, prevMode)
  }
  if (prevMode !== mMode) {
    STATLIST_ExpireStateListsOnModeChange113c(m, pMonster, 0)
  }
  UNITS_ChangeAnimMode113c(m, pMonster, mMode)
  MONSTER_ClearModeEvents113c(m, pGame, pMonster)

  const hcIdx = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  let frames = getMonsterModeBaseFrameCountPure113c(hcIdx, mMode) | 0
  if (frames < 1) frames = 8
  let baseSpeed = getMonsterModeBaseAnimSpeed256Pure113c(hcIdx, mMode) | 0
  if (baseSpeed < 16) baseSpeed = 256

  let rateBonus = 0
  if (mMode === 4 || mMode === 5) {
    rateBonus =
      (STATLIST_GetUnitStat113c(m, pMonster, 68, 0) | 0) +
      computeFrwDiminishingPure113c(STATLIST_GetUnitStat113c(m, pMonster, 93, 0) | 0)
  } else if (mMode === 6) {
    rateBonus =
      computeFrwDiminishingPure113c(STATLIST_GetUnitStat113c(m, pMonster, 99, 0) | 0) +
      (STATLIST_GetUnitStat113c(m, pMonster, 69, 0) | 0)
  } else {
    rateBonus = STATLIST_GetUnitStat113c(m, pMonster, 69, 0) | 0
  }
  let effSpeed = Math.trunc((baseSpeed * (100 + rateBonus)) / 100)
  if (effSpeed < 16) effSpeed = 16

  m.set(pMonster, D2UnitStrc.dwFramePrecise, 0)
  m.set(pMonster, D2UnitStrc.dwFrameCountPrecise, (frames << 8) >>> 0)
  m.set(pMonster, D2UnitStrc.wAnimSpeed, effSpeed & 0xffff)

  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  if (MONSTER_IsContinuousMode113c(m, pMonster, mMode)) {
    MONSTER_RegisterContinuousModeEvent113c(m, pGame, pMonster)
    if (mMode === 1) {
      const coords = getUnitCoordsK2(m, pMonster)
      const lifePct = STATLIST_GetUnitLifePercent113c(m, pMonster) & 0xff
      let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
      while (pClient !== 0) {
        if (m.u32((pClient + 0x04) >>> 0) === 4) {
          S2C_SendPacket6D_NpcStop113c(m, pClient, m.get(pMonster, D2UnitStrc.dwUnitId) >>> 0, coords.x, coords.y, lifePct)
        }
        pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
      }
    }
    return 1 as never
  }

  const entryFb = MONSTER_GetModeEntry113c(m, pMonster, mMode)
  if (entryFb === null || entryFb.scheduleEvents !== 0) {
    const totalTicks = Math.max(1, Math.ceil(((frames << 8) - 1) / effSpeed))
    if (mMode === 4 || mMode === 5 || (mMode >= 7 && mMode <= 11)) {
      const actFrame = Math.max(1, frames >> 1)
      const actTicks = Math.max(1, Math.min(totalTicks, Math.ceil((actFrame << 8) / effSpeed)))
      m.set(pMonster, D2UnitStrc.wActionFrame, 1)
      EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_MODE_STEP, (curFrame + actTicks) >>> 0, 0, 0, 0)
    }
    EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_MODE_END, (curFrame + totalTicks) >>> 0, 0, 0, 0)
  }

  if ((mMode === 4 || mMode === 5) && pTargetUnit !== 0) {
    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    if (pPath !== 0) {
      PATH_SetTargetUnit113c(m, pPath, pTargetUnit)
    }
    const atkCode = mMode === 5 ? 0x11 : 0x10
    let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pClient !== 0) {
      if (m.u32((pClient + 0x04) >>> 0) === 4) {
        S2C_SendPacket6C_NpcAttack113c(m, pClient, pMonster, atkCode, pTargetUnit)
      }
      pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    }
  }
  // 0x6FC9601B..0x6FC96034 (`MONSTER_StartMode` tail):
  if ((m.get(pMonster, D2UnitStrc.dwAnimMode) | 0) === 3) {
    const pPathMode3 = m.get(pMonster, D2UnitStrc.pPath) >>> 0
    PATH_SetType113c(m, pPathMode3, 0)
    PATH_SetNewDistance113c(m, pPathMode3, 0)
  }
  return 1 as never
}

function rollMonsterDeathDropSeedOnlyK2(
  world: MonsterSliceWorldLike113c,
  pMonster: number,
  row: MonStatsRow113c,
): void {
  const { m, pGame } = world
  const diff = getEffectiveDiffK2(m, pGame)
  const tcName = row.tc[diff * 4]!.trim()
  if (tcName.length === 0) return

  const monPath = m.get(pMonster, D2UnitStrc.pPath)
  const monRoom = monPath !== 0 ? m.get(monPath, D2DynamicPathStrc.pRoom) : 0
  const nearRoomSet = new Set<number>()
  if (monRoom !== 0) {
    nearRoomSet.add(monRoom)
    const ppRooms = m.get(monRoom, D2ActiveRoomStrc.ppRoomsNear)
    const nRooms = m.get(monRoom, D2ActiveRoomStrc.nRoomsNear)
    for (let i = 0; i < nRooms; i++) {
      const rPtr = ppRooms !== 0 ? m.u32((ppRooms + i * 4) >>> 0) : 0
      if (rPtr !== 0) nearRoomSet.add(rPtr)
    }
  }

  let gamePlayers = 0
  let partyPlayers = 0
  if (pGame !== 0) {
    for (let b = 0; b < 128; b++) {
      for (
        let pPlr = m.get(pGame, D2GameStrc.pUnitHash, b);
        pPlr !== 0;
        pPlr = m.get(pPlr, D2UnitStrc.pGameHashNext)
      ) {
        if (SUNIT_IsDeadOrDying113c(m, pPlr) !== 0) continue
        gamePlayers++
        const plrPath = m.get(pPlr, D2UnitStrc.pPath)
        const plrRoom = plrPath !== 0 ? m.get(plrPath, D2DynamicPathStrc.pRoom) : 0
        if (nearRoomSet.size === 0 || nearRoomSet.has(plrRoom)) {
          partyPlayers++
        }
      }
    }
  }

  const seed = UNITS_GetSeed113c(m, pMonster)
  const monPlayerCount = STATLIST_GetUnitStat113c(m, pMonster, 100, 0) | 0
  const isExpansion =
    pGame !== 0 &&
    (m.u16((pGame + 0x6a) >>> 0) === 3 || m.get(pGame, D2GameStrc.bExpansion) !== 0)

  rollTreasureClassSeedOnly113c(tcName, seed, {
    gamePlayers,
    partyPlayers,
    monsterPlayerCount: monPlayerCount,
    isExpansion,
  })
  UNITS_SetSeed113c(m, pMonster, seed.lo >>> 0, seed.hi >>> 0)
}

function awardMonsterKillExperienceK2(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pKiller: number,
  row: MonStatsRow113c,
): void {
  if (pKiller === 0 || m.get(pKiller, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  const diff = getEffectiveDiffK2(m, pGame)
  const mlvl = STATLIST_GetUnitStat113c(m, pMonster, 12, 0) | 0

  let rawExp = STATLIST_GetUnitStat113c(m, pMonster, 13, 0) | 0
  if (rawExp <= 0) {
    const monExpFactor = row.exp[diff]
    if (monExpFactor > 0 && mlvl > 0) {
      if (row.noRatio) {
        rawExp = monExpFactor
      } else {
        const xpVec = getMonLvlXpRow113c(mlvl)
        rawExp = Math.trunc((xpVec[diff] * monExpFactor) / 100)
      }
    }
  }
  if (rawExp <= 0) return

  const clvl = STATLIST_GetUnitStat113c(m, pKiller, 12, 0) | 0
  const addExpPct = STATLIST_GetUnitStat113c(m, pKiller, 85, 0) | 0
  const gain = calculateKillExperienceGainPure113c({
    rawExp,
    clvl,
    mlvl,
    addExpPct,
  })
  if (gain > 0) {
    const curXp = STATLIST_GetUnitStat113c(m, pKiller, 13, 0) | 0
    STATLIST_SetUnitStat113c(m, pKiller, 13, (curXp + gain) | 0, 0)
  }
}

/**
 * `@va D2Game:0x6FC96040` (`MONSTER_EndDeath`, `166B`, `DT -> DD = 12`):
 * Clears mode events, transitions `dwAnimMode = 12` (`DD`), and finalizes corpse state.
 */
export function MONSTER_EndDeath113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2 = 0,
  dllAbi = false,
): void | number {
  hitD2GameVa113c(0x6FC96040)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const { m, pGame } = world
    const syncRoomFlags = world.hasFullDrlg !== undefined
    MONSTER_ClearModeEvents113c(m, pGame, pMonster)
    m.set(pMonster, D2UnitStrc.dwAnimMode, 12)
    if (pGame !== 0 && isSgptDataTablesLoaded113c(m)) {
      SUNIT_DispatchItemEventCallbacks113c(m, pMonster, pGame, 0x0d, 0, 0)
    }
    if (syncRoomFlags) {
      UNITROOM_RefreshUnit113c(m, pMonster)
      const nextFlags = (m.get(pMonster, D2UnitStrc.dwFlags) | 0x01) >>> 0
      m.set(pMonster, D2UnitStrc.dwFlags, nextFlags)
      writeUnitAnimStateK2(m, pMonster, 0, 0, 256, 256, 0)
      const pu = world.pathUnitByPtr.get(pMonster)
      if (pu !== undefined) {
        pu.dwAnimMode = 12
        pu.dwFlags = nextFlags
      }
    } else {
      writeUnitAnimStateK2(m, pMonster, 0, 0, 256, 256, 0)
      const pu = world.pathUnitByPtr.get(pMonster)
      if (pu !== undefined) {
        pu.dwAnimMode = 12
      }
    }
    return
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  if (pMonster === 0) return 0
  if (dllAbi) {
    const game = pGame >>> 0
    const mon = pMonster >>> 0
    SUNITDMG_FreeAttackerCombatList113c(m, mon, game)
    UNITS_ChangeAnimMode113c(m, mon, 12)
    SUNIT_DispatchItemEventCallbacks113c(m, game, mon, 0x0d, 0, 0)
    const cid = m.u32((mon + 0x04) >>> 0) | 0
    if (cid >= 0) {
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
      const nCount = pTables !== 0 ? (m.u32((pTables + 0xa80) >>> 0) | 0) : 0
      if (cid < nCount) {
        const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(cid, 0x1a8)) >>> 0
        if (pMonStats !== 0) {
          const flagA4 = m.u8((pMonStats + 0x1a4) >>> 0)
          if (flagA4 === 1) {
            const morphId = (m.u16((pMonStats + 0x26) >>> 0) << 16) >> 16
            if (morphId >= 0 && morphId <= nCount) {
              MONSTER_MorphMonsterClassId_6FCCFC50_113c(m, mon, game, morphId, 1)
              MONSTER_ScheduleInitialAiEvent113c(m, game, mon)
            }
          } else if (flagA4 === 2) {
            const pOwner = SUNIT_GetOwnerUnit113c(m, mon, game) >>> 0
            if (pOwner !== 0) {
              SUNITDMG_DistributeExperience113c(m, game, pOwner, 0, 1, true)
            }
          }
        }
      }
    }
    return 1
  }
  if (pGame !== 0) {
    MONSTER_ClearModeEvents113c(m, pGame, pMonster)
    EVENT_DeleteEventByType113c(m, pGame, pMonster, MON_EVENT_AI_THINK)
  }
  UNITS_ChangeAnimMode113c(m, pMonster, 12)
  const flags = m.get(pMonster, D2UnitStrc.dwFlags) >>> 0
  m.set(pMonster, D2UnitStrc.dwFlags, ((flags & ~0x07) | 0x10000) >>> 0)
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  if (pPath !== 0) {
    PATH_MarkUnitDeadCollision113c(m, pMonster, 1)
  }
  if (pGame !== 0) {
    let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pClient !== 0) {
      if (m.u32((pClient + 0x04) >>> 0) === 4) {
        S2C_SendPacket69_NpcState113c(m, pClient, pMonster, 0x0c, 0)
      }
      pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    }
  }
  return 1
}

/**
 * `D2Game.dll@0x6FC30CC0..0x6FC31018`: `0x6FC31064` jump-table indices `[0,0,0,0,1,0,1,0,0]`
 * roll `wAutoPrefix` (`pItemsTxt + 0xF8`) for all `finalQual` in `{1, 2, 3, 4, 6, 8, 9}`
 * (including `1 = INFERIOR` and `2 = NORMAL`), skipping only `5 = SET` and `7 = UNIQUE`.
 */
export function applyMissingNormalInferiorAutoAffixInRange113c(
  m: Memory113c,
  pGame: number,
  prevItemGuid: number,
  newItemGuid: number,
): void {
  if (pGame === 0 || newItemGuid === prevItemGuid || !isSgptDataTablesLoaded113c(m)) return
  for (
    let guid = (prevItemGuid + 1) >>> 0;
    ((newItemGuid - guid) | 0) >= 0;
    guid = (guid + 1) >>> 0
  ) {
    const pItem = SUNIT_GetServerUnit113c(m, pGame >>> 0, UNIT_ITEM, guid) >>> 0
    if (pItem !== 0) {
      const pItemData = m.get(pItem, D2UnitStrc.pUnitData) >>> 0
      if (
        pItemData !== 0 &&
        m.get(pItemData, D2ItemDataStrc.wAutoAffix) === 0 &&
        ITEMS_TestFlagMask113c(m, ITEMS_GetCommandFlags113c(m, pItem), 0x2000) !== 0
      ) {
        const finalQual = ITEMS_GetItemQuality113c(m, pItem) | 0
        if (finalQual === 1 || finalQual === 2) {
          const finalFormat = ITEMS_GetItemFormat113c(m, pItem) & 0xffff
          if (finalFormat >= 100) {
            const pItemsTxt =
              DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pItem + 0x04) >>> 0) | 0) >>> 0
            const wAutoPrefixGrp = pItemsTxt !== 0 ? m.u16((pItemsTxt + 0xf8) >>> 0) : 0
            if (wAutoPrefixGrp !== 0) {
              const wAutoId =
                ITEMS_RollMagicAffixByFormat_6FC34B50_113c(
                  m,
                  pItem,
                  1,
                  0,
                  1,
                  1,
                  0,
                  wAutoPrefixGrp,
                ) & 0xffff
              if (wAutoId > 0) {
                ITEMS_SetAutoAffix113c(m, pItem, wAutoId)
                const pAutoTxt = DATATBLS_GetMagicAffixTxtRecord113c(m, wAutoId) >>> 0
                if (pAutoTxt !== 0) {
                  ITEMS_ApplyItemQualityMods113c(m, 0, 0, pItem, pAutoTxt, 0, 0)
                }
              }
            }
          }
        }
      }
    }
    if (guid === newItemGuid) break
  }
}

/**
 * `@va D2Game:0x6FC96270` (`MONSTER_StartDeath`, `768B`, `DT = 0`):
 * Canonical monster death sequence across `MonsterSliceWorldLike113c` and `Memory113c`.
 */
export function MONSTER_StartDeath113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4 = false,
  dllAbi = false,
  skipKillAward = false,
): void | number {
  hitD2GameVa113c(0x6FC96270)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const pKiller = arg2
    const { m, pGame } = world
    const syncRoomFlags = world.hasFullDrlg !== undefined
    const prevMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    if (!skipKillAward && prevMode !== 1) {
      MONSTER_SavePrevMode113c(m, pMonster, prevMode)
    }

    const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
    if (pAiCtrl !== 0) {
      m.set(pAiCtrl, D2AiControlStrc.dwPathTypeOverride, 0)
      m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 0)
      m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, 0)
      m.setU32((pAiCtrl + 0x10) >>> 0, 0)
      m.setU32((pAiCtrl + 0x14) >>> 0, 0xffffffff)
    }
    if (pGame !== 0) {
      m.set(
        pGame,
        D2GameStrc.dwMonSpawnCount,
        (m.get(pGame, D2GameStrc.dwMonSpawnCount, 0) + 1) >>> 0,
        0,
      )
    }
    if (!skipKillAward && pGame !== 0 && isSgptDataTablesLoaded113c(m)) {
      MONSTER_ApplyElementalDamageAndResistStats113c(m, pGame, pMonster, 0)
      MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 0)
    }
    SUNITDMG_FreeAttackerCombatList113c(m, pMonster, pGame)

    if (syncRoomFlags) {
      UNITROOM_RefreshUnit113c(m, pMonster)
    }
    const modeBits = syncRoomFlags ? (UNITFLAG_MODE_CHANGED_TICK_K2 | 0x01) : UNITFLAG_MODE_CHANGED_TICK_K2
    const nextFlags = ((m.get(pMonster, D2UnitStrc.dwFlags) & ~0x800c) | modeBits) >>> 0
    const nextFlags2 = (m.get(pMonster, D2UnitStrc.dwFlags2) | UNITFLAG2_CORPSE_SELECTABLE_K2) >>> 0
    m.set(pMonster, D2UnitStrc.dwFlags, nextFlags)
    m.set(pMonster, D2UnitStrc.dwFlags2, nextFlags2)

    const row = getMonStatsRowStrictK2(m, pMonster)
    const pKillerPlayer = pKiller !== 0 ? SUNITDMG_ResolveAttackerPlayer113c(m, pGame, pKiller) : 0
    if (!skipKillAward && row.killable && pKiller !== 0 && m.get(pKiller, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
      const plrId = m.get(pKiller, D2UnitStrc.dwUnitId) >>> 0
      if (world.playerKillsById !== undefined && world.dirtyKillPlayerIds !== undefined) {
        const prevKills = world.playerKillsById.get(plrId)
        const nextKills = (((prevKills !== undefined ? prevKills : 0) + 1) & 0xffff) >>> 0
        world.playerKillsById.set(plrId, nextKills)
        world.dirtyKillPlayerIds.add(plrId)
      }
    }

    MONSTER_SetDeathPathAndAnim113c(world, pMonster, pKiller, nextFlags, nextFlags2, skipKillAward)

    const animHydrated = hasHydratedAnimDataTableK2(m)
    const dtFrames = getMonsterModeBaseFrameCountPure113c(row.hcIdx, 0)
    const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
    if (animHydrated) {
      UNITS_SetUnitAnimMode113c(m, pMonster, 0, 0)
      UNITS_UpdateAnimFrame113c(m, pMonster)
    } else {
      writeUnitAnimStateK2(m, pMonster, 0, frame << 8, dtFrames << 8, 256, 0)
    }

    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    const pRoom = pPath !== 0 ? m.get(pPath, D2DynamicPathStrc.pRoom) : 0
    ROOM_RecordMonsterDeath113c(m, pRoom, m.get(pMonster, D2UnitStrc.dwUnitId))

    promotePackLeaderOnDeath113c(world, pMonster)
    const effKiller = pKillerPlayer !== 0 ? pKillerPlayer : pKiller
    if (pGame !== 0 && isSgptDataTablesLoaded113c(m)) {
      if (row.killable) {
        const prevDropGuid = m.u32((pGame + 0xa0) >>> 0) >>> 0
        world.onMonsterDropItems?.(world, pMonster, effKiller)
        const nextDropGuid = m.u32((pGame + 0xa0) >>> 0) >>> 0
        applyMissingNormalInferiorAutoAffixInRange113c(m, pGame, prevDropGuid, nextDropGuid)
      }
    } else if (
      row.killable &&
      (m.get(pMonster, D2UnitStrc.dwFlags) & 0x20000) === 0 &&
      !world.hasFullDrlg
    ) {
      rollMonsterDeathDropSeedOnlyK2(world, pMonster, row)
    }
    if (pGame !== 0 && isSgptDataTablesLoaded113c(m)) {
      const cid = m.u32((pMonster + 0x04) >>> 0) | 0
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
      const nCount = pTables !== 0 ? (m.u32((pTables + 0xa80) >>> 0) | 0) : 0
      const pMonBase = pTables !== 0 ? (m.u32((pTables + 0xa78) >>> 0) >>> 0) : 0
      const pMonStats = cid >= 0 && cid < nCount && pMonBase !== 0 ? ((pMonBase + Math.imul(cid, 0x1a8)) >>> 0) : 0
      const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
      const mask4 = pBitMasks !== 0 ? m.u32((pBitMasks + 0x10) >>> 0) : 0x10
      if (pMonStats !== 0 && (m.u8((pMonStats + 0x0e) >>> 0) & mask4) !== 0) {
        const monType = m.u32(pMonster) | 0
        let baseId = cid
        if (monType === 1) {
          baseId = (m.u16((pMonStats + 0x02) >>> 0) << 16) >> 16
        }
        if (baseId >= 0 && baseId < nCount) {
          if (baseId === 0x1b9) {
            MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c(m, pMonster, pGame)
          } else if (baseId !== 0xd4) {
            MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c(m, pMonster, pGame)
          } else {
            const pPathD = m.u32((pMonster + 0x2c) >>> 0) >>> 0
            const posX =
              monType === 2 || (monType > 3 && monType <= 5)
                ? (m.u32((pPathD + 0x0c) >>> 0) | 0)
                : pPathD !== 0
                  ? (PATH_GetPosX113c(m, pPathD) | 0)
                  : 0
            const posY =
              monType === 2 || (monType > 3 && monType <= 5)
                ? (m.u32((pPathD + 0x10) >>> 0) | 0)
                : pPathD !== 0
                  ? (PATH_GetPosY113c(m, pPathD) | 0)
                  : 0
            const pMissile =
              SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
                m,
                pGame,
                0x75,
                pMonster,
                0,
                1,
                0,
                0,
                posX,
                posY,
                1,
              ) >>> 0
            if (pMissile !== 0) {
              const diff = m.u8((pGame + 0x6d) >>> 0)
              const pMonLvl = DATATBLS_GetMonLvlTxtRecord113c(m, diff) >>> 0
              if (pMonLvl !== 0) {
                const savedSp = k2RealStackPtr
                const pOut = savedSp >>> 0
                const pDmg = (savedSp + 0x38) >>> 0
                k2RealStackPtr = (savedSp + 0xa8) >>> 0
                try {
                  m.fill(pOut, 0x38, 0)
                  const monLvl = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
                  DATATBLS_CalculateMonsterStatsByLevel113c(
                    m,
                    cid,
                    m.u32((pGame + 0x74) >>> 0),
                    diff,
                    monLvl,
                    1,
                    pOut,
                  )
                  const esi = mulDiv113c(
                    m.u32((pMonLvl + 0x3c) >>> 0) | 0,
                    m.u32((pOut + 0x04) >>> 0) | 0,
                    100,
                  ) | 0
                  let ebp = 0
                  if (esi <= 0x100000) {
                    ebp = Math.trunc((esi * 60) / 100) | 0
                  } else if (((esi & 0xfffffff0) | 0) < 0x640) {
                    ebp = Number((BigInt(esi) * 60n) / 100n) | 0
                  } else {
                    ebp = Math.imul(Math.trunc(esi / 100), 60) | 0
                  }
                  const roll = SEED_RollLimitedFast113c(m, (pMonster + 0x20) >>> 0, (esi - ebp) | 0) | 0
                  const dmg = ((roll + ebp) << 7) | 0
                  m.fill(pDmg, 0x70, 0)
                  m.setU32((pDmg + 0x08) >>> 0, dmg >>> 0)
                  SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(
                    m,
                    pGame,
                    pMissile,
                    posX,
                    posY,
                    5,
                    pDmg,
                    0,
                    0,
                    0,
                    0x581,
                  )
                } finally {
                  k2RealStackPtr = savedSp
                }
              }
            }
          }
        }
      }
    }
    if (pGame !== 0 && isSgptDataTablesLoaded113c(m)) {
      MONSTER_DispatchMinionComponentCallbacks113c(m, pGame, pMonster, 0, 1)
    }
    SKILLS_SetUsedSkill113c(m, pMonster, 0)

    MONSTER_ClearModeEvents113c(m, pGame, pMonster)
    if (syncRoomFlags) {
      MONSTER_DeleteAiAndRegenEvents113c(m, pGame, pMonster)
    } else {
      EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
    }
    if (animHydrated) {
      scheduleUnitModeAnimEventsFromMemK2(
        m,
        pGame,
        pMonster,
        MON_EVENT_MODE_STEP,
        MON_EVENT_MODE_END,
      )
    } else {
      EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_MODE_END, (frame + dtFrames) >>> 0, 0, 0, 0)
    }

    if (!skipKillAward) {
      MONSTER_ExecuteEventsWrapper113c(m, pGame, pKiller, pMonster, 0, () => {
        if (world.onMonsterAwardKillExp !== undefined) {
          world.onMonsterAwardKillExp(world, pMonster, pKiller, row)
        } else {
          awardMonsterKillExperienceK2(m, pGame, pMonster, effKiller, row)
        }
      })
    }
    return
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  const pKiller = arg3
  const allocateLootUnitInMem = arg4
  if (dllAbi) {
    const game = pGame >>> 0
    const pModeChange = pMonster >>> 0
    const mon = pModeChange !== 0 ? (m.u32((pModeChange + 0x04) >>> 0) >>> 0) : 0
    SUNITDMG_FreeAttackerCombatList113c(m, mon, game)
    UNITS_ChangeAnimMode113c(m, mon, 0)
    MONSTER_SetDeathPathAndAnim113c(m, game, mon, m.u8((pModeChange + 0x14) >>> 0))
    const prevDropGuidDll = game !== 0 ? (m.u32((game + 0xa0) >>> 0) >>> 0) : 0
    MONSTER_DropDeathItems_6FC95900_113c(m, game, mon, m.u32((pModeChange + 0x08) >>> 0) >>> 0)
    const nextDropGuidDll = game !== 0 ? (m.u32((game + 0xa0) >>> 0) >>> 0) : 0
    applyMissingNormalInferiorAutoAffixInRange113c(m, game, prevDropGuidDll, nextDropGuidDll)
    const monType = mon !== 0 ? (m.u32(mon) | 0) : 0
    const pMonDataD = mon !== 0 ? (m.u32((mon + 0x14) >>> 0) >>> 0) : 0
    if (mon === 0 || monType !== 1 || pMonDataD === 0 || (m.u8((pMonDataD + 0x5c) >>> 0) & 2) === 0) {
      const lvlIdD = mon !== 0 && monType === 1 && pMonDataD !== 0 ? (m.u32((pMonDataD + 0x58) >>> 0) >>> 0) : 0
      const pMonRegD = m.u32((game + 0xf0 + (lvlIdD << 2)) >>> 0) >>> 0
      if (UNIT_GetAlignment113c(m, mon) === 0 && pMonRegD !== 0) {
        m.setU32((pMonRegD + 0x2d0) >>> 0, (m.u32((pMonRegD + 0x2d0) >>> 0) + 1) >>> 0)
      }
    }
    const unitIdD = mon !== 0 ? (m.u32((mon + 0x0c) >>> 0) >>> 0) : 0xffffffff
    ROOM_RecordMonsterDeath113c(m, UNITS_GetRoom113c(m, mon) >>> 0, unitIdD)
    if (mon !== 0) {
      const cid = m.u32((mon + 0x04) >>> 0) | 0
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
      const nCount = pTables !== 0 ? (m.u32((pTables + 0xa80) >>> 0) | 0) : 0
      const pMonBase = pTables !== 0 ? (m.u32((pTables + 0xa78) >>> 0) >>> 0) : 0
      const pMonStats = cid >= 0 && cid < nCount && pMonBase !== 0 ? ((pMonBase + Math.imul(cid, 0x1a8)) >>> 0) : 0
      const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
      const mask4 = pBitMasks !== 0 ? m.u32((pBitMasks + 0x10) >>> 0) : 0x10
      if (pMonStats !== 0 && (m.u8((pMonStats + 0x0e) >>> 0) & mask4) !== 0) {
        let baseId = cid
        if (monType === 1) {
          baseId = (m.u16((pMonStats + 0x02) >>> 0) << 16) >> 16
        }
        if (baseId >= 0 && baseId < nCount) {
          if (baseId === 0x1b9) {
            MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c(m, mon, game)
            return 1
          }
          if (baseId !== 0xd4) {
            MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c(m, mon, game)
            return 1
          }
          const pPathD = m.u32((mon + 0x2c) >>> 0) >>> 0
          const posX =
            monType === 2 || (monType > 3 && monType <= 5)
              ? (m.u32((pPathD + 0x0c) >>> 0) | 0)
              : pPathD !== 0
                ? (PATH_GetPosX113c(m, pPathD) | 0)
                : 0
          const posY =
            monType === 2 || (monType > 3 && monType <= 5)
              ? (m.u32((pPathD + 0x10) >>> 0) | 0)
              : pPathD !== 0
                ? (PATH_GetPosY113c(m, pPathD) | 0)
                : 0
          const pMissile =
            SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
              m,
              game,
              0x75,
              mon,
              0,
              1,
              0,
              0,
              posX,
              posY,
              1,
            ) >>> 0
          if (pMissile !== 0) {
            const diff = m.u8((game + 0x6d) >>> 0)
            const pMonLvl = DATATBLS_GetMonLvlTxtRecord113c(m, diff) >>> 0
            if (pMonLvl !== 0) {
              const savedSp = k2RealStackPtr
              const pOut = savedSp >>> 0
              const pDmg = (savedSp + 0x38) >>> 0
              k2RealStackPtr = (savedSp + 0xa8) >>> 0
              try {
                m.fill(pOut, 0x38, 0)
                const monLvl = STATLIST_GetUnitStat113c(m, mon, 0x0c, 0) | 0
                DATATBLS_CalculateMonsterStatsByLevel113c(
                  m,
                  cid,
                  m.u32((game + 0x74) >>> 0),
                  diff,
                  monLvl,
                  1,
                  pOut,
                )
                const esi = mulDiv113c(
                  m.u32((pMonLvl + 0x3c) >>> 0) | 0,
                  m.u32((pOut + 0x04) >>> 0) | 0,
                  100,
                ) | 0
                let ebp = 0
                if (esi <= 0x100000) {
                  ebp = Math.trunc((esi * 60) / 100) | 0
                } else if (((esi & 0xfffffff0) | 0) < 0x640) {
                  ebp = Number((BigInt(esi) * 60n) / 100n) | 0
                } else {
                  ebp = Math.imul(Math.trunc(esi / 100), 60) | 0
                }
                const roll = SEED_RollLimitedFast113c(m, (mon + 0x20) >>> 0, (esi - ebp) | 0) | 0
                const dmg = ((roll + ebp) << 7) | 0
                m.fill(pDmg, 0x70, 0)
                m.setU32((pDmg + 0x08) >>> 0, dmg >>> 0)
                SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c(
                  m,
                  game,
                  pMissile,
                  posX,
                  posY,
                  5,
                  pDmg,
                  0,
                  0,
                  0,
                  0x581,
                )
              } finally {
                k2RealStackPtr = savedSp
              }
            }
          }
        }
      }
    }
    return 1
  }
  if (pGame === 0 || pMonster === 0) return 0
  const curMode = m.get(pMonster, D2UnitStrc.dwAnimMode) | 0
  if (curMode === 12) return 0

  STATLIST_SetUnitStat113c(m, pMonster, 6, 0, 0)
  MONSTER_SetDeathPathAndAnim113c(m, pGame, pMonster, pKiller)
  EVENT_DeleteEventByType113c(m, pGame, pMonster, MON_EVENT_AI_THINK)
  EVENT_DeleteEventByType113c(m, pGame, pMonster, 3)

  const shattered =
    STATES_CheckState113c(m, pMonster, 1) !== 0 ||
    STATES_CheckState113c(m, pMonster, 107) !== 0

  const pRoom = UNITS_GetRoom113c(m, pMonster)
  if (pRoom !== 0) {
    ROOM_RecordMonsterDeath113c(m, pRoom, m.get(pMonster, D2UnitStrc.dwUnitId))
  }

  const hcIdx = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  if (hcIdx >= 0 && hcIdx <= 4 && pKiller !== 0) {
    const cmdNode = AIGENERAL_CopyAiCommandParams113c(m, pMonster, 2, m.get(pKiller, D2UnitStrc.dwUnitId) | 0, 20, 0, 0)
    if (cmdNode !== 0) {
      AIGENERAL_BroadcastCmdToMinions113c(m, pMonster, pGame, cmdNode)
    }
  }

  const realKiller = pKiller !== 0 ? SUNITDMG_ResolveAttackerPlayer113c(m, pGame, pKiller) : 0
  const kPlr = realKiller !== 0 ? realKiller : pKiller
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    if (m.u32((pClient + 0x04) >>> 0) === 4) {
      S2C_SendPacket69_NpcState113c(m, pClient, pMonster, shattered ? 0x09 : 0x08, 0)
      if (kPlr !== 0 && m.u32(kPlr) === UNIT_PLAYER) {
        S2C_SendPacket65_PlayerKillCount113c(m, pClient, m.get(kPlr, D2UnitStrc.dwUnitId) >>> 0, 1)
      }
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
  }

  if (shattered) {
    EVENT_DeleteEventByType113c(m, pGame, pMonster, MON_EVENT_MODE_END)
    m.set(pMonster, D2UnitStrc.dwFlags, (m.get(pMonster, D2UnitStrc.dwFlags) | 0x10000) >>> 0)
  }

  const dropHook = getK2MonsterDropLootHook113c()
  if (dropHook !== undefined) {
    dropHook(m, pGame, pMonster, kPlr, allocateLootUnitInMem)
  }
  return 1
}

/**
 * `@va D2Game:0x6FC96BF0` (`MONSTER_EndToAiOrNeutral`, `809B`):
 * For `0x6FD2F14C[mode] == 1` (`WL = 2`, `RN = 15`), sets `dwAnimMode = 1` (`NU`), checks `STATE_FREEZE (1)`,
 * and runs `AI_DispatchTargetByAiFlag113c` inline; otherwise transitions to `MONSTER_StartMode113c(..., 1)`.
 */
export function MONSTER_EndToAiOrNeutral113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2 = 0,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FC96BF0)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const { m, pGame } = world
    const syncRoomFlags = world.hasFullDrlg !== undefined
    const prevMode = m.get(pMonster, D2UnitStrc.dwAnimMode) >>> 0
    let isSpecialInline = false
    if (isSgptDataTablesLoaded113c(m) && pMonster !== 0 && (m.u32(pMonster) | 0) === 1) {
      const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
      const nCount = pTables !== 0 ? (m.u32((pTables + 0xa80) >>> 0) | 0) : 0
      const pMonBase = pTables !== 0 ? (m.u32((pTables + 0xa78) >>> 0) >>> 0) : 0
      const cid = m.u32((pMonster + 0x04) >>> 0) | 0
      let candId = cid
      if (cid >= 0 && cid < nCount && pMonBase !== 0) {
        const pCidStats = (pMonBase + Math.imul(cid, 0x1a8)) >>> 0
        candId = (m.u16((pCidStats + 0x02) >>> 0) << 16) >> 16
      }
      if (candId >= 0 && candId < nCount && pMonBase !== 0) {
        const pBaseStats = (pMonBase + Math.imul(candId, 0x1a8)) >>> 0
        const inlineAiBit = m.u8((pBaseStats + 0x1a6) >>> 0)
        isSpecialInline =
          inlineAiBit !== 0 &&
          ((candId === 0x6e && prevMode === 8) ||
            (candId === 0xf7 && prevMode === 0x0e) ||
            (candId === 0x88 && (prevMode === 0x0a || prevMode === 0x0b)) ||
            candId === 0xe6 ||
            candId === 0xe7 ||
            (candId === 0x76 && prevMode === 2) ||
            candId === 0x193)
      }
    }
    const inlineAiFlag =
      !isSpecialInline && prevMode < MONSTER_INLINE_AI_ON_END_TABLE_113C.length
        ? MONSTER_INLINE_AI_ON_END_TABLE_113C[prevMode]
        : 0
    if (isSpecialInline || inlineAiFlag !== 0) {
      if (!isSpecialInline) {
        m.set(pMonster, D2UnitStrc.dwAnimMode, 1)
        expireHireableModeStateListsK2(m, pMonster, prevMode, 1)
        if (syncRoomFlags) {
          UNITROOM_RefreshUnit113c(m, pMonster)
          const nextFlags = (m.get(pMonster, D2UnitStrc.dwFlags) | 0x01) >>> 0
          m.set(pMonster, D2UnitStrc.dwFlags, nextFlags)
          if (prevMode !== 1 && !isHireableMonsterK2(m, pMonster)) {
            STATLIST_ExpireStateListsOnModeChange113c(m, pMonster, 0)
            if (hasHydratedAnimDataTableK2(m)) {
              UNITS_UpdateAnimFrame113c(m, pMonster)
            }
          }
          const pu = world.pathUnitByPtr.get(pMonster)
          if (pu !== undefined) {
            pu.dwAnimMode = 1
            pu.dwFlags = nextFlags
          }
        } else {
          const pu = world.pathUnitByPtr.get(pMonster)
          if (pu !== undefined) pu.dwAnimMode = 1
        }
      }
      if (STATES_CheckState113c(m, pMonster, 1) !== 0 && SUNIT_IsDeadOrDying113c(m, pMonster) === 0) {
        return
      }
      const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
      const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
      const pfnThink = pAiGen !== 0 ? m.get(pAiGen, D2AiGeneralStrc.pfnThink) : 0
      if (pfnThink !== 0) {
        AI_DispatchTargetByAiFlag113c(world, pMonster, pfnThink)
      }
      return
    }

    if (STATES_CheckState113c(m, pMonster, 0x36) !== 0) {
      MONSTER_RefreshAiEvent113c(m, pMonster, 0)
      if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) {
        return
      }
    }

    SKILLS_SetUsedSkill113c(m, pMonster, 0)
    if (pGame !== 0) {
      SUNIT_ValidatePathTargetUnit113c(m, pMonster, pGame)
    }
    const pPathEnd = pMonster !== 0 ? m.get(pMonster, D2UnitStrc.pPath) : 0
    const rawTargetEnd = pPathEnd !== 0 ? (PATH_GetTargetUnit113c(m, pPathEnd) >>> 0) : 0
    const nextTargetEnd = rawTargetEnd === (pMonster >>> 0) ? 0 : rawTargetEnd
    const prevPtOvEnd = pendingBridgePathTypeOverrideK2
    pendingBridgePathTypeOverrideK2 = 0x64
    try {
      MONSTER_StartMode113c(world, pMonster, 1, nextTargetEnd, 0, 0)
    } finally {
      pendingBridgePathTypeOverrideK2 = prevPtOvEnd
    }
    return
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  if (dllAbi) {
    const game = pGame >>> 0
    const mon = pMonster >>> 0
    let mode = 0
    let baseId = -1
    let pBaseStats = 0
    const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C)) >>> 0
    const nCount = pTables !== 0 ? (m.u32((pTables + 0xa80) >>> 0) | 0) : 0
    const pMonBase = pTables !== 0 ? (m.u32((pTables + 0xa78) >>> 0) >>> 0) : 0
    if (mon !== 0 && (m.u32(mon) | 0) === 1) {
      mode = m.u32((mon + 0x10) >>> 0) | 0
      const cid = m.u32((mon + 0x04) >>> 0) | 0
      let candId = cid
      if (cid >= 0 && cid < nCount && pMonBase !== 0) {
        const pCidStats = (pMonBase + Math.imul(cid, 0x1a8)) >>> 0
        if (pCidStats !== 0) {
          candId = (m.u16((pCidStats + 0x02) >>> 0) << 16) >> 16
        }
      }
      if (candId >= 0 && candId < nCount && pMonBase !== 0) {
        baseId = candId
        pBaseStats = (pMonBase + Math.imul(baseId, 0x1a8)) >>> 0
      }
    }
    const inlineAiBit = pBaseStats !== 0 ? m.u8((pBaseStats + 0x1a6) >>> 0) : 0
    const isSpecialInline =
      inlineAiBit !== 0 &&
      ((baseId === 0x6e && mode === 8) ||
        (baseId === 0xf7 && mode === 0x0e) ||
        (baseId === 0x88 && (mode === 0x0a || mode === 0x0b)) ||
        baseId === 0xe6 ||
        baseId === 0xe7 ||
        (baseId === 0x76 && mode === 2) ||
        baseId === 0x193)
    const tableInline =
      !isSpecialInline &&
      mode >= 0 &&
      mode < MONSTER_INLINE_AI_ON_END_TABLE_113C.length &&
      MONSTER_INLINE_AI_ON_END_TABLE_113C[mode] !== 0
    if (isSpecialInline || tableInline) {
      if (tableInline) {
        UNITS_ChangeAnimMode113c(m, mon, 1)
      }
      if (STATES_CheckState113c(m, mon, 1) !== 0 && SUNIT_IsDeadOrDying113c(m, mon) === 0) {
        return
      }
      if (m.u32(0x6fd1bc1c) !== 0) {
        AI_RunMonsterAI113c(m, game, mon, 0, 0)
      }
      return
    }
    if (STATES_CheckState113c(m, mon, 0x36) !== 0) {
      MONSTER_RefreshAiEvent113c(m, mon, 0)
      if (SUNIT_IsDeadOrDying113c(m, mon) !== 0) {
        return
      }
    }
    SKILLS_SetUsedSkill113c(m, mon, 0)
    const pMc = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
    monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
    try {
      m.fill(pMc, 0x20, 0)
      m.setU32(pMc, 1)
      m.setU32((pMc + 0x04) >>> 0, mon)
      m.setU8((pMc + 0x15) >>> 0, 0x64)
      SUNIT_ValidatePathTargetUnit113c(m, mon, game)
      const pPath = mon !== 0 ? (m.u32((mon + 0x2c) >>> 0) >>> 0) : 0
      const rawTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
      m.setU32((pMc + 0x08) >>> 0, rawTarget === mon ? 0 : rawTarget)
      MONSTER_StartMode113c(m, game, pMc, 1, 0, 0, 0, 0, 1, true)
    } finally {
      monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
    }
    return
  }
  if (pGame === 0 || pMonster === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return
  const endedMode = m.get(pMonster, D2UnitStrc.dwAnimMode) | 0
  if (endedMode === 0) {
    MONSTER_EndDeath113c(m, pGame, pMonster)
    return
  }

  MONSTER_StartMode113c(m, pGame, pMonster, 1, 0, 0, 0)
  if (STATES_CheckState113c(m, pMonster, 1) !== 0) return

  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const inlineAi =
    endedMode >= 0 &&
    endedMode < MONSTER_INLINE_AI_ON_END_TABLE_113C.length &&
    MONSTER_INLINE_AI_ON_END_TABLE_113C[endedMode] !== 0
  if (inlineAi) {
    EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_AI_THINK, (curFrame + 1) >>> 0, 0, 0, 0)
    return
  }

  const hcIdx = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const monRow = getMonStatsRowByClassId113c(hcIdx)
  const diff = getEffectiveDiffK2(m, pGame)
  let delay = 15
  if (monRow) {
    delay = monRow.aidel[diff]!
  }
  if (delay < 1) delay = 1
  EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_AI_THINK, (curFrame + (delay >>> 0)) >>> 0, 0, 0, 0)
}

export function notifyNewlyEnteredRoomClientsK2(
  world: MonsterSliceWorldLike113c,
  pUnit: number,
): void {
  const onEnter = world.onUnitEnteredClientRoom
  if (onEnter === undefined || pUnit === 0 || world.pGame === 0) return
  const { m, pGame } = world
  const pCurRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
  const pPrevRoom = SUNIT_FindValidNextRoomInAct113c(m, pUnit, pGame) >>> 0
  if (pCurRoom === 0 || pCurRoom === pPrevRoom) return
  const curClients = m.u32((pCurRoom + 0x48) >>> 0) >>> 0
  const curCount = m.u32((pCurRoom + 0x78) >>> 0) >>> 0
  if (curClients === 0 || curCount === 0) return
  const prevClients = pPrevRoom !== 0 ? (m.u32((pPrevRoom + 0x48) >>> 0) >>> 0) : 0
  const prevCount = pPrevRoom !== 0 ? (m.u32((pPrevRoom + 0x78) >>> 0) >>> 0) : 0
  const prevSet = new Set<number>()
  if (prevClients !== 0) {
    for (let i = 0; i < prevCount; i++) {
      const pc = m.u32((prevClients + i * 4) >>> 0) >>> 0
      if (pc !== 0) prevSet.add(pc)
    }
  }
  for (let i = 0; i < curCount; i++) {
    const pClient = m.u32((curClients + i * 4) >>> 0) >>> 0
    if (pClient === 0 || prevSet.has(pClient)) continue
    const pClientPlr = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
    if (pClientPlr !== (pUnit >>> 0) && m.u32((pClient + 0x04) >>> 0) === 4) {
      onEnter(m, pGame, pUnit, pClient)
    }
  }
}

/**
 * `@va D2Game:0x6FD01930` (`MONSTER_StepPath`, `91B`):
 * Steps `pMonster->pPath` via `PATH_Step113c`.
 */
export function MONSTER_StepPath113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2 = 0,
  dllAbi = false,
): number {
  hitD2GameVa113c(0x6FD01930)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const { m } = world
    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    if (pPath === 0) return 0
    ensureSliceWorldPathMemoryK2(world)
    const prevRoom = m.u32((pPath + 0x1c) >>> 0) >>> 0
    const stepped = PATH_Step113c(m, pMonster, 0x400)
    if (world.hasFullDrlg === true && world.pGame !== 0 && UNITS_GetPathRoomRefreshFlag113c(m, pMonster) !== 0) {
      notifyNewlyEnteredRoomClientsK2(world, pMonster)
      SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pMonster, world.pGame)
    } else if (
      world.hasFullDrlg !== true &&
      (m.u32((pPath + 0x1c) >>> 0) >>> 0) !== prevRoom &&
      (m.u32(pMonster >>> 0) | 0) === UNIT_MONSTER
    ) {
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU32((pMonData + 0x50) >>> 0, 0)
      }
    }
    return stepped
  }

  const m = arg0
  if (dllAbi) {
    const pMonster = arg1 >>> 0
    const pGame = arg2 >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('AiUtil.cpp', 0x72f)
    }
    SUNIT_ValidatePathTargetUnit113c(m, pMonster, pGame)
    const res = PATH_Step113c(m, pMonster, 0x400) !== 0 ? 1 : 2
    if (UNITS_GetPathRoomRefreshFlag113c(m, pMonster) !== 0) {
      SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pMonster, pGame)
    }
    return res
  }
  const pGame = arg1
  const pMonster = arg2
  if (pGame === 0 || pMonster === 0) return 0
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return 0
  if (STATES_CheckState113c(m, pMonster, 1) !== 0) return 0
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  if (pPath === 0) return 0

  const res = PATH_Step113c(m, pMonster, 1) | 0
  UNITROOM_RefreshUnit113c(m, pMonster)
  if (res === 0) {
    MONSTER_EndToAiOrNeutral113c(m, pGame, pMonster)
    return 0
  }
  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_MODE_STEP, (curFrame + 1) >>> 0, 0, 0, 0)
  return 1
}

/**
 * `@va D2Game:0x6FC97010` (`MONSTER_StepWalk`, `79B`):
 * Checks `STATE_BLAZE (0x0D)` / `STATE_INFERNO (0x16)`, steps path via `0x6FD01930` (`MONSTER_StepPath113c`),
 * and transitions via `0x6FC96BF0` (`MONSTER_EndToAiOrNeutral113c`) when the path completes.
 */
export function MONSTER_StepWalk113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2 = 0,
  dllAbi = false,
): void | number {
  hitD2GameVa113c(0x6FC97010)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const { m } = world
    const hasBlazeOrInferno =
      STATES_CheckState113c(m, pMonster, 0x0d) !== 0 ||
      STATES_CheckState113c(m, pMonster, 0x16) !== 0
    if (hasBlazeOrInferno) {
      m.set(pMonster, D2UnitStrc.dwFlags, (m.get(pMonster, D2UnitStrc.dwFlags) | 1) >>> 0)
    }
    if (MONSTER_StepPath113c(world, pMonster) === 0) {
      MONSTER_EndToAiOrNeutral113c(world, pMonster)
    }
    return
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  if (dllAbi) {
    const game = pGame >>> 0
    const mon = pMonster >>> 0
    if (STATES_CheckState113c(m, mon, 0x0d) !== 0) {
      SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c(m, mon, game)
    }
    if (STATES_CheckState113c(m, mon, 0x16) !== 0) {
      SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c(m, mon, game)
    }
    const stepRes = MONSTER_StepPath113c(m, mon, game, true)
    if (stepRes === 2) {
      MONSTER_EndToAiOrNeutral113c(m, game, mon, true)
      return 2
    }
    return 1
  }
  if (pMonster !== 0) {
    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    if (pPath !== 0) {
      PATH_SetVelocity113c(m, pPath, computeMonsterMoveVelocityK2(m, pMonster, 2))
    }
  }
  return MONSTER_StepPath113c(m, pGame, pMonster)
}

/**
 * `@va D2Game:0x6FC96FE0` (`MONSTER_StepRun`, `43B`):
 * Steps path via `0x6FD01930` (`MONSTER_StepPath113c`), checks `STATE_BLAZE (0x0D)`,
 * and transitions via `0x6FC96BF0` (`MONSTER_EndToAiOrNeutral113c`) when the path completes.
 */
export function MONSTER_StepRun113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2 = 0,
  dllAbi = false,
): void | number {
  hitD2GameVa113c(0x6FC96FE0)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const { m } = world
    const stepped = MONSTER_StepPath113c(world, pMonster)
    if (STATES_CheckState113c(m, pMonster, 0x0d) !== 0) {
      m.set(pMonster, D2UnitStrc.dwFlags, (m.get(pMonster, D2UnitStrc.dwFlags) | 1) >>> 0)
    }
    if (stepped === 0) {
      MONSTER_EndToAiOrNeutral113c(world, pMonster)
    }
    return
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  if (dllAbi) {
    const game = pGame >>> 0
    const mon = pMonster >>> 0
    const stepRes = MONSTER_StepPath113c(m, mon, game, true)
    if (stepRes === 2) {
      MONSTER_EndToAiOrNeutral113c(m, game, mon, true)
      return 2
    }
    return 1
  }
  if (pMonster !== 0) {
    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    if (pPath !== 0) {
      PATH_SetVelocity113c(m, pPath, computeMonsterMoveVelocityK2(m, pMonster, 15))
    }
  }
  return MONSTER_StepPath113c(m, pGame, pMonster)
}

function drainRunStaminaK2(m: Memory113c, pPlayer: number): void {
  if (pPlayer === 0 || m.u32(pPlayer) !== UNIT_PLAYER) return
  if ((m.get(pPlayer, D2UnitStrc.dwAnimMode) | 0) !== 3) return
  const pRoom = UNITS_GetRoom113c(m, pPlayer)
  if (pRoom !== 0 && DUNGEON_IsTownLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom))) {
    return
  }
  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const runDrain = getCharStatsPure113c(classId).runDrain | 0
  let drain = runDrain * 2
  const slowDrainPct = STATLIST_GetUnitStat113c(m, pPlayer, 154, 0) | 0
  if (slowDrainPct !== 0) {
    drain = mulDiv113c(drain, Math.max(0, 100 - slowDrainPct), 100)
  }
  if (drain < 1) drain = 1
  const curStam = STATLIST_GetUnitStat113c(m, pPlayer, 10, 0) | 0
  const nextStam = curStam > drain ? curStam - drain : 0
  STATLIST_SetUnitStat113c(m, pPlayer, 10, nextStam, 0)
  if (nextStam === 0) {
    UNITS_ChangeAnimMode113c(m, pPlayer, 2)
  }
}

function updateHpRegenK2(m: Memory113c, pPlayer: number): void {
  if (pPlayer === 0 || m.u32(pPlayer) !== UNIT_PLAYER) return
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  const regen = STATLIST_GetUnitStat113c(m, pPlayer, 74, 0) | 0
  if (regen === 0) return
  const curHp = STATLIST_GetUnitStat113c(m, pPlayer, 6, 0) | 0
  const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, pPlayer) | 0
  let nextHp = (curHp + regen) | 0
  if (regen > 0) {
    if (nextHp > maxHp) nextHp = maxHp
  } else {
    // Player poison/regen floor is 1 (`256` fixed-point, or `1` if unshifted)
    const minFloor = maxHp >= 256 ? 256 : 1
    if (nextHp < minFloor) nextHp = curHp < minFloor ? curHp : minFloor
  }
  STATLIST_SetUnitStat113c(m, pPlayer, 6, nextHp, 0)
}

function updateManaRegenK2(m: Memory113c, pPlayer: number): void {
  if (pPlayer === 0 || m.u32(pPlayer) !== UNIT_PLAYER) return
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  const curMana = STATLIST_GetUnitStat113c(m, pPlayer, 8, 0) | 0
  const maxMana = STATLIST_GetUnitStat113c(m, pPlayer, 9, 0) | 0
  if (curMana >= maxMana || maxMana <= 0) return
  let rate = sdiv32(maxMana, 1500)
  if (rate < 1) rate = 1
  const bonusPct = STATLIST_GetUnitStat113c(m, pPlayer, 27, 0) | 0
  if (bonusPct !== 0) {
    rate = mulDiv113c(rate, 100 + bonusPct, 100)
  }
  if (rate > 0) {
    const nextMana = curMana + rate > maxMana ? maxMana : curMana + rate
    STATLIST_SetUnitStat113c(m, pPlayer, 8, nextMana, 0)
  }
}

function updateStaminaRegenK2(m: Memory113c, pPlayer: number): void {
  if (pPlayer === 0 || m.u32(pPlayer) !== UNIT_PLAYER) return
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  const mode = m.get(pPlayer, D2UnitStrc.dwAnimMode) | 0
  if (mode === 3) {
    drainRunStaminaK2(m, pPlayer)
    return
  }
  const curStam = STATLIST_GetUnitStat113c(m, pPlayer, 10, 0) | 0
  const maxStam = STATLIST_GetUnitStat113c(m, pPlayer, 11, 0) | 0
  if (curStam >= maxStam || maxStam <= 0) return

  const pRoom = UNITS_GetRoom113c(m, pPlayer)
  const inTown = pRoom !== 0 && DUNGEON_IsTownLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom))
  if (!inTown && mode !== 1 && mode !== 5 && mode !== 2) return

  let rate = Math.max(1, maxStam >> 8)
  if (mode === 2 && !inTown) rate = Math.max(1, rate >> 1)
  if (inTown) rate = rate << 1
  const bonusPct = STATLIST_GetUnitStat113c(m, pPlayer, 28, 0) | 0
  if (bonusPct !== 0) {
    rate = mulDiv113c(rate, 100 + bonusPct, 100)
  }
  const nextStam = curStam + rate > maxStam ? maxStam : curStam + rate
  STATLIST_SetUnitStat113c(m, pPlayer, 10, nextStam, 0)
}

function playerEvent3RegenTickK2(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  if (pGame === 0 || pPlayer === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  updateHpRegenK2(m, pPlayer)
  updateManaRegenK2(m, pPlayer)
  updateStaminaRegenK2(m, pPlayer)
  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pPlayer, 3, (curFrame + 1) >>> 0, 0, 0, 0)
}

function playerEvent11PeriodicTickK2(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  if (pGame === 0 || pPlayer === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pPlayer, 11, (curFrame + 100) >>> 0, 0, 0, 0)
}

function scheduleSkillModeAnimEventsK2(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  clip: PureCharAnimClip113c,
  startFrame: number,
  stepSpeed: number,
): void {
  if (pGame === 0 || pUnit === 0) return
  const spd = stepSpeed > 0 ? stepSpeed : 256
  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const start256 = (startFrame << 8) | 0
  const end256 = (clip.frames << 8) | 0

  for (let i = 0; i < clip.events.length; i++) {
    const ev = clip.events[i]!
    const target256 = (ev.f << 8) | 0
    const dist256 = target256 > start256 ? target256 - start256 : 0
    const ticks = Math.max(1, Math.ceil(dist256 / spd))
    EVENT_SetEventFull113c(m, pGame, pUnit, 6, (curFrame + ticks) >>> 0, 0, ev.c | 0, 0)
  }

  const totalDist256 = end256 > start256 ? end256 - start256 : 256
  const endTicks = Math.max(1, Math.ceil(totalDist256 / spd))
  EVENT_SetEventFull113c(m, pGame, pUnit, 7, (curFrame + endTicks) >>> 0, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FC987C0` (`PLAYER_StartModeAttackWithTarget`, `117B`):
 * Binds `pTarget` onto `pPlayer->pPath` and starts `PLRMODE_ATTACK1 (7)` / `PLRMODE_ATTACK2 (8)` via `PLAYER_StartModeAttack113c`.
 */
export function PLAYER_StartModeAttackWithTarget113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  mode = 7,
  pTarget = 0,
  weaponClassCode = '1HS',
): number {
  const atkMode = mode === 8 ? 8 : 7
  return PLAYER_StartModeAttack113c(m, pGame, pPlayer, atkMode, pTarget, weaponClassCode)
}

/**
 * `@va D2Game:0x6FD122C0` (`AI_Stall`, `182B`):
 * Clears `pUsedSkill`, transitions `pMonster` into `MONMODE_NEUTRAL (1)` if not already in mode `1`,
 * deletes pending `Event 2` (`arg14 = 0`), and schedules `MON_EVENT_AI_THINK (2)`.
 */
export function AI_Stall113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2: number,
  arg3 = 0,
): void {
  hitD2GameVa113c(0x6FD122C0)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const delayFrames = arg2
    const { m, pGame } = world
    if (pMonster === 0) return
    SKILLS_SetUsedSkill113c(m, pMonster, 0)
    const rawDelay = delayFrames | 0
    const delay = rawDelay === 0 ? 1 : rawDelay
    if (m.get(pMonster, D2UnitStrc.dwAnimMode) !== 1) {
      MONSTER_StartMode113c(world, pMonster, 1, 0, 0, 0)
    }
    EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
    const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
    EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_AI_THINK, (frame + delay) >>> 0, 0, 0, 0)
    return
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  const delayFrames = arg3
  if (pGame === 0 || pMonster === 0) return
  const bridge = KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C.get(m)
  if (bridge !== undefined) {
    bridge.stall(pMonster, delayFrames)
    return
  }
  const rawDelay = delayFrames | 0
  const d = rawDelay === 0 ? 1 : rawDelay
  if ((m.get(pMonster, D2UnitStrc.dwAnimMode) | 0) !== 1) {
    SKILLS_SetUsedSkill113c(m, pMonster, 0)
    MONSTER_StartMode113c(m, pGame, pMonster, 1, pMonster, 0, 0, 0x64)
  }
  EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
  const curFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pMonster, MON_EVENT_AI_THINK, (curFrame + (d >>> 0)) >>> 0, 0, 0, 0)
}

/**
 * `@va D2Game:0x6FD11B10` (`AI_IdleWander`, `282B`):
 * 4 LCG draws on `pMonster->pSeed` (`axisRoll`, `rollUnitLimited(range)`, `signX`, `signY`),
 * walking to `(x0 + dx, y0 + dy)` via `AI_ApproachTarget113c`.
 */
export function AI_IdleWander113c<T extends MonsterSliceWorldLike113c | Memory113c>(
  arg0: T,
  arg1: number,
  arg2 = 8,
  arg3 = 4,
): T extends MonsterSliceWorldLike113c ? boolean : number {
  hitD2GameVa113c(0x6FD11B10)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const range = arg2
    const { m } = world
    const { x: x0, y: y0 } = getUnitPosSubtileK2(m, pMonster)
    const axisRoll = stepUnitSeedObjK2(m, pMonster)
    let dx: number
    let dy: number
    if ((axisRoll.lo & 1) !== 0) {
      dy = rollUnitLimitedObjK2(m, pMonster, range)
      dx = range
    } else {
      dx = rollUnitLimitedObjK2(m, pMonster, range)
      dy = range
    }
    if ((stepUnitSeedObjK2(m, pMonster).lo & 1) !== 0) dx = -dx
    if ((stepUnitSeedObjK2(m, pMonster).lo & 1) !== 0) dy = -dy

    return AI_ApproachTarget113c(world, pMonster, 0, 2, x0 + dx, y0 + dy, 1, 0) as never
  }

  const m = arg0 as Memory113c
  const pGame = arg1
  const pMonster = arg2
  const r = (arg3 | 0) > 0 ? (arg3 | 0) : 8
  if (pGame === 0 || pMonster === 0) return 0 as never
  const bridge = KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C.get(m)
  if (bridge !== undefined) {
    return bridge.idleWander(pMonster, r) as never
  }
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return 0 as never
  const coords = getUnitCoordsK2(m, pMonster)
  const axisRoll = stepUnitSeedObjK2(m, pMonster)
  let dx: number
  let dy: number
  if ((axisRoll.lo & 1) !== 0) {
    dy = rollUnitLimitedObjK2(m, pMonster, r)
    dx = r
  } else {
    dx = rollUnitLimitedObjK2(m, pMonster, r)
    dy = r
  }
  if ((stepUnitSeedObjK2(m, pMonster).lo & 1) !== 0) dx = -dx
  if ((stepUnitSeedObjK2(m, pMonster).lo & 1) !== 0) dy = -dy
  if (dx === 0 && dy === 0) {
    AI_Stall113c(m, pGame, pMonster, 15)
    return 0 as never
  }
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  if (pPath !== 0) {
    PATH_SetStepNum113c(m, pPath, 1)
    PATH_SetType113c(m, pPath, 6)
  }
  if (MONSTER_StartMode113c(m, pGame, pMonster, 2, 0, (coords.x + dx) & 0xffff, (coords.y + dy) & 0xffff) === 0) {
    AI_Stall113c(m, pGame, pMonster, 15)
    return 0 as never
  }
  return 1 as never
}

/**
 * `@va D2Game:0x6FD12540` (`AI_ApproachTarget`, `360B`):
 * Moves `pMonster` toward `pTarget` (or `(targetX, targetY)`) in `MONMODE_WALK (2)` or `MONMODE_RUN (15)`,
 * honoring `STATE_DECREPIFY (60)` downgrade and `flags` (`1` `0x40` AI flag, `2` wander/stall fallback, `4` clear think).
 */
export function AI_ApproachTarget113c<T extends MonsterSliceWorldLike113c | Memory113c>(
  arg0: T,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4 = 2,
  arg5 = 0,
  arg6 = 0,
  arg7 = 12,
  arg8 = 0,
): T extends MonsterSliceWorldLike113c ? boolean : number {
  hitD2GameVa113c(0x6FD12540)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const pTarget = arg2
    const mode = arg3
    const targetX = arg4
    const targetY = arg5
    const stepNum = arg6
    const flags = arg7
    const { m, pGame } = world
    let actualMode = mode
    if (actualMode === 15 && STATES_CheckState113c(m, pMonster, 60) !== 0) {
      const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
      const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
      if (pAiCtrl !== 0) {
        m.set(pAiCtrl, D2AiControlStrc.dwPathTypeOverride, 0)
        m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 0)
        m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, 0)
      }
      actualMode = 2
    }

    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    if (pPath !== 0) {
      PATH_SetStepNum113c(m, pPath, stepNum)
    }

    const ok = MONSTER_StartMode113c(world, pMonster, actualMode, pTarget, targetX, targetY)
    if (!ok) {
      if ((flags & 4) !== 0) {
        EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
      }
      if ((flags & 1) !== 0) {
        const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
        const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
        if (pAiGen !== 0) {
          m.set(pAiGen, D2AiGeneralStrc.dwFlags, (m.get(pAiGen, D2AiGeneralStrc.dwFlags) | 0x40) >>> 0)
        }
      }
      if ((flags & 2) !== 0) {
        const roll = stepUnitSeedObjK2(m, pMonster).lo % 100
        if (roll < 70) {
          AI_IdleWander113c(world, pMonster, 4)
        } else {
          AI_Stall113c(world, pMonster, 10)
        }
      }
    }
    return ok as never
  }

  const m = arg0 as Memory113c
  const pGame = arg1
  const pMonster = arg2
  const pTarget = arg3
  const mode = arg4
  const targetX = arg5
  const targetY = arg6
  const stepNum = arg7
  const flags = arg8
  if (KERNEL_MONSTER_AI_BRIDGE_BY_MEM_113C.has(m) || stepNum <= 1 || hasHydratedAnimDataTableK2(m)) {
    let actualMode = mode | 0
    if (actualMode === 0x0f && (STATES_CheckState113c(m, pMonster >>> 0, 0x3c) | 0) !== 0) {
      let pAiParam = 0
      if (pMonster !== 0 && (m.u32(pMonster >>> 0) | 0) === 1) {
        const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          pAiParam = m.u32((pMonData + 0x2c) >>> 0) >>> 0
        }
      }
      if (pAiParam !== 0) {
        m.setU32((pAiParam + 0x18) >>> 0, 0)
        m.setU32((pAiParam + 0x1c) >>> 0, 0)
        m.setU8((pAiParam + 0x20) >>> 0, 0)
      }
      actualMode = 2
    }
    const pPath0 = pMonster !== 0 ? (m.u32((pMonster + 0x2c) >>> 0) >>> 0) : 0
    if (pPath0 !== 0) {
      PATH_SetStepNum113c(m, pPath0, stepNum | 0)
    }
    if (hasHydratedAnimDataTableK2(m) && pMonster !== 0) {
      SKILLS_SetUsedSkill113c(m, pMonster >>> 0, 0)
    }
    const approachPathType =
      pMonster !== 0 && MONSTER_IsContinuousMode113c(m, pMonster >>> 0, actualMode) ? 0x65 : 0x64
    const res =
      MONSTER_StartMode113c(
        m,
        pGame >>> 0,
        pMonster >>> 0,
        actualMode,
        pTarget >>> 0,
        targetX | 0,
        targetY | 0,
        approachPathType,
      ) | 0
    if (res !== 0) {
      return res as never
    }
    const flagsByte = flags & 0xff
    if ((flagsByte & 4) !== 0 && pMonster !== 0) {
      EVENT_DeleteEventByArg14_113c(m, pGame >>> 0, pMonster >>> 0, MON_EVENT_AI_THINK, 0)
    }
    if ((flagsByte & 1) !== 0 && pMonster !== 0 && (m.u32(pMonster >>> 0) | 0) === 1) {
      const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      const pAiGen = pMonData !== 0 ? (m.u32((pMonData + 0x28) >>> 0) >>> 0) : 0
      if (pAiGen !== 0) {
        m.setU8((pAiGen + 0x08) >>> 0, (m.u8((pAiGen + 0x08) >>> 0) | 0x40) & 0xff)
      }
    }
    if ((flagsByte & 2) !== 0 && pMonster !== 0) {
      const roll = stepUnitSeedObjK2(m, pMonster >>> 0).lo % 100
      if (roll < 0x46) {
        AI_IdleWander113c(m, pGame >>> 0, pMonster >>> 0, 4)
        return 1 as never
      }
      AI_Stall113c(m, pGame >>> 0, pMonster >>> 0, 10)
      return 1 as never
    }
    return res as never
  }
  if (pGame === 0 || pMonster === 0) return 0 as never
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return 0 as never
  const moveMode = mode === 15 ? 15 : 2
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  if (pPath !== 0) {
    PATH_SetStepNum113c(m, pPath, stepNum > 0 ? stepNum : 12)
    PATH_SetType113c(m, pPath, 2)
  }
  if (MONSTER_StartMode113c(m, pGame, pMonster, moveMode, pTarget, targetX, targetY) !== 0) {
    return 1 as never
  }
  if (pPath !== 0) {
    PATH_SetType113c(m, pPath, 15)
    if (MONSTER_StartMode113c(m, pGame, pMonster, moveMode, pTarget, targetX, targetY) !== 0) {
      return 1 as never
    }
  }
  return 0 as never
}

/**
 * `@va D2Game:0x6FD12D80` (`AI_FleeFrom`, `377B`):
 * Computes escape vector away from `pFrom` scaled by `distSteps` subtiles and flees via `AI_ApproachTarget113c`.
 */
export function AI_FleeFrom113c<T extends MonsterSliceWorldLike113c | Memory113c>(
  arg0: T,
  arg1: number,
  arg2: number,
  arg3 = 0,
  arg4: number | boolean = 12,
  arg5 = 0,
): T extends MonsterSliceWorldLike113c ? boolean : number {
  hitD2GameVa113c(0x6FD12D80)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pFrom = arg1
    const pMonster = arg2
    const distSteps = arg3
    const clearThinkOnFail = Boolean(arg4)
    if (pFrom === 0) return false as never
    const { m } = world
    const { x: mx, y: my } = getUnitPosSubtileK2(m, pMonster)
    const { x: fx, y: fy } = getUnitPosSubtileK2(m, pFrom)
    const sx = mx > fx ? 1 : mx < fx ? -1 : 0
    const sy = my > fy ? 1 : my < fy ? -1 : 0
    if (distSteps > 5) {
      const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
      const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
      if (pAiCtrl !== 0) {
        m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, Math.min(distSteps, 0x4d))
      }
    }
    return AI_ApproachTarget113c(
      world,
      pMonster,
      0,
      2,
      mx + distSteps * sx,
      my + distSteps * sy,
      1,
      clearThinkOnFail ? 4 : 0,
    ) as never
  }

  const m = arg0 as Memory113c
  const pGame = arg1
  const pMonster = arg2
  const pFrom = arg3
  const distSteps = Number(arg4) | 0
  const bRun = arg5
  if (hasHydratedAnimDataTableK2(m)) {
    if (pMonster === 0 || pFrom === 0) return 0 as never
    const mPos = getUnitCoordsK2(m, pMonster)
    const fPos = getUnitCoordsK2(m, pFrom)
    const sx = fPos.x > mPos.x ? -1 : fPos.x < mPos.x ? 1 : 0
    const sy = fPos.y > mPos.y ? -1 : fPos.y < mPos.y ? 1 : 0
    const distByte = distSteps & 0xff
    const tx = (mPos.x + Math.imul(distByte, sx)) | 0
    const ty = (mPos.y + Math.imul(distByte, sy)) | 0
    if (distByte > 5) {
      let pAiCtrl = 0
      if ((m.u32(pMonster >>> 0) | 0) === UNIT_MONSTER) {
        const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          pAiCtrl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
        }
      }
      if (pAiCtrl !== 0) {
        m.setU8((pAiCtrl + 0x20) >>> 0, distByte < 0x4e ? distByte : 0x4d)
      }
    }
    return AI_ApproachTarget113c(
      m,
      pGame >>> 0,
      pMonster >>> 0,
      0,
      2,
      tx,
      ty,
      1,
      bRun !== 0 ? 4 : 0,
    ) as never
  }
  if (pGame === 0 || pMonster === 0 || pFrom === 0) return 0 as never
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return 0 as never
  const mPos = getUnitCoordsK2(m, pMonster)
  const fPos = getUnitCoordsK2(m, pFrom)
  let vx = (mPos.x - fPos.x) | 0
  let vy = (mPos.y - fPos.y) | 0
  if (vx === 0 && vy === 0) vx = 1
  const norm = Math.max(1, Math.abs(vx) > Math.abs(vy) ? Math.abs(vx) : Math.abs(vy))
  const d = distSteps > 0 ? distSteps : 12
  const dstX = (mPos.x + Math.trunc((vx * d) / norm)) & 0xffff
  const dstY = (mPos.y + Math.trunc((vy * d) / norm)) & 0xffff

  const hcIdx = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const canRun = (getMonsterModeFlagsPure113c(hcIdx) & (1 << 15)) !== 0
  const moveMode = bRun !== 0 && canRun ? 15 : 2
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  if (pPath !== 0) {
    PATH_SetStepNum113c(m, pPath, d)
    PATH_SetType113c(m, pPath, 5)
  }
  if (MONSTER_StartMode113c(m, pGame, pMonster, moveMode, 0, dstX, dstY) !== 0) {
    return 1 as never
  }
  AI_Stall113c(m, pGame, pMonster, 10)
  return 0 as never
}

function findNearestHostilePlayerForMonsterK2(
  m: Memory113c,
  pGame: number,
  pMonster: number,
): { pTarget: number; dist: number } {
  let bestUnit = 0
  let bestDist = 0x7fffffff
  for (let b = 0; b < 128; b++) {
    let u = m.u32((pGame + 0x1120 + b * 4) >>> 0) >>> 0
    while (u !== 0) {
      if (m.u32(u) === UNIT_PLAYER && SUNIT_IsDeadOrDying113c(m, u) === 0) {
        const d = AI_CalcApproxUnitDistSubtiles113c(m, pMonster, u) | 0
        if (d < bestDist) {
          bestDist = d
          bestUnit = u
        }
      }
      u = m.get(u, D2UnitStrc.pGameHashNext)
    }
  }
  return { pTarget: bestUnit, dist: bestDist }
}

/**
 * `@va D2Game:0x6FCA38B0` (`AiZombie`, `528B`):
 * Canonical 1.13c Zombie AI think function across `MonsterSliceWorldLike113c` and `Memory113c`.
 */
export function AiZombie113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2 = 0,
  arg3 = 0,
  arg4 = false,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCA38B0)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const pTarget = arg2
    const dist = arg3
    const inMeleeRange = arg4
    const { m, pGame } = world
    const entryMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
    if (entryMode === 0 || entryMode === 12) return

    const row = getMonStatsRowStrictK2(m, pMonster)
    const diff = getEffectiveDiffK2(m, pGame)
    if (inMeleeRange) {
      const mode = stepUnitSeedObjK2(m, pMonster).lo % 100 < row.aip4[diff] ? 4 : 5
      MONSTER_StartMode113c(world, pMonster, mode, pTarget, 0, 0)
      return
    }

    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    const alwaysChase = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.dwAlwaysChaseField) : 0
    let chase = alwaysChase === 3 || alwaysChase === 0x13
    if (!chase && dist < row.aip2[diff]) {
      const roll = stepUnitSeedObjK2(m, pMonster).lo % 100
      if (roll < row.aip1[diff]) chase = true
    }
    if (!chase && world.hasFullDrlg !== undefined) {
      const pRoom = UNITS_GetRoom113c(m, pMonster) >>> 0
      if (pRoom !== 0 && DUNGEON_GetLevelIdFromRoom113c(m, pRoom) === 0x11) {
        chase = true
      }
    }
    if (chase) {
      const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
      if (pAiCtrl !== 0) m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 100)
      AI_ApproachTarget113c(world, pMonster, pTarget, 15, 0, 0, 1, 0)
      return
    }
    AI_IdleWander113c(world, pMonster, 3)
    return
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  const pAiParam = arg3
  if (dllAbi) {
    const game = pGame >>> 0
    const mon = pMonster >>> 0
    const aip = pAiParam >>> 0
    const dist = m.u32((aip + 0x14) >>> 0) | 0
    const argTarget = m.u32((aip + 0x08) >>> 0) >>> 0
    const inMelee = m.u32((aip + 0x18) >>> 0) | 0
    const pMonStats = m.u32((aip + 0x1c) >>> 0) >>> 0
    const diff = m.u8((game + 0x6d) >>> 0)
    if (inMelee !== 0) {
      const aip4 = (m.u16((pMonStats + diff * 2 + 0x68) >>> 0) << 16) >> 16
      const roll = rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0
      const mode = roll < aip4 ? 4 : 5
      SKILLS_SetUsedSkill113c(m, mon, 0)
      let pathTypeByte = mode === 4 ? dist & 0xff : 0x64
      if (mon !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((mon + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
          const maskOff = mode === 4 ? 0x10 : 0x14
          const bitMask = pBitMasks !== 0 ? m.u32((pBitMasks + maskOff) >>> 0) : mode === 4 ? 0x10 : 0x20
          if ((m.u8((pMonStats2 + 0x104) >>> 0) & bitMask) !== 0) {
            pathTypeByte = 0x65
          }
        }
      }
      const pMc = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
      monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
      try {
        m.fill(pMc, 0x20, 0)
        m.setU32(pMc, mode)
        m.setU32((pMc + 0x04) >>> 0, mon)
        m.setU32((pMc + 0x08) >>> 0, argTarget)
        m.setU8((pMc + 0x15) >>> 0, pathTypeByte)
        MONSTER_StartMode113c(m, game, pMc, 1, 0, 0, 0, 0, 1, true)
      } finally {
        monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
      }
      return
    }
    const aip2 = (m.u16((pMonStats + diff * 2 + 0x5c) >>> 0) << 16) >> 16
    const aip1 = (m.u16((pMonStats + diff * 2 + 0x56) >>> 0) << 16) >> 16
    const pMonDataZ = mon !== 0 && (m.u32(mon) | 0) === 1 ? (m.u32((mon + 0x14) >>> 0) >>> 0) : 0
    const field54 = pMonDataZ !== 0 ? (m.u32((pMonDataZ + 0x54) >>> 0) | 0) : 0
    let chase = mon !== 0 && (m.u32(mon) | 0) === 1 && pMonDataZ !== 0 && (field54 === 3 || field54 === 0x13)
    if (!chase && dist < aip2) {
      if ((rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0) < aip1) {
        chase = true
      }
    }
    if (!chase) {
      const pRoomZ = UNITS_GetRoom113c(m, mon) >>> 0
      if (pRoomZ !== 0 && (DUNGEON_GetLevelIdFromRoom113c(m, pRoomZ) | 0) === 0x11) {
        chase = true
      }
    }
    if (chase) {
      const pAiCtrlZ = pMonDataZ !== 0 ? (m.u32((pMonDataZ + 0x2c) >>> 0) >>> 0) : 0
      if (pAiCtrlZ !== 0) {
        m.setU32((pAiCtrlZ + 0x1c) >>> 0, 0x64)
      }
      AI_ApproachTarget113c(m, game, mon, argTarget, 0x0f, 0, 0, 1, 0)
      return
    }
    AI_IdleWander113c(m, game, mon, 3)
    return
  }
  if (pGame === 0 || pMonster === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return

  if (pAiParam !== 0 && m.u32((pAiParam + D2AiParamStrcOffK2.bEngaged) >>> 0) === 0) {
    AI_IdleWander113c(m, pGame, pMonster, 3)
    return
  }

  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
  if (pAiGen !== 0) {
    const pCmd = m.get(pAiGen, D2AiGeneralStrc.pCommandHead)
    if (pCmd !== 0) {
      const cmd0 = m.get(pCmd, D2AiCmdStrc.dwCmdType) | 0
      const targetGuid = m.get(pCmd, D2AiCmdStrc.dwParam1) >>> 0
      AIGENERAL_PopAiCommand113c(m, pMonster)
      if (cmd0 === 1) {
        const pFearSrc = SUNIT_GetServerUnit113c(m, pGame, UNIT_PLAYER, targetGuid)
        if (pFearSrc !== 0) {
          AI_FleeFrom113c(m, pGame, pMonster, pFearSrc, 12, 0)
          return
        }
      }
    }
  }

  const { pTarget, dist } = findNearestHostilePlayerForMonsterK2(m, pGame, pMonster)
  if (pTarget === 0 || dist > 25) {
    if (rollSeedMemK2(m, pMonster + D2UnitStrc.seedLo.off, 100) < 50) {
      AI_IdleWander113c(m, pGame, pMonster, 6)
    } else {
      AI_Stall113c(m, pGame, pMonster, 15)
    }
    return
  }

  if (dist <= 3) {
    const atkChance = 75
    if (rollSeedMemK2(m, pMonster + D2UnitStrc.seedLo.off, 100) < atkChance) {
      const atkMode = rollSeedMemK2(m, pMonster + D2UnitStrc.seedLo.off, 100) < 50 ? 4 : 5
      AI_StartAttackMode113c(m, pGame, pMonster, atkMode, pTarget)
      if ((m.get(pMonster, D2UnitStrc.dwAnimMode) | 0) !== atkMode) {
        MONSTER_StartMode113c(m, pGame, pMonster, atkMode, pTarget, 0, 0)
      }
      return
    }
    AI_Stall113c(m, pGame, pMonster, 10)
    return
  }

  if (AI_ApproachTarget113c(m, pGame, pMonster, pTarget, 2, 0, 0, 10, 0) === 0) {
    AI_Stall113c(m, pGame, pMonster, 15)
  }
}

/**
 * `@va D2Game:0x6FCA3130` (`AiFallen`, `1049B`):
 * Single canonical 1.13c Fallen / Carver (`classId 0..4`) AI think implementation across
 * `MonsterSliceWorldLike113c` and `Memory113c`:
 * - Saves `entryMode = pMonster->dwAnimMode` at entry (`0x6FCA3143`), tests `pRoom == 0` (`0x6FCA318D`),
 *   and scans current + adjacent rooms' `dwDeathRing[0..3]` for dying ally (`mode == 0`, `dist < 15`)
 *   to set `bAfraid = 1`, `dwVelocityOverride = 50`, and flee (`AI_FleeFrom113c`).
 * - Processes command stack (`0x6FCA32BF`), leader war cry (`0x6FCA335C`), melee `A1`/`A2`/`S2` rolls,
 *   and approach / idle wander.
 */
export function AiFallen113c(
  arg0: MonsterSliceWorldLike113c | Memory113c,
  arg1: number,
  arg2 = 0,
  arg3 = 0,
  arg4 = false,
  dllAbi = false,
): void {
  hitD2GameVa113c(0x6FCA3130)
  if (isMonsterSliceWorldK2(arg0)) {
    const world = arg0
    const pMonster = arg1
    const pTarget = arg2
    const dist = arg3
    const inMeleeRange = arg4
    const { m, pGame } = world
    const entryMode = m.get(pMonster, D2UnitStrc.dwAnimMode)
    if (entryMode === 0 || entryMode === 12) return

    EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)

    const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
    if (pMonData === 0) return
    const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
    const pAiCtrl = m.get(pMonData, D2MonsterDataStrc.pAiControl)
    if (pAiGen === 0) return

    const pPath = m.get(pMonster, D2UnitStrc.pPath)
    const pRoom = pPath !== 0 ? m.get(pPath, D2DynamicPathStrc.pRoom) : 0
    if (pRoom === 0) return

    const { x: mx, y: my } = getUnitPosSubtileK2(m, pMonster)

    const ppRooms = m.get(pRoom, D2ActiveRoomStrc.ppRoomsNear)
    const nRooms = m.get(pRoom, D2ActiveRoomStrc.nRoomsNear)
    let stopScan = false
    for (let rIdx = 0; rIdx < nRooms && !stopScan; rIdx++) {
      const rPtr = ppRooms !== 0 ? m.u32((ppRooms + rIdx * 4) >>> 0) : rIdx === 0 ? pRoom : 0
      if (rPtr === 0) continue
      for (let dIdx = 0; dIdx < 4; dIdx++) {
        const deadId = m.get(rPtr, D2ActiveRoomStrc.dwDeathRing, dIdx)
        if (deadId === 0) continue
        const foundDead = world.monsterById.get(deadId)
        const pDead = foundDead !== undefined ? foundDead : 0
        if (pDead === 0 || m.get(pDead, D2UnitStrc.dwAnimMode) !== 0) continue
        const { x: dx, y: dy } = getUnitPosSubtileK2(m, pDead)
        if (UNITS_GetDistanceToCoordinates113c(dx, dy, mx, my) < 15) {
          m.set(pAiGen, D2AiGeneralStrc.bAfraid, 1)
          AIGENERAL_PopAiCommand113c(m, pMonster)
          if (pAiCtrl !== 0) {
            m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 50)
          }
          if (AI_FleeFrom113c(world, pTarget, pMonster, 12, true)) {
            const fleeRoll = stepUnitSeedObjK2(m, pMonster)
            if ((fleeRoll.lo % 20) === 0) {
              SUNIT_SetUnitEventSound113c(m, pMonster, 0x11, 0)
            }
            return
          }
          stopScan = true
          break
        }
      }
    }

    if (entryMode !== 1) {
      AI_Stall113c(world, pMonster, 10)
      return
    }

    const row = getMonStatsRowStrictK2(m, pMonster)
    const diff = getEffectiveDiffK2(m, pGame)
    const aip1 = row.aip1[diff]
    const aip2 = row.aip2[diff]
    const aip3 = row.aip3[diff]
    const aip4 = row.aip4[diff]

    const cmdHead = m.get(pAiGen, D2AiGeneralStrc.pCommandHead)
    if (cmdHead !== 0) {
      const cmdType = m.get(cmdHead, D2AiCmdStrc.dwCmdType)
      if (cmdType !== 1) {
        AIGENERAL_PopAiCommand113c(m, pMonster)
        AI_Stall113c(world, pMonster, 10)
        return
      }
      if (inMeleeRange) {
        if (stepUnitSeedObjK2(m, pMonster).lo % 100 < aip3) {
          const atkMode = stepUnitSeedObjK2(m, pMonster).lo % 100 < aip4 ? 4 : 5
          AI_StartAttackMode113c(m, atkMode, pMonster, pGame, pTarget, undefined, {
            onMonsterStartMode: (mem, _g, sp) =>
              MONSTER_StartMode113c(
                world,
                mem.u32((sp + 0x04) >>> 0),
                mem.u32(sp) | 0,
                mem.u32((sp + 0x08) >>> 0),
                mem.u32((sp + 0x0c) >>> 0) | 0,
                mem.u32((sp + 0x10) >>> 0) | 0,
              )
                ? 1
                : 0,
          })
        } else {
          AI_Stall113c(world, pMonster, 5)
        }
        return
      }
      if (!AI_ApproachTarget113c(world, pMonster, pTarget, 2, 0, 0, 1, 0)) {
        AIGENERAL_PopAiCommand113c(m, pMonster)
      }
      return
    }

    if (!inMeleeRange && MONSTER_HasAlwaysChaseFlag113c(m, pMonster) !== 0) {
      AI_ApproachTarget113c(world, pMonster, pTarget, 2, 0, 0, 1, 0)
      return
    }

    const selfId = m.get(pMonster, D2UnitStrc.dwUnitId)
    const pGroup = m.get(pAiGen, D2AiGeneralStrc.pGroup)
    const leaderId = pGroup !== 0 ? m.get(pAiGen, D2AiGeneralStrc.dwLeaderId) : 0xffffffff
    const leaderType = pGroup !== 0 ? m.get(pAiGen, D2AiGeneralStrc.dwLeaderType) : 0xffffffff
    const pLeaderUnit = AIGENERAL_GetPackLeaderUnit113c(m, pMonster)
    const isSelfLeader =
      pLeaderUnit !== 0
        ? pLeaderUnit === pMonster
        : pGroup !== 0 && leaderType === 1 && leaderId === selfId
    if (dist < 15 && isSelfLeader) {
      if (stepUnitSeedObjK2(m, pMonster).lo % 100 < aip1) {
        if (m.u32((pAiGen + 0x34) >>> 0) !== 0) {
          const pCmdScratch = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
          monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
          try {
            m.fill(pCmdScratch, 0x20, 0)
            m.setU32((pCmdScratch + 0x08) >>> 0, 1)
            AIGENERAL_BroadcastCmdToMinions113c(m, pMonster, pGame, pCmdScratch)
          } finally {
            monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
          }
        } else {
          const minions = world.minionIdsByLeaderId.get(selfId)
          if (minions !== undefined) {
            for (const minionId of minions) {
              const foundMinion = world.monsterById.get(minionId)
              const pMinion = foundMinion !== undefined ? foundMinion : 0
              if (pMinion !== 0 && SUNIT_IsDeadOrDying113c(m, pMinion) === 0) {
                AIGENERAL_CopyAiCommandParams113c(m, pMinion, 1, 0, 0, 0, 0)
              }
            }
          }
        }
        AIGENERAL_CopyAiCommandParams113c(m, pMonster, 1, 0, 0, 0, 0)
        MONSTER_StartMode113c(world, pMonster, 9, pTarget, 0, 0)
        return
      }
    }

    if (inMeleeRange) {
      const bAfraid = m.get(pAiGen, D2AiGeneralStrc.bAfraid)
      if (bAfraid === 0 && stepUnitSeedObjK2(m, pMonster).lo % 100 >= aip3) {
        if (stepUnitSeedObjK2(m, pMonster).lo % 100 < 30) {
          MONSTER_StartMode113c(world, pMonster, 9, pTarget, 0, 0)
        } else {
          AI_Stall113c(world, pMonster, 10)
        }
        return
      }
      m.set(pAiGen, D2AiGeneralStrc.bAfraid, 0)
      const atkMode = stepUnitSeedObjK2(m, pMonster).lo % 100 < aip4 ? 4 : 5
      AI_StartAttackMode113c(m, atkMode, pMonster, pGame, pTarget, undefined, {
        onMonsterStartMode: (mem, _g, sp) =>
          MONSTER_StartMode113c(
            world,
            mem.u32((sp + 0x04) >>> 0),
            mem.u32(sp) | 0,
            mem.u32((sp + 0x08) >>> 0),
            mem.u32((sp + 0x0c) >>> 0) | 0,
            mem.u32((sp + 0x10) >>> 0) | 0,
          )
            ? 1
            : 0,
      })
      return
    }

    if (dist > aip2) {
      if (stepUnitSeedObjK2(m, pMonster).lo % 100 < 30) {
        AI_IdleWander113c(world, pMonster, 3)
      } else {
        AI_Stall113c(world, pMonster, 10)
      }
      return
    }

    AI_ApproachTarget113c(world, pMonster, pTarget, 2, 0, 0, 1, 7)
    return
  }

  const m = arg0
  const pGame = arg1
  const pMonster = arg2
  const pAiParam = arg3
  if (dllAbi) {
    const game = pGame >>> 0
    const mon = pMonster >>> 0
    const aip = pAiParam >>> 0
    const pAiCtrl = aip !== 0 ? (m.u32(aip) >>> 0) : 0
    if (mon === 0) return
    const entryMode = m.u32((mon + 0x10) >>> 0) | 0
    if (entryMode === 0 || entryMode === 12) return
    let pEvt = m.u32((mon + 0xdc) >>> 0) >>> 0
    while (pEvt !== 0) {
      const pNext = m.u32((pEvt + 0x24) >>> 0) >>> 0
      if (m.u8(pEvt) === 2) EVENT_FreeNode113c(m, game, pEvt)
      pEvt = pNext
    }
    const pRoom = UNITS_GetRoom113c(m, mon) >>> 0
    if (pRoom === 0) return
    const mx = UNIT_GetPosX113c(m, mon) | 0
    const my = UNIT_GetPosY113c(m, mon) | 0
    const savedSp = k2RealStackPtr
    const pPpRooms = savedSp >>> 0
    const pNRooms = (savedSp + 4) >>> 0
    k2RealStackPtr = (savedSp + 8) >>> 0
    let fledDeath = false
    try {
      m.setU32(pPpRooms, 0)
      m.setU32(pNRooms, 0)
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, pPpRooms, pNRooms)
      const ppRooms = m.u32(pPpRooms) >>> 0
      const nRooms = m.u32(pNRooms) | 0
      for (let rIdx = 0; rIdx < nRooms && !fledDeath; rIdx++) {
        const rPtr = m.u32((ppRooms + rIdx * 4) >>> 0) >>> 0
        for (let dIdx = 0; dIdx < 4; dIdx++) {
          if (game === 0) {
            throw new D2CommonAssertError('AiUtil.cpp', 0x2d3)
          }
          const deadId = m.u32((rPtr + 0x38 + dIdx * 4) >>> 0) >>> 0
          let pDead = m.u32((game + ((deadId & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
          while (pDead !== 0 && (m.u32((pDead + 0x0c) >>> 0) >>> 0) !== deadId) {
            pDead = m.u32((pDead + 0xe4) >>> 0) >>> 0
          }
          if (pDead !== 0 && (m.u32((pDead + 0x10) >>> 0) | 0) === 0) {
            if ((UNITS_GetDistanceToCoordinates113c(m, pDead, mx, my) >>> 0) < 0x0f) {
              if (pAiCtrl !== 0) m.setU32((pAiCtrl + 0x14) >>> 0, 1)
              AIGENERAL_PopAiCommand113c(m, mon)
              const pMonDataF = (m.u32(mon) | 0) === 1 ? (m.u32((mon + 0x14) >>> 0) >>> 0) : 0
              const pAiCtrlMon = pMonDataF !== 0 ? (m.u32((pMonDataF + 0x2c) >>> 0) >>> 0) : 0
              if (pAiCtrlMon !== 0) m.setU32((pAiCtrlMon + 0x1c) >>> 0, 0x32)
              if ((AI_FleeFrom113c(m, game, mon, m.u32((aip + 0x08) >>> 0) >>> 0, 12, 1) | 0) !== 0) {
                if ((rollSeedMemK2(m, (mon + 0x20) >>> 0, 20) | 0) === 0) {
                  SUNIT_SetUnitEventSound113c(m, mon, 0x11, 0)
                }
                fledDeath = true
                break
              }
            }
          }
        }
      }
    } finally {
      k2RealStackPtr = savedSp
    }
    if (fledDeath) return
    if (entryMode !== 1) {
      AI_Stall113c(m, game, mon, 10)
      return
    }
    const pTarget = m.u32((aip + 0x08) >>> 0) >>> 0
    const dist = m.u32((aip + 0x14) >>> 0) | 0
    const inMelee = m.u32((aip + 0x18) >>> 0) | 0
    const pMonStats = m.u32((aip + 0x1c) >>> 0) >>> 0
    const diff = m.u8((game + 0x6d) >>> 0)
    const aip1 = (m.u16((pMonStats + diff * 2 + 0x56) >>> 0) << 16) >> 16
    const aip2 = (m.u16((pMonStats + diff * 2 + 0x5c) >>> 0) << 16) >> 16
    const aip3 = (m.u16((pMonStats + diff * 2 + 0x62) >>> 0) << 16) >> 16
    const aip4 = (m.u16((pMonStats + diff * 2 + 0x68) >>> 0) << 16) >> 16
    const fallenAtkHooks = {
      onMonsterStartMode: (mem: Memory113c, g: number, sp: number): number =>
        MONSTER_StartMode113c(mem, g, sp, 1, 0, 0, 0, 0, 1, true) | 0,
    }
    const pMonDataF = (m.u32(mon) | 0) === 1 ? (m.u32((mon + 0x14) >>> 0) >>> 0) : 0
    const pAiGen = pMonDataF !== 0 ? (m.u32((pMonDataF + 0x28) >>> 0) >>> 0) : 0
    const pCmd = pAiGen !== 0 ? (m.u32((pAiGen + 0x20) >>> 0) >>> 0) : 0
    if (pCmd !== 0) {
      if ((m.u32((pCmd + 0x08) >>> 0) | 0) !== 1) {
        AIGENERAL_PopAiCommand113c(m, mon)
        AI_Stall113c(m, game, mon, 10)
        return
      }
      if (inMelee !== 0) {
        if ((rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0) < aip3) {
          const atkMode = (rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0) < aip4 ? 4 : 5
          AI_StartAttackMode113c(m, atkMode, mon, game, pTarget, undefined, fallenAtkHooks)
        } else {
          AI_Stall113c(m, game, mon, 5)
        }
        return
      }
      if ((AI_ApproachTarget113c(m, game, mon, pTarget, 2, 0, 0, 1, 0) | 0) === 0) {
        AIGENERAL_PopAiCommand113c(m, mon)
      }
      return
    }
    if (inMelee === 0 && MONSTER_HasAlwaysChaseFlag113c(m, mon) !== 0) {
      AI_ApproachTarget113c(m, game, mon, pTarget, 2, 0, 0, 1, 0)
      return
    }
    if (dist < 15 && (AIGENERAL_GetPackLeaderUnit113c(m, mon) >>> 0) === mon) {
      if ((rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0) < aip1) {
        const pCmdScratch = (MON_MODE_CHANGE_SCRATCH_VA_K2 + monModeScratchDepthK2 * 0x40) >>> 0
        monModeScratchDepthK2 = (monModeScratchDepthK2 + 1) | 0
        try {
          m.fill(pCmdScratch, 0x20, 0)
          m.setU32((pCmdScratch + 0x08) >>> 0, 1)
          AIGENERAL_BroadcastCmdToMinions113c(m, mon, game, pCmdScratch)
          AIGENERAL_CopyAiCommandParams113c(m, game, mon, pCmdScratch)
        } finally {
          monModeScratchDepthK2 = (monModeScratchDepthK2 - 1) | 0
        }
        AI_StartAttackMode113c(m, 9, mon, game, pTarget, undefined, fallenAtkHooks)
        return
      }
    }
    if (inMelee !== 0) {
      if (pAiCtrl === 0 || (m.u32((pAiCtrl + 0x14) >>> 0) | 0) === 0) {
        if ((rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0) >= aip3) {
          if ((rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0) < 30) {
            AI_StartAttackMode113c(m, 9, mon, game, pTarget, undefined, fallenAtkHooks)
          } else {
            AI_Stall113c(m, game, mon, 10)
          }
          return
        }
      }
      if (pAiCtrl !== 0) m.setU32((pAiCtrl + 0x14) >>> 0, 0)
      const atkMode = (rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0) < aip4 ? 4 : 5
      AI_StartAttackMode113c(m, atkMode, mon, game, pTarget, undefined, fallenAtkHooks)
      return
    }
    if (dist > aip2) {
      if ((rollSeedMemK2(m, (mon + 0x20) >>> 0, 100) | 0) < 30) {
        AI_IdleWander113c(m, game, mon, 3)
      } else {
        AI_Stall113c(m, game, mon, 10)
      }
      return
    }
    AI_ApproachTarget113c(m, game, mon, pTarget, 2, 0, 0, 1, 7)
    return
  }
  void pAiParam
  if (pGame === 0 || pMonster === 0) return
  if (SUNIT_IsDeadOrDying113c(m, pMonster) !== 0) return

  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  const pAiGen = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiGeneral) : 0
  const { pTarget, dist } = findNearestHostilePlayerForMonsterK2(m, pGame, pMonster)

  // 0x6FCA31A5..0x6FCA3285: scan current + adjacent rooms' `dwDeathRing[0..3]` for dying ally (`mode == 0`, `dist < 15`)
  const pRoom = UNITS_GetRoom113c(m, pMonster)
  if (pRoom !== 0 && pAiGen !== 0 && pTarget !== 0) {
    const ppRooms = m.get(pRoom, D2ActiveRoomStrc.ppRoomsNear)
    const nRooms = Math.max(1, m.get(pRoom, D2ActiveRoomStrc.nRoomsNear))
    const mCoords = getUnitCoordsK2(m, pMonster)
    for (let rIdx = 0; rIdx < nRooms; rIdx++) {
      const rPtr = ppRooms !== 0 ? m.u32((ppRooms + rIdx * 4) >>> 0) : rIdx === 0 ? pRoom : 0
      if (rPtr === 0) continue
      for (let dIdx = 0; dIdx < 4; dIdx++) {
        const deadId = m.get(rPtr, D2ActiveRoomStrc.dwDeathRing, dIdx)
        if (deadId === 0) continue
        const pDead = SUNIT_GetServerUnit113c(m, pGame, UNIT_MONSTER, deadId)
        if (pDead === 0 || m.get(pDead, D2UnitStrc.dwAnimMode) !== 0) continue
        const dCoords = getUnitCoordsK2(m, pDead)
        if (UNITS_GetDistanceToCoordinates113c(dCoords.x, dCoords.y, mCoords.x, mCoords.y) < 15) {
          m.set(pAiGen, D2AiGeneralStrc.bAfraid, 1)
          AIGENERAL_PopAiCommand113c(m, pMonster)
          AI_FleeFrom113c(m, pGame, pMonster, pTarget, 12, 1)
          return
        }
      }
    }
  }

  if (pAiGen !== 0) {
    const pCmd = m.get(pAiGen, D2AiGeneralStrc.pCommandHead)
    if (pCmd !== 0) {
      const cmd0 = m.get(pCmd, D2AiCmdStrc.dwCmdType) | 0
      const targetGuid = m.get(pCmd, D2AiCmdStrc.dwParam1) >>> 0
      const fleeSteps = m.get(pCmd, D2AiCmdStrc.dwParam2) | 0
      AIGENERAL_PopAiCommand113c(m, pMonster)
      if (cmd0 === 1 || cmd0 === 2) {
        const pFearSrc = SUNIT_GetServerUnit113c(m, pGame, UNIT_PLAYER, targetGuid)
        const fearTarget = pFearSrc !== 0 ? pFearSrc : pTarget
        if (fearTarget !== 0) {
          AI_FleeFrom113c(m, pGame, pMonster, fearTarget, fleeSteps > 0 ? fleeSteps : 14, 1)
          return
        }
      }
    }
  }

  if (STATES_CheckState113c(m, pMonster, 19) !== 0) {
    if (pTarget !== 0) {
      AI_FleeFrom113c(m, pGame, pMonster, pTarget, 14, 1)
      return
    }
  }

  if (pTarget === 0 || dist > 30) {
    if (rollSeedMemK2(m, pMonster + D2UnitStrc.seedLo.off, 100) < 45) {
      AI_IdleWander113c(m, pGame, pMonster, 8)
    } else {
      AI_Stall113c(m, pGame, pMonster, 12)
    }
    return
  }

  if (dist <= 3) {
    const roll = rollSeedMemK2(m, pMonster + D2UnitStrc.seedLo.off, 100)
    if (roll < 70) {
      const atkMode = rollSeedMemK2(m, pMonster + D2UnitStrc.seedLo.off, 100) < 60 ? 4 : 5
      MONSTER_StartMode113c(m, pGame, pMonster, atkMode, pTarget, 0, 0)
      return
    }
    if (roll < 80) {
      AI_FleeFrom113c(m, pGame, pMonster, pTarget, 6, 1)
      return
    }
    AI_Stall113c(m, pGame, pMonster, 10)
    return
  }

  const runRoll = rollSeedMemK2(m, pMonster + D2UnitStrc.seedLo.off, 100)
  const moveMode = runRoll < 35 ? 15 : 2
  if (AI_ApproachTarget113c(m, pGame, pMonster, pTarget, moveMode, 0, 0, 12, 0) === 0) {
    AI_Stall113c(m, pGame, pMonster, 12)
  }
}

const k2ExpireHooks = {
  onStatRemoveProc: (
    mem: Memory113c,
    fnVa: number,
    pUnit: number,
  ): void => {
    const uVa = fnVa >>> 0
    if (uVa === D2GAME_FP_REMOVE_COLD_VA_113C) {
      STATES_OnColdStateRemoved_6FCFB4C0_113c(mem, pUnit)
    } else if (uVa === D2GAME_FP_REMOVE_FREEZE_VA_113C) {
      STATES_OnFreezeStateRemoved_6FCFBD90_113c(mem, pUnit)
    }
  },
}

/**
 * `@va D2Game:0x6FC4E050` (`GAME_UpdateGameFrame`, `269B`):
 * Exact 1.13c per-frame orchestrator on `Memory113c`:
 * 1. Advances `pGame->dwGameFrame (+0xA8)` by `1` (`EVENT_UpdateTimers113c` dispatches due events across unit types `0..5`).
 * 2. Updates active rooms & inactive room node expiry (`GAME_UpdateActRooms113c` + `AIGENERAL_ExpireMinionListsInAct113c`).
 * 3. Runs per-client room/unit/state/attribute/life/mana/stamina S2C synchronization (`CLIENT_SyncRoomAndUnits113c` `0x6FC6B400`).
 */
export function GAME_UpdateGameFrame113c(
  m: Memory113c,
  pGame: number,
  eventDispatch?: (
    m: Memory113c,
    pGame: number,
    unitType: number,
    pUnit: number,
    evType: number,
    handler: number,
    arg14: number,
    arg18: number,
  ) => void,
): number {
  if (pGame === 0) return 0
  const nextFrame = ((m.get(pGame, D2GameStrc.dwGameFrame) >>> 0) + 1) >>> 0
  m.set(pGame, D2GameStrc.dwGameFrame, nextFrame)

  const defaultDispatch = (
    mem: Memory113c,
    gamePtr: number,
    uType: number,
    pUnit: number,
    evType: number,
    handler: number,
    arg14: number,
    arg18: number,
  ): void => {
    if (eventDispatch) {
      eventDispatch(mem, gamePtr, uType, pUnit, evType, handler, arg14, arg18)
      return
    }
    if (uType === UNIT_PLAYER) {
      if (evType === 3) playerEvent3RegenTickK2(mem, gamePtr, pUnit)
      else if (evType === 6) PLAYER_AdvanceSkillModeFrame113c(mem, gamePtr, pUnit)
      else if (evType === 7) PLAYER_EndAttackOrBlockAnim113c(mem, gamePtr, pUnit)
      else if (evType === 11) playerEvent11PeriodicTickK2(mem, gamePtr, pUnit)
      else if (evType === 12) MONSTER_Event12_ExpireTimedStats113c(mem, gamePtr, pUnit, 0, 0, k2ExpireHooks)
    } else if (uType === UNIT_MONSTER) {
      if (evType === MON_EVENT_MODE_STEP) {
        const mode = mem.get(pUnit, D2UnitStrc.dwAnimMode) | 0
        if (mode === 2) MONSTER_StepWalk113c(mem, gamePtr, pUnit)
        else if (mode === 15) MONSTER_StepRun113c(mem, gamePtr, pUnit)
      } else if (evType === MON_EVENT_MODE_END) {
        MONSTER_EndToAiOrNeutral113c(mem, gamePtr, pUnit)
      } else if (evType === MON_EVENT_AI_THINK) {
        AI_RunMonsterAI113c(mem, gamePtr, pUnit)
      } else if (evType === 3) {
        MONSTER_Event03_RegenAndPoisonTick113c(mem, gamePtr, pUnit)
      } else if (evType === 12) {
        MONSTER_Event12_ExpireTimedStats113c(mem, gamePtr, pUnit, 0, 0, k2ExpireHooks)
      }
    }
  }

  EVENT_UpdateTimers113c(m, pGame, defaultDispatch)
  for (let act = 0; act < 5; act++) {
    AIGENERAL_ExpireMinionListsInAct113c(m, pGame, act)
  }
  CLIENT_SyncRoomAndUnits113c(m, pGame)
  return nextFrame
}


// ============================================================================
// SECTION 3: REAL `D2Game.dll` (`0x6FCAA3E0`) S2C PACKET BUILDERS & FRAME SYNC
// ============================================================================

class LsbBitPacker113c {
  readonly buf: Uint8Array
  bitPos = 0

  constructor(byteCap: number) {
    this.buf = new Uint8Array(byteCap)
  }

  writeBits(val: number, nBits: number): void {
    let v = val >>> 0
    for (let i = 0; i < nBits; i++) {
      const bit = v & 1
      v >>>= 1
      if (bit !== 0) {
        const byteIdx = this.bitPos >>> 3
        if (byteIdx < this.buf.byteLength) {
          this.buf[byteIdx] = (this.buf[byteIdx]! | (1 << (this.bitPos & 7))) & 0xff
        }
      }
      this.bitPos++
    }
  }

  byteLength(): number {
    return (this.bitPos + 7) >>> 3
  }
}

function writeU16LEK2(buf: Uint8Array, off: number, val: number): void {
  buf[off] = val & 0xff
  buf[off + 1] = (val >>> 8) & 0xff
}

function writeU32LEK2(buf: Uint8Array, off: number, val: number): void {
  buf[off] = val & 0xff
  buf[off + 1] = (val >>> 8) & 0xff
  buf[off + 2] = (val >>> 16) & 0xff
  buf[off + 3] = (val >>> 24) & 0xff
}

/** `@va D2Game:0x6FCAA6A0` (`0x07` `AddRoom`, `6B`): `[0x07, u16 tileX, u16 tileY, u8 levelId]`. */
export function S2C_SendPacket07_AddRoom113c(
  m: Memory113c,
  pClient: number,
  tileX: number,
  tileY: number,
  levelId: number,
): number {
  const pkt = new Uint8Array(6)
  pkt[0] = 0x07
  writeU16LEK2(pkt, 1, tileX)
  writeU16LEK2(pkt, 3, tileY)
  pkt[5] = levelId & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAA6E0` (`0x08` `RemoveRoom`, `6B`): `[0x08, u16 tileX, u16 tileY, u8 levelId]`. */
export function S2C_SendPacket08_RemoveRoom113c(
  m: Memory113c,
  pClient: number,
  tileX: number,
  tileY: number,
  levelId: number,
): number {
  const pkt = new Uint8Array(6)
  pkt[0] = 0x08
  writeU16LEK2(pkt, 1, tileX)
  writeU16LEK2(pkt, 3, tileY)
  pkt[5] = levelId & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAA720` (`0x09` `AssignWarp`, `11B`): `[0x09, u8 unitType=5, u32 unitId, u8 warpId, u16 wX, u16 wY]`. */
export function S2C_SendPacket09_AssignWarp113c(
  m: Memory113c,
  pClient: number,
  unitId: number,
  warpClassId: number,
  wX: number,
  wY: number,
): number {
  const pkt = new Uint8Array(11)
  pkt[0] = 0x09
  pkt[1] = 0x05
  writeU32LEK2(pkt, 2, unitId)
  pkt[6] = warpClassId & 0xff
  writeU16LEK2(pkt, 7, wX)
  writeU16LEK2(pkt, 9, wY)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAA760` (`0x0A` `RemoveUnit`, `6B`): `[0x0A, u8 unitType, u32 unitId]`. */
export function S2C_SendPacket0A_RemoveUnit113c(
  m: Memory113c,
  pClient: number,
  unitType: number,
  unitId: number,
): number {
  const pkt = new Uint8Array(6)
  pkt[0] = 0x0a
  pkt[1] = unitType & 0xff
  writeU32LEK2(pkt, 2, unitId)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB1C0` (`0x0C` `NpcHit`, `9B`): `[0x0C, u8 unitType=1, u32 unitId, u8 animMode, u8 hitClass, u8 lifePct]`. */
export function S2C_SendPacket0C_NpcHit113c(
  m: Memory113c,
  pClient: number,
  pMonster: number,
  animCode = 0x13,
  hitClass = 0,
): number {
  if (pMonster === 0) return 0
  const pkt = new Uint8Array(9)
  pkt[0] = 0x0c
  pkt[1] = m.u32(pMonster) & 0xff
  writeU32LEK2(pkt, 2, m.get(pMonster, D2UnitStrc.dwUnitId) >>> 0)
  pkt[6] = animCode & 0xff
  pkt[7] = hitClass & 0xff
  pkt[8] = STATLIST_GetUnitLifePercent113c(m, pMonster) & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB210` (`0x0D` `PlayerStop`, `13B`): `[0x0D, u8 unitType=0, u32 unitId, u8 mode, u16 wX, u16 wY, u8 hitClass, u8 lifePct]`. */
export function S2C_SendPacket0D_PlayerStop113c(
  m: Memory113c,
  pClient: number,
  pPlayer: number,
  modeCode = 0x13,
  hitClass = 0,
): number {
  if (pPlayer === 0) return 0
  const coords = getUnitCoordsK2(m, pPlayer)
  const pkt = new Uint8Array(13)
  pkt[0] = 0x0d
  pkt[1] = m.u32(pPlayer) & 0xff
  writeU32LEK2(pkt, 2, m.get(pPlayer, D2UnitStrc.dwUnitId) >>> 0)
  pkt[6] = modeCode & 0xff
  writeU16LEK2(pkt, 7, coords.x)
  writeU16LEK2(pkt, 9, coords.y)
  pkt[11] = hitClass & 0xff
  pkt[12] = STATLIST_GetUnitLifePercent113c(m, pPlayer) & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB260` (`0x0E` `ObjectState`, `12B`): `[0x0E, u8 unitType=2, u32 unitId, u8 portalFlags, u8 canChangeBack, u32 animMode]`. */
export function S2C_SendPacket0E_ObjectState113c(
  m: Memory113c,
  pClient: number,
  unitId: number,
  portalFlags: number,
  canChangeBack: number,
  animMode: number,
): number {
  const pkt = new Uint8Array(12)
  pkt[0] = 0x0e
  pkt[1] = 0x02
  writeU32LEK2(pkt, 2, unitId)
  pkt[6] = portalFlags & 0xff
  pkt[7] = canChangeBack & 0xff
  writeU32LEK2(pkt, 8, animMode)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB2B0` (`0x0F` `PlayerMove`, `16B`): `[0x0F, u8 unitType=0, u32 unitId, u8 moveType, u16 dstX, u16 dstY, 0, u16 curX, u16 curY]`. */
export function S2C_SendPacket0F_PlayerMove113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  moveType: number,
  dstX: number,
  dstY: number,
): number {
  if (pUnit === 0) return 0
  const cur = getUnitCoordsK2(m, pUnit)
  const pkt = new Uint8Array(16)
  pkt[0] = 0x0f
  pkt[1] = m.u32(pUnit) & 0xff
  writeU32LEK2(pkt, 2, m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0)
  pkt[6] = moveType & 0xff
  writeU16LEK2(pkt, 7, dstX)
  writeU16LEK2(pkt, 9, dstY)
  pkt[11] = 0
  writeU16LEK2(pkt, 12, cur.x)
  writeU16LEK2(pkt, 14, cur.y)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB310` (`0x10` `PlayerMoveToTarget`, `16B`): `[0x10, u8 unitType=0, u32 unitId, u8 moveType, u8 targetType, u32 targetId, u16 curX, u16 curY]`. */
export function S2C_SendPacket10_PlayerMoveToTarget113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  moveType: number,
  targetType: number,
  targetId: number,
): number {
  if (pUnit === 0) return 0
  const cur = getUnitCoordsK2(m, pUnit)
  const pkt = new Uint8Array(16)
  pkt[0] = 0x10
  pkt[1] = m.u32(pUnit) & 0xff
  writeU32LEK2(pkt, 2, m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0)
  pkt[6] = moveType & 0xff
  pkt[7] = targetType & 0xff
  writeU32LEK2(pkt, 8, targetId)
  writeU16LEK2(pkt, 12, cur.x)
  writeU16LEK2(pkt, 14, cur.y)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB410` (`0x15` `ReassignPlayer`, `11B`): `[0x15, u8 unitType, u32 unitId, u16 wX, u16 wY, u8 bReassign]`. */
export function S2C_SendPacket15_ReassignPlayer113c(
  m: Memory113c,
  pClient: number,
  unitType: number,
  unitId: number,
  wX: number,
  wY: number,
  bReassign = 1,
): number {
  const pkt = new Uint8Array(11)
  pkt[0] = 0x15
  pkt[1] = unitType & 0xff
  writeU32LEK2(pkt, 2, unitId)
  writeU16LEK2(pkt, 6, wX)
  writeU16LEK2(pkt, 8, wY)
  pkt[10] = bReassign & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/**
 * `@va D2Game:0x6FCAB750` (`0x96` `WalkVerify`, `9B` = `71` bits LSB-first):
 * `8b(0x96) | 15b(wStamina) | 16b(wX) | 16b(wY) | 8b(dX) | 8b(dY)`.
 */
export function S2C_SendPacket96_WalkVerify113c(
  m: Memory113c,
  pClient: number,
  wStamina: number,
  wX: number,
  wY: number,
  dX = 0,
  dY = 0,
): number {
  const bp = new LsbBitPacker113c(9)
  bp.writeBits(0x96, 8)
  bp.writeBits(wStamina & 0x7fff, 15)
  bp.writeBits(wX & 0xffff, 16)
  bp.writeBits(wY & 0xffff, 16)
  bp.writeBits(dX & 0xff, 8)
  bp.writeBits(dY & 0xff, 8)
  return NET_QueuePacketToClient113c(m, pClient, bp.buf)
}

/**
 * `@va D2Game:0x6FCAB7F0` (`0x95` `LifeManaChange`, `13B` = `101` bits LSB-first):
 * `8b(0x95) | 15b(wHP) | 15b(wMP) | 15b(wStamina) | 16b(wX) | 16b(wY) | 8b(dX) | 8b(dY)`.
 */
export function S2C_SendPacket95_LifeManaChange113c(
  m: Memory113c,
  pClient: number,
  wHP: number,
  wMP: number,
  wStamina: number,
  wX: number,
  wY: number,
  dX = 0,
  dY = 0,
): number {
  const bp = new LsbBitPacker113c(13)
  bp.writeBits(0x95, 8)
  bp.writeBits(wHP & 0x7fff, 15)
  bp.writeBits(wMP & 0x7fff, 15)
  bp.writeBits(wStamina & 0x7fff, 15)
  bp.writeBits(wX & 0xffff, 16)
  bp.writeBits(wY & 0xffff, 16)
  bp.writeBits(dX & 0xff, 8)
  bp.writeBits(dY & 0xff, 8)
  return NET_QueuePacketToClient113c(m, pClient, bp.buf)
}

/**
 * `@va D2Game:0x6FCAB8C0` (`0x18` `LifeManaPot`, `15B` = `115` bits LSB-first):
 * `8b(0x18) | 15b(wHP) | 15b(wMP) | 15b(wStamina) | 7b(bHPRegen) | 7b(bMPRegen) | 16b(wX) | 16b(wY) | 8b(dX) | 8b(dY)`.
 */
export function S2C_SendPacket18_LifeManaPot113c(
  m: Memory113c,
  pClient: number,
  wHP: number,
  wMP: number,
  wStamina: number,
  bHPRegen: number,
  bMPRegen: number,
  wX: number,
  wY: number,
  dX = 0,
  dY = 0,
): number {
  const bp = new LsbBitPacker113c(15)
  bp.writeBits(0x18, 8)
  bp.writeBits(wHP & 0x7fff, 15)
  bp.writeBits(wMP & 0x7fff, 15)
  bp.writeBits(wStamina & 0x7fff, 15)
  bp.writeBits(bHPRegen & 0x7f, 7)
  bp.writeBits(bMPRegen & 0x7f, 7)
  bp.writeBits(wX & 0xffff, 16)
  bp.writeBits(wY & 0xffff, 16)
  bp.writeBits(dX & 0xff, 8)
  bp.writeBits(dY & 0xff, 8)
  return NET_QueuePacketToClient113c(m, pClient, bp.buf)
}

/** `@va D2Game:0x6FCAB9A0` (`0x19` `SmallGoldAdd`, `2B`): `[0x19, u8 amount]`. */
export function S2C_SendPacket19_GoldAddByte113c(m: Memory113c, pClient: number, amount: number): number {
  const pkt = new Uint8Array(2)
  pkt[0] = 0x19
  pkt[1] = amount & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB9D0` (`0x1A` / `0x1B` / `0x1C` `ExperienceAdd`, `2B`/`3B`/`5B`). */
export function S2C_SendPacket1A_1B_1C_AddExp113c(
  m: Memory113c,
  pClient: number,
  expDelta: number,
): number {
  const u = expDelta >>> 0
  if (u <= 0xff) {
    const pkt = new Uint8Array(2)
    pkt[0] = 0x1a
    pkt[1] = u & 0xff
    return NET_QueuePacketToClient113c(m, pClient, pkt)
  }
  if (u <= 0xffff) {
    const pkt = new Uint8Array(3)
    pkt[0] = 0x1b
    writeU16LEK2(pkt, 1, u)
    return NET_QueuePacketToClient113c(m, pClient, pkt)
  }
  const pkt = new Uint8Array(5)
  pkt[0] = 0x1c
  writeU32LEK2(pkt, 1, u)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCABA40` (`0x1D` / `0x1E` / `0x1F` `SetAttribute`, `3B`/`4B`/`6B`): `[op, u8 statId, u8/u16/u32 val]`. */
export function S2C_SendPacket1D_1E_1F_SetAttribute113c(
  m: Memory113c,
  pClient: number,
  statId: number,
  val: number,
): number {
  const u = val >>> 0
  if (u <= 0xff) {
    const pkt = new Uint8Array(3)
    pkt[0] = 0x1d
    pkt[1] = statId & 0xff
    pkt[2] = u & 0xff
    return NET_QueuePacketToClient113c(m, pClient, pkt)
  }
  if (u <= 0xffff) {
    const pkt = new Uint8Array(4)
    pkt[0] = 0x1e
    pkt[1] = statId & 0xff
    writeU16LEK2(pkt, 2, u)
    return NET_QueuePacketToClient113c(m, pClient, pkt)
  }
  const pkt = new Uint8Array(6)
  pkt[0] = 0x1f
  pkt[1] = statId & 0xff
  writeU32LEK2(pkt, 2, u)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCABCA0` (`0x23` `SetSkill`, `13B`): delegates to `NET_SendPacket0x23_AssignSkill113c`. */
export function S2C_SendPacket23_SetSkill113c(
  m: Memory113c,
  pClient: number,
  unitType: number,
  unitId: number,
  bLeftHand: number,
  skillId: number,
  itemGuid = 0xffffffff,
): void {
  NET_SendPacket0x23_AssignSkill113c(m, unitType, unitId, pClient, bLeftHand, skillId, itemGuid)
}

/** `@va D2Game:0x6FCABDA0` (`0x2C` `PlaySound`, `8B`): `[0x2C, u8 unitType, u32 unitId, u16 wSound]`. */
export function S2C_SendPacket2C_UnitSound113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  wSound: number,
): number {
  if (pUnit === 0) return 0
  const pkt = new Uint8Array(8)
  pkt[0] = 0x2c
  pkt[1] = m.u32(pUnit) & 0xff
  writeU32LEK2(pkt, 2, m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0)
  writeU16LEK2(pkt, 6, wSound)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB010` (`0x3E` `UpdateItemStats`, `34B` = `0x22` zero-padded buffer queued to `0x6FCAA3E0`). */
export function S2C_SendPacket3E_UpdateItemStat113c(
  m: Memory113c,
  pClient: number,
  pItem: number,
  statId: number,
  val: number,
  wLayer = 0,
  bFlag = 1,
): void {
  NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, wLayer, pClient, bFlag, statId, val)
}

/** `@va D2Game:0x6FCAA7C0` (`0x51` `AssignObject`, `14B`): `[0x51, 0x02, u32 unitId, u16 classId, u16 wX, u16 wY, u8 animMode, u8 interactType]`. */
export function S2C_SendPacket51_AssignObject113c(
  m: Memory113c,
  pClient: number,
  pObj: number,
): number {
  if (pObj === 0) return 0
  const coords = getUnitCoordsK2(m, pObj)
  const pObjData = m.get(pObj, D2UnitStrc.pUnitData)
  const interactType = pObjData !== 0 ? m.u8((pObjData + 0x04) >>> 0) : 0
  const pkt = new Uint8Array(14)
  pkt[0] = 0x51
  pkt[1] = 0x02
  writeU32LEK2(pkt, 2, m.get(pObj, D2UnitStrc.dwUnitId) >>> 0)
  writeU16LEK2(pkt, 6, m.get(pObj, D2UnitStrc.dwClassId) & 0xffff)
  writeU16LEK2(pkt, 8, coords.x)
  writeU16LEK2(pkt, 10, coords.y)
  pkt[12] = m.get(pObj, D2UnitStrc.dwAnimMode) & 0xff
  pkt[13] = interactType & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAA820` (`0x59` `AssignPlayer`, `26B`): `[0x59, u32 unitId, u8 classId, char szName[16], u16 wX, u16 wY]`. */
export function S2C_SendPacket59_AssignPlayer113c(
  m: Memory113c,
  pClient: number,
  pPlayer: number,
): number {
  if (pPlayer === 0) return 0
  const coords = getUnitCoordsK2(m, pPlayer)
  const pPlrData = m.get(pPlayer, D2UnitStrc.pUnitData)
  const pkt = new Uint8Array(26)
  pkt[0] = 0x59
  writeU32LEK2(pkt, 1, m.get(pPlayer, D2UnitStrc.dwUnitId) >>> 0)
  pkt[5] = m.get(pPlayer, D2UnitStrc.dwClassId) & 0xff
  if (pPlrData !== 0) {
    for (let i = 0; i < 16; i++) {
      const ch = m.u8((pPlrData + i) >>> 0)
      pkt[6 + i] = ch
      if (ch === 0) break
    }
  }
  writeU16LEK2(pkt, 22, coords.x)
  writeU16LEK2(pkt, 24, coords.y)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAAEC0` (`0x65` `PlayerKillCount`, `7B`): `[0x65, u32 playerId, u16 count]`. */
export function S2C_SendPacket65_PlayerKillCount113c(
  m: Memory113c,
  pClient: number,
  playerId: number,
  count: number,
): number {
  const pkt = new Uint8Array(7)
  pkt[0] = 0x65
  writeU32LEK2(pkt, 1, playerId)
  writeU16LEK2(pkt, 5, count)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/**
 * `@va D2Game:0x6FCAB4E0` (`0x67` `NpcMove`, `16B`):
 * `[0x67, u32 unitId, u8 moveType(0x01=walk,0x17=run), u16 dstX, u16 dstY, u8 pathType, u8 count, u8 dist, i16 velPct, u8 dir]`.
 */
export function S2C_SendPacket67_NpcMove113c(
  m: Memory113c,
  pClient: number,
  pMonster: number,
  dstX: number,
  dstY: number,
  moveType = 0x01,
): number {
  if (pMonster === 0) return 0
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  const pathType = pPath !== 0 ? (m.get(pPath, D2DynamicPathStrc.dwPathType) & 0xff) : 2
  const dist = pPath !== 0 ? (m.u8((pPath + 0x3b) >>> 0) & 0xff) : 12
  const dir = pPath !== 0 ? (m.u8((pPath + 0x1c) >>> 0) & 0xff) : 0
  const velPct = STATLIST_GetUnitStat113c(m, pMonster, 67, 0) + 100
  const pkt = new Uint8Array(16)
  pkt[0] = 0x67
  writeU32LEK2(pkt, 1, m.get(pMonster, D2UnitStrc.dwUnitId) >>> 0)
  pkt[5] = moveType & 0xff
  writeU16LEK2(pkt, 6, dstX)
  writeU16LEK2(pkt, 8, dstY)
  pkt[10] = pathType
  pkt[11] = 0
  pkt[12] = dist
  writeU16LEK2(pkt, 13, velPct & 0xffff)
  pkt[15] = dir
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/**
 * `@va D2Game:0x6FCAB560` (`0x68` `NpcMoveToTarget`, `21B`):
 * `[0x68, u32 unitId, u8 moveType(0x00=walk,0x18=run), u16 curX, u16 curY, u8 targetType, u32 targetId, u8 pathType, u8 flag, u8 dist, i16 velPct, u8 dir]`.
 */
export function S2C_SendPacket68_NpcMoveToTarget113c(
  m: Memory113c,
  pClient: number,
  pMonster: number,
  pTarget: number,
  moveType = 0x00,
): number {
  if (pMonster === 0 || pTarget === 0) return 0
  const cur = getUnitCoordsK2(m, pMonster)
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  const pathType = pPath !== 0 ? (m.get(pPath, D2DynamicPathStrc.dwPathType) & 0xff) : 1
  const dist = pPath !== 0 ? (m.u8((pPath + 0x3b) >>> 0) & 0xff) : 13
  const dir = pPath !== 0 ? (m.u8((pPath + 0x1c) >>> 0) & 0xff) : 0
  const velPct = STATLIST_GetUnitStat113c(m, pMonster, 67, 0) + 100
  const pkt = new Uint8Array(21)
  pkt[0] = 0x68
  writeU32LEK2(pkt, 1, m.get(pMonster, D2UnitStrc.dwUnitId) >>> 0)
  pkt[5] = moveType & 0xff
  writeU16LEK2(pkt, 6, cur.x)
  writeU16LEK2(pkt, 8, cur.y)
  pkt[10] = m.u32(pTarget) & 0xff
  writeU32LEK2(pkt, 11, m.get(pTarget, D2UnitStrc.dwUnitId) >>> 0)
  pkt[15] = pathType
  pkt[16] = 0
  pkt[17] = dist
  writeU16LEK2(pkt, 18, velPct & 0xffff)
  pkt[20] = dir
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB5F0` (`0x69` `NpcState`, `12B`): `[0x69, u32 unitId, u8 state, u16 wX, u16 wY, u8 animDir, u8 hitClass]`. */
export function S2C_SendPacket69_NpcState113c(
  m: Memory113c,
  pClient: number,
  pMonster: number,
  stateCode: number,
  hitClass = 0,
): number {
  if (pMonster === 0) return 0
  const coords = getUnitCoordsK2(m, pMonster)
  const pkt = new Uint8Array(12)
  pkt[0] = 0x69
  writeU32LEK2(pkt, 1, m.get(pMonster, D2UnitStrc.dwUnitId) >>> 0)
  pkt[5] = stateCode & 0xff
  writeU16LEK2(pkt, 6, coords.x)
  writeU16LEK2(pkt, 8, coords.y)
  pkt[10] = STATLIST_GetUnitLifePercent113c(m, pMonster) & 0xff
  pkt[11] = hitClass & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB690` (`0x6C` `NpcAttack`, `16B`): `[0x6C, u32 unitId, u8 atkCode, u8 targetType, u32 targetId, u8 hitClass, u16 curX, u16 curY]`. */
export function S2C_SendPacket6C_NpcAttack113c(
  m: Memory113c,
  pClient: number,
  pMonster: number,
  atkCode: number,
  pTarget: number,
  hitClass = 0,
): number {
  if (pMonster === 0) return 0
  const coords = getUnitCoordsK2(m, pMonster)
  const pkt = new Uint8Array(16)
  pkt[0] = 0x6c
  writeU32LEK2(pkt, 1, m.get(pMonster, D2UnitStrc.dwUnitId) >>> 0)
  pkt[5] = atkCode & 0xff
  pkt[6] = pTarget !== 0 ? (m.u32(pTarget) & 0xff) : 0
  writeU32LEK2(pkt, 7, pTarget !== 0 ? (m.get(pTarget, D2UnitStrc.dwUnitId) >>> 0) : 0)
  pkt[11] = hitClass & 0xff
  writeU16LEK2(pkt, 12, coords.x)
  writeU16LEK2(pkt, 14, coords.y)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAB700` (`0x6D` `NpcStop`, `10B`): `[0x6D, u32 unitId, u16 wX, u16 wY, u8 lifeByte]`. */
export function S2C_SendPacket6D_NpcStop113c(
  m: Memory113c,
  pClient: number,
  unitId: number,
  wX: number,
  wY: number,
  lifeByte: number,
): number {
  const pkt = new Uint8Array(10)
  pkt[0] = 0x6d
  writeU32LEK2(pkt, 1, unitId)
  writeU16LEK2(pkt, 5, wX)
  writeU16LEK2(pkt, 7, wY)
  pkt[9] = lifeByte & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAAF10` (`0x8A` `NpcWantsInteract`, `6B`): `[0x8A, u8 unitType, u32 unitId]`. */
export function S2C_SendPacket8A_NpcWantsInteract113c(
  m: Memory113c,
  pClient: number,
  unitType: number,
  unitId: number,
): number {
  const pkt = new Uint8Array(6)
  pkt[0] = 0x8a
  pkt[1] = unitType & 0xff
  writeU32LEK2(pkt, 2, unitId)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCAAF50` (`0x8D` `AssignPlayerToParty`, `7B`): `[0x8D, u32 playerId, u16 partyId]`. */
export function S2C_SendPacket8D_AssignParty113c(
  m: Memory113c,
  pClient: number,
  playerId: number,
  partyId: number,
): number {
  const pkt = new Uint8Array(7)
  pkt[0] = 0x8d
  writeU32LEK2(pkt, 1, playerId)
  writeU16LEK2(pkt, 5, partyId)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/**
 * `@va D2Game:0x6FCAAFA0` (`0x99` `SkillTriggered`, `16B`):
 * `[0x99, u8 attType, u32 attId, u16 skillId, u8 slvl, u8 defType, u32 defId, u16 bItem]`.
 */
export function S2C_SendPacket99_SkillTriggered113c(
  m: Memory113c,
  pClient: number,
  attType: number,
  attId: number,
  skillId: number,
  slvl: number,
  defType: number,
  defId: number,
  bItem = 1,
): number {
  const pkt = new Uint8Array(16)
  pkt[0] = 0x99
  pkt[1] = attType & 0xff
  writeU32LEK2(pkt, 2, attId)
  writeU16LEK2(pkt, 6, skillId)
  pkt[8] = slvl & 0xff
  pkt[9] = defType & 0xff
  writeU32LEK2(pkt, 10, defId)
  writeU16LEK2(pkt, 14, bItem)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/**
 * `@va D2Game:0x6FC3EC20` / `0x6FCAB100` (`0x9C` `WorldItemAction`, variable length `pkt[2]`):
 * Serializes `pItem` via `D2Common.#10847` (`ITEMS_SerializeItemToBuffer113c`) using raw `D2ItemDataStrc`
 * offsets (`+0x0C` `dwOwnerGUID`, `+0x10` `dwInitSeed`, `+0x14` `dwCommandFlags`, `+0x18` `dwItemFlags`,
 * `+0x28` `dwFileIndex` — avoiding the 3 swapped field names in `layout.generated.ts`!) and queues `[0x9C, action, totalLen, cat, itemGuid, bitstream...]`
 * to `pClient` via `0x6FCAA3E0`.
 */
/**
 * `@va D2Game:0x6FCAD3D0` (`D2GAME_PACKET_SendItem0x9C`):
 * Resolves `INVENTORY_GetItemEquipLocation113c(pClientPlayer, pItem)` (`D2Common.#10921`) into `pkt[3]`,
 * serializes `pItem` via `D2Common.#10987` (`ITEMS_SerializeItemToBuffer113c(m, pItem, pScratch, 0xF4, 0, 0, bSimpleItemCodeOnly)`),
 * and queues `[0x9C, action, totalLen, equipLoc, itemGuid, bitstream...]` to `pClient` via `0x6FCAA3E0`.
 */
export function S2C_SendPacket9C_WorldItemAction113c(
  m: Memory113c,
  pClient: number,
  pItem: number,
  action = 0,
  dwExtraItemFlags = 0,
  bSimpleItemCodeOnly = 0,
): number {
  if (pClient === 0 || pItem === 0 || m.u32(pItem) !== UNIT_ITEM) return 0
  const pClientPlayer = m.u32((pClient + 0x174) >>> 0) >>> 0
  const savedSp = k2RealStackPtr
  const pScratch = k2RealStackPtr
  k2RealStackPtr = (k2RealStackPtr + 0x100) >>> 0
  try {
    for (let i = 0; i < 0xf4; i += 4) {
      m.setU32((pScratch + i) >>> 0, 0)
    }
    const equipLoc = INVENTORY_GetItemEquipLocation113c(m, pClientPlayer, pItem) & 0xff
    const pItemData = m.u32((pItem + 0x14) >>> 0) >>> 0
    const savedFlags = pItemData !== 0 ? (m.u32((pItemData + 0x18) >>> 0) >>> 0) : 0
    if (pItemData !== 0 && dwExtraItemFlags !== 0) {
      m.setU32((pItemData + 0x18) >>> 0, (savedFlags | dwExtraItemFlags) >>> 0)
    }
    const nStreamBytes =
      ITEMS_SerializeItemToBuffer113c(
        m,
        pItem,
        pScratch,
        0xf4,
        0,
        0,
        bSimpleItemCodeOnly,
      ) | 0
    if (pItemData !== 0 && dwExtraItemFlags !== 0) {
      m.setU32((pItemData + 0x18) >>> 0, savedFlags)
    }
    if (nStreamBytes <= 0) return 0
    const totalLen = (8 + nStreamBytes) & 0xff
    const pkt = new Uint8Array(totalLen)
    pkt[0] = 0x9c
    pkt[1] = action & 0xff
    pkt[2] = totalLen
    pkt[3] = equipLoc
    writeU32LEK2(pkt, 4, m.get(pItem, D2UnitStrc.dwUnitId) >>> 0)
    for (let i = 0; i < nStreamBytes; i++) {
      pkt[8 + i] = m.u8((pScratch + i) >>> 0)
    }
    return NET_QueuePacketToClient113c(m, pClient, pkt)
  } finally {
    k2RealStackPtr = savedSp
  }
}

/** `@va D2Game:0x6FCABDF0` (`0xA7` `DelayedState`, `7B`): `[0xA7, u8 unitType, u32 unitId, u8 stateId]`. */
export function S2C_SendPacketA7_DelayedState113c(
  m: Memory113c,
  pClient: number,
  unitType: number,
  unitId: number,
  stateId: number,
): number {
  const pkt = new Uint8Array(7)
  pkt[0] = 0xa7
  pkt[1] = unitType & 0xff
  writeU32LEK2(pkt, 2, unitId)
  pkt[6] = stateId & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCABE30` (`0xA8` `SetState`, variable `pkt[6]`): `[0xA8, u8 unitType, u32 unitId, u8 totalLen, u8 stateId, ...bitstream]`. */
export function S2C_SendPacketA8_SetState113c(
  m: Memory113c,
  pClient: number,
  unitType: number,
  unitId: number,
  stateId: number,
  extraPayload?: Uint8Array,
): number {
  const extraLen = extraPayload ? extraPayload.byteLength : 1
  const totalLen = 8 + extraLen
  const pkt = new Uint8Array(totalLen)
  pkt[0] = 0xa8
  pkt[1] = unitType & 0xff
  writeU32LEK2(pkt, 2, unitId)
  pkt[6] = totalLen & 0xff
  pkt[7] = stateId & 0xff
  if (extraPayload) {
    pkt.set(extraPayload, 8)
  } else {
    pkt[8] = 0xff
  }
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCABED0` (`0xA9` `EndState`, `7B`): `[0xA9, u8 unitType, u32 unitId, u8 stateId]`. */
export function S2C_SendPacketA9_EndState113c(
  m: Memory113c,
  pClient: number,
  unitType: number,
  unitId: number,
  stateId: number,
): number {
  const pkt = new Uint8Array(7)
  pkt[0] = 0xa9
  pkt[1] = unitType & 0xff
  writeU32LEK2(pkt, 2, unitId)
  pkt[6] = stateId & 0xff
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/**
 * `@va D2Game:0x6FCABF10` (`0xAA` `StateAddList`, variable `pkt[6]`):
 * Packs active GFX state mask on `pUnit` (`pStatListEx->dwGfxStates[0..5]` at `+0x4C..+0x60`) into
 * `[0xAA, u8 unitType, u32 unitId, u8 totalLen, ...stateBitstream]` via `LsbBitPacker113c`.
 */
export function S2C_SendPacketAA_StateSync113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
): number {
  if (pUnit === 0) return 0
  const bp = new LsbBitPacker113c(48)
  const pStatListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pStatListEx !== 0 && (m.u32((pStatListEx + 0x10) >>> 0) & 0x80000000) !== 0) {
    for (let stateId = 0; stateId < 184; stateId++) {
      if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
        bp.writeBits(stateId, 8)
        bp.writeBits(0, 1) // no stat payload
      }
    }
  }
  bp.writeBits(0xff, 8)
  const streamLen = bp.byteLength()
  const totalLen = 7 + streamLen
  const pkt = new Uint8Array(totalLen)
  pkt[0] = 0xaa
  pkt[1] = m.u32(pUnit) & 0xff
  writeU32LEK2(pkt, 2, m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0)
  pkt[6] = totalLen & 0xff
  pkt.set(bp.buf.subarray(0, streamLen), 7)
  return NET_QueuePacketToClient113c(m, pClient, pkt)
}

/** `@va D2Game:0x6FCABFA0` (`0xAB` `NpcHeal`, `7B`): delegates to `NET_SendPacket0xAB_UnitHeal113c`. */
export function S2C_SendPacketAB_UnitHeal113c(
  m: Memory113c,
  pClient: number,
  unitType: number,
  unitId: number,
  lifeByte: number,
): void {
  NET_SendPacket0xAB_UnitHeal113c(m, unitType, unitId, pClient, lifeByte)
}

/** `@va D2Game:0x6FCAC020` (`0xAC` `AssignNpc`, variable `pkt[12]`): delegates to `D2GAME_PACKET_SendMonsterAssign113c`. */
export function S2C_SendPacketAC_AssignMonster113c(
  m: Memory113c,
  pClient: number,
  pMonster: number,
  sgptDataTablesPtr = 0,
): void {
  D2GAME_PACKET_SendMonsterAssign113c(m, pMonster, pClient, sgptDataTablesPtr)
}

/**
 * `@va D2Game:0x6FCEC030` (`PLAYER_SyncLifeManaStaminaGoldExp`, `696B`):
 * Exact 1.13c per-frame player pool & attribute delta synchronizer (`[pClient + 0x1D0]` shadow cache):
 * - Compares `wHP (6 >> 8)`, `wMP (8 >> 8)`, `wStamina (10 >> 8)`, `bHPRegen`, `bMPRegen`, `wX`, `wY`
 *   against the client's last-sent snapshot (`+0x1D0..+0x1E8` on `D2ClientStrc`):
 *   - Regen changed -> `0x18` (`15B` `S2C_SendPacket18_LifeManaPot113c`)
 *   - HP or MP changed (`>= 10%` or `bForce != 0` or zero-crossing per `0x6FCEC0BF`) -> `0x95` (`13B` `S2C_SendPacket95_LifeManaChange113c`)
 *   - Stamina or position delta `>= 2` changed -> `0x96` (`9B` `S2C_SendPacket96_WalkVerify113c`)
 * - Syncs `STAT_GOLD (14)` (`0x19` / `0x1D..0x1F`) and `STAT_EXPERIENCE (13)` (`0x1A..0x1C`) deltas!
 */
export function PLAYER_SyncLifeManaStaminaGoldExp113c(
  m: Memory113c,
  pPlayer: number,
  bForce = 0,
): number {
  if (pPlayer === 0 || m.u32(pPlayer) !== UNIT_PLAYER) return 0
  const pClient = getPlayerClientPtrK2(m, pPlayer)
  if (pClient === 0 || m.u32((pClient + 0x04) >>> 0) !== 4) return 0

  const hp = (STATLIST_GetUnitStat113c(m, pPlayer, 6, 0) >> 8) & 0x7fff
  const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, pPlayer) >> 8
  if (maxHp <= 0) return 0

  const mp = (STATLIST_GetUnitStat113c(m, pPlayer, 8, 0) >> 8) & 0x7fff
  const stam = (STATLIST_GetUnitStat113c(m, pPlayer, 10, 0) >> 8) & 0x7fff
  const coords = getUnitCoordsK2(m, pPlayer)

  // Shadow state at pClient + 0x1D0 (`+0x00` initFlag, `+0x04` wHP, `+0x06` wMP, `+0x08` wStam, `+0x0A` hpRegen, `+0x0B` mpRegen, `+0x0C` wX, `+0x0E` wY, `+0x10` dwExp, `+0x14` dwGold)
  const pShadow = (pClient + 0x1d0) >>> 0
  const initFlag = m.u32(pShadow) >>> 0
  const prevHp = m.u16((pShadow + 0x04) >>> 0)
  const prevMp = m.u16((pShadow + 0x06) >>> 0)
  const prevStam = m.u16((pShadow + 0x08) >>> 0)
  const prevHpReg = m.u8((pShadow + 0x0a) >>> 0)
  const prevMpReg = m.u8((pShadow + 0x0b) >>> 0)
  const prevX = m.u16((pShadow + 0x0c) >>> 0)
  const prevY = m.u16((pShadow + 0x0e) >>> 0)

  const curHpReg = ((STATLIST_GetUnitStat113c(m, pPlayer, 74, 0) | 0) >> 2) & 0x7f
  const curMpReg = (STATLIST_GetUnitStat113c(m, pPlayer, 27, 0) | 0) & 0x7f

  let sent = 0
  if (initFlag === 0) {
    m.setU32(pShadow, 1)
    m.setU16((pShadow + 0x04) >>> 0, hp)
    m.setU16((pShadow + 0x06) >>> 0, mp)
    m.setU16((pShadow + 0x08) >>> 0, stam)
    m.setU8((pShadow + 0x0a) >>> 0, curHpReg)
    m.setU8((pShadow + 0x0b) >>> 0, curMpReg)
    m.setU16((pShadow + 0x0c) >>> 0, coords.x)
    m.setU16((pShadow + 0x0e) >>> 0, coords.y)
    m.setU32((pShadow + 0x10) >>> 0, STATLIST_GetUnitStat113c(m, pPlayer, 13, 0) >>> 0)
    m.setU32((pShadow + 0x14) >>> 0, STATLIST_GetUnitStat113c(m, pPlayer, 14, 0) >>> 0)
    if (bForce === 0) return 0
  }

  const hpDiff = Math.abs(hp - prevHp)
  const hpSignificant =
    bForce !== 0 ||
    Math.trunc((hpDiff * 100) / maxHp) >= 10 ||
    (hp === 0 && prevHp !== 0)

  if (curHpReg !== prevHpReg || curMpReg !== prevMpReg) {
    S2C_SendPacket18_LifeManaPot113c(m, pClient, hp, mp, stam, curHpReg, curMpReg, coords.x, coords.y, 0, 0)
    sent = 1
  } else if ((hp !== prevHp && hpSignificant) || mp !== prevMp) {
    S2C_SendPacket95_LifeManaChange113c(m, pClient, hp, mp, stam, coords.x, coords.y, 0, 0)
    sent = 1
  } else if (stam !== prevStam || Math.abs(coords.x - prevX) >= 2 || Math.abs(coords.y - prevY) >= 2) {
    if (bForce !== 0 || stam !== prevStam) {
      S2C_SendPacket96_WalkVerify113c(m, pClient, stam, coords.x, coords.y, 0, 0)
      sent = 1
    }
  }

  if (sent !== 0) {
    m.setU16((pShadow + 0x04) >>> 0, hp)
    m.setU16((pShadow + 0x06) >>> 0, mp)
    m.setU16((pShadow + 0x08) >>> 0, stam)
    m.setU8((pShadow + 0x0a) >>> 0, curHpReg)
    m.setU8((pShadow + 0x0b) >>> 0, curMpReg)
    m.setU16((pShadow + 0x0c) >>> 0, coords.x)
    m.setU16((pShadow + 0x0e) >>> 0, coords.y)
  }
  return sent
}

/**
 * `@va D2Game:0x6FC9A5E0` (`STATES_SendStatePackets`, `848B`):
 * Exact 1.13c dirty GFX state packet builder (`0xA7` `DelayedState`, `0xA8` `SetState`, `0xA9` `EndState`):
 * - Scans dirty bits in `pStatListEx->pStateFlags[6..11]` (`stateId` `0..183`), skipping `StatesTxt` entries
 *   with client-ignore bit (`u8[pStatesTxt + stateId * 0x3C + 0x10] & 0x01`).
 * - When `STATES_CheckState113c(pUnit, stateId) == 0`: queues `7`-byte `0xA9` (`EndState`, e.g. `a9010b00000002`!).
 * - Else when `pSub = STATLIST_GetStatListFromUnitAndStateMemPort113c(pUnit, stateId)` has `wStatCount > 0`:
 *   packs each stat with `ItemStatCostTxt.SendBits (+0x08)` in `1..31` (`9b(statId) | [sendParamBits(param)] | sendBits(val)`),
 *   appends `9`-bit `0x1FF` terminator (`ff 01`), and queues `0xA8` (`SetState`, e.g. `a8010b0000000a02ff01`!).
 * - Else: queues `7`-byte `0xA7` (`DelayedState`).
 */
export function STATES_SendStatePackets113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  if (pUnit === 0 || pClient === 0) return
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0 || (m.get(pListEx, D2StatListStrc.dwFlags) & 0x80000000) === 0) return
  const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
  if (pStateFlags === 0) return

  const uType = m.get(pUnit, D2UnitStrc.dwUnitType) & 0xff
  const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0

  const pDataTables = m.u32(0x6fde9e1c) >>> 0
  const pStatesTxt = pDataTables !== 0 ? (m.u32((pDataTables + 0xbc) >>> 0) >>> 0) : 0
  const nStates = pDataTables !== 0 ? (m.u32((pDataTables + 0xc4) >>> 0) | 0) : 185
  const pIscTxt = pDataTables !== 0 ? (m.u32((pDataTables + 0xbcc) >>> 0) >>> 0) : 0
  const nIsc = pDataTables !== 0 ? (m.u32((pDataTables + 0xbd4) >>> 0) | 0) : 0

  for (let wIdx = 0; wIdx < 6; wIdx++) {
    let dirtyWord = m.u32((pStateFlags + (6 + wIdx) * 4) >>> 0) >>> 0
    while (dirtyWord !== 0) {
      const bit = Math.clz32(dirtyWord & -dirtyWord) ^ 31
      dirtyWord = (dirtyWord & ~(1 << bit)) >>> 0
      const stateId = wIdx * 32 + bit
      if (stateId < 0 || stateId >= nStates) continue
      if (pStatesTxt !== 0 && (m.u8((pStatesTxt + stateId * 0x3c + 0x10) >>> 0) & 0x01) !== 0) {
        continue
      }

      if (STATES_CheckState113c(m, pUnit, stateId) === 0) {
        S2C_SendPacketA9_EndState113c(m, pClient, uType, uId, stateId)
        continue
      }

      const pSub = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId) >>> 0
      if (pSub === 0) {
        S2C_SendPacketA7_DelayedState113c(m, pClient, uType, uId, stateId)
        continue
      }

      const wCount = m.get(pSub, D2StatListStrc.wStatCount) | 0
      const pStats = m.get(pSub, D2StatListStrc.pStat) >>> 0
      if (wCount <= 0 || pStats === 0) {
        S2C_SendPacketA7_DelayedState113c(m, pClient, uType, uId, stateId)
        continue
      }

      const bp = new LsbBitPacker113c(244)
      const cap = wCount > 16 ? 16 : wCount
      for (let i = 0; i < cap; i++) {
        const statOff = (pStats + i * 8) >>> 0
        const wParam = m.u16(statOff) & 0xffff
        const wStatId = m.u16((statOff + 2) >>> 0) | 0
        let val = m.u32((statOff + 4) >>> 0) | 0
        if (wStatId < 0 || wStatId >= nIsc || pIscTxt === 0) continue
        const pIscRow = (pIscTxt + wStatId * 0x144) >>> 0
        const sendBits = m.u8((pIscRow + 0x08) >>> 0) | 0
        if (sendBits <= 0 || sendBits >= 32) continue
        const isSigned = (m.u8((pIscRow + 0x04) >>> 0) & 0x10) !== 0
        if (isSigned) {
          const minV = -(1 << (sendBits - 1))
          const maxV = (1 << (sendBits - 1)) - 1
          if (val < minV) val = minV
          if (val > maxV) val = maxV
        } else {
          const maxV = (1 << sendBits) - 1
          if (val < 0) val = 0
          if (val > maxV) val = maxV
        }
        bp.writeBits(wStatId, 9)
        const sendParamBits = m.u8((pIscRow + 0x09) >>> 0) | 0
        if (sendParamBits > 0) {
          bp.writeBits(wParam, sendParamBits)
        }
        bp.writeBits(val >>> 0, sendBits)
      }
      bp.writeBits(0x1ff, 9)
      S2C_SendPacketA8_SetState113c(
        m,
        pClient,
        uType,
        uId,
        stateId,
        bp.buf.subarray(0, bp.byteLength()),
      )
    }
  }
}

/**
 * `@va D2Game:0x6FCBDEC0` (`CLIENT_SyncAdjacentRoomUpdates`, `124B`):
 * Walks `pRoom`'s adjacent rooms (`ppRoomsNear[0..nRoomsNear-1]` or `[pRoom]` if unpopulated) and
 * synchronizes every unit in `r->pUpdateList (+0x1C)` (`0x6FCBDE10 -> 0x6FCBDCD0 -> 0x6FD13A40 / 0x6FC988B0`):
 * - Flushes queued unit-notify packets on `u + 0xEC` (such as `0xAB` `UnitHeal` from `0x6FC9A260`).
 * - Emits dirty GFX state updates (`0xA7` / `0xA8` / `0xA9`) via `STATES_SendStatePackets113c` (`0x6FC9A5E0`).
 */
export function CLIENT_SyncAdjacentRoomUpdates113c(
  m: Memory113c,
  pGame: number,
  pClient: number,
  pRoom: number,
): void {
  void pGame
  if (pClient === 0 || pRoom === 0) return

  const syncSingleRoomUpdateList = (r: number): void => {
    if (r === 0) return
    let u = m.get(r, D2ActiveRoomStrc.pUpdateList) >>> 0
    while (u !== 0) {
      const nextU = m.get(u, D2UnitStrc.pRoomUpdateNext) >>> 0
      const uType = m.get(u, D2UnitStrc.dwUnitType) >>> 0
      if (uType === UNIT_PLAYER || uType === UNIT_MONSTER) {
        let pNotify = m.u32((u + 0xec) >>> 0) >>> 0
        while (pNotify !== 0) {
          const op = m.u8((pNotify + 0x04) >>> 0)
          if (op === 0xab) {
            const pClientPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
            if (
              pClientPlayer === 0 ||
              SUNIT_AreUnitsHostileOrUnaligned113c(
                m,
                pClientPlayer,
                u,
                D2GAME_SUNIT_GetGameFromUnit113c(m, pClientPlayer),
              ) !== 0
            ) {
              S2C_SendPacketAB_UnitHeal113c(
                m,
                pClient,
                m.u8((pNotify + 0x08) >>> 0),
                m.u32((pNotify + 0x0c) >>> 0) >>> 0,
                m.u8((pNotify + 0x10) >>> 0),
              )
            }
          }
          pNotify = m.u32(pNotify) >>> 0
        }
        STATES_SendStatePackets113c(m, u, pClient)
      }
      u = nextU
    }
  }

  const nNear = m.get(pRoom, D2ActiveRoomStrc.nRoomsNear) >>> 0
  const ppNear = m.get(pRoom, D2ActiveRoomStrc.ppRoomsNear) >>> 0
  if (nNear > 0 && ppNear !== 0) {
    for (let i = 0; i < nNear; i++) {
      syncSingleRoomUpdateList(m.u32((ppNear + i * 4) >>> 0) >>> 0)
    }
  } else {
    syncSingleRoomUpdateList(pRoom)
  }
}

/**
 * `@va D2Game:0x6FCBD850` (`GAME_ClearAllRoomUpdateQueues`, `112B`):
 * Walks every active room across Acts `0..4` (`pGame + 0xBC + act * 4`), clearing unit notify lists (`+0xEC`),
 * dirty GFX state dwords (`pStateFlags[6..11]`), and `UNITROOM_ClearUpdateQueue113c(m, pRoom)`.
 */
export function GAME_ClearAllRoomUpdateQueues113c(m: Memory113c, pGame: number): void {
  if (pGame === 0) return
  for (let act = 0; act < 5; act++) {
    const pAct = m.u32((pGame + 0xbc + act * 4) >>> 0) >>> 0
    if (pAct === 0) continue
    let pRoom = m.u32((pAct + 0x04) >>> 0) >>> 0
    while (pRoom !== 0) {
      let u = m.get(pRoom, D2ActiveRoomStrc.pUpdateList) >>> 0
      while (u !== 0) {
        const nextU = m.get(u, D2UnitStrc.pRoomUpdateNext) >>> 0
        let pNotify = m.u32((u + 0xec) >>> 0) >>> 0
        while (pNotify !== 0) {
          const nextN = m.u32(pNotify) >>> 0
          freeMemNodeK2(m, pNotify)
          pNotify = nextN
        }
        m.setU32((u + 0xec) >>> 0, 0)
        m.setU32((u + 0xf0) >>> 0, 0)

        const pListEx = m.get(u, D2UnitStrc.pStatListEx)
        if (pListEx !== 0 && (m.get(pListEx, D2StatListStrc.dwFlags) & 0x80000000) !== 0) {
          const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
          if (pStateFlags !== 0) {
            for (let wIdx = 0; wIdx < 6; wIdx++) {
              m.setU32((pStateFlags + (6 + wIdx) * 4) >>> 0, 0)
            }
          }
        }
        u = nextU
      }
      UNITROOM_ClearUpdateQueue113c(m, pRoom)
      pRoom = m.get(pRoom, D2ActiveRoomStrc.pRoomNext)
    }
  }
}

/**
 * `@va D2Game:0x6FC6B400` (`CLIENT_SyncRoomAndUnits`):
 * End-of-frame per-client room, adjacent-unit (`0xA7`, `0xA8`, `0xA9`, `0xAB`, `0xAC`, `0x51`, `0x09`, `0x9C`, `0xAA`),
 * and player life/mana/stamina (`0x95`/`0x96`/`0x18`) synchronization pass called by `GAME_UpdateGameFrame113c` (`0x6FC4E050`)
 * before `drainFrameS2CPackets113c` (`0x6FC4D500`).
 */
export function CLIENT_SyncRoomAndUnits113c(m: Memory113c, pGame: number): void {
  if (pGame === 0) return

  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    if (m.u32((pClient + 0x04) >>> 0) === 4) {
      const pPlayer = m.u32((pClient + 0x174) >>> 0) >>> 0
      let pClientRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
      if (pClientRoom === 0) {
        pClientRoom = m.u32((pClient + 0x178) >>> 0) >>> 0
      }
      if (pPlayer !== 0) {
        const pCurRoom = UNITS_GetRoom113c(m, pPlayer)
        if (pCurRoom !== 0 && pCurRoom !== pClientRoom) {
          CLIENTS_SetPlayerCurrentRoom113c(m, pClient, pCurRoom)
          pClientRoom = pCurRoom
        }
      }
      if (pClientRoom !== 0) {
        CLIENT_SyncAdjacentRoomUpdates113c(m, pGame, pClient, pClientRoom)
      }
      if (pPlayer !== 0) {
        PLAYER_SyncLifeManaStaminaGoldExp113c(m, pPlayer, 0)
      }
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
  }

  GAME_ClearAllRoomUpdateQueues113c(m, pGame)
}
