/**
 * [K6-P11] Real-DLL D2Game.dll Band A+D Closer Vector Suite (121 net-new VAs).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { beforeAll, describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import { bindK2KernelGlobals113c } from '../../../src/d2kern-113c/game/k2-d2tv-evaluators-113c'
import {
  DUNGEON_CountNonPresetRoomsInLevel113c,
} from '../../../src/d2kern-113c/common/dungeon'
import {
  MONSTER_SaveInactiveMonsterNode113c,
  QUESTS_NotifyLevelChange113c,
  QUESTS_TriggerCallback113c,
  SUNIT_DeactivateAndRemoveUnit113c,
  UNIT_SaveInactiveUnitNode113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f150-f276-113c'
import {
  SUNIT_DispatchItemEventCallbacks113c,
} from '../../../src/d2kern-113c/game/a1c-post150-f786-f1040-113c'
import {
  GAME_UpdateActRooms113c,
  ROOM_DeactivateMonsterInRoom113c,
  ROOM_RefreshUnitsAndLoadSaved113c,
  type ActRoomsCallees113c,
} from '../../../src/d2kern-113c/game/act-rooms-113c'
import {
  AI_StartAttackMode113c,
} from '../../../src/d2kern-113c/game/ai-fallen-113c'
import {
  GAME_StepActEnvironmentCycles113c,
  GAME_StepClientJoinStatesAndTimeouts113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-a-113c'
import {
  C2S_ExecuteSkillOnLocation113c,
  C2S_ExecuteSkillOnUnit113c,
  C2S_Packet0D_RightSkillOnUnit113c,
} from '../../../src/d2kern-113c/game/c2s-packet-113c'
import {
  SKILLS_CastTriggeredSkillCore113c,
  SKILLS_TriggerSkillOnTarget113c,
} from '../../../src/d2kern-113c/game/k2-gap-itemdef-113c'
import {
  MISSILE_ApplyDamageStrcToTarget113c,
  MISSILE_BuildDamageStrcFromStats113c,
  MISSILE_DispatchFrameTick113c,
  MISSILE_ProcessTargetCollisionHit113c,
} from '../../../src/d2kern-113c/game/k2-gap-melee-dot-113c'
import {
  AI_CheckAnyMinionDeadCallback113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c'
import {
  AIGENERAL_ForEachPackMember_6FC41490_113c,
} from '../../../src/d2kern-113c/game/k2-laneI-0x6fc3-w1-113c'
import {
  OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c,
  QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c,
  QUESTS_TriggerItemDropped_6FC545A0_113c,
  QUESTS_TriggerItemPickedUp_6FC54510_113c,
} from '../../../src/d2kern-113c/game/k2-laneJ-0x6fc4-w1-113c'
import {
  PLAYER_InitPlacedModesAndEvents_6FC57E20_113c,
  QUESTS_TriggerCallback00_6FC54660_113c,
  QUESTS_TriggerCallback0B_6FC55C90_113c,
} from '../../../src/d2kern-113c/game/k2-laneK-0x6fc5-w1-113c'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c,
  ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c,
  ITEMS_InitCreatedItemStats_6FC31070_113c,
  ITEMS_RollItemQuality_6FC2FC40_113c,
} from '../../../src/d2kern-113c/game/k2-real-itemdrop-113c'
import {
  AI_IdleWander113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplyElementalAbsorb113c,
  SUNITDMG_GetEffectiveResistance113c,
  SUNITDMG_RemoveCombatNode113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c,
  SUNITDMG_TriggerPostCombatEvents113c,
} from '../../../src/d2kern-113c/game/k2-real-s2c-combat-113c'
import {
  AI_PetMoveActionDispatch_6FC3CAE0_113c,
  C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c,
  PLAYER_InitPlayerUnitSubsystems_6FC58620_113c,
} from '../../../src/d2kern-113c/game/k2-w11b1-113c'
import {
  AI_FollowOwnerOrTeleportIfFar_6FC3E140_113c,
  HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c,
} from '../../../src/d2kern-113c/game/k2-w12b1-113c'
import {
  D2Game_6FC3E640_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c'
import {
  ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c,
  ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c,
  QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c,
  SKILLS_SrvDo_SummonDecoy_6FC6D710_113c,
  SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c,
  SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c,
  SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c,
} from '../../../src/d2kern-113c/game/k2-w14b1-113c'
import {
  ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c,
  QUESTS_OnBossActChangeOrBossKill_6FC56890_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c'
import {
  MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c,
} from '../../../src/d2kern-113c/game/k2-w2b1-113c'
import {
  MONSTER_SpawnAtCoords_6FD0F450_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c'
import {
  AI_ThinkSandMaggot_6FC38480_113c,
  ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c,
} from '../../../src/d2kern-113c/game/k2-w3b1-113c'
import {
  MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c,
  OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c,
  OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c,
  OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c,
  OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b2-113c'
import {
  QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c,
  QUESTS_SendQuestLogPackets50And52_6FC55640_113c,
} from '../../../src/d2kern-113c/game/k2-w3b3-113c'
import {
  SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c,
} from '../../../src/d2kern-113c/game/k2-w3b4-113c'
import {
  ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c,
  ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c,
  ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c,
} from '../../../src/d2kern-113c/game/k2-w3b5-113c'
import {
  OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c,
  OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c,
  OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c,
} from '../../../src/d2kern-113c/game/k2-w4b1-113c'
import {
  MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c,
  MONUMOD_SpectralHitMissileDamage_6FC43650_113c,
  PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import {
  PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c,
} from '../../../src/d2kern-113c/game/k2-w4b4-113c'
import {
  AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c,
  PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c,
} from '../../../src/d2kern-113c/game/k2-w5b1-113c'
import {
  AI_FindTargetOrUnstickOverlap_6FD13150_113c,
} from '../../../src/d2kern-113c/game/k2-w5b10-113c'
import {
  ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c,
} from '../../../src/d2kern-113c/game/k2-w5b9-113c'
import {
  NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c,
  OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c,
  QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c,
  SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c,
} from '../../../src/d2kern-113c/game/k2-w6b1-113c'
import {
  AI_ExecuteHirelingCombatStep_6FC3C8A0_113c,
  AI_ThinkAct2SewerTownNpc_6FC3B950_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c'
import {
  PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c'
import {
  HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b6-113c'
import {
  AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c,
  NPC_StartPlayerNpcInteraction_6FC687A0_113c,
  QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c,
  SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c,
  SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c,
  SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c,
  SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c'
import {
  ITEMS_UseBeltItem_6FCF8BA0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  C2S_Packet20_UseInventoryItem_6FCEF730_113c,
  C2S_Packet26_UseBeltItem_6FCEF5B0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b3-113c'
import {
  SKILLS_EquipSummonedPetItems_6FD0E6F0_113c,
} from '../../../src/d2kern-113c/game/k2-w9b2-113c'
import {
  OBJECTS_CheckLevelObjectHook113c,
  OBJECTS_InitObjectUnit113c,
  OBJECTS_PopulateRoom113c,
  OBJECTS_SpawnRandomObjectInRoom113c,
  type ObjectSpawnCallees113c,
  type ObjectsPopulateCallees113c,
} from '../../../src/d2kern-113c/game/objects-populate-113c'
import {
  MONSTER_Create113c,
  MONSTER_SpawnAtCoords113c,
  MONSTER_SpawnPackLeader113c,
  MONSTER_SpawnPackMember113c,
  MONSTER_SpawnPartyMinionInRing113c,
  OBJECTS_SpawnDensityObjectsInRoom113c,
  REGPOP_FindPackSpawnCoords113c,
  REGPOP_PopulateRoomMonsters113c,
  REGPOP_SpawnMonsterPack113c,
  SUNIT_AllocUnitData113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import {
  CLIENTS_UpdatePlayerRoom113c,
  OBJECTS_SpawnDensityWithSecondaryTorch113c,
  ROOM_DeactivateAnyUnitInRoom113c,
  SUNIT_FreeUnit113c,
} from '../../../src/d2kern-113c/game/replay-final11-113c'
import {
  OBJECTS_InitPresetQuestObject113c,
  ROOM_SpawnMonsterPreset113c,
  ROOM_SpawnPresetUnit113c,
  ROOM_SpawnPresetUnits113c,
  SUNIT_CreatePresetUnit113c,
  type RoomPresetCallees113c,
} from '../../../src/d2kern-113c/game/room-presets-113c'
import {
  AIGENERAL_GetOrAllocAiCommandByType113c,
  AI_StepRelativeToTargetUnit113c,
  AI_TownNpcMem113c,
} from '../../../src/d2kern-113c/game/town-npc-ai-113c'
import {
  QUESTS_CheckNpcQuestInteractAlert113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c'
import type { FieldLayout113c } from '../../../src/d2kern-113c/mem/layout.generated'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import { beginVaTrace113c, endVaTrace113c } from '../../../src/d2kern-113c/va-trace-113c'
import { parseVectorHeader } from '../../../tools/oracle/vectors/vector-format'

type DispatchFn = (m: SparseMemory113c, a: readonly number[]) => unknown

const DISPATCH_BY_VA: Record<string, DispatchFn> = {
  '0x6FC2FB70': (m, a) => ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c(m, a[0]!, a[1]!),
  '0x6FC2FC40': (m, a) => ITEMS_RollItemQuality_6FC2FC40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC31490': (m, a) => D2GAME_CreateItemEx_6FC31490_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC32EE0': (m, a) => ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC33320': (m, a) => ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC38480': (m, a) => AI_ThinkSandMaggot_6FC38480_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3B950': (m, a) => AI_ThinkAct2SewerTownNpc_6FC3B950_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3BDF0': (m, a) => AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c(m, a[0]!, a[1]!),
  '0x6FC3BF60': (m, a) => AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3C8A0': (m, a) => AI_ExecuteHirelingCombatStep_6FC3C8A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC3CAE0': (m, a) => AI_PetMoveActionDispatch_6FC3CAE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC3DB40': (m, a) => AI_TownNpcMem113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3E140': (m, a) => AI_FollowOwnerOrTeleportIfFar_6FC3E140_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC3E640': (m, a) => D2Game_6FC3E640_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3E900': (m, a) => ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3F2D0': (m, a) => MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC3F600': (m, a) => MONSTER_SaveInactiveMonsterNode113c(m, a[0]!, a[1]!),
  '0x6FC400E0': (m, a) => ROOM_RefreshUnitsAndLoadSaved113c(m, a[0]!, a[1]!),
  '0x6FC404E0': (m, a) => UNIT_SaveInactiveUnitNode113c(m, a[0]!, a[1]!),
  '0x6FC40760': (m, a) => ROOM_DeactivateMonsterInRoom113c(m, a[0]!, a[1]!),
  '0x6FC409B0': (m, a) => ROOM_DeactivateAnyUnitInRoom113c(m, a[0]!, a[1]!),
  '0x6FC41490': (m, a) => AIGENERAL_ForEachPackMember_6FC41490_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, { onPackMemberCallback: (mem, _va, pMem, pArg1, pArg2) => AI_CheckAnyMinionDeadCallback113c(mem, pMem, pArg1, pArg2) }),
  '0x6FC417D0': (m, a) => AIGENERAL_GetOrAllocAiCommandByType113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC432B0': (m, a) => MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC43650': (m, a) => MONUMOD_SpectralHitMissileDamage_6FC43650_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC49000': (m, a) => SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC4CA20': (m, a) => GAME_StepActEnvironmentCycles113c(m, a[0]!),
  '0x6FC4CBE0': (m, a) => {
    const spawn: ObjectSpawnCallees113c = {
      initObject: (mm, u, g, id, r, x, y) => OBJECTS_InitObjectUnit113c(mm, u, g, id, r, x, y),
      placeServerUnit: (mm, y, u, r, x, g, a2) => SUNIT_PlaceServerUnitInRoom113c(mm, r, y, u, x, g, a2),
    }
    const objects: ObjectsPopulateCallees113c = {
      getLevelRoomCountInAct: (mm, pAct, lvl) => DUNGEON_CountNonPresetRoomsInLevel113c(mm, pAct, lvl),
      checkLevelObjectHook: (mm, pInfo, pg, pr, hook) => OBJECTS_CheckLevelObjectHook113c(mm, pInfo, pr, pg, hook),
      spawnObjectsByFn: (mm, fnVa, pg, pr, den, id, prob) => {
        switch (fnVa >>> 0) {
          case 0x6fc527d0: return OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(mm, pg, pr, id, den, prob)
          case 0x6fc52ce0: return OBJECTS_SpawnDensityObjectsInRoom113c(mm, pg, pr, den, id, prob)
          case 0x6fc52df0: return OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c(mm, pg, pr, id, prob)
          case 0x6fc52a10: return OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c(mm, pg, pr, den, id, prob)
          case 0x6fc52bc0: return OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(mm, pg, pr, den, id, prob)
          case 0x6fc53260: return OBJECTS_SpawnDensityWithSecondaryTorch113c(mm, pg, pr, den, id, prob)
          default: return 0
        }
      },
      spawn,
    }
    const presets: RoomPresetCallees113c = {
      spawnMonsterPreset: (mm, pr, cid, pg, x, y, mode) =>
        ROOM_SpawnMonsterPreset113c(mm, pr, cid, pg, x, y, mode, (m2, nc, nm, g2, r2, xx, yy, mr, wf) =>
          MONSTER_SpawnAtCoords113c(m2, nc, nm, g2, r2, xx, yy, mr, wf)),
      spawnSpecialObject: (mm, cid, pg, pr, x, y, mode) =>
        OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(mm, cid, pg, pr, x, y, mode),
      allocUnitData: (mm, t, cid, x, y, pg, pr, a5, mode, a7) =>
        SUNIT_AllocUnitData113c(mm, t, cid, x, y, pg, pr, a5, mode, a7),
      placePresetItem: (mm, pp, pg, pd, a2) =>
        ITEMS_InitCreatedItemStats_6FC31070_113c(mm, pg, pp, pd, a2),
      freeUnit: (mm, pg, pu) => SUNIT_FreeUnit113c(mm, pg, pu),
      initQuestObject1CB: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(mm, pg, pSave),
      initQuestObject1CD: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(mm, pg, pSave),
      initQuestObject21F: (mm, pg, _pu, pSave) => ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(mm, pg, pSave),
    }
    const callees: ActRoomsCallees113c = {
      refreshRoomUnits: (mm, pg, pr) => ROOM_RefreshUnitsAndLoadSaved113c(mm, pg, pr),
      objects,
      initAmbientMonster: () => {},
      presets,
      regpop: {},
    }
    return GAME_UpdateActRooms113c(m, a[0]!, callees)
  },
  '0x6FC4D9B0': (m, a) => GAME_StepClientJoinStatesAndTimeouts113c(m, a[0]!, a[1]!),
  '0x6FC4E830': (m, a) => OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC4F0D0': (m, a) => {
    const spawn: ObjectSpawnCallees113c = {
      initObject: (mm, u, g, id, r, x, y) => OBJECTS_InitObjectUnit113c(mm, u, g, id, r, x, y),
      placeServerUnit: (mm, y, u, r, x, g, a2) => SUNIT_PlaceServerUnitInRoom113c(mm, r, y, u, x, g, a2),
    }
    const objects: ObjectsPopulateCallees113c = {
      getLevelRoomCountInAct: (mm, pAct, lvl) => DUNGEON_CountNonPresetRoomsInLevel113c(mm, pAct, lvl),
      checkLevelObjectHook: (mm, pInfo, pg, pr, hook) => OBJECTS_CheckLevelObjectHook113c(mm, pInfo, pr, pg, hook),
      spawnObjectsByFn: (mm, fnVa, pg, pr, den, id, prob) => {
        switch (fnVa >>> 0) {
          case 0x6fc527d0: return OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(mm, pg, pr, id, den, prob)
          case 0x6fc52ce0: return OBJECTS_SpawnDensityObjectsInRoom113c(mm, pg, pr, den, id, prob)
          case 0x6fc52df0: return OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c(mm, pg, pr, id, prob)
          case 0x6fc52a10: return OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c(mm, pg, pr, den, id, prob)
          case 0x6fc52bc0: return OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c(mm, pg, pr, den, id, prob)
          case 0x6fc53260: return OBJECTS_SpawnDensityWithSecondaryTorch113c(mm, pg, pr, den, id, prob)
          default: return 0
        }
      },
      spawn,
    }
    return OBJECTS_PopulateRoom113c(m, a[0]!, a[1]!, objects)
  },
  '0x6FC4F300': (m, a) => OBJECTS_InitObjectUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC4F690': (m, a) => OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c(m, a[0]!),
  '0x6FC517F0': (m, a) => OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, { onObjectPosValidate: () => 1 }),
  '0x6FC51B40': (m, a) => OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, { onObjectPosValidate: () => 1 }),
  '0x6FC51E20': (m, a) => {
    const spawn: ObjectSpawnCallees113c = {
      initObject: (mm, u, g, id, r, x, y) => OBJECTS_InitObjectUnit113c(mm, u, g, id, r, x, y),
      placeServerUnit: (mm, y, u, r, x, g, a2) => SUNIT_PlaceServerUnitInRoom113c(mm, r, y, u, x, g, a2),
    }
    return OBJECTS_SpawnRandomObjectInRoom113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, spawn)
  },
  '0x6FC52110': (m, a) => OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC527D0': (m, a) => OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC52CE0': (m, a) => {
    const spawn: ObjectSpawnCallees113c = {
      initObject: (mm, u, g, id, r, x, y) => OBJECTS_InitObjectUnit113c(mm, u, g, id, r, x, y),
      placeServerUnit: (mm, y, u, r, x, g, a2) => SUNIT_PlaceServerUnitInRoom113c(mm, r, y, u, x, g, a2),
    }
    return OBJECTS_SpawnDensityObjectsInRoom113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, {
      onSpawnRandomObjectInRoom: (mm, sx, sy, id, pg, _st, pr) =>
        OBJECTS_SpawnRandomObjectInRoom113c(mm, pg, id, sx, sy, pr, spawn),
    })
  },
  '0x6FC52DF0': (m, a) => OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC53C70': (m, a) => QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c(m, a[0]!, a[1]!),
  '0x6FC53CE0': (m, a) => QUESTS_TriggerCallback113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC54510': (m, a) => QUESTS_TriggerItemPickedUp_6FC54510_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC545A0': (m, a) => QUESTS_TriggerItemDropped_6FC545A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC54660': (m, a) => QUESTS_TriggerCallback00_6FC54660_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC54860': (m, a) => QUESTS_NotifyLevelChange113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC54EA0': (m, a) => QUESTS_CheckNpcQuestInteractAlert113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC554F0': (m, a) => QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC55640': (m, a) => QUESTS_SendQuestLogPackets50And52_6FC55640_113c(m, a[0]!, a[1]!),
  '0x6FC55C90': (m, a) => QUESTS_TriggerCallback0B_6FC55C90_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC55E50': (m, a) => {
    const callees: RoomPresetCallees113c = {
      spawnMonsterPreset: (mm, pr, cid, pg, x, y, mode) =>
        ROOM_SpawnMonsterPreset113c(mm, pr, cid, pg, x, y, mode, (m2, nc, nm, g2, r2, xx, yy, mr, wf) =>
          MONSTER_SpawnAtCoords113c(m2, nc, nm, g2, r2, xx, yy, mr, wf)),
      spawnSpecialObject: (mm, cid, pg, pr, x, y, mode) =>
        OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(mm, cid, pg, pr, x, y, mode),
      allocUnitData: (mm, t, cid, x, y, pg, pr, a5, mode, a7) =>
        SUNIT_AllocUnitData113c(mm, t, cid, x, y, pg, pr, a5, mode, a7),
      placePresetItem: (mm, pp, pg, pd, a2) =>
        ITEMS_InitCreatedItemStats_6FC31070_113c(mm, pg, pp, pd, a2),
      freeUnit: (mm, pg, pu) => SUNIT_FreeUnit113c(mm, pg, pu),
      initQuestObject1CB: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(mm, pg, pSave),
      initQuestObject1CD: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(mm, pg, pSave),
      initQuestObject21F: (mm, pg, _pu, pSave) => ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(mm, pg, pSave),
    }
    return OBJECTS_InitPresetQuestObject113c(m, a[0]!, a[1]!, a[2]!, callees)
  },
  '0x6FC565B0': (m, a) => QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c(m, a[0]!),
  '0x6FC566A0': (m, a) => QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC566C0': (m, a) => ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC56890': (m, a) => QUESTS_OnBossActChangeOrBossKill_6FC56890_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC56C20': (m, a) => QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c(m, a[0]!),
  '0x6FC57030': (m, a) => SUNIT_DispatchItemEventCallbacks113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC57C90': (m, a) => PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c(m, a[0]!, a[1]!),
  '0x6FC57E20': (m, a) => PLAYER_InitPlacedModesAndEvents_6FC57E20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC57F80': (m, a) => PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC58180': (m, a) => PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC58620': (m, a) => PLAYER_InitPlayerUnitSubsystems_6FC58620_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC586F0': (m, a) => PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c(m, a[0]!, a[1]!),
  '0x6FC5A4E0': (m, a) => MISSILE_BuildDamageStrcFromStats113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC5AE10': (m, a) => MISSILE_ApplyDamageStrcToTarget113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC5E3F0': (m, a) => MISSILE_DispatchFrameTick113c(m, a[0]!, a[1]!),
  '0x6FC5EDE0': (m, a) => MISSILE_ProcessTargetCollisionHit113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC5F7D0': (m, a) => MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FC63FA0': (m, a) => SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC65EE0': (m, a) => SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC66560': (m, a) => SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC66720': (m, a) => SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC668A0': (m, a) => SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC67450': (m, a) => REGPOP_FindPackSpawnCoords113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FC67700': (m, a) => REGPOP_SpawnMonsterPack113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC67A20': (m, a) => REGPOP_PopulateRoomMonsters113c(m, a[0]!, a[1]!),
  '0x6FC685C0': (m, a) => NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC687A0': (m, a) => NPC_StartPlayerNpcInteraction_6FC687A0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FC68FC0': (m, a) => HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FC6B400': (m, a) => CLIENTS_UpdatePlayerRoom113c(m, a[0]!, a[1]!),
  '0x6FC6C870': (m, a) => SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6D710': (m, a) => SKILLS_SrvDo_SummonDecoy_6FC6D710_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6DAC0': (m, a) => SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FC6DCD0': (m, a) => SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEDA20': (m, a) => C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEDF30': (m, a) => C2S_ExecuteSkillOnLocation113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCEE620': (m, a) => C2S_ExecuteSkillOnUnit113c(m, a[0]!, a[1]!, a[2]!, 0, a[3]!, undefined, a[4]!, a[5]!),
  '0x6FCEE870': (m, a) => C2S_Packet0D_RightSkillOnUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEF5B0': (m, a) => C2S_Packet26_UseBeltItem_6FCEF5B0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCEF730': (m, a) => C2S_Packet20_UseInventoryItem_6FCEF730_113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FCF8440': (m, a) => ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCF8BA0': (m, a) => ITEMS_UseBeltItem_6FCF8BA0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FCFA6D0': (m, a) => SUNITDMG_RemoveCombatNode113c(m, a[0]!, a[1]!),
  '0x6FCFAD00': (m, a) => SUNITDMG_ApplyElementalAbsorb113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCFB030': (m, a) => SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, 0, a[0]!, 0),
  '0x6FCFB3C0': (m, a) => SUNITDMG_GetEffectiveResistance113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCFB790': (m, a) => SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FCFDCB0': (m, a) => HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCFE0C0': (m, a) => SUNITDMG_ApplyDamage113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FCFEA00': (m, a) => SUNITDMG_TriggerPostCombatEvents113c(m, a[0]!, a[1]!, a[2]!, 0, true),
  '0x6FD00110': (m, a) => SUNIT_InitUnitSeed113c(m, a[0]!, a[1]!),
  '0x6FD00C80': (m, a) => SUNIT_DeactivateAndRemoveUnit113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD00F40': (m, a) => SUNIT_PlaceServerUnitInRoom113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD012D0': (m, a) => { const callees: RoomPresetCallees113c = {
      spawnMonsterPreset: (mm, pr, cid, pg, x, y, mode) =>
        ROOM_SpawnMonsterPreset113c(mm, pr, cid, pg, x, y, mode, (m2, nc, nm, g2, r2, xx, yy, mr, wf) =>
          MONSTER_SpawnAtCoords113c(m2, nc, nm, g2, r2, xx, yy, mr, wf)),
      spawnSpecialObject: (mm, cid, pg, pr, x, y, mode) =>
        OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(mm, cid, pg, pr, x, y, mode),
      allocUnitData: (mm, t, cid, x, y, pg, pr, a5, mode, a7) =>
        SUNIT_AllocUnitData113c(mm, t, cid, x, y, pg, pr, a5, mode, a7),
      placePresetItem: (mm, pp, pg, pd, a2) =>
        ITEMS_InitCreatedItemStats_6FC31070_113c(mm, pg, pp, pd, a2),
      freeUnit: (mm, pg, pu) => SUNIT_FreeUnit113c(mm, pg, pu),
      initQuestObject1CB: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(mm, pg, pSave),
      initQuestObject1CD: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(mm, pg, pSave),
      initQuestObject21F: (mm, pg, _pu, pSave) => ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(mm, pg, pSave),
    }; return SUNIT_CreatePresetUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, callees) },
  '0x6FD013B0': (m, a) => { const callees: RoomPresetCallees113c = {
      spawnMonsterPreset: (mm, pr, cid, pg, x, y, mode) =>
        ROOM_SpawnMonsterPreset113c(mm, pr, cid, pg, x, y, mode, (m2, nc, nm, g2, r2, xx, yy, mr, wf) =>
          MONSTER_SpawnAtCoords113c(m2, nc, nm, g2, r2, xx, yy, mr, wf)),
      spawnSpecialObject: (mm, cid, pg, pr, x, y, mode) =>
        OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(mm, cid, pg, pr, x, y, mode),
      allocUnitData: (mm, t, cid, x, y, pg, pr, a5, mode, a7) =>
        SUNIT_AllocUnitData113c(mm, t, cid, x, y, pg, pr, a5, mode, a7),
      placePresetItem: (mm, pp, pg, pd, a2) =>
        ITEMS_InitCreatedItemStats_6FC31070_113c(mm, pg, pp, pd, a2),
      freeUnit: (mm, pg, pu) => SUNIT_FreeUnit113c(mm, pg, pu),
      initQuestObject1CB: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(mm, pg, pSave),
      initQuestObject1CD: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(mm, pg, pSave),
      initQuestObject21F: (mm, pg, _pu, pSave) => ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(mm, pg, pSave),
    }; return ROOM_SpawnPresetUnit113c(m, a[0]!, a[1]!, a[2]!, callees) },
  '0x6FD01430': (m, a) => { const callees: RoomPresetCallees113c = {
      spawnMonsterPreset: (mm, pr, cid, pg, x, y, mode) =>
        ROOM_SpawnMonsterPreset113c(mm, pr, cid, pg, x, y, mode, (m2, nc, nm, g2, r2, xx, yy, mr, wf) =>
          MONSTER_SpawnAtCoords113c(m2, nc, nm, g2, r2, xx, yy, mr, wf)),
      spawnSpecialObject: (mm, cid, pg, pr, x, y, mode) =>
        OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c(mm, cid, pg, pr, x, y, mode),
      allocUnitData: (mm, t, cid, x, y, pg, pr, a5, mode, a7) =>
        SUNIT_AllocUnitData113c(mm, t, cid, x, y, pg, pr, a5, mode, a7),
      placePresetItem: (mm, pp, pg, pd, a2) =>
        ITEMS_InitCreatedItemStats_6FC31070_113c(mm, pg, pp, pd, a2),
      freeUnit: (mm, pg, pu) => SUNIT_FreeUnit113c(mm, pg, pu),
      initQuestObject1CB: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c(mm, pg, pSave),
      initQuestObject1CD: (mm, pg, _pu, pSave) => ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c(mm, pg, pSave),
      initQuestObject21F: (mm, pg, _pu, pSave) => ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c(mm, pg, pSave),
    }; return ROOM_SpawnPresetUnits113c(m, a[0]!, a[1]!, callees) },
  '0x6FD01D90': (m, a) => SUNIT_AllocUnitData113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FD086A0': (m, a) => ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c(m, a[0]!),
  '0x6FD0DDB0': (m, a) => MONSTER_SpawnPartyMinionInRing113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD0E6F0': (m, a) => SKILLS_EquipSummonedPetItems_6FD0E6F0_113c(m, a[0]!),
  '0x6FD0EF10': (m, a) => MONSTER_Create113c(m, a[0]!),
  '0x6FD0F450': (m, a) => MONSTER_SpawnAtCoords_6FD0F450_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FD0F510': (m, a) => MONSTER_SpawnPackLeader113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!),
  '0x6FD0F570': (m, a) => MONSTER_SpawnPackMember113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!),
  '0x6FD0F650': (m, a) => MONSTER_SpawnAtCoords113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!),
  '0x6FD114F0': (m, a) => SKILLS_CastTriggeredSkillCore113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!, a[7]!, a[8]!, a[9]!, a[10]!, a[11]!),
  '0x6FD117E0': (m, a) => SKILLS_TriggerSkillOnTarget113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
  '0x6FD11B10': (m, a) => AI_IdleWander113c(m, a[0]!, a[1]!, a[2]!),
  '0x6FD11D90': (m, a) => AI_StepRelativeToTargetUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!),
  '0x6FD12220': (m, a) => AI_StartAttackMode113c(m, a[0]!, a[1]!, a[2]!, a[3]!),
  '0x6FD13150': (m, a) => AI_FindTargetOrUnstickOverlap_6FD13150_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!),
}

interface MemRunRecord {
  addr: string
  hex: string
}

interface ExtraCapRecord {
  addr: string
  len: number
}

interface K6P11VectorRecord {
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
  extractMemRunsRange(mem, STAGE_CS_GAME, STAGE_CS_GAME + 0x1000, out)
  if (setupTop > STAGE_SETUP_BASE) {
    extractMemRunsRange(mem, STAGE_SETUP_BASE, setupTop, out)
  }
  for (const cap of extraCaps) {
    const start = Number.parseInt(cap.addr, 16) >>> 0
    extractMemRunsRange(mem, start, (start + cap.len) >>> 0, out)
  }
  return out
}

function loadVectors(): K6P11VectorRecord[] {
  const gzPath = resolve(
    import.meta.dirname,
    '../../fixtures/oracle/k6-p11/k6-p11-d2game-vectors.ndjson.gz',
  )
  const text = gunzipSync(readFileSync(gzPath)).toString('utf8')
  const lines = text.split('\n').filter((ln) => ln.trim().length > 0)
  return lines.map((ln) => JSON.parse(ln) as K6P11VectorRecord)
}

const ALL_VECTORS = loadVectors()
const VECTORS_BY_VA = new Map<string, K6P11VectorRecord[]>()
for (const v of ALL_VECTORS) {
  let list = VECTORS_BY_VA.get(v.va)
  if (list === undefined) {
    list = []
    VECTORS_BY_VA.set(v.va, list)
  }
  list.push(v)
}

describe('[K6-P11] Real-DLL D2Game.dll Band A+D Closer Vector Suite (121 net-new VAs)', () => {
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
    mem.fill(STAGE_CS_GAME, 0x1000, 0)
    mem.fill(0x004000f0, 8, 0)
    mem.fill(0x28000000, 0x10, 0)
    mem.setU32(0x28000004, 1)
    // Initialize known-zero D2Game global regions referenced by save/combat/AI paths
    mem.fill(0x6fd18d10, 4, 0)
    mem.fill(0x6fd2d8bc, 4, 0)
    mem.fill(0x6fd301e0, 8, 0)
    mem.fill(0x6fd30398, 0x20, 0)
    mem.fill(0x6fd303b8, 0x800, 0)
    mem.fill(0x6fd30c04, 0x1008, 0)
    mem.fill(0x6fd31c0c, 0x40, 0)
    mem.fill(0x6fd31f80, 0x20, 0)
    mem.commitOverlayToBase()
  })

  it('covers all 121 target real-DLL D2Game Band A+D VAs (>= 3 cases each)', () => {
    expect(VECTORS_BY_VA.size).toBe(121)
    expect(VECTORS_BY_VA.size).toBe(Object.keys(DISPATCH_BY_VA).length)
    expect(ALL_VECTORS.length).toBeGreaterThanOrEqual(VECTORS_BY_VA.size * 3)
    for (const [va, cases] of VECTORS_BY_VA.entries()) {
      const num = Number.parseInt(va, 16) >>> 0
      const inBandA = num >= 0x6fc20000 && num <= 0x6fc6ffff
      const inBandD = num >= 0x6fce0000 && num <= 0x6fd142d0
      expect(inBandA || inBandD).toBe(true)
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
