/**
 * Milestone #37 [K6] Wave 14 — Real-DLL D2Game.dll Lo-VA Part 5 (0x6FC20000..0x6FCBFFFF)
 * Differential Vector Suite.
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-w14/k6-w14-d2game-emitter.c
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

import { QUESTS_RefreshInventoryQuestItems_6FC54760_113c } from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import { ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c } from '../../../src/d2kern-113c/game/k2-w2b1-113c'
import {
  ACT5Q1_SeqFilter_6FC76D10_113c,
  ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c,
  ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c,
  ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c,
  ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c,
  ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c,
  ACT5Q5_SeqFilter_6FC76BD0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import {
  ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c,
  QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c,
  QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import {
  ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c,
  ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c,
  ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c,
  ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c,
  ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c,
  ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import { ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c } from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c,
  ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c,
  ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c,
  ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import {
  QUESTS_Act1AndarielOnDeath_6FC7B690_113c,
  QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import {
  ACT1Q2_OnBloodRavenKilled_6FC85620_113c,
  ACT1Q5_OnAndarielKilled_6FC88B90_113c,
  ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c,
  ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c,
  ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import { ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c } from '../../../src/d2kern-113c/game/k2-w8b1-113c'
import {
  ACT1Q1_OnMonsterKilled_6FC85760_113c,
  ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70_113c,
  ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import { ACT1Q4_OperateInifussTree_6FC85B40_113c } from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import {
  ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c,
  ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  REGPOP_SpawnAmbientPack113c,
  type ActRoomsCallees113c,
} from '../../../src/d2kern-113c/game/act-rooms-113c'
import { OBJECTS_OperateContainer_6FC56B90_113c } from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import { OBJ_OperateFn_SkillShrine_6FC8AB60_113c } from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c,
  PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot_6FC915E0_113c,
  PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c,
  SKILLS_SrvDo_MonsterConvert_6FC71340_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c,
  OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c,
  OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c,
  SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import { REGPOP_SpawnMonsterFormation_6FC671E0_113c } from '../../../src/d2kern-113c/game/k2-w3b4-113c'
import {
  OBJ_ApplyShrineAuraStatList_6FC8A960_113c,
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c,
  OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c,
  OBJ_OperateBreakawayObject_6FC8D8F0_113c,
  OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  OBJ_OperateFn28_Urn_6FC8D7B0_113c,
  OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  OBJ_OperateAuraStatShrine_6FC8ABB0_113c,
  OBJ_OperateCombatShrine_6FC8ACE0_113c,
  OBJ_OperateStaminaShrine_6FC8AC30_113c,
  OBJ_OperateTomeOrScrollStand_6FC8B340_113c,
  OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c,
  OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c,
  PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import { OBJ_UseWellHealPlayerAndPets_6FC8A560_113c } from '../../../src/d2kern-113c/game/k2-w5b2-113c'
import {
  OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c,
  OBJECTS_OperatePortalShrine_6FC8B9B0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import {
  OBJ_OperateChestAndSparkyChest_6FC8F040_113c,
  OBJ_ThinkEventSparkyChest_6FC8E150_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c'
import { AI_SelectBaalThroneSpawnClassId113c } from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c'
import { AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c } from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import { PLRTRADE_WalkTradeItemList_6FC8FFA0_113c } from '../../../src/d2kern-113c/game/k2-w2b3-113c'
import { SKILLS_DispatchSrvDoFunc_6FCBE420_113c } from '../../../src/d2kern-113c/game/k2-w2b4-113c'
import {
  AI_ThinkMinionSpawner_6FC37BC0_113c,
  SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import {
  MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c,
  MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c,
  MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c,
  MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c,
  MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c,
  MISSILES_SrvDmg12_Nova64RingSubMissiles_6FC5C700_113c,
  MISSILES_SrvDmg13_PoisonExplosionCloud_6FC5C990_113c,
  MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c,
  MISSILES_SrvDo12_RandomWalkStepProjectile_6FC5F890_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import { SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c } from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import { AI_WallTrapHorizontalY_6FC9C340_113c } from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import { SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c } from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c,
  SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c,
} from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c,
  PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import { MONUMOD_KnockBeltPotionToGround_6FC44440_113c } from '../../../src/d2kern-113c/game/k2-w8b1-113c'

const ACT_ROOMS_CALLEES: ActRoomsCallees113c = {
  refreshRoomUnits: () => { throw new Error('unexpected refreshRoomUnits') },
  objects: {} as ActRoomsCallees113c['objects'],
  initAmbientMonster: () => { throw new Error('unexpected initAmbientMonster') },
  presets: {} as ActRoomsCallees113c['presets'],
  regpop: {},
}

const DISPATCH_BY_VA: Record<string, (m: SparseMemory113c, a: readonly number[]) => number> = {
  // Batch 1: Quests (38 VAs)
  '0x6FC799D0': (m, a) => (ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC78DA0': (m, a) => (ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c(m, a[0]!) as number) | 0,
  '0x6FC76D10': (m, a) => (ACT5Q1_SeqFilter_6FC76D10_113c(m, a[0]!) as number) | 0,
  '0x6FC806E0': (m, a) => (QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(m, a[0]!) as number) | 0,
  '0x6FC76BD0': (m, a) => (ACT5Q5_SeqFilter_6FC76BD0_113c(m, a[0]!) as number) | 0,
  '0x6FC801B0': (m, a) => (QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(m, a[0]!) as number) | 0,
  '0x6FC7CF70': (m, a) => { ACT5Q3_SpawnFrozenAnyaMonsterIfNeeded_6FC7CF70_113c(m, a[0]!); return 0 },
  '0x6FC7C1F0': (m, a) => { ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC88D70': (m, a) => (ACT1Q5_OnForgottenTowerTomeOperated_6FC88D70_113c(m, a[0]!) as number) | 0,
  '0x6FC85A70': (m, a) => { ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7E000': (m, a) => (ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC88AB0': (m, a) => { ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c(m, a[0]!); return 0 },
  '0x6FC79450': (m, a) => { ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7C2A0': (m, a) => (ACT5Q2_SpawnBarbarianSoldiersInPrison_6FC7C2A0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7DDF0': (m, a) => (ACT5Q3_TryUseThawPotionOnFrozenAnya_6FC7DDF0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC54760': (m, a) => { QUESTS_RefreshInventoryQuestItems_6FC54760_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7B690': (m, a) => { QUESTS_Act1AndarielOnDeath_6FC7B690_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7E0E0': (m, a) => { ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC77900': (m, a) => (ACT5Q4_CheckPlayerNearNihlathakRoom_6FC77900_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7AE20': (m, a) => { ACT5Q4_OnPlayerEnteredOrInitState_6FC7AE20_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7C480': (m, a) => (ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC85620': (m, a) => { ACT1Q2_OnBloodRavenKilled_6FC85620_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC85D40': (m, a) => (ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c(m, a[0]!) as number) | 0,
  '0x6FC87320': (m, a) => (ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7C850': (m, a) => { QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c(m, a[0]!); return 0 },
  '0x6FC88B90': (m, a) => { ACT1Q5_OnAndarielKilled_6FC88B90_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7A820': (m, a) => { ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c(m, a[0]!); return 0 },
  '0x6FC7D380': (m, a) => (ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC7C690': (m, a) => { ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7D760': (m, a) => (ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC7EC30': (m, a) => { ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c(m, a[0]!); return 0 },
  '0x6FC85B40': (m, a) => (ACT1Q4_OperateInifussTree_6FC85B40_113c(m, a[0]!) as number) | 0,
  '0x6FC7CD50': (m, a) => { ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c(m, a[0]!); return 0 },
  '0x6FC7A310': (m, a) => { ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC85760': (m, a) => { ACT1Q1_OnMonsterKilled_6FC85760_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC85E90': (m, a) => { ACT1Q3_SpawnCairnStonePortalLightning_6FC85E90_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC7B9B0': (m, a) => { ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC864F0': (m, a) => { ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c(m, a[0]!); return 0 },

  // Batch 2: DRLG/Room/SUnit (27 VAs)
  '0x6FC4F4B0': (m, a) => (OBJRGN_PopulateRoomRandomItemDropsGrid_6FC4F4B0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC4FA90': (m, a) => { OBJECTS_PopulateRoomEdgeObjects_6FC4FA90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC50150': (m, a) => (OBJECTS_PopulateCrateClustersInRoom_6FC50150_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC50800': (m, a) => (OBJECTS_PopulateBarrelClustersInRoom_6FC50800_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC56B90': (m, a) => (OBJECTS_OperateContainer_6FC56B90_113c(m, a[0]!) as number) | 0,
  '0x6FC671E0': (m, a) => (REGPOP_SpawnMonsterFormation_6FC671E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC67660': (m, a) => { REGPOP_SpawnAmbientPack113c(m, a[0]!, a[1]!, a[2]!, a[3]!, ACT_ROOMS_CALLEES); return 0 },
  '0x6FC89E50': (m, a) => (OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC8A560': (m, a) => (OBJ_UseWellHealPlayerAndPets_6FC8A560_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC8A7A0': (m, a) => (OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c(m, a[0]!) as number) | 0,
  '0x6FC8A960': (m, a) => (OBJ_ApplyShrineAuraStatList_6FC8A960_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) as number) | 0,
  '0x6FC8AB60': (m, a) => { OBJ_OperateFn_SkillShrine_6FC8AB60_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8ABB0': (m, a) => (OBJ_OperateAuraStatShrine_6FC8ABB0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC8AC30': (m, a) => { OBJ_OperateStaminaShrine_6FC8AC30_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8ACE0': (m, a) => { OBJ_OperateCombatShrine_6FC8ACE0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8B340': (m, a) => (OBJ_OperateTomeOrScrollStand_6FC8B340_113c(m, a[0]!) as number) | 0,
  '0x6FC8B570': (m, a) => (OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC8B930': (m, a) => { OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8B9B0': (m, a) => { OBJECTS_OperatePortalShrine_6FC8B9B0_113c(m, a[0]!); return 0 },
  '0x6FC8CE10': (m, a) => (OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c(m, a[0]!) as number) | 0,
  '0x6FC8D7B0': (m, a) => (OBJ_OperateFn28_Urn_6FC8D7B0_113c(m, a[0]!) as number) | 0,
  '0x6FC8D8F0': (m, a) => (OBJ_OperateBreakawayObject_6FC8D8F0_113c(m, a[0]!) as number) | 0,
  '0x6FC8DD60': (m, a) => { OBJ_ScheduleObjectTrapEventOrSound_6FC8DD60_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8E150': (m, a) => { OBJ_ThinkEventSparkyChest_6FC8E150_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8E4E0': (m, a) => { OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC8EDB0': (m, a) => (OBJ_OperateFn_SparklyChestOrTrapSpawner_6FC8EDB0_113c(m, a[0]!) as number) | 0,
  '0x6FC8F040': (m, a) => (OBJ_OperateChestAndSparkyChest_6FC8F040_113c(m, a[0]!) as number) | 0,

  // Batch 3: Skills, Missiles, Combat, Trade & MonAI (28 VAs)
  '0x6FC2D850': (m, a) => { SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC2DE70': (m, a) => (SKILLS_SrvDo139_ChanneledHoseTick_6FC2DE70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC44440': (m, a) => { MONUMOD_KnockBeltPotionToGround_6FC44440_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC45AD0': (m, a) => { MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0 },
  '0x6FC47C90': (m, a) => (SKILLS_SrvDo_SpawnCorpseMissile_6FC47C90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC5BED0': (m, a) => (MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5C030': (m, a) => (MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5C260': (m, a) => (MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5C700': (m, a) => (MISSILES_SrvDmg12_Nova64RingSubMissiles_6FC5C700_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5C990': (m, a) => (MISSILES_SrvDmg13_PoisonExplosionCloud_6FC5C990_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5D320': (m, a) => (MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC5D680': (m, a) => (MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!) as number) | 0,
  '0x6FC5EC10': (m, a) => (MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC5F890': (m, a) => (MISSILES_SrvDo12_RandomWalkStepProjectile_6FC5F890_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC67900': (m, a) => (PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FC709E0': (m, a) => { SKILLS_ConvertMonsterAndScheduleExpire_6FC709E0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!); return 0 },
  '0x6FC71340': (m, a) => (SKILLS_SrvDo_MonsterConvert_6FC71340_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB2CF0': (m, a) => (SKILLS_SrvDo_ApplyChargeScaledRadialSkillDamage_6FCB2CF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCB3340': (m, a) => (SKILLS_SrvDo_ExecuteEventsAndTargetRadialDamage_6FCB3340_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) as number) | 0,
  '0x6FCBE420': (m, a) => (SKILLS_DispatchSrvDoFunc_6FCBE420_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) as number) | 0,
  '0x6FC8FFA0': (m, a) => (PLRTRADE_WalkTradeItemList_6FC8FFA0_113c(m, a[0]!) as number) | 0,
  '0x6FC90FB0': (m, a) => (PLRTRADE_SavePlayerInventorySnapshot_6FC90FB0_113c(m, a[0]!, a[1]!) as number) | 0,
  '0x6FC915E0': (m, a) => { PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot_6FC915E0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC916D0': (m, a) => { PLRTRADE_RollbackPlayerItemsToSnapshot_6FC916D0_113c(m, a[0]!, a[1]!); return 0 },
  '0x6FC41590': (m, a) => { AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c(m, a[0]!); return 0 },
  '0x6FC35730': (m, a) => (AI_SelectBaalThroneSpawnClassId113c(m, a[0]!, a[1]!, a[2]!) as number) | 0,
  '0x6FC37BC0': (m, a) => { AI_ThinkMinionSpawner_6FC37BC0_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
  '0x6FC9C340': (m, a) => { AI_WallTrapHorizontalY_6FC9C340_113c(m, a[0]!, a[1]!, a[2]!); return 0 },
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

interface K6W14VectorRecord {
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

function loadVectors(): K6W14VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w14/k6-w14-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W14VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W14VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 14 real-DLL D2Game.dll Lo-VA Part 5 (0x6FC20000..0x6FCBFFFF) differential vectors', () => {
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

  it('covers all 93 net-new real-DLL D2Game.dll VAs strictly in 0x6FC20000..0x6FCBFFFF', () => {
    expect(VECTORS_BY_VA.size).toBe(93)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
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
