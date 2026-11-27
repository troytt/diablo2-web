/**
 * [K6] Fix 2 — Real-DLL D2Game.dll Kernel Parity Round-2 & MonAI Unlock Suite.
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-fix2/k6-fix2-d2game-emitter.c
 * against the fixed TypeScript v1.13c kernel in src/d2kern-113c/game/*, verifying 100%
 * bit-exact agreement on return values, Fog.#10024 assertion line numbers, staged arena
 * memory mutations, heap allocations, and va-trace-113c runtime hits.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { AI_CastSkillMode14_113c } from '../../../src/d2kern-113c/game/ai-fallen-113c'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import { PLAYER_FreePlayerCorpses_6FC579E0_113c } from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import { PLAYER_StartModeCast113c } from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import { DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c } from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import { PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c } from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import { ACT4Q2_InitQuestData_6FCDAD40_113c } from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  AI_RunTowardTarget_6FD12F00_113c,
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  AI_StartModeAtCoordsStep0_6FD11FA0_113c,
  AI_StartModeAtCoordsStep1_6FD11FF0_113c,
  AI_WalkTowardTarget_6FD12F30_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import {
  ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c,
  ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import { PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c } from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c,
  MONAI_MeleeAndRangedSkillThink_6FCC6530_113c,
  MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c,
  MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c,
  MONAI_UnburrowThink_6FCC59B0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b7-113c'
import {
  AI_CastSkillWithModeRandomScatter_6FD12420_113c,
  AI_CircleStrafeTarget_6FD126B0_113c,
  AI_RunFleeFromUnit_6FD12C10_113c,
  AI_RunWanderAroundUnit_6FD12750_113c,
  AI_WalkToLeashDistanceFromUnit_6FD11C30_113c,
} from '../../../src/d2kern-113c/game/k2-w5b10-113c'
import {
  ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c,
  SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c,
  SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c,
} from '../../../src/d2kern-113c/game/k2-w5b7-113c'
import {
  AIBAAL_CombatThink_6FCC9610_113c,
  AIBAAL_ThroneRoomThink_6FCD8610_113c,
  MONAI_NihlathakThink_6FCC7580_113c,
  MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c,
  MONAI_WorldstoneMinionThink_6FCC7410_113c,
  SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c,
  SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c,
} from '../../../src/d2kern-113c/game/k2-w7b3-113c'
import { SUNIT_FreeUnit113c } from '../../../src/d2kern-113c/game/replay-final11-113c'
import { AI_InitShadowMasterSkillSlot113c } from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c'
import {
  AI_InitClearFreezeAndStall_6FC36060_113c,
  AI_ThinkMeleeOrApproach7_6FC372B0_113c,
  AI_ThinkSingleStrikeTurret_6FC360B0_113c,
  AI_ThinkStaticTrapAttack_6FC36190_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  AI_Think_BurrowingScarabOrFrog_6FCA9C30_113c,
  AI_Think_Raven_6FCCA1D0_113c,
  AI_Think_SandMaggot_6FCA9870_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import { AI_MercOrShadowWarriorThink_6FCCC8E0_113c } from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import { AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c } from '../../../src/d2kern-113c/game/k2-w2b3-113c'
import {
  AI_ThinkBloodHawk_6FC376B0_113c,
  AI_ThinkBloodLordFrenzy_6FC36270_113c,
  AI_ThinkClawViper_6FC38CE0_113c,
  AI_ThinkDelayedMeleeAttack_6FC38360_113c,
  AI_ThinkDualAttack95Pct_6FC381A0_113c,
  AI_ThinkGiantSpider_6FC377E0_113c,
  AI_ThinkThornedHulk_6FC379A0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import {
  AI_StepTurnAndCastSkill4_6FC3C1E0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import {
  AI_AlternatingMeleeOrApproach_6FC9F9A0_113c,
  AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c,
  AI_BasicMeleeOrStepApproach_6FC9D7C0_113c,
  AI_CardinalBeamTurret_6FC9C910_113c,
  AI_CastSkillAtRandomOffsetAroundSelf_6FC9D400_113c,
  AI_ComboMeleeAndDualSkill_6FC9F760_113c,
  AI_InitialStall5ThenMeleeApproach_6FC9E4D0_113c,
  AI_MeleeOrDualSkillPathType7_6FC9FE60_113c,
  AI_MeleeOrPathType13Approach_6FC9DF00_113c,
  AI_MeleeStrafeOrStepApproach_6FC9F370_113c,
  AI_MosquitoNestSpawner_6FC9CFD0_113c,
  AI_OneShotSkillTrap_6FC9D310_113c,
  AI_PackBroadcastOrMeleeApproach_6FC9D910_113c,
  AI_RegeneratingMultiStateMonster_6FCA0450_113c,
  AI_StationaryMeleeTrap_6FC9BF50_113c,
  AI_TentacleMeleeAttack_6FC9C580_113c,
  AI_ThreeStageSuicideMinion_6FC9F5A0_113c,
  AI_WallTrapVerticalX_6FC9C460_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import {
  AI_ThinkPackIdlePatrol_6FC373D0_113c,
  AI_ThinkPutridDefiler_6FC389E0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  AI_ThinkMeleeBasic_6FCA1F50_113c,
  AI_ThinkMonsterSpawnerNest_6FCA7A60_113c,
  AI_ThinkSimpleMeleeVariantA_6FCA2430_113c,
  AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  AI_AttackWestOffsetThenDie_6FCC4B90_113c,
  AI_TickAmbientMode8OrStall30_6FCC58D0_113c,
  AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c'
import { AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c } from '../../../src/d2kern-113c/game/k2-w4b8-113c'
import { AI_Thinker_MeleeRangedApproachStall_6FC38A90_113c } from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import { AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c } from '../../../src/d2kern-113c/game/k2-w5b3-113c'
import {
  MONAI_AuraKnightOrZealotThink_6FCA9430_113c,
  MONAI_BaalThroneThink_6FCC8430_113c,
  MONAI_BlunderboreThink_6FCA3CE0_113c,
  MONAI_FetishShamanOrCasterThink_6FCA8D80_113c,
  MONAI_GloamPackLightningDanceThink_6FCA0F20_113c,
  MONAI_OblivionKnightThink_6FCA7E60_113c,
  MONAI_SandMaggotThink_6FCA1C80_113c,
  MONAI_SuccubusThink_6FCA8A70_113c,
  MONAI_TentacleBeastHeadThink_6FCA43F0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import { AI_ThinkSuccubus_6FC3A9F0_113c } from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import {
  MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c,
  MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c,
  MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  AI_ThinkBloodLord_6FCA8810_113c,
  AI_ThinkChargeStateIconMelee_6FCA4A90_113c,
  AI_ThinkFetishMelee_6FC9ED90_113c,
  AI_ThinkHomeLeashedCaster_6FC39E70_113c,
  AI_ThinkLowLifeFleeCaster_6FC9E070_113c,
  AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c,
  AI_ThinkOblivionKnightCaster_6FCA4DB0_113c,
  AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c,
  AI_ThinkPackRegroupSkirmisher_6FC3B780_113c,
  AI_ThinkPutridDefiler_6FC3A550_113c,
  AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c,
  AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c,
  AI_ThinkSlinger_6FCA74A0_113c,
  AI_ThinkThornHulk_6FCA64A0_113c,
  AI_ThinkTownRogueGuard_6FC39740_113c,
  AI_ThinkVampire_6FCA6900_113c,
  AI_ThinkWillowisp_6FCA7010_113c,
  AI_ThinkZakarumHealerOrPriest_6FC39080_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import { AI_Think_Overlord_6FC37CB0_113c } from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import { MONAI_DarkWandererThink_6FCC6E60_113c } from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import { AI_GreaterMummyThink_6FCA8380_113c } from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  // Group 1 — Round-2 Bug-Unlocked & Wave-R Residual VAs
  '0x6FC81540': (m, a) => ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c(m, a[0]!, a[1]!),
  '0x6FC81A80': (m, a) => ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c(m, a[0]!, a[1]!),
  '0x6FC579E0': (m, a) => PLAYER_FreePlayerCorpses_6FC579E0_113c(m, a[0]!, a[1]!),
  '0x6FCEFE40': (m, a) => PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCDAD40': (m, a) => ACT4Q2_InitQuestData_6FCDAD40_113c(m, a[0]!),
  '0x6FCD5600': (m, a) => SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCD4C20': (m, a) => SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCFAB00': (m, a) => SUNITDMG_OpenMatchingObjectAtUnitPos_6FCFAB00_113c(m, a[0]!, a[1]!),
  '0x6FCFBD90': (m, a) => SUNITDMG_OnStunOrFreezeEndNeutralCallback_6FCFBD90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF2840': (m, a) => ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCCD6C0': (m, a) => ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC73B40': (m, a) =>
    PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FD020A0': (m, a) => SUNIT_FreeUnit113c(m, a[0]!, a[1]!),
  '0x6FD019C0': (m, a) =>
    DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC98A90': (m, a) => PLAYER_StartModeCast113c(m, a[0]!, a[1]!, 0, '1HS', true),

  // Group 2 — Core MonAI MONSTER_StartMode113c Helpers
  '0x6FD11C30': (m, a) => AI_WalkToLeashDistanceFromUnit_6FD11C30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD11FA0': (m, a) => AI_StartModeAtCoordsStep0_6FD11FA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD11FF0': (m, a) => AI_StartModeAtCoordsStep1_6FD11FF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD12120': (m, a) => AI_CastSkillMode14_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD121E0': (m, a) => AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD12420': (m, a) => AI_CastSkillWithModeRandomScatter_6FD12420_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD126B0': (m, a) => AI_CircleStrafeTarget_6FD126B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD12750': (m, a) => AI_RunWanderAroundUnit_6FD12750_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD12C10': (m, a) => AI_RunFleeFromUnit_6FD12C10_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD12F00': (m, a) => AI_RunTowardTarget_6FD12F00_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD12F30': (m, a) => AI_WalkTowardTarget_6FD12F30_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),

  // Group 3 — 91 Un-Hit MonAI Thinkers Unlocked by Wave R / Round-2 Fixes
  '0x6FC355C0': (m, a) => AI_InitShadowMasterSkillSlot113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC36060': (m, a) => AI_InitClearFreezeAndStall_6FC36060_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC360B0': (m, a) => AI_ThinkSingleStrikeTurret_6FC360B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC36190': (m, a) => AI_ThinkStaticTrapAttack_6FC36190_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC36270': (m, a) => AI_ThinkBloodLordFrenzy_6FC36270_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC372B0': (m, a) => AI_ThinkMeleeOrApproach7_6FC372B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC373D0': (m, a) => AI_ThinkPackIdlePatrol_6FC373D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC376B0': (m, a) => AI_ThinkBloodHawk_6FC376B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC377E0': (m, a) => AI_ThinkGiantSpider_6FC377E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC379A0': (m, a) => AI_ThinkThornedHulk_6FC379A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC37CB0': (m, a) => AI_Think_Overlord_6FC37CB0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC381A0': (m, a) => AI_ThinkDualAttack95Pct_6FC381A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC38360': (m, a) => AI_ThinkDelayedMeleeAttack_6FC38360_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC389E0': (m, a) => AI_ThinkPutridDefiler_6FC389E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC38A90': (m, a) => AI_Thinker_MeleeRangedApproachStall_6FC38A90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC38CE0': (m, a) => AI_ThinkClawViper_6FC38CE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC39080': (m, a) => AI_ThinkZakarumHealerOrPriest_6FC39080_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC39740': (m, a) => AI_ThinkTownRogueGuard_6FC39740_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC39E70': (m, a) => AI_ThinkHomeLeashedCaster_6FC39E70_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3A550': (m, a) => AI_ThinkPutridDefiler_6FC3A550_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3A9F0': (m, a) => AI_ThinkSuccubus_6FC3A9F0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3B2F0': (m, a) => AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3B780': (m, a) => AI_ThinkPackRegroupSkirmisher_6FC3B780_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3C1E0': (m, a) => AI_StepTurnAndCastSkill4_6FC3C1E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9BF50': (m, a) => AI_StationaryMeleeTrap_6FC9BF50_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9C460': (m, a) => AI_WallTrapVerticalX_6FC9C460_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9C580': (m, a) => AI_TentacleMeleeAttack_6FC9C580_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9C8C0': (m, a) => AI_ClearState12InitThinkFnAndStall1_6FC9C8C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9C910': (m, a) => AI_CardinalBeamTurret_6FC9C910_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9CE40': (m, a) => AI_ThinkWakeOrUnburrowSkill_6FC9CE40_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9CFD0': (m, a) => AI_MosquitoNestSpawner_6FC9CFD0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9D310': (m, a) => AI_OneShotSkillTrap_6FC9D310_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9D400': (m, a) => AI_CastSkillAtRandomOffsetAroundSelf_6FC9D400_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9D7C0': (m, a) => AI_BasicMeleeOrStepApproach_6FC9D7C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9D910': (m, a) => AI_PackBroadcastOrMeleeApproach_6FC9D910_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9DF00': (m, a) => AI_MeleeOrPathType13Approach_6FC9DF00_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9E070': (m, a) => AI_ThinkLowLifeFleeCaster_6FC9E070_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9E4D0': (m, a) => AI_InitialStall5ThenMeleeApproach_6FC9E4D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9E640': (m, a) => AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9ED90': (m, a) => AI_ThinkFetishMelee_6FC9ED90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9F370': (m, a) => AI_MeleeStrafeOrStepApproach_6FC9F370_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9F5A0': (m, a) => AI_ThreeStageSuicideMinion_6FC9F5A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9F760': (m, a) => AI_ComboMeleeAndDualSkill_6FC9F760_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9F9A0': (m, a) => AI_AlternatingMeleeOrApproach_6FC9F9A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9FE60': (m, a) => AI_MeleeOrDualSkillPathType7_6FC9FE60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA0450': (m, a) => AI_RegeneratingMultiStateMonster_6FCA0450_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA0B00': (m, a) => AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA0F20': (m, a) => MONAI_GloamPackLightningDanceThink_6FCA0F20_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA1C80': (m, a) => MONAI_SandMaggotThink_6FCA1C80_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA1F50': (m, a) => AI_ThinkMeleeBasic_6FCA1F50_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA20D0': (m, a) => AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA2430': (m, a) => AI_ThinkSimpleMeleeVariantA_6FCA2430_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA2990': (m, a) => AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA3CE0': (m, a) => MONAI_BlunderboreThink_6FCA3CE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA43F0': (m, a) => MONAI_TentacleBeastHeadThink_6FCA43F0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA4A90': (m, a) => AI_ThinkChargeStateIconMelee_6FCA4A90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA4DB0': (m, a) => AI_ThinkOblivionKnightCaster_6FCA4DB0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA51E0': (m, a) => MONAI_SkirmishApproachFleeAttackThink_6FCA51E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA64A0': (m, a) => AI_ThinkThornHulk_6FCA64A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA6900': (m, a) => AI_ThinkVampire_6FCA6900_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA7010': (m, a) => AI_ThinkWillowisp_6FCA7010_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA74A0': (m, a) => AI_ThinkSlinger_6FCA74A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA7A60': (m, a) => AI_ThinkMonsterSpawnerNest_6FCA7A60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA7E60': (m, a) => MONAI_OblivionKnightThink_6FCA7E60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA8380': (m, a) => AI_GreaterMummyThink_6FCA8380_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA8810': (m, a) => AI_ThinkBloodLord_6FCA8810_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA8A70': (m, a) => MONAI_SuccubusThink_6FCA8A70_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA8D80': (m, a) => MONAI_FetishShamanOrCasterThink_6FCA8D80_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA9430': (m, a) => MONAI_AuraKnightOrZealotThink_6FCA9430_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA9870': (m, a) => AI_Think_SandMaggot_6FCA9870_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA9C30': (m, a) => AI_Think_BurrowingScarabOrFrog_6FCA9C30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC4B90': (m, a) => AI_AttackWestOffsetThenDie_6FCC4B90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC4FD0': (m, a) => AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC5580': (m, a) => AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC58D0': (m, a) => AI_TickAmbientMode8OrStall30_6FCC58D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC59B0': (m, a) => MONAI_UnburrowThink_6FCC59B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC5C80': (m, a) => MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC5D70': (m, a) => MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC6530': (m, a) => MONAI_MeleeAndRangedSkillThink_6FCC6530_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC6E60': (m, a) => MONAI_DarkWandererThink_6FCC6E60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC7410': (m, a) => MONAI_WorldstoneMinionThink_6FCC7410_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC7580': (m, a) => MONAI_NihlathakThink_6FCC7580_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC7A10': (m, a) => MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC8270': (m, a) => MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC8350': (m, a) => MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC8430': (m, a) => MONAI_BaalThroneThink_6FCC8430_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCC9610': (m, a) => AIBAAL_CombatThink_6FCC9610_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCCA1D0': (m, a) => AI_Think_Raven_6FCCA1D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCCC8E0': (m, a) => AI_MercOrShadowWarriorThink_6FCCC8E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD78A0': (m, a) => AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCD8610': (m, a) => AIBAAL_ThroneRoomThink_6FCD8610_113c(m, a[0]!, a[1]!, a[2]!),
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

interface K6Fix2VectorRecord {
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

function loadVectors(): K6Fix2VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-fix2/k6-fix2-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6Fix2VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6Fix2VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Fix 2 real-DLL D2Game.dll Round-2 parity & MonAI unlock vectors', () => {
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
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(STAGE_BASE, STAGE_FIXED_SIZE, 0)
    mem.commitOverlayToBase()
  })

  it('covers all emitted real-DLL D2Game.dll VAs (>= 3 cases each)', () => {
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
