/**
 * @file src/d2kern-113c/game/k3-p52-sorc-handlers-113c.ts
 * Clean-room 1:1 binary dispatch helpers for Milestone 34 (`[K3]`) Sorceress
 * longitudinal golden replays (`p52-sorceress-elemental`, `p52-sorceress-fire-dot`).
 *
 * Strictly pure `src/d2kern-113c/` imports only (zero legacy common or host imports).
 */

import { ANIMSEQ_GetEventAtFrame113c } from '../common/composit.ts'
import { DUNGEON_GetAdjacentRoomsListFromRoom113c } from '../common/dungeon.ts'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  MISSILE_GetElapsedFrames113c,
  MISSILE_GetLevel113c,
  MISSILE_GetSkill113c,
} from '../common/missile.ts'
import { PATH_GetTargetUnit113c } from '../common/path.ts'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetSkillIdFromSkill113c,
} from '../common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_CheckStateMaskExpOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_ClampUnitPoolStatsToMax113c,
  STATLIST_GetState113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
} from '../common/statlist.ts'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_GetAnimStartFrame113c,
  UNITS_GetRoom113c,
  UNITS_SetSeqFrameFromLowByte113c,
} from '../common/unit.ts'
import { D2UnitStrc } from '../mem/layout.generated.ts'
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts'
import {
  registerSkillsSrvStDispatcher113c,
  SKILLS_DoUsedSkillAction113c,
  SKILLS_StartPlayerSkillAnimOrCast113c,
  SrvDoFunc_001_Attack113c,
} from './a1c-post150-f786-f1040-113c.ts'
import { flushPendingSavedObjectInitModes113c } from './objects-populate-113c.ts'
import { runPostActRoomsUpdateHooks113c } from './monster-events.ts'
import {
  C2S_Packet0C_RightSkillOnLocation113c,
  C2S_Packet0D_RightSkillOnUnit113c,
  C2S_Packet0E_ShiftRightSkillOnUnit113c,
  C2S_Packet0F_RepeatRightSkillOnLocation113c,
  C2S_Packet10_RepeatRightSkillOnUnit113c,
  C2S_Packet11_RepeatShiftRightSkillOnUnit113c,
  type C2SPacketCallees113c,
} from './c2s-packet-113c.ts'
import {
  MONSTER_SetLastHitModeField54_113c,
  SrvDoFunc_020_StaticField113c,
  SrvDoFunc_065_AuraRadialStatBuff113c,
  setItemdefGapFrameHooks113c,
} from './k2-gap-itemdef-113c.ts'
import {
  type K2GapMeleeDotHooks113c,
  MISSILES_GetTxtRecordFast113c,
  MISSILE_SrvDo01_FastcallThunk113c,
  MISSILE_SrvDo01_LinearProjectile113c,
  MONSTER_StartGetHitMode113c,
  SKILLS_SrvDo_NovaRing113c,
  withScopedMeleeDotHooks113c,
} from './k2-gap-melee-dot-113c.ts'
import { MONUMOD_DispatchOnKillEvent5_113c } from './k2-items-tc-w1-113c.ts'
import {
  SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c,
  SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c,
  SKILLS_SrvSt59_Submerge_6FC2BEE0_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c,
  SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts'
import {
  MISSILES_InitChargedBoltPath_6FC61F50_113c,
  MISSILES_InitDrunkenPath_6FC59210_113c,
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
  MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c,
  MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c,
  MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c,
  MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c,
  SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c,
} from './k2-laneK-0x6fc5-w1-113c.ts'
import {
  SKILLS_AddDamagePercentStat_6FC6C190_113c,
  SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c,
  SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c,
  SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c,
  SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c,
  SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c,
  SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c,
} from './k2-laneL-0x6fc6-w1-113c.ts'
import {
  MONSTER_StartMode113c,
  PLAYER_StartModeDispatch113c,
  SUNITDMG_CheckMonTypeFlag113c,
  SUNITDMG_ClampManaBurnByMonsterSkill113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c,
  type SUnitDmgHooks113c,
} from './k2-real-s2c-combat-113c.ts'
import { SKILLS_SrvSt18_ReturnOne113c } from './k2-sunit-spawn-w1-113c.ts'
import {
  type K2W2B4Hooks113c,
  MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c,
  SKILLS_DispatchSrvDoFunc_6FCBE420_113c,
  SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c,
  SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c,
  SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c,
  SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c,
} from './k2-w2b4-113c.ts'
import {
  SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c,
  SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c,
  SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c,
  SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c,
  SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c,
  SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c,
  SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c,
} from './k2-w2b6-113c.ts'
import {
  SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c,
  SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c,
  SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c,
  SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c,
  SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c,
  SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c,
} from './k2-w3b1-113c.ts'
import {
  SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c,
  SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c,
} from './k2-w3b2-113c.ts'
import {
  type K2W3B3Hooks113c,
  MISSILES_ApplyColdLengthToDamage_6FC59080_113c,
  MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c,
  MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c,
  MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c,
  MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c,
  MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c,
  MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c,
  MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c,
  MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c,
  MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c,
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
} from './k2-w3b3-113c.ts'
import {
  MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c,
  MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c,
  MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c,
  MISSILE_SrvDo_HomingTargetStep_6FC61240_113c,
  MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c,
  MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c,
  MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c,
  MISSILE_SrvDo_SpiralPath_6FC60BD0_113c,
  MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c,
  MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c,
  MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c,
  MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c,
  MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c,
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
} from './k2-w3b4-113c.ts'
import { SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c } from './k2-w4b1-113c.ts'
import {
  MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c,
  MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c,
  MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c,
  MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c,
  MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c,
  MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c,
  MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c,
  MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c,
  MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c,
  MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c,
  MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c,
  MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c,
  MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c,
  MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c,
  SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c,
  SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c,
  SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c,
} from './k2-w4b2-113c.ts'
import {
  type K2W4B3Hooks113c,
  MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c,
  MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c,
  MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c,
  MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c,
} from './k2-w4b3-113c.ts'
import {
  MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c,
  SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c,
  SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c,
  SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c,
} from './k2-w4b5-113c.ts'
import {
  SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c,
  SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c,
  SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c,
} from './k2-w4b6-113c.ts'
import {
  MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c,
  MONAI_ImpregnateChaseThink_6FCC7F60_113c,
  MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c,
  MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c,
  MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c,
  MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c,
  MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c,
  MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c,
  MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c,
} from './k2-w4b7-113c.ts'
import {
  SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c,
  SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c,
  SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c,
  SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c,
  SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c,
  SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c,
  SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c,
  SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c,
  SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c,
  SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c,
  SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c,
  SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c,
} from './k2-w4b8-113c.ts'
import {
  MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c,
  MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c,
  MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c,
  MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c,
  MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c,
  MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c,
  SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c,
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
  SKILLS_SrvSt32_EnsureWeaponOrQuiverOrStartCast_6FC6C840_113c,
} from './k2-w5b1-113c.ts'
import {
  SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c,
  SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c,
  SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c,
  SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c,
  SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c,
  SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c,
  SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c,
  SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c,
  SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c,
  SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c,
  STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c,
} from './k2-w5b2-113c.ts'
import {
  SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c,
  SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c,
  SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c,
  SKILLS_DoChargeStart_6FCB9620_113c,
  SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c,
  SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c,
  SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c,
  SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c,
  SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c,
  SKILLS_DoRedemptionAuraPulse_6FCBA400_113c,
  SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c,
  SKILLS_DoUnsummonStart_6FCBFEF0_113c,
  SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c,
  SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c,
  SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c,
  withScopedRadialCombatHooks113c,
} from './k2-w5b3-113c.ts'
import {
  SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c,
  SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c,
  SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c,
  SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c,
} from './k2-w5b6-113c.ts'
import { SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c } from './k2-w5b7-113c.ts'
import {
  MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c,
  MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c,
  MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c,
  MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c,
  MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c,
  MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c,
  MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c,
  MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c,
  MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c,
  MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c,
  MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c,
  MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c,
  MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c,
  MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c,
  MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c,
  MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c,
  SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c,
  SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c,
  SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c,
  SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c,
  SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c,
  SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c,
  SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c,
  SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c,
  SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c,
  SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c,
  SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c,
  SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c,
  SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c,
} from './k2-w6b1-113c.ts'
import {
  MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c,
  SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c,
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
  SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c,
  SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c,
  SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c,
  SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c,
  SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c,
  SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c,
  SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c,
  SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c,
  SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c,
  SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c,
} from './k2-w6b2-113c.ts'
import { AI_ThinkTerrorCurse_6FCC6FC0_113c } from './k2-w6b3-113c.ts'
import {
  OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c,
  SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c,
  SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c,
  SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c,
} from './k2-w6b4-113c.ts'
import {
  SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c,
  SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c,
  SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c,
  SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c,
} from './k2-w6b5-113c.ts'
import {
  QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c,
  SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c,
  SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c,
  SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c,
  SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c,
  SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c,
  SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c,
  SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c,
  SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c,
  SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c,
  SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c,
  SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c,
  SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c,
  SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c,
  SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c,
  SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c,
  SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c,
} from './k2-w7b1-113c.ts'
import {
  SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c,
  SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c,
  SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c,
  SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c,
  dragonFlightStrikeFixed113c,
  dragonTailKickHitFixed113c,
} from './k2-w7b2-113c.ts'
import {
  SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c,
  SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c,
  SKILLS_SrvDo028_Conversion_6FCB9830_113c,
  SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c,
  SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c,
  SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c,
  SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c,
  SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c,
  SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c,
} from './k2-w7b3-113c.ts'
import {
  SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c,
  SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c,
  SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c,
  SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c,
} from './k2-w8b1-113c.ts'
import {
  SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c,
  SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c,
  SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c,
  SKILLS_SrvDo_Unsummon_6FCC2EA0_113c,
} from './k2-w8b2-113c.ts'
import {
  MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c,
  MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c,
  SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c,
} from './k2-w9b1-113c.ts'
import { SKILLS_SrvDo_Telekinesis_6FC631C0_113c } from './k2-w10b1-113c.ts'
import {
  SKILLS_SrvDo029_Teleport_6FC63450_113c,
  SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c,
  SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c,
  SKILLS_SrvDo252_DragonFlight_6FCB3680_113c,
  SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c,
  SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c,
} from './k2-w11b1-113c.ts'
import {
  SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c,
  SKILLS_SrvDo_MonsterConvert_6FC71340_113c,
} from './k2-w12b1-113c.ts'
import { MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c } from './k2-w14b1-113c.ts'
import {
  SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c,
  SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c,
} from './k2-w15b1-113c.ts'
import {
  MISSILE_DefaultSrvHitFlagsK3_113c,
  MISSMODE_SrvDmg07_WarcryShockWaveK3_113c,
  MISSMODE_SrvHit18_ShoutBattleOrdersCommandK3_113c,
  SKILLS_SrvDo068_BasicShoutK3_113c,
} from './k3-p52-handlers-113c.ts'
import {
  dispatchSummonOrCurseDoFuncK3_113c,
  ensurePlayerPetTableAllocatedK3_113c,
} from './k3-summon-curse-replay-113c.ts'
import {
  MONSTER_ClearModeEvents113c,
  registerMonsterAiThinkVaHandler113c,
} from './monster-events.ts'
import {
  SKILLS_GetRecordPtrFast113c,
  SUNIT_ValidatePathTargetUnit113c,
} from './regpop-spawn-113c.ts'
import {
  applyPlayerPacket113c,
  SUNIT_ScheduleModeAnimEvents113c,
} from './replay-kernel-113c.ts'
import type { PureCharAnimClip113c } from './tables-bootstrap-113c.ts'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel.ts'

let k3SorcScratchSp = 0x7ef70000
const k3RadialCombatHooksByMeleeHooks = new WeakMap<K2GapMeleeDotHooks113c, SUnitDmgHooks113c>()

function hasHydratedAnimDataTableK3_113c(m: Memory113c): boolean {
  try {
    return m.u32(0x6fdf0b4c) !== 0
  } catch {
    return false
  }
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

/**
 * `@va D2Game:0x6FCFF7B0`: schedules mode step (`0`) and mode end (`1`) events for both
 * `AnimData` modes and `PLRMODE_SEQUENCE (18)` (`pUnit + 0x30` `D2AnimSeqTxt*`), delegating
 * standard clips directly to canonical `SUNIT_ScheduleModeAnimEvents113c` (`0x6FCFF7B0`).
 */
export function PLAYER_ScheduleModeAnimEventsK3_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  const u = pUnit >>> 0
  const g = pGame >>> 0
  const startFrame = UNITS_GetAnimStartFrame113c(m, u) | 0
  const pSeq = m.u32((u + 0x30) >>> 0)
  const stepFp8 = pSeq !== 0 ? (m.u32((u + 0x3c) >>> 0) | 0) : sx16(m.u16((u + 0x4c) >>> 0))
  const endFp8 = pSeq !== 0 ? (m.u32((u + 0x34) >>> 0) | 0) : (m.u32((u + 0x48) >>> 0) | 0)
  if (stepFp8 === 0) {
    SUNIT_ScheduleModeAnimEvents113c(m, g, u, { frames: 0, speed: 0, events: [] }, startFrame, 0)
    return
  }

  const pAnimData = m.u32((u + 0x50) >>> 0)
  if (stepFp8 > 0 && (endFp8 & 0xff) === 0) {
    const frames = endFp8 >> 8
    const events: { f: number; c: number }[] = []
    let hasCode4 = false
    const savedSp = k3SorcScratchSp
    const pEventScratch = savedSp
    k3SorcScratchSp = (savedSp + 16) >>> 0
    try {
      for (let f = startFrame; f < frames && f < 0x90; f++) {
        let evCode = 0
        if (pSeq !== 0) {
          m.setU32(pEventScratch, 0)
          ANIMSEQ_GetEventAtFrame113c(m, pSeq, (f << 8) >>> 0, pEventScratch)
          evCode = m.u32(pEventScratch) | 0
        } else if (pAnimData !== 0) {
          evCode = m.u8((pAnimData + f + 0x10) >>> 0)
        }
        if (evCode >= 1 && evCode <= 4) {
          if (evCode === 4) hasCode4 = true
          events.push({ f, c: evCode })
        }
      }
    } finally {
      k3SorcScratchSp = savedSp
    }
    if (!hasCode4) {
      const clip: PureCharAnimClip113c = { frames, speed: stepFp8, events }
      SUNIT_ScheduleModeAnimEvents113c(m, g, u, clip, startFrame, stepFp8)
      m.setU32((u + 0x44) >>> 0, (m.u32((g + 0xa8) >>> 0) << 8) >>> 0)
      return
    }
  }

  let ebx = m.u32((g + 0xa8) >>> 0) | 0
  let curFp8 = (startFrame << 8) | 0
  let edi = curFp8 >> 8
  curFp8 = (curFp8 + stepFp8) | 0
  let stepIdx = 0
  const savedSp = k3SorcScratchSp
  const pEventScratch = savedSp
  k3SorcScratchSp = (savedSp + 16) >>> 0
  try {
    while (curFp8 < endFp8) {
      const nextFrameIdx = curFp8 >> 8
      ebx = (ebx + 1) | 0
      while (edi <= nextFrameIdx && edi < 0x90) {
        let evCode = 0
        const curSeq = m.u32((u + 0x30) >>> 0)
        if (curSeq !== 0) {
          m.setU32(pEventScratch, 0)
          ANIMSEQ_GetEventAtFrame113c(m, curSeq, (edi << 8) >>> 0, pEventScratch)
          evCode = m.u32(pEventScratch) | 0
        } else if (pAnimData !== 0) {
          evCode = m.u8((pAnimData + edi + 0x10) >>> 0)
        }
        if (evCode === 1 || evCode === 2 || evCode === 4) {
          EVENT_SetEventFull113c(m, g, u, 0, ebx, 0, evCode, stepIdx)
          stepIdx = (stepIdx + 1) | 0
        } else if (evCode === 3) {
          EVENT_SetEventFull113c(m, g, u, 0, ebx, 0, 3, 0)
        }
        edi = (edi + 1) | 0
      }
      curFp8 = (curFp8 + stepFp8) | 0
    }
  } finally {
    k3SorcScratchSp = savedSp
  }
  const gameFrame = m.u32((g + 0xa8) >>> 0) | 0
  if (ebx === gameFrame) {
    ebx = (ebx + 1) | 0
  }
  ebx = (ebx + 1) | 0
  EVENT_SetEventFull113c(m, g, u, 1, ebx, 0, 0, 0)
  m.setU32((u + 0x44) >>> 0, (m.u32((g + 0xa8) >>> 0) << 8) >>> 0)
}

export function dispatchSkillSrvStK3_113c(
  mem: Memory113c,
  stIdx: number,
  pg: number,
  pu: number,
  skId: number,
  skLvl: number,
): number {
  const sm = mem as SparseMemory113c
  switch (stIdx) {
    case 1:
      return SKILLS_StartPlayerSkillAnimOrCast113c(sm, pg, pu, skId, skLvl)
    case 2:
      return SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c(sm, pg, pu, skId, skLvl)
    case 3:
      return SKILLS_DoUnsummonStart_6FCBFEF0_113c(sm, pg, pu, skId, skLvl)
    case 4:
      return SKILLS_SrvSt32_EnsureWeaponOrQuiverOrStartCast_6FC6C840_113c(sm, pg, pu, skId, skLvl)
    case 5:
      return SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c(sm, pg, pu, skId, skLvl)
    case 6:
      return SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c(sm, pg, pu, skId, skLvl)
    case 7:
      return SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c(sm, pg, pu, skId, skLvl)
    case 8:
      return SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c(sm, pg, pu, skId, skLvl)
    case 9:
      return SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c(sm, pg, pu, skId, skLvl)
    case 10:
      return SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c(sm, pg, pu, skId, skLvl)
    case 11:
      return SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c(sm, pg, pu, skId, skLvl)
    case 12:
      return SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c(sm, pg, pu, skId, skLvl)
    case 13:
      return SKILLS_SrvSt13_ResetSkillParams_6FC62230_113c(sm, pg, pu, skId, skLvl)
    case 14:
      return SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c(sm, pg, pu, skId, skLvl)
    case 15:
      return SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c(sm, pg, pu, skId, skLvl)
    case 16:
      return SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c(sm, pg, pu, skId, skLvl)
    case 17:
      return SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c(sm, pg, pu, skId, skLvl)
    case 18:
      return SKILLS_SrvSt18_ReturnOne113c(sm, pg, pu, skId, skLvl)
    case 19:
      return SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c(sm, pg, pu, skId, skLvl)
    case 20:
      return SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c(sm, pg, pu, skId, skLvl)
    case 21:
      return SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c(sm, pg, pu, skId, skLvl)
    case 22:
      return SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c(sm, pg, pu, skId, skLvl)
    case 23:
      return SKILLS_SrvSt23_ValidateMeleeTarget_6FCB2030_113c(sm, pg, pu, skId, skLvl)
    case 24:
      return SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c(sm, pg, pu, skId, skLvl)
    case 25:
      return SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c(sm, pg, pu, skId, skLvl)
    case 26:
      return SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c(sm, pg, pu, skId, skLvl)
    case 27:
      return dragonTailKickHitFixed113c(sm, pg, pu, skId, skLvl)
    case 28:
      return SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0_113c(sm, pg, pu, skId, skLvl)
    case 29:
      return SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c(sm, pg, pu, skId, skLvl)
    case 31:
      return SKILLS_DoChargeStart_6FCB9620_113c(sm, pg, pu, skId, skLvl)
    case 32:
      return SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c(sm, pg, pu, skId, skLvl)
    case 33:
      return SKILLS_SrvSt33_CheckSelectableCorpseNoState76_6FC47270_113c(sm, pg, pu, skId, skLvl)
    case 34:
      return SKILLS_SrvSt34_CheckSelectableCorpseTarget_6FC47240_113c(sm, pg, pu, skId, skLvl)
    case 35:
      return SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c(sm, pg, pu, skId, skLvl)
    case 36:
      return SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c(mem, pu, pg, skId, skLvl)
    case 37:
      return SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c(sm, pg, pu, skId, skLvl)
    case 38:
      return SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c(sm, pg, pu, skId, skLvl)
    case 39:
      return SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c(sm, pg, pu, skId, skLvl)
    case 40:
      return SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c(sm, pg, pu, skId, skLvl)
    case 41:
      return SKILLS_SrvSt06_ChargeStart_6FC48600_113c(sm, pg, pu, skId, skLvl)
    case 42:
      return SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c(sm, pg, pu, skId, skLvl)
    case 43:
      return SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c(sm, pg, pu, skId, skLvl)
    case 44:
      return SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c(sm, pg, pu, skId, skLvl)
    case 45:
      return MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c(sm, pu, skId, skLvl)
    case 46:
      return SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c(sm, pg, pu, skId, skLvl)
    case 47:
      return SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c(sm, pg, pu, skId, skLvl)
    case 48:
      return SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c(sm, pg, pu, skId, skLvl)
    case 49:
      return SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c(sm, pg, pu, skId, skLvl)
    case 50:
      return SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c(sm, pg, pu, skId, skLvl)
    case 51:
      return SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c(sm, pg, pu, skId, skLvl)
    case 52:
      return SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c(sm, pg, pu, skId, skLvl)
    case 53:
      return MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c(sm, pg, pu, skId, skLvl)
    case 54:
      return MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c(sm, pg, pu, skId, skLvl)
    case 55:
      return MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c(sm, pg, pu, skId, skLvl)
    case 56:
      return SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c(sm, pg, pu, skId, skLvl)
    case 57:
      return SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c(sm, pg, pu, skId, skLvl)
    case 58:
      return SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c(sm, pg, pu, skId, skLvl)
    case 59:
      return SKILLS_SrvSt59_Submerge_6FC2BEE0_113c(sm, pg, pu, skId, skLvl)
    case 60:
      return SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c(sm, pg, pu, skId, skLvl)
    case 61:
      return SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c(sm, pg, pu, skId, skLvl)
    case 62:
      return SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c(sm, pg, pu, skId, skLvl)
    case 63:
      return SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c(sm, pg, pu, skId, skLvl)
    case 64:
      return SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c(sm, pg, pu, skId, skLvl)
    case 65:
      return SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c(sm, pg, pu, skId, skLvl)
    default:
      return 1
  }
}

let k3SkillsSrvStRegistered = false
let inTauntThink6FCC7F60 = false

export function ensureK3SkillsSrvStRegistered113c(): void {
  if (k3SkillsSrvStRegistered) return
  k3SkillsSrvStRegistered = true
  registerSkillsSrvStDispatcher113c(dispatchSkillSrvStK3_113c)
  registerMonsterAiThinkVaHandler113c(0x6fcc8270, MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c)
  registerMonsterAiThinkVaHandler113c(0x6fcc5c80, MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c)
  registerMonsterAiThinkVaHandler113c(0x6fcc6fc0, AI_ThinkTerrorCurse_6FCC6FC0_113c)
  registerMonsterAiThinkVaHandler113c(0x6fcc7f60, (mem, pg, pu, pAiParam) => {
    if (inTauntThink6FCC7F60) return
    inTauntThink6FCC7F60 = true
    try {
      MONAI_ImpregnateChaseThink_6FCC7F60_113c(mem, pg, pu, pAiParam)
    } finally {
      inTauntThink6FCC7F60 = false
    }
  })
}

/**
 * Delegates to canonical manifest-bound `applyPlayerPacket113c` (`D2Game:0x6FC987C0`) with
 * K3 animation-sequence scheduling (`PLAYER_ScheduleModeAnimEventsK3_113c`), pre-skill target
 * validation (`0x6FD007A0`), and K3 `SrvSt` dispatch (`dispatchSkillSrvStK3_113c`).
 */
export function PLAYER_StartCastSkillOnUnitK3_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  nMode: number,
  pTargetUnit: number,
): void {
  applyPlayerPacket113c(m, pGame, pPlayer, nMode, pTargetUnit, {
    scheduleAnimEvents: PLAYER_ScheduleModeAnimEventsK3_113c,
    onAfterClearFlag40: (mem, pg, plr) => {
      SUNIT_ValidatePathTargetUnit113c(mem, plr, pg)
    },
    onSrvStFunc: dispatchSkillSrvStK3_113c,
  })
}

/**
 * `@va D2Game:0x6FCEE520` (`0x0C` right skill on location) + `@va D2Game:0x6FCEE870` (`0x0D` right skill on unit):
 * Enforces the exact `50`-subtile (`0x32`) coordinate delta guard (`0x6FCEBF50` / `0x6FCED630` -> `0x6FCECFE0` -> `0x6FCEB690`),
 * `D2Common.#10787` (`SKILLS_GetSkillUseFailReason113c` mana/delay gate), and `D2Common.#10952` (`SKILLS_GetSkillSlotIndex113c`
 * `PLRMODE_CAST = 10` vs `PLRMODE_SEQUENCE = 18`).
 */
export function PLAYER_HandleC2SRightSkillK3_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  packetBytes: Uint8Array,
  resolveUnit: (targetType: number, targetId: number) => number,
  syncPathUnit?: (mode: number, flags: number) => void,
): number {
  if (packetBytes.length === 0 || pPlayer === 0) return 0
  const op = packetBytes[0]!
  const view = new DataView(packetBytes.buffer, packetBytes.byteOffset, packetBytes.byteLength)

  if (UNITS_GetRoom113c(m, pPlayer) === 0) return 0
  const curMode = m.get(pPlayer, D2UnitStrc.dwAnimMode)
  if (curMode === 0 || curMode === 0x11) return 0
  if (
    m.get(pPlayer, D2UnitStrc.pStatListEx) !== 0 &&
    STATES_CheckState113c(m, pPlayer, 1) !== 0
  ) {
    return 0
  }

  const savedSp = k3SorcScratchSp
  const pPkt = savedSp
  k3SorcScratchSp = (savedSp + 16) >>> 0
  try {
    for (let i = 0; i < packetBytes.length && i < 16; i++) {
      m.setU8((pPkt + i) >>> 0, packetBytes[i]!)
    }
    const callees: C2SPacketCallees113c = {
      findServerUnit(_mem, _pg, dwUnitType, dwUnitId) {
        return resolveUnit(dwUnitType, dwUnitId) >>> 0
      },
      onStartAttackOnUnit(mem, pg, plr, tgt, mode) {
        PLAYER_StartCastSkillOnUnitK3_113c(mem, pg, plr, mode, tgt)
      },
      onAfterModeStarted(mem, plr) {
        if (syncPathUnit !== undefined) {
          syncPathUnit(mem.get(plr, D2UnitStrc.dwAnimMode), mem.get(plr, D2UnitStrc.dwFlags))
        }
      },
    }

    if (op === 0x0c && packetBytes.length >= 5) {
      const x = view.getUint16(1, true)
      const y = view.getUint16(3, true)
      if (x === 0 || y === 0) return 0
      const rc = C2S_Packet0C_RightSkillOnLocation113c(m, pGame, pPlayer, pPkt, 5, callees)
      return rc === 0 ? 1 : 0
    }

    if (op === 0x0f && packetBytes.length >= 5) {
      const x = view.getUint16(1, true)
      const y = view.getUint16(3, true)
      if (x === 0 || y === 0) return 0
      const rc = C2S_Packet0F_RepeatRightSkillOnLocation113c(m, pGame, pPlayer, pPkt, 5, callees)
      return rc === 0 ? 1 : 0
    }

    if (op === 0x0d && packetBytes.length >= 9) {
      const rc = C2S_Packet0D_RightSkillOnUnit113c(m, pGame, pPlayer, pPkt, 9, callees)
      return rc === 0 ? 1 : 0
    }

    if (op === 0x0e && packetBytes.length >= 9) {
      const rc = C2S_Packet0E_ShiftRightSkillOnUnit113c(m, pGame, pPlayer, pPkt, 9, callees)
      return rc === 0 ? 1 : 0
    }

    if (op === 0x10 && packetBytes.length >= 9) {
      const rc = C2S_Packet10_RepeatRightSkillOnUnit113c(m, pGame, pPlayer, pPkt, 9, callees)
      return rc === 0 ? 1 : 0
    }

    if (op === 0x11 && packetBytes.length >= 9) {
      const rc = C2S_Packet11_RepeatShiftRightSkillOnUnit113c(m, pGame, pPlayer, pPkt, 9, callees)
      return rc === 0 ? 1 : 0
    }
  } finally {
    k3SorcScratchSp = savedSp
  }

  return 0
}

/**
 * `@va D2Game:0x6FCC2060` -> `@va D2Game:0x6FCC19A0`:
 * Executes `pUnit`'s used skill action through canonical manifest-bound `SrvDo` handlers
 * (`0x6FC6C2A0`, `0x6FC637D0`, `0x6FC63720`, `0x6FC49720`, `0x6FCD49F0`, summon/curse `SrvDo`),
 * `0x6FCC1790` (`decquant`), and `0x6FCBFF70` (`STATE_SKILLDELAY`).
 */
function collectRoomCurseStatListsK3_113c(
  m: Memory113c,
  pCenterRoom: number,
  seenRooms: Set<number>,
  seenUnits: Set<number>,
  out: Array<{ unit: number; list: number; state: number }>,
): void {
  if (pCenterRoom === 0 || seenRooms.has(pCenterRoom)) return
  const savedSp = k3SorcScratchSp
  const ppRooms = savedSp
  const pCount = (savedSp + 4) >>> 0
  k3SorcScratchSp = (savedSp + 8) >>> 0
  let pList = 0
  let count = 0
  try {
    m.setU32(ppRooms, 0)
    m.setU32(pCount, 0)
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pCenterRoom, ppRooms, pCount)
    pList = m.u32(ppRooms) >>> 0
    count = m.u32(pCount) >>> 0
  } finally {
    k3SorcScratchSp = savedSp
  }
  for (let i = 0; i < count; i++) {
    const pRoom = pList !== 0 ? (m.u32((pList + i * 4) >>> 0) >>> 0) : 0
    if (pRoom === 0 || seenRooms.has(pRoom)) continue
    seenRooms.add(pRoom)
    for (let u = m.u32((pRoom + 0x74) >>> 0) >>> 0; u !== 0; u = m.u32((u + 0xe8) >>> 0) >>> 0) {
      if (seenUnits.has(u)) continue
      seenUnits.add(u)
      const uType = m.u32(u) | 0
      if (uType !== 0 && uType !== 1) continue
      const pCurse = STATLIST_GetStatListFromUnitAndFlag113c(m, u, 0x20) >>> 0
      if (pCurse !== 0) {
        const st = STATLIST_GetState113c(m, pCurse) | 0
        if (st > 0) {
          out.push({ unit: u, list: pCurse, state: st })
        }
      }
    }
  }
}

function withReplacedCurseGfxSyncK3_113c<T>(
  m: Memory113c,
  pOriginUnit: number,
  pExtraUnit: number,
  fn: () => T,
): T {
  const prevCurses: Array<{ unit: number; list: number; state: number }> = []
  const seenRooms = new Set<number>()
  const seenUnits = new Set<number>()
  if (pOriginUnit !== 0) {
    collectRoomCurseStatListsK3_113c(m, UNITS_GetRoom113c(m, pOriginUnit) >>> 0, seenRooms, seenUnits, prevCurses)
  }
  if (pExtraUnit !== 0) {
    collectRoomCurseStatListsK3_113c(m, UNITS_GetRoom113c(m, pExtraUnit) >>> 0, seenRooms, seenUnits, prevCurses)
  }
  const res = fn()
  for (let i = 0; i < prevCurses.length; i++) {
    const entry = prevCurses[i]!
    const u = entry.unit >>> 0
    const curList = STATLIST_GetStatListFromUnitAndFlag113c(m, u, 0x20) >>> 0
    if (curList === entry.list) continue
    if (STATLIST_GetStatListFromUnitAndStateMemPort113c(m, u, entry.state) !== 0) continue
    if (STATES_CheckState113c(m, u, entry.state) === 0) continue
    const uType = m.u32(u) | 0
    const mode = m.u32((u + 0x10) >>> 0) | 0
    const isDeadLike =
      (m.u8((u + 0xc6) >>> 0) & 0x01) !== 0 ||
      (uType === 0
        ? mode === 0 || mode === 0x11
        : uType === 1
          ? mode === 0 || mode === 0x0c
          : true)
    if (!isDeadLike || STATES_CheckStateMaskExpOnUnit113c(m, u, entry.state) === 0) {
      STATES_ToggleGfxStateFlag113c(m, u, entry.state, 0)
      UNITROOM_RefreshUnit113c(m, u)
      STATLIST_ClampUnitPoolStatsToMax113c(m, u)
    }
  }
  return res
}

function dispatchSkillSrvDoByIdxK3_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  doIdx: number,
  skId: number,
  effLvl: number,
  hooks: K2GapMeleeDotHooks113c,
): number {
  const sm = m as SparseMemory113c
  if (doIdx === 6) {
    return SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 17) {
    const r = SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c(sm, pGame, pUnit, skId, effLvl)
    if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
    return r
  }
  if (doIdx === 18) {
    const r = SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c(sm, pGame, pUnit, skId, effLvl)
    if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
    return r
  }
  if (doIdx === 19) {
    const r = SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c(sm, pGame, pUnit, skId, effLvl)
    if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
    return r
  }
  if (doIdx === 21) {
    return SKILLS_SrvDo_Telekinesis_6FC631C0_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 22) {
    return SKILLS_SrvDo_NovaRing113c(m, pGame, pUnit, skId, effLvl, hooks)
  }
  if (doIdx === 23) {
    const r = SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c(sm, pGame, pUnit, skId, effLvl)
    if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
    return r
  }
  if (doIdx === 24) {
    const r = SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c(sm, pGame, pUnit, skId, effLvl)
    if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
    return r
  }
  if (doIdx === 25) {
    return SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 26) {
    const r = SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c(sm, pGame, pUnit, skId, effLvl)
    if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
    return r
  }
  if (doIdx === 27) {
    return SKILLS_SrvDo029_Teleport_6FC63450_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 28) {
    return SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 29) {
    return SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 47) {
    return SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 51) {
    return SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 55) {
    return SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 61) {
    return SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 68) {
    const r = SKILLS_SrvDo068_BasicShoutK3_113c(m, pGame, pUnit, skId, effLvl, hooks)
    if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
    return r
  }
  if (doIdx === 110) {
    const r = SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c(sm, pGame, pUnit, skId, effLvl)
    if (r !== 0) MONUMOD_DispatchOnKillEvent5_113c(m, pUnit, pUnit, pGame)
    return r
  }
  if (doIdx === 116) {
    return SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 123) {
    return SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 124) {
    return SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 151) {
    return SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c(sm, pGame, pUnit, skId, effLvl)
  }
  if (doIdx === 144) {
    let maxMonIdBefore = 0
    if (pGame !== 0) {
      for (let b = 0; b < 128; b++) {
        let pm = m.u32((pGame + 0x1320 + (b << 2)) >>> 0) >>> 0
        while (pm !== 0) {
          const gid = m.u32((pm + 0x0c) >>> 0) >>> 0
          if (gid > maxMonIdBefore) maxMonIdBefore = gid
          pm = m.u32((pm + 0xe4) >>> 0) >>> 0
        }
      }
    }
    const rc = dispatchSummonOrCurseDoFuncK3_113c(m, pGame, pUnit, doIdx, skId, effLvl)
    if (rc !== 0 && pGame !== 0) {
      let maxMonIdAfter = maxMonIdBefore
      for (let b = 0; b < 128; b++) {
        let pm = m.u32((pGame + 0x1320 + (b << 2)) >>> 0) >>> 0
        while (pm !== 0) {
          const gid = m.u32((pm + 0x0c) >>> 0) >>> 0
          if (gid > maxMonIdAfter) maxMonIdAfter = gid
          pm = m.u32((pm + 0xe4) >>> 0) >>> 0
        }
      }
      for (let gid = (maxMonIdBefore + 1) >>> 0; gid <= maxMonIdAfter; gid = (gid + 1) >>> 0) {
        let pm = m.u32((pGame + 0x1320 + ((gid & 0x7f) << 2)) >>> 0) >>> 0
        while (pm !== 0 && (m.u32((pm + 0x0c) >>> 0) >>> 0) !== gid) {
          pm = m.u32((pm + 0xe4) >>> 0) >>> 0
        }
        if (pm !== 0 && (m.u32((pm + 0x10) >>> 0) | 0) !== 1) {
          let hasModeEnd = false
          let pe = m.u32((pm + 0xdc) >>> 0) >>> 0
          while (pe !== 0) {
            if (m.u8(pe) === 1) {
              hasModeEnd = true
              break
            }
            pe = m.u32((pe + 0x24) >>> 0) >>> 0
          }
          if (!hasModeEnd) {
            MONSTER_ClearModeEvents113c(m, pGame, pm)
            PLAYER_ScheduleModeAnimEventsK3_113c(m, pGame, pm)
          }
        }
      }
    }
    return rc
  }
  if (
    doIdx === 15 ||
    doIdx === 16 ||
    doIdx === 30 ||
    doIdx === 31 ||
    doIdx === 44 ||
    doIdx === 49 ||
    doIdx === 56 ||
    doIdx === 57 ||
    doIdx === 60 ||
    doIdx === 114 ||
    doIdx === 115 ||
    doIdx === 119
  ) {
    return dispatchSummonOrCurseDoFuncK3_113c(m, pGame, pUnit, doIdx, skId, effLvl)
  }
  switch (doIdx) {
    case 1:
      return SrvDoFunc_001_Attack113c(sm, pGame, pUnit, skId, effLvl)
    case 2:
      return SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c(sm, pGame, pUnit, skId, effLvl)
    case 3:
      return SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c(sm, pGame, pUnit, skId, effLvl)
    case 4:
      return SKILLS_SrvDo_Unsummon_6FCC2EA0_113c(sm, pGame, pUnit, skId, effLvl)
    case 5:
      return SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c(sm, pGame, pUnit, skId, effLvl)
    case 7:
      return SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c(sm, pGame, pUnit, skId, effLvl)
    case 8:
      return SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c(sm, pGame, pUnit, skId, effLvl)
    case 9:
      return SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c(sm, pGame, pUnit, skId, effLvl)
    case 10:
      return SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c(sm, pGame, pUnit, skId, effLvl)
    case 11:
      return SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c(sm, pGame, pUnit, skId, effLvl)
    case 12:
      return SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c(sm, pGame, pUnit, skId, effLvl)
    case 13:
      return SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c(sm, pGame, pUnit, skId, effLvl)
    case 14:
      return SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c(sm, pGame, pUnit, skId, effLvl)
    case 20:
      return SrvDoFunc_020_StaticField113c(sm, pGame, pUnit, skId, effLvl)
    case 32:
      return SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c(sm, pGame, pUnit, skId, effLvl)
    case 33:
      return SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c(sm, pGame, pUnit, skId, effLvl)
    case 34:
      return SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c(sm, pGame, pUnit, skId, effLvl)
    case 35:
      return SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c(sm, pGame, pUnit, skId, effLvl)
    case 36:
      return SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c(sm, pGame, pUnit, skId, effLvl)
    case 37:
      return SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c(sm, pGame, pUnit, skId, effLvl)
    case 38:
      return SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c(sm, pGame, pUnit, skId, effLvl)
    case 39:
      return SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c(sm, pGame, pUnit, skId, effLvl)
    case 40:
      return SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c(sm, pGame, pUnit, skId, effLvl)
    case 41:
      return SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c(sm, pGame, pUnit, skId, effLvl)
    case 42:
      return SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c(sm, pGame, pUnit, skId, effLvl)
    case 43:
      return SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c(sm, pGame, pUnit, skId, effLvl)
    case 45:
      ensurePlayerPetTableAllocatedK3_113c(m, pUnit, pGame)
      return SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c(sm, skId, pUnit, pGame, effLvl)
    case 46:
      return SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c(sm, pGame, pUnit, skId, effLvl)
    case 48:
      return SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c(sm, pGame, pUnit, skId, effLvl)
    case 50:
      return SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c(sm, pGame, pUnit, skId, effLvl)
    case 52:
      return (((sm.u32((pUnit + 0x38) >>> 0) | 0) >> 8) & 1) === 0
        ? SKILLS_SrvDo252_DragonFlight_6FCB3680_113c(sm, pGame, pUnit, skId, effLvl)
        : dragonFlightStrikeFixed113c(sm, pGame, pUnit, skId, effLvl)
    case 53:
      return SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c(sm, pGame, pUnit, skId, effLvl)
    case 54:
      return SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c(sm, pGame, pUnit, skId, effLvl)
    case 58:
      return SKILLS_SrvDo_MonsterConvert_6FC71340_113c(sm, pGame, pUnit, skId, effLvl)
    case 59:
      return SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c(sm, pGame, pUnit, skId, effLvl)
    case 62:
      ensurePlayerPetTableAllocatedK3_113c(m, pUnit, pGame)
      return SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c(sm, pGame, pUnit, skId, effLvl)
    case 63:
      return SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c(sm, pGame, pUnit, skId, effLvl)
    case 64:
      return SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c(sm, pGame, pUnit, skId, effLvl)
    case 65:
      return SrvDoFunc_065_AuraRadialStatBuff113c(sm, pGame, pUnit, skId, effLvl)
    case 66:
      return SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c(sm, pGame, pUnit, skId, effLvl)
    case 67:
      return SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c(sm, pGame, pUnit, skId, effLvl)
    case 69:
      return SKILLS_SrvDo018_FindPotion_6FC47600_113c(sm, pGame, pUnit, skId, effLvl)
    case 70:
      return SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c(sm, pGame, pUnit, skId, effLvl)
    case 71:
      return SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c(sm, pGame, pUnit, skId, effLvl)
    case 72:
      return SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c(sm, pGame, pUnit, skId, effLvl)
    case 73:
      return SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c(sm, pGame, pUnit, skId, effLvl)
    case 74:
      return SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c(sm, pGame, pUnit, skId, effLvl)
    case 75:
      return SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c(sm, pGame, pUnit, skId, effLvl)
    case 76:
      return SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c(sm, pGame, pUnit, skId, effLvl)
    case 77:
      return SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c(sm, pGame, pUnit, skId, effLvl)
    case 78:
      return SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c(sm, pGame, pUnit, skId, effLvl)
    case 79:
      return SKILLS_SrvDo028_Conversion_6FCB9830_113c(sm, pGame, pUnit, skId, effLvl)
    case 80:
      return SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c(sm, pGame, pUnit, skId, effLvl)
    case 81:
      return SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c(sm, pGame, pUnit, skId, effLvl)
    case 82:
      return SKILLS_DoRedemptionAuraPulse_6FCBA400_113c(sm, pGame, pUnit, skId, effLvl)
    case 83:
      return SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c(sm, pGame, pUnit, skId, effLvl)
    case 84:
      return SKILLS_SrvDo141_SpawnPartyMinionsAndDistributeExp_6FCD65E0_113c(sm, pGame, pUnit, skId, effLvl)
    case 85:
      return SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c(sm, pGame, pUnit, skId, effLvl)
    case 86:
      return MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c(sm, pUnit, skId, effLvl)
    case 87:
      return SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c(sm, pGame, pUnit, skId, effLvl)
    case 88:
      return SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c(sm, pGame, pUnit, skId, effLvl)
    case 89:
      return SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c(sm, pGame, pUnit, skId, effLvl)
    case 90:
      return MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c(sm, pUnit, skId, effLvl)
    case 91:
      return SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c(sm, pGame, pUnit, skId, effLvl)
    case 92:
      return SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c(sm, pGame, pUnit, skId, effLvl)
    case 93:
      return SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c(sm, pGame, pUnit, skId, effLvl, hooks)
    case 94:
      return SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c(sm, pGame, pUnit, skId, effLvl)
    case 95:
      return SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c(sm, pGame, pUnit, skId, effLvl)
    case 96:
      return SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c(sm, pGame, pUnit, skId, effLvl)
    case 97:
      return SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c(sm, pGame, pUnit, skId, effLvl)
    case 98:
      return SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c(sm, pGame, pUnit, skId, effLvl)
    case 99:
      return SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c(sm, pGame, pUnit, skId, effLvl, hooks)
    case 100:
      return SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c(sm, pGame, pUnit, skId, effLvl)
    case 101:
      return SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c(sm, pGame, pUnit, skId, effLvl, hooks)
    case 102:
      return SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c(sm, pGame, pUnit, skId, effLvl)
    case 103:
      return SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c(sm, pGame, pUnit, skId, effLvl)
    case 104:
      return SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c(sm, pGame, pUnit, skId, effLvl)
    case 105:
      return SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c(sm, pGame, pUnit, skId, effLvl)
    case 106:
      return SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c(sm, pGame, pUnit, skId, effLvl, hooks)
    case 107:
      return SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c(sm, pGame, pUnit, skId, effLvl)
    case 108:
      return SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c(sm, pGame, pUnit, skId, effLvl)
    case 109:
      return SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c(sm, pGame, pUnit, skId, effLvl)
    case 111:
      return SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c(sm, pGame, pUnit, skId, effLvl)
    case 112:
      return SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c(sm, pGame, pUnit, skId, effLvl)
    case 113:
      return SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c(sm, pGame, pUnit, skId, effLvl)
    case 117:
      return SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c(sm, pGame, pUnit, skId, effLvl)
    case 118:
      return SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c(sm, pGame, pUnit, skId, effLvl)
    case 120:
      return SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c(sm, pGame, pUnit, skId, effLvl)
    case 121:
      return SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c(sm, pGame, pUnit, skId, effLvl)
    case 122:
      return SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c(sm, pGame, pUnit, skId, effLvl)
    case 125:
      return SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c(sm, pGame, pUnit, skId, effLvl)
    case 126:
      return SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c(sm, pGame, pUnit, skId, effLvl)
    case 127:
      return SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c(sm, pGame, pUnit, skId, effLvl)
    case 128:
      return SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c(sm, pGame, pUnit, skId, effLvl)
    case 129:
      return SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c(sm, pGame, pUnit, skId, effLvl)
    case 130:
      return SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c(sm, pGame, pUnit, skId, effLvl)
    case 131:
      return SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c(sm, pGame, pUnit, skId, effLvl)
    case 132:
      return SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c(sm, pGame, pUnit, skId, effLvl)
    case 133:
      return SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c(sm, pGame, pUnit, skId, effLvl)
    case 134:
      return SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c(sm, pGame, pUnit, skId, effLvl)
    case 135:
      return SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c(sm, pGame, pUnit, skId, effLvl)
    case 136:
      return SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c(sm, pGame, pUnit, skId, effLvl)
    case 137:
      return SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c(sm, pGame, pUnit, skId, effLvl)
    case 138:
      return SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c(sm, pGame, pUnit, skId, effLvl)
    case 139:
      return SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c(sm, pGame, pUnit, skId, effLvl)
    case 140:
      return SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c(sm, pGame, pUnit, skId, effLvl)
    case 141:
      return SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c(sm, pGame, pUnit, skId, effLvl)
    case 142:
      return SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c(sm, pGame, pUnit, skId, effLvl)
    case 143:
      return SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c(sm, pGame, pUnit, skId, effLvl)
    case 145:
      return SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c(sm, pGame, pUnit, skId, effLvl)
    case 146:
      return SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c(sm, pGame, pUnit, skId, effLvl)
    case 147:
      return SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c(sm, pGame, pUnit, skId, effLvl)
    case 148:
      return SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c(sm, pGame, pUnit, skId, effLvl)
    case 149:
      return SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c(sm, pGame, pUnit, skId, effLvl)
    case 150:
      return SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c(sm, pGame, pUnit, skId, effLvl)
    case 152:
      return SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c(sm, pGame, pUnit, skId, effLvl)
    default:
      return 1
  }
}

export function SKILLS_DoUsedSkillActionK3_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  hooks: K2GapMeleeDotHooks113c,
): number {
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0
  if (pSkill === 0) return 0
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) | 0
  if (nSkillId < 0) return 0
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkillId)
  if (pSkillsTxt === 0) return 0

  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return 0
  if ((m.u8((pSkillsTxt + 0x05) >>> 0) & 0x01) === 0) {
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 0
  }

  const radialHooks = k3RadialCombatHooksByMeleeHooks.get(hooks)
  return withScopedMeleeDotHooks113c(hooks, () =>
    withScopedRadialCombatHooks113c(radialHooks, () => {
      const effLevel = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1) | 0
      const srvDo2e = sx16(m.u16((pSkillsTxt + 0x2e) >>> 0))
      const wDoFuncIdx = srvDo2e !== 0 ? srvDo2e : sx16(m.u16((pSkillsTxt + 0x0a) >>> 0))
      const wSrvMissile = sx16(m.u16((pSkillsTxt + 0x46) >>> 0))
      if (
        wDoFuncIdx <= 0 &&
        wSrvMissile >= 0 &&
        MISSILES_GetTxtRecordFast113c(m, wSrvMissile) !== 0
      ) {
        m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
        const isLob = (m.u8((pSkillsTxt + 0x04) >>> 0) & 0x02) !== 0
        const pMis = isLob
          ? (SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
              m as SparseMemory113c,
              0,
              pUnit >>> 0,
              pGame >>> 0,
              wSrvMissile,
              nSkillId,
              effLevel,
              0,
              0,
              0,
              0,
            ) >>> 0)
          : (SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
              m as SparseMemory113c,
              pGame >>> 0,
              wSrvMissile,
              pUnit >>> 0,
              nSkillId,
              effLevel,
              0,
              0,
              0,
              0,
              0,
            ) >>> 0)
        if (pMis !== 0) {
          MONUMOD_DispatchOnKillEvent5_113c(m, pMis, pUnit, pGame)
        }
      }

      const pPathTarget =
        m.u32((pUnit + 0x2c) >>> 0) !== 0
          ? (PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0) >>> 0) >>> 0)
          : 0
      const rc = SKILLS_DoUsedSkillAction113c(m, pUnit, pGame, (doIdx, skId, effLvl) =>
        withReplacedCurseGfxSyncK3_113c(m, pUnit, pPathTarget, () =>
          dispatchSkillSrvDoByIdxK3_113c(m, pGame, pUnit, doIdx, skId, effLvl, hooks),
        ),
      )

      if (rc !== 0) {
        // 0x6FCC1C8F..0x6FCC1CA3: `decquant` (`Skills.txt.dwFlags[0] & 0x01`) -> `0x6FCC1790`
        if ((m.u8((pSkillsTxt + 0x04) >>> 0) & 0x01) !== 0) {
          SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(m, pUnit, pGame)
        }

        // 0x6FCC1CCF..0x6FCC1CEE: `STATE_SKILLDELAY (121)` via canonical `0x6FCBFF70`
        const delayCalc = m.u32((pSkillsTxt + 0x190) >>> 0)
        const delay = SKILLS_EvalCalcByOffset113c(m, pUnit, delayCalc, nSkillId, effLevel) | 0
        if (
          delay > 0 &&
          (m.u32(pUnit >>> 0) | 0) === 0 &&
          (m.u8((pSkillsTxt + 0x10) >>> 0) !== 0x12 ||
            (m.u32((pUnit + 0x38) >>> 0) & 0xffffff00) === 0)
        ) {
          const expireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + delay) >>> 0
          for (let ev = m.u32((pUnit + 0xdc) >>> 0) >>> 0; ev !== 0; ) {
            const nextEv = m.u32((ev + 0x24) >>> 0) >>> 0
            if (m.u8(ev) === 0x0c && (m.u32((ev + 0x10) >>> 0) >>> 0) === expireFrame) {
              EVENT_FreeNode113c(m, pGame, ev)
              break
            }
            ev = nextEv
          }
          SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c(m, delay, pUnit, pGame)
        }
      }

      return rc
    }),
  )
}

/**
 * `@va D2Game:0x6FC99170`: player mode-step handler for `PLRMODE_CAST (10)` and non-melee
 * `PLRMODE_SEQUENCE (18)` skills (`Chain Lightning` `#53`).
 */
export function PLAYER_StepSkillKeyframeK3_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  arg14: number,
  arg18: number,
  hooks: K2GapMeleeDotHooks113c,
): void {
  if (pPlayer === 0 || m.u32((pPlayer + 0x2c) >>> 0) === 0) return
  if (m.u32((pPlayer + 0x30) >>> 0) !== 0) {
    UNITS_SetSeqFrameFromLowByte113c(m, pPlayer, arg18 | 0)
  }
  PLAYER_StartModeDispatch113c(m, pGame, pPlayer, arg14, arg18, '1HS', (mem, pg, plr) =>
    SKILLS_DoUsedSkillActionK3_113c(mem, plr, pg, hooks),
  )
}

/**
 * Returns `true` when `pPlayer` in `PLRMODE_SEQUENCE (18)` is executing a spell/non-melee skill
 * (`skillId > 0` and `wSrvDoFunc !== 1`).
 */
export function PLAYER_IsNonMeleeSequenceSkillK3_113c(m: Memory113c, pPlayer: number): boolean {
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pPlayer) >>> 0
  if (pSkill === 0) return false
  const skillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0) | 0
  if (skillId <= 0) return false
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId)
  if (pSkillsTxt === 0) return false
  const wSrvDo = sx16(m.u16((pSkillsTxt + 0x2e) >>> 0))
  return wSrvDo !== 1 && wSrvDo !== 2
}

/**
 * Builds the `[K3]` `K2GapMeleeDotHooks113c` dispatch table routing missile `SrvDo` / `SrvHit` / `SrvDmg`
 * directly to canonical manifest-bound `D2Game` functions (`0x6FC61980`, `0x6FC61850`, `0x6FC60CA0`,
 * `0x6FC60BD0`, `0x6FC5B990`, `0x6FC5D020`, `0x6FC5EA60`, `0x6FC5C850`, `0x6FC59CE0`, `0x6FC59670`,
 * `0x6FC59600`).
 */
export function MISSILE_BuildK3Hooks113c(
  onKillUnit: (m: Memory113c, pGame: number, pDefender: number, pAttacker: number) => void,
): K2GapMeleeDotHooks113c {
  if (typeof flushPendingSavedObjectInitModes113c === 'function') {
    flushPendingSavedObjectInitModes113c()
  }
  if (typeof runPostActRoomsUpdateHooks113c === 'function') {
    runPostActRoomsUpdateHooks113c()
  }
  const radialCombatHooks: SUnitDmgHooks113c = {
    suppressDirectS2c: true,
    onKillUnit(m, pGame, pDefender, pAttacker) {
      SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x08)
      SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pAttacker, 0)
      onKillUnit(m, pGame, pDefender, pAttacker)
    },
    onMonsterStartMode(m, pGame, pDefender, mode, pTarget) {
      if (hasHydratedAnimDataTableK3_113c(m)) {
        MONSTER_StartMode113c(
          m,
          pGame,
          pDefender,
          mode,
          mode === 6 || mode === 13 ? (pTarget !== undefined ? pTarget : 0) : 0,
          0,
          0,
        )
        return
      }
      if (mode === 3) {
        const savedSp = k3SorcScratchSp
        const pModeScratch = savedSp
        k3SorcScratchSp = (savedSp + 0x24) >>> 0
        try {
          m.fill(pModeScratch, 0x24, 0)
          m.setU32(pModeScratch, 3)
          m.setU32((pModeScratch + 4) >>> 0, pDefender >>> 0)
          MONSTER_StartGetHitMode113c(m, pGame, pModeScratch)
        } finally {
          k3SorcScratchSp = savedSp
        }
      }
    },
  }

  let w2b4Hooks!: K2W2B4Hooks113c
  let w3b3Hooks!: K2W3B3Hooks113c
  let w4b3Hooks!: K2W4B3Hooks113c

  const hooks: K2GapMeleeDotHooks113c = {
    srvDoMissile(m, wSrvDoIdx, _fnVa, pGame, pMissile) {
      return withScopedMeleeDotHooks113c(hooks, () =>
        withScopedRadialCombatHooks113c(radialCombatHooks, () => {
          const sm = m as SparseMemory113c
          switch (wSrvDoIdx) {
            case 1:
              return MISSILE_SrvDo01_FastcallThunk113c(m, pGame, pMissile, hooks)
            case 2:
              return MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c(sm, pGame, pMissile)
            case 3:
              return MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c(sm, pGame, pMissile)
            case 5:
              return MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c(m, pGame, pMissile, hooks)
            case 6:
              return MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c(m, pGame, pMissile, hooks)
            case 7:
              return MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c(sm, pGame, pMissile)
            case 8:
              return MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c(
                sm,
                pGame,
                pMissile,
                hooks,
              )
            case 9:
              return MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c(sm, pGame, pMissile)
            case 10:
              return MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c(
                sm,
                pGame,
                pMissile,
                hooks,
              )
            case 11:
              return MISSILE_SrvDo_HomingTargetStep_6FC61240_113c(sm, pGame, pMissile)
            case 12:
              return MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c(sm, pGame, pMissile)
            case 13:
              return MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c(sm, pGame, pMissile)
            case 14: {
              if (pMissile === 0) return 2
              const pMisTxt = MISSILES_GetTxtRecordFast113c(m, m.u32((pMissile + 0x04) >>> 0) | 0) >>> 0
              if (pMisTxt === 0) return 2
              let nStep = m.u32((pMisTxt + 0x38) >>> 0) | 0
              if (nStep < 1) nStep = 1
              const nElapsed = MISSILE_GetElapsedFrames113c(m, pMissile) | 0
              if ((nElapsed % nStep | 0) === 0) {
                const nSkillId = MISSILE_GetSkill113c(m, pMissile) | 0
                const nLevel = MISSILE_GetLevel113c(m, pMissile) | 0
                if (nSkillId <= 0 || nLevel <= 0) return 2
                SKILLS_DispatchSrvDoFunc_6FCBE420_113c(
                  m,
                  m.u32((pMisTxt + 0x3c) >>> 0) | 0,
                  pGame,
                  pMissile,
                  nSkillId,
                  nLevel,
                  w2b4Hooks,
                )
              }
              return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame, hooks) | 0
            }
            case 15:
              return MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c(m, pGame, pMissile, hooks)
            case 16:
              return MISSILE_SrvDo_SpiralPath_6FC60BD0_113c(m, pGame, pMissile, hooks)
            case 17:
              return MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c(sm, pGame, pMissile)
            case 18:
              return MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c(sm, pGame, pMissile)
            case 19:
              return MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c(sm, pGame, pMissile)
            case 20:
              return MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c(sm, pGame, pMissile)
            case 21:
              return MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c(sm, pGame, pMissile)
            case 22:
              return MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c(sm, pGame, pMissile)
            case 23:
            case 24:
              return MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c(sm, pGame, pMissile)
            case 25:
              return MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c(sm, pGame, pMissile)
            case 26:
              return MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c(sm, pGame, pMissile)
            case 27:
              return MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c(sm, pGame, pMissile)
            case 28:
              return MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c(sm, pGame, pMissile)
            case 29:
              return MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c(sm, pGame, pMissile, w3b3Hooks)
            case 30:
              return MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c(
                sm,
                pGame,
                pMissile,
                w3b3Hooks,
              )
            case 31:
              return MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c(
                sm,
                pGame,
                pMissile,
                w3b3Hooks,
              )
            case 32:
              return MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c(sm, pGame, pMissile)
            case 33:
              return MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c(sm, pGame, pMissile, w3b3Hooks)
            case 34:
              return MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c(sm, pGame, pMissile)
            case 35:
              return MISSILES_SrvDo12_RandomWalkStepProjectile_6FC5F890_113c(sm, pGame, pMissile, w3b3Hooks)
            case 36:
              return MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c(sm, pGame, pMissile, w4b3Hooks)
            case 37:
              return MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c(sm, pGame, pMissile)
            default:
              return 1
          }
        }),
      )
    },
    srvHitMissile(m, wSrvHitIdx, _fnVa, pGame, pMissile, pTarget) {
      return withReplacedCurseGfxSyncK3_113c(m, pMissile, pTarget, () =>
        withScopedMeleeDotHooks113c(hooks, () =>
          withScopedRadialCombatHooks113c(radialCombatHooks, () => {
            const sm = m as SparseMemory113c
            switch (wSrvHitIdx) {
            case 1:
              return MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c(
                m,
                pGame,
                pMissile,
                pTarget,
                radialCombatHooks,
              )
            case 2:
              return MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c(sm, pGame, pMissile, pTarget)
            case 3:
              return QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c(sm, pGame, pMissile, pTarget)
            case 4:
              return MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 5:
              return MISSILES_SrvDmg12_Nova64RingSubMissiles_6FC5C700_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 6:
              return MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c(m, pGame, pMissile, pTarget)
            case 7:
              return MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c(sm, pGame, pMissile, pTarget)
            case 8:
              return MISSILES_SrvDo_KeepAliveOnBlazeOwner_6FC59F70_113c(m, pGame, pMissile, pTarget)
            case 9:
              return MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
              )
            case 10:
              return MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c(sm, pGame, pMissile, pTarget)
            case 11:
              return MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 12:
              return MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c(m, pGame, pMissile, pTarget)
            case 13:
              return MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c(sm, pGame, pMissile, pTarget)
            case 14:
              return MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
              )
            case 15:
              return MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 16:
              return MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 17:
              return MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c(sm, pGame, pMissile, pTarget)
            case 18:
              return MISSMODE_SrvHit18_ShoutBattleOrdersCommandK3_113c(m, pGame, pMissile, pTarget)
            case 19:
              return MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 20:
              return MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
              )
            case 21:
              return MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c(sm, pGame, pMissile, pTarget)
            case 22:
              return MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
              )
            case 23:
              return MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 24:
              return MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c(sm, pGame, pMissile, pTarget)
            case 25:
              return MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c(sm, pGame, pMissile, pTarget)
            case 26:
              return MISSILES_SrvDmg13_PoisonExplosionCloud_6FC5C990_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 27:
              return MISSILES_SrvDo_ReturnOne_6FC58EC0_113c(m, pGame, pMissile, pTarget)
            case 28:
              return MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c(sm, pGame, pMissile, pTarget)
            case 29:
              return MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c(
                m,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 31:
              return MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c(sm, pGame, pMissile, pTarget)
            case 32:
              return MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c(sm, pGame, pMissile, pTarget)
            case 33:
              return MISSILES_SrvDo_ClearRoomPortalFlag_6FC58EA0_113c(m, pGame, pMissile, pTarget)
            case 35:
              return MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c(m, pGame, pMissile, pTarget)
            case 36:
              return MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c(sm, pGame, pMissile, pTarget)
            case 37:
              return MISSILES_SrvDo_ReturnTwoIfCollided_6FC58E90_113c(m, pGame, pMissile, pTarget)
            case 38:
              return MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c(sm, pGame, pMissile, pTarget)
            case 39:
              return OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c(sm, pGame, pMissile, pTarget)
            case 40:
              return MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c(sm, pGame, pMissile, pTarget)
            case 43:
              return MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c(sm, pGame, pMissile, pTarget)
            case 44:
              return MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c(sm, pGame, pMissile, pTarget)
            case 45:
              return MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c(sm, pGame, pMissile, pTarget)
            case 47:
              return MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
              )
            case 48:
              return MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 50:
              return MISSILES_SrvDo_ExpireBeforeEndWindow_6FC591A0_113c(m, pGame, pMissile, pTarget)
            case 51:
              return MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 52:
              return MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 53:
              return MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w4b3Hooks,
              )
            case 54:
              return MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c(m, pGame, pMissile, pTarget)
            case 55:
              return MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c(m, pGame, pMissile, pTarget)
            case 56:
              return MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
              )
            case 57:
              return MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w4b3Hooks,
              )
            case 58:
              return MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                w3b3Hooks,
              )
            case 59:
              return MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c(sm, pGame, pMissile, pTarget)
            default:
              return MISSILE_DefaultSrvHitFlagsK3_113c(m, pMissile)
            }
          }),
        ),
      )
    },
    srvDmgMissile(m, wSrvDmgIdx, _fnVa, pGame, pMissile, pTarget, pDamage) {
      withScopedMeleeDotHooks113c(hooks, () =>
        withScopedRadialCombatHooks113c(radialCombatHooks, () => {
          const sm = m as SparseMemory113c
          switch (wSrvDmgIdx) {
            case 1:
              MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            case 2:
              MISSILES_ApplyColdLengthToDamage_6FC59080_113c(sm, pMissile, pTarget, pDamage)
              return
            case 3:
              SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(m, 0, pGame, 1)
              SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, 0, pTarget, 0)
              MONSTER_SetLastHitModeField54_113c(m, pTarget, 3)
              MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            case 4:
              MISSILES_SrvHit_MoveColdLenToFrzLen_6FC58E70_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            case 5:
              MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c(sm, pGame, pMissile, pTarget, pDamage)
              return
            case 6:
              MISSILES_SrvHit_SetTargetFlag20000_6FC59C80_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            case 7:
              MISSMODE_SrvDmg07_WarcryShockWaveK3_113c(m, pGame, pMissile, pDamage)
              return
            case 8:
              MISSILES_SrvHit_ApplyProgOverlay_6FC58FF0_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            case 9:
              MISSILES_SrvHit_SetStunLenAndConv60_6FC59560_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            case 10:
              MISSILES_SrvHit_CopyColdLenToFrzLen_6FC59040_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            case 11:
              MISSILES_SrvHit_ClampRemainingPoisonLen_6FC59BD0_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            case 12:
              MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c(sm, pGame, pMissile, pTarget, pDamage)
              return
            case 13:
              MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c(
                sm,
                pGame,
                pMissile,
                pTarget,
                pDamage,
                w4b3Hooks,
              )
              return
            case 14:
              MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c(m, pGame, pMissile, pTarget, pDamage)
              return
            default:
              return
          }
        }),
      )
    },
    missileInitCallback(m, fnVa, pMissile, dwParam) {
      const fn = fnVa >>> 0
      if (fn === 0x6fc59210) {
        MISSILES_InitDrunkenPath_6FC59210_113c(m, pMissile, dwParam)
      } else if (fn === 0x6fc61f50) {
        MISSILES_InitChargedBoltPath_6FC61F50_113c(m, pMissile, dwParam)
      } else if (fn === 0x6fc6c190) {
        SKILLS_AddDamagePercentStat_6FC6C190_113c(m, pMissile, dwParam | 0)
      } else if (fn === 0x6fcb0ea0) {
        MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c(m, pMissile, dwParam >>> 0)
      } else if (fn === 0x6fcb1040) {
        MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c(m as SparseMemory113c, pMissile, dwParam | 0)
      } else if (fn === 0x6fcd31d0) {
        MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c(m as SparseMemory113c, pMissile, dwParam | 0)
      }
    },
    onStatRemoveProc(m, fnVa, pUnit, nState, pStatList) {
      if (fnVa === 0x6fcb8450) {
        STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c(m, pUnit, nState, pStatList)
      } else if (fnVa === 0x6fcfb4c0) {
        SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c(m, pUnit, nState, pStatList)
      }
    },
    killUnit(m, pGame, pDefender, pAttacker) {
      SUNITDMG_CheckMonTypeFlag113c(m, pDefender, 0x08)
      SUNITDMG_ClampManaBurnByMonsterSkill113c(m, pAttacker, 0)
      onKillUnit(m, pGame, pDefender, pAttacker)
    },
  }

  w2b4Hooks = {
    onSrvDoFunc(mem, pfn, pg, pu, skId, skLvl) {
      const targetVa = pfn >>> 0
      for (let i = 1; i < 0xbf; i++) {
        let entryVa = 0
        try {
          entryVa = mem.u32((0x6fd274a8 + (i << 2)) >>> 0) >>> 0
        } catch {
          entryVa = 0
        }
        if (entryVa === targetVa) {
          return dispatchSkillSrvDoByIdxK3_113c(mem, pg, pu, i, skId, skLvl, hooks)
        }
      }
      return 1
    },
  }

  w3b3Hooks = {
    ...hooks,
    w2b4: w2b4Hooks,
  }

  w4b3Hooks = {
    meleeDot: hooks,
    w3b3: w3b3Hooks,
    onApplyDemonUndeadElemBonus_6FC5A790(mem, pg, pMis, pTgt, pDmg) {
      MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c(mem, pg, pMis, pTgt, pDmg)
    },
    onApplySecondaryAuraAndSpawnChargedMissile_6FC663A0(mem, pg, owner, dur, skId, skLvl, targetPtr) {
      return SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c(
        mem,
        pg,
        owner,
        dur,
        skId,
        skLvl,
        skLvl,
        targetPtr >>> 0,
      )
    },
  }

  k3RadialCombatHooksByMeleeHooks.set(hooks, radialCombatHooks)
  if (onKillUnit.length >= 3) {
    setItemdefGapFrameHooks113c(hooks, radialCombatHooks)
  }
  return hooks
}
