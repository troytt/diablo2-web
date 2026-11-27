/**
 * Milestone #37 [K6] Wave 5 — Real-DLL D2Game.dll Lo-VA (0x6FC20000..0x6FCBFFFF)
 * Differential Vector Suite (150 net-new VAs, >= 450 real-DLL vectors).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-w5/k6-w5-d2game-emitter.c
 * against the live TypeScript kernel implementations in src/d2kern-113c/game/*,
 * verifying 100% bit-exact agreement on return values, Fog.#10024 assertion line numbers,
 * staged arena mutations (including S2C client packet buffers, timer wheels, statlists,
 * inventories, paths, quest records, and combat damage structs), heap allocations,
 * and va-trace-113c runtime hits.
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

import { AI_FallenShamanCorpseFilter113c } from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  AIINIT_SpawnerResetFrameTimers113c,
  AI_FilterLivingGloamUnit113c,
  MONSTER_Event10_ClearMonsterFields34And38_113c,
  MONSTER_GetOrRollRegionSubVariant113c,
  NET_SendRemoveUnitPacket0A113c,
  PLAYER_CanInterruptCurrentSkillOrEvent113c,
  PLRTRADE_BroadcastClearMercUnitCallback113c,
  PLRTRADE_CanModifyBeltDuringTrade113c,
  PLRTRADE_HasAnyCubePageItemOnUnit113c,
  PLRTRADE_SendTradeAcceptButtonAndSetState3_113c,
  PLRTRADE_SyncClonedItemEarOrPersonalizedData113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import {
  CLIENTS_CaptureFirstInGameClientCallback113c,
  ITEMS_FindSuperiorQualityRecordIndex113c,
  QUESTS_SendQuestStateAlert5D_113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c'
import {
  SKILLS_CanMonsterBeImpregnated_6FC2C110_113c,
  SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c,
} from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c'
import {
  AI_CountNearbyMinion453Or461Callback_6FC35890_113c,
  AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c,
  ITEMS_ClearAffixesAndItemCell_6FC2E210_113c,
  MONUMOD_ApplyExtraFastVelocity_6FC42880_113c,
  MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c,
  MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c,
  MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c,
  SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c,
  MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c,
  MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c,
  OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c,
  OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c,
  OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c,
  PLRMODE_IsDualWieldingClaws_6FC46A30_113c,
  SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c,
  SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  MISSILES_ConsumePierceStat_6FC58F40_113c,
  MISSILES_InitDrunkenPath_6FC59210_113c,
  MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c,
  MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c,
  SKILLS_StatListExpireClearState_6FC62290_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import {
  CLIENTS_StoreSaveDataBuffer_6FC696B0_113c,
  CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c,
  SKILLS_AddDamagePercentStat_6FC6C190_113c,
  SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c,
  SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c,
  SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c,
  SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c,
  SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c'
import { SKILLS_DivideValueByMonLvlHp113c } from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c'
import { SHRINES_OnShrineStateRemoved_6FC8A930_113c } from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import {
  ACT1Q4_MarkFlag52_6FC80590_113c,
  ACT1Q4_MarkFlag63_6FC805C0_113c,
  ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c,
  ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c,
  ACT4_EndgameStatusFilter_6FC80810_113c,
  ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c,
  ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c,
  ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c,
  ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c,
  ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c,
  ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c,
  ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c,
  ITEMS_IsUniqueItemDisabled_6FC217E0_113c,
  PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b1-113c'
import {
  ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c,
  ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c,
  ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c,
  ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c,
  ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c,
  ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c,
  ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c,
  ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c,
  ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c,
  ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c,
  ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c,
  ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c,
  ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c,
  ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c,
  OBJECTS_GrantUnitDexterity_6FC896F0_113c,
  OBJECTS_GrantUnitEnergy_6FC89710_113c,
  OBJECTS_GrantUnitStrength_6FC896B0_113c,
  OBJECTS_GrantUnitVitality_6FC896D0_113c,
  OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c,
  QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c,
  QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c,
  SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c,
  SHRINES_ApplyHealthExchangeEffect_6FC89800_113c,
  SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c,
  SHRINES_ApplyManaRechargeEffect_6FC89860_113c,
} from '../../../src/d2kern-113c/game/k2-w2b2-113c'
import {
  MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c,
  NET_SendPacket07_RoomTileCoords_6FCABF50_113c,
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c,
  NET_SendPacket42_ClearCursor_6FCAAF10_113c,
  NET_SendPacket61_ByteParam_6FCAAAC0_113c,
  NET_SendPacket79_GoldInTrade_6FCAB1F0_113c,
  NET_SendPacket7B_ByteAndDword_6FCAAD10_113c,
  NET_SendPacket98_UnitWordValue_6FCAA6C0_113c,
  NET_SendPacketBuffer15B_6FCAABF0_113c,
  NET_SendPacketBuffer21B_6FCAAA70_113c,
  NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c,
  NET_SendPacketBuffer32B_6FCAAA10_113c,
  NET_SendPacketBuffer7B_6FCAAB20_113c,
  SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c,
} from '../../../src/d2kern-113c/game/k2-w2b3-113c'
import {
  ITEMS_SendGroundItemPacket03_6FCADFD0_113c,
  ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c,
  ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c,
  ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c,
  S2C_QueueMonsterMovePacket12_6FCAC160_113c,
  S2C_QueueSingleBytePacket1_6FCAC490_113c,
  S2C_QueueUnitTargetMovePacket16_6FCAC230_113c,
  S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c,
  S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c,
  S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c,
  SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c,
  SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c,
  STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c,
  STATES_ClearGfxStateFlagCallback_6FCB0F00_113c,
  SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b4-113c'
import { SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c } from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import { AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c } from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import { MONUMOD_ApplyGhostlyStats_6FC42D00_113c } from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import {
  MISSILES_TargetFilter_MonstersOnly_6FC5ADD0_113c,
  MISSILES_TargetFilter_PlayersAndAlignedMonsters_6FC5AD70_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import {
  OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c,
  OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c,
  OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c,
  OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c,
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c,
  AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c,
  AI_ScanCallbackNearestBaseId136_6FC9BA40_113c,
  AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c,
  UNITMSG_QueuePacket9ACoords_6FC9A440_113c,
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c,
  UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c,
  UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c,
  UNIT_SendStatB2Packet11ToClient_6FC9A570_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import { MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c } from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c,
  MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c,
  PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c,
  NET_SendPacket8B_GameHandshake_6FCAC420_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import { PARTY_CountSubPartyMembers_6FCBBF40_113c } from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import { CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c } from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c,
  SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c,
  SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c,
  SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import { NPCS_ResetVendorSlotInventory_6FCB02E0_113c } from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import { MONSTER_NullModeEventFallback113c } from '../../../src/d2kern-113c/game/monster-events'

const DISPATCH_BY_VA: Record<string, (m: SparseMemory113c, a: readonly number[]) => number> = {
  '0x6FC4A0C0': (m, a) => { CLIENTS_CaptureFirstInGameClientCallback113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCAC490': (m, a) => (S2C_QueueSingleBytePacket1_6FCAC490_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAAAC0': (m, a) => (NET_SendPacket61_ByteParam_6FCAAAC0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAAD10': (m, a) => (NET_SendPacket7B_ByteAndDword_6FCAAD10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCAB1F0': (m, a) => (NET_SendPacket79_GoldInTrade_6FCAB1F0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCABF50': (m, a) => (NET_SendPacket07_RoomTileCoords_6FCABF50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCAAB20': (m, a) => (NET_SendPacketBuffer7B_6FCAAB20_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC9A540': (m, a) => { NET_SendRemoveUnitPacket0A113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCAA6C0': (m, a) => (NET_SendPacket98_UnitWordValue_6FCAA6C0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCAAC90': (m, a) => (NET_SendPacket15B_TransactionResult_6FCAAC90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) as number) | 0,
  '0x6FCBBF40': (m, a) => (PARTY_CountSubPartyMembers_6FCBBF40_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAAA10': (m, a) => (NET_SendPacketBuffer32B_6FCAAA10_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAABF0': (m, a) => (NET_SendPacketBuffer15B_6FCAABF0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAC530': (m, a) => (S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAC5F0': (m, a) => (S2C_Send7BytePacketToPlayerUnit_6FCAC5F0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAC690': (m, a) => (S2C_Send11BytePacketToPlayerUnit_6FCAC690_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC6B3C0': (m, a) => { CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCAAA70': (m, a) => (NET_SendPacketBuffer21B_6FCAAA70_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAB2F0': (m, a) => (NET_SendPacketBuffer21B_Alt_6FCAB2F0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAC230': (m, a) => (S2C_QueueUnitTargetMovePacket16_6FCAC230_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!) as number) | 0,
  '0x6FCAC160': (m, a) => (S2C_QueueMonsterMovePacket12_6FCAC160_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC4AC60': (m, a) => { CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCAAF10': (m, a) => (NET_SendPacket42_ClearCursor_6FCAAF10_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC576F0': (m, a) => { PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC98100': (m, a) => (PLAYER_CanInterruptCurrentSkillOrEvent113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC57AC0': (m, a) => (PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCAC280': (m, a) => (NET_SendPacket13B_UnitCoordEvent_6FCAC280_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!) as number) | 0,
  '0x6FCAC420': (m, a) => (NET_SendPacket8B_GameHandshake_6FCAC420_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC46A30': (m, a) => (PLRMODE_IsDualWieldingClaws_6FC46A30_113c(m, a[0]!) as number) | 0,
  '0x6FC696B0': (m, a) => { CLIENTS_StoreSaveDataBuffer_6FC696B0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC900C0': (m, a) => { PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC82760': (m, a) => (ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC825F0': (m, a) => (ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC896B0': (m, a) => (OBJECTS_GrantUnitStrength_6FC896B0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC896D0': (m, a) => (OBJECTS_GrantUnitVitality_6FC896D0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC896F0': (m, a) => (OBJECTS_GrantUnitDexterity_6FC896F0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC89710': (m, a) => (OBJECTS_GrantUnitEnergy_6FC89710_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC536D0': (m, a) => { OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c(m, a[0]!); return 0 },
  '0x6FC8A900': (m, a) => { OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC89770': (m, a) => { SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8A930': (m, a) => { SHRINES_OnShrineStateRemoved_6FC8A930_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC82960': (m, a) => (ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82BB0': (m, a) => (ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC532F0': (m, a) => { OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c(m, a[0]!); return 0 },
  '0x6FC78F40': (m, a) => (ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC89860': (m, a) => { SHRINES_ApplyManaRechargeEffect_6FC89860_113c(m, a[0]!); return 0 },
  '0x6FC898A0': (m, a) => { SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c(m, a[0]!); return 0 },
  '0x6FC9A090': (m, a) => { SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC79060': (m, a) => (ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC79120': (m, a) => (ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC53680': (m, a) => { OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c(m, a[0]!); return 0 },
  '0x6FC9A570': (m, a) => { UNIT_SendStatB2Packet11ToClient_6FC9A570_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC9A440': (m, a) => { UNITMSG_QueuePacket9ACoords_6FC9A440_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!); return 0 },
  '0x6FC79390': (m, a) => (ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC898E0': (m, a) => (OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC89800': (m, a) => { SHRINES_ApplyHealthExchangeEffect_6FC89800_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8A1A0': (m, a) => { OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC9A3A0': (m, a) => { UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC9A0F0': (m, a) => { UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC9A190': (m, a) => { UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!); return 0 },
  '0x6FC89DE0': (m, a) => (OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC8A440': (m, a) => (OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCB0F00': (m, a) => { STATES_ClearGfxStateFlagCallback_6FCB0F00_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCB0F10': (m, a) => { STATES_ClearGfxStateFlagAndSetUpdate40_6FCB0F10_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC94E40': (m, a) => { MONSTER_Event10_ClearMonsterFields34And38_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC795C0': (m, a) => (ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC82A30': (m, a) => { ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c(m, a[0]!); return 0 },
  '0x6FC41AD0': (m, a) => { MONUMOD_ScheduleGetHitEvent2ForUnique_6FC41AD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC41B00': (m, a) => { MONUMOD_ScheduleGetHitOrDeathEvent2_6FC41B00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC41BB0': (m, a) => { MONUMOD_ScheduleDeathEvent4ForUnique_6FC41BB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC469F0': (m, a) => { MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC805F0': (m, a) => (ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC9B510': (m, a) => (MONSTER_GetOrRollRegionSubVariant113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC42880': (m, a) => { MONUMOD_ApplyExtraFastVelocity_6FC42880_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC43320': (m, a) => { MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC43390': (m, a) => { MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC950F0': (m, a) => (MONSTER_NullModeEventFallback113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC98150': (m, a) => { MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC437C0': (m, a) => { MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC42D00': (m, a) => { MONUMOD_ApplyGhostlyStats_6FC42D00_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC217E0': (m, a) => (ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, a[0]!) as number) | 0,
  '0x6FC2E210': (m, a) => { ITEMS_ClearAffixesAndItemCell_6FC2E210_113c(m, a[0]!); return 0 },
  '0x6FC332A0': (m, a) => (ITEMS_FindSuperiorQualityRecordIndex113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC90080': (m, a) => (PLRTRADE_HasAnyCubePageItemOnUnit113c(m, a[0]!) as number) | 0,
  '0x6FC901F0': (m, a) => (PLRTRADE_CanModifyBeltDuringTrade113c(m, a[0]!) as number) | 0,
  '0x6FC90010': (m, a) => { PLRTRADE_SyncClonedItemEarOrPersonalizedData113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC90C90': (m, a) => { PLRTRADE_BroadcastClearMercUnitCallback113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC90B70': (m, a) => (PLRTRADE_SendTradeAcceptButtonAndSetState3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCADEB0': (m, a) => { ITEMS_SendSwapContainerItemPacket0D_6FCADEB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FCADF10': (m, a) => { ITEMS_SendRemoveContainerItemPacket0A_6FCADF10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FCADFD0': (m, a) => { ITEMS_SendGroundItemPacket03_6FCADFD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FCAE090': (m, a) => { ITEMS_ZeroStaticPosAndSendPickupPacket01_6FCAE090_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FCB02E0': (m, a) => { NPCS_ResetVendorSlotInventory_6FCB02E0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC58FF0': (m, a) => { MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC58F40': (m, a) => (MISSILES_ConsumePierceStat_6FC58F40_113c(m, a[0]!) as number) | 0,
  '0x6FC59210': (m, a) => { MISSILES_InitDrunkenPath_6FC59210_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC5ADD0': (m, a) => (MISSILES_TargetFilter_MonstersOnly_6FC5ADD0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5AD70': (m, a) => (MISSILES_TargetFilter_PlayersAndAlignedMonsters_6FC5AD70_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC59BD0': (m, a) => { MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC5A790': (m, a) => { MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC5A850': (m, a) => { MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC9B4F0': (m, a) => { AIINIT_SpawnerResetFrameTimers113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC9BD00': (m, a) => (AI_FilterLivingGloamUnit113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC35890': (m, a) => (AI_CountNearbyMinion453Or461Callback_6FC35890_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCAFAA0': (m, a) => (SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC35660': (m, a) => (AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC9BB00': (m, a) => (AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC9BC70': (m, a) => (AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC9BD50': (m, a) => (AI_FallenShamanCorpseFilter113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC9BA40': (m, a) => (AI_ScanCallbackNearestBaseId136_6FC9BA40_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC9CF10': (m, a) => (AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC35B00': (m, a) => (AI_CheckTargetIsUnboundPutridDefiler_6FC35B00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCBE600': (m, a) => (SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c(m, a[0]!) as number) | 0,
  '0x6FC62290': (m, a) => { SKILLS_StatListExpireClearState_6FC62290_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC6DF60': (m, a) => (SKILLS_DivideValueByMonLvlHp113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC6C190': (m, a) => { SKILLS_AddDamagePercentStat_6FC6C190_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC47240': (m, a) => (SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB2030': (m, a) => (SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2C170': (m, a) => (SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB83B0': (m, a) => (SKILLS_FindFirstZeroByteOffsetInSeqRecord_6FCB83B0_113c(m, a[0]!) as number) | 0,
  '0x6FC6EC30': (m, a) => (SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c(m, a[0]!) as number) | 0,
  '0x6FC2DE20': (m, a) => (SKILLS_ResetUnitAiThinkEvent_6FC2DE20_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC6EEE0': (m, a) => (SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC54AA0': (m, a) => { QUESTS_SendQuestStateAlert5D_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC81D40': (m, a) => { ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC649F0': (m, a) => (SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC47270': (m, a) => (SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6DF20': (m, a) => (SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC6EE80': (m, a) => (SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC2C110': (m, a) => (SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, a[0]!) as number) | 0,
  '0x6FC47130': (m, a) => (SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC6ED60': (m, a) => (SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6EDD0': (m, a) => (SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC63CA0': (m, a) => { SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC80810': (m, a) => (ACT4_EndgameStatusFilter_6FC80810_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC81F30': (m, a) => (QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC81860': (m, a) => { ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC81BE0': (m, a) => (ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC803D0': (m, a) => { ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c(m, a[0]!); return 0 },
  '0x6FC80590': (m, a) => { ACT1Q4_MarkFlag52_6FC80590_113c(m, a[0]!); return 0 },
  '0x6FC805C0': (m, a) => { ACT1Q4_MarkFlag63_6FC805C0_113c(m, a[0]!); return 0 },
  '0x6FC82340': (m, a) => { ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC81420': (m, a) => (ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC82170': (m, a) => (QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC816F0': (m, a) => { ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC81C00': (m, a) => { ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC81500': (m, a) => (ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC81B20': (m, a) => { ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC78BA0': (m, a) => (ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC79180': (m, a) => { ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c(m, a[0]!); return 0 },
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

interface K6W5VectorRecord {
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

/**
 * Copy-on-write SparseMemory113c subclass backed by an immutable base page map
 * (hydrated once from d2game-datatbls-113c.img.gz + bindK2KernelGlobals113c + zeroed
 * 0x30000000..0x30008FFF staged arena) so resetting per vector case is O(dirtyPages).
 */
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

function loadVectors(): K6W5VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w5/k6-w5-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W5VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W5VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 5 real-DLL D2Game.dll Lo-VA (0x6FC20000..0x6FCBFFFF) differential vectors', () => {
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
