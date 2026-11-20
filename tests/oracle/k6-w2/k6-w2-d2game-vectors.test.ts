/**
 * Milestone #37 [K6] Wave 2 — Real-DLL D2Game.dll (0x6FC80000..0x6FD15000)
 * Differential Vector Suite (110 VAs across k2-w2b*..k2-w8b*).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-w2/k6-w2-d2game-emitter.c
 * against the live TypeScript kernel implementations in src/d2kern-113c/game/k2-w2b*..k2-w8b*,
 * verifying 100% bit-exact agreement on return values, Fog.#10024 assertion line numbers,
 * staged arena mutations (including S2C client packet buffers, PRNG seeds, statlists,
 * paths, quest records, and combat damage structs), heap allocations, and va-trace hits.
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
  ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c,
  ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c,
  ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c,
  ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c,
} from '../../../src/d2kern-113c/game/k2-w2b1-113c'
import {
  ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c,
  OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c,
  OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c,
  OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c,
  OBJECTS_GrantUnitSkillPoints_6FC89650_113c,
  SHRINES_ApplyManaExchangeEffect_6FC897A0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b2-113c'
import {
  AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c,
  NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c,
  NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c,
  NET_SendPacket9B_MercReviveInfo_6FCAA690_113c,
  NET_SendPacketA5_StateSkill_6FCABA10_113c,
  OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c,
  OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c,
  PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b3-113c'
import {
  MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c,
  PARTY_AllocNextPartyId_6FCBBD40_113c,
  PARTY_FindSubPartyById_6FCBBD00_113c,
  PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c,
  PARTY_SplitGoldPickupByCap_6FCBBC70_113c,
  S2C_QueueLocationPacket11_6FCABF80_113c,
  SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c,
  SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c,
  SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c,
  SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c,
  SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c,
  SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c,
  SUMMON_GetFirstPetGuidForType_6FCB67B0_113c,
  SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c,
  VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c,
  VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c,
} from '../../../src/d2kern-113c/game/k2-w2b4-113c'
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
  MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c,
  MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c,
  MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c,
  MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c,
  SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c,
  SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c,
  SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c,
  SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c,
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c,
  SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c,
  SKILLS_TargetRingScanCallback_6FCBED70_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import {
  AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c,
  INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c,
  SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c,
  SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c,
} from '../../../src/d2kern-113c/game/k2-w2b6-113c'
import {
  MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c,
  PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import {
  SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c,
  SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c,
  SUNIT_SetPlayerClientPtr_6FD00040_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import { ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c } from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import {
  MISSILE_SendSyncPacket73_6FC8F740_113c,
  SKILLS_CalcUnitSkillToHit_6FC89B00_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c,
  PLAYER_CanLootCorpse_6FC97E70_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import {
  MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c,
  PARTY_CreateAndLinkSubParty_6FCBBF70_113c,
  PETS_FindPetTypeByGuid_6FCB6600_113c,
  PETS_GetFirstPetUnitByType_6FCB6A40_113c,
  PETS_SendPacket7A_UnsummonPet_6FCB6810_113c,
  SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c,
  SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  SKILLS_FindClosestUnitCallback_6FCBEDB0_113c,
  SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c,
  SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
  STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import {
  AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c,
  ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c,
  ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c,
  ITEMMODS_ApplyKnockback_6FCCCE60_113c,
  MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c,
  MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c,
  OBJECTS_RollScaledByte19C_6FD14260_113c,
} from '../../../src/d2kern-113c/game/k2-w5b10-113c'
import {
  SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c,
  SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import { SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c } from '../../../src/d2kern-113c/game/k2-w5b5-113c'
import {
  ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c,
  SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c,
  SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c'
import { PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c } from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c,
  SKILLS_RollMonsterConversionChance_6FCB1610_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import { CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c } from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import { C2S_Packet3A_AddStatPoint_6FCEC960_113c } from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c,
  SKILLS_SrvDo_Unsummon_6FCC2EA0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'

type KernelFn113c = (m: SparseMemory113c, ...args: number[]) => unknown

const DISPATCH_BY_VA: Record<string, KernelFn113c> = {
  '0x6FCB0EA0': MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c as unknown as KernelFn113c,
  '0x6FCB1040': MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c as unknown as KernelFn113c,
  '0x6FCBE4F0': SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c as unknown as KernelFn113c,
  '0x6FCD32E0': MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c as unknown as KernelFn113c,
  '0x6FC8F740': MISSILE_SendSyncPacket73_6FC8F740_113c as unknown as KernelFn113c,
  '0x6FCF22C0': ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c as unknown as KernelFn113c,
  '0x6FCFAE70': SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c as unknown as KernelFn113c,
  '0x6FCFCE00': SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c as unknown as KernelFn113c,
  '0x6FCFAED0': SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c as unknown as KernelFn113c,
  '0x6FCCCA70': ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c as unknown as KernelFn113c,
  '0x6FCCCB10': ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c as unknown as KernelFn113c,
  '0x6FCCCE60': ITEMMODS_ApplyKnockback_6FCCCE60_113c as unknown as KernelFn113c,
  '0x6FCCF2E0': SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c as unknown as KernelFn113c,
  '0x6FCD13B0': MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c as unknown as KernelFn113c,
  '0x6FCD22D0': ARENA_GetModeByte_6FCD22D0_113c as unknown as KernelFn113c,
  '0x6FCD2480': ARENA_FreePlayerArenaUnit_6FCD2480_113c as unknown as KernelFn113c,
  '0x6FCD24D0': ARENA_AllocPlayerArenaUnit_6FCD24D0_113c as unknown as KernelFn113c,
  '0x6FCD2560': ARENA_AllocGameArenaCtrl_6FCD2560_113c as unknown as KernelFn113c,
  '0x6FCD2620': ARENA_CheckFlagBit8_6FCD2620_113c as unknown as KernelFn113c,
  '0x6FD00040': SUNIT_SetPlayerClientPtr_6FD00040_113c as unknown as KernelFn113c,
  '0x6FD00BD0': SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c as unknown as KernelFn113c,
  '0x6FC89650': OBJECTS_GrantUnitSkillPoints_6FC89650_113c as unknown as KernelFn113c,
  '0x6FC89B00': SKILLS_CalcUnitSkillToHit_6FC89B00_113c as unknown as KernelFn113c,
  '0x6FCB1240': SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c as unknown as KernelFn113c,
  '0x6FCB1400': SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c as unknown as KernelFn113c,
  '0x6FCB1610': SKILLS_RollMonsterConversionChance_6FCB1610_113c as unknown as KernelFn113c,
  '0x6FCB1B40': SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c as unknown as KernelFn113c,
  '0x6FCB2060': SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c as unknown as KernelFn113c,
  '0x6FCB6600': PETS_FindPetTypeByGuid_6FCB6600_113c as unknown as KernelFn113c,
  '0x6FCB67B0': SUMMON_GetFirstPetGuidForType_6FCB67B0_113c as unknown as KernelFn113c,
  '0x6FCB6810': PETS_SendPacket7A_UnsummonPet_6FCB6810_113c as unknown as KernelFn113c,
  '0x6FCB6A40': PETS_GetFirstPetUnitByType_6FCB6A40_113c as unknown as KernelFn113c,
  '0x6FCB8390': SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c as unknown as KernelFn113c,
  '0x6FCB88B0': SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c as unknown as KernelFn113c,
  '0x6FCBC9A0': SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c as unknown as KernelFn113c,
  '0x6FCBCA00': SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c as unknown as KernelFn113c,
  '0x6FCBE330': SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c as unknown as KernelFn113c,
  '0x6FCBE730': SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c as unknown as KernelFn113c,
  '0x6FCBE970': SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c as unknown as KernelFn113c,
  '0x6FCBE9B0': SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c as unknown as KernelFn113c,
  '0x6FCBEB30': SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c as unknown as KernelFn113c,
  '0x6FCBED20': SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c as unknown as KernelFn113c,
  '0x6FCBED70': SKILLS_TargetRingScanCallback_6FCBED70_113c as unknown as KernelFn113c,
  '0x6FCBEDB0': SKILLS_FindClosestUnitCallback_6FCBEDB0_113c as unknown as KernelFn113c,
  '0x6FCBF1A0': SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c as unknown as KernelFn113c,
  '0x6FCBF210': SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c as unknown as KernelFn113c,
  '0x6FCC2EA0': SKILLS_SrvDo_Unsummon_6FCC2EA0_113c as unknown as KernelFn113c,
  '0x6FCC3C80': SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c as unknown as KernelFn113c,
  '0x6FCC3D00': MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c as unknown as KernelFn113c,
  '0x6FCC3D60': SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c as unknown as KernelFn113c,
  '0x6FCD2F80': SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c as unknown as KernelFn113c,
  '0x6FCD2FA0': SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c as unknown as KernelFn113c,
  '0x6FCEB610': SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c as unknown as KernelFn113c,
  '0x6FC89940': OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c as unknown as KernelFn113c,
  '0x6FC89C60': OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c as unknown as KernelFn113c,
  '0x6FC9B860': AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c as unknown as KernelFn113c,
  '0x6FC9B9F0': AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c as unknown as KernelFn113c,
  '0x6FCAF820': SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c as unknown as KernelFn113c,
  '0x6FCC38C0': MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c as unknown as KernelFn113c,
  '0x6FCC3980': MONAI_ClearAiControlParam0_6FCC3980_113c as unknown as KernelFn113c,
  '0x6FCC3990': MONAI_InitAiControlDefaultParams_6FCC3990_113c as unknown as KernelFn113c,
  '0x6FCC39B0': MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c as unknown as KernelFn113c,
  '0x6FCC3AE0': MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c as unknown as KernelFn113c,
  '0x6FCC3C30': MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c as unknown as KernelFn113c,
  '0x6FCC3E10': MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c as unknown as KernelFn113c,
  '0x6FCCC910': MONAI_EnableState172OnTarget_6FCCC910_113c as unknown as KernelFn113c,
  '0x6FCCC940': MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c as unknown as KernelFn113c,
  '0x6FCCC9E0': MONAI_InventoryContainsItemPointer_6FCCC9E0_113c as unknown as KernelFn113c,
  '0x6FCCCA20': MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c as unknown as KernelFn113c,
  '0x6FCD0840': MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c as unknown as KernelFn113c,
  '0x6FCD0980': AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c as unknown as KernelFn113c,
  '0x6FCD0BA0': MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c as unknown as KernelFn113c,
  '0x6FCD0DB0': MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c as unknown as KernelFn113c,
  '0x6FCD0DF0': MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c as unknown as KernelFn113c,
  '0x6FCD0E30': MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c as unknown as KernelFn113c,
  '0x6FCD6CE0': AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c as unknown as KernelFn113c,
  '0x6FCEA490': MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c as unknown as KernelFn113c,
  '0x6FD13410': NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c as unknown as KernelFn113c,
  '0x6FC802A0': ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c as unknown as KernelFn113c,
  '0x6FC80390': ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c as unknown as KernelFn113c,
  '0x6FC80400': ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c as unknown as KernelFn113c,
  '0x6FC80450': ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c as unknown as KernelFn113c,
  '0x6FC804C0': ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c as unknown as KernelFn113c,
  '0x6FC80A30': ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c as unknown as KernelFn113c,
  '0x6FCDA330': ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c as unknown as KernelFn113c,
  '0x6FC89670': OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c as unknown as KernelFn113c,
  '0x6FC89730': OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c as unknown as KernelFn113c,
  '0x6FC897A0': SHRINES_ApplyManaExchangeEffect_6FC897A0_113c as unknown as KernelFn113c,
  '0x6FC89C00': OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c as unknown as KernelFn113c,
  '0x6FC8FFC0': PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c as unknown as KernelFn113c,
  '0x6FC91170': CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c as unknown as KernelFn113c,
  '0x6FC97E70': PLAYER_CanLootCorpse_6FC97E70_113c as unknown as KernelFn113c,
  '0x6FCAA690': NET_SendPacket9B_MercReviveInfo_6FCAA690_113c as unknown as KernelFn113c,
  '0x6FCAA9C0': NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c as unknown as KernelFn113c,
  '0x6FCAB9B0': NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c as unknown as KernelFn113c,
  '0x6FCABA10': NET_SendPacketA5_StateSkill_6FCABA10_113c as unknown as KernelFn113c,
  '0x6FCABF80': S2C_QueueLocationPacket11_6FCABF80_113c as unknown as KernelFn113c,
  '0x6FCBBC70': PARTY_SplitGoldPickupByCap_6FCBBC70_113c as unknown as KernelFn113c,
  '0x6FCBBCB0': PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c as unknown as KernelFn113c,
  '0x6FCBBD00': PARTY_FindSubPartyById_6FCBBD00_113c as unknown as KernelFn113c,
  '0x6FCBBD40': PARTY_AllocNextPartyId_6FCBBD40_113c as unknown as KernelFn113c,
  '0x6FCBBF70': PARTY_CreateAndLinkSubParty_6FCBBF70_113c as unknown as KernelFn113c,
  '0x6FCBE450': VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c as unknown as KernelFn113c,
  '0x6FCBE490': VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c as unknown as KernelFn113c,
  '0x6FCC3A20': STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c as unknown as KernelFn113c,
  '0x6FCDC990': INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c as unknown as KernelFn113c,
  '0x6FCEB4E0': PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c as unknown as KernelFn113c,
  '0x6FCEC960': C2S_Packet3A_AddStatPoint_6FCEC960_113c as unknown as KernelFn113c,
  '0x6FD0AE20': PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c as unknown as KernelFn113c,
  '0x6FD14260': OBJECTS_RollScaledByte19C_6FD14260_113c as unknown as KernelFn113c,
}

const PAGE_BITS = 12
const PAGE_SIZE = 1 << PAGE_BITS
const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x9000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000

interface MemRunRecord {
  readonly addr: string
  readonly hex: string
}

interface K6W2VectorRecord {
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

/**
 * Copy-on-write SparseMemory113c subclass backed by an immutable base page map
 * (hydrated once from d2game-datatbls-113c.img.gz + bindK2KernelGlobals113c + zeroed
 * 0x30000000..0x30008FFF staged arena) so resetting per vector case is O(dirtyPages).
 */
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

function loadVectors(): K6W2VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w2/k6-w2-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W2VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W2VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 2 real-DLL D2Game.dll (0x6FC80000..0x6FD15000) differential vectors', () => {
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

  it('covers 110 real-DLL D2Game.dll VAs in 0x6FC80000..0x6FD15000', () => {
    expect(VECTORS_BY_VA.size).toBe(110)
    expect(Object.keys(DISPATCH_BY_VA).length).toBe(110)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(330)
    for (const va of VECTORS_BY_VA.keys()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fc80000)
      expect(num).toBeLessThanOrEqual(0x6fd15000)
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
          retVal = fn!(mem, ...vec.tsArgs)
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
