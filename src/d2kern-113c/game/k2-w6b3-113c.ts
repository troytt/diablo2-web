/**
 * Milestone 33 [K2] Wave 6 Batch 3 (`w6b3`): 45 `D2Game.dll` v1.13c functions
 * in the VA range `0x6FC366D0..0x6FD05B60`.
 *
 * Clean-room 1:1 binary-isomorphic translations operating purely on `D2KernMemory113c`.
 */

import { COLLISION_CheckSubtileMask113c } from '../common/collision'
import { UNITS_GetField7C_113c, UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { imul32, sdiv32 } from '../common/int-math'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items'
import {
  DUNGEON_CheckRoomIsTownMemPort113c,
  SKILLS_GetWeaponMasteryBonusMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_SetStepNum113c,
} from '../common/path'
import {
  QUESTRECORD_ClearQuestStateBits2To11_113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record'
import {
  SKILLS_EvalCalcByOffset113c,
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c,
  SKILLS_GetSkillById113c,
  STATES_UpdateOrClearState98Transform113c,
} from '../common/skills'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitLifePercent113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist'
import {
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetPlayerBaseToHit113c,
  UNITS_GetRoom113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNIT_GetAlignment113c,
} from '../common/unit'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory'
import { seedRoll } from '../prng'
import {
  AIGENERAL_BroadcastCmdToMinions113c,
  AIGENERAL_GetPackLeaderUnit113c,
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillMode14_113c,
  AI_CastSkillWithMode113c,
  AI_LookupDispatchTableRow113c,
  AI_StartAttackMode113c,
  MONSTER_HasAlwaysChaseFlag113c,
  MONSTER_InitModeChangeStrc113c,
  SKILLS_CanMonsterCastAtTarget113c,
  type AiFallenHooks113c,
} from './ai-fallen-113c'
import {
  AIGENERAL_FlushAllAiCommands113c,
  CLIENTS_ForEachInGameClient113c,
} from './boot-init-gap-a-113c'
import { D2GAME_PARTY_GetPartyIdForUnit113c } from './boot-init-gap-b-113c'
import {
  C2S_CheckCoordDeltaExceeded113c,
  C2S_ValidateTargetUnitDistance113c,
} from './c2s-packet-113c'
import {
  AI_Stall113c as AI_StallMem113c,
  MONSTER_StartMode113c as MONSTER_StartModeMem113c,
  SUNITDMG_GetPlayerClientClassId113c,
} from './combat-a1c-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import { MISSILES_GetTxtRecordFast113c } from './k2-gap-melee-dot-113c'
import { QUESTS_SendPlayerQuestLogPacket28_113c } from './k2-items-tc-w1-113c'
import { AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c } from './k2-laneI-0x6fc3-w1-113c'
import { QUESTS_CheckGlobalQuestState_6FC538D0_113c } from './k2-laneJ-0x6fc4-w1-113c'
import {
  CLIENTS_GetSaveHeaderPtr_6FC69240_113c,
  MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c,
} from './k2-laneL-0x6fc6-w1-113c'
import {
  ACT3Q0_ActiveFilter113c,
  ACT3Q0_StatusFilter113c,
  SUNIT_GetOwnerUnit113c,
} from './k2-sunit-spawn-w1-113c'
import {
  AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c,
  NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c,
} from './k2-w2b3-113c'
import { SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c } from './k2-w2b4-113c'
import {
  ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c,
  ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c,
  ACT2Q2_IsQuestPastState01_6FCE1B60_113c,
} from './k2-w2b6-113c'
import { ACT2Q4_IsPortalOpen_6FCE2040_113c } from './k2-w2b7-113c'
import {
  AI_ApproachTargetPathType13_6FD13000_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  AI_WalkTowardTarget_6FD12F30_113c,
} from './k2-w2b8-113c'
import { AI_SelectAndCastHirelingSkill_6FC3C4E0_113c, type K2W3B2Hooks113c } from './k2-w3b2-113c'
import {
  AI_ScanCallbackFetishMinions_6FC9BB90_113c,
  AI_ScanCallbackNearestBaseId136_6FC9BA40_113c,
} from './k2-w3b8-113c'
import {
  AI_SelectHostileTargetByMetrics_6FCA4720_113c,
  NET_SendPacket18_HpManaPot_6FCAB8C0_113c,
  NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c,
  NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c,
  NET_SendPacket96_WalkVerify_6FCAB750_113c,
} from './k2-w4b4-113c'
import {
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c,
  PETS_FindPetArgByGuid_6FCB6570_113c,
} from './k2-w4b5-113c'
import { AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c } from './k2-w4b7-113c'
import { NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c } from './k2-w5b2-113c'
import {
  MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c,
  SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c,
} from './k2-w5b3-113c'
import {
  ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c,
  ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c,
  ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c,
  ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c,
} from './k2-w5b4-113c'
import {
  ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c,
  ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c,
  ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c,
  NET_SendChatMessagePacket26Wrapper_6FCEB580_113c,
  PLAYER_CalcHealingPotionPercent_6FCEB840_113c,
  PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c,
  PLAYER_IssueMercAiMoveCommand_6FCEC750_113c,
} from './k2-w5b5-113c'
import {
  ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c,
  ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c,
} from './k2-w5b8-113c'
import {
  AI_CastSkillWithModeRandomScatter_6FD12420_113c,
  AI_CircleStrafeTarget_6FD126B0_113c,
  AI_RunFleeFromUnit_6FD12C10_113c,
  AI_RunWanderAroundUnit_6FD12750_113c,
  AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c,
  AI_WalkWanderAroundSelf_6FD129B0_113c,
  AI_WalkWanderAroundUnitOrSelf_6FD12870_113c,
  type K2W5B10Hooks113c,
} from './k2-w5b10-113c'
import { SUNIT_IsDeadOrDying113c, UNITS_ChangeAnimMode113c } from './monster-events'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_CheckModeBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_CheckFlagBit113c,
  MONSTER_Create113c,
  SEED_RollLimitedFast113c,
  SEED_RollMaskFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c'
import {
  AIGENERAL_CopyAiCommandParams113c,
  AIGENERAL_PopAiCommand113c,
  AI_ApproachTarget113c,
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  AI_WarrivGreet113c,
  MONSTER_StartMode113c,
  PLAYER_GetEquippedWeapon113c,
  type FallenSliceWorld113c,
} from './replay-kernel-113c'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_SetEventFull113c,
  type EventWheelHooks113c,
} from './timer-wheel'
import {
  AI_FindNearestPlayerTarget113c,
  AI_InitHomeNode10_113c,
  AI_StepRelativeToTargetUnit113c,
  AI_WarrivGreetMem113c,
  UNITS_GetOctileDistanceToCoordinates113c,
  type TownNpcAiCallees113c,
} from './town-npc-ai-113c'
import { AITARGET_ScanUnitsByModeTable113c } from './town-runtime-gap-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type { D2KernMemory113c }

/** Reentrant scratch stack pointer for `w6b3` stack structs and out-parameters. */
let k2W6B3StackPtr = 0x7eb40000

/** Optional host/world hooks for `w6b3` routines. */
export interface K2W6B3Hooks113c extends K2W5B10Hooks113c {
  readonly regpop?: RegpopSpawnHooks113c | undefined
  readonly w3b2?: K2W3B2Hooks113c | undefined
  readonly townNpc?: TownNpcAiCallees113c | undefined
}

const DIAG_5_OFFSETS_6FD1D038: readonly [number, number][] = [
  [-5, -5],
  [5, -5],
  [5, 5],
  [-5, 5],
]

function sx8(v: number): number {
  return (v << 24) >> 24
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function readDiag5Offset113c(m: D2KernMemory113c, idx: number): readonly [number, number] {
  const i = idx & 3
  const baseVa = 0x6fd1d038
  const dxMem = m.u32((baseVa + i * 8) >>> 0) | 0
  const dyMem = m.u32((baseVa + i * 8 + 4) >>> 0) | 0
  if (dxMem !== 0 || dyMem !== 0) {
    return [dxMem, dyMem]
  }
  return DIAG_5_OFFSETS_6FD1D038[i]!
}

function getDataTablesPtr113c(m: D2KernMemory113c): number {
  const iat = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  return iat !== 0 ? m.u32(iat) >>> 0 : 0
}

function readGdwBitMasks113c(m: D2KernMemory113c, nBitIndex: number): number {
  const pTable = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  if (pTable === 0) {
    return (1 << (nBitIndex & 31)) >>> 0
  }
  return m.u32((pTable + ((nBitIndex & 31) << 2)) >>> 0) >>> 0
}

function stepSeed64At113c(m: D2KernMemory113c, pSeed: number): number {
  const addr = pSeed >>> 0
  const lo = m.u32(addr) >>> 0
  const hi = m.u32((addr + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32((addr + 4) >>> 0, newHi)
  m.setU32(addr, newLo)
  return newLo
}

function rollSeedAt6FC21180(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const addr = pSeed >>> 0
  const max = nMax | 0
  if (addr === 0 || max <= 0) {
    hitD2GameVa113c(0x6FC21180)
    return 0
  }
  if (((max - 1) & max) === 0) {
    hitD2GameVa113c(0x6FC21180)
    const raw = stepSeed64At113c(m, addr)
    return (raw & (max - 1)) >>> 0
  }
  const seed = { lo: m.u32(addr) >>> 0, hi: m.u32((addr + 4) >>> 0) >>> 0 }
  const res = seedRoll(seed, max) >>> 0
  m.setU32(addr, seed.lo >>> 0)
  m.setU32((addr + 4) >>> 0, seed.hi >>> 0)
  return res
}

function getUnitXInline113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const dwType = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    return pPath !== 0 ? m.u32((pPath + 0x0c) >>> 0) | 0 : 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0
}

function getUnitYInline113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const dwType = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    return pPath !== 0 ? m.u32((pPath + 0x10) >>> 0) | 0 : 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0
}

function getMonsterAiGeneralPtr113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u !== 0 && (m.u32(u) | 0) === 1) {
    const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      return m.u32((pMonData + 0x28) >>> 0) >>> 0
    }
  }
  return 0
}

function getMonsterAiControlPtr113c(m: D2KernMemory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u !== 0 && (m.u32(u) | 0) === 1) {
    const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      return m.u32((pMonData + 0x2c) >>> 0) >>> 0
    }
  }
  return 0
}

function findAiCmdNodeInCircularList113c(
  m: D2KernMemory113c,
  pUnit: number,
  nCmdType: number,
): number {
  const pAiGen = getMonsterAiGeneralPtr113c(m, pUnit)
  if (pAiGen === 0) return 0
  const pHead = m.u32((pAiGen + 0x20) >>> 0) >>> 0
  if (pHead === 0) return 0
  let pCur = m.u32(pHead) >>> 0
  const target = nCmdType | 0
  if ((m.u32((pCur + 0x08) >>> 0) | 0) !== target) {
    while (pCur !== pHead) {
      pCur = m.u32(pCur) >>> 0
      if ((m.u32((pCur + 0x08) >>> 0) | 0) === target) break
    }
  }
  return (m.u32((pCur + 0x08) >>> 0) | 0) === target ? pCur : 0
}

function freeUnitType2TimerEvents113c(m: D2KernMemory113c, pGame: number, pUnit: number): void {
  let pEvent = m.u32(((pUnit >>> 0) + 0xdc) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
    if (m.u8(pEvent) === 2) {
      EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
    }
    pEvent = pNext
  }
}

function transitionMonsterSpecialAiState6FCBD230(
  m: D2KernMemory113c,
  pGame: number,
  pMonster: number,
  pAiGeneral: number,
  nSpecAi: number,
): void {
  if (STATES_CheckState113c(m, pMonster >>> 0, 0x36) !== 0) {
    throw new D2CommonAssertError('MonsterAI.cpp', 0x1a6)
  }
  if ((pGame >>> 0) === 0 || (pMonster >>> 0) === 0 || (pAiGeneral >>> 0) === 0) return
  if ((m.u32(pMonster >>> 0) | 0) !== 1) return

  const pDataTables = getDataTablesPtr113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0
  const monClassId = m.u32(((pMonster >>> 0) + 0x04) >>> 0) | 0
  let effSpecAi = nSpecAi | 0
  if (nMonStatsCount > 0 && monClassId >= nMonStatsCount) {
    effSpecAi = 1
  }

  const curThinkFn = m.u32(((pAiGeneral >>> 0) + 0x04) >>> 0) >>> 0
  if (curThinkFn !== 0) {
    const pCurRow = AI_LookupDispatchTableRow113c(m, pMonster >>> 0, m.u32(pAiGeneral >>> 0) | 0) >>> 0
    if (pCurRow !== 0 && curThinkFn === (m.u32((pCurRow + 0x08) >>> 0) >>> 0)) {
      const altThinkFn = m.u32((pCurRow + 0x0c) >>> 0) >>> 0
      if (altThinkFn !== 0) {
        m.setU32(pAiGeneral >>> 0, effSpecAi >>> 0)
        m.setU32(((pAiGeneral >>> 0) + 0x04) >>> 0, altThinkFn)
        return
      }
    }
  }

  m.setU32(((pAiGeneral >>> 0) + 0x14) >>> 0, 0)
  m.setU32(((pAiGeneral >>> 0) + 0x18) >>> 0, 0)
  m.setU32(((pAiGeneral >>> 0) + 0x1c) >>> 0, 0)
  AIGENERAL_FlushAllAiCommands113c(m, pGame >>> 0, pMonster >>> 0)
  m.setU32(pAiGeneral >>> 0, effSpecAi >>> 0)
  AI_InitMonsterAiThinkFn113c(m, pMonster >>> 0)
}

function dispatchMonsterStartMode6FC95E10(
  m: D2KernMemory113c,
  pGame: number,
  pModeArgs: number,
  bUpdateAnim: number,
  hooks?: K2W6B3Hooks113c | undefined,
): number {
  if (hooks !== undefined && hooks.onMonsterStartMode !== undefined) {
    return hooks.onMonsterStartMode(m, pGame >>> 0, pModeArgs >>> 0, bUpdateAnim | 0) | 0
  }
  const mode = m.u32(pModeArgs >>> 0) | 0
  const pUnit = m.u32((pModeArgs + 0x04) >>> 0) >>> 0
  const pTarget = m.u32((pModeArgs + 0x08) >>> 0) >>> 0
  const targetX = m.u32((pModeArgs + 0x0c) >>> 0) | 0
  const targetY = m.u32((pModeArgs + 0x10) >>> 0) | 0
  if (hooks !== undefined && hooks.world !== undefined) {
    return MONSTER_StartMode113c(hooks.world, pUnit, mode, pTarget, targetX, targetY) ? 1 : 0
  }
  return MONSTER_StartModeMem113c(m, pGame >>> 0, pUnit, mode, pTarget, targetX, targetY) | 0
}

function aiStall6FD122C0(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nDelay: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  if (hooks !== undefined && hooks.world !== undefined) {
    AI_Stall113c(hooks.world, pUnit >>> 0, nDelay | 0)
    return
  }
  AI_StallMem113c(m, pGame >>> 0, pUnit >>> 0, nDelay | 0)
}

function aiIdleWander6FD11B10(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  range: number,
  hooks?: K2W6B3Hooks113c | undefined,
): number {
  if (hooks !== undefined && hooks.world !== undefined) {
    return AI_IdleWander113c(hooks.world, pUnit >>> 0, range | 0) ? 1 : 0
  }
  hitD2GameVa113c(0x6FD11B10)
  const ok = AI_WalkWanderAroundSelf_6FD129B0_113c(m, range | 0, pGame >>> 0, pUnit >>> 0, hooks) | 0
  if (ok === 0) {
    aiStall6FD122C0(m, pGame >>> 0, pUnit >>> 0, 10, hooks)
  }
  return ok
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
  hooks?: K2W6B3Hooks113c | undefined,
): number {
  if (hooks !== undefined && hooks.world !== undefined) {
    return AI_ApproachTarget113c(
      hooks.world,
      pUnit >>> 0,
      pTarget >>> 0,
      nMode | 0,
      nX | 0,
      nY | 0,
      nStepNum | 0,
      dwFlags | 0,
    )
      ? 1
      : 0
  }

  hitD2GameVa113c(0x6FD12540)
  let mode = nMode | 0
  if (mode === 0x0f && (STATES_CheckState113c(m, pUnit >>> 0, 0x3c) | 0) !== 0) {
    const pAiControl = getMonsterAiControlPtr113c(m, pUnit)
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    m.setU32((pAiControl + 0x1c) >>> 0, 0)
    m.setU8((pAiControl + 0x20) >>> 0, 0)
    mode = 2
  }

  PATH_SetStepNum113c(m, m.u32(((pUnit >>> 0) + 0x2c) >>> 0), nStepNum | 0)

  const sp = (k2W6B3StackPtr - 0x20) >>> 0
  k2W6B3StackPtr = sp
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, mode)
    if ((pTarget >>> 0) !== 0) {
      m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    } else {
      m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
      m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    }
    const res = dispatchMonsterStartMode6FC95E10(m, pGame >>> 0, sp, 1, hooks) | 0
    if (res !== 0) return res

    const flagsByte = dwFlags & 0xff
    if ((flagsByte & 4) !== 0) {
      freeUnitType2TimerEvents113c(m, pGame >>> 0, pUnit >>> 0)
    }
    if ((flagsByte & 1) !== 0) {
      const pAiGeneral = getMonsterAiGeneralPtr113c(m, pUnit)
      if (pAiGeneral !== 0) {
        m.setU8((pAiGeneral + 8) >>> 0, (m.u8((pAiGeneral + 8) >>> 0) | 0x40) & 0xff)
      }
    }
    if ((flagsByte & 2) !== 0) {
      const roll = (stepSeed64At113c(m, ((pUnit >>> 0) + 0x20) >>> 0) >>> 0) % 100
      if (roll < 0x46) {
        aiIdleWander6FD11B10(m, pGame >>> 0, pUnit >>> 0, 4, hooks)
        return 1
      }
      aiStall6FD122C0(m, pGame >>> 0, pUnit >>> 0, 10, hooks)
      return 1
    }
    return res
  } finally {
    k2W6B3StackPtr = (sp + 0x20) >>> 0
  }
}

function aiFleeFrom6FD12D80(
  m: D2KernMemory113c,
  pFromUnit: number,
  pGame: number,
  pUnit: number,
  nDistSteps: number,
  bClearAiThinkOnFail: number,
  hooks?: K2W6B3Hooks113c | undefined,
): number {
  if (hooks !== undefined && hooks.world !== undefined) {
    return AI_FleeFrom113c(
      hooks.world,
      pFromUnit >>> 0,
      pUnit >>> 0,
      nDistSteps | 0,
      (bClearAiThinkOnFail | 0) !== 0,
    )
      ? 1
      : 0
  }
  hitD2GameVa113c(0x6FD12D80)
  if ((pFromUnit >>> 0) === 0) return 0
  const unitX = getUnitXInline113c(m, pUnit)
  const unitY = getUnitYInline113c(m, pUnit)
  const fromX = getUnitXInline113c(m, pFromUnit)
  const fromY = getUnitYInline113c(m, pFromUnit)
  let sx = 0
  if ((fromX >>> 0) > (unitX >>> 0)) sx = -1
  if ((fromX >>> 0) < (unitX >>> 0)) sx = 1
  let sy = 0
  if ((fromY >>> 0) > (unitY >>> 0)) sy = -1
  if ((fromY >>> 0) < (unitY >>> 0)) sy = 1

  const uDist = nDistSteps & 0xff
  if (uDist > 5) {
    const pAiControl = getMonsterAiControlPtr113c(m, pUnit)
    const clampedDist = uDist >= 0x4e ? 0x4d : uDist
    m.setU8((pAiControl + 0x20) >>> 0, clampedDist)
  }
  const flags = (bClearAiThinkOnFail | 0) !== 0 ? 4 : 0
  return aiApproachTarget6FD12540(
    m,
    pGame >>> 0,
    pUnit >>> 0,
    0,
    2,
    (unitX + imul32(uDist, sx)) | 0,
    (unitY + imul32(uDist, sy)) | 0,
    1,
    flags,
    hooks,
  )
}

function castSkillWithMode6FD12380(
  m: D2KernMemory113c,
  nMode: number,
  pUnit: number,
  pGame: number,
  nSkillId: number,
  pTarget: number,
  x: number,
  y: number,
  hooks?: K2W6B3Hooks113c | undefined,
): number {
  const modeByte = nMode & 0xff
  if (hooks !== undefined && hooks.world !== undefined) {
    return AI_CastSkillWithMode113c(
      m,
      modeByte,
      pUnit >>> 0,
      pGame >>> 0,
      nSkillId | 0,
      pTarget >>> 0,
      x | 0,
      y | 0,
      hooks.world,
      hooks,
    )
  }
  const mergedHooks: AiFallenHooks113c = {
    ...hooks,
    onMonsterStartMode: (mem, g, sp, bUpdate) =>
      dispatchMonsterStartMode6FC95E10(mem, g, sp, bUpdate, hooks),
  }
  const res =
    AI_CastSkillWithMode113c(
      m,
      modeByte,
      pUnit >>> 0,
      pGame >>> 0,
      nSkillId | 0,
      pTarget >>> 0,
      x | 0,
      y | 0,
      undefined,
      mergedHooks,
    ) | 0
  if (res === 0 && modeByte < 0x10) {
    aiStall6FD122C0(m, pGame >>> 0, pUnit >>> 0, 10, hooks)
  }
  return res
}

function scanUnitsByModeWithCb113c(
  m: D2KernMemory113c,
  nScanIndex: number,
  pCtx: number,
  pGame: number,
  pOriginUnit: number,
  pfnOverrideVa: number,
): number {
  const baseRes =
    AITARGET_ScanUnitsByModeTable113c(
      m,
      nScanIndex | 0,
      pCtx >>> 0,
      pGame >>> 0,
      pOriginUnit >>> 0,
      pfnOverrideVa >>> 0,
    ) | 0
  if (baseRes !== 0 || (pfnOverrideVa >>> 0) === 0) return baseRes

  const pRoom = UNITS_GetRoom113c(m, pOriginUnit >>> 0) >>> 0
  if (pRoom === 0) return 0
  const sp = (k2W6B3StackPtr - 0x08) >>> 0
  k2W6B3StackPtr = sp
  let ppRooms = 0
  let numRooms = 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 4) >>> 0, 0)
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, sp, (sp + 4) >>> 0)
    ppRooms = m.u32(sp) >>> 0
    numRooms = m.u32((sp + 4) >>> 0) >>> 0
  } finally {
    k2W6B3StackPtr = (sp + 0x08) >>> 0
  }

  const runOnRoom = (roomPtr: number): number => {
    let pCand = m.u32((roomPtr + 0x74) >>> 0) >>> 0
    while (pCand !== 0) {
      let cbRes = 0
      switch (pfnOverrideVa >>> 0) {
        case 0x6fc35660:
          cbRes = AI_FindLowestLifeInjuredAllyCallback_6FC35660_113c(
            m,
            pGame >>> 0,
            pOriginUnit >>> 0,
            pCand,
            pCtx >>> 0,
          )
          break
        case 0x6fc9b9f0:
          cbRes = AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c(
            m,
            pGame >>> 0,
            pOriginUnit >>> 0,
            pCand,
            pCtx >>> 0,
          )
          break
        case 0x6fc9bb90:
          cbRes = AI_ScanCallbackFetishMinions_6FC9BB90_113c(m, pOriginUnit >>> 0, pCand, pCtx >>> 0)
          break
        case 0x6fc9ba40:
          cbRes = AI_ScanCallbackNearestBaseId136_6FC9BA40_113c(m, pOriginUnit >>> 0, pCand, pCtx >>> 0)
          break
        case 0x6fcbca00:
          cbRes = SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c(
            m,
            pOriginUnit >>> 0,
            pCand,
            pCtx >>> 0,
          )
          break
        default:
          break
      }
      if (cbRes !== 0) return cbRes | 0
      pCand = m.u32((pCand + 0xe8) >>> 0) >>> 0
    }
    return 0
  }

  if (numRooms > 0 && ppRooms !== 0) {
    for (let i = 0; i < numRooms; i = (i + 1) >>> 0) {
      const pAdjRoom = m.u32((ppRooms + i * 4) >>> 0) >>> 0
      if (pAdjRoom !== 0) {
        const r = runOnRoom(pAdjRoom)
        if (r !== 0) return r
      }
    }
  } else {
    return runOnRoom(pRoom)
  }
  return 0
}

/**
 * [1/45] Special AI thinker for impregnated Putrid Defiler (`STATE_IMPREGNATED = 0x8F`):
 * validates linked host monster (`+0x94`/`+0x98`, bit 10 of `+0xC8`), fires host/defiler skills
 * from `MonStatsTxt[0x1EC]` / `[0x1ED]`, or reverts special AI (`0x6FCBD230`).
 *
 * @va D2Game:0x6FC366D0
 */
export function AI_ThinkImpregnatedMonster_6FC366D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC366D0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pAiParam = m.u32(arg) >>> 0

  let pHostUnit = 0
  if (u !== 0 && ((m.u32((u + 0xc8) >>> 0) >>> 10) & 1) !== 0) {
    pHostUnit = SUNIT_GetServerUnit113c(
      m,
      game,
      m.u32((u + 0x94) >>> 0) | 0,
      m.u32((u + 0x98) >>> 0) >>> 0,
    ) >>> 0
  }

  if (STATES_CheckState113c(m, u, 0x8f) === 0 || pHostUnit === 0) {
    const pAiGen = getMonsterAiGeneralPtr113c(m, u)
    transitionMonsterSpecialAiState6FCBD230(m, game, u, pAiGen, 0)
    aiStall6FD122C0(m, game, u, 1, hooks)
    return
  }

  const pDataTables = getDataTablesPtr113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0
  const pMonStatsBase = pDataTables !== 0 ? m.u32((pDataTables + 0xa78) >>> 0) >>> 0 : 0
  const pStats492 = nMonStatsCount > 0x1ec ? (pMonStatsBase + 0x32ee0) >>> 0 : 0
  const pStats493 = nMonStatsCount > 0x1ed ? (pMonStatsBase + 0x33088) >>> 0 : 0

  const castReleaseAndClearHost = (): void => {
    const nMode = sx8(m.u8((pStats492 + 0x180) >>> 0))
    const nDiff = m.u8((game + 0x6d) >>> 0)
    const wSkill = sx16(m.u16((pStats492 + 0x170) >>> 0))
    const nRadius = sx16(m.u16((pStats492 + nDiff * 2 + 0x5c) >>> 0))
    AI_CastSkillWithModeRandomScatter_6FD12420_113c(m, u, nRadius, wSkill, nMode, hooks)
    const pAiGen = getMonsterAiGeneralPtr113c(m, u)
    m.setU32((pAiGen + 0x14) >>> 0, 0xffffffff)
  }

  if (
    nDist > 0x18 ||
    SUNIT_IsDeadOrDying113c(m, pHostUnit) !== 0 ||
    UNIT_GetAlignment113c(m, pHostUnit) !== 0
  ) {
    castReleaseAndClearHost()
    return
  }

  if (m.u32((pAiParam + 0x18) >>> 0) === 0) {
    castReleaseAndClearHost()
    return
  }

  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pSeed = (u + 0x20) >>> 0
  if (nDist < sx16(m.u16((pStats493 + nDiff * 2 + 0x5c) >>> 0))) {
    const roll = rollSeedAt6FC21180(m, pSeed, 100) | 0
    const nDiff2 = m.u8((game + 0x6d) >>> 0)
    if (roll < sx16(m.u16((pStats493 + nDiff2 * 2 + 0x62) >>> 0))) {
      const pAiParamCur = m.u32(arg) >>> 0
      const skillSlot = m.u32((pAiParamCur + 0x18) >>> 0) | 0
      const bScatter = m.u32((pAiParamCur + 0x1c) >>> 0) | 0
      UNIT_GetPosX113c(m, pTarget)
      UNIT_GetPosY113c(m, pTarget)
      if (bScatter !== 0) {
        const d1 = m.u8((game + 0x6d) >>> 0)
        rollSeedAt6FC21180(m, pSeed, sx16(m.u16((pStats493 + d1 * 2 + 0x68) >>> 0)) << 1)
        const d2 = m.u8((game + 0x6d) >>> 0)
        rollSeedAt6FC21180(m, pSeed, sx16(m.u16((pStats493 + d2 * 2 + 0x68) >>> 0)) << 1)
      }
      const wSkill = sx16(m.u16((pStats492 + skillSlot * 2 + 0x170) >>> 0))
      if (wSkill < 0) {
        aiStall6FD122C0(m, game, u, 0x14, hooks)
        return
      }
      const nMode = m.u8((pStats492 + skillSlot + 0x180) >>> 0)
      castSkillWithMode6FD12380(m, nMode, u, game, wSkill, pTarget, 0, 0, hooks)
      return
    }
  }

  if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x32) {
    AI_StartAttackMode113c(m, 8, u, game, pTarget, hooks?.world, hooks)
    return
  }
  aiStall6FD122C0(m, game, u, 0x14, hooks)
}

/**
 * [2/45] Monster AI thinker (`0x6FC39080`): alternates ranged caster/healer state (`dwAiState == 0`,
 * ally heal scan `0x6FC35660`, diagonal-offset `wSkill0`, `wMissS1` check, circle strafe) and aggressive
 * state (`dwAiState == 1`, `MONMODE_SKILL1` / `MONMODE_ATTACK1` / flee / wander).
 *
 * @va D2Game:0x6FC39080
 */
export function AI_ThinkZakarumHealerOrPriest_6FC39080_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC39080)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const startDirectMode = (mode: number, useByte105Bit0: boolean): void => {
    SKILLS_SetUsedSkillMemPort113c(m, u, 0)
    const sp = (k2W6B3StackPtr - 0x20) >>> 0
    k2W6B3StackPtr = sp
    try {
      m.fill(sp, 0x20, 0)
      m.setU32(sp, mode >>> 0)
      m.setU32((sp + 0x04) >>> 0, u)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      let speedByte = 0x64
      if (u !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const b = m.u8((pMonStats2 + (useByte105Bit0 ? 0x105 : 0x104)) >>> 0)
          const mask = readGdwBitMasks113c(m, useByte105Bit0 ? 0 : 4)
          if ((b & mask) !== 0) speedByte = 0x65
        }
      }
      m.setU8((sp + 0x15) >>> 0, speedByte)
      dispatchMonsterStartMode6FC95E10(m, game, sp, 1, hooks)
    } finally {
      k2W6B3StackPtr = (sp + 0x20) >>> 0
    }
  }

  if (m.u32((pAiParam + 0x14) >>> 0) === 0) {
    if (bInMeleeRange !== 0) {
      const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if ((roll | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))) {
        m.setU32((pAiParam + 0x14) >>> 0, 1)
        startDirectMode(4, false)
        return
      }
      aiFleeFrom6FD12D80(m, pTarget, game, u, 6, 1, hooks)
      return
    }

    if (
      sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)) >= 0 &&
      (m.u32((game + 0xa8) >>> 0) | 0) > (m.u32((pAiParam + 0x18) >>> 0) | 0)
    ) {
      const roll = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (roll < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x5c) >>> 0))) {
        const sp = (k2W6B3StackPtr - 0x10) >>> 0
        k2W6B3StackPtr = sp
        let pHealTarget = 0
        try {
          m.setU32(sp, 0)
          m.setU32((sp + 0x04) >>> 0, 0x4b)
          m.setU32((sp + 0x08) >>> 0, 0x9c4)
          scanUnitsByModeWithCb113c(m, 1, sp, game, u, 0x6fc35660)
          pHealTarget = m.u32(sp) >>> 0
        } finally {
          k2W6B3StackPtr = (sp + 0x10) >>> 0
        }
        if (pHealTarget !== 0) {
          const d2 = m.u8((game + 0x6d) >>> 0)
          const cd = sx16(m.u16((pMonStatsTxt + d2 * 2 + 0x62) >>> 0))
          m.setU32((pAiParam + 0x18) >>> 0, ((m.u32((game + 0xa8) >>> 0) | 0) + cd) >>> 0)
          const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
          const nMode1 = m.u8((pMonStatsTxt + 0x181) >>> 0)
          castSkillWithMode6FD12380(m, nMode1, u, game, wSkill1, pHealTarget, 0, 0, hooks)
          return
        }
      }
    }

    if (
      sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)) >= 0 &&
      (m.u32((game + 0xa8) >>> 0) | 0) > (m.u32((pAiParam + 0x18) >>> 0) | 0)
    ) {
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (nDist < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x80) >>> 0))) {
        const roll = rollSeedAt6FC21180(m, pSeed, 100) | 0
        const d2 = m.u8((game + 0x6d) >>> 0)
        if (roll < sx16(m.u16((pMonStatsTxt + d2 * 2 + 0x68) >>> 0))) {
          const dirIdx = SEED_RollMaskFast113c(m, pSeed, 4)
          const [ox, oy] = readDiag5Offset113c(m, dirIdx)
          const tx = (UNIT_GetPosX113c(m, pTarget) + ox) | 0
          const ty = (UNIT_GetPosY113c(m, pTarget) + oy) | 0
          const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
          const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
          castSkillWithMode6FD12380(m, nMode0, u, game, wSkill0, pTarget, tx, ty, hooks)
          m.setU32((pAiParam + 0x18) >>> 0, ((m.u32((game + 0xa8) >>> 0) | 0) + 0x64) >>> 0)
          return
        }
      }
    }

    const nDiffMiss = m.u8((game + 0x6d) >>> 0)
    if (sx16(m.u16((pMonStatsTxt + nDiffMiss * 2 + 0x6e) >>> 0)) > 0) {
      const wMissS1 = sx16(m.u16((pMonStatsTxt + 0x3e) >>> 0))
      if (wMissS1 > 0) {
        const pMissTxt = MISSILES_GetTxtRecordFast113c(m, wMissS1) >>> 0
        if (pMissTxt !== 0 && nDist < (sx16(m.u16((pMissTxt + 0x96) >>> 0)) - 2)) {
          const roll = rollSeedAt6FC21180(m, pSeed, 100) | 0
          const d2 = m.u8((game + 0x6d) >>> 0)
          if (roll < sx16(m.u16((pMonStatsTxt + d2 * 2 + 0x6e) >>> 0))) {
            AI_StartAttackMode113c(m, 8, u, game, pTarget, hooks?.world, hooks)
            return
          }
        }
      }
    }

    const rollMove = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    if ((rollMove | 0) < 0x50) {
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (nDist > sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x80) >>> 0))) {
        aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 6, 0, hooks)
        return
      }
      AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 3, hooks)
      return
    }
  }

  m.setU32((pAiParam + 0x14) >>> 0, 1)
  if (bInMeleeRange !== 0) {
    const roll1 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff1 = m.u8((game + 0x6d) >>> 0)
    if ((roll1 | 0) < sx16(m.u16((pMonStatsTxt + nDiff1 * 2 + 0x7a) >>> 0))) {
      startDirectMode(8, true)
      return
    }
    const roll2 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff2 = m.u8((game + 0x6d) >>> 0)
    if ((roll2 | 0) < sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x74) >>> 0))) {
      aiFleeFrom6FD12D80(m, pTarget, game, u, 6, 1, hooks)
      m.setU32((pAiParam + 0x14) >>> 0, 0)
      return
    }
    if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x5a) {
      AI_StartAttackMode113c(m, 4, u, game, pTarget, hooks?.world, hooks)
      return
    }
    aiStall6FD122C0(m, game, u, 10, hooks)
    return
  }

  if (nDist < 6) {
    const roll1 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff1 = m.u8((game + 0x6d) >>> 0)
    if ((roll1 | 0) < sx16(m.u16((pMonStatsTxt + nDiff1 * 2 + 0x7a) >>> 0))) {
      AI_StartAttackMode113c(m, 8, u, game, pTarget, hooks?.world, hooks)
      return
    }
  }

  const roll2 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
  const nDiff2 = m.u8((game + 0x6d) >>> 0)
  if ((roll2 | 0) < sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x74) >>> 0))) {
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    aiStall6FD122C0(m, game, u, 10, hooks)
    return
  }

  const roll3 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
  if ((roll3 | 0) < 0x46) {
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
    return
  }
  aiIdleWander6FD11B10(m, game, u, 12, hooks)
}

/**
 * [3/45] Town/outskirt guard AI (`0x6FC39740`): stalls if not in neutral mode, checks non-town room
 * for hostile target within `20` subtiles (`0x6FCD1BC0`), fires `wSkill0` on class `0x10F` (`roguehire`)
 * or `MONMODE_ATTACK1`, circle-strafes (`dist = 4`), or idle-wanders (`range = 5`).
 *
 * @va D2Game:0x6FC39740
 */
export function AI_ThinkTownRogueGuard_6FC39740_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC39740)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const pMonStatsTxt = m.u32(((pAiThinkArg >>> 0) + 0x1c) >>> 0) >>> 0
  if (u === 0 || (m.u32((u + 0x10) >>> 0) | 0) !== 1) {
    aiStall6FD122C0(m, game, u, 5, hooks)
    return
  }

  const pSeed = (u + 0x20) >>> 0
  const pRoom = UNITS_GetRoom113c(m, u) >>> 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) === 0) {
    const sp = (k2W6B3StackPtr - 0x08) >>> 0
    k2W6B3StackPtr = sp
    let pFound = 0
    let foundDist = 0
    try {
      m.setU32(sp, 0)
      m.setU32((sp + 4) >>> 0, 0)
      pFound = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(
        m,
        u,
        game,
        sp,
        (sp + 4) >>> 0,
      ) >>> 0
      foundDist = m.u32((sp + 4) >>> 0) | 0
    } finally {
      k2W6B3StackPtr = (sp + 0x08) >>> 0
    }
    if (pFound !== 0 && foundDist < 0x14) {
      if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x1e) {
        if ((m.u32((u + 0x04) >>> 0) | 0) === 0x10f) {
          const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
          const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
          castSkillWithMode6FD12380(m, nMode0, u, game, wSkill0, pFound, 0, 0, hooks)
          return
        }
        AI_StartAttackMode113c(m, 4, u, game, pFound, hooks?.world, hooks)
        return
      }
      if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x1e) {
        AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pFound, 4, hooks)
        return
      }
      aiStall6FD122C0(m, game, u, 10, hooks)
      return
    }
  }

  if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x14) {
    aiIdleWander6FD11B10(m, game, u, 5, hooks)
    return
  }
  aiStall6FD122C0(m, game, u, 10, hooks)
}

/**
 * [4/45] Home-leashed caster/skirmisher AI (`0x6FC39E70`): anchors command `10` home coords, returns
 * when leashed (`dist > 50`), sprints around target (`0x6FD12750`), casts perimeter-scattered `wSkill0`,
 * engages blocking obstacles (`wSkill1` / `A1`), circle-approaches, or flees (`0x6FD12C10`).
 *
 * @va D2Game:0x6FC39E70
 */
export function AI_ThinkHomeLeashedCaster_6FC39E70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC39E70)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  let nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0

  let pCmd10 = findAiCmdNodeInCircularList113c(m, u, 0x0a)
  if (pCmd10 === 0) {
    const homeX = getUnitXInline113c(m, u)
    const homeY = getUnitYInline113c(m, u)
    AIGENERAL_CopyAiCommandParams113c(m, u, 0x0a, homeX, homeY, 0, 0)
    pCmd10 = findAiCmdNodeInCircularList113c(m, u, 0x0a)
  }

  const pAiParam = m.u32(arg) >>> 0
  let distTargetToHome = 0
  if (pCmd10 !== 0) {
    const cmdX = m.u32((pCmd10 + 0x0c) >>> 0) | 0
    const cmdY = m.u32((pCmd10 + 0x10) >>> 0) | 0
    distTargetToHome = AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, pTarget, cmdX, cmdY) | 0
    if (nDist > 0x2d) {
      aiStall6FD122C0(m, game, u, 5, hooks)
      return
    }
    if (
      distTargetToHome >= 0x32 ||
      (AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, u, cmdX, cmdY) >>> 0) > 0x32
    ) {
      m.setU32((pAiParam + 0x1c) >>> 0, 1)
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x18) >>> 0, 7)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0x64)
      if (aiApproachTarget6FD12540(m, game, u, 0, 0x0f, cmdX, cmdY, 1, 0, hooks) !== 0) return
      freeUnitType2TimerEvents113c(m, game, u)
    }
    if (m.u32((pAiParam + 0x1c) >>> 0) !== 0) {
      const cmdX2 = m.u32((pCmd10 + 0x0c) >>> 0) | 0
      const cmdY2 = m.u32((pCmd10 + 0x10) >>> 0) | 0
      if ((AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(m, u, cmdX2, cmdY2) >>> 0) > 5) {
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        m.setU32((pAiCtrl + 0x18) >>> 0, 7)
        m.setU32((pAiCtrl + 0x1c) >>> 0, 0x64)
        if (aiApproachTarget6FD12540(m, game, u, 0, 0x0f, cmdX2, cmdY2, 1, 0, hooks) !== 0) return
        freeUnitType2TimerEvents113c(m, game, u)
      }
    }
    m.setU32((pAiParam + 0x1c) >>> 0, 0)
  }

  if (nDist > 0x14 && distTargetToHome < 0x32) {
    nDist = nDist >> 1
    if (nDist < 0x0c) nDist = 0x0c
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 7)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x64)
    if (AI_RunWanderAroundUnit_6FD12750_113c(m, pTarget, nDist & 0xff, game, u, hooks) !== 0) return
    freeUnitType2TimerEvents113c(m, game, u)
  }

  m.setU32((pAiParam + 0x14) >>> 0, ((m.u32((pAiParam + 0x14) >>> 0) | 0) + 3) >>> 0)
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const maxCasts = (nDiff * 2 + 8) | 0
  const pSeed = (u + 0x20) >>> 0

  if (
    sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)) >= 0 &&
    bInMeleeRange === 0 &&
    (m.u32((pAiParam + 0x18) >>> 0) | 0) < maxCasts &&
    (rollSeedAt6FC21180(m, pSeed, 100) | 0) < (m.u32((pAiParam + 0x14) >>> 0) | 0)
  ) {
    const rad = ((rollSeedAt6FC21180(m, pSeed, 0x0f) | 0) + 5) | 0
    let dx: number
    let dy: number
    if (SEED_RollMaskFast113c(m, pSeed, 2) !== 0) {
      dx = rad
      dy = SEED_RollLimitedFast113c(m, pSeed, rad) | 0
    } else {
      dx = SEED_RollLimitedFast113c(m, pSeed, rad) | 0
      dy = rad
    }
    if (SEED_RollMaskFast113c(m, pSeed, 2) !== 0) dx = (-dx) | 0
    if (SEED_RollMaskFast113c(m, pSeed, 2) !== 0) dy = (-dy) | 0
    const ty = (UNIT_GetPosY113c(m, pTarget) + dy) | 0
    const tx = (UNIT_GetPosX113c(m, pTarget) + dx) | 0
    const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
    const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
    castSkillWithMode6FD12380(m, nMode0, u, game, wSkill0, 0, tx, ty, hooks)
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    m.setU32((pAiParam + 0x18) >>> 0, ((m.u32((pAiParam + 0x18) >>> 0) | 0) + 1) >>> 0)
    return
  }

  if (nDist > 5) {
    if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 5 && distTargetToHome < 0x32) {
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x18) >>> 0, 7)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0x64)
      AI_RunWanderAroundUnit_6FD12750_113c(m, pTarget, 0x0c, game, u, hooks)
      return
    }
    const sp = (k2W6B3StackPtr - 0x08) >>> 0
    k2W6B3StackPtr = sp
    let pObs = 0
    try {
      m.setU32(sp, 0)
      m.setU32((sp + 4) >>> 0, 0)
      pObs = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(
        m,
        u,
        game,
        sp,
        (sp + 4) >>> 0,
      ) >>> 0
    } finally {
      k2W6B3StackPtr = (sp + 0x08) >>> 0
    }
    if (
      pObs !== 0 &&
      MONSTER_HasAlwaysChaseFlag113c(m, u) === 0 &&
      (rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x50
    ) {
      const skill1Chance = ((m.u8((game + 0x6d) >>> 0) + 4) * 10) | 0
      if (
        sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)) >= 0 &&
        (rollSeedAt6FC21180(m, pSeed, 100) | 0) < skill1Chance
      ) {
        const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
        const nMode1 = m.u8((pMonStatsTxt + 0x181) >>> 0)
        castSkillWithMode6FD12380(m, nMode1, u, game, wSkill1, pObs, 0, 0, hooks)
        return
      }
      AI_StartAttackMode113c(m, 4, u, game, pObs, hooks?.world, hooks)
      return
    }

    const pAiCtrl1 = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl1 + 0x1c) >>> 0, 0x32)
    let pathType = (stepSeed64At113c(m, pSeed) & 0xff) >= 0x80 ? 6 : 5
    if (pathType === 1) pathType = 7
    const pAiCtrl2 = getMonsterAiControlPtr113c(m, u)
    if (pathType !== 0) m.setU32((pAiCtrl2 + 0x18) >>> 0, pathType >>> 0)
    m.setU8((pAiCtrl2 + 0x20) >>> 0, 4)
    if (aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 4, hooks) !== 0) return
  }

  if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x1e && nDist < 0x0c) {
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 7)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x64)
    const fleeSteps = (0x0c - (nDist & 0xff)) & 0xff
    if (AI_RunFleeFromUnit_6FD12C10_113c(m, pTarget, u, game, fleeSteps, 0, hooks) !== 0) return
    freeUnitType2TimerEvents113c(m, game, u)
  }

  SKILLS_SetUsedSkillMemPort113c(m, u, 0)
  const sp = (k2W6B3StackPtr - 0x20) >>> 0
  k2W6B3StackPtr = sp
  try {
    m.fill(sp, 0x20, 0)
    m.setU32(sp, 4)
    m.setU32((sp + 0x04) >>> 0, u)
    m.setU32((sp + 0x08) >>> 0, pTarget)
    let speedByte = 0x64
    const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
    if (pMonStats2 !== 0 && (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) !== 0) {
      speedByte = 0x65
    }
    m.setU8((sp + 0x15) >>> 0, speedByte)
    dispatchMonsterStartMode6FC95E10(m, game, sp, 1, hooks)
  } finally {
    k2W6B3StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * [5/45] Putrid Defiler AI thinker (`0x6FC3A550`): tracks claimed host monster (`+0x14`), approaches
 * and casts `wSkill0` to impregnate, scatter-casts `wSkill0` on low life or ranged chance using
 * `MonStatsTxt[0x1EC..0x1EF]`, flees when pressed, casts `wSkill3` at obstacles, approaches, or wanders.
 *
 * @va D2Game:0x6FC3A550
 */
export function AI_ThinkPutridDefiler_6FC3A550_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC3A550)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const pDataTables = getDataTablesPtr113c(m)
  const nMonStatsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xa80) >>> 0) | 0 : 0
  const pMonStatsBase = pDataTables !== 0 ? m.u32((pDataTables + 0xa78) >>> 0) >>> 0 : 0
  const pStats492 = nMonStatsCount > 0x1ec ? (pMonStatsBase + 0x32ee0) >>> 0 : 0
  const pStats493 = nMonStatsCount > 0x1ed ? (pMonStatsBase + 0x33088) >>> 0 : 0
  const pStats494 = nMonStatsCount > 0x1ee ? (pMonStatsBase + 0x33230) >>> 0 : 0
  const pStats495 = nMonStatsCount > 0x1ef ? (pMonStatsBase + 0x333d8) >>> 0 : 0

  if ((m.u32((pAiParam + 0x14) >>> 0) | 0) !== -1 && UNIT_GetAlignment113c(m, u) === 0) {
    const dwHostGuid = m.u32((pAiParam + 0x14) >>> 0) >>> 0
    if (game === 0) {
      throw new D2CommonAssertError('AiThink.cpp', 0x2d3)
    }
    let pHost = m.u32((game + (dwHostGuid & 0x7f) * 4 + 0x1320) >>> 0) >>> 0
    while (pHost !== 0 && (m.u32((pHost + 0x0c) >>> 0) >>> 0) !== dwHostGuid) {
      pHost = m.u32((pHost + 0xe4) >>> 0) >>> 0
    }
    if (
      pHost !== 0 &&
      SUNIT_IsDeadOrDying113c(m, pHost) === 0 &&
      SUNIT_GetOwnerUnit113c(m, pHost, game) === 0 &&
      UNIT_GetAlignment113c(m, pHost) === 0
    ) {
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const maxRange = sx16(m.u16((pStats493 + nDiff * 2 + 0x56) >>> 0))
      const distSq = UNIT_CalcSqDistSubtiles113c(m, u, pHost) | 0
      if (distSq > imul32(maxRange, maxRange)) {
        aiApproachTarget6FD12540(m, game, u, pHost, 2, 0, 0, 1, 0, hooks)
        return
      }
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      if (wSkill0 >= 0) {
        const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
        castSkillWithMode6FD12380(m, nMode0, u, game, wSkill0, pHost, 0, 0, hooks)
        return
      }
    } else {
      const pAiGen = getMonsterAiGeneralPtr113c(m, u)
      m.setU32((pAiGen + 0x14) >>> 0, 0xffffffff)
    }
  }

  if (bInMeleeRange !== 0) {
    if (sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)) >= 0) {
      const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (lifePct < sx16(m.u16((pStats492 + nDiff * 2 + 0x56) >>> 0))) {
        const radius = sx16(m.u16((pStats492 + nDiff * 2 + 0x5c) >>> 0))
        const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
        const nMode0 = sx8(m.u8((pMonStatsTxt + 0x180) >>> 0))
        AI_CastSkillWithModeRandomScatter_6FD12420_113c(m, u, radius, wSkill0, nMode0, hooks)
        return
      }
    }
    const rollFlee = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((rollFlee | 0) < sx16(m.u16((pStats494 + nDiff * 2 + 0x5c) >>> 0))) {
      if (aiFleeFrom6FD12D80(m, pTarget, game, u, 5, 1, hooks) !== 0) return
    }
  }

  if (sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)) >= 0) {
    const rollScatter = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((rollScatter | 0) < sx16(m.u16((pStats492 + nDiff * 2 + 0x62) >>> 0))) {
      const radius = sx16(m.u16((pStats492 + nDiff * 2 + 0x5c) >>> 0))
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      const nMode0 = sx8(m.u8((pMonStatsTxt + 0x180) >>> 0))
      AI_CastSkillWithModeRandomScatter_6FD12420_113c(m, u, radius, wSkill0, nMode0, hooks)
      return
    }
  }

  const nDiffClose = m.u8((game + 0x6d) >>> 0)
  if (nDist < sx16(m.u16((pStats494 + nDiffClose * 2 + 0x56) >>> 0))) {
    const rollFlee = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const d2 = m.u8((game + 0x6d) >>> 0)
    if ((rollFlee | 0) < sx16(m.u16((pStats494 + d2 * 2 + 0x5c) >>> 0))) {
      aiFleeFrom6FD12D80(m, pTarget, game, u, 5, 0, hooks)
      return
    }
  }

  if (sx16(m.u16((pMonStatsTxt + 0x176) >>> 0)) >= 0) {
    const sp = (k2W6B3StackPtr - 0x04) >>> 0
    k2W6B3StackPtr = sp
    let pObs = 0
    let obsDist = 0
    try {
      m.setU32(sp, 0)
      pObs = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, sp) >>> 0
      obsDist = m.u32(sp) | 0
    } finally {
      k2W6B3StackPtr = (sp + 0x04) >>> 0
    }
    if (pObs !== 0) {
      const d = m.u8((game + 0x6d) >>> 0)
      let pChosen = 0
      let roll = 0
      if (obsDist < sx16(m.u16((pStats494 + d * 2 + 0x62) >>> 0))) {
        roll = rollSeedAt6FC21180(m, pSeed, 100) | 0
        pChosen = pStats494
      } else if (obsDist < sx16(m.u16((pStats495 + d * 2 + 0x62) >>> 0))) {
        roll = rollSeedAt6FC21180(m, pSeed, 100) | 0
        pChosen = pStats495
      }
      if (pChosen !== 0) {
        const d2 = m.u8((game + 0x6d) >>> 0)
        if (roll < sx16(m.u16((pChosen + d2 * 2 + 0x68) >>> 0))) {
          const wSkill3 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
          const nMode3 = m.u8((pMonStatsTxt + 0x183) >>> 0)
          castSkillWithMode6FD12380(m, nMode3, u, game, wSkill3, pObs, 0, 0, hooks)
          return
        }
      }
    }
  }

  if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x21) {
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 4, 0, hooks)
    return
  }
  if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x14) {
    aiIdleWander6FD11B10(m, game, u, 8, hooks)
    return
  }
  aiStall6FD122C0(m, game, u, 10, hooks)
}

function aiTryNpcInteractOrGreet6FC39C20(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): number {
  const u = pUnit >>> 0
  const game = pGame >>> 0
  const arg = pAiThinkArg >>> 0
  if (hooks !== undefined && hooks.world !== undefined) {
    AI_WarrivGreet113c(hooks.world, u)
    return 1
  }
  const pTarget = AI_FindNearestPlayerTarget113c(m, game, u) >>> 0
  const nDist = AI_CalcApproxUnitDistSubtiles113c(m, u, pTarget) | 0
  if (u === 0 || (m.u32(u) | 0) !== 1) return 0
  const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return 0
  const pInteract = m.u32((pMonData + 0x30) >>> 0) >>> 0
  if (pInteract === 0) return 0

  let bInteracting = 0
  let pNode = m.u32(pInteract) >>> 0
  let foundTargetInList = false
  while (pNode !== 0) {
    if ((m.u32(pNode) >>> 0) === pTarget) {
      bInteracting = 1
      foundTargetInList = true
      break
    }
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  if (!foundTargetInList && pTarget !== 0 && m.u32(pTarget) === 0) {
    if (m.u8((pTarget + 0x6c) >>> 0) !== 0) {
      bInteracting = 1
    } else {
      const pPlayerData = UNITS_GetPlayerData113c(m, pTarget) >>> 0
      if (pPlayerData !== 0 && (m.u32((pPlayerData + 0x4c) >>> 0) | 0) === 1) {
        bInteracting = 1
      }
    }
  }

  let bAnyNonZeroNode = 0
  let pScan = m.u32(pInteract) >>> 0
  while (pScan !== 0) {
    if (m.u32(pScan) !== 0) {
      bAnyNonZeroNode = 1
      break
    }
    pScan = m.u32((pScan + 0x08) >>> 0) >>> 0
  }

  const pAiParam = arg !== 0 ? m.u32(arg) >>> 0 : 0
  if (bAnyNonZeroNode !== 0 || bInteracting !== 0 || (m.u32((pAiParam + 0x14) >>> 0) | 0) > 0) {
    const retX = m.u32((pAiParam + 0x18) >>> 0) | 0
    const retY = m.u32((pAiParam + 0x1c) >>> 0) | 0
    if (
      (UNITS_GetOctileDistanceToCoordinates113c(m, u, retX, retY) >>> 0) > 2 &&
      (m.u32((pAiParam + 0x14) >>> 0) | 0) > 0x24
    ) {
      aiApproachTarget6FD12540(m, game, u, 0, 2, retX, retY, 1, 0, hooks)
    } else if ((m.u32((pAiParam + 0x14) >>> 0) | 0) > 0) {
      aiStall6FD122C0(m, game, u, 8, hooks)
    }
    const curTimer = m.u32((pAiParam + 0x14) >>> 0) | 0
    if (curTimer < 0) {
      m.setU32((pAiParam + 0x14) >>> 0, 0)
    } else {
      m.setU32((pAiParam + 0x14) >>> 0, (curTimer - 1) >>> 0)
    }
    return 1
  }

  if (pTarget === 0 || pTarget === u) return 0
  if (nDist > 2 && nDist < 0x18) {
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 7)
    const stepDist = nDist >= 5 ? 3 : (nDist - 2) | 0
    AI_StepRelativeToTargetUnit113c(m, game, u, pTarget, stepDist, 1, hooks?.townNpc)
    return 1
  }

  const curWait = m.u32((pAiParam + 0x18) >>> 0) | 0
  if (curWait === 0) {
    m.setU32((pAiParam + 0x18) >>> 0, 0x3c)
    if (m.u32(pTarget) === 0) {
      AI_WarrivGreetMem113c(m, game, u, arg, hooks?.townNpc)
      aiStall6FD122C0(m, game, u, 0x14, hooks)
      return 1
    }
  } else {
    if (curWait < 0) m.setU32((pAiParam + 0x18) >>> 0, 0)
    const reloaded = m.u32((pAiParam + 0x18) >>> 0) | 0
    if (reloaded > 0) m.setU32((pAiParam + 0x18) >>> 0, (reloaded - 1) >>> 0)
  }
  aiStall6FD122C0(m, game, u, 0x14, hooks)
  return 1
}

/**
 * [6/45] Minion-command skirmisher AI (`0x6FC3B2F0`): executes queued AI commands `1` (`A1`) and `14`
 * (path-type `13` approach), wanders around target beyond `aip1`, and cycles 3-state melee/circle/flee logic.
 *
 * @va D2Game:0x6FC3B2F0
 */
export function AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC3B2F0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const pAiGen = getMonsterAiGeneralPtr113c(m, u)
  const pCmd = pAiGen !== 0 ? m.u32((pAiGen + 0x20) >>> 0) >>> 0 : 0
  if (pCmd !== 0) {
    const cmdType = m.u32((pCmd + 0x08) >>> 0) | 0
    if (cmdType === 1) {
      const pCmdTarget = SUNIT_GetServerUnit113c(
        m,
        game,
        m.u32((pCmd + 0x10) >>> 0) | 0,
        m.u32((pCmd + 0x0c) >>> 0) >>> 0,
      ) >>> 0
      if (pCmdTarget !== 0) {
        m.setU32((pAiParam + 0x14) >>> 0, 0)
        m.setU32((pAiParam + 0x18) >>> 0, 0)
        SKILLS_SetUsedSkillMemPort113c(m, u, 0)
        const sp = (k2W6B3StackPtr - 0x20) >>> 0
        k2W6B3StackPtr = sp
        try {
          m.fill(sp, 0x20, 0)
          m.setU32(sp, 4)
          m.setU32((sp + 0x04) >>> 0, u)
          m.setU32((sp + 0x08) >>> 0, pCmdTarget)
          let speedByte = 0x64
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
          if (
            pMonStats2 !== 0 &&
            (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) !== 0
          ) {
            speedByte = 0x65
          }
          m.setU8((sp + 0x15) >>> 0, speedByte)
          dispatchMonsterStartMode6FC95E10(m, game, sp, 1, hooks)
        } finally {
          k2W6B3StackPtr = (sp + 0x20) >>> 0
        }
        AIGENERAL_PopAiCommand113c(m, u)
        return
      }
    }
    if ((m.u32((pCmd + 0x08) >>> 0) | 0) === 0x0e) {
      const pCmdTarget = SUNIT_GetServerUnit113c(
        m,
        game,
        m.u32((pCmd + 0x10) >>> 0) | 0,
        m.u32((pCmd + 0x0c) >>> 0) >>> 0,
      ) >>> 0
      if (pCmdTarget !== 0) {
        m.setU32((pAiParam + 0x14) >>> 0, 0)
        m.setU32((pAiParam + 0x18) >>> 0, 0)
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        m.setU32((pAiCtrl + 0x18) >>> 0, 0x0d)
        m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
        aiApproachTarget6FD12540(m, game, u, pCmdTarget, 2, 0, 0, 1, 0, hooks)
        AIGENERAL_PopAiCommand113c(m, u)
        return
      }
    }
    AIGENERAL_PopAiCommand113c(m, u)
  }

  if (bInMeleeRange === 0) {
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (nDist > sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))) {
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
      AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pTarget, 6, game, u, hooks)
      return
    }
  }

  if (bInMeleeRange !== 0 || nDist < 6) {
    const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((roll | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x5c) >>> 0))) {
      m.setU32((pAiParam + 0x14) >>> 0, 2)
    }
  }

  const sp = (k2W6B3StackPtr - 0x04) >>> 0
  k2W6B3StackPtr = sp
  let pObs = 0
  try {
    m.setU32(sp, 0)
    pObs = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, sp) >>> 0
  } finally {
    k2W6B3StackPtr = (sp + 0x04) >>> 0
  }

  const aiState = m.u32((pAiParam + 0x14) >>> 0) | 0
  if (aiState === 0) {
    const cnt = ((m.u32((pAiParam + 0x18) >>> 0) | 0) + 1) | 0
    m.setU32((pAiParam + 0x18) >>> 0, cnt >>> 0)
    const maxCnt = (((stepSeed64At113c(m, pSeed) >>> 0) % 3) + 3) | 0
    if (cnt > maxCnt) {
      m.setU32((pAiParam + 0x14) >>> 0, 1)
      m.setU32((pAiParam + 0x18) >>> 0, 0)
    }
    if (pObs !== 0) {
      AI_StartAttackMode113c(m, 4, u, game, pObs, hooks?.world, hooks)
      return
    }
    let pathType = (stepSeed64At113c(m, pSeed) & 0xff) >= 0x80 ? 6 : 5
    if (pathType === 1) pathType = 7
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    if (pathType !== 0) m.setU32((pAiCtrl + 0x18) >>> 0, pathType >>> 0)
    m.setU8((pAiCtrl + 0x20) >>> 0, 4)
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
    return
  }

  if (aiState === 1) {
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    m.setU32((pAiParam + 0x18) >>> 0, 0)
    const pAiCtrl1 = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl1 + 0x1c) >>> 0, 0x32)
    let pathType = (stepSeed64At113c(m, pSeed) & 0xff) >= 0x80 ? 6 : 5
    if (pathType === 1) pathType = 7
    const pAiCtrl2 = getMonsterAiControlPtr113c(m, u)
    if (pathType !== 0) m.setU32((pAiCtrl2 + 0x18) >>> 0, pathType >>> 0)
    m.setU8((pAiCtrl2 + 0x20) >>> 0, 6)
    if (aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 4, hooks) !== 0) return
    aiStall6FD122C0(m, game, u, 10, hooks)
    return
  }

  if (aiState === 2) {
    if (nDist > 0x0c) {
      if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x14) {
        if (AI_CircleStrafeTarget_6FD126B0_113c(m, u, 1, game, pTarget, 4, hooks) !== 0) return
      }
      m.setU32((pAiParam + 0x14) >>> 0, 0)
      m.setU32((pAiParam + 0x18) >>> 0, 0)
      aiStall6FD122C0(m, game, u, 10, hooks)
      return
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 2)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
    if (aiFleeFrom6FD12D80(m, pTarget, game, u, 0x0e, 1, hooks) !== 0) return
    AI_StartAttackMode113c(m, 4, u, game, pObs, hooks?.world, hooks)
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    m.setU32((pAiParam + 0x18) >>> 0, 0)
    return
  }

  aiStall6FD122C0(m, game, u, 10, hooks)
}

/**
 * [7/45] Swarm/pack skirmisher AI (`0x6FC3B780`): finds blocking obstacle/target (`0x6FCD1BC0`),
 * flees `16` steps if `obsDist < 8`, wanders around target beyond `aip6 - 6`, attacks `A1` or stalls,
 * or regroups toward closest same-base monster (`0x6FCBCA00`) when separated beyond `aip3`.
 *
 * @va D2Game:0x6FC3B780
 */
export function AI_ThinkPackRegroupSkirmisher_6FC3B780_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC3B780)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const initDist = m.u32((arg + 0x14) >>> 0) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const sp = (k2W6B3StackPtr - 0x10) >>> 0
  k2W6B3StackPtr = sp
  let pObs = 0
  let obsDist = 0
  try {
    m.setU32(sp, initDist)
    pObs = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, sp) >>> 0
    obsDist = m.u32(sp) | 0
  } finally {
    k2W6B3StackPtr = (sp + 0x10) >>> 0
  }

  if (obsDist < 8) {
    const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((roll | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0))) {
      aiFleeFrom6FD12D80(m, pTarget, game, u, 0x10, 1, hooks)
      return
    }
  }

  const nDiff1 = m.u8((game + 0x6d) >>> 0)
  if (obsDist > (sx16(m.u16((pMonStatsTxt + nDiff1 * 2 + 0x74) >>> 0)) - 6)) {
    const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const d2 = m.u8((game + 0x6d) >>> 0)
    if ((roll | 0) < sx16(m.u16((pMonStatsTxt + d2 * 2 + 0x56) >>> 0))) {
      AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pTarget, 4, game, u, hooks)
      return
    }
  }

  const nDiff2 = m.u8((game + 0x6d) >>> 0)
  if (pObs !== 0 && obsDist < sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x74) >>> 0))) {
    const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const d3 = m.u8((game + 0x6d) >>> 0)
    if ((roll | 0) < sx16(m.u16((pMonStatsTxt + d3 * 2 + 0x5c) >>> 0))) {
      AI_StartAttackMode113c(m, 4, u, game, pObs, hooks?.world, hooks)
      return
    }
    aiStall6FD122C0(m, game, u, sx16(m.u16((pMonStatsTxt + d3 * 2 + 0x6e) >>> 0)), hooks)
    return
  }

  const spScan = (k2W6B3StackPtr - 0x08) >>> 0
  k2W6B3StackPtr = spScan
  let pBestAlly = 0
  let bestDist = 0
  try {
    m.setU32(spScan, 0)
    m.setU32((spScan + 4) >>> 0, 0x7fffffff)
    scanUnitsByModeWithCb113c(m, 1, spScan, game, u, 0x6fcbca00)
    pBestAlly = m.u32(spScan) >>> 0
    bestDist = m.u32((spScan + 4) >>> 0) | 0
  } finally {
    k2W6B3StackPtr = (spScan + 0x08) >>> 0
  }

  if (pBestAlly !== 0) {
    const d4 = m.u8((game + 0x6d) >>> 0)
    if (bestDist > sx16(m.u16((pMonStatsTxt + d4 * 2 + 0x62) >>> 0))) {
      aiApproachTarget6FD12540(m, game, u, pBestAlly, 2, 0, 0, 1, 7, hooks)
      return
    }
  }

  const d5 = m.u8((game + 0x6d) >>> 0)
  aiStall6FD122C0(m, game, u, sx16(m.u16((pMonStatsTxt + d5 * 2 + 0x6e) >>> 0)), hooks)
}

/**
 * [8/45] Act 2 Lut Gholein Sewer Trap Door / Atma town NPC AI (`0x6FC3B950`):
 * initializes home node `10`, paces to Radament/sewer coords before trap door opens,
 * then stations near `(homeX, homeY - 3)` and greets/wanders near players.
 *
 * @va D2Game:0x6FC3B950
 */
export function AI_ThinkAct2SewerTownNpc_6FC3B950_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC3B950)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0

  if ((AI_InitHomeNode10_113c(m, game, u) & 0xff) !== 0) return

  const pCmd10 = findAiCmdNodeInCircularList113c(m, u, 0x0a)
  if (ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c(m, game) === 0) {
    const sp = (k2W6B3StackPtr - 0x08) >>> 0
    k2W6B3StackPtr = sp
    let tx = 0
    let ty = 0
    let bCanGreet = 1
    try {
      m.setU32(sp, m.u32((pCmd10 + 0x0c) >>> 0))
      m.setU32((sp + 4) >>> 0, m.u32((pCmd10 + 0x10) >>> 0))
      if (ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c(m, game, sp) !== 0) {
        bCanGreet = 0
      }
      tx = m.u32(sp) | 0
      ty = m.u32((sp + 4) >>> 0) | 0
    } finally {
      k2W6B3StackPtr = (sp + 0x08) >>> 0
    }

    const lastMove = m.u32((pCmd10 + 0x18) >>> 0) | 0
    const curFrame = m.u32((game + 0xa8) >>> 0) | 0
    if (lastMove >= curFrame || ((curFrame - lastMove) | 0) >= 0xc8) {
      if ((UNITS_GetOctileDistanceToCoordinates113c(m, u, tx, ty) >>> 0) > 1) {
        aiApproachTarget6FD12540(m, game, u, 0, 2, tx, ty, 1, 0, hooks)
        m.setU32((pCmd10 + 0x18) >>> 0, m.u32((game + 0xa8) >>> 0) >>> 0)
        return
      }
      if (bCanGreet !== 0 && (aiTryNpcInteractOrGreet6FC39C20(m, u, game, arg, hooks) & 0xff) !== 0) {
        m.setU32((pCmd10 + 0x18) >>> 0, m.u32((game + 0xa8) >>> 0) >>> 0)
        return
      }
    }
    aiStall6FD122C0(m, game, u, 0x14, hooks)
    return
  }

  if (pCmd10 === 0) {
    aiStall6FD122C0(m, game, u, 0x78, hooks)
    return
  }

  const pNearTarget = AI_FindNearestPlayerTarget113c(m, game, u) >>> 0
  const nearDist = AI_CalcApproxUnitDistSubtiles113c(m, u, pNearTarget) | 0

  if (ACT2Q4_IsPortalOpen_6FCE2040_113c(m, game) !== 0) {
    const tx = m.u32((pCmd10 + 0x0c) >>> 0) | 0
    const ty = ((m.u32((pCmd10 + 0x10) >>> 0) | 0) - 3) | 0
    if ((UNITS_GetOctileDistanceToCoordinates113c(m, u, tx, ty) >>> 0) > 2) {
      aiApproachTarget6FD12540(m, game, u, 0, 2, tx, ty, 1, 0, hooks)
      return
    }
  }

  const tx2 = m.u32((pCmd10 + 0x0c) >>> 0) | 0
  const ty2 = ((m.u32((pCmd10 + 0x10) >>> 0) | 0) - 3) | 0
  if ((UNITS_GetOctileDistanceToCoordinates113c(m, u, tx2, ty2) >>> 0) > 7) {
    aiApproachTarget6FD12540(m, game, u, 0, 2, tx2, ty2, 1, 0, hooks)
    return
  }

  if ((aiTryNpcInteractOrGreet6FC39C20(m, u, game, arg, hooks) & 0xff) === 0) {
    if (pNearTarget !== 0 && pNearTarget !== u) {
      if (m.u32(pNearTarget) === 0) {
        if (nearDist < 0x0c) {
          if ((rollSeedAt6FC21180(m, (u + 0x20) >>> 0, 0x3e8) | 0) < 0x64) {
            AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pNearTarget, 2, game, u, hooks)
          }
          aiStall6FD122C0(m, game, u, 0xc8, hooks)
          return
        }
        aiStall6FD122C0(m, game, u, 0x14, hooks)
      }
      if ((rollSeedAt6FC21180(m, (u + 0x20) >>> 0, 0x3e8) | 0) < 0x32) {
        aiIdleWander6FD11B10(m, game, u, 3, hooks)
      }
    }
  }
  aiStall6FD122C0(m, game, u, 0x78, hooks)
}

function isFallenSliceWorldW6B3_113c(
  v: D2KernMemory113c | FallenSliceWorld113c,
): v is FallenSliceWorld113c {
  return !('u32' in v)
}

/**
 * [9/45] Hireling combat action step (`0x6FC3C8A0`, `eax = pUnit`, `ret 0x18`):
 * computes level-scaled cast threshold (`pAiParam->dwField14 + 40 + 2 * clvl`, capped at `95`, or `98`
 * for Act 3/5 classes `0x152` / `0x22F..0x231`), checks pet record via `0x6FCB6570`, handles ranged
 * reposition/flee (`aip1 == 0`) vs melee skill/run approach (`aip1 != 0`), and invokes `0x6FC3C4E0`.
 *
 * @va D2Game:0x6FC3C8A0
 */
export function AI_ExecuteHirelingCombatStep_6FC3C8A0_113c(
  arg0: D2KernMemory113c | FallenSliceWorld113c,
  arg1: number,
  arg2: number,
  arg3: number,
  arg4: number,
  arg5: number,
  arg6: number,
  arg7: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC3C8A0)
  if (isFallenSliceWorldW6B3_113c(arg0)) {
    const world = arg0
    const { m, pGame } = world
    const pMerc = arg1 >>> 0
    const nClassId = arg2 | 0
    const pOwner = arg3 >>> 0
    const pTarget = arg4 >>> 0
    const pSeed = arg5 >>> 0
    const pAiCtrl = arg6 >>> 0
    const pMonStatsTxt = arg7 >>> 0

    let aggroChance = 0x62
    if (nClassId !== 0x152 && (nClassId <= 0x22f || nClassId > 0x231)) {
      const bonus = m.u32((pAiCtrl + 0x14) >>> 0) | 0
      const mercLvl = STATLIST_GetUnitStat113c(m, pMerc, 0x0c, 0) | 0
      aggroChance = (bonus + 0x28 + mercLvl * 2) | 0
      if (aggroChance >= 0x5f) aggroChance = 0x5f
    }

    const dist = AI_CalcApproxUnitDistSubtiles113c(m, pMerc, pTarget) | 0
    const mercGuid = pMerc !== 0 ? (m.u32((pMerc + 0x0c) >>> 0) >>> 0) : 0xffffffff
    const pPetArg = PETS_FindPetArgByGuid_6FCB6570_113c(m, pOwner, mercGuid) >>> 0
    if (pPetArg === 0) {
      AI_Stall113c(world, pMerc, 10)
      return
    }
    const wMercType = m.u32((pPetArg + 0x08) >>> 0) | 0

    const aggroRoll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    let doAct = 0
    if ((aggroRoll | 0) < aggroChance) {
      doAct = 1
      m.setU32((pAiCtrl + 0x14) >>> 0, 0)
    } else {
      m.setU32((pAiCtrl + 0x14) >>> 0, ((m.u32((pAiCtrl + 0x14) >>> 0) | 0) + 10) >>> 0)
    }

    const rawDiff = m.u8((pGame + 0x6d) >>> 0)
    const diff = rawDiff >= 2 ? 2 : rawDiff === 1 ? 1 : 0
    const aip2 = m.u16((pMonStatsTxt + 0x56 + diff * 2) >>> 0)

    if (aip2 === 0) {
      if (dist < 4) {
        const kiteRoll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
        if ((kiteRoll | 0) < 50) {
          if (AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pOwner, 4, pGame, pMerc, { world }) !== 0) {
            return
          }
          EVENT_DeleteEventByArg14_113c(m, pGame, pMerc, 2, 0)
          if (AI_FleeFrom113c(world, pTarget, pMerc, 4, true)) {
            return
          }
          AI_SelectAndCastHirelingSkill_6FC3C4E0_113c(world, pMerc, nClassId, wMercType, pTarget, pSeed)
          return
        }
      }
      if (doAct !== 0) {
        AI_SelectAndCastHirelingSkill_6FC3C4E0_113c(world, pMerc, nClassId, wMercType, pTarget, pSeed)
        return
      }
      AI_Stall113c(world, pMerc, 10)
      return
    }

    if (dist < 3 && UNITS_CanUnitMeleeAttackTarget113c(m, pMerc, pTarget, 0) !== 0) {
      if (doAct !== 0) {
        AI_SelectAndCastHirelingSkill_6FC3C4E0_113c(world, pMerc, nClassId, wMercType, pTarget, pSeed)
        return
      }
      AI_Stall113c(world, pMerc, 10)
      return
    }

    const pMonStats2 = m.u32((pMonStatsTxt + 0x08) >>> 0) >>> 0
    const walkSteps = pMonStats2 !== 0 ? m.u8((pMonStats2 + 0x0e) >>> 0) : 8
    AI_ApproachTarget113c(world, pMerc, pTarget, 15, 0, 0, walkSteps > 0 ? walkSteps : 1, 1)
    return
  }

  const m = arg0
  const u = arg1 >>> 0
  const game = arg2 >>> 0
  const cls = arg3 | 0
  const player = arg4 >>> 0
  const target = arg5 >>> 0
  const seed = arg6 >>> 0
  const arg = arg7 >>> 0

  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0

  let actionChance: number
  if (cls === 0x152 || (cls > 0x22f && cls <= 0x231)) {
    actionChance = 0x62
  } else {
    const baseBonus = ((m.u32((pAiParam + 0x14) >>> 0) | 0) + 0x28) | 0
    const clvl = STATLIST_GetUnitStat113c(m, u, 0x0c, 0) | 0
    actionChance = (baseBonus + clvl * 2) | 0
    if (actionChance >= 0x5f) actionChance = 0x5f
  }

  const nDist = AI_CalcApproxUnitDistSubtiles113c(m, u, target) | 0
  const dwPetGuid = u !== 0 ? m.u32((u + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const pPetArg = PETS_FindPetArgByGuid_6FCB6570_113c(m, player, dwPetGuid) >>> 0
  if (pPetArg === 0) {
    aiStall6FD122C0(m, game, u, 0x0a, hooks)
    return
  }

  const rollAct = (stepSeed64At113c(m, seed) >>> 0) % 100
  let bActNow = 0
  if ((rollAct | 0) < actionChance) {
    bActNow = 1
    m.setU32((pAiParam + 0x14) >>> 0, 0)
  } else {
    m.setU32((pAiParam + 0x14) >>> 0, ((m.u32((pAiParam + 0x14) >>> 0) | 0) + 0x0a) >>> 0)
  }

  const nDiff = m.u8((game + 0x6d) >>> 0)
  if (sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0)) === 0) {
    if (nDist < 4 && ((stepSeed64At113c(m, seed) >>> 0) % 100) < 0x32) {
      if (AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, player, 4, game, u, hooks) !== 0) return
      if (u !== 0) {
        freeUnitType2TimerEvents113c(m, game, u)
      }
      if (aiFleeFrom6FD12D80(m, target, game, u, 4, 1, hooks) !== 0) return
      AI_SelectAndCastHirelingSkill_6FC3C4E0_113c(m, game, u, target, 1, hooks?.w3b2)
      return
    }
    if (bActNow !== 0) {
      AI_SelectAndCastHirelingSkill_6FC3C4E0_113c(m, game, u, target, 1, hooks?.w3b2)
      return
    }
    aiStall6FD122C0(m, game, u, 0x0a, hooks)
    return
  }

  if (nDist < 3 && UNITS_CanUnitMeleeAttackTarget113c(m, u, target, 0) !== 0) {
    if (bActNow !== 0) {
      AI_SelectAndCastHirelingSkill_6FC3C4E0_113c(m, game, u, target, 1, hooks?.w3b2)
      return
    }
    aiStall6FD122C0(m, game, u, 0x0a, hooks)
    return
  }

  const pMonStats2 = m.u32((arg + 0x20) >>> 0) >>> 0
  const nStepNum = m.u8((pMonStats2 + 0x0e) >>> 0)
  PATH_SetStepNum113c(m, m.u32((u + 0x2c) >>> 0) >>> 0, nStepNum)
  aiApproachTarget6FD12540(m, game, u, target, 0x0f, 0, 0, 1, 1, hooks)
}

/**
 * [10/45] Special AI command-`14` skill trigger (`0x6FC9D670`): ensures command node `14` (`0x0E`) exists,
 * casts `wSkill0` on `PATH_GetTargetUnit` (if `!= pUnit`) when `pCmd14->dwParam3 == 1` and schedules a
 * `30`-frame AI timer (`0x6FD12040`), or restores normal AI think state (`0x6FCBD230`, `1`-frame timer).
 *
 * @va D2Game:0x6FC9D670
 */
export function AI_ThinkCommand14TriggeredSkill_6FC9D670_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC9D670)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0

  let pCmd14 = findAiCmdNodeInCircularList113c(m, u, 0x0e)
  if (pCmd14 === 0) {
    AIGENERAL_CopyAiCommandParams113c(m, u, 0x0e, 0, 0, 0, 0)
    pCmd14 = findAiCmdNodeInCircularList113c(m, u, 0x0e)
  }

  const pAiParam = m.u32(arg) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0

  if (
    (m.u32((pCmd14 + 0x18) >>> 0) | 0) === 1 &&
    sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)) >= 0
  ) {
    SUNIT_ValidatePathTargetUnit113c(m, u, game)
    const pPathTarget = PATH_GetTargetUnit113c(m, m.u32((u + 0x2c) >>> 0) >>> 0) >>> 0
    const pCastTarget = pPathTarget === u ? 0 : pPathTarget
    const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
    const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
    castSkillWithMode6FD12380(m, nMode0, u, game, wSkill0, pCastTarget, 0, 0, hooks)
    AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 0x1e, hooks)
    m.setU32((pCmd14 + 0x18) >>> 0, 0)
    return
  }

  const nCurSpecAi = m.u32(pAiParam) | 0
  const saved1C = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  transitionMonsterSpecialAiState6FCBD230(m, game, u, pAiParam, nCurSpecAi)
  m.setU32((pAiParam + 0x1c) >>> 0, saved1C)
  AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 1, hooks)
}

/**
 * [11/45] Monster AI thinker (`0x6FC9E070`): computes run/walk velocity bonus (`0..120`), handles
 * always-chase (`0x3`/`0x13`) melee/skill0, low-life flee state (`dwAiState == 1`, `14` steps),
 * unowned low-life retreat (`9` steps), melee `A1`/`wSkill0`/circle-strafe, and state `0x54` pursuit.
 *
 * @va D2Game:0x6FC9E070
 */
export function AI_ThinkLowLifeFleeCaster_6FC9E070_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC9E070)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0
  const wVel = sx16(m.u16((pMonStatsTxt + 0x32) >>> 0))
  let velBonus = 0
  if (wVel > 0) {
    const raw = (sdiv32(imul32(sx16(m.u16((pMonStatsTxt + 0x34) >>> 0)), 100), wVel) - 100) | 0
    if (raw > 0) {
      velBonus = raw >= 0x78 ? 0x78 : raw
    }
  }

  let bAlwaysChase = false
  if (u !== 0 && (m.u32(u) | 0) === 1) {
    const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const itype = m.u32((pMonData + 0x54) >>> 0) | 0
      bAlwaysChase = itype === 3 || itype === 0x13
    }
  }

  if (bAlwaysChase) {
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    if (bInMeleeRange !== 0) {
      SKILLS_SetUsedSkillMemPort113c(m, u, 0)
      const sp = (k2W6B3StackPtr - 0x20) >>> 0
      k2W6B3StackPtr = sp
      try {
        m.fill(sp, 0x20, 0)
        m.setU32(sp, 4)
        m.setU32((sp + 0x04) >>> 0, u)
        m.setU32((sp + 0x08) >>> 0, pTarget)
        let speedByte = 0x64
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
        if (
          pMonStats2 !== 0 &&
          (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) !== 0
        ) {
          speedByte = 0x65
        }
        m.setU8((sp + 0x15) >>> 0, speedByte)
        dispatchMonsterStartMode6FC95E10(m, game, sp, 1, hooks)
      } finally {
        k2W6B3StackPtr = (sp + 0x20) >>> 0
      }
      return
    }
    const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
    if (wSkill0 >= 0) {
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (nDist < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))) {
        const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
        castSkillWithMode6FD12380(m, nMode0, u, game, wSkill0, pTarget, 0, 0, hooks)
        return
      }
    }
  }

  if ((m.u32((pAiParam + 0x14) >>> 0) | 0) === 1) {
    const nextCnt = ((m.u32((pAiParam + 0x18) >>> 0) | 0) + 1) | 0
    m.setU32((pAiParam + 0x18) >>> 0, nextCnt >>> 0)
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (lifePct <= sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0))) {
      const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      if ((roll | 0) >= 0x19) {
        const d2 = m.u8((game + 0x6d) >>> 0)
        if (nextCnt <= sx16(m.u16((pMonStatsTxt + d2 * 2 + 0x74) >>> 0))) {
          if (nDist >= 0x0e) {
            aiStall6FD122C0(m, game, u, 0x0f, hooks)
            return
          }
          if (velBonus < -126 || velBonus > 126) {
            throw new D2CommonAssertError('AiThink.cpp', 0x110)
          }
          const pAiCtrl = getMonsterAiControlPtr113c(m, u)
          if (velBonus !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, velBonus >>> 0)
          aiFleeFrom6FD12D80(m, pTarget, game, u, 0x0e, 0, hooks)
          return
        }
      }
    }
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    aiStall6FD122C0(m, game, u, 0x0f, hooks)
    return
  }

  let pLeader = 0
  const pAiGen = getMonsterAiGeneralPtr113c(m, u)
  if (pAiGen !== 0) {
    const pGenGame = m.u32((pAiGen + 0x28) >>> 0) >>> 0
    if (pGenGame !== 0) {
      pLeader = SUNIT_GetServerUnit113c(
        m,
        pGenGame,
        m.u32((pAiGen + 0x30) >>> 0) | 0,
        m.u32((pAiGen + 0x2c) >>> 0) >>> 0,
      ) >>> 0
    }
  }

  if (pLeader === 0) {
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (lifePct < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0))) {
      m.setU32((pAiParam + 0x14) >>> 0, 1)
      m.setU32((pAiParam + 0x18) >>> 0, 0)
      aiFleeFrom6FD12D80(m, pTarget, game, u, 9, 0, hooks)
      return
    }
  }

  if (bInMeleeRange !== 0) {
    const rollAtk = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((rollAtk | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))) {
      AI_StartAttackMode113c(m, 4, u, game, pTarget, hooks?.world, hooks)
      return
    }
    const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
    if (wSkill0 >= 0) {
      const rollSk = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const d2 = m.u8((game + 0x6d) >>> 0)
      if (rollSk < sx16(m.u16((pMonStatsTxt + d2 * 2 + 0x5c) >>> 0))) {
        const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
        castSkillWithMode6FD12380(m, nMode0, u, game, wSkill0, pTarget, 0, 0, hooks)
        return
      }
    }
    AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 5, hooks)
    return
  }

  const nDiffRange = m.u8((game + 0x6d) >>> 0)
  if (nDist < sx16(m.u16((pMonStatsTxt + nDiffRange * 2 + 0x6e) >>> 0))) {
    const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
    if (wSkill0 >= 0) {
      const rollSk = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const d2 = m.u8((game + 0x6d) >>> 0)
      if (rollSk < sx16(m.u16((pMonStatsTxt + d2 * 2 + 0x5c) >>> 0))) {
        const nMode0 = m.u8((pMonStatsTxt + 0x180) >>> 0)
        castSkillWithMode6FD12380(m, nMode0, u, game, wSkill0, pTarget, 0, 0, hooks)
        return
      }
    }
    if (STATES_CheckState113c(m, pTarget, 0x54) !== 0) {
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
      return
    }
    const d3 = m.u8((game + 0x6d) >>> 0)
    aiStall6FD122C0(m, game, u, sx16(m.u16((pMonStatsTxt + d3 * 2 + 0x80) >>> 0)), hooks)
    return
  }

  if (nDist < sx16(m.u16((pMonStatsTxt + nDiffRange * 2 + 0x7a) >>> 0))) {
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
    return
  }
  aiStall6FD122C0(m, game, u, 0x0f, hooks)
}

/**
 * [12/45] Fetish / Flayer melee AI (`0x6FC9ED90`): flees in Act 3 when target player has completed
 * Compelling Orb (`quest 0x15, state 0`), handles always-chase low-life flee & `0x40` subtile overlap
 * unsticking, alternates melee bursts (`A2`/`A1`) with stall/circle-strafe, and sprints (`aip4`) or walks.
 *
 * @va D2Game:0x6FC9ED90
 */
export function AI_ThinkFetishMelee_6FC9ED90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FC9ED90)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const wVel = sx16(m.u16((pMonStatsTxt + 0x32) >>> 0))
  let velBonus = 0
  if (wVel > 0) {
    const raw = (sdiv32(imul32(sx16(m.u16((pMonStatsTxt + 0x34) >>> 0)), 100), wVel) - 100) | 0
    if (raw > 0) {
      velBonus = raw >= 0x78 ? 0x78 : raw
    }
  }
  const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0

  let pPlayerTarget = pTarget
  if (pPlayerTarget !== 0 && (m.u32(pPlayerTarget) | 0) === 1) {
    const pTgtAiGen = getMonsterAiGeneralPtr113c(m, pPlayerTarget)
    const pGenGame = m.u32((pTgtAiGen + 0x28) >>> 0) >>> 0
    const ownerGuid = pGenGame !== 0 ? m.u32((pTgtAiGen + 0x2c) >>> 0) >>> 0 : 0xffffffff
    const ownerType = pGenGame !== 0 ? m.u32((pTgtAiGen + 0x30) >>> 0) | 0 : 1
    if (ownerType === 0) {
      pPlayerTarget = SUNIT_GetServerUnit113c(m, game, 0, ownerGuid) >>> 0
    }
  }

  if (pPlayerTarget !== 0 && m.u32(pPlayerTarget) === 0) {
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, UNITS_GetRoom113c(m, u)) | 0
    if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) === 2) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerTarget) >>> 0
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) !== 0) {
        if (velBonus < -126 || velBonus > 126) {
          throw new D2CommonAssertError('AiThink.cpp', 0x110)
        }
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        if (velBonus !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, velBonus >>> 0)
        if (AI_RunFleeFromUnit_6FD12C10_113c(m, pTarget, u, game, 8, 1, hooks) !== 0) return
        aiIdleWander6FD11B10(m, game, u, 6, hooks)
        return
      }
    }
  }

  let bAlwaysChase = false
  if (u !== 0 && (m.u32(u) | 0) === 1) {
    const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const itype = m.u32((pMonData + 0x54) >>> 0) | 0
      bAlwaysChase = itype === 3 || itype === 0x13
    }
  }

  if (bAlwaysChase) {
    if (m.u32((pAiParam + 0x18) >>> 0) === 0) {
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (lifePct < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0))) {
        m.setU32((pAiParam + 0x14) >>> 0, 0)
        if (velBonus < -126 || velBonus > 126) {
          throw new D2CommonAssertError('AiThink.cpp', 0x110)
        }
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        if (velBonus !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, velBonus >>> 0)
        if (AI_RunFleeFromUnit_6FD12C10_113c(m, pTarget, u, game, 8, 1, hooks) !== 0) return
        m.setU32((pAiParam + 0x18) >>> 0, 5)
      }
    }
    const unitY = getUnitYInline113c(m, u)
    const unitX = getUnitXInline113c(m, u)
    const pRoom = UNITS_GetRoom113c(m, u) >>> 0
    if ((COLLISION_CheckSubtileMask113c(m, pRoom, unitX, unitY, 0x40) & 0xffff) !== 0) {
      if (bInMeleeRange !== 0) {
        let pathType = (stepSeed64At113c(m, pSeed) & 0xff) >= 0x80 ? 6 : 5
        if (pathType === 1) pathType = 7
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        if (pathType !== 0) m.setU32((pAiCtrl + 0x18) >>> 0, pathType >>> 0)
        m.setU8((pAiCtrl + 0x20) >>> 0, 4)
        aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
        return
      }
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
      return
    }
  }

  const curCooldown = m.u32((pAiParam + 0x18) >>> 0) | 0
  if (curCooldown !== 0) {
    m.setU32((pAiParam + 0x18) >>> 0, (curCooldown - 1) >>> 0)
  }

  if (bInMeleeRange !== 0) {
    if (m.u32((pAiParam + 0x14) >>> 0) !== 0) {
      const rollCont = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if ((rollCont | 0) >= sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))) {
        m.setU32((pAiParam + 0x14) >>> 0, 0)
        if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x50) {
          aiStall6FD122C0(m, game, u, 0x0a, hooks)
          return
        }
        AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
        return
      }
    }
    m.setU32((pAiParam + 0x14) >>> 0, 1)
    const rollMode = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    const useMode5 = (rollMode | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x5c) >>> 0))
    const mode = useMode5 ? 5 : 4
    const bitIdx = useMode5 ? 5 : 4
    SKILLS_SetUsedSkillMemPort113c(m, u, 0)
    const sp = (k2W6B3StackPtr - 0x20) >>> 0
    k2W6B3StackPtr = sp
    try {
      m.fill(sp, 0x20, 0)
      m.setU32(sp, mode)
      m.setU32((sp + 0x04) >>> 0, u)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      let speedByte = 0x64
      if (u !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
        if (
          pMonStats2 !== 0 &&
          (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, bitIdx)) !== 0
        ) {
          speedByte = 0x65
        }
      }
      m.setU8((sp + 0x15) >>> 0, speedByte)
      dispatchMonsterStartMode6FC95E10(m, game, sp, 1, hooks)
    } finally {
      k2W6B3StackPtr = (sp + 0x20) >>> 0
    }
    return
  }

  m.setU32((pAiParam + 0x14) >>> 0, 0)
  const rollSprint = (stepSeed64At113c(m, pSeed) >>> 0) % 100
  const nDiff = m.u8((game + 0x6d) >>> 0)
  if ((rollSprint | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0))) {
    if (velBonus < -126 || velBonus > 126) {
      throw new D2CommonAssertError('AiThink.cpp', 0x110)
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    if (velBonus !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, velBonus >>> 0)
    aiApproachTarget6FD12540(m, game, u, pTarget, 0x0f, 0, 0, 1, 0, hooks)
    return
  }
  aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
}

/**
 * [13/45] Three-phase melee/retreat skirmisher AI (`0x6FCA00C0`): processes AI command `1` or `14`,
 * then transitions across approach/attack (`0`), sustained melee until count `> aip3` and target life%
 * `> aip4` (`1`), and flee/strafe (`2`).
 *
 * @va D2Game:0x6FCA00C0
 */
export function AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA00C0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const pAiGen = getMonsterAiGeneralPtr113c(m, u)
  const pCmd = pAiGen !== 0 ? m.u32((pAiGen + 0x20) >>> 0) >>> 0 : 0
  if (pCmd !== 0) {
    let pCmdTarget = 0
    const cmdType = m.u32((pCmd + 0x08) >>> 0) | 0
    if (cmdType === 1) {
      pCmdTarget = SUNIT_GetServerUnit113c(
        m,
        game,
        m.u32((pCmd + 0x10) >>> 0) | 0,
        m.u32((pCmd + 0x0c) >>> 0) >>> 0,
      ) >>> 0
    }
    if (pCmdTarget === 0 && cmdType === 0x0e) {
      pCmdTarget = SUNIT_GetServerUnit113c(
        m,
        game,
        m.u32((pCmd + 0x10) >>> 0) | 0,
        m.u32((pCmd + 0x0c) >>> 0) >>> 0,
      ) >>> 0
    }
    if (pCmdTarget !== 0) {
      m.setU32((pAiParam + 0x14) >>> 0, 0)
      m.setU32((pAiParam + 0x18) >>> 0, 0)
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x18) >>> 0, 0x0d)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
      aiApproachTarget6FD12540(m, game, u, pCmdTarget, 2, 0, 0, 1, 0, hooks)
      AIGENERAL_PopAiCommand113c(m, u)
      return
    }
    AIGENERAL_PopAiCommand113c(m, u)
  }

  const targetLifePct = STATLIST_GetUnitLifePercent113c(m, pTarget) | 0
  const phase = m.u32((pAiParam + 0x14) >>> 0) | 0
  if (phase === 0) {
    if (bInMeleeRange !== 0) {
      m.setU32((pAiParam + 0x18) >>> 0, 0)
      m.setU32((pAiParam + 0x14) >>> 0, 1)
      const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if ((roll | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))) {
        AI_StartAttackMode113c(m, 4, u, game, pTarget, hooks?.world, hooks)
        return
      }
      const aip2 = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x5c) >>> 0))
      aiStall6FD122C0(m, game, u, aip2, hooks)
      return
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 0x0d)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
    return
  }

  if (phase === 1) {
    const cnt = ((m.u32((pAiParam + 0x18) >>> 0) | 0) + 1) | 0
    m.setU32((pAiParam + 0x18) >>> 0, cnt >>> 0)
    const nDiff = m.u8((game + 0x6d) >>> 0)
    const aip3 = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0))
    const aip4 = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0))
    if (cnt > aip3 && targetLifePct > aip4) {
      m.setU32((pAiParam + 0x14) >>> 0, 2)
      m.setU32((pAiParam + 0x18) >>> 0, 0)
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x18) >>> 0, 2)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
      aiFleeFrom6FD12D80(m, pTarget, game, u, 0x0e, 1, hooks)
      return
    }
    if (bInMeleeRange !== 0) {
      const nDiff2 = m.u8((game + 0x6d) >>> 0)
      const roll = rollSeedAt6FC21180(m, pSeed, 100) | 0
      if (roll < sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x56) >>> 0))) {
        AI_StartAttackMode113c(m, 4, u, game, pTarget, hooks?.world, hooks)
        return
      }
      const aip2 = sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x5c) >>> 0))
      aiStall6FD122C0(m, game, u, aip2, hooks)
      return
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 0x0d)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
    return
  }

  if (phase === 2) {
    if (nDist > 0x0c) {
      const cnt = ((m.u32((pAiParam + 0x18) >>> 0) | 0) + 1) | 0
      m.setU32((pAiParam + 0x18) >>> 0, cnt >>> 0)
      if (cnt > 1) {
        m.setU32((pAiParam + 0x14) >>> 0, 0)
        m.setU32((pAiParam + 0x18) >>> 0, 0)
      }
      if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x14) {
        AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
        return
      }
      aiStall6FD122C0(m, game, u, 10, hooks)
      return
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 2)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
    if (aiFleeFrom6FD12D80(m, pTarget, game, u, 0x0e, 1, hooks) !== 0) {
      return
    }
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    m.setU32((pAiParam + 0x18) >>> 0, 0)
  }

  aiStall6FD122C0(m, game, u, 10, hooks)
}

/**
 * [14/45] Multi-strike skill combo melee AI (`0x6FCA08A0`): approaches when out of melee range,
 * chains `aip6` consecutive `wSkill0` casts in `MONMODE_ATTACK2` (`5`) with `EVENT_GetNextEventFrame(1)`
 * timer adjustment (`aip5`), then cools down for `3` normal `A1`/`A2` attacks.
 *
 * @va D2Game:0x6FCA08A0
 */
export function AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA08A0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pSeed = (u + 0x20) >>> 0

  if (bInMeleeRange === 0 || pTarget === 0) {
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 0x0d)
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
    return
  }

  if ((m.u32((pAiParam + 0x14) >>> 0) | 0) > 0) {
    const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
    castSkillWithMode6FD12380(m, 5, u, game, wSkill0, pTarget, 0, 0, hooks)
    const nextEv = EVENT_GetNextEventFrame113c(m, u, 1) | 0
    const dwGameFrame = m.u32((game + 0xa8) >>> 0) | 0
    if (nextEv > dwGameFrame) {
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const aip5 = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))
      AI_ScheduleAiThinkTimer_6FD120C0_113c(m, game, u, (aip5 - dwGameFrame + nextEv) | 0)
    }
    const rem = ((m.u32((pAiParam + 0x14) >>> 0) | 0) - 1) | 0
    m.setU32((pAiParam + 0x14) >>> 0, rem >>> 0)
    if (rem <= 0) {
      m.setU32((pAiParam + 0x18) >>> 0, 3)
    }
    return
  }

  const roll0 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
  const nDiff0 = m.u8((game + 0x6d) >>> 0)
  if ((roll0 | 0) < sx16(m.u16((pMonStatsTxt + nDiff0 * 2 + 0x56) >>> 0))) {
    if ((m.u32((pAiParam + 0x18) >>> 0) | 0) <= 0) {
      const rollSkill = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const nDiffS = m.u8((game + 0x6d) >>> 0)
      if (rollSkill < sx16(m.u16((pMonStatsTxt + nDiffS * 2 + 0x68) >>> 0))) {
        const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
        castSkillWithMode6FD12380(m, 5, u, game, wSkill0, pTarget, 0, 0, hooks)
        const nextEv = EVENT_GetNextEventFrame113c(m, u, 1) | 0
        const dwGameFrame = m.u32((game + 0xa8) >>> 0) | 0
        if (nextEv > dwGameFrame) {
          const nDiffT = m.u8((game + 0x6d) >>> 0)
          const aip5 = sx16(m.u16((pMonStatsTxt + nDiffT * 2 + 0x6e) >>> 0))
          AI_ScheduleAiThinkTimer_6FD120C0_113c(m, game, u, (aip5 - dwGameFrame + nextEv) | 0)
        }
        const nDiffC = m.u8((game + 0x6d) >>> 0)
        const aip6 = sx16(m.u16((pMonStatsTxt + nDiffC * 2 + 0x74) >>> 0))
        m.setU32((pAiParam + 0x14) >>> 0, aip6 >>> 0)
        return
      }
    }
    m.setU32((pAiParam + 0x18) >>> 0, ((m.u32((pAiParam + 0x18) >>> 0) | 0) - 1) >>> 0)
    const rollMode = rollSeedAt6FC21180(m, pSeed, 100) | 0
    const nDiffM = m.u8((game + 0x6d) >>> 0)
    const mode = rollMode < sx16(m.u16((pMonStatsTxt + nDiffM * 2 + 0x5c) >>> 0)) ? 5 : 4
    AI_StartAttackMode113c(m, mode, u, game, pTarget, hooks?.world, hooks)
    return
  }

  const rollStrafe = rollSeedAt6FC21180(m, pSeed, 100) | 0
  const nDiffSt = m.u8((game + 0x6d) >>> 0)
  if (rollStrafe < sx16(m.u16((pMonStatsTxt + nDiffSt * 2 + 0x62) >>> 0))) {
    AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
    return
  }
  aiStall6FD122C0(m, game, u, 0x0f, hooks)
}

function callApproachPathType13_6FD13000(
  m: D2KernMemory113c,
  pUnit: number,
  pTarget: number,
  pGame: number,
  dwFlags: number,
  hooks?: K2W6B3Hooks113c | undefined,
): number {
  const w2b8Hooks =
    hooks !== undefined && (hooks.onMonsterStartMode !== undefined || hooks.world !== undefined)
      ? {
          onMonsterStartMode: (mem: D2KernMemory113c, g: number, sp: number, bUpd: number) =>
            dispatchMonsterStartMode6FC95E10(mem, g, sp, bUpd, hooks),
        }
      : undefined
  return AI_ApproachTargetPathType13_6FD13000_113c(m, pUnit, pTarget, pGame, dwFlags, w2b8Hooks)
}

/**
 * [15/45] Low-life self-buff/retreat skirmisher AI (`0x6FCA0B00`): switches into retreat mode (`1`)
 * when life% `< aip5` (casting `wSkill0` if state `0x16` is inactive), recovers above `75%` life,
 * and approaches via path-type `13` (`0x6FD13000`) or serpentine `5`/`6`.
 *
 * @va D2Game:0x6FCA0B00
 */
export function AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA0B00)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0
  const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0

  if ((m.u32((pAiParam + 0x14) >>> 0) | 0) === 1) {
    m.setU32((pAiParam + 0x18) >>> 0, 0)
    if (lifePct > 0x4b) {
      m.setU32((pAiParam + 0x14) >>> 0, 0)
      const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if ((roll | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0))) {
        m.setU32((pAiParam + 0x14) >>> 0, 2)
        callApproachPathType13_6FD13000(m, u, pTarget, game, 0, hooks)
        return
      }
      const raw = stepSeed64At113c(m, pSeed) >>> 0
      const pathType = (raw & 0xff) < 0x80 ? 5 : 6
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x18) >>> 0, pathType)
      m.setU8((pAiCtrl + 0x20) >>> 0, 6)
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
      return
    }

    if (bInMeleeRange !== 0) {
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0)) > 0x19) {
        const roll = rollSeedAt6FC21180(m, pSeed, 100) | 0
        const nDiff2 = m.u8((game + 0x6d) >>> 0)
        if (roll < (sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x56) >>> 0)) - 0x19)) {
          AI_StartAttackMode113c(m, 4, u, game, pTarget, hooks?.world, hooks)
          return
        }
      }
    }

    const nDiffF = m.u8((game + 0x6d) >>> 0)
    if (
      nDist >= sx16(m.u16((pMonStatsTxt + nDiffF * 2 + 0x68) >>> 0)) &&
      MONSTER_HasAlwaysChaseFlag113c(m, u) === 0
    ) {
      m.setU32((pAiParam + 0x14) >>> 0, 0)
      AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 0x0c, hooks)
      return
    }
    aiFleeFrom6FD12D80(m, pTarget, game, u, 4, 0, hooks)
    return
  }

  if (bInMeleeRange !== 0) {
    m.setU32((pAiParam + 0x14) >>> 0, 2)
    const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((roll | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))) {
      SKILLS_SetUsedSkillMemPort113c(m, u, 0)
      const sp = (k2W6B3StackPtr - 0x20) >>> 0
      k2W6B3StackPtr = sp
      try {
        m.fill(sp, 0x20, 0)
        m.setU32(sp, 4)
        m.setU32((sp + 0x04) >>> 0, u)
        m.setU32((sp + 0x08) >>> 0, pTarget)
        let speedByte = 0x64
        if (u !== 0) {
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
          if (pMonStats2 !== 0 && (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) !== 0) {
            speedByte = 0x65
          }
        }
        m.setU8((sp + 0x15) >>> 0, speedByte)
        dispatchMonsterStartMode6FC95E10(m, game, sp, 1, hooks)
      } finally {
        k2W6B3StackPtr = (sp + 0x20) >>> 0
      }
      return
    }
    if (lifePct < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))) {
      m.setU32((pAiParam + 0x14) >>> 0, 1)
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      if (wSkill0 >= 0 && STATES_CheckState113c(m, u, 0x16) === 0) {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x180) >>> 0), u, game, wSkill0, 0, 0, 0, hooks)
        return
      }
      aiFleeFrom6FD12D80(m, pTarget, game, u, 8, 0, hooks)
      return
    }
    const rollStrafe = rollSeedAt6FC21180(m, pSeed, 100) | 0
    const nDiff2 = m.u8((game + 0x6d) >>> 0)
    if (rollStrafe < sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x5c) >>> 0))) {
      AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
      return
    }
    aiStall6FD122C0(m, game, u, 0x0f, hooks)
    return
  }

  let forceChase = false
  if (u !== 0 && (m.u32(u) | 0) === 1) {
    const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const aiState = m.u32((pMonData + 0x54) >>> 0) | 0
      if (aiState === 3 || aiState === 0x13) forceChase = true
    }
  }
  if (forceChase || (m.u32((pAiParam + 0x18) >>> 0) | 0) === 1) {
    m.setU32((pAiParam + 0x18) >>> 0, 1)
    callApproachPathType13_6FD13000(m, u, pTarget, game, 0, hooks)
    return
  }

  const nextCnt = ((m.u32((pAiParam + 0x1c) >>> 0) | 0) + 1) | 0
  m.setU32((pAiParam + 0x1c) >>> 0, nextCnt > 0x14 ? 0 : (nextCnt >>> 0))
  const isFirstTick = (m.u32((pAiParam + 0x1c) >>> 0) | 0) === 1
  m.setU32((pAiParam + 0x18) >>> 0, 0)
  if (isFirstTick) {
    const rollChase = rollSeedAt6FC21180(m, pSeed, 100) | 0
    const nDiffC = m.u8((game + 0x6d) >>> 0)
    if (rollChase < sx16(m.u16((pMonStatsTxt + nDiffC * 2 + 0x62) >>> 0))) {
      m.setU32((pAiParam + 0x18) >>> 0, 1)
      callApproachPathType13_6FD13000(m, u, pTarget, game, 0, hooks)
      return
    }
  }
  if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x14) {
    aiIdleWander6FD11B10(m, game, u, 6, hooks)
    return
  }
  aiStall6FD122C0(m, game, u, 0x0f, hooks)
}

/**
 * [16/45] Pack-leader command-1 melee/skill AI (`0x6FCA20D0`): pack leader broadcasts command `1`
 * when within `20` subtiles (`< aip5%`), executes `wSkill0` or walks at `+100%` velocity on command `1`,
 * and alternates `A1`/`A2`/`wSkill0` with circle-strafing (`dist = 0`) and approach (`step = 4`).
 *
 * @va D2Game:0x6FCA20D0
 */
export function AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA20D0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const pAiGen = getMonsterAiGeneralPtr113c(m, u)
  let pCmd = pAiGen !== 0 ? m.u32((pAiGen + 0x20) >>> 0) >>> 0 : 0
  let cmdType1Active = false
  if (pCmd !== 0) {
    cmdType1Active = (m.u32((pCmd + 0x08) >>> 0) | 0) === 1
  } else if (nDist < 0x14) {
    let pLeader = 0
    if (pAiGen !== 0 && m.u32((pAiGen + 0x28) >>> 0) !== 0) {
      pLeader = SUNIT_GetServerUnit113c(
        m,
        game,
        m.u32((pAiGen + 0x30) >>> 0) | 0,
        m.u32((pAiGen + 0x2c) >>> 0) >>> 0,
      ) >>> 0
    }
    if (pLeader === u) {
      const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if ((roll | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))) {
        const spCmd = (k2W6B3StackPtr - 0x20) >>> 0
        k2W6B3StackPtr = spCmd
        try {
          m.fill(spCmd, 0x20, 0)
          m.setU32((spCmd + 0x08) >>> 0, 1)
          AIGENERAL_BroadcastCmdToMinions113c(m, u, game, spCmd)
          pCmd = AIGENERAL_CopyAiCommandParams113c(m, u, 1, 0, 0, 0, 0) >>> 0
          cmdType1Active = true
        } finally {
          k2W6B3StackPtr = (spCmd + 0x20) >>> 0
        }
      }
    }
  }

  if (cmdType1Active) {
    if (bInMeleeRange !== 0 && sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)) >= 0) {
      AIGENERAL_PopAiCommand113c(m, u)
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x180) >>> 0), u, game, wSkill0, pTarget, 0, 0, hooks)
      return
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 2)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x64)
    if (aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks) === 0) {
      AIGENERAL_PopAiCommand113c(m, u)
    }
    return
  }

  if (bInMeleeRange !== 0) {
    const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((roll | 0) < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))) {
      if (sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)) >= 0) {
        const rollSk = rollSeedAt6FC21180(m, pSeed, 100) | 0
        const nDiffS = m.u8((game + 0x6d) >>> 0)
        if (rollSk < sx16(m.u16((pMonStatsTxt + nDiffS * 2 + 0x68) >>> 0))) {
          const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
          castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x180) >>> 0), u, game, wSkill0, pTarget, 0, 0, hooks)
          return
        }
      }
      const rollMode = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      const nDiffM = m.u8((game + 0x6d) >>> 0)
      const mode = (rollMode | 0) < sx16(m.u16((pMonStatsTxt + nDiffM * 2 + 0x5c) >>> 0)) ? 4 : 5
      AI_StartAttackMode113c(m, mode, u, game, pTarget, hooks?.world, hooks)
      return
    }
    aiStall6FD122C0(m, game, u, sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0)), hooks)
    return
  }

  if (m.u32((pAiParam + 0x14) >>> 0) === 0) {
    AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 0, hooks)
    m.setU32((pAiParam + 0x14) >>> 0, 1)
    return
  }
  const pAiCtrl = getMonsterAiControlPtr113c(m, u)
  m.setU32((pAiCtrl + 0x18) >>> 0, 2)
  m.setU8((pAiCtrl + 0x20) >>> 0, 4)
  aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
  if ((((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0) > 10) {
    m.setU32((pAiParam + 0x14) >>> 0, 0)
  }
}

/**
 * [17/45]Hp-regen boost retreat/chase AI (`0x6FCA2990`): boosts `STAT_HPREGEN` (`0x4A`) by
 * `(curRegen * aip5) / 8` when injured (`life% < aip1`) in chase states `3`/`19`, flees with
 * run-velocity bonus, and restores `STAT_HPREGEN` once timer expires or `life% > 75`.
 *
 * @va D2Game:0x6FCA2990
 */
export function AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA2990)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pSeed = (u + 0x20) >>> 0
  const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0

  let velBonus = 0
  const wBaseVel = sx16(m.u16((pMonStatsTxt + 0x32) >>> 0))
  if (wBaseVel > 0) {
    const q = sdiv32(imul32(sx16(m.u16((pMonStatsTxt + 0x34) >>> 0)), 100), wBaseVel)
    if (q >= 100) {
      velBonus = (q - 100) | 0
      if (velBonus > 0x78) velBonus = 0x78
    }
  }

  let hasChaseState = false
  if (u !== 0 && (m.u32(u) | 0) === 1) {
    const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const aiState = m.u32((pMonData + 0x54) >>> 0) | 0
      hasChaseState = aiState === 3 || aiState === 0x13
    }
  }

  const retreatTicks = m.u32((pAiParam + 0x14) >>> 0) | 0
  if (retreatTicks !== 0) {
    const nextTicks = (retreatTicks - 1) | 0
    m.setU32((pAiParam + 0x18) >>> 0, 0)
    m.setU32((pAiParam + 0x14) >>> 0, nextTicks >>> 0)
    if (nextTicks === 0 || lifePct > 0x4b) {
      const curRegen = STATLIST_GetUnitStat113c(m, u, 0x4a, 0) | 0
      const savedBonus = m.u32((pAiParam + 0x1c) >>> 0) | 0
      STATLIST_SetUnitStat113c(m, u, 0x4a, (curRegen - savedBonus) | 0, 0)
    }
    if (bInMeleeRange === 0) {
      if (lifePct > 0x4b) {
        m.setU32((pAiParam + 0x14) >>> 0, 0)
        if (velBonus < -126 || velBonus > 126) throw new D2CommonAssertError('AiThink.cpp', 0x110)
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        m.setU32((pAiCtrl + 0x18) >>> 0, 0x0d)
        if (velBonus !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, velBonus >>> 0)
        callApproachPathType13_6FD13000(m, u, pTarget, game, 7, hooks)
        return
      }
    } else if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x21) {
      const rollM = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const mode = rollM < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0)) ? 4 : 5
      AI_StartAttackMode113c(m, mode, u, game, pTarget, hooks?.world, hooks)
      return
    }

    if (nDist >= 0x18 && !hasChaseState) {
      if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x21) {
        AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
      }
      aiStall6FD122C0(m, game, u, 0x14, hooks)
      return
    }
    if (velBonus < -126 || velBonus > 126) throw new D2CommonAssertError('AiThink.cpp', 0x110)
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 2)
    if (velBonus !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, velBonus >>> 0)
    if (aiFleeFrom6FD12D80(m, pTarget, game, u, 0x0f, 1, hooks) !== 0) return
    if (bInMeleeRange !== 0) {
      const rollM = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const nDiffM = m.u8((game + 0x6d) >>> 0)
      const mode = rollM < sx16(m.u16((pMonStatsTxt + nDiffM * 2 + 0x68) >>> 0)) ? 4 : 5
      AI_StartAttackMode113c(m, mode, u, game, pTarget, hooks?.world, hooks)
      return
    }
    aiIdleWander6FD11B10(m, game, u, 5, hooks)
    return
  }

  if (bInMeleeRange === 0) {
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 0x0d)
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
    return
  }

  if (hasChaseState) {
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if (
      lifePct < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0)) &&
      (rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x32
    ) {
      const ticks = ((rollSeedAt6FC21180(m, pSeed, 5) | 0) + 2) | 0
      m.setU32((pAiParam + 0x14) >>> 0, ticks >>> 0)
      const curRegen = STATLIST_GetUnitStat113c(m, u, 0x4a, 0) | 0
      if (curRegen !== 0) {
        const nDiffR = m.u8((game + 0x6d) >>> 0)
        const prod = imul32(sx16(m.u16((pMonStatsTxt + nDiffR * 2 + 0x6e) >>> 0)), curRegen)
        const bonus = (prod + (prod < 0 ? 7 : 0)) >> 3
        m.setU32((pAiParam + 0x1c) >>> 0, bonus >>> 0)
        STATLIST_SetUnitStat113c(m, u, 0x4a, (bonus + curRegen) | 0, 0)
      } else {
        m.setU32((pAiParam + 0x1c) >>> 0, 0)
      }
      if (velBonus < -126 || velBonus > 126) throw new D2CommonAssertError('AiThink.cpp', 0x110)
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x18) >>> 0, 2)
      if (velBonus !== 0) m.setU32((pAiCtrl + 0x1c) >>> 0, velBonus >>> 0)
      aiFleeFrom6FD12D80(m, pTarget, game, u, 0x0f, 0, hooks)
      return
    }
    if (m.u32((pAiParam + 0x18) >>> 0) !== 0 && (rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x14) {
      AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 3, hooks)
      m.setU32((pAiParam + 0x18) >>> 0, 0)
      return
    }
  }

  if (m.u32((pAiParam + 0x18) >>> 0) !== 0) {
    const rollIdle = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiffI = m.u8((game + 0x6d) >>> 0)
    if ((rollIdle | 0) >= sx16(m.u16((pMonStatsTxt + nDiffI * 2 + 0x62) >>> 0))) {
      const rollStr = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const nDiffS = m.u8((game + 0x6d) >>> 0)
      if (rollStr < sx16(m.u16((pMonStatsTxt + nDiffS * 2 + 0x5c) >>> 0))) {
        AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 3, hooks)
        m.setU32((pAiParam + 0x18) >>> 0, 0)
      }
      aiStall6FD122C0(m, game, u, 0x0f, hooks)
      return
    }
  }

  m.setU32((pAiParam + 0x18) >>> 0, 1)
  const rollAtk = (stepSeed64At113c(m, pSeed) >>> 0) % 100
  const nDiffA = m.u8((game + 0x6d) >>> 0)
  const mode = (rollAtk | 0) < sx16(m.u16((pMonStatsTxt + nDiffA * 2 + 0x68) >>> 0)) ? 4 : 5
  AI_StartAttackMode113c(m, mode, u, game, pTarget, hooks?.world, hooks)
}

/**
 * [18/45] Charge-up state/icon melee caster AI (`0x6FCA4A90`): counts charge ticks in `pAiParam+0x14`,
 * displays skill icon (`0x96` or `0x2E`) on tick `aip5`, toggles gfx state `0x5A`/`0x5B` past `aip5`,
 * regroups toward closest evil monster (`0x6FC9B9F0`) when low life, and unleashes `wSkill0` in melee.
 *
 * @va D2Game:0x6FCA4A90
 */
export function AI_ThinkChargeStateIconMelee_6FCA4A90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA4A90)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  if (m.u32((pAiParam + 0x14) >>> 0) === 0) {
    STATES_ToggleGfxStateFlag113c(m, u, 0x5a, 0)
    STATES_ToggleGfxStateFlag113c(m, u, 0x5b, 0)
    m.setU32((pAiParam + 0x18) >>> 0, 0)
  }

  const ticks = ((m.u32((pAiParam + 0x14) >>> 0) | 0) + 1) | 0
  m.setU32((pAiParam + 0x14) >>> 0, ticks >>> 0)
  const nDiff0 = m.u8((game + 0x6d) >>> 0)
  const aip5 = sx16(m.u16((pMonStatsTxt + nDiff0 * 2 + 0x6e) >>> 0))
  if (ticks === aip5) {
    const nDiffI = m.u8((game + 0x6d) >>> 0)
    const aip6 = sx16(m.u16((pMonStatsTxt + nDiffI * 2 + 0x74) >>> 0))
    STATES_SetMonsterSkillIconOnUnit113c(m, u, aip6 === 1 ? 0x96 : 0x2e, 0)
    const nDiffD = m.u8((game + 0x6d) >>> 0)
    const delay = (m.u8((pMonStatsTxt + nDiffD + 0x4f) >>> 0) + 1) | 0
    aiStall6FD122C0(m, game, u, delay, hooks)
    return
  }
  if (ticks > aip5) {
    const nDiffG = m.u8((game + 0x6d) >>> 0)
    const aip6 = sx16(m.u16((pMonStatsTxt + nDiffG * 2 + 0x74) >>> 0))
    STATES_ToggleGfxStateFlag113c(m, u, aip6 === 1 ? 0x5a : 0x5b, 1)
    m.setU32((pAiParam + 0x18) >>> 0, 1)
  }

  if ((m.u32((pAiParam + 0x1c) >>> 0) | 0) < 7) {
    const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0
    const nDiffL = m.u8((game + 0x6d) >>> 0)
    if (lifePct < sx16(m.u16((pMonStatsTxt + nDiffL * 2 + 0x56) >>> 0))) {
      const spCtx = (k2W6B3StackPtr - 0x08) >>> 0
      k2W6B3StackPtr = spCtx
      let pAlly = 0
      try {
        m.setU32(spCtx, 0)
        m.setU32((spCtx + 4) >>> 0, 0x7fffffff)
        scanUnitsByModeWithCb113c(m, 1, spCtx, game, u, 0x6fc9b9f0)
        pAlly = m.u32(spCtx) >>> 0
      } finally {
        k2W6B3StackPtr = (spCtx + 0x08) >>> 0
      }
      if (pAlly !== 0) {
        aiApproachTarget6FD12540(m, game, u, pAlly, 2, 0, 0, 1, 0, hooks)
        return
      }
      m.setU32((pAiParam + 0x1c) >>> 0, ((m.u32((pAiParam + 0x1c) >>> 0) | 0) + 1) >>> 0)
    }
  }

  if (nDist > 4 && m.u32((pAiParam + 0x18) >>> 0) === 0) {
    const rollS = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiffS = m.u8((game + 0x6d) >>> 0)
    if ((rollS | 0) < sx16(m.u16((pMonStatsTxt + nDiffS * 2 + 0x5c) >>> 0))) {
      AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 0, hooks)
      return
    }
  }

  const charged = m.u32((pAiParam + 0x18) >>> 0) | 0
  let nDiffStall = 0
  if (bInMeleeRange !== 0) {
    if (charged === 1) {
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      if (wSkill0 >= 0) {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x180) >>> 0), u, game, wSkill0, pTarget, 0, 0, hooks)
        m.setU32((pAiParam + 0x14) >>> 0, 0)
        m.setU32((pAiParam + 0x18) >>> 0, 0)
        return
      }
    }
    const rollAtk = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    nDiffStall = m.u8((game + 0x6d) >>> 0)
    if ((rollAtk | 0) < sx16(m.u16((pMonStatsTxt + nDiffStall * 2 + 0x62) >>> 0))) {
      const rollM = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const nDiffM = m.u8((game + 0x6d) >>> 0)
      const mode = rollM < sx16(m.u16((pMonStatsTxt + nDiffM * 2 + 0x7a) >>> 0)) ? 5 : 4
      AI_StartAttackMode113c(m, mode, u, game, pTarget, hooks?.world, hooks)
      return
    }
  } else {
    if (charged !== 0) {
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
      return
    }
    const rollMove = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    nDiffStall = m.u8((game + 0x6d) >>> 0)
    if ((rollMove | 0) < sx16(m.u16((pMonStatsTxt + nDiffStall * 2 + 0x68) >>> 0))) {
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
      return
    }
  }

  const aip5Stall = sx16(m.u16((pMonStatsTxt + nDiffStall * 2 + 0x6e) >>> 0))
  let extra = (0x18 - aip5Stall) | 0
  if (extra < 6) extra = 6
  if ((m.u32((pAiParam + 0x14) >>> 0) | 0) > ((aip5Stall + extra) | 0)) {
    m.setU32((pAiParam + 0x14) >>> 0, 0)
    m.setU32((pAiParam + 0x18) >>> 0, 0)
  }
  aiStall6FD122C0(m, game, u, 0x0f, hooks)
}

/**
 * [19/45] Oblivion Knight / escort caster AI (`0x6FCA4DB0`): scans for nearest `hcIdx == 136` escort
 * (`0x6FC9BA40`), applies curse `wSkill3` if `wAuraTargetState` absent, retreats behind escort or flees
 * when `< aip1`, and casts `wSkill5`/`wSkill2`/`wSkill0` at target or blocking obstacle (`0x6FCD1BC0`).
 *
 * @va D2Game:0x6FCA4DB0
 */
export function AI_ThinkOblivionKnightCaster_6FCA4DB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA4DB0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const spCtx = (k2W6B3StackPtr - 0x18) >>> 0
  k2W6B3StackPtr = spCtx
  let pEscort = 0
  try {
    m.setU32(spCtx, 0)
    m.setU32((spCtx + 0x04) >>> 0, 0)
    m.setU32((spCtx + 0x08) >>> 0, 0x9c4)
    m.setU32((spCtx + 0x0c) >>> 0, 0x7fffffff)
    m.setU32((spCtx + 0x10) >>> 0, 0x7fffffff)
    scanUnitsByModeWithCb113c(m, 1, spCtx, game, u, 0x6fc9ba40)
    pEscort = m.u32(spCtx) >>> 0
  } finally {
    k2W6B3StackPtr = (spCtx + 0x18) >>> 0
  }

  const nDiff0 = m.u8((game + 0x6d) >>> 0)
  if (nDist < sx16(m.u16((pMonStatsTxt + nDiff0 * 2 + 0x56) >>> 0))) {
    const wSkill3 = sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
    if (wSkill3 > 0) {
      const pDataTables = getDataTablesPtr113c(m)
      if (pDataTables !== 0 && wSkill3 < (m.u32((pDataTables + 0xba0) >>> 0) | 0)) {
        const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
        const pSkillTxt = (pSkillsBase + imul32(wSkill3, 0x23c)) >>> 0
        if (pSkillTxt !== 0) {
          const wState = sx16(m.u16((pSkillTxt + 0x82) >>> 0))
          if (wState > 0 && STATES_CheckState113c(m, pTarget, wState) === 0) {
            castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x183) >>> 0), u, game, wSkill3, pTarget, 0, 0, hooks)
            const nDiffC = m.u8((game + 0x6d) >>> 0)
            const cd = sx16(m.u16((pMonStatsTxt + nDiffC * 2 + 0x62) >>> 0))
            m.setU32((pAiParam + 0x14) >>> 0, ((m.u32((game + 0xa8) >>> 0) | 0) + cd) >>> 0)
            return
          }
        }
      }
    }
    if (pEscort !== 0 && (UNIT_CalcSqDistSubtiles113c(m, pEscort, pTarget) | 0) > imul32(nDist, nDist)) {
      if (aiApproachTarget6FD12540(m, game, u, pEscort, 2, 0, 0, 1, 4, hooks) !== 0) return
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 2)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
    if (aiFleeFrom6FD12D80(m, pTarget, game, u, 10, 1, hooks) !== 0) return
    const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
    if (wSkill2 >= 0) {
      castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x182) >>> 0), u, game, wSkill2, pTarget, 0, 0, hooks)
      return
    }
  }

  const spDist = (k2W6B3StackPtr - 0x08) >>> 0
  k2W6B3StackPtr = spDist
  let pObs = 0
  let obsDist = 0
  try {
    m.setU32(spDist, 0)
    pObs = MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, spDist) >>> 0
    obsDist = m.u32(spDist) | 0
  } finally {
    k2W6B3StackPtr = (spDist + 0x08) >>> 0
  }

  if (pObs !== 0 && obsDist < sx16(m.u16((pMonStatsTxt + m.u8((game + 0x6d) >>> 0) * 2 + 0x5c) >>> 0))) {
    const wSkill5 = sx16(m.u16((pMonStatsTxt + 0x17a) >>> 0))
    if (
      wSkill5 > 0 &&
      (m.u32((game + 0xa8) >>> 0) | 0) > (m.u32((pAiParam + 0x14) >>> 0) | 0) &&
      (rollSeedAt6FC21180(m, pSeed, 100) | 0) < sx16(m.u16((pMonStatsTxt + m.u8((game + 0x6d) >>> 0) * 2 + 0x68) >>> 0))
    ) {
      castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x185) >>> 0), u, game, wSkill5, pTarget, 0, 0, hooks)
      const cd = sx16(m.u16((pMonStatsTxt + m.u8((game + 0x6d) >>> 0) * 2 + 0x62) >>> 0))
      m.setU32((pAiParam + 0x14) >>> 0, ((m.u32((game + 0xa8) >>> 0) | 0) + cd) >>> 0)
      return
    }
    const rollCast = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    if ((rollCast | 0) < sx16(m.u16((pMonStatsTxt + m.u8((game + 0x6d) >>> 0) * 2 + 0x6e) >>> 0))) {
      const wSkill2 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
      if (
        wSkill2 >= 0 &&
        (rollSeedAt6FC21180(m, pSeed, 100) | 0) < sx16(m.u16((pMonStatsTxt + m.u8((game + 0x6d) >>> 0) * 2 + 0x74) >>> 0))
      ) {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x182) >>> 0), u, game, wSkill2, pObs, 0, 0, hooks)
        return
      }
      const wSkill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      if (wSkill0 >= 0) {
        const pMonData = u !== 0 && (m.u32(u) | 0) === 1 ? m.u32((u + 0x14) >>> 0) >>> 0 : 0
        if (pMonData === 0 || m.u8((pMonData + 0x0e) >>> 0) < 4) {
          castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x180) >>> 0), u, game, wSkill0, pObs, 0, 0, hooks)
          return
        }
      }
    }
  }

  if (nDist > sx16(m.u16((pMonStatsTxt + m.u8((game + 0x6d) >>> 0) * 2 + 0x80) >>> 0))) {
    const rollW = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    if ((rollW | 0) < sx16(m.u16((pMonStatsTxt + m.u8((game + 0x6d) >>> 0) * 2 + 0x7a) >>> 0))) {
      AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pTarget, 6, game, u, hooks)
      return
    }
  }

  if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x46) {
    const raw = stepSeed64At113c(m, pSeed) >>> 0
    const pathType = (raw & 0xff) < 0x80 ? 5 : 6
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, pathType)
    m.setU8((pAiCtrl + 0x20) >>> 0, 3)
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
    return
  }
  aiStall6FD122C0(m, game, u, 10, hooks)
}

function aiMaintainIdealDist6FD11D90(
  m: D2KernMemory113c,
  pTarget: number,
  nMaxStep: number,
  pGame: number,
  pUnit: number,
  nMode: number,
  nIdealDist: number,
  hooks?: K2W6B3Hooks113c | undefined,
): number {
  const curDist = AI_CalcApproxUnitDistSubtiles113c(m, pUnit >>> 0, pTarget >>> 0) | 0
  const dirSign = curDist < (nIdealDist | 0) ? -1 : 1
  let stepDist = (curDist - (nIdealDist | 0)) | 0
  if (stepDist < 0) stepDist = (-stepDist) | 0
  if (stepDist > (nMaxStep | 0)) stepDist = nMaxStep | 0
  if (hooks !== undefined && hooks.townNpc !== undefined) {
    return AI_StepRelativeToTargetUnit113c(
      m,
      pGame >>> 0,
      pUnit >>> 0,
      pTarget >>> 0,
      stepDist,
      dirSign > 0 ? 1 : 0,
      hooks.townNpc,
    )
  }
  hitD2GameVa113c(0x6FD11D90)
  const tx = getUnitXInline113c(m, pTarget)
  const ty = getUnitYInline113c(m, pTarget)
  const ux = getUnitXInline113c(m, pUnit)
  const uy = getUnitYInline113c(m, pUnit)
  let absDx = (tx - ux) | 0
  if (absDx < 0) absDx = (-absDx) | 0
  let absDy = (ty - uy) | 0
  if (absDy < 0) absDy = (-absDy) | 0
  let denom = (absDx + absDy) | 0
  if (denom < stepDist) denom = stepDist
  let stepX = 0
  let stepY = 0
  if (denom > 0) {
    stepX = sdiv32(imul32(absDx, stepDist), denom)
    stepY = sdiv32(imul32(absDy, stepDist), denom)
    while (((stepX + stepY) | 0) < stepDist) {
      stepX = (stepX + 1) | 0
      stepY = (stepY + 1) | 0
    }
  }
  let sx = 0
  if (tx > ux) sx = 1
  else if (tx < ux) sx = -1
  let sy = 0
  if (ty > uy) sy = 1
  else if (ty < uy) sy = -1

  const sp = (k2W6B3StackPtr - 0x20) >>> 0
  k2W6B3StackPtr = sp
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, nMode | 0)
    PATH_SetStepNum113c(m, m.u32(((pUnit >>> 0) + 0x2c) >>> 0), 1)
    m.setU32((sp + 0x0c) >>> 0, (ux + imul32(imul32(sx, stepX), dirSign)) >>> 0)
    m.setU32((sp + 0x10) >>> 0, (uy + imul32(imul32(sy, stepY), dirSign)) >>> 0)
    return dispatchMonsterStartMode6FC95E10(m, pGame >>> 0, sp, 1, hooks)
  } finally {
    k2W6B3StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * [20/45] Mephisto boss multi-phase AI (`0x6FCA5B60`): dispatches 5 state-machine actions (`0..4`),
 * re-evaluates hostile targets via `0x6FCA4720`, checks collision (`0x6FD814A0`) for long-range blizzard/orb
 * (`wSkill5`), cycles `wSkill4`/`wSkill3`/`wSkill1`/`wSkill0`, and maintains distance via `0x6FD11D90`.
 *
 * @va D2Game:0x6FCA5B60
 */
export function AI_ThinkMephistoBoss_6FCA5B60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA5B60)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const bInMeleeRange = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  let pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0
  let missingFifth = sdiv32((100 - lifePct) | 0, 5)
  if (missingFifth < 0) missingFifth = 0
  let nextAction = m.u32((pAiParam + 0x1c) >>> 0) | 0

  const runDefaultFallback = (): void => {
    const roll1 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    nextAction = 0
    if ((roll1 | 0) >= 0x41) {
      aiStall6FD122C0(m, game, u, 10, hooks)
      m.setU32((pAiParam + 0x1c) >>> 0, 0)
      return
    }
    const roll2 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    if ((roll2 | 0) >= 0x41 && nDist <= 5) {
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU8((pAiCtrl + 0x20) >>> 0, 4)
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
      m.setU32((pAiParam + 0x1c) >>> 0, 0)
      return
    }
    const raw = stepSeed64At113c(m, pSeed) >>> 0
    const pathType = (raw & 0xff) >= 0x80 ? 6 : 5
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, pathType)
    m.setU8((pAiCtrl + 0x20) >>> 0, 4)
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
    m.setU32((pAiParam + 0x1c) >>> 0, 0)
  }

  if (bInMeleeRange !== 0) {
    const roll = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const nDiff = m.u8((game + 0x6d) >>> 0)
    if ((roll | 0) <= sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))) {
      const rem3 = (stepSeed64At113c(m, pSeed) >>> 0) % 3
      nextAction = 2
      m.setU32((pAiParam + 0x14) >>> 0, (rem3 + 3) >>> 0)
    } else {
      nextAction = 3
    }
  } else if (nDist > 0x14) {
    nextAction = 4
  } else if (nextAction !== 0) {
    if ((nextAction >>> 0) > 4) {
      runDefaultFallback()
      return
    }
  } else {
    let picked = false
    if (lifePct <= 0x14 && nDist < 5) {
      if (((stepSeed64At113c(m, pSeed) >>> 0) % 100) < 0x28) {
        nextAction = 1
        picked = true
      }
    }
    if (!picked) {
      const rollCast = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      if ((rollCast | 0) < ((missingFifth + 0x32) | 0)) {
        const rem3 = (stepSeed64At113c(m, pSeed) >>> 0) % 3
        nextAction = 2
        m.setU32((pAiParam + 0x14) >>> 0, (rem3 + 3) >>> 0)
      } else {
        runDefaultFallback()
        return
      }
    }
  }

  if (nextAction === 0) {
    aiStall6FD122C0(m, game, u, 5, hooks)
    m.setU32((pAiParam + 0x1c) >>> 0, 4)
    return
  }
  if (nextAction === 1) {
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
    if (aiFleeFrom6FD12D80(m, pTarget, game, u, 8, 1, hooks) === 0 && bInMeleeRange !== 0) {
      castSkillWithMode6FD12380(
        m,
        m.u8((pMonStatsTxt + 0x182) >>> 0),
        u,
        game,
        sx16(m.u16((pMonStatsTxt + 0x174) >>> 0)),
        pTarget,
        0,
        0,
        hooks,
      )
    }
    m.setU32((pAiParam + 0x1c) >>> 0, 0)
    return
  }
  if (nextAction === 2) {
    const rem = ((m.u32((pAiParam + 0x14) >>> 0) | 0) - 1) | 0
    m.setU32((pAiParam + 0x14) >>> 0, rem >>> 0)
    if (rem === 0) nextAction = 0
    const cur18 = m.u32((pAiParam + 0x18) >>> 0) | 0
    if (cur18 === 0) {
      m.setU32((pAiParam + 0x18) >>> 0, 2)
      if (AI_CircleStrafeTarget_6FD126B0_113c(m, u, 1, game, pTarget, 3, hooks) === 0) {
        aiIdleWander6FD11B10(m, game, u, 0x0c, hooks)
      }
      m.setU32((pAiParam + 0x1c) >>> 0, nextAction >>> 0)
      return
    }
    m.setU32((pAiParam + 0x18) >>> 0, (cur18 + 1) >>> 0)
    pTarget = AI_SelectHostileTargetByMetrics_6FCA4720_113c(m, game, u, pMonStatsTxt, pTarget) >>> 0
    let skillCount = 0
    for (let i = 0; i < 8; i = (i + 1) | 0) {
      if (sx16(m.u16((pMonStatsTxt + 0x170 + i * 2) >>> 0)) < 0) break
      skillCount = (skillCount + 1) | 0
    }
    if (skillCount > 0) {
      const slice = sdiv32(100, skillCount)
      const rollPct = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const blocked =
        m.u8((game + 0x6d) >>> 0) > 0 &&
        pTarget !== 0 &&
        UNITS_HasCollisionBetweenUnits113c(m, u, pTarget, 4) !== 0
      const nDiff2 = m.u8((game + 0x6d) >>> 0)
      if (nDiff2 > 0 && (blocked || nDist > 0x1e)) {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x185) >>> 0), u, game, sx16(m.u16((pMonStatsTxt + 0x17a) >>> 0)), pTarget, 0, 0, hooks)
      } else if (nDist < 0x0f && rollPct < slice && nDiff2 > 0) {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x184) >>> 0), u, game, sx16(m.u16((pMonStatsTxt + 0x178) >>> 0)), pTarget, 0, 0, hooks)
      } else if (rollPct < (slice * 2)) {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x183) >>> 0), u, game, sx16(m.u16((pMonStatsTxt + 0x176) >>> 0)), pTarget, 0, 0, hooks)
      } else if (rollPct < (slice * 3)) {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x181) >>> 0), u, game, sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)), pTarget, 0, 0, hooks)
      } else {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x180) >>> 0), u, game, sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)), pTarget, 0, 0, hooks)
      }
    } else {
      aiIdleWander6FD11B10(m, game, u, 6, hooks)
    }
    if ((((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0) < ((0x32 - missingFifth) | 0)) {
      m.setU32((pAiParam + 0x18) >>> 0, 0)
    }
    m.setU32((pAiParam + 0x1c) >>> 0, nextAction >>> 0)
    return
  }
  if (nextAction === 3) {
    if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < ((missingFifth + 0x50) | 0)) {
      if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < ((0x50 - missingFifth) | 0)) {
        AI_StartAttackMode113c(m, 4, u, game, pTarget, hooks?.world, hooks)
      } else {
        castSkillWithMode6FD12380(m, m.u8((pMonStatsTxt + 0x182) >>> 0), u, game, sx16(m.u16((pMonStatsTxt + 0x174) >>> 0)), pTarget, 0, 0, hooks)
      }
      m.setU32((pAiParam + 0x1c) >>> 0, 0)
      return
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
    if (AI_CircleStrafeTarget_6FD126B0_113c(m, u, 1, game, pTarget, 3, hooks) === 0) {
      aiIdleWander6FD11B10(m, game, u, 0x0c, hooks)
    }
    m.setU32((pAiParam + 0x1c) >>> 0, 0)
    return
  }

  const pAiCtrl = getMonsterAiControlPtr113c(m, u)
  m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
  if (AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pTarget, 6, game, u, hooks) === 0) {
    if (u !== 0) freeUnitType2TimerEvents113c(m, game, u)
    if (aiMaintainIdealDist6FD11D90(m, pTarget, 0x0c, game, u, 2, 6, hooks) === 0) {
      aiIdleWander6FD11B10(m, game, u, 0x0c, hooks)
    }
  }
  m.setU32((pAiParam + 0x1c) >>> 0, 0)
}


/**
 * [21/45] Giant Mosquito (`0x6FCA6280`) AI thinker: checks melee/obstacle targets via `0x6FCD1BC0`,
 * initiates mode 4 attack, circle-strafes (`0x6FD126B0`), maintains ideal distance (`0x6FD11D90`), or stalls.
 *
 * @dll D2Game.dll
 * @va 0x6FCA6280
 * @ordinalOrName D2Game_6FCA6280
 */
export function AI_ThinkGiantMosquito_6FCA6280_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA6280)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const sp = (k2W6B3StackPtr - 0x24) >>> 0
  k2W6B3StackPtr = sp
  try {
    m.setU32(sp, nDist)
    if (u !== 0 && (m.u32(u) | 0) === 1) {
      const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const subType = m.u32((pMonData + 0x54) >>> 0) | 0
        if (subType === 3 || subType === 0x13) {
          const pObsTarget =
            MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, sp) >>> 0
          if (pObsTarget !== 0) {
            SKILLS_SetUsedSkillMemPort113c(m, u, 0)
            const modeSp = (sp + 4) >>> 0
            for (let i = 0; i < 8; i = (i + 1) | 0) {
              m.setU32((modeSp + i * 4) >>> 0, 0)
            }
            m.setU32(modeSp, 4)
            m.setU32((modeSp + 0x04) >>> 0, u)
            let animSpeedFlag = 0x64
            const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
            if (pMonStats2 !== 0) {
              const masked = (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) >>> 0
              m.setU32(sp, masked)
              if (masked !== 0) animSpeedFlag = 0x65
            }
            m.setU8((modeSp + 0x15) >>> 0, animSpeedFlag)
            m.setU32((modeSp + 0x08) >>> 0, pObsTarget)
            dispatchMonsterStartMode6FC95E10(m, game, modeSp, 1, hooks)
            return
          }
        }
      }
    }

    const pFoundTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, sp) >>> 0
    const outDist = m.u32(sp) | 0
    if (pFoundTarget !== 0 && outDist < 0x14) {
      const rollPct = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const a1Chance = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))
      if (rollPct < a1Chance) {
        AI_StartAttackMode113c(m, 4, u, game, pFoundTarget, hooks?.world, hooks)
        return
      }
      if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x14) {
        AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 3, hooks)
        return
      }
      const nDiff2 = m.u8((game + 0x6d) >>> 0)
      const stallDelay = sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x5c) >>> 0))
      aiStall6FD122C0(m, game, u, stallDelay, hooks)
      return
    }

    const rollMove = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiff = m.u8((game + 0x6d) >>> 0)
    const moveChance = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0))
    if (rollMove < moveChance) {
      const nDiff2 = m.u8((game + 0x6d) >>> 0)
      const maxSteps = sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x6e) >>> 0))
      const idealDist = sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x68) >>> 0))
      aiMaintainIdealDist6FD11D90(m, pTarget, idealDist, game, u, 2, maxSteps, hooks)
      return
    }
    aiStall6FD122C0(m, game, u, 0x14, hooks)
  } finally {
    k2W6B3StackPtr = (sp + 0x24) >>> 0
  }
}

/**
 * [22/45] Thorn Hulk / Siege Beast (`0x6FCA64A0`) AI thinker: evaluates obstacle/melee target via `0x6FCD1BC0`,
 * flees when close (`< 6`), walks or approaches at distance thresholds (`+0x80` / `+0x6E`), or casts skills 1/2/0.
 *
 * @dll D2Game.dll
 * @va 0x6FCA64A0
 * @ordinalOrName D2Game_6FCA64A0
 */
export function AI_ThinkThornHulk_6FCA64A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA64A0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const bCanMelee = m.u32((arg + 0x18) >>> 0) | 0
  const nDistInit = m.u32((arg + 0x14) >>> 0) >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const sp = (k2W6B3StackPtr - 0x24) >>> 0
  k2W6B3StackPtr = sp
  try {
    m.setU32(sp, nDistInit)
    const pFoundTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, sp) >>> 0
    if (pFoundTarget === 0) {
      const rollPct = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      if (rollPct < 0x32) {
        const raw = stepSeed64At113c(m, pSeed) >>> 0
        let pathType = (raw & 0xff) < 0x80 ? 5 : 6
        if (pathType === 1) pathType = 7
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        if (pathType !== 0) {
          m.setU32((pAiCtrl + 0x18) >>> 0, pathType >>> 0)
        }
        m.setU8((pAiCtrl + 0x20) >>> 0, 3)
        aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
        return
      }
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const stallDelay = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0))
      aiStall6FD122C0(m, game, u, stallDelay, hooks)
      return
    }

    if (bCanMelee === 0 && u !== 0 && (m.u32(u) | 0) === 1) {
      const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const subType = m.u32((pMonData + 0x54) >>> 0) | 0
        if (subType === 3 || subType === 0x13) {
          SKILLS_SetUsedSkillMemPort113c(m, u, 0)
          const modeSp = (sp + 4) >>> 0
          for (let i = 0; i < 8; i = (i + 1) | 0) {
            m.setU32((modeSp + i * 4) >>> 0, 0)
          }
          m.setU32(modeSp, 4)
          m.setU32((modeSp + 0x04) >>> 0, u)
          let animSpeedFlag = 0x64
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
          if (pMonStats2 !== 0) {
            const masked = (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) >>> 0
            if (masked !== 0) animSpeedFlag = 0x65
          }
          m.setU8((modeSp + 0x15) >>> 0, animSpeedFlag)
          m.setU32((modeSp + 0x08) >>> 0, pFoundTarget)
          dispatchMonsterStartMode6FC95E10(m, game, modeSp, 1, hooks)
          return
        }
      }
    }

    const outDist = m.u32(sp) | 0
    if (outDist < 6) {
      const rollFlee = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const fleeChance = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0))
      if (rollFlee < fleeChance) {
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        m.setU32((pAiCtrl + 0x1c) >>> 0, 0x64)
        if (AI_RunFleeFromUnit_6FD12C10_113c(m, pFoundTarget, u, game, 0x0c, 1, hooks) !== 0) {
          return
        }
      }
    }

    const nDiff = m.u8((game + 0x6d) >>> 0)
    const walkThresh = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x80) >>> 0))
    if (walkThresh > 0 && outDist > walkThresh) {
      const rollWalk = rollSeedAt6FC21180(m, pSeed, 100) | 0
      const nDiff2 = m.u8((game + 0x6d) >>> 0)
      const walkChance = sx16(m.u16((pMonStatsTxt + nDiff2 * 2 + 0x56) >>> 0))
      if (rollWalk < walkChance) {
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        m.setU32((pAiCtrl + 0x1c) >>> 0, 10)
        const nDiff3 = m.u8((game + 0x6d) >>> 0)
        const stepCount = m.u8((pMonStatsTxt + nDiff3 * 2 + 0x80) >>> 0)
        AI_WalkTowardTarget_6FD12F30_113c(m, u, pFoundTarget, game, stepCount, hooks)
        return
      }
    }

    const nDiffRun = m.u8((game + 0x6d) >>> 0)
    const runThresh = sx16(m.u16((pMonStatsTxt + nDiffRun * 2 + 0x6e) >>> 0))
    if (outDist > runThresh) {
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0x64)
      const nDiff2 = m.u8((game + 0x6d) >>> 0)
      const lowByte = m.u8((pMonStatsTxt + nDiff2 * 2 + 0x6e) >>> 0)
      const stepArg = ((outDist & ~0xff) | (lowByte !== 0 ? lowByte : 1)) | 0
      aiApproachTarget6FD12540(m, game, u, pFoundTarget, 0x0f, 0, 0, stepArg, 0, hooks)
      return
    }

    const rollAtk = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const nDiffAtk = m.u8((game + 0x6d) >>> 0)
    const atkChance = sx16(m.u16((pMonStatsTxt + nDiffAtk * 2 + 0x5c) >>> 0))
    if (rollAtk < atkChance) {
      if (sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)) >= 0) {
        const r1 = rollSeedAt6FC21180(m, pSeed, 100) | 0
        const c1 = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x74) >>> 0))
        if (r1 < c1) {
          castSkillWithMode6FD12380(
            m,
            m.u8((pMonStatsTxt + 0x181) >>> 0),
            u,
            game,
            sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)),
            pFoundTarget,
            0,
            0,
            hooks,
          )
          return
        }
      }
      if (sx16(m.u16((pMonStatsTxt + 0x174) >>> 0)) >= 0) {
        const r2 = rollSeedAt6FC21180(m, pSeed, 100) | 0
        const c2 = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x7a) >>> 0))
        if (r2 < c2) {
          castSkillWithMode6FD12380(
            m,
            m.u8((pMonStatsTxt + 0x182) >>> 0),
            u,
            game,
            sx16(m.u16((pMonStatsTxt + 0x174) >>> 0)),
            pFoundTarget,
            0,
            0,
            hooks,
          )
          return
        }
      }
      const skill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      if (skill0 >= 0) {
        castSkillWithMode6FD12380(
          m,
          m.u8((pMonStatsTxt + 0x180) >>> 0),
          u,
          game,
          skill0,
          pFoundTarget,
          0,
          0,
          hooks,
        )
        return
      }
      AI_StartAttackMode113c(m, 4, u, game, pFoundTarget, hooks?.world, hooks)
      return
    }

    const stallDelay = sx16(m.u16((pMonStatsTxt + nDiffAtk * 2 + 0x62) >>> 0))
    aiStall6FD122C0(m, game, u, stallDelay, hooks)
  } finally {
    k2W6B3StackPtr = (sp + 0x24) >>> 0
  }
}


/**
 * [23/45] Vampire / Fetish Shaman (`0x6FCA6900`) AI thinker: manages retreat state (`+0x14 == 2`),
 * speed-scaled flee (`0x6FD12D80`), obstacle skill casts (skills 0/3), and buff/heal casts (skills 1/2).
 *
 * @dll D2Game.dll
 * @va 0x6FCA6900
 * @ordinalOrName D2Game_6FCA6900
 */
export function AI_ThinkVampire_6FCA6900_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA6900)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const bCanMelee = m.u32((arg + 0x18) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const nDiffInit = m.u8((game + 0x6d) >>> 0)
  const flags6e = sx16(m.u16((pMonStatsTxt + nDiffInit * 2 + 0x6e) >>> 0))
  const hasBit0 = flags6e & 1
  const hasBit1 = flags6e & 2
  const hasBit2 = flags6e & 4

  const curCooldown = m.u32((pAiParam + 0x1c) >>> 0) | 0
  if (curCooldown > 0) {
    m.setU32((pAiParam + 0x1c) >>> 0, (curCooldown - 1) >>> 0)
  }

  const sp = (k2W6B3StackPtr - 0x24) >>> 0
  k2W6B3StackPtr = sp
  try {
    m.setU32(sp, 0)
    const pObsTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, sp) >>> 0
    const outObsDist = m.u32(sp) | 0

    if (u !== 0 && (m.u32(u) | 0) === 1) {
      const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const subType = m.u32((pMonData + 0x54) >>> 0) | 0
        if (subType === 3 || subType === 0x13) {
          if ((m.u32((pAiParam + 0x14) >>> 0) | 0) === 0) {
            m.setU32((pAiParam + 0x14) >>> 0, 1)
          }
          if (nDist < 0x1e && nDist > (m.u32((pAiParam + 0x18) >>> 0) | 0)) {
            m.setU32((pAiParam + 0x18) >>> 0, nDist >>> 0)
          }
          if (bCanMelee !== 0) {
            const rollPct = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
            if (rollPct <= 0x1e && hasBit0 !== 0) {
              if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x32) {
                castSkillWithMode6FD12380(
                  m,
                  m.u8((pMonStatsTxt + 0x180) >>> 0),
                  u,
                  game,
                  sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)),
                  pTarget,
                  0,
                  0,
                  hooks,
                )
                return
              }
              castSkillWithMode6FD12380(
                m,
                m.u8((pMonStatsTxt + 0x183) >>> 0),
                u,
                game,
                sx16(m.u16((pMonStatsTxt + 0x176) >>> 0)),
                pTarget,
                0,
                0,
                hooks,
              )
              return
            }
            SKILLS_SetUsedSkillMemPort113c(m, u, 0)
            const modeSp = (sp + 4) >>> 0
            for (let i = 0; i < 8; i = (i + 1) | 0) {
              m.setU32((modeSp + i * 4) >>> 0, 0)
            }
            m.setU32(modeSp, 4)
            m.setU32((modeSp + 0x04) >>> 0, u)
            let animSpeedFlag = 0x64
            const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
            if (pMonStats2 !== 0) {
              const masked = (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) >>> 0
              if (masked !== 0) animSpeedFlag = 0x65
            }
            m.setU8((modeSp + 0x15) >>> 0, animSpeedFlag)
            m.setU32((modeSp + 0x08) >>> 0, pTarget)
            dispatchMonsterStartMode6FC95E10(m, game, modeSp, 1, hooks)
            return
          }
        }
      }
    }

    const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0
    if ((m.u32((pAiParam + 0x14) >>> 0) | 0) === 2) {
      if (lifePct >= 0x4b) {
        m.setU32((pAiParam + 0x14) >>> 0, 1)
        aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
        return
      }
      if (nDist < 0x0e || nDist <= (m.u32((pAiParam + 0x18) >>> 0) | 0)) {
        const wVel = sx16(m.u16((pMonStatsTxt + 0x32) >>> 0))
        let speedBonus = 0
        if (wVel > 0) {
          const wRun = sx16(m.u16((pMonStatsTxt + 0x34) >>> 0))
          const calc = (sdiv32(imul32(wRun, 100), wVel) - 100) | 0
          if (calc > 0) {
            speedBonus = calc >= 0x78 ? 0x78 : calc
          }
        }
        if (speedBonus < -126 || speedBonus > 126) {
          throw new D2CommonAssertError('MonsterAI.cpp', 0x110)
        }
        const pAiCtrl = getMonsterAiControlPtr113c(m, u)
        if (speedBonus !== 0) {
          m.setU32((pAiCtrl + 0x1c) >>> 0, speedBonus >>> 0)
        }
        if (aiFleeFrom6FD12D80(m, pTarget, game, u, 8, 1, hooks) !== 0) {
          return
        }
      }

      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (nDist >= sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0))) {
        aiStall6FD122C0(m, game, u, 0x0f, hooks)
        return
      }
      if (
        (rollSeedAt6FC21180(m, pSeed, 100) | 0) >=
        sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x5c) >>> 0))
      ) {
        aiStall6FD122C0(m, game, u, 0x0f, hooks)
        return
      }
      if (
        hasBit1 !== 0 &&
        (m.u32((pAiParam + 0x1c) >>> 0) | 0) <= 0 &&
        (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
          sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x68) >>> 0))
      ) {
        castSkillWithMode6FD12380(
          m,
          m.u8((pMonStatsTxt + 0x181) >>> 0),
          u,
          game,
          sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)),
          pTarget,
          0,
          0,
          hooks,
        )
        m.setU32((pAiParam + 0x1c) >>> 0, 0x0b)
        return
      }
      if (
        hasBit2 !== 0 &&
        (m.u32((pAiParam + 0x1c) >>> 0) | 0) <= 0 &&
        (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
          sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x68) >>> 0))
      ) {
        castSkillWithMode6FD12380(
          m,
          m.u8((pMonStatsTxt + 0x182) >>> 0),
          u,
          game,
          sx16(m.u16((pMonStatsTxt + 0x174) >>> 0)),
          pTarget,
          0,
          0,
          hooks,
        )
        m.setU32((pAiParam + 0x1c) >>> 0, 0x0b)
        return
      }
      if (hasBit0 !== 0 && pObsTarget !== 0 && outObsDist <= 0x14) {
        const castSid =
          (rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x32
            ? sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
            : sx16(m.u16((pMonStatsTxt + 0x176) >>> 0))
        const castMode =
          castSid === sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
            ? m.u8((pMonStatsTxt + 0x180) >>> 0)
            : m.u8((pMonStatsTxt + 0x183) >>> 0)
        castSkillWithMode6FD12380(m, castMode, u, game, castSid, pObsTarget, 0, 0, hooks)
        return
      }
      AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
      return
    }

    if (lifePct < 0x21) {
      m.setU32((pAiParam + 0x14) >>> 0, 2)
      if (aiFleeFrom6FD12D80(m, pTarget, game, u, 8, 0, hooks) !== 0) {
        return
      }
    }

    if (bCanMelee !== 0) {
      m.setU32((pAiParam + 0x14) >>> 0, 1)
      const rollMelee = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const meleeChance = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x56) >>> 0))
      if (rollMelee < meleeChance) {
        if (hasBit0 !== 0 && pObsTarget !== 0 && (rollSeedAt6FC21180(m, pSeed, 100) | 0) <= 0x1e) {
          if (outObsDist <= 0x14) {
            if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x32) {
              castSkillWithMode6FD12380(
                m,
                m.u8((pMonStatsTxt + 0x180) >>> 0),
                u,
                game,
                sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)),
                pObsTarget,
                0,
                0,
                hooks,
              )
              return
            }
            castSkillWithMode6FD12380(
              m,
              m.u8((pMonStatsTxt + 0x183) >>> 0),
              u,
              game,
              sx16(m.u16((pMonStatsTxt + 0x176) >>> 0)),
              pObsTarget,
              0,
              0,
              hooks,
            )
            return
          }
        } else {
          AI_StartAttackMode113c(m, 4, u, game, pTarget, hooks?.world, hooks)
          return
        }
      }
      if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x21) {
        AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
        return
      }
      aiStall6FD122C0(m, game, u, 10, hooks)
      return
    }

    const maxDist = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x62) >>> 0))
    if (nDist < maxDist) {
      m.setU32((pAiParam + 0x14) >>> 0, 1)
      if (
        (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
        sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x5c) >>> 0))
      ) {
        if (
          hasBit1 !== 0 &&
          (m.u32((pAiParam + 0x1c) >>> 0) | 0) <= 0 &&
          (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
            sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x68) >>> 0))
        ) {
          castSkillWithMode6FD12380(
            m,
            m.u8((pMonStatsTxt + 0x181) >>> 0),
            u,
            game,
            sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)),
            pTarget,
            0,
            0,
            hooks,
          )
          m.setU32((pAiParam + 0x1c) >>> 0, 0x0b)
          return
        }
        if (
          hasBit2 !== 0 &&
          (m.u32((pAiParam + 0x1c) >>> 0) | 0) <= 0 &&
          (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
            sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x68) >>> 0))
        ) {
          castSkillWithMode6FD12380(
            m,
            m.u8((pMonStatsTxt + 0x182) >>> 0),
            u,
            game,
            sx16(m.u16((pMonStatsTxt + 0x174) >>> 0)),
            pTarget,
            0,
            0,
            hooks,
          )
          m.setU32((pAiParam + 0x1c) >>> 0, 0x0b)
          return
        }
        if (hasBit0 !== 0 && pObsTarget !== 0 && outObsDist <= 0x14) {
          if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) >= 0x4b) {
            AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
            return
          }
          if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x32) {
            castSkillWithMode6FD12380(
              m,
              m.u8((pMonStatsTxt + 0x180) >>> 0),
              u,
              game,
              sx16(m.u16((pMonStatsTxt + 0x170) >>> 0)),
              pObsTarget,
              0,
              0,
              hooks,
            )
            return
          }
          castSkillWithMode6FD12380(
            m,
            m.u8((pMonStatsTxt + 0x183) >>> 0),
            u,
            game,
            sx16(m.u16((pMonStatsTxt + 0x176) >>> 0)),
            pObsTarget,
            0,
            0,
            hooks,
          )
          return
        }
        aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
        return
      }
      if (nDist > 0x14) {
        aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
        return
      }
      if (nDist < 9 && (rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x32) {
        aiFleeFrom6FD12D80(m, pTarget, game, u, 8, 0, hooks)
        return
      }
      if ((rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x32) {
        AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
        return
      }
      aiStall6FD122C0(m, game, u, 10, hooks)
      return
    }

    if ((m.u32((pAiParam + 0x14) >>> 0) | 0) === 1) {
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
      return
    }
    aiStall6FD122C0(m, game, u, 0x0f, hooks)
  } finally {
    k2W6B3StackPtr = (sp + 0x24) >>> 0
  }
}


/**
 * [24/45] Willowisp / Claw Viper (`0x6FCA7010`) AI thinker: manages stealth/state transitions (`+0x14 == 1..3`),
 * cooldown frame `+0x18`, skill 1/0/2 casts, melee/mode 5 attacks, and circle-strafe.
 *
 * @dll D2Game.dll
 * @va 0x6FCA7010
 * @ordinalOrName D2Game_6FCA7010
 */
export function AI_ThinkWillowisp_6FCA7010_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA7010)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const bCanMelee = m.u32((arg + 0x18) >>> 0) | 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  const sp = (k2W6B3StackPtr - 0x24) >>> 0
  k2W6B3StackPtr = sp
  try {
    m.setU32(sp, 0)
    const pObsTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, 0, sp) >>> 0
    const outObsDist = m.u32(sp) | 0
    const state14 = m.u32((pAiParam + 0x14) >>> 0) | 0

    let gotoTargetOrCloseObs = false
    if (state14 < 3) {
      if (pTarget !== 0) {
        gotoTargetOrCloseObs = true
      } else if (
        (pObsTarget === 0 || outObsDist > 10) &&
        (m.u32((game + 0xa8) >>> 0) | 0) > (m.u32((pAiParam + 0x18) >>> 0) | 0)
      ) {
        const skill1 = sx16(m.u16((pMonStatsTxt + 0x172) >>> 0))
        if (skill1 >= 0) {
          castSkillWithMode6FD12380(
            m,
            m.u8((pMonStatsTxt + 0x181) >>> 0),
            u,
            game,
            skill1,
            0,
            0,
            0,
            hooks,
          )
          AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 0x1e, hooks)
          const nDiff = m.u8((game + 0x6d) >>> 0)
          const delay = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))
          m.setU32((pAiParam + 0x18) >>> 0, ((m.u32((game + 0xa8) >>> 0) | 0) + delay) >>> 0)
          m.setU32((pAiParam + 0x14) >>> 0, 3)
          return
        }
      }
    } else if (pTarget !== 0) {
      gotoTargetOrCloseObs = true
    }

    if (!gotoTargetOrCloseObs) {
      if (pObsTarget !== 0 && outObsDist < 0x10) {
        gotoTargetOrCloseObs = true
      } else if (state14 === 3) {
        AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 0x14, hooks)
        return
      }
    }

    if (gotoTargetOrCloseObs && state14 === 3) {
      const gameFrame = m.u32((game + 0xa8) >>> 0) | 0
      const skill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      if (gameFrame <= (m.u32((pAiParam + 0x18) >>> 0) | 0) || skill0 < 0) {
        AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 0x14, hooks)
        return
      }
      castSkillWithMode6FD12380(
        m,
        m.u8((pMonStatsTxt + 0x180) >>> 0),
        u,
        game,
        skill0,
        pTarget,
        0,
        0,
        hooks,
      )
      AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 0x19, hooks)
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const delay = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))
      m.setU32((pAiParam + 0x18) >>> 0, ((m.u32((game + 0xa8) >>> 0) | 0) + delay) >>> 0)
      m.setU32((pAiParam + 0x14) >>> 0, 1)
      return
    }

    const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0
    if (
      lifePct < 0x19 &&
      sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)) >= 0 &&
      outObsDist < 7 &&
      (m.u32((game + 0xa8) >>> 0) | 0) > (m.u32((pAiParam + 0x18) >>> 0) | 0) &&
      (rollSeedAt6FC21180(m, pSeed, 100) | 0) < 0x14
    ) {
      castSkillWithMode6FD12380(
        m,
        m.u8((pMonStatsTxt + 0x181) >>> 0),
        u,
        game,
        sx16(m.u16((pMonStatsTxt + 0x172) >>> 0)),
        pTarget,
        0,
        0,
        hooks,
      )
      AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 0x1e, hooks)
      const nDiff = m.u8((game + 0x6d) >>> 0)
      const delay = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))
      m.setU32((pAiParam + 0x18) >>> 0, ((m.u32((game + 0xa8) >>> 0) | 0) + delay) >>> 0)
      m.setU32((pAiParam + 0x14) >>> 0, 3)
      return
    }

    if (bCanMelee !== 0) {
      const rollMelee = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const nDiff = m.u8((game + 0x6d) >>> 0)
      if (rollMelee < sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x68) >>> 0))) {
        SKILLS_SetUsedSkillMemPort113c(m, u, 0)
        const modeSp = (sp + 4) >>> 0
        for (let i = 0; i < 8; i = (i + 1) | 0) {
          m.setU32((modeSp + i * 4) >>> 0, 0)
        }
        m.setU32(modeSp, 4)
        m.setU32((modeSp + 0x04) >>> 0, u)
        let animSpeedFlag = 0x64
        if (u !== 0) {
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
          if (pMonStats2 !== 0) {
            const masked = (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) >>> 0
            if (masked !== 0) animSpeedFlag = 0x65
          }
        }
        m.setU8((modeSp + 0x15) >>> 0, animSpeedFlag)
        m.setU32((modeSp + 0x08) >>> 0, pTarget)
        dispatchMonsterStartMode6FC95E10(m, game, modeSp, 1, hooks)
        return
      }
    }

    if (
      pObsTarget !== 0 &&
      outObsDist < 0x0f &&
      (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
        sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x5c) >>> 0))
    ) {
      AI_StartAttackMode113c(m, 5, u, game, pObsTarget, hooks?.world, hooks)
      return
    }

    const rollMove = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    if (rollMove < 0x14) {
      const raw = stepSeed64At113c(m, pSeed) >>> 0
      let pathType = (raw & 0xff) < 0x80 ? 5 : 6
      if (pathType === 1) pathType = 7
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      if (pathType !== 0) {
        m.setU32((pAiCtrl + 0x18) >>> 0, pathType >>> 0)
      }
      m.setU8((pAiCtrl + 0x20) >>> 0, 6)
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
      return
    }

    const nDiff = m.u8((game + 0x6d) >>> 0)
    const maxCount = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x62) >>> 0))
    if (
      (m.u32((pAiParam + 0x1c) >>> 0) | 0) < maxCount &&
      (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
        sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x56) >>> 0))
    ) {
      if (
        (m.u32((pAiParam + 0x14) >>> 0) | 0) === 2 &&
        sx16(m.u16((pMonStatsTxt + 0x174) >>> 0)) >= 0
      ) {
        m.setU32((pAiParam + 0x1c) >>> 0, ((m.u32((pAiParam + 0x1c) >>> 0) | 0) + 1) >>> 0)
        m.setU32((pAiParam + 0x14) >>> 0, 1)
        castSkillWithMode6FD12380(
          m,
          m.u8((pMonStatsTxt + 0x182) >>> 0),
          u,
          game,
          sx16(m.u16((pMonStatsTxt + 0x174) >>> 0)),
          pTarget,
          0,
          0,
          hooks,
        )
        AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 0x14, hooks)
        return
      }
      AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 6, hooks)
      m.setU32((pAiParam + 0x14) >>> 0, 2)
      return
    }

    AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, game, u, 0x0c, hooks)
  } finally {
    k2W6B3StackPtr = (sp + 0x24) >>> 0
  }
}

/**
 * [25/45] Slinger (`0x6FCA74A0`) AI thinker: handles ranged javelin (mode 5) vs melee (mode 4) attacks,
 * low-life flee (`0x6FD12D80`), and circle-strafe (`0x6FD126B0`).
 *
 * @dll D2Game.dll
 * @va 0x6FCA74A0
 * @ordinalOrName D2Game_6FCA74A0
 */
export function AI_ThinkSlinger_6FCA74A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA74A0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const bCanMelee = m.u32((arg + 0x18) >>> 0) | 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pSeed = (u + 0x20) >>> 0

  const sp = (k2W6B3StackPtr - 0x28) >>> 0
  k2W6B3StackPtr = sp
  try {
    m.setU32(sp, nDist >>> 0)
    if (bCanMelee === 0 && u !== 0 && (m.u32(u) | 0) === 1) {
      const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const subType = m.u32((pMonData + 0x54) >>> 0) | 0
        if (subType === 3 || subType === 0x13) {
          SKILLS_SetUsedSkillMemPort113c(m, u, 0)
          const modeSp = (sp + 8) >>> 0
          for (let i = 0; i < 8; i = (i + 1) | 0) {
            m.setU32((modeSp + i * 4) >>> 0, 0)
          }
          m.setU32(modeSp, 5)
          m.setU32((modeSp + 0x04) >>> 0, u)
          let animSpeedFlag = 0x64
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
          if (pMonStats2 !== 0) {
            const masked = (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 5)) >>> 0
            if (masked !== 0) animSpeedFlag = 0x65
          }
          m.setU8((modeSp + 0x15) >>> 0, animSpeedFlag)
          m.setU32((modeSp + 0x08) >>> 0, pTarget)
          dispatchMonsterStartMode6FC95E10(m, game, modeSp, 1, hooks)
          return
        }
      }
    }

    const lifePct = STATLIST_GetUnitLifePercent113c(m, u) | 0
    const nDiff = m.u8((game + 0x6d) >>> 0)
    const fleeThresh = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x56) >>> 0))
    if (lifePct >= fleeThresh) {
      if (bCanMelee !== 0) {
        SKILLS_SetUsedSkillMemPort113c(m, u, 0)
        const modeSp = (sp + 8) >>> 0
        for (let i = 0; i < 8; i = (i + 1) | 0) {
          m.setU32((modeSp + i * 4) >>> 0, 0)
        }
        m.setU32(modeSp, 4)
        m.setU32((modeSp + 0x04) >>> 0, u)
        let animSpeedFlag = 0x64
        if (u !== 0) {
          const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
          if (pMonStats2 !== 0) {
            const masked = (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 4)) >>> 0
            if (masked !== 0) animSpeedFlag = 0x65
          }
        }
        m.setU8((modeSp + 0x15) >>> 0, animSpeedFlag)
        m.setU32((modeSp + 0x08) >>> 0, pTarget)
        dispatchMonsterStartMode6FC95E10(m, game, modeSp, 1, hooks)
        return
      }
      if (nDist < 0x0f) {
        const pObsTarget =
          MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, (sp + 4) >>> 0, sp) >>> 0
        if (pObsTarget !== 0) {
          if (
            (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
            sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x62) >>> 0))
          ) {
            AI_StartAttackMode113c(m, 5, u, game, pTarget, hooks?.world, hooks)
            return
          }
        }
      }
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
      return
    }

    if (nDist < 3) {
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      m.setU32((pAiCtrl + 0x1c) >>> 0, 0x32)
      if (aiFleeFrom6FD12D80(m, pTarget, game, u, 5, 1, hooks) === 0) {
        AI_StartAttackMode113c(m, 5, u, game, pTarget, hooks?.world, hooks)
      }
      return
    }

    if (nDist > 0x0f) {
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 6, 0, hooks)
      return
    }

    const pObsTarget =
      MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, u, game, (sp + 4) >>> 0, sp) >>> 0
    if (pObsTarget !== 0) {
      if (
        (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
        sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x68) >>> 0))
      ) {
        AI_StartAttackMode113c(m, 5, u, game, pTarget, hooks?.world, hooks)
        return
      }
    }

    if (
      (rollSeedAt6FC21180(m, pSeed, 100) | 0) <
      sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x5c) >>> 0))
    ) {
      AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 3, hooks)
      return
    }
    aiStall6FD122C0(m, game, u, 10, hooks)
  } finally {
    k2W6B3StackPtr = (sp + 0x28) >>> 0
  }
}


/**
 * [26/45] Fetish Shaman / Greater Mummy (`0x6FCA7BB0`) AI thinker: casts skill 0 when within skill level range
 * and not in state 12, clears state 12, scans for Fetish minion corpses via `0x6FC9BB90` to revive with skill 2,
 * or approaches/stalls.
 *
 * @dll D2Game.dll
 * @va 0x6FCA7BB0
 * @ordinalOrName D2Game_6FCA7BB0
 */
export function AI_ThinkFetishShaman_6FCA7BB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA7BB0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pSeed = (u + 0x20) >>> 0

  const skill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  let slvl = 1
  if (skill0 >= 0) {
    const pSkill = SKILLS_GetSkillById113c(m, u, skill0, -1) >>> 0
    if (pSkill !== 0) {
      const evalLvl = SKILLS_EvaluateSkillLevel113c(m, u, pSkill, 1) | 0
      if (evalLvl > 0) slvl = evalLvl
    }
  }

  const sp = (k2W6B3StackPtr - 0x40) >>> 0
  k2W6B3StackPtr = sp
  try {
    if (skill0 >= 0 && nDist < slvl && STATES_CheckState113c(m, u, 0x0c) === 0) {
      for (let i = 0; i < 7; i = (i + 1) | 0) {
        m.setU32((sp + i * 4) >>> 0, 0)
      }
      m.setU32((sp + 0x08) >>> 0, 1)
      m.setU32((sp + 0x0c) >>> 0, pTarget !== 0 ? m.u32((pTarget + 0x0c) >>> 0) >>> 0 : 0xffffffff)
      m.setU32((sp + 0x10) >>> 0, pTarget !== 0 ? m.u32(pTarget) >>> 0 : 6)
      AIGENERAL_BroadcastCmdToMinions113c(m, u, game, sp)
      castSkillWithMode6FD12380(
        m,
        m.u8((pMonStatsTxt + 0x180) >>> 0),
        u,
        game,
        skill0,
        pTarget,
        0,
        0,
        hooks,
      )
      return
    }

    if (STATES_CheckState113c(m, u, 0x0c) !== 0) {
      STATES_ToggleGfxStateFlag113c(m, u, 0x0c, 0)
    }

    const nDiff = m.u8((game + 0x6d) >>> 0)
    const r6e = sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x6e) >>> 0))
    const ctxSp = (sp + 0x1c) >>> 0
    m.setU32(ctxSp, 0)
    m.setU32((ctxSp + 0x04) >>> 0, 0x7fffffff)
    m.setU32((ctxSp + 0x08) >>> 0, imul32(r6e, r6e) >>> 0)
    m.setU32((ctxSp + 0x0c) >>> 0, 0)
    m.setU32((ctxSp + 0x10) >>> 0, 0x7fffffff)
    m.setU32((ctxSp + 0x14) >>> 0, 0)
    m.setU32((ctxSp + 0x18) >>> 0, sx16(m.u16((pMonStatsTxt + nDiff * 2 + 0x5c) >>> 0)) >>> 0)

    scanUnitsByModeWithCb113c(m, 1, ctxSp, game, u, 0x6fc9bb90)
    const pBestCorpse = m.u32(ctxSp) >>> 0
    if (pBestCorpse !== 0) {
      const rollRevive = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
      const reviveChance = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x56) >>> 0))
      if (rollRevive < reviveChance) {
        const skill2 = sx16(m.u16((pMonStatsTxt + 0x174) >>> 0))
        if (SKILLS_CanMonsterCastAtTarget113c(m, 0, pBestCorpse, u, skill2, 0, hooks) !== 0) {
          for (let i = 0; i < 7; i = (i + 1) | 0) {
            m.setU32((sp + i * 4) >>> 0, 0)
          }
          m.setU32((sp + 0x08) >>> 0, 0x0e)
          m.setU32((sp + 0x0c) >>> 0, m.u32((pBestCorpse + 0x0c) >>> 0) >>> 0)
          m.setU32((sp + 0x10) >>> 0, 1)
          AIGENERAL_BroadcastCmdToMinions113c(m, u, game, sp)

          const maxCastDist = sx16(
            m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x62) >>> 0),
          )
          if ((m.u32((ctxSp + 0x04) >>> 0) | 0) > maxCastDist) {
            AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pBestCorpse, 10, game, u, hooks)
            return
          }
          AI_CastSkillMode14_113c(m, u, skill2, game, pBestCorpse, 0, 0, hooks?.world, hooks)
          return
        }
      }
    }

    const rollMove = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const moveChance = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x68) >>> 0))
    if (rollMove < moveChance) {
      const raw = stepSeed64At113c(m, pSeed) >>> 0
      let pathType = (raw & 0xff) < 0x80 ? 5 : 6
      if (pathType === 1) pathType = 7
      const pAiCtrl = getMonsterAiControlPtr113c(m, u)
      if (pathType !== 0) {
        m.setU32((pAiCtrl + 0x18) >>> 0, pathType >>> 0)
      }
      m.setU8((pAiCtrl + 0x20) >>> 0, 4)
      aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 0, hooks)
      return
    }
    aiStall6FD122C0(m, game, u, 10, hooks)
  } finally {
    k2W6B3StackPtr = (sp + 0x40) >>> 0
  }
}

/**
 * [27/45] Blood Lord / Vile Mother (`0x6FCA8810`) AI thinker: casts skill 0 when `< 5` subtiles,
 * initiates mode 5 melee attack, wanders around target when `> 10` subtiles, approaches, or circle-strafes.
 *
 * @dll D2Game.dll
 * @va 0x6FCA8810
 * @ordinalOrName D2Game_6FCA8810
 */
export function AI_ThinkBloodLord_6FCA8810_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCA8810)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const bCanMelee = m.u32((arg + 0x18) >>> 0) | 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pSeed = (u + 0x20) >>> 0

  const skill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (skill0 >= 0 && nDist < 5) {
    const rollSkill = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const skillChance = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x56) >>> 0))
    if (
      rollSkill < skillChance &&
      SKILLS_CanMonsterCastAtTarget113c(m, 0, pTarget, u, skill0, 0, hooks) !== 0
    ) {
      castSkillWithMode6FD12380(
        m,
        m.u8((pMonStatsTxt + 0x180) >>> 0),
        u,
        game,
        skill0,
        pTarget,
        0,
        0,
        hooks,
      )
      return
    }
  }

  if (bCanMelee !== 0) {
    const rollAtk = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
    const atkChance = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x5c) >>> 0))
    if (rollAtk >= atkChance) {
      aiStall6FD122C0(m, game, u, 10, hooks)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, u, 0)
    const sp = (k2W6B3StackPtr - 0x20) >>> 0
    k2W6B3StackPtr = sp
    try {
      for (let i = 0; i < 8; i = (i + 1) | 0) {
        m.setU32((sp + i * 4) >>> 0, 0)
      }
      m.setU32(sp, 5)
      m.setU32((sp + 0x04) >>> 0, u)
      let animSpeedFlag = 0x64
      if (u !== 0) {
        const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((u + 0x04) >>> 0) | 0) >>> 0
        if (pMonStats2 !== 0) {
          const masked = (m.u8((pMonStats2 + 0x104) >>> 0) & readGdwBitMasks113c(m, 5)) >>> 0
          if (masked !== 0) animSpeedFlag = 0x65
        }
      }
      m.setU8((sp + 0x15) >>> 0, animSpeedFlag)
      m.setU32((sp + 0x08) >>> 0, pTarget)
      dispatchMonsterStartMode6FC95E10(m, game, sp, 1, hooks)
    } finally {
      k2W6B3StackPtr = (sp + 0x20) >>> 0
    }
    return
  }

  if (nDist > 10) {
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x1c) >>> 0, 0x4b)
    AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pTarget, 5, game, u, hooks)
    return
  }

  const rollMove = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
  const moveChance = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x62) >>> 0))
  if (rollMove < moveChance) {
    aiApproachTarget6FD12540(m, game, u, pTarget, 2, 0, 0, 1, 7, hooks)
    return
  }

  const rollStrafe = ((stepSeed64At113c(m, pSeed) >>> 0) % 100) | 0
  const strafeChance = sx16(m.u16((pMonStatsTxt + (m.u8((game + 0x6d) >>> 0)) * 2 + 0x68) >>> 0))
  if (rollStrafe < strafeChance) {
    AI_CircleStrafeTarget_6FD126B0_113c(m, u, 0, game, pTarget, 4, hooks)
    return
  }
  aiStall6FD122C0(m, game, u, 10, hooks)
}

/**
 * [28/45] Special AI state 3 thinker (`0x6FCBCC00`): reverts to base AI (`0x6FCBD230`) when attacking
 * an obstacle (`subType == 3 | 0x13`) or close (`nDist < 4`), otherwise wanders around target or idles.
 *
 * @dll D2Game.dll
 * @va 0x6FCBCC00
 * @ordinalOrName D2Game_6FCBCC00
 */
export function AI_ThinkSpecialAiState3_6FCBCC00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCBCC00)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const pAiParam = m.u32(arg) >>> 0
  const pSeed = (u + 0x20) >>> 0

  if (u !== 0 && (m.u32(u) | 0) === 1) {
    const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const subType = m.u32((pMonData + 0x54) >>> 0) | 0
      if (subType === 3 || subType === 0x13) {
        transitionMonsterSpecialAiState6FCBD230(m, game, u, pAiParam, 0)
        aiStall6FD122C0(m, game, u, 10, hooks)
        return
      }
    }
  }

  if (nDist < 4) {
    transitionMonsterSpecialAiState6FCBD230(m, game, u, pAiParam, 0)
    aiStall6FD122C0(m, game, u, 10, hooks)
    return
  }

  if (nDist > 10 && (m.u32((pAiParam + 0x14) >>> 0) | 0) === 0) {
    m.setU32((pAiParam + 0x14) >>> 0, 1)
    AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pTarget, 0x0c, game, u, hooks)
    return
  }

  const raw1 = stepSeed64At113c(m, pSeed) >>> 0
  if ((raw1 & 0xff) < 0x4d) {
    aiIdleWander6FD11B10(m, game, u, 4, hooks)
    return
  }

  const raw2 = stepSeed64At113c(m, pSeed) >>> 0
  if ((raw2 & 0xff) < 0x1a) {
    m.setU32((pAiParam + 0x14) >>> 0, 0)
  }
  aiStall6FD122C0(m, game, u, 10, hooks)
}


/**
 * [29/45] Blade Creeper / Assassin Blade Sentinel (`0x6FCC6B70`) AI thinker: validates skill 0 lifetime (`+0x14`),
 * spawns projectile (`0x6FCC0000`) and copies leader attack rating (`0x13` / `0x77`), and ping-pongs between command coords.
 *
 * @dll D2Game.dll
 * @va 0x6FCC6B70
 * @ordinalOrName D2Game_6FCC6B70
 */
export function AI_ThinkBladeCreeper_6FCC6B70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCC6B70)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const skill0 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  const pAiParam = m.u32(arg) >>> 0

  const startDeathMode0 = (): void => {
    SKILLS_SetUsedSkillMemPort113c(m, u, 0)
    const sp = (k2W6B3StackPtr - 0x20) >>> 0
    k2W6B3StackPtr = sp
    try {
      for (let i = 0; i < 8; i = (i + 1) | 0) {
        m.setU32((sp + i * 4) >>> 0, 0)
      }
      m.setU32(sp, 0)
      m.setU32((sp + 0x04) >>> 0, u)
      m.setU8((sp + 0x15) >>> 0, 0x64)
      dispatchMonsterStartMode6FC95E10(m, game, sp, 1, hooks)
    } finally {
      k2W6B3StackPtr = (sp + 0x20) >>> 0
    }
  }

  let pSkillsTxt = 0
  if (skill0 >= 0) {
    const pDataTables = getDataTablesPtr113c(m)
    const nSkillsCount = pDataTables !== 0 ? m.u32((pDataTables + 0xba0) >>> 0) | 0 : 0
    if (skill0 < nSkillsCount) {
      const pSkillsBase = m.u32((pDataTables + 0xb98) >>> 0) >>> 0
      pSkillsTxt = (pSkillsBase + imul32(skill0, 0x23c)) >>> 0
    }
  }

  if (pSkillsTxt === 0) {
    startDeathMode0()
    return
  }

  const pSkill = SKILLS_GetHighestLevelSkillFromUnitAndIdFastcall113c(m, u, skill0) >>> 0
  if (pSkill === 0) {
    startDeathMode0()
    return
  }

  const slvl = SKILLS_EvaluateSkillLevel113c(m, u, pSkill, 1) | 0
  if ((m.u32((pAiParam + 0x14) >>> 0) | 0) < 0) {
    const calcOffset = m.u32((pSkillsTxt + 0x144) >>> 0) >>> 0
    const duration = SKILLS_EvalCalcByOffset113c(m, u, calcOffset, skill0, slvl) | 0
    m.setU32((pAiParam + 0x14) >>> 0, ((m.u32((game + 0xa8) >>> 0) | 0) + duration) >>> 0)
  }

  if ((m.u32((pAiParam + 0x14) >>> 0) | 0) < (m.u32((game + 0xa8) >>> 0) | 0)) {
    startDeathMode0()
    return
  }

  if ((m.u32((pAiParam + 0x1c) >>> 0) | 0) === 0) {
    const wMissile = sx16(m.u16((pSkillsTxt + 0x48) >>> 0))
    const pDataTables = getDataTablesPtr113c(m)
    const nMissilesCount = pDataTables !== 0 ? m.u32((pDataTables + 0xb6c) >>> 0) | 0 : 0
    if (wMissile >= 0 && wMissile < nMissilesCount) {
      let pLeader = AIGENERAL_GetPackLeaderUnit113c(m, u) >>> 0
      if (pLeader === 0) pLeader = u
      const posY = UNIT_GetPosY113c(m, u) | 0
      const posX = UNIT_GetPosX113c(m, u) | 0
      const pMissile =
        SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(
          m,
          u,
          game,
          skill0,
          slvl,
          wMissile,
          posX,
          posY,
        ) >>> 0
      if (pMissile !== 0) {
        STATES_UpdateOrClearState98Transform113c(m, pMissile, u)
        const baseToHit = UNITS_GetPlayerBaseToHit113c(m, pLeader) | 0
        STATLIST_AddUnitStatMemPort113c(m, u, 0x13, baseToHit, 0)
        let bonusToHit = STATLIST_GetUnitStat113c(m, pLeader, 0x77, 0) | 0
        const pWeapon = PLAYER_GetEquippedWeapon113c(m, pLeader) >>> 0
        if (pWeapon !== 0) {
          bonusToHit =
            (bonusToHit + (SKILLS_GetWeaponMasteryBonusMemPort113c(m, pLeader, pWeapon, 0, 0) | 0)) |
            0
        }
        STATLIST_AddUnitStatMemPort113c(m, u, 0x77, bonusToHit, 0)
      }
      m.setU32((pAiParam + 0x1c) >>> 0, 1)
    }
  }

  const pAiGen = getMonsterAiGeneralPtr113c(m, u)
  const pCmd = pAiGen !== 0 ? m.u32((pAiGen + 0x20) >>> 0) >>> 0 : 0
  if (pCmd === 0) {
    aiStall6FD122C0(m, game, u, 3, hooks)
    return
  }

  const pAiCtrl = getMonsterAiControlPtr113c(m, u)
  m.setU32((pAiCtrl + 0x18) >>> 0, 0x0f)
  m.setU8((pAiCtrl + 0x20) >>> 0, 0x14)

  let fallbackX = 0
  let fallbackY = 0
  if ((m.u32((pAiParam + 0x18) >>> 0) | 0) !== 0) {
    const x1 = m.u32((pCmd + 0x14) >>> 0) | 0
    const y1 = m.u32((pCmd + 0x18) >>> 0) | 0
    if (aiApproachTarget6FD12540(m, game, u, 0, 2, x1, y1, 1, 4, hooks) !== 0) {
      return
    }
    m.setU32((pAiParam + 0x18) >>> 0, (m.u32((pAiParam + 0x18) >>> 0) | 0) === 0 ? 1 : 0)
    fallbackX = m.u32((pCmd + 0x0c) >>> 0) | 0
    fallbackY = m.u32((pCmd + 0x10) >>> 0) | 0
  } else {
    const x0 = m.u32((pCmd + 0x0c) >>> 0) | 0
    const y0 = m.u32((pCmd + 0x10) >>> 0) | 0
    if (aiApproachTarget6FD12540(m, game, u, 0, 2, x0, y0, 1, 4, hooks) !== 0) {
      return
    }
    m.setU32((pAiParam + 0x18) >>> 0, (m.u32((pAiParam + 0x18) >>> 0) | 0) === 0 ? 1 : 0)
    fallbackX = m.u32((pCmd + 0x14) >>> 0) | 0
    fallbackY = m.u32((pCmd + 0x18) >>> 0) | 0
  }

  if (aiApproachTarget6FD12540(m, game, u, 0, 2, fallbackX, fallbackY, 1, 4, hooks) !== 0) {
    return
  }
  const pPackLeader = AIGENERAL_GetPackLeaderUnit113c(m, u) >>> 0
  if (AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, pPackLeader, 5, game, u, hooks) !== 0) {
    return
  }
  aiStall6FD122C0(m, game, u, 5, hooks)
}

/**
 * [30/45] Terror / Howl / Grim Ward Fear AI thinker (`0x6FCC6FC0`): checks `STATE_TERROR = 0x38`,
 * reverts special AI (`0x6FCBD230`) when expired, or flees from target at run/walk speed (`0x6FD12C10` / `0x6FD12D80`).
 *
 * @dll D2Game.dll
 * @va 0x6FCC6FC0
 * @ordinalOrName D2Game_6FCC6FC0
 */
export function AI_ThinkTerrorCurse_6FCC6FC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiThinkArg: number,
  hooks?: K2W6B3Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FCC6FC0)
  const game = pGame >>> 0
  const u = pUnit >>> 0
  const arg = pAiThinkArg >>> 0
  const pTarget = m.u32((arg + 0x08) >>> 0) >>> 0
  const nDist = m.u32((arg + 0x14) >>> 0) | 0
  const pAiParam = m.u32(arg) >>> 0
  const bCanMelee = m.u32((arg + 0x18) >>> 0) | 0

  if (STATES_CheckState113c(m, u, 0x38) === 0) {
    transitionMonsterSpecialAiState6FCBD230(m, game, u, pAiParam, 0)
    if (u !== 0) {
      freeUnitType2TimerEvents113c(m, game, u)
    }
    EVENT_SetEventFull113c(
      m,
      game,
      u,
      2,
      ((m.u32((game + 0xa8) >>> 0) | 0) + 1) >>> 0,
      0,
      0,
      0,
    )
    return
  }

  let maxDist = m.u32((pAiParam + 0x14) >>> 0) | 0
  if (maxDist === 0) maxDist = 0x1e
  if (nDist > maxDist) {
    aiStall6FD122C0(m, game, u, 10, hooks)
    return
  }

  const pMonStatsTxt = m.u32((arg + 0x1c) >>> 0) >>> 0
  const wVel = sx16(m.u16((pMonStatsTxt + 0x32) >>> 0))
  let speedBonus = 0
  if (wVel > 0) {
    const wRun = sx16(m.u16((pMonStatsTxt + 0x34) >>> 0))
    const ratio = sdiv32(imul32(wRun, 100), wVel)
    if (ratio >= 100) {
      speedBonus = (ratio - 100) | 0
      if (speedBonus > 0x78) speedBonus = 0x78
    }
  }

  if ((m.u32((pAiParam + 0x1c) >>> 0) | 0) === 0) {
    m.setU32((pAiParam + 0x1c) >>> 0, 1)
    if (u !== 0) {
      if ((m.u32(u) | 0) === 1) {
        const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          m.setU32((pMonData + 0x38) >>> 0, 0)
          m.setU32((pMonData + 0x34) >>> 0, 0)
        }
      }
      freeUnitType2TimerEvents113c(m, game, u)
    }
    if (speedBonus < -126 || speedBonus > 126) {
      throw new D2CommonAssertError('MonsterAI.cpp', 0x110)
    }
    const pAiCtrl = getMonsterAiControlPtr113c(m, u)
    m.setU32((pAiCtrl + 0x18) >>> 0, 2)
    if (speedBonus !== 0) {
      m.setU32((pAiCtrl + 0x1c) >>> 0, speedBonus >>> 0)
    }
    const monClassId = u !== 0 ? m.u32((u + 0x04) >>> 0) | 0 : -1
    if (MONSTATS2_CheckModeBit113c(m, monClassId, 0x0f) !== 0) {
      AI_RunFleeFromUnit_6FD12C10_113c(m, pTarget, u, game, 0x1e, 0, hooks)
      return
    }
    aiFleeFrom6FD12D80(m, pTarget, game, u, 0x1e, 0, hooks)
    return
  }

  if (bCanMelee !== 0) {
    const monClassId = u !== 0 ? m.u32((u + 0x04) >>> 0) | 0 : -1
    if (MONSTATS_CheckFlagBit113c(m, monClassId, 9) === 0) {
      const monClassId2 = u !== 0 ? m.u32((u + 0x04) >>> 0) | 0 : -1
      if (MONSTATS2_CheckModeBit113c(m, monClassId2, 4) !== 0) {
        AI_StartAttackMode113c(m, 4, u, game, pTarget, hooks?.world, hooks)
        return
      }
    }
  }

  if (speedBonus < -126 || speedBonus > 126) {
    throw new D2CommonAssertError('MonsterAI.cpp', 0x110)
  }
  const pAiCtrl = getMonsterAiControlPtr113c(m, u)
  m.setU32((pAiCtrl + 0x18) >>> 0, 2)
  if (speedBonus !== 0) {
    m.setU32((pAiCtrl + 0x1c) >>> 0, speedBonus >>> 0)
  }
  const monClassId = u !== 0 ? m.u32((u + 0x04) >>> 0) | 0 : -1
  const fled =
    MONSTATS2_CheckModeBit113c(m, monClassId, 0x0f) !== 0
      ? AI_RunFleeFromUnit_6FD12C10_113c(m, pTarget, u, game, 0x1e, 1, hooks) | 0
      : aiFleeFrom6FD12D80(m, pTarget, game, u, 0x1e, 1, hooks) | 0
  if (fled === 0) {
    aiIdleWander6FD11B10(m, game, u, 6, hooks)
  }
}


/**
 * [31/45] Act 2 Quest 6 (`0x0E`) player callback (`0x6FCE5820`): when player is in Tal Rasha's Chamber (`0x49`)
 * and quest `0x0E` bits `0, 3, 4, 5` are all clear, sets bit `5` and propagates via `0x6FCE29E0` to sub-party.
 *
 * @dll D2Game.dll
 * @va 0x6FCE5820
 * @ordinalOrName D2Game_6FCE5820
 */
export function ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE5820)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return 0
  if ((DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0) !== 0x49) return 0

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 5) !== 0) return 0

  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 5)
  const wPartyId = SUNITDMG_GetPlayerClientClassId113c(m, player) & 0xffff
  if (wPartyId !== 0xffff) {
    PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
      m,
      game,
      wPartyId,
      ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c,
      0,
    )
  }
  return 0
}

/**
 * [32/45] Act 2 Quest 6 (`0x0E`) sub-party completion callback (`0x6FCE5910`): verifies quest node `0x0D`
 * exists in `pGame + 0x10F4` and completes Duriel quest (`0x6FCE4C30`) for eligible players in Act 2 (`act == 1`).
 *
 * @dll D2Game.dll
 * @va 0x6FCE5910
 * @ordinalOrName D2Game_6FCE5910
 */
export function ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FCE5910)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pQuestChain = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pQuestChain === 0) return
  let pQuest = m.u32(pQuestChain) >>> 0
  if (pQuest === 0) return
  while ((m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return
  }

  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0) | 0) === 1) return
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3) | 0) === 1) return
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) | 0) === 1) return

  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return
  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if ((DRLG_GetActNoFromLevelId113c(m, levelId) & 0xff) === 1) {
    ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c(m, player, pQuestFlags, game)
  }
}

/**
 * [33/45] Act 2 Quest 6 (`0x0E`) chamber completion callback (`0x6FCE59A0`): asserts quest node `0x0D`
 * exists and completes Duriel quest (`0x6FCE4C30`) if player is in level `0x49` and bits `0x0D, 3, 4` are clear.
 *
 * @dll D2Game.dll
 * @va 0x6FCE59A0
 * @ordinalOrName D2Game_6FCE59A0
 */
export function ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE59A0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return 0

  const pQuestChain = m.u32((game + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestChain !== 0 ? m.u32(pQuestChain) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) {
    throw new D2CommonAssertError('Quests.cpp', 0x191)
  }

  const inChamber = (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0) === 0x49
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0d) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) !== 0) return 0
  if (inChamber) {
    ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c(m, player, pQuestFlags, game)
  }
  return 0
}

/**
 * [34/45] Act 2 Quest 5 (`0x0D`, Summoner) party propagation callback (`0x6FCE5B80`): if player has
 * quest `0x0D` bit `0x0D` set and belongs to a party, iterates sub-party with `0x6FCE2E70`.
 *
 * @dll D2Game.dll
 * @va 0x6FCE5B80
 * @ordinalOrName D2Game_6FCE5B80
 */
export function ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE5B80)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0d) === 0) return 0
  if (player === 0) return 0
  if ((m.u32((player + 0x80) >>> 0) >>> 0) === 0) return 0
  if ((m.u32(player) | 0) !== 0) return 0

  const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, player, game) & 0xffff
  if (wPartyId !== 0xffff) {
    PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
      m,
      game,
      wPartyId,
      ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c,
      0,
    )
  }
  return 0
}

/**
 * [35/45] Act 2 Quest 4 (`0x0C`, Arcane Sanctuary) completion callback (`0x6FCE5C60`): when player is
 * in Arcane Sanctuary (`0x4A`) and bits `0, 1` are clear, sets bits `0x0D, 1, 0, 8, 7` and propagates to sub-party (`0x6FCE3480`).
 *
 * @dll D2Game.dll
 * @va 0x6FCE5C60
 * @ordinalOrName D2Game_6FCE5C60
 */
export function ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE5C60)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0

  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0) | 0) === 1) return 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 1) | 0) === 1) return 0

  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return 0
  if ((DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0) !== 0x4a) return 0

  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 1)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 0)
  QUESTRECORD_ClearQuestStateBits2To11_113c(m, pQuestFlags, 0x0c)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 8)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 7)

  const wPartyId = SUNITDMG_GetPlayerClientClassId113c(m, player) & 0xffff
  if (wPartyId !== 0xffff) {
    PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
      m,
      game,
      wPartyId,
      ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c,
      0,
    )
  }
  return 0
}

/**
 * [36/45] ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c
 * @dll D2Game.dll
 * @va 0x6FCE5ED0
 * @ordinalOrName sub_6FCE5ED0
 */
export function ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE5ED0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0;
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0d) | 0) !== 0 &&
    pPlayer !== 0 &&
    (m.u32((pPlayer + 0x80) >>> 0) >>> 0) !== 0 &&
    (m.u32(pPlayer >>> 0) | 0) === 0
  ) {
    const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayer >>> 0, pGame >>> 0) & 0xffff;
    if (wPartyId !== 0xffff) {
      PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
        m,
        pGame >>> 0,
        wPartyId,
        ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c,
        0,
      );
    }
  }
  return 0;
}

/**
 * [37/45] ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c
 * @dll D2Game.dll
 * @va 0x6FCE6070
 * @ordinalOrName sub_6FCE6070
 */
export function ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FCE6070)
  const pPlayerRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0;
  if (pPlayerRoom === 0) return 0;
  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
  let pQuest = pQuestChain !== 0 ? m.u32(pQuestChain) >>> 0 : 0;
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 8) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0;
  }
  if (pQuest === 0) {
    throw new D2CommonAssertError('Quests.cpp', 0x186);
  }
  const pQuestExt = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  let inRoomOrAdj = 0;
  if (pPlayerRoom === (m.u32((pQuestExt + 0x04) >>> 0) >>> 0)) {
    inRoomOrAdj = 1;
  } else {
    const pRoom2 = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0;
    if (pRoom2 === 0) {
      throw new D2CommonAssertError('Quests.cpp', 0x195);
    }
    const prevSp = k2W6B3StackPtr;
    const sp = (prevSp - 0x10) >>> 0;
    k2W6B3StackPtr = sp;
    try {
      m.setU32(sp, 0);
      m.setU32((sp + 4) >>> 0, 0);
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom2, sp, (sp + 4) >>> 0);
      const ppRooms = m.u32(sp) >>> 0;
      const nRooms = m.u32((sp + 4) >>> 0) | 0;
      for (let i = 0; i < nRooms; i++) {
        if ((m.u32((ppRooms + i * 4) >>> 0) >>> 0) === (m.u32((pQuestExt + 0x04) >>> 0) >>> 0)) {
          inRoomOrAdj = 1;
          break;
        }
      }
    } finally {
      k2W6B3StackPtr = prevSp;
    }
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0;
  const nQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0;
  if (
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0) | 0) === 0 &&
    (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 1) | 0) === 0 &&
    inRoomOrAdj !== 0
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, m.u32((pQuest + 0xe0) >>> 0) | 0, 0x0d);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, m.u32((pQuest + 0xe0) >>> 0) | 0, 1);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 5);
    QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer >>> 0, m.u32((pQuest + 0x04) >>> 0) >>> 0);
    const wPartyId = SUNITDMG_GetPlayerClientClassId113c(m, pPlayer >>> 0) & 0xffff;
    if (wPartyId !== 0xffff) {
      PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
        m,
        pGame >>> 0,
        wPartyId,
        ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c,
        0,
      );
    }
  }
  return 0;
}

/**
 * [38/45] ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c
 * @dll D2Game.dll
 * @va 0x6FCE9B70
 * @ordinalOrName sub_6FCE9B70
 */
export function ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c(
  m: D2KernMemory113c,
  pPresetArgs: number,
  pQuestData: number,
  hooks?: K2W6B3Hooks113c,
): void {
  hitD2GameVa113c(0x6FCE9B70)
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0;
  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
  if ((m.u32((pQuestChain + 0x08) >>> 0) | 0) === 0) {
    throw new D2CommonAssertError('Quests.cpp', 0x82c);
  }
  const pQuestExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0;
  const pGlobalFlags = m.u32((pQuestChain + 0x0c) >>> 0) >>> 0;
  if ((DRLGWARP_TestRoomTileBit113c(m, pGlobalFlags, 0x0e, 0x0d) | 0) !== 1) {
    const spawnX = ((m.u32((pPresetArgs + 0x14) >>> 0) | 0) + 1) >>> 0;
    const spawnY = m.u32((pPresetArgs + 0x18) >>> 0) >>> 0;
    const pRoom = m.u32((pPresetArgs + 0x08) >>> 0) >>> 0;
    m.setU32((pQuestExt + 0x30) >>> 0, spawnX);
    m.setU32((pQuestExt + 0x34) >>> 0, spawnY);
    const prevSp = k2W6B3StackPtr;
    const sp = (prevSp - 0x30) >>> 0;
    k2W6B3StackPtr = sp;
    try {
      m.setU32(sp, m.u32((pQuestData + 0x04) >>> 0) >>> 0);
      m.setU32((sp + 0x04) >>> 0, pRoom);
      m.setU32((sp + 0x08) >>> 0, 0);
      m.setU32((sp + 0x0c) >>> 0, 0x14b);
      m.setU32((sp + 0x10) >>> 0, 1);
      m.setU32((sp + 0x14) >>> 0, 0);
      m.setU32((sp + 0x18) >>> 0, spawnX);
      m.setU32((sp + 0x1c) >>> 0, spawnY);
      m.setU32((sp + 0x20) >>> 0, 0xffffffff);
      m.setU16((sp + 0x24) >>> 0, 0);
      MONSTER_Create113c(m, sp, hooks ? hooks.regpop : undefined);
    } finally {
      k2W6B3StackPtr = prevSp;
    }
  }
  const pGameFromPreset = m.u32(pPresetArgs >>> 0) >>> 0;
  const pUnitFromPreset = m.u32((pPresetArgs + 0x04) >>> 0) >>> 0;
  EVENT_SetEventFull113c(
    m,
    pGameFromPreset,
    pUnitFromPreset,
    7,
    ((m.u32((pGameFromPreset + 0xa8) >>> 0) | 0) + 1) >>> 0,
    0,
    0,
    0,
  );
  const ioX = m.u32((pPresetArgs + 0x14) >>> 0) >>> 0;
  const ioY = m.u32((pPresetArgs + 0x18) >>> 0) >>> 0;
  if (m.u8((pQuestExt + 0x0d) >>> 0) === 0) {
    const pGame2 = m.u32((pQuestData + 0x04) >>> 0) >>> 0;
    const pQuestChain2 = m.u32((pGame2 + 0x10f4) >>> 0) >>> 0;
    if ((m.u32((pQuestChain2 + 0x08) >>> 0) | 0) === 0) {
      throw new D2CommonAssertError('Quests.cpp', 0x82c);
    }
    const pGlobalFlags2 = m.u32((pQuestChain2 + 0x0c) >>> 0) >>> 0;
    if (
      (DRLGWARP_TestRoomTileBit113c(m, pGlobalFlags2, 8, 0x0d) | 0) !== 0 ||
      (QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32((pQuestData + 0x04) >>> 0) >>> 0, 9, 0x0d) | 0) !== 0 ||
      (ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, m.u32((pQuestData + 0x04) >>> 0) >>> 0) & 0xff) !== 0
    ) {
      const prevSp = k2W6B3StackPtr;
      const ioSp = (prevSp - 0x10) >>> 0;
      k2W6B3StackPtr = ioSp;
      try {
        m.setU32(ioSp, ioX);
        m.setU32((ioSp + 4) >>> 0, ioY);
        ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c(
          m,
          ioSp,
          pQuestData >>> 0,
          m.u32((pPresetArgs + 0x08) >>> 0) >>> 0,
        );
      } finally {
        k2W6B3StackPtr = prevSp;
      }
    }
  }
}

/**
 * [39/45] NET_BroadcastSystemChatMessage_6FCEBE70_113c
 * @dll D2Game.dll
 * @va 0x6FCEBE70
 * @ordinalOrName sub_6FCEBE70
 */
export function NET_BroadcastSystemChatMessage_6FCEBE70_113c(
  m: D2KernMemory113c,
  pMessageBytes: number,
  pGame: number,
  nColorByte: number,
): void {
  hitD2GameVa113c(0x6FCEBE70)
  const prevSp = k2W6B3StackPtr;
  const sp = (prevSp - 0x120) >>> 0;
  k2W6B3StackPtr = sp;
  try {
    m.setU8(sp, 0x26);
    m.setU8((sp + 0x01) >>> 0, 0x01);
    m.setU8((sp + 0x02) >>> 0, 0x00);
    m.setU8((sp + 0x03) >>> 0, 0x02);
    m.setU32((sp + 0x04) >>> 0, 0);
    m.setU8((sp + 0x08) >>> 0, nColorByte & 0xff);
    m.setU8((sp + 0x09) >>> 0, 0);
    m.setU8((sp + 0x0a) >>> 0, 0);
    for (let i = 0x0b; i < 0x1a; i++) {
      m.setU8((sp + i) >>> 0, 0);
    }
    for (let i = 0; i < 0x40; i++) {
      m.setU32((sp + 0x1a + i * 4) >>> 0, pMessageBytes !== 0 ? m.u32((pMessageBytes + i * 4) >>> 0) >>> 0 : 0);
    }
    CLIENTS_ForEachInGameClient113c(m, pGame >>> 0, 0x6fceb580, sp, (mem, pClient, pCtx) => {
      NET_SendChatMessagePacket26Wrapper_6FCEB580_113c(mem, pClient >>> 0, pCtx >>> 0);
    });
  } finally {
    k2W6B3StackPtr = prevSp;
  }
}

/**
 * [40/45] PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c
 * @dll D2Game.dll
 * @va 0x6FCEC030
 * @ordinalOrName sub_6FCEC030
 */
export function PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pUnit: number,
  bForceSync = 0,
): number {
  hitD2GameVa113c(0x6FCEC030)
  if (pPlayer === 0 || pUnit === 0 || (m.u32(pPlayer >>> 0) | 0) !== 0) {
    return 0;
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
  const pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0;
  if (pClient === 0) return 0;
  const pSyncState = CLIENTS_GetSaveHeaderPtr_6FC69240_113c(m, pClient) >>> 0;
  if (pSyncState === 0) return 0;

  const curLife = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 6, 0) | 0) >> 8;
  const maxLife = (STATLIST_GetMaxLifeFromUnit113c(m, pUnit >>> 0) | 0) >> 8;
  if (maxLife <= 0) return 0;

  const prevLife = m.u16((pSyncState + 0x04) >>> 0);
  let diffLife = (prevLife - curLife) | 0;
  if (diffLife < 0) diffLife = (-diffLife) | 0;
  if ((bForceSync | 0) === 0) {
    const pctDiff = sdiv32(imul32(diffLife, 100), maxLife);
    if (pctDiff < 10 || (curLife === 0 && prevLife === 0)) {
      return 0;
    }
  }

  const posX = UNIT_GetPosX113c(m, pUnit >>> 0) | 0;
  const posY = UNIT_GetPosY113c(m, pUnit >>> 0) | 0;
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0;
  let bDx = 0;
  let bDy = 0;
  if (pPath !== 0) {
    const firstX = PATH_GetFirstPointX113c(m, pPath) | 0;
    bDx = (posX - firstX) & 0xff;
    const firstY = PATH_GetFirstPointY113c(m, pPath) | 0;
    bDy = (posY - firstY) & 0xff;
  }

  const curMana = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 8, 0) | 0) >> 8;
  const curStamina = (STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0a, 0) | 0) >> 8;
  const curGold = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0e, 0) | 0;
  const curExp = STATLIST_GetUnitStat113c(m, pUnit >>> 0, 0x0d, 0) | 0;
  const bLifeRegen = PLAYER_CalcHealingPotionPercent_6FCEB840_113c(m, pUnit >>> 0) & 0xff;
  const bManaRegen = PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c(m, pUnit >>> 0) & 0xff;

  let updateCoordsAndResetTick = false;
  if (
    m.u8((pSyncState + 0x0a) >>> 0) !== bLifeRegen ||
    m.u8((pSyncState + 0x0b) >>> 0) !== bManaRegen
  ) {
    NET_SendPacket18_HpManaPot_6FCAB8C0_113c(
      m,
      pClient,
      curLife & 0xffff,
      curMana & 0xffff,
      curStamina & 0xffff,
      bLifeRegen,
      bManaRegen,
      posX & 0xffff,
      posY & 0xffff,
      sx8(bDx),
      sx8(bDy),
    );
    updateCoordsAndResetTick = true;
  } else if (
    m.u16((pSyncState + 0x04) >>> 0) !== (curLife & 0xffff) ||
    m.u16((pSyncState + 0x06) >>> 0) !== (curMana & 0xffff)
  ) {
    NET_SendPacket95_LifeManaStamina_6FCAB7F0_113c(
      m,
      pClient,
      curLife & 0xffff,
      curMana & 0xffff,
      curStamina & 0xffff,
      posX & 0xffff,
      posY & 0xffff,
      sx8(bDx),
      sx8(bDy),
    );
    updateCoordsAndResetTick = true;
  } else {
    const tickCounter = m.u32(pSyncState) | 0;
    let send96 = false;
    if (m.u16((pSyncState + 0x08) >>> 0) !== (curStamina & 0xffff)) {
      send96 = true;
    } else if (tickCounter > 3) {
      let dxPrev = (m.u16((pSyncState + 0x0c) >>> 0) - (posX & 0xffff)) | 0;
      if (dxPrev < 0) dxPrev = (-dxPrev) | 0;
      let dyPrev = (m.u16((pSyncState + 0x0e) >>> 0) - (posY & 0xffff)) | 0;
      if (dyPrev < 0) dyPrev = (-dyPrev) | 0;
      if (dxPrev >= 2 || dyPrev >= 2) {
        send96 = true;
      }
    }
    if (send96) {
      NET_SendPacket96_WalkVerify_6FCAB750_113c(
        m,
        pClient,
        curStamina & 0xffff,
        posX & 0xffff,
        posY & 0xffff,
        sx8(bDx),
        sx8(bDy),
      );
      updateCoordsAndResetTick = true;
    } else {
      m.setU32(pSyncState, (tickCounter + 1) >>> 0);
    }
  }

  if (updateCoordsAndResetTick) {
    m.setU16((pSyncState + 0x0c) >>> 0, posX & 0xffff);
    m.setU16((pSyncState + 0x0e) >>> 0, posY & 0xffff);
    m.setU16((pSyncState + 0x10) >>> 0, bDx & 0xff);
    m.setU16((pSyncState + 0x12) >>> 0, bDy & 0xff);
    m.setU32(pSyncState, 0);
  }

  const prevGold = m.u32((pSyncState + 0x14) >>> 0) | 0;
  if (curGold !== prevGold) {
    NET_SendPacket19_1D1E1F_GoldUpdate_6FCABE10_113c(m, pClient, curGold, prevGold);
    m.setU32((pSyncState + 0x14) >>> 0, curGold >>> 0);
  }
  const prevExp = m.u32((pSyncState + 0x18) >>> 0) | 0;
  if (curExp !== prevExp) {
    NET_SendPacket1A1B1C_StatUpdate_6FCABDA0_113c(m, pClient, curExp, prevExp);
    m.setU32((pSyncState + 0x18) >>> 0, curExp >>> 0);
  }

  m.setU16((pSyncState + 0x08) >>> 0, curStamina & 0xffff);
  m.setU16((pSyncState + 0x06) >>> 0, curMana & 0xffff);
  m.setU8((pSyncState + 0x0a) >>> 0, bLifeRegen & 0xff);
  m.setU16((pSyncState + 0x04) >>> 0, curLife & 0xffff);
  m.setU8((pSyncState + 0x0b) >>> 0, bManaRegen & 0xff);
  return 1;
}

/**
 * [41/45] PACKET_SrvMercMoveToCoord_6FCED360_113c
 * @dll D2Game.dll
 * @va 0x6FCED360
 * @ordinalOrName sub_6FCED360
 */
export function PACKET_SrvMercMoveToCoord_6FCED360_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCED360)
  if ((nPacketLen | 0) !== 0x0d) return 3;
  const dwMercGuid = m.u32((pPacket + 0x01) >>> 0) >>> 0;
  const wX = m.u16((pPacket + 0x05) >>> 0);
  const wY = m.u16((pPacket + 0x09) >>> 0);
  const err = C2S_CheckCoordDeltaExceeded113c(m, pPlayer >>> 0, wX, wY, 0x32) | 0;
  if (err !== 0) return err;
  PLAYER_IssueMercAiMoveCommand_6FCEC750_113c(
    m,
    pGame >>> 0,
    dwMercGuid,
    pPlayer >>> 0,
    wX,
    wY,
    0x0d,
  );
  return 0;
}

/**
 * [42/45] PACKET_SrvMercMoveToUnit_6FCED3D0_113c
 * @dll D2Game.dll
 * @va 0x6FCED3D0
 * @ordinalOrName sub_6FCED3D0
 */
export function PACKET_SrvMercMoveToUnit_6FCED3D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCED3D0)
  if ((nPacketLen | 0) !== 0x0d) return 3;
  const dwMercGuid = m.u32((pPacket + 0x01) >>> 0) >>> 0;
  const dwTargetGuid = m.u32((pPacket + 0x05) >>> 0) >>> 0;
  const dwTargetType = m.u32((pPacket + 0x09) >>> 0) >>> 0;
  if (dwTargetType >= 6) return 2;
  const pTarget = SUNIT_GetServerUnit113c(m, pGame >>> 0, dwTargetType, dwTargetGuid) >>> 0;
  if (pTarget === 0 || (C2S_ValidateTargetUnitDistance113c(m, pPlayer >>> 0, pTarget) | 0) === 0) {
    return 1;
  }
  const distErr =
    C2S_CheckCoordDeltaExceeded113c(
      m,
      pPlayer >>> 0,
      getUnitXInline113c(m, pTarget),
      getUnitYInline113c(m, pTarget),
      0x32,
    ) | 0;
  if (distErr !== 0) return distErr;
  return (
    PLAYER_IssueMercAiMoveCommand_6FCEC750_113c(
      m,
      pGame >>> 0,
      dwMercGuid,
      pPlayer >>> 0,
      dwTargetGuid,
      dwTargetType,
      0x0c,
    ) | 0
  );
}

/**
 * [43/45] SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c
 * @dll D2Game.dll
 * @va 0x6FD00BF0
 * @ordinalOrName sub_6FD00BF0
 */
export function SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD00BF0)
  const bInteracting = m.u8((pPlayer + 0x6c) >>> 0);
  const dwInteractUnitId = m.u32((pPlayer + 0x64) >>> 0) >>> 0;
  const dwInteractUnitType = m.u32((pPlayer + 0x68) >>> 0) >>> 0;
  if (bInteracting === 0) return;
  const pTargetUnit = SUNIT_GetServerUnit113c(m, pGame >>> 0, dwInteractUnitType, dwInteractUnitId) >>> 0;
  if (pTargetUnit === 0) return;

  const dwType = m.u32(pTargetUnit) | 0;
  if (dwType === 1) {
    const pMonsterData = m.u32((pTargetUnit + 0x14) >>> 0) >>> 0;
    const pInteract = pMonsterData !== 0 ? m.u32((pMonsterData + 0x30) >>> 0) >>> 0 : 0;
    MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c(m, pInteract, pPlayer >>> 0, pGame >>> 0);
    NPCS_FreePlayerGambleAndMercNodesForNpc_6FCAFAF0_113c(m, pTargetUnit, pPlayer >>> 0, pGame >>> 0);
  } else if (dwType === 2) {
    const dwClassId = m.u32((pTargetUnit + 0x04) >>> 0) | 0;
    if (dwClassId === 0x151) {
      const pField7C = UNITS_GetField7C_113c(m, pTargetUnit) >>> 0;
      const pSub = pField7C !== 0 ? m.u32(pField7C) >>> 0 : 0;
      if (pSub !== 0) {
        m.setU32(pSub, 0xffffffff);
      }
    } else {
      UNITS_ChangeAnimMode113c(m, pTargetUnit, 0);
    }
  }

  m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff);
  m.setU32((pPlayer + 0x68) >>> 0, 6);
  m.setU8((pPlayer + 0x6c) >>> 0, 0);
}

/**
 * [44/45] ACT3Q0_InitQuestData_6FD05920_113c
 * @dll D2Game.dll
 * @va 0x6FD05920
 * @ordinalOrName sub_6FD05920
 */
export function ACT3Q0_InitQuestData_6FD05920_113c(
  m: D2KernMemory113c,
  pQuestData: number,
): void {
  hitD2GameVa113c(0x6FD05920)
  void ACT3Q0_ActiveFilter113c;
  void ACT3Q0_StatusFilter113c;
  void ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c;
  for (let i = 0; i < 0x0f; i++) {
    m.setU32((pQuestData + 0xa0 + i * 4) >>> 0, 0);
  }
  m.setU32((pQuestData + 0xdc) >>> 0, 0);
  m.setU8((pQuestData + 0x0c) >>> 0, 0);
  m.setU8((pQuestData + 0x0b) >>> 0, 0);
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0;
  m.setU32((pQuestData + 0xd4) >>> 0, 0x6fd03050);
  m.setU8((pQuestData + 0x0a) >>> 0, 1);
  if (pGame !== 0) {
    void m.u32((pGame + 0x1c) >>> 0);
  }
  const pExt = m.alloc(0x14) >>> 0;
  m.setU32((pQuestData + 0x18) >>> 0, pExt);
  m.setU32(pExt, 0);
  m.setU32((pExt + 0x04) >>> 0, 0);
  m.setU32((pExt + 0x08) >>> 0, 0);
  m.setU32((pExt + 0x0c) >>> 0, 0);
  m.setU32((pExt + 0x10) >>> 0, 0);
  const pExt2 = m.u32((pQuestData + 0x18) >>> 0) >>> 0;
  m.setU32((pQuestData + 0xe0) >>> 0, 0x10);
  m.setU32((pQuestData + 0xe8) >>> 0, 0x6fd028b0);
  m.setU32((pQuestData + 0xec) >>> 0, 0x6fd028a0);
  m.setU8((pExt2 + 0x01) >>> 0, 1);
}

/**
 * [45/45] ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c
 * @dll D2Game.dll
 * @va 0x6FD05B60
 * @ordinalOrName sub_6FD05B60
 */
export function ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FD05B60)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0;
  const nDiff = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0;
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) | 0) === 1) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0;
  if (pRoom === 0) return 0;
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  const bAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff;
  if (bAct !== 2) return 0;
  ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c(
    m,
    pQuestFlags,
    pPlayer >>> 0,
    pGame >>> 0,
  );
  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
  if (pQuestChain !== 0) {
    let pQuest = m.u32(pQuestChain) >>> 0;
    while (pQuest !== 0) {
      if ((m.u32(pQuest) | 0) === 0x14) {
        const pQuestExt = m.u32((pQuest + 0x18) >>> 0) >>> 0;
        m.setU32((pQuestExt + 0x1c) >>> 0, ((m.u32((pQuestExt + 0x1c) >>> 0) | 0) + 1) >>> 0);
        break;
      }
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0;
    }
  }
  return 0;
}
