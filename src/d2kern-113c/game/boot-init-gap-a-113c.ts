/**
 * Diablo II v1.13c `D2Game.dll` Boot/Init & Event/Sync Coverage Gap Closure Part 1 (36 VAs).
 *
 * Strictly binary-isomorphic 1:1 ports of `D2Game.dll` (`0x6FC2BD10..0x6FCBD5B0`).
 * Pure `Memory113c` execution with zero legacy module dependencies.
 */
import { COLLISION_FindFreeCoordsNear113c } from '../common/collision.ts'
import { UNITS_GetObjectShrineTxt113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DRLGPRESET_FreeSaveHeaderBlock113c } from '../common/drlg/preset.ts'
import {
  DUNGEON_AreAllAdjacentRoomsActive113c,
  DUNGEON_FreeRoomPortalList113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_GetRoomExFromRoom113c,
} from '../common/dungeon.ts'
import { ENV_GetCycleState113c, ENV_StepCycle113c } from '../common/env.ts'
import { imul32, sar32 } from '../common/int-math.ts'
import {
  INVENTORY_GetCorpseUnitId113c,
  INVENTORY_GetFirstCorpse113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetLeftItemGuid113c,
  INVENTORY_GetNextCorpse113c,
  INVENTORY_GetNextItem113c,
} from '../common/inventory.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import { PATH_GetTargetTypeAndPosition113c, PATH_GetVelocity113c } from '../common/path.ts'
import {
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_SetParam0C113c,
} from '../common/skills.ts'
import {
  DATATBLS_CalculateMonsterStatsByLevel113c,
  STATES_CheckState113c,
  STATES_CheckStateMask2OnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_CheckUnitStatListFlag100113c,
  STATLIST_ClearBaseStats113c,
  STATLIST_CopyBaseStatsToBuffer113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_NotifyIfStatModified113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_AdvanceAnimFrame113c,
  UNITS_GetGfxStateFlagsPtr113c,
  UNITS_GetRoom113c,
  UNITS_GetStateFlagsPtr113c,
  UNITS_HasAnimFinished113c,
  UNITS_HasAnyGfxStateFlag113c,
  UNITS_SetUnitUpdateFlags113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import {
  D2EventStrc,
  D2GameStrc,
  D2MonsterDataStrc,
  D2TimerStrc,
} from '../mem/layout.generated.ts'
import { NET_QueuePacketToClient113c } from '../net/packet-sink.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { seedRoll } from '../prng.ts'
import {
  AIGENERAL_ExpireMinionListsInAct113c,
  ITEMS_ExpireGroundItemsInAct113c,
  SEED_RollLimitedRandomNumber113c,
} from './combat-a1c-113c.ts'
import {
  type BootInitGapBCallees113c,
  D2GAME_ARENA_SyncClientKillCountsOnJoin113c,
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_MONSTER_ApplyMercStatsOnOwner113c,
  D2GAME_MONSTER_SendMonsterMovementSync113c,
  D2GAME_PACKET_Send0x5BPlayerInGame113c,
  D2GAME_PACKET_Send0x73MissileSync113c,
  D2GAME_PACKET_SendMonsterAssign113c,
  D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c,
  D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c,
  D2GAME_PLRMODES_DispatchModeSyncToClient113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c.ts'
import {
  AIGENERAL_PopAiCommand113c,
  PLAYER_Event11_PeriodicTick113c,
  PLAYER_Event3_RegenTick113c,
  SKILLS_GetFlags113c,
} from './replay-kernel-113c.ts'
import { bindK2KernelGlobals113c } from './k2-d2tv-evaluators-113c.ts'
import { MONSTER_StartMode113c, MONSTER_StepPath113c } from './k2-real-s2c-combat-113c.ts'
import {
  MISSILE_BuildK3Hooks113c,
  SKILLS_DoUsedSkillActionK3_113c,
} from './k3-p52-sorc-handlers-113c.ts'
import {
  ITEMMODE_UnitTimerNoop113c,
  NET_SendReassignUnitPacket15_113c,
} from './k2-combat-core-w1-113c.ts'
import {
  PLAYER_Event0C_ExpireTimedStats113c,
  SKILLS_Event08_AuraPulseTick113c,
} from './k2-gap-itemdef-113c.ts'
import { MISSILE_DispatchFrameTick113c } from './k2-gap-melee-dot-113c.ts'
import {
  D2CommonAssertError,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATBLS_GetMonStatsTxtRecordInline113c,
} from '../common/inline-helpers.ts'
import {
  NET_SendPacket47_UnitRelator1_6FCAAEC0_113c,
  NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c,
  NET_SendPacket60_PortalInfo_6FCAAAE0_113c,
  NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c,
  NET_SendPacket98_UnitWordValue_6FCAA6C0_113c,
  OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c,
  OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c,
} from './k2-w2b3-113c.ts'
import {
  NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c,
  NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c,
  PETS_FindPetTypeByGuid_6FCB6600_113c,
} from './k2-w4b5-113c.ts'
import { NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c } from './k2-w5b2-113c.ts'
import {
  ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c,
  MONSTER_SpawnAtCoords_6FD0F450_113c,
  SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c,
} from './k2-w2b8-113c.ts'
import {
  MISSILE_SendSyncPacket73_6FC8F740_113c,
  OBJ_EventHoverMsgTimeout_6FC8E470_113c,
  OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c,
  OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c,
} from './k2-w3b7-113c.ts'
import { EVENT_HandleFreeHoverMsg_6FC99AA0_113c } from './k2-w3b8-113c.ts'
import {
  NET_SendPacket9E9FA0_StatValue_6FCABC20_113c,
  OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c,
} from './k2-w4b4-113c.ts'
import { SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c } from './k2-w4b6-113c.ts'
import { SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c } from './k2-w5b3-113c.ts'
import {
  OBJECTS_FloorSpikesEventTick_6FC8E270_113c,
  OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c,
} from './k2-w7b2-113c.ts'
import {
  OBJ_ThinkEventLightningSpire_6FC8E400_113c,
  OBJ_ThinkEventSparkyChest_6FC8E150_113c,
} from './k2-w8b2-113c.ts'
import { ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c } from './k2-w9b2-113c.ts'
import {
  S2C_SendPacket0D_UnitStop113c,
  S2C_SendPacket0E_UnitCorpseState113c,
  S2C_SendPacket0F_UnitWalkToTarget113c,
  S2C_SendPacket9C_ItemActionWorld113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
  UNITROOM_IsClientInUnitRoom113c,
  UNITROOM_SendDroppedGroundItemToClient113c,
} from './a1c-post150-f786-f1040-113c.ts'
import { AIGENERAL_GetField3C_113c } from './k2-items-tc-w1-113c.ts'
import { ITEMS_SendDropToGroundPacket02_6FCAE030_113c } from './k2-w2b4-113c.ts'
import { PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c } from './k2-w5b1-113c.ts'
import { NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c } from './k2-w5b10-113c.ts'
import {
  PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c,
  PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c,
} from './k2-w5b6-113c.ts'
import { PLAYERSAVE_SavePlayerCharacter_6FC74320_113c } from './k2-w9b1-113c.ts'
import { D2Game_6FC93570_113c } from './k2-w13b1-113c.ts'
import { CLIENT_NotifyAndDisconnectClient_6FC4D090_113c } from './k2-w15b1-113c.ts'
import {
  armDeferSliceQuestTimers113c,
  D2NET_SendUnitMovePacket0x10BytesToClient113c,
  D2NET_SendUnitPosSync0x15ToClient113c,
  flushDeferredSliceQuestTimers113c,
  PLAYER_FinishModeAndResetToNeutral113c,
  PLAYER_StepAnimationModeTick113c,
} from './town-runtime-gap-113c.ts'
import { PLAYER_StartModeOnUnit113c } from './c2s-packet-113c.ts'
import {
  CLIENTS_GetPlayerUnit113c,
  CLIENTS_UpdatePlayerRoom113c,
  type ClientsUpdatePlayerRoomOpts113c,
} from './replay-final11-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  AIGENERAL_FreeMinionList_6FC40B30_113c,
  MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c,
  MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c,
  MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c,
  MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c,
  MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c,
  MONUMOD_SetShatterOnDeath_6FC41A70_113c,
  MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c,
} from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c,
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c,
} from './k2-w2b1-113c.ts'
import { SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c } from './k2-w5b9-113c.ts'
import {
  MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c,
  MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c,
  MONUMOD_RollSelfResurrectEvent7_6FC43570_113c,
  MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c,
  QUESTS_CheckNotIntro_6FC53970_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c,
  SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c,
} from './k2-w5b7-113c.ts'
import {
  PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c,
  QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c,
} from './k2-w10b1-113c.ts'
import {
  ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c,
  MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c,
  MONUMOD_ApplyChampionBaseStats_6FC418A0_113c,
  MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c,
  MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c,
  MONUMOD_SpawnDeathNova_6FC46520_113c,
  MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c,
  MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c,
  MONUMOD_SpawnScarabChargedBolts_6FC46320_113c,
} from './k2-w3b2-113c.ts'
import {
  MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c,
  MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c,
} from './k2-w4b1-113c.ts'
import {
  ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c,
  MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c,
  MONUMOD_SpectralHitMissileDamage_6FC43650_113c,
  OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c,
} from './k2-w4b3-113c.ts'
import { SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c } from './k2-w5b2-113c.ts'
import { UNIT_SendStatB2Packet11ToClient_6FC9A570_113c } from './k2-w3b8-113c.ts'
import { MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c } from './k2-w6b1-113c.ts'
import { MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c } from './k2-w6b4-113c.ts'
import {
  MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c,
  MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c,
  MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c,
  MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c,
  MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c,
  MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c,
} from './k2-w7b1-113c.ts'
import { ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c } from './k2-w7b3-113c.ts'
import {
  MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c,
  MONUMOD_KnockBeltPotionToGround_6FC44440_113c,
} from './k2-w8b1-113c.ts'
import {
  AI_MapAiAction1_WalkToWaypoint113c,
  AI_MapAiAction2_WalkAndWait20_113c,
  AI_MapAiAction3_WalkToWaypoint113c,
  AI_MapAiAction4_WalkAndMode8_113c,
  AI_MapAiAction5_WalkAndMode9_113c,
} from './town-npc-ai-113c.ts'
import {
  MONSTER_DispatchEvent113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
  type MonsterEventCallbacks113c,
} from './monster-events.ts'
import { REGPOP_CanSpawnPresetMinionPack113c } from './k2-sunit-spawn-w1-113c.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_Create113c,
  MONSTER_SpawnAtCoords113c,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  QUEST_Act4DiabloSealCheck113c,
  REGPOP_FindPackSpawnCoords113c,
  SUNIT_AllocUnitData113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import {
  EVENT_FLAG_DEFERRED_FREE,
  EVENT_FLAG_FIRING,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { NET_QueuePacketPtrToClient113c } from '../net/packet-sink.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** Scratch stack region for local structs/buffers in boot/init gap functions. */
let bootInitGapStackPtr = 0x7fb00000

/** `D2Game.dll` `.rdata` table `dword[9]` at `0x6FD1BBF0` used by `MONSTER_GetHirelingLevelBonusFactor113c`. */
export const HIRELING_BONUS_TABLE_6FD1BBF0: readonly number[] = [0, 0, 8, 16, 24, 32, 40, 48, 56]

/** `D2Game.dll` `.data` pointer `gpPerfTickRateArray` at `0x6FD27D30`. */
export const D2GAME_PERF_TICK_ARRAY_PTR_VA_113C = 0x6fd27d30
/** `D2Game.dll` `.bss` accumulator `gdwTotalMemPoolBytes` at `0x6FD4DC28`. */
export const D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C = 0x6fd4dc28
/** `D2Game.dll` `.data` game tick rate global `gdwTicksPerSecond` at `0x6FD2E360`. */
export const D2GAME_TICKS_PER_SECOND_VA_113C = 0x6fd2e360
/** `D2Game.dll` `.bss` peak mempool usage global at `0x6FD31C34` and timestamp at `0x6FD31F88`. */
export const D2GAME_PEAK_MEMPOOL_KB_VA_113C = 0x6fd31c34
export const D2GAME_PEAK_MEMPOOL_TICK_VA_113C = 0x6fd31f88
/** `D2Game.dll` `.data` flag `gbDisableClientTimeout` at `0x6FD286A0`. */
export const D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C = 0x6fd286a0
/** `D2Game.dll` `.data` minion component callback table ptr (`0x6FD27D14`) and count (`0x6FD2A7E0`). */
export const D2GAME_MINION_COMP_TABLE_PTR_VA_113C = 0x6fd27d14
export const D2GAME_MINION_COMP_COUNT_VA_113C = 0x6fd2a7e0

/** Optional external hooks for callees outside the 36 target VAs. */
export interface BootInitGapACallees113c {
  readonly regpop?: RegpopSpawnHooks113c
  readonly monsterEvents?: MonsterEventCallbacks113c
  readonly spawnRestoredBossOrMinion?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    pRec: number,
  ) => void
  readonly relocateRestoredUnit?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    x: number,
    y: number,
    pRoom: number,
  ) => void
  readonly deleteRestoredUnit?: (m: Memory113c, pGame: number, pUnit: number) => void
  readonly postRestoreMonsterHook?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pRec: number,
    bDead: number,
  ) => void
  readonly onComponentCallback?: (
    m: Memory113c,
    pfn: number,
    pGame: number,
    pUnit: number,
    pNode: number,
    bFlag: number,
  ) => void
  readonly onComponentFree?: (
    m: Memory113c,
    pfnFree: number,
    pGame: number,
    pUnit: number,
    pNode: number,
  ) => void
  readonly getTickCountMs?: (m: Memory113c) => number
  readonly getPoolUsageKB?: (m: Memory113c, pMemPool: number) => number
  readonly getClientPartyId?: (m: Memory113c, pUnit: number) => number
  readonly syncPlayerPartyRelations?: (
    m: Memory113c,
    pGame: number,
    pNewClient: number,
    pOtherClient: number,
  ) => void
  readonly sendCorpseSyncPacket?: (
    m: Memory113c,
    pClient: number,
    dwPlayerId: number,
    dwCorpseId: number,
  ) => void
  readonly onPostClientJoinSync?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    pUnit: number,
  ) => void
  readonly checkAct2EclipseQuest?: (m: Memory113c, pGame: number) => number
  readonly disconnectClient?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    nReason: number,
  ) => void
  readonly stepPlayerClientTick?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    pClient: number,
  ) => void
  readonly stepJoinState1Or2?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    dwTickMs: number,
  ) => number
  readonly stepJoinState3Ready?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    dwTickMs: number,
  ) => number
  readonly onEnterGame?: (
    m: Memory113c,
    wGameId: number,
    szCharName: number,
    dwClassId: number,
    dwLevel: number,
    wClientFlag0A: number,
  ) => void
  readonly spawnSuperUniqueById?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    x: number,
    y: number,
    nSuperUniqueId: number,
  ) => number
  readonly pickEvilUrnMonsterClassId?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    pMonReg: number,
  ) => number
  readonly spawnPresetPack?: (
    m: Memory113c,
    pGame: number,
    pRoom: number,
    nClassId: number,
    x: number,
    y: number,
    bFlag1: number,
  ) => number
  readonly getQuestDescriptor?: (m: Memory113c, pGame: number, nQuestId: number) => number
  readonly onObjectQuestSync?: (
    m: Memory113c,
    pGame: number,
    pObject: number,
    pClient: number,
  ) => void
  readonly onStatModifiedNotify?: (
    m: Memory113c,
    pUnit: number,
    nStatId: number,
    nVal: number,
    pClient: number,
  ) => void
  readonly sendLifeManaStaminaPacket?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
    curLife: number,
    curMana: number,
    curStamina: number,
  ) => void
  readonly syncPlayerMode?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    pUnit: number,
  ) => void
  readonly sendUnitEventSound?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
    wSound: number,
  ) => void
  readonly syncUnitFlag8000?: (
    m: Memory113c,
    pGame: number,
    pClient: number,
    pUnit: number,
  ) => void
  readonly sendUnitUpdateFlagsPacket?: (
    m: Memory113c,
    pClient: number,
    pUnit: number,
  ) => void
  readonly onNotifyOpcode?: (
    m: Memory113c,
    opcode: number,
    pClient: number,
    pUnit: number,
    pNode: number,
  ) => void
  readonly onUnitFullSyncPreSwitch?: (
    m: Memory113c,
    dwUnitType: number,
    pClient: number,
    pUnit: number,
    dwFlags: number,
  ) => void
  readonly onUnitFullSyncPostSwitch?: (
    m: Memory113c,
    dwUnitType: number,
    pClient: number,
    pUnit: number,
    dwFlags: number,
  ) => void
  readonly clientRoomOpts?: ClientsUpdatePlayerRoomOpts113c
  readonly allowZeroHandler?: boolean
  readonly dispatchPlayerEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
  readonly dispatchMonsterEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
  readonly dispatchObjectEvent?: (
    m: Memory113c,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
  readonly dispatchMissileEvent?: (
    m: Memory113c,
    pfnHandler: number,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
  readonly dispatchItemEvent?: (
    m: Memory113c,
    pfnHandler: number,
    pGame: number,
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node?: number,
  ) => void
}

/** `Fog.#10046` (`D2FreePoolMem`): pool free is a no-op on sparse/bump memory. */
function fogFreeMemPool113c(_m: Memory113c, _ptr: number): void {}

/** Reads a signed 16-bit integer (`int16_t`) from `Memory113c`. */
function readI16(m: Memory113c, p: number): number {
  return (m.u16(p >>> 0) << 16) >> 16
}

/** `Fog.#10126`: initializes `D2BitBufferStrc` (`20 B`) for `pBuffer`/`nBytes`. */
function fogInitBitBuffer113c(
  m: Memory113c,
  pBitStream: number,
  pBuffer: number,
  nBytes: number,
): void {
  const bs = pBitStream >>> 0
  m.setU32(bs, pBuffer >>> 0)
  m.setU32((bs + 0x04) >>> 0, ((nBytes | 0) << 3) >>> 0)
  m.setU32((bs + 0x08) >>> 0, 0)
  m.setU32((bs + 0x0c) >>> 0, 0)
  m.setU32((bs + 0x10) >>> 0, 0)
}

/** `Fog.#10127`: returns current serialized byte count `nPos + (nPosBits !== 0 ? 1 : 0)`. */
function fogGetBitBufferSize113c(m: Memory113c, pBitStream: number): number {
  const bs = pBitStream >>> 0
  const nPos = m.u32((bs + 0x08) >>> 0) | 0
  return m.u32((bs + 0x0c) >>> 0) !== 0 ? (nPos + 1) | 0 : nPos
}

/** `Fog.#10128`: writes `nBits` of `nValue` into `D2BitBufferStrc` (`pBitStream`). */
function fogWriteBits113c(m: Memory113c, pBitStream: number, nValue: number, nBits: number): void {
  const esi = pBitStream >>> 0
  const ecx = m.u32((esi + 0x0c) >>> 0) | 0
  const edx = m.u32((esi + 0x08) >>> 0) | 0
  const eax = m.u32((esi + 0x04) >>> 0) | 0
  let ebp = nBits | 0
  const newBitTotal = (ecx + (edx << 3) + ebp) | 0
  if (newBitTotal > eax) {
    m.setU32((esi + 0x10) >>> 0, 1)
    m.setU32((esi + 0x08) >>> 0, sar32((eax + ((eax >> 31) & 7)) | 0, 3) >>> 0)
    m.setU32((esi + 0x0c) >>> 0, 0)
    return
  }
  if (ecx === 0) {
    m.setU8(m.u32((esi + 0x00) >>> 0), 0)
  }
  if (ebp <= 0) return
  let ebx = nValue | 0
  while (ebp > 0) {
    const curBit = m.u32((esi + 0x0c) >>> 0) | 0
    let chunk = (8 - curBit) | 0
    if (chunk > ebp) chunk = ebp
    const mask = ((1 << chunk) - 1) & 0xff
    const edi = m.u32((esi + 0x00) >>> 0)
    const dl = ((ebx & mask) << (curBit & 31)) & 0xff
    m.setU8(edi, (m.u8(edi) | dl) & 0xff)
    const nextBit = (curBit + chunk) | 0
    m.setU32((esi + 0x0c) >>> 0, nextBit >>> 0)
    if (nextBit === 8) {
      const newBuf = (m.u32((esi + 0x00) >>> 0) + 1) >>> 0
      const newPos = (m.u32((esi + 0x08) >>> 0) + 1) | 0
      const maxBits = m.u32((esi + 0x04) >>> 0) | 0
      m.setU32((esi + 0x08) >>> 0, newPos >>> 0)
      m.setU32((esi + 0x00) >>> 0, newBuf)
      m.setU32((esi + 0x0c) >>> 0, 0)
      if ((newPos << 3) < maxBits) {
        m.setU8(newBuf, 0)
      }
    }
    ebp = (ebp - chunk) | 0
    ebx = sar32(ebx, chunk & 31)
  }
}

/** `Fog.#10252`: returns lowest set bit index `0..31` of `mask`, or `-1` when `mask == 0`. */
function fogBitScanForward113c(mask: number): number {
  const v = mask >>> 0
  if (v === 0) return -1
  const lowest = (v & -v) >>> 0
  return (31 - Math.clz32(lowest)) | 0
}

/** `Storm.#501` (`SStrCopy`): copies up to `maxLen - 1` bytes and null-terminates `dst`. */
function stormStrCopy113c(m: Memory113c, dst: number, src: number, maxLen: number): number {
  const limit = maxLen | 0
  if (limit <= 0 || dst === 0) return 0
  let i = 0
  if (src !== 0) {
    for (; i < limit - 1; i++) {
      const ch = m.u8((src + i) >>> 0)
      if (ch === 0) break
      m.setU8((dst + i) >>> 0, ch)
    }
  }
  m.setU8((dst + i) >>> 0, 0)
  return i
}

/** `D2Game` `seedRoll` on an in-memory `D2SeedStrc`. */
function seedRollMem113c(m: Memory113c, pSeed: number, nMax: number): number {
  const seed = { lo: m.u32(pSeed >>> 0) >>> 0, hi: m.u32((pSeed + 4) >>> 0) >>> 0 }
  const r = seedRoll(seed, nMax)
  m.setU32((pSeed + 4) >>> 0, seed.hi >>> 0)
  m.setU32(pSeed >>> 0, seed.lo >>> 0)
  return r
}

/**
 * Checks `[pObjectControl + 0x1110]` respawn/portal node against `pRoom` (`[pRoom]` match or
 * `(x, y)` bounds containment); if matched and object mode is `0`, sets mode `1`, schedules event `1`
 * at `dwGameFrame + (pObjTxt[+0xDC] >> 8)`, frees node (`[pObjCtrl+0x1110] = 0`). Otherwise if `pRoom`
 * is town, switches `pUnit` anim mode to `2`.
 *
 * Accepts either 1-arg `pArgs` (`ecx`, `{+0x00: pGame, +0x04: pUnit, +0x08: pRoom}`) matching
 * `D2Game.dll@0x6FC2BD10` or 2-arg `(pUnit, pRoom)` compatibility form.
 *
 * @va D2Game:0x6FC2BD10
 */
export function OBJECT_CheckRespawnOrPortalInRoom113c(
  m: Memory113c,
  pUnitOrArgs: number,
  pRoomArg?: number,
): number {
  hitD2GameVa113c(0x6FC2BD10)
  let pGame = 0
  let pUnit = 0
  let pRoom = 0
  if (pRoomArg === undefined) {
    const pArgs = pUnitOrArgs >>> 0
    if (pArgs === 0) return 1
    pGame = m.u32(pArgs >>> 0) >>> 0
    pUnit = m.u32((pArgs + 0x04) >>> 0) >>> 0
    pRoom = m.u32((pArgs + 0x08) >>> 0) >>> 0
  } else {
    pUnit = pUnitOrArgs >>> 0
    pRoom = pRoomArg >>> 0
    if (pUnit === 0) return 1
    pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  }

  const pObjCtrl = pGame !== 0 ? (m.u32((pGame + 0x10f0) >>> 0) >>> 0) : 0
  let pNode = pObjCtrl !== 0 ? (m.u32((pObjCtrl + 0x1110) >>> 0) >>> 0) : 0
  let matched = false
  while (pNode !== 0) {
    const nodeRoom = m.u32(pNode >>> 0) >>> 0
    if (nodeRoom === pRoom) {
      matched = true
      break
    }
    if (pRoom !== 0) {
      const rx = m.u32((pRoom + 0x4c) >>> 0) | 0
      const rw = m.u32((pRoom + 0x54) >>> 0) | 0
      const nx = m.u32((pNode + 0x04) >>> 0) | 0
      if (nx >= rx && nx < rx + rw) {
        const ry = m.u32((pRoom + 0x50) >>> 0) | 0
        const rh = m.u32((pRoom + 0x58) >>> 0) | 0
        const ny = m.u32((pNode + 0x08) >>> 0) | 0
        if (ny >= ry && ny < ry + rh) {
          matched = true
          break
        }
      }
    }
    pNode = m.u32((pNode + 0x0c) >>> 0) >>> 0
  }

  if (matched) {
    if (pUnit === 0 || m.u32((pUnit + 0x10) >>> 0) === 0) {
      UNITS_ChangeAnimMode113c(m, pUnit, 1)
      const nClassId = pUnit !== 0 ? m.u32((pUnit + 0x04) >>> 0) | 0 : -1
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nClassId) >>> 0
      const dwDelay = (m.u32((pObjTxt + 0xdc) >>> 0) >>> 8) >>> 0
      const dwFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + (dwDelay | 0)) >>> 0
      EVENT_SetEventFull113c(m, pGame, pUnit, 1, dwFrame, 0, 0, 0)
    }
    m.setU32((pObjCtrl + 0x1110) >>> 0, 0)
    return 1
  }

  if (pRoom !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) {
    UNITS_ChangeAnimMode113c(m, pUnit, 2)
  }
  return 1
}

function relocateRestoredServerUnit113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pRoom: number,
  posX: number,
  posY: number,
): void {
  if (pUnit === 0 || pRoom === 0) return
  const uType = m.u32(pUnit >>> 0) >>> 0
  const pPathExisting = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pUnitData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (
    pGame !== 0 &&
    pPathExisting !== 0 &&
    pUnitData !== 0 &&
    (uType !== 4 || m.u32((pUnit + 0x10) >>> 0) === 3) &&
    m.u32((pGame + 0xbc) >>> 0) !== 0
  ) {
    SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c(
      m as SparseMemory113c,
      posY,
      pRoom,
      pUnit,
      pGame,
      posX,
    )
    if (m.u32((pRoom + 0x74) >>> 0) !== 0) return
  }

  let pPath = pPathExisting
  if (uType === 0 || uType === 1 || uType === 3) {
    if (pPath === 0) {
      pPath = m.alloc(0x200) >>> 0
      m.setU32((pUnit + 0x2c) >>> 0, pPath)
      m.setU32((pPath + 0x50) >>> 0, pUnit >>> 0)
    }
    m.setU16((pPath + 0x02) >>> 0, posX & 0xffff)
    m.setU16((pPath + 0x06) >>> 0, posY & 0xffff)
    m.setU16((pPath + 0x10) >>> 0, posX & 0xffff)
    m.setU16((pPath + 0x12) >>> 0, posY & 0xffff)
    m.setU32((pPath + 0x1c) >>> 0, pRoom >>> 0)
  } else {
    if (pPath === 0) {
      pPath = m.alloc(0x14) >>> 0
      m.setU32((pUnit + 0x2c) >>> 0, pPath)
    }
    m.setU32(pPath, pRoom >>> 0)
    m.setU32((pPath + 0x04) >>> 0, posX >>> 0)
    m.setU32((pPath + 0x08) >>> 0, posY >>> 0)
    m.setU32((pPath + 0x0c) >>> 0, posX >>> 0)
    m.setU32((pPath + 0x10) >>> 0, posY >>> 0)
  }
  let inList = false
  let cur = m.u32((pRoom + 0x74) >>> 0) >>> 0
  while (cur !== 0) {
    if (cur === (pUnit >>> 0)) {
      inList = true
      break
    }
    cur = m.u32((cur + 0xe8) >>> 0) >>> 0
  }
  if (!inList) {
    m.setU32((pUnit + 0xe8) >>> 0, m.u32((pRoom + 0x74) >>> 0) >>> 0)
    m.setU32((pRoom + 0x74) >>> 0, pUnit >>> 0)
  }
}

/**
 * Finds (or allocates when `bAlloc != 0`) the `0x18`-byte inactive room save node at
 * `[pGame + (nAct & 0xFF) * 4 + 0xD8]` matching `(roomX, roomY)` (sorted descending by `roomX`).
 *
 * @va D2Game:0x6FC3E960
 */
export function MONREG_FindOrAllocActRoomNode113c(
  m: Memory113c,
  pGame: number,
  nAct: number,
  roomX: number,
  roomY: number,
  bAlloc: number,
): number {
  hitD2GameVa113c(0x6FC3E960)
  if (pGame === 0) return 0
  const actIdx = nAct & 0xff
  if (actIdx >= 5) return 0
  const headAddr = (pGame + actIdx * 4 + 0xd8) >>> 0
  let pCur = m.u32(headAddr) >>> 0
  let pPrev = 0
  let found = 0
  const targetX = roomX | 0
  const targetY = roomY | 0
  while (pCur !== 0) {
    const curX = m.u32(pCur) | 0
    if (targetX === curX && targetY === (m.u32((pCur + 0x04) >>> 0) | 0)) {
      found = 1
      break
    }
    if (targetX > curX) {
      break
    }
    pPrev = pCur
    pCur = m.u32((pCur + 0x14) >>> 0) >>> 0
  }

  if (bAlloc === 0) {
    return found !== 0 ? pCur : 0
  }
  if (found !== 0) {
    return pCur
  }

  const pNew = m.alloc(0x18) >>> 0
  m.setU32(pNew, targetX >>> 0)
  m.setU32((pNew + 0x04) >>> 0, targetY >>> 0)
  m.setU32((pNew + 0x08) >>> 0, 0)
  m.setU32((pNew + 0x0c) >>> 0, 0)
  m.setU32((pNew + 0x10) >>> 0, 0)
  m.setU32((pNew + 0x14) >>> 0, pCur)
  if (pPrev !== 0) {
    m.setU32((pPrev + 0x14) >>> 0, pNew)
  } else {
    m.setU32(headAddr, pNew)
  }
  return pNew
}

interface PendingStep4Restore113c {
  readonly memRef: Memory113c
  readonly pRoom: number
  readonly preStep4Head: number
  readonly relocated: readonly number[]
  readonly freshCount: number
}

let stagedStep4MemRef113c: Memory113c | null = null
let stagedStep4Room113c = 0
let stagedStep4Relocated113c: number[] = []
let stagedStep4FreshCount113c = 0
const pendingStep4Restores113c: PendingStep4Restore113c[] = []

function flushPendingRestoredRoomUnits113c(m: Memory113c): void {
  if (pendingStep4Restores113c.length === 0) return
  while (pendingStep4Restores113c.length > 0) {
    const entry = pendingStep4Restores113c.shift()!
    if (entry.memRef !== m) continue
    if (!isByteKnownInMem113c(m, (entry.pRoom + 0x74) >>> 0)) continue
    const added: number[] = []
    let cur = m.u32((entry.pRoom + 0x74) >>> 0) >>> 0
    let guard = 0
    while (cur !== 0 && cur !== entry.preStep4Head && guard < 512) {
      if (!isByteKnownInMem113c(m, (cur + 0xe8) >>> 0)) break
      added.push(cur)
      cur = m.u32((cur + 0xe8) >>> 0) >>> 0
      guard++
    }
    const maxStep4 = entry.relocated.length + entry.freshCount
    const startIdx = added.length > maxStep4 ? added.length - maxStep4 : 0
    for (let i = startIdx; i < added.length; i++) {
      const u = added[i]!
      let isRelocated = false
      for (let j = 0; j < entry.relocated.length; j++) {
        if (entry.relocated[j] === u) {
          isRelocated = true
          break
        }
      }
      if (!isRelocated && isByteKnownInMem113c(m, (u + 0xc4) >>> 0)) {
        m.setU32((u + 0xc4) >>> 0, (m.u32((u + 0xc4) >>> 0) | 0x03000000) >>> 0)
      }
    }
  }
}

/**
 * Unlinks the `0x18`-byte inactive room node for `pRoom` from `[pGame + nAct * 4 + 0xD8]`,
 * writes `*ppOutUnits = [pNode + 0x10]` and `*ppOutItems = [pNode + 0x08]`, and frees `pNode`.
 *
 * @va D2Game:0x6FC3EA40
 */
export function MONREG_UnlinkAndFreeActRoomNode113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  ppOutUnits: number,
  ppOutItems: number,
): void {
  hitD2GameVa113c(0x6FC3EA40)
  flushPendingRestoredRoomUnits113c(m)
  stagedStep4MemRef113c = null
  stagedStep4Room113c = 0
  stagedStep4FreshCount113c = 0
  stagedStep4Relocated113c = []
  if (ppOutUnits !== 0) m.setU32(ppOutUnits >>> 0, 0)
  if (ppOutItems !== 0) m.setU32(ppOutItems >>> 0, 0)
  if (pRoom === 0 || pGame === 0) return

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (nAct >= 5) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x20) >>> 0
  let roomX = 0
  let roomY = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    roomX = m.u32(sp) | 0
    roomY = m.u32((sp + 0x04) >>> 0) | 0
  } finally {
    bootInitGapStackPtr = sp
  }

  const headAddr = (pGame + nAct * 4 + 0xd8) >>> 0
  let pPrev = 0
  let pCur = m.u32(headAddr) >>> 0
  while (pCur !== 0) {
    const curX = m.u32(pCur) | 0
    if (roomX > curX) return
    if (roomX === curX && roomY === (m.u32((pCur + 0x04) >>> 0) | 0)) {
      const pNext = m.u32((pCur + 0x14) >>> 0) >>> 0
      if (pPrev !== 0) {
        m.setU32((pPrev + 0x14) >>> 0, pNext)
      } else {
        m.setU32(headAddr, pNext)
      }
      const pSavedUnits = m.u32((pCur + 0x10) >>> 0) >>> 0
      if (ppOutUnits !== 0) {
        m.setU32(ppOutUnits >>> 0, pSavedUnits)
      }
      if (ppOutItems !== 0) {
        m.setU32(ppOutItems >>> 0, m.u32((pCur + 0x08) >>> 0) >>> 0)
      }
      if (pSavedUnits !== 0) {
        const relocated: number[] = []
        let freshCount = 0
        let pSU = pSavedUnits
        let suGuard = 0
        while (pSU !== 0 && suGuard < 512) {
          const uType = m.u32((pSU + 0x08) >>> 0) >>> 0
          const flags1C = m.u32((pSU + 0x1c) >>> 0) >>> 0
          if ((flags1C & 0x0100) !== 0) {
            const dwGuid = m.u32((pSU + 0x20) >>> 0) >>> 0
            const pEx = SUNIT_GetServerUnit113c(m, pGame, uType, dwGuid) >>> 0
            if (pEx !== 0 && UNITS_GetRoom113c(m, pEx) >>> 0 !== (pRoom >>> 0)) {
              relocated.push(pEx)
            }
          } else if (uType !== 1) {
            freshCount++
          }
          pSU = m.u32((pSU + 0x30) >>> 0) >>> 0
          suGuard++
        }
        if (freshCount > 0) {
          stagedStep4MemRef113c = m
          stagedStep4Room113c = pRoom >>> 0
          stagedStep4Relocated113c = relocated
          stagedStep4FreshCount113c = freshCount
        }
      }
      fogFreeMemPool113c(m, pCur)
      return
    }
    pPrev = pCur
    pCur = m.u32((pCur + 0x14) >>> 0) >>> 0
  }
}

/**
 * Walks saved ground-item nodes starting at `pSavedItems` (next at `+0x00`), restores non-expired
 * items (`dwExpireFrame == 0 || dwGameFrame <= dwExpireFrame`) into `pRoom`, and frees each node.
 *
 * @va D2Game:0x6FC3FB40
 */
export function MONREG_FlushAndFreePendingSpawnNodes113c(
  m: Memory113c,
  pSavedItems: number,
  pGame: number,
  pRoom: number,
): void {
  hitD2GameVa113c(0x6FC3FB40)
  const commitStagedStep4 = (): void => {
    if (
      pRoom !== 0 &&
      stagedStep4MemRef113c === m &&
      stagedStep4Room113c === (pRoom >>> 0) &&
      stagedStep4FreshCount113c > 0
    ) {
      pendingStep4Restores113c.push({
        memRef: m,
        pRoom: pRoom >>> 0,
        preStep4Head: m.u32((pRoom + 0x74) >>> 0) >>> 0,
        relocated: stagedStep4Relocated113c,
        freshCount: stagedStep4FreshCount113c,
      })
      stagedStep4MemRef113c = null
      stagedStep4Room113c = 0
      stagedStep4FreshCount113c = 0
      stagedStep4Relocated113c = []
    }
  }
  if (pSavedItems === 0) {
    commitStagedStep4()
    return
  }
  const curGameFrame = pGame !== 0 ? (m.u32((pGame + 0xa8) >>> 0) | 0) : 0
  let pCur = pSavedItems >>> 0
  while (pCur !== 0) {
    const pNext = m.u32(pCur) >>> 0
    const dwExpireFrame = m.u32((pCur + 0x04) >>> 0) | 0
    if (dwExpireFrame === 0 || curGameFrame <= dwExpireFrame) {
      // Real D2Game saved item nodes carry byte length at +0x0C and 'JM' (0x4D4A) header at +0x0E;
      // legacy synthetic K2 nodes store (itemGuid at +0x08, itemX at +0x0C, itemY at +0x0E).
      if (m.u16((pCur + 0x0c) >>> 0) >= 6 && m.u16((pCur + 0x0e) >>> 0) === 0x4d4a) {
        ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c(
          m as SparseMemory113c,
          pGame,
          pRoom,
          pCur,
        )
      } else {
        const savedItemGuid = m.u32((pCur + 0x08) >>> 0) >>> 0
        if (savedItemGuid !== 0 && pGame !== 0 && pRoom !== 0) {
          const pItem = SUNIT_GetServerUnit113c(m, pGame, 4, savedItemGuid) >>> 0
          if (pItem !== 0) {
            const itemX = m.u16((pCur + 0x0c) >>> 0)
            const itemY = m.u16((pCur + 0x0e) >>> 0)
            relocateRestoredServerUnit113c(m, pGame, pItem, pRoom, itemX, itemY)
          }
        }
      }
    }
    fogFreeMemPool113c(m, pCur)
    pCur = pNext
  }
  commitStagedStep4()
}

/**
 * Restores saved `0x5C`-byte monster nodes from `[pRoomNode + 0x0C]` for `(pGame, pRoom)` (`0x6FC3FB90`),
 * querying `MONREG_FindOrAllocActRoomNode113c(m, pGame, nAct, roomX, roomY, 0)` and checking Chaos Sanctuary seals.
 *
 * @va D2Game:0x6FC3FB90
 */
export function MONREG_RestoreRoomMonstersFromNode113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC3FB90)
  flushPendingRestoredRoomUnits113c(m)
  if (pGame === 0 || pRoom === 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    const roomX = m.u32(sp) | 0
    const roomY = m.u32((sp + 0x04) >>> 0) | 0
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
    const pRoomNode = MONREG_FindOrAllocActRoomNode113c(m, pGame, nAct, roomX, roomY, 0)
    if (pRoomNode === 0) return

    let pMon = m.u32((pRoomNode + 0x0c) >>> 0) >>> 0
    let bChaosSealsCleared = 0
    if (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) === 0x6c) {
      if (QUEST_Act4DiabloSealCheck113c(m, pGame) !== 0) {
        bChaosSealsCleared = 1
      }
    }
    if (pMon === 0) return

    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    const hooks = callees !== undefined && callees.regpop !== undefined ? callees.regpop : {}
    while (pMon !== 0) {
      const pNext = m.u32((pMon + 0x58) >>> 0) >>> 0
      const posX = m.u32(pMon) | 0
      const posY = m.u32((pMon + 0x04) >>> 0) | 0
      const nClassId = m.u32((pMon + 0x08) >>> 0) | 0
      const dwSavedGuid = m.u32((pMon + 0x0c) >>> 0) >>> 0
      const dwFlags10 = m.u32((pMon + 0x10) >>> 0) >>> 0
      const dwFlags14 = m.u32((pMon + 0x14) >>> 0) >>> 0
      const dwFlags18 = m.u32((pMon + 0x18) >>> 0) >>> 0
      const nAnimMode = (dwFlags18 & 0x04) !== 0 ? 0x0c : 1

      if (nAnimMode !== 0x0c && bChaosSealsCleared !== 0 && nClassId !== 0xf3) {
        const pSaveBlockSkip = m.u32((pMon + 0x24) >>> 0) >>> 0
        if (pSaveBlockSkip !== 0) {
          DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, (pMon + 0x24) >>> 0)
        }
        fogFreeMemPool113c(m, pMon)
        pMon = pNext
        continue
      }

      if ((dwFlags14 & 0x0100) !== 0) {
        const pExisting = SUNIT_GetServerUnit113c(m, pGame, 1, dwSavedGuid) >>> 0
        if (pExisting !== 0) {
          SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c(
            m as SparseMemory113c,
            posY,
            pRoom,
            pExisting,
            pGame,
            posX,
          )
        }
        let pExtra = m.u32((pMon + 0x20) >>> 0) >>> 0
        while (pExtra !== 0) {
          const pExtraNext = m.u32((pExtra + 0x04) >>> 0) >>> 0
          fogFreeMemPool113c(m, pExtra)
          pExtra = pExtraNext
        }
      } else {
        const skipBoss =
          (dwFlags18 & 0x0400) !== 0 && ((dwFlags18 & 0x0100) !== 0 || (dwFlags18 & 0x80) !== 0)
        if (!skipBoss) {
          let wSpawnFlags = (dwFlags18 & 0x40) !== 0 ? 0x6a : 0x62
          const pMonStatsTxtRestore = DATATBLS_GetMonStatsTxtRecordInline113c(m, nClassId)
          if (
            pMonStatsTxtRestore !== 0 &&
            (m.u8((pMonStatsTxtRestore + 0x0d) >>> 0) & 0x40) !== 0
          ) {
            wSpawnFlags |= 0x80
          }
          const dwSavedGuid = m.u32((pMon + 0x0c) >>> 0) >>> 0
          let pSpawned = MONSTER_SpawnAtCoords_6FD0F450_113c(
            m,
            dwSavedGuid,
            nClassId,
            nAnimMode,
            pGame,
            pRoom,
            posX,
            posY,
            -1,
            wSpawnFlags,
            hooks,
          )
          if (pSpawned === 0) {
            pSpawned = MONSTER_SpawnAtCoords_6FD0F450_113c(
              m,
              dwSavedGuid,
              nClassId,
              nAnimMode,
              pGame,
              pRoom,
              posX,
              posY,
              5,
              wSpawnFlags,
              hooks,
            )
          }
          let nAlignment = 0
          if ((dwFlags18 & 0x0100) !== 0) nAlignment = 2
          if ((dwFlags18 & 0x80) !== 0) nAlignment = 1
          if (pSpawned !== 0) {
            AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(
              m,
              pGame,
              pSpawned,
              m.u32((pMon + 0x1c) >>> 0) >>> 0,
              1,
              dwFlags18 & 0x08,
              dwFlags18 & 0x10,
              m.u32((pMon + 0x20) >>> 0) >>> 0,
            )
            const savedExp = m.u32((pMon + 0x40) >>> 0) | 0
            const savedMaxHp = m.u32((pMon + 0x44) >>> 0) | 0
            const savedCurHp = m.u32((pMon + 0x48) >>> 0) | 0
            const savedFrame = m.u32((pMon + 0x54) >>> 0) >>> 0
            const curGameFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
            STATLIST_SetUnitStat113c(m, pSpawned, 0x0d, savedExp, 0)
            const restoredHp =
              ((curGameFrame - savedFrame) >>> 0) >= 0x1d4c ? savedMaxHp : savedCurHp
            STATLIST_SetUnitStat113c(m, pSpawned, 0x07, savedMaxHp, 0)
            STATLIST_SetUnitStat113c(m, pSpawned, 0x06, restoredHp, 0)
            const pMonData0 =
              m.u32(pSpawned >>> 0) === 1 ? (m.u32((pSpawned + 0x14) >>> 0) >>> 0) : 0
            const pAiGen0 = pMonData0 !== 0 ? (m.u32((pMonData0 + 0x28) >>> 0) >>> 0) : 0
            AI_InitMonsterAiThinkFn113c(
              m,
              pSpawned,
              pGame,
              pAiGen0,
              m.u32((pMon + 0x28) >>> 0) | 0,
            )
            MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c(
              m as SparseMemory113c,
              pSpawned,
              pGame,
              pMon,
            )
            if ((dwFlags18 & 0x0400) !== 0) {
              if (nAlignment === 2) {
                SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(
                  m as SparseMemory113c,
                  pGame,
                  8,
                  pSpawned,
                  0,
                )
              } else if (nAlignment === 1) {
                SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(
                  m as SparseMemory113c,
                  pGame,
                  9,
                  pSpawned,
                  0,
                )
              }
            }
            if (m.u32(pSpawned >>> 0) === 1) {
              const pMonData = m.u32((pSpawned + 0x14) >>> 0) >>> 0
              if (pMonData !== 0) {
                for (let k = 0; k < 9; k++) {
                  const savedMod = m.u8((pMon + 0x32 + k) >>> 0)
                  if (m.u8((pMonData + 0x1c + k) >>> 0) !== savedMod) {
                    MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(
                      m,
                      pSpawned,
                      savedMod,
                      pGame,
                      0,
                    )
                  }
                }
              }
            }
            SUNIT_SetMonsterAlignmentState113c(m, pSpawned, nAlignment, 1)
            if ((dwFlags14 & 0x0200) !== 0) {
              m.setU32((pSpawned + 0xc8) >>> 0, (m.u32((pSpawned + 0xc8) >>> 0) | 0x0200) >>> 0)
            }
            const curUnitFlags = m.u32((pSpawned + 0xc4) >>> 0) >>> 0
            m.setU32(
              (pSpawned + 0xc4) >>> 0,
              (curUnitFlags | (dwFlags10 & 0x20000) | 0x03000000) >>> 0,
            )
          } else {
            AIGENERAL_FreeMinionList_6FC40B30_113c(
              m,
              pGame,
              m.u32((pMon + 0x20) >>> 0) >>> 0,
            )
          }
        }
      }

      const pSaveDesc = m.u32((pMon + 0x24) >>> 0) >>> 0
      if (pSaveDesc !== 0) {
        DRLGPRESET_FreeSaveHeaderBlock113c(m, pMemPool, (pMon + 0x24) >>> 0)
      }
      fogFreeMemPool113c(m, pMon)
      pMon = pNext
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Pops all queued AI commands on `pMonster->pMonsterData->pAiGeneral`.
 *
 * @va D2Game:0x6FC41420
 */
export function AIGENERAL_FlushAllAiCommands113c(
  m: Memory113c,
  _pGame: number,
  pMonster: number,
): void {
  hitD2GameVa113c(0x6FC41420)
  if (pMonster === 0) return
  if (m.u32(pMonster >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGeneral === 0) return
  while (m.u32((pAiGeneral + 0x24) >>> 0) !== 0 && m.u32((pAiGeneral + 0x20) >>> 0) !== 0) {
    AIGENERAL_PopAiCommand113c(m, pMonster)
  }
}

/**
 * `D2Game.dll` `.data` `0x6FD2F448`: `uint32[44][6]` `MonUMod` event callback table
 * (`uModId * 6 + slot`).
 */
export const MONUMOD_CALLBACK_TABLE_6FD2F448: readonly number[] = [
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x6fc44250, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41bb0, 0x6fc466b0, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc46230, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x6fc418a0, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc43bf0, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41ad0, 0x6fc46320, 0x00000000, 0x6fc468c0, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc462d0, 0x00000000, 0x00000000, 0x00000000,
  0x6fc41b30, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fc43670,
  0x00000000, 0x6fc41b00, 0x6fc460d0, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x6fc43440, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc45e60, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x6fc45cc0, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x6fc44440, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x6fc42b60, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fc43650,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fc45ad0,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc465e0, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc44300, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc43390, 0x6fc457d0, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc43570, 0x6fc43e20, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a70, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc42b10, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x00000000, 0x6fc43320, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc41a90, 0x6fc46520, 0x00000000, 0x00000000, 0x00000000,
  0x00000000, 0x6fc36970, 0x6fc39bb0, 0x6fc39ba0, 0x6fc39ad0, 0x6fc39a00,
]

function dispatchMonUModCallback113c(
  m: Memory113c,
  pfn: number,
  pGame: number,
  pEdxUnit: number,
  uModId: number,
  isUnique: number,
): void {
  const sm = m as SparseMemory113c
  switch (pfn >>> 0) {
    case 0x6fc36970:
      AI_MapAiAction1_WalkToWaypoint113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc39a00:
      AI_MapAiAction5_WalkAndMode9_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc39ad0:
      AI_MapAiAction4_WalkAndMode8_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc39ba0:
      AI_MapAiAction3_WalkToWaypoint113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc39bb0:
      AI_MapAiAction2_WalkAndWait20_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc418a0:
      MONUMOD_ApplyChampionBaseStats_6FC418A0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41a70:
      MONUMOD_SetShatterOnDeath_6FC41A70_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41a90:
      MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41ad0:
      MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41b00:
      MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41b30:
      MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc41bb0:
      MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc42b10:
      MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc42b60:
      MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43320:
      MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43390:
      MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43440:
      MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43570:
      MONUMOD_RollSelfResurrectEvent7_6FC43570_113c(m, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43650:
      MONUMOD_SpectralHitMissileDamage_6FC43650_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43670:
      MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c(
        m,
        pGame,
        pEdxUnit,
        uModId,
        isUnique,
      )
      break
    case 0x6fc43bf0:
      MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc43e20:
      MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc44250:
      MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc44300:
      MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc44440:
      MONUMOD_KnockBeltPotionToGround_6FC44440_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc457d0:
      MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc45ad0:
      MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc45cc0:
      MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc45e60:
      MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc460d0:
      MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc46230:
      MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc462d0:
      MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc46320:
      MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(sm, pGame, pEdxUnit)
      break
    case 0x6fc46520:
      MONUMOD_SpawnDeathNova_6FC46520_113c(sm, pGame, pEdxUnit, 0, uModId, isUnique)
      break
    case 0x6fc465e0:
      MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    case 0x6fc466b0:
      MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c(
        sm,
        pGame,
        pEdxUnit,
        uModId,
        isUnique,
      )
      break
    case 0x6fc468c0:
      MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c(sm, pGame, pEdxUnit, uModId, isUnique)
      break
    default:
      break
  }
}

/**
 * Walks `pUnit->pMonsterData->nMonUMod[0..8]` (`+0x1C`) and dispatches the `MonUMod` event
 * callback at `0x6FD2F448[uModId][nSlot]` (`ecx = pGame`, `edx = pUnit` or `pArg0` when `nSlot == 5`).
 *
 * @va D2Game:0x6FC468E0
 */
export function MONSTER_DispatchMinionComponentCallbacks113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  arg0OrSlot: number,
  slotOrCallees?: number | BootInitGapACallees113c,
  calleesArg?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC468E0)
  let pMonster = pUnit >>> 0
  let pArg0 = 0
  let slot = 0
  let callees: BootInitGapACallees113c | undefined

  if (typeof slotOrCallees === 'number') {
    pArg0 = arg0OrSlot >>> 0
    slot = slotOrCallees | 0
    callees = calleesArg
  } else {
    slot = arg0OrSlot | 0
    callees = slotOrCallees
    if (slot === 5 && pMonster !== 0 && m.u32(pMonster) === 3) {
      pArg0 = pMonster
      if ((m.u32((pArg0 + 0xc8) >>> 0) & 0x400) !== 0) {
        pMonster = SUNIT_GetServerUnit113c(
          m,
          pGame,
          m.u32((pArg0 + 0x94) >>> 0) | 0,
          m.u32((pArg0 + 0x98) >>> 0) | 0,
        ) >>> 0
      } else {
        pMonster = 0
      }
    }
  }

  let isUnique = 0
  if (pMonster !== 0 && m.u32(pMonster) === 1) {
    const pmd0 = m.u32((pMonster + 0x14) >>> 0) >>> 0
    if (pmd0 !== 0) {
      isUnique = (m.u8((pmd0 + 0x16) >>> 0) >>> 3) & 1
    }
  }
  if (pMonster === 0 || m.u32(pMonster) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pUMods = (pMonData + 0x1c) >>> 0
  if (pUMods === 0 || m.u8(pUMods) === 0) return

  if (slot === 5) {
    for (let i = 0; i < 9; i++) {
      const uModId = m.u8((pUMods + i) >>> 0)
      const tblIdx = imul32(uModId, 6) + 5
      const pfn =
        tblIdx >= 0 && tblIdx < MONUMOD_CALLBACK_TABLE_6FD2F448.length
          ? MONUMOD_CALLBACK_TABLE_6FD2F448[tblIdx]! >>> 0
          : 0
      if (pfn !== 0) {
        if (callees !== undefined && callees.onComponentCallback !== undefined) {
          callees.onComponentCallback(m, pfn, pGame, pArg0, uModId, isUnique)
        } else {
          dispatchMonUModCallback113c(m, pfn, pGame, pArg0, uModId, isUnique)
        }
      }
    }
    return
  }

  if (slot < 0 || slot >= 6) return
  for (let i = 0; i < 9; i++) {
    const uModId = m.u8((pUMods + i) >>> 0)
    const tblIdx = imul32(uModId, 6) + slot
    const pfn =
      tblIdx >= 0 && tblIdx < MONUMOD_CALLBACK_TABLE_6FD2F448.length
        ? MONUMOD_CALLBACK_TABLE_6FD2F448[tblIdx]! >>> 0
        : 0
    if (pfn !== 0) {
      if (callees !== undefined && callees.onComponentCallback !== undefined) {
        callees.onComponentCallback(m, pfn, pGame, pMonster, uModId, isUnique)
      } else {
        dispatchMonUModCallback113c(m, pfn, pGame, pMonster, uModId, isUnique)
      }
    }
  }
}

/**
 * Walks `pGame->pClientList` (`+0x88` along `+0x4A8`) and invokes `callback` for every client with `dwClientState == 4`.
 *
 * @va D2Game:0x6FC49820
 */
export function CLIENTS_ForEachInGameClient113c(
  m: Memory113c,
  pGame: number,
  pfnCallback: number,
  pContext: number,
  callback?: (m: Memory113c, pClient: number, pContext: number) => void,
): void {
  hitD2GameVa113c(0x6FC49820)
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x1525)
  }
  if (pfnCallback === 0 && callback === undefined) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x1526)
  }
  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    if (m.u32((pClient + 0x04) >>> 0) === 4) {
      if (callback !== undefined) {
        callback(m, pClient, pContext)
      }
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
  }
}

/**
 * Updates `pGame` tick rate metrics (`+0xB4` prev tick, `+0xB0` frame counter, `+0xAC` rate,
 * `0x6FD2E360` global rate) and mempool usage tracking (`0x6FD31C34`, `0x6FD31F88`).
 *
 * @va D2Game:0x6FC49BE0
 */
export function GAME_UpdateTickRateMetrics113c(
  m: Memory113c,
  pGame: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC49BE0)
  const game = pGame >>> 0
  if (callees === undefined && game !== 0 && isByteKnownInMem113c(m, (game + 0x10f4) >>> 0)) {
    armDeferSliceQuestTimers113c(m, game)
  }
  const dwTickMs =
    callees !== undefined && callees.getTickCountMs !== undefined
      ? callees.getTickCountMs(m) >>> 0
      : m.u32((game + 0xb4) >>> 0) >>> 0
  const prevTick = m.u32((game + 0xb4) >>> 0) >>> 0
  const deltaMs = (dwTickMs - prevTick) >>> 0
  if (deltaMs >= 0x3e8) {
    const frames = m.u32((game + 0xb0) >>> 0) >>> 0
    const rate = Math.floor((frames * 1000) / deltaMs) >>> 0
    const pMemPool = m.u32((game + 0x1c) >>> 0) >>> 0
    m.setU32((game + 0xb0) >>> 0, 0)
    m.setU32((game + 0xb4) >>> 0, dwTickMs)
    m.setU32((game + 0xac) >>> 0, rate)
    m.setU32(D2GAME_TICKS_PER_SECOND_VA_113C, rate)
    const poolUsage =
      callees !== undefined && callees.getPoolUsageKB !== undefined
        ? callees.getPoolUsageKB(m, pMemPool) >>> 0
        : 0
    let lastResetTick = 0
    try {
      lastResetTick = m.u32(D2GAME_PEAK_MEMPOOL_TICK_VA_113C) >>> 0
    } catch {
      lastResetTick = 0
    }
    let peakPool = 0
    try {
      peakPool = m.u32(D2GAME_PEAK_MEMPOOL_KB_VA_113C) >>> 0
    } catch {
      peakPool = 0
    }
    if (((dwTickMs - lastResetTick) >>> 0) > 0x2710) {
      m.setU32(D2GAME_PEAK_MEMPOOL_KB_VA_113C, poolUsage)
      m.setU32(D2GAME_PEAK_MEMPOOL_TICK_VA_113C, dwTickMs)
      m.setU32((game + 0xb0) >>> 0, (m.u32((game + 0xb0) >>> 0) + 1) >>> 0)
      return
    }
    if (poolUsage > peakPool) {
      m.setU32(D2GAME_PEAK_MEMPOOL_KB_VA_113C, poolUsage)
    }
  }
  m.setU32((game + 0xb0) >>> 0, (m.u32((game + 0xb0) >>> 0) + 1) >>> 0)
}

/**
 * Every 128 frames (`(dwGameFrame & 0x7F) == 0`), expires ground items and minion lists in act `(dwGameFrame >> 7) % 5`.
 *
 * @va D2Game:0x6FC4C0F0
 */
export function GAME_ExpireItemsAndMinionListsPeriodic113c(
  m: Memory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC4C0F0)
  const dwFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  if (dwFrame % 1500 === 0) {
    for (let nAct = 0; nAct < 5; nAct++) {
      ITEMS_ExpireGroundItemsInAct113c(m, pGame, nAct)
      AIGENERAL_ExpireMinionListsInAct113c(m, pGame, nAct)
    }
  }
}

/**
 * Broadcasts `0x5B` player-in-game packets and corpse sync between `pNewClient` and all existing state-4 clients.
 *
 * @va D2Game:0x6FC4C120
 */
export function GAME_SyncNewClientWithExistingPlayers113c(
  m: Memory113c,
  pGame: number,
  pNewClient: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC4C120)
  if (pNewClient === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xfb)
  }
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x60) >>> 0
  const pktNew = sp
  const pktOther = (sp + 0x28) >>> 0
  const pkt8E = (sp + 0x50) >>> 0
  try {
    if (callees === undefined) {
      let pNewUnit = 0
      if ((m.u8((pNewClient + 0x3d4) >>> 0) & 1) !== 0) {
        pNewUnit = m.u32((pNewClient + 0x174) >>> 0) >>> 0
      } else if (m.u32((pNewClient + 0x174) >>> 0) !== 0) {
        pNewUnit =
          SUNIT_GetServerUnit113c(
            m,
            m.u32((pNewClient + 0x1a8) >>> 0) >>> 0,
            m.u32((pNewClient + 0x16c) >>> 0) >>> 0,
            m.u32((pNewClient + 0x170) >>> 0) >>> 0,
          ) >>> 0
        if (pNewUnit === 0) {
          m.setU32((pNewClient + 0x174) >>> 0, 0)
        }
      }
      if (pNewUnit === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x56a)
      }
      let pOther = m.u32((pGame + 0x88) >>> 0) >>> 0
      while (pOther !== 0) {
        if (pOther !== (pNewClient >>> 0)) {
          let pOtherUnit = 0
          if ((m.u8((pOther + 0x3d4) >>> 0) & 1) !== 0) {
            pOtherUnit = m.u32((pOther + 0x174) >>> 0) >>> 0
          } else if (m.u32((pOther + 0x174) >>> 0) !== 0) {
            pOtherUnit =
              SUNIT_GetServerUnit113c(
                m,
                m.u32((pOther + 0x1a8) >>> 0) >>> 0,
                m.u32((pOther + 0x16c) >>> 0) >>> 0,
                m.u32((pOther + 0x170) >>> 0) >>> 0,
              ) >>> 0
            if (pOtherUnit === 0) {
              m.setU32((pOther + 0x174) >>> 0, 0)
            }
          }
          if (pOtherUnit !== 0) {
            D2GAME_PACKET_Send0x5BPlayerInGame113c(m, pOtherUnit, pOther, pNewClient)
            D2GAME_PACKET_Send0x5BPlayerInGame113c(m, pNewUnit, pNewClient, pOther)
            const pInv = m.u32((pOtherUnit + 0x60) >>> 0) >>> 0
            if (pInv !== 0) {
              let pCorpse = INVENTORY_GetFirstCorpse113c(m, pInv) >>> 0
              while (pCorpse !== 0) {
                const dwCorpseUnitId = INVENTORY_GetCorpseUnitId113c(m, pCorpse) | 0
                if (dwCorpseUnitId !== -1) {
                  m.setU8(pkt8E, 0x8e)
                  m.setU8((pkt8E + 1) >>> 0, 0x01)
                  m.setU32((pkt8E + 2) >>> 0, m.u32((pOtherUnit + 0x0c) >>> 0) >>> 0)
                  m.setU32((pkt8E + 6) >>> 0, dwCorpseUnitId >>> 0)
                  NET_QueuePacketToClientBuffer113c(m, pNewClient, 1, pkt8E, 0x0a)
                }
                pCorpse = INVENTORY_GetNextCorpse113c(m, pCorpse) >>> 0
              }
            }
          }
        }
        pOther = m.u32((pOther + 0x4a8) >>> 0) >>> 0
      }
      D2GAME_PACKET_Send0x5BPlayerInGame113c(m, pNewUnit, pNewClient, pNewClient)
      D2GAME_ARENA_SyncClientKillCountsOnJoin113c(m, pGame, pNewClient)
      return
    }

    m.fill(pktNew, 0x24, 0)
    const pNewUnit = m.u32((pNewClient + 0x174) >>> 0) >>> 0
    m.setU8(pktNew, 0x5b)
    m.setU16((pktNew + 1) >>> 0, 0x24)
    m.setU32((pktNew + 3) >>> 0, pNewUnit !== 0 ? m.u32((pNewUnit + 0x0c) >>> 0) : 0)
    m.setU8((pktNew + 7) >>> 0, m.u8((pNewClient + 0x0c) >>> 0))
    stormStrCopy113c(m, (pktNew + 8) >>> 0, (pNewClient + 0x0d) >>> 0, 0x10)
    const newLvl = pNewUnit !== 0 ? STATLIST_GetUnitStat113c(m, pNewUnit, 0x0c, 0) & 0xffff : 0
    m.setU16((pktNew + 0x18) >>> 0, newLvl)
    const newPartyId =
      callees.getClientPartyId !== undefined && pNewUnit !== 0
        ? callees.getClientPartyId(m, pNewUnit) & 0xffff
        : 0xffff
    m.setU16((pktNew + 0x1a) >>> 0, newPartyId)
    m.setU32((pktNew + 0x1c) >>> 0, 0)
    m.setU32((pktNew + 0x20) >>> 0, 0)

    let pOther = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pOther !== 0) {
      if (pOther !== (pNewClient >>> 0) && m.u32((pOther + 0x04) >>> 0) === 4) {
        NET_QueuePacketToClientBuffer113c(m, pOther, 1, pktNew, 0x24)

        const pOtherUnit = m.u32((pOther + 0x174) >>> 0) >>> 0
        m.fill(pktOther, 0x24, 0)
        m.setU8(pktOther, 0x5b)
        m.setU16((pktOther + 1) >>> 0, 0x24)
        m.setU32((pktOther + 3) >>> 0, pOtherUnit !== 0 ? m.u32((pOtherUnit + 0x0c) >>> 0) : 0)
        m.setU8((pktOther + 7) >>> 0, m.u8((pOther + 0x0c) >>> 0))
        stormStrCopy113c(m, (pktOther + 8) >>> 0, (pOther + 0x0d) >>> 0, 0x10)
        const otherLvl =
          pOtherUnit !== 0 ? STATLIST_GetUnitStat113c(m, pOtherUnit, 0x0c, 0) & 0xffff : 0
        m.setU16((pktOther + 0x18) >>> 0, otherLvl)
        const otherPartyId =
          callees.getClientPartyId !== undefined && pOtherUnit !== 0
            ? callees.getClientPartyId(m, pOtherUnit) & 0xffff
            : 0xffff
        m.setU16((pktOther + 0x1a) >>> 0, otherPartyId)
        m.setU32((pktOther + 0x1c) >>> 0, 0)
        m.setU32((pktOther + 0x20) >>> 0, 0)
        NET_QueuePacketToClientBuffer113c(m, pNewClient, 1, pktOther, 0x24)

        if (callees.syncPlayerPartyRelations !== undefined) {
          callees.syncPlayerPartyRelations(m, pGame, pNewClient, pOther)
        }

        if (pOtherUnit !== 0) {
          const pInv = m.u32((pOtherUnit + 0x60) >>> 0) >>> 0
          let pCorpse = INVENTORY_GetFirstCorpse113c(m, pInv) >>> 0
          while (pCorpse !== 0) {
            const dwCorpseUnitId = INVENTORY_GetCorpseUnitId113c(m, pCorpse)
            const pCorpseUnit = SUNIT_GetServerUnit113c(m, pGame, 0, dwCorpseUnitId)
            if (pCorpseUnit !== 0) {
              if (callees.sendCorpseSyncPacket !== undefined) {
                callees.sendCorpseSyncPacket(
                  m,
                  pNewClient,
                  m.u32((pOtherUnit + 0x0c) >>> 0),
                  m.u32((pCorpseUnit + 0x0c) >>> 0),
                )
              }
            }
            pCorpse = INVENTORY_GetNextCorpse113c(m, pCorpse) >>> 0
          }
        }
      }
      pOther = m.u32((pOther + 0x4a8) >>> 0) >>> 0
    }

    NET_QueuePacketToClientBuffer113c(m, pNewClient, 1, pktNew, 0x24)
    if (callees.onPostClientJoinSync !== undefined) {
      callees.onPostClientJoinSync(m, pGame, pNewClient, pNewUnit)
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Steps environment lighting cycles across all 5 acts and broadcasts `0x53` when any cycle or Act 2 eclipse state changes.
 *
 * @va D2Game:0x6FC4CA20
 */
export function GAME_StepActEnvironmentCycles113c(
  m: Memory113c,
  pGame: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC4CA20)
  if (pGame === 0) {
    throw new Error('GAME_StepActEnvironmentCycles113c: pGame == NULL (line 3058)')
  }
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pCycleIdx = sp
  const pTicks = (sp + 4) >>> 0
  const pEclipse = (sp + 8) >>> 0
  const pPkt53 = (sp + 0x10) >>> 0
  try {
    let bBroadcast53 = 0
    m.setU32(pCycleIdx, 0)
    m.setU32(pTicks, 0)
    m.setU32(pEclipse, 0)

    for (let nAct = 0; nAct < 5; nAct++) {
      const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
      if (pAct !== 0) {
        if (ENV_StepCycle113c(m, pAct, nAct) !== 0) {
          ENV_GetCycleState113c(m, pAct, pCycleIdx, pTicks, pEclipse)
          bBroadcast53 = 1
          if (m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) !== 0) {
            let pClAct = m.u32((pGame + 0x88) >>> 0) >>> 0
            while (pClAct !== 0) {
              let pPlrAct = 0
              if ((m.u8((pClAct + 0x3d4) >>> 0) & 1) !== 0) {
                pPlrAct = m.u32((pClAct + 0x174) >>> 0) >>> 0
              } else if (m.u32((pClAct + 0x174) >>> 0) !== 0) {
                pPlrAct = SUNIT_GetServerUnit113c(
                  m,
                  m.u32((pClAct + 0x1a8) >>> 0),
                  m.u32((pClAct + 0x16c) >>> 0) | 0,
                  m.u32((pClAct + 0x170) >>> 0) | 0,
                ) >>> 0
              }
              if (pPlrAct !== 0) {
                D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlrAct, 0)
                UNITS_SetUnitUpdateFlags113c(m, pPlrAct, 1)
              }
              pClAct = m.u32((pClAct + 0x4a8) >>> 0) >>> 0
            }
          }
        }
        if (nAct === 1) {
          ENV_GetCycleState113c(m, pAct, pCycleIdx, pTicks, pEclipse)
          const curEclipse = m.u32(pEclipse)
          const questEclipse =
            callees !== undefined && callees.checkAct2EclipseQuest !== undefined
              ? callees.checkAct2EclipseQuest(m, pGame) >>> 0
              : 0
          if (questEclipse !== curEclipse) {
            bBroadcast53 = 1
          }
        }
      }
    }

    if (bBroadcast53 !== 0) {
      const pAct0 = m.u32((pGame + 0xbc) >>> 0) >>> 0
      if (pAct0 !== 0) {
        ENV_GetCycleState113c(m, pAct0, pCycleIdx, pTicks, pEclipse)
      }
      let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
      while (pClient !== 0) {
        if (m.u32((pClient + 0x04) >>> 0) === 4) {
          let bClientEclipse = 0
          if (m.u8((pClient + 0x16d) >>> 0) === 1) {
            const questEclipse =
              callees !== undefined && callees.checkAct2EclipseQuest !== undefined
                ? callees.checkAct2EclipseQuest(m, pGame)
                : 0
            if (questEclipse !== 0) bClientEclipse = 1
          }
          m.setU8(pPkt53, 0x53)
          m.setU32((pPkt53 + 1) >>> 0, m.u32(pCycleIdx))
          m.setU32((pPkt53 + 5) >>> 0, m.u32(pTicks))
          m.setU8((pPkt53 + 9) >>> 0, bClientEclipse & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt53, 10)
        }
        pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Checks all clients in `pGame` for ping timeout (`> 35000` ms) or player timer timeout (`> 0x4E2` frames), and steps active players.
 *
 * @va D2Game:0x6FC4D670
 */
export function GAME_CheckAndDisconnectTimedOutClients113c(
  m: Memory113c,
  pGame: number,
  dwTickMs: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC4D670)
  if (callees === undefined && (dwTickMs >>> 0) >= 0x10000000) {
    if (m.u32(0x6fd2e34c) === 0) return
    const pbAnyOut = dwTickMs >>> 0
    m.setU32(pbAnyOut, 0)
    const dwTick = m.u32(0x6fd18d10) >>> 0
    let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pClient !== 0) {
      const pNext = m.u32((pClient + 0x4a8) >>> 0) >>> 0
      const dwLast = m.u32((pClient + 0x3d8) >>> 0) >>> 0
      if (dwTick > dwLast) {
        const delta = (dwTick - dwLast) >>> 0
        const hasFlag4 = (m.u8((pClient + 0x0a) >>> 0) & 4) !== 0
        const timedOut =
          (hasFlag4 && delta > 0x2710 && (m.u32((pClient + 0x500) >>> 0) >>> 0) > 10) ||
          delta > 0xafc8 ||
          m.u32((pClient + 0x504) >>> 0) !== 0
        if (timedOut && m.u32(0x6fd31c3c) !== 0) {
          let pUnit = 0
          if ((m.u8((pClient + 0x3d4) >>> 0) & 1) !== 0) {
            pUnit = m.u32((pClient + 0x174) >>> 0) >>> 0
          } else if (m.u32((pClient + 0x174) >>> 0) !== 0) {
            pUnit =
              SUNIT_GetServerUnit113c(
                m,
                m.u32((pClient + 0x1a8) >>> 0) >>> 0,
                m.u32((pClient + 0x16c) >>> 0) >>> 0,
                m.u32((pClient + 0x170) >>> 0) >>> 0,
              ) >>> 0
            if (pUnit === 0) {
              m.setU32((pClient + 0x174) >>> 0, 0)
            }
          }
          PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(
            m as SparseMemory113c,
            pGame,
            pUnit,
            (pClient + 0x0d) >>> 0,
            0,
          )
          m.setU32(pbAnyOut, 1)
          CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, pClient, pGame, 0)
        }
      }
      pClient = pNext
    }
    if (m.u32(pbAnyOut) !== 0) {
      PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c(m as SparseMemory113c, pGame)
    }
    return
  }

  let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
  while (pClient !== 0) {
    const pNext = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    const dwLastPing = m.u32((pClient + 0x484) >>> 0) >>> 0
    if (
      dwLastPing !== 0 &&
      ((dwTickMs - dwLastPing) | 0) > 35000 &&
      m.u32(D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C) === 0
    ) {
      if (callees !== undefined && callees.disconnectClient !== undefined) {
        callees.disconnectClient(m, pGame, pClient, 4)
      }
    } else if (m.u32((pClient + 0x04) >>> 0) === 4) {
      const pUnit = m.u32((pClient + 0x174) >>> 0) >>> 0
      if (pUnit === 0) {
        if (callees !== undefined && callees.disconnectClient !== undefined) {
          callees.disconnectClient(m, pGame, pClient, 4)
        }
      } else {
        if (callees !== undefined && callees.stepPlayerClientTick !== undefined) {
          callees.stepPlayerClientTick(m, pGame, pUnit, pClient)
        }
      }
    }
    pClient = pNext
  }
}

/**
 * Steps client join state machine (`dwClientState` 3, 4, 5 -> 4), checks client ping/timer timeouts,
 * saves active characters every 8192 frames, and broadcasts `0x5A` / `0x5B` join notifications.
 *
 * @va D2Game:0x6FC4D9B0
 */
export function GAME_StepClientJoinStatesAndTimeouts113c(
  m: Memory113c,
  pGame: number,
  dwTickMs = 0,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FC4D9B0)
  if (pGame === 0) return 0

  const dwGameFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const bPeriodicSave = dwGameFrame % 8192 === 0 ? 1 : 0

  const pArenaCtrl = m.u32((pGame + 0x1d28) >>> 0) >>> 0
  if (pArenaCtrl !== 0 && (m.u8((pArenaCtrl + 0x08) >>> 0) & 4) === 0) {
    throw new Error('GAME_StepClientJoinStatesAndTimeouts113c: (pArena->dwFlags & 4) == 0 (line 3295)')
  }

  let bAnyDisconnected = 0
  const wrappedCallees: BootInitGapACallees113c = {
    ...callees,
    disconnectClient(mem, pg, pc, reason) {
      bAnyDisconnected = 1
      if (callees !== undefined && callees.disconnectClient !== undefined) {
        callees.disconnectClient(mem, pg, pc, reason)
      }
    },
  }
  GAME_CheckAndDisconnectTimedOutClients113c(m, pGame, dwTickMs, wrappedCallees)
  if (bPeriodicSave !== 0 && bAnyDisconnected === 0) {
    PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c(m as SparseMemory113c, pGame)
  }

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x90) >>> 0
  const spPkt04 = sp
  const spPkt5A = (sp + 0x08) >>> 0
  const spAcct = (sp + 0x38) >>> 0
  try {
    let pClient = m.u32((pGame + 0x88) >>> 0) >>> 0
    while (pClient !== 0) {
      const pNext = m.u32((pClient + 0x4a8) >>> 0) >>> 0
      const dwState = m.u32((pClient + 0x04) >>> 0) | 0

      if (dwState === 5) {
        CLIENTS_UpdatePlayerRoom113c(m, pClient, pGame, callees?.clientRoomOpts)
        const pActRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
        if (pActRoom !== 0 && DUNGEON_AreAllAdjacentRoomsActive113c(m, pActRoom) !== 0) {
          m.setU8(spPkt04, 4)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, spPkt04, 1)
          m.setU32((pClient + 0x04) >>> 0, 4)
          const pUnit = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
          if (pUnit !== 0) {
            D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit, 1)
          }
        }
      } else if (dwState === 4) {
        CLIENTS_UpdatePlayerRoom113c(m, pClient, pGame, callees?.clientRoomOpts)
      } else if (dwState === 3) {
        CLIENTS_UpdatePlayerRoom113c(m, pClient, pGame, callees?.clientRoomOpts)
        const pActRoom = m.u32((pClient + 0x1b4) >>> 0) >>> 0
        const roomsReady =
          callees !== undefined && callees.stepJoinState3Ready !== undefined
            ? callees.stepJoinState3Ready(m, pGame, pClient, dwTickMs)
            : pActRoom !== 0
              ? DUNGEON_AreAllAdjacentRoomsActive113c(m, pActRoom)
              : 0
        if (roomsReady !== 0) {
          const pUnit0 = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
          if (pUnit0 !== 0) {
            m.setU8(spPkt04, 4)
            NET_QueuePacketToClientBuffer113c(m, pClient, 1, spPkt04, 1)
            m.setU32((pClient + 0x04) >>> 0, 4)
            const pUnit1 = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
            if (pUnit1 !== 0) {
              D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pUnit1, 1)
            }
            GAME_SyncNewClientWithExistingPlayers113c(m, pGame, pClient, callees)
            const pJoinUnit = m.u32((pClient + 0x174) >>> 0) >>> 0
            if (pJoinUnit === 0) {
              throw new Error('GAME_StepClientJoinStatesAndTimeouts113c: pUnit == NULL (line 335)')
            }
            D2GAME_SUNIT_IterateAllLivingPlayers113c(
              m,
              pGame,
              D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c,
              pJoinUnit,
            )

            let pCbTbl = 0
            try {
              pCbTbl = m.u32(0x6fd31c3c) >>> 0
            } catch {
              pCbTbl = 0
            }
            if (pCbTbl !== 0) {
              const pEnterUnit = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
              if (pEnterUnit !== 0) {
                const pfnEnterGame = m.u32((pCbTbl + 0x14) >>> 0) >>> 0
                if (pfnEnterGame !== 0) {
                  const dwClassId = m.u32((pEnterUnit + 0x04) >>> 0) >>> 0
                  const wFlag0A = m.u16((pClient + 0x0a) >>> 0) & 0xffff
                  const dwLevel = STATLIST_GetUnitStat113c(m, pEnterUnit, 0x0c, 0) | 0
                  const wGameId = m.u16((pGame + 0x28) >>> 0) & 0xffff
                  const szCharName = (pClient + 0x0d) >>> 0
                  if (callees !== undefined && callees.onEnterGame !== undefined) {
                    callees.onEnterGame(m, wGameId, szCharName, dwClassId, dwLevel, wFlag0A)
                  }
                }
              }
            }

            m.fill(spPkt5A, 0x28, 0)
            m.fill(spAcct, 0x34, 0)
            m.setU8(spPkt5A, 0x5a)
            m.setU8((spPkt5A + 1) >>> 0, 2)
            m.setU8((spPkt5A + 2) >>> 0, 4)
            const acctLen = stormStrCopy113c(m, spAcct, (pClient + 0x1d) >>> 0, 0x32)
            if (acctLen !== 0) {
              stormStrCopy113c(m, (spPkt5A + 0x18) >>> 0, spAcct, 0x10)
              m.setU8((spPkt5A + 0x27) >>> 0, 0)
            }
            stormStrCopy113c(m, (spPkt5A + 0x08) >>> 0, (pClient + 0x0d) >>> 0, 0x10)
            D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(m, spPkt5A, pGame)
          }
        }
      }
      pClient = pNext
    }
  } finally {
    bootInitGapStackPtr = sp
  }
  return 1
}

/**
 * Sets object animation mode to `2` via `D2Common.#11090` (`UNITS_ChangeAnimMode`).
 * Accepts either 1-arg `pObjEvtArgs` (`ecx`, `{+0x04: pObject}`) matching `D2Game.dll@0x6FC4E750`
 * or `(m, pGame, pObject)` compatibility call.
 *
 * @va D2Game:0x6FC4E750
 */
export function OBJECT_SetAnimMode2Wrapper113c(
  m: Memory113c,
  pGameOrArgs: number,
  pObject?: number,
  _pPlayer = 0,
  _bFlag = 0,
): number {
  hitD2GameVa113c(0x6FC4E750)
  const targetObj =
    pObject === undefined ? m.u32(((pGameOrArgs >>> 0) + 0x04) >>> 0) >>> 0 : pObject >>> 0
  return UNITS_ChangeAnimMode113c(m, targetObj, 2)
}

/**
 * Spawns a regular preset monster (`edi = nClassId`, `__stdcall(pGame, pRoom, x, y, nMode)`, `370B`):
 * 1. Validates `0 <= nClassId < nMonStatsCount` (`[sgptDataTables + 0xA80]`) and `pMonStatsTxt != 0`.
 * 2. Frozen Anya (`nClassId == 0x1B2`): decrements `y` and forces `nMode = 0x0C` when Quest `0x20` is intro.
 * 3. Rejects `MONSTATS2_CheckFlagBit113c(m, nClassId, 0x0D) != 0`.
 * 4. Computes `wFlags = (pMonStatsTxt[+0x0E] & 0x04) != 0 ? 8 : 0` and spawns via `0x6FD0F650`
 *    (`MONSTER_SpawnAtCoords113c`) at radius `-1`, retrying at radius `4` when `REGPOP_CanSpawnPresetMinionPack113c != 0`.
 * 5. When `MONSTATS2_CheckFlagBit113c(m, nClassId, 0x12) != 0`, allocates companion object `0x23B` (`0x1B0`)
 *    or `0x23C` (`0x1B1`) via `0x6FD01D90` (`SUNIT_AllocUnitData113c`).
 *
 * @va D2Game:0x6FC66F70
 */
export function MONSTER_SpawnPresetOrEvilUrn113c(
  m: Memory113c,
  nClassId: number,
  pGame: number,
  pRoom: number,
  x: number,
  y: number,
  nMode: number,
  spawnAtCoordsOverride?: (
    m: Memory113c,
    nClassId: number,
    nMode: number,
    pGame: number,
    pRoom: number,
    x: number,
    y: number,
    nMaxRadius: number,
    wFlags: number,
  ) => number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FC66F70)
  const cid = nClassId | 0
  if (cid < 0) return 0

  let pTables = 0
  try {
    const pIat = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    if (pIat !== 0) {
      pTables = m.u32(pIat) >>> 0
      if (pTables === 0) pTables = pIat
    }
  } catch {
    // Fall back to direct D2Common!sgptDataTables pointer if IAT page is unloaded in standalone tests.
  }
  if (pTables === 0) {
    try {
      pTables = m.u32(0x6fde9e1c) >>> 0
    } catch {
      pTables = 0
    }
  }
  if (pTables === 0) return 0

  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  if (cid >= nMonStatsCount) return 0
  const pMonStatsBase = m.u32((pTables + 0xa78) >>> 0) >>> 0
  const pMonStatsTxt = (pMonStatsBase + imul32(cid, 0x1a8)) >>> 0
  if (pMonStatsTxt === 0) return 0

  let spawnX = x | 0
  let spawnMode = nMode | 0
  if (cid === 0x1b2) {
    spawnX = (spawnX - 1) | 0
    if (pGame !== 0 && QUESTS_CheckNotIntro_6FC53970_113c(m, pGame, 0x20) === 0) {
      spawnMode = 0x0c
    }
  }

  if (MONSTATS2_CheckFlagBit113c(m, cid, 0x0d) !== 0) {
    return 0
  }

  let bitMask2 = 4
  try {
    const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
    if (pBitMasks !== 0) {
      const b = m.u8((pBitMasks + 8) >>> 0)
      if (b !== 0) bitMask2 = b
    }
  } catch {
    // Default bit 2 = 0x04 when gdwBitMasks IAT is unloaded.
  }
  const wFlags = (m.u8((pMonStatsTxt + 0x0e) >>> 0) & bitMask2) !== 0 ? 8 : 0

  const doSpawn =
    spawnAtCoordsOverride !== undefined
      ? spawnAtCoordsOverride
      : (
          mem: Memory113c,
          c: number,
          md: number,
          pg: number,
          pr: number,
          px: number,
          py: number,
          maxR: number,
          wf: number,
        ): number =>
          MONSTER_SpawnAtCoords113c(
            mem,
            c,
            md,
            pg,
            pr,
            px,
            py,
            maxR,
            wf,
            callees !== undefined ? callees.regpop : undefined,
          )

  let pUnit = doSpawn(m, cid, spawnMode, pGame, pRoom, spawnX, y | 0, -1, wFlags) >>> 0
  if (pUnit === 0) {
    if (REGPOP_CanSpawnPresetMinionPack113c(m, cid) === 0) {
      return 0
    }
    pUnit = doSpawn(m, cid, spawnMode, pGame, pRoom, spawnX, y | 0, 4, wFlags) >>> 0
    if (pUnit === 0) {
      return 0
    }
  }

  if (MONSTATS2_CheckFlagBit113c(m, cid, 0x12) !== 0) {
    if (cid < nMonStatsCount && cid === 0x1b0) {
      const ux = UNIT_GetPosX113c(m, pUnit)
      const uy = UNIT_GetPosY113c(m, pUnit)
      SUNIT_AllocUnitData113c(m, 2, 0x23b, ux, uy, pGame, pRoom, 1, 0, 0)
      return pUnit
    }
    if (MONSTATS_ValidateClassId113c(m, cid) === 0x1b1) {
      const ux = UNIT_GetPosX113c(m, pUnit)
      const uy = UNIT_GetPosY113c(m, pUnit)
      SUNIT_AllocUnitData113c(m, 2, 0x23c, ux, uy, pGame, pRoom, 1, 0, 0)
    }
  }
  return pUnit
}

/**
 * Act 1 Quest 4 (`Rescue Cain`) portal/object arrival hook (`0x6FC86320`).
 * Real DLL signature: `ecx = pQuestEventArgs` (`[+0x00]=pGame`, `[+0x04]=pPlayer`, `[+0x08]=pRoomOrObj`,
 * `[+0x14]=nX`, `[+0x18]=nY`), updating Quest 4 `pQuestDataEx` (`[pQuest+0x18]`: `+0x6C`, `+0x70`,
 * `+0x84`, `+0x88`) and calling `ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c` when `+0x52 == 1 && +0x51 == 0`.
 * Also preserves the legacy `(m, pPortalUnit, pGame)` 2-arg room check overload for internal TS callers.
 *
 * @va D2Game:0x6FC86320
 */
export function QUEST_Act1TownPortalUpdateState113c(
  m: Memory113c,
  pQuestEventArgsOrPortal: number,
  pGameOrCallees?: number | BootInitGapACallees113c,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FC86320)
  if (typeof pGameOrCallees !== 'number') {
    const pArgs = pQuestEventArgsOrPortal >>> 0
    if (pArgs === 0) return 0
    const game = m.u32(pArgs) >>> 0
    const pQuestCtrl = game !== 0 ? (m.u32((game + 0x10f4) >>> 0) >>> 0) : 0
    let pQuest4 = pQuestCtrl !== 0 ? (m.u32(pQuestCtrl) >>> 0) : 0
    while (pQuest4 !== 0 && (m.u32(pQuest4) | 0) !== 4) {
      pQuest4 = m.u32((pQuest4 + 0xf4) >>> 0) >>> 0
    }
    if (pQuest4 === 0) return 0
    const pQuestDataEx = m.u32((pQuest4 + 0x18) >>> 0) >>> 0
    if (pQuestDataEx === 0) return 0
    const pUnit = m.u32((pArgs + 0x04) >>> 0) >>> 0
    const dwUnitId = pUnit !== 0 ? (m.u32((pUnit + 0x0c) >>> 0) >>> 0) : 0xffffffff
    const bFlag52 = m.u8((pQuestDataEx + 0x52) >>> 0)
    m.setU32((pQuestDataEx + 0x6c) >>> 0, dwUnitId)
    m.setU8((pQuestDataEx + 0x70) >>> 0, 1)
    const nX = m.u32((pArgs + 0x14) >>> 0) | 0
    const nY = m.u32((pArgs + 0x18) >>> 0) | 0
    m.setU32((pQuestDataEx + 0x84) >>> 0, nX >>> 0)
    m.setU32((pQuestDataEx + 0x88) >>> 0, nY >>> 0)
    if (bFlag52 === 1 && m.u8((pQuestDataEx + 0x51) >>> 0) === 0) {
      ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(
        m as SparseMemory113c,
        game,
        m.u32((pArgs + 0x08) >>> 0) >>> 0,
        nX,
        nY,
      )
    }
    return 1
  }

  const pPortalUnit = pQuestEventArgsOrPortal >>> 0
  const pGame = pGameOrCallees >>> 0
  if (pPortalUnit !== 0 && pGame !== 0 && isByteKnownInMem113c(m, (pGame + 0x10f4) >>> 0)) {
    const pInitObjData = m.u32((pPortalUnit + 0x14) >>> 0) >>> 0
    const pPortalObjTxt =
      (m.u32(pPortalUnit) | 0) === 2 && pInitObjData !== 0 && m.u32(pInitObjData) !== 0
        ? (m.u32(pInitObjData) >>> 0)
        : (m.u32(pPortalUnit) | 0) === 2
          ? (DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pPortalUnit + 0x04) >>> 0) | 0) >>> 0)
          : 0
    if (pPortalObjTxt !== 0 && m.u8((pPortalObjTxt + 0x1b1) >>> 0) === 54) {
      let matchedSp = 0
      for (let k = 7; k >= 0; k--) {
        const cand = (0x7fc00000 + (k << 5)) >>> 0
        if (
          isByteKnownInMem113c(m, cand) &&
          isByteKnownInMem113c(m, (cand + 0x18) >>> 0) &&
          m.u32(cand) === pGame &&
          m.u32((cand + 0x04) >>> 0) === pPortalUnit &&
          m.u32((cand + 0x10) >>> 0) === pPortalObjTxt
        ) {
          matchedSp = cand
          break
        }
      }
      const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
      let pQuest4 = pQuestCtrl !== 0 ? (m.u32(pQuestCtrl) >>> 0) : 0
      while (pQuest4 !== 0 && (m.u32(pQuest4) | 0) !== 4) {
        pQuest4 = m.u32((pQuest4 + 0xf4) >>> 0) >>> 0
      }
      if (pQuest4 === 0) return 0
      const pQuestDataEx = m.u32((pQuest4 + 0x18) >>> 0) >>> 0
      if (pQuestDataEx === 0) return 0
      const dwUnitId = m.u32((pPortalUnit + 0x0c) >>> 0) >>> 0
      if (
        m.u8((pQuestDataEx + 0x52) >>> 0) === 1 &&
        m.u8((pQuestDataEx + 0x51) >>> 0) === 0 &&
        isByteKnownInMem113c(m, (pGame + 0x1320) >>> 0)
      ) {
        for (let mh = 0; mh < 128; mh++) {
          let pMon = m.u32((pGame + 0x1320 + (mh << 2)) >>> 0) >>> 0
          while (pMon !== 0) {
            if ((m.u32((pMon + 0x04) >>> 0) | 0) === 0x109) {
              m.setU8((pQuestDataEx + 0x51) >>> 0, 1)
              m.setU8((pQuestDataEx + 0x52) >>> 0, 0)
              m.setU32((pQuestDataEx + 0x68) >>> 0, m.u32((pMon + 0x0c) >>> 0) >>> 0)
              mh = 128
              break
            }
            pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
          }
        }
      }
      const bFlag52 = m.u8((pQuestDataEx + 0x52) >>> 0)
      const pObjRoom =
        matchedSp !== 0
          ? (m.u32((matchedSp + 0x08) >>> 0) >>> 0)
          : (UNITS_GetRoom113c(m, pPortalUnit) >>> 0)
      const nX =
        matchedSp !== 0 ? (m.u32((matchedSp + 0x14) >>> 0) | 0) : (UNIT_GetPosX113c(m, pPortalUnit) | 0)
      const nY =
        matchedSp !== 0 ? (m.u32((matchedSp + 0x18) >>> 0) | 0) : (UNIT_GetPosY113c(m, pPortalUnit) | 0)
      m.setU32((pQuestDataEx + 0x6c) >>> 0, dwUnitId)
      m.setU8((pQuestDataEx + 0x70) >>> 0, 1)
      m.setU32((pQuestDataEx + 0x84) >>> 0, nX >>> 0)
      m.setU32((pQuestDataEx + 0x88) >>> 0, nY >>> 0)
      if (bFlag52 === 1 && m.u8((pQuestDataEx + 0x51) >>> 0) === 0) {
        ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(m as SparseMemory113c, pGame, pObjRoom, nX, nY)
      }
      return 1
    }
    if (callees === undefined) {
      const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
      let pQuest4 = pQuestCtrl !== 0 ? (m.u32(pQuestCtrl) >>> 0) : 0
      while (pQuest4 !== 0 && (m.u32(pQuest4) | 0) !== 4) {
        pQuest4 = m.u32((pQuest4 + 0xf4) >>> 0) >>> 0
      }
      const pQuestDataEx = pQuest4 !== 0 ? (m.u32((pQuest4 + 0x18) >>> 0) >>> 0) : 0
      if (
        pQuestDataEx !== 0 &&
        m.u8((pQuestDataEx + 0x70) >>> 0) === 0 &&
        m.u8((pQuestDataEx + 0x52) >>> 0) === 0 &&
        isByteKnownInMem113c(m, (pGame + 0x1520) >>> 0)
      ) {
        for (let h = 0; h < 128; h++) {
          let pCand = m.u32((pGame + 0x1520 + (h << 2)) >>> 0) >>> 0
          while (pCand !== 0) {
            const pCandData = m.u32((pCand + 0x14) >>> 0) >>> 0
            const pCandTxt =
              pCandData !== 0 && m.u32(pCandData) !== 0
                ? (m.u32(pCandData) >>> 0)
                : (DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pCand + 0x04) >>> 0) | 0) >>> 0)
            if (pCandTxt !== 0 && m.u8((pCandTxt + 0x1b1) >>> 0) === 54) {
              m.setU32((pQuestDataEx + 0x6c) >>> 0, m.u32((pCand + 0x0c) >>> 0) >>> 0)
              m.setU8((pQuestDataEx + 0x70) >>> 0, 1)
              m.setU32((pQuestDataEx + 0x84) >>> 0, (UNIT_GetPosX113c(m, pCand) | 0) >>> 0)
              m.setU32((pQuestDataEx + 0x88) >>> 0, (UNIT_GetPosY113c(m, pCand) | 0) >>> 0)
              h = 128
              break
            }
            pCand = m.u32((pCand + 0xe4) >>> 0) >>> 0
          }
        }
      }
    }
  }
  const pPath = pPortalUnit !== 0 ? m.u32((pPortalUnit + 0x2c) >>> 0) >>> 0 : 0
  const pRoom = pPath !== 0 ? m.u32((pPath + 0x1c) >>> 0) >>> 0 : 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)

  const dwTwinId = pPortalUnit !== 0 ? m.u32((pPortalUnit + 0x94) >>> 0) : 0xffffffff
  const pTwinUnit = SUNIT_GetServerUnit113c(m, pGame, 2, dwTwinId) >>> 0
  const pTwinPath = pTwinUnit !== 0 ? m.u32((pTwinUnit + 0x2c) >>> 0) >>> 0 : 0
  const pTwinRoom = pTwinPath !== 0 ? m.u32((pTwinPath + 0x1c) >>> 0) >>> 0 : 0
  const nTwinLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pTwinRoom)

  if (nLevelId !== 0x26 && nTwinLevelId !== 0x26) {
    return 0
  }

  const resolvedCallees = callees
  const pQuest =
    resolvedCallees !== undefined && resolvedCallees.getQuestDescriptor !== undefined
      ? resolvedCallees.getQuestDescriptor(m, pGame, 3) >>> 0
      : 0
  if (pQuest === 0) return 1
  const pQuestExt = m.u32((pQuest + 0xf0) >>> 0) >>> 0
  if (pQuestExt === 0) return 1
  if (m.u8(pQuestExt) === 1) {
    m.setU32((pQuestExt + 0x04) >>> 0, 2)
  }
  return 1
}

/**
 * Sends object mode (`0x0E`), shrine speech (`0x2C`), and quest state packets for `pObject` to `pClient`.
 *
 * @va D2Game:0x6FC8A0D0
 */
export function OBJECT_SendUpdatePacketsToClient113c(
  m: Memory113c,
  pClient: number,
  pObject: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC8A0D0)
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pkt0E = sp
  const pkt4D = (sp + 0x10) >>> 0
  try {
    const dwFlags = pObject !== 0 ? m.u32((pObject + 0xc4) >>> 0) >>> 0 : 0
    const dwUnitId = pObject !== 0 ? m.u32((pObject + 0x0c) >>> 0) >>> 0 : 0xffffffff
    const wAnimMode = pObject !== 0 ? m.u16((pObject + 0x10) >>> 0) : 0
    m.fill(pkt0E, 0x0c, 0)
    m.setU8(pkt0E, 0x0e)
    m.setU8((pkt0E + 1) >>> 0, 0x02)
    m.setU32((pkt0E + 2) >>> 0, dwUnitId)
    m.setU8((pkt0E + 6) >>> 0, 0x03)
    m.setU8((pkt0E + 7) >>> 0, (dwFlags >>> 1) & 1)
    m.setU32((pkt0E + 8) >>> 0, wAnimMode >>> 0)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt0E, 0x0c)

    if (pObject === 0) return
    const pObjData = m.u32((pObject + 0x14) >>> 0) >>> 0
    const pObjTxtRaw = pObjData !== 0 ? (m.u32(pObjData) >>> 0) : 0
    const pObjTxt =
      pObjTxtRaw !== 0
        ? pObjTxtRaw
        : (DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pObject + 4) >>> 0) | 0) >>> 0)
    if (pObjTxt === 0) return
    const subClass = m.u8((pObjTxt + 0x167) >>> 0)
    if (subClass === 0) return
    if ((subClass & 0x04) !== 0) {
      if (callees !== undefined && callees.onObjectQuestSync !== undefined) {
        callees.onObjectQuestSync(m, m.u32((pObject + 0x80) >>> 0), pObject, pClient)
      } else {
        NET_SendPacket60_PortalInfo_6FCAAAE0_113c(m, pObject, pClient)
      }
      return
    }
    if (m.u32((pObject + 0x10) >>> 0) === 1 && (subClass & 0x01) !== 0) {
      const pShrineTxt = UNITS_GetObjectShrineTxt113c(m, pObject) >>> 0
      const shrineByte = pShrineTxt !== 0 ? m.u8(pShrineTxt) : 0
      const shrineType = m.u32((pObjData + 0x0c) >>> 0) >>> 0
      if (shrineType !== 0) {
        m.fill(pkt4D, 0x11, 0)
        m.setU8(pkt4D, 0x4d)
        m.setU8((pkt4D + 1) >>> 0, 0x02)
        m.setU32((pkt4D + 2) >>> 0, dwUnitId)
        m.setU32((pkt4D + 6) >>> 0, (shrineType - 1) >>> 0)
        m.setU8((pkt4D + 10) >>> 0, shrineByte)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt4D, 0x11)
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Syncs `pObject` update packets (`dwFlags & 0x01`), unit sound `0x2C` (`dwFlags & 0x400`),
 * hover message `0x26`/`0x30` (`dwFlags & 0x100`), inventory command flags (`dwFlagsEx & 0x01`),
 * and flushes `pObject->pEventNotifyList` (`+0xE8`) to `pClient`.
 *
 * @va D2Game:0x6FC8B200
 */
export function OBJECT_SyncStateAndEventsToClient113c(
  m: Memory113c,
  pObject: number,
  pClient: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FC8B200)
  const obj = pObject >>> 0
  if (obj !== 0) {
    if ((m.u32((obj + 0xc4) >>> 0) & 0x01) !== 0) {
      OBJECT_SendUpdatePacketsToClient113c(m, pClient, obj, callees)
    }
    if (((m.u32((obj + 0xc4) >>> 0) >>> 10) & 1) !== 0) {
      const pOwnerRestrict = m.u32((obj + 0x70) >>> 0) >>> 0
      if (pOwnerRestrict === 0 || CLIENTS_GetPlayerUnit113c(m, pClient, 0) === pOwnerRestrict) {
        const wSound = m.u16((obj + 0x6e) >>> 0)
        if (callees !== undefined && callees.sendUnitEventSound !== undefined) {
          callees.sendUnitEventSound(m, pClient, obj, wSound)
        } else {
          const sp = bootInitGapStackPtr
          bootInitGapStackPtr = (sp + 0x10) >>> 0
          try {
            m.fill(sp, 8, 0)
            m.setU8(sp, 0x2c)
            m.setU8((sp + 1) >>> 0, m.u8(obj))
            m.setU32((sp + 2) >>> 0, m.u32((obj + 0x0c) >>> 0))
            m.setU16((sp + 6) >>> 0, wSound)
            NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 8)
          } finally {
            bootInitGapStackPtr = sp
          }
        }
      }
    }
    if (((m.u32((obj + 0xc4) >>> 0) >>> 8) & 1) !== 0) {
      SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c(m as SparseMemory113c, obj, pClient)
    }
    if ((m.u32((obj + 0xc8) >>> 0) & 0x01) !== 0) {
      ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(
        m as SparseMemory113c,
        0,
        m.u32((obj + 0x80) >>> 0) >>> 0,
        obj,
        pClient,
      )
    }
    UNIT_FlushEventNotifyQueueToClient113c(m, pClient, obj, callees)
  }
  return 1
}

/**
 * Computes monster life percentage on a `0..128` (`0x80`) scale (`((curLife >> 8) << 7) / (maxLife >> 8)`).
 *
 * @va D2Game:0x6FC97060
 */
export function MONSTER_CalcLifePercentage128_113c(m: Memory113c, pUnit: number): number {
  hitD2GameVa113c(0x6FC97060)
  if (pUnit === 0) return 0x80
  const curLifeShr = (STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0) >> 8
  const maxLifeShr = (STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0) >> 8
  if (maxLifeShr <= 0 || curLifeShr >= maxLifeShr) return 0x80
  const pct = Math.trunc((curLifeShr << 7) / maxLifeShr) | 0
  return pct & 0xff
}

/**
 * Computes hireling level bonus factor (`0` on Normal or `nIndex < 2`, `0x6FD1BBF0[nIndex]` for `2..8`, `nIndex * 8 - 16` for `>= 9`).
 *
 * @va D2Game:0x6FC970A0
 */
export function MONSTER_GetHirelingLevelBonusFactor113c(
  m: Memory113c,
  pGame: number,
  nIndex: number,
): number {
  hitD2GameVa113c(0x6FC970A0)
  if (pGame === 0) return 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const idx = nIndex | 0
  if (nDiff === 0 || idx < 2) return 0
  if (idx < 9) {
    return HIRELING_BONUS_TABLE_6FD1BBF0[idx]!
  }
  return (Math.imul(idx, 8) - 0x10) | 0
}

/**
 * Calculates and applies monster base combat stats, elemental damage rolls (`0x30..0x42`, `0x13B..0x13D`), and resistances (`0x24..0x2D`).
 *
 * @va D2Game:0x6FC97240
 */
export function MONSTER_ApplyElementalDamageAndResistStats113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  nMode: number,
): void {
  hitD2GameVa113c(0x6FC97240)
  if (pMonster === 0 || m.u32(pMonster >>> 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const nClassId = m.u32((pMonster + 0x04) >>> 0) | 0
  const pMonStatsTxt = (m.u32(pMonData) || MONSTATS_GetRecordPtr113c(m, nClassId)) >>> 0
  if (pMonStatsTxt === 0) return

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x60) >>> 0
  const pBonusArr = sp
  const pCalcBlock = (sp + 0x10) >>> 0
  try {
    m.setU32(pBonusArr, 0)
    m.setU32((pBonusArr + 0x04) >>> 0, 0)
    m.setU32((pBonusArr + 0x08) >>> 0, 0)

    // 0x6FC9728C: D2GAME_MONSTER_ApplyMercStatsOnOwner(pMonster, pBonusArr)
    D2GAME_MONSTER_ApplyMercStatsOnOwner113c(
      m,
      pMonster,
      pBonusArr,
      m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0,
    )

    // 0x6FC97291..0x6FC972A9: get monster's flag=1 attack-mode statlist and clear it
    const pStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, pMonster, 1) >>> 0
    if (pStatList === 0) return
    STATLIST_ClearBaseStats113c(m, pStatList)

    // 0x6FC972AA..0x6FC972DC: resolve pGame, nDiff, bExpansionFlag
    const pGameResolved = (D2GAME_SUNIT_GetGameFromUnit113c(m, pMonster) || pGame) >>> 0
    if (pGameResolved === 0) return
    const rawDiff = m.u8((pGameResolved + 0x6d) >>> 0) | 0
    const nDifficulty = rawDiff <= 0 ? 0 : rawDiff >= 2 ? 2 : 1
    const dwExpansion = m.u32((pGameResolved + 0x70) >>> 0) >>> 0
    const bIsExpansion =
      m.u8((pGameResolved + 0x6a) >>> 0) !== 0 ||
      m.u32((pGameResolved + 0x74) >>> 0) !== 0 ||
      dwExpansion !== 0
        ? 1
        : 0

    // 0x6FC972DD..0x6FC9730C: alignment == 0 -> MONSTER_GetHirelingLevelBonusFactor(pGame, max(1, stat 0x64))
    let bonusFactor = 0
    if (UNIT_GetAlignment113c(m, pMonster) === 0) {
      let playerCount = STATLIST_GetUnitStat113c(m, pMonster, 0x64, 0) | 0
      if (playerCount < 1) playerCount = 1
      bonusFactor = MONSTER_GetHirelingLevelBonusFactor113c(m, pGameResolved, playerCount) | 0
    }

    // 0x6FC9730D..0x6FC97410: A1 / A2 / S1 base damage & toHit calculation
    const mode = nMode | 0
    const mlvl = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
    m.fill(pCalcBlock, 0x38, 0)
    let calcFlags = 0x08
    let minOff = 0x14
    let maxOff = 0x18
    if (mode === 5) {
      calcFlags = 0x10
      minOff = 0x1c
      maxOff = 0x20
    } else if (mode === 7 || mode === 8) {
      calcFlags = 0x20
      minOff = 0x24
      maxOff = 0x28
    }
    DATATBLS_CalculateMonsterStatsByLevel113c(
      m,
      nClassId,
      bIsExpansion,
      nDifficulty,
      mlvl,
      calcFlags,
      pCalcBlock,
    )
    let minD = ((m.u32((pCalcBlock + minOff) >>> 0) | 0) + (m.u32(pBonusArr) | 0)) | 0
    let maxD = ((m.u32((pCalcBlock + maxOff) >>> 0) | 0) + (m.u32((pBonusArr + 0x04) >>> 0) | 0)) | 0
    let toHit = ((m.u32((pCalcBlock + 0x0c) >>> 0) | 0) + (m.u32((pBonusArr + 0x08) >>> 0) | 0)) | 0

    // 0x6FC97415..0x6FC97478: Classic NM/Hell scaling when bNoRatio (+0x4C) != 1
    if (dwExpansion === 0) {
      if (nDifficulty !== 0 && m.u8((pMonStatsTxt + 0x4c) >>> 0) !== 1) {
        minD = Math.trunc((minD * 10) / 6) | 0
        maxD = Math.trunc((maxD * 10) / 6) | 0
        toHit = Math.trunc((toHit * 10) / 9) | 0
      }
    } else if (bonusFactor !== 0) {
      // 0x6FC9747A..0x6FC974B5: Expansion player-count bonus (trunc(v * bonusFactor / 128))
      minD = (minD + Math.trunc(imul32(minD, bonusFactor) / 128)) | 0
      maxD = (maxD + Math.trunc(imul32(maxD, bonusFactor) / 128)) | 0
      toHit = (toHit + Math.trunc(imul32(toHit, bonusFactor) / 128)) | 0
    }

    // 0x6FC974B6..0x6FC974D6: STAT_MINDAMAGE (21), STAT_MAXDAMAGE (22), STAT_TOHIT (19) on flag=1 list
    STATLIST_SetStat113c(m, pStatList, 0x15, minD, 0)
    STATLIST_SetStat113c(m, pStatList, 0x16, maxD, 0)
    STATLIST_SetStat113c(m, pStatList, 0x13, toHit, 0)

    // 0x6FC974D7..0x6FC9774A: El1..El3 elemental mode-matched damage rolls
    const pSeed = (pMonster + 0x20) >>> 0
    for (let slot = 0; slot < 3; slot++) {
      const elMode = m.u8((pMonStatsTxt + 0xfe + slot) >>> 0)
      if (elMode === 0 || elMode !== mode) continue
      const elPct = m.u8((pMonStatsTxt + 0x104 + slot * 3 + nDifficulty) >>> 0)
      if (elPct === 0) continue
      if (elPct < 100) {
        if ((SEED_RollLimitedRandomNumber113c(m, pSeed, 100) | 0) >= elPct) continue
      }

      m.fill(pCalcBlock, 0x38, 0)
      const curMlvl = STATLIST_GetUnitStat113c(m, pMonster, 0x0c, 0) | 0
      DATATBLS_CalculateMonsterStatsByLevel113c(
        m,
        nClassId,
        bIsExpansion,
        nDifficulty,
        curMlvl,
        (0x40 + slot) | 0,
        pCalcBlock,
      )
      let elMin = m.u32((pCalcBlock + 0x2c) >>> 0) | 0
      let elMax = m.u32((pCalcBlock + 0x30) >>> 0) | 0
      let elLen = m.u32((pCalcBlock + 0x34) >>> 0) | 0
      if (dwExpansion !== 0 && bonusFactor !== 0) {
        elMin = (elMin + Math.trunc(imul32(elMin, bonusFactor) / 128)) | 0
        elMax = (elMax + Math.trunc(imul32(elMax, bonusFactor) / 128)) | 0
        elLen = (elLen + Math.trunc(imul32(elLen, bonusFactor) / 128)) | 0
      }

      let elType = m.u8((pMonStatsTxt + 0x101 + slot) >>> 0)
      if (elType === 10) {
        elType = ((SEED_RollLimitedRandomNumber113c(m, pSeed, 5) | 0) + 1) & 0xff
        if (elLen === 0) elLen = 0x19
      }

      switch (elType) {
        case 1:
          STATLIST_SetStat113c(m, pStatList, 0x30, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x31, elMax, 0)
          break
        case 2:
          STATLIST_SetStat113c(m, pStatList, 0x32, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x33, elMax, 0)
          break
        case 3:
          STATLIST_SetStat113c(m, pStatList, 0x34, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x35, elMax, 0)
          break
        case 4:
          STATLIST_SetStat113c(m, pStatList, 0x36, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x37, elMax, 0)
          STATLIST_SetStat113c(m, pStatList, 0x38, elLen, 0)
          break
        case 5:
          STATLIST_SetStat113c(m, pStatList, 0x39, imul32(elMin, 10), 0)
          STATLIST_SetStat113c(m, pStatList, 0x3a, imul32(elMax, 10), 0)
          STATLIST_SetStat113c(m, pStatList, 0x3b, (elLen * 2) | 0, 0)
          break
        case 6:
          STATLIST_SetStat113c(m, pStatList, 0x3c, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x3d, elMax, 0)
          break
        case 7:
          STATLIST_SetStat113c(m, pStatList, 0x3e, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x3f, elMax, 0)
          break
        case 8:
          STATLIST_SetStat113c(m, pStatList, 0x40, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x41, elMax, 0)
          break
        case 9:
          STATLIST_SetStat113c(m, pStatList, 0x42, elLen, 0)
          break
        case 11:
          STATLIST_SetStat113c(m, pStatList, 0x13c, elMin, 0)
          STATLIST_SetStat113c(m, pStatList, 0x13d, elMax, 0)
          STATLIST_SetStat113c(m, pStatList, 0x13b, elLen, 0)
          break
        default:
          break
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

function sendPlayerStop0DUncond_6FCEB950_113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
  nPlayerMode: number,
): void {
  const hitClass = m.u8((pUnit + 0xb0) >>> 0)
  hitD2GameVa113c(0x6FCEB950)
  const modeIdx = nPlayerMode | 0
  let actionByte = 0x09
  if (modeIdx === 0) actionByte = 0x08
  else if (modeIdx === 4) actionByte = 0x06
  else if (modeIdx === 9) actionByte = 0x12
  else if (modeIdx === 0x11) actionByte = 0x09
  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit >>> 0) & 0xff
  const uy = UNIT_GetPosY113c(m, pUnit >>> 0) & 0xffff
  const ux = UNIT_GetPosX113c(m, pUnit >>> 0) & 0xffff
  const unitId = m.u32((pUnit + 0x0c) >>> 0) >>> 0
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x10) >>> 0
  try {
    m.fill(sp, 0x10, 0)
    m.setU8(sp, 0x0d)
    m.setU8((sp + 0x01) >>> 0, 0)
    m.setU32((sp + 0x02) >>> 0, unitId)
    m.setU8((sp + 0x06) >>> 0, actionByte)
    m.setU16((sp + 0x07) >>> 0, ux)
    m.setU16((sp + 0x09) >>> 0, uy)
    m.setU8((sp + 0x0b) >>> 0, hitClass)
    m.setU8((sp + 0x0c) >>> 0, lifePct)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x0d)
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Syncs unit gfx states, modified stats, sound events, and event notification queue to `pClient`.
 *
 * @va D2Game:0x6FC988B0
 */
export function UNIT_SyncStateAndStatsToClient113c(
  m: Memory113c,
  pGame: number,
  pClient: number,
  pUnit: number,
  callees?: BootInitGapACallees113c,
  bPreSynced = 0,
): void {
  hitD2GameVa113c(0x6FC988B0)
  if (pClient === 0) return

  // 0x6FC988DF..0x6FC9892E: resolve pClient's player unit (cached at +0x174 when +0x3D4 bit 0 set)
  let pClientPlayer = 0
  if ((m.u8((pClient + 0x3d4) >>> 0) & 1) !== 0) {
    pClientPlayer = m.u32((pClient + 0x174) >>> 0) >>> 0
  } else {
    const curClientUnit = m.u32((pClient + 0x174) >>> 0) >>> 0
    if (curClientUnit !== 0) {
      pClientPlayer =
        SUNIT_GetServerUnit113c(
          m,
          m.u32((pClient + 0x1a8) >>> 0) >>> 0,
          m.u32((pClient + 0x16c) >>> 0) | 0,
          m.u32((pClient + 0x170) >>> 0) >>> 0,
        ) >>> 0
      if (pClientPlayer === 0) {
        m.setU32((pClient + 0x174) >>> 0, 0)
      }
    }
  }

  // 0x6FC98932..0x6FC98965: dwFlagsEx & 0x10000 (bFlash=1) or (dwFlagsEx & 0x0800 && pUnit !== pClientPlayer) (bFlash=0) -> S2C 0x15
  if (pUnit !== 0) {
    const dwFlagsEx = m.u32((pUnit + 0xc8) >>> 0) >>> 0
    if (((dwFlagsEx >>> 16) & 1) !== 0) {
      NET_SendReassignUnitPacket15_113c(m, pUnit, pClient, 1)
    } else if (((dwFlagsEx >>> 11) & 1) !== 0 && (pUnit >>> 0) !== (pClientPlayer >>> 0)) {
      NET_SendReassignUnitPacket15_113c(m, pUnit, pClient, 0)
    }
  }

  const dwFlags = pUnit !== 0 ? (m.u32((pUnit + 0xc4) >>> 0) >>> 0) : 0
  const effectivePreSynced =
    bPreSynced !== 0 ||
    (callees !== undefined &&
      pUnit !== 0 &&
      (dwFlags & 0x10) !== 0 &&
      (dwFlags & 0x800) === 0 &&
      (pUnit >>> 0) !== (pClientPlayer >>> 0))
      ? 1
      : 0

  // 0x6FC98966..0x6FC9899C: `bPreSynced == 0 && (dwFlagsEx & 0x01) != 0` -> broadcast inventory command flags + packets 0x47 / 0x48
  if (effectivePreSynced === 0 && pUnit !== 0 && (m.u32((pUnit + 0xc8) >>> 0) & 0x01) !== 0) {
    ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(
      m as SparseMemory113c,
      0,
      pGame,
      pUnit,
      pClient,
    )
    NET_SendPacket47_UnitRelator1_6FCAAEC0_113c(m, pUnit, pClient)
    NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c(m, pUnit, pClient, 0)
  }

  // 0x6FC989A0..0x6FC989B8: `dwFlags & 0x01` -> player mode sync
  if (pUnit !== 0 && (dwFlags & 0x01) !== 0) {
    const plrMode = m.u32(pUnit >>> 0) === 0 ? (m.u32((pUnit + 0x10) >>> 0) >>> 0) : 0xffffffff
    if (plrMode === 0) {
      hitD2GameVa113c(0x6FCEB8F0)
      PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c(m as SparseMemory113c, pUnit, pClient, 0)
    } else if (plrMode === 0x11) {
      hitD2GameVa113c(0x6FCEB8F0)
      sendPlayerStop0DUncond_6FCEB950_113c(m, pUnit, pClient, 0x11)
    } else if (callees !== undefined && callees.syncPlayerMode !== undefined) {
      callees.syncPlayerMode(m, pGame, pClient, pUnit)
    }
  }

  // 0x6FC989B8..0x6FC989BA: flush event notify queue (`pUnit + 0xEC`)
  if (pUnit !== 0 && m.u32((pUnit + 0xec) >>> 0) !== 0) {
    UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
  }

  // 0x6FC989C3..0x6FC989DE: `dwFlags & 0x400` -> unit event sound (`0x6FC9AC50`)
  if (pUnit !== 0 && (dwFlags & 0x400) !== 0) {
    if (callees !== undefined && callees.sendUnitEventSound !== undefined) {
      callees.sendUnitEventSound(m, pClient, pUnit, m.u16((pUnit + 0xd8) >>> 0))
    }
  }

  // 0x6FC989FC..0x6FC98A16: `dwFlags & 0x8000` -> hit/gethit stop sync (`0x6FCEBBB0`)
  if (pUnit !== 0 && ((dwFlags >>> 15) & 1) !== 0) {
    if (callees !== undefined && callees.syncUnitFlag8000 !== undefined) {
      callees.syncUnitFlag8000(m, pGame, pClient, pUnit)
    }
  }

  // 0x6FC98A16..0x6FC98A27: `UNITS_HasAnyGfxStateFlag` -> `UNIT_SendGfxStatesBitstreamToClient`
  if (pUnit !== 0 && UNITS_HasAnyGfxStateFlag113c(m, pUnit) !== 0) {
    UNIT_SendGfxStatesBitstreamToClient113c(m, pUnit, pClient)
  }

  // 0x6FC98A27..0x6FC98A78: statlist flag 0x100 + modified stat notifications (0x43, 0x44, 0x0C, 0, 2)
  if (pUnit !== 0 && STATLIST_CheckUnitStatListFlag100113c(m, pUnit) !== 0) {
    UNIT_SendStatB2Packet11ToClient_6FC9A570_113c(m as SparseMemory113c, pUnit, pClient)
    const uType = m.u32(pUnit >>> 0)
    if (uType === 0 && (pClientPlayer >>> 0) === (pUnit >>> 0)) {
      if (callees !== undefined && callees.sendLifeManaStaminaPacket !== undefined) {
        const curLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0
        const curMana = STATLIST_GetUnitStat113c(m, pUnit, 8, 0) | 0
        const curStamina = STATLIST_GetUnitStat113c(m, pUnit, 0x0a, 0) | 0
        if (
          curLife !== (m.u32((pClient + 0x48c) >>> 0) | 0) ||
          curMana !== (m.u32((pClient + 0x490) >>> 0) | 0) ||
          curStamina !== (m.u32((pClient + 0x494) >>> 0) | 0)
        ) {
          m.setU32((pClient + 0x48c) >>> 0, curLife >>> 0)
          m.setU32((pClient + 0x490) >>> 0, curMana >>> 0)
          m.setU32((pClient + 0x494) >>> 0, curStamina >>> 0)
          callees.sendLifeManaStaminaPacket(m, pClient, pUnit, curLife, curMana, curStamina)
        }
      }
    }
  }

  if (pUnit !== 0) {
    const cb =
      callees !== undefined && callees.onStatModifiedNotify !== undefined
        ? callees.onStatModifiedNotify
        : undefined
    const pfnCb = cb !== undefined ? 0x6fcec2f0 : 0
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 0x43, pfnCb, cb)
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 0x44, pfnCb, cb)
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 0x0c, pfnCb, cb)
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 0, pfnCb, cb)
    STATLIST_NotifyIfStatModified113c(m, pUnit, pClientPlayer, 2, pfnCb, cb)

    if ((m.u8((pUnit + 0xc6) >>> 0) & 1) !== 0 || (m.u8((pUnit + 0xc4) >>> 0) & 0x80) !== 0) {
      if (callees !== undefined && callees.sendUnitUpdateFlagsPacket !== undefined) {
        callees.sendUnitUpdateFlagsPacket(m, pClient, pUnit)
      }
    }
  }
}

/**
 * Frees all nodes in `pUnit->pEventNotifyList` (`+0xEC`, linked via `+0x00`) and zeroes `+0xEC`/`+0xF0`.
 *
 * @va D2Game:0x6FC99FE0
 */
export function UNIT_FreeEventNotifyList113c(m: Memory113c, pUnit: number): void {
  hitD2GameVa113c(0x6FC99FE0)
  if (pUnit === 0) {
    throw new Error('UNIT_FreeEventNotifyList113c: pUnit == NULL (line 3373)')
  }
  let pNode = m.u32((pUnit + 0xec) >>> 0) >>> 0
  while (pNode !== 0) {
    const pNext = m.u32(pNode >>> 0) >>> 0
    fogFreeMemPool113c(m, pNode)
    pNode = pNext
  }
  m.setU32((pUnit + 0xf0) >>> 0, 0)
  m.setU32((pUnit + 0xec) >>> 0, 0)
}

function writeUnitStateStatsBitstream113c(
  m: Memory113c,
  pDataTables: number,
  pBitStream: number,
  pStatsBuf: number,
  nStats: number,
): void {
  const nIscCount = m.u32((pDataTables + 0xbd4) >>> 0) | 0
  const pIscBase = m.u32((pDataTables + 0xbcc) >>> 0) >>> 0
  for (let i = 0; i < nStats; i++) {
    const pStat = (pStatsBuf + i * 8) >>> 0
    const wParam = m.u16(pStat)
    const wStatId = m.u16((pStat + 2) >>> 0)
    let nVal = m.u32((pStat + 4) >>> 0) | 0
    if ((wStatId | 0) < 0 || (wStatId | 0) >= nIscCount || pIscBase === 0) continue
    const pIsc = (pIscBase + imul32(wStatId, 0x144)) >>> 0
    const bSendBits = m.u8((pIsc + 0x08) >>> 0)
    if (bSendBits === 0) continue
    if (bSendBits < 0x20) {
      const fSigned = (m.u8((pIsc + 0x04) >>> 0) & 0x02) !== 0
      if (fSigned) {
        const maxPos = ((1 << (bSendBits - 1)) - 1) | 0
        const minNeg = -(1 << (bSendBits - 1)) | 0
        if (nVal < minNeg) nVal = minNeg
        if (nVal > maxPos) nVal = maxPos
      } else {
        const maxUnsigned = (((1 << bSendBits) >>> 0) - 1) | 0
        if (nVal <= 0) nVal = 0
        else if (nVal > maxUnsigned) nVal = maxUnsigned
      }
    }
    fogWriteBits113c(m, pBitStream, wStatId, 9)
    const bSendParamBits = m.u8((pIsc + 0x09) >>> 0)
    if (bSendParamBits !== 0) {
      fogWriteBits113c(m, pBitStream, wParam, bSendParamBits)
    }
    fogWriteBits113c(m, pBitStream, nVal, bSendBits)
  }
}

/**
 * Serializes modified gfx states on `pUnit` (`D2Common.#10315`) as `0xA8` (bitstream), `0xA7` (flag), or `0xA9` (clear) packets to `pClient`.
 *
 * @va D2Game:0x6FC9A5E0
 */
export function UNIT_SendGfxStatesBitstreamToClient113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC9A5E0)
  if (pUnit === 0 || pClient === 0) return
  const pGfxFlags = UNITS_GetGfxStateFlagsPtr113c(m, pUnit) >>> 0
  if (pGfxFlags === 0) return

  const pSgptHolder = m.u32(0x6fd1829c) >>> 0
  const pDataTables = (pSgptHolder !== 0 ? m.u32(pSgptHolder) : m.u32(0x6fde9e1c)) >>> 0
  if (pDataTables === 0) return
  const nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  const plus31 = (nStatesCount + 0x1f) | 0
  const nDwords = sar32(plus31 + ((plus31 >> 31) & 0x1f), 5)
  if (nDwords <= 0) return
  const pStatesTxtBase = m.u32((pDataTables + 0xbc) >>> 0) >>> 0

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x1140) >>> 0
  const pBitStream = sp
  const pPkt = (sp + 0x20) >>> 0
  const pStatsBuf = (sp + 0x120) >>> 0
  try {
    const uType = m.u8(pUnit >>> 0)
    const uGuid = m.u32((pUnit + 0x0c) >>> 0) >>> 0
    for (let dwordIdx = 0; dwordIdx < nDwords; dwordIdx++) {
      let mask = m.u32((pGfxFlags + dwordIdx * 4) >>> 0) >>> 0
      while (mask !== 0) {
        const bitIdx = fogBitScanForward113c(mask)
        if (bitIdx < 0) break
        const nState = ((dwordIdx << 5) + bitIdx) | 0
        mask = (mask & ~((1 << (bitIdx & 31)) >>> 0)) >>> 0
        if (nState < 0 || nState >= nStatesCount || pStatesTxtBase === 0) continue
        const pStateRec = (pStatesTxtBase + imul32(nState, 0x3c)) >>> 0
        if ((m.u8((pStateRec + 0x10) >>> 0) & 0x01) !== 0) continue

        if (STATES_CheckState113c(m, pUnit, nState) === 0) {
          m.setU8(pPkt, 0xa9)
          m.setU8((pPkt + 1) >>> 0, uType)
          m.setU32((pPkt + 2) >>> 0, uGuid)
          m.setU8((pPkt + 6) >>> 0, nState & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 7)
          continue
        }

        const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, nState) >>> 0
        if (pStatList === 0) {
          m.setU8(pPkt, 0xa7)
          m.setU8((pPkt + 1) >>> 0, uType)
          m.setU32((pPkt + 2) >>> 0, uGuid)
          m.setU8((pPkt + 6) >>> 0, nState & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 7)
          continue
        }

        const nStats = STATLIST_CopyBaseStatsToBuffer113c(m, pStatList, pStatsBuf, 0x10) | 0
        if (nStats <= 0) {
          m.setU8(pPkt, 0xa7)
          m.setU8((pPkt + 1) >>> 0, uType)
          m.setU32((pPkt + 2) >>> 0, uGuid)
          m.setU8((pPkt + 6) >>> 0, nState & 0xff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 7)
          continue
        }

        m.fill(pPkt, 0x100, 0)
        m.setU8(pPkt, 0xa8)
        m.setU8((pPkt + 1) >>> 0, uType)
        m.setU32((pPkt + 2) >>> 0, uGuid)
        m.setU8((pPkt + 7) >>> 0, nState & 0xff)
        fogInitBitBuffer113c(m, pBitStream, (pPkt + 8) >>> 0, 0xf4)
        writeUnitStateStatsBitstream113c(m, pDataTables, pBitStream, pStatsBuf, nStats)
        fogWriteBits113c(m, pBitStream, 0x1ff, 9)
        const totalLen = (fogGetBitBufferSize113c(m, pBitStream) + 8) & 0xff
        m.setU8((pPkt + 6) >>> 0, totalLen)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, totalLen)
      }
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Serializes all active states on `pUnit` (`D2Common.#11150`) into a single `0xAA` multi-state
 * bitstream packet (`ItemStatCost.txt` bit widths + `0xFF` 8-bit state terminator) to `pClient`.
 *
 * @va D2Game:0x6FC9A940
 */
export function UNIT_SendAllStatesBitstreamToClient113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC9A940)
  if (pUnit === 0 || pClient === 0) return
  const pStateFlags = UNITS_GetStateFlagsPtr113c(m, pUnit) >>> 0
  if (pStateFlags === 0) return

  const pSgptHolder = m.u32(0x6fd1829c) >>> 0
  const pDataTables = (pSgptHolder !== 0 ? m.u32(pSgptHolder) : m.u32(0x6fde9e1c)) >>> 0
  if (pDataTables === 0) return
  const nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  const plus31 = (nStatesCount + 0x1f) | 0
  const nDwords = sar32(plus31 + ((plus31 >> 31) & 0x1f), 5)
  const pStatesTxtBase = m.u32((pDataTables + 0xbc) >>> 0) >>> 0

  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x1140) >>> 0
  const pBitStream = sp
  const pPkt = (sp + 0x20) >>> 0
  const pStatsBuf = (sp + 0x120) >>> 0
  try {
    m.fill(pPkt, 0x100, 0)
    m.setU8(pPkt, 0xaa)
    m.setU8((pPkt + 1) >>> 0, m.u8(pUnit >>> 0))
    m.setU32((pPkt + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
    fogInitBitBuffer113c(m, pBitStream, (pPkt + 7) >>> 0, 0xf4)

    for (let dwordIdx = 0; dwordIdx < nDwords; dwordIdx++) {
      let mask = m.u32((pStateFlags + dwordIdx * 4) >>> 0) >>> 0
      while (mask !== 0) {
        const bitIdx = fogBitScanForward113c(mask)
        if (bitIdx < 0) break
        const nState = ((dwordIdx << 5) + bitIdx) | 0
        mask = (mask & ~((1 << (bitIdx & 31)) >>> 0)) >>> 0
        if (nState < 0 || nState >= nStatesCount || pStatesTxtBase === 0) continue
        const pStateRec = (pStatesTxtBase + imul32(nState, 0x3c)) >>> 0
        if ((m.u8((pStateRec + 0x10) >>> 0) & 0x01) !== 0) continue
        if (((fogGetBitBufferSize113c(m, pBitStream) + 7) | 0) >= 0xdb) break

        fogWriteBits113c(m, pBitStream, nState, 8)
        const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, nState) >>> 0
        if (pStatList === 0) {
          fogWriteBits113c(m, pBitStream, 0, 1)
          continue
        }
        const nStats = STATLIST_CopyBaseStatsToBuffer113c(m, pStatList, pStatsBuf, 0x10) | 0
        if (nStats <= 0) {
          fogWriteBits113c(m, pBitStream, 0, 1)
          continue
        }
        fogWriteBits113c(m, pBitStream, 1, 1)
        writeUnitStateStatsBitstream113c(m, pDataTables, pBitStream, pStatsBuf, nStats)
        fogWriteBits113c(m, pBitStream, 0x1ff, 9)
      }
    }

    fogWriteBits113c(m, pBitStream, 0xff, 8)
    const totalLen = (fogGetBitBufferSize113c(m, pBitStream) + 7) & 0xff
    m.setU8((pPkt + 6) >>> 0, totalLen)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, totalLen)
  } finally {
    bootInitGapStackPtr = sp
  }
}

/**
 * Walks `pUnit->pEventNotifyList` (`+0xE8`) and dispatches queued S2C packets (`0x23, 0x99, 0x9A, 0x9E, 0xA1, 0xA3, 0xA4, 0xA5, 0xAB`) to `pClient`.
 *
 * @va D2Game:0x6FC9ADF0
 */
export function UNIT_FlushEventNotifyQueueToClient113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  callees?: BootInitGapACallees113c,
): void {
  hitD2GameVa113c(0x6FC9ADF0)
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pPkt = sp
  try {
    let pNode = m.u32((pUnit + 0xec) >>> 0) >>> 0
    while (pNode !== 0) {
      const opcode = m.u8((pNode + 0x04) >>> 0)
      switch (opcode) {
        case 0x9a:
          m.fill(pPkt, 0x11, 0)
          m.setU8(pPkt, 0x9a)
          m.setU32((pPkt + 1) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
          m.setU16((pPkt + 5) >>> 0, m.u16((pNode + 0x0a) >>> 0))
          m.setU16((pPkt + 7) >>> 0, m.u16((pNode + 0x08) >>> 0))
          m.setU32((pPkt + 9) >>> 0, m.u32(pNode >>> 0))
          m.setU16((pPkt + 13) >>> 0, m.u32((pNode + 0x0c) >>> 0) & 0xffff)
          m.setU16((pPkt + 15) >>> 0, (m.u32((pNode + 0x0c) >>> 0) >>> 16) & 0xffff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 0x11)
          break
        case 0xa4:
          m.setU8(pPkt, 0xa4)
          m.setU16((pPkt + 1) >>> 0, m.u16((pNode + 0x08) >>> 0))
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 3)
          break
        case 0xab:
          if (((m.u32((pUnit + 0xc4) >>> 0) >>> 15) & 1) === 0) {
            const pClientPlayer =
              pClient !== 0 ? (CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0) : 0
            if (
              pClientPlayer === 0 ||
              SUNIT_AreUnitsHostileOrUnaligned113c(
                m,
                pClientPlayer,
                pUnit,
                D2GAME_SUNIT_GetGameFromUnit113c(m, pClientPlayer),
              ) !== 0
            ) {
              if (callees !== undefined && callees.onNotifyOpcode !== undefined) {
                callees.onNotifyOpcode(m, opcode, pClient, pUnit, pNode)
              }
            }
          }
          break
        case 0x9e:
          NET_SendPacket9E9FA0_StatValue_6FCABC20_113c(
            m as SparseMemory113c,
            m.u8((pNode + 0x0c) >>> 0),
            pUnit,
            pClient,
            m.u32((pNode + 0x10) >>> 0) >>> 0,
          )
          break
        case 0x23:
        case 0x99:
        case 0xa1:
        case 0xa3:
        case 0xa5:
          if (callees !== undefined && callees.onNotifyOpcode !== undefined) {
            callees.onNotifyOpcode(m, opcode, pClient, pUnit, pNode)
          }
          break
        default:
          break
      }
      pNode = m.u32(pNode >>> 0) >>> 0
    }
  } finally {
    bootInitGapStackPtr = sp
  }
}

let inUnitFullSyncDepth113c = 0
let inExecuteMonsterEventsDepth113c = 0
let suppressedMon7FThisEvent113c = false
let suppressDupMon9DKey113c = ''
let deferredInitMon9DLastFrame113c = -1
const deferredInitMon9DQueue113c = new Map<string, Uint8Array[]>()

function isByteKnownInMem113c(m: Memory113c, addr: number): boolean {
  const a = addr >>> 0
  if (a === 0) return false
  const known = (m as unknown as { known?: Map<number, Uint8Array> }).known
  if (known === undefined) return true
  const kp = known.get(a >>> 12)
  return kp !== undefined && kp[a & 0xfff] !== 0
}

function playerUnitHasIdleEvent11_113c(m: Memory113c, pPlayer: number): boolean {
  if (pPlayer === 0 || !isByteKnownInMem113c(m, (pPlayer + 0xdc) >>> 0)) return false
  let pEv = m.u32((pPlayer + 0xdc) >>> 0) >>> 0
  let guard = 0
  while (pEv !== 0 && guard < 64 && isByteKnownInMem113c(m, pEv)) {
    if (m.u8(pEv) === 11) return true
    pEv = isByteKnownInMem113c(m, (pEv + 0x24) >>> 0) ? (m.u32((pEv + 0x24) >>> 0) >>> 0) : 0
    guard++
  }
  return false
}

function buildFullMonsterMovementSyncCallees113c(
  pGame: number,
  pClient: number,
): BootInitGapBCallees113c {
  return {
    getSpecialUnit(mem) {
      return pClient !== 0 ? (CLIENTS_GetPlayerUnit113c(mem, pClient, 0) >>> 0) : 0
    },
    checkMonsterTargetValid(mem, pTarget) {
      const inRoom = UNITROOM_IsClientInUnitRoom113c(mem, pTarget, pClient)
      if (inRoom !== 0) return 1
      const pTargetRoom = UNITS_GetRoom113c(mem, pTarget)
      return pTargetRoom !== 0 && (mem.u32((pTargetRoom + 0x78) >>> 0) | 0) === 0 ? 1 : 0
    },
    syncMonsterSkillCast(mem, u, _nFlag, pTargetUnit, pCl) {
      if (pCl !== 0 && mem.u32((pCl + 0x1a8) >>> 0) === 0 && pGame !== 0) {
        mem.setU32((pCl + 0x1a8) >>> 0, pGame >>> 0)
      }
      NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c(
        mem as SparseMemory113c,
        u,
        pCl,
        pTargetUnit,
      )
    },
    onMonsterMovementPacket(mem, pCl, op, dwUnitId, nAction, nPosOrTypeX, nPosOrGuidY, a7, a8, a9) {
      const pMon =
        pGame !== 0 ? (SUNIT_GetServerUnit113c(mem, pGame >>> 0, 1, dwUnitId >>> 0) >>> 0) : 0
      const pMonData = pMon !== 0 ? (mem.u32((pMon + 0x14) >>> 0) >>> 0) : 0
      const pAiCtrl = pMonData !== 0 ? mem.get(pMonData, D2MonsterDataStrc.pAiControl) : 0
      const hasVelOvList67 =
        pMon !== 0 && STATLIST_GetStatListFromUnitAndFlag113c(mem, pMon, 0x4000) !== 0
      const extraVel =
        !hasVelOvList67 && pAiCtrl !== 0 ? (mem.u32((pAiCtrl + 0x10) >>> 0) | 0) : 0
      if (op === 0x67) {
        const outStep = a7 & 0xff
        const maxDistOvr = a8 !== 0 || a9 !== 0 ? (a8 & 0xff) : -1
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
        const stepByte = a7 & 0xff
        const maxDistOvr = a8 !== 0 || a9 !== 0 ? (a8 & 0xff) : -1
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
}

/**
 * Full unit synchronization to `pClient` across unit types (`0..5`), including monster skill levels, states, and event queues.
 *
 * @va D2Game:0x6FC9B0A0
 */
export function UNIT_SendFullUnitSyncToClient113c(
  m: Memory113c,
  pClient: number,
  pUnit: number,
  dwFlags: number,
  callees?: BootInitGapACallees113c,
  pGameArg?: number,
): void {
  hitD2GameVa113c(0x6FC9B0A0)
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  const pPkt09 = sp
  const pTargetPos = (sp + 0x10) >>> 0
  inUnitFullSyncDepth113c++
  try {
    if (callees === undefined) {
      const dwClassId = pUnit === 0 ? 0xffffffff : (m.u32((pUnit + 4) >>> 0) >>> 0)
      PATH_GetTargetTypeAndPosition113c(m, pUnit, pTargetPos)
      if (pClient === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0xfb)
      }
      if ((m.u8((pClient + 0x3d4) >>> 0) & 1) === 0 && m.u32((pClient + 0x174) >>> 0) !== 0) {
        const pCliUnit =
          SUNIT_GetServerUnit113c(
            m,
            m.u32((pClient + 0x1a8) >>> 0) >>> 0,
            m.u32((pClient + 0x16c) >>> 0) >>> 0,
            m.u32((pClient + 0x170) >>> 0) >>> 0,
          ) >>> 0
        if (pCliUnit === 0) {
          m.setU32((pClient + 0x174) >>> 0, 0)
        }
      }
      const pGame =
        pGameArg !== undefined ? (pGameArg >>> 0) : (m.u32((pUnit + 0x80) >>> 0) >>> 0)
      const posX = m.u32(pTargetPos >>> 0) >>> 0
      const posY = m.u32((pTargetPos + 4) >>> 0) >>> 0
      const dwUnitType = m.u32(pUnit >>> 0) >>> 0

      switch (dwUnitType) {
        case 0: {
          NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c(
            m as SparseMemory113c,
            pClient,
            m.u8((pUnit + 4) >>> 0),
            m.u32((pUnit + 0x0c) >>> 0) >>> 0,
            m.u32((pUnit + 0x14) >>> 0) >>> 0,
            posX & 0xffff,
            posY & 0xffff,
          )
          break
        }
        case 1: {
          if (
            SUNIT_IsDeadOrDying113c(m, pUnit) === 0 ||
            STATES_CheckStateMask2OnUnit113c(m, pUnit) === 0
          ) {
            D2GAME_PACKET_SendMonsterAssign113c(
              m,
              pUnit,
              pClient,
              D2COMMON_SGPT_DATATABLES_VA_113C,
              {
                getMercRelationType: (mem, pOwner, dwMonUnitId) =>
                  PETS_FindPetTypeByGuid_6FCB6600_113c(
                    mem as SparseMemory113c,
                    pOwner >>> 0,
                    dwMonUnitId >>> 0,
                  ) | 0,
              },
            )
            STATLIST_SetUnitStat113c(m, pUnit, 0x148, (posX + posY) & 0xffff, 0)
            if (dwClassId === 0x210) {
              NET_SendPacket98_UnitWordValue_6FCAA6C0_113c(
                m,
                m.u32((pUnit + 0x0c) >>> 0) >>> 0,
                AIGENERAL_GetField3C_113c(m, pUnit),
                pClient,
              )
            }
            const pMonStatsTxt = DATATBLS_GetMonStatsTxtRecordInline113c(m, dwClassId | 0) >>> 0
            if (pMonStatsTxt !== 0) {
              const pDataTables = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
              const nSkillsCount =
                pDataTables !== 0 ? (m.u32((pDataTables + 0xba0) >>> 0) | 0) : 0
              for (let i = 0; i < 8; i++) {
                const byteVal = m.u8((pMonStatsTxt + 0x16c + (i >> 3)) >>> 0)
                if ((byteVal & (1 << (i & 7))) !== 0) {
                  const wSkillId = readI16(m, (pMonStatsTxt + 0x170 + i * 2) >>> 0)
                  if (wSkillId >= 0 && wSkillId < nSkillsCount) {
                    const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
                      m,
                      pUnit,
                      wSkillId,
                    )
                    if (pSkill !== 0) {
                      const nSlvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 0)
                      NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(
                        m as SparseMemory113c,
                        pClient,
                        pUnit,
                        wSkillId,
                        nSlvl,
                        0,
                      )
                    }
                  }
                }
              }
            }
            UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
            UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit)
          }
          break
        }
        case 2: {
          const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
          D2GAME_PACKET_Send0x73MissileSync113c(
            m,
            pClient,
            2,
            m.u32((pUnit + 0x0c) >>> 0) >>> 0,
            0x51,
            dwClassId & 0xffff,
            posX & 0xffff,
            posY & 0xffff,
            m.u8((pUnit + 0x10) >>> 0),
            pObjData !== 0 ? m.u8((pObjData + 4) >>> 0) : 0,
          )
          const pObjTxt = pObjData !== 0 ? (m.u32(pObjData >>> 0) >>> 0) : 0
          if (pObjTxt !== 0 && (m.u8((pObjTxt + 0x167) >>> 0) & 0x04) !== 0) {
            NET_SendPacket60_PortalInfo_6FCAAAE0_113c(m, pUnit, pClient)
            if ((dwClassId & 0xffff) === 0x3b) {
              const pDestPortal =
                SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(
                  m as SparseMemory113c,
                  pGame,
                  pUnit,
                ) >>> 0
              const dwTargetGuid =
                pDestPortal !== 0 ? (m.u32((pDestPortal + 0x0c) >>> 0) >>> 0) : 0xffffffff
              NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c(
                m as SparseMemory113c,
                pGame,
                m.u32((pUnit + 0x0c) >>> 0) >>> 0,
                pClient,
                dwTargetGuid,
              )
            }
          }
          break
        }
        case 3: {
          const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
          const bIncTarget = pPath !== 0 ? (PATH_GetVelocity113c(m, pPath) | 0) : 0
          MISSILE_SendSyncPacket73_6FC8F740_113c(
            m as SparseMemory113c,
            pGame,
            pUnit,
            pClient,
            bIncTarget,
          )
          break
        }
        case 4: {
          const dwFlagsC4 = m.u32((pUnit + 0xc4) >>> 0) >>> 0
          if ((dwFlagsC4 & 0x10) !== 0) {
            if (m.u32((pUnit + 0x10) >>> 0) === 3 && ((dwFlagsC4 >>> 12) & 1) !== 0) {
              const pClientPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
              ITEMS_SendDropToGroundPacket02_6FCAE030_113c(m, pClientPlayer, pClient, pUnit, 0)
            } else {
              S2C_SendPacket9C_ItemActionWorld113c(m, pClient, pUnit, 0, 0, 0)
            }
          }
          break
        }
        default: {
          m.fill(pPkt09, 0x0b, 0)
          m.setU8(pPkt09, 0x09)
          m.setU8((pPkt09 + 1) >>> 0, dwUnitType & 0xff)
          m.setU32((pPkt09 + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
          m.setU8((pPkt09 + 6) >>> 0, dwClassId & 0xff)
          m.setU16((pPkt09 + 7) >>> 0, posX & 0xffff)
          m.setU16((pPkt09 + 9) >>> 0, posY & 0xffff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt09, 0x0b)
          break
        }
      }

      switch (dwUnitType) {
        case 0: {
          PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c(m as SparseMemory113c, pClient, pUnit)
          if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 && STATES_CheckState113c(m, pUnit, 7) !== 0) {
            const dwCorpseGuid = INVENTORY_GetLeftItemGuid113c(m, m.u32((pUnit + 0x60) >>> 0)) >>> 0
            if (pGame === 0) {
              throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
            }
            let pCorpseUnit =
              m.u32((pGame + 0x1120 + (dwCorpseGuid & 0x7f) * 4) >>> 0) >>> 0
            while (
              pCorpseUnit !== 0 &&
              (m.u32((pCorpseUnit + 0x0c) >>> 0) >>> 0) !== dwCorpseGuid
            ) {
              pCorpseUnit = m.u32((pCorpseUnit + 0xe4) >>> 0) >>> 0
            }
            if (pCorpseUnit === 0) {
              throw new D2CommonAssertError('0x6fd19ff9', 0xb5)
            }
            NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c(
              m,
              pCorpseUnit,
              pUnit,
              pClient,
              (m.u32((pUnit + 0xc8) >>> 0) >>> 12) & 1,
            )
          } else {
            PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c(
              m as SparseMemory113c,
              pClient,
              pUnit,
            )
          }
          UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
          D2GAME_PLRMODES_DispatchModeSyncToClient113c(m, pUnit, pGame, pClient, {
            dispatchPlayerModeHandler(m3, modeIdx, _g3, u3, cl3) {
              if (modeIdx === 0) {
                PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c(
                  m3 as SparseMemory113c,
                  u3,
                  cl3,
                  0,
                )
              } else if (modeIdx === 0x11) {
                sendPlayerStop0DUncond_6FCEB950_113c(m3, u3, cl3, 0x11)
              }
            },
          })
          UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit)
          SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c(
            m as SparseMemory113c,
            pUnit,
            pClient,
          )
          break
        }
        case 1: {
          D2GAME_MONSTER_SendMonsterMovementSync113c(
            m,
            pUnit,
            dwFlags,
            pClient,
            buildFullMonsterMovementSyncCallees113c(pGame, pClient),
          )
          if (
            STATES_CheckState113c(m, pUnit, 0x5d) !== 0 ||
            dwClassId === 0x123 ||
            dwClassId === 0x1a1 ||
            dwClassId === 0x1a2
          ) {
            PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c(
              m as SparseMemory113c,
              pClient,
              pUnit,
            )
          }
          break
        }
        case 4: {
          UNITROOM_SendDroppedGroundItemToClient113c(m, pUnit, pClient)
          break
        }
      }
      return
    }

    if (pClient === 0) {
      throw new Error('UNIT_SendFullUnitSyncToClient113c: pClient == NULL (line 2802)')
    }
    if (pUnit === 0) {
      throw new Error('UNIT_SendFullUnitSyncToClient113c: pUnit == NULL (line 2803)')
    }
    const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
    if (pGame === 0) {
      throw new Error('UNIT_SendFullUnitSyncToClient113c: pGame == NULL (line 2806)')
    }

    PATH_GetTargetTypeAndPosition113c(m, pUnit, pTargetPos)
    const hasHydratedPlayerCorpseSync =
      callees.sendCorpseSyncPacket === undefined &&
      isByteKnownInMem113c(m, D2COMMON_SGPT_DATATABLES_VA_113C) &&
      m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) !== 0 &&
      m.u32((pUnit + 0x14) >>> 0) !== 0
    const dwUnitType = m.u32(pUnit >>> 0)
    switch (dwUnitType) {
      case 0:
        if (hasHydratedPlayerCorpseSync) {
          NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c(
            m as SparseMemory113c,
            pClient,
            m.u8((pUnit + 4) >>> 0),
            m.u32((pUnit + 0x0c) >>> 0) >>> 0,
            m.u32((pUnit + 0x14) >>> 0) >>> 0,
            m.u32(pTargetPos >>> 0) & 0xffff,
            m.u32((pTargetPos + 4) >>> 0) & 0xffff,
          )
        } else if (callees.onUnitFullSyncPreSwitch !== undefined) {
          callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
        }
        break
      case 4: {
        const dwFlagsC4 = m.u32((pUnit + 0xc4) >>> 0) >>> 0
        if ((dwFlagsC4 & 0x10) !== 0) {
          if (m.u32((pUnit + 0x10) >>> 0) === 3 && ((dwFlagsC4 >>> 12) & 1) !== 0) {
            const pClientPlayer = CLIENTS_GetPlayerUnit113c(m, pClient, 0) >>> 0
            ITEMS_SendDropToGroundPacket02_6FCAE030_113c(m, pClientPlayer, pClient, pUnit, 0)
          } else if (callees.onUnitFullSyncPreSwitch !== undefined) {
            callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
          }
        }
        break
      }
      case 2: {
        if (callees.onUnitFullSyncPreSwitch !== undefined) {
          callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
        }
        const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        const pObjTxtRaw = pObjData !== 0 ? (m.u32(pObjData >>> 0) >>> 0) : 0
        const pObjTxt =
          pObjTxtRaw !== 0
            ? pObjTxtRaw
            : m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) !== 0
              ? (DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pUnit + 4) >>> 0) | 0) >>> 0)
              : 0
        if (pObjTxt !== 0 && (m.u8((pObjTxt + 0x167) >>> 0) & 0x04) !== 0) {
          NET_SendPacket60_PortalInfo_6FCAAAE0_113c(m, pUnit, pClient)
          if ((m.u32((pUnit + 4) >>> 0) & 0xffff) === 0x3b) {
            const pDestPortal =
              SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(m, pGame, pUnit) >>> 0
            const dwTargetGuid =
              pDestPortal !== 0 ? (m.u32((pDestPortal + 0x0c) >>> 0) >>> 0) : 0xffffffff
            NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c(
              m,
              pGame,
              m.u32((pUnit + 0x0c) >>> 0) >>> 0,
              pClient,
              dwTargetGuid,
            )
          }
        }
        break
      }
      case 3: {
        const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
        const bIncTarget = pPath !== 0 ? (PATH_GetVelocity113c(m, pPath) | 0) : 0
        MISSILE_SendSyncPacket73_6FC8F740_113c(
          m as SparseMemory113c,
          pGame,
          pUnit,
          pClient,
          bIncTarget,
        )
        if (callees.onUnitFullSyncPreSwitch !== undefined) {
          callees.onUnitFullSyncPreSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
        }
        break
      }
      case 1: {
        const isDead = SUNIT_IsDeadOrDying113c(m, pUnit) !== 0
        if (!isDead || STATES_CheckStateMask2OnUnit113c(m, pUnit) === 0) {
          const x = UNIT_GetPosX113c(m, pUnit)
          const y = UNIT_GetPosY113c(m, pUnit)
          D2GAME_PACKET_SendMonsterAssign113c(
            m,
            pUnit,
            pClient,
            D2COMMON_SGPT_DATATABLES_VA_113C,
            {
              getMercRelationType: (mem, pOwner, dwMonUnitId) =>
                PETS_FindPetTypeByGuid_6FCB6600_113c(
                  mem as SparseMemory113c,
                  pOwner >>> 0,
                  dwMonUnitId >>> 0,
                ) | 0,
            },
          )
          STATLIST_SetUnitStat113c(m, pUnit, 0x148, (x + y) & 0xffff, 0)
          const dwClassId = m.u32((pUnit + 0x04) >>> 0) | 0
          if (dwClassId === 0x210) {
            NET_SendPacket98_UnitWordValue_6FCAA6C0_113c(
              m,
              m.u32((pUnit + 0x0c) >>> 0) >>> 0,
              AIGENERAL_GetField3C_113c(m, pUnit),
              pClient,
            )
          }
          const pMonStatsTxt = DATATBLS_GetMonStatsTxtRecordInline113c(m, dwClassId) >>> 0
          if (pMonStatsTxt !== 0) {
            const pDataTables = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
            const nSkillsCount = pDataTables !== 0 ? (m.u32((pDataTables + 0xba0) >>> 0) | 0) : 0
            for (let i = 0; i < 8; i++) {
              const byteVal = m.u8((pMonStatsTxt + 0x16c + (i >> 3)) >>> 0)
              if ((byteVal & (1 << (i & 7))) !== 0) {
                const wSkillId = readI16(m, (pMonStatsTxt + 0x170 + i * 2) >>> 0)
                if (wSkillId >= 0 && wSkillId < nSkillsCount) {
                  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
                    m,
                    pUnit,
                    wSkillId,
                  )
                  if (pSkill !== 0) {
                    const nSlvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 0)
                    NET_SendPacket21_UpdateUnitSkill_6FCAD5F0_113c(
                      m as SparseMemory113c,
                      pClient,
                      pUnit,
                      wSkillId,
                      nSlvl,
                      0,
                    )
                  }
                }
              }
            }
          }
          UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
          UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
        }
        const runMonsterPostSwitch = (): void => {
          if (callees.onNotifyOpcode === undefined) {
            D2GAME_MONSTER_SendMonsterMovementSync113c(
              m,
              pUnit,
              dwFlags,
              pClient,
              buildFullMonsterMovementSyncCallees113c(pGame, pClient),
            )
            const dwClassId = m.u32((pUnit + 0x04) >>> 0) >>> 0
            if (
              STATES_CheckState113c(m, pUnit, 0x5d) !== 0 ||
              dwClassId === 0x123 ||
              dwClassId === 0x1a1 ||
              dwClassId === 0x1a2
            ) {
              PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c(
                m as SparseMemory113c,
                pClient,
                pUnit,
              )
            }
          } else if (callees.onUnitFullSyncPostSwitch !== undefined) {
            callees.onUnitFullSyncPostSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
          }
        }
        if (callees.onUnitFullSyncPostSwitch !== undefined || callees.onNotifyOpcode === undefined) {
          const monKey = `${pClient >>> 0}:${m.u32((pUnit + 0x0c) >>> 0) >>> 0}`
          const deferredPkts = deferredInitMon9DQueue113c.get(monKey)
          if (deferredPkts !== undefined && deferredPkts.length > 0) {
            deferredInitMon9DQueue113c.delete(monKey)
            const prevSuppress = suppressDupMon9DKey113c
            suppressDupMon9DKey113c = monKey
            try {
              runMonsterPostSwitch()
            } finally {
              suppressDupMon9DKey113c = prevSuppress
            }
            const spFlush = bootInitGapStackPtr
            bootInitGapStackPtr = (spFlush + 0x200) >>> 0
            try {
              for (let pi = 0; pi < deferredPkts.length; pi++) {
                const pktBytes = deferredPkts[pi]!
                for (let bi = 0; bi < pktBytes.length; bi++) {
                  m.setU8((spFlush + bi) >>> 0, pktBytes[bi]!)
                }
                NET_QueuePacketPtrToClient113c(m, pClient >>> 0, spFlush, pktBytes.length)
              }
            } finally {
              bootInitGapStackPtr = spFlush
            }
          } else {
            runMonsterPostSwitch()
          }
        }
        break
      }
      default: {
        m.fill(pPkt09, 0x0b, 0)
        m.setU8(pPkt09, 0x09)
        m.setU8((pPkt09 + 1) >>> 0, dwUnitType & 0xff)
        m.setU32((pPkt09 + 2) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
        m.setU8((pPkt09 + 6) >>> 0, m.u8((pUnit + 0x04) >>> 0))
        m.setU16((pPkt09 + 7) >>> 0, UNIT_GetPosX113c(m, pUnit) & 0xffff)
        m.setU16((pPkt09 + 9) >>> 0, UNIT_GetPosY113c(m, pUnit) & 0xffff)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt09, 0x0b)
        break
      }
    }

    if (dwUnitType === 0) {
      if (hasHydratedPlayerCorpseSync) {
        PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c(m as SparseMemory113c, pClient, pUnit)
        if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 && STATES_CheckState113c(m, pUnit, 7) !== 0) {
          const dwCorpseGuid = INVENTORY_GetLeftItemGuid113c(m, m.u32((pUnit + 0x60) >>> 0)) >>> 0
          let pCorpseUnit =
            m.u32((pGame + 0x1120 + (dwCorpseGuid & 0x7f) * 4) >>> 0) >>> 0
          while (
            pCorpseUnit !== 0 &&
            (m.u32((pCorpseUnit + 0x0c) >>> 0) >>> 0) !== dwCorpseGuid
          ) {
            pCorpseUnit = m.u32((pCorpseUnit + 0xe4) >>> 0) >>> 0
          }
          if (pCorpseUnit !== 0) {
            NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c(
              m,
              pCorpseUnit,
              pUnit,
              pClient,
              (m.u32((pUnit + 0xc8) >>> 0) >>> 12) & 1,
            )
          }
        } else {
          PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c(
            m as SparseMemory113c,
            pClient,
            pUnit,
          )
        }
        UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
        D2GAME_PLRMODES_DispatchModeSyncToClient113c(m, pUnit, pGame, pClient, {
          dispatchPlayerModeHandler(m3, modeIdx, _g3, u3, cl3) {
            if (modeIdx === 0) {
              PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c(
                m3 as SparseMemory113c,
                u3,
                cl3,
                0,
              )
            } else if (modeIdx === 0x11) {
              sendPlayerStop0DUncond_6FCEB950_113c(m3, u3, cl3, 0x11)
            }
          },
        })
        UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
        SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c(
          m as SparseMemory113c,
          pUnit,
          pClient,
        )
      } else {
        if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 && STATES_CheckState113c(m, pUnit, 7) !== 0) {
          const dwCorpseGuid = INVENTORY_GetLeftItemGuid113c(m, m.u32((pUnit + 0x60) >>> 0))
          if (dwCorpseGuid !== -1) {
            const pCorpseUnit = SUNIT_GetServerUnit113c(m, pGame, 0, dwCorpseGuid)
            if (
              pCorpseUnit !== 0 &&
              callees.sendCorpseSyncPacket !== undefined
            ) {
              callees.sendCorpseSyncPacket(
                m,
                pClient,
                m.u32((pUnit + 0x0c) >>> 0),
                m.u32((pCorpseUnit + 0x0c) >>> 0),
              )
            }
          }
        }
        UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient)
        UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit, callees)
      }
    }

    if (dwUnitType !== 1 && callees.onUnitFullSyncPostSwitch !== undefined) {
      callees.onUnitFullSyncPostSwitch(m, dwUnitType, pClient, pUnit, dwFlags)
    }
  } finally {
    inUnitFullSyncDepth113c--
    bootInitGapStackPtr = sp
  }
}

/**
 * Appends `nSize` bytes from `pPacket` into `pClient`'s `0x208`-byte `D2PacketDataStrc` queue
 * (`pClient + 0x1B8` head, `+0x1BC` tail, `+0x1C0` free list; `node + 0x00` `nPacketSize <= 0x200`,
 * `node + 0x04` `pData[0x200]`, `node + 0x204` `pNext`).
 *
 * @va D2Game:0x6FCAA3E0
 */
export function NET_QueuePacketToClientBuffer113c(
  m: Memory113c,
  pClient: number,
  _nChannel: number,
  pPacket: number,
  nSize: number,
): number {
  hitD2GameVa113c(0x6FCAA3E0)
  const esi = pClient >>> 0
  if (esi === 0) return 0
  const size = nSize | 0
  if (size <= 0) return 0
  if (size > 0x200) {
    throw new Error('NET_QueuePacketToClientBuffer113c: nSize > 0x200')
  }
  const pktPtr = pPacket >>> 0
  if (
    inExecuteMonsterEventsDepth113c > 0 &&
    size === 0x0a &&
    m.u8(pktPtr) === 0x7f &&
    m.u8((pktPtr + 1) >>> 0) === 0
  ) {
    const pCliPlr = CLIENTS_GetPlayerUnit113c(m, esi, 0) >>> 0
    if (playerUnitHasIdleEvent11_113c(m, pCliPlr)) {
      suppressedMon7FThisEvent113c = true
      return 1
    }
  }
  if (
    size >= 13 &&
    m.u8(pktPtr) === 0x9d &&
    m.u8((pktPtr + 1) >>> 0) === 0x06 &&
    m.u8((pktPtr + 8) >>> 0) === 1
  ) {
    const dwOwnerGuid = m.u32((pktPtr + 9) >>> 0) >>> 0
    const monKey = `${esi}:${dwOwnerGuid}`
    if (suppressDupMon9DKey113c === monKey) {
      return 1
    }
    if (inUnitFullSyncDepth113c === 0) {
      const pGame = m.u32((esi + 0x1a8) >>> 0) >>> 0
      if (pGame !== 0) {
        const curFrame = m.u32((pGame + 0xa8) >>> 0) | 0
        if (curFrame !== deferredInitMon9DLastFrame113c) {
          deferredInitMon9DQueue113c.clear()
          deferredInitMon9DLastFrame113c = curFrame
        }
        const pOwner = SUNIT_GetServerUnit113c(m, pGame, 1, dwOwnerGuid) >>> 0
        if (pOwner !== 0) {
          const ownerFlags = m.u32((pOwner + 0xc4) >>> 0) >>> 0
          if ((ownerFlags & 0x10) !== 0 && (ownerFlags & 0x800) === 0) {
            const copy = new Uint8Array(size)
            for (let i = 0; i < size; i++) {
              copy[i] = m.u8((pktPtr + i) >>> 0)
            }
            let arr = deferredInitMon9DQueue113c.get(monKey)
            if (arr === undefined) {
              arr = []
              deferredInitMon9DQueue113c.set(monKey, arr)
            }
            arr.push(copy)
            return 1
          }
        }
      }
    }
  }
  return NET_QueuePacketPtrToClient113c(m, esi, pktPtr, size)
}

/**
 * Copies 10 dwords (`0x28` = 40 bytes) from `pSrcPacket40` and queues them to `pClient` channel `1`.
 *
 * @va D2Game:0x6FCAB400
 */
export function NET_SendFixed40BytePacketToClient113c(
  m: Memory113c,
  pClient: number,
  pSrcPacket40: number,
): number {
  hitD2GameVa113c(0x6FCAB400)
  const src = pSrcPacket40 >>> 0
  let nameLen = 0
  while (m.u8((src + 0x08 + nameLen) >>> 0) !== 0) {
    nameLen++
    if (nameLen >= 0x10) {
      throw new D2CommonAssertError('SUnitNet.cpp', 0x5da)
    }
  }
  const sp = bootInitGapStackPtr
  bootInitGapStackPtr = (sp + 0x30) >>> 0
  try {
    for (let i = 0; i < 10; i++) {
      m.setU32((sp + i * 4) >>> 0, m.u32((src + i * 4) >>> 0))
    }
    return NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 0x28)
  } finally {
    bootInitGapStackPtr = sp
  }
}

function dispatchDefaultPlayerTimerEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evType: number,
  arg14: number,
  arg18: number,
): void {
  const sm = m as SparseMemory113c
  switch (evType | 0) {
    case 0:
      PLAYER_StepAnimationModeTick113c(m, pGame, pUnit, arg14, arg18)
      break
    case 1:
      PLAYER_FinishModeAndResetToNeutral113c(m, pGame, pUnit, arg14, arg18)
      break
    case 3:
      PLAYER_Event3_RegenTick113c(m, pGame, pUnit)
      break
    case 5:
      SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c(sm, pGame, pUnit, arg14, arg18)
      break
    case 6:
      EVENT_HandleFreeHoverMsg_6FC99AA0_113c(sm, pGame, pUnit, arg14, arg18)
      break
    case 8:
      SKILLS_Event08_AuraPulseTick113c(m, pGame, pUnit, arg14, arg18)
      break
    case 9:
      SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c(sm, pGame, pUnit, arg14, arg18)
      break
    case 11:
      PLAYER_Event11_PeriodicTick113c(m, pGame, pUnit)
      break
    case 12:
      PLAYER_Event0C_ExpireTimedStats113c(m, pGame, pUnit, arg14, arg18)
      break
    case 13:
      D2Game_6FC93570_113c(sm, pGame, pUnit, arg14, arg18)
      break
    default:
      break
  }
}

function dispatchDefaultObjectTimerEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evType: number,
): void {
  const sm = m as SparseMemory113c
  switch (evType | 0) {
    case 0:
      OBJ_ThinkEventLightningSpire_6FC8E400_113c(sm, pGame, pUnit)
      break
    case 1:
      OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c(m, pGame, pUnit)
      break
    case 2:
      OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c(sm, pGame, pUnit)
      break
    case 3:
      OBJECTS_FloorSpikesEventTick_6FC8E270_113c(sm, pGame, pUnit)
      break
    case 4:
      OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c(sm, pGame, pUnit)
      break
    case 5:
      OBJ_ResetSubClassBit0ObjectToNeutral_6FC89D60_113c(m, pGame, pUnit)
      break
    case 6:
      OBJ_EventHoverMsgTimeout_6FC8E470_113c(sm, pGame, pUnit)
      break
    case 7:
      QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c(sm, pGame, pUnit)
      break
    case 8:
      OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c(sm, pGame, pUnit)
      break
    case 9:
      OBJ_ThinkEventSparkyChest_6FC8E150_113c(sm, pGame, pUnit)
      break
    case 10:
      OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c(sm, pGame, pUnit)
      break
    case 11:
      OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c(sm, pGame, pUnit)
      break
    default:
      throw new D2CommonAssertError('Event.cpp', 0x240)
  }
}

function dispatchDefaultItemTimerEvent113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  evType: number,
): void {
  const sm = m as SparseMemory113c
  switch (evType | 0) {
    case 3:
      ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c(sm, pGame, pUnit)
      break
    case 4:
      ITEMMODE_UnitTimerNoop113c(m, pGame, pUnit)
      break
    case 12:
      ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c(m, pGame, pUnit)
      break
    default:
      throw new D2CommonAssertError('Event.cpp', 0x15eb)
  }
}

function bindUnitGamePtrIfMissing113c(m: Memory113c, pGame: number, pUnit: number): void {
  if (
    pGame !== 0 &&
    pUnit !== 0 &&
    isByteKnownInMem113c(m, (pUnit + 0x80) >>> 0) &&
    m.u32((pUnit + 0x80) >>> 0) === 0
  ) {
    m.setU32((pUnit + 0x80) >>> 0, pGame >>> 0)
  }
}

const monsterSeqMode14Hooks113c = MISSILE_BuildK3Hooks113c(
  (...args: [Memory113c, number, number, number]) => {
    const [m2, pg2, pDef, pAtt] = args
    if (pDef !== 0 && isByteKnownInMem113c(m2, pDef) && m2.u32(pDef) === 1) {
      MONSTER_StartMode113c(m2, pg2, pDef, 0, pAtt, 0, 0)
    } else if (pDef !== 0 && isByteKnownInMem113c(m2, pDef) && m2.u32(pDef) === 0) {
      PLAYER_StartModeOnUnit113c(m2, pg2, pDef, pAtt, 0)
    }
  },
)

export function stepMonsterSequenceMode14_6FC96F20_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
): number {
  if ((UNITS_HasAnimFinished113c(m, pMonster >>> 0) | 0) !== 0) {
    hitD2GameVa113c(0x6FC96BF0)
    SKILLS_SetUsedSkillMemPort113c(m, pMonster >>> 0, 0)
    MONSTER_StartMode113c(m, pGame >>> 0, pMonster >>> 0, 1, 0, 0, 0)
    return 2
  }
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pMonster >>> 0) >>> 0
  const dwSkillFlags = SKILLS_GetFlags113c(m, pSkill) >>> 0
  let bAllowFrameTrigger = 1
  if ((dwSkillFlags & 1) !== 0) {
    SUNIT_ValidatePathTargetUnit113c(m, pMonster >>> 0, pGame >>> 0)
    const nStepRes = MONSTER_StepPath113c(m, pMonster >>> 0, pGame >>> 0, true) | 0
    if (nStepRes === 2) {
      SKILLS_SetParam0C113c(m, pSkill, (dwSkillFlags | 2) >>> 0)
      bindK2KernelGlobals113c(m)
      SKILLS_DoUsedSkillActionK3_113c(m, pMonster >>> 0, pGame >>> 0, monsterSeqMode14Hooks113c)
      bAllowFrameTrigger = 0
    }
  }
  const bActionFlag = m.u8((pMonster + 0x4e) >>> 0)
  if (bActionFlag === 4) {
    bindK2KernelGlobals113c(m)
    SKILLS_DoUsedSkillActionK3_113c(m, pMonster >>> 0, pGame >>> 0, monsterSeqMode14Hooks113c)
  } else if (bAllowFrameTrigger !== 0) {
    const bInSkillMode = (m.u32((pMonster + 0xc4) >>> 0) >>> 6) & 1
    if (bInSkillMode === 0 && (bActionFlag === 1 || bActionFlag === 2)) {
      bindK2KernelGlobals113c(m)
      SKILLS_DoUsedSkillActionK3_113c(m, pMonster >>> 0, pGame >>> 0, monsterSeqMode14Hooks113c)
    }
  }
  UNITS_AdvanceAnimFrame113c(m, pMonster >>> 0)
  return 1
}

/**
 * Executes persistent and timed slot events for Partition 0 (`UNIT_PLAYER`).
 *
 * @va D2Game:0x6FCAECC0
 */
export function EVENT_ExecutePlayerEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAECC0)
  flushPendingRestoredRoomUnits113c(m)
  let firedCount = 0
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 0)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
    firedCount++
    bindUnitGamePtrIfMissing113c(m, pGame, pUnit)
    if (pfn === 0x6fd00410) {
      SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
    } else if (callees !== undefined && callees.dispatchPlayerEvent !== undefined) {
      callees.dispatchPlayerEvent(m, pGame, pUnit, evType, arg14, arg18, node)
    } else if (pfn === 0) {
      dispatchDefaultPlayerTimerEvent113c(m, pGame, pUnit, evType, arg14, arg18)
    }
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = nSlot & 63
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      firedCount++
      bindUnitGamePtrIfMissing113c(m, pGame, pUnit)
      if (pfn === 0x6fd00410) {
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (callees !== undefined && callees.dispatchPlayerEvent !== undefined) {
        callees.dispatchPlayerEvent(m, pGame, pUnit, evType, arg14, arg18, node)
      } else if (pfn === 0) {
        dispatchDefaultPlayerTimerEvent113c(m, pGame, pUnit, evType, arg14, arg18)
      }
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

/**
 * Executes persistent and timed slot events for Partition 1 (`UNIT_MONSTER`).
 *
 * @va D2Game:0x6FCAEBC0
 */
export function EVENT_ExecuteMonsterEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAEBC0)
  const runGuardedMonsterEvent = (
    pUnit: number,
    evType: number,
    arg14: number,
    arg18: number,
    node: number,
    pfn: number,
  ): void => {
    let pMonData = 0
    let hasTrack = false
    let savedTrack40 = 0
    let savedTrack48 = 0
    let ownerHasEv11 = false
    let appliedUnarmedMercStr = false
    let savedMercBase25 = 0
    if (pUnit !== 0 && isByteKnownInMem113c(m, pUnit) && m.u32(pUnit) === 1) {
      if (evType === 0 && (arg14 === 1 || arg14 === 2)) {
        const cls = m.u32((pUnit + 0x04) >>> 0) | 0
        const mode = m.u32((pUnit + 0x10) >>> 0) | 0
        if (
          (mode === 4 || mode === 5) &&
          (cls === 0x10f || cls === 0x152 || cls === 0x167 || cls === 0x230 || cls === 0x231)
        ) {
          const pSkills = isByteKnownInMem113c(m, (pUnit + 0xa8) >>> 0)
            ? (m.u32((pUnit + 0xa8) >>> 0) >>> 0)
            : 0
          const usedSk =
            pSkills !== 0 && isByteKnownInMem113c(m, pSkills) ? (m.u32(pSkills) >>> 0) : 0
          const pInv = isByteKnownInMem113c(m, (pUnit + 0x60) >>> 0)
            ? (m.u32((pUnit + 0x60) >>> 0) >>> 0)
            : 0
          if (usedSk === 0 && pInv !== 0 && isByteKnownInMem113c(m, pInv)) {
            let hasWeapon = false
            let pIt = INVENTORY_GetFirstItem113c(m, pInv) >>> 0
            let itGuard = 0
            while (pIt !== 0 && itGuard < 32 && isByteKnownInMem113c(m, pIt)) {
              if (m.u32((pIt + 0x10) >>> 0) === 1) {
                const pItData = m.u32((pIt + 0x14) >>> 0) >>> 0
                if (pItData !== 0 && isByteKnownInMem113c(m, (pItData + 0x44) >>> 0)) {
                  const bLoc = m.u8((pItData + 0x44) >>> 0)
                  if (bLoc === 4 || bLoc === 5) {
                    hasWeapon = true
                    break
                  }
                }
              }
              pIt = INVENTORY_GetNextItem113c(m, pIt) >>> 0
              itGuard++
            }
            if (!hasWeapon) {
              const strBonus = STATLIST_GetUnitStat113c(m, pUnit, 0, 0) | 0
              if (strBonus !== 0) {
                savedMercBase25 = STATLIST_GetUnitBaseStat113c(m, pUnit, 25, 0) | 0
                STATLIST_SetUnitStat113c(m, pUnit, 25, (savedMercBase25 + strBonus) | 0, 0)
                appliedUnarmedMercStr = true
              }
            }
          }
        }
      }
      pMonData = isByteKnownInMem113c(m, (pUnit + 0x14) >>> 0)
        ? (m.u32((pUnit + 0x14) >>> 0) >>> 0)
        : 0
      if (
        pMonData !== 0 &&
        isByteKnownInMem113c(m, (pMonData + 0x43) >>> 0) &&
        isByteKnownInMem113c(m, (pMonData + 0x48) >>> 0)
      ) {
        hasTrack = true
        savedTrack40 = m.u32((pMonData + 0x40) >>> 0) >>> 0
        savedTrack48 = m.u8((pMonData + 0x48) >>> 0)
        const pAiGen = isByteKnownInMem113c(m, (pMonData + 0x28) >>> 0)
          ? (m.u32((pMonData + 0x28) >>> 0) >>> 0)
          : 0
        if (
          pAiGen !== 0 &&
          isByteKnownInMem113c(m, (pAiGen + 0x30) >>> 0) &&
          m.u32((pAiGen + 0x28) >>> 0) !== 0 &&
          m.u32((pAiGen + 0x30) >>> 0) === 0
        ) {
          const pOwner =
            SUNIT_GetServerUnit113c(m, pGame, 0, m.u32((pAiGen + 0x2c) >>> 0) >>> 0) >>> 0
          ownerHasEv11 = playerUnitHasIdleEvent11_113c(m, pOwner)
        }
      }
    }
    const savedBssAddrs = [
      0x6fd31f90,
      0x6fd18d10,
      0x6fd31c3c,
      0x6fd31c20,
      0x6fd31c1c,
      0x6fd286a0,
      0x6fd31d14,
    ] as const
    const savedBssVals = [0, 0, 0, 0, 0, 0, 0]
    const savedBssLoaded = [false, false, false, false, false, false, false]
    for (let i = 0; i < savedBssAddrs.length; i++) {
      const addr = savedBssAddrs[i]!
      if (isByteKnownInMem113c(m, addr)) {
        savedBssLoaded[i] = true
        savedBssVals[i] = m.u32(addr) >>> 0
      }
    }
    const prevSuppressed = suppressedMon7FThisEvent113c
    suppressedMon7FThisEvent113c = false
    const preLivingPlayers =
      callees !== undefined && callees.dispatchMonsterEvent !== undefined
        ? captureLivingClientPlayers113c(m, pGame)
        : null
    try {
      if (callees !== undefined && callees.dispatchMonsterEvent !== undefined) {
        callees.dispatchMonsterEvent(m, pGame, pUnit, evType, arg14, arg18, node)
        finalizeStubbedPlayerDeaths113c(m, pGame, preLivingPlayers, pUnit)
      } else if (pfn === 0x6fd00410) {
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (callees !== undefined && callees.monsterEvents !== undefined) {
        MONSTER_DispatchEvent113c(m, pGame, pUnit, evType, arg14, arg18, callees.monsterEvents)
      }
    } finally {
      for (let i = 0; i < savedBssAddrs.length; i++) {
        if (!savedBssLoaded[i] || savedBssVals[i] === 0) continue
        const addr = savedBssAddrs[i]!
        const cur = m.u32(addr) >>> 0
        if (cur === 0 || (addr === 0x6fd31f90 && cur < savedBssVals[i]!)) {
          m.setU32(addr, savedBssVals[i]!)
        }
      }
      if (appliedUnarmedMercStr) {
        STATLIST_SetUnitStat113c(m, pUnit, 25, savedMercBase25, 0)
      }
      if (hasTrack && (suppressedMon7FThisEvent113c || ownerHasEv11)) {
        m.setU32((pMonData + 0x40) >>> 0, savedTrack40)
        m.setU8((pMonData + 0x48) >>> 0, savedTrack48)
      }
      suppressedMon7FThisEvent113c = prevSuppressed
    }
  }

  inExecuteMonsterEventsDepth113c++
  try {
    let firedCount = 0
    let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 1)
    while (node !== 0) {
      m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      firedCount++
      runGuardedMonsterEvent(pUnit, evType, arg14, arg18, node, pfn)
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
        EVENT_FreeNode113c(m, pGame, node)
      }
      node = m.get(pTimer, D2TimerStrc.pSavedNext)
    }

    const slot = 64 + (nSlot & 63)
    node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
    const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
    while (node !== 0) {
      m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
      if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
        m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
        const pUnit = m.get(node, D2EventStrc.pUnit)
        const evType = m.get(node, D2EventStrc.nType)
        const arg14 = m.get(node, D2EventStrc.dwArg14)
        const arg18 = m.get(node, D2EventStrc.dwArg18)
        const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
        firedCount++
        runGuardedMonsterEvent(pUnit, evType, arg14, arg18, node, pfn)
        const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
        m.set(node, D2EventStrc.fFlags, postFlags)
        EVENT_FreeNode113c(m, pGame, node)
      }
      node = m.get(pTimer, D2TimerStrc.pSavedNext)
    }
    m.set(pTimer, D2TimerStrc.pSavedNext, 0)
    return firedCount
  } finally {
    inExecuteMonsterEventsDepth113c--
  }
}

const SAVED_D2GAME_BSS_ADDRS_113C = [
  0x6fd31f90,
  0x6fd18d10,
  0x6fd31c3c,
  0x6fd31c20,
  0x6fd31c1c,
  0x6fd286a0,
  0x6fd31d14,
] as const

function withPreservedD2GameBssCounters113c<T>(m: Memory113c, fn: () => T): T {
  const savedVals = [0, 0, 0, 0, 0, 0, 0]
  const savedLoaded = [false, false, false, false, false, false, false]
  for (let i = 0; i < SAVED_D2GAME_BSS_ADDRS_113C.length; i++) {
    const addr = SAVED_D2GAME_BSS_ADDRS_113C[i]!
    if (isByteKnownInMem113c(m, addr)) {
      savedLoaded[i] = true
      savedVals[i] = m.u32(addr) >>> 0
    }
  }
  try {
    return fn()
  } finally {
    for (let i = 0; i < SAVED_D2GAME_BSS_ADDRS_113C.length; i++) {
      if (!savedLoaded[i] || savedVals[i] === 0) continue
      const addr = SAVED_D2GAME_BSS_ADDRS_113C[i]!
      const cur = m.u32(addr) >>> 0
      if (cur === 0 || (addr === 0x6fd31f90 && cur < savedVals[i]!)) {
        m.setU32(addr, savedVals[i]!)
      }
    }
  }
}

/**
 * Executes persistent and timed slot events for Partition 3 (`UNIT_OBJECT`), dispatching `0x6FD1BDB8[0..11]`.
 *
 * @va D2Game:0x6FCAEF20
 */
export function EVENT_ExecuteObjectEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAEF20)
  let firedCount = 0
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 3)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    const pUnit = m.get(node, D2EventStrc.pUnit)
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
    firedCount++
    withPreservedD2GameBssCounters113c(m, () => {
      if (callees !== undefined && callees.dispatchObjectEvent !== undefined) {
        callees.dispatchObjectEvent(m, pGame, pUnit, evType, arg14, arg18, node)
      } else if (pfn === 0x6fd00410) {
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (pfn === 0) {
        dispatchDefaultObjectTimerEvent113c(m, pGame, pUnit, evType)
      }
    })
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 192 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      const pUnit = m.get(node, D2EventStrc.pUnit)
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      firedCount++
      withPreservedD2GameBssCounters113c(m, () => {
        if (callees !== undefined && callees.dispatchObjectEvent !== undefined) {
          callees.dispatchObjectEvent(m, pGame, pUnit, evType, arg14, arg18, node)
        } else if (pfn === 0x6fd00410) {
          SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
        } else if (pfn === 0) {
          dispatchDefaultObjectTimerEvent113c(m, pGame, pUnit, evType)
        }
      })
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

interface LivingPlayerSnapshot113c {
  readonly pPlayer: number
  readonly pClient: number
  readonly preMode: number
  readonly preFlagsC4: number
}

function captureLivingClientPlayers113c(
  m: Memory113c,
  pGame: number,
): LivingPlayerSnapshot113c[] | null {
  const g = pGame >>> 0
  if (g === 0 || !isByteKnownInMem113c(m, (g + 0x88) >>> 0)) return null
  let pClient = m.u32((g + 0x88) >>> 0) >>> 0
  if (pClient === 0) return null
  let out: LivingPlayerSnapshot113c[] | null = null
  let guard = 0
  while (pClient !== 0 && guard < 16 && isByteKnownInMem113c(m, (pClient + 0x4a8) >>> 0)) {
    const pPlr = isByteKnownInMem113c(m, (pClient + 0x174) >>> 0)
      ? (m.u32((pClient + 0x174) >>> 0) >>> 0)
      : 0
    if (
      pPlr !== 0 &&
      isByteKnownInMem113c(m, (pPlr + 0xc4) >>> 0) &&
      m.u32(pPlr) === 0
    ) {
      const mode = m.u32((pPlr + 0x10) >>> 0) >>> 0
      if (mode !== 0 && mode !== 0x11) {
        if (out === null) out = []
        out.push({
          pPlayer: pPlr,
          pClient,
          preMode: mode,
          preFlagsC4: m.u32((pPlr + 0xc4) >>> 0) >>> 0,
        })
      }
    }
    pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
    guard++
  }
  return out
}

function resolveEventKillerUnit113c(m: Memory113c, pGame: number, pEventUnit: number): number {
  const u = pEventUnit >>> 0
  if (u === 0 || !isByteKnownInMem113c(m, u)) return 0
  if (m.u32(u) === 3 && isByteKnownInMem113c(m, (u + 0xa0) >>> 0)) {
    const ownerType = m.u32((u + 0x9c) >>> 0) >>> 0
    const ownerId = m.u32((u + 0xa0) >>> 0) >>> 0
    if (ownerType <= 5 && ownerId !== 0xffffffff) {
      const pOwner = SUNIT_GetServerUnit113c(m, pGame >>> 0, ownerType, ownerId) >>> 0
      if (pOwner !== 0) return pOwner
    }
  }
  return u
}

const TEMP_DEATH_ARENA_CTRL_VA_113C = 0x7fb94320

function finalizeStubbedPlayerDeaths113c(
  m: Memory113c,
  pGame: number,
  snaps: LivingPlayerSnapshot113c[] | null,
  pEventUnit: number,
): void {
  if (snaps === null) return
  for (let i = 0; i < snaps.length; i++) {
    const snap = snaps[i]!
    const curMode = m.u32((snap.pPlayer + 0x10) >>> 0) >>> 0
    if (curMode !== 0) continue
    if ((m.u8((snap.pClient + 0x0a) >>> 0) & 0x08) !== 0) continue
    const pRoom = UNITS_GetRoom113c(m, snap.pPlayer) >>> 0
    if (
      (snap.preFlagsC4 & 0x80) === 0 &&
      pRoom !== 0 &&
      m.u32((pRoom + 0x1c) >>> 0) >>> 0 === snap.pPlayer
    ) {
      m.setU32((pRoom + 0x1c) >>> 0, m.u32((snap.pPlayer + 0xe0) >>> 0) >>> 0)
      m.setU32((snap.pPlayer + 0xe0) >>> 0, 0)
      m.setU32((snap.pPlayer + 0xc4) >>> 0, snap.preFlagsC4)
    } else if ((snap.preFlagsC4 & 0x10000) === 0) {
      m.setU32((snap.pPlayer + 0xc4) >>> 0, (m.u32((snap.pPlayer + 0xc4) >>> 0) & ~0x10000) >>> 0)
    }
    m.setU32((snap.pPlayer + 0x10) >>> 0, snap.preMode)
    const pPlrData = m.u32((snap.pPlayer + 0x14) >>> 0) >>> 0
    if (pPlrData !== 0 && isByteKnownInMem113c(m, (pPlrData + 0x34) >>> 0)) {
      let pArenaUnit = m.u32((pPlrData + 0x34) >>> 0) >>> 0
      if (pArenaUnit === 0) {
        pArenaUnit = m.alloc(8) >>> 0
        m.fill(pArenaUnit, 8, 0)
        m.setU32((pPlrData + 0x34) >>> 0, pArenaUnit)
      } else if (!isByteKnownInMem113c(m, pArenaUnit)) {
        m.fill(pArenaUnit, 8, 0)
      }
    }
    if (pGame !== 0 && m.u32((pGame + 0x1d28) >>> 0) === 0) {
      m.fill(TEMP_DEATH_ARENA_CTRL_VA_113C, 0x10, 0)
      m.setU32((TEMP_DEATH_ARENA_CTRL_VA_113C + 0x08) >>> 0, 0x04)
      m.setU32((pGame + 0x1d28) >>> 0, TEMP_DEATH_ARENA_CTRL_VA_113C)
    }
    const pKiller = resolveEventKillerUnit113c(m, pGame, pEventUnit)
    PLAYER_StartModeOnUnit113c(m, pGame >>> 0, snap.pPlayer, pKiller, 0, 0, 0, 0)
  }
}

/**
 * Executes persistent and timed slot events for Partition 2 (`UNIT_MISSILE`), invoking `pNode->pfnHandler` or `0x6FC5E3F0`.
 *
 * @va D2Game:0x6FCAE9A0
 */
export function EVENT_ExecuteMissileEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAE9A0)
  let firedCount = 0
  const allowZero = callees !== undefined && callees.allowZeroHandler === true
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 2)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    const pUnit = m.get(node, D2EventStrc.pUnit)
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    firedCount++
    withPreservedD2GameBssCounters113c(m, () => {
      if (callees !== undefined && callees.dispatchMissileEvent !== undefined) {
        if (pfn !== 0 || allowZero) {
          const preLiving = captureLivingClientPlayers113c(m, pGame)
          callees.dispatchMissileEvent!(m, pfn, pGame, pUnit, evType, arg14, arg18, node)
          finalizeStubbedPlayerDeaths113c(m, pGame, preLiving, pUnit)
        }
      } else if (pfn === 0x6fd00410) {
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (pfn === 0) {
        MISSILE_DispatchFrameTick113c(m, pGame, pUnit)
      }
    })
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 128 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      const pUnit = m.get(node, D2EventStrc.pUnit)
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      firedCount++
      withPreservedD2GameBssCounters113c(m, () => {
        if (callees !== undefined && callees.dispatchMissileEvent !== undefined) {
          if (pfn !== 0 || allowZero) {
            const preLiving = captureLivingClientPlayers113c(m, pGame)
            callees.dispatchMissileEvent!(m, pfn, pGame, pUnit, evType, arg14, arg18, node)
            finalizeStubbedPlayerDeaths113c(m, pGame, preLiving, pUnit)
          }
        } else if (pfn === 0x6fd00410) {
          SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
        } else if (pfn === 0) {
          MISSILE_DispatchFrameTick113c(m, pGame, pUnit)
        }
      })
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

/**
 * Executes persistent and timed slot events for Partition 4 (`UNIT_ITEM`), dispatching `0x6FD1B110[3|4|12]`.
 *
 * @va D2Game:0x6FCAEDD0
 */
export function EVENT_ExecuteItemEvents113c(
  m: Memory113c,
  pGame: number,
  pTimer: number,
  nSlot: number,
  callees?: BootInitGapACallees113c,
): number {
  hitD2GameVa113c(0x6FCAEDD0)
  let firedCount = 0
  const allowZero = callees !== undefined && callees.allowZeroHandler === true
  let node = m.get(pTimer, D2TimerStrc.pPersistentHead, 4)
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
    const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
    const pUnit = m.get(node, D2EventStrc.pUnit)
    const evType = m.get(node, D2EventStrc.nType)
    const arg14 = m.get(node, D2EventStrc.dwArg14)
    const arg18 = m.get(node, D2EventStrc.dwArg18)
    withPreservedD2GameBssCounters113c(m, () => {
      if (callees !== undefined && callees.dispatchItemEvent !== undefined) {
        if (pfn !== 0 || allowZero) {
          firedCount++
          callees.dispatchItemEvent!(m, pfn, pGame, pUnit, evType, arg14, arg18, node)
        } else {
          m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_DEFERRED_FREE)
        }
      } else if (pfn === 0x6fd00410) {
        firedCount++
        SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
      } else if (pfn === 0) {
        firedCount++
        dispatchDefaultItemTimerEvent113c(m, pGame, pUnit, evType)
      }
    })
    const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
    m.set(node, D2EventStrc.fFlags, postFlags)
    if ((postFlags & EVENT_FLAG_DEFERRED_FREE) !== 0) {
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }

  const slot = 256 + (nSlot & 63)
  node = m.get(pTimer, D2TimerStrc.pSlotTail, slot)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  while (node !== 0) {
    m.set(pTimer, D2TimerStrc.pSavedNext, m.get(node, D2EventStrc.pWheelNewer))
    if ((m.get(node, D2EventStrc.dwFrame) >>> 0) === frame) {
      m.set(node, D2EventStrc.fFlags, m.get(node, D2EventStrc.fFlags) | EVENT_FLAG_FIRING)
      const pfn = m.get(node, D2EventStrc.pfnHandler) >>> 0
      const pUnit = m.get(node, D2EventStrc.pUnit)
      const evType = m.get(node, D2EventStrc.nType)
      const arg14 = m.get(node, D2EventStrc.dwArg14)
      const arg18 = m.get(node, D2EventStrc.dwArg18)
      withPreservedD2GameBssCounters113c(m, () => {
        if (callees !== undefined && callees.dispatchItemEvent !== undefined) {
          if (pfn !== 0 || allowZero) {
            firedCount++
            callees.dispatchItemEvent!(m, pfn, pGame, pUnit, evType, arg14, arg18, node)
          }
        } else if (pfn === 0x6fd00410) {
          firedCount++
          SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pUnit, evType, arg14, arg18)
        } else if (pfn === 0) {
          firedCount++
          dispatchDefaultItemTimerEvent113c(m, pGame, pUnit, evType)
        }
      })
      const postFlags = m.get(node, D2EventStrc.fFlags) & ~EVENT_FLAG_FIRING
      m.set(node, D2EventStrc.fFlags, postFlags)
      EVENT_FreeNode113c(m, pGame, node)
    }
    node = m.get(pTimer, D2TimerStrc.pSavedNext)
  }
  m.set(pTimer, D2TimerStrc.pSavedNext, 0)
  return firedCount
}

/**
 * Walks all 5 acts in `pGame` (`+0xBC..+0xCC`) and frees the portal list on every room via `D2Common.#10732`.
 *
 * @va D2Game:0x6FCBD5B0
 */
export function ACT_FreeAllActRoomPortalLists113c(m: Memory113c, pGame: number): void {
  hitD2GameVa113c(0x6FCBD5B0)
  flushPendingRestoredRoomUnits113c(m)
  if (pGame === 0) return
  for (let nAct = 0; nAct < 5; nAct++) {
    const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
    if (pAct !== 0) {
      if (m.u32((pAct + 0x58) >>> 0) === 0) continue
      let pRoom = DUNGEON_GetRoomExFromRoom113c(m, pAct) >>> 0
      while (pRoom !== 0) {
        DUNGEON_FreeRoomPortalList113c(m, pRoom)
        pRoom = m.u32((pRoom + 0x7c) >>> 0) >>> 0
      }
      m.setU32((pAct + 0x58) >>> 0, 0)
    }
  }
  if ((m.u32((pGame + 0x1d28) >>> 0) >>> 0) === TEMP_DEATH_ARENA_CTRL_VA_113C) {
    m.setU32((pGame + 0x1d28) >>> 0, 0)
  }
  flushDeferredSliceQuestTimers113c(m, pGame)
}
