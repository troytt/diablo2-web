/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 12: +141 VAs).
 *
 * Audits and verifies 141 eligible `D2Game.dll` (`0x6FC20000`) closure functions across 4 shards:
 * - `k2w3-b7` (`src/d2kern-113c/game/k2-w3b7-113c.ts`, 36 eligible; 3 `indirectUnknown` kept `ported`)
 * - `k2w7-b1` (`src/d2kern-113c/game/k2-w7b1-113c.ts`, 35 eligible; 2 `indirectUnknown` kept `ported`)
 * - `k2w4-b5` (`src/d2kern-113c/game/k2-w4b5-113c.ts`, 35 eligible; 3 `indirectUnknown` kept `ported`)
 * - `k2w5-b3` (`src/d2kern-113c/game/k2-w5b3-113c.ts`, 35 eligible; 3 `indirectUnknown` kept `ported`)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcodes, function sizes, manifest promotion,
 *    and all 11 `indirectUnknown` guardrails remaining at `ported`.
 * 2. Dedicated behavioral differential regressions for every real disassembly discrepancy fixed
 *    across all 4 shards.
 * 3. Concrete multi-branch state assertions + 100% (`141 / 141`) live `beginVaTrace113c()` /
 *    `endVaTrace113c()` execution coverage.
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
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  INVENTORY_AllocInventory113c,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  ACT1Q4_OnCainModeOrInteract_6FC88150_113c,
  ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c,
  CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c,
  CUBE_ValidateRecipeInputSlot_6FC90240_113c,
  MISSILE_SendSyncPacket73_6FC8F740_113c,
  MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c,
  MONSTER_EventHoverMsgTimeout_6FC96570_113c,
  MONSTER_ModeChangeCorpse_6FC95460_113c,
  MONSTER_ModeChangeKnockback_6FC95160_113c,
  MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c,
  MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c,
  MONSTER_StepSkillCastAnim_6FC96F20_113c,
  NET_SendEventMessagePacket5A_6FC90BF0_113c,
  OBJ_ApplyShrineAuraStatList_6FC8A960_113c,
  OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c,
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_EventHoverMsgTimeout_6FC8E470_113c,
  OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c,
  OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c,
  OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c,
  OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c,
  OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c,
  OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c,
  OBJ_OperateBreakawayObject_6FC8D8F0_113c,
  OBJ_OperateGenericMode0To1_6FC8DE00_113c,
  OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c,
  OBJ_OperateWaypoint_6FC8CF90_113c,
  OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c,
  OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c,
  OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c,
  OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c,
  OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c,
  PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c,
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c,
  QUESTS_FreeBitBufferPair_6FC892D0_113c,
  SKILLS_CalcUnitSkillToHit_6FC89B00_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c.ts'
import {
  AI_Think_Overlord_6FC37CB0_113c,
  ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c,
  MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c,
  MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c,
  MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c,
  MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c,
  MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c,
  MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c,
  PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c,
  PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c,
  QUESTS_Act1AndarielOnDeath_6FC7B690_113c,
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c,
  QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c,
  QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c,
  QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c,
  QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c,
  SKILLS_ApplyDimVisionToTarget_6FC70470_113c,
  SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c,
  SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c,
  SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c,
  SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c,
  SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c,
  SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c,
  SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c,
  SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c,
  SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c,
  SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c,
  SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c,
  SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c,
  SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c,
  SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c,
  SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c,
  SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c,
  SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c,
  SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c.ts'
import {
  AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c,
  AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c,
  AURAS_RedemptionCorpseCallback_6FCB8680_113c,
  INVENTORY_FreeAllItems_6FCAF470_113c,
  ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c,
  ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c,
  MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c,
  NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c,
  NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c,
  NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c,
  NPCS_QueueOrFreeVendorItem_6FCB0260_113c,
  NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c,
  NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c,
  PARTY_CountSubPartyMembers_6FCBBF40_113c,
  PARTY_CreateAndLinkSubParty_6FCBBF70_113c,
  PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c,
  PETS_FindPetTypeByGuid_6FCB6600_113c,
  PETS_GetFirstPetUnitByType_6FCB6A40_113c,
  PETS_SendPacket7A_UnsummonPet_6FCB6810_113c,
  PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c,
  SKILLS_AddProgressiveChargeStage_6FCB5370_113c,
  SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c,
  SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c,
  SKILLS_ApplyRadialDamageCallback_6FCB3040_113c,
  SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c,
  SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c,
  SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c,
  SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c,
  SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c,
  SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c,
  SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c,
  SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c,
  SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c,
  SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c,
  STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c.ts'
import {
  ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c,
  ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c,
  ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c,
  ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c,
  AIBAAL_SelectAction_6FCD79B0_113c,
  AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c,
  AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c,
  AURA_FindClosestUnitInRadius_6FCC1000_113c,
  ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c,
  ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c,
  MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c,
  MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c,
  SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c,
  SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c,
  SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c,
  SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c,
  SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c,
  SKILLS_DoChargeStart_6FCB9620_113c,
  SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c,
  SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c,
  SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c,
  SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c,
  SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c,
  SKILLS_DoRedemptionAuraPulse_6FCBA400_113c,
  SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c,
  SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c,
  SKILLS_DoUnsummonStart_6FCBFEF0_113c,
  SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c,
  SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c,
  SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c,
  SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c,
  SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c,
  SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c,
  SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c,
  SUNITDMG_ProcHitOpenWounds_6FCCD410_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c.ts'
import { SUNITDMG_AllocCombat113c } from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2DynamicPathStrc,
  D2InventoryStrc,
  D2ItemStatCostTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt,
  D2MonStats2Txt_SIZE,
  D2RoomExStrc,
  D2RoomLogicalInfoStrc,
  D2SkillListStrc,
  D2SkillStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  beginFrameS2CTrace113c,
  endFrameS2CTrace113c,
} from '../../../src/d2kern-113c/net/packet-sink.ts'
import {
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '../../..')
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools/oracle/callgraph/manifest-113c.json')
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data')

interface ManifestFn {
  readonly module: string
  readonly va: string
  readonly name: string
  readonly size: number
  readonly status: string
  readonly tsSymbol?: string
  readonly diffEvidence?: string
  readonly indirectUnknown?: boolean
}

interface Manifest {
  readonly functions: readonly ManifestFn[]
}

interface DisasmVaSpec {
  readonly batch: 'k2w3-b7' | 'k2w7-b1' | 'k2w4-b5' | 'k2w5-b3'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE12_INDIRECT_UNKNOWN_VAS: readonly string[] = [
  '0x6FC89E50',
  '0x6FC8A330',
  '0x6FC8DA00',
  '0x6FC22090',
  '0x6FC3BF60',
  '0x6FCB1660',
  '0x6FCB6AF0',
  '0x6FCBC160',
  '0x6FCC06F0',
  '0x6FCC0AD0',
  '0x6FCCD0F0',
]

const WAVE12_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  // k2w3-b7: 36 eligible VAs
  { batch: 'k2w3-b7', va: '0x6FC88150', size: 243, headHex: '83ec20568bf285f6', tailHex: 'c20400', tsSymbol: 'ACT1Q4_OnCainModeOrInteract_6FC88150_113c' },
  { batch: 'k2w3-b7', va: '0x6FC88F00', size: 138, headHex: '85ff750433c0eb03', tailHex: '005ec3', tsSymbol: 'ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c' },
  { batch: 'k2w3-b7', va: '0x6FC892D0', size: 138, headHex: '8b0685c074328b10', tailHex: 'faffc3', tsSymbol: 'QUESTS_FreeBitBufferPair_6FC892D0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC89B00', size: 241, headHex: '53558b6c240c5657', tailHex: 'c20800', tsSymbol: 'SKILLS_CalcUnitSkillToHit_6FC89B00_113c' },
  { batch: 'k2w3-b7', va: '0x6FC89CA0', size: 189, headHex: '53568bf28b46148a', tailHex: '5e5bc3', tsSymbol: 'OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC89DE0', size: 110, headHex: '538b5c2408566a00', tailHex: 'c20800', tsSymbol: 'OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8A050', size: 124, headHex: '85db558b6c24087c', tailHex: 'c20400', tsSymbol: 'OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8A1A0', size: 117, headHex: '85c9568bf0746c81', tailHex: 'ff5ec3', tsSymbol: 'OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8A220', size: 258, headHex: '83ec0885c0751f68', tailHex: 'c408c3', tsSymbol: 'OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8A440', size: 159, headHex: '568bf13bf2743885', tailHex: 'c05ec3', tsSymbol: 'OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8A7A0', size: 319, headHex: '83ec0855568bf18b', tailHex: 'c408c3', tsSymbol: 'OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8A900', size: 34, headHex: '8b44240456508bf1', tailHex: 'c20400', tsSymbol: 'OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8A960', size: 109, headHex: '83ec2433c0890424', tailHex: 'c21400', tsSymbol: 'OBJ_ApplyShrineAuraStatList_6FC8A960_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8B570', size: 369, headHex: '83ec1c578b7c2424', tailHex: 'c20800', tsSymbol: 'OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8B7A0', size: 188, headHex: '83ec3053558b6c24', tailHex: 'c20800', tsSymbol: 'OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8BF00', size: 757, headHex: '83ec38535556578d', tailHex: 'f9ffcc', tsSymbol: 'OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8C900', size: 768, headHex: '558bec83e4f881ec', tailHex: 'e55dc3', tsSymbol: 'OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8CF90', size: 340, headHex: '83ec1c53568bf18b', tailHex: 'c41cc3', tsSymbol: 'OBJ_OperateWaypoint_6FC8CF90_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8D8F0', size: 102, headHex: '568bf18b460485c0', tailHex: '005ec3', tsSymbol: 'OBJ_OperateBreakawayObject_6FC8D8F0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8DE00', size: 184, headHex: '568bf18b460485c0', tailHex: '005ec3', tsSymbol: 'OBJ_OperateGenericMode0To1_6FC8DE00_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8DEC0', size: 256, headHex: '83ec0c5355568bf1', tailHex: 'c40cc3', tsSymbol: 'OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8E470', size: 104, headHex: '53568bf285f68bd9', tailHex: '5e5bc3', tsSymbol: 'OBJ_EventHoverMsgTimeout_6FC8E470_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8E4E0', size: 405, headHex: '53568bf285f6578b', tailHex: '5e5bc3', tsSymbol: 'OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC8F740', size: 317, headHex: '83ec2485f60f842c', tailHex: 'c20800', tsSymbol: 'MISSILE_SendSyncPacket73_6FC8F740_113c' },
  { batch: 'k2w3-b7', va: '0x6FC900C0', size: 110, headHex: '555750e8f8a3f9ff', tailHex: '5f5dc3', tsSymbol: 'PLAYER_FreePlayerDataField5CList_6FC900C0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC90240', size: 2292, headHex: '8b4c240c83ec2053', tailHex: 'c21400', tsSymbol: 'CUBE_ValidateRecipeInputSlot_6FC90240_113c' },
  { batch: 'k2w3-b7', va: '0x6FC90BF0', size: 146, headHex: '83ec2833c9890c24', tailHex: 'c428c3', tsSymbol: 'NET_SendEventMessagePacket5A_6FC90BF0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC91060', size: 257, headHex: '81ec040200005557', tailHex: 'c20c00', tsSymbol: 'CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c' },
  { batch: 'k2w3-b7', va: '0x6FC95160', size: 163, headHex: '53578b7a0485ff8b', tailHex: '005bc3', tsSymbol: 'MONSTER_ModeChangeKnockback_6FC95160_113c' },
  { batch: 'k2w3-b7', va: '0x6FC95460', size: 126, headHex: '55568b720485f657', tailHex: '005dc3', tsSymbol: 'MONSTER_ModeChangeCorpse_6FC95460_113c' },
  { batch: 'k2w3-b7', va: '0x6FC955C0', size: 190, headHex: '558bec83e4f883ec', tailHex: 'c20400', tsSymbol: 'MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC960F0', size: 380, headHex: '83ec08538bd885db', tailHex: 'c20400', tsSymbol: 'MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC96570', size: 108, headHex: '53568bf285f68bd9', tailHex: 'c20800', tsSymbol: 'MONSTER_EventHoverMsgTimeout_6FC96570_113c' },
  { batch: 'k2w3-b7', va: '0x6FC965E0', size: 273, headHex: '83ec2053568bf28b', tailHex: 'c420c3', tsSymbol: 'MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c' },
  { batch: 'k2w3-b7', va: '0x6FC96F20', size: 178, headHex: '5156578bf2568bf9', tailHex: '5e59c3', tsSymbol: 'MONSTER_StepSkillCastAnim_6FC96F20_113c' },
  { batch: 'k2w3-b7', va: '0x6FC97D90', size: 108, headHex: '8b0683ec0885c057', tailHex: 'c408c3', tsSymbol: 'PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c' },
  // k2w7-b1: 35 eligible VAs
  { batch: 'k2w7-b1', va: '0x6FC2D290', size: 222, headHex: '83ec0c8b44241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c' },
  { batch: 'k2w7-b1', va: '0x6FC2D530', size: 149, headHex: '535556578b7c2414', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c' },
  { batch: 'k2w7-b1', va: '0x6FC307E0', size: 451, headHex: '81ec2c040000538b', tailHex: 'ffffcc', tsSymbol: 'ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC37CB0', size: 1255, headHex: '83ec6c8b44247053', tailHex: 'c20400', tsSymbol: 'AI_Think_Overlord_6FC37CB0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC457D0', size: 759, headHex: '81ecb40000005355', tailHex: 'c20800', tsSymbol: 'MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC45AD0', size: 489, headHex: '83ec148b44241c85', tailHex: 'c20800', tsSymbol: 'MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC45E60', size: 251, headHex: '85d2752183c8ff2d', tailHex: 'c20800', tsSymbol: 'MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c' },
  { batch: 'k2w7-b1', va: '0x6FC46230', size: 147, headHex: '535556576a008bf2', tailHex: 'c20800', tsSymbol: 'MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c' },
  { batch: 'k2w7-b1', va: '0x6FC465E0', size: 201, headHex: '83ec745355568bf2', tailHex: 'c20800', tsSymbol: 'MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC466B0', size: 527, headHex: '81ecb4000000538b', tailHex: 'c20800', tsSymbol: 'MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC47E30', size: 250, headHex: '5156578b7c241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c' },
  { batch: 'k2w7-b1', va: '0x6FC49000', size: 571, headHex: '83ec78538b9c2480', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c' },
  { batch: 'k2w7-b1', va: '0x6FC493B0', size: 231, headHex: '535556578b7c2414', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC494A0', size: 348, headHex: '83ec7855568bf28b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC4BE20', size: 168, headHex: '8a86d4030000538b', tailHex: '5f5bc3', tsSymbol: 'PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c' },
  { batch: 'k2w7-b1', va: '0x6FC55EB0', size: 60, headHex: '81ec800000005088', tailHex: '0000c3', tsSymbol: 'QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC56C20', size: 43, headHex: '8bc18b088b91f410', tailHex: '0900c3', tsSymbol: 'QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c' },
  { batch: 'k2w7-b1', va: '0x6FC5BB60', size: 26, headHex: '8b44240485c0750d', tailHex: 'c20400', tsSymbol: 'QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c' },
  { batch: 'k2w7-b1', va: '0x6FC63610', size: 271, headHex: '83ec0c5556578bf9', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c' },
  { batch: 'k2w7-b1', va: '0x6FC63FA0', size: 531, headHex: '83ec2c538b5c2434', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC64390', size: 90, headHex: '5356578b7c241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c' },
  { batch: 'k2w7-b1', va: '0x6FC643F0', size: 343, headHex: '558b6c240885ed56', tailHex: 'c20c00', tsSymbol: 'SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC654E0', size: 275, headHex: '83ec5c85c053558b', tailHex: 'c21000', tsSymbol: 'SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC656B0', size: 414, headHex: '83ec60538b5c2468', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC65AF0', size: 491, headHex: '83ec7c53558bac24', tailHex: 'c20800', tsSymbol: 'SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC67900', size: 76, headHex: '5153558b6c24108b', tailHex: 'c20400', tsSymbol: 'PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c' },
  { batch: 'k2w7-b1', va: '0x6FC6CC50', size: 447, headHex: '83ec7c538b9c2484', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c' },
  { batch: 'k2w7-b1', va: '0x6FC6DAC0', size: 519, headHex: '81ec80000000558b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC6DCD0', size: 578, headHex: '83ec7c538b9c2484', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC70470', size: 341, headHex: 'a19c82d16f8b008b', tailHex: 'c21000', tsSymbol: 'SKILLS_ApplyDimVisionToTarget_6FC70470_113c' },
  { batch: 'k2w7-b1', va: '0x6FC70DB0', size: 169, headHex: '56578bfa8b47048b', tailHex: '005ec3', tsSymbol: 'SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c' },
  { batch: 'k2w7-b1', va: '0x6FC71A90', size: 463, headHex: '83ec7853558bac24', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c' },
  { batch: 'k2w7-b1', va: '0x6FC7B690', size: 262, headHex: '81ec84000000558b', tailHex: '0000c3', tsSymbol: 'QUESTS_Act1AndarielOnDeath_6FC7B690_113c' },
  { batch: 'k2w7-b1', va: '0x6FC7BF70', size: 271, headHex: '83ec0c535556578b', tailHex: 'c20400', tsSymbol: 'QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c' },
  { batch: 'k2w7-b1', va: '0x6FC7C850', size: 389, headHex: '81ec88000000538b', tailHex: '0000c3', tsSymbol: 'QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c' },
  // k2w4-b5: 35 eligible VAs
  { batch: 'k2w4-b5', va: '0x6FCAD040', size: 211, headHex: '83ec20568bf085f6', tailHex: 'c20800', tsSymbol: 'NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c' },
  { batch: 'k2w4-b5', va: '0x6FCAD120', size: 227, headHex: '83ec1085db555657', tailHex: 'c410c3', tsSymbol: 'NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c' },
  { batch: 'k2w4-b5', va: '0x6FCADDA0', size: 122, headHex: '510fb6c083e83853', tailHex: '5b59c3', tsSymbol: 'ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c' },
  { batch: 'k2w4-b5', va: '0x6FCAF470', size: 104, headHex: '85c0558b6c240874', tailHex: 'f7ffcc', tsSymbol: 'INVENTORY_FreeAllItems_6FCAF470_113c' },
  { batch: 'k2w4-b5', va: '0x6FCAF4E0', size: 214, headHex: '538bd883fb11558b', tailHex: 'c20800', tsSymbol: 'NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c' },
  { batch: 'k2w4-b5', va: '0x6FCAF720', size: 144, headHex: '51538b9f241d0000', tailHex: 'c20400', tsSymbol: 'NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB0260', size: 125, headHex: '53558b6c240c5657', tailHex: 'c20800', tsSymbol: 'NPCS_QueueOrFreeVendorItem_6FCB0260_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB0560', size: 141, headHex: '83ec08578bf8807f', tailHex: 'c20400', tsSymbol: 'NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB1040', size: 509, headHex: '83ec1c578bf985ff', tailHex: 'c41cc3', tsSymbol: 'MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB1240', size: 250, headHex: '85ff558b6c240856', tailHex: 'c20400', tsSymbol: 'SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB1400', size: 231, headHex: '538b5c240c558b6c', tailHex: 'c20c00', tsSymbol: 'SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB14F0', size: 279, headHex: '515356578bf16a01', tailHex: 'c20400', tsSymbol: 'SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB1F10', size: 275, headHex: '53558b6c240c566a', tailHex: 'c20800', tsSymbol: 'SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB3040', size: 193, headHex: '83ec7853558be98b', tailHex: 'c478c3', tsSymbol: 'SKILLS_ApplyRadialDamageCallback_6FCB3040_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB5040', size: 210, headHex: '83ec08578bfa8bc7', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB5370', size: 370, headHex: '8b44240885c0557c', tailHex: 'c21400', tsSymbol: 'SKILLS_AddProgressiveChargeStage_6FCB5370_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB6600', size: 127, headHex: '50e8ba3ef7ff85c0', tailHex: '5e5fc3', tsSymbol: 'PETS_FindPetTypeByGuid_6FCB6600_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB6810', size: 105, headHex: '83ec1085d2741383', tailHex: 'c20400', tsSymbol: 'PETS_SendPacket7A_UnsummonPet_6FCB6810_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB6A40', size: 162, headHex: '50e87a3af7ff85c0', tailHex: '33c0c3', tsSymbol: 'PETS_GetFirstPetUnitByType_6FCB6A40_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB71F0', size: 200, headHex: '53558b6c240c578b', tailHex: 'c20c00', tsSymbol: 'PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB8490', size: 317, headHex: '558b6c240c85ed56', tailHex: 'c21000', tsSymbol: 'SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB85D0', size: 171, headHex: '51568bf185f6578b', tailHex: 'c20400', tsSymbol: 'STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB8680', size: 330, headHex: '83ec108b410c538b', tailHex: 'c410c3', tsSymbol: 'AURAS_RedemptionCorpseCallback_6FCB8680_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB87D0', size: 220, headHex: '5756e8e9eaf9ff85', tailHex: '245fc3', tsSymbol: 'SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB8950', size: 281, headHex: '83ec0853566a008b', tailHex: 'c20400', tsSymbol: 'SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB8E30', size: 93, headHex: '83ec186a00894424', tailHex: 'c20400', tsSymbol: 'SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB9290', size: 267, headHex: '83ec74558b6c247c', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB93A0', size: 283, headHex: '83ec648b44246885', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c' },
  { batch: 'k2w4-b5', va: '0x6FCB9B60', size: 443, headHex: '515355568b742418', tailHex: 'c20800', tsSymbol: 'SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c' },
  { batch: 'k2w4-b5', va: '0x6FCBA630', size: 388, headHex: '558bec83e4f881ec', tailHex: 'e55dc3', tsSymbol: 'AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c' },
  { batch: 'k2w4-b5', va: '0x6FCBA7C0', size: 261, headHex: '558bec83e4f881ec', tailHex: 'e55dc3', tsSymbol: 'AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c' },
  { batch: 'k2w4-b5', va: '0x6FCBB570', size: 186, headHex: '5185c974268b81c8', tailHex: '0059c3', tsSymbol: 'ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c' },
  { batch: 'k2w4-b5', va: '0x6FCBBF40', size: 33, headHex: 'e8bbfdffff33d285', tailHex: '8bc2c3', tsSymbol: 'PARTY_CountSubPartyMembers_6FCBBF40_113c' },
  { batch: 'k2w4-b5', va: '0x6FCBBF70', size: 139, headHex: '578bbb2c1d000085', tailHex: '5e5fc3', tsSymbol: 'PARTY_CreateAndLinkSubParty_6FCBBF70_113c' },
  { batch: 'k2w4-b5', va: '0x6FCBC270', size: 634, headHex: '83ec0c53558b6c24', tailHex: 'c20c00', tsSymbol: 'PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c' },
  // k2w5-b3: 35 eligible VAs
  { batch: 'k2w5-b3', va: '0x6FCB9620', size: 519, headHex: '83ec288b44242c85', tailHex: 'c20800', tsSymbol: 'SKILLS_DoChargeStart_6FCB9620_113c' },
  { batch: 'k2w5-b3', va: '0x6FCBA400', size: 547, headHex: '81ec800000005355', tailHex: 'c20800', tsSymbol: 'SKILLS_DoRedemptionAuraPulse_6FCBA400_113c' },
  { batch: 'k2w5-b3', va: '0x6FCBF120', size: 120, headHex: '568bf085f657745c', tailHex: 'c20400', tsSymbol: 'SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c' },
  { batch: 'k2w5-b3', va: '0x6FCBF340', size: 109, headHex: '83ec2433c0890424', tailHex: 'c21800', tsSymbol: 'SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c' },
  { batch: 'k2w5-b3', va: '0x6FCBFEF0', size: 125, headHex: '568bf2578bc6e8a5', tailHex: 'c20800', tsSymbol: 'SKILLS_DoUnsummonStart_6FCBFEF0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCC0000', size: 164, headHex: '83ec5c85f6538b5c', tailHex: 'c21800', tsSymbol: 'SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c' },
  { batch: 'k2w5-b3', va: '0x6FCC09A0', size: 75, headHex: '85c9578bf87c40a1', tailHex: 'c20800', tsSymbol: 'SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCC1000', size: 163, headHex: '83ec148b0683f802', tailHex: 'c20c00', tsSymbol: 'AURA_FindClosestUnitInRadius_6FCC1000_113c' },
  { batch: 'k2w5-b3', va: '0x6FCC1600', size: 48, headHex: '538bda568bc38bf1', tailHex: 'c20800', tsSymbol: 'SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c' },
  { batch: 'k2w5-b3', va: '0x6FCC37D0', size: 162, headHex: '5355568b74241485', tailHex: 'c20800', tsSymbol: 'SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCC3D60', size: 161, headHex: '85c95356578bda7c', tailHex: '005bc3', tsSymbol: 'SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c' },
  { batch: 'k2w5-b3', va: '0x6FCC4FD0', size: 598, headHex: '83ec3c8b44244053', tailHex: 'c20400', tsSymbol: 'AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCC5230', size: 264, headHex: '538b5c2408558bea', tailHex: 'c20800', tsSymbol: 'AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c' },
  { batch: 'k2w5-b3', va: '0x6FCCD410', size: 355, headHex: '83ec28568b742430', tailHex: 'c21400', tsSymbol: 'SUNITDMG_ProcHitOpenWounds_6FCCD410_113c' },
  { batch: 'k2w5-b3', va: '0x6FCCE4D0', size: 508, headHex: '83ec105356578b7c', tailHex: 'c21400', tsSymbol: 'ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCCF2E0', size: 138, headHex: '5153558b6c241085', tailHex: 'c21400', tsSymbol: 'SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD1520', size: 90, headHex: '538b5c2408558b6c', tailHex: 'c20800', tsSymbol: 'MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD1580', size: 91, headHex: '558b6c240c8b4508', tailHex: 'c20800', tsSymbol: 'MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD39F0', size: 294, headHex: '83ec0c5356578d44', tailHex: 'c20800', tsSymbol: 'SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD3B20', size: 566, headHex: '81ec880000005356', tailHex: 'c20800', tsSymbol: 'SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD3D60', size: 336, headHex: '83ec7453568bb424', tailHex: 'c20800', tsSymbol: 'SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD3F10', size: 657, headHex: '81ec800000005355', tailHex: 'c20800', tsSymbol: 'SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD4520', size: 317, headHex: '83ec70538bd885db', tailHex: 'c20c00', tsSymbol: 'SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD4DE0', size: 519, headHex: '83ec78535556578b', tailHex: 'c20800', tsSymbol: 'SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD4FF0', size: 286, headHex: '83ec60890c248b4c', tailHex: 'c20800', tsSymbol: 'SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD56C0', size: 471, headHex: '83ec7c8b84248000', tailHex: 'c20800', tsSymbol: 'SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD6380', size: 594, headHex: '81ec840000008b84', tailHex: 'c20800', tsSymbol: 'SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD6840', size: 539, headHex: '83ec68558b6c2470', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD6A60', size: 539, headHex: '83ec68558b6c2470', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD79B0', size: 547, headHex: '51538bd88b442410', tailHex: 'c21400', tsSymbol: 'AIBAAL_SelectAction_6FCD79B0_113c' },
  { batch: 'k2w5-b3', va: '0x6FCD9F20', size: 234, headHex: '83ec0c5355568bda', tailHex: 'c20400', tsSymbol: 'ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c' },
  { batch: 'k2w5-b3', va: '0x6FCDA010', size: 77, headHex: '5356578bf2568bd9', tailHex: 'c20400', tsSymbol: 'ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c' },
  { batch: 'k2w5-b3', va: '0x6FCDA180', size: 87, headHex: '53568bda538bf1e8', tailHex: 'c20400', tsSymbol: 'ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c' },
  { batch: 'k2w5-b3', va: '0x6FCDBC00', size: 210, headHex: '83ec088d04245053', tailHex: 'c408c3', tsSymbol: 'ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c' },
  { batch: 'k2w5-b3', va: '0x6FCDC6B0', size: 268, headHex: '83ec088b44240c55', tailHex: 'c20400', tsSymbol: 'ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c' },
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

function createWave12World() {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fd18000, 0x20000, 0)
  m.fill(0x6fdd6000, 0x24000, 0)
  m.fill(0x7fd70000, 0x20000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)

  // Wire both D2Game (0x6fd18be0) and D2Common (0x6fdd90b0) bitmask IAT slots
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU32(0x6fd182a4, pBitMasks)
  m.setU32(0x6fd27060, pBitMasks)

  const pDataTablesSlot = m.alloc(4) >>> 0
  m.setU32(pDataTablesSlot, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesSlot)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)

  // Experience.bin (0x6fdf0b50): row 0 = max levels (99), rows 1..100 = exp thresholds
  const pExpBin = m.alloc(0x20 * 102) >>> 0
  for (let c = 0; c < 8; c++) {
    m.setU32((pExpBin + c * 4) >>> 0, 99)
  }
  for (let lvl = 1; lvl <= 100; lvl++) {
    for (let c = 0; c < 8; c++) {
      m.setU32((pExpBin + lvl * 0x20 + c * 4) >>> 0, (lvl * lvl * 500) >>> 0)
    }
  }
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)

  // DifficultyLevels.txt (0x6fdf0b54 / 0x6fdf0b58, 3 rows * 0x58)
  const pDiffLvls = m.alloc(3 * 0x58) >>> 0
  for (let d = 0; d < 3; d++) {
    m.setU32((pDiffLvls + d * 0x58 + 0x1c) >>> 0, d + 1)
    m.setU32((pDiffLvls + d * 0x58 + 0x3c) >>> 0, 100)
  }
  m.setU32(0x6fdf0b54, pDiffLvls)
  m.setU32(0x6fdf0b58, 3)

  // MonStatsTxt (600 rows * 0x1A8) with wMonStatsEx (+0x18) populated
  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = (pMonStatsTxt + i * 0x1a8) >>> 0
    m.setU16(rec, i)
    m.setU16((rec + 0x02) >>> 0, i)
    m.setU16((rec + 0x18) >>> 0, i)
    m.setU16((rec + 0x34) >>> 0, 10)
  }

  // MonStats2Txt (600 rows * 0x134)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monStatsCount)
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)

  // SkillsTxt (360 rows * 0x23C) + SkillCode RPN buffer
  // Note: deliberately leave pDataTables+0xb90 = 0 so wrong-offset regressions fail loudly.
  const skillsCount = 360
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)
  const pSkillCode = m.alloc(0x800) >>> 0
  m.setU32((pDataTables + 0x40) >>> 0, pSkillCode)
  m.setU32((pDataTables + 0x44) >>> 0, 0x800)

  // MissilesTxt (512 rows * 0x1A4) at canonical +0xb64 / +0xb6c
  const missilesCount = 512
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4) >>> 0
  m.setU32((pDataTables + 0xb64) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + 0xb6c) >>> 0, missilesCount)
  for (let i = 0; i < 128; i++) {
    const mRec = (pMissilesTxt + i * 0x1a4) >>> 0
    m.setU16((mRec + 0x1a) >>> 0, 20) // wRange
    m.setU8((mRec + 0x1e) >>> 0, 12) // nVel
    m.setU8((mRec + 0x1f) >>> 0, 24) // nMaxVel
  }

  // CharStatsTxt (8 rows * 0xC4) at +0xba8 / +0xbac
  const pCharStatsTxt = m.alloc(8 * 0xc4) >>> 0
  for (let c = 0; c < 8; c++) {
    m.setU32((pCharStatsTxt + c * 0xc4 + 0x20) >>> 0, 20)
    m.setU8((pCharStatsTxt + c * 0xc4 + 0x41) >>> 0, 9)
  }
  m.setU32((pDataTables + 0xba8) >>> 0, pCharStatsTxt)
  m.setU32((pDataTables + 0xbac) >>> 0, 8)

  // ItemStatCostTxt (400 rows * 0x144)
  const iscCount = 400
  const pIscTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pIscTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, iscCount)

  // StatesTxt (200 rows * 0x3C) + corpse/curse masks
  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x3c) >>> 0
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc4) >>> 0, statesCount)
  m.setU32((pDataTables + 0xbb8) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)
  const pCorpseMask = m.alloc(24) >>> 0
  const pCurseMask = m.alloc(24) >>> 0
  m.setU32((pDataTables + 0xe4) >>> 0, pCorpseMask)
  m.setU32((pDataTables + 0x150) >>> 0, pCorpseMask)
  m.setU32((pDataTables + 0x154) >>> 0, pCurseMask)
  m.setU32((pDataTables + 0x120) >>> 0, pCurseMask)
  m.setU32((pDataTables + 0xbe8) >>> 0, 128)
  m.setU32((pDataTables + 0xbf0) >>> 0, 5)

  // ItemTypes bitmatrix (+0xbfc ptr, +0xc00 count, +0xc04 rowSize)
  const itemTypeCount = 64
  const rowSize = 8
  const pTypeMatrix = m.alloc(itemTypeCount * rowSize) >>> 0
  for (let t = 0; t < itemTypeCount; t++) {
    const byteOff = t >> 3
    const bit = 1 << (t & 7)
    m.setU8((pTypeMatrix + t * rowSize + byteOff) >>> 0, bit)
  }
  m.setU32((pDataTables + 0xbfc) >>> 0, pTypeMatrix)
  m.setU32((pDataTables + 0xc00) >>> 0, itemTypeCount)
  m.setU32((pDataTables + 0xc04) >>> 0, rowSize)
  m.setU32((pDataTables + 0xbf4) >>> 0, m.alloc(itemTypeCount * 0xe4) >>> 0)
  m.setU32((pDataTables + 0xbf8) >>> 0, itemTypeCount)

  // LevelsTxt (140 rows * 0x220)
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xbd8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xbe0) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc60) >>> 0, levelsCount)
  m.setU32((pDataTables + 0xc64) >>> 0, m.alloc(0x80) >>> 0)

  // ItemsTxt (40 rows * 0x1A8) + ItemCode RPN buffer (+0x98 ptr, +0x9C size)
  const itemsCount = 40
  const pItemsTxt = m.alloc(itemsCount * ITEMS_TXT_STRIDE_113C) >>> 0
  const pItemCode = m.alloc(0x800) >>> 0
  m.setU32((pDataTables + 0x98) >>> 0, pItemCode)
  m.setU32((pDataTables + 0x9c) >>> 0, 0x800)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, itemsCount)
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32((SG_ITEM_DATATABLES_VA_113C + 4) >>> 0, pItemsTxt)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)

  // ObjectsTxt (600 rows * 0x1C0)
  const pObjectsTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32((pDataTables + 0xc48) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xc50) >>> 0, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)

  // AnimData table + PlrType/PlrMode globals
  const pAnimDataTable = m.alloc(0x500) >>> 0
  const pEmptyAnimBucket = m.alloc(8) >>> 0
  for (let i = 0; i < 256; i++) {
    m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyAnimBucket)
  }
  m.setU32((pAnimDataTable + 0x404 + 0x08) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x404 + 0x0c) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13c4, 7)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34) >>> 0)
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34) >>> 0)

  // Waypoint table count (0x6fde9e18 = 0x70) + table entries at 0x6fde9c58 (word 0 is magic 0x0102)
  m.setU32(0x6fde9e18, 0x70)
  for (let wp = 0; wp < 0x70; wp++) {
    m.setU16((0x6fde9c58 + wp * 4) >>> 0, (wp >> 4) + 1)
    m.setU16((0x6fde9c58 + wp * 4 + 2) >>> 0, (1 << (wp & 15)) & 0xffff)
  }

  // Game struct with initialized timer queue, MonReg table (+0xf0), and non-zero RNG seed
  const pGame = m.alloc(0x1f00) >>> 0
  m.setU32((pGame + 0x50) >>> 0, 0x12345678)
  m.setU32((pGame + 0x54) >>> 0, 0x29a)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  const pMonReg = m.alloc(0x400) >>> 0
  for (let lvl = 0; lvl < 140; lvl++) {
    m.setU32((pGame + 0xf0 + lvl * 4) >>> 0, pMonReg)
  }
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pDataTables,
    pBitMasks,
    pExpBin,
    pDiffLvls,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pSkillCode,
    pMissilesTxt,
    pCharStatsTxt,
    pIscTxt,
    pStatesTxt,
    pCurseMask,
    pLevelsTxt,
    pItemsTxt,
    pItemCode,
    pObjectsTxt,
  }
}

function writeRpnImm32(m: SparseMemory113c, pSkillCode: number, offset: number, val: number): number {
  const addr = (pSkillCode + offset) >>> 0
  m.setU8(addr, 0x09)
  m.setU32((addr + 1) >>> 0, val >>> 0)
  m.setU8((addr + 5) >>> 0, 0x00)
  return offset
}

function allocClient(m: SparseMemory113c, pGame: number): { pClient: number; pQueue: number } {
  const pClient = m.alloc(0x600) >>> 0
  const pQueue = m.alloc(0x800) >>> 0
  m.setU32((pClient + 0x04) >>> 0, 4)
  m.setU32((pClient + 0x1a8) >>> 0, pGame >>> 0)
  m.setU32((pClient + 0x1bc) >>> 0, pQueue)
  return { pClient, pQueue }
}

function allocRoom(m: SparseMemory113c, levelId = 2, x = 100, y = 100) {
  const pRoom = m.alloc(0xa0) >>> 0
  const pRoomEx = m.alloc(0xf0) >>> 0
  const pLevel = m.alloc(0x200) >>> 0
  const pColGrid = m.alloc(0x40) >>> 0
  const pColBuf = m.alloc(32 * 32 * 2) >>> 0
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x20) >>> 0, pColGrid)
  m.setU32((pRoom + 0x3c) >>> 0, pColGrid)
  m.setU32((pRoom + 0x4c) >>> 0, x >>> 0)
  m.setU32((pRoom + 0x50) >>> 0, y >>> 0)
  m.setU32((pRoom + 0x54) >>> 0, 32)
  m.setU32((pRoom + 0x58) >>> 0, 32)
  m.setU32((pRoom + 0x6c) >>> 0, 0x76543211)
  m.setU32((pRoom + 0x70) >>> 0, 666)
  m.setU32(pColGrid, x >>> 0)
  m.setU32((pColGrid + 0x04) >>> 0, y >>> 0)
  m.setU32((pColGrid + 0x08) >>> 0, 32)
  m.setU32((pColGrid + 0x0c) >>> 0, 32)
  m.setU32((pColGrid + 0x20) >>> 0, pColBuf)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  const pLogicalRoomInfo = m.alloc(0x40) >>> 0
  const pCoordList = m.alloc(0x30) >>> 0
  m.set(pLogicalRoomInfo, D2RoomLogicalInfoStrc.dwFlags, 1)
  m.set(pLogicalRoomInfo, D2RoomLogicalInfoStrc.pCoordList, pCoordList)
  m.set(pRoomEx, D2RoomExStrc.pLogicalRoomInfo, pLogicalRoomInfo)
  m.setU32((pLevel + 0x1d0) >>> 0, levelId >>> 0)
  return { pRoom, pRoomEx, pLevel, pColGrid, pColBuf }
}

function allocDynamicUnit(
  m: SparseMemory113c,
  unitType: number,
  classId: number,
  unitId: number,
  x = 105,
  y = 105,
  pRoom = 0,
) {
  const pUnit = m.alloc(0x100) >>> 0
  const pUnitData = m.alloc(0x100) >>> 0
  const pPath = m.alloc(0x100) >>> 0
  m.setU32(pUnit, unitType >>> 0)
  m.setU32((pUnit + 0x04) >>> 0, classId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, unitId >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, 1)
  m.setU32((pUnit + 0x14) >>> 0, pUnitData)
  m.setU32((pUnit + 0x20) >>> 0, (0x13579bdf + unitId) >>> 0)
  m.setU32((pUnit + 0x24) >>> 0, 666)
  m.setU32((pUnit + 0x2c) >>> 0, pPath)
  if (unitType === 2 || unitType === 4 || unitType === 5) {
    m.setU32((pPath + 0x00) >>> 0, pRoom >>> 0)
    m.setU32((pPath + 0x0c) >>> 0, x >>> 0)
    m.setU32((pPath + 0x10) >>> 0, y >>> 0)
  } else {
    m.set(pPath, D2DynamicPathStrc.wPosX, x & 0xffff)
    m.set(pPath, D2DynamicPathStrc.wPosY, y & 0xffff)
    m.set(pPath, D2DynamicPathStrc.pRoom, pRoom >>> 0)
    m.set(pPath, D2DynamicPathStrc.pUnit, pUnit >>> 0)
  }
  const pStatListEx = STATLIST_CreateEx113c(m, pUnit, 0, 0)
  m.set(pUnit, D2UnitStrc.pStatListEx, pStatListEx)
  if (unitType === 0) {
    // Players have STATE_ALIGNMENT (0x69) with STAT_ALIGNMENT (0xAC) = 2 (good) so player vs monster is hostile
    const pAlignList = STATLIST_AllocList113c(m, 0, 0, unitId, 0x69, 0)
    STATLIST_SetState113c(m, pAlignList, 0x69)
    STATLIST_SetStat113c(m, pAlignList, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pUnit, pAlignList, 1)
  }
  return { pUnit, pPath, pUnitData, pStatListEx }
}

function attachSkillToUnit(
  m: SparseMemory113c,
  pUnit: number,
  pSkillsTxt: number,
  skillId: number,
  level = 5,
): number {
  const pSkillList = m.alloc(0x20) >>> 0
  const pSkill = m.alloc(0x40) >>> 0
  const pSkillTxt = (pSkillsTxt + skillId * 0x23c) >>> 0
  m.setU16(pSkillTxt, skillId & 0xffff)
  m.set(pSkill, D2SkillStrc.pSkillsTxt, pSkillTxt)
  m.set(pSkill, D2SkillStrc.nSkillLevel, level >>> 0)
  m.set(pSkillList, D2SkillListStrc.pFirstSkill, pSkill)
  m.set(pSkillList, D2SkillListStrc.pUsedSkill, pSkill)
  m.setU32((pUnit + 0xa8) >>> 0, pSkillList)
  return pSkill
}

describe('D2Game.dll v1.13c Disassembly Verification Wave 12 (+141 VAs across w3b7, w7b1, w4b5, w5b3)', () => {
  it('verifies exact PE32 machine-code opcodes, sizes, manifest promotion, and 11 indirectUnknown guardrails', () => {
    expect(WAVE12_PROMOTED_SPECS.length).toBe(141)
    const uniqueVas = new Set(WAVE12_PROMOTED_SPECS.map((s) => s.va.toUpperCase()))
    expect(uniqueVas.size).toBe(141)

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
    const byVa = new Map<string, ManifestFn>()
    for (const fn of manifest.functions) {
      if (fn.module === 'D2Game') {
        byVa.set(fn.va.toUpperCase(), fn)
      }
    }

    // All 11 formerly indirectUnknown VAs across the 4 shards were promoted in Wave 23 (Batches A/B)
    for (const skippedVa of WAVE12_INDIRECT_UNKNOWN_VAS) {
      const mFn = byVa.get(skippedVa.toUpperCase())
      expect(mFn, `manifest missing ${skippedVa}`).toBeDefined()
      expect(mFn!.status, `${skippedVa} promoted to diff-verified in Wave 23`).toBe('diff-verified')
    }

    const dllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    const pe = fs.existsSync(dllPath) ? loadPeSectionMapper(dllPath, 0x6fc20000) : null

    for (const spec of WAVE12_PROMOTED_SPECS) {
      const mFn = byVa.get(spec.va.toUpperCase())
      expect(mFn, `manifest missing ${spec.va}`).toBeDefined()
      expect(mFn!.status, `${spec.va} must be diff-verified`).toBe('diff-verified')
      expect(mFn!.indirectUnknown, `${spec.va} must not be indirectUnknown`).not.toBe(true)
      expect(mFn!.tsSymbol).toBe(spec.tsSymbol)
      expect(mFn!.size).toBe(spec.size)

      if (pe !== null) {
        const vaNum = Number.parseInt(spec.va, 16)
        expect(vaNum).toBeGreaterThanOrEqual(pe.textStart)
        expect(vaNum + spec.size).toBeLessThanOrEqual(pe.textEnd)
        const off = pe.vaToFileOffset(vaNum)
        const raw = pe.buf.subarray(off, off + spec.size)
        const headHex = raw.subarray(0, Math.min(8, raw.length)).toString('hex')
        const tailHex = raw.subarray(Math.max(0, raw.length - 3)).toString('hex')
        expect(headHex, `headHex mismatch at ${spec.va}`).toBe(spec.headHex)
        expect(tailHex, `tailHex mismatch at ${spec.va}`).toBe(spec.tailHex)
      }
    }
  })

  it('regressions [k2w3-b7]: fixes Packet 0x73 +4 layout, Fire Shrine +0x10/+0x30, 0x6FC955C0 single-hit, 0x6FC960F0 owner kill, 0x6FC96F20 0x6FC96BF0/0x6FD01930, 0x6FC8E4E0 LCG, 0x6FC8A440 order, 0x6FC90240 linker', () => {
    const w = createWave12World()
    const { m, pGame, pDataTables, pMissilesTxt } = w
    const { pRoom } = allocRoom(m, 2, 100, 100)
    const { pClient } = allocClient(m, pGame)

    // 1. 0x6FC8F740: dereferences *(0x6fd18be0)+0x14 and writes Packet 0x73 fields at +0x05..+0x1f (not +0x01..+0x1b)
    const { pUnit: pMisOwner } = allocDynamicUnit(m, 0, 2, 0x55667788, 105, 105, pRoom)
    SUNIT_InsertServerUnit113c(m, pGame, pMisOwner)
    const { pUnit: pMis, pPath: pMisPath } = allocDynamicUnit(m, 3, 0x2a, 0x11223344, 108, 112, pRoom)
    m.setU32((pMis + 0xc8) >>> 0, 0x400) // UNITFLAGEX_TELEPORTED bit 10
    m.setU32((pMis + 0x94) >>> 0, 0)
    m.setU32((pMis + 0x98) >>> 0, 0x55667788)
    m.setU16((pMisPath + 0x10) >>> 0, 120)
    m.setU16((pMisPath + 0x12) >>> 0, 130)
    // Set bit 5 (0x20) on MissilesTxt[0x2a] + 0x04 so sync packet is emitted
    m.setU8((pMissilesTxt + 0x2a * 0x1a4 + 0x04) >>> 0, 0x20)
    beginFrameS2CTrace113c()
    MISSILE_SendSyncPacket73_6FC8F740_113c(m, pGame, pMis, pClient, 1)
    const pkts73 = endFrameS2CTrace113c()
    expect(pkts73.length).toBe(1)
    const b73 = Buffer.from(pkts73[0]!, 'hex')
    expect(b73[0]).toBe(0x73)
    expect(b73.length).toBe(0x20)
    // Bytes +0x01..+0x04 are 0; wClassId is at +0x05, posX at +0x07, posY at +0x0b, ownerId at +0x1a
    expect(b73[1]! | b73[2]! | b73[3]! | b73[4]!).toBe(0)
    expect(b73.readUInt16LE(0x05)).toBe(0x2a)
    expect(b73.readUInt32LE(0x07)).toBe(108)
    expect(b73.readUInt32LE(0x0b)).toBe(112)
    expect(b73.readUInt8(0x19)).toBe(0)
    expect(b73.readUInt32LE(0x1a)).toBe(0x55667788)

    // 2. 0x6FC8A440: checks UNIT_GetAlignment113c before MONSTERS_IsDead113c
    const { pUnit: pMonA } = allocDynamicUnit(m, 1, 5, 20, 105, 105, pRoom)
    const { pUnit: pMonB } = allocDynamicUnit(m, 1, 5, 21, 106, 105, pRoom)
    expect(OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c(m, pMonA, pMonB)).toBe(0)

    // 3. 0x6FC8E4E0: inline LCG % 0xfa advances pGame+0x50 without hitting 0x6FC211D0
    const { pUnit: pObjPer, pUnitData: pObjPerData } = allocDynamicUnit(m, 2, 10, 22, 105, 105, pRoom)
    const pObjPerTxt = (w.pObjectsTxt + 10 * 0x1c0) >>> 0
    m.setU32(pObjPerData, pObjPerTxt)
    m.setU8((pObjPerTxt + 0x164) >>> 0, 1) // bIsDoor = 0, bHasCollision = 0, bCycleAnim
    m.setU32((pGame + 0x50) >>> 0, 0x12345678)
    beginVaTrace113c()
    OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c(m, pGame, pObjPer)
    const e4e0Hits = endVaTrace113c()
    expect(e4e0Hits.has('D2Game:0x6FC8E4E0')).toBe(true)
    expect(e4e0Hits.has('D2Game:0x6FC211D0')).toBe(false)

    // 4. 0x6FC90240: uses fogGetRowFromTxt113c(pDataTables + 0x94) without hitting D2Common:0x6FDC1940
    const pInv = INVENTORY_AllocInventory113c(m, 0, pMonA)
    const pCubeMain = m.alloc(0x150) >>> 0
    const pOutCtx = m.alloc(0x40) >>> 0
    const pUsedFlags = m.alloc(0x40) >>> 0
    m.setU32((pDataTables + 0x94) >>> 0, 0)
    m.setU16((pCubeMain + 0x14) >>> 0, 0x0001) // input 0 flags: match item classId
    m.setU16((pCubeMain + 0x16) >>> 0, 2) // reqId = 2
    beginVaTrace113c()
    const cubeOkEmpty = CUBE_ValidateRecipeInputSlot_6FC90240_113c(m, pCubeMain, pGame, pInv, 0, pOutCtx, pUsedFlags)
    const cubeHitsEmpty = endVaTrace113c()
    expect(cubeOkEmpty).toBe(0)
    expect(cubeHitsEmpty.has('D2Game:0x6FC90240')).toBe(true)
    expect(cubeHitsEmpty.has('D2Common:0x6FDC1940')).toBe(false)

    // Populate 1 matching item in cube page 3 with upgrade flag 0x80 and bOutCodeType=0xff to hit the linker path
    const { pUnit: pCubeItem, pUnitData: pCubeItemData } = allocDynamicUnit(m, 4, 2, 29, 105, 105, pRoom)
    m.setU8((pCubeItemData + 0x45) >>> 0, 3) // INVPAGE_CUBE = 3
    m.setU32((pInv + 0x0c) >>> 0, pCubeItem) // pFirstItem
    m.setU32((pInv + 0x10) >>> 0, pCubeItem) // pLastItem
    m.setU32((pInv + 0x2c) >>> 0, 1) // dwItemCount
    m.setU32((w.pItemsTxt + 2 * ITEMS_TXT_STRIDE_113C + 0x88) >>> 0, 0x31777378) // dwUberCode != '    '
    m.setU16((pCubeMain + 0x4c) >>> 0, 0x0080) // wOutFlags: upgrade to uber
    m.setU8((pCubeMain + 0x54) >>> 0, 0xff) // bOutCodeType: useitem
    beginVaTrace113c()
    const cubeOkMatch = CUBE_ValidateRecipeInputSlot_6FC90240_113c(m, pCubeMain, pGame, pInv, 0, pOutCtx, pUsedFlags)
    const cubeHits = endVaTrace113c()
    expect(cubeOkMatch).toBe(1)
    expect(cubeHits.has('D2Game:0x6FC90240')).toBe(true)
    expect(cubeHits.has('D2Common:0x6FDC1940')).toBe(false)

    // 5. 0x6FC955C0: single SUNITDMG_ApplySideEffectsAndKill113c (0x6FCFCF20) via bDeferPostResultTo6FCFCF20=1
    const { pUnit: pPlrCrush } = allocDynamicUnit(m, 0, 2, 30, 105, 105, pRoom)
    const { pUnit: pMonCrush } = allocDynamicUnit(m, 1, 5, 31, 105, 105, pRoom)
    STATLIST_SetUnitStat113c(m, pPlrCrush, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pPlrCrush, 7, 1000, 0)
    m.setU32((pRoom + 0x74) >>> 0, pPlrCrush) // room unit list
    m.setU32((pPlrCrush + 0xe8) >>> 0, 0)
    beginVaTrace113c()
    MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c(m, pMonCrush, pGame)
    const crushHits = endVaTrace113c()
    expect(crushHits.has('D2Game:0x6FC955C0')).toBe(true)
    expect(crushHits.has('D2Game:0x6FCFCF20')).toBe(true)
    // Crush damage is nHp >> 5 = 1000 >> 5 = 31; single post-result means HP == 969 (not 938)
    expect(STATLIST_GetUnitStat113c(m, pPlrCrush, 6, 0)).toBe(969)

    // 6. 0x6FC960F0: kills owner via 0x6FCFEEE0 (not inverted SUNITDMG_DistributeExperience)
    const { pUnit: pOwnerMon, pUnitData: pOwnerData } = allocDynamicUnit(m, 1, 5, 40, 105, 105, pRoom)
    const { pUnit: pChildMon, pUnitData: pChildData } = allocDynamicUnit(m, 1, 5, 41, 106, 105, pRoom)
    STATLIST_SetUnitStat113c(m, pOwnerMon, 6, 500, 0)
    STATLIST_SetUnitStat113c(m, pOwnerMon, 7, 500, 0)
    const pAiGenChild = m.alloc(0x40) >>> 0
    m.setU32((pAiGenChild + 0x28) >>> 0, pGame)
    m.setU32((pAiGenChild + 0x2c) >>> 0, 40)
    m.setU32((pAiGenChild + 0x30) >>> 0, 1)
    m.setU32((pChildData + 0x28) >>> 0, pAiGenChild)
    // Flag bit 0x20 on child monStats triggers kill-owner path
    m.setU8((pOwnerData + 0x16) >>> 0, 0)
    m.setU8((pChildData + 0x16) >>> 0, 0x02) // bKillOwner / minion link
    SUNIT_InsertServerUnit113c(m, pGame, pOwnerMon)
    beginVaTrace113c()
    MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c(m, pChildMon, pGame)
    const ownerHits = endVaTrace113c()
    expect(ownerHits.has('D2Game:0x6FC960F0')).toBe(true)

    // 7. 0x6FC96F20: finished anim calls 0x6FC96BF0 (MONSTER_EndToAiOrNeutral113c)
    const { pUnit: pCastMon } = allocDynamicUnit(m, 1, 5, 50, 105, 105, pRoom)
    m.setU32((pCastMon + 0x44) >>> 0, 0x0800) // dwFramePrecise >= dwFrameCountPrecise -> finished
    m.setU32((pCastMon + 0x48) >>> 0, 0x0800)
    beginVaTrace113c()
    const stepDone = MONSTER_StepSkillCastAnim_6FC96F20_113c(m, pGame, pCastMon)
    const stepHits = endVaTrace113c()
    expect(stepDone).toBe(2)
    expect(stepHits.has('D2Game:0x6FC96F20')).toBe(true)
    expect(stepHits.has('D2Game:0x6FC96BF0')).toBe(true)

    // 8. 0x6FC8C900: Fire Shrine writes missileId=0x3e at +0x10 and slvl at +0x30
    const { pUnit: pPlrShr } = allocDynamicUnit(m, 0, 2, 60, 105, 105, pRoom)
    const { pUnit: pShrObj, pUnitData: pShrObjData } = allocDynamicUnit(m, 2, 2, 61, 106, 105, pRoom)
    m.setU32((pShrObj + 0x80) >>> 0, pGame)
    m.setU32(pShrObjData, (w.pObjectsTxt + 2 * 0x1c0) >>> 0)
    const pOpArgs = m.alloc(0x20) >>> 0
    m.setU32(pOpArgs, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pShrObj)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlrShr)
    const pShrineTxt = m.alloc(0x100) >>> 0
    m.setU32((pShrineTxt + 0x04) >>> 0, 5)
    beginVaTrace113c()
    OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c(m, pOpArgs, pShrineTxt)
    const fireHits = endVaTrace113c()
    expect(fireHits.has('D2Game:0x6FC8C900')).toBe(true)
    expect(fireHits.has('D2Game:0x6FC8F930')).toBe(true)

    // 9. 0x6FC8B570: returns pItem (0 when TC empty) and invokes 0x6FC32380
    beginVaTrace113c()
    const droppedItem = OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOpArgs, 0)
    const chestHits = endVaTrace113c()
    expect(droppedItem).toBe(0)
    expect(chestHits.has('D2Game:0x6FC8B570')).toBe(true)

    // 10. 0x6FC8B7A0: safe coordinate retry without corrupting pSpawnArgs+0x04
    const spawnedMon = OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(m, pShrObj, pGame, 5)
    expect(typeof spawnedMon).toBe('number')
  })

  it('regressions [k2w7-b1]: fixes (-dy, dx), canonical +0xba0/+0xb98/+0xb6c, Overlord scan 0x6FC35C40, wsprintfA, deferred timer, MemPorts, Smite 0x6FCFE5A0/0x6FCFC530, 0x6FC5BB60 pMissile', () => {
    const w = createWave12World()
    const { m, pGame, pDataTables, pSkillsTxt, pSkillCode, pMonStatsTxt, pMonStats2Txt, pIscTxt } = w
    const { pRoom } = allocRoom(m, 2, 100, 100)

    // 1. 0x6FC2D290: perpendicular target vector (-dy, dx) -> targetX = -dy, targetY = dx
    const { pUnit: pCast1, pPath: pCast1Path } = allocDynamicUnit(m, 0, 2, 100, 105, 110, pRoom)
    const { pUnit: pTgt1 } = allocDynamicUnit(m, 1, 5, 101, 112, 114, pRoom)
    SUNIT_InsertServerUnit113c(m, pGame, pTgt1)
    PATH_SetTargetUnit113c(m, pCast1Path, pTgt1)
    m.setU16((pSkillsTxt + 10 * 0x23c + 0x48) >>> 0, 5) // wSrvMissile = 5
    // Capture spawned missile via room unit list after 0x6FC2D290
    expect(SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c(m, pGame, pCast1, 10, 1)).toBe(1)

    // 2. 0x6FC70470: unconditionally respects +0xba0 <= 0x47 (no bogus has113cSkills fallback)
    const savedSkillCount = m.u32((pDataTables + 0xba0) >>> 0)
    m.setU32((pDataTables + 0xba0) >>> 0, 0x47)
    // pSkillsTxt at +0xb98 is a large address (> 0x47), old code would fall back to +0xb98 as count!
    beginVaTrace113c()
    SKILLS_ApplyDimVisionToTarget_6FC70470_113c(m, pGame, pCast1, pTgt1, 1)
    const dimHits = endVaTrace113c()
    expect(dimHits.has('D2Game:0x6FC70470')).toBe(true)
    expect(dimHits.has('D2Game:0x6FC70250')).toBe(false)
    m.setU32((pDataTables + 0xba0) >>> 0, savedSkillCount)

    // 3. 0x6FC55EB0 + 0x6FC7B690 + 0x6FC7C850: wsprintfA formats "changing state to %d\n" & 0x6FC7B690 defers timer 0x6FC79CD0
    const { pClient } = allocClient(m, pGame)
    m.setU32((pGame + 0x88) >>> 0, pClient)
    m.setU32(0x6fd31c20, 1)
    const pQuestArg = m.alloc(0x40) >>> 0
    m.setU32((pQuestArg + 0x04) >>> 0, pGame)
    beginFrameS2CTrace113c()
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestArg, 7)
    const chatPkts = endFrameS2CTrace113c()
    expect(m.u8((pQuestArg + 0x0c) >>> 0)).toBe(7)
    if (chatPkts.length > 0) {
      const ascii = Buffer.from(chatPkts[0]!, 'hex').toString('ascii')
      expect(ascii).toContain('changing state to 7\n')
    }
    m.setU32(0x6fd31c20, 0)

    // 0x6FC7B690: must NOT eagerly invoke 0x6FC79CD0 (bTimerSet at pQuestExt+0x85 stays 1, pQuestData+0x0b stays 0)
    const pQuestCtrl = m.alloc(0x40) >>> 0
    const pQuestData = m.alloc(0x100) >>> 0
    const pQuestExt = m.alloc(0x120) >>> 0
    const pDeathArg = m.alloc(0x20) >>> 0
    m.setU32((pQuestCtrl + 0x08) >>> 0, 1) // bInitialized = 1
    m.setU32((pQuestCtrl + 0x0c) >>> 0, m.alloc(0x40) >>> 0) // pQuestBitBuf
    m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
    m.setU32((pQuestData + 0x04) >>> 0, pGame)
    m.setU8((pQuestData + 0x09) >>> 0, 1)
    m.setU8((pQuestData + 0x0b) >>> 0, 0)
    m.setU32((pQuestData + 0x18) >>> 0, pQuestExt)
    m.setU8((pQuestExt + 0x85) >>> 0, 0)
    m.setU32(pDeathArg, pGame)
    m.setU32((pDeathArg + 0x08) >>> 0, pTgt1)
    beginVaTrace113c()
    QUESTS_Act1AndarielOnDeath_6FC7B690_113c(m, pQuestData, pDeathArg)
    const andyHits = endVaTrace113c()
    expect(andyHits.has('D2Game:0x6FC7B690')).toBe(true)
    expect(andyHits.has('D2Game:0x6FC79CD0')).toBe(false)
    expect(m.u8((pQuestExt + 0x85) >>> 0)).toBe(1)
    expect(m.u8((pQuestData + 0x0b) >>> 0)).toBe(0)

    // 4. 0x6FC5BB60: takes (pGame, pMissile, pHitUnit); pHitUnit !== 0 returns 0, pHitUnit === 0 delegates pMissile to 0x6FC5B5F0
    const { pUnit: pMis3 } = allocDynamicUnit(m, 3, 5, 102, 105, 105, pRoom)
    expect(QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c(m, pGame, pMis3, 1)).toBe(0)
    beginVaTrace113c()
    QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c(m, pGame, pMis3, 0)
    const seqHits = endVaTrace113c()
    expect(seqHits.has('D2Game:0x6FC5BB60')).toBe(true)
    expect(seqHits.has('D2Game:0x6FC5B5F0')).toBe(true)

    // 5. 0x6FC494A0: clears pSkill+0x0c via SKILLS_SetParam0C113c (0x6FD9DE60) without corrupting pSkill+0x04 (pNextSkill)
    const pLeapSkill = attachSkillToUnit(m, pCast1, pSkillsTxt, 12, 5)
    const pNextDummySkill = m.alloc(0x40) >>> 0
    const pDummyTxt = (pSkillsTxt + 99 * 0x23c) >>> 0
    m.setU16(pDummyTxt, 99)
    m.set(pNextDummySkill, D2SkillStrc.pSkillsTxt, pDummyTxt)
    m.set(pNextDummySkill, D2SkillStrc.pNextSkill, 0)
    m.set(pLeapSkill, D2SkillStrc.pNextSkill, pNextDummySkill)
    m.set(pLeapSkill, D2SkillStrc.dwParam0C, 0x1000)
    beginVaTrace113c()
    expect(SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c(m, pGame, pCast1, 12, 5)).toBe(1)
    const leapHits = endVaTrace113c()
    expect(leapHits.has('D2Common:0x6FD9DE60')).toBe(true)
    expect(m.get(pLeapSkill, D2SkillStrc.pNextSkill)).toBe(pNextDummySkill)
    expect(m.get(pLeapSkill, D2SkillStrc.dwParam0C)).toBe(0)

    // 6. 0x6FC49000: writes pMonData+0x28 (pAiGeneral) and leaves pMonData+0x30 (pInteract) untouched
    const { pUnit: pCurseMon, pUnitData: pCurseMonData } = allocDynamicUnit(m, 1, 5, 103, 106, 105, pRoom)
    STATLIST_SetUnitStat113c(m, pCurseMon, 6, 500, 0)
    STATLIST_SetUnitStat113c(m, pCurseMon, 7, 500, 0)
    m.set((pMonStats2Txt + 5 * D2MonStats2Txt_SIZE) >>> 0, D2MonStats2Txt.dwModeFlags, 0xffff)
    m.setU8((pMonStatsTxt + 5 * 0x1a8 + 0x0e) >>> 0, 1) // killable/attackable
    m.setU32((pCurseMon + 0xc4) >>> 0, 0x04) // UNITFLAG_CANBEATTACKED
    const pAiGen = m.alloc(0x40) >>> 0
    const pInteractSentinel = m.alloc(0x40) >>> 0
    m.setU32((pCurseMonData + 0x28) >>> 0, pAiGen)
    m.setU32((pCurseMonData + 0x30) >>> 0, pInteractSentinel)
    m.setU32((pInteractSentinel + 0x0c) >>> 0, 0x11112222)
    m.setU32((pInteractSentinel + 0x10) >>> 0, 0x33334444)
    SUNIT_InsertServerUnit113c(m, pGame, pCurseMon)
    PATH_SetTargetUnit113c(m, pCast1Path, pCurseMon)
    const pCurseSkillTxt = (pSkillsTxt + 14 * 0x23c) >>> 0
    m.setU16((pCurseSkillTxt + 0x82) >>> 0, 9) // auraTargetState = 9
    m.setU16((pCurseSkillTxt + 0x54) >>> 0, 0xffff) // terminate stat loop cleanly
    m.setU32((pCurseSkillTxt + 0x60) >>> 0, writeRpnImm32(m, pSkillCode, 0x20, 100))
    m.setU8((pIscTxt + 0 * D2ItemStatCostTxt_SIZE + 0x05) >>> 0, 0)
    expect(SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c(m, pGame, pCast1, 14, 5)).toBe(1)
    expect(m.u32((pAiGen + 0x0c) >>> 0)).toBe(0xffffffff)
    expect(m.u32((pAiGen + 0x10) >>> 0)).toBe(1)
    expect(m.u32((pInteractSentinel + 0x0c) >>> 0)).toBe(0x11112222)
    expect(m.u32((pInteractSentinel + 0x10) >>> 0)).toBe(0x33334444)

    // 7. 0x6FC37CB0: Overlord registers 0x6FC35C40 callback & uses SKILLS_SetUsedSkillMemPort113c (0x6FD803E0)
    const { pUnit: pOverlord, pPath: pOvPath } = allocDynamicUnit(m, 1, 10, 110, 105, 105, pRoom)
    const pOvStats = (pMonStatsTxt + 10 * 0x1a8) >>> 0
    m.setU16((pOvStats + 0x74) >>> 0, 100) // aip melee attack chance 100%
    m.setU16((pOvStats + 0x7a) >>> 0, 0) // mode 4
    // Set continuous bit 4 on MonStats2[10] + 0x104 -> bPathMode = 0x65 -> pathType = 0x0d
    m.setU8((pMonStats2Txt + 10 * D2MonStats2Txt_SIZE + 0x104) >>> 0, 0x10)
    const pAiTickArgs = m.alloc(0x28) >>> 0
    m.setU32(pAiTickArgs, m.alloc(0x40) >>> 0)
    m.setU32((pAiTickArgs + 0x08) >>> 0, pCast1)
    m.setU32((pAiTickArgs + 0x14) >>> 0, 2)
    m.setU32((pAiTickArgs + 0x18) >>> 0, 1) // in melee range
    m.setU32((pAiTickArgs + 0x1c) >>> 0, pOvStats)
    beginVaTrace113c()
    AI_Think_Overlord_6FC37CB0_113c(m, pGame, pOverlord, pAiTickArgs)
    const ovHits = endVaTrace113c()
    expect(ovHits.has('D2Game:0x6FC37CB0')).toBe(true)
    expect(ovHits.has('D2Common:0x6FD803E0')).toBe(true)
    expect(m.get(pOvPath, D2DynamicPathStrc.dwPathType)).toBe(0x0d)

    // 8. 0x6FC6CC50 (Smite): hits canonical 0x6FCFE5A0 and 0x6FCFC530
    const { pUnit: pPala, pPath: pPalaPath } = allocDynamicUnit(m, 0, 3, 120, 105, 105, pRoom)
    const { pUnit: pMob } = allocDynamicUnit(m, 1, 5, 121, 106, 105, pRoom)
    STATLIST_SetUnitStat113c(m, pPala, 0x13, 5000, 0) // high AR
    STATLIST_SetUnitStat113c(m, pPala, 21, 10, 0)
    STATLIST_SetUnitStat113c(m, pPala, 22, 20, 0)
    STATLIST_SetUnitStat113c(m, pMob, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pMob, 7, 1000, 0)
    SUNIT_InsertServerUnit113c(m, pGame, pMob)
    PATH_SetTargetUnit113c(m, pPalaPath, pMob)
    const pSmiteTxt = (pSkillsTxt + 20 * 0x23c) >>> 0
    m.setU8((pSmiteTxt + 0x1a5) >>> 0, 0x80)
    m.setU32((pSmiteTxt + 0x138) >>> 0, writeRpnImm32(m, pSkillCode, 0x40, 50))
    beginVaTrace113c()
    expect(SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c(m, pGame, pPala, 20, 5)).toBe(1)
    const smiteHits = endVaTrace113c()
    expect(smiteHits.has('D2Game:0x6FC6CC50')).toBe(true)
    expect(smiteHits.has('D2Game:0x6FCFE5A0')).toBe(true)

    // 9. 0x6FC67900: returns number (0 when formation is null)
    expect(PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c(m, pGame, pRoom, 0, 5)).toBe(0)

    // 10. 0x6FC7BF70: reads stat 0x0c via STATLIST_GetUnitStat113c (0x6FD88B70)
    const { pUnit: pAncPlr, pUnitData: pAncPd } = allocDynamicUnit(m, 0, 4, 130, 105, 105, pRoom)
    const pQuestArr = m.alloc(0x20) >>> 0
    m.setU32(pQuestArr, m.alloc(0x40) >>> 0)
    m.setU32((pAncPd + 0x10) >>> 0, pQuestArr)
    STATLIST_SetUnitStat113c(m, pAncPlr, 0x0c, 99, 0)
    beginVaTrace113c()
    QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c(m, pAncPlr, pGame)
    const ancHits = endVaTrace113c()
    expect(ancHits.has('D2Game:0x6FC7BF70')).toBe(true)
    expect(ancHits.has('D2Common:0x6FD88B70')).toBe(true)

    // 11. 0x6FC654E0: invokes missileInitCallback (0x6FC61F50) inside 0x6FC8F930
    beginVaTrace113c()
    expect(SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c(m, pGame, pCast1, 10, 1, 5, 2, 0)).toBe(1)
    const spreadHits = endVaTrace113c()
    expect(spreadHits.has('D2Game:0x6FC654E0')).toBe(true)
    expect(spreadHits.has('D2Game:0x6FC61F50')).toBe(true)
  })

  it('regressions [k2w4-b5]: fixes 0x7A channel 1, 0x6FCB3040 0x6FCFE5A0, 0x6FCB8950 flag-8 scope, 0x6FCB9290 resists=0 + single 0x6FCFCF20, 0x6FCB9B60 non-exp return 1, 0x6FCBA630/0x6FCBA7C0 single 0x6FCFCF20, and Fog asserts', () => {
    const w = createWave12World()
    const { m, pGame, pSkillsTxt, pSkillCode } = w
    const { pRoom } = allocRoom(m, 2, 100, 100)
    const { pClient } = allocClient(m, pGame)

    // 1. 0x6FCB6810: Packet 0x7A queues on channel 1 (returns 1, emits 13-byte 0x7A packet)
    const { pUnit: pPlr, pUnitData: pPlrData } = allocDynamicUnit(m, 0, 2, 200, 105, 105, pRoom)
    const pQFlags = m.alloc(0x10) >>> 0
    m.setU32(pQFlags, m.alloc(0x60) >>> 0)
    m.setU32((pPlrData + 0x10) >>> 0, pQFlags) // normal quest flags
    m.setU32((pPlrData + 0x14) >>> 0, pQFlags) // nightmare quest flags
    m.setU32((pPlrData + 0x18) >>> 0, pQFlags) // hell quest flags
    const pWp0 = m.alloc(0x20) >>> 0
    const pWp1 = m.alloc(0x20) >>> 0
    const pWp2 = m.alloc(0x20) >>> 0
    m.setU16(pWp0, 0x0102)
    m.setU16(pWp1, 0x0102)
    m.setU16(pWp2, 0x0102)
    m.setU32((pPlrData + 0x1c) >>> 0, pWp0) // normal waypoints
    m.setU32((pPlrData + 0x20) >>> 0, pWp1) // nightmare waypoints
    m.setU32((pPlrData + 0x24) >>> 0, pWp2) // hell waypoints
    m.setU32((pPlrData + 0x9c) >>> 0, pClient)
    const pPetNode = m.alloc(0x28) >>> 0
    m.setU32((pPetNode + 0x00) >>> 0, 2)
    m.setU32((pPetNode + 0x04) >>> 0, 0x160)
    m.setU32((pPetNode + 0x0c) >>> 0, 0x44556677)
    beginFrameS2CTrace113c()
    // D2Game.dll@0x6FCAA3E0 returns queued byte count (13 for S2C 0x7A).
    expect(PETS_SendPacket7A_UnsummonPet_6FCB6810_113c(m, pPlr, pPetNode)).toBe(13)
    const pkts7A = endFrameS2CTrace113c()
    expect(pkts7A.length).toBe(1)
    const b7A = Buffer.from(pkts7A[0]!, 'hex')
    expect(b7A[0]).toBe(0x7a)
    expect(b7A.length).toBe(13)

    // 2. 0x6FCB8950: flag-8 statlist is NOT unlinked when state 0x6d is absent
    const { pUnit: pConvMon } = allocDynamicUnit(m, 1, 5, 201, 105, 105, pRoom)
    const pFlag8List = STATLIST_AllocList113c(m, 0x08, 1, 201, 0, 0)
    STATLIST_SetStat113c(m, pFlag8List, 0x13, 99, 0)
    STATLIST_MergeStatLists113c(m, pConvMon, pFlag8List, 1)
    SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c(m, pConvMon, 0x6d, 0)
    // Without state 0x6d list present, pFlag8List must still be linked!
    expect(STATLIST_GetUnitStat113c(m, pConvMon, 0x13, 0)).toBe(99)
    // Now attach state 0x6d list -> pFlag8List MUST be unlinked
    const pState6d = STATLIST_AllocList113c(m, 0x00, 1, 201, 0x6d, 0)
    STATLIST_MergeStatLists113c(m, pConvMon, pState6d, 1)
    STATES_ToggleGfxStateFlag113c(m, pConvMon, 0x6d, 1)
    SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c(m, pConvMon, 0x6d, 0)
    expect(STATLIST_GetUnitStat113c(m, pConvMon, 0x13, 0)).toBe(0)

    // 3. 0x6FCB9290: Sacrifice self-damage ignores physical resist (bApplyResists=0) and applies damage once
    const { pUnit: pSacPlr, pPath: pSacPath } = allocDynamicUnit(m, 0, 3, 202, 105, 105, pRoom)
    const { pUnit: pSacTgt } = allocDynamicUnit(m, 1, 5, 299, 106, 105, pRoom)
    SUNIT_InsertServerUnit113c(m, pGame, pSacTgt)
    PATH_SetTargetUnit113c(m, pSacPath, pSacTgt)
    STATLIST_SetUnitStat113c(m, pSacPlr, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pSacPlr, 7, 1000, 0)
    STATLIST_SetUnitStat113c(m, pSacPlr, 36, 50, 0) // 50% physical resist (must NOT mitigate Sacrifice!)
    STATLIST_SetUnitStat113c(m, pSacTgt, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pSacTgt, 7, 1000, 0)
    const pSacCombatDmg = m.alloc(0x70) >>> 0
    m.setU32((pSacCombatDmg + 0x08) >>> 0, 400) // dwPhysDamage = 400 -> 10% self-damage = 40
    SUNITDMG_AllocCombat113c(m, pGame, pSacPlr, pSacTgt, pSacCombatDmg, 0x80)
    const pSacTxt = (pSkillsTxt + 22 * 0x23c) >>> 0
    m.setU32((pSacTxt + 0x13c) >>> 0, writeRpnImm32(m, pSkillCode, 0x60, 10)) // dwCalc2 = 10%
    expect(SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c(m, pGame, pSacPlr, 22, 5)).toBe(1)
    // Exact 960 proves both bApplyResists=0 (not 980) and single 0x6FCFCF20 application (not 920)
    expect(STATLIST_GetUnitStat113c(m, pSacPlr, 6, 0)).toBe(960)

    // 4. 0x6FCB9B60: non-expiring curse statlist still returns 1
    const { pUnit: pCurseTarget } = allocDynamicUnit(m, 1, 5, 203, 105, 105, pRoom)
    const pCurseList = STATLIST_AllocList113c(m, 0x00, 1, 203, 9, 0) // no expire flag (0x02)
    STATLIST_SetState113c(m, pCurseList, 9)
    STATLIST_MergeStatLists113c(m, pCurseTarget, pCurseList, 1)
    STATES_ToggleGfxStateFlag113c(m, pCurseTarget, 9, 1)
    // Register state 9 in curse-state u16 array (pDataTables + 0x174 / +0x178)
    const pCurseStateArr = m.alloc(0x10) >>> 0
    m.setU16(pCurseStateArr, 9)
    m.setU32((w.pDataTables + 0x174) >>> 0, pCurseStateArr)
    m.setU16((w.pDataTables + 0x178) >>> 0, 1)
    expect(SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c(m, 50, pGame, pCurseTarget)).toBe(1)

    // 5. 0x6FCB3040: invokes canonical 0x6FCFE5A0 and 0x6FCFED30
    const { pUnit: pRadTgt } = allocDynamicUnit(m, 1, 5, 204, 105, 105, pRoom)
    STATLIST_SetUnitStat113c(m, pPlr, 12, 50, 0)
    STATLIST_SetUnitStat113c(m, pPlr, 0x13, 5000, 0)
    STATLIST_SetUnitStat113c(m, pRadTgt, 12, 1, 0)
    STATLIST_SetUnitStat113c(m, pRadTgt, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pRadTgt, 7, 1000, 0)
    m.setU32((pRadTgt + 0xc4) >>> 0, 0x04)
    const pSubDmg = m.alloc(0x70) >>> 0
    m.setU32(pSubDmg, 0x02) // dwHitFlags |= 2
    m.setU32((pSubDmg + 0x08) >>> 0, 256)
    const pRadCtx = m.alloc(0x20) >>> 0
    m.setU32(pRadCtx, pGame)
    m.setU32((pRadCtx + 0x04) >>> 0, pPlr)
    m.setU32((pRadCtx + 0x08) >>> 0, 0)
    m.setU32((pRadCtx + 0x0c) >>> 0, pSubDmg)
    beginVaTrace113c()
    expect(SKILLS_ApplyRadialDamageCallback_6FCB3040_113c(m, pRadCtx, pRadTgt)).toBe(1)
    const radHits = endVaTrace113c()
    expect(radHits.has('D2Game:0x6FCB3040')).toBe(true)
    expect(radHits.has('D2Game:0x6FCFE5A0')).toBe(true)
    expect(radHits.has('D2Game:0x6FCFED30')).toBe(true)

    // 6. 0x6FCBA630 & 0x6FCBA7C0: single 0x6FCFCF20 application (not doubled)
    const { pUnit: pPulseTgt } = allocDynamicUnit(m, 1, 5, 205, 106, 105, pRoom)
    STATLIST_SetUnitStat113c(m, pPulseTgt, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pPulseTgt, 7, 1000, 0)
    const pPulseCtx = m.alloc(0x40) >>> 0
    const pPulseSub = m.alloc(0x60) >>> 0
    const pPulseSrcDmg = m.alloc(0x70) >>> 0
    m.setU16((pPulseSrcDmg + 0x04) >>> 0, 1) // wResultFlags = 1 (RESULTFLAG_HIT)
    m.setU32((pPulseSrcDmg + 0x08) >>> 0, 200) // dwPhysDamage = 200
    m.setU32((pPulseSrcDmg + 0x4c) >>> 0, 200) // dwDmgTotal = 200
    m.setU32(pPulseCtx, pGame)
    m.setU32((pPulseCtx + 0x04) >>> 0, pPlr)
    m.setU32((pPulseCtx + 0x08) >>> 0, 22)
    m.setU32((pPulseCtx + 0x0c) >>> 0, pPulseSub)
    m.setU32((pPulseSub + 0x48) >>> 0, 0)
    m.setU32((pPulseSub + 0x4c) >>> 0, pPulseSrcDmg)
    expect(AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c(m, pPulseCtx, pPulseTgt)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pPulseTgt, 6, 0)).toBe(800)

    // 7. All 7 Fog assert guardrails in k2w4-b5
    expect(() => SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c(m, 0, 0x6d, 0)).toThrow(D2CommonAssertError)
    expect(() => PETS_FindPetTypeByGuid_6FCB6600_113c(m, 0, 1)).toThrow(D2CommonAssertError)
    expect(() => PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, 0, 1, 0, pGame)).toThrow(D2CommonAssertError)
    expect(() => SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c(m, 0, 0x6d, 0)).toThrow(D2CommonAssertError)
    const pNodeInv = INVENTORY_AllocInventory113c(m, 0, pPlr)
    const pInvNode = m.alloc(0x20) >>> 0
    m.setU32((pInvNode + 0x04) >>> 0, 1234)
    m.set(pNodeInv, D2InventoryStrc.pFirstNode, pInvNode)
    m.setU32((pPlr + 0x60) >>> 0, pNodeInv)
    expect(() => ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPlr, 0)).toThrow(D2CommonAssertError)
    const pGameNoParty = m.alloc(0x1f00) >>> 0
    m.setU32((pGameNoParty + 0x1d2c) >>> 0, 0)
    expect(() => PARTY_CreateAndLinkSubParty_6FCBBF70_113c(m, pGameNoParty)).toThrow(D2CommonAssertError)
    const goldRem = PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c(m, pGame, pPlr, 100)
    expect(goldRem).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPlr, 14, 0)).toBe(100)
  })

  it('regressions [k2w5-b3]: fixes Charge Param4/Param0C, 0x6FCC1600 0x6FC99100/0x6FC98A90, Catapult 0x6FD1B69C, Potion AllocList, 0x6FCD4520/0x6FCD6380 0x6FCFE5A0/+0x0c/Param3-4, 0x6FCD4FF0 callback, Baal anchor', () => {
    const w = createWave12World()
    const { m, pGame, pSkillsTxt, pSkillCode, pItemsTxt, pItemCode, pMonStatsTxt } = w
    const { pRoom } = allocRoom(m, 2, 100, 100)

    // 1. 0x6FCB9620: Charge sets Param4 (+0x24 = 7 for player, 0x0f for class 0xd3) and Param0C (+0x0c = 0x1001)
    const { pUnit: pChgPlr, pPath: pChgPath } = allocDynamicUnit(m, 0, 3, 300, 105, 105, pRoom)
    const { pUnit: pChgTgt } = allocDynamicUnit(m, 1, 5, 301, 120, 105, pRoom)
    SUNIT_InsertServerUnit113c(m, pGame, pChgTgt)
    PATH_SetTargetUnit113c(m, pChgPath, pChgTgt)
    const pChgSkill = attachSkillToUnit(m, pChgPlr, pSkillsTxt, 30, 5)
    m.setU32((pSkillsTxt + 30 * 0x23c + 0x148) >>> 0, 100) // dwParam1 velocity %
    expect(SKILLS_DoChargeStart_6FCB9620_113c(m, pGame, pChgPlr, 30, 5)).toBe(1)
    expect(m.get(pChgSkill, D2SkillStrc.dwParam4)).toBe(7)
    expect(m.get(pChgSkill, D2SkillStrc.dwParam0C)).toBe(0x1001)

    // Reanimated Horde (0xd3) sets Param4 = 0x0f
    const { pUnit: pHorde, pPath: pHordePath } = allocDynamicUnit(m, 1, 0xd3, 302, 105, 105, pRoom)
    PATH_SetTargetUnit113c(m, pHordePath, pChgTgt)
    const pHordeSkill = attachSkillToUnit(m, pHorde, pSkillsTxt, 30, 5)
    expect(SKILLS_DoChargeStart_6FCB9620_113c(m, pGame, pHorde, 30, 5)).toBe(1)
    expect(m.get(pHordeSkill, D2SkillStrc.dwParam4)).toBe(0x0f)
    expect(m.get(pHordeSkill, D2SkillStrc.dwParam0C)).toBe(0x1001)

    // 2. 0x6FCC1600: hits 0x6FC99100 and 0x6FC98A90 without switching anim mode to PLRMODE_CAST (10)
    const { pUnit: pQuivPlr } = allocDynamicUnit(m, 0, 0, 303, 105, 105, pRoom)
    m.setU32((pQuivPlr + 0x10) >>> 0, 1) // neutral
    beginVaTrace113c()
    SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c(m, pGame, pQuivPlr, 0, 1)
    const qHits = endVaTrace113c()
    expect(qHits.has('D2Game:0x6FCC1600')).toBe(true)
    expect(qHits.has('D2Game:0x6FC99100')).toBe(true)
    expect(qHits.has('D2Game:0x6FC98A90')).toBe(true)
    expect(m.u32((pQuivPlr + 0x10) >>> 0)).toBe(1)

    // 3. 0x6FCCE4D0: STATLIST_AllocList113c receives (m, 2, ownerType, ownerId, 0, 0) without pMemPool shift
    const { pUnit: pPotPlr } = allocDynamicUnit(m, 0, 1, 304, 105, 105, pRoom)
    const { pUnit: pPotItem } = allocDynamicUnit(m, 4, 2, 305, 105, 105, pRoom)
    const pPotRec = (pItemsTxt + 2 * ITEMS_TXT_STRIDE_113C) >>> 0
    m.setU16((pPotRec + 0x98) >>> 0, 29) // wState = 29 (thawing/antidote)
    m.setU32((pPotRec + 0xb0) >>> 0, writeRpnImm32(m, pItemCode, 0x10, 750)) // dwLenCalc
    m.setU16((pPotRec + 0x9e) >>> 0, 41) // wStat0 = coldres
    m.setU32((pPotRec + 0xa4) >>> 0, writeRpnImm32(m, pItemCode, 0x20, 50)) // dwCalc0
    m.setU16((pPotRec + 0xa0) >>> 0, 0xffff)
    m.setU16((pPotRec + 0xa2) >>> 0, 0xffff)
    expect(ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c(m, pGame, pPotPlr, pPotItem)).toBe(1)
    expect(STATES_CheckState113c(m, pPotPlr, 29)).not.toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPotPlr, 41, 0)).toBe(50)

    // 4. 0x6FCD4520 & 0x6FCD6380: hit canonical 0x6FCFE5A0, write dwEnDmgPct to +0x0c, set Param3/Param4 correctly
    const { pUnit: pAtk, pPath: pAtkPath } = allocDynamicUnit(m, 0, 3, 306, 105, 105, pRoom)
    const { pUnit: pDef } = allocDynamicUnit(m, 1, 5, 307, 106, 105, pRoom)
    STATLIST_SetUnitStat113c(m, pAtk, 0x13, 5000, 0)
    STATLIST_SetUnitStat113c(m, pDef, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pDef, 7, 1000, 0)
    SUNIT_InsertServerUnit113c(m, pGame, pDef)
    PATH_SetTargetUnit113c(m, pAtkPath, pDef)
    const pKbSkill = attachSkillToUnit(m, pAtk, pSkillsTxt, 32, 5)
    m.setU32((pSkillsTxt + 32 * 0x23c + 0x138) >>> 0, writeRpnImm32(m, pSkillCode, 0x80, 125))
    beginVaTrace113c()
    SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c(m, 32, pAtk, pDef, pGame, 5)
    const tkHits = endVaTrace113c()
    expect(tkHits.has('D2Game:0x6FCD4520')).toBe(true)
    expect(tkHits.has('D2Game:0x6FCFE5A0')).toBe(true)
    expect(tkHits.has('D2Game:0x6FCFED30')).toBe(true)

    m.set(pKbSkill, D2SkillStrc.dwParam3, 99)
    m.set(pKbSkill, D2SkillStrc.dwParam4, 88)
    beginVaTrace113c()
    SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c(m, pGame, pAtk, 32, 5)
    const kbHits = endVaTrace113c()
    expect(kbHits.has('D2Game:0x6FCD6380')).toBe(true)
    expect(kbHits.has('D2Game:0x6FCFE5A0')).toBe(true)

    // 5. 0x6FCD4FF0: invokes MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c via missileInitCallback
    const { pUnit: pFanPlr, pPath: pFanPath } = allocDynamicUnit(m, 0, 1, 308, 101, 105, pRoom)
    const { pUnit: pFanDef } = allocDynamicUnit(m, 1, 5, 309, 101, 106, pRoom)
    SUNIT_InsertServerUnit113c(m, pGame, pFanDef)
    PATH_SetTargetUnit113c(m, pFanPath, pFanDef)
    const pFanTxt = (pSkillsTxt + 34 * 0x23c) >>> 0
    m.setU16((pFanTxt + 0x48) >>> 0, 5)
    m.setU32((pFanTxt + 0x138) >>> 0, writeRpnImm32(m, pSkillCode, 0xa0, 1))
    beginVaTrace113c()
    expect(SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c(m, pGame, pFanPlr, 34, 5)).toBe(1)
    const fanHits = endVaTrace113c()
    expect(fanHits.has('D2Game:0x6FCD4FF0')).toBe(true)
    expect(fanHits.has('D2Game:0x6FCD31D0')).toBe(true)

    // 6. 0x6FCC4FD0: Catapult fallback table 0x6FD1B69C works even with unhydrated .rdata
    const { pUnit: pCatMon } = allocDynamicUnit(m, 1, 20, 310, 105, 105, pRoom)
    const pCatStats = (pMonStatsTxt + 20 * 0x1a8) >>> 0
    const pCatArgs = m.alloc(0x28) >>> 0
    m.setU32(pCatArgs, m.alloc(0x40) >>> 0)
    m.setU32((pCatArgs + 0x08) >>> 0, pAtk)
    m.setU32((pCatArgs + 0x1c) >>> 0, pCatStats)
    m.setU16((pCatStats + 0x170) >>> 0, 0x11f)
    m.setU32(0x6fd1b69c, 0) // deliberately unhydrated
    beginVaTrace113c()
    AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c(m, pGame, pCatMon, pCatArgs)
    const catHits = endVaTrace113c()
    expect(catHits.has('D2Game:0x6FCC4FD0')).toBe(true)

    // 7. 0x6FCD79B0: Baal anchor distance measures from pTarget (not pUnit)
    const { pUnit: pBaal } = allocDynamicUnit(m, 1, 544, 311, 105, 105, pRoom)
    const { pUnit: pBaalTgt } = allocDynamicUnit(m, 0, 2, 312, 128, 128, pRoom) // far from anchor (105,105), within room bounds
    attachSkillToUnit(m, pBaalTgt, pSkillsTxt, 1, 5)
    const pAnchor = m.alloc(0x20) >>> 0
    m.setU32((pAnchor + 0x0c) >>> 0, 105)
    m.setU32((pAnchor + 0x10) >>> 0, 105)
    const pBaalState = m.alloc(0x40) >>> 0
    const actRes = AIBAAL_SelectAction_6FCD79B0_113c(m, pBaal, pBaalTgt, pGame, pBaalState, 25, 0, pAnchor)
    expect(typeof actRes).toBe('number')
  })

  it('executes all 141 promoted Wave 12 D2Game VAs live under beginVaTrace113c()/endVaTrace113c() with 0 missing VAs', () => {
    const cumulativeHits = new Set<string>()
    const w = createWave12World()
    const {
      m,
      pGame,
      pDataTables,
      pSkillsTxt,
      pSkillCode,
      pMonStatsTxt,
      pMonStats2Txt,
      pItemsTxt,
      pItemCode,
      pObjectsTxt,
    } = w
    const { pRoom } = allocRoom(m, 2, 100, 100)
    const { pClient } = allocClient(m, pGame)
    m.setU32((pGame + 0x88) >>> 0, pClient)

    const { pUnit: pPlr, pPath: pPlrPath, pUnitData: pPlrData } = allocDynamicUnit(m, 0, 2, 1, 105, 105, pRoom)
    const { pUnit: pMon, pUnitData: pMonData } = allocDynamicUnit(m, 1, 5, 2, 106, 105, pRoom)
    const { pUnit: pObj, pUnitData: pObjData } = allocDynamicUnit(m, 2, 10, 3, 107, 105, pRoom)
    const { pUnit: pMis } = allocDynamicUnit(m, 3, 5, 4, 108, 105, pRoom)
    const { pUnit: pItem } = allocDynamicUnit(m, 4, 2, 5, 109, 105, pRoom)
    const pQFlags = m.alloc(0x10) >>> 0
    m.setU32(pQFlags, m.alloc(0x60) >>> 0)
    m.setU32((pPlrData + 0x10) >>> 0, pQFlags) // normal quest flags
    m.setU32((pPlrData + 0x14) >>> 0, pQFlags) // nightmare quest flags
    m.setU32((pPlrData + 0x18) >>> 0, pQFlags) // hell quest flags
    const pWp0 = m.alloc(0x20) >>> 0
    const pWp1 = m.alloc(0x20) >>> 0
    const pWp2 = m.alloc(0x20) >>> 0
    m.setU16(pWp0, 0x0102)
    m.setU16(pWp1, 0x0102)
    m.setU16(pWp2, 0x0102)
    m.setU32((pPlrData + 0x1c) >>> 0, pWp0) // normal waypoints
    m.setU32((pPlrData + 0x20) >>> 0, pWp1) // nightmare waypoints
    m.setU32((pPlrData + 0x24) >>> 0, pWp2) // hell waypoints
    m.setU32((pPlrData + 0x9c) >>> 0, pClient)
    m.setU32((pPlr + 0x80) >>> 0, pGame)
    m.setU32((pMon + 0x80) >>> 0, pGame)
    m.setU32((pObj + 0x80) >>> 0, pGame)
    m.setU32((pClient + 0x174) >>> 0, pPlr)
    m.setU8((pClient + 0x3d4) >>> 0, 1)
    m.setU32(pObjData, (pObjectsTxt + 10 * 0x1c0) >>> 0)
    STATLIST_SetUnitStat113c(m, pPlr, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pPlr, 7, 1000, 0)
    STATLIST_SetUnitStat113c(m, pMon, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pMon, 7, 1000, 0)
    SUNIT_InsertServerUnit113c(m, pGame, pPlr)
    SUNIT_InsertServerUnit113c(m, pGame, pMon)
    SUNIT_InsertServerUnit113c(m, pGame, pObj)
    PATH_SetTargetUnit113c(m, pPlrPath, pMon)
    const pSkill0 = attachSkillToUnit(m, pPlr, pSkillsTxt, 1, 5)
    m.setU16((pSkillsTxt + 1 * 0x23c + 0x48) >>> 0, 5)
    m.setU16((pSkillsTxt + 1 * 0x23c + 0x80) >>> 0, 9)
    m.setU16((pSkillsTxt + 1 * 0x23c + 0x82) >>> 0, 9)
    m.setU16((pSkillsTxt + 1 * 0x23c + 0x54) >>> 0, 0xffff)
    m.setU32((pSkillsTxt + 1 * 0x23c + 0x138) >>> 0, writeRpnImm32(m, pSkillCode, 0xc0, 5))
    m.setU32((pSkillsTxt + 1 * 0x23c + 0x60) >>> 0, writeRpnImm32(m, pSkillCode, 0xd0, 50))
    m.setU32((pSkillsTxt + 1 * 0x23c + 0x64) >>> 0, writeRpnImm32(m, pSkillCode, 0xe0, 10))
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlr)
    m.setU32((pPlr + 0x60) >>> 0, pInv)
    const pOpArgs = m.alloc(0x20) >>> 0
    m.setU32(pOpArgs, pGame)
    m.setU32((pOpArgs + 0x04) >>> 0, pObj)
    m.setU32((pOpArgs + 0x08) >>> 0, pPlr)
    const pOut4 = m.alloc(0x40) >>> 0
    const pDmg = m.alloc(0x70) >>> 0
    const pAuraCtx = m.alloc(0x40) >>> 0
    m.setU32(pAuraCtx, pGame)
    m.setU32((pAuraCtx + 0x04) >>> 0, pPlr)
    m.setU32((pAuraCtx + 0x0c) >>> 0, pDmg)
    const pAiTick = m.alloc(0x28) >>> 0
    m.setU32(pAiTick, m.alloc(0x40) >>> 0)
    m.setU32((pAiTick + 0x08) >>> 0, pPlr)
    m.setU32((pAiTick + 0x1c) >>> 0, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
    const pModeChange = m.alloc(0x20) >>> 0
    m.setU32((pModeChange + 0x04) >>> 0, pMon)
    const pQuestData = m.alloc(0x100) >>> 0
    m.setU32((pQuestData + 0x04) >>> 0, pGame)
    const pQuestArgs = m.alloc(0x40) >>> 0
    m.setU32(pQuestArgs, pGame)
    m.setU32((pQuestArgs + 0x08) >>> 0, pRoom)
    const pStatList = STATLIST_AllocList113c(m, 0, 0, 1, 0, 0)
    const pPartyCtrl = m.alloc(0x20) >>> 0
    m.setU32((pGame + 0x1d2c) >>> 0, pPartyCtrl)
    const pNpcCtrl = m.alloc(0x20) >>> 0
    m.setU32((pNpcCtrl + 0x04) >>> 0, m.alloc(0x40 * 0x44) >>> 0)
    m.setU32((pGame + 0x1d24) >>> 0, pNpcCtrl)
    const pNpcStaticSrc = m.alloc(0x40) >>> 0
    m.setU32(0x6fd30208, pNpcStaticSrc)
    m.setU32(0x6fd3020c, 1)
    m.setU32(0x6fd30210, pNpcStaticSrc)
    m.setU32(0x6fd30214, 1)

    // --- Shard 1: k2w3-b7 (36 VAs) ---
    beginVaTrace113c()
    ACT1Q4_OnCainModeOrInteract_6FC88150_113c(m, pGame, pMon)
    ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c(m, pQuestData, pObj)
    QUESTS_FreeBitBufferPair_6FC892D0_113c(m, pOut4, pGame)
    SKILLS_CalcUnitSkillToHit_6FC89B00_113c(m, 0, pSkill0, pPlr, pOut4, 5)
    OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c(m, pGame, pObj)
    OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c(m, pPlr, pOut4)
    OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c(m, 5, pOpArgs, 1)
    OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c(m, pGame, pObj, pPlr)
    OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c(m, pGame, 3)
    OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c(m, pMon, pPlr)
    OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c(m, pOpArgs)
    OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c(m, pPlr, 1, pStatList)
    OBJ_ApplyShrineAuraStatList_6FC8A960_113c(m, pGame, pPlr, 1, 0, 0x13, 10, 200)
    OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOpArgs, 0)
    OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(m, pObj, pGame, 5)
    OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c(m, pGame, pObj)
    OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c(m, pOpArgs, pOut4)
    OBJ_OperateWaypoint_6FC8CF90_113c(m, pOpArgs)
    OBJ_OperateBreakawayObject_6FC8D8F0_113c(m, pOpArgs)
    OBJ_OperateGenericMode0To1_6FC8DE00_113c(m, pOpArgs)
    OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c(m, pOpArgs, 0x1000)
    OBJ_EventHoverMsgTimeout_6FC8E470_113c(m, pGame, pObj)
    OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c(m, pGame, pObj)
    MISSILE_SendSyncPacket73_6FC8F740_113c(m, pGame, pMis, pClient, 0)
    PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pPlr, pGame)
    CUBE_ValidateRecipeInputSlot_6FC90240_113c(m, pOut4, pGame, pInv, 0, pOut4, pOut4)
    NET_SendEventMessagePacket5A_6FC90BF0_113c(m, pOut4, 1, pPlr)
    CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c(m, pGame, 10, 1)
    MONSTER_ModeChangeKnockback_6FC95160_113c(m, pGame, pModeChange)
    MONSTER_ModeChangeCorpse_6FC95460_113c(m, pGame, pModeChange)
    MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c(m, pMon, pGame)
    MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c(m, pMon, pGame)
    MONSTER_EventHoverMsgTimeout_6FC96570_113c(m, pGame, pMon)
    MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c(m, pGame, pMon)
    MONSTER_StepSkillCastAnim_6FC96F20_113c(m, pGame, pMon)
    PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c(m, pPlr, pItem)
    for (const v of endVaTrace113c()) cumulativeHits.add(v)

    // --- Shard 2: k2w7-b1 (35 VAs) ---
    beginVaTrace113c()
    SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c(m, pGame, pMon, 1, 5)
    try {
      ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, pGame, 0, 0)
    } catch {
      // Expected assert on pSourceItem = 0
    }
    AI_Think_Overlord_6FC37CB0_113c(m, pGame, pMon, pAiTick)
    MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c(m, pGame, pMon)
    MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c(m, pGame, pMis, 0, 0)
    MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c(m, pGame, pMon)
    MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c(m, pGame, pMon)
    MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c(m, pGame, pMon)
    MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c(m, pGame, pMon)
    SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c(m, pGame, pPlr, 1, 5)
    PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c(m, pClient)
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 3)
    QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c(m, pQuestArgs)
    QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c(m, pGame, pMis, 1)
    SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c(m, pGame, pPlr, 1, 5)
    SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c(m, pPlr, pGame, 1, 5, 5)
    SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c(m, pGame, pPlr, 1, 5, 5, 1, 0)
    SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c(m, pGame, pPlr, 1, 5)
    PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c(m, pGame, pRoom, 0, 5)
    SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_ApplyDimVisionToTarget_6FC70470_113c(m, pGame, pPlr, pMon, 5)
    SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c(m, 0, pAuraCtx)
    SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c(m, pGame, pPlr, 1, 5)
    QUESTS_Act1AndarielOnDeath_6FC7B690_113c(m, pQuestData, pQuestArgs)
    QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c(m, pPlr, pGame)
    QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c(m, pQuestArgs)
    for (const v of endVaTrace113c()) cumulativeHits.add(v)

    // --- Shard 3: k2w4-b5 (35 VAs) ---
    const pEmptyInv = INVENTORY_AllocInventory113c(m, 0, pPlr)
    const pPetNode = m.alloc(0x28) >>> 0
    beginVaTrace113c()
    NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c(m, pGame, 3, pClient, 0)
    NET_SendPacket75_PartyUnitRosterUpdate_6FCAD120_113c(m, pPlr, pPlr)
    ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c(m, 0, pItem, pClient)
    INVENTORY_FreeAllItems_6FCAF470_113c(m, pEmptyInv, pGame)
    NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c(m, 0, pGame, pOut4)
    NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c(m, pGame, 1)
    NPCS_QueueOrFreeVendorItem_6FCB0260_113c(m, pGame, pMon, pItem, 0)
    NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c(m, pGame, pPlr)
    MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c(m, pMis, 1)
    SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, pPlr, 1, 5)
    SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c(m, pPlr, pStatList, pDmg)
    SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c(m, pMon, 0x6d, 0)
    SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c(m, pPlr, pStatList, pDmg)
    SKILLS_ApplyRadialDamageCallback_6FCB3040_113c(m, pAuraCtx, pMon)
    SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c(m, pGame, pPlr, 1, 5)
    SKILLS_AddProgressiveChargeStage_6FCB5370_113c(m, pPlr, pGame, 1, 5, 9, 0x13)
    PETS_FindPetTypeByGuid_6FCB6600_113c(m, pPlr, 999)
    PETS_SendPacket7A_UnsummonPet_6FCB6810_113c(m, pPlr, pPetNode)
    PETS_GetFirstPetUnitByType_6FCB6A40_113c(m, pPlr, 1, 0, pGame)
    PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c(m, pMon, pRoom, pGame, 105, 105)
    SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c(m, pPlr, 1, pMon, 5, 1)
    STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c(m, pMon, 0x0b, 0)
    AURAS_RedemptionCorpseCallback_6FCB8680_113c(m, pAuraCtx, pMon)
    SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c(m, pPlr)
    SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c(m, pMon, 0x6d, 0)
    SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c(m, pGame, 0xffffffff, pPlr)
    SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c(m, 50, pGame, pMon)
    AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c(m, pAuraCtx, pMon)
    AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c(m, pAuraCtx, pMon)
    ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c(m, pPlr, pGame)
    const partyId = PARTY_CreateAndLinkSubParty_6FCBBF70_113c(m, pGame)
    expect(partyId).toBeGreaterThan(0)
    expect(PARTY_CountSubPartyMembers_6FCBBF40_113c(m, pGame, partyId)).toBe(0)
    PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c(m, pGame, pPlr, 50)
    for (const v of endVaTrace113c()) cumulativeHits.add(v)

    // --- Shard 4: k2w5-b3 (35 VAs) ---
    const pBestCtx = m.alloc(0x20) >>> 0
    m.setU32((pBestCtx + 0x04) >>> 0, 0x7fffffff)
    const pPotRec = (pItemsTxt + 2 * ITEMS_TXT_STRIDE_113C) >>> 0
    m.setU16((pPotRec + 0x98) >>> 0, 29)
    m.setU32((pPotRec + 0xb0) >>> 0, writeRpnImm32(m, pItemCode, 0x30, 100))
    m.setU16((pPotRec + 0x9e) >>> 0, 0xffff)
    m.setU16((pPotRec + 0xa0) >>> 0, 0xffff)
    m.setU16((pPotRec + 0xa2) >>> 0, 0xffff)
    beginVaTrace113c()
    SKILLS_DoChargeStart_6FCB9620_113c(m, pGame, pPlr, 1, 5)
    SKILLS_DoRedemptionAuraPulse_6FCBA400_113c(m, pGame, pPlr, 1, 5)
    SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, pMon, 4)
    SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c(m, 0, 105, pGame, 105, pPlr, 1, 5, 0x6fcbedb0)
    SKILLS_DoUnsummonStart_6FCBFEF0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(m, pPlr, pGame, 1, 5, 5, 106, 105)
    SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c(m, pPlr, 1, pGame, 5)
    AURA_FindClosestUnitInRadius_6FCC1000_113c(m, pPlr, pGame, 10, 0)
    SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c(m, pGame, pPlr, 1, 5)
    SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c(m, pGame, pPlr, 1, 1)
    SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c(m, pPlr, 1, pMon)
    AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c(m, pGame, pMon, pAiTick)
    AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c(m, pGame, pMon, pPlr, pBestCtx)
    SUNITDMG_ProcHitOpenWounds_6FCCD410_113c(m, pGame, 0, pPlr, pMon, 0, 100, 0)
    ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c(m, pGame, pPlr, pItem)
    SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c(m, pGame, 0, pPlr, pMon, 0, 100, 0)
    MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c(m, pGame, pMon, pPlr, pBestCtx)
    MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c(m, pGame, pMon, pPlr, pBestCtx)
    SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c(m, pGame, pPlr, 1, 5)
    SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c(m, pGame, pPlr, 1, 5)
    SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c(m, pGame, pPlr, 1, 5)
    SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c(m, 1, pPlr, pMon, pGame, 5)
    SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c(m, pGame, pPlr, 35, 5)
    SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c(m, pGame, pPlr, 1, 5)
    SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c(m, pGame, pPlr, 1, 5)
    SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c(m, pGame, pPlr, 1, 5)
    AIBAAL_SelectAction_6FCD79B0_113c(m, pMon, pPlr, pGame, pOut4, 25, 0, pOut4)
    ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c(m, pGame, pPlr, 0)
    ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c(m, pGame, pPlr, 0)
    ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c(m, pGame, pPlr, 0)
    ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c(m, pGame, pObj)
    ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c(m, pPlr, pItem, pOut4)
    for (const v of endVaTrace113c()) cumulativeHits.add(v)

    void pDataTables
    void pMonData
    void pMonStats2Txt

    const missingVas = WAVE12_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
