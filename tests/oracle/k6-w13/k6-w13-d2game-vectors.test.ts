/**
 * Milestone #37 [K6] Wave 13 — Real-DLL D2Game.dll Lo-VA Part 4 (0x6FC20000..0x6FCBFFFF)
 * Differential Vector Suite.
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-w13/k6-w13-d2game-emitter.c
 * against the live TypeScript kernel implementations in src/d2kern-113c/game/*,
 * verifying 100% bit-exact agreement on return values, Fog.#10024 assertion line numbers,
 * staged arena mutations, heap allocations, and va-trace-113c runtime hits.
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

import {
  OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c,
  PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  QUESTS_InitAct1Quest3Object_6FC54E10_113c,
  QUESTS_InitAct1Quest4Object_6FC54DA0_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import { MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c } from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c'
import {
  ACT5Q5_InitAncientsAltarObject_6FC773D0_113c,
  ACT5Q5_InitSummitDoorObject_6FC765B0_113c,
  ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c,
  ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c,
} from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c'
import {
  ACT1Q4_InitCainGibbetObject_6FC814A0_113c,
  ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b2-113c'
import {
  MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c,
  MONMODE_EnterSequenceMode14_6FC954E0_113c,
  MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b3-113c'
import {
  ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c,
  SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import {
  OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c,
  OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c,
  SKILLS_ApplyProgressiveChargeState_6FC48E70_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import { MISSILES_InitGuidedOrLinearPath_6FC597C0_113c } from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import {
  CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c,
  MISSILE_SrvDo_HomingTargetStep_6FC61240_113c,
  MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c,
  MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c,
  MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c,
  SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c,
  SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c,
  SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c,
  SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c,
  SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c,
  SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c,
  SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c,
  SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c,
  SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c,
} from '../../../src/d2kern-113c/game/k2-w3b4-113c'
import {
  ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c,
  ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import {
  ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c,
  ACT1Q4_InitInifussTreeObject_6FC828D0_113c,
  ACT1Q4_SpawnTristramPortalObject_6FC81340_113c,
  ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c,
  ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c,
  ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c,
  ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import {
  ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c,
  MONSTER_StepSkillCastAnim_6FC96F20_113c,
  OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c,
  OBJ_OperateGenericMode0To1_6FC8DE00_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import { OBJECTS_OperateGoldChestOrPile_6FC4F580_113c } from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c,
  MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c,
  MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  ACT1Q0_InitQuestDescriptor_6FC82D90_113c,
  ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c,
  ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c,
  SKILLS_AddProgressiveChargeStage_6FCB5370_113c,
  SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c,
  SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c,
  SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c,
  SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c,
  SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c,
  SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import { SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c } from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c,
  MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c,
  SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c,
  SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c,
  SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  OBJ_OperateChestAndDropTreasure_6FC8EC20_113c,
  OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c,
  OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c,
  OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c,
  PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c,
  SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c,
  SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import { SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c } from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c,
  ACT1Q5_StatusFilter_6FC85500_113c,
  ACT5Q3_StatusFilter_6FC7B8C0_113c,
  MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c,
  MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c,
  MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c,
  SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c,
  SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c,
  SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c,
  SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import {
  OBJ_OperateWell_6FC8CEE0_113c,
  SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c,
  ACT1Q5_OnMoldyTomeActivated_6FC83730_113c,
  ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c,
  QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c,
  SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c,
  SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c,
  SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import {
  SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c,
  SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c,
  SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c,
} from '../../../src/d2kern-113c/game/k2-w6b5-113c'
import {
  SKILLS_ApplyDimVisionToTarget_6FC70470_113c,
  SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import {
  ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c,
  ACT1Q2_ActivateOrChainQuest_6FC84E10_113c,
  ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c,
  ACT1Q3_ActivateQuestState1_6FC83D20_113c,
  ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c,
  ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c,
  ACT1Q4_ActivateOrChainQuest_6FC846D0_113c,
  ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c,
  OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c,
  SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c,
  SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c,
  SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import {
  OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c,
  OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  ACT1Q1_SequenceFilter_6FC85410_113c,
  ACT1Q2_OnBurialGroundsEntered_6FC85440_113c,
  QUESTS_UseQuestScrollItem_6FC56070_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c'
import {
  ACT1Q4_OnCairnStoneInit_6FC87D20_113c,
  ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c,
  MONSTER_AutoEquipInteractItem_6FC98B60_113c,
  PARTY_LeavePartyForPlayer_6FCBC840_113c,
  PETS_OnPetOrMercKilled_6FCB8120_113c,
  PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import {
  ACT1Q1_InitQuestData_6FC85990_113c,
  ACT1Q5_InitQuestData_6FC89200_113c,
  ACT5Q1_InitQuestData_6FC7BEA0_113c,
  PLAYER_LootPlayerCorpseUnit_6FC99910_113c,
  QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c,
} from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import {
  MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c,
  OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c,
  SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c,
  SKILLS_SrvDo252_DragonFlight_6FCB3680_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c,
  OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c,
  OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c,
  PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c,
  SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  D2Game_6FC7D690_113c,
  D2Game_6FC7E2A0_113c,
  D2Game_6FC8D620_113c,
  D2Game_6FC93570_113c,
  D2Game_6FC93AA0_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  ACT1Q2_InitQuestData_6FC89130_113c,
  ACT1Q4_InitQuestData_6FC887D0_113c,
  ACT1Q5_InitQuestData_6FC87210_113c,
  ACT5Q2_InitQuestData_6FC7CC70_113c,
  ACT5Q3_InitQuestData_6FC7FC20_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  ACT5Q6_InitQuestTableRecord_6FC80080_113c,
  OBJ_DeactivateShrineOrStashObject_6FC8F520_113c,
  PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c'

const DISPATCH_BY_VA: Record<string, (m: SparseMemory113c, a: readonly number[]) => number> = {
  // Batch 1: Quests (52 VAs)
  '0x6FC80DA0': (m, a) => { ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c(m, a[0]!); return 0 },
  '0x6FC765B0': (m, a) => { ACT5Q5_InitSummitDoorObject_6FC765B0_113c(m, a[0]!); return 0 },
  '0x6FC83CC0': (m, a) => { ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c(m, a[0]!); return 0 },
  '0x6FC85410': (m, a) => (ACT1Q1_SequenceFilter_6FC85410_113c(m, a[0]!) as number) | 0,
  '0x6FC7A7C0': (m, a) => { ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c(m, a[0]!); return 0 },
  '0x6FC814A0': (m, a) => { ACT1Q4_InitCainGibbetObject_6FC814A0_113c(m, a[0]!); return 0 },
  '0x6FC82D90': (m, a) => { ACT1Q0_InitQuestDescriptor_6FC82D90_113c(m, a[0]!); return 0 },
  '0x6FC82FA0': (m, a) => { ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c(m, a[0]!); return 0 },
  '0x6FC774A0': (m, a) => { ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c(m, a[0]!); return 0 },
  '0x6FC774F0': (m, a) => { ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC56100': (m, a) => { QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c(m, a[0]!); return 0 },
  '0x6FC773D0': (m, a) => { ACT5Q5_InitAncientsAltarObject_6FC773D0_113c(m, a[0]!); return 0 },
  '0x6FC83D20': (m, a) => (ACT1Q3_ActivateQuestState1_6FC83D20_113c(m, a[0]!) as number) | 0,
  '0x6FC85440': (m, a) => { ACT1Q2_OnBurialGroundsEntered_6FC85440_113c(m, a[0]!); return 0 },
  '0x6FC554A0': (m, a) => { QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC54DA0': (m, a) => { QUESTS_InitAct1Quest4Object_6FC54DA0_113c(m, a[0]!); return 0 },
  '0x6FC828D0': (m, a) => { ACT1Q4_InitInifussTreeObject_6FC828D0_113c(m, a[0]!); return 0 },
  '0x6FC83350': (m, a) => { ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c(m, a[0]!); return 0 },
  '0x6FC837E0': (m, a) => { ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC83BB0': (m, a) => { ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC81340': (m, a) => (ACT1Q4_SpawnTristramPortalObject_6FC81340_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC54E10': (m, a) => { QUESTS_InitAct1Quest3Object_6FC54E10_113c(m, a[0]!); return 0 },
  '0x6FC7BDB0': (m, a) => { ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7E840': (m, a) => { ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC83730': (m, a) => { ACT1Q5_OnMoldyTomeActivated_6FC83730_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC88F00': (m, a) => { ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7E560': (m, a) => (ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC7E660': (m, a) => (ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC89130': (m, a) => { ACT1Q2_InitQuestData_6FC89130_113c(m, a[0]!); return 0 },
  '0x6FC7FC20': (m, a) => { ACT5Q3_InitQuestData_6FC7FC20_113c(m, a[0]!); return 0 },
  '0x6FC7EE30': (m, a) => { ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7CC70': (m, a) => { ACT5Q2_InitQuestData_6FC7CC70_113c(m, a[0]!); return 0 },
  '0x6FC87210': (m, a) => { ACT1Q5_InitQuestData_6FC87210_113c(m, a[0]!); return 0 },
  '0x6FC84AA0': (m, a) => (ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c(m, a[0]!) as number) | 0,
  '0x6FC84E10': (m, a) => (ACT1Q2_ActivateOrChainQuest_6FC84E10_113c(m, a[0]!) as number) | 0,
  '0x6FC887D0': (m, a) => { ACT1Q4_InitQuestData_6FC887D0_113c(m, a[0]!); return 0 },
  '0x6FC87C60': (m, a) => (ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC89200': (m, a) => { ACT1Q5_InitQuestData_6FC89200_113c(m, a[0]!); return 0 },
  '0x6FC7BEA0': (m, a) => { ACT5Q1_InitQuestData_6FC7BEA0_113c(m, a[0]!); return 0 },
  '0x6FC85990': (m, a) => { ACT1Q1_InitQuestData_6FC85990_113c(m, a[0]!); return 0 },
  '0x6FC80080': (m, a) => { ACT5Q6_InitQuestTableRecord_6FC80080_113c(m, a[0]!); return 0 },
  '0x6FC78AE0': (m, a) => (ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC85500': (m, a) => (ACT1Q5_StatusFilter_6FC85500_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC56070': (m, a) => { QUESTS_UseQuestScrollItem_6FC56070_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC846D0': (m, a) => (ACT1Q4_ActivateOrChainQuest_6FC846D0_113c(m, a[0]!) as number) | 0,
  '0x6FC87D20': (m, a) => { ACT1Q4_OnCairnStoneInit_6FC87D20_113c(m, a[0]!); return 0 },
  '0x6FC83930': (m, a) => (ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC78930': (m, a) => { ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC84940': (m, a) => { ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c(m, a[0]!); return 0 },
  '0x6FC833C0': (m, a) => { ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c(m, a[0]!); return 0 },
  '0x6FC84C10': (m, a) => (ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c(m, a[0]!) as number) | 0,
  '0x6FC7B8C0': (m, a) => (ACT5Q3_StatusFilter_6FC7B8C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,

  // Batch 2: Monsters / Objects / DRLG (26 VAs)
  '0x6FC954E0': (m, a) => (MONMODE_EnterSequenceMode14_6FC954E0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC959B0': (m, a) => (MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC96F20': (m, a) => (MONSTER_StepSkillCastAnim_6FC96F20_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC98B60': (m, a) => { MONSTER_AutoEquipInteractItem_6FC98B60_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC68410': (m, a) => { MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCA9730': (m, a) => (MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC958D0': (m, a) => (MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC53620': (m, a) => { OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c(m, a[0]!); return 0 },
  '0x6FC525C0': (m, a) => (OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) as number) | 0,
  '0x6FC4F580': (m, a) => { OBJECTS_OperateGoldChestOrPile_6FC4F580_113c(m, a[0]!); return 0 },
  '0x6FC4FEC0': (m, a) => (OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC8EC20': (m, a) => (OBJ_OperateChestAndDropTreasure_6FC8EC20_113c(m, a[0]!) as number) | 0,
  '0x6FC8EB40': (m, a) => (OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c(m, a[0]!) as number) | 0,
  '0x6FC8ECD0': (m, a) => (OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c(m, a[0]!) as number) | 0,
  '0x6FC8EF40': (m, a) => (OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c(m, a[0]!) as number) | 0,
  '0x6FC8F520': (m, a) => { OBJ_DeactivateShrineOrStashObject_6FC8F520_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC8D740': (m, a) => (OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c(m, a[0]!) as number) | 0,
  '0x6FC8AD60': (m, a) => (OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c(m, a[0]!) as number) | 0,
  '0x6FC8E0E0': (m, a) => (OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c(m, a[0]!) as number) | 0,
  '0x6FC8DE00': (m, a) => (OBJ_OperateGenericMode0To1_6FC8DE00_113c(m, a[0]!) as number) | 0,
  '0x6FC8BCB0': (m, a) => (OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c(m, a[0]!) as number) | 0,
  '0x6FC8DFC0': (m, a) => (OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c(m, a[0]!) as number) | 0,
  '0x6FC8BE40': (m, a) => (OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c(m, a[0]!) as number) | 0,
  '0x6FC8BB60': (m, a) => (OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c(m, a[0]!) as number) | 0,
  '0x6FC89CA0': (m, a) => { OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8CEE0': (m, a) => (OBJ_OperateWell_6FC8CEE0_113c(m, a[0]!) as number) | 0,

  // Batch 3: Skills / Missiles / Pets (52 VAs)
  '0x6FC597C0': (m, a) => { MISSILES_InitGuidedOrLinearPath_6FC597C0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC5B7C0': (m, a) => (MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5C490': (m, a) => (MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5D8C0': (m, a) => (MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5DD60': (m, a) => (MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5E740': (m, a) => (MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC60070': (m, a) => (MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC606D0': (m, a) => (MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC608D0': (m, a) => (MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC60E10': (m, a) => (MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC61240': (m, a) => (MISSILE_SrvDo_HomingTargetStep_6FC61240_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC61C30': (m, a) => (MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC2C5D0': (m, a) => (SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2C760': (m, a) => (SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2C900': (m, a) => (SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC47A10': (m, a) => (SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC48290': (m, a) => (SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC48BE0': (m, a) => (SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC48E70': (m, a) => (SKILLS_ApplyProgressiveChargeState_6FC48E70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC49600': (m, a) => (SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC61FB0': (m, a) => (SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC64600': (m, a) => (SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC65000': (m, a) => (SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC652C0': (m, a) => (SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC65850': (m, a) => (SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6CC50': (m, a) => (SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6CE10': (m, a) => (SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6DFE0': (m, a) => (SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC6E5F0': (m, a) => (SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC6E760': (m, a) => (SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC6EF70': (m, a) => (SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC6F090': (m, a) => (SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC6F4D0': (m, a) => (SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6F7D0': (m, a) => (SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC70470': (m, a) => { SKILLS_ApplyDimVisionToTarget_6FC70470_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FCB14F0': (m, a) => { SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCB18D0': (m, a) => { SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCB1A30': (m, a) => { SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCB1F10': (m, a) => { SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCB2940': (m, a) => (SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB2BB0': (m, a) => (SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FCB2DF0': (m, a) => (SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB3850': (m, a) => (SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCB5370': (m, a) => (SKILLS_AddProgressiveChargeStage_6FCB5370_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) as number) | 0,
  '0x6FCB6D70': (m, a) => (PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCB8070': (m, a) => (PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCB8120': (m, a) => { PETS_OnPetOrMercKilled_6FCB8120_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCB8490': (m, a) => (SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FCB87D0': (m, a) => (SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c(m, a[0]!) as number) | 0,
  '0x6FCB8950': (m, a) => { SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCB9B60': (m, a) => (SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCBF4A0': (m, a) => (SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,

  // Batch 4: Trade / Client / Party / Items / Skills (20 VAs)
  '0x6FC91B00': (m, a) => { PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC47030': (m, a) => (PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC58930': (m, a) => { PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC6AE90': (m, a) => { CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7D690': (m, a) => (D2Game_6FC7D690_113c(m, a[0]!) as number) | 0,
  '0x6FC7E2A0': (m, a) => (D2Game_6FC7E2A0_113c(m, a[0]!) as number) | 0,
  '0x6FC8D620': (m, a) => (D2Game_6FC8D620_113c(m, a[0]!) as number) | 0,
  '0x6FC93570': (m, a) => { D2Game_6FC93570_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC93AA0': (m, a) => { D2Game_6FC93AA0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC99910': (m, a) => { PLAYER_LootPlayerCorpseUnit_6FC99910_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCBC840': (m, a) => { PARTY_LeavePartyForPlayer_6FCBC840_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC33A30': (m, a) => (ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c(m, a[0]!) as number) | 0,
  '0x6FC2DBD0': (m, a) => (SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB2360': (m, a) => { SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!); return 0 },
  '0x6FCB3680': (m, a) => (SKILLS_SrvDo252_DragonFlight_6FCB3680_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB4F50': (m, a) => (SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB5560': (m, a) => (SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB5BC0': (m, a) => (SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB5FE0': (m, a) => (SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCBA630': (m, a) => (AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c(m, a[0]!, a[1]!) as number) | 0,
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

interface K6W13VectorRecord {
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

function loadVectors(): K6W13VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w13/k6-w13-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W13VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W13VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 13 real-DLL D2Game.dll Lo-VA Part 4 (0x6FC20000..0x6FCBFFFF) differential vectors', () => {
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
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
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
