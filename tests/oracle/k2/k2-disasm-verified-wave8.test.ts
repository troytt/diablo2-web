import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  INVENTORY_AllocInventory113c,
  INVENTORY_SIGNATURE_113C,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { ITEMS_AllocItemData113c, ITEMS_SetOrClearCommandFlags113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  MISSILE_AllocMissileData113c,
  MISSILE_SetLevel113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetSkill113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MISSILE_SetTotalFrames113c,
} from '../../../src/d2kern-113c/common/missile.ts'
import {
  PATH_SetTargetUnit113c,
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
} from '../../../src/d2kern-113c/common/path.ts'
import { QUESTRECORD_AllocRecord113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import { SKILLS_SetParam3113c, SKILLS_SetParam4113c } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c,
  CLIENT_SelectFlag20ClientCallback_6FC4A700_113c,
  CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c,
  GAME_CommitGlobalGameSlot_6FC4A2D0_113c,
  GAME_LeaveGameCriticalSection_6FC49BA0_113c,
  GAME_ReserveGlobalGameSlot_6FC4A220_113c,
  MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c,
  MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c,
  MONUMOD_RollSelfResurrectEvent7_6FC43570_113c,
  MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c,
  OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c,
  OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c,
  OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c,
  OBJECTS_InitFn11_InitTownPortal_6FC53330_113c,
  OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c,
  OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c,
  OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c,
  OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c,
  OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c,
  OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c,
  OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c,
  OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c,
  OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c,
  OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c,
  PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c,
  PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c,
  PLRMODE_IsDualWieldingClaws_6FC46A30_113c,
  PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c,
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_CheckGlobalQuestState_6FC538D0_113c,
  QUESTS_CheckNotIntro_6FC53970_113c,
  QUESTS_FreeUnitQuestChain_6FC53FF0_113c,
  QUESTS_GetQuestSeedPtr_6FC53D90_113c,
  QUESTS_ResolveDefaultStatusByte_6FC53A30_113c,
  SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c,
  SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts'
import {
  MISSILES_ApplyColdLengthToDamage_6FC59080_113c,
  MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c,
  MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c,
  MISSILES_InitGuidedOrLinearPath_6FC597C0_113c,
  MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c,
  MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c,
  MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c,
  MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c,
  MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c,
  MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c,
  MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c,
  MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c,
  MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c,
  MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c,
  MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c,
  MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c,
  MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c,
  MISSILES_SrvDmg12_Nova64RingSubMissiles_6FC5C700_113c,
  MISSILES_SrvDmg13_PoisonExplosionCloud_6FC5C990_113c,
  MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c,
  MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c,
  MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c,
  MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c,
  MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c,
  MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c,
  MISSILES_SrvDo12_RandomWalkStepProjectile_6FC5F890_113c,
  MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c,
  MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c,
  MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c,
  MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c,
  MISSILES_TargetFilter_MonstersOnly_6FC5ADD0_113c,
  MISSILES_TargetFilter_PlayersAndAlignedMonsters_6FC5AD70_113c,
  OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c,
  QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c,
  QUESTS_CheckLevelTransitionBlocked_6FC54020_113c,
  QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c,
  QUESTS_SendNpcIntroPacket91_6FC55B60_113c,
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c.ts'
import {
  AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c,
  ARENA_UpdatePlayerArenaScore_6FCD2820_113c,
  ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c,
  ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c,
  ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c,
  ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c,
  ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c,
  ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c,
  ITEMMODS_ApplyKnockback_6FCCCE60_113c,
  ITEMMODS_ApplyMonsterFlee_6FCCD580_113c,
  ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c,
  ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c,
  MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c,
  MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c,
  MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c,
  MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c,
  MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c,
  MONAI_ForEachPackMemberWithFilter_6FCD1320_113c,
  MONAI_ImpregnateChaseThink_6FCC7F60_113c,
  MONAI_MeleeAndRangedSkillThink_6FCC6530_113c,
  MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c,
  MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c,
  MONAI_NestOrMeleeWanderThink_6FCC5B30_113c,
  MONAI_PutridDefilerThink_6FCC7290_113c,
  MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c,
  MONAI_UnburrowThink_6FCC59B0_113c,
  MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c,
  MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c,
  MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c,
  MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c,
  MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c,
  MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c,
  MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c,
  MONSTER_MorphMonsterClassId_6FCCFC50_113c,
  MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c,
  SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c,
  SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c.ts'
import {
  ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c,
  ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c,
  ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c,
  ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c,
  ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c,
  ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c,
  ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c,
  ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c,
  ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c,
  ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c,
  ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c,
  ACT4Q2_InitHellforgeObject_6FCD9E80_113c,
  ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c,
  AIBAAL_ExecuteCommandAction_6FCD8070_113c,
  C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c,
  C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c,
  C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c,
  C2S_ValidatePacket5ByteItem_6FCED4F0_113c,
  ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c,
  ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c,
  ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c,
  ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c,
  ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c,
  ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c,
  MONREG_InitAllActMonsterRegions_6FCEAB30_113c,
  NPCS_CainIdentifyAllItems_6FCDDB10_113c,
  NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c,
  PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c,
  PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c,
  QUEST0D_InitTemplePortalObject_6FCE9ED0_113c,
  SKILLS_RespecPlayerClassSkills_6FCC1280_113c,
  SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c,
  SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c,
  SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c,
  SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c,
  SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c,
  SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { ensureD2CommonPathGlobals113c } from '../../../src/d2kern-113c/game/tables-bootstrap-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2ObjectsTxt_SIZE,
  D2RoomCollisionGridStrc,
  D2RoomCollisionGridStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2SkillsTxt_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'

function formatD2GameHit(va: number): string {
  return `D2Game:0x${(va >>> 0).toString(16).toUpperCase().padStart(8, '0')}`
}

// 37 promoted eligible VAs from k2w3-b3.json (3 indirectUnknown left ported: 0x6FC548A0, 0x6FC554F0, 0x6FC55640)
const W3B3_PROMOTED_VAS: readonly number[] = [
  0x6fc533d0, 0x6fc54020, 0x6fc54130, 0x6fc55b60, 0x6fc55c20, 0x6fc59080, 0x6fc597c0, 0x6fc59da0,
  0x6fc59e30, 0x6fc59fd0, 0x6fc5abd0, 0x6fc5ad70, 0x6fc5add0, 0x6fc5bed0, 0x6fc5c030, 0x6fc5c160,
  0x6fc5c260, 0x6fc5c700, 0x6fc5c990, 0x6fc5cb00, 0x6fc5cc30, 0x6fc5cd00, 0x6fc5cdd0, 0x6fc5cec0,
  0x6fc5d1e0, 0x6fc5d320, 0x6fc5d450, 0x6fc5d680, 0x6fc5e8a0, 0x6fc5ec10, 0x6fc5f120, 0x6fc5f220,
  0x6fc5f890, 0x6fc5f9f0, 0x6fc5fb40, 0x6fc5fd30, 0x6fc5fed0,
]

// 37 promoted eligible VAs from k2w1-laneJ-0x6fc4.json (3 indirectUnknown left ported: 0x6FC53C70, 0x6FC54510, 0x6FC545A0)
const LANEJ_PROMOTED_VAS: readonly number[] = [
  0x6fc43320, 0x6fc43390, 0x6fc43570, 0x6fc469f0, 0x6fc46a30, 0x6fc46b30, 0x6fc47030, 0x6fc47240,
  0x6fc47270, 0x6fc479c0, 0x6fc49ba0, 0x6fc4a220, 0x6fc4a2d0, 0x6fc4a700, 0x6fc4a9f0, 0x6fc4bed0,
  0x6fc4e5d0, 0x6fc4e660, 0x6fc4e730, 0x6fc4e740, 0x6fc4ec70, 0x6fc4ef50, 0x6fc532f0, 0x6fc53330,
  0x6fc53620, 0x6fc53680, 0x6fc536d0, 0x6fc536f0, 0x6fc53740, 0x6fc538d0, 0x6fc53970, 0x6fc53a30,
  0x6fc53af0, 0x6fc53d90, 0x6fc53f80, 0x6fc53ff0, 0x6fc54370,
]

// 37 promoted eligible VAs from k2w6-b5.json (2 indirectUnknown left ported: 0x6FCC4610, 0x6FCD7090)
const W6B5_PROMOTED_VAS: readonly number[] = [
  0x6fcb2bb0, 0x6fcb4e60, 0x6fcb4f50, 0x6fcb5560, 0x6fcb9d20, 0x6fcbc6f0, 0x6fcc1280, 0x6fcc22e0,
  0x6fcc35d0, 0x6fccdac0, 0x6fccdbf0, 0x6fccddc0, 0x6fccdee0, 0x6fccdf20, 0x6fcce200, 0x6fcd8070,
  0x6fcd9e80, 0x6fcda080, 0x6fcda960, 0x6fcdb3b0, 0x6fcdda90, 0x6fcddb10, 0x6fce58b0, 0x6fce5be0,
  0x6fce5d10, 0x6fce5e30, 0x6fce5e90, 0x6fce6010, 0x6fce9ed0, 0x6fcea050, 0x6fcea170, 0x6fcea290,
  0x6fceab30, 0x6fcec860, 0x6fcec8e0, 0x6fced4f0, 0x6fced6d0,
]

// 37 promoted eligible VAs from k2w4-b7.json (2 indirectUnknown left ported: 0x6FCD0720, 0x6FCD0CE0)
const W4B7_PROMOTED_VAS: readonly number[] = [
  0x6fcc59b0, 0x6fcc5b30, 0x6fcc5c80, 0x6fcc5d70, 0x6fcc6530, 0x6fcc6ab0, 0x6fcc7290, 0x6fcc7f60,
  0x6fccc940, 0x6fccca70, 0x6fcccb10, 0x6fcccc30, 0x6fccce60, 0x6fcccf10, 0x6fcccfd0, 0x6fccd050,
  0x6fccd580, 0x6fccd6c0, 0x6fccd7b0, 0x6fccd860, 0x6fccdb30, 0x6fccfc50, 0x6fcd0980, 0x6fcd0b20,
  0x6fcd1320, 0x6fcd14b0, 0x6fcd2120, 0x6fcd2820, 0x6fcd2e00, 0x6fcd2ed0, 0x6fcd2fc0, 0x6fcd3060,
  0x6fcd3120, 0x6fcd31d0, 0x6fcd32e0, 0x6fcd35a0, 0x6fcd36a0,
]

function readQueuedClientBytes(m: SparseMemory113c, pClient: number): Uint8Array[] {
  const out: Uint8Array[] = []
  let pNode = m.u32((pClient + 0x1b8) >>> 0) >>> 0
  while (pNode !== 0) {
    const used = m.u32(pNode) >>> 0
    const len = used <= 0x200 ? used : 0x200
    const buf = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      buf[i] = m.u8((pNode + 4 + i) >>> 0)
    }
    out.push(buf)
    pNode = m.u32((pNode + 0x204) >>> 0) >>> 0
  }
  return out
}

function createWave8World(nDifficulty = 0) {
  const m = new SparseMemory113c()
  m.fill(0x6fd10000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x20000, 0)
  m.fill(0x7e430000, 0x20000, 0)
  m.fill(0x7e630000, 0x20000, 0)
  m.fill(0x7ef80000, 0x20000, 0)

  // D2Common body grid 0 dimensions (13x1)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)

  const pDataTables = m.alloc(0x2000)
  const pSgptHolder = m.alloc(4)
  initD2GameGlobalsInMem113c(m, pDataTables)
  ensureD2CommonPathGlobals113c(m)
  m.setU32(pSgptHolder, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pSgptHolder)

  const pBitMasks = m.alloc(32 * 4)
  const pInvBitMasks = m.alloc(32 * 4)
  for (let i = 0; i < 32; i++) {
    m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
    m.setU32(pInvBitMasks + i * 4, (~(1 << i)) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU32(0x6fdd9078, pInvBitMasks)

  // SGPT_EXPERIENCE_TXT_PTR_VA_113C (0x6FDF0B50): max level = 99
  const pExpTxt = m.alloc(0x40)
  m.setU32(pExpTxt, 99)
  m.setU32(0x6fdf0b50, pExpTxt)

  // SGPT_ARENA_TXT_PTR_VA (0x6FDF1400): 7 dword score entries
  const pArenaTxt = m.alloc(0x20)
  m.setU32(pArenaTxt + 0x00, 25)
  m.setU32(pArenaTxt + 0x04, 10)
  m.setU32(pArenaTxt + 0x08, 50)
  m.setU32(pArenaTxt + 0x0c, 15)
  m.setU32(0x6fdf1400, pArenaTxt)

  // MonStatsTxt (stride 0x1A8) with wMonStatsEx at +0x18
  const monCount = 600
  const pMonStatsTxt = m.alloc(monCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monCount)
  m.setU32(0x6fdf0950, pMonStatsTxt)
  m.setU32(0x6fdf0958, monCount)
  for (let i = 0; i < monCount; i++) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x00, i)
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x06, i)
    m.setU16(rec + 0x18, i)
  }

  // MonStats2Txt (stride 0x134)
  const pMonStats2Txt = m.alloc(monCount * 0x134)
  m.setU32(pDataTables + 0xa84, pMonStats2Txt)
  m.setU32(pDataTables + 0xa8c, monCount)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monCount)
  for (let i = 0; i < monCount; i++) {
    const rec2 = pMonStats2Txt + i * 0x134
    m.setU8(rec2 + 0x08, 2) // bSizeX
    m.setU8(rec2 + 0x09, 2) // bSizeY
  }

  // MonLvlTxt (stride 0x78 / 0x90)
  const pMonLvl = m.alloc(120 * 0x90)
  m.setU32(pDataTables + 0xac4, pMonLvl)
  m.setU32(pDataTables + 0xac8, 120)
  m.setU32(pDataTables + 0xb70, pMonLvl)
  m.setU32(pDataTables + 0xb74, 120)

  // SkillsTxt (stride 0x23C)
  const skillsCount = 360
  const pSkillsTxt = m.alloc(skillsCount * D2SkillsTxt_SIZE)
  for (let i = 0; i < skillsCount; i++) {
    const s = pSkillsTxt + i * D2SkillsTxt_SIZE
    m.setU16(s + 0x00, i)
    for (let k = 0; k < 6; k++) m.setU16(s + 0x54 + k * 2, 0xffff)
  }
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)
  const pClassSkillCounts = m.alloc(7 * 4)
  const pClassSkillList = m.alloc(7 * 30 * 2)
  m.setU32(pDataTables + 0xba4, pClassSkillCounts)
  m.setU32(pDataTables + 0xba8, 30)
  m.setU32(pDataTables + 0xbac, pClassSkillList)

  // SkillCode buffer
  const pSkillCode = m.alloc(0x400)
  m.setU32(pDataTables + 0x40, pSkillCode)
  m.setU32(pDataTables + 0x44, 0x400)

  // MissilesTxt (stride 0x1A4)
  const missilesCount = 64
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, missilesCount)
  for (let i = 0; i < missilesCount; i++) {
    const rec = pMissilesTxt + i * 0x1a4
    m.setU16(rec + 0x00, i)
    m.setU32(rec + 0x38, 4)
    m.setU32(rec + 0x3c, 12)
    m.setU8(rec + 0x178, 16)
  }

  // StatesTxt & state masks
  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x40)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, statesCount)
  m.setU32(pDataTables + 0xbb8, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, statesCount)
  const pStateMasks = m.alloc(64)
  m.setU32(pDataTables + 0xdc, pStateMasks)
  m.setU32(pDataTables + 0xf8, pStateMasks)
  m.setU32(pDataTables + 0xfc, pStateMasks)
  m.setU32(pDataTables + 0x104, pStateMasks)
  m.setU32(pDataTables + 0x144, pStateMasks)
  m.setU32(pDataTables + 0x150, pStateMasks)

  // CharStatsTxt & ItemStatCostTxt
  const pCharStatsTxt = m.alloc(8 * 0xc4)
  m.setU32(pDataTables + 0xbc4, pCharStatsTxt)
  m.setU32(pDataTables + 0xbc8, 8)
  const pIscTxt = m.alloc(400 * 0x144)
  m.setU32(pDataTables + 0xbcc, pIscTxt)
  m.setU32(pDataTables + 0xbd4, 400)

  // ItemTypesTxt & equivalence matrix
  const itemTypesCount = 80
  const pItemTypesTxt = m.alloc(itemTypesCount * 0xe4)
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, itemTypesCount)
  m.setU32(pDataTables + 0xc00, 4)
  const pItemTypesEquiv = m.alloc(itemTypesCount * 16)
  m.setU32(pDataTables + 0xc04, pItemTypesEquiv)

  // ItemsTxt
  const itemsCount = 64
  const pItemsTxt = m.alloc(itemsCount * ITEMS_TXT_STRIDE_113C)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)
  m.setU32(pDataTables + 0xc28, itemsCount)
  m.setU32(pDataTables + 0xc2c, pItemsTxt)
  m.setU32(0x6fdef020, 2)
  m.setU32(0x6fdef028, 0x20317468) // 'ht1 ' -> claw idx 2
  m.setU16(0x6fdef02c, 2)
  m.setU32(0x6fdef030, 0x20736831) // '1hs ' -> sword idx 1
  m.setU16(0x6fdef034, 1)

  // ObjectsTxt
  const objectsCount = 128
  const pObjectsTxt = m.alloc(objectsCount * D2ObjectsTxt_SIZE)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, objectsCount)
  m.setU32(pDataTables + 0xc48, objectsCount)
  m.setU32(pDataTables + 0xc4c, pObjectsTxt)

  // LevelsTxt at both +0x1DC and +0xC58
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  for (let lvl = 1; lvl < levelsCount; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    const row = pLevelsTxt + lvl * D2LevelsTxt_SIZE
    m.set(row, D2LevelsTxt.nAct, act)
    m.setU16(row + 0x00, lvl)
    m.setU16(row + 0x10, 5 + (lvl & 15))
    m.setU16(row + 0x16, 10 + (lvl & 15))
    m.setU32(row + 0x1c, 1000)
    m.setU8(row + 0x28, 1)
    m.setU8(row + 0x2b, 3)
  }
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, levelsCount)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)
  m.setU32(0x6fdf0b38, m.alloc(levelsCount * 0x9c))
  const actBounds = [1, 40, 75, 103, 109, 137]
  for (let i = 0; i < actBounds.length; i++) {
    m.setU32(pDataTables + 0xc60 + i * 4, actBounds[i]!)
  }
  const townLevels = [1, 40, 75, 103, 109]
  for (let act = 0; act < 5; act++) {
    m.setU32(0x6fde4084 + act * 4, townLevels[act]!)
  }

  // AnimData & path LUTs
  const pAnimDataTable = m.alloc(0x500)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13a4, 20)
  m.setU32(0x6fdf13b0, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13c4, 20)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))

  for (let i = 0; i < PATH_TYPE_STEP_NUMS_6FDE4138.length; i++) {
    m.setU32((0x6fde4138 + i * 4) >>> 0, PATH_TYPE_STEP_NUMS_6FDE4138[i]! >>> 0)
  }
  for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
    m.setU32((0x6fde4180 + i * 4) >>> 0, PATH_TYPE_FLAGS_6FDE4180[i]! >>> 0)
  }
  m.fill(0x6fde41c8, 64 * 4, 1)
  const f32Buf = new ArrayBuffer(4)
  const f32View = new DataView(f32Buf)
  for (let i = 0; i < 512; i++) {
    f32View.setFloat32(0, Math.sin((i * Math.PI * 2) / 512), true)
    m.setU32((0x6ff7f470 + i * 4) >>> 0, f32View.getUint32(0, true))
  }

  // Game + Acts + QuestControl + Arena
  const pGame = m.alloc(0x2000)
  EVENT_InitTimerQueue113c(m, pGame)
  m.setU8(pGame + 0x6d, nDifficulty & 0xff)
  m.setU32(pGame + 0x1c, 0x12345678)
  m.setU32(pGame + 0x20, 0x0000029a)
  m.setU32(pGame + 0xa8, 100)
  const pObjCtrl = m.alloc(0x20)
  m.setU32(pObjCtrl + 0x00, 0x12345678)
  m.setU32(pObjCtrl + 0x04, 0x9abcdef0)
  m.setU32(pGame + 0x10f0, pObjCtrl)
  const pQuestControl = m.alloc(0x40)
  m.setU32(pQuestControl + 0x08, 1) // initialized flag
  m.setU32(pQuestControl + 0x0c, QUESTRECORD_AllocRecord113c(m, 0))
  m.setU32(pQuestControl + 0x18, 0x11112222)
  m.setU32(pQuestControl + 0x1c, 0x0000029a)
  m.setU32(pGame + 0x10f4, pQuestControl)
  const pArena = m.alloc(0x20)
  m.setU32(pGame + 0x1d28, pArena)

  for (let a = 0; a < 5; a++) {
    const pAct = m.alloc(0x80)
    const pDrlg = m.alloc(0x500)
    const pLvl = m.alloc(0x200)
    const pRx = m.alloc(0x80)
    m.setU32(pRx + 0x28, 0x3100000)
    m.setU32(pLvl + 0x08, 1)
    m.setU32(pLvl + 0x10, pRx)
    m.setU32(pLvl + 0x1d0, townLevels[a]!)
    m.setU32(pDrlg + 0x3f4, 70) // boss tomb level
    m.setU32(pDrlg + 0x47c, pLvl)
    m.setU32(pAct + 0x04, pGame)
    m.setU32(pAct + 0x14, pDrlg)
    m.setU32(pAct + 0x48, pDrlg)
    m.setU32(pGame + 0xbc + a * 4, pAct)
  }

  return {
    m,
    pDataTables,
    pGame,
    pQuestControl,
    pArena,
    pArenaTxt,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pMissilesTxt,
    pItemsTxt,
    pItemTypesEquiv,
    pObjectsTxt,
    pLevelsTxt,
  }
}

function allocRoom(
  m: SparseMemory113c,
  pGame: number,
  subX = 80,
  subY = 80,
  subW = 60,
  subH = 60,
  nLevelId = 2,
) {
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE)
  const pActFlag = m.alloc(16)
  const pGrid = m.alloc(D2RoomCollisionGridStrc_SIZE)
  const pCells = m.alloc(subW * subH * 2)
  const pAct = m.u32(pGame + 0xbc)

  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, pActFlag)
  m.set(pRoom, D2ActiveRoomStrc.pCollisionGrid, pGrid)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileX, subX)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileY, subY)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileWidth, subW)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileHeight, subH)
  m.setU32(pRoom + 0x5c, pAct)

  const ppNear = m.alloc(8)
  m.setU32(ppNear, pRoom)
  m.setU32(pRoom + 0x00, ppNear)
  m.setU32(pRoom + 0x24, 1)

  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, nLevelId)

  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileX, subX)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileY, subY)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileWidth, subW)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileHeight, subH)
  m.set(pGrid, D2RoomCollisionGridStrc.pMapStart, pCells)

  return { pRoom, pRoomEx, pLevel, pGrid, pCells }
}

function allocPlayer(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  unitId = 1,
  x = 100,
  y = 100,
  classId = 0,
) {
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x180)
  const pClient = m.alloc(0x600)
  const pPath = m.alloc(0x200)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const pQuestIntro = m.alloc(0x10)
  const pIntroBitRecord = m.alloc(0x10)
  const pIntroBitBuf = m.alloc(0x40)
  m.setU32(pQuestIntro + 0x04, pIntroBitRecord)
  m.setU32(pIntroBitRecord, pIntroBitBuf)
  const pArenaUnit = m.alloc(0x10)

  m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
  m.set(pPlayer, D2UnitStrc.dwClassId, classId)
  m.set(pPlayer, D2UnitStrc.dwUnitId, unitId)
  m.setU32(pPlayer + 0x10, 1)
  m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
  m.set(pPlayer, D2UnitStrc.pPath, pPath)
  m.set(pPlayer, D2UnitStrc.pAnimData, m.alloc(0x40))
  m.setU32(pPlayer + 0x20, 0x12345678)
  m.setU32(pPlayer + 0x24, 0x9abcdef0)
  m.setU32(pPlayer + 0x80, pGame)
  m.setU32(pPlayer + 0xc4, 0x04)

  m.setU32(pPlayerData + 0x10, pQuestFlags)
  m.setU32(pPlayerData + 0x34, pArenaUnit)
  m.setU32(pPlayerData + 0x60, pQuestIntro)
  m.setU32(pPlayerData + 0x9c, pClient)
  m.setU32(pClient + 0x174, pPlayer)
  m.setU32(pClient + 0x1b4, pRoom)

  const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
  m.setU32(pPlayer + 0x60, pInv)
  m.setU32(pPlayer + 0xa8, m.alloc(0x20))

  m.setU32(pPath + 0x00, (x << 16) >>> 0)
  m.setU32(pPath + 0x04, (y << 16) >>> 0)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pPlayer)

  const pStatListEx = STATLIST_CreateEx113c(m, pPlayer, 0, 0)
  m.setU32(pPlayer + 0x5c, pStatListEx)
  STATLIST_SetUnitStat113c(m, pPlayer, 6, 80 << 8, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 8, 40 << 8, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 9, 100 << 8, 0)
  STATLIST_SetUnitStat113c(m, pPlayer, 12, 20, 0)

  const pAlign = STATLIST_AllocList113c(m, 0, 2, 0, 0, unitId)
  STATLIST_SetState113c(m, pAlign, 0x69)
  STATLIST_SetStat113c(m, pAlign, 0xac, 2, 0)
  STATLIST_MergeStatLists113c(m, pPlayer, pAlign, 1)

  SUNIT_InsertServerUnit113c(m, pGame, pPlayer)
  return { pPlayer, pPlayerData, pClient, pPath, pQuestFlags, pQuestIntro, pArenaUnit, pInv }
}

function allocMonster(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  classId = 1,
  unitId = 100,
  x = 104,
  y = 104,
) {
  const pMon = m.alloc(0x100)
  const pMonData = m.alloc(0x180)
  const pAiCtrl = m.alloc(0x40)
  const pAiGeneral = m.alloc(0x40)
  const pPath = m.alloc(0x200)
  const pDataTables = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const pMonStatsTxt = m.u32(pDataTables + 0xa78)

  m.set(pMon, D2UnitStrc.dwUnitType, 1)
  m.set(pMon, D2UnitStrc.dwClassId, classId)
  m.set(pMon, D2UnitStrc.dwUnitId, unitId)
  m.setU32(pMon + 0x10, 1)
  m.set(pMon, D2UnitStrc.pUnitData, pMonData)
  m.set(pMon, D2UnitStrc.pPath, pPath)
  m.set(pMon, D2UnitStrc.pAnimData, m.alloc(0x40))
  m.setU32(pMon + 0x20, 0x12345678)
  m.setU32(pMon + 0x24, 0x9abcdef0)
  m.setU32(pMon + 0x80, pGame)
  m.setU32(pMon + 0xc4, 0x0c)
  m.setU32(pMon + 0xa8, m.alloc(0x20))

  m.setU32(pMonData + 0x00, (pMonStatsTxt + classId * 0x1a8) >>> 0)
  m.setU32(pMonData + 0x28, pAiGeneral)
  m.setU32(pMonData + 0x2c, pAiCtrl)

  m.setU32(pPath + 0x00, (x << 16) >>> 0)
  m.setU32(pPath + 0x04, (y << 16) >>> 0)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pMon)

  const pStatListEx = STATLIST_CreateEx113c(m, pMon, 0, 0)
  m.setU32(pMon + 0x5c, pStatListEx)
  STATLIST_SetUnitStat113c(m, pMon, 6, 100 << 8, 0)
  STATLIST_SetUnitStat113c(m, pMon, 7, 100 << 8, 0)
  STATLIST_SetUnitStat113c(m, pMon, 12, 15, 0)

  SUNIT_InsertServerUnit113c(m, pGame, pMon)
  return { pMon, pMonData, pAiCtrl, pAiGeneral, pPath }
}

function allocMissile(
  m: SparseMemory113c,
  pGame: number,
  pRoom: number,
  pOwner: number,
  classId = 1,
  unitId = 200,
  x = 100,
  y = 100,
) {
  const pMissile = m.alloc(0x100)
  const pPath = m.alloc(0x200)
  m.set(pMissile, D2UnitStrc.dwUnitType, 3)
  m.set(pMissile, D2UnitStrc.dwClassId, classId)
  m.set(pMissile, D2UnitStrc.dwUnitId, unitId)
  m.setU32(pMissile + 0x10, 0)
  m.set(pMissile, D2UnitStrc.pPath, pPath)
  m.set(pMissile, D2UnitStrc.pAnimData, m.alloc(0x40))
  m.setU32(pMissile + 0x20, 0x11223344)
  m.setU32(pMissile + 0x24, 0x55667788)
  m.setU32(pMissile + 0x80, pGame)
  m.setU32(pMissile + 0x94, m.u32(pOwner))
  m.setU32(pMissile + 0x98, m.u32(pOwner + 0x0c))
  m.setU32(pMissile + 0xc8, 1 << 10)
  MISSILE_AllocMissileData113c(m, pMissile)
  STATLIST_CreateEx113c(m, pMissile, 0, 0)
  m.setU32(pPath + 0x00, (x << 16) >>> 0)
  m.setU32(pPath + 0x04, (y << 16) >>> 0)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pMissile)
  MISSILE_SetSkill113c(m, pMissile, 1)
  MISSILE_SetLevel113c(m, pMissile, 2)
  MISSILE_SetTotalFrames113c(m, pMissile, 10)
  MISSILE_SetRemainingFrames113c(m, pMissile, 6)
  return { pMissile, pPath, pMissileData: m.u32(pMissile + 0x14) }
}

describe('K2 Disassembly Verification Wave 8 (148 promoted D2Game VAs across w3b3, laneJ, w6b5, w4b7)', () => {
  it('tracks exactly 148 unique promoted VAs across all 4 Wave 8 shards', () => {
    expect(W3B3_PROMOTED_VAS.length).toBe(37)
    expect(LANEJ_PROMOTED_VAS.length).toBe(37)
    expect(W6B5_PROMOTED_VAS.length).toBe(37)
    expect(W4B7_PROMOTED_VAS.length).toBe(37)
    const unique = new Set([
      ...W3B3_PROMOTED_VAS,
      ...LANEJ_PROMOTED_VAS,
      ...W6B5_PROMOTED_VAS,
      ...W4B7_PROMOTED_VAS,
    ])
    expect(unique.size).toBe(148)
  })

  it('exercises all 37 promoted VAs in k2w3-b3 (src/d2kern-113c/game/k2-w3b3-113c.ts)', () => {
    const w = createWave8World()
    const { m, pGame, pSkillsTxt, pMissilesTxt } = w
    const { pRoom, pLevel } = allocRoom(m, pGame, 80, 80, 160, 160, 1)
    const { pPlayer, pQuestIntro } = allocPlayer(m, pGame, pRoom, 1, 100, 100)
    const { pMissile, pPath: pMissilePath, pMissileData } = allocMissile(m, pGame, pRoom, pPlayer, 1, 200, 100, 100)

    const m1 = pMissilesTxt + 1 * 0x1a4
    m.setU16(m1 + 0x18, 2)
    m.setU16(m1 + 0x24, 2)
    m.setU16(m1 + 0x26, 3)
    m.setU16(m1 + 0x28, 4)
    m.setU16(m1 + 0x2a, 0xffff)
    m.setU16(m1 + 0x36, 1)
    m.setU32(m1 + 0x38, 4)
    m.setU32(m1 + 0x3c, 2)
    m.setU32(m1 + 0x4c, 2)
    m.setU32(m1 + 0x78, 50)
    m.setU16(m1 + 0x96, 20)
    m.setU16(m1 + 0x98, 5)
    const s1 = pSkillsTxt + 1 * D2SkillsTxt_SIZE
    m.setU16(s1 + 0x82, 2)

    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjectsTxt = m.alloc(0x200)
    m.setU32(pObj + 0x00, 2)
    m.setU32(pObj + 0x04, 0x3d)
    m.setU32(pObj + 0x0c, 77)
    m.setU32(pObj + 0x10, 1)
    m.setU32(pObj + 0x14, pObjData)
    const pObjInit = m.alloc(0x30)
    m.setU32(pObjInit + 0x00, pGame)
    m.setU32(pObjInit + 0x04, pObj)
    m.setU32(pObjInit + 0x08, pRoom)
    m.setU32(pObjInit + 0x10, pObjectsTxt)

    const pIoCoord = m.alloc(8)
    const ppOutRoom = m.alloc(4)
    m.setU32(pIoCoord, 90)
    m.setU32(pIoCoord + 4, 90)

    const pDmg = m.alloc(0x70)
    STATLIST_SetUnitStat113c(m, pMissile, 0x38, 200, 0)

    const pFilterCtx = m.alloc(0x20)
    m.setU32(pFilterCtx + 0x00, pMissile)
    m.setU32(pFilterCtx + 0x04, pGame)
    m.setU32(pFilterCtx + 0x08, m1)
    m.setU32(pFilterCtx + 0x0c, pPlayer)

    const pAuraCtx = m.alloc(0x20)
    const pUserCtx = m.alloc(0x20)
    m.setU32(pAuraCtx + 0x00, pGame)
    m.setU32(pAuraCtx + 0x08, 1)
    m.setU32(pAuraCtx + 0x0c, pUserCtx)
    m.setU32(pUserCtx + 0x00, pPlayer)
    m.setU32(pUserCtx + 0x04, pMissile)
    m.setU32(pUserCtx + 0x08, 1)
    m.setU32(pUserCtx + 0x0c, 2)
    m.setU32(pUserCtx + 0x10, 2)
    m.setU32(pUserCtx + 0x14, 2)

    beginVaTrace113c()
    OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c(m, pObjInit)
    expect(m.u8(pObjData + 0x04)).toBe(0x27)
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 111)
    OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c(m, pObjInit)
    expect(m.u8(pObjData + 0x04)).toBe(0x7d)
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 1)

    expect(QUESTS_CheckLevelTransitionBlocked_6FC54020_113c(m, pGame, 1, pPlayer, 1)).toBe(0)
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, pRoom, pIoCoord, 1, 0x01, ppOutRoom, 1)
    QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c(m, pPlayer, 0, pGame)
    expect(m.u32(pQuestIntro + 0x04)).not.toBe(0)
    QUESTS_SendNpcIntroPacket91_6FC55B60_113c(m, pPlayer, 0, pGame)

    MISSILES_ApplyColdLengthToDamage_6FC59080_113c(m, pMissile, 0, pDmg)
    expect(m.u32(pDmg + 0x34)).toBe(100)
    MISSILES_InitGuidedOrLinearPath_6FC597C0_113c(m, pMissile, pPlayer)
    expect(MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c(m, pGame, pMissile, pPlayer)).toBe(1)
    expect(MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c(m, pGame, pMissile, pPlayer)).toBe(0)
    expect(MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c(m, pGame, pMissile, pPlayer)).toBe(3)
    expect(MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c(m, pGame, pMissile, pPlayer)).toBe(1)
    expect(MISSILES_TargetFilter_PlayersAndAlignedMonsters_6FC5AD70_113c(m, 0, pFilterCtx)).toBe(0)
    expect(MISSILES_TargetFilter_MonstersOnly_6FC5ADD0_113c(m, pPlayer, pFilterCtx)).toBe(0)
    expect(MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SrvDmg12_Nova64RingSubMissiles_6FC5C700_113c(m, pGame, pMissile, 0)).toBe(3)
    expect(MISSILES_SrvDmg13_PoisonExplosionCloud_6FC5C990_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c(m, pMissile, 2, pGame, pPlayer, 1, 2, 2)).toBe(1)
    expect(MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c(m, pAuraCtx, pPlayer)).toBe(1)
    expect(MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c(m, pAuraCtx, pPlayer)).toBe(1)
    expect(MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c(m, pGame, pMissile, 0)).toBe(0)
    MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c(m, pMissile, pGame, 2, 10, 6)
    expect(MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c(m, 2, pMissile, pGame, 2, 2, 0)).toBeGreaterThan(0)
    m.setU32(pMissilePath + 0x3c, 8)
    expect(MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c(m, pMissile, 10, pGame, 2, 5)).toBe(0)
    m.setU32(pRoom + 0x0c, 0)
    MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c(m, pGame, pMissile, 1, 2, 5)
    expect(
      MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c(m, pMissile, 2, pGame, pPlayer, 1, 2, 4, 4, 10),
    ).toBe(1)
    expect(MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c(m, pGame, pMissile, pPlayer)).toBe(3)
    expect(MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c(m, pGame, pMissile, pPlayer)).toBe(0)
    expect(MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c(m, pGame, pMissile, pPlayer)).toBe(1)
    expect(MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c(m, pGame, pMissile, pPlayer)).toBe(3)
    m.setU32(pMissileData + 0x18, 0)
    m.setU32(pMissileData + 0x1c, 1)
    expect(MISSILES_SrvDo12_RandomWalkStepProjectile_6FC5F890_113c(m, pGame, pMissile)).toBeTypeOf('number')
    expect(MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c(m, pGame, pMissile)).toBeTypeOf('number')
    MISSILE_SetTargetX113c(m, pMissile, 0)
    MISSILE_SetTargetY113c(m, pMissile, 1)
    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 6)
    expect(MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c(m, pGame, pMissile)).toBe(1)
    expect(MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c(m, pGame, pMissile)).toBeTypeOf('number')
    expect(MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c(m, pGame, pMissile)).toBeTypeOf('number')

    const hits = endVaTrace113c()
    for (const va of W3B3_PROMOTED_VAS) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA ${formatD2GameHit(va)} to fire`).toBe(true)
    }
  })

  it('exercises all 37 promoted VAs in k2w1-laneJ-0x6fc4 (src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c.ts)', () => {
    const w = createWave8World()
    const { m, pGame, pMonStatsTxt, pSkillsTxt, pObjectsTxt } = w
    const { pRoom } = allocRoom(m, pGame, 80, 80, 60, 60, 2)
    const { pPlayer, pClient } = allocPlayer(m, pGame, pRoom, 1, 100, 100)
    const { pMon } = allocMonster(m, pGame, pRoom, 12, 101, 104, 104)

    const pMonRec = pMonStatsTxt + 12 * 0x1a8
    m.setU16(pMonRec + 0x80, 100)
    m.setU16(pMonRec + 0x56, 5)
    const pSkill = m.alloc(0x40)
    m.setU32(pSkill + 0x00, pSkillsTxt + 5 * D2SkillsTxt_SIZE)
    SKILLS_SetParam3113c(m, pSkill, 10)
    SKILLS_SetParam4113c(m, pSkill, 10)

    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    m.setU32(pObjData + 0x00, pObjectsTxt + 10 * D2ObjectsTxt_SIZE)
    const pObjPath = m.alloc(0x20)
    m.setU32(pObjPath + 0x00, pRoom)
    m.setU32(pObjPath + 0x0c, 100)
    m.setU32(pObjPath + 0x10, 100)
    m.setU32(pObj + 0x00, 2)
    m.setU32(pObj + 0x04, 10)
    m.setU32(pObj + 0x0c, 55)
    m.setU32(pObj + 0x10, 0)
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObj + 0x20, 0x12345678)
    m.setU32(pObj + 0x24, 0x9abcdef0)
    m.setU32(pObj + 0x2c, pObjPath)
    const pObjSeed = m.alloc(8)
    m.setU32(pObjSeed + 0x00, 0x12345678)
    m.setU32(pObjSeed + 0x04, 0x9abcdef0)
    const pObjInit = m.alloc(0x30)
    m.setU32(pObjInit + 0x00, pGame)
    m.setU32(pObjInit + 0x04, pObj)
    m.setU32(pObjInit + 0x08, pRoom)
    m.setU32(pObjInit + 0x0c, pObjSeed)
    m.setU32(pObjInit + 0x10, pObjectsTxt + 10 * D2ObjectsTxt_SIZE)
    m.setU32(pObjectsTxt + 10 * D2ObjectsTxt_SIZE + 0xdc, 0x200)

    const pRoomCoords = m.alloc(0x10)
    m.setU32(pRoomCoords + 0x00, 80)
    m.setU32(pRoomCoords + 0x04, 80)
    m.setU32(pRoomCoords + 0x08, 60)
    m.setU32(pRoomCoords + 0x0c, 60)
    const pPos = m.alloc(8)
    m.setU32(pPos + 0x00, 100)
    m.setU32(pPos + 0x04, 100)

    const pLock = m.alloc(0x20)
    m.setU32(pGame + 0x18, pLock)
    const pQuest = m.alloc(0x100)
    m.setU32(pQuest + 0x00, 0x0f) // quest 15 for OBJECTS_InitFn23_SyncQuest0FObjectAnimMode
    m.setU32(pQuest + 0x04, pGame)
    m.setU32(w.pQuestControl + 0x00, pQuest)
    const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
    const pOutStateByte = m.alloc(4)
    const ppOutClient = m.alloc(4)
    m.setU8(pClient + 0x3d4, 0x20)
    m.setU32(pClient + 0x0c, 1)
    m.setU32(pGame + 0x1098, pClient)

    beginVaTrace113c()
    MONUMOD_ScheduleInitialAiAndEvent7_6FC43320_113c(m, pGame, pMon)
    m.setU32(pMon + 0x10, 3)
    MONUMOD_GetHitForceDeathAndScheduleEvent7_6FC43390_113c(m, pGame, pMon)
    expect(m.u32(pMon + 0x10)).toBe(0)
    MONUMOD_RollSelfResurrectEvent7_6FC43570_113c(m, pGame, pMon)
    m.setU32(pMon + 0x10, 1)
    MONUMOD_InitUMod41ScheduleEvent7_6FC469F0_113c(m, pMon)
    expect(PLRMODE_IsDualWieldingClaws_6FC46A30_113c(m, pPlayer)).toBe(0)
    expect(PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c(m, 5, 102, pPlayer, 102)).toBeTypeOf('number')
    expect(PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c(m, pSkill, pGame, pPlayer, 105, 105)).toBeTypeOf('number')
    expect(SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c(m, pGame, pPlayer, 5, 1)).toBe(0)
    expect(SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c(m, pGame, pPlayer, 5, 1)).toBe(0)
    expect(PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c(m, pPlayer, pMon, pSkill, pGame)).toBeTypeOf('number')

    GAME_LeaveGameCriticalSection_6FC49BA0_113c(m, pGame)
    const slot = GAME_ReserveGlobalGameSlot_6FC4A220_113c(m)
    expect(slot).toBeGreaterThanOrEqual(0)
    GAME_CommitGlobalGameSlot_6FC4A2D0_113c(m, pGame, slot)
    CLIENT_SelectFlag20ClientCallback_6FC4A700_113c(m, pClient, ppOutClient)
    expect(m.u32(ppOutClient)).toBe(pClient)
    CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c(m, pClient, pMon)
    CLIENT_BroadcastPlayerLeftPacket5C_6FC4BED0_113c(m, pClient, pGame)

    expect(OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c(m, pRoomCoords, pPos, pRoom, 2, 2)).toBe(1)
    expect(OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c(m, pRoomCoords, pPos, 2, pRoom, 2)).toBe(1)
    OBJECTS_InitFn26_SetAnimMode1_6FC4E730_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(1)
    m.setU32(pObj + 0x10, 0)
    OBJECTS_InitFn14_SetAnimMode1_6FC4E740_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(1)
    OBJECTS_InitFn34_RandomSetAnimMode1_6FC4EC70_113c(m, pObjInit)
    OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c(m, pObjInit)
    m.setU32(pObj + 0x10, 1)
    OBJECTS_InitFn51_ScheduleEvent9IfOperatingOrOpened_6FC532F0_113c(m, pObjInit)
    OBJECTS_InitFn11_InitTownPortal_6FC53330_113c(m, pObjInit)
    OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c(m, pObjInit)
    OBJECTS_InitFn58_ScheduleRandomEvent8_6FC53680_113c(m, pObjInit)
    OBJECTS_InitFn24_ScheduleEvent3_6FC536D0_113c(m, pObjInit)
    OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c(m, pObjInit)
    OBJECTS_InitFn10_InitRogueFireAndScheduleEvent_6FC53740_113c(m, pObjInit)
    OBJECTS_InitFn23_SyncQuest0FObjectAnimMode_6FC54370_113c(m, pObjInit)

    expect(QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, pGame, 1, 0)).toBe(0)
    expect(QUESTS_CheckNotIntro_6FC53970_113c(m, pGame, 1)).toBeTypeOf('number')
    QUESTS_ResolveDefaultStatusByte_6FC53A30_113c(m, pQuest, pQuestFlags, pOutStateByte)
    expect(m.u8(pOutStateByte)).toBeGreaterThanOrEqual(0)
    QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 25, pQuest, 0x6fce58b0)
    expect(QUESTS_GetQuestSeedPtr_6FC53D90_113c(m, pGame)).toBe((w.pQuestControl + 0x18) >>> 0)
    expect(QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuest, pObj, pGame)).toBe(1)
    const pChainHead = m.u32(pObj + 0x70)
    QUESTS_FreeUnitQuestChain_6FC53FF0_113c(m, pGame, pChainHead)

    const hits = endVaTrace113c()
    for (const va of LANEJ_PROMOTED_VAS) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA ${formatD2GameHit(va)} to fire`).toBe(true)
    }
  })

  it('exercises all 37 promoted VAs in k2w6-b5 (src/d2kern-113c/game/k2-w6b5-113c.ts)', () => {
    const w = createWave8World()
    const { m, pGame, pSkillsTxt } = w
    const { pRoom } = allocRoom(m, pGame, 80, 80, 60, 60, 1)
    const { pPlayer } = allocPlayer(m, pGame, pRoom, 1, 100, 100)
    const { pMon, pAiCtrl } = allocMonster(m, pGame, pRoom, 1, 10, 104, 104)

    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    m.setU32(pSkill + 0x00, pSkillsTxt + 5 * D2SkillsTxt_SIZE)
    m.setU32(pSkillList + 0x00, pSkill)
    m.setU32(pSkillList + 0x0c, pSkill)
    m.setU32(pMon + 0xa8, pSkillList)

    const pJoinQueue = m.alloc(0x10)
    const pNode = m.alloc(0x10)
    m.setU32(pNode + 0x00, 1)
    m.setU32(pJoinQueue + 0x04, pNode)

    const pPortal = m.alloc(0x100)
    const pPortalPath = m.alloc(0x20)
    m.setU32(pPortal + 0x00, 2)
    m.setU32(pPortal + 0x04, 0x3b)
    m.setU32(pPortal + 0x0c, 50)
    m.setU32(pPortal + 0x80, pGame)
    m.setU32(pPortalPath + 0x00, pRoom)
    m.setU32(pPortalPath + 0x0c, 100)
    m.setU32(pPortalPath + 0x10, 100)
    m.setU32(pPortal + 0x2c, pPortalPath)

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x04, 1)
    m.setU32(pItem + 0x0c, 333)
    m.setU32(pItem + 0x14, pItemData)
    m.setU32(pItemData + 0x00, 4)
    const pInv = m.alloc(0x40)
    m.setU32(pInv + 0x00, INVENTORY_SIGNATURE_113C)
    m.setU32(pInv + 0x0c, pItem)
    m.setU32(pPlayer + 0x60, pInv)

    const pQuest = m.alloc(0x100)
    const pState = m.alloc(0x100)
    m.setU32(pState + 0x20, pRoom)
    m.setU32(pQuest + 0x04, pGame)
    m.setU32(pQuest + 0x18, pState)

    const pForgeObj = m.alloc(0x100)
    m.setU32(pForgeObj + 0x00, 2)
    m.setU32(pForgeObj + 0x04, 376)
    m.setU32(pForgeObj + 0x0c, 55)
    m.setU32(pForgeObj + 0x2c, pPortalPath)
    const pObjInit = m.alloc(0x30)
    m.setU32(pObjInit + 0x00, pGame)
    m.setU32(pObjInit + 0x04, pForgeObj)

    const pOp = m.alloc(0x20)
    const pChest = m.alloc(0x100)
    m.setU32(pChest + 0x00, 2)
    m.setU32(pChest + 0x04, 1)
    m.setU32(pChest + 0x0c, 77)
    m.setU32(pChest + 0x10, 2)
    m.setU32(pChest + 0x2c, pPortalPath)
    m.setU32(pOp + 0x00, pGame)
    m.setU32(pOp + 0x04, pChest)

    const pCoords = m.alloc(0x20)
    m.setU32(pCoords + 0x0c, 110)
    m.setU32(pCoords + 0x10, 110)

    const ppRegionTable = m.alloc(140 * 4)
    const pSeed = m.alloc(8)
    const pPkt5D = m.alloc(8)
    m.setU8(pPkt5D + 0, 0x5d)
    m.setU8(pPkt5D + 1, 2)
    m.setU32(pPkt5D + 2, 99)
    const pPkt5E = m.alloc(8)
    m.setU8(pPkt5E + 0, 0x5e)
    m.setU8(pPkt5E + 1, 2)
    m.setU8(pPkt5E + 2, 1)
    m.setU32(pPkt5E + 3, 99)
    const pPkt5 = m.alloc(8)
    m.setU32(pPkt5 + 1, 777)

    beginVaTrace113c()
    expect(
      SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c(m, 5, pGame, pMon, pPlayer, pSkillsTxt, 1, 0),
    ).toBeTypeOf('number')
    expect(SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c(m, pGame, pMon, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c(m, pGame, pMon, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c(m, pGame, pMon, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c(m, pGame, pMon, 5, 1)).toBe(0)
    PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c(m, pGame, pJoinQueue)
    SKILLS_RespecPlayerClassSkills_6FCC1280_113c(m, pPlayer, pGame)

    m.fill(0, 0x100, 0)
    m.setU32(0x34, 3)
    expect(() => PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(m, pGame, pPortal, 1, 1)).toThrow()
    m.fill(0, 0x100, 0)

    SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c(m, pPlayer, 50)
    expect(ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c(m, pGame, pPlayer, 0, pItem)).toBe(1)
    expect(ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c(m, 0, pPlayer, 0, 0)).toBe(0)
    expect(ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c(m, pPlayer, pPlayer, 0, 0)).toBe(0)
    ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c(m, pGame, pPlayer, pItem, 0, 0, 0)
    ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c(m, pGame, pPlayer, 0)
    expect(ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c(m, pGame, 0, 0, 0, 1, 1)).toBe(0)

    AIBAAL_ExecuteCommandAction_6FCD8070_113c(m, pPlayer, pMon, 5, pGame, pAiCtrl, pCoords)
    ACT4Q2_InitHellforgeObject_6FCD9E80_113c(m, pObjInit)
    expect(m.u32(pForgeObj + 0x10)).toBe(3)
    ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c(m, pGame)
    expect(ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c(m, pGame, pQuest)).toBe(1)
    ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c(m, pState, pGame)

    NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c(m, pGame, 999, pPlayer)
    NPCS_CainIdentifyAllItems_6FCDDB10_113c(m, 999, pPlayer, pGame)
    expect(ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c(m, pGame, pQuest)).toBe(1)
    expect(ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c(m, pGame, pQuest)).toBe(0)
    ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c(m, pState, pQuest)
    expect(ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c(m, pGame, pQuest)).toBe(1)
    ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c(m, pGame, pQuest)
    expect(ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c(m, pGame, pQuest)).toBe(1)
    QUEST0D_InitTemplePortalObject_6FCE9ED0_113c(m, pObjInit)
    expect(ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c(m, pOp)).toBe(0)
    expect(ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c(m, pOp)).toBe(0)
    expect(ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c(m, pOp)).toBe(0)

    MONREG_InitAllActMonsterRegions_6FCEAB30_113c(m, 0xcafebabe, 0, ppRegionTable, pSeed, 0, 1)
    expect(m.u32(pSeed)).toBe(0xcafebabe)
    expect(C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c(m, pGame, pPlayer, pPkt5D, 6)).toBe(0)
    expect(C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c(m, pGame, pPlayer, pPkt5E, 7)).toBe(0)
    expect(C2S_ValidatePacket5ByteItem_6FCED4F0_113c(m, pGame, pPlayer, pPkt5, 5)).toBe(1)
    expect(C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c(m, pGame, 777, pPlayer)).toBe(1)

    const hits = endVaTrace113c()
    for (const va of W6B5_PROMOTED_VAS) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA ${formatD2GameHit(va)} to fire`).toBe(true)
    }
  })

  it('exercises all 37 promoted VAs in k2w4-b7 (src/d2kern-113c/game/k2-w4b7-113c.ts)', () => {
    const w = createWave8World()
    const { m, pGame, pMonStatsTxt, pMonStats2Txt, pSkillsTxt } = w
    const { pRoom } = allocRoom(m, pGame, 80, 80, 60, 60, 2)
    const { pPlayer, pArenaUnit } = allocPlayer(m, pGame, pRoom, 1, 100, 100)
    const { pMon, pAiCtrl, pPath: pMonPath } = allocMonster(m, pGame, pRoom, 1, 101, 106, 106)
    const { pMissile } = allocMissile(m, pGame, pRoom, pMon, 1, 201, 106, 106)

    const pAiTick = m.alloc(0x40)
    m.setU32(pAiTick + 0x00, pAiCtrl)
    m.setU32(pAiTick + 0x04, 0)
    m.setU32(pAiTick + 0x08, pPlayer)
    m.setU32(pAiTick + 0x0c, 1)
    m.setU32(pAiTick + 0x10, 0)
    m.setU32(pAiTick + 0x14, 5)
    m.setU32(pAiTick + 0x18, 1)
    m.setU32(pAiTick + 0x1c, pMonStatsTxt + 1 * 0x1a8)
    m.setU32(pAiTick + 0x20, pMonStats2Txt + 1 * 0x134)

    const pSlopes = m.alloc(20)
    m.setU32(pSlopes + 0x00, 10)
    m.setU32(pSlopes + 0x04, 20)
    m.setU32(pSlopes + 0x08, 30)
    m.setU32(pSlopes + 0x0c, 40)
    m.setU32(pSlopes + 0x10, 50)

    const pItem = m.alloc(0x100)
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x0c, 99)
    ITEMS_AllocItemData113c(m, 0, pItem)
    const pDmg = m.alloc(0x80)
    const pCtx = m.alloc(0x80)

    const pSkillList = m.alloc(0x40)
    const pSkill = m.alloc(0x40)
    m.setU32(pMon + 0xa8, pSkillList)
    m.setU32(pSkillList + 0x0c, pSkill)
    m.setU32(pSkillList + 0x10, pSkill)
    m.setU32(pSkill + 0x00, pSkillsTxt + 1 * D2SkillsTxt_SIZE)
    PATH_SetTargetUnit113c(m, pMonPath, pPlayer)

    beginVaTrace113c()
    MONAI_UnburrowThink_6FCC59B0_113c(m, pGame, pMon, pAiTick)
    MONAI_NestOrMeleeWanderThink_6FCC5B30_113c(m, pGame, pMon, pAiTick)
    MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c(m, pGame, pMon, pAiTick)
    MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c(m, pGame, pMon, pAiTick)
    MONAI_MeleeAndRangedSkillThink_6FCC6530_113c(m, pGame, pMon, pAiTick)
    expect(MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c(m, 0, pPlayer, pMon, 1, pGame, 0, 100, 100)).toBeTypeOf('number')
    MONAI_PutridDefilerThink_6FCC7290_113c(m, pGame, pMon, pAiTick)
    MONAI_ImpregnateChaseThink_6FCC7F60_113c(m, pGame, pMon, pAiTick)
    expect(MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(m, pSlopes, 45)).toBe(890)
    expect(ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c(m, pPlayer, pMon, pDmg, 0)).toBe(0)
    expect(ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c(m, pPlayer, pMon, pDmg, 0)).toBe(0)
    expect(ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c(m, 0, pPlayer, pMon, pDmg, 0)).toBe(0)
    expect(ITEMMODS_ApplyKnockback_6FCCCE60_113c(m, pPlayer, pMon, pDmg, 0)).toBe(0)
    ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c(m, pPlayer, 0)
    expect(ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c(m, 220, pPlayer, pItem)).toBe(1)
    SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c(m, pPlayer, 1, pGame, 1)
    expect(ITEMMODS_ApplyMonsterFlee_6FCCD580_113c(m, pGame, 0, pPlayer, pMon, pDmg, 0)).toBe(0)
    expect(ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c(m, pGame, pMon, pPlayer, pDmg, 0)).toBe(0)
    expect(ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c(m, pGame, pMon, pPlayer, pDmg, 0)).toBe(0)
    expect(ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c(m, pGame, pMon, pPlayer, pDmg, 0)).toBe(0)
    SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c(m, pPlayer, pGame, 1, 1, 1)
    expect(MONSTER_MorphMonsterClassId_6FCCFC50_113c(m, pMon, pGame, 1, 1)).toBe(0)
    expect(AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, pMon, 90, 90)).toBeGreaterThanOrEqual(0)
    expect(MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c(m, pMon, 1)).toBe(0)
    expect(MONAI_ForEachPackMemberWithFilter_6FCD1320_113c(m, pMon, pGame, 0, 0)).toBe(0)
    expect(MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c(m, pGame, pMon, pMon, pCtx)).toBe(0)
    MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c(m, pPlayer, pGame, pMon, 50)
    ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, pPlayer, 0, pGame, pPlayer)
    expect(m.u32(pArenaUnit)).toBe(25)
    expect(MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c(m, pMon)).toBe(0)
    m.setU32(pSkillList + 0x10, pSkill)
    expect(MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c(m, pGame, pMon, 1, 1)).toBe(1)
    expect(MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c(m, pMon, 1, 1)).toBe(1)
    expect(MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c(m, pMon, 1, 1)).toBe(1)
    expect(MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c(m, pMon)).toBe(1)
    MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c(m, pMissile, 7)
    expect(MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c(m, 1, pMissile, pMon, 3)).toBe(1)
    expect(MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c(m, pGame, pMon, 1, 1)).toBe(1)
    expect(MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c(m, pGame, pMon)).toBe(1)

    const hits = endVaTrace113c()
    for (const va of W4B7_PROMOTED_VAS) {
      expect(hits.has(formatD2GameHit(va)), `Expected VA ${formatD2GameHit(va)} to fire`).toBe(true)
    }
  })

  describe('Wave 8 1.13c disassembly bug-fix regressions', () => {
    it('k2-w4b7: canonical AI_ApproachTarget113c (0x6FD12540) and seedRoll (0x6FC21180) fire without stand-ins', () => {
      const w = createWave8World()
      const { m, pGame, pMonStatsTxt, pMonStats2Txt } = w
      const { pRoom } = allocRoom(m, pGame, 80, 80, 60, 60, 2)
      const { pPlayer } = allocPlayer(m, pGame, pRoom, 1, 115, 115)
      const { pMon, pAiCtrl } = allocMonster(m, pGame, pRoom, 2, 102, 100, 100)

      const rec = pMonStatsTxt + 2 * 0x1a8
      m.setU16(rec + 0x56, 100) // aip1 = 100 -> enter wSkill1 roll2 branch
      m.setU16(rec + 0x5c, 100) // aip2 = 100 -> enter AI_ApproachTarget branch
      m.setU16(rec + 0x62, 100) // aip3 = 100
      m.setU16(rec + 0x170, 5) // wSkill1 = 5
      m.setU8(rec + 0x180, 7) // bMode1 = 7

      const pAiTick = m.alloc(0x40)
      m.setU32(pAiTick + 0x00, pAiCtrl)
      m.setU32(pAiTick + 0x08, pPlayer)
      m.setU32(pAiTick + 0x14, 15)
      m.setU32(pAiTick + 0x18, 1) // in melee range -> rolls wSkill1 via 0x6FC21180
      m.setU32(pAiTick + 0x1c, rec)
      m.setU32(pAiTick + 0x20, pMonStats2Txt + 2 * 0x134)

      beginVaTrace113c()
      MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c(m, pGame, pMon, pAiTick)
      const hitsSkillRoll = endVaTrace113c()
      expect(hitsSkillRoll.has(formatD2GameHit(0x6fc21180))).toBe(true)

      // Out of melee range (inRange = 0, aip2 = 100) -> calls canonical AI_ApproachTarget113c (0x6FD12540)
      m.setU32(pAiTick + 0x18, 0)
      beginVaTrace113c()
      MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c(m, pGame, pMon, pAiTick)
      const hitsApproach = endVaTrace113c()
      expect(hitsApproach.has(formatD2GameHit(0x6fd12540))).toBe(true)
    })

    it('k2-w4b7: 0x6FCCCF10 and 0x6FCCCFD0 enqueue S2C packet 0x3F on channel 1 into client queue', () => {
      const w = createWave8World()
      const { m, pGame } = w
      const { pRoom } = allocRoom(m, pGame)
      const { pPlayer, pClient, pInv } = allocPlayer(m, pGame, pRoom, 1, 100, 100)
      const pItem = m.alloc(0x100)
      m.setU32(pItem + 0x00, 4)
      m.setU32(pItem + 0x0c, 0x12345678)
      ITEMS_AllocItemData113c(m, 0, pItem)
      // Link pItem as first item in inventory
      m.setU32(pInv + 0x0c, pItem)

      // 0x6FCCCFD0 sets cmdFlag 4 and queues 8-byte 0x3F packet with wSkillId=220
      expect(ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c(m, 220, pPlayer, pItem)).toBe(1)
      const pktsAfterUse = readQueuedClientBytes(m, pClient)
      expect(pktsAfterUse.length).toBe(1)
      expect(pktsAfterUse[0]!.length).toBe(8)
      expect(pktsAfterUse[0]![0]).toBe(0x3f)
      expect(pktsAfterUse[0]![6]! | (pktsAfterUse[0]![7]! << 8)).toBe(220)

      // 0x6FCCCF10 scans inventory for cmdFlag 4, clears it, and appends another 8-byte 0x3F packet
      ITEMS_SetOrClearCommandFlags113c(m, pItem, 4, 1)
      ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c(m, pPlayer, 0)
      const pktsAfterFlush = readQueuedClientBytes(m, pClient)
      expect(pktsAfterFlush.length).toBe(1)
      expect(pktsAfterFlush[0]!.length).toBe(16)
      expect(pktsAfterFlush[0]![8]).toBe(0x3f)
      expect(pktsAfterFlush[0]![9]).toBe(0xff)
    })

    it('k2-w4b7: 0x6FCD1320 resolves boss (dwBossType +0x30, dwBossId +0x2C) and dispatches 0x6FCD06F0 filter', () => {
      const w = createWave8World()
      const { m, pGame } = w
      const { pRoom } = allocRoom(m, pGame)
      const { pMon: pBoss, pAiGeneral: pBossAi } = allocMonster(m, pGame, pRoom, 1, 500, 100, 100)
      const { pMon: pMinion, pAiGeneral: pMinionAi } = allocMonster(m, pGame, pRoom, 1, 501, 102, 102)
      // Link boss & minion via D2AiGeneralStrc (+0x28 pGame, +0x2C dwBossId, +0x30 dwBossType, +0x34 pMinionList)
      m.setU32(pBossAi + 0x28, pGame)
      m.setU32(pBossAi + 0x2c, 500)
      m.setU32(pBossAi + 0x30, 1)
      m.setU32(pMinionAi + 0x28, pGame)
      m.setU32(pMinionAi + 0x2c, 500) // dwBossId
      m.setU32(pMinionAi + 0x30, 1) // dwBossType = UNIT_MONSTER
      const pMinionNode = m.alloc(0x10)
      m.setU32(pMinionNode + 0x00, 501) // member GUID (pMinion)
      m.setU32(pMinionNode + 0x04, 0)
      m.setU32(pBossAi + 0x34, pMinionNode)

      beginVaTrace113c()
      const found = MONAI_ForEachPackMemberWithFilter_6FCD1320_113c(m, pMinion, pGame, 0, 0)
      const hits = endVaTrace113c()
      expect(found).toBe(0)
      expect(hits.has(formatD2GameHit(0x6fcd06f0))).toBe(true)
      expect(pBoss).not.toBe(0)
    })

    it('k2-w4b7: 0x6FCD2820 enforces exact Arena.cpp assert lines (0x73, 0x77, 0x6C, 0x7D, 0x8C)', () => {
      const w = createWave8World()
      const { m, pGame } = w
      const { pRoom } = allocRoom(m, pGame)
      const { pPlayer, pPlayerData } = allocPlayer(m, pGame, pRoom, 1, 100, 100)

      // Null player -> Arena.cpp:0x73
      expect(() => ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, 0, 0, pGame, pPlayer)).toThrow(D2CommonAssertError)
      // nScoreType >= 7 -> Arena.cpp:0x7D
      expect(() => ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, pPlayer, 7, pGame, pPlayer)).toThrow(D2CommonAssertError)
      // Null pArenaUnit -> Arena.cpp:0x77
      const savedArenaUnit = m.u32(pPlayerData + 0x34)
      m.setU32(pPlayerData + 0x34, 0)
      expect(() => ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, pPlayer, 0, pGame, pPlayer)).toThrow(D2CommonAssertError)
      m.setU32(pPlayerData + 0x34, savedArenaUnit)
      // Null pGameArena -> Arena.cpp:0x6C
      const savedGameArena = m.u32(pGame + 0x1d28)
      m.setU32(pGame + 0x1d28, 0)
      expect(() => ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, pPlayer, 0, pGame, pPlayer)).toThrow(D2CommonAssertError)
      m.setU32(pGame + 0x1d28, savedGameArena)
      // Percentage mode (2) with missing target arena unit -> Arena.cpp:0x8C
      const { pPlayer: pOther, pPlayerData: pOtherData } = allocPlayer(m, pGame, pRoom, 2, 105, 105)
      m.setU32(pOtherData + 0x34, 0)
      expect(() => ARENA_UpdatePlayerArenaScore_6FCD2820_113c(m, pPlayer, 2, pGame, pOther)).toThrow(D2CommonAssertError)
    })

    it('k2-w6b5: 0x6FCB2BB0 invokes canonical 0x6FCFE5A0; 0x6FCD8070 case 2 steps toward target and case 5 invokes 0x6FD12540', () => {
      const w = createWave8World()
      const { m, pGame, pSkillsTxt } = w
      const { pRoom } = allocRoom(m, pGame, 80, 80, 60, 60, 2)
      const { pPlayer } = allocPlayer(m, pGame, pRoom, 1, 120, 100)
      const { pMon, pAiCtrl, pPath } = allocMonster(m, pGame, pRoom, 1, 10, 100, 100)

      // 0x6FCB2BB0 must invoke canonical SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c (0x6FCFE5A0)
      beginVaTrace113c()
      SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c(m, 5, pGame, pMon, pPlayer, pSkillsTxt, 1, 0)
      const hitsToHit = endVaTrace113c()
      expect(hitsToHit.has(formatD2GameHit(0x6fcfe5a0))).toBe(true)

      // 0x6FCD8070 case 2 must step TOWARD target (x=120 > 100 => targetX > 100, NOT fleeing < 100!)
      AIBAAL_ExecuteCommandAction_6FCD8070_113c(m, pPlayer, pMon, 2, pGame, pAiCtrl, 0)
      const stepTargetX = m.u16(pPath + 0x10)
      expect(stepTargetX).toBeGreaterThan(100)

      // 0x6FCD8070 case 5 must invoke canonical AI_ApproachTarget113c (0x6FD12540)
      const pCoords = m.alloc(0x20)
      m.setU32(pCoords + 0x0c, 118)
      m.setU32(pCoords + 0x10, 102)
      beginVaTrace113c()
      AIBAAL_ExecuteCommandAction_6FCD8070_113c(m, pPlayer, pMon, 5, pGame, pAiCtrl, pCoords)
      const hitsBaalApproach = endVaTrace113c()
      expect(hitsBaalApproach.has(formatD2GameHit(0x6fd12540))).toBe(true)
    })

    it('k2-w3b3: 0x6FC55B60 packs NPC IDs at +0x02 (not +0x04) & queues channel 1; 0x6FC55910 queues 0x27; 0x6FC533D0 defers pObjData', () => {
      const w = createWave8World()
      const { m, pGame } = w
      const { pRoom } = allocRoom(m, pGame, 80, 80, 60, 60, 99) // unmatched level (not 70 boss tomb)
      const { pPlayer, pClient } = allocPlayer(m, pGame, pRoom, 1, 100, 100)

      // 0x6FC533D0: unmatched level with pObj->pObjectData == 0 must not crash
      const pObj = m.alloc(0x100)
      const pObjectsTxt = m.alloc(0x200)
      m.setU32(pObj + 0x00, 2)
      m.setU32(pObj + 0x04, 0x3d)
      m.setU32(pObj + 0x0c, 77)
      m.setU32(pObj + 0x10, 1) // already initialized (mode 1)
      m.setU32(pObj + 0x14, 0) // null pObjData
      const pObjInit = m.alloc(0x30)
      m.setU32(pObjInit + 0x00, pGame)
      m.setU32(pObjInit + 0x04, pObj)
      m.setU32(pObjInit + 0x08, pRoom)
      m.setU32(pObjInit + 0x10, pObjectsTxt)
      expect(() => OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c(m, pObjInit)).not.toThrow()

      // 0x6FC55B60: Act 0 intro packet 0x91 must enqueue 26 bytes on channel 1 with first NPC ID 0x0094 at +0x02!
      QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c(m, pPlayer, 0, pGame)
      QUESTS_SendNpcIntroPacket91_6FC55B60_113c(m, pPlayer, 0, pGame)
      const pkts91 = readQueuedClientBytes(m, pClient)
      expect(pkts91.length).toBe(1)
      expect(pkts91[0]!.length).toBe(0x1a)
      expect(pkts91[0]![0]).toBe(0x91)
      expect(pkts91[0]![1]).toBe(0)
      const firstNpcId = pkts91[0]![2]! | (pkts91[0]![3]! << 8)
      expect(firstNpcId).toBe(0x0094) // Akara (0x94) at +0x02, NOT shifted to +0x04

      // 0x6FC55910: NPC interact must enqueue 40-byte packet 0x27 on channel 1
      const { pPlayer: pPlayer2, pClient: pClient2 } = allocPlayer(m, pGame, pRoom, 2, 102, 102)
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(m, pObj, pPlayer2, pGame)
      const pkts27 = readQueuedClientBytes(m, pClient2)
      expect(pkts27.length).toBe(1)
      expect(pkts27[0]!.length).toBeGreaterThanOrEqual(0x28)
      expect(pkts27[0]![0]).toBe(0x27)
      expect(pkts27[0]![1]).toBe(2)
    })

    it('k2-w3b3: 0x6FC5D680 checks pOwnerUnit==0; 0x6FC5E8A0/0x6FC5EC10 match native first-hit pStatList=0; 0x6FC5FB40 checks pOwner dead', () => {
      const w = createWave8World()
      const { m, pGame, pSkillsTxt, pMissilesTxt } = w
      const { pRoom } = allocRoom(m, pGame, 80, 80, 160, 160, 2)
      const { pPlayer: pOwner } = allocPlayer(m, pGame, pRoom, 1, 100, 100)
      const { pPlayer: pFollow } = allocPlayer(m, pGame, pRoom, 2, 104, 104)
      const { pMissile } = allocMissile(m, pGame, pRoom, pOwner, 1, 200, 100, 100)

      // 0x6FC5D680: pOwnerUnit == 0 returns 0 even when pGame != 0
      expect(
        MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c(m, pMissile, 2, pGame, 0, 1, 2, 4, 4, 10),
      ).toBe(0)

      // 0x6FC5E8A0 & 0x6FC5EC10: 1st hit creates & merges state statlist (native pStatList stays 0);
      // 2nd hit finds merged statlist and passes it to SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c
      const s1 = pSkillsTxt + 1 * D2SkillsTxt_SIZE
      m.setU16(s1 + 0x82, 3) // wAuraState = 3
      expect(STATLIST_GetStatListFromUnitAndState113c(m, pFollow, 3)).toBe(0)
      expect(MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c(m, pGame, pMissile, pFollow)).toBe(3)
      const pCreatedList = STATLIST_GetStatListFromUnitAndState113c(m, pFollow, 3)
      expect(pCreatedList).not.toBe(0)
      m.setU32(pGame + 0xa8, 200) // advance game frame -> 2nd hit updates expireFrame on existing statlist
      expect(MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c(m, pGame, pMissile, pFollow)).toBe(0)
      expect(m.u32(pCreatedList + 0x18)).toBe(205)

      // 0x6FC5FB40: checks SUNIT_IsDeadOrDying113c(pOwner), NOT pFollowUnit!
      const m1 = pMissilesTxt + 1 * 0x1a4
      m.setU16(m1 + 0x18, 2)
      m.setU32(m1 + 0x38, 4)
      m.setU32(m1 + 0x3c, 2)
      MISSILE_SetTargetX113c(m, pMissile, 0) // follow unit type = player
      MISSILE_SetTargetY113c(m, pMissile, 2) // follow unit id = 2 (pFollow)
      MISSILE_SetTotalFrames113c(m, pMissile, 10)
      MISSILE_SetRemainingFrames113c(m, pMissile, 6)

      // Case A: pOwner alive (mode 1), pFollow dead (mode 0x11) -> continues and returns 1
      m.setU32(pOwner + 0x10, 1)
      m.setU32(pFollow + 0x10, 0x11)
      expect(MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c(m, pGame, pMissile)).toBe(1)

      // Case B: pOwner dead (mode 0x11), pFollow alive (mode 1) -> terminates and returns 2
      m.setU32(pOwner + 0x10, 0x11)
      m.setU32(pFollow + 0x10, 1)
      expect(MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c(m, pGame, pMissile)).toBe(2)
    })

    it('k2-w4b7 & k2-w6b5: 0x6FCC5B30 wander range 3; 0x6FCC59B0/0x6FCC5C80/0x6FCD2120 AI init; 0x6FCC1280 respec refund', () => {
      const w = createWave8World()
      const { m, pGame, pDataTables, pMonStatsTxt, pMonStats2Txt, pSkillsTxt } = w
      const { pRoom } = allocRoom(m, pGame, 80, 80, 60, 60, 2)
      const { pPlayer } = allocPlayer(m, pGame, pRoom, 1, 100, 100, 0)
      const { pMon, pAiCtrl, pAiGeneral, pPath } = allocMonster(m, pGame, pRoom, 1, 101, 100, 100)

      // 0x6FCC5B30: with no target and roll < 20, wanders with explicit range 3 (not default 8!)
      m.setU32(pMon + 0x20, 0)
      m.setU32(pMon + 0x24, 5) // first LCG output = 5 -> 5 % 100 = 5 < 0x14
      const pAiTick = m.alloc(0x40)
      m.setU32(pAiTick + 0x00, pAiCtrl)
      m.setU32(pAiTick + 0x08, 0)
      m.setU32(pAiTick + 0x1c, pMonStatsTxt + 1 * 0x1a8)
      m.setU32(pAiTick + 0x20, pMonStats2Txt + 1 * 0x134)
      beginVaTrace113c()
      MONAI_NestOrMeleeWanderThink_6FCC5B30_113c(m, pGame, pMon, pAiTick)
      const hitsWander = endVaTrace113c()
      expect(hitsWander.has(formatD2GameHit(0x6fd11b10))).toBe(true)
      const prevWx = m.u16(pPath + 0x14)
      const prevWy = m.u16(pPath + 0x16)
      expect(Math.max(Math.abs(prevWx - 100), Math.abs(prevWy - 100))).toBe(3)

      // 0x6FCC59B0 & 0x6FCC5C80 & 0x6FCD2120 invoke canonical AI_InitMonsterAiThinkFn113c (0x6FCBD230)
      m.setU32(pAiCtrl + 0x00, 2)
      m.setU32(pAiGeneral + 0x00, 0x1234)
      beginVaTrace113c()
      MONAI_UnburrowThink_6FCC59B0_113c(m, pGame, pMon, pAiTick)
      MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c(m, pGame, pMon, pAiTick)
      MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c(m, pPlayer, pGame, pMon, 25)
      const hitsAi = endVaTrace113c()
      expect(hitsAi.has(formatD2GameHit(0x6fcbd230))).toBe(true)

      // 0x6FCC1280: refunds class skill points into STAT_NEWSKILLS (5) and calls MONSTER_AddSkillToUnit113c with bRefresh=1
      const pClassCounts = m.u32(pDataTables + 0xba4)
      const pClassSkillList = m.u32(pDataTables + 0xbac)
      m.setU32(pClassCounts + 0, 1) // 1 class skill for class 0
      m.setU16(pClassSkillList + 0, 6) // skill ID 6
      const pSkillList = m.u32(pPlayer + 0xa8)
      const pPlrSkill = m.alloc(0x40)
      m.setU32(pPlrSkill + 0x00, pSkillsTxt + 6 * D2SkillsTxt_SIZE)
      m.setU32(pPlrSkill + 0x28, 4) // base skill level = 4
      m.setU32(pPlrSkill + 0x34, 0xffffffff) // nOwnerItemGuid = -1 (innate player skill)
      m.setU32(pSkillList + 0x04, pPlrSkill) // D2SkillListStrc.pFirstSkill (+0x04)
      const beforePts = STATLIST_GetUnitStat113c(m, pPlayer, 5, 0)
      beginVaTrace113c()
      SKILLS_RespecPlayerClassSkills_6FCC1280_113c(m, pPlayer, pGame)
      const hitsRespec = endVaTrace113c()
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 5, 0)).toBe(beforePts + 4)
      expect(hitsRespec.has(formatD2GameHit(0x6fcc1280))).toBe(true)
      expect(hitsRespec.has(formatD2GameHit(0x6fcad5f0))).toBe(true) // NET_SendPacket21_UpdateUnitSkill
    })
  })
})
