/**
 * Diablo II v1.13c `D2Game.dll` Wave 5 Batch 6 (`w5b6`):
 * 45 functions in `0x6FC68BA0..0x6FCEEF40` (`D2Game.dll` image base `0x6FC20000`).
 *
 * Clean-room 1:1 instruction-faithful `Memory113c` translations.
 */

import type { Memory113c } from '../mem/sparse-memory'
import { COLLISION_CheckMaskWithPattern2_113c, COLLISION_ResetMaskWithPattern113c } from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { DUNGEON_GetLevelIdFromRoom113c, DUNGEON_ToggleHasPortalFlag113c } from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, mulDiv113c } from '../common/int-math'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_IsItemOwnedByInventory113c,
} from '../common/inventory'
import {
  ITEMS_ApplyClassLifePotionScale113c,
  ITEMS_ApplyClassManaPotionScale113c,
  ITEMS_EvalItemCalc113c,
  ITEMS_GetActiveWeaponClassCodeIdx113c,
  ITEMS_GetBodyLocation113c,
} from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetCompositWeaponMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import { MISSILE_SetTargetX113c } from '../common/missile'
import {
  PATH_Compute113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetLastPointX113c,
  PATH_GetLastPointY113c,
  PATH_GetMaxDistance113c,
  PATH_GetMoveTestCollisionMask113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetType113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetCollisionMask113c,
  PATH_SetDistance113c,
  PATH_SetMoveTestCollisionMask113c,
  PATH_SetNewDistance113c,
  PATH_SetStepNum113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_SetType113c,
  PATH_SetVelocity113c,
  PATH_SnapToSubtileCenter113c,
} from '../common/path'
import {
  HIRELING_GetExpForLevel113c,
  UNITS_GetLeftSkill113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record'
import {
  SKILLS_CalcKickBootDamage113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateManaCost256ths113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetParam1113c,
  SKILLS_GetParam2113c,
  SKILLS_GetParam3113c,
  SKILLS_GetParam4113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillPhysMaxDamage113c,
  SKILLS_GetSkillPhysMinDamage113c,
  SKILLS_SetParam0C113c,
  STATES_UpdateOrClearState98Transform113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_GetExpireFrameEx113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetOwnerAndDynamicFlag113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_SetWeaponStatListActive113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_AllocStaticPath113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetMonsterSplitSpawnParams113c,
  UNITS_GetRoom113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNITS_SetSeqFrameFromLowByte113c,
  UNIT_Alloc113c,
  UNIT_GetAlignment113c,
} from '../common/unit'
import {
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
} from '../common/unit-finds'
import { WAYPOINT_GetWaypointNoFromLevelId113c, WAYPOINT_GetWaypointState113c } from '../common/waypoint'
import { SEED_InitLowSeed113c, SEED_InitSeed113c, seedRoll } from '../prng'
import {
  DATATBLS_AdjustMonsterPresetIndex113c,
  DATATBLS_GetItemsTxtRecordByCode113c,
  DATATBLS_GetMaxLevel113c,
} from '../tables/datatbls-113c'
import { DATATBLS_GetItemDataTables113c } from '../tables/item-tbls-113c'
import {
  DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c,
  DATATBLS_GetMonsterChainInfo113c,
  DATATBLS_GetSuperUniquesTxtRecord113c,
} from '../tables/monster-tbls-113c'
import {
  SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c,
  SKILLS_ApplyProgressiveChargesToDamage113c,
} from './a1c-post150-f786-f1040-113c'
import {
  AIGENERAL_LinkMinionToLeader113c,
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  SKILLS_CanMonsterCastAtTarget113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import {
  D2GAME_PLRMODES_SendStatToClientOrParty113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
} from './boot-init-gap-b-113c'
import { C2S_CheckCoordDeltaExceeded113c, C2S_ValidateTargetUnitDistance113c } from './c2s-packet-113c'
import {
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FillDamageValues113c,
} from './combat-a1c-113c'
import {
  AIGENERAL_PopAiCommand113c,
  ITEMS_CheckNotBrokenOrUnequipping113c,
  SKILLS_GetFlags113c,
} from './replay-kernel-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  AURAS_ApplyRadialStatBuffCallback113c,
  AURA_ForEachUnitInRadius113c,
} from './k2-gap-itemdef-113c'
import {
  MISSILE_CreateServerProjectile113c,
  MONSTER_QueuePacket0xAB_LifeNotify113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c'
import {
  AI_FilterLivingGloamUnit113c,
  PACKET_CheckUnitsInDifferentActs113c,
  PACKET_IsInteractingWithDifferentPlayer113c,
} from './k2-combat-core-w1-113c'
import {
  DATATBLS_GetTableWordAE0_6FC21830_113c,
  MONSTATS_FollowSubClassChain_6FC21D30_113c,
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
  PLAYER_GetWaypointDataForDifficulty_6FC21720_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { AIGENERAL_ForEachPackMember_6FC41490_113c } from './k2-laneI-0x6fc3-w1-113c'
import { PLAYER_GetPlayerDataField48_6FC57440_113c } from './k2-laneK-0x6fc5-w1-113c'
import { PARTY_TestPlayerRelationFlags113c } from './k2-sunit-spawn-w1-113c'
import { SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c } from './k2-w2b3-113c'
import {
  MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c,
  VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c,
  VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c,
} from './k2-w2b4-113c'
import {
  SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c,
  SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c,
} from './k2-w2b5-113c'
import { AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c } from './k2-w2b6-113c'
import {
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  AI_StartModeAtCoordsStep0_6FD11FA0_113c,
} from './k2-w2b8-113c'
import { SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c } from './k2-w3b4-113c'
import { OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c } from './k2-w3b7-113c'
import {
  AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c,
  AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c,
  AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c,
} from './k2-w3b8-113c'
import { PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c } from './k2-w4b3-113c'
import { NET_SendPacket26_ChatMessage_6FCAB470_113c } from './k2-w4b4-113c'
import {
  AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c,
  AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c,
  MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c,
  NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c,
  PETS_FindPetArgByGuid_6FCB6570_113c,
  STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c,
} from './k2-w4b5-113c'
import {
  AI_CastSkill286AtOffsetY13_6FCC4E40_113c,
  SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
} from './k2-w4b6-113c'
import {
  AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c,
  MONSTER_MorphMonsterClassId_6FCCFC50_113c,
} from './k2-w4b7-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_ValidateClassId113c,
  MONSTER_AddSkillToUnit113c,
  MONSTER_GetBaseIdFromUnit113c,
  MONSTER_GetDifficultyAndPlayerBonus113c,
  MONSTER_SpawnAtCoords113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { CLIENTS_GetPlayerUnit113c } from './replay-final11-113c'
import { EVENT_FreeNode113c, EVENT_SetEventFull113c, MONSTER_RefreshAiEvent113c } from './timer-wheel'
import { UNITS_GetOctileDistanceToCoordinates113c } from './town-npc-ai-113c'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

const D2COMMON_SGPT_DATA_TABLES_PTR_VA = 0x6fde9e1c

let k2W5B6StackPtr = 0x7e640000

function sx8(v: number): number {
  return (v << 24) >> 24
}

function rdI32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function divPow2Trunc(val: number, shift: number): number {
  const v = val | 0
  const mask = (1 << shift) - 1
  return ((v + ((v >> 31) & mask)) >> shift) | 0
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
      m.u32((iatVal + 0xa78) >>> 0) === 0
    ) {
      return deref
    }
    return iatVal
  }
  return m.u32(D2COMMON_SGPT_DATA_TABLES_PTR_VA) >>> 0
}

function allocScratch(m: D2KernMemory113c, size: number): number {
  const aligned = (size + 7) & ~7
  k2W5B6StackPtr = (k2W5B6StackPtr - aligned) >>> 0
  m.fill(k2W5B6StackPtr, aligned, 0)
  return k2W5B6StackPtr
}

function freeScratch(_m: D2KernMemory113c, size: number): void {
  const aligned = (size + 7) & ~7
  k2W5B6StackPtr = (k2W5B6StackPtr + aligned) >>> 0
}

function readOptionalGlobalU32(m: D2KernMemory113c, va: number, fallback = 0): number {
  try {
    return m.u32(va >>> 0) >>> 0
  } catch {
    return fallback >>> 0
  }
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

function rollSeedInlineMod113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  const max = nMax | 0
  if (max <= 0) return 0
  const newLo = stepSeed64At113c(m, addr)
  const uMax = max >>> 0
  if (((uMax - 1) & uMax) === 0) {
    return (newLo & (uMax - 1)) | 0
  }
  return (newLo % uMax) | 0
}

function rollSeedAt6FC21180(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  const max = nMax | 0
  if (addr === 0 || max <= 0) {
    hitD2GameVa113c(0x6FC21180)
    return 0
  }
  const seed = { lo: m.u32(addr) >>> 0, hi: m.u32((addr + 4) >>> 0) >>> 0 }
  const res = seedRoll(seed, max) | 0
  m.setU32(addr, seed.lo >>> 0)
  m.setU32((addr + 4) >>> 0, seed.hi >>> 0)
  return res
}

function getUnitSubtileXInline(m: D2KernMemory113c, pUnit: number): number {
  const ut = rdI32(m, pUnit >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (ut === 2 || (ut > 3 && ut <= 5)) {
    return rdI32(m, (pPath + 0x0c) >>> 0)
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function getUnitSubtileYInline(m: D2KernMemory113c, pUnit: number): number {
  const ut = rdI32(m, pUnit >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (ut === 2 || (ut > 3 && ut <= 5)) {
    return rdI32(m, (pPath + 0x10) >>> 0)
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

function aiApproachTarget6FD12540(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  nX: number,
  nY: number,
  nStepNum: number,
  dwFlags: number,
): number {
  let mode = nMode | 0
  if (mode === 0x0f && (STATES_CheckState113c(m, pUnit >>> 0, 0x3c) | 0) !== 0) {
    let pAiControl = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
    }
    if (pAiControl !== 0) {
      m.setU32((pAiControl + 0x18) >>> 0, 0)
      m.setU32((pAiControl + 0x1c) >>> 0, 0)
      m.setU8((pAiControl + 0x20) >>> 0, 0)
    }
    mode = 2
  }
  const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) : 0
  if (pPath !== 0) PATH_SetStepNum113c(m, pPath, nStepNum | 0)
  const res = MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, mode, pTarget >>> 0, nX | 0, nY | 0) | 0
  if (res !== 0) return res
  const flagsByte = dwFlags & 0xff
  if ((flagsByte & 4) !== 0 && pUnit !== 0) {
    let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pEvent !== 0) {
      const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
      if (m.u8(pEvent) === 2) EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
      pEvent = pNext
    }
  }
  if ((flagsByte & 1) !== 0 && pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
    if (pAiGen !== 0) m.setU8((pAiGen + 8) >>> 0, (m.u8((pAiGen + 8) >>> 0) | 0x40) & 0xff)
  }
  if ((flagsByte & 2) !== 0 && pUnit !== 0) {
    const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
    if (roll < 0x46) {
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4)
      return 1
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
    return 1
  }
  return res
}

/**
 * Levels up a player's hireling (`pPetUnit`, or resolves pet slot `7` if null), queues level-up
 * sound packet `0x27` (`0x0D7C`), recalculates hireling stats from `Hireling.txt`, and grants skills.
 *
 * @va D2Game:0x6FC68BA0
 */
export function HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPetUnit: number,
  nNewLevel: number,
): void {
  hitD2GameVa113c(0x6FC68BA0)
  if (pGame === 0) throw new D2CommonAssertError('Hireling.cpp', 0xe0)
  if (pPlayer === 0) throw new D2CommonAssertError('Hireling.cpp', 0xe1)
  if ((m.u32(pPlayer >>> 0) | 0) !== 0) throw new D2CommonAssertError('Hireling.cpp', 0xe2)

  let pMerc = pPetUnit >>> 0
  if (pMerc === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    if (pPlayerData === 0) return
    const pDataTables = getSgptDataTablesPtr(m)
    if ((rdI32(m, (pDataTables + 0xbf0) >>> 0) | 0) <= 7) return
    const pPetWrap = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
    if (pPetWrap === 0) return
    const pPetArr = m.u32(pPetWrap >>> 0) >>> 0
    const pSlot7 = (pPetArr + 0x54) >>> 0
    if (pSlot7 === 0) return
    let pPetNode = m.u32(pSlot7) >>> 0
    if (pPetNode === 0) return
    while ((m.u8(pPetNode) & 1) !== 0) {
      pPetNode = m.u32((pPetNode + 0x14) >>> 0) >>> 0
      if (pPetNode === 0) return
    }
    const mercGuid = m.u32((pPetNode + 0x04) >>> 0) >>> 0
    let pCur = m.u32((pGame + 0x1320 + ((mercGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pCur !== 0) {
      if ((m.u32((pCur + 0x0c) >>> 0) >>> 0) === mercGuid) break
      pCur = m.u32((pCur + 0xe4) >>> 0) >>> 0
    }
    pMerc = pCur
    if (pMerc === 0) return
  }

  STATLIST_GetUnitStat113c(m, pPlayer >>> 0, 0x0c, 0)
  const curMercLvl = STATLIST_GetUnitStat113c(m, pMerc, 0x0c, 0) | 0
  let targetLvl = nNewLevel | 0
  if (targetLvl === 0) targetLvl = (curMercLvl + 1) | 0

  let pClient = 0
  if ((m.u32(pPlayer >>> 0) | 0) === 0) {
    const pd = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
    pClient = pd !== 0 ? m.u32((pd + 0x9c) >>> 0) >>> 0 : 0
  }
  const sp = allocScratch(m, 0x30)
  try {
    for (let i = 0; i < 10; i++) m.setU32((sp + i * 4) >>> 0, 0)
    m.setU8(sp, 0x27)
    m.setU8((sp + 1) >>> 0, 1)
    m.setU32((sp + 2) >>> 0, m.u32((pMerc + 0x0c) >>> 0) >>> 0)
    m.setU8((sp + 6) >>> 0, 1)
    m.setU8((sp + 8) >>> 0, 3)
    m.setU16((sp + 10) >>> 0, 0x0d7c)
    NET_QueuePacketToClientBuffer113c(m, pClient, 0, sp, 0x28)
  } finally {
    freeScratch(m, 0x30)
  }

  STATLIST_SetUnitStat113c(m, pMerc, 0x0c, targetLvl, 0)
  const pPetArg = PETS_FindPetArgByGuid_6FCB6570_113c(
    m,
    pPlayer >>> 0,
    m.u32((pMerc + 0x0c) >>> 0) >>> 0,
  ) >>> 0
  if (pPetArg === 0) return
  const nHirelingSubType = rdI32(m, (pPetArg + 0x08) >>> 0)
  const bExpansion = rdI32(m, (pGame + 0x70) >>> 0)
  const pHirelingTxt = DATATBLS_GetHirelingTxtRecordFromIdAndLevel113c(
    m,
    bExpansion,
    nHirelingSubType,
    targetLvl,
  ) >>> 0
  if (pHirelingTxt === 0) return

  const lvlDiff = (targetLvl - rdI32(m, (pHirelingTxt + 0x1c) >>> 0)) | 0
  const maxLvlMinus1 = ((DATATBLS_GetMaxLevel113c(m, 0) | 0) - 1) | 0
  const expPerLvl = rdI32(m, (pHirelingTxt + 0x20) >>> 0)
  const nextExp = targetLvl < maxLvlMinus1 ? HIRELING_GetExpForLevel113c((targetLvl + 1) | 0, expPerLvl) | 0 : 0
  STATLIST_SetUnitStat113c(m, pMerc, 0x1e, nextExp, 0)
  const curLvlExp = HIRELING_GetExpForLevel113c(targetLvl, expPerLvl) | 0
  if ((STATLIST_GetUnitStat113c(m, pMerc, 0x0d, 0) | 0) < curLvlExp) {
    STATLIST_SetUnitStat113c(m, pMerc, 0x0d, curLvlExp, 0)
  }

  const str = Math.max(10, (divPow2Trunc(imul32(rdI32(m, (pHirelingTxt + 0x38) >>> 0), lvlDiff), 3) + rdI32(m, (pHirelingTxt + 0x34) >>> 0)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0, str, 0)
  const dex = Math.max(10, (divPow2Trunc(imul32(rdI32(m, (pHirelingTxt + 0x40) >>> 0), lvlDiff), 3) + rdI32(m, (pHirelingTxt + 0x3c) >>> 0)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 2, dex, 0)
  const hp = Math.max(0x2800, (imul32(rdI32(m, (pHirelingTxt + 0x28) >>> 0) << 8, lvlDiff) + (rdI32(m, (pHirelingTxt + 0x24) >>> 0) << 8)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 7, hp, 0)
  STATLIST_SetUnitStat113c(m, pMerc, 6, hp, 0)
  const ac = Math.max(0, (imul32(rdI32(m, (pHirelingTxt + 0x30) >>> 0), lvlDiff) + rdI32(m, (pHirelingTxt + 0x2c) >>> 0)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x1f, ac, 0)
  const minDmg = Math.max(0, (divPow2Trunc(imul32(rdI32(m, (pHirelingTxt + 0x58) >>> 0), lvlDiff), 3) + rdI32(m, (pHirelingTxt + 0x50) >>> 0)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x17, minDmg, 0)
  const maxDmg = Math.max(1, (divPow2Trunc(imul32(rdI32(m, (pHirelingTxt + 0x58) >>> 0), lvlDiff), 3) + rdI32(m, (pHirelingTxt + 0x54) >>> 0)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x18, maxDmg, 0)
  const ar = Math.max(0, (imul32(rdI32(m, (pHirelingTxt + 0x48) >>> 0), lvlDiff) + rdI32(m, (pHirelingTxt + 0x44) >>> 0)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x13, ar, 0)
  const res = Math.max(0, (divPow2Trunc(imul32(rdI32(m, (pHirelingTxt + 0x60) >>> 0), lvlDiff), 2) + rdI32(m, (pHirelingTxt + 0x5c) >>> 0)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x27, res, 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x29, res, 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x2b, res, 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x2d, res, 0)

  const baseMaxHp = STATLIST_GetUnitBaseStat113c(m, pMerc, 7, 0) | 0
  const hiProd = Number((BigInt(baseMaxHp) * 0x10624dd3n) >> 32n) | 0
  const sar7 = hiProd >> 7
  const hpRegen = Math.max(0, (sar7 + (sar7 >>> 31)) | 0)
  STATLIST_SetUnitStat113c(m, pMerc, 0x4a, hpRegen, 0)

  for (let slot = 0; slot < 6; slot++) {
    const skillId = rdI32(m, (pHirelingTxt + 0x78 + slot * 4) >>> 0)
    if (skillId <= 0) break
    const pDataTables = getSgptDataTablesPtr(m)
    if (skillId >= rdI32(m, (pDataTables + 0xba0) >>> 0)) break
    if (sx8(m.u8((pHirelingTxt + 0xc0 + slot) >>> 0)) >= 0x10) break
    const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId) >>> 0
    if (pSkillsTxt !== 0 && targetLvl >= sx16(m.u16((pSkillsTxt + 0x174) >>> 0))) {
      const lvlPerLvl = sx8(m.u8((pHirelingTxt + 0xcc + slot) >>> 0))
      const baseSlvl = sx8(m.u8((pHirelingTxt + 0xc6 + slot) >>> 0))
      let slvl = (((imul32(lvlPerLvl, lvlDiff) | 0) >> 5) + baseSlvl) | 0
      if (slvl > 0) {
        if (slvl >= 0x20) slvl = 0x20
        MONSTER_AddSkillToUnit113c(m, slvl, skillId, pMerc, 0)
      }
    }
  }
}

/**
 * Spawns a perpendicular wall of server projectiles (`0x10820` outer wings, `0x820` center)
 * centered at `pUnit`'s target or first path coordinates (`srvdofunc` `24`).
 *
 * @va D2Game:0x6FC6D420
 */
export function SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6D420)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = getSgptDataTablesPtr(m)
  if (skillId >= rdI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsTxtBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsTxtBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const sp = allocScratch(m, 0x80)
  try {
    const pDx = sp
    const pDy = (sp + 0x04) >>> 0
    const pOutY = (sp + 0x08) >>> 0
    const pOutX = (sp + 0x0c) >>> 0
    const pParams = (sp + 0x20) >>> 0
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)
    if (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit >>> 0, pGame >>> 0, pOutX, pOutY) === 0) {
      return 1
    }
    const slvl = nSkillLevel | 0
    const totalCount = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x138) >>> 0),
      skillId,
      slvl,
    ) | 0
    const targetX = rdI32(m, pOutX)
    const targetY = rdI32(m, pOutY)
    const unitX = getUnitSubtileXInline(m, pUnit >>> 0)
    const unitY = getUnitSubtileYInline(m, pUnit >>> 0)
    m.setU32(pDx, ((targetX - unitX) | 0) >>> 0)
    m.setU32(pDy, ((targetY - unitY) | 0) >>> 0)
    VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c(m, pDx, pDy)
    VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c(m, pDx, pDy)

    const dx = rdI32(m, pDx)
    const dy = rdI32(m, pDy)
    let curX = (targetX - divPow2Trunc(imul32(dx, totalCount), 1)) | 0
    let curY = (targetY - divPow2Trunc(imul32(dy, totalCount), 1)) | 0

    let missileId = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
    if ((ITEMS_GetActiveWeaponClassCodeIdx113c(m, pUnit >>> 0) | 0) !== 1) {
      const altMiss = sx16(m.u16((pSkillsTxt + 0x4a) >>> 0))
      if (altMiss >= 0) missileId = altMiss
    }
    if (missileId < 0 || missileId >= rdI32(m, (getSgptDataTablesPtr(m) + 0xb6c) >>> 0)) {
      return 0
    }
    let centerCount = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x140) >>> 0),
      skillId,
      slvl,
    ) | 0
    if (centerCount === 0) centerCount = totalCount

    for (let i = 0; i < 0x17; i++) m.setU32((pParams + i * 4) >>> 0, 0)
    m.setU32((pParams + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x08) >>> 0, pUnit >>> 0)
    m.setU32((pParams + 0x10) >>> 0, missileId >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, slvl >>> 0)
    const rangeOverride = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit >>> 0,
      m.u32((pSkillsTxt + 0x13c) >>> 0),
      skillId,
      slvl,
    ) | 0
    m.setU32((pParams + 0x44) >>> 0, rangeOverride >>> 0)

    const leftWing = divPow2Trunc((totalCount - centerCount) | 0, 1)
    m.setU32(pParams, 0x10820)
    for (let i = 0; i < leftWing; i++) {
      m.setU32((pParams + 0x1c) >>> 0, curX >>> 0)
      m.setU32((pParams + 0x20) >>> 0, curY >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams)
      curX = (curX + dx) | 0
      curY = (curY + dy) | 0
    }
    m.setU32(pParams, 0x820)
    for (let i = 0; i < centerCount; i++) {
      m.setU32((pParams + 0x1c) >>> 0, curX >>> 0)
      m.setU32((pParams + 0x20) >>> 0, curY >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams)
      curX = (curX + dx) | 0
      curY = (curY + dy) | 0
    }
    const rightWing = (totalCount - leftWing - centerCount) | 0
    m.setU32(pParams, 0x10820)
    for (let i = 0; i < rightWing; i++) {
      m.setU32((pParams + 0x1c) >>> 0, curX >>> 0)
      m.setU32((pParams + 0x20) >>> 0, curY >>> 0)
      MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams)
      curX = (curX + dx) | 0
      curY = (curY + dy) | 0
    }
    return 1
  } finally {
    freeScratch(m, 0x80)
  }
}

const GLOAM_5_TABLE_DWORDS = [
  -5, -5, 3, -5, 6, 3, 3, 6, -5, 3, 0,
  6, 3, 3, 6, -5, 3, -5, -5, 3, -5,
] as const

const GLOAM_4_CAST_DWORDS = [
  1, -5, 6, 0, 4, 10, -10, -3,
  1, 8, -9, -2, -5, 4, 1, 8,
  -12, 0, 7, 5, -3, -11, 11, -2,
  7, 9, -15, -3, -6, -13, 9, 7,
  -5, -7, -5, -7, 9, 0, -12, -2,
  -8, -11, -2, -6, -2, -6, -13, -6,
  -8, 1, 1, -6, 6, 9, 0, 0,
] as const

const GLOAM_4_WALK_DWORDS = [
  -10, -3, 1, -5, 6, 0, 4, 10,
  -9, -2, -6, -11, -2, -5, 6, 1,
  0, 13, -12, 0, 7, 5, -3, -11,
  -15, -3, -6, -3, -4, -5, -6, -13,
  -12, -2, -6, 2, -5, 5, 1, 11,
  -13, -6, -8, -11, -7, 0, 1, 8,
  -5, -8, -8, 1, 1, -6, 6, 9,
] as const

/**
 * Willowisp / Burning Soul (`Gloam`) AI think callback: coordinates 4-gloam and 5-gloam
 * geometric lightning rituals (granting `+50*(diff+1)%` Magic Find on completion) and standard
 * lightning/melee/chase/wander states.
 *
 * @va D2Game:0x6FCA0F20
 */
export function MONAI_GloamPackLightningDanceThink_6FCA0F20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA0F20)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0

  const S = allocScratch(m, 0x248)
  try {
    m.setU32((S + 0x10) >>> 0, pUnit >>> 0)
    m.setU32((S + 0x14) >>> 0, pMonStatsTxt >>> 0)
    m.setU32((S + 0x18) >>> 0, bInMeleeRange >>> 0)
    for (let i = 0; i < GLOAM_5_TABLE_DWORDS.length; i++) {
      m.setU32((S + 0x1c + i * 4) >>> 0, GLOAM_5_TABLE_DWORDS[i]! >>> 0)
    }
    for (let i = 0; i < GLOAM_4_CAST_DWORDS.length; i++) {
      m.setU32((S + 0x80 + i * 4) >>> 0, GLOAM_4_CAST_DWORDS[i]! >>> 0)
    }
    for (let i = 0; i < GLOAM_4_WALK_DWORDS.length; i++) {
      m.setU32((S + 0x160 + i * 4) >>> 0, GLOAM_4_WALK_DWORDS[i]! >>> 0)
    }

    if (pTarget !== 0) {
      const gameFrame = rdI32(m, (pGame + 0xa8) >>> 0)
      if (
        gameFrame > rdI32(m, (pAiControl + 0x1c) >>> 0) &&
        (UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pTarget) | 0) < 0x400 &&
        rdI32(m, (pAiControl + 0x14) >>> 0) < 4
      ) {
        const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 1000) | 0
        if (roll <= ((m.u8((pGame + 0x6d) >>> 0) + 2) | 0)) {
          m.setU32((pAiControl + 0x14) >>> 0, 4)
        }
      }
    }

    const aiState = rdI32(m, (pAiControl + 0x14) >>> 0)
    if (aiState === 4) {
      const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
      const unitX = getUnitSubtileXInline(m, pUnit >>> 0)
      const unitY = getUnitSubtileYInline(m, pUnit >>> 0)
      const pUnitFindData = (S + 0x1c) >>> 0
      const pFilterCtx = (S + 0x48) >>> 0
      for (let i = 0; i < 0x0e; i++) m.setU32((pFilterCtx + i * 4) >>> 0, 0)
      m.setU32(pFilterCtx, 0x583)
      m.setU32((pFilterCtx + 0x0c) >>> 0, unitX >>> 0)
      m.setU32((pFilterCtx + 0x10) >>> 0, unitY >>> 0)
      m.setU32((pFilterCtx + 0x14) >>> 0, 0x20)
      UNITFINDS_InitUnitFindData113c(
        m,
        m.u32((pGame + 0x1c) >>> 0),
        pUnitFindData,
        pRoom,
        unitX,
        unitY,
        0x20,
        0x6fc9bd00,
        pFilterCtx,
      )
      UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(
        m,
        pUnitFindData,
        (mem, pCand, pCtx) => AI_FilterLivingGloamUnit113c(mem, pCand, pCtx),
      )
      const foundCount = rdI32(m, (pUnitFindData + 0x18) >>> 0)
      const pFoundArr = m.u32((pUnitFindData + 0x04) >>> 0) >>> 0
      if (foundCount === 4 || foundCount === 5) {
        const nextPackState = foundCount === 4 ? 6 : 5
        for (let i = 0; i < foundCount; i++) {
          const pGloam = m.u32((pFoundArr + i * 4) >>> 0) >>> 0
          if (pGloam !== 0 && (m.u32(pGloam) | 0) === 1) {
            const pmd = m.u32((pGloam + 0x14) >>> 0) >>> 0
            const pag = pmd !== 0 ? m.u32((pmd + 0x28) >>> 0) >>> 0 : 0
            if (pag !== 0) {
              m.setU32((pag + 0x14) >>> 0, nextPackState)
              m.setU32((pag + 0x18) >>> 0, 0)
              m.setU32((pag + 0x1c) >>> 0, (i + 1) >>> 0)
            }
          }
          const rem = (rdI32(m, (pGame + 0xa8) >>> 0) % 0x151) | 0
          AI_Stall113c(m, pGame >>> 0, pGloam, (0x151 - rem) | 0)
        }
        const selfRem = (rdI32(m, (pGame + 0xa8) >>> 0) % 0x151) | 0
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, (0x151 - selfRem) | 0)
        UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)
        return
      }
      m.setU32((pAiControl + 0x14) >>> 0, 2)
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 8)
      UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)
      return
    }

    if (aiState >= 6) {
      const slot = rdI32(m, (pAiControl + 0x1c) >>> 0)
      if (slot > 4) {
        m.setU32((pAiControl + 0x14) >>> 0, 2)
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 8)
        return
      }
      const idx = (slot + imul32(aiState, 4)) | 0
      const destX = (UNIT_GetPosX113c(m, pTarget) + rdI32(m, (S + idx * 8 + 0x98) >>> 0)) | 0
      const destY = (UNIT_GetPosY113c(m, pTarget) + rdI32(m, (S + idx * 8 + 0x9c) >>> 0)) | 0
      if ((UNITS_GetOctileDistanceToCoordinates113c(m, pUnit >>> 0, destX, destY) >>> 0) > 3) {
        if ((rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) < 0x22) {
          AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4)
          return
        }
        AI_StartModeAtCoordsStep0_6FD11FA0_113c(m, pUnit >>> 0, 2, pGame >>> 0, destX, destY)
        return
      }
      const rem67 = (rdI32(m, (pGame + 0xa8) >>> 0) % 0x43) | 0
      if (rem67 !== 0) {
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, (0x43 - rem67) | 0)
        return
      }
      const shotCount = rdI32(m, (pAiControl + 0x18) >>> 0)
      if (shotCount < 3) {
        const castDx = rdI32(m, (S + idx * 8 - 0x48) >>> 0)
        const castDy = rdI32(m, (S + idx * 8 - 0x44) >>> 0)
        if (castDx === 0 && castDy === 0) {
          m.setU32((pAiControl + 0x18) >>> 0, (shotCount + 1) >>> 0)
          const r67 = (rdI32(m, (pGame + 0xa8) >>> 0) % 0x43) | 0
          AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, (0x43 - r67) | 0)
          return
        }
        const castX = (UNIT_GetPosX113c(m, pTarget) + castDx) | 0
        const castY = (UNIT_GetPosY113c(m, pTarget) + castDy) | 0
        AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, pUnit >>> 0, 7, pGame >>> 0, castX, castY)
        m.setU32((pAiControl + 0x18) >>> 0, (rdI32(m, (pAiControl + 0x18) >>> 0) + 1) >>> 0)
        return
      }
      const nextState = (rdI32(m, (pAiControl + 0x14) >>> 0) + 1) | 0
      m.setU32((pAiControl + 0x14) >>> 0, nextState >>> 0)
      m.setU32((pAiControl + 0x18) >>> 0, 0)
      if (((nextState - 6) | 0) > 6) {
        m.setU32((pAiControl + 0x14) >>> 0, 2)
        m.setU32((pAiControl + 0x1c) >>> 0, (rdI32(m, (pGame + 0xa8) >>> 0) + 0x708) >>> 0)
      }
      const rem337 = (rdI32(m, (pGame + 0xa8) >>> 0) % 0x151) | 0
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, (0x151 - rem337) | 0)
      if (
        pTarget !== 0 &&
        (m.u32(pTarget) | 0) === 0 &&
        (SUNIT_IsDeadOrDying113c(m, pTarget) | 0) === 0
      ) {
        const expireFrame = (rdI32(m, (pGame + 0xa8) >>> 0) + 0x1a5e00) >>> 0
        const pStatList = STATLIST_AllocList113c(
          m,
          2,
          0,
          m.u32((pTarget + 0x0c) >>> 0),
          0,
          expireFrame,
        ) >>> 0
        if (pStatList !== 0) {
          const mfBonus = imul32((m.u8((pGame + 0x6d) >>> 0) + 1) | 0, 0x32)
          STATLIST_SetStat113c(m, pStatList, 0x50, mfBonus, 0)
          STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
          EVENT_SetEventFull113c(m, pGame >>> 0, pTarget, 0x0c, expireFrame, 0, 0, 0)
          STATLIST_MergeStatLists113c(m, pTarget, pStatList, 1)
        }
      }
      return
    }

    if (aiState === 5) {
      const slot = rdI32(m, (pAiControl + 0x1c) >>> 0)
      if (slot > 5) {
        m.setU32((pAiControl + 0x14) >>> 0, 2)
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 8)
        return
      }
      const destX = (UNIT_GetPosX113c(m, pTarget) + rdI32(m, (S + slot * 8 + 0x14) >>> 0)) | 0
      const destY = (UNIT_GetPosY113c(m, pTarget) + rdI32(m, (S + slot * 8 + 0x18) >>> 0)) | 0
      if ((UNITS_GetOctileDistanceToCoordinates113c(m, pUnit >>> 0, destX, destY) >>> 0) > 3) {
        if ((rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) < 0x22) {
          AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4)
          return
        }
        AI_StartModeAtCoordsStep0_6FD11FA0_113c(m, pUnit >>> 0, 2, pGame >>> 0, destX, destY)
        return
      }
      const rem67 = (rdI32(m, (pGame + 0xa8) >>> 0) % 0x43) | 0
      if (rem67 !== 0) {
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, (0x43 - rem67) | 0)
        return
      }
      const shotCount = rdI32(m, (pAiControl + 0x18) >>> 0)
      if (shotCount < 3) {
        const castDx = rdI32(m, (S + slot * 8 + 0x40) >>> 0)
        const castDy = rdI32(m, (S + slot * 8 + 0x44) >>> 0)
        if (castDx === 0 && castDy === 0) {
          m.setU32((pAiControl + 0x18) >>> 0, (shotCount + 1) >>> 0)
          const r337 = (rdI32(m, (pGame + 0xa8) >>> 0) % 0x151) | 0
          AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, (0x151 - r337) | 0)
          return
        }
        const castX = (UNIT_GetPosX113c(m, pTarget) + castDx) | 0
        const castY = (UNIT_GetPosY113c(m, pTarget) + castDy) | 0
        AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, pUnit >>> 0, 7, pGame >>> 0, castX, castY)
        m.setU32((pAiControl + 0x18) >>> 0, (rdI32(m, (pAiControl + 0x18) >>> 0) + 1) >>> 0)
        return
      }
      m.setU32((pAiControl + 0x14) >>> 0, 2)
      m.setU32((pAiControl + 0x1c) >>> 0, (rdI32(m, (pGame + 0xa8) >>> 0) + 0x708) >>> 0)
      const rem337 = (rdI32(m, (pGame + 0xa8) >>> 0) % 0x151) | 0
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, (0x151 - rem337) | 0)
      return
    }

    const diff = m.u8((pGame + 0x6d) >>> 0)
    if (aiState === 1) {
      if (rdI32(m, (pAiControl + 0x18) >>> 0) <= 0) {
        if (bInMeleeRange !== 0) {
          AI_StartAttackMode113c(m, 8, pUnit >>> 0, pGame >>> 0, 0)
          m.setU32((pAiControl + 0x14) >>> 0, 3)
          return
        }
        const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
        const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
        if (roll < aip1) {
          AI_StartAttackMode113c(m, 8, pUnit >>> 0, pGame >>> 0, 0)
          m.setU32((pAiControl + 0x14) >>> 0, 2)
          return
        }
      }
      m.setU32((pAiControl + 0x18) >>> 0, (rdI32(m, (pAiControl + 0x18) >>> 0) - 1) >>> 0)
      const chaseRoll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
      const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
      m.setU32((pAiControl + 0x14) >>> 0, 1)
      if (chaseRoll < aip3) {
        aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
        return
      }
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 6)
      return
    }

    if (bInMeleeRange === 0) {
      if (
        aiState === 2 ||
        (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
          sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
      ) {
        AI_StartAttackMode113c(m, 7, pUnit >>> 0, pGame >>> 0, pTarget)
        m.setU32((pAiControl + 0x14) >>> 0, 0)
        return
      }
    } else {
      if (
        aiState === 3 ||
        (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
          sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
      ) {
        AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
        m.setU32((pAiControl + 0x14) >>> 0, 0)
        return
      }
    }
    const chaseRoll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
    const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    if (chaseRoll < aip3) {
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
    } else {
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4)
    }
    m.setU32((pAiControl + 0x18) >>> 0, 3)
  } finally {
    freeScratch(m, 0x248)
  }
}

function getUnitMonsterAiControl(m: D2KernMemory113c, pUnit: number): number {
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 1) return 0
  const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  return pMonData !== 0 ? m.u32((pMonData + 0x2c) >>> 0) >>> 0 : 0
}

function startMonsterAttackModeWithMonStats2Check(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nMode: number,
  pTarget: number,
  maskOffset: number,
): void {
  SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
  if (pUnit !== 0) {
    const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, rdI32(m, (pUnit + 0x04) >>> 0)) >>> 0
    if (pMonStats2 !== 0) {
      const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0
      if (pBitMasks !== 0) {
        void (m.u8((pMonStats2 + 0x104) >>> 0) & m.u32((pBitMasks + maskOffset) >>> 0))
      }
    }
  }
  MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, nMode | 0, pTarget >>> 0, 0, 0)
}

/**
 * Sand Maggot / melee-caster-flee-wander monster AI think callback.
 *
 * @va D2Game:0x6FCA1C80
 */
export function MONAI_SandMaggotThink_6FCA1C80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA1C80)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const diff = m.u8((pGame + 0x6d) >>> 0)

  if (bInMeleeRange !== 0) {
    const roll1 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
    if (roll1 < aip3 || rdI32(m, (pAiControl + 0x18) >>> 0) === 0) {
      m.setU32((pAiControl + 0x18) >>> 0, (rdI32(m, (pAiControl + 0x18) >>> 0) + 1) >>> 0)
      const skill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      if (skill1 >= 0) {
        const rollSkill = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
        const aip4 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
        if (rollSkill < aip4) {
          const mode = m.u8((pMonStatsTxt + 0x180) >>> 0)
          AI_CastSkillWithMode113c(m, mode, pUnit >>> 0, pGame >>> 0, skill1, pTarget, 0, 0)
          return
        }
      }
      startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 4, pTarget, 0x10)
      return
    }
    const roll2 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    if (roll2 > 0x14) {
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0f)
      return
    }
    m.setU32((pAiControl + 0x14) >>> 0, 2)
    m.setU32((pAiControl + 0x18) >>> 0, 0)
  }

  const state = rdI32(m, (pAiControl + 0x14) >>> 0)
  if (state === 0) {
    const pCtrl = getUnitMonsterAiControl(m, pUnit)
    if (pCtrl !== 0) {
      m.setU32((pCtrl + 0x18) >>> 0, 0x0d)
      m.setU32((pCtrl + 0x1c) >>> 0, 0x64)
    }
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
    return
  }
  if (state === 1) {
    const pCtrl = getUnitMonsterAiControl(m, pUnit)
    if (pCtrl !== 0) {
      m.setU32((pCtrl + 0x1c) >>> 0, 0x32)
    }
    AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 4)
    const cnt = (rdI32(m, (pAiControl + 0x18) >>> 0) + 1) | 0
    m.setU32((pAiControl + 0x18) >>> 0, cnt >>> 0)
    const aip5 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))
    if (cnt > aip5) {
      m.setU32((pAiControl + 0x14) >>> 0, 0)
      m.setU32((pAiControl + 0x18) >>> 0, 0)
    }
    return
  }
  if (state === 2) {
    const pCtrl = getUnitMonsterAiControl(m, pUnit)
    if (pCtrl !== 0) {
      m.setU32((pCtrl + 0x18) >>> 0, 2)
      m.setU32((pCtrl + 0x1c) >>> 0, 0x64)
    }
    AI_FleeFrom113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 0x0a, 1)
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    m.setU32((pAiControl + 0x14) >>> 0, 1)
    return
  }
  m.setU32((pAiControl + 0x14) >>> 0, 0)
  m.setU32((pAiControl + 0x18) >>> 0, 0)
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0a)
}

/**
 * Corrupt Rogue Archer / command-aware ranged & melee monster AI think callback.
 *
 * @va D2Game:0x6FCA26B0
 */
export function MONAI_CorruptRogueArcherThink_6FCA26B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA26B0)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDistance = rdI32(m, (pAiParam + 0x14) >>> 0)
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0

  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
    const pCmd = pAiGen !== 0 ? m.u32((pAiGen + 0x20) >>> 0) >>> 0 : 0
    if (pCmd !== 0) {
      const cmdType = rdI32(m, (pCmd + 0x0c) >>> 0)
      const cmdId = m.u32((pCmd + 0x10) >>> 0) >>> 0
      const pCmdUnit = SUNIT_GetServerUnit113c(m, pGame >>> 0, cmdType, cmdId) >>> 0
      if (pCmdUnit !== 0) {
        startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 5, pTarget, 0x14)
        AIGENERAL_PopAiCommand113c(m, pUnit >>> 0)
        return
      }
      AIGENERAL_PopAiCommand113c(m, pUnit >>> 0)
    }
  }

  if (bInMeleeRange !== 0) {
    startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 4, pTarget, 0x10)
    return
  }

  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const lastMode = rdI32(m, (pMonData + 0x54) >>> 0)
      if (lastMode === 3 || lastMode === 0x13) {
        startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 5, pTarget, 0x14)
        return
      }
    }
  }

  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
  if (nDistance < aip1) {
    const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
    const aip2 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
    if (roll < aip2) {
      AI_StartAttackMode113c(m, 5, pUnit >>> 0, pGame >>> 0, pTarget)
      return
    }
    const fleeDist = m.u8((pMonStatsTxt + diff * 2 + 0x68) >>> 0)
    if ((AI_FleeFrom113c(m, pGame >>> 0, pUnit >>> 0, pTarget, fleeDist, 1) | 0) !== 0) {
      return
    }
    if (nDistance < 4) {
      AI_StartAttackMode113c(m, 5, pUnit >>> 0, pGame >>> 0, pTarget)
      return
    }
  }

  const wanderDiff = m.u8((pGame + 0x6d) >>> 0)
  const rawWander = sx16(m.u16((pMonStatsTxt + wanderDiff * 2 + 0x68) >>> 0))
  const wanderSteps = rawWander < 3 ? 3 : rawWander & 0xff
  AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, wanderSteps)
}

function scanAdjacentRoomUnitsWithCb(
  m: D2KernMemory113c,
  nScanIndex: number,
  pCtx: number,
  pGame: number,
  pOriginUnit: number,
  pfnVa: number,
  cb: (mem: D2KernMemory113c, pOrigin: number, pCand: number, ctx: number) => number,
): number {
  const baseRes = AITARGET_ScanUnitsByModeTable113c(
    m,
    nScanIndex,
    pCtx >>> 0,
    pGame >>> 0,
    pOriginUnit >>> 0,
    pfnVa >>> 0,
  ) | 0
  if (baseRes !== 0) return baseRes
  const pRoom = UNITS_GetRoom113c(m, pOriginUnit >>> 0) >>> 0
  if (pRoom === 0) return 0
  const ppRoomsNear = m.u32(pRoom) >>> 0
  const nRoomsNear = m.u32((pRoom + 0x30) >>> 0) >>> 0
  if (ppRoomsNear !== 0 && nRoomsNear > 0) {
    for (let i = 0; i < nRoomsNear; i++) {
      const pAdjRoom = m.u32((ppRoomsNear + i * 4) >>> 0) >>> 0
      let pCand = pAdjRoom !== 0 ? m.u32((pAdjRoom + 0x74) >>> 0) >>> 0 : 0
      while (pCand !== 0) {
        const r = cb(m, pOriginUnit >>> 0, pCand, pCtx >>> 0) | 0
        if (r !== 0) return r
        pCand = m.u32((pCand + 0xe8) >>> 0) >>> 0
      }
    }
  } else {
    let pCand = m.u32((pRoom + 0x74) >>> 0) >>> 0
    while (pCand !== 0) {
      const r = cb(m, pOriginUnit >>> 0, pCand, pCtx >>> 0) | 0
      if (r !== 0) return r
      pCand = m.u32((pCand + 0xe8) >>> 0) >>> 0
    }
  }
  return 0
}

function findMonsterByGuidInGameHash(m: D2KernMemory113c, pGame: number, guid: number): number {
  let pCur = m.u32((pGame + 0x1320 + ((guid & 0x7f) << 2)) >>> 0) >>> 0
  while (pCur !== 0) {
    if ((m.u32((pCur + 0x0c) >>> 0) >>> 0) === (guid >>> 0)) return pCur
    pCur = m.u32((pCur + 0xe4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Blunderbore / life-percent dynamic velocity & circle-strafe AI think callback.
 *
 * @va D2Game:0x6FCA3CE0
 */
export function MONAI_BlunderboreThink_6FCA3CE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA3CE0)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0

  if (bInMeleeRange !== 0) {
    const diff = m.u8((pGame + 0x6d) >>> 0)
    const roll1 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
    if (roll1 < aip3) {
      const roll2 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
      const aip4 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
      if (roll2 < aip4) {
        startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 4, pTarget, 0x10)
        return
      }
      startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 5, pTarget, 0x14)
      return
    }
    const roll3 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    if (roll3 < aip3) {
      const loByte = stepSeed64At113c(m, (pUnit + 0x20) >>> 0) & 0xff
      const pathType = loByte >= 0x80 ? 6 : 5
      const pCtrl = getUnitMonsterAiControl(m, pUnit)
      if (pCtrl !== 0) {
        m.setU32((pCtrl + 0x18) >>> 0, pathType)
        m.setU8((pCtrl + 0x20) >>> 0, 4)
      }
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
      return
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0f)
    return
  }

  let lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit >>> 0) | 0
  if (lifePct < 0x28) lifePct = 0x28
  else if (lifePct > 0x64) lifePct = 0x64
  const velDelta = (0x64 - lifePct) | 0
  if (velDelta < -126 || velDelta > 126) {
    throw new D2CommonAssertError('AiThink.cpp', 0x110)
  }
  const pCtrl = getUnitMonsterAiControl(m, pUnit)
  if (pCtrl !== 0) {
    if (velDelta !== 0) m.setU32((pCtrl + 0x1c) >>> 0, velDelta >>> 0)
    m.setU32((pCtrl + 0x18) >>> 0, 0x0d)
  }
  aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
}

/**
 * Corpse Spitter AI think callback: locates corpses via `0x6FC9BB00`, approaches and consumes
 * them with `skill1`, then spits (`mode 5`) and flees (`state 5`).
 *
 * @va D2Game:0x6FCA3FE0
 */
export function MONAI_CorpseSpitterThink_6FCA3FE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA3FE0)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const state = rdI32(m, (pAiControl + 0x14) >>> 0)

  if (state === 5) {
    AI_FleeFrom113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 0x10, 1)
    m.setU32((pAiControl + 0x14) >>> 0, 0)
    return
  }
  if (state === 2) {
    const corpseGuid = m.u32((pAiControl + 0x18) >>> 0) >>> 0
    if (pGame === 0) throw new D2CommonAssertError('AiThink.cpp', 0x2d3)
    const pCorpse = findMonsterByGuidInGameHash(m, pGame >>> 0, corpseGuid)
    if (pCorpse === 0 || rdI32(m, (pCorpse + 0x10) >>> 0) !== 0x0c) {
      m.setU32((pAiControl + 0x14) >>> 0, 0)
      m.setU32((pAiControl + 0x18) >>> 0, 0)
      m.setU32((pAiControl + 0x1c) >>> 0, 0)
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 8)
      return
    }
    if ((UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pCorpse) | 0) > 4) {
      if (rdI32(m, (pAiControl + 0x1c) >>> 0) >= 6) {
        m.setU32((pAiControl + 0x14) >>> 0, 0)
        m.setU32((pAiControl + 0x18) >>> 0, 0)
        m.setU32((pAiControl + 0x1c) >>> 0, 0)
        AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 8)
        return
      }
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pCorpse, 2, 0, 0, 1, 0)
      m.setU32((pAiControl + 0x1c) >>> 0, (rdI32(m, (pAiControl + 0x1c) >>> 0) + 1) >>> 0)
    }
    m.setU32((pAiControl + 0x14) >>> 0, 3)
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 8)
    return
  }
  if (state === 3) {
    const corpseGuid = m.u32((pAiControl + 0x18) >>> 0) >>> 0
    if (pGame === 0) throw new D2CommonAssertError('AiThink.cpp', 0x2d3)
    const pCorpse = findMonsterByGuidInGameHash(m, pGame >>> 0, corpseGuid)
    const skill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
    if (skill1 >= 0 && pCorpse !== 0 && rdI32(m, (pCorpse + 0x10) >>> 0) === 0x0c) {
      const mode = m.u8((pMonStatsTxt + 0x180) >>> 0)
      AI_CastSkillWithMode113c(m, mode, pUnit >>> 0, pGame >>> 0, skill1, pCorpse, 0, 0)
      m.setU32((pAiControl + 0x14) >>> 0, 4)
      return
    }
    m.setU32((pAiControl + 0x14) >>> 0, 0)
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    m.setU32((pAiControl + 0x1c) >>> 0, 0)
    AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 8)
    return
  }
  if (state === 4) {
    if (bInMeleeRange === 0) {
      AI_StartAttackMode113c(m, 5, pUnit >>> 0, pGame >>> 0, pTarget)
      m.setU32((pAiControl + 0x14) >>> 0, 5)
      return
    }
    AI_FleeFrom113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 8, 1)
    return
  }

  const diff = m.u8((pGame + 0x6d) >>> 0)
  const sp = allocScratch(m, 0x10)
  let pFoundCorpse = 0
  try {
    const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
    m.setU32(sp, 0)
    m.setU32((sp + 4) >>> 0, imul32(aip6, aip6) >>> 0)
    scanAdjacentRoomUnitsWithCb(
      m,
      1,
      sp,
      pGame,
      pUnit,
      0x6fc9bb00,
      AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c,
    )
    pFoundCorpse = m.u32(sp) >>> 0
  } finally {
    freeScratch(m, 0x10)
  }

  if (rdI32(m, (pAiControl + 0x14) >>> 0) === 1) {
    if (pFoundCorpse !== 0) {
      m.setU32((pAiControl + 0x18) >>> 0, m.u32((pFoundCorpse + 0x0c) >>> 0) >>> 0)
      if ((UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pFoundCorpse) | 0) > 2) {
        aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pFoundCorpse, 2, 0, 0, 1, 0)
        m.setU32((pAiControl + 0x14) >>> 0, 2)
        m.setU32((pAiControl + 0x1c) >>> 0, 0)
        return
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 8)
      m.setU32((pAiControl + 0x14) >>> 0, 3)
      m.setU32((pAiControl + 0x1c) >>> 0, 0)
      return
    }
    if ((rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) >= 0x14) {
      m.setU32((pAiControl + 0x14) >>> 0, 0)
      m.setU32((pAiControl + 0x18) >>> 0, 0)
      m.setU32((pAiControl + 0x1c) >>> 0, 0)
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 8)
      return
    }
    m.setU32((pAiControl + 0x14) >>> 0, 0)
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    m.setU32((pAiControl + 0x1c) >>> 0, 0)
    return
  }

  let goEatCorpse = false
  if (pFoundCorpse !== 0) {
    if (
      (UNIT_CalcSqDistSubtiles113c(m, pUnit >>> 0, pFoundCorpse) | 0) < 9 &&
      (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
        sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
    ) {
      goEatCorpse = true
    } else if (
      (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
      sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))
    ) {
      goEatCorpse = true
    }
  }
  if (!goEatCorpse) {
    if (bInMeleeRange !== 0) {
      if (
        (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
        sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
      ) {
        AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
        return
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0f)
      return
    }
    if (
      (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
      sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
    ) {
      aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
      return
    }
    if (
      pFoundCorpse === 0 ||
      (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) >=
        sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
    ) {
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 8)
      return
    }
  }

  aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pFoundCorpse, 2, 0, 0, 1, 0)
  m.setU32((pAiControl + 0x14) >>> 0, 2)
  m.setU32((pAiControl + 0x18) >>> 0, m.u32((pFoundCorpse + 0x0c) >>> 0) >>> 0)
  m.setU32((pAiControl + 0x1c) >>> 0, 0)
}

/**
 * Tentacle Beast Head (`Water Watcher` / `River Stalker`) AI think callback.
 *
 * @va D2Game:0x6FCA43F0
 */
export function MONAI_TentacleBeastHeadThink_6FCA43F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA43F0)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0

  const unitClassId = pUnit !== 0 ? rdI32(m, (pUnit + 0x04) >>> 0) : -1
  const chainIdx = DATATBLS_GetMonsterChainInfo113c(m, unitClassId, 0, 0) | 0
  const monStatsCount = rdI32(m, (getSgptDataTablesPtr(m) + 0xa80) >>> 0)
  const baseTentacleId = monStatsCount > 0x12d ? 0x12d : -1
  const tentacleClassId = MONSTATS_FollowSubClassChain_6FC21D30_113c(m, baseTentacleId, chainIdx) | 0

  const diff = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
  if (
    rdI32(m, (pAiControl + 0x14) >>> 0) < aip1 &&
    (UNIT_GetAlignment113c(m, pUnit >>> 0) | 0) === 0
  ) {
    const roll = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
    if (roll < aip3) {
      const sp = allocScratch(m, 0x10)
      let nearbyTentacles = 0
      try {
        m.setU32(sp, tentacleClassId >>> 0)
        m.setU32((sp + 0x04) >>> 0, 0x19)
        m.setU32((sp + 0x08) >>> 0, 0)
        AITARGET_ScanUnitsByModeTable113c(m, 0x0c, sp, pGame >>> 0, pUnit >>> 0, 0)
        nearbyTentacles = rdI32(m, (sp + 0x08) >>> 0)
      } finally {
        freeScratch(m, 0x10)
      }
      const aip2 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
      if (
        nearbyTentacles < aip2 &&
        (AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c(
          m,
          pTarget,
          pUnit >>> 0,
          pMonStatsTxt,
          pGame >>> 0,
        ) |
          0) !==
          0
      ) {
        m.setU32((pAiControl + 0x14) >>> 0, (rdI32(m, (pAiControl + 0x14) >>> 0) + 1) >>> 0)
        return
      }
    }
  }

  if (bInMeleeRange !== 0) {
    const rollAtk = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip4 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
    if (rollAtk < aip4) {
      startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 4, pTarget, 0x10)
      return
    }
    const aip7 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x7a) >>> 0))
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip7)
    return
  }

  if (rdI32(m, (pAiControl + 0x14) >>> 0) < aip1) {
    const roll1 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip5 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))
    if (roll1 >= aip5) {
      const roll2 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
      const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
      if (roll2 < aip6) {
        const loByte = stepSeed64At113c(m, (pUnit + 0x20) >>> 0) & 0xff
        const pathType = loByte >= 0x80 ? 6 : 5
        const pCtrl = getUnitMonsterAiControl(m, pUnit)
        if (pCtrl !== 0) {
          m.setU32((pCtrl + 0x18) >>> 0, pathType)
          m.setU8((pCtrl + 0x20) >>> 0, 4)
        }
        aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
        return
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0f)
      return
    }
  }
  aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
}

/**
 * Oblivion Knight AI think callback: handles low-life retreat cast (`skill3`), ally healing
 * scan (`0x6FC9BC70`, `skill1`), curse (`skill4`), bone projectile (`skill2`), and circle strafing.
 *
 * @va D2Game:0x6FCA7E60
 */
export function MONAI_OblivionKnightThink_6FCA7E60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA7E60)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit >>> 0) | 0
  const diff = m.u8((pGame + 0x6d) >>> 0)

  let checkRetreat = bInMeleeRange !== 0
  if (!checkRetreat && pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const lastMode = rdI32(m, (pMonData + 0x54) >>> 0)
      checkRetreat = lastMode === 3 || lastMode === 0x13
    }
  }
  if (checkRetreat) {
    const skill3 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
    const gameFrame = rdI32(m, (pGame + 0xa8) >>> 0)
    if (skill3 >= 0 && lifePct < 0x21 && gameFrame > rdI32(m, (pAiControl + 0x14) >>> 0)) {
      const aip5 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))
      m.setU32((pAiControl + 0x14) >>> 0, (gameFrame + imul32(aip5, 4)) >>> 0)
      const ux = UNIT_GetPosX113c(m, pUnit >>> 0) | 0
      const uy = UNIT_GetPosY113c(m, pUnit >>> 0) | 0
      const tx = UNIT_GetPosX113c(m, pTarget) | 0
      const ty = UNIT_GetPosY113c(m, pTarget) | 0
      const shift = bInMeleeRange !== 0 ? 2 : 0
      const castX = (tx + ((tx - ux) << shift)) | 0
      const castY = (ty + ((ty - uy) << shift)) | 0
      if ((SKILLS_CanMonsterCastAtTarget113c(m, castY, 0, pUnit >>> 0, skill3, castX) | 0) !== 0) {
        const mode3 = m.u8((pMonStatsTxt + 0x182) >>> 0)
        AI_CastSkillWithMode113c(m, mode3, pUnit >>> 0, pGame >>> 0, skill3, 0, castX, castY)
        return
      }
    }
    if (bInMeleeRange !== 0) {
      const rollAtk = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
      const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
      if (rollAtk < aip1) {
        startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 4, pTarget, 0x10)
        return
      }
    }
  }

  const sp = allocScratch(m, 0x10)
  let pHealAlly = 0
  try {
    const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0)
    m.setU32((sp + 0x08) >>> 0, 0x7fffffff)
    m.setU32((sp + 0x0c) >>> 0, imul32(aip6, aip6) >>> 0)
    scanAdjacentRoomUnitsWithCb(
      m,
      1,
      sp,
      pGame,
      pUnit,
      0x6fc9bc70,
      AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c,
    )
    pHealAlly = m.u32(sp) >>> 0
  } finally {
    freeScratch(m, 0x10)
  }

  const skill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (skill1 >= 0 && pHealAlly !== 0) {
    const rollHeal = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    if (rollHeal < 0x19) {
      const mode1 = m.u8((pMonStatsTxt + 0x180) >>> 0)
      AI_CastSkillWithMode113c(m, mode1, pUnit >>> 0, pGame >>> 0, skill1, pHealAlly, 0, 0)
      return
    }
  }

  const hasCollision = UNITS_HasCollisionBetweenUnits113c(m, pUnit >>> 0, pTarget, 4) | 0
  let castSkill4 = false
  if (hasCollision === 0) {
    const rollCast = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip4 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
    if (rollCast < aip4) {
      const skill4 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
      if (
        skill4 >= 0 &&
        rdI32(m, (pGame + 0xa8) >>> 0) > rdI32(m, (pAiControl + 0x18) >>> 0) &&
        (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
          sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
      ) {
        castSkill4 = true
      } else {
        const skill2 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
        if (
          skill2 >= 0 &&
          rdI32(m, (pGame + 0xa8) >>> 0) > rdI32(m, (pAiControl + 0x1c) >>> 0) &&
          (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
            sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
        ) {
          const mode2 = m.u8((pMonStatsTxt + 0x181) >>> 0)
          AI_CastSkillWithMode113c(m, mode2, pUnit >>> 0, pGame >>> 0, skill2, pTarget, 0, 0)
          m.setU32((pAiControl + 0x1c) >>> 0, (rdI32(m, (pGame + 0xa8) >>> 0) + 0x14) >>> 0)
          return
        }
      }
    }
  } else {
    const rollBlocked = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
    if (rollBlocked < aip1) {
      const skill4 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
      if (
        skill4 >= 0 &&
        rdI32(m, (pGame + 0xa8) >>> 0) > rdI32(m, (pAiControl + 0x18) >>> 0) &&
        (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
          sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
      ) {
        castSkill4 = true
      }
    }
  }

  if (castSkill4) {
    const skill4 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
    const mode4 = m.u8((pMonStatsTxt + 0x183) >>> 0)
    AI_CastSkillWithMode113c(m, mode4, pUnit >>> 0, pGame >>> 0, skill4, pTarget, 0, 0)
    const aip5 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))
    m.setU32((pAiControl + 0x18) >>> 0, (rdI32(m, (pGame + 0xa8) >>> 0) + aip5) >>> 0)
    return
  }

  const rollMove = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
  if (rollMove < 0x1e) {
    const loByte = stepSeed64At113c(m, (pUnit + 0x20) >>> 0) & 0xff
    const pathType = loByte < 0x80 ? 5 : 6
    const pCtrl = getUnitMonsterAiControl(m, pUnit)
    if (pCtrl !== 0) {
      m.setU32((pCtrl + 0x18) >>> 0, pathType)
      m.setU8((pCtrl + 0x20) >>> 0, 4)
    }
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
    return
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x14)
}

/**
 * Succubus / Stygian Fury AI think callback: toggles state `0x5A`/`0x5B`, handles melee (`mode 5`),
 * ranged projectile cooldown (`mode 4`), `skill1` curse cast, and approach/stall.
 *
 * @va D2Game:0x6FCA8A70
 */
export function MONAI_SuccubusThink_6FCA8A70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA8A70)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDistance = rdI32(m, (pAiParam + 0x14) >>> 0)
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const diff = m.u8((pGame + 0x6d) >>> 0)

  if (rdI32(m, (pAiControl + 0x14) >>> 0) !== 0) {
    const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
    if (aip6 !== 0) {
      STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, aip6 === 2 ? 0x5b : 0x5a, 0)
    }
  }

  if (bInMeleeRange !== 0) {
    const rollAtk = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
    if (rollAtk < aip3) {
      startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 5, pTarget, 0x14)
      return
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0)))
    return
  }

  const aip7 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x7a) >>> 0))
  if (nDistance < aip7) {
    const rollRanged = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip4 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
    if (rollRanged < aip4) {
      if (rdI32(m, (m.u32(pAiParam >>> 0) + 0x18) >>> 0) >= rdI32(m, (pGame + 0xa8) >>> 0)) {
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0)))
        return
      }
      AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
      const aip8 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x80) >>> 0))
      m.setU32(
        (m.u32(pAiParam >>> 0) + 0x18) >>> 0,
        (rdI32(m, (pGame + 0xa8) >>> 0) + aip8) >>> 0,
      )
      return
    }
  }

  const skill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  const aip2 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
  if (
    skill1 >= 0 &&
    nDistance < aip2 &&
    (rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0) <
      sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
  ) {
    const ty = UNIT_GetPosY113c(m, pTarget) | 0
    const tx = UNIT_GetPosX113c(m, pTarget) | 0
    if ((SKILLS_CanMonsterCastAtTarget113c(m, ty, pTarget, pUnit >>> 0, skill1, tx) | 0) !== 0) {
      const mode1 = m.u8((pMonStatsTxt + 0x180) >>> 0)
      AI_CastSkillWithMode113c(m, mode1, pUnit >>> 0, pGame >>> 0, skill1, pTarget, 0, 0)
      const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
      if (aip6 !== 0) {
        STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, aip6 === 2 ? 0x5b : 0x5a, 1)
      }
      m.setU32((m.u32(pAiParam >>> 0) + 0x14) >>> 0, 1)
      return
    }
  }

  const rollChase = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
  if (rollChase < 0x32) {
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
    return
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0)))
}

/**
 * Fetish Shaman / dual-melee + `skill1` + state `0x5A`/`0x5B` AI think callback.
 *
 * @va D2Game:0x6FCA8D80
 */
export function MONAI_FetishShamanOrCasterThink_6FCA8D80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA8D80)
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDistance = rdI32(m, (pAiParam + 0x14) >>> 0)
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const diff = m.u8((pGame + 0x6d) >>> 0)

  if (rdI32(m, (pAiControl + 0x14) >>> 0) !== 0) {
    const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
    if (aip6 !== 0) {
      STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, aip6 === 2 ? 0x5b : 0x5a, 0)
    }
  }

  if (bInMeleeRange !== 0) {
    const roll1 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
    if (roll1 < aip3) {
      const roll2 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
      const aip4 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))
      if (roll2 < aip4) {
        startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 4, pTarget, 0x10)
        return
      }
      startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 5, pTarget, 0x14)
      return
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0)))
    return
  }

  const skill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  const aip2 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
  if (skill1 >= 0 && nDistance < aip2) {
    const rollSkill = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
    if (rollSkill < aip1) {
      const ty = UNIT_GetPosY113c(m, pTarget) | 0
      const tx = UNIT_GetPosX113c(m, pTarget) | 0
      if ((SKILLS_CanMonsterCastAtTarget113c(m, ty, pTarget, pUnit >>> 0, skill1, tx) | 0) !== 0) {
        const mode1 = m.u8((pMonStatsTxt + 0x180) >>> 0)
        AI_CastSkillWithMode113c(m, mode1, pUnit >>> 0, pGame >>> 0, skill1, pTarget, 0, 0)
        const aip6 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x74) >>> 0))
        if (aip6 !== 0) {
          STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, aip6 === 2 ? 0x5b : 0x5a, 1)
        }
        m.setU32((m.u32(pAiParam >>> 0) + 0x14) >>> 0, 1)
        return
      }
    }
  }

  const rollChase = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
  if (rollChase < 0x32) {
    aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
    return
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0)))
}

/**
 * Aura-bearing melee/caster monster AI think callback: equips `skill4` on right hand if unset,
 * casts `skill3`/`skill2` or swings `mode 5`/`4` in melee, and casts `skill1` or approaches at range.
 *
 * @va D2Game:0x6FCA9430
 */
export function MONAI_AuraKnightOrZealotThink_6FCA9430_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCA9430)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const diff = m.u8((pGame + 0x6d) >>> 0)

  const skill4 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
  if (skill4 >= 0 && (UNITS_GetRightSkill113c(m, pUnit >>> 0) >>> 0) === 0) {
    const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
    MONSTER_AddSkillToUnit113c(m, aip1, skill4, pUnit >>> 0, 1)
    SKILLS_AssignHandSkillAndSyncAura113c(m, pUnit >>> 0, 0, skill4, -1)
  }

  if (bInMeleeRange !== 0) {
    const skill3 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
    if (skill3 >= 0) {
      const roll3 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
      if (roll3 < sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))) {
        AI_CastSkillWithMode113c(
          m,
          m.u8((pMonStatsTxt + 0x182) >>> 0),
          pUnit >>> 0,
          pGame >>> 0,
          skill3,
          pTarget,
          0,
          0,
        )
        return
      }
    }
    const skill2 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
    if (skill2 >= 0) {
      const roll2 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
      if (roll2 < sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))) {
        AI_CastSkillWithMode113c(
          m,
          m.u8((pMonStatsTxt + 0x181) >>> 0),
          pUnit >>> 0,
          pGame >>> 0,
          skill2,
          pTarget,
          0,
          0,
        )
        return
      }
    }
    const rollMelee = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    if (rollMelee < sx16(m.u16((pMonStatsTxt + diff * 2 + 0x68) >>> 0))) {
      startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 5, pTarget, 0x14)
      return
    }
    startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 4, pTarget, 0x10)
    return
  }

  const skill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (skill1 >= 0) {
    const roll1 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
    if (roll1 < sx16(m.u16((pMonStatsTxt + diff * 2 + 0x6e) >>> 0))) {
      AI_CastSkillWithMode113c(
        m,
        m.u8((pMonStatsTxt + 0x180) >>> 0),
        pUnit >>> 0,
        pGame >>> 0,
        skill1,
        pTarget,
        0,
        0,
      )
      return
    }
  }
  const pCtrl = getUnitMonsterAiControl(m, pUnit)
  if (pCtrl !== 0) {
    m.setU32((pCtrl + 0x18) >>> 0, 0x0d)
  }
  aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 7)
}

const NPC_STATIC_FLAGS_6FD27870: ReadonlyArray<readonly [number, number, number, number]> = [
  [148, 1, 0, 1], [146, 0, 0, 0], [154, 1, 0, 0], [150, 0, 0, 0], [147, 1, 0, 0],
  [155, 0, 0, 0], [266, 0, 0, 0], [175, 0, 1, 0], [176, 0, 1, 0], [177, 1, 1, 1],
  [178, 1, 1, 0], [202, 1, 1, 0], [200, 0, 1, 0], [210, 0, 1, 0], [201, 0, 1, 0],
  [198, 0, 1, 0], [199, 1, 1, 0], [377, 0, 1, 0], [378, 0, 1, 0], [265, 0, 0, 0],
  [244, 0, 1, 0], [245, 0, 2, 0], [251, 0, 2, 0], [252, 1, 2, 0], [253, 1, 2, 0],
  [254, 1, 2, 0], [255, 1, 2, 1], [264, 0, 2, 0], [246, 0, 3, 0], [406, 0, 3, 0],
  [367, 0, 3, 0], [408, 0, 3, 0], [257, 1, 3, 1], [405, 1, 3, 1], [297, 0, 2, 0],
  [331, 0, 1, 0], [513, 1, 4, 1], [512, 1, 4, 0], [511, 1, 4, 0], [514, 1, 4, 0],
  [515, 0, 4, 0], [521, 0, 4, 0], [520, 0, 4, 0],
]

function cloneNpcVendorByClassId(m: D2KernMemory113c, classId: number, pGame: number, pEntry: number): void {
  const pVendorOut = (pEntry + 0x2c) >>> 0
  let vendorIdx = -1
  let canRepair = 0
  let canGamble = 0
  switch (classId | 0) {
    case 0x093: vendorIdx = 1; canRepair = 1; canGamble = 1; break
    case 0x094: vendorIdx = 0; break
    case 0x09a: vendorIdx = 2; canRepair = 1; break
    case 0x0b1: vendorIdx = 5; break
    case 0x0b2: vendorIdx = 3; canRepair = 1; break
    case 0x0c7: vendorIdx = 9; canGamble = 1; break
    case 0x0ca: vendorIdx = 4; break
    case 0x0fc: vendorIdx = 0x0a; canRepair = 1; break
    case 0x0fd: vendorIdx = 6; canRepair = 1; break
    case 0x0fe: vendorIdx = 7; canGamble = 1; break
    case 0x0ff: vendorIdx = 8; break
    case 0x101: vendorIdx = 0x0c; canRepair = 1; break
    case 0x195: vendorIdx = 0x0d; canRepair = 1; canGamble = 1; break
    case 0x1ff: vendorIdx = 0x0f; canRepair = 1; break
    case 0x200: vendorIdx = 0x10; canRepair = 1; canGamble = 1; break
    case 0x201: vendorIdx = 0x0e; break
    case 0x202: vendorIdx = 0x0f; canGamble = 1; break
    default: return
  }
  NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c(m, vendorIdx, pGame >>> 0, pVendorOut)
  if (canRepair !== 0) {
    m.setU8((pEntry + 0x24) >>> 0, 1)
    m.setU8((pEntry + 0x25) >>> 0, 1)
  }
  if (canGamble !== 0) {
    m.setU32((pEntry + 0x0c) >>> 0, 1)
  }
}

/**
 * Allocates and initializes `pGame->pNpcControl` (`pGame + 0x1D24`), allocating up to `64`
 * `0x44`-byte `D2NpcRecordStrc` entries for all `MonStats.txt` rows with `bNpc` (`bit 1` of `+0x0D`).
 *
 * @va D2Game:0x6FCAFBE0
 */
export function NPCS_InitGameNpcControl_6FCAFBE0_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCAFBE0)
  const pNpcArray = m.alloc(0x1100) >>> 0
  for (let i = 0; i < 0x440; i++) m.setU32((pNpcArray + i * 4) >>> 0, 0)
  const pNpcControl = m.alloc(0x14) >>> 0
  m.setU32((pNpcControl + 0x04) >>> 0, 0)
  m.setU32(pNpcControl, 0)
  m.setU32((pNpcControl + 0x10) >>> 0, 0)
  const pNpcSeed = (pNpcControl + 0x08) >>> 0
  SEED_InitSeed113c(m, pNpcSeed)
  const newGameSeedLo = stepSeed64At113c(m, (pGame + 0xd0) >>> 0) >>> 0
  SEED_InitLowSeed113c(m, pNpcSeed, newGameSeedLo)

  if (readOptionalGlobalU32(m, 0x6fdeff6c, 0) === 0) {
    m.setU32(0x6fdeff6c, m.alloc(16))
  }
  if (readOptionalGlobalU32(m, 0x6fd31c0c, 0) === 0) {
    m.setU32(0x6fd31c0c, 0)
    DATATBLS_GetItemsTxtRecordByCode113c(m, 0x20767163, 0x6fd31c0c)
  }
  if (readOptionalGlobalU32(m, 0x6fd31c10, 0) === 0) {
    m.setU32(0x6fd31c10, 0)
    DATATBLS_GetItemsTxtRecordByCode113c(m, 0x20767161, 0x6fd31c10)
  }
  DATATBLS_GetItemDataTables113c(m)

  const pDataTables = getSgptDataTablesPtr(m)
  const monStatsCount = pDataTables !== 0 ? rdI32(m, (pDataTables + 0xa80) >>> 0) : 0
  let slotCount = 0
  let pEntry = pNpcArray
  for (let classId = 0; classId < monStatsCount; classId++) {
    const curDataTables = getSgptDataTablesPtr(m)
    if (classId >= rdI32(m, (curDataTables + 0xa80) >>> 0)) continue
    const pMonStatsBase = m.u32((curDataTables + 0xa78) >>> 0) >>> 0
    const pMonStats = (pMonStatsBase + imul32(classId, 0x1a8)) >>> 0
    if (pMonStats === 0) continue
    const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0
    const mask1 = pBitMasks !== 0 ? m.u32((pBitMasks + 0x04) >>> 0) : 2
    if ((m.u8((pMonStats + 0x0d) >>> 0) & mask1) === 0) continue

    m.setU32(pEntry, classId >>> 0)
    m.setU32((pEntry + 0x1c) >>> 0, 0)
    m.setU32((pNpcControl + 0x10) >>> 0, (m.u32((pNpcControl + 0x10) >>> 0) + 1) >>> 0)
    m.setU32((pEntry + 0x14) >>> 0, 0)
    m.setU8((pEntry + 0x20) >>> 0, 0)
    m.setU8((pEntry + 0x21) >>> 0, 0)
    m.setU32((pEntry + 0x28) >>> 0, 0)
    m.setU8((pEntry + 0x23) >>> 0, 0)
    const pInv = INVENTORY_AllocInventory113c(m, m.u32((pGame + 0x1c) >>> 0), 0) >>> 0
    m.setU32((pEntry + 0x04) >>> 0, pInv)
    m.setU32((pEntry + 0x18) >>> 0, 0)
    m.setU32((pEntry + 0x08) >>> 0, 0)
    m.setU32((pEntry + 0x0c) >>> 0, 0)
    if (slotCount >= 0x40) throw new D2CommonAssertError('Npcs.cpp', 0xe6)
    m.setU32(pNpcControl, (m.u32(pNpcControl) + 1) >>> 0)

    const memTblCount = readOptionalGlobalU32(m, 0x6fd279c8, 0) | 0
    let matchedShop = -1
    let matchedAct = 0
    let matchedHeal = 0
    if (memTblCount > 0) {
      for (let i = 0; i < memTblCount; i++) {
        if ((readOptionalGlobalU32(m, (0x6fd27870 + i * 8) >>> 0, 0xffffffff) | 0) === classId) {
          matchedShop = m.u8((0x6fd27874 + i * 8) >>> 0)
          matchedAct = m.u8((0x6fd27875 + i * 8) >>> 0)
          matchedHeal = m.u8((0x6fd27876 + i * 8) >>> 0)
          break
        }
      }
    } else if (readOptionalGlobalU32(m, 0x6fd27870, 0) === 0) {
      for (let i = 0; i < NPC_STATIC_FLAGS_6FD27870.length; i++) {
        const row = NPC_STATIC_FLAGS_6FD27870[i]!
        if (row[0] === classId) {
          matchedShop = row[1]
          matchedAct = row[2]
          matchedHeal = row[3]
          break
        }
      }
    }

    if (matchedShop >= 0) {
      m.setU8((pEntry + 0x22) >>> 0, matchedAct)
      m.setU8((pEntry + 0x23) >>> 0, matchedShop)
      m.setU8((pEntry + 0x24) >>> 0, 0)
      m.setU8((pEntry + 0x25) >>> 0, 0)
      m.setU8((pEntry + 0x26) >>> 0, matchedHeal)
      m.setU8((pEntry + 0x27) >>> 0, 0)
      if (matchedShop === 1) {
        cloneNpcVendorByClassId(m, classId, pGame, pEntry)
      } else {
        m.setU32((pEntry + 0x2c) >>> 0, 0)
        m.setU32((pEntry + 0x34) >>> 0, 0)
      }
    }
    slotCount = (slotCount + 1) | 0
    pEntry = (pEntry + 0x44) >>> 0
  }
  m.setU32((pNpcControl + 0x04) >>> 0, pNpcArray)
  m.setU32((pGame + 0x1d24) >>> 0, pNpcControl)
}

function div100MagicSigned(x: number): number {
  const hi = Number((BigInt(x | 0) * 0x51eb851fn) >> 32n) | 0
  const s5 = hi >> 5
  return (s5 + (s5 >>> 31)) | 0
}

function calcPctBonus100_113c(val: number, pct: number): number {
  const v = val | 0
  const p = pct | 0
  if (v > 0x100000) {
    if (((v & -16) | 0) < 0x640) {
      return Number((BigInt(p) * BigInt(v)) / 100n) | 0
    }
    return imul32(div100MagicSigned(v), p)
  }
  if (p > 0x10000) {
    if (((p & -16) | 0) < 0x640) {
      return Number((BigInt(p) * BigInt(v)) / 100n) | 0
    }
    return imul32(div100MagicSigned(p), v)
  }
  return div100MagicSigned(imul32(p, v))
}

/**
 * Calculates Assassin kick + progressive charge finish damage (`Dragon Talon` / `Dragon Tail` /
 * `Dragon Flight`), temporarily deactivating equipped hand-to-hand (`0x2D`) weapon statlists
 * during `SUNITDMG_FillDamageValues113c`.
 *
 * @va D2Game:0x6FCB2360
 */
export function SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pGame: number,
  pDmg: number,
  pDefender: number,
  nSkillId: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FCB2360)
  SKILLS_ApplyProgressiveAttackRatingAndPhysBonuses113c(m, pAttacker >>> 0, pDmg >>> 0)
  m.setU32(pDmg >>> 0, (m.u32(pDmg >>> 0) | 3) >>> 0)

  const skillId = nSkillId | 0
  const slvl = nSkillLevel | 0
  let skillMin = SKILLS_GetSkillPhysMinDamage113c(m, pAttacker >>> 0, skillId, slvl, 0) | 0
  let skillMax = SKILLS_GetSkillPhysMaxDamage113c(m, pAttacker >>> 0, skillId, slvl, 0) | 0
  const physPct = rdI32(m, (pDmg + 0x0c) >>> 0)
  skillMin = (skillMin + calcPctBonus100_113c(skillMin, physPct)) | 0
  skillMax = (skillMax + calcPctBonus100_113c(skillMax, physPct)) | 0

  const sp = allocScratch(m, 0x18)
  let bootMin = 0
  let bootMax = 0
  let bootPct = 0
  try {
    const pBootMin = (sp + 0x04) >>> 0
    const pBootMax = (sp + 0x08) >>> 0
    const pBootPct = sp
    m.setU32(pBootMin, 0)
    m.setU32(pBootMax, 0)
    m.setU32(pBootPct, 0)
    SKILLS_CalcKickBootDamage113c(m, pAttacker >>> 0, pBootMin, pBootMax, pBootPct)
    bootMin = (rdI32(m, pBootMin) << 8) | 0
    bootMax = (rdI32(m, pBootMax) << 8) | 0
    bootPct = rdI32(m, pBootPct)
  } finally {
    freeScratch(m, 0x18)
  }

  bootMin = (bootMin + calcPctBonus100_113c(bootMin, bootPct)) | 0
  const totalMax = (bootMax + calcPctBonus100_113c(bootMax, bootPct) + skillMax) | 0
  const totalMin = (bootMin + skillMin) | 0
  const range = (totalMax - totalMin) | 0
  let roll = 0
  if (range > 0) {
    const lo = stepSeed64At113c(m, (pAttacker + 0x20) >>> 0) >>> 0
    if ((range & ((range - 1) | 0)) === 0) {
      roll = (lo & ((range - 1) >>> 0)) | 0
    } else {
      roll = (lo % (range >>> 0)) | 0
    }
  }
  m.setU32((pDmg + 0x08) >>> 0, (rdI32(m, (pDmg + 0x08) >>> 0) + totalMin + roll) >>> 0)
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, pAttacker >>> 0, pDmg >>> 0, slvl)

  const pInv = m.u32((pAttacker + 0x60) >>> 0) >>> 0
  if (pInv === 0) return
  let pWeap1 = INVENTORY_GetCompositWeaponMemPort113c(m, pInv) >>> 0
  let pWeap2 = 0
  if (pWeap1 !== 0) {
    const loc = ITEMS_GetBodyLocation113c(m, pWeap1) & 0xff
    const otherLoc = ((loc === 4 ? 1 : 0) + 4) | 0
    pWeap2 = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInv, otherLoc) >>> 0
  }
  if (
    (ITEMS_CheckItemTypeIdMemPort113c(m, pWeap1, 0x2d) | 0) !== 0 &&
    (ITEMS_CheckNotBrokenOrUnequipping113c(m, pWeap1) | 0) !== 0 &&
    (STATLIST_GetOwnerAndDynamicFlag113c(m, pWeap1, 0) | 0) !== 0
  ) {
    STATLIST_SetWeaponStatListActive113c(m, pAttacker >>> 0, pWeap1, 0)
  } else {
    pWeap1 = 0
  }
  if (
    pWeap2 !== 0 &&
    pWeap2 !== pWeap1 &&
    (ITEMS_CheckItemTypeIdMemPort113c(m, pWeap2, 0x2d) | 0) !== 0 &&
    (ITEMS_CheckNotBrokenOrUnequipping113c(m, pWeap2) | 0) !== 0 &&
    (STATLIST_GetOwnerAndDynamicFlag113c(m, pWeap2, 0) | 0) !== 0
  ) {
    STATLIST_SetWeaponStatListActive113c(m, pAttacker >>> 0, pWeap2, 0)
  }
  SUNITDMG_FillDamageValues113c(
    m,
    pGame >>> 0,
    pAttacker >>> 0,
    pDefender >>> 0,
    pDmg >>> 0,
    1,
    0x80,
  )
  SKILLS_ApplyProgressiveChargesToDamage113c(m, pAttacker >>> 0, pDmg >>> 0)
  if (pWeap1 !== 0) {
    STATLIST_SetWeaponStatListActive113c(m, pAttacker >>> 0, pWeap1, 1)
  }
}

const NOVA_RING_SIN_64 = [
  0, 2, 5, 8, 11, 14, 16, 19, 21, 23, 24, 26, 27, 28, 29, 29,
  30, 29, 29, 28, 27, 26, 24, 23, 21, 19, 16, 14, 11, 8, 5, 2,
  0, -2, -5, -8, -11, -14, -16, -19, -21, -23, -24, -26, -27, -28, -29, -29,
  -30, -29, -29, -28, -27, -26, -24, -23, -21, -19, -16, -14, -11, -8, -5, -2,
] as const

function spawnNovaRingProjectilesCommon(
  m: D2KernMemory113c,
  nLowSeed: number,
  pGame: number,
  pOwner: number,
  nMissileId: number,
  nX: number,
  nY: number,
  nSkillId: number,
  nSkillLevel: number,
  nStep: number,
  initFnVa: number,
  alwaysSetTargetX: boolean,
): void {
  const step = nStep | 0
  if (step <= 0) return
  const sp = allocScratch(m, 0x70)
  try {
    const pSeed = sp
    const pParams = (sp + 0x10) >>> 0
    SEED_InitLowSeed113c(m, pSeed, nLowSeed >>> 0)
    for (let i = 0; i < 0x17; i++) m.setU32((pParams + i * 4) >>> 0, 0)
    m.setU32(pParams, 3)
    m.setU32((pParams + 0x04) >>> 0, pOwner >>> 0)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, nX >>> 0)
    m.setU32((pParams + 0x18) >>> 0, nY >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, nSkillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    m.setU32((pParams + 0x54) >>> 0, initFnVa >>> 0)

    for (let idx = 0; idx < 64; idx = (idx + step) | 0) {
      const targetX = NOVA_RING_SIN_64[(idx + 16) & 63]!
      const targetY = NOVA_RING_SIN_64[idx & 63]!
      m.setU32((pParams + 0x1c) >>> 0, targetX >>> 0)
      m.setU32((pParams + 0x20) >>> 0, targetY >>> 0)
      const seedLo = stepSeed64At113c(m, pSeed) >>> 0
      m.setU32((pParams + 0x58) >>> 0, seedLo)
      const pMissile = MISSILE_CreateServerProjectile113c(m, pGame >>> 0, pParams, {
        missileInitCallback: (mem, fnVa, pMiss, dwParam) => {
          if (fnVa === 0x6fcb1040) {
            MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c(mem, pMiss, dwParam)
          } else if (fnVa === 0x6fcb0ea0) {
            MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c(mem, pMiss, dwParam)
          }
        },
      }) >>> 0
      if (alwaysSetTargetX || (pMissile !== 0 && (nMissileId | 0) === 0x238)) {
        const pDataTables = getSgptDataTablesPtr(m)
        let paramVal = 0
        if (rdI32(m, (pDataTables + 0xba0) >>> 0) > 0x118) {
          const pSkill280 = (m.u32((pDataTables + 0xb98) >>> 0) + 0x271a0) >>> 0
          if (pSkill280 !== 0) paramVal = rdI32(m, (pSkill280 + 0x14c) >>> 0)
        }
        MISSILE_SetTargetX113c(m, pMissile, (paramVal + 1) | 0)
      }
    }
  } finally {
    freeScratch(m, 0x70)
  }
}

/**
 * Spawns a 64-direction nova ring (stepped by `nStep`) of randomized spiral projectiles
 * (`0x6FCB1040`).
 *
 * @va D2Game:0x6FCB3D60
 */
export function SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c(
  m: D2KernMemory113c,
  nLowSeed: number,
  pGame: number,
  pOwner: number,
  nMissileId: number,
  nX: number,
  nY: number,
  nSkillId: number,
  nSkillLevel: number,
  nStep: number,
): void {
  hitD2GameVa113c(0x6FCB3D60)
  spawnNovaRingProjectilesCommon(
    m,
    nLowSeed,
    pGame,
    pOwner,
    nMissileId,
    nX,
    nY,
    nSkillId,
    nSkillLevel,
    nStep,
    0x6fcb1040,
    false,
  )
}

/**
 * Spawns a 64-direction nova ring (stepped by `nStep`) of guided-frame projectiles (`0x6FCB0EA0`).
 *
 * @va D2Game:0x6FCB4370
 */
export function SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c(
  m: D2KernMemory113c,
  nLowSeed: number,
  pGame: number,
  pOwner: number,
  nMissileId: number,
  nX: number,
  nY: number,
  nSkillId: number,
  nSkillLevel: number,
  nStep: number,
): void {
  hitD2GameVa113c(0x6FCB4370)
  spawnNovaRingProjectilesCommon(
    m,
    nLowSeed,
    pGame,
    pOwner,
    nMissileId,
    nX,
    nY,
    nSkillId,
    nSkillLevel,
    nStep,
    0x6fcb0ea0,
    true,
  )
}


function executePulseAuraTickCommon(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
  selfRemoveProcVa: number,
  pulseCallbackVa: number,
  pulseCallbackFn: (mem: D2KernMemory113c, pAuraCtx: number, pTargetUnit: number) => number,
): number {
  void STATES_RemoveFreezeOrShatterStateCallback_6FCB85D0_113c
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = getSgptDataTablesPtr(m)
  if (pDataTables === 0 || skillId >= rdI32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const auraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  const nStatesCount = rdI32(m, (pDataTables + 0xc4) >>> 0)
  if (auraState < 0 || auraState >= nStatesCount) return 0

  const manaCost256 = SKILLS_EvaluateManaCost256ths113c(m, skillId, nLevel | 0) | 0
  const curMana256 = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 8, 0) | 0
  const nextFrame =
    SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c(
      m,
      nLevel | 0,
      skillId,
      pSkillsTxt,
      pGame >>> 0,
      pUnit >>> 0,
    ) | 0
  const durFrames = (nextFrame + ((1 - rdI32(m, (pGame + 0xa8) >>> 0)) | 0)) | 0

  const sp = allocScratch(m, 0x128)
  const pSelfCtx = sp
  const pPulseDesc = (sp + 0x10) >>> 0
  const pSelfDesc = (sp + 0x60) >>> 0
  const pDmg = (sp + 0xb0) >>> 0
  try {
    m.fill(pSelfDesc, 0x50, 0)
    m.setU32(pSelfDesc, auraState >>> 0)
    m.setU32((pSelfDesc + 0x04) >>> 0, skillId >>> 0)
    m.setU32((pSelfDesc + 0x08) >>> 0, (nLevel | 0) >>> 0)
    m.setU32((pSelfDesc + 0x0c) >>> 0, durFrames >>> 0)
    if (selfRemoveProcVa !== 0) {
      m.setU32((pSelfDesc + 0x4c) >>> 0, selfRemoveProcVa >>> 0)
    }

    const canApplySelfPassive =
      pUnit === 0 || rdI32(m, pUnit >>> 0) !== 0 || curMana256 >= manaCost256
    for (let i = 0; i < 5; i++) {
      const statId = sx16(m.u16((pSkillsTxt + 0x98 + i * 2) >>> 0))
      m.setU32((pSelfDesc + 0x10 + i * 4) >>> 0, statId >>> 0)
      if (canApplySelfPassive) {
        const calcVal =
          SKILLS_EvalCalcByOffset113c(
            m,
            pUnit >>> 0,
            m.u32((pSkillsTxt + 0xa4 + i * 4) >>> 0),
            skillId,
            nLevel | 0,
          ) | 0
        m.setU32((pSelfDesc + 0x28 + i * 4) >>> 0, calcVal >>> 0)
      }
    }

    m.setU32(pSelfCtx, pGame >>> 0)
    m.setU32((pSelfCtx + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((pSelfCtx + 0x08) >>> 0, 0)
    m.setU32((pSelfCtx + 0x0c) >>> 0, pSelfDesc)
    AURAS_ApplyRadialStatBuffCallback113c(m, pSelfCtx, pUnit >>> 0)

    const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
    if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) | 0) !== 0) {
      return 1
    }

    m.fill(pPulseDesc, 0x50, 0)
    const targetAuraState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
    m.setU32(pPulseDesc, targetAuraState >>> 0)
    m.setU32((pPulseDesc + 0x04) >>> 0, skillId >>> 0)
    m.setU32((pPulseDesc + 0x08) >>> 0, (nLevel | 0) >>> 0)
    m.setU32((pPulseDesc + 0x0c) >>> 0, durFrames >>> 0)

    if (targetAuraState >= 0 && targetAuraState < rdI32(m, (getSgptDataTablesPtr(m) + 0xc4) >>> 0)) {
      for (let i = 0; i < 6; i++) {
        const statId = sx16(m.u16((pSkillsTxt + 0x54 + i * 2) >>> 0))
        m.setU32((pPulseDesc + 0x10 + i * 4) >>> 0, statId >>> 0)
        if (curMana256 >= manaCost256) {
          const calcVal =
            SKILLS_EvalCalcByOffset113c(
              m,
              pUnit >>> 0,
              m.u32((pSkillsTxt + 0x68 + i * 4) >>> 0),
              skillId,
              nLevel | 0,
            ) | 0
          m.setU32((pPulseDesc + 0x28 + i * 4) >>> 0, calcVal >>> 0)
          if (calcVal !== 0) {
            m.setU32((pPulseDesc + 0x48) >>> 0, 1)
          }
        }
      }
    }

    m.fill(pDmg, 0x70, 0)
    if (
      (SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, pUnit >>> 0, pDmg, nLevel | 0) |
        0) !==
      0
    ) {
      m.setU32((pDmg + 0x60) >>> 0, (m.u32((pDmg + 0x60) >>> 0) | 0x0d) >>> 0)
      const hitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
      if (hitClass !== 0) {
        m.setU32((pDmg + 0x60) >>> 0, hitClass)
      }
      const resFlags = (m.u16((pSkillsTxt + 0x12e) >>> 0) | 0x20) & 0xffff
      m.setU16((pDmg + 0x04) >>> 0, (m.u16((pDmg + 0x04) >>> 0) | resFlags) & 0xffff)
      const hitFlags = m.u32((pSkillsTxt + 0x130) >>> 0) >>> 0
      m.setU32(pDmg, (m.u32(pDmg) | hitFlags) >>> 0)
      m.setU32((pPulseDesc + 0x4c) >>> 0, pDmg)
    }

    const nRadius =
      SKILLS_EvalCalcByOffset113c(
        m,
        pUnit >>> 0,
        m.u32((pSkillsTxt + 0x64) >>> 0),
        skillId,
        nLevel | 0,
      ) | 0
    const dwAuraFilter = m.u32((pSkillsTxt + 0x50) >>> 0) >>> 0
    AURA_ForEachUnitInRadius113c(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      0,
      0,
      nRadius,
      dwAuraFilter,
      pulseCallbackVa >>> 0,
      pPulseDesc,
      0,
      pulseCallbackFn,
    )

    if (manaCost256 > 0 && pUnit !== 0 && rdI32(m, pUnit >>> 0) === 0) {
      if (rdI32(m, (pPulseDesc + 0x40) >>> 0) > 0) {
        STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x55, 1)
        SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c(m, pUnit >>> 0, manaCost256)
        return 1
      }
      STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x55, 0)
    }
    return 1
  } finally {
    freeScratch(m, 0x128)
  }
}

/**
 * `SrvDoFunc` for Sanctuary / undead radial pulse aura: applies self passive aura stats with
 * `0x6FCB85D0` remove callback, skips pulse in town, and pulses `0x6FCBA630` across radius.
 *
 * @va D2Game:0x6FCBABC0
 */
export function SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
): number {
  hitD2GameVa113c(0x6FCBABC0)
  return executePulseAuraTickCommon(
    m,
    pGame,
    pUnit,
    nSkillId,
    nLevel,
    0x6fcb85d0,
    0x6fcba630,
    AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c,
  )
}

/**
 * `SrvDoFunc` for radial elemental pulse auras (`Holy Fire`, `Holy Freeze`, `Holy Shock`):
 * applies self passive aura stats, skips pulse in town, and pulses `0x6FCBA7C0` across radius.
 *
 * @va D2Game:0x6FCBAF50
 */
export function SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nLevel: number,
): number {
  hitD2GameVa113c(0x6FCBAF50)
  return executePulseAuraTickCommon(
    m,
    pGame,
    pUnit,
    nSkillId,
    nLevel,
    0,
    0x6fcba7c0,
    AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c,
  )
}


/**
 * Evaluates AI threat / target priority score against `pCandidateUnit` (`ecx`) relative to
 * `pAttackerUnit` (`[esp+4]`) and optional tether coordinates `pTetherCoords` (`eax`, `+0x0C`/`+0x10`).
 *
 * @va D2Game:0x6FCC3E80
 */
export function AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(
  m: D2KernMemory113c,
  pTetherCoords: number,
  pCandidateUnit: number,
  pAttackerUnit: number,
): number {
  hitD2GameVa113c(0x6FCC3E80)
  const bInMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pAttackerUnit >>> 0, pCandidateUnit >>> 0, 0) | 0
  let tetherScore = 0
  if (pTetherCoords !== 0) {
    const tx = rdI32(m, (pTetherCoords + 0x0c) >>> 0)
    const ty = rdI32(m, (pTetherCoords + 0x10) >>> 0)
    if ((AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, pAttackerUnit >>> 0, tx, ty) | 0) > 0x55) {
      const tx2 = rdI32(m, (pTetherCoords + 0x0c) >>> 0)
      const ty2 = rdI32(m, (pTetherCoords + 0x10) >>> 0)
      if ((AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, pCandidateUnit >>> 0, tx2, ty2) | 0) < 0x55) {
        tetherScore = 0x64
      }
    }
  }

  const physRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x24, 0) | 0
  const fireRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x27, 0) | 0
  const ltngRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x29, 0) | 0
  const magicRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x25, 0) | 0
  const coldRes = bInMelee !== 0 ? STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x2b, 0) | 0 : 0
  const resSum = (coldRes + (((physRes + magicRes * 2) | 0) << 2) + ltngRes + fireRes) | 0
  const resScore = Math.trunc(resSum / 15) | 0

  const maxDmg = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x16, 0) | 0
  const fireMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x31, 0) | 0
  const lightMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x33, 0) | 0
  const magicMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x35, 0) | 0
  const coldMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x37, 0) | 0
  const poisonMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x3a, 0) | 0
  const dmgSum = ((poisonMax >> 8) + coldMax + magicMax + lightMax + fireMax + maxDmg) | 0
  const dmgScore = divPow2Trunc(dmgSum, 1)

  const coldStateScore = (STATES_CheckState113c(m, pCandidateUnit >>> 0, 0x0b) | 0) !== 0 ? 0x64 : 0
  const lowLifeScore = (STATLIST_GetUnitLifePercent113c(m, pCandidateUnit >>> 0) | 0) < 0x14 ? 0x64 : 0

  let rLvl = 0
  let lLvl = 0
  let rThreat = 0
  let lThreat = 0

  const pLeftSkill = UNITS_GetLeftSkill113c(m, pCandidateUnit >>> 0) >>> 0
  if (pLeftSkill !== 0) {
    lLvl = SKILLS_EvaluateSkillLevel113c(m, pCandidateUnit >>> 0, pLeftSkill, 1) | 0
    const skillId = SKILLS_GetSkillIdFromSkill113c(m, pLeftSkill, 0x6fd1b6b0, 0x225) | 0
    const pDataTables = getSgptDataTablesPtr(m)
    if (skillId >= 0 && pDataTables !== 0 && skillId < rdI32(m, (pDataTables + 0xba0) >>> 0)) {
      const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(skillId, 0x23c)) >>> 0
      if (pSkillsTxt !== 0) lThreat = m.u8((pSkillsTxt + 0x18e) >>> 0)
    }
  }

  const pRightSkill = UNITS_GetRightSkill113c(m, pCandidateUnit >>> 0) >>> 0
  if (pRightSkill !== 0) {
    rLvl = SKILLS_EvaluateSkillLevel113c(m, pCandidateUnit >>> 0, pRightSkill, 1) | 0
    const skillId = SKILLS_GetSkillIdFromSkill113c(m, pRightSkill, 0x6fd1b6b0, 0x22b) | 0
    const pDataTables = getSgptDataTablesPtr(m)
    if (skillId >= 0 && pDataTables !== 0 && skillId < rdI32(m, (pDataTables + 0xba0) >>> 0)) {
      const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(skillId, 0x23c)) >>> 0
      if (pSkillsTxt !== 0) rThreat = m.u8((pSkillsTxt + 0x18e) >>> 0)
    }
  }

  const skillScore = divPow2Trunc((imul32(rThreat, rLvl) + imul32(lThreat, lLvl)) | 0, 2)

  let proxScore = 0
  if (bInMelee !== 0) {
    proxScore = 0x64
  } else if ((UNITS_HasCollisionBetweenUnits113c(m, pAttackerUnit >>> 0, pCandidateUnit >>> 0, 4) | 0) === 0) {
    proxScore = 0x4b
  }

  if (pCandidateUnit !== 0 && rdI32(m, pCandidateUnit >>> 0) === 1) {
    const classId = rdI32(m, (pCandidateUnit + 0x04) >>> 0)
    const pDataTables = getSgptDataTablesPtr(m)
    if (classId < 0 || pDataTables === 0 || classId >= rdI32(m, (pDataTables + 0xa80) >>> 0)) {
      return 0
    }
    const pMonStatsTxt = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(classId, 0x1a8)) >>> 0
    if (pMonStatsTxt === 0 || m.u8((pMonStatsTxt + 0x4e) >>> 0) <= 1) {
      return 0
    }
  }

  const weighted =
    (imul32(lowLifeScore, 3) +
      resScore +
      imul32((tetherScore + proxScore) | 0, 5) +
      imul32((skillScore + coldStateScore * 2 + dmgScore) | 0, 2)) |
    0
  const quotient = Math.trunc(weighted / 22) | 0
  return quotient === 0 ? 1 : quotient
}

/**
 * Monster AI think callback (`0x6FCC66E0`): links `dwFlags2/+0xD0 == 0x0B` units into `pGame+0x1118`,
 * attacks in melee (scheduling `aip1` delay), sprints at `0x64` (`mode 0x0F`), or wanders along
 * western / lateral fallback offsets.
 *
 * @va D2Game:0x6FCC66E0
 */
export function MONAI_SiegeRunnerThink_6FCC66E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC66E0)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const nDist = rdI32(m, (pAiParam + 0x14) >>> 0)
  const bInMeleeRange = rdI32(m, (pAiParam + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0

  if (rdI32(m, (pUnit + 0xd0) >>> 0) === 0x0b && pGame !== 0) {
    const unitType = rdI32(m, pUnit >>> 0)
    if (unitType === 0 || unitType === 1) {
      const prevHead = m.u32((pGame + 0x1118) >>> 0) >>> 0
      const pNode = m.alloc(0x10) >>> 0
      if (pNode !== 0) {
        m.setU32(pNode, pUnit >>> 0)
        m.setU32((pNode + 0x04) >>> 0, 0)
        m.setU32((pNode + 0x08) >>> 0, prevHead)
        m.setU32((pNode + 0x0c) >>> 0, 0)
        m.setU32((pGame + 0x1118) >>> 0, pNode)
        if (prevHead !== 0) {
          m.setU32((prevHead + 0x0c) >>> 0, pNode)
        }
        m.setU32((pUnit + 0xd0) >>> 0, 8)
      }
    }
  }

  if (pTarget !== 0) {
    const diff = m.u8((pGame + 0x6d) >>> 0)
    if (bInMeleeRange !== 0) {
      startMonsterAttackModeWithMonStats2Check(m, pGame, pUnit, 4, pTarget, 0x10)
      const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pUnit >>> 0, aip1)
      return
    }
    const aip3 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x62) >>> 0))
    if (nDist < aip3) {
      const roll = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100) | 0
      const aip2 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x5c) >>> 0))
      if (roll < aip2) {
        const pCtrl = getUnitMonsterAiControl(m, pUnit)
        if (pCtrl !== 0) {
          m.setU32((pCtrl + 0x1c) >>> 0, 0x64)
        }
        aiApproachTarget6FD12540(m, pGame >>> 0, pUnit >>> 0, pTarget, 0x0f, 0, 0, 1, 0)
        return
      }
    }
  }

  const ux = getUnitSubtileXInline(m, pUnit)
  const uy = getUnitSubtileYInline(m, pUnit)

  const rx1 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 0x14) | 0
  const ry1 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 0x14) | 0
  if (
    (aiApproachTarget6FD12540(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      0,
      2,
      (ux + rx1 - 0x28) | 0,
      (uy + ry1 - 0x0a) | 0,
      1,
      4,
    ) |
      0) !==
    0
  ) {
    return
  }

  const bit = stepSeed64At113c(m, (pUnit + 0x20) >>> 0) & 1
  const sign1 = bit !== 0 ? 1 : -1
  const rx2 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 0x14) | 0
  const ry2 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 0x14) | 0
  if (
    (aiApproachTarget6FD12540(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      0,
      2,
      (ux + rx2 - 0x0a) | 0,
      (uy + (ry2 - imul32(sign1, 0x1e)) - 0x0a) | 0,
      1,
      4,
    ) |
      0) !==
    0
  ) {
    return
  }

  const sign2 = bit === 0 ? 1 : -1
  const rx3 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 0x14) | 0
  const ry3 = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 0x14) | 0
  if (
    (aiApproachTarget6FD12540(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      0,
      2,
      (ux + rx3 - 0x0a) | 0,
      (uy + (ry3 - imul32(sign2, 0x1e)) - 0x0a) | 0,
      1,
      4,
    ) |
      0) ===
    0
  ) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0f)
  }
}


const BAAL_THRONE_WAVE_SUPERUNIQUES_6FD1B688: readonly number[] = [0x3d, 0x3e, 0x3f, 0x40, 0x41]

/**
 * Baal Throne of Destruction AI think callback (`0x6FCC8430`): orchestrates the 5 Throne minion
 * waves (`61..65` via `0x6FD1B688`), wave laugh/taunt (`0x11D`), morph to `0x22F`, and Decrepify casts.
 *
 * @va D2Game:0x6FCC8430
 */
export function MONAI_BaalThroneThink_6FCC8430_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC8430)
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pAiControl = m.u32(pAiParam >>> 0) >>> 0

  if (pMonStatsTxt === 0) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0a)
    return
  }

  const gameFrame = rdI32(m, (pGame + 0xa8) >>> 0)
  const nextFrame = rdI32(m, (pAiControl + 0x1c) >>> 0)
  if (gameFrame < nextFrame) {
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, (gameFrame - nextFrame) | 0)
    return
  }

  const waveIdx = rdI32(m, (pAiControl + 0x14) >>> 0)
  const sp = allocScratch(m, 0x10)
  let aliveCount = 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0x40)
    m.setU32((sp + 0x08) >>> 0, 0)
    m.setU32((sp + 0x0c) >>> 0, 0x40)
    AITARGET_ScanUnitsByModeTable113c(m, 3, sp, pGame >>> 0, pUnit >>> 0, 0)
    aliveCount = rdI32(m, (sp + 0x08) >>> 0)
  } finally {
    freeScratch(m, 0x10)
  }

  if (aliveCount === 0) {
    const pCtrlCur = m.u32(pAiParam >>> 0) >>> 0
    if ((m.u8((pCtrlCur + 0x18) >>> 0) & 1) === 0) {
      if (waveIdx >= 0 && waveIdx < 5) {
        const tableVal = BAAL_THRONE_WAVE_SUPERUNIQUES_6FD1B688[waveIdx]!
        const suIdx = DATATBLS_GetTableWordAE0_6FC21830_113c(m, tableVal) | 0
        const pSuperUniqueTxt = DATATBLS_GetSuperUniquesTxtRecord113c(m, suIdx) >>> 0
        if (pSuperUniqueTxt === 0) return
        const msgId = rdI32(m, (pSuperUniqueTxt + 0x04) >>> 0)
        if (msgId < 0) return
        SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c(m, pUnit >>> 0, msgId)
        if (msgId === 0x3e) {
          SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c(m, pUnit >>> 0, 0x17)
        } else if (msgId === 0x69) {
          SUNITMSG_QueuePacketA4ToUnit_6FC9A090_113c(m, pUnit >>> 0, 0x17d)
        }
      }
      AI_CastSkillWithMode113c(m, 0x0a, pUnit >>> 0, pGame >>> 0, 0x11d, pUnit >>> 0, 0, 0)
      const pCtrl1 = m.u32(pAiParam >>> 0) >>> 0
      m.setU32((pCtrl1 + 0x18) >>> 0, (m.u32((pCtrl1 + 0x18) >>> 0) | 1) >>> 0)
      const pCtrl2 = m.u32(pAiParam >>> 0) >>> 0
      m.setU32((pCtrl2 + 0x1c) >>> 0, (rdI32(m, (pGame + 0xa8) >>> 0) + 0xfa) >>> 0)
      SUNIT_SetUnitEventSound113c(m, pUnit >>> 0, 0x10, 0)
      return
    }

    if (waveIdx >= 5) {
      MONSTER_MorphMonsterClassId_6FCCFC50_113c(m, pUnit >>> 0, pGame >>> 0, 0x22f, 1)
      MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, pUnit >>> 0)
      AI_InitMonsterAiThinkFn113c(m, pUnit >>> 0)
      STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x8e, 1)
      const ownerType = pUnit !== 0 ? rdI32(m, pUnit >>> 0) : 6
      const ownerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
      const pStatList = STATLIST_AllocList113c(m, 0, ownerType, ownerId, 0, 0) >>> 0
      if (pStatList !== 0) {
        STATLIST_MergeStatLists113c(m, pUnit >>> 0, pStatList, 1)
        STATLIST_SetState113c(m, pStatList, 0x8e)
        STATLIST_SetStat113c(m, pStatList, 0x163, 0x22f, 0)
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 5)
      return
    }

    const rawSuIdx =
      waveIdx >= 0
        ? BAAL_THRONE_WAVE_SUPERUNIQUES_6FD1B688[waveIdx]!
        : (readOptionalGlobalU32(m, (0x6fd1b688 + waveIdx * 4) >>> 0, 0) | 0)
    const suWord = DATATBLS_GetTableWordAE0_6FC21830_113c(m, rawSuIdx) | 0
    const presetIdx = DATATBLS_AdjustMonsterPresetIndex113c(m, 2, suWord) | 0
    AI_CastSkill286AtOffsetY13_6FCC4E40_113c(m, pUnit >>> 0, pAiParam >>> 0, presetIdx)
    return
  }

  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const skill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (skill1 > 0 && pTarget !== 0) {
    const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skill1) >>> 0
    if (pSkillsTxt !== 0) {
      const auraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
      const nStates = rdI32(m, (getSgptDataTablesPtr(m) + 0xc4) >>> 0)
      if (
        !(
          auraState >= 0 &&
          auraState < nStates &&
          (STATES_CheckState113c(m, pUnit >>> 0, auraState) | 0) !== 0
        )
      ) {
        const targetState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
        if (
          !(
            targetState >= 0 &&
            targetState < nStates &&
            (STATES_CheckState113c(m, pTarget, targetState) | 0) !== 0
          )
        ) {
          const roll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
          const diff = m.u8((pGame + 0x6d) >>> 0)
          const aip1 = sx16(m.u16((pMonStatsTxt + diff * 2 + 0x56) >>> 0))
          if (roll < aip1) {
            const mode1 = m.u8((pMonStatsTxt + 0x180) >>> 0)
            AI_CastSkillWithMode113c(m, mode1, pUnit >>> 0, pGame >>> 0, skill1, pTarget, 0, 0)
            return
          }
        }
      }
    }
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x0a)
}


function hasHighThreatAoESkill(
  m: D2KernMemory113c,
  pTarget: number,
  pSkill: number,
  lineNo: number,
): boolean {
  if (pSkill === 0) return false
  const skillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1b6b0, lineNo) | 0
  if (skillId === 0x3b || skillId === 0x38) return true
  if (skillId === 0x33) {
    return (SKILLS_EvaluateSkillLevel113c(m, pTarget >>> 0, pSkill, 1) | 0) > 3
  }
  if (skillId === 0x1b) {
    return (SKILLS_EvaluateSkillLevel113c(m, pTarget >>> 0, pSkill, 1) | 0) > 7
  }
  return false
}

/**
 * Selects Baal's combat action index (`0..16`, or `0x10`/`4`/`0x0B` when `pTarget == 0`) using
 * 17-slot weighted probability tables modulated by melee range, LOS, player resists, town portals,
 * stationary AoE skills, and Throne/Worldstone tether distance.
 *
 * @va D2Game:0x6FCC8E80
 */
export function AIBAAL_SelectCombatAction_6FCC8E80_113c(
  m: D2KernMemory113c,
  pAiControl: number,
  pBaalUnit: number,
  pTarget: number,
  nLifePct: number,
  nCloneOrMinionCount: number,
  pTetherCoords: number,
): number {
  hitD2GameVa113c(0x6FCC8E80)
  const curState = rdI32(m, (pAiControl + 0x14) >>> 0)
  if (curState !== 0) return curState

  if (pTarget === 0) {
    const uy = getUnitSubtileYInline(m, pBaalUnit)
    const ux = getUnitSubtileXInline(m, pBaalUnit)
    const pRoom = UNITS_GetRoom113c(m, pBaalUnit >>> 0) >>> 0
    if ((COLLISION_CheckMaskWithPattern2_113c(m, pRoom, ux, uy, 2, 0x40) | 0) !== 0) {
      return 0x10
    }
    const rem = ((stepSeed64At113c(m, (pBaalUnit + 0x20) >>> 0) >>> 0) % 0x3e8) >>> 0
    return rem < 1 ? 4 : 0x0b
  }

  let pGame = m.u32((pTarget + 0x80) >>> 0) >>> 0
  if (pGame === 0) {
    pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pBaalUnit >>> 0) >>> 0
  }

  let pPortalObj = 0
  let bNearPortal = 0
  if (rdI32(m, pTarget >>> 0) === 0) {
    const portalGuid = PLAYER_GetPlayerDataField48_6FC57440_113c(m, pTarget >>> 0) >>> 0
    if (pGame === 0) throw new D2CommonAssertError('AiBaal.cpp', 0x2d3)
    let pCurObj = m.u32((pGame + 0x1520 + ((portalGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pCurObj !== 0) {
      if ((m.u32((pCurObj + 0x0c) >>> 0) >>> 0) === portalGuid) {
        pPortalObj = pCurObj
        break
      }
      pCurObj = m.u32((pCurObj + 0xe4) >>> 0) >>> 0
    }
    if (pPortalObj !== 0) {
      const pObjRoom = UNITS_GetRoom113c(m, pPortalObj) >>> 0
      if ((DUNGEON_GetLevelIdFromRoom113c(m, pObjRoom) | 0) === 0x6c) {
        const tx = rdI32(m, (pTetherCoords + 0x0c) >>> 0)
        const ty = rdI32(m, (pTetherCoords + 0x10) >>> 0)
        if ((UNITS_GetUnitDistanceToCoordinates113c(m, pPortalObj, tx, ty) >>> 0) < 0x55) {
          bNearPortal = 1
        }
      }
    }
  }

  let bDangerSkill = 0
  const pLeft = UNITS_GetLeftSkill113c(m, pTarget >>> 0) >>> 0
  if (hasHighThreatAoESkill(m, pTarget, pLeft, 0x27f)) bDangerSkill = 1
  const pRight = UNITS_GetRightSkill113c(m, pTarget >>> 0) >>> 0
  if (hasHighThreatAoESkill(m, pTarget, pRight, 0x286)) bDangerSkill = 1

  let bTether55 = 0
  let bTether69 = 0
  if (pTetherCoords !== 0) {
    const d =
      AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(
        m,
        pTarget >>> 0,
        rdI32(m, (pTetherCoords + 0x0c) >>> 0),
        rdI32(m, (pTetherCoords + 0x10) >>> 0),
      ) | 0
    if (d > 0x55) bTether55 = 1
    if (d > 0x69) bTether69 = 1
  }

  const bInMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pBaalUnit >>> 0, pTarget >>> 0, 0) | 0
  const bHasLos =
    (UNITS_HasCollisionBetweenUnits113c(m, pBaalUnit >>> 0, pTarget >>> 0, 4) | 0) === 0 ? 1 : 0
  const fireRes = STATLIST_GetUnitStat113c(m, pTarget >>> 0, 0x27, 0) | 0
  const ltngRes = STATLIST_GetUnitStat113c(m, pTarget >>> 0, 0x29, 0) | 0

  let weights: number[]
  if (bInMelee !== 0) {
    weights = [0, 0, 0x28, 0x46, 0, 0x28, 0x18, 0x28, 0x0f, 0, 0, 0, 0, 0, 0, 0, 0]
    if ((STATLIST_GetUnitLifePercent113c(m, pTarget >>> 0) | 0) < 0x14) {
      weights[2] = (weights[2]! + 0x0a) | 0
    }
    if ((STATES_CheckState113c(m, pTarget >>> 0, 0x0b) | 0) !== 0) {
      weights[7] = 0
      weights[8] = 0
    }
    if (fireRes > ltngRes) weights[6] = (weights[6]! - 0x0a) | 0
    if (fireRes < ltngRes) weights[6] = (weights[6]! + 0x0a) | 0
    if (bHasLos === 0) {
      weights[5] = 0
      weights[6] = 0
    }
    if (bNearPortal !== 0) weights[15] = 0x0a
  } else if (bHasLos === 0) {
    weights = [0, 0, 0, 0, 5, 0, 0x19, 0, 0x19, 0x28, 0, 0, 0x19, 0, 0, 0, 0]
    const clones = nCloneOrMinionCount | 0
    if (clones < 2) {
      weights[8] = (weights[8]! - 5) | 0
      weights[6] = 0
      weights[1] = 0x19
      weights[9] = 0
    }
    if (bDangerSkill !== 0 && bTether55 === 0) {
      weights[13] = 0x0f
    } else if (bTether55 !== 0) {
      weights[13] = 0x19
      weights[1] = 0
      weights[12] = 0x0f
      if (weights[9] === 0) weights[9] = 0x14
      if (clones < 2) weights[9] = (weights[9]! - 5) | 0
    }
    if (bTether69 !== 0) weights[14] = 0x3c
    if (bNearPortal !== 0) weights[15] = 0x14
  } else {
    weights = [0, 0, 0, 0, 0, 0x19, 0x19, 0, 0x0f, 0x14, 0x0a, 0, 0x14, 0, 0, 0, 0]
    if ((AI_CalcApproxUnitDistSubtiles113c(m, pBaalUnit >>> 0, pTarget >>> 0) >>> 0) > 0x19) {
      weights[10] = (weights[10]! + 0x0a) | 0
      weights[8] = (weights[8]! - 5) | 0
      weights[5] = 0
    }
    if (fireRes > ltngRes) {
      weights[6] = (weights[6]! - 0x0a) | 0
      weights[8] = (weights[8]! - 0x0a) | 0
    }
    if (fireRes < ltngRes) {
      weights[6] = (weights[6]! + 0x0a) | 0
      weights[8] = (weights[8]! + 0x0a) | 0
    }
    const clones = nCloneOrMinionCount | 0
    if (clones < 2) weights[6] = (weights[6]! - 0x0a) | 0
    if (clones > 3) weights[6] = (weights[6]! + 5) | 0
    if ((nLifePct >>> 0) > 0x3c) weights[9] = (weights[9]! + 0x0a) | 0

    UNITS_GetRoom113c(m, pBaalUnit >>> 0)
    const sp = allocScratch(m, 0x18)
    let diffVal = 0
    try {
      m.fill(sp, 0x14, 0)
      if (
        pBaalUnit !== 0 &&
        rdI32(m, pBaalUnit >>> 0) === 1 &&
        m.u32((pBaalUnit + 0x14) >>> 0) !== 0 &&
        m.u32(m.u32((pBaalUnit + 0x14) >>> 0)) !== 0 &&
        pGame !== 0
      ) {
        MONSTER_GetDifficultyAndPlayerBonus113c(
          m,
          pGame,
          (sp + 0x0c) >>> 0,
          (sp + 0x10) >>> 0,
          sp,
          (sp + 0x04) >>> 0,
        )
        diffVal = rdI32(m, (sp + 0x0c) >>> 0)
      }
    } finally {
      freeScratch(m, 0x18)
    }
    if (clones < 2 && diffVal < 2) {
      weights[9] = 0
    }
    if (bDangerSkill !== 0 && bTether55 === 0) {
      weights[6] = (weights[6]! + 0x0a) | 0
      weights[10] = 0x1e
      weights[13] = 0x0f
    } else if (bTether55 !== 0) {
      const had9 = weights[9]! !== 0
      weights[1] = 0
      weights[12] = 0x0a
      weights[10] = 0
      weights[13] = 0x0f
      if (!had9) weights[9] = 0x0a
    }
    if (bTether69 !== 0) {
      weights[9] = 0x14
      weights[14] = 0x3c
    }
    if (bNearPortal !== 0) {
      weights[15] = 0x0f
    }
  }

  if ((SKILLS_CanMonsterCastAtTarget113c(m, 0, pTarget >>> 0, pBaalUnit >>> 0, 0xc7, 0) | 0) !== 0) {
    weights[9] = 0
  }
  if (
    weights[15]! !== 0 &&
    pPortalObj !== 0 &&
    (SKILLS_CanMonsterCastAtTarget113c(m, 0, pPortalObj, pBaalUnit >>> 0, 0xc7, 0) | 0) === 0
  ) {
    weights[15] = 0
  }

  let totalWeight = 0
  for (let i = 0; i < 17; i++) {
    totalWeight = (totalWeight + weights[i]!) | 0
  }
  let roll = 0
  if (totalWeight > 0) {
    const seedLo = stepSeed64At113c(m, (pBaalUnit + 0x20) >>> 0) >>> 0
    const uTotal = totalWeight >>> 0
    roll =
      (uTotal & ((uTotal - 1) >>> 0)) === 0
        ? (seedLo & (uTotal - 1)) | 0
        : ((seedLo % uTotal) | 0)
  }

  let acc = 0
  for (let i = 0; i < 17; i++) {
    acc = (acc + weights[i]!) | 0
    if (roll < acc) return i
  }
  return 0x0b
}


function executePotionItemUseCommon(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pItem: number,
  mode: 0 | 1 | 2,
): number {
  void STATES_OnTimedStateRemoved113c
  const itemClassId = pItem !== 0 ? rdI32(m, (pItem + 0x04) >>> 0) : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, itemClassId) >>> 0
  if (pItemsTxt === 0) return 0

  const lenFrames =
    ITEMS_EvalItemCalc113c(m, pUnit >>> 0, pItem >>> 0, m.u32((pItemsTxt + 0xb0) >>> 0)) | 0
  const stateId = sx16(m.u16((pItemsTxt + 0x98) >>> 0))
  let pStatList = 0
  let remFrames = 0

  if (lenFrames > 0) {
    if (stateId <= 0) return 0
    const pDataTables = getSgptDataTablesPtr(m)
    if (pDataTables === 0 || stateId >= rdI32(m, (pDataTables + 0xc4) >>> 0)) return 0
    pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, stateId) >>> 0
    if (pStatList !== 0) {
      remFrames = (STATLIST_GetExpireFrameEx113c(m, pStatList) - rdI32(m, (pGame + 0xa8) >>> 0)) | 0
    }
  }

  let bAppliedAny = 0
  let bModifiedHp = 0

  for (let slot = 0; slot < 3; slot++) {
    const statId = sx16(m.u16((pItemsTxt + 0x9e + slot * 2) >>> 0))
    if (statId < 0) break
    const pDataTables = getSgptDataTablesPtr(m)
    const nItemStatCount = pDataTables !== 0 ? rdI32(m, (pDataTables + 0xbd4) >>> 0) : 0
    if (statId >= nItemStatCount) break
    const pIscBase = m.u32((pDataTables + 0xbcc) >>> 0) >>> 0
    const pIsc = (pIscBase + imul32(statId, 0x144)) >>> 0
    if (pIsc === 0) {
      if (mode === 0) break
      continue
    }

    const dwCalc = m.u32((pItemsTxt + 0xa4 + slot * 4) >>> 0) >>> 0
    let amount = 0
    let preFetchedMaxVal = 0

    if (mode === 0) {
      const maxStatId = m.u16((pIsc + 0x32) >>> 0)
      if (maxStatId >= (nItemStatCount >>> 0)) break
      const pct = ITEMS_EvalItemCalc113c(m, pUnit >>> 0, pItem >>> 0, dwCalc) | 0
      if (pct <= 0) continue
      preFetchedMaxVal = STATLIST_GetUnitStat113c(m, pUnit >>> 0, maxStatId, 0) | 0
      amount = pct === 100 ? preFetchedMaxVal : mulDiv113c(pct, preFetchedMaxVal, 100) | 0
    } else if (mode === 1) {
      let raw = ITEMS_EvalItemCalc113c(m, pUnit >>> 0, pItem >>> 0, dwCalc) | 0
      if (statId === 0x1a || statId === 0x4a) raw = (raw << 8) | 0
      amount = (raw << (m.u8((pIsc + 0x18) >>> 0) & 31)) | 0
      if (amount <= 0) continue
    } else {
      let raw = ITEMS_EvalItemCalc113c(m, pUnit >>> 0, pItem >>> 0, dwCalc) | 0
      if (statId === 6 || statId === 0x4a) {
        if (statId === 0x4a) raw = (raw << 8) | 0
        raw = ITEMS_ApplyClassLifePotionScale113c(m, pUnit >>> 0, raw) | 0
        const vit = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 3, 0) | 0
        if (vit > 0) {
          const halfRoll = (SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, vit) >>> 1) | 0
          const critRoll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
          if (critRoll < halfRoll) raw = (raw + raw) | 0
        }
      } else if (statId === 8 || statId === 0x1a) {
        if (statId === 0x1a) raw = (raw << 8) | 0
        raw = ITEMS_ApplyClassManaPotionScale113c(m, pUnit >>> 0, raw) | 0
        const enr = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 1, 0) | 0
        if (enr > 0) {
          const halfRoll = (SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, enr) >>> 1) | 0
          const critRoll = rollSeedAt6FC21180(m, (pUnit + 0x20) >>> 0, 100) | 0
          if (critRoll < halfRoll) raw = (raw + raw) | 0
        }
      }
      amount = (raw << (m.u8((pIsc + 0x18) >>> 0) & 31)) | 0
      if (amount <= 0) continue
    }

    if (statId === 6) bModifiedHp = 1
    if ((statId === 6 || statId === 0x4a) && pUnit !== 0 && rdI32(m, pUnit >>> 0) === 0) {
      amount = SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c(m, pUnit >>> 0, amount, pGame >>> 0) | 0
    }

    if (lenFrames <= 0) {
      const curVal = STATLIST_GetUnitStat113c(m, pUnit >>> 0, statId, 0) | 0
      if (mode === 0) {
        if (((curVal + amount) | 0) > preFetchedMaxVal) {
          amount = (preFetchedMaxVal - curVal) | 0
        }
      } else {
        const curMaxStatId = m.u16((pIsc + 0x32) >>> 0)
        const nStatCnt = rdI32(m, (getSgptDataTablesPtr(m) + 0xbd4) >>> 0)
        if (curMaxStatId < (nStatCnt >>> 0)) {
          const maxVal = STATLIST_GetUnitStat113c(m, pUnit >>> 0, curMaxStatId, 0) | 0
          if (((curVal + amount) | 0) > maxVal) {
            amount = (maxVal - curVal) | 0
          }
        }
      }
      STATLIST_AddUnitStatMemPort113c(m, pUnit >>> 0, statId, amount, 0)
      bAppliedAny = 1
    } else {
      const expireFrame = (rdI32(m, (pGame + 0xa8) >>> 0) + remFrames + lenFrames) | 0
      if (pStatList === 0) {
        const ownerType = pUnit !== 0 ? rdI32(m, pUnit >>> 0) : 6
        const ownerId = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
        pStatList = STATLIST_AllocList113c(m, 2, ownerType, ownerId, 0, expireFrame) >>> 0
        if (pStatList === 0) continue
        STATLIST_SetState113c(m, pStatList, stateId)
        STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, stateId, 1)
        if (pUnit === 0 || rdI32(m, pUnit >>> 0) !== 0) {
          if (pUnit !== 0) {
            let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
            while (pEv !== 0) {
              const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
              if (m.u8(pEv) === 3) EVENT_FreeNode113c(m, pGame >>> 0, pEv)
              pEv = pNext
            }
          }
          EVENT_SetEventFull113c(
            m,
            pGame >>> 0,
            pUnit >>> 0,
            3,
            (rdI32(m, (pGame + 0xa8) >>> 0) + 1) | 0,
            0,
            0,
            0,
          )
        }
        STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0)
        STATLIST_MergeStatLists113c(m, pUnit >>> 0, pStatList, 1)
      }
      STATLIST_SetExpireFrameEx113c(m, pStatList, expireFrame)
      const prevRate = STATLIST_GetStatValue113c(m, pStatList, statId, 0) | 0
      const totalPool = (imul32(prevRate, remFrames) + amount) | 0
      if (slot === 0) {
        EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0x0c, expireFrame, 0, 0, 0)
      }
      const totalDur = (remFrames + lenFrames) | 0
      if (totalDur > 0) {
        const newRate = Math.trunc(totalPool / totalDur) | 0
        STATLIST_SetStat113c(m, pStatList, statId, newRate, 0)
      }
      bAppliedAny = 1
    }
  }

  if (bModifiedHp !== 0 && pUnit !== 0 && rdI32(m, pUnit >>> 0) === 0) {
    const prevByte = mode !== 0 ? STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x160, 0) & 0xff : 0
    const curHp = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0) >> 8
    const maxHp = (STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0) >> 8
    const lifeByte =
      maxHp > 0 && curHp < maxHp ? (Math.trunc((curHp << 7) / maxHp) & 0xff) : 0x80
    const diff = prevByte - lifeByte
    if (mode === 0 || (diff < 0 ? -diff : diff) > 4) {
      MONSTER_QueuePacket0xAB_LifeNotify113c(m, pUnit >>> 0, lifeByte)
      STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x160, lifeByte, 0)
    }
  }

  return bAppliedAny
}

/**
 * Percentage potion item use callback (`Rejuvenation` / `Full Rejuvenation`): scales each `stat[0..2]`
 * by `mulDiv(calcPct, maxStatVal, 100)`, heals Blood Golem, applies instant or timed state stats,
 * and broadcasts `0xAB` life byte (`stat 0x160`).
 *
 * @va D2Game:0x6FCCE6D0
 */
export function ITEMS_UsePercentagePotion_6FCCE6D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pItem: number,
  _nTargetX = 0,
  _nTargetY = 0,
  _dwArg4 = 0,
  _dwArg5 = 0,
): number {
  hitD2GameVa113c(0x6FCCE6D0)
  void _nTargetX
  void _nTargetY
  void _dwArg4
  void _dwArg5
  return executePotionItemUseCommon(m, pGame, pUnit, pItem, 0)
}

/**
 * Flat/buff potion item use callback (`Stamina`, `Antidote`, `Thawing` potions): evaluates up to
 * 3 item stats (`+0x9E`/`+0xA4`), shifts `0x1A`/`0x4A` by 8 + `valShift`, applies instant or
 * duration-averaged state stats (`0x6FCBF7A0`), and updates `0xAB` life byte when delta > 4.
 *
 * @va D2Game:0x6FCCEA40
 */
export function ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pItem: number,
  _nTargetX = 0,
  _nTargetY = 0,
  _dwArg4 = 0,
  _dwArg5 = 0,
): number {
  hitD2GameVa113c(0x6FCCEA40)
  void _nTargetX
  void _nTargetY
  void _dwArg4
  void _dwArg5
  return executePotionItemUseCommon(m, pGame, pUnit, pItem, 1)
}

/**
 * Healing / Mana potion item use callback: applies class potion multipliers (`ITEMS_ApplyClassLifePotionScale`,
 * `ITEMS_ApplyClassManaPotionScale`), rolls Vitality/Energy double-recovery chance, heals Blood Golem,
 * and applies instant or timed regeneration (`EVENT_REGEN` `3` / `EVENT_STATEREMOVE` `0x0C`).
 *
 * @va D2Game:0x6FCCEDC0
 */
export function ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pItem: number,
  _nTargetX = 0,
  _nTargetY = 0,
  _dwArg4 = 0,
  _dwArg5 = 0,
): number {
  hitD2GameVa113c(0x6FCCEDC0)
  void _nTargetX
  void _nTargetY
  void _dwArg4
  void _dwArg5
  return executePotionItemUseCommon(m, pGame, pUnit, pItem, 2)
}


/**
 * `SrvDoFunc` for monster Leap / Sand Leaper / Charge movement & landing (`0x6FCD60C0`):
 * clears `EVENT_ANIMEND` (`1`), executes impact combat events (`+0x4E == 2`), handles landing
 * (`flags & 0x100`) and baseId `0x4E` rebound leap, or initiates airborne path (`flags & 0x80`).
 *
 * @va D2Game:0x6FCD60C0
 */
export function SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nLevel = 0,
): number {
  hitD2GameVa113c(0x6FCD60C0)
  void _nSkillId
  void _nLevel
  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pUsedSkill === 0) return 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pPath === 0) return 0

  let pEv = m.u32((pUnit + 0xdc) >>> 0) >>> 0
  while (pEv !== 0) {
    const pNext = m.u32((pEv + 0x24) >>> 0) >>> 0
    if (m.u8(pEv) === 1) {
      EVENT_FreeNode113c(m, pGame >>> 0, pEv)
    }
    pEv = pNext
  }

  if (m.u8((pUnit + 0x4e) >>> 0) === 2) {
    m.setU8((pUnit + 0x4e) >>> 0, 0)
    const targetId = SKILLS_GetParam4113c(m, pUsedSkill) >>> 0
    const targetType = SKILLS_GetParam3113c(m, pUsedSkill) | 0
    const pTarget = SUNIT_GetServerUnit113c(m, pGame >>> 0, targetType, targetId) >>> 0
    if (pTarget !== 0) {
      SUNITDMG_ExecuteEvents113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 1, 0)
    }
    return 1
  }

  const flags = SKILLS_GetFlags113c(m, pUsedSkill) >>> 0
  const destX = SKILLS_GetParam1113c(m, pUsedSkill) | 0
  const destY = SKILLS_GetParam2113c(m, pUsedSkill) | 0

  if ((flags & 0x100) !== 0) {
    if (
      (UNIT_GetPosX113c(m, pUnit >>> 0) | 0) !== destX ||
      (UNIT_GetPosY113c(m, pUnit >>> 0) | 0) !== destY
    ) {
      const baseId = MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, pUnit >>> 0)) | 0
      const frame = baseId === 0x4e ? 8 : 0
      UNITS_SetSeqFrameFromLowByte113c(m, pUnit >>> 0, frame)
      m.setU32((pUnit + 0x48) >>> 0, ((m.u32((pUnit + 0x48) >>> 0) & 0xffffff00) + 0x100) >>> 0)
      return 1
    }

    SKILLS_SetParam0C113c(m, pUsedSkill, 0)
    MONSTER_RefreshAiEvent113c(m, pUnit >>> 0, 0)
    const collPat = PATH_GetUnitCollisionPattern113c(m, pUnit >>> 0) | 0
    const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
    COLLISION_ResetMaskWithPattern113c(m, pRoom, destX, destY, collPat, 0x100)
    PATH_SetCollisionMask113c(m, pPath, 0x100)
    PATH_SetMoveTestCollisionMask113c(m, pPath, 0x3c01)
    PATH_SetType113c(m, pPath, 0x65)

    const baseId = MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, pUnit >>> 0)) | 0
    if (baseId !== 0x4e) return 1

    const targetId = SKILLS_GetParam4113c(m, pUsedSkill) >>> 0
    const targetType = SKILLS_GetParam3113c(m, pUsedSkill) | 0
    const pTarget = SUNIT_GetServerUnit113c(m, pGame >>> 0, targetType, targetId) >>> 0
    if (pTarget === 0) return 1

    SKILLS_SetParam0C113c(m, pUsedSkill, 1)
    UNITS_SetSeqFrameFromLowByte113c(m, pUnit >>> 0, 0x0c)
    m.setU32((pUnit + 0x48) >>> 0, ((m.u32((pUnit + 0x48) >>> 0) & 0xffffff00) + 0x100) >>> 0)
    PATH_SnapToSubtileCenter113c(m, pPath)
    PATH_SetNewDistance113c(m, pPath, 5)
    PATH_SetStepNum113c(m, pPath, 1)
    PATH_SetTargetUnit113c(m, pPath, 0)
    const tx = UNIT_GetPosX113c(m, pTarget) | 0
    const ty = UNIT_GetPosY113c(m, pTarget) | 0
    const reboundX = (imul32(destX, 3) - (tx << 1)) | 0
    const reboundY = (imul32(destY, 3) - (ty << 1)) | 0
    PATH_SetTargetPos113c(m, pPath, reboundX, reboundY)
    PATH_SetType113c(m, pPath, 8)
    PATH_SetDistance113c(m, pPath, 5)
    PATH_Compute113c(m, pPath, pUnit >>> 0, 0)
    return 1
  }

  if ((flags & 0x80) !== 0) {
    SKILLS_SetParam0C113c(m, pUsedSkill, 0x101)
    PATH_SetMoveTestCollisionMask113c(m, pPath, 0)
    PATH_SetCollisionMask113c(m, pPath, 0)
    PATH_SetTargetPos113c(m, pPath, destX, destY)
    PATH_SetType113c(m, pPath, 9)
    const walkVel = SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c(m, pUnit >>> 0) | 0
    PATH_SetVelocity113c(m, pPath, walkVel, 0x6fd1b4e8, 0x282)
    PATH_Compute113c(m, pPath, pUnit >>> 0, 0)
    return 1
  }

  SKILLS_SetParam0C113c(m, pUsedSkill, 0)
  return 1
}

/**
 * Evaluates AI threat / target priority score with a `0x4B` (`75`) subtile tether threshold and
 * unconditional `STAT_COLDRESIST` (`0x2B`) weighting.
 *
 * @va D2Game:0x6FCD6DA0
 */
export function AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(
  m: D2KernMemory113c,
  pTetherCoords: number,
  pCandidateUnit: number,
  pAttackerUnit: number,
): number {
  hitD2GameVa113c(0x6FCD6DA0)
  const bInMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pAttackerUnit >>> 0, pCandidateUnit >>> 0, 0) | 0
  let tetherScore = 0
  if (pTetherCoords !== 0) {
    const tx = rdI32(m, (pTetherCoords + 0x0c) >>> 0)
    const ty = rdI32(m, (pTetherCoords + 0x10) >>> 0)
    if ((AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, pAttackerUnit >>> 0, tx, ty) | 0) > 0x4b) {
      const tx2 = rdI32(m, (pTetherCoords + 0x0c) >>> 0)
      const ty2 = rdI32(m, (pTetherCoords + 0x10) >>> 0)
      if ((AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, pCandidateUnit >>> 0, tx2, ty2) | 0) < 0x4b) {
        tetherScore = 0x64
      }
    }
  }

  const physRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x24, 0) | 0
  const fireRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x27, 0) | 0
  const ltngRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x29, 0) | 0
  const magicRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x25, 0) | 0
  const coldRes = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x2b, 0) | 0
  const resSum = (((coldRes + ltngRes) | 0) + (((physRes + magicRes * 2) | 0) << 2) + fireRes) | 0
  const resScore = Math.trunc(resSum / 15) | 0

  const maxDmg = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x16, 0) | 0
  const fireMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x31, 0) | 0
  const lightMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x33, 0) | 0
  const magicMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x35, 0) | 0
  const coldMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x37, 0) | 0
  const poisonMax = STATLIST_GetUnitStat113c(m, pCandidateUnit >>> 0, 0x3a, 0) | 0
  const dmgSum = ((poisonMax >> 8) + coldMax + magicMax + lightMax + fireMax + maxDmg) | 0
  const dmgScore = divPow2Trunc(dmgSum, 1)

  const coldStateScore = (STATES_CheckState113c(m, pCandidateUnit >>> 0, 0x0b) | 0) !== 0 ? 0x64 : 0
  const lowLifeScore = (STATLIST_GetUnitLifePercent113c(m, pCandidateUnit >>> 0) | 0) < 0x14 ? 0x64 : 0

  let rLvl = 0
  let lLvl = 0
  let rThreat = 0
  let lThreat = 0

  const pLeftSkill = UNITS_GetLeftSkill113c(m, pCandidateUnit >>> 0) >>> 0
  if (pLeftSkill !== 0) {
    lLvl = SKILLS_EvaluateSkillLevel113c(m, pCandidateUnit >>> 0, pLeftSkill, 1) | 0
    const skillId = SKILLS_GetSkillIdFromSkill113c(m, pLeftSkill, 0x6fd1b434, 0x75) | 0
    const pDataTables = getSgptDataTablesPtr(m)
    if (skillId >= 0 && pDataTables !== 0 && skillId < rdI32(m, (pDataTables + 0xba0) >>> 0)) {
      const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(skillId, 0x23c)) >>> 0
      if (pSkillsTxt !== 0) lThreat = m.u8((pSkillsTxt + 0x18e) >>> 0)
    }
  }

  const pRightSkill = UNITS_GetRightSkill113c(m, pCandidateUnit >>> 0) >>> 0
  if (pRightSkill !== 0) {
    rLvl = SKILLS_EvaluateSkillLevel113c(m, pCandidateUnit >>> 0, pRightSkill, 1) | 0
    const skillId = SKILLS_GetSkillIdFromSkill113c(m, pRightSkill, 0x6fd1b434, 0x7b) | 0
    const pDataTables = getSgptDataTablesPtr(m)
    if (skillId >= 0 && pDataTables !== 0 && skillId < rdI32(m, (pDataTables + 0xba0) >>> 0)) {
      const pSkillsTxt = (m.u32((pDataTables + 0xb98) >>> 0) + imul32(skillId, 0x23c)) >>> 0
      if (pSkillsTxt !== 0) rThreat = m.u8((pSkillsTxt + 0x18e) >>> 0)
    }
  }

  const skillScore = divPow2Trunc((imul32(rThreat, rLvl) + imul32(lThreat, lLvl)) | 0, 2)

  let proxScore = 0
  if (bInMelee !== 0) {
    proxScore = 0x64
  } else if ((UNITS_HasCollisionBetweenUnits113c(m, pAttackerUnit >>> 0, pCandidateUnit >>> 0, 4) | 0) === 0) {
    proxScore = 0x4b
  }

  if (pCandidateUnit !== 0 && rdI32(m, pCandidateUnit >>> 0) === 1) {
    const classId = rdI32(m, (pCandidateUnit + 0x04) >>> 0)
    const pDataTables = getSgptDataTablesPtr(m)
    if (classId < 0 || pDataTables === 0 || classId >= rdI32(m, (pDataTables + 0xa80) >>> 0)) {
      return 0
    }
    const pMonStatsTxt = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(classId, 0x1a8)) >>> 0
    if (pMonStatsTxt === 0 || m.u8((pMonStatsTxt + 0x4e) >>> 0) <= 1) {
      return 0
    }
  }

  const weighted =
    (imul32(lowLifeScore, 3) +
      resScore +
      imul32((tetherScore + proxScore) | 0, 5) +
      imul32((skillScore + coldStateScore * 2 + dmgScore) | 0, 2)) |
    0
  const quotient = Math.trunc(weighted / 22) | 0
  return quotient === 0 ? 1 : quotient
}


/**
 * Attempts to spawn Baal's Festering Appendage / clone minion (`0x23A`) near the current path
 * target with `1/3` of Baal's current/max HP, `0` HP regen, and `State 98` transform linkage.
 *
 * @va D2Game:0x6FCD7D30
 */
export function AIBAAL_TrySpawnBaalClone_6FCD7D30_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pAiControl: number,
): number {
  hitD2GameVa113c(0x6FCD7D30)
  const sp = allocScratch(m, 0x20)
  try {
    const pSelfPtr = sp
    const pOutCount = (sp + 0x04) >>> 0
    m.setU32(pSelfPtr, pUnit >>> 0)
    m.setU32(pOutCount, 0)
    AIGENERAL_ForEachPackMember_6FC41490_113c(
      m,
      pUnit >>> 0,
      AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c,
      pSelfPtr,
      pOutCount,
    )
    if (rdI32(m, pOutCount) !== 0) return 0

    if (pUnit !== 0 && ((m.u32((pUnit + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
      const pOwner =
        SUNIT_GetServerUnit113c(
          m,
          pGame >>> 0,
          rdI32(m, (pUnit + 0x94) >>> 0),
          m.u32((pUnit + 0x98) >>> 0),
        ) >>> 0
      if (pOwner !== 0 && (SUNIT_IsDeadOrDying113c(m, pOwner) | 0) === 0) {
        return 0
      }
    }

    const pDataTables = getSgptDataTablesPtr(m)
    const monStatsCnt = pDataTables !== 0 ? rdI32(m, (pDataTables + 0xa80) >>> 0) : 0
    const baseCloneId = monStatsCnt > 0x23a ? 0x23a : -1
    const pOutClassId = (sp + 0x08) >>> 0
    const pOutX = (sp + 0x0c) >>> 0
    const pOutY = (sp + 0x10) >>> 0
    const pOutSpawnCount = (sp + 0x14) >>> 0
    m.setU32(pOutClassId, baseCloneId >>> 0)
    m.setU32(pOutSpawnCount, 1)
    UNITS_GetMonsterSplitSpawnParams113c(
      m,
      pUnit >>> 0,
      pOutClassId,
      pOutX,
      pOutY,
      pOutSpawnCount,
      m.u8((pGame + 0x6d) >>> 0),
      0,
    )

    SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
    const pTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
    const pRefUnit = pTarget !== (pUnit >>> 0) && pTarget !== 0 ? pTarget : pUnit >>> 0
    const baseX = getUnitSubtileXInline(m, pRefUnit)
    const baseY = getUnitSubtileYInline(m, pRefUnit)

    const rx = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 0x18) | 0
    const ry = ((stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 0x18) | 0
    const spawnX = (baseX + rx - 0x0c) | 0
    const spawnY = (baseY + ry - 0x0c) | 0

    const pDestRoom =
      ROOM_FindRoomContainingSubtile113c(m, UNITS_GetRoom113c(m, pUnit >>> 0), spawnX, spawnY) >>> 0
    if (pDestRoom === 0) return 0
    ROOM_FindRoomContainingSubtile113c(m, UNITS_GetRoom113c(m, pUnit >>> 0), spawnX, spawnY)

    const pClone =
      MONSTER_SpawnAtCoords113c(
        m,
        rdI32(m, pOutClassId),
        rdI32(m, pOutSpawnCount),
        pGame >>> 0,
        pDestRoom,
        spawnX,
        spawnY,
        -1,
        0,
      ) >>> 0
    if (pClone === 0) return 0

    m.setU32((pClone + 0xc4) >>> 0, (m.u32((pClone + 0xc4) >>> 0) | 0x04020000) >>> 0)
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pClone, 0x0f)

    const bossType = m.u32(pUnit >>> 0) >>> 0
    const bossId = m.u32((pUnit + 0x0c) >>> 0) >>> 0
    if ((bossType | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
      if (pAiGen !== 0) {
        m.setU16((pAiGen + 0x08) >>> 0, (m.u16((pAiGen + 0x08) >>> 0) | 1) & 0xffff)
        m.setU32((pAiGen + 0x2c) >>> 0, bossId)
        m.setU32((pAiGen + 0x30) >>> 0, bossType)
        m.setU32((pAiGen + 0x28) >>> 0, pDestRoom)
      }
    }

    AIGENERAL_LinkMinionToLeader113c(m, pUnit >>> 0, pClone, pGame >>> 0)

    if (rdI32(m, pClone) === 1) {
      const pCloneData = m.u32((pClone + 0x14) >>> 0) >>> 0
      const pCloneAiGen = pCloneData !== 0 ? m.u32((pCloneData + 0x28) >>> 0) >>> 0 : 0
      if (pCloneAiGen !== 0) {
        m.setU16((pCloneAiGen + 0x08) >>> 0, (m.u16((pCloneAiGen + 0x08) >>> 0) | 1) & 0xffff)
        m.setU32((pCloneAiGen + 0x2c) >>> 0, m.u32((pUnit + 0x0c) >>> 0))
        m.setU32((pCloneAiGen + 0x30) >>> 0, m.u32(pUnit >>> 0))
        m.setU32((pCloneAiGen + 0x28) >>> 0, pDestRoom)
      }
    }

    const maxHpDiv3 = Math.trunc((STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0) / 3) | 0
    STATLIST_SetUnitStat113c(m, pClone, 7, maxHpDiv3, 0)
    const curHpDiv3 = Math.trunc((STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0) / 3) | 0
    STATLIST_SetUnitStat113c(m, pClone, 6, curHpDiv3, 0)
    STATLIST_SetUnitStat113c(m, pClone, 0x4a, 0, 0)

    STATES_UpdateOrClearState98Transform113c(m, pClone, pUnit >>> 0)
    STATES_UpdateOrClearState98Transform113c(m, pUnit >>> 0, pClone)
    SUNIT_SetUnitEventSound113c(m, pUnit >>> 0, 0x10, 0)
    m.setU32((pAiControl + 0x18) >>> 0, (rdI32(m, (pAiControl + 0x18) >>> 0) + 1) >>> 0)
    return 1
  } finally {
    freeScratch(m, 0x20)
  }
}

function findObjectByGuidInGameHash(m: D2KernMemory113c, pGame: number, guid: number): number {
  let pCur = m.u32((pGame + 0x1520 + ((guid & 0x7f) << 2)) >>> 0) >>> 0
  while (pCur !== 0) {
    if ((m.u32((pCur + 0x0c) >>> 0) >>> 0) === (guid >>> 0)) return pCur
    pCur = m.u32((pCur + 0xe4) >>> 0) >>> 0
  }
  return 0
}

function allocAndPlaceQuestObject(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  nObjClassId: number,
  nInitMode: number,
  x: number,
  y: number,
): number {
  const pObj = UNIT_Alloc113c(m, 2) >>> 0
  if (pObj === 0) return 0
  m.setU32(pObj, 2)
  m.setU32((pObj + 0x04) >>> 0, nObjClassId >>> 0)
  m.setU32((pObj + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0))
  m.setU32((pObj + 0x80) >>> 0, pGame >>> 0)
  let flags2 = m.u32((pObj + 0xc8) >>> 0) >>> 0
  if (rdI32(m, (pGame + 0x70) >>> 0) !== 0) {
    flags2 = (flags2 | 0x02000000) >>> 0
  } else {
    flags2 = (flags2 & 0xfdffffff) >>> 0
  }
  m.setU32((pObj + 0xc8) >>> 0, (flags2 | 0x04000000) >>> 0)
  const actNo =
    DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom >>> 0)) & 0xff
  m.setU8((pObj + 0x18) >>> 0, actNo)
  m.setU32((pObj + 0x1c) >>> 0, m.u32((pGame + 0xbc + actNo * 4) >>> 0))
  m.setU32((pObj + 0x74) >>> 0, 0)
  SUNIT_InitUnitSeed113c(m, pObj, (pGame + 0xd0) >>> 0)
  m.setU32((pObj + 0xc4) >>> 0, (m.u32((pObj + 0xc4) >>> 0) | 0x10) >>> 0)
  m.setU32((pObj + 0xd0) >>> 0, 0x0b)
  let guid = (m.u32((pGame + 0x98) >>> 0) + 1) >>> 0
  if (guid === 0xffffffff) guid = 1
  m.setU32((pGame + 0x98) >>> 0, guid)
  const pObjData = m.alloc(0x38) >>> 0
  m.fill(pObjData, 0x38, 0)
  m.setU32((pObj + 0x14) >>> 0, pObjData)
  m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, nObjClassId) >>> 0)
  m.setU32((pObj + 0x10) >>> 0, nInitMode >>> 0)
  UNITS_AllocStaticPath113c(m, pObj)
  OBJECTS_InitObjectUnit113c(m, pObj, pGame >>> 0, guid, pRoom >>> 0, x | 0, y | 0)
  SUNIT_PlaceServerUnitInRoom113c(m, pRoom >>> 0, y | 0, pObj, x | 0, pGame >>> 0, 1)
  return pObj
}

/**
 * Spawns Act 5 Quest 3/4 red portal object `0x13E` at `(x - 2, y - 1)` relative to `pUnit`,
 * falling back to `(x - 2, y)` if the first allocation fails, and records its GUID at `+0x38`.
 *
 * @va D2Game:0x6FCE8CD0
 */
export function A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE8CD0)
  const pQuestState = m.u32((pQuestArg + 0x18) >>> 0) >>> 0
  const sp = allocScratch(m, 0x10)
  try {
    m.fill(sp, 0x10, 0)
    PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, sp)
    if (m.u8((pQuestState + 0x0e) >>> 0) !== 0 || m.u8((pQuestState + 0x11) >>> 0) !== 0) {
      return
    }
    m.setU16((pQuestState + 0x40) >>> 0, 0)
    const origX = rdI32(m, sp)
    const origY = rdI32(m, (sp + 0x04) >>> 0)
    const spawnX = (origX - 2) | 0
    const spawnY1 = (origY - 1) | 0
    m.setU32((pQuestState + 0x20) >>> 0, spawnX >>> 0)
    m.setU32((pQuestState + 0x24) >>> 0, spawnY1 >>> 0)

    const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
    const pGame = m.u32((pQuestArg + 0x04) >>> 0) >>> 0
    let pObj = allocAndPlaceQuestObject(m, pGame, pRoom, 0x13e, 0, spawnX, spawnY1)
    if (pObj === 0) {
      m.setU32((pQuestState + 0x24) >>> 0, origY >>> 0)
      const pRoom2 = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
      const pGame2 = m.u32((pQuestArg + 0x04) >>> 0) >>> 0
      pObj = allocAndPlaceQuestObject(
        m,
        pGame2,
        pRoom2,
        0x13e,
        0,
        rdI32(m, (pQuestState + 0x20) >>> 0),
        rdI32(m, (pQuestState + 0x24) >>> 0),
      )
      if (pObj === 0) return
    }
    m.setU32((pObj + 0xc4) >>> 0, (m.u32((pObj + 0xc4) >>> 0) | 0x03000000) >>> 0)
    m.setU8((pQuestState + 0x11) >>> 0, 1)
    m.setU32((pQuestState + 0x38) >>> 0, m.u32((pObj + 0x0c) >>> 0))
  } finally {
    freeScratch(m, 0x10)
  }
}

/**
 * Opens/activates Act 5 Nihlathak Temple quest portal objects (`+0x28` and object `0x64` near `+0x20`),
 * scheduling `EVENT_ANIMEND` (`1`) and toggling `DUNGEON_ToggleHasPortalFlag` on both rooms.
 *
 * @va D2Game:0x6FCE94E0
 */
export function A5Q4_OpenTemplePortalObject_6FCE94E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCE94E0)
  const pQuestState = m.u32((pQuestArg + 0x18) >>> 0) >>> 0
  let nChanged = 0

  if (m.u8((pQuestState + 0x0d) >>> 0) === 1) {
    if (m.u8((pQuestState + 0x06) >>> 0) !== 0) {
      if (pGame === 0) throw new D2CommonAssertError('A5Q4.cpp', 0x2d3)
      const pObj28 = findObjectByGuidInGameHash(
        m,
        pGame >>> 0,
        m.u32((pQuestState + 0x28) >>> 0),
      )
      if (pObj28 !== 0) {
        nChanged = 1
        if (rdI32(m, (pObj28 + 0x10) >>> 0) === 0) {
          if (m.u8((pQuestState + 0x0c) >>> 0) !== 0) {
            UNITS_ChangeAnimMode113c(m, pObj28, 2)
          } else {
            UNITS_ChangeAnimMode113c(m, pObj28, 1)
            const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, rdI32(m, (pObj28 + 0x04) >>> 0)) >>> 0
            const frameDelta = m.u32((pObjTxt + 0xdc) >>> 0) >>> 8
            const pArgGame = m.u32((pQuestArg + 0x04) >>> 0) >>> 0
            EVENT_SetEventFull113c(
              m,
              pArgGame,
              pObj28,
              1,
              (rdI32(m, (pArgGame + 0xa8) >>> 0) + frameDelta) | 0,
              0,
              0,
              0,
            )
          }
        }
      }
    }

    if (m.u8((pQuestState + 0x04) >>> 0) !== 0) {
      if (pGame === 0) throw new D2CommonAssertError('A5Q4.cpp', 0x2d3)
      const pAnchor = findObjectByGuidInGameHash(
        m,
        pGame >>> 0,
        m.u32((pQuestState + 0x20) >>> 0),
      )
      if (pAnchor !== 0) {
        const px = (UNIT_GetPosX113c(m, pAnchor) - 0x0d) | 0
        const py = (UNIT_GetPosY113c(m, pAnchor) + 3) | 0
        const pDestRoom =
          ROOM_FindRoomContainingSubtile113c(m, UNITS_GetRoom113c(m, pAnchor), px, py) >>> 0
        if (pDestRoom !== 0) {
          const pPortal = allocAndPlaceQuestObject(m, pGame >>> 0, pDestRoom, 0x64, 1, px, py)
          if (pPortal !== 0) {
            nChanged = (nChanged + 1) | 0
            if (m.u8((pQuestState + 0x0c) >>> 0) !== 0) {
              UNITS_ChangeAnimMode113c(m, pPortal, 2)
            } else {
              UNITS_ChangeAnimMode113c(m, pPortal, 1)
              DUNGEON_ToggleHasPortalFlag113c(m, UNITS_GetRoom113c(m, pAnchor), 1)
              DUNGEON_ToggleHasPortalFlag113c(m, pDestRoom, 1)
            }
          }
        }
      }
    }

    if (nChanged === 0) return 0
    m.setU8((pQuestState + 0x0b) >>> 0, 1)
    m.setU8((pQuestState + 0x0d) >>> 0, 0)
  }

  m.setU8((pQuestState + 0x03) >>> 0, 0)
  return 1
}


function cStrCaseInsensitiveCmp(
  m: D2KernMemory113c,
  pStr1: number,
  pStr2: number,
  maxLen: number,
): number {
  const limit = maxLen >>> 0
  for (let i = 0; i < limit; i++) {
    let c1 = m.u8((pStr1 + i) >>> 0)
    let c2 = m.u8((pStr2 + i) >>> 0)
    if (c1 >= 0x41 && c1 <= 0x5a) c1 += 0x20
    if (c2 >= 0x41 && c2 <= 0x5a) c2 += 0x20
    if (c1 !== c2) return c1 < c2 ? -1 : 1
    if (c1 === 0) return 0
  }
  return 0
}

function monStatsHasRangedSpawnFlag0FBit4(m: D2KernMemory113c, monId: number): boolean {
  if (monId < 0) return false
  const pDataTables = getSgptDataTablesPtr(m)
  if (pDataTables === 0 || monId >= rdI32(m, (pDataTables + 0xa80) >>> 0)) return false
  const pMonStats = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(monId, 0x1a8)) >>> 0
  if (pMonStats === 0) return false
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0
  return (m.u8((pMonStats + 0x0f) >>> 0) & m.u8((pMasks + 0x10) >>> 0)) !== 0
}

/**
 * Selects up to `min(13, nNumMon, poolSize)` unique monster species from `Levels.txt` (`+0x36`
 * normal or `+0x68` nightmare/hell guest array), preferring ranged-spawn (`+0x0F` bit 4) on the
 * first slot when `pLevelsTxt->bRangedSpawn` (`+0x31`) is set, and populates `pMonsterRegion`.
 *
 * @va D2Game:0x6FCEA760
 */
export function MONREG_SelectRegionMonsterTypes_6FCEA760_113c(
  m: D2KernMemory113c,
  bUseAltMonTable: number,
  pSeed: number,
  pLevelsTxt: number,
  pMonsterRegion: number,
): void {
  hitD2GameVa113c(0x6FCEA760)
  let nToPick = m.u8((pLevelsTxt + 0x32) >>> 0)
  if (nToPick > 0x0d) nToPick = 0x0d

  let nPoolCount =
    bUseAltMonTable !== 0 ? m.u8((pLevelsTxt + 0x34) >>> 0) : m.u8((pLevelsTxt + 0x33) >>> 0)
  if (nToPick > nPoolCount) nToPick = nPoolCount

  let pOutEntry = (pMonsterRegion + 0x14) >>> 0
  const copyCount =
    bUseAltMonTable !== 0 ? m.u8((pLevelsTxt + 0x34) >>> 0) : m.u8((pLevelsTxt + 0x33) >>> 0)
  const srcBase =
    bUseAltMonTable !== 0 ? ((pLevelsTxt + 0x68) >>> 0) : ((pLevelsTxt + 0x36) >>> 0)

  const pool = new Int16Array(32)
  if (copyCount > 0) {
    for (let i = 0; i < copyCount && i < 32; i++) {
      pool[i] = sx16(m.u16((srcBase + i * 2) >>> 0))
    }
  }

  for (let pickIdx = 0; pickIdx < nToPick; pickIdx++) {
    if (nPoolCount <= 0) break
    let chosenIdx = rollSeedInlineMod113c(m, pSeed >>> 0, nPoolCount) | 0
    let monId = pool[chosenIdx]! | 0

    if (pickIdx === 0 && m.u8((pLevelsTxt + 0x31) >>> 0) !== 0) {
      for (let attempt = 0; attempt < 20; attempt++) {
        if (monStatsHasRangedSpawnFlag0FBit4(m, monId)) break
        chosenIdx = rollSeedInlineMod113c(m, pSeed >>> 0, nPoolCount) | 0
        monId = pool[chosenIdx]! | 0
      }
    }

    nPoolCount = (nPoolCount - 1) | 0
    if (chosenIdx < nPoolCount) {
      for (let k = chosenIdx; k < nPoolCount; k++) {
        pool[k] = pool[k + 1]!
      }
    }

    if (monId >= 0) {
      const pDataTables = getSgptDataTablesPtr(m)
      if (pDataTables !== 0 && monId < rdI32(m, (pDataTables + 0xa80) >>> 0)) {
        const pMonStats = (m.u32((pDataTables + 0xa78) >>> 0) + imul32(monId, 0x1a8)) >>> 0
        const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0
        if (pMonStats !== 0 && (m.u8((pMonStats + 0x0c) >>> 0) & m.u8(pMasks)) !== 0) {
          m.setU16(pOutEntry, monId & 0xffff)
          const rarity = m.u8((pMonStats + 0x2e) >>> 0)
          m.setU8((pOutEntry + 0x02) >>> 0, rarity)
          m.setU8(
            (pMonsterRegion + 0x11) >>> 0,
            (m.u8((pMonsterRegion + 0x11) >>> 0) + rarity) & 0xff,
          )
          m.setU8((pMonsterRegion + 0x12) >>> 0, (m.u8((pMonsterRegion + 0x12) >>> 0) + 1) & 0xff)
          m.setU8((pMonsterRegion + 0x10) >>> 0, (m.u8((pMonsterRegion + 0x10) >>> 0) + 1) & 0xff)
          pOutEntry = (pOutEntry + 0x34) >>> 0
        }
      }
    }
  }
}

/**
 * Validates sender name and mute/squelch party flags (`0x04` / `0x02`) before forwarding chat
 * message `0x26` (`NET_SendPacket26_ChatMessage_6FCAB470_113c`) to `pClient`.
 *
 * @va D2Game:0x6FCECA00
 */
export function PACKET_DeliverChatIfNotSquelched_6FCECA00_113c(
  m: D2KernMemory113c,
  pClient: number,
  pChatDesc: number,
): void {
  hitD2GameVa113c(0x6FCECA00)
  if (pClient === 0) throw new D2CommonAssertError('Packet.cpp', 0x996)
  const pRawPkt = m.u32((pChatDesc + 0x04) >>> 0) >>> 0
  const pChatMsg = m.u32(pChatDesc >>> 0) >>> 0
  const pGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0

  if (cStrCaseInsensitiveCmp(m, (pClient + 0x0d) >>> 0, (pRawPkt + 0x103) >>> 0, 0x7fffffff) !== 0) {
    return
  }

  const senderGuid = m.u32((pChatDesc + 0x08) >>> 0) >>> 0
  if ((senderGuid | 0) !== -1) {
    if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x2d3)
    let pSenderUnit = 0
    let pCur = m.u32((pGame + 0x1120 + ((senderGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pCur !== 0) {
      if ((m.u32((pCur + 0x0c) >>> 0) >>> 0) === senderGuid) {
        pSenderUnit = pCur
        break
      }
      pCur = m.u32((pCur + 0xe4) >>> 0) >>> 0
    }
    const pDestUnit = CLIENTS_GetPlayerUnit113c(m, pClient >>> 0, 0) >>> 0
    if (pSenderUnit !== 0 && pDestUnit !== 0) {
      if (
        (PARTY_TestPlayerRelationFlags113c(m, pSenderUnit, pDestUnit, 4) | 0) !== 0 ||
        (PARTY_TestPlayerRelationFlags113c(m, pDestUnit, pSenderUnit, 2) | 0) !== 0
      ) {
        m.setU32(0x6fd301e0, 1)
        return
      }
    }
  }

  m.setU32(0x6fd301e4, 1)
  NET_SendPacket26_ChatMessage_6FCAB470_113c(m, pChatMsg, pClient >>> 0)
}

/**
 * Validates C2S `0x49` waypoint object interaction: verifies object existence, same Act, range
 * (`0x16` for Sorceress Telekinesis, `0x0A` otherwise), and unlocked destination waypoint state.
 *
 * @va D2Game:0x6FCECB50
 */
export function C2S_ValidateWaypointInteraction_6FCECB50_113c(
  m: D2KernMemory113c,
  dwObjectGuid: number,
  pGame: number,
  pPlayer: number,
  wDestLevelId: number,
): number {
  hitD2GameVa113c(0x6FCECB50)
  if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x2d3)
  const pObj = findObjectByGuidInGameHash(m, pGame >>> 0, dwObjectGuid >>> 0)
  if (pObj === 0) return 1

  const plrAct =
    DRLG_GetActNoFromLevelId113c(
      m,
      DUNGEON_GetLevelIdFromRoom113c(m, UNITS_GetRoom113c(m, pPlayer >>> 0)),
    ) & 0xff
  const objAct =
    DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, UNITS_GetRoom113c(m, pObj))) &
    0xff
  if (plrAct !== objAct) return 2

  const ox = getUnitSubtileXInline(m, pObj)
  const oy = getUnitSubtileYInline(m, pObj)
  const maxDelta = pPlayer !== 0 && rdI32(m, (pPlayer + 0x04) >>> 0) === 1 ? 0x16 : 0x0a
  const deltaErr = C2S_CheckCoordDeltaExceeded113c(m, pPlayer >>> 0, ox, oy, maxDelta) | 0
  if (deltaErr !== 0) return deltaErr

  const destLevel = wDestLevelId & 0xffff
  if (destLevel === 0) return 0

  const pDataTables = getSgptDataTablesPtr(m)
  if (pDataTables === 0 || destLevel >= rdI32(m, (pDataTables + 0xc5c) >>> 0)) return 3
  if ((UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('Packet.cpp', 0x5fb)
  }

  const sp = allocScratch(m, 8)
  try {
    m.setU32(sp, 0)
    if ((WAYPOINT_GetWaypointNoFromLevelId113c(m, destLevel, sp) | 0) === 0) {
      return 3
    }
    const wpNo = rdI32(m, sp)
    const pWpData = PLAYER_GetWaypointDataForDifficulty_6FC21720_113c(m, pPlayer >>> 0, pGame >>> 0) >>> 0
    return (WAYPOINT_GetWaypointState113c(m, pWpData, wpNo) | 0) !== 0 ? 0 : 2
  } finally {
    freeScratch(m, 8)
  }
}

/**
 * Validates C2S NPC monster interaction: resolves `dwMonsterGuid` into `*ppOutMonster`, verifies
 * valid monster data (`+0x30`), same Act, and optional `<= 10` subtile distance.
 *
 * @va D2Game:0x6FCECCF0
 */
export function C2S_ValidateNpcMonsterInteract_6FCECCF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwMonsterGuid: number,
  ppOutMonster: number,
  pPlayer: number,
  bCheckDist: number,
): number {
  hitD2GameVa113c(0x6FCECCF0)
  if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x2d3)
  const pMonster = findMonsterByGuidInGameHash(m, pGame >>> 0, dwMonsterGuid >>> 0)
  m.setU32(ppOutMonster >>> 0, pMonster >>> 0)
  if (pMonster === 0) return 1

  const pMonData = rdI32(m, pMonster) === 1 ? m.u32((pMonster + 0x14) >>> 0) >>> 0 : 0
  if (pMonData === 0 || m.u32((pMonData + 0x30) >>> 0) === 0) {
    return 3
  }

  const actErr = PACKET_CheckUnitsInDifferentActs113c(m, pPlayer >>> 0, pMonster) | 0
  if (actErr !== 0) return actErr

  if (bCheckDist !== 0) {
    const pMonRef = m.u32(ppOutMonster >>> 0) >>> 0
    const mx = UNIT_GetPosX113c(m, pMonRef) | 0
    const my = UNIT_GetPosY113c(m, pMonRef) | 0
    const distErr = C2S_CheckCoordDeltaExceeded113c(m, pPlayer >>> 0, mx, my, 0x0a) | 0
    if (distErr !== 0) return distErr
  }
  return 0
}

function findItemByGuidInGameHash(m: D2KernMemory113c, pGame: number, guid: number): number {
  let pCur = m.u32((pGame + 0x1720 + ((guid & 0x7f) << 2)) >>> 0) >>> 0
  while (pCur !== 0) {
    if ((m.u32((pCur + 0x0c) >>> 0) >>> 0) === (guid >>> 0)) return pCur
    pCur = m.u32((pCur + 0xe4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Validates that `dwItemGuid` exists in `pGame`, has `dwAnimMode == 2` (`ITEMMODE_INBELT`), and
 * belongs to `pPlayer->pInventory` (`+0x60`), returning `0` if valid or `1` on failure.
 *
 * @va D2Game:0x6FCECDB0
 */
export function C2S_ValidateBeltItemOwnership_6FCECDB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwItemGuid: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCECDB0)
  if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x4b3)
  const pItem = findItemByGuidInGameHash(m, pGame >>> 0, dwItemGuid >>> 0)
  if (pItem === 0 || rdI32(m, (pItem + 0x10) >>> 0) !== 2) return 1
  const pInv = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  return (INVENTORY_IsItemOwnedByInventory113c(m, pInv, pItem) | 0) !== 0 ? 0 : 1
}


/**
 * Validates that `dwItemGuid` exists in `pGame` and is either in `pPlayer->pInventory` (`+0x60`)
 * or currently held on `pPlayer`'s cursor (`INVENTORY_GetCursorItem`), returning `0` if valid or `1`.
 *
 * @va D2Game:0x6FCECE20
 */
export function C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwItemGuid: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCECE20)
  if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x473)
  const pItem = findItemByGuidInGameHash(m, pGame >>> 0, dwItemGuid >>> 0)
  if (pItem === 0) return 1
  const pInv = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  if ((INVENTORY_IsItemOwnedByInventory113c(m, pInv, pItem) | 0) !== 0) return 0
  const pCursor = INVENTORY_GetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0)) >>> 0
  return pCursor === pItem ? 0 : 1
}

/**
 * Validates that `dwItemGuid` exists in `pGame`, has `dwAnimMode` `0` (`STORED`) or `1` (`EQUIP`),
 * and belongs to `pPlayer->pInventory`, returning `0` if valid or `1` on failure.
 *
 * @va D2Game:0x6FCECE90
 */
export function C2S_ValidateStoredOrEquippedItem_6FCECE90_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwItemGuid: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCECE90)
  if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x45c)
  const pItem = findItemByGuidInGameHash(m, pGame >>> 0, dwItemGuid >>> 0)
  if (pItem === 0) return 1
  const mode = rdI32(m, (pItem + 0x10) >>> 0)
  if (mode !== 0 && mode !== 1) return 1
  const pInv = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  return (INVENTORY_IsItemOwnedByInventory113c(m, pInv, pItem) | 0) !== 0 ? 0 : 1
}

/**
 * Validates that `dwItemGuid` exists in `pGame`, has `dwAnimMode == 0` (`ITEMMODE_STORED`), and
 * belongs to `pPlayer->pInventory`, returning `0` if valid or `1` on failure.
 *
 * @va D2Game:0x6FCECF00
 */
export function C2S_ValidateStoredItem_6FCECF00_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwItemGuid: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCECF00)
  if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x445)
  const pItem = findItemByGuidInGameHash(m, pGame >>> 0, dwItemGuid >>> 0)
  if (pItem === 0 || rdI32(m, (pItem + 0x10) >>> 0) !== 0) return 1
  const pInv = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  return (INVENTORY_IsItemOwnedByInventory113c(m, pInv, pItem) | 0) !== 0 ? 0 : 1
}

/**
 * Validates that `dwItemGuid` exists in `pGame`, has `dwAnimMode == 4` (`ITEMMODE_ONCURSOR`), and
 * matches `INVENTORY_GetCursorItem(pPlayer->pInventory)`, returning `0` if valid or `1` on failure.
 *
 * @va D2Game:0x6FCECF70
 */
export function C2S_ValidateCursorItem_6FCECF70_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwItemGuid: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCECF70)
  if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x42e)
  const pItem = findItemByGuidInGameHash(m, pGame >>> 0, dwItemGuid >>> 0)
  if (pItem === 0 || rdI32(m, (pItem + 0x10) >>> 0) !== 4) return 1
  const pCursor = INVENTORY_GetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0)) >>> 0
  return pCursor === pItem ? 0 : 1
}

const SYNC_OTHER_CLIENT_BASE_STATS_6FD22DD0: readonly number[] = [67, 68, 12, 0, 2, -1]

function resolveClientPlayerUnitInline(m: D2KernMemory113c, pClient: number): number {
  if ((m.u8((pClient + 0x3d4) >>> 0) & 1) !== 0) {
    return m.u32((pClient + 0x174) >>> 0) >>> 0
  }
  if (m.u32((pClient + 0x174) >>> 0) === 0) {
    return 0
  }
  const pFound =
    SUNIT_GetServerUnit113c(
      m,
      m.u32((pClient + 0x1a8) >>> 0),
      rdI32(m, (pClient + 0x16c) >>> 0),
      m.u32((pClient + 0x170) >>> 0),
    ) >>> 0
  if (pFound === 0) {
    m.setU32((pClient + 0x174) >>> 0, 0)
  }
  return pFound
}

/**
 * Sends `pPlayerUnit`'s base stats (`67`, `68`, `12`, `0`, `2` from `0x6FD22DD0`) to `pClient`'s
 * player unit when `pClient`'s player differs from `pPlayerUnit`.
 *
 * @va D2Game:0x6FCED0E0
 */
export function PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c(
  m: D2KernMemory113c,
  pClient: number,
  pPlayerUnit: number,
): void {
  hitD2GameVa113c(0x6FCED0E0)
  if (pClient === 0) throw new D2CommonAssertError('PlrModes.cpp', 0xfb)
  const pClientPlayer = resolveClientPlayerUnitInline(m, pClient >>> 0)
  if (pClientPlayer === (pPlayerUnit >>> 0)) return

  const useMemTable = (readOptionalGlobalU32(m, 0x6fd22dd0, 0) | 0) !== 0
  let idx = 0
  while (true) {
    const statId = useMemTable
      ? (readOptionalGlobalU32(m, (0x6fd22dd0 + idx * 4) >>> 0, 0xffffffff) | 0)
      : (idx < SYNC_OTHER_CLIENT_BASE_STATS_6FD22DD0.length
          ? SYNC_OTHER_CLIENT_BASE_STATS_6FD22DD0[idx]!
          : -1)
    if (statId === -1) break
    const baseVal = STATLIST_GetUnitBaseStat113c(m, pPlayerUnit >>> 0, statId, 0) | 0
    D2GAME_PLRMODES_SendStatToClientOrParty113c(
      m,
      pPlayerUnit >>> 0,
      statId,
      pClientPlayer,
      baseVal,
    )
    idx++
  }
}


const PLAYER_MODE_P0D_ACTION_BYTE_6FD22CE4: readonly number[] = [
  8, 7, 1, 23, 6, 7, 1, 21, 21, 18, 21, 21, 21, 21, 21, 21, 21, 9, 21,
]

function sendPacket0DPlayerStop6FCEB950(
  m: D2KernMemory113c,
  pUnit: number,
  pClient: number,
  nPlayerMode: number,
): void {
  const hitClass = m.u8((pUnit + 0xb0) >>> 0)
  hitD2GameVa113c(0x6FCEB950)
  const modeIdx = nPlayerMode | 0
  let actionByte = 0
  const memVal = readOptionalGlobalU32(m, (0x6fd22ce4 + modeIdx * 12) >>> 0, 0)
  if (memVal !== 0) {
    actionByte = memVal & 0xff
  } else if (modeIdx >= 0 && modeIdx < PLAYER_MODE_P0D_ACTION_BYTE_6FD22CE4.length) {
    actionByte = PLAYER_MODE_P0D_ACTION_BYTE_6FD22CE4[modeIdx]! & 0xff
  }
  const lifePct = STATLIST_GetUnitLifePercent113c(m, pUnit >>> 0) & 0xff
  const uy = getUnitSubtileYInline(m, pUnit >>> 0) & 0xffff
  const ux = getUnitSubtileXInline(m, pUnit >>> 0) & 0xffff
  const unitId = m.u32((pUnit + 0x0c) >>> 0) >>> 0

  const sp = allocScratch(m, 0x10)
  try {
    m.fill(sp, 0x10, 0)
    m.setU8(sp, 0x0d)
    m.setU8((sp + 0x01) >>> 0, 0)
    m.setU32((sp + 0x02) >>> 0, unitId)
    m.setU8((sp + 0x06) >>> 0, actionByte)
    m.setU16((sp + 0x07) >>> 0, ux)
    m.setU16((sp + 0x09) >>> 0, uy)
    m.setU8((sp + 0x0b) >>> 0, hitClass)
    m.setU8((sp + 0x0c) >>> 0, lifePct)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, sp, 0x0d)
  } finally {
    freeScratch(m, 0x10)
  }
}

/**
 * Queues S2C `0x0D` (`PLAYER_STOP`) for `(pUnit, nPlayerMode)` to `pClient` (`0x6FCEB950`), and
 * when `pClient`'s own player unit is `pUnit`, syncs stat `0xAF` (`175`) via `0x6FCEC2F0`.
 *
 * @va D2Game:0x6FCED2C0
 */
export function PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pClient: number,
  nPlayerMode: number,
): void {
  hitD2GameVa113c(0x6FCED2C0)
  sendPacket0DPlayerStop6FCEB950(m, pUnit >>> 0, pClient >>> 0, nPlayerMode | 0)
  if (pClient === 0) throw new D2CommonAssertError('PlrModes.cpp', 0xfb)
  const pClientPlayer = resolveClientPlayerUnitInline(m, pClient >>> 0)
  if ((pUnit >>> 0) === pClientPlayer) {
    const statVal = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0xaf, 0) | 0
    D2GAME_PLRMODES_SendStatToClientOrParty113c(
      m,
      pUnit >>> 0,
      0xaf,
      pUnit >>> 0,
      statVal,
    )
  }
}

/**
 * Handles 5-byte C2S object collision-sync packet (`0x6FCED440`): validates packet length `5`,
 * object existence, same Act, and `<= 10` subtile distance (`0x6FCECFE0`), then runs `0x6FC8A220`.
 *
 * @va D2Game:0x6FCED440
 */
export function C2S_SyncObjectCollisionByGuid_6FCED440_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCED440)
  if ((nPacketLen | 0) !== 5) return 3
  const objGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  const err = C2S_ValidateTargetUnitDistance113c(m, 2, objGuid, pGame >>> 0, pPlayer >>> 0, 0x0a) | 0
  if (err !== 0) return err
  OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c(m, pGame >>> 0, objGuid)
  return 0
}

/**
 * Delivers overhead / party chat message `0x26` to `pClient` unless squelched (`0x04` / `0x02`)
 * or blocked by active player-to-player trade/interaction (`0x6FCECB10`).
 *
 * @va D2Game:0x6FCED530
 */
export function PACKET_DeliverOverheadOrPartyChat_6FCED530_113c(
  m: D2KernMemory113c,
  pClient: number,
  pChatDesc: number,
): void {
  hitD2GameVa113c(0x6FCED530)
  if (pClient === 0) throw new D2CommonAssertError('Packet.cpp', 0x996)
  const pChatMsg = m.u32(pChatDesc >>> 0) >>> 0
  const pGame = m.u32((pClient + 0x1a8) >>> 0) >>> 0
  const senderGuid = m.u32((pChatDesc + 0x08) >>> 0) >>> 0

  if ((senderGuid | 0) !== -1) {
    if (pGame === 0) throw new D2CommonAssertError('Packet.cpp', 0x2d3)
    let pSender = 0
    let pCur = m.u32((pGame + 0x1120 + ((senderGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pCur !== 0) {
      if ((m.u32((pCur + 0x0c) >>> 0) >>> 0) === senderGuid) {
        pSender = pCur
        break
      }
      pCur = m.u32((pCur + 0xe4) >>> 0) >>> 0
    }
    const pDest = CLIENTS_GetPlayerUnit113c(m, pClient >>> 0, 0) >>> 0
    if (pSender !== 0 && pDest !== 0 && pSender !== pDest) {
      if ((PARTY_TestPlayerRelationFlags113c(m, pSender, pDest, 4) | 0) !== 0) return
      if ((PARTY_TestPlayerRelationFlags113c(m, pDest, pSender, 2) | 0) !== 0) return
      if ((PACKET_IsInteractingWithDifferentPlayer113c(m, pSender, pGame, pDest) | 0) !== 0) return
      if ((PACKET_IsInteractingWithDifferentPlayer113c(m, pDest, pGame, pSender) | 0) !== 0) return
    }
  }

  NET_SendPacket26_ChatMessage_6FCAB470_113c(m, pChatMsg, pClient >>> 0)
}

/**
 * Tests whether `pUnit` can reach `(targetX, targetY)` via temporary `PATH_TYPE_15` (`0x0F`,
 * collision mask `0x409`, max distance `0x4D`), saving and restoring all dynamic path settings.
 *
 * @va D2Game:0x6FCED790
 */
export function SKILLS_TestPathReachableToCoords_6FCED790_113c(
  m: D2KernMemory113c,
  targetY: number,
  targetX: number,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCED790)
  const tx = targetX | 0
  const ty = targetY | 0
  if (
    (ROOM_FindRoomContainingSubtile113c(m, UNITS_GetRoom113c(m, pUnit >>> 0), tx, ty) >>> 0) === 0
  ) {
    return 0
  }
  if ((STATES_CheckState113c(m, pUnit >>> 0, 0x36) | 0) !== 0) return 0
  if ((STATES_CheckState113c(m, pUnit >>> 0, 0x6c) | 0) !== 0) return 0

  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const savedMask = PATH_GetMoveTestCollisionMask113c(m, pPath) >>> 0
  const savedType = PATH_GetType113c(m, pPath) | 0
  const savedMaxDist = PATH_GetMaxDistance113c(m, pPath) & 0xff

  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const rawTarget = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0
  const savedTargetUnit = rawTarget === (pUnit >>> 0) ? 0 : rawTarget
  const savedFirstX = PATH_GetFirstPointX113c(m, pPath) | 0
  const savedFirstY = PATH_GetFirstPointY113c(m, pPath) | 0

  PATH_SetMoveTestCollisionMask113c(m, pPath, 0x409)
  PATH_SetType113c(m, pPath, 0x0f)
  PATH_SetNewDistance113c(m, pPath, 0x4d)
  PATH_SetTargetPos113c(m, pPath, tx, ty)

  let bReachable = 0
  if ((PATH_Compute113c(m, pPath, pUnit >>> 0, 0) | 0) !== 0) {
    if (
      (PATH_GetLastPointX113c(m, pPath) | 0) === tx &&
      (PATH_GetLastPointY113c(m, pPath) | 0) === ty
    ) {
      bReachable = 1
    }
  }

  PATH_SetMoveTestCollisionMask113c(m, pPath, savedMask)
  PATH_SetType113c(m, pPath, savedType)
  PATH_SetNewDistance113c(m, pPath, savedMaxDist)
  if (savedTargetUnit !== 0) {
    PATH_SetTargetUnit113c(m, pPath, savedTargetUnit)
  } else {
    PATH_SetTargetPos113c(m, pPath, savedFirstX, savedFirstY)
  }
  return bReachable
}

/**
 * Handles 9-byte C2S `0x50` (`DROP_GOLD`) packet: rejects drops while actively trading with
 * another player (`+0x6C != 0 && +0x68 == 0`), then calls `0x6FC57F80` and returns `0` or `3`.
 *
 * @va D2Game:0x6FCEEF40
 */
export function C2S_Packet50_DropPlayerGold_6FCEEF40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEEF40)
  if ((nPacketLen | 0) !== 9) return 3
  const nGold = rdI32(m, (pPacket + 5) >>> 0)
  const dwPlayerId = m.u32((pPacket + 1) >>> 0) >>> 0

  if (pPlayer !== 0 && rdI32(m, pPlayer >>> 0) === 0) {
    const bInteracting = m.u8((pPlayer + 0x6c) >>> 0) !== 0
    let bBusy = bInteracting
    if (!bBusy) {
      bBusy = (INVENTORY_GetCursorItem113c(m, m.u32((pPlayer + 0x60) >>> 0)) >>> 0) !== 0
    }
    if (!bBusy) {
      const pPlrData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
      bBusy = m.u32((pPlrData + 0x4c) >>> 0) !== 0
    }
    if (bBusy) {
      if (
        m.u8((pPlayer + 0x6c) >>> 0) !== 0 &&
        rdI32(m, (pPlayer + 0x68) >>> 0) === 0 &&
        (SUNIT_GetServerUnit113c(m, pGame >>> 0, 0, m.u32((pPlayer + 0x64) >>> 0)) >>> 0) !== 0
      ) {
        return 3
      }
    }
  }

  const dropped =
    PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c(
      m,
      pGame >>> 0,
      dwPlayerId,
      pPlayer >>> 0,
      nGold,
    ) | 0
  return dropped !== 0 ? 0 : 3
}
