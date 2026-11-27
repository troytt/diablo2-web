/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 1: +128 VAs).
 *
 * Audits and verifies 128 `D2Game.dll` (`0x6FC20000`) closure functions across:
 * - `k2w2-b1` (`src/d2kern-113c/game/k2-w2b1-113c.ts`, 43 functions)
 * - `k2w2-b2` (`src/d2kern-113c/game/k2-w2b2-113c.ts`, 43 functions)
 * - `k2w2-b5` (`src/d2kern-113c/game/k2-w2b5-113c.ts`, 42 functions)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`.
 * 2. Multi-branch `SparseMemory113c` boundary, signed/unsigned arithmetic, assert, and struct mutation parity.
 * 3. 100% (`128 / 128`) live `beginVaTrace113c()` / `endVaTrace113c()` execution coverage.
 */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  INVENTORY_SIGNATURE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts'
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  QUESTS_GuidListAdd113c,
  QUESTS_GuidListContains113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'
import {
  ACT1_IntroStatusFilter_6FC80800_113c,
  ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c,
  ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c,
  ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c,
  ACT1Q4_MarkFlag52_6FC80590_113c,
  ACT1Q4_MarkFlag63_6FC805C0_113c,
  ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c,
  ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c,
  ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c,
  ACT4_EndgameStatusFilter_6FC80810_113c,
  ACT4_IntroCallback08Noop_6FC80180_113c,
  ACT4_IntroStatusFilter_6FC80170_113c,
  ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c,
  ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c,
  ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c,
  ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c,
  ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c,
  ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c,
  ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c,
  ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c,
  ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c,
  ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c,
  ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c,
  ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c,
  ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c,
  ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c,
  ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c,
  ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c,
  ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c,
  ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c,
  ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c,
  ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c,
  ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c,
  ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c,
  ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c,
  AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c,
  ITEMS_IsUniqueItemDisabled_6FC217E0_113c,
  MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c,
  PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
  STORM_TSHashTableAllocUniqueKey_6FC22060_113c,
  STORM_TSListPlacementNewCopy_6FC226F0_113c,
  STORM_TSListPlacementNewDefault_6FC225A0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b1-113c.ts'
import {
  ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c,
  ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c,
  ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c,
  ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c,
  ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c,
  ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c,
  ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c,
  ACT1Q4_InitCainGibbetObject_6FC814A0_113c,
  ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c,
  ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c,
  ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c,
  ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c,
  ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c,
  ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c,
  ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c,
  ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c,
  ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c,
  ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c,
  ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c,
  ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c,
  ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c,
  ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c,
  ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c,
  OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c,
  OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c,
  OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c,
  OBJECTS_GrantUnitDexterity_6FC896F0_113c,
  OBJECTS_GrantUnitEnergy_6FC89710_113c,
  OBJECTS_GrantUnitSkillPoints_6FC89650_113c,
  OBJECTS_GrantUnitStrength_6FC896B0_113c,
  OBJECTS_GrantUnitVitality_6FC896D0_113c,
  OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c,
  OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c,
  OBJECTS_OperateToggleObjectMode012_6FC89A80_113c,
  QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c,
  QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c,
  QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c,
  QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c,
  SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c,
  SHRINES_ApplyHealthExchangeEffect_6FC89800_113c,
  SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c,
  SHRINES_ApplyManaExchangeEffect_6FC897A0_113c,
  SHRINES_ApplyManaRechargeEffect_6FC89860_113c,
} from '../../../src/d2kern-113c/game/k2-w2b2-113c.ts'
import {
  ARENA_AllocGameArenaCtrl_6FCD2560_113c,
  ARENA_AllocPlayerArenaUnit_6FCD24D0_113c,
  ARENA_CheckFlagBit8_6FCD2620_113c,
  ARENA_FreePlayerArenaUnit_6FCD2480_113c,
  ARENA_GetModeByte_6FCD22D0_113c,
  MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c,
  MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c,
  MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c,
  MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c,
  MONAI_ClearAiControlParam0_6FCC3980_113c,
  MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c,
  MONAI_EnableState172OnTarget_6FCCC910_113c,
  MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c,
  MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c,
  MONAI_InitAiControlDefaultParams_6FCC3990_113c,
  MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c,
  MONAI_InventoryContainsItemPointer_6FCCC9E0_113c,
  MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c,
  MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c,
  MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c,
  MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c,
  MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c,
  MONAI_NoOpRet4_6FCC3880_113c,
  MONAI_NoOpRet4_6FCC3920_113c,
  MONAI_NoOpRet4_6FCC3930_113c,
  MONAI_NoOpRet4_6FCC39D0_113c,
  MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c,
  MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c,
  MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c,
  MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c,
  MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c,
  SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c,
  SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c,
  SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c,
  SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c,
  SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c,
  SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c,
  SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c,
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c,
  SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c,
  SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c,
  SKILLS_TargetRingScanCallback_6FCBED70_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2GameStrc,
  D2InventoryStrc,
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MissileDataStrc,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2StatListExStrc_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'
import type { Manifest } from '../../../tools/oracle/callgraph/status.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools', 'oracle', 'callgraph', 'manifest-113c.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')

interface DisasmVaSpec {
  readonly batch: 'k2w2-b1' | 'k2w2-b2' | 'k2w2-b5'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE1_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  { batch: 'k2w2-b1', va: '0x6FC217E0', size: 67, headHex: '85f6743c833e0475', tailHex: '33c0c3', tsSymbol: 'ITEMS_IsUniqueItemDisabled_6FC217E0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC22060', size: 44, headHex: '568b474840894748', tailHex: '485ec3', tsSymbol: 'STORM_TSHashTableAllocUniqueKey_6FC22060_113c' },
  { batch: 'k2w2-b1', va: '0x6FC225A0', size: 67, headHex: '64a1000000006aff', tailHex: 'c20400', tsSymbol: 'STORM_TSListPlacementNewDefault_6FC225A0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC226F0', size: 68, headHex: '64a1000000006aff', tailHex: 'c20400', tsSymbol: 'STORM_TSListPlacementNewCopy_6FC226F0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC41210', size: 76, headHex: '85db578bf874418b', tailHex: 'c21400', tsSymbol: 'AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c' },
  { batch: 'k2w2-b1', va: '0x6FC559C0', size: 91, headHex: '518b81f410000056', tailHex: 'c20400', tsSymbol: 'QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC57AC0', size: 70, headHex: '83ec08578bf985ff', tailHex: 'c408c3', tsSymbol: 'PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC59600', size: 100, headHex: '568bf285f674598b', tailHex: 'c20800', tsSymbol: 'MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c' },
  { batch: 'k2w2-b1', va: '0x6FC77D80', size: 68, headHex: '538bc28bd9686963', tailHex: 'c20400', tsSymbol: 'ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c' },
  { batch: 'k2w2-b1', va: '0x6FC78040', size: 84, headHex: '53568bf28b460c85', tailHex: '5e5bc3', tsSymbol: 'ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c' },
  { batch: 'k2w2-b1', va: '0x6FC787A0', size: 29, headHex: '8b420c85c0750b83', tailHex: 'b0fdff', tsSymbol: 'ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC78BA0', size: 61, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC78DA0', size: 91, headHex: '568bf18b4608578b', tailHex: 'c05ec3', tsSymbol: 'ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC78E50', size: 72, headHex: '8bc18b088b91f410', tailHex: 'e6ffff', tsSymbol: 'ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c' },
  { batch: 'k2w2-b1', va: '0x6FC78EA0', size: 72, headHex: '8bc18b088b91f410', tailHex: 'e6ffff', tsSymbol: 'ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC78EF0', size: 72, headHex: '8bc18b088b91f410', tailHex: 'e5ffff', tsSymbol: 'ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC78F40', size: 76, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c' },
  { batch: 'k2w2-b1', va: '0x6FC78FF0', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79060', size: 91, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79120', size: 91, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79180', size: 80, headHex: '83ec085633f685c9', tailHex: 'c408c3', tsSymbol: 'ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79230', size: 92, headHex: '8b80f410000085c0', tailHex: 'c20400', tsSymbol: 'ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79290', size: 83, headHex: '8b80f410000085c0', tailHex: 'c20400', tsSymbol: 'ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c' },
  { batch: 'k2w2-b1', va: '0x6FC792F0', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79390', size: 91, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79550', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c' },
  { batch: 'k2w2-b1', va: '0x6FC795C0', size: 91, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79A60', size: 68, headHex: '568b710885f6751f', tailHex: 'c05ec3', tsSymbol: 'ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79AB0', size: 68, headHex: '568b710885f6751f', tailHex: 'c05ec3', tsSymbol: 'ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC79B00', size: 68, headHex: '568b710885f6751f', tailHex: 'c05ec3', tsSymbol: 'ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c' },
  { batch: 'k2w2-b1', va: '0x6FC7E7F0', size: 77, headHex: '8b81f410000085c0', tailHex: 'c20400', tsSymbol: 'ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC80170', size: 5, headHex: '32c0c20c00', tailHex: 'c20c00', tsSymbol: 'ACT4_IntroStatusFilter_6FC80170_113c' },
  { batch: 'k2w2-b1', va: '0x6FC80180', size: 1, headHex: 'c3', tailHex: 'c3', tsSymbol: 'ACT4_IntroCallback08Noop_6FC80180_113c' },
  { batch: 'k2w2-b1', va: '0x6FC80390', size: 51, headHex: '8b80f410000085c0', tailHex: '95c0c3', tsSymbol: 'ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c' },
  { batch: 'k2w2-b1', va: '0x6FC803D0', size: 43, headHex: '8b80f410000085c0', tailHex: '0001c3', tsSymbol: 'ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC80400', size: 72, headHex: '8b81f410000085c0', tailHex: '675ec3', tsSymbol: 'ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c' },
  { batch: 'k2w2-b1', va: '0x6FC80450', size: 97, headHex: '8b81f410000085c0', tailHex: 'c20400', tsSymbol: 'ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c' },
  { batch: 'k2w2-b1', va: '0x6FC804C0', size: 87, headHex: '8b80f410000085c0', tailHex: '0000c3', tsSymbol: 'ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC80590', size: 40, headHex: '8b80f410000085c0', tailHex: '5201c3', tsSymbol: 'ACT1Q4_MarkFlag52_6FC80590_113c' },
  { batch: 'k2w2-b1', va: '0x6FC805C0', size: 40, headHex: '8b80f410000085c0', tailHex: '6301c3', tsSymbol: 'ACT1Q4_MarkFlag63_6FC805C0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC805F0', size: 86, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c' },
  { batch: 'k2w2-b1', va: '0x6FC80800', size: 5, headHex: '32c0c20c00', tailHex: 'c20c00', tsSymbol: 'ACT1_IntroStatusFilter_6FC80800_113c' },
  { batch: 'k2w2-b1', va: '0x6FC80810', size: 12, headHex: '8b44240cc6000032', tailHex: 'c20c00', tsSymbol: 'ACT4_EndgameStatusFilter_6FC80810_113c' },
  { batch: 'k2w2-b2', va: '0x6FC80A30', size: 66, headHex: '53568bda8bf1e885', tailHex: '2dfdff', tsSymbol: 'ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c' },
  { batch: 'k2w2-b2', va: '0x6FC80DA0', size: 83, headHex: '8b018b80f4100000', tailHex: 'faffc3', tsSymbol: 'ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC80EC0', size: 90, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81420', size: 68, headHex: '8b80f410000085c0', tailHex: '23fdff', tsSymbol: 'ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c' },
  { batch: 'k2w2-b2', va: '0x6FC814A0', size: 96, headHex: '8b018b80f4100000', tailHex: 'faffc3', tsSymbol: 'ACT1Q4_InitCainGibbetObject_6FC814A0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81500', size: 58, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c' },
  { batch: 'k2w2-b2', va: '0x6FC816F0', size: 95, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81860', size: 25, headHex: '85c98b4018c64049', tailHex: '4828c3', tsSymbol: 'ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81880', size: 79, headHex: '53568bda8bf1e835', tailHex: '1ffdff', tsSymbol: 'ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c' },
  { batch: 'k2w2-b2', va: '0x6FC818D0', size: 60, headHex: '53558b6918568bf2', tailHex: '5d5bc3', tsSymbol: 'ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81B20', size: 68, headHex: '538bc28bd9686864', tailHex: 'c20400', tsSymbol: 'ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81BE0', size: 32, headHex: '8b420c85c08b4918', tailHex: '1cfdff', tsSymbol: 'ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81C00', size: 87, headHex: '8b420c538b1a5668', tailHex: '5e5bc3', tsSymbol: 'ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81D40', size: 90, headHex: '56578bfa578bf1e8', tailHex: 'c20400', tsSymbol: 'ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c' },
  { batch: 'k2w2-b2', va: '0x6FC81F30', size: 29, headHex: '8b420c85c0750b83', tailHex: '18fdff', tsSymbol: 'QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c' },
  { batch: 'k2w2-b2', va: '0x6FC82170', size: 57, headHex: '56578bfa8b470c85', tailHex: '16fdff', tsSymbol: 'QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c' },
  { batch: 'k2w2-b2', va: '0x6FC82340', size: 43, headHex: '5650e87981faff8b', tailHex: 'c20400', tsSymbol: 'ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c' },
  { batch: 'k2w2-b2', va: '0x6FC825F0', size: 76, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC826C0', size: 63, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC82760', size: 61, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c' },
  { batch: 'k2w2-b2', va: '0x6FC82960', size: 76, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c' },
  { batch: 'k2w2-b2', va: '0x6FC82A30', size: 80, headHex: '83ec085633f685c9', tailHex: 'c408c3', tsSymbol: 'ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c' },
  { batch: 'k2w2-b2', va: '0x6FC82BB0', size: 76, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC82C60', size: 101, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c' },
  { batch: 'k2w2-b2', va: '0x6FC82CD0', size: 86, headHex: '5356578bf2568bd9', tailHex: 'c20400', tsSymbol: 'ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC88F90', size: 44, headHex: '568bf18b46046a01', tailHex: '005ec3', tsSymbol: 'OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89490', size: 85, headHex: '50e82a10faff8b4c', tailHex: 'c20400', tsSymbol: 'QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c' },
  { batch: 'k2w2-b2', va: '0x6FC895F0', size: 83, headHex: '50e8ca0efaff8b4c', tailHex: 'c20400', tsSymbol: 'QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89650', size: 23, headHex: '8b4424046a00506a', tailHex: 'c20400', tsSymbol: 'OBJECTS_GrantUnitSkillPoints_6FC89650_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89670', size: 53, headHex: '56578bfa57e8260d', tailHex: 'c20400', tsSymbol: 'OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c' },
  { batch: 'k2w2-b2', va: '0x6FC896B0', size: 23, headHex: '8b4424046a00506a', tailHex: 'c20400', tsSymbol: 'OBJECTS_GrantUnitStrength_6FC896B0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC896D0', size: 23, headHex: '8b4424046a00506a', tailHex: 'c20400', tsSymbol: 'OBJECTS_GrantUnitVitality_6FC896D0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC896F0', size: 23, headHex: '8b4424046a00506a', tailHex: 'c20400', tsSymbol: 'OBJECTS_GrantUnitDexterity_6FC896F0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89710', size: 23, headHex: '8b4424046a00506a', tailHex: 'c20400', tsSymbol: 'OBJECTS_GrantUnitEnergy_6FC89710_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89730', size: 53, headHex: '56578bfa57e8b00d', tailHex: 'c20400', tsSymbol: 'OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89770', size: 39, headHex: '8b41085650e8460d', tailHex: '0c5ec3', tsSymbol: 'SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c' },
  { batch: 'k2w2-b2', va: '0x6FC897A0', size: 90, headHex: '5356576a008bf98b', tailHex: '5e5bc3', tsSymbol: 'SHRINES_ApplyManaExchangeEffect_6FC897A0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89800', size: 96, headHex: '5356576a008bf98b', tailHex: '5e5bc3', tsSymbol: 'SHRINES_ApplyHealthExchangeEffect_6FC89800_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89860', size: 49, headHex: '56576a008bf18b46', tailHex: '5f5ec3', tsSymbol: 'SHRINES_ApplyManaRechargeEffect_6FC89860_113c' },
  { batch: 'k2w2-b2', va: '0x6FC898A0', size: 49, headHex: '56576a008bf18b46', tailHex: '5f5ec3', tsSymbol: 'SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC898E0', size: 91, headHex: '8b406085c0751f68', tailHex: '005ec3', tsSymbol: 'OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89940', size: 37, headHex: '81f9ea0000007517', tailHex: '0000c3', tsSymbol: 'OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c' },
  { batch: 'k2w2-b2', va: '0x6FC89A80', size: 68, headHex: '568bf18b460485c0', tailHex: '005ec3', tsSymbol: 'OBJECTS_OperateToggleObjectMode012_6FC89A80_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBE4F0', size: 77, headHex: '85ff744885f67444', tailHex: 'ff5dc3', tsSymbol: 'SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBE600', size: 11, headHex: '8b410cff00b80100', tailHex: '0000c3', tsSymbol: 'SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBE7B0', size: 83, headHex: '85ff750a83c9ffb8', tailHex: 'c20400', tsSymbol: 'SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBE970', size: 55, headHex: '508b822801000051', tailHex: 'c20800', tsSymbol: 'SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBE9B0', size: 86, headHex: '85c07c518b0d9c82', tailHex: '345fc3', tsSymbol: 'SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBEB30', size: 71, headHex: '85d27440833a0075', tailHex: '33c0c3', tsSymbol: 'SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBED20', size: 77, headHex: '568bf185f6578bf8', tailHex: '005ec3', tsSymbol: 'SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBED70', size: 63, headHex: '85d28b410c750583', tailHex: '0000c3', tsSymbol: 'SKILLS_TargetRingScanCallback_6FCBED70_113c' },
  { batch: 'k2w2-b5', va: '0x6FCBF1A0', size: 100, headHex: '558b6c240c568bf0', tailHex: 'c20800', tsSymbol: 'SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC11B0', size: 85, headHex: '668b832e010000a8', tailHex: 'c21000', tsSymbol: 'SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC20C0', size: 54, headHex: '85f67407838ec400', tailHex: '0000c3', tsSymbol: 'SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3880', size: 3, headHex: 'c20400', tailHex: 'c20400', tsSymbol: 'MONAI_NoOpRet4_6FCC3880_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC38C0', size: 88, headHex: '85c9568bf2750768', tailHex: '5f5ec3', tsSymbol: 'MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3920', size: 3, headHex: 'c20400', tailHex: 'c20400', tsSymbol: 'MONAI_NoOpRet4_6FCC3920_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3930', size: 3, headHex: 'c20400', tailHex: 'c20400', tsSymbol: 'MONAI_NoOpRet4_6FCC3930_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3980', size: 16, headHex: '8b4424048b08c741', tailHex: 'c20400', tsSymbol: 'MONAI_ClearAiControlParam0_6FCC3980_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3990', size: 30, headHex: '8b4424048b00c740', tailHex: 'c20400', tsSymbol: 'MONAI_InitAiControlDefaultParams_6FCC3990_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC39B0', size: 25, headHex: '8b4424048b008b89', tailHex: 'c20400', tsSymbol: 'MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC39D0', size: 3, headHex: 'c20400', tailHex: 'c20400', tsSymbol: 'MONAI_NoOpRet4_6FCC39D0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC39E0', size: 61, headHex: '568b74240885f674', tailHex: 'c20800', tsSymbol: 'MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3AE0', size: 68, headHex: '85c056be01000000', tailHex: 'c20400', tsSymbol: 'MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3C30', size: 71, headHex: '8b44240453568bf2', tailHex: 'c20400', tsSymbol: 'MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3D00', size: 83, headHex: '85f657bf01000000', tailHex: 'c20400', tsSymbol: 'MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC3E10', size: 100, headHex: '568bf185f6578bfa', tailHex: 'd85ec3', tsSymbol: 'MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC4180', size: 46, headHex: '53568b74240c8bda', tailHex: 'c20800', tsSymbol: 'MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC5AC0', size: 100, headHex: '568bf28bc6e8d6ac', tailHex: 'c20400', tsSymbol: 'MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCC5D40', size: 33, headHex: '56578bf2568bf9e8', tailHex: 'c20400', tsSymbol: 'MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c' },
  { batch: 'k2w2-b5', va: '0x6FCCC910', size: 42, headHex: '8b44240485c0741d', tailHex: 'c21400', tsSymbol: 'MONAI_EnableState172OnTarget_6FCCC910_113c' },
  { batch: 'k2w2-b5', va: '0x6FCCC9E0', size: 54, headHex: '8b406085c07501c3', tailHex: '005ec3', tsSymbol: 'MONAI_InventoryContainsItemPointer_6FCCC9E0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCCCA20', size: 79, headHex: '5356578b7c241057', tailHex: 'c21400', tsSymbol: 'MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD0840', size: 94, headHex: '85c074578b0883f9', tailHex: '33c0c3', tsSymbol: 'MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD0BA0', size: 56, headHex: '85c974338b0183f8', tailHex: '0000c3', tsSymbol: 'MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD0DB0', size: 62, headHex: '568b74240885f674', tailHex: 'c20800', tsSymbol: 'MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD0DF0', size: 62, headHex: '53568b74240c85f6', tailHex: 'c20800', tsSymbol: 'MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD0E30', size: 47, headHex: '538b5c240885db74', tailHex: 'c20800', tsSymbol: 'MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD12B0', size: 99, headHex: '5355568b74241057', tailHex: 'c20800', tsSymbol: 'MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD13B0', size: 70, headHex: '5185d2743b8b0285', tailHex: 'c20800', tsSymbol: 'MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD22D0', size: 46, headHex: '8b80281d000085c0', tailHex: '400cc3', tsSymbol: 'ARENA_GetModeByte_6FCD22D0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD2480', size: 80, headHex: '5650e83980f5ff8b', tailHex: 'c20400', tsSymbol: 'ARENA_FreePlayerArenaUnit_6FCD2480_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD24D0', size: 83, headHex: '8b481c566a006a47', tailHex: 'c20400', tsSymbol: 'ARENA_AllocPlayerArenaUnit_6FCD24D0_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD2560', size: 66, headHex: '8b4f1c566a006a32', tailHex: 'c20400', tsSymbol: 'ARENA_AllocGameArenaCtrl_6FCD2560_113c' },
  { batch: 'k2w2-b5', va: '0x6FCD2620', size: 48, headHex: '8b80281d000085c0', tailHex: 'e001c3', tsSymbol: 'ARENA_CheckFlagBit8_6FCD2620_113c' },
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

function createFullTestWorld() {
  const m = new SparseMemory113c()
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  const pUniqueItemsTxt = m.alloc(16 * 0x14c) >>> 0
  m.setU32((pDataTables + 0xc24) >>> 0, pUniqueItemsTxt)
  m.setU32((pDataTables + 0xc28) >>> 0, 16)

  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)

  const pMissilesTxt = m.alloc(32 * 0x1a4) >>> 0
  m.setU32((pDataTables + 0xb64) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + 0xb6c) >>> 0, 32)

  const pItemsTxt = m.alloc(16 * D2ItemsTxt_SIZE) >>> 0
  m.setU32(0x6fdefb94, 16)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32((pDataTables + 0xbf8) >>> 0, m.alloc(16 * D2ItemTypesTxt_SIZE))
  m.setU32((pDataTables + 0xbfc) >>> 0, 16)
  m.setU32((pDataTables + 0xc00) >>> 0, 1)
  const pItemTypeEquiv = m.alloc(64) >>> 0
  m.setU32((pDataTables + 0xc04) >>> 0, pItemTypeEquiv)

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0x1dc) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0x1e0) >>> 0, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
  }

  const monStatsCount = 300
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  const pMonStats2Txt = m.alloc(monStatsCount * 0x134) >>> 0
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    m.setU16((pMonStatsTxt + i * 0x1a8 + 0x02) >>> 0, i)
    m.setU8((pMonStats2Txt + i * 0x134 + 0x08) >>> 0, 1)
  }

  const itemStatCostCount = 360
  const pItemStatCost = m.alloc(itemStatCostCount * 0x144) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pItemStatCost)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, itemStatCostCount)

  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x40) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pStatesTxt) >>> 0, pStatesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0, statesCount)
  m.setU32((pDataTables + 0x150) >>> 0, m.alloc(32) >>> 0)

  const pObjectsTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  const pAnimDataTable = m.alloc(0x420) >>> 0
  const pEmptyBucket = m.alloc(16) >>> 0
  for (let i = 0; i < 256; i++) {
    m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyBucket)
  }
  m.setU32((pAnimDataTable + 0x40c) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x410) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)

  return {
    m,
    pDataTables,
    pUniqueItemsTxt,
    pSkillsTxt,
    pMissilesTxt,
    pItemsTxt,
    pItemTypeEquiv,
    pLevelsTxt,
    pMonStatsTxt,
    pObjectsTxt,
  }
}

function allocPlayerUnit(m: SparseMemory113c, guid: number, nLevelId = 1, nDiff = 0) {
  const pPlayer = m.alloc(0x100) >>> 0
  const pPlayerData = m.alloc(0x100) >>> 0
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
  const pClient = m.alloc(0x240) >>> 0
  const pDynPath = m.alloc(0x40) >>> 0
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE) >>> 0
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE) >>> 0
  const pActFlag = m.alloc(8) >>> 0

  m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
  m.set(pPlayer, D2UnitStrc.dwUnitId, guid)
  m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
  m.set(pPlayer, D2UnitStrc.pPath, pDynPath)
  m.setU32((pDynPath + 0x1c) >>> 0, pRoom)
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, pActFlag)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, nLevelId)

  m.setU32((pPlayerData + 0x10 + nDiff * 4) >>> 0, pQuestFlags)
  m.setU32((pPlayerData + 0x9c) >>> 0, pClient)
  STATLIST_CreateEx113c(m, pPlayer)

  return { pPlayer, pPlayerData, pQuestFlags, pClient, pRoom, pLevel }
}

function linkQuest(m: SparseMemory113c, pGame: number, nQuestId: number) {
  let pChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pChain === 0) {
    pChain = m.alloc(0x40) >>> 0
    m.setU32((pGame + 0x10f4) >>> 0, pChain)
  }
  const pQuest = m.alloc(0x120) >>> 0
  const pQuestDataEx = m.alloc(0x200) >>> 0
  m.setU32(pQuest, nQuestId >>> 0)
  m.setU32((pQuest + 0x04) >>> 0, pGame)
  m.setU8((pQuest + 0x09) >>> 0, 1)
  m.setU32((pQuest + 0x18) >>> 0, pQuestDataEx)
  m.setU32((pQuest + 0xe0) >>> 0, nQuestId >>> 0)
  m.setU32((pQuest + 0xf4) >>> 0, m.u32(pChain) >>> 0)
  m.setU32(pChain, pQuest)
  return { pQuest, pQuestDataEx }
}

describe('[K2] D2Game 1.13c Disassembly-Verified Promotion Wave 1 (+128 VAs -> >50% Closure)', () => {
  it('validates manifest diff-verified status and real PE32 D2Game.dll (0x6FC20000) opcodes across all 128 VAs', () => {
    expect(WAVE1_PROMOTED_SPECS.length).toBe(128)
    const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    expect(manifest.summary.statusBreakdown['diff-verified']).toBeGreaterThanOrEqual(2460)

    const d2GameFnByVa = new Map(
      manifest.functions
        .filter((f) => f.module === 'D2Game')
        .map((f) => [f.va.toUpperCase(), f]),
    )
    const d2GameDvCount = manifest.functions.filter(
      (f) => f.module === 'D2Game' && f.status === 'diff-verified',
    ).length
    expect(d2GameDvCount).toBeGreaterThan(980)

    for (const spec of WAVE1_PROMOTED_SPECS) {
      const fn = d2GameFnByVa.get(spec.va.toUpperCase())
      expect(fn, `Missing manifest entry for ${spec.va}`).toBeDefined()
      expect(fn!.status, `${spec.va} (${fn!.name}) must be diff-verified`).toBe('diff-verified')
      expect(fn!.tsSymbol).toBe(spec.tsSymbol)
      expect(fn!.size).toBe(spec.size)
      expect(Boolean(fn!.indirectUnknown)).toBe(false)
      expect(fn!.diffEvidence).toContain('tests/oracle/k2/k2-disasm-verified-wave1.test.ts')
    }

    const d2GameDllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    if (fs.existsSync(d2GameDllPath)) {
      const pe = loadPeSectionMapper(d2GameDllPath, 0x6fc20000)
      for (const spec of WAVE1_PROMOTED_SPECS) {
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

        // Every promoted D2Game routine ends in `ret` (0xC3), `ret imm16` (0xC2 lo hi), or tail `jmp rel32` (0xE9)
        const lastByte = fnBytes[spec.size - 1]!
        const retImmOp = spec.size >= 3 ? fnBytes[spec.size - 3]! : 0
        const tailJmpOp = spec.size >= 5 ? fnBytes[spec.size - 5]! : 0
        expect(
          lastByte === 0xc3 || retImmOp === 0xc2 || tailJmpOp === 0xe9,
          `${spec.va} unexpected epilogue ${actualTail}`,
        ).toBe(true)
      }
    }
  })

  it('executes all 128 promoted D2Game VAs across multi-branch SparseMemory113c vectors with 100% va-trace hit coverage', () => {
    const cumulativeHits = new Set<string>()

    // -------------------------------------------------------------------------
    // Part A: Wave 2 Batch 1 (`k2w2-b1`, 43 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pUniqueItemsTxt, pSkillsTxt, pMissilesTxt, pItemsTxt } = createFullTestWorld()
      const pGame = m.alloc(0x1e00) >>> 0
      m.set(pGame, D2GameStrc.dwGameFrame, 200)
      EVENT_InitTimerQueue113c(m, pGame)
      m.setU32((pGame + 0xf0) >>> 0, m.alloc(0x300) >>> 0)

      const q3 = linkQuest(m, pGame, 3)
      const q4 = linkQuest(m, pGame, 4)
      const q20 = linkQuest(m, pGame, 0x20)
      const q22 = linkQuest(m, pGame, 0x22)
      const q23 = linkQuest(m, pGame, 0x23)
      const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
      m.setU8((pQuestControl + 0x20) >>> 0, 0x07)

      beginVaTrace113c()

      // 0x6FC217E0: disabled bit (bit 2 = 0x04) on UniqueItemsTxt[+0x2C]
      expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, 0)).toBe(0)
      const pUniqueItem = m.alloc(0x100) >>> 0
      const pUniqueData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
      m.set(pUniqueItem, D2UnitStrc.dwUnitType, 4)
      m.set(pUniqueItem, D2UnitStrc.pUnitData, pUniqueData)
      m.set(pUniqueData, D2ItemDataStrc.dwQuality, 7)
      m.set(pUniqueData, D2ItemDataStrc.dwItemCell, 2)
      m.setU8((pUniqueItemsTxt + 2 * 0x14c + 0x2c) >>> 0, 0x00)
      expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pUniqueItem)).toBe(0)
      m.setU8((pUniqueItemsTxt + 2 * 0x14c + 0x2c) >>> 0, 0x04)
      expect(ITEMS_IsUniqueItemDisabled_6FC217E0_113c(m, pUniqueItem)).toBe(1)

      // 0x6FC22060, 0x6FC225A0, 0x6FC226F0: Storm TSHashTable wraparound + TSExplicitList placement-new
      const pHash = m.alloc(0x60) >>> 0
      const pBuckets = m.alloc(4 * 12) >>> 0
      m.setU32((pHash + 0x1c) >>> 0, pBuckets)
      m.setU32((pHash + 0x24) >>> 0, 3)
      expect(STORM_TSHashTableAllocUniqueKey_6FC22060_113c(m, pHash)).toBe(1)
      const pCollision = m.alloc(0x20) >>> 0
      m.setU32(pCollision, 1)
      m.setU32((pBuckets + 1 * 12) >>> 0, 4)
      m.setU32((pBuckets + 1 * 12 + 8) >>> 0, pCollision)
      m.setU32((pHash + 0x48) >>> 0, 0xffffffff)
      expect(STORM_TSHashTableAllocUniqueKey_6FC22060_113c(m, pHash)).toBe(2)
      expect(m.u32((pHash + 0x4c) >>> 0)).toBe(1)

      expect(STORM_TSListPlacementNewDefault_6FC225A0_113c(m, 0)).toBe(0)
      const pListDef = m.alloc(16) >>> 0
      expect(STORM_TSListPlacementNewDefault_6FC225A0_113c(m, pListDef)).toBe(pListDef)
      expect(m.u32(pListDef)).toBe(0xdddddddd)
      expect(STORM_TSListPlacementNewCopy_6FC226F0_113c(m, 0, pListDef)).toBe(0)
      const pListCopy = m.alloc(16) >>> 0
      m.setU32(pListDef, 0x24)
      expect(STORM_TSListPlacementNewCopy_6FC226F0_113c(m, pListCopy, pListDef)).toBe(pListCopy)
      expect(m.u32(pListCopy)).toBe(0x24)

      // 0x6FC41210: AIGENERAL_ReplaceMinionListAndInitBossGroup
      const pBossMon = m.alloc(0x100) >>> 0
      const pBossData = m.alloc(0x80) >>> 0
      const pBossAiGen = m.alloc(0x50) >>> 0
      m.setU32(pBossMon, 1)
      m.setU32((pBossMon + 0x14) >>> 0, pBossData)
      m.setU32((pBossData + 0x28) >>> 0, pBossAiGen)
      const pOldMinion = m.alloc(8) >>> 0
      m.setU32(pOldMinion, 55)
      m.setU32((pBossAiGen + 0x34) >>> 0, pOldMinion)
      const pNewMinion = m.alloc(8) >>> 0
      let freedMinion = 0
      AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(m, pGame, 0, 1, 1, 1, 1, 0)
      AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(
        m,
        pGame,
        pBossMon,
        901,
        1,
        1,
        1,
        pNewMinion,
        {
          onFreePoolMem: (_m, _pool, ptr) => {
            freedMinion = ptr >>> 0
          },
        },
      )
      expect(freedMinion).toBe(pOldMinion)
      expect(m.u32((pBossAiGen + 0x34) >>> 0)).toBe(pNewMinion)

      // 0x6FC559C0 (verifying real 0x6FCAA3E0 callee trace!) + 0x6FC57AC0 + 0x6FC59600
      const { pPlayer, pPlayerData, pQuestFlags, pClient } = allocPlayerUnit(m, 301, 109)
      expect(QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(m, pGame, pPlayer)).toBe(0)
      const pPktHead = m.u32((pClient + 0x1b8) >>> 0) >>> 0
      expect(pPktHead).not.toBe(0)
      expect(m.u32(pPktHead)).toBe(0x69)
      expect(m.u8((pPktHead + 4 + 0x67) >>> 0)).toBe(0x89)
      expect(m.u8((pPktHead + 4 + 0x68) >>> 0)).toBe(0x07)

      const { pPlayer: pEnemy } = allocPlayerUnit(m, 302, 109)
      m.setU32((pGame + 0x1120) >>> 0, pPlayer)
      m.setU32((pPlayer + 0xe4) >>> 0, pEnemy)
      const pHostileRec = m.alloc(0x18) >>> 0
      m.setU32(pHostileRec, 302)
      m.setU32((pHostileRec + 0x04) >>> 0, 0)
      m.setU32((pPlayerData + 0x38) >>> 0, pHostileRec)
      expect(PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(m, pGame, pPlayer)).toBe(0)
      m.setU32((pHostileRec + 0x04) >>> 0, 8)
      expect(PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(m, pGame, pPlayer)).toBe(1)

      const pMis = m.alloc(0x100) >>> 0
      const pMisData = m.alloc(0x40) >>> 0
      const pMisOut = m.alloc(0x80) >>> 0
      m.set(pMis, D2UnitStrc.dwUnitType, 3)
      m.set(pMis, D2UnitStrc.dwClassId, 3)
      m.set(pMis, D2UnitStrc.pUnitData, pMisData)
      m.set(pMisData, D2MissileDataStrc.nSkill, 6)
      m.set(pMisData, D2MissileDataStrc.nLevel, 5)
      m.setU32((pMissilesTxt + 3 * 0x1a4 + 0x78) >>> 0, 0)
      m.setU32((pSkillsTxt + 6 * 0x23c + 0x148) >>> 0, 12)
      m.setU32((pSkillsTxt + 6 * 0x23c + 0x14c) >>> 0, 3)
      MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c(m, pMis, pGame, pMisOut)
      expect(m.u32((pMisOut + 0x44) >>> 0)).toBe(24)
      expect(m.u32((pMisOut + 0x60) >>> 0)).toBe(0x60)

      // Act 5 callbacks & object handlers (`0x6FC77D80..0x6FC7E7F0`)
      const pInv = m.alloc(0x40) >>> 0
      m.set(pPlayer, D2UnitStrc.pInventory, pInv)
      m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
      const pIce = m.alloc(0x100) >>> 0
      const pIceData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
      m.set(pIce, D2UnitStrc.dwUnitType, 4)
      m.set(pIce, D2UnitStrc.dwClassId, 1)
      m.set(pIce, D2UnitStrc.pUnitData, pIceData)
      m.set(pItemsTxt + 1 * D2ItemsTxt_SIZE, D2ItemsTxt.dwCode, 0x20656369)
      m.setU8((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x12a) >>> 0, 1)
      m.setU32((pIce + 0x5c) >>> 0, m.alloc(D2StatListExStrc_SIZE) >>> 0)
      m.setU32((m.u32((pIce + 0x5c) >>> 0) + 0x10) >>> 0, 0x40)
      STATLIST_SetUnitStat113c(m, pIce, 0x164, 0, 0)
      m.set(pInv, D2InventoryStrc.pCursorItem, pIce)

      ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c(m, pGame, pPlayer)
      expect(m.u8((q3.pQuestDataEx + 0xe2) >>> 0)).toBe(1)

      QUESTS_GuidListAdd113c(m, (q3.pQuest + 0x1c) >>> 0, 301)
      QUESTS_GuidListAdd113c(m, q3.pQuestDataEx, 301)
      m.setU32((q3.pQuestDataEx + 0xd8) >>> 0, 2)
      const pQuestArg = m.alloc(0x20) >>> 0
      m.setU32(pQuestArg, pGame)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)
      expect(ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c(m, q3.pQuest, pQuestArg)).toBe(pIce)
      expect(m.u32((q3.pQuestDataEx + 0xd8) >>> 0)).toBe(1)

      QUESTS_GuidListAdd113c(m, (q3.pQuest + 0x1c) >>> 0, 301)
      expect(ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c(m, q3.pQuest, pQuestArg)).toBe(1)

      expect(ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c(m, pGame, pPlayer)).toBe(0)
      expect(ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c(m, pGame, pPlayer)).toBe(0)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0x0e)).toBe(1)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0x0e)).toBe(1)

      const pStatueObj = m.alloc(0x100) >>> 0
      m.set(pStatueObj, D2UnitStrc.dwUnitType, 2)
      m.set(pStatueObj, D2UnitStrc.dwClassId, 0x1da)
      m.set(pStatueObj, D2UnitStrc.dwUnitId, 777)
      m.set(pStatueObj, D2UnitStrc.pPath, m.alloc(0x20) >>> 0)
      const pOpParam = m.alloc(0x20) >>> 0
      m.setU32(pOpParam, pGame)
      m.setU32((pOpParam + 0x04) >>> 0, pStatueObj)
      m.setU32((pOpParam + 0x08) >>> 0, pPlayer)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x27, 0)
      expect(ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c(m, pOpParam)).toBe(0)

      const pObjInit = m.alloc(0x10) >>> 0
      m.setU32(pObjInit, pGame)
      m.setU32((pObjInit + 0x04) >>> 0, pStatueObj)
      ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c(m, pObjInit)
      ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c(m, pObjInit)
      ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c(m, pObjInit)
      expect(m.u32((q23.pQuestDataEx + 0x1c) >>> 0)).toBe(777)
      expect(m.u32((q23.pQuestDataEx + 0x18) >>> 0)).toBe(777)
      expect(m.u32((q23.pQuestDataEx + 0x14) >>> 0)).toBe(777)

      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0x0d)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 0x0d)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 0x0d)
      expect(ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c(m, pGame, pPlayer)).toBe(0)
      expect(m.u16((pPlayer + 0x6e) >>> 0)).toBe(0x52)
      expect(ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c(m, pGame, pPlayer)).toBe(0)
      expect(m.u16((pPlayer + 0x6e) >>> 0)).toBe(0x51)
      expect(ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c(m, pGame, pPlayer)).toBe(0)
      expect(m.u16((pPlayer + 0x6e) >>> 0)).toBe(0x50)

      m.setU32((pClient + 0x1b8) >>> 0, 0)
      m.setU32((pClient + 0x1bc) >>> 0, 0)
      ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c(m, pPlayer)
      const pNode5d = m.u32((pClient + 0x1b8) >>> 0) >>> 0
      expect(Array.from(m.readBytes((pNode5d + 4) >>> 0, 6))).toEqual([0x5d, 0x21, 0x20, 0, 0, 0])

      const pSoldier = m.alloc(0x100) >>> 0
      m.set(pSoldier, D2UnitStrc.dwUnitType, 1)
      m.set(pSoldier, D2UnitStrc.dwUnitId, 606)
      m.setU32((q20.pQuestDataEx + 0xb0 + 2 * 0x14) >>> 0, 606)
      expect(ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c(m, pGame, pSoldier)).toBe(0)
      for (let k = 0; k < 5; k++) {
        ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c(m, pGame, pSoldier)
      }
      expect(m.u8((q20.pQuestDataEx + 0x108 + 2) >>> 0)).toBe(1)
      expect(ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c(m, pGame, pSoldier)).toBe(1)

      expect(ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c(m, pOpParam)).toBe(0)
      expect(ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c(m, pOpParam)).toBe(0)
      expect(ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c(m, pOpParam)).toBe(0)

      m.setU8((q22.pQuestDataEx + 0x87) >>> 0, 1)
      ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c(m, pGame, pSoldier)
      expect(m.get(pSoldier, D2UnitStrc.pEventFirst)).not.toBe(0)

      // Act 1 Quest 4 & Intro filters (`0x6FC80170..0x6FC80810`)
      expect(ACT4_IntroStatusFilter_6FC80170_113c(m)).toBe(0)
      ACT4_IntroCallback08Noop_6FC80180_113c(m)
      expect(ACT1_IntroStatusFilter_6FC80800_113c(m)).toBe(0)
      const pOutSt = m.alloc(4) >>> 0
      m.setU8(pOutSt, 0xaa)
      expect(ACT4_EndgameStatusFilter_6FC80810_113c(m, 0, 0, 0, 0, pOutSt)).toBe(0)
      expect(m.u8(pOutSt)).toBe(0)

      expect(ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c(m, pGame)).toBe(0)
      m.setU8((q4.pQuestDataEx + 0x93) >>> 0, 1)
      expect(ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c(m, pGame)).toBe(1)
      ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c(m, pGame)
      expect(m.u8((q4.pQuestDataEx + 0x92) >>> 0)).toBe(1)

      const pPortalStatic = m.alloc(0x80) >>> 0
      const pPortalPath = m.alloc(0x20) >>> 0
      m.set(pPortalStatic, D2UnitStrc.dwUnitType, 2)
      m.set(pPortalStatic, D2UnitStrc.pPath, pPortalPath)
      m.setU32((pPortalPath + 0x0c) >>> 0, 4100)
      m.setU32((pPortalPath + 0x10) >>> 0, 4200)
      expect(ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c(m, pGame, pPortalStatic)).toBe(1)
      expect(ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c(m, pGame, pPortalStatic)).toBe(0)

      const pOutCoords = m.alloc(8) >>> 0
      m.setU8((q4.pQuestDataEx + 0x95) >>> 0, 1)
      expect(ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c(m, pGame, pPortalStatic, pOutCoords)).toBe(1)
      expect([m.u32(pOutCoords), m.u32((pOutCoords + 4) >>> 0)]).toEqual([4100, 4200])

      m.setU32((q4.pQuestDataEx + 0xa8) >>> 0, 5100)
      m.setU32((q4.pQuestDataEx + 0xac) >>> 0, 5200)
      m.setU8((q4.pQuestDataEx + 0x96) >>> 0, 1)
      m.setU8((q4.pQuestDataEx + 0x92) >>> 0, 0)
      expect(ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c(m, pGame, pOutCoords)).toBe(1)
      expect([m.u32(pOutCoords), m.u32((pOutCoords + 4) >>> 0)]).toEqual([5100, 5200])

      ACT1Q4_MarkFlag52_6FC80590_113c(m, pGame)
      ACT1Q4_MarkFlag63_6FC805C0_113c(m, pGame)
      expect(m.u8((q4.pQuestDataEx + 0x52) >>> 0)).toBe(1)
      expect(m.u8((q4.pQuestDataEx + 0x63) >>> 0)).toBe(1)

      const { pPlayer: pTristPortal } = allocPlayerUnit(m, 399, 0x26)
      expect(ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c(m, pGame, pTristPortal)).toBe(1)
      expect(m.u32((q4.pQuestDataEx + 0x74) >>> 0)).toBe(pTristPortal)

      const hitsB1 = endVaTrace113c()
      expect(hitsB1.has('D2Game:0x6FCAA3E0')).toBe(true)
      for (const v of hitsB1) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Part B: Wave 2 Batch 2 (`k2w2-b2`, 43 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pItemsTxt, pItemTypeEquiv } = createFullTestWorld()
      const pGame = m.alloc(0x1e00) >>> 0
      m.setU32((pGame + 0xa8) >>> 0, 300)
      EVENT_InitTimerQueue113c(m, pGame)

      const q1 = linkQuest(m, pGame, 1)
      const q3 = linkQuest(m, pGame, 3)
      const q4 = linkQuest(m, pGame, 4)
      const q5 = linkQuest(m, pGame, 5)
      const q6 = linkQuest(m, pGame, 6)

      const { pPlayer, pPlayerData, pQuestFlags, pClient, pRoom, pLevel } = allocPlayerUnit(m, 501, 1)
      const pQueue = m.alloc(0x400) >>> 0
      m.setU32((pClient + 0x1bc) >>> 0, pQueue)
      m.setU32((pClient + 0x1b8) >>> 0, pQueue)

      beginVaTrace113c()

      // 0x6FC80A30, 0x6FC81420, 0x6FC81880, 0x6FC81BE0, 0x6FC81F30, 0x6FC82170: GUID list removals
      const pQuestArg = m.alloc(0x20) >>> 0
      m.setU32(pQuestArg, pGame)
      m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer)

      QUESTS_GuidListAdd113c(m, q6.pQuestDataEx, 501)
      QUESTS_GuidListAdd113c(m, (q6.pQuestDataEx + 0x84) >>> 0, 501)
      QUESTS_GuidListAdd113c(m, (q6.pQuestDataEx + 0x108) >>> 0, 501)
      ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c(m, q6.pQuest, pQuestArg)
      expect(QUESTS_GuidListContains113c(m, (q6.pQuestDataEx + 0x108) >>> 0, 501)).toBe(0)

      QUESTS_GuidListAdd113c(m, (q4.pQuestDataEx + 0xb4) >>> 0, 501)
      ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c(m, pGame, pPlayer)
      expect(QUESTS_GuidListContains113c(m, (q4.pQuestDataEx + 0xb4) >>> 0, 501)).toBe(0)

      QUESTS_GuidListAdd113c(m, (q4.pQuestDataEx + 0xb4) >>> 0, 501)
      QUESTS_GuidListAdd113c(m, (q4.pQuestDataEx + 0x138) >>> 0, 501)
      ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c(m, q4.pQuest, pQuestArg)
      expect(QUESTS_GuidListContains113c(m, (q4.pQuestDataEx + 0x138) >>> 0, 501)).toBe(0)

      QUESTS_GuidListAdd113c(m, (q5.pQuestDataEx + 0x14) >>> 0, 501)
      ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c(m, q5.pQuest, pQuestArg)
      expect(QUESTS_GuidListContains113c(m, (q5.pQuestDataEx + 0x14) >>> 0, 501)).toBe(0)

      QUESTS_GuidListAdd113c(m, (q1.pQuest + 0x1c) >>> 0, 501)
      QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c(m, q1.pQuest, pQuestArg)
      expect(QUESTS_GuidListContains113c(m, (q1.pQuest + 0x1c) >>> 0, 501)).toBe(0)

      QUESTS_GuidListAdd113c(m, (q1.pQuest + 0x1c) >>> 0, 501)
      QUESTS_GuidListAdd113c(m, q1.pQuestDataEx, 501)
      QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c(m, q1.pQuest, pQuestArg)
      expect(QUESTS_GuidListContains113c(m, q1.pQuestDataEx, 501)).toBe(0)

      // 0x6FC80DA0, 0x6FC814A0, 0x6FC81860, 0x6FC88F90: Object init & Inifuss GUID
      const pObj = m.alloc(0x100) >>> 0
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x0c) >>> 0, 0x9988)
      m.setU32((pObj + 0x2c) >>> 0, m.alloc(0x20) >>> 0)
      const pObjInit = m.alloc(0x20) >>> 0
      m.setU32(pObjInit, pGame)
      m.setU32((pObjInit + 0x04) >>> 0, pObj)

      m.setU8((q5.pQuest + 0x09) >>> 0, 0)
      ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c(m, pObjInit)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(3)

      m.setU8((q4.pQuest + 0x09) >>> 0, 0)
      ACT1Q4_InitCainGibbetObject_6FC814A0_113c(m, pObjInit)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(1)

      ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c(m, q4.pQuest, pObj)
      expect(m.u32((q4.pQuestDataEx + 0x28) >>> 0)).toBe(0x9988)

      OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c(m, pObjInit)
      expect(m.u32((pObj + 0xdc) >>> 0)).not.toBe(0)

      // 0x6FC80EC0, 0x6FC81500, 0x6FC816F0, 0x6FC81D40, 0x6FC82340: Act 1 party reward/state callbacks
      ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c(m, pGame, pPlayer)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0)).toBe(1)

      m.set(pLevel, D2DrlgLevelStrc.nLevelId, 0x27)
      ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c(m, pGame, pPlayer)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0a)).toBe(1)

      m.set(pLevel, D2DrlgLevelStrc.nLevelId, 1)
      ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c(m, pGame, pPlayer)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 4)).toBe(1)

      STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 8, 0)
      ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c(m, pGame, pPlayer)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 1)).toBe(1)

      ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c(m, pPlayer, pGame)
      expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x29, 1)).toBe(1)

      // 0x6FC818D0, 0x6FC81B20, 0x6FC81C00: Inifuss & Malus inventory callbacks
      m.setU32((pItemsTxt + 0 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20646b62)
      m.setU32((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20736b62)
      m.setU32((pItemsTxt + 2 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x206d6468)
      m.setU16((pItemsTxt + 2 * D2ItemsTxt_SIZE + 0x11e) >>> 0, 3)
      m.setU32((pItemTypeEquiv + 3 * 4) >>> 0, 1 << 5)

      const pInv = m.alloc(0x40) >>> 0
      m.setU32(pInv, INVENTORY_SIGNATURE_113C)
      m.setU32((pPlayer + 0x60) >>> 0, pInv)
      const mkQuestItem = (cls: number, next: number) => {
        const pIt = m.alloc(0x100) >>> 0
        const pId = m.alloc(0x80) >>> 0
        m.setU32(pIt, 4)
        m.setU32((pIt + 0x04) >>> 0, cls)
        m.setU32((pIt + 0x14) >>> 0, pId)
        m.setU32((pId + 0x64) >>> 0, next)
        return pIt
      }
      const pHdm = mkQuestItem(2, 0)
      const pBks = mkQuestItem(1, pHdm)
      const pBkd = mkQuestItem(0, 0)
      m.setU32((pInv + 0x20) >>> 0, pBkd)
      m.setU32((pInv + 0x0c) >>> 0, pBks)

      ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c(m, q4.pQuest, pQuestArg)
      expect(m.u32((q4.pQuestDataEx + 0x7c) >>> 0)).toBe(2)

      ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c(m, pGame, pPlayer)
      expect(m.u8((q3.pQuestDataEx + 0xa0) >>> 0)).toBe(1)

      m.setU8((q3.pQuest + 0x09) >>> 0, 1)
      m.setU8((q3.pQuest + 0x0c) >>> 0, 0)
      m.setU8((q3.pQuestDataEx + 0x01) >>> 0, 1)
      m.setU32((q3.pQuestDataEx + 0x98) >>> 0, 2)
      ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c(m, q3.pQuest, pQuestArg)
      expect(m.u8((q3.pQuest + 0x0b) >>> 0)).toBe(2)

      // 0x6FC825F0..0x6FC82CD0: Act 1 completion alerts & event sounds
      const { pPlayer: pAlertPlr, pQuestFlags: pAlertFlags, pClient: pAlertClient } = allocPlayerUnit(m, 502, 1)
      const pAlertQueue = m.alloc(0x400) >>> 0
      m.setU32((pAlertClient + 0x1bc) >>> 0, pAlertQueue)
      m.setU32((pAlertClient + 0x1b8) >>> 0, pAlertQueue)

      ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c(m, pGame, pAlertPlr)
      ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c(m, pGame, pAlertPlr)
      ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c(m, pGame, pAlertPlr)
      ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c(m, pGame, pAlertPlr)
      ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c(m, pGame, pAlertPlr)
      ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c(m, pAlertPlr)
      expect(DRLGWARP_TestRoomTileBit113c(m, pAlertFlags, 6, 0x0e)).toBe(1)
      expect(DRLGWARP_TestRoomTileBit113c(m, pAlertFlags, 1, 0x0e)).toBe(1)

      QUESTRECORD_SetQuestState113c(m, pAlertFlags, 6, 1)
      QUESTRECORD_SetQuestState113c(m, pAlertFlags, 6, 0x0d)
      ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c(m, pGame, pAlertPlr)
      expect(m.u16((pAlertPlr + 0x6e) >>> 0)).toBe(0x21)

      QUESTRECORD_SetQuestState113c(m, pAlertFlags, 1, 0x0d)
      ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c(m, pGame, pAlertPlr)
      expect(m.u16((pAlertPlr + 0x6e) >>> 0)).toBe(0x23)

      // 0x6FC89490 & 0x6FC895F0: 35-entry NPC intro bitfield set/clear + unmapped bit-0 fallback
      const pIntroData = m.alloc(0x10) >>> 0
      const pHolder0 = m.alloc(8) >>> 0
      const pHolder1 = m.alloc(8) >>> 0
      const pBuf0 = m.alloc(8) >>> 0
      const pBuf1 = m.alloc(8) >>> 0
      m.setU32(pHolder0, pBuf0)
      m.setU32(pHolder1, pBuf1)
      m.setU32(pIntroData, pHolder0)
      m.setU32((pIntroData + 0x04) >>> 0, pHolder1)
      m.setU32((pPlayerData + 0x60) >>> 0, pIntroData)
      QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, 520, pGame) // bit 34 -> byte 4, mask 0x04
      expect(m.u8((pBuf0 + 4) >>> 0)).toBe(0x04)
      m.setU8((pBuf1 + 4) >>> 0, 0xff)
      QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c(m, pPlayer, 520, pGame)
      expect(m.u8((pBuf1 + 4) >>> 0)).toBe(0xfb)

      // 0x6FC89650..0x6FC89730: Permanent stat grants & fixed8 life/mana rewards
      expect(OBJECTS_GrantUnitSkillPoints_6FC89650_113c(m, pGame, pPlayer, 2)).toBe(1)
      expect(OBJECTS_GrantUnitStrength_6FC896B0_113c(m, pGame, pPlayer, 5)).toBe(1)
      expect(OBJECTS_GrantUnitVitality_6FC896D0_113c(m, pGame, pPlayer, 4)).toBe(1)
      expect(OBJECTS_GrantUnitDexterity_6FC896F0_113c(m, pGame, pPlayer, 3)).toBe(1)
      expect(OBJECTS_GrantUnitEnergy_6FC89710_113c(m, pGame, pPlayer, 6)).toBe(1)
      expect(STATLIST_GetUnitBaseStat113c(m, pPlayer, 5, 0)).toBe(2)
      expect(STATLIST_GetUnitBaseStat113c(m, pPlayer, 0, 0)).toBe(5)

      STATLIST_SetUnitStat113c(m, pPlayer, 6, 100 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 8, 50 << 8, 0)
      STATLIST_SetUnitStat113c(m, pPlayer, 9, 50 << 8, 0)
      expect(OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c(m, pGame, pPlayer, 20)).toBe(1)
      expect(OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c(m, pGame, pPlayer, 15)).toBe(1)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 7, 0)).toBe(120 << 8)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 9, 0)).toBe(65 << 8)

      // 0x6FC89770..0x6FC898A0: Shrines (Enirhs _strrev + strncpy(16), Mana/Health Exchange, Recharge)
      const pOpShrine = m.alloc(0x20) >>> 0
      m.setU32((pOpShrine + 0x08) >>> 0, pPlayer)
      const nameStr = 'Tyrael'
      for (let i = 0; i < nameStr.length; i++) m.setU8((pPlayerData + i) >>> 0, nameStr.charCodeAt(i))
      m.setU8((pPlayerData + nameStr.length) >>> 0, 0)
      m.setU8((pPlayerData + 12) >>> 0, 0x77)
      SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c(m, pOpShrine)
      expect(String.fromCharCode(...m.readBytes(pPlayerData, 6))).toBe('learyT')
      expect(m.u8((pPlayerData + 12) >>> 0)).toBe(0)

      const pShrinesTxt = m.alloc(0x20) >>> 0
      m.setU32((pShrinesTxt + 0x04) >>> 0, 50)
      m.setU32((pShrinesTxt + 0x08) >>> 0, 200)
      SHRINES_ApplyManaExchangeEffect_6FC897A0_113c(m, pOpShrine, pShrinesTxt)
      SHRINES_ApplyHealthExchangeEffect_6FC89800_113c(m, pOpShrine, pShrinesTxt)
      SHRINES_ApplyManaRechargeEffect_6FC89860_113c(m, pOpShrine)
      SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c(m, pOpShrine)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 6, 0)).toBe(120 << 8)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(65 << 8)

      // 0x6FC898E0, 0x6FC89940, 0x6FC89A80
      expect(OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c(m, pPlayer, 5)).toBe(1)
      expect(OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c(m, pRoom, 0xea)).toBe(0)
      expect(OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c(m, pRoom, 0x10)).toBe(1)

      const pToggleOp = m.alloc(0x10) >>> 0
      m.setU32((pToggleOp + 0x04) >>> 0, pObj)
      m.setU32((pObj + 0x10) >>> 0, 0)
      m.setU32((pObj + 0xc4) >>> 0, 0x07)
      expect(OBJECTS_OperateToggleObjectMode012_6FC89A80_113c(m, pToggleOp)).toBe(1)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(1)
      expect(m.u32((pObj + 0xc4) >>> 0)).toBe(0x05)
      expect(OBJECTS_OperateToggleObjectMode012_6FC89A80_113c(m, pToggleOp)).toBe(1)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(0)
      m.setU32((pObj + 0x10) >>> 0, 3)
      expect(OBJECTS_OperateToggleObjectMode012_6FC89A80_113c(m, pToggleOp)).toBe(1)
      expect(m.u32((pObj + 0x10) >>> 0)).toBe(3)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // -------------------------------------------------------------------------
    // Part C: Wave 2 Batch 5 (`k2w2-b5`, 42 promoted VAs)
    // -------------------------------------------------------------------------
    {
      const { m, pSkillsTxt, pMonStatsTxt } = createFullTestWorld()
      const pGame = m.alloc(0x1e00) >>> 0
      m.setU32((pGame + 0xa8) >>> 0, 12)
      m.setU32((pGame + 0x70) >>> 0, 1) // Expansion flag
      m.setU8((pGame + 0x6d) >>> 0, 1) // Nightmare
      EVENT_InitTimerQueue113c(m, pGame)

      beginVaTrace113c()

      const pPlayer = m.alloc(0x100) >>> 0
      const pPlayerPath = m.alloc(0x40) >>> 0
      m.setU32(pPlayer, 0)
      m.setU32((pPlayer + 0x04) >>> 0, 2)
      m.setU32((pPlayer + 0x0c) >>> 0, 101)
      m.setU32((pPlayer + 0x2c) >>> 0, pPlayerPath)
      m.setU16((pPlayerPath + 0x02) >>> 0, 100)
      m.setU16((pPlayerPath + 0x06) >>> 0, 100)
      STATLIST_CreateEx113c(m, pPlayer)

      const pMis = m.alloc(0x100) >>> 0
      m.setU32(pMis, 3)
      STATLIST_CreateEx113c(m, pMis)
      STATLIST_SetUnitStat113c(m, pMis, 0x13, 30, 0)
      const pWpn = m.alloc(0x100) >>> 0
      m.setU32(pWpn, 4)
      STATLIST_CreateEx113c(m, pWpn)

      // 0x6FCBE4F0..0x6FCC20C0: SKILLS routines + 0x6FCFE5A0 callee trace check
      SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c(m, pPlayer, pMis, pWpn)
      expect(STATLIST_GetUnitStat113c(m, pMis, 0x13, 0)).toBe(30)

      const pFindData = m.alloc(0x20) >>> 0
      const pCounter = m.alloc(4) >>> 0
      m.setU32((pFindData + 0x0c) >>> 0, pCounter)
      expect(SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c(m, pFindData)).toBe(1)
      expect(m.u32(pCounter)).toBe(1)

      SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c(m, pWpn, 45)
      expect(STATLIST_GetUnitStat113c(m, pWpn, 0x44, 0)).toBe(45)

      const pSkill10 = (pSkillsTxt + 10 * 0x23c) >>> 0
      m.setU32((pSkill10 + 0x128) >>> 0, 0xffffffff)
      expect(SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c(m, 1, 10, pSkill10, pGame, pPlayer)).toBe(16)

      const pDmg = m.alloc(0x70) >>> 0
      m.setU8((pSkill10 + 0x1dc) >>> 0, 12)
      SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c(m, 10, 88, pDmg)
      expect(m.u32((pDmg + 0x34) >>> 0)).toBe(88)

      m.setU8((pSkill10 + 0x0c) >>> 0, 2)
      expect(SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c(m, 10, pPlayer)).toBe(1)

      STATLIST_SetUnitStat113c(m, pPlayer, 8, 500, 0)
      expect(SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c(m, pPlayer, 150)).toBe(1)
      expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(350)

      const pRingCtx = m.alloc(0x20) >>> 0
      m.setU32((pFindData + 0x0c) >>> 0, pRingCtx)
      m.setU32((pRingCtx + 0x04) >>> 0, 0xffffffff)
      m.setU32((pRingCtx + 0x0c) >>> 0, 0xffffffff)
      m.setU32((pRingCtx + 0x10) >>> 0, 50)
      expect(SKILLS_TargetRingScanCallback_6FCBED70_113c(m, pFindData, pPlayer)).toBe(1)
      expect(m.u32((pRingCtx + 0x04) >>> 0)).toBe(101)

      m.setU8((pSkill10 + 0x1a4) >>> 0, 8)
      m.setU32((pSkill10 + 0x1a8) >>> 0, 5)
      m.setU32((pSkill10 + 0x1ac) >>> 0, 10)
      m.setU32((pSkill10 + 0x1d8) >>> 0, 0xffffffff)
      m.setU32((pPlayer + 0x20) >>> 0, 0x11223344)
      SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, pPlayer, 10, pDmg, 1)
      expect(m.u32((pDmg + 0x08) >>> 0)).toBeGreaterThanOrEqual(5 << 8)

      // 0x6FCC11B0: exercise real 0x6FCFE5A0 non-autohit branch (verifying D2Game:0x6FCFE5A0 trace hit!)
      const pMon = m.alloc(0x100) >>> 0
      const pMonPath = m.alloc(0x80) >>> 0
      const pMonData = m.alloc(0x60) >>> 0
      const pAiGeneral = m.alloc(0x50) >>> 0
      m.setU32(pMon, 1)
      m.setU32((pMon + 0x04) >>> 0, 5)
      m.setU32((pMon + 0x0c) >>> 0, 202)
      m.setU32((pMon + 0x10) >>> 0, 1)
      m.setU32((pMon + 0x14) >>> 0, pMonData)
      m.setU32((pMonData + 0x28) >>> 0, pAiGeneral)
      m.setU32((pMon + 0x2c) >>> 0, pMonPath)
      m.setU16((pMonPath + 0x02) >>> 0, 101)
      m.setU16((pMonPath + 0x06) >>> 0, 100)
      STATLIST_CreateEx113c(m, pMon)

      const pPlrAlign = STATLIST_AllocList113c(m, 0, 0, 0, 0, 101)
      STATLIST_SetState113c(m, pPlrAlign, 0x69)
      STATLIST_SetStat113c(m, pPlrAlign, 0xac, 2, 0)
      STATLIST_MergeStatLists113c(m, pPlayer, pPlrAlign, 1)
      m.setU32((pPlayer + 0x10) >>> 0, 3) // running defender -> auto-hit in 0x6FCFE5A0 before block check!
      m.setU16((pSkill10 + 0x12e) >>> 0, 0x0020)
      const hitFlags = SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c(
        m,
        pSkill10,
        pDmg,
        1,
        10,
        pGame,
        pMon,
        pPlayer,
        0,
      )
      expect(hitFlags & 0x0021).toBe(0x0021)

      expect(SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c(m, pGame, pMon)).toBe(0)
      expect(m.u32((pMon + 0xc4) >>> 0) & 0x40).toBe(0x40)

      // 0x6FCC3880..0x6FCD13B0: MONAI callbacks & octile/corpse/door helpers
      MONAI_NoOpRet4_6FCC3880_113c(m)
      MONAI_NoOpRet4_6FCC3920_113c(m)
      MONAI_NoOpRet4_6FCC3930_113c(m)
      MONAI_NoOpRet4_6FCC39D0_113c(m)

      const { pRoom: pRoomA } = allocPlayerUnit(m, 601, 5)
      const { pRoom: pRoomB } = allocPlayerUnit(m, 602, 6)
      m.setU32((pPlayerPath + 0x1c) >>> 0, pRoomA)
      m.setU32((pMonPath + 0x1c) >>> 0, pRoomA)
      expect(MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c(m, pPlayer, pMon)).toBe(1)
      m.setU32((pMonPath + 0x1c) >>> 0, pRoomB)
      expect(MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c(m, pPlayer, pMon)).toBe(0)

      const pAiControl = m.alloc(0x40) >>> 0
      const pAiArgs = m.alloc(0x30) >>> 0
      m.setU32(pAiArgs, pAiControl)
      MONAI_InitAiControlDefaultParams_6FCC3990_113c(m, pAiArgs)
      MONAI_ClearAiControlParam0_6FCC3980_113c(m, pAiArgs)
      MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c(m, pGame, pAiArgs)
      expect(m.u32((pAiControl + 0x14) >>> 0)).toBe(12)

      const pObj233 = m.alloc(0x100) >>> 0
      const pObj233Path = m.alloc(0x40) >>> 0
      const pObj233Data = m.alloc(0x40) >>> 0
      const pObj233Txt = m.alloc(0x120) >>> 0
      m.setU32(pObj233Data, pObj233Txt)
      m.setU32((pObj233Txt + 0xd0) >>> 0, 2)
      m.setU32(pObj233, 2)
      m.setU32((pObj233 + 0x04) >>> 0, 0x233)
      m.setU32((pObj233 + 0x14) >>> 0, pObj233Data)
      m.setU32((pObj233 + 0x2c) >>> 0, pObj233Path)
      m.setU32((pObj233Path + 0x0c) >>> 0, 102)
      m.setU32((pObj233Path + 0x10) >>> 0, 100)
      const pScanCtx = m.alloc(0x10) >>> 0
      m.setU32((pScanCtx + 0x04) >>> 0, 10)
      expect(
        MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c(m, pGame, pMon, pObj233, pScanCtx),
      ).toBe(pObj233)

      m.setU32((pAiControl + 0x1c) >>> 0, (-7) >>> 0) // trunc(-7 / 3) = -2 + trunc(1 / 2) = -2 -> clamped to 1
      expect(MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c(m, 0, 0, pAiArgs)).toBe(1)

      const pMonRec5 = (pMonStatsTxt + 5 * 0x1a8) >>> 0
      m.setU16((pMonRec5 + 0x62 + 1 * 2) >>> 0, 9)
      m.setU32((pAiArgs + 0x1c) >>> 0, pMonRec5)
      m.setU32((pMon + 0x20) >>> 0, 3)
      m.setU32((pMon + 0x24) >>> 0, 5)
      MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c(m, pGame, pMon, pAiArgs)
      expect(m.u32((pAiControl + 0x18) >>> 0)).toBe(10)

      expect(MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c(m, 0, 0, -5)).toBe(1)
      expect(MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c(m, 0, 0, 60)).toBe(24)

      // 0x6FCC3E10: octile distance boundary (< 0x3FC = 1020) + 0x6FCD08F0 trace hit
      m.setU8((pMon + 0x18) >>> 0, 4)
      m.setU8((pObj233 + 0x18) >>> 0, 4)
      m.setU32((pObj233Path + 0x0c) >>> 0, 101 + 1019)
      m.setU32((pObj233Path + 0x10) >>> 0, 100)
      expect(MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c(m, pMon, pObj233)).toBe(1)
      m.setU32((pObj233Path + 0x0c) >>> 0, 101 + 1020)
      expect(MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c(m, pMon, pObj233)).toBe(0)

      expect(MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c(m, pGame, pMon, 0)).toBe(0)
      MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c(m, pGame, pMon)
      MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c(m, pGame, pMon)

      expect(MONAI_EnableState172OnTarget_6FCCC910_113c(m, pMon, pMon)).toBe(1)
      expect(STATES_CheckState113c(m, pMon, 0xac)).not.toBe(0)
      STATES_ToggleGfxStateFlag113c(m, pMon, 0xac, 0)

      expect(MONAI_InventoryContainsItemPointer_6FCCC9E0_113c(m, pMon, pWpn)).toBe(0)

      const pCellItem = m.alloc(0x100) >>> 0
      const pCellData = m.alloc(0x80) >>> 0
      m.setU32(pCellItem, 4)
      m.setU32((pCellItem + 0x14) >>> 0, pCellData)
      m.setU32((pCellData + 0x28) >>> 0, 12)
      STATLIST_CreateEx113c(m, pCellItem)
      STATLIST_SetUnitStat113c(m, pCellItem, 0x47, 7, 0)
      expect(MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c(m, pMon, pCellItem)).toBe(1)
      expect(STATLIST_GetUnitStat113c(m, pMon, 12, 0)).toBe(7)

      m.setU16((pMonRec5 + 0x170 + 7 * 2) >>> 0, 81)
      expect(MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, pMon, 81)).toBe(1)
      expect(MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, pMon, 82)).toBe(0)

      MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c(m, pMon, pPlayer)
      expect(m.u32((pAiGeneral + 0x0c) >>> 0)).toBe(101)

      const pCountCtx = m.alloc(0x10) >>> 0
      m.setU32(pCountCtx, 5)
      m.setU32((pCountCtx + 0x04) >>> 0, 10)
      m.setU32((pMon + 0x10) >>> 0, 1)
      expect(
        MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c(m, pGame, pMon, pMon, pCountCtx),
      ).toBe(0)
      expect(m.u32((pCountCtx + 0x08) >>> 0)).toBe(1)

      const pDoorOut = m.alloc(8) >>> 0
      m.setU32((pDoorOut + 0x04) >>> 0, 500)
      expect(MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c(m, pGame, pMon, 0, pDoorOut)).toBe(0)

      const pMaxRad = m.alloc(4) >>> 0
      m.setU32(pMaxRad, 10)
      m.setU32((pMon + 0x10) >>> 0, 0)
      expect(
        MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c(m, pGame, pMon, pMon, pMaxRad),
      ).toBe(pMon)

      const pCorpseCtx = m.alloc(0x10) >>> 0
      m.setU32((pCorpseCtx + 0x0c) >>> 0, 10)
      expect(
        MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c(m, pGame, pMon, pMon, pCorpseCtx),
      ).toBe(0)

      m.setU32((pPlayer + 0x10) >>> 0, 1)
      m.setU32((pPlayer + 0xc4) >>> 0, 0x04)
      expect(MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c(m, pPlayer, pGame, pMon)).toBe(1)

      // 0x6FCD22D0..0x6FCD2620: ARENA lifecycle & assert checks
      expect(() => ARENA_GetModeByte_6FCD22D0_113c(m, pGame)).toThrow(D2CommonAssertError)
      expect(() => ARENA_CheckFlagBit8_6FCD2620_113c(m, pGame)).toThrow(D2CommonAssertError)
      ARENA_AllocGameArenaCtrl_6FCD2560_113c(m, pGame, 0xffffffff, 9)
      expect(ARENA_GetModeByte_6FCD22D0_113c(m, pGame)).toBe(9)
      expect(ARENA_CheckFlagBit8_6FCD2620_113c(m, pGame)).toBe(1)

      const pPlrData = m.alloc(0x60) >>> 0
      m.setU32((pPlayer + 0x14) >>> 0, pPlrData)
      ARENA_AllocPlayerArenaUnit_6FCD24D0_113c(m, pGame, pPlayer)
      expect(m.u32((pPlrData + 0x34) >>> 0)).not.toBe(0)
      ARENA_FreePlayerArenaUnit_6FCD2480_113c(m, pPlayer, pGame)
      expect(m.u32((pPlrData + 0x34) >>> 0)).toBe(0)

      const hitsB5 = endVaTrace113c()
      expect(hitsB5.has('D2Game:0x6FCFE5A0')).toBe(true)
      expect(hitsB5.has('D2Game:0x6FCD08F0')).toBe(true)
      for (const v of hitsB5) cumulativeHits.add(v)
    }

    const missingVas = WAVE1_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
