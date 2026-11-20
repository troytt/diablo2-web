import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  D2COMMON_CHAR_INV_REC_COUNT_VA_113C,
  D2COMMON_CHAR_INV_REC_TABLE_VA_113C,
  G_INVENTORY_TXT_TABLE_VA_113C,
  INVENTORY_AllocInventory113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_LinkItemToInventoryList113c,
  INVENTORY_SetCursorItem113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  ITEMS_SetBodyLocation113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
  ITEMS_SetNodePage113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import { QUESTRECORD_AllocRecord113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  SKILLS_GetSkillById113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import { STATLIST_GetStatListFromUnitAndStateMemPort113c } from '../../../src/d2kern-113c/common/k0-d2common-memports.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  AIINIT_SpawnerResetFrameTimers113c,
  AITHINK_Fn146_UberMephistoNoop113c,
  AI_FilterLivingGloamUnit113c,
  ITEMMODE_UnitTimerNoop113c,
  ITEMS_AreAffixesEqual113c,
  ITEMS_AreWeaponSlotTypesCompatible113c,
  ITEMS_BuildItemDropParamsFromItem113c,
  ITEMS_DoItemRecordsMatchCodePair113c,
  ITEMS_GetOppositeHandOrRingBodyLoc113c,
  MONSTER_EndModeS3Noop113c,
  MONSTER_Event10_ClearMonsterFields34And38_113c,
  MONSTER_GetOrRollRegionSubVariant113c,
  NET_SendRemoveUnitPacket0A113c,
  PACKET_C2S2C_Reject3_113c,
  PACKET_C2S2D_Reject3_113c,
  PACKET_C2S2E_PlaySoundNoop113c,
  PACKET_C2S39_Reject3_113c,
  PACKET_C2S42_ClearCursorNoop113c,
  PACKET_C2S43_QuestInitNoop113c,
  PACKET_C2S45_Reject3_113c,
  PACKET_C2S4B_RequestUnitRefresh113c,
  PACKET_C2S52_Reject3_113c,
  PACKET_C2S58_MarkQuestIntroSeen113c,
  PACKET_C2S66_WardenResponseNoop113c,
  PACKET_IsInteractingWithDifferentPlayer113c,
  PLAYER_CanInterruptCurrentSkillOrEvent113c,
  PLAYER_SkillModeNoopHandler_00_17_113c,
  PLAYER_SkillModeNoopHandler_01_05_113c,
  PLAYER_SkillModeNoopHandler_04_09_113c,
  PLRTRADE_BroadcastClearMercUnitCallback113c,
  PLRTRADE_CanModifyBeltDuringTrade113c,
  PLRTRADE_CountCubePageItemsInInventory113c,
  PLRTRADE_HasAnyCubePageItemOnUnit113c,
  PLRTRADE_SendTradeAcceptButtonAndSetState3_113c,
  PLRTRADE_SyncClonedItemEarOrPersonalizedData113c,
  PLRTRADE_TradeButtonNoopAction2_113c,
  PLRTRADE_TradeButtonNoopAction3_113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c.ts'
import {
  ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c,
  AI_AttackWestOffsetThenDie_6FCC4B90_113c,
  AI_CastSkill286AtOffsetY13_6FCC4E40_113c,
  AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c,
  AI_SetStateDirAndStartWalkMode_6FCC41B0_113c,
  AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c,
  AI_TickAmbientMode8OrStall30_6FCC58D0_113c,
  AI_TickAncientStatueRevertCheck_6FCC4F40_113c,
  AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c,
  AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c,
  AI_TickSummonedTimedAttacker_6FCC4D10_113c,
  AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c,
  AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c,
  CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c,
  SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c,
  SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c,
  SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c,
  SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c,
  SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c,
  SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c,
  SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c,
  SKILLS_CountUnitsInRadius_6FCC0FC0_113c,
  SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c,
  SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c,
  SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c,
  SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c,
  SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c,
  SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c,
  SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c,
  SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
  SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c,
  SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c,
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c,
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c,
  STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c,
  STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c.ts'
import {
  ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c,
  ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c,
  ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c,
  ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c,
  ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c,
  ITEMS_CompactBeltColumnDown_6FCF2540_113c,
  ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c,
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c,
  ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c,
  ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c,
  ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c,
  ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c,
  ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c,
  ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c,
  ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c,
  ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c,
  ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c,
  ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c,
  ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c,
  ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c,
  ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c,
  ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c,
  ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c,
  PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c,
  PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c,
  SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c,
  SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c,
  SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c,
  SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c,
  SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c,
  SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c,
  SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c,
  SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c,
  SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c,
  SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c.ts'
import {
  ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c,
  ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c,
  ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c,
  ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c,
  ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c,
  ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c,
  ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c,
  ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c,
  ACT3Q3_OperateSewerLeverObject_6FD09F60_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c,
  ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c,
  ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c,
  ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c,
  ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c,
  ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c,
  ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c,
  C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c,
  C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c,
  C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c,
  ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c,
  ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c,
  ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c,
  ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c,
  ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c,
  ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c,
  ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c,
  ITEMS_InsertScrollIntoTome_6FCF34B0_113c,
  ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c,
  ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c,
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c,
  MONSTER_SpawnPresetPackTable_6FD0F940_113c,
  PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c,
  PLAYERSAVE_WriteCorpseSection_6FD0C260_113c,
  PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c,
  PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c,
  PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c,
  QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c.ts'
import { SUNITDMG_AllocCombat113c } from '../../../src/d2kern-113c/game/combat-a1c-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
  SUNIT_SetMonsterAlignmentState113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActStrc,
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AnimDataTableStrc,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2PlayerDataStrc,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2SkillsTxt_SIZE,
  D2StatListStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  MONSTER_SUBCLASS_VEL_TABLE_VA,
  SGPT_BELTS_TXT_COUNT_VA,
  SGPT_BELTS_TXT_PTR_VA,
  SGPT_BOOKS_TXT_COUNT_VA,
  SGPT_BOOKS_TXT_PTR_VA,
  SGPT_INVENTORY_TXT_MAX_VA,
  SGPT_INVENTORY_TXT_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
  SGPT_MONSTATS_TXT_COUNT_VA,
  SGPT_MONSTATS_TXT_PTR_VA,
  SGPT_QUALITYITEMS_TXT_COUNT_VA,
  SGPT_QUALITYITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import type { Manifest } from '../../../tools/oracle/callgraph/status.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools', 'oracle', 'callgraph', 'manifest-113c.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')

interface DisasmVaSpec {
  readonly batch: 'k2w4-b6' | 'k2w6-b6' | 'k2w1-laneC-combat-core' | 'k2w5-b7'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE9_INDIRECT_UNKNOWN_PORTED_VAS: readonly string[] = [
  '0x6FCBEDB0',
  '0x6FCBEEB0',
  '0x6FD0B090',
  '0x6FCFE380',
  '0x6FCFFCC0',
  '0x6FD02A40',
  '0x6FD02B70',
  '0x6FD02D40',
  '0x6FD02E80',
  '0x6FD02F00',
]

const WAVE9_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  // SHARD 1: k2w4-b6 (37 promoted VAs)
  { batch: 'k2w4-b6', va: '0x6FCBD610', size: 220, headHex: '83ec2085f6558b6c', tailHex: 'c20400', tsSymbol: 'CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBD6F0', size: 109, headHex: '8b86281d000085c0', tailHex: '490200', tsSymbol: 'ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBE570', size: 134, headHex: '83ec388b44243c8b', tailHex: 'c21000', tsSymbol: 'SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBE730', size: 119, headHex: '85c0746d8b0885c9', tailHex: '0000c3', tsSymbol: 'SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBE810', size: 199, headHex: '83ec64568bf08b44', tailHex: 'c20800', tsSymbol: 'SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBE8E0', size: 129, headHex: '53568b74240c85f6', tailHex: 'c20800', tsSymbol: 'SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBEA30', size: 246, headHex: '83ec0c5556578b7c', tailHex: 'c20800', tsSymbol: 'STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBF210', size: 147, headHex: '5153568bf085f67c', tailHex: 'c20800', tsSymbol: 'SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBF4A0', size: 348, headHex: '5185c053558b6c24', tailHex: 'c20400', tsSymbol: 'SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCBF730', size: 69, headHex: '85f674408b0683f8', tailHex: 'f8ffc3', tsSymbol: 'SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC09F0', size: 217, headHex: '83ec2485d2577c1f', tailHex: 'c21000', tsSymbol: 'STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC0E80', size: 179, headHex: '83ec705355568bf2', tailHex: 'c20800', tsSymbol: 'SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC0F40', size: 113, headHex: '83ec186a00894c24', tailHex: 'c21000', tsSymbol: 'SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC0FC0', size: 59, headHex: '516a008d4c240451', tailHex: 'c21000', tsSymbol: 'SKILLS_CountUnitsInRadius_6FCC0FC0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC16A0', size: 226, headHex: '5185f6550f84d100', tailHex: 'c20800', tsSymbol: 'SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC26E0', size: 275, headHex: '558b6c2408578b7c', tailHex: 'c20800', tsSymbol: 'SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC2DE0', size: 185, headHex: '83ec20558b6c2428', tailHex: 'c20400', tsSymbol: 'SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC2EE0', size: 167, headHex: '5185f6750768a80f', tailHex: 'ff59c3', tsSymbol: 'SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC2F90', size: 252, headHex: '83ec2053558b6c24', tailHex: 'c20400', tsSymbol: 'SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC3120', size: 245, headHex: '53558b6c2410578b', tailHex: 'c21000', tsSymbol: 'SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC3220', size: 696, headHex: '83ec0853558b6c24', tailHex: 'c20800', tsSymbol: 'SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC34E0', size: 239, headHex: '558b6c241485ed57', tailHex: 'c21400', tsSymbol: 'SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC3A20', size: 177, headHex: '518b54240c85d253', tailHex: 'c20800', tsSymbol: 'STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC3B50', size: 219, headHex: '83ec2853558b6c24', tailHex: 'c20800', tsSymbol: 'SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC3C80', size: 125, headHex: '85f6750533c0c204', tailHex: 'c20400', tsSymbol: 'SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC41B0', size: 171, headHex: '83ec2083f8018bc8', tailHex: 'c20800', tsSymbol: 'AI_SetStateDirAndStartWalkMode_6FCC41B0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC4260', size: 177, headHex: '53558b6c240c8b5d', tailHex: 'c20400', tsSymbol: 'AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC4450', size: 104, headHex: '85d2538b5c240857', tailHex: 'c20400', tsSymbol: 'AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC4A10', size: 378, headHex: '83ec2455578bf833', tailHex: 'c20c00', tsSymbol: 'AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC4B90', size: 370, headHex: '83ec288b44242c8b', tailHex: 'c20400', tsSymbol: 'AI_AttackWestOffsetThenDie_6FCC4B90_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC4D10', size: 300, headHex: '83ec0855568bf285', tailHex: 'c20400', tsSymbol: 'AI_TickSummonedTimedAttacker_6FCC4D10_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC4E40', size: 250, headHex: '680017000068b0b6', tailHex: 'c20400', tsSymbol: 'AI_CastSkill286AtOffsetY13_6FCC4E40_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC4F40', size: 137, headHex: '538bd98b83f41000', tailHex: 'c20400', tsSymbol: 'AI_TickAncientStatueRevertCheck_6FCC4F40_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC5350', size: 549, headHex: '83ec108b44241453', tailHex: 'c20400', tsSymbol: 'AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC5580', size: 608, headHex: '83ec348b44243853', tailHex: 'c20400', tsSymbol: 'AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC57E0', size: 231, headHex: '8b44240483ec2053', tailHex: 'c20400', tsSymbol: 'AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c' },
  { batch: 'k2w4-b6', va: '0x6FCC58D0', size: 209, headHex: '83ec2053568bf28b', tailHex: 'c20400', tsSymbol: 'AI_TickAmbientMode8OrStall30_6FCC58D0_113c' },

  // SHARD 2: k2w6-b6 (37 promoted VAs)
  { batch: 'k2w6-b6', va: '0x6FCEEC70', size: 105, headHex: '837c24080953578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c' },
  { batch: 'k2w6-b6', va: '0x6FCEEDE0', size: 115, headHex: '837c24080956578b', tailHex: 'c20800', tsSymbol: 'C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF0950', size: 618, headHex: '8b44240883ec0883', tailHex: 'c20800', tsSymbol: 'C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF2610', size: 552, headHex: '83ec54558b6c245c', tailHex: 'c20c00', tsSymbol: 'ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF2F00', size: 720, headHex: '51558b6c240c568b', tailHex: 'f2ffcc', tsSymbol: 'ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF3450', size: 81, headHex: '53558b6c240c6a00', tailHex: 'c20400', tsSymbol: 'ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF34B0', size: 544, headHex: '538b5c240885db55', tailHex: 'c21000', tsSymbol: 'ITEMS_InsertScrollIntoTome_6FCF34B0_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF36D0', size: 625, headHex: '83ec0c558b6c2418', tailHex: 'c20c00', tsSymbol: 'ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF3950', size: 82, headHex: '5185ff53568bf074', tailHex: 'c20400', tsSymbol: 'ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF3A10', size: 547, headHex: '8b44240483ec0885', tailHex: 'c20c00', tsSymbol: 'ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF3CB0', size: 1082, headHex: '83ec488b44245053', tailHex: 'f2ffcc', tsSymbol: 'ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF4570', size: 177, headHex: '515556578bf88b6f', tailHex: '5d59c3', tsSymbol: 'ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF4A70', size: 692, headHex: '53558b6c2414568b', tailHex: 'f2ffcc', tsSymbol: 'ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c' },
  { batch: 'k2w6-b6', va: '0x6FCF4D30', size: 330, headHex: '558b6c240c56578b', tailHex: 'c20c00', tsSymbol: 'ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c' },
  { batch: 'k2w6-b6', va: '0x6FD057D0', size: 322, headHex: '83ec1453568b7218', tailHex: 'c414c3', tsSymbol: 'ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c' },
  { batch: 'k2w6-b6', va: '0x6FD05C40', size: 140, headHex: '535556578bfa578b', tailHex: 'f0ebd5', tsSymbol: 'ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c' },
  { batch: 'k2w6-b6', va: '0x6FD068B0', size: 89, headHex: '8a4a0bb0043ac856', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c' },
  { batch: 'k2w6-b6', va: '0x6FD06910', size: 112, headHex: '8b420885c0568bf1', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c' },
  { batch: 'k2w6-b6', va: '0x6FD069E0', size: 126, headHex: '8b420885c0568bf1', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c' },
  { batch: 'k2w6-b6', va: '0x6FD06A60', size: 179, headHex: '51535556578bfa8b', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c' },
  { batch: 'k2w6-b6', va: '0x6FD06B20', size: 103, headHex: '8b4118ff4810753e', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c' },
  { batch: 'k2w6-b6', va: '0x6FD06BD0', size: 273, headHex: '8b42085355568bf1', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c' },
  { batch: 'k2w6-b6', va: '0x6FD06D90', size: 111, headHex: '8b420885c0568bf1', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c' },
  { batch: 'k2w6-b6', va: '0x6FD06F60', size: 124, headHex: '8b420c538b1a5657', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c' },
  { batch: 'k2w6-b6', va: '0x6FD06FE0', size: 103, headHex: '8b4118ff4808753e', tailHex: 'f1ffcc', tsSymbol: 'ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c' },
  { batch: 'k2w6-b6', va: '0x6FD09F60', size: 286, headHex: '5355568bf18b6e04', tailHex: 'c05bc3', tsSymbol: 'ACT3Q3_OperateSewerLeverObject_6FD09F60_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0A390', size: 295, headHex: '51568bf18bc6e8f5', tailHex: '5e59c3', tsSymbol: 'ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0A4C0', size: 295, headHex: '51568bf18bc6e8c5', tailHex: '5e59c3', tsSymbol: 'ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0A5F0', size: 295, headHex: '51568bf18bc6e895', tailHex: '5e59c3', tsSymbol: 'ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0A930', size: 213, headHex: '568bf0a19c82d16f', tailHex: '5f5ec3', tsSymbol: 'ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0AA30', size: 218, headHex: '5185f6538bd87505', tailHex: '5b59c3', tsSymbol: 'QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0AEE0', size: 141, headHex: '566a008bf06a0456', tailHex: 'c05ec3', tsSymbol: 'PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0AF80', size: 225, headHex: '568bf085f60f84d4', tailHex: '5b5ec3', tsSymbol: 'PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0C260', size: 521, headHex: '83ec208b44242c8b', tailHex: 'c21800', tsSymbol: 'PLAYERSAVE_WriteCorpseSection_6FD0C260_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0C470', size: 859, headHex: '558bec83e4f881ec', tailHex: 'f1ffcc', tsSymbol: 'PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c' },
  { batch: 'k2w6-b6', va: '0x6FD0F940', size: 552, headHex: '83ec14558b6c242c', tailHex: 'c21800', tsSymbol: 'MONSTER_SpawnPresetPackTable_6FD0F940_113c' },
  { batch: 'k2w6-b6', va: '0x6FD10390', size: 69, headHex: '535556578bf0568b', tailHex: '5d5bc3', tsSymbol: 'PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c' },

  // SHARD 3: k2w1-laneC-combat-core (37 promoted VAs)
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC90010', size: 97, headHex: '56e850aaf9ff83f8', tailHex: 'c20400', tsSymbol: 'PLRTRADE_SyncClonedItemEarOrPersonalizedData113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC90080', size: 60, headHex: '8b4860565751e851', tailHex: '005ec3', tsSymbol: 'PLRTRADE_HasAnyCubePageItemOnUnit113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC90170', size: 3, headHex: '33c0c3', tailHex: '33c0c3', tsSymbol: 'PLRTRADE_TradeButtonNoopAction3_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC90180', size: 3, headHex: '33c0c3', tailHex: '33c0c3', tsSymbol: 'PLRTRADE_TradeButtonNoopAction2_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC90190', size: 54, headHex: '53565033dbe842a2', tailHex: 'c35bc3', tsSymbol: 'PLRTRADE_CountCubePageItemsInInventory113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC901F0', size: 72, headHex: '8a486c84c9743b8b', tailHex: '0000c3', tsSymbol: 'PLRTRADE_CanModifyBeltDuringTrade113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC90B70', size: 118, headHex: '5185c07413833800', tailHex: 'c20800', tsSymbol: 'PLRTRADE_SendTradeAcceptButtonAndSetState3_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC90C90', size: 82, headHex: '8b44240483ec083b', tailHex: 'c20400', tsSymbol: 'PLRTRADE_BroadcastClearMercUnitCallback113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC94890', size: 1, headHex: 'c3', tailHex: 'c3', tsSymbol: 'MONSTER_EndModeS3Noop113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC94E40', size: 29, headHex: '33c93bd174148b02', tailHex: 'c20800', tsSymbol: 'MONSTER_Event10_ClearMonsterFields34And38_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC97920', size: 8, headHex: 'b801000000c20800', tailHex: 'c20800', tsSymbol: 'PLAYER_SkillModeNoopHandler_04_09_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC97930', size: 8, headHex: 'b801000000c20800', tailHex: 'c20800', tsSymbol: 'PLAYER_SkillModeNoopHandler_01_05_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC97940', size: 8, headHex: 'b801000000c20800', tailHex: 'c20800', tsSymbol: 'PLAYER_SkillModeNoopHandler_00_17_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC98100', size: 75, headHex: '57e8b429f9ff85c0', tailHex: 'c20400', tsSymbol: 'PLAYER_CanInterruptCurrentSkillOrEvent113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC9A540', size: 47, headHex: '8a0183ec083c0374', tailHex: 'c20400', tsSymbol: 'NET_SendRemoveUnitPacket0A113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC9B4E0', size: 3, headHex: 'c20400', tailHex: 'c20400', tsSymbol: 'AITHINK_Fn146_UberMephistoNoop113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC9B4F0', size: 25, headHex: '8b4424048b008b89', tailHex: 'c20400', tsSymbol: 'AIINIT_SpawnerResetFrameTimers113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC9B510', size: 95, headHex: '56578bf857e85eef', tailHex: 'c20400', tsSymbol: 'MONSTER_GetOrRollRegionSubVariant113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FC9BD00', size: 67, headHex: '568bf185f674318b', tailHex: '005ec3', tsSymbol: 'AI_FilterLivingGloamUnit113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB190', size: 5, headHex: '33c0c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S66_WardenResponseNoop113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB1B0', size: 5, headHex: '33c0c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S43_QuestInitNoop113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB1C0', size: 5, headHex: '33c0c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S42_ClearCursorNoop113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB1D0', size: 5, headHex: '33c0c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S2E_PlaySoundNoop113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB1E0', size: 8, headHex: 'b803000000c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S2C_Reject3_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB3D0', size: 70, headHex: '568bf18b4c240cb8', tailHex: 'c20800', tsSymbol: 'PACKET_C2S58_MarkQuestIntroSeen113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB490', size: 8, headHex: 'b803000000c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S52_Reject3_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB550', size: 8, headHex: 'b803000000c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S45_Reject3_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEB560', size: 8, headHex: 'b803000000c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S39_Reject3_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEBDA0', size: 8, headHex: 'b803000000c20800', tailHex: 'c20800', tsSymbol: 'PACKET_C2S2D_Reject3_113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCEC6E0', size: 99, headHex: '837c240809578bfa', tailHex: 'c20800', tsSymbol: 'PACKET_C2S4B_RequestUnitRefresh113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCECB10', size: 51, headHex: '8b51648b4168538a', tailHex: 'c20800', tsSymbol: 'PACKET_IsInteractingWithDifferentPlayer113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCF16B0', size: 88, headHex: '555633f65653e809', tailHex: 'c05dc3', tsSymbol: 'ITEMS_AreAffixesEqual113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCF1720', size: 54, headHex: '83c0fc83f808772b', tailHex: '33c0c3', tsSymbol: 'ITEMS_GetOppositeHandOrRingBodyLoc113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCF1790', size: 1, headHex: 'c3', tailHex: 'c3', tsSymbol: 'ITEMMODE_UnitTimerNoop113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCF1950', size: 165, headHex: '83380074078b5108', tailHex: 'c05ec3', tsSymbol: 'ITEMS_AreWeaponSlotTypesCompatible113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCF1A00', size: 39, headHex: '8b80800000003bc1', tailHex: '33c0c3', tsSymbol: 'ITEMS_DoItemRecordsMatchCodePair113c' },
  { batch: 'k2w1-laneC-combat-core', va: '0x6FCF1E10', size: 182, headHex: '558b6c24085733c0', tailHex: 'c20800', tsSymbol: 'ITEMS_BuildItemDropParamsFromItem113c' },

  // SHARD 4: k2w5-b7 (36 promoted VAs)
  { batch: 'k2w5-b7', va: '0x6FCEFF30', size: 301, headHex: '837c24081153578b', tailHex: 'c20800', tsSymbol: 'PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF00A0', size: 293, headHex: '8b44240881ec1001', tailHex: 'c20800', tsSymbol: 'PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF17B0', size: 122, headHex: '576a125683cfffe8', tailHex: 'c75fc3', tsSymbol: 'ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF1B20', size: 156, headHex: '578bf86a1657e805', tailHex: 'c20800', tsSymbol: 'ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF1C00', size: 463, headHex: '558b6c240885ed57', tailHex: 'c20800', tsSymbol: 'ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF1F60', size: 272, headHex: '85ff750768760600', tailHex: '245bc3', tsSymbol: 'ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF2070', size: 587, headHex: '515556578b7c2414', tailHex: 'c20400', tsSymbol: 'ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF22C0', size: 80, headHex: '85ff750533c0c204', tailHex: 'c20400', tsSymbol: 'ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF2310', size: 109, headHex: '83ec0885f6746285', tailHex: 'c408c3', tsSymbol: 'ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF2380', size: 297, headHex: '81ec0c0200005533', tailHex: 'c20400', tsSymbol: 'ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF24B0', size: 129, headHex: '83ec2085db747657', tailHex: 'c420c3', tsSymbol: 'ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF2540', size: 206, headHex: '83ec0883e0038b4c', tailHex: 'c20400', tsSymbol: 'ITEMS_CompactBeltColumnDown_6FCF2540_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF2840', size: 132, headHex: '85f6750a83c9ffb8', tailHex: 'c20400', tsSymbol: 'ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF2BE0', size: 141, headHex: '5155568bf0e8b6ee', tailHex: '5d59c3', tsSymbol: 'ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF2C70', size: 126, headHex: '5185f6538bd8578b', tailHex: 'c20400', tsSymbol: 'ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF2CF0', size: 149, headHex: '85f653578bf87407', tailHex: 'c20400', tsSymbol: 'ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF31D0', size: 157, headHex: '558b6c240885ed56', tailHex: 'c20800', tsSymbol: 'ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF4E80', size: 353, headHex: '53558b6c24145657', tailHex: 'c20c00', tsSymbol: 'ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF5590', size: 256, headHex: '51568bf085f60f84', tailHex: 'f2ffcc', tsSymbol: 'ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF5740', size: 176, headHex: '535556576a018bf8', tailHex: '5d5bc3', tsSymbol: 'ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF5A00', size: 549, headHex: '558b6c240c56578b', tailHex: 'f2ffcc', tsSymbol: 'ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF6590', size: 381, headHex: '558b6c240885ed56', tailHex: 'c21400', tsSymbol: 'ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF6BC0', size: 177, headHex: '5356684cb1d16f68', tailHex: 'c20400', tsSymbol: 'ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF6C80', size: 423, headHex: '83ec0853555756e8', tailHex: 'c20800', tsSymbol: 'ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c' },
  { batch: 'k2w5-b7', va: '0x6FCF8DE0', size: 179, headHex: '8b54240453568bf0', tailHex: 'f2ffcc', tsSymbol: 'ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCFAB00', size: 129, headHex: '558bec83e4f883ec', tailHex: 'c20400', tsSymbol: 'SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c' },
  { batch: 'k2w5-b7', va: '0x6FCFAED0', size: 350, headHex: '83ec08558bea85ed', tailHex: 'c20400', tsSymbol: 'SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c' },
  { batch: 'k2w5-b7', va: '0x6FCFBD90', size: 280, headHex: '51568bf185f6578b', tailHex: 'c20400', tsSymbol: 'SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c' },
  { batch: 'k2w5-b7', va: '0x6FCFCE00', size: 107, headHex: '85f6578bf87c60a1', tailHex: 'c20400', tsSymbol: 'SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c' },
  { batch: 'k2w5-b7', va: '0x6FCFFDC0', size: 325, headHex: '83ec2085ff750768', tailHex: 'c420c3', tsSymbol: 'SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c' },
  { batch: 'k2w5-b7', va: '0x6FD00D00', size: 544, headHex: '53558b6c240c85ed', tailHex: 'ff8bff', tsSymbol: 'SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c' },
  { batch: 'k2w5-b7', va: '0x6FD01570', size: 151, headHex: '558b6c240c85ed75', tailHex: 'c20800', tsSymbol: 'SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c' },
  { batch: 'k2w5-b7', va: '0x6FD02310', size: 357, headHex: '83ec1485db558b6c', tailHex: 'c20800', tsSymbol: 'SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c' },
  { batch: 'k2w5-b7', va: '0x6FD02480', size: 376, headHex: '83ec14558b6c2420', tailHex: 'c20800', tsSymbol: 'SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c' },
  { batch: 'k2w5-b7', va: '0x6FD02600', size: 383, headHex: '83ec1485f6535557', tailHex: 'c20800', tsSymbol: 'SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c' },
  { batch: 'k2w5-b7', va: '0x6FD02780', size: 282, headHex: '8b80f410000085c0', tailHex: '005fc3', tsSymbol: 'ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c' },
]

function loadPeSectionMapper(dllPath: string, expectedBase: number) {
  const buf = fs.readFileSync(dllPath)
  const e_lfanew = buf.readUInt32LE(0x3c)
  const numSec = buf.readUInt16LE(e_lfanew + 6)
  const optSize = buf.readUInt16LE(e_lfanew + 20)
  const imageBase = buf.readUInt32LE(e_lfanew + 24 + 28)
  expect(imageBase).toBe(expectedBase)
  const secTable = e_lfanew + 24 + optSize
  const sections: Array<{ vaddr: number; vsize: number; rawPtr: number; rawSize: number }> = []
  for (let i = 0; i < numSec; i++) {
    const sh = secTable + i * 40
    sections.push({
      vsize: buf.readUInt32LE(sh + 8),
      vaddr: buf.readUInt32LE(sh + 12),
      rawSize: buf.readUInt32LE(sh + 16),
      rawPtr: buf.readUInt32LE(sh + 20),
    })
  }
  const textSec = sections[0]!
  return {
    buf,
    textStart: imageBase + textSec.vaddr,
    textEnd: imageBase + textSec.vaddr + textSec.vsize,
    vaToFileOffset(va: number): number {
      const rva = va - imageBase
      for (const s of sections) {
        const span = Math.max(s.vsize, s.rawSize)
        if (rva >= s.vaddr && rva < s.vaddr + span) {
          return s.rawPtr + (rva - s.vaddr)
        }
      }
      throw new Error(`VA 0x${va.toString(16)} outside PE sections`)
    },
  }
}

interface Wave9World {
  m: SparseMemory113c
  pGame: number
  pDataTables: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pSkillsTxt: number
  pMissilesTxt: number
  pItemsTxt: number
  pItemTypesTxt: number
  pItemTypesEquiv: number
  pItemStatCostTxt: number
  pBooksTxt: number
  pQualTxt: number
  pRunesTxt: number
  pCharStatsTxt: number
  pLevelsTxt: number
  pObjectsTxt: number
  pStatesTxt: number
}

function createWave9World(): Wave9World {
  const m = new SparseMemory113c()
  m.fill(0x6fd10000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x20000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)

  // Grid0 info (13 body locations x 1), Grid1 info (4x4 belt), & ExperienceTxt table
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  m.setU8(0x6fded390, 4)
  m.setU8(0x6fded391, 4)
  m.setU32(0x6fdeff6c, m.alloc(0x10))
  const pExpTxt = m.alloc(0x400) >>> 0
  m.setU32(pExpTxt, 99)
  m.setU32(0x6fdf0b50, pExpTxt)

  // MonStatsTxt (600 rows * 0x1A8) with wMonStatsEx (+0x18) and wBaseId (+0x02 / +0x06)
  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * D2MonStatsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  m.setU32(SGPT_MONSTATS_TXT_PTR_VA, pMonStatsTxt)
  m.setU32(SGPT_MONSTATS_TXT_COUNT_VA, monStatsCount)
  for (let i = 0; i < monStatsCount; i += 1) {
    const rec = (pMonStatsTxt + i * D2MonStatsTxt_SIZE) >>> 0
    m.setU16((rec + 0x02) >>> 0, i)
    m.setU16((rec + 0x06) >>> 0, i)
    m.setU16((rec + 0x18) >>> 0, i)
  }

  // MonStats2Txt (600 rows)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)

  // SkillsTxt (320 rows * 0x23C) & SkillDescTxt (320 rows * 0x120)
  const skillsCount = 320
  const pSkillsTxt = m.alloc(skillsCount * D2SkillsTxt_SIZE) >>> 0
  for (let i = 0; i < skillsCount; i += 1) {
    m.setU16((pSkillsTxt + i * D2SkillsTxt_SIZE) >>> 0, i)
  }
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)
  const pSkillDescTxt = m.alloc(skillsCount * 0x120) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pSkillDescTxt) >>> 0, pSkillDescTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nSkillDescTxtRecordCount) >>> 0, skillsCount)

  // MissilesTxt (400 rows * 0x1A4)
  const missilesCount = 400
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4) >>> 0
  m.setU32((pDataTables + 0xb64) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + 0xb6c) >>> 0, missilesCount)

  // ItemStatCostTxt (360 rows)
  const iscCount = 360
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pItemStatCostTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, iscCount)

  // ItemsTxt (128 rows)
  const itemsCount = 128
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE) >>> 0
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32((SG_ITEM_DATATABLES_VA_113C + 4) >>> 0, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, itemsCount)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)

  // ItemTypesTxt & equivalence bitset (96 item types, 3 dwords/row)
  const itemTypesCount = 96
  const equivDwords = 3
  const pItemTypesTxt = m.alloc(itemTypesCount * D2ItemTypesTxt_SIZE) >>> 0
  const pItemTypesEquiv = m.alloc(itemTypesCount * equivDwords * 4) >>> 0
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemTypesTxtRecordCount) >>> 0, itemTypesCount)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemTypesEquivDwords) >>> 0, equivDwords)
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemTypesEquiv) >>> 0, pItemTypesEquiv)
  for (let t = 0; t < itemTypesCount; t += 1) {
    m.setU32((pItemTypesEquiv + (t * equivDwords + (t >> 5)) * 4) >>> 0, (1 << (t & 31)) >>> 0)
  }

  // BooksTxt, RunesTxt, BeltsTxt, QualityItemsTxt, InventoryTxt
  const pBooksTxt = m.alloc(8 * 0x20) >>> 0
  m.setU32(SGPT_BOOKS_TXT_PTR_VA, pBooksTxt)
  m.setU32(SGPT_BOOKS_TXT_COUNT_VA, 8)
  const pRunesTxt = m.alloc(4 * 0x120) >>> 0
  m.setU32(0x6fdefbd4, 4)
  m.setU32(0x6fdefbd8, pRunesTxt)
  const pBeltsTxt = m.alloc(8 * 0x108) >>> 0
  m.setU32(SGPT_BELTS_TXT_PTR_VA, pBeltsTxt)
  m.setU32(SGPT_BELTS_TXT_COUNT_VA, 8)
  m.setU32(pBeltsTxt + 0x04, 16)
  const pQualTxt = m.alloc(4 * 0x40) >>> 0
  m.setU32(SGPT_QUALITYITEMS_TXT_PTR_VA, pQualTxt)
  m.setU32(SGPT_QUALITYITEMS_TXT_COUNT_VA, 4)
  const pInventoryTxt = m.alloc(32 * 0xf0) >>> 0
  m.setU32(G_INVENTORY_TXT_TABLE_VA_113C, pInventoryTxt)
  m.setU32(SGPT_INVENTORY_TXT_PTR_VA, pInventoryTxt)
  m.setU32(SGPT_INVENTORY_TXT_MAX_VA, 32)
  for (let i = 0; i < 32; i += 1) {
    const rec = (pInventoryTxt + i * 0xf0) >>> 0
    m.setU8(rec + 0x10, 10) // gridW
    m.setU8(rec + 0x11, 4) // gridH
  }
  m.setU32(D2COMMON_CHAR_INV_REC_COUNT_VA_113C, 7)
  for (let c = 0; c < 7; c += 1) {
    m.setU32((D2COMMON_CHAR_INV_REC_TABLE_VA_113C + c * 8) >>> 0, c)
    m.setU32((D2COMMON_CHAR_INV_REC_TABLE_VA_113C + c * 8 + 4) >>> 0, c)
  }
  const pUniqueTxt = m.alloc(8 * 0x14c) >>> 0
  m.setU32((pDataTables + 0xc24) >>> 0, pUniqueTxt)
  m.setU32((pDataTables + 0xc28) >>> 0, 8)

  // LevelsTxt (140 rows) + LevelDefBin (140 rows * 0x9C)
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE) >>> 0
  const pLevelDefBin = m.alloc(levelsCount * 0x9c) >>> 0
  m.setU32(0x6fdf0b38, pLevelDefBin)
  m.setU32((pDataTables + 0x1dc) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0x1e0) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, levelsCount)
  for (let lvl = 1; lvl < levelsCount; lvl += 1) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set((pLevelsTxt + lvl * D2LevelsTxt_SIZE) >>> 0, D2LevelsTxt.nAct, act)
  }

  // ObjectsTxt (600 rows * 0x1C0)
  const pObjectsTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32((pDataTables + 0xc48) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xc50) >>> 0, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  // CharStatsTxt (7 classes * 0xC4)
  const pCharStatsTxt = m.alloc(7 * 0xc4) >>> 0
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStatsTxt)
  m.setU32((pDataTables + 0xbc8) >>> 0, 7)
  for (let c = 0; c < 7; c += 1) {
    const cs = (pCharStatsTxt + c * 0xc4) >>> 0
    m.setU8(cs + 0x30, 20) // str
    m.setU8(cs + 0x31, 25) // dex
    m.setU8(cs + 0x32, 15) // int
    m.setU8(cs + 0x33, 20) // vit
    m.setU8(cs + 0x34, 84) // stamina
    m.setU8(cs + 0x35, 50) // hpadd
    m.setU8(cs + 0x40, 6) // walkVelocity
  }

  // StatesTxt (200 rows * 0x3C) + masks
  const pStatesTxt = m.alloc(200 * 0x3c) >>> 0
  const pStateMaskExp = m.alloc(0x40) >>> 0
  const pCorpseMask = m.alloc(32) >>> 0
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, 200)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksDC) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksAura) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksExp) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + DATATABLES_OFF_113C.fStateMasksOnCurse) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x100) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x104) >>> 0, pStateMaskExp)
  m.setU32((pDataTables + 0x150) >>> 0, pCorpseMask)
  m.setU32((pDataTables + 0xbc0) >>> 0, 16)
  m.setU32((pDataTables + 0xbf0) >>> 0, 8)

  // TreasureClassEx, AnimMode tables & AnimData
  m.setU32(0x6fdf13a4, 16) // ANIM_MON_MODE_COUNT_VA_113C
  m.setU32(0x6fdf13b0, m.alloc(16 * 0x34)) // ANIM_MON_MODE_TBL_VA_113C
  m.setU32(0x6fdf13c4, 20)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))
  const pAnimData = m.alloc(0x800) >>> 0
  const pEmptyBucket = m.alloc(8) >>> 0
  for (let i = 0; i < 256; i += 1) {
    m.set(pAnimData, D2AnimDataTableStrc.pHashBuckets, pEmptyBucket, i)
  }
  m.setU32(0x6fdf0b4c, pAnimData)

  // Game + Timer wheel + Party control + Quest control
  const pGame = m.alloc(0x1df4) >>> 0
  m.setU32((pGame + 0x1c) >>> 0, 0x12340000)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  m.setU16((pGame + 0x78) >>> 0, 101)
  m.setU32((pGame + 0x70) >>> 0, 1)
  m.setU32((pGame + 0x74) >>> 0, 1) // ladder flag
  m.setU8((pGame + 0x6d) >>> 0, 0)
  m.setU32((pGame + 0x1d2c) >>> 0, m.alloc(0x20))
  m.setU32((pGame + 0x10f4) >>> 0, m.alloc(0x40))
  for (let act = 0; act < 5; act += 1) {
    const pAct = m.alloc(0x80) >>> 0
    m.setU32((pAct + 0x04) >>> 0, m.alloc(0x80) >>> 0)
    m.setU32((pAct + 0x48) >>> 0, m.alloc(0x500) >>> 0)
    m.setU32((pGame + 0xbc + act * 4) >>> 0, pAct)
  }
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pMissilesTxt,
    pItemsTxt,
    pItemTypesTxt,
    pItemTypesEquiv,
    pItemStatCostTxt,
    pBooksTxt,
    pQualTxt,
    pRunesTxt,
    pCharStatsTxt,
    pLevelsTxt,
    pObjectsTxt,
    pStatesTxt,
  }
}

function allocClientWithQueue(m: SparseMemory113c, pGame = 0) {
  const pClient = m.alloc(0x600) >>> 0
  const pQueue = m.alloc(0x410) >>> 0
  m.setU32((pClient + 0x04) >>> 0, 4)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  m.setU32((pClient + 0x1a8) >>> 0, pGame)
  return { pClient, pQueue }
}

function allocRoom(m: SparseMemory113c, levelId = 2, x = 100, y = 100, w = 40, h = 40) {
  const pRoom = m.alloc(Math.max(D2ActiveRoomStrc_SIZE, 0x100)) >>> 0
  const pRoomEx = m.alloc(Math.max(D2RoomExStrc_SIZE, 0x90)) >>> 0
  const pLevel = m.alloc(Math.max(D2DrlgLevelStrc_SIZE, 0x280)) >>> 0
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, m.alloc(4))
  m.setU32((pRoom + 0x4c) >>> 0, x)
  m.setU32((pRoom + 0x50) >>> 0, y)
  m.setU32((pRoom + 0x54) >>> 0, w)
  m.setU32((pRoom + 0x58) >>> 0, h)
  m.setU32((pRoom + 0x5c) >>> 0, x)
  m.setU32((pRoom + 0x60) >>> 0, y)
  m.setU32((pRoom + 0x64) >>> 0, w)
  m.setU32((pRoom + 0x68) >>> 0, h)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, levelId)
  const ppRooms = m.alloc(4) >>> 0
  m.setU32(ppRooms, pRoom)
  m.setU32(pRoom, ppRooms)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  return { pRoom, pRoomEx, pLevel }
}

function allocPlayerUnit(
  m: SparseMemory113c,
  pGame: number,
  unitId = 1,
  classId = 0,
  levelId = 2,
  posX = 110,
  posY = 110,
) {
  const { pClient, pQueue } = allocClientWithQueue(m, pGame)
  const { pRoom, pRoomEx, pLevel } = allocRoom(m, levelId, posX - 10, posY - 10)
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlayerData = m.alloc(0x180) >>> 0
  const pPath = m.alloc(Math.max(D2DynamicPathStrc_SIZE, 0x100)) >>> 0
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
  const pInventory = INVENTORY_AllocInventory113c(m, 0, pPlayer) >>> 0

  m.setU32(pPlayer, 0)
  m.setU32((pPlayer + 0x04) >>> 0, classId)
  m.setU32((pPlayer + 0x0c) >>> 0, unitId)
  m.setU32((pPlayer + 0x10) >>> 0, 1)
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
  m.setU32((pPlayer + 0x20) >>> 0, 0x12345)
  m.setU32((pPlayer + 0x24) >>> 0, 666)
  m.setU32((pPlayer + 0x2c) >>> 0, pPath)
  m.setU32((pPlayer + 0x60) >>> 0, pInventory)
  m.setU32((pPlayer + 0x80) >>> 0, pGame)
  m.setU32((pPlayer + 0xa8) >>> 0, m.alloc(0x20) >>> 0)
  m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x14) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x18) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
  m.setU8((pClient + 0x0d) >>> 0, 0x48) // 'H'
  m.setU8((pClient + 0x0e) >>> 0, 0x65) // 'e'
  m.setU8((pClient + 0x0f) >>> 0, 0x72) // 'r'
  m.setU8((pClient + 0x10) >>> 0, 0x6f) // 'o'
  m.setU8((pClient + 0x11) >>> 0, 0x00)
  m.setU8((pClient + 0x3d4) >>> 0, 1)
  m.setU32((pClient + 0x174) >>> 0, pPlayer)
  m.setU32((pClient + 0x1b4) >>> 0, pRoom)

  m.setU32(pPath, posX << 16)
  m.setU32((pPath + 0x04) >>> 0, posY << 16)
  m.setU16((pPath + 0x02) >>> 0, posX)
  m.setU16((pPath + 0x06) >>> 0, posY)
  m.setU16((pPath + 0x10) >>> 0, posX + 2)
  m.setU16((pPath + 0x12) >>> 0, posY + 2)
  m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
  m.set(pPath, D2DynamicPathStrc.pUnit, pPlayer)

  STATLIST_CreateEx113c(m, pPlayer, 0x80000000, pGame)
  SUNIT_SetMonsterAlignmentState113c(m, pPlayer, 2, 0)
  return { pPlayer, pPlayerData, pClient, pQueue, pInventory, pPath, pQuestFlags, pRoom, pRoomEx, pLevel }
}

function allocMonsterUnit(
  m: SparseMemory113c,
  pGame: number,
  classId = 5,
  unitId = 10,
  posX = 110,
  posY = 110,
  levelId = 2,
) {
  const { pRoom, pRoomEx, pLevel } = allocRoom(m, levelId, posX - 10, posY - 10)
  const pMonster = m.alloc(0x100) >>> 0
  const pMonData = m.alloc(0x80) >>> 0
  const pAiGen = m.alloc(0x48) >>> 0
  const pAiCtrl = m.alloc(0x48) >>> 0
  const pPath = m.alloc(Math.max(D2DynamicPathStrc_SIZE, 0x100)) >>> 0

  m.setU32(pMonster, 1)
  m.setU32((pMonster + 0x04) >>> 0, classId)
  m.setU32((pMonster + 0x0c) >>> 0, unitId)
  m.setU32((pMonster + 0x10) >>> 0, 1)
  m.setU32((pMonster + 0x14) >>> 0, pMonData)
  m.setU32((pMonster + 0x20) >>> 0, 0x54321)
  m.setU32((pMonster + 0x24) >>> 0, 666)
  m.setU32((pMonster + 0x2c) >>> 0, pPath)
  m.setU32((pMonster + 0x80) >>> 0, pGame)
  m.setU32((pMonster + 0xa8) >>> 0, m.alloc(0x20) >>> 0)
  m.setU32((pMonData + 0x28) >>> 0, pAiGen)
  m.setU32((pMonData + 0x2c) >>> 0, pAiCtrl)

  m.setU32(pPath, posX << 16)
  m.setU32((pPath + 0x04) >>> 0, posY << 16)
  m.setU16((pPath + 0x02) >>> 0, posX)
  m.setU16((pPath + 0x06) >>> 0, posY)
  m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
  m.set(pPath, D2DynamicPathStrc.pUnit, pMonster)

  STATLIST_CreateEx113c(m, pMonster, 0x80000000, pGame)
  return { pMonster, pMonData, pAiGen, pAiCtrl, pPath, pRoom, pRoomEx, pLevel }
}

function allocBasicItem(
  m: SparseMemory113c,
  pGame: number,
  classId = 1,
  unitId = 200,
  mode = 0,
  posX = 0,
  posY = 0,
) {
  const pItem = m.alloc(0x100) >>> 0
  const pItemData = m.alloc(Math.max(D2ItemDataStrc_SIZE, 0x80)) >>> 0
  const pStaticPath = m.alloc(0x28) >>> 0
  m.setU32(pItem, 4)
  m.setU32((pItem + 0x04) >>> 0, classId)
  m.setU32((pItem + 0x0c) >>> 0, unitId)
  m.setU32((pItem + 0x10) >>> 0, mode)
  m.setU32((pItem + 0x14) >>> 0, pItemData)
  m.setU32((pItem + 0x20) >>> 0, 0x24680)
  m.setU32((pItem + 0x24) >>> 0, 666)
  m.setU32((pItem + 0x2c) >>> 0, pStaticPath)
  m.setU32((pItem + 0x80) >>> 0, pGame)
  m.setU32((pStaticPath + 0x0c) >>> 0, posX)
  m.setU32((pStaticPath + 0x10) >>> 0, posY)
  STATLIST_CreateEx113c(m, pItem, 0x80000000, pGame)
  return { pItem, pItemData, pStaticPath }
}

function attachItemToInventory(
  m: SparseMemory113c,
  pInventory: number,
  pItem: number,
  _pItemData: number,
): void {
  INVENTORY_LinkItemToInventoryList113c(m, pItem, pInventory)
}

describe('[K2] D2Game 1.13c Disassembly-Verified Promotion Wave 9 (+147 VAs)', () => {
  it('validates manifest diff-verified status, indirectUnknown retention, and PE32 D2Game.dll (0x6FC20000) opcodes across all 147 VAs', () => {
    expect(WAVE9_PROMOTED_SPECS.length).toBe(147)
    const uniqueVas = new Set(WAVE9_PROMOTED_SPECS.map((s) => s.va.toUpperCase()))
    expect(uniqueVas.size).toBe(147)

    const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    const d2GameFnByVa = new Map(
      manifest.functions
        .filter((f) => f.module === 'D2Game')
        .map((f) => [f.va.toUpperCase(), f]),
    )

    for (const spec of WAVE9_PROMOTED_SPECS) {
      const fn = d2GameFnByVa.get(spec.va.toUpperCase())
      expect(fn, `Missing manifest entry for ${spec.va}`).toBeDefined()
      expect(fn!.status, `${spec.va} (${fn!.name}) must be diff-verified`).toBe('diff-verified')
      expect(fn!.tsSymbol).toBe(spec.tsSymbol)
      expect(fn!.size).toBe(spec.size)
      expect(Boolean(fn!.indirectUnknown)).toBe(false)
      expect(fn!.diffEvidence).toContain('tests/oracle/k2/k2-disasm-verified-wave9.test.ts')
    }

    // All 10 formerly indirectUnknown VAs in these 4 shards were promoted in Wave 23 (Batches A/B)
    for (const iuVa of WAVE9_INDIRECT_UNKNOWN_PORTED_VAS) {
      const fn = d2GameFnByVa.get(iuVa.toUpperCase())
      expect(fn, `Missing manifest entry for ${iuVa}`).toBeDefined()
      expect(fn!.status, `${iuVa} promoted to diff-verified in Wave 23`).toBe('diff-verified')
    }

    const d2GameDllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    if (fs.existsSync(d2GameDllPath)) {
      const pe = loadPeSectionMapper(d2GameDllPath, 0x6fc20000)
      for (const spec of WAVE9_PROMOTED_SPECS) {
        const vaNum = parseInt(spec.va, 16) >>> 0
        expect(vaNum).toBeGreaterThanOrEqual(pe.textStart)
        expect(vaNum + spec.size).toBeLessThanOrEqual(pe.textEnd)
        const off = pe.vaToFileOffset(vaNum)
        const fnBytes = pe.buf.subarray(off, off + spec.size)
        expect(fnBytes[0], `${spec.va} starts on int3`).not.toBe(0xcc)
        expect(fnBytes[0], `${spec.va} starts on nop`).not.toBe(0x90)

        const actualHead = fnBytes.subarray(0, Math.min(8, spec.size)).toString('hex')
        const actualTail = fnBytes.subarray(Math.max(0, spec.size - 3), spec.size).toString('hex')
        expect(actualHead, `PE32 head opcode mismatch at ${spec.va}`).toBe(spec.headHex)
        expect(actualTail, `PE32 tail opcode mismatch at ${spec.va}`).toBe(spec.tailHex)

        const lastByte = fnBytes[spec.size - 1]!
        const retImmOp = spec.size >= 3 ? fnBytes[spec.size - 3]! : 0
        const tailJmpOp = spec.size >= 5 ? fnBytes[spec.size - 5]! : 0
        const shortJmpOp = spec.size >= 2 ? fnBytes[spec.size - 2]! : 0
        const noreturnHotpatchPad =
          spec.size >= 7 &&
          fnBytes[spec.size - 7] === 0xe8 &&
          fnBytes[spec.size - 2] === 0x8b &&
          fnBytes[spec.size - 1] === 0xff
        expect(
          lastByte === 0xc3 ||
            lastByte === 0xcc ||
            retImmOp === 0xc2 ||
            tailJmpOp === 0xe9 ||
            shortJmpOp === 0xeb ||
            noreturnHotpatchPad,
          `${spec.va} unexpected epilogue ${actualTail}`,
        ).toBe(true)
      }
    }
  })

  const cumulativeHits = new Set<string>()

  it('SHARD 1 (k2w1-laneC-combat-core): executes all 37 promoted VAs with behavioral assertions and 100% va-trace hits', () => {
    beginVaTrace113c()
    const { m, pGame, pItemsTxt, pSkillsTxt } = createWave9World()
    const p1 = allocPlayerUnit(m, pGame, 11, 0, 1, 100, 100)
    const p2 = allocPlayerUnit(m, pGame, 12, 1, 1, 102, 100)
    SUNIT_InsertServerUnit113c(m, pGame, p1.pPlayer)
    SUNIT_InsertServerUnit113c(m, pGame, p2.pPlayer)

    // 0x6FC90010: PLRTRADE_SyncClonedItemEarOrPersonalizedData113c
    const srcEar = allocBasicItem(m, pGame, 1, 201)
    const dstEar = allocBasicItem(m, pGame, 1, 202)
    m.setU16(pItemsTxt + 1 * D2ItemsTxt_SIZE + D2ItemsTxt.wType1.off, 7) // ITEMTYPE_EAR = 7
    m.setU8(srcEar.pItemData + D2ItemDataStrc.szPlayerName.off, 0x41) // 'A'
    m.setU8(srcEar.pItemData + D2ItemDataStrc.szPlayerName.off + 1, 0x00)
    PLRTRADE_SyncClonedItemEarOrPersonalizedData113c(m, dstEar.pItem, srcEar.pItem, 1)
    expect(m.u8(dstEar.pItemData + D2ItemDataStrc.szPlayerName.off)).toBe(0x41)

    // 0x6FC90080 & 0x6FC90190: Cube page item detection & count
    expect(PLRTRADE_HasAnyCubePageItemOnUnit113c(m, p1.pPlayer)).toBe(0)
    expect(PLRTRADE_CountCubePageItemsInInventory113c(m, p1.pInventory)).toBe(0)
    ITEMS_SetInvPage113c(m, srcEar.pItem, 3)
    INVENTORY_LinkItemToInventoryList113c(m, srcEar.pItem, p1.pInventory)
    expect(PLRTRADE_HasAnyCubePageItemOnUnit113c(m, p1.pPlayer)).toBe(1)
    expect(PLRTRADE_CountCubePageItemsInInventory113c(m, p1.pInventory)).toBe(1)

    // 0x6FC90170, 0x6FC90180: Trade button noops
    expect(PLRTRADE_TradeButtonNoopAction3_113c(m, pGame, p1.pPlayer)).toBe(0)
    expect(PLRTRADE_TradeButtonNoopAction2_113c(m, pGame, p1.pPlayer)).toBe(0)

    // 0x6FC901F0: CanModifyBeltDuringTrade
    m.setU8(p1.pPlayer + 0x6c, 0)
    expect(PLRTRADE_CanModifyBeltDuringTrade113c(m, p1.pPlayer)).toBe(1)
    const pTrade1 = m.alloc(0x60) >>> 0
    const pTrade2 = m.alloc(0x60) >>> 0
    m.setU8(p1.pPlayer + 0x6c, 1)
    m.setU32(p1.pPlayer + 0x68, 0)
    m.setU8(srcEar.pItemData + D2ItemDataStrc.pExtraOwnerInventory.off + 0x0d, 2) // nNodePosOther = 2 (trade buffer)
    expect(PLRTRADE_CanModifyBeltDuringTrade113c(m, p1.pPlayer)).toBe(0)

    // 0x6FC90B70: SendTradeAcceptButtonAndSetState3
    expect(
      PLRTRADE_SendTradeAcceptButtonAndSetState3_113c(m, p1.pPlayer, p2.pPlayer, pTrade1, pTrade2),
    ).toBe(3)
    expect(m.u32(pTrade1 + 0x50)).toBe(3)
    expect(m.u32(pTrade2 + 0x50)).toBe(3)

    // 0x6FC90C90: BroadcastClearMercUnitCallback
    PLRTRADE_BroadcastClearMercUnitCallback113c(m, pGame, p1.pPlayer, p2.pPlayer)

    // 0x6FC94890 & 0x6FC94E40: Monster mode/event handlers
    const mon = allocMonsterUnit(m, pGame, 118, 301, 105, 100, 1)
    SUNIT_InsertServerUnit113c(m, pGame, mon.pMonster)
    MONSTER_EndModeS3Noop113c(m, pGame, mon.pMonster)
    m.setU32(mon.pMonData + 0x34, 0xdead)
    m.setU32(mon.pMonData + 0x38, 0xbeef)
    MONSTER_Event10_ClearMonsterFields34And38_113c(m, pGame, mon.pMonster, 0, 0)
    expect(m.u32(mon.pMonData + 0x34)).toBe(0)
    expect(m.u32(mon.pMonData + 0x38)).toBe(0)

    // 0x6FC97920, 0x6FC97930, 0x6FC97940: Player skill mode noop handlers
    expect(PLAYER_SkillModeNoopHandler_04_09_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(1)
    expect(PLAYER_SkillModeNoopHandler_01_05_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(1)
    expect(PLAYER_SkillModeNoopHandler_00_17_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(1)

    // 0x6FC98100: CanInterruptCurrentSkillOrEvent (frame 100 > nextEvent 0 + 5 -> 0)
    m.setU8(pSkillsTxt + 5 * D2SkillsTxt_SIZE + 0x04, 0)
    expect(PLAYER_CanInterruptCurrentSkillOrEvent113c(m, p1.pPlayer, pGame)).toBe(0)

    // 0x6FC9A540: NET_SendRemoveUnitPacket0A113c
    m.setU32(p1.pQueue, 0)
    NET_SendRemoveUnitPacket0A113c(m, mon.pMonster, p1.pClient)
    expect(m.u32(p1.pQueue)).toBe(6)
    expect(m.u8(p1.pQueue + 4)).toBe(0x0a)
    expect(m.u8(p1.pQueue + 5)).toBe(1)
    expect(m.u32(p1.pQueue + 6)).toBe(301)

    // 0x6FC9B4E0, 0x6FC9B4F0, 0x6FC9B510, 0x6FC9BD00: AI / region helpers
    AITHINK_Fn146_UberMephistoNoop113c(m, pGame, mon.pMonster, 0)
    const pAiParam = m.alloc(0x20) >>> 0
    m.setU32(pAiParam, mon.pAiCtrl)
    AIINIT_SpawnerResetFrameTimers113c(m, pGame, mon.pMonster, pAiParam)
    expect(m.u32(mon.pAiCtrl + 0x14)).toBe(100)
    expect(m.u32(mon.pAiCtrl + 0x18)).toBe(0)
    expect(MONSTER_GetOrRollRegionSubVariant113c(m, mon.pMonster, pGame)).toBe(0)
    expect(AI_FilterLivingGloamUnit113c(m, mon.pMonster, 0)).toBe(1)

    // 0x6FCEB190..0x6FCECB10: C2S packets & interaction checks
    expect(PACKET_C2S66_WardenResponseNoop113c(m, pGame, p1.pPlayer, 0, 1)).toBe(0)
    expect(PACKET_C2S43_QuestInitNoop113c(m, pGame, p1.pPlayer, 0, 1)).toBe(0)
    expect(PACKET_C2S42_ClearCursorNoop113c(m, pGame, p1.pPlayer, 0, 1)).toBe(0)
    expect(PACKET_C2S2E_PlaySoundNoop113c(m, pGame, p1.pPlayer, 0, 1)).toBe(0)
    expect(PACKET_C2S2C_Reject3_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(3)
    expect(PACKET_C2S52_Reject3_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(3)
    expect(PACKET_C2S45_Reject3_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(3)
    expect(PACKET_C2S39_Reject3_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(3)
    expect(PACKET_C2S2D_Reject3_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(3)

    const pkt58 = m.alloc(0x10) >>> 0
    m.setU8(pkt58, 0x58)
    m.setU16(pkt58 + 1, 0x05)
    expect(PACKET_C2S58_MarkQuestIntroSeen113c(m, pGame, p1.pPlayer, pkt58, 3)).toBe(0)
    expect((m.u16(m.u32(p1.pQuestFlags) + 0x05 * 2) >> 12) & 1).toBe(1)

    const pkt4b = m.alloc(0x10) >>> 0
    m.setU8(pkt4b, 0x4b)
    m.setU32(pkt4b + 1, 1)
    m.setU32(pkt4b + 5, 301)
    m.set(mon.pPath, D2DynamicPathStrc.pRoom, p1.pRoom)
    expect(PACKET_C2S4B_RequestUnitRefresh113c(m, pGame, p1.pPlayer, pkt4b, 9)).toBe(0)
    expect((m.u32(mon.pMonster + 0xc8) & 0x10000) !== 0).toBe(true)

    m.setU8(p1.pPlayer + 0x6c, 1)
    m.setU32(p1.pPlayer + 0x64, 0)
    m.setU32(p1.pPlayer + 0x68, 12)
    expect(PACKET_IsInteractingWithDifferentPlayer113c(m, p1.pPlayer, pGame, p2.pPlayer)).toBe(0)

    // 0x6FCF16B0..0x6FCF1E10: Item helpers
    expect(ITEMS_AreAffixesEqual113c(m, srcEar.pItem, dstEar.pItem)).toBe(1)
    expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 4)).toBe(5)
    expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 5)).toBe(4)
    expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 6)).toBe(7)
    expect(ITEMS_GetOppositeHandOrRingBodyLoc113c(m, 11)).toBe(12)
    ITEMMODE_UnitTimerNoop113c(m, pGame, srcEar.pItem)

    const hfA = m.alloc(0x20) >>> 0
    const hfB = m.alloc(0x20) >>> 0
    m.setU32(hfA + 0x08, 1) // two-handed weapon
    m.setU32(hfB + 0x08, 1)
    expect(ITEMS_AreWeaponSlotTypesCompatible113c(m, hfA, hfB)).toBe(0)

    const recA = (pItemsTxt + 1 * D2ItemsTxt_SIZE) >>> 0
    const recB = (pItemsTxt + 2 * D2ItemsTxt_SIZE) >>> 0
    m.setU32(recA + 0x80, 0x20317271)
    m.setU32(recB + 0x80, 0x20327271)
    expect(ITEMS_DoItemRecordsMatchCodePair113c(m, recA, recB, 0x20317271, 0x20327271)).toBe(1)

    const pOutDrop = m.alloc(0x84) >>> 0
    ITEMS_BuildItemDropParamsFromItem113c(m, pOutDrop, srcEar.pItem, pGame, 1)
    expect(m.u32(pOutDrop + 0x08)).toBe(pGame)

    const hits = endVaTrace113c()
    for (const v of hits) cumulativeHits.add(v)
    const missing = WAVE9_PROMOTED_SPECS.filter((s) => s.batch === 'k2w1-laneC-combat-core')
      .map((s) => `D2Game:${s.va}`)
      .filter((k) => !hits.has(k))
    expect(missing).toEqual([])
  })

  it('SHARD 2 (k2w4-b6): executes all 37 promoted VAs + verifies all 9 1.13c disassembly bug fixes with 100% va-trace hits', () => {
    beginVaTrace113c()
    const { m, pGame, pSkillsTxt, pMonStatsTxt, pMonStats2Txt, pStatesTxt, pItemsTxt } =
      createWave9World()
    const p1 = allocPlayerUnit(m, pGame, 1, 0, 2, 110, 110)
    const mon = allocMonsterUnit(m, pGame, 25, 20, 112, 110, 2)
    const mon2 = allocMonsterUnit(m, pGame, 26, 21, 114, 110, 2)
    SUNIT_InsertServerUnit113c(m, pGame, p1.pPlayer)
    SUNIT_InsertServerUnit113c(m, pGame, mon.pMonster)
    SUNIT_InsertServerUnit113c(m, pGame, mon2.pMonster)

    // 0x6FCBD610 & 0x6FCBD6F0
    const pAct0 = m.alloc(0x80) >>> 0
    const pEnv = m.alloc(0x80) >>> 0
    m.setU32(pAct0 + 0x04, pEnv)
    m.setU32(pGame + 0xbc, pAct0)
    m.setU8(p1.pClient + 0x1ac, 0)
    CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c(m, p1.pClient, pGame)
    expect(() => ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c(m, pGame, 0)).toThrow()

    // 0x6FCBE570, 0x6FCBE730, 0x6FCBE810, 0x6FCBE8E0, 0x6FCBEA30
    const pFind = SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c(m, 110, pGame, p1.pPlayer, 6, 110)
    expect(pFind).toBeGreaterThan(0)
    expect(SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c(m, p1.pPlayer)).toBe(6 << 8)
    expect(SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c(m, p1.pPlayer, p1.pPlayer, 1)).toBe(0)
    expect(SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c(m, pGame, p1.pPlayer, 0, 1)).toBe(0)

    // State group 3 shared by states 10 and 11
    m.setU16(pStatesTxt + 10 * 0x3c + 0x1e, 3)
    m.setU16(pStatesTxt + 11 * 0x3c + 0x1e, 3)
    const pSl10 = STATLIST_AllocList113c(m, 2, 0, 1, 0, 500)
    STATLIST_SetState113c(m, pSl10, 10)
    STATLIST_MergeStatLists113c(m, p1.pPlayer, pSl10, 1)
    STATES_ToggleGfxStateFlag113c(m, p1.pPlayer, 10, 1)
    expect(STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c(m, p1.pPlayer, 11)).toBe(1)
    expect(STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(m, p1.pPlayer, 11, 0)).toBeGreaterThanOrEqual(0)

    // 0x6FCBF210, 0x6FCBF4A0, 0x6FCBF730
    const pDmg = m.alloc(0x70) >>> 0
    m.setU8(pSkillsTxt + 4 * D2SkillsTxt_SIZE + 0x1a4, 8) // nHitShift = 8
    m.setU8(pSkillsTxt + 4 * D2SkillsTxt_SIZE + 0x1dc, 1) // fire
    m.setU32(pSkillsTxt + 4 * D2SkillsTxt_SIZE + 0x1e0, 5) // eMin = 5
    m.setU32(pSkillsTxt + 4 * D2SkillsTxt_SIZE + 0x1f8, 10) // eMax = 10
    expect(SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, 4, p1.pPlayer, pDmg, 1)).toBeGreaterThanOrEqual(5 << 8)
    expect(SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c(m, pGame, p1.pPlayer, 9999, 0)).toBe(0)
    SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c(m, mon.pMonster)

    // 0x6FCC09F0, 0x6FCC0E80, 0x6FCC0F40, 0x6FCC0FC0
    expect(STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c(m, 1, 4, 0, p1.pPlayer, p1.pPlayer, 0, 12)).toBeGreaterThan(0)
    PATH_SetTargetUnit113c(m, p1.pPath, mon.pMonster)
    expect(SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c(m, pGame, p1.pPlayer, 4, 1)).toBe(1)
    const pOutCnt = m.alloc(4) >>> 0
    expect(SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(m, 0, 8, 4, pOutCnt, 110, pGame, p1.pPlayer, 110)).toBe(0)
    expect(SKILLS_CountUnitsInRadius_6FCC0FC0_113c(m, 0, 8, 110, pGame, p1.pPlayer, 110)).toBe(0)

    // REGRESSION FIX #1 (0x6FCC16A0): fires D2Game:0x6FC2EA10 (ReplenishQuantity) AND D2Game:0x6FC99100 (default -1,-1 path)
    const throwItem = allocBasicItem(m, pGame, 1, 210)
    STATLIST_SetUnitStat113c(m, throwItem.pItem, 0x46, 5, 0) // quantity = 5
    STATLIST_SetUnitStat113c(m, throwItem.pItem, 0xfd, 5, 0) // replenish quantity rate = 5
    STATLIST_SetUnitStat113c(m, throwItem.pItem, 0x48, 10, 0) // cur dur = 10
    STATLIST_SetUnitStat113c(m, throwItem.pItem, 0x49, 20, 0) // max dur = 20
    const qtyRes = SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c(
      m,
      throwItem.pItem,
      pGame,
      p1.pPlayer,
    )
    expect(qtyRes).toBe(5) // returns pre-consume quantity (nNewQty + 1)
    expect(STATLIST_GetUnitStat113c(m, throwItem.pItem, 0x46, 0)).toBe(4)
    expect(STATLIST_GetUnitStat113c(m, throwItem.pItem, 0x48, 0)).toBe(20)
    expect(EVENT_GetNextEventFrame113c(m, throwItem.pItem, 3)).toBe(100 + Math.trunc(0x9c4 / 5) + 1)

    // 0x6FCC26E0
    const pMisParams = m.alloc(0x80) >>> 0
    m.setU32(pMisParams + 0x04, p1.pPlayer)
    m.setU32(pMisParams + 0x10, 110)
    m.setU32(pMisParams + 0x14, 110)
    SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c(m, pMisParams, pGame, 0)

    // REGRESSION FIX #2 (0x6FCC2DE0): player branch calls PLAYER_StartModeOnUnit113c (0x6FC98430) with mode 7 & skill 0
    SKILLS_SetSkillLevelOnUnit113c(m, p1.pPlayer, 0, 1, 0, 0, 0)
    const pAtkSkill = SKILLS_GetSkillById113c(m, p1.pPlayer, 0, -1)
    expect(pAtkSkill).not.toBe(0)
    expect(
      SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c(
        m,
        p1.pPlayer,
        pGame,
        mon.pMonster,
      ),
    ).toBe(1)
    expect(m.u32(p1.pPlayer + 0x10)).toBe(7)
    // Also exercise monster branch (dwUnitType === 1)
    expect(
      SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c(
        m,
        mon.pMonster,
        pGame,
        p1.pPlayer,
      ),
    ).toBe(1)

    // 0x6FCC2EE0
    m.setU32(mon.pMonData + 0x40, 0xffffffff)
    SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c(m, mon.pMonster, pGame)

    // REGRESSION FIX #3 (0x6FCC2F90): STATLIST_AllocList113c args (flags=2, ownerType=1, ownerId=20, stateNo=0, expireFrame=200)
    SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c(m, 0x15, mon.pMonster, pGame)
    const pStunList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, mon.pMonster, 0x15)
    expect(pStunList).not.toBe(0)
    expect(m.get(pStunList, D2StatListStrc.dwFlags)).toBe(2)
    expect(m.get(pStunList, D2StatListStrc.eOwnerType)).toBe(1)
    expect(m.get(pStunList, D2StatListStrc.dwOwnerId)).toBe(20)
    expect(m.get(pStunList, D2StatListStrc.dwExpireFrame)).toBe(200)
    expect(STATES_CheckState113c(m, mon.pMonster, 0x15)).toBe(1 << 0x15)

    // REGRESSION FIX #4 (0x6FCC3120): EVENT_SetEventFull113c handler=0 + arg14/arg18 + delete by arg14=nSkillLevel
    const periodicSkillId = 6
    m.setU8(pSkillsTxt + periodicSkillId * D2SkillsTxt_SIZE + 0x04, 1 << 6) // bit 6 -> bitMasks+0x18
    expect(
      SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c(m, periodicSkillId, 7, pGame, p1.pPlayer, 1, 1),
    ).toBe(1)
    let pEv = m.u32(p1.pPlayer + 0xdc) >>> 0
    let foundEv8 = 0
    while (pEv !== 0) {
      if (m.u8(pEv) === 8) {
        foundEv8 = pEv
        break
      }
      pEv = m.u32(pEv + 0x24) >>> 0
    }
    expect(foundEv8).not.toBe(0)
    expect(m.u32(foundEv8 + 0x10)).toBe(0) // handler = 0 (NOT -1!)
    expect(m.u32(foundEv8 + 0x14) | 0).toBe(-1) // arg14 = -1
    expect(m.u32(foundEv8 + 0x18)).toBe(0) // arg18 = 0

    expect(
      SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c(m, periodicSkillId, 7, pGame, p1.pPlayer, 1, 0),
    ).toBe(1)
    pEv = m.u32(p1.pPlayer + 0xdc) >>> 0
    let foundEv9 = 0
    while (pEv !== 0) {
      if (m.u8(pEv) === 9) {
        foundEv9 = pEv
        break
      }
      pEv = m.u32(pEv + 0x24) >>> 0
    }
    expect(foundEv9).not.toBe(0)
    expect(m.u32(foundEv9 + 0x10)).toBe(0) // handler = 0
    expect(m.u32(foundEv9 + 0x14)).toBe(7) // arg14 = nSkillLevel (7)
    expect(m.u32(foundEv9 + 0x18)).toBe(periodicSkillId) // arg18 = nSkillId (6)

    // REGRESSION FIX #5 (0x6FCC3220): both target aura (flags=2) and self aura (flags=4) StatList args unscrambled
    const meleeSkillId = 7
    const pMeleeSk = (pSkillsTxt + meleeSkillId * D2SkillsTxt_SIZE) >>> 0
    m.setU16(pMeleeSk + 0x4e, 0xffff) // wMonStatIcon = -1
    m.setU16(pMeleeSk + 0x82, 22) // wAuraTargetState = 22
    m.setU16(pMeleeSk + 0x80, 23) // wAuraState = 23
    const pMeleeDmg = m.alloc(0x70) >>> 0
    m.setU8(pMeleeDmg + 0x04, 1) // hit succeeded bit 0
    PATH_SetTargetUnit113c(m, p1.pPath, mon2.pMonster)
    SUNITDMG_AllocCombat113c(m, pGame, p1.pPlayer, mon2.pMonster, pMeleeDmg)
    expect(
      SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c(
        m,
        pGame,
        p1.pPlayer,
        meleeSkillId,
        1,
      ),
    ).toBe(1)
    const pTgtAura = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, mon2.pMonster, 22)
    expect(pTgtAura).not.toBe(0)
    expect(m.get(pTgtAura, D2StatListStrc.dwFlags)).toBe(2)
    expect(m.get(pTgtAura, D2StatListStrc.eOwnerType)).toBe(1)
    expect(m.get(pTgtAura, D2StatListStrc.dwOwnerId)).toBe(21)
    expect(m.get(pTgtAura, D2StatListStrc.dwExpireFrame)).toBe(101)
    const pSelfAura = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, p1.pPlayer, 23)
    expect(pSelfAura).not.toBe(0)
    expect(m.get(pSelfAura, D2StatListStrc.dwFlags)).toBe(4)
    expect(m.get(pSelfAura, D2StatListStrc.eOwnerType)).toBe(0)
    expect(m.get(pSelfAura, D2StatListStrc.dwOwnerId)).toBe(1)

    // REGRESSION FIX #6 (0x6FCC34E0): timed aura StatList args unscrambled
    const pTimedAura = SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c(
      m,
      pGame,
      p1.pPlayer,
      mon2.pMonster,
      24,
      meleeSkillId,
      1,
    )
    expect(pTimedAura).not.toBe(0)
    expect(m.get(pTimedAura, D2StatListStrc.dwFlags)).toBe(2)
    expect(m.get(pTimedAura, D2StatListStrc.eOwnerType)).toBe(0)
    expect(m.get(pTimedAura, D2StatListStrc.dwOwnerId)).toBe(1)
    expect(m.get(pTimedAura, D2StatListStrc.dwExpireFrame)).toBe(100)

    // REGRESSION FIX #7 (0x6FCC3B50): passes (curX, curY) in non-swapped order to MONREG_IsMonsterDeadAtCoords
    const originRoom = allocRoom(m, 2, 180, 40, 40, 40)
    const eastRoom = allocRoom(m, 2, 220, 40, 40, 40)
    const ppAdj = m.alloc(8) >>> 0
    m.setU32(ppAdj, originRoom.pRoom)
    m.setU32(ppAdj + 4, eastRoom.pRoom)
    m.setU32(originRoom.pRoom, ppAdj)
    m.setU32(originRoom.pRoom + 0x24, 2)
    const deadTarget = allocMonsterUnit(m, pGame, 6, 99, 230, 50, 2) // classId = 25 - 19 = 6
    m.setU32(deadTarget.pMonster + 0x10, 12) // dead anim mode
    m.setU32(eastRoom.pRoom + 0x74, deadTarget.pMonster)
    const probeMon = allocMonsterUnit(m, pGame, 25, 98, 190, 50, 2)
    m.set(probeMon.pPath, D2DynamicPathStrc.pRoom, originRoom.pRoom)
    m.set(pMonStatsTxt + 25 * D2MonStatsTxt_SIZE, D2MonStatsTxt.nSubClassIndex, 1)
    // Velocity (-1, 0) -> negDx = +1, negDy = 0 -> curX = 180 + 40 = 220, curY = 40 (hits eastRoom ONLY if non-swapped!)
    m.setU32(MONSTER_SUBCLASS_VEL_TABLE_VA + 1 * 8, (-1) >>> 0)
    m.setU32(MONSTER_SUBCLASS_VEL_TABLE_VA + 1 * 8 + 4, 0)
    expect(SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c(m, pGame, probeMon.pMonster)).toBe(1)

    // 0x6FCC3C80, 0x6FCC41B0
    m.setU8(pMonStatsTxt + 25 * D2MonStatsTxt_SIZE + 0x0d, 1 << 7) // bit 7 -> bitMasks+0x1c
    m.setU8(pMonStatsTxt + 25 * D2MonStatsTxt_SIZE + 0x0c, 1 << 6) // bit 6 -> MonStatsFlagBit6
    expect(SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c(m, mon.pMonster, p1.pPlayer)).toBe(1)
    AI_SetStateDirAndStartWalkMode_6FCC41B0_113c(m, 1, 0x50, mon.pMonster, pGame, p1.pPlayer)
    expect(m.u32(mon.pAiCtrl + 0x18)).toBe(7)
    expect(m.u8(mon.pAiCtrl + 0x20)).toBe(0x4d)

    // REGRESSION FIX #8 (0x6FCC4260) & 0x6FCC4450: LeftSkill set before RightSkill + owner skill level sync
    const pAiArgs = m.alloc(0x30) >>> 0
    const pAiCmd = m.alloc(0x30) >>> 0
    const pMonRec25 = (pMonStatsTxt + 25 * D2MonStatsTxt_SIZE) >>> 0
    m.setU32(pAiArgs + 0x00, pAiCmd)
    m.setU32(pAiArgs + 0x08, mon2.pMonster)
    m.setU32(pAiArgs + 0x14, 10)
    m.setU32(pAiArgs + 0x18, 1)
    m.setU32(pAiArgs + 0x1c, pMonRec25)
    m.setU32(mon.pAiGen + 0x28, pGame)
    m.setU32(mon.pAiGen + 0x2c, 1) // p1 guid
    m.setU32(mon.pAiGen + 0x30, 0) // UNIT_PLAYER
    m.setU16(pMonRec25 + 0x80, 0) // owner skill id 0
    AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c(m, mon.pMonster, pAiArgs)
    const pMonSkList = m.u32(mon.pMonster + 0xa8) >>> 0
    expect(pMonSkList).not.toBe(0)
    expect(m.u32(pMonSkList + 0x08)).not.toBe(0) // pLeftSkill
    expect(m.u32(pMonSkList + 0x0c)).not.toBe(0) // pRightSkill
    AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c(m, mon.pMonster, pAiArgs)
    expect(m.u32(pAiCmd + 0x1c)).toBeGreaterThanOrEqual(1)

    // 0x6FCC4A10, 0x6FCC4B90
    m.setU32(mon.pMonster + 0xc8, 1 << 10)
    m.setU32(mon.pMonster + 0x94, 0)
    m.setU32(mon.pMonster + 0x98, 1)
    expect(AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(m, mon.pMonster, pGame, pAiArgs, 1)).toBe(1)
    AI_AttackWestOffsetThenDie_6FCC4B90_113c(m, pGame, mon.pMonster, pAiArgs)

    // REGRESSION FIX #9 (0x6FCC4D10): uses canonical seedRoll (D2Game:0x6FC21180)
    m.setU32(pAiCmd + 0x1c, 0)
    m.setU16(pMonRec25 + 0x62, 10) // base seconds
    m.setU16(pMonRec25 + 0x56, 50) // attack chance
    m.setU16(pMonRec25 + 0x5c, 15) // stall frames
    AI_TickSummonedTimedAttacker_6FCC4D10_113c(m, pGame, mon.pMonster, pAiArgs)
    expect(m.u32(pAiCmd + 0x1c)).toBeGreaterThanOrEqual(100 + 250)

    // 0x6FCC4E40, 0x6FCC4F40, 0x6FCC5350, 0x6FCC5580, 0x6FCC57E0, 0x6FCC58D0
    AI_CastSkill286AtOffsetY13_6FCC4E40_113c(m, mon.pMonster, pAiArgs, 42)
    AI_TickAncientStatueRevertCheck_6FCC4F40_113c(m, pGame, mon.pMonster, pAiArgs)
    m.setU16(pMonRec25 + 0x50, 4) // radius
    AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c(m, pGame, mon.pMonster, pAiArgs)
    m.setU32(pAiCmd + 0x18, 0)
    AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c(m, pGame, mon.pMonster, pAiArgs)
    m.setU32(pAiCmd + 0x14, 500)
    AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c(m, pGame, mon.pMonster, pAiArgs)
    m.setU8(pMonStats2Txt + 25 * D2MonStats2Txt_SIZE + 0x105, 1)
    AI_TickAmbientMode8OrStall30_6FCC58D0_113c(m, pGame, mon.pMonster, pAiArgs)

    const hits = endVaTrace113c()
    // Verify canonical callee VA hits fixed in w4b6
    expect(hits.has('D2Game:0x6FC2EA10')).toBe(true) // 0x6FCC16A0 -> ReplenishQuantity
    expect(hits.has('D2Game:0x6FC99100')).toBe(true) // 0x6FCC16A0 -> ConsumeDualHandWeaponQuantity
    expect(hits.has('D2Game:0x6FC98430')).toBe(true) // 0x6FCC2DE0 -> PLAYER_StartModeOnUnit
    expect(hits.has('D2Game:0x6FC21180')).toBe(true) // 0x6FCC4D10 -> seedRoll
    for (const v of hits) cumulativeHits.add(v)
    const missing = WAVE9_PROMOTED_SPECS.filter((s) => s.batch === 'k2w4-b6')
      .map((s) => `D2Game:${s.va}`)
      .filter((k) => !hits.has(k))
    expect(missing).toEqual([])
  })

  it('SHARD 3 (k2w6-b6): executes all 37 promoted VAs + verifies all 4 1.13c disassembly bug fixes with 100% va-trace hits', () => {
    beginVaTrace113c()
    const { m, pGame, pItemsTxt, pItemTypesTxt, pRunesTxt, pSkillsTxt } = createWave9World()
    const p1 = allocPlayerUnit(m, pGame, 1, 0, 102, 110, 110)
    SUNIT_InsertServerUnit113c(m, pGame, p1.pPlayer)

    // 0x6FCEEC70, 0x6FCEEDE0, 0x6FCF0950: C2S belt packets
    const pkt = m.alloc(0x20) >>> 0
    expect(C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c(m, pGame, p1.pPlayer, pkt, 5)).toBe(3)
    expect(C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c(m, pGame, p1.pPlayer, pkt, 5)).toBe(3)
    expect(C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c(m, pGame, p1.pPlayer, pkt, 4)).toBe(3)

    // 0x6FCF2610, 0x6FCF2F00, 0x6FCF3450, 0x6FCF34B0, 0x6FCF36D0, 0x6FCF3950, 0x6FCF3A10, 0x6FCF3CB0, 0x6FCF4570
    const pOutLoc = m.alloc(4) >>> 0
    const pOutReject = m.alloc(4) >>> 0
    const itm = allocBasicItem(m, pGame, 1, 301)
    expect(ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c(m, itm.pItem, p1.pPlayer, pOutLoc, 1)).toBe(0)
    expect(ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c(m, p1.pPlayer, pGame, 0)).toBe(0)
    ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c(m, itm.pItem, p1.pPlayer, 1)
    expect(ITEMS_InsertScrollIntoTome_6FCF34B0_113c(m, 999, pGame, p1.pPlayer, 998, pOutReject)).toBe(0)
    expect(m.u32(pOutReject)).toBe(1)
    ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c(m, itm.pItem, pGame, p1.pPlayer, itm.pItem)
    const beltConsume = allocBasicItem(m, pGame, 1, 302, 2, 0, 0)
    SUNIT_InsertServerUnit113c(m, pGame, beltConsume.pItem)
    attachItemToInventory(m, p1.pInventory, beltConsume.pItem, beltConsume.pItemData)
    ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c(m, beltConsume.pItem, p1.pPlayer, pGame)
    expect(ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c(m, pGame, p1.pPlayer, itm.pItem)).toBe(0)
    expect(ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c(m, pGame, p1.pPlayer, itm.pItem)).toBe(0)
    ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, p1.pPlayer)

    // REGRESSION FIX #10 (0x6FCF4A70): runeword completion fires BOTH 0x6FC2EA70 & 0x6FC2EA10 directly
    const rwTarget = allocBasicItem(m, pGame, 10, 310, 0, 0, 0)
    const rwFiller = allocBasicItem(m, pGame, 11, 311, 4, 0, 0)
    m.setU16(pItemsTxt + 10 * D2ItemsTxt_SIZE + D2ItemsTxt.wType1.off, 3) // itemType 3
    m.set(pItemsTxt + 10 * D2ItemsTxt_SIZE, D2ItemsTxt.nSubType, 1) // socketable subtype != 0
    m.setU8(pItemsTxt + 10 * D2ItemsTxt_SIZE + 0x132, 0) // nComponent = 0
    m.setU8(pItemsTxt + 10 * D2ItemsTxt_SIZE + 0x134, 1) // nGemSockets = 1
    m.setU16(pItemsTxt + 11 * D2ItemsTxt_SIZE + D2ItemsTxt.wType1.off, 0x35) // ITEMTYPE_SOCKETABLE = 0x35
    // Configure identified (0x10), socketable flag (0x800), quality 2 (normal), 1 socket stat (stat 194 = 1), replenish stats 0xfc/0xfd
    m.setU32(rwTarget.pItemData + D2ItemDataStrc.dwQuality.off, 2)
    ITEMS_SetOrClearCommandFlags113c(m, rwTarget.pItem, 0x10, 1)
    ITEMS_SetOrClearCommandFlags113c(m, rwTarget.pItem, 0x800, 1)
    ITEMS_SetOrClearCommandFlags113c(m, rwFiller.pItem, 0x10, 1)
    STATLIST_SetUnitStat113c(m, rwTarget.pItem, 194, 1, 0) // 1 socket
    STATLIST_SetUnitStat113c(m, rwTarget.pItem, 0xfc, 10, 0) // replenish durability
    STATLIST_SetUnitStat113c(m, rwTarget.pItem, 0xfd, 10, 0) // replenish quantity
    m.setU8(pRunesTxt + 0x80, 1) // complete
    m.setU8(pRunesTxt + 0x81, 0) // non-ladder
    m.setU16(pRunesTxt + 0x86, 3) // iType[0] = 3
    m.setU32(pRunesTxt + 0x98, 11) // rune[0] = classId 11
    ITEMS_SetNodePage113c(m, rwTarget.pItem, 1)
    SUNIT_InsertServerUnit113c(m, pGame, rwTarget.pItem)
    SUNIT_InsertServerUnit113c(m, pGame, rwFiller.pItem)
    attachItemToInventory(m, p1.pInventory, rwTarget.pItem, rwTarget.pItemData)
    INVENTORY_SetCursorItem113c(m, p1.pInventory, rwFiller.pItem)
    const sockRes = ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c(
      m,
      311,
      pGame,
      p1.pPlayer,
      310,
      pOutReject,
      1,
      1,
      0,
      0,
    )
    expect(sockRes).toBe(1)
    expect(EVENT_GetNextEventFrame113c(m, rwTarget.pItem, 3)).toBe(100 + Math.trunc(0x9c4 / 10) + 1)

    // REGRESSION FIX #11 (0x6FCF4D30): RemoveItemFromInventory runs BEFORE SetCursorItem so cursor holds the belt item!
    const beltItm = allocBasicItem(m, pGame, 1, 320, 2, 0, 0)
    SUNIT_InsertServerUnit113c(m, pGame, beltItm.pItem)
    attachItemToInventory(m, p1.pInventory, beltItm.pItem, beltItm.pItemData)
    INVENTORY_SetCursorItem113c(m, p1.pInventory, 0)
    expect(ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c(m, p1.pPlayer, pGame, 320, pOutReject)).toBe(1)
    expect(INVENTORY_GetCursorItem113c(m, p1.pInventory)).toBe(beltItm.pItem)
    expect(m.u32(beltItm.pItem + 0x10)).toBe(4) // ITEMMODE_ONCURSOR

    // Act 3 quests & objects (0x6FD057D0..0x6FD0AA30)
    const pQuestData = m.alloc(0x100) >>> 0
    const pQEx = m.alloc(0x100) >>> 0
    const pQArg = m.alloc(0x40) >>> 0
    m.setU32(pQuestData + 0x00, 0x14)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQEx)
    m.setU32(pQuestData + 0xe0, 0x14)
    const pQuestCtrl = m.u32(pGame + 0x10f4) >>> 0
    m.setU32(pQuestCtrl, pQuestData)
    m.setU32(pQArg + 0x04, pGame)
    m.setU32(pQArg + 0x08, p1.pPlayer)
    m.setU32(pQArg + 0x0c, p1.pPlayer)
    m.setU8(pQEx + 0x05, 1)
    expect(ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c(m, pGame, pQuestData)).toBe(1)
    expect(ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c(m, pGame, p1.pPlayer, 0)).toBe(0)
    m.setU8(pQuestData + 0x0b, 3)
    expect(ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c(m, pGame, pQuestData)).toBe(1)
    ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c(m, pQuestData, pQArg)
    ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c(m, pQuestData, pQArg)
    ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c(m, pQuestData, pQArg)
    m.setU32(pQEx + 0x10, 1)
    ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c(m, pQuestData, 0)
    expect(m.u32(pQEx + 0x10)).toBe(0)
    ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c(m, pQuestData, pQArg)
    ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c(m, pQuestData, pQArg)
    ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c(m, pQuestData, pQArg)
    m.setU32(pQEx + 0x08, 1)
    ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c(m, pQuestData, 0)
    expect(m.u32(pQEx + 0x08)).toBe(0)

    const pObj = m.alloc(0x100) >>> 0
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x10, 1) // already opened -> returns 0 cleanly
    const pOpArgs = m.alloc(0x20) >>> 0
    m.setU32(pOpArgs + 0x00, pGame)
    m.setU32(pOpArgs + 0x04, pObj)
    m.setU32(pOpArgs + 0x08, p1.pPlayer)
    expect(ACT3Q3_OperateSewerLeverObject_6FD09F60_113c(m, pOpArgs)).toBe(0)
    expect(ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c(m, pOpArgs)).toBe(0)
    expect(ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c(m, pOpArgs)).toBe(0)
    expect(ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c(m, pOpArgs)).toBe(0)
    ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c(m, p1.pPlayer, pGame)
    const uberBoss = allocMonsterUnit(m, pGame, 704, 450, 110, 110, 136)
    QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c(m, pGame, uberBoss.pMonster)

    // 0x6FD0AEE0, 0x6FD0AF80: Player stats spend & reset
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 4, 3, 0) // 3 unspent stat points
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 0, 20, 0) // str = 20
    expect(PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c(m, p1.pPlayer, 0)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, p1.pPlayer, 0, 0)).toBe(21)
    expect(STATLIST_GetUnitStat113c(m, p1.pPlayer, 4, 0)).toBe(2)
    PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c(m, p1.pPlayer)
    expect(STATLIST_GetUnitStat113c(m, p1.pPlayer, 0, 0)).toBe(20)

    // 0x6FD0C260: WriteCorpseSection
    const pSaveBuf = m.alloc(0x400) >>> 0
    const ppIoBuf = m.alloc(4) >>> 0
    m.setU32(ppIoBuf, pSaveBuf)
    expect(
      PLAYERSAVE_WriteCorpseSection_6FD0C260_113c(m, pGame, p1.pPlayer, ppIoBuf, pSaveBuf + 0x400, 0, 0),
    ).toBe(0)
    expect(m.u16(pSaveBuf)).toBe(0x4d4a) // 'JM'

    // REGRESSION FIX #12 (0x6FD0C470): Right subtarget -> hdr+0x80/+0x82, Left subtarget -> hdr+0x84/+0x86
    const pHdrRightSkill = m.alloc(0x40) >>> 0
    m.setU32(pHdrRightSkill, pSkillsTxt)
    const pSkList = m.u32((p1.pPlayer + 0xa8) >>> 0) >>> 0
    m.setU32((pSkList + 0x08) >>> 0, pHdrRightSkill)
    m.setU32((pSkList + 0x0c) >>> 0, pHdrRightSkill)
    m.set(p1.pPlayerData, D2PlayerDataStrc.dwRightSubtargetType, 0x1111)
    m.set(p1.pPlayerData, D2PlayerDataStrc.dwRightSubtargetGuid, 0xffffffff)
    m.set(p1.pPlayerData, D2PlayerDataStrc.dwLeftSubtargetType, 0x2222)
    m.set(p1.pPlayerData, D2PlayerDataStrc.dwLeftSubtargetGuid, 0xffffffff)
    const pHdrBuf = m.alloc(0x200) >>> 0
    m.setU32(ppIoBuf, pHdrBuf)
    expect(
      PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c(m, p1.pPlayer, pGame, ppIoBuf, pHdrBuf + 0x200),
    ).toBe(0)
    expect(m.u32(ppIoBuf)).toBe(pHdrBuf + 0x14f)
    expect(m.u16(pHdrBuf + 0x80)).toBe(0x1111) // Right subtarget type at +0x80
    expect(m.u16(pHdrBuf + 0x84)).toBe(0x2222) // Left subtarget type at +0x84

    // REGRESSION FIX #13 (0x6FD0F940): Case 0 and Case 3 must NOT overwrite pLastLeader!
    const pPack = m.alloc(0x60) >>> 0
    m.setU32(pPack + 0x00, 4) // 4 entries: case 1 (leader), case 0 (standalone), case 3 (minion A), case 3 (minion B)
    m.setU8(pPack + 0x08, 0)
    // Entry 0: case 1 leader at (+0, +0)
    m.setU32(pPack + 0x0c, 0)
    m.setU32(pPack + 0x10, 0)
    m.setU32(pPack + 0x14, 1)
    // Entry 1: case 0 standalone at (+2, +0) — must NOT overwrite pLastLeader
    m.setU32(pPack + 0x18, 2)
    m.setU32(pPack + 0x1c, 0)
    m.setU32(pPack + 0x20, 0)
    // Entry 2: case 3 minion A at (+4, +0) — must attach to case 1 leader, NOT overwrite pLastLeader
    m.setU32(pPack + 0x24, 4)
    m.setU32(pPack + 0x28, 0)
    m.setU32(pPack + 0x2c, 3)
    // Entry 3: case 3 minion B at (+6, +0) — must STILL attach to original case 1 leader
    m.setU32(pPack + 0x30, 6)
    m.setU32(pPack + 0x34, 0)
    m.setU32(pPack + 0x38, 3)
    const spawnedAny = MONSTER_SpawnPresetPackTable_6FD0F940_113c(
      m,
      pPack,
      p1.pRoom,
      pGame,
      110,
      110,
      5,
      0,
      1,
      0,
    )
    expect(spawnedAny).toBeGreaterThanOrEqual(0)

    // 0x6FD10390: PLAYERLIST_FreeAllPlayerRelations
    PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c(m, p1.pPlayer, pGame)

    const hits = endVaTrace113c()
    expect(hits.has('D2Game:0x6FC2EA70')).toBe(true) // 0x6FCF4A70 -> ReplenishDurability
    expect(hits.has('D2Game:0x6FC2EA10')).toBe(true) // 0x6FCF4A70 -> ReplenishQuantity
    for (const v of hits) cumulativeHits.add(v)
    const missing = WAVE9_PROMOTED_SPECS.filter((s) => s.batch === 'k2w6-b6')
      .map((s) => `D2Game:${s.va}`)
      .filter((k) => !hits.has(k))
    expect(missing).toEqual([])
  })

  it('SHARD 4 (k2w5-b7): executes all 36 promoted VAs + verifies 0x6FCFCE00 bUseWeapon=0 & 0x6FCF6C80 party fixes with 100% va-trace hits', () => {
    beginVaTrace113c()
    const { m, pGame, pItemsTxt, pSkillsTxt, pBooksTxt, pQualTxt } = createWave9World()
    const p1 = allocPlayerUnit(m, pGame, 1, 0, 2, 110, 110)
    const mon = allocMonsterUnit(m, pGame, 5, 30, 112, 110, 2)
    SUNIT_InsertServerUnit113c(m, pGame, p1.pPlayer)
    SUNIT_InsertServerUnit113c(m, pGame, mon.pMonster)

    // 0x6FCEFF30 & 0x6FCF00A0
    const pkt59 = m.alloc(0x20) >>> 0
    m.setU8(pkt59, 0x59)
    expect(PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c(m, pGame, p1.pPlayer, pkt59, 10)).toBe(3)
    const pkt14 = m.alloc(0x20) >>> 0
    m.setU8(pkt14, 0x14)
    m.setU8(pkt14 + 3, 0x48) // 'H'
    m.setU8(pkt14 + 4, 0x69) // 'i'
    m.setU8(pkt14 + 5, 0)
    expect(PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c(m, pGame, p1.pPlayer, pkt14, 8)).toBe(0)

    // 0x6FCF17B0, 0x6FCF1B20, 0x6FCF1C00, 0x6FCF1F60, 0x6FCF2070, 0x6FCF22C0, 0x6FCF2310, 0x6FCF2380, 0x6FCF24B0
    const scrollItm = allocBasicItem(m, pGame, 3, 401)
    m.setU16(pItemsTxt + 3 * D2ItemsTxt_SIZE + D2ItemsTxt.wType1.off, 22) // scroll (0x16)
    m.setU32(pBooksTxt + 0x00, 0x20637374) // scroll code
    m.setU32(pBooksTxt + 0x10, 220) // skill id
    m.setU32(pQualTxt + 0x08, 220) // scroll skill id in QualityItemsTxt
    expect(ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c(m, scrollItm.pItem)).toBe(220)
    const pSpaceOut = m.alloc(4) >>> 0
    expect(ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c(m, scrollItm.pItem, p1.pPlayer, pSpaceOut)).toBe(0)

    const pBodyLoc = m.alloc(4) >>> 0
    const ppPrim = m.alloc(4) >>> 0
    const ppSec = m.alloc(4) >>> 0
    m.setU32(pBodyLoc, 4)
    expect(
      ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c(m, pBodyLoc, scrollItm.pItem, ppPrim, p1.pPlayer, ppSec),
    ).toBeGreaterThanOrEqual(0)
    const pHandFlags = m.alloc(0x10) >>> 0
    ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c(m, scrollItm.pItem, p1.pPlayer, pHandFlags)
    expect(
      ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c(
        m,
        0,
        (pItemsTxt + 3 * D2ItemsTxt_SIZE) >>> 0,
        scrollItm.pItem,
      ),
    ).toBe(0)

    SKILLS_SetSkillLevelOnUnit113c(m, p1.pPlayer, 0, 1, 0, 0, 0)
    SKILLS_SetSkillLevelOnUnit113c(m, p1.pPlayer, 220, 1, 0, 0, 0)
    const pSk0 = SKILLS_GetSkillById113c(m, p1.pPlayer, 0, -1)
    expect(ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c(m, pSk0, p1.pPlayer)).toBeGreaterThanOrEqual(0)
    ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c(m, p1.pPlayer, pSk0, 1)
    expect(ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c(m, pGame, p1.pPlayer, scrollItm.pItem)).toBe(0)
    ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c(m, p1.pPlayer)

    // 0x6FCF2540, 0x6FCF2840, 0x6FCF2BE0, 0x6FCF2C70, 0x6FCF2CF0, 0x6FCF31D0, 0x6FCF4E80, 0x6FCF5590, 0x6FCF5740, 0x6FCF5A00, 0x6FCF6590, 0x6FCF6BC0
    ITEMS_CompactBeltColumnDown_6FCF2540_113c(m, 0, p1.pPlayer)
    ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c(m, scrollItm.pItem, p1.pPlayer, 0)
    ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c(m, scrollItm.pItem, p1.pPlayer)
    ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c(m, scrollItm.pItem, p1.pPlayer, 2)

    const curItm = allocBasicItem(m, pGame, 3, 402, 4, 0, 0)
    SUNIT_InsertServerUnit113c(m, pGame, curItm.pItem)
    INVENTORY_SetCursorItem113c(m, p1.pInventory, curItm.pItem)
    expect(ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, p1.pPlayer, curItm.pItem, pGame)).toBe(1)

    const bItm = allocBasicItem(m, pGame, 3, 403, 2, 0, 0)
    SUNIT_InsertServerUnit113c(m, pGame, bItm.pItem)
    attachItemToInventory(m, p1.pInventory, bItm.pItem, bItm.pItemData)
    ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c(m, pGame, bItm.pItem, p1.pPlayer)

    const pOutRej = m.alloc(4) >>> 0
    expect(ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c(m, 9999, pGame, p1.pPlayer, 0, 0, pOutRej)).toBe(0)
    expect(ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c(m, p1.pPlayer, pGame, 9998, 9997, pOutRej)).toBe(0)
    const gridItm = allocBasicItem(m, pGame, 3, 404, 0, 0, 0)
    m.setU8(pItemsTxt + 3 * D2ItemsTxt_SIZE + 0x11c, 1) // invWidth = 1
    m.setU8(pItemsTxt + 3 * D2ItemsTxt_SIZE + 0x11d, 1) // invHeight = 1
    ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c(m, gridItm.pItem, p1.pPlayer, pGame, 0, 0, 0, 0)
    ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c(m, p1.pPlayer, gridItm.pItem, pGame)
    ITEMS_SetBodyLocation113c(m, gridItm.pItem, 4)
    ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c(m, gridItm.pItem, p1.pPlayer, pGame)
    ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c(m, p1.pPlayer, pGame)
    ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c(m, p1.pPlayer, 220)

    // REGRESSION FIX #15 (0x6FCF6C80): gold pickup uses pPlayer + 0x80 for party lookup and adds gold cleanly
    const goldItm = allocBasicItem(m, pGame, 4, 410, 3, 110, 110)
    SUNIT_InsertServerUnit113c(m, pGame, goldItm.pItem)
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 12, 10, 0) // level 10 -> 100k bank limit
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 0x0e, 100, 0)
    STATLIST_SetUnitStat113c(m, goldItm.pItem, 0x0e, 250, 0)
    ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c(m, p1.pPlayer, pGame, goldItm.pItem)
    expect(STATLIST_GetUnitStat113c(m, p1.pPlayer, 0x0e, 0)).toBe(350)

    // 0x6FCFAB00, 0x6FCFAED0, 0x6FCFBD90
    SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c(m, p1.pPlayer, 59)
    const pExpCtx = m.alloc(0x50) >>> 0
    m.setU32(pExpCtx + 0x00, p1.pPlayer)
    SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c(m, pGame, p1.pPlayer, pExpCtx)
    expect(m.u32(pExpCtx + 0x44)).toBe(1)
    expect(m.u32(pExpCtx + 0x48)).toBe(10)
    m.setU32(mon.pMonster + 0x10, 2)
    SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c(m, mon.pMonster, 11, 0)
    expect(m.u32(mon.pMonster + 0x10)).toBe(1)

    // REGRESSION FIX #14 (0x6FCFCE00): bUseWeapon=0 uses skill phys (min256=2560, max256=2560),
    // NOT attacker weapon damage (stat 21=500, stat 22=600) or STR (200)!
    const physSkillId = 15
    const pSk15 = (pSkillsTxt + physSkillId * D2SkillsTxt_SIZE) >>> 0
    m.setU8(pSk15 + 0x1a4, 8) // nHitShift = 8 (256-fixed-point)
    m.setU32(pSk15 + 0x1a8, 10) // dwMinDam = 10 -> 2560
    m.setU32(pSk15 + 0x1ac, 10) // dwMaxDam = 10 -> 2560 (clamped to min+256=2816)
    m.setU32(pSk15 + 0x1d8, 0xffffffff) // no extra dmg% calc
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 0, 200, 0) // STR = 200 (must be ignored when bUseWeapon=0!)
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 21, 500, 0) // weapon min = 500 (must be ignored!)
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 22, 600, 0) // weapon max = 600 (must be ignored!)
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 111, 0, 0) // normal damage = 0
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 25, 0, 0) // ed% = 0
    const pSkillDmg = m.alloc(0x70) >>> 0
    SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c(m, p1.pPlayer, physSkillId, 1, pSkillDmg)
    const rolledPhys = m.u32(pSkillDmg + 0x08) >>> 0
    expect(rolledPhys).toBeGreaterThanOrEqual(2560)
    expect(rolledPhys).toBeLessThanOrEqual(2816)
    // Also verify stat 111 (+2 -> +512) and stat 25 (+50% ED) scale the skill phys damage properly
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 111, 2, 0)
    STATLIST_SetUnitStat113c(m, p1.pPlayer, 25, 50, 0)
    const pSkillDmgBoosted = m.alloc(0x70) >>> 0
    SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c(m, p1.pPlayer, physSkillId, 1, pSkillDmgBoosted)
    const boostedPhys = m.u32(pSkillDmgBoosted + 0x08) >>> 0
    // (2560 + 512) * 1.5 = 4608 .. (2816 + 512) * 1.5 = 4992
    expect(boostedPhys).toBeGreaterThanOrEqual(4608)
    expect(boostedPhys).toBeLessThanOrEqual(4992)

    // 0x6FCFFDC0, 0x6FD00D00, 0x6FD01570: Portal & unit placement
    const portalA = m.alloc(0x100) >>> 0
    const portalB = m.alloc(0x100) >>> 0
    const pPathA = m.alloc(0x28) >>> 0
    const pPathB = m.alloc(0x28) >>> 0
    const pDataA = m.alloc(0x40) >>> 0
    const pDataB = m.alloc(0x40) >>> 0
    const rmA = allocRoom(m, 1, 100, 100)
    const rmB = allocRoom(m, 2, 200, 200)
    m.setU32(portalA, 2)
    m.setU32(portalA + 0x14, pDataA)
    m.setU32(portalA + 0x2c, pPathA)
    m.setU32(pPathA + 0x00, rmA.pRoom)
    m.setU32(pPathA + 0x0c, 105)
    m.setU32(pPathA + 0x10, 106)
    m.setU32(portalB, 2)
    m.setU32(portalB + 0x14, pDataB)
    m.setU32(portalB + 0x2c, pPathB)
    m.setU32(pPathB + 0x00, rmB.pRoom)
    m.setU32(pPathB + 0x0c, 205)
    m.setU32(pPathB + 0x10, 206)
    SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c(m, portalA, portalB)
    expect(m.u32(pDataA + 0x20)).toBe(205)
    expect(m.u32(pDataA + 0x24)).toBe(206)
    expect(m.u32(pDataB + 0x20)).toBe(105)
    expect(m.u32(pDataB + 0x24)).toBe(106)

    SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c(m, 115, p1.pRoom, mon.pMonster, pGame, 115)
    m.setU32((pDataA + 0x18) >>> 0, 205)
    m.setU32((pDataA + 0x1c) >>> 0, 206)
    m.set(m.u32((pGame + 0xbc) >>> 0), D2ActStrc.pRoom1, rmB.pRoom)
    expect(SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c(m, pGame, portalA)).toBe(0)

    // 0x6FD02310, 0x6FD02480, 0x6FD02600, 0x6FD02780
    SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c(m, p1.pPlayer, pGame, 0)
    SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c(m, p1.pPlayer, pGame, 1)
    SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c(m, p1.pPlayer, pGame, 50)
    const pOutAnya = m.alloc(8) >>> 0
    expect(ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c(m, pGame, p1.pPlayer, pOutAnya)).toBe(0)

    const hits = endVaTrace113c()
    expect(hits.has('D2Game:0x6FCFC530')).toBe(true) // 0x6FCFCE00 -> SUNITDMG_ComputeWeaponBaseDamage
    expect(hits.has('D2Game:0x6FCFBED0')).toBe(true) // 0x6FCFC530 -> SUNITDMG_RollDamageValue
    for (const v of hits) cumulativeHits.add(v)
    const missing = WAVE9_PROMOTED_SPECS.filter((s) => s.batch === 'k2w5-b7')
      .map((s) => `D2Game:${s.va}`)
      .filter((k) => !hits.has(k))
    expect(missing).toEqual([])
  })

  it('confirms 100% (147/147) cumulative va-trace hit coverage across all 4 Wave 9 shards', () => {
    const missingVas = WAVE9_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
