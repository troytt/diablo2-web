/**
 * Milestone #37 [K6] Wave 11 — Real-DLL D2Game.dll Lo-VA Part 3 (0x6FC20000..0x6FCBFFFF)
 * Differential Vector Suite (150 net-new VAs, >= 450 real-DLL vectors).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-w11/k6-w11-d2game-emitter.c
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

import { DUNGEON_CountNonPresetRoomsInLevel113c } from '../../../src/d2kern-113c/common/dungeon'
import { REGPOP_RollAmbientSpawn113c, type ActRoomsCallees113c } from '../../../src/d2kern-113c/game/act-rooms-113c'
import { SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c } from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c,
  SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c,
  STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c,
} from '../../../src/d2kern-113c/game/k2-laneH-0x6fc2-w1-113c'
import {
  MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c,
  MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c,
  PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c,
  MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c,
  MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c,
  SKILLS_RedemptionCorpseCallback_6FC59930_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import {
  REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c,
  SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c'
import { ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c } from '../../../src/d2kern-113c/game/k2-laneM-0x6fc7-w1-113c'
import { PARTY_AllocPartyControl_6FCBBE40_113c } from '../../../src/d2kern-113c/game/k2-w2b4-113c'
import {
  ITEMS_AddStaffModSkillsByTier_6FC335E0_113c,
  ITEMS_ApplyLowQualityItemMods_6FC337F0_113c,
  ITEMS_PopulateItemDropStruct_6FC2E410_113c,
  ITEMS_RollAndApplyUniqueItem_6FC33C20_113c,
  OBJRGN_AllocObjectControl_6FC2B9A0_113c,
  OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c,
  SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c,
  SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c,
  SKILLS_MountImpOnSiegeBeast_6FC2D040_113c,
  SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c,
  SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import {
  MONUMOD_ApplyChampionBaseStats_6FC418A0_113c,
  MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c,
  MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c,
  MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c,
  MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c,
  MONUMOD_SpawnDeathNova_6FC46520_113c,
  MONUMOD_SpawnScarabChargedBolts_6FC46320_113c,
  SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c,
  SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import {
  MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c,
  MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c,
  MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c,
  MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c,
  MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c,
  MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c,
  MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import {
  MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c,
  MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c,
  MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c,
  SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c,
  SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c,
  SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c,
  SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c,
  SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c,
  SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c,
  SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c,
} from '../../../src/d2kern-113c/game/k2-w3b4-113c'
import {
  ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c,
  ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import {
  ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c,
  ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import {
  ACT1Q4_OnCainModeOrInteract_6FC88150_113c,
  MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c,
  OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c,
  MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c,
  MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c,
  SKILLS_EndChargeOrLeapMovement_6FC48170_113c,
  SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c,
  SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c,
  CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c,
  MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c,
  MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c,
  MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c,
  MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c,
  MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c,
  MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c,
  MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c,
  SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c,
  SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c,
  ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c,
  ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c,
  ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c,
  OBJ_CalcShrineStatBonusValue_6FC89EE0_113c,
  OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c,
  OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c,
  ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c,
  NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c,
  STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c,
  MISSILES_RedeemCorpseWithSkill124_6FC59910_113c,
  MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c,
  MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c,
  SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c,
  SKILLS_SrvDo018_FindPotion_6FC47600_113c,
  SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c,
  SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c,
  SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c,
  SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c,
  ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c,
  ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c,
  NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c,
  OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import {
  MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c,
  MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c,
  MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c,
  MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c,
  SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c,
  SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c,
  SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import {
  SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c,
  SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  ACT1Q1_TimerPromoteState5_6FC83B50_113c,
  ACT1Q2_TimerPromoteState3_6FC83A80_113c,
  ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c,
  ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c,
  ACT1Q5_TimerPromoteState0D_6FC83210_113c,
  ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c,
  ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c,
  ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c,
  ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c,
  ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c,
  ACT5Q4_TimerPromoteState4_6FC79CD0_113c,
  ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c,
  ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c,
  MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c,
  OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c,
  QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import {
  MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c,
  PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c,
  SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c,
  SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c,
  SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import {
  ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c,
  ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c,
  ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import {
  PARTY_AddPlayerToSubParty_6FCBC4F0_113c,
  PARTY_RemoveSubPartyById_6FCBC7D0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import {
  ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c,
  ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c,
  ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c,
  ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c,
  QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c,
  QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c,
} from '../../../src/d2kern-113c/game/k2-w8b1-113c'
import {
  MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c,
  MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c,
} from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import {
  MONSTER_AssignTeleportSkill_6FC441B0_113c,
  STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import { CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c } from '../../../src/d2kern-113c/game/k2-w16b1-113c'

const UNEXPECTED_ACT_ROOMS_CALLEE = (): never => {
  throw new Error('Unexpected ActRoomsCallees113c call from REGPOP_RollAmbientSpawn113c')
}

const AMBIENT_ACT_ROOMS_CALLEES: ActRoomsCallees113c = {
  refreshRoomUnits: UNEXPECTED_ACT_ROOMS_CALLEE,
  objects: {
    getLevelRoomCountInAct: DUNGEON_CountNonPresetRoomsInLevel113c,
    checkLevelObjectHook: UNEXPECTED_ACT_ROOMS_CALLEE,
    spawnObjectsByFn: UNEXPECTED_ACT_ROOMS_CALLEE,
    spawn: {
      initObject: UNEXPECTED_ACT_ROOMS_CALLEE,
      placeServerUnit: UNEXPECTED_ACT_ROOMS_CALLEE,
    },
  },
  initAmbientMonster(mem, pUnit) {
    const pGame = pUnit !== 0 ? mem.u32((pUnit + 0x80) >>> 0) >>> 0 : 0
    if (pGame !== 0) {
      SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(mem, pGame, 8, pUnit, 0)
    }
    const pMonData = pUnit !== 0 ? mem.u32((pUnit + 0x14) >>> 0) >>> 0 : 0
    if (pMonData !== 0) {
      const pAiGen = mem.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0) {
        mem.setU32(pAiGen, 8)
      }
    }
  },
  presets: {
    spawnMonsterPreset: UNEXPECTED_ACT_ROOMS_CALLEE,
    spawnSpecialObject: UNEXPECTED_ACT_ROOMS_CALLEE,
    allocUnitData: UNEXPECTED_ACT_ROOMS_CALLEE,
    placePresetItem: UNEXPECTED_ACT_ROOMS_CALLEE,
    freeUnit: UNEXPECTED_ACT_ROOMS_CALLEE,
    initQuestObject1CB: UNEXPECTED_ACT_ROOMS_CALLEE,
    initQuestObject1CD: UNEXPECTED_ACT_ROOMS_CALLEE,
    initQuestObject21F: UNEXPECTED_ACT_ROOMS_CALLEE,
  },
  regpop: {
    getLevelRoomCountInAct: DUNGEON_CountNonPresetRoomsInLevel113c,
  },
}

const DISPATCH_BY_VA: Record<string, (m: SparseMemory113c, a: readonly number[]) => number> = {
  '0x6FC7D080': (m, a) => { ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c(m, a[0]!); return 0 },
  '0x6FC88250': (m, a) => (ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c(m, a[0]!) as number) | 0,
  '0x6FC88150': (m, a) => (ACT1Q4_OnCainModeOrInteract_6FC88150_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC83570': (m, a) => { ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c(m, a[0]!); return 0 },
  '0x6FC83A80': (m, a) => (ACT1Q2_TimerPromoteState3_6FC83A80_113c(m, a[0]!) as number) | 0,
  '0x6FC83210': (m, a) => (ACT1Q5_TimerPromoteState0D_6FC83210_113c(m, a[0]!) as number) | 0,
  '0x6FC83B50': (m, a) => (ACT1Q1_TimerPromoteState5_6FC83B50_113c(m, a[0]!) as number) | 0,
  '0x6FC79CD0': (m, a) => (ACT5Q4_TimerPromoteState4_6FC79CD0_113c(m, a[0]!) as number) | 0,
  '0x6FC836C0': (m, a) => { ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c(m, a[0]!); return 0 },
  '0x6FC79C50': (m, a) => { ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c(m, a[0]!); return 0 },
  '0x6FC79F80': (m, a) => { ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c(m, a[0]!); return 0 },
  '0x6FC798B0': (m, a) => { ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c(m, a[0]!); return 0 },
  '0x6FC7B030': (m, a) => (ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC7A200': (m, a) => { ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c(m, a[0]!); return 0 },
  '0x6FC7CFF0': (m, a) => (ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7A690': (m, a) => { ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC79EF0': (m, a) => { ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c(m, a[0]!); return 0 },
  '0x6FC7A160': (m, a) => (ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC79930': (m, a) => (ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c(m, a[0]!) as number) | 0,
  '0x6FC84B60': (m, a) => (ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FCBBE40': (m, a) => { PARTY_AllocPartyControl_6FCBBE40_113c(m, a[0]!); return 0 },
  '0x6FCBC7D0': (m, a) => { PARTY_RemoveSubPartyById_6FCBC7D0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC4C060': (m, a) => { CLIENTS_CollectAndFlushNearbyPlayerPositions_6FC4C060_113c(m, a[0]!); return 0 },
  '0x6FC4BE20': (m, a) => { PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c(m, a[0]!); return 0 },
  '0x6FC6AD80': (m, a) => { CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCAC910': (m, a) => (NET_CheckPartyMemberStatSyncDelta_6FCAC910_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCBC4F0': (m, a) => (PARTY_AddPlayerToSubParty_6FCBC4F0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCBC270': (m, a) => (PARTY_DistributeGoldPickupAndReturnRemainder_6FCBC270_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC304F0': (m, a) => (ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC301E0': (m, a) => { ITEMS_InitAndApplySuperiorQualityMods_6FC301E0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC309B0': (m, a) => { ITEMS_FallbackToNormalQualityAndFinalize_6FC309B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC30730': (m, a) => (ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC30600': (m, a) => { ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FCAFAF0': (m, a) => { NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC33C20': (m, a) => (ITEMS_RollAndApplyUniqueItem_6FC33C20_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC2E410': (m, a) => { ITEMS_PopulateItemDropStruct_6FC2E410_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC335E0': (m, a) => { ITEMS_AddStaffModSkillsByTier_6FC335E0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC337F0': (m, a) => (ITEMS_ApplyLowQualityItemMods_6FC337F0_113c(m, a[0]!) as number) | 0,
  // Batch 2: DRLG/Room/SUnit + Combat/SUnitDmg/States (33 VAs)
  '0x6FC4EF50': (m, a) => { OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c(m, a[0]!); return 0 },
  '0x6FC67820': (m, a) => { REGPOP_RollAmbientSpawn113c(m, a[0]!, a[1]!, a[2]!, a[3]!, AMBIENT_ACT_ROOMS_CALLEES); return 0 },
  '0x6FC8B6F0': (m, a) => (OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5BC00': (m, a) => (OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC8A4E0': (m, a) => { OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8A050': (m, a) => { OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC8B8A0': (m, a) => { OBJ_ShrineMonster_PromoteNearestMonster_6FC8B8A0_113c(m, a[0]!); return 0 },
  '0x6FC89EE0': (m, a) => (OBJ_CalcShrineStatBonusValue_6FC89EE0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC670F0': (m, a) => (REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC3EE50': (m, a) => (MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC2B510': (m, a) => (OBJRGN_ResolveMonsterShrineBaseClassId_6FC2B510_113c(m, a[0]!) as number) | 0,
  '0x6FC6A460': (m, a) => { SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!); return 0 },
  '0x6FC2B9A0': (m, a) => (OBJRGN_AllocObjectControl_6FC2B9A0_113c(m, a[0]!) as number) | 0,
  '0x6FC468C0': (m, a) => { MONUMOD_EventScarabChargedBoltsWrapper_6FC468C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC46320': (m, a) => { MONUMOD_SpawnScarabChargedBolts_6FC46320_113c(m, a[0]!, a[1]!, undefined, a[2]!); return 0 },
  '0x6FC462D0': (m, a) => { MONUMOD_SpawnColdEnchantedFrostNova_6FC462D0_113c(m, a[0]!, a[1]!, undefined, a[2]!); return 0 },
  '0x6FC42B10': (m, a) => { MONUMOD_SpawnPainWormOnDeath_6FC42B10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC43730': (m, a) => { MONUMOD_UnlinkMinionAndStopSkill_6FC43730_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC46230': (m, a) => { MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC441B0': (m, a) => { MONSTER_AssignTeleportSkill_6FC441B0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCB85D0': (m, a) => { STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC44030': (m, a) => { MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC44250': (m, a) => { MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC47190': (m, a) => { STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC46520': (m, a) => { MONUMOD_SpawnDeathNova_6FC46520_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC2C000': (m, a) => { STATES_OnRemoveImpregnatedSpawn_6FC2C000_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC44300': (m, a) => { MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC960F0': (m, a) => { MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC418A0': (m, a) => { MONUMOD_ApplyChampionBaseStats_6FC418A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC41FE0': (m, a) => { MONUMOD_ApplyElementalDamageBonus_6FC41FE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC43E20': (m, a) => { MONUMOD_EventReviveOrCorpseCheck_6FC43E20_113c(m, a[0]!, a[1]!); return 0 },
  // Batch 3: Missiles (28 VAs) + Skills (33 VAs)
  '0x6FC59910': (m, a) => (MISSILES_RedeemCorpseWithSkill124_6FC59910_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC5BE70': (m, a) => (MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5BD10': (m, a) => (MISSILES_SrvDo_SpawnMissileParam0Monster_6FC5BD10_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5BC80': (m, a) => (MISSILES_SrvDo_SpawnSkillParam1Monster_6FC5BC80_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC61EB0': (m, a) => (MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC61670': (m, a) => (MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC60420': (m, a) => (MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC60B20': (m, a) => (MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC61B80': (m, a) => (MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5D800': (m, a) => (MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5E330': (m, a) => (MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC61DE0': (m, a) => (MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5B070': (m, a) => (MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5CD00': (m, a) => (MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5CC30': (m, a) => (MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5DA60': (m, a) => (MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC605E0': (m, a) => (MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5CDD0': (m, a) => (MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5F120': (m, a) => (MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5C160': (m, a) => (MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC604D0': (m, a) => (MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5F550': (m, a) => (MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5FD30': (m, a) => (MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5FED0': (m, a) => (MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC5E670': (m, a) => (MISSILES_SrvDo_OpenTownPortalObject_6FC5E670_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC61110': (m, a) => (MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC61520': (m, a) => (MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC2C8D0': (m, a) => (SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC2D530': (m, a) => (SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2D7B0': (m, a) => (SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2C6B0': (m, a) => { SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC2DD50': (m, a) => (SKILLS_SrvDo009_CorpseConsumeAuraBuff_6FC2DD50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC65410': (m, a) => { SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!); return 0 },
  '0x6FC2D290': (m, a) => (SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2C310': (m, a) => (SKILLS_SrvDo128_MinionAttackCmd_6FC2C310_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC59930': (m, a) => { SKILLS_RedemptionCorpseCallback_6FC59930_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC63610': (m, a) => (SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6C720': (m, a) => (SKILLS_SrvDo054_MeleeHitZeroBonus_6FC6C720_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC62C70': (m, a) => (SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC2C1F0': (m, a) => (SKILLS_FindHostileUseableCorpseInRange_6FC2C1F0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC2D170': (m, a) => (SKILLS_SrvDo_PackLeaderMarkAndFireMissile_6FC2D170_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC46E40': (m, a) => (SKILLS_CalcWhirlwindFrameInterval_6FC46E40_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC2DB00': (m, a) => { SKILLS_DismountImpFromSiegeBeast_6FC2DB00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC47600': (m, a) => (SKILLS_SrvDo018_FindPotion_6FC47600_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC64ED0': (m, a) => (SKILLS_SrvDo035_MeleeSkillHitWithWeaponFill_6FC64ED0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC634E0': (m, a) => (SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC48170': (m, a) => (SKILLS_EndChargeOrLeapMovement_6FC48170_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC2D040': (m, a) => { SKILLS_MountImpOnSiegeBeast_6FC2D040_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC2CDC0': (m, a) => (SKILLS_SrvDo129_SpawnSummonFromParams_6FC2CDC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2CF00': (m, a) => (SKILLS_SrvDo133_LeaderLifeLeechHit_6FC2CF00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC2D9C0': (m, a) => (SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC476D0': (m, a) => (SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6C3A0': (m, a) => (SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6C600': (m, a) => (SKILLS_SrvSt31_CappedMultiHitMeleeStart_6FC6C600_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC6CB00': (m, a) => (SKILLS_SrvDo055_MeleeHitWithMonsterElemStatsAndEvents_6FC6CB00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC64AC0': (m, a) => (SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC64C20': (m, a) => (SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC64D70': (m, a) => (SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC66A20': (m, a) => (SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  // Batch 4: Quests + MonAI + Skills + Missiles (22 VAs -> 150 Total)
  '0x6FC56050': (m, a) => { QUESTS_TriggerAct5PortalTransitionIfBelowLevel108_6FC56050_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7CC30': (m, a) => { ACT5Q3_TriggerFrozenAnyaSpawn_6FC7CC30_113c(m, a[0]!); return 0 },
  '0x6FC88D20': (m, a) => { ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7E790': (m, a) => { ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC854A0': (m, a) => { ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC799E0': (m, a) => (ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7C080': (m, a) => { ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC848B0': (m, a) => (ACT1Q4_CompleteCainRescueInTristramAndParty_6FC848B0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC55E90': (m, a) => { QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC830D0': (m, a) => (ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC80F70': (m, a) => (ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC70190': (m, a) => (SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC479C0': (m, a) => (PLRMODE_ExecuteMonsterMeleeSkillHit_6FC479C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC5BDA0': (m, a) => { QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC77CB0': (m, a) => (ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC827A0': (m, a) => (ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC4D790': (m, a) => { CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FCB2230': (m, a) => (SKILLS_SrvDo_SpawnChargedProjectileAtTarget_6FCB2230_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC663A0': (m, a) => (SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC786C0': (m, a) => (ACT5Q1_CheckPlayerNearShenkRoomCallback_6FC786C0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FCB61A0': (m, a) => (SKILLS_SrvDo_DualClawProgressiveChargeAttack_6FCB61A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC5C3B0': (m, a) => (MISSILES_SrvHit_SpawnBurstSubMissiles_6FC5C3B0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
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

interface K6W11VectorRecord {
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

function loadVectors(): K6W11VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w11/k6-w11-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W11VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W11VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 11 real-DLL D2Game.dll Lo-VA Part 3 (0x6FC20000..0x6FCBFFFF) differential vectors', () => {
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
    expect(Object.keys(DISPATCH_BY_VA).length).toBe(150)
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
