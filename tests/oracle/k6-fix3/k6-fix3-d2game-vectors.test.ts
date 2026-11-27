/**
 * [K6] Fix 3 — Real-DLL D2Game.dll Hi-VA Closer (100.0% Hi-VAs) & Round-3 Parity Suite.
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-fix3/k6-fix3-d2game-emitter.c
 * against the fixed TypeScript v1.13c kernel in src/d2kern-113c/game/*, verifying 100%
 * bit-exact agreement on return values, Fog.#10024 assertion line numbers, staged arena
 * memory mutations, heap allocations, and va-trace-113c runtime hits across:
 *   - ALL 47 remaining un-hit Hi-VAs (0x6FCC0000..0x6FD142D0 -> 100.0% real-DLL verified)
 *   - 45 reserved Round-3 bug-unlocked Lo-VAs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import {
  ITEMMODE_UnitTimerNoop113c,
  PACKET_C2S2C_Reject3_113c,
  PACKET_C2S2D_Reject3_113c,
  PACKET_C2S39_Reject3_113c,
  PACKET_C2S45_Reject3_113c,
  PACKET_C2S52_Reject3_113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import { MISSILE_CreateServerProjectile113c } from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import { MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c } from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  GAME_CommitGlobalGameSlot_6FC4A2D0_113c,
  OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import { ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c } from '../../../src/d2kern-113c/game/k2-real-itemdrop-113c'
import { SUNITDMG_ComputeExperienceGain113c } from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import {
  ACT3Q0_StatusFilter113c,
  ACT3Q1_HratliIntroStatusFilter113c,
  ACT3Q7_Callback11_Noop113c,
} from '../../../src/d2kern-113c/game/k2-sunit-spawn-w1-113c'
import {
  ACT1Q6_InitQuestData_6FC88060_113c,
  ACT2Q3_InitQuestData_6FCE7480_113c,
  ACT5Q4_InitQuestData_6FC7D5C0_113c,
  PARTY_SetOrClearPlayerHostility_6FD11130_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import {
  ACT5Q5_InitQuestData_6FC7FB50_113c,
  OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import { ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c } from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import { ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c } from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  MONAI_NoOpRet4_6FCC3920_113c,
  MONAI_NoOpRet4_6FCC39D0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c'
import {
  ACT2Q4_Callback00_Noop_6FCE1980_113c,
  ACT2Q4_StatusFilter_6FCE1970_113c,
  ACT2Q5_StatusFilter_6FCE1960_113c,
  ACT4Prologue_StatusFilter_6FCD8B80_113c,
  ACT4Q0_StatusFilter_6FCD87D0_113c,
  AIBAAL_NoopThink_6FCD6C80_113c,
} from '../../../src/d2kern-113c/game/k2-w2b6-113c'
import {
  ACT2Q0_StatusFilter_6FCE25C0_113c,
  ACT2Q3_NoOpB_6FCE2360_113c,
  ACT2Q3_NoOpC_6FCE2370_113c,
} from '../../../src/d2kern-113c/game/k2-w2b7-113c'
import {
  OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c,
  OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c,
  SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import { SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c } from '../../../src/d2kern-113c/game/k2-w3b4-113c'
import {
  MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c,
  OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c,
  OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c,
  OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c,
  CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c,
  ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import { MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c } from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c,
  SKILLS_ApplyRadialDamageCallback_6FCB3040_113c,
  SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c,
  SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c,
  SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c,
  SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import { MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c } from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import { ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c } from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import {
  MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c,
  SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c,
  SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c,
  SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c,
  SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c,
  SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c,
  SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c,
  SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c,
  SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c,
  SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import {
  AURA_FindClosestUnitInRadius_6FCC1000_113c,
  SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c,
  SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c,
  SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c,
  SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c,
  SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c,
  SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c,
  SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import { MONAI_SiegeRunnerThink_6FCC66E0_113c } from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import {
  MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c,
  MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import { SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c } from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import { ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c } from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import {
  PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c,
  SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import { ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c } from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import {
  ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c,
  PARTY_ToggleLootPermission_6FD10F40_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c,
  ACT2Q5_InitQuestData_6FCE7080_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c'
import {
  ACT2Q1_InitQuestData_6FCE7B40_113c,
  ACT2Q4_InitQuestData_6FCE9400_113c,
  ACT3Q3_InitQuestData_6FD07CE0_113c,
  ACT3Q6_InitQuestData_6FD0A080_113c,
} from '../../../src/d2kern-113c/game/k2-w9b2-113c'
import { AI_InitMonsterAiThinkFn113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  // Part A1 — 21 Clean StatusFilter / NoOp / Reject3 Hi-VAs
  '0x6FCC3920': (m, a) => MONAI_NoOpRet4_6FCC3920_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC39D0': (m, a) => MONAI_NoOpRet4_6FCC39D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD6C80': (m, a) => AIBAAL_NoopThink_6FCD6C80_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCE1980': (m, a) => ACT2Q4_Callback00_Noop_6FCE1980_113c(m, a[0]!, a[1]!),
  '0x6FCE2360': (m) => ACT2Q3_NoOpB_6FCE2360_113c(m),
  '0x6FCE2370': (m) => ACT2Q3_NoOpC_6FCE2370_113c(m),
  '0x6FCF1790': (m, a) => ITEMMODE_UnitTimerNoop113c(m, a[0]!, a[1]!),
  '0x6FD02EF0': (m, a) => ACT3Q7_Callback11_Noop113c(m, a[0]!, a[1]!),
  '0x6FCD87D0': (m, a) => ACT4Q0_StatusFilter_6FCD87D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCD8B80': (m, a) => ACT4Prologue_StatusFilter_6FCD8B80_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE1960': (m, a) => ACT2Q5_StatusFilter_6FCE1960_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE1970': (m, a) => ACT2Q4_StatusFilter_6FCE1970_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCE25C0': (m, a) => ACT2Q0_StatusFilter_6FCE25C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD028B0': (m, a) => ACT3Q0_StatusFilter113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD03030': (m, a) => ACT3Q1_HratliIntroStatusFilter113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCEB1E0': (m, a) => PACKET_C2S2C_Reject3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEB490': (m, a) => PACKET_C2S52_Reject3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEB550': (m, a) => PACKET_C2S45_Reject3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEB560': (m, a) => PACKET_C2S39_Reject3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEBDA0': (m, a) => PACKET_C2S2D_Reject3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD07050': (m, a) => ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c(m, a[0]!, a[1]!),

  // Part A2 — 7 InitQuestData Hi-VAs
  '0x6FCE7080': (m, a) => ACT2Q5_InitQuestData_6FCE7080_113c(m, a[0]!),
  '0x6FCE7480': (m, a) => ACT2Q3_InitQuestData_6FCE7480_113c(m, a[0]!),
  '0x6FCE7B40': (m, a) => ACT2Q1_InitQuestData_6FCE7B40_113c(m, a[0]!),
  '0x6FCE9400': (m, a) => ACT2Q4_InitQuestData_6FCE9400_113c(m, a[0]!),
  '0x6FD06660': (m, a) => ACT3Q0_InitHratliIntroQuestTable_6FD06660_113c(m, a[0]!),
  '0x6FD07CE0': (m, a) => ACT3Q3_InitQuestData_6FD07CE0_113c(m, a[0]!),
  '0x6FD0A080': (m, a) => ACT3Q6_InitQuestData_6FD0A080_113c(m, a[0]!),

  // Part A3 — 10 Skills Hi-VAs
  '0x6FCC06F0': (m, a) =>
    SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FCC1000': (m, a) => AURA_FindClosestUnitInRadius_6FCC1000_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC2F90': (m, a) => SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC3B50': (m, a) => SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c(m, a[0]!, a[1]!),
  '0x6FCD39F0': (m, a) => SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD3B20': (m, a) => SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD4DE0': (m, a) => SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD4FF0': (m, a) => SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD56C0': (m, a) => SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD6840': (m, a) => SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),

  // Part A4 — 9 Remaining Hi-VAs
  '0x6FCC1350': (m, a) => SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCC66E0': (m, a) => MONAI_SiegeRunnerThink_6FCC66E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC6AB0': (m, a) =>
    MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FCDAFF0': (m, a) => ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c(m, a[0]!, a[1]!),
  '0x6FCDB550': (m, a) => ACT4Q3_OnDiabloDeathPortalWarpToAct5_6FCDB550_113c(m, a[0]!),
  '0x6FCE76B0': (m, a) => ACT2Q3_OperateTaintedSunAltar_6FCE76B0_113c(m, a[0]!),
  '0x6FCFE8F0': (m, a) => SUNITDMG_ComputeExperienceGain113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, false, a[5]!),
  '0x6FD10F40': (m, a) => PARTY_ToggleLootPermission_6FD10F40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD11130': (m, a) => PARTY_SetOrClearPlayerHostility_6FD11130_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),

  // Part B1 — Path & Missile Cluster (8 Reserved Lo-VAs)
  '0x6FC8F930': (m, a) => MISSILE_CreateServerProjectile113c(m, a[0]!, a[1]!),
  '0x6FC656B0': (m, a) =>
    SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB5040': (m, a) => SKILLS_SrvDo_SpawnChargedNovaOnTarget_6FCB5040_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC5B210': (m, a) => MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5C5B0': (m, a) => MISSILES_SrvHit_SpawnScaledBurstSubMissiles_6FC5C5B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC2D370': (m, a) => SKILLS_SrvDo005_PerpendicularLineMissiles_6FC2D370_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC2D5D0': (m, a) =>
    SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC6D040': (m, a) => SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),

  // Part B2 — 9 Stack-local m.alloc Lo-VAs
  '0x6FCB2A60': (m, a) =>
    SKILLS_RollHitAndAllocProgressiveChargeCombat_6FCB2A60_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCB5690': (m, a) => SKILLS_SrvDo_AllocProgressiveChargeAttack_6FCB5690_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB2CC0': (m, a) => SKILLS_RadialAvoidAndApplyDamageCallback_6FCB2CC0_113c(m, a[0]!, a[1]!),
  '0x6FCB3040': (m, a) => SKILLS_ApplyRadialDamageCallback_6FCB3040_113c(m, a[0]!, a[1]!),
  '0x6FCB0560': (m, a) => NPCS_UpdateTownVendorSlotsOnPlayerLeave_6FCB0560_113c(m, a[0]!, a[1]!),
  '0x6FCB8E30': (m, a) => SKILLS_FindClosestTargetInRadius3_6FCB8E30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCB2770': (m, a) =>
    SKILLS_SrvDo_ApplyDirectDamageAndKnockbackRoll_6FCB2770_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB3BC0': (m, a) =>
    SKILLS_SrvDo_SpawnChargeScaledClusterMissiles_6FCB3BC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB4970': (m, a) =>
    SKILLS_SrvDo_SpawnChargeScaledAreaRainMissiles_6FCB4970_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),

  // Part B3 — 3 Classic Item Quality Roll Lo-VAs
  '0x6FC2EE90': (m, a) => ITEMS_RollItemQualityOnCreatedItem_6FC2EE90_113c(m, a[0]!, a[1]!),
  '0x6FC304F0': (m, a) => ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC30730': (m, a) => ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c(m, a[0]!, a[1]!, a[2]!),

  // Part B4 — 25 High-ROI Wave-W Bug-Unlocked Lo-VAs & Extras
  '0x6FC8BD60': (m, a) => OBJ_TeleportPlayerToRoomPad_6FC8BD60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC7FB50': (m, a) => ACT5Q5_InitQuestData_6FC7FB50_113c(m, a[0]!),
  '0x6FC7D5C0': (m, a) => ACT5Q4_InitQuestData_6FC7D5C0_113c(m, a[0]!),
  '0x6FC88060': (m, a) => ACT1Q6_InitQuestData_6FC88060_113c(m, a[0]!),
  '0x6FC847B0': (m, a) => ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c(m, a[0]!, a[1]!),
  '0x6FC52790': (m, a) => OBJECTS_PopulateRoomEdgeObjectsMode1_6FC52790_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC527B0': (m, a) => OBJECTS_PopulateRoomEdgeObjectsMode0_6FC527B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC50E50': (m, a) => OBJECTS_TrySpawnTargetSpotObject67_6FC50E50_113c(m, a[0]!, a[1]!),
  '0x6FC522B0': (m, a) =>
    OBJECTS_SpawnPresetTorchOrBrazier_6FC522B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC531B0': (m, a) =>
    OBJECTS_SpawnPresetBrazierOrTorch244_6FC531B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC3EE50': (m, a) => MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC4BE20': (m, a) => PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c(m, a[0]!),
  '0x6FC7DEF0': (m, a) => ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c(m, a[0]!),
  '0x6FC6AD80': (m, a) => CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c(m, a[0]!, a[1]!),
  '0x6FC4EF50': (m, a) => OBJECTS_InitFn57_InitSpecialChest_6FC4EF50_113c(m, a[0]!),
  '0x6FC4A2D0': (m, a) => GAME_CommitGlobalGameSlot_6FC4A2D0_113c(m, a[0]!, a[1]!),
  '0x6FC651B0': (m, a) =>
    SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCB3110': (m, a) => SKILLS_SrvDo_DragonTailFireSplash_6FCB3110_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC5F6D0': (m, a) => MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c(m, a[0]!, a[1]!),
  '0x6FC2CA20': (m, a) => SKILLS_SrvDo004_NihlathakCorpseExplosion_6FC2CA20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC476D0': (m, a) => SKILLS_SrvDo_FindItemCorpseDrop_6FC476D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC448A0': (m, a) =>
    MONUMOD_InitBossAndMinionPackUMods_6FC448A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC44B70': (m, a) => MONUMOD_PromoteToRandomBossOrChampion_6FC44B70_113c(m, a[0]!, a[1]!),
  '0x6FCBD230': (m, a) => AI_InitMonsterAiThinkFn113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCE9CB0': (m, a) => ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c(m, a[0]!, a[1]!, undefined, a[2]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface K6Fix3VectorRecord {
  va: string
  name: string
  caseIdx: number
  label: string
  tsArgs: number[]
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

const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_SETUP_BASE = 0x30020000
const HEAP_BASE = 0x40000000
const GAME_SLOTS_BASE = 0x6fd30c04
const GAME_SLOTS_LEN = 0x20
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

function canonicalizeStackPtrsInHeap(bytes: Uint8Array): Uint8Array {
  const copy = bytes.slice()
  const dv = new DataView(copy.buffer, copy.byteOffset, copy.byteLength)
  for (let off = 0; off + 4 <= copy.length; off += 4) {
    const v = dv.getUint32(off, true) >>> 0
    if (v >= 0x7e000000 && v < 0x80000000) {
      dv.setUint32(off, 0x7e000000, true)
    }
  }
  return copy
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
  includeGameSlots: boolean,
): MemRunRecord[] {
  const out: MemRunRecord[] = []
  extractMemRunsRange(mem, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  if (includeGameSlots) {
    extractMemRunsRange(mem, GAME_SLOTS_BASE, GAME_SLOTS_BASE + GAME_SLOTS_LEN, out)
  }
  return out
}

function loadVectors(): K6Fix3VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-fix3/k6-fix3-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6Fix3VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6Fix3VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Fix 3 real-DLL D2Game.dll Hi-VA Closer & Round-3 parity vectors', () => {
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
    // Hydrate SGPT_ITEMS_LINKER_PTR_VA (0x6FDEFF6C) from loaded Items.txt rows (mirrors emitter discover_table_ids).
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
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.fill(GAME_SLOTS_BASE, GAME_SLOTS_LEN, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 92 emitted real-DLL D2Game.dll VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      expect(num).toBeGreaterThanOrEqual(0x6fc20000)
      expect(num).toBeLessThanOrEqual(0x6fd1ffff)
      expect(cases.length).toBeGreaterThanOrEqual(3)
      expect(DISPATCH_BY_VA[va]).toBeTypeOf('function')
    }
  })

  for (const [va, cases] of VECTORS_BY_VA.entries()) {
    const fnName = cases[0]!.name
    it(`${va} ${fnName} (${cases.length} real-DLL cases)`, () => {
      const fn = DISPATCH_BY_VA[va]
      expect(fn).toBeDefined()
      const includeGameSlots = va === '0x6FC4A2D0'

      for (const vec of cases) {
        mem.resetOverlay()
        const setupTop = Number.parseInt(vec.setupTop, 16) >>> 0
        if (setupTop > STAGE_SETUP_BASE) {
          mem.fill(STAGE_SETUP_BASE, setupTop - STAGE_SETUP_BASE, 0)
        }
        if (includeGameSlots) {
          mem.fill(GAME_SLOTS_BASE, GAME_SLOTS_LEN, 0)
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

        const actualPostMem = extractStageRuns(mem, setupTop, includeGameSlots)
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
          const actualHeapBytes = canonicalizeStackPtrsInHeap(
            mem.readBytes(HEAP_BASE, expectedHeapTop - HEAP_BASE),
          )
          const actualHeapHex = bytesToHex(actualHeapBytes)
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
