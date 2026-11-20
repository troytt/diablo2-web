/**
 * Milestone 33 [K2] Wave 7 Batch 3 (`w7b3`): 39 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FCB7640..0x6FCE6A30`.
 */

import {
  COLLISION_FindFreePositionBasic113c,
  COLLISION_SetUnitCollisionMaskWithPattern113c,
} from '../common/collision'
import {
  UNITS_GetObjectPortalFlags113c,
  UNITS_GetPlayerData113c,
  UNITS_SetObjectPortalFlags113c,
} from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DRLG_ResolveMonsterSubClassIdForRoom113c,
  MONSTER_GetMissileIdForAnimMode113c,
} from '../common/drlg/drlg-ver'
import {
  DRLG_IsTownLevel113c,
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { ENV_InitEclipseEnvironment113c } from '../common/env'
import { D2CommonAssertError } from '../common/inline-helpers'
import { mulDiv113c } from '../common/int-math'
import {
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstNode113c,
  INVENTORY_GetNextNode113c,
  INVENTORY_GetNodeItemGuid113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetMissileType113c,
} from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetActiveWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import { MONSTERS_GetHirelingTypeId113c } from '../common/missile'
import {
  PATH_ClearPathPointsAndFlag0x20_113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_RefreshUnitCollisionPattern113c,
  PATH_SetCollisionMask113c,
  PATH_SetStepNum113c,
} from '../common/path'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_ClearQuestStateBits2To11_113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvalParam56DimReturns113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_EvaluateSkillManaCost113c,
  SKILLS_GetClassIdFromSkillId113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetLeftSkillFromSkillList113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetWeaponMasteryPassiveStatId113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist'
import {
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
} from '../common/unit'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint'
import type { Memory113c } from '../mem/sparse-memory'
import { seedRoll } from '../prng'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c'
import { DATATBLS_GetMonsterChainInfo113c } from '../tables/monster-tbls-113c'
import { ROOM_WakeRoomMonsters113c } from './act-rooms-113c'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  AI_CastSkillMode14_113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  MONSTER_InitModeChangeStrc113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import {
  AIGENERAL_CopyAiCommandParams113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_RemoveCombatNode113c,
} from './combat-a1c-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import { UNITEVENT_RegisterTimerOrItemEventNode113c } from './k2-gap-itemdef-113c'
import { MISSILES_GetTxtRecordFast113c } from './k2-gap-melee-dot-113c'
import { QUESTS_GuidListAdd113c } from './k2-items-tc-w1-113c'
import { PLAYER_GetQuestRecordForDifficulty_6FC21020_113c } from './k2-laneH-0x6fc2-w1-113c'
import { AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { PLAYER_GetPlayerDataField48_6FC57440_113c } from './k2-laneK-0x6fc5-w1-113c'
import {
  ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c,
  ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c,
  QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c,
} from './k2-w2b1-113c'
import { NET_SendPacket77_ButtonAction_6FCAB340_113c } from './k2-w2b3-113c'
import {
  PARTY_FindSubPartyById_6FCBBD00_113c,
  PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c,
} from './k2-w2b4-113c'
import {
  MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c,
  MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c,
  MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c,
  MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c,
  SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c,
} from './k2-w2b5-113c'
import {
  ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c,
  AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c,
} from './k2-w2b6-113c'
import {
  ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c,
  MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c,
} from './k2-w2b7-113c'
import {
  AI_ApproachTargetPathType13_6FD13000_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  AI_WalkTowardTarget_6FD12F30_113c,
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c,
} from './k2-w2b8-113c'
import {
  QUESTS_AttachUnitToQuest_6FC55890_113c,
  QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c,
} from './k2-w3b3-113c'
import {
  ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c,
  ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c,
} from './k2-w3b5-113c'
import { PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c } from './k2-w4b4-113c'
import {
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
  PETS_FindPetTypeByGuid_6FCB6600_113c,
  PETS_SendPacket7A_UnsummonPet_6FCB6810_113c,
  SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c,
} from './k2-w4b5-113c'
import {
  SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c,
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c,
} from './k2-w4b6-113c'
import {
  ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c,
  ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c,
  ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c,
} from './k2-w4b8-113c'
import { PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c } from './k2-w5b2-113c'
import {
  ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c,
  AIBAAL_SelectAction_6FCD79B0_113c,
  AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c,
} from './k2-w5b3-113c'
import {
  ACT2Q4_ChainSeqFilter_6FCE1FF0_113c,
  ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c,
} from './k2-w5b4-113c'
import {
  ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c,
  ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c,
  ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c,
} from './k2-w5b5-113c'
import { AIBAAL_SelectCombatAction_6FCC8E80_113c } from './k2-w5b6-113c'
import { SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c } from './k2-w5b7-113c'
import {
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c,
  SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c,
} from './k2-w5b9-113c'
import {
  AI_CastSkillWithModeRandomScatter_6FD12420_113c,
  AI_CircleStrafeTarget_6FD126B0_113c,
} from './k2-w5b10-113c'
import { SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c } from './k2-w6b1-113c'
import {
  ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c,
  MONAI_CanShadowCastSkillInContext_6FCC44C0_113c,
  NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c,
  PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c,
  PETS_RemovePetFromSlotByGuid_6FCB7920_113c,
  SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c,
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c,
  SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c,
} from './k2-w6b2-113c'
import {
  ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c,
  ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c,
  NET_BroadcastSystemChatMessage_6FCEBE70_113c,
} from './k2-w6b3-113c'
import {
  ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c,
  ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c,
  ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c,
  ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c,
} from './k2-w6b4-113c'
import {
  ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c,
  ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c,
  AIBAAL_ExecuteCommandAction_6FCD8070_113c,
  AITARGET_FindBestHostileTargetTether75_6FCD7090_113c,
  AITARGET_FindBestHostileTarget_6FCC4610_113c,
  ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c,
  PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c,
  PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c,
} from './k2-w6b5-113c'
import { ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c } from './k2-w6b6-113c'
import { PARTY_ClearHostilityFlag08_6FD14210_113c } from './k2-w6b7-113c'
import {
  SKILLS_SetUsedSkill113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_CheckSpawnTileFree113c,
  MONSTER_ScheduleInitialAiEvent113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SUNIT_AllocUnitData113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { AI_ApproachTarget113c } from './k2-real-s2c-combat-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c } from './timer-wheel'
import {
  AIGENERAL_FindAiCommandByType113c,
  AI_FindNearestPlayerTarget113c,
  UNITS_GetOctileDistanceToCoordinates113c,
} from './town-npc-ai-113c'
import {
  AITARGET_ScanUnitsByModeTable113c,
  D2NET_SendPacket0x06BytesToClient113c,
} from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

const D2COMMON_SGPT_DATA_TABLES_PTR_VA = 0x6fde9e1c
let k2W7B3StackPtr = 0x7e280000

function sx16(v: number): number {
  return (v << 16) >> 16
}

function i32(m: Memory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function allocScratch(size: number): number {
  const aligned = (size + 7) & ~7
  k2W7B3StackPtr = (k2W7B3StackPtr - aligned) >>> 0
  return k2W7B3StackPtr
}

function freeScratch(size: number): void {
  const aligned = (size + 7) & ~7
  k2W7B3StackPtr = (k2W7B3StackPtr + aligned) >>> 0
}

function getSgptDataTablesPtr(m: D2KernMemory113c): number {
  const iatVal = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  if (iatVal === D2COMMON_SGPT_DATA_TABLES_PTR_VA) {
    return m.u32(D2COMMON_SGPT_DATA_TABLES_PTR_VA) >>> 0
  }
  if (iatVal !== 0) {
    const deref = m.u32(iatVal) >>> 0
    if (
      deref !== 0 &&
      m.u32((iatVal + 0xb98) >>> 0) === 0 &&
      m.u32((iatVal + 0xa78) >>> 0) === 0 &&
      m.u32((iatVal + 0xbf0) >>> 0) === 0
    ) {
      return deref
    }
    return iatVal
  }
  return m.u32(D2COMMON_SGPT_DATA_TABLES_PTR_VA) >>> 0
}

function stepSeed64At113c(m: D2KernMemory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, newHi)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

function rollSeed6FC21180(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const seed = {
    lo: m.u32(pSeed >>> 0) >>> 0,
    hi: m.u32((pSeed + 4) >>> 0) >>> 0,
  }
  const r = seedRoll(seed, nMax | 0) | 0
  m.setU32(pSeed >>> 0, seed.lo >>> 0)
  m.setU32((pSeed + 4) >>> 0, seed.hi >>> 0)
  return r
}

function findAiCommandByTypeInline113c(
  m: D2KernMemory113c,
  pUnit: number,
  nCmdType: number,
): number {
  const unit = pUnit >>> 0
  if (unit === 0 || (m.u32(unit) | 0) !== 1) {
    return 0
  }
  const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
  if (pMonData === 0) {
    return 0
  }
  const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGen === 0) {
    return 0
  }
  const pHead = m.u32((pAiGen + 0x20) >>> 0) >>> 0
  if (pHead === 0) {
    return 0
  }
  const targetType = nCmdType >>> 0
  let pCur = m.u32(pHead) >>> 0
  if (pCur === 0) {
    return 0
  }
  if ((m.u32((pCur + 8) >>> 0) >>> 0) !== targetType) {
    let guard = 0
    while (pCur !== pHead && pCur !== 0 && guard < 1024) {
      pCur = m.u32(pCur) >>> 0
      if (pCur === 0) {
        return 0
      }
      if ((m.u32((pCur + 8) >>> 0) >>> 0) === targetType) {
        break
      }
      guard = (guard + 1) | 0
    }
  }
  return (m.u32((pCur + 8) >>> 0) >>> 0) === targetType ? pCur : 0
}

/**
 * [1/39] Cleans up all player pet slots (`1..nPetTypesTxtRecordCount-1`) and frees `pPlayerData->pPetTable` (`+0x44`).
 * @dll D2Game.dll
 * @va 0x6FCB7640
 * @ordinalOrName D2Game_6FCB7640
 */
export function PETS_FreePlayerPetTable_6FCB7640_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FCB7640)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x14f)
  }
  const pPetTable = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPetTable === 0) {
    return
  }
  const pTables = getSgptDataTablesPtr(m)
  let nPetTypesCount = pTables !== 0 ? i32(m, (pTables + 0xbf0) >>> 0) : 0
  let esi = 1
  if (nPetTypesCount > 1) {
    let edi = 0x0c
    while (esi < nPetTypesCount) {
      let pSlot = 0
      if (edi >= 0 && esi < nPetTypesCount) {
        pSlot = (m.u32(pPetTable) + edi) >>> 0
      }
      const bPlayerAlive = esi === 7 ? 1 : 0
      PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c(m, game, player, pSlot, bPlayerAlive, 0)
      const pTablesCur = getSgptDataTablesPtr(m)
      nPetTypesCount = pTablesCur !== 0 ? i32(m, (pTablesCur + 0xbf0) >>> 0) : 0
      esi = (esi + 1) | 0
      edi = (edi + 0x0c) | 0
    }
  }
  m.setU32((pPlayerData + 0x44) >>> 0, 0)
}

/**
 * [2/39] Unsummons or removes a player pet by GUID and broadcasts packet `0x7A` to all living players.
 * @dll D2Game.dll
 * @va 0x6FCB7B50
 * @ordinalOrName D2Game_6FCB7B50
 */
export function PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  dwPetGuid: number,
  bKillMonsterUnit: number,
): void {
  hitD2GameVa113c(0x6FCB7B50)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const petGuid = dwPetGuid >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  if (pPlayerData === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x276)
  }
  const pPetTable = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPetTable === 0) {
    return
  }
  const nPetType = PETS_FindPetTypeByGuid_6FCB6600_113c(m, player, petGuid) | 0
  if (nPetType === 0) {
    if ((bKillMonsterUnit | 0) !== 0) {
      PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c(m, game, petGuid)
    }
  } else if (nPetType < 0) {
    return
  }
  const pTables = getSgptDataTablesPtr(m)
  const nPetTypesCount = pTables !== 0 ? i32(m, (pTables + 0xbf0) >>> 0) : 0
  if (nPetType >= nPetTypesCount) {
    return
  }
  const pSlotsBase = m.u32(pPetTable) >>> 0
  const pSlot = (pSlotsBase + nPetType * 12) >>> 0
  if (pSlot === 0) {
    return
  }
  PETS_RemovePetFromSlotByGuid_6FCB7920_113c(m, game, petGuid, pSlot, bKillMonsterUnit | 0)
  const pTempPetNode = allocScratch(0x20)
  try {
    for (let i = 0; i < 0x20; i += 4) {
      m.setU32((pTempPetNode + i) >>> 0, 0)
    }
    m.setU32(pTempPetNode, petGuid)
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      game,
      (mem, _g, pLivingPlr, pCtx) => {
        PETS_SendPacket7A_UnsummonPet_6FCB6810_113c(mem, pLivingPlr, pCtx)
      },
      pTempPetNode,
    )
  } finally {
    freeScratch(0x20)
  }
}

/**
 * [3/39] Paladin Conversion (`SrvDo028`) skill finishing handler (`0x6FCB9830`).
 * @dll D2Game.dll
 * @va 0x6FCB9830
 * @ordinalOrName D2Game_6FCB9830
 */
export function SKILLS_SrvDo028_Conversion_6FCB9830_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCasterUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCB9830)
  const game = pGame >>> 0
  const caster = pCasterUnit >>> 0
  const skillId = nSkillId | 0
  const skillLevel = nSkillLevel | 0
  if (skillId < 0) {
    return 0
  }
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= i32(m, (pTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) {
    return 0
  }
  if (caster !== 0) {
    m.setU32((caster + 0xc4) >>> 0, (m.u32((caster + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  SUNIT_ValidatePathTargetUnit113c(m, caster, game)
  const pPath = m.u32((caster + 0x2c) >>> 0) >>> 0
  const pTargetUnit = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTargetUnit === caster || pTargetUnit === 0) {
    return 0
  }
  let bCanConvert = 0
  if (SUNITDMG_FindCombatDamageData113c(m, caster, pTargetUnit) !== 0) {
    bCanConvert =
      SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c(
        m,
        skillId,
        pTargetUnit,
        caster,
        skillLevel,
        1,
      ) | 0
  }
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  const pTablesCheck = getSgptDataTablesPtr(m)
  const nStatesCount = pTablesCheck !== 0 ? i32(m, (pTablesCheck + 0xc4) >>> 0) : 0
  if (wAuraState < 0 || wAuraState >= nStatesCount || bCanConvert === 0) {
    SUNITDMG_ExecuteEvents113c(m, game, caster, pTargetUnit)
    return 1
  }
  const dwGameFrame = m.u32((game + 0xa8) >>> 0) | 0
  const dwAuraLenCalc = m.u32((pSkillsTxt + 0x60) >>> 0) >>> 0
  const nLen = SKILLS_EvalCalcByOffset113c(m, caster, dwAuraLenCalc, skillId, skillLevel) | 0
  let nExpireFrame = (dwGameFrame + nLen) | 0
  const minExpireFrame = (dwGameFrame + 1) | 0
  if (nExpireFrame <= minExpireFrame) {
    nExpireFrame = minExpireFrame
  }
  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTargetUnit, wAuraState) >>> 0
  if (pStatList === 0) {
    pStatList =
      STATLIST_AllocList113c(
        m,
        0x802,
        m.u32(caster),
        m.u32((caster + 0x0c) >>> 0),
        0,
        nExpireFrame,
      ) >>> 0
    if (pStatList === 0) {
      return 0
    }
    const wStateNow = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
    STATLIST_SetState113c(m, pStatList, wStateNow)
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcb8950)
    void SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c
    STATLIST_MergeStatLists113c(m, pTargetUnit, pStatList, 1)
    STATES_ToggleGfxStateFlag113c(m, pTargetUnit, sx16(m.u16((pSkillsTxt + 0x82) >>> 0)), 1)
  }
  STATLIST_SetExpireFrameEx113c(m, pStatList, nExpireFrame)
  EVENT_SetEventFull113c(m, game, pTargetUnit, 0x0c, nExpireFrame, 0, 0)
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c(m, pTargetUnit)
  SUNIT_SetMonsterAlignmentState113c(m, pTargetUnit, 2, 1)
  SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c(
    m,
    game,
    pTargetUnit,
    m.u32((caster + 0xd0) >>> 0),
    0,
  )
  UNITS_SetTargetUnitForDynamicUnit113c(m, caster, 0)
  let pCurseStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, pTargetUnit, 8) >>> 0
  while (pCurseStatList !== 0) {
    STATLIST_UnlinkSubList113c(m, pTargetUnit, pCurseStatList)
    STATLIST_FreeStatListIfNonExtended113c(m, pCurseStatList)
    pCurseStatList = STATLIST_GetStatListFromUnitAndFlag113c(m, pTargetUnit, 8) >>> 0
  }
  const nTargetLevel = STATLIST_GetUnitStat113c(m, pTargetUnit, 0x0c, 0) | 0
  const nCasterLevel = STATLIST_GetUnitStat113c(m, caster, 0x0c, 0) | 0
  if (nTargetLevel !== 0 && nCasterLevel < nTargetLevel) {
    if (STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTargetUnit, 0x6d) === 0) {
      const pConvStatList =
        STATLIST_AllocList113c(
          m,
          0,
          m.u32(pTargetUnit),
          m.u32((pTargetUnit + 0x0c) >>> 0),
          0,
          0,
        ) >>> 0
      if (pConvStatList !== 0) {
        STATLIST_SetState113c(m, pConvStatList, 0x6d)
        STATLIST_MergeStatLists113c(m, pTargetUnit, pConvStatList, 1)
        const nCurHpShifted = (STATLIST_GetUnitStat113c(m, pTargetUnit, 6, 0) | 0) >> 8
        const nMaxHpShifted = (STATLIST_GetMaxLifeFromUnit113c(m, pTargetUnit) | 0) >> 8
        STATLIST_SetStat113c(m, pConvStatList, 0xb0, nTargetLevel, 0)
        STATLIST_SetStat113c(m, pConvStatList, 0xb1, nMaxHpShifted, 0)
        let nScaledCurHp = (mulDiv113c(nCasterLevel, nCurHpShifted, nTargetLevel) << 8) | 0
        let nScaledMaxHp = (mulDiv113c(nCasterLevel, nMaxHpShifted, nTargetLevel) << 8) | 0
        if (nScaledMaxHp < 1) {
          nScaledMaxHp = 1
        }
        if (nScaledCurHp <= 1) {
          nScaledCurHp = 1
        }
        if (nScaledCurHp >= nScaledMaxHp) {
          nScaledCurHp = nScaledMaxHp
        }
        STATLIST_SetUnitStat113c(m, pTargetUnit, 0x0c, nCasterLevel, 0)
        STATLIST_SetUnitStat113c(m, pTargetUnit, 6, nScaledCurHp, 0)
        STATLIST_SetUnitStat113c(m, pTargetUnit, 7, nScaledMaxHp, 0)
      }
    }
  }
  return 1
}

/**
 * [4/39] Dispatches command flag packets (`0x6FCBB630`) for all items (and socketed sub-items) in `pUnit`'s inventory.
 * @dll D2Game.dll
 * @va 0x6FCBBB10
 * @ordinalOrName D2Game_6FCBBB10
 */
export function ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c(
  m: D2KernMemory113c,
  pOverrideInventory: number,
  pGame: number,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FCBBB10)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const client = pClient >>> 0
  let pInventory = m.u32((unit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xf4)
  }
  if ((pOverrideInventory >>> 0) !== 0) {
    pInventory = pOverrideInventory >>> 0
  }
  let pNode = INVENTORY_GetFirstNode113c(m, pInventory) >>> 0
  if (pNode === 0) {
    return
  }
  while (pNode !== 0) {
    const dwItemGuid = INVENTORY_GetNodeItemGuid113c(m, pNode) >>> 0
    if (game === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
    }
    let pItem = m.u32((game + 0x1720 + ((dwItemGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== dwItemGuid) {
      pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
    }
    if (pItem !== 0) {
      ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c(m, pItem, unit, client)
      if ((m.u32((pItem + 0xc8) >>> 0) & 1) !== 0) {
        const pItemInv = m.u32((pItem + 0x60) >>> 0) >>> 0
        if (pItemInv === 0) {
          throw new D2CommonAssertError('0x6fd19ff9', 0x108)
        }
        let pSubNode = INVENTORY_GetFirstNode113c(m, pItemInv) >>> 0
        while (pSubNode !== 0) {
          const dwSubGuid = INVENTORY_GetNodeItemGuid113c(m, pSubNode) >>> 0
          let pSubItem = m.u32((game + 0x1720 + ((dwSubGuid & 0x7f) << 2)) >>> 0) >>> 0
          while (pSubItem !== 0 && (m.u32((pSubItem + 0x0c) >>> 0) >>> 0) !== dwSubGuid) {
            pSubItem = m.u32((pSubItem + 0xe4) >>> 0) >>> 0
          }
          if (pSubItem !== 0) {
            ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c(m, pItem, unit, client)
          }
          pSubNode = INVENTORY_GetNextNode113c(m, pSubNode) >>> 0
        }
      }
    }
    pNode = INVENTORY_GetNextNode113c(m, pNode) >>> 0
  }
  if (MONSTERS_GetHirelingTypeId113c(m, unit) !== 0) {
    D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, game, unit, 1)
  }
}

/**
 * [5/39] Adds `pPlayerUnit` to sub-party `wPartyId`, broadcasts packet `0x8D`, and clears mutual hostility flags (`0x08`).
 * @dll D2Game.dll
 * @va 0x6FCBC4F0
 * @ordinalOrName D2Game_6FCBC4F0
 */
export function PARTY_AddPlayerToSubParty_6FCBC4F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  wPartyId: number,
  pPlayerUnit: number,
): number {
  hitD2GameVa113c(0x6FCBC4F0)
  const game = pGame >>> 0
  const player = pPlayerUnit >>> 0
  const pSubParty = PARTY_FindSubPartyById_6FCBBD00_113c(m, game, wPartyId & 0xffff) >>> 0
  const dwUnitGuid = player !== 0 ? m.u32((player + 0x0c) >>> 0) >>> 0 : 0xffffffff
  if (pSubParty === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xfe)
  }
  if (player === 0 || m.u32(player) !== 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xff)
  }
  if (PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c(m, pSubParty, dwUnitGuid) !== 0) {
    return 1
  }
  const pNewNode = m.alloc(8) >>> 0
  m.setU32(pNewNode, dwUnitGuid)
  const pOldHead = m.u32((pSubParty + 0x04) >>> 0) >>> 0
  m.setU32((pNewNode + 0x04) >>> 0, pOldHead)
  m.setU32((pSubParty + 0x04) >>> 0, pNewNode)
  PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c(m, player, game)
  let pMemberNode = m.u32((pNewNode + 0x04) >>> 0) >>> 0
  while (pMemberNode !== 0) {
    const dwMemberGuid = m.u32(pMemberNode) >>> 0
    let pOtherPlayer = m.u32((game + 0x1120 + ((dwMemberGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pOtherPlayer !== 0 && (m.u32((pOtherPlayer + 0x0c) >>> 0) >>> 0) !== dwMemberGuid) {
      pOtherPlayer = m.u32((pOtherPlayer + 0xe4) >>> 0) >>> 0
    }
    if (pOtherPlayer !== 0) {
      PARTY_ClearHostilityFlag08_6FD14210_113c(m, pOtherPlayer, game, player)
      PARTY_ClearHostilityFlag08_6FD14210_113c(m, player, game, pOtherPlayer)
    }
    pMemberNode = m.u32((pMemberNode + 0x04) >>> 0) >>> 0
  }
  return 1
}

/**
 * [6/39] Unlinks sub-party `wPartyId` from `pGame->pPartyControl` (`+0x1d2c`) and processes pending join relations.
 * @dll D2Game.dll
 * @va 0x6FCBC7D0
 * @ordinalOrName D2Game_6FCBC7D0
 */
export function PARTY_RemoveSubPartyById_6FCBC7D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  wPartyId: number,
): void {
  hitD2GameVa113c(0x6FCBC7D0)
  const game = pGame >>> 0
  const targetPartyId = wPartyId & 0xffff
  const pPartyControl = m.u32((game + 0x1d2c) >>> 0) >>> 0
  if (pPartyControl === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xb4)
  }
  let pPrev = 0
  let pCur = m.u32((pPartyControl + 0x04) >>> 0) >>> 0
  while (pCur !== 0) {
    if (m.u16(pCur) === targetPartyId) {
      const pNext = m.u32((pCur + 0x08) >>> 0) >>> 0
      if (pPrev !== 0) {
        m.setU32((pPrev + 0x08) >>> 0, pNext)
      } else {
        m.setU32((pPartyControl + 0x04) >>> 0, pNext)
      }
      PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c(m, game, pCur)
      return
    }
    pPrev = pCur
    pCur = m.u32((pCur + 0x08) >>> 0) >>> 0
  }
}

/**
 * [7/39] Spawns a bidirectional portal pair between `pSourceRoom` and `nDestLevelId` (`0x6FCC24C0`).
 * @dll D2Game.dll
 * @va 0x6FCC24C0
 * @ordinalOrName D2Game_6FCC24C0
 */
export function PORTAL_SpawnLinkedPortalPair_6FCC24C0_113c(
  m: D2KernMemory113c,
  pOwnerUnit: number,
  pGame: number,
  pSourceRoom: number,
  nX: number,
  nY: number,
  nDestLevelId: number,
  ppOutSourcePortal: number,
  nPortalClassId: number,
  bDirectCoords: number,
): number {
  hitD2GameVa113c(0x6FCC24C0)
  const owner = pOwnerUnit >>> 0
  const game = pGame >>> 0
  const sourceRoom = pSourceRoom >>> 0
  const destLevelId = nDestLevelId | 0
  const outSourcePortalPtr = ppOutSourcePortal >>> 0
  const portalClassId = nPortalClassId | 0
  if (sourceRoom === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xe42)
  }
  if (outSourcePortalPtr !== 0) {
    m.setU32(outSourcePortalPtr, 0)
  }
  if (owner !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, sourceRoom) !== 0) {
    const isSpecialDest =
      destLevelId === 0x27 ||
      destLevelId === 0x88 ||
      destLevelId === 0x85 ||
      destLevelId === 0x86 ||
      destLevelId === 0x87
    if (!isSpecialDest || portalClassId !== 0x3c) {
      SUNIT_SetUnitEventSound113c(m, owner, 0x18, owner)
      return 0
    }
  }
  const nDestAct = DRLG_GetActNoFromLevelId113c(m, destLevelId) & 0xff
  const nSourceLevelId = DUNGEON_GetLevelIdFromRoom113c(m, sourceRoom) | 0
  const nSourceAct = DRLG_GetActNoFromLevelId113c(m, nSourceLevelId) & 0xff
  if (nDestAct !== nSourceAct) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xe5c)
  }
  let spawnX = nX | 0
  let spawnY = nY | 0
  if ((bDirectCoords | 0) === 0) {
    const pCoords = allocScratch(8)
    try {
      m.setU32(pCoords, spawnX >>> 0)
      m.setU32((pCoords + 4) >>> 0, spawnY >>> 0)
      if (
        COLLISION_FindFreePositionBasic113c(m, sourceRoom, pCoords, pCoords, 3, 0x3e01, 0x0c01, 0) ===
        0
      ) {
        return 0
      }
      spawnX = (m.u32(pCoords) | 0)
      spawnY = i32(m, (pCoords + 4) >>> 0)
    } finally {
      freeScratch(8)
    }
  }
  const pSpawnRoom = ROOM_FindRoomContainingSubtile113c(m, sourceRoom, spawnX, spawnY) >>> 0
  if (pSpawnRoom === 0) {
    return 0
  }
  const pSourcePortal =
    SUNIT_AllocUnitData113c(m, 2, portalClassId, spawnX, spawnY, game, pSpawnRoom, 1, 1, 0) >>> 0
  if (outSourcePortalPtr !== 0) {
    m.setU32(outSourcePortalPtr, pSourcePortal)
  }
  UNITS_ChangeAnimMode113c(m, pSourcePortal, 1)
  const pDestPortal =
    PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c(
      m,
      game,
      pSourcePortal,
      destLevelId,
      nSourceLevelId,
    ) >>> 0
  if (pDestPortal === 0) {
    return 0
  }
  const newPortalFlags = (UNITS_GetObjectPortalFlags113c(m, pDestPortal) | 3) & 0xff
  UNITS_SetObjectPortalFlags113c(m, pDestPortal, newPortalFlags)
  DUNGEON_ToggleHasPortalFlag113c(m, pSpawnRoom, 0)
  const pDestRoom = UNITS_GetRoom113c(m, pDestPortal) >>> 0
  DUNGEON_ToggleHasPortalFlag113c(m, pDestRoom, 0)
  return 1
}

/**
 * [8/39] Offhand throwing weapon projectile creation (`0x6FCC2A40`).
 * @dll D2Game.dll
 * @va 0x6FCC2A40
 * @ordinalOrName D2Game_6FCC2A40
 */
export function SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCC2A40)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLevel = nSkillLevel | 0
  const pInventory = m.u32((unit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return 0
  }
  const pScratch = allocScratch(12)
  let pWeapon = 0
  try {
    const ppWeapon = pScratch
    const pBodyLoc = (pScratch + 4) >>> 0
    const pbIsActive = (pScratch + 8) >>> 0
    m.setU32(ppWeapon, 0)
    m.setU32(pBodyLoc, 0)
    m.setU32(pbIsActive, 0)
    if (INVENTORY_GetActiveWeaponMemPort113c(m, pInventory, ppWeapon, pBodyLoc, pbIsActive) !== 0) {
      if (m.u32(pbIsActive) !== 0) {
        const otherBodyLoc = m.u32(pBodyLoc) === 5 ? 4 : 5
        m.setU32(
          ppWeapon,
          INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, otherBodyLoc) >>> 0,
        )
      }
      const wpn = m.u32(ppWeapon) >>> 0
      if (
        ITEMS_CheckIfThrowItemMemPort113c(m, wpn) === 0 &&
        STATLIST_GetUnitStatWithLayer113c(m, wpn, 0x7d, 0) === 0
      ) {
        return 0
      }
    }
    pWeapon = m.u32(ppWeapon) >>> 0
  } finally {
    freeScratch(12)
  }
  if (pWeapon === 0) {
    return 0
  }
  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  const nMissileId = ITEMS_GetMissileType113c(m, pWeapon) | 0
  const isThrowingPotion = ITEMS_CheckItemTypeIdMemPort113c(m, pWeapon, 0x26) | 0
  let pMissile = 0
  if (isThrowingPotion !== 0) {
    pMissile =
      SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
        m,
        0,
        unit,
        game,
        nMissileId,
        skillId,
        skillLevel,
        0,
        0,
        0,
        1,
      ) >>> 0
  } else {
    pMissile =
      SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
        m,
        game,
        nMissileId,
        unit,
        skillId,
        skillLevel,
        0,
        0,
        0,
        0,
        1,
      ) >>> 0
  }
  SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c(m, unit, pMissile, pWeapon)
  return 1
}

/**
 * [9/39] Mainhand/active throwing weapon projectile creation (`0x6FCC2B40`).
 * @dll D2Game.dll
 * @va 0x6FCC2B40
 * @ordinalOrName D2Game_6FCC2B40
 */
export function SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCC2B40)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLevel = nSkillLevel | 0
  const pInventory = m.u32((unit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    return 0
  }
  const pScratch = allocScratch(12)
  let pWeapon = 0
  try {
    const ppWeapon = pScratch
    const pBodyLoc = (pScratch + 4) >>> 0
    const pbIsActive = (pScratch + 8) >>> 0
    m.setU32(ppWeapon, 0)
    m.setU32(pBodyLoc, 0)
    m.setU32(pbIsActive, 0)
    if (INVENTORY_GetActiveWeaponMemPort113c(m, pInventory, ppWeapon, pBodyLoc, pbIsActive) !== 0) {
      if (m.u32(pbIsActive) === 0) {
        const otherBodyLoc = m.u32(pBodyLoc) === 5 ? 4 : 5
        m.setU32(
          ppWeapon,
          INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, otherBodyLoc) >>> 0,
        )
      }
      const wpn = m.u32(ppWeapon) >>> 0
      if (
        ITEMS_CheckIfThrowItemMemPort113c(m, wpn) === 0 &&
        STATLIST_GetUnitStatWithLayer113c(m, wpn, 0x7d, 0) === 0
      ) {
        return 0
      }
    }
    pWeapon = m.u32(ppWeapon) >>> 0
  } finally {
    freeScratch(12)
  }
  if (pWeapon === 0) {
    return 0
  }
  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  const nMissileId = ITEMS_GetMissileType113c(m, pWeapon) | 0
  const isThrowingPotion = ITEMS_CheckItemTypeIdMemPort113c(m, pWeapon, 0x26) | 0
  let pMissile = 0
  if (isThrowingPotion !== 0) {
    pMissile =
      SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
        m,
        0,
        unit,
        game,
        nMissileId,
        skillId,
        skillLevel,
        0,
        0,
        0,
        1,
      ) >>> 0
  } else {
    pMissile =
      SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
        m,
        game,
        nMissileId,
        unit,
        skillId,
        skillLevel,
        0,
        0,
        0,
        0,
        1,
      ) >>> 0
  }
  SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c(m, unit, pMissile, pWeapon)
  return 1
}

/**
 * [10/39] Evaluates whether a Shadow Warrior / Shadow Master minion can and should cast `nSkillId` (`0x6FCC4890`).
 * @dll D2Game.dll
 * @va 0x6FCC4890
 * @ordinalOrName D2Game_6FCC4890
 */
export function MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pOwnerUnit: number,
  pShadowUnit: number,
  pGame: number,
  pSkill: number,
  pAiParam: number,
): number {
  hitD2GameVa113c(0x6FCC4890)
  const skillId = nSkillId | 0
  const owner = pOwnerUnit >>> 0
  const shadow = pShadowUnit >>> 0
  const game = pGame >>> 0
  const skillPtr = pSkill >>> 0
  const aiParam = pAiParam >>> 0
  if (skillPtr === 0 || owner === 0 || aiParam === 0) {
    return 0
  }
  const pAiControl = m.u32(aiParam) >>> 0
  if (pAiControl === 0) {
    return 0
  }
  const nOwnerClassId = i32(m, (owner + 0x04) >>> 0)
  if ((SKILLS_GetClassIdFromSkillId113c(m, skillId) | 0) !== nOwnerClassId) {
    return 0
  }
  if (
    MONAI_CanShadowCastSkillInContext_6FCC44C0_113c(m, aiParam, skillId, shadow, game, owner) === 0
  ) {
    return 0
  }
  const nSkillLevel = SKILLS_EvaluateSkillLevel113c(m, shadow, skillPtr, 1) | 0
  if (skillId === 0) {
    return 1
  }
  const nManaCostShifted = SKILLS_EvaluateSkillManaCost113c(m, skillId, nSkillLevel) | 0
  const pSeed = (shadow + 0x20) >>> 0
  const nRollCost = rollSeed6FC21180(m, pSeed, 100) | 0
  const nCostPenalty = Math.trunc(Math.imul(nManaCostShifted, 160) / 100) | 0
  if (nRollCost > ((100 - nCostPenalty) | 0)) {
    return 0
  }
  if (i32(m, (pAiControl + 0x14) >>> 0) > i32(m, (game + 0xa8) >>> 0)) {
    return 0
  }
  const pMonStatsTxt = m.u32((aiParam + 0x1c) >>> 0) >>> 0
  let minBound = sx16(m.u16((pMonStatsTxt + 0x82) >>> 0))
  if (minBound <= 1) {
    minBound = 1
  } else if (minBound >= 0x80) {
    minBound = 0x80
  }
  let maxBound = sx16(m.u16((pMonStatsTxt + 0x84) >>> 0))
  if (maxBound <= 1) {
    maxBound = 1
  } else if (maxBound >= 0x100) {
    maxBound = 0x100
  }
  const curThreshold = i32(m, (pAiControl + 0x18) >>> 0)
  if (curThreshold < minBound || curThreshold > (maxBound << 5)) {
    m.setU32((pAiControl + 0x18) >>> 0, minBound >>> 0)
  }
  const rollMax = i32(m, (pAiControl + 0x18) >>> 0)
  const nRollThreshold = rollSeed6FC21180(m, pSeed, rollMax) | 0
  const nRoll100 = rollSeed6FC21180(m, pSeed, 100) | 0
  if (nRollThreshold > nRoll100) {
    return 0
  }
  const nParam1c = i32(m, (pAiControl + 0x1c) >>> 0)
  const num = Math.imul((0x140 - nParam1c) | 0, nManaCostShifted)
  const den = (nParam1c + 100) | 0
  const delta = den !== 0 ? Math.trunc(num / den) | 0 : 0
  m.setU32((pAiControl + 0x18) >>> 0, (i32(m, (pAiControl + 0x18) >>> 0) + delta) >>> 0)
  return 1
}

function getQuest35DataExByte11(m: D2KernMemory113c, pGame: number): number {
  let pQuest = 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl !== 0) {
    let pCur = m.u32(pQuestControl) >>> 0
    while (pCur !== 0) {
      if (m.u32(pCur) === 0x23) {
        pQuest = pCur
        break
      }
      pCur = m.u32((pCur + 0xf4) >>> 0) >>> 0
    }
  }
  const pDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  return m.u8((pDataEx + 0x11) >>> 0)
}

/**
 * [11/39] Siege Boss / Shenk minion AI think callback (`0x6FCC5EB0`).
 * @dll D2Game.dll
 * @va 0x6FCC5EB0
 * @ordinalOrName D2Game_6FCC5EB0
 */
export function MONAI_SiegeMinionThinkA_6FCC5EB0_113c(
  m: D2KernMemory113c,
  pAiParam: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCC5EB0)
  const aiParam = pAiParam >>> 0
  const unit = pUnit >>> 0
  const game = pGame >>> 0
  const pMonStatsTxt = m.u32((aiParam + 0x1c) >>> 0) >>> 0
  if (getQuest35DataExByte11(m, game) === 0) {
    AI_Stall113c(m, game, unit, 0x19)
    return
  }
  const pScratch = allocScratch(8)
  let pTarget = 0
  try {
    m.setU32(pScratch, 0)
    m.setU32((pScratch + 4) >>> 0, 0)
    pTarget =
      AITARGET_FindBestHostileTarget_6FCC4610_113c(
        m,
        game,
        unit,
        pScratch,
        (pScratch + 4) >>> 0,
        0,
        MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c,
      ) >>> 0
  } finally {
    freeScratch(8)
  }
  if (pTarget === 0) {
    AI_Stall113c(m, game, unit, 0x19)
    return
  }
  const bInMelee = UNITS_CanUnitMeleeAttackTarget113c(m, unit, pTarget, 0) | 0
  const nDist = UNITS_GetApproximateDistance113c(m, unit, pTarget) | 0
  const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (wSkill1 > 0) {
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (nDist < sx16(m.u16((pMonStatsTxt + 0x56 + nDiff * 2) >>> 0))) {
      const nRoll = rollSeed6FC21180(m, (unit + 0x20) >>> 0, 100) | 0
      const nDiffNow = m.u8((game + 0x6d) >>> 0)
      if (nRoll < sx16(m.u16((pMonStatsTxt + 0x5c + nDiffNow * 2) >>> 0))) {
        const nSkillId = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
        if (MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, unit, nSkillId) !== 0) {
          AI_CastSkillMode14_113c(m, unit, nSkillId, game, pTarget, 0, 0)
          return
        }
      }
    }
  }
  if (bInMelee !== 0) {
    const nRollMelee = ((stepSeed64At113c(m, (unit + 0x20) >>> 0) >>> 0) % 100) | 0
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (nRollMelee >= sx16(m.u16((pMonStatsTxt + 0x62 + nDiff * 2) >>> 0))) {
      AI_Stall113c(m, game, unit, 0x19)
      return
    }
    const nAtkRoll = rollSeed6FC21180(m, (unit + 0x20) >>> 0, 2) | 0
    AI_StartAttackMode113c(m, nAtkRoll !== 0 ? 4 : 5, unit, game, pTarget)
    return
  }
  AI_ApproachTarget113c(m, game, unit, pTarget, 2, 0, 0, 1, 0)
  AI_ScheduleAiThinkTimer_6FD120C0_113c(m, game, unit, 10)
}

/**
 * [12/39] Siege Boss / Shenk ranged/caster minion AI think callback (`0x6FCC6050`).
 * @dll D2Game.dll
 * @va 0x6FCC6050
 * @ordinalOrName D2Game_6FCC6050
 */
export function MONAI_SiegeMinionThinkB_6FCC6050_113c(
  m: D2KernMemory113c,
  pAiParam: number,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCC6050)
  const aiParam = pAiParam >>> 0
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pMonStatsTxt = m.u32((aiParam + 0x1c) >>> 0) >>> 0
  const pSeed = (unit + 0x20) >>> 0
  if (getQuest35DataExByte11(m, game) === 0) {
    AI_Stall113c(m, game, unit, 0x19)
    return
  }
  const pScratch = allocScratch(8)
  let pTarget = 0
  try {
    m.setU32(pScratch, 0)
    m.setU32((pScratch + 4) >>> 0, 0)
    pTarget =
      AITARGET_FindBestHostileTarget_6FCC4610_113c(
        m,
        game,
        unit,
        pScratch,
        (pScratch + 4) >>> 0,
        0,
        MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c,
      ) >>> 0
  } finally {
    freeScratch(8)
  }
  if (pTarget === 0) {
    AI_Stall113c(m, game, unit, 0x19)
    return
  }
  const bInMelee = UNITS_CanUnitMeleeAttackTarget113c(m, unit, pTarget, 0) | 0
  const nDist = UNITS_GetApproximateDistance113c(m, unit, pTarget) | 0
  if (bInMelee !== 0) {
    const nRollFlee = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (nRollFlee < sx16(m.u16((pMonStatsTxt + 0x68 + nDiff * 2) >>> 0))) {
      const nFleeDist = m.u8((pMonStatsTxt + 0x6e + nDiff * 2) >>> 0)
      if (AI_FleeFrom113c(m, game, unit, pTarget, nFleeDist, 1) !== 0) {
        AI_ScheduleAiThinkTimer_6FD120C0_113c(m, game, unit, 0x19)
        return
      }
    }
  }
  const nSkillId = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (nSkillId > 0) {
    const pTables = getSgptDataTablesPtr(m)
    if (pTables !== 0 && nSkillId < i32(m, (pTables + 0xba0) >>> 0)) {
      const pSkillsTxt = (m.u32((pTables + 0xb98) >>> 0) + Math.imul(nSkillId, 0x23c)) >>> 0
      if (pSkillsTxt !== 0) {
        let stateBlocked = false
        const wState1 = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
        if (wState1 > 0 && wState1 <= i32(m, (pTables + 0xc4) >>> 0)) {
          if (STATES_CheckState113c(m, unit, wState1) !== 0) {
            stateBlocked = true
          }
        }
        if (!stateBlocked) {
          const wState2 = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
          const pTables2 = getSgptDataTablesPtr(m)
          if (wState2 > 0 && pTables2 !== 0 && wState2 <= i32(m, (pTables2 + 0xc4) >>> 0)) {
            if (STATES_CheckState113c(m, unit, wState2) !== 0) {
              stateBlocked = true
            }
          }
        }
        if (!stateBlocked) {
          const nRollCast = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
          const nDiff = m.u8((game + 0x6d) >>> 0)
          if (nRollCast < sx16(m.u16((pMonStatsTxt + 0x62 + nDiff * 2) >>> 0))) {
            const nMode = m.u8((pMonStatsTxt + 0x180) >>> 0)
            if (AI_CastSkillWithMode113c(m, nMode, unit, game, nSkillId, 0, 0, 0) !== 0) {
              return
            }
          }
        }
      }
    }
  }
  const nDiff = m.u8((game + 0x6d) >>> 0)
  if (nDist < sx16(m.u16((pMonStatsTxt + 0x56 + nDiff * 2) >>> 0))) {
    const nRollAtk = rollSeed6FC21180(m, pSeed, 100) | 0
    const nDiffAtk = m.u8((game + 0x6d) >>> 0)
    if (nRollAtk < sx16(m.u16((pMonStatsTxt + 0x5c + nDiffAtk * 2) >>> 0))) {
      if (AI_StartAttackMode113c(m, 4, unit, game, pTarget) !== 0) {
        return
      }
    }
  }
  const nDiffWalk = m.u8((game + 0x6d) >>> 0)
  const nWalkThreshold = sx16(m.u16((pMonStatsTxt + 0x56 + nDiffWalk * 2) >>> 0))
  if (nDist >= nWalkThreshold) {
    const nStepNum = (nDist & ~0xff) | (((nDist & 0xff) - (nWalkThreshold & 0xff)) & 0xff)
    if (AI_WalkTowardTarget_6FD12F30_113c(m, unit, pTarget, game, nStepNum) !== 0) {
      return
    }
  }
  AI_Stall113c(m, game, unit, 10)
}

/**
 * [13/39] Siege Boss / Shenk charger minion AI think callback (`0x6FCC62D0`).
 * @dll D2Game.dll
 * @va 0x6FCC62D0
 * @ordinalOrName D2Game_6FCC62D0
 */
export function MONAI_SiegeMinionThinkC_6FCC62D0_113c(
  m: D2KernMemory113c,
  pAiParam: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCC62D0)
  const aiParam = pAiParam >>> 0
  const unit = pUnit >>> 0
  const game = pGame >>> 0
  const pMonStatsTxt = m.u32((aiParam + 0x1c) >>> 0) >>> 0
  if (getQuest35DataExByte11(m, game) === 0 || STATES_CheckState113c(m, unit, 0x36) !== 0) {
    AI_Stall113c(m, game, unit, 0x19)
    return
  }
  let pTarget = m.u32((aiParam + 0x08) >>> 0) >>> 0
  if (pTarget === 0) {
    const pScratch = allocScratch(8)
    try {
      m.setU32(pScratch, 0)
      m.setU32((pScratch + 4) >>> 0, 0)
      pTarget =
        AITARGET_FindBestHostileTarget_6FCC4610_113c(
          m,
          game,
          unit,
          pScratch,
          (pScratch + 4) >>> 0,
          0,
          MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c,
        ) >>> 0
    } finally {
      freeScratch(8)
    }
    if (pTarget === 0) {
      AI_Stall113c(m, game, unit, 0x19)
      return
    }
  }
  const bInMelee = UNITS_CanUnitMeleeAttackTarget113c(m, unit, pTarget, 0) | 0
  const nDist = UNITS_GetApproximateDistance113c(m, unit, pTarget) | 0
  const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (wSkill1 > 0 && MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, unit, wSkill1) !== 0) {
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (nDist < sx16(m.u16((pMonStatsTxt + 0x56 + nDiff * 2) >>> 0))) {
      const nRoll = rollSeed6FC21180(m, (unit + 0x20) >>> 0, 100) | 0
      const nDiffChance = m.u8((game + 0x6d) >>> 0)
      if (sx16(m.u16((pMonStatsTxt + 0x5c + nDiffChance * 2) >>> 0)) > nRoll) {
        const targetX = UNIT_GetPosX113c(m, pTarget) | 0
        const targetY = UNIT_GetPosY113c(m, pTarget) | 0
        const selfX = UNIT_GetPosX113c(m, unit) | 0
        const selfY = UNIT_GetPosY113c(m, unit) | 0
        const dx = (targetX - selfX) | 0
        const dy = (targetY - selfY) | 0
        let distToCoords = UNITS_GetUnitDistanceToCoordinates113c(m, unit, targetX, targetY) | 0
        if (distToCoords === 0) {
          distToCoords = 1
        }
        const nMult = sx16(
          m.u16((pMonStatsTxt + 0x68 + m.u8((game + 0x6d) >>> 0) * 2) >>> 0),
        )
        const stepX = Math.trunc(Math.imul(nMult, dx) / distToCoords) | 0
        const stepY = Math.trunc(Math.imul(nMult, dy) / distToCoords) | 0
        const nMode = (m.u8((pMonStatsTxt + 0x180) >>> 0) << 24) >> 24
        const sp = allocScratch(0x20)
        try {
          MONSTER_InitModeChangeStrc113c(m, unit, sp, nMode)
          const pSkill =
            SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(
              m,
              unit,
              sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)),
            ) >>> 0
          SKILLS_SetUsedSkill113c(m, unit, pSkill)
          PATH_SetStepNum113c(m, m.u32((unit + 0x2c) >>> 0), 1)
          const destX = (targetX + stepX) | 0
          const destY = (targetY + stepY) | 0
          m.setU32((sp + 0x0c) >>> 0, destX >>> 0)
          m.setU32((sp + 0x10) >>> 0, destY >>> 0)
          m.setU8((sp + 0x15) >>> 0, 0x64)
          MONSTER_StartMode113c(m, game, unit, nMode, 0, destX, destY)
        } finally {
          freeScratch(0x20)
        }
        return
      }
    }
  }
  if (bInMelee !== 0) {
    const nRollMelee = rollSeed6FC21180(m, (unit + 0x20) >>> 0, 100) | 0
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (nRollMelee >= sx16(m.u16((pMonStatsTxt + 0x62 + nDiff * 2) >>> 0))) {
      AI_Stall113c(m, game, unit, 0x19)
      return
    }
    const nAtkRoll = rollSeed6FC21180(m, (unit + 0x20) >>> 0, 2) | 0
    AI_StartAttackMode113c(m, nAtkRoll !== 0 ? 4 : 5, unit, game, pTarget)
    return
  }
  AI_ApproachTarget113c(m, game, unit, pTarget, 2, 0, 0, 1, 0)
  AI_ScheduleAiThinkTimer_6FD120C0_113c(m, game, unit, 10)
}


/**
 * [14/39] Destruction's End / Worldstone Chamber minion AI think callback (`0x6FCC7410`).
 * @dll D2Game.dll
 * @va 0x6FCC7410
 * @ordinalOrName D2Game_6FCC7410
 */
export function MONAI_WorldstoneMinionThink_6FCC7410_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC7410)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const aiParam = pAiParam >>> 0
  const pMonStatsTxt = m.u32((aiParam + 0x1c) >>> 0) >>> 0
  const pCtx = allocScratch(8)
  let pWorldstoneObj = 0
  try {
    m.setU32(pCtx, 0)
    m.setU32((pCtx + 4) >>> 0, 0x19)
    pWorldstoneObj =
      AITARGET_ScanUnitsByModeTable113c(
        m,
        1,
        pCtx,
        game,
        unit,
        0x6fcc39e0,
      ) >>> 0
  } finally {
    freeScratch(8)
  }
  if (pWorldstoneObj === 0) {
    AI_Stall113c(m, game, unit, 0x19)
    return
  }
  const nDist = UNITS_GetApproximateDistance113c(m, unit, pWorldstoneObj) | 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const nThreshold = sx16(m.u16((pMonStatsTxt + 0x56 + nDiff * 2) >>> 0))
  if (nDist < nThreshold) {
    ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c(m, game)
    STATES_ToggleGfxStateFlag113c(m, unit, 0x92, 1)
    PATH_ClearPathPointsAndFlag0x20_113c(m, m.u32((unit + 0x2c) >>> 0))
    let pEvent = m.u32((unit + 0xdc) >>> 0) >>> 0
    while (pEvent !== 0) {
      const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
      if (m.u8(pEvent) === 2) {
        EVENT_FreeNode113c(m, game, pEvent)
      }
      pEvent = pNext
    }
    const nGuid = m.u32((unit + 0x0c) >>> 0) >>> 0
    const nType = m.u32(unit) >>> 0
    const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
    DUNGEON_AddRoomPortalNode113c(m, pRoom, nType, nGuid)
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, unit)
    UNITROOM_RemoveUnitFromRoom113c(m, unit)
    SUNIT_FreeUnit113c(m, game, unit)
    return
  }
  let pAiControl = 0
  if (unit !== 0 && m.u32(unit) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
    }
  }
  if (pAiControl !== 0) {
    m.setU32((pAiControl + 0x18) >>> 0, 7)
  }
  AI_ApproachTarget113c(m, game, unit, pWorldstoneObj, 2, 0, 0, 1, 0)
}

/**
 * [15/39] Nihlathak AI think callback (`0x6FCC7580`).
 * @dll D2Game.dll
 * @va 0x6FCC7580
 * @ordinalOrName D2Game_6FCC7580
 */
export function MONAI_NihlathakThink_6FCC7580_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC7580)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const aiParam = pAiParam >>> 0
  const pMonStatsTxt = m.u32((aiParam + 0x1c) >>> 0) >>> 0
  const bInMelee = m.u32((aiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((aiParam + 0x08) >>> 0) >>> 0
  const nDist = i32(m, (aiParam + 0x14) >>> 0)
  const pSeed = (unit + 0x20) >>> 0

  ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c(m, game)
  if (STATES_CheckState113c(m, unit, 0x0c) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, unit, 0x0c, 0)
  }

  const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (pTarget === 0) {
    const pSkill1 = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, wSkill1) >>> 0
    if (pSkill1 !== 0 && unit !== 0 && m.u32(unit) === 1) {
      const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const nAnimOrState = m.u32((pMonData + 0x54) >>> 0) | 0
        if (nAnimOrState === 3 || nAnimOrState === 0x13) {
          const nMode = SKILLS_GetLeftSkillFromSkillList113c(m, pSkill1) | 0
          const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill1, 0x6fd1b6b0, 0x1537) | 0
          const nRadius = sx16(
            m.u16((pMonStatsTxt + 0x5c + m.u8((game + 0x6d) >>> 0) * 2) >>> 0),
          )
          AI_CastSkillWithModeRandomScatter_6FD12420_113c(m, unit, nRadius, nSkillId, nMode)
          return
        }
      }
    }
    AI_Stall113c(m, game, unit, 0x19)
    return
  }

  const pSkill1 = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, wSkill1) >>> 0
  if (pSkill1 !== 0 && bInMelee !== 0) {
    const nRoll = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (nRoll < sx16(m.u16((pMonStatsTxt + 0x56 + nDiff * 2) >>> 0))) {
      const nMode = SKILLS_GetLeftSkillFromSkillList113c(m, pSkill1) | 0
      const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill1, 0x6fd1b6b0, 0x1544) | 0
      const nRadius = sx16(
        m.u16((pMonStatsTxt + 0x5c + m.u8((game + 0x6d) >>> 0) * 2) >>> 0),
      )
      AI_CastSkillWithModeRandomScatter_6FD12420_113c(m, unit, nRadius, nSkillId, nMode)
      return
    }
  }

  const nDiffFlee = m.u8((game + 0x6d) >>> 0)
  if (nDist < sx16(m.u16((pMonStatsTxt + 0x6e + nDiffFlee * 2) >>> 0))) {
    const nRollFlee = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    if (nRollFlee < 0x28) {
      if ((AI_FleeFrom113c(m, game, unit, pTarget, 5, 1) | 0) !== 0) {
        return
      }
    }
  }

  const wSkill3 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
  if (wSkill3 > 0) {
    const pSkill3 = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, wSkill3) >>> 0
    if (pSkill3 !== 0) {
      const nRoll3 = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const nDiff3 = m.u8((game + 0x6d) >>> 0)
      if (nRoll3 < sx16(m.u16((pMonStatsTxt + 0x62 + nDiff3 * 2) >>> 0))) {
        const nSkillLvl3 = SKILLS_EvaluateSkillLevel113c(m, unit, pSkill3, 1) | 0
        const pCorpse = SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c(m, pTarget, unit, nSkillLvl3) >>> 0
        if (pCorpse !== 0) {
          const nMode3 = m.u8((pMonStatsTxt + 0x182) >>> 0)
          const nSkillId3 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
          if (AI_CastSkillWithMode113c(m, nMode3, unit, game, nSkillId3, pCorpse, 0, 0) !== 0) {
            return
          }
        }
      }
    }
  }

  const wSkill4Check = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
  if (wSkill4Check > 0) {
    const pSkill4Check =
      SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, wSkill4Check) >>> 0
    if (pSkill4Check !== 0) {
      const nRoll4 = rollSeed6FC21180(m, pSeed, 100) | 0
      if (nRoll4 < 0x3c && nDist < 0x0e) {
        const nMode4 = m.u8((pMonStatsTxt + 0x183) >>> 0)
        const nSkillId4 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
        AI_CastSkillWithMode113c(m, nMode4, unit, game, nSkillId4, pTarget, 0, 0)
        return
      }
    }
  }

  if (sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)) > 0) {
    const nRoll2 = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiff2 = m.u8((game + 0x6d) >>> 0)
    if (nRoll2 < sx16(m.u16((pMonStatsTxt + 0x68 + nDiff2 * 2) >>> 0))) {
      const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
      if (MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, unit, wSkill2) !== 0) {
        const pScanCtx = allocScratch(0x18)
        let pMinionTarget = 0
        try {
          m.setU32(pScanCtx, 0)
          m.setU32((pScanCtx + 0x04) >>> 0, 0x271)
          m.setU32((pScanCtx + 0x08) >>> 0, 0x32)
          m.setU32((pScanCtx + 0x0c) >>> 0, 0)
          m.setU32((pScanCtx + 0x10) >>> 0, 0)
          m.setU32((pScanCtx + 0x14) >>> 0, 0)
          AITARGET_ScanUnitsByModeTable113c(m, 1, pScanCtx, game, unit, 0x6fc35c40)
          pMinionTarget = m.u32((pScanCtx + 0x10) >>> 0) >>> 0
        } finally {
          freeScratch(0x18)
        }
        if (pMinionTarget !== 0) {
          const nSkillId2 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
          const nMode2 = m.u8((pMonStatsTxt + 0x181) >>> 0)
          AI_CastSkillWithMode113c(m, nMode2, unit, game, nSkillId2, pMinionTarget, 0, 0)
          return
        }
        if (sx16(m.u16((pMonStatsTxt + 0x178) >>> 0)) > 0) {
          const pTables = getSgptDataTablesPtr(m)
          const nMonStatsCount = pTables !== 0 ? i32(m, (pTables + 0xa80) >>> 0) : 0
          const nCheckClassId = nMonStatsCount > 0x210 ? 0x210 : -1
          const posY = UNIT_GetPosY113c(m, unit) | 0
          const posX = UNIT_GetPosX113c(m, unit) | 0
          const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
          if (MONSTER_CheckSpawnTileFree113c(m, pRoom, nCheckClassId, posY, posX, 0) !== 0) {
            const pTables2 = getSgptDataTablesPtr(m)
            const nMonStatsCount2 = pTables2 !== 0 ? i32(m, (pTables2 + 0xa80) >>> 0) : 0
            const nRawSpawnId = nMonStatsCount2 > 0x1c5 ? 0x1c5 : -1
            const pRoom2 = UNITS_GetRoom113c(m, unit) >>> 0
            const nResolvedSpawnId =
              DRLG_ResolveMonsterSubClassIdForRoom113c(m, pRoom2, nRawSpawnId) | 0
            const pAiCtrl = m.u32(aiParam) >>> 0
            if (pAiCtrl !== 0) {
              m.setU32((pAiCtrl + 0x3c) >>> 0, nResolvedSpawnId >>> 0)
            }
            const nSkillId5 = sx16(m.u16((pMonStatsTxt + 0x178) >>> 0))
            const nMode5 = m.u8((pMonStatsTxt + 0x184) >>> 0)
            AI_CastSkillWithMode113c(m, nMode5, unit, game, nSkillId5, pTarget, 0, 0)
            return
          }
        }
        AI_IdleWander113c(m, game, unit, 6)
        return
      }
    }
  }

  const wSkill4Fallback = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
  if (wSkill4Fallback > 0) {
    const pSkill4 =
      SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, wSkill4Fallback) >>> 0
    if (pSkill4 !== 0 && nDist < 0x0e) {
      const nSkillId4 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
      const nMode4 = m.u8((pMonStatsTxt + 0x183) >>> 0)
      AI_CastSkillWithMode113c(m, nMode4, unit, game, nSkillId4, pTarget, 0, 0)
      return
    }
  }

  const nRollWalk = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
  if (nRollWalk < 0x3c) {
    AI_ApproachTarget113c(m, game, unit, pTarget, 2, 0, 0, 1, 0)
  }
  AI_Stall113c(m, game, unit, 5)
}


/**
 * [16/39] Act 5 Quest 2 rescued barbarian soldier AI think callback (`0x6FCC7A10`).
 * @dll D2Game.dll
 * @va 0x6FCC7A10
 * @ordinalOrName D2Game_6FCC7A10
 */
export function MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _pAiParam = 0,
): void {
  hitD2GameVa113c(0x6FCC7A10)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pSeed = (unit + 0x20) >>> 0
  const pOutObjPtr = allocScratch(8)
  let bFoundPrison = 0
  let pPrisonObj = 0
  try {
    m.setU32(pOutObjPtr, 0)
    bFoundPrison = ACT5Q2_FindSpawnedPrisonObjectForUnit_6FC7A290_113c(
      m,
      game,
      unit,
      pOutObjPtr,
    ) | 0
    pPrisonObj = m.u32(pOutObjPtr) >>> 0
  } finally {
    freeScratch(8)
  }

  if (bFoundPrison !== 0) {
    if (pPrisonObj === 0) {
      AI_Stall113c(m, game, unit, 0x19)
      return
    }
    let bDespawn = ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c(m, game, unit) | 0
    if (bDespawn === 0) {
      const targetY = UNIT_GetPosY113c(m, pPrisonObj) | 0
      const targetX = UNIT_GetPosX113c(m, pPrisonObj) | 0
      const dist = UNITS_GetOctileDistanceToCoordinates113c(m, unit, targetX, targetY) >>> 0
      if (dist < 4) {
        bDespawn = 1
      }
    }
    if (bDespawn !== 0) {
      ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c(m, game, unit)
      PATH_ClearPathPointsAndFlag0x20_113c(m, m.u32((unit + 0x2c) >>> 0))
      let pEvent = m.u32((unit + 0xdc) >>> 0) >>> 0
      while (pEvent !== 0) {
        const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
        if (m.u8(pEvent) === 2) {
          EVENT_FreeNode113c(m, game, pEvent)
        }
        pEvent = pNext
      }
      const nGuid = m.u32((unit + 0x0c) >>> 0) >>> 0
      const nType = m.u32(unit) >>> 0
      const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
      DUNGEON_AddRoomPortalNode113c(m, pRoom, nType, nGuid)
      UNITS_SetTargetUnitForDynamicUnitEx113c(m, unit)
      UNITROOM_RemoveUnitFromRoom113c(m, unit)
      SUNIT_FreeUnit113c(m, game, unit)
      return
    }
    const nRollWalk = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    if (nRollWalk < 0x46) {
      AI_ApproachTarget113c(m, game, unit, pPrisonObj, 2, 0, 0, 1, 7)
      return
    }
    if ((rollSeed6FC21180(m, pSeed, 100) | 0) < 10) {
      AI_IdleWander113c(m, game, unit, 4)
      return
    }
    AI_Stall113c(m, game, unit, 10)
    return
  }

  const pPlayer = AI_FindNearestPlayerTarget113c(m, game, unit) >>> 0
  if (pPlayer !== 0 && m.u32(pPlayer) === 0) {
    if (ACT5Q2_HasNearbySoldierPrisonDoorInMode12_6FC7A160_113c(m, pPlayer, game, unit) !== 0) {
      ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c(m, game, pPlayer, unit)
      if (m.u32((unit + 0xd0) >>> 0) === 0x0b) {
        SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c(m, game, 8, unit, 0)
      }
    } else {
      ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c(m, game)
      if ((rollSeed6FC21180(m, pSeed, 1000) | 0) < 100) {
        const pPkt = allocScratch(8)
        try {
          m.setU8(pPkt, 0x8a)
          m.setU8((pPkt + 1) >>> 0, 1)
          m.setU32((pPkt + 2) >>> 0, unit !== 0 ? m.u32((unit + 0x0c) >>> 0) : 0xffffffff)
          let pClient = 0
          if (m.u32(pPlayer) === 0) {
            const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
            if (pPlayerData !== 0) {
              pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
            }
          }
          D2NET_SendPacket0x06BytesToClient113c(m, pPkt, pClient)
        } finally {
          freeScratch(8)
        }
      }
    }
  }
  AI_Stall113c(m, game, unit, 0x19)
}

/**
 * [17/39] Baal / Clone Baal combat AI think callback (`0x6FCC9610`).
 * @dll D2Game.dll
 * @va 0x6FCC9610
 * @ordinalOrName D2Game_6FCC9610
 */
export function AIBAAL_CombatThink_6FCC9610_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC9610)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const aiParam = pAiParam >>> 0
  const pMonStatsTxt = m.u32((aiParam + 0x1c) >>> 0) >>> 0

  let pCmd = findAiCommandByTypeInline113c(m, unit, 0x0a) >>> 0
  if (pCmd === 0 && unit !== 0) {
    const uType = m.u32(unit) | 0
    const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
    let posX = 0
    if (uType === 2 || (uType > 3 && uType <= 5)) {
      posX = pPath !== 0 ? m.u32((pPath + 0x0c) >>> 0) : 0
    } else if (pPath !== 0) {
      posX = PATH_GetPosX113c(m, pPath) >>> 0
    }
    let posY = 0
    if (uType === 2 || (uType > 3 && uType <= 5)) {
      posY = pPath !== 0 ? m.u32((pPath + 0x10) >>> 0) : 0
    } else if (pPath !== 0) {
      posY = PATH_GetPosY113c(m, pPath) >>> 0
    }
    AIGENERAL_CopyAiCommandParams113c(m, unit, 0x0a, posX, posY, 0, 0)
    pCmd = findAiCommandByTypeInline113c(m, unit, 0x0a) >>> 0
  }

  const pScratch = allocScratch(8)
  let pTarget = 0
  let nBestScore = 0
  let nCandidateCount = 0
  try {
    m.setU32(pScratch, 0)
    m.setU32((pScratch + 4) >>> 0, 0)
    pTarget =
      AITARGET_FindBestHostileTarget_6FCC4610_113c(
        m,
        game,
        unit,
        pScratch,
        (pScratch + 4) >>> 0,
        pCmd,
        MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c,
      ) >>> 0
    nBestScore = i32(m, pScratch)
    nCandidateCount = i32(m, (pScratch + 4) >>> 0)
  } finally {
    freeScratch(8)
  }

  const pAiControl = m.u32(aiParam) >>> 0
  const nAction =
    AIBAAL_SelectCombatAction_6FCC8E80_113c(
      m,
      pAiControl,
      unit,
      pTarget,
      nBestScore,
      nCandidateCount,
      pCmd,
    ) | 0

  if (nAction !== 5) {
    const wSkill7 = sx16(m.u16((pMonStatsTxt + 0x17e) >>> 0))
    if (wSkill7 >= 0) {
      const pTables = getSgptDataTablesPtr(m)
      if (pTables !== 0 && wSkill7 < i32(m, (pTables + 0xba0) >>> 0)) {
        const pSkillsTxt = m.u32((pTables + 0xb98) >>> 0) >>> 0
        const pSkillRec = (pSkillsTxt + Math.imul(wSkill7, 0x23c)) >>> 0
        if (pSkillRec !== 0) {
          const wState = sx16(m.u16((pSkillRec + 0x80) >>> 0))
          if (wState >= 0 && STATES_CheckState113c(m, unit, wState) === 0) {
            const nSkill7 = sx16(m.u16((pMonStatsTxt + 0x17e) >>> 0))
            const nMode7 = m.u8((pMonStatsTxt + 0x187) >>> 0)
            if (AI_CastSkillWithMode113c(m, nMode7, unit, game, nSkill7, pTarget, 0, 0) !== 0) {
              if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
              return
            }
          }
        }
      }
    }
  }

  const getUnitAiCtrl = (): number => {
    if (unit !== 0 && m.u32(unit) === 1) {
      const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        return m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    return 0
  }

  const castSlotOrStall2 = (skillOff: number, modeOff: number): void => {
    const wSkill = sx16(m.u16((pMonStatsTxt + skillOff) >>> 0))
    if (wSkill < 0) {
      AI_Stall113c(m, game, unit, 2)
    } else {
      const nMode = m.u8((pMonStatsTxt + modeOff) >>> 0)
      AI_CastSkillWithMode113c(m, nMode, unit, game, wSkill, pTarget, 0, 0)
    }
    if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
  }

  switch (nAction) {
    case 1: {
      const pCtrl = getUnitAiCtrl()
      if (pCtrl !== 0) m.setU32((pCtrl + 0x1c) >>> 0, 0x14)
      const targetY = UNIT_GetPosY113c(m, pTarget) | 0
      const targetX = UNIT_GetPosX113c(m, pTarget) | 0
      AI_ApproachTarget113c(m, game, unit, 0, 2, targetX, targetY, 1, 0)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    }
    case 2:
      AI_StartAttackMode113c(m, 4, unit, game, pTarget)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    case 3:
      AI_StartAttackMode113c(m, 5, unit, game, pTarget)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    case 4:
      AI_StartAttackMode113c(m, 0x0b, unit, game, pTarget)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    case 5: {
      if (sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)) < 0) {
        AI_Stall113c(m, game, unit, 2)
        if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
        return
      }
      if (STATES_CheckState113c(m, unit, 0x0c) !== 0) {
        STATES_ToggleGfxStateFlag113c(m, unit, 0x0c, 0)
        AI_Stall113c(m, game, unit, 2)
        if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
        return
      }
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
      AI_CastSkillWithMode113c(m, nMode0, unit, game, wSkill0, pTarget, 0, 0)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, nAction >>> 0)
      return
    }
    case 6:
      castSlotOrStall2(0x174, 0x182)
      return
    case 7:
      castSlotOrStall2(0x172, 0x181)
      return
    case 8:
      castSlotOrStall2(0x176, 0x183)
      return
    case 9:
      castSlotOrStall2(0x17c, 0x186)
      return
    case 10:
      castSlotOrStall2(0x178, 0x184)
      return
    case 12:
      AI_CircleStrafeTarget_6FD126B0_113c(m, unit, 0, game, pTarget, 4)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    case 13:
      castSlotOrStall2(0x17a, 0x185)
      return
    case 14: {
      const pCtrl = getUnitAiCtrl()
      if (pCtrl !== 0) {
        m.setU32((pCtrl + 0x1c) >>> 0, 0x32)
        m.setU8((pCtrl + 0x20) >>> 0, 0x4d)
      }
      const tetherX = i32(m, (pCmd + 0x0c) >>> 0)
      const tetherY = i32(m, (pCmd + 0x10) >>> 0)
      if (AI_ApproachTarget113c(m, game, unit, 0, 2, tetherX, tetherY, 1, 4) === 0) {
        let pEv = m.u32((unit + 0xdc) >>> 0) >>> 0
        while (pEv !== 0) {
          const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
          if (m.u8(pEv) === 2) EVENT_FreeNode113c(m, game, pEv)
          pEv = pNext
        }
        const unitX = UNIT_GetPosX113c(m, unit) | 0
        const unitY = UNIT_GetPosY113c(m, unit) | 0
        const dist = UNITS_GetOctileDistanceToCoordinates113c(m, unit, tetherX, tetherY) | 0
        const signX = unitX < tetherX ? -1 : unitX > tetherX ? 1 : 0
        const signY = unitY < tetherY ? -1 : unitY > tetherY ? 1 : 0
        const halfDist = dist >> 1
        const midX = (tetherX + Math.imul(halfDist, signX)) | 0
        const midY = (tetherY + Math.imul(halfDist, signY)) | 0
        const pCtrl2 = getUnitAiCtrl()
        if (pCtrl2 !== 0) {
          m.setU32((pCtrl2 + 0x1c) >>> 0, 0x32)
          m.setU8((pCtrl2 + 0x20) >>> 0, 0x4d)
        }
        if (AI_ApproachTarget113c(m, game, unit, 0, 2, midX, midY, 1, 4) === 0) {
          let pEv2 = m.u32((unit + 0xdc) >>> 0) >>> 0
          while (pEv2 !== 0) {
            const pNext2 = m.u32((pEv2 + 0x24) >>> 0) >>> 0
            if (m.u8(pEv2) === 2) EVENT_FreeNode113c(m, game, pEv2)
            pEv2 = pNext2
          }
          AI_Stall113c(m, game, unit, 2)
        }
      }
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    }
    case 15: {
      if (pTarget === 0 || m.u32(pTarget) !== 0) {
        AI_Stall113c(m, game, unit, 3)
        if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
        return
      }
      const dwCloneGuid = PLAYER_GetPlayerDataField48_6FC57440_113c(m, pTarget) >>> 0
      if (game === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
      }
      let pNode = m.u32((game + 0x1520 + (dwCloneGuid & 0x7f) * 4) >>> 0) >>> 0
      while (pNode !== 0 && m.u32((pNode + 0x0c) >>> 0) !== dwCloneGuid) {
        pNode = m.u32((pNode + 0xe4) >>> 0) >>> 0
      }
      if (pNode === 0) {
        AI_Stall113c(m, game, unit, 2)
        if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
        return
      }
      const wSkill6 = sx16(m.u16((pMonStatsTxt + 0x17c) >>> 0))
      if (wSkill6 < 0) {
        AI_Stall113c(m, game, unit, 2)
        if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
        return
      }
      const nMode6 = m.u8((pMonStatsTxt + 0x186) >>> 0)
      AI_CastSkillWithMode113c(m, nMode6, unit, game, wSkill6, 0, dwCloneGuid | 0, 2)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    }
    case 16: {
      const pCtrl = getUnitAiCtrl()
      if (pCtrl !== 0) m.setU32((pCtrl + 0x1c) >>> 0, 0x14)
      AI_IdleWander113c(m, game, unit, 5)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    }
    default: {
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const nDelay = nDiff === 1 ? 8 : nDiff === 2 ? 4 : 0x0c
      AI_Stall113c(m, game, unit, nDelay)
      if (pAiControl !== 0) m.setU32((pAiControl + 0x14) >>> 0, 0)
      return
    }
  }
}


/**
 * [18/39] Use-item handler for scroll/tome of identify (`0x6FCCD9C0`).
 * @dll D2Game.dll
 * @va 0x6FCCD9C0
 * @ordinalOrName D2Game_6FCCD9C0
 */
export function ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  pItem: number,
  _dwArg2 = 0,
  _dwArg3 = 0,
  _dwArg4 = 0,
  _dwArg5 = 0,
): number {
  hitD2GameVa113c(0x6FCCD9C0)
  const game = pGame >>> 0
  const player = pPlayerUnit >>> 0
  const item = pItem >>> 0
  if (player === 0 || m.u32(player) !== 0) {
    return 0
  }

  let checkStashOrCube = true
  if (m.u8((player + 0x6c) >>> 0) === 0) {
    const pInventory = m.u32((player + 0x60) >>> 0) >>> 0
    if (INVENTORY_GetCursorItem113c(m, pInventory) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
      if (pPlayerData === 0 || m.u32((pPlayerData + 0x4c) >>> 0) === 0) {
        checkStashOrCube = false
      }
    }
  }

  if (checkStashOrCube) {
    const bHasInteract = m.u8((player + 0x6c) >>> 0)
    const dwInteractId = m.u32((player + 0x64) >>> 0) >>> 0
    const dwInteractType = m.u32((player + 0x68) >>> 0) >>> 0
    if (bHasInteract === 0) {
      return 0
    }
    const pObj = SUNIT_GetServerUnit113c(m, game, dwInteractType, dwInteractId) >>> 0
    if (pObj === 0 || m.u32(pObj) !== 2 || m.u32((pObj + 0x04) >>> 0) !== 0x10b) {
      return 0
    }
    m.setU32((player + 0x64) >>> 0, 0xffffffff)
    m.setU32((player + 0x68) >>> 0, 6)
    m.setU8((player + 0x6c) >>> 0, 0)
    ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, player)
    let pClientClose = 0
    if (m.u32(player) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
      if (pPlayerData !== 0) {
        pClientClose = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
      }
    }
    NET_SendPacket77_ButtonAction_6FCAB340_113c(m, 0x11, pClientClose)
  }

  const dwItemGuid = item !== 0 ? m.u32((item + 0x0c) >>> 0) : 0xffffffff
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, player, 4, dwItemGuid)
  let pClient = 0
  if (m.u32(player) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    if (pPlayerData !== 0) {
      pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
    }
  }
  const pPkt = allocScratch(8)
  try {
    m.setU8(pPkt, 0x77)
    m.setU8((pPkt + 1) >>> 0, 0x15)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt, 2)
  } finally {
    freeScratch(8)
  }
  ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c(m, player)
  return 0
}

/**
 * [19/39] Item event callback for `item_reanimate` on monster kill (`0x6FCCF210`).
 * @dll D2Game.dll
 * @va 0x6FCCF210
 * @ordinalOrName D2Game_6FCCF210
 */
export function ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  pDefender: number,
  _dwArg3 = 0,
  _dwArg4 = 0,
  dwStatAndLayer = 0,
): number {
  hitD2GameVa113c(0x6FCCF210)
  const game = pGame >>> 0
  let attacker = pAttacker >>> 0
  const defender = pDefender >>> 0
  if (attacker === 0 || defender === 0 || m.u32(defender) !== 1) {
    return 0
  }
  const pDefMonData = m.u32((defender + 0x14) >>> 0) >>> 0
  if (pDefMonData !== 0 && (m.u8((pDefMonData + 0x16) >>> 0) & 0x0c) !== 0) {
    return 0
  }
  const nStatId = (dwStatAndLayer >>> 16) & 0xffff
  const nMonsterClassId = dwStatAndLayer & 0xffff
  const nChance = STATLIST_GetUnitStatWithLayer113c(m, attacker, nStatId, nMonsterClassId) | 0
  if (nChance <= 0) {
    return 0
  }
  const nRoll = SEED_RollLimitedFast113c(m, (attacker + 0x20) >>> 0, 100) | 0
  if (nRoll >= nChance) {
    return 0
  }
  while (attacker !== 0 && m.u32(attacker) !== 0) {
    attacker = AIGENERAL_GetPackLeaderUnit113c(m, attacker) >>> 0
  }
  if (attacker === 0) {
    return 0
  }
  const dwOwnerPlayerGuid = m.u32((attacker + 0x0c) >>> 0) >>> 0
  UNITEVENT_RegisterTimerOrItemEventNode113c(
    m,
    defender,
    game,
    0x0d,
    nMonsterClassId,
    dwOwnerPlayerGuid,
    0x6fcce200,
    0,
    dwOwnerPlayerGuid,
  )
  return 1
}

/**
 * [20/39] Reactivates/resurrects a monster unit in its room and restores collision (`0x6FCD33B0`).
 * @dll D2Game.dll
 * @va 0x6FCD33B0
 * @ordinalOrName D2Game_6FCD33B0
 */
export function MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCD33B0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  if (pRoom === 0) {
    return 0
  }
  const nMaxHp = STATLIST_GetUnitStat113c(m, unit, 7, 0) | 0
  STATLIST_SetUnitStat113c(m, unit, 6, nMaxHp, 0)

  let wCollisionMask = 0x80
  if (unit !== 0) {
    const dwFlags = (m.u32((unit + 0xc4) >>> 0) | 0x0e) >>> 0
    m.setU32((unit + 0xc4) >>> 0, dwFlags)
    if (m.u32(unit) === 1) {
      m.setU32((unit + 0xc4) >>> 0, (dwFlags | 0x04020000) >>> 0)
      MONSTER_ScheduleInitialAiEvent113c(m, game, unit)
      MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c(m, unit, (game + 0xf0) >>> 0)
      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
      if (nLevelId !== 0) {
        const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, nLevelId) >>> 0
        const bQuestId = pLevelsTxt !== 0 ? m.u8((pLevelsTxt + 0x30) >>> 0) : 0
        if (bQuestId !== 0) {
          if ((QUESTS_AttachUnitToQuest_6FC55890_113c(m, unit, bQuestId, game) | 0) === 1) {
            if (m.u32(0x6fd31c20) !== 0) {
              NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, 0x6fd1cc5c, game, 4)
            }
          }
        }
      }
      wCollisionMask = 0x100
    }
  }

  const pPath = unit !== 0 ? m.u32((unit + 0x2c) >>> 0) >>> 0 : 0
  PATH_SetCollisionMask113c(m, pPath, wCollisionMask)
  PATH_RefreshUnitCollisionPattern113c(m, unit)

  const uType = unit !== 0 ? m.u32(unit) | 0 : 0
  let posY = 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    posY = pPath !== 0 ? i32(m, (pPath + 0x10) >>> 0) : 0
  } else if (pPath !== 0) {
    posY = PATH_GetPosY113c(m, pPath) | 0
  }
  let posX = 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    posX = pPath !== 0 ? i32(m, (pPath + 0x0c) >>> 0) : 0
  } else if (pPath !== 0) {
    posX = PATH_GetPosX113c(m, pPath) | 0
  }

  const nPattern = PATH_GetUnitCollisionPattern113c(m, unit) | 0
  COLLISION_SetUnitCollisionMaskWithPattern113c(m, pRoom, posX, posY, nPattern, wCollisionMask)
  return 1
}


/**
 * [21/39] Skill `pSrvDoFunc` 120: launches weapon-mastery or `Skills.txt` missile (`0x6FCD49F0`).
 * @dll D2Game.dll
 * @va 0x6FCD49F0
 * @ordinalOrName D2Game_6FCD49F0
 */
export function SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD49F0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) {
    return 0
  }
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= i32(m, (pTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
  const pSkillRec = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillRec === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((unit + 0x2c) >>> 0)) >>> 0
  if (pTarget === unit || pTarget === 0) {
    return 0
  }
  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  const pOutBonus = allocScratch(8)
  let nWeapMissileId = 0
  let nOutLvl = 0
  try {
    m.setU32(pOutBonus, 0)
    nWeapMissileId = SKILLS_GetWeaponMasteryPassiveStatId113c(m, unit, pOutBonus) | 0
    nOutLvl = i32(m, pOutBonus)
  } finally {
    freeScratch(8)
  }

  if (nWeapMissileId !== 0 && nWeapMissileId !== 0x1f) {
    if (MISSILES_GetTxtRecordFast113c(m, nWeapMissileId) === 0) {
      return 0
    }
    SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
      m,
      game,
      nWeapMissileId,
      unit,
      skillId,
      nOutLvl,
      0,
      0,
      0,
      0,
      0,
    )
    return 1
  }

  const nSrvMissile = sx16(m.u16((pSkillRec + 0x48) >>> 0))
  const pTables2 = getSgptDataTablesPtr(m)
  if (
    nSrvMissile < 0 ||
    pTables2 === 0 ||
    nSrvMissile >= i32(m, (pTables2 + 0xb6c) >>> 0) ||
    MISSILES_GetTxtRecordFast113c(m, nSrvMissile) === 0
  ) {
    return 0
  }
  const pBitMasks = m.u32(0x6fd18be0) >>> 0
  const bMask4 = pBitMasks !== 0 ? m.u8((pBitMasks + 4) >>> 0) : 0
  if ((m.u8((pSkillRec + 4) >>> 0) & bMask4) !== 0) {
    SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
      m,
      0,
      unit,
      game,
      nSrvMissile,
      skillId,
      skillLvl,
      0,
      0,
      0,
      0,
    )
    return 1
  }
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    game,
    nSrvMissile,
    unit,
    skillId,
    skillLvl,
    0,
    0,
    0,
    0,
    0,
  )
  return 1
}

/**
 * [22/39] Skill `pSrvDoFunc` 121: launches monster variant missile offset by `pMonsterData[+0x0f]` (`0x6FCD4B10`).
 * @dll D2Game.dll
 * @va 0x6FCD4B10
 * @ordinalOrName D2Game_6FCD4B10
 */
export function SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD4B10)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) {
    return 0
  }
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= i32(m, (pTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
  const pSkillRec = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillRec === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((unit + 0x2c) >>> 0)) >>> 0
  if (pTarget === unit || pTarget === 0) {
    return 0
  }
  const nBaseMissile = sx16(m.u16((pSkillRec + 0x48) >>> 0))
  const pTables2 = getSgptDataTablesPtr(m)
  const nMissilesCount = pTables2 !== 0 ? i32(m, (pTables2 + 0xb6c) >>> 0) : 0
  if (nBaseMissile < 0 || nBaseMissile >= nMissilesCount) {
    return 0
  }
  let bVariant = 0
  if (unit !== 0 && m.u32(unit) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      bVariant = m.u8((pMonData + 0x0f) >>> 0)
    }
  }
  const nMissileId = (nBaseMissile + bVariant) | 0
  if (nMissileId >= nMissilesCount || MISSILES_GetTxtRecordFast113c(m, nMissileId) === 0) {
    return 0
  }
  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  const pBitMasks = m.u32(0x6fd18be0) >>> 0
  const bMask4 = pBitMasks !== 0 ? m.u8((pBitMasks + 4) >>> 0) : 0
  if ((m.u8((pSkillRec + 4) >>> 0) & bMask4) !== 0) {
    SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
      m,
      0,
      unit,
      game,
      nMissileId,
      skillId,
      skillLvl,
      0,
      0,
      0,
      0,
    )
    return 1
  }
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    game,
    nMissileId,
    unit,
    skillId,
    skillLvl,
    0,
    0,
    0,
    0,
    0,
  )
  return 1
}

/**
 * [23/39] Skill `pSrvDoFunc` 122: launches monster variant missile offset by `pMonsterData[+0x0e]` (`0x6FCD4C20`).
 * @dll D2Game.dll
 * @va 0x6FCD4C20
 * @ordinalOrName D2Game_6FCD4C20
 */
export function SKILLS_SrvDo122_LaunchMonsterVariantMissile0E_6FCD4C20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD4C20)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) {
    return 0
  }
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= i32(m, (pTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
  const pSkillRec = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillRec === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((unit + 0x2c) >>> 0)) >>> 0
  if (pTarget === unit || pTarget === 0) {
    return 0
  }
  const nBaseMissile = sx16(m.u16((pSkillRec + 0x48) >>> 0))
  const pTables2 = getSgptDataTablesPtr(m)
  const nMissilesCount = pTables2 !== 0 ? i32(m, (pTables2 + 0xb6c) >>> 0) : 0
  if (nBaseMissile < 0 || nBaseMissile >= nMissilesCount) {
    return 0
  }
  let bVariant = 0
  if (unit !== 0 && m.u32(unit) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      bVariant = m.u8((pMonData + 0x0e) >>> 0)
    }
  }
  const nMissileId = (nBaseMissile + bVariant) | 0
  if (nMissileId >= nMissilesCount || MISSILES_GetTxtRecordFast113c(m, nMissileId) === 0) {
    return 0
  }
  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  const pBitMasks = m.u32(0x6fd18be0) >>> 0
  const bMask4 = pBitMasks !== 0 ? m.u8((pBitMasks + 4) >>> 0) : 0
  if ((m.u8((pSkillRec + 4) >>> 0) & bMask4) !== 0) {
    SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c(
      m,
      0,
      unit,
      game,
      nMissileId,
      skillId,
      skillLvl,
      0,
      0,
      0,
      0,
    )
    return 1
  }
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    game,
    nMissileId,
    unit,
    skillId,
    skillLvl,
    0,
    0,
    0,
    0,
    0,
  )
  return 1
}

/**
 * [24/39] Skill `pSrvDoFunc` 132: executes melee damage events then launches directional missile (`0x6FCD5600`).
 * @dll D2Game.dll
 * @va 0x6FCD5600
 * @ordinalOrName D2Game_6FCD5600
 */
export function SKILLS_SrvDo132_MeleeAndDirectionalMissile_6FCD5600_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD5600)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) {
    return 0
  }
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= i32(m, (pTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
  const pSkillRec = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillRec === 0) {
    return 0
  }
  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pTarget = PATH_GetTargetUnit113c(m, m.u32((unit + 0x2c) >>> 0)) >>> 0
  if (pTarget === unit || pTarget === 0) {
    return 0
  }
  SUNITDMG_ExecuteEvents113c(m, game, unit, pTarget, 1, 0)
  SUNITDMG_RemoveCombatNode113c(m, unit, pTarget)
  let nMissileId = sx16(m.u16((pSkillRec + 0x48) >>> 0))
  if (nMissileId < 0) {
    if (m.u32(unit) === 1) {
      nMissileId = MONSTER_GetMissileIdForAnimMode113c(m, unit, 1) | 0
    }
    if (nMissileId < 0) {
      return 0
    }
  }
  const pTables2 = getSgptDataTablesPtr(m)
  if (pTables2 === 0 || nMissileId >= i32(m, (pTables2 + 0xb6c) >>> 0)) {
    return 0
  }
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    game,
    nMissileId,
    unit,
    skillId,
    skillLvl,
    0,
    0,
    0,
    0,
    1,
  )
  return 1
}

/**
 * [25/39] Skill `pSrvDoFunc` 134: launches missile offset by monster subclass chain index (`0x6FCD58A0`).
 * @dll D2Game.dll
 * @va 0x6FCD58A0
 * @ordinalOrName D2Game_6FCD58A0
 */
export function SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD58A0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const skillLvl = nSkillLevel | 0
  if (skillId < 0) {
    return 0
  }
  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || skillId >= i32(m, (pTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0) >>> 0
  const pSkillRec = (pSkillsTxtBase + Math.imul(skillId, 0x23c)) >>> 0
  if (pSkillRec === 0) {
    return 0
  }
  const nBaseMissile = sx16(m.u16((pSkillRec + 0x48) >>> 0))
  if (nBaseMissile < 0 || nBaseMissile >= i32(m, (pTables + 0xb6c) >>> 0)) {
    return 0
  }
  let nMonsterId = -1
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
    nMonsterId = i32(m, (unit + 0x04) >>> 0)
  }
  const pSubClassIdx = allocScratch(8)
  let nSubIdx = 0
  try {
    m.setU32(pSubClassIdx, 0)
    DATATBLS_GetMonsterChainInfo113c(m, nMonsterId, 0, pSubClassIdx)
    nSubIdx = i32(m, pSubClassIdx)
  } finally {
    freeScratch(8)
  }
  const nMissileId = (nBaseMissile + nSubIdx) | 0
  const pTables2 = getSgptDataTablesPtr(m)
  if (nMissileId < 0 || pTables2 === 0 || nMissileId >= i32(m, (pTables2 + 0xb6c) >>> 0)) {
    return 0
  }
  SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c(
    m,
    game,
    nMissileId,
    unit,
    skillId,
    skillLvl,
    0,
    0,
    0,
    0,
    0,
  )
  return 1
}
const OBLIVION_KNIGHT_CURSE_TABLE_6FD1B454 = [0x42, 0x48, 0x52, 0x57, 0x5b] as const

/**
 * Rolls one of the 5 Oblivion Knight curses (`0x6FD1B454`: Amplify Damage `66`,
 * Weaken `72`, Life Tap `82`, Decrepify `87`, Lower Resist `91`), populates a
 * `0x68`-byte curse application context, and applies it to units in radius via
 * `AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c` with callback `0x6FC70250`.
 *
 * @dll D2Game.dll
 * @va 0x6FCD5950
 * @ordinalOrName D2Game_6FCD5950
 */
export function SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD5950)
  const nRoll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 5

  const nCurseSkillId = OBLIVION_KNIGHT_CURSE_TABLE_6FD1B454[nRoll] | 0
  if (nCurseSkillId < 0) {
    return 0
  }

  const pTables = getSgptDataTablesPtr(m)
  if (pTables === 0 || nCurseSkillId >= i32(m, (pTables + 0xba0) >>> 0)) {
    return 0
  }
  const pSkillsTxt = m.u32((pTables + 0xb98) >>> 0) >>> 0
  const pSkillRec = (pSkillsTxt + Math.imul(nCurseSkillId, 0x23c)) >>> 0
  if (pSkillRec === 0) {
    return 0
  }

  const wAuraTargetState = sx16(m.u16((pSkillRec + 0x82) >>> 0))
  if (wAuraTargetState < 0 || wAuraTargetState >= i32(m, (pTables + 0xc4) >>> 0)) {
    return 0
  }

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  const nRadius =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillRec + 0x64) >>> 0),
      nCurseSkillId,
      nSkillLevel,
    ) | 0
  const nDuration =
    SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      m.u32((pSkillRec + 0x60) >>> 0),
      nCurseSkillId,
      nSkillLevel,
    ) | 0

  const pCurseCtx = allocScratch(0x68)
  try {
    for (let i = 0; i < 0x1a; i = (i + 1) | 0) {
      m.setU32((pCurseCtx + i * 4) >>> 0, 0)
    }
    m.setU32(pCurseCtx, pGame >>> 0)
    m.setU32((pCurseCtx + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pCurseCtx + 0x08) >>> 0, 0)
    m.setU32((pCurseCtx + 0x0c) >>> 0, 0)
    m.setU32((pCurseCtx + 0x10) >>> 0, nCurseSkillId >>> 0)
    m.setU32((pCurseCtx + 0x14) >>> 0, nSkillLevel >>> 0)
    m.setU32((pCurseCtx + 0x18) >>> 0, nDuration >>> 0)
    for (let i = 0; i < 6; i = (i + 1) | 0) {
      m.setU32((pCurseCtx + 0x1c + i * 4) >>> 0, 0xffffffff)
      m.setU32((pCurseCtx + 0x34 + i * 4) >>> 0, 0)
    }
    m.setU32((pCurseCtx + 0x4c) >>> 0, wAuraTargetState >>> 0)

    if (nRoll === 0) {
      m.setU32((pCurseCtx + 0x1c) >>> 0, 0x24)
      m.setU32((pCurseCtx + 0x34) >>> 0, 0xffffff9c)
    } else if (nRoll === 1) {
      m.setU32((pCurseCtx + 0x1c) >>> 0, 0x19)
      m.setU32((pCurseCtx + 0x34) >>> 0, 0xffffffce)
    } else if (nRoll === 2) {
      m.setU32((pCurseCtx + 0x50) >>> 0, 0x05)
      m.setU32((pCurseCtx + 0x5c) >>> 0, 0x04)
    } else if (nRoll === 3) {
      m.setU32((pCurseCtx + 0x50) >>> 0, 0x01)
      m.setU32((pCurseCtx + 0x5c) >>> 0, 0x05)
      m.setU32((pCurseCtx + 0x54) >>> 0, 0x02)
      m.setU32((pCurseCtx + 0x60) >>> 0, 0x05)
    } else if (nRoll === 4) {
      const nParam1 = m.u32((pSkillRec + 0x160) >>> 0)
      m.setU32((pCurseCtx + 0x0c) >>> 0, 0x01)
      m.setU32((pCurseCtx + 0x1c) >>> 0, 0x43)
      m.setU32((pCurseCtx + 0x34) >>> 0, nParam1)
      m.setU32((pCurseCtx + 0x20) >>> 0, 0x19)
      m.setU32((pCurseCtx + 0x38) >>> 0, 0xffffffce)
      m.setU32((pCurseCtx + 0x24) >>> 0, 0x24)
      m.setU32((pCurseCtx + 0x3c) >>> 0, 0xffffffce)
      m.setU32((pCurseCtx + 0x28) >>> 0, 0x44)
      m.setU32((pCurseCtx + 0x40) >>> 0, nParam1)
    } else {
      const negVal = (-(SKILLS_EvalParam56DimReturns113c(m, nSkillLevel, nCurseSkillId) | 0)) >>> 0
      m.setU32((pCurseCtx + 0x1c) >>> 0, 0x25)
      m.setU32((pCurseCtx + 0x34) >>> 0, negVal)
      m.setU32((pCurseCtx + 0x20) >>> 0, 0x27)
      m.setU32((pCurseCtx + 0x38) >>> 0, negVal)
      m.setU32((pCurseCtx + 0x24) >>> 0, 0x29)
      m.setU32((pCurseCtx + 0x3c) >>> 0, negVal)
      m.setU32((pCurseCtx + 0x28) >>> 0, 0x2b)
      m.setU32((pCurseCtx + 0x40) >>> 0, negVal)
      m.setU32((pCurseCtx + 0x2c) >>> 0, 0x2d)
      m.setU32((pCurseCtx + 0x44) >>> 0, negVal)
    }

    return (
      AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c(
        m,
        pGame,
        3,
        pUnit,
        nRadius,
        SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c,
        pCurseCtx,
      ) | 0
    )
  } finally {
    freeScratch(0x68)
  }
}

/**
 * AI think handler for Baal's clone (`monstats` AI): verifies owner/minion
 * liveness and summon flag bit 10 (`+0xC8`), selects a Baal combat action
 * (remapping `7, 9, 14, 15` to `2`), and executes or stalls.
 *
 * @dll D2Game.dll
 * @va 0x6FCD8460
 * @ordinalOrName D2Game_6FCD8460
 */
export function AIBAAL_CloneThink_6FCD8460_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCD8460)
  if (pUnit === 0) {
    SUNITDMG_DistributeExperience113c(m, pGame, 0, pUnit)
    return
  }

  if (m.u32(pUnit >>> 0) === 1) {
    const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonsterData !== 0) {
      const pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0) >>> 0
      if (pAiGeneral !== 0 && m.u32((pAiGeneral + 0x28) >>> 0) !== 0) {
        const pLinkedUnit =
          SUNIT_GetServerUnit113c(
            m,
            pGame,
            m.u32((pAiGeneral + 0x30) >>> 0),
            m.u32((pAiGeneral + 0x2c) >>> 0),
          ) >>> 0
        if (pLinkedUnit !== 0 && SUNIT_IsDeadOrDying113c(m, pLinkedUnit) !== 0) {
          SUNITDMG_DistributeExperience113c(m, pGame, 0, pUnit)
          return
        }
      }
    }
  }

  if (((m.u32((pUnit + 0xc8) >>> 0) >>> 10) & 1) === 0) {
    SUNITDMG_DistributeExperience113c(m, pGame, 0, pUnit)
    return
  }

  const pOwner =
    SUNIT_GetServerUnit113c(m, pGame, m.u32((pUnit + 0x94) >>> 0), m.u32((pUnit + 0x98) >>> 0)) >>> 0
  if (pOwner === 0 || SUNIT_IsDeadOrDying113c(m, pOwner) !== 0) {
    SUNITDMG_DistributeExperience113c(m, pGame, 0, pUnit)
    return
  }

  const pScratch = allocScratch(0x20)
  try {
    const pBestScorePtr = pScratch
    const pCountPtr = (pScratch + 0x04) >>> 0
    m.setU32(pBestScorePtr, 0)
    m.setU32(pCountPtr, 0)

    const pTarget =
      AITARGET_FindBestHostileTargetTether75_6FCD7090_113c(
        m,
        pGame,
        pUnit,
        pCountPtr,
        pBestScorePtr,
        0,
        AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c,
      ) >>> 0

    let pCmd = findAiCommandByTypeInline113c(m, pUnit, 0x0a) >>> 0
    if (pCmd === 0) {
      const x = UNIT_GetPosX113c(m, pUnit) | 0
      const y = UNIT_GetPosY113c(m, pUnit) | 0
      AIGENERAL_CopyAiCommandParams113c(m, pUnit, 0x0a, x, y, 0, 0)
      pCmd = AIGENERAL_FindAiCommandByType113c(m, pUnit, 0x0a) >>> 0
    }

    const pAiTickParam = m.u32(pAiParam >>> 0) >>> 0
    let nAction =
      AIBAAL_SelectAction_6FCD79B0_113c(
        m,
        pUnit,
        pTarget,
        pGame,
        pAiTickParam,
        i32(m, pCountPtr),
        i32(m, pBestScorePtr),
        pCmd,
      ) | 0
    if (nAction === 7 || nAction === 9 || nAction === 0x0e || nAction === 0x0f) {
      nAction = 2
    }

    if (pTarget !== 0) {
      AIBAAL_ExecuteCommandAction_6FCD8070_113c(
        m,
        pTarget,
        pUnit,
        nAction,
        pGame,
        pAiTickParam,
        pCmd,
      )
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pUnit, 0x19)
    } else {
      AI_Stall113c(m, pGame, pUnit, 0x0f)
    }
  } finally {
    freeScratch(0x20)
  }
}
/**
 * AI think handler for Baal in the Throne Room (`0x6FCD8610`): scans for the
 * best hostile target within 1020 subtiles, ensures AI command `0x0A` exists,
 * selects and executes a Baal action, frees any existing type-2 events on
 * `pUnit`, and schedules a new type-2 AI event at `pGame->dwGameFrame + 0x19`.
 *
 * @dll D2Game.dll
 * @va 0x6FCD8610
 * @ordinalOrName D2Game_6FCD8610
 */
export function AIBAAL_ThroneRoomThink_6FCD8610_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCD8610)
  const pScratch = allocScratch(0x28)
  try {
    const pBestScorePtr = pScratch
    const pCountPtr = (pScratch + 0x04) >>> 0
    m.setU32(pBestScorePtr, 0)
    m.setU32(pCountPtr, 0)

    const pTarget =
      AITARGET_FindBestHostileTargetTether75_6FCD7090_113c(
        m,
        pGame,
        pUnit,
        pCountPtr,
        pBestScorePtr,
        0,
        AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c,
      ) >>> 0

    let pCmd = findAiCommandByTypeInline113c(m, pUnit, 0x0a) >>> 0

    if (pCmd === 0) {
      const uType = m.u32(pUnit >>> 0) | 0
      const pPathX = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      let x = 0
      if (uType === 2 || (uType > 3 && uType <= 5)) {
        x = i32(m, (pPathX + 0x0c) >>> 0)
      } else if (pPathX !== 0) {
        x = PATH_GetPosX113c(m, pPathX) | 0
      }

      const uTypeY = m.u32(pUnit >>> 0) | 0
      const pPathY = m.u32((pUnit + 0x2c) >>> 0) >>> 0
      let y = 0
      if (uTypeY === 2 || (uTypeY > 3 && uTypeY <= 5)) {
        y = i32(m, (pPathY + 0x10) >>> 0)
      } else if (pPathY !== 0) {
        y = PATH_GetPosY113c(m, pPathY) | 0
      }

      AIGENERAL_CopyAiCommandParams113c(m, pUnit, 0x0a, x, y, 0, 0)
      pCmd = findAiCommandByTypeInline113c(m, pUnit, 0x0a) >>> 0
    }

    const pAiTickParam = m.u32(pAiParam >>> 0) >>> 0
    const nAction =
      AIBAAL_SelectAction_6FCD79B0_113c(
        m,
        pUnit,
        pTarget,
        pGame,
        pAiTickParam,
        i32(m, pCountPtr),
        i32(m, pBestScorePtr),
        pCmd,
      ) | 0

    AIBAAL_ExecuteCommandAction_6FCD8070_113c(
      m,
      pTarget,
      pUnit,
      nAction,
      pGame,
      pAiTickParam,
      pCmd,
    )

    let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pEvent !== 0) {
      const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
      if (m.u8(pEvent >>> 0) === 2) {
        EVENT_FreeNode113c(m, pGame, pEvent)
      }
      pEvent = pNext
    }

    const targetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x19) >>> 0
    EVENT_SetEventFull113c(m, pGame, pUnit, 2, targetFrame, 0, 0, 0)
  } finally {
    freeScratch(0x28)
  }
}

function writeAsciiZToScratch113c(m: D2KernMemory113c, dst: number, text: string): void {
  for (let i = 0; i < text.length; i = (i + 1) | 0) {
    m.setU8((dst + i) >>> 0, text.charCodeAt(i) & 0xff)
  }
  m.setU8((dst + text.length) >>> 0, 0)
}

function dispatchQuestSeqFilter113c(
  m: D2KernMemory113c,
  pQuestTarget: number,
  pfnSeq: number,
): number {
  const fn = pfnSeq >>> 0
  if (fn === 0x6fcda4f0) {
    return ACT4Q3_SeqCallback_6FCDA4F0_113c(m, pQuestTarget) | 0
  }
  if (fn === 0x6fcda270) {
    return ACT4Q1_SeqCallback_6FCDA270_113c(m, pQuestTarget) | 0
  }
  if (fn === 0x6fce6390) {
    return ACT2Q3_SeqCallback_6FCE6390_113c(m, pQuestTarget) | 0
  }
  if (fn === 0x6fce69d0) {
    return ACT2Q5_SeqCallback_6FCE69D0_113c(m, pQuestTarget) | 0
  }
  if (fn === 0x6fce1ff0) {
    return ACT2Q4_ChainSeqFilter_6FCE1FF0_113c(m, pQuestTarget) | 0
  }
  return 1
}

/**
 * Sequence filter callback (`pfSeqFilter`) for Act 4 Quest 1 (The Fallen Angel):
 * promotes `bNotIntro` state `0 -> 1` when active (`+0x09 == 1`), or chains to
 * `pQuestData->nSeqId (+0x10)` when state is `5` or inactive (`+0x09 == 0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCDA270
 * @ordinalOrName D2Game_6FCDA270
 */
export function ACT4Q1_SeqCallback_6FCDA270_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FCDA270)
  const nState = m.u8((pQuestData + 0x0c) >>> 0)
  if (nState === 0 && m.u8((pQuestData + 0x09) >>> 0) === 1) {
    m.setU8((pQuestData + 0x0c) >>> 0, 1)
    if (m.u32(0x6fd31c20) !== 0) {
      const pBuf = allocScratch(0x80)
      try {
        writeAsciiZToScratch113c(m, pBuf, 'changing state to 1\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((pQuestData + 0x04) >>> 0),
          4,
        )
      } finally {
        freeScratch(0x80)
      }
    }
    return 1
  }

  if (nState !== 5 && m.u8((pQuestData + 0x09) >>> 0) !== 0) {
    return 1
  }

  const pNextQuest =
    QUESTS_GetQuestData_6FC53F30_113c(
      m,
      m.u32((pQuestData + 0x04) >>> 0),
      i32(m, (pQuestData + 0x10) >>> 0),
    ) >>> 0
  if (pNextQuest === 0) {
    return 0
  }

  const pfnSeq = m.u32((pNextQuest + 0xf0) >>> 0) >>> 0
  if (pfnSeq === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x15d)
  }
  return dispatchQuestSeqFilter113c(m, pNextQuest, pfnSeq) | 0
}

/**
 * Sequence filter callback (`pfSeqFilter`) for Act 4 Quest 3 (Terror's End):
 * promotes `bNotIntro` state `0 -> 1` when active (`+0x09 == 1`) and returns `1`.
 *
 * @dll D2Game.dll
 * @va 0x6FCDA4F0
 * @ordinalOrName D2Game_6FCDA4F0
 */
export function ACT4Q3_SeqCallback_6FCDA4F0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FCDA4F0)
  if (m.u8((pQuestData + 0x0c) >>> 0) === 0 && m.u8((pQuestData + 0x09) >>> 0) === 1) {
    m.setU8((pQuestData + 0x0c) >>> 0, 1)
    if (m.u32(0x6fd31c20) !== 0) {
      const pBuf = allocScratch(0x80)
      try {
        writeAsciiZToScratch113c(m, pBuf, 'changing state to 1\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((pQuestData + 0x04) >>> 0),
          4,
        )
      } finally {
        freeScratch(0x80)
      }
    }
  }
  return 1
}

/**
 * [31/39] Handles Izual's death in Act 4 Quest 1 (The Fallen Angel), updating quest state to `4`,
 * recording Izual's death coordinates, marking nearby and party players' quest bits, and scheduling
 * the 3-tick spirit spawn timer (`0x6FCDA960`).
 *
 * @dll D2Game.dll
 * @va 0x6FCDABF0
 * @ordinalOrName D2Game_6FCDABF0
 */
export function ACT4Q1_OnIzualKilled_6FCDABF0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCDABF0)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pCustom = m.u32((quest + 0x18) >>> 0) >>> 0
  if (m.u32(0x6fd31c20) !== 0) {
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(
      m,
      0x6fd1b2e0,
      m.u32((quest + 0x04) >>> 0),
      4,
    )
  }
  m.setU32((quest + 0xa8) >>> 0, 0)
  m.setU8((quest + 0x0c) >>> 0, 4)
  if (m.u32(0x6fd31c20) !== 0) {
    const pBuf = allocScratch(0x80)
    try {
      writeAsciiZToScratch113c(m, pBuf, 'changing state to 4\n')
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        pBuf,
        m.u32((quest + 0x04) >>> 0),
        4,
      )
    } finally {
      freeScratch(0x80)
    }
  }
  m.setU32((quest + 0xc0) >>> 0, 0)
  m.setU32((pCustom + 0x14) >>> 0, m.u32((arg + 0x08) >>> 0) >>> 0)
  if (m.u8((quest + 0x09) >>> 0) !== 0) {
    const pKiller = m.u32((arg + 0x0c) >>> 0) >>> 0
    if (pKiller !== 0) {
      const pGame = m.u32(arg >>> 0) >>> 0
      const pPlayerData = UNITS_GetPlayerData113c(m, pKiller) >>> 0
      const nDiff = m.u8((pGame + 0x6d) >>> 0)
      const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
      if (
        (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0) | 0) === 0 &&
        (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 1) | 0) === 0
      ) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 0x0d)
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x19, 0x01)
        QUESTRECORD_ClearQuestStateBits2To11_113c(
          m,
          pQuestFlags,
          i32(m, (quest + 0xe0) >>> 0),
        )
      }
    }
    m.setU8((pCustom + 0x10) >>> 0, 1)
    PATH_GetTargetTypeAndPosition113c(
      m,
      m.u32((arg + 0x08) >>> 0) >>> 0,
      (pCustom + 0x04) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(arg >>> 0) >>> 0,
      (mArg, gArg, uArg, cbArg) => {
        ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c(mArg, gArg, uArg, cbArg)
        return 0
      },
      0,
      m.u32((arg + 0x08) >>> 0) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(arg >>> 0) >>> 0,
      (mArg, gArg, uArg, cbArg) => {
        ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c(mArg, gArg, uArg, cbArg)
        return 0
      },
      0,
      m.u32((arg + 0x08) >>> 0) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(arg >>> 0) >>> 0,
      (mArg, gArg, uArg, cbArg) => {
        ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c(mArg, gArg, uArg, cbArg)
        return 0
      },
      0,
      m.u32((arg + 0x08) >>> 0) >>> 0,
    )
  }
  if (m.u8((pCustom + 0x0d) >>> 0) === 0) {
    m.setU8((pCustom + 0x0d) >>> 0, 1)
    void ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c
    QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 3, quest, 0x6fcda960)
  }
}

/**
 * [32/39] Handles scroll message completion callbacks for Act 4 Quest 3 (Terror's End)
 * with Tyrael (`0x16F`) and Deckard Cain (`0xF6`).
 *
 * @dll D2Game.dll
 * @va 0x6FCDB250
 * @ordinalOrName D2Game_6FCDB250
 */
export function ACT4Q3_OnScrollMessage_6FCDB250_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCDB250)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const wNpcId = sx16(m.u16((arg + 0x14) >>> 0))
  const wMsgId = sx16(m.u16((arg + 0x18) >>> 0))
  const pCustom = m.u32((quest + 0x18) >>> 0) >>> 0

  if (wNpcId === 0x16f) {
    if (wMsgId === 0x2a9) {
      m.setU8(pCustom >>> 0, 1)
      m.setU8((quest + 0x0c) >>> 0, 2)
      if (m.u32(0x6fd31c20) !== 0) {
        const pBuf = allocScratch(0x80)
        try {
          writeAsciiZToScratch113c(m, pBuf, 'changing state to 2\n')
          NET_BroadcastSystemChatMessage_6FCEBE70_113c(
            m,
            pBuf,
            m.u32((quest + 0x04) >>> 0),
            4,
          )
        } finally {
          freeScratch(0x80)
        }
      }
      SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
        m,
        m.u32((quest + 0x04) >>> 0) >>> 0,
        (mArg, gArg, uArg, cbArg) => {
          ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c(mArg, gArg, uArg, cbArg)
          return 0
        },
        0,
        0,
      )
      QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
        m,
        m.u32((arg + 0x08) >>> 0) >>> 0,
        m.u32((arg + 0x0c) >>> 0) >>> 0,
        m.u32(arg >>> 0) >>> 0,
      )
      return
    }
    if (wMsgId === 0x2ac) {
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
      const nDiff = m.u8((pGame + 0x6d) >>> 0)
      QUESTRECORD_ClearQuestState113c(
        m,
        m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0,
        0x1a,
        0x07,
      )
      return
    }
    if (wMsgId === 0x4e20) {
      const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
      if (m.u32((pGame + 0x70) >>> 0) !== 0) {
        const pQuestFlags =
          PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(
            m,
            m.u32((arg + 0x0c) >>> 0) >>> 0,
            pGame,
          ) >>> 0
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1a, 0x09)
        if (m.u8((pCustom + 0x45) >>> 0) === 0) {
          ACT4Q3_SpawnLastPortalObject_6FCDAFF0_113c(m, arg, pCustom)
        }
      }
      return
    }
  } else if (wNpcId === 0xf6) {
    if (wMsgId === 0x2ad) {
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
      const nDiff = m.u8((pGame + 0x6d) >>> 0)
      QUESTRECORD_ClearQuestState113c(
        m,
        m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0,
        0x1a,
        0x06,
      )
    } else if (wMsgId === 0x4e21) {
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
      const nDiff = m.u8((pGame + 0x6d) >>> 0)
      QUESTRECORD_SetQuestState113c(
        m,
        m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0,
        0x1a,
        0x08,
      )
    }
  }
}

/**
 * [33/39] Records the interacted NPC GUID (`0x6FD31C08`) and heals the player and pets
 * when interacting with Akara (`0x94`), Mala (`0x201`), Fara (`0xB0`), Atma (`0xB2`),
 * Jamella (`0x195`), or Ormus (`0xFF`).
 *
 * @dll D2Game.dll
 * @va 0x6FCDD810
 * @ordinalOrName D2Game_6FCDD810
 */
export function NPC_OnHealerNpcInteract_6FCDD810_113c(
  m: D2KernMemory113c,
  pNpcUnit: number,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCDD810)
  const npc = pNpcUnit >>> 0
  const dwNpcGuid = npc !== 0 ? m.u32((npc + 0x0c) >>> 0) >>> 0 : 0xffffffff
  m.setU32(0x6fd31c08, dwNpcGuid)
  if (npc === 0) {
    return
  }
  const nClassId = i32(m, (npc + 0x04) >>> 0)
  if (
    nClassId === 0x94 ||
    nClassId === 0x201 ||
    nClassId === 0xb0 ||
    nClassId === 0xb2 ||
    nClassId === 0x195 ||
    nClassId === 0xff
  ) {
    NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c(m, pPlayer >>> 0, pGame >>> 0, npc)
  }
}

/**
 * [34/39] Sequence filter callback (`pfSeqFilter`) for Act 2 Quest 3 (Tainted Sun):
 * promotes `bNotIntro` state `0 -> 1` when active (`+0x09 == 1`) and chains to quest `0x0A`'s
 * sequence filter in `pGame->pQuestControl (+0x10F4)`.
 *
 * @dll D2Game.dll
 * @va 0x6FCE6390
 * @ordinalOrName D2Game_6FCE6390
 */
export function ACT2Q3_SeqCallback_6FCE6390_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FCE6390)
  const quest = pQuestData >>> 0
  if (m.u8((quest + 0x0c) >>> 0) === 0 && m.u8((quest + 0x09) >>> 0) === 1) {
    m.setU8((quest + 0x0c) >>> 0, 1)
    if (m.u32(0x6fd31c20) !== 0) {
      const pBuf = allocScratch(0x80)
      try {
        writeAsciiZToScratch113c(m, pBuf, 'changing state to 1\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((quest + 0x04) >>> 0),
          4,
        )
      } finally {
        freeScratch(0x80)
      }
    }
  }
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl !== 0) {
    let pNode = m.u32(pQuestCtrl >>> 0) >>> 0
    while (pNode !== 0) {
      if (m.u32(pNode >>> 0) === 0x0a) {
        if (m.u32((quest + 0xf0) >>> 0) === 0) {
          throw new D2CommonAssertError('0x6fd19ff9', 0x3ee)
        }
        return dispatchQuestSeqFilter113c(m, pNode, m.u32((pNode + 0xf0) >>> 0) >>> 0) | 0
      }
      pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
    }
  }
  return 1
}

/**
 * [35/39] Player iteration callback for Act 2 Quest 6 (The Seven Tombs):
 * if the player has quest `0x0E` bit `0x0D` set and belongs to a valid sub-party (`!= 0xFFFF`),
 * propagates completion (`0x6FCE5910`) to all party members in Act 2.
 *
 * @dll D2Game.dll
 * @va 0x6FCE65A0
 * @ordinalOrName D2Game_6FCE65A0
 */
export function ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _pArg: number,
): number {
  hitD2GameVa113c(0x6FCE65A0)
  const game = pGame >>> 0
  const player = pPlayerUnit >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0d) | 0) !== 0 && player !== 0) {
    const pUnitGame = m.u32((player + 0x80) >>> 0) >>> 0
    if (pUnitGame !== 0 && m.u32(player >>> 0) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, player, pUnitGame) & 0xffff
      if (wPartyId !== 0xffff) {
        PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
          m,
          pUnitGame,
          wPartyId,
          ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c,
          0,
        )
      }
    }
  }
  return 0
}

/**
 * [36/39] Handles the Summoner's death in Act 2 Quest 5 (The Arcane Sanctuary), updating quest
 * state to `2`, scheduling the 3-tick taunt/alert timer (`0x6FCE5BE0`), marking nearby and
 * sub-party players, setting `pQuestControl->bPickedSetId (+0x20) = 7`, and syncing quest logs.
 *
 * @dll D2Game.dll
 * @va 0x6FCE66B0
 * @ordinalOrName D2Game_6FCE66B0
 */
export function ACT2Q5_OnSummonerKilled_6FCE66B0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE66B0)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  if (m.u8((quest + 0x09) >>> 0) !== 0) {
    if (m.u32(0x6fd31c20) !== 0) {
      NET_BroadcastSystemChatMessage_6FCEBE70_113c(
        m,
        0x6fd1b27c,
        m.u32((quest + 0x04) >>> 0),
        4,
      )
    }
    m.setU8((quest + 0x0c) >>> 0, 2)
    if (m.u32(0x6fd31c20) !== 0) {
      const pBuf = allocScratch(0x80)
      try {
        writeAsciiZToScratch113c(m, pBuf, 'changing state to 2\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((quest + 0x04) >>> 0),
          4,
        )
      } finally {
        freeScratch(0x80)
      }
    }
    const pCustom = m.u32((quest + 0x18) >>> 0) >>> 0
    if (m.u8((pCustom + 0x08) >>> 0) === 0) {
      m.setU8((pCustom + 0x08) >>> 0, 1)
      void ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c
      QUESTS_AppendQuestTimer_6FC53AF0_113c(m, 3, quest, 0x6fce5be0)
    }
    m.setU8((pCustom + 0x09) >>> 0, 0)
    m.setU8(pCustom >>> 0, 1)
    m.setU32(
      (pCustom + 0x04) >>> 0,
      UNITS_GetRoom113c(m, m.u32((arg + 0x08) >>> 0) >>> 0) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(arg >>> 0) >>> 0,
      (mArg, gArg, uArg, cbArg) => {
        ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c(mArg, gArg, uArg, cbArg)
        return 0
      },
      0,
      m.u32((arg + 0x08) >>> 0) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(arg >>> 0) >>> 0,
      (mArg, gArg, uArg, cbArg) => {
        ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c(mArg, gArg, uArg, cbArg)
        return 0
      },
      0,
      m.u32((arg + 0x08) >>> 0) >>> 0,
    )
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      m.u32(arg >>> 0) >>> 0,
      (mArg, gArg, uArg, cbArg) => {
        ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c(mArg, gArg, uArg, cbArg)
        return 0
      },
      0,
      m.u32((arg + 0x08) >>> 0) >>> 0,
    )
  }
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  m.setU8((pQuestCtrl + 0x20) >>> 0, 7)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    pGame,
    (mArg, gArg, uArg, cbArg) => {
      QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(mArg, gArg, uArg, cbArg)
      return 0
    },
    0,
    0,
  )
}

/**
 * [37/39] Handles scroll message completion callbacks (`0x1A3..0x1AD`) for Act 2 Quest 5
 * (The Arcane Sanctuary), completing quest `0x0D` and sending NPC interaction packet `0x27`.
 *
 * @dll D2Game.dll
 * @va 0x6FCE67C0
 * @ordinalOrName D2Game_6FCE67C0
 */
export function ACT2Q5_OnScrollMessage_6FCE67C0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE67C0)
  const quest = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const wMsgId = sx16(m.u16((arg + 0x18) >>> 0))
  if (wMsgId >= 0x1a3 && wMsgId <= 0x1ad) {
    const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
    const pGame = m.u32(arg >>> 0) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
    const nDiff = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
    if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 1) | 0) !== 0) {
      if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0d) | 0) !== 0) {
        m.setU8((quest + 0x14) >>> 0, 0)
        m.setU8((quest + 0x0b) >>> 0, 0x0d)
        SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
          m,
          m.u32((quest + 0x04) >>> 0) >>> 0,
          (mArg, gArg, uArg, cbArg) => {
            ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c(mArg, gArg, uArg, cbArg)
            return 0
          },
          0,
          0,
        )
        QUESTS_SetGlobalQuestState_6FC53920_113c(
          m,
          m.u32((quest + 0x04) >>> 0) >>> 0,
          0x0d,
          0x0d,
        )
        m.setU8((quest + 0x0c) >>> 0, 3)
        if (m.u32(0x6fd31c20) !== 0) {
          const pBuf = allocScratch(0x80)
          try {
            writeAsciiZToScratch113c(m, pBuf, 'changing state to 3\n')
            NET_BroadcastSystemChatMessage_6FCEBE70_113c(
              m,
              pBuf,
              m.u32((quest + 0x04) >>> 0),
              4,
            )
          } finally {
            freeScratch(0x80)
          }
        }
      }
      const pPlayer2 = m.u32((arg + 0x0c) >>> 0) >>> 0
      const dwGuid = pPlayer2 !== 0 ? m.u32((pPlayer2 + 0x0c) >>> 0) >>> 0 : 0xffffffff
      QUESTS_GuidListAdd113c(m, (quest + 0x1c) >>> 0, dwGuid)
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 0)
      QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0d, 1)
    }
    QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(
      m,
      m.u32((arg + 0x08) >>> 0) >>> 0,
      m.u32((arg + 0x0c) >>> 0) >>> 0,
      m.u32(arg >>> 0) >>> 0,
    )
  }
}

/**
 * [38/39] Sequence filter callback (`pfSeqFilter`) for Act 2 Quest 5 (The Arcane Sanctuary):
 * promotes `bNotIntro` state `0 -> 1` when active (`+0x09 == 1`) and chains to `0x6FCE1FF0`.
 *
 * @dll D2Game.dll
 * @va 0x6FCE69D0
 * @ordinalOrName D2Game_6FCE69D0
 */
export function ACT2Q5_SeqCallback_6FCE69D0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FCE69D0)
  const quest = pQuestData >>> 0
  if (m.u8((quest + 0x0c) >>> 0) === 0 && m.u8((quest + 0x09) >>> 0) === 1) {
    m.setU8((quest + 0x0c) >>> 0, 1)
    if (m.u32(0x6fd31c20) !== 0) {
      const pBuf = allocScratch(0x80)
      try {
        writeAsciiZToScratch113c(m, pBuf, 'changing state to 1\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((quest + 0x04) >>> 0),
          4,
        )
      } finally {
        freeScratch(0x80)
      }
    }
    ACT2Q4_ChainSeqFilter_6FCE1FF0_113c(m, quest)
  }
  return 1
}

/**
 * [39/39] Starts the Tainted Sun eclipse event for Act 2 Quest 3 (`0x6FCE6A30`), broadcasting
 * quest alerts (`0x6FCE52B0`), initializing the Act 2 eclipse environment (`D2Common.#10895`),
 * and notifying players (`0x6FCE5190`), or deferring via `pCustom[+0x03] = 1` if Act 2 is unloaded.
 *
 * @dll D2Game.dll
 * @va 0x6FCE6A30
 * @ordinalOrName D2Game_6FCE6A30
 */
export function ACT2Q3_StartEclipseEvent_6FCE6A30_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): number {
  hitD2GameVa113c(0x6FCE6A30)
  const quest = pQuestData >>> 0
  m.setU8((quest + 0x14) >>> 0, 0)
  m.setU8((quest + 0x0b) >>> 0, 1)
  SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
    m,
    m.u32((quest + 0x04) >>> 0) >>> 0,
    (mArg, gArg, uArg, cbArg) => {
      ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c(mArg, gArg, uArg, cbArg)
      return 0
    },
    0,
    0,
  )
  if (m.u8((quest + 0x0c) >>> 0) === 0) {
    m.setU8((quest + 0x0c) >>> 0, 1)
    if (m.u32(0x6fd31c20) !== 0) {
      const pBuf = allocScratch(0x80)
      try {
        writeAsciiZToScratch113c(m, pBuf, 'changing state to 1\n')
        NET_BroadcastSystemChatMessage_6FCEBE70_113c(
          m,
          pBuf,
          m.u32((quest + 0x04) >>> 0),
          4,
        )
      } finally {
        freeScratch(0x80)
      }
    }
  }
  const pGame = m.u32((quest + 0x04) >>> 0) >>> 0
  const pAct2 = m.u32((pGame + 0xc0) >>> 0) >>> 0
  if (pAct2 !== 0) {
    ENV_InitEclipseEnvironment113c(m, pAct2)
    SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c(
      m,
      pGame,
      (mArg, gArg, uArg, cbArg) => {
        ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c(mArg, gArg, uArg, cbArg)
        return 0
      },
      0,
      0,
    )
    return 1
  }
  const pCustom = m.u32((quest + 0x18) >>> 0) >>> 0
  m.setU8((pCustom + 0x03) >>> 0, 1)
  return 0
}
