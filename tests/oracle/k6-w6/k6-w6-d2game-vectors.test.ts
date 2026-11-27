/**
 * Milestone #37 [K6] Wave 6 — Real-DLL D2Game.dll (0x6FCC0000..0x6FD18000)
 * Differential Vector Suite.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

import { AI_SetAiControlOverrides113c } from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  ITEMS_AreAffixesEqual113c,
  ITEMS_DoItemRecordsMatchCodePair113c,
  ITEMS_GetOppositeHandOrRingBodyLoc113c,
  PACKET_C2S4B_RequestUnitRefresh113c,
  PACKET_C2S58_MarkQuestIntroSeen113c,
  PACKET_IsInteractingWithDifferentPlayer113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import {
  ACT3Q1_GetHratliTargetCoords113c,
  ACT3Q1_GetQuestDataByte04_113c,
  ACT3Q2_AddQuestDataCount1C_113c,
  ACT3Q2_DarkWandererStatusFilter113c,
  ACT3Q4_CheckOrmusNpcWaitFlag113c,
  ACT3Q4_ClearOrmusNpcWaitFlag113c,
  ACT3Q5_IsCompellingOrbIntact113c,
  ACT3Q5_IsDuranceEntryBlocked113c,
  ACT3Q6_SetGidbinnState0ECallback113c,
  ACT3Q7_SendQuestUpdatePacket5D_113c,
  PARTY_FindPlayerRelationNode113c,
  PARTY_GetHostileCooldownTick113c,
  PARTY_TestPlayerRelationFlags113c,
  SUNIT_CanTargetOwnPetWithSkill113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c'
import {
  MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c,
  MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c,
  MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c,
  MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c,
  MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c,
  SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import {
  ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c,
  ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c,
  ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c,
  ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c,
  ACT2Q2_IsQuestInState01_6FCE1B20_113c,
  ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c,
  ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c,
  ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c,
  ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c,
  ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c,
  ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c,
  ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c,
  ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c,
  ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c,
  ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c,
  ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c,
  ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c,
  AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c,
  AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c,
  HIRELING_GetVendorNameIdRange_6FCDC7D0_113c,
  SKILLS_InitInfernoSeqFrames_6FCD3270_113c,
  SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c,
  SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c,
  SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b6-113c'
import {
  ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c,
  ACT2Q1_Callback10_RemovePlayerGuid_6FCE44D0_113c,
  ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c,
  ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c,
  ACT2Q2_AddStaffCount_6FCE2380_113c,
  ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c,
  ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c,
  ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c,
  ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c,
  ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c,
  ACT2Q3_GetAltarState_6FCE2120_113c,
  ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c,
  ACT2Q3_IsEclipseInactive_6FCE21A0_113c,
  ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c,
  ACT2Q4_Callback10_RemovePlayerGuid_6FCE3620_113c,
  ACT2Q4_IsPortalOpen_6FCE2040_113c,
  ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c,
  ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c,
  ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c,
  ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c,
  ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c,
  ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c,
  ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c,
  ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c,
  ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c,
  ACT2Q8_StatusFilter_6FCE25E0_113c,
  STATES_ClearGfxStateFlag_6FCEB1A0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import {
  ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c,
  ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c,
  ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c,
  ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c,
  ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c,
  ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c,
  ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c,
  ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c,
  ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c,
  ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c,
  ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c,
  ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c,
  ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c,
  ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c,
  ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c,
  ITEMS_OnCharmPlacedInInventory_6FCF6710_113c,
  ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c,
  ITEMS_PlaceItemInSocketInventory_6FCF1650_113c,
  PACKET_Recv12_ClearGfxState0C_6FCEB590_113c,
  SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import { AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c } from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c,
  MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c,
  ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c,
  ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c,
  SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c,
} from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import { ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c } from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  NPC_ClearPlayerInteractState_6FCDCB90_113c,
  NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c,
  NPC_RefreshInventoryItemStatLists_6FCDCA20_113c,
} from '../../../src/d2kern-113c/game/k2-w5b4-113c'
import {
  ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c,
  ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c,
  ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c,
  ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c,
  ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c,
  ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c,
  ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c,
  MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c,
  PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b5-113c'
import {
  C2S_SyncObjectCollisionByGuid_6FCED440_113c,
  C2S_ValidateStoredOrEquippedItem_6FCECE90_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  QUESTS_ChainStatusFilterNotState5_6FD02F00_113c,
  QUESTS_ChainStatusFilterNotState7_6FD02A40_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c'
import {
  ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c,
  ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c,
  ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c,
  ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c,
  ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c,
  ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c,
  ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c,
  ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b8-113c'
import {
  PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c,
  PARTY_SyncMutualRelationState_6FD109E0_113c,
  PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c,
  SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c,
  SUBPARTY_ClearUnitBucketList_6FD0FD40_113c,
  SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c,
  SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import { SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c } from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c,
  C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c,
  C2S_ValidatePacket5ByteItem_6FCED4F0_113c,
  SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import {
  ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c,
  PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import {
  PARTY_ClearHostilityFlag08_6FD14210_113c,
  PARTY_EnableHostilityFlag08_6FD141C0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b7-113c'
import { QUEST_Act4DiabloSealCheck113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import { SUNIT_GetLastAttacker113c } from '../../../src/d2kern-113c/game/timer-wheel'

type KernelFn113c = (m: SparseMemory113c, ...args: number[]) => unknown

const DISPATCH_BY_VA: Record<string, KernelFn113c> = {
  '0x6FCEB1A0': STATES_ClearGfxStateFlag_6FCEB1A0_113c as unknown as KernelFn113c,
  '0x6FCDC7D0': HIRELING_GetVendorNameIdRange_6FCDC7D0_113c as unknown as KernelFn113c,
  '0x6FCD2E00': MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c as unknown as KernelFn113c,
  '0x6FD009D0': SUNIT_GetLastAttacker113c as unknown as KernelFn113c,
  '0x6FD00410': SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c as unknown as KernelFn113c,
  '0x6FCEA410': MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c as unknown as KernelFn113c,
  '0x6FD00210': SUNIT_CanTargetOwnPetWithSkill113c as unknown as KernelFn113c,
  '0x6FD00BF0': SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c as unknown as KernelFn113c,
  '0x6FCF1780': ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c as unknown as KernelFn113c,
  '0x6FCF1A30': ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c as unknown as KernelFn113c,
  '0x6FCF1A00': ITEMS_DoItemRecordsMatchCodePair113c as unknown as KernelFn113c,
  '0x6FCF1720': ITEMS_GetOppositeHandOrRingBodyLoc113c as unknown as KernelFn113c,
  '0x6FCF6710': ITEMS_OnCharmPlacedInInventory_6FCF6710_113c as unknown as KernelFn113c,
  '0x6FCDCB90': NPC_ClearPlayerInteractState_6FCDCB90_113c as unknown as KernelFn113c,
  '0x6FCF4FF0': ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c as unknown as KernelFn113c,
  '0x6FCF16B0': ITEMS_AreAffixesEqual113c as unknown as KernelFn113c,
  '0x6FCF1650': ITEMS_PlaceItemInSocketInventory_6FCF1650_113c as unknown as KernelFn113c,
  '0x6FCDCAA0': NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c as unknown as KernelFn113c,
  '0x6FCDCA20': NPC_RefreshInventoryItemStatLists_6FCDCA20_113c as unknown as KernelFn113c,
  '0x6FCD31B0': SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c as unknown as KernelFn113c,
  '0x6FCD3570': SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c as unknown as KernelFn113c,
  '0x6FCD2E90': SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c as unknown as KernelFn113c,
  '0x6FCC20C0': SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c as unknown as KernelFn113c,
  '0x6FCC35D0': SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c as unknown as KernelFn113c,
  '0x6FCD3270': SKILLS_InitInfernoSeqFrames_6FCD3270_113c as unknown as KernelFn113c,
  '0x6FD11420': SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c as unknown as KernelFn113c,
  '0x6FCC5D40': MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c as unknown as KernelFn113c,
  '0x6FCC4180': MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c as unknown as KernelFn113c,
  '0x6FCC39E0': MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c as unknown as KernelFn113c,
  '0x6FCD6C90': AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c as unknown as KernelFn113c,
  '0x6FD120C0': AI_ScheduleAiThinkTimer_6FD120C0_113c as unknown as KernelFn113c,
  '0x6FCD12B0': MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c as unknown as KernelFn113c,
  '0x6FCC5AC0': MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c as unknown as KernelFn113c,
  '0x6FCD6D30': AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c as unknown as KernelFn113c,
  '0x6FD13CB0': AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c as unknown as KernelFn113c,
  '0x6FD11A20': AI_SetAiControlOverrides113c as unknown as KernelFn113c,
  '0x6FCC4450': AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c as unknown as KernelFn113c,
  '0x6FCD14B0': MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c as unknown as KernelFn113c,
  '0x6FD10040': PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c as unknown as KernelFn113c,
  '0x6FCEB590': PACKET_Recv12_ClearGfxState0C_6FCEB590_113c as unknown as KernelFn113c,
  '0x6FD10060': PARTY_FindPlayerRelationNode113c as unknown as KernelFn113c,
  '0x6FCECB10': PACKET_IsInteractingWithDifferentPlayer113c as unknown as KernelFn113c,
  '0x6FCEB4A0': PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c as unknown as KernelFn113c,
  '0x6FD141C0': PARTY_EnableHostilityFlag08_6FD141C0_113c as unknown as KernelFn113c,
  '0x6FD102A0': PARTY_TestPlayerRelationFlags113c as unknown as KernelFn113c,
  '0x6FD100E0': PARTY_GetHostileCooldownTick113c as unknown as KernelFn113c,
  '0x6FD10390': PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c as unknown as KernelFn113c,
  '0x6FCEB3D0': PACKET_C2S58_MarkQuestIntroSeen113c as unknown as KernelFn113c,
  '0x6FD14210': PARTY_ClearHostilityFlag08_6FD14210_113c as unknown as KernelFn113c,
  '0x6FCEC6E0': PACKET_C2S4B_RequestUnitRefresh113c as unknown as KernelFn113c,
  '0x6FD0FD40': SUBPARTY_ClearUnitBucketList_6FD0FD40_113c as unknown as KernelFn113c,
  '0x6FD0FED0': SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c as unknown as KernelFn113c,
  '0x6FD0FDB0': SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c as unknown as KernelFn113c,
  '0x6FD105B0': PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c as unknown as KernelFn113c,
  '0x6FD109E0': PARTY_SyncMutualRelationState_6FD109E0_113c as unknown as KernelFn113c,
  '0x6FCED4F0': C2S_ValidatePacket5ByteItem_6FCED4F0_113c as unknown as KernelFn113c,
  '0x6FCED440': C2S_SyncObjectCollisionByGuid_6FCED440_113c as unknown as KernelFn113c,
  '0x6FCECE90': C2S_ValidateStoredOrEquippedItem_6FCECE90_113c as unknown as KernelFn113c,
  '0x6FCEC860': C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c as unknown as KernelFn113c,
  '0x6FCEC8E0': C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c as unknown as KernelFn113c,
  '0x6FCE2AF0': ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c as unknown as KernelFn113c,
  '0x6FCE2F00': ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c as unknown as KernelFn113c,
  '0x6FCE3620': ACT2Q4_Callback10_RemovePlayerGuid_6FCE3620_113c as unknown as KernelFn113c,
  '0x6FCE3EB0': ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c as unknown as KernelFn113c,
  '0x6FCE44D0': ACT2Q1_Callback10_RemovePlayerGuid_6FCE44D0_113c as unknown as KernelFn113c,
  '0x6FD03390': ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c as unknown as KernelFn113c,
  '0x6FD03960': ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c as unknown as KernelFn113c,
  '0x6FD03B30': ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c as unknown as KernelFn113c,
  '0x6FD05220': ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c as unknown as KernelFn113c,
  '0x6FCE4550': ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c as unknown as KernelFn113c,
  '0x6FCD8E60': ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c as unknown as KernelFn113c,
  '0x6FCD94D0': ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c as unknown as KernelFn113c,
  '0x6FCE3970': ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c as unknown as KernelFn113c,
  '0x6FCE25E0': ACT2Q8_StatusFilter_6FCE25E0_113c as unknown as KernelFn113c,
  '0x6FD03040': ACT3Q2_DarkWandererStatusFilter113c as unknown as KernelFn113c,
  '0x6FCE27C0': ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c as unknown as KernelFn113c,
  '0x6FD02B10': ACT3Q4_ClearOrmusNpcWaitFlag113c as unknown as KernelFn113c,
  '0x6FD02CD0': ACT3Q1_GetQuestDataByte04_113c as unknown as KernelFn113c,
  '0x6FCD8940': QUEST_Act4DiabloSealCheck113c as unknown as KernelFn113c,
  '0x6FCE2120': ACT2Q3_GetAltarState_6FCE2120_113c as unknown as KernelFn113c,
  '0x6FD02B40': ACT3Q4_CheckOrmusNpcWaitFlag113c as unknown as KernelFn113c,
  '0x6FD02960': ACT3Q5_IsCompellingOrbIntact113c as unknown as KernelFn113c,
  '0x6FCE2460': ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c as unknown as KernelFn113c,
  '0x6FCE1B20': ACT2Q2_IsQuestInState01_6FCE1B20_113c as unknown as KernelFn113c,
  '0x6FCE1A00': ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c as unknown as KernelFn113c,
  '0x6FCE2040': ACT2Q4_IsPortalOpen_6FCE2040_113c as unknown as KernelFn113c,
  '0x6FCE21A0': ACT2Q3_IsEclipseInactive_6FCE21A0_113c as unknown as KernelFn113c,
  '0x6FCE1A60': ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c as unknown as KernelFn113c,
  '0x6FCE2380': ACT2Q2_AddStaffCount_6FCE2380_113c as unknown as KernelFn113c,
  '0x6FD02DB0': ACT3Q2_AddQuestDataCount1C_113c as unknown as KernelFn113c,
  '0x6FCD88C0': ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c as unknown as KernelFn113c,
  '0x6FD02C40': ACT3Q1_GetHratliTargetCoords113c as unknown as KernelFn113c,
  '0x6FCE1F40': ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c as unknown as KernelFn113c,
  '0x6FCE1EE0': ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c as unknown as KernelFn113c,
  '0x6FD02900': ACT3Q5_IsDuranceEntryBlocked113c as unknown as KernelFn113c,
  '0x6FD02A40': QUESTS_ChainStatusFilterNotState7_6FD02A40_113c as unknown as KernelFn113c,
  '0x6FD02F00': QUESTS_ChainStatusFilterNotState5_6FD02F00_113c as unknown as KernelFn113c,
  '0x6FCD87F0': ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c as unknown as KernelFn113c,
  '0x6FCD8A50': ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c as unknown as KernelFn113c,
  '0x6FCE1A40': ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c as unknown as KernelFn113c,
  '0x6FCD8CC0': ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c as unknown as KernelFn113c,
  '0x6FCE29C0': ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c as unknown as KernelFn113c,
  '0x6FD041A0': ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c as unknown as KernelFn113c,
  '0x6FD02D00': ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c as unknown as KernelFn113c,
  '0x6FCD9BC0': ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c as unknown as KernelFn113c,
  '0x6FD05230': ACT3Q6_SetGidbinnState0ECallback113c as unknown as KernelFn113c,
  '0x6FCE3510': ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c as unknown as KernelFn113c,
  '0x6FD05080': ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c as unknown as KernelFn113c,
  '0x6FCE3EF0': ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c as unknown as KernelFn113c,
  '0x6FD06420': ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c as unknown as KernelFn113c,
  '0x6FCD8FE0': ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c as unknown as KernelFn113c,
  '0x6FCE2150': ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c as unknown as KernelFn113c,
  '0x6FD06470': ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c as unknown as KernelFn113c,
  '0x6FCE4D90': ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c as unknown as KernelFn113c,
  '0x6FCE5260': ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c as unknown as KernelFn113c,
  '0x6FCE5560': ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c as unknown as KernelFn113c,
  '0x6FD05B10': ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c as unknown as KernelFn113c,
  '0x6FD05CD0': ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c as unknown as KernelFn113c,
  '0x6FCD9920': ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c as unknown as KernelFn113c,
  '0x6FCD9CD0': ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c as unknown as KernelFn113c,
  '0x6FCDA010': ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c as unknown as KernelFn113c,
  '0x6FCE2DC0': ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c as unknown as KernelFn113c,
  '0x6FD047D0': ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c as unknown as KernelFn113c,
  '0x6FD04830': ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c as unknown as KernelFn113c,
  '0x6FD04890': ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c as unknown as KernelFn113c,
  '0x6FCE4170': ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c as unknown as KernelFn113c,
  '0x6FCE4BD0': ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c as unknown as KernelFn113c,
  '0x6FCE2A90': ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c as unknown as KernelFn113c,
  '0x6FCE3FC0': ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c as unknown as KernelFn113c,
  '0x6FD05BE0': ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c as unknown as KernelFn113c,
  '0x6FD05D20': ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c as unknown as KernelFn113c,
  '0x6FD06130': ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c as unknown as KernelFn113c,
  '0x6FD06550': ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c as unknown as KernelFn113c,
  '0x6FCD9970': ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c as unknown as KernelFn113c,
  '0x6FCD99D0': ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c as unknown as KernelFn113c,
  '0x6FCD9D20': ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c as unknown as KernelFn113c,
  '0x6FCE4D30': ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c as unknown as KernelFn113c,
  '0x6FCE4E30': ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c as unknown as KernelFn113c,
  '0x6FCE5030': ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c as unknown as KernelFn113c,
  '0x6FCE52B0': ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c as unknown as KernelFn113c,
  '0x6FCE5630': ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c as unknown as KernelFn113c,
  '0x6FD04A50': ACT3Q7_SendQuestUpdatePacket5D_113c as unknown as KernelFn113c,
  '0x6FD03320': ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c as unknown as KernelFn113c,
  '0x6FD03760': ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c as unknown as KernelFn113c,
  '0x6FCD9C60': ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c as unknown as KernelFn113c,
  '0x6FCE4CC0': ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c as unknown as KernelFn113c,
  '0x6FCE44E0': ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c as unknown as KernelFn113c,
  '0x6FD05450': ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c as unknown as KernelFn113c,
  '0x6FCD6720': SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c as unknown as KernelFn113c,
  '0x6FCF3450': ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c as unknown as KernelFn113c,
}

const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0xc000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const EXPECTED_VA_COUNT = 150

interface MemRunRecord {
  readonly addr: string
  readonly hex: string
}

interface K6W6VectorRecord {
  readonly va: string
  readonly name: string
  readonly caseIdx: number
  readonly label: string
  readonly tsArgs: readonly number[]
  readonly retMask: string
  readonly asserted: boolean
  readonly assertLine: number
  readonly ret: string
  readonly setupTop: string
  readonly preMem: readonly MemRunRecord[]
  readonly postMem: readonly MemRunRecord[]
  readonly heapTop: string
  readonly heapHex: string
}

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
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    this.fill(p, size, 0)
    this.heapCursor = (p + size) >>> 0
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

function extractStageRuns(mem: CoWSparseMemory113c, setupTop: number): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  return out
}

function loadVectors(): K6W6VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w6/k6-w6-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W6VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W6VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 6 real-DLL D2Game.dll (0x6FCC0000..0x6FD18000) differential vectors', () => {
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
    bindK2KernelGlobals113c(mem)
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.commitOverlayToBase()
  })

  it(`covers ${EXPECTED_VA_COUNT} real-DLL D2Game.dll VAs in 0x6FCC0000..0x6FD18000`, () => {
    expect(VECTORS_BY_VA.size).toBe(EXPECTED_VA_COUNT)
    expect(Object.keys(DISPATCH_BY_VA).length).toBe(EXPECTED_VA_COUNT)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(EXPECTED_VA_COUNT * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fcc0000)
      expect(num).toBeLessThanOrEqual(0x6fd18000)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
      expect(cases.length).toBeGreaterThanOrEqual(3)
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const blk of vec.preMem) {
          const addr = Number.parseInt(blk.addr, 16) >>> 0
          mem.loadBlock(addr, hexToBytes(blk.hex))
        }

        beginVaTrace113c()
        let retVal: unknown = 0
        let caughtErr: unknown = null
        try {
          retVal = fn!(mem, ...vec.tsArgs)
        } catch (err) {
          caughtErr = err
        }
        const hits = endVaTrace113c()
        expect(
          hits.has(`D2Game:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit D2Game:${va}`,
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

        const actualPostMem = extractStageRuns(mem, setupTop)
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
          const actualHeapHex = bytesToHex(mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE))
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        }
      }
    })
  }
})
