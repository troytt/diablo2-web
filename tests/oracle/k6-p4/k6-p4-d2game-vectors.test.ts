/**
 * [K6-P4] Real-DLL D2Game.dll (0x6FC40000..0x6FCBFFFF) Vector Suite (150 VAs).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  ARENA_CountPlayersInLevelCallback113c,
  QUESTS_CountLivingUnitsInRoomCallback113c,
  QUESTS_FreeUnitQuestChain113c,
  QUESTS_GuidListRemove113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f150-f276-113c'
import {
  MONSTER_GetSuperUniqueId113c,
  MONSTER_IsNextModeEndWithin5Frames113c,
  PARTY_CountLivingPartyMemberCallback113c,
  PLAYER_SetActiveDualWeaponStatLists113c,
  S2C_SendPacket0D_UnitStop113c,
  S2C_SendPacket0E_UnitCorpseState113c,
  SKILLS_CheckSkillManaAndCharges113c,
  UNITROOM_IsClientInUnitRoom113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c'
import {
  ROOM_SleepRoomMonsters113c,
  ROOM_WakeRoomMonsters113c,
} from '../../../src/d2kern-113c/game/act-rooms-113c'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  AIGENERAL_InitBossGroup113c,
  AIGENERAL_LinkMinionToLeader113c,
  AI_LookupDispatchTableRow113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_InitModeChangeStrc113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  PLRTRADE_CountCubePageItemsInInventory113c,
  PLRTRADE_IsInteractingWithValidPlayer113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import {
  CURSES_ScaleImmuneMonsterResistPenalty113c,
  ITEMS_RegisterItemEventCallback113c,
  UNITEVENT_RegisterTimerOrItemEventNode113c,
  UNIT_QueueSkillCastNotify99_113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import {
  ITEMEVENT_RemoveByTypeAndState113c,
  MISSILE_ApplyNextHitDelayState113c,
  MISSILE_CanCollideWithUnit113c,
  MISSILE_CollideFilterPlayerOrMonster113c,
  MISSILE_DestroyDataAndEvents113c,
  MISSILE_InitDataAndPersistentEvent113c,
  MISSILE_MatchTargetCollideKillMode113c,
  MISSILE_RollInitialPierceCount113c,
  MISSILE_RollMasteryStatRange113c,
  MONSTER_QueuePacket0xAB_LifeNotify113c,
  MONSTER_StartGetHitMode113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import {
  OBJECTS_SetUnitField7CDword4_113c,
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  PLAYER_SetClientSkillHotkeySlot113c,
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_GuidListAdd113c,
  QUESTS_SendNpcMessagePacket27_113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
  QUESTS_SendQuestItemState2_5D_113c,
  SUNIT_FindItemEventNode113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c'
import {
  MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c,
  MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c,
  MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c,
  OBJECTS_InitFn11_InitTownPortal_6FC53330_113c,
  OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c,
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_CheckGlobalQuestState_6FC538D0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  MISSILES_AddElemDamageByEType_6FC59260_113c,
  MISSILES_InitChargedBoltPath_6FC61F50_113c,
  MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c,
  PLAYER_SetPlayerDataField48_6FC57480_113c,
  QUESTS_SendGameQuestStatePacket29_6FC55030_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import {
  CLIENTS_GetClientGame_6FC69A80_113c,
  SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c,
  SKILLS_ApplySummonResistStatList_6FC6E180_113c,
  SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c,
  SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c,
  SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c'
import {
  ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c,
} from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c'
import {
  AIGENERAL_AllocAiCommand113c,
  MONSTER_SavePrevMode113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import {
  MONSTER_CountInteractingPlayers113c,
  MONSTER_IsPlayerInteractInTradeState113c,
  MONSTER_PromotePlayerInteractToTradeState113c,
  SKILLS_IsDimVisionOrTerrorState113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c'
import {
  PETS_AllocAndInitPlayerPetTable_6FCB7120_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import {
  MISSILE_ApplyFriendlyOwnerTimedSkillAura_6FC5EA60_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c,
  QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c,
} from '../../../src/d2kern-113c/game/k2-w2b2-113c'
import {
  NET_SendPacket103B_QuestRecord_6FCAAD40_113c,
  NET_SendPacket47_UnitRelator1_6FCAAEC0_113c,
  NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c,
  NET_SendPacket60_PortalInfo_6FCAAAE0_113c,
  NET_SendPacket77_ButtonAction_6FCAB340_113c,
  NET_SendPacket7A_SummonChange_6FCAB290_113c,
  NET_SendPacket81_AssignMerc_6FCAB220_113c,
  NET_SendPacketBuffer40B_6FCAB3D0_113c,
  NET_SendPacketBuffer6B_6FCAACD0_113c,
  NET_ShouldSyncTrackedStatDelta_6FCAA330_113c,
  OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b3-113c'
import {
  ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c,
  S2C_QueueByteDwordPacket6_6FCAC3B0_113c,
  SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c,
  SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c,
  SUMMON_GetPetTypeBucketPtr_6FCB6540_113c,
} from '../../../src/d2kern-113c/game/k2-w2b4-113c'
import {
  SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import {
  MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import {
  QUESTS_AttachUnitToQuest_6FC55890_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import {
  ACT5Intro_Callback00_NpcActivate_6FC796B0_113c,
  ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c,
  ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c,
  ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c,
  ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c,
  ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import {
  ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c,
  ACT1_IntroNpcActivate_6FC82E50_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import {
  MONSTER_ModeChangeCorpse_6FC95460_113c,
  MONSTER_ModeChangeKnockback_6FC95160_113c,
  QUESTS_AllocBitBufferPair_6FC89360_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c,
  UNITMSG_QueuePacket23SetSkill_6FC9A020_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import {
  MONUMOD_ApplyChampionFanaticStats_6FC43810_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c,
  NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c,
  PETS_FindPetArgByGuid_6FCB6570_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c,
  SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c,
  SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c,
  NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import {
  SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import {
  ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c,
  ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c,
  ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c,
  ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c,
  ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c,
  ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c,
  ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c,
  ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c,
  ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import {
  OBJECTS_OperateBankStash_6FC91290_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import {
  ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c'
import {
  PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import {
  MONSTER_ClearStepEvents113c,
} from '../../../src/d2kern-113c/game/monster-events'
import {
  OBJECTS_InitChestLockAndSeed113c,
  OBJECTS_RollChestTrapType113c,
  REGPOP_GetSpawnBoxSubtiles113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  CLIENTS_GetPlayerUnit113c,
  MONSTER_ApplyModeVelocityOverride113c,
} from '../../../src/d2kern-113c/game/replay-final11-113c'
import {
  EVENT_CreateNodeWithGrowth113c,
  EVENT_GetNextEventFrame113c,
} from '../../../src/d2kern-113c/game/timer-wheel'
import {
  ACT1Q4_CheckCainTownNpcAlert113c,
  AITHINK_CanPlayerSwitchToMode113c,
  D2NET_SendPacket0x06BytesToClient113c,
  D2NET_SendUnitMovePacket0x10BytesToClient113c,
  PLAYER_SetNeutralOrTownNeutralMode113c,
  PLAYER_SetPathTargetCoordsAndWalk113c,
  PLAYER_StartWalkOrRunMode113c,
  SPLAYER_GetClientActNo113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FC40CF0': (m, a) => AIGENERAL_LinkMinionToLeader113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC40D90': (m, a) => AIGENERAL_InitBossGroup113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC40F30': (m, a) => AIGENERAL_AllocAiCommand113c(m, a[0]!),
  '0x6FC41260': (m, a) => AIGENERAL_GetPackLeaderUnit113c(m, a[0]!),
  '0x6FC41A90': (m, a) => MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC41B30': (m, a) => MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC41EC0': (m, a) => MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c(m, a[0]!, a[1]!),
  '0x6FC42A80': (m, a) => MONSTER_CheckTypeFlagsMask113c(m, a[0]!, a[1]!),
  '0x6FC42FA0': (m, a) => MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC43220': (m, a) => MONSTER_GetSuperUniqueId113c(m, a[0]!),
  '0x6FC43810': (m, a) => MONUMOD_ApplyChampionFanaticStats_6FC43810_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC4A9F0': (m, a) => CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(m, a[0]!, a[1]!),
  '0x6FC4E4F0': (m, a) => OBJECTS_SetUnitField7CDword4_113c(m, a[0]!, a[1]!),
  '0x6FC4EA40': (m, a) => OBJECTS_RollChestTrapType113c(m, a[0]!),
  '0x6FC4ECB0': (m, a) => OBJECTS_InitChestLockAndSeed113c(m, a[0]!),
  '0x6FC53330': (m, a) => OBJECTS_InitFn11_InitTownPortal_6FC53330_113c(m, a[0]!),
  '0x6FC536F0': (m, a) => OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c(m, a[0]!),
  '0x6FC53830': (m, a) => QUESTS_GuidListRemove113c(m, a[0]!, a[1]!),
  '0x6FC53880': (m, a) => QUESTS_GuidListAdd113c(m, a[0]!, a[1]!),
  '0x6FC538D0': (m, a) => QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC53920': (m, a) => QUESTS_SetGlobalQuestState_6FC53920_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC53EB0': (m, a) => QUESTS_AddNpcDialogTextNodes113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC53F30': (m, a) => QUESTS_GetQuestData_6FC53F30_113c(m, a[0]!, a[1]!),
  '0x6FC53F80': (m, a) => QUESTS_AttachQuestToUnit_6FC53F80_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC54B20': (m, a) => QUESTS_SendQuestItemState2_5D_113c(m, a[0]!, a[1]!),
  '0x6FC54B80': (m, a) => QUESTS_SendNpcMessagePacket27_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC54C00': (m, a) => QUESTS_SendPlayerQuestLogPacket28_113c(m, a[0]!, a[1]!),
  '0x6FC55030': (m, a) => QUESTS_SendGameQuestStatePacket29_6FC55030_113c(m, a[0]!, a[1]!),
  '0x6FC55890': (m, a) => QUESTS_AttachUnitToQuest_6FC55890_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC570E0': (m, a) => SUNIT_FindItemEventNode113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC57110': (m, a) => ITEMEVENT_RemoveByTypeAndState113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC57190': (m, a) => UNITEVENT_RegisterTimerOrItemEventNode113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FC57220': (m, a) => QUESTS_FreeUnitQuestChain113c(m, a[0]!, a[1]!),
  '0x6FC57260': (m, a) => PLAYER_SetActiveDualWeaponStatLists113c(m, a[0]!, a[1]!),
  '0x6FC57480': (m, a) => PLAYER_SetPlayerDataField48_6FC57480_113c(m, a[0]!, a[1]!),
  '0x6FC57680': (m, a) => PLAYER_IsBusyWithCursorOrNpcInteract113c(m, a[0]!),
  '0x6FC57810': (m, a) => QUESTS_CountLivingUnitsInRoomCallback113c(m, a[0]!, a[1]!),
  '0x6FC57890': (m, a) => PLAYER_SetClientSkillHotkeySlot113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC58FB0': (m, a) => MISSILE_MatchTargetCollideKillMode113c(m, a[0]!, a[1]!),
  '0x6FC59260': (m, a) => MISSILES_AddElemDamageByEType_6FC59260_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC59670': (m, a) => MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC59B40': (m, a) => MISSILE_RollMasteryStatRange113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC5AA20': (m, a) => MISSILE_CanCollideWithUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC5AD30': (m, a) => MISSILE_CollideFilterPlayerOrMonster113c(m, a[0]!, a[1]!),
  '0x6FC5B140': (m, a) => MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5E590': (m, a) => MISSILE_ApplyNextHitDelayState113c(m, a[0]!, a[1]!),
  '0x6FC5EA60': (m, a) => MISSILE_ApplyFriendlyOwnerTimedSkillAura_6FC5EA60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC61F50': (m, a) => MISSILES_InitChargedBoltPath_6FC61F50_113c(m, a[0]!, a[1]!),
  '0x6FC66C30': (m, a) => REGPOP_GetSpawnBoxSubtiles113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC68390': (m, a) => MONSTER_CountInteractingPlayers113c(m, a[0]!),
  '0x6FC686D0': (m, a) => MONSTER_IsPlayerInteractInTradeState113c(m, a[0]!, a[1]!),
  '0x6FC68710': (m, a) => MONSTER_PromotePlayerInteractToTradeState113c(m, a[0]!, a[1]!),
  '0x6FC69A50': (m, a) => UNITROOM_IsClientInUnitRoom113c(m, a[0]!, a[1]!),
  '0x6FC69A80': (m, a) => CLIENTS_GetClientGame_6FC69A80_113c(m, a[0]!),
  '0x6FC69DB0': (m, a) => SPLAYER_GetClientActNo113c(m, a[0]!),
  '0x6FC6AD10': (m, a) => CLIENTS_GetPlayerUnit113c(m, a[0]!, a[1]!),
  '0x6FC6DF80': (m, a) => SKILLS_IsDimVisionOrTerrorState113c(m, a[0]!),
  '0x6FC6E180': (m, a) => SKILLS_ApplySummonResistStatList_6FC6E180_113c(m, a[0]!, a[1]!),
  '0x6FC6E230': (m, a) => CURSES_ScaleImmuneMonsterResistPenalty113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC6E960': (m, a) => SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6ECD0': (m, a) => SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC6EF20': (m, a) => SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC700A0': (m, a) => SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC77270': (m, a) => ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c(m, a[0]!, a[1]!),
  '0x6FC78A40': (m, a) => ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c(m, a[0]!, a[1]!),
  '0x6FC796B0': (m, a) => ACT5Intro_Callback00_NpcActivate_6FC796B0_113c(m, a[0]!, a[1]!),
  '0x6FC797B0': (m, a) => ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c(m, a[0]!, a[1]!),
  '0x6FC79BE0': (m, a) => ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c(m, a[0]!, a[1]!),
  '0x6FC79D30': (m, a) => ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(m, a[0]!, a[1]!),
  '0x6FC79E10': (m, a) => ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(m, a[0]!, a[1]!),
  '0x6FC7A0A0': (m, a) => ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c(m, a[0]!, a[1]!),
  '0x6FC7A530': (m, a) => ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c(m, a[0]!, a[1]!),
  '0x6FC7A5C0': (m, a) => ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(m, a[0]!, a[1]!),
  '0x6FC7A720': (m, a) => ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c(m, a[0]!, a[1]!),
  '0x6FC7D520': (m, a) => ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c(m, a[0]!, a[1]!),
  '0x6FC7D920': (m, a) => ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c(m, a[0]!, a[1]!),
  '0x6FC80F20': (m, a) => ACT1Q4_CheckCainTownNpcAlert113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC82490': (m, a) => ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c(m, a[0]!, a[1]!),
  '0x6FC82E50': (m, a) => ACT1_IntroNpcActivate_6FC82E50_113c(m, a[0]!, a[1]!),
  '0x6FC82F00': (m, a) => ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c(m, a[0]!, a[1]!),
  '0x6FC83190': (m, a) => ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c(m, a[0]!, a[1]!),
  '0x6FC83870': (m, a) => ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c(m, a[0]!, a[1]!),
  '0x6FC83AD0': (m, a) => ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c(m, a[0]!, a[1]!),
  '0x6FC83C40': (m, a) => ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c(m, a[0]!, a[1]!),
  '0x6FC89360': (m, a) => QUESTS_AllocBitBufferPair_6FC89360_113c(m, a[0]!),
  '0x6FC89590': (m, a) => QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC89DA0': (m, a) => OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c(m, a[0]!, a[1]!),
  '0x6FC8F660': (m, a) => MISSILE_RollInitialPierceCount113c(m, a[0]!, a[1]!),
  '0x6FC8F880': (m, a) => MISSILE_DestroyDataAndEvents113c(m, a[0]!, a[1]!),
  '0x6FC8F8A0': (m, a) => MISSILE_InitDataAndPersistentEvent113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC90190': (m, a) => PLRTRADE_CountCubePageItemsInInventory113c(m, a[0]!),
  '0x6FC90D60': (m, a) => PLRTRADE_IsInteractingWithValidPlayer113c(m, a[0]!, a[1]!),
  '0x6FC91290': (m, a) => OBJECTS_OperateBankStash_6FC91290_113c(m, a[0]!),
  '0x6FC94CE0': (m, a) => MONSTER_ApplyModeVelocityOverride113c(m, a[0]!, a[1]!),
  '0x6FC95070': (m, a) => MONSTER_InitModeChangeStrc113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC95160': (m, a) => MONSTER_ModeChangeKnockback_6FC95160_113c(m, a[0]!, a[1]!),
  '0x6FC95210': (m, a) => MONSTER_StartGetHitMode113c(m, a[0]!, a[1]!),
  '0x6FC95260': (m, a) => MONSTER_SavePrevMode113c(m, a[0]!, a[1]!),
  '0x6FC95320': (m, a) => MONSTER_ClearStepEvents113c(m, a[0]!, a[1]!),
  '0x6FC95460': (m, a) => MONSTER_ModeChangeCorpse_6FC95460_113c(m, a[0]!, a[1]!),
  '0x6FC97E00': (m, a) => MONSTER_IsNextModeEndWithin5Frames113c(m, a[0]!, a[1]!),
  '0x6FC98230': (m, a) => PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c(m, a[0]!, a[1]!),
  '0x6FC982F0': (m, a) => PLAYER_SetNeutralOrTownNeutralMode113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC98340': (m, a) => AITHINK_CanPlayerSwitchToMode113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC98610': (m, a) => PLAYER_StartWalkOrRunMode113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC98710': (m, a) => PLAYER_SetPathTargetCoordsAndWalk113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC9A020': (m, a) => UNITMSG_QueuePacket23SetSkill_6FC9A020_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC9A260': (m, a) => MONSTER_QueuePacket0xAB_LifeNotify113c(m, a[0]!, a[1]!),
  '0x6FC9A4C0': (m, a) => UNIT_QueueSkillCastNotify99_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCAA330': (m, a) => NET_ShouldSyncTrackedStatDelta_6FCAA330_113c(m, a[0]!, a[1]!),
  '0x6FCAA770': (m, a) => D2NET_SendPacket0x06BytesToClient113c(m, a[0]!, a[1]!),
  '0x6FCAAAE0': (m, a) => NET_SendPacket60_PortalInfo_6FCAAAE0_113c(m, a[0]!, a[1]!),
  '0x6FCAACD0': (m, a) => NET_SendPacketBuffer6B_6FCAACD0_113c(m, a[0]!, a[1]!),
  '0x6FCAAD40': (m, a) => NET_SendPacket103B_QuestRecord_6FCAAD40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCAAE60': (m, a) => NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCAAEC0': (m, a) => NET_SendPacket47_UnitRelator1_6FCAAEC0_113c(m, a[0]!, a[1]!),
  '0x6FCAB220': (m, a) => NET_SendPacket81_AssignMerc_6FCAB220_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCAB290': (m, a) => NET_SendPacket7A_SummonChange_6FCAB290_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCAB340': (m, a) => NET_SendPacket77_ButtonAction_6FCAB340_113c(m, a[0]!, a[1]!),
  '0x6FCAB3D0': (m, a) => NET_SendPacketBuffer40B_6FCAB3D0_113c(m, a[0]!, a[1]!),
  '0x6FCAC010': (m, a) => D2NET_SendUnitMovePacket0x10BytesToClient113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!),
  '0x6FCAC090': (m, a) => S2C_SendPacket0D_UnitStop113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FCAC100': (m, a) => S2C_SendPacket0E_UnitCorpseState113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FCAC3B0': (m, a) => S2C_QueueByteDwordPacket6_6FCAC3B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAC810': (m, a) => NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAD040': (m, a) => NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAD500': (m, a) => MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCAE110': (m, a) => NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCAE490': (m, a) => EVENT_GetNextEventFrame113c(m, a[0]!, a[1]!),
  '0x6FCAE680': (m, a) => EVENT_CreateNodeWithGrowth113c(m, a[0]!, a[1]!),
  '0x6FCAF410': (m, a) => ARENA_CountPlayersInLevelCallback113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCB6540': (m, a) => SUMMON_GetPetTypeBucketPtr_6FCB6540_113c(m, a[0]!, a[1]!),
  '0x6FCB6570': (m, a) => PETS_FindPetArgByGuid_6FCB6570_113c(m, a[0]!, a[1]!),
  '0x6FCB6EA0': (m, a) => PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB7120': (m, a) => PETS_AllocAndInitPlayerPetTable_6FCB7120_113c(m, a[0]!, a[1]!),
  '0x6FCBB340': (m, a) => ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c(m, a[0]!),
  '0x6FCBC000': (m, a) => PARTY_CountLivingPartyMemberCallback113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBD0F0': (m, a) => AI_LookupDispatchTableRow113c(m, a[0]!, a[1]!),
  '0x6FCBD8E0': (m, a) => ROOM_SleepRoomMonsters113c(m, a[0]!, a[1]!),
  '0x6FCBD950': (m, a) => ROOM_WakeRoomMonsters113c(m, a[0]!, a[1]!),
  '0x6FCBE290': (m, a) => ITEMS_RegisterItemEventCallback113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FCBE2E0': (m, a) => SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c(m, a[0]!, a[1]!),
  '0x6FCBE370': (m, a) => SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c(m, a[0]!),
  '0x6FCBE6B0': (m, a) => SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c(m, a[0]!),
  '0x6FCBE7B0': (m, a) => SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c(m, a[0]!, a[1]!),
  '0x6FCBE810': (m, a) => SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBEC80': (m, a) => SKILLS_CheckSkillManaAndCharges113c(m, a[0]!),
  '0x6FCBF120': (m, a) => SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, a[0]!, a[1]!),
  '0x6FCBFA30': (m, a) => SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCBFF70': (m, a) => SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c(m, a[0]!, a[1]!, a[2]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P4VectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
  extraCaps: ExtraCapRecord[]
  retMask: string
  asserted: boolean
  assertLine: number
  ret: string
  setupTop: string
  preMem: MemRunRecord[]
  postMem: MemRunRecord[]
  heapTop: string
  heapHex: string
}

const D2COM_PREF_BASE = 0x6fd50000
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_CS_GAME = 0x30010000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

class CoWSparseMemory113c extends SparseMemory113c {
  private readonly basePages = new Map<number, Uint8Array>()
  private readonly baseKnown = new Map<number, Uint8Array>()
  private readonly overlayPages = new Map<number, Uint8Array>()
  private readonly overlayKnown = new Map<number, Uint8Array>()
  private heapCursor = HEAP_BASE

  commitOverlayToBase(): void {
    for (const [pg, data] of this.overlayPages.entries()) {
      this.basePages.set(pg, data)
      this.baseKnown.set(pg, this.overlayKnown.get(pg)!)
    }
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  resetOverlay(): void {
    this.overlayPages.clear()
    this.overlayKnown.clear()
    this.heapCursor = HEAP_BASE
  }

  getHeapTop(): number {
    return this.heapCursor >>> 0
  }

  override alloc(size: number): number {
    const effSize = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, effSize, 0)
    this.heapCursor = (p + effSize) >>> 0
    return p
  }

  override loadBlock(addr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.setU8((addr + i) >>> 0, data[i]!)
    }
  }

  override readBytes(addr: number, len: number): Uint8Array {
    const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      out[i] = this.u8((addr + i) >>> 0)
    }
    return out
  }

  override u8(p: number): number {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    const ok = this.overlayKnown.get(pg)
    if (ok !== undefined && ok[off] !== 0) {
      return this.overlayPages.get(pg)![off]!
    }
    const bk = this.baseKnown.get(pg)
    if (bk !== undefined && bk[off] !== 0) {
      return this.basePages.get(pg)![off]!
    }
    throw new Error(`CoWSparseMemory113c: read of unloaded byte 0x${addr.toString(16)}`)
  }

  override u16(p: number): number {
    return this.u8(p) | (this.u8((p + 1) >>> 0) << 8)
  }

  override u32(p: number): number {
    return (this.u16(p) | (this.u16((p + 2) >>> 0) << 16)) >>> 0
  }

  override setU8(p: number, v: number): void {
    const addr = p >>> 0
    const pg = addr >>> PAGE_BITS
    const off = addr & (PAGE_SIZE - 1)
    let od = this.overlayPages.get(pg)
    let ok = this.overlayKnown.get(pg)
    if (od === undefined || ok === undefined) {
      const bd = this.basePages.get(pg)
      const bk = this.baseKnown.get(pg)
      od = bd !== undefined ? bd.slice() : new Uint8Array(PAGE_SIZE)
      ok = bk !== undefined ? bk.slice() : new Uint8Array(PAGE_SIZE)
      this.overlayPages.set(pg, od)
      this.overlayKnown.set(pg, ok)
    }
    od[off] = v & 0xff
    ok[off] = 1
  }

  override setU16(p: number, v: number): void {
    this.setU8(p, v & 0xff)
    this.setU8((p + 1) >>> 0, (v >>> 8) & 0xff)
  }

  override setU32(p: number, v: number): void {
    this.setU16(p, v & 0xffff)
    this.setU16((p + 2) >>> 0, (v >>> 16) & 0xffff)
  }

  override fill(p: number, len: number, v: number): void {
    const byte = v & 0xff
    for (let i = 0; i < len; i++) {
      this.setU8((p + i) >>> 0, byte)
    }
  }

  override get(base: number, f: FieldLayout113c, index = 0): number {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    return width === 1 ? this.u8(p) : width === 2 ? this.u16(p) : this.u32(p)
  }

  override set(base: number, f: FieldLayout113c, v: number, index = 0): void {
    if (base === 0) throw new Error('CoWSparseMemory113c: NULL base')
    if (index < 0 || index >= f.count) {
      throw new Error(`CoWSparseMemory113c: index ${index} outside 0..${f.count - 1}`)
    }
    const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
    const p = (base + f.off + index * width) >>> 0
    if (width === 1) this.setU8(p, v)
    else if (width === 2) this.setU16(p, v)
    else this.setU32(p, v)
  }
}

const HEX_CHARS = '0123456789abcdef'

function hexToBytes(hex: string): Uint8Array {
  const n = hex.length >>> 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!
    out += HEX_CHARS[(b >>> 4) & 0x0f]! + HEX_CHARS[b & 0x0f]!
  }
  return out
}

function extractMemRunsRange(
  mem: CoWSparseMemory113c,
  startAddr: number,
  endAddr: number,
  out: MemRunRecord[],
): void {
  let a = startAddr >>> 0
  const end = endAddr >>> 0
  while (a < end) {
    const chunkEnd = a + 16 <= end ? a + 16 : end
    let nz = false
    for (let k = a; k < chunkEnd; k++) {
      if (mem.u8(k) !== 0) {
        nz = true
        break
      }
    }
    if (!nz) {
      a = chunkEnd
      continue
    }
    const runStart = a
    let runEnd = chunkEnd
    while (runEnd < end && runEnd - runStart < 512) {
      const nextEnd = runEnd + 16 <= end ? runEnd + 16 : end
      let nextNz = false
      for (let k = runEnd; k < nextEnd; k++) {
        if (mem.u8(k) !== 0) {
          nextNz = true
          break
        }
      }
      if (!nextNz) break
      runEnd = nextEnd
    }
    const addrHex = `0x${runStart.toString(16).toUpperCase().padStart(8, '0')}`
    const hex = bytesToHex(mem.readBytes(runStart, runEnd - runStart))
    out.push({ addr: addrHex, hex })
    a = runEnd
  }
}

function extractStageRuns(
  mem: CoWSparseMemory113c,
  setupTop: number,
  extraCaps: readonly ExtraCapRecord[],
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P4VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p4/k6-p4-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P4VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P4VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P4] Real-DLL D2Game.dll 0x6FC40000..0x6FCBFFFF Vector Suite (150 VAs)', () => {
  let mem: CoWSparseMemory113c

  beforeAll(() => {
    const imgPath = resolve(
      import.meta.dirname,
      '../../fixtures/oracle/k1/d2game-datatbls-113c.img.gz',
    )
    const raw = gunzipSync(readFileSync(imgPath))
    const hdr = parseVectorHeader(raw)
    expect(hdr.kind).toBe('PAGEIMG')
    expect(hdr.recordSize).toBe(4100)

    mem = new CoWSparseMemory113c()
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
    let off = 32
    for (let i = 0; i < hdr.recordCount; i++) {
      const va = view.getUint32(off, true) >>> 0
      mem.loadBlock(va, raw.subarray(off + 4, off + 4 + 4096))
      off += 4100
    }
    // Pre-zero D2Game .rdata/.bss regions before binding canonical globals
    mem.fill(0x6fd19f00, 0x3100, 0)
    mem.fill(0x6fd27000, 0xb000, 0)
    bindK2KernelGlobals113c(mem)
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) from loaded Items.txt rows
    const nItems = mem.u32(0x6fdefb94) >>> 0
    const pItems = mem.u32(0x6fdefb98) >>> 0
    if (nItems > 0 && nItems < 4096 && pItems !== 0) {
      const nodes: Array<{ code: number; row: number }> = []
      for (let r = 0; r < nItems; r++) {
        const code = mem.u32((pItems + r * 0x1a8 + 0x80) >>> 0) >>> 0
        nodes.push({ code, row: r })
      }
      nodes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.row - b.row))
      const hdrVa = 0x20fe0000
      const nodesVa = 0x20fe0010
      mem.setU32(hdrVa, nItems)
      mem.setU32((hdrVa + 4) >>> 0, 0)
      mem.setU32((hdrVa + 8) >>> 0, nodesVa)
      for (let i = 0; i < nodes.length; i++) {
        mem.setU32((nodesVa + i * 8) >>> 0, nodes[i]!.code)
        mem.setU32((nodesVa + i * 8 + 4) >>> 0, nodes[i]!.row >>> 0)
      }
      mem.setU32(0x6fdeff6c, hdrVa)
    }
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(STAGE_CS_GAME, 0x20, 0)
    mem.fill(0x28000000, 0x10, 0)
    mem.setU32(0x28000004, 1)
    // Initialize known-zero D2Game global regions referenced by save/combat/AI paths
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 150 target real-DLL D2Game VAs in 0x6FC40000..0x6FCBFFFF (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(150)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fc40000)
      expect(num).toBeLessThanOrEqual(0x6fcbffff)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    const vaNum = Number.parseInt(va, 16) >>> 0
    const modPrefix = vaNum >= D2COM_PREF_BASE ? 'D2Common' : 'D2Game'

    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const cap of vec.extraCaps) {
          const capStart = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capStart, cap.len, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`${modPrefix}:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit ${modPrefix}:${va}`,
        ).toBe(true)

        if (vec.asserted) {
          expect(
            caughtErr,
            `${va} case ${vec.caseIdx} (${vec.label}) expected D2CommonAssertError(${vec.assertLine})`,
          ).toBeInstanceOf(D2CommonAssertError)
          expect((caughtErr as D2CommonAssertError).line).toBe(vec.assertLine)
          continue
        }

        if (caughtErr !== null) {
          throw new Error(
            `${va} case ${vec.caseIdx} (${vec.label}) threw unexpected error: ${String(caughtErr)}`,
          )
        }

        const retMask = Number.parseInt(vec.retMask, 16) >>> 0
        if (retMask !== 0) {
          const actualMasked = ((Number(retVal) | 0) & retMask) >>> 0
          const expectedMasked = Number.parseInt(vec.ret, 16) >>> 0
          expect(
            actualMasked,
            `${va} case ${vec.caseIdx} (${vec.label}) return mismatch: got 0x${actualMasked.toString(16)} expected 0x${expectedMasked.toString(16)}`,
          ).toBe(expectedMasked)
        }

        const actualPostMem = extractStageRuns(mem, setupTop, vec.extraCaps)
        expect(
          actualPostMem,
          `${va} case ${vec.caseIdx} (${vec.label}) staged arena memory mismatch`,
        ).toEqual(vec.postMem)

        if (vec.heapHex.length > 0) {
          const expectedHeapTop = Number.parseInt(vec.heapTop, 16) >>> 0
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) heapTop mismatch`,
          ).toBe(expectedHeapTop)
          const rawHeapBytes = mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE)
          const actualHeapHex = bytesToHex(rawHeapBytes)
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        } else {
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) unexpected heap allocation (expected zero heap drift)`,
          ).toBe(HEAP_BASE)
        }
      }
    })
  }
})
