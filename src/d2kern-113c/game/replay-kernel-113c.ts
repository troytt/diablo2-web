/**
 * Diablo II v1.13c Pure Kernel Vertical Slice:
 * - `D2ActiveRoomStrc` death ring (`D2Common.#10873` `0x6FD8AFD0`)
 * - `D2DynamicPathStrc` (`0x200` bytes) memory-native `D2Common.dll` path ordinals (`../common/path.ts`)
 * - `MONSTER_SavePrevMode` (`0x6FC95260`), `MONSTER_StartMove` (`0x6FC94F90`), `MONSTER_UpdateVelocityAndRate` (`0x6FC94CE0`)
 * - `MONSTER_StartMode` (`0x6FC95E10`), `MONSTER_StepPath` (`0x6FD01930`), `MONSTER_StepWalk` (`0x6FC97010`), `MONSTER_StepRun` (`0x6FC96FE0`)
 * - `MONSTER_EndToAiOrNeutral` (`0x6FC96BF0`), `MONSTER_StartDeath` (`0x6FC96270`), `MONSTER_EndDeath` (`0x6FC96040`)
 * - `AI_RunMonsterAI` (`0x6FCBD3B0` -> `0x6FCBD160` -> `0x6FD13220`), `AiFallen` (`0x6FCA3130`), `AiZombie` (`0x6FCA38B0`)
 * - `AI_ApproachTarget` (`0x6FD12540`), `AI_FleeFrom` (`0x6FD12D80`), `AI_IdleWander` (`0x6FD11B10`), `AI_Stall` (`0x6FD122C0`)
 * - `SUNITDMG_CheckToHit` (`0x6FCFDE90`), `SUNITDMG_RollDamageValues` (`0x6FCFD450`), `SUNITDMG_ExecuteEvents` (`0x6FCFE0C0`),
 *   `SUNITDMG_CalculateExperienceGain` (`0x6FCFC030`), `ITEMS_RollMonsterTreasureClass` (`0x6FC51000`)
 * - `PLAYER_DrainRunStamina` (`0x6FC97BB0`), `PLAYER_Event3_RegenTick` (`0x6FC99B10`: `0x6FC97CB0` / `0x6FC97A50` / `0x6FC97950`),
 *   `PLAYER_Event11_PeriodicTick` (`0x6FC99A60`), and `AnimData.d2` player `0x06` melee timing.
 *
 * Zero legacy server imports: runs purely against `SparseMemory113c` + `D2TimerStrc` (`0x6FCAF070`).
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AiCmdStrc,
  D2AiCmdStrc_SIZE,
  D2AiControlStrc,
  D2AiGeneralStrc,
  D2DamageStrc,
  D2DamageStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2DynamicPathStrc,
  D2EventStrc,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MonsterDataStrc,
  D2RoomCollisionGridStrc,
  D2RoomCollisionGridStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2StatListExStrc,
  D2StatListExStrc_SIZE,
  D2StatListStrc,
  D2TimerStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import { seedNext, seedRoll, type D2SeedStrc } from '../prng.ts'
import { mulDiv113c } from '../common/int-math.ts'
import {
  SKILLS_AddSkillToUnit113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillById113c,
  SKILLS_SetRightSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../common/skills.ts'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetActiveWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  INVENTORY_GetWeaponByHandSlotMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_ExpireStateListsOnModeChangeMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { UNITS_GetLeftSkill113c } from '../common/quest-record.ts'
import {
  MISSILE_DefaultSrvHitFlagsK3_113c,
  MISSMODE_SrvDmg07_WarcryShockWaveK3_113c,
  MISSMODE_SrvHit18_ShoutBattleOrdersCommandK3_113c,
  PLAYER_BindLeftSkillAsUsedK3_113c,
  PLAYER_CanStartModeAndSkillK3_113c,
  PLAYER_Event0C_ExpireTimedStatsWithSyncK3_113c,
  PLAYER_TryStartDodgeOrAvoidModeK3_113c,
  PLAYER_ValidatePacket0CLocationCastK3_113c,
  SKILLS_SrvDo068_BasicShoutK3_113c,
} from './k3-p52-handlers-113c.ts'
import {
  applyHireableModeVelocityOverrideK3_113c,
  awardMonsterKillExperienceWithMercK3_113c,
  hydrateMercHireableSnapshotStateK3_113c,
  onMonsterStartSkillModeK3_113c,
  recordPlayerWalkBreadcrumbK3_113c,
  runHireableAiThinkK3_113c,
  stepMonsterAttackOrSkillActionK3_113c,
} from './k3-merc-hireable-replay-113c.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../common/inline-helpers.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  STATLIST_FreeModStats113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_RemoveStatListFromUnit113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkUnitStatList113c,
  STATES_CheckState113c,
  STATES_ToggleState113c,
  registerStatListFindSubListHook113c,
} from '../common/statlist.ts'
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
  INVENTORY_UpdateWeaponGuidOnRemoval113c,
  registerInventoryCheckNotBrokenHook113c,
} from '../common/inventory.ts'
import { ITEMS_CanUseCharmInInventory113c } from '../common/items.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITROOM_ClearUpdateQueue113c,
  UNITROOM_RefreshUnit113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_ClearGfxStateFlags113c,
  UNITS_GetAnimStartFrame113c,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetPathRoomRefreshFlag113c,
  UNITS_GetRoom113c,
  UNITS_GetSeed113c,
  UNITS_HasAnyGfxStateFlag113c,
  UNITS_IsUnitMovingBool113c,
  UNITS_SetSeed113c,
  UNITS_SetUnitAnimMode113c,
  UNITS_UpdateAnimFrame113c,
} from '../common/unit.ts'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts'
import {
  PATH_Compute113c,
  PATH_ComputeDirection113c,
  PATH_ForceDirection113c,
  PATH_GetLastPointX113c,
  PATH_GetLastPointY113c,
  PATH_GetMaxDistance113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetType113c,
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
} from '../common/path.ts'
import {
  EVENT_AllocChunk113c,
  EVENT_DeleteEventByArg14_113c,
  EVENT_DeleteEventByType113c,
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
  EVENT_UpdateTimers113c,
} from './timer-wheel.ts'
import {
  MON_EVENT_AI_THINK,
  MON_EVENT_MODE_END,
  MON_EVENT_MODE_STEP,
  MON_EVENT_STAT_REGEN,
  MONSTER_ClearModeEvents113c,
  MONSTER_ClearStepEvents113c,
  MONSTER_DispatchEvent113c,
  MONSTER_GetModeEntry113c,
  MONSTER_INLINE_AI_ON_END_TABLE_113C,
  MONSTER_IsContinuousMode113c,
  MONSTER_RegisterContinuousModeEvent113c,
  SUNIT_IsDeadOrDying113c,
} from './monster-events.ts'
import {
  bindK2KernelGlobals113c,
  evaluateTcdropVector113c,
} from './k2-d2tv-evaluators-113c.ts'
import {
  AITHINK_CanPlayerSwitchToMode113c,
  D2NET_SendUnitMovePacket0x10BytesToClient113c,
  D2NET_SendUnitPosSync0x15ToClient113c,
  PLAYER_FinishModeAndResetToNeutral113c,
  PLAYER_SetNeutralOrTownNeutralMode113c,
  PLAYER_SetPathTargetCoordsAndWalk113c,
  PLAYER_StepAnimationModeTick113c,
  QUESTS_StepQuestTimers113c,
  SPLAYER_BroadcastUnitMovementToClient113c,
  SUNIT_UpdateUnitPositionAndRoom113c,
} from './town-runtime-gap-113c.ts'
import {
  C2S_Packet01_WalkToLocation113c,
  C2S_Packet02_WalkToUnit113c,
  C2S_Packet03_RunToLocation113c,
  C2S_Packet04_RunToUnit113c,
  C2S_Packet06_LeftSkillOnUnit113c,
  C2S_Packet3C_SelectSkill113c,
  type C2SPacketCallees113c,
} from './c2s-packet-113c.ts'
import { SUNIT_HASH_OFFSET_BY_TYPE_113C } from './game-strc.ts'
import {
  DUNGEON_AllocAct113c,
  DUNGEON_AreAllAdjacentRoomsActive113c,
  DUNGEON_CountNonPresetRoomsInLevel113c,
  DUNGEON_FreeRoomPortalList113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_SyncActiveRoomStatusChange113c,
  DUNGEON_UpdateInactiveLevels113c,
} from '../common/dungeon.ts'
import {
  DRLGROOM_EnsureRoomAndGetRoom1_113c,
} from '../common/drlg/drlg-room.ts'
import {
  DATATBLS_GetObjGroupTxtRecord113c,
  DATATBLS_GetObjGroupTxtRecordCount113c,
} from '../tables/datatbls-113c.ts'
import {
  CLIENTS_SetPlayerCurrentRoom113c,
  GAME_DeactivateUnusedRoomsTick113c,
  GAME_UpdateActRooms113c,
  ROOM_RefreshUnitsAndLoadSaved113c,
  type ActRoomsCallees113c,
} from './act-rooms-113c.ts'
import {
  ROOM_SpawnMonsterPreset113c,
  type RoomPresetCallees113c,
} from './room-presets-113c.ts'
import {
  OBJECTS_CheckLevelObjectHook113c,
  OBJECTS_InitObjectUnit113c,
  type ObjectSpawnCallees113c,
  type ObjectsPopulateCallees113c,
} from './objects-populate-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
  MONSTER_SpawnAtCoords113c,
  PLAYER_GetParam158_113c,
  PLAYER_GetParam15C_113c,
  REGPOP_CanPopulateRoom113c,
  SUNIT_AllocUnitData113c,
  SUNIT_DeactivateUnitStatesAndEvents113c,
  SUNIT_IsUnitInActiveClientRoom113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import {
  AIGENERAL_InitBossGroup113c,
  AIGENERAL_LinkMinionToLeader113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c.ts'
import {
  NPCS_OnPlayerLevelChange113c,
  PARTY_SendPartyPetsToClient113c,
  PLRINTRO_SendAllPlayerPetsToClient113c,
  QUESTS_NotifyLevelChange113c,
} from './a1c-post150-f150-f276-113c.ts'
import {
  ARENA_GetPlayerArenaFlags113c,
  ARENA_ProcessKillScoreUpdate113c,
  C2S_BroadcastPlayerSkillOrAttackAction113c,
  QUESTS_OnMonsterKill113c,
  S2C_SendPacket0D_UnitStop113c,
  S2C_SendPacket0E_UnitCorpseState113c,
  S2C_SendPacket0F_UnitWalkToTarget113c,
  S2C_SendPacket9C_ItemActionWorld113c,
  SKILLS_DoUsedSkillAction113c,
  SKILLS_StartUsedSkill113c,
  SUNIT_DispatchItemEventCallbacks113c,
  UNITROOM_BroadcastGroundItemIfUpdated113c,
  UNITROOM_IsClientInUnitRoom113c,
  UNITROOM_SendDroppedGroundItemToClient113c,
} from './a1c-post150-f786-f1040-113c.ts'
import {
  CLIENTS_GetPlayerUnit113c,
  CLIENTS_UpdatePlayerRoom113c,
  GAME_ClearAllActRoomUpdateLists113c,
  OBJECTS_SpawnDensityWithSecondaryTorch113c,
  SUNIT_FreeUnit113c,
} from './replay-final11-113c.ts'
import {
  MISSILE_DispatchFrameTick113c,
  MONSTER_Event03_RegenAndPoisonTick113c,
  MONSTER_Event12_ExpireTimedStats113c,
  MONSTER_ExpireDeathStateSubLists113c,
  MONSTER_SendPacket0x0C_LifeSync113c,
  PLAYER_StartCastSkillAtCoords113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
  SKILLS_SrvDo_NovaRing113c,
  type K2GapMeleeDotHooks113c,
} from './k2-gap-melee-dot-113c.ts'
import {
  ITEMEVENT_AttackerTakesDamage113c,
  ITEMEVENT_ChanceToCastSkill113c,
  ITEMEVENT_ManaAfterKill113c,
  ITEMS_DeactivateEquippedItemStats113c,
  MONSTER_SetLastHitModeField54_113c,
  NET_SendUnitTargetedSkillAction113c,
  SKILLS_Event08_AuraPulseTick113c,
  setItemdefGapMonsterKillHook113c,
} from './k2-gap-itemdef-113c.ts'
import {
  D2GAME_INVENTORY_DestroyUnitInventoryItems113c,
  D2GAME_ITEMSTAT_OnStatChangedCallback113c,
  D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c,
  D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c,
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
} from './boot-init-gap-b-113c.ts'
import { SUNIT_FindItemEventNode113c } from './k2-items-tc-w1-113c.ts'
import {
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_SetMaskWithPattern113c,
  COLLISION_SetMaskWithSizeXY113c,
} from '../common/collision.ts'
import {
  MISSILE_BuildK3Hooks113c,
  PLAYER_HandleC2SRightSkillK3_113c,
  PLAYER_IsNonMeleeSequenceSkillK3_113c,
  PLAYER_StepSkillKeyframeK3_113c,
} from './k3-p52-sorc-handlers-113c.ts'
import {
  dispatchAttackerMeleeHitItemEventsK3_113c,
  dispatchItemTimerEventK3_113c,
  runNecroPetAiK3_113c,
  syncVirtualTickCountK3_113c,
} from './k3-summon-curse-replay-113c.ts'
import {
  ACT1_TOWN_DS1_PRESETS_113C,
  bindRoomCollisionGrid113c,
  ensureObjectsTxtTable113c,
  OBJECT_TXT_EXACT_113C,
  getMonStatsTxtPtrPure113c,
  getMonsterModeBaseAnimSpeed256Pure113c,
  getMonsterModeFlagsPure113c,
  getObjectTxtPtrPure113c,
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
  getMonsterModeBaseFrameCountPure113c,
  playerAnimStartFramePure113c,
  type CharStatsPure113c,
  type MonStatsRow113c,
  type PureCharAnimClip113c,
  type PureItemTypeClosure113c,
} from './tables-bootstrap-113c.ts'
import {
  ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c,
  ITEMS_InitCreatedItemStats_6FC31070_113c,
  MONSTER_DropDeathItems_6FC95900_113c,
  OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c,
  SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c,
  isSgptDataTablesLoaded113c,
} from './k2-real-itemdrop-113c.ts'
import { OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c } from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c,
  OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c,
  OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c,
} from './k2-w3b2-113c.ts'
import {
  ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c,
  ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c,
  ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c,
} from './k2-w3b5-113c.ts'
import {
  OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c,
  OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c,
  OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c,
} from './k2-w4b1-113c.ts'
import {
  NET_QueuePacketToClient113c,
  drainFrameS2CPackets113c,
  isFrameS2CTraceActive113c,
} from '../net/packet-sink.ts'
import {
  ACT_FreeAllActRoomPortalLists113c,
  CLIENTS_ForEachInGameClient113c,
  EVENT_ExecuteItemEvents113c,
  EVENT_ExecuteMissileEvents113c,
  EVENT_ExecuteMonsterEvents113c,
  EVENT_ExecuteObjectEvents113c,
  EVENT_ExecutePlayerEvents113c,
  GAME_ExpireItemsAndMinionListsPeriodic113c,
  GAME_StepActEnvironmentCycles113c,
  GAME_StepClientJoinStatesAndTimeouts113c,
  GAME_SyncNewClientWithExistingPlayers113c,
  GAME_UpdateTickRateMetrics113c,
  MONSTER_CalcLifePercentage128_113c,
  OBJECT_CheckRespawnOrPortalInRoom113c,
  OBJECT_SetAnimMode2Wrapper113c,
  OBJECT_SyncStateAndEventsToClient113c,
  QUEST_Act1TownPortalUpdateState113c,
  UNIT_FlushEventNotifyQueueToClient113c,
  UNIT_FreeEventNotifyList113c,
  UNIT_SendFullUnitSyncToClient113c,
  UNIT_SendGfxStatesBitstreamToClient113c,
  UNIT_SyncStateAndStatsToClient113c,
  type BootInitGapACallees113c,
} from './boot-init-gap-a-113c.ts'
import {
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_ARENA_SyncClientKillCountsOnJoin113c,
  D2GAME_MONSTER_ApplyMercStatsOnOwner113c,
  D2GAME_MONSTER_SendMonsterMovementSync113c,
  D2GAME_PACKET_Send0x5BPlayerInGame113c,
  D2GAME_PACKET_Send0x73MissileSync113c,
  D2GAME_PACKET_SendMonsterAssign113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c,
  D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c,
  D2GAME_PLRMODES_DispatchModeSyncToClient113c,
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
  D2GAME_SUMMON_BroadcastPlayerPetsToClient113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
  type BootInitGapBCallees113c,
} from './boot-init-gap-b-113c.ts'
import {
  AIGENERAL_FindAiCommandByType113c,
  AIGENERAL_GetOrAllocAiCommandByType113c,
} from './town-npc-ai-113c.ts'
import {
  AIGENERAL_AllocAiCommand113c,
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_ExpireMinionListsInAct113c,
  AIGENERAL_PopAiCommand113c,
  AI_ApproachTarget113c,
  AI_DispatchTargetByAiFlag113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  AiFallen113c,
  AiZombie113c,
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_EndDeath113c,
  MONSTER_EndToAiOrNeutral113c,
  MONSTER_SavePrevMode113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  MONSTER_StartMove113c,
  MONSTER_StepPath113c,
  MONSTER_StepRun113c,
  MONSTER_StepWalk113c,
  PLAYER_ScheduleAttackActionFrameEvents113c,
  PLAYER_StartBlockMode113c,
  PLAYER_StartModeDispatch113c,
  ROOM_RecordMonsterDeath113c,
  S2C_SendPacket23_SetSkill113c,
  S2C_SendPacket51_AssignObject113c,
  S2C_SendPacket65_PlayerKillCount113c,
  S2C_SendPacket8A_NpcWantsInteract113c,
  S2C_SendPacket99_SkillTriggered113c,
  S2C_SendPacketAB_UnitHeal113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyArmorDurabilityAndGetHit113c,
  SUNITDMG_CheckToHit113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FillDamageValues113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c,
  UNITS_GetDistanceToCoordinates113c,
  registerKernelMonsterAiBridge113c,
  type MonsterSliceWorldLike113c,
  type SUnitDmgHooks113c,
} from './k2-real-s2c-combat-113c.ts'

export {
  AIGENERAL_AllocAiCommand113c,
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_ExpireMinionListsInAct113c,
  AIGENERAL_PopAiCommand113c,
  AI_ApproachTarget113c,
  AI_DispatchTargetByAiFlag113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  AiFallen113c,
  AiZombie113c,
  MONSTER_BroadcastEventSoundToClients113c,
  MONSTER_EndDeath113c,
  MONSTER_EndToAiOrNeutral113c,
  MONSTER_SavePrevMode113c,
  MONSTER_StartDeath113c,
  MONSTER_StartMode113c,
  MONSTER_StartMove113c,
  MONSTER_StepPath113c,
  MONSTER_StepRun113c,
  MONSTER_StepWalk113c,
  ROOM_RecordMonsterDeath113c,
  UNITS_GetDistanceToCoordinates113c,
}
import { hitD2CommonVa113c, hitD2GameVa113c } from '../va-trace-113c.ts'

const COLLIDE_MASK_INVALID_113C = 0xffff
const PATHTYPE_TOWARD_FINISH_113C = 13
const PATHTYPE_WALL_FOLLOW_113C = 15

export const VA_AI_FALLEN_113C = 0x6fca3130
export const VA_AI_ZOMBIE_113C = 0x6fca38b0
export const VA_MONSTER_STEP_WALK_113C = 0x6fc97010
export const VA_MONSTER_STEP_RUN_113C = 0x6fc96fe0
export const VA_MONSTER_STEP_ATTACK_113C = 0x6fc95ce0
export const VA_MONSTER_CLEAR_STEP_113C = 0x6fc95320
export const VA_MONSTER_END_DEATH_113C = 0x6fc96040
export const VA_MONSTER_END_TO_AI_113C = 0x6fc96bf0

const STAT_STRENGTH = 0
const STAT_DEXTERITY = 2
const STAT_HITPOINTS = 6
const STAT_MAXHP = 7
const STAT_MANA = 8
const STAT_MAXMANA = 9
const STAT_STAMINA = 10
const STAT_MAXSTAMINA = 11
const STAT_LEVEL = 12
const STAT_EXPERIENCE = 13
const STAT_MAXDAMAGE_PERCENT = 17
const STAT_MINDAMAGE_PERCENT = 18
const STAT_TOHIT = 19
const STAT_TOBLOCK = 20
const STAT_MINDAMAGE = 21
const STAT_MAXDAMAGE = 22
const STAT_DAMAGEPERCENT = 25
const STAT_MANARECOVERY = 26
const STAT_MANARECOVERYBONUS = 27
const STAT_STAMINARECOVERYBONUS = 28
const STAT_ARMORCLASS = 31
const STAT_DAMAGEREDUCTION = 34
const STAT_DAMAGERESIST = 36
const STAT_VELOCITYPERCENT = 67
const STAT_ATTACKRATE = 68
const STAT_DURABILITY = 72
const STAT_MAXDURABILITY = 73
const STAT_HPREGEN = 74
const STAT_ADDEXPERIENCE = 85
const STAT_FASTERATTACKRATE = 93
const STAT_FASTERMOVEVELOCITY = 96
const STAT_MONSTER_PLAYERCOUNT = 100
const STAT_ITEM_NORMALDAMAGE = 111
const STAT_ITEM_TOHIT_PERCENT = 119
const STAT_ITEM_DEADLYSTRIKE = 141
const STAT_ITEM_INDESTRUCTIBLE = 152
const STAT_STAMINADRAINPCT = 154
const STAT_PASSIVE_CRITICAL_STRIKE = 337
const STAT_PASSIVE_DODGE = 338
const STAT_PASSIVE_AVOID = 339
const STAT_PASSIVE_WEAPON_MASTERY_MELEE_TH = 342
const STAT_PASSIVE_WEAPON_MASTERY_MELEE_DMG = 343
const STAT_PASSIVE_WEAPON_MASTERY_MELEE_CRIT = 344
const STAT_PASSIVE_WEAPON_MASTERY_THROW_TH = 345
const STAT_PASSIVE_WEAPON_MASTERY_THROW_DMG = 346
const STAT_PASSIVE_WEAPON_MASTERY_THROW_CRIT = 347
const STAT_HP_TIER_ICON = 352

const PLR_EVENT_MODE_STEP = 0
const PLR_EVENT_MODE_END = 1
const PLR_EVENT_STAMINA = 3
const PLR_EVENT_IDLE = 11

const PLRMODE_NEUTRAL = 1
const PLRMODE_WALK = 2
const PLRMODE_RUN = 3
const PLRMODE_TOWN_NEUTRAL = 5
const PLRMODE_TOWN_WALK = 6
const PLRMODE_ATTACK1 = 7
const PLRMODE_BLOCK = 9

const UNITFLAG_IN_SKILL_ACTION = 0x00000040
const UNITFLAG_MODE_CHANGED_TICK = 0x00080000
const UNITFLAG_PER_TICK_SYNC_MASK = 0x00088511
const UNITFLAG2_CORPSE_SELECTABLE = 0x00020000

const INV_SIGNATURE_113C = 0x01020304
const INV_OFF_PGRIDS = 0x14
const INV_OFF_NGRIDS = 0x18
const INV_OFF_DWWEAPONID = 0x1c
const INVGRID_OFF_PPITEMS = 0x0c
const BODYLOC_COUNT_113C = 13
const BODYLOC_TORSO = 3
const BODYLOC_RARM = 4
const BODYLOC_LARM = 5
const ITYPE_WEAPON_113C = 45
const ITYPE_MELEE_WEAPON_113C = 46
const ITYPE_THROWING_WEAPON_113C = 48
const ITYPE_ANY_ARMOR_113C = 50
const ITEMDATA_OFF_DWFLAGS = 0x18
const ITEMFLAG_BROKEN_113C = 0x00000100
const ITEMFLAG_UNEQUIPPING_113C = 0x00004000
const LEVEL_OFF_DWLEVELNO = 0x1d0

/**
 * `D2Game:0x6FD2E628` (`g_ArmorDurabilityWeights113c`):
 * 7-entry `(bodyLoc, weight)` table scanned by `SUNITDMG_DrainItemDurability` (`0x6FCFEBC6..0x6FCFED1A`)
 * when a player defender takes melee/physical damage.
 */
const ARMOR_DURABILITY_WEIGHTS_113C: ReadonlyArray<{ readonly bodyLoc: number; readonly weight: number }> = [
  { bodyLoc: 1, weight: 3 }, // HEAD
  { bodyLoc: 3, weight: 5 }, // TORSO
  { bodyLoc: 4, weight: 4 }, // RARM
  { bodyLoc: 5, weight: 4 }, // LARM
  { bodyLoc: 8, weight: 2 }, // BELT
  { bodyLoc: 9, weight: 2 }, // FEET
  { bodyLoc: 10, weight: 2 }, // GLOVES
]

export interface D2ItemsTxtRecord113c {
  readonly classId: number
  readonly isWeapon: boolean
  readonly code: string
  readonly wclass: string
  readonly wType1: number
  readonly wType2: number
  readonly strBonus: number
  readonly dexBonus: number
  readonly bNoDurability: number
  readonly dwSpeed: number
}

let replayStackPtr113c = 0x7fb90000

function hasHydratedItemTables113c(m: Memory113c): boolean {
  try {
    return (
      m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) !== 0 &&
      m.u32(0x6fdefb94) !== 0 &&
      m.u32(0x6fdd908c) !== 0
    )
  } catch {
    return false
  }
}

/**
 * `@va D2Common:0x6FD74430` (`D2Common.#10744` `ITEMS_CheckItemTypeId`):
 * Delegates directly to canonical `ITEMS_CheckItemTypeIdMemPort113c` when `sgptDataTables` and
 * `D2ItemsTxt` are mapped; falls back to pure static closure only in bare unit tests.
 */
export function ITEMS_CheckItemTypeId113c(
  m: Memory113c,
  pItem: number,
  itemTypeId: number,
): number {
  if (hasHydratedItemTables113c(m)) {
    return ITEMS_CheckItemTypeIdMemPort113c(m, pItem, itemTypeId)
  }
  if (pItem === 0 || m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 0
  const { ancestorsByIndex } = getItemTypeClosurePure113c()
  const targetType = itemTypeId | 0
  if (targetType <= 0 || targetType >= ancestorsByIndex.length) return 0
  const rec = getItemsTxtRecordPure113c(m.get(pItem, D2UnitStrc.dwClassId))
  if (rec === null) return 0
  const set1 = ancestorsByIndex[rec.wType1]
  if (set1 !== undefined && set1.has(targetType)) return 1
  if (rec.wType2 > 0) {
    const set2 = ancestorsByIndex[rec.wType2]
    if (set2 !== undefined && set2.has(targetType)) return 1
  }
  return 0
}

/**
 * `@va D2Common:0x6FD73EF0` (`D2Common.#11006` `ITEMS_CheckNotBrokenOrUnequipping`):
 * Returns `0` if `pItem == 0`, `1` if `pItem->dwUnitType != UNIT_ITEM` (`0x6FD73EFD: jne 0x6FD73F26`),
 * and for `UNIT_ITEM` returns `1` iff `pItemData == 0` or `(pItemData->dwFlags (+0x18) & 0x4100) == 0`.
 */
export function ITEMS_CheckNotBrokenOrUnequipping113c(m: Memory113c, pItem: number): number {
  hitD2CommonVa113c(0x6FD73EF0)
  if (pItem === 0) return 0
  if (m.get(pItem, D2UnitStrc.dwUnitType) !== UNIT_ITEM) return 1
  const pItemData = m.get(pItem, D2UnitStrc.pUnitData)
  if (pItemData !== 0) {
    const flags = m.u32(pItemData + ITEMDATA_OFF_DWFLAGS)
    if ((flags & (ITEMFLAG_BROKEN_113C | ITEMFLAG_UNEQUIPPING_113C)) !== 0) return 0
  }
  return 1
}

export const DATATABLES_OFF_MONSTATS_COUNT_113C = 0x0a80
export const STATLIST_FLAG_EXTENDED_113C = 0x80000000

/**
 * `@va D2Common:0x6FD80530` (`D2Common.#10747` `UNITS_CanDualWield`):
 * Returns `1` for Player Barbarian (`4`) / Assassin (`6`) or Monster Shadow Warrior (`417`) / Shadow Master (`418`)
 * when `0 <= classId < sgptDataTables->nMonStatsCount` (`0x6FDE9E1C` -> `+0xA80`).
 */
export function UNITS_CanDualWield113c(m: Memory113c, pUnit: number): number {
  hitD2CommonVa113c(0x6FD80530)
  if (pUnit === 0) return 0
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const classId = m.get(pUnit, D2UnitStrc.dwClassId) | 0
  if (uType === UNIT_PLAYER) {
    return classId === 4 || classId === 6 ? 1 : 0
  }
  if (uType === UNIT_MONSTER) {
    if (classId < 0) return 0
    const pDataTables = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    const monStatsCount = m.u32(pDataTables + DATATABLES_OFF_MONSTATS_COUNT_113C) | 0
    if (classId >= monStatsCount) return 0
    return classId >= 417 && classId <= 418 ? 1 : 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FD9DE40` (`D2Common.#10397` `SKILLS_GetFlags`):
 * Returns `pSkill->dwFlags (+0x0C)` (`0` if `pSkill == 0`).
 */
export function SKILLS_GetFlags113c(m: Memory113c, pSkill: number): number {
  hitD2CommonVa113c(0x6FD9DE40)
  if (pSkill === 0) return 0
  return m.u32(pSkill + 0x0c)
}

/**
 * `@va D2Common:0x6FD87F80` (`STATLIST_FindSubListByStateAndFlags`, `__fastcall (ecx = pStatListEx, edx = stateId)`):
 * Returns `0` if `pStatListEx == 0`, `stateId == 0`, or `(pStatListEx->dwFlags (+0x10) & 0x80000000) == 0`;
 * otherwise walks `pMyLastList (+0x3C)` then `pMyStats (+0x40)` via `pPrevLink (+0x2C)` and returns the first
 * sublist with `dwStateNo (+0x14) == stateId` (`0` if not found).
 */
export function STATLIST_FindSubListByStateAndFlags113c(
  m: Memory113c,
  pStatListEx: number,
  stateId: number,
): number {
  hitD2CommonVa113c(0x6FD87F80)
  if (pStatListEx === 0 || stateId === 0) return 0
  if ((m.get(pStatListEx, D2StatListStrc.dwFlags) & STATLIST_FLAG_EXTENDED_113C) === 0) {
    return 0
  }
  const target = stateId >>> 0
  for (
    let sub = m.get(pStatListEx, D2StatListExStrc.pMyLastList);
    sub !== 0;
    sub = m.get(sub, D2StatListStrc.pPrevLink)
  ) {
    if (m.get(sub, D2StatListStrc.dwStateNo) === target) return sub
  }
  for (
    let sub = m.get(pStatListEx, D2StatListExStrc.pMyStats);
    sub !== 0;
    sub = m.get(sub, D2StatListStrc.pPrevLink)
  ) {
    if (m.get(sub, D2StatListStrc.dwStateNo) === target) return sub
  }
  return 0
}

registerInventoryCheckNotBrokenHook113c(ITEMS_CheckNotBrokenOrUnequipping113c)
registerStatListFindSubListHook113c(STATLIST_FindSubListByStateAndFlags113c)

/**
 * `@va D2Game:0x6FC572C0` (`PLAYER_GetEquippedWeapon`):
 * Delegates directly to canonical `INVENTORY_GetActiveWeaponMemPort113c` (`0x6FD70700`),
 * `UNITS_CanDualWield113c` (`0x6FD80530`), `SKILLS_GetUsedSkillMemPort113c` (`0x6FD803A0`),
 * `INVENTORY_GetWeaponByHandSlotMemPort113c` (`0x6FD70830`), and `ITEMS_CheckItemTypeIdMemPort113c` (`0x6FD74430`).
 */
export function PLAYER_GetEquippedWeapon113c(m: Memory113c, pUnit: number): number {
  hitD2GameVa113c(0x6FC572C0)
  if (pUnit === 0) return 0
  const pInv = m.get(pUnit, D2UnitStrc.pInventory)
  if (pInv === 0) return 0
  if (!hasHydratedItemTables113c(m)) {
    const pGrids = m.u32(pInv + INV_OFF_PGRIDS) >>> 0
    if (pGrids === 0) return 0
    const ppItems = m.u32(pGrids + INVGRID_OFF_PPITEMS) >>> 0
    if (ppItems === 0) return 0
    const pRight = m.u32(ppItems + BODYLOC_RARM * 4) >>> 0
    if (
      pRight !== 0 &&
      ITEMS_CheckNotBrokenOrUnequipping113c(m, pRight) !== 0 &&
      ITEMS_CheckItemTypeId113c(m, pRight, ITYPE_WEAPON_113C) !== 0
    ) {
      return pRight
    }
    const pLeft = m.u32(ppItems + BODYLOC_LARM * 4) >>> 0
    if (
      pLeft !== 0 &&
      ITEMS_CheckNotBrokenOrUnequipping113c(m, pLeft) !== 0 &&
      ITEMS_CheckItemTypeId113c(m, pLeft, ITYPE_WEAPON_113C) !== 0
    ) {
      return pLeft
    }
    return 0
  }
  const savedSp = replayStackPtr113c
  replayStackPtr113c = (savedSp + 12) >>> 0
  let pDefault = 0
  try {
    m.setU32(savedSp, 0)
    m.setU32((savedSp + 4) >>> 0, 0)
    m.setU32((savedSp + 8) >>> 0, 0)
    INVENTORY_GetActiveWeaponMemPort113c(m, pInv, savedSp, (savedSp + 4) >>> 0, (savedSp + 8) >>> 0)
    pDefault = m.u32(savedSp) >>> 0
  } finally {
    replayStackPtr113c = savedSp
  }
  if (UNITS_CanDualWield113c(m, pUnit) === 0) return pDefault
  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit)
  if (pUsedSkill === 0) return pDefault
  const pSkillsTxt = m.u32(pUsedSkill)
  if (pSkillsTxt === 0) return pDefault

  const weapSel = m.u8(pSkillsTxt + 0x168)
  let pChosen = 0
  if (weapSel === 1) {
    pChosen = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, 6)
  } else if (weapSel === 2) {
    const useRight = (SKILLS_GetFlags113c(m, pUsedSkill) & 0x2000) !== 0
    const pLeft = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, 5)
    const pRight = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, 6)
    if (pLeft === 0 || ITEMS_CheckItemTypeIdMemPort113c(m, pLeft, ITYPE_WEAPON_113C) === 0) {
      pChosen = pRight
    } else if (
      pRight === 0 ||
      ITEMS_CheckItemTypeIdMemPort113c(m, pRight, ITYPE_WEAPON_113C) === 0
    ) {
      pChosen = pLeft
    } else {
      pChosen = useRight ? pRight : pLeft
    }
  } else if (weapSel === 3) {
    const frameIdx = (m.u32(pUnit + 0x38) | 0) >> 8
    pChosen = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, (frameIdx & 1) !== 0 ? 6 : 5)
  } else if (weapSel === 4) {
    pDefault = 0
    pChosen = 0
  } else {
    pChosen = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, 5)
    if (pChosen === 0 || ITEMS_CheckItemTypeIdMemPort113c(m, pChosen, ITYPE_WEAPON_113C) === 0) {
      pChosen = INVENTORY_GetWeaponByHandSlotMemPort113c(m, pInv, 6)
    }
  }

  if (
    ITEMS_CheckItemTypeIdMemPort113c(m, pChosen, ITYPE_WEAPON_113C) !== 0 &&
    ITEMS_CheckNotBrokenOrUnequipping113c(m, pChosen) !== 0
  ) {
    return pChosen
  }
  return pDefault
}

/**
 * `@va D2Common:0x6FD8C390` (`D2Common.#10057` `DUNGEON_CheckRoomIsTown` -> `0x6FD7D320`):
 * Delegates directly to canonical `DUNGEON_CheckRoomIsTownMemPort113c`.
 */
export function DUNGEON_CheckRoomIsTown113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) return 0
  const pRoomEx = m.get(pRoom, D2ActiveRoomStrc.pRoomEx)
  if (pRoomEx === 0) return 0
  const pLevel = m.get(pRoomEx, D2RoomExStrc.pLevel)
  if (pLevel === 0) return 0
  return DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom)
}

function getCharStatsByClassId113c(classId: number): CharStatsPure113c {
  return getCharStatsPure113c(classId)
}

/** `[phase, evType, unitType, unitId, animMode]` record emitted in `a1c-ord-f785.ndjson.gz`. */
export type OrdEventTuple113c = readonly [
  phase: number,
  evType: number,
  unitType: number,
  unitId: number,
  animMode: number,
]

export interface MemdumpBlock113c {
  readonly n: string
  readonly a: number
  readonly h: string
}

export interface MemdumpUnitEntry113c {
  readonly type: number
  readonly id: number
  readonly blocks: readonly MemdumpBlock113c[]
}

export interface MemdumpSnapshot113c {
  readonly frame: number
  readonly mem: readonly MemdumpUnitEntry113c[]
}

export interface SlicePathCollisionGrid113c {
  get(x: number, y: number): number
  set(x: number, y: number, value: number): void
}

export interface MutablePathRoom113c {
  readonly ptr: number
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  readonly isTown: boolean
  adjacentRooms: readonly unknown[]
  readonly grid: SlicePathCollisionGrid113c
}

export interface MutablePathUnit113c {
  readonly pUnit: number
  readonly pPath: number
  readonly dwUnitType: number
  readonly dwClassId: number
  readonly dwUnitId: number
  dwAnimMode: number
  dwFlags: number
  dwFlagEx: number
  readonly pDynamicPath?: unknown
  readonly pStaticPath?: unknown
  readonly objectTxt?: unknown
}

export interface FallenSliceWorld113c {
  readonly m: Memory113c
  readonly pGame: number
  readonly pTimer: number
  hasFullDrlg?: boolean
  readonly playerKillsById?: Map<number, number>
  readonly dirtyKillPlayerIds?: Set<number>
  readonly unitsByKey: Map<string, number>
  readonly monsterById: Map<number, number>
  readonly playerById: Map<number, number>
  readonly clientById?: ReadonlyMap<number, number>
  readonly pathUnitByPtr: Map<number, MutablePathUnit113c>
  readonly roomByPtr: Map<number, MutablePathRoom113c>
  readonly minionIdsByLeaderId: Map<number, number[]>
  readonly lastFrameOrd: OrdEventTuple113c[]
  readonly lastFrameDmg: Array<{
    readonly att: readonly [number, number]
    readonly def: readonly [number, number]
    readonly ret: number
  }>
  onTownNpcAi?: (world: MonsterSliceWorldLike113c, pMonster: number) => void
  onRogueTownAi?: (world: MonsterSliceWorldLike113c, pMonster: number) => void
  onNecroPetAi?: (world: MonsterSliceWorldLike113c, pMonster: number) => void
  onMonsterDropItems?: (world: MonsterSliceWorldLike113c, pMonster: number, pKiller: number) => void
  onHireableAiThink?: (world: MonsterSliceWorldLike113c, pMonster: number) => void
  onMonsterStartSkillMode?: (m: Memory113c, pGame: number, pMonster: number) => void
  onApplyHireableVelocityOverride?: (m: Memory113c, pMonster: number, pAiCtrl: number) => boolean
  onMonsterExpireDeathSubLists?: (m: Memory113c, pMonster: number) => void
  onMonsterAwardKillExp?: (
    world: MonsterSliceWorldLike113c,
    pMonster: number,
    pKiller: number,
    row: MonStatsRow113c,
  ) => void
}

function unitKey(type: number, id: number): string {
  return `${type}:${id}`
}

function decodeHexBytes113c(hex: string): Uint8Array {
  const len = hex.length >>> 1
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function stepUnitSeed(m: Memory113c, pUnit: number): D2SeedStrc {
  const s = UNITS_GetSeed113c(m, pUnit)
  seedNext(s)
  UNITS_SetSeed113c(m, pUnit, s.lo, s.hi)
  return s
}

function rollUnitLimited(m: Memory113c, pUnit: number, limit: number): number {
  const s = UNITS_GetSeed113c(m, pUnit)
  const v = seedRoll(s, limit)
  UNITS_SetSeed113c(m, pUnit, s.lo, s.hi)
  return v
}

function writeUnitAnimState113c(
  m: Memory113c,
  pUnit: number,
  dwFrame0x40: number,
  dwFrame0x44: number,
  dwFrameCount0x48: number,
  wAnimSpeed: number,
  wActionFrame: number,
): void {
  m.setU32(pUnit + 0x40, dwFrame0x40 >>> 0)
  m.setU32(pUnit + 0x44, dwFrame0x44 >>> 0)
  m.setU32(pUnit + 0x48, dwFrameCount0x48 >>> 0)
  m.set(pUnit, D2UnitStrc.wAnimSpeed, wAnimSpeed & 0xffff)
  m.set(pUnit, D2UnitStrc.wActionFrame, wActionFrame & 0xffff)
}

export function ensureSliceWorldPathMemory113c(world: FallenSliceWorld113c): void {
  const { m } = world
  ensureD2CommonPathGlobals113c(m)
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

export function syncDynamicPathFromMem113c(
  world: FallenSliceWorld113c,
  pu: MutablePathUnit113c,
): void {
  const { m } = world
  pu.dwAnimMode = m.get(pu.pUnit, D2UnitStrc.dwAnimMode)
  pu.dwFlags = m.get(pu.pUnit, D2UnitStrc.dwFlags)
  pu.dwFlagEx = m.get(pu.pUnit, D2UnitStrc.dwFlags2)
}

export function syncDynamicPathToMem113c(
  world: FallenSliceWorld113c,
  pu: MutablePathUnit113c,
): void {
  const { m } = world
  m.set(pu.pUnit, D2UnitStrc.dwFlags, pu.dwFlags >>> 0)
  m.set(pu.pUnit, D2UnitStrc.dwFlags2, pu.dwFlagEx >>> 0)
}

export function getUnitPosSubtile113c(m: Memory113c, pUnit: number): { x: number; y: number } {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return { x: 0, y: 0 }
  return {
    x: m.get(pPath, D2DynamicPathStrc.wPosX),
    y: m.get(pPath, D2DynamicPathStrc.wPosY),
  }
}

function getMonStatsRow113c(m: Memory113c, pMonster: number): MonStatsRow113c {
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  if (row === undefined) {
    throw new RangeError(`Missing MonStats.bin row for classId=${classId}`)
  }
  return row
}

/**
 * Difficulty index resolution (`0x6FC94EA4` inside `MONSTER_StartNeutral` `0x6FC94E60`):
 * Classic (`bExpansion == 0 && dwGameType == 0`) uses column `0` for `aidel`/`aidist`/`aip` tables;
 * Expansion clamps `nDifficulty` into `0..2`.
 */
export function getDifficultyIdx113c(m: Memory113c, pGame: number): 0 | 1 | 2 {
  const d = m.get(pGame, D2GameStrc.nDifficulty) & 0xff
  return d >= 2 ? 2 : d === 1 ? 1 : 0
}

function hasHydratedAnimDataTable113c(m: Memory113c): boolean {
  try {
    return m.u32(0x6fdf0b4c) !== 0
  } catch {
    return false
  }
}

/**
 * `@va D2Game:0x6FCFF7B0` (`SUNIT_ScheduleModeAnimEvents`):
 * Exact x86 fixed-point animation event scheduler reading `pUnit->pAnimData (+0x50)`,
 * `UNITS_GetAnimStartFrame113c(pUnit)`, `wAnimSpeed (+0x4C)`, and `dwFrameCount (+0x48)`.
 */
function SUNIT_ScheduleUnitModeAnimEventsFromMem113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evStepType: number,
  evEndType: number,
): number {
  return SUNIT_ScheduleModeAnimEvents113c(m, pGame, pUnit, evStepType, evEndType)
}

function attachSliceWorldCallbacks113c(world: FallenSliceWorld113c): void {
  if (world.onTownNpcAi === undefined) {
    world.onTownNpcAi = (_w, pMonster) => {
      AI_TownNpc113c(world, pMonster)
    }
  }
  if (world.onRogueTownAi === undefined) {
    world.onRogueTownAi = (_w, pMonster) => {
      AI_RogueTown113c(world, pMonster)
    }
  }
  if (world.onNecroPetAi === undefined) {
    world.onNecroPetAi = (_w, pMonster) => {
      ensureSliceWorldPathMemory113c(world)
      runNecroPetAiK3_113c(world.m, world.pGame, pMonster, {
        world,
        approachTarget: (pMon, pTgt, md, tx, ty, steps, fl) =>
          AI_ApproachTarget113c(world, pMon, pTgt, md, tx, ty, steps, fl),
        fleeFrom: (pFrom, pMon, distSteps, clearOnFail) =>
          AI_FleeFrom113c(world, pFrom, pMon, distSteps, clearOnFail),
        idleWander: (pMon, range) => AI_IdleWander113c(world, pMon, range),
        stall: (pMon, frames) => AI_Stall113c(world, pMon, frames),
        startMode: (pMon, md, pTgt, tx, ty) => MONSTER_StartMode113c(world, pMon, md, pTgt, tx, ty),
      })
      syncActRoomsAndUnitsIntoWorld113c(world)
    }
  }
  if (world.onMonsterDropItems === undefined) {
    world.onMonsterDropItems = (_w, pMonster, pKiller) => {
      const { m, pGame } = world
      bindK2KernelGlobals113c(m)
      MONSTER_DropDeathItems_6FC95900_113c(m, pGame, pMonster, pKiller)
      syncActRoomsAndUnitsIntoWorld113c(world)
    }
  }
  if (world.onHireableAiThink === undefined) {
    world.onHireableAiThink = (_w, pMonster) => {
      runHireableAiThinkK3_113c(world, pMonster)
    }
  }
  if (world.onMonsterStartSkillMode === undefined) {
    world.onMonsterStartSkillMode = (mem, pg, pMonster) => {
      if (world.hasFullDrlg !== true) return
      onMonsterStartSkillModeK3_113c(mem, pg, pMonster)
    }
  }
  if (world.onApplyHireableVelocityOverride === undefined) {
    world.onApplyHireableVelocityOverride = (mem, pMonster, pAiCtrl) =>
      applyHireableModeVelocityOverrideK3_113c(mem, pMonster, pAiCtrl)
  }
  if (world.onMonsterExpireDeathSubLists === undefined) {
    world.onMonsterExpireDeathSubLists = (mem, pMonster) => {
      MONSTER_ExpireDeathStateSubLists113c(
        mem,
        pMonster,
        MISSILE_BuildK3Hooks113c(() => {}),
      )
    }
  }
  if (world.onMonsterAwardKillExp === undefined) {
    world.onMonsterAwardKillExp = (_w, pMonster, pKiller, row) => {
      if (pKiller !== 0 && world.m.get(pKiller, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
        QUESTS_OnMonsterKill113c(world.m, world.pGame, pKiller, pMonster)
        ARENA_GetPlayerArenaFlags113c(world.m, pKiller)
        const m = world.m
        const pg = world.pGame
        const needScratchArena =
          pg !== 0 && m.u32((pg + 0x1d28) >>> 0) === 0 && isSgptDataTablesLoaded113c(m)
        if (!needScratchArena) {
          ARENA_ProcessKillScoreUpdate113c(m, pg, pKiller, pMonster)
        } else {
          const pScratchArenaCtrl = 0x7fb94300
          m.fill(pScratchArenaCtrl, 0x10, 0)
          m.setU32((pScratchArenaCtrl + 0x08) >>> 0, 4)
          const pKillerData = m.get(pKiller, D2UnitStrc.pUnitData) >>> 0
          const pKillerArena = pKillerData !== 0 ? (m.u32((pKillerData + 0x34) >>> 0) >>> 0) : 0
          const savedArena0 = pKillerArena !== 0 ? (m.u32(pKillerArena) >>> 0) : 0
          const savedArena8 = pKillerArena !== 0 ? (m.u32((pKillerArena + 0x08) >>> 0) >>> 0) : 0
          const savedFlags = m.u32((pKiller + 0xc4) >>> 0) >>> 0
          const savedFlags2 = m.u32((pKiller + 0xc8) >>> 0) >>> 0
          const savedUpdNext = m.u32((pKiller + 0xe0) >>> 0) >>> 0
          const pRoom = UNITS_GetRoom113c(m, pKiller) >>> 0
          const savedRoomUpd = pRoom !== 0 ? (m.u32((pRoom + 0x1c) >>> 0) >>> 0) : 0
          const pActFlag = pRoom !== 0 ? (m.get(pRoom, D2ActiveRoomStrc.pActUpdateFlag) >>> 0) : 0
          const savedActFlag = pActFlag !== 0 ? (m.u32(pActFlag) >>> 0) : 0
          m.setU32((pg + 0x1d28) >>> 0, pScratchArenaCtrl)
          try {
            ARENA_ProcessKillScoreUpdate113c(m, pg, pKiller, pMonster)
          } finally {
            m.setU32((pg + 0x1d28) >>> 0, 0)
            if (pKillerArena !== 0) {
              m.setU32(pKillerArena, savedArena0)
              m.setU32((pKillerArena + 0x08) >>> 0, savedArena8)
            }
            m.setU32((pKiller + 0xc4) >>> 0, savedFlags)
            m.setU32((pKiller + 0xc8) >>> 0, savedFlags2)
            m.setU32((pKiller + 0xe0) >>> 0, savedUpdNext)
            if (pRoom !== 0) {
              m.setU32((pRoom + 0x1c) >>> 0, savedRoomUpd)
            }
            if (pActFlag !== 0) {
              m.setU32(pActFlag, savedActFlag)
            }
          }
        }
      }
      awardMonsterKillExperienceWithMercK3_113c(world, pMonster, pKiller, row)
    }
  }
}

export const MONSTER_StepContinuousMove113c = MONSTER_StepWalk113c

export interface K4ReplayKernelBridge113c {
  readonly hydrateQuestAndNpcState: (m: Memory113c, pGame: number, saveBytes?: Uint8Array) => void
  readonly tryRunTownNpcThink: (
    m: Memory113c,
    pGame: number,
    pMonster: number,
    pfnThink: number,
  ) => boolean
  readonly tryApplyQuestAndNpcC2SPacket: (
    m: Memory113c,
    pGame: number,
    pPlayer: number,
    packetBytes: Uint8Array,
    syncWorld: () => void,
  ) => boolean
  readonly executeQueuedPlayerEntityInteract: (
    m: Memory113c,
    pGame: number,
    pPlayer: number,
    interactAction: number,
    targetType: number,
    targetId: number,
  ) => void
}

let k4ReplayBridge: K4ReplayKernelBridge113c | null = null

export function registerK4ReplayKernelBridge113c(bridge: K4ReplayKernelBridge113c): void {
  k4ReplayBridge = bridge
}

export function runMonsterAiDriver113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  pfnThink: number,
): void {
  if (SUNIT_IsDeadOrDying113c(world.m, pMonster) !== 0) return
  attachSliceWorldCallbacks113c(world)
  AI_DispatchTargetByAiFlag113c(world, pMonster, pfnThink)
}

/**
 * Canonical `D2Game:0x6FCFE5A0` (`SUNITDMG_ExecuteMissileOrMeleeDmg`) wrapper for `FallenSliceWorld113c`:
 * Delegates directly to `SUNITDMG_CheckToHit113c` (`0x6FCFDE90`), `SUNITDMG_RollDodgeAvoidEvadeBlock113c` (`0x6FCFB030`),
 * `SUNITDMG_FillDamageValues113c` (`0x6FCFD450`), and `SUNITDMG_ExecuteEvents113c` (`0x6FCFED30` ->
 * `0x6FCFC0B0` -> `0x6FCFE0C0` -> `0x6FCFEBA0` -> `0x6FCFCF20`) in `./k2-real-s2c-combat-113c.ts`.
 */
function buildSliceMeleeCombatHooks113c(
  world: FallenSliceWorld113c,
  onRetDmg: (pAtt: number, pDef: number, retDmg: number) => void,
): SUnitDmgHooks113c {
  return {
    suppressDirectS2c: true,
    onPreClampDamageResolved: (_mem, pAtt, pDef, preClampTotalDmg) => {
      onRetDmg(pAtt, pDef, preClampTotalDmg)
    },
    onDamagedInMeleeEvents: (mem, pg, pAtt, pDef, dmgPtr) => {
      const retDmg = mem.get(dmgPtr, D2DamageStrc.dwDmgTotal) | 0
      onRetDmg(pAtt, pDef, retDmg)
      setItemdefGapMonsterKillHook113c((_mem, _pg, pMon, pKill) => {
        if (mem.get(pMon, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
          const curMode = mem.get(pMon, D2UnitStrc.dwAnimMode)
          if (curMode !== 0 && curMode !== 12) {
            MONSTER_StartDeath113c(world, pMon, pKill)
          }
        }
      })
      dispatchAttackerMeleeHitItemEventsK3_113c(mem, pg, pAtt, pDef, dmgPtr)
      SUNIT_DispatchItemEventCallbacks113c(mem, 0, pg, 1, pAtt, dmgPtr)
      let pNode = 0
      try {
        pNode = mem.u32((pDef + 0x90) >>> 0) >>> 0
      } catch {
        pNode = 0
      }
      while (pNode >= 0x40000000) {
        const pNext = mem.u32((pNode + 0x1c) >>> 0) >>> 0
        const fnType = mem.u32((pNode + 0x04) >>> 0)
        if (mem.u8(pNode) === 1 && (fnType === 1 || fnType === 2)) {
          const cbVa = mem.u32((pNode + 0x14) >>> 0) >>> 0
          const arg1 = mem.u32((pNode + 0x0c) >>> 0) >>> 0
          const arg2 = mem.u32((pNode + 0x10) >>> 0) >>> 0
          if (cbVa === 0x6fccdce0) {
            ITEMEVENT_ChanceToCastSkill113c(mem, pDef, pAtt, dmgPtr, arg1, arg2)
          } else if (cbVa === 0x6fcccda0) {
            ITEMEVENT_ManaAfterKill113c(mem, pDef, pAtt, dmgPtr, arg1, arg2)
          } else if (cbVa === 0x6fccd910) {
            ITEMEVENT_AttackerTakesDamage113c(mem, pg, pDef, pAtt, dmgPtr, arg1, arg2)
          }
        }
        pNode = pNext
      }
    },
    onMonsterAttackerHit: (mem, _pg, pAtt) => {
      MONSTER_SetLastHitModeField54_113c(mem, pAtt, 3)
    },
    onPlayerDodgeOrAvoid: (mem, pg, pDef, pAtt, wResultFlags) => {
      PLAYER_TryStartDodgeOrAvoidModeK3_113c(
        mem,
        pg,
        pDef,
        pAtt,
        wResultFlags,
        (mInner, pgInner, plr) =>
          SUNIT_ScheduleUnitModeAnimEventsFromMem113c(
            mInner,
            pgInner,
            plr,
            PLR_EVENT_MODE_STEP,
            PLR_EVENT_MODE_END,
          ),
        (mode, flags) => {
          const curIsUpdate = mem.get(pDef, D2UnitStrc.dwFlags) & 0x2000
          mem.set(pDef, D2UnitStrc.dwFlags, (flags | curIsUpdate | 0x01) >>> 0)
          UNITROOM_RefreshUnit113c(mem, pDef)
          const updFlags = mem.get(pDef, D2UnitStrc.dwFlags)
          const pu = world.pathUnitByPtr.get(pDef)
          if (pu !== undefined) {
            pu.dwAnimMode = mode
            pu.dwFlags = updFlags
          }
        },
      )
    },
    onPlayerBlock: (_mem, _pg, pDef) => {
      startPlayerBlockMode113c(world, pDef)
    },
    onKillUnit: (mem, _pg, pDef, pAtt) => {
      if (mem.get(pDef, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
        MONSTER_StartDeath113c(world, pDef, pAtt)
      }
    },
    onMonsterStartMode: (_mem, _pg, pDef, mode, pTarget) => {
      MONSTER_StartMode113c(world, pDef, mode, mode === 6 ? pTarget : 0, 0, 0)
    },
    onUnitFlagsUpdated: (_mem, pUnit, nextFlags) => {
      const pu = world.pathUnitByPtr.get(pUnit)
      if (pu !== undefined) pu.dwFlags = nextFlags
    },
  }
}

export function SUNITDMG_ExecuteMissileOrMeleeDmg113c(
  world: FallenSliceWorld113c,
  pAttacker: number,
  pDefender: number,
  arBonus = 0,
  enhDmgPct = 0,
): boolean {
  attachSliceWorldCallbacks113c(world)
  const { m, pGame } = world
  if (pAttacker === 0 || pDefender === 0) return false

  const attType = m.get(pAttacker, D2UnitStrc.dwUnitType)
  const pDmg = 0x004ff700
  m.fill(pDmg, D2DamageStrc_SIZE, 0)
  m.set(pDmg, D2DamageStrc.dwHitFlags, 0x20)
  m.set(pDmg, D2DamageStrc.dwEnhDmgPct, enhDmgPct >>> 0)

  // 0x6FCFE5A0: melee reach + to-hit + passive avoidance/shield block + `0x36` uninterruptable check
  ensureSliceWorldPathMemory113c(world)
  const resFlags = SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c(
    m,
    pAttacker,
    pDefender,
    pGame,
    arBonus,
    0,
    pDmg,
  )

  let frameRetDmg = 0
  const hooks = buildSliceMeleeCombatHooks113c(world, (_pAtt, _pDef, ret) => {
    frameRetDmg = ret
  })

  if ((resFlags & 0x01) === 0) {
    if (attType === UNIT_PLAYER) {
      SUNITDMG_FillDamageValues113c(m, pGame, pAttacker, pDefender, pDmg, 0, 128, 1)
    }
    if ((resFlags & 0x8190) !== 0) {
      SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, pDmg, 128)
      SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, 0, hooks)
    }
    return false
  }

  SUNITDMG_FillDamageValues113c(m, pGame, pAttacker, pDefender, pDmg, 0, 128, 1)
  SUNITDMG_AllocCombat113c(m, pGame, pAttacker, pDefender, pDmg, 128)
  SUNITDMG_FindCombatDamageData113c(m, pAttacker, pDefender)
  SUNITDMG_ExecuteEvents113c(m, pGame, pAttacker, pDefender, 1, 0, hooks)
  world.lastFrameDmg.push({
    att: [m.get(pAttacker, D2UnitStrc.dwUnitType), m.get(pAttacker, D2UnitStrc.dwUnitId)],
    def: [m.get(pDefender, D2UnitStrc.dwUnitType), m.get(pDefender, D2UnitStrc.dwUnitId)],
    ret: frameRetDmg,
  })
  return true
}

function resolvePlayerWeaponClass113c(world: FallenSliceWorld113c, pPlayer: number): string {
  const { m } = world
  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pPlayer)
  if (pWeapon !== 0) {
    const classId = m.get(pWeapon, D2UnitStrc.dwClassId)
    if (hasHydratedItemTables113c(m)) {
      const pTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, classId)
      if (pTxt !== 0) {
        let wc = ''
        for (let i = 0; i < 4; i++) {
          const b = m.u8((pTxt + 0xc0 + i) >>> 0)
          if (b === 0 || b === 0x20) break
          wc += String.fromCharCode(b)
        }
        if (wc.length > 0) return wc
      }
    }
    const rec = getItemsTxtRecordPure113c(classId)
    if (rec !== null && rec.wclass.length > 0) return rec.wclass
  }
  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  return getCharStatsByClassId113c(classId).baseWClass
}

/**
 * `@va D2Game:0x6FC97BB0` (`PLAYER_DrainRunStamina`):
 * Checks room town flag (`#10057` `0x6FD8C390` at `0x6FC97BBB`, returns `1` if town), requires
 * `pPlayer->pInventory != 0` (`0x6FC97BFE`), multiplies `(CharStats.runDrain << 1)` by torso
 * armor `dwSpeed/10 + 1` (`#11139` `bodyLoc = 3` at `0x6FC97C08..0x6FC97C3A`), scales by
 * `STAT_STAMINADRAINPCT (154)` (`drain += Math.trunc((drainPct * drain) / -100)` at
 * `0x6FC97C4E..0x6FC97C64`), clamps `if (drain < 1) drain = 1` (`0x6FC97C6B`), applies
 * `STATLIST_AddUnitStat(pPlayer, 10, -drain, 0)` (`0x6FC97C78`), and returns `1` if remaining
 * stamina `> 0`, else clamps `STAT_STAMINA = 0` (`0x6FC97C92`) and returns `0`.
 */
export function PLAYER_DrainRunStamina113c(m: Memory113c, pPlayer: number): number {
  hitD2GameVa113c(0x6FC97BB0)
  if (pPlayer === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return 0
  if (DUNGEON_CheckRoomIsTown113c(m, UNITS_GetRoom113c(m, pPlayer)) !== 0) return 1
  const pInventory = m.get(pPlayer, D2UnitStrc.pInventory)
  if (pInventory === 0) return 0

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const charStats = getCharStatsByClassId113c(classId)
  let drain = charStats.runDrain << 1
  const pTorso = hasHydratedItemTables113c(m)
    ? INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, BODYLOC_TORSO)
    : (() => {
        const pGrids = m.u32(pInventory + INV_OFF_PGRIDS) >>> 0
        if (pGrids === 0) return 0
        const ppItems = m.u32(pGrids + INVGRID_OFF_PPITEMS) >>> 0
        return ppItems !== 0 ? (m.u32(ppItems + BODYLOC_TORSO * 4) >>> 0) : 0
      })()
  if (pTorso !== 0 && m.get(pTorso, D2UnitStrc.dwUnitType) === UNIT_ITEM) {
    const torsoClassId = m.get(pTorso, D2UnitStrc.dwClassId)
    if (hasHydratedItemTables113c(m)) {
      const pTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, torsoClassId)
      if (pTxt !== 0) {
        const dwSpeed = m.u32((pTxt + 0xd8) >>> 0) | 0
        drain = Math.imul(drain, (Math.trunc(dwSpeed / 10) + 1) | 0)
      }
    } else {
      const rec = getItemsTxtRecordPure113c(torsoClassId)
      if (rec !== null) {
        drain = Math.imul(drain, (Math.trunc(rec.dwSpeed / 10) + 1) | 0)
      }
    }
  }
  const drainPct = STATLIST_GetUnitStat113c(m, pPlayer, STAT_STAMINADRAINPCT, 0) | 0
  if (drainPct !== 0) {
    drain = (drain + Math.trunc(Math.imul(drainPct, drain) / -100)) | 0
  }
  if (drain < 1) drain = 1

  STATLIST_AddUnitStatMemPort113c(m, pPlayer, STAT_STAMINA, -drain, 0)
  if ((STATLIST_GetUnitStat113c(m, pPlayer, STAT_STAMINA, 0) | 0) > 0) {
    return 1
  }
  STATLIST_SetUnitStat113c(m, pPlayer, STAT_STAMINA, 0, 0)
  return 0
}

/**
 * `@va D2Game:0x6FC97CB0` (`PLAYER_UpdateHpRegen`):
 * Adds `STAT_HPREGEN (74)` to `STAT_HITPOINTS (6)`, removes `STATE_HEALTHPOT (100)` when `nextHp > maxHp`
 * (`0x6FC97CE2..0x6FC97CFA`), clamps `if (nextHp < 0x100) nextHp = 0x100` (`0x6FC97CFE`), and updates
 * `stat 352` (`0x6FC97D17..0x6FC97D80`).
 */
export function PLAYER_UpdateHpRegen113c(m: Memory113c, pPlayer: number): void {
  hitD2GameVa113c(0x6FC97CB0)
  if (pPlayer === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  const curHp = STATLIST_GetUnitStat113c(m, pPlayer, STAT_HITPOINTS, 0) | 0
  if (curHp <= 0) return
  const maxHp = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXHP, 0) | 0
  const hpRegen = STATLIST_GetUnitStat113c(m, pPlayer, STAT_HPREGEN, 0) | 0
  let nextHp = (curHp + hpRegen) | 0
  if (nextHp > maxHp) {
    nextHp = maxHp
    if (STATES_CheckState113c(m, pPlayer, 100) !== 0) {
      const pPotList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pPlayer, 100)
      if (pPotList !== 0) {
        STATLIST_RemoveStatListFromUnit113c(m, pPlayer, pPotList)
      }
      STATES_ToggleState113c(m, pPlayer, 100, false)
    }
  }
  if (nextHp < 0x100) nextHp = 0x100
  if (nextHp !== curHp) {
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_HITPOINTS, nextHp, 0)
    const hpPct = maxHp > 0 ? mulDiv113c(nextHp, 100, maxHp) : 0
    const hpTier = hpPct > 8 ? 3 : hpPct > 4 ? 2 : 1
    if (STATLIST_GetUnitStat113c(m, pPlayer, STAT_HP_TIER_ICON, 0) !== hpTier) {
      STATLIST_SetUnitStat113c(m, pPlayer, STAT_HP_TIER_ICON, hpTier, 0)
      UNITROOM_RefreshUnit113c(m, pPlayer)
    }
  }
}

/**
 * `@va D2Game:0x6FC97950` (`PLAYER_UpdateManaRegen`):
 * Skips when `STATE_INFERNO (85)` is active (`0x6FC97972`), uses `7500` (`0x1D4C`) default divisor,
 * scales `maxMana / (25 * manaRegenSeconds)` by `100 + stat 27` (`manarecoverybonus`), adds `stat 26`
 * (`manarecovery`), removes `STATE_MANAPOT (106)` when reaching `maxMana` (`0x6FC97A00..0x6FC97A27`),
 * and clamps `delta` to `[-curMana, maxMana - curMana]`.
 */
export function PLAYER_UpdateManaRegen113c(m: Memory113c, pPlayer: number): void {
  hitD2GameVa113c(0x6FC97950)
  if (pPlayer === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  const maxMana = isSgptDataTablesLoaded113c(m)
    ? STATLIST_GetMaxManaFromUnit113c(m, pPlayer) | 0
    : STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXMANA, 0) | 0
  if (STATES_CheckState113c(m, pPlayer, 85) !== 0) return
  if (maxMana <= 0) return

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const charStats = getCharStatsByClassId113c(classId)
  const regenFrames =
    charStats.manaRegenSeconds > 0 ? Math.imul(charStats.manaRegenSeconds, 25) : 7500
  const baseRate = Math.trunc(maxMana / regenFrames) | 0
  const manaBonusPct = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MANARECOVERYBONUS, 0) | 0
  const scaledRate = Math.trunc(Math.imul(baseRate, 100 + manaBonusPct) / 100) | 0
  const flatManaRec = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MANARECOVERY, 0) | 0
  let delta = (scaledRate + flatManaRec) | 0
  if (delta === 0) return

  const curMana = STATLIST_GetUnitStat113c(m, pPlayer, STAT_MANA, 0) | 0
  const maxAdd = (maxMana - curMana) | 0
  if (delta >= maxAdd) {
    if (STATES_CheckState113c(m, pPlayer, 106) !== 0) {
      const pPotList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pPlayer, 106)
      if (pPotList !== 0) {
        STATLIST_RemoveStatListFromUnit113c(m, pPlayer, pPotList)
      }
      STATES_ToggleState113c(m, pPlayer, 106, false)
    }
    delta = maxAdd
  }
  const minSub = -curMana | 0
  if (delta < minSub) {
    delta = minSub
  }
  if (delta !== 0) {
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_MANA, (curMana + delta) | 0, 0)
  }
}

/**
 * `@va D2Game:0x6FC97A50` (`PLAYER_UpdateStaminaRegen`):
 * Jump-table `0x6FC97B04[mode]` (`mode <= 19`):
 * - `mode 1 (NU)` / `mode 5 (TN)` (`0x6FC97A6E`): `baseDelta = maxStam >> 8`
 * - `mode 2 (WL)` (`0x6FC97A7C`): if `curStam < 256` (`0x100`) return, else `baseDelta = maxStam >> 9`
 * - `mode 6 (TW)` (`0x6FC97AA7`): `baseDelta = maxStam >> 9`
 * - `mode 0 (DT)` / `mode 17 (DD)` (`0x6FC97B03`): return
 * - `mode 3 (RN)` / `mode 4 (GH)` / `7..16` / `18..19` (`0x6FC97A92`): if `stat 28 < 1000` (`0x3E8`) return, else `baseDelta = maxStam >> 8`.
 */
export function PLAYER_UpdateStaminaRegen113c(m: Memory113c, pPlayer: number): void {
  hitD2GameVa113c(0x6FC97A50)
  if (pPlayer === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) return
  const mode = m.get(pPlayer, D2UnitStrc.dwAnimMode) >>> 0
  if (mode > 19 || mode === 0 || mode === 17) return

  const curStam = STATLIST_GetUnitStat113c(m, pPlayer, STAT_STAMINA, 0) | 0
  const maxStam = isSgptDataTablesLoaded113c(m)
    ? STATLIST_GetMaxStaminaFromUnit113c(m, pPlayer) | 0
    : STATLIST_GetUnitStat113c(m, pPlayer, STAT_MAXSTAMINA, 0) | 0
  const stamBonusPct = STATLIST_GetUnitStat113c(m, pPlayer, STAT_STAMINARECOVERYBONUS, 0) | 0

  let baseDelta: number
  if (mode === PLRMODE_NEUTRAL || mode === PLRMODE_TOWN_NEUTRAL) {
    baseDelta = maxStam >> 8
  } else if (mode === PLRMODE_WALK) {
    if (curStam < 0x100) return
    baseDelta = maxStam >> 9
  } else if (mode === PLRMODE_TOWN_WALK) {
    baseDelta = maxStam >> 9
  } else {
    if (stamBonusPct < 1000) return
    baseDelta = maxStam >> 8
  }

  const delta =
    stamBonusPct !== 0
      ? (baseDelta + Math.trunc(Math.imul(baseDelta, stamBonusPct) / 100)) | 0
      : baseDelta
  if (delta <= 0) return

  if (curStam < maxStam) {
    let nextStam = (curStam + delta) | 0
    if (nextStam > maxStam) nextStam = maxStam
    STATLIST_SetUnitStat113c(m, pPlayer, STAT_STAMINA, nextStam, 0)
  }
}

/**
 * `@va D2Game:0x6FC99B10` (`PLAYER_Event3_RegenTick`):
 * Reschedules `Event 3` (`+1` frame) BEFORE the dead check (`0x6FC99B18..0x6FC99B26`), then
 * executes `HP -> Stamina -> Mana` in exact binary order (`0x6FC99B47..0x6FC99B58`).
 */
export function PLAYER_Event3_RegenTick113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC99B10)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pPlayer, PLR_EVENT_STAMINA, (frame + 1) >>> 0, 0, 0, 0)
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  PLAYER_UpdateHpRegen113c(m, pPlayer)
  PLAYER_UpdateStaminaRegen113c(m, pPlayer)
  PLAYER_UpdateManaRegen113c(m, pPlayer)
}

/** `@va D2Game:0x6FC99A60` (`PLAYER_Event11_PeriodicTick`): cleans/syncs pets (`0x6FCB8250`) and reschedules `Event 11` (`+30` frames, `0x1E`). */
export function PLAYER_Event11_PeriodicTick113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC99A60)
  if (SUNIT_IsDeadOrDying113c(m, pPlayer) !== 0) return
  const pPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData) >>> 0
  const pClient = pPlayerData !== 0 ? (m.u32((pPlayerData + 0x9c) >>> 0) >>> 0) : 0
  if (pClient !== 0) {
    PARTY_SendPartyPetsToClient113c(m, pGame, pPlayer)
    PLRINTRO_SendAllPlayerPetsToClient113c(m, pClient, pPlayer, pGame)
  }
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  EVENT_SetEventFull113c(m, pGame, pPlayer, PLR_EVENT_IDLE, (frame + 30) >>> 0, 0, 0, 0)
}

function startPlayerBlockMode113c(world: FallenSliceWorld113c, pPlayer: number): void {
  const { m, pGame } = world
  const weaponClass = resolvePlayerWeaponClass113c(world, pPlayer)
  PLAYER_StartBlockMode113c(m, pGame, pPlayer, weaponClass, (mem, pg, plr) => {
    const nextFlags = ((mem.get(plr, D2UnitStrc.dwFlags) & ~UNITFLAG_IN_SKILL_ACTION) | 0x01) >>> 0
    mem.set(plr, D2UnitStrc.dwFlags, nextFlags)
    const pu = world.pathUnitByPtr.get(plr)
    if (pu !== undefined) {
      pu.dwAnimMode = PLRMODE_BLOCK
      pu.dwFlags = nextFlags
    }
    if (hasHydratedAnimDataTable113c(mem)) {
      UNITS_SetUnitAnimMode113c(mem, plr, 0, 0)
      UNITS_UpdateAnimFrame113c(mem, plr)
      SUNIT_ScheduleUnitModeAnimEventsFromMem113c(
        mem,
        pg,
        plr,
        PLR_EVENT_MODE_STEP,
        PLR_EVENT_MODE_END,
      )
      return
    }
    const classId = mem.get(plr, D2UnitStrc.dwClassId) >>> 0
    const clip = getCharAnimClipPure113c(classId, PLRMODE_BLOCK, weaponClass)
    writeUnitAnimState113c(mem, plr, 0, 0, clip.frames << 8, 128, 0)
    SUNIT_ScheduleModeAnimEvents113c(mem, pg, plr, clip, 0, 128)
  })
}

function syncPlayerNeutralAnimAfterReset113c(world: FallenSliceWorld113c, pPlayer: number): void {
  const { m } = world
  const nuMode = m.get(pPlayer, D2UnitStrc.dwAnimMode)
  const nextFlags = (m.get(pPlayer, D2UnitStrc.dwFlags) & ~UNITFLAG_IN_SKILL_ACTION) >>> 0
  m.set(pPlayer, D2UnitStrc.dwFlags, nextFlags)
  const pu = world.pathUnitByPtr.get(pPlayer)
  if (pu !== undefined) {
    pu.dwAnimMode = nuMode
    pu.dwFlags = nextFlags
  }
  if (hasHydratedAnimDataTable113c(m)) {
    UNITS_UpdateAnimFrame113c(m, pPlayer)
    return
  }
  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const weaponClass = resolvePlayerWeaponClass113c(world, pPlayer)
  const nuClip = getCharAnimClipPure113c(classId, PLRMODE_NEUTRAL, weaponClass)
  writeUnitAnimState113c(m, pPlayer, 0, 0, nuClip.frames << 8, nuClip.speed, 0)
}

function transitionPlayerToNeutral113c(
  world: FallenSliceWorld113c,
  pPlayer: number,
  fromModeEnd = false,
): void {
  const { m, pGame } = world
  if (fromModeEnd) {
    PLAYER_FinishModeAndResetToNeutral113c(m, pGame, pPlayer, 0, 0)
  } else {
    PLAYER_SetNeutralOrTownNeutralMode113c(m, pGame, pPlayer, PLRMODE_NEUTRAL, 0, 0)
  }
  syncPlayerNeutralAnimAfterReset113c(world, pPlayer)
}

/**
 * `@va D2Game:0x6FCFF7B0` (`SUNIT_ScheduleModeAnimEvents`):
 * Exact x86 fixed-point animation event scheduler (`0x6FCFF7B9..0x6FCFF8F0`):
 * steps `acc = (startFrame << 8) + stepSpeed` while `acc < (clip.frames << 8)`, scanning
 * `AnimData.d2` event bytes `edi <= (acc >> 8)` (`edi < 0x90`) to register `Event 0`
 * (`arg14 = evCode`, `arg18 = hitIdx` for codes `1..2`) and finally `Event 1` (`MODE_END`)
 * at `ebx + 1`.
 */
export function SUNIT_ScheduleModeAnimEvents113c<T extends PureCharAnimClip113c | number>(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  clipOrEvStepType: T,
  startFrameOrEvEndType: number,
  stepSpeedArg?: number,
): T extends number ? number : void {
  hitD2GameVa113c(0x6FCFF7B0)
  const gameFrame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  if (typeof clipOrEvStepType === 'number') {
    const evStepType = clipOrEvStepType
    const evEndType = startFrameOrEvEndType
    const stepSpeed = (m.u16((pUnit + 0x4c) >>> 0) << 16) >> 16
    if (stepSpeed <= 0) {
      const endF = (gameFrame + 1) >>> 0
      EVENT_SetEventFull113c(m, pGame, pUnit, evEndType, endF, 0, 0, 0)
      m.setU32((pUnit + 0x44) >>> 0, (gameFrame << 8) >>> 0)
      return endF as never
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
    return endFrame as never
  }

  const clip = clipOrEvStepType as PureCharAnimClip113c
  const startFrame = startFrameOrEvEndType
  const stepSpeed = stepSpeedArg !== undefined ? stepSpeedArg : 0
  if (stepSpeed <= 0) {
    EVENT_SetEventFull113c(m, pGame, pUnit, PLR_EVENT_MODE_END, (gameFrame + 1) >>> 0, 0, 0, 0)
    return undefined as never
  }
  const frameCount256 = clip.frames << 8
  let edi = startFrame | 0
  let acc = ((edi << 8) + stepSpeed) | 0
  let ebx = gameFrame
  let hitIdx = 0

  while (acc < frameCount256) {
    const frameIdx = acc >> 8
    ebx = (ebx + 1) >>> 0
    while (edi <= frameIdx && edi < 0x90) {
      let evCode = 0
      for (const ev of clip.events) {
        if (ev.f === edi) {
          evCode = ev.c
          break
        }
      }
      if (evCode >= 1 && evCode <= 4) {
        const arg18 = evCode === 1 || evCode === 2 ? hitIdx++ : 0
        EVENT_SetEventFull113c(m, pGame, pUnit, PLR_EVENT_MODE_STEP, ebx, 0, evCode, arg18)
      }
      edi++
    }
    acc = (acc + stepSpeed) | 0
  }

  if (ebx === gameFrame) {
    ebx = (ebx + 1) >>> 0
  }
  EVENT_SetEventFull113c(m, pGame, pUnit, PLR_EVENT_MODE_END, (ebx + 1) >>> 0, 0, 0, 0)
  return undefined as never
}

/**
 * `@va D2Game:0x6FC987C0` (`PLAYER_StartModeAttackWithTarget`) + `D2Common.#11129` (`0x6FD80E80`) +
 * `D2Common.#10031` (`0x6FD82220`) + `D2Common.#10819` (`0x6FD83180`):
 * Handle C2S `0x06` (`AttackUnit`: `06 [unitType:u32] [unitId:u32]`) on `pPlayer` during
 * `D2Game.#10040` (`0x6FC4E460`, before `pGame->dwGameFrame++` in `0x6FC4E050`).
 */
function startPlayerWalkOrRun113c(
  world: FallenSliceWorld113c,
  pPlayer: number,
  targetX: number,
  targetY: number,
  pTargetUnit: number,
  isRun: boolean,
): void {
  const { m, pGame } = world
  const pPath = m.get(pPlayer, D2UnitStrc.pPath)
  if (pPath === 0) return
  ensureSliceWorldPathMemory113c(world)
  const isTown = DUNGEON_CheckRoomIsTown113c(m, UNITS_GetRoom113c(m, pPlayer)) !== 0
  const moveMode = isRun ? PLRMODE_RUN : isTown ? PLRMODE_TOWN_WALK : PLRMODE_WALK
  const animHydrated = hasHydratedAnimDataTable113c(m)

  if (animHydrated) {
    if (pTargetUnit !== 0) {
      const tPos = getUnitPosSubtile113c(m, pTargetUnit)
      PATH_SetTargetPos113c(m, pPath, tPos.x, tPos.y)
      PLAYER_ScheduleAttackActionFrameEvents113c(m, pGame, pPlayer, -2, moveMode, pTargetUnit)
    } else {
      PATH_SetTargetUnit113c(m, pPath, 0)
      PLAYER_SetPathTargetCoordsAndWalk113c(m, pGame, pPlayer, moveMode, targetX, targetY)
    }
    const pu = world.pathUnitByPtr.get(pPlayer)
    if (pu !== undefined) {
      pu.dwAnimMode = m.get(pPlayer, D2UnitStrc.dwAnimMode)
      pu.dwFlags = m.get(pPlayer, D2UnitStrc.dwFlags)
    }
    return
  }

  const prevMode = m.get(pPlayer, D2UnitStrc.dwAnimMode)
  const statVelPct = STATLIST_GetUnitStat113c(m, pPlayer, STAT_VELOCITYPERCENT, 0) | 0
  const frwStat = STATLIST_GetUnitStat113c(m, pPlayer, STAT_FASTERMOVEVELOCITY, 0) | 0
  let totalPct =
    (statVelPct !== 0 ? statVelPct : 100) +
    computeFrwDiminishingPure113c(frwStat) +
    (isRun ? 50 : 0)
  if (totalPct < 25) totalPct = 25
  const vel = Math.trunc(((6 << 8) * totalPct) / 100) | 0
  PATH_SetVelocity113c(m, pPath, vel)
  PATH_SetStepNum113c(m, pPath, 0)
  PATH_SetNewDistance113c(m, pPath, 73)
  PATH_SetType113c(m, pPath, 7)
  if (pTargetUnit !== 0) {
    const tPos = getUnitPosSubtile113c(m, pTargetUnit)
    PATH_SetTargetPos113c(m, pPath, tPos.x, tPos.y)
    PATH_SetTargetUnit113c(m, pPath, pTargetUnit)
  } else {
    PATH_SetTargetUnit113c(m, pPath, 0)
    PATH_SetTargetPos113c(m, pPath, targetX, targetY)
  }

  const pts = PATH_Compute113c(m, pPath, pPlayer, 0)
  if (pts <= 0) {
    transitionPlayerToNeutral113c(world, pPlayer)
    return
  }

  UNITROOM_RefreshUnit113c(m, pPlayer)
  const movePlrFlags = (m.get(pPlayer, D2UnitStrc.dwFlags) | 0x01) >>> 0
  m.set(pPlayer, D2UnitStrc.dwFlags, movePlrFlags)
  if (prevMode !== moveMode) {
    m.set(pPlayer, D2UnitStrc.dwAnimMode, moveMode)
    STATLIST_ExpireStateListsOnModeChangeMemPort113c(m, pPlayer)
  } else {
    m.set(pPlayer, D2UnitStrc.dwAnimMode, moveMode)
  }
  const pu = world.pathUnitByPtr.get(pPlayer)
  if (pu !== undefined) {
    pu.dwAnimMode = moveMode
    pu.dwFlags = m.get(pPlayer, D2UnitStrc.dwFlags)
  }
  MONSTER_ClearModeEvents113c(m, pGame, pPlayer)
  MONSTER_RegisterContinuousModeEvent113c(m, pGame, pPlayer)
}

function clearPlayerPendingSkillAction113c(m: Memory113c, pPlayer: number): void {
  const pPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData) >>> 0
  if (pPlayerData !== 0) {
    m.setU32((pPlayerData + 0x150) >>> 0, 0)
    m.setU32((pPlayerData + 0x154) >>> 0, 0)
  }
}

function startPlayerAttackWithTarget113c(
  world: FallenSliceWorld113c,
  pPlayer: number,
  pTarget: number,
): void {
  const { m, pGame } = world
  PLAYER_BindLeftSkillAsUsedK3_113c(m, pPlayer)
  SUNITDMG_FreeAttackerCombatList113c(m, pPlayer, pGame)
  // D2Common.#11129 (0x6FD80E80): bind target unit into pPlayer->pPath (+0x58/+0x5C/+0x60)
  // 0x6FC9889A -> 0x6FCC0830 -> 0x6FCBFC00: if pTarget is a monster in MONMODE_DEAD (12) and skill
  // is not a corpse skill, clears pPath->pTargetUnit = 0 via D2Common.#10819(pPlayer, 0).
  const pPath = m.get(pPlayer, D2UnitStrc.pPath)
  if (pPath !== 0) {
    const isDeadMonsterCorpse =
      pTarget !== 0 &&
      m.get(pTarget, D2UnitStrc.dwUnitType) === UNIT_MONSTER &&
      m.get(pTarget, D2UnitStrc.dwAnimMode) === 12
    UNITS_SetTargetUnitForDynamicUnit113c(m, pPlayer, isDeadMonsterCorpse ? 0 : pTarget)
  }
  const pu = world.pathUnitByPtr.get(pPlayer)

  if (m.get(pPlayer, D2UnitStrc.dwAnimMode) !== PLRMODE_ATTACK1) {
    STATLIST_ExpireStateListsOnModeChangeMemPort113c(m, pPlayer)
  }
  m.set(pPlayer, D2UnitStrc.dwAnimMode, PLRMODE_ATTACK1)
  // 0x6FC987E4..0x6FC98822: `UNITROOM_RefreshUnit` + `dwFlags |= 0x01`, then clear bit 6 (`0x40`) until keyframe `0x6FCC2C51` sets it.
  if (world.hasFullDrlg === true) {
    UNITROOM_RefreshUnit113c(m, pPlayer)
  }
  const nextFlags = (
    (m.get(pPlayer, D2UnitStrc.dwFlags) & ~UNITFLAG_IN_SKILL_ACTION) |
    (world.hasFullDrlg === true ? 0x01 : 0)
  ) >>> 0
  m.set(pPlayer, D2UnitStrc.dwFlags, nextFlags)
  if (pu !== undefined) {
    pu.dwAnimMode = PLRMODE_ATTACK1
    pu.dwFlags = nextFlags
  }

  const classId = m.get(pPlayer, D2UnitStrc.dwClassId) >>> 0
  const weaponClass = resolvePlayerWeaponClass113c(world, pPlayer)
  const clip = getCharAnimClipPure113c(classId, PLRMODE_ATTACK1, weaponClass)
  const stat93 = STATLIST_GetUnitStat113c(m, pPlayer, STAT_FASTERATTACKRATE, 0) | 0
  const stat68 = STATLIST_GetUnitStat113c(m, pPlayer, STAT_ATTACKRATE, 0) | 0
  const stat67 = STATLIST_GetUnitStat113c(m, pPlayer, STAT_VELOCITYPERCENT, 0) | 0
  const stepSpeed = computeRawPlayerAnimSpeedPure113c({
    mode: PLRMODE_ATTACK1,
    classId,
    statAcc: stat93,
    stat68Acc: stat68,
    stat67Acc: stat67,
    weaponClass,
  })
  const startFrame = playerAnimStartFramePure113c(classId, PLRMODE_ATTACK1, weaponClass)

  writeUnitAnimState113c(m, pPlayer, 0, 0, clip.frames << 8, stepSpeed, 0)

  // 0x6FC98812: MONSTER_ClearModeEvents (0x6FD00750) followed by 0x6FCFF7B0 and 0x6FCC0830
  MONSTER_ClearModeEvents113c(m, pGame, pPlayer)
  SUNIT_ScheduleModeAnimEvents113c(m, pGame, pPlayer, clip, startFrame, stepSpeed)
  if (isSgptDataTablesLoaded113c(m)) {
    SKILLS_StartUsedSkill113c(m, pPlayer, pGame)
  }
}

const SLICE_C2S_PKT_SCRATCH_VA = 0x7fb90c00

function writeC2SPacketScratch113c(m: Memory113c, packetBytes: Uint8Array): number {
  const len = packetBytes.length < 64 ? packetBytes.length : 64
  for (let i = 0; i < len; i++) {
    m.setU8((SLICE_C2S_PKT_SCRATCH_VA + i) >>> 0, packetBytes[i]!)
  }
  return SLICE_C2S_PKT_SCRATCH_VA
}

function buildSliceC2SCallees113c(world: FallenSliceWorld113c): C2SPacketCallees113c {
  return {
    findServerUnit(_mem, _pg, dwUnitType, dwUnitId) {
      if (dwUnitType === UNIT_MONSTER) {
        const foundMon = world.monsterById.get(dwUnitId)
        return foundMon !== undefined ? foundMon : 0
      }
      const foundAny = world.unitsByKey.get(unitKey(dwUnitType, dwUnitId))
      return foundAny !== undefined ? foundAny : 0
    },
    onStartWalkOrRun(mem, _pg, plr, nPlrMode, nX, nY, pTargetUnit) {
      const isRun = nPlrMode === PLRMODE_RUN
      if (pTargetUnit !== 0) {
        const tPos = getUnitPosSubtile113c(mem, pTargetUnit)
        startPlayerWalkOrRun113c(world, plr, tPos.x, tPos.y, pTargetUnit, isRun)
      } else {
        startPlayerWalkOrRun113c(world, plr, nX, nY, 0, isRun)
      }
    },
    onStartAttackOnUnit(_mem, _pg, plr, pTargetUnit) {
      startPlayerAttackWithTarget113c(world, plr, pTargetUnit)
    },
    onAfterModeStarted(mem, plr) {
      const pu = world.pathUnitByPtr.get(plr)
      if (pu !== undefined) {
        pu.dwAnimMode = mem.get(plr, D2UnitStrc.dwAnimMode)
        pu.dwFlags = mem.get(plr, D2UnitStrc.dwFlags)
      }
    },
  }
}

export function applyPlayerPacket113c(
  world: FallenSliceWorld113c,
  pPlayer: number,
  packetBytes: Uint8Array,
): void {
  hitD2GameVa113c(0x6FC987C0)
  if (packetBytes.length === 0) return
  if (
    k4ReplayBridge !== null &&
    k4ReplayBridge.tryApplyQuestAndNpcC2SPacket(world.m, world.pGame, pPlayer, packetBytes, () => {
      syncActRoomsAndUnitsIntoWorld113c(world)
      pruneRemovedUnitsFromWorld113c(world)
    })
  ) {
    return
  }
  const { m, pGame } = world
  const op = packetBytes[0]!
  const view = new DataView(packetBytes.buffer, packetBytes.byteOffset, packetBytes.byteLength)
  const hasPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData) !== 0
  if ((op === 0x01 || op === 0x03) && packetBytes.length >= 5) {
    ensureSliceWorldPathMemory113c(world)
    if (hasPlayerData) {
      const pPkt = writeC2SPacketScratch113c(m, packetBytes)
      const callees = buildSliceC2SCallees113c(world)
      if (op === 0x01) {
        C2S_Packet01_WalkToLocation113c(m, pGame, pPlayer, pPkt, 5, callees)
      } else {
        C2S_Packet03_RunToLocation113c(m, pGame, pPlayer, pPkt, 5, callees)
      }
      return
    }
    const reqMode = op === 0x03 ? PLRMODE_RUN : PLRMODE_WALK
    if (PLAYER_CanStartModeAndSkillK3_113c(m, pPlayer, pGame, reqMode, 0) === 0) return
    clearPlayerPendingSkillAction113c(m, pPlayer)
    const x = view.getUint16(1, true)
    const y = view.getUint16(3, true)
    startPlayerWalkOrRun113c(world, pPlayer, x, y, 0, op === 0x03)
    return
  }
  if ((op === 0x02 || op === 0x04) && packetBytes.length >= 9) {
    ensureSliceWorldPathMemory113c(world)
    if (hasPlayerData) {
      const pPkt = writeC2SPacketScratch113c(m, packetBytes)
      const callees = buildSliceC2SCallees113c(world)
      if (op === 0x02) {
        C2S_Packet02_WalkToUnit113c(m, pGame, pPlayer, pPkt, 9, callees)
      } else {
        C2S_Packet04_RunToUnit113c(m, pGame, pPlayer, pPkt, 9, callees)
      }
      return
    }
    const reqMode = op === 0x04 ? PLRMODE_RUN : PLRMODE_WALK
    if (PLAYER_CanStartModeAndSkillK3_113c(m, pPlayer, pGame, reqMode, 0) === 0) return
    clearPlayerPendingSkillAction113c(m, pPlayer)
    const targetType = view.getUint32(1, true)
    const targetId = view.getUint32(5, true)
    let pTarget = 0
    if (targetType === UNIT_MONSTER) {
      const foundMon = world.monsterById.get(targetId)
      pTarget = foundMon !== undefined ? foundMon : 0
    } else {
      const foundAny = world.unitsByKey.get(unitKey(targetType, targetId))
      pTarget = foundAny !== undefined ? foundAny : 0
    }
    if (pTarget !== 0) {
      const tPos = getUnitPosSubtile113c(m, pTarget)
      startPlayerWalkOrRun113c(world, pPlayer, tPos.x, tPos.y, pTarget, op === 0x04)
    }
    return
  }
  if (op === 0x3c && packetBytes.length >= 9) {
    const wSkillId = view.getUint16(1, true)
    const bLeft = packetBytes[4]! !== 0 ? 1 : 0
    const dwItemGuid = view.getInt32(5, true)
    if (pGame !== 0) {
      m.set(pPlayer, D2UnitStrc.pGame, pGame)
    }
    if (dwItemGuid === -1 && SKILLS_GetSkillById113c(m, pPlayer, wSkillId, -1) === 0) {
      SKILLS_AddSkillToUnit113c(m, pPlayer, wSkillId)
    }
    const pPkt = writeC2SPacketScratch113c(m, packetBytes)
    const rc = C2S_Packet3C_SelectSkill113c(m, pGame, pPlayer, pPkt, 9)
    if (rc !== 0) {
      SKILLS_AssignHandSkillAndSyncAura113c(m, pPlayer, bLeft, wSkillId, dwItemGuid)
    }
    return
  }
  if (op === 0x0c || op === 0x0d) {
    ensureSliceWorldPathMemory113c(world)
    PLAYER_HandleC2SRightSkillK3_113c(
      m,
      pGame,
      pPlayer,
      packetBytes,
      (targetType, targetId) => {
        if (targetType === UNIT_MONSTER) {
          const foundMon = world.monsterById.get(targetId)
          return foundMon !== undefined ? foundMon : 0
        }
        const foundAny = world.unitsByKey.get(unitKey(targetType, targetId))
        return foundAny !== undefined ? foundAny : 0
      },
      (mode, flags) => {
        const pu = world.pathUnitByPtr.get(pPlayer)
        if (pu !== undefined) {
          pu.dwAnimMode = mode
          pu.dwFlags = flags
        }
      },
    )
    return
  }
  if (packetBytes.length < 9 || op !== 0x06) return
  ensureSliceWorldPathMemory113c(world)
  if (isSgptDataTablesLoaded113c(m) && UNITS_GetLeftSkill113c(m, pPlayer) !== 0) {
    const pPkt = writeC2SPacketScratch113c(m, packetBytes)
    const callees = buildSliceC2SCallees113c(world)
    C2S_Packet06_LeftSkillOnUnit113c(m, pGame, pPlayer, pPkt, 9, callees)
    return
  }
  const targetType = view.getUint32(1, true)
  const targetId = view.getUint32(5, true)

  let pTarget = 0
  if (targetType === UNIT_MONSTER) {
    const foundMon = world.monsterById.get(targetId)
    pTarget = foundMon !== undefined ? foundMon : 0
  } else {
    const foundAny = world.unitsByKey.get(unitKey(targetType, targetId))
    pTarget = foundAny !== undefined ? foundAny : 0
  }
  if (pTarget === 0) return

  // 0x6FCEE9D0 -> 0x6FCEE620: check melee range via D2Common.#10793 + D2Common.#11138
  const pLeftSkill = UNITS_GetLeftSkill113c(m, pPlayer)
  const bTargetMoving = UNITS_IsUnitMovingBool113c(m, pTarget)
  if (UNITS_CanUnitMeleeAttackTarget113c(m, pPlayer, pTarget, bTargetMoving) === 0) {
    // 0x6FCEE120 -> 0x6FC98430(..., mode = 3): call 0x6FC98430 first, then record pending skill-on-target (+0x150..+0x15C)
    const canRun = PLAYER_CanStartModeAndSkillK3_113c(m, pPlayer, pGame, PLRMODE_RUN, 0)
    const pPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData) >>> 0
    if (pPlayerData !== 0) {
      m.setU32((pPlayerData + 0x150) >>> 0, 1)
      m.setU32((pPlayerData + 0x154) >>> 0, 0)
      m.setU32((pPlayerData + 0x158) >>> 0, targetType >>> 0)
      m.setU32((pPlayerData + 0x15c) >>> 0, targetId >>> 0)
    }
    if (canRun === 0) return
    const tPos = getUnitPosSubtile113c(m, pTarget)
    startPlayerWalkOrRun113c(world, pPlayer, tPos.x, tPos.y, pTarget, true)
    return
  }

  if (PLAYER_CanStartModeAndSkillK3_113c(m, pPlayer, pGame, PLRMODE_ATTACK1, pLeftSkill) === 0) return
  clearPlayerPendingSkillAction113c(m, pPlayer)
  startPlayerAttackWithTarget113c(world, pPlayer, pTarget)
}

/**
 * Hydrate a complete `FallenSliceWorld113c` directly from `a1c-memdump-f785.ndjson.gz` and
 * `a1c-coll-f785.bin.gz` in `SparseMemory113c` (with zero legacy dependencies).
 */
export function hydrateFallenSliceFromMemdump113c(
  m: Memory113c,
  snapshot: MemdumpSnapshot113c,
  collRaw: Uint8Array,
): FallenSliceWorld113c {
  let pGame = 0
  let pTimer = 0
  const unitsByKey = new Map<string, number>()
  const monsterById = new Map<number, number>()
  const playerById = new Map<number, number>()
  const roomPtrs = new Set<number>()

  for (const uEntry of snapshot.mem) {
    let pUnit = 0
    for (const blk of uEntry.blocks) {
      const bytes = decodeHexBytes113c(blk.h)
      const baseAddr = blk.a >>> 0
      for (let i = 0; i < bytes.length; i++) {
        m.setU8((baseAddr + i) >>> 0, bytes[i]!)
      }
      if (blk.n === 'game') {
        if (pGame === 0 && bytes.length < D2GameStrc_SIZE) {
          for (let i = bytes.length; i < D2GameStrc_SIZE; i++) {
            m.setU8((baseAddr + i) >>> 0, 0)
          }
        }
        pGame = baseAddr
      } else if (blk.n === 'timer') pTimer = baseAddr
      else if (blk.n === 'unit') pUnit = baseAddr
      else if (blk.n === 'itemunit') {
        const iType = m.get(baseAddr, D2UnitStrc.dwUnitType)
        const iId = m.get(baseAddr, D2UnitStrc.dwUnitId)
        unitsByKey.set(unitKey(iType, iId), baseAddr)
      } else if (blk.n === 'room' || blk.n === 'adjroom' || blk.n === 'nearroom') {
        roomPtrs.add(baseAddr)
      } else if (blk.n === 'childstatlist' && bytes.length < D2StatListExStrc_SIZE) {
        for (let i = bytes.length; i < D2StatListExStrc_SIZE; i++) {
          m.setU8((baseAddr + i) >>> 0, 0)
        }
      }
    }
    if (pUnit !== 0) {
      unitsByKey.set(unitKey(uEntry.type, uEntry.id), pUnit)
      if (uEntry.type === UNIT_MONSTER) monsterById.set(uEntry.id, pUnit)
      else if (uEntry.type === UNIT_PLAYER) playerById.set(uEntry.id, pUnit)
    }
  }

  m.set(pGame, D2GameStrc.dwGameFrame, snapshot.frame >>> 0)
  // Populate `pGame->pUnitHash` (`+0x1120`) player hash buckets and `clientById` (`pPlayerData+0x9C -> pClient+0x00`)
  const clientById = new Map<number, number>()
  for (const pUnit of playerById.values()) {
    const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
    m.set(pGame, D2GameStrc.pUnitHash, pUnit, uId & 0x7f)
    const pPlrData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
    if (pPlrData !== 0) {
      const pClient = m.u32(pPlrData + 0x9c) >>> 0
      if (pClient !== 0) {
        const dwClientId = m.u32(pClient) >>> 0
        clientById.set(dwClientId, pUnit)
      }
    }
  }
  // Rebind `pTimer->pPool` to a live `0x7088` chunk in `SparseMemory113c`
  m.set(pTimer, D2TimerStrc.pPool, 0)
  EVENT_AllocChunk113c(m, pTimer)
  ensureD2CommonPathGlobals113c(m)

  // Parse `a1c-coll-f785.bin.gz`: header `(x0, y0, w, h)` + `uint16[w * h]` at byte 16
  const collView = new DataView(collRaw.buffer, collRaw.byteOffset, collRaw.byteLength)
  const cx0 = collView.getUint32(0, true)
  const cy0 = collView.getUint32(4, true)
  const cw = collView.getUint32(8, true)
  const ch = collView.getUint32(12, true)
  const maskCells = new Uint16Array(cw * ch)
  for (let i = 0; i < cw * ch; i++) {
    maskCells[i] = collView.getUint16(16 + i * 2, true)
  }

  const sharedGrid: SlicePathCollisionGrid113c = {
    get(x: number, y: number): number {
      const rx = (x | 0) - cx0
      const ry = (y | 0) - cy0
      if (rx < 0 || ry < 0 || rx >= cw || ry >= ch) return COLLIDE_MASK_INVALID_113C
      return maskCells[ry * cw + rx]!
    },
    set(x: number, y: number, value: number): void {
      const rx = (x | 0) - cx0
      const ry = (y | 0) - cy0
      if (rx < 0 || ry < 0 || rx >= cw || ry >= ch) return
      maskCells[ry * cw + rx] = value & 0xffff
    },
  }

  // Bind native `D2RoomCollisionGridStrc` (`+0x20`) in `Memory113c` for every dumped room
  const roomByPtr = new Map<number, MutablePathRoom113c>()
  for (const rPtr of roomPtrs) {
    const subX = m.get(rPtr, D2ActiveRoomStrc.nSubtileX) | 0
    const subY = m.get(rPtr, D2ActiveRoomStrc.nSubtileY) | 0
    const subW = m.get(rPtr, D2ActiveRoomStrc.nSubtileWidth) | 0
    const subH = m.get(rPtr, D2ActiveRoomStrc.nSubtileHeight) | 0
    bindRoomCollisionGrid113c(m, rPtr, subX, subY, subW, subH, (x, y) => sharedGrid.get(x, y))
    roomByPtr.set(rPtr, {
      ptr: rPtr,
      subX,
      subY,
      subW,
      subH,
      isTown: DUNGEON_CheckRoomIsTown113c(m, rPtr) !== 0,
      adjacentRooms: [],
      grid: sharedGrid,
    })
  }
  for (const [rPtr, roomObj] of roomByPtr) {
    const ppRoomsNear = m.get(rPtr, D2ActiveRoomStrc.ppRoomsNear) >>> 0
    const nRoomsNear = m.get(rPtr, D2ActiveRoomStrc.nRoomsNear) >>> 0
    const adjList: MutablePathRoom113c[] = []
    if (ppRoomsNear !== 0 && nRoomsNear <= 32) {
      for (let i = 0; i < nRoomsNear; i++) {
        const nearPtr = m.u32(ppRoomsNear + i * 4) >>> 0
        if (nearPtr === 0 || nearPtr === rPtr) continue
        const adj = roomByPtr.get(nearPtr)
        if (adj !== undefined) adjList.push(adj)
      }
    }
    roomObj.adjacentRooms = adjList
  }

  // Normalize Wine `D2Game.dll` (`0x01990000`) `pfnThink` VAs to `0x6FC20000` and build minion lists
  const minionIdsByLeaderId = new Map<number, number[]>()
  for (const [monId, pMon] of monsterById) {
    const pMonData = m.get(pMon, D2UnitStrc.pUnitData)
    if (pMonData === 0) continue
    const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
    if (pAiGen === 0) continue
    const rawThink = m.get(pAiGen, D2AiGeneralStrc.pfnThink) >>> 0
    if (rawThink !== 0 && ((rawThink - 0x83130) & 0xffff) === 0) {
      m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_FALLEN_113C)
    } else if (rawThink !== 0 && ((rawThink - 0x838b0) & 0xffff) === 0) {
      m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_ZOMBIE_113C)
    }
    m.set(pAiGen, D2AiGeneralStrc.pCommandHead, 0)
    m.set(pAiGen, D2AiGeneralStrc.pCommandTail, 0)

    const pGroup = m.get(pAiGen, D2AiGeneralStrc.pGroup)
    const leaderId = m.get(pAiGen, D2AiGeneralStrc.dwLeaderId)
    const leaderType = m.get(pAiGen, D2AiGeneralStrc.dwLeaderType)
    if (pGroup !== 0 && leaderType === 1 && leaderId !== monId) {
      let list = minionIdsByLeaderId.get(leaderId)
      if (list === undefined) {
        list = []
        minionIdsByLeaderId.set(leaderId, list)
      }
      list.unshift(monId) // `0x6FC40CF0` prepends newest spawned minion first
    }
  }

  const pathUnitByPtr = new Map<number, MutablePathUnit113c>()
  for (const pUnit of unitsByKey.values()) {
    if (m.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_ITEM) continue
    const pPath = m.get(pUnit, D2UnitStrc.pPath)
    const pu: MutablePathUnit113c = {
      pUnit,
      pPath,
      dwUnitType: m.get(pUnit, D2UnitStrc.dwUnitType),
      dwClassId: m.get(pUnit, D2UnitStrc.dwClassId),
      dwUnitId: m.get(pUnit, D2UnitStrc.dwUnitId),
      dwAnimMode: m.get(pUnit, D2UnitStrc.dwAnimMode),
      dwFlags: m.get(pUnit, D2UnitStrc.dwFlags),
      dwFlagEx: m.get(pUnit, D2UnitStrc.dwFlags2),
    }
    pathUnitByPtr.set(pUnit, pu)
  }

  const world: FallenSliceWorld113c = {
    m,
    pGame,
    pTimer,
    hasFullDrlg: false,
    playerKillsById: new Map<number, number>(),
    dirtyKillPlayerIds: new Set<number>(),
    unitsByKey,
    monsterById,
    playerById,
    clientById,
    pathUnitByPtr,
    roomByPtr,
    minionIdsByLeaderId,
    lastFrameOrd: [],
    lastFrameDmg: [],
  }
  attachSliceWorldCallbacks113c(world)
  return world
}

/**
 * `@va D2Game:0x6FC4E460` (`D2Game.#10040`) + `@va D2Game:0x6FC4E050` (`D2Game.#10008` per-frame step):
 * 1. Drain incoming C2S packets (`0x6FC4E485..0x6FC4E4A3`) while `pGame->dwGameFrame` is still at `N`.
 * 2. Increment `pGame->dwGameFrame` to `N + 1` (`0x6FC4E053..0x6FC4E063`).
 * 3. Execute `EVENT_UpdateTimers113c` (`0x6FCAF070`) across partitions `[2, 0, 1, 3, 4]`.
 * 4. Clear per-tick room-sync dirty flags (`dwFlags &= ~0x80001`).
 */
export function stepFallenSliceFrame113c(
  world: FallenSliceWorld113c,
  c2sPackets: ReadonlyArray<readonly [clientId: number, hexPayload: string]> = [],
): number {
  hitD2GameVa113c(0x6FC4E050)
  attachSliceWorldCallbacks113c(world)
  const { m, pGame } = world
  world.lastFrameOrd.length = 0
  world.lastFrameDmg.length = 0
  ensureSliceWorldPathMemory113c(world)

  for (const [clientId, hexPayload] of c2sPackets) {
    const pPlayer = world.clientById?.get(clientId >>> 0)
    if (pPlayer === undefined || pPlayer === 0) {
      throw new Error(`Unmapped C2S clientId ${clientId}`)
    }
    applyPlayerPacket113c(world, pPlayer, decodeHexBytes113c(hexPayload))
  }

  const nextFrame = ((m.get(pGame, D2GameStrc.dwGameFrame) >>> 0) + 1) >>> 0
  m.set(pGame, D2GameStrc.dwGameFrame, nextFrame)
  syncVirtualTickCountK3_113c(m, nextFrame)
  if (hasHydratedItemTables113c(m)) {
    GAME_StepActEnvironmentCycles113c(m, pGame)
    GAME_UpdateTickRateMetrics113c(m, pGame)
    if (m.u32((pGame + 0x10f4) >>> 0) !== 0) {
      QUESTS_StepQuestTimers113c(m, pGame)
    }
  }

  // 0x6FC4E050 step 1: `GAME_UpdateActRooms` (`0x6FC4CBE0` / `0x6FCBD5B0`)
  let playerInTown = true
  for (const pPlr of world.playerById.values()) {
    const pPlrRoom = UNITS_GetRoom113c(m, pPlr) >>> 0
    if (pPlrRoom !== 0 && DUNGEON_GetLevelIdFromRoom113c(m, pPlrRoom) !== 1) {
      playerInTown = false
      break
    }
  }
  let bRoomListDirty = 0
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    const pActCur = m.u32((pGame + 0xbc + actIdx * 4) >>> 0) >>> 0
    if (pActCur !== 0 && (m.u32((pActCur + 0x54) >>> 0) >>> 0) !== 0) {
      bRoomListDirty = 1
      break
    }
  }
  if (!world.hasFullDrlg && playerInTown && bRoomListDirty === 0) {
    SLICE_UpdateAllRooms113c(world)
  }
  if (bRoomListDirty !== 0) {
    const actCallees = buildActRoomsCallees113c(world)
    GAME_UpdateActRooms113c(m, pGame, actCallees)
    syncActRoomsAndUnitsIntoWorld113c(world)
  }

  const k2MeleeDotHooks: K2GapMeleeDotHooks113c = MISSILE_BuildK3Hooks113c(
    (_mem, _pg, pDefender, pAttacker) => {
      if (m.get(pDefender, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
        const curMode = m.get(pDefender, D2UnitStrc.dwAnimMode)
        if (curMode !== 0 && curMode !== 12) {
          attachSliceWorldCallbacks113c(world)
          MONSTER_StartDeath113c(world, pDefender, pAttacker)
        }
      }
    },
  )

  const fired = EVENT_UpdateTimers113c(m, pGame, (_mem, _g, pUnit, evType, arg14, arg18, _fn, pNode) => {
    if (pUnit === 0) return
    const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
    const uId = m.get(pUnit, D2UnitStrc.dwUnitId)

    if (uType === UNIT_PLAYER) {
      if (evType === PLR_EVENT_MODE_STEP) {
        const mode = m.get(pUnit, D2UnitStrc.dwAnimMode)
        if (
          mode === PLRMODE_WALK ||
          mode === PLRMODE_RUN ||
          mode === PLRMODE_TOWN_WALK ||
          mode === 19
        ) {
          // 0x6FC99A10 (`PLAYER_StepAnimationModeTick`) -> 0x6FD279D0[mode] = 0x6FC99B90 (locomotion step)
          let finishedMoveToNeutral = false
          PLAYER_StepAnimationModeTick113c(m, pGame, pUnit, arg14, arg18, (mem, pg, plr) => {
            const pPath = mem.get(plr, D2UnitStrc.pPath)
            if (pPath === 0) return 1
            if (mode === PLRMODE_RUN) {
              PLAYER_DrainRunStamina113c(mem, plr)
            }
            if (pg !== 0 && isSgptDataTablesLoaded113c(mem)) {
              SUNIT_ValidatePathTargetUnit113c(mem, plr, pg)
            }
            const stepped = PATH_Step113c(mem, plr, 0)
            if (UNITS_GetPathRoomRefreshFlag113c(mem, plr) !== 0) {
              SUNIT_UpdateUnitPositionAndRoom113c(mem, 0, plr, pg)
            }
            recordPlayerWalkBreadcrumbK3_113c(mem, pg, plr)
            if (stepped === 0) {
              const pPlayerData = mem.get(plr, D2UnitStrc.pUnitData) >>> 0
              if (pPlayerData !== 0 && mem.u32((pPlayerData + 0x150) >>> 0) !== 0) {
                const interactAction = mem.u32((pPlayerData + 0x154) >>> 0) | 0
                const targetType = PLAYER_GetParam158_113c(mem, plr) >>> 0
                const targetId = PLAYER_GetParam15C_113c(mem, plr) >>> 0
                if (interactAction < 0 && k4ReplayBridge !== null) {
                  mem.setU32((pPlayerData + 0x150) >>> 0, 0)
                  PLAYER_FinishModeAndResetToNeutral113c(mem, pg, plr, arg14, arg18)
                  syncPlayerNeutralAnimAfterReset113c(world, plr)
                  k4ReplayBridge.executeQueuedPlayerEntityInteract(
                    mem,
                    pg,
                    plr,
                    interactAction,
                    targetType,
                    targetId,
                  )
                  syncActRoomsAndUnitsIntoWorld113c(world)
                  return 1
                }
                mem.setU32((pPlayerData + 0x150) >>> 0, 0)
                mem.setU32((pPlayerData + 0x154) >>> 0, 0)
                if (interactAction >= 0 && isSgptDataTablesLoaded113c(mem)) {
                  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(mem, plr, interactAction)
                }
                let pTarget = 0
                if (targetType === UNIT_MONSTER) {
                  const foundMon = world.monsterById.get(targetId)
                  pTarget = foundMon !== undefined ? foundMon : 0
                } else {
                  const foundAny = world.unitsByKey.get(unitKey(targetType, targetId))
                  pTarget = foundAny !== undefined ? foundAny : 0
                }
                if (pTarget !== 0 && SUNIT_IsDeadOrDying113c(mem, pTarget) === 0) {
                  startPlayerAttackWithTarget113c(world, plr, pTarget)
                  return 1
                }
              }
              finishedMoveToNeutral = true
              return 2
            }
            return 1
          })
          if (finishedMoveToNeutral) {
            syncPlayerNeutralAnimAfterReset113c(world, pUnit)
          }
        } else if (
          mode === 10 ||
          (mode === 18 && PLAYER_IsNonMeleeSequenceSkillK3_113c(m, pUnit))
        ) {
          PLAYER_StepSkillKeyframeK3_113c(m, pGame, pUnit, arg14, arg18, k2MeleeDotHooks)
          syncActRoomsAndUnitsIntoWorld113c(world)
          pruneRemovedUnitsFromWorld113c(world)
        } else if (
          mode >= PLRMODE_ATTACK1 &&
          mode <= 18 &&
          mode !== 17 &&
          mode !== 9 &&
          mode !== 13
        ) {
          // 0x6FD279D0[mode] = 0x6FC99170 (`PLAYER_StartModeDispatch` -> `0x6FCC2060` -> `0x6FCC19A0` -> `0x6FCC2C40`)
          if (arg14 === 1) {
            const pPath = m.get(pUnit, D2UnitStrc.pPath)
            const pDef = pPath !== 0 ? m.get(pPath, D2DynamicPathStrc.pTargetUnit) : 0
            if (pDef !== 0) {
              const pUsed = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
              if (pUsed !== 0 && isSgptDataTablesLoaded113c(m)) {
                ensureSliceWorldPathMemory113c(world)
                attachSliceWorldCallbacks113c(world)
                let recordedHit = false
                let hitAtt = pUnit
                let hitDef = pDef
                let hitRetDmg = 0
                const meleeHooks = buildSliceMeleeCombatHooks113c(world, (pAtt, pD, ret) => {
                  recordedHit = true
                  hitAtt = pAtt
                  hitDef = pD
                  hitRetDmg = ret
                })
                PLAYER_StartModeDispatch113c(m, pGame, pUnit, arg14, arg18, '1HS', (mem, pg, plr) =>
                  SKILLS_DoUsedSkillAction113c(mem, plr, pg, undefined, meleeHooks),
                )
                if (recordedHit) {
                  world.lastFrameDmg.push({
                    att: [m.get(hitAtt, D2UnitStrc.dwUnitType), m.get(hitAtt, D2UnitStrc.dwUnitId)],
                    def: [m.get(hitDef, D2UnitStrc.dwUnitType), m.get(hitDef, D2UnitStrc.dwUnitId)],
                    ret: hitRetDmg,
                  })
                }
              } else {
                const nextFlags =
                  (m.get(pUnit, D2UnitStrc.dwFlags) | UNITFLAG_IN_SKILL_ACTION) >>> 0
                m.set(pUnit, D2UnitStrc.dwFlags, nextFlags)
                const pu = world.pathUnitByPtr.get(pUnit)
                if (pu !== undefined) pu.dwFlags = nextFlags
                SUNITDMG_ExecuteMissileOrMeleeDmg113c(world, pUnit, pDef)
              }
            }
          }
        }
      } else if (evType === PLR_EVENT_MODE_END) {
        const curPlrMode = m.get(pUnit, D2UnitStrc.dwAnimMode)
        if (
          curPlrMode === PLRMODE_ATTACK1 ||
          curPlrMode === PLRMODE_BLOCK ||
          curPlrMode === 10 ||
          curPlrMode === 13 ||
          curPlrMode === 18
        ) {
          transitionPlayerToNeutral113c(world, pUnit, true)
        }
      } else if (evType === PLR_EVENT_STAMINA) {
        PLAYER_Event3_RegenTick113c(m, pGame, pUnit)
      } else if (evType === PLR_EVENT_IDLE) {
        PLAYER_Event11_PeriodicTick113c(m, pGame, pUnit)
      } else if (evType === 8) {
        SKILLS_Event08_AuraPulseTick113c(m, pGame, pUnit, arg14, arg18)
      } else if (evType === 12) {
        PLAYER_Event0C_ExpireTimedStatsWithSyncK3_113c(
          m,
          pGame,
          pUnit,
          arg14,
          arg18,
          k2MeleeDotHooks,
        )
      }
      return
    }

    if (uType === UNIT_MONSTER) {
      const isPersistent = (m.get(pNode, D2EventStrc.fFlags) & 0x04) !== 0
      const phase = isPersistent ? 2 : 1
      const preMode = m.get(pUnit, D2UnitStrc.dwAnimMode)
      world.lastFrameOrd.push([phase, evType, uType, uId, preMode])

      MONSTER_DispatchEvent113c(m, pGame, pUnit, evType, arg14, arg18, {
        onModeStep(_m, _pg, pMon, entry) {
          if (entry.pfnStep === VA_MONSTER_STEP_WALK_113C) {
            MONSTER_StepWalk113c(world, pMon)
          } else if (entry.pfnStep === VA_MONSTER_STEP_RUN_113C) {
            MONSTER_StepRun113c(world, pMon)
          } else if (entry.pfnStep === VA_MONSTER_STEP_ATTACK_113C) {
            stepMonsterAttackOrSkillActionK3_113c(world, pMon, arg14, k2MeleeDotHooks)
          } else if (entry.pfnStep === VA_MONSTER_CLEAR_STEP_113C) {
            MONSTER_ClearStepEvents113c(m, pGame, pMon)
          }
        },
        onModeEnd(_m, _pg, pMon, entry) {
          if (entry.pfnEnd === VA_MONSTER_END_DEATH_113C) {
            MONSTER_EndDeath113c(world, pMon)
          } else if (entry.pfnEnd === VA_MONSTER_END_TO_AI_113C) {
            MONSTER_EndToAiOrNeutral113c(world, pMon)
          }
        },
        onAiThink(_m, _pg, pMon, _pAiGen, pfnThink) {
          runMonsterAiDriver113c(world, pMon, pfnThink)
        },
        onStatRegen(mem, pg, pMon, a1, a2) {
          const dotHooks: K2GapMeleeDotHooks113c = {
            ...k2MeleeDotHooks,
            killUnit(m2, pg2, pDef, pAtt, bAwardExp) {
              m2.setU32((pDef + 0xb0) >>> 0, 0)
              k2MeleeDotHooks.killUnit?.(m2, pg2, pDef, pAtt, bAwardExp)
            },
          }
          MONSTER_Event03_RegenAndPoisonTick113c(mem, pg, pMon, a1, a2, dotHooks)
        },
        onOtherEvent(mem, pg, pMon, ev, _hVa, a1, a2) {
          if (ev === 12) {
            MONSTER_Event12_ExpireTimedStats113c(mem, pg, pMon, a1, a2, k2MeleeDotHooks)
          }
        },
      })
      return
    }

    if (uType === 3) {
      MISSILE_DispatchFrameTick113c(m, pGame, pUnit, k2MeleeDotHooks)
    } else if (uType === UNIT_ITEM) {
      dispatchItemTimerEventK3_113c(m, pGame, pUnit, evType)
    }
    },
    [
      (mem, pg, pt, slot, disp) =>
        EVENT_ExecuteMissileEvents113c(mem, pg, pt, slot, {
          allowZeroHandler: true,
          dispatchMissileEvent: (m2, fn, g2, u, ev, a14, a18, node) =>
            disp(m2, g2, u, ev, a14, a18, fn, node !== undefined ? node : 0),
        }),
      (mem, pg, pt, slot, disp) =>
        EVENT_ExecutePlayerEvents113c(mem, pg, pt, slot, {
          dispatchPlayerEvent: (m2, g2, u, ev, a14, a18, node) =>
            disp(m2, g2, u, ev, a14, a18, 0, node !== undefined ? node : 0),
        }),
      (mem, pg, pt, slot, disp) =>
        EVENT_ExecuteMonsterEvents113c(mem, pg, pt, slot, {
          dispatchMonsterEvent: (m2, g2, u, ev, a14, a18, node) =>
            disp(m2, g2, u, ev, a14, a18, 0, node !== undefined ? node : 0),
        }),
      (mem, pg, pt, slot) => EVENT_ExecuteObjectEvents113c(mem, pg, pt, slot),
      (mem, pg, pt, slot, disp) =>
        EVENT_ExecuteItemEvents113c(mem, pg, pt, slot, {
          allowZeroHandler: true,
          dispatchItemEvent: (m2, fn, g2, u, ev, a14, a18, node) =>
            disp(m2, g2, u, ev, a14, a18, fn, node !== undefined ? node : 0),
        }),
    ],
  )

  if (hasHydratedItemTables113c(m)) {
    GAME_ExpireItemsAndMinionListsPeriodic113c(m, pGame)
  } else {
    for (let act = 0; act < 5; act++) {
      if (nextFrame % 1500 === 0) {
        ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c(m, pGame, act)
      }
      AIGENERAL_ExpireMinionListsInAct113c(m, pGame, act)
    }
  }

  // 0x6FC4E07D -> 0x6FC4D9B0 (`GAME_StepClientJoinStatesAndTimeouts`) -> 0x6FC6B400 (`CLIENTS_UpdatePlayerRoom`)
  const pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  if (pClient !== 0) {
    const pPlr = (m.u32((pClient + 0x174) >>> 0) || m.u32((pClient + 0x1a8) >>> 0)) >>> 0
    const pOldRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
    const pNewRoom = pPlr !== 0 ? (UNITS_GetRoom113c(m, pPlr) >>> 0) : 0
    if (world.hasFullDrlg === true && pOldRoom !== 0 && pNewRoom !== 0 && pOldRoom !== pNewRoom) {
      const oldLvl = DUNGEON_GetLevelIdFromRoom113c(m, pOldRoom)
      const newLvl = DUNGEON_GetLevelIdFromRoom113c(m, pNewRoom)
      CLIENTS_SetPlayerCurrentRoom113c(m, pClient, pNewRoom)
      if (oldLvl !== newLvl) {
        QUESTS_NotifyLevelChange113c(m, pGame, pPlr, oldLvl, newLvl)
        NPCS_OnPlayerLevelChange113c(m, pGame, oldLvl, pPlr, newLvl)
      }
      syncActRoomsAndUnitsIntoWorld113c(world)
    }
    if (world.dirtyKillPlayerIds !== undefined && world.playerKillsById !== undefined && world.dirtyKillPlayerIds.size > 0) {
      const pArenaCtrl = m.u32((pGame + 0x1d28) >>> 0) >>> 0
      for (const plrId of world.dirtyKillPlayerIds) {
        const pDirtyPlr = world.playerById.get(plrId)
        if (pDirtyPlr !== undefined && pDirtyPlr !== 0) {
          const pPlrData = m.get(pDirtyPlr, D2UnitStrc.pUnitData) >>> 0
          const pArenaUnit = pPlrData !== 0 ? (m.u32((pPlrData + 0x34) >>> 0) >>> 0) : 0
          const kc = world.playerKillsById.get(plrId)
          if (pArenaUnit !== 0 && pArenaCtrl !== 0) {
            m.setU16(pArenaUnit, (kc !== undefined ? kc : 0) & 0xffff)
            m.setU32((pArenaUnit + 4) >>> 0, 1)
            m.setU32((pArenaCtrl + 8) >>> 0, (m.u32((pArenaCtrl + 8) >>> 0) | 0x400) >>> 0)
            world.dirtyKillPlayerIds.delete(plrId)
          }
        }
      }
    }
    const syncCallees = buildClientRoomSyncCallees113c(world, pClient, pPlr)
    const clientRoomOpts = {
      syncCallees,
      ignoreActDirtyFlag: true,
      skipArenaSync: false,
      skipRefreshUnit: true,
      onRoomChanged: () => {
        if (world.hasFullDrlg === true) {
          syncActRoomsAndUnitsIntoWorld113c(world)
        }
      },
    }
    if (hasHydratedItemTables113c(m)) {
      GAME_StepClientJoinStatesAndTimeouts113c(m, pGame, 0, { clientRoomOpts })
    } else {
      CLIENTS_UpdatePlayerRoom113c(m, pClient, pGame, clientRoomOpts)
    }
    if (pPlr !== 0 && world.dirtyKillPlayerIds !== undefined && world.playerKillsById !== undefined) {
      const plrId = m.get(pPlr, D2UnitStrc.dwUnitId) >>> 0
      if (world.dirtyKillPlayerIds.has(plrId)) {
        const kc = world.playerKillsById.get(plrId)
        S2C_SendPacket65_PlayerKillCount113c(m, pClient, plrId, kc !== undefined ? kc : 0)
        world.dirtyKillPlayerIds.delete(plrId)
      }
    }
  }

  // 0x6FCBD850 + 0x6FD00860 end-of-frame room update sweep: clears unit notify lists (`+0xEC`),
  // dirty GFX state dwords (`pStateFlags[6..11]`), `pRoom->pUpdateList`, and per-tick sync bits.
  const clearRoomUnitPerTickState = (uUpd: number): void => {
    if (hasHydratedItemTables113c(m)) {
      SUNIT_DeactivateUnitStatesAndEvents113c(m, uUpd, pGame)
      const pu = world.pathUnitByPtr.get(uUpd)
      if (pu !== undefined) {
        pu.dwFlags = m.get(uUpd, D2UnitStrc.dwFlags) >>> 0
      }
      return
    }
    const pListEx = m.get(uUpd, D2UnitStrc.pStatListEx)
    if (pListEx !== 0 && (m.get(pListEx, D2StatListStrc.dwFlags) & 0x80000000) !== 0) {
      const pStateFlags = m.get(pListEx, D2StatListExStrc.pStateFlags)
      if (pStateFlags !== 0) {
        for (let wIdx = 0; wIdx < 6; wIdx++) {
          m.setU32((pStateFlags + (6 + wIdx) * 4) >>> 0, 0)
        }
      }
    }
    UNIT_FreeEventNotifyList113c(m, uUpd)
    if (m.get(uUpd, D2UnitStrc.dwUnitType) === UNIT_ITEM) {
      SUNIT_ClearItemPerTickCommandFlags_6FD00986_113c(m, uUpd)
    }
  }
  for (const rPtr of world.roomByPtr.keys()) {
    let uUpd = m.u32((rPtr + 0x1c) >>> 0) >>> 0
    while (uUpd !== 0) {
      const nextU = m.u32((uUpd + 0xe0) >>> 0) >>> 0
      clearRoomUnitPerTickState(uUpd)
      uUpd = nextU
    }
    UNITROOM_ClearUpdateQueue113c(m, rPtr)
  }
  if (hasHydratedItemTables113c(m)) {
    GAME_ClearAllActRoomUpdateLists113c(m, pGame)
  }
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    const pActCur = m.u32((pGame + 0xbc + actIdx * 4) >>> 0) >>> 0
    if (pActCur === 0) continue
    m.setU32((pActCur + 0x50) >>> 0, 0)
    let r = m.u32((pActCur + 0x10) >>> 0) >>> 0
    while (r !== 0) {
      let uUpd = m.u32((r + 0x1c) >>> 0) >>> 0
      while (uUpd !== 0) {
        const nextU = m.u32((uUpd + 0xe0) >>> 0) >>> 0
        clearRoomUnitPerTickState(uUpd)
        uUpd = nextU
      }
      UNITROOM_ClearUpdateQueue113c(m, r)
      r = m.u32((r + 0x7c) >>> 0) >>> 0
    }
  }
  if (hasHydratedItemTables113c(m)) {
    ACT_FreeAllActRoomPortalLists113c(m, pGame)
  } else {
    for (let actIdx = 0; actIdx < 5; actIdx++) {
      const pActCur = m.u32((pGame + 0xbc + actIdx * 4) >>> 0) >>> 0
      if (pActCur === 0) continue
      let r = m.u32((pActCur + 0x10) >>> 0) >>> 0
      while (r !== 0) {
        DUNGEON_FreeRoomPortalList113c(m, r)
        r = m.u32((r + 0x7c) >>> 0) >>> 0
      }
    }
  }
  for (const pUnit of world.unitsByKey.values()) {
    const curFlags = m.get(pUnit, D2UnitStrc.dwFlags)
    if ((curFlags & UNITFLAG_PER_TICK_SYNC_MASK) !== 0) {
      const cleared = (curFlags & ~UNITFLAG_PER_TICK_SYNC_MASK) >>> 0
      m.set(pUnit, D2UnitStrc.dwFlags, cleared)
      const pu = world.pathUnitByPtr.get(pUnit)
      if (pu !== undefined) pu.dwFlags = cleared
    }
  }
  if (isFrameS2CTraceActive113c()) {
    drainFrameS2CPackets113c(m, pGame)
  }

  // 0x6FC4E106..0x6FC4E14F: `GAME_DeactivateUnusedRoomsTick` (every 12 frames) + `D2Common.#10025` (every 11 frames)
  let playerOutsideTownAfter = false
  for (const pPlr of world.playerById.values()) {
    const pPlrRoom = UNITS_GetRoom113c(m, pPlr) >>> 0
    if (pPlrRoom !== 0 && DUNGEON_GetLevelIdFromRoom113c(m, pPlrRoom) !== 1) {
      playerOutsideTownAfter = true
      break
    }
  }
  const hasAnyAct =
    (m.u32((pGame + 0xbc) >>> 0) |
      m.u32((pGame + 0xc0) >>> 0) |
      m.u32((pGame + 0xc4) >>> 0) |
      m.u32((pGame + 0xc8) >>> 0) |
      m.u32((pGame + 0xcc) >>> 0)) !== 0
  if ((playerOutsideTownAfter || world.hasFullDrlg === true) && hasAnyAct) {
    if (nextFrame % 12 === 0) {
      GAME_DeactivateUnusedRoomsTick113c(
        m,
        pGame,
        (rPtr) => {
          world.roomByPtr.delete(rPtr >>> 0)
        },
        (pRemoved, uType, uId) => {
          world.unitsByKey.delete(unitKey(uType >>> 0, uId >>> 0))
          if ((uType >>> 0) === UNIT_MONSTER) world.monsterById.delete(uId >>> 0)
          world.pathUnitByPtr.delete(pRemoved >>> 0)
        },
      )
    }
    if (playerOutsideTownAfter && nextFrame % 11 === 0) {
      for (let i = 0; i < 5; i++) {
        const pAct = m.u32((pGame + 0xbc + i * 4) >>> 0) >>> 0
        if (pAct !== 0) {
          DUNGEON_UpdateInactiveLevels113c(m, pAct)
        }
      }
    }
    pruneRemovedUnitsFromWorld113c(world)
  }

  return fired
}

// ---------------------------------------------------------------------------
// End-of-Frame S2C Room & Unit Sync (`0x6FCBDEC0`, `0x6FC9B0A0`, `0x6FD135C0`)
// ---------------------------------------------------------------------------

function emitPlayer0DPacket113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  actionByte: number,
): void {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  const wX = pPath !== 0 ? (PATH_GetPosX113c(m, pPath) & 0xffff) : 0
  const wY = pPath !== 0 ? (PATH_GetPosY113c(m, pPath) & 0xffff) : 0
  const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
  const hitClass = m.u8((pUnit + 0xb0) >>> 0)
  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit) & 0xff
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
  NET_QueuePacketToClient113c(m, pClient, pkt)
}

function buildClientRoomSyncCallees113c(
  world: FallenSliceWorld113c,
  pClient: number,
  pPlr: number,
): BootInitGapBCallees113c {
  const notifyCallees: BootInitGapACallees113c = {
    onNotifyOpcode(mem, opcode, pCl, pUnit, pNode) {
      const uType = mem.get(pUnit, D2UnitStrc.dwUnitType) & 0xff
      const uId = mem.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
      if (opcode === 0xab) {
        S2C_SendPacketAB_UnitHeal113c(
          mem,
          pCl,
          mem.u8((pNode + 0x08) >>> 0),
          mem.u32((pNode + 0x0c) >>> 0) >>> 0,
          mem.u8((pNode + 0x10) >>> 0),
        )
      } else if (opcode === 0x99) {
        const skillId = mem.u16((pNode + 0x08) >>> 0)
        const slvl = mem.u8((pNode + 0x0a) >>> 0)
        const defType = mem.u8((pNode + 0x0b) >>> 0)
        const defId = mem.u32((pNode + 0x0c) >>> 0) >>> 0
        const bItem = mem.u16((pNode + 0x10) >>> 0)
        NET_SendUnitTargetedSkillAction113c(
          mem,
          pCl,
          1,
          uType,
          uId,
          defType,
          defId,
          skillId,
          bItem,
          slvl,
        )
      } else if (opcode === 0x23) {
        const bLeft = mem.u8((pNode + 0x08) >>> 0)
        const skillId = mem.u16((pNode + 0x0a) >>> 0)
        const itemGuid = mem.u32((pNode + 0x0c) >>> 0) >>> 0
        S2C_SendPacket23_SetSkill113c(mem, pCl, uType, uId, bLeft, skillId, itemGuid)
      }
    },
  }

  const monsterSyncCallees: BootInitGapBCallees113c = {
    getSpecialUnit(mem) {
      return pClient !== 0 ? (CLIENTS_GetPlayerUnit113c(mem, pClient, 0) >>> 0) : pPlr
    },
    getMonsterDirection(mem, pUnit) {
      return MONSTER_CalcLifePercentage128_113c(mem, pUnit)
    },
    checkMonsterTargetValid(mem, pTarget) {
      const inRoom = UNITROOM_IsClientInUnitRoom113c(mem, pTarget, pClient)
      if (inRoom !== 0) return 1
      const pTargetRoom = UNITS_GetRoom113c(mem, pTarget)
      return pTargetRoom !== 0 && (mem.u32((pTargetRoom + 0x78) >>> 0) | 0) === 0 ? 1 : 0
    },
    onUnitPreSync(mem, pg, u, pCl) {
      UNIT_SendFullUnitSyncToClient113c(mem, pCl, u, 0, {
        ...notifyCallees,
        onUnitFullSyncPreSwitch(m2, uType, cl2, u2) {
          if (uType === UNIT_MONSTER) {
            D2GAME_PACKET_SendMonsterAssign113c(
              m2,
              u2,
              cl2,
              m2.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0,
            )
          } else if (uType === 2) {
            const pStaticPath = m2.get(u2, D2UnitStrc.pPath) >>> 0
            const objX = pStaticPath !== 0 ? (m2.u32((pStaticPath + 0x0c) >>> 0) & 0xffff) : 0
            const objY = pStaticPath !== 0 ? (m2.u32((pStaticPath + 0x10) >>> 0) & 0xffff) : 0
            const pObjData = m2.get(u2, D2UnitStrc.pUnitData) >>> 0
            const interactType = pObjData !== 0 ? m2.u8((pObjData + 0x04) >>> 0) : 0
            D2GAME_PACKET_Send0x73MissileSync113c(
              m2,
              cl2,
              2,
              m2.get(u2, D2UnitStrc.dwUnitId) >>> 0,
              0x51,
              m2.get(u2, D2UnitStrc.dwClassId) & 0xffff,
              objX,
              objY,
              m2.get(u2, D2UnitStrc.dwAnimMode) & 0xff,
              interactType & 0xff,
            )
          } else if (uType === UNIT_ITEM) {
            const itemMode = m2.get(u2, D2UnitStrc.dwAnimMode) >>> 0
            if (itemMode === 3 || itemMode === 5) {
              S2C_SendPacket9C_ItemActionWorld113c(m2, cl2, u2, 0, 0, 0)
            }
          }
        },
        onUnitFullSyncPostSwitch(m2, uType, cl2, u2) {
          if (uType === UNIT_MONSTER) {
            D2GAME_MONSTER_SendMonsterMovementSync113c(m2, u2, pg, cl2, monsterSyncCallees)
          } else if (uType === UNIT_ITEM) {
            UNITROOM_SendDroppedGroundItemToClient113c(m2, u2, cl2)
          }
        },
      })
    },
    syncPlayerUnitToClient(mem, u, pg, pCl) {
      UNIT_SyncStateAndStatsToClient113c(mem, pg, pCl, u, {
        ...notifyCallees,
        syncPlayerMode(m2, g2, cl2, u2) {
          D2GAME_PLRMODES_DispatchModeSyncToClient113c(m2, u2, g2, cl2, {
            dispatchPlayerModeHandler(m3, modeIdx, g3, u3, cl3) {
              if (modeIdx === 2 || modeIdx === 3 || modeIdx === 6) {
                SPLAYER_BroadcastUnitMovementToClient113c(m3, g3, u3, cl3, modeIdx)
              } else if (modeIdx === 4 || modeIdx === PLRMODE_BLOCK || modeIdx === 13) {
                if (u3 === pPlr) {
                  emitPlayer0DPacket113c(m3, cl3, u3, modeIdx === 4 ? 0x06 : 0x12)
                }
              } else if (
                modeIdx === 7 ||
                modeIdx === 8 ||
                (modeIdx >= 10 && modeIdx <= 16) ||
                modeIdx === 18
              ) {
                C2S_BroadcastPlayerSkillOrAttackAction113c(m3, g3, u3, cl3, 0)
              }
            },
          })
        },
        sendUnitEventSound(m2, cl2, u2) {
          MONSTER_BroadcastEventSoundToClients113c(m2, u2, cl2)
        },
        syncUnitFlag8000(m2, _g2, cl2, u2) {
          SUNITDMG_ApplyArmorDurabilityAndGetHit113c(m2, 0, 0, u2, 0, cl2)
        },
      })
    },
    onMonsterPostSync(mem, u, pCl) {
      UNIT_FlushEventNotifyQueueToClient113c(mem, pCl, u, notifyCallees)
    },
    onMonsterSyncFlag8000(mem, u, pCl) {
      MONSTER_SendPacket0x0C_LifeSync113c(mem, u, pCl)
    },
    onMonsterSyncGfxStates(mem, u, pCl) {
      UNIT_SendGfxStatesBitstreamToClient113c(mem, u, pCl)
    },
    syncObjectUnitToClient(mem, u, pCl) {
      OBJECT_SyncStateAndEventsToClient113c(mem, u, pCl, notifyCallees)
    },
    syncItemUnitToClient(mem, u, pCl) {
      UNITROOM_BroadcastGroundItemIfUpdated113c(mem, u, pCl)
    },
    onMonsterMovementPacket(mem, pCl, op, dwUnitId, nAction, nPosOrTypeX, nPosOrGuidY, a7, a8, a9) {
      const foundMon = world.monsterById.get(dwUnitId >>> 0)
      const pMon = foundMon !== undefined ? foundMon : 0
      const pMonData = pMon !== 0 ? mem.get(pMon, D2UnitStrc.pUnitData) : 0
      const pAiCtrl = pMonData !== 0 ? mem.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
      const hasVelOvList67 =
        pMon !== 0 && STATLIST_GetStatListFromUnitAndFlag113c(mem, pMon, 0x4000) !== 0
      const extraVel =
        !hasVelOvList67 && pAiCtrl !== 0 ? (mem.u32((pAiCtrl + 0x10) >>> 0) | 0) : 0
      if (op === 0x67) {
        const outStep = a8 !== 0 || a9 !== 0 ? (a8 & 0xff) : (a7 & 0xff)
        const maxDistOvr = a8 !== 0 || a9 !== 0 ? (a7 & 0xff) : -1
        D2NET_SendUnitPosSync0x15ToClient113c(
          mem,
          dwUnitId,
          0x67,
          pCl,
          nAction,
          nPosOrTypeX,
          nPosOrGuidY,
          outStep,
          a9,
          extraVel,
          maxDistOvr,
        )
        return
      }
      if (op === 0x68) {
        const stepByte = a8 !== 0 || a9 !== 0 ? (a8 & 0xff) : (a7 & 0xff)
        const maxDistOvr = a8 !== 0 || a9 !== 0 ? (a7 & 0xff) : -1
        S2C_SendPacket0F_UnitWalkToTarget113c(
          mem,
          pCl,
          dwUnitId,
          0x68,
          nAction,
          nPosOrTypeX,
          nPosOrGuidY,
          stepByte,
          extraVel,
          a9,
          maxDistOvr,
        )
        return
      }
      if (op === 0x69) {
        S2C_SendPacket0E_UnitCorpseState113c(
          mem,
          0x69,
          dwUnitId,
          pCl,
          nAction,
          nPosOrTypeX,
          nPosOrGuidY,
          a7,
          a8,
        )
        return
      }
      if (op === 0x6a) {
        const pkt = new Uint8Array(12)
        pkt[0] = 0x6a
        pkt[1] = dwUnitId & 0xff
        pkt[2] = (dwUnitId >>> 8) & 0xff
        pkt[3] = (dwUnitId >>> 16) & 0xff
        pkt[4] = (dwUnitId >>> 24) & 0xff
        pkt[5] = nAction & 0xff
        pkt[6] = nPosOrTypeX & 0xff
        pkt[7] = nPosOrGuidY & 0xff
        pkt[8] = (nPosOrGuidY >>> 8) & 0xff
        pkt[9] = (nPosOrGuidY >>> 16) & 0xff
        pkt[10] = (nPosOrGuidY >>> 24) & 0xff
        pkt[11] = a7 & 0xff
        NET_QueuePacketToClient113c(mem, pCl, pkt)
        return
      }
      if (op === 0x6b) {
        D2NET_SendUnitMovePacket0x10BytesToClient113c(
          mem,
          0x6b,
          dwUnitId,
          pCl,
          nAction,
          nPosOrTypeX,
          nPosOrGuidY,
          a9,
          0,
          a7,
          a8,
        )
        return
      }
      if (op === 0x6c) {
        S2C_SendPacket0D_UnitStop113c(
          mem,
          0x6c,
          dwUnitId,
          pCl,
          nAction,
          nPosOrTypeX,
          nPosOrGuidY,
          a9,
          a7,
          a8,
        )
      }
    },
  }
  return monsterSyncCallees
}

// ---------------------------------------------------------------------------
// Town NPC AI (`0x6FC3DB40`, `0x6FC39C20`, `0x6FC3BBC0`, `0x6FCBCB00`)
// ---------------------------------------------------------------------------

interface NpcWaypoint113c {
  readonly action: number
  readonly x: number
  readonly y: number
}

const SLICE_WORLD_BY_MEM = new WeakMap<Memory113c, FallenSliceWorld113c>()

function writeNpcWaypointsToMem113c(
  m: Memory113c,
  pMonster: number,
  pts: readonly NpcWaypoint113c[],
): void {
  if (pts.length === 0) return
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData) >>> 0
  if (pMonData === 0) return
  const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral) >>> 0
  if (pAiGen === 0) return
  const pMapAi = m.alloc(8 + pts.length * 12) >>> 0
  const pArr = (pMapAi + 8) >>> 0
  m.setU32(pMapAi, pts.length >>> 0)
  m.setU32((pMapAi + 4) >>> 0, pArr)
  for (let i = 0; i < pts.length; i++) {
    const wp = pts[i]!
    const base = (pArr + i * 12) >>> 0
    m.setU32(base, wp.action >>> 0)
    m.setU32((base + 4) >>> 0, wp.x >>> 0)
    m.setU32((base + 8) >>> 0, wp.y >>> 0)
  }
  m.setU32((pAiGen + 0x38) >>> 0, pMapAi)
}

function getTownNpcAiGeneralPtr113c(m: Memory113c, pMonster: number): number {
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData) >>> 0
  return pMonData !== 0 ? (m.get(pMonData, D2MonsterDataStrc.pAiGeneral) >>> 0) : 0
}

export function distApprox113c(x1: number, y1: number, x2: number, y2: number): number {
  const dx = Math.abs((x1 | 0) - (x2 | 0))
  const dy = Math.abs((y1 | 0) - (y2 | 0))
  return dx >= dy ? dx + (dy >> 1) : dy + (dx >> 1)
}

function unitSizeSubtractedOctileDistPure113c(
  m: Memory113c,
  pMonster: number,
  pTarget: number,
): number {
  const a = getUnitPosSubtile113c(m, pMonster)
  const b = getUnitPosSubtile113c(m, pTarget)
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const row = getMonStatsRowByClassId113c(classId)
  const sizeA = row !== undefined ? row.sizeX : 2
  const dx = Math.max(0, Math.abs(a.x - b.x) - sizeA)
  const dy = Math.max(0, Math.abs(a.y - b.y) - sizeA)
  const num = dx > dy ? dy + dx * 2 : dx + dy * 2
  return Math.trunc(num / 2)
}

function startTownNpcWalkToPos113c(
  world: FallenSliceWorld113c,
  pMonster: number,
  targetX: number,
  targetY: number,
  pathType: number,
  stepNum: number,
): number {
  const { m } = world
  const pPath = m.get(pMonster, D2UnitStrc.pPath)
  if (pPath === 0) return 0
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData)
  const pAiCtrl = pMonData !== 0 ? m.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
  if (pAiCtrl !== 0) {
    m.set(pAiCtrl, D2AiControlStrc.dwPathTypeOverride, pathType >>> 0)
    m.set(pAiCtrl, D2AiControlStrc.dwVelocityOverride, 0)
    m.set(pAiCtrl, D2AiControlStrc.bNewDistOverride, 5)
  }
  PATH_SetStepNum113c(m, pPath, stepNum)
  const ok = MONSTER_StartMode113c(world, pMonster, 2, 0, targetX, targetY)
  if (!ok) return 0
  return m.get(pPath, D2DynamicPathStrc.dwPathPoints) | 0
}

// 0x6FC3BBC0
export function AI_FollowDs1NpcPath113c(
  world: FallenSliceWorld113c,
  pMonster: number,
): void {
  const { m, pGame } = world
  const pAiGen = getTownNpcAiGeneralPtr113c(m, pMonster)
  const pMapAi = pAiGen !== 0 ? (m.u32((pAiGen + 0x38) >>> 0) >>> 0) : 0
  const wpCount = pMapAi !== 0 ? (m.u32(pMapAi) | 0) : 0
  const pWpArr = pMapAi !== 0 ? (m.u32((pMapAi + 4) >>> 0) >>> 0) : 0
  if (wpCount <= 0 || pWpArr === 0) {
    AI_Stall113c(world, pMonster, 20)
    return
  }
  if (rollUnitLimited(m, pMonster, 100) >= 66) {
    AI_Stall113c(world, pMonster, 8)
    return
  }
  const wpIdx = rollUnitLimited(m, pMonster, wpCount)
  const pWp = (pWpArr + wpIdx * 12) >>> 0
  const wpAction = m.u32(pWp) | 0
  const wpX = m.u32((pWp + 4) >>> 0) | 0
  const wpY = m.u32((pWp + 8) >>> 0) | 0
  if (wpAction <= 0 || wpAction >= 6) {
    AI_Stall113c(world, pMonster, 8)
    return
  }
  const pos = getUnitPosSubtile113c(m, pMonster)
  const canMove = wpX !== 0 && wpY !== 0 && distApprox113c(pos.x, pos.y, wpX, wpY) > 0
  let pts = 0
  if (canMove) {
    pts = startTownNpcWalkToPos113c(world, pMonster, wpX, wpY, 7, 0)
  }
  if (wpAction === 2 || canMove) {
    const pCmd4 = AIGENERAL_GetOrAllocAiCommandByType113c(m, pGame, pMonster, 4)
    if (pCmd4 !== 0) {
      m.set(pCmd4, D2AiCmdStrc.dwParam1, wpX >>> 0)
      m.set(pCmd4, D2AiCmdStrc.dwParam2, wpY >>> 0)
      m.set(pCmd4, D2AiCmdStrc.dwParam3, wpAction === 2 ? 20 : 12)
      m.set(pCmd4, D2AiCmdStrc.dwParam4, 10)
    }
  }
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0
  const modeFlags = getMonsterModeFlagsPure113c(classId)
  if (canMove && (wpAction === 4 || wpAction === 5)) {
    const pCmd7 = AIGENERAL_GetOrAllocAiCommandByType113c(m, pGame, pMonster, 7)
    if (pCmd7 !== 0) {
      const targetMode =
        wpAction === 4
          ? ((modeFlags & (1 << 8)) !== 0 ? 8 : 1)
          : ((modeFlags & (1 << 9)) !== 0 ? 9 : 1)
      m.set(pCmd7, D2AiCmdStrc.dwParam1, targetMode >>> 0)
      m.set(pCmd7, D2AiCmdStrc.dwParam2, wpX >>> 0)
      m.set(pCmd7, D2AiCmdStrc.dwParam3, wpY >>> 0)
      m.set(pCmd7, D2AiCmdStrc.dwParam4, 4)
    }
  }
  if (pts <= 0) {
    AI_Stall113c(world, pMonster, 8)
  }
}

// 0x6FC39C20
export function AI_WarrivGreet113c(world: FallenSliceWorld113c, pMonster: number): void {
  AI_TownNpc113c(world, pMonster)
}

// 0x6FC3DB40
export function AI_TownNpc113c(world: FallenSliceWorld113c, pMonster: number): void {
  const { m, pGame } = world
  const pAiGen = getTownNpcAiGeneralPtr113c(m, pMonster)
  const pos = getUnitPosSubtile113c(m, pMonster)
  const classId = m.get(pMonster, D2UnitStrc.dwClassId) >>> 0

  EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)

  const pCmdHome = AIGENERAL_FindAiCommandByType113c(m, pMonster, 10)
  if (pCmdHome === 0) {
    const pInitHome = AIGENERAL_GetOrAllocAiCommandByType113c(m, pGame, pMonster, 10)
    if (pInitHome !== 0) {
      m.set(pInitHome, D2AiCmdStrc.dwParam1, pos.x >>> 0)
      m.set(pInitHome, D2AiCmdStrc.dwParam2, pos.y >>> 0)
    }
    AI_Stall113c(world, pMonster, 20)
    return
  }
  const homeX = m.get(pCmdHome, D2AiCmdStrc.dwParam1) | 0
  const homeY = m.get(pCmdHome, D2AiCmdStrc.dwParam2) | 0

  // Warriv greeting & quest alert check in Act 1 Town (`0x6FC54EA0` + `0x6FC39C20`)
  const pRoom = UNITS_GetRoom113c(m, pMonster)
  const levelId = pRoom !== 0 ? DUNGEON_GetLevelIdFromRoom113c(m, pRoom) : 0
  if (classId === 155 && levelId === 1) {
    let nearestPlayer = 0
    let bestDist = 0x7fffffff
    for (const pPlr of world.playerById.values()) {
      if (SUNIT_IsDeadOrDying113c(m, pPlr) !== 0) continue
      const d = unitSizeSubtractedOctileDistPure113c(m, pMonster, pPlr)
      if (d > 15) continue
      if (d < bestDist) {
        bestDist = d
        nearestPlayer = pPlr
      }
    }
    if (nearestPlayer !== 0) {
      const pPlrData = m.get(nearestPlayer, D2UnitStrc.pUnitData) >>> 0
      const pClient = pPlrData !== 0 ? (m.u32((pPlrData + 0x9c) >>> 0) >>> 0) : 0
      if (pClient !== 0) {
        S2C_SendPacket8A_NpcWantsInteract113c(
          m,
          pClient,
          UNIT_MONSTER,
          m.get(pMonster, D2UnitStrc.dwUnitId) >>> 0,
        )
      }
      const dist = bestDist
      if (dist > 2 && dist < 24) {
        if (distApprox113c(pos.x, pos.y, homeX, homeY) > 16) {
          const pCmd4Home = AIGENERAL_GetOrAllocAiCommandByType113c(m, pGame, pMonster, 4)
          if (pCmd4Home !== 0) {
            m.set(pCmd4Home, D2AiCmdStrc.dwParam1, homeX >>> 0)
            m.set(pCmd4Home, D2AiCmdStrc.dwParam2, homeY >>> 0)
            m.set(pCmd4Home, D2AiCmdStrc.dwParam3, 12)
            m.set(pCmd4Home, D2AiCmdStrc.dwParam4, 10)
          }
          AI_Stall113c(world, pMonster, 10)
          return
        }
        const plrPos = getUnitPosSubtile113c(m, nearestPlayer)
        const maxStep = dist >= 5 ? 3 : dist - 2
        const step = Math.min(Math.abs(dist - 2), maxStep)
        const dx = Math.abs(pos.x - plrPos.x)
        const dy = Math.abs(pos.y - plrPos.y)
        const sum = Math.max(dx + dy, step)
        let stepX = sum > 0 ? Math.trunc((dx * step) / sum) : 0
        let stepY = sum > 0 ? Math.trunc((dy * step) / sum) : 0
        while (sum > 0 && stepX + stepY < step) {
          stepX += 1
          stepY += 1
        }
        const dirX = plrPos.x > pos.x ? 1 : plrPos.x < pos.x ? -1 : 0
        const dirY = plrPos.y > pos.y ? 1 : plrPos.y < pos.y ? -1 : 0
        const targetX = pos.x + dirX * stepX
        const targetY = pos.y + dirY * stepY
        const pts = startTownNpcWalkToPos113c(world, pMonster, targetX, targetY, 7, 1)
        if (pts <= 0) {
          AI_Stall113c(world, pMonster, 10)
        }
        return
      }
      AI_Stall113c(world, pMonster, 20)
      return
    }
  }

  // Node 4 waypoint retry loop (`0x6FC36A30`)
  const pCmd4 = AIGENERAL_FindAiCommandByType113c(m, pMonster, 4)
  if (pCmd4 !== 0 && (m.get(pCmd4, D2AiCmdStrc.dwParam3) | 0) > 0) {
    const n4X = m.get(pCmd4, D2AiCmdStrc.dwParam1) | 0
    const n4Y = m.get(pCmd4, D2AiCmdStrc.dwParam2) | 0
    const n4Count = m.get(pCmd4, D2AiCmdStrc.dwParam3) | 0
    const n4Delay = m.get(pCmd4, D2AiCmdStrc.dwParam4) | 0
    if (n4X !== 0 && n4Y !== 0 && distApprox113c(pos.x, pos.y, n4X, n4Y) > 3) {
      const retryCnt = pAiGen !== 0 ? (m.u32((pAiGen + 0x3c) >>> 0) | 0) : 0
      const pathType = (retryCnt & 3) === 0 ? 4 : 7
      if (pAiGen !== 0) {
        m.setU32((pAiGen + 0x3c) >>> 0, ((retryCnt + 1) | 0) >>> 0)
      }
      const pts = startTownNpcWalkToPos113c(world, pMonster, n4X, n4Y, pathType, 0)
      if (pts <= 0) {
        AI_Stall113c(world, pMonster, n4Delay)
      }
    } else {
      AI_Stall113c(world, pMonster, n4Delay)
    }
    m.set(pCmd4, D2AiCmdStrc.dwParam3, ((n4Count - 1) | 0) >>> 0)
    return
  }

  // Node 7 special idle animation check
  const pCmd7 = AIGENERAL_FindAiCommandByType113c(m, pMonster, 7)
  if (pCmd7 !== 0) {
    let n7Mode = m.get(pCmd7, D2AiCmdStrc.dwParam1) | 0
    const n7X = m.get(pCmd7, D2AiCmdStrc.dwParam2) | 0
    const n7Y = m.get(pCmd7, D2AiCmdStrc.dwParam3) | 0
    const n7Ticks = m.get(pCmd7, D2AiCmdStrc.dwParam4) | 0
    if (n7Mode >= 8 && n7Mode <= 11) {
      const dist = distApprox113c(pos.x, pos.y, n7X, n7Y)
      if (dist > 0) {
        if (n7Ticks > 0) {
          const pts = startTownNpcWalkToPos113c(world, pMonster, n7X, n7Y, 7, 0)
          if (pts <= 0) {
            AI_Stall113c(world, pMonster, 25)
          }
          m.set(pCmd7, D2AiCmdStrc.dwParam4, ((n7Ticks - 1) | 0) >>> 0)
          return
        }
        if (dist > 1) {
          n7Mode = 0
          m.set(pCmd7, D2AiCmdStrc.dwParam1, 0)
        }
      }
      if (n7Mode !== 0) {
        const skillMode = n7Mode
        m.set(pCmd7, D2AiCmdStrc.dwParam1, 0)
        m.set(pCmd7, D2AiCmdStrc.dwParam2, pos.x >>> 0)
        m.set(pCmd7, D2AiCmdStrc.dwParam3, pos.y >>> 0)
        m.set(pCmd7, D2AiCmdStrc.dwParam4, 0)
        MONSTER_StartMode113c(world, pMonster, skillMode, 0, 0, 0)
        return
      }
    }
  }

  AI_FollowDs1NpcPath113c(world, pMonster)
}

// 0x6FCBCB00
export function AI_RogueTown113c(world: FallenSliceWorld113c, pMonster: number): void {
  const { m, pGame } = world
  EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
  AI_Stall113c(world, pMonster, 15)
}

function findRoomAtSubtileOrigin113c(
  world: FallenSliceWorld113c,
  subX: number,
  subY: number,
): MutablePathRoom113c | undefined {
  for (const r of world.roomByPtr.values()) {
    if (r.subX === subX && r.subY === subY) return r
  }
  return undefined
}

function rebuildRoomAdjacency113c(world: FallenSliceWorld113c): void {
  const { m } = world
  const rooms = [...world.roomByPtr.values()]
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!
    const nearPtrs: number[] = []
    const adjObjs: MutablePathRoom113c[] = []
    for (let j = 0; j < rooms.length; j++) {
      const other = rooms[j]!
      if (Math.abs(other.subX - r.subX) <= 40 && Math.abs(other.subY - r.subY) <= 40) {
        nearPtrs.push(other.ptr)
        if (other.ptr !== r.ptr) adjObjs.push(other)
      }
    }
    r.adjacentRooms = adjObjs
    const ppNear = m.alloc(nearPtrs.length * 4)
    for (let k = 0; k < nearPtrs.length; k++) {
      m.setU32((ppNear + k * 4) >>> 0, nearPtrs[k]! >>> 0)
    }
    m.set(r.ptr, D2ActiveRoomStrc.ppRoomsNear, ppNear >>> 0)
    m.set(r.ptr, D2ActiveRoomStrc.nRoomsNear, nearPtrs.length >>> 0)
  }
}

/**
 * K0 slice stand-in (NOT a DLL port, no `@va` claim): synthesises the Rogue Encampment rooms around
 * the player from the hard-coded `townN1` DS1 presets and spawns their preset NPCs. The real
 * per-frame act room loop is `D2Game:0x6FC4CBE0` (`GAME_UpdateActRooms113c` in
 * `game/act-rooms-113c.ts`), which needs D2Common room activation of DRLG-generated `D2RoomExStrc`s
 * that the F2 boot snapshot does not contain; this stand-in is kept only until that path is wired.
 */
export function SLICE_StreamTownRoomWindow113c(
  world: FallenSliceWorld113c,
  pPlayer: number,
): void {
  const { m, pGame } = world
  const pCurRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pCurRoom === 0) return
  const lvlId = DUNGEON_GetLevelIdFromRoom113c(m, pCurRoom)
  if (lvlId !== 1) return

  const curSubX = m.get(pCurRoom, D2ActiveRoomStrc.nSubtileX) | 0
  const curSubY = m.get(pCurRoom, D2ActiveRoomStrc.nSubtileY) | 0
  const curRoomEx = m.get(pCurRoom, D2ActiveRoomStrc.pRoomEx) >>> 0
  const pLevel = curRoomEx !== 0 ? m.u32((curRoomEx + 0x58) >>> 0) : 0
  const exFlags = curRoomEx !== 0 ? m.get(curRoomEx, D2RoomExStrc.dwFlags) >>> 0 : 0

  const townPresets = ACT1_TOWN_DS1_PRESETS_113C['townN1']
  if (townPresets === undefined) return
  const townOriginX = 5520
  const townOriginY = 5880

  const dummyGrid: SlicePathCollisionGrid113c = {
    get: () => COLLIDE_MASK_INVALID_113C,
    set: () => {},
  }

  const newlyCreated: MutablePathRoom113c[] = []
  for (let dy = -40; dy <= 40; dy += 40) {
    const ry = curSubY + dy
    if (ry < 5880 || ry >= 6000) continue
    for (let dx = 40; dx >= -40; dx -= 40) {
      const rx = curSubX + dx
      if (rx < 5520 || rx >= 5720) continue
      if (findRoomAtSubtileOrigin113c(world, rx, ry) !== undefined) continue

      const rPtr = m.alloc(0x80)
      const pRoomEx = m.alloc(0x100)
      m.set(rPtr, D2ActiveRoomStrc.pRoomEx, pRoomEx >>> 0)
      m.set(rPtr, D2ActiveRoomStrc.nSubtileX, rx >>> 0)
      m.set(rPtr, D2ActiveRoomStrc.nSubtileY, ry >>> 0)
      m.set(rPtr, D2ActiveRoomStrc.nSubtileWidth, 40)
      m.set(rPtr, D2ActiveRoomStrc.nSubtileHeight, 40)
      m.set(rPtr, D2ActiveRoomStrc.dwFlags, 3)
      m.set(pRoomEx, D2RoomExStrc.dwFlags, exFlags)
      m.setU32((pRoomEx + 0x58) >>> 0, pLevel >>> 0)
      bindRoomCollisionGrid113c(m, rPtr, rx, ry, 40, 40, () => 0)

      const roomObj: MutablePathRoom113c = {
        ptr: rPtr,
        subX: rx,
        subY: ry,
        subW: 40,
        subH: 40,
        isTown: true,
        adjacentRooms: [],
        grid: dummyGrid,
      }
      world.roomByPtr.set(rPtr, roomObj)
      newlyCreated.push(roomObj)
    }
  }

  if (newlyCreated.length === 0) return
  rebuildRoomAdjacency113c(world)

  let nextMonId = 0
  for (const id of world.monsterById.keys()) {
    if (id > nextMonId) nextMonId = id
  }
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0

  for (let rIdx = 0; rIdx < newlyCreated.length; rIdx++) {
    const rm = newlyCreated[rIdx]!
    const rx = rm.subX
    const ry = rm.subY
    const rPtr = rm.ptr
    for (let pIdx = townPresets.length - 1; pIdx >= 0; pIdx--) {
      const pr = townPresets[pIdx]!
      const wx = townOriginX + pr.x
      const wy = townOriginY + pr.y
      if (wx < rx || wx >= rx + 40 || wy < ry || wy >= ry + 40) continue

      const gameSeed: D2SeedStrc = {
        lo: m.get(pGame, D2GameStrc.seedLo) >>> 0,
        hi: m.get(pGame, D2GameStrc.seedHi) >>> 0,
      }
      seedNext(gameSeed)
      m.set(pGame, D2GameStrc.seedLo, gameSeed.lo >>> 0)
      m.set(pGame, D2GameStrc.seedHi, gameSeed.hi >>> 0)
      const seedDraw = gameSeed
      if (pr.uType === 2) {
        const objRow = OBJECT_TXT_EXACT_113C[pr.txtId]
        if (objRow !== undefined && (objRow[2] & 1) !== 0 && objRow[0] > 0 && objRow[1] > 0) {
          COLLISION_SetMaskWithSizeXY113c(m, rPtr, wx, wy, objRow[0], objRow[1], 0x3c09)
        }
        continue
      }
      if (pr.uType !== 1 || pr.txtId === 149) {
        continue
      }

      nextMonId += 1
      const monId = nextMonId >>> 0
      const classId = pr.txtId >>> 0
      const pMon = m.alloc(0xf4)
      const pMonData = m.alloc(0x60)
      const pAiGen = m.alloc(0x40)
      const pAiCtrl = m.alloc(0x28)
      const pPath = m.alloc(0x200)

      m.set(pMon, D2UnitStrc.dwUnitType, UNIT_MONSTER)
      m.set(pMon, D2UnitStrc.dwClassId, classId)
      m.set(pMon, D2UnitStrc.dwUnitId, monId)
      m.set(pMon, D2UnitStrc.dwAnimMode, pr.mode >>> 0)
      m.set(pMon, D2UnitStrc.pUnitData, pMonData >>> 0)
      m.set(pMon, D2UnitStrc.pPath, pPath >>> 0)
      m.set(pMon, D2UnitStrc.pGame, pGame >>> 0)

      const pTemplateMon = world.monsterById.get(3)
      if (pTemplateMon !== undefined) {
        m.set(pMon, D2UnitStrc.pStatListEx, m.get(pTemplateMon, D2UnitStrc.pStatListEx) >>> 0)
      }

      const pTxt = getMonStatsTxtPtrPure113c(m, classId)
      m.set(pMonData, D2MonsterDataStrc.pMonStatsTxt, pTxt >>> 0)
      m.set(pMonData, D2MonsterDataStrc.pAiGeneral, pAiGen >>> 0)
      m.set(pMonData, D2MonsterDataStrc.pAiControl, pAiCtrl >>> 0)
      m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_ZOMBIE_113C)

      const uSeed: D2SeedStrc = { lo: seedDraw.lo >>> 0, hi: 0x29a }
      seedNext(uSeed)
      seedNext(uSeed)
      UNITS_SetSeed113c(m, pMon, uSeed.lo, uSeed.hi)

      const row = getMonStatsRow113c(m, pMon)
      const nuFrames = getMonsterModeBaseFrameCountPure113c(row.hcIdx, pr.mode)
      writeUnitAnimState113c(m, pMon, 0, 0, nuFrames << 8, 256, 0)

      m.set(pPath, D2DynamicPathStrc.wOffsetX, 0x8000)
      m.set(pPath, D2DynamicPathStrc.wPosX, wx & 0xffff)
      m.set(pPath, D2DynamicPathStrc.wOffsetY, 0x8000)
      m.set(pPath, D2DynamicPathStrc.wPosY, wy & 0xffff)
      m.set(pPath, D2DynamicPathStrc.wTargetX, wx & 0xffff)
      m.set(pPath, D2DynamicPathStrc.wTargetY, wy & 0xffff)
      m.set(pPath, D2DynamicPathStrc.pRoom, rPtr >>> 0)
      m.set(pPath, D2DynamicPathStrc.pUnit, pMon >>> 0)
      m.setU32((pPath + 0x38) >>> 0, 0x0f)
      m.set(pPath, D2DynamicPathStrc.dwPathType, 2)
      m.set(pPath, D2DynamicPathStrc.dwUnitSize, row.sizeX >>> 0)
      m.set(pPath, D2DynamicPathStrc.dwCollisionPattern, classId === 152 ? 3 : 1)
      m.set(pPath, D2DynamicPathStrc.nFootprintCollisionMask, 0x100)
      m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, 0x3c01)
      m.set(pPath, D2DynamicPathStrc.dwVelocity, (row.velocity << 8) >>> 0)
      m.set(pPath, D2DynamicPathStrc.dwMaxVelocity, (row.velocity << 8) >>> 0)
      m.set(pPath, D2DynamicPathStrc.nDistMax, 0x0e)
      m.setU32((pPath + 0x94) >>> 0, 0x14)
      m.set(pPath, D2DynamicPathStrc.nStepNum, 0)

      COLLISION_SetMaskWithPattern113c(m, rPtr, wx, wy, classId === 152 ? 3 : 1, 0x100)

      const bucketAddr = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_MONSTER]! + ((monId & 0x7f) << 2)) >>> 0
      const oldHead = m.u32(bucketAddr) >>> 0
      m.set(pMon, D2UnitStrc.pGameHashNext, oldHead)
      m.setU32(bucketAddr, pMon >>> 0)

      world.unitsByKey.set(unitKey(UNIT_MONSTER, monId), pMon)
      world.monsterById.set(monId, pMon)
      world.pathUnitByPtr.set(pMon, {
        pUnit: pMon,
        pPath,
        dwUnitType: UNIT_MONSTER,
        dwClassId: classId,
        dwUnitId: monId,
        dwAnimMode: pr.mode >>> 0,
        dwFlags: 0,
        dwFlagEx: 0,
      })

      if (pr.mapAi !== null) {
        const pts: NpcWaypoint113c[] = []
        for (let k = 0; k < pr.mapAi.length; k++) {
          const entry = pr.mapAi[k]!
          pts.push({
            action: entry[0],
            x: townOriginX + entry[1],
            y: townOriginY + entry[2],
          })
        }
        writeNpcWaypointsToMem113c(m, pMon, pts)
      }

      if (classId === 147 || classId === 148 || classId === 150 || classId === 154 || classId === 155 || classId === 152) {
        EVENT_SetEventFull113c(m, pGame, pMon, MON_EVENT_AI_THINK, (frame + 2) >>> 0, 0, 0, 0)
      }
    }
  }
}

/**
 * K0 slice stand-in (NOT a DLL port, no `@va` claim): runs `SLICE_StreamTownRoomWindow113c` for every
 * player. `D2Game:0x6FC6B400` (previously mislabelled here) is the per-client room-change handler
 * (`0x6FC6AD10` / `0x6FCBD780` / `0x6FCBDEC0` / `0x6FC6B1D0`), not an all-rooms update.
 */
export function SLICE_UpdateAllRooms113c(world: FallenSliceWorld113c): void {
  for (const pPlayer of world.playerById.values()) {
    SLICE_StreamTownRoomWindow113c(world, pPlayer)
  }
}

// ---------------------------------------------------------------------------
// Snapshot Hydration & Replay Kernel Entrypoints (`0x6FC4E050`, `0x6FCEC550`)
// ---------------------------------------------------------------------------

export interface ReplayHydrationAssets113c {
  readonly drlgDataTblsImg: Uint8Array
  readonly d2gameDataTblsImg: Uint8Array
  readonly animDataBytes: Uint8Array
  readonly act1Ds1Dt1: {
    readonly ds1: Map<string, Uint8Array>
    readonly dt1: Map<string, Uint8Array>
  }
}

let cachedReplayHydrationAssets113c: ReplayHydrationAssets113c | null = null

export function configureReplayHydrationAssets113c(assets: ReplayHydrationAssets113c): void {
  cachedReplayHydrationAssets113c = assets
}

function requireReplayHydrationAssets113c(): ReplayHydrationAssets113c {
  if (cachedReplayHydrationAssets113c === null) {
    throw new Error('Replay hydration assets not configured; call configureReplayHydrationAssets113c first')
  }
  return cachedReplayHydrationAssets113c
}

function getAnimDataBytes113c(): Uint8Array {
  return requireReplayHydrationAssets113c().animDataBytes
}

function getDrlgDataTblsImg113c(): Uint8Array {
  return requireReplayHydrationAssets113c().drlgDataTblsImg
}

function getD2GameDataTblsImg113c(): Uint8Array {
  return requireReplayHydrationAssets113c().d2gameDataTblsImg
}

function getDrlgAct1Ds1Dt1Bundle113c(): {
  ds1: Map<string, Uint8Array>
  dt1: Map<string, Uint8Array>
} {
  return requireReplayHydrationAssets113c().act1Ds1Dt1
}

function createLiveRoomCollisionGrid113c(
  m: Memory113c,
  rPtr: number,
): SlicePathCollisionGrid113c {
  return {
    get(x: number, y: number): number {
      const pColl = m.u32((rPtr + 0x20) >>> 0) >>> 0
      if (pColl === 0) return COLLIDE_MASK_INVALID_113C
      const x0 = m.u32(pColl) | 0
      const y0 = m.u32((pColl + 0x04) >>> 0) | 0
      const w = m.u32((pColl + 0x08) >>> 0) | 0
      const h = m.u32((pColl + 0x0c) >>> 0) | 0
      const lx = (x | 0) - x0
      const ly = (y | 0) - y0
      if (lx < 0 || ly < 0 || lx >= w || ly >= h) return COLLIDE_MASK_INVALID_113C
      const pMask = m.u32((pColl + 0x20) >>> 0) >>> 0
      if (pMask === 0) return COLLIDE_MASK_INVALID_113C
      return m.u16((pMask + (ly * w + lx) * 2) >>> 0)
    },
    set(x: number, y: number, mask: number): void {
      const pColl = m.u32((rPtr + 0x20) >>> 0) >>> 0
      if (pColl === 0) return
      const x0 = m.u32(pColl) | 0
      const y0 = m.u32((pColl + 0x04) >>> 0) | 0
      const w = m.u32((pColl + 0x08) >>> 0) | 0
      const h = m.u32((pColl + 0x0c) >>> 0) | 0
      const lx = (x | 0) - x0
      const ly = (y | 0) - y0
      if (lx < 0 || ly < 0 || lx >= w || ly >= h) return
      const pMask = m.u32((pColl + 0x20) >>> 0) >>> 0
      if (pMask === 0) return
      m.setU16((pMask + (ly * w + lx) * 2) >>> 0, mask & 0xffff)
    },
  }
}

export function ensureDrlgActTablesHydrated113c(m: Memory113c, pGame: number): boolean {
  const synthSgpt = m.u32(0x6fde9e1c) >>> 0
  const synthMonStats = synthSgpt !== 0 ? m.u32((synthSgpt + 0xa78) >>> 0) >>> 0 : 0
  const synthMonStatsCount = synthSgpt !== 0 ? m.u32((synthSgpt + 0xa80) >>> 0) | 0 : 0
  const synthMonStats2 = synthSgpt !== 0 ? m.u32((synthSgpt + 0xa90) >>> 0) >>> 0 : 0
  const synthMonStats2Count = synthSgpt !== 0 ? m.u32((synthSgpt + 0xa98) >>> 0) | 0 : 0

  const memInternal = m as unknown as {
    pages: Map<number, Uint8Array>
    known: Map<number, Uint8Array>
    allocTop: number
  }
  for (const img of [getDrlgDataTblsImg113c(), getD2GameDataTblsImg113c()]) {
    const dv = new DataView(img.buffer, img.byteOffset, img.byteLength)
    const recordCount = dv.getUint32(0x14, true)
    let off = 32
    for (let i = 0; i < recordCount; i++) {
      const va = dv.getUint32(off, true) >>> 0
      const pageIdx = va >>> 12
      const page = new Uint8Array(4096)
      page.set(img.subarray(off + 4, off + 4 + 4096))
      const k = new Uint8Array(4096)
      k.fill(1)
      memInternal.pages.set(pageIdx, page)
      memInternal.known.set(pageIdx, k)
      off += 4100
    }
  }

  const realSgpt = m.u32(0x6fde9e1c) >>> 0
  initD2GameGlobalsInMem113c(m, realSgpt)
  if (realSgpt !== 0 && synthMonStats !== 0) {
    const realMonStats = m.u32((realSgpt + 0xa78) >>> 0) >>> 0
    for (let i = 0; i < synthMonStatsCount; i++) {
      const recReal = (realMonStats + i * 0x1a8) >>> 0
      const recSynth = (synthMonStats + i * 0x1a8) >>> 0
      const k0 = memInternal.known.get(recReal >>> 12)
      const k1 = memInternal.known.get((recReal + 0x1a7) >>> 12)
      if (
        k0 === undefined ||
        k0[recReal & 0xfff] === 0 ||
        k1 === undefined ||
        k1[(recReal + 0x1a7) & 0xfff] === 0
      ) {
        for (let b = 0; b < 0x1a8; b++) {
          const addr = (recReal + b) >>> 0
          const kp = memInternal.known.get(addr >>> 12)
          if (kp === undefined || kp[addr & 0xfff] === 0) {
            m.setU8(addr, m.u8((recSynth + b) >>> 0))
          }
        }
      }
    }
  }
  if (realSgpt !== 0 && synthMonStats2 !== 0) {
    const realMonStats2 = m.u32((realSgpt + 0xa90) >>> 0) >>> 0
    for (let i = 0; i < synthMonStats2Count; i++) {
      const recReal = (realMonStats2 + i * 0x134) >>> 0
      const recSynth = (synthMonStats2 + i * 0x134) >>> 0
      const k0 = memInternal.known.get(recReal >>> 12)
      const k1 = memInternal.known.get((recReal + 0x133) >>> 12)
      if (
        k0 === undefined ||
        k0[recReal & 0xfff] === 0 ||
        k1 === undefined ||
        k1[(recReal + 0x133) & 0xfff] === 0
      ) {
        for (let b = 0; b < 0x134; b++) {
          const addr = (recReal + b) >>> 0
          const kp = memInternal.known.get(addr >>> 12)
          if (kp === undefined || kp[addr & 0xfff] === 0) {
            m.setU8(addr, m.u8((recSynth + b) >>> 0))
          }
        }
      }
    }
  }

  m.setU32(0x6fdd91fc, 0x00010000)
  const bitMasksVa = 0x6fde0000
  const invBitMasksVa = 0x6fde0080
  m.setU32(0x6fdd90b0, bitMasksVa)
  m.setU32(0x6fdd9078, invBitMasksVa)
  m.setU32(0x6fd19574, 0x6fde9e1c)
  m.setU32(0x6fd19584, bitMasksVa)
  for (let i = 0; i < 32; i++) {
    const mask = (1 << i) >>> 0
    m.setU32((bitMasksVa + i * 4) >>> 0, mask)
    m.setU32((invBitMasksVa + i * 4) >>> 0, (~mask) >>> 0)
  }
  initD2GameGlobalsInMem113c(m, m.u32(0x6fde9e1c) >>> 0)

  const bundle = getDrlgAct1Ds1Dt1Bundle113c()
  let dt1HeapCursor = 0x30000000
  const dt1Alloc = (size: number): number => {
    const aligned = (size + 7) & ~7
    const ptr = dt1HeapCursor >>> 0
    dt1HeapCursor = (dt1HeapCursor + aligned) >>> 0
    m.fill(ptr, aligned, 0)
    return ptr
  }

  // Hydrate `0x6FDF0B4C` (`D2AnimDataTableStrc*`) from `AnimData.d2` (`tests/fixtures/oracle/k1/animdata-113c.bin.gz`)
  const animBytes = getAnimDataBytes113c()
  const pAnimTbl = dt1Alloc(0x420)
  const pAnimFile = dt1Alloc(animBytes.length)
  for (let i = 0; i < animBytes.length; i++) {
    m.setU8((pAnimFile + i) >>> 0, animBytes[i]!)
  }
  m.setU32(pAnimTbl, pAnimFile)
  const animDv = new DataView(animBytes.buffer, animBytes.byteOffset, animBytes.byteLength)
  let animOff = 0
  for (let b = 0; b < 256; b++) {
    m.setU32((pAnimTbl + 4 + b * 4) >>> 0, (pAnimFile + animOff) >>> 0)
    const cnt = animDv.getUint32(animOff, true)
    animOff += 4 + cnt * 160
  }
  m.setU32((pAnimTbl + 1036) >>> 0, 8)
  m.setU32((pAnimTbl + 1040) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimTbl)
  const dt1HashByKey = new Map<string, number>()
  const gHooks = globalThis as unknown as {
    __d2LoadMpqDs1?: (mem: Memory113c, pathStr: string) => Uint8Array | null
    __d2LoadMpqDt1Hash?: (mem: Memory113c, pathStr: string) => number
  }
  gHooks.__d2LoadMpqDs1 = (_mem: Memory113c, pathStr: string): Uint8Array | null => {
    const key = pathStr.replace(/\//g, '\\').toLowerCase()
    const foundDs1 = bundle.ds1.get(key)
    return foundDs1 !== undefined ? foundDs1 : null
  }
  gHooks.__d2LoadMpqDt1Hash = (mem: Memory113c, pathStr: string): number => {
    const normPath = pathStr.replace(/\//g, '\\')
    const key = normPath.toLowerCase()
    const cached = dt1HashByKey.get(key)
    if (cached !== undefined) return cached
    const bytes = bundle.dt1.get(key)
    if (bytes === undefined) return 0
    const bdv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const nTiles = bdv.getInt32(0x10c, true)
    const hdrOff = bdv.getUint32(0x110, true)
    if (nTiles < 0 || hdrOff < 0x114 || hdrOff > bytes.length) return 0
    const hdrBytes = hdrOff + nTiles * 0x60
    const pLib = dt1Alloc(hdrBytes)
    const copyLen = Math.min(bytes.length, hdrBytes)
    for (let i = 0; i < copyLen; i++) mem.setU8(pLib + i, bytes[i]!)
    for (let i = 0; i < normPath.length && i < 259; i++) {
      mem.setU8(pLib + 0x08 + i, normPath.charCodeAt(i) & 0xff)
    }
    mem.setU8(pLib + 0x08 + Math.min(normPath.length, 259), 0)
    const pTilesBase = (pLib + hdrOff) >>> 0
    mem.setU32(pLib + 0x110, pTilesBase)
    for (let i = 0; i < nTiles; i++) {
      const pTile = (pTilesBase + i * 0x60) >>> 0
      mem.setU32(pTile + 0x58, (pLib + 0x08) >>> 0)
    }
    const pHash = dt1Alloc(0x200)
    for (let i = 0; i < nTiles; i++) {
      const pTile = (pTilesBase + i * 0x60) >>> 0
      const orient = mem.u32(pTile + 0x14) | 0
      const style = mem.u32(pTile + 0x18) | 0
      const seq = mem.u32(pTile + 0x1c) | 0
      const bucket = ((((seq & 0xff) << 1) - (orient & 0xff) + (style & 0xff)) & 0x7f) >>> 0
      const bucketAddr = (pHash + bucket * 4) >>> 0
      let pNode = mem.u32(bucketAddr)
      let foundNode = 0
      while (pNode !== 0) {
        if (
          (mem.u32(pNode) | 0) === style &&
          (mem.u32(pNode + 0x04) | 0) === seq &&
          (mem.u32(pNode + 0x08) | 0) === orient
        ) {
          foundNode = pNode
          break
        }
        pNode = mem.u32(pNode + 0x10)
      }
      if (foundNode === 0) {
        const pNewNode = dt1Alloc(0x14)
        mem.setU32(pNewNode + 0x00, style >>> 0)
        mem.setU32(pNewNode + 0x04, seq >>> 0)
        mem.setU32(pNewNode + 0x08, orient >>> 0)
        mem.setU32(pNewNode + 0x10, mem.u32(bucketAddr))
        mem.setU32(bucketAddr, pNewNode)
        const pBlock = dt1Alloc(0x08)
        mem.setU32(pBlock + 0x00, pTile)
        mem.setU32(pBlock + 0x04, 0)
        mem.setU32(pNewNode + 0x0c, pBlock)
      } else {
        let pCurBlock = mem.u32(foundNode + 0x0c)
        let dup = false
        while (pCurBlock !== 0) {
          if (mem.u32(pCurBlock) === pTile) {
            dup = true
            break
          }
          pCurBlock = mem.u32(pCurBlock + 0x04)
        }
        if (!dup) {
          const pBlock = dt1Alloc(0x08)
          mem.setU32(pBlock + 0x00, pTile)
          mem.setU32(pBlock + 0x04, mem.u32(foundNode + 0x0c))
          mem.setU32(foundNode + 0x0c, pBlock)
        }
      }
    }
    dt1HashByKey.set(key, pHash)
    return pHash
  }

  const ACT_TOWN_LEVELS = [1, 40, 75, 103, 109] as const
  let activeActIdx = -1
  let pSnapAct = 0
  let pSnapDrlg = 0
  for (let a = 0; a < 5; a++) {
    const candAct = m.u32((pGame + 0xbc + a * 4) >>> 0) >>> 0
    if (candAct === 0) continue
    const candDrlg = m.u32((candAct + 0x48) >>> 0) >>> 0
    if (candDrlg !== 0) {
      activeActIdx = a
      pSnapAct = candAct
      pSnapDrlg = candDrlg
      break
    }
  }
  if (activeActIdx < 0 || pSnapAct === 0 || pSnapDrlg === 0) return false
  const townLvlId = ACT_TOWN_LEVELS[activeActIdx]!

  const snapLevelsById = new Map<number, number>()
  const snapRoomExByKey = new Map<string, number>()
  let pSnapLvl = m.u32((pSnapDrlg + 0x47c) >>> 0) >>> 0
  while (pSnapLvl !== 0) {
    const lvlId = m.u32((pSnapLvl + 0x1d0) >>> 0) | 0
    snapLevelsById.set(lvlId, pSnapLvl)
    let pSnapRx = m.u32((pSnapLvl + 0x10) >>> 0) >>> 0
    while (pSnapRx !== 0) {
      const tx = m.u32((pSnapRx + 0x34) >>> 0) | 0
      const ty = m.u32((pSnapRx + 0x38) >>> 0) | 0
      snapRoomExByKey.set(`${lvlId}:${tx}:${ty}`, pSnapRx)
      pSnapRx = m.u32((pSnapRx + 0x24) >>> 0) >>> 0
    }
    pSnapLvl = m.u32((pSnapLvl + 0x1ac) >>> 0) >>> 0
  }
  if (activeActIdx === 0 ? !snapLevelsById.has(2) : !snapLevelsById.has(townLvlId)) return false

  const snapRoom1ByKey = new Map<string, number>()
  let pSnapR1 = m.u32((pSnapAct + 0x10) >>> 0) >>> 0
  while (pSnapR1 !== 0) {
    const sx = m.u32((pSnapR1 + 0x4c) >>> 0) | 0
    const sy = m.u32((pSnapR1 + 0x50) >>> 0) | 0
    snapRoom1ByKey.set(`${sx}:${sy}`, pSnapR1)
    pSnapR1 = m.u32((pSnapR1 + 0x7c) >>> 0) >>> 0
  }

  let startTileX = 1128
  let startTileY = 1176
  const pClientInit = m.u32((pGame + 0x88) >>> 0) >>> 0
  if (pClientInit !== 0) {
    const pClientRoom = m.u32((pClientInit + 0x1b4) >>> 0) >>> 0
    if (pClientRoom !== 0 && DUNGEON_GetLevelIdFromRoom113c(m, pClientRoom) === townLvlId) {
      startTileX = Math.trunc((m.u32((pClientRoom + 0x4c) >>> 0) | 0) / 5)
      startTileY = Math.trunc((m.u32((pClientRoom + 0x50) >>> 0) | 0) / 5)
    }
  }

  const allocStart = memInternal.allocTop >>> 0
  const initSeed = m.u32((pSnapAct + 0x0c) >>> 0) >>> 0
  const pSimAct = DUNGEON_AllocAct113c(m, activeActIdx, initSeed, 0, pGame, 0, 0, townLvlId, 0, 0) >>> 0
  m.setU32((pGame + 0xbc + activeActIdx * 4) >>> 0, pSnapAct)
  const pSimDrlg = m.u32((pSimAct + 0x48) >>> 0) >>> 0

  let pStartSimRx = 0
  let pSimLvlIter = m.u32((pSimDrlg + 0x47c) >>> 0) >>> 0
  while (pSimLvlIter !== 0) {
    if ((m.u32((pSimLvlIter + 0x1d0) >>> 0) | 0) === townLvlId) {
      let rx = m.u32((pSimLvlIter + 0x10) >>> 0) >>> 0
      while (rx !== 0) {
        if (
          (m.u32((rx + 0x34) >>> 0) | 0) === startTileX &&
          (m.u32((rx + 0x38) >>> 0) | 0) === startTileY
        ) {
          pStartSimRx = rx
          break
        }
        rx = m.u32((rx + 0x24) >>> 0) >>> 0
      }
      break
    }
    pSimLvlIter = m.u32((pSimLvlIter + 0x1ac) >>> 0) >>> 0
  }
  if (pStartSimRx !== 0) {
    const pStartSimR1 = DRLGROOM_EnsureRoomAndGetRoom1_113c(m, pStartSimRx) >>> 0
    DUNGEON_SyncActiveRoomStatusChange113c(m, 0, pStartSimR1)
  }
  const allocEnd = memInternal.allocTop >>> 0

  const intervals: Array<{ start: number; size: number; dst: number }> = [
    { start: pSimAct, size: 0x60, dst: pSnapAct },
    { start: pSimDrlg, size: 0x48c, dst: pSnapDrlg },
  ]
  const levelPairs: Array<[number, number]> = []
  const roomExPairs: Array<[number, number]> = []
  const room1Pairs: Array<[number, number]> = []

  pSimLvlIter = m.u32((pSimDrlg + 0x47c) >>> 0) >>> 0
  while (pSimLvlIter !== 0) {
    const lvlId = m.u32((pSimLvlIter + 0x1d0) >>> 0) | 0
    const dstLvl = snapLevelsById.get(lvlId)
    if (dstLvl !== undefined) {
      intervals.push({ start: pSimLvlIter, size: 0x230, dst: dstLvl })
      levelPairs.push([pSimLvlIter, dstLvl])
    }
    let pSimRx = m.u32((pSimLvlIter + 0x10) >>> 0) >>> 0
    while (pSimRx !== 0) {
      const tx = m.u32((pSimRx + 0x34) >>> 0) | 0
      const ty = m.u32((pSimRx + 0x38) >>> 0) | 0
      const dstRx = snapRoomExByKey.get(`${lvlId}:${tx}:${ty}`)
      if (dstRx !== undefined) {
        intervals.push({ start: pSimRx, size: 0xec, dst: dstRx })
        roomExPairs.push([pSimRx, dstRx])
      }
      pSimRx = m.u32((pSimRx + 0x24) >>> 0) >>> 0
    }
    pSimLvlIter = m.u32((pSimLvlIter + 0x1ac) >>> 0) >>> 0
  }

  let pSimR1Iter = m.u32((pSimAct + 0x10) >>> 0) >>> 0
  while (pSimR1Iter !== 0) {
    const sx = m.u32((pSimR1Iter + 0x4c) >>> 0) | 0
    const sy = m.u32((pSimR1Iter + 0x50) >>> 0) | 0
    const dstR1 = snapRoom1ByKey.get(`${sx}:${sy}`)
    if (dstR1 !== undefined) {
      intervals.push({ start: pSimR1Iter, size: 0x80, dst: dstR1 })
      room1Pairs.push([pSimR1Iter, dstR1])
    }
    pSimR1Iter = m.u32((pSimR1Iter + 0x7c) >>> 0) >>> 0
  }

  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i]!
    let j = i - 1
    while (j >= 0 && intervals[j]!.start > cur.start) {
      intervals[j + 1] = intervals[j]!
      j--
    }
    intervals[j + 1] = cur
  }
  for (let addr = allocStart; addr < allocEnd; addr = (addr + 4) >>> 0) {
    const kPage = memInternal.known.get(addr >>> 12)
    if (
      kPage === undefined ||
      kPage[addr & 0xfff] === 0 ||
      kPage[(addr + 1) & 0xfff] === 0 ||
      kPage[(addr + 2) & 0xfff] === 0 ||
      kPage[(addr + 3) & 0xfff] === 0
    ) {
      continue
    }
    const val = m.u32(addr) >>> 0
    if (val < allocStart || val >= allocEnd) continue
    let lo = 0
    let hi = intervals.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const iv = intervals[mid]!
      if (val < iv.start) {
        hi = mid - 1
      } else if (val >= (iv.start + iv.size) >>> 0) {
        lo = mid + 1
      } else {
        m.setU32(addr, (iv.dst + (val - iv.start)) >>> 0)
        break
      }
    }
  }

  for (let offByte = 0; offByte < 0x48c; offByte += 4) {
    m.setU32((pSnapDrlg + offByte) >>> 0, m.u32((pSimDrlg + offByte) >>> 0))
  }
  for (const [simLvl, snapLvl] of levelPairs) {
    for (let offByte = 0; offByte < 0x230; offByte += 4) {
      m.setU32((snapLvl + offByte) >>> 0, m.u32((simLvl + offByte) >>> 0))
    }
  }
  for (const [simRx, snapRx] of roomExPairs) {
    const orig14 = m.u32((snapRx + 0x14) >>> 0) >>> 0
    const orig18 = m.u32((snapRx + 0x18) >>> 0) >>> 0
    const orig28 = m.u32((snapRx + 0x28) >>> 0) >>> 0
    const orig30 = m.u32((snapRx + 0x30) >>> 0) >>> 0
    for (let offByte = 0; offByte < 0xec; offByte += 4) {
      m.setU32((snapRx + offByte) >>> 0, m.u32((simRx + offByte) >>> 0))
    }
    if (orig30 !== 0) {
      m.setU32((snapRx + 0x14) >>> 0, orig14)
      m.setU32((snapRx + 0x18) >>> 0, orig18)
      m.setU32((snapRx + 0x28) >>> 0, orig28)
      m.setU32((snapRx + 0x30) >>> 0, orig30)
    }
  }

  const pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  for (const [simR1, snapR1] of room1Pairs) {
    m.setU32((snapR1 + 0x08) >>> 0, m.u32((simR1 + 0x08) >>> 0))
    if (pClient !== 0 && (m.u32((snapR1 + 0x78) >>> 0) >>> 0) > 0) {
      let pClientList = m.u32((snapR1 + 0x48) >>> 0) >>> 0
      if (pClientList === 0) {
        pClientList = m.alloc(16) >>> 0
        m.setU32((snapR1 + 0x48) >>> 0, pClientList)
        if ((m.u32((snapR1 + 0x04) >>> 0) >>> 0) === 0) {
          m.setU32((snapR1 + 0x04) >>> 0, 4)
        }
      }
      m.setU32(pClientList, pClient)
    }
  }

  m.setU32((pSnapAct + 0x54) >>> 0, 0)
  return true
}

function buildActRoomsCallees113c(_world: FallenSliceWorld113c): ActRoomsCallees113c {
  const spawnHooks: RegpopSpawnHooks113c = {
    getLevelRoomCountInAct(mem, pAct, nLevelId) {
      return DUNGEON_CountNonPresetRoomsInLevel113c(mem, pAct, nLevelId)
    },
  }
  const objectSpawnCallees: ObjectSpawnCallees113c = {
    initObject(mem, pUnit, pg, nUnitId, pr, x, y) {
      OBJECTS_InitObjectUnit113c(mem, pUnit, pg, nUnitId, pr, x, y)
    },
    placeServerUnit(mem, y, pUnit, pr, x, pg, a2) {
      SUNIT_PlaceServerUnitInRoom113c(mem, pr, y, pUnit, x, pg, a2)
    },
  }
  const objectsCallees: ObjectsPopulateCallees113c = {
    getLevelRoomCountInAct(mem, pAct, nLevelId) {
      return DUNGEON_CountNonPresetRoomsInLevel113c(mem, pAct, nLevelId)
    },
    checkLevelObjectHook(mem, pLevelObjInfo, pg, pr, nHook) {
      return OBJECTS_CheckLevelObjectHook113c(mem, pLevelObjInfo, pr, pg, nHook)
    },
    spawnObjectsByFn(mem, nFnVa, pg, pr, nDensity, nObjectId, nProb) {
      if (nFnVa === 0x6fc51000) {
        return OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c(
          mem,
          pg,
          pr,
          nDensity,
          nObjectId,
          nProb,
        )
      }
      if (nFnVa === 0x6fc527d0) {
        return OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(mem, pg, pr, nObjectId, 0, nProb)
      }
      if (nFnVa === 0x6fc50800) {
        return OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c(mem, pg, pr, nDensity)
      }
      if (nFnVa === 0x6fc50150) {
        return OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c(mem, pg, pr, nDensity)
      }
      if (nFnVa === 0x6fc53260) {
        return OBJECTS_SpawnDensityWithSecondaryTorch113c(mem, pg, pr, nDensity, nObjectId, nProb)
      }
      if (nFnVa === 0x6fc52df0) {
        return OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c(mem, pg, pr, nObjectId, nProb)
      }
      if (nFnVa === 0x6fc52a10) {
        return OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c(
          mem,
          pg,
          pr,
          nDensity,
          nObjectId,
          nProb,
        )
      }
      if (nFnVa === 0x6fc52bc0) {
        return OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(
          mem,
          pg,
          pr,
          nDensity,
          nObjectId,
          nProb,
          { objectSpawn: objectSpawnCallees },
        )
      }
      return 0
    },
    spawn: objectSpawnCallees,
  }
  const presetsCallees: RoomPresetCallees113c = {
    spawnMonsterPreset(mem, pr, nClassId, pg, x, y, nMode) {
      return ROOM_SpawnMonsterPreset113c(
        mem,
        pr,
        nClassId,
        pg,
        x,
        y,
        nMode,
        (m2, cid, mode, pg2, pr2, px, py, maxR, wf) =>
          MONSTER_SpawnAtCoords113c(m2, cid, mode, pg2, pr2, px, py, maxR, wf, spawnHooks),
      )
    },
    spawnSpecialObject(mem, nClassId, pg, pr, x, y, nMode) {
      return OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(mem, nClassId, pg, pr, x, y, nMode)
    },
    allocUnitData(mem, nUnitType, nClassId, x, y, pg, pr, a5, nMode, a7) {
      return SUNIT_AllocUnitData113c(mem, nUnitType, nClassId, x, y, pg, pr, a5, nMode, a7)
    },
    placePresetItem(mem, ppItem, pg, pDropArgs, a2) {
      return ITEMS_InitCreatedItemStats_6FC31070_113c(mem, pg, ppItem, pDropArgs, a2)
    },
    freeUnit(mem, pg, pUnit) {
      SUNIT_FreeUnit113c(mem, pg, pUnit)
    },
    initQuestObject1CB(mem, pg, _pUnit, pSaveChain) {
      ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(mem, pg, pSaveChain)
    },
    initQuestObject1CD(mem, pg, _pUnit, pSaveChain) {
      ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(mem, pg, pSaveChain)
    },
    initQuestObject21F(mem, pg, _pUnit, pSaveChain) {
      ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(mem, pg, pSaveChain)
    },
  }
  return {
    refreshRoomUnits(mem, pg, pr) {
      ROOM_RefreshUnitsAndLoadSaved113c(mem, pg, pr)
    },
    objects: objectsCallees,
    initAmbientMonster(mem, pUnit) {
      const pMonData = mem.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const pAiGen = mem.u32((pMonData + 0x28) >>> 0) >>> 0
        if (pAiGen !== 0) {
          mem.setU32(pAiGen, 8)
        }
      }
    },
    presets: presetsCallees,
    regpop: spawnHooks,
  }
}

export function syncActRoomsAndUnitsIntoWorld113c(world: FallenSliceWorld113c): void {
  const { m, pGame } = world
  const addRoomPtr = (rPtr: number): void => {
    if (rPtr === 0 || world.roomByPtr.has(rPtr)) return
    const subX = m.get(rPtr, D2ActiveRoomStrc.nSubtileX) | 0
    const subY = m.get(rPtr, D2ActiveRoomStrc.nSubtileY) | 0
    const subW = m.get(rPtr, D2ActiveRoomStrc.nSubtileWidth) | 0
    const subH = m.get(rPtr, D2ActiveRoomStrc.nSubtileHeight) | 0
    world.roomByPtr.set(rPtr, {
      ptr: rPtr,
      subX,
      subY,
      subW,
      subH,
      isTown: DUNGEON_CheckRoomIsTown113c(m, rPtr) !== 0,
      adjacentRooms: [],
      grid: createLiveRoomCollisionGrid113c(m, rPtr),
    })
  }

  for (let actIdx = 0; actIdx < 5; actIdx++) {
    const pAct = m.u32((pGame + 0xbc + actIdx * 4) >>> 0) >>> 0
    if (pAct === 0) continue
    let rPtr = m.u32((pAct + 0x10) >>> 0) >>> 0
    while (rPtr !== 0) {
      addRoomPtr(rPtr)
      const ppNear = m.get(rPtr, D2ActiveRoomStrc.ppRoomsNear) >>> 0
      const nNear = m.get(rPtr, D2ActiveRoomStrc.nRoomsNear) >>> 0
      if (ppNear !== 0 && nNear <= 64) {
        for (let i = 0; i < nNear; i++) {
          addRoomPtr(m.u32((ppNear + i * 4) >>> 0) >>> 0)
        }
      }
      rPtr = m.u32((rPtr + 0x7c) >>> 0) >>> 0
    }
  }

  for (const [rPtr, roomObj] of world.roomByPtr) {
    const ppRoomsNear = m.get(rPtr, D2ActiveRoomStrc.ppRoomsNear) >>> 0
    const nRoomsNear = m.get(rPtr, D2ActiveRoomStrc.nRoomsNear) >>> 0
    const adjList: MutablePathRoom113c[] = []
    if (ppRoomsNear !== 0 && nRoomsNear <= 64) {
      for (let i = 0; i < nRoomsNear; i++) {
        const nearPtr = m.u32((ppRoomsNear + i * 4) >>> 0) >>> 0
        if (nearPtr === 0 || nearPtr === rPtr) continue
        const adj = world.roomByPtr.get(nearPtr)
        if (adj !== undefined) adjList.push(adj)
      }
    }
    roomObj.adjacentRooms = adjList
  }

  for (let listIdx = 0; listIdx < 5; listIdx++) {
    const base = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[listIdx]!) >>> 0
    for (let b = 0; b < 128; b++) {
      let pUnit = m.u32((base + b * 4) >>> 0) >>> 0
      while (pUnit !== 0) {
        const uType = m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0
        const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
        const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
        const key = unitKey(uType, uId)
        const isNew = !world.unitsByKey.has(key)
        world.unitsByKey.set(key, pUnit)
        const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
        if (pRoom !== 0) addRoomPtr(pRoom)

        if (uType === UNIT_MONSTER) {
          world.monsterById.set(uId, pUnit)
          const pMonData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
          if (pMonData !== 0) {
            const pTxt = getMonStatsTxtPtrPure113c(m, classId)
            if (pTxt !== 0 && m.get(pMonData, D2MonsterDataStrc.pMonStatsTxt) === 0) {
              m.set(pMonData, D2MonsterDataStrc.pMonStatsTxt, pTxt >>> 0)
            }
            const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral) >>> 0
            if (pAiGen !== 0) {
              const rawThink = m.get(pAiGen, D2AiGeneralStrc.pfnThink) >>> 0
              if (((rawThink - 0x83130) & 0xffff) === 0) {
                m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_FALLEN_113C)
              } else if (((rawThink - 0x838b0) & 0xffff) === 0) {
                m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_ZOMBIE_113C)
              }
              const pGroup = m.get(pAiGen, D2AiGeneralStrc.pGroup) >>> 0
              const leaderId = m.get(pAiGen, D2AiGeneralStrc.dwLeaderId) >>> 0
              const leaderType = m.get(pAiGen, D2AiGeneralStrc.dwLeaderType) >>> 0
              if (isNew && pGroup !== 0 && leaderType === 1 && leaderId !== uId) {
                let list = world.minionIdsByLeaderId.get(leaderId)
                if (list === undefined) {
                  list = []
                  world.minionIdsByLeaderId.set(leaderId, list)
                }
                if (!list.includes(uId)) {
                  list.unshift(uId)
                }
              }
            }
          }
        }
        if (uType !== UNIT_ITEM) {
          const curPathPtr = m.get(pUnit, D2UnitStrc.pPath)
          const existingPathUnit = world.pathUnitByPtr.get(pUnit)
          if (existingPathUnit === undefined || existingPathUnit.pPath !== curPathPtr) {
            world.pathUnitByPtr.set(pUnit, {
              pUnit,
              pPath: curPathPtr,
              dwUnitType: uType,
              dwClassId: classId,
              dwUnitId: uId,
              dwAnimMode: m.get(pUnit, D2UnitStrc.dwAnimMode),
              dwFlags: m.get(pUnit, D2UnitStrc.dwFlags),
              dwFlagEx: m.get(pUnit, D2UnitStrc.dwFlags2),
            })
          } else {
            existingPathUnit.dwAnimMode = m.get(pUnit, D2UnitStrc.dwAnimMode)
            existingPathUnit.dwFlags = m.get(pUnit, D2UnitStrc.dwFlags)
            existingPathUnit.dwFlagEx = m.get(pUnit, D2UnitStrc.dwFlags2)
          }
        }
        pUnit = m.get(pUnit, D2UnitStrc.pGameHashNext) >>> 0
      }
    }
  }
}

function pruneRemovedUnitsFromWorld113c(world: FallenSliceWorld113c): void {
  const { m, pGame } = world
  const liveUnits = new Set<number>()
  for (let listIdx = 0; listIdx < 5; listIdx++) {
    const base = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[listIdx]!) >>> 0
    for (let b = 0; b < 128; b++) {
      let pUnit = m.u32((base + b * 4) >>> 0) >>> 0
      while (pUnit !== 0) {
        liveUnits.add(pUnit)
        pUnit = m.get(pUnit, D2UnitStrc.pGameHashNext) >>> 0
      }
    }
  }
  let pTile = m.u32((pGame + 0x1b20) >>> 0) >>> 0
  while (pTile !== 0) {
    liveUnits.add(pTile)
    pTile = m.get(pTile, D2UnitStrc.pGameHashNext) >>> 0
  }
  for (const [key, pUnit] of world.unitsByKey) {
    if (!liveUnits.has(pUnit)) {
      const uType = m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0
      const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
      world.unitsByKey.delete(key)
      if (uType === UNIT_MONSTER) world.monsterById.delete(uId)
      world.pathUnitByPtr.delete(pUnit)
    }
  }
}

export function hydrateSnapshotKernelTables113c(
  m: Memory113c,
  pGame: number,
  snapD2GameBase = 0,
  saveBytes?: Uint8Array,
): FallenSliceWorld113c {
  ensureD2CommonPathGlobals113c(m)
  ensureObjectsTxtTable113c(m)
  const hasFullDrlg = ensureDrlgActTablesHydrated113c(m, pGame)
  if (hasFullDrlg) {
    const pObjCtrl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
    if (pObjCtrl !== 0) {
      const nShrineRecs = DATATBLS_GetObjGroupTxtRecordCount113c(m) | 0
      const cursors = new Int32Array(8)
      for (let i = 0; i < nShrineRecs; i++) {
        const pRec = DATATBLS_GetObjGroupTxtRecord113c(m, i) >>> 0
        if (pRec === 0) continue
        const grpType = m.u8((pRec + 0xb2) >>> 0)
        if (grpType >= 8) continue
        const cap = m.u32((pObjCtrl + 0x08 + (grpType << 2)) >>> 0) | 0
        const pArr = m.u32((pObjCtrl + 0x28 + (grpType << 2)) >>> 0) >>> 0
        const cur = cursors[grpType]!
        if (pArr !== 0 && cur < cap) {
          m.setU32((pArr + (cur << 2)) >>> 0, i >>> 0)
          cursors[grpType] = (cur + 1) | 0
        }
      }
    }
  }

  m.fill((pGame + 0x1d00) >>> 0, D2GameStrc_SIZE - 0x1d00, 0)
  m.setU32((pGame + 0x10f4) >>> 0, 0)

  const pTimer = m.get(pGame, D2GameStrc.pTimer) >>> 0
  if (pTimer !== 0) {
    m.set(pTimer, D2TimerStrc.pPool, 0)
    EVENT_AllocChunk113c(m, pTimer)
  }

  const unitsByKey = new Map<string, number>()
  const monsterById = new Map<number, number>()
  const playerById = new Map<number, number>()
  const clientById = new Map<number, number>()
  const roomPtrs = new Set<number>()

  const townPresets = ACT1_TOWN_DS1_PRESETS_113C['townN1']
  const townOriginX = 5520
  const townOriginY = 5880

  const addRoomTree = (rPtr: number): void => {
    if (rPtr === 0 || roomPtrs.has(rPtr)) return
    roomPtrs.add(rPtr)
    const ppNear = m.get(rPtr, D2ActiveRoomStrc.ppRoomsNear) >>> 0
    const nNear = m.get(rPtr, D2ActiveRoomStrc.nRoomsNear) >>> 0
    if (ppNear !== 0 && nNear <= 64) {
      for (let i = 0; i < nNear; i++) {
        const nr = m.u32((ppNear + i * 4) >>> 0) >>> 0
        if (nr !== 0) roomPtrs.add(nr)
      }
    }
  }

  const registerUnit = (pUnit: number): void => {
    const uType = m.get(pUnit, D2UnitStrc.dwUnitType) >>> 0
    const uId = m.get(pUnit, D2UnitStrc.dwUnitId) >>> 0
    const classId = m.get(pUnit, D2UnitStrc.dwClassId) >>> 0
    unitsByKey.set(unitKey(uType, uId), pUnit)
    const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0
    if (pRoom !== 0) addRoomTree(pRoom)

    if (uType === UNIT_PLAYER) {
      playerById.set(uId, pUnit)
      const pPlrData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
      if (pPlrData !== 0) {
        const pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
        if (pClient !== 0) {
          clientById.set(m.u32(pClient) >>> 0, pUnit)
          m.setU32((pClient + 0x1b8) >>> 0, 0)
          m.setU32((pClient + 0x1bc) >>> 0, 0)
          m.setU32((pClient + 0x1c0) >>> 0, 0)
          m.setU32((pClient + 0x4a8) >>> 0, 0)
        }
      }
    } else if (uType === UNIT_MONSTER) {
      monsterById.set(uId, pUnit)
      const pTxt = getMonStatsTxtPtrPure113c(m, classId)
      if (pTxt !== 0) {
        const pMonData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
        if (pMonData !== 0) {
          m.set(pMonData, D2MonsterDataStrc.pMonStatsTxt, pTxt >>> 0)
        }
      }
      if (
        !hasFullDrlg &&
        townPresets !== undefined &&
        pRoom !== 0 &&
        DUNGEON_GetLevelIdFromRoom113c(m, pRoom) === 1
      ) {
        const pos = getUnitPosSubtile113c(m, pUnit)
        let bestPreset: (typeof townPresets)[number] | null = null
        let bestDist = 0x7fffffff
        for (let i = 0; i < townPresets.length; i++) {
          const pr = townPresets[i]!
          if (pr.uType !== 1 || (pr.txtId >>> 0) !== classId || pr.mapAi === null) continue
          const px = townOriginX + pr.x
          const py = townOriginY + pr.y
          const d = Math.abs(pos.x - px) + Math.abs(pos.y - py)
          if (d < bestDist) {
            bestDist = d
            bestPreset = pr
          }
        }
        if (bestPreset !== null && bestPreset.mapAi !== null && bestDist <= 32) {
          const pts: NpcWaypoint113c[] = []
          for (let j = 0; j < bestPreset.mapAi.length; j++) {
            const entry = bestPreset.mapAi[j]!
            pts.push({
              action: entry[0],
              x: townOriginX + entry[1],
              y: townOriginY + entry[2],
            })
          }
          writeNpcWaypointsToMem113c(m, pUnit, pts)
        }
      }
    } else if (uType === 2) {
      const pTxt = getObjectTxtPtrPure113c(m, classId)
      if (pTxt !== 0) {
        const pObjData = m.get(pUnit, D2UnitStrc.pUnitData) >>> 0
        if (pObjData !== 0) {
          m.setU32(pObjData, pTxt >>> 0)
        }
      }
    }
  }

  for (let listIdx = 0; listIdx < 5; listIdx++) {
    const base = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[listIdx]!) >>> 0
    for (let b = 0; b < 128; b++) {
      let pUnit = m.u32((base + b * 4) >>> 0)
      while (pUnit !== 0) {
        registerUnit(pUnit >>> 0)
        pUnit = m.get(pUnit, D2UnitStrc.pGameHashNext) >>> 0
      }
    }
  }
  let pTile = m.u32((pGame + 0x1b20) >>> 0)
  while (pTile !== 0) {
    registerUnit(pTile >>> 0)
    pTile = m.get(pTile, D2UnitStrc.pGameHashNext) >>> 0
  }

  const dummyGrid: SlicePathCollisionGrid113c = {
    get: () => COLLIDE_MASK_INVALID_113C,
    set: () => {},
  }
  const roomByPtr = new Map<number, MutablePathRoom113c>()
  for (const rPtr of roomPtrs) {
    const subX = m.get(rPtr, D2ActiveRoomStrc.nSubtileX) | 0
    const subY = m.get(rPtr, D2ActiveRoomStrc.nSubtileY) | 0
    const subW = m.get(rPtr, D2ActiveRoomStrc.nSubtileWidth) | 0
    const subH = m.get(rPtr, D2ActiveRoomStrc.nSubtileHeight) | 0
    const pColl = m.u32((rPtr + 0x20) >>> 0)
    roomByPtr.set(rPtr, {
      ptr: rPtr,
      subX,
      subY,
      subW,
      subH,
      isTown: DUNGEON_CheckRoomIsTown113c(m, rPtr) !== 0,
      adjacentRooms: [],
      grid: pColl !== 0 ? createLiveRoomCollisionGrid113c(m, rPtr) : dummyGrid,
    })
  }
  for (const [rPtr, roomObj] of roomByPtr) {
    const ppRoomsNear = m.get(rPtr, D2ActiveRoomStrc.ppRoomsNear) >>> 0
    const nRoomsNear = m.get(rPtr, D2ActiveRoomStrc.nRoomsNear) >>> 0
    const adjList: MutablePathRoom113c[] = []
    if (ppRoomsNear !== 0 && nRoomsNear <= 64) {
      for (let i = 0; i < nRoomsNear; i++) {
        const nearPtr = m.u32((ppRoomsNear + i * 4) >>> 0) >>> 0
        if (nearPtr === 0 || nearPtr === rPtr) continue
        const adj = roomByPtr.get(nearPtr)
        if (adj !== undefined) adjList.push(adj)
      }
    }
    roomObj.adjacentRooms = adjList
  }

  const minionIdsByLeaderId = new Map<number, number[]>()
  for (const [monId, pMon] of monsterById) {
    const pMonData = m.get(pMon, D2UnitStrc.pUnitData)
    if (pMonData === 0) continue
    const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
    if (pAiGen === 0) continue
    const rawThink = m.get(pAiGen, D2AiGeneralStrc.pfnThink) >>> 0
    if (rawThink !== 0) {
      if (((rawThink - 0x83130) & 0xffff) === 0) {
        m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_FALLEN_113C)
      } else if (((rawThink - 0x838b0) & 0xffff) === 0) {
        m.set(pAiGen, D2AiGeneralStrc.pfnThink, VA_AI_ZOMBIE_113C)
      } else if (snapD2GameBase !== 0 && rawThink >= snapD2GameBase && rawThink < (snapD2GameBase + 0x130000) >>> 0) {
        m.set(pAiGen, D2AiGeneralStrc.pfnThink, (0x6fc20000 + ((rawThink - snapD2GameBase) >>> 0)) >>> 0)
      }
    }
    const pGroup = m.get(pAiGen, D2AiGeneralStrc.pGroup)
    const leaderId = m.get(pAiGen, D2AiGeneralStrc.dwLeaderId)
    const leaderType = m.get(pAiGen, D2AiGeneralStrc.dwLeaderType)
    if (pGroup !== 0 && leaderType === 1 && leaderId !== monId) {
      let list = minionIdsByLeaderId.get(leaderId)
      if (list === undefined) {
        list = []
        minionIdsByLeaderId.set(leaderId, list)
      }
      list.unshift(monId)
    }
  }

  const pathUnitByPtr = new Map<number, MutablePathUnit113c>()
  for (const pUnit of unitsByKey.values()) {
    if (m.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_ITEM) continue
    const pPath = m.get(pUnit, D2UnitStrc.pPath)
    pathUnitByPtr.set(pUnit, {
      pUnit,
      pPath,
      dwUnitType: m.get(pUnit, D2UnitStrc.dwUnitType),
      dwClassId: m.get(pUnit, D2UnitStrc.dwClassId),
      dwUnitId: m.get(pUnit, D2UnitStrc.dwUnitId),
      dwAnimMode: m.get(pUnit, D2UnitStrc.dwAnimMode),
      dwFlags: m.get(pUnit, D2UnitStrc.dwFlags),
      dwFlagEx: m.get(pUnit, D2UnitStrc.dwFlags2),
    })
  }

  const world: FallenSliceWorld113c = {
    m,
    pGame,
    pTimer,
    hasFullDrlg,
    playerKillsById: new Map<number, number>(),
    dirtyKillPlayerIds: new Set<number>(),
    unitsByKey,
    monsterById,
    playerById,
    clientById,
    pathUnitByPtr,
    roomByPtr,
    minionIdsByLeaderId,
    lastFrameOrd: [],
    lastFrameDmg: [],
  }
  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  const isAddrLoaded = (addr: number): boolean => {
    if (addr === 0) return false
    const kp = memInternal.known?.get(addr >>> 12)
    return kp !== undefined && kp[addr & 0xfff] !== 0
  }
  for (const pPlr of playerById.values()) {
    const pPlrData = m.u32((pPlr + 0x14) >>> 0) >>> 0
    if (pPlrData !== 0) {
      const pClientPlr = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
      if (pClientPlr !== 0) {
        for (let off = 0x200; off < 0x4b0; off += 1) {
          const addr = (pClientPlr + off) >>> 0
          if (!isAddrLoaded(addr)) {
            m.setU8(addr, 0)
          }
        }
      }
      const pArenaUnit = m.u32((pPlrData + 0x34) >>> 0) >>> 0
      if (pArenaUnit === 0) {
        const pFreshArena = m.alloc(0x10) >>> 0
        m.fill(pFreshArena, 0x10, 0)
        m.setU32((pPlrData + 0x34) >>> 0, pFreshArena)
      } else if (!isAddrLoaded(pArenaUnit)) {
        m.fill(pArenaUnit, 0x10, 0)
      }
      const pPets = m.u32((pPlrData + 0x44) >>> 0) >>> 0
      if (pPets !== 0) {
        if (!isAddrLoaded(pPets)) {
          m.setU32((pPlrData + 0x44) >>> 0, 0)
        } else if (!isAddrLoaded(m.u32(pPets) >>> 0)) {
          m.setU32(pPets, 0)
        }
      }
    }
    const pSkills = m.u32((pPlr + 0xa8) >>> 0) >>> 0
    if (pSkills === 0) continue
    if (!isAddrLoaded(m.u32((pSkills + 0x0c) >>> 0) >>> 0)) {
      m.setU32((pSkills + 0x0c) >>> 0, 0)
    }
    const pFirstSkill = m.u32((pSkills + 0x04) >>> 0) >>> 0
    if (pFirstSkill !== 0) {
      const pTables = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
      const pSkillsTxtBase = pTables !== 0 ? (m.u32((pTables + 0xb98) >>> 0) >>> 0) : 0
      const nSkillsCount = pTables !== 0 ? (m.u32((pTables + 0xba0) >>> 0) | 0) : 0
      const oldTxt = m.u32(pFirstSkill) >>> 0
      if (oldTxt !== 0 && pSkillsTxtBase !== 0 && isAddrLoaded(oldTxt)) {
        const wSkillId = (m.u16(oldTxt) << 16) >> 16
        if (wSkillId >= 0 && wSkillId < nSkillsCount) {
          m.setU32(pFirstSkill, (pSkillsTxtBase + Math.imul(wSkillId, 0x23c)) >>> 0)
        }
      }
    }
    if (pFirstSkill !== 0 && !isAddrLoaded(m.u32((pFirstSkill + 0x04) >>> 0) >>> 0)) {
      m.setU32((pFirstSkill + 0x04) >>> 0, 0)
      if (saveBytes !== undefined && saveBytes.length >= 0x300) {
        const classId = m.get(pPlr, D2UnitStrc.dwClassId) >>> 0
        const CLASS_SKILL_BASE = [6, 36, 66, 96, 126, 221, 251]
        const baseSkillId = classId < CLASS_SKILL_BASE.length ? CLASS_SKILL_BASE[classId]! : 0
        let ifOff = -1
        for (let i = saveBytes.length - 32; i >= 0x200; i--) {
          if (saveBytes[i] === 0x69 && saveBytes[i + 1] === 0x66) {
            ifOff = i + 2
            break
          }
        }
        if (ifOff >= 0 && ifOff + 30 <= saveBytes.length) {
          for (let s = 0; s < 30; s++) {
            const pts = saveBytes[ifOff + s]!
            if (pts > 0) {
              SKILLS_SetSkillLevelOnUnit113c(m, pPlr, baseSkillId + s, pts, 1, 0, 0)
            }
          }
        }
        const saveDv = new DataView(saveBytes.buffer, saveBytes.byteOffset, saveBytes.byteLength)
        const rightSkillId = saveDv.getUint32(0x7c, true) | 0
        if (rightSkillId >= 0) {
          SKILLS_SetRightSkill113c(m, pPlr, rightSkillId, 0xffffffff)
        }
      }
      const pStatList = m.u32((pPlr + 0x5c) >>> 0) >>> 0
      if (pStatList !== 0 && isAddrLoaded((pStatList + 0x48) >>> 0)) {
        const pFullArr = m.u32((pStatList + 0x48) >>> 0) >>> 0
        const nFullCnt = m.u16((pStatList + 0x4c) >>> 0)
        if (pFullArr !== 0 && isAddrLoaded(pFullArr)) {
          for (let i = 0; i < nFullCnt; i++) {
            const param = m.u16((pFullArr + i * 8) >>> 0)
            const statId = m.u16((pFullArr + i * 8 + 2) >>> 0)
            const val = m.u32((pFullArr + i * 8 + 4) >>> 0) | 0
            if (
              (statId === 107 || statId === 97) &&
              val > 0 &&
              param > 0 &&
              SKILLS_GetSkillById113c(m, pPlr, param, 0xffffffff) === 0
            ) {
              SKILLS_SetSkillLevelOnUnit113c(m, pPlr, param, 0, 0, 0, 0)
            }
          }
        }
      }
    }
  }
  SLICE_WORLD_BY_MEM.set(m, world)
  registerKernelMonsterAiBridge113c(m, {
    startMode: (pUnit, mode, pTargetUnit, targetX, targetY) =>
      MONSTER_StartMode113c(world, pUnit, mode, pTargetUnit, targetX, targetY) ? 1 : 0,
    stall: (pUnit, nDelay) => {
      AI_Stall113c(world, pUnit, nDelay)
    },
    idleWander: (pUnit, range) => (AI_IdleWander113c(world, pUnit, range) ? 1 : 0),
    tryRunTownNpcThink: (pMonster, pfnThink) =>
      k4ReplayBridge !== null ? k4ReplayBridge.tryRunTownNpcThink(m, pGame, pMonster, pfnThink) : false,
    getEquippedWeapon: (pUnit) => PLAYER_GetEquippedWeapon113c(m, pUnit),
    scheduleModeAnimEventsFromMem: (pg, pUnit, evStep, evEnd) =>
      SUNIT_ScheduleModeAnimEvents113c(m, pg, pUnit, evStep, evEnd),
  })
  syncActRoomsAndUnitsIntoWorld113c(world)
  for (const pUnit of unitsByKey.values()) {
    const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
    if (uType !== UNIT_PLAYER && uType !== UNIT_MONSTER) continue
    if (pGame !== 0) {
      m.set(pUnit, D2UnitStrc.pGame, pGame)
    }
    const pStatListEx = m.u32((pUnit + 0x5c) >>> 0) >>> 0
    if (pStatListEx !== 0 && (m.u32((pStatListEx + 0x10) >>> 0) & 0x80000000) !== 0) {
      const rawFpStatChanged = m.u32((pStatListEx + 0x5c) >>> 0) >>> 0
      if (rawFpStatChanged !== 0 && (rawFpStatChanged & 0xffff) === 0x9470) {
        m.setU32((pStatListEx + 0x5c) >>> 0, 0x6fcf9470)
        m.setU32((pStatListEx + 0x60) >>> 0, pGame >>> 0)
      }
    }
    const rawEvHead = m.u32((pUnit + 0x90) >>> 0) >>> 0
    if (rawEvHead !== 0 && rawEvHead < 0x40000000) {
      m.setU32((pUnit + 0x90) >>> 0, 0)
    }
    if (
      uType === UNIT_PLAYER &&
      pStatListEx !== 0 &&
      (m.u32((pStatListEx + 0x10) >>> 0) & 0x80000000) !== 0 &&
      hasHydratedItemTables113c(m)
    ) {
      const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
      if (pInventory !== 0) {
        const savedHp = STATLIST_GetUnitBaseStat113c(m, pUnit, 6, 0)
        const savedMana = STATLIST_GetUnitBaseStat113c(m, pUnit, 8, 0)
        const savedStam = STATLIST_GetUnitBaseStat113c(m, pUnit, 10, 0)
        const savedFlags = m.u32((pUnit + 0xc4) >>> 0) >>> 0
        const savedFlags2 = m.u32((pUnit + 0xc8) >>> 0) >>> 0
        const savedAnim40 = m.u32((pUnit + 0x40) >>> 0) >>> 0
        const savedAnim44 = m.u32((pUnit + 0x44) >>> 0) >>> 0
        const savedAnim48 = m.u32((pUnit + 0x48) >>> 0) >>> 0
        const savedAnim4C = m.u32((pUnit + 0x4c) >>> 0) >>> 0
        const savedAnim50 = m.u32((pUnit + 0x50) >>> 0) >>> 0
        const savedUpdateNext = m.u32((pUnit + 0xdc) >>> 0) >>> 0
        const savedModStatCount = m.u16((pStatListEx + 0x54) >>> 0)
        const savedWeaponId = m.u32((pInventory + 0x1c) >>> 0) >>> 0
        const pUnitRoom = UNITS_GetRoom113c(m, pUnit)
        const savedRoomUpdateHead =
          pUnitRoom !== 0 ? (m.u32((pUnitRoom + 0x38) >>> 0) >>> 0) : 0
        const savedSp = replayStackPtr113c
        replayStackPtr113c = (savedSp + 0x20) >>> 0
        const pPreSnap = savedSp
        try {
          D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c(m, pUnit, pPreSnap)

          for (let bodyLoc = 1; bodyLoc < 11; bodyLoc += 1) {
            const pItem = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, bodyLoc)
            if (pItem !== 0) {
              INVENTORY_UpdateWeaponGuidOnRemoval113c(m, pInventory, pItem)
              ITEMS_DeactivateEquippedItemStats113c(m, pUnit, pItem, pGame, 1, 0)
            }
          }
          let pItemNode = INVENTORY_GetFirstItem113c(m, pInventory)
          while (pItemNode !== 0) {
            const pItem = INVENTORY_UnitIsItem113c(m, pItemNode)
            if (
              pItem !== 0 &&
              INVENTORY_GetItemNodePositionOther113c(m, pItemNode) === 1 &&
              ITEMS_CanUseCharmInInventory113c(m, pItem, pUnit) !== 0
            ) {
              STATLIST_UnlinkUnitStatList113c(m, pUnit, pItem)
            }
            pItemNode = INVENTORY_GetNextItem113c(m, pItemNode)
          }

          D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 0)
          D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c(m, pUnit, pPreSnap)
        } finally {
          replayStackPtr113c = savedSp
        }

        STATLIST_SetUnitStat113c(m, pUnit, 6, savedHp, 0)
        STATLIST_SetUnitStat113c(m, pUnit, 8, savedMana, 0)
        STATLIST_SetUnitStat113c(m, pUnit, 10, savedStam, 0)
        m.setU32((pInventory + 0x1c) >>> 0, savedWeaponId)
        m.setU32((pUnit + 0x40) >>> 0, savedAnim40)
        m.setU32((pUnit + 0x44) >>> 0, savedAnim44)
        m.setU32((pUnit + 0x48) >>> 0, savedAnim48)
        m.setU32((pUnit + 0x4c) >>> 0, savedAnim4C)
        m.setU32((pUnit + 0x50) >>> 0, savedAnim50)
        m.setU32((pUnit + 0xc4) >>> 0, savedFlags)
        m.setU32((pUnit + 0xc8) >>> 0, savedFlags2)
        m.setU32((pUnit + 0xdc) >>> 0, savedUpdateNext)
        m.setU16((pStatListEx + 0x54) >>> 0, savedModStatCount)
        if (pUnitRoom !== 0) {
          m.setU32((pUnitRoom + 0x38) >>> 0, savedRoomUpdateHead)
        }
      }
    }
    if (
      rawEvHead !== 0 &&
      rawEvHead < 0x40000000 &&
      pStatListEx !== 0 &&
      (m.u32((pStatListEx + 0x10) >>> 0) & 0x80000000) !== 0
    ) {
      const pFullStat = m.u32((pStatListEx + 0x48) >>> 0) >>> 0
      const wFullCount = m.u16((pStatListEx + 0x4c) >>> 0)
      const pTables = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
      const pIscBase = pTables !== 0 ? (m.u32((pTables + 0xbcc) >>> 0) >>> 0) : 0
      const nIscCount = pTables !== 0 ? (m.u32((pTables + 0xbd4) >>> 0) | 0) : 0
      if (pFullStat !== 0 && pIscBase !== 0) {
        for (let i = 0; i < wFullCount; i += 1) {
          const pEntry = (pFullStat + i * 8) >>> 0
          const dwStatAndLayer = m.u32(pEntry) >>> 0
          const statId = (dwStatAndLayer >>> 16) & 0xffff
          const val = m.u32((pEntry + 4) >>> 0) | 0
          if (val !== 0 && statId >= 0 && statId < nIscCount) {
            const pIsc = (pIscBase + Math.imul(statId, 0x144)) >>> 0
            const ev1 = (m.u16((pIsc + 0x48) >>> 0) << 16) >> 16
            if (
              ev1 > 0 &&
              SUNIT_FindItemEventNode113c(m, pUnit, 2, dwStatAndLayer, dwStatAndLayer) === 0
            ) {
              D2GAME_ITEMSTAT_OnStatChangedCallback113c(
                m,
                pGame,
                pUnit,
                0,
                dwStatAndLayer,
                0,
                val,
              )
            }
          }
        }
      }
    }
  }
  attachSliceWorldCallbacks113c(world)
  hydrateMercHireableSnapshotStateK3_113c(world, saveBytes)
  for (const pPlr of playerById.values()) {
    const pPlrData = m.u32((pPlr + 0x14) >>> 0) >>> 0
    if (pPlrData === 0 || !isAddrLoaded(pPlrData)) continue
    const pPets = m.u32((pPlrData + 0x44) >>> 0) >>> 0
    const pDataTblPets = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    const petTypesCnt = pDataTblPets !== 0 ? (m.u32((pDataTblPets + 0xbf0) >>> 0) >>> 0) : 0
    if (pDataTblPets !== 0 && petTypesCnt > 0) {
      const tblBytes = (petTypesCnt * 0xe0) >>> 0
      for (const tblOff of [0xbe8, 0xbec]) {
        const petTypesBase = m.u32((pDataTblPets + tblOff) >>> 0) >>> 0
        if (petTypesBase === 0) {
          const pFreshPetTbl = m.alloc(tblBytes) >>> 0
          m.fill(pFreshPetTbl, tblBytes, 0)
          m.setU32((pDataTblPets + tblOff) >>> 0, pFreshPetTbl)
        } else {
          for (let rec = 0; rec < petTypesCnt; rec++) {
            const flagAddr = (petTypesBase + rec * 0xe0 + 0x04) >>> 0
            if (!isAddrLoaded(flagAddr)) {
              m.setU8(flagAddr, 0)
            }
          }
        }
      }
    }
    const petBucketBytes = Math.max(0x200, ((petTypesCnt + 2) * 0x0c) >>> 0)
    if (pPets === 0 || !isAddrLoaded(pPets)) {
      const pFreshPets = m.alloc(0x10) >>> 0
      const pFreshBuckets = m.alloc(petBucketBytes) >>> 0
      m.fill(pFreshPets, 0x10, 0)
      m.fill(pFreshBuckets, petBucketBytes, 0)
      m.setU32(pFreshPets, pFreshBuckets)
      m.setU32((pPlrData + 0x44) >>> 0, pFreshPets)
    } else {
      const pBuckets = m.u32(pPets) >>> 0
      if (pBuckets === 0) {
        const pFreshBuckets = m.alloc(petBucketBytes) >>> 0
        m.fill(pFreshBuckets, petBucketBytes, 0)
        m.setU32(pPets, pFreshBuckets)
      } else {
        for (let off = 0; off < petBucketBytes; off += 4) {
          const slotAddr = (pBuckets + off) >>> 0
          if (!isAddrLoaded(slotAddr)) {
            m.setU32(slotAddr, 0)
          }
        }
      }
    }
    const pClBoot = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
    if (pClBoot !== 0 && isAddrLoaded(pClBoot) && pGame !== 0) {
      const savedQHead = m.u32((pClBoot + 0x1b8) >>> 0) >>> 0
      const savedQTail = m.u32((pClBoot + 0x1bc) >>> 0) >>> 0
      const savedQFree = m.u32((pClBoot + 0x1c0) >>> 0) >>> 0
      const savedClState = m.u32((pClBoot + 0x04) >>> 0) >>> 0
      const savedArena1d24 = m.u32((pGame + 0x1d24) >>> 0) >>> 0
      const savedBootSp = replayStackPtr113c
      replayStackPtr113c = (savedBootSp + 0x20) >>> 0
      const pOutSlotIdx = savedBootSp
      const silentJoinCallees: BootInitGapBCallees113c = {
        sendPacketToClient: () => {},
      }
      try {
        if (savedArena1d24 === 0 || !isAddrLoaded(savedArena1d24)) {
          const pTmpArena = m.alloc(0x10) >>> 0
          const pTmpArenaTbl = m.alloc(0x40 * 0x44) >>> 0
          m.fill(pTmpArena, 0x10, 0)
          m.fill(pTmpArenaTbl, 0x40 * 0x44, 0)
          m.setU32((pTmpArena + 4) >>> 0, pTmpArenaTbl)
          m.setU32((pGame + 0x1d24) >>> 0, pTmpArena)
        } else {
          const pExistingTbl = m.u32((savedArena1d24 + 4) >>> 0) >>> 0
          if (pExistingTbl === 0 || !isAddrLoaded(pExistingTbl)) {
            const pTmpArenaTbl = m.alloc(0x40 * 0x44) >>> 0
            m.fill(pTmpArenaTbl, 0x40 * 0x44, 0)
            m.setU32((savedArena1d24 + 4) >>> 0, pTmpArenaTbl)
          }
        }
        const pDataTblBoot = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
        D2GAME_SUNIT_GetGameFromUnit113c(m, pPlr)
        D2GAME_SUNIT_IterateAllLivingPlayers113c(m, pGame, () => {}, 0)
        CLIENTS_ForEachInGameClient113c(m, pGame, 1, 0, () => {})
        GAME_SyncNewClientWithExistingPlayers113c(m, pGame, pClBoot, {
          getClientPartyId: (mem, u) => D2GAME_PARTY_GetPartyIdForUnit113c(mem, u, pGame),
        })
        D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlr, pGame)
        D2GAME_PACKET_Send0x5BPlayerInGame113c(
          m,
          pPlr,
          pClBoot,
          pClBoot,
          pDataTblBoot,
          silentJoinCallees,
        )
        D2GAME_SUMMON_BroadcastPlayerPetsToClient113c(
          m,
          pPlr,
          pClBoot,
          D2COMMON_SGPT_DATATABLES_VA_113C,
          silentJoinCallees,
        )
        D2GAME_ARENA_FindPlayerSlotByUnit113c(m, pOutSlotIdx, pGame, pPlr)
        D2GAME_ARENA_SyncClientKillCountsOnJoin113c(m, pGame, pClBoot, silentJoinCallees)
        D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c(
          m,
          pGame,
          pPlr,
          pPlr,
          silentJoinCallees,
        )
        D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(m, pClBoot, pGame)
        D2GAME_PLRMODES_DispatchModeSyncToClient113c(
          m,
          pPlr,
          pGame,
          pClBoot,
          silentJoinCallees,
        )
        const bootPlrLvl = STATLIST_GetUnitStat113c(m, pPlr, 12, 0) | 0
        D2GAME_PLRMODES_SendStatToClientOrParty113c(
          m,
          pPlr,
          12,
          pPlr,
          bootPlrLvl,
          silentJoinCallees,
        )
        UNIT_SendGfxStatesBitstreamToClient113c(m, pPlr, pClBoot)
        D2GAME_ITEMSTAT_OnStatChangedCallback113c(
          m,
          pGame,
          pPlr,
          0,
          12 << 16,
          bootPlrLvl,
          bootPlrLvl,
          D2GAME_IAT_SGPT_DATATABLES_VA_113C,
          silentJoinCallees,
        )
      } finally {
        replayStackPtr113c = savedBootSp
        m.setU32((pGame + 0x1d24) >>> 0, savedArena1d24)
        m.setU32((pClBoot + 0x04) >>> 0, savedClState)
        m.setU32((pClBoot + 0x1b8) >>> 0, savedQHead)
        m.setU32((pClBoot + 0x1bc) >>> 0, savedQTail)
        m.setU32((pClBoot + 0x1c0) >>> 0, savedQFree)
      }
      let didBootMercCheck = false
      let didBootObjSync = false
      for (const pOtherUnit of unitsByKey.values()) {
        const oType = m.get(pOtherUnit, D2UnitStrc.dwUnitType)
        if (!didBootMercCheck && oType === UNIT_MONSTER) {
          D2GAME_MONSTER_ApplyMercStatsOnOwner113c(
            m,
            pOtherUnit,
            0,
            D2COMMON_SGPT_DATATABLES_VA_113C,
            silentJoinCallees,
          )
          didBootMercCheck = true
        } else if (!didBootObjSync && oType === 2) {
          const pObjRoom = UNITS_GetRoom113c(m, pOtherUnit)
          if (pObjRoom !== 0) {
            OBJECT_CheckRespawnOrPortalInRoom113c(m, pOtherUnit, pObjRoom)
            QUEST_Act1TownPortalUpdateState113c(m, pOtherUnit, pGame)
            const savedObjMode = m.u32((pOtherUnit + 0x10) >>> 0) >>> 0
            const savedObjFlags = m.u32((pOtherUnit + 0xc4) >>> 0) >>> 0
            const savedObjFlags2 = m.u32((pOtherUnit + 0xc8) >>> 0) >>> 0
            const savedObjUpdNext = m.u32((pOtherUnit + 0xe0) >>> 0) >>> 0
            const savedObjRoomUpd = m.u32((pObjRoom + 0x1c) >>> 0) >>> 0
            const pObjActFlag = m.get(pObjRoom, D2ActiveRoomStrc.pActUpdateFlag) >>> 0
            const savedObjActFlag = pObjActFlag !== 0 ? (m.u32(pObjActFlag) >>> 0) : 0
            OBJECT_SetAnimMode2Wrapper113c(m, pGame, pOtherUnit)
            m.setU32((pOtherUnit + 0x10) >>> 0, savedObjMode)
            m.setU32((pOtherUnit + 0xc4) >>> 0, savedObjFlags)
            m.setU32((pOtherUnit + 0xc8) >>> 0, savedObjFlags2)
            m.setU32((pOtherUnit + 0xe0) >>> 0, savedObjUpdNext)
            m.setU32((pObjRoom + 0x1c) >>> 0, savedObjRoomUpd)
            if (pObjActFlag !== 0) {
              m.setU32(pObjActFlag, savedObjActFlag)
            }
            didBootObjSync = true
          }
        }
        if (didBootMercCheck && didBootObjSync) break
      }
      {
        const pScratchGame = m.alloc(D2GameStrc_SIZE) >>> 0
        m.set(pScratchGame, D2GameStrc.dwGameFrame, m.get(pGame, D2GameStrc.dwGameFrame))
        m.setU8((pScratchGame + 0x6a) >>> 0, m.u8((pGame + 0x6a) >>> 0))
        m.setU8((pScratchGame + 0x6d) >>> 0, m.u8((pGame + 0x6d) >>> 0))
        m.setU32((pScratchGame + 0x70) >>> 0, m.u32((pGame + 0x70) >>> 0))
        m.setU32((pScratchGame + 0xd0) >>> 0, 1)
        m.setU32((pScratchGame + 0xd4) >>> 0, 0x29a)
        m.setU32((pScratchGame + 0x1d20) >>> 0, 1)
        EVENT_InitTimerQueue113c(m, pScratchGame)
        const pScratchMonReg = m.alloc(0x310) >>> 0
        m.setU32((pScratchGame + 0xf0 + 1 * 4) >>> 0, pScratchMonReg)
        const pScratchAct = m.alloc(0x80) >>> 0
        m.setU32((pScratchGame + 0xbc) >>> 0, pScratchAct)

        const pScratchRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
        const pScratchRoomEx = m.alloc(D2RoomExStrc_SIZE) >>> 0
        const pScratchLevel = m.alloc(D2DrlgLevelStrc_SIZE) >>> 0
        const pScratchLogicalInfo = m.alloc(0x20) >>> 0
        m.setU8(pScratchLogicalInfo, 0x01)
        const pScratchColl = m.alloc(D2RoomCollisionGridStrc_SIZE) >>> 0
        const pScratchCollMap = m.alloc(40 * 40 * 2) >>> 0
        const ppScratchNear = m.alloc(4) >>> 0
        m.setU32(ppScratchNear, pScratchRoom)
        m.set(pScratchRoom, D2ActiveRoomStrc.ppRoomsNear, ppScratchNear)
        m.set(pScratchRoom, D2ActiveRoomStrc.nRoomsNear, 1)
        m.set(pScratchRoom, D2ActiveRoomStrc.pRoomEx, pScratchRoomEx)
        m.set(pScratchRoom, D2ActiveRoomStrc.pCollisionGrid, pScratchColl)
        m.set(pScratchRoom, D2ActiveRoomStrc.pAct, pScratchAct)
        m.setU32((pScratchRoom + 0x4c) >>> 0, 5000)
        m.setU32((pScratchRoom + 0x50) >>> 0, 5000)
        m.setU32((pScratchRoom + 0x54) >>> 0, 40)
        m.setU32((pScratchRoom + 0x58) >>> 0, 40)
        m.setU32((pScratchRoom + 0x6c) >>> 0, 1)
        m.setU32((pScratchRoom + 0x70) >>> 0, 0x29a)
        m.set(pScratchRoomEx, D2RoomExStrc.pLevel, pScratchLevel)
        m.set(pScratchRoomEx, D2RoomExStrc.pLogicalRoomInfo, pScratchLogicalInfo)
        m.set(pScratchLevel, D2DrlgLevelStrc.nLevelId, 1)
        m.set(pScratchColl, D2RoomCollisionGridStrc.nSubtileX, 5000)
        m.set(pScratchColl, D2RoomCollisionGridStrc.nSubtileY, 5000)
        m.set(pScratchColl, D2RoomCollisionGridStrc.nSubtileWidth, 40)
        m.set(pScratchColl, D2RoomCollisionGridStrc.nSubtileHeight, 40)
        m.set(pScratchColl, D2RoomCollisionGridStrc.nTileX, 1000)
        m.set(pScratchColl, D2RoomCollisionGridStrc.nTileY, 1000)
        m.set(pScratchColl, D2RoomCollisionGridStrc.nTileWidth, 8)
        m.set(pScratchColl, D2RoomCollisionGridStrc.nTileHeight, 8)
        m.set(pScratchColl, D2RoomCollisionGridStrc.pMapStart, pScratchCollMap)

        const pScratchDrlg = m.alloc(0x490) >>> 0
        m.setU32((pScratchAct + 0x48) >>> 0, pScratchDrlg)
        m.setU32((pScratchDrlg + 0x47c) >>> 0, pScratchLevel)
        m.setU32((pScratchLevel + 0x1b4) >>> 0, pScratchDrlg)
        m.setU32((pScratchLevel + 0x10) >>> 0, pScratchRoomEx)
        m.setU8((pScratchRoomEx + 0x44) >>> 0, 2)
        m.setU32((pScratchRoomEx + 0x2c) >>> 0, 1)
        m.setU32((pScratchRoom + 0x34) >>> 0, 1)
        DUNGEON_AreAllAdjacentRoomsActive113c(m, pScratchRoom)
        DUNGEON_UpdateInactiveLevels113c(m, pScratchAct)
        m.setU32((pScratchMonReg + 0x0c) >>> 0, 0xffffffff)
        REGPOP_CanPopulateRoom113c(m, pScratchGame, pScratchRoom)

        const pScratchObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, 0) >>> 0
        if (pScratchObjTxt !== 0) {
          const pScratchObj = m.alloc(0xf4) >>> 0
          const pScratchObjData = m.alloc(0x38) >>> 0
          m.setU32(pScratchObj, 2)
          m.setU32((pScratchObj + 0x04) >>> 0, 0)
          m.setU32((pScratchObj + 0x14) >>> 0, pScratchObjData)
          m.setU32(pScratchObjData, pScratchObjTxt)
          OBJECTS_InitObjectUnit113c(m, pScratchObj, pScratchGame, 1, pScratchRoom, 5020, 5020)
        }

        ROOM_SpawnMonsterPreset113c(
          m,
          pScratchRoom,
          152,
          pScratchGame,
          5020,
          5020,
          1,
          (m2, cid, mode, pg2, pr2, px, py, maxR, wf) =>
            MONSTER_SpawnAtCoords113c(m2, cid, mode, pg2, pr2, px, py, maxR, wf),
        )
      }
    }
  }
  if (hasFullDrlg && k4ReplayBridge !== null) {
    k4ReplayBridge.hydrateQuestAndNpcState(m, pGame, saveBytes)
    syncActRoomsAndUnitsIntoWorld113c(world)
  }
  const clearPtrIfUnloaded = (base: number, off: number): void => {
    if (!isAddrLoaded(base) || !isAddrLoaded((base + off + 3) >>> 0)) return
    const ptr = m.u32((base + off) >>> 0) >>> 0
    if (ptr !== 0 && !isAddrLoaded(ptr)) {
      m.setU32((base + off) >>> 0, 0)
    }
  }
  for (const pUnit of unitsByKey.values()) {
    const uType = m.u32(pUnit) >>> 0
    if (uType === UNIT_PLAYER) continue
    clearPtrIfUnloaded(pUnit, 0x5c)
    clearPtrIfUnloaded(pUnit, 0x60)
    clearPtrIfUnloaded(pUnit, 0x70)
    clearPtrIfUnloaded(pUnit, 0x74)
    clearPtrIfUnloaded(pUnit, 0x7c)
    clearPtrIfUnloaded(pUnit, 0x90)
    clearPtrIfUnloaded(pUnit, 0xa4)
    clearPtrIfUnloaded(pUnit, 0xa8)
    clearPtrIfUnloaded(pUnit, 0xec)
    const pSkillsUnit = m.u32((pUnit + 0xa8) >>> 0) >>> 0
    if (pSkillsUnit !== 0 && isAddrLoaded(pSkillsUnit)) {
      clearPtrIfUnloaded(pSkillsUnit, 0x04)
      clearPtrIfUnloaded(pSkillsUnit, 0x08)
      clearPtrIfUnloaded(pSkillsUnit, 0x0c)
      clearPtrIfUnloaded(pSkillsUnit, 0x10)
    }
    if (uType === UNIT_MONSTER) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0 && isAddrLoaded(pMonData)) {
        clearPtrIfUnloaded(pMonData, 0x28)
        clearPtrIfUnloaded(pMonData, 0x2c)
        clearPtrIfUnloaded(pMonData, 0x30)
        const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
        if (pAiGen !== 0 && isAddrLoaded(pAiGen)) {
          clearPtrIfUnloaded(pAiGen, 0x20)
          clearPtrIfUnloaded(pAiGen, 0x24)
          clearPtrIfUnloaded(pAiGen, 0x34)
          clearPtrIfUnloaded(pAiGen, 0x38)
        }
      }
    }
  }
  syncVirtualTickCountK3_113c(m, m.get(pGame, D2GameStrc.dwGameFrame) >>> 0)
  return world
}

const C2S_NULL_OPCODES_6FD1A078 = new Set<number>([
  0x00, 0x2b, 0x4a, 0x4e, 0x55, 0x56, 0x57, 0x5a, 0x5b, 0x5c, 0x64, 0x65,
])

// 0x6FCEC550
export function C2S_Dispatch113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  packet: Uint8Array,
): number {
  hitD2GameVa113c(0x6FCEC550)
  if (packet.length === 0) return 3
  const op = packet[0]! & 0xff
  if (op === 0 || op >= 0x67 || C2S_NULL_OPCODES_6FD1A078.has(op)) {
    return 3
  }
  const bypassAliveGate =
    op === 0x14 || op === 0x15 || op === 0x3c || op === 0x43 || op === 0x66
  if (!bypassAliveGate) {
    if (op === 0x41) {
      if (pPlayer === 0 || (m.u32((pPlayer + 0x10) >>> 0) >>> 0) !== 0x11) {
        return 0
      }
    } else {
      if (pPlayer === 0 || STATES_CheckState113c(m, pPlayer, 0x36) !== 0) {
        return 0
      }
      const mode = m.u32((pPlayer + 0x10) >>> 0) >>> 0
      if (mode === 0 || mode === 0x11) {
        return 0
      }
    }
  }
  let world = SLICE_WORLD_BY_MEM.get(m)
  if (world === undefined) {
    world = hydrateSnapshotKernelTables113c(m, pGame, 0)
  }
  applyPlayerPacket113c(world, pPlayer, packet)
  return 1
}

// 0x6FCEC550
export function C2S_DispatchFromMem113c(
  m: Memory113c,
  pGame: number,
  pPacket: number,
  nSize: number,
): number {
  if (nSize <= 0) return 0
  let world = SLICE_WORLD_BY_MEM.get(m)
  if (world === undefined) {
    world = hydrateSnapshotKernelTables113c(m, pGame, 0)
  }
  let pPlayer = 0
  for (const p of world.playerById.values()) {
    pPlayer = p
    break
  }
  if (pPlayer === 0) return 0
  const pkt = new Uint8Array(nSize)
  for (let i = 0; i < nSize; i++) {
    pkt[i] = m.u8((pPacket + i) >>> 0)
  }
  applyPlayerPacket113c(world, pPlayer, pkt)
  return 1
}

// 0x6FC4E050
export function GAME_UpdateGameFrame113c(m: Memory113c, pGame: number): number {
  let world = SLICE_WORLD_BY_MEM.get(m)
  if (world === undefined) {
    world = hydrateSnapshotKernelTables113c(m, pGame, 0)
  }
  return stepFallenSliceFrame113c(world, [])
}
