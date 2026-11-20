import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items'
import { SKILLS_SetUsedSkillMemPort113c } from '../../../src/d2kern-113c/common/k0-d2common-memports'
import {
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
} from '../../../src/d2kern-113c/common/missile'
import {
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
} from '../../../src/d2kern-113c/common/path'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record'
import {
  SKILLS_GetParam3113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetParam4113c,
} from '../../../src/d2kern-113c/common/skills'
import {
  STATES_CheckGfxStateFlag113c,
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetSkillId113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc'
import {
  CHARSTATS_GetRecordPtrFast_6FC210A0_113c,
  CHECKSUM_ComputeCrc32_6FC2B470_113c,
  DATATBLS_GetTableWordAE0_6FC21830_113c,
  MONLVL_GetRecordPtrFast_6FC21E90_113c,
  MONSTATS_FollowSubClassChain_6FC21D30_113c,
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
  MONSTER_TestUnitMonTypeFlag_6FC22790_113c,
  MONTYPE_TestNestedBit_6FC21620_113c,
  OBJRGN_CheckCoordSpacing20_6FC2B700_113c,
  OBJRGN_CheckCoordSpacing40_6FC2B670_113c,
  OBJRGN_PrependObjectCoordNode_6FC2B800_113c,
  OVERLAY_GetRecordPtrFast_6FC21AE0_113c,
  PLAYER_GetWaypointDataForDifficulty_6FC21720_113c,
  SEED_StepSeed64Fast_6FC21160_113c,
  SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c,
  SKILLS_CanMonsterBeImpregnated_6FC2C110_113c,
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  SKILLS_EvalLinearParam34_6FC21A40_113c,
  SKILLS_EvalLinearParam56_6FC21A90_113c,
  SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c,
  SKILLS_GetMaxSkillLevel_6FC21740_113c,
  SKILLS_GetParam1Fast_6FC21B90_113c,
  SKILLS_GetParam2Fast_6FC21BC0_113c,
  SKILLS_GetParam3Fast_6FC21BF0_113c,
  SKILLS_GetParam4Fast_6FC21C20_113c,
  SKILLS_GetParam5Fast_6FC21C50_113c,
  SKILLS_GetParam6Fast_6FC21EC0_113c,
  SKILLS_GetParam7Fast_6FC21EF0_113c,
  SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c,
  SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c,
  SKILLS_SrvSt59_Submerge_6FC2BEE0_113c,
  STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c,
  STATLIST_AddUnitStatGoldGuarded_6FC21670_113c,
  STATLIST_SetUnitStatGoldGuarded_6FC21040_113c,
  STORM_TSArrayCalcChunkSize_6FC225F0_113c,
  STORM_TSHashTableLookup_6FC22130_113c,
  STORM_TSListInitDefault_6FC224B0_113c,
  STORM_TSListInitFromPrototype_6FC22740_113c,
  STORM_TSListUnlinkAll_6FC22180_113c,
  UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c,
} from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c'
import {
  ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c,
  ACT2Q0_StatusFilter_6FCE25C0_113c,
  ACT2Q1_Callback10_RemovePlayerGuid_6FCE44D0_113c,
  ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c,
  ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c,
  ACT2Q2_AddStaffCount_6FCE2380_113c,
  ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c,
  ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c,
  ACT2Q2_NoOp_6FCE2450_113c,
  ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c,
  ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c,
  ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c,
  ACT2Q3_GetAltarState_6FCE2120_113c,
  ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c,
  ACT2Q3_IsEclipseInactive_6FCE21A0_113c,
  ACT2Q3_NoOpA_6FCE2350_113c,
  ACT2Q3_NoOpB_6FCE2360_113c,
  ACT2Q3_NoOpC_6FCE2370_113c,
  ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c,
  ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c,
  ACT2Q4_Callback10_RemovePlayerGuid_6FCE3620_113c,
  ACT2Q4_InitArcanePortalObject_6FCE32C0_113c,
  ACT2Q4_IsPortalOpen_6FCE2040_113c,
  ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c,
  ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c,
  ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c,
  ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c,
  ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c,
  ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c,
  ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c,
  ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c,
  ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c,
  ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c,
  ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c,
  ACT2Q8_StatusFilter_6FCE25E0_113c,
  MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c,
  PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c,
  PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c,
  PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c,
  STATES_ClearGfxStateFlag_6FCEB1A0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import {
  AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c,
  AI_StepTurnAndCastSkill4_6FC3C1E0_113c,
  AIGENERAL_RemoveFromMinionList_6FC416A0_113c,
  GAME_LookupAndLockGameByKey_6FC4AAE0_113c,
  ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c,
  ITEMS_SaveItemToNodeAndFree_6FC403D0_113c,
  MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c,
  MONUMOD_ApplyChampionBaseStats_6FC418A0_113c,
  MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c,
  MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c,
  MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c,
  MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c,
  MONUMOD_ApplyGhostlyStats_6FC42D00_113c,
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c,
  MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c,
  MONUMOD_CheckModEligibility_6FC43100_113c,
  MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c,
  MONUMOD_SpawnBossMinionPack_6FC445A0_113c,
  MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c,
  MONUMOD_SpawnDeathNova_6FC46520_113c,
  MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c,
  MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c,
  MONUMOD_SpawnScarabChargedBolts_6FC46320_113c,
  OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c,
  OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c,
  OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c,
  OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c,
  OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c,
  OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c,
  OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c,
  OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c,
  SKILLS_ApplyProgressiveChargeState_6FC48E70_113c,
  SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c,
  SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c,
  SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c,
  SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c,
  SKILLS_SetupChargeOrLeapPath_6FC46A80_113c,
  SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c,
  SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c,
  SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import {
  AI_Thinker_MeleeRangedApproachStall_6FC38A90_113c,
  AI_Thinker_PutridDefiler_6FC38730_113c,
  CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c,
  CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c,
  MISSILES_RedeemCorpseWithSkill124_6FC59910_113c,
  MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c,
  MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c,
  MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c,
  MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c,
  MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c,
  PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c,
  PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c,
  SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c,
  SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c,
  SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c,
  SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c,
  SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c,
  SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c,
  SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c,
  SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c,
  SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c,
  SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c,
  SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c,
  SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c,
  SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c,
  SKILLS_SrvDo018_FindPotion_6FC47600_113c,
  SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c,
  SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c,
  SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c,
  SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c,
  SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c,
  SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c,
  SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c,
  SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c,
  SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c,
  SKILLS_SrvSt06_ChargeStart_6FC48600_113c,
  SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c,
  SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c,
  STATES_OnTransformStateRemoved_6FC64A60_113c,
  STORM_TSHashTableGrowAndRehash_6FC222D0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
  type MonsterCreateSpawnArgs113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import { EVENT_InitTimerQueue113c, EVENT_SetEventFull113c } from '../../../src/d2kern-113c/game/timer-wheel'
import {
  D2ItemsTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2SkillStrc,
} from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'

function formatD2GameHit(va: number): string {
  return `D2Game:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

const W5B1_PROMOTED_VAS: readonly number[] = [
  0x6fc222d0, 0x6fc2c400, 0x6fc2ca20, 0x6fc2d370, 0x6fc2d5d0, 0x6fc2d680, 0x6fc2d850, 0x6fc2dd50,
  0x6fc38730, 0x6fc38a90, 0x6fc473c0, 0x6fc47600, 0x6fc47820, 0x6fc47a10, 0x6fc47f30, 0x6fc48600,
  0x6fc489a0, 0x6fc4ac60, 0x6fc4c060, 0x6fc583a0, 0x6fc588c0, 0x6fc59910, 0x6fc5b070, 0x6fc5c3b0,
  0x6fc5c5b0, 0x6fc5e740, 0x6fc5eae0, 0x6fc62ad0, 0x6fc62b40, 0x6fc63b60, 0x6fc64a60, 0x6fc64ed0,
  0x6fc65000, 0x6fc651b0, 0x6fc6c4f0, 0x6fc6c600, 0x6fc6c720, 0x6fc6cb00, 0x6fc6d270, 0x6fc6f7d0,
]

const W3B2_PROMOTED_VAS: readonly number[] = [
  0x6fc3bca0, 0x6fc3c1e0, 0x6fc3f2d0, 0x6fc3f9f0, 0x6fc403d0, 0x6fc416a0, 0x6fc418a0, 0x6fc41be0,
  0x6fc41fe0, 0x6fc42bc0, 0x6fc42d00, 0x6fc42da0, 0x6fc42fa0, 0x6fc43100, 0x6fc43e20, 0x6fc44030,
  0x6fc445a0, 0x6fc45cc0, 0x6fc460d0, 0x6fc462d0, 0x6fc46320, 0x6fc46520, 0x6fc46a80, 0x6fc46bb0,
  0x6fc46e40, 0x6fc46f70, 0x6fc472c0, 0x6fc476d0, 0x6fc47c90, 0x6fc48e70, 0x6fc4aae0, 0x6fc4cd10,
  0x6fc4f690, 0x6fc4fa90, 0x6fc4fec0, 0x6fc50150, 0x6fc50800, 0x6fc50e50, 0x6fc522b0, 0x6fc525c0,
]

const W2B7_PROMOTED_VAS: readonly number[] = [
  0x6fce1f90, 0x6fce2040, 0x6fce2120, 0x6fce2150, 0x6fce21a0, 0x6fce2350, 0x6fce2360, 0x6fce2370,
  0x6fce2380, 0x6fce2450, 0x6fce2460, 0x6fce25c0, 0x6fce25e0, 0x6fce27c0, 0x6fce27f0, 0x6fce29c0,
  0x6fce2a90, 0x6fce2af0, 0x6fce2f00, 0x6fce3190, 0x6fce32c0, 0x6fce3510, 0x6fce3620, 0x6fce3970,
  0x6fce3eb0, 0x6fce3ef0, 0x6fce3fc0, 0x6fce4170, 0x6fce44d0, 0x6fce4550, 0x6fce4bd0, 0x6fce4d90,
  0x6fce4de0, 0x6fce5260, 0x6fce5560, 0x6fcea490, 0x6fceb1a0, 0x6fceb420, 0x6fceb450, 0x6fceb4e0,
]

const LANEH_PROMOTED_VAS: readonly number[] = [
  0x6fc21040, 0x6fc210a0, 0x6fc21160, 0x6fc21620, 0x6fc21670, 0x6fc216f0, 0x6fc21720, 0x6fc21740,
  0x6fc21830, 0x6fc218e0, 0x6fc21a40, 0x6fc21a90, 0x6fc21ae0, 0x6fc21b10, 0x6fc21b90, 0x6fc21bc0,
  0x6fc21bf0, 0x6fc21c20, 0x6fc21c50, 0x6fc21d30, 0x6fc21e90, 0x6fc21ec0, 0x6fc21ef0, 0x6fc22130,
  0x6fc22180, 0x6fc224b0, 0x6fc225f0, 0x6fc22740, 0x6fc22790, 0x6fc2b470, 0x6fc2b670, 0x6fc2b700,
  0x6fc2b800, 0x6fc2be20, 0x6fc2bee0, 0x6fc2c000, 0x6fc2c110, 0x6fc2c170, 0x6fc2c1f0, 0x6fc2c310,
]

function createWave5World(nDifficulty = 0) {
  const m = new SparseMemory113c()
  m.fill(0x6fdd6000, 0x20000, 0)
  m.fill(0x6fd18000, 0x20000, 0)
  // D2Common BODY_GRID_DEF_VA_113C (0x6FDED378): 13x1 body-loc grid definition
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)

  const pDataTables = m.alloc(0x1400)
  const pSgptHolder = m.alloc(4)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(pSgptHolder, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pSgptHolder)

  const pBitMasks = m.alloc(32 * 4)
  for (let i = 0; i < 32; i++) {
    m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)

  // D2Common SGPT_EXPERIENCE_TXT_PTR_VA_113C (0x6FDF0B50): max level = 99
  const pExpTxt = m.alloc(0x40)
  m.setU32(pExpTxt, 99)
  m.setU32(0x6fdf0b50, pExpTxt)

  const pMonStatsTxt = m.alloc(600 * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 600)
  m.setU32(0x6fdf0950, pMonStatsTxt)
  m.setU32(0x6fdf0958, 600)
  for (let i = 0; i < 600; i++) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x00, i)
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x18, i) // D2MonStatsTxt.wMonStatsEx
  }

  const pMonStats2Txt = m.alloc(600 * 0x134)
  m.setU32(pDataTables + 0xa84, pMonStats2Txt)
  m.setU32(pDataTables + 0xa8c, 600)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 600)

  const pMonLvlTxt = m.alloc(120 * 0x78)
  m.setU32(pDataTables + 0xb70, pMonLvlTxt)
  m.setU32(pDataTables + 0xb74, 120)

  // Separate DifficultyLevelsTxt table at 0x6FDF0B54 (stride 0x58)
  const pDiffLvlTxt = m.alloc(3 * 0x58)
  m.setU32(0x6fdf0b54, pDiffLvlTxt)
  m.setU32(0x6fdf0b58, 3)
  for (let d = 0; d < 3; d++) {
    m.setU32(pDiffLvlTxt + d * 0x58 + 0x34, 100) // dwMonsterDamageBonus = 100%
  }

  const pSkillsTxt = m.alloc(360 * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 360)
  m.setU32(pDataTables + 0xba8, pSkillsTxt)
  m.setU32(pDataTables + 0xbac, 360)

  const pMissilesTxt = m.alloc(400 * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 400)
  m.setU32(0x6fdf0a3c, pMissilesTxt)
  m.setU32(0x6fdf0a44, 400)

  const pOverlayTxt = m.alloc(200 * 0x3c)
  m.setU32(pDataTables + 0xbc, pOverlayTxt)
  m.setU32(pDataTables + 0xc4, 200)

  const pStatesTxt = m.alloc(200 * 0x40)
  m.setU32(pDataTables + 0xbbc, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, 200)
  m.setU32(pDataTables + 0x150, m.alloc(32))

  const pCharStatsTxt = m.alloc(7 * 0xc4)
  m.setU32(pDataTables + 0xbc4, pCharStatsTxt)
  m.setU32(pDataTables + 0xbc8, 7)

  const pItemStatCostTxt = m.alloc(360 * 0x144)
  m.setU32(pDataTables + 0xbcc, pItemStatCostTxt)
  m.setU32(pDataTables + 0xbd4, 360)

  const pUniqueItemsTxt = m.alloc(400 * 0x14c)
  m.setU32(pDataTables + 0xc24, pUniqueItemsTxt)
  m.setU32(pDataTables + 0xc28, 400)

  const pItemsTxt = m.alloc(64 * D2ItemsTxt_SIZE)
  m.setU32(pDataTables + 0x00, 64)
  m.setU32(pDataTables + 0x04, pItemsTxt)
  m.setU32(SG_ITEM_DATATABLES_VA_113C, 64)
  m.setU32(SG_ITEM_DATATABLES_VA_113C + 4, pItemsTxt)
  m.setU32(pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80, 0x20786f62) // 'box '
  m.setU8(pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x14d, 1)

  const pMonUModTxt = m.alloc(64 * 0x20)
  m.setU32(pDataTables + 0xc50, pMonUModTxt)
  m.setU32(pDataTables + 0xc54, 64)

  const pMonTypeNest = m.alloc(64 * 2 * 4)
  m.setU32(pDataTables + 0xc40, 64)
  m.setU32(pDataTables + 0xc44, pMonTypeNest)
  m.setU32(pDataTables + 0xc48, 2)

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
  }

  const pObjectsTxt = m.alloc(600 * 0x1c0)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  const pObjGroupTxt = m.alloc(32 * 0xb8)
  m.setU32(0x6fdf0b8c, pObjGroupTxt)
  m.setU32(0x6fdf0b90, 32)

  const pShrinesTxt = m.alloc(32 * 0x108)
  m.setU32(0x6fdf0b9c, pShrinesTxt)
  m.setU32(0x6fdf0ba0, 32)

  const pSkillCode = m.alloc(0x200)
  m.setU32(pDataTables + 0x40, pSkillCode)
  m.setU32(pDataTables + 0x44, 0x200)

  const pAnimDataTable = m.alloc(0x420)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)

  const townLevels = [1, 40, 75, 103, 109]
  for (let act = 0; act < 5; act++) m.setU32(0x6fde4084 + act * 4, townLevels[act]!)

  for (let i = 0; i < PATH_TYPE_STEP_NUMS_6FDE4138.length; i++) {
    m.setU32((0x6fde4138 + i * 4) >>> 0, PATH_TYPE_STEP_NUMS_6FDE4138[i]! >>> 0)
  }
  for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
    m.setU32((0x6fde4180 + i * 4) >>> 0, PATH_TYPE_FLAGS_6FDE4180[i]! >>> 0)
  }
  m.fill(0x6fde41c8, 64 * 4, 1)

  const pGame = m.alloc(0x1f00)
  m.setU32(pGame + 0x1c, 0x12340000)
  m.setU8(pGame + 0x6d, nDifficulty)
  m.setU16(pGame + 0x70, 1)
  m.setU32(pGame + 0xa8, 100)
  const pObjCtrl = m.alloc(0x1200)
  m.setU32(pObjCtrl, 0x12345679)
  m.setU32(pObjCtrl + 4, 0x29a)
  m.setU32(pGame + 0x10f0, pObjCtrl)
  const pQuestControl = m.alloc(0x40)
  m.setU32(pGame + 0x10f4, pQuestControl)
  const pArenaCtrl = m.alloc(0x40)
  m.setU32(pGame + 0x1d28, pArenaCtrl)
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pObjCtrl,
    pQuestControl,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pMonLvlTxt,
    pDiffLvlTxt,
    pSkillsTxt,
    pMissilesTxt,
    pOverlayTxt,
    pStatesTxt,
    pCharStatsTxt,
    pUniqueItemsTxt,
    pItemsTxt,
    pMonUModTxt,
    pMonTypeNest,
    pLevelsTxt,
    pObjectsTxt,
    pObjGroupTxt,
    pSkillCode,
  }
}

function allocRoom(m: SparseMemory113c, subX = 100, subY = 100, subW = 24, subH = 24, levelId = 2) {
  const pRoom = m.alloc(0x90)
  const pRoomEx = m.alloc(0x90)
  const pLevel = m.alloc(0x200)
  const pActUpdateFlag = m.alloc(4)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x2c, pActUpdateFlag)
  m.setU32(pRoom + 0x3c, m.alloc(16))
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, levelId)
  m.setU32(pRoom + 0x4c, subX)
  m.setU32(pRoom + 0x50, subY)
  m.setU32(pRoom + 0x54, subW)
  m.setU32(pRoom + 0x58, subH)
  const ppNear = m.alloc(8)
  m.setU32(ppNear, pRoom)
  m.setU32(pRoom, ppNear)
  m.setU32(pRoom + 0x24, 1)
  const pCollGrid = m.alloc(0x28)
  const pCollMap = m.alloc(subW * subH * 2)
  m.setU32(pCollGrid + 0x00, subX)
  m.setU32(pCollGrid + 0x04, subY)
  m.setU32(pCollGrid + 0x08, subW)
  m.setU32(pCollGrid + 0x0c, subH)
  m.setU32(pCollGrid + 0x20, pCollMap)
  m.setU32(pRoom + 0x20, pCollGrid)
  return { pRoom, pCollMap, pRoomEx, pLevel }
}

function allocMonster(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  classId = 5,
  guid = 1,
  x = 108,
  y = 108,
) {
  const pMon = m.alloc(0x100)
  const pMonData = m.alloc(0x60)
  const pAiGen = m.alloc(0x48)
  const pAiCtrl = m.alloc(0x48)
  const pPath = m.alloc(0x100)
  const pSkills = m.alloc(0x40)
  m.setU32(pMon + 0x00, 1)
  m.setU32(pMon + 0x04, classId)
  m.setU32(pMon + 0x0c, guid)
  m.setU32(pMon + 0x10, 1)
  m.setU32(pMon + 0x14, pMonData)
  m.setU32(pMon + 0x20, 0x12345679)
  m.setU32(pMon + 0x24, 0x29a)
  m.setU32(pMon + 0x2c, pPath)
  m.setU32(pMon + 0x80, pGame)
  m.setU32(pMon + 0xa8, pSkills)
  const pMonStatsBase = m.u32(m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) + 0xa78)
  m.setU32(pMonData + 0x00, pMonStatsBase + classId * 0x1a8)
  m.setU32(pMonData + 0x10, pAiCtrl)
  m.setU32(pMonData + 0x28, pAiGen)
  m.setU16(pPath + 0x02, x)
  m.setU16(pPath + 0x06, y)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pMon)
  STATLIST_CreateEx113c(m, pMon, 0, pGame)
  const pBasicList = STATLIST_AllocList113c(m, 1, 1, guid, 0, 0)
  STATLIST_MergeStatLists113c(m, pMon, pBasicList, 1)
  STATLIST_SetUnitStat113c(m, pMon, 0x0c, 10, 0)
  STATLIST_SetUnitStat113c(m, pMon, 6, 200 << 8, 0)
  STATLIST_SetUnitStat113c(m, pMon, 7, 200 << 8, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pMon)
  return { pMon, pMonData, pAiGen, pAiCtrl, pPath, pSkills }
}

function allocPlayer(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  guid = 100,
  x = 106,
  y = 106,
) {
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x200)
  const pPath = m.alloc(0x100)
  const pSkills = m.alloc(0x40)
  const pInv = m.alloc(0x80)
  m.setU32(pPlayer + 0x00, 0)
  m.setU32(pPlayer + 0x04, 0)
  m.setU32(pPlayer + 0x0c, guid)
  m.setU32(pPlayer + 0x10, 1)
  m.setU32(pPlayer + 0x14, pPlayerData)
  m.setU32(pPlayer + 0x20, 0x13579bdf)
  m.setU32(pPlayer + 0x24, 0x29a)
  m.setU32(pPlayer + 0x2c, pPath)
  m.setU32(pPlayer + 0x60, pInv)
  m.setU32(pPlayer + 0x80, pGame)
  m.setU32(pPlayer + 0xa8, pSkills)
  m.setU32(pInv, 0x1020304)
  m.setU16(pPath + 0x02, x)
  m.setU16(pPath + 0x06, y)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pPlayer)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const nDiff = m.u8(pGame + 0x6d)
  m.setU32(pPlayerData + nDiff * 4 + 0x10, pQuestFlags)
  STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
  STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 10, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 6, 300 << 8, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 7, 300 << 8, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pPlayer)
  return { pPlayer, pPlayerData, pPath, pSkills, pInv, pQuestFlags }
}

describe('K2 Wave 5 Disassembly-Verified Differential Suite (+160 D2Game VAs)', () => {
  it('verifies all 40 promoted VAs in k2w5-b1 (0x6FC222D0..0x6FC6F7D0) with VA trace + state assertions', () => {
    const w = createWave5World()
    const { m, pGame, pSkillsTxt, pMissilesTxt, pMonStatsTxt } = w
    const { pRoom } = allocRoom(m, 100, 100, 24, 24, 2)
    const { pMon: pUnit } = allocMonster(m, pGame, pRoom, 10, 1, 108, 108)
    const { pMon: pTarget } = allocMonster(m, pGame, pRoom, 11, 2, 110, 108)
    const { pPlayer, pPath: pPlayerPath } = allocPlayer(m, pGame, pRoom, 100, 106, 106)

    // Configure skill records for behavioral calls
    const skId = 5
    const pSk5 = pSkillsTxt + skId * 0x23c
    m.setU16(pSk5 + 0x48, 2) // wSrvMissileA = 2
    m.setU16(pSk5 + 0x80, 10) // wAuraState = 10
    m.setU16(pSk5 + 0x110, (-1) & 0xffff)
    m.setU16(pSk5 + 0x12e, 1) // wHitFlags bit 0 (guaranteed hit)
    m.setU16(pMissilesTxt + 2 * 0x1a4 + 0x24, (-1) & 0xffff)
    m.setU32(pMissilesTxt + 1 * 0x1a4 + 0x3c, 10)

    beginVaTrace113c()

    // 0x6FC222D0: TSHashTable grow doubles bucket mask 1 -> 3
    const pHash = m.alloc(0x40)
    const pBuckets = m.alloc(0x80)
    m.setU32(pHash + 0x1c, pBuckets)
    m.setU32(pHash + 0x20, 2)
    m.setU32(pHash + 0x24, 1)
    for (let i = 0; i < 2; i++) {
      const b = pBuckets + i * 12
      m.setU32(b, 4)
      m.setU32(b + 4, b + 4)
      m.setU32(b + 8, ~(b + 4) >>> 0)
    }
    STORM_TSHashTableGrowAndRehash_6FC222D0_113c(m, pHash)
    expect(m.u32(pHash + 0x24)).toBe(3)

    // 0x6FC2C400..0x6FC2DD50
    expect(SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c(m, pGame, pUnit, 1, 1)).toBe(1)
    expect(SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c(m, pUnit, pGame, 1, 0, 1, 1)).toBe(0)
    expect(SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c(m, -1, pUnit, pGame, 1, 0)
    expect(SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c(m, pGame, pUnit, skId, 1)).toBe(0)

    // 0x6FC38730 & 0x6FC38A90: PutridDefiler & MeleeRangedApproachStall AI thinkers
    const pArgs = m.alloc(0x40)
    const pMonRec10 = pMonStatsTxt + 10 * 0x1a8
    m.setU16(pMonRec10 + 0x170, 0xffff)
    m.setU32(pArgs + 0x18, 1)
    m.setU32(pArgs + 0x1c, pMonRec10)
    AI_Thinker_PutridDefiler_6FC38730_113c(m, pGame, pUnit, pArgs)
    AI_Thinker_MeleeRangedApproachStall_6FC38A90_113c(m, pGame, pUnit, pArgs)
    expect((m.u32(pUnit + 0xc4) & 0x0e) !== 0).toBe(true)

    // 0x6FC473C0..0x6FC489A0
    expect(SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo018_FindPotion_6FC47600_113c(m, pGame, pUnit, -1, 1)).toBe(0)
    expect(SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c(m, pUnit, pGame, skId, 1)).toBe(0)
    expect(SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c(m, skId, pUnit, pGame, 0, 1)).toBe(0)
    expect(SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c(m, pGame, pPlayer, 1, 1)).toBe(0)
    expect(SKILLS_SrvSt06_ChargeStart_6FC48600_113c(m, pGame, pPlayer, 1, 1)).toBe(0)
    expect(SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c(m, pGame, pPlayer, -1, 1)).toBe(0)

    // 0x6FC4AC60 & 0x6FC4C060: client handshake sets initState = 1
    const pClient = m.alloc(0x500)
    CLIENTS_SendHandshakeAndSetInitState1_6FC4AC60_113c(m, pClient, pGame)
    expect(m.u32(pClient + 0x04)).toBe(1)
    CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c(m, 0)

    // 0x6FC583A0 & 0x6FC588C0
    PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c(m, pPlayer, pGame, pPlayer)
    m.setU8(pPlayer + 0x6c, 1)
    m.setU32(pPlayer + 0x64, 99)
    m.setU32(pPlayer + 0x68, 1)
    expect(PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(m, pPlayer, pGame, 0)).toBe(0)
    expect(m.u8(pPlayer + 0x6c)).toBe(0)

    // 0x6FC59910..0x6FC5EAE0: missiles
    expect(MISSILES_RedeemCorpseWithSkill124_6FC59910_113c(m, pGame, pPlayer, 0, 1)).toBe(0)
    const pMissile = m.alloc(0x100)
    const pMisPath = m.alloc(0x80)
    const pMisData = m.alloc(0x80)
    m.setU32(pMissile, 3)
    m.setU32(pMissile + 0x04, 1)
    m.setU32(pMissile + 0x14, pMisData)
    m.setU32(pMissile + 0x2c, pMisPath)
    expect(MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c(m, pMissile, pGame)).toBe(1)
    m.setU32(pMissile + 0x04, 2)
    expect(MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c(m, pGame, pMissile, 0)).toBe(1)

    // 0x6FC62AD0..0x6FC6F7D0: skills & transform state
    PATH_SetTargetPos113c(m, pPlayerPath, 108, 108)
    expect(SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c(m, pGame, pPlayer)).toBe(1)
    expect(
      SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c(m, pGame, pPlayer, pTarget, 0, skId, 1),
    ).toBe(1)
    expect(SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
    STATES_OnTransformStateRemoved_6FC64A60_113c(m, pPlayer, 10, 0)
    expect(SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c(m, pGame, pPlayer, skId, 1)).toBe(0)
    expect(SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c(m, pGame, pPlayer, skId, 1)).toBe(0)
    SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c(m, skId, pPlayer, pTarget, pGame, 5, pSk5, 1)
    expect(SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c(m, pGame, pPlayer, skId, 1)).toBe(0)
    expect(SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c(m, pGame, pPlayer, skId, 1)).toBe(0)
    expect(SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c(m, pGame, pPlayer, skId, 1)).toBe(0)
    expect(
      SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c(m, pGame, pPlayer, skId, 1),
    ).toBe(0)
    expect(
      SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c(m, pGame, pPlayer, -1, 1),
    ).toBe(0)
    expect(
      SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c(m, pGame, pPlayer, skId, 1),
    ).toBe(0)

    const hits = endVaTrace113c()
    expect(W5B1_PROMOTED_VAS.length).toBe(40)
    for (const va of W5B1_PROMOTED_VAS) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA trace hit for ${formatD2GameHit(va)}`).toBe(true)
    }
  })

  it('verifies all 40 promoted VAs in k2w3-b2 (0x6FC3BCA0..0x6FC525C0) with VA trace + state assertions', () => {
    const w = createWave5World()
    const {
      m,
      pGame,
      pMonStatsTxt,
      pMonLvlTxt,
      pMonUModTxt,
      pSkillsTxt,
      pObjectsTxt,
      pObjGroupTxt,
    } = w
    const { pRoom } = allocRoom(m, 100, 100, 24, 24, 2)
    const { pMon, pMonData, pAiCtrl, pSkills, pPath } = allocMonster(m, pGame, pRoom, 10, 1, 108, 108)

    beginVaTrace113c()

    // 0x6FC3BCA0: Foul Crow Nest AI depletes when aipar1 == 0
    const pRec10 = pMonStatsTxt + 10 * 0x1a8
    m.setU16(pRec10 + 0x56, 0)
    m.setU16(pRec10 + 0x5c, 12)
    m.setU32(pAiCtrl + 0x14, 0)
    m.setU32(pSkills + 0x10, 0x12345678)
    const pArgs1 = m.alloc(0x30)
    m.setU32(pArgs1 + 0x00, pAiCtrl)
    m.setU32(pArgs1 + 0x14, 4)
    m.setU32(pArgs1 + 0x1c, pRec10)
    AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c(m, pGame, pMon, pArgs1)
    expect(m.u32(pSkills + 0x10)).toBe(0)

    // 0x6FC3C1E0: initial cast writes dwGameFrame to pAiCtrl + 0x14
    m.setU16(pRec10 + 0x170, 5)
    m.setU8(pRec10 + 0x180, 1)
    m.setU32(pAiCtrl + 0x14, 0)
    AI_StepTurnAndCastSkill4_6FC3C1E0_113c(m, pGame, pMon, pArgs1)
    expect(m.u32(pAiCtrl + 0x14)).toBe(100)

    // 0x6FC3F2D0: moves preset extra pointer + sets class 0x137 field +0x0E
    const { pMon: pSiege, pMonData: pSiegeData, pAiGen: pSiegeAiGen } = allocMonster(m, pGame, pRoom, 0x137, 2)
    m.setU8(pMonStatsTxt + 0x137 * 0x1a8 + 0x0d, 1)
    const pPresetUnit = m.alloc(0x60)
    const pExtra = m.alloc(0x18)
    m.setU32(pPresetUnit + 0x24, pExtra)
    m.setU32(pPresetUnit + 0x4c, 9)
    MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c(m, pSiege, pGame, pPresetUnit)
    expect(m.u32(pPresetUnit + 0x24)).toBe(0)
    expect(m.u32(pSiegeAiGen + 0x38)).toBe(pExtra)
    expect(m.u8(pSiegeData + 0x0e)).toBe(9)

    // 0x6FC403D0 & 0x6FC3F9F0: save compact item to inactive node & load invalid node
    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x74)
    const pItemPath = m.alloc(0x20)
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x04, 1)
    m.setU32(pItem + 0x0c, 50)
    m.setU32(pItem + 0x14, pItemData)
    m.setU32(pItem + 0x2c, pItemPath)
    m.setU32(pItem + 0x80, pGame)
    m.setU16(pItemData + 0x02, 0x60)
    m.setU32(pItemData + 0x18, 0x200000)
    const pHolder = m.alloc(0x20)
    const pSavedNode = ITEMS_SaveItemToNodeAndFree_6FC403D0_113c(m, pGame, pItem, pHolder)
    expect(pSavedNode).toBeGreaterThan(0)
    expect(m.u32(pHolder + 0x08)).toBe(pSavedNode)
    const pEmptyNode = m.alloc(0x20)
    expect(ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c(m, pGame, 0, pEmptyNode)).toBe(0)

    // 0x6FC416A0: unlinks minion from leader list + resets owner guid to 0xFFFFFFFF
    const { pAiGen: pLeaderAiGen } = allocMonster(m, pGame, pRoom, 5, 10)
    const { pMon: pMinion, pAiGen: pMinionAiGen } = allocMonster(m, pGame, pRoom, 5, 11)
    const pN1 = m.alloc(8)
    const pN2 = m.alloc(8)
    m.setU32(pN1, 10)
    m.setU32(pN1 + 4, pN2)
    m.setU32(pN2, 11)
    m.setU32(pLeaderAiGen + 0x28, pGame)
    m.setU32(pLeaderAiGen + 0x34, pN1)
    m.setU32(pMinionAiGen + 0x28, pGame)
    m.setU32(pMinionAiGen + 0x2c, 10)
    m.setU32(pMinionAiGen + 0x30, 1)
    AIGENERAL_RemoveFromMinionList_6FC416A0_113c(m, pGame, pMinion)
    expect(m.u32(pN1 + 4)).toBe(0)
    expect(m.u32(pMinionAiGen + 0x2c)).toBe(0xffffffff)

    // 0x6FC418A0..0x6FC43100: MONUMOD stat appliers & eligibility
    const { pMon: pChamp, pMonData: pChampData } = allocMonster(m, pGame, pRoom, 0x14c, 12)
    MONUMOD_ApplyChampionBaseStats_6FC418A0_113c(m, pGame, pChamp, 0, 0)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x13, 0)).toBeGreaterThanOrEqual(51)

    MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pChamp, 0x09, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x27, 0)).toBe(75)

    const nMlvl = STATLIST_GetUnitStat113c(m, pChamp, 0x0c, 0)
    m.setU32(pMonLvlTxt + nMlvl * 0x78 + 18 * 4, 100)
    for (let i = 0; i < 36; i++) m.setU32(pMonUModTxt + i * 0x20 + 0x1c, 50)
    MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c(m, pGame, pChamp, 0x30, 0x31, -1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x30, 0)).toBe(50)

    MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c(m, pChamp, 5, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x19, 0)).toBe(50)

    MONUMOD_ApplyGhostlyStats_6FC42D00_113c(m, pChamp, 0x27, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x19, 0)).toBe(350)

    const lvlBefore = STATLIST_GetUnitStat113c(m, pChamp, 0x0c, 0)
    MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, pChamp, 0x10, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x0c, 0)).toBe(lvlBefore - 1)

    m.setU8(pChampData + 0x16, 0)
    STATLIST_SetUnitStat113c(m, pChamp, 0x4a, 0x28, 0)
    MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c(m, pChamp, 2, 1)
    expect(STATLIST_GetUnitStat113c(m, pChamp, 0x4a, 0)).toBe(0)

    m.setU8(pMonUModTxt + 5 * 0x20 + 0x06, 1)
    expect(MONUMOD_CheckModEligibility_6FC43100_113c(m, pChamp, pMonUModTxt + 5 * 0x20, 1)).toBe(1)

    // 0x6FC43E20..0x6FC46520: revive event, cursed amp, minion pack, enchanted/scarab/death nova
    expect(MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c(m, pGame, pMon)).toBe(1)
    m.setU16(pSkillsTxt + 0x42 * 0x23c + 0x54, 0x24)
    m.setU16(pSkillsTxt + 0x42 * 0x23c + 0x82, 9)
    MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c(m, pGame, pMon, pChamp, 2)
    MONUMOD_SpawnBossMinionPack_6FC445A0_113c(m, pGame, pRoom, 0, 0)

    const guidBeforeBolts = m.u32(pGame + 0x9c)
    MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c(m, pGame, pMon)
    expect(m.u32(pGame + 0x9c)).toBe(guidBeforeBolts + 8)
    MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c(m, pGame, pMon)
    expect(m.u32(pGame + 0x9c)).toBe(guidBeforeBolts + 16)
    MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c(m, pGame, pMon)
    expect(m.u32(pGame + 0x9c)).toBeGreaterThan(guidBeforeBolts + 16)
    m.setU32(pMonData + 0x18, 50)
    MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(m, pGame, pMon)
    expect(m.u32(pMonData + 0x18)).toBe(100)
    MONUMOD_SpawnDeathNova_6FC46520_113c(m, pGame, pMon, 0, 0, 1)

    // 0x6FC46A80..0x6FC4CD10: skills, game lock, sunit remove
    const pSkill = m.alloc(0x40)
    const pSk5 = pSkillsTxt + 5 * 0x23c
    m.setU32(pSkill, pSk5)
    SKILLS_SetParam1113c(m, pSkill, 112)
    SKILLS_SetParam2113c(m, pSkill, 112)
    expect(SKILLS_SetupChargeOrLeapPath_6FC46A80_113c(m, pMon, pSkill)).toBe(1)
    expect(m.u32(pSkill + 0x0c)).toBe(0x1101)

    const pX = m.alloc(4)
    const pY = m.alloc(4)
    m.setU32(pX, 110)
    m.setU32(pY, 110)
    expect(SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c(m, pMon, -1, 1, pX, pY)).toBe(0)
    // Player Whirlwind interval: Param4=0 initializes to dwCurFrame+4 (104), Param4=50 clamps to dwCurFrame+10 (110)
    const { pPlayer: pWwPlayer } = allocPlayer(m, pGame, pRoom, 44, 108, 108)
    SKILLS_SetParam4113c(m, pSkill, 0)
    expect(SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c(m, pWwPlayer, pGame, pSkill)).toBe(1)
    expect(m.u32(pSkill + 0x24)).toBe(104)
    SKILLS_SetParam4113c(m, pSkill, 50)
    expect(SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c(m, pWwPlayer, pGame, pSkill)).toBe(1)
    expect(m.u32(pSkill + 0x24)).toBe(110)
    expect(SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c(m, pGame, pMon, 5)).toBeGreaterThan(0)
    SKILLS_SetParam3113c(m, pSkill, 6)
    SKILLS_SetParam4113c(m, pSkill, -1)
    expect(SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c(m, pGame, pMon, pSkill)).toBe(0)
    expect(SKILLS_GetParam3113c(m, pSkill)).toBe(6)
    expect(SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c(m, pGame, pMon, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c(m, pGame, pMon, -1, 1)).toBe(0)
    expect(SKILLS_ApplyProgressiveChargeState_6FC48E70_113c(m, pGame, pMon, -1, 1)).toBe(0)

    m.setU32(0x6fd31c24, 0)
    expect(GAME_LookupAndLockGameByKey_6FC4AAE0_113c(m, 1)).toBe(0)
    const { pMon: pTemp } = allocMonster(m, pGame, pRoom, 5, 31)
    SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c(m, pGame, pTemp)

    // 0x6FC4F690..0x6FC525C0: object populators & preset spawners
    const pPopCtx = m.alloc(0x20)
    const pUrnObj = m.alloc(0x20)
    const pUrnSeed = m.alloc(8)
    m.setU32(pPopCtx + 0x00, pGame)
    m.setU32(pPopCtx + 0x04, pUrnObj)
    m.setU32(pPopCtx + 0x08, pRoom)
    m.setU32(pPopCtx + 0x0c, pUrnSeed)
    OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c(m, pPopCtx)

    const pRoomCoords = m.alloc(0x20)
    m.setU32(pRoomCoords + 0x00, 100)
    m.setU32(pRoomCoords + 0x04, 100)
    m.setU32(pRoomCoords + 0x08, 12)
    m.setU32(pRoomCoords + 0x0c, 12)
    expect(OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c(m, pGame, pRoom, pRoomCoords, 0)).toBe(1)

    const pRect = m.alloc(0x10)
    m.setU32(pRect + 0x00, 102)
    m.setU32(pRect + 0x04, 102)
    m.setU32(pRect + 0x08, 4)
    m.setU32(pRect + 0x0c, 4)
    m.setU32(pObjectsTxt + 7 * 0x1c0 + 0xd0, 2)
    m.setU32(pObjectsTxt + 7 * 0x1c0 + 0xd4, 2)
    expect(OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c(m, pGame, pRoom, pRoomCoords, pRect)).toBe(1)
    m.setU32(pObjectsTxt + 0x2e * 0x1c0 + 0xd0, 2)
    m.setU32(pObjectsTxt + 0x2e * 0x1c0 + 0xd4, 2)
    expect(OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c(m, pGame, pRoom, 0)).toBe(0)
    expect(OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c(m, pGame, pRoom, 0)).toBe(0)

    PATH_SetTargetPos113c(m, pPath, 108, 108)
    OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c(m, pMon, pGame)

    const pTorch = OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c(m, pGame, pRoom, 0x173, 105, 105, 0)
    expect(pTorch).toBeGreaterThan(0)
    expect(m.u32(pTorch + 0x04)).toBe(0x173)

    m.setU32(pObjGroupTxt + 0x20, 83)
    const pShrine = OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c(m, pGame, pRoom, 0x23f, 106, 106, 1)
    expect(pShrine).toBeGreaterThan(0)

    const hits = endVaTrace113c()
    expect(W3B2_PROMOTED_VAS.length).toBe(40)
    for (const va of W3B2_PROMOTED_VAS) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA trace hit for ${formatD2GameHit(va)}`).toBe(true)
    }
  })

  it('verifies all 40 promoted VAs in k2w2-b7 (0x6FCE1F90..0x6FCEB4E0) with VA trace + state assertions', () => {
    const w = createWave5World(0)
    const { m, pGame, pQuestControl } = w
    const { pRoom: pArcaneRoom } = allocRoom(m, 100, 100, 24, 24, 0x4a) // Arcane Sanctuary = 74
    const { pPlayer, pPlayerData, pQuestFlags } = allocPlayer(m, pGame, pArcaneRoom, 0x55, 108, 108)

    const pActForGame = m.alloc(0x80)
    m.setU32(pActForGame + 0x04, pGame)
    const pActForEnv = m.alloc(0x80)
    const pEnv = m.alloc(0x40)
    m.setU32(pActForEnv + 0x04, pEnv)
    m.setU32(pGame + 0xc0, pActForEnv)

    const linkQuest = (id: number) => {
      const pQuest = m.alloc(0x100)
      const pEx = m.alloc(0x100)
      m.setU32(pQuest + 0x00, id)
      m.setU32(pQuest + 0x04, pGame)
      m.setU32(pQuest + 0x18, pEx)
      m.setU32(pQuest + 0xe0, 10)
      m.setU32(pQuest + 0xf4, m.u32(pQuestControl))
      m.setU32(pQuestControl, pQuest)
      return { pQuest, pEx }
    }

    const { pQuest: pQ1 } = linkQuest(8)
    const { pEx: pQ2Ex } = linkQuest(9)
    const { pQuest: pQ3, pEx: pQ3Ex } = linkQuest(0x0a)
    const { pEx: pQ4Ex } = linkQuest(0x0b)
    const { pQuest: pQ6, pEx: pQ6Ex } = linkQuest(0x0d)

    beginVaTrace113c()

    // 0x6FCE1F90 & 0x6FCE2040: Horazon Journal + Portal Open
    m.setU8(pQ4Ex + 0x0f, 1)
    m.setU8(pQ4Ex + 0x10, 0)
    expect(ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(m, pGame)).toBe(1)
    expect(m.u8(pQ4Ex + 0x10)).toBe(1)
    expect(ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(m, pGame)).toBe(0)
    expect(ACT2Q4_IsPortalOpen_6FCE2040_113c(m, pGame)).toBe(0)
    m.setU16(pQ4Ex + 0x40, 2)
    expect(ACT2Q4_IsPortalOpen_6FCE2040_113c(m, pGame)).toBe(1)

    // 0x6FCE2120, 0x6FCE2150, 0x6FCE21A0, 0x6FCE2350..0x6FCE2370
    m.setU8(pQ3Ex + 0x04, 6)
    expect(ACT2Q3_GetAltarState_6FCE2120_113c(m, pActForGame)).toBe(6)
    m.setU8(pQ3Ex + 0x03, 1)
    ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c(m, 1, pGame)
    expect(m.u8(pQ3Ex + 0x03)).toBe(0)
    expect(m.u8(pQ3Ex + 0x02)).toBe(1)
    expect(m.u32(pEnv + 0x30)).toBe(1)
    m.setU8(pQ3 + 0x09, 1)
    m.setU8(pQ3 + 0x0c, 3)
    expect(ACT2Q3_IsEclipseInactive_6FCE21A0_113c(m, pGame)).toBe(0)
    m.setU8(pQ3 + 0x0c, 4)
    expect(ACT2Q3_IsEclipseInactive_6FCE21A0_113c(m, pGame)).toBe(1)
    expect(ACT2Q3_NoOpA_6FCE2350_113c(m)).toBeUndefined()
    expect(ACT2Q3_NoOpB_6FCE2360_113c(m)).toBeUndefined()
    expect(ACT2Q3_NoOpC_6FCE2370_113c(m)).toBeUndefined()

    // 0x6FCE2380, 0x6FCE2450, 0x6FCE2460, 0x6FCE25C0, 0x6FCE25E0
    m.setU32(pQ2Ex + 0x24, 3)
    ACT2Q2_AddStaffCount_6FCE2380_113c(m, pActForGame, 4)
    expect(m.u32(pQ2Ex + 0x24)).toBe(7)
    expect(ACT2Q2_NoOp_6FCE2450_113c(m)).toBeUndefined()
    m.setU8(pQ1 + 0x09, 1)
    m.setU8(pQ1 + 0x0c, 2)
    expect(ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c(m, pGame)).toBe(0)
    m.setU8(pQ1 + 0x0c, 5)
    expect(ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c(m, pGame)).toBe(1)
    expect(ACT2Q0_StatusFilter_6FCE25C0_113c(m)).toBe(0)
    const pStatus = m.alloc(4)
    m.setU8(pStatus, 0x55)
    expect(ACT2Q8_StatusFilter_6FCE25E0_113c(m, 0, pPlayer, 0, 0, pStatus)).toBe(0)
    expect(m.u8(pStatus)).toBe(0)

    // 0x6FCE27C0: ClearNpcIdleTimerOnInteract
    const pQuestArg = m.alloc(0x30)
    const pNpc = m.alloc(0x40)
    m.setU16(pNpc + 0x04, 0x179)
    m.setU32(pQuestArg + 0x00, pGame)
    m.setU32(pQuestArg + 0x08, pNpc)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU8(pQ6Ex, 1)
    m.setU32(pQ6 + 0xa8, 777)
    ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c(m, pQ6, pQuestArg)
    expect(m.u8(pQ6Ex)).toBe(0)
    expect(m.u32(pQ6 + 0xa8)).toBe(0)

    // 0x6FCE27F0, 0x6FCE29C0, 0x6FCE2A90
    const pObj = m.alloc(0x100)
    const pStaticPath = m.alloc(0x30)
    m.setU32(pObj + 0x00, 2)
    m.setU32(pObj + 0x0c, 0x11223344)
    m.setU32(pObj + 0x2c, pStaticPath)
    const pInteractArg = m.alloc(0x10)
    m.setU32(pInteractArg + 0x00, pGame)
    m.setU32(pInteractArg + 0x04, pObj)
    m.setU8(pQ6 + 0x09, 0)
    ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c(m, pInteractArg)
    expect(m.u32(pObj + 0x10)).toBe(2)
    expect(m.u32(pQ6Ex + 0x2c) >>> 0).toBe(0x11223344)

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0a, 9)
    ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c(m, pQ6, pQuestArg)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 9)).toBe(0)

    m.setU8(pQ6 + 0x0c, 2)
    expect(ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 2)).toBe(1)

    // 0x6FCE2AF0, 0x6FCE2F00, 0x6FCE3620, 0x6FCE3970, 0x6FCE3EB0, 0x6FCE44D0, 0x6FCE4550
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 10, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 10, 1)
    const resetMainGuid = () => {
      m.setU32(pQ6 + 0x1c, 0x55)
      m.setU16(pQ6 + 0x9c, 1)
    }
    resetMainGuid()
    ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c(m, pQ6, pQuestArg)
    expect(m.u16(pQ6 + 0x9c)).toBe(0)
    resetMainGuid()
    ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c(m, pQ6, pQuestArg)
    expect(m.u16(pQ6 + 0x9c)).toBe(0)
    resetMainGuid()
    ACT2Q4_Callback10_RemovePlayerGuid_6FCE3620_113c(m, pQ6, pQuestArg)
    expect(m.u16(pQ6 + 0x9c)).toBe(0)
    resetMainGuid()
    m.setU32(pQ6Ex + 0x14, 0x55)
    m.setU16(pQ6Ex + 0x94, 1)
    expect(ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c(m, pQ6, pQuestArg)).toBe(1)
    expect(m.u16(pQ6Ex + 0x94)).toBe(0)
    resetMainGuid()
    ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c(m, pQ6, pQuestArg)
    expect(m.u16(pQ6 + 0x9c)).toBe(0)
    resetMainGuid()
    ACT2Q1_Callback10_RemovePlayerGuid_6FCE44D0_113c(m, pQ6, pQuestArg)
    expect(m.u16(pQ6 + 0x9c)).toBe(0)
    m.setU32(pQ6Ex + 0x00, 0x55)
    m.setU16(pQ6Ex + 0x80, 1)
    expect(ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c(m, pQ6, pQuestArg)).toBe(1)
    expect(m.u16(pQ6Ex + 0x80)).toBe(0)

    // 0x6FCE3190, 0x6FCE32C0, 0x6FCE3510
    expect(ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c(m, pGame, pPlayer)).toBe(0)
    m.setU16(pQ4Ex + 0x40, 1)
    ACT2Q4_InitArcanePortalObject_6FCE32C0_113c(m, pInteractArg)
    expect(m.u32(pObj + 0x10)).toBe(1)
    expect(ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0x0e)).toBe(1)

    // 0x6FCE3EF0, 0x6FCE3FC0, 0x6FCE4170 (use fresh player without quest 0x0A bit 0 set)
    const { pPlayer: pAmuletPlayer } = allocPlayer(m, pGame, pArcaneRoom, 0x56, 108, 108)
    expect(ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c(m, pGame, pAmuletPlayer)).toBe(0)
    expect(m.u32(pQ2Ex + 0x14)).toBe(1)
    expect(ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c(m, pGame, pAmuletPlayer)).toBe(0)
    expect(m.u32(pQ2Ex + 0x14)).toBe(2)
    expect(ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c(m, pAmuletPlayer, pGame)).toBe(1)
    expect(ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c(m, pPlayer, pGame)).toBe(0)

    // 0x6FCE4BD0, 0x6FCE4D90, 0x6FCE4DE0, 0x6FCE5260, 0x6FCE5560
    expect(ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0e)).toBe(1)
    expect(ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0e)).toBe(1)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 0x0d)
    expect(ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x33)
    expect(ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0e)).toBe(1)
    expect(ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0x0e)).toBe(1)

    // 0x6FCEA490, 0x6FCEB1A0, 0x6FCEB420, 0x6FCEB450, 0x6FCEB4E0
    const ppMonReg = m.alloc(5 * 4)
    const pMonRegAct1 = m.alloc(0x300)
    m.setU32(pMonRegAct1 + 0x2d0, 8)
    m.setU32(ppMonReg + 4, pMonRegAct1)
    const { pMon: pEvil, pMonData: pEvilData } = allocMonster(m, pGame, pArcaneRoom, 5, 60)
    m.setU32(pEvilData + 0x58, 1)
    MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c(m, pEvil, ppMonReg)
    expect(m.u32(pMonRegAct1 + 0x2d0)).toBe(7)

    STATES_ToggleGfxStateFlag113c(m, pEvil, 5, 1)
    STATES_ClearGfxStateFlag_6FCEB1A0_113c(m, pEvil, 5, 0)
    expect(STATES_CheckState113c(m, pEvil, 5)).toBe(0)
    expect(STATES_CheckGfxStateFlag113c(m, pEvil, 5)).not.toBe(0)

    m.setU32(pPlayer + 0x10, 3)
    expect(PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c(m, pGame, pPlayer, 0, 1)).toBe(0)
    expect(m.u32(pPlayer + 0x10)).toBe(2)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0a, 50, 0)
    expect(PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c(m, pGame, pPlayer, 0, 1)).toBe(0)
    expect(m.u32(pPlayer + 0x10)).toBe(3)
    m.setU32(pPlayerData + 0x4c, 0x1234)
    expect(PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c(m, pGame, pPlayer, 0, 1)).toBe(0)
    expect(m.u32(pPlayerData + 0x4c)).toBe(0)

    const hits = endVaTrace113c()
    expect(W2B7_PROMOTED_VAS.length).toBe(40)
    for (const va of W2B7_PROMOTED_VAS) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA trace hit for ${formatD2GameHit(va)}`).toBe(true)
    }
  })

  it('verifies all 40 promoted VAs in k2w1-laneH-0x6fc2 (0x6FC21040..0x6FC2C310) with VA trace + state assertions', () => {
    const w = createWave5World(0)
    const {
      m,
      pGame,
      pObjCtrl,
      pDataTables,
      pMonStatsTxt,
      pMonStats2Txt,
      pSkillsTxt,
      pCharStatsTxt,
      pUniqueItemsTxt,
      pOverlayTxt,
      pMonLvlTxt,
      pMonTypeNest,
      pSkillCode,
    } = w
    const { pRoom } = allocRoom(m, 50, 50, 100, 100, 2)
    const { pPlayer, pPlayerData } = allocPlayer(m, pGame, pRoom, 77, 100, 100)

    beginVaTrace113c()

    // 0x6FC21040 & 0x6FC21670: gold guarded set/add
    STATLIST_SetUnitStatGoldGuarded_6FC21040_113c(m, pPlayer, 14, 50000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(50000)
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 14, 25000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(75000)
    STATLIST_AddUnitStatGoldGuarded_6FC21670_113c(m, pPlayer, 14, 30000)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 14, 0)).toBe(0) // > 10 * 10000 cap zeroes gold

    // 0x6FC210A0, 0x6FC216F0, 0x6FC21AE0, 0x6FC21E90, 0x6FC21830, 0x6FC21720
    expect(CHARSTATS_GetRecordPtrFast_6FC210A0_113c(m, 2)).toBe((pCharStatsTxt + 2 * 0xc4) >>> 0)
    expect(UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c(m, 9)).toBe((pUniqueItemsTxt + 9 * 0x14c) >>> 0)
    expect(OVERLAY_GetRecordPtrFast_6FC21AE0_113c(m, 4)).toBe((pOverlayTxt + 4 * 0x3c) >>> 0)
    expect(MONLVL_GetRecordPtrFast_6FC21E90_113c(m, 20)).toBe((pMonLvlTxt + 20 * 0x78) >>> 0)
    m.setU16(pDataTables + 0xae0 + 4 * 2, 0x4567)
    expect(DATATBLS_GetTableWordAE0_6FC21830_113c(m, 4)).toBe(0x4567)
    m.setU32(pPlayerData + 0x1c, 0x40021000)
    expect(PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(m, pPlayer, pGame)).toBe(0x40021000)

    // 0x6FC21160: 64-bit LCG step
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 1)
    m.setU32(pSeed + 4, 0x29a)
    expect(SEED_StepSeed64Fast_6FC21160_113c(m, pSeed)).toBe((0x6ac690c5 + 0x29a) >>> 0)

    // 0x6FC21620, 0x6FC22790, 0x6FC218E0, 0x6FC21D30
    m.setU32(pMonTypeNest + (5 * 2 + 1) * 4, 1 << 5)
    expect(MONTYPE_TestNestedBit_6FC21620_113c(m, 37, 5)).toBe(1 << 5)
    const { pMon: pMon10, pAiGen: pAiGen10 } = allocMonster(m, pGame, pRoom, 10, 10)
    m.setU16(pMonStatsTxt + 10 * 0x1a8 + 0x1c, 37)
    expect(MONSTER_TestUnitMonTypeFlag_6FC22790_113c(m, pMon10, 5)).toBe(1 << 5)
    expect(MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, pMon10)).toBe(pAiGen10)
    m.setU16(pMonStatsTxt + 10 * 0x1a8 + 0x04, 11)
    expect(MONSTATS_FollowSubClassChain_6FC21D30_113c(m, 10, 1)).toBe(11)

    // 0x6FC21740, 0x6FC21A40, 0x6FC21A90, 0x6FC21B10, 0x6FC21B90..0x6FC21EF0
    const rec25 = pSkillsTxt + 25 * 0x23c
    m.setU16(rec25 + 0x12c, 30)
    m.setU32(rec25 + 0x148, 10)
    m.setU32(rec25 + 0x14c, 2)
    m.setU32(rec25 + 0x150, 20)
    m.setU32(rec25 + 0x154, 3)
    m.setU32(rec25 + 0x158, 30)
    m.setU32(rec25 + 0x15c, 4)
    m.setU32(rec25 + 0x160, 40)
    expect(SKILLS_GetMaxSkillLevel_6FC21740_113c(m, 25)).toBe(30)
    expect(SKILLS_GetParam1Fast_6FC21B90_113c(m, 25)).toBe(10)
    expect(SKILLS_GetParam2Fast_6FC21BC0_113c(m, 25)).toBe(2)
    expect(SKILLS_GetParam3Fast_6FC21BF0_113c(m, 25)).toBe(20)
    expect(SKILLS_GetParam4Fast_6FC21C20_113c(m, 25)).toBe(3)
    expect(SKILLS_GetParam5Fast_6FC21C50_113c(m, 25)).toBe(30)
    expect(SKILLS_GetParam6Fast_6FC21EC0_113c(m, 25)).toBe(4)
    expect(SKILLS_GetParam7Fast_6FC21EF0_113c(m, 25)).toBe(40)
    expect(SKILLS_EvalLinearParam12_6FC21B10_113c(m, 25, 3)).toBe(14)
    expect(SKILLS_EvalLinearParam34_6FC21A40_113c(m, 25, 3)).toBe(26)
    expect(SKILLS_EvalLinearParam56_6FC21A90_113c(m, 25, 3)).toBe(38)

    // 0x6FC22130, 0x6FC22180, 0x6FC224B0, 0x6FC225F0, 0x6FC22740: Storm containers
    const pDefList = m.alloc(12)
    STORM_TSListInitDefault_6FC224B0_113c(m, pDefList)
    expect(m.u32(pDefList)).toBe(0xdddddddd)
    const pProto = m.alloc(12)
    m.setU32(pProto, 8)
    const pBkt = m.alloc(12)
    STORM_TSListInitFromPrototype_6FC22740_113c(m, pBkt, pProto)
    expect(m.u32(pBkt)).toBe(8)
    const pHT = m.alloc(0x30)
    m.setU32(pHT + 0x1c, pBkt)
    m.setU32(pHT + 0x24, 0)
    const pEntry = m.alloc(0x18)
    m.setU32(pEntry, 7)
    const term = (pBkt + 4) >>> 0
    m.setU32(pBkt + 8, pEntry)
    m.setU32(pBkt + 4, (pEntry + 8) >>> 0)
    m.setU32(pEntry + 8, term)
    m.setU32(pEntry + 0x0c, (~term) >>> 0)
    expect(STORM_TSHashTableLookup_6FC22130_113c(m, pHT, 7)).toBe(pEntry)
    STORM_TSListUnlinkAll_6FC22180_113c(m, pBkt)
    expect(STORM_TSHashTableLookup_6FC22130_113c(m, pHT, 7)).toBe(0)
    const pArr = m.alloc(0x14)
    expect(STORM_TSArrayCalcChunkSize_6FC225F0_113c(m, 21, pArr)).toBe(21)
    expect(m.u32(pArr + 0x0c)).toBe(21)

    // 0x6FC2B470: IEEE 802.3 CRC-32 ("123456789" -> 0xCBF43926)
    const pCrcBuf = m.alloc(16)
    for (let i = 0; i < 9; i++) m.setU8(pCrcBuf + i, '123456789'.charCodeAt(i))
    expect(CHECKSUM_ComputeCrc32_6FC2B470_113c(m, pCrcBuf, 9)).toBe(0xcbf43926)

    // 0x6FC2B670, 0x6FC2B700, 0x6FC2B800: OBJRGN spacing + prepend
    const pRgn1 = m.alloc(0x100)
    m.setU32(pObjCtrl + 4 + 0x48, pRgn1)
    m.setU32(pRgn1 + 0x14, 1)
    m.setU32(pRgn1 + 0x40, 500)
    m.setU32(pRgn1 + 0x44, 600)
    expect(OBJRGN_CheckCoordSpacing40_6FC2B670_113c(m, pGame, 1, 520, 700)).toBe(0)
    expect(OBJRGN_CheckCoordSpacing40_6FC2B670_113c(m, pGame, 1, 560, 660)).toBe(1)
    m.setU32(pRgn1 + 0x18, 1)
    m.setU32(pRgn1 + 0x20, 1000)
    m.setU32(pRgn1 + 0x24, 2000)
    expect(OBJRGN_CheckCoordSpacing20_6FC2B700_113c(m, pGame, 1, 950, 2200)).toBe(0)
    expect(OBJRGN_CheckCoordSpacing20_6FC2B700_113c(m, pGame, 1, 1100, 2100)).toBe(1)
    OBJRGN_PrependObjectCoordNode_6FC2B800_113c(m, pGame, pPlayer, 0xaa)
    expect(m.u32(m.u32(pObjCtrl + 0x1110))).toBe(0xaa)

    // 0x6FC2BE20, 0x6FC2BEE0, 0x6FC2C000, 0x6FC2C110, 0x6FC2C170, 0x6FC2C1F0, 0x6FC2C310
    m.setU32(pSkillsTxt + 80 * 0x23c + 0x158, 40)
    const pBmSub = STATLIST_AllocList113c(m, 0, 0, 0, 1)
    STATLIST_SetState113c(m, pBmSub, 0x72)
    STATLIST_SetSkillId113c(m, pBmSub, 80)
    STATLIST_MergeStatLists113c(m, pPlayer, pBmSub, 1)
    expect(SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c(m, pPlayer, 50 << 8)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0)).toBe(250 << 8)

    m.setU8(pSkillCode + 0, 7)
    m.setU8(pSkillCode + 1, 45)
    m.setU8(pSkillCode + 2, 0)
    m.setU32(pSkillsTxt + 90 * 0x23c + 0x138, 0)
    const pSubSkill = m.alloc(0x40)
    SKILLS_SetUsedSkillMemPort113c(m, pMon10, pSubSkill)
    expect(SKILLS_SrvSt59_Submerge_6FC2BEE0_113c(m, pGame, pMon10, 90, 1)).toBe(1)
    expect(m.get(pSubSkill, D2SkillStrc.dwParam1)).toBe(145)

    expect(SKILLS_CanMonsterBeImpregnated_6FC2C110_113c(m, pMon10)).toBe(1)
    m.setU32(pMon10 + 0x10, 0x0c)
    m.setU16(pSkillsTxt + 120 * 0x23c + 0xbc, 310)
    m.setU8(pSkillsTxt + 120 * 0x23c + 0xbf, 8)
    const pImpSub = STATLIST_AllocList113c(m, 0, 0, 0, 1)
    STATLIST_SetSkillId113c(m, pImpSub, 120)
    const spawns: MonsterCreateSpawnArgs113c[] = []
    STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c(m, pMon10, 0x6e, pImpSub, {
      regpop: {
        onMonsterCreate: (_mem, args) => {
          spawns.push(args)
          return 1
        },
      },
    })
    expect(spawns.length).toBe(1)
    expect(spawns[0]!.nClassId).toBe(310)

    const { pMon: pFollower, pPath: pFollowerPath } = allocMonster(m, pGame, pRoom, 21, 43, 60, 60)
    m.setU32(pFollower + 0x94, 0)
    m.setU32(pFollower + 0x98, 77)
    m.setU32(pFollower + 0xc8, 0x400)
    expect(SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c(m, pGame, pFollower, 0, 1)).toBe(1)
    expect(m.u16(pFollowerPath + 0x02)).toBe(100)
    expect(m.u16(pFollowerPath + 0x06)).toBe(100)

    m.setU16(pMonStatsTxt + 15 * 0x1a8 + 0x18, 15)
    m.setU8(pMonStats2Txt + 15 * 0x134 + 0x04, 0x80)
    const pPlrAlign = STATLIST_AllocList113c(m, 0, 0, 0, 1)
    STATLIST_SetState113c(m, pPlrAlign, 0x69)
    STATLIST_SetStat113c(m, pPlrAlign, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pPlayer, pPlrAlign, 1)
    const { pMon: pCorpse, pAiGen: pCorpseAi } = allocMonster(m, pGame, pRoom, 15, 99, 103, 102)
    m.setU32(pCorpse + 0x10, 0x0c)
    m.setU32(pCorpseAi + 0x0c, 0xffffffff)
    m.setU32(pRoom + 0x74, pCorpse)
    expect(SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c(m, pPlayer, pGame, 10)).toBe(pCorpse)

    const { pMon: pLdr, pPath: pLdrPath, pAiGen: pLdrAi } = allocMonster(m, pGame, pRoom, 20, 88, 95, 95)
    const { pMon: pMnn, pAiGen: pMnnAi } = allocMonster(m, pGame, pRoom, 21, 89, 96, 96)
    PATH_SetTargetUnit113c(m, pLdrPath, pPlayer)
    const pMNode = m.alloc(0x10)
    m.setU32(pMNode, 89)
    m.setU16(pLdrAi + 0x08, 1)
    m.setU32(pLdrAi + 0x28, pGame)
    m.setU32(pLdrAi + 0x2c, 88)
    m.setU32(pLdrAi + 0x30, 1)
    m.setU32(pLdrAi + 0x34, pMNode)
    m.setU32(pMnnAi + 0x28, pGame)
    m.setU32(pMnnAi + 0x2c, 88)
    m.setU32(pSkillsTxt + 140 * 0x23c + 0x138, 0)
    m.setU16(pSkillsTxt + 140 * 0x23c + 0x4e, 15)
    expect(SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c(m, pGame, pLdr, 140, 1)).toBe(1)
    expect(m.u32(pMnnAi + 0x20)).not.toBe(0)
    void pMnn

    const hits = endVaTrace113c()
    expect(LANEH_PROMOTED_VAS.length).toBe(40)
    for (const va of LANEH_PROMOTED_VAS) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA trace hit for ${formatD2GameHit(va)}`).toBe(true)
    }
  })

  it('verifies 1.13c disassembly-fix regressions in k2-w5b1-113c.ts and k2-w3b2-113c.ts', () => {
    // Regression 1 (k2-w5b1): 0x6FC583A0 resolves killer owner via pAiGeneral+0x28 (PvP minion skips exp penalty)
    {
      const w = createWave5World(2) // Hell difficulty
      const { m, pGame } = w
      const { pRoom } = allocRoom(m)
      const { pPlayer: pVictim } = allocPlayer(m, pGame, pRoom, 10, 106, 106)
      const { pPlayer: pKillerOwner } = allocPlayer(m, pGame, pRoom, 20, 107, 107)
      const { pMon: pKillerMinion, pAiGen: pKillerAiGen } = allocMonster(m, pGame, pRoom, 5, 30, 107, 106)
      m.setU32(pKillerAiGen + 0x28, pGame) // pOwnerGame
      m.setU32(pKillerAiGen + 0x2c, 20) // owner GUID = pKillerOwner
      m.setU32(pKillerAiGen + 0x30, 0) // UNIT_PLAYER
      STATLIST_SetUnitStat113c(m, pVictim, 0x0d, 500000, 0)
      beginVaTrace113c()
      PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c(m, pVictim, pGame, pKillerMinion)
      const hits = endVaTrace113c()
      // PvP death via player-owned minion skips PLAYER_ApplyDeathExpPenalty (0x6FC57730)
      expect(hits.has(formatD2GameHit(0x6fc57730))).toBe(false)
      expect(STATLIST_GetUnitStat113c(m, pVictim, 0x0d, 0)).toBe(500000)
      void pKillerOwner
    }

    // Regression 2 (k2-w5b1): 0x6FC651B0 routes to-hit roll through canonical SUNITDMG_RollMeleeToHitAndBlock (0x6FCFE5A0)
    {
      const w = createWave5World()
      const { m, pGame, pSkillsTxt } = w
      const { pRoom } = allocRoom(m)
      const { pPlayer } = allocPlayer(m, pGame, pRoom, 10, 106, 106)
      const { pMon: pDef } = allocMonster(m, pGame, pRoom, 5, 11, 107, 106)
      const pSk = pSkillsTxt + 4 * 0x23c
      m.setU16(pSk + 0x12e, 0) // bit 0 clear -> forces to-hit roll via 0x6FCFE5A0
      beginVaTrace113c()
      SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c(m, 4, pPlayer, pDef, pGame, 10, pSk, 1)
      const hits = endVaTrace113c()
      expect(hits.has(formatD2GameHit(0x6fcfe5a0))).toBe(true)
    }

    // Regression 3 (k2-w5b1): 0x6FC2D680 sets perpendicular target (-dy, +dx) on spawned missile
    {
      const w = createWave5World()
      const { m, pGame, pSkillsTxt, pMissilesTxt } = w
      const { pRoom } = allocRoom(m)
      const { pPlayer, pPath } = allocPlayer(m, pGame, pRoom, 10, 106, 106)
      const skId = 12
      m.setU16(pSkillsTxt + skId * 0x23c + 0x48, 3) // wSrvMissileA = 3
      m.setU32(pMissilesTxt + 3 * 0x1a4 + 0x10, 10)
      PATH_SetTargetPos113c(m, pPath, 111, 109) // dx = +5, dy = +3 -> perp target (-3, +5)
      const res = SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c(m, pGame, pPlayer, skId, 1)
      expect(res).toBe(1)
      const pMisHead = m.u32(pRoom + 0x74)
      expect(pMisHead).toBeGreaterThan(0)
      expect(MISSILE_GetTargetX113c(m, pMisHead)).toBe(-3)
      expect(MISSILE_GetTargetY113c(m, pMisHead)).toBe(5)
    }

    // Regression 4 (k2-w3b2): 0x6FC3F2D0 applies baseId 0x44 / 0x21F, class 0x138, and 0xDEADDEAD flags
    {
      const w = createWave5World()
      const { m, pGame, pMonStatsTxt } = w
      const { pRoom } = allocRoom(m)
      const { pMon: pM44, pAiGen: pAi44 } = allocMonster(m, pGame, pRoom, 0x44, 1)
      const { pMon: pM138, pMonData: pData138 } = allocMonster(m, pGame, pRoom, 0x138, 2)
      m.setU16(pMonStatsTxt + 0x44 * 0x1a8 + 0x02, 0x44)
      const pPre = m.alloc(0x60)
      m.setU32(pPre + 0x4c, 0xdeaddead)
      m.setU32(pPre + 0x50, 3) // both bits 1 and 2
      MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c(m, pM44, pGame, pPre)
      expect(m.u32(pAi44 + 0x1c) >>> 0).toBe(0xdeaddead)
      expect((m.u32(pM44 + 0xc4) & 0x04020000) >>> 0).toBe(0x04020000)
      m.setU32(pPre + 0x4c, 0x2a)
      m.setU32(pPre + 0x50, 0)
      MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c(m, pM138, pGame, pPre)
      expect(m.u8(pData138 + 0x0e)).toBe(0x2a)
      expect(m.u8(pData138 + 0x0f)).toBe(0x2a)
    }

    // Regression 5 (k2-w3b2): 0x6FC41BE0 Stone Skin (0x1C) doubles defense + 2-immunity cap
    {
      const w = createWave5World()
      const { m, pGame } = w
      const { pRoom } = allocRoom(m)
      const { pMon } = allocMonster(m, pGame, pRoom, 5, 1)
      STATLIST_SetUnitStat113c(m, pMon, 0x1f, 120, 0) // base AC = 120
      STATLIST_SetUnitStat113c(m, pMon, 0x27, 100, 0) // Fire immune (#1)
      STATLIST_SetUnitStat113c(m, pMon, 0x29, 100, 0) // Lightning immune (#2)
      MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, pMon, 0x1c, 1)
      expect(STATLIST_GetUnitStat113c(m, pMon, 0x1f, 0)).toBe(240) // doubled defense
      // Physical resist (0x24) is NOT raised because monster already has 2 immunities
      expect(STATLIST_GetUnitStat113c(m, pMon, 0x24, 0)).toBe(0)
    }

    // Regression 6 (k2-w3b2): 0x6FC42BC0 / 0x6FC42D00 baseId 0x76 halves damage only; 0x6FC42DA0 velocity & exp*3/5
    {
      const w = createWave5World()
      const { m, pGame, pMonStatsTxt, pMonUModTxt } = w
      const { pRoom } = allocRoom(m)
      const { pMon } = allocMonster(m, pGame, pRoom, 0x76, 1)
      m.setU16(pMonStatsTxt + 0x76 * 0x1a8 + 0x02, 0x76)
      m.setU16(pMonStatsTxt + 0x76 * 0x1a8 + 0x32, 8) // wVelocity = 8
      m.setU32(pMonUModTxt + 0x0f * 0x20 + 0x1c, 100) // boss dmg = 100
      m.setU32(pMonUModTxt + 0x0d * 0x20 + 0x1c, 100) // boss toHit = 100
      MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c(m, pMon, 5, 1)
      expect(STATLIST_GetUnitStat113c(m, pMon, 0x19, 0)).toBe(50) // halved for baseId 0x76
      expect(STATLIST_GetUnitStat113c(m, pMon, 0x77, 0)).toBe(100) // toHit NOT halved

      STATLIST_SetUnitStat113c(m, pMon, 0x0d, 1000, 0)
      MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, pMon, 0x25, 1)
      expect(STATLIST_GetUnitStat113c(m, pMon, 0x0d, 0)).toBe(600) // 1000 - 2*(1000/5)
      // wVel=8 -> trunc(0x800/8) - 0x80 = 256 - 128 = 128 -> clamped to 0x64 (100)
      expect(STATLIST_GetUnitStat113c(m, pMon, 0x43, 0)).toBe(0x64)
    }

    // Regression 7 (k2-w3b2): 0x6FC43100 checks bEnabled (+0x06), wVersion (+0x04), bFPick 1/2/3
    {
      const w = createWave5World()
      const { m, pGame, pMonUModTxt } = w
      const { pRoom } = allocRoom(m)
      const { pMon } = allocMonster(m, pGame, pRoom, 5, 1)
      const pRec = pMonUModTxt + 8 * 0x20
      m.setU8(pRec + 0x06, 0)
      expect(MONUMOD_CheckModEligibility_6FC43100_113c(m, pMon, pRec, 1)).toBe(0)
      m.setU8(pRec + 0x06, 1)
      m.setU16(pRec + 0x04, 100) // expansion-only
      expect(MONUMOD_CheckModEligibility_6FC43100_113c(m, pMon, pRec, 0)).toBe(0)
      expect(MONUMOD_CheckModEligibility_6FC43100_113c(m, pMon, pRec, 1)).toBe(1)
    }

    // Regression 8 (k2-w3b2): 0x6FC43E20 frees type-2 events (+0x24) and reschedules event 7 on 0x3C01 collision
    {
      const w = createWave5World()
      const { m, pGame, pMonStatsTxt } = w
      const { pRoom, pCollMap } = allocRoom(m, 100, 100, 20, 20, 2)
      const { pMon } = allocMonster(m, pGame, pRoom, 5, 1, 105, 105)
      m.setU32(pMon + 0x10, 0x0c) // dead
      m.setU16(pMonStatsTxt + 5 * 0x1a8 + 0x56, 3) // aipar1 = 3 -> +31 frames
      EVENT_SetEventFull113c(m, pGame, pMon, 2, 120, 0, 0, 0)
      // Set collision bit 0x0001 at (105, 105) -> local (5, 5)
      m.setU16(pCollMap + (5 * 20 + 5) * 2, 1)
      expect(MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c(m, pGame, pMon)).toBe(1)
      // Verify event 7 was scheduled at frame 100 + 3*10 + 1 = 131
      let foundEvent7 = false
      let pEv = m.u32(pMon + 0xdc)
      while (pEv !== 0) {
        if (m.u8(pEv) === 7 && m.u32(pEv + 0x04) === 131) foundEvent7 = true
        expect(m.u8(pEv)).not.toBe(2) // type-2 event was freed
        pEv = m.u32(pEv + 0x24)
      }
      expect(foundEvent7).toBe(true)
    }

    // Regression 9 (k2-w3b2): 0x6FC46320 Scarab < 10 frame cooldown clears bFlags&0xFE; >= 10 sets |1 and writes dwCurFrame
    {
      const w = createWave5World()
      const { m, pGame } = w
      const { pRoom } = allocRoom(m)
      const { pMon, pMonData } = allocMonster(m, pGame, pRoom, 5, 1)
      m.setU8(pMonData + 0x17, 0x03)
      m.setU32(pMonData + 0x18, 95) // |100 - 95| = 5 < 10
      const guidsBefore = m.u32(pGame + 0x9c)
      MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(m, pGame, pMon, undefined, 1)
      expect(m.u32(pGame + 0x9c)).toBe(guidsBefore) // suppressed
      expect(m.u8(pMonData + 0x17)).toBe(0x02) // bit 0 cleared

      // bTrigger == 0 is immediate no-op
      m.setU32(pMonData + 0x18, 50)
      MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(m, pGame, pMon, undefined, 0)
      expect(m.u32(pGame + 0x9c)).toBe(guidsBefore)
    }

    // Regression 10 (k2-w3b2): 0x6FC472C0 invokes canonical 0x6FCBED70 ring scan callback; 0x6FC4AAE0 asserts 0x112E;
    // 0x6FC50150 / 0x6FC50800 assert 0x9D7 / 0x955 on density > 0x80
    {
      const w = createWave5World()
      const { m, pGame } = w
      const { pRoom } = allocRoom(m)
      const { pPlayer: pAttacker } = allocPlayer(m, pGame, pRoom, 1, 108, 108)
      const pAttAlign = STATLIST_AllocList113c(m, 0, 0, 0, 1)
      STATLIST_SetState113c(m, pAttAlign, 0x69)
      STATLIST_SetStat113c(m, pAttAlign, 0xac, 2, 0)
      STATLIST_MergeStatLists113c(m, pAttacker, pAttAlign, 1)
      const { pMon: pMon2 } = allocMonster(m, pGame, pRoom, 5, 2, 108, 108)
      m.setU32(pMon2 + 0xc4, 0x0c) // UNITFLAG_CANBEATTACKED | UNITFLAG_TARGETABLE
      m.setU32(pRoom + 0x74, pMon2)
      const pSkill = m.alloc(0x40)
      SKILLS_SetParam3113c(m, pSkill, 6)
      SKILLS_SetParam4113c(m, pSkill, -1)
      beginVaTrace113c()
      const found = SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c(m, pGame, pAttacker, pSkill)
      const hits = endVaTrace113c()
      expect(found).toBe(pMon2)
      expect(hits.has(formatD2GameHit(0x6fcbed70))).toBe(true)

      // 0x6FC4AAE0 uses STORM_TSHashTableLookup (0x6FC22130), reads lock at pGame + 0x18, and asserts 0x112E
      const pGameTable = m.alloc(0x40)
      const pGameBkt = m.alloc(12)
      const bktTerm = (pGameBkt + 4) >>> 0
      m.setU32(pGameBkt + 0x00, 8)
      m.setU32(pGameBkt + 0x04, (pGame + 8) >>> 0)
      m.setU32(pGameBkt + 0x08, pGame)
      m.setU32(pGame + 0x00, 1) // hash key = 1
      m.setU32(pGame + 0x08, bktTerm)
      m.setU32(pGame + 0x0c, (~bktTerm) >>> 0)
      m.setU32(pGame + 0x18, 0) // null lock -> assert 0x112E
      m.setU32(pGameTable + 0x1c, pGameBkt)
      m.setU32(pGameTable + 0x24, 0) // mask = 0
      m.setU32(0x6fd31c24, pGameTable)
      expect(() => GAME_LookupAndLockGameByKey_6FC4AAE0_113c(m, 1)).toThrow(D2CommonAssertError)
      const pLock = m.alloc(0x20)
      m.setU32(pGame + 0x18, pLock)
      expect(GAME_LookupAndLockGameByKey_6FC4AAE0_113c(m, 1)).toBe(pGame)
      expect(m.u32(pLock)).toBe(1)

      // Density > 0x80 asserts on Crate (0x9D7) and Barrel (0x955) cluster populators
      expect(() => OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c(m, pGame, pRoom, 0x81)).toThrow(
        D2CommonAssertError,
      )
      expect(() => OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c(m, pGame, pRoom, 0x81)).toThrow(
        D2CommonAssertError,
      )
    }
  })
})
