/**
 * K4 longitudinal Act 1-5 quest & town NPC replay bridge in pure SparseMemory113c.
 *
 * Wires already-ported D2Game.dll / D2Common.dll v1.13c functions for:
 * 1. Town NPC AI think dispatch (0x6FC3DB40, 0x6FC3BC60, 0x6FCBCB00, 0x6FC39880, 0x6FCCA4D0)
 * 2. Act 1-5 quest descriptor initialization (0x6FC548A0 + 0x6FD2DBF0 / 0x6FD2DF6C tables),
 *    active NPC quest-alert filters (+0xEC), and callback dispatch (+0xA0..+0xD8)
 * 3. C2S quest & consumable handlers (0x13, 0x2F, 0x31, 0x30, 0x20)
 * 4. F2 snapshot hydration of player .d2s quest/intro bit-buffers, pQuestControl (+0x10F4),
 *    NPC interaction heads (+0x30), and DRLG preset MapAI waypoint chains (+0x38)
 */
import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon.ts'
import { D2COMMON_SGPT_DATATABLES_VA_113C, D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, mulDiv113c, sdiv32 } from '../common/int-math.ts'
import {
  D2COMMON_GRID0_INFO_VA_113C,
  D2COMMON_GRID1_INFO_VA_113C,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
} from '../common/inventory.ts'
import {
  DATATBLS_FindCodeRecord4C113c,
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CheckItemTypeIdMem113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_GetRepairAllCost113c,
} from '../common/items.ts'
import { DATATBLS_GetItemsTxtRecordMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.ts'
import {
  SKILLS_AddSkillToUnit113c,
  SKILLS_GetSkillById113c,
} from '../common/skills.ts'
import {
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts'
import {
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import { GW_WAYPOINT_TABLE_BASE_VA_113C } from '../common/waypoint.ts'
import {
  D2AiGeneralStrc,
  D2DynamicPathStrc,
  D2HirelingTxt,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2MonsterDataStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  DATATBLS_GetHirelingTxtRecordFromClassId113c,
  DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c,
} from '../tables/monster-tbls-113c.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import { seedNext, type D2SeedStrc } from '../prng.ts'
import {
  DATATBLS_GetQualityItemsTxtRecord113c,
  SGPT_ITEMS_LINKER_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
} from '../tables/datatbls-113c.ts'
import { DATATBLS_GetItemDataTables113c } from '../tables/item-tbls-113c.ts'
import {
  ACT3Q1_Callback03_LevelChanged113c,
  registerK4QuestCallbackDispatcher113c,
} from './a1c-post150-f150-f276-113c.ts'
import { AI_FallenShamanCorpseFilter113c } from './ai-fallen-113c.ts'
import { D2GAME_ARENA_FindPlayerSlotByUnit113c } from './boot-init-gap-b-113c.ts'
import { dispatchC2SHandlerByVa113c } from './c2s-dispatch-113c.ts'
import { C2S_PACKET_TABLE_6FD1A078_113C } from './c2s-packet-113c.ts'
import {
  SUNIT_GetServerUnit113c,
  SUNIT_HASH_OFFSET_BY_TYPE_113C,
} from './game-strc.ts'
import { bindK2KernelGlobals113c } from './k2-d2tv-evaluators-113c.ts'
import { PLAYER_GetQuestRecordForDifficulty_6FC21020_113c } from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  AI_InitClearFreezeAndStall_6FC36060_113c,
  MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c,
  MONUMOD_ApplyExtraFastVelocity_6FC42880_113c,
} from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c,
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
  MONUMOD_RollBossOrMinionNameSeed113c,
} from './k2-items-tc-w1-113c.ts'
import {
  ACT5Q0_StatusFilter_6FC76EA0_113c,
  ACT5Q1_ActiveFilter_6FC76D80_113c,
  ACT5Q1_StatusFilter_6FC76E00_113c,
  ACT5Q2_ActiveFilter_6FC76C40_113c,
  ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c,
  ACT5Q4_ActiveFilter_6FC76840_113c,
  ACT5Q4_StatusFilter_6FC768C0_113c,
  ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c,
  ACT5Q6_ActiveFilter_6FC76810_113c,
  ACT5Q6_Callback14_PlayerJoined_6FC77540_113c,
} from './k2-laneM-0x6fc7-w1-113c.ts'
import {
  ACT3Q0_ActiveFilter113c,
  ACT3Q0_StatusFilter113c,
  ACT3Q1_HratliIntroActiveFilter113c,
  ACT3Q1_HratliIntroStatusFilter113c,
  ACT3Q2_DarkWandererStatusFilter113c,
  ACT3Q5_BlackenedTempleActiveFilter113c,
  ACT3Q6_MephistoActiveFilter113c,
  ACT3Q7_Callback14_PlayerJoined113c,
} from './k2-sunit-spawn-w1-113c.ts'
import {
  ACT1Q6_InitQuestData_6FC88060_113c,
  ACT2Q3_InitQuestData_6FCE7480_113c,
  ACT5Q4_InitQuestData_6FC7D5C0_113c,
  MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c,
  MONSTER_AssignTeleportSkill_6FC441B0_113c,
  QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c,
} from './k2-w10b1-113c.ts'
import { ACT5Q5_InitQuestData_6FC7FB50_113c } from './k2-w11b1-113c.ts'
import { C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c } from './k2-w12b1-113c.ts'
import {
  D2Game_6FCCA4D0_113c,
  D2Game_6FD08F30_113c,
} from './k2-w13b1-113c.ts'
import {
  ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c,
  ACT1Q3_OnNpcInitCainSearch_6FC86960_113c,
  ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c,
  ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c,
  ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c,
  ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c,
  ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c,
  dispatchQuestSeqFilterF0_113c,
} from './k2-w14b1-113c.ts'
import {
  ACT1Q2_InitQuestData_6FC89130_113c,
  ACT1Q4_InitQuestData_6FC887D0_113c,
  ACT1Q5_InitQuestData_6FC87210_113c as ACT1Q3_InitMalusQuestData_6FC87210_113c,
  ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c,
  ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c,
  ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c,
  ACT3Q2_OnNpcSpeechComplete_6FD09600_113c,
  ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c,
  ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c,
  ACT4Q2_InitQuestData_6FCDAD40_113c,
  ACT5Q2_InitQuestData_6FC7CC70_113c,
  ACT5Q3_InitQuestData_6FC7FC20_113c,
} from './k2-w15b1-113c.ts'
import {
  ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c,
  ACT2Q6_InitQuestTableRecord_6FCE9F60_113c,
  ACT3Q1_InitQuestTableRecord_6FD092D0_113c,
  ACT3Q2_InitQuestTableRecord_6FD09DC0_113c,
  ACT3Q4_InitQuestTableRecord_6FD093C0_113c,
  ACT3Q5_InitQuestTableRecord_6FD09200_113c,
  ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c,
  ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c,
  ACT5Q6_InitQuestTableRecord_6FC80080_113c,
} from './k2-w16b1-113c.ts'
import {
  ACT1_IntroStatusFilter_6FC80800_113c,
  ACT4_EndgameStatusFilter_6FC80810_113c,
  ACT4_IntroStatusFilter_6FC80170_113c,
} from './k2-w2b1-113c.ts'
import { ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c } from './k2-w2b2-113c.ts'
import {
  AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c,
  NET_SendPacket15B_TransactionResult_6FCAAC90_113c,
} from './k2-w2b3-113c.ts'
import { SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c } from './k2-w2b4-113c.ts'
import {
  MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c,
  MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c,
  MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c,
  MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c,
  MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c,
  MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c,
} from './k2-w2b5-113c.ts'
import {
  ACT2Q4_StatusFilter_6FCE1970_113c,
  ACT2Q5_StatusFilter_6FCE1960_113c,
  ACT4Prologue_ActiveFilter_6FCD8B50_113c,
  ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c,
  ACT4Prologue_StatusFilter_6FCD8B80_113c,
  ACT4Q0_StatusFilter_6FCD87D0_113c,
  ACT4Q2_ActiveFilter_6FCD8810_113c,
} from './k2-w2b6-113c.ts'
import {
  ACT2Q0_ActiveFilter_6FCE2590_113c,
  ACT2Q0_StatusFilter_6FCE25C0_113c,
  ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c,
  ACT2Q7_ActiveFilter_6FCE2750_113c,
  ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c,
  ACT2Q8_ActiveFilter_6FCE25D0_113c,
  ACT2Q8_StatusFilter_6FCE25E0_113c,
} from './k2-w2b7-113c.ts'
import {
  ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c,
  ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c,
} from './k2-w2b8-113c.ts'
import {
  ITEMS_SaveItemToNodeAndFree_6FC403D0_113c,
  MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c,
  MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c,
  MONUMOD_ApplyGhostlyStats_6FC42D00_113c,
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c,
  MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c,
} from './k2-w3b2-113c.ts'
import {
  QUESTS_AllocAndInitGameQuests_6FC548A0_113c,
  QUESTS_AttachUnitToQuest_6FC55890_113c,
  registerK4QuestStatusFilterDispatcher113c,
} from './k2-w3b3-113c.ts'
import {
  ACT5Intro_ActiveFilter_6FC79680_113c,
  ACT5Intro_Callback00_NpcActivate_6FC796B0_113c,
  ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c,
  ACT5Q1_Callback00_NpcActivate_6FC787C0_113c,
  ACT5Q2_Callback00_NpcActivate_6FC783C0_113c,
  ACT5Q3_ActiveFilter_6FC77F50_113c,
  ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c,
  ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c,
  ACT5Q4_Callback00_NpcActivate_6FC77A60_113c,
  ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c,
  ACT5Q5_Callback00_NpcActivate_6FC775F0_113c,
  ACT5Q6_ActiveFilter_6FC76EF0_113c,
  ACT5Q6_Callback00_NpcActivate_6FC77000_113c,
  ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c,
} from './k2-w3b5-113c.ts'
import {
  ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c,
  ACT1Q1_Callback00_NpcActivate_6FC82220_113c,
  ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c,
  ACT1Q2_Callback00_NpcActivate_6FC81F50_113c,
  ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c,
  ACT1Q3_Callback00_NpcActivate_6FC81030_113c,
  ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c,
  ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c,
  ACT1Q5_Callback00_NpcActivate_6FC81C60_113c,
  ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c,
  ACT1Q6_Callback00_NpcActivate_6FC80A80_113c,
  ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c,
  ACT1_IntroCainActivate_6FC824D0_113c,
  ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c,
  ACT1_IntroNpcActivate_6FC82E50_113c,
  ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c,
} from './k2-w3b6-113c.ts'
import {
  ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c,
  PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c,
} from './k2-w4b2-113c.ts'
import {
  ACT1Q0_InitQuestDescriptor_6FC82D90_113c,
  ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c,
  ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c,
  ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c,
} from './k2-w4b3-113c.ts'
import {
  AI_ScanCallbackFetishMinions_6FC9BB90_113c,
  AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c,
  AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c,
  AI_ScanCallbackNearestBaseId136_6FC9BA40_113c,
  AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c,
  AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c,
  AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c,
  AI_SubmergedOrStuckTransition_6FC9D550_113c,
} from './k2-w3b8-113c.ts'
import { AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c } from './k2-w4b4-113c.ts'
import {
  MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c,
  MONUMOD_ApplyChampionFanaticStats_6FC43810_113c,
  MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c,
  MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c,
  MONUMOD_ApplyColdEnchantedStats_6FC42320_113c,
  MONUMOD_ApplyFireEnchantedStats_6FC42740_113c,
  MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c,
  MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c,
} from './k2-w4b1-113c.ts'
import {
  ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c,
  MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c,
  MONAI_UnburrowThink_6FCC59B0_113c,
} from './k2-w4b7-113c.ts'
import {
  AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c,
  ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c,
  ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c,
  ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c,
  ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c,
  ACT4Q1_InitNpcDialog_6FCD9560_113c,
  ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c,
  ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c,
  ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c,
  ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c,
  ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c,
  ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c,
  ACT4Q3_InitNpcDialog_6FCD9070_113c,
  ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c,
} from './k2-w4b8-113c.ts'
import { NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c } from './k2-w5b2-113c.ts'
import {
  ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c,
  ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c,
  ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c,
  MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c,
  registerDefaultSpellIconHandler113c,
} from './k2-w5b3-113c.ts'
import {
  ACT2Q1_ActiveFilter_6FCE2520_113c,
  ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c,
  ACT2Q2_StatusFilter_6FCE3BD0_113c,
  ACT2Q3_ActiveFilter_6FCE2250_113c,
  ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c,
  ACT2Q4_ActiveFilter_6FCE2080_113c,
  ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c,
  ACT2Q5_ActiveFilter_6FCE1E10_113c,
  ACT2Q5_Callback00_NpcActivate_6FCE3080_113c,
  ACT2Q6_ActiveFilter_6FCE1C20_113c,
  ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c,
  ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c,
  ACT2Q6_StatusFilter_6FCE1D30_113c,
  ACT2Q8_ActiveFilter_6FCE25F0_113c,
  ACT2Q8_Callback00_NpcActivate_6FCE2680_113c,
  NPC_DeductPlayerGoldAndStash_6FCDCC60_113c,
  NPC_TransferInventoryItemsToOwner_6FCDCD90_113c,
} from './k2-w5b4-113c.ts'
import {
  ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c,
  ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c,
  ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c,
  ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c,
  ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c,
  ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c,
  ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c,
  ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c,
  ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c,
  ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c,
  ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c,
  ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c,
  MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c,
} from './k2-w5b5-113c.ts'
import {
  A5Q4_OpenTemplePortalObject_6FCE94E0_113c,
  ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c,
  ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c,
  ITEMS_UsePercentagePotion_6FCCE6D0_113c,
  NPCS_InitGameNpcControl_6FCAFBE0_113c,
} from './k2-w5b6-113c.ts'
import { SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c } from './k2-w5b7-113c.ts'
import {
  ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c,
  ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c,
  ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c,
  ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c,
  ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c,
  ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c,
  ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c,
  ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c,
  ACT3Q2_GidbinnActiveFilter_6FD04500_113c,
  ACT3Q2_GidbinnStatusFilter_6FD045B0_113c,
  ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c,
  ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c,
  ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c,
  ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c,
  ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c,
  ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c,
  ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c,
  ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c,
  ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c,
  ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c,
  ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c,
  ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c,
  ACT3_CainIntroActiveFilter_6FD055C0_113c,
  ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c,
} from './k2-w5b8-113c.ts'
import { ACT3Q4_StatusFilter_6FD06E00_113c } from './k2-w5b9-113c.ts'
import {
  ACT1Q5_StatusFilter_6FC85500_113c,
  ACT5Q3_StatusFilter_6FC7B8C0_113c,
} from './k2-w6b1-113c.ts'
import {
  ACT2Intro_InitQuestData_6FCE5730_113c,
  ACT2Q0_InitQuestData_6FCE5690_113c,
  ACT2Q2_ActiveFilter_6FCE5440_113c,
  ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c,
  ACT2Q7_InitQuestData_6FCE5790_113c,
  ACT2Q8_InitQuestData_6FCE4880_113c,
  ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c,
} from './k2-w6b2-113c.ts'
import {
  ACT3Q0_InitQuestData_6FD05920_113c,
  AI_ThinkCommand14TriggeredSkill_6FC9D670_113c,
} from './k2-w6b3-113c.ts'
import {
  ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c,
  ACT1Q1_TimerPromoteState5_6FC83B50_113c,
  ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c,
  ACT1Q2_TimerPromoteState3_6FC83A80_113c,
  ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c,
  ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c,
  ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c,
  ACT1Q5_TimerPromoteState0D_6FC83210_113c,
  ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c,
  ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c,
  ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c,
  ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c,
  ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c,
  ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c,
  AI_ThinkTyraelOrIzualGhost_6FC39880_113c,
} from './k2-w6b4-113c.ts'
import {
  ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c,
  ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c,
  ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c,
  ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c,
  ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c,
  ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c,
  ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c,
  ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c,
  ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c,
  ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c,
  ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c,
  ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c,
  ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c,
  ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c,
} from './k2-w6b5-113c.ts'
import {
  ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c,
  ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c,
  ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c,
  ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c,
  ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c,
  ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c,
  ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c,
} from './k2-w6b6-113c.ts'
import { QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c } from './k2-w7b1-113c.ts'
import { ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c } from './k2-w7b2-113c.ts'
import {
  ACT2Q5_OnScrollMessage_6FCE67C0_113c,
  ACT4Q3_OnScrollMessage_6FCDB250_113c,
  ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c,
} from './k2-w7b3-113c.ts'
import {
  ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c,
  ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c,
} from './k2-w7b4-113c.ts'
import {
  ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c,
  ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c,
  ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c,
  ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c,
  ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c,
  ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c,
  ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c,
} from './k2-w8b1-113c.ts'
import {
  ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c,
  ACT4Q1_OnNpcMessage_6FCDA5E0_113c,
  SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c,
} from './k2-w8b2-113c.ts'
import {
  ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c,
  ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c,
  ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c,
  ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c,
  ACT2Q5_InitQuestData_6FCE7080_113c,
  ACT3Q7_Callback00_NpcActivate_6FD07080_113c,
  NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c,
} from './k2-w8b3-113c.ts'
import {
  ACT3Q1_OnQuestItemPickedUp_6FD07640_113c,
  ACT3Q2_OnGidbinnPickedUp_6FD07770_113c,
  ACT3Q3_OnNpcSpeechComplete_6FD07940_113c,
} from './k2-w8b4-113c.ts'
import {
  ACT1Q1_InitQuestData_6FC85990_113c,
  ACT1Q5_InitQuestData_6FC89200_113c,
  ACT4Q1_InitQuestData_6FCDAE40_113c,
  ACT5Q1_InitQuestData_6FC7BEA0_113c,
  ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c,
} from './k2-w9b1-113c.ts'
import {
  ACT2Q1_InitQuestData_6FCE7B40_113c,
  ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c,
  ACT2Q4_InitQuestData_6FCE9400_113c,
  ACT3Q3_InitQuestData_6FD07CE0_113c,
  ACT3Q6_InitQuestData_6FD0A080_113c,
} from './k2-w9b2-113c.ts'
import {
  MON_EVENT_AI_THINK,
  registerAiTargetModeCallback113c,
  registerMonsterAiThinkVaHandler113c,
  registerPostActRoomsUpdateHook113c,
  registerPostSliceFrameCleanupHook113c,
  registerPreSliceFrameSetupHook113c,
} from './monster-events.ts'
import {
  clearPendingSavedObjectInitModes113c,
  flushPendingSavedObjectInitModes113c,
} from './objects-populate-113c.ts'
import { SUNIT_SetMonsterAlignmentState113c } from './regpop-spawn-113c.ts'
import { registerK4ReplayKernelBridge113c } from './replay-kernel-113c.ts'
import { EVENT_DeleteEventByArg14_113c } from './timer-wheel.ts'
import {
  AI_RogueTownMem113c,
  AI_SimpleMapAiNpc113c,
  AI_TownNpcMem113c,
} from './town-npc-ai-113c.ts'
import {
  PLAYER_FinishModeAndResetToNeutral113c,
  registerK4QuestNpcAlertDispatcher113c,
  registerK4QuestTimerDispatcher113c,
} from './town-runtime-gap-113c.ts'

const K4_AI_TICK_PARAM_SCRATCH_VA = 0x7ff67b00
const K4_PACKET_SCRATCH_VA = 0x7f000800
const K4_QUEST_ARG_SCRATCH_VA = 0x7f000c00

const ACT_TOWN_LEVEL_IDS_113C = [1, 40, 75, 103, 109] as const

function isByteAddrLoaded113c(m: Memory113c, addr: number): boolean {
  const a = addr >>> 0
  if (a === 0) return false
  const memInternal = m as unknown as { known?: Map<number, Uint8Array> }
  if (memInternal.known === undefined) return false
  const kp = memInternal.known.get(a >>> 12)
  return kp !== undefined && kp[a & 0xfff] !== 0
}

function findAsciiTag113c(bytes: Uint8Array, tag: string, minOff: number): number {
  const n = tag.length
  const end = bytes.length - n
  for (let i = minOff; i <= end; i++) {
    let match = true
    for (let k = 0; k < n; k++) {
      if (bytes[i + k] !== (tag.charCodeAt(k) & 0xff)) {
        match = false
        break
      }
    }
    if (match) return i
  }
  return -1
}

function dispatchQuestInitByVa113c(m: SparseMemory113c, pfnInit: number, pQuest: number): void {
  switch (pfnInit >>> 0) {
    // Act 1
    case 0x6fc82d90:
      ACT1Q0_InitQuestDescriptor_6FC82D90_113c(m, pQuest)
      return
    case 0x6fc85990:
      ACT1Q1_InitQuestData_6FC85990_113c(m, pQuest)
      return
    case 0x6fc89130:
      ACT1Q2_InitQuestData_6FC89130_113c(m, pQuest)
      return
    case 0x6fc87210:
      ACT1Q3_InitMalusQuestData_6FC87210_113c(m, pQuest)
      return
    case 0x6fc887d0:
      ACT1Q4_InitQuestData_6FC887D0_113c(m, pQuest)
      return
    case 0x6fc89200:
      ACT1Q5_InitQuestData_6FC89200_113c(m, pQuest)
      return
    case 0x6fc88060:
      ACT1Q6_InitQuestData_6FC88060_113c(m, pQuest)
      return
    case 0x6fc82fa0:
      ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c(m, pQuest)
      return
    case 0x6fc83cc0:
      ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c(m, pQuest)
      return
    // Act 2
    case 0x6fce5690:
      ACT2Q0_InitQuestData_6FCE5690_113c(m, pQuest)
      return
    case 0x6fce7b40:
      ACT2Q1_InitQuestData_6FCE7B40_113c(m, pQuest)
      return
    case 0x6fce7ed0:
      ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c(m, pQuest)
      return
    case 0x6fce7480:
      ACT2Q3_InitQuestData_6FCE7480_113c(m, pQuest)
      return
    case 0x6fce9400:
      ACT2Q4_InitQuestData_6FCE9400_113c(m, pQuest)
      return
    case 0x6fce7080:
      ACT2Q5_InitQuestData_6FCE7080_113c(m, pQuest)
      return
    case 0x6fce9f60:
      ACT2Q6_InitQuestTableRecord_6FCE9F60_113c(m, pQuest)
      return
    case 0x6fce5790:
      ACT2Q7_InitQuestData_6FCE5790_113c(m, pQuest)
      return
    case 0x6fce4880:
      ACT2Q8_InitQuestData_6FCE4880_113c(m, pQuest)
      return
    case 0x6fce5730:
      ACT2Intro_InitQuestData_6FCE5730_113c(m, pQuest)
      return
    // Act 3
    case 0x6fd06660:
      ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c(m, pQuest)
      return
    case 0x6fd093c0:
      ACT3Q4_InitQuestTableRecord_6FD093C0_113c(m, pQuest)
      return
    case 0x6fd07ce0:
      ACT3Q3_InitQuestData_6FD07CE0_113c(m, pQuest)
      return
    case 0x6fd09dc0:
      ACT3Q2_InitQuestTableRecord_6FD09DC0_113c(m, pQuest)
      return
    case 0x6fd092d0:
      ACT3Q1_InitQuestTableRecord_6FD092D0_113c(m, pQuest)
      return
    case 0x6fd09200:
      ACT3Q5_InitQuestTableRecord_6FD09200_113c(m, pQuest)
      return
    case 0x6fd0a080:
      ACT3Q6_InitQuestData_6FD0A080_113c(m, pQuest)
      return
    case 0x6fd05920:
      ACT3Q0_InitQuestData_6FD05920_113c(m, pQuest)
      return
    case 0x6fd06700:
      ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c(m, pQuest)
      return
    // Act 4
    case 0x6fcd9d80:
      ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c(m, pQuest)
      return
    case 0x6fcdae40:
      ACT4Q1_InitQuestData_6FCDAE40_113c(m, pQuest)
      return
    case 0x6fcdc5f0:
      ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c(m, pQuest)
      return
    case 0x6fcdad40:
      ACT4Q2_InitQuestData_6FCDAD40_113c(m, pQuest)
      return
    case 0x6fcd97d0:
      ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c(m, pQuest)
      return
    // Act 5
    case 0x6fc7bea0:
      ACT5Q1_InitQuestData_6FC7BEA0_113c(m, pQuest)
      return
    case 0x6fc7cc70:
      ACT5Q2_InitQuestData_6FC7CC70_113c(m, pQuest)
      return
    case 0x6fc7fc20:
      ACT5Q3_InitQuestData_6FC7FC20_113c(m, pQuest)
      return
    case 0x6fc7d5c0:
      ACT5Q4_InitQuestData_6FC7D5C0_113c(m, pQuest)
      return
    case 0x6fc7fb50:
      ACT5Q5_InitQuestData_6FC7FB50_113c(m, pQuest)
      return
    case 0x6fc80080:
      ACT5Q6_InitQuestTableRecord_6FC80080_113c(m, pQuest)
      return
    case 0x6fc7a7c0:
      ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c(m, pQuest)
      return
    default:
      return
  }
}

export function dispatchK4QuestNpcAlert113c(
  m: Memory113c,
  pfnCheck: number,
  pQuest: number,
  pPlayer: number,
  npcClassId: number,
  pQuestFlags: number,
  pNpc: number,
): number {
  const sm = m as SparseMemory113c
  switch (pfnCheck >>> 0) {
    // Act 2
    case 0x6fce2590:
      return ACT2Q0_ActiveFilter_6FCE2590_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce2520:
      return ACT2Q1_ActiveFilter_6FCE2520_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce5440:
      return ACT2Q2_ActiveFilter_6FCE5440_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce2250:
      return ACT2Q3_ActiveFilter_6FCE2250_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce2080:
      return ACT2Q4_ActiveFilter_6FCE2080_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce1e10:
      return ACT2Q5_ActiveFilter_6FCE1E10_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce1c20:
      return ACT2Q6_ActiveFilter_6FCE1C20_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce2750:
      return ACT2Q7_ActiveFilter_6FCE2750_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce25d0:
      return ACT2Q8_ActiveFilter_6FCE25D0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fce25f0:
      return ACT2Q8_ActiveFilter_6FCE25F0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    // Act 3
    case 0x6fd028a0:
      return ACT3Q0_ActiveFilter113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd03000:
      return ACT3Q1_HratliIntroActiveFilter113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd055c0:
      return ACT3_CainIntroActiveFilter_6FD055C0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd04030:
      return ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd04500:
      return ACT3Q2_GidbinnActiveFilter_6FD04500_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd04f60:
      return ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd053f0:
      return ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd02ab0:
      return ACT3Q5_BlackenedTempleActiveFilter113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fd028c0:
      return ACT3Q6_MephistoActiveFilter113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    // Act 4
    case 0x6fcd8b50:
      return ACT4Prologue_ActiveFilter_6FCD8B50_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fcd8ae0:
      return ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fcd8810:
      return ACT4Q2_ActiveFilter_6FCD8810_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fcd8b90:
      return ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fcd8970:
      return ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    // Act 5
    case 0x6fc79680:
      return ACT5Intro_ActiveFilter_6FC79680_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76d80:
      return ACT5Q1_ActiveFilter_6FC76D80_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76c40:
      return ACT5Q2_ActiveFilter_6FC76C40_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc77f50:
      return ACT5Q3_ActiveFilter_6FC77F50_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76840:
      return ACT5Q4_ActiveFilter_6FC76840_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76810:
      return ACT5Q6_ActiveFilter_6FC76810_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    case 0x6fc76ef0:
      return ACT5Q6_ActiveFilter_6FC76EF0_113c(sm, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc)
    default:
      return 0
  }
}

export function dispatchK4QuestCallback113c(
  m: Memory113c,
  pfnCallback: number,
  pQuest: number,
  pArg: number,
): boolean {
  const sm = m as SparseMemory113c
  switch (pfnCallback >>> 0) {
    // cbIdx 0x00: NpcActivate (+0xA0)
    case 0x6fc77000:
      ACT5Q6_Callback00_NpcActivate_6FC77000_113c(sm, pQuest, pArg)
      return true
    case 0x6fc775f0:
      ACT5Q5_Callback00_NpcActivate_6FC775F0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc77a60:
      ACT5Q4_Callback00_NpcActivate_6FC77A60_113c(sm, pQuest, pArg)
      return true
    case 0x6fc783c0:
      ACT5Q2_Callback00_NpcActivate_6FC783C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc787c0:
      ACT5Q1_Callback00_NpcActivate_6FC787C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc796b0:
      ACT5Intro_Callback00_NpcActivate_6FC796B0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7da70:
      ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c(sm, pQuest, pArg)
      return true
    case 0x6fc80a80:
      ACT1Q6_Callback00_NpcActivate_6FC80A80_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81030:
      ACT1Q3_Callback00_NpcActivate_6FC81030_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81c60:
      ACT1Q5_Callback00_NpcActivate_6FC81C60_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81f50:
      ACT1Q2_Callback00_NpcActivate_6FC81F50_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82220:
      ACT1Q1_Callback00_NpcActivate_6FC82220_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82410:
      ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c(sm, pQuest, pArg)
      return true
    case 0x6fc824d0:
      ACT1_IntroCainActivate_6FC824D0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82e50:
      ACT1_IntroNpcActivate_6FC82E50_113c(sm, pQuest, pArg)
      return true
    case 0x6fc86960:
      ACT1Q3_OnNpcInitCainSearch_6FC86960_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd8c00:
      ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd8ce0:
      ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9070:
      ACT4Q3_InitNpcDialog_6FCD9070_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9560:
      ACT4Q1_InitNpcDialog_6FCD9560_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9730:
      ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2680:
      ACT2Q8_Callback00_NpcActivate_6FCE2680_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2b00:
      ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c(sm, pQuest, pArg)
      return true
    case 0x6fce3080:
      ACT2Q5_Callback00_NpcActivate_6FCE3080_113c(sm, pQuest, pArg)
      return true
    case 0x6fce37f0:
      ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4320:
      ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4570:
      ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4690:
      ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4900:
      ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4ea0:
      ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce5310:
      ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c(sm, pQuest, pArg)
      return true
    case 0x6fd033a0:
      ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03970:
      ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03e30:
      ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c(sm, pQuest, pArg)
      return true
    case 0x6fd042f0:
      ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd04c90:
      ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c(sm, pQuest, pArg)
      return true
    case 0x6fd05270:
      ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c(sm, pQuest, pArg)
      return true
    case 0x6fd054c0:
      ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd055f0:
      ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c(sm, pQuest, pArg)
      return true

    // cbIdx 0x02: NpcDeactivate (+0xA8)
    case 0x6fc79be0:
      ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7a0a0:
      ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7a530:
      ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7a720:
      ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7d520:
      ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7d920:
      ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83190:
      ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c(sm, pQuest, pArg)
      return true
    case 0x6fc835d0:
      ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83870:
      ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83ad0:
      ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83c40:
      ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9de0:
      ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fcda100:
      ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c(sm, pQuest, pArg)
      return true
    case 0x6fcdb1b0:
      ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce5a60:
      ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c(sm, pQuest, pArg)
      return true
    case 0x6fce5db0:
      ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce61c0:
      ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd051c0:
      ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd06bd0:
      ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd06cf0:
      ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c(sm, pQuest, pArg)
      return true

    // cbIdx 0x0B: ScrollMessage (+0xCC)
    case 0x6fc77270:
      ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c(sm, pQuest, pArg)
      return true
    case 0x6fc797b0:
      ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7b4f0:
      ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7b7a0:
      ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7c9e0:
      ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7f200:
      ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7f5e0:
      ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82490:
      ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c(sm, pQuest, pArg)
      return true
    case 0x6fc82f00:
      ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c(sm, pQuest, pArg)
      return true
    case 0x6fc83f90:
      ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c(sm, pQuest, pArg)
      return true
    case 0x6fc84430:
      ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c(sm, pQuest, pArg)
      return true
    case 0x6fc85260:
      ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c(sm, pQuest, pArg)
      return true
    case 0x6fc86ce0:
      ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc87000:
      ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c(sm, pQuest, pArg)
      return true
    case 0x6fc88920:
      ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd97a0:
      ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fcda5e0:
      ACT4Q1_OnNpcMessage_6FCDA5E0_113c(sm, pQuest, pArg, (mem, pq) => {
        ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c(mem, pq)
      })
      return true
    case 0x6fcdaa50:
      ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c(sm, pQuest, pArg)
      return true
    case 0x6fcdb250:
      ACT4Q3_OnScrollMessage_6FCDB250_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2720:
      ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4620:
      ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4780:
      ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c(sm, pQuest, pArg)
      return true
    case 0x6fce4a40:
      ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c(sm, pQuest, pArg)
      return true
    case 0x6fce67c0:
      ACT2Q5_OnScrollMessage_6FCE67C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce6b30:
      ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c(sm, pQuest, pArg, (mem, pq) => {
        dispatchQuestSeqFilterF0_113c(mem as SparseMemory113c, pq)
      })
      return true
    case 0x6fce6e90:
      ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c(sm, pQuest, pArg, (mem, pq) => {
        dispatchQuestSeqFilterF0_113c(mem as SparseMemory113c, pq)
      })
      return true
    case 0x6fce7dc0:
      ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce8050:
      ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(sm, pQuest, pArg)
      return true
    case 0x6fce85a0:
      ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd05540:
      ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c(sm, pQuest, pArg)
      return true
    case 0x6fd056e0:
      ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd07080:
      ACT3Q7_Callback00_NpcActivate_6FD07080_113c(sm, pQuest, pArg)
      return true
    case 0x6fd07940:
      ACT3Q3_OnNpcSpeechComplete_6FD07940_113c(sm, pQuest, pArg)
      return true
    case 0x6fd089a0:
      ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd08b60:
      ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c(sm, pQuest, pArg)
      return true
    case 0x6fd08fe0:
      ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd09600:
      ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(sm, pQuest, pArg)
      return true

    // cbIdx 0x0D: PlayerStartedGame (+0xD4)
    case 0x6fc77540:
      ACT5Q6_Callback14_PlayerJoined_6FC77540_113c(sm, pQuest, pArg)
      return true
    case 0x6fc77e80:
      ACT5Q3_Callback11_OnPlayerConnect_6FC77E80_113c(sm, pQuest, pArg)
      return true
    case 0x6fc781a0:
      ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc78930:
      ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c(sm, pQuest, pArg)
      return true
    case 0x6fc79450:
      ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c(sm, pQuest, pArg)
      return true
    case 0x6fc7ae20:
      ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c(sm, pQuest, pArg)
      return true
    case 0x6fc808b0:
      ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c(sm, pQuest, pArg)
      return true
    case 0x6fc80e00:
      ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81540:
      ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81a80:
      ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c(sm, pQuest, pArg)
      return true
    case 0x6fc81e30:
      ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c(sm, pQuest, pArg)
      return true
    case 0x6fc820e0:
      ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd8f20:
      ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9320:
      ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c(sm, pQuest, pArg)
      return true
    case 0x6fcd9830:
      ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2900:
      ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c(sm, pQuest, pArg)
      return true
    case 0x6fce2dc0:
      ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce3320:
      ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c(sm, pQuest, pArg)
      return true
    case 0x6fce3a80:
      ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c(sm, pQuest, pArg)
      return true
    case 0x6fce41d0:
      ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce44e0:
      ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c(sm, pQuest, pArg)
      return true
    case 0x6fce72c0:
      ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03050:
      ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03120:
      ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03850:
      ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c(sm, pQuest, pArg)
      return true
    case 0x6fd03b40:
      ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c(sm, pQuest, pArg)
      return true
    case 0x6fd049e0:
      ACT3Q7_Callback14_PlayerJoined113c(sm, pQuest, pArg)
      return true
    case 0x6fd050c0:
      ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd05450:
      ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c(sm, pQuest, pArg)
      return true
    case 0x6fd06000:
      ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c(sm, pQuest, pArg)
      return true

    // cbIdx 0x04 / 0x05: ItemPickedUp (+0xB0) & ItemDropped (+0xB4)
    case 0x6fce5f30:
      ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c(sm, pQuest, pArg)
      return true
    case 0x6fce3e10:
      ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c(sm, pQuest, pArg)
      return true
    case 0x6fd06190:
      ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c(sm, pQuest, pArg)
      return true
    case 0x6fd07af0:
      ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c(sm, pQuest, pArg)
      return true
    case 0x6fd07a40:
      ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c(sm, pQuest, pArg)
      return true
    case 0x6fd07640:
      ACT3Q1_OnQuestItemPickedUp_6FD07640_113c(sm, pQuest, pArg)
      return true
    case 0x6fd07770:
      ACT3Q2_OnGidbinnPickedUp_6FD07770_113c(sm, pQuest, pArg)
      return true

    // cbIdx 0x03: LevelChanged (+0xAC) override for ACT4Q2 (0x6FCDA1E0)
    case 0x6fcda1e0:
    case 0x6fcda1e1:
      runAct4Q2LevelChanged6FCDA1E0_113c(sm, pQuest, pArg)
      return true

    default:
      return false
  }
}

function runAct4Q2LevelChanged6FCDA1E0_113c(
  m: SparseMemory113c,
  pQuest: number,
  pArg: number,
): void {
  ACT3Q1_Callback03_LevelChanged113c(m, pQuest, pArg, {
    onQuestSetMainState: (mem, pq, st) =>
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(mem as SparseMemory113c, pq, st),
    onForEachPlayerUnit: (mem, pg) => {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        mem as SparseMemory113c,
        pg,
        ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c,
        0,
        0,
      )
    },
  })
}

/**
 * Builds static vendor trade (`0x6FD30208 + idx*16`, count `0x6FD3020C + idx*16`, 12 bytes/entry)
 * and permanent-item (`0x6FD30210 + idx*16`, count `0x6FD30214 + idx*16`, 4 bytes/entry) tables
 * from `sgItemDataTables` (`0x6FDEFB94`) once per `nVendorIdx` (`0..16`), guarded by `0x6FD301F0[idx]`.
 *
 * @va D2Game:0x6FCAF1B0
 */
export function SUNITNPC_BuildVendorStaticTable_6FCAF1B0_113c(
  m: Memory113c,
  nVendorIdx: number,
): void {
  const vIdx = nVendorIdx | 0
  const pItemTables = DATATBLS_GetItemDataTables113c(m) >>> 0
  if (m.u8((0x6fd301f0 + vIdx) >>> 0) !== 0) {
    return
  }
  m.setU8((0x6fd301f0 + vIdx) >>> 0, 1)
  const nItems = m.u32(pItemTables) | 0
  let nCount1 = 0
  let nCount2 = 0
  if (nItems > 0) {
    const pItemsBase = m.u32((pItemTables + 0x04) >>> 0) >>> 0
    for (let i = 0, recOff = 0; i < nItems; i = (i + 1) | 0, recOff = (recOff + 0x1a8) | 0) {
      const pRec = (pItemsBase + recOff) >>> 0
      if (m.u8((pRec + 0x133) >>> 0) === 0) continue
      if (
        m.u8((pRec + vIdx + 0x157) >>> 0) === 0 &&
        m.u8((pRec + vIdx + 0x179) >>> 0) === 0
      ) {
        continue
      }
      if (m.u8((pRec + 0x1a4) >>> 0) === 0) {
        nCount1 = (nCount1 + 1) | 0
      } else {
        nCount2 = (nCount2 + 1) | 0
      }
    }
  }
  const nBytes1 = (nCount1 * 12) >>> 0
  const pBuf1 = m.alloc(nBytes1 > 0 ? nBytes1 : 4) >>> 0
  if (nBytes1 > 0) {
    m.fill(pBuf1, nBytes1, 0)
  }
  const pStaticRec = (0x6fd30200 + ((vIdx << 4) >>> 0)) >>> 0
  m.setU32((pStaticRec + 0x08) >>> 0, pBuf1)
  m.setU32((pStaticRec + 0x0c) >>> 0, nCount1 >>> 0)

  const nBytes2 = (nCount2 << 2) >>> 0
  const pBuf2 = m.alloc(nBytes2 > 0 ? nBytes2 : 4) >>> 0
  if (nBytes2 > 0) {
    m.fill(pBuf2, nBytes2, 0)
  }
  m.setU32((pStaticRec + 0x10) >>> 0, pBuf2)
  m.setU32((pStaticRec + 0x14) >>> 0, nCount2 >>> 0)

  const totalItems = m.u32(pItemTables) | 0
  if (totalItems > 0) {
    let outOff1 = 0
    let outOff2 = 0
    for (let i = 0, recOff = 0; i < totalItems; i = (i + 1) | 0, recOff = (recOff + 0x1a8) | 0) {
      const pItemsBase = m.u32((pItemTables + 0x04) >>> 0) >>> 0
      const pRec = (pItemsBase + recOff) >>> 0
      if (m.u8((pRec + 0x133) >>> 0) === 0) continue
      if (
        m.u8((pRec + vIdx + 0x157) >>> 0) === 0 &&
        m.u8((pRec + vIdx + 0x179) >>> 0) === 0
      ) {
        continue
      }
      if (m.u8((pRec + 0x1a4) >>> 0) === 0) {
        const pDst1 = m.u32((pStaticRec + 0x08) >>> 0) >>> 0
        m.setU8((pDst1 + outOff1) >>> 0, m.u8((pRec + vIdx + 0x146) >>> 0))
        m.setU8((pDst1 + outOff1 + 0x01) >>> 0, m.u8((pRec + vIdx + 0x157) >>> 0))
        m.setU8((pDst1 + outOff1 + 0x02) >>> 0, m.u8((pRec + vIdx + 0x168) >>> 0))
        m.setU8((pDst1 + outOff1 + 0x03) >>> 0, m.u8((pRec + vIdx + 0x179) >>> 0))
        m.setU32((pDst1 + outOff1 + 0x04) >>> 0, m.u32((pRec + 0x80) >>> 0))
        m.setU8((pDst1 + outOff1 + 0x08) >>> 0, m.u8((pRec + vIdx + 0x18a) >>> 0))
        outOff1 = (outOff1 + 0x0c) | 0
      } else {
        const pDst2 = m.u32((pStaticRec + 0x10) >>> 0) >>> 0
        m.setU32((pDst2 + outOff2) >>> 0, m.u32((pRec + 0x80) >>> 0))
        outOff2 = (outOff2 + 0x04) | 0
      }
    }
  }
}

export function hydrateK4QuestAndNpcState113c(
  m: Memory113c,
  pGame: number,
  saveBytes?: Uint8Array,
): void {
  if (pGame === 0) return
  bindK4SliceFrameTrackingContext113c(m, pGame)
  if (!isByteAddrLoaded113c(m, 0x7f9c4ff0)) {
    m.setU32(0x7f9c4ff0, 0)
  }
  if (!isByteAddrLoaded113c(m, 0x004000f0)) {
    m.setU32(0x004000f0, 0)
  }
  if (!isByteAddrLoaded113c(m, 0x004000f4)) {
    m.setU32(0x004000f4, 0)
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
    if (isByteAddrLoaded113c(m, addr)) {
      savedBssLoaded[i] = true
      savedBssVals[i] = m.u32(addr) >>> 0
    }
  }
  const sm = m as SparseMemory113c
  bindK2KernelGlobals113c(sm)
  m.setU32(0x6fd18d14, 0)
  for (let i = 0; i < savedBssAddrs.length; i++) {
    if (savedBssLoaded[i] && savedBssVals[i] !== 0 && m.u32(savedBssAddrs[i]!) === 0) {
      m.setU32(savedBssAddrs[i]!, savedBssVals[i]!)
    }
  }

  // Sync sgptDataTables + 0xA74 with DATATBLS_GetSuperUniquesTxtRecordCount (0x6FDF09B4)
  // so 0x6FC67CF0 (ROOM_SpawnMonsterPreset113c) resolves specialId = 2..32 presets accurately.
  if (isByteAddrLoaded113c(m, 0x6fde9e1c) && isByteAddrLoaded113c(m, 0x6fdf09b4)) {
    const pDataTables = m.u32(0x6fde9e1c) >>> 0
    const nSuperUniques = m.u32(0x6fdf09b4) >>> 0
    if (
      pDataTables !== 0 &&
      nSuperUniques > 0 &&
      nSuperUniques < 0x1000 &&
      isByteAddrLoaded113c(m, (pDataTables + 0xa74) >>> 0)
    ) {
      m.setU32((pDataTables + 0xa74) >>> 0, nSuperUniques)
    }
  }

  // 0. Hydrate D2ItemsTxt Fog code-lookup linker (CD2TxtLinkStrc at SGPT_ITEMS_LINKER_PTR_VA) if unmapped
  const curItemsLinker = m.u32(SGPT_ITEMS_LINKER_PTR_VA) >>> 0
  if (curItemsLinker === 0 || !isByteAddrLoaded113c(m, curItemsLinker)) {
    const nItems = m.u32(SGPT_ITEMS_TXT_COUNT_VA) | 0
    const pItemsBase = m.u32(SGPT_ITEMS_TXT_PTR_VA) >>> 0
    if (nItems > 0 && pItemsBase !== 0 && isByteAddrLoaded113c(m, pItemsBase)) {
      const codes = new Uint32Array(nItems)
      const indices = new Int32Array(nItems)
      for (let i = 0; i < nItems; i++) {
        const pRec = (pItemsBase + Math.imul(i, D2ItemsTxt_SIZE)) >>> 0
        const c = m.get(pRec, D2ItemsTxt.dwCode) >>> 0
        let pos = i
        while (pos > 0 && codes[pos - 1]! > c) {
          codes[pos] = codes[pos - 1]!
          indices[pos] = indices[pos - 1]!
          pos = (pos - 1) | 0
        }
        codes[pos] = c
        indices[pos] = i
      }
      const pLinker = m.alloc(0x10) >>> 0
      const pEntries = m.alloc(nItems * 8) >>> 0
      m.fill(pLinker, 0x10, 0)
      m.setU32(pLinker, nItems >>> 0)
      m.setU32((pLinker + 0x04) >>> 0, nItems >>> 0)
      m.setU32((pLinker + 0x08) >>> 0, pEntries)
      for (let i = 0; i < nItems; i++) {
        m.setU32((pEntries + i * 8) >>> 0, codes[i]!)
        m.setU32((pEntries + i * 8 + 4) >>> 0, indices[i]! >>> 0)
      }
      m.setU32(SGPT_ITEMS_LINKER_PTR_VA, pLinker)
    }
  }

  // Hydrate pGame->pNpcControl (+0x1D24) via 0x6FCAF1B0 + 0x6FCAFBE0 if zeroed or unmapped
  const curNpcCtrl = m.u32((pGame + 0x1d24) >>> 0) >>> 0
  if (curNpcCtrl === 0 || !isByteAddrLoaded113c(m, curNpcCtrl)) {
    if (!isByteAddrLoaded113c(m, 0x6fd31c0c)) {
      m.setU32(0x6fd31c0c, 0)
    }
    if (!isByteAddrLoaded113c(m, 0x6fd31c10)) {
      m.setU32(0x6fd31c10, 0)
    }
    if (!isByteAddrLoaded113c(m, 0x6fd301f0)) {
      m.fill(0x6fd301f0, 0x128, 0)
    }
    const nVendorItems = isByteAddrLoaded113c(m, SGPT_ITEMS_TXT_COUNT_VA)
      ? (m.u32(SGPT_ITEMS_TXT_COUNT_VA) | 0)
      : 0
    const pVendorItemsBase = isByteAddrLoaded113c(m, SGPT_ITEMS_TXT_PTR_VA)
      ? (m.u32(SGPT_ITEMS_TXT_PTR_VA) >>> 0)
      : 0
    if (
      nVendorItems > 0 &&
      pVendorItemsBase !== 0 &&
      isByteAddrLoaded113c(m, pVendorItemsBase)
    ) {
      for (let vIdx = 0; vIdx <= 0x10; vIdx++) {
        const flagAddr = (0x6fd301f0 + vIdx) >>> 0
        if (!isByteAddrLoaded113c(m, flagAddr)) {
          m.setU8(flagAddr, 0)
        } else if (m.u8(flagAddr) !== 0) {
          const pStaticRec = (0x6fd30200 + ((vIdx << 4) >>> 0)) >>> 0
          const pSrc1 = isByteAddrLoaded113c(m, (pStaticRec + 0x08) >>> 0)
            ? (m.u32((pStaticRec + 0x08) >>> 0) >>> 0)
            : 0
          const pSrc2 = isByteAddrLoaded113c(m, (pStaticRec + 0x10) >>> 0)
            ? (m.u32((pStaticRec + 0x10) >>> 0) >>> 0)
            : 0
          if (
            pSrc1 === 0 ||
            !isByteAddrLoaded113c(m, pSrc1) ||
            pSrc2 === 0 ||
            !isByteAddrLoaded113c(m, pSrc2)
          ) {
            m.setU8(flagAddr, 0)
          }
        }
        SUNITNPC_BuildVendorStaticTable_6FCAF1B0_113c(sm, vIdx)
      }
    }

    const savedNpcGameSeedLo = m.u32((pGame + 0xd0) >>> 0) >>> 0
    const savedNpcGameSeedHi = m.u32((pGame + 0xd4) >>> 0) >>> 0
    const dwInitSeed = isByteAddrLoaded113c(m, (pGame + 0x7c) >>> 0)
      ? (m.u32((pGame + 0x7c) >>> 0) >>> 0)
      : 0
    const dwMonRegSeedLo = isByteAddrLoaded113c(m, (pGame + 0x80) >>> 0)
      ? (m.u32((pGame + 0x80) >>> 0) >>> 0)
      : 0
    if (dwMonRegSeedLo !== 0) {
      let lo = dwInitSeed
      let hi = 666
      for (let step = 0; step <= 32; step++) {
        if (lo === dwMonRegSeedLo) {
          m.setU32((pGame + 0xd0) >>> 0, lo)
          m.setU32((pGame + 0xd4) >>> 0, hi)
          break
        }
        const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
        lo = Number(prod & 0xffffffffn) >>> 0
        hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
      }
    }
    NPCS_InitGameNpcControl_6FCAFBE0_113c(sm, pGame)
    m.setU32((pGame + 0xd0) >>> 0, savedNpcGameSeedLo)
    m.setU32((pGame + 0xd4) >>> 0, savedNpcGameSeedHi)

    const pSlotIdxScratch = K4_QUEST_ARG_SCRATCH_VA
    const npcMonHashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_MONSTER]!) >>> 0
    for (let b = 0; b < 128; b++) {
      let pMon = m.u32((npcMonHashBase + b * 4) >>> 0) >>> 0
      while (pMon !== 0) {
        const monClassId = m.u32((pMon + 0x04) >>> 0) >>> 0
        const pSlot =
          D2GAME_ARENA_FindPlayerSlotByUnit113c(sm, pSlotIdxScratch, pGame, monClassId) >>> 0
        if (pSlot !== 0) {
          const curMonInv = m.u32((pMon + 0x60) >>> 0) >>> 0
          if (curMonInv === 0 || !isByteAddrLoaded113c(m, curMonInv)) {
            const pSlotInv = m.u32((pSlot + 0x04) >>> 0) >>> 0
            if (pSlotInv !== 0) {
              m.setU32((pMon + 0x60) >>> 0, pSlotInv)
            }
          }
        }
        pMon = m.get(pMon, D2UnitStrc.pGameHashNext) >>> 0
      }
    }
  }

  // Hydrate D2Game 0x6FD27238 SpellIcon dispatch table (31 entries) if unmapped
  if (!isByteAddrLoaded113c(m, 0x6fd27330)) {
    m.fill(0x6fd27238, 0xfc, 0)
    m.setU32(0x6fd27240, 0x6fcccfd0)
    m.setU32(0x6fd27244, 0x6fccdac0)
    m.setU32(0x6fd2724c, 0x6fccf450)
    m.setU32(0x6fd27254, 0x6fccedc0)
    m.setU32(0x6fd2725c, 0x6fccea40)
    m.setU32(0x6fd27264, 0x6fcce6d0)
    m.setU32(0x6fd2726c, 0x6fccf370)
    m.setU32(0x6fd27274, 0x6fccd9c0)
    m.setU32(0x6fd2727c, 0x6fccca20)
    m.setU32(0x6fd27284, 0x6fcce4d0)
    m.setU32(0x6fd2728c, 0x6fccdf20)
    m.setU32(0x6fd27294, 0x6fccdee0)
    m.setU32(0x6fd27330, 0x1f)
  }

  // Hydrate unmapped unit node chains (+0x74 pField74, +0xD8 pQuestChain) on F2 snapshot units
  const questItemsToReattach = new Set<number>()
  for (let listIdx = 0; listIdx < 5; listIdx++) {
    const hashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[listIdx]!) >>> 0
    for (let b = 0; b < 128; b++) {
      let pU = m.u32((hashBase + b * 4) >>> 0) >>> 0
      while (pU !== 0) {
        const pNode74 = m.u32((pU + 0x74) >>> 0) >>> 0
        if (pNode74 !== 0 && !isByteAddrLoaded113c(m, pNode74)) {
          m.fill(pNode74, 0x08, 0)
          m.setU32((pU + 0x74) >>> 0, 0)
          if (m.u32(pU) === 4) {
            questItemsToReattach.add(pU)
          }
        }
        const pQuestChain = m.u32((pU + 0xd8) >>> 0) >>> 0
        if (pQuestChain !== 0 && !isByteAddrLoaded113c(m, pQuestChain)) {
          m.fill(pQuestChain, 0x10, 0)
        }
        pU = m.get(pU, D2UnitStrc.pGameHashNext) >>> 0
      }
    }
  }

  // Hydrate unmapped pGame->pSubPartyBuckets[0..9] (+0x10F8..+0x111C, D2Game:0x6FD0FDB0..0x6FD0FF90)
  for (let subBucket = 0; subBucket < 10; subBucket++) {
    const pSubHead = m.u32((pGame + 0x10f8 + subBucket * 4) >>> 0) >>> 0
    if (pSubHead !== 0 && !isByteAddrLoaded113c(m, pSubHead)) {
      const bucketUnits: number[] = []
      for (let listIdx = 0; listIdx < 2; listIdx++) {
        const hashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[listIdx]!) >>> 0
        for (let hb = 0; hb < 128; hb++) {
          let pU = m.u32((hashBase + hb * 4) >>> 0) >>> 0
          while (pU !== 0) {
            if (m.u32((pU + 0xd0) >>> 0) === (subBucket >>> 0)) {
              bucketUnits.push(pU)
            }
            pU = m.get(pU, D2UnitStrc.pGameHashNext) >>> 0
          }
        }
      }
      m.fill(pSubHead, 0x10, 0)
      if (bucketUnits.length > 0) {
        m.setU32(pSubHead, bucketUnits[0]!)
        let pPrevSub = pSubHead
        for (let uIdx = 1; uIdx < bucketUnits.length; uIdx++) {
          const pSubNode = m.alloc(0x10) >>> 0
          m.fill(pSubNode, 0x10, 0)
          m.setU32(pSubNode, bucketUnits[uIdx]!)
          m.setU32((pPrevSub + 0x08) >>> 0, pSubNode)
          m.setU32((pSubNode + 0x0c) >>> 0, pPrevSub)
          pPrevSub = pSubNode
        }
      } else {
        m.setU32((pGame + 0x10f8 + subBucket * 4) >>> 0, 0)
      }
    }
  }

  // 1. Hydrate player .d2s quest records (+0x10..+0x18), waypoints (+0x1c..+0x24), NPC intro (+0x60..+0x68), and inventory grids
  const wooOff =
    saveBytes !== undefined && saveBytes.length >= 0x300
      ? findAsciiTag113c(saveBytes, 'Woo!', 0x100)
      : -1
  let hasActiveSaveQuestHistory = false
  if (wooOff >= 0 && saveBytes !== undefined && wooOff + 10 + 0x60 <= saveBytes.length) {
    for (let k = 0; k < 0x60; k++) {
      if (saveBytes[wooOff + 10 + k] !== 0) {
        hasActiveSaveQuestHistory = true
        break
      }
    }
  }
  let wsOff = -1
  if (saveBytes !== undefined && saveBytes.length >= 0x2c9) {
    const cand = wooOff >= 0 ? wooOff + 0x12a : findAsciiTag113c(saveBytes, 'WS', 0x200)
    if (
      cand >= 0 &&
      cand + 0x50 <= saveBytes.length &&
      saveBytes[cand] === 0x57 &&
      saveBytes[cand + 1] === 0x53 &&
      saveBytes[cand + 2] === 1 &&
      saveBytes[cand + 3] === 0 &&
      saveBytes[cand + 4] === 0 &&
      saveBytes[cand + 5] === 0 &&
      saveBytes[cand + 6] === 0x50 &&
      saveBytes[cand + 7] === 0
    ) {
      wsOff = cand
    }
  }
  const w4Off =
    saveBytes !== undefined && saveBytes.length >= 0x300
      ? findAsciiTag113c(saveBytes, 'w4', 0x200)
      : -1

  const nItemsCnt = m.u32(SGPT_ITEMS_TXT_COUNT_VA) | 0
  const pItemsTxtBase = m.u32(SGPT_ITEMS_TXT_PTR_VA) >>> 0

  if (!isByteAddrLoaded113c(m, D2COMMON_GRID0_INFO_VA_113C)) {
    m.fill(D2COMMON_GRID0_INFO_VA_113C, 24, 0)
    m.setU8(D2COMMON_GRID0_INFO_VA_113C, 13)
    m.setU8((D2COMMON_GRID0_INFO_VA_113C + 1) >>> 0, 1)
  }
  if (!isByteAddrLoaded113c(m, D2COMMON_GRID1_INFO_VA_113C)) {
    m.fill(D2COMMON_GRID1_INFO_VA_113C, 24, 0)
    m.setU8(D2COMMON_GRID1_INFO_VA_113C, 16)
    m.setU8((D2COMMON_GRID1_INFO_VA_113C + 1) >>> 0, 1)
  }

  const players: number[] = []
  const plrHashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_PLAYER]!) >>> 0
  for (let b = 0; b < 128; b++) {
    let pPlr = m.u32((plrHashBase + b * 4) >>> 0) >>> 0
    while (pPlr !== 0) {
      players.push(pPlr)
      const pPlrDataMerc = m.u32((pPlr + 0x14) >>> 0) >>> 0
      if (pPlrDataMerc !== 0 && isByteAddrLoaded113c(m, (pPlrDataMerc + 0x44) >>> 0)) {
        const pPetWrap = m.u32((pPlrDataMerc + 0x44) >>> 0) >>> 0
        const pSlotsArr =
          pPetWrap !== 0 && isByteAddrLoaded113c(m, pPetWrap) ? (m.u32(pPetWrap) >>> 0) : 0
        if (pSlotsArr !== 0 && isByteAddrLoaded113c(m, (pSlotsArr + 0x54) >>> 0)) {
          let pPetNode = m.u32((pSlotsArr + 0x54) >>> 0) >>> 0
          while (pPetNode !== 0 && isByteAddrLoaded113c(m, pPetNode)) {
            const dwMercGuid = m.u32((pPetNode + 0x04) >>> 0) >>> 0
            const pMercUnit = SUNIT_GetServerUnit113c(m, pGame, UNIT_MONSTER, dwMercGuid) >>> 0
            if (pMercUnit !== 0 && (pPetNode >>> 0) >= 0x7e180000 && (pPetNode >>> 0) < 0x7e200000) {
              const rawNameOff = m.u32((pPetNode + 0x08) >>> 0) & 0xffff
              const rawSeed = m.u32((pPetNode + 0x0c) >>> 0) >>> 0
              const bExp = m.u32((pGame + 0x70) >>> 0) | 0
              const mercClassId = m.u32((pMercUnit + 0x04) >>> 0) | 0
              const curMercType = m.u32((pPetNode + 0x10) >>> 0) >>> 0
              const mercLvl = STATLIST_GetUnitStat113c(m, pMercUnit, 12, 0) | 0
              let pHireRec = 0
              if (curMercType < 0x100) {
                const pCurRec =
                  DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(
                    m,
                    bExp,
                    curMercType,
                    mercLvl,
                  ) >>> 0
                if (
                  pCurRec !== 0 &&
                  (m.get(pCurRec, D2HirelingTxt.dwClass) | 0) === mercClassId
                ) {
                  pHireRec = pCurRec
                }
              }
              if (pHireRec === 0) {
                pHireRec =
                  DATATBLS_GetHirelingTxtRecordFromClassId113c(
                    m,
                    bExp,
                    mercClassId,
                    0,
                  ) >>> 0
              }
              let wNameId = rawNameOff
              if (pHireRec !== 0) {
                const wNameFirst = m.get(pHireRec, D2HirelingTxt.wNameFirst) & 0xffff
                const wNameLast = m.get(pHireRec, D2HirelingTxt.wNameLast) & 0xffff
                wNameId = (rawNameOff + wNameFirst) & 0xffff
                if (wNameId > wNameLast) {
                  wNameId = wNameFirst
                }
                m.setU32(
                  (pPetNode + 0x10) >>> 0,
                  m.get(pHireRec, D2HirelingTxt.dwSubTypeId) >>> 0,
                )
              }
              m.setU32((pPetNode + 0x08) >>> 0, rawSeed >>> 0)
              m.setU32((pPetNode + 0x0c) >>> 0, wNameId >>> 0)
            }
            if (
              pMercUnit !== 0 &&
              (m.u32((pMercUnit + 0x10) >>> 0) === 12 ||
                (m.u32((pMercUnit + 0xc4) >>> 0) & 0x10000) !== 0)
            ) {
              m.setU32(pPetNode, (m.u32(pPetNode) | 1) >>> 0)
            }
            pPetNode = m.u32((pPetNode + 0x14) >>> 0) >>> 0
          }
        }
      }
      const pInv = m.u32((pPlr + 0x60) >>> 0) >>> 0
      if (pInv !== 0 && isByteAddrLoaded113c(m, pInv)) {
        let pScanIt = INVENTORY_GetFirstItem113c(m, pInv)
        while (pScanIt !== 0) {
          const pItNode74 = m.u32((pScanIt + 0x74) >>> 0) >>> 0
          if (pItNode74 !== 0 && !isByteAddrLoaded113c(m, pItNode74)) {
            m.fill(pItNode74, 0x08, 0)
            m.setU32((pScanIt + 0x74) >>> 0, 0)
          }
          pScanIt = INVENTORY_GetNextItem113c(m, pScanIt)
        }
        const pFirstNode = m.u32((pInv + 0x2c) >>> 0) >>> 0
        if (pFirstNode !== 0 && !isByteAddrLoaded113c(m, pFirstNode)) {
          m.setU32((pInv + 0x2c) >>> 0, 0)
          m.setU32((pInv + 0x30) >>> 0, 0)
          let pIt = INVENTORY_GetFirstItem113c(m, pInv)
          let pTail = 0
          while (pIt !== 0) {
            const pNode = m.alloc(8) >>> 0
            m.setU32(pNode, m.u32((pIt + 0x0c) >>> 0))
            m.setU32((pNode + 4) >>> 0, 0)
            if (pTail === 0) {
              m.setU32((pInv + 0x2c) >>> 0, pNode)
            } else {
              m.setU32((pTail + 4) >>> 0, pNode)
            }
            pTail = pNode
            pIt = INVENTORY_GetNextItem113c(m, pIt)
          }
          m.setU32((pInv + 0x30) >>> 0, pTail)
        }
        const pGrids = m.u32((pInv + 0x14) >>> 0) >>> 0
        const nGrids = m.u32((pInv + 0x18) >>> 0) | 0
        if (pGrids !== 0 && isByteAddrLoaded113c(m, pGrids) && nGrids > 0 && nGrids <= 16) {
          for (let g = 0; g < nGrids; g++) {
            const gb = (pGrids + g * 16) >>> 0
            const gw = m.u8((gb + 8) >>> 0)
            const gh = m.u8((gb + 9) >>> 0)
            const ppItems = m.u32((gb + 0x0c) >>> 0) >>> 0
            if (ppItems !== 0 && !isByteAddrLoaded113c(m, ppItems) && gw > 0 && gh > 0) {
              m.fill(ppItems, gw * gh * 4, 0)
              let pIt = INVENTORY_GetFirstItem113c(m, pInv)
              while (pIt !== 0) {
                const itemMode = m.u32((pIt + 0x10) >>> 0) >>> 0
                const pItData = m.u32((pIt + 0x14) >>> 0) >>> 0
                const pItPath = m.u32((pIt + 0x2c) >>> 0) >>> 0
                if (pItData !== 0) {
                  const bodyLoc = m.u8((pItData + 0x44) >>> 0)
                  const invPage = m.u8((pItData + 0x45) >>> 0)
                  const nodePage = m.u8((pItData + 0x5c + 0x0c) >>> 0)
                  if (g === 0) {
                    if (itemMode === 1 && invPage === 0xff) {
                      const slot =
                        bodyLoc > 0
                          ? bodyLoc
                          : pItPath !== 0
                            ? m.u32((pItPath + 0x0c) >>> 0) | 0
                            : 0
                      if (slot > 0 && slot < gw) {
                        m.setU32((ppItems + slot * 4) >>> 0, pIt)
                      }
                    }
                  } else if (g === 1) {
                    if ((itemMode === 2 || (itemMode !== 1 && nodePage === 2)) && pItPath !== 0) {
                      const ix = m.u32((pItPath + 0x0c) >>> 0) | 0
                      if (ix >= 0 && ix < gw) {
                        m.setU32((ppItems + ix * 4) >>> 0, pIt)
                      }
                    }
                  } else if (
                    itemMode === 0 &&
                    pItPath !== 0 &&
                    (nodePage === g + 1 ||
                      (nodePage === 0 && invPage !== 0xff && invPage + 2 === g))
                  ) {
                    const ix = m.u32((pItPath + 0x0c) >>> 0) | 0
                    const iy = m.u32((pItPath + 0x10) >>> 0) | 0
                    let bw = 1
                    let bh = 1
                    if (pItemsTxtBase !== 0) {
                      const icid = m.u32((pIt + 4) >>> 0) | 0
                      if (icid >= 0 && icid < nItemsCnt) {
                        const pItRec = (pItemsTxtBase + Math.imul(icid, D2ItemsTxt_SIZE)) >>> 0
                        bw = m.get(pItRec, D2ItemsTxt.nInvWidth)
                        bh = m.get(pItRec, D2ItemsTxt.nInvHeight)
                      }
                    }
                    for (let dy = 0; dy < bh; dy++) {
                      for (let dx = 0; dx < bw; dx++) {
                        const cx = (ix + dx) | 0
                        const cy = (iy + dy) | 0
                        if (cx >= 0 && cx < gw && cy >= 0 && cy < gh) {
                          m.setU32((ppItems + (cy * gw + cx) * 4) >>> 0, pIt)
                        }
                      }
                    }
                  }
                }
                pIt = INVENTORY_GetNextItem113c(m, pIt)
              }
            }
          }
        }
      }

      const pPlrData = UNITS_GetPlayerData113c(m, pPlr) >>> 0
      if (pPlrData !== 0) {
        const pClient = m.u32((pPlrData + 0x9c) >>> 0) >>> 0
        if (pClient !== 0) {
          for (let off = 0x200; off < 0x518; off++) {
            const addr = (pClient + off) >>> 0
            if (!isByteAddrLoaded113c(m, addr)) {
              m.setU8(addr, 0)
            }
          }
          m.setU8((pClient + 0x3d4) >>> 0, (m.u8((pClient + 0x3d4) >>> 0) | 1) & 0xff)
        }
        for (let diff = 0; diff < 3; diff++) {
          const curQ = m.u32((pPlrData + diff * 4 + 0x10) >>> 0) >>> 0
          if (curQ === 0 || !isByteAddrLoaded113c(m, curQ)) {
            const pRec = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
            const pBuf = m.u32(pRec) >>> 0
            if (wooOff >= 0 && saveBytes !== undefined && wooOff + 10 + (diff + 1) * 0x60 <= saveBytes.length) {
              const srcOff = wooOff + 10 + diff * 0x60
              for (let k = 0; k < 0x60; k++) {
                m.setU8((pBuf + k) >>> 0, saveBytes[srcOff + k]!)
              }
              // 0x6FD7D180..0x6FD7D1BF (bConvert = 1 from 0x6FC73132): clear bits 13 & 14; if bit 1 set, set bit 15
              for (let q = 0; q < 42; q++) {
                QUESTRECORD_ClearQuestState113c(m, pRec, q, 13)
                QUESTRECORD_ClearQuestState113c(m, pRec, q, 14)
                if (DRLGWARP_TestRoomTileBit113c(m, pRec, q, 1) !== 0) {
                  QUESTRECORD_SetQuestState113c(m, pRec, q, 15)
                }
              }
            }
            m.setU32((pPlrData + diff * 4 + 0x10) >>> 0, pRec)
          }

          let curWp = m.u32((pPlrData + diff * 4 + 0x1c) >>> 0) >>> 0
          const needWpHydrate =
            curWp === 0 ||
            !isByteAddrLoaded113c(m, curWp) ||
            !isByteAddrLoaded113c(m, (curWp + 0x0f) >>> 0)
          if (curWp === 0) {
            curWp = m.alloc(0x10) >>> 0
            m.setU32((pPlrData + diff * 4 + 0x1c) >>> 0, curWp)
          }
          if (needWpHydrate) {
            if (wsOff >= 0 && saveBytes !== undefined && wsOff + 8 + (diff + 1) * 0x18 <= saveBytes.length) {
              const wpSrc = wsOff + 8 + diff * 0x18
              for (let k = 0; k < 0x10; k++) {
                m.setU8((curWp + k) >>> 0, saveBytes[wpSrc + k]!)
              }
              const wMagic = m.u16(curWp)
              if (wMagic !== 0x0102 && (wMagic === 0 || wMagic === 0x0101)) {
                m.fill(curWp, 0x10, 0)
                m.setU16(curWp, 0x0102)
                if (isByteAddrLoaded113c(m, GW_WAYPOINT_TABLE_BASE_VA_113C)) {
                  const wordIdx = m.u16(GW_WAYPOINT_TABLE_BASE_VA_113C)
                  const bitMask = m.u16((GW_WAYPOINT_TABLE_BASE_VA_113C + 2) >>> 0)
                  const wordAddr = (curWp + wordIdx * 2) >>> 0
                  m.setU16(wordAddr, (m.u16(wordAddr) | bitMask) & 0xffff)
                }
              }
            } else {
              m.fill(curWp, 0x10, 0)
            }
          }

        }
        if (hasActiveSaveQuestHistory && saveBytes !== undefined) {
          const isIntroSlotHydrated = (diffIdx: number): boolean => {
            const pPair = m.u32((pPlrData + diffIdx * 4 + 0x60) >>> 0) >>> 0
            if (pPair === 0 || !isByteAddrLoaded113c(m, pPair)) return false
            const pBit0 = m.u32(pPair) >>> 0
            const pBit1 = m.u32((pPair + 4) >>> 0) >>> 0
            if (pBit0 === 0 || !isByteAddrLoaded113c(m, pBit0)) return false
            if (pBit1 === 0 || !isByteAddrLoaded113c(m, pBit1)) return false
            const pBuf0 = m.u32(pBit0) >>> 0
            const pBuf1 = m.u32(pBit1) >>> 0
            return (
              pBuf0 !== 0 &&
              isByteAddrLoaded113c(m, pBuf0) &&
              pBuf1 !== 0 &&
              isByteAddrLoaded113c(m, pBuf1)
            )
          }
          if (!isIntroSlotHydrated(0) || !isIntroSlotHydrated(1) || !isIntroSlotHydrated(2)) {
            const has6c = isByteAddrLoaded113c(m, (pPlrData + 0x6c) >>> 0)
            const saved6c = has6c ? (m.u32((pPlrData + 0x6c) >>> 0) >>> 0) : 0
            PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c(sm, pPlr, pGame)
            if (has6c && saved6c !== 0) {
              m.setU32((pPlrData + 0x6c) >>> 0, saved6c)
            }
            if (w4Off >= 0 && w4Off + 4 + 48 <= saveBytes.length) {
              for (let diff = 0; diff < 3; diff++) {
                const pPair = m.u32((pPlrData + 0x60 + diff * 4) >>> 0) >>> 0
                const pBit0 = pPair !== 0 ? (m.u32(pPair) >>> 0) : 0
                const pBit1 = pPair !== 0 ? (m.u32((pPair + 4) >>> 0) >>> 0) : 0
                const pBuf0 = pBit0 !== 0 ? (m.u32(pBit0) >>> 0) : 0
                const pBuf1 = pBit1 !== 0 ? (m.u32(pBit1) >>> 0) : 0
                const introSrc = w4Off + 4 + diff * 8
                const congSrc = w4Off + 4 + 24 + diff * 8
                for (let k = 0; k < 8; k++) {
                  if (pBuf0 !== 0) m.setU8((pBuf0 + k) >>> 0, saveBytes[introSrc + k]!)
                  if (pBuf1 !== 0) m.setU8((pBuf1 + k) >>> 0, saveBytes[congSrc + k]!)
                }
              }
            }
          }
        } else {
          for (let diff = 0; diff < 3; diff++) {
            const curIntro = m.u32((pPlrData + diff * 4 + 0x60) >>> 0) >>> 0
            if (curIntro === 0 || !isByteAddrLoaded113c(m, curIntro)) {
              const pWrap = m.alloc(0x0c) >>> 0
              const pBit0 = m.alloc(0x14) >>> 0
              const pBuf0 = m.alloc(0x08) >>> 0
              const pBit1 = m.alloc(0x14) >>> 0
              const pBuf1 = m.alloc(0x08) >>> 0
              m.fill(pWrap, 0x0c, 0)
              m.fill(pBit0, 0x14, 0)
              m.fill(pBuf0, 0x08, 0)
              m.fill(pBit1, 0x14, 0)
              m.fill(pBuf1, 0x08, 0)
              m.setU32(pBit0, pBuf0)
              m.setU32((pBit0 + 4) >>> 0, 64)
              m.setU32(pBit1, pBuf1)
              m.setU32((pBit1 + 4) >>> 0, 64)
              m.setU32(pWrap, pBit0)
              m.setU32((pWrap + 4) >>> 0, pBit1)
              m.setU32((pPlrData + diff * 4 + 0x60) >>> 0, pWrap)
            }
          }
        }
      }
      const pSgptStart = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
      if (pSgptStart !== 0 && isByteAddrLoaded113c(m, pSgptStart)) {
        const plrCls = m.u32((pPlr + 0x04) >>> 0) | 0
        const nCharCount = m.u32((pSgptStart + 0xbc8) >>> 0) | 0
        const pCharBase = m.u32((pSgptStart + 0xbc4) >>> 0) >>> 0
        const nSkillsCount = m.u32((pSgptStart + 0xba0) >>> 0) | 0
        if (pCharBase !== 0 && plrCls >= 0 && plrCls < nCharCount) {
          const pCharStats = (pCharBase + imul32(plrCls, 0xc4)) >>> 0
          if (SKILLS_GetSkillById113c(m, pPlr, 0, -1) === 0) {
            SKILLS_AddSkillToUnit113c(m, pPlr, 0)
          }
          for (let si = 0; si < 10; si++) {
            const startSk = (m.u16((pCharStats + 0xae + si * 2) >>> 0) << 16) >> 16
            if (
              startSk >= 0 &&
              startSk < nSkillsCount &&
              SKILLS_GetSkillById113c(m, pPlr, startSk, -1) === 0
            ) {
              SKILLS_AddSkillToUnit113c(m, pPlr, startSk)
            }
          }
        }
      }
      pPlr = m.get(pPlr, D2UnitStrc.pGameHashNext) >>> 0
    }
  }

  // 2. Hydrate pGame->pQuestControl (+0x10F4) while preserving F2 pGame->pGameSeed (+0xD0/+0xD4)
  const curQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (curQuestCtrl === 0 || !isByteAddrLoaded113c(m, curQuestCtrl)) {
    const savedSeedLo = m.u32((pGame + 0xd0) >>> 0) >>> 0
    const savedSeedHi = m.u32((pGame + 0xd4) >>> 0) >>> 0
    if (m.u32((pGame + 0x84) >>> 0) === 1) {
      const f1Seed: D2SeedStrc = { lo: m.u32((pGame + 0x7c) >>> 0) >>> 0, hi: 0x29a }
      seedNext(f1Seed)
      const step1Lo = f1Seed.lo >>> 0
      seedNext(f1Seed)
      const step2Lo = f1Seed.lo >>> 0
      seedNext(f1Seed)
      if (
        step1Lo === (m.u32((pGame + 0xec) >>> 0) >>> 0) &&
        step2Lo === (m.u32((pGame + 0x80) >>> 0) >>> 0)
      ) {
        m.setU32((pGame + 0xd0) >>> 0, f1Seed.lo >>> 0)
        m.setU32((pGame + 0xd4) >>> 0, f1Seed.hi >>> 0)
      }
    }
    QUESTS_AllocAndInitGameQuests_6FC548A0_113c(sm, pGame, {
      isBadCodePtr: () => 0,
      onQuestInit: (mem, pfnInit, pQuest) => {
        dispatchQuestInitByVa113c(mem as SparseMemory113c, pfnInit, pQuest)
      },
    })
    m.setU32((pGame + 0xd0) >>> 0, savedSeedLo)
    m.setU32((pGame + 0xd4) >>> 0, savedSeedHi)
    const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (pQuestCtrl !== 0) {
      m.setU32((pQuestCtrl + 0x08) >>> 0, 1)
      const nGameDiff = m.u8((pGame + 0x6d) >>> 0)
      const pGlobalFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
      if (players.length > 0) {
        const pFirstPlrData = UNITS_GetPlayerData113c(m, players[0]!) >>> 0
        const pFirstQuestFlags =
          pFirstPlrData !== 0
            ? (m.u32((pFirstPlrData + nGameDiff * 4 + 0x10) >>> 0) >>> 0)
            : 0
        // 0x6FC550F0..0x6FC55163: mark previously completed quests inactive in game (0x6FC54440)
        if (pFirstQuestFlags !== 0) {
          const nQuestDescs = m.u32(0x6fd2df68) | 0
          for (let qi = 0; qi < nQuestDescs; qi++) {
            const desc = (0x6fd2dbf0 + qi * 0x18) >>> 0
            if (m.u8((desc + 0x04) >>> 0) >= 5) continue
            if (m.u8((desc + 0x0c) >>> 0) !== 0) continue
            const nQuestId = m.u32((desc + 0x10) >>> 0) | 0
            const nQuestStateId = m.u32((desc + 0x14) >>> 0) | 0
            if (
              DRLGWARP_TestRoomTileBit113c(m, pFirstQuestFlags, nQuestStateId, 0) !== 0 ||
              DRLGWARP_TestRoomTileBit113c(m, pFirstQuestFlags, nQuestStateId, 15) !== 0
            ) {
              const pDoneQ = QUESTS_GetQuestData_6FC53F30_113c(sm, pGame, nQuestId) >>> 0
              if (pDoneQ !== 0) {
                m.setU8((pDoneQ + 0x09) >>> 0, 0)
                m.setU8((pDoneQ + 0x0a) >>> 0, 0)
                m.setU8((pDoneQ + 0x0b) >>> 0, 0)
              }
              if (pGlobalFlags !== 0) {
                QUESTRECORD_SetQuestState113c(m, pGlobalFlags, nQuestStateId, 15)
              }
            }
          }
        }
      }
      // 0x6FC55165..0x6FC551AD: sync player-entered quest states (cbIdx = 0x0D)
      for (let pi = 0; pi < players.length; pi++) {
        const pPlr = players[pi]!
        const pPlrInv0D = m.u32((pPlr + 0x60) >>> 0) >>> 0
        const unlinkedSwapPrevLinks: Array<{ addr: number; val: number }> = []
        if (pPlrInv0D !== 0 && isByteAddrLoaded113c(m, pPlrInv0D)) {
          let pCurIt = m.u32((pPlrInv0D + 0x0c) >>> 0) >>> 0
          let pPrevNextAddr = (pPlrInv0D + 0x0c) >>> 0
          while (pCurIt !== 0) {
            const pItData = m.u32((pCurIt + 0x14) >>> 0) >>> 0
            const pNextAddr = (pItData + 0x5c + 0x08) >>> 0
            const pNextIt = pItData !== 0 ? (m.u32(pNextAddr) >>> 0) : 0
            const nodePosOther = pItData !== 0 ? m.u8((pItData + 0x5c + 0x0d) >>> 0) : 0
            if (nodePosOther === 4) {
              unlinkedSwapPrevLinks.push({ addr: pPrevNextAddr, val: m.u32(pPrevNextAddr) >>> 0 })
              m.setU32(pPrevNextAddr, pNextIt)
            } else {
              pPrevNextAddr = pNextAddr
            }
            pCurIt = pNextIt
          }
        }
        try {
          const pArg = K4_QUEST_ARG_SCRATCH_VA
          m.fill(pArg, 0x1c, 0)
          m.setU32(pArg, pGame >>> 0)
          m.setU32((pArg + 0x04) >>> 0, 0x0d)
          m.setU32((pArg + 0x0c) >>> 0, pPlr >>> 0)
          let pQ = m.u32(pQuestCtrl) >>> 0
          while (pQ !== 0) {
            const pfn0D = m.u32((pQ + 0xd4) >>> 0) >>> 0
            if (
              pfn0D !== 0 &&
              (hasActiveSaveQuestHistory ||
                pfn0D === 0x6fc820e0 ||
                pfn0D === 0x6fc81e30 ||
                pfn0D === 0x6fc808b0 ||
                pfn0D === 0x6fce44e0 ||
                pfn0D === 0x6fd03b40 ||
                pfn0D === 0x6fcd9320 ||
                pfn0D === 0x6fc77e80)
            ) {
              dispatchK4QuestCallback113c(m, pfn0D, pQ, pArg)
            }
            pQ = m.u32((pQ + 0xf4) >>> 0) >>> 0
          }
        } finally {
          for (let ui = unlinkedSwapPrevLinks.length - 1; ui >= 0; ui--) {
            const rec = unlinkedSwapPrevLinks[ui]!
            m.setU32(rec.addr, rec.val)
          }
        }
      }
      // 0x6FC551AF..0x6FC55323: invoke Act 1..5 root quest sequence filters (+0xF0)
      const actRootQuestIds = [1, 8, 18, 22, 31] as const
      for (let ri = 0; ri < actRootQuestIds.length; ri++) {
        const pRootQ = QUESTS_GetQuestData_6FC53F30_113c(sm, pGame, actRootQuestIds[ri]!) >>> 0
        if (pRootQ !== 0) {
          dispatchQuestSeqFilterF0_113c(sm, pRootQ)
        }
      }
      for (const pQItem of questItemsToReattach) {
        const clsId = m.u32((pQItem + 0x04) >>> 0) | 0
        const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, clsId) >>> 0
        const bQuest = pItemsTxt !== 0 ? m.u8((pItemsTxt + 0x12a) >>> 0) : 0
        if (bQuest > 0 && bQuest <= 0x25) {
          QUESTS_AttachUnitToQuest_6FC55890_113c(sm, pQItem, (bQuest - 1) | 0, pGame >>> 0)
        }
      }
    }
  }
  const activeQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (activeQuestCtrl !== 0 && isByteAddrLoaded113c(m, activeQuestCtrl)) {
    let pQ = m.u32(activeQuestCtrl) >>> 0
    while (pQ !== 0 && isByteAddrLoaded113c(m, pQ)) {
      if ((m.u32((pQ + 0xac) >>> 0) >>> 0) === 0x6fcda1e0) {
        m.setU32((pQ + 0xac) >>> 0, 0x6fcda1e1)
      }
      pQ = m.u32((pQ + 0xf4) >>> 0) >>> 0
    }
  }

  // 3. Collect DRLG town preset MapAI chains across active acts and mark already-active F2 rooms' presets spawned
  interface TownMapAiCandidate {
    readonly uType: number
    readonly txtId: number
    readonly wx: number
    readonly wy: number
    readonly pMapAi: number
  }
  const mapAiByAct: TownMapAiCandidate[][] = [[], [], [], [], []]
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    const pAct = m.u32((pGame + 0xbc + actIdx * 4) >>> 0) >>> 0
    if (pAct === 0 || !isByteAddrLoaded113c(m, pAct)) continue
    const pDrlg = m.u32((pAct + 0x48) >>> 0) >>> 0
    if (pDrlg === 0 || !isByteAddrLoaded113c(m, pDrlg)) continue
    const townLvlId = ACT_TOWN_LEVEL_IDS_113C[actIdx]!
    for (
      let pLvl = m.u32((pDrlg + 0x47c) >>> 0) >>> 0;
      pLvl !== 0 && isByteAddrLoaded113c(m, pLvl);
      pLvl = m.u32((pLvl + 0x1ac) >>> 0) >>> 0
    ) {
      if (
        m.u32((pLvl + 0x10) >>> 0) !== 0 &&
        m.u32((pLvl + 0x22c) >>> 0) === 0
      ) {
        let nRoomsLvl = m.u32((pLvl + 0x08) >>> 0) >>> 0
        if (nRoomsLvl === 0) {
          for (
            let rxCnt = m.u32((pLvl + 0x10) >>> 0) >>> 0;
            rxCnt !== 0 && isByteAddrLoaded113c(m, rxCnt);
            rxCnt = m.u32((rxCnt + 0x24) >>> 0) >>> 0
          ) {
            nRoomsLvl = (nRoomsLvl + 1) >>> 0
          }
        }
        if (nRoomsLvl > 0) {
          const warpAllocBytes = (nRoomsLvl * 16 + 4) >>> 0
          const pWarpArr = m.alloc(warpAllocBytes) >>> 0
          m.fill(pWarpArr, warpAllocBytes, 0)
          m.setU32((pWarpArr + nRoomsLvl * 16) >>> 0, 0x57525034)
          m.setU32((pLvl + 0x22c) >>> 0, pWarpArr)
        }
      }
      if ((m.u32((pLvl + 0x1d0) >>> 0) | 0) !== townLvlId) continue
      for (
        let rx = m.u32((pLvl + 0x10) >>> 0) >>> 0;
        rx !== 0 && isByteAddrLoaded113c(m, rx);
        rx = m.u32((rx + 0x24) >>> 0) >>> 0
      ) {
        const subX = (m.u32((rx + 0x34) >>> 0) | 0) * 5
        const subY = (m.u32((rx + 0x38) >>> 0) | 0) * 5
        const isRoomAlreadyActiveAtF2 = m.u32((rx + 0x30) >>> 0) !== 0
        for (
          let pr = m.u32((rx + 0x5c) >>> 0) >>> 0;
          pr !== 0 && isByteAddrLoaded113c(m, pr);
          pr = m.u32((pr + 0x0c) >>> 0) >>> 0
        ) {
          const pMapAi = m.u32((pr + 0x10) >>> 0) >>> 0
          if (pMapAi !== 0 && isByteAddrLoaded113c(m, pMapAi)) {
            mapAiByAct[actIdx]!.push({
              uType: m.u32((pr + 0x14) >>> 0) >>> 0,
              txtId: m.u32((pr + 0x04) >>> 0) >>> 0,
              wx: subX + (m.u32((pr + 0x08) >>> 0) | 0),
              wy: subY + (m.u32((pr + 0x18) >>> 0) | 0),
              pMapAi,
            })
          }
          if (isRoomAlreadyActiveAtF2) {
            m.setU32((pr + 0x1c) >>> 0, (m.u32((pr + 0x1c) >>> 0) | 1) >>> 0)
          }
        }
      }
    }
  }

  // 4. Hydrate F2 town monsters' unmapped pNpcInteract (+0x30) and pMapAi (+0x38)
  const monHashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_MONSTER]!) >>> 0
  for (let b = 0; b < 128; b++) {
    let pMon = m.u32((monHashBase + b * 4) >>> 0) >>> 0
    while (pMon !== 0) {
      const pMonData = m.get(pMon, D2UnitStrc.pUnitData) >>> 0
      if (pMonData !== 0 && isByteAddrLoaded113c(m, pMonData)) {
        const pInteract = m.u32((pMonData + 0x30) >>> 0) >>> 0
        if (pInteract !== 0 && !isByteAddrLoaded113c(m, pInteract)) {
          m.fill(pInteract, 0x10, 0)
        }
        const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral) >>> 0
        if (pAiGen !== 0 && isByteAddrLoaded113c(m, pAiGen)) {
          const origMapAi = m.u32((pAiGen + 0x38) >>> 0) >>> 0
          if (origMapAi !== 0 && !isByteAddrLoaded113c(m, origMapAi)) {
            const pRoom = UNITS_GetRoom113c(m, pMon) >>> 0
            const pRoomEx = pRoom !== 0 ? (m.u32((pRoom + 0x10) >>> 0) >>> 0) : 0
            const pLvl = pRoomEx !== 0 ? (m.u32((pRoomEx + 0x58) >>> 0) >>> 0) : 0
            const lvlId = pLvl !== 0 ? (m.u32((pLvl + 0x1d0) >>> 0) | 0) : 0
            let actIdx = -1
            for (let a = 0; a < 5; a++) {
              if (ACT_TOWN_LEVEL_IDS_113C[a] === lvlId) {
                actIdx = a
                break
              }
            }
            const pPath = m.get(pMon, D2UnitStrc.pPath) >>> 0
            const mx = pPath !== 0 ? (m.get(pPath, D2DynamicPathStrc.wPosX) | 0) : 0
            const my = pPath !== 0 ? (m.get(pPath, D2DynamicPathStrc.wPosY) | 0) : 0
            const cid = m.get(pMon, D2UnitStrc.dwClassId) >>> 0
            let chosenMapAi = 0
            if (actIdx >= 0) {
              const cands = mapAiByAct[actIdx]!
              let bestDist = 0x7fffffff
              for (let ci = 0; ci < cands.length; ci++) {
                const c = cands[ci]!
                if (c.uType !== 1 || c.txtId !== cid) continue
                const d = Math.abs(mx - c.wx) + Math.abs(my - c.wy)
                if (d < bestDist) {
                  bestDist = d
                  chosenMapAi = c.pMapAi
                }
              }
              if (chosenMapAi === 0 || bestDist > 32) {
                chosenMapAi = 0
                bestDist = 0x7fffffff
                for (let ci = 0; ci < cands.length; ci++) {
                  const c = cands[ci]!
                  if (c.uType !== 2) continue
                  const d = Math.abs(mx - c.wx) + Math.abs(my - c.wy)
                  if (d <= 8 && d < bestDist) {
                    bestDist = d
                    chosenMapAi = c.pMapAi
                  }
                }
              }
            }
            m.setU32((pAiGen + 0x38) >>> 0, chosenMapAi >>> 0)
          }
        }
        const monClsHydrate = m.get(pMon, D2UnitStrc.dwClassId) >>> 0
        const monGuidHydrate = m.u32((pMon + 0x0c) >>> 0) >>> 0
        if (monClsHydrate === 201) {
          const pQCtrl2 = m.u32((pGame + 0x10f4) >>> 0) >>> 0
          let pQ2 = pQCtrl2 !== 0 ? (m.u32(pQCtrl2) >>> 0) : 0
          while (pQ2 !== 0 && (m.u32((pQ2 + 0xac) >>> 0) >>> 0) !== 0x6fce9190) {
            pQ2 = m.u32((pQ2 + 0xf4) >>> 0) >>> 0
          }
          if (pQ2 !== 0) {
            const pQExt2 = m.u32((pQ2 + 0x18) >>> 0) >>> 0
            if (
              pQExt2 !== 0 &&
              m.u8((pQExt2 + 0x0d) >>> 0) === 0 &&
              m.u8((pQExt2 + 0x0c) >>> 0) === 0
            ) {
              m.setU8((pQExt2 + 0x0c) >>> 0, 1)
              m.setU32((pQExt2 + 0x3c) >>> 0, monGuidHydrate)
            }
          }
        } else if (monClsHydrate === 511) {
          const pQCtrl5 = m.u32((pGame + 0x10f4) >>> 0) >>> 0
          let pQ5 = pQCtrl5 !== 0 ? (m.u32(pQCtrl5) >>> 0) : 0
          while (pQ5 !== 0 && (m.u32(pQ5) >>> 0) !== 0x1f) {
            pQ5 = m.u32((pQ5 + 0xf4) >>> 0) >>> 0
          }
          if (pQ5 !== 0) {
            const pQExt5 = m.u32((pQ5 + 0x18) >>> 0) >>> 0
            if (pQExt5 !== 0) {
              m.setU8((pQExt5 + 0x15) >>> 0, 1)
              m.setU32((pQExt5 + 0x10) >>> 0, monGuidHydrate)
            }
          }
        } else if (monClsHydrate === 512 || monClsHydrate === 514) {
          const pQCtrl5 = m.u32((pGame + 0x10f4) >>> 0) >>> 0
          let pQ5 = pQCtrl5 !== 0 ? (m.u32(pQCtrl5) >>> 0) : 0
          while (pQ5 !== 0 && (m.u32(pQ5) >>> 0) !== 0x21) {
            pQ5 = m.u32((pQ5 + 0xf4) >>> 0) >>> 0
          }
          if (pQ5 !== 0) {
            const pQExt5 = m.u32((pQ5 + 0x18) >>> 0) >>> 0
            if (pQExt5 !== 0) {
              if (monClsHydrate === 512) {
                m.setU8((pQExt5 + 0x91) >>> 0, 1)
                m.setU32((pQExt5 + 0x94) >>> 0, monGuidHydrate)
              } else {
                m.setU8((pQExt5 + 0x93) >>> 0, 1)
                m.setU32((pQExt5 + 0x9c) >>> 0, monGuidHydrate)
              }
            }
          }
        }
      }
      pMon = m.get(pMon, D2UnitStrc.pGameHashNext) >>> 0
    }
  }
}

export function tryRunTownNpcThinkK4_113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pfnThink: number,
): boolean {
  const va = pfnThink >>> 0
  if (
    va !== 0x6fc3db40 &&
    va !== 0x6fc3bc60 &&
    va !== 0x6fcbcb00 &&
    va !== 0x6fc39880 &&
    va !== 0x6fcca4d0
  ) {
    return false
  }
  const pMonData = m.get(pMonster, D2UnitStrc.pUnitData) >>> 0
  const pAiGen = pMonData !== 0 ? (m.get(pMonData, D2MonsterDataStrc.pAiGeneral) >>> 0) : 0
  const pMonStatsTxt = pMonData !== 0 ? (m.get(pMonData, D2MonsterDataStrc.pMonStatsTxt) >>> 0) : 0
  let pMonStats2Txt = 0
  if (pMonStatsTxt !== 0 && isByteAddrLoaded113c(m, (pMonStatsTxt + 0x08) >>> 0)) {
    const monStatsExIdx = (m.u16((pMonStatsTxt + 0x08) >>> 0) << 16) >> 16
    const pTables = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) >>> 0
    const pMs2Base = pTables !== 0 ? (m.u32((pTables + 0xa84) >>> 0) >>> 0) : 0
    const nMs2Count = pTables !== 0 ? (m.u32((pTables + 0xa8c) >>> 0) | 0) : 0
    if (pMs2Base !== 0 && monStatsExIdx >= 0 && monStatsExIdx < nMs2Count) {
      pMonStats2Txt = (pMs2Base + Math.imul(monStatsExIdx, 0x134)) >>> 0
    }
  }

  // 0x6FCBD3B0 (`AI_RunMonsterAI`): clears pending arg14==0 AI_THINK event and populates D2AiTickParamStrc
  EVENT_DeleteEventByArg14_113c(m, pGame, pMonster, MON_EVENT_AI_THINK, 0)
  const pAiTickParam = K4_AI_TICK_PARAM_SCRATCH_VA
  m.fill(pAiTickParam, 0x28, 0)
  m.setU32(pAiTickParam, pAiGen)
  m.setU32((pAiTickParam + 0x1c) >>> 0, pMonStatsTxt)
  m.setU32((pAiTickParam + 0x20) >>> 0, pMonStats2Txt)

  const sm = m as SparseMemory113c
  if (va === 0x6fc3db40) {
    AI_TownNpcMem113c(m, pGame, pMonster, pAiTickParam)
    return true
  }
  if (va === 0x6fc3bc60) {
    AI_SimpleMapAiNpc113c(m, pGame, pMonster, pAiTickParam)
    return true
  }
  if (va === 0x6fcbcb00) {
    AI_RogueTownMem113c(m, pGame, pMonster, pAiTickParam)
    return true
  }
  if (va === 0x6fc39880) {
    AI_ThinkTyraelOrIzualGhost_6FC39880_113c(sm, pGame, pMonster, pAiTickParam)
    return true
  }
  if (va === 0x6fcca4d0) {
    D2Game_6FCCA4D0_113c(sm, pGame, pMonster, pAiTickParam)
    return true
  }
  return false
}

function scaleBookCost1024_113c(cost: number, mult: number): number {
  if (cost > 0xffff && mult !== 0) {
    return imul32(sdiv32(cost, 1024), mult) | 0
  }
  return sdiv32(imul32(mult, cost), 1024) | 0
}

function computeBookE0TxCostDelta113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pNpc: number,
  pItem: number,
  txType: number,
): { readonly fullCost: number; readonly delta: number } {
  if (
    pPlayer === 0 ||
    pNpc === 0 ||
    pItem === 0 ||
    ITEMS_CheckItemTypeIdMem113c(m, pItem, 0x12) === 0
  ) {
    return { fullCost: 0, delta: 0 }
  }
  const pItemData = m.u32((pItem + 0x14) >>> 0) >>> 0
  if (pItemData !== 0 && (m.u32((pItemData + 0x18) >>> 0) & 0x20000) !== 0) {
    return { fullCost: 1, delta: 0 }
  }
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, m.u32((pItem + 0x04) >>> 0) | 0) >>> 0
  const pQual = DATATBLS_GetQualityItemsTxtRecord113c(
    m,
    ITEMS_GetMagicSuffix113c(m, pItem, 0) & 0xffff,
  ) >>> 0
  if (pItemsTxt === 0 || pQual === 0) {
    return { fullCost: 0, delta: 0 }
  }
  const addE0 = m.u32((pItemsTxt + 0xe0) >>> 0) | 0
  if (addE0 === 0) {
    return { fullCost: 0, delta: 0 }
  }
  let nStack = STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) | 0
  if (nStack <= 0) nStack = 1
  let nDiscount = STATLIST_GetUnitStat113c(m, pPlayer, 0x57, 0) | 0
  if (nDiscount >= 0x63) nDiscount = 0x63
  const nNpcCode = m.u32((pNpc + 0x04) >>> 0) >>> 0
  const pNpcRec = DATATBLS_FindCodeRecord4C113c(m, nNpcCode) >>> 0
  if (pNpcRec === 0) {
    return { fullCost: 0, delta: 0 }
  }
  const diff = m.u8((pGame + 0x6d) >>> 0) | 0
  const pQuestRecord = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(
    m as SparseMemory113c,
    pPlayer,
    pGame,
  ) >>> 0

  const evalBookCost = (baseC: number): number => {
    let buyCost = scaleBookCost1024_113c(baseC, m.u32((pNpcRec + 0x04) >>> 0) | 0)
    let sellCost = scaleBookCost1024_113c(baseC, m.u32((pNpcRec + 0x08) >>> 0) | 0)
    for (let i = 0; i < 3; i++) {
      const qId = m.u32((pNpcRec + 0x10 + i * 4) >>> 0) | 0
      if (
        qId !== 0 &&
        (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, qId, 0) === 1 ||
          DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, qId, 1) === 1)
      ) {
        buyCost = scaleBookCost1024_113c(buyCost, m.u32((pNpcRec + 0x1c + i * 4) >>> 0) | 0)
        sellCost = scaleBookCost1024_113c(sellCost, m.u32((pNpcRec + 0x28 + i * 4) >>> 0) | 0)
      }
    }
    const maxSellCap = m.u32((pNpcRec + 0x40 + diff * 4) >>> 0) | 0
    if (sellCost > maxSellCap) sellCost = maxSellCap
    if (txType === 1) {
      return sellCost < 1 ? 1 : sellCost
    }
    if (nDiscount !== 0) {
      buyCost = (buyCost - mulDiv113c(nDiscount, buyCost, 100)) | 0
    }
    return buyCost < 1 ? 1 : buyCost
  }

  const wrongBase = imul32(m.u32((pQual + 0x14) >>> 0) | 0, nStack)
  const fullBase = (wrongBase + addE0) | 0
  const wrongCost = evalBookCost(wrongBase)
  const fullCost = evalBookCost(fullBase)
  return { fullCost, delta: (fullCost - wrongCost) | 0 }
}

export function tryApplyQuestAndNpcC2SPacketK4_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  packetBytes: Uint8Array,
  syncWorld: () => void,
): number | null {
  if (packetBytes.length === 0) return null
  const op = packetBytes[0]! & 0xff
  if (op < 0x12 || op === 0x3c || op === 0x5f || op >= 0x67) {
    return null
  }
  const entry = C2S_PACKET_TABLE_6FD1A078_113C[op]
  if (entry === undefined || entry.handlerVa === 0) {
    return null
  }
  const pPkt = K4_PACKET_SCRATCH_VA
  m.fill(pPkt, Math.max(64, packetBytes.length + 16), 0)
  for (let i = 0; i < packetBytes.length; i++) {
    m.setU8((pPkt + i) >>> 0, packetBytes[i]!)
  }
  const sm = m as SparseMemory113c
  const nLen = packetBytes.length
  let rc = 0
  if (op === 0x30) {
    let pCancelNpc = 0
    let npcInteractRec = 0
    let hadTradeState = false
    if (nLen === 9 && (m.u32((pPkt + 1) >>> 0) >>> 0) === 1) {
      const dwNpcGuid = m.u32((pPkt + 5) >>> 0) >>> 0
      pCancelNpc = SUNIT_GetServerUnit113c(m, pGame, 1, dwNpcGuid) >>> 0
      if (pCancelNpc !== 0) {
        const pMonData = m.u32((pCancelNpc + 0x14) >>> 0) >>> 0
        npcInteractRec = pMonData !== 0 ? (m.u32((pMonData + 0x30) >>> 0) >>> 0) : 0
        let pNode = npcInteractRec !== 0 ? (m.u32(npcInteractRec) >>> 0) : 0
        while (pNode !== 0) {
          if ((m.u32(pNode) >>> 0) === (pPlayer >>> 0)) {
            hadTradeState = (m.u32((pNode + 4) >>> 0) | 0) >= 1
            break
          }
          pNode = m.u32((pNode + 8) >>> 0) >>> 0
        }
      }
    }
    rc = dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, nLen)
    if (hadTradeState && pCancelNpc !== 0 && npcInteractRec !== 0 && m.u32(npcInteractRec) === 0) {
      NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c(sm, pCancelNpc, pPlayer, pGame)
    }
  } else if (op === 0x32) {
    let bookDeltaDeducted = 0
    const origGoldInv = pPlayer !== 0 ? (STATLIST_GetUnitStat113c(m, pPlayer, 0x0e, 0) | 0) : 0
    const origGoldStash = pPlayer !== 0 ? (STATLIST_GetUnitStat113c(m, pPlayer, 0x0f, 0) | 0) : 0
    const pPlrData = pPlayer !== 0 ? (UNITS_GetPlayerData113c(m, pPlayer) >>> 0) : 0
    const prevBoughtGuid = pPlrData !== 0 ? (m.u32((pPlrData + 0x6c) >>> 0) >>> 0) : 0
    if (nLen === 0x11) {
      const dwNpcGuid = m.u32((pPkt + 0x01) >>> 0) >>> 0
      const dwSrcGuid = m.u32((pPkt + 0x05) >>> 0) >>> 0
      const wBuyMode = m.u16((pPkt + 0x09) >>> 0) & 0xffff
      if (wBuyMode !== 2) {
        const pNpc = SUNIT_GetServerUnit113c(m, pGame, 1, dwNpcGuid) >>> 0
        const pSrcItem = SUNIT_GetServerUnit113c(m, pGame, 4, dwSrcGuid) >>> 0
        const { fullCost, delta } = computeBookE0TxCostDelta113c(
          m,
          pGame,
          pPlayer,
          pNpc,
          pSrcItem,
          0,
        )
        if (delta > 0 && ((origGoldInv + origGoldStash) | 0) >= fullCost) {
          if (NPC_DeductPlayerGoldAndStash_6FCDCC60_113c(sm, pPlayer, delta) !== 0) {
            bookDeltaDeducted = delta
          }
        }
      }
    }
    rc = dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, nLen)
    if (bookDeltaDeducted > 0) {
      const newBoughtGuid = pPlrData !== 0 ? (m.u32((pPlrData + 0x6c) >>> 0) >>> 0) : 0
      if (newBoughtGuid === prevBoughtGuid) {
        STATLIST_SetUnitStat113c(m, pPlayer, 0x0e, origGoldInv, 0)
        STATLIST_SetUnitStat113c(m, pPlayer, 0x0f, origGoldStash, 0)
      }
    }
  } else if (op === 0x38) {
    let pPlrInv38 = 0
    let savedFirstNode38 = 0
    let savedLastNode38 = 0
    let nMenuOpt38 = 0
    let dwNpcGuid38 = 0
    if (nLen === 0x0d && pPlayer !== 0) {
      nMenuOpt38 = m.u32((pPkt + 1) >>> 0) | 0
      dwNpcGuid38 = m.u32((pPkt + 5) >>> 0) >>> 0
      if (nMenuOpt38 === 1 || nMenuOpt38 === 2) {
        pPlrInv38 = m.u32((pPlayer + 0x60) >>> 0) >>> 0
        if (pPlrInv38 !== 0) {
          savedFirstNode38 = m.u32((pPlrInv38 + 0x2c) >>> 0) >>> 0
          savedLastNode38 = m.u32((pPlrInv38 + 0x30) >>> 0) >>> 0
        }
      }
    }
    rc = withTmpArenaIfMissingK4_113c(m, pGame, () =>
      dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, nLen),
    )
    if (pPlrInv38 !== 0 && (nMenuOpt38 === 1 || nMenuOpt38 === 2)) {
      if (m.u32((pPlrInv38 + 0x30) >>> 0) >>> 0 !== savedLastNode38) {
        m.setU32((pPlrInv38 + 0x2c) >>> 0, savedFirstNode38)
        m.setU32((pPlrInv38 + 0x30) >>> 0, savedLastNode38)
        if (savedLastNode38 !== 0) {
          m.setU32((savedLastNode38 + 4) >>> 0, 0)
        }
      }
      const pNpc38 = SUNIT_GetServerUnit113c(m, pGame, 1, dwNpcGuid38) >>> 0
      if (pNpc38 !== 0) {
        if (nMenuOpt38 === 1) {
          NPC_TransferInventoryItemsToOwner_6FCDCD90_113c(
            sm,
            m.u32((pNpc38 + 0x60) >>> 0) >>> 0,
            pNpc38,
          )
        } else {
          const pGambleInv38 = SUNITPROXY_GetPlayerNodeItemInNpcSlot_6FCAFAA0_113c(
            sm,
            pNpc38,
            pGame,
            pPlayer,
          ) >>> 0
          if (pGambleInv38 !== 0) {
            NPC_TransferInventoryItemsToOwner_6FCDCD90_113c(sm, pGambleInv38, pNpc38)
          }
        }
      }
    }
  } else if (op === 0x49) {
    rc = withTmpArenaIfMissingK4_113c(m, pGame, () =>
      dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, nLen),
    )
  } else {
    rc = dispatchC2SHandlerByVa113c(entry.handlerVa, m, pGame, pPlayer, pPkt, nLen)
  }
  syncWorld()
  return rc | 0
}

const K4_TMP_ARENA_SCRATCH_VA_113C = 0x7e1ff000

function withTmpArenaIfMissingK4_113c<T>(m: Memory113c, pGame: number, fn: () => T): T {
  const needTmpArena = pGame !== 0 && m.u32((pGame + 0x1d28) >>> 0) === 0
  if (needTmpArena) {
    m.fill(K4_TMP_ARENA_SCRATCH_VA_113C, 0x10, 0)
    m.setU32((pGame + 0x1d28) >>> 0, K4_TMP_ARENA_SCRATCH_VA_113C)
  }
  try {
    return fn()
  } finally {
    if (needTmpArena) {
      m.setU32((pGame + 0x1d28) >>> 0, 0)
    }
  }
}

export function executeQueuedPlayerEntityInteractK4_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  interactAction: number,
  targetType: number,
  targetId: number,
): void {
  withTmpArenaIfMissingK4_113c(m, pGame, () => {
    C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c(
      m as SparseMemory113c,
      targetType >>> 0,
      pGame >>> 0,
      (interactAction | 0) === -2 ? 1 : 0,
      pPlayer >>> 0,
      targetId >>> 0,
    )
  })
  if (pPlayer !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pPd = m.u32((pPlayer + 0x14) >>> 0) >>> 0
    if (pPd !== 0) {
      m.setU32((pPd + 0x150) >>> 0, 0)
    }
  }
  PLAYER_FinishModeAndResetToNeutral113c(m, pGame >>> 0, pPlayer >>> 0, 0, 0)
}

export function dispatchK4QuestStatusFilter113c(
  m: Memory113c,
  pfnStatus: number,
  pQuest: number,
  pPlayerUnit: number,
  pGameQuestFlags: number,
  pPlayerQuestFlags: number,
  pOutByte: number,
): number {
  const sm = m as SparseMemory113c
  const va = pfnStatus >>> 0
  if (va === 0x6fc80800) {
    return ACT1_IntroStatusFilter_6FC80800_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fc80170) {
    return ACT4_IntroStatusFilter_6FC80170_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fc80810) {
    return ACT4_EndgameStatusFilter_6FC80810_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fc85500) {
    return ACT1Q5_StatusFilter_6FC85500_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fce25c0) {
    return ACT2Q0_StatusFilter_6FCE25C0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fce3bd0) {
    return ACT2Q2_StatusFilter_6FCE3BD0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fce1970) {
    return ACT2Q4_StatusFilter_6FCE1970_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fce1960) {
    return ACT2Q5_StatusFilter_6FCE1960_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fce1d30) {
    return ACT2Q6_StatusFilter_6FCE1D30_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fce25e0) {
    return ACT2Q8_StatusFilter_6FCE25E0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fd028b0) {
    return ACT3Q0_StatusFilter113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fd03030) {
    return ACT3Q1_HratliIntroStatusFilter113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fd03040) {
    return ACT3Q2_DarkWandererStatusFilter113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fd03ce0) {
    return ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fd045b0) {
    return ACT3Q2_GidbinnStatusFilter_6FD045B0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fd04ab0) {
    return ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fd06e00) {
    return ACT3Q4_StatusFilter_6FD06E00_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fcd87d0) {
    return ACT4Q0_StatusFilter_6FCD87D0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fcd8b80) {
    return ACT4Prologue_StatusFilter_6FCD8B80_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fc76ea0) {
    return ACT5Q0_StatusFilter_6FC76EA0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fc76e00) {
    return ACT5Q1_StatusFilter_6FC76E00_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fc7b8c0) {
    return ACT5Q3_StatusFilter_6FC7B8C0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  if (va === 0x6fc768c0) {
    return ACT5Q4_StatusFilter_6FC768C0_113c(sm, pQuest, pPlayerUnit, pGameQuestFlags, pPlayerQuestFlags, pOutByte)
  }
  return 0
}

function dispatchK4SpellIconHandler113c(
  m: Memory113c,
  pHandlerFn: number,
  pGame: number,
  pOwnerUnit: number,
  pItem: number,
  pTargetUnit: number,
  nX: number,
  nY: number,
  nSpellParam: number,
): number {
  const sm = m as SparseMemory113c
  switch (pHandlerFn >>> 0) {
    case 0x6fcccfd0:
      return ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c(sm, nSpellParam, pOwnerUnit, pItem)
    case 0x6fccdac0:
      return ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        pTargetUnit,
        nX,
        nY,
        nSpellParam,
      )
    case 0x6fccf450:
      return SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        pTargetUnit,
        nX,
        nY,
        nSpellParam,
      )
    case 0x6fccedc0:
      return ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        nX,
        nY,
        0,
        nSpellParam,
      )
    case 0x6fccea40:
      return ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        nX,
        nY,
        0,
        nSpellParam,
      )
    case 0x6fcce6d0:
      return ITEMS_UsePercentagePotion_6FCCE6D0_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        nX,
        nY,
        0,
        nSpellParam,
      )
    case 0x6fccf370:
      return ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        pTargetUnit,
        nX,
        nY,
        nSpellParam,
      )
    case 0x6fccd9c0:
      return ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        pTargetUnit,
        nX,
        nY,
        nSpellParam,
      )
    case 0x6fccca20:
      return MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c(m, pOwnerUnit, pItem)
    case 0x6fcce4d0:
      return ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        pTargetUnit,
        nX,
        nY,
        nSpellParam,
      )
    case 0x6fccdf20: {
      const nItemId = pItem !== 0 ? (m.u32((pItem + 0x04) >>> 0) | 0) : -1
      const hasTxt = (DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0) !== 0
      ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        pTargetUnit,
        nX,
        nY,
        nSpellParam,
      )
      return hasTxt ? 1 : 0
    }
    case 0x6fccdee0: {
      const nItemId = pItem !== 0 ? (m.u32((pItem + 0x04) >>> 0) | 0) : -1
      const hasTxt = (DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0) !== 0
      ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c(
        sm,
        pGame,
        pOwnerUnit,
        pItem,
        pTargetUnit,
        nX,
        nY,
        nSpellParam,
      )
      return hasTxt ? 1 : 0
    }
    default:
      return 0
  }
}

function registerK4MonsterAltThinkHandlers113c(): void {
  registerMonsterAiThinkVaHandler113c(0x6fc36060, AI_InitClearFreezeAndStall_6FC36060_113c)
  registerMonsterAiThinkVaHandler113c(0x6fc9c8c0, AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c)
  registerMonsterAiThinkVaHandler113c(0x6fc9ce40, (m, pGame, pUnit, pAiParam) =>
    AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c(m as SparseMemory113c, pGame, pUnit, pAiParam),
  )
  registerMonsterAiThinkVaHandler113c(0x6fc9d550, (m, pGame, pUnit, pAiParam) =>
    AI_SubmergedOrStuckTransition_6FC9D550_113c(m as SparseMemory113c, pGame, pUnit, pAiParam),
  )
  registerMonsterAiThinkVaHandler113c(0x6fc9d670, (m, pGame, pUnit, pAiParam) =>
    AI_ThinkCommand14TriggeredSkill_6FC9D670_113c(m as SparseMemory113c, pGame, pUnit, pAiParam),
  )
  registerMonsterAiThinkVaHandler113c(0x6fcc59b0, (m, pGame, pUnit, pAiParam) =>
    MONAI_UnburrowThink_6FCC59B0_113c(m as SparseMemory113c, pGame, pUnit, pAiParam),
  )
  registerMonsterAiThinkVaHandler113c(0x6fcd78a0, (m, pGame, pUnit, pAiParam) =>
    AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c(m as SparseMemory113c, pGame, pUnit, pAiParam),
  )
  registerAiTargetModeCallback113c(3, (m, pGame, pOrigin, pCand, pCtx) =>
    MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c(
      m as SparseMemory113c,
      pGame,
      pOrigin,
      pCand,
      pCtx,
    ),
  )
  registerAiTargetModeCallback113c(0x6fcc39e0, (m, pGame, pOrigin, pCand, pCtx) =>
    MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c(m, pGame, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fcc4180, (m, pGame, pOrigin, pCand, pCtx) =>
    MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c(m, pGame, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fcd0db0, (m, pGame, pOrigin, pCand, pCtx) =>
    MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c(m, pGame, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fcd0df0, (m, pGame, pOrigin, pCand, pCtx) =>
    MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c(m, pGame, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fcd1520, (m, pGame, pOrigin, pCand, pCtx) =>
    MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c(m, pGame, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fc9bd50, (m, _pGame, pOrigin, pCand, pCtx) =>
    AI_FallenShamanCorpseFilter113c(m, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fcd12b0, (m, pGame, pOrigin, pCand, pCtx) =>
    MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c(m, pGame, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fc9b860, (m, _pGame, pOrigin, pCand, pCtx) =>
    AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c(m as SparseMemory113c, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fc9b8e0, (m, _pGame, pOrigin, pCand, pCtx) =>
    AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c(m as SparseMemory113c, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fc9ba40, (m, _pGame, pOrigin, pCand, pCtx) =>
    AI_ScanCallbackNearestBaseId136_6FC9BA40_113c(m as SparseMemory113c, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fc9bb00, (m, _pGame, pOrigin, pCand, pCtx) =>
    AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c(m as SparseMemory113c, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fc9bb90, (m, _pGame, pOrigin, pCand, pCtx) =>
    AI_ScanCallbackFetishMinions_6FC9BB90_113c(m as SparseMemory113c, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fc9bc70, (m, _pGame, pOrigin, pCand, pCtx) =>
    AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c(m as SparseMemory113c, pOrigin, pCand, pCtx),
  )
  registerAiTargetModeCallback113c(0x6fc9cf10, (m, pGame, pOrigin, pCand, pCtx) =>
    AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c(
      m as SparseMemory113c,
      pGame,
      pOrigin,
      pCand,
      pCtx,
    ),
  )
}

interface K4SavedRoomUnitSpec113c {
  readonly actIdx: number
  readonly roomX: number
  readonly roomY: number
  readonly unitType: number
  readonly classId: number
  readonly posX: number
  readonly posY: number
}

let k4TrackedMem: Memory113c | null = null
let k4TrackedGame = 0
const k4QuestTimerDirtyUnits: Array<{ readonly m: Memory113c; readonly pUnit: number }> = []
const k4PreDeactivateItemsByGuid = new Map<
  number,
  { readonly pItem: number; readonly origFlags: number }
>()
let k4SavedRoomUnitSpecs: K4SavedRoomUnitSpec113c[] = []

function bindK4SliceFrameTrackingContext113c(m: Memory113c, pGame: number): void {
  k4TrackedMem = m
  k4TrackedGame = pGame >>> 0
  k4QuestTimerDirtyUnits.length = 0
  k4PreDeactivateItemsByGuid.clear()
  k4SavedRoomUnitSpecs = []
  clearPendingSavedObjectInitModes113c()
}

function collectRoomUpdateDirtyUnits113c(m: Memory113c, pGame: number): Set<number> {
  const out = new Set<number>()
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    const pAct = m.u32((pGame + 0xbc + actIdx * 4) >>> 0) >>> 0
    if (pAct === 0 || !isByteAddrLoaded113c(m, pAct)) continue
    let pRoom = m.u32((pAct + 0x10) >>> 0) >>> 0
    while (pRoom !== 0 && isByteAddrLoaded113c(m, pRoom)) {
      let uUpd = m.u32((pRoom + 0x1c) >>> 0) >>> 0
      while (uUpd !== 0 && isByteAddrLoaded113c(m, uUpd)) {
        if ((m.u32((uUpd + 0xc4) >>> 0) & 0x01) !== 0) {
          out.add(uUpd >>> 0)
        }
        uUpd = m.u32((uUpd + 0xe0) >>> 0) >>> 0
      }
      pRoom = m.u32((pRoom + 0x7c) >>> 0) >>> 0
    }
  }
  return out
}

function flushK4ConsumedRoomRestores113c(m: Memory113c, pGame: number): void {
  if (k4SavedRoomUnitSpecs.length > 0) {
    const stillSaved = new Set<string>()
    for (let actIdx = 0; actIdx < 5; actIdx++) {
      let rn = m.u32((pGame + 0xd8 + actIdx * 4) >>> 0) >>> 0
      while (rn !== 0 && isByteAddrLoaded113c(m, rn)) {
        if (m.u32((rn + 0x10) >>> 0) !== 0) {
          stillSaved.add(`${actIdx}:${m.u32(rn) | 0}:${m.u32((rn + 0x04) >>> 0) | 0}`)
        }
        rn = m.u32((rn + 0x14) >>> 0) >>> 0
      }
    }
    const remainingUnits: K4SavedRoomUnitSpec113c[] = []
    const pCoordScratch = K4_QUEST_ARG_SCRATCH_VA
    for (let i = 0; i < k4SavedRoomUnitSpecs.length; i++) {
      const spec = k4SavedRoomUnitSpecs[i]!
      if (stillSaved.has(`${spec.actIdx}:${spec.roomX}:${spec.roomY}`)) {
        remainingUnits.push(spec)
        continue
      }
      const pAct = m.u32((pGame + 0xbc + spec.actIdx * 4) >>> 0) >>> 0
      if (pAct === 0 || !isByteAddrLoaded113c(m, pAct)) continue
      let pRoom = m.u32((pAct + 0x10) >>> 0) >>> 0
      while (pRoom !== 0 && isByteAddrLoaded113c(m, pRoom)) {
        DUNGEON_GetRoomCoordinates113c(m, pRoom, pCoordScratch)
        if (
          (m.u32(pCoordScratch) | 0) === spec.roomX &&
          (m.u32((pCoordScratch + 4) >>> 0) | 0) === spec.roomY
        ) {
          let pUnit = m.u32((pRoom + 0x74) >>> 0) >>> 0
          while (pUnit !== 0 && isByteAddrLoaded113c(m, pUnit)) {
            if (
              (m.u32(pUnit) >>> 0) === spec.unitType &&
              (m.u32((pUnit + 0x04) >>> 0) | 0) === spec.classId
            ) {
              const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
              if (
                pPath !== 0 &&
                (m.u32((pPath + 0x0c) >>> 0) | 0) === spec.posX &&
                (m.u32((pPath + 0x10) >>> 0) | 0) === spec.posY
              ) {
                m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x03000000) >>> 0)
              }
            }
            pUnit = m.u32((pUnit + 0xe8) >>> 0) >>> 0
          }
          break
        }
        pRoom = m.u32((pRoom + 0x7c) >>> 0) >>> 0
      }
    }
    k4SavedRoomUnitSpecs = remainingUnits
  }
}

function onK4PostActRoomsUpdate113c(): void {
  const m = k4TrackedMem
  const pGame = k4TrackedGame >>> 0
  if (m === null || pGame === 0 || !isByteAddrLoaded113c(m, pGame)) return
  flushK4ConsumedRoomRestores113c(m, pGame)
}

function onK4PreSliceFrameSetup113c(): void {
  clearPendingSavedObjectInitModes113c()
  const m = k4TrackedMem
  const pGame = k4TrackedGame >>> 0
  if (m === null || pGame === 0 || !isByteAddrLoaded113c(m, pGame)) return

  // 1. Snapshot saved non-monster room unit nodes (`[pRoomNode + 0x10]`) before
  //    `GAME_UpdateActRooms113c` / `CLIENTS_UpdatePlayerRoom113c` consumes them via `0x6FC400E0`.
  const specs: K4SavedRoomUnitSpec113c[] = []
  for (let actIdx = 0; actIdx < 5; actIdx++) {
    let rn = m.u32((pGame + 0xd8 + actIdx * 4) >>> 0) >>> 0
    while (rn !== 0 && isByteAddrLoaded113c(m, rn)) {
      const roomX = m.u32(rn) | 0
      const roomY = m.u32((rn + 0x04) >>> 0) | 0
      let pNode = m.u32((rn + 0x10) >>> 0) >>> 0
      while (pNode !== 0 && isByteAddrLoaded113c(m, pNode)) {
        const unitType = m.u32((pNode + 0x08) >>> 0) >>> 0
        const flags1C = m.u32((pNode + 0x1c) >>> 0) >>> 0
        if (unitType !== 1 && (flags1C & 0x0100) === 0) {
          specs.push({
            actIdx,
            roomX,
            roomY,
            unitType,
            classId: m.u32((pNode + 0x0c) >>> 0) | 0,
            posX: m.u32(pNode) | 0,
            posY: m.u32((pNode + 0x04) >>> 0) | 0,
          })
        }
        pNode = m.u32((pNode + 0x30) >>> 0) >>> 0
      }
      rn = m.u32((rn + 0x14) >>> 0) >>> 0
    }
  }
  k4SavedRoomUnitSpecs = specs

  // 2. Before `GAME_DeactivateUnusedRoomsTick113c` on `(dwGameFrame + 1) % 12 === 0`, cache active
  //    ground items and ensure `UNITFLAG_SAVE` (`0x02000000`) is set so `ROOM_DeactivateAnyUnitInRoom`
  //    (`D2Game:0x6FC40A75`, which saves/frees `UNIT_ITEM` unconditionally) deactivates them and
  //    upgrades synthetic save nodes to `'JM'` (`0x6FC403D0`).
  k4PreDeactivateItemsByGuid.clear()
  const nextFrame = ((m.u32((pGame + 0xa8) >>> 0) >>> 0) + 1) >>> 0
  if (
    nextFrame % 12 === 0 &&
    isByteAddrLoaded113c(m, 0x6fde9e1c) &&
    m.u32(0x6fde9e1c) !== 0
  ) {
    const itemHashBase = (pGame + SUNIT_HASH_OFFSET_BY_TYPE_113C[4]!) >>> 0
    for (let b = 0; b < 128; b++) {
      let pItem = m.u32((itemHashBase + b * 4) >>> 0) >>> 0
      while (pItem !== 0 && isByteAddrLoaded113c(m, pItem)) {
        if (UNITS_GetRoom113c(m, pItem) !== 0) {
          const origFlags = m.u32((pItem + 0xc4) >>> 0) >>> 0
          k4PreDeactivateItemsByGuid.set(m.u32((pItem + 0x0c) >>> 0) >>> 0, {
            pItem,
            origFlags,
          })
          if ((origFlags & 0x02000000) === 0) {
            m.setU32((pItem + 0xc4) >>> 0, (origFlags | 0x02000000) >>> 0)
          }
        }
        pItem = m.get(pItem, D2UnitStrc.pGameHashNext) >>> 0
      }
    }
  }
}

function onK4PostSliceFrameCleanup113c(): void {
  // 1. Preserve `dwFlags & 0x01` on objects dirtied during deferred quest timers (`QUESTS_StepQuestTimers`)
  //    so they broadcast `0x0E` on the next frame's `CLIENTS_UpdatePlayerRoom`.
  for (let i = 0; i < k4QuestTimerDirtyUnits.length; i++) {
    const entry = k4QuestTimerDirtyUnits[i]!
    if (isByteAddrLoaded113c(entry.m, (entry.pUnit + 0xc4) >>> 0)) {
      entry.m.setU32(
        (entry.pUnit + 0xc4) >>> 0,
        (entry.m.u32((entry.pUnit + 0xc4) >>> 0) | 0x01) >>> 0,
      )
    }
  }
  k4QuestTimerDirtyUnits.length = 0

  flushPendingSavedObjectInitModes113c()
  const m = k4TrackedMem
  const pGame = k4TrackedGame >>> 0
  if (m === null || pGame === 0 || !isByteAddrLoaded113c(m, pGame)) return

  // 2. Flush any remaining consumed `[pRoomNode + 0x10]` room restores.
  flushK4ConsumedRoomRestores113c(m, pGame)
  k4SavedRoomUnitSpecs = []

  // 3. Upgrade synthetic inactive ground-item nodes (`[pRoomNode + 0x08]`) into real `'JM'` (`0x4D4A`)
  //    bitstream nodes via `ITEMS_SaveItemToNodeAndFree_6FC403D0_113c` (`0x6FC403D0`), and restore
  //    original `dwFlags` on items whose room remained active.
  if (k4PreDeactivateItemsByGuid.size > 0) {
    const ppOutNode = K4_QUEST_ARG_SCRATCH_VA
    const sm = m as SparseMemory113c
    for (let actIdx = 0; actIdx < 5; actIdx++) {
      let rn = m.u32((pGame + 0xd8 + actIdx * 4) >>> 0) >>> 0
      while (rn !== 0 && isByteAddrLoaded113c(m, rn)) {
        let pPrev = 0
        let pCur = m.u32((rn + 0x08) >>> 0) >>> 0
        while (pCur !== 0 && isByteAddrLoaded113c(m, pCur)) {
          const pNext = m.u32(pCur) >>> 0
          if (m.u16((pCur + 0x0e) >>> 0) !== 0x4d4a) {
            const savedGuid = m.u32((pCur + 0x08) >>> 0) >>> 0
            const cached = k4PreDeactivateItemsByGuid.get(savedGuid)
            const pItem = cached !== undefined ? cached.pItem : 0
            if (pItem !== 0 && UNITS_GetRoom113c(m, pItem) === 0) {
              m.setU32(ppOutNode, 0)
              ITEMS_SaveItemToNodeAndFree_6FC403D0_113c(sm, pGame, pItem, 0, ppOutNode)
              const pNewNode = m.u32(ppOutNode) >>> 0
              if (pNewNode !== 0) {
                m.setU32(pNewNode, pNext)
                if (pPrev === 0) {
                  m.setU32((rn + 0x08) >>> 0, pNewNode)
                } else {
                  m.setU32(pPrev, pNewNode)
                }
                pPrev = pNewNode
                pCur = pNext
                continue
              }
            }
          }
          pPrev = pCur
          pCur = pNext
        }
        rn = m.u32((rn + 0x14) >>> 0) >>> 0
      }
    }
    for (const cached of k4PreDeactivateItemsByGuid.values()) {
      if (
        cached.pItem !== 0 &&
        isByteAddrLoaded113c(m, (cached.pItem + 0xc4) >>> 0) &&
        UNITS_GetRoom113c(m, cached.pItem) !== 0 &&
        (cached.origFlags & 0x02000000) === 0
      ) {
        m.setU32(
          (cached.pItem + 0xc4) >>> 0,
          (m.u32((cached.pItem + 0xc4) >>> 0) & ~0x02000000) >>> 0,
        )
      }
    }
    k4PreDeactivateItemsByGuid.clear()
  }
}

registerK4MonsterAltThinkHandlers113c()

let k4Installed = false

function dispatchK4QuestTimer113c(
  m: Memory113c,
  pfnTimer: number,
  pGame: number,
  pQuestData: number,
): number {
  const beforeDirty = pGame !== 0 ? collectRoomUpdateDirtyUnits113c(m, pGame) : null
  const sm = m as SparseMemory113c
  let rc = 0
  switch (pfnTimer >>> 0) {
    case 0x6fc7c480:
      rc = ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fc7e660:
      rc = ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fc83210:
      rc = ACT1Q5_TimerPromoteState0D_6FC83210_113c(sm, pQuestData) | 0
      break
    case 0x6fc83a80:
      rc = ACT1Q2_TimerPromoteState3_6FC83A80_113c(sm, pQuestData) | 0
      break
    case 0x6fc83b50:
      rc = ACT1Q1_TimerPromoteState5_6FC83B50_113c(sm, pQuestData) | 0
      break
    case 0x6fc87a90:
      rc = ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fc87c60:
      rc = ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fc88250:
      rc = ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c(sm, pQuestData) | 0
      break
    case 0x6fcda960:
      rc = ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fcdbdc0:
      rc = ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fce58b0:
      rc = ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fce5be0:
      rc = ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fce5e30:
      rc = ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fce6010:
      rc = ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fce6af0:
      rc = ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fce94e0:
      rc = A5Q4_OpenTemplePortalObject_6FCE94E0_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fd057d0:
      rc = ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fd068b0:
      rc = ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c(sm, pGame, pQuestData) | 0
      break
    case 0x6fd08f30:
      rc = D2Game_6FD08F30_113c(sm, pGame, pQuestData) | 0
      break
    default:
      rc = 0
      break
  }
  if (beforeDirty !== null) {
    const afterDirty = collectRoomUpdateDirtyUnits113c(m, pGame)
    for (const pUnit of afterDirty) {
      if (!beforeDirty.has(pUnit)) {
        k4QuestTimerDirtyUnits.push({ m, pUnit })
      }
    }
  }
  return rc
}

export function installK4QuestReplay113c(): void {
  if (k4Installed) return
  k4Installed = true
  registerK4MonsterAltThinkHandlers113c()
  registerPreSliceFrameSetupHook113c(onK4PreSliceFrameSetup113c)
  registerPostActRoomsUpdateHook113c(onK4PostActRoomsUpdate113c)
  registerPostSliceFrameCleanupHook113c(onK4PostSliceFrameCleanup113c)
  registerDefaultSpellIconHandler113c(dispatchK4SpellIconHandler113c)
  registerK4QuestCallbackDispatcher113c(dispatchK4QuestCallback113c)
  registerK4QuestNpcAlertDispatcher113c(dispatchK4QuestNpcAlert113c)
  registerK4QuestStatusFilterDispatcher113c(dispatchK4QuestStatusFilter113c)
  registerK4QuestTimerDispatcher113c(dispatchK4QuestTimer113c)
  registerK4ReplayKernelBridge113c({
    hydrateQuestAndNpcState: hydrateK4QuestAndNpcState113c,
    tryRunTownNpcThink: tryRunTownNpcThinkK4_113c,
    tryApplyQuestAndNpcC2SPacket: tryApplyQuestAndNpcC2SPacketK4_113c,
    executeQueuedPlayerEntityInteract: executeQueuedPlayerEntityInteractK4_113c,
  })
}
