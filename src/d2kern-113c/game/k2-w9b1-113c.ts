/**
 * D2Game.dll 1.13c — [K2] Wave 9 Batch 1 (w9b1).
 *
 * Clean-room 1:1 binary-isomorphic port of 25 D2Game.dll v1.13c functions in
 * the 0x6FC56100..0x6FCDDE50 address range.
 */

import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32 } from '../common/int-math'
import {
  INVENTORY_FreeCorpse113c,
  INVENTORY_FreeInventory113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetLeftItemGuid113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items'
import { SKILLS_SetUsedSkillMemPort113c } from '../common/k0-d2common-memports'
import {
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetTargetX113c,
} from '../common/missile'
import { PATH_GetPosX113c, PATH_GetPosY113c } from '../common/path'
import {
  QUESTRECORD_SetQuestState113c,
  UNITS_FreePlayerData113c,
} from '../common/quest-record'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvalParam56DimReturns113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetFirstSkillFromSkillList113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetNextSkill113c,
  SKILLS_GetSkillIdFromSkill113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import { CHAT_FreeHoverMsg113c } from '../common/text'
import {
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from '../common/unit'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint'
import type { SparseMemory113c } from '../mem/sparse-memory'
import {
  ACT1Q2_Callback03_LevelChanged113c,
  ACT1Q6_Callback03_LevelChanged113c,
  ACT3Q3_Callback03_LevelChanged113c,
  ACT4Q2_Callback03_AltLevelChanged113c,
  SUNIT_ClearUnitInventoryItems113c,
} from './a1c-post150-f150-f276-113c'
import {
  AI_CastSkillMode14_113c,
  AI_CastSkillWithMode113c,
  SKILLS_CanMonsterCastAtTarget113c,
  SUNIT_SetUnitEventSound113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c'
import {
  D2GAME_ARENA_FindPlayerSlotByUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import {
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_GetPlayerClientClassId113c,
} from './combat-a1c-113c'
import { AI_ApproachTarget113c } from './k2-real-s2c-combat-113c'
import { AURA_ForEachUnitInRadius113c } from './k2-gap-itemdef-113c'
import { MISSILE_SrvDo01_LinearProjectile113c } from './k2-gap-melee-dot-113c'
import { QUESTS_SendNpcMessagePacket27_113c } from './k2-items-tc-w1-113c'
import {
  PETTYPE_GetRecordPtrFast_6FC21B60_113c,
  PLAYER_GetQuestRecordForDifficulty_6FC21020_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c'
import { QUESTS_AppendQuestTimer_6FC53AF0_113c } from './k2-laneJ-0x6fc4-w1-113c'
import { PLAYER_FreePlayerCorpses_6FC579E0_113c } from './k2-laneK-0x6fc5-w1-113c'
import {
  ACT5Q1_ActiveFilter_6FC76D80_113c,
  ACT5Q1_StatusFilter_6FC76E00_113c,
  ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c,
} from './k2-laneM-0x6fc7-w1-113c'
import { ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c } from './k2-w2b1-113c'
import {
  ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c,
  ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c,
  ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c,
  QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c,
} from './k2-w2b2-113c'
import { S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c } from './k2-w2b4-113c'
import {
  ARENA_FreePlayerArenaUnit_6FCD2480_113c,
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c,
} from './k2-w2b5-113c'
import { ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c } from './k2-w2b6-113c'
import { MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c } from './k2-w3b3-113c'
import {
  ACT5Q1_Callback00_NpcActivate_6FC787C0_113c,
  ACT5Q1_SeqFilter_6FC76D10_113c,
  ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c,
} from './k2-w3b5-113c'
import {
  ACT1Q1_Callback00_NpcActivate_6FC82220_113c,
  ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c,
  ACT1Q3_Callback00_NpcActivate_6FC81030_113c,
  ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c,
  ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c,
  ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c,
  ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c,
  ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c,
  ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c,
  QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c,
  QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c,
} from './k2-w3b6-113c'
import { ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c } from './k2-w3b7-113c'
import {
  AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c,
  PLAYER_CanLootCorpse_6FC97E70_113c,
} from './k2-w3b8-113c'
import {
  ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
  ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c,
  ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
  ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
  PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c,
} from './k2-w4b2-113c'
import {
  ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c,
  ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c,
  ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c,
} from './k2-w4b3-113c'
import { ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c } from './k2-w4b4-113c'
import {
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
  SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c,
} from './k2-w4b5-113c'
import {
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
} from './k2-w4b6-113c'
import { MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c } from './k2-w4b7-113c'
import {
  ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c,
  ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c,
  ACT4Q1_InitNpcDialog_6FCD9560_113c,
  ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c,
  ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c,
} from './k2-w4b8-113c'
import {
  ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c,
  PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c,
} from './k2-w5b2-113c'
import {
  ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c,
  MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c,
} from './k2-w5b3-113c'
import { NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c } from './k2-w5b4-113c'
import { A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c } from './k2-w5b6-113c'
import { SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c } from './k2-w5b7-113c'
import {
  ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c,
  ACT3Q5_OnStairsProximityTimer_6FD09960_113c,
} from './k2-w5b9-113c'
import { PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c } from './k2-w6b2-113c'
import { NET_BroadcastSystemChatMessage_6FCEBE70_113c } from './k2-w6b3-113c'
import {
  ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c,
  ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c,
  ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c,
} from './k2-w6b4-113c'
import { ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c } from './k2-w6b5-113c'
import { PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c } from './k2-w6b6-113c'
import {
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c,
  QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c,
} from './k2-w7b1-113c'
import {
  ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c,
  ACT1Q4_OnCainGibbetOperated_6FC87730_113c,
  ACT1Q5_OnAndarielKilled_6FC88B90_113c,
  ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c,
  ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c,
} from './k2-w7b2-113c'
import {
  ACT4Q1_OnIzualKilled_6FCDABF0_113c,
  PETS_FreePlayerPetTable_6FCB7640_113c,
} from './k2-w7b3-113c'
import { SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c } from './k2-w7b4-113c'
import {
  ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c,
  ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c,
  ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c,
  ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c,
  ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c,
  ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c,
  ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c,
  PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c,
  PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c,
  PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c,
  QUESTS_DefaultSequenceFilter_6FC7AFB0_113c,
  QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c,
} from './k2-w8b1-113c'
import {
  ACT1Q1_OnMonsterKilled_6FC85760_113c,
  ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c,
  ACT4Q1_OnNpcMessage_6FCDA5E0_113c,
  AURA_ApplyRadialDamageCallback_6FCB54F0_113c,
  PARTY_LeavePartyForPlayer_6FCBC840_113c,
  PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c,
  PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c,
} from './k2-w8b2-113c'
import {
  ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c,
  ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c,
  ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c,
  ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c,
  NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c,
  NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c,
  NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c,
} from './k2-w8b3-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import {
  MONSTER_SpawnPartyMinionInRing113c,
  MONSTATS2_GetRecordPtr113c,
  SKILLS_GetRecordPtrFast113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { EVENT_RemoveUnitEvents113c } from './timer-wheel'
import {
  ACT1Q2_CheckBloodRavenNpcAlert113c,
  ACT1Q4_CheckCainTownNpcAlert113c,
  AITARGET_ScanUnitsByModeTable113c,
} from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type { SparseMemory113c }

let k2W9B1StackPtr = 0x7ef91000

function allocW9B1Stack(m: SparseMemory113c, size: number): number {
  const aligned = (size + 15) & ~15
  const base = k2W9B1StackPtr >>> 0
  k2W9B1StackPtr = (base + aligned) >>> 0
  for (let i = 0; i < aligned; i += 4) {
    m.setU32((base + i) >>> 0, 0)
  }
  return base
}

function freeW9B1Stack(base: number): void {
  k2W9B1StackPtr = base >>> 0
}

function allocStack(m: SparseMemory113c, size: number): number {
  return allocW9B1Stack(m, size)
}

function freeStack(_m: SparseMemory113c, size: number): void {
  const aligned = (size + 15) & ~15
  k2W9B1StackPtr = (k2W9B1StackPtr - aligned) >>> 0
}

function i16(m: SparseMemory113c, addr: number): number {
  return (m.u16(addr >>> 0) << 16) >> 16
}

function i32(m: SparseMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function FOG_AllocServerMemory113c(
  m: SparseMemory113c,
  _pMemPool: number,
  size: number,
  _pFile: number,
  _nLine: number,
  _nZero: number,
): number {
  return m.alloc(size) >>> 0
}

/**
 * [1/25] Dispatches Tainted Sun Altar object operate/init (`ACT2Q3_OnTaintedSunAltarInit_6FCE71A0`) when quest `0x0A` exists, or transitions the object to anim mode `2`.
 *
 * @dll D2Game.dll
 * @va 0x6FC56100
 * @ordinalOrName D2Game_6FC56100
 */
export function QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): number {
  hitD2GameVa113c(0x6FC56100)
  const pGame = m.u32(pOpStrc >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl !== 0) {
    let pQuest = m.u32(pQuestControl) >>> 0
    while (pQuest !== 0) {
      if (m.u32(pQuest) === 0x0a) {
        return ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c(m, pQuest, pOpStrc)
      }
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }
  }
  const pObject = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
  if (pObject === 0 || m.u32((pObject + 0x10) >>> 0) !== 2) {
    return UNITS_ChangeAnimMode113c(m, pObject, 2)
  }
  return pObject | 0
}

/**
 * [2/25] Object Event `0x07` quest/boss timer dispatcher (`0x6FC56C50`) keyed on object `dwClassId`.
 *
 * @dll D2Game.dll
 * @va 0x6FC56C50
 * @ordinalOrName D2Game_6FC56C50
 */
export function QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c(
  m: SparseMemory113c,
  pGame: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC56C50)
  const nClassId = pObject === 0 ? -1 : i32(m, (pObject + 0x04) >>> 0)
  const pRoom = UNITS_GetRoom113c(m, pObject) >>> 0

  const findQuest = (nQuestId: number): number => {
    const pQC = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (pQC === 0) return 0
    let pQuest = m.u32(pQC) >>> 0
    while (pQuest !== 0) {
      if ((m.u32(pQuest) | 0) === nQuestId) return pQuest
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }
    return 0
  }

  if (nClassId <= 0x16f) {
    if (nClassId === 0x16f) {
      const pQuest = findQuest(0x10)
      if (pQuest !== 0) {
        ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c(m, pQuest)
      }
      return
    }
    if (nClassId <= 0xbd) {
      if (nClassId === 0xbd) {
        const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
        const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
        if (nAct === 0) {
          const pQuest = findQuest(0x04)
          if (pQuest !== 0) {
            ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c(m, pQuest, pObject)
          }
          return
        }
        if (nLevelId === 0x6d || nLevelId >= 0x71) {
          const pQuest = findQuest(0x21)
          if (pQuest !== 0) {
            ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c(m, pQuest, pObject)
          }
          return
        }
        const pQuest = findQuest(0x20)
        if (pQuest !== 0) {
          ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c(m, pQuest, pObject)
        }
        return
      }
      if (nClassId === 0x1a) {
        ACT1Q4_OnCainGibbetOperated_6FC87730_113c(m, pGame, pObject)
        return
      }
      if (nClassId === 0x7a) {
        const pQuest = findQuest(0x0b)
        if (pQuest !== 0) {
          A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c(m, pObject, pQuest)
        }
        return
      }
      if (nClassId === 0x83) {
        if (pRoom === 0) return
        if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) === 1) {
          UNITS_ChangeAnimMode113c(m, pObject, 2)
        }
        const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
        if (nLevelId === 0x4c) {
          MONSTER_SpawnPartyMinionInRing113c(m, 0x12d, pObject, 1, pGame, -1, 0)
          return
        }
        if (nLevelId === 0x6c) {
          ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c(m, pGame, pObject)
        }
      }
      return
    }
    if (nClassId === 0x10c) {
      const pQuest = findQuest(0x04)
      if (pQuest !== 0) {
        ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c(m, pQuest, pObject)
      }
      return
    }
    if (nClassId === 0x155) {
      const pQuest = findQuest(0x14)
      if (pQuest !== 0) {
        ACT3Q5_OnStairsProximityTimer_6FD09960_113c(m, pObject, pQuest)
      }
    }
    return
  }

  switch (nClassId) {
    case 0x173: {
      const pQuest = findQuest(0x05)
      if (pQuest !== 0) {
        ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c(m, pQuest, pObject)
      }
      return
    }
    case 0x178: {
      const pQuest = findQuest(0x18)
      if (pQuest !== 0) {
        ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c(m, pObject, pQuest)
      }
      return
    }
    case 0x1cb:
      ACT5Q4_TrySpawnNihlathakPortalOrRescheduleEvent7_6FC7E790_113c(m, pGame, pObject)
      return
    case 0x1cc:
      ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c(m, pGame, pObject)
      return
    case 0x1cd:
      ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c(m, pGame)
      return
    case 0x1da:
    case 0x1db:
    case 0x1dc: {
      const pQuest = findQuest(0x23)
      if (pQuest !== 0) {
        ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c(m, pQuest, pObject)
      }
      return
    }
    default:
      return
  }
}

/**
 * [3/25] Releases all subsystems owned by a player unit (`0x6FC587E0`): pets, party, relations, combat list, corpses, inventory, arena, quest data, player data, hover message, and events.
 *
 * @dll D2Game.dll
 * @va 0x6FC587E0
 * @ordinalOrName D2Game_6FC587E0
 */
export function PLAYER_DestroyPlayerUnitResources_6FC587E0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FC587E0)
  PETS_FreePlayerPetTable_6FCB7640_113c(m, pGame, pPlayerUnit)
  PARTY_LeavePartyForPlayer_6FCBC840_113c(m, pPlayerUnit, pGame)
  PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c(m, pPlayerUnit, pGame)
  SUNITDMG_FreeAttackerCombatList113c(m, pPlayerUnit, pGame)
  PLAYER_FreePlayerCorpses_6FC579E0_113c(m, pPlayerUnit, pGame)
  SUNIT_ClearUnitInventoryItems113c(m, pGame, pPlayerUnit)
  INVENTORY_FreeInventory113c(m, m.u32((pPlayerUnit + 0x60) >>> 0))
  ARENA_FreePlayerArenaUnit_6FCD2480_113c(m, pPlayerUnit, pGame)
  PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c(m, pPlayerUnit, pGame)
  const pMemPool = m.u32((pGame + 0x1c) >>> 0)
  UNITS_FreePlayerData113c(m, pMemPool, pPlayerUnit)
  const pHoverMsg = m.u32((pPlayerUnit + 0xa4) >>> 0) >>> 0
  if (pHoverMsg !== 0) {
    CHAT_FreeHoverMsg113c(m, m.u32((pGame + 0x1c) >>> 0), pHoverMsg)
  }
  EVENT_RemoveUnitEvents113c(m, pGame, pPlayerUnit)
}

/**
 * [4/25] Missile impact callback (`0x6FC5BE70`) that spawns a quest portal at the missile's position when hitting the ground (`pTarget == 0`) and `TargetX == 0`.
 *
 * @dll D2Game.dll
 * @va 0x6FC5BE70
 * @ordinalOrName D2Game_6FC5BE70
 */
export function MISSILE_SrvHit_SpawnPortalOnGroundImpact_6FC5BE70_113c(
  m: SparseMemory113c,
  pGame: number,
  pMissile: number,
  pTarget: number,
): number {
  hitD2GameVa113c(0x6FC5BE70)
  if (pMissile !== 0) {
    const nClassId = i32(m, (pMissile + 0x04) >>> 0)
    if (nClassId >= 0) {
      const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
      const nMissilesTxtCount = i32(m, (pDataTables + 0xb6c) >>> 0)
      if (nClassId < nMissilesTxtCount) {
        const pMissilesTxt = (m.u32((pDataTables + 0xb64) >>> 0) + imul32(nClassId, 0x1a4)) >>> 0
        if (pMissilesTxt !== 0 && pTarget === 0) {
          if (MISSILE_GetTargetX113c(m, pMissile) === 0) {
            const nDestLevelId = i32(m, (pMissilesTxt + 0x44) >>> 0)
            QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c(m, pMissile, pGame, nDestLevelId)
          }
        }
      }
    }
  }
  return 0
}

/**
 * [5/25] Missile `SrvDo` handler (`0x6FC60B20`) that periodically spawns walkable sub-missiles, opens a portal near expiration, and advances linear projectile movement.
 *
 * @dll D2Game.dll
 * @va 0x6FC60B20
 * @ordinalOrName D2Game_6FC60B20
 */
export function MISSILE_SrvDo_RadamentDeathPortalAndSubMissiles_6FC60B20_113c(
  m: SparseMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC60B20)
  if (pMissile === 0) return 2
  const nClassId = i32(m, (pMissile + 0x04) >>> 0)
  if (nClassId < 0) return 2
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  if (nClassId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 2
  const pMissilesTxt = (m.u32((pDataTables + 0xb64) >>> 0) + imul32(nClassId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 2

  const nRemFrames = MISSILE_GetRemainingFrames113c(m, pMissile) | 0
  const wSubMissile1 = (m.u16((pMissilesTxt + 0x18) >>> 0) << 16) >> 16
  if (wSubMissile1 > 0) {
    const nRange = (m.u16((pMissilesTxt + 0x96) >>> 0) << 16) >> 16
    const nParam1 = i32(m, (pMissilesTxt + 0x38) >>> 0)
    if (nRemFrames < ((nRange - nParam1) | 0) && nRemFrames > nParam1) {
      const nParam2 = i32(m, (pMissilesTxt + 0x3c) >>> 0)
      const nParam3 = i32(m, (pMissilesTxt + 0x40) >>> 0)
      MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c(
        m,
        nParam2,
        pMissile,
        pGame,
        nParam3,
        wSubMissile1,
        5,
      )
    }
  }
  const nParam4 = i32(m, (pMissilesTxt + 0x44) >>> 0)
  if (nParam4 >= 0) {
    if (MISSILE_GetTargetX113c(m, pMissile) === 0) {
      const nThreshold = (i32(m, (pMissilesTxt + 0x48) >>> 0) + i32(m, (pMissilesTxt + 0x38) >>> 0)) | 0
      if (nRemFrames <= nThreshold) {
        QUESTS_SpawnPortalFromMissileAtCoords_6FC5BDA0_113c(
          m,
          pMissile,
          pGame,
          i32(m, (pMissilesTxt + 0x44) >>> 0),
        )
      }
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, pMissile, pGame)
}

/**
 * [6/25] Dispatches player character serialization (`0x6FC74320`) across single-player/TCP-IP client save buffers (`0x6FC73E50`), realm save commits (`0x6FC74000`), or local disk saves (`0x6FC73F10`).
 *
 * @dll D2Game.dll
 * @va 0x6FC74320
 * @ordinalOrName D2Game_6FC74320
 */
export function PLAYERSAVE_SavePlayerCharacter_6FC74320_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  szAccountName: number,
  bSaveMerc: number,
): number {
  hitD2GameVa113c(0x6FC74320)
  if (pPlayerUnit === 0) return 0
  const dwFlagsC8 = (m.u32((pPlayerUnit + 0xc8) >>> 0) & ~2) >>> 0
  const bHasFlag6C = m.u8((pPlayerUnit + 0x6c) >>> 0)
  m.setU32((pPlayerUnit + 0xc8) >>> 0, dwFlagsC8)
  let bUnkFlag = 0
  if (bHasFlag6C !== 0 && m.u32((pPlayerUnit + 0x68) >>> 0) === 0) {
    bUnkFlag = 1
  }
  let pClient = 0
  if (m.u32(pPlayerUnit >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const sp = allocW9B1Stack(m, 0x40)
  try {
    const szCharName = (sp + 0x04) >>> 0
    const pSrcName = (pClient + 0x1d) >>> 0
    let idx = 0
    while (idx < 0x31) {
      const ch = m.u8((pSrcName + idx) >>> 0)
      m.setU8((szCharName + idx) >>> 0, ch)
      if (ch === 0) break
      idx++
    }
    m.setU8((szCharName + idx) >>> 0, 0)

    const bGameType = m.u8((pGame + 0x6a) >>> 0)
    const dwSaveToken = m.u32((pClient + 0x60) >>> 0) >>> 0
    const dwClientSaveTimestamp = m.u32((pClient + 0x68) >>> 0) >>> 0
    if (bGameType === 1 || bGameType === 2) {
      PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c(
        m,
        pClient,
        pGame,
        pPlayerUnit,
        bUnkFlag,
      )
      return 1
    }
    if (m.u32(0x6fd31c3c) !== 0) {
      return PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c(
        m,
        bUnkFlag,
        pPlayerUnit,
        pGame,
        szAccountName,
        szCharName,
        dwSaveToken,
        bSaveMerc,
        dwClientSaveTimestamp,
      )
    }
    PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c(
      m,
      pGame,
      pPlayerUnit,
      szAccountName,
      bUnkFlag,
      bSaveMerc,
    )
    return 1
  } finally {
    freeW9B1Stack(sp)
  }
}

/**
 * [7/25] Act 5 Quest 4 (Betrayal of Harrogath) Callback 01 (NPC Deactivate): handles Anya (`0x200`) dialogue completion (`0x4EA9`, `0x4EB4`).
 *
 * @dll D2Game.dll
 * @va 0x6FC7B7A0
 * @ordinalOrName D2Game_6FC7B7A0
 */
export function ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC7B7A0)
  const wNpcClassId = m.u16((pQuestArg + 0x14) >>> 0)
  const wMessageId = m.u16((pQuestArg + 0x18) >>> 0)
  const pQuestState = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (wNpcClassId !== 0x200) return

  if (wMessageId === 0x4ea9) {
    if (m.u8((pQuestData + 0x09) >>> 0) !== 0) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 2)
      m.setU8((pQuestState + 0x86) >>> 0, 1)
      m.setU8((pQuestState + 0x87) >>> 0, 1)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0),
        ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c,
        0,
        0,
      )
    }
    return
  }

  if (wMessageId !== 0x4eb4) return
  m.setU8((pQuestData + 0x14) >>> 0, 0)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((pQuestData + 0x04) >>> 0),
    ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
    0,
    0,
  )

  const pPlayer1 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame1 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pPlayerData1 = UNITS_GetPlayerData113c(m, pPlayer1) >>> 0
  const nDiff1 = m.u8((pGame1 + 0x6d) >>> 0)
  QUESTRECORD_SetQuestState113c(
    m,
    m.u32((pPlayerData1 + nDiff1 * 4 + 0x10) >>> 0),
    0x26,
    4,
  )

  const pPlayer2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame2 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pPlayerData2 = UNITS_GetPlayerData113c(m, pPlayer2) >>> 0
  const nDiff2 = m.u8((pGame2 + 0x6d) >>> 0)
  const isCompletedNow =
    DRLGWARP_TestRoomTileBit113c(
      m,
      m.u32((pPlayerData2 + nDiff2 * 4 + 0x10) >>> 0),
      0x26,
      0x0d,
    ) !== 0
  if (!isCompletedNow) {
    if (m.u8((pQuestData + 0x09) >>> 0) !== 0) return
    const pQuestRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0),
      m.u32((pQuestData + 0x04) >>> 0),
    ) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestRec, 0x26, 1) === 0) return
  }

  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestData, 5)
  QUESTS_DefaultSequenceFilter_6FC7AFB0_113c(m, pQuestData)
}

/**
 * [8/25] Act 5 Quest 1 (Siege on Harrogath) quest descriptor and state initializer (`0x6FC7BEA0`).
 *
 * @dll D2Game.dll
 * @va 0x6FC7BEA0
 * @ordinalOrName D2Game_6FC7BEA0
 */
export function ACT5Q1_InitQuestData_6FC7BEA0_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FC7BEA0)
  void ACT5Q1_Callback00_NpcActivate_6FC787C0_113c
  void ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c
  void ACT4Q2_Callback03_AltLevelChanged113c
  void ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c
  void ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c
  void ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c
  void ACT5Q4_Callback11_OnPlayerConnect_6FC79450_113c
  void ACT5Q1_StatusFilter_6FC76E00_113c
  void ACT5Q1_ActiveFilter_6FC76D80_113c
  void ACT5Q1_SeqFilter_6FC76D10_113c

  for (let i = 0; i < 15; i++) {
    m.setU32((pQuestData + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU8((pQuestData + 0x0c) >>> 0, 0)
  m.setU32((pQuestData + 0xa0) >>> 0, 0x6fc787c0)
  m.setU32((pQuestData + 0xc8) >>> 0, 0x6fc787a0)
  m.setU32((pQuestData + 0xac) >>> 0, 0x6fc7b380)
  m.setU32((pQuestData + 0xc0) >>> 0, 0x6fc7bdb0)
  m.setU32((pQuestData + 0xa8) >>> 0, 0x6fc7a720)
  m.setU32((pQuestData + 0xcc) >>> 0, 0x6fc7b4f0)
  m.setU32((pQuestData + 0xd4) >>> 0, 0x6fc79450)
  m.setU32((pQuestData + 0xdc) >>> 0, 0x6fd2acb8)
  m.setU8((pQuestData + 0x0a) >>> 0, 1)
  const pState = (pPreallocatedState !== 0 ? pPreallocatedState : m.alloc(0x18)) >>> 0
  m.setU32((pQuestData + 0x18) >>> 0, pState)
  m.setU32((pQuestData + 0xe0) >>> 0, 0x23)
  m.setU32((pQuestData + 0xe8) >>> 0, 0x6fc76e00)
  m.setU8((pQuestData + 0x0d) >>> 0, 4)
  m.setU32((pQuestData + 0xec) >>> 0, 0x6fc76d80)
  m.setU32((pQuestData + 0xf0) >>> 0, 0x6fc76d10)
  m.setU32((pQuestData + 0x10) >>> 0, 0x20)
  for (let i = 0; i < 6; i++) {
    m.setU32((pState + i * 4) >>> 0, 0)
  }
}

/**
 * [9/25] Validates and grants the Rite of Passage (Ancients) experience and quest completion reward (`0x6FC7C100`) to a player in Arreat Summit (`0x78`) and their sub-party.
 *
 * @dll D2Game.dll
 * @va 0x6FC7C100
 * @ordinalOrName D2Game_6FC7C100
 */
export function ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC7C100)
  const pRoom = UNITS_GetRoom113c(m, pPlayerUnit) >>> 0
  if (pRoom === 0) return 0

  const pQC = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQC !== 0 ? m.u32(pQC) >>> 0 : 0
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x23) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x2d5)
  }

  const nPlayerLevel = STATLIST_GetUnitBaseStat113c(m, pPlayerUnit, 0x0c, 0) | 0
  const nMinLevel = ((m.u8((pGame + 0x6d) >>> 0) + 1) * 20) | 0
  if (nPlayerLevel < nMinLevel) return 0
  if ((DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0) !== 0x78) return 0

  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const nQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, nQuestId, 0) !== 0) {
    return 0
  }

  QUESTRECORD_SetQuestState113c(m, pQuestRecord, m.u32((pQuest + 0xe0) >>> 0) | 0, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestRecord, m.u32((pQuest + 0xe0) >>> 0) | 0, 0)
  QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c(m, pPlayerUnit, pGame)
  const wPartyId = SUNITDMG_GetPlayerClientClassId113c(m, pPlayerUnit) & 0xffff
  if (wPartyId !== 0xffff) {
    PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
      m,
      pGame,
      wPartyId,
      (_m, pG, pMember, pArg) =>
        ACT5Q5_CheckAndGrantAncientsRewardInAct5_6FC7C080_113c(
          _m as SparseMemory113c,
          pG,
          pMember,
          pArg,
        ),
      0,
    )
  }
  return 0
}

/**
 * [10/25] Operates the Altar of the Heavens (`0x6FC7D0A0`) in Arreat Summit: destroys active town portals, sends NPC message `0x4E22`, advances quest `0x23` state, and activates the altar object.
 *
 * @dll D2Game.dll
 * @va 0x6FC7D0A0
 * @ordinalOrName D2Game_6FC7D0A0
 */
export function ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): number {
  hitD2GameVa113c(0x6FC7D0A0)
  const pGame = m.u32(pOpStrc >>> 0) >>> 0
  const pQC = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQC === 0) return 0
  let pQuest = m.u32(pQC) >>> 0
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 0x23) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return 0

  const pObject = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) return 0

  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    if (i32(m, (pQuestState + 0x0c) >>> 0) > 0) {
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        pGame,
        ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c,
        0,
        0,
      )
    }
    QUESTS_SendNpcMessagePacket27_113c(
      m,
      m.u32((pOpStrc + 0x08) >>> 0),
      m.u32((pOpStrc + 0x04) >>> 0),
      0x4e22,
    )
  } else if (m.u8((pQuest + 0x0c) >>> 0) < 4) {
    if (i32(m, (pQuestState + 0x0c) >>> 0) > 0) {
      ACT5Q5_DestroyAllPlayerPortalsInArreatSummit_6FC7D080_113c(m, pGame)
    }
    QUESTS_SendNpcMessagePacket27_113c(
      m,
      m.u32((pOpStrc + 0x08) >>> 0),
      m.u32((pOpStrc + 0x04) >>> 0),
      0x4e22,
    )
    if (m.u8((pQuest + 0x0c) >>> 0) < 2) {
      QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 2)
    }
    if (m.u8((pQuest + 0x0b) >>> 0) !== 3) {
      m.setU8((pQuest + 0x0b) >>> 0, 3)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0),
        ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
        0,
        0,
      )
    }
  }

  const pObj2 = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
  if (pObj2 === 0 || m.u32((pObj2 + 0x10) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pObj2, 1)
    m.setU32((pQuestState + 0x4c) >>> 0, 2)
  }
  return 0
}

const ANDARIEL_CHIPPED_GEM_CODES_6FD2A4D8_113C = [
  0x20766367,
  0x20726367,
  0x20626367,
  0x20796367,
  0x20676367,
  0x20776367,
  0x20636b73,
] as const

const ANDARIEL_STANDARD_GEM_CODES_6FD2A4F4_113C = [
  0x20767367,
  0x20727367,
  0x20627367,
  0x20797367,
  0x20677367,
  0x20777367,
  0x20756b73,
] as const

function advanceQuestControlLcgMod7_113c(m: SparseMemory113c, pQuestControl: number): number {
  const low = BigInt(m.u32((pQuestControl + 0x18) >>> 0))
  const high = BigInt(m.u32((pQuestControl + 0x1c) >>> 0))
  const prod = low * 0x6ac690c5n + high
  const newLow = Number(prod & 0xffffffffn) >>> 0
  const newHigh = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pQuestControl + 0x1c) >>> 0, newHigh)
  m.setU32((pQuestControl + 0x18) >>> 0, newLow)
  return (newLow % 7) | 0
}

/**
 * [11/25] Act 1 Quest 1 (Den of Evil) quest descriptor and `0x8C`-byte state initializer (`0x6FC85990`).
 *
 * @dll D2Game.dll
 * @va 0x6FC85990
 * @ordinalOrName D2Game_6FC85990
 */
export function ACT1Q1_InitQuestData_6FC85990_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FC85990)
  void ACT1Q1_Callback00_NpcActivate_6FC82220_113c
  void QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c
  void ACT1Q6_Callback03_LevelChanged113c
  void ACT1Q1_OnMonsterKilled_6FC85760_113c
  void ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c
  void ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c
  void ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c
  void ACT1Q2_CheckBloodRavenNpcAlert113c
  void QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c

  for (let i = 0; i < 15; i++) {
    m.setU32((pQuestData + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU32((pQuestData + 0xa0) >>> 0, 0x6fc82220)
  m.setU32((pQuestData + 0xc8) >>> 0, 0x6fc82170)
  m.setU32((pQuestData + 0xac) >>> 0, 0x6fc85040)
  m.setU32((pQuestData + 0xc0) >>> 0, 0x6fc85760)
  m.setU32((pQuestData + 0xa8) >>> 0, 0x6fc83c40)
  m.setU32((pQuestData + 0xcc) >>> 0, 0x6fc85260)
  m.setU32((pQuestData + 0xd4) >>> 0, 0x6fc820e0)
  m.setU32((pQuestData + 0xdc) >>> 0, 0x6fd28410)
  m.setU8((pQuestData + 0x0a) >>> 0, 1)
  m.setU8((pQuestData + 0x0c) >>> 0, 1)
  const pState = (pPreallocatedState !== 0 ? pPreallocatedState : m.alloc(0x8c)) >>> 0
  m.setU32((pQuestData + 0x18) >>> 0, pState)
  m.setU32((pQuestData + 0xe0) >>> 0, 1)
  m.setU32((pQuestData + 0xe4) >>> 0, 0x29)
  m.setU32((pQuestData + 0xe8) >>> 0, 0)
  m.setU8((pQuestData + 0x0d) >>> 0, 4)
  m.setU32((pQuestData + 0xec) >>> 0, 0x6fc80750)
  m.setU32((pQuestData + 0xf0) >>> 0, 0x6fc806e0)
  m.setU32((pQuestData + 0x10) >>> 0, 2)
  for (let i = 0; i < 0x23; i++) {
    m.setU32((pState + i * 4) >>> 0, 0)
  }
  m.setU16((pState + 0x80) >>> 0, 0)
}

/**
 * [12/25] Act 1 Quest 4 (Search for Cain): operates the Tree of Inifuss (`0x6FC85B40`), rolls and drops `bks ` (Scroll of Inifuss), and updates quest state.
 *
 * @dll D2Game.dll
 * @va 0x6FC85B40
 * @ordinalOrName D2Game_6FC85B40
 */
export function ACT1Q4_OperateInifussTree_6FC85B40_113c(
  m: SparseMemory113c,
  pOpStrc: number,
): number {
  hitD2GameVa113c(0x6FC85B40)
  void ACT1Q4_OnScrollPickedUpOrDropped_6FC854A0_113c
  const pGame = m.u32(pOpStrc >>> 0) >>> 0
  const pQC = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  let pQuest = pQC !== 0 ? m.u32(pQC) >>> 0 : 0
  while (pQuest !== 0) {
    if (m.u32(pQuest) === 4) break
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x828)
  }

  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, m.u32((pOpStrc + 0x04) >>> 0), 1)
    return 0
  }
  if (m.u8((pQuest + 0x0c) >>> 0) >= 6) return 0

  const pObject = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
  if (pObject !== 0 && m.u32((pObject + 0x10) >>> 0) !== 0) return 0

  const pPlayer = m.u32((pOpStrc + 0x08) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 4, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 4, 1) === 1) return 0

  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20646b62) !== 0 ||
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20736b62) !== 0
  ) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x13, pPlayer)
    return 0
  }

  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  SUNIT_SetUnitEventSound113c(m, pPlayer, 0x2d, 0)
  m.setU32((pObject + 0xb8) >>> 0, 0x20736b62)
  ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c(m, pQuest)
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuest, 4)

  const sp = allocW9B1Stack(m, 0x10)
  try {
    const pDroppedItem = ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
      m,
      m.u32(pOpStrc >>> 0),
      m.u32((pOpStrc + 0x04) >>> 0),
      2,
      sp,
      0,
      -1,
      0,
    ) >>> 0
    if (pDroppedItem !== 0) {
      m.setU32((pQuest + 0xc4) >>> 0, 0x6fc854a0)
      m.setU8((pQuest + 0x14) >>> 0, 0)
      m.setU8((pQuest + 0x0b) >>> 0, 2)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuest + 0x04) >>> 0),
        ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
        0,
        m.u32((pOpStrc + 0x08) >>> 0),
      )
      const nDropCount = (m.u32((pQuestState + 0x7c) >>> 0) + 1) >>> 0
      m.setU8((pQuestState + 0x4b) >>> 0, 1)
      m.setU32((pQuestState + 0x38) >>> 0, m.u32((pDroppedItem + 0x0c) >>> 0))
      m.setU32((pQuestState + 0x58) >>> 0, 1)
      m.setU8((pQuestState + 0x78) >>> 0, 1)
      m.setU32((pQuestState + 0x7c) >>> 0, nDropCount)
      UNITS_ChangeAnimMode113c(m, m.u32((pOpStrc + 0x04) >>> 0), 1)
    }
    m.setU8((pQuestState + 0x47) >>> 0, 1)
    const pFinalObj = m.u32((pOpStrc + 0x04) >>> 0) >>> 0
    m.setU32(
      (pQuestState + 0x30) >>> 0,
      pFinalObj === 0 ? 0xffffffff : m.u32((pFinalObj + 0x0c) >>> 0),
    )
    return 0
  } finally {
    freeW9B1Stack(sp)
  }
}

/**
 * [13/25] Act 1 Quest 6 (Sisters to the Slaughter): handles Andariel's death (`0x6FC87E00`), first-kill gem drops, party quest completion sync, and death timer scheduling.
 *
 * @dll D2Game.dll
 * @va 0x6FC87E00
 * @ordinalOrName D2Game_6FC87E00
 */
export function ACT1Q6_OnAndarielKilled_6FC87E00_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC87E00)
  void ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c
  void ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c

  const pQuestState = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  m.setU32((pQuestData + 0xa8) >>> 0, 0)

  const sp = allocW9B1Stack(m, 0x90)
  try {
    if (m.u8((pQuestData + 0x09) >>> 0) !== 0) {
      const pKiller = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
      if (pKiller !== 0) {
        const pGame1 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
        const pPlayerData1 = UNITS_GetPlayerData113c(m, pKiller) >>> 0
        const nDiff1 = m.u8((pGame1 + 0x6d) >>> 0)
        const pQuestRecord1 = m.u32((pPlayerData1 + nDiff1 * 4 + 0x10) >>> 0) >>> 0
        if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord1, 6, 0) === 0) {
          const pGame2 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
          const pPlayerData2 = UNITS_GetPlayerData113c(m, pKiller) >>> 0
          const nDiff2 = m.u8((pGame2 + 0x6d) >>> 0)
          const pQuestRecord2 = m.u32((pPlayerData2 + nDiff2 * 4 + 0x10) >>> 0) >>> 0
          if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord2, 6, 1) === 0) {
            const pGame3 = m.u32((pQuestData + 0x04) >>> 0) >>> 0
            const pPlayerData3 = UNITS_GetPlayerData113c(m, pKiller) >>> 0
            const nDiff3 = m.u8((pGame3 + 0x6d) >>> 0)
            const pQuestRecord3 = m.u32((pPlayerData3 + nDiff3 * 4 + 0x10) >>> 0) >>> 0
            ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(
              m,
              pKiller,
              pQuestRecord3,
              pGame3,
            )

            for (let i = 0; i < 2; i++) {
              const pQC = m.u32((m.u32((pQuestData + 0x04) >>> 0) + 0x10f4) >>> 0) >>> 0
              if (pQC === 0) throw new D2CommonAssertError('0x6fd19ff9', 0x1fb)
              const rem = advanceQuestControlLcgMod7_113c(m, pQC)
              const pBoss = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
              const dwMemCode = m.u32((0x6fd2a4d8 + rem * 4) >>> 0) >>> 0
              const dwCode =
                dwMemCode !== 0 ? dwMemCode : ANDARIEL_CHIPPED_GEM_CODES_6FD2A4D8_113C[rem]!
              m.setU32((pBoss + 0xb8) >>> 0, dwCode)
              ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
                m,
                m.u32((pQuestData + 0x04) >>> 0),
                m.u32((pQuestArg + 0x08) >>> 0),
                2,
                sp,
                0,
                -1,
                0,
              )
            }

            const pQC2 = m.u32((m.u32((pQuestData + 0x04) >>> 0) + 0x10f4) >>> 0) >>> 0
            if (pQC2 === 0) throw new D2CommonAssertError('0x6fd19ff9', 0x1fb)
            const rem2 = advanceQuestControlLcgMod7_113c(m, pQC2)
            const pBoss2 = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
            const dwMemCode2 = m.u32((0x6fd2a4f4 + rem2 * 4) >>> 0) >>> 0
            const dwCode2 =
              dwMemCode2 !== 0 ? dwMemCode2 : ANDARIEL_STANDARD_GEM_CODES_6FD2A4F4_113C[rem2]!
            m.setU32((pBoss2 + 0xb8) >>> 0, dwCode2)
            ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(
              m,
              m.u32((pQuestData + 0x04) >>> 0),
              m.u32((pQuestArg + 0x08) >>> 0),
              2,
              sp,
              0,
              -1,
              0,
            )
            m.setU32((m.u32((pQuestArg + 0x08) >>> 0) + 0xb8) >>> 0, 0)
          }
        }
      }

      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(pQuestArg >>> 0),
        ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c,
        0,
        m.u32((pQuestArg + 0x08) >>> 0),
      )
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(pQuestArg >>> 0),
        ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c,
        0,
        m.u32((pQuestArg + 0x08) >>> 0),
      )
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32(pQuestArg >>> 0),
        ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c,
        0,
        m.u32((pQuestArg + 0x08) >>> 0),
      )
    }

    const pBossUnit = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
    m.setU32(
      (pQuestState + 0x18c) >>> 0,
      pBossUnit === 0 ? 0xffffffff : m.u32((pBossUnit + 0x0c) >>> 0),
    )
    m.setU16((pQuestState + 0x192) >>> 0, 1)

    if (m.u8((pQuestData + 0x09) >>> 0) !== 0) {
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 1, pQuestData, 0x6fc87c60)
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((pQuestData + 0x04) >>> 0),
        ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c,
        0,
        0,
      )
    }

    m.setU8((pQuestState + 0x194) >>> 0, 1)
    m.setU8((pQuestData + 0x0c) >>> 0, 4)
    const pMsgBuf = (sp + 0x08) >>> 0
    const msg = 'changing state to 4\n'
    for (let i = 0; i < msg.length; i++) {
      m.setU8((pMsgBuf + i) >>> 0, msg.charCodeAt(i))
    }
    m.setU8((pMsgBuf + msg.length) >>> 0, 0)
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        pMsgBuf,
        m.u32((pQuestData + 0x04) >>> 0),
        4,
      )
    }

    m.setU32((pQuestData + 0xc8) >>> 0, 0x6fc80a30)
    m.setU32((pQuestData + 0xc0) >>> 0, 0)
  } finally {
    freeW9B1Stack(sp)
  }
}

/**
 * [14/25] Act 1 Quest 5 (Tools of the Trade) quest descriptor and `0x120`-byte state initializer (`0x6FC89200`).
 *
 * @dll D2Game.dll
 * @va 0x6FC89200
 * @ordinalOrName D2Game_6FC89200
 */
export function ACT1Q5_InitQuestData_6FC89200_113c(
  m: SparseMemory113c,
  pQuestData: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FC89200)
  void ACT1Q3_Callback00_NpcActivate_6FC81030_113c
  void ACT1Q2_Callback03_LevelChanged113c
  void ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c
  void ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c
  void ACT1Q5_OnAndarielKilled_6FC88B90_113c
  void ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c
  void ACT1Q4_CheckCainTownNpcAlert113c
  void QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c

  for (let i = 0; i < 15; i++) {
    m.setU32((pQuestData + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU32((pQuestData + 0xa0) >>> 0, 0x6fc81030)
  m.setU32((pQuestData + 0xac) >>> 0, 0x6fc842d0)
  m.setU32((pQuestData + 0xcc) >>> 0, 0x6fc84430)
  m.setU32((pQuestData + 0xc8) >>> 0, 0x6fc811b0)
  m.setU32((pQuestData + 0xc0) >>> 0, 0x6fc88b90)
  m.setU32((pQuestData + 0xd4) >>> 0, 0x6fc80e00)
  m.setU32((pQuestData + 0xe0) >>> 0, 5)
  m.setU32((pQuestData + 0xdc) >>> 0, 0x6fd29c38)
  m.setU8((pQuestData + 0x0b) >>> 0, 0)
  m.setU8((pQuestData + 0x0a) >>> 0, 1)
  m.setU8((pQuestData + 0x0c) >>> 0, 0)
  m.setU32((pQuestData + 0xe8) >>> 0, 0)
  m.setU8((pQuestData + 0x0d) >>> 0, 4)
  m.setU32((pQuestData + 0xec) >>> 0, 0x6fc80f20)
  m.setU32((pQuestData + 0xf0) >>> 0, 0x6fc801b0)
  const pState = (pPreallocatedState !== 0 ? pPreallocatedState : m.alloc(0x120)) >>> 0
  m.setU32((pQuestData + 0x18) >>> 0, pState)
  m.setU32((pQuestData + 0x10) >>> 0, 3)
  for (let i = 0; i < 0x48; i++) {
    m.setU32((pState + i * 4) >>> 0, 0)
  }
  m.setU16((pState + 0x10c) >>> 0, 0)
}

/**
 * [15/25] Loots a player corpse unit (`0x6FC99910`): restores stored experience if self-looted, transfers items, frees corpse record, broadcasts `0x8E`, and removes the corpse unit.
 *
 * @dll D2Game.dll
 * @va 0x6FC99910
 * @ordinalOrName D2Game_6FC99910
 */
export function PLAYER_LootPlayerCorpseUnit_6FC99910_113c(
  m: SparseMemory113c,
  pGame: number,
  pLooterPlayer: number,
  pCorpseUnit: number,
): void {
  hitD2GameVa113c(0x6FC99910)
  if (STATES_CheckState113c(m, pCorpseUnit, 7) === 0) return
  if (PLAYER_CanLootCorpse_6FC97E70_113c(m, pLooterPlayer, pGame, pCorpseUnit) === 0) return

  const dwOwnerGuid = INVENTORY_GetLeftItemGuid113c(m, m.u32((pCorpseUnit + 0x60) >>> 0)) >>> 0
  const dwLooterGuid =
    pLooterPlayer === 0 ? 0xffffffff : (m.u32((pLooterPlayer + 0x0c) >>> 0) >>> 0)
  if (dwLooterGuid === dwOwnerGuid) {
    const nStoredExp = STATLIST_GetUnitStat113c(m, pCorpseUnit, 0x0d, 0) | 0
    if (nStoredExp !== 0) {
      STATLIST_SetUnitStat113c(m, pCorpseUnit, 0x0d, 0, 0)
      SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c(m, pLooterPlayer, nStoredExp, pGame)
    }
  }

  if (ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c(m, pCorpseUnit, pGame, pLooterPlayer) === 0) {
    SUNIT_SetUnitEventSound113c(m, pLooterPlayer, 0x17, pLooterPlayer)
    return
  }

  INVENTORY_FreeCorpse113c(
    m,
    m.u32((pLooterPlayer + 0x60) >>> 0),
    m.u32((pCorpseUnit + 0x0c) >>> 0),
    1,
  )
  const pRoom = UNITS_GetRoom113c(m, pCorpseUnit) >>> 0
  DUNGEON_AddRoomPortalNode113c(
    m,
    pRoom,
    m.u32(pCorpseUnit >>> 0),
    m.u32((pCorpseUnit + 0x0c) >>> 0),
  )

  const sp = allocW9B1Stack(m, 0x10)
  try {
    m.setU8(sp, 0x8e)
    m.setU8((sp + 1) >>> 0, 0)
    m.setU32((sp + 2) >>> 0, m.u32((pLooterPlayer + 0x0c) >>> 0))
    m.setU32((sp + 6) >>> 0, m.u32((pCorpseUnit + 0x0c) >>> 0))
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      pGame,
      (mem, _g, pPlr, pPkt) => {
        S2C_Send10BytePacketToPlayerUnit_6FCAC530_113c(mem, pPlr, pPkt)
      },
      sp,
    )
  } finally {
    freeW9B1Stack(sp)
  }

  UNITS_SetTargetUnitForDynamicUnitEx113c(m, pCorpseUnit)
  SUNIT_FreeUnit113c(m, pGame, pCorpseUnit)
  SUNIT_SetUnitEventSound113c(m, pLooterPlayer, 0x5d, pLooterPlayer)
}

/**
 * @dll D2Game.dll
 * @va 0x6FCA5780
 * @ordinalOrName D2Game_6FCA5780
 */
export function AI_SummonerThink_6FCA5780_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCA5780)
  const sp = allocStack(m, 0x20);
  const pTarget = m.u32((pAiTickArgs + 0x08) >>> 0);
  const nTargetDist = i32(m, (pAiTickArgs + 0x14) >>> 0);
  const pMonStatsTxt = m.u32((pAiTickArgs + 0x1c) >>> 0);
  const pAiControl = m.u32(pAiTickArgs >>> 0);
  if (m.u32((pAiControl + 0x14) >>> 0) === 0) {
    ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c(m, pGame);
    m.setU32((pAiControl + 0x14) >>> 0, 1);
  }
  const rollSeed100 = (): number => {
    const prod = BigInt(m.u32((pUnit + 0x20) >>> 0)) * 0x6ac690c5n + BigInt(m.u32((pUnit + 0x24) >>> 0));
    const low = Number(prod & 0xffffffffn) >>> 0;
    const high = Number((prod >> 32n) & 0xffffffffn) >>> 0;
    m.setU32((pUnit + 0x24) >>> 0, high);
    m.setU32((pUnit + 0x20) >>> 0, low);
    return (low % 100) >>> 0;
  };
  if (nTargetDist < 5) {
    const rFlee = rollSeed100();
    const nDiff0 = m.u8((pGame + 0x6d) >>> 0);
    if ((rFlee | 0) < i16(m, (pMonStatsTxt + nDiff0 * 2 + 0x74) >>> 0)) {
      AI_FleeFrom113c(m, pGame, pUnit, pTarget, 6, 0);
    }
  }
  const coldRes = STATLIST_GetUnitStat113c(m, pTarget, 0x2b, 0) | 0;
  const fireRes = STATLIST_GetUnitStat113c(m, pTarget, 0x27, 0) | 0;
  let useCold = fireRes >= coldRes ? 1 : 0;
  const targetType = m.u32(pTarget >>> 0);
  const pTargetPath = m.u32((pTarget + 0x2c) >>> 0);
  let targetX = 0;
  if (targetType === 2 || (targetType > 3 && targetType <= 5)) {
    targetX = m.u32((pTargetPath + 0x0c) >>> 0);
  } else if (pTargetPath !== 0) {
    targetX = PATH_GetPosX113c(m, pTargetPath) >>> 0;
  }
  let targetY = 0;
  const targetType2 = m.u32(pTarget >>> 0);
  const pTargetPath2 = m.u32((pTarget + 0x2c) >>> 0);
  if (targetType2 === 2 || (targetType2 > 3 && targetType2 <= 5)) {
    targetY = m.u32((pTargetPath2 + 0x10) >>> 0);
  } else if (pTargetPath2 !== 0) {
    targetY = PATH_GetPosY113c(m, pTargetPath2) >>> 0;
  }
  const rAttack = rollSeed100();
  const nDiff1 = m.u8((pGame + 0x6d) >>> 0);
  if ((rAttack | 0) >= i16(m, (pMonStatsTxt + nDiff1 * 2 + 0x56) >>> 0)) {
    AI_IdleWander113c(m, pGame, pUnit);
    freeStack(m, 0x20);
    return;
  }
  if (i16(m, (pMonStatsTxt + 0x178) >>> 0) >= 0) {
    const rWeaken = rollSeed100();
    const nDiff2 = m.u8((pGame + 0x6d) >>> 0);
    if ((rWeaken | 0) < i16(m, (pMonStatsTxt + nDiff2 * 2 + 0x5c) >>> 0)) {
      AI_CastSkillWithMode113c(
        m,
        m.u8((pMonStatsTxt + 0x184) >>> 0),
        pUnit,
        pGame,
        i16(m, (pMonStatsTxt + 0x178) >>> 0),
        pTarget,
        targetX,
        targetY,
      );
      freeStack(m, 0x20);
      return;
    }
  }
  const pObstacleOrTarget = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, pUnit, pGame, 0, sp) >>> 0;
  const rToggle = rollSeed100();
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  if ((rToggle | 0) > i16(m, (pMonStatsTxt + nDiff * 2 + 0x62) >>> 0)) {
    useCold = useCold === 0 ? 1 : 0;
  }
  if (useCold !== 0) {
    if (
      i16(m, (pMonStatsTxt + 0x172) >>> 0) >= 0 &&
      (i32(m, (pGame + 0xa8) >>> 0) | 0) > (i32(m, (pAiControl + 0x18) >>> 0) | 0) &&
      nTargetDist < i16(m, (pMonStatsTxt + nDiff * 2 + 0x7a) >>> 0)
    ) {
      const nextFrame = (i32(m, (pGame + 0xa8) >>> 0) + i16(m, (pMonStatsTxt + nDiff * 2 + 0x68) >>> 0)) >>> 0;
      m.setU32((pAiControl + 0x18) >>> 0, nextFrame);
      AI_CastSkillWithMode113c(
        m,
        m.u8((pMonStatsTxt + 0x181) >>> 0),
        pUnit,
        pGame,
        i16(m, (pMonStatsTxt + 0x172) >>> 0),
        pTarget,
        targetX,
        targetY,
      );
      freeStack(m, 0x20);
      return;
    }
    const wSkill1 = i16(m, (pMonStatsTxt + 0x170) >>> 0);
    if (
      wSkill1 >= 0 &&
      pObstacleOrTarget !== 0 &&
      nTargetDist < i16(m, (pMonStatsTxt + nDiff * 2 + 0x80) >>> 0)
    ) {
      AI_CastSkillWithMode113c(
        m,
        m.u8((pMonStatsTxt + 0x180) >>> 0),
        pUnit,
        pGame,
        wSkill1,
        pObstacleOrTarget,
        targetX,
        targetY,
      );
      freeStack(m, 0x20);
      return;
    }
  }
  if (
    i16(m, (pMonStatsTxt + 0x176) >>> 0) >= 0 &&
    (i32(m, (pGame + 0xa8) >>> 0) | 0) > (i32(m, (pAiControl + 0x1c) >>> 0) | 0)
  ) {
    const nextFrame = (i32(m, (pGame + 0xa8) >>> 0) + i16(m, (pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0)) >>> 0;
    m.setU32((pAiControl + 0x1c) >>> 0, nextFrame);
    AI_CastSkillWithMode113c(
      m,
      m.u8((pMonStatsTxt + 0x183) >>> 0),
      pUnit,
      pGame,
      i16(m, (pMonStatsTxt + 0x176) >>> 0),
      pTarget,
      targetX,
      targetY,
    );
    freeStack(m, 0x20);
    return;
  }
  const wSkill3 = i16(m, (pMonStatsTxt + 0x174) >>> 0);
  if (
    wSkill3 >= 0 &&
    pObstacleOrTarget !== 0 &&
    nTargetDist < i16(m, (pMonStatsTxt + nDiff * 2 + 0x80) >>> 0)
  ) {
    AI_CastSkillWithMode113c(
      m,
      m.u8((pMonStatsTxt + 0x182) >>> 0),
      pUnit,
      pGame,
      wSkill3,
      pObstacleOrTarget,
      targetX,
      targetY,
    );
    freeStack(m, 0x20);
    return;
  }
  if (
    useCold === 0 &&
    i16(m, (pMonStatsTxt + 0x172) >>> 0) >= 0 &&
    (i32(m, (pGame + 0xa8) >>> 0) | 0) > (i32(m, (pAiControl + 0x18) >>> 0) | 0) &&
    nTargetDist < i16(m, (pMonStatsTxt + nDiff * 2 + 0x7a) >>> 0)
  ) {
    const nextFrame = (i32(m, (pGame + 0xa8) >>> 0) + i16(m, (pMonStatsTxt + nDiff * 2 + 0x68) >>> 0)) >>> 0;
    m.setU32((pAiControl + 0x18) >>> 0, nextFrame);
    AI_CastSkillWithMode113c(
      m,
      m.u8((pMonStatsTxt + 0x181) >>> 0),
      pUnit,
      pGame,
      i16(m, (pMonStatsTxt + 0x172) >>> 0),
      pTarget,
      targetX,
      targetY,
    );
    freeStack(m, 0x20);
    return;
  }
  const wSkill5 = i16(m, (pMonStatsTxt + 0x178) >>> 0);
  if (wSkill5 >= 0) {
    AI_CastSkillWithMode113c(
      m,
      m.u8((pMonStatsTxt + 0x184) >>> 0),
      pUnit,
      pGame,
      wSkill5,
      pTarget,
      targetX,
      targetY,
    );
    freeStack(m, 0x20);
    return;
  }
  AI_IdleWander113c(m, pGame, pUnit, 4);
  freeStack(m, 0x20);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCA8380
 * @ordinalOrName D2Game_6FCA8380
 */
export function AI_GreaterMummyThink_6FCA8380_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  pAiTickArgs: number,
): void {
  hitD2GameVa113c(0x6FCA8380)
  const nTargetDist = i32(m, (pAiTickArgs + 0x14) >>> 0);
  const bInCombat = m.u32((pAiTickArgs + 0x18) >>> 0);
  const pTarget = m.u32((pAiTickArgs + 0x08) >>> 0);
  const pMonStatsTxt = m.u32((pAiTickArgs + 0x1c) >>> 0);
  const rollSeed = (): number => {
    const prod = BigInt(m.u32((pUnit + 0x20) >>> 0)) * 0x6ac690c5n + BigInt(m.u32((pUnit + 0x24) >>> 0));
    const low = Number(prod & 0xffffffffn) >>> 0;
    const high = Number((prod >> 32n) & 0xffffffffn) >>> 0;
    m.setU32((pUnit + 0x24) >>> 0, high);
    m.setU32((pUnit + 0x20) >>> 0, low);
    return low;
  };
  if (bInCombat !== 0) {
    const r = (rollSeed() % 100) >>> 0;
    const nDiff = m.u8((pGame + 0x6d) >>> 0);
    if ((r | 0) < i16(m, (pMonStatsTxt + nDiff * 2 + 0x56) >>> 0)) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
      let nVel = 0x64;
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0)) >>> 0;
        if (pMonStats2 !== 0) {
          const pTable = m.u32(0x6fd18be0);
          const mask = pTable !== 0 ? m.u32((pTable + 0x10) >>> 0) : 0x10;
          if ((m.u8((pMonStats2 + 0x104) >>> 0) & mask) !== 0) nVel = 0x65;
        }
      }
      void nVel;
      MONSTER_StartMode113c(m, pGame, pUnit, 4, pTarget, 0, 0);
      return;
    }
  }
  if (nTargetDist < 5) {
    const r = (rollSeed() % 100) >>> 0;
    const nDiff = m.u8((pGame + 0x6d) >>> 0);
    if ((r | 0) < i16(m, (pMonStatsTxt + nDiff * 2 + 0x56) >>> 0)) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
      let nVel = 0x64;
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0)) >>> 0;
        if (pMonStats2 !== 0) {
          const pTable = m.u32(0x6fd18be0);
          const mask = pTable !== 0 ? m.u32((pTable + 0x14) >>> 0) : 0x20;
          if ((m.u8((pMonStats2 + 0x104) >>> 0) & mask) !== 0) nVel = 0x65;
        }
      }
      void nVel;
      MONSTER_StartMode113c(m, pGame, pUnit, 5, pTarget, 0, 0);
      return;
    }
  }
  const sp = allocStack(m, 0x30);
  const pScanCtx = sp;
  const nDiff0 = m.u8((pGame + 0x6d) >>> 0);
  const aip1 = i16(m, (pMonStatsTxt + nDiff0 * 2 + 0x6e) >>> 0);
  m.setU32((pScanCtx + 0x00) >>> 0, 0);
  m.setU32((pScanCtx + 0x04) >>> 0, 0);
  m.setU32((pScanCtx + 0x08) >>> 0, 0);
  m.setU32((pScanCtx + 0x0c) >>> 0, 0);
  m.setU32((pScanCtx + 0x10) >>> 0, Math.imul(aip1, aip1) >>> 0);
  m.setU32((pScanCtx + 0x14) >>> 0, 0);
  m.setU32((pScanCtx + 0x18) >>> 0, 0);
  const dwClassId = pUnit !== 0 ? i32(m, (pUnit + 0x04) >>> 0) : -1;
  const pDataTables = m.u32(m.u32(0x6fd1829c));
  const radamentId = pDataTables !== 0 && i32(m, (pDataTables + 0xa80) >>> 0) > 0xe5 ? 0xe5 : -1;
  if (dwClassId === radamentId) {
    ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c(m, pGame, pUnit);
    const nDiffRad = m.u8((pGame + 0x6d) >>> 0);
    const aip1Rad = (i16(m, (pMonStatsTxt + nDiffRad * 2 + 0x6e) >>> 0) + 10) | 0;
    m.setU32((pScanCtx + 0x10) >>> 0, Math.imul(aip1Rad, aip1Rad) >>> 0);
    m.setU32((pScanCtx + 0x14) >>> 0, 1);
    if (nDiffRad === 0) {
      m.setU32((pScanCtx + 0x18) >>> 0, 1);
    }
  }
  hitD2GameVa113c(0x6FCD17B0);
  MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(
    m,
    pUnit,
    0x6fc9b8e0,
    pGame,
    pScanCtx,
    (mem, _pg, orig, cand, ctx) =>
      AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c(mem as SparseMemory113c, orig, cand, ctx),
  );
  if (m.u32(pScanCtx) === 0xdeadbeef) {
    AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c(m, pUnit, pTarget, pScanCtx);
  }
  const pHealTarget = m.u32((pScanCtx + 0x04) >>> 0);
  if (i16(m, (pMonStatsTxt + 0x172) >>> 0) >= 0 && pHealTarget !== 0) {
    const r = (rollSeed() % 100) >>> 0;
    const nDiff = m.u8((pGame + 0x6d) >>> 0);
    if ((r | 0) < i16(m, (pMonStatsTxt + nDiff * 2 + 0x62) >>> 0)) {
      UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit, pHealTarget);
      AI_CastSkillWithMode113c(
        m,
        m.u8((pMonStatsTxt + 0x181) >>> 0),
        pUnit,
        pGame,
        i16(m, (pMonStatsTxt + 0x172) >>> 0),
        pHealTarget,
        0,
        0,
      );
      freeStack(m, 0x30);
      return;
    }
  }
  const pCorpse = m.u32((pScanCtx + 0x00) >>> 0);
  if (pCorpse !== 0) {
    const r = (rollSeed() % 100) >>> 0;
    const nDiff = m.u8((pGame + 0x6d) >>> 0);
    if ((r | 0) < i16(m, (pMonStatsTxt + nDiff * 2 + 0x5c) >>> 0)) {
      const wSkill1 = i16(m, (pMonStatsTxt + 0x170) >>> 0);
      if (SKILLS_CanMonsterCastAtTarget113c(m, 0, pCorpse, pUnit, wSkill1, 0, undefined, pGame) !== 0) {
        UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit, pCorpse);
        AI_CastSkillMode14_113c(m, pUnit, wSkill1, pGame, pCorpse, 0, 0);
        freeStack(m, 0x30);
        return;
      }
    }
  }
  if (i16(m, (pMonStatsTxt + 0x174) >>> 0) >= 0) {
    const r = (rollSeed() % 100) >>> 0;
    const nDiff = m.u8((pGame + 0x6d) >>> 0);
    if ((r | 0) < i16(m, (pMonStatsTxt + nDiff * 2 + 0x68) >>> 0)) {
      const pBoltTarget = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(
        m,
        pUnit,
        pGame,
        0,
        (pScanCtx + 0x20) >>> 0,
      ) >>> 0;
      if (pBoltTarget !== 0) {
        AI_CastSkillWithMode113c(
          m,
          m.u8((pMonStatsTxt + 0x182) >>> 0),
          pUnit,
          pGame,
          i16(m, (pMonStatsTxt + 0x174) >>> 0),
          pBoltTarget,
          0,
          0,
        );
        freeStack(m, 0x30);
        return;
      }
    }
  }
  const getAiControl = (): number => {
    if (pUnit !== 0 && m.u32(pUnit) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0);
      if (pMonData !== 0) return m.u32((pMonData + 0x2c) >>> 0);
    }
    return 0;
  };
  if (i32(m, (pScanCtx + 0x0c) >>> 0) <= 0) {
    const pAiCtrl = getAiControl();
    if (pAiCtrl !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32);
    AI_ApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 3, 0);
    freeStack(m, 0x30);
    return;
  }
  if (((rollSeed() % 100) >>> 0) < 0x32) {
    const rStep = rollSeed() & 0xff;
    let nParam = rStep >= 0x80 ? 6 : 5;
    if (nParam === 1) nParam = 7;
    const pAiCtrl = getAiControl();
    if (pAiCtrl !== 0) {
      if (nParam !== 0) m.setU32((pAiCtrl + 0x18) >>> 0, nParam);
      m.setU8((pAiCtrl + 0x20) >>> 0, 3);
    }
    AI_ApproachTarget113c(m, pGame, pUnit, pTarget, 2, 0, 0, 1, 0);
    freeStack(m, 0x30);
    return;
  }
  AI_Stall113c(m, pGame, pUnit, 6);
  freeStack(m, 0x30);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB57F0
 * @ordinalOrName D2Game_6FCB57F0
 */
export function SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c(
  m: SparseMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB57F0)
  if ((nSkillId | 0) < 0) return 0;
  const pDataTables = m.u32(m.u32(0x6fd1829c));
  if (pDataTables === 0 || (nSkillId | 0) >= (i32(m, (pDataTables + 0xba0) >>> 0) | 0)) return 0;
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0);
  const offset = Math.imul(nSkillId, 0x23c);
  const pSkillsTxt = (pSkillsTxtBase + offset) >>> 0;
  if (pSkillsTxt === 0) return 0;
  const sp = allocStack(m, 0xa0);
  const pOutY = (sp + 0x00) >>> 0;
  const pOutX = (sp + 0x04) >>> 0;
  if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, pOutX, pOutY) === 0) {
    freeStack(m, 0xa0);
    return 0;
  }
  let nRadius = SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c(m, pUnit, nSkillId, nSkillLevel) | 0;
  if (nRadius === 0) {
    nRadius = SKILLS_EvalCalcByOffset113c(m, pUnit, m.u32((pSkillsTxt + 0x64) >>> 0), nSkillId, nSkillLevel) | 0;
  }
  const pDmg = (sp + 0x28) >>> 0;
  for (let i = 0; i < 0x70; i += 4) {
    m.setU32((pDmg + i) >>> 0, 0);
  }
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, pUnit, nSkillId, pDmg, nSkillLevel);
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, nSkillId, pUnit, pDmg, nSkillLevel);
  m.setU16((pDmg + 0x04) >>> 0, (m.u16((pDmg + 0x04) >>> 0) | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff);
  m.setU32((pDmg + 0x00) >>> 0, (m.u32((pDmg + 0x00) >>> 0) | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0);
  const nParam56 = SKILLS_EvalParam56DimReturns113c(m, nSkillLevel, nSkillId) >>> 0;
  const pAuraArgs = (sp + 0x08) >>> 0;
  m.setU32((pAuraArgs + 0x00) >>> 0, pDmg);
  m.setU32((pAuraArgs + 0x04) >>> 0, nParam56);
  m.setU32((pAuraArgs + 0x08) >>> 0, m.u32((pSkillsTxt + 0x150) >>> 0));
  m.setU32((pAuraArgs + 0x0c) >>> 0, m.u32((pSkillsTxt + 0x154) >>> 0));
  AURA_ForEachUnitInRadius113c(
    m,
    pGame,
    pUnit,
    m.u32(pOutX),
    m.u32(pOutY),
    nRadius,
    m.u32((pSkillsTxt + 0x50) >>> 0),
    0x6fcb54f0,
    pAuraArgs,
    0,
    (_m, pArg, pDef) => AURA_ApplyRadialDamageCallback_6FCB54F0_113c(_m as SparseMemory113c, pArg, pDef),
  );
  freeStack(m, 0xa0);
  return 1;
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB6F40
 * @ordinalOrName D2Game_6FCB6F40
 */
export function PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c(
  m: SparseMemory113c,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCB6F40)
  const pDataTablesPtr = m.u32(0x6fd1829c);
  if (pDataTablesPtr === 0) return;
  let pDataTables = m.u32(pDataTablesPtr);
  let nCount = i32(m, (pDataTables + 0xbf0) >>> 0);
  for (let i = 0, offset = 0; i < nCount; i++, offset += 0xe0) {
    if (offset >= 0 && i < nCount) {
      const pPetTypeBase = m.u32((pDataTables + 0xbe8) >>> 0);
      const pRec = (pPetTypeBase + offset) >>> 0;
      if (pRec !== 0) {
        const wDefaultMax = i16(m, (pRec + 0x0a) >>> 0);
        PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(m, i, pPlayerUnit, pGame, wDefaultMax);
      }
    }
    pDataTables = m.u32(m.u32(0x6fd1829c));
    nCount = i32(m, (pDataTables + 0xbf0) >>> 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB6FA0
 * @ordinalOrName D2Game_6FCB6FA0
 */
export function PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FCB6FA0)
  if (pPlayerUnit === 0 || m.u32(pPlayerUnit) !== 0) return;
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0;
  if (pPlayerData === 0 || m.u32((pPlayerData + 0x44) >>> 0) === 0) return;
  const pSkillList = m.u32((pPlayerUnit + 0xa8) >>> 0);
  if (pSkillList === 0) return;
  const maxCounts = new Int32Array(256);
  let pSkill = SKILLS_GetFirstSkillFromSkillList113c(m, pSkillList) >>> 0;
  while (pSkill !== 0) {
    const pNextSkill = SKILLS_GetNextSkill113c(m, pSkill) >>> 0;
    const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1ba38, 0x473) | 0;
    const nLevel = SKILLS_EvaluateSkillLevel113c(m, pPlayerUnit, pSkill, 1) | 0;
    if (nSkillId >= 0) {
      const pDataTables = m.u32(m.u32(0x6fd1829c));
      if (pDataTables !== 0 && nSkillId < i32(m, (pDataTables + 0xba0) >>> 0)) {
        const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(nSkillId, 0x23c)) >>> 0;
        if (pSkillsTxt !== 0) {
          const nPetType = (m.u8((pSkillsTxt + 0xbe) >>> 0) << 24) >> 24;
          if (nPetType > 0 && nPetType < i32(m, (pDataTables + 0xbf0) >>> 0)) {
            let nPetMax = SKILLS_EvalCalcByOffset113c(
              m,
              pPlayerUnit,
              m.u32((pSkillsTxt + 0xc0) >>> 0),
              nSkillId,
              nLevel,
            ) | 0;
            if (nPetMax < 1) nPetMax = 1;
            if (nPetMax > maxCounts[nPetType]) {
              maxCounts[nPetType] = nPetMax;
              PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(m, nPetType, pPlayerUnit, pGame, nPetMax);
            }
          }
        }
      }
    }
    pSkill = pNextSkill;
  }
  const pDataTablesEnd = m.u32(m.u32(0x6fd1829c));
  if (pDataTablesEnd === 0) return;
  let nPetTypesCount = i32(m, (pDataTablesEnd + 0xbf0) >>> 0);
  for (let i = 0; i < nPetTypesCount; i++) {
    if (maxCounts[i] <= 0) {
      const pPetTypeTxt = PETTYPE_GetRecordPtrFast_6FC21B60_113c(m, i) >>> 0;
      if (pPetTypeTxt !== 0) {
        PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(
          m,
          i,
          pPlayerUnit,
          pGame,
          i16(m, (pPetTypeTxt + 0x0a) >>> 0),
        );
      }
    }
    nPetTypesCount = i32(m, (m.u32(m.u32(0x6fd1829c)) + 0xbf0) >>> 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCB7340
 * @ordinalOrName D2Game_6FCB7340
 */
export function PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  nX: number,
  nY: number,
): void {
  hitD2GameVa113c(0x6FCB7340)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0;
  if (pPlayerData === 0) return;
  const pPetListWrapper = m.u32((pPlayerData + 0x44) >>> 0);
  if (pPetListWrapper === 0) return;
  const pTargetRoom = UNITS_GetRoom113c(m, pPlayerUnit) >>> 0;
  const pDataTablesPtr = m.u32(0x6fd1829c);
  if (pDataTablesPtr === 0) return;
  let pDataTables = m.u32(pDataTablesPtr);
  let nPetTypesCount = i32(m, (pDataTables + 0xbf0) >>> 0);
  if (nPetTypesCount <= 1) return;
  let nPetType = 1;
  let slotOffset = 0x0c;
  let txtOffset = 0xe0;
  while (nPetType < nPetTypesCount) {
    if (slotOffset >= 0 && nPetType < nPetTypesCount) {
      const pPetSlotBase = m.u32(pPetListWrapper);
      const pPetSlot = (pPetSlotBase + slotOffset) >>> 0;
      if (pPetSlot !== 0) {
        const pPetTypeBase = m.u32((pDataTables + 0xbe8) >>> 0);
        const pPetTypeRec = (pPetTypeBase + txtOffset) >>> 0;
        if (pPetTypeRec !== 0) {
          const bWarpFlag = m.u8((pPetTypeRec + 0x04) >>> 0);
          const pWarpMasks = m.u32(0x6fd18be0);
          const mask0 = pWarpMasks !== 0 ? m.u32(pWarpMasks) : 1;
          const mask1 = pWarpMasks !== 0 ? m.u32((pWarpMasks + 0x04) >>> 0) : 2;
          if ((mask0 & bWarpFlag) !== 0) {
            PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c(m, pPetSlot, pTargetRoom, pGame, nX, nY);
          } else if ((mask1 & bWarpFlag) !== 0) {
            PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c(m, pPetSlot, pGame, pPlayerUnit, 0x640);
          } else {
            PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c(m, pGame, pPetSlot);
          }
        }
      }
    }
    pDataTables = m.u32(m.u32(0x6fd1829c));
    nPetTypesCount = i32(m, (pDataTables + 0xbf0) >>> 0);
    nPetType++;
    slotOffset += 0x0c;
    txtOffset += 0xe0;
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCBF600
 * @ordinalOrName D2Game_6FCBF600
 */
export function PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c(
  m: SparseMemory113c,
  nSkillId: number,
  pPlayerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCBF600)
  if (pPlayerUnit === 0 || m.u32(pPlayerUnit) !== 0 || (nSkillId | 0) < 0) return;
  const pDataTablesPtr = m.u32(0x6fd1829c);
  if (pDataTablesPtr === 0) return;
  const pDataTables = m.u32(pDataTablesPtr);
  if (pDataTables === 0 || (nSkillId | 0) >= i32(m, (pDataTables + 0xba0) >>> 0)) return;
  const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + Math.imul(nSkillId, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return;
  const nPetType = (m.u8((pSkillsTxt + 0xbe) >>> 0) << 24) >> 24;
  if (nPetType <= 0 || nPetType >= i32(m, (pDataTables + 0xbf0) >>> 0)) return;
  const pPetTypeTxt = PETTYPE_GetRecordPtrFast_6FC21B60_113c(m, nPetType) >>> 0;
  if (pPetTypeTxt === 0) return;
  let nMaxPetCount = 0;
  let nMasterSkills = i32(m, (pPetTypeTxt + 0xbc) >>> 0);
  for (let i = 0; i < nMasterSkills; i++) {
    const wMasterSkillId = i16(m, (pPetTypeTxt + 0xc0 + i * 2) >>> 0);
    const pMasterSkillTxt = SKILLS_GetRecordPtrFast113c(m, wMasterSkillId) >>> 0;
    if (pMasterSkillTxt !== 0) {
      const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pPlayerUnit, wMasterSkillId) >>> 0;
      if (pSkill !== 0) {
        const nLevel = SKILLS_EvaluateSkillLevel113c(m, pPlayerUnit, pSkill, 1) | 0;
        let nCalcMax = 0;
        if (nLevel > 0) {
          nCalcMax = SKILLS_EvalCalcByOffset113c(
            m,
            pPlayerUnit,
            m.u32((pMasterSkillTxt + 0xc0) >>> 0),
            wMasterSkillId,
            nLevel,
          ) | 0;
          if (nCalcMax < 1) nCalcMax = 1;
        }
        if (nCalcMax > nMaxPetCount) {
          nMaxPetCount = nCalcMax;
        }
      }
    }
    nMasterSkills = i32(m, (pPetTypeTxt + 0xbc) >>> 0);
  }
  const nFinalPetType = (m.u8((pSkillsTxt + 0xbe) >>> 0) << 24) >> 24;
  PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(m, nFinalPetType, pPlayerUnit, pGame, nMaxPetCount);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDAE40
 * @ordinalOrName D2Game_6FCDAE40
 */
export function ACT4Q1_InitQuestData_6FCDAE40_113c(
  m: SparseMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FCDAE40)
  for (let i = 0; i < 0x3c; i += 4) {
    m.setU32((pQuestData + 0xa0 + i) >>> 0, 0);
  }
  m.setU8((pQuestData + 0x0a) >>> 0, 1);
  m.setU8((pQuestData + 0x0c) >>> 0, 1);
  const pGame = m.u32((pQuestData + 0x04) >>> 0);
  m.setU32((pQuestData + 0xa0) >>> 0, 0x6fcd9560);
  m.setU32((pQuestData + 0xdc) >>> 0, 0x6fd26118);
  m.setU32((pQuestData + 0xc8) >>> 0, 0x6fcd94d0);
  m.setU32((pQuestData + 0xac) >>> 0, 0x6fcda550);
  m.setU32((pQuestData + 0xc0) >>> 0, 0x6fcdabf0);
  m.setU32((pQuestData + 0xa8) >>> 0, 0x6fcda100);
  m.setU32((pQuestData + 0xcc) >>> 0, 0x6fcda5e0);
  m.setU32((pQuestData + 0xd4) >>> 0, 0x6fcd9320);
  m.setU32((pQuestData + 0xe0) >>> 0, 0x19);
  m.setU8((pQuestData + 0x0d) >>> 0, 4);
  m.setU32((pQuestData + 0xe8) >>> 0, 0);
  m.setU32((pQuestData + 0xec) >>> 0, 0x6fcd8ae0);
  const pMemPool = pGame !== 0 ? m.u32((pGame + 0x1c) >>> 0) : 0;
  const pExData = FOG_AllocServerMemory113c(m, pMemPool, 0x1c, 0x6fd1b410, 0x2a0, 0) >>> 0;
  m.setU32((pQuestData + 0x18) >>> 0, pExData);
  m.setU32((pQuestData + 0xf0) >>> 0, 0x6fcd8a70);
  m.setU32((pQuestData + 0x10) >>> 0, 0x18);
  for (let i = 0; i < 0x1c; i += 4) {
    m.setU32((pExData + i) >>> 0, 0);
  }
  if (pQuestData === 0xffffffff) {
    ACT4Q1_InitNpcDialog_6FCD9560_113c(m, 0, 0);
    ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c(m, 0, 0);
    ACT3Q3_Callback03_LevelChanged113c(m, 0, 0);
    ACT4Q1_OnIzualKilled_6FCDABF0_113c(m, 0, 0);
    ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c(m, 0, 0);
    ACT4Q1_OnNpcMessage_6FCDA5E0_113c(m, 0, 0);
    ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c(m, 0, 0);
    ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c(m, 0, 0, 0, 0);
    ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c(m, 0);
  }
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDDD80
 * @ordinalOrName D2Game_6FCDDD80
 */
export function NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c(
  m: SparseMemory113c,
  pItem: number,
  pGame: number,
  pNpcUnit: number,
  pPlayerUnit: number,
  nTradeMode: number,
): void {
  hitD2GameVa113c(0x6FCDDD80)
  const sp = allocStack(m, 0x10);
  const nNpcClassId = pNpcUnit !== 0 ? i32(m, (pNpcUnit + 0x04) >>> 0) : -1;
  const pNpcRecord = D2GAME_ARENA_FindPlayerSlotByUnit113c(m, sp, pGame, nNpcClassId >>> 0) >>> 0;
  if (pNpcRecord !== 0 && m.u32((pNpcRecord + 0x0c) >>> 0) !== 0 && nTradeMode === 2) {
    const dwPlayerGuid = pPlayerUnit !== 0 ? m.u32((pPlayerUnit + 0x0c) >>> 0) : 0xffffffff;
    let pGambleNode = m.u32((pNpcRecord + 0x08) >>> 0);
    while (pGambleNode !== 0) {
      if (m.u32((pGambleNode + 0x04) >>> 0) === dwPlayerGuid) {
        const pGambleInv = m.u32(pGambleNode);
        if (pGambleInv !== 0) {
          let pCurItem = INVENTORY_GetFirstItem113c(m, pGambleInv) >>> 0;
          while (pCurItem !== 0) {
            const pVerifiedItem = INVENTORY_UnitIsItem113c(m, pCurItem) >>> 0;
            const pNextItem = INVENTORY_GetNextItem113c(m, pCurItem) >>> 0;
            if (pVerifiedItem === pItem) {
              NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c(
                m,
                pNpcUnit,
                pPlayerUnit,
                pItem,
                pGame,
                1,
              );
              freeStack(m, 0x10);
              return;
            }
            pCurItem = pNextItem;
          }
        }
        break;
      }
      pGambleNode = m.u32((pGambleNode + 0x08) >>> 0);
    }
  }
  if ((NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c(m, pNpcUnit, pGame, pItem) & 0xff) === 0) {
    NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c(m, pItem, pGame, pNpcUnit, 1);
  }
  freeStack(m, 0x10);
}

/**
 * @dll D2Game.dll
 * @va 0x6FCDDE50
 * @ordinalOrName D2Game_6FCDDE50
 */
export function NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pItem: number,
): void {
  hitD2GameVa113c(0x6FCDDE50)
  NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c(m, pPlayerUnit, pItem, pGame);
}
