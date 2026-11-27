/**
 * Milestone #37 [K6] Wave 8 — Real-DLL D2Game.dll Lo-VA Part 2 (0x6FC20000..0x6FCBFFFF)
 * Differential Vector Suite (150 net-new VAs, >= 450 real-DLL vectors).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-w8/k6-w8-d2game-emitter.c
 * against the live TypeScript kernel implementations in src/d2kern-113c/game/*,
 * verifying 100% bit-exact agreement on return values, Fog.#10024 assertion line numbers,
 * staged arena mutations, heap allocations, and va-trace-113c runtime hits.
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


import {
  SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c,
  SKILLS_SrvSt59_Submerge_6FC2BEE0_113c,
} from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c'
import { AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c } from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  MONUMOD_RollSelfResurrectEvent7_6FC43570_113c,
  OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c,
  OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c,
  PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c,
  MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c,
  MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c,
  PLAYER_ApplyDeathExpPenalty_6FC57730_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import {
  SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c,
  SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c,
  SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c'
import {
  ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c,
  ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c,
  ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c,
  ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c,
  ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c,
  SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c,
} from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c'
import { D2Game_6FC8F4F0_113c } from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c,
  PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'
import {
  ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c,
  ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c,
  ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c,
  ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b1-113c'
import {
  ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c,
  ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c,
  ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c,
  ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c,
  ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c,
  ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c,
  QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c,
  QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b2-113c'
import { CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c } from '../../../src/d2kern-113c/game/k2-w2b4-113c'
import {
  AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c,
  ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c,
  ITEMS_RollRareSuffixId_6FC34370_113c,
  ITEMS_RollSpawnableArmorId_6FC2FA30_113c,
  ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c,
  SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import {
  AIGENERAL_RemoveFromMinionList_6FC416A0_113c,
  MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c,
  SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c,
  SKILLS_SetupChargeOrLeapPath_6FC46A80_113c,
  SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import {
  MISSILES_ApplyColdLengthToDamage_6FC59080_113c,
  MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c,
  MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import {
  MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c,
  MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c,
  SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c,
} from '../../../src/d2kern-113c/game/k2-w3b4-113c'
import {
  ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c,
  ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c,
  STATES_OnStateRemovedResetMonsterAi_6FC70130_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import {
  ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c,
  ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c,
  ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c,
  ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c,
  ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c,
  ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c,
  ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
  ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c,
  ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c,
  ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
  ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c,
  ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c,
  ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
  ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
  ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c,
  ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c,
  ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c,
  ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c,
  QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import {
  CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c,
  MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c,
  MONSTER_EventHoverMsgTimeout_6FC96570_113c,
  NET_SendEventMessagePacket5A_6FC90BF0_113c,
  OBJ_EventHoverMsgTimeout_6FC8E470_113c,
  PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c,
  QUESTS_FreeBitBufferPair_6FC892D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  AI_ScanCallbackFetishMinions_6FC9BB90_113c,
  AI_UnburrowAndScheduleThink_6FC9BE10_113c,
  EVENT_HandleFreeHoverMsg_6FC99AA0_113c,
  PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import {
  ITEMS_ApplySetItemModsByFormat_6FC341E0_113c,
  ITEMS_RollMagicAffixByFormat_6FC34B50_113c,
  ITEMS_RollRareNameIdByFormat_6FC34B30_113c,
  MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c,
  MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c,
  MONUMOD_ApplyColdEnchantedStats_6FC42320_113c,
  MONUMOD_ApplyFireEnchantedStats_6FC42740_113c,
  MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c,
  MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c,
  MONUMOD_RollRandomUniqueBossMod_6FC43980_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c,
  ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
  ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
  ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
  ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
  ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
  ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
  ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
  ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
  ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
  ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
  MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
  ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c,
  CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c,
  MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c,
  MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c,
  MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  AI_SelectHostileTargetByMetrics_6FCA4720_113c,
  NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c,
  PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c,
  STORM_TSListArraySetCount_6FC22510_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  INVENTORY_FreeAllItems_6FCAF470_113c,
  ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c,
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c,
  SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c,
  SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c,
  STATES_OnTransformStateRemoved_6FC64A60_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c,
  ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c,
  ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c,
  ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c,
  ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c,
  ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c,
  ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c,
  ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c,
  ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c,
  NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c,
  PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import { SKILLS_DoUnsummonStart_6FCBFEF0_113c } from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c,
  STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import { PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c } from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import { ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c } from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import { PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c } from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import { SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c } from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import { STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c } from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import { PETS_FreePlayerPetTable_6FCB7640_113c } from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c,
  SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c'
import { AI_MapAiAction5_WalkAndMode9_113c } from '../../../src/d2kern-113c/game/town-npc-ai-113c'

const DISPATCH_BY_VA: Record<string, (m: SparseMemory113c, a: readonly number[]) => number> = {
  '0x6FC78D40': (m, a) => (ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC78F90': (m, a) => (ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC790C0': (m, a) => (ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC791D0': (m, a) => (ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC793F0': (m, a) => (ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC79620': (m, a) => (ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82700': (m, a) => (ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82870': (m, a) => (ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82A80': (m, a) => (ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82AE0': (m, a) => (ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82C00': (m, a) => (ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82D30': (m, a) => (ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC78E50': (m, a) => { ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c(m, a[0]!); return 0 },
  '0x6FC78EA0': (m, a) => { ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c(m, a[0]!); return 0 },
  '0x6FC78EF0': (m, a) => { ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c(m, a[0]!); return 0 },
  '0x6FC811B0': (m, a) => { ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC81880': (m, a) => (ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC826C0': (m, a) => (ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82B40': (m, a) => (ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82C60': (m, a) => (ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82CD0': (m, a) => (ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC895F0': (m, a) => { QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC89490': (m, a) => { QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC892D0': (m, a) => { QUESTS_FreeBitBufferPair_6FC892D0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC559C0': (m, a) => (QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7E7F0': (m, a) => { ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC818D0': (m, a) => { ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC855F0': (m, a) => { ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c(m, a[0]!); return 0 },
  '0x6FC808B0': (m, a) => { ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC80E00': (m, a) => { ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC81E30': (m, a) => { ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC820E0': (m, a) => { ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC80D00': (m, a) => (ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC81250': (m, a) => (ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC819B0': (m, a) => (ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC81DA0': (m, a) => (ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82040': (m, a) => (ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82370': (m, a) => (ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC78C90': (m, a) => { ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC77830': (m, a) => { ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC780A0': (m, a) => { ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC782E0': (m, a) => { ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC78640': (m, a) => { ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC83000': (m, a) => { ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC82640': (m, a) => { ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC80EC0': (m, a) => { ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC81EC0': (m, a) => { ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC821B0': (m, a) => { ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC829B0': (m, a) => { ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC83270': (m, a) => { QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC7AB00': (m, a) => (ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7AF50': (m, a) => (ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7B120': (m, a) => (ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7B180': (m, a) => (ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7B490': (m, a) => (ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC83D70': (m, a) => (ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC84150': (m, a) => (ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC84FE0': (m, a) => (ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC85200': (m, a) => (ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC81910': (m, a) => (ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC77750': (m, a) => (ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC77320': (m, a) => (ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC73470': (m, a) => (SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCACFB0': (m, a) => { PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCBD550': (m, a) => { CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC97D90': (m, a) => { PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC46B30': (m, a) => (PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC4DE30': (m, a) => { CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c(m, a[0]!); return 0 },
  '0x6FC90BF0': (m, a) => { NET_SendEventMessagePacket5A_6FC90BF0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCAA2A0': (m, a) => { NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c(m, a[0]!); return 0 },
  '0x6FC97F00': (m, a) => (PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCBD610': (m, a) => { CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCBC6F0': (m, a) => { PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC57730': (m, a) => { PLAYER_ApplyDeathExpPenalty_6FC57730_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC4CD10': (m, a) => { SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8E470': (m, a) => { OBJ_EventHoverMsgTimeout_6FC8E470_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC99AA0': (m, a) => { EVENT_HandleFreeHoverMsg_6FC99AA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC221D0': (m, a) => (STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC4E5D0': (m, a) => (OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC4E660': (m, a) => (OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC22510': (m, a) => { STORM_TSListArraySetCount_6FC22510_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC421D0': (m, a) => { MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC42320': (m, a) => { MONUMOD_ApplyColdEnchantedStats_6FC42320_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC42490': (m, a) => { MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC42600': (m, a) => { MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC42740': (m, a) => { MONUMOD_ApplyFireEnchantedStats_6FC42740_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC43850': (m, a) => { MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC42BC0': (m, a) => { MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC43570': (m, a) => { MONUMOD_RollSelfResurrectEvent7_6FC43570_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC70130': (m, a) => { STATES_OnStateRemovedResetMonsterAi_6FC70130_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC64A60': (m, a) => { STATES_OnTransformStateRemoved_6FC64A60_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC96570': (m, a) => { MONSTER_EventHoverMsgTimeout_6FC96570_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FCAF470': (m, a) => { INVENTORY_FreeAllItems_6FCAF470_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCBB570': (m, a) => (ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC91060': (m, a) => (CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC91270': (m, a) => { STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC6E900': (m, a) => { SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCBF730': (m, a) => { SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c(m, a[0]!); return 0 },
  '0x6FCB64B0': (m, a) => { PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC6F920': (m, a) => (SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC62AD0': (m, a) => (SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCBFEF0': (m, a) => (SKILLS_DoUnsummonStart_6FCBFEF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2BEE0': (m, a) => (SKILLS_SrvSt59_Submerge_6FC2BEE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2BE20': (m, a) => (SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC2BF90': (m, a) => (SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC46A80': (m, a) => (SKILLS_SetupChargeOrLeapPath_6FC46A80_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC46F70': (m, a) => (SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC6F370': (m, a) => (SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC6E500': (m, a) => (SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FCB72C0': (m, a) => { PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC2C1B0': (m, a) => (SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC7E8D0': (m, a) => { ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c(m, a[0]!); return 0 },
  '0x6FCB7640': (m, a) => { PETS_FreePlayerPetTable_6FCB7640_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC62510': (m, a) => (SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) as number) | 0,
  '0x6FC62B40': (m, a) => (SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) as number) | 0,
  '0x6FC59080': (m, a) => { MISSILES_ApplyColdLengthToDamage_6FC59080_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC596E0': (m, a) => (MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5A1D0': (m, a) => { MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC59E30': (m, a) => (MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5A920': (m, a) => (MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5AAA0': (m, a) => { MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC59A40': (m, a) => { MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC61AE0': (m, a) => (MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC60860': (m, a) => (MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5BBB0': (m, a) => (MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5F670': (m, a) => (MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC59DA0': (m, a) => (MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC35C40': (m, a) => (AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC9BB90': (m, a) => (AI_ScanCallbackFetishMinions_6FC9BB90_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC416A0': (m, a) => { AIGENERAL_RemoveFromMinionList_6FC416A0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC359B0': (m, a) => { AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC9BE10': (m, a) => { AI_UnburrowAndScheduleThink_6FC9BE10_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC39A00': (m, a) => (AI_MapAiAction5_WalkAndMode9_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCA4720': (m, a) => (AI_SelectHostileTargetByMetrics_6FCA4720_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC90CF0': (m, a) => (CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB0170': (m, a) => { NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC34B30': (m, a) => (ITEMS_RollRareNameIdByFormat_6FC34B30_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC341E0': (m, a) => (ITEMS_ApplySetItemModsByFormat_6FC341E0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC34B50': (m, a) => (ITEMS_RollMagicAffixByFormat_6FC34B50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC2EE70': (m, a) => { ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC34370': (m, a) => (ITEMS_RollRareSuffixId_6FC34370_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC6C9E0': (m, a) => { ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC2F8F0': (m, a) => (ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC2FA30': (m, a) => (ITEMS_RollSpawnableArmorId_6FC2FA30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC583A0': (m, a) => { PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC955C0': (m, a) => { MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC43980': (m, a) => (MONUMOD_RollRandomUniqueBossMod_6FC43980_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC58AB0': (m, a) => { PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC70DB0': (m, a) => (SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC8F4F0': (m, a) => (D2Game_6FC8F4F0_113c(m, a[0]!) as number) | 0,
}

const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

interface MemRunRecord {
  readonly addr: string
  readonly hex: string
}

interface K6W8VectorRecord {
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

function loadVectors(): K6W8VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w8/k6-w8-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W8VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W8VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 8 real-DLL D2Game.dll Lo-VA Part 2 (0x6FC20000..0x6FCBFFFF) differential vectors', () => {
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

  it('covers 150 net-new real-DLL D2Game.dll VAs strictly in 0x6FC20000..0x6FCBFFFF', () => {
    expect(VECTORS_BY_VA.size).toBe(150)
    expect(Object.keys(DISPATCH_BY_VA).length).toBe(150)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(450)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fc20000)
      expect(num).toBeLessThanOrEqual(0x6fcbffff)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
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
          retVal = fn!(mem, vec.tsArgs)
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
