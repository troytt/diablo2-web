/**
 * Diablo II v1.13c `D2Game.dll` Binary Disassembly Verification Suite (Wave 6: +158 VAs).
 *
 * Audits and verifies 158 `D2Game.dll` (`0x6FC20000`) closure functions across:
 * - `k2w1-laneK-0x6fc5` (`src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c.ts`, 39 functions)
 * - `k2w4-b1` (`src/d2kern-113c/game/k2-w4b1-113c.ts`, 39 functions)
 * - `k2w3-b4` (`src/d2kern-113c/game/k2-w3b4-113c.ts`, 39 functions)
 * - `k2w6-b1` (`src/d2kern-113c/game/k2-w6b1-113c.ts`, 41 functions)
 *
 * Enforces:
 * 1. Exact PE32 `.text` machine-code leading/trailing opcode & size verification in `D2Game.dll`.
 * 2. Differential regression tests for all 12 genuine 1.13c binary disassembly discrepancies fixed.
 * 3. Multi-branch `SparseMemory113c` boundary/state assertions + 100% (`158 / 158`) live
 *    `beginVaTrace113c()` / `endVaTrace113c()` execution coverage.
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
  INVENTORY_SIGNATURE_113C,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  ITEMS_GetItemQuality113c,
  ITEMS_GetOwnerGuid113c,
} from '../../../src/d2kern-113c/common/items.ts'
import {
  MISSILE_AllocMissileData113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
  MISSILE_SetLevel113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetSkill113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MISSILE_SetTotalFrames113c,
} from '../../../src/d2kern-113c/common/missile.ts'
import {
  PATH_SetTargetUnit113c,
  PATH_SetVelocity113c,
} from '../../../src/d2kern-113c/common/path.ts'
import { QUESTRECORD_AllocRecord113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  GDW_BITMASKS_IAT_VA_113C,
  SGPT_DATATABLES_VA_113C,
  SGPT_EXPERIENCE_TXT_PTR_VA_113C,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_SetParam1113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  MISSILES_ConsumePierceStat_6FC58F40_113c,
  MISSILES_FilterFlagBit4Missile_6FC59510_113c,
  MISSILES_InitChargedBoltPath_6FC61F50_113c,
  MISSILES_InitDrunkenPath_6FC59210_113c,
  MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c,
  MISSILES_SetElemLenByEType_6FC594B0_113c,
  MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c,
  MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c,
  MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c,
  MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c,
  MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c,
  MISSILES_SrvDo_ReturnOne_6FC58EC0_113c,
  MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c,
  MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c,
  MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c,
  MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c,
  MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c,
  MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c,
  MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c,
  MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c,
  MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c,
  MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c,
  MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c,
  OBJECTS_OperateContainer_6FC56B90_113c,
  PLAYER_ApplyDeathExpPenalty_6FC57730_113c,
  PLAYER_FreePlayerCorpses_6FC579E0_113c,
  PLAYER_FreePlayerDataList98_6FC57500_113c,
  PLAYER_GetPlayerDataField48_6FC57440_113c,
  PLAYER_InitPlacedModesAndEvents_6FC57E20_113c,
  PLAYER_SetPlayerDataField48_6FC57480_113c,
  QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c,
  QUESTS_InitAct1Quest3Object_6FC54E10_113c,
  QUESTS_InitAct1Quest4Object_6FC54DA0_113c,
  QUESTS_PackNpcIntroFlags_6FC54C70_113c,
  QUESTS_SetNpcIntroFlags_6FC54D00_113c,
  QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c,
  SKILLS_RedemptionCorpseCallback_6FC59930_113c,
  SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c,
  SKILLS_StatListExpireClearState_6FC62290_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c.ts'
import {
  AI_ThinkPackIdlePatrol_6FC373D0_113c,
  AI_ThinkPutridDefiler_6FC389E0_113c,
  GAME_IsGameNameAvailable_6FC4ABD0_113c,
  ITEMS_ApplyLowQualityModsByFormat_6FC34AF0_113c,
  ITEMS_ApplySetItemModsByFormat_6FC341E0_113c,
  ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c,
  ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c,
  ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c,
  ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c,
  ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c,
  ITEMS_RollMagicAffixByFormat_6FC34B50_113c,
  ITEMS_RollRareNameIdByFormat_6FC34B30_113c,
  ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c,
  ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c,
  ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c,
  ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c,
  MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c,
  MONUMOD_ApplyChampionFanaticStats_6FC43810_113c,
  MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c,
  MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c,
  MONUMOD_ApplyColdEnchantedStats_6FC42320_113c,
  MONUMOD_ApplyFireEnchantedStats_6FC42740_113c,
  MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c,
  MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c,
  MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c,
  MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c,
  MONUMOD_RollRandomChampionMod_6FC43AE0_113c,
  MONUMOD_RollRandomUniqueBossMod_6FC43980_113c,
  MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c,
  OBJECTS_OperateGoldChestOrPile_6FC4F580_113c,
  OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c,
  OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c,
  OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c,
  OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c,
  OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c,
  OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c,
  SKILLS_EndChargeOrLeapMovement_6FC48170_113c,
  SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c,
  SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c,
  STORM_TSListDestroySehWrapper_6FC21F60_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c.ts'
import {
  CLIENTS_AllocAndLinkClient_6FC6A9B0_113c,
  CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c,
  MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c,
  MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c,
  MISSILE_SrvDo_HomingTargetStep_6FC61240_113c,
  MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c,
  MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c,
  MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c,
  MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c,
  MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c,
  MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c,
  MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c,
  REGPOP_SpawnMonsterFormation_6FC671E0_113c,
  SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c,
  SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c,
  SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c,
  SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c,
  SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c,
  SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c,
  SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c,
  SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c,
  SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c,
  SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c,
  SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c,
  SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c,
  SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c,
  SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c,
  SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c,
  SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c,
  SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c,
  SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c,
  SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c,
  SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c,
  SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c,
  SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c,
  SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c,
  SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c,
  SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c,
  SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c,
} from '../../../src/d2kern-113c/game/k2-w3b4-113c.ts'
import {
  ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c,
  ACT1Q5_StatusFilter_6FC85500_113c,
  ACT5Q3_StatusFilter_6FC7B8C0_113c,
  AI_ThinkCurseCaster_6FC3AF80_113c,
  AI_ThinkSuccubus_6FC3A9F0_113c,
  MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c,
  MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c,
  MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c,
  MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c,
  MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c,
  MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c,
  MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c,
  MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c,
  MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c,
  MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c,
  MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c,
  MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c,
  MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c,
  MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c,
  MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c,
  MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c,
  OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c,
  QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c,
  SKILLS_ApplyAttractCurseCallback_6FC70B70_113c,
  SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c,
  SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c,
  SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c,
  SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c,
  SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c,
  SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c,
  SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c,
  SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c,
  SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c,
  SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c,
  SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c,
  SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c,
  SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c,
  SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c,
  SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c,
  SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c,
  STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c.ts'
import {
  SUNITDMG_AllocCombat113c,
  SUNITDMG_GetAttackerDamageData113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  bindRoomCollisionGrid113c,
  ensureD2CommonPathGlobals113c,
} from '../../../src/d2kern-113c/game/tables-bootstrap-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2DynamicPathStrc,
  D2ItemDataStrc,
  D2ItemDataStrc_SIZE,
  D2ItemsTxt_SIZE,
  D2ItemTypesTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2MonLvlTxt_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2StatListStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_ITEMS_LINKER_PTR_VA,
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
  SGPT_MAGICAFFIX_TXT_COUNT_VA,
  SGPT_MAGICAFFIX_TXT_PTR_VA,
  SGPT_OBJGROUP_TXT_COUNT_VA,
  SGPT_OBJGROUP_TXT_PTR_VA,
  SGPT_QUALITYITEMS_TXT_COUNT_VA,
  SGPT_QUALITYITEMS_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import {
  SG_MAGIC_AFFIX_DATATABLES_VA_113C,
  SG_RARE_AFFIX_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'
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
  readonly summary: {
    readonly statusBreakdown: Record<string, number>
  }
  readonly functions: readonly ManifestFn[]
}

interface DisasmVaSpec {
  readonly batch: 'k2w1-laneK-0x6fc5' | 'k2w4-b1' | 'k2w3-b4' | 'k2w6-b1'
  readonly va: string
  readonly size: number
  readonly headHex: string
  readonly tailHex: string
  readonly tsSymbol: string
}

const WAVE6_PROMOTED_SPECS: readonly DisasmVaSpec[] = [
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC54C70', size: 141, headHex: '83c9ff83c0028bd0', tailHex: '6febc3', tsSymbol: 'QUESTS_PackNpcIntroFlags_6FC54C70_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC54D00', size: 96, headHex: '53558b6c24105650', tailHex: '6febe0', tsSymbol: 'QUESTS_SetNpcIntroFlags_6FC54D00_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC54DA0', size: 105, headHex: '578bf98b078b80f4', tailHex: '5e5fc3', tsSymbol: 'QUESTS_InitAct1Quest4Object_6FC54DA0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC54E10', size: 118, headHex: '8b018b80f4100000', tailHex: 'fdffc3', tsSymbol: 'QUESTS_InitAct1Quest3Object_6FC54E10_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC55A20', size: 222, headHex: '8b4c240833c06639', tailHex: 'fcffcc', tsSymbol: 'QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC56820', size: 73, headHex: '5355575051e8cc45', tailHex: 'c20800', tsSymbol: 'QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC56B90', size: 142, headHex: '83ec08568bf08b46', tailHex: 'c408c3', tsSymbol: 'OBJECTS_OperateContainer_6FC56B90_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC57440', size: 56, headHex: '85c07507684c0200', tailHex: '4048c3', tsSymbol: 'PLAYER_GetPlayerDataField48_6FC57440_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC57480', size: 62, headHex: '85c07507683f0200', tailHex: 'c20400', tsSymbol: 'PLAYER_SetPlayerDataField48_6FC57480_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC57500', size: 54, headHex: '8b939800000085d2', tailHex: '0000c3', tsSymbol: 'PLAYER_FreePlayerDataList98_6FC57500_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC57730', size: 218, headHex: '0fb6486d558b6c24', tailHex: 'c20400', tsSymbol: 'PLAYER_ApplyDeathExpPenalty_6FC57730_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC579E0', size: 144, headHex: '8b48605751e87c2a', tailHex: 'fcffcc', tsSymbol: 'PLAYER_FreePlayerCorpses_6FC579E0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC57E20', size: 155, headHex: '85f6750768040800', tailHex: 'c20800', tsSymbol: 'PLAYER_InitPlacedModesAndEvents_6FC57E20_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC58E70', size: 20, headHex: '8b4424088b483089', tailHex: 'c20800', tsSymbol: 'MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC58E90', size: 14, headHex: '8b442404f7d81bc0', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC58EA0', size: 31, headHex: '8b44240485c07512', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC58EC0', size: 8, headHex: 'b801000000c20400', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_ReturnOne_6FC58EC0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC58F40', size: 112, headHex: '85f657bf03000000', tailHex: 'c75fc3', tsSymbol: 'MISSILES_ConsumePierceStat_6FC58F40_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC58FF0', size: 77, headHex: '85d274468b420485', tailHex: 'c20800', tsSymbol: 'MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59040', size: 58, headHex: '85d274338b420485', tailHex: 'c20800', tsSymbol: 'MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC591A0', size: 107, headHex: '56578bfa85ff7429', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59210', size: 76, headHex: '578bf985ff744353', tailHex: '5b5fc3', tsSymbol: 'MISSILES_InitDrunkenPath_6FC59210_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC592E0', size: 113, headHex: '5733ff3bc774688b', tailHex: '185fc3', tsSymbol: 'MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC594B0', size: 51, headHex: '85c0742e8b400450', tailHex: '7734c3', tsSymbol: 'MISSILES_SetElemLenByEType_6FC594B0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59510', size: 72, headHex: '85c9744183390375', tailHex: '33c0c3', tsSymbol: 'MISSILES_FilterFlagBit4Missile_6FC59510_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59560', size: 145, headHex: '85d20f8486000000', tailHex: 'c20800', tsSymbol: 'MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC596E0', size: 211, headHex: '538b5c240885db0f', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59930', size: 263, headHex: 'a19c82d16f8b0083', tailHex: 'c20c00', tsSymbol: 'SKILLS_RedemptionCorpseCallback_6FC59930_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59A40', size: 256, headHex: '538bda85db746683', tailHex: 'ffffff', tsSymbol: 'MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59BD0', size: 175, headHex: '5153568bf233db3b', tailHex: 'c20800', tsSymbol: 'MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59C80', size: 84, headHex: '518bc285c074498b', tailHex: 'c20800', tsSymbol: 'MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC59F70', size: 95, headHex: '568b74240885f657', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC5A1D0', size: 171, headHex: '5185db5556750433', tailHex: '5d59c3', tsSymbol: 'MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC5BC80', size: 132, headHex: '8b44240485c05356', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC5BD10', size: 131, headHex: '5356578bfa85ff8b', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC5E670', size: 193, headHex: '8b44240485c0578b', tailHex: 'c20400', tsSymbol: 'MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC61F50', size: 94, headHex: '55568bf185f68bea', tailHex: '5e5dc3', tsSymbol: 'MISSILES_InitChargedBoltPath_6FC61F50_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC62230', size: 84, headHex: '8bca8b54240485d2', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c' },
  { batch: 'k2w1-laneK-0x6fc5', va: '0x6FC62290', size: 27, headHex: '566a008bf15256e8', tailHex: 'c20400', tsSymbol: 'SKILLS_StatListExpireClearState_6FC62290_113c' },
  { batch: 'k2w4-b1', va: '0x6FC21F60', size: 55, headHex: '64a1000000006aff', tailHex: 'c20400', tsSymbol: 'STORM_TSListDestroySehWrapper_6FC21F60_113c' },
  { batch: 'k2w4-b1', va: '0x6FC2C8D0', size: 41, headHex: '8b44240456578bf2', tailHex: 'c20c00', tsSymbol: 'SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC2D170', size: 278, headHex: '83ec6456578bf285', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c' },
  { batch: 'k2w4-b1', va: '0x6FC2F370', size: 910, headHex: '83ec0c538b5c2418', tailHex: 'c20c00', tsSymbol: 'ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c' },
  { batch: 'k2w4-b1', va: '0x6FC2FFC0', size: 403, headHex: '64a1000000008a0d', tailHex: 'ffffcc', tsSymbol: 'ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC301E0', size: 96, headHex: '578bf8e828e0ffff', tailHex: '005fc3', tsSymbol: 'ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC30240', size: 376, headHex: '518b442408535557', tailHex: 'c20400', tsSymbol: 'ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c' },
  { batch: 'k2w4-b1', va: '0x6FC303C0', size: 291, headHex: '518b44240c535556', tailHex: 'c20800', tsSymbol: 'ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC32AF0', size: 153, headHex: '83ec1085ff558b6c', tailHex: 'c20400', tsSymbol: 'ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC341E0', size: 39, headHex: '578bf857e89571ff', tailHex: 'c20400', tsSymbol: 'ITEMS_ApplySetItemModsByFormat_6FC341E0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC34AF0', size: 38, headHex: '578bf857e88568ff', tailHex: 'c20400', tsSymbol: 'ITEMS_ApplyLowQualityModsByFormat_6FC34AF0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC34B30', size: 26, headHex: '56e84868ffff663d', tailHex: 'ffffc3', tsSymbol: 'ITEMS_RollRareNameIdByFormat_6FC34B30_113c' },
  { batch: 'k2w4-b1', va: '0x6FC34B50', size: 68, headHex: '558b6c241056e823', tailHex: 'c21000', tsSymbol: 'ITEMS_RollMagicAffixByFormat_6FC34B50_113c' },
  { batch: 'k2w4-b1', va: '0x6FC34BF0', size: 810, headHex: '83ec1853555756e8', tailHex: 'c20400', tsSymbol: 'ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC34F20', size: 798, headHex: '83ec1853555756e8', tailHex: 'c20400', tsSymbol: 'ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c' },
  { batch: 'k2w4-b1', va: '0x6FC373D0', size: 726, headHex: '83ec2c5355568b74', tailHex: 'c20400', tsSymbol: 'AI_ThinkPackIdlePatrol_6FC373D0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC389E0', size: 175, headHex: '8b44240483ec2853', tailHex: 'c20400', tsSymbol: 'AI_ThinkPutridDefiler_6FC389E0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC421D0', size: 326, headHex: '51558be985ed8954', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC42320', size: 360, headHex: '83ec08558be985ed', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyColdEnchantedStats_6FC42320_113c' },
  { batch: 'k2w4-b1', va: '0x6FC42490', size: 355, headHex: '83ec08558be985ed', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c' },
  { batch: 'k2w4-b1', va: '0x6FC42600', size: 320, headHex: '51558be985ed8954', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c' },
  { batch: 'k2w4-b1', va: '0x6FC42740', size: 320, headHex: '51558be985ed8954', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyFireEnchantedStats_6FC42740_113c' },
  { batch: 'k2w4-b1', va: '0x6FC42B60', size: 88, headHex: '8b44240885c0568b', tailHex: 'c20800', tsSymbol: 'MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c' },
  { batch: 'k2w4-b1', va: '0x6FC43730', size: 141, headHex: '83ec20568bf1578b', tailHex: 'c20400', tsSymbol: 'MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c' },
  { batch: 'k2w4-b1', va: '0x6FC437C0', size: 69, headHex: '538bd985db558bea', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC43810', size: 52, headHex: '53568bf185f68bda', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyChampionFanaticStats_6FC43810_113c' },
  { batch: 'k2w4-b1', va: '0x6FC43850', size: 303, headHex: '55578bf985ff8bea', tailHex: 'c20400', tsSymbol: 'MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c' },
  { batch: 'k2w4-b1', va: '0x6FC43980', size: 345, headHex: '81ec1408000085c0', tailHex: 'c20800', tsSymbol: 'MONUMOD_RollRandomUniqueBossMod_6FC43980_113c' },
  { batch: 'k2w4-b1', va: '0x6FC43AE0', size: 265, headHex: '81ec0c0800005333', tailHex: 'c20400', tsSymbol: 'MONUMOD_RollRandomChampionMod_6FC43AE0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC468C0', size: 30, headHex: '8b44240885c07413', tailHex: 'c20800', tsSymbol: 'MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC48170', size: 274, headHex: '515355566a00508b', tailHex: 'c20800', tsSymbol: 'SKILLS_EndChargeOrLeapMovement_6FC48170_113c' },
  { batch: 'k2w4-b1', va: '0x6FC4ABD0', size: 138, headHex: '538b1d008dd16f55', tailHex: 'c20400', tsSymbol: 'GAME_IsGameNameAvailable_6FC4ABD0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC4F580', size: 268, headHex: '83ec14568bf18b46', tailHex: 'c414c3', tsSymbol: 'OBJECTS_OperateGoldChestOrPile_6FC4F580_113c' },
  { batch: 'k2w4-b1', va: '0x6FC52790', size: 24, headHex: '8b4424045052b801', tailHex: 'c20400', tsSymbol: 'OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c' },
  { batch: 'k2w4-b1', va: '0x6FC527B0', size: 21, headHex: '8b442404505233c0', tailHex: 'c20400', tsSymbol: 'OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC527D0', size: 565, headHex: '83ec3c8b44244453', tailHex: 'c20c00', tsSymbol: 'OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC52A10', size: 432, headHex: '83ec2c56578bf28b', tailHex: 'c20c00', tsSymbol: 'OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c' },
  { batch: 'k2w4-b1', va: '0x6FC52DF0', size: 955, headHex: '83ec4c538b99f010', tailHex: 'fcffcc', tsSymbol: 'OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c' },
  { batch: 'k2w4-b1', va: '0x6FC531B0', size: 165, headHex: '5356578bf2568bf9', tailHex: 'c21000', tsSymbol: 'OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC60070', size: 514, headHex: '83ec74538bda85db', tailHex: 'c474c3', tsSymbol: 'MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c' },
  { batch: 'k2w3-b4', va: '0x6FC605E0', size: 235, headHex: '83ec5c53558bda85', tailHex: 'c45cc3', tsSymbol: 'MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC606D0', size: 386, headHex: '83ec6c538bda85db', tailHex: 'c46cc3', tsSymbol: 'MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC60860', size: 112, headHex: '51538bda85db568b', tailHex: '5b59c3', tsSymbol: 'MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c' },
  { batch: 'k2w3-b4', va: '0x6FC60E10', size: 147, headHex: '53558bda85db578b', tailHex: '005bc3', tsSymbol: 'MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c' },
  { batch: 'k2w3-b4', va: '0x6FC61110', size: 294, headHex: '83ec6853568bda85', tailHex: 'c468c3', tsSymbol: 'MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c' },
  { batch: 'k2w3-b4', va: '0x6FC61240', size: 399, headHex: '83ec0c53558bda85', tailHex: 'c40cc3', tsSymbol: 'MISSILE_SrvDo_HomingTargetStep_6FC61240_113c' },
  { batch: 'k2w3-b4', va: '0x6FC61520', size: 322, headHex: '83ec6853568bda33', tailHex: 'c468c3', tsSymbol: 'MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c' },
  { batch: 'k2w3-b4', va: '0x6FC61710', size: 310, headHex: '83ec0855568bf285', tailHex: 'c408c3', tsSymbol: 'MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c' },
  { batch: 'k2w3-b4', va: '0x6FC61AE0', size: 145, headHex: '538bda8b432c85c0', tailHex: '5f5bc3', tsSymbol: 'MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC61FB0', size: 625, headHex: '83ec10578b7c2418', tailHex: 'c21400', tsSymbol: 'SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC62360', size: 419, headHex: '5155568bf2578bc6', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c' },
  { batch: 'k2w3-b4', va: '0x6FC62570', size: 437, headHex: '83ec30538b5c2438', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c' },
  { batch: 'k2w3-b4', va: '0x6FC62730', size: 443, headHex: '83ec2c538b5c2434', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c' },
  { batch: 'k2w3-b4', va: '0x6FC634E0', size: 295, headHex: '83ec6053558b6c24', tailHex: 'c21400', tsSymbol: 'SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC639A0', size: 251, headHex: '8b462c83ec6085c0', tailHex: 'c20400', tsSymbol: 'SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC64600', size: 462, headHex: '8b54240485d27408', tailHex: 'c21400', tsSymbol: 'SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c' },
  { batch: 'k2w3-b4', va: '0x6FC64AC0', size: 346, headHex: '83ec788b4c247c55', tailHex: 'c20c00', tsSymbol: 'SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC64C20', size: 324, headHex: '83ec7c538b9c2484', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c' },
  { batch: 'k2w3-b4', va: '0x6FC64D70', size: 346, headHex: '83ec7c538b9c2484', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c' },
  { batch: 'k2w3-b4', va: '0x6FC65410', size: 207, headHex: '83ec5c558b6c2468', tailHex: 'c21000', tsSymbol: 'SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c' },
  { batch: 'k2w3-b4', va: '0x6FC65CE0', size: 506, headHex: '83ec0c538b5c2414', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC65EE0', size: 287, headHex: '558b6c2410578b7c', tailHex: 'c21800', tsSymbol: 'SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC66000', size: 524, headHex: '83ec08535556578b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c' },
  { batch: 'k2w3-b4', va: '0x6FC671E0', size: 616, headHex: '83ec748b4c247c53', tailHex: 'c21c00', tsSymbol: 'REGPOP_SpawnMonsterFormation_6FC671E0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6A460', size: 428, headHex: '53558b6c2410578b', tailHex: 'c21400', tsSymbol: 'SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6A9B0', size: 439, headHex: '538bd8a1181cd36f', tailHex: 'c21800', tsSymbol: 'CLIENTS_AllocAndLinkClient_6FC6A9B0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6AE90', size: 528, headHex: '83ec3c56578bf06a', tailHex: 'c43cc3', tsSymbol: 'CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6C3A0', size: 331, headHex: '83ec7c5355568bb4', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6CE10', size: 551, headHex: '81ec84000000558b', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6D040', size: 545, headHex: '83ec6c5355568bf2', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6DFE0', size: 409, headHex: '8b54240485d27408', tailHex: 'c21400', tsSymbol: 'SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6E500', size: 225, headHex: '538b5c240885db56', tailHex: 'c21400', tsSymbol: 'SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6E5F0', size: 358, headHex: '8b44240485c05556', tailHex: 'c21400', tsSymbol: 'SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6E760', size: 410, headHex: '5153568b74241085', tailHex: 'c21400', tsSymbol: 'SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6EA30', size: 279, headHex: '85c0578bf90f8408', tailHex: 'c75fc3', tsSymbol: 'SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6EF70', size: 287, headHex: '83ec2453578b7c24', tailHex: 'c21400', tsSymbol: 'SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6F090', size: 732, headHex: '83ec7c538b9c2488', tailHex: 'c21400', tsSymbol: 'SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c' },
  { batch: 'k2w3-b4', va: '0x6FC6F4D0', size: 765, headHex: '81ecd40000005355', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC221D0', size: 127, headHex: '817924ff03000072', tailHex: '005ec3', tsSymbol: 'STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC2C900', size: 280, headHex: '83ec7453558bac24', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c' },
  { batch: 'k2w6-b1', va: '0x6FC2D7B0', size: 150, headHex: '5153568b74241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC2D9C0', size: 319, headHex: '5153568b74241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC3A9F0', size: 1410, headHex: '83ec348b44243853', tailHex: 'c20400', tsSymbol: 'AI_ThinkSuccubus_6FC3A9F0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC3AF80', size: 865, headHex: '83ec2c8b44243053', tailHex: 'c20400', tsSymbol: 'AI_ThinkCurseCaster_6FC3AF80_113c' },
  { batch: 'k2w6-b1', va: '0x6FC44250', size: 175, headHex: '8b44240885c05356', tailHex: 'c20800', tsSymbol: 'MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c' },
  { batch: 'k2w6-b1', va: '0x6FC47130', size: 89, headHex: '83ec08568bf285f6', tailHex: 'c408c3', tsSymbol: 'SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c' },
  { batch: 'k2w6-b1', va: '0x6FC47B90', size: 251, headHex: '83ec1853568bf257', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c' },
  { batch: 'k2w6-b1', va: '0x6FC49600', size: 284, headHex: '83ec1853558bda56', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c' },
  { batch: 'k2w6-b1', va: '0x6FC52110', size: 408, headHex: '83ec08538bd98b83', tailHex: 'c21000', tsSymbol: 'OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c' },
  { batch: 'k2w6-b1', va: '0x6FC565B0', size: 47, headHex: '8b018b80f4100000', tailHex: '5f5ec3', tsSymbol: 'QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5AB30', size: 160, headHex: '5356578bfa85ff8b', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5B140', size: 208, headHex: '55568bf2568be9e8', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5B210', size: 456, headHex: '81ec800000005355', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5B3E0', size: 522, headHex: '81ec84000000538b', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5B5F0', size: 458, headHex: '81ec800000005356', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5B7C0', size: 453, headHex: '81ec80000000538b', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5C490', size: 283, headHex: '83ec085556578bfa', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5D8C0', size: 407, headHex: '81ec80000000538b', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5DEF0', size: 436, headHex: '81ec880000005355', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5E0B0', size: 630, headHex: '81ec80000000538b', tailHex: 'c20400', tsSymbol: 'MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5F550', size: 279, headHex: '53558bda85db578b', tailHex: '5d5bc3', tsSymbol: 'MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c' },
  { batch: 'k2w6-b1', va: '0x6FC5F6D0', size: 251, headHex: '5356578bda538bf9', tailHex: '5e5bc3', tsSymbol: 'MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC60280', size: 406, headHex: '81ec800000005357', tailHex: '0000c3', tsSymbol: 'MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c' },
  { batch: 'k2w6-b1', va: '0x6FC60420', size: 163, headHex: '53568bda85db578b', tailHex: '005bc3', tsSymbol: 'MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c' },
  { batch: 'k2w6-b1', va: '0x6FC61EB0', size: 144, headHex: '5356578bfa85ff8b', tailHex: 'e9ffff', tsSymbol: 'MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC62510', size: 94, headHex: '568bf085f6745185', tailHex: 'c21000', tsSymbol: 'SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c' },
  { batch: 'k2w6-b1', va: '0x6FC62D90', size: 295, headHex: '83ec6c8b44247053', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c' },
  { batch: 'k2w6-b1', va: '0x6FC652C0', size: 322, headHex: '83ec6c558b6c2474', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC65850', size: 672, headHex: '83ec1053558b6c24', tailHex: 'c20800', tsSymbol: 'SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c' },
  { batch: 'k2w6-b1', va: '0x6FC66210', size: 388, headHex: '5153558b6c241085', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c' },
  { batch: 'k2w6-b1', va: '0x6FC66A20', size: 240, headHex: '515355578b7c2414', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c' },
  { batch: 'k2w6-b1', va: '0x6FC6C870', size: 368, headHex: '83ec0c53558b6c24', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c' },
  { batch: 'k2w6-b1', va: '0x6FC6EC30', size: 68, headHex: '85f67405833e0174', tailHex: 'f7d8c3', tsSymbol: 'SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c' },
  { batch: 'k2w6-b1', va: '0x6FC6ED60', size: 102, headHex: '56578bfa8bc7e835', tailHex: 'c20800', tsSymbol: 'SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c' },
  { batch: 'k2w6-b1', va: '0x6FC6EE80', size: 84, headHex: '85f6750533c0c208', tailHex: 'c20800', tsSymbol: 'SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c' },
  { batch: 'k2w6-b1', va: '0x6FC70B70', size: 566, headHex: '83ec305355568bea', tailHex: 'c430c3', tsSymbol: 'SKILLS_ApplyAttractCurseCallback_6FC70B70_113c' },
  { batch: 'k2w6-b1', va: '0x6FC7B8C0', size: 239, headHex: '538b5c241055568b', tailHex: 'c20c00', tsSymbol: 'ACT5Q3_StatusFilter_6FC7B8C0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC833C0', size: 418, headHex: '558bec83e4f881ec', tailHex: 'f9ffcc', tsSymbol: 'ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c' },
  { batch: 'k2w6-b1', va: '0x6FC85500', size: 237, headHex: '5355568b74241457', tailHex: 'c20c00', tsSymbol: 'ACT1Q5_StatusFilter_6FC85500_113c' },
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

function createWave6World() {
  const m = new SparseMemory113c()
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x28000, 0)

  const pDataTables = m.alloc(0x2000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)
  ensureD2CommonPathGlobals113c(m)

  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(SGPT_DATATABLES_VA_113C, pDataTables)
  const pDtHolder = m.alloc(4) >>> 0
  m.setU32(pDtHolder, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDtHolder)

  const pBitmasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitmasks)
  m.setU32(GDW_BITMASKS_IAT_VA_113C, pBitmasks)
  m.setU32(0x6fd31c20, 0)

  // Body grid definition (BODY_GRID_DEF_VA_113C = 0x6fded378)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)

  // Experience.bin (105 levels * 8 dwords)
  const pExpBin = m.alloc(105 * 8 * 4) >>> 0
  for (let lvl = 0; lvl < 105; lvl++) {
    for (let c = 0; c < 8; c++) {
      m.setU32((pExpBin + (lvl * 8 + c) * 4) >>> 0, (lvl * lvl * 1000) >>> 0)
    }
  }
  m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpBin)

  // CharStats (7 * 0xC4)
  const pCharStats = m.alloc(7 * 0xc4) >>> 0
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStats)
  m.setU32((pDataTables + 0xbc8) >>> 0, 7)

  // SkillsTxt (360 * 0x23C) + class skill lists
  const skillsCount = 360
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  for (let i = 0; i < skillsCount; i++) {
    m.setU16((pSkillsTxt + i * 0x23c) >>> 0, i)
  }
  m.setU32((pDataTables + DATATABLES_OFF_113C.pSkillsTxt) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nSkillsTxtRecordCount) >>> 0, skillsCount)
  m.setU32((pDataTables + 0xba8) >>> 0, 30)
  const pClassSkillCounts = m.alloc(7 * 4) >>> 0
  const pClassSkillLists = m.alloc(7 * 30 * 2) >>> 0
  m.setU32((pDataTables + 0xba4) >>> 0, pClassSkillCounts)
  m.setU32((pDataTables + 0xbac) >>> 0, pClassSkillLists)
  for (let c = 0; c < 7; c++) {
    m.setU32((pClassSkillCounts + c * 4) >>> 0, 30)
    const baseSk = 6 + c * 30
    for (let j = 0; j < 30; j++) {
      m.setU16((pClassSkillLists + (c * 30 + j) * 2) >>> 0, baseSk + j)
    }
  }

  // SkillCalc RPN bytecode buffer (+0x40 / +0x44)
  const pSkillCode = m.alloc(0x400) >>> 0
  m.setU32((pDataTables + 0x40) >>> 0, pSkillCode)
  m.setU32((pDataTables + 0x44) >>> 0, 0x400)

  // MissilesTxt (400 * 0x1A4)
  const missilesCount = 400
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pMissilesTxt) >>> 0, pMissilesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nMissilesTxtRecordCount) >>> 0, missilesCount)
  m.setU32(0x6fdf0a3c, pMissilesTxt)
  m.setU32(0x6fdf0a44, missilesCount)

  // StatesTxt (200 * 0x40) + state masks
  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x40) >>> 0
  for (let i = 0; i < statesCount; i++) {
    m.setU16((pStatesTxt + i * 0x40 + 0x02) >>> 0, 0xffff)
  }
  m.setU32((pDataTables + DATATABLES_OFF_113C.pStatesTxt) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xc0) >>> 0, pStatesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0, statesCount)
  m.setU32((pDataTables + 0xbbc) >>> 0, pStatesTxt)
  m.setU32((pDataTables + 0xbc0) >>> 0, statesCount)
  const pStateMask = m.alloc(64) >>> 0
  for (let off = 0xc8; off <= 0x178; off += 4) {
    m.setU32((pDataTables + off) >>> 0, pStateMask)
  }

  // ItemStatCost (400 * 0x144)
  const iscCount = 400
  const pIscTxt = m.alloc(iscCount * 0x144) >>> 0
  m.setU32((pDataTables + 0x2c) >>> 0, pIscTxt)
  m.setU32((pDataTables + 0x34) >>> 0, iscCount)
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pIscTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, iscCount)
  m.setU32(0x6fde9e48, pIscTxt)
  m.setU32(0x6fde9e50, iscCount)

  // MonStatsTxt (600 * 0x1A8) & MonStats2Txt (600 * 0x134)
  const monCount = 600
  const pMonStatsTxt = m.alloc(monCount * 0x1a8) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0, monCount)
  m.setU32(0x6fdf0950, pMonStatsTxt)
  m.setU32(0x6fdf0958, monCount)
  const pMonStats2Txt = m.alloc(monCount * 0x134) >>> 0
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa8c) >>> 0, monCount)
  m.setU32((pDataTables + DATATABLES_OFF_113C.pMonStats2Txt) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nMonStats2TxtRecordCount) >>> 0, monCount)
  for (let id = 0; id < monCount; id++) {
    const rec = (pMonStatsTxt + id * 0x1a8) >>> 0
    m.setU16(rec, id)
    m.setU16((rec + 0x02) >>> 0, id)
    m.setU16((rec + 0x06) >>> 0, id)
    m.setU16((rec + 0x18) >>> 0, id) // D2MonStatsTxt.wMonStatsEx
    m.setU16((rec + 0x56) >>> 0, 10)
    m.setU16((rec + 0x58) >>> 0, 10)
    m.setU16((rec + 0x5a) >>> 0, 10)
  }

  // MonLvlTxt / DifficultyLevels (120 * D2MonLvlTxt_SIZE)
  const pMonLvlTxt = m.alloc(120 * D2MonLvlTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xb70) >>> 0, pMonLvlTxt)
  m.setU32((pDataTables + 0xb74) >>> 0, 120)
  m.setU32(0x6fdf0b54, pMonLvlTxt)
  m.setU32(0x6fdf0b58, 120)
  for (let lvl = 1; lvl < 120; lvl++) {
    for (let col = 0; col < 24; col++) {
      m.setU32((pMonLvlTxt + lvl * D2MonLvlTxt_SIZE + col * 4) >>> 0, 100)
    }
  }

  // MonUModTxt (64 * 0x20)
  const pMonUModTxt = m.alloc(64 * 0x20) >>> 0
  m.setU32((pDataTables + 0xc50) >>> 0, pMonUModTxt)
  m.setU32((pDataTables + 0xc54) >>> 0, 64)
  for (let i = 0; i < 64; i++) {
    m.setU32((pMonUModTxt + i * 0x20 + 0x1c) >>> 0, 50)
  }

  // SuperUniques count
  m.setU32((pDataTables + 0xa74) >>> 0, 66)
  m.setU32(0x6fdf0dc4, 66)

  // LevelsTxt (140 * D2LevelsTxt_SIZE) + Act town bounds
  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0x1dc) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0x1e0) >>> 0, 140)
  m.setU32((pDataTables + 0xbb8) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt)
  m.setU32((pDataTables + 0xc5c) >>> 0, 140)
  m.setU32(0x6fdf1434, pLevelsTxt)
  m.setU32(0x6fdf1438, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
  }
  const actBounds = [1, 40, 75, 103, 109, 137]
  for (let i = 0; i < actBounds.length; i++) {
    m.setU32((0x6fde4084 + i * 4) >>> 0, actBounds[i]!)
  }

  // ObjectsTxt (600 * 0x1C0), ObjGroupTxt (32 * 0xB8), ShrinesTxt (32 * 0x108)
  const pObjectsTxt = m.alloc(600 * 0x1c0) >>> 0
  m.setU32((pDataTables + 0xc98) >>> 0, pObjectsTxt)
  m.setU32((pDataTables + 0xca0) >>> 0, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)
  for (let i = 0; i < 600; i++) {
    const rec = (pObjectsTxt + i * 0x1c0) >>> 0
    m.setU32((rec + 0xd0) >>> 0, 1)
    m.setU32((rec + 0xd4) >>> 0, 1)
    m.setU32((rec + 0xdc) >>> 0, 1)
    m.setU32((rec + 0xe0) >>> 0, 1)
  }
  const pObjGroupTxt = m.alloc(32 * 0xb8) >>> 0
  m.setU32(SGPT_OBJGROUP_TXT_PTR_VA, pObjGroupTxt)
  m.setU32(SGPT_OBJGROUP_TXT_COUNT_VA, 32)
  const pShrinesTxt = m.alloc(32 * 0x108) >>> 0
  m.setU32(0x6fdf0b9c, pShrinesTxt)
  m.setU32(0x6fdf0ba0, 32)

  // ItemsTxt (64 * 0x1A8) + ItemTypesTxt (64 * D2ItemTypesTxt_SIZE) + Linker ('gld ' = 1, 'ear ' = 2)
  const pItemsTxt = m.alloc(64 * ITEMS_TXT_STRIDE_113C) >>> 0
  m.setU32((pDataTables + 0x00) >>> 0, 64)
  m.setU32((pDataTables + 0x04) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xbd8) >>> 0, pItemsTxt)
  m.setU32((pDataTables + 0xbdc) >>> 0, 64)
  m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 64)
  m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, 64)
  m.setU32(0x6fdefb94, 64)
  m.setU32(0x6fdefb98, pItemsTxt)
  m.setU32(0x6fdefb9c, pItemsTxt)
  m.setU32(0x6fdefba0, 16)
  m.setU32(0x6fdefba4, (pItemsTxt + 16 * D2ItemsTxt_SIZE) >>> 0)
  m.setU32(0x6fdefba8, 16)
  m.setU32(0x6fdefbac, (pItemsTxt + 32 * D2ItemsTxt_SIZE) >>> 0)
  m.setU32(0x6fdefbb0, 32)
  m.setU32((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20646c67) // 'gld '
  m.setU8((pItemsTxt + 1 * D2ItemsTxt_SIZE + 0x14d) >>> 0, 1)
  m.setU32((pItemsTxt + 2 * D2ItemsTxt_SIZE + 0x80) >>> 0, 0x20726165) // 'ear '
  m.setU8((pItemsTxt + 2 * D2ItemsTxt_SIZE + 0x14d) >>> 0, 1)

  const pLinker = m.alloc(0x10) >>> 0
  const pLinkerRows = m.alloc(2 * 8) >>> 0
  m.setU32(pLinker, 2)
  m.setU32((pLinker + 0x08) >>> 0, pLinkerRows)
  m.setU32(pLinkerRows, 0x20646c67)
  m.setU32((pLinkerRows + 0x04) >>> 0, 1)
  m.setU32((pLinkerRows + 0x08) >>> 0, 0x20726165)
  m.setU32((pLinkerRows + 0x0c) >>> 0, 2)
  m.setU32(SGPT_ITEMS_LINKER_PTR_VA, pLinker)

  const pItemTypesTxt = m.alloc(64 * D2ItemTypesTxt_SIZE) >>> 0
  m.setU32((pDataTables + 0xbf8) >>> 0, pItemTypesTxt)
  m.setU32((pDataTables + 0xbfc) >>> 0, 64)
  m.setU32((pDataTables + 0xc00) >>> 0, 2)
  const pItemTypesHierarchy = m.alloc(64 * 8) >>> 0
  m.setU32((pDataTables + 0xc04) >>> 0, pItemTypesHierarchy)
  for (let t = 0; t < 64; t++) {
    const wordIdx = t >>> 5
    const bitMask = (1 << (t & 31)) >>> 0
    m.setU32((pItemTypesHierarchy + t * 8 + wordIdx * 4) >>> 0, bitMask)
    m.setU8((pItemTypesTxt + t * D2ItemTypesTxt_SIZE + 0x2b) >>> 0, 0xff)
    m.setU8((pItemTypesTxt + t * D2ItemTypesTxt_SIZE + 0x2c) >>> 0, 0xff)
  }

  // Unique/Set/MagicAffix/QualityItems tables
  const pUniqueItemsTxt = m.alloc(16 * 0x14c) >>> 0
  m.setU32((pDataTables + 0xc24) >>> 0, pUniqueItemsTxt)
  m.setU32((pDataTables + 0xc28) >>> 0, 16)
  const pSetsTxt = m.alloc(8 * 0x128) >>> 0
  m.setU32((pDataTables + 0xc0c) >>> 0, pSetsTxt)
  m.setU32((pDataTables + 0xc10) >>> 0, 8)
  const pSetItemsTxt = m.alloc(16 * 0x1b8) >>> 0
  m.setU32((pDataTables + 0xc18) >>> 0, pSetItemsTxt)
  m.setU32((pDataTables + 0xc1c) >>> 0, 16)
  const pMagicAffixTxt = m.alloc(16 * 0x90) >>> 0
  m.setU32(SGPT_MAGICAFFIX_TXT_COUNT_VA, 0)
  m.setU32(SGPT_MAGICAFFIX_TXT_PTR_VA, pMagicAffixTxt)
  const pQualityItemsTxt = m.alloc(8 * 0x70) >>> 0
  m.setU32(SGPT_QUALITYITEMS_TXT_COUNT_VA, 0)
  m.setU32(SGPT_QUALITYITEMS_TXT_PTR_VA, pQualityItemsTxt)

  // AnimData + Mode tables
  const pAnimDataTable = m.alloc(0x500) >>> 0
  const pEmptyBucket = m.alloc(16) >>> 0
  for (let i = 0; i < 256; i++) {
    m.setU32((pAnimDataTable + i * 4) >>> 0, pEmptyBucket)
  }
  m.setU32((pAnimDataTable + 0x40c) >>> 0, 8)
  m.setU32((pAnimDataTable + 0x410) >>> 0, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13a4, 20)
  m.setU32(0x6fdf13b0, m.alloc(20 * 0x34) >>> 0)
  m.setU32(0x6fdf13c4, 20)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34) >>> 0)
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34) >>> 0)

  const fieldDx = [0, 1, 1, 1, 0, -1, -1, -1, 0]
  const fieldDy = [-1, -1, 0, 1, 1, 1, 0, -1, 0]
  for (let i = 0; i < 9; i++) {
    m.setU32((0x6fde9ba0 + i * 4) >>> 0, fieldDx[i]! >>> 0)
    m.setU32((0x6fde9bc4 + i * 4) >>> 0, fieldDy[i]! >>> 0)
  }
  const pFieldData = m.alloc(256 * 256) >>> 0
  m.fill(pFieldData, 256 * 256, 8)
  m.setU32(0x6fdf1404, pFieldData)
  m.setU32(0x6fdf1414, 128)
  m.setU32(0x6fdf1418, 128)

  const pGame = m.alloc(0x2000) >>> 0
  m.setU32((pGame + 0x1c) >>> 0, 0x00ab_cd00)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  m.setU32((pGame + 0x1d28) >>> 0, m.alloc(0x20) >>> 0)
  const pObjRegion = m.alloc(0x400) >>> 0
  const pActCtrl = m.alloc(0x40) >>> 0
  m.setU32((pActCtrl + 0x08) >>> 0, 16)
  const pMonReg = m.alloc(0x300) >>> 0
  for (let lvl = 0; lvl < 140; lvl++) {
    m.setU32((pObjRegion + 0x48 + lvl * 4) >>> 0, pActCtrl)
    m.setU32((pGame + 0xf0 + lvl * 4) >>> 0, pMonReg)
  }
  m.setU32((pGame + 0x10f0) >>> 0, pObjRegion)
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pDataTables,
    pExpBin,
    pCharStats,
    pSkillsTxt,
    pSkillCode,
    pMissilesTxt,
    pStatesTxt,
    pIscTxt,
    pMonStatsTxt,
    pMonStats2Txt,
    pMonLvlTxt,
    pMonUModTxt,
    pLevelsTxt,
    pObjectsTxt,
    pObjGroupTxt,
    pShrinesTxt,
    pItemsTxt,
    pItemTypesTxt,
    pUniqueItemsTxt,
    pSetsTxt,
    pSetItemsTxt,
    pMagicAffixTxt,
    pQualityItemsTxt,
  }
}

function writeRpnImm32(m: SparseMemory113c, pSkillCode: number, offset: number, val: number): number {
  const addr = (pSkillCode + offset) >>> 0
  m.setU8(addr, 0x09)
  m.setU32((addr + 1) >>> 0, val >>> 0)
  m.setU8((addr + 5) >>> 0, 0x00)
  return offset
}

function allocRoom(
  m: SparseMemory113c,
  levelId = 2,
  subX = 100,
  subY = 200,
  subW = 40,
  subH = 40,
) {
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE) >>> 0
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE) >>> 0
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE) >>> 0
  const pAct = m.alloc(0x80) >>> 0
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.setU32((pRoom + 0x2c) >>> 0, pAct)
  m.setU32((pRoom + 0x4c) >>> 0, subX >>> 0)
  m.setU32((pRoom + 0x50) >>> 0, subY >>> 0)
  m.setU32((pRoom + 0x54) >>> 0, subW >>> 0)
  m.setU32((pRoom + 0x58) >>> 0, subH >>> 0)
  const pLogicalRoomInfo = m.alloc(0x80) >>> 0
  m.setU8(pLogicalRoomInfo, 1)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pRoomEx, D2RoomExStrc.pLogicalRoomInfo, pLogicalRoomInfo)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, levelId)
  m.setU32((pRoom + 0x6c) >>> 0, 0x12345678)
  m.setU32((pRoom + 0x70) >>> 0, 0x0000029a)
  bindRoomCollisionGrid113c(m, pRoom, subX, subY, subW, subH, () => 0)
  return { pRoom, pRoomEx, pLevel, pAct }
}

function allocDynamicUnit(
  m: SparseMemory113c,
  pGame: number,
  unitType: number,
  classId: number,
  guid: number,
  pRoom: number,
  x = 110,
  y = 210,
) {
  const pUnit = m.alloc(0x120) >>> 0
  const pDynPath = m.alloc(0x280) >>> 0
  m.setU32(pUnit, unitType >>> 0)
  m.setU32((pUnit + 0x04) >>> 0, classId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, 1)
  m.setU32((pUnit + 0x20) >>> 0, (0x11111111 + guid * 17) >>> 0)
  m.setU32((pUnit + 0x24) >>> 0, 0x0000029a)
  m.setU32((pUnit + 0x2c) >>> 0, pDynPath)
  m.setU32((pUnit + 0x80) >>> 0, pGame)
  m.setU16((pDynPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pDynPath + 0x06) >>> 0, y & 0xffff)
  m.setU32((pDynPath + 0x10) >>> 0, x >>> 0)
  m.setU32((pDynPath + 0x14) >>> 0, y >>> 0)
  m.setU32((pDynPath + 0x1c) >>> 0, pRoom)
  m.set(pDynPath, D2DynamicPathStrc.pUnit, pUnit)

  const pStatListEx = STATLIST_CreateEx113c(m, pUnit, 0, pGame) >>> 0
  m.setU32((pUnit + 0x5c) >>> 0, pStatListEx)

  let pUnitData = 0
  if (unitType === 0) {
    pUnitData = m.alloc(0x180) >>> 0
    const pClient = m.alloc(0x600) >>> 0
    m.setU32((pClient + 0x04) >>> 0, 4)
    m.setU32((pUnitData + 0x9c) >>> 0, pClient)
    for (let d = 0; d < 3; d++) {
      m.setU32((pUnitData + 0x10 + d * 4) >>> 0, QUESTRECORD_AllocRecord113c(m, 0) >>> 0)
    }
    const pInv = INVENTORY_AllocInventory113c(m, 0, pUnit) >>> 0
    m.setU32((pUnit + 0x60) >>> 0, pInv)
  } else if (unitType === 1) {
    pUnitData = m.alloc(0x80) >>> 0
    const pDt = m.u32(0x6fde9e1c) >>> 0
    const pMonTxt = m.u32((pDt + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0) >>> 0
    if (pMonTxt !== 0) {
      m.setU32(pUnitData, (pMonTxt + (classId >>> 0) * 0x1a8) >>> 0)
    }
    const pAiGeneral = m.alloc(0x60) >>> 0
    m.setU32((pUnitData + 0x28) >>> 0, pAiGeneral)
  }
  m.setU32((pUnit + 0x14) >>> 0, pUnitData)
  SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  return { pUnit, pDynPath, pUnitData, pStatListEx }
}

function allocItemUnit(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  guid: number,
  quality = 2,
  ilvl = 40,
  itemFormat = 100,
) {
  const pItem = m.alloc(0x100) >>> 0
  const pItemData = m.alloc(D2ItemDataStrc_SIZE) >>> 0
  m.set(pItem, D2UnitStrc.dwUnitType, 4)
  m.set(pItem, D2UnitStrc.dwClassId, classId)
  m.set(pItem, D2UnitStrc.dwUnitId, guid)
  m.set(pItem, D2UnitStrc.pUnitData, pItemData)
  m.setU32((pItem + 0x20) >>> 0, 0x13579bdf)
  m.setU32((pItem + 0x24) >>> 0, 0x0000029a)
  m.setU32((pItem + 0x80) >>> 0, pGame)
  m.set(pItemData, D2ItemDataStrc.dwQuality, quality)
  m.set(pItemData, D2ItemDataStrc.dwItemLevel, ilvl)
  m.set(pItemData, D2ItemDataStrc.wItemFormat, itemFormat)
  m.setU32((pItemData + 0x04) >>> 0, 0x2468ace1)
  m.setU32((pItemData + 0x08) >>> 0, 0x0000029a)
  const pStatListEx = STATLIST_CreateEx113c(m, pItem, 0, pGame) >>> 0
  m.setU32((pItem + 0x5c) >>> 0, pStatListEx)
  return { pItem, pItemData, pStatListEx }
}

function installAffixTablesForType(m: SparseMemory113c, itemTypeId: number) {
  // Rare affixes: index 0 dummy, index 1 suffix, indices 2..3 prefixes (stride 0x48)
  const pRareBase = m.alloc(4 * 0x48) >>> 0
  for (let i = 1; i < 4; i++) {
    const rec = (pRareBase + i * 0x48) >>> 0
    m.setU16((rec + 0x0e) >>> 0, 0) // wVersion
    m.setU16((rec + 0x10) >>> 0, itemTypeId & 0xffff) // iType0
  }
  m.setU32(SG_RARE_AFFIX_DATATABLES_VA_113C, 4)
  m.setU32((SG_RARE_AFFIX_DATATABLES_VA_113C + 0x04) >>> 0, pRareBase)
  m.setU32((SG_RARE_AFFIX_DATATABLES_VA_113C + 0x08) >>> 0, (pRareBase + 1 * 0x48) >>> 0)
  m.setU32((SG_RARE_AFFIX_DATATABLES_VA_113C + 0x0c) >>> 0, (pRareBase + 2 * 0x48) >>> 0)

  // Magic affixes: index 0 dummy, indices 1..3 suffixes, indices 4..6 prefixes, index 7 auto (stride 0x90)
  const pMagicBase = m.alloc(8 * 0x90) >>> 0
  for (let i = 1; i < 8; i++) {
    const rec = (pMagicBase + i * 0x90) >>> 0
    m.setU16((rec + 0x22) >>> 0, 0) // wVersion
    m.setU32((rec + 0x24) >>> 0, 0xffffffff) // prop0 = -1
    m.setU32((rec + 0x34) >>> 0, 0xffffffff) // prop1 = -1
    m.setU32((rec + 0x44) >>> 0, 0xffffffff) // prop2 = -1
    m.setU8((rec + 0x54) >>> 0, 1) // nSpawnable
    m.setU32((rec + 0x58) >>> 0, 1) // dwLevel
    m.setU32((rec + 0x5c) >>> 0, (100 + i) >>> 0) // distinct dwGroup
    m.setU32((rec + 0x60) >>> 0, 99) // dwMaxLevel
    m.setU8((rec + 0x64) >>> 0, 1) // nRare
    m.setU8((rec + 0x66) >>> 0, 0xff) // nClassSpecific = none
    m.setU16((rec + 0x6a) >>> 0, itemTypeId & 0xffff) // iType0
    m.setU8((rec + 0x82) >>> 0, 10) // nFrequency
  }
  m.setU32(SG_MAGIC_AFFIX_DATATABLES_VA_113C, 8)
  m.setU32((SG_MAGIC_AFFIX_DATATABLES_VA_113C + 0x04) >>> 0, pMagicBase)
  m.setU32((SG_MAGIC_AFFIX_DATATABLES_VA_113C + 0x08) >>> 0, (pMagicBase + 1 * 0x90) >>> 0)
  m.setU32((SG_MAGIC_AFFIX_DATATABLES_VA_113C + 0x0c) >>> 0, (pMagicBase + 4 * 0x90) >>> 0)
  m.setU32((SG_MAGIC_AFFIX_DATATABLES_VA_113C + 0x10) >>> 0, (pMagicBase + 7 * 0x90) >>> 0)
  m.setU32(SGPT_MAGICAFFIX_TXT_COUNT_VA, 8)
  m.setU32(SGPT_MAGICAFFIX_TXT_PTR_VA, pMagicBase)
}

function attachUsedSkill(m: SparseMemory113c, pUnit: number, skillId: number, skillLvl: number, param1 = 0) {
  const pInfo = m.alloc(0x20) >>> 0
  const pSkill = m.alloc(0x40) >>> 0
  const pSkillsTxt = m.u32((m.u32(0x6fde9e1c) + 0xb98) >>> 0) >>> 0
  m.setU32(pSkill, (pSkillsTxt + skillId * 0x23c) >>> 0)
  m.setU32((pSkill + 0x28) >>> 0, skillLvl >>> 0)
  SKILLS_SetParam1113c(m, pSkill, param1)
  m.setU32((pInfo + 0x00) >>> 0, pSkill)
  m.setU32((pInfo + 0x04) >>> 0, pSkill)
  m.setU32((pInfo + 0x08) >>> 0, pSkill)
  m.setU32((pInfo + 0x0c) >>> 0, pSkill)
  m.setU32((pInfo + 0x10) >>> 0, pSkill)
  m.setU32((pUnit + 0xa8) >>> 0, pInfo)
  return { pInfo, pSkill }
}

describe('[K2] D2Game 1.13c Disassembly-Verified Promotion Wave 6 (+158 VAs: Lane P)', () => {
  it('validates manifest diff-verified status and real PE32 D2Game.dll (0x6FC20000) opcodes across all 158 VAs', () => {
    expect(WAVE6_PROMOTED_SPECS.length).toBe(158)
    const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))

    const d2GameFnByVa = new Map(
      manifest.functions
        .filter((f) => f.module === 'D2Game')
        .map((f) => [f.va.toUpperCase(), f]),
    )

    for (const spec of WAVE6_PROMOTED_SPECS) {
      const fn = d2GameFnByVa.get(spec.va.toUpperCase())
      expect(fn, `Missing manifest entry for ${spec.va}`).toBeDefined()
      expect(fn!.status, `${spec.va} (${fn!.name}) must be diff-verified`).toBe('diff-verified')
      expect(fn!.tsSymbol).toBe(spec.tsSymbol)
      expect(fn!.size).toBe(spec.size)
      expect(Boolean(fn!.indirectUnknown)).toBe(false)
      expect(fn!.diffEvidence).toContain('tests/oracle/k2/k2-disasm-verified-wave6.test.ts')
    }

    const d2GameDllPath = path.join(D2_DATA_DIR, 'D2Game.dll')
    if (fs.existsSync(d2GameDllPath)) {
      const pe = loadPeSectionMapper(d2GameDllPath, 0x6fc20000)
      for (const spec of WAVE6_PROMOTED_SPECS) {
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
      }
    }
  })

  describe('1.13c PE32 Disassembly Bug Fix Differential Tests (12 Fixes)', () => {
    it('Fix #1 (0x6FC301E0): ITEMS_InitAndApplySuperiorQualityMods delegates to real ITEMS_RollItemQualityOnCreatedItem (0x6FC2EE90)', () => {
      const { m, pGame, pItemsTxt } = createWave6World()
      m.setU16((pItemsTxt + 5 * D2ItemsTxt_SIZE + 0x11e) >>> 0, 5)
      const { pItem, pItemData } = allocItemUnit(m, pGame, 5, 10, 2, 30, 100)
      const ppItem = m.alloc(4) >>> 0
      const pdwSeed = m.alloc(4) >>> 0
      const pDrop = m.alloc(0x90) >>> 0
      m.setU32(ppItem, pItem)
      m.setU32(pdwSeed, 0x12345678)
      m.setU32((pDrop + 0x0c) >>> 0, 30)

      beginVaTrace113c()
      ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c(m, ppItem, pdwSeed, pDrop)
      const hits = endVaTrace113c()

      expect(hits.has('D2Game:0x6FC301E0')).toBe(true)
      expect(hits.has('D2Game:0x6FC2EE90')).toBe(true)
      expect(ITEMS_GetItemQuality113c(m, pItem)).toBe(3)
      expect(m.u32((pDrop + 0x30) >>> 0)).toBe(3)
      expect(ITEMS_GetOwnerGuid113c(m, pItem)).toBe(0x12345678)
    })

    it('Fix #2 (0x6FC303C0, 0x6FC34BF0, 0x6FC34F20, 0x6FC35240): Magic/Crafted/Tempered/Rare affix rollers invoke real ITEMS_RollStaffModsOnItem (0x6FC33DE0)', () => {
      const { m, pGame, pItemsTxt } = createWave6World()
      const itemTypeId = 5
      m.setU16((pItemsTxt + 5 * D2ItemsTxt_SIZE + 0x11e) >>> 0, itemTypeId)
      installAffixTablesForType(m, itemTypeId)

      const makeDrop = () => {
        const pDrop = m.alloc(0x90) >>> 0
        m.setU32((pDrop + 0x0c) >>> 0, 45) // ilvl
        return pDrop
      }

      // 0x6FC303C0: TryRollAndApplyMagicAffixes
      const itMagic = allocItemUnit(m, pGame, 5, 20, 4, 45, 100)
      const ppMagic = m.alloc(4) >>> 0
      m.setU32(ppMagic, itMagic.pItem)
      beginVaTrace113c()
      const rMagic = ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c(m, ppMagic, makeDrop())
      const hitsMagic = endVaTrace113c()
      expect(rMagic).toBe(1)
      expect(hitsMagic.has('D2Game:0x6FC33DE0')).toBe(true)

      // 0x6FC34BF0: Crafted
      const itCraft = allocItemUnit(m, pGame, 5, 21, 8, 45, 100)
      beginVaTrace113c()
      const rCraft = ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c(m, itCraft.pItem, makeDrop())
      const hitsCraft = endVaTrace113c()
      expect(rCraft).toBe(1)
      expect(hitsCraft.has('D2Game:0x6FC33DE0')).toBe(true)

      // 0x6FC34F20: Tempered / Rare
      const itTemp = allocItemUnit(m, pGame, 5, 22, 9, 45, 100)
      beginVaTrace113c()
      const rTemp = ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c(m, itTemp.pItem, makeDrop())
      const hitsTemp = endVaTrace113c()
      expect(rTemp).toBe(1)
      expect(hitsTemp.has('D2Game:0x6FC33DE0')).toBe(true)

      // 0x6FC35240: Rare (class-of-bug sweep)
      const itRare = allocItemUnit(m, pGame, 5, 23, 6, 45, 100)
      beginVaTrace113c()
      const rRare = ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c(m, itRare.pItem, makeDrop())
      const hitsRare = endVaTrace113c()
      expect(rRare).toBe(1)
      expect(hitsRare.has('D2Game:0x6FC33DE0')).toBe(true)
    })

    it('Fix #3 (0x6FC32AF0): ITEMS_SpawnAndDropPlayerEar delegates to real ITEMS_FindFreeGroundDropCoords (0x6FC2E930)', () => {
      const { m, pGame } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const { pUnit: pPlayer } = allocDynamicUnit(m, pGame, 0, 0, 1, pRoom, 112, 212)
      STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 55, 0)

      beginVaTrace113c()
      ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c(m, pPlayer, pGame)
      const hits = endVaTrace113c()

      expect(hits.has('D2Game:0x6FC32AF0')).toBe(true)
      expect(hits.has('D2Game:0x6FC2E930')).toBe(true)
    })

    it('Fix #4 (0x6FC373D0): AI_ThinkPackIdlePatrol writes D2AiCmdStrc opcode at +0x08 (not +0x00) and avoids fixed 0x00f0_b150 scratch', () => {
      const { m, pGame } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const leader = allocDynamicUnit(m, pGame, 1, 10, 100, pRoom, 110, 210)
      const minion = allocDynamicUnit(m, pGame, 1, 10, 101, pRoom, 112, 210)

      // Link minion into leader's pack minion list (`pAiGeneral + 0x34`)
      const pLeaderAiGen = m.u32((leader.pUnitData + 0x28) >>> 0) >>> 0
      const pMinionAiGen = m.u32((minion.pUnitData + 0x28) >>> 0) >>> 0
      const pMinionNode = m.alloc(0x10) >>> 0
      m.setU32(pMinionNode, 101)
      m.setU32((pMinionNode + 0x04) >>> 0, 0)
      m.setU32((pLeaderAiGen + 0x34) >>> 0, pMinionNode)
      m.setU32((pLeaderAiGen + 0x28) >>> 0, pGame)
      m.setU32((pLeaderAiGen + 0x2c) >>> 0, 100)
      m.setU32((pLeaderAiGen + 0x30) >>> 0, 1)
      m.setU32((pMinionAiGen + 0x28) >>> 0, pGame)
      m.setU32((pMinionAiGen + 0x2c) >>> 0, 100)
      m.setU32((pMinionAiGen + 0x30) >>> 0, 1)

      // Force bBreakPack (nAiState = 3 at pMonsterData + 0x54)
      m.setU32((leader.pUnitData + 0x54) >>> 0, 3)
      const pAiTickArgs = m.alloc(0x40) >>> 0
      const pAiControl = m.alloc(0x40) >>> 0
      m.setU32(pAiTickArgs, pAiControl)

      // Sentinel on legacy fixed scratch address must remain untouched
      m.setU32(0x00f0_b150, 0xdeadbeef)
      m.setU32(0x00f0_b160, 0xcafebabe)

      AI_ThinkPackIdlePatrol_6FC373D0_113c(m, pGame, leader.pUnit, pAiTickArgs)

      // Minion's received D2AiCmdStrc (pMinionAiGen + 0x20) must carry opcode 8 at +0x08!
      const pRecvCmd = m.u32((pMinionAiGen + 0x20) >>> 0) >>> 0
      expect(pRecvCmd).not.toBe(0)
      expect(m.u32((pRecvCmd + 0x08) >>> 0)).toBe(8)
      expect(m.u32(0x00f0_b150)).toBe(0xdeadbeef)
      expect(m.u32(0x00f0_b160)).toBe(0xcafebabe)
    })

    it('Fix #5 (0x6FC4F580): OBJECTS_OperateGoldChestOrPile updates checkBaseX to baseX + dx per 0x6fc4f62e/0x6fc4f655', () => {
      const { m, pGame } = createWave6World()
      // Room covers X in [100, 110) (right edge = 109), Y in [200, 220)
      const { pRoom } = allocRoom(m, 2, 100, 200, 10, 20)
      const pObj = m.alloc(0x100) >>> 0
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x04) >>> 0, 5)
      m.setU32((pObj + 0x0c) >>> 0, 50)
      m.setU32((pObj + 0x10) >>> 0, 0)
      const pStaticPath = m.alloc(0x20) >>> 0
      m.setU32(pStaticPath, pRoom)
      m.setU32((pObj + 0x2c) >>> 0, pStaticPath)

      // Seed producing nPiles >= 2 and dx1 = 2, dx2 = 2 (verify via deterministic seed search)
      const pSeed = m.alloc(8) >>> 0
      let foundSeed = 0
      for (let s = 1; s < 5000; s++) {
        // Replicate 1.13c stepSeed64At113c: lo' = (lo * 0x6ac690c5 + hi) >>> 0
        let lo = s >>> 0
        let hi = 0x29a >>> 0
        const step = () => {
          const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
          lo = Number(prod & 0xffffffffn) >>> 0
          hi = Number((prod >> 32n) & 0xffffffffn) >>> 0
          return lo
        }
        const nPiles = (step() % 9) + 1
        if (nPiles !== 2) continue
        const dx1 = step() & 3
        step() // dy1
        const dx2 = step() & 3
        step() // dy2
        if (dx1 === 2 && dx2 === 2) {
          foundSeed = s
          break
        }
      }
      expect(foundSeed).toBeGreaterThan(0)
      m.setU32(pSeed, foundSeed)
      m.setU32((pSeed + 4) >>> 0, 0x29a)

      // Place baseX = 107 inside [100..109]:
      // Iter 1: checkX = 107 + 2 = 109 (IN room!) -> checkBaseX becomes 107 + 2 = 109, spawns pile #1!
      // Iter 2: checkX = checkBaseX(109) + 2 = 111 (OUTSIDE [100..109]!) -> skips pile #2!
      // (Buggy code reset checkBaseX = 107, so iter 2 probed 109 and spawned 2 piles!)
      const pOpArgs = m.alloc(0x20) >>> 0
      m.setU32(pOpArgs, pGame)
      m.setU32((pOpArgs + 0x04) >>> 0, pObj)
      m.setU32((pOpArgs + 0x08) >>> 0, pRoom)
      m.setU32((pOpArgs + 0x0c) >>> 0, pSeed)
      m.setU32((pOpArgs + 0x14) >>> 0, 107)
      m.setU32((pOpArgs + 0x18) >>> 0, 205)

      m.setU32(0x00f0_b1a0, 0x11223344)
      const countBefore = m.u32((pGame + 0x1120) >>> 0)
      void countBefore
      OBJECTS_OperateGoldChestOrPile_6FC4F580_113c(m, pOpArgs)

      expect(m.u32((pObj + 0x10) >>> 0)).toBe(2) // switched to mode 2 (opened)
      expect(m.u32(0x00f0_b1a0)).toBe(0x11223344) // dedicated stack scratch used
      // Count gold items linked in pRoom->pUnitFirst (+0x74): only 1 pile spawned because iter 2 probed x=111 (out of room)
      let roomItems = 0
      let cur = m.u32((pRoom + 0x74) >>> 0) >>> 0
      while (cur !== 0 && roomItems < 16) {
        if (m.u32(cur) === 4) roomItems++
        cur = m.u32((cur + 0xe8) >>> 0) >>> 0
      }
      expect(roomItems).toBe(1)
    })

    it('Fix #6 (0x6FC527D0): OBJECTS_SpawnShrineFromGroupEntry uses pObjTxt+0x13c directly and avoids fixed 0x00f0_b1d0 scratch', () => {
      const { m, pGame, pObjectsTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      // Ensure pObjTxt + 0x13c = 0 while _nWallSide = 7 (must NOT OR/fallback to 7)
      m.setU8((pObjectsTxt + 12 * 0x1c0 + 0x13c) >>> 0, 0)
      m.setU32(0x00f0_b1d0, 0xdeadbeef)

      const res = OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(m, pGame, pRoom, 12, 7, 100)
      expect(res).toBeGreaterThanOrEqual(0)
      expect(m.u32(0x00f0_b1d0)).toBe(0xdeadbeef)
    })

    it('Fix #7 (0x6FC64AC0, 0x6FC64C20, 0x6FC64D70, 0x6FC6C3A0): Melee skill handlers call real SUNITDMG_RollMeleeToHitAndBlock (0x6FCFE5A0)', () => {
      const { m, pGame, pSkillsTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const attacker = allocDynamicUnit(m, pGame, 0, 0, 10, pRoom, 110, 210)
      const defender = allocDynamicUnit(m, pGame, 1, 5, 11, pRoom, 112, 210)
      STATLIST_SetUnitStat113c(m, attacker.pUnit, 19, 500, 0) // AR
      STATLIST_SetUnitStat113c(m, attacker.pUnit, 12, 20, 0) // level
      STATLIST_SetUnitStat113c(m, defender.pUnit, 31, 10, 0) // defense
      STATLIST_SetUnitStat113c(m, defender.pUnit, 12, 1, 0) // level
      STATLIST_SetUnitStat113c(m, defender.pUnit, 6, 5000 << 8, 0)
      STATLIST_SetUnitStat113c(m, defender.pUnit, 7, 5000 << 8, 0)
      PATH_SetTargetUnit113c(m, attacker.pDynPath, defender.pUnit)

      const skillId = 50
      const pSk = (pSkillsTxt + skillId * 0x23c) >>> 0
      m.setU16((pSk + 0x80) >>> 0, 15) // wAuraState
      STATES_ToggleGfxStateFlag113c(m, attacker.pUnit, 15, 1)
      attachUsedSkill(m, attacker.pUnit, skillId, 5, 1)

      // 1) 0x6FC64AC0
      beginVaTrace113c()
      SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c(m, pGame, attacker.pUnit, 5)
      expect(endVaTrace113c().has('D2Game:0x6FCFE5A0')).toBe(true)

      // 2) 0x6FC64C20
      beginVaTrace113c()
      SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c(m, pGame, attacker.pUnit, skillId, 5)
      expect(endVaTrace113c().has('D2Game:0x6FCFE5A0')).toBe(true)

      // 3) 0x6FC64D70
      beginVaTrace113c()
      SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c(m, pGame, attacker.pUnit, skillId, 5)
      expect(endVaTrace113c().has('D2Game:0x6FCFE5A0')).toBe(true)

      // 4) 0x6FC6C3A0
      beginVaTrace113c()
      SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c(m, pGame, attacker.pUnit, skillId, 5)
      expect(endVaTrace113c().has('D2Game:0x6FCFE5A0')).toBe(true)
    })

    it('Fix #8 (0x6FC65CE0, 0x6FC65EE0, 0x6FC66000): STATLIST_AllocList113c receives (m, 2, ownerType, ownerId, 0, expireFrame) + sets pMemPool at +0x00', () => {
      const { m, pGame, pSkillsTxt, pSkillCode } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const druid = allocDynamicUnit(m, pGame, 0, 5, 77, pRoom, 110, 210)
      const target = allocDynamicUnit(m, pGame, 1, 5, 78, pRoom, 112, 210)
      const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
      expect(pMemPool).toBe(0x00ab_cd00)

      // Skill 60: wAuraState = 41, wAuraState2 = 42, duration calc = 200
      const skillId = 60
      const pSk = (pSkillsTxt + skillId * 0x23c) >>> 0
      m.setU16((pSk + 0x80) >>> 0, 41)
      m.setU16((pSk + 0x82) >>> 0, 42)
      const durOff = writeRpnImm32(m, pSkillCode, 0x10, 200)
      m.setU32((pSk + 0x60) >>> 0, durOff) // dwAuraLenCalc for DruidShapeShift
      m.setU32((pSk + 0x74) >>> 0, durOff) // dwAuraLenCalc
      m.setU32((pSk + 0x208) >>> 0, durOff) // dwELenCalc
      attachUsedSkill(m, druid.pUnit, skillId, 5, 0)

      // A) 0x6FC65CE0 (DruidShapeShift)
      expect(SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c(m, pGame, druid.pUnit, skillId, 5)).toBe(1)
      const slShape = STATLIST_GetStatListFromUnitAndState113c(m, druid.pUnit, 41) >>> 0
      expect(slShape).not.toBe(0)
      expect(m.u32(slShape)).toBe(pMemPool)
      expect(m.get(slShape, D2StatListStrc.eOwnerType)).toBe(0) // ownerType = UNIT_PLAYER
      expect(m.get(slShape, D2StatListStrc.dwOwnerId)).toBe(77) // ownerId = 77
      expect((m.get(slShape, D2StatListStrc.dwFlags) & 2) !== 0).toBe(true) // flags = 2
      expect(m.get(slShape, D2StatListStrc.dwExpireFrame)).toBe(300) // frame(100) + dur(200)

      // B) 0x6FC65EE0 (ApplySecondaryAuraStateStats)
      expect(SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c(m, pGame, druid.pUnit, 150, skillId, 5, 3)).toBe(1)
      const slSec = STATLIST_GetStatListFromUnitAndState113c(m, druid.pUnit, 42) >>> 0
      expect(slSec).not.toBe(0)
      expect(m.u32(slSec)).toBe(pMemPool)
      expect(m.get(slSec, D2StatListStrc.eOwnerType)).toBe(0)
      expect(m.get(slSec, D2StatListStrc.dwOwnerId)).toBe(77)
      expect((m.get(slSec, D2StatListStrc.dwFlags) & 2) !== 0).toBe(true)
      expect(m.get(slSec, D2StatListStrc.dwExpireFrame)).toBe(250) // frame(100) + 150

      // C) 0x6FC66000 (DruidChargeUpHit) on fresh unit with state 43
      const druid2 = allocDynamicUnit(m, pGame, 0, 5, 79, pRoom, 110, 210)
      const skillId2 = 61
      const pSk2 = (pSkillsTxt + skillId2 * 0x23c) >>> 0
      m.setU16((pSk2 + 0x80) >>> 0, 43)
      m.setU32((pSk2 + 0x60) >>> 0, durOff)
      m.setU32((pSk2 + 0x74) >>> 0, durOff)
      m.setU32((pSk2 + 0x170) >>> 0, 1) // dwParam1 (charge step / max)
      m.setU32((pSk2 + 0x174) >>> 0, 3)
      PATH_SetTargetUnit113c(m, druid2.pDynPath, target.pUnit)
      attachUsedSkill(m, druid2.pUnit, skillId2, 5, 1)
      const pHitDmg = m.alloc(0x70) >>> 0
      m.setU16((pHitDmg + 0x04) >>> 0, 1) // RESULTFLAG_HIT
      SUNITDMG_AllocCombat113c(m, pGame, druid2.pUnit, target.pUnit, pHitDmg, 128)
      expect(SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c(m, pGame, druid2.pUnit, skillId2, 5)).toBe(1)
      const slCharge = STATLIST_GetStatListFromUnitAndState113c(m, druid2.pUnit, 43) >>> 0
      expect(slCharge).not.toBe(0)
      expect(m.u32(slCharge)).toBe(pMemPool)
      expect(m.get(slCharge, D2StatListStrc.eOwnerType)).toBe(0)
      expect(m.get(slCharge, D2StatListStrc.dwOwnerId)).toBe(79)
      expect((m.get(slCharge, D2StatListStrc.dwFlags) & 2) !== 0).toBe(true)
    })

    it('Fix #9 (0x6FC65EE0): SKILLS_ApplySecondaryAuraStateStats returns 0 without mutating existing wAuraState2 statlist', () => {
      const { m, pGame, pSkillsTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const u = allocDynamicUnit(m, pGame, 0, 5, 81, pRoom, 110, 210)
      const skillId = 62
      m.setU16((pSkillsTxt + skillId * 0x23c + 0x82) >>> 0, 44)

      // First application succeeds and sets expireFrame = 100 + 50 = 150
      expect(SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c(m, pGame, u.pUnit, 50, skillId, 4, 4)).toBe(1)
      const sl = STATLIST_GetStatListFromUnitAndState113c(m, u.pUnit, 44) >>> 0
      expect(m.get(sl, D2StatListStrc.dwExpireFrame)).toBe(150)

      // Second application while wAuraState2 already exists MUST return 0 and preserve expireFrame=150!
      expect(SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c(m, pGame, u.pUnit, 999, skillId, 4, 4)).toBe(0)
      expect(m.get(sl, D2StatListStrc.dwExpireFrame)).toBe(150)
    })

    it('Fix #10 (0x6FC6CE10, 0x6FC6D040): LightningStrike & ChargedStrike pass bUnlinkCombat = 1 to SUNITDMG_ExecuteEvents113c', () => {
      const { m, pGame, pSkillsTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const zon = allocDynamicUnit(m, pGame, 0, 0, 90, pRoom, 110, 210)
      const mon = allocDynamicUnit(m, pGame, 1, 5, 91, pRoom, 112, 210)
      STATLIST_SetUnitStat113c(m, mon.pUnit, 6, 5000 << 8, 0)
      STATLIST_SetUnitStat113c(m, mon.pUnit, 7, 5000 << 8, 0)
      PATH_SetTargetUnit113c(m, zon.pDynPath, mon.pUnit)

      const skId = 65
      m.setU16((pSkillsTxt + skId * 0x23c + 0x38) >>> 0, 0xffff) // skip missile spawn after ExecuteEvents

      // A) 0x6FC6CE10 (LightningStrikeBounce)
      const pDmg1 = m.alloc(0x70) >>> 0
      m.setU16((pDmg1 + 0x04) >>> 0, 1)
      SUNITDMG_AllocCombat113c(m, pGame, zon.pUnit, mon.pUnit, pDmg1, 128)
      expect(SUNITDMG_GetAttackerDamageData113c(m, zon.pUnit, mon.pUnit)).not.toBe(0)
      SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c(m, pGame, zon.pUnit, skId, 3)
      expect(SUNITDMG_GetAttackerDamageData113c(m, zon.pUnit, mon.pUnit)).toBe(0)

      // B) 0x6FC6D040 (ChargedStrikeBolts)
      const pDmg2 = m.alloc(0x70) >>> 0
      m.setU16((pDmg2 + 0x04) >>> 0, 1)
      SUNITDMG_AllocCombat113c(m, pGame, zon.pUnit, mon.pUnit, pDmg2, 128)
      expect(SUNITDMG_GetAttackerDamageData113c(m, zon.pUnit, mon.pUnit)).not.toBe(0)
      SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c(m, pGame, zon.pUnit, skId, 3)
      expect(SUNITDMG_GetAttackerDamageData113c(m, zon.pUnit, mon.pUnit)).toBe(0)
    })

    it('Fix #11 (0x6FC6F090): SKILLS_IronMaidenThornsReflectDamage deals reflected damage TO pUnit (cursed attacker) FROM pTarget', () => {
      const { m, pGame, pSkillsTxt, pSkillCode } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const cursedAttacker = allocDynamicUnit(m, pGame, 1, 5, 95, pRoom, 110, 210)
      const struckDefender = allocDynamicUnit(m, pGame, 0, 2, 96, pRoom, 112, 210)

      const startHp = 10000 << 8
      STATLIST_SetUnitStat113c(m, cursedAttacker.pUnit, 6, startHp, 0)
      STATLIST_SetUnitStat113c(m, cursedAttacker.pUnit, 7, startHp, 0)
      STATLIST_SetUnitStat113c(m, struckDefender.pUnit, 6, startHp, 0)
      STATLIST_SetUnitStat113c(m, struckDefender.pUnit, 7, startHp, 0)

      // Skill 76 (Iron Maiden): wAuraState2 = 55, monster reflect calc at +0x138 = 200%
      const imSkill = 76
      const pSk = (pSkillsTxt + imSkill * 0x23c) >>> 0
      const calcOff = writeRpnImm32(m, pSkillCode, 0x20, 200)
      m.setU16((pSk + 0x82) >>> 0, 55) // wAuraState2 (Iron Maiden curse state)
      m.setU32((pSk + 0x138) >>> 0, calcOff) // monster-attacker reflect% calc
      m.setU32((pSk + 0x130) >>> 0, 0) // dwHitFlags
      m.setU32((pSk + 0x134) >>> 0, 0) // dwHitClass

      // Attach Iron Maiden curse statlist (state 55, owner = struckDefender) onto cursedAttacker
      const pCurseSl = STATLIST_AllocList113c(m, 2, 0, 96, 55, 500) >>> 0
      STATLIST_SetState113c(m, pCurseSl, 55)
      STATLIST_MergeStatLists113c(m, cursedAttacker.pUnit, pCurseSl, 1)
      STATES_ToggleGfxStateFlag113c(m, cursedAttacker.pUnit, 55, 1)

      const pDmg = m.alloc(0x70) >>> 0
      m.setU32((pDmg + 0x08) >>> 0, 100 << 8) // dwPhysDamage = 100 HP

      const ret = SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c(
        m,
        pGame,
        0,
        cursedAttacker.pUnit,
        struckDefender.pUnit,
        pDmg,
        imSkill,
        5,
      )
      expect(ret).toBe(1)
      // Cursed attacker (pUnit) MUST take reflected damage; struckDefender (pTarget) MUST NOT!
      expect(STATLIST_GetUnitStat113c(m, cursedAttacker.pUnit, 6, 0)).toBeLessThan(startHp)
      expect(STATLIST_GetUnitStat113c(m, struckDefender.pUnit, 6, 0)).toBe(startHp)
    })

    it('Fix #12 (0x6FC66A20 & 0x6FC833C0): Charged release passes nChargeLevel=lvl (not nDuration=0) and Cairn Stones formats exact .rdata 0x6fd1bed4 string', () => {
      const { m, pGame, pSkillsTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const caster = allocDynamicUnit(m, pGame, 0, 6, 110, pRoom, 110, 210)
      const target = allocDynamicUnit(m, pGame, 1, 5, 111, pRoom, 112, 210)
      STATLIST_SetUnitStat113c(m, target.pUnit, 6, 5000 << 8, 0)
      STATLIST_SetUnitStat113c(m, target.pUnit, 7, 5000 << 8, 0)
      PATH_SetTargetUnit113c(m, caster.pDynPath, target.pUnit)

      // 12a) 0x6FC66A20: duration calc evaluates to 0, while lvl = 7 -> must still enter 0x6FC65EE0 and apply wAuraState2 = 47
      const skId = 70
      const pSk = (pSkillsTxt + skId * 0x23c) >>> 0
      m.setU16((pSk + 0x80) >>> 0, 46)
      m.setU16((pSk + 0x82) >>> 0, 47) // wAuraState2
      attachUsedSkill(m, caster.pUnit, skId, 7, 2)

      beginVaTrace113c()
      const rRel = SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c(
        m,
        pGame,
        caster.pUnit,
        skId,
        7,
      )
      const hitsRel = endVaTrace113c()
      expect(rRel).toBe(1)
      expect(hitsRel.has('D2Game:0x6FC663A0')).toBe(true)
      expect(hitsRel.has('D2Game:0x6FC65EE0')).toBe(true)
      expect(STATLIST_GetStatListFromUnitAndState113c(m, caster.pUnit, 47)).not.toBe(0)

      // 12b) 0x6FC833C0: Enable debug chat flag (0x6fd31c20 = 1) & verify exact .rdata 0x6fd1bed4 format
      const pClient = m.u32((caster.pUnitData + 0x9c) >>> 0) >>> 0
      m.setU32((pClient + 0x04) >>> 0, 4) // active client state = 4
      m.setU32((pGame + 0x88) >>> 0, pClient)
      const pQuestCtrl = m.alloc(0x40) >>> 0
      m.setU32((pQuestCtrl + 0x18) >>> 0, 0x12345678)
      m.setU32((pQuestCtrl + 0x1c) >>> 0, 0x29a)
      m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
      const pQuestData = m.alloc(0x40) >>> 0
      const pQuestState = m.alloc(0x40) >>> 0
      m.setU32((pQuestData + 0x04) >>> 0, pGame)
      m.setU32((pQuestData + 0x18) >>> 0, pQuestState)

      m.setU32(0x6fd31c20, 1)
      ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c(m, pQuestData)
      m.setU32(0x6fd31c20, 0)

      // All 5 Cairn Stones 0x11..0x15 placed in permutation slots 0..4
      const assigned = [0, 1, 2, 3, 4].map((i) => m.u16((pQuestState + i * 2) >>> 0)).sort((a, b) => a - b)
      expect(assigned).toEqual([0x11, 0x12, 0x13, 0x14, 0x15])

      // Read raw queued S2C packet 0x26 bytes from pClient->pPacketHead (+0x1b8)
      let pNode = m.u32((pClient + 0x1b8) >>> 0) >>> 0
      expect(pNode).not.toBe(0)
      let payloadAscii = ''
      while (pNode !== 0) {
        const used = m.u32(pNode) >>> 0
        for (let i = 0; i < used; i++) {
          const ch = m.u8((pNode + 0x04 + i) >>> 0)
          payloadAscii += ch >= 0x20 && ch < 0x7f ? String.fromCharCode(ch) : '|'
        }
        pNode = m.u32((pNode + 0x204) >>> 0) >>> 0
      }
      expect(payloadAscii).toContain('stone ')
      expect(payloadAscii).toContain(' is class 17')
      expect(payloadAscii).toContain(' is class 21')
      expect(payloadAscii).not.toContain('Stone ')
      expect(payloadAscii).not.toContain(' = ')
    })
  })

  it('exercises all 158 promoted VAs across all 4 shards with behavioral state assertions and 158/158 live VA trace coverage', () => {
    const cumulativeHits = new Set<string>()

    // ------------------------------------------------------------------------
    // Shard 1: k2w1-laneK-0x6fc5 (39 VAs)
    // ------------------------------------------------------------------------
    {
      const { m, pGame, pSkillsTxt, pMissilesTxt, pObjectsTxt, pMonStatsTxt, pMonLvlTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const plr = allocDynamicUnit(m, pGame, 0, 0, 1, pRoom, 110, 210)
      const mon = allocDynamicUnit(m, pGame, 1, 5, 2, pRoom, 115, 215)
      STATLIST_SetUnitStat113c(m, plr.pUnit, 8, 200 << 8, 0) // mana
      STATLIST_SetUnitStat113c(m, plr.pUnit, 9, 400 << 8, 0) // maxmana
      STATLIST_SetUnitStat113c(m, plr.pUnit, 12, 10, 0) // level
      STATLIST_SetUnitStat113c(m, plr.pUnit, 13, 150000, 0) // exp

      const allocMissile = (classId: number, guid: number, x = 112, y = 212) => {
        const pMis = m.alloc(0x120) >>> 0
        const pDyn = m.alloc(0x280) >>> 0
        m.setU32(pMis, 3)
        m.setU32((pMis + 0x04) >>> 0, classId >>> 0)
        m.setU32((pMis + 0x0c) >>> 0, guid >>> 0)
        m.setU32((pMis + 0x10) >>> 0, 1)
        m.setU32((pMis + 0x20) >>> 0, (0x123456 + guid) >>> 0)
        m.setU32((pMis + 0x24) >>> 0, 0x29a)
        m.setU32((pMis + 0x2c) >>> 0, pDyn)
        m.setU32((pMis + 0x80) >>> 0, pGame)
        m.setU32((pMis + 0x94) >>> 0, 0) // dwOwnerType = player
        m.setU32((pMis + 0x98) >>> 0, 1) // dwOwnerId = plr guid
        m.setU32((pMis + 0xc8) >>> 0, 0x400) // dwFlagsEx: UNITFLAGEX_HASOWNER
        m.setU16((pDyn + 0x02) >>> 0, x & 0xffff)
        m.setU16((pDyn + 0x06) >>> 0, y & 0xffff)
        m.setU32((pDyn + 0x10) >>> 0, x >>> 0)
        m.setU32((pDyn + 0x14) >>> 0, y >>> 0)
        m.setU32((pDyn + 0x1c) >>> 0, pRoom)
        m.set(pDyn, D2DynamicPathStrc.pUnit, pMis)
        MISSILE_AllocMissileData113c(m, pMis)
        const pMisData = m.u32((pMis + 0x14) >>> 0) >>> 0
        const pSl = STATLIST_CreateEx113c(m, pMis, 0, pGame) >>> 0
        m.setU32((pMis + 0x5c) >>> 0, pSl)
        return { pMis, pDyn, pMisData }
      }

      beginVaTrace113c()

      // 0x6FC54C70, 0x6FC54D00: NPC intro flags pack & set
      const pQuestIntro = m.alloc(0x20) >>> 0
      const pIntroRec0 = m.alloc(8) >>> 0
      const pIntroRec1 = m.alloc(8) >>> 0
      m.setU32(pIntroRec0, m.alloc(0x20) >>> 0)
      m.setU32(pIntroRec1, m.alloc(0x20) >>> 0)
      m.setU32(pQuestIntro, pIntroRec0)
      m.setU32((pQuestIntro + 0x04) >>> 0, pIntroRec1)
      m.setU32((plr.pUnitData + 0x60) >>> 0, pQuestIntro)
      const pNpcIds = m.alloc(8) >>> 0
      m.setU32(pNpcIds, 1)
      m.setU32((pNpcIds + 4) >>> 0, 2)
      QUESTS_SetNpcIntroFlags_6FC54D00_113c(m, plr.pUnit, 2, pGame, pNpcIds)
      const pPkt = m.alloc(0x20) >>> 0
      expect(QUESTS_PackNpcIntroFlags_6FC54C70_113c(m, pPkt, pNpcIds, pQuestIntro, 2)).toBeGreaterThanOrEqual(0)

      // 0x6FC54DA0, 0x6FC54E10: Act1 Q4 & Q3 object inits
      const pObjInit = m.alloc(0x20) >>> 0
      const pObj = m.alloc(0x100) >>> 0
      const pObjPath = m.alloc(0x20) >>> 0
      m.setU32(pObjPath, pRoom)
      m.setU32(pObj, 2)
      m.setU32((pObj + 0x04) >>> 0, 0x11)
      m.setU32((pObj + 0x2c) >>> 0, pObjPath)
      m.setU32(pObjInit, pGame)
      m.setU32((pObjInit + 0x04) >>> 0, pObj)
      QUESTS_InitAct1Quest4Object_6FC54DA0_113c(m, pObjInit)
      QUESTS_InitAct1Quest3Object_6FC54E10_113c(m, pObjInit)

      // 0x6FC55A20: Complete quest for player guid list
      const pGuidList = m.alloc(0x88) >>> 0
      m.setU32(pGuidList, 1) // guid[0] = 1
      m.setU16((pGuidList + 0x80) >>> 0, 1) // nCount = 1
      QUESTS_CompleteQuestForPlayerGuidList_6FC55A20_113c(m, 1, pGame, pGuidList, 0)

      // 0x6FC56820: Spawn preset monster at coord
      const pCoord = m.alloc(8) >>> 0
      m.setU32(pCoord, 114)
      m.setU32((pCoord + 4) >>> 0, 214)
      expect(QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c(m, 5, 1, pCoord, pGame, plr.pUnit)).toBeGreaterThanOrEqual(0)

      // 0x6FC56B90: Operate container
      const pOp = m.alloc(0x20) >>> 0
      m.setU32(pOp, pGame)
      m.setU32((pOp + 0x04) >>> 0, pObj)
      m.setU32((pOp + 0x08) >>> 0, plr.pUnit)
      m.setU32((pOp + 0x10) >>> 0, 5)
      m.setU8((pObjectsTxt + 0x11 * 0x1c0 + 0x132) >>> 0, 1)
      expect(OBJECTS_OperateContainer_6FC56B90_113c(m, pOp)).toBeGreaterThanOrEqual(0)

      // 0x6FC57440, 0x6FC57480: PlayerData field48 getter/setter
      PLAYER_SetPlayerDataField48_6FC57480_113c(m, plr.pUnit, 0x4242)
      expect(PLAYER_GetPlayerDataField48_6FC57440_113c(m, plr.pUnit)).toBe(0x4242)

      // 0x6FC57500: FreePlayerDataList98
      const pNode98 = m.alloc(0x20) >>> 0
      m.setU32((plr.pUnitData + 0x98) >>> 0, pNode98)
      PLAYER_FreePlayerDataList98_6FC57500_113c(m, plr.pUnitData, pGame)
      expect(m.u32((plr.pUnitData + 0x98) >>> 0)).toBe(0)

      // 0x6FC57730: Death EXP penalty (Nightmare diff=1, penalty=5%)
      m.setU8((pGame + 0x6d) >>> 0, 1)
      m.setU32((pMonLvlTxt + 1 * D2MonLvlTxt_SIZE + 0x0c) >>> 0, 5)
      PLAYER_ApplyDeathExpPenalty_6FC57730_113c(m, pGame, plr.pUnit)
      m.setU8((pGame + 0x6d) >>> 0, 0)

      // 0x6FC579E0, 0x6FC57E20: FreePlayerCorpses & InitPlacedModesAndEvents
      PLAYER_FreePlayerCorpses_6FC579E0_113c(m, plr.pUnit, pGame)
      PLAYER_InitPlacedModesAndEvents_6FC57E20_113c(m, pGame, plr.pUnit, 110, 210)
      expect(m.u32((plr.pUnit + 0x10) >>> 0)).toBeGreaterThanOrEqual(0)

      // 0x6FC58E70..0x6FC5A1D0: Missile SrvHit / SrvDo / Path utilities
      const pDmg = m.alloc(0x70) >>> 0
      m.setU32((pDmg + 0x30) >>> 0, 50) // dwColdLen
      MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c(m, pGame, 0, 0, pDmg)
      expect(m.u32((pDmg + 0x30) >>> 0)).toBe(0)
      expect(m.u32((pDmg + 0x34) >>> 0)).toBe(50)

      expect(MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c(m, pGame, 0, 1)).toBe(2)
      expect(MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c(m, pGame, 0, 0)).toBe(0)
      expect(MISSILES_SrvDo_ReturnOne_6FC58EC0_113c(m, pGame, 0, 0)).toBe(1)

      const mis1 = allocMissile(10, 50)
      MISSILE_SetSkill113c(m, mis1.pMis, 10)
      MISSILE_SetLevel113c(m, mis1.pMis, 5)
      MISSILE_SetTotalFrames113c(m, mis1.pMis, 40)
      MISSILE_SetRemainingFrames113c(m, mis1.pMis, 30)
      m.setU32((pMissilesTxt + 10 * 0x1a4 + 0x04) >>> 0, 0x14) // flags: pierce(0x04) | bit4(0x10)
      m.setU8((pMissilesTxt + 10 * 0x1a4 + 0x12d) >>> 0, 4) // nEType = cold
      m.setU16((pMissilesTxt + 10 * 0x1a4 + 0x36) >>> 0, 12) // wProgOverlay
      m.setU8((pMissilesTxt + 10 * 0x1a4 + 0x16c) >>> 0, 10) // nVelocity

      expect(MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c(m, pGame, mis1.pMis, 0)).toBe(0)
      STATLIST_SetUnitStat113c(m, mis1.pMis, 0x148, 2, 0)
      expect(MISSILES_ConsumePierceStat_6FC58F40_113c(m, mis1.pMis)).toBe(2)
      MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c(m, pGame, mis1.pMis, mon.pUnit, pDmg)
      m.setU32((pDmg + 0x30) >>> 0, 33)
      MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c(m, pGame, mis1.pMis, mon.pUnit, pDmg)
      expect(m.u32((pDmg + 0x34) >>> 0)).toBe(33)
      expect(MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c(m, pGame, mis1.pMis, 0)).toBe(0)
      MISSILES_InitDrunkenPath_6FC59210_113c(m, mis1.pMis, 0)
      MISSILES_ResetDamageKeepETypeLen_6FC592E0_113c(m, mis1.pMis, pDmg)
      MISSILES_SetElemLenByEType_6FC594B0_113c(m, mis1.pMis, pDmg, 75)
      expect(m.u32((pDmg + 0x30) >>> 0)).toBeGreaterThanOrEqual(0)

      m.setU32((mis1.pMis + 0xc4) >>> 0, 0x10)
      expect(MISSILES_FilterFlagBit4Missile_6FC59510_113c(m, mis1.pMis)).toBe(1)
      MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c(m, pGame, mis1.pMis, mon.pUnit, pDmg)
      expect(MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c(m, pGame, mis1.pMis, plr.pUnit)).toBeGreaterThanOrEqual(0)

      // 0x6FC59930: Redemption corpse callback
      m.setU32((mon.pUnit + 0x10) >>> 0, 12) // dead corpse
      SKILLS_RedemptionCorpseCallback_6FC59930_113c(m, pGame, plr.pUnit, mon.pUnit, 5, 0)
      m.setU32((mon.pUnit + 0x10) >>> 0, 1)

      // 0x6FC59A40, 0x6FC59BD0, 0x6FC59C80, 0x6FC59F70, 0x6FC5A1D0
      m.setU8((pMonStatsTxt + 5 * 0x1a8 + 0x0c) >>> 0, 2)
      MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c(m, pGame, mis1.pMis, mon.pUnit, pDmg)
      MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c(m, pGame, mis1.pMis, mon.pUnit, pDmg)
      MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c(m, pGame, mis1.pMis, mon.pUnit, pDmg)
      expect((m.u32((mon.pUnit + 0xc4) >>> 0) & 0x20000) !== 0).toBe(true)
      expect(MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c(m, pGame, mis1.pMis, plr.pUnit)).toBeGreaterThanOrEqual(0)
      MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c(m, pGame, mis1.pMis)

      // 0x6FC5BC80, 0x6FC5BD10, 0x6FC5E670, 0x6FC61F50
      m.setU32((pSkillsTxt + 10 * 0x23c + 0x170) >>> 0, 5)
      expect(MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c(m, pGame, mis1.pMis, 1)).toBeGreaterThanOrEqual(0)
      expect(MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c(m, pGame, mis1.pMis, 1)).toBeGreaterThanOrEqual(0)
      expect(MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c(m, pGame, mis1.pMis, 1)).toBeGreaterThanOrEqual(0)
      MISSILES_InitChargedBoltPath_6FC61F50_113c(m, mis1.pMis, 1)

      // 0x6FC62230, 0x6FC62290
      const { pSkill } = attachUsedSkill(m, plr.pUnit, 10, 3, 9)
      SKILLS_SetParam1113c(m, pSkill, 9)
      m.setU32((pSkill + 0x38) >>> 0, 7)
      expect(SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c(m, pGame, plr.pUnit, 10, 3)).toBe(1)
      expect(SKILLS_GetParam1113c(m, pSkill) | 0).toBe(-1)
      expect(SKILLS_GetParam2113c(m, pSkill)).toBe(1)
      STATES_ToggleGfxStateFlag113c(m, plr.pUnit, 12, 1)
      SKILLS_StatListExpireClearState_6FC62290_113c(m, plr.pUnit, 12, 0)
      expect(STATES_CheckState113c(m, plr.pUnit, 12)).toBe(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // ------------------------------------------------------------------------
    // Shard 2: k2w4-b1 (39 VAs)
    // ------------------------------------------------------------------------
    {
      const { m, pGame, pItemsTxt, pSkillsTxt, pObjGroupTxt, pMonStatsTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const plr = allocDynamicUnit(m, pGame, 0, 0, 1, pRoom, 110, 210)
      const mon = allocDynamicUnit(m, pGame, 1, 5, 2, pRoom, 112, 210)
      const target = allocDynamicUnit(m, pGame, 1, 6, 3, pRoom, 115, 210)
      STATLIST_SetUnitStat113c(m, mon.pUnit, 12, 20, 0)
      STATLIST_SetUnitStat113c(m, target.pUnit, 6, 500 << 8, 0)
      STATLIST_SetUnitStat113c(m, target.pUnit, 7, 500 << 8, 0)

      m.setU16((pItemsTxt + 5 * D2ItemsTxt_SIZE + 0x11e) >>> 0, 5)
      m.setU8((pItemsTxt + 5 * D2ItemsTxt_SIZE + 0xfd) >>> 0, 5) // nLevel
      m.setU8((pItemsTxt + 5 * D2ItemsTxt_SIZE + 0x14d) >>> 0, 1) // nSpawnable
      installAffixTablesForType(m, 5)

      beginVaTrace113c()

      // 0x6FC21F60: STORM_TSListDestroySehWrapper
      const pList = m.alloc(0x18) >>> 0
      STORM_TSListDestroySehWrapper_6FC21F60_113c(m, pList)

      // 0x6FC2C8D0, 0x6FC2D170: Nihlathak CE & PackLeaderMarkAndFireMissile
      expect(SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c(m, pGame, mon.pUnit, target.pUnit, 3, 0)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c(m, pGame, mon.pUnit, 10, 3)).toBeGreaterThanOrEqual(0)

      // 0x6FC2F370..0x6FC34F20: Item drop & affix functions
      const it1 = allocItemUnit(m, pGame, 5, 30, 4, 40, 100)
      const pDrop = m.alloc(0x90) >>> 0
      m.setU32((pDrop + 0x0c) >>> 0, 40)
      expect(ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c(m, pGame, it1.pItem, pDrop)).toBeGreaterThanOrEqual(0)

      const pRollSeed = m.alloc(8) >>> 0
      m.setU32(pRollSeed, 0x13579bdf)
      m.setU32((pRollSeed + 4) >>> 0, 0x29a)
      expect(ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c(m, pRollSeed, 20, pGame, 5, 1, 0)).toBeGreaterThanOrEqual(-1)

      const ppIt = m.alloc(4) >>> 0
      const pSeedVal = m.alloc(4) >>> 0
      m.setU32(ppIt, it1.pItem)
      m.setU32(pSeedVal, 0x55aa55aa)
      ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c(m, ppIt, pSeedVal, pDrop)
      expect(ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c(m, it1.pItem, pDrop)).toBe(1)
      expect(ITEMS_TryRollAndApplyMagicAffixes_6FC303C0_113c(m, ppIt, pDrop)).toBe(1)
      ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c(m, plr.pUnit, pGame)
      expect(ITEMS_ApplySetItemModsByFormat_6FC341E0_113c(m, it1.pItem, pDrop)).toBeGreaterThanOrEqual(0)
      expect(ITEMS_ApplyLowQualityModsByFormat_6FC34AF0_113c(m, it1.pItem, pDrop)).toBeGreaterThanOrEqual(0)
      expect(ITEMS_RollRareNameIdByFormat_6FC34B30_113c(m, it1.pItem, 1)).toBeGreaterThan(0)
      expect(ITEMS_RollMagicAffixByFormat_6FC34B50_113c(m, it1.pItem, 1, 0, 1, 1, 0, 0)).toBeGreaterThan(0)
      expect(ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c(m, it1.pItem, pDrop)).toBe(1)
      expect(ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c(m, it1.pItem, pDrop)).toBe(1)

      // 0x6FC373D0, 0x6FC389E0: AI_ThinkPackIdlePatrol & AI_ThinkPutridDefiler
      const pAiTickArgs = m.alloc(0x40) >>> 0
      const pAiControl = m.alloc(0x40) >>> 0
      m.setU32(pAiTickArgs, pAiControl)
      m.setU32((pAiTickArgs + 0x08) >>> 0, target.pUnit)
      m.setU32((pAiTickArgs + 0x1c) >>> 0, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
      AI_ThinkPackIdlePatrol_6FC373D0_113c(m, pGame, mon.pUnit, pAiTickArgs)
      AI_ThinkPutridDefiler_6FC389E0_113c(m, pGame, mon.pUnit, pAiTickArgs)

      // 0x6FC421D0..0x6FC468C0: MONUMOD elemental, champion, random, scarab
      MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c(m, mon.pUnit, 23, 0)
      MONUMOD_ApplyColdEnchantedStats_6FC42320_113c(m, mon.pUnit, 18, 0)
      MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c(m, mon.pUnit, 18, 0)
      MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c(m, mon.pUnit, 17, 0)
      MONUMOD_ApplyFireEnchantedStats_6FC42740_113c(m, mon.pUnit, 9, 0)
      MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c(m, 27, mon.pUnit, 0, 1)
      MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c(m, mon.pUnit, pGame, 0)
      MONUMOD_ApplyChampionBerserkerStats_6FC437C0_113c(m, mon.pUnit, 20, 1)
      MONUMOD_ApplyChampionFanaticStats_6FC43810_113c(m, mon.pUnit, 21, 1)
      MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c(m, mon.pUnit, 19, 1)
      expect(MONUMOD_RollRandomUniqueBossMod_6FC43980_113c(m, pGame, mon.pUnit, 0)).toBeGreaterThanOrEqual(0)
      expect(MONUMOD_RollRandomChampionMod_6FC43AE0_113c(m, pGame, mon.pUnit)).toBeGreaterThanOrEqual(0)
      MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c(m, pGame, mon.pUnit, 33, plr.pUnit)

      // 0x6FC48170, 0x6FC4ABD0: EndChargeOrLeapMovement & IsGameNameAvailable
      const { pSkill: pChgSkill } = attachUsedSkill(m, plr.pUnit, 107, 1, 0)
      m.setU16((pSkillsTxt + 107 * 0x23c) >>> 0, 107)
      expect(SKILLS_EndChargeOrLeapMovement_6FC48170_113c(m, pChgSkill, 107, plr.pUnit, 112, 212)).toBeGreaterThanOrEqual(0)
      const pName = m.alloc(16) >>> 0
      m.setU8(pName, 0x41) // "A"
      expect(GAME_IsGameNameAvailable_6FC4ABD0_113c(m, pName)).toBe(1)

      // 0x6FC4F580..0x6FC531B0: Object operations & room spawns
      const pObj2 = m.alloc(0x100) >>> 0
      const pObj2Path = m.alloc(0x20) >>> 0
      m.setU32(pObj2Path, pRoom)
      m.setU32(pObj2, 2)
      m.setU32((pObj2 + 0x04) >>> 0, 5)
      m.setU32((pObj2 + 0x2c) >>> 0, pObj2Path)
      const pOpArgs2 = m.alloc(0x20) >>> 0
      m.setU32(pOpArgs2, pGame)
      m.setU32((pOpArgs2 + 0x04) >>> 0, pObj2)
      m.setU32((pOpArgs2 + 0x08) >>> 0, pRoom)
      m.setU32((pOpArgs2 + 0x0c) >>> 0, pRollSeed)
      m.setU32((pOpArgs2 + 0x14) >>> 0, 110)
      m.setU32((pOpArgs2 + 0x18) >>> 0, 210)
      OBJECTS_OperateGoldChestOrPile_6FC4F580_113c(m, pOpArgs2)
      expect(OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c(m, pGame, pRoom, 10)).toBeGreaterThanOrEqual(0)
      expect(OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c(m, pGame, pRoom, 10)).toBeGreaterThanOrEqual(0)
      expect(OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(m, pGame, pRoom, 2, 0, 10)).toBeGreaterThanOrEqual(0)
      m.setU8((pObjGroupTxt + 0xb2) >>> 0, 1)
      expect(OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c(m, pGame, pRoom, 100, 3, 10)).toBeGreaterThanOrEqual(0)
      expect(OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c(m, pGame, pRoom, 5, 10)).toBeGreaterThanOrEqual(0)
      expect(OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c(m, pGame, pRoom, 0xf4, 115, 215, 0)).toBeGreaterThanOrEqual(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // ------------------------------------------------------------------------
    // Shard 3: k2w3-b4 (39 VAs)
    // ------------------------------------------------------------------------
    {
      const { m, pGame, pSkillsTxt, pSkillCode, pMissilesTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const plr = allocDynamicUnit(m, pGame, 0, 2, 1, pRoom, 110, 210)
      const mon = allocDynamicUnit(m, pGame, 1, 5, 2, pRoom, 112, 210)
      STATLIST_SetUnitStat113c(m, plr.pUnit, 6, 1000 << 8, 0)
      STATLIST_SetUnitStat113c(m, plr.pUnit, 7, 2000 << 8, 0)
      STATLIST_SetUnitStat113c(m, plr.pUnit, 8, 1000 << 8, 0)
      STATLIST_SetUnitStat113c(m, plr.pUnit, 9, 1000 << 8, 0)
      STATLIST_SetUnitStat113c(m, mon.pUnit, 6, 1000 << 8, 0)
      STATLIST_SetUnitStat113c(m, mon.pUnit, 7, 1000 << 8, 0)
      PATH_SetTargetUnit113c(m, plr.pDynPath, mon.pUnit)

      const allocMis3 = (classId: number, guid: number) => {
        const pMis = m.alloc(0x120) >>> 0
        const pDyn = m.alloc(0x280) >>> 0
        m.setU32(pMis, 3)
        m.setU32((pMis + 0x04) >>> 0, classId >>> 0)
        m.setU32((pMis + 0x0c) >>> 0, guid >>> 0)
        m.setU32((pMis + 0x10) >>> 0, 1)
        m.setU32((pMis + 0x20) >>> 0, (0x24680 + guid) >>> 0)
        m.setU32((pMis + 0x24) >>> 0, 0x29a)
        m.setU32((pMis + 0x2c) >>> 0, pDyn)
        m.setU32((pMis + 0x80) >>> 0, pGame)
        m.setU32((pMis + 0x94) >>> 0, 0)
        m.setU32((pMis + 0x98) >>> 0, 1)
        m.setU32((pMis + 0xc8) >>> 0, 0x400)
        m.setU16((pDyn + 0x02) >>> 0, 110)
        m.setU16((pDyn + 0x06) >>> 0, 210)
        m.setU32((pDyn + 0x10) >>> 0, 110)
        m.setU32((pDyn + 0x14) >>> 0, 210)
        m.setU32((pDyn + 0x1c) >>> 0, pRoom)
        m.set(pDyn, D2DynamicPathStrc.pUnit, pMis)
        PATH_SetVelocity113c(m, pDyn, 8)
        MISSILE_AllocMissileData113c(m, pMis)
        MISSILE_SetSkill113c(m, pMis, 40)
        MISSILE_SetLevel113c(m, pMis, 3)
        MISSILE_SetTotalFrames113c(m, pMis, 30)
        MISSILE_SetRemainingFrames113c(m, pMis, 20)
        MISSILE_SetTargetX113c(m, pMis, 112)
        MISSILE_SetTargetY113c(m, pMis, 210)
        expect(MISSILE_GetRemainingFrames113c(m, pMis)).toBe(20)
        expect(MISSILE_GetTargetX113c(m, pMis)).toBe(112)
        expect(MISSILE_GetTargetY113c(m, pMis)).toBe(210)
        return pMis
      }

      const sk40 = (pSkillsTxt + 40 * 0x23c) >>> 0
      const calcPos = writeRpnImm32(m, pSkillCode, 0x30, 50)
      m.setU16((sk40 + 0x80) >>> 0, 20) // wAuraState
      m.setU16((sk40 + 0x82) >>> 0, 21) // wAuraState2
      m.setU32((sk40 + 0x74) >>> 0, calcPos) // dwAuraLenCalc
      m.setU32((sk40 + 0x190) >>> 0, calcPos) // dwCalc1
      m.setU32((sk40 + 0x194) >>> 0, calcPos) // dwCalc2
      m.setU16((pMissilesTxt + 12 * 0x1a4 + 0x192) >>> 0, 0xffff)

      beginVaTrace113c()

      // 10 Missile SrvDo handlers (0x6FC60070..0x6FC61AE0)
      const pMis = allocMis3(12, 80)
      expect(MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_HomingTargetStep_6FC61240_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)
      expect(MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c(m, pGame, pMis)).toBeGreaterThanOrEqual(0)

      // Skills & Combat (0x6FC61FB0..0x6FC66000)
      const pDmg = m.alloc(0x70) >>> 0
      m.setU32((pDmg + 0x08) >>> 0, 100 << 8)
      m.setU32((pDmg + 0x10) >>> 0, 100 << 8)
      m.setU32((pDmg + 0x6c) >>> 0, 200 << 8)
      expect(SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c(m, plr.pUnit, mon.pUnit, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c(m, pGame, 0, plr.pUnit, pMis, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)
      SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c(m, plr.pUnit, pGame)
      expect(SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c(m, plr.pUnit, mon.pUnit, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)

      attachUsedSkill(m, plr.pUnit, 40, 3, 1)
      expect(SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c(m, pGame, plr.pUnit, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)
      SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c(m, 40, plr.pUnit, mon.pUnit, pGame, 3, 12)
      expect(SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c(m, pGame, plr.pUnit, 40, 3)).toBe(1)
      expect(SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c(m, pGame, plr.pUnit, 50, 40, 3, 3)).toBe(1)
      expect(SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)

      // RegPop / SUnit / Clients (0x6FC671E0..0x6FC6AE90)
      const pCoordNode = m.alloc(0x40) >>> 0
      const pForm = m.alloc(0x40) >>> 0
      const pOutX = m.alloc(4) >>> 0
      const pOutY = m.alloc(4) >>> 0
      expect(REGPOP_SpawnMonsterFormation_6FC671E0_113c(m, pGame, pRoom, pCoordNode, 5, pForm, pOutX, pOutY)).toBeGreaterThanOrEqual(0)

      const pListNear = m.alloc(0x40) >>> 0
      const pMaxDist = m.alloc(4) >>> 0
      m.setU32(pMaxDist, 1000)
      SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c(m, 110, pListNear, plr.pUnit, 210, pMaxDist, pGame, 4)

      m.setU32(0x6fd31c18, 1)
      const pCharName = m.alloc(32) >>> 0
      const pAcctName = m.alloc(32) >>> 0
      m.setU8(pCharName, 0x48) // "H"
      m.setU8(pAcctName, 0x41) // "A"
      const pNewClient = CLIENTS_AllocAndLinkClient_6FC6A9B0_113c(m, 77, pGame, 0, pCharName, pAcctName, 0, 0)
      expect(pNewClient).not.toBe(0)
      const pPortrait = m.alloc(0x40) >>> 0
      CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c(m, pPortrait, pNewClient)
      expect(m.u8(pPortrait)).toBe(0x8d)

      // Amazon & Necro skills (0x6FC6C3A0..0x6FC6F4D0)
      expect(SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c(m, plr.pUnit, mon.pUnit, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c(m, mon.pUnit, plr.pUnit, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c(m, pGame, 0, mon.pUnit, plr.pUnit, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c(m, pGame, 0, mon.pUnit, plr.pUnit, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c(m, plr.pUnit, 50 << 8, pGame)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c(m, plr.pUnit, mon.pUnit, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c(m, pGame, 0, mon.pUnit, plr.pUnit, pDmg, 40, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c(m, pGame, plr.pUnit, 40, 3)).toBeGreaterThanOrEqual(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    // ------------------------------------------------------------------------
    // Shard 4: k2w6-b1 (41 VAs)
    // ------------------------------------------------------------------------
    {
      const { m, pGame, pSkillsTxt, pMonStatsTxt } = createWave6World()
      const { pRoom } = allocRoom(m, 2, 100, 200, 40, 40)
      const plr = allocDynamicUnit(m, pGame, 0, 6, 1, pRoom, 110, 210)
      const mon = allocDynamicUnit(m, pGame, 1, 5, 2, pRoom, 112, 210)
      PATH_SetTargetUnit113c(m, plr.pDynPath, mon.pUnit)
      m.setU16((pSkillsTxt + 1 * 0x23c + 0x80) >>> 0, 12)
      m.setU16((pSkillsTxt + 1 * 0x23c + 0x82) >>> 0, 13)
      m.setU16((pSkillsTxt + 2 * 0x23c + 0x80) >>> 0, 14)
      attachUsedSkill(m, plr.pUnit, 1, 3, 1)

      const pMissile = m.alloc(0x100) >>> 0
      const pMisDyn = m.alloc(0x100) >>> 0
      m.setU32(pMissile, 3)
      m.setU32((pMissile + 0x04) >>> 0, 0xffffffff)
      m.setU32((pMissile + 0x2c) >>> 0, pMisDyn)

      beginVaTrace113c()

      // 0x6FC221D0: STORM_TSHashTableCheckChainAndGrow
      const pHash = m.alloc(0x40) >>> 0
      const pBuckets = m.alloc(0x40) >>> 0
      m.setU32((pHash + 0x18) >>> 0, 4)
      m.setU32((pHash + 0x24) >>> 0, pBuckets)
      m.setU32((pHash + 0x28) >>> 0, 3)
      STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c(m, pHash, 1)
      expect(m.u32((pHash + 0x28) >>> 0)).toBe(3)

      // 0x6FC2C900, 0x6FC2D7B0, 0x6FC2D9C0
      expect(SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c(m, pGame, mon.pUnit, 1, 1)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c(m, pGame, mon.pUnit, 1, 1)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c(m, pGame, mon.pUnit, 1, 1)).toBeGreaterThanOrEqual(0)

      // 0x6FC3A9F0, 0x6FC3AF80: AI Succubus & CurseCaster
      const pAiArg = m.alloc(0x40) >>> 0
      m.setU16((pMonStatsTxt + 5 * 0x1a8 + 0x178) >>> 0, 0xffff)
      m.setU32((pAiArg + 0x08) >>> 0, plr.pUnit)
      m.setU32((pAiArg + 0x1c) >>> 0, (pMonStatsTxt + 5 * 0x1a8) >>> 0)
      AI_ThinkSuccubus_6FC3A9F0_113c(m, pGame, mon.pUnit, pAiArg)
      AI_ThinkCurseCaster_6FC3AF80_113c(m, pGame, mon.pUnit, pAiArg)

      // 0x6FC44250, 0x6FC47130, 0x6FC47B90, 0x6FC49600
      MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c(m, pGame, mon.pUnit, plr.pUnit, 0)
      expect(SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c(m, pGame, mon.pUnit)).toBe(0)
      expect(SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c(m, pGame, plr.pUnit, 1, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c(m, pGame, plr.pUnit, 1, 3)).toBeGreaterThanOrEqual(0)

      // 0x6FC52110, 0x6FC565B0
      expect(() => OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c(m, pGame, 0, 0, 10, 10)).toThrow(
        'Objects.cpp:391: pRoom == 0',
      )
      expect(OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c(m, pGame, pRoom, 0, 115, 215)).toBeGreaterThanOrEqual(0)
      const pQuestArg = m.alloc(0x20) >>> 0
      m.setU32(pQuestArg, pGame)
      QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c(m, pQuestArg)

      // 10 Missile SrvHit handlers (0x6FC5AB30..0x6FC5E0B0, excl. already-verified 0x6FC5B990)
      expect(MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)
      expect(MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c(m, pGame, pMissile, 0)).toBe(1)
      expect(MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c(m, pGame, pMissile, mon.pUnit)).toBe(3)
      expect(MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)
      expect(MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)
      expect(MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)
      expect(MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)
      expect(MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)
      expect(MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)
      expect(MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)
      expect(MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c(m, pGame, pMissile, mon.pUnit)).toBe(1)

      // 5 Missile SrvDo handlers (0x6FC5F550..0x6FC61EB0)
      expect(MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c(m, pGame, 0)).toBe(2)
      expect(MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c(m, pGame, 0)).toBe(2)
      expect(MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c(m, pGame, 0)).toBe(2)
      expect(MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c(m, pGame, 0)).toBe(2)
      expect(MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c(m, pGame, 0)).toBe(2)

      // Skill projectile, aura, state, corpse, curse, and quest functions (0x6FC62510..0x6FC85500)
      expect(SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c(m, plr.pUnit, mon.pUnit, pGame, 1, 1, 1)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c(m, pGame, plr.pUnit, 1, 1)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c(m, pGame, plr.pUnit, 1, 1)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c(m, pGame, plr.pUnit, 1, 1)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c(m, pGame, plr.pUnit, 2, 3)).toBe(1)
      expect(SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c(m, pGame, plr.pUnit, 1, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c(m, pGame, plr.pUnit, 1, 3)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c(m, mon.pUnit)).toBe(0)
      expect(SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c(m, pGame, plr.pUnit, 1, 1)).toBe(0)
      expect(SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c(m, mon.pUnit, plr.pUnit, pGame)).toBeGreaterThanOrEqual(0)
      expect(SKILLS_ApplyAttractCurseCallback_6FC70B70_113c(m, mon.pUnit, 0)).toBe(0)

      const pQuestData = m.alloc(0x40) >>> 0
      const pQuestState = m.alloc(0x40) >>> 0
      const pQuestCtrl = m.alloc(0x40) >>> 0
      m.setU32((pQuestCtrl + 0x18) >>> 0, 0x2468ace1)
      m.setU32((pQuestCtrl + 0x1c) >>> 0, 0x29a)
      m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl)
      m.setU32((pQuestData + 0x04) >>> 0, pGame)
      m.setU32((pQuestData + 0x18) >>> 0, pQuestState)
      const pPlayerFlags = QUESTRECORD_AllocRecord113c(m, 0) >>> 0
      const pOutFilter = m.alloc(4) >>> 0

      expect(ACT5Q3_StatusFilter_6FC7B8C0_113c(m, pQuestData, plr.pUnit, 0, pPlayerFlags, pOutFilter)).toBeGreaterThanOrEqual(0)
      ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c(m, pQuestData)
      expect(ACT1Q5_StatusFilter_6FC85500_113c(m, pQuestData, plr.pUnit, 0, pPlayerFlags, pOutFilter)).toBeGreaterThanOrEqual(0)

      for (const v of endVaTrace113c()) cumulativeHits.add(v)
    }

    const missingVas = WAVE6_PROMOTED_SPECS.map((s) => `D2Game:${s.va}`).filter(
      (key) => !cumulativeHits.has(key),
    )
    expect(missingVas).toEqual([])
  })
})
