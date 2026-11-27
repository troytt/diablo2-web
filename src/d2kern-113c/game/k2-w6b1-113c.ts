/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 6 Batch 1 (`w6b1`) routines across
 * `0x6FC221D0..0x6FC85500` (45 functions).
 */

import { COLLISION_CheckSubtileMask113c } from '../common/collision'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import { PATH_CheckFlag08_113c } from '../common/drlg/room-tile'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon'
import { imul32, mulDiv113c, sdiv32 } from '../common/int-math'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  MISSILE_GetElapsedFrames113c,
  MISSILE_GetLevel113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetSkill113c,
  MISSILE_GetTargetX113c,
  MISSILE_SetTargetX113c,
} from '../common/missile'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetOrCheckLastCollisionMask113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_SetStepNum113c,
} from '../common/path'
import {
  MISSILE_ResolveSkillIdByCodeOrRef113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetParam1113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_IsSelectableCorpseWithVelocity113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
  SKILLS_SetSkillSlotIndex113c,
  SKILLS_TestLineOfSightFromUnitToTarget113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetStatListFromUnitAndFlag113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_AllocStaticPath113c,
  UNITS_GetEquippedWeaponAdder113c,
  UNITS_GetRoom113c,
  UNITS_SetUnitAnimMode113c,
  UNIT_Alloc113c,
  UNIT_GetAlignment113c,
} from '../common/unit'
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint'
import type { Memory113c } from '../mem/sparse-memory'
import { SEED_InitLowSeed113c, seedRoll } from '../prng'
import { QUESTS_TriggerCallback113c } from './a1c-post150-f150-f276-113c'
import { SUNIT_AreUnitsHostileOrUnaligned113c } from './a1c-post150-f786-f1040-113c'
import { AI_CastSkillWithMode113c, AI_StartAttackMode113c } from './ai-fallen-113c'
import {
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartModeCast113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_RemoveCombatNode113c,
} from './combat-a1c-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  AURA_ForEachUnitInRadius113c,
  CURSES_ScaleImmuneMonsterResistPenalty113c,
  STATES_CreateOrUpdateAuraStatList113c,
  UNITEVENT_RegisterTimerOrItemEventNode113c,
} from './k2-gap-itemdef-113c'
import {
  ITEMEVENT_RemoveByTypeAndState113c,
  MISSILE_BuildDamageStrcFromStats113c,
  MISSILE_CreateServerProjectile113c,
  MISSILE_SrvDo01_LinearProjectile113c,
  SKILLS_ResolveChargedSrvMissileId113c,
} from './k2-gap-melee-dot-113c'
import {
  AIGENERAL_GetOwnerData_6FC40D50_113c,
  type SUnitDmgHooks113c,
} from './k2-real-s2c-combat-113c'
import {
  SKILLS_EvalLinearParam34_6FC21A40_113c,
  SKILLS_GetParam4Fast_6FC21C20_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import { QUESTS_CheckGlobalQuestState_6FC538D0_113c } from './k2-laneJ-0x6fc4-w1-113c'
import {
  MISSILES_SetElemLenByEType_6FC594B0_113c,
  SKILLS_RedemptionCorpseCallback_6FC59930_113c,
} from './k2-laneK-0x6fc5-w1-113c'
import {
  SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c,
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c,
  SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c,
  SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c'
import {
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c,
  SKILLS_TargetRingScanCallback_6FCBED70_113c,
} from './k2-w2b5-113c'
import { SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c } from './k2-w3b1-113c'
import {
  MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c,
  SKILLS_ApplyProgressiveChargeState_6FC48E70_113c,
} from './k2-w3b2-113c'
import {
  MISSILES_PopulateDamageByEType_6FC5A280_113c,
  MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c,
  MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c,
} from './k2-w3b3-113c'
import {
  MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c,
  SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c,
} from './k2-w3b4-113c'
import { STATES_OnStateRemovedResetMonsterAi_6FC70130_113c } from './k2-w3b5-113c'
import { UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c } from './k2-w3b8-113c'
import { SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c } from './k2-w4b2-113c'
import { NET_SendPacket26_ChatMessage_6FCAB470_113c } from './k2-w4b4-113c'
import {
  SKILLS_CountUnitsInRadius_6FCC0FC0_113c,
  SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c,
  SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c,
} from './k2-w4b6-113c'
import {
  MISSILES_RedeemCorpseWithSkill124_6FC59910_113c,
  MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c,
  SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c,
  SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c,
  SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c,
  SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c,
  SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c,
  STATES_OnTransformStateRemoved_6FC64A60_113c,
  STORM_TSHashTableGrowAndRehash_6FC222D0_113c,
} from './k2-w5b1-113c'
import {
  ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c,
  ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c,
  NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c,
  SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c,
} from './k2-w5b2-113c'
import {
  AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
  MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c,
  SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c,
  SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c,
  SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c,
  SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c,
  SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c,
  SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c,
  SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c,
} from './k2-w5b3-113c'
import { ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c } from './k2-w5b4-113c'
import {
  ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c,
  NET_SendChatMessagePacket26Wrapper_6FCEB580_113c,
} from './k2-w5b5-113c'
import { SUNIT_IsDeadOrDying113c } from './monster-events'
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_CheckFlagBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  MONSTATS_ValidateClassId113c,
  MONSTER_GetBaseIdFromUnit113c,
  ROOM_FindRoomContainingSubtile113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  SUNIT_SetMonsterAlignmentState113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
} from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

let k2W6B1StackPtr = 0x7ef70000

function sx16(v: number): number {
  return (v << 16) >> 16
}

function i32(m: D2KernMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function readSgptDataTables113c(m: D2KernMemory113c): number {
  const ptrAddr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (ptrAddr === 0) return 0
  return m.u32(ptrAddr) >>> 0
}

function lookupSkillsTxt113c(m: D2KernMemory113c, nSkillId: number): number {
  const id = nSkillId | 0
  if (id < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0) return 0
  if (id >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const base = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (base === 0) return 0
  return (base + imul32(id, 0x23c)) >>> 0
}

function stepSeed64At113c(m: D2KernMemory113c, pSeed: number): number {
  const addr = pSeed >>> 0
  const lo = m.u32(addr) >>> 0
  const hi = m.u32((addr + 0x04) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 0x04) >>> 0, newHi)
  m.setU32(addr, newLo)
  return newLo
}

function rollSeedPtr113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  const max = nMax | 0
  if (addr === 0 || max <= 0) return 0
  const seed = { lo: m.u32(addr), hi: m.u32((addr + 0x04) >>> 0) }
  if (((max - 1) & max) === 0) {
    return (stepSeed64At113c(m, addr) & (max - 1)) | 0
  }
  const res = seedRoll(seed, max)
  m.setU32(addr, seed.lo >>> 0)
  m.setU32((addr + 0x04) >>> 0, seed.hi >>> 0)
  return res | 0
}

function readUnitPosXInline113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = i32(m, u)
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return pPath !== 0 ? i32(m, (pPath + 0x0c) >>> 0) : 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function readUnitPosYInline113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = i32(m, u)
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return pPath !== 0 ? i32(m, (pPath + 0x10) >>> 0) : 0
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
    if (pUnit !== 0 && i32(m, pUnit >>> 0) === 1) {
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
  const pPath = pUnit !== 0 ? m.u32((pUnit + 0x2c) >>> 0) >>> 0 : 0
  if (pPath !== 0) PATH_SetStepNum113c(m, pPath, nStepNum | 0)
  const res =
    MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, mode, pTarget >>> 0, nX | 0, nY | 0) | 0
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
  if ((flagsByte & 1) !== 0 && pUnit !== 0 && i32(m, pUnit >>> 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
    if (pAiGen !== 0) m.setU8((pAiGen + 0x08) >>> 0, (m.u8((pAiGen + 0x08) >>> 0) | 0x40) & 0xff)
  }
  if ((flagsByte & 2) !== 0 && pUnit !== 0) {
    const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
    if (roll < 0x46) {
      AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0)
      return 1
    }
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
    return 1
  }
  return res
}

function aiFleeFrom6FD12D80(
  m: D2KernMemory113c,
  pFrom: number,
  pGame: number,
  pUnit: number,
  nDistByte: number,
  bClearThinkOnFail: number,
): number {
  const unit = pUnit >>> 0
  const from = pFrom >>> 0
  if (unit === 0 || from === 0) return 0
  const mx = readUnitPosXInline113c(m, unit)
  const my = readUnitPosYInline113c(m, unit)
  const fx = readUnitPosXInline113c(m, from)
  const fy = readUnitPosYInline113c(m, from)
  const sx = fx > mx ? -1 : fx < mx ? 1 : 0
  const sy = fy > my ? -1 : fy < my ? 1 : 0
  const dist = nDistByte & 0xff
  const tx = (mx + imul32(dist, sx)) | 0
  const ty = (my + imul32(dist, sy)) | 0
  if (dist > 5 && i32(m, unit) === 1) {
    const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
    const pAiCtrl = pMonData !== 0 ? m.u32((pMonData + 0x2c) >>> 0) >>> 0 : 0
    if (pAiCtrl !== 0) {
      m.setU8((pAiCtrl + 0x20) >>> 0, dist < 0x4e ? dist : 0x4d)
    }
  }
  return aiApproachTarget6FD12540(
    m,
    pGame,
    unit,
    0,
    2,
    tx,
    ty,
    1,
    bClearThinkOnFail !== 0 ? 4 : 0,
  )
}

function resolveMonStats2AttackModeFlagBit4(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0x64
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, i32(m, (u + 0x04) >>> 0)) >>> 0
  if (pMonStats2 === 0) return 0x64
  const flags = m.u8((pMonStats2 + 0x104) >>> 0)
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const mask4 = pMasks !== 0 ? m.u32((pMasks + 0x10) >>> 0) : 0x10
  return (flags & mask4) !== 0 ? 0x65 : 0x64
}

/**
 * [1/45] Walks the chain of bucket `nBucketIndex` in Storm `TSHashTable` (`pHashTable`),
 * updating fullness score (`+0x10`) and triggering `0x6FC222D0` rehash when score exceeds `13`.
 *
 * @va D2Game:0x6FC221D0
 */
export function STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c(
  m: D2KernMemory113c,
  pHashTable: number,
  nBucketIndex: number,
): number {
  hitD2GameVa113c(0x6FC221D0)
  const ht = pHashTable >>> 0
  if ((m.u32((ht + 0x24) >>> 0) >>> 0) >= 0x3ff) return 0
  const prevScore = m.u32((ht + 0x10) >>> 0) >>> 0
  if (prevScore > 3) {
    m.setU32((ht + 0x10) >>> 0, (prevScore - 3) >>> 0)
  } else {
    m.setU32((ht + 0x10) >>> 0, 0)
  }
  const bucketOff = imul32(nBucketIndex | 0, 12) >>> 0
  let pNode = i32(m, (m.u32((ht + 0x1c) >>> 0) + bucketOff + 0x08) >>> 0)
  if (pNode <= 0) return 0

  while (pNode > 0) {
    const nextScore = (m.u32((ht + 0x10) >>> 0) + 1) >>> 0
    m.setU32((ht + 0x10) >>> 0, nextScore)
    if (nextScore > 0x0d) {
      m.setU32((ht + 0x10) >>> 0, 0)
      STORM_TSHashTableGrowAndRehash_6FC222D0_113c(m, ht)
      return 1
    }
    const pBucket = (m.u32((ht + 0x1c) >>> 0) + bucketOff) >>> 0
    const pLink =
      pNode !== 0 ? ((m.u32(pBucket) + (pNode >>> 0)) >>> 0) : ((pBucket + 0x04) >>> 0)
    pNode = i32(m, (pLink + 0x04) >>> 0)
  }
  return 0
}

/**
 * [2/45] Applies radial skill physical + elemental damage (`0x6FCBF1A0` + `0x6FCBF210`) around
 * `pUnit` within `dwAuraRangeCalc` (`+0x64`) using filter `0x8583` and callback `0x6FCC1210`.
 *
 * @va D2Game:0x6FC2C900
 */
export function SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2C900)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const wSrvMissile = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  if (wSrvMissile <= 0 || wSrvMissile >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0

  const u = pUnit >>> 0
  if (u !== 0) {
    m.setU32((u + 0xc4) >>> 0, (m.u32((u + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    const dwFlags = (1 | m.u32((pSkillsTxt + 0x130) >>> 0)) >>> 0
    m.setU32(pDmg, dwFlags)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pSkillsTxt + 0x12e) >>> 0)) & 0xffff,
    )
    const dwHitClass = m.u32((pSkillsTxt + 0x134) >>> 0) >>> 0
    if (dwHitClass !== 0) {
      m.setU32((pDmg + 0x60) >>> 0, dwHitClass)
    }

    const lvl = nSkillLevel | 0
    SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, u, skillId, pDmg, lvl)
    SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, skillId, u, pDmg, lvl)
    const nRadius =
      SKILLS_EvalCalcByOffset113c(
        m,
        u,
        m.u32((pSkillsTxt + 0x64) >>> 0),
        skillId,
        lvl,
      ) | 0

    if (u !== 0) {
      AURA_ForEachUnitInRadius113c(
        m,
        pGame >>> 0,
        u,
        0,
        0,
        nRadius,
        0x8583,
        0x6fcc1210,
        pDmg,
        0,
        AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
      )
    }
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [3/45] Evaluates `calc1` (`+0x138`) as projectile count and spawns a fan of `srvmissile` (`+0x48`)
 * projectiles via `0x6FC2D5D0`.
 *
 * @va D2Game:0x6FC2D7B0
 */
export function SKILLS_SrvDo_SpawnChargedBoltFanByCalc1_6FC2D7B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2D7B0)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const nMissileId = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  if (nMissileId <= 0 || nMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 0

  const u = pUnit >>> 0
  if (u !== 0) {
    m.setU32((u + 0xc4) >>> 0, (m.u32((u + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  const lvl = nSkillLevel | 0
  const nCount =
    SKILLS_EvalCalcByOffset113c(m, u, m.u32((pSkillsTxt + 0x138) >>> 0), skillId, lvl) | 0
  if (nCount <= 0) return 0

  SKILLS_SpawnChargedBoltFanMissiles_6FC2D5D0_113c(
    m,
    u,
    pGame >>> 0,
    nMissileId,
    nCount,
    skillId,
    lvl,
  )
  return 1
}

/**
 * [4/45] Applies aura state (`+0x82`) or morphs a base-`0x1C5` (`453`, Minion) monster target via
 * `0x6FC2D850` when `roll(100) >= calc1` and `wAuraTargetState` is not already active.
 *
 * @va D2Game:0x6FC2D9C0
 */
export function SKILLS_SrvDo_ApplyAuraOrMorphMinion_6FC2D9C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC2D9C0)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const wAuraState = sx16(m.u16((pSkillsTxt + 0x82) >>> 0))
  if (wAuraState < 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) return 0

  const u = pUnit >>> 0
  const game = pGame >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, u, game)
  const pPath = u !== 0 ? m.u32((u + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === u || pTarget === 0) return 0
  if ((SUNIT_IsDeadOrDying113c(m, pTarget) | 0) !== 0) return 0

  const lvl = nSkillLevel | 0
  if (i32(m, pTarget) === 1) {
    const baseId =
      MONSTATS_ValidateClassId113c(m, MONSTER_GetBaseIdFromUnit113c(m, pTarget)) | 0
    if (baseId === 0x1c5) {
      const nCalc1 =
        SKILLS_EvalCalcByOffset113c(m, u, m.u32((pSkillsTxt + 0x138) >>> 0), skillId, lvl) | 0
      const roll = rollSeedPtr113c(m, (u + 0x20) >>> 0, 100)
      if (roll >= nCalc1 && (STATES_CheckState113c(m, pTarget, wAuraState) | 0) === 0) {
        SKILLS_MorphMonsterAndApplyState142_6FC2D850_113c(m, skillId, pTarget, game, lvl, u)
        return 1
      }
    }
  }

  SKILLS_ApplyAuraStateWithStatCalcs_6FC2C6B0_113c(m, skillId, pTarget, lvl, u)
  return 1
}

/**
 * [5/45] Succubus AI thinker (`0x6FC3A9F0`): evaluates curse selection (`wSkill0..wSkill3`,
 * including `Defense Curse` vs `Blood Mana` when `maxLife <= maxMana` on player targets), melee
 * flee/attack, ranged bolt (`wSkill4`) or `S2` (`mode 9`), approach, flank circle (`type 5/6`),
 * and stall.
 *
 * @va D2Game:0x6FC3A9F0
 */
export function AI_ThinkSuccubus_6FC3A9F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC3A9F0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const nDistInit = i32(m, (arg + 0x14) >>> 0)
  const bInMeleeRange = i32(m, (arg + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pSeed = (unit + 0x20) >>> 0

  if (pTarget !== 0 && STATLIST_GetStatListFromUnitAndFlag113c(m, pTarget, 0x20) === 0) {
    const nDiff0 = m.u8((game + 0x6d) >>> 0)
    if (nDistInit < sx16(m.u16((pMonStatsTxt + nDiff0 * 2 + 0x68) >>> 0))) {
      const rollCurse = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const nDiff1 = m.u8((game + 0x6d) >>> 0)
      if (rollCurse < sx16(m.u16((pMonStatsTxt + nDiff1 * 2 + 0x62) >>> 0))) {
        const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
        if (wSkill0 > 0) {
          const targetLifePct = STATLIST_GetUnitLifePercent113c(m, pTarget) | 0
          const nDiffA = m.u8((game + 0x6d) >>> 0)
          if (targetLifePct >= sx16(m.u16((pMonStatsTxt + nDiffA * 2 + 0x7a) >>> 0))) {
            AI_CastSkillWithMode113c(
              m,
              m.u8((pMonStatsTxt + 0x180) >>> 0),
              unit,
              game,
              wSkill0,
              pTarget,
              0,
              0,
            )
            return
          }
        }
        const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
        if (wSkill1 > 0) {
          const selfLifePct = STATLIST_GetUnitLifePercent113c(m, unit) | 0
          const nDiffB = m.u8((game + 0x6d) >>> 0)
          if (selfLifePct <= sx16(m.u16((pMonStatsTxt + nDiffB * 2 + 0x80) >>> 0))) {
            AI_CastSkillWithMode113c(
              m,
              m.u8((pMonStatsTxt + 0x181) >>> 0),
              unit,
              game,
              wSkill1,
              pTarget,
              0,
              0,
            )
            return
          }
        }
        const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
        if (wSkill2 > 0) {
          const maxMana = STATLIST_GetMaxManaFromUnit113c(m, pTarget) | 0
          const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pTarget) | 0
          if (maxLife > maxMana || i32(m, pTarget) !== 0) {
            AI_CastSkillWithMode113c(
              m,
              m.u8((pMonStatsTxt + 0x182) >>> 0),
              unit,
              game,
              wSkill2,
              pTarget,
              0,
              0,
            )
            return
          }
        }
        const wSkill3 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
        if (wSkill3 > 0 && i32(m, pTarget) === 0) {
          AI_CastSkillWithMode113c(
            m,
            m.u8((pMonStatsTxt + 0x183) >>> 0),
            unit,
            game,
            wSkill3,
            pTarget,
            0,
            0,
          )
          return
        }
      }
    }
  }

  if (bInMeleeRange !== 0) {
    const rollFlee = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiffFlee = m.u8((game + 0x6d) >>> 0)
    if (rollFlee < sx16(m.u16((pMonStatsTxt + nDiffFlee * 2 + 0x62) >>> 0))) {
      const fleeDist = m.u8((pMonStatsTxt + nDiffFlee * 2 + 0x68) >>> 0)
      if (aiFleeFrom6FD12D80(m, pTarget, game, unit, fleeDist, 1) !== 0) {
        return
      }
    }
    const rollMelee = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiffMelee = m.u8((game + 0x6d) >>> 0)
    if (rollMelee < sx16(m.u16((pMonStatsTxt + nDiffMelee * 2 + 0x56) >>> 0))) {
      SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
      resolveMonStats2AttackModeFlagBit4(m, unit)
      MONSTER_StartMode113c(m, game, unit, 4, pTarget, 0, 0)
      return
    }
    AI_Stall113c(m, game, unit, sx16(m.u16((pMonStatsTxt + nDiffMelee * 2 + 0x74) >>> 0)))
    return
  }

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x08) >>> 0
  try {
    const pDistSlot = sp
    m.setU32(pDistSlot, nDistInit >>> 0)

    const wSkill4 = sx16(m.u16((pMonStatsTxt + 0x178) >>> 0))
    if (wSkill4 >= 0) {
      const nDiffR = m.u8((game + 0x6d) >>> 0)
      if (sx16(m.u16((pMonStatsTxt + nDiffR * 2 + 0x80) >>> 0)) > 0) {
        const rollR = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
        const nDiffR2 = m.u8((game + 0x6d) >>> 0)
        if (rollR < sx16(m.u16((pMonStatsTxt + nDiffR2 * 2 + 0x6e) >>> 0))) {
          const pRangedTarget =
            MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, 0, pDistSlot) >>>
            0
          if (pRangedTarget !== 0) {
            const rollCast = rollSeedPtr113c(m, pSeed, 100)
            const nDiffR3 = m.u8((game + 0x6d) >>> 0)
            if (rollCast < sx16(m.u16((pMonStatsTxt + nDiffR3 * 2 + 0x80) >>> 0))) {
              AI_CastSkillWithMode113c(
                m,
                m.u8((pMonStatsTxt + 0x184) >>> 0),
                unit,
                game,
                sx16(m.u16((pMonStatsTxt + 0x178) >>> 0)),
                pRangedTarget,
                0,
                0,
              )
              return
            }
          }
        }
      }
    }

    const nDiffClose = m.u8((game + 0x6d) >>> 0)
    if (i32(m, pDistSlot) < sx16(m.u16((pMonStatsTxt + nDiffClose * 2 + 0x68) >>> 0))) {
      const rollFlee2 = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const nDiffClose2 = m.u8((game + 0x6d) >>> 0)
      if (rollFlee2 < sx16(m.u16((pMonStatsTxt + nDiffClose2 * 2 + 0x62) >>> 0))) {
        const fleeDist2 = m.u8((pMonStatsTxt + nDiffClose2 * 2 + 0x68) >>> 0)
        if (aiFleeFrom6FD12D80(m, pTarget, game, unit, fleeDist2, 1) !== 0) {
          return
        }
      }
    }

    if (sx16(m.u16((pMonStatsTxt + 0x178) >>> 0)) < 0) {
      const pS2Target =
        MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, 0, pDistSlot) >>> 0
      if (pS2Target !== 0) {
        const rollS2 = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
        const nDiffS2 = m.u8((game + 0x6d) >>> 0)
        if (rollS2 < sx16(m.u16((pMonStatsTxt + nDiffS2 * 2 + 0x6e) >>> 0))) {
          AI_StartAttackMode113c(m, 9, unit, game, pS2Target)
          return
        }
      }
    }

    const rollWalk = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiffWalk = m.u8((game + 0x6d) >>> 0)
    if (rollWalk < sx16(m.u16((pMonStatsTxt + nDiffWalk * 2 + 0x5c) >>> 0))) {
      aiApproachTarget6FD12540(m, game, unit, pTarget, 2, 0, 0, 1, 0)
      return
    }

    const rollCircle = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    if (rollCircle < 0x32) {
      const dirLo = stepSeed64At113c(m, pSeed) >>> 0
      let pathType = (dirLo & 0xff) < 0x80 ? 5 : 6
      if (pathType === 1) pathType = 7
      let pAiCtrl = 0
      if (unit !== 0 && i32(m, unit) === 1) {
        const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) pAiCtrl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
      if (pAiCtrl !== 0) {
        if (pathType !== 0) m.setU32((pAiCtrl + 0x18) >>> 0, pathType >>> 0)
        m.setU8((pAiCtrl + 0x20) >>> 0, 6)
      }
      if (aiApproachTarget6FD12540(m, game, unit, pTarget, 2, 0, 0, 1, 4) !== 0) {
        return
      }
    }

    const nDiffStall = m.u8((game + 0x6d) >>> 0)
    AI_Stall113c(m, game, unit, sx16(m.u16((pMonStatsTxt + nDiffStall * 2 + 0x74) >>> 0)))
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [6/45] Oblivion Knight / Curse Caster AI thinker (`0x6FC3AF80`): evaluates curse selection
 * (`wSkill0..wSkill3`), melee attack/stall, ranged skill (`wSkill4`), approach, and stall.
 *
 * @va D2Game:0x6FC3AF80
 */
export function AI_ThinkCurseCaster_6FC3AF80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
): void {
  hitD2GameVa113c(0x6FC3AF80)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const nDist = i32(m, (arg + 0x14) >>> 0)
  const bInMeleeRange = i32(m, (arg + 0x18) >>> 0)
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pSeed = (unit + 0x20) >>> 0

  if (STATLIST_GetStatListFromUnitAndFlag113c(m, pTarget, 0x20) === 0) {
    const nDiff0 = m.u8((game + 0x6d) >>> 0)
    if (nDist < sx16(m.u16((pMonStatsTxt + nDiff0 * 2 + 0x68) >>> 0))) {
      const rollCurse = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const nDiff1 = m.u8((game + 0x6d) >>> 0)
      if (rollCurse < sx16(m.u16((pMonStatsTxt + nDiff1 * 2 + 0x62) >>> 0))) {
        const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
        if (wSkill0 > 0) {
          const targetLifePct = STATLIST_GetUnitLifePercent113c(m, pTarget) | 0
          const nDiffA = m.u8((game + 0x6d) >>> 0)
          if (targetLifePct >= sx16(m.u16((pMonStatsTxt + nDiffA * 2 + 0x7a) >>> 0))) {
            AI_CastSkillWithMode113c(
              m,
              m.u8((pMonStatsTxt + 0x180) >>> 0),
              unit,
              game,
              wSkill0,
              pTarget,
              0,
              0,
            )
            return
          }
        }
        const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
        if (wSkill1 > 0) {
          const selfLifePct = STATLIST_GetUnitLifePercent113c(m, unit) | 0
          const nDiffB = m.u8((game + 0x6d) >>> 0)
          if (selfLifePct <= sx16(m.u16((pMonStatsTxt + nDiffB * 2 + 0x80) >>> 0))) {
            AI_CastSkillWithMode113c(
              m,
              m.u8((pMonStatsTxt + 0x181) >>> 0),
              unit,
              game,
              wSkill1,
              pTarget,
              0,
              0,
            )
            return
          }
        }
        const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
        if (wSkill2 > 0) {
          const maxMana = STATLIST_GetMaxManaFromUnit113c(m, pTarget) | 0
          const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pTarget) | 0
          if (maxLife > maxMana || pTarget === 0 || i32(m, pTarget) !== 0) {
            AI_CastSkillWithMode113c(
              m,
              m.u8((pMonStatsTxt + 0x182) >>> 0),
              unit,
              game,
              wSkill2,
              pTarget,
              0,
              0,
            )
            return
          }
        }
        const wSkill3 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
        if (wSkill3 > 0 && pTarget !== 0 && i32(m, pTarget) === 0) {
          AI_CastSkillWithMode113c(
            m,
            m.u8((pMonStatsTxt + 0x183) >>> 0),
            unit,
            game,
            wSkill3,
            pTarget,
            0,
            0,
          )
          return
        }
      }
    }
  }

  if (bInMeleeRange !== 0) {
    const rollMelee = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiffM = m.u8((game + 0x6d) >>> 0)
    if (rollMelee < sx16(m.u16((pMonStatsTxt + nDiffM * 2 + 0x56) >>> 0))) {
      SKILLS_SetUsedSkillMemPort113c(m, unit, 0)
      resolveMonStats2AttackModeFlagBit4(m, unit)
      MONSTER_StartMode113c(m, game, unit, 4, pTarget, 0, 0)
      return
    }
    AI_Stall113c(m, game, unit, sx16(m.u16((pMonStatsTxt + nDiffM * 2 + 0x6e) >>> 0)))
    return
  }

  if (sx16(m.u16((pMonStatsTxt + 0x178) >>> 0)) > 0) {
    const nDiffR = m.u8((game + 0x6d) >>> 0)
    if (sx16(m.u16((pMonStatsTxt + nDiffR * 2 + 0x80) >>> 0)) > 0) {
      const sp = k2W6B1StackPtr
      k2W6B1StackPtr = (sp + 0x08) >>> 0
      let pRangedTarget = 0
      try {
        m.setU32(sp, 0)
        pRangedTarget =
          MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, unit, game, 0, sp) >>> 0
      } finally {
        k2W6B1StackPtr = sp
      }
      if (pRangedTarget !== 0) {
        const rollCast = rollSeedPtr113c(m, pSeed, 100)
        const nDiffR2 = m.u8((game + 0x6d) >>> 0)
        if (rollCast < sx16(m.u16((pMonStatsTxt + nDiffR2 * 2 + 0x80) >>> 0))) {
          AI_CastSkillWithMode113c(
            m,
            m.u8((pMonStatsTxt + 0x184) >>> 0),
            unit,
            game,
            sx16(m.u16((pMonStatsTxt + 0x178) >>> 0)),
            pRangedTarget,
            0,
            0,
          )
          return
        }
      }
    }
  }

  const rollWalk = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
  const nDiffW = m.u8((game + 0x6d) >>> 0)
  if (rollWalk < sx16(m.u16((pMonStatsTxt + nDiffW * 2 + 0x5c) >>> 0))) {
    aiApproachTarget6FD12540(m, game, unit, pTarget, 2, 0, 0, 1, 0)
    return
  }
  AI_Stall113c(m, game, unit, sx16(m.u16((pMonStatsTxt + nDiffW * 2 + 0x74) >>> 0)))
}

/**
 * [7/45] `MonUMod` Cursed (`7`) hit proc (`0x6FC44250`): when `bCanApply != 0` and `(seed & 3) >= 1`,
 * computes `skillLvl = max(1, mlvl / 5 + 1)` for Amplify Damage (`0x42`), clamps radius to `[1, 40]`,
 * and applies `0x6FC44030` across targets near `pAttacker`'s target coords (`0x6FCC06F0`).
 *
 * @va D2Game:0x6FC44250
 */
export function MONUMOD_OnHitApplyCursedAmplifyDamage_6FC44250_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  _pDefender: number,
  bCanApply: number,
): void {
  hitD2GameVa113c(0x6FC44250)
  if ((bCanApply | 0) === 0) return
  const att = pAttacker >>> 0
  const seedLo = stepSeed64At113c(m, (att + 0x20) >>> 0) >>> 0
  if ((seedLo & 3) < 1) return

  const mlvl = STATLIST_GetUnitStat113c(m, att, 0x0c, 0) | 0
  let skillLvl = (sdiv32(mlvl, 5) + 1) | 0
  if (skillLvl < 1) skillLvl = 1

  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || i32(m, (pDataTables + 0xba0) >>> 0) <= 0x42) return
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + 0x9378) >>> 0
  if (pSkillsTxt === 0) return

  let nRadius =
    SKILLS_EvalCalcByOffset113c(m, att, m.u32((pSkillsTxt + 0x64) >>> 0), 0x42, skillLvl) | 0
  if (nRadius <= 1) {
    nRadius = 1
  } else if (nRadius >= 0x28) {
    nRadius = 0x28
  }

  SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c(
    m,
    nRadius,
    pGame >>> 0,
    att,
    3,
    (mem, cbGame, cbAttacker, pFoundUnit) => {
      MONUMOD_ApplyCursedAmplifyDamage_6FC44030_113c(mem, cbGame, cbAttacker, pFoundUnit)
    },
    skillLvl,
  )
}

/**
 * [8/45] Returns `1` iff `pUnit` is a living monster (`dwUnitType == 1`), can use a skill in
 * mode `12` (`0x6FCBF120`), and is not owned by a player (`ownerGuid == -1 || ownerType != 0`).
 *
 * @va D2Game:0x6FC47130
 */
export function SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC47130)
  const unit = pUnit >>> 0
  if (unit === 0 || i32(m, unit) !== 1) return 0
  if ((SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, unit, 0x0c) | 0) === 0) return 0
  if ((SUNIT_IsDeadOrDying113c(m, unit) | 0) !== 0) return 0

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x08) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0)
    AIGENERAL_GetOwnerData_6FC40D50_113c(m, unit, sp, (sp + 0x04) >>> 0)
    if (i32(m, sp) === -1 || m.u32((sp + 0x04) >>> 0) !== 0) {
      return 1
    }
    return 0
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [9/45] Executes Druid Fury / Barbarian Frenzy multi-hit (`0x6FC47B90`): on even animation frames,
 * hits the current path target (`0x6FC473C0` + `0x6FCFED30`); on odd frames, sets `dwFlags |= 0x40`,
 * ring-scans within `weaponAdder + 4` (`0x2A783` filter, `0x6FCBED70`), retargets, and hits.
 *
 * @va D2Game:0x6FC47B90
 */
export function SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC47B90)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = unit !== 0 ? m.u32((unit + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === unit || pTarget === 0) return 0

  const frameIdx = i32(m, (unit + 0x38) >>> 0) >> 8
  if ((frameIdx % 2) === 0) {
    SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c(m, game, unit, nSkillId | 0, nSkillLevel | 0)
    SUNITDMG_ExecuteEvents113c(m, game, unit, pTarget)
    return 1
  }

  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  const wpAdder = UNITS_GetEquippedWeaponAdder113c(m, unit) | 0
  const targetGuid = m.u32((pTarget + 0x0c) >>> 0) >>> 0

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x18) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0xffffffff)
    m.setU32((sp + 0x08) >>> 0, 0)
    m.setU32((sp + 0x0c) >>> 0, targetGuid)
    m.setU32((sp + 0x10) >>> 0, targetGuid)
    m.setU32((sp + 0x14) >>> 0, 0)

    AURA_ForEachUnitInRadius113c(
      m,
      game,
      unit,
      0,
      0,
      (wpAdder + 4) | 0,
      0x2a783,
      0x6fcbed70,
      sp,
      0,
      SKILLS_TargetRingScanCallback_6FCBED70_113c,
    )

    let pChosen = m.u32(sp) >>> 0
    if (pChosen === 0) {
      pChosen = m.u32((sp + 0x08) >>> 0) >>> 0
      if (pChosen === 0) return 0
    }

    UNITS_SetTargetUnitForDynamicUnit113c(m, unit, pChosen)
    SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c(m, game, unit, nSkillId | 0, nSkillLevel | 0)
    SUNITDMG_ExecuteEvents113c(m, game, unit, pChosen)
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [10/45] Executes Assassin dual-claw progressive-charge melee hit (`0x6FC49600`): dispatches
 * combat events, updates weapon durability/state (`0x6FC99100`/`0x6FC98A90`), applies progressive
 * charge state (`0x6FC48E70`), and hits the current or next ring-scanned target (`0x6FC47A10`).
 *
 * @va D2Game:0x6FC49600
 */
export function SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC49600)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = unit !== 0 ? m.u32((unit + 0x2c) >>> 0) >>> 0 : 0
  const pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
  if (pTarget === unit || pTarget === 0) return 0

  const skillId = nSkillId | 0
  const lvl = nSkillLevel | 0
  const frameIdx = i32(m, (unit + 0x38) >>> 0) >> 8
  if ((frameIdx % 2) === 0) {
    SUNITDMG_ExecuteEvents113c(m, game, unit, pTarget)
    SUNITDMG_RemoveCombatNode113c(m, unit, pTarget)
    if (unit !== 0 && i32(m, unit) === 0) {
      PLAYER_ScheduleSkillActionFrameEvents113c(m, game, unit, 0, 0)
      PLAYER_StartModeCast113c(m, game, unit)
    }
    SKILLS_ApplyProgressiveChargeState_6FC48E70_113c(m, game, unit, skillId, lvl)
    return SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c(m, skillId, unit, game, pTarget, lvl)
  }

  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  SUNITDMG_ExecuteEvents113c(m, game, unit, pTarget)
  if (unit !== 0 && i32(m, unit) === 0) {
    PLAYER_ScheduleSkillActionFrameEvents113c(m, game, unit, 0, 0)
    PLAYER_StartModeCast113c(m, game, unit)
  }
  SKILLS_ApplyProgressiveChargeState_6FC48E70_113c(m, game, unit, skillId, lvl)

  const wpAdder = UNITS_GetEquippedWeaponAdder113c(m, unit) | 0
  const targetGuid = m.u32((pTarget + 0x0c) >>> 0) >>> 0
  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x18) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0xffffffff)
    m.setU32((sp + 0x08) >>> 0, 0)
    m.setU32((sp + 0x0c) >>> 0, targetGuid)
    m.setU32((sp + 0x10) >>> 0, targetGuid)
    m.setU32((sp + 0x14) >>> 0, 0)

    AURA_ForEachUnitInRadius113c(
      m,
      game,
      unit,
      0,
      0,
      (wpAdder + 4) | 0,
      0x2a783,
      0x6fcbed70,
      sp,
      0,
      SKILLS_TargetRingScanCallback_6FCBED70_113c,
    )

    let pNextTarget = m.u32(sp) >>> 0
    if (pNextTarget === 0) {
      pNextTarget = m.u32((sp + 0x08) >>> 0) >>> 0
    }
    return SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c(
      m,
      skillId,
      unit,
      game,
      pNextTarget,
      lvl,
    )
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [11/45] Preset object spawner (`0x6FC52110`) for Act 2 False Tomb symbol objects: queries quest
 * `0x0D` (`ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c`, defaulting to `0x133`), allocates
 * and initializes the object unit (`0x6FC4F300`), and places it in `pRoom` (`0x6FD00F40`).
 *
 * @va D2Game:0x6FC52110
 */
export function OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c(
  m: D2KernMemory113c,
  pGame: number,
  pRoom: number,
  _nPresetObjId: number,
  x: number,
  y: number,
  _nInitMode = 0,
): number {
  hitD2GameVa113c(0x6FC52110)
  const game = pGame >>> 0
  const room = pRoom >>> 0
  let nSymbolObjId = 0x133
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl !== 0) {
    let pQuest = m.u32(pQuestCtrl) >>> 0
    while (pQuest !== 0) {
      if (i32(m, pQuest) === 0x0d) {
        nSymbolObjId = ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c(m, pQuest) | 0
        break
      }
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }
  }

  if (room === 0) {
    throw new Error('Objects.cpp:391: pRoom == 0')
  }

  const pObjUnit = UNIT_Alloc113c(m, 2) >>> 0
  if (pObjUnit === 0) return 0

  m.setU32(pObjUnit, 2)
  m.setU32((pObjUnit + 0x04) >>> 0, nSymbolObjId >>> 0)
  m.setU32((pObjUnit + 0x08) >>> 0, m.u32((game + 0x1c) >>> 0))
  m.setU32((pObjUnit + 0x80) >>> 0, game)

  let flagsEx = m.u32((pObjUnit + 0xc8) >>> 0) >>> 0
  if (m.u32((game + 0x70) >>> 0) !== 0) {
    flagsEx = (flagsEx | 0x02000000) >>> 0
  } else {
    flagsEx = (flagsEx & 0xfdffffff) >>> 0
  }
  flagsEx = (flagsEx | 0x04000000) >>> 0
  m.setU32((pObjUnit + 0xc8) >>> 0, flagsEx)

  const lvlId = DUNGEON_GetLevelIdFromRoom113c(m, room) | 0
  const actNo = DRLG_GetActNoFromLevelId113c(m, lvlId) & 0xff
  m.setU8((pObjUnit + 0x18) >>> 0, actNo)
  m.setU32((pObjUnit + 0x1c) >>> 0, m.u32((game + actNo * 4 + 0xbc) >>> 0))
  m.setU32((pObjUnit + 0x74) >>> 0, 0)

  SUNIT_InitUnitSeed113c(m, pObjUnit, (game + 0xd0) >>> 0)
  m.setU32((pObjUnit + 0xc4) >>> 0, (m.u32((pObjUnit + 0xc4) >>> 0) | 0x10) >>> 0)
  m.setU32((pObjUnit + 0xd0) >>> 0, 0x0b)

  let nextGuid = (m.u32((game + 0x98) >>> 0) + 1) >>> 0
  if (nextGuid === 0xffffffff) {
    nextGuid = 1
  }
  m.setU32((game + 0x98) >>> 0, nextGuid)

  const pObjData = m.alloc(0x38) >>> 0
  m.fill(pObjData, 0x38, 0)
  m.setU32((pObjUnit + 0x14) >>> 0, pObjData)
  m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, nSymbolObjId) >>> 0)
  m.setU32((pObjUnit + 0x10) >>> 0, 0)
  UNITS_AllocStaticPath113c(m, pObjUnit)

  OBJECTS_InitObjectUnit113c(m, pObjUnit, game, nextGuid, room, x | 0, y | 0)
  SUNIT_PlaceServerUnitInRoom113c(m, room, y | 0, pObjUnit, x | 0, game, 1)
  return pObjUnit
}

/**
 * [12/45] Dispatches Act 2 Prologue Jerhyn spawn (`0x6FCE7C20`) when quest `0x0B` (`11`) exists in
 * `pQuestArg->pGame->pQuestControl` (`+0x10F4`).
 *
 * @va D2Game:0x6FC565B0
 */
export function QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c(
  m: D2KernMemory113c,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC565B0)
  const arg = pQuestArg >>> 0
  const pGame = m.u32(arg) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0) {
    if (i32(m, pQuest) === 0x0b) {
      ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c(m, pQuest, arg)
      return
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
}

/**
 * [13/45] Missile hit handler (`0x6FC5AB30`): returns `0` if `pHitUnit != 0`; when expiring on
 * terrain (`pHitUnit == 0`), spawns `wSubMissile1` (`+0x24`) at `(posX, posY)` and copies `targetX`.
 *
 * @va D2Game:0x6FC5AB30
 */
export function MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5AB30)
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  const wSubMissile1 = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
  if (wSubMissile1 < 0) return 1
  if ((pHitUnit >>> 0) !== 0) return 0

  const game = pGame >>> 0
  const posY = UNIT_GetPosY113c(m, mis) | 0
  const posX = UNIT_GetPosX113c(m, mis) | 0
  const nLevel = MISSILE_GetLevel113c(m, mis) | 0
  const nSkill = MISSILE_GetSkill113c(m, mis) | 0
  const pOwner = SUNIT_GetOwnerUnit113c(m, mis, game) >>> 0
  const pSub =
    SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
      m,
      pOwner,
      game,
      nSkill,
      nLevel,
      wSubMissile1,
      posX,
      posY,
    ) >>> 0
  if (pSub !== 0) {
    MISSILE_SetTargetX113c(m, pSub, MISSILE_GetTargetX113c(m, mis) | 0)
  }
  return 1
}

/**
 * [14/45] Guided projectile collision/retarget evaluator (`0x6FC5B140`): handles town termination,
 * wall collision mask `4`, target lock (`flag 1`), and radius retargeting (`flag 2`, `0x6FC5B070`).
 *
 * @va D2Game:0x6FC5B140
 */
export function MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5B140)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  const hit = pHitUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, mis) >>> 0
  if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) | 0) !== 0) {
    return 1
  }

  const modeFlags = MISSILE_GetTargetX113c(m, mis) | 0
  if (hit === 0 && (modeFlags & 4) !== 0) {
    return 1
  }
  const lastMask = PATH_GetOrCheckLastCollisionMask113c(m, m.u32((mis + 0x2c) >>> 0) >>> 0) | 0
  if (hit === 0 && (lastMask & 4) !== 0) {
    return 1
  }

  if ((modeFlags & 1) !== 0) {
    if (hit === 0) return 3
    SUNIT_ValidatePathTargetUnit113c(m, mis, game)
    const pPath = m.u32((mis + 0x2c) >>> 0) >>> 0
    let pTarget = pPath !== 0 ? PATH_GetTargetUnit113c(m, pPath) >>> 0 : 0
    if (pTarget === mis) pTarget = 0
    return hit === pTarget ? 3 : 4
  }

  if ((modeFlags & 2) !== 0) {
    const remFrames = MISSILE_GetRemainingFrames113c(m, mis) | 0
    if (remFrames <= 0) {
      const retargeted =
        MISSILES_RetargetGuidedProjectileInRadius_6FC5B070_113c(m, mis, game) | 0
      return retargeted !== 0 ? 1 : 4
    }
    return (modeFlags & 4) !== 0 ? 3 : 4
  }

  return 3
}

/**
 * [15/45] Missile explosion handler (`0x6FC5B210`): builds `D2DamageStrc` from missile stats
 * (`0x6FC5A4E0`), deals radial damage (`0x8583`, `0x6FCC1210`) within `dwParam1` (`+0x4C`) or
 * `dwAuraRangeCalc` (`+0x64`), and spawns `wSubMissile1` (`+0x24`) if `>= 0`.
 *
 * @va D2Game:0x6FC5B210
 */
export function MISSILE_SrvHit_RadialStatsDamageAndSubMissile_6FC5B210_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5B210)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  if (((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const pOwner =
    SUNIT_GetServerUnit113c(m, game, i32(m, (mis + 0x94) >>> 0), i32(m, (mis + 0x98) >>> 0)) >>> 0
  if (pOwner === 0) return 1

  const nSkill = MISSILE_GetSkill113c(m, mis) | 0
  const nLevel = MISSILE_GetLevel113c(m, mis) | 0
  const posX = readUnitPosXInline113c(m, mis)
  const posY = readUnitPosYInline113c(m, mis)

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    MISSILE_BuildDamageStrcFromStats113c(m, mis, 0, pDmg)

    let nRadius = i32(m, (pMissilesTxt + 0x4c) >>> 0)
    if (nRadius <= 0) {
      const pSkillsTxt = lookupSkillsTxt113c(m, nSkill)
      if (pSkillsTxt === 0) return 1
      nRadius =
        SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x64) >>> 0), nSkill, nLevel) |
        0
      if (nRadius < 1) nRadius = 1
    }

    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
    )
    AURA_ForEachUnitInRadius113c(
      m,
      game,
      pOwner,
      posX,
      posY,
      nRadius,
      0x8583,
      0x6fcc1210,
      pDmg,
      0,
      AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
    )

    const wSubMissile1 = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
    if (wSubMissile1 >= 0) {
      SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
        m,
        pOwner,
        game,
        nSkill,
        nLevel,
        wSubMissile1,
        posX,
        posY,
      )
    }
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [16/45] Missile explosion handler (`0x6FC5B3E0`): populates elemental damage by `EType`
 * (`0x6FC5A280`) and duration (`dwParam2` or `dwAuraLenCalc` via `0x6FC594B0`), then deals radial
 * damage (`0x8583`, `0x6FCC1210`) within `dwParam1` (`+0x4C`) or `dwAuraRangeCalc` (`+0x64`).
 *
 * @va D2Game:0x6FC5B3E0
 */
export function MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5B3E0)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  const nSkill = MISSILE_GetSkill113c(m, mis) | 0
  const nLevel = MISSILE_GetLevel113c(m, mis) | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, nSkill)
  if (pSkillsTxt === 0) return 1

  let nRadius = i32(m, (pMissilesTxt + 0x4c) >>> 0)
  if (nRadius <= 0) {
    const pOwnerR = SUNIT_GetOwnerUnit113c(m, mis, game) >>> 0
    nRadius =
      SKILLS_EvalCalcByOffset113c(m, pOwnerR, m.u32((pSkillsTxt + 0x64) >>> 0), nSkill, nLevel) | 0
    if (nRadius < 1) nRadius = 1
  }

  let nElemLen = i32(m, (pMissilesTxt + 0x50) >>> 0)
  if (nElemLen <= 0) {
    const pOwnerL = SUNIT_GetOwnerUnit113c(m, mis, game) >>> 0
    nElemLen =
      SKILLS_EvalCalcByOffset113c(m, pOwnerL, m.u32((pSkillsTxt + 0x60) >>> 0), nSkill, nLevel) | 0
  }

  const posX = readUnitPosXInline113c(m, mis)
  const posY = readUnitPosYInline113c(m, mis)

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    MISSILES_PopulateDamageByEType_6FC5A280_113c(m, mis, pDmg, pHitUnit >>> 0)
    if (nElemLen > 0) {
      MISSILES_SetElemLenByEType_6FC594B0_113c(m, mis, pDmg, nElemLen)
    }
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
    )

    if (((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
      const pOwner =
        SUNIT_GetServerUnit113c(
          m,
          game,
          i32(m, (mis + 0x94) >>> 0),
          i32(m, (mis + 0x98) >>> 0),
        ) >>> 0
      if (pOwner !== 0) {
        AURA_ForEachUnitInRadius113c(
          m,
          game,
          pOwner,
          posX,
          posY,
          nRadius,
          0x8583,
          0x6fcc1210,
          pDmg,
          0,
          AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
        )
      }
    }
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [17/45] Missile explosion handler (`0x6FC5B5F0`): builds `D2DamageStrc` from missile stats
 * (`0x6FC5A4E0`) against `pHitUnit` and applies radial damage within `dwParam1` (`!= 0`) or
 * `dwAuraRangeCalc` (`+0x64`).
 *
 * @va D2Game:0x6FC5B5F0
 */
export function MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5B5F0)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  const pOwner =
    ((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) !== 0
      ? SUNIT_GetServerUnit113c(
          m,
          game,
          i32(m, (mis + 0x94) >>> 0),
          i32(m, (mis + 0x98) >>> 0),
        ) >>> 0
      : 0

  let nRadius = i32(m, (pMissilesTxt + 0x4c) >>> 0)
  if (nRadius === 0) {
    const nSkill = MISSILE_GetSkill113c(m, mis) | 0
    const nLevel = MISSILE_GetLevel113c(m, mis) | 0
    const pSkillsTxt = lookupSkillsTxt113c(m, nSkill)
    if (pSkillsTxt === 0) return 1
    nRadius =
      SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x64) >>> 0), nSkill, nLevel) | 0
    if (nRadius < 1) nRadius = 1
  }

  const posX = readUnitPosXInline113c(m, mis)
  const posY = readUnitPosYInline113c(m, mis)

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    MISSILE_BuildDamageStrcFromStats113c(m, mis, pHitUnit >>> 0, pDmg)
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
    )
    if (pOwner !== 0) {
      AURA_ForEachUnitInRadius113c(
        m,
        game,
        pOwner,
        posX,
        posY,
        nRadius,
        0x8583,
        0x6fcc1210,
        pDmg,
        0,
        AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
      )
    }
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [18/45] Missile explosion handler (`0x6FC5B7C0`): builds `D2DamageStrc` from missile stats
 * (`0x6FC5A4E0`) and applies radial damage within `dwParam1` (`> 0`) or `calc1` (`+0x138`).
 *
 * @va D2Game:0x6FC5B7C0
 */
export function MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5B7C0)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  if (((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const pOwner =
    SUNIT_GetServerUnit113c(m, game, i32(m, (mis + 0x94) >>> 0), i32(m, (mis + 0x98) >>> 0)) >>> 0
  if (pOwner === 0) return 1

  let nRadius = i32(m, (pMissilesTxt + 0x4c) >>> 0)
  if (nRadius <= 0) {
    const nSkill = MISSILE_GetSkill113c(m, mis) | 0
    const nLevel = MISSILE_GetLevel113c(m, mis) | 0
    const pSkillsTxt = lookupSkillsTxt113c(m, nSkill)
    if (pSkillsTxt === 0) return 1
    nRadius =
      SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x138) >>> 0), nSkill, nLevel) | 0
    if (nRadius < 1) nRadius = 1
  }

  const posX = readUnitPosXInline113c(m, mis)
  const posY = readUnitPosYInline113c(m, mis)

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    MISSILE_BuildDamageStrcFromStats113c(m, mis, pHitUnit >>> 0, pDmg)
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
    )
    AURA_ForEachUnitInRadius113c(
      m,
      game,
      pOwner,
      posX,
      posY,
      nRadius,
      0x8583,
      0x6fcc1210,
      pDmg,
      0,
      AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
    )
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [19/45] Missile explosion handler (`0x6FC5B990`): populates elemental damage by `EType`
 * (`0x6FC5A280`) and deals radial damage (`0x8583`, `0x6FCC1210`) within `dwParam1` (`> 0`) or
 * `calc1` (`+0x138`).
 *
 * @va D2Game:0x6FC5B990
 */
export function MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
  combatHooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FC5B990)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  if (((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const pOwner =
    SUNIT_GetServerUnit113c(m, game, i32(m, (mis + 0x94) >>> 0), i32(m, (mis + 0x98) >>> 0)) >>> 0
  if (pOwner === 0) return 1

  let nRadius = i32(m, (pMissilesTxt + 0x4c) >>> 0)
  if (nRadius <= 0) {
    const nSkill = MISSILE_GetSkill113c(m, mis) | 0
    const nLevel = MISSILE_GetLevel113c(m, mis) | 0
    const pSkillsTxt = lookupSkillsTxt113c(m, nSkill)
    if (pSkillsTxt === 0) return 1
    nRadius =
      SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x138) >>> 0), nSkill, nLevel) | 0
    if (nRadius < 1) nRadius = 1
  }

  const posX = readUnitPosXInline113c(m, mis)
  const posY = readUnitPosYInline113c(m, mis)

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    MISSILES_PopulateDamageByEType_6FC5A280_113c(m, mis, pDmg, pHitUnit >>> 0)
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
    )
    AURA_ForEachUnitInRadius113c(
      m,
      game,
      pOwner,
      posX,
      posY,
      nRadius,
      0x8583,
      0x6fcc1210,
      pDmg,
      0,
      (mem, pAuraCtx, pTarget) =>
        AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c(mem, pAuraCtx, pTarget, combatHooks),
    )
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [20/45] Missile hit handler (`0x6FC5C490`): computes scatter count (`dwParam1 + (lvl-1)*dwParam2`
 * or `calc4` at `+0x144`) and spawns scattered `wSubMissile1` (`+0x24`) projectiles (`0x6FCB3990`).
 *
 * @va D2Game:0x6FC5C490
 */
export function MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  _pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5C490)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1
  const wSubMissile1 = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
  if (wSubMissile1 < 0) return 1

  if (((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const pOwner =
    SUNIT_GetServerUnit113c(m, game, i32(m, (mis + 0x94) >>> 0), i32(m, (mis + 0x98) >>> 0)) >>> 0
  if (pOwner === 0) return 1

  const nLevel = MISSILE_GetLevel113c(m, mis) | 0
  let nCount =
    (imul32((nLevel - 1) | 0, i32(m, (pMissilesTxt + 0x50) >>> 0)) +
      i32(m, (pMissilesTxt + 0x4c) >>> 0)) |
    0
  if (nCount <= 0) {
    const nSkill0 = MISSILE_GetSkill113c(m, mis) | 0
    const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkill0) >>> 0
    if (pSkillsTxt === 0) return 1
    nCount =
      SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x144) >>> 0), nSkill0, nLevel) | 0
    if (nCount < 1) nCount = 1
  }

  const nSkill = MISSILE_GetSkill113c(m, mis) | 0
  const nSpread = sdiv32(nCount, 4)
  const pOwnerSeed = SUNIT_GetOwnerUnit113c(m, mis, game) >>> 0
  SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c(
    m,
    game,
    mis,
    wSubMissile1,
    pOwnerSeed,
    nCount,
    nSpread,
    nSkill,
    nLevel,
  )
  return 1
}

/**
 * [21/45] Missile hit handler (`0x6FC5D8C0`): returns `2` when `pHitUnit` is not a `MonStats2`
 * bit-`0x0B` monster; otherwise deals radial stats damage and spawns an 18-ring of `wSubMissile1`
 * (`0x6FC5CEC0`).
 *
 * @va D2Game:0x6FC5D8C0
 */
export function MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5D8C0)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  if (((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const pOwner =
    SUNIT_GetServerUnit113c(m, game, i32(m, (mis + 0x94) >>> 0), i32(m, (mis + 0x98) >>> 0)) >>> 0
  if (pOwner === 0) return 1

  const hit = pHitUnit >>> 0
  if (hit !== 0) {
    if (i32(m, hit) !== 1) return 2
    if ((MONSTATS2_CheckFlagBit113c(m, i32(m, (hit + 0x04) >>> 0), 0x0b) | 0) === 0) {
      return 2
    }
  }

  const posX = UNIT_GetPosX113c(m, mis) | 0
  const posY = UNIT_GetPosY113c(m, mis) | 0

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    MISSILE_BuildDamageStrcFromStats113c(m, mis, hit, pDmg)

    let nRadius = i32(m, (pMissilesTxt + 0x4c) >>> 0)
    if (nRadius <= 0) {
      const nSkill = MISSILE_GetSkill113c(m, mis) | 0
      const nLevel = MISSILE_GetLevel113c(m, mis) | 0
      const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, nSkill) >>> 0
      if (pSkillsTxt === 0) return 1
      nRadius =
        SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x64) >>> 0), nSkill, nLevel) | 0
      if (nRadius < 1) nRadius = 1
    }

    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
    )
    AURA_ForEachUnitInRadius113c(
      m,
      game,
      pOwner,
      posX,
      posY,
      nRadius,
      0x8583,
      0x6fcc1210,
      pDmg,
      0,
      AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
    )

    let nStep = i32(m, (pMissilesTxt + 0x50) >>> 0)
    if (nStep < 1) nStep = 1
    const wSubMissile1 = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
    MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c(m, mis, game, wSubMissile1, nRadius, nStep)
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [22/45] Missile explosion handler (`0x6FC5DEF0`): applies radial stats damage within `dwParam1`
 * or `dwAuraRangeCalc` (`+0x64`), and if `wSubMissile1 >= 0`, spawns an 18-ring (`0x6FC5CEC0`) with
 * linear skill `param3/param4` range (`0x6FC21A40`).
 *
 * @va D2Game:0x6FC5DEF0
 */
export function MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5DEF0)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  const nSkill = MISSILE_GetSkill113c(m, mis) | 0
  const nLevel = MISSILE_GetLevel113c(m, mis) | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, nSkill)
  if (pSkillsTxt === 0) return 1

  if (((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) === 0) return 1
  const pOwner =
    SUNIT_GetServerUnit113c(m, game, i32(m, (mis + 0x94) >>> 0), i32(m, (mis + 0x98) >>> 0)) >>> 0
  if (pOwner === 0) return 1

  const posX = UNIT_GetPosX113c(m, mis) | 0
  const posY = UNIT_GetPosY113c(m, mis) | 0

  let nRadius = i32(m, (pMissilesTxt + 0x4c) >>> 0)
  if (nRadius <= 0) {
    nRadius =
      SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x64) >>> 0), nSkill, nLevel) | 0
    if (nRadius < 1) nRadius = 1
  }

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    MISSILE_BuildDamageStrcFromStats113c(m, mis, pHitUnit >>> 0, pDmg)
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
    )
    AURA_ForEachUnitInRadius113c(
      m,
      game,
      pOwner,
      posX,
      posY,
      nRadius,
      0x8583,
      0x6fcc1210,
      pDmg,
      0,
      AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
    )

    const wSubMissile1 = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
    if (wSubMissile1 >= 0) {
      const nRingRange = SKILLS_EvalLinearParam34_6FC21A40_113c(m, nSkill, nLevel) | 0
      let nStep = i32(m, (pMissilesTxt + 0x50) >>> 0)
      if (nStep < 1) nStep = 1
      MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c(m, mis, game, wSubMissile1, nRingRange, nStep)
    }
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [23/45] Meteor-style impact handler (`0x6FC5E0B0`): zeroes cold/freeze stats (`0x38`, `0x86`) and
 * spawns circular area `wSubMissile1` patches (`0x6FC5D450`), then applies radial `EType` blast
 * damage (`0x6FC5A280` + `0x6FCC0C70`) within `dwParam2` or `calc2` (`+0x13C`), returning `3`.
 *
 * @va D2Game:0x6FC5E0B0
 */
export function MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
  pHitUnit: number,
): number {
  hitD2GameVa113c(0x6FC5E0B0)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 1
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 1
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 1
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 1
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 1

  const nSkill = MISSILE_GetSkill113c(m, mis) | 0
  const nLevel = MISSILE_GetLevel113c(m, mis) | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, nSkill)
  if (pSkillsTxt === 0) return 1

  const pOwner0 =
    ((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) !== 0
      ? SUNIT_GetServerUnit113c(
          m,
          game,
          i32(m, (mis + 0x94) >>> 0),
          i32(m, (mis + 0x98) >>> 0),
        ) >>> 0
      : 0

  const wSubMissile1 = sx16(m.u16((pMissilesTxt + 0x24) >>> 0))
  if (wSubMissile1 >= 0) {
    STATLIST_SetUnitStat113c(m, mis, 0x38, 0, 0)
    STATLIST_SetUnitStat113c(m, mis, 0x86, 0, 0)
    let nAreaRadius = i32(m, (pMissilesTxt + 0x4c) >>> 0)
    if (nAreaRadius <= 0) {
      nAreaRadius =
        SKILLS_EvalCalcByOffset113c(
          m,
          pOwner0,
          m.u32((pSkillsTxt + 0x138) >>> 0),
          nSkill,
          nLevel,
        ) | 0
      if (nAreaRadius < 1) nAreaRadius = 1
    }
    const nRangeOverride =
      MISSILE_ResolveSkillIdByCodeOrRef113c(
        m,
        mis,
        pOwner0,
        m.u32((pMissilesTxt + 0x88) >>> 0),
        classId,
        nLevel,
      ) | 0
    MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c(
      m,
      game,
      mis,
      nAreaRadius,
      wSubMissile1,
      nRangeOverride,
    )
  }

  let nBlastRadius = i32(m, (pMissilesTxt + 0x50) >>> 0)
  if (nBlastRadius <= 0) {
    nBlastRadius =
      SKILLS_EvalCalcByOffset113c(m, pOwner0, m.u32((pSkillsTxt + 0x13c) >>> 0), nSkill, nLevel) | 0
    if (nBlastRadius < 1) nBlastRadius = 1
  }

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x74) >>> 0
  try {
    const pDmg = sp
    m.fill(pDmg, 0x70, 0)
    MISSILES_PopulateDamageByEType_6FC5A280_113c(m, mis, pDmg, pHitUnit >>> 0)
    m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
    m.setU16(
      (pDmg + 0x04) >>> 0,
      (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
    )
    const posY = readUnitPosYInline113c(m, mis)
    const posX = readUnitPosXInline113c(m, mis)

    if (((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
      const pOwner =
        SUNIT_GetServerUnit113c(
          m,
          game,
          i32(m, (mis + 0x94) >>> 0),
          i32(m, (mis + 0x98) >>> 0),
        ) >>> 0
      if (pOwner !== 0) {
        AURA_ForEachUnitInRadius113c(
          m,
          game,
          pOwner,
          posX,
          posY,
          nBlastRadius,
          0x8583,
          0x6fcc1210,
          pDmg,
          0,
          AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
        )
      }
    }
    return 3
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [24/45] Missile movement tick (`0x6FC5F550`): spawns `wSubMissile1..3` (`+0x18..+0x1C`) when
 * `MISSILE_GetElapsedFrames` equals `dwSubLoop1..3` (`+0x38..+0x40`), then delegates to
 * `MISSILE_SrvDo01_LinearProjectile113c`.
 *
 * @va D2Game:0x6FC5F550
 */
export function MISSILE_SrvDo_SpawnTimedSubMissilesAndStep_6FC5F550_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC5F550)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 2
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 2
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 2
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  if (pMissilesBase === 0) return 2
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 2

  for (let slot = 0; slot < 3; slot++) {
    const wSub = sx16(m.u16((pMissilesTxt + 0x18 + slot * 2) >>> 0))
    if (wSub > 0) {
      const elapsed = MISSILE_GetElapsedFrames113c(m, mis) | 0
      if (elapsed === i32(m, (pMissilesTxt + 0x38 + slot * 4) >>> 0)) {
        const posY = UNIT_GetPosY113c(m, mis) | 0
        const posX = UNIT_GetPosX113c(m, mis) | 0
        const nLevel = MISSILE_GetLevel113c(m, mis) | 0
        const nSkill = MISSILE_GetSkill113c(m, mis) | 0
        const pOwner = SUNIT_GetOwnerUnit113c(m, mis, game) >>> 0
        SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
          m,
          pOwner,
          game,
          nSkill,
          nLevel,
          wSub,
          posX,
          posY,
        )
      }
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, mis, game) | 0
}

/**
 * [25/45] Redemption / corpse-pulse missile tick (`0x6FC5F6D0`): scans corpses (`0x3002`, skill `0x7C`,
 * level `1`) via `0x6FC59930` when `1 < remFrames < 25` or `0x6FC59910` when `remFrames == 1`, then
 * steps via `MISSILE_SrvDo01_LinearProjectile113c`.
 *
 * @va D2Game:0x6FC5F6D0
 */
export function MISSILE_SrvDo_RedemptionCorpsePulseAndStep_6FC5F6D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC5F6D0)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  const remFrames = MISSILE_GetRemainingFrames113c(m, mis) | 0
  if (remFrames > 1 && remFrames < 0x19) {
    const posY = readUnitPosYInline113c(m, mis)
    const posX = readUnitPosXInline113c(m, mis)
    SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c(
      m,
      0x3002,
      posX,
      game,
      posY,
      mis,
      0x7c,
      1,
      0x6fc59930,
      {
        onIndirectCall: (mem, cb, cbGame, cbOwner, pCand, lvl, arg3) => {
          if (cb === 0x6fc59930) {
            SKILLS_RedemptionCorpseCallback_6FC59930_113c(mem, cbGame, cbOwner, pCand, lvl, arg3)
          }
          return 0
        },
      },
    )
  } else if (remFrames === 1) {
    const posY = readUnitPosYInline113c(m, mis)
    const posX = readUnitPosXInline113c(m, mis)
    SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c(
      m,
      0x3002,
      posX,
      game,
      posY,
      mis,
      0x7c,
      1,
      0x6fc59910,
      {
        onIndirectCall: (mem, cb, cbGame, cbOwner, pCand, lvl, arg3) => {
          if (cb === 0x6fc59910) {
            return MISSILES_RedeemCorpseWithSkill124_6FC59910_113c(
              mem,
              cbGame,
              cbOwner,
              pCand,
              lvl,
              arg3,
            )
          }
          return 0
        },
      },
    )
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, mis, game) | 0
}


/**
 * [26/45] Periodic radial missile tick (`0x6FC60280`): every `dwSubLoop1` (`+0x38`) or `calc4`
 * (`+0x144`) frames, builds `D2DamageStrc` from missile stats (`0x6FC5A4E0`) and deals radial
 * damage (`0x6FCC1210`) around `pMissile`, then advances via `MISSILE_SrvDo01_LinearProjectile113c`.
 *
 * @va D2Game:0x6FC60280
 */
export function MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC60280)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 2
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 2
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 2
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 2

  const nSkill = MISSILE_GetSkill113c(m, mis) | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, nSkill)
  if (pSkillsTxt === 0) return 2

  const pOwner =
    ((m.u32((mis + 0xc8) >>> 0) >>> 10) & 1) !== 0
      ? SUNIT_GetServerUnit113c(
          m,
          game,
          i32(m, (mis + 0x94) >>> 0),
          i32(m, (mis + 0x98) >>> 0),
        ) >>> 0
      : 0

  const nLevel = MISSILE_GetLevel113c(m, mis) | 0
  const elapsed = MISSILE_GetElapsedFrames113c(m, mis) | 0
  let nPeriod = i32(m, (pMissilesTxt + 0x38) >>> 0)
  if (nPeriod <= 0) {
    nPeriod =
      SKILLS_EvalCalcByOffset113c(m, pOwner, m.u32((pSkillsTxt + 0x144) >>> 0), nSkill, nLevel) | 0
    if (nPeriod < 1) nPeriod = 1
  }

  if ((elapsed % nPeriod | 0) === 0) {
    const sp = k2W6B1StackPtr
    k2W6B1StackPtr = (sp + 0x74) >>> 0
    try {
      const pDmg = sp
      m.fill(pDmg, 0x70, 0)
      MISSILE_BuildDamageStrcFromStats113c(m, mis, 0, pDmg)
      let nRadius = i32(m, (pMissilesTxt + 0x3c) >>> 0)
      if (nRadius <= 0) {
        nRadius =
          SKILLS_EvalCalcByOffset113c(
            m,
            pOwner,
            m.u32((pSkillsTxt + 0x64) >>> 0),
            nSkill,
            nLevel,
          ) | 0
        if (nRadius < 1) nRadius = 1
      }
      m.setU32(pDmg, (m.u32(pDmg) | m.u32((pMissilesTxt + 0xa8) >>> 0)) >>> 0)
      m.setU16(
        (pDmg + 0x04) >>> 0,
        (m.u16((pDmg + 0x04) >>> 0) | m.u16((pMissilesTxt + 0xac) >>> 0)) & 0xffff,
      )
      let dwFilter = m.u32((pSkillsTxt + 0x50) >>> 0) >>> 0
      if (dwFilter === 0) dwFilter = 0x8583
      AURA_ForEachUnitInRadius113c(
        m,
        game,
        mis,
        0,
        0,
        nRadius,
        dwFilter,
        0x6fcc1210,
        pDmg,
        0,
        AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
      )
    } finally {
      k2W6B1StackPtr = sp
    }
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, mis, game) | 0
}

/**
 * [27/45] Periodic sub-missile spawner (`0x6FC60420`): requires `wSubMissile1 != 0` (`+0x18`),
 * spawns `wSubMissile1` every `max(dwSubLoop1, 1)` (`+0x38`) frames, then steps via `0x6FC5F320`.
 *
 * @va D2Game:0x6FC60420
 */
export function MISSILE_SrvDo_PeriodicSubMissile1AndStep_6FC60420_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC60420)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 2
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 2
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 2
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 2

  const wSub1 = sx16(m.u16((pMissilesTxt + 0x18) >>> 0))
  if (wSub1 === 0) return 2

  const elapsed = MISSILE_GetElapsedFrames113c(m, mis) | 0
  let nPeriod = i32(m, (pMissilesTxt + 0x38) >>> 0)
  if (nPeriod < 1) nPeriod = 1
  if ((elapsed % nPeriod | 0) === 0) {
    const posY = UNIT_GetPosY113c(m, mis) | 0
    const posX = UNIT_GetPosX113c(m, mis) | 0
    const nLevel = MISSILE_GetLevel113c(m, mis) | 0
    const nSkill = MISSILE_GetSkill113c(m, mis) | 0
    const pOwner = SUNIT_GetOwnerUnit113c(m, mis, game) >>> 0
    SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
      m,
      pOwner,
      game,
      nSkill,
      nLevel,
      wSub1,
      posX,
      posY,
    )
  }
  return MISSILE_SrvDo01_LinearProjectile113c(m, mis, game) | 0
}

/**
 * [28/45] Blaze-style owner-following trail controller (`0x6FC61EB0`): spawns `wSubMissile1` (`+0x18`)
 * whenever `PATH_CheckFlag08_113c` (`0x6FD5CE90`) is set on `pMissile->pPath`, then delegates to
 * `MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c`.
 *
 * @va D2Game:0x6FC61EB0
 */
export function MISSILE_SrvDo_BlazeTrailAndFollowOwner_6FC61EB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pMissile: number,
): number {
  hitD2GameVa113c(0x6FC61EB0)
  const game = pGame >>> 0
  const mis = pMissile >>> 0
  if (mis === 0) return 2
  const classId = i32(m, (mis + 0x04) >>> 0)
  if (classId < 0) return 2
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0 || classId >= i32(m, (pDataTables + 0xb6c) >>> 0)) return 2
  const pMissilesBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  const pMissilesTxt = (pMissilesBase + imul32(classId, 0x1a4)) >>> 0
  if (pMissilesTxt === 0) return 2

  const wSub1 = sx16(m.u16((pMissilesTxt + 0x18) >>> 0))
  if (wSub1 !== 0) {
    const pPath = m.u32((mis + 0x2c) >>> 0) >>> 0
    if ((PATH_CheckFlag08_113c(m, pPath) | 0) !== 0) {
      const posY = UNIT_GetPosY113c(m, mis) | 0
      const posX = UNIT_GetPosX113c(m, mis) | 0
      const nLevel = MISSILE_GetLevel113c(m, mis) | 0
      const nSkill = MISSILE_GetSkill113c(m, mis) | 0
      const pOwner = SUNIT_GetOwnerUnit113c(m, mis, game) >>> 0
      SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
        m,
        pOwner,
        game,
        nSkill,
        nLevel,
        wSub1,
        posX,
        posY,
      )
    }
  }
  return MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c(m, game, mis) | 0
}

/**
 * [29/45] Spawns server projectile `nMissileId` from `pCaster` (`eax`) at `pTargetUnit`'s (`edi`)
 * coordinates via `0x6FCC0000` only when both units are outside town (`0x6FC62510`).
 *
 * @va D2Game:0x6FC62510
 */
export function SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c(
  m: D2KernMemory113c,
  pCaster: number,
  pTargetUnit: number,
  pGame: number,
  nMissileId: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC62510)
  const caster = pCaster >>> 0
  const target = pTargetUnit >>> 0
  if (caster === 0 || target === 0) return 0
  if ((DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, caster) >>> 0) | 0) !== 0) {
    return 0
  }
  if ((DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, target) >>> 0) | 0) !== 0) {
    return 0
  }
  const posY = UNIT_GetPosY113c(m, target) | 0
  const posX = UNIT_GetPosX113c(m, target) | 0
  return (
    SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
      m,
      caster,
      pGame >>> 0,
      nSkillId | 0,
      nSkillLevel | 0,
      nMissileId | 0,
      posX,
      posY,
    ) >>> 0
  )
}

/**
 * [30/45] Skill cast handler (`0x6FC62D90`): sets `UNITFLAG_SKSRVDOFUNC` (`0x40`), verifies
 * `SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c` for `wSrvMissile` (`+0x48`) and distance
 * `<= 100`, and spawns the server projectile (`0x6FC8F930`).
 *
 * @va D2Game:0x6FC62D90
 */
export function SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC62D90)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, skillId)
  if (pSkillsTxt === 0) return 0
  const nMissileId = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  const pDataTables = readSgptDataTables113c(m)
  if (nMissileId < 0 || pDataTables === 0 || nMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
    return 0
  }
  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  }
  if ((SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c(m, nMissileId, game, unit) | 0) === 0) {
    return 0
  }
  if (unit === 0) return 0

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x68) >>> 0
  try {
    const pOutX = sp
    const pOutY = (sp + 0x04) >>> 0
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)
    SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, unit, game, pOutX, pOutY)
    const tx = i32(m, pOutX)
    const ty = i32(m, pOutY)
    if (tx === 0 && ty === 0) return 0
    if ((UNITS_GetUnitDistanceToCoordinates113c(m, unit, tx, ty) >>> 0) > 0x64) return 0

    const pParams = (sp + 0x08) >>> 0
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 1)
    m.setU32((pParams + 0x04) >>> 0, unit)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, tx >>> 0)
    m.setU32((pParams + 0x18) >>> 0, ty >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)
    return MISSILE_CreateServerProjectile113c(m, game, pParams) !== 0 ? 1 : 0
  } finally {
    k2W6B1StackPtr = sp
  }
}


/**
 * [31/45] Fire Wall perpendicular controller spawner (`0x6FC637D0`): validates target non-town
 * room and `0x6FCC0630`, spawns two opposing perpendicular controller projectiles (`dwFlags = 0x21`)
 * for `wSrvMissile` (`+0x48`), and optionally spawns `wSrvMissileA` (`+0x4A`, `dwFlags = 1`).
 *
 * @va D2Game:0x6FC637D0
 */
export function SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC637D0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, skillId)
  if (pSkillsTxt === 0) return 0
  const nMissileId = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
  const pDataTables = readSgptDataTables113c(m)
  if (nMissileId < 0 || pDataTables === 0 || nMissileId >= i32(m, (pDataTables + 0xb6c) >>> 0)) {
    return 0
  }
  if ((SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c(m, nMissileId, game, unit) | 0) === 0) {
    return 0
  }

  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  let tx = 0
  let ty = 0
  if (pTarget !== 0 && pTarget !== unit) {
    tx = UNIT_GetPosX113c(m, pTarget) | 0
    ty = UNIT_GetPosY113c(m, pTarget) | 0
  } else {
    tx = PATH_GetFirstPointX113c(m, pPath) | 0
    ty = PATH_GetFirstPointY113c(m, pPath) | 0
  }
  if (tx === 0 || ty === 0) return 0

  const pStartRoom = UNITS_GetRoom113c(m, unit) >>> 0
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pStartRoom, tx, ty) >>> 0
  if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) | 0) !== 0) return 0

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x60) >>> 0
  try {
    const pParams = sp
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 0x21)
    m.setU32((pParams + 0x04) >>> 0, unit)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, tx >>> 0)
    m.setU32((pParams + 0x18) >>> 0, ty >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, nSkillLevel >>> 0)

    const dx = ((UNIT_GetPosX113c(m, unit) | 0) - tx) | 0
    const dy = ((UNIT_GetPosY113c(m, unit) | 0) - ty) | 0

    m.setU32((pParams + 0x1c) >>> 0, ((tx - dy) | 0) >>> 0)
    m.setU32((pParams + 0x20) >>> 0, ((ty + dx) | 0) >>> 0)
    MISSILE_CreateServerProjectile113c(m, game, pParams)

    m.setU32((pParams + 0x1c) >>> 0, ((tx + dy) | 0) >>> 0)
    m.setU32((pParams + 0x20) >>> 0, ((ty - dx) | 0) >>> 0)
    MISSILE_CreateServerProjectile113c(m, game, pParams)

    const wSrvMissileA = sx16(m.u16((pSkillsTxt + 0x4a) >>> 0))
    const pTablesNow = readSgptDataTables113c(m)
    if (
      wSrvMissileA >= 0 &&
      pTablesNow !== 0 &&
      wSrvMissileA < i32(m, (pTablesNow + 0xb6c) >>> 0)
    ) {
      m.setU32(pParams, 1)
      m.setU32((pParams + 0x10) >>> 0, wSrvMissileA >>> 0)
      m.setU32((pParams + 0x1c) >>> 0, 0)
      m.setU32((pParams + 0x20) >>> 0, 0)
      MISSILE_CreateServerProjectile113c(m, game, pParams)
    }
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [32/45] Blizzard / Meteor controller cast handler (`0x6FC652C0`): resolves charged `srvmissile`
 * (`0x6FCB1340`), validates target spawnability (`0x6FCC0630`), rolls a `0..255` seed byte into
 * `targetX`, and queues `0xA3` aura-target FX (`0x6FC9A190`).
 *
 * @va D2Game:0x6FC652C0
 */
export function SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC652C0)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const lvl = nSkillLevel | 0
  if (lookupSkillsTxt113c(m, skillId) === 0) return 0

  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, unit) | 0
  if (nMissileId <= 0) return 0

  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x68) >>> 0
  try {
    const pOutX = sp
    const pOutY = (sp + 0x04) >>> 0
    m.setU32(pOutX, 0)
    m.setU32(pOutY, 0)
    if (
      (SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, unit, game, pOutX, pOutY) | 0) === 0
    ) {
      return 0
    }
    if ((SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c(m, nMissileId, game, unit) | 0) === 0) {
      return 0
    }
    if (unit !== 0) {
      m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
    }

    const bRoll = rollSeedPtr113c(m, (unit + 0x20) >>> 0, 0x100) & 0xff
    const tx = i32(m, pOutX)
    const ty = i32(m, pOutY)

    const pParams = (sp + 0x08) >>> 0
    m.fill(pParams, 0x5c, 0)
    m.setU32(pParams, 1)
    m.setU32((pParams + 0x04) >>> 0, unit)
    m.setU32((pParams + 0x10) >>> 0, nMissileId >>> 0)
    m.setU32((pParams + 0x14) >>> 0, tx >>> 0)
    m.setU32((pParams + 0x18) >>> 0, ty >>> 0)
    m.setU32((pParams + 0x2c) >>> 0, skillId >>> 0)
    m.setU32((pParams + 0x30) >>> 0, lvl >>> 0)

    const pMis = MISSILE_CreateServerProjectile113c(m, game, pParams) >>> 0
    if (pMis === 0) return 0

    MISSILE_SetTargetX113c(m, pMis, bRoll)
    UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(m, unit, 0, skillId, lvl, tx, ty, bRoll)
    return 1
  } finally {
    k2W6B1StackPtr = sp
  }
}

/**
 * [33/45] Periodic aura storm strike handler (`0x6FC65850`, e.g. Hurricane / Armageddon meteor
 * pulse): cancels state/event `5` in town when `!InTown`, reschedules event `5` by `Param4`, and
 * attempts up to 5 LOS-clear subtile strikes within `dwAuraRangeCalc` (`+0x64`).
 *
 * @va D2Game:0x6FC65850
 */
export function SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC65850)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const lvl = nSkillLevel | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, skillId)
  const pDataTables = readSgptDataTables113c(m)
  if (pSkillsTxt === 0 || pDataTables === 0 || lvl <= 0) {
    EVENT_DeleteEventByArg14_113c(m, game, unit, 5, skillId)
    return 0
  }
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (
    wAuraState < 0 ||
    wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0) ||
    (STATES_CheckState113c(m, unit, wAuraState) | 0) === 0
  ) {
    EVENT_DeleteEventByArg14_113c(m, game, unit, 5, skillId)
    return 0
  }

  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const maskBit0 = pMasks !== 0 ? m.u8(pMasks) : 1
  if ((m.u8((pSkillsTxt + 0x05) >>> 0) & maskBit0) === 0) {
    const pUnitRoom = UNITS_GetRoom113c(m, unit) >>> 0
    if (pUnitRoom !== 0 && (DUNGEON_CheckRoomIsTownMemPort113c(m, pUnitRoom) | 0) !== 0) {
      const pSubList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, unit, wAuraState) >>> 0
      if (pSubList !== 0) {
        STATLIST_UnlinkSubList113c(m, unit, pSubList)
        STATLIST_FreeStatListIfNonExtended113c(m, pSubList)
      }
      STATES_ToggleGfxStateFlag113c(m, unit, wAuraState, 0)
      EVENT_DeleteEventByArg14_113c(m, game, unit, 5, skillId)
      return 0
    }
  }

  const nMissileId = SKILLS_ResolveChargedSrvMissileId113c(m, skillId, unit) | 0
  if (nMissileId <= 0) {
    EVENT_DeleteEventByArg14_113c(m, game, unit, 5, skillId)
    return 0
  }
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, skillId) >>> 0
  const pSeed = (unit + 0x20) >>> 0
  if (pSkill === 0 || pSeed === 0) {
    EVENT_DeleteEventByArg14_113c(m, game, unit, 5, skillId)
    return 0
  }

  const nRadius =
    SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x64) >>> 0), skillId, lvl) | 0
  if (nRadius <= 0) {
    EVENT_DeleteEventByArg14_113c(m, game, unit, 5, skillId)
    return 0
  }

  const nextFrame = (SKILLS_GetParam4Fast_6FC21C20_113c(m, skillId) + i32(m, (game + 0xa8) >>> 0)) | 0
  EVENT_DeleteEventByArg14_113c(m, game, unit, 5, skillId)
  EVENT_SetEventFull113c(m, game, unit, 5, nextFrame, 0, skillId, lvl)

  let pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  if (pRoom === 0 || (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) | 0) !== 0) {
    return 0
  }

  SEED_InitLowSeed113c(m, pSeed, SKILLS_GetParam1113c(m, pSkill) | 0)
  SKILLS_SetParam1113c(m, pSkill, rollSeedPtr113c(m, pSeed, 0xf4240))
  UNIT_GetPosX113c(m, unit)
  UNIT_GetPosY113c(m, unit)

  const span = (nRadius * 2 + 1) | 0
  for (let attempt = 0; attempt < 5; attempt++) {
    const candX = (rollSeedPtr113c(m, pSeed, span) - nRadius + (UNIT_GetPosX113c(m, unit) | 0)) | 0
    const candY = (rollSeedPtr113c(m, pSeed, span) - nRadius + (UNIT_GetPosY113c(m, unit) | 0)) | 0
    if ((SKILLS_TestLineOfSightFromUnitToTarget113c(m, candX, candY, unit, 0x805) | 0) !== 0) {
      pRoom = ROOM_FindRoomContainingSubtile113c(m, pRoom, candX, candY) >>> 0
      if (pRoom !== 0 && (COLLISION_CheckSubtileMask113c(m, pRoom, candX, candY, 1) & 0xffff) === 0) {
        SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
          m,
          unit,
          game,
          skillId,
          lvl,
          nMissileId,
          candX,
          candY,
        )
        UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(m, unit, 0, skillId, lvl, candX, candY, 0)
        return 1
      }
    }
  }
  return 0
}


/**
 * [34/45] Toggle or apply a timed skill aura state with stat calcs and skill slot index `0x0A`.
 *
 * @dll D2Game.dll
 * @va 0x6FC66210
 * @ordinalOrName D2Game_6FC66210
 */
export function SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC66210)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const lvl = nSkillLevel | 0
  if (skillId < 0) return 0
  const pDataTables = readSgptDataTables113c(m)
  if (pDataTables === 0) return 0
  if (skillId >= i32(m, (pDataTables + 0xba0) >>> 0)) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  if (pSkillsBase === 0) return 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wAuraState < 0 || wAuraState >= i32(m, (pDataTables + 0xc4) >>> 0)) return 0

  if (unit !== 0) {
    m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x40) >>> 0)
  }

  if ((STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(m, unit, wAuraState, 1) | 0) !== 0) {
    SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c(m, unit, skillId, game, lvl)
    return 0
  }

  const nDuration =
    SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x60) >>> 0), skillId, lvl) | 0
  if (STATLIST_GetStatListFromUnitAndStateMemPort113c(m, unit, wAuraState) !== 0) {
    return 0
  }

  let ownerType = 6
  let ownerId = -1
  if (unit !== 0) {
    ownerId = i32(m, (unit + 0x0c) >>> 0)
    ownerType = i32(m, unit)
  }
  const expireFrame = ((game !== 0 ? i32(m, (game + 0xa8) >>> 0) : 0) + nDuration) | 0
  const pSubList = STATLIST_AllocList113c(m, 2, ownerType, ownerId, 0, expireFrame) >>> 0
  if (pSubList === 0) return 0
  if (game !== 0) {
    m.setU32(pSubList, m.u32((game + 0x1c) >>> 0))
  }

  STATLIST_SetState113c(m, pSubList, wAuraState)
  STATLIST_SetStatRemoveProc113c(m, pSubList, 0x6fc64a60)
  STATLIST_MergeStatLists113c(m, unit, pSubList, 1)
  STATES_ToggleGfxStateFlag113c(m, unit, wAuraState, 1)
  EVENT_SetEventFull113c(m, game, unit, 0x0c, expireFrame, 0, 0, 0)
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, pSkillsTxt, unit, pSubList, skillId, lvl)
  STATLIST_SetStat113c(m, pSubList, 0x15e, skillId, 0)
  STATLIST_SetStat113c(m, pSubList, 0x15f, lvl, 0)

  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, unit, skillId) >>> 0
  if (pSkill !== 0) {
    SKILLS_SetSkillSlotIndex113c(m, pSkill, 0x0a)
  }
  return 1
}

/**
 * [35/45] Release charged melee skill hit on path target, apply secondary aura/charged missile, and deal elemental duration damage.
 *
 * @dll D2Game.dll
 * @va 0x6FC66A20
 * @ordinalOrName D2Game_6FC66A20
 */
export function SKILLS_SrvDo_ReleaseChargedMeleeHitWithSecondaryAura_6FC66A20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC66A20)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const lvl = nSkillLevel | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, skillId)
  if (pSkillsTxt === 0 || unit === 0) return 0

  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === unit || pTarget === 0) return 0

  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, unit) >>> 0
  if (pUsedSkill === 0) return 0
  if ((SKILLS_GetSkillIdFromSkill113c(m, pUsedSkill, 0x6fd1c3a8, 0x3c7) | 0) !== skillId) {
    return 0
  }
  const nChargeCount = SKILLS_GetParam1113c(m, pUsedSkill) | 0
  if (nChargeCount === 0) return 0

  SKILLS_SetParam1113c(m, pUsedSkill, 0)
  SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c(m, game, unit, lvl)
  SUNITDMG_ExecuteEvents113c(m, game, unit, pTarget, 1, 0)

  const nDuration = SKILLS_GetSkillPeriodicDelayOrLength113c(m, unit, skillId, lvl, 1) | 0
  SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c(
    m,
    game,
    unit,
    nDuration,
    skillId,
    lvl,
    lvl,
    pTarget,
  )
  SKILLS_ApplySkillDamageWithElemDuration_6FC651B0_113c(
    m,
    skillId,
    unit,
    pTarget,
    game,
    nDuration,
    pSkillsTxt,
    lvl,
  )
  return 1
}


/**
 * [36/45] Close NPC interaction for a player, fire quest callback event 2, unlink trade node, and free gamble inventory when empty.
 *
 * @dll D2Game.dll
 * @va 0x6FC685C0
 * @ordinalOrName D2Game_6FC685C0
 */
export function NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pNpcUnit: number,
  pNpcRecord: number,
): void {
  hitD2GameVa113c(0x6FC685C0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const npcUnit = pNpcUnit >>> 0
  const npcRecord = pNpcRecord >>> 0
  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x20) >>> 0
  try {
    for (let off = 0; off < 0x20; off += 4) {
      m.setU32((sp + off) >>> 0, 0)
    }
    m.setU32(sp, game)
    m.setU32((sp + 0x04) >>> 0, 2)
    m.setU32((sp + 0x08) >>> 0, npcUnit)
    m.setU32((sp + 0x0c) >>> 0, player)
    QUESTS_TriggerCallback113c(m, sp, 1, 1)
  } finally {
    k2W6B1StackPtr = sp
  }

  if (npcRecord === 0) return
  let pPrev = 0
  let pNode = m.u32(npcRecord) >>> 0
  while (pNode !== 0) {
    if (m.u32(pNode) >>> 0 === player) {
      const nState = i32(m, (pNode + 0x04) >>> 0)
      if (nState >= 1) {
        const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
        if (pPrev === 0) {
          m.setU32(npcRecord, pNext)
        } else {
          m.setU32((pPrev + 0x08) >>> 0, pNext)
        }
        if (player !== 0 && m.u8((player + 0x6c) >>> 0) !== 0 && i32(m, (player + 0x68) >>> 0) === 1) {
          m.setU32((player + 0x64) >>> 0, 0xffffffff)
          m.setU32((player + 0x68) >>> 0, 6)
          m.setU8((player + 0x6c) >>> 0, 0)
        }
        if (m.u32(npcRecord) >>> 0 === 0) {
          NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c(m, npcRecord, player, game)
        }
        return
      }
      if (nState === 0) {
        const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
        if (pPrev === 0) {
          m.setU32(npcRecord, pNext)
        } else {
          m.setU32((pPrev + 0x08) >>> 0, pNext)
        }
        if (player !== 0 && m.u8((player + 0x6c) >>> 0) !== 0 && i32(m, (player + 0x68) >>> 0) === 1) {
          m.setU32((player + 0x64) >>> 0, 0xffffffff)
          m.setU32((player + 0x68) >>> 0, 6)
          m.setU8((player + 0x6c) >>> 0, 0)
        }
        return
      }
    }
    pPrev = pNode
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
}

/**
 * [37/45] Prepare Strafe-style multi-target ranged skill parameters (shot count and initial target) and consume ammo.
 *
 * @dll D2Game.dll
 * @va 0x6FC6C870
 * @ordinalOrName D2Game_6FC6C870
 */
export function SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FC6C870)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  const skillId = nSkillId | 0
  const lvl = nSkillLevel | 0
  const pSkillsTxt = lookupSkillsTxt113c(m, skillId)
  if (pSkillsTxt === 0) return 0
  const pUsedSkill = SKILLS_GetUsedSkillMemPort113c(m, unit) >>> 0
  if (pUsedSkill === 0) return 0

  if ((SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c(m, unit) | 0) === 0) {
    PLAYER_ScheduleSkillActionFrameEvents113c(m, game, unit, 0, 0)
    PLAYER_StartModeCast113c(m, game, unit, 0)
    return 0
  }

  const nRadius =
    SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x64) >>> 0), skillId, lvl) | 0
  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = unit !== 0 ? m.u32((unit + 0x2c) >>> 0) >>> 0 : 0
  const rawTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  let pTarget = rawTarget === unit ? 0 : rawTarget

  let nFoundCount = 0
  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU32(sp, 0)
    if (pTarget === 0) {
      pTarget =
        SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(
          m,
          3,
          nRadius,
          -1,
          sp,
          0,
          game,
          unit,
          0,
        ) >>> 0
      nFoundCount = i32(m, sp)
    } else {
      nFoundCount = SKILLS_CountUnitsInRadius_6FCC0FC0_113c(m, 3, nRadius, 0, game, unit, 0) | 0
    }
  } finally {
    k2W6B1StackPtr = sp
  }

  let nMinShots =
    SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x140) >>> 0), skillId, lvl) | 0
  const nMaxShots =
    SKILLS_EvalCalcByOffset113c(m, unit, m.u32((pSkillsTxt + 0x138) >>> 0), skillId, lvl) | 0
  if (nMinShots > nMaxShots) {
    nMinShots = nMaxShots
  }
  let nShots = nMinShots
  if (nFoundCount > nShots) {
    nShots = nFoundCount
  }
  if (nShots >= nMaxShots) {
    nShots = nMaxShots
  }

  SKILLS_SetParam1113c(m, pUsedSkill, nShots)
  if (pTarget !== 0) {
    SKILLS_SetParam2113c(m, pUsedSkill, i32(m, pTarget))
    SKILLS_SetParam3113c(m, pUsedSkill, i32(m, (pTarget + 0x0c) >>> 0))
  } else {
    SKILLS_SetParam2113c(m, pUsedSkill, 1)
    SKILLS_SetParam3113c(m, pUsedSkill, -1)
  }
  SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(m, unit, game)
  return 1
}

/**
 * [38/45] Test whether a monster unit is a valid selectable corpse for raise/corpse skills (MonStats2 bit 8, dead, corpse selectable, mode 7 allowed).
 *
 * @dll D2Game.dll
 * @va 0x6FC6EC30
 * @ordinalOrName D2Game_6FC6EC30
 */
export function SKILLS_IsMonsterCorpseUsableForRaise_6FC6EC30_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC6EC30)
  const unit = pUnit >>> 0
  if (unit === 0 || i32(m, unit) !== 1) return 0
  if ((MONSTATS2_CheckFlagBit113c(m, i32(m, (unit + 0x04) >>> 0), 8) | 0) === 0) return 0
  if ((SUNIT_IsDeadOrDying113c(m, unit) | 0) === 0) return 0
  if ((SKILLS_IsSelectableCorpseWithVelocity113c(m, unit, 0) | 0) === 0) return 0
  return (SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, unit, 7) | 0) !== 0 ? 1 : 0
}

/**
 * [39/45] Validate path target as a usable monster corpse for raise/corpse skills.
 *
 * @dll D2Game.dll
 * @va 0x6FC6ED60
 * @ordinalOrName D2Game_6FC6ED60
 */
export function SKILLS_SrvSt_ValidateTargetMonsterCorpse_6FC6ED60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _nSkillId = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FC6ED60)
  const game = pGame >>> 0
  const unit = pUnit >>> 0
  if (unit === 0) return 0
  SUNIT_ValidatePathTargetUnit113c(m, unit, game)
  const pPath = m.u32((unit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === unit || pTarget === 0 || i32(m, pTarget) !== 1) return 0
  if ((MONSTATS2_CheckFlagBit113c(m, i32(m, (pTarget + 0x04) >>> 0), 8) | 0) === 0) return 0
  if ((SUNIT_IsDeadOrDying113c(m, pTarget) | 0) === 0) return 0
  if ((SKILLS_IsSelectableCorpseWithVelocity113c(m, pTarget, 0) | 0) === 0) return 0
  return (SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, pTarget, 7) | 0) !== 0 ? 1 : 0
}

/**
 * [40/45] Test whether a monster target is eligible for Mind Blast / Conversion (alignment 0, mode 19 allowed, alive, non-town, hostile).
 *
 * @dll D2Game.dll
 * @va 0x6FC6EE80
 * @ordinalOrName D2Game_6FC6EE80
 */
export function SKILLS_CanConvertOrMindBlastTarget_6FC6EE80_113c(
  m: D2KernMemory113c,
  pTargetUnit: number,
  pCasterUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC6EE80)
  const target = pTargetUnit >>> 0
  const caster = pCasterUnit >>> 0
  const game = pGame >>> 0
  if (target === 0) return 0
  if ((UNIT_GetAlignment113c(m, target) | 0) !== 0) return 0
  if ((SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, target, 0x13) | 0) === 0) return 0
  if ((SUNIT_IsDeadOrDying113c(m, target) | 0) !== 0) return 0
  const pRoom = UNITS_GetRoom113c(m, target) >>> 0
  if ((DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) | 0) !== 0) return 0
  return (SUNIT_AreUnitsHostileOrUnaligned113c(m, target, caster, game) | 0) !== 0 ? 1 : 0
}


/**
 * [41/45] Apply standard Necromancer curse state, resist-scaled stats, monster AI override, and item events to a target unit.
 *
 * @dll D2Game.dll
 * @va 0x6FC70250
 * @ordinalOrName D2Game_6FC70250
 */
export function SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c(
  m: D2KernMemory113c,
  pTargetUnit: number,
  pCurseCtx: number,
): number {
  hitD2GameVa113c(0x6FC70250)
  const target = pTargetUnit >>> 0
  const ctx = pCurseCtx >>> 0
  if (ctx === 0) return 0

  const bSpecialMonsterAi = i32(m, (ctx + 0x08) >>> 0)
  if (bSpecialMonsterAi !== 0) {
    if (target === 0 || i32(m, target) !== 1) return 0
    if ((UNIT_GetAlignment113c(m, target) | 0) === 1) return 0
    const nCurseState = i32(m, (ctx + 0x4c) >>> 0)
    let nCheckMode = 0
    if (nCurseState === 0x17) {
      nCheckMode = 0x0a
    } else if (nCurseState === 0x1b) {
      nCheckMode = 0x0c
    } else if (nCurseState === 0x38) {
      nCheckMode = 0x0b
    }
    if ((SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, target, nCheckMode) | 0) === 0) {
      return 0
    }
  }

  const nPrimaryStatId = i32(m, (ctx + 0x1c) >>> 0)
  let nScaledPrimaryVal = 0
  if (nPrimaryStatId >= 0) {
    nScaledPrimaryVal =
      CURSES_ScaleImmuneMonsterResistPenalty113c(
        m,
        nPrimaryStatId,
        i32(m, (ctx + 0x34) >>> 0),
        target,
      ) | 0
    if (nScaledPrimaryVal === 0) return 0
  }

  const pGame = m.u32(ctx) >>> 0
  const pCaster = m.u32((ctx + 0x04) >>> 0) >>> 0
  if ((SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c(m, target, pGame, pCaster) | 0) === 0) {
    return 0
  }

  let pStatList = 0
  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x28) >>> 0
  try {
    m.setU32(sp, pCaster)
    m.setU32((sp + 0x04) >>> 0, target)
    m.setU32((sp + 0x08) >>> 0, m.u32((ctx + 0x10) >>> 0))
    m.setU32((sp + 0x0c) >>> 0, m.u32((ctx + 0x14) >>> 0))
    m.setU32((sp + 0x10) >>> 0, m.u32((ctx + 0x18) >>> 0))
    m.setU32((sp + 0x14) >>> 0, nPrimaryStatId >>> 0)
    m.setU32((sp + 0x18) >>> 0, nScaledPrimaryVal >>> 0)
    m.setU32((sp + 0x1c) >>> 0, m.u32((ctx + 0x4c) >>> 0))
    m.setU32((sp + 0x20) >>> 0, bSpecialMonsterAi !== 0 ? 0x6fc70130 : 0)
    pStatList = STATES_CreateOrUpdateAuraStatList113c(m, sp) >>> 0
  } finally {
    k2W6B1StackPtr = sp
  }
  if (pStatList === 0) return 0

  if (bSpecialMonsterAi !== 0) {
    SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(
      m,
      i32(m, (ctx + 0x10) >>> 0),
      target,
      m.u32(ctx) >>> 0,
    )
  }

  for (let i = 0; i < 5; i++) {
    const statId = i32(m, (ctx + 0x20 + i * 4) >>> 0)
    if (statId >= 0) {
      const pDataTables = readSgptDataTables113c(m)
      if (pDataTables !== 0 && statId < i32(m, (pDataTables + 0xbd4) >>> 0)) {
        const rawVal = i32(m, (ctx + 0x38 + i * 4) >>> 0)
        const scaledVal = CURSES_ScaleImmuneMonsterResistPenalty113c(m, statId, rawVal, target) | 0
        if (scaledVal !== 0) {
          STATLIST_SetStat113c(m, pStatList, statId, scaledVal, 0)
        }
      }
    }
  }

  if (i32(m, (ctx + 0x0c) >>> 0) !== 0) {
    UNITS_SetUnitAnimMode113c(m, target, 0x6fd1c1dc, 0x246)
  }

  if (i32(m, (ctx + 0x50) >>> 0) >= 0 && i32(m, (ctx + 0x5c) >>> 0) > 0) {
    const nCurseState = i32(m, (ctx + 0x4c) >>> 0)
    ITEMEVENT_RemoveByTypeAndState113c(m, target, m.u32(ctx) >>> 0, 1, nCurseState)
    for (let i = 0; i < 3; i++) {
      if (i32(m, (ctx + 0x50) >>> 0) >= 0 && i32(m, (ctx + 0x5c) >>> 0) > 0) {
        const fnIdx = i32(m, (ctx + 0x5c + i * 4) >>> 0)
        if (fnIdx >= 0 && fnIdx < 0x32) {
          const pfnCallback = m.u32((0x6fd277a8 + fnIdx * 4) >>> 0) >>> 0
          if (pfnCallback !== 0) {
            UNITEVENT_RegisterTimerOrItemEventNode113c(
              m,
              target,
              m.u32(ctx) >>> 0,
              i32(m, (ctx + 0x50 + i * 4) >>> 0),
              i32(m, (ctx + 0x10) >>> 0),
              i32(m, (ctx + 0x14) >>> 0),
              pfnCallback,
              1,
              nCurseState,
            )
          }
        }
      }
    }
  }
  return 1
}

/**
 * [42/45] Apply Attract curse state, alignment flip to 1, game node registration (`+0x111C`), AI state 3, and timer event `0x0A`.
 *
 * @dll D2Game.dll
 * @va 0x6FC70B70
 * @ordinalOrName D2Game_6FC70B70
 */
export function SKILLS_ApplyAttractCurseCallback_6FC70B70_113c(
  m: D2KernMemory113c,
  pTargetUnit: number,
  pCurseCtx: number,
): number {
  hitD2GameVa113c(0x6FC70B70)
  const target = pTargetUnit >>> 0
  const ctx = pCurseCtx >>> 0
  if (target === 0 || ctx === 0) return 0
  const pGame = m.u32(ctx) >>> 0
  const pCaster = m.u32((ctx + 0x04) >>> 0) >>> 0
  if (i32(m, target) !== 1) return 0
  if ((UNIT_GetAlignment113c(m, target) | 0) !== 0) return 0
  if ((SUNIT_AreUnitsHostileOrUnaligned113c(m, target, pCaster, pGame) | 0) === 0) return 0
  if ((SUNIT_IsDeadOrDying113c(m, target) | 0) !== 0) return 0
  if ((SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, target, 0x0b) | 0) === 0) return 0

  let nPrimaryStatId = i32(m, (ctx + 0x1c) >>> 0)
  const nScaledPrimaryVal =
    CURSES_ScaleImmuneMonsterResistPenalty113c(
      m,
      nPrimaryStatId,
      i32(m, (ctx + 0x34) >>> 0),
      target,
    ) | 0
  if (nScaledPrimaryVal === 0) {
    nPrimaryStatId = -1
  }

  let pStatList = 0
  const sp = k2W6B1StackPtr
  k2W6B1StackPtr = (sp + 0x28) >>> 0
  try {
    m.setU32(sp, pCaster)
    m.setU32((sp + 0x04) >>> 0, target)
    m.setU32((sp + 0x08) >>> 0, m.u32((ctx + 0x10) >>> 0))
    m.setU32((sp + 0x0c) >>> 0, m.u32((ctx + 0x14) >>> 0))
    m.setU32((sp + 0x10) >>> 0, m.u32((ctx + 0x18) >>> 0))
    m.setU32((sp + 0x14) >>> 0, nPrimaryStatId >>> 0)
    m.setU32((sp + 0x18) >>> 0, nScaledPrimaryVal >>> 0)
    m.setU32((sp + 0x1c) >>> 0, m.u32((ctx + 0x4c) >>> 0))
    m.setU32((sp + 0x20) >>> 0, 0x6fc6eb90)
    pStatList = STATES_CreateOrUpdateAuraStatList113c(m, sp) >>> 0
  } finally {
    k2W6B1StackPtr = sp
  }
  if (pStatList === 0) return 0

  for (let i = 0; i < 5; i++) {
    const statId = i32(m, (ctx + 0x20 + i * 4) >>> 0)
    if (statId >= 0) {
      const pDataTables = readSgptDataTables113c(m)
      if (pDataTables !== 0 && statId < i32(m, (pDataTables + 0xbd4) >>> 0)) {
        const rawVal = i32(m, (ctx + 0x38 + i * 4) >>> 0)
        const scaledVal = CURSES_ScaleImmuneMonsterResistPenalty113c(m, statId, rawVal, target) | 0
        if (scaledVal !== 0) {
          STATLIST_SetStat113c(m, pStatList, statId, scaledVal, 0)
        }
      }
    }
  }

  if (i32(m, (ctx + 0x0c) >>> 0) !== 0) {
    UNITS_SetUnitAnimMode113c(m, target, 0x6fd1c1dc, 0x3d7)
  }

  SUNIT_SetMonsterAlignmentState113c(m, target, 1, 1)
  const game = m.u32(ctx) >>> 0
  if (game !== 0 && i32(m, (target + 0xd0) >>> 0) === 0x0b) {
    const uType = i32(m, target)
    if (uType === 0 || uType === 1) {
      const pOldHead = m.u32((game + 0x111c) >>> 0) >>> 0
      const pNode = m.alloc(0x10) >>> 0
      if (pNode !== 0) {
        m.setU32(pNode, target)
        m.setU32((pNode + 0x04) >>> 0, 0)
        m.setU32((pNode + 0x08) >>> 0, 0)
        m.setU32((pNode + 0x0c) >>> 0, 0)
        m.setU32((game + 0x111c) >>> 0, pNode)
        if (pOldHead !== 0) {
          m.setU32((pNode + 0x08) >>> 0, pOldHead)
          m.setU32((pOldHead + 0x0c) >>> 0, pNode)
        }
        m.setU32((target + 0xd0) >>> 0, 9)
      }
    }
  }

  if (i32(m, target) === 1) {
    if ((MONSTATS_CheckFlagBit113c(m, i32(m, (target + 0x04) >>> 0), 0x10) | 0) !== 0) {
      const pMonData = m.u32((target + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU32((pMonData + 0x38) >>> 0, 3)
        m.setU32((pMonData + 0x34) >>> 0, 0)
      }
    }
  }

  const curGame = m.u32(ctx) >>> 0
  const expireFrame =
    ((curGame !== 0 ? i32(m, (curGame + 0xa8) >>> 0) : 0) + i32(m, (ctx + 0x18) >>> 0)) | 0
  EVENT_SetEventFull113c(m, curGame, target, 0x0a, expireFrame, 0, 0, 0)
  return 1
}

/**
 * [43/45] Compute Act 5 Quest 3 (Prison of Ice) quest log status byte for a player.
 *
 * @dll D2Game.dll
 * @va 0x6FC7B8C0
 * @ordinalOrName D2Game_6FC7B8C0
 */
export function ACT5Q3_StatusFilter_6FC7B8C0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pPlayer: number,
  _pGlobalFlags: number,
  pPlayerFlags: number,
  pOutFilterByte: number,
): number {
  hitD2GameVa113c(0x6FC7B8C0)
  const questData = pQuestData >>> 0
  const player = pPlayer >>> 0
  const playerFlags = pPlayerFlags >>> 0
  const outFilter = pOutFilterByte >>> 0
  if (outFilter !== 0) {
    m.setU8(outFilter, 0)
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, playerFlags, 0x25, 0) | 0) !== 0) {
    return 1
  }
  if (
    (DRLGWARP_TestRoomTileBit113c(m, playerFlags, 0x25, 1) | 0) === 0 &&
    (DRLGWARP_TestRoomTileBit113c(m, playerFlags, 0x25, 0x0d) | 0) === 0
  ) {
    if (questData === 0 || m.u8((questData + 0x09) >>> 0) === 0) {
      return 1
    }
    if ((ACT5Q3_CheckPlayerOrPartyHasMalahPotion_6FC7B030_113c(m, player, questData) | 0) !== 0) {
      if (outFilter !== 0) m.setU8(outFilter, 4)
      return 1
    }
    if ((DRLGWARP_TestRoomTileBit113c(m, playerFlags, 0x25, 0x0e) | 0) !== 0) {
      if (outFilter !== 0) m.setU8(outFilter, 0x0c)
      return 1
    }
    if (m.u8((questData + 0x0c) >>> 0) >= 5) {
      return 1
    }
    if (outFilter !== 0) {
      m.setU8(outFilter, m.u8((questData + 0x0b) >>> 0))
    }
    return 1
  }

  const nQuestId = questData !== 0 ? i32(m, (questData + 0xe0) >>> 0) : 0x25
  if (
    (DRLGWARP_TestRoomTileBit113c(m, playerFlags, nQuestId, 8) | 0) !== 0 &&
    (DRLGWARP_TestRoomTileBit113c(m, playerFlags, nQuestId, 9) | 0) === 0
  ) {
    if (outFilter !== 0) m.setU8(outFilter, 6)
    return 1
  }
  if (
    (DRLGWARP_TestRoomTileBit113c(
      m,
      playerFlags,
      questData !== 0 ? i32(m, (questData + 0xe0) >>> 0) : 0x25,
      8,
    ) |
      0) ===
    0
  ) {
    if (outFilter !== 0) m.setU8(outFilter, 5)
    return 1
  }
  if (outFilter !== 0) {
    m.setU8(outFilter, 0x0d)
  }
  return 1
}

/**
 * [44/45] Randomize Act 1 Quest 4 Cairn Stones activation order (`0x11..0x15`) using `pGame->pAct1DrlgSeed` and optionally broadcast debug chat.
 *
 * @dll D2Game.dll
 * @va 0x6FC833C0
 * @ordinalOrName D2Game_6FC833C0
 */
export function ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FC833C0)
  const questData = pQuestData >>> 0
  if (questData === 0) return
  const pQuestState = m.u32((questData + 0x18) >>> 0) >>> 0
  if (pQuestState === 0) return

  m.setU32(pQuestState, 0)
  m.setU32((pQuestState + 0x04) >>> 0, 0)
  m.setU16((pQuestState + 0x08) >>> 0, 0)
  m.setU16((pQuestState + 0x0c) >>> 0, 0)

  const pGame = m.u32((questData + 0x04) >>> 0) >>> 0
  if (pGame === 0) return
  const pSeedHolder = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pSeedHolder === 0) return

  const stoneIds = [0x11, 0x12, 0x13, 0x14, 0x15]
  let assignedCount = 0
  while (assignedCount < 5) {
    const newLo = stepSeed64At113c(m, (pSeedHolder + 0x18) >>> 0) >>> 0
    const slotIdx = (newLo % 5) >>> 0
    if (m.u16((pQuestState + slotIdx * 2) >>> 0) === 0) {
      const stoneId = stoneIds[assignedCount] | 0
      if (m.u32(0x6fd31c20) !== 0) {
        const curGame = m.u32((questData + 0x04) >>> 0) >>> 0
        if (curGame !== 0) {
          const sp = k2W6B1StackPtr
          k2W6B1StackPtr = (sp + 0x130) >>> 0
          try {
            for (let off = 0; off < 0x130; off += 4) {
              m.setU32((sp + off) >>> 0, 0)
            }
            m.setU8(sp, 0x26)
            m.setU8((sp + 0x01) >>> 0, 1)
            m.setU8((sp + 0x02) >>> 0, 0)
            m.setU8((sp + 0x03) >>> 0, 2)
            m.setU32((sp + 0x04) >>> 0, 0)
            m.setU8((sp + 0x08) >>> 0, 4)
            m.setU8((sp + 0x0a) >>> 0, 0)
            const msg = `stone ${slotIdx} is class ${stoneId}`
            for (let i = 0; i < msg.length; i++) {
              m.setU8((sp + 0x1a + i) >>> 0, msg.charCodeAt(i) & 0xff)
            }
            let pClient = m.u32((curGame + 0x88) >>> 0) >>> 0
            while (pClient !== 0) {
              if (i32(m, (pClient + 0x04) >>> 0) === 4) {
                NET_SendPacket26_ChatMessage_6FCAB470_113c(m, sp, pClient)
              }
              pClient = m.u32((pClient + 0x4a8) >>> 0) >>> 0
            }
          } finally {
            k2W6B1StackPtr = sp
          }
        }
      }
      m.setU16((pQuestState + slotIdx * 2) >>> 0, stoneId & 0xffff)
      assignedCount = (assignedCount + 1) | 0
    }
  }
}

/**
 * [45/45] Compute Act 1 Quest 5 (Tools of the Trade) quest log status byte for a player.
 *
 * @dll D2Game.dll
 * @va 0x6FC85500
 * @ordinalOrName D2Game_6FC85500
 */
export function ACT1Q5_StatusFilter_6FC85500_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pPlayer: number,
  _pGlobalFlags: number,
  pPlayerFlags: number,
  pOutFilterByte: number,
): number {
  hitD2GameVa113c(0x6FC85500)
  const questData = pQuestData >>> 0
  const player = pPlayer >>> 0
  const playerFlags = pPlayerFlags >>> 0
  const outFilter = pOutFilterByte >>> 0
  if (outFilter !== 0) {
    m.setU8(outFilter, 0)
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, playerFlags, 3, 1) | 0) !== 0) {
    if (outFilter !== 0) m.setU8(outFilter, 0x0a)
    return 1
  }
  if ((ACT1Q5_CheckPlayerOrPartyHasHoradricMalus_6FC84B60_113c(m, player, questData) | 0) !== 0) {
    if ((DRLGWARP_TestRoomTileBit113c(m, playerFlags, 3, 0) | 0) !== 0) {
      return 1
    }
    if (outFilter !== 0) m.setU8(outFilter, 2)
    return 1
  }
  if (questData === 0 || m.u8((questData + 0x09) >>> 0) === 0) {
    return 1
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, playerFlags, 3, 0x0d) | 0) !== 0) {
    const bBit1 = (DRLGWARP_TestRoomTileBit113c(m, playerFlags, 3, 1) | 0) !== 0
    if (outFilter !== 0) m.setU8(outFilter, bBit1 ? 0x0a : 0x0d)
    return 1
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, playerFlags, 3, 0x0e) | 0) !== 0) {
    if (outFilter !== 0) m.setU8(outFilter, 0x0c)
    return 1
  }
  if (m.u8((questData + 0x0c) >>> 0) < 5) {
    if (outFilter !== 0) m.setU8(outFilter, m.u8((questData + 0x0b) >>> 0))
    return 1
  }
  const pGame = m.u32((questData + 0x04) >>> 0) >>> 0
  if ((QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, pGame, 3, 0x0d) | 0) !== 0) {
    const clvl = STATLIST_GetUnitBaseStat113c(m, player, 0x0c, 0) | 0
    if (outFilter !== 0) m.setU8(outFilter, clvl >= 8 ? 0x0c : 0x04)
  }
  return 1
}
