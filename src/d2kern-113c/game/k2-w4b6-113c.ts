/**
 * Milestone 33 [K2] Wave 4 Batch 6 (`w4b6`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FCBD610..0x6FCC58D0`.
 *
 * Clean-room 1:1 binary-isomorphic translations from `D2Game.dll` v1.13c.
 */

import { UNITS_GetPlayerData113c } from '../common/composit'
import { MONSTER_GetMonStatsInteractBit113c } from '../common/drlg/drlg-ver'
import {
  DUNGEON_AllocAct113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon'
import { ENV_GetCycleState113c } from '../common/env'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32 } from '../common/int-math'
import { INVENTORY_FindEquippedSkillChargeItem113c } from '../common/inventory'
import {
  ITEMS_EnsureThrowableOrStackableQuantity113c,
  ITEMS_GetItemTypeQuiverFromItem113c,
  ITEMS_GetTwoHandedFlag113c,
} from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_SetStepNum113c,
} from '../common/path'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillElemMaxDamage113c,
  SKILLS_GetSkillElemMinDamage113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetParam1113c,
  SKILLS_SetRightSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
} from '../common/skills'
import {
  DUNGEON_GetActLevelId113c,
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxDurabilityFromUnit113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_GetUnitType113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetBaseStatExIfValid113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist'
import { UNITS_GetRoom113c, UNITS_SetUnitAnimMode113c } from '../common/unit'
import {
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
} from '../common/unit-finds'
import type { Memory113c } from '../mem/sparse-memory'
import { seedRoll } from '../prng'
import {
  MONSTER_GetSubClassVelocityInfo113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
} from '../tables/datatbls-113c'
import { DATATBLS_GetItemIdFromItemCode113c } from '../tables/item-tbls-113c'
import {
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  MONSTER_ApplyCritDamage113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_InitModeChangeStrc113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c'
import { D2GAME_SUNIT_GetGameFromUnit113c } from './boot-init-gap-b-113c'
import { PLAYER_StartModeOnUnit113c } from './c2s-packet-113c'
import {
  AI_Stall113c,
  ITEMS_DropGoldPileAtUnit113c,
  ITEMS_FinalizeCreatedItem113c,
  ITEMS_GetDropItemLevel113c,
  ITEMS_GetQualityBonusDivisor113c,
  MONSTER_StartMode113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartModeAttack113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
} from './combat-a1c-113c'
import { PLAYER_GetEquippedWeapon113c } from './replay-kernel-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  D2GAME_CreateItemEx_6FC31490_113c,
  ITEMS_FindFreeGroundDropCoords_6FC2E930_113c,
  ITEMS_GetDropItemLevel_6FC2E5D0_113c,
  ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c,
} from './k2-real-itemdrop-113c'
import {
  AURA_ForEachUnitInRadius113c,
  STATES_CreateOrUpdateAuraStatList113c,
  SUNITDMG_AddElementalDamageToStruct113c,
} from './k2-gap-itemdef-113c'
import {
  MISSILE_CreateServerProjectile113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
  STATES_OnTimedStateRemoved113c,
} from './k2-gap-melee-dot-113c'
import { type SUnitDmgHooks113c } from './k2-real-s2c-combat-113c'
import {
  OVERLAY_GetRecordPtrFast_6FC21AE0_113c,
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c,
} from './k2-laneH-0x6fc2-w1-113c'
import {
  AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c,
  MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c,
} from './k2-laneI-0x6fc3-w1-113c'
import {
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c,
  SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import { SKILLS_RedemptionCorpseCallback_6FC59930_113c } from './k2-laneK-0x6fc5-w1-113c'
import { ACT5Q5_GetSummitPlayerCount_6FC766D0_113c } from './k2-laneM-0x6fc7-w1-113c'
import { SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c } from './k2-w4b1-113c'
import { MISSILES_RedeemCorpseWithSkill124_6FC59910_113c } from './k2-w5b1-113c'
import { SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c } from './k2-w6b1-113c'
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c'
import { SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c } from './k2-w2b4-113c'
import {
  SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c,
  SKILLS_TargetRingScanCallback_6FCBED70_113c,
} from './k2-w2b5-113c'
import { SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c } from './k2-w2b6-113c'
import { ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c } from './k2-w2b7-113c'
import { AI_StartModeAtCoordsKeepSteps_6FD121E0_113c } from './k2-w2b8-113c'
import { AIGENERAL_RemoveFromMinionList_6FC416A0_113c } from './k2-w3b2-113c'
import { SKILLS_SrvDo_Unsummon_6FCC2EA0_113c } from './k2-w8b2-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_GetRecordPtr113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
} from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

export {
  ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c,
  ACT5Q5_GetSummitPlayerCount_6FC766D0_113c,
  AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c,
  AIGENERAL_RemoveFromMinionList_6FC416A0_113c,
  AI_CastSkillWithMode113c,
  AI_Stall113c,
  AI_StartAttackMode113c,
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  AURA_ForEachUnitInRadius113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
  DATATBLS_GetItemIdFromItemCode113c,
  DUNGEON_AllocAct113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  DUNGEON_GetActLevelId113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_ToggleHasPortalFlag113c,
  ENV_GetCycleState113c,
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
  INVENTORY_FindEquippedSkillChargeItem113c,
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckIfThrowItemMemPort113c,
  ITEMS_DropGoldPileAtUnit113c,
  ITEMS_EnsureThrowableOrStackableQuantity113c,
  ITEMS_FinalizeCreatedItem113c,
  ITEMS_GetDropItemLevel113c,
  ITEMS_GetItemTypeQuiverFromItem113c,
  ITEMS_GetQualityBonusDivisor113c,
  ITEMS_GetTwoHandedFlag113c,
  MISSILE_CreateServerProjectile113c,
  MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_GetRecordPtr113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
  MONSTER_ApplyCritDamage113c,
  MONSTER_CheckTypeFlagsMask113c,
  MONSTER_GetMonStatsInteractBit113c,
  MONSTER_GetSubClassVelocityInfo113c,
  MONSTER_InitModeChangeStrc113c,
  MONSTER_StartMode113c,
  NET_QueuePacketToClientBuffer113c,
  NET_SendPacket0x3E_ItemStatBitStream113c,
  OVERLAY_GetRecordPtrFast_6FC21AE0_113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_SetStepNum113c,
  PLAYER_GetEquippedWeapon113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartModeAttack113c,
  ROOM_FindRoomContainingSubtile113c,
  SEED_RollLimitedFast113c,
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c,
  SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillElemMaxDamage113c,
  SKILLS_GetSkillElemMinDamage113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillPeriodicDelayOrLength113c,
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c,
  SKILLS_SetLeftSkill113c,
  SKILLS_SetParam1113c,
  SKILLS_SetRightSkill113c,
  SKILLS_SetSkillLevelOnUnit113c,
  SKILLS_SetUsedSkillMemPort113c,
  SKILLS_TargetRingScanCallback_6FCBED70_113c,
  STATES_CheckState113c,
  STATES_CreateOrUpdateAuraStatList113c,
  STATES_OnTimedStateRemoved113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxDurabilityFromUnit113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetMaxStaminaFromUnit113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_GetUnitType113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetBaseStatExIfValid113c,
  STATLIST_SetExpireFrameEx113c,
  STATLIST_SetStatRemoveProc113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
  SUNITDMG_AddElementalDamageToStruct113c,
  SUNITDMG_AllocCombat113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
  SUNITDMG_DistributeExperience113c,
  SUNITDMG_ExecuteEvents113c,
  SUNITDMG_FindCombatDamageData113c,
  SUNITDMG_FreeAttackerCombatList113c,
  SUNITDMG_RollDodgeAvoidEvadeBlock113c,
  SUNIT_FreeUnit113c,
  SUNIT_GetOwnerUnit113c,
  SUNIT_GetServerUnit113c,
  SUNIT_IsDeadOrDying113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c,
  UNITFINDS_FreeUnitFindData113c,
  UNITFINDS_InitUnitFindData113c,
  UNITS_ChangeAnimMode113c,
  UNITS_GetPlayerData113c,
  UNITS_GetRoom113c,
  UNITS_SetUnitAnimMode113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  seedRoll,
}

/** `D2Game.dll` `.rdata` `0x6FD19FF9`: `"..\\Source\\D2Game\\GAME\\Client.cpp"`. */
export const D2GAME_CLIENT_CPP_VA_113C = 0x6fd19ff9

/** `D2Game.dll` `.rdata` `0x6FD1B980`: `"..\\Source\\D2Game\\SKILLS\\Skills.cpp"`. */
export const D2GAME_SKILLS_CPP_VA_113C = 0x6fd1b980

/** `D2Game.dll` `.data` `0x6FD274A8`: `gpSrvDoFuncTable` (191-entry server skill do-func table). */
export const D2GAME_SRVDOFUNC_TABLE_VA_113C = 0x6fd274a8

/** Optional host callbacks for pool allocation and indirect function pointer dispatch in Wave 4 Batch 6. */
export interface K2W4B6Hooks113c {
  readonly allocPoolMemory?: (
    m: Memory113c,
    pMemPool: number,
    nSize: number,
    szFileVa: number,
    nLine: number,
    nZero: number,
  ) => number
  readonly onSrvDoFunc?: (
    m: Memory113c,
    pfn: number,
    pGame: number,
    pUnit: number,
    nSkillId: number,
    nSkillLevel: number,
  ) => number
  readonly onUnitFindFilter?: (
    m: Memory113c,
    pfn: number,
    pArg0: number,
    pCandidate: number,
  ) => number
  readonly onIndirectCall?: (
    m: Memory113c,
    pfn: number,
    arg0: number,
    arg1: number,
    arg2: number,
    arg3: number,
    arg4: number,
  ) => number
  readonly assertFault?: (line: number) => void
}

/** Isolated reentrant scratch stack pointer for Wave 4 Batch 6 helpers on `Memory113c`. */
let w4b6ScratchSp = 0x7eb90000

function withW4B6Stack<T>(size: number, fn: (sp: number) => T): T {
  const sp = w4b6ScratchSp >>> 0
  w4b6ScratchSp = (sp + ((size + 15) & ~15)) >>> 0
  try {
    return fn(sp)
  } finally {
    w4b6ScratchSp = sp
  }
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function getDataTablesPtr113c(m: Memory113c): number {
  const ppDataTables = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (ppDataTables !== 0) {
    const pDataTables = m.u32(ppDataTables) >>> 0
    if (pDataTables !== 0) return pDataTables
  }
  return m.u32(0x6fde9e1c) >>> 0
}

/**
 * [1/45] Sends S2C packet `0x03` (Load Act: `bAct`, `dwInitSeed`, `wActSeed`, `dwObjSeed`, 12 bytes)
 * and S2C packet `0x53` (Set Darkness / Environment Cycle State, 10 bytes) to `pClient`.
 *
 * Binary convention: `esi = pClient`, `[esp+4] = pGame` (`ret 4`).
 *
 * @va D2Game:0x6FCBD610
 */
export function CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c(
  m: D2KernMemory113c,
  pClient: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCBD610)
  if (pClient === 0) {
    throw new D2CommonAssertError('Client.cpp', 0x7cb)
  }
  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x30) >>> 0
  try {
    const nAct = m.u8((pClient + 0x1ac) >>> 0)
    const pActSlot = (pGame + (nAct << 2) + 0xbc) >>> 0
    const pAct = m.u32(pActSlot) >>> 0
    const wActSeed = STATLIST_GetUnitType113c(m, pAct) & 0xffff
    const dwInitSeed = m.u32((pGame + 0x7c) >>> 0) >>> 0
    const dwObjSeed = m.u32((pGame + 0x80) >>> 0) >>> 0

    const pPkt03 = sp
    m.setU8(pPkt03, 0x03)
    m.setU8((pPkt03 + 1) >>> 0, nAct)
    m.setU32((pPkt03 + 2) >>> 0, dwInitSeed)
    m.setU16((pPkt03 + 6) >>> 0, wActSeed)
    m.setU32((pPkt03 + 8) >>> 0, dwObjSeed)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt03, 0x0c)

    const pCycleIndex = (sp + 0x10) >>> 0
    const pTicks = (sp + 0x14) >>> 0
    const pEclipse = (sp + 0x18) >>> 0
    m.setU32(pCycleIndex, 0)
    m.setU32(pTicks, 0)
    m.setU32(pEclipse, 0)
    ENV_GetCycleState113c(m, m.u32(pActSlot) >>> 0, pCycleIndex, pTicks, pEclipse)

    const pPkt53 = (sp + 0x1c) >>> 0
    m.setU8(pPkt53, 0x53)
    m.setU32((pPkt53 + 1) >>> 0, m.u32(pCycleIndex) >>> 0)
    m.setU32((pPkt53 + 5) >>> 0, m.u32(pTicks) >>> 0)
    m.setU8((pPkt53 + 9) >>> 0, m.u8(pEclipse))
    return NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pPkt53, 0x0a) | 0
  } finally {
    w4b6ScratchSp = sp
  }
}

/**
 * [2/45] Allocates and initializes `pGame->pAct[nAct]` via `DUNGEON_AllocAct113c`
 * (using `pArena->nTownLevelId` when arena flag `0x02` is set, else `DUNGEON_GetActLevelId113c(nAct)`),
 * then tail-calls `ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c(nAct, pGame)`.
 *
 * Binary convention: `esi = pGame`, `bl = nAct` (`ret`).
 *
 * @va D2Game:0x6FCBD6F0
 */
export function ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  nAct: number,
): void {
  hitD2GameVa113c(0x6FCBD6F0)
  const pArena = m.u32((pGame + 0x1d28) >>> 0) >>> 0
  if (pArena === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x27)
  }
  const actIdx = nAct & 0xff
  let nTownLevelId: number
  if ((m.u8((pArena + 0x08) >>> 0) & 0x02) !== 0) {
    nTownLevelId = m.u32(pArena) | 0
  } else {
    nTownLevelId = DUNGEON_GetActLevelId113c(m, actIdx) | 0
  }
  const dwInitSeed = m.u32((pGame + 0x7c) >>> 0) >>> 0
  const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
  const bDifficulty = m.u8((pGame + 0x6d) >>> 0)
  const pAct =
    DUNGEON_AllocAct113c(
      m,
      actIdx,
      dwInitSeed,
      0,
      pGame >>> 0,
      bDifficulty,
      pMemPool,
      nTownLevelId,
      0,
      0,
    ) >>> 0
  m.setU32((pGame + (actIdx << 2) + 0xbc) >>> 0, pAct)
  ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c(m, actIdx, pGame >>> 0)
}

/**
 * [3/45] Allocates a `0x2C`-byte `D2UnitFindDataStrc` from `pGame->pMemPool`, initializes a
 * `0x38`-byte stack filter arg with `dwFlags = 0x583`, calls `UNITFINDS_InitUnitFindData113c`
 * and `UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c`, and returns `pUnitFindData`.
 *
 * Binary convention: `ebx = nY`, `[esp+4] = pGame`, `[esp+8] = pUnit`, `[esp+0xC] = dwSize`, `[esp+0x10] = nX` (`ret 0x10`).
 *
 * @va D2Game:0x6FCBE570
 */
export function SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c(
  m: D2KernMemory113c,
  nY: number,
  pGame: number,
  pUnit: number,
  dwSize: number,
  nX: number,
  hooks?: K2W4B6Hooks113c,
): number {
  hitD2GameVa113c(0x6FCBE570)
  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x38) >>> 0
  try {
    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    const pUnitFindData =
      (hooks !== undefined && hooks.allocPoolMemory !== undefined
        ? hooks.allocPoolMemory(m, pMemPool, 0x2c, D2GAME_SKILLS_CPP_VA_113C, 0x44b, 0)
        : m.alloc(0x2c)) >>> 0
    for (let i = 0; i < 14; i++) {
      m.setU32((sp + i * 4) >>> 0, 0)
    }
    m.setU32(sp, 0x583)
    m.setU32((sp + 0x08) >>> 0, pUnit >>> 0)
    m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
    m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    m.setU32((sp + 0x14) >>> 0, dwSize >>> 0)
    const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
    UNITFINDS_InitUnitFindData113c(
      m,
      m.u32((pGame + 0x1c) >>> 0) >>> 0,
      pUnitFindData,
      pRoom,
      nX | 0,
      nY | 0,
      dwSize | 0,
      0,
      sp,
    )
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pUnitFindData)
    return pUnitFindData
  } finally {
    w4b6ScratchSp = sp
  }
}

/**
 * [4/45] Clamps `pUnit`'s current `STAT_HITPOINTS (6)`, `STAT_MANA (8)`, and `STAT_STAMINA (10)`
 * to their respective maximum values, then refreshes `pUnit`'s animation mode (`UNITS_SetUnitAnimMode113c`).
 *
 * Binary convention: `esi = pUnit` (`ret`).
 *
 * @va D2Game:0x6FCBE6B0
 */
export function SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c(
  m: D2KernMemory113c,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCBE6B0)
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0
  if ((STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0) > maxLife) {
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 6, maxLife, 0)
  }
  const maxMana = STATLIST_GetMaxManaFromUnit113c(m, pUnit >>> 0) | 0
  if ((STATLIST_GetUnitStat113c(m, pUnit >>> 0, 8, 0) | 0) > maxMana) {
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 8, maxMana, 0)
  }
  const maxStam = STATLIST_GetMaxStaminaFromUnit113c(m, pUnit >>> 0) | 0
  if ((STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0a, 0) | 0) > maxStam) {
    STATLIST_SetUnitStat113c(m, pUnit >>> 0, 0x0a, maxStam, 0)
  }
  UNITS_SetUnitAnimMode113c(m, pUnit >>> 0, D2GAME_SKILLS_CPP_VA_113C, 0x10b)
}

/**
 * [5/45] Returns the base walk velocity (shifted left by 8) for `pUnit`:
 * - `UNIT_PLAYER (0)`: `pCharStatsTxt[nClassId].nWalkVelocity (+0x40) << 8`
 * - `UNIT_MONSTER (1)`: `pMonStatsTxt[nClassId].nVelocity (+0x32) << 8`
 * - Otherwise (or out-of-range): `0x600`.
 *
 * Binary convention: `eax = pUnit` (`ret`).
 *
 * @va D2Game:0x6FCBE730
 */
export function SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCBE730)
  if (pUnit === 0) return 0x600
  const dwUnitType = m.u32(pUnit >>> 0) | 0
  if (dwUnitType === 0) {
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    if (nClassId < 0) return 0x600
    const pDataTables = getDataTablesPtr113c(m)
    if (pDataTables === 0) return 0x600
    const count = m.u32((pDataTables + 0xbc8) >>> 0) | 0
    if (nClassId >= count) return 0x600
    const base = m.u32((pDataTables + 0xbc4) >>> 0) >>> 0
    const pCharStats = (base + imul32(nClassId, 0xc4)) >>> 0
    if (pCharStats === 0) return 0x600
    return (m.u8((pCharStats + 0x40) >>> 0) << 8) | 0
  }
  if (dwUnitType === 1) {
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    if (nClassId < 0) return 0x600
    const pDataTables = getDataTablesPtr113c(m)
    if (pDataTables === 0) return 0x600
    const count = m.u32((pDataTables + 0xa80) >>> 0) | 0
    if (nClassId >= count) return 0x600
    const base = m.u32((pDataTables + 0xa78) >>> 0) >>> 0
    const pMonStats = (base + imul32(nClassId, 0x1a8)) >>> 0
    if (pMonStats === 0) return 0x600
    return (sx16(m.u16((pMonStats + 0x32) >>> 0)) << 8) | 0
  }
  return 0x600
}

/**
 * [6/45] Searches within a 10-subtile radius around `pCenterUnit` (`eax`) for selectable corpses
 * (`SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c`), returning the first matching corpse unit
 * (`pUnitsArray[0]`) and freeing the temporary `D2UnitFindDataStrc`.
 *
 * Binary convention: `eax = pCenterUnit`, `[esp+4] = pCasterUnit`, `[esp+8] = nSkillLevel` (`ret 8`).
 *
 * @va D2Game:0x6FCBE810
 */
export function SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c(
  m: D2KernMemory113c,
  pCenterUnit: number,
  pCasterUnit: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCBE810)
  if (pCasterUnit === 0 || (nSkillLevel | 0) <= 0 || pCenterUnit === 0) {
    return 0
  }
  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x68) >>> 0
  try {
    const pUnitFindData = sp
    const pFilterArg = (sp + 0x2c) >>> 0
    const nX = UNIT_GetPosX113c(m, pCenterUnit >>> 0) | 0
    const nY = UNIT_GetPosY113c(m, pCenterUnit >>> 0) | 0
    for (let i = 0; i < 14; i++) {
      m.setU32((pFilterArg + i * 4) >>> 0, 0)
    }
    m.setU32(pFilterArg, 0x1002)
    m.setU32((pFilterArg + 0x0c) >>> 0, nX >>> 0)
    m.setU32((pFilterArg + 0x10) >>> 0, nY >>> 0)
    m.setU32((pFilterArg + 0x14) >>> 0, 0x0a)

    const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pCasterUnit >>> 0) >>> 0
    const pRoom = UNITS_GetRoom113c(m, pCenterUnit >>> 0) >>> 0
    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    UNITFINDS_InitUnitFindData113c(
      m,
      pMemPool,
      pUnitFindData,
      pRoom,
      nX,
      nY,
      0x0a,
      0x6fcbe2e0,
      pFilterArg,
    )
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(
      m,
      pUnitFindData,
      SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c,
    )
    const nFound = m.u32((pUnitFindData + 0x18) >>> 0) | 0
    let pFound = 0
    if (nFound !== 0) {
      const pUnitsArray = m.u32((pUnitFindData + 0x04) >>> 0) >>> 0
      pFound = m.u32(pUnitsArray) >>> 0
    }
    UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)
    return pFound
  } finally {
    w4b6ScratchSp = sp
  }
}

/**
 * [7/45] Reads `wAuraState = pSkillsTxt[nSkillId]->wAuraState (+0x80)`, resolves the `D2StatesTxt`
 * record via `OVERLAY_GetRecordPtrFast_6FC21AE0_113c`, reads `wOnSrvDoFunc (+0x36)`, and dispatches
 * `gpSrvDoFuncTable[wOnSrvDoFunc](pGame, pUnit, nSkillId, nSkillLevel)` when in `[0, 0xBF)`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = nSkillId, [esp+8] = nSkillLevel)` (`ret 8`).
 *
 * @va D2Game:0x6FCBE8E0
 */
export function SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: K2W4B6Hooks113c,
): number {
  hitD2GameVa113c(0x6FCBE8E0)
  const skillId = nSkillId | 0
  if (skillId <= 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  if (pDataTables === 0) return 0
  const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (skillId >= nSkillsCount) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0
  const wStateId = sx16(m.u16((pSkillsTxt + 0x80) >>> 0))
  if (wStateId < 0) return 0
  const nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  if (wStateId >= nStatesCount) return 0
  const pStateTxt = OVERLAY_GetRecordPtrFast_6FC21AE0_113c(m, wStateId) >>> 0
  if (pStateTxt === 0) return 0
  const wSrvDoFunc = sx16(m.u16((pStateTxt + 0x36) >>> 0))
  if (wSrvDoFunc < 0 || wSrvDoFunc >= 0xbf) return 0
  const pfn = m.u32((D2GAME_SRVDOFUNC_TABLE_VA_113C + (wSrvDoFunc << 2)) >>> 0) >>> 0
  if (pfn === 0) return 0
  if (hooks !== undefined && hooks.onSrvDoFunc !== undefined) {
    return hooks.onSrvDoFunc(m, pfn, pGame >>> 0, pUnit >>> 0, skillId, nSkillLevel | 0) | 0
  }
  switch (pfn) {
    case 0x6fc2c170:
      return (
        SKILLS_SrvDo147_SyncOwnerPos_6FC2C170_113c(
          m,
          pGame >>> 0,
          pUnit >>> 0,
          skillId,
          nSkillLevel | 0,
        ) | 0
      )
    case 0x6fc6f920:
      return (
        SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c(
          m,
          pGame >>> 0,
          pUnit >>> 0,
          skillId,
          nSkillLevel | 0,
        ) | 0
      )
    case 0x6fcc2ea0:
      return (
        SKILLS_SrvDo_Unsummon_6FCC2EA0_113c(
          m as unknown as Parameters<typeof SKILLS_SrvDo_Unsummon_6FCC2EA0_113c>[0],
          pGame >>> 0,
          pUnit >>> 0,
          skillId,
          nSkillLevel | 0,
        ) | 0
      )
    case 0x6fcd2e90:
      return (
        SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c(
          m,
          pGame >>> 0,
          pUnit >>> 0,
          skillId,
          nSkillLevel | 0,
        ) | 0
      )
    default:
      return pfn | 0
  }
}

/**
 * [8/45] Clears all active states on `pUnit` that belong to the same `wGroup (+0x1E)` in `States.txt`
 * as `nStateId` (excluding `nStateId` itself when `bIncludeTargetState == 0`), unlinking and freeing
 * their non-extended statlists. Returns `1` if at least one state was removed, else `0`.
 *
 * Binary convention: `ebx = pUnit`, `[esp+4] = nStateId`, `[esp+8] = bIncludeTargetState` (`ret 8`).
 *
 * @va D2Game:0x6FCBEA30
 */
export function STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nStateId: number,
  bIncludeTargetState: number,
): number {
  hitD2GameVa113c(0x6FCBEA30)
  const targetState = nStateId | 0
  if (targetState < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  if (pDataTables === 0) return 0
  const nStatesCount = m.u32((pDataTables + 0xc4) >>> 0) | 0
  if (targetState >= nStatesCount) return 0
  const pStatesBase = m.u32((pDataTables + 0xbc) >>> 0) >>> 0
  const pTargetStateTxt = (pStatesBase + imul32(targetState, 0x3c)) >>> 0
  if (pTargetStateTxt === 0) return 0
  const wGroup = sx16(m.u16((pTargetStateTxt + 0x1e) >>> 0))
  if (wGroup === 0) return 0

  let bRemovedAny = 0
  if (nStatesCount > 0) {
    let byteOff = 0
    for (let curState = 0; curState < nStatesCount; curState++) {
      if (curState !== targetState || (bIncludeTargetState | 0) !== 0) {
        let pCurStateTxt = 0
        if (byteOff >= 0) {
          const dt = getDataTablesPtr113c(m)
          if (dt !== 0 && curState < (m.u32((dt + 0xc4) >>> 0) | 0)) {
            pCurStateTxt = (m.u32((dt + 0xbc) >>> 0) + byteOff) >>> 0
          }
        }
        const curGroup = pCurStateTxt === 0 ? 0 : sx16(m.u16((pCurStateTxt + 0x1e) >>> 0))
        if (curGroup === wGroup) {
          if ((STATES_CheckState113c(m, pUnit >>> 0, curState) | 0) !== 0) {
            bRemovedAny = 1
            STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, curState, 0)
            const pStatList =
              STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, curState) >>> 0
            if (pStatList !== 0) {
              STATLIST_UnlinkSubList113c(m, pUnit >>> 0, pStatList)
              STATLIST_FreeStatListIfNonExtended113c(m, pStatList)
            }
          }
        }
      }
      byteOff = (byteOff + 0x3c) | 0
    }
  }
  return bRemovedAny
}

/**
 * [9/45] Validates and consumes/ensures throwable or bow/crossbow quiver quantity for `pUnit` (`eax`).
 *
 * Binary convention: `eax = pUnit` (`ret`).
 *
 * @va D2Game:0x6FCBEB80
 */
export function SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCBEB80)
  if (pUnit === 0) return 0
  if ((m.u32(pUnit >>> 0) | 0) !== 0) return 1
  const pWeapon = PLAYER_GetEquippedWeapon113c(m, pUnit >>> 0) >>> 0
  if (pWeapon === 0) return 0
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit >>> 0) >>> 0
  if (pSkill === 0) return 0

  let bRequireNotThrowingWeapon = 1
  if ((ITEMS_CheckIfThrowItemMemPort113c(m, pWeapon) | 0) !== 0) {
    bRequireNotThrowingWeapon = 0
    if ((SKILLS_GetSkillIdFromSkill113c(m, pSkill, D2GAME_SKILLS_CPP_VA_113C, 0x640) | 0) === 0) {
      if ((STATLIST_GetUnitStatWithLayer113c(m, pWeapon, 0x9d, 0) | 0) !== 0) {
        return 1
      }
    }
  }

  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return 0

  const pRightArm = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, 4) >>> 0
  if (pRightArm !== 0 && (bRequireNotThrowingWeapon === 0 || pRightArm === pWeapon)) {
    if (
      (ITEMS_GetItemTypeQuiverFromItem113c(m, pRightArm) | 0) !== 0 ||
      (ITEMS_GetTwoHandedFlag113c(m, pRightArm) | 0) !== 0 ||
      (STATLIST_GetUnitStatWithLayer113c(m, pRightArm, 0x7d, 0) | 0) !== 0
    ) {
      return ITEMS_EnsureThrowableOrStackableQuantity113c(m, pRightArm) | 0
    }
  }

  const pLeftArm = INVENTORY_GetItemFromBodyLocMemPort113c(m, pInventory, 5) >>> 0
  if (pLeftArm !== 0 && (bRequireNotThrowingWeapon === 0 || pLeftArm === pWeapon)) {
    if (
      (ITEMS_GetItemTypeQuiverFromItem113c(m, pLeftArm) | 0) !== 0 ||
      (ITEMS_GetTwoHandedFlag113c(m, pLeftArm) | 0) !== 0 ||
      (STATLIST_GetUnitStatWithLayer113c(m, pLeftArm, 0x7d, 0) | 0) !== 0
    ) {
      return ITEMS_EnsureThrowableOrStackableQuantity113c(m, pLeftArm) | 0
    }
  }

  return 0
}

/**
 * [10/45] Unit-find callback that optionally runs `pClosestCtx->pfnCustomFilter` (`+0x10`),
 * computes squared subtile distance from `(pClosestCtx->nX (+0x08), pClosestCtx->nY (+0x0C))`
 * to `pCandidateUnit`, and updates `pClosestCtx->pBestUnit (+0x00)` and `pClosestCtx->nBestDistSq (+0x04)`
 * when closer.
 *
 * Binary convention: `__fastcall(ecx = pFindArg, edx = pCandidateUnit)` (`ret`).
 *
 * @va D2Game:0x6FCBEDB0
 */
export function SKILLS_FindClosestUnitCallback_6FCBEDB0_113c(
  m: D2KernMemory113c,
  pFindArg: number,
  pCandidateUnit: number,
  hooks?: K2W4B6Hooks113c,
): number {
  hitD2GameVa113c(0x6FCBEDB0)
  const pClosestCtx = m.u32((pFindArg + 0x0c) >>> 0) >>> 0
  const pfnFilter = m.u32((pClosestCtx + 0x10) >>> 0) >>> 0
  if (pfnFilter !== 0) {
    const pArg0 = m.u32(pFindArg >>> 0) >>> 0
    let pass = 0
    if (hooks !== undefined && hooks.onUnitFindFilter !== undefined) {
      pass = hooks.onUnitFindFilter(m, pfnFilter, pArg0, pCandidateUnit >>> 0) | 0
    } else if (pfnFilter === 0x6fc47130) {
      pass = SKILLS_CanUnownedMonsterUseSkillInMode12_6FC47130_113c(m, pArg0, pCandidateUnit >>> 0) | 0
    }
    if (pass === 0) return 0
  }

  const uTypeX = m.u32(pCandidateUnit >>> 0) | 0
  const pPathX = m.u32((pCandidateUnit + 0x2c) >>> 0) >>> 0
  let candX: number
  if (uTypeX === 2 || (uTypeX > 3 && uTypeX <= 5)) {
    candX = m.u32((pPathX + 0x0c) >>> 0) | 0
  } else {
    candX = pPathX !== 0 ? PATH_GetPosX113c(m, pPathX) | 0 : 0
  }
  const dx = (candX - (m.u32((pClosestCtx + 0x08) >>> 0) | 0)) | 0

  const uTypeY = m.u32(pCandidateUnit >>> 0) | 0
  const pPathY = m.u32((pCandidateUnit + 0x2c) >>> 0) >>> 0
  let candY: number
  if (uTypeY === 2 || (uTypeY > 3 && uTypeY <= 5)) {
    candY = m.u32((pPathY + 0x10) >>> 0) | 0
  } else {
    candY = pPathY !== 0 ? PATH_GetPosY113c(m, pPathY) | 0 : 0
  }
  const dy = (candY - (m.u32((pClosestCtx + 0x0c) >>> 0) | 0)) | 0

  const bestDistSq = m.u32((pClosestCtx + 0x04) >>> 0) | 0
  const distSq = (imul32(dy, dy) + imul32(dx, dx)) | 0
  if (distSq < bestDistSq) {
    m.setU32((pClosestCtx + 0x04) >>> 0, distSq >>> 0)
    m.setU32(pClosestCtx, pCandidateUnit >>> 0)
  }
  return 1
}

/**
 * [11/45] Executes a radius unit search described by `pSearchSpec` (`esi`, 0x24 bytes) in `pGame`
 * (`[esp+4]`), resolving `dwSize` via `SKILLS_EvalLinearParam12_6FC21B10_113c` when `pSearchSpec->dwSize (+0x14) == 0`,
 * finding the room at `(nX, nY)` via `ROOM_FindRoomContainingSubtile113c`, and invoking
 * `pSearchSpec->pfnCallback (+0x20)` on each matching unit.
 *
 * Binary convention: `esi = pSearchSpec`, `[esp+4] = pGame` (`ret 4`).
 *
 * @va D2Game:0x6FCBEEB0
 */
export function SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c(
  m: D2KernMemory113c,
  pSearchSpec: number,
  pGame: number,
  hooks?: K2W4B6Hooks113c,
): void {
  hitD2GameVa113c(0x6FCBEEB0)
  if (pSearchSpec === 0) {
    throw new D2CommonAssertError('Client.cpp', 0x10b8)
  }
  const pfnCallback = m.u32((pSearchSpec + 0x20) >>> 0) >>> 0
  if (pfnCallback === 0) {
    throw new D2CommonAssertError('Client.cpp', 0x10b9)
  }

  let dwSize = m.u32((pSearchSpec + 0x14) >>> 0) | 0
  if (dwSize === 0) {
    const nSkillId = m.u32((pSearchSpec + 0x08) >>> 0) | 0
    const nSkillLevel = m.u32((pSearchSpec + 0x18) >>> 0) | 0
    dwSize = SKILLS_EvalLinearParam12_6FC21B10_113c(m, nSkillId, nSkillLevel) | 0
  }

  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x68) >>> 0
  try {
    const pUnitFindData = sp
    const pFilterArg = (sp + 0x2c) >>> 0
    const nX = m.u32((pSearchSpec + 0x0c) >>> 0) | 0
    const nY = m.u32((pSearchSpec + 0x10) >>> 0) | 0
    for (let i = 0; i < 14; i++) {
      m.setU32((pFilterArg + i * 4) >>> 0, 0)
    }
    const dwFlags = m.u32(pSearchSpec >>> 0) >>> 0
    const pOwnerUnit = m.u32((pSearchSpec + 0x04) >>> 0) >>> 0
    m.setU32(pFilterArg, dwFlags)
    m.setU32((pFilterArg + 0x08) >>> 0, pOwnerUnit)
    m.setU32((pFilterArg + 0x0c) >>> 0, nX >>> 0)
    m.setU32((pFilterArg + 0x10) >>> 0, nY >>> 0)
    m.setU32((pFilterArg + 0x14) >>> 0, dwSize >>> 0)

    const pUnitRoom = UNITS_GetRoom113c(m, pOwnerUnit) >>> 0
    const pRoom = ROOM_FindRoomContainingSubtile113c(m, pUnitRoom, nX, nY) >>> 0
    if (pRoom === 0) return

    const pMemPool = m.u32((pGame + 0x1c) >>> 0) >>> 0
    UNITFINDS_InitUnitFindData113c(
      m,
      pMemPool,
      pUnitFindData,
      pRoom,
      m.u32((pSearchSpec + 0x0c) >>> 0) | 0,
      m.u32((pSearchSpec + 0x10) >>> 0) | 0,
      dwSize,
      0,
      pFilterArg,
    )
    m.setU32((pUnitFindData + 0x14) >>> 0, m.u32(pSearchSpec >>> 0) >>> 0)
    UNITFINDS_FindAllMatchingUnitsInAdjacentRooms113c(m, pUnitFindData)

    const pfn = m.u32((pSearchSpec + 0x20) >>> 0) >>> 0
    if (pfn === 0 || m.u32(0x6fd18d14) === 1) {
      throw new D2CommonAssertError('Client.cpp', 0x10db)
    }
    let nFound = m.u32((pUnitFindData + 0x18) >>> 0) | 0
    for (let i = 0; i < nFound; i++) {
      const arg3 = m.u32((pSearchSpec + 0x1c) >>> 0) | 0
      const arg2 = m.u32((pSearchSpec + 0x18) >>> 0) | 0
      const pUnitsArray = m.u32((pUnitFindData + 0x04) >>> 0) >>> 0
      const pCandidate = m.u32((pUnitsArray + (i << 2)) >>> 0) >>> 0
      const pUnitArg = m.u32((pSearchSpec + 0x04) >>> 0) >>> 0
      const cb = m.u32((pSearchSpec + 0x20) >>> 0) >>> 0
      if (hooks !== undefined && hooks.onIndirectCall !== undefined) {
        hooks.onIndirectCall(m, cb, pGame >>> 0, pUnitArg, pCandidate, arg2, arg3)
      } else {
        switch (cb) {
          case 0x6fc2c8d0:
            SKILLS_SetTargetAndDoNihlathakCorpseExplosion_6FC2C8D0_113c(
              m,
              pGame >>> 0,
              pUnitArg,
              pCandidate,
              arg2,
              arg3,
            )
            break
          case 0x6fc59910:
            MISSILES_RedeemCorpseWithSkill124_6FC59910_113c(
              m,
              pGame >>> 0,
              pUnitArg,
              pCandidate,
              arg2,
              arg3,
            )
            break
          case 0x6fc59930:
            SKILLS_RedemptionCorpseCallback_6FC59930_113c(
              m,
              pGame >>> 0,
              pUnitArg,
              pCandidate,
              arg2,
              arg3,
            )
            break
          default:
            break
        }
      }
      nFound = m.u32((pUnitFindData + 0x18) >>> 0) | 0
    }
    UNITFINDS_FreeUnitFindData113c(m, pUnitFindData)
  } finally {
    w4b6ScratchSp = sp
  }
}

/**
 * [12/45] Rolls skill elemental damage in `[minElem, maxElem)` using `pAttacker->Seed (+0x20)`,
 * queries periodic length via `SKILLS_GetSkillPeriodicDelayOrLength113c`, and adds it to `pDmg`
 * via `SUNITDMG_AddElementalDamageToStruct113c`.
 *
 * Binary convention: `eax = nSkillId`, `edi = pAttacker`, `[esp+4] = pDmg`, `[esp+8] = nSkillLevel` (`ret 8`).
 *
 * @va D2Game:0x6FCBF210
 */
export function SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pAttacker: number,
  pDmg: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCBF210)
  const skillId = nSkillId | 0
  if (skillId < 0) return 0
  const pDataTables = getDataTablesPtr113c(m)
  if (pDataTables === 0) return 0
  const nSkillsCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (skillId >= nSkillsCount) return 0
  const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
  const pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) return 0

  const lvl = nSkillLevel | 0
  const nLength = SKILLS_GetSkillPeriodicDelayOrLength113c(m, pAttacker >>> 0, skillId, lvl, 1) | 0
  const nMinElem = SKILLS_GetSkillElemMinDamage113c(m, pAttacker >>> 0, skillId, lvl, 1) | 0
  const nMaxElem = SKILLS_GetSkillElemMaxDamage113c(m, pAttacker >>> 0, skillId, lvl, 1) | 0
  const nRange = (nMaxElem - nMinElem) | 0
  const nRoll = SEED_RollLimitedFast113c(m, (pAttacker + 0x20) >>> 0, nRange) | 0
  const nDamage256 = (nRoll + nMinElem) | 0
  const eElemType = m.u8((pSkillsTxt + 0x1dc) >>> 0)
  SUNITDMG_AddElementalDamageToStruct113c(
    m,
    pDmg >>> 0,
    eElemType,
    pAttacker >>> 0,
    nDamage256,
    nLength,
    0,
    0,
  )
  return nDamage256
}

/**
 * [13/45] Looks up `pItem` by `dwOwnerItemGuid` in `pGame`'s item hash table (`+0x1720`),
 * locates the matching `STAT_ITEM_CHARGED_SKILL (0xCC)` stat layer via
 * `INVENTORY_FindEquippedSkillChargeItem113c`, decrements the current charge count, updates the
 * base stat via `STATLIST_SetBaseStatExIfValid113c`, and sends S2C packet `0x3E` to the owning player client.
 *
 * Binary convention: `eax = pGame`, `edx = pUnit`, `ecx = dwOwnerItemGuid`, `[esp+4] = pSkill` (`ret 4`).
 *
 * @va D2Game:0x6FCBF4A0
 */
export function SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  dwOwnerItemGuid: number,
  pSkill: number,
): number {
  hitD2GameVa113c(0x6FCBF4A0)
  if (pGame === 0) {
    throw new D2CommonAssertError('Client.cpp', 0x2d3)
  }
  const bucket = dwOwnerItemGuid & 0x7f
  let pItem = m.u32((pGame + (bucket << 2) + 0x1720) >>> 0) >>> 0
  while (pItem !== 0 && (m.u32((pItem + 0x0c) >>> 0) >>> 0) !== (dwOwnerItemGuid >>> 0)) {
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) return 0

  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x10) >>> 0
  try {
    const pOutCharges = sp
    const pOutStatList = (sp + 0x04) >>> 0
    const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill >>> 0, D2GAME_SKILLS_CPP_VA_113C, 0x382) | 0
    const nSkillLevel = SKILLS_EvaluateSkillLevel113c(m, pUnit >>> 0, pSkill >>> 0, 0) | 0
    m.setU32(pOutCharges, 0)
    m.setU32(pOutStatList, 0)
    const bFound =
      INVENTORY_FindEquippedSkillChargeItem113c(
        m,
        pItem,
        nSkillId,
        nSkillLevel,
        pOutCharges,
        pOutStatList,
      ) | 0
    if (bFound === 0) return 0

    const nCurCharges = m.u32(pOutCharges) | 0
    if (nCurCharges <= 0) return 0

    const pDataTables = getDataTablesPtr113c(m)
    const nShift = m.u32((pDataTables + 0xc6c) >>> 0) & 0x1f
    const dwMask = m.u32((pDataTables + 0xc70) >>> 0) | 0
    const nLayer = ((nSkillId << nShift) + (nSkillLevel & dwMask)) | 0
    const pStatList = m.u32(pOutStatList) >>> 0
    const dwRawVal = STATLIST_GetStatValue113c(m, pStatList, 0xcc, nLayer) | 0
    if (dwRawVal === 0) return 0

    const nMaxCharges = dwRawVal >> 8
    let nNewCharges = (nCurCharges - 1) | 0
    if (nMaxCharges <= 0 || nMaxCharges > 0xff) return 0
    if (nNewCharges <= 0) nNewCharges = 0
    if (nNewCharges >= nMaxCharges) nNewCharges = nMaxCharges
    m.setU32(pOutCharges, nNewCharges >>> 0)

    const dwPacked = ((nMaxCharges << 8) + (nNewCharges & 0xff)) | 0
    STATLIST_SetBaseStatExIfValid113c(
      m,
      m.u32(pOutStatList) >>> 0,
      0xcc,
      dwPacked,
      nLayer,
      pItem,
    )

    let pClient = 0
    if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
      if (pPlayerData !== 0) {
        pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
      }
    }
    NET_SendPacket0x3E_ItemStatBitStream113c(
      m,
      pItem,
      nLayer & 0xffff,
      pClient,
      1,
      0xcc,
      dwPacked >>> 0,
    )
    return 1
  } finally {
    w4b6ScratchSp = sp
  }
}

/**
 * [14/45] Resolves `pMonster`'s boss owner via `pAiGeneral` (`+0x28..+0x30`), freeing the entire
 * boss minion list if `pBoss == pMonster` (`AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c`)
 * or unlinking `pMonster` from the minion list (`AIGENERAL_RemoveFromMinionList_6FC416A0_113c`).
 *
 * Binary convention: `esi = pMonster` (`ret`).
 *
 * @va D2Game:0x6FCBF730
 */
export function SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c(
  m: D2KernMemory113c,
  pMonster: number,
): void {
  hitD2GameVa113c(0x6FCBF730)
  if (pMonster === 0) return
  if ((m.u32(pMonster >>> 0) | 0) !== 1) return
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
  if (pAiGeneral === 0) return
  const pGame = m.u32((pAiGeneral + 0x28) >>> 0) >>> 0
  if (pGame === 0) return
  const dwOwnerGuid = m.u32((pAiGeneral + 0x2c) >>> 0) | 0
  const dwOwnerType = m.u32((pAiGeneral + 0x30) >>> 0) | 0
  const pBoss = SUNIT_GetServerUnit113c(m, pGame, dwOwnerType, dwOwnerGuid) >>> 0
  if (pBoss === 0 || (m.u32(pBoss) | 0) !== 1) return
  if (pBoss === (pMonster >>> 0)) {
    AIGENERAL_FreeBossMinionListAndClearRefs_6FC41590_113c(m, pMonster >>> 0)
  } else {
    AIGENERAL_RemoveFromMinionList_6FC416A0_113c(m, pGame, pMonster >>> 0)
  }
}

/**
 * [15/45] Validates `pUnit`'s path target in `pGame` (`SUNIT_ValidatePathTargetUnit113c`), writing
 * the target unit's position (or `PATH_GetFirstPointX113c`/`PATH_GetFirstPointY113c` when no distinct
 * target unit exists) to `*pOutX` (`ebx`) and `*pOutY` (`[esp+4]`). Returns `1` iff both are non-zero.
 *
 * Binary convention: `eax = pUnit`, `edx = pGame`, `ebx = pOutX`, `[esp+4] = pOutY` (`ret 4`).
 *
 * @va D2Game:0x6FCBFA30
 */
export function SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pOutX: number,
  pOutY: number,
): number {
  hitD2GameVa113c(0x6FCBFA30)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  let outY: number
  if (pTarget !== (pUnit >>> 0) && pTarget !== 0) {
    const uTypeX = m.u32(pTarget) | 0
    const pTargetPathX = m.u32((pTarget + 0x2c) >>> 0) >>> 0
    let outX: number
    if (uTypeX === 2 || (uTypeX > 3 && uTypeX <= 5)) {
      outX = m.u32((pTargetPathX + 0x0c) >>> 0) | 0
    } else {
      outX = pTargetPathX !== 0 ? PATH_GetPosX113c(m, pTargetPathX) | 0 : 0
    }
    m.setU32(pOutX >>> 0, outX >>> 0)

    const uTypeY = m.u32(pTarget) | 0
    const pTargetPathY = m.u32((pTarget + 0x2c) >>> 0) >>> 0
    if (uTypeY === 2 || (uTypeY > 3 && uTypeY <= 5)) {
      outY = m.u32((pTargetPathY + 0x10) >>> 0) | 0
    } else {
      outY = pTargetPathY !== 0 ? PATH_GetPosY113c(m, pTargetPathY) | 0 : 0
    }
  } else {
    const pUnitPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    const firstX = PATH_GetFirstPointX113c(m, pUnitPath) | 0
    m.setU32(pOutX >>> 0, firstX >>> 0)
    outY = PATH_GetFirstPointY113c(m, pUnitPath) | 0
  }
  m.setU32(pOutY >>> 0, outY >>> 0)
  return m.u32(pOutX >>> 0) !== 0 && m.u32(pOutY >>> 0) !== 0 ? 1 : 0
}

/**
 * [16/45] Applies or extends `STATE_SKILLDELAY (0x79)` on player `pUnit` (`edi`) for `nDurationFrames`
 * (`eax`) in `pGame` (`[esp+4]`), scheduling timer event `0x0C` at `dwGameFrame + nDurationFrames`.
 *
 * Binary convention: `eax = nDurationFrames`, `edi = pUnit`, `[esp+4] = pGame` (`ret 4`).
 *
 * @va D2Game:0x6FCBFF70
 */
export function SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c(
  m: D2KernMemory113c,
  nDurationFrames: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCBFF70)
  void STATES_OnTimedStateRemoved113c
  const nExpireFrame = ((m.u32((pGame + 0xa8) >>> 0) | 0) + (nDurationFrames | 0)) >>> 0
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 0 || (nDurationFrames | 0) === 0) {
    return
  }
  let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit >>> 0, 0x79) >>> 0
  if (pStatList === 0) {
    const dwOwnerId = m.u32((pUnit + 0x0c) >>> 0) >>> 0
    const dwOwnerType = m.u32(pUnit >>> 0) >>> 0
    pStatList = STATLIST_AllocList113c(m, 2, dwOwnerType, dwOwnerId, 0, nExpireFrame) >>> 0
    if (pStatList === 0) return
    STATLIST_SetState113c(m, pStatList, 0x79)
    STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0)
    STATLIST_MergeStatLists113c(m, pUnit >>> 0, pStatList, 1)
    STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x79, 1)
  }
  STATLIST_SetExpireFrameEx113c(m, pStatList, nExpireFrame)
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 0x0c, nExpireFrame, 0, 0, 0)
}

/**
 * [17/45] Populates a `0x24`-byte `D2AuraSetupStrc` on the stack from `Skills.txt[nSkillId]`
 * (`nDuration = dwParam2 * nSkillLevel`, `nStatValue = dwParam1 + (nSkillLevel - 1) * dwParam3`)
 * and calls `STATES_CreateOrUpdateAuraStatList113c`.
 *
 * Binary convention: `ecx = nSkillLevel`, `edx = nSkillId`, `esi = pfnCallback`,
 * `[esp+4] = pOwnerUnit`, `[esp+8] = pTargetUnit`, `[esp+0xC] = nStatId`, `[esp+0x10] = nStateId` (`ret 0x10`).
 *
 * @va D2Game:0x6FCC09F0
 */
export function STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c(
  m: D2KernMemory113c,
  nSkillLevel: number,
  nSkillId: number,
  pfnCallback: number,
  pOwnerUnit: number,
  pTargetUnit: number,
  nStatId: number,
  nStateId: number,
): number {
  hitD2GameVa113c(0x6FCC09F0)
  const skillId = nSkillId | 0
  let pSkillsTxt = 0
  if (skillId >= 0) {
    const pDataTables = getDataTablesPtr113c(m)
    if (pDataTables !== 0 && skillId < (m.u32((pDataTables + 0xba0) >>> 0) | 0)) {
      const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    }
  }

  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x24) >>> 0
  try {
    const lvl = nSkillLevel | 0
    const dwParam2 = pSkillsTxt !== 0 ? m.u32((pSkillsTxt + 0x14c) >>> 0) | 0 : 0
    const nDuration = imul32(dwParam2, lvl)
    const dwParam3 = pSkillsTxt !== 0 ? m.u32((pSkillsTxt + 0x150) >>> 0) | 0 : 0
    const dwParam1 = pSkillsTxt !== 0 ? m.u32((pSkillsTxt + 0x148) >>> 0) | 0 : 0
    const nStatValue = (imul32((lvl - 1) | 0, dwParam3) + dwParam1) | 0

    m.setU32(sp, pOwnerUnit >>> 0)
    m.setU32((sp + 0x04) >>> 0, pTargetUnit >>> 0)
    m.setU32((sp + 0x08) >>> 0, skillId >>> 0)
    m.setU32((sp + 0x0c) >>> 0, lvl >>> 0)
    m.setU32((sp + 0x10) >>> 0, nDuration >>> 0)
    m.setU32((sp + 0x14) >>> 0, nStatId >>> 0)
    m.setU32((sp + 0x18) >>> 0, nStatValue >>> 0)
    m.setU32((sp + 0x1c) >>> 0, nStateId >>> 0)
    m.setU32((sp + 0x20) >>> 0, pfnCallback >>> 0)

    return STATES_CreateOrUpdateAuraStatList113c(m, sp) >>> 0
  } finally {
    w4b6ScratchSp = sp
  }
}

/**
 * [18/45] Validates `pAttacker`'s path target in `pGame`, builds a `0x70`-byte `D2DamageStrc`
 * with `dwHitFlags = 2`, `wResultFlags = 9`, `dwPhysDamage = pSkillsTxt->dwMinDam (+0x1A8) << bHitShift (+0x1A4)`,
 * and `bNoAnim (+0x60) = 1`, then calls `SUNITDMG_AllocCombat113c` (`srcDam = 0x80`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pAttacker, [esp+4] = nSkillId, [esp+8] = nSkillLevel)` (`ret 8`).
 *
 * @va D2Game:0x6FCC0E80
 */
export function SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pAttacker: number,
  nSkillId: number,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FCC0E80)
  void _nSkillLevel
  SUNIT_ValidatePathTargetUnit113c(m, pAttacker >>> 0, pGame >>> 0)
  const pPath = m.u32((pAttacker + 0x2c) >>> 0) >>> 0
  const pTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pTarget === (pAttacker >>> 0) || pTarget === 0) {
    return 0
  }

  const skillId = nSkillId | 0
  let pSkillsTxt = 0
  if (skillId >= 0) {
    const pDataTables = getDataTablesPtr113c(m)
    if (pDataTables !== 0 && skillId < (m.u32((pDataTables + 0xba0) >>> 0) | 0)) {
      const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      pSkillsTxt = (pSkillsBase + imul32(skillId, 0x23c)) >>> 0
    }
  }

  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x70) >>> 0
  try {
    for (let i = 0; i < 28; i++) {
      m.setU32((sp + i * 4) >>> 0, 0)
    }
    m.setU16((sp + 0x04) >>> 0, 9)
    m.setU32(sp, 2)
    const bHitShift = pSkillsTxt !== 0 ? m.u8((pSkillsTxt + 0x1a4) >>> 0) & 0x1f : 0
    const dwMinDam = pSkillsTxt !== 0 ? m.u32((pSkillsTxt + 0x1a8) >>> 0) : 0
    m.setU32((sp + 0x08) >>> 0, (dwMinDam << bHitShift) >>> 0)
    m.setU32((sp + 0x60) >>> 0, 1)
    SUNITDMG_AllocCombat113c(m, pGame >>> 0, pAttacker >>> 0, pTarget, sp, 0x80)
    return 1
  } finally {
    w4b6ScratchSp = sp
  }
}

/**
 * [19/45] Scans units within `nSearchRadius` (`edx`) around `(nX, nY)` / `pCenterUnit` using
 * `AURA_ForEachUnitInRadius113c` with `SKILLS_TargetRingScanCallback_6FCBED70_113c` and
 * `dwFilterFlags = dwExtraFlags | 0xA783`, returning the preferred ring-band target (`+0x00`)
 * or fallback target (`+0x08`) and optionally writing the match count (`+0x14`) to `*pOutCount` (`edi`).
 *
 * Binary convention: `eax = dwExtraFlags`, `edx = nSearchRadius`, `ecx = nRingBandRadius`, `edi = pOutCount`,
 * `[esp+4] = nX`, `[esp+8] = pGame`, `[esp+0xC] = pCenterUnit`, `[esp+0x10] = nY` (`ret 0x10`).
 *
 * @va D2Game:0x6FCC0F40
 */
export function SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(
  m: D2KernMemory113c,
  dwExtraFlags: number,
  nSearchRadius: number,
  nRingBandRadius: number,
  pOutCount: number,
  nX: number,
  pGame: number,
  pCenterUnit: number,
  nY: number,
): number {
  hitD2GameVa113c(0x6FCC0F40)
  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x18) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, 0xffffffff)
    m.setU32((sp + 0x08) >>> 0, 0)
    m.setU32((sp + 0x0c) >>> 0, nRingBandRadius >>> 0)
    m.setU32((sp + 0x10) >>> 0, nRingBandRadius >>> 0)
    m.setU32((sp + 0x14) >>> 0, 0)

    AURA_ForEachUnitInRadius113c(
      m,
      pGame >>> 0,
      pCenterUnit >>> 0,
      nX | 0,
      nY | 0,
      nSearchRadius | 0,
      (dwExtraFlags | 0xa783) >>> 0,
      0x6fcbed70,
      sp,
      0,
      SKILLS_TargetRingScanCallback_6FCBED70_113c,
    )

    let pResult = m.u32(sp) >>> 0
    if (pResult === 0) {
      pResult = m.u32((sp + 0x08) >>> 0) >>> 0
    }
    if (pOutCount !== 0) {
      m.setU32(pOutCount >>> 0, m.u32((sp + 0x14) >>> 0) >>> 0)
    }
    return pResult
  } finally {
    w4b6ScratchSp = sp
  }
}

/**
 * [20/45] Counts units within `nRadius` (`edx`) around `(nX, nY)` / `pCenterUnit` matching
 * `dwExtraFlags | 0xA783` using `AURA_ForEachUnitInRadius113c` with `SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c`.
 *
 * Binary convention: `eax = dwExtraFlags`, `edx = nRadius`, `[esp+4] = nX`, `[esp+8] = pGame`,
 * `[esp+0xC] = pCenterUnit`, `[esp+0x10] = nY` (`ret 0x10`).
 *
 * @va D2Game:0x6FCC0FC0
 */
export function SKILLS_CountUnitsInRadius_6FCC0FC0_113c(
  m: D2KernMemory113c,
  dwExtraFlags: number,
  nRadius: number,
  nX: number,
  pGame: number,
  pCenterUnit: number,
  nY: number,
): number {
  hitD2GameVa113c(0x6FCC0FC0)
  const sp = w4b6ScratchSp
  w4b6ScratchSp = (sp + 0x04) >>> 0
  try {
    m.setU32(sp, 0)
    AURA_ForEachUnitInRadius113c(
      m,
      pGame >>> 0,
      pCenterUnit >>> 0,
      nX | 0,
      nY | 0,
      nRadius | 0,
      (dwExtraFlags | 0xa783) >>> 0,
      0x6fcbe600,
      sp,
      0,
      (m2, pAuraCtx) => SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c(m2, pAuraCtx),
    )
    return m.u32(sp) | 0
  } finally {
    w4b6ScratchSp = sp
  }
}

const RING_PROJ_AXIS_DX_6FD1B6F4_113c = [20, -20, 0, 0, 14, -14, -14, 14] as const;
const RING_PROJ_AXIS_DY_6FD1B6D4_113c = [0, 0, 20, -20, 14, 14, -14, -14] as const;
const RING_PROJ_MAG_A_6FD1B714_113c = [8, 2, 11, 4, 13, 6, 9] as const;
const RING_PROJ_MAG_B_6FD1B730_113c = [18, 20, 17, 20, 15, 19, 18] as const;
const RING_PROJ_SIGN_X_6FD1B75C_113c = [-1, 1, 1, -1] as const;
const RING_PROJ_SIGN_Y_6FD1B74C_113c = [-1, -1, 1, 1] as const;

/**
 * Resolves owner unit for missile attackers, rolls dodge/avoid/evade/block, applies crit and damage, and triggers side effects.
 * @va D2Game:0x6FCC10B0
 */
export function SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pDmg: number,
  pGame: number,
  pDefender: number,
  combatHooks?: SUnitDmgHooks113c,
): void {
  hitD2GameVa113c(0x6FCC10B0)
  let pOwner = pAttacker;
  if (pOwner === 0 || pDefender === 0) {
    return;
  }
  if (m.u32(pOwner) === 3) {
    const pResolved = SUNIT_GetOwnerUnit113c(m, pOwner, pGame);
    if (pResolved !== 0) {
      pOwner = pResolved;
    }
  }
  if (m.u16(pDmg + 0x04) === 0) {
    return;
  }
  const nAvoidFlags = SUNITDMG_RollDodgeAvoidEvadeBlock113c(m, pOwner, pDefender, pDmg);
  if ((nAvoidFlags & 0x02) !== 0) {
    m.setU8(pDmg + 0x05, (m.u8(pDmg + 0x05) | 0x01) & 0xff);
  }
  if ((nAvoidFlags & 0x04) !== 0) {
    m.setU8(pDmg + 0x04, (m.u8(pDmg + 0x04) | 0x80) & 0xff);
  }
  if ((nAvoidFlags & 0x10) !== 0) {
    m.setU8(pDmg + 0x05, (m.u8(pDmg + 0x05) | 0x80) & 0xff);
  }
  if ((nAvoidFlags & 0x01) !== 0) {
    m.setU8(pDmg + 0x04, (m.u8(pDmg + 0x04) | 0x10) & 0xff);
  }
  if (nAvoidFlags !== 0) {
    m.setU8(pDmg + 0x04, (m.u8(pDmg + 0x04) & 0xfe) & 0xff);
  }
  if ((m.u8(pDmg + 0x04) & 0x01) !== 0) {
    if (STATES_CheckState113c(m, pDefender, 0x36) === 0) {
      m.setU8(pDmg + 0x04, (m.u8(pDmg + 0x04) | 0x04) & 0xff);
    }
  }
  MONSTER_ApplyCritDamage113c(m, pOwner, pDmg, pDefender);
  if ((m.u8(pDmg + 0x04) & 0x01) !== 0) {
    SUNITDMG_ApplyDamage113c(m, pGame, pOwner, pDefender, pDmg, 1, combatHooks, 1);
  }
  SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pOwner, pDefender, pDmg, combatHooks);
}

let k2W4B6DropStackPtr = 0x6fd3c800

/**
 * Resolves an item code to class ID, finds a free drop tile near the unit, and creates the dropped item.
 * @va D2Game:0x6FCC1350
 */
export function SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c(
  m: D2KernMemory113c,
  dwItemCode: number,
  pUnit: number,
  pGame: number,
  nQuality: number,
): number {
  hitD2GameVa113c(0x6FCC1350)
  const nItemId = DATATBLS_GetItemIdFromItemCode113c(m, dwItemCode) | 0;
  if (nItemId === -1) {
    return 0;
  }
  const sp = k2W4B6DropStackPtr;
  k2W4B6DropStackPtr = (sp + 0xa8) >>> 0;
  try {
    m.fill(sp, 0xa8, 0);
    const pOutCoords = sp;
    const pInCoords = (sp + 0x08) >>> 0;
    const pDropParams = (sp + 0x18) >>> 0;
    PATH_GetTargetTypeAndPosition113c(m, pUnit, pInCoords);
    const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
    const pTargetRoom =
      ITEMS_FindFreeGroundDropCoords_6FC2E930_113c(m, pRoom, pInCoords, pOutCoords, 1) >>> 0;
    if (pTargetRoom === 0) {
      return 0;
    }
    const nIlvl = ITEMS_GetDropItemLevel_6FC2E5D0_113c(m, pGame, pUnit, 0) | 0;
    m.setU32((pDropParams + 0x00) >>> 0, pUnit >>> 0);
    m.setU32((pDropParams + 0x04) >>> 0, 0);
    m.setU32((pDropParams + 0x08) >>> 0, pGame >>> 0);
    m.setU32((pDropParams + 0x0c) >>> 0, nIlvl >>> 0);
    m.setU32((pDropParams + 0x14) >>> 0, nItemId >>> 0);
    m.setU32((pDropParams + 0x18) >>> 0, 3);
    m.setU32((pDropParams + 0x1c) >>> 0, m.u32(pOutCoords));
    m.setU32((pDropParams + 0x20) >>> 0, m.u32((pOutCoords + 0x04) >>> 0));
    m.setU32((pDropParams + 0x24) >>> 0, pTargetRoom);
    m.setU16((pDropParams + 0x28) >>> 0, 1);
    m.setU16((pDropParams + 0x2a) >>> 0, pGame !== 0 ? m.u16((pGame + 0x78) >>> 0) : 0);
    m.setU32((pDropParams + 0x30) >>> 0, nQuality >>> 0);
    return D2GAME_CreateItemEx_6FC31490_113c(m, pGame, pDropParams, 0) | 0;
  } finally {
    k2W4B6DropStackPtr = sp;
  }
}

/**
 * Decrements item quantity, updates item durability to max if changed, syncs stat packets, and schedules skill frame events.
 * @va D2Game:0x6FCC16A0
 */
export function SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c(
  m: D2KernMemory113c,
  pItem: number,
  pGame: number,
  pOwnerUnit: number,
): number {
  hitD2GameVa113c(0x6FCC16A0)
  if (pItem === 0) {
    return 0;
  }
  let bDepleted = 0;
  let nNewQty = (STATLIST_GetUnitStat113c(m, pItem, 0x46, 0) - 1) | 0;
  if (nNewQty < 0) {
    bDepleted = 1;
    nNewQty = 0;
  }
  STATLIST_SetUnitStat113c(m, pItem, 0x46, nNewQty, 0);
  ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c(m, pGame, pItem);
  let pClient = 0;
  if (pOwnerUnit !== 0 && m.u32(pOwnerUnit) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit);
    pClient = pPlayerData !== 0 ? m.u32(pPlayerData + 0x9c) : 0;
  }
  NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pClient, 1, 0x46, nNewQty);
  const nMaxDur = STATLIST_GetMaxDurabilityFromUnit113c(m, pItem);
  const nCurDur = STATLIST_GetUnitStat113c(m, pItem, 0x48, 0);
  if (nCurDur !== nMaxDur) {
    STATLIST_SetUnitStat113c(m, pItem, 0x48, nMaxDur, 0);
    let pDurClient = 0;
    if (pOwnerUnit !== 0 && m.u32(pOwnerUnit) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pOwnerUnit);
      pDurClient = pPlayerData !== 0 ? m.u32(pPlayerData + 0x9c) : 0;
    }
    NET_SendPacket0x3E_ItemStatBitStream113c(m, pItem, 0, pDurClient, 1, 0x48, nMaxDur);
  }
  PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame, pOwnerUnit);
  if (bDepleted !== 0) {
    return 0;
  }
  return (nNewQty + 1) | 0;
}

/**
 * Spawns a ring/burst pattern of server projectiles around the missile parameter origin.
 * @va D2Game:0x6FCC26E0
 */
export function SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c(
  m: D2KernMemory113c,
  pMissileParams: number,
  pGame: number,
  nCount: number,
  hooks?: K2W4B6Hooks113c,
): void {
  hitD2GameVa113c(0x6FCC26E0)
  let nRem = (nCount - 1) | 0;
  const nGroupCount = Math.trunc(nRem / 5);
  if (nGroupCount > 7) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0xf0d);
    }
    return;
  }
  m.setU32(pMissileParams + 0x1c, 14);
  m.setU32(pMissileParams + 0x20, -14);
  MISSILE_CreateServerProjectile113c(m, pGame, pMissileParams);
  let nRingIdx = 0;
  while (nRem !== 0 && nRingIdx < 7) {
    for (let q = 0; q < 4; q += 1) {
      if (nRem <= 0) {
        break;
      }
      const signX = RING_PROJ_SIGN_X_6FD1B75C_113c[q]!;
      const signY = RING_PROJ_SIGN_Y_6FD1B74C_113c[q]!;
      const magA = RING_PROJ_MAG_A_6FD1B714_113c[nRingIdx]!;
      const magB = RING_PROJ_MAG_B_6FD1B730_113c[nRingIdx]!;
      m.setU32(pMissileParams + 0x1c, Math.imul(signX, magB));
      m.setU32(pMissileParams + 0x20, Math.imul(signY, magA));
      MISSILE_CreateServerProjectile113c(m, pGame, pMissileParams);
      m.setU32(pMissileParams + 0x1c, Math.imul(signX, magA));
      m.setU32(pMissileParams + 0x20, Math.imul(signY, magB));
      MISSILE_CreateServerProjectile113c(m, pGame, pMissileParams);
      nRem = (nRem - 2) | 0;
    }
    m.setU32(pMissileParams + 0x1c, RING_PROJ_AXIS_DX_6FD1B6F4_113c[nRingIdx]!);
    m.setU32(pMissileParams + 0x20, RING_PROJ_AXIS_DY_6FD1B6D4_113c[nRingIdx]!);
    MISSILE_CreateServerProjectile113c(m, pGame, pMissileParams);
    nRem = (nRem - 1) | 0;
    nRingIdx += 1;
  }
}

/**
 * Frees attacker combat list, resets anim mode and used skill, and starts basic attack mode against target.
 * @va D2Game:0x6FCC2DE0
 */
export function SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pTarget: number,
  hooks?: K2W4B6Hooks113c,
): number {
  hitD2GameVa113c(0x6FCC2DE0)
  if (pUnit === 0) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0x1211);
    }
    return 0;
  }
  if (pTarget === 0) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0x1212);
    }
    return 0;
  }
  if (pGame === 0) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0x1213);
    }
    return 0;
  }
  SUNITDMG_FreeAttackerCombatList113c(m, pUnit, pGame);
  UNITS_ChangeAnimMode113c(m, pUnit, 1);
  SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
  const pSkill = SKILLS_GetSkillById113c(m, pUnit, 0, -1);
  const dwUnitType = m.u32(pUnit);
  if (dwUnitType === 0) {
    PLAYER_StartModeOnUnit113c(m, pGame, pUnit, pTarget, 7, 0, 0, 1, pSkill);
    return 1;
  }
  if (dwUnitType === 1) {
    withW4B6Stack(0x20, (sp) => {
      MONSTER_InitModeChangeStrc113c(m, pUnit, sp, 4);
      m.setU32(sp + 0x08, pTarget);
      MONSTER_StartMode113c(m, pGame, pUnit, 4, pTarget, 0, 0);
    });
  }
  return 1;
}

/**
 * Resolves a monster's linked target monster GUID (at pMonsterData+0x40) and frees or distributes experience for it.
 * @va D2Game:0x6FCC2EE0
 */
export function SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  hooks?: K2W4B6Hooks113c,
): void {
  hitD2GameVa113c(0x6FCC2EE0)
  if (pUnit === 0) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0xfa8);
    }
    return;
  }
  const pMonsterData = m.u32(pUnit + 0x14);
  const dwTargetGuid = m.u32(pMonsterData + 0x40);
  if (pGame === 0) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0x2d3);
    }
    return;
  }
  let pNode = m.u32(pGame + 0x1320 + ((dwTargetGuid & 0x7f) << 2));
  while (pNode !== 0) {
    if (m.u32(pNode + 0x0c) === dwTargetGuid) {
      const bSummonFlag = (m.u32(pNode + 0xc8) >>> 8) & 0x01;
      if (bSummonFlag !== 0) {
        SUNIT_FreeUnit113c(m, pGame, pNode);
        m.setU32(m.u32(pUnit + 0x14) + 0x40, -1);
        return;
      }
      m.setU32(pNode + 0xc4, m.u32(pNode + 0xc4) | 0x04000000);
      SUNITDMG_DistributeExperience113c(m, pGame, pUnit, pNode);
      break;
    }
    pNode = m.u32(pNode + 0xe4);
  }
  m.setU32(m.u32(pUnit + 0x14) + 0x40, -1);
}

/**
 * Applies timed stun state (0x15) to a valid monster unit, schedules state expiration event (0x0c), and puts monster into neutral mode.
 * @va D2Game:0x6FCC2F90
 */
export function SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c(
  m: D2KernMemory113c,
  nDuration: number,
  pUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCC2F90)
  if (STATES_CheckState113c(m, pUnit, 0x36) !== 0) {
    return;
  }
  if (pUnit === 0 || m.u32(pUnit) !== 1) {
    return;
  }
  const pMonsterData = m.u32(pUnit + 0x14);
  if (pMonsterData !== 0 && (m.u8(pMonsterData + 0x16) & 0x08) !== 0) {
    return;
  }
  if (MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pUnit) !== 0) {
    return;
  }
  const pExisting = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, nDuration);
  let nExpireFrame = m.u32(pGame + 0xa8);
  if (pExisting === 0) {
    nExpireFrame = (nExpireFrame + 0x64) | 0;
    const pStatList = STATLIST_AllocList113c(
      m,
      2,
      m.u32(pUnit),
      m.u32(pUnit + 0x0c),
      0,
      nExpireFrame,
    );
    if (pStatList !== 0) {
      EVENT_SetEventFull113c(m, pGame, pUnit, 0x0c, nExpireFrame, 0, 0);
      STATLIST_SetState113c(m, pStatList, 0x15);
      STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0);
      STATLIST_MergeStatLists113c(m, pUnit, pStatList, 1);
      STATES_ToggleGfxStateFlag113c(m, pUnit, 0x15, 1);
    }
  } else {
    nExpireFrame = (nExpireFrame + nDuration) | 0;
    STATLIST_SetExpireFrameEx113c(m, pExisting, nExpireFrame);
    EVENT_SetEventFull113c(m, pGame, pUnit, 0x0c, nExpireFrame, 0, 0);
  }
  withW4B6Stack(0x20, (sp) => {
    MONSTER_InitModeChangeStrc113c(m, pUnit, sp, 1);
    MONSTER_StartMode113c(m, pGame, pUnit, 1, 0, 0, 0);
  });
  m.setU32(pUnit + 0xc4, m.u32(pUnit + 0xc4) & ~1);
}

/**
 * Evaluates a skill's periodic delay (`perdelay`) and schedules timer event 8 or 9 aligned to the period grid.
 * @va D2Game:0x6FCC3120
 */
export function SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  nSkillLevel: number,
  pGame: number,
  pUnit: number,
  nEvalSkillLevel: number,
  bUseEvent8: number,
): number {
  hitD2GameVa113c(0x6FCC3120)
  if (nSkillId < 0) {
    return 0;
  }
  const pDataTables = getDataTablesPtr113c(m);
  if (nSkillId >= (m.u32(pDataTables + 0xba0) | 0)) {
    return 0;
  }
  const pSkillsTxt = (m.u32(pDataTables + 0xb98) + Math.imul(nSkillId, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) {
    return 0;
  }
  const bSkillFlags0 = m.u8(pSkillsTxt + 0x04);
  const pBitMasks = m.u32(0x6fd18be0);
  if ((m.u32(pBitMasks + 0x18) & bSkillFlags0) === 0 && (m.u32(pBitMasks + 0x14) & bSkillFlags0) === 0) {
    return 0;
  }
  let nPeriod = SKILLS_EvalCalcByOffset113c(m, pUnit, m.u32(pSkillsTxt + 0x128) | 0, nSkillId, nEvalSkillLevel);
  if (nPeriod <= 5) {
    nPeriod = 5;
  }
  const nGameFrame = m.u32(pGame + 0xa8) | 0;
  const nNextFrame = (Math.imul(Math.trunc((nGameFrame + nPeriod - 1) / nPeriod), nPeriod) + 1) | 0;
  if (bUseEvent8 !== 0) {
    if (pUnit !== 0) {
      let pEv = m.u32(pUnit + 0xdc);
      while (pEv !== 0) {
        const pNext = m.u32(pEv + 0x24);
        if (m.u8(pEv) === 8 && (m.u32(pEv + 0x14) | 0) === -1) {
          EVENT_FreeNode113c(m, pGame, pEv);
        }
        pEv = pNext;
      }
    }
    EVENT_SetEventFull113c(m, pGame, pUnit, 8, nNextFrame, 0, -1, 0);
  } else {
    EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 9, nSkillLevel);
    EVENT_SetEventFull113c(m, pGame, pUnit, 9, nNextFrame, 0, nSkillLevel, nSkillId);
  }
  return 1;
}

/**
 * Applies monster skill icon, timed target aura state, and self aura state on melee combat hit, then executes combat events.
 * @va D2Game:0x6FCC3220
 */
export function SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
  hooks?: SUnitDmgHooks113c,
): number {
  hitD2GameVa113c(0x6FCC3220)
  if (nSkillId < 0) {
    return 0;
  }
  const pDataTables = getDataTablesPtr113c(m);
  if (nSkillId >= (m.u32(pDataTables + 0xba0) | 0)) {
    return 0;
  }
  const pSkillsTxt = (m.u32(pDataTables + 0xb98) + Math.imul(nSkillId, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) {
    return 0;
  }
  const wMonStatIcon = sx16(m.u16(pSkillsTxt + 0x4e));
  if (wMonStatIcon > 0 && wMonStatIcon <= (m.u32(pDataTables + 0xbc0) | 0)) {
    SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
    const pTarget = PATH_GetTargetUnit113c(m, m.u32(pUnit + 0x2c));
    if (pTarget === pUnit || pTarget === 0) {
      return 0;
    }
    const pDmg = SUNITDMG_FindCombatDamageData113c(m, pUnit, pTarget);
    if (pDmg === 0) {
      return 1;
    }
    if ((m.u8(pDmg + 0x04) & 0x01) !== 0) {
      STATES_SetMonsterSkillIconOnUnit113c(m, pTarget, sx16(m.u16(pSkillsTxt + 0x4e)), 0);
    }
  }
  const wAuraTargetState = sx16(m.u16(pSkillsTxt + 0x82));
  if (wAuraTargetState >= 0) {
    const pDt = getDataTablesPtr113c(m);
    if (wAuraTargetState < (m.u32(pDt + 0xc4) | 0)) {
      SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
      const pTarget = PATH_GetTargetUnit113c(m, m.u32(pUnit + 0x2c));
      if (pTarget === pUnit || pTarget === 0) {
        return 0;
      }
      const pDmg = SUNITDMG_FindCombatDamageData113c(m, pUnit, pTarget);
      if (pDmg === 0) {
        return 1;
      }
      if ((m.u8(pDmg + 0x04) & 0x01) !== 0) {
        let nLen = SKILLS_EvalCalcByOffset113c(m, pUnit, m.u32(pSkillsTxt + 0x60) | 0, nSkillId, nSkillLevel);
        if (nLen < 1) {
          nLen = 1;
        }
        const nExpireFrame = (m.u32(pGame + 0xa8) + nLen) | 0;
        let pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pTarget, sx16(m.u16(pSkillsTxt + 0x82)));
        if (pStatList === 0) {
          pStatList = STATLIST_AllocList113c(
            m,
            2,
            m.u32(pTarget),
            m.u32(pTarget + 0x0c),
            0,
            nExpireFrame,
          );
          if (pStatList === 0) {
            return 1;
          }
        }
        EVENT_SetEventFull113c(m, pGame, pTarget, 0x0c, nExpireFrame, 0, 0);
        STATES_ToggleGfxStateFlag113c(m, pTarget, sx16(m.u16(pSkillsTxt + 0x82)), 1);
        STATLIST_SetState113c(m, pStatList, sx16(m.u16(pSkillsTxt + 0x82)));
        STATLIST_MergeStatLists113c(m, pTarget, pStatList, 1);
        STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0);
        SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, pSkillsTxt, pTarget, pStatList, nSkillId, nSkillLevel);
      }
    }
  }
  const wAuraState = sx16(m.u16(pSkillsTxt + 0x80));
  if (wAuraState > 0) {
    const pDt = getDataTablesPtr113c(m);
    if (wAuraState < (m.u32(pDt + 0xc4) | 0)) {
      let pSelfStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, wAuraState);
      if (pSelfStatList === 0) {
        const nOwnerType = pUnit !== 0 ? m.u32(pUnit) : 6;
        const nOwnerId = pUnit !== 0 ? m.u32(pUnit + 0x0c) : -1;
        pSelfStatList = STATLIST_AllocList113c(m, 4, nOwnerType, nOwnerId, 0, 0);
        if (pSelfStatList === 0) {
          return 1;
        }
        STATLIST_SetState113c(m, pSelfStatList, sx16(m.u16(pSkillsTxt + 0x80)));
        STATLIST_MergeStatLists113c(m, pUnit, pSelfStatList, 1);
        STATLIST_SetStatRemoveProc113c(m, pSelfStatList, 0x6fcbf7a0);
      }
      STATES_ToggleGfxStateFlag113c(m, pUnit, sx16(m.u16(pSkillsTxt + 0x80)), 1);
      SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, pSkillsTxt, pUnit, pSelfStatList, nSkillId, nSkillLevel);
    }
  }
  if (pUnit !== 0) {
    m.setU32(pUnit + 0xc4, m.u32(pUnit + 0xc4) | 0x40);
  }
  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pFinalTarget = PATH_GetTargetUnit113c(m, m.u32(pUnit + 0x2c));
  if (pFinalTarget === pUnit || pFinalTarget === 0) {
    return 0;
  }
  SUNITDMG_ExecuteEvents113c(m, pGame, pUnit, pFinalTarget, 1, 0, hooks);
  return 1;
}

/**
 * Allocates a timed state StatList on a target unit, schedules event 0x0c, and applies skill aura stat calcs.
 * @va D2Game:0x6FCC34E0
 */
export function SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pCaster: number,
  pTarget: number,
  nState: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCC34E0)
  if (nSkillId < 0) {
    return 0;
  }
  const pDataTables = getDataTablesPtr113c(m);
  if (nSkillId >= (m.u32(pDataTables + 0xba0) | 0)) {
    return 0;
  }
  const pSkillsTxt = (m.u32(pDataTables + 0xb98) + Math.imul(nSkillId, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) {
    return 0;
  }
  const nLen = SKILLS_EvalCalcByOffset113c(m, pCaster, m.u32(pSkillsTxt + 0x60) | 0, nSkillId, nSkillLevel);
  const nOwnerType = pCaster !== 0 ? m.u32(pCaster) : 6;
  const nOwnerId = pCaster !== 0 ? m.u32(pCaster + 0x0c) : -1;
  const nExpireFrame = (m.u32(pGame + 0xa8) + nLen) | 0;
  const pStatList = STATLIST_AllocList113c(m, 2, nOwnerType, nOwnerId, 0, nExpireFrame);
  if (pStatList === 0) {
    return 0;
  }
  STATLIST_SetState113c(m, pStatList, nState);
  STATLIST_SetStatRemoveProc113c(m, pStatList, 0x6fcbf7a0);
  STATLIST_MergeStatLists113c(m, pTarget, pStatList, 1);
  STATES_ToggleGfxStateFlag113c(m, pTarget, nState, 1);
  EVENT_SetEventFull113c(m, pGame, pTarget, 0x0c, (m.u32(pGame + 0xa8) + nLen) | 0, 0, 0);
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, pSkillsTxt, pCaster, pStatList, nSkillId, nSkillLevel);
  return pStatList;
}

/**
 * Checks if any other state sharing the same non-zero state group (`wGroup` at `+0x1e`) is active on the unit.
 * @va D2Game:0x6FCC3A20
 */
export function STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nState: number,
): number {
  hitD2GameVa113c(0x6FCC3A20)
  if (nState < 0) {
    return 0;
  }
  const pDataTables = getDataTablesPtr113c(m);
  const nNumStates = m.u32(pDataTables + 0xc4) | 0;
  if (nState >= nNumStates) {
    return 0;
  }
  const pStatesBase = m.u32(pDataTables + 0xbc);
  const pStateRow = (pStatesBase + Math.imul(nState, 0x3c)) >>> 0;
  if (pStateRow === 0) {
    return 0;
  }
  const wGroup = sx16(m.u16(pStateRow + 0x1e));
  if (wGroup === 0) {
    return 0;
  }
  let bFoundOther = 0;
  if (nNumStates > 0) {
    let nByteOffset = 0;
    for (let i = 0; i < nNumStates; i += 1) {
      if (i !== nState) {
        let pRow = 0;
        if (nByteOffset >= 0) {
          const pDt = getDataTablesPtr113c(m);
          if (i < (m.u32(pDt + 0xc4) | 0)) {
            pRow = (m.u32(pDt + 0xbc) + nByteOffset) >>> 0;
          }
        }
        if (sx16(m.u16(pRow + 0x1e)) === wGroup) {
          if (STATES_CheckState113c(m, pUnit, i) !== 0) {
            bFoundOther = 1;
          }
        }
      }
      nByteOffset = (nByteOffset + 0x3c) | 0;
    }
  }
  return bFoundOther;
}

/**
 * Steps up to 3 room tiles along the negated monster subclass velocity vector and checks if a monster corpse/spawn exists.
 * @va D2Game:0x6FCC3B50
 */
export function SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  hooks?: K2W4B6Hooks113c,
): number {
  hitD2GameVa113c(0x6FCC3B50)
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (pRoom === 0) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0x141b);
      return 0;
    }
    throw new D2CommonAssertError('0x6fd19ff9', 0x141b);
  }
  return withW4B6Stack(0x30, (sp) => {
    const pOutDx = sp + 0x00;
    const pOutDy = sp + 0x04;
    const pCoords = sp + 0x08;
    DUNGEON_GetRoomCoordinates113c(m, pRoom, pCoords);
    let curX = m.u32(pCoords + 0x00) | 0;
    let curY = m.u32(pCoords + 0x04) | 0;
    m.setU32(pOutDx, 0);
    m.setU32(pOutDy, 0);
    MONSTER_GetSubClassVelocityInfo113c(m, pUnit, pOutDx, pOutDy);
    const negDx = (-(m.u32(pOutDx) | 0)) | 0;
    const negDy = (-(m.u32(pOutDy) | 0)) | 0;
    const nMonHcIdx = pUnit === 0 ? -20 : ((m.u32(pUnit + 0x04) | 0) - 19) | 0;
    let nRes = 0;
    for (let step = 0; step < 3; step += 1) {
      curX = (curX + Math.imul(m.u32(pCoords + 0x08) | 0, negDx)) | 0;
      curY = (curY + Math.imul(m.u32(pCoords + 0x0c) | 0, negDy)) | 0;
      nRes = MONREG_IsMonsterDeadAtCoords_6FC3EE50_113c(m, curX, curY, pGame, pRoom, nMonHcIdx);
      if (nRes !== 0) {
        break;
      }
    }
    return nRes;
  });
}

/**
 * Checks whether a candidate target unit is a living monster eligible for skill targeting based on MonStats flags and type masks.
 * @va D2Game:0x6FCC3C80
 */
export function SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c(
  m: D2KernMemory113c,
  pTarget: number,
  pCaster: number,
): number {
  hitD2GameVa113c(0x6FCC3C80)
  if (pTarget === 0 || pCaster === pTarget) {
    return 0;
  }
  const dwUnitType = m.u32(pTarget);
  if (dwUnitType !== 1) {
    return 0;
  }
  if (SUNIT_IsDeadOrDying113c(m, pTarget) !== 0) {
    return 0;
  }
  const pMonStats = MONSTATS_GetRecordPtr113c(m, m.u32(pTarget + 0x04) | 0);
  if (pMonStats === 0) {
    return 0;
  }
  const bFlags1 = m.u8(pMonStats + 0x0d);
  const pBitMasks = m.u32(0x6fd18be0);
  if ((m.u32(pBitMasks) & bFlags1) !== 0) {
    return 0;
  }
  if ((m.u32(pBitMasks + 0x1c) & bFlags1) === 0) {
    return 0;
  }
  if (MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pTarget) !== 0) {
    return 1;
  }
  if (MONSTER_GetMonStatsInteractBit113c(m, pTarget) !== 0) {
    return 1;
  }
  return MONSTER_CheckTypeFlagsMask113c(m, pTarget, 0x0e) !== 0 ? 1 : 0;
}

/**
 * Updates monster AI control state and step direction, sets path step count to 1, and starts monster walk mode (2).
 * @va D2Game:0x6FCC41B0
 */
export function AI_SetStateDirAndStartWalkMode_6FCC41B0_113c(
  m: D2KernMemory113c,
  nAiState: number,
  bStepDir: number,
  pUnit: number,
  pGame: number,
  pTargetOrDest: number,
): number {
  hitD2GameVa113c(0x6FCC41B0)
  const nMappedState = nAiState === 1 ? 7 : nAiState;
  let pAiControl = 0;
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pMonsterData = m.u32(pUnit + 0x14);
    if (pMonsterData !== 0) {
      pAiControl = m.u32(pMonsterData + 0x2c);
    }
  }
  if (nMappedState !== 0) {
    m.setU32(pAiControl + 0x18, nMappedState);
  }
  let bDir = bStepDir & 0xff;
  if (bDir !== 0) {
    if (bDir >= 0x4e) {
      bDir = 0x4d;
    }
    m.setU8(pAiControl + 0x20, bDir);
  }
  SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
  return withW4B6Stack(0x20, (sp) => {
    for (let i = 0; i < 8; i += 1) {
      m.setU32(sp + i * 4, 0);
    }
    m.setU32(sp + 0x00, 2);
    m.setU32(sp + 0x04, pUnit);
    m.setU8(sp + 0x15, pUnit !== 0 ? 0x65 : 0x64);
    PATH_SetStepNum113c(m, m.u32(pUnit + 0x2c), 1);
    m.setU32(sp + 0x08, pTargetOrDest);
    return MONSTER_StartMode113c(m, pGame, pUnit, 2, pTargetOrDest, 0, 0);
  });
}

/**
 * Syncs a summoned monster's AI skill level from its player owner's MonStats skill (`+0x80`) and initializes basic attack skill 0.
 * @va D2Game:0x6FCC4260
 */
export function AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC4260)
  const pAiCmd = m.u32(pAiArgs + 0x00);
  m.setU32(pAiCmd + 0x1c, 1);
  if (pUnit === 0 || m.u32(pUnit) !== 1) {
    return;
  }
  const pMonsterData = m.u32(pUnit + 0x14);
  if (pMonsterData === 0) {
    return;
  }
  const pAiGeneral = m.u32(pMonsterData + 0x28);
  if (pAiGeneral === 0) {
    return;
  }
  const pOwnerGame = m.u32(pAiGeneral + 0x28);
  if (pOwnerGame === 0) {
    return;
  }
  const nOwnerGuid = m.u32(pAiGeneral + 0x2c);
  const nOwnerType = m.u32(pAiGeneral + 0x30);
  const pOwner = SUNIT_GetServerUnit113c(m, pOwnerGame, nOwnerType, nOwnerGuid);
  if (pOwner === 0 || m.u32(pOwner) !== 0) {
    return;
  }
  const pMonStats = m.u32(pAiArgs + 0x1c);
  const nOwnerSkillId = sx16(m.u16(pMonStats + 0x80));
  const pOwnerSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pOwner, nOwnerSkillId);
  if (pOwnerSkill !== 0) {
    const nSkillLvl = SKILLS_EvaluateSkillLevel113c(m, pOwner, pOwnerSkill, 1);
    m.setU32(pAiCmd + 0x1c, nSkillLvl);
  }
  if (SKILLS_GetSkillById113c(m, pUnit, 0, -1) === 0) {
    SKILLS_SetSkillLevelOnUnit113c(m, pUnit, 0, 1, 0, 0x6fd1b6b0, 0xc1d);
  }
  SKILLS_SetLeftSkill113c(m, pUnit, 0, -1);
  SKILLS_SetRightSkill113c(m, pUnit, 0, -1);
}

/**
 * Syncs a summoned monster's AI skill level (`pAiCmd+0x1c`) from its owner's highest level skill (`pMonStats+0x80`).
 * @va D2Game:0x6FCC4450
 */
export function AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC4450)
  const pAiCmd = m.u32(pAiArgs + 0x00);
  m.setU32(pAiCmd + 0x1c, 1);
  if (pUnit === 0 || m.u32(pUnit) !== 1) {
    return;
  }
  const pMonsterData = m.u32(pUnit + 0x14);
  if (pMonsterData === 0) {
    return;
  }
  const pAiGeneral = m.u32(pMonsterData + 0x28);
  if (pAiGeneral === 0) {
    return;
  }
  const pOwnerGame = m.u32(pAiGeneral + 0x28);
  if (pOwnerGame === 0) {
    return;
  }
  const nOwnerGuid = m.u32(pAiGeneral + 0x2c);
  const nOwnerType = m.u32(pAiGeneral + 0x30);
  const pOwner = SUNIT_GetServerUnit113c(m, pOwnerGame, nOwnerType, nOwnerGuid);
  if (pOwner === 0) {
    return;
  }
  const pMonStats = m.u32(pAiArgs + 0x1c);
  const nOwnerSkillId = sx16(m.u16(pMonStats + 0x80));
  const pOwnerSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pOwner, nOwnerSkillId);
  if (pOwnerSkill !== 0) {
    const nSkillLvl = SKILLS_EvaluateSkillLevel113c(m, pOwner, pOwnerSkill, 1);
    m.setU32(pAiCmd + 0x1c, nSkillLvl);
  }
}

/**
 * Checks if a summoned monster's owner is outside town and tracks/decrements its charge/lifetime counter (`pAiCmd+0x18`), killing it when depleted.
 * @va D2Game:0x6FCC4A10
 */
export function AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pAiArgs: number,
  bDecrementCounter: number,
): number {
  hitD2GameVa113c(0x6FCC4A10)
  let bOwnerOutsideTown = 0;
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pMonsterData = m.u32(pUnit + 0x14);
    if (pMonsterData !== 0) {
      const pAiGeneral = m.u32(pMonsterData + 0x28);
      if (pAiGeneral !== 0) {
        const pOwnerGame = m.u32(pAiGeneral + 0x28);
        if (pOwnerGame !== 0) {
          const pOwner = SUNIT_GetServerUnit113c(
            m,
            pOwnerGame,
            m.u32(pAiGeneral + 0x30),
            m.u32(pAiGeneral + 0x2c),
          );
          if (pOwner !== 0) {
            const pRoom = UNITS_GetRoom113c(m, pOwner);
            if (pRoom !== 0 && DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) === 0) {
              bOwnerOutsideTown = 1;
            }
          }
        }
      }
    }
  }
  if (bOwnerOutsideTown === 0) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
    withW4B6Stack(0x20, (sp) => {
      for (let i = 0; i < 8; i += 1) {
        m.setU32(sp + i * 4, 0);
      }
      m.setU32(sp + 0x04, pUnit);
      m.setU8(sp + 0x15, 0x64);
      MONSTER_StartMode113c(m, pGame, pUnit, 0, 0, 0, 0);
    });
    return 1;
  }
  let pAiCmd = m.u32(pAiArgs + 0x00);
  if ((m.u32(pAiCmd + 0x18) | 0) < 0) {
    const pMonStats = m.u32(pAiArgs + 0x1c);
    const nSkillId = sx16(m.u16(pMonStats + 0x170));
    let pSkillsTxt = 0;
    if (nSkillId >= 0) {
      const pDt = getDataTablesPtr113c(m);
      if (nSkillId < (m.u32(pDt + 0xba0) | 0)) {
        pSkillsTxt = (m.u32(pDt + 0xb98) + Math.imul(nSkillId, 0x23c)) >>> 0;
      }
    }
    if (pSkillsTxt === 0) {
      AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, pUnit, 0, pGame, 0, 0);
      return 1;
    }
    const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, nSkillId);
    if (pSkill === 0) {
      AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, pUnit, 0, pGame, 0, 0);
      return 1;
    }
    const nSkillLvl = SKILLS_EvaluateSkillLevel113c(m, pUnit, pSkill, 1);
    const nCalcVal = SKILLS_EvalCalcByOffset113c(m, pUnit, m.u32(pSkillsTxt + 0x144) | 0, nSkillId, nSkillLvl);
    pAiCmd = m.u32(pAiArgs + 0x00);
    m.setU32(pAiCmd + 0x18, nCalcVal);
  }
  const nCounter = m.u32(pAiCmd + 0x18) | 0;
  if (nCounter <= 0) {
    AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, pUnit, 0, pGame, 0, 0);
    return 1;
  }
  if (bDecrementCounter !== 0) {
    m.setU32(pAiCmd + 0x18, (nCounter - 1) | 0);
  }
  return 0;
}

/**
 * Executes a two-stage monster AI action: first attacks at `(x - 10, y)` (setting `pAiCmd+0x18 = 1`), then dies on next tick.
 * @va D2Game:0x6FCC4B90
 */
export function AI_AttackWestOffsetThenDie_6FCC4B90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC4B90)
  const pAiCmd = m.u32(pAiArgs + 0x00);
  if ((m.u32(pAiCmd + 0x18) | 0) === 1) {
    if (pUnit !== 0) {
      m.setU32(pUnit + 0xc4, m.u32(pUnit + 0xc4) | 0x20000);
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
    withW4B6Stack(0x20, (sp) => {
      for (let i = 0; i < 8; i += 1) {
        m.setU32(sp + i * 4, 0);
      }
      m.setU32(sp + 0x04, pUnit);
      m.setU8(sp + 0x15, 0x64);
      MONSTER_StartMode113c(m, pGame, pUnit, 0, 0, 0, 0);
    });
    return;
  }
  const dwTypeY = m.u32(pUnit);
  let nPosY = 0;
  if (dwTypeY === 2 || (dwTypeY > 3 && dwTypeY <= 5)) {
    nPosY = m.u32(m.u32(pUnit + 0x2c) + 0x10) | 0;
  } else {
    const pPath = m.u32(pUnit + 0x2c);
    nPosY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) : 0;
  }
  const dwTypeX = m.u32(pUnit);
  let nPosX = 0;
  if (dwTypeX === 2 || (dwTypeX > 3 && dwTypeX <= 5)) {
    nPosX = m.u32(m.u32(pUnit + 0x2c) + 0x0c) | 0;
  } else {
    const pPath = m.u32(pUnit + 0x2c);
    nPosX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) : 0;
  }
  SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
  let bAnimSpeed = 0x64;
  const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32(pUnit + 0x04) | 0);
  if (pMonStats2 !== 0) {
    const bFlag = m.u8(pMonStats2 + 0x104);
    const pBitMasks = m.u32(0x6fd18be0);
    if ((bFlag & m.u32(pBitMasks + 0x10)) !== 0) {
      bAnimSpeed = 0x65;
    }
  }
  withW4B6Stack(0x20, (sp) => {
    for (let i = 0; i < 8; i += 1) {
      m.setU32(sp + i * 4, 0);
    }
    m.setU32(sp + 0x00, 4);
    m.setU32(sp + 0x04, pUnit);
    m.setU8(sp + 0x15, bAnimSpeed);
    m.setU32(sp + 0x0c, (nPosX - 10) | 0);
    m.setU32(sp + 0x10, nPosY);
    MONSTER_StartMode113c(m, pGame, pUnit, 4, 0, (nPosX - 10) | 0, nPosY);
  });
  m.setU32(pAiCmd + 0x18, 1);
}

/**
 * Runs summoned turret/totem AI: validates owner alive and lifetime (`pAiCmd+0x1c`), rolls attack chance (`aip1`), or stalls (`aip2`).
 * @va D2Game:0x6FCC4D10
 */
export function AI_TickSummonedTimedAttacker_6FCC4D10_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC4D10)
  if (pUnit === 0 || ((m.u32(pUnit + 0xc8) >>> 10) & 0x01) === 0) {
    SUNITDMG_DistributeExperience113c(m, pGame, 0, pUnit);
    return;
  }
  const pOwner = SUNIT_GetServerUnit113c(m, pGame, m.u32(pUnit + 0x94), m.u32(pUnit + 0x98));
  if (pOwner === 0 || SUNIT_IsDeadOrDying113c(m, pOwner) !== 0) {
    SUNITDMG_DistributeExperience113c(m, pGame, 0, pUnit);
    return;
  }
  const bHasTargetInRange = m.u32(pAiArgs + 0x18);
  const pAiCmd = m.u32(pAiArgs + 0x00);
  const pTarget = m.u32(pAiArgs + 0x08);
  const pMonStats = m.u32(pAiArgs + 0x1c);
  if (m.u32(pAiCmd + 0x1c) === 0) {
    const bDiff = m.u8(pGame + 0x6d);
    const nBaseSec = sx16(m.u16(pMonStats + 0x62 + bDiff * 2));
    const seed = { lo: m.u32(pUnit + 0x20), hi: m.u32(pUnit + 0x24) };
    const nRoll = seedRoll(seed, nBaseSec) | 0;
    m.setU32(pUnit + 0x20, seed.lo >>> 0);
    m.setU32(pUnit + 0x24, seed.hi >>> 0);
    const nExpireFrame = (m.u32(pGame + 0xa8) + Math.imul((nRoll + nBaseSec) | 0, 25)) | 0;
    m.setU32(m.u32(pAiArgs + 0x00) + 0x1c, nExpireFrame);
  }
  const pCmdNow = m.u32(pAiArgs + 0x00);
  if ((m.u32(pGame + 0xa8) | 0) > (m.u32(pCmdNow + 0x1c) | 0)) {
    SUNITDMG_DistributeExperience113c(m, pGame, 0, pUnit);
    return;
  }
  if (bHasTargetInRange !== 0) {
    const seed = { lo: m.u32(pUnit + 0x20), hi: m.u32(pUnit + 0x24) };
    const nRoll = seedRoll(seed, 100) | 0;
    m.setU32(pUnit + 0x20, seed.lo >>> 0);
    m.setU32(pUnit + 0x24, seed.hi >>> 0);
    const bDiff = m.u8(pGame + 0x6d);
    const nAttackChance = sx16(m.u16(pMonStats + 0x56 + bDiff * 2));
    if (nRoll < nAttackChance) {
      AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget);
      return;
    }
  }
  const bDiff = m.u8(pGame + 0x6d);
  const nStallFrames = sx16(m.u16(pMonStats + 0x5c + bDiff * 2));
  AI_Stall113c(m, pGame, pUnit, nStallFrames);
}

/**
 * Grants skill `0x11e` (286) on the monster, sets skill param1, casts it at `(posX, posY + 13)` in mode 10, and updates AI state/timers.
 * @va D2Game:0x6FCC4E40
 */
export function AI_CastSkill286AtOffsetY13_6FCC4E40_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pAiArgs: number,
  nParam1: number,
  hooks?: K2W4B6Hooks113c,
): void {
  hitD2GameVa113c(0x6FCC4E40)
  SKILLS_SetSkillLevelOnUnit113c(m, pUnit, 0x11e, 1, 0, 0x6fd1b6b0, 0x1700);
  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, pUnit, 0x11e);
  if (pSkill === 0) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0x1702);
    }
    return;
  }
  SKILLS_SetParam1113c(m, pSkill, nParam1);
  if (pUnit === 0) {
    if (hooks !== undefined && hooks.assertFault !== undefined) {
      hooks.assertFault(0xa2a);
    }
    return;
  }
  const pGame = m.u32(pUnit + 0x80);
  const dwTypeY = m.u32(pUnit);
  let nPosY = 0;
  if (dwTypeY === 2 || (dwTypeY > 3 && dwTypeY <= 5)) {
    nPosY = m.u32(m.u32(pUnit + 0x2c) + 0x10) | 0;
  } else {
    const pPath = m.u32(pUnit + 0x2c);
    nPosY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) : 0;
  }
  const dwTypeX = m.u32(pUnit);
  let nPosX = 0;
  if (dwTypeX === 2 || (dwTypeX > 3 && dwTypeX <= 5)) {
    nPosX = m.u32(m.u32(pUnit + 0x2c) + 0x0c) | 0;
  } else {
    const pPath = m.u32(pUnit + 0x2c);
    nPosX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) : 0;
  }
  AI_CastSkillWithMode113c(m, 0x0a, pUnit, pGame, 0x11e, 0, nPosX, (nPosY + 13) | 0);
  const pCmd0 = m.u32(pAiArgs + 0x00);
  m.setU32(pCmd0 + 0x14, ((m.u32(pCmd0 + 0x14) | 0) + 1) | 0);
  const pCmd1 = m.u32(pAiArgs + 0x00);
  m.setU32(pCmd1 + 0x1c, (m.u32(pGame + 0xa8) + 0x64) | 0);
  const pCmd2 = m.u32(pAiArgs + 0x00);
  m.setU32(pCmd2 + 0x18, (m.u32(pCmd2 + 0x18) | 0x02) & ~0x01);
}

/**
 * Checks Act 5 Quest 5 (Ancients) state and summit player count; if no players remain on the summit, reverts Ancient to statue via skill `0x12e`.
 * @va D2Game:0x6FCC4F40
 */
export function AI_TickAncientStatueRevertCheck_6FCC4F40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _pAiArgs?: number,
): void {
  hitD2GameVa113c(0x6FCC4F40)
  const pQuestControl = m.u32(pGame + 0x10f4);
  let pQuest35 = 0;
  if (pQuestControl !== 0) {
    let pNode = m.u32(pQuestControl);
    while (pNode !== 0) {
      if (m.u32(pNode) === 0x23) {
        pQuest35 = pNode;
        break;
      }
      pNode = m.u32(pNode + 0xf4);
    }
  }
  if (pQuest35 === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }
  const pQuestData = m.u32(pQuest35 + 0x18);
  if (m.u8(pQuestData + 0x11) === 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }
  if (ACT5Q5_GetSummitPlayerCount_6FC766D0_113c(m, pGame) !== 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }
  if (STATES_CheckState113c(m, pUnit, 0x92) !== 0) {
    AI_Stall113c(m, pGame, pUnit, 0x19);
    return;
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  DUNGEON_ToggleHasPortalFlag113c(m, pRoom, 0);
  const nPosY = UNIT_GetPosY113c(m, pUnit);
  const nPosX = UNIT_GetPosX113c(m, pUnit);
  AI_CastSkillWithMode113c(m, 4, pUnit, pGame, 0x12e, 0, nPosX, nPosY);
}

/**
 * Runs familiar/vine follow AI: stalls while cooldown (`pAiCmd+0x14`) is active unless owner is running, then casts skill `0x124` near owner.
 * @va D2Game:0x6FCC5350
 */
export function AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC5350)
  const pAiCmd = m.u32(pAiArgs + 0x00);
  const pMonStats = m.u32(pAiArgs + 0x1c);
  let pOwner = 0;
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pMonsterData = m.u32(pUnit + 0x14);
    if (pMonsterData !== 0) {
      const pAiGeneral = m.u32(pMonsterData + 0x28);
      if (pAiGeneral !== 0) {
        const pOwnerGame = m.u32(pAiGeneral + 0x28);
        if (pOwnerGame !== 0) {
          pOwner = SUNIT_GetServerUnit113c(
            m,
            pOwnerGame,
            m.u32(pAiGeneral + 0x30),
            m.u32(pAiGeneral + 0x2c),
          );
        }
      }
    }
  }
  const bDiff = m.u8(pGame + 0x6d);
  let nRadius = sx16(m.u16(pMonStats + 0x56 + bDiff * 2));
  const nOwnerMode = pOwner !== 0 ? m.u32(pOwner + 0x10) : 0;
  const bOwnerRunning = nOwnerMode === 3 ? 1 : 0;
  if (bOwnerRunning !== 0) {
    nRadius = Math.trunc(nRadius / 2);
  }
  if ((m.u32(pAiCmd + 0x14) | 0) >= (m.u32(pGame + 0xa8) | 0) && bOwnerRunning === 0) {
    let bForceFollow = 0;
    if (pUnit !== 0 && m.u32(pUnit) === 1) {
      const pMonsterData = m.u32(pUnit + 0x14);
      if (pMonsterData !== 0) {
        const nOrder = m.u32(pMonsterData + 0x54);
        if (nOrder === 3 || nOrder === 0x13) {
          bForceFollow = 1;
        }
      }
    }
    if (bForceFollow === 0) {
      const nStallFrames = sx16(m.u16(pMonStats + 0x5c + bDiff * 2));
      AI_Stall113c(m, pGame, pUnit, nStallFrames);
      return;
    }
  }
  const dwOwnerTypeX = m.u32(pOwner);
  let nOwnerX = 0;
  if (dwOwnerTypeX === 2 || (dwOwnerTypeX > 3 && dwOwnerTypeX <= 5)) {
    nOwnerX = m.u32(m.u32(pOwner + 0x2c) + 0x0c) | 0;
  } else {
    const pOwnerPath = m.u32(pOwner + 0x2c);
    nOwnerX = pOwnerPath !== 0 ? PATH_GetPosX113c(m, pOwnerPath) : 0;
  }
  const nSpan = (nRadius * 2) | 0;
  const nRollX = nSpan > 0 ? SEED_RollLimitedFast113c(m, pUnit + 0x20, nSpan) : 0;
  const nDestX = (nOwnerX + nRollX - nRadius) | 0;
  const dwOwnerTypeY = m.u32(pOwner);
  let nOwnerY = 0;
  if (dwOwnerTypeY === 2 || (dwOwnerTypeY > 3 && dwOwnerTypeY <= 5)) {
    nOwnerY = m.u32(m.u32(pOwner + 0x2c) + 0x10) | 0;
  } else {
    const pOwnerPath = m.u32(pOwner + 0x2c);
    nOwnerY = pOwnerPath !== 0 ? PATH_GetPosY113c(m, pOwnerPath) : 0;
  }
  const nRollY = nSpan > 0 ? SEED_RollLimitedFast113c(m, pUnit + 0x20, nSpan) : 0;
  const nDestY = (nOwnerY + nRollY - nRadius) | 0;
  AI_CastSkillWithMode113c(m, 9, pUnit, pGame, 0x124, 0, nDestX, nDestY);
  const bDiffAfter = m.u8(pGame + 0x6d);
  const nCooldown = sx16(m.u16(pMonStats + 0x5c + bDiffAfter * 2));
  m.setU32(pAiCmd + 0x14, ((m.u32(pGame + 0xa8) | 0) + nCooldown) | 0);
}

/**
 * Runs tentacle/pop-up melee monster AI: emerges (mode 9) when target is within 5 tiles, attacks in quadrant-based mode (4, 5, or 8), or submerges (mode 8).
 * @va D2Game:0x6FCC5580
 */
export function AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC5580)
  const pTarget = m.u32(pAiArgs + 0x08);
  const pAiCmd = m.u32(pAiArgs + 0x00);
  const bHasTargetInRange = m.u32(pAiArgs + 0x18);
  const nDist = m.u32(pAiArgs + 0x14) | 0;
  if (pUnit !== 0) {
    m.setU32(pUnit + 0xc4, m.u32(pUnit + 0xc4) | 0x20000);
  }
  withW4B6Stack(0x38, (sp) => {
    const pUnitPos = sp + 0x00;
    const pTargetPos = sp + 0x08;
    const pModeStrc = sp + 0x10;
    PATH_GetTargetTypeAndPosition113c(m, pUnit, pUnitPos);
    if (pTarget !== 0 && nDist < 5) {
      if (m.u32(pAiCmd + 0x14) === 0) {
        m.setU32(pAiCmd + 0x14, 1);
        m.setU32(pAiCmd + 0x18, m.u32(pGame + 0xa8));
        SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
        for (let i = 0; i < 8; i += 1) {
          m.setU32(pModeStrc + i * 4, 0);
        }
        m.setU32(pModeStrc + 0x00, 9);
        m.setU32(pModeStrc + 0x04, pUnit);
        let bAnimSpeed = 0x64;
        if (pUnit !== 0) {
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32(pUnit + 0x04) | 0);
          if (pMonStats2 !== 0) {
            const bFlag = m.u8(pMonStats2 + 0x105);
            const pBitMasks = m.u32(0x6fd18be0);
            if ((bFlag & m.u32(pBitMasks + 0x04)) !== 0) {
              bAnimSpeed = 0x65;
            }
          }
        }
        m.setU8(pModeStrc + 0x15, bAnimSpeed);
        m.setU32(pModeStrc + 0x08, pTarget);
        MONSTER_StartMode113c(m, pGame, pUnit, 9, pTarget, 0, 0);
        return;
      }
      if (bHasTargetInRange !== 0 && (m.u32(pGame + 0xa8) | 0) > (m.u32(pAiCmd + 0x18) | 0)) {
        PATH_GetTargetTypeAndPosition113c(m, pTarget, pTargetPos);
        const uX = m.u32(pUnitPos + 0x00);
        const uY = m.u32(pUnitPos + 0x04);
        const tX = m.u32(pTargetPos + 0x00);
        const tY = m.u32(pTargetPos + 0x04);
        if (uX >= tX && uY <= tY) {
          AI_StartAttackMode113c(m, 4, pUnit, pGame, pTarget);
          m.setU32(pAiCmd + 0x18, (m.u32(pGame + 0xa8) + 0x23) | 0);
          return;
        }
        if (uX <= tX && uY >= tY) {
          AI_StartAttackMode113c(m, 5, pUnit, pGame, pTarget);
          m.setU32(pAiCmd + 0x18, (m.u32(pGame + 0xa8) + 0x23) | 0);
          return;
        }
        AI_StartAttackMode113c(m, 8, pUnit, pGame, pTarget);
        m.setU32(pAiCmd + 0x18, (m.u32(pGame + 0xa8) + 0x05) | 0);
        return;
      }
      AI_StartAttackMode113c(m, 8, pUnit, pGame, pTarget);
      return;
    }
    if (m.u32(pAiCmd + 0x14) !== 0) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
      for (let i = 0; i < 8; i += 1) {
        m.setU32(pModeStrc + i * 4, 0);
      }
      m.setU32(pModeStrc + 0x00, 8);
      m.setU32(pModeStrc + 0x04, pUnit);
      let bAnimSpeed = 0x64;
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32(pUnit + 0x04) | 0);
        if (pMonStats2 !== 0) {
          const bFlag = m.u8(pMonStats2 + 0x105);
          const pBitMasks = m.u32(0x6fd18be0);
          if ((bFlag & m.u32(pBitMasks)) !== 0) {
            bAnimSpeed = 0x65;
          }
        }
      }
      m.setU8(pModeStrc + 0x15, bAnimSpeed);
      m.setU32(pModeStrc + 0x08, pTarget);
      MONSTER_StartMode113c(m, pGame, pUnit, 8, pTarget, 0, 0);
      return;
    }
    AI_Stall113c(m, pGame, pUnit, 0x0f);
  });
}

/**
 * Runs timed turret skill caster AI: dies when lifetime (`pAiCmd+0x14`) expires, casts skill (`+0x170`) with 60% chance within range 25, or stalls 10 frames.
 * @va D2Game:0x6FCC57E0
 */
export function AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiArgs: number,
): void {
  hitD2GameVa113c(0x6FCC57E0)
  const pAiCmd = m.u32(pAiArgs + 0x00);
  const pMonStats = m.u32(pAiArgs + 0x1c);
  if ((m.u32(pAiCmd + 0x14) | 0) < (m.u32(pGame + 0xa8) | 0)) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
    withW4B6Stack(0x20, (sp) => {
      for (let i = 0; i < 8; i += 1) {
        m.setU32(sp + i * 4, 0);
      }
      m.setU32(sp + 0x04, pUnit);
      m.setU8(sp + 0x15, 0x64);
      MONSTER_StartMode113c(m, pGame, pUnit, 0, 0, 0, 0);
    });
    return;
  }
  const pTarget = m.u32(pAiArgs + 0x08);
  if (pTarget !== 0 && (m.u32(pAiArgs + 0x14) | 0) < 0x19) {
    const nRoll = SEED_RollLimitedFast113c(m, pUnit + 0x20, 100);
    if (nRoll < 0x3c) {
      const nSkillId = sx16(m.u16(pMonStats + 0x170));
      const bMode = m.u8(pMonStats + 0x180);
      AI_CastSkillWithMode113c(m, bMode, pUnit, pGame, nSkillId, pTarget, 0, 0);
      return;
    }
  }
  AI_Stall113c(m, pGame, pUnit, 0x0a);
}

/**
 * Runs idle/ambient fidget AI: with 20% chance starts mode 8, otherwise stalls 30 frames.
 * @va D2Game:0x6FCC58D0
 */
export function AI_TickAmbientMode8OrStall30_6FCC58D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _pAiArgs?: number,
): void {
  hitD2GameVa113c(0x6FCC58D0)
  const seed = { lo: m.u32(pUnit + 0x20), hi: m.u32(pUnit + 0x24) };
  const nRoll = seedRoll(seed, 100);
  m.setU32(pUnit + 0x20, seed.lo >>> 0);
  m.setU32(pUnit + 0x24, seed.hi >>> 0);
  if (nRoll < 0x14) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit, 0);
    withW4B6Stack(0x20, (sp) => {
      for (let i = 0; i < 8; i += 1) {
        m.setU32(sp + i * 4, 0);
      }
      m.setU32(sp + 0x00, 8);
      m.setU32(sp + 0x04, pUnit);
      let bAnimSpeed = 0x64;
      if (pUnit !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32(pUnit + 0x04) | 0);
        if (pMonStats2 !== 0) {
          const bFlag = m.u8(pMonStats2 + 0x105);
          const pBitMasks = m.u32(0x6fd18be0);
          if ((bFlag & m.u32(pBitMasks)) !== 0) {
            bAnimSpeed = 0x65;
          }
        }
      }
      m.setU8(sp + 0x15, bAnimSpeed);
      MONSTER_StartMode113c(m, pGame, pUnit, 8, 0, 0, 0);
    });
    return;
  }
  AI_Stall113c(m, pGame, pUnit, 0x1e);
}
