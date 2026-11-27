/**
 * [K6-P6] Real-DLL D2Game.dll Band A (0x6FC20000..0x6FC6FFFF, excl. 0x6FC41420) Vector Suite (150 VAs).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  OBJECT_DestroyObjectUnit113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f150-f276-113c'
import {
  type ActRoomsCallees113c,
  CLIENTS_SetPlayerCurrentRoom113c,
  GAME_DeactivateUnusedRoomsTick113c,
  ROOM_TickSeedAndAmbientSpawn113c,
} from '../../../src/d2kern-113c/game/act-rooms-113c'
import {
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_ReassignPackOnBossDeath113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  MONSTER_DispatchMinionComponentCallbacks113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-a-113c'
import {
  SrvDoFunc_020_StaticField113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import {
  MISSILE_ApplyDamageAndArmorShred113c,
  MISSILE_ClearStateGfxRemoveProc113c,
  MISSILE_SrvDo01_FastcallThunk113c,
  MISSILE_SrvDo01_LinearProjectile113c,
  SKILLS_SrvDo_NovaRing113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import {
  MONSTER_Event7_MonUModEvent2_113c,
  MONUMOD_ApplyToMinionCallback113c,
  MONUMOD_DispatchOnKillEvent5_113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c'
import {
  MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  DRLG_PopulateSingleRoom_6FC4CB80_113c,
  MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c,
  OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import {
  SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c,
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c,
  SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c,
  SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c'
import {
  ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c,
  ITEMS_InitCreatedItemStats_6FC31070_113c,
  OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c,
} from '../../../src/d2kern-113c/game/k2-real-itemdrop-113c'
import {
  SKILLS_SetNecroSkeletonComponents113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c'
import {
  MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c,
  QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c,
  SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c,
  SKILLS_SrvDo_Telekinesis_6FC631C0_113c,
  STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import {
  SKILLS_SrvDo029_Teleport_6FC63450_113c,
  SKILLS_SrvDo045_NovaAndTimedAura_6FC49720_113c,
  SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  D2Game_6FC3E3D0_113c,
  D2Game_6FC56470_113c,
  D2Game_6FC565E0_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c,
  SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c,
  ITEMS_RollMagicAffixId_6FC344D0_113c,
  SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import {
  MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c,
  MONUMOD_ApplyResistanceBonus_6FC41BE0_113c,
  MONUMOD_CheckModEligibility_6FC43100_113c,
  MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c,
  SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c,
  SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import {
  MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c,
  MISSILES_PopulateDamageByEType_6FC5A280_113c,
  MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c,
  MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c,
  MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c,
  MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c,
  MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c,
  MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c,
  MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c,
  MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c,
  MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c,
  MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c,
  OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c,
  QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c,
  QUESTS_SendNpcIntroPacket91_6FC55B60_113c,
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import {
  MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c,
  MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c,
  MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c,
  MISSILE_SrvDo_SpiralPath_6FC60BD0_113c,
  MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c,
  SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c,
  SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c,
  SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c,
  SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c,
  SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c,
  SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c,
  SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c,
  SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c,
  SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c,
} from '../../../src/d2kern-113c/game/k2-w3b4-113c'
import {
  ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c,
  ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c,
  ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c,
  MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c,
  MONUMOD_RollRandomChampionMod_6FC43AE0_113c,
  OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c,
  MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c,
  MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c,
  SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c,
  MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c,
  MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  MONSTER_SpawnChampionPackMembers_6FC67880_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c,
  MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c,
  PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c,
  SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c,
  SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c,
  SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c,
  SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c,
  SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c,
  SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c,
  SKILLS_SrvSt06_ChargeStart_6FC48600_113c,
  SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c,
  MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c,
  MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c,
  MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c,
  MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c,
  MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c,
  MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c,
  SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c,
  SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c,
  SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c,
  SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import {
  SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c,
  SKILLS_UpdateLeapMovementStep_6FC48740_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import {
  MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c,
  MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c,
  MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c,
  QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c,
  SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c,
  SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c,
  SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c,
  SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c,
  SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c,
  SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c,
  SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c,
  SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import {
  MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c,
  MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c,
  SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c,
  SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c'
import {
  QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c,
} from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import {
  type ObjectsPopulateCallees113c,
  OBJECTS_CanPopulateRoom113c,
  OBJECTS_CheckLevelObjectHook113c,
} from '../../../src/d2kern-113c/game/objects-populate-113c'
import {
  MONSTER_SpawnAtCoords113c,
  OBJECTS_InitShrineType113c,
  OBJECTS_PickShrineIdFromControlGroup113c,
  REGPOP_CanPopulateRoom113c,
  REGPOP_IsNearTownExitOrWaypoint113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  OBJECTS_SpawnDensityWithSecondaryTorch113c,
} from '../../../src/d2kern-113c/game/replay-final11-113c'
import {
  PLAYER_GetEquippedWeapon113c,
} from '../../../src/d2kern-113c/game/replay-kernel-113c'
import {
  ROOM_SpawnMonsterPreset113c,
} from '../../../src/d2kern-113c/game/room-presets-113c'
import {
  AIGENERAL_FindAiCommandByType113c,
  AI_TickNodes4_5_7_113c,
  AI_WarrivGreetMem113c,
} from '../../../src/d2kern-113c/game/town-npc-ai-113c'
import {
  QUESTS_StepQuestTimers113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FC2CB30': (m, a) => SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC2F370': (m, a) => ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC30A20': (m, a) => ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC31070': (m, a) => ITEMS_InitCreatedItemStats_6FC31070_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC31A70': (m, a) => ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC32B90': (m, a) => ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC33E60': (m, a) => ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c(m, a[0]!, a[1]!),
  '0x6FC344D0': (m, a) => ITEMS_RollMagicAffixId_6FC344D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC35240': (m, a) => ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c(m, a[0]!, a[1]!),
  '0x6FC36A30': (m, a) => AI_TickNodes4_5_7_113c(m, a[0]!, a[1]!),
  '0x6FC39C20': (m, a) => AI_WarrivGreetMem113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3E3D0': (m, a) => D2Game_6FC3E3D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC40E00': (m, a) => AIGENERAL_FindAiCommandByType113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC410D0': (m, a) => AIGENERAL_ReassignPackOnBossDeath113c(m, a[0]!, a[1]!),
  '0x6FC412F0': (m, a) => AIGENERAL_BroadcastCmdToMinions113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC41840': (m, a) => MONUMOD_ApplyToMinionCallback113c(m, a[0]!, a[1]!, a[2]!, { onMonUMod: (m2, pfn, pMon, umod, boss) => { if (pfn === 0x6fc41be0) MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m2, pMon, umod, boss) } }),
  '0x6FC41880': (m, a) => MONUMOD_DispatchOnKillEvent5_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC41BE0': (m, a) => MONUMOD_ApplyResistanceBonus_6FC41BE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC41E80': (m, a) => MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC42B60': (m, a) => MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC42DA0': (m, a) => MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC43100': (m, a) => MONUMOD_CheckModEligibility_6FC43100_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC43440': (m, a) => MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC43670': (m, a) => MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC43AE0': (m, a) => MONUMOD_RollRandomChampionMod_6FC43AE0_113c(m, a[0]!, a[1]!),
  '0x6FC43BF0': (m, a) => MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC44BF0': (m, a) => MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC44CD0': (m, a) => MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(m, a[0]!, a[1]!),
  '0x6FC457D0': (m, a) => MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC45CC0': (m, a) => MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c(m, a[0]!, a[1]!),
  '0x6FC45E60': (m, a) => MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC466B0': (m, a) => MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC468E0': (m, a) => MONSTER_DispatchMinionComponentCallbacks113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC469B0': (m, a) => MONSTER_Event7_MonUModEvent2_113c(m, a[0]!, a[1]!),
  '0x6FC46BB0': (m, a) => SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC472C0': (m, a) => SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC473C0': (m, a) => SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC47820': (m, a) => SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC47B90': (m, a) => SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC47E30': (m, a) => SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC47F30': (m, a) => SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC48600': (m, a) => SKILLS_SrvSt06_ChargeStart_6FC48600_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC48740': (m, a) => SKILLS_UpdateLeapMovementStep_6FC48740_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC489A0': (m, a) => SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC49240': (m, a) => SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC493B0': (m, a) => SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC494A0': (m, a) => SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC49720': (m, a) => SKILLS_SrvDo045_NovaAndTimedAura_6FC49720_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC4CB80': (m, a) => DRLG_PopulateSingleRoom_6FC4CB80_113c(m, a[0]!, a[1]!),
  '0x6FC4CF30': (m, a) => GAME_DeactivateUnusedRoomsTick113c(m, a[0]!),
  '0x6FC4EAD0': (m, a) => OBJECTS_CheckLevelObjectHook113c(m, a[0]!, a[2]!, a[1]!, a[3]!),
  '0x6FC4ED70': (m, a) => OBJECTS_PickShrineIdFromControlGroup113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC4EE60': (m, a) => OBJECT_DestroyObjectUnit113c(m, a[0]!, a[1]!),
  '0x6FC4EEA0': (m, a) => OBJECTS_CanPopulateRoom113c(m, a[0]!, a[1]!, a[2]!, {} as unknown as ObjectsPopulateCallees113c),
  '0x6FC4EF90': (m, a) => OBJECTS_InitShrineType113c(m, a[0]!),
  '0x6FC51000': (m, a) => OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC52A10': (m, a) => OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC52BC0': (m, a) => OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC53260': (m, a) => OBJECTS_SpawnDensityWithSecondaryTorch113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC533D0': (m, a) => OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c(m, a[0]!),
  '0x6FC53B70': (m, a) => QUESTS_StepQuestTimers113c(m, a[0]!),
  '0x6FC54130': (m, a) => QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC55910': (m, a) => QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC55B60': (m, a) => QUESTS_SendNpcIntroPacket91_6FC55B60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC56140': (m, a) => QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c(m, a[0]!, a[1]!),
  '0x6FC56470': (m, a) => D2Game_6FC56470_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC565E0': (m, a) => D2Game_6FC565E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC56820': (m, a) => QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC56C50': (m, a) => QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c(m, a[0]!, a[1]!),
  '0x6FC572C0': (m, a) => PLAYER_GetEquippedWeapon113c(m, a[0]!),
  '0x6FC588C0': (m, a) => PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC58E60': (m, a) => MISSILE_ClearStateGfxRemoveProc113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC59CE0': (m, a) => MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC59FD0': (m, a) => MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5A280': (m, a) => MISSILES_PopulateDamageByEType_6FC5A280_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5AB30': (m, a) => MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5ABD0': (m, a) => MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5AFF0': (m, a) => MISSILE_ApplyDamageAndArmorShred113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC5B3E0': (m, a) => MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5B5F0': (m, a) => MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5B990': (m, a) => MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5BB60': (m, a) => QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5C850': (m, a) => MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5CEC0': (m, a) => MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC5D020': (m, a) => MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5D1E0': (m, a) => MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC5D450': (m, a) => MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC5DB30': (m, a) => MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5DEF0': (m, a) => MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5E0B0': (m, a) => MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5E8A0': (m, a) => MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5EAE0': (m, a) => MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5F220': (m, a) => MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5F320': (m, a) => MISSILE_SrvDo01_LinearProjectile113c(m, a[0]!, a[1]!),
  '0x6FC5F540': (m, a) => MISSILE_SrvDo01_FastcallThunk113c(m, a[0]!, a[1]!),
  '0x6FC5F9F0': (m, a) => MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c(m, a[0]!, a[1]!),
  '0x6FC5FB40': (m, a) => MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c(m, a[0]!, a[1]!),
  '0x6FC60280': (m, a) => MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c(m, a[0]!, a[1]!),
  '0x6FC60BD0': (m, a) => MISSILE_SrvDo_SpiralPath_6FC60BD0_113c(m, a[0]!, a[1]!),
  '0x6FC60CA0': (m, a) => MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c(m, a[0]!, a[1]!),
  '0x6FC60EB0': (m, a) => MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c(m, a[0]!, a[1]!),
  '0x6FC613D0': (m, a) => MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c(m, a[0]!, a[1]!),
  '0x6FC61710': (m, a) => MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c(m, a[0]!, a[1]!),
  '0x6FC61850': (m, a) => MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c(m, a[0]!, a[1]!),
  '0x6FC61980': (m, a) => MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c(m, a[0]!, a[1]!),
  '0x6FC622B0': (m, a) => STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC62360': (m, a) => SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC62570': (m, a) => SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC62730': (m, a) => SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC628F0': (m, a) => SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC62D90': (m, a) => SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC630D0': (m, a) => SrvDoFunc_020_StaticField113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC631C0': (m, a) => SKILLS_SrvDo_Telekinesis_6FC631C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC63450': (m, a) => SKILLS_SrvDo029_Teleport_6FC63450_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC63720': (m, a) => SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC637D0': (m, a) => SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC639A0': (m, a) => SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c(m, a[0]!, a[1]!),
  '0x6FC63AA0': (m, a) => SKILLS_SrvDo_NovaRing113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC63B60': (m, a) => SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC641C0': (m, a) => SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC64390': (m, a) => SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC643F0': (m, a) => SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC64550': (m, a) => SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC647D0': (m, a) => SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC648E0': (m, a) => SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC654E0': (m, a) => SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC65600': (m, a) => SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC65AF0': (m, a) => SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC65CE0': (m, a) => SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC66000': (m, a) => SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC66210': (m, a) => SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC66B20': (m, a) => REGPOP_IsNearTownExitOrWaypoint113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC66CD0': (m, a) => REGPOP_CanPopulateRoom113c(m, a[0]!, a[1]!),
  '0x6FC67880': (m, a) => MONSTER_SpawnChampionPackMembers_6FC67880_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC67950': (m, a) => ROOM_TickSeedAndAmbientSpawn113c(m, a[0]!, a[1]!, {} as unknown as ActRoomsCallees113c),
  '0x6FC67CF0': (m, a) => ROOM_SpawnMonsterPreset113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, (m2, cid, mode, pg2, pr2, px, py, maxR, wf) => MONSTER_SpawnAtCoords113c(m2, cid, mode, pg2, pr2, px, py, maxR, wf)),
  '0x6FC68950': (m, a) => MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c(m, a[0]!, a[1]!),
  '0x6FC68B60': (m, a) => MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6B1D0': (m, a) => CLIENTS_SetPlayerCurrentRoom113c(m, a[0]!, a[1]!),
  '0x6FC6C220': (m, a) => SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c(m, a[0]!, a[1]!),
  '0x6FC6C2A0': (m, a) => SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6C4F0': (m, a) => SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6D270': (m, a) => SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6D420': (m, a) => SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6D8C0': (m, a) => SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6E2A0': (m, a) => SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC6E390': (m, a) => SKILLS_SetNecroSkeletonComponents113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC6EA30': (m, a) => SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC6EB50': (m, a) => SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6F450': (m, a) => SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c(m, a[0]!, a[1]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P6VectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
  extraCaps: ExtraCapRecord[]
  retMask: string
  asserted: boolean
  assertLine: number
  ret: string
  setupTop: string
  preMem: MemRunRecord[]
  postMem: MemRunRecord[]
  heapTop: string
  heapHex: string
}

const D2COM_PREF_BASE = 0x6fd50000
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_CS_GAME = 0x30010000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS

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
    const effSize = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    if (p > this.heapCursor) {
      this.fill(this.heapCursor, p - this.heapCursor, 0)
    }
    this.fill(p, effSize, 0)
    this.heapCursor = (p + effSize) >>> 0
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

function extractStageRuns(
  mem: CoWSparseMemory113c,
  setupTop: number,
  extraCaps: readonly ExtraCapRecord[],
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P6VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p6/k6-p6-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P6VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P6VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P6] Real-DLL D2Game.dll Band A (0x6FC20000..0x6FC6FFFF) Vector Suite (150 VAs)', () => {
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
    // Pre-zero D2Game .rdata/.bss regions before binding canonical globals
    mem.fill(0x6fd19f00, 0x3100, 0)
    mem.fill(0x6fd27000, 0xb000, 0)
    bindK2KernelGlobals113c(mem)
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) from loaded Items.txt rows
    const nItems = mem.u32(0x6fdefb94) >>> 0
    const pItems = mem.u32(0x6fdefb98) >>> 0
    if (nItems > 0 && nItems < 4096 && pItems !== 0) {
      const nodes: Array<{ code: number; row: number }> = []
      for (let r = 0; r < nItems; r++) {
        const code = mem.u32((pItems + r * 0x1a8 + 0x80) >>> 0) >>> 0
        nodes.push({ code, row: r })
      }
      nodes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.row - b.row))
      const hdrVa = 0x20fe0000
      const nodesVa = 0x20fe0010
      mem.setU32(hdrVa, nItems)
      mem.setU32((hdrVa + 4) >>> 0, 0)
      mem.setU32((hdrVa + 8) >>> 0, nodesVa)
      for (let i = 0; i < nodes.length; i++) {
        mem.setU32((nodesVa + i * 8) >>> 0, nodes[i]!.code)
        mem.setU32((nodesVa + i * 8 + 4) >>> 0, nodes[i]!.row >>> 0)
      }
      mem.setU32(0x6fdeff6c, hdrVa)
    }
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(STAGE_CS_GAME, 0x20, 0)
    mem.fill(0x28000000, 0x10, 0)
    mem.setU32(0x28000004, 1)
    // Initialize known-zero D2Game global regions referenced by save/combat/AI paths
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.fill(0x004000f0, 8, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 150 target real-DLL D2Game Band A VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(150)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fc20000)
      expect(num).toBeLessThanOrEqual(0x6fc6ffff)
      expect(num).not.toBe(0x6fc41420)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    const vaNum = Number.parseInt(va, 16) >>> 0
    const modPrefix = vaNum >= D2COM_PREF_BASE ? 'D2Common' : 'D2Game'

    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        for (const cap of vec.extraCaps) {
          const capStart = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capStart, cap.len, 0)
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
          hits.has(`${modPrefix}:${va}`),
          `${va} case ${vec.caseIdx} (${vec.label}) missing va-trace hit ${modPrefix}:${va}`,
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

        const actualPostMem = extractStageRuns(mem, setupTop, vec.extraCaps)
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
          const rawHeapBytes = mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE)
          const actualHeapHex = bytesToHex(rawHeapBytes)
          expect(
            actualHeapHex,
            `${va} case ${vec.caseIdx} (${vec.label}) heap contents mismatch`,
          ).toBe(vec.heapHex)
        } else {
          expect(
            mem.getHeapTop(),
            `${va} case ${vec.caseIdx} (${vec.label}) unexpected heap allocation (expected zero heap drift)`,
          ).toBe(HEAP_BASE)
        }
      }
    })
  }
})
