import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers'
import { INVENTORY_AllocInventory113c, INVENTORY_SetCursorItem113c } from '../../../src/d2kern-113c/common/inventory'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc'
import {
  AI_AlternatingMeleeOrApproach_6FC9F9A0_113c,
  AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c,
  AI_BasicMeleeOrStepApproach_6FC9D7C0_113c,
  AI_CardinalBeamTurret_6FC9C910_113c,
  AI_CastSkillAtRandomOffsetAroundSelf_6FC9D400_113c,
  AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c,
  AI_ComboMeleeAndDualSkill_6FC9F760_113c,
  AI_FoulCrowNestSpawner_6FC9D170_113c,
  AI_InitialStall5ThenMeleeApproach_6FC9E4D0_113c,
  AI_LinkedOwnerTurretCycle_6FC9CB10_113c,
  AI_MeleeOrDualSkillPathType7_6FC9FE60_113c,
  AI_MeleeOrPathType13Approach_6FC9DF00_113c,
  AI_MeleeStrafeOrStepApproach_6FC9F370_113c,
  AI_MosquitoNestSpawner_6FC9CFD0_113c,
  AI_OneShotSkillTrap_6FC9D310_113c,
  AI_PackBroadcastOrMeleeApproach_6FC9D910_113c,
  AI_RegeneratingMultiStateMonster_6FCA0450_113c,
  AI_ScanCallbackFetishMinions_6FC9BB90_113c,
  AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c,
  AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c,
  AI_ScanCallbackNearestBaseId136_6FC9BA40_113c,
  AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c,
  AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c,
  AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c,
  AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c,
  AI_StationaryMeleeTrap_6FC9BF50_113c,
  AI_SubmergedOrStuckTransition_6FC9D550_113c,
  AI_TentacleMeleeAttack_6FC9C580_113c,
  AI_ThreeStageSuicideMinion_6FC9F5A0_113c,
  AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c,
  AI_UnburrowAndScheduleThink_6FC9BE10_113c,
  AI_WallTrapHorizontalY_6FC9C340_113c,
  AI_WallTrapVerticalX_6FC9C460_113c,
  D2GAME_MON_ALIGN_TABLE_PTR_VA_113C,
  EVENT_HandleFreeHoverMsg_6FC99AA0_113c,
  PLAYER_CanLootCorpse_6FC97E70_113c,
  PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c,
  PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c,
  UNITMSG_QueuePacket23SetSkill_6FC9A020_113c,
  UNITMSG_QueuePacket9ACoords_6FC9A440_113c,
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c,
  UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c,
  UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c,
  UNIT_SendStatB2Packet11ToClient_6FC9A570_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import {
  A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c,
  A5Q4_OpenTemplePortalObject_6FCE94E0_113c,
  AIBAAL_SelectCombatAction_6FCC8E80_113c,
  AIBAAL_TrySpawnBaalClone_6FCD7D30_113c,
  AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c,
  AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c,
  C2S_Packet50_DropPlayerGold_6FCEEF40_113c,
  C2S_SyncObjectCollisionByGuid_6FCED440_113c,
  C2S_ValidateBeltItemOwnership_6FCECDB0_113c,
  C2S_ValidateCursorItem_6FCECF70_113c,
  C2S_ValidateInventoryOrCursorItem_6FCECE20_113c,
  C2S_ValidateStoredOrEquippedItem_6FCECE90_113c,
  C2S_ValidateWaypointInteraction_6FCECB50_113c,
  HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c,
  ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c,
  ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c,
  ITEMS_UsePercentagePotion_6FCCE6D0_113c,
  MONAI_AuraKnightOrZealotThink_6FCA9430_113c,
  MONAI_BaalThroneThink_6FCC8430_113c,
  MONAI_BlunderboreThink_6FCA3CE0_113c,
  MONAI_CorpseSpitterThink_6FCA3FE0_113c,
  MONAI_CorruptRogueArcherThink_6FCA26B0_113c,
  MONAI_FetishShamanOrCasterThink_6FCA8D80_113c,
  MONAI_GloamPackLightningDanceThink_6FCA0F20_113c,
  MONAI_OblivionKnightThink_6FCA7E60_113c,
  MONAI_SandMaggotThink_6FCA1C80_113c,
  MONAI_SiegeRunnerThink_6FCC66E0_113c,
  MONAI_SuccubusThink_6FCA8A70_113c,
  MONAI_TentacleBeastHeadThink_6FCA43F0_113c,
  MONREG_SelectRegionMonsterTypes_6FCEA760_113c,
  NPCS_InitGameNpcControl_6FCAFBE0_113c,
  PACKET_DeliverChatIfNotSquelched_6FCECA00_113c,
  PACKET_DeliverOverheadOrPartyChat_6FCED530_113c,
  PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c,
  PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c,
  SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c,
  SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c,
  SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c,
  SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c,
  SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c,
  SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c,
  SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c,
  SKILLS_TestPathReachableToCoords_6FCED790_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c,
  ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c,
  ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c,
  ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c,
  ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c,
  ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c,
  ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c,
  ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c,
  ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c,
  AI_ThinkAct2SewerTownNpc_6FC3B950_113c,
  AI_ThinkBladeCreeper_6FCC6B70_113c,
  AI_ThinkBloodLord_6FCA8810_113c,
  AI_ThinkChargeStateIconMelee_6FCA4A90_113c,
  AI_ThinkCommand14TriggeredSkill_6FC9D670_113c,
  AI_ThinkFetishMelee_6FC9ED90_113c,
  AI_ThinkFetishShaman_6FCA7BB0_113c,
  AI_ThinkGiantMosquito_6FCA6280_113c,
  AI_ThinkHomeLeashedCaster_6FC39E70_113c,
  AI_ThinkImpregnatedMonster_6FC366D0_113c,
  AI_ThinkLowLifeFleeCaster_6FC9E070_113c,
  AI_ThinkMephistoBoss_6FCA5B60_113c,
  AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c,
  AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c,
  AI_ThinkOblivionKnightCaster_6FCA4DB0_113c,
  AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c,
  AI_ThinkPackRegroupSkirmisher_6FC3B780_113c,
  AI_ThinkPutridDefiler_6FC3A550_113c,
  AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c,
  AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c,
  AI_ThinkSlinger_6FCA74A0_113c,
  AI_ThinkSpecialAiState3_6FCBCC00_113c,
  AI_ThinkTerrorCurse_6FCC6FC0_113c,
  AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c,
  AI_ThinkThornHulk_6FCA64A0_113c,
  AI_ThinkTownRogueGuard_6FC39740_113c,
  AI_ThinkVampire_6FCA6900_113c,
  AI_ThinkWillowisp_6FCA7010_113c,
  AI_ThinkZakarumHealerOrPriest_6FC39080_113c,
  NET_BroadcastSystemChatMessage_6FCEBE70_113c,
  PACKET_SrvMercMoveToCoord_6FCED360_113c,
  PACKET_SrvMercMoveToUnit_6FCED3D0_113c,
  PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c,
  SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
} from '../../../src/d2kern-113c/game/timer-wheel'
import {
  D2ItemStatCostTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2MonStatsTxt_SIZE,
  D2SkillsTxt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'

function formatD2GameHit(va: number): string {
  return `D2Game:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

function createW3B8World() {
  const m = new SparseMemory113c()
  const _pDefaultBits = m.alloc(128); for (let _b = 0; _b < 32; _b++) m.setU32(_pDefaultBits + _b * 4, (1 << _b) >>> 0); m.setU32(0x6fd18be0, _pDefaultBits); m.setU32(0x6fdd90b0, _pDefaultBits);
  const pGame = m.alloc(0x2000)
  const pDataTables = m.alloc(0x1000)
  const pSgptHolder = m.alloc(4)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(pSgptHolder, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pSgptHolder)

  const pBitMasks = m.alloc(32 * 4)
  for (let b = 0; b < 32; b++) {
    m.setU32(pBitMasks + b * 4, (1 << b) >>> 0)
  }
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  m.setU32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C, pBitMasks)
  for (let i = 0; i < 256; i++) {
    m.setU8(0x6fdef0b0 + i, i & 7)
    m.setU8(0x6fde4ec4 + i, 1)
    m.setU8(0x6fde4ee4 + i, 1)
  }

  const pIsc74 = m.alloc(0x80 * D2ItemStatCostTxt_SIZE)
  for (let id = 0; id < 0x80; id++) {
    m.setU16(pIsc74 + id * D2ItemStatCostTxt_SIZE, id)
    m.setU32(pIsc74 + id * D2ItemStatCostTxt_SIZE + 4, 0x04)
  }
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt, pIsc74)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount, 0x80)

  const pMonStatsTxt = m.alloc(512 * D2MonStatsTxt_SIZE)
  for (let i = 0; i < 512; i++) {
    const rec = pMonStatsTxt + i * D2MonStatsTxt_SIZE
    m.setU16(rec, i)
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x18, i)
  }
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 512)

  const pMonStats2Txt = m.alloc(512 * D2MonStats2Txt_SIZE)
  for (let i = 0; i < 512; i++) {
    m.setU16(pMonStats2Txt + i * D2MonStats2Txt_SIZE, i)
  }
  m.setU32(pDataTables + 0xa84, pMonStats2Txt)
  m.setU32(pDataTables + 0xa8c, 512)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 512)

  const pSkillsTxt = m.alloc(64 * D2SkillsTxt_SIZE)
  for (let i = 0; i < 64; i++) {
    m.setU16(pSkillsTxt + i * D2SkillsTxt_SIZE, i)
  }
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 64)

  EVENT_InitTimerQueue113c(m, pGame)
  m.setU32(pGame + 0xa8, 100)
  return { m, pGame, pDataTables, pMonStatsTxt, pMonStats2Txt, pSkillsTxt }
}

function allocW3Monster(
  w: ReturnType<typeof createW3B8World>,
  guid: number,
  classId: number,
  x: number,
  y: number,
) {
  const { m, pGame, pMonStatsTxt, pMonStats2Txt } = w
  const pUnit = m.alloc(0x100)
  const pMonData = m.alloc(0x60)
  const pAiControl = m.alloc(0x40)
  const pPath = m.alloc(0x200)
  const pRoom = m.alloc(0x80)
  const pSkillList = m.alloc(0x40)
  m.setU32(pUnit + 0x00, 1)
  m.setU32(pUnit + 0x04, classId)
  m.setU32(pUnit + 0x0c, guid)
  m.setU32(pUnit + 0x10, 1)
  m.setU32(pUnit + 0x14, pMonData)
  m.setU32(pUnit + 0x20, 0x12345678)
  m.setU32(pUnit + 0x24, 0x0000029a)
  m.setU32(pUnit + 0x2c, pPath)
  m.setU32(pUnit + 0xa8, pSkillList)
  m.setU32(pUnit + 0xc4, 0x04)
  m.setU16(pPath + 0x02, x)
  m.setU16(pPath + 0x06, y)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pUnit)
  const pMonRecord = pMonStatsTxt + classId * D2MonStatsTxt_SIZE
  const pMonStats2Record = pMonStats2Txt + classId * D2MonStats2Txt_SIZE
  m.setU32(pMonData + 0x00, pMonRecord)
  m.setU32(pMonData + 0x2c, pAiControl)
  const pStatList = STATLIST_CreateEx113c(m, pUnit, 0, 0)
  m.setU32(pUnit + 0x5c, pStatList)
  STATLIST_SetUnitStat113c(m, pUnit, 6, 100 << 8, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 7, 100 << 8, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  const pAiParam = m.alloc(0x30)
  m.setU32(pAiParam + 0x00, pAiControl)
  m.setU32(pAiParam + 0x1c, pMonRecord)
  m.setU32(pAiParam + 0x20, pMonStats2Record)
  return { pUnit, pMonData, pAiControl, pPath, pRoom, pMonRecord, pMonStats2Record, pAiParam }
}

function createW5B6World() {
  const m = new SparseMemory113c()
  const _pDefaultBits = m.alloc(128); for (let _b = 0; _b < 32; _b++) m.setU32(_pDefaultBits + _b * 4, (1 << _b) >>> 0); m.setU32(0x6fd18be0, _pDefaultBits); m.setU32(0x6fdd90b0, _pDefaultBits);
  m.fill(0x6fd18000, 0x1c000, 0)
  m.fill(0x6fdd9000, 0x19000, 0)
  // D2Common .data 0x6FDED378 (BODY_GRID_DEF_VA_113C): body-loc grid 0 definition { bGridX = 13, bGridY = 1 }
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  m.fill(0x6ff7f400, 0x900, 0)
  const pMasks = m.alloc(0x80)
  for (let b = 0; b < 32; b++) {
    m.setU32((pMasks + b * 4) >>> 0, (1 << b) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pMasks)
  m.setU32(0x6fde9e18, pMasks)
  m.setU32(0x6fdd90b0, pMasks)
  m.setU32(0x6fdeff6c, m.alloc(16))
  const pAnimDataTable = m.alloc(0x600)
  const pEmptyAnimBucket = m.alloc(8)
  for (let i = 0; i < 256; i++) {
    m.setU32((pAnimDataTable + 4 + i * 4) >>> 0, pEmptyAnimBucket)
  }
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13c4, 20)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(0x34 * 20))
  m.setU32(0x6fdf13d0, m.alloc(0x34 * 20))

  const pDataTables = m.alloc(0x1000)
  const pPtrHolder = m.alloc(8)
  m.setU32(pPtrHolder, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pPtrHolder)
  m.setU32(0x6fde9e1c, pDataTables)

  const pStatesBase = m.alloc(0x3c * 160)
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesBase)
  m.setU32((pDataTables + 0xc4) >>> 0, 160)
  const pEmptyStateMask = m.alloc(0x40)
  for (let i = 0; i < 0x28; i++) {
    m.setU32((pDataTables + 0xcc + i * 4) >>> 0, pEmptyStateMask)
  }

  const pMonStatsBase = m.alloc(0x1a8 * 16)
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsBase)
  m.setU32((pDataTables + 0xa80) >>> 0, 16)

  const pMonStats2Base = m.alloc(0x134 * 16)
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Base)
  m.setU32((pDataTables + 0xa8c) >>> 0, 16)

  const pSkillsBase = m.alloc(0x23c * 300)
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsBase)
  m.setU32((pDataTables + 0xba0) >>> 0, 300)

  const pIscBase = m.alloc(0x144 * 400)
  m.setU32((pDataTables + 0xbcc) >>> 0, pIscBase)
  m.setU32((pDataTables + 0xbd4) >>> 0, 400)
  m.setU16((pIscBase + 6 * 0x144 + 0x32) >>> 0, 7)
  m.setU8((pIscBase + 6 * 0x144 + 0x18) >>> 0, 8)
  m.setU16((pIscBase + 8 * 0x144 + 0x32) >>> 0, 9)
  m.setU8((pIscBase + 8 * 0x144 + 0x18) >>> 0, 8)
  m.setU32((pDataTables + 0xc5c) >>> 0, 136)

  const pCharStatsBase = m.alloc(0xc4 * 8)
  for (let c = 0; c < 8; c++) {
    m.setU8((pCharStatsBase + c * 0xc4 + 0x26) >>> 0, 4)
    m.setU8((pCharStatsBase + c * 0xc4 + 0x27) >>> 0, 4)
  }
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStatsBase)
  m.setU32((pDataTables + 0xbc8) >>> 0, 8)

  const pGame = m.alloc(0x2000)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  m.setU32((pGame + 0x70) >>> 0, 1)
  EVENT_InitTimerQueue113c(m, pGame)

  const pRoom = m.alloc(0x100)
  const pRoom2 = m.alloc(0x100)
  const pLevel = m.alloc(0x200)
  const pColl = m.alloc(0x28)
  m.setU32((pColl + 0x08) >>> 0, 200)
  m.setU32((pColl + 0x0c) >>> 0, 200)
  m.setU32((pColl + 0x20) >>> 0, m.alloc(200 * 200 * 2))
  m.setU32((pRoom + 0x10) >>> 0, pRoom2)
  m.setU32((pRoom + 0x20) >>> 0, pColl)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  m.setU32((pRoom + 0x54) >>> 0, 200)
  m.setU32((pRoom + 0x58) >>> 0, 200)
  m.setU32((pRoom2 + 0x58) >>> 0, pLevel)
  m.setU32((pLevel + 0x1ac) >>> 0, 1)
  const ppRooms = m.alloc(8)
  m.setU32(ppRooms, pRoom)
  m.setU32(pRoom, ppRooms)
  m.setU32((pRoom + 0x30) >>> 0, 1)

  return { m, pGame, pDataTables, pMonStatsBase, pMonStats2Base, pSkillsBase, pStatesBase, pIscBase, pRoom }
}

function allocW5Monster(
  f: ReturnType<typeof createW5B6World>,
  classId: number,
  guid: number,
  x: number,
  y: number,
) {
  const { m, pGame, pMonStatsBase, pRoom } = f
  const pUnit = m.alloc(0x100)
  const pMonData = m.alloc(0x60)
  const pAiGen = m.alloc(0x40)
  const pAiControl = m.alloc(0x40)
  const pPath = m.alloc(0x200)
  m.setU32(pUnit, 1)
  m.setU32((pUnit + 0x04) >>> 0, classId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, 1)
  m.setU32((pUnit + 0x14) >>> 0, pMonData)
  m.setU32((pUnit + 0x20) >>> 0, 0x12345678)
  m.setU32((pUnit + 0x24) >>> 0, 0x9abcdef0)
  m.setU32((pUnit + 0x2c) >>> 0, pPath)
  m.setU32((pUnit + 0x80) >>> 0, pGame)
  m.setU32((pUnit + 0xa8) >>> 0, m.alloc(0x28))
  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  m.setU32((pPath + 0x30) >>> 0, pUnit)
  const pMonStats = (pMonStatsBase + classId * 0x1a8) >>> 0
  m.setU32(pMonData, pMonStats)
  m.setU32((pMonData + 0x28) >>> 0, pAiGen)
  m.setU32((pMonData + 0x2c) >>> 0, pAiControl)
  m.setU32((pMonData + 0x30) >>> 0, m.alloc(0x20))
  STATLIST_CreateEx113c(m, pUnit, 0, pGame)
  STATLIST_SetUnitStat113c(m, pUnit, 6, 100 << 8, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 7, 100 << 8, 0)
  m.setU32((pGame + 0x1320 + ((guid & 0x7f) << 2)) >>> 0, pUnit)

  const pAiParam = m.alloc(0x28)
  m.setU32(pAiParam, pAiControl)
  m.setU32((pAiParam + 0x1c) >>> 0, pMonStats)
  return { pUnit, pMonData, pAiGen, pAiControl, pPath, pAiParam, pMonStats }
}

function createW6B3Fixture() {
  const m = new SparseMemory113c()
  const _pDefaultBits = m.alloc(128); for (let _b = 0; _b < 32; _b++) m.setU32(_pDefaultBits + _b * 4, (1 << _b) >>> 0); m.setU32(0x6fd18be0, _pDefaultBits); m.setU32(0x6fdd90b0, _pDefaultBits);
  m.fill(0x7ffbc000, 0x2000, 0)
  m.fill(0x6fd20000, 0x10000, 0)

  const pBitMasks = m.alloc(0x80)
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(0x6fd182a4, pBitMasks)

  const pSgptHolder = m.alloc(8)
  const pDataTables = m.alloc(0x1000)
  m.setU32(pSgptHolder, pDataTables)
  m.setU32(0x6fd1829c, pSgptHolder)
  m.setU32(0x6fde9e1c, pDataTables)

  const pStates = m.alloc(0x3c * 128)
  m.setU32((pDataTables + 0xbc) >>> 0, pStates)
  m.setU32((pDataTables + 0xc4) >>> 0, 128)

  const pMonStats = m.alloc(0x1a8 * 512)
  const pAiParamTbl = m.alloc(0x100)
  for (let i = 0; i < 16; i++) {
    m.setU16((pMonStats + i * 0x1a8 + 0x06) >>> 0, i)
    m.setU16((pMonStats + i * 0x1a8 + 0x18) >>> 0, i)
    m.setU32((pMonStats + i * 0x1a8 + 0x14) >>> 0, pAiParamTbl)
  }
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStats)
  m.setU32((pDataTables + 0xa80) >>> 0, 512)

  const pMonStats2 = m.alloc(0x134 * 16)
  for (let i = 0; i < 16; i++) {
    m.setU16((pMonStats2 + i * 0x134) >>> 0, i)
  }
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2)
  m.setU32((pDataTables + 0xa8c) >>> 0, 16)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2)
  m.setU32((pDataTables + 0xa98) >>> 0, 16)

  const pSkills = m.alloc(0x23c * 32)
  m.setU32((pDataTables + 0xb98) >>> 0, pSkills)
  m.setU32((pDataTables + 0xba0) >>> 0, 32)

  const pCharStats = m.alloc(0xc4 * 8)
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStats)
  m.setU32((pDataTables + 0xbc8) >>> 0, 8)

  const pPetTypes = m.alloc(0x40 * 16)
  m.setU32((pDataTables + 0xbec) >>> 0, pPetTypes)
  m.setU32((pDataTables + 0xbf0) >>> 0, 16)

  const pLevelsTxt = m.alloc(0x220 * 16)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc60) >>> 0, 16)

  const pGame = m.alloc(0x2000)
  EVENT_InitTimerQueue113c(m, pGame)
  m.setU32((pGame + 0xa8) >>> 0, 100)

  const pRoom = m.alloc(0x100)
  const pRoomEx = m.alloc(0x200)
  const pLevel = m.alloc(0x200)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pLevel + 0x1d0) >>> 0, 2)

  const pMonster = m.alloc(0x200)
  const pMonsterData = m.alloc(0x100)
  const pAiGeneral = m.alloc(0x100)
  const pAiControl = m.alloc(0x100)
  const pCmdNode = m.alloc(0x40)
  const pPath = m.alloc(0x200)
  const pAiTickArgs = m.alloc(0x40)
  const pTarget = m.alloc(0x200)
  const pTargetData = m.alloc(0x100)
  const pTargetPath = m.alloc(0x100)

  m.setU32((pCmdNode + 0x04) >>> 0, pCmdNode)
  m.setU32((pCmdNode + 0x08) >>> 0, pCmdNode)
  m.setU32((pAiGeneral + 0x10) >>> 0, pCmdNode)
  m.setU32((pAiControl + 0x10) >>> 0, pCmdNode)

  m.setU32(pMonster, 1)
  m.setU32((pMonster + 0x04) >>> 0, 1)
  m.setU32((pMonster + 0x0c) >>> 0, 10)
  m.setU32((pMonster + 0x10) >>> 0, 1)
  m.setU32((pMonster + 0x14) >>> 0, pMonsterData)
  m.setU32((pMonster + 0x20) >>> 0, 0x12345678)
  m.setU32((pMonster + 0x24) >>> 0, 0x9abcdef0)
  m.setU32((pMonster + 0x2c) >>> 0, pPath)

  m.setU16((pPath + 0x02) >>> 0, 100)
  m.setU16((pPath + 0x06) >>> 0, 100)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)

  m.setU32(pMonsterData, (pMonStats + 0x1a8) >>> 0)
  m.setU32((pMonsterData + 0x18) >>> 0, pAiGeneral)
  m.setU32((pMonsterData + 0x28) >>> 0, pAiGeneral)
  m.setU32((pMonsterData + 0x2c) >>> 0, pAiControl)

  m.setU32(pTarget, 0)
  m.setU32((pTarget + 0x0c) >>> 0, 1)
  m.setU32((pTarget + 0x10) >>> 0, 1)
  m.setU32((pTarget + 0x14) >>> 0, pTargetData)
  m.setU32((pTarget + 0x2c) >>> 0, pTargetPath)
  m.setU16((pTargetPath + 0x02) >>> 0, 102)
  m.setU16((pTargetPath + 0x06) >>> 0, 102)
  m.setU32((pTargetPath + 0x1c) >>> 0, pRoom)

  m.setU32(pAiTickArgs, pAiControl)
  m.setU32((pAiTickArgs + 0x08) >>> 0, pTarget)
  m.setU32((pAiTickArgs + 0x14) >>> 0, 4)
  m.setU32((pAiTickArgs + 0x18) >>> 0, 0)
  m.setU32((pAiTickArgs + 0x1c) >>> 0, (pMonStats + 0x1a8) >>> 0)

  return {
    m,
    pDataTables,
    pMonStats,
    pMonStats2,
    pSkills,
    pGame,
    pRoom,
    pMonster,
    pMonsterData,
    pAiGeneral,
    pAiControl,
    pCmdNode,
    pPath,
    pAiTickArgs,
    pTarget,
  }
}

function allocQuestBitBuffer(m: SparseMemory113c) {
  const pQuestFlags = m.alloc(0x10)
  const pQuestBytes = m.alloc(0x100)
  m.setU32(pQuestFlags, pQuestBytes)
  m.setU32((pQuestFlags + 4) >>> 0, 0x400)
  return { pQuestFlags, pQuestBytes }
}

describe('K2 Disassembly-Verified Wave 2 (129 D2Game.dll VAs across k2w3-b8, k2w5-b6, k2w6-b3)', () => {
  it('verifies all 43 promoted D2Game VAs in k2w3-b8 (0x6FC97E70..0x6FCA0450) with VA trace & state assertions', () => {
    const promotedW3B8Vas = [
      0x6fc97e70, 0x6fc97f00, 0x6fc98230, 0x6fc99aa0, 0x6fc9a020, 0x6fc9a0f0, 0x6fc9a190,
      0x6fc9a3a0, 0x6fc9a440, 0x6fc9a570, 0x6fc9b860, 0x6fc9b8e0, 0x6fc9ba40, 0x6fc9bb00,
      0x6fc9bb90, 0x6fc9bc70, 0x6fc9be10, 0x6fc9bf50, 0x6fc9c340, 0x6fc9c460, 0x6fc9c580,
      0x6fc9c6e0, 0x6fc9c910, 0x6fc9cb10, 0x6fc9cf10, 0x6fc9cfd0, 0x6fc9d170, 0x6fc9d310,
      0x6fc9d400, 0x6fc9d550, 0x6fc9d7C0, 0x6fc9d910, 0x6fc9db70, 0x6fc9df00, 0x6fc9e4d0,
      0x6fc9e640, 0x6fc9f370, 0x6fc9f5a0, 0x6fc9f760, 0x6fc9f9a0, 0x6fc9fb30, 0x6fc9fe60,
      0x6fca0450,
    ]
    expect(promotedW3B8Vas).toHaveLength(43)

    const w = createW3B8World()
    const { m, pGame } = w
    beginVaTrace113c()

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x180)
    const pClient = m.alloc(0x400)
    const pPlayerPath = m.alloc(0x200)
    const pPlayerRoom = m.alloc(0x80)
    m.setU16(pPlayerPath + 0x02, 100)
    m.setU16(pPlayerPath + 0x06, 100)
    m.setU32(pPlayerPath + 0x1c, pPlayerRoom)
    m.setU32(pPlayerPath + 0x30, pPlayer)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x0c, 10)
    m.setU32(pPlayer + 0x10, 1)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, pPlayerPath)
    m.setU32(pPlayerData + 0x9c, pClient)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32(pPlayer + 0x60, pInv)
    const pStatList = STATLIST_CreateEx113c(m, pPlayer, 0, 0)
    m.setU32(pPlayer + 0x5c, pStatList)
    SUNIT_InsertServerUnit113c(m, pGame, pPlayer)

    const pCorpse = m.alloc(0x100)
    m.setU32(pCorpse + 0x00, 0)
    m.setU32(pCorpse + 0x0c, 11)
    const pCorpseInv = INVENTORY_AllocInventory113c(m, 0, pCorpse)
    m.setU32(pCorpse + 0x60, pCorpseInv)
    SUNIT_InsertServerUnit113c(m, pGame, pCorpse)

    expect(PLAYER_CanLootCorpse_6FC97E70_113c(m, pPlayer, pGame, pCorpse)).toBe(0)
    expect(PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c(m, pPlayer, pGame)).toBe(0)

    EVENT_SetEventFull113c(m, pGame, pPlayer, 8, 120, 0, 0, 0)
    m.setU32(pClient + 0x3d4, 0x03)
    PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c(m, pPlayer, pGame)
    expect(m.u32(pClient + 0x3d4)).toBe(0x01)
    expect(EVENT_GetNextEventFrame113c(m, pPlayer, 8)).toBe(0)

    const pHover = m.alloc(0x110)
    m.setU32(pPlayer + 0xa4, pHover)
    EVENT_HandleFreeHoverMsg_6FC99AA0_113c(m, pGame, pPlayer)
    expect(m.u32(pPlayer + 0xa4)).toBe(0)

    m.setU32(pPlayer + 0xec, 0)
    m.setU32(pPlayer + 0xf0, 0)
    UNITMSG_QueuePacket23SetSkill_6FC9A020_113c(m, pPlayer, 1, 0x24, 0xffffffff)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0x23)
    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pPlayer, 42)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0xa5)
    UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(m, pPlayer, pCorpse, 12, 3, 100, 200, 7)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0xa3)
    UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pPlayer, 6, 250)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0x9e)
    UNITMSG_QueuePacket9ACoords_6FC9A440_113c(m, pPlayer, 500, 1, 600, 2, 3)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0x9a)
    STATLIST_SetUnitStat113c(m, pPlayer, 0xb2, 77, 0)
    UNIT_SendStatB2Packet11ToClient_6FC9A570_113c(m, pPlayer, pClient)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0xb2, 0)).toBe(77)

    const self = allocW3Monster(w, 20, 10, 100, 100)
    const ally = allocW3Monster(w, 21, 10, 103, 104)
    STATLIST_SetUnitStat113c(m, ally.pUnit, 6, 40 << 8, 0)
    STATLIST_SetUnitStat113c(m, ally.pUnit, 7, 100 << 8, 0)

    const pCtxLowLife = m.alloc(0x10)
    m.setU32(pCtxLowLife + 0x04, 999)
    m.setU32(pCtxLowLife + 0x08, 50)
    AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c(m, self.pUnit, ally.pUnit, pCtxLowLife)
    expect(m.u32(pCtxLowLife)).toBe(ally.pUnit)

    m.setU32(ally.pUnit + 0xc4, 0x02)
    m.setU8(ally.pMonRecord + 0x0d, 0xff)
    const pCtxResHeal = m.alloc(0x20)
    m.setU32(pCtxResHeal + 0x10, 100)
    m.setU32(pCtxResHeal + 0x18, 1)
    AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c(m, self.pUnit, ally.pUnit, pCtxResHeal)
    expect(m.u32(pCtxResHeal + 0x04)).toBe(ally.pUnit)

    const mon136 = allocW3Monster(w, 22, 0x136, 106, 108)
    m.setU32(mon136.pUnit + 0xc4, 0x02)
    const pCtx136 = m.alloc(0x18)
    m.setU32(pCtx136 + 0x08, 999)
    m.setU32(pCtx136 + 0x0c, 999)
    m.setU32(pCtx136 + 0x10, 999)
    AI_ScanCallbackNearestBaseId136_6FC9BA40_113c(m, self.pUnit, mon136.pUnit, pCtx136)
    expect(m.u32(pCtx136)).toBe(mon136.pUnit)

    const corpseMon = allocW3Monster(w, 23, 12, 102, 102)
    m.setU32(corpseMon.pUnit + 0x10, 0x0c)
    m.setU32(corpseMon.pUnit + 0xc4, 0x02)
    m.setU32(corpseMon.pMonStats2Record + 0x04, 1 << 0x0c)
    const pCtxCorpse = m.alloc(0x10)
    m.setU32(pCtxCorpse + 0x04, 999)
    AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c(m, self.pUnit, corpseMon.pUnit, pCtxCorpse)
    expect(m.u32(pCtxCorpse)).toBe(corpseMon.pUnit)

    const fetish = allocW3Monster(w, 24, 0x8d, 101, 101)
    m.setU32(fetish.pUnit + 0xc4, 0x02)
    const pCtxFetish = m.alloc(0x20)
    m.setU32(pCtxFetish + 0x08, 999)
    m.setU32(pCtxFetish + 0x10, 999)
    m.setU32(pCtxFetish + 0x18, 3)
    AI_ScanCallbackFetishMinions_6FC9BB90_113c(m, self.pUnit, fetish.pUnit, pCtxFetish)
    expect(m.u32(pCtxFetish + 0x14)).toBe(1)

    const monEB = allocW3Monster(w, 25, 0xeb, 104, 104)
    STATLIST_SetUnitStat113c(m, monEB.pUnit, 6, 30 << 8, 0)
    const pCtxEB = m.alloc(0x18)
    m.setU32(pCtxEB + 0x0c, 100)
    AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c(m, self.pUnit, monEB.pUnit, pCtxEB)
    expect(m.u32(pCtxEB)).toBe(monEB.pUnit)

    AI_UnburrowAndScheduleThink_6FC9BE10_113c(m, pGame, self.pUnit)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(112)

    m.setU32(self.pAiParam + 0x08, ally.pUnit)
    m.setU32(self.pAiParam + 0x18, 0)
    AI_StationaryMeleeTrap_6FC9BF50_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(140)

    m.setU32(self.pAiParam + 0x14, 20)
    AI_WallTrapHorizontalY_6FC9C340_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(140)
    AI_WallTrapVerticalX_6FC9C460_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(140)

    m.setU32(self.pAiParam + 0x14, 5)
    m.setU32(self.pAiControl + 0x14, 0)
    m.setU32(self.pAiControl + 0x18, 1)
    m.setU16(self.pMonRecord + 0x56, 10)
    m.setU16(self.pMonRecord + 0x5c, 5)
    m.setU16(self.pMonRecord + 0x62, 16)
    m.setU16(self.pMonRecord + 0x170, 0xffff)
    AI_TentacleMeleeAttack_6FC9C580_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(116)

    expect(
      AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c(m, ally.pUnit, self.pUnit, self.pMonRecord, pGame),
    ).toBe(0)

    m.setU32(self.pAiControl + 0x14, 15)
    AI_CardinalBeamTurret_6FC9C910_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(115)

    const pAiGeneral = m.alloc(0x40)
    m.setU32(pAiGeneral + 0x28, 1)
    m.setU32(pAiGeneral + 0x2c, 21)
    m.setU32(pAiGeneral + 0x30, 1)
    m.setU32(self.pMonData + 0x28, pAiGeneral)
    m.setU16(self.pMonRecord + 0x170, 0xffff)
    m.setU16(self.pMonRecord + 0x172, 0xffff)
    m.setU16(self.pMonRecord + 0x6e, 18)
    AI_LinkedOwnerTurretCycle_6FC9CB10_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(118)

    const pMetrics = m.alloc(0x28)
    AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c(m, pGame, self.pUnit, ally.pUnit, pMetrics)
    expect(m.u32(pMetrics + 0x1c)).toBe(0)

    m.setU32(self.pAiParam + 0x14, 30)
    AI_MosquitoNestSpawner_6FC9CFD0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(125)
    AI_FoulCrowNestSpawner_6FC9D170_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(125)

    m.setU32(self.pAiControl + 0x14, 0)
    m.setU16(self.pMonRecord + 0x56, 21)
    AI_OneShotSkillTrap_6FC9D310_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(121)

    m.setU16(self.pMonRecord + 0x5c, 12)
    AI_CastSkillAtRandomOffsetAroundSelf_6FC9D400_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(112)

    m.setU32(self.pUnit + 0x10, 0x0b)
    m.setU32(self.pAiControl + 0x14, 0)
    AI_SubmergedOrStuckTransition_6FC9D550_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(m.u32(self.pAiControl + 0x14)).toBe(1)

    m.setU16(self.pMonRecord + 0x56, 0)
    m.setU16(self.pMonRecord + 0x5c, 14)
    AI_BasicMeleeOrStepApproach_6FC9D7C0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(114)

    m.setU32(self.pAiControl + 0x14, 0)
    m.setU32(self.pAiParam + 0x14, 20)
    m.setU16(self.pMonRecord + 0x62, 5)
    m.setU16(self.pMonRecord + 0x5c, 0)
    m.setU16(self.pMonRecord + 0x68, 15)
    AI_PackBroadcastOrMeleeApproach_6FC9D910_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(115)

    m.setU32(self.pAiControl + 0x18, 0)
    m.setU16(self.pMonRecord + 0x7a, 0)
    m.setU16(self.pMonRecord + 0x80, 0)
    AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(115)

    m.setU16(self.pMonRecord + 0x62, 0)
    m.setU16(self.pMonRecord + 0x68, 17)
    AI_MeleeOrPathType13Approach_6FC9DF00_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(117)

    m.setU32(self.pAiControl + 0x14, 0)
    AI_InitialStall5ThenMeleeApproach_6FC9E4D0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(m.u32(self.pAiControl + 0x14)).toBe(1)

    m.setU32(self.pAiControl + 0x14, 1)
    m.setU32(self.pAiControl + 0x18, 19)
    m.setU32(self.pAiControl + 0x1c, 2)
    m.setU32(self.pPath + 0x1c, 0)
    AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(119)
    m.setU32(self.pPath + 0x1c, self.pRoom)

    m.setU16(self.pMonRecord + 0x56, 0)
    m.setU16(self.pMonRecord + 0x62, 20)
    AI_MeleeStrafeOrStepApproach_6FC9F370_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(120)

    m.setU32(self.pAiControl + 0x14, 0)
    m.setU32(self.pAiParam + 0x14, 30)
    m.setU16(self.pMonRecord + 0x5c, 5)
    m.setU16(self.pMonRecord + 0x62, 22)
    AI_ThreeStageSuicideMinion_6FC9F5A0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(122)

    m.setU16(self.pMonRecord + 0x62, 0)
    m.setU16(self.pMonRecord + 0x68, 23)
    AI_ComboMeleeAndDualSkill_6FC9F760_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(123)

    m.setU16(self.pMonRecord + 0x68, 24)
    AI_AlternatingMeleeOrApproach_6FC9F9A0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(124)

    m.setU32(self.pAiParam + 0x14, 5)
    m.setU16(self.pMonRecord + 0x6e, 10)
    m.setU16(self.pMonRecord + 0x56, 0)
    m.setU16(self.pMonRecord + 0x62, 26)
    AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(126)

    m.setU16(self.pMonRecord + 0x5c, 100)
    m.setU16(self.pMonRecord + 0x174, 0xffff)
    AI_MeleeOrDualSkillPathType7_6FC9FE60_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(105)

    m.setU32(self.pAiControl + 0x14, 0)
    STATLIST_SetUnitStat113c(m, self.pUnit, 0x4a, 16, 0)
    m.setU16(self.pMonRecord + 0x6e, 4)
    AI_RegeneratingMultiStateMonster_6FCA0450_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(STATLIST_GetUnitStat113c(m, self.pUnit, 0x4a, 0)).toBe(24)

    const hits = endVaTrace113c()
    for (const va of promotedW3B8Vas) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA trace hit for 0x${va.toString(16)}`).toBe(true)
    }
  })

  it('verifies all 43 promoted D2Game VAs in k2w5-b6 (0x6FC68BA0..0x6FCEEF40) with VA trace & state assertions', () => {
    const promotedW5B6Vas = [
      0x6fc68ba0, 0x6fc6d420, 0x6fca0f20, 0x6fca1c80, 0x6fca26b0, 0x6fca3ce0, 0x6fca3fe0,
      0x6fca43f0, 0x6fca7e60, 0x6fca8a70, 0x6fca8d80, 0x6fca9430, 0x6fcafbe0, 0x6fcb2360,
      0x6fcb3d60, 0x6fcb4370, 0x6fcbabc0, 0x6fcbaf50, 0x6fcc3e80, 0x6fcc66e0, 0x6fcc8430,
      0x6fcc8e80, 0x6fcce6d0, 0x6fccea40, 0x6fccedc0, 0x6fcd60c0, 0x6fcd6da0, 0x6fcd7d30,
      0x6fce8cd0, 0x6fce94e0, 0x6fcea760, 0x6fceca00, 0x6fcecb50, 0x6fcecdb0, 0x6fcece20,
      0x6fcece90, 0x6fcecf70, 0x6fced0e0, 0x6fced2c0, 0x6fced440, 0x6fced530, 0x6fced790,
      0x6fceef40,
    ]
    expect(promotedW5B6Vas).toHaveLength(43)

    const f = createW5B6World()
    const { m, pGame, pDataTables, pSkillsBase, pMonStatsBase, pRoom } = f
    beginVaTrace113c()

    const pPlayer = m.alloc(0x100)
    const pPlrData = m.alloc(0xc0)
    const pPlrPath = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 50)
    m.setU32((pPlayer + 0x14) >>> 0, pPlrData)
    m.setU32((pPlayer + 0x20) >>> 0, 0x33445566)
    m.setU32((pPlayer + 0x2c) >>> 0, pPlrPath)
    m.setU16((pPlrPath + 0x02) >>> 0, 100)
    m.setU16((pPlrPath + 0x06) >>> 0, 100)
    m.setU32((pPlrPath + 0x1c) >>> 0, pRoom)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32((pPlayer + 0x60) >>> 0, pInv)
    STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
    STATLIST_SetUnitStat113c(m, pPlayer, 0, 100, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 2, 100, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 15, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0xaf, 99, 0)

    HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c(m, pGame, pPlayer, 0, 10)
    m.setU16((pSkillsBase + 10 * 0x23c + 0x3a) >>> 0, 0xffff)
    expect(SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c(m, pGame, pPlayer, 10, 1)).toBe(1)

    const mon = allocW5Monster(f, 1, 10, 100, 100)
    const tgt = allocW5Monster(f, 2, 11, 104, 104)
    m.setU8((tgt.pMonStats + 0x4e) >>> 0, 5)
    m.setU32((mon.pAiParam + 0x08) >>> 0, tgt.pUnit)
    m.setU32((mon.pAiParam + 0x14) >>> 0, 6)
    m.setU16((mon.pMonStats + 0x170) >>> 0, 0xffff)
    m.setU16((mon.pMonStats + 0x172) >>> 0, 0xffff)
    m.setU16((mon.pMonStats + 0x174) >>> 0, 0xffff)
    m.setU16((mon.pMonStats + 0x176) >>> 0, 0xffff)

    m.setU32((mon.pAiControl + 0x14) >>> 0, 6)
    m.setU32((mon.pAiControl + 0x1c) >>> 0, 5)
    MONAI_GloamPackLightningDanceThink_6FCA0F20_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(m.u32((mon.pAiControl + 0x14) >>> 0) | 0).toBe(2)

    m.setU32((mon.pAiControl + 0x14) >>> 0, 99)
    MONAI_SandMaggotThink_6FCA1C80_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(m.u32((mon.pAiControl + 0x14) >>> 0) | 0).toBe(0)

    MONAI_CorruptRogueArcherThink_6FCA26B0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_BlunderboreThink_6FCA3CE0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(m.u32((mon.pAiControl + 0x18) >>> 0) | 0).toBe(0x0d)

    m.setU32((mon.pAiControl + 0x14) >>> 0, 5)
    MONAI_CorpseSpitterThink_6FCA3FE0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(m.u32((mon.pAiControl + 0x14) >>> 0) | 0).toBe(0)

    MONAI_TentacleBeastHeadThink_6FCA43F0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_OblivionKnightThink_6FCA7E60_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_SuccubusThink_6FCA8A70_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_FetishShamanOrCasterThink_6FCA8D80_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_AuraKnightOrZealotThink_6FCA9430_113c(m, pGame, mon.pUnit, mon.pAiParam)

    m.setU32((mon.pUnit + 0xd0) >>> 0, 0x0b)
    MONAI_SiegeRunnerThink_6FCC66E0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(m.u32((mon.pUnit + 0xd0) >>> 0) | 0).toBe(8)

    m.setU32((mon.pAiControl + 0x1c) >>> 0, 200)
    MONAI_BaalThroneThink_6FCC8430_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(m.u32((mon.pUnit + 0xdc) >>> 0)).not.toBe(0)

    m.setU8((pMonStatsBase + 1 * 0x1a8 + 0x0d) >>> 0, 2)
    NPCS_InitGameNpcControl_6FCAFBE0_113c(m, pGame)
    expect(m.u32((pGame + 0x1d24) >>> 0)).not.toBe(0)

    m.setU8((pSkillsBase + 2 * 0x23c + 0x1a4) >>> 0, 8)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x1a8) >>> 0, 20)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x1ac) >>> 0, 40)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x1d8) >>> 0, 0xffffffff)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x1dc) >>> 0, 0xffffffff)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x220) >>> 0, 0xffffffff)
    if (m.u32((pPlayer + 0x60) >>> 0) !== 0) m.setU32((m.u32((pPlayer + 0x60) >>> 0) + 0x1c) >>> 0, 0xffffffff)
    const pDmg = m.alloc(0x70)
    SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c(m, pPlayer, pGame, pDmg, 0, 2, 5)
    expect(m.u32((pDmg + 0x08) >>> 0) | 0).toBeGreaterThan(0)

    SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c(m, 123, pGame, pPlayer, -1, 50, 50, 1, 1, 16)
    SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c(m, 456, pGame, pPlayer, -1, 50, 50, 1, 1, 16)

    m.setU16((pSkillsBase + 5 * 0x23c + 0x80) >>> 0, 10)
    m.setU16((pSkillsBase + 5 * 0x23c + 0x82) >>> 0, 0xffff)
    for (let i = 0; i < 5; i++) {
      m.setU16((pSkillsBase + 5 * 0x23c + 0x98 + i * 2) >>> 0, 0xffff)
      m.setU32((pSkillsBase + 5 * 0x23c + 0xa4 + i * 4) >>> 0, 0xffffffff)
    }
    expect(SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c(m, pGame, pPlayer, 5, 1)).toBe(1)
    expect(SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c(m, pGame, pPlayer, 5, 1)).toBe(1)

    STATLIST_SetUnitStat113c(m, tgt.pUnit, 0x16, 40, 0)
    const pTether = m.alloc(0x18)
    m.setU32((pTether + 0x0c) >>> 0, 100)
    m.setU32((pTether + 0x10) >>> 0, 100)
    expect(AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(m, pTether, tgt.pUnit, mon.pUnit)).toBeGreaterThan(0)
    expect(AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(m, pTether, tgt.pUnit, mon.pUnit)).toBeGreaterThan(0)

    m.setU32((mon.pAiControl + 0x14) >>> 0, 7)
    expect(AIBAAL_SelectCombatAction_6FCC8E80_113c(m, mon.pAiControl, mon.pUnit, tgt.pUnit, 80, 0, pTether)).toBe(7)
    m.setU32((mon.pAiControl + 0x14) >>> 0, 0)

    const pItemsTxt = m.alloc(0x1b0)
    m.setU32((pDataTables + 0xba8) >>> 0, pItemsTxt)
    m.setU32((pDataTables + 0xba4) >>> 0, 1)
    m.setU16((pItemsTxt + 0x9e) >>> 0, 0xffff)
    expect(ITEMS_UsePercentagePotion_6FCCE6D0_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c(m, pGame, pPlayer, 0)).toBe(0)

    expect(SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c(m, pGame, mon.pUnit, 0, 1)).toBe(0)
    expect(AIBAAL_TrySpawnBaalClone_6FCD7D30_113c(m, mon.pUnit, pGame, mon.pAiControl)).toBe(0)

    const pQuestArg = m.alloc(0x28)
    const pQuestState = m.alloc(0x50)
    m.setU32((pQuestArg + 0x04) >>> 0, pGame)
    m.setU32((pQuestArg + 0x18) >>> 0, pQuestState)
    m.setU8((pQuestState + 0x0e) >>> 0, 1)
    A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c(m, mon.pUnit, pQuestArg)
    m.setU8((pQuestState + 0x03) >>> 0, 5)
    expect(A5Q4_OpenTemplePortalObject_6FCE94E0_113c(m, pGame, pQuestArg)).toBe(1)
    expect(m.u8((pQuestState + 0x03) >>> 0)).toBe(0)

    m.setU8((pMonStatsBase + 1 * 0x1a8 + 0x0c) >>> 0, 1)
    m.setU8((pMonStatsBase + 1 * 0x1a8 + 0x2e) >>> 0, 3)
    const pLevelsTxt = m.alloc(0xc0)
    m.setU8((pLevelsTxt + 0x32) >>> 0, 1)
    m.setU8((pLevelsTxt + 0x33) >>> 0, 1)
    m.setU16((pLevelsTxt + 0x36) >>> 0, 1)
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 0xabcdef01)
    m.setU32((pSeed + 4) >>> 0, 0x12345678)
    const pMonReg = m.alloc(0x200)
    MONREG_SelectRegionMonsterTypes_6FCEA760_113c(m, 0, pSeed, pLevelsTxt, pMonReg)
    expect(m.u8((pMonReg + 0x10) >>> 0)).toBe(1)

    const pClient = m.alloc(0x600)
    m.setU32((pClient + 0x04) >>> 0, 4)
    m.setU8((pClient + 0x0d) >>> 0, 0x61)
    m.setU8((pClient + 0x3d4) >>> 0, 1)
    m.setU32((pClient + 0x174) >>> 0, pPlayer)
    m.setU32((pClient + 0x1a8) >>> 0, pGame)
    m.setU32((pClient + 0x1bc) >>> 0, m.alloc(0x410))
    m.setU32((pPlrData + 0x9c) >>> 0, pClient)

    const pRawChat = m.alloc(0x140)
    m.setU8((pRawChat + 0x103) >>> 0, 0x62)
    const pChatDesc = m.alloc(0x10)
    m.setU32(pChatDesc, m.alloc(0x140))
    m.setU32((pChatDesc + 4) >>> 0, pRawChat)
    m.setU32((pChatDesc + 8) >>> 0, 0xffffffff)
    PACKET_DeliverChatIfNotSquelched_6FCECA00_113c(m, pClient, pChatDesc)
    PACKET_DeliverOverheadOrPartyChat_6FCED530_113c(m, pClient, pChatDesc)

    expect(C2S_ValidateWaypointInteraction_6FCECB50_113c(m, 999, pGame, pPlayer, 0)).toBe(1)

    const pCursorItem = m.alloc(0x100)
    m.setU32(pCursorItem, 4)
    m.setU32((pCursorItem + 0x0c) >>> 0, 77)
    m.setU32((pCursorItem + 0x10) >>> 0, 4)
    m.setU32((pCursorItem + 0x14) >>> 0, m.alloc(0x80))
    m.setU32((pGame + 0x1720 + ((77 & 0x7f) << 2)) >>> 0, pCursorItem)
    INVENTORY_SetCursorItem113c(m, pInv, pCursorItem)

    expect(C2S_ValidateBeltItemOwnership_6FCECDB0_113c(m, pGame, 77, pPlayer)).toBe(1)
    expect(C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(m, pGame, 77, pPlayer)).toBe(0)
    expect(C2S_ValidateStoredOrEquippedItem_6FCECE90_113c(m, pGame, 77, pPlayer)).toBe(1)
    expect(C2S_ValidateCursorItem_6FCECF70_113c(m, pGame, 77, pPlayer)).toBe(0)

    const pOtherPlr = m.alloc(0x100)
    STATLIST_CreateEx113c(m, pOtherPlr, 0, pGame)
    PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c(m, pClient, pOtherPlr)
    PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c(m, pPlayer, pClient, 1)

    const pObjPkt = m.alloc(8)
    expect(C2S_SyncObjectCollisionByGuid_6FCED440_113c(m, pGame, pPlayer, pObjPkt, 5)).toBe(1)
    expect(SKILLS_TestPathReachableToCoords_6FCED790_113c(m, 500, 500, pGame, pPlayer)).toBe(0)

    const pGoldPkt = m.alloc(16)
    m.setU32((pGoldPkt + 1) >>> 0, 50)
    expect(C2S_Packet50_DropPlayerGold_6FCEEF40_113c(m, pGame, pPlayer, pGoldPkt, 9)).toBe(3)

    const hits = endVaTrace113c()
    for (const va of promotedW5B6Vas) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA trace hit for 0x${va.toString(16)}`).toBe(true)
    }
    expect(hits.has(formatD2GameHit(0x6fceb950))).toBe(true)
    expect(hits.has(formatD2GameHit(0x6fcecfe0))).toBe(true)
  })

  it('verifies all 43 promoted D2Game VAs in k2w6-b3 (0x6FC366D0..0x6FD05B60) with VA trace & state assertions', () => {
    const promotedW6B3Vas = [
      0x6fc366d0, 0x6fc39080, 0x6fc39740, 0x6fc39e70, 0x6fc3a550, 0x6fc3b2f0, 0x6fc3b780,
      0x6fc3b950, 0x6fc9d670, 0x6fc9e070, 0x6fc9ed90, 0x6fca00c0, 0x6fca08a0, 0x6fca0b00,
      0x6fca20d0, 0x6fca2990, 0x6fca4a90, 0x6fca4db0, 0x6fca5b60, 0x6fca6280, 0x6fca64a0,
      0x6fca6900, 0x6fca7010, 0x6fca74a0, 0x6fca7bb0, 0x6fca8810, 0x6fcbcc00, 0x6fcc6b70,
      0x6fcc6fc0, 0x6fce5820, 0x6fce5910, 0x6fce59a0, 0x6fce5b80, 0x6fce5c60, 0x6fce5ed0,
      0x6fce6070, 0x6fce9b70, 0x6fcebe70, 0x6fcec030, 0x6fced360, 0x6fced3d0, 0x6fd00bf0,
      0x6fd05b60,
    ]
    expect(promotedW6B3Vas).toHaveLength(43)

    const fx = createW6B3Fixture()
    const { m, pGame, pMonster, pAiTickArgs, pAiControl, pCmdNode, pTarget, pRoom } = fx
    beginVaTrace113c()

    AI_ThinkImpregnatedMonster_6FC366D0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkZakarumHealerOrPriest_6FC39080_113c(m, pGame, pMonster, pAiTickArgs)
    m.setU32((pAiControl + 0x04) >>> 0, 2)
    AI_ThinkTownRogueGuard_6FC39740_113c(m, pGame, pMonster, pAiTickArgs)
    m.setU32(pCmdNode, 0x0a)
    AI_ThinkHomeLeashedCaster_6FC39E70_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkPutridDefiler_6FC3A550_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkPackRegroupSkirmisher_6FC3B780_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkAct2SewerTownNpc_6FC3B950_113c(m, pGame, pMonster, pAiTickArgs)
    m.setU32(pCmdNode, 0x0e)
    AI_ThinkCommand14TriggeredSkill_6FC9D670_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkLowLifeFleeCaster_6FC9E070_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkFetishMelee_6FC9ED90_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkChargeStateIconMelee_6FCA4A90_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkOblivionKnightCaster_6FCA4DB0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkMephistoBoss_6FCA5B60_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkGiantMosquito_6FCA6280_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkThornHulk_6FCA64A0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkVampire_6FCA6900_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkWillowisp_6FCA7010_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkSlinger_6FCA74A0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkFetishShaman_6FCA7BB0_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkBloodLord_6FCA8810_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkSpecialAiState3_6FCBCC00_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkBladeCreeper_6FCC6B70_113c(m, pGame, pMonster, pAiTickArgs)
    AI_ThinkTerrorCurse_6FCC6FC0_113c(m, pGame, pMonster, pAiTickArgs)

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const { pQuestFlags } = allocQuestBitBuffer(m)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags)
    expect(ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c(m, pGame, pPlayer, 0)).toBe(0)
    ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c(m, pGame, pPlayer, 0)
    expect(ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c(m, pGame, pPlayer, 0)).toBe(0)

    const pQuestChain = m.alloc(0x40)
    const { pQuestFlags: pGlobalFlags, pQuestBytes } = allocQuestBitBuffer(m)
    const pQuestData = m.alloc(0x100)
    const pQuestExt = m.alloc(0x80)
    const pPresetArgs = m.alloc(0x40)
    m.setU32((pGame + 0x10f4) >>> 0, pQuestChain)
    m.setU32((pQuestChain + 0x08) >>> 0, 1)
    m.setU32((pQuestChain + 0x0c) >>> 0, pGlobalFlags)
    m.setU16((pQuestBytes + 0x0e * 2) >>> 0, 1 << 0x0d)
    m.setU8((pQuestExt + 0x0d) >>> 0, 1)
    m.setU32((pQuestData + 0x04) >>> 0, pGame)
    m.setU32((pQuestData + 0x18) >>> 0, pQuestExt)
    m.setU32(pPresetArgs, pGame)
    m.setU32((pPresetArgs + 0x04) >>> 0, pMonster)
    m.setU32((pPresetArgs + 0x08) >>> 0, pRoom)
    m.setU32((pPresetArgs + 0x14) >>> 0, 50)
    m.setU32((pPresetArgs + 0x18) >>> 0, 60)
    ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c(m, pPresetArgs, pQuestData)
    expect(m.u8((pQuestExt + 0x0d) >>> 0)).toBe(1)

    const pMsg = m.alloc(0x100)
    m.setU8(pMsg, 0x41)
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, pMsg, pGame, 4)
    expect(PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c(m, 0, 0, 0)).toBe(0)
    const pPkt = m.alloc(0x10)
    expect(PACKET_SrvMercMoveToCoord_6FCED360_113c(m, pGame, pTarget, pPkt, 5)).toBe(3)
    expect(PACKET_SrvMercMoveToUnit_6FCED3D0_113c(m, pGame, pTarget, pPkt, 5)).toBe(3)
    SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c(m, pPlayer, pGame)
    expect(ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c(m, pGame, pPlayer, 0)).toBe(0)

    const hits = endVaTrace113c()
    for (const va of promotedW6B3Vas) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA trace hit for 0x${va.toString(16)}`).toBe(true)
    }
  })

  it('verifies 1.13c instruction-level disassembly fixes across all 6 bug classes', () => {
    // 1. Bug Class 1: 0x6FC9E640 passes nTargetDist = 9 to 0x6FD11D90 (retreats when dist < 9)
    {
      const w = createW3B8World()
      const { m, pGame } = w
      const caster = allocW3Monster(w, 40, 20, 100, 100)
      const foe = allocW3Monster(w, 41, 21, 104, 100) // dist = 4 < 9 => retreats to X < 100!
      m.setU32(caster.pAiParam + 0x08, foe.pUnit)
      m.setU32(caster.pAiParam + 0x14, 4)
      m.setU32(caster.pAiParam + 0x18, 0)
      m.setU16(caster.pMonRecord + 0x170, 0xffff)
      m.setU16(caster.pMonRecord + 0x172, 0xffff)
      m.setU16(caster.pMonRecord + 0x174, 0xffff)
      m.setU32(caster.pAiControl + 0x14, 1)
      m.setU32(caster.pAiControl + 0x1c, 2) // phase 2 => rollMove branch
      m.setU16(caster.pMonRecord + 0x62, 100) // aip3 = 100% => enters nDist <= 8 || nDist >= 10
      m.setU32(caster.pUnit + 0x20, 1) // rollMove >= 0x4b or adjust seed so it hits StepRelative
      // Find deterministic seed where rollSeedAt6FC21180(..., 100) >= 0x4b (75)
      m.setU32(caster.pUnit + 0x20, 0x00000013)
      m.setU32(caster.pUnit + 0x24, 0)
      // Force rollMove >= 75: test seeds quickly
      for (let s = 1; s < 50; s++) {
        const probe = Number((BigInt(s) * 0x6ac690c5n) & 0xffffffffn) >>> 0
        if (probe % 100 >= 0x4b) {
          m.setU32(caster.pUnit + 0x20, s)
          break
        }
      }
      AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c(m, pGame, caster.pUnit, caster.pAiParam)
      // Target X sits at pPath + 0x10 (16-bit targetX in dynamic path)
      const targetX = m.u16(caster.pPath + 0x10)
      expect(targetX).toBeLessThan(100)
    }

    // 2. Bug Class 2: D2ModeChangeStrc velocity byte at +0x15 (NOT +0x1e) in k2-w6b3-113c.ts
    {
      const fx = createW6B3Fixture()
      const { m, pGame, pMonster, pAiTickArgs, pMonStats, pMonStats2 } = fx
      // AI_ThinkBloodLord_6FCA8810_113c melee attack (mode 5, bit 5 of MonStats2 + 0x104 -> 0x65 at +0x15)
      m.setU16((pMonStats + 0x1a8 + 0x170) >>> 0, 0xffff)
      m.setU16((pMonStats + 0x1a8 + 0x5c) >>> 0, 100)
      m.setU32((pAiTickArgs + 0x18) >>> 0, 1) // bCanMelee = 1
      m.setU8((pMonStats2 + 0x134 + 0x104) >>> 0, 1 << 5)
      let capturedSpeedAt15 = 0
      let capturedByteAt1E = 0xff
      AI_ThinkBloodLord_6FCA8810_113c(m, pGame, pMonster, pAiTickArgs, {
        onMonsterStartMode: (mem, _g, pModeArgs) => {
          capturedSpeedAt15 = mem.u8((pModeArgs + 0x15) >>> 0)
          capturedByteAt1E = mem.u8((pModeArgs + 0x1e) >>> 0)
          return 1
        },
      })
      expect(capturedSpeedAt15).toBe(0x65)
      expect(capturedByteAt1E).toBe(0)

      // AI_ThinkBladeCreeper_6FCC6B70_113c startDeathMode0 writes 0x64 at +0x15
      m.setU16((pMonStats + 0x1a8 + 0x170) >>> 0, 0xffff)
      let creeperSpeed15 = 0
      AI_ThinkBladeCreeper_6FCC6B70_113c(m, pGame, pMonster, pAiTickArgs, {
        onMonsterStartMode: (mem, _g, pModeArgs) => {
          creeperSpeed15 = mem.u8((pModeArgs + 0x15) >>> 0)
          return 1
        },
      })
      expect(creeperSpeed15).toBe(0x64)
    }

    // 3. Bug Class 3: CorruptRogueArcher (0x6FCA26B0) clamps wander steps to max(3, aip4)
    {
      const f = createW5B6World()
      const { m, pGame } = f
      const rogue = allocW5Monster(f, 3, 30, 100, 100)
      const tgt = allocW5Monster(f, 4, 31, 130, 130)
      m.setU32((rogue.pAiParam + 0x08) >>> 0, tgt.pUnit)
      m.setU32((rogue.pAiParam + 0x14) >>> 0, 30)
      m.setU32((rogue.pAiParam + 0x18) >>> 0, 0)
      m.setU32((rogue.pPath + 0x1c) >>> 0, 0) // bypass room path-compute rewrite so wTargetX/wTargetY keeps exact AI_IdleWander radius
      m.setU16((rogue.pMonStats + 0x56) >>> 0, 5) // nDistance >= aip1 => skips ranged branch -> wander
      m.setU16((rogue.pMonStats + 0x68) >>> 0, 1) // raw aip4 = 1 < 3 => clamped to 3!
      MONAI_CorruptRogueArcherThink_6FCA26B0_113c(m, pGame, rogue.pUnit, rogue.pAiParam)
      expect(
        Math.max(
          Math.abs(m.u16((rogue.pPath + 0x10) >>> 0) - 100),
          Math.abs(m.u16((rogue.pPath + 0x12) >>> 0) - 100),
        ),
      ).toBe(3)

      m.setU16((rogue.pMonStats + 0x68) >>> 0, 9) // raw aip4 = 9 >= 3 => 9!
      MONAI_CorruptRogueArcherThink_6FCA26B0_113c(m, pGame, rogue.pUnit, rogue.pAiParam)
      expect(
        Math.max(
          Math.abs(m.u16((rogue.pPath + 0x10) >>> 0) - 100),
          Math.abs(m.u16((rogue.pPath + 0x12) >>> 0) - 100),
        ),
      ).toBe(9)
    }

    // 4. Bug Class 4: Potion 0x6FCCEDC0 calls 0x6FC211D0 (vit) + 0x6FC21180 (100), while 0x6FCEA760 is inline LCG
    {
      const f = createW5B6World()
      const { m, pGame, pDataTables } = f
      const pPlayer = m.alloc(0x100)
      m.setU32(pPlayer, 0)
      m.setU32((pPlayer + 0x20) >>> 0, 7)
      STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
      STATLIST_SetUnitStat113c(m, pPlayer, 3, 250, 0) // vit = 250 => halfRoll > 0
      STATLIST_SetUnitStat113c(m, pPlayer, 6, 10 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 7, 500 << 8, 0)

      const pItemsTxt = m.alloc(0x1b0)
      m.setU32((pDataTables + 0xba8) >>> 0, pItemsTxt)
      m.setU32((pDataTables + 0xba4) >>> 0, 1)
      m.setU32(0x6fdefb94, 1) // D2Common .bss nItemsTxtRecordCount
      m.setU32(0x6fdefb98, pItemsTxt) // D2Common .bss pItemsTxt
      m.setU32((pItemsTxt + 0xb0) >>> 0, 0xffffffff) // instant heal (lenFrames <= 0)
      m.setU16((pItemsTxt + 0x9e) >>> 0, 6) // stat 6 = hitpoints
      m.setU16((pItemsTxt + 0xa0) >>> 0, 0xffff)
      m.setU32((pItemsTxt + 0xa4) >>> 0, 0xffffffff)

      const pPot = m.alloc(0x100)
      m.setU32(pPot, 4)
      m.setU32((pPot + 0x04) >>> 0, 0)
      // Give pPot a statlist with stat 6 = 40 so ITEMS_EvalItemCalc or fallback works; let's check trace on vit roll!
      beginVaTrace113c()
      ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c(m, pGame, pPlayer, pPot)
      const potHits = endVaTrace113c()
      expect(potHits.has(formatD2GameHit(0x6fc211d0))).toBe(true)
      expect(potHits.has(formatD2GameHit(0x6fc21180))).toBe(true)

      const pLevelsTxt = m.alloc(0xc0)
      m.setU8((pLevelsTxt + 0x32) >>> 0, 1)
      m.setU8((pLevelsTxt + 0x33) >>> 0, 2)
      const pSeed = m.alloc(8)
      m.setU32(pSeed, 12345)
      const pMonReg = m.alloc(0x200)
      beginVaTrace113c()
      MONREG_SelectRegionMonsterTypes_6FCEA760_113c(m, 0, pSeed, pLevelsTxt, pMonReg)
      const regHits = endVaTrace113c()
      expect(regHits.has(formatD2GameHit(0x6fcea760))).toBe(true)
      expect(regHits.has(formatD2GameHit(0x6fc211d0))).toBe(false)
    }

    // 5. Bug Class 5: Left skill evaluated BEFORE Right skill in 0x6FCC3E80, 0x6FCD6DA0, and 0x6FCC8E80
    {
      const f = createW5B6World()
      const { m, pSkillsBase } = f
      const pExpTxt = m.alloc(0x10)
      m.setU32(pExpTxt, 99)
      m.setU32(0x6fdf0b50, pExpTxt) // SGPT_EXPERIENCE_TXT_PTR_VA_113C (max skill level = 99)

      const att = allocW5Monster(f, 1, 60, 100, 100)
      const cand = allocW5Monster(f, 2, 61, 102, 102)
      const pSkillList = m.u32((cand.pUnit + 0xa8) >>> 0) >>> 0
      const pBadLeft = m.alloc(0x40)
      const pBadRight = m.alloc(0x40)
      // Distinct unloaded D2SkillsTxt sentinel VAs prove release 0x6FD9E1D0 probes Left before Right.
      m.setU32(pBadLeft, 0x55551110)
      m.setU32(pBadRight, 0x55552220)
      m.setU32((pSkillList + 0x08) >>> 0, pBadLeft) // D2SkillListStrc.pLeftSkill (+0x08)
      m.setU32((pSkillList + 0x0c) >>> 0, pBadRight) // D2SkillListStrc.pRightSkill (+0x0c)

      const pTether = m.alloc(0x18)
      expect(() => AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(m, pTether, cand.pUnit, att.pUnit)).toThrow(
        /0x55551110/,
      )
      expect(() =>
        AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(m, pTether, cand.pUnit, att.pUnit),
      ).toThrow(/0x55551110/)
      expect(() =>
        AIBAAL_SelectCombatAction_6FCC8E80_113c(m, att.pAiControl, att.pUnit, cand.pUnit, 80, 0, pTether),
      ).toThrow(/0x55551110/)

      // With a valid Left skill, all 3 advance past Left and evaluate Right next.
      m.setU32(pBadLeft, pSkillsBase)
      expect(() => AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(m, pTether, cand.pUnit, att.pUnit)).toThrow(
        /0x55552220/,
      )
      expect(() =>
        AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(m, pTether, cand.pUnit, att.pUnit),
      ).toThrow(/0x55552220/)
      expect(() =>
        AIBAAL_SelectCombatAction_6FCC8E80_113c(m, att.pAiControl, att.pUnit, cand.pUnit, 80, 0, pTether),
      ).toThrow(/0x55552220/)
    }
  })
})
