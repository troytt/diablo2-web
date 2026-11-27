/**
 * [K6] Wave 15 — Real-DLL D2Game.dll Final Clean Lo-VA Sweeper (0x6FC20000..0x6FCBFFFF).
 *
 * Replays every real-DLL vector emitted by tools/oracle/k6-w15/k6-w15-d2game-emitter.c
 * against the TypeScript v1.13c kernel in src/d2kern-113c/game/*, verifying 100%
 * bit-exact agreement on return values, Fog.#10024 assertion line numbers, staged arena
 * memory mutations, extra D2Game global ranges, heap allocations, and va-trace-113c hits.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { AI_Skeleton113c } from '../../../src/d2kern-113c/game/ai-fallen-113c'
import { GAME_InitSeed113c } from '../../../src/d2kern-113c/game/game-strc'
import {
  AITHINK_Fn146_UberMephistoNoop113c,
  MONSTER_EndModeS3Noop113c,
  PLAYER_SkillModeNoopHandler_00_17_113c,
  PLAYER_SkillModeNoopHandler_01_05_113c,
  PLAYER_SkillModeNoopHandler_04_09_113c,
  PLRTRADE_TradeButtonNoopAction2_113c,
  PLRTRADE_TradeButtonNoopAction3_113c,
} from '../../../src/d2kern-113c/game/k2-combat-core-w1-113c'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  GAME_SetGlobalSeed113c,
  OBJECTS_InitFn05_NoOp113c,
  OBJECTS_LevelHookAlwaysTrue113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c'
import { AI_CastNextPatrolPointSkill_6FC35F90_113c } from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  GAME_LeaveGameCriticalSection_6FC49BA0_113c,
  GAME_ReserveGlobalGameSlot_6FC4A220_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import { MISSILES_SrvDo_ReturnOne_6FC58EC0_113c } from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import { GAMETIME_GetElapsedMilliseconds_6FC72020_113c } from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c'
import {
  PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c,
  PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'
import { SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c } from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c,
  ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c,
  ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c,
  PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  D2Game_6FC91E10_113c,
  D2Game_6FC93BA0_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c,
  PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c,
  PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  ACT1_IntroStatusFilter_6FC80800_113c,
  ACT4_IntroCallback08Noop_6FC80180_113c,
  ACT4_IntroStatusFilter_6FC80170_113c,
} from '../../../src/d2kern-113c/game/k2-w2b1-113c'
import { MONAI_NoOpStub_6FCBC990_113c } from '../../../src/d2kern-113c/game/k2-w2b4-113c'
import {
  AI_ThinkBaalThroneSpawner_6FC35E00_113c,
  AI_ThinkPainWormSpawner_6FC364A0_113c,
  AI_ThinkPatrolAndAttack_6FC36E30_113c,
  ITEMS_RollAutoMagicAffixId_6FC348A0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import {
  AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c,
  GAME_LookupAndLockGameByKey_6FC4AAE0_113c,
  MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import { CLIENTS_AllocAndLinkClient_6FC6A9B0_113c } from '../../../src/d2kern-113c/game/k2-w3b4-113c'
import { GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c } from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import { ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c } from '../../../src/d2kern-113c/game/k2-w3b6-113c'
import {
  OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c,
  OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c,
  OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c'
import {
  AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c,
  AI_FoulCrowNestSpawner_6FC9D170_113c,
  AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c'
import {
  GAME_IsGameNameAvailable_6FC4ABD0_113c,
  ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c,
  ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c,
  ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c,
  ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c,
  ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c,
  ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import { CLIENTS_AppendSaveDataChunk_6FC6A190_113c } from '../../../src/d2kern-113c/game/k2-w4b2-113c'
import {
  GAME_AssignUniqueGameName_6FC4BC90_113c,
  ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c,
  OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c,
  OBJ_OperateFn20_WeaponRack_6FC8B280_113c,
  PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c,
  STORM_TSListArrayResize_6FC22630_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  AI_ThinkBurrowerSpawner_6FCA77B0_113c,
  AI_ThinkChargerRunOrAttack_6FCA2EC0_113c,
  AI_ThinkPackFollowerMelee_6FCA4800_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c,
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
} from '../../../src/d2kern-113c/game/k2-w4b5-113c'
import {
  AI_Thinker_PutridDefiler_6FC38730_113c,
  STORM_TSHashTableGrowAndRehash_6FC222D0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  NPCS_InitGameNpcControl_6FCAFBE0_113c,
  SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c'
import { AI_ThinkCurseCaster_6FC3AF80_113c } from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import { SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c } from '../../../src/d2kern-113c/game/k2-w6b2-113c'
import {
  AI_ThinkFetishShaman_6FCA7BB0_113c,
  AI_ThinkImpregnatedMonster_6FC366D0_113c,
  AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c,
  AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import { ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c } from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import { MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c } from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import { OBJECTS_OperateGemShrine_6FC8B430_113c } from '../../../src/d2kern-113c/game/k2-w7b2-113c'
import { PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c } from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import { PLAYER_DestroyPlayerUnitResources_6FC587E0_113c } from '../../../src/d2kern-113c/game/k2-w9b1-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  // Batch 1 — 14 Trivial No-Op / StatusFilter / ReturnOne / AlwaysTrue VAs
  '0x6FC4E5C0': (m, a) => OBJECTS_LevelHookAlwaysTrue113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC4E720': (m, a) => OBJECTS_InitFn05_NoOp113c(m, a[0]!),
  '0x6FC58EC0': (m, a) => MISSILES_SrvDo_ReturnOne_6FC58EC0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC80170': (m, a) => ACT4_IntroStatusFilter_6FC80170_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC80180': (m, a) => ACT4_IntroCallback08Noop_6FC80180_113c(m, a[0]!, a[1]!),
  '0x6FC80800': (m, a) => ACT1_IntroStatusFilter_6FC80800_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC90170': (m, a) => PLRTRADE_TradeButtonNoopAction3_113c(m, a[0]!, a[1]!),
  '0x6FC90180': (m, a) => PLRTRADE_TradeButtonNoopAction2_113c(m, a[0]!, a[1]!),
  '0x6FC94890': (m, a) => MONSTER_EndModeS3Noop113c(m, a[0]!, a[1]!),
  '0x6FC97920': (m, a) => PLAYER_SkillModeNoopHandler_04_09_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC97930': (m, a) => PLAYER_SkillModeNoopHandler_01_05_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC97940': (m, a) => PLAYER_SkillModeNoopHandler_00_17_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC9B4E0': (m, a) => AITHINK_Fn146_UberMephistoNoop113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCBC990': (m, a) => MONAI_NoOpStub_6FCBC990_113c(m, a[0]!),

  // Batch 2 — 17 Newly-Unblocked Item / Object / Rack / Affix / Ear VAs
  '0x6FC2FFC0': (m, a) =>
    ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC30240': (m, a) => ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c(m, a[0]!, a[1]!),
  '0x6FC31E20': (m, a) =>
    ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC31FB0': (m, a) =>
    ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC32230': (m, a) => ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC348A0': (m, a) =>
    ITEMS_RollAutoMagicAffixId_6FC348A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC34BF0': (m, a) => ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c(m, a[0]!, a[1]!),
  '0x6FC34F20': (m, a) => ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c(m, a[0]!, a[1]!),
  '0x6FC7E940': (m, a) => ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c(m, a[0]!, a[1]!),
  '0x6FC8AFA0': (m, a) => OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC8B070': (m, a) => ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC8B280': (m, a) => OBJ_OperateFn20_WeaponRack_6FC8B280_113c(m, a[0]!),
  '0x6FC8B2E0': (m, a) => OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c(m, a[0]!),
  '0x6FC8B430': (m, a) => OBJECTS_OperateGemShrine_6FC8B430_113c(m, a[0]!),
  '0x6FC8BF00': (m, a) => OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c(m, a[0]!, a[1]!),
  '0x6FC8DEC0': (m, a) => OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c(m, a[0]!, a[1]!),

  // Batch 3 — 30 Storm / Game / Trade / Party / NPC / Client / Loaded-Item VAs
  '0x6FC22630': (m, a) => STORM_TSListArrayResize_6FC22630_113c(m, a[0]!, a[1]!),
  '0x6FC222D0': (m, a) => STORM_TSHashTableGrowAndRehash_6FC222D0_113c(m, a[0]!),
  '0x6FC49BA0': (m, a) => GAME_LeaveGameCriticalSection_6FC49BA0_113c(m, a[0]!),
  '0x6FC4A210': (m, a) => GAME_SetGlobalSeed113c(m, a[0]!),
  '0x6FC4A220': (m) => GAME_ReserveGlobalGameSlot_6FC4A220_113c(m),
  '0x6FC4A900': (m, a) => GAME_InitSeed113c(m, a[0]!),
  '0x6FC4AAE0': (m, a) => GAME_LookupAndLockGameByKey_6FC4AAE0_113c(m, a[0]!),
  '0x6FC4ABD0': (m, a) => GAME_IsGameNameAvailable_6FC4ABD0_113c(m, a[0]!),
  '0x6FC4BC90': (m, a) => GAME_AssignUniqueGameName_6FC4BC90_113c(m, a[0]!, a[1]!),
  '0x6FC4C830': (m, a) => PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c(m, a[0]!),
  '0x6FC4C910': (m, a) => PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c(m, a[0]!, a[1]!),
  '0x6FC587E0': (m, a) => PLAYER_DestroyPlayerUnitResources_6FC587E0_113c(m, a[0]!, a[1]!),
  '0x6FC6A190': (m, a) => CLIENTS_AppendSaveDataChunk_6FC6A190_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC6A9B0': (m, a) =>
    CLIENTS_AllocAndLinkClient_6FC6A9B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC6B7F0': (m, a) => CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC72020': (m, a) =>
    GAMETIME_GetElapsedMilliseconds_6FC72020_113c(m, {
      getTickCount: () => a[0]! >>> 0,
      queryPerformanceCounter: (mem, pOut) => {
        mem.setU32(pOut, a[1]! >>> 0)
        mem.setU32((pOut + 4) >>> 0, a[2]! >>> 0)
        return 1
      },
    }),
  '0x6FC72390': (m, a) =>
    GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c(m, a[0]!, a[1]!, a[2]!, {
      gameTime: { getTickCount: () => a[3]! >>> 0 },
    }),
  '0x6FC74420': (m, a) => ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC745D0': (m, a) => ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC74810': (m, a) =>
    ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
    ),
  '0x6FC90D90': (m, a) =>
    PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c(m, a[0]!, a[1]!, a[2]!, {
      onGetTickCount: () => a[3]! >>> 0,
    }),
  '0x6FC91330': (m, a) =>
    PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC919A0': (m, a) =>
    PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC91E10': (m, a) => D2Game_6FC91E10_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC93BA0': (m, a) => D2Game_6FC93BA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC93D90': (m, a) => PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC98FA0': (m, a) => PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c(m, a[0]!, a[1]!),
  '0x6FCAF4E0': (m, a) => NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCAFBE0': (m, a) => NPCS_InitGameNpcControl_6FCAFBE0_113c(m, a[0]!),
  '0x6FCBC160': (m, a) => PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),

  // Batch 4 — 5 Skills/Combat + 19 MonAI VAs
  '0x6FC460D0': (m, a) => MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c(m, a[0]!, a[1]!),
  '0x6FC465E0': (m, a) => MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c(m, a[0]!, a[1]!),
  '0x6FC70800': (m, a) => SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c(m, a[0]!, a[1]!),
  '0x6FCB3270': (m, a) => SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCB4370': (m, a) =>
    SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
      a[7]!,
      a[8]!,
    ),
  '0x6FC35E00': (m, a) => AI_ThinkBaalThroneSpawner_6FC35E00_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC35F90': (m, a) => AI_CastNextPatrolPointSkill_6FC35F90_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC364A0': (m, a) => AI_ThinkPainWormSpawner_6FC364A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC366D0': (m, a) => AI_ThinkImpregnatedMonster_6FC366D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC36E30': (m, a) => AI_ThinkPatrolAndAttack_6FC36E30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC38730': (m, a) => AI_Thinker_PutridDefiler_6FC38730_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3AF80': (m, a) => AI_ThinkCurseCaster_6FC3AF80_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3BCA0': (m, a) => AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9D170': (m, a) => AI_FoulCrowNestSpawner_6FC9D170_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9DB70': (m, a) => AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC9FB30': (m, a) => AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA00C0': (m, a) => AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA08A0': (m, a) => AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA2EC0': (m, a) => AI_ThinkChargerRunOrAttack_6FCA2EC0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA3550': (m, a) => AI_Skeleton113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA4800': (m, a) => AI_ThinkPackFollowerMelee_6FCA4800_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA77B0': (m, a) => AI_ThinkBurrowerSpawner_6FCA77B0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCA7BB0': (m, a) => AI_ThinkFetishShaman_6FCA7BB0_113c(m, a[0]!, a[1]!, a[2]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6W15VectorRecord {
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

const STAGE_BASE = 0x30000000
const STAGE_FIXED_SIZE = 0x00009000
const STAGE_SETUP_BASE = 0x30020000
const STAGE_CS_GAME = 0x30078000
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
    const sz = size === 0 ? 4 : size
    const p = ((this.heapCursor + 3) & ~3) >>> 0
    this.fill(p, sz, 0)
    this.heapCursor = (p + sz) >>> 0
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
    if (v >= 0x7e000000 && v < 0x7f000000) {
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

function loadVectors(): K6W15VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-w15/k6-w15-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6W15VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6W15VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6] Wave 15 real-DLL D2Game.dll Final Clean Lo-VA Sweeper vectors', () => {
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
    // Initialize known-zero D2Game global regions referenced across Batch 2/3
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2e350, 8, 0)
    mem.fill(0x6fd30200, 0x140, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x38, 0)
    mem.fill(0x6fd39fa0, 8, 0)
    mem.commitOverlayToBase()
  })

  it('covers all emitted real-DLL D2Game.dll Lo-VAs (>= 3 cases each)', () => {
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
        for (const cap of vec.extraCaps) {
          const capAddr = Number.parseInt(cap.addr, 16) >>> 0
          mem.fill(capAddr, cap.len, 0)
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
