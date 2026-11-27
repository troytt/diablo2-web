/**
 * Diablo II v1.13c `D2Game.dll` Monster AI, Spawn, State, & Target Pipeline (`[K2]` Wave 4 Batch 7 `w4b7`):
 * 45 functions in `0x6FCC59B0 .. 0x6FCD36A0` (`D2Game.dll` image base `0x6FC20000`).
 */

import type { Memory113c } from '../mem/sparse-memory.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import {
  AIGENERAL_BroadcastCmdToMinions113c,
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CastSkillWithMode113c,
  AI_StartAttackMode113c,
  MONSTER_CheckTypeFlagsMask113c,
} from './ai-fallen-113c.ts'
import {
  AIGENERAL_CopyAiCommandParams113c,
  AI_FleeFrom113c,
  AI_GeneralFindTargetOrThrottle113c,
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SUNITDMG_ApplyDamage113c,
  SUNITDMG_ApplySideEffectsAndKill113c,
} from './combat-a1c-113c.ts'
import { AI_ApproachTarget113c } from './k2-real-s2c-combat-113c.ts'
import {
  AIGENERAL_ForEachPackMember_6FC41490_113c,
} from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  AIGENERAL_RemoveFromMinionList_6FC416A0_113c,
} from './k2-w3b2-113c.ts'
import {
  AITARGET_ScanUnitsByModeTable113c,
} from './town-runtime-gap-113c.ts'
import {
  AI_ApproachTargetPathType13_6FD13000_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
} from './k2-w2b8-113c.ts'
import {
  AI_CheckAnyMinionDeadCallback113c,
} from './k2-items-tc-w1-113c.ts'
import {
  AI_InitMonsterAiThinkFn113c,
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_CheckModeBit113c,
  MONSTATS2_GetRecordPtr113c,
  MONSTATS_GetRecordPtr113c,
  MONSTER_GetPlayerCountExpBonusPct113c,
  MONSTER_InitMonsterUnit113c,
  SEED_RollLimitedFast113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import {
  STATES_CheckState113c,
  STATES_SetMonsterSkillIconOnUnit113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.ts'
import {
  SKILLS_SetUsedSkillMemPort113c,
  SKILLS_GetUsedSkillMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  PATH_Compute113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetUnit113c,
  PATH_GetType113c,
  PATH_SetNewDistance113c,
  PATH_SetTargetPos113c,
  PATH_SetTargetUnit113c,
  PATH_SetType113c,
} from '../common/path.ts'
import {
  EVENT_DeleteEventByArg14_113c,
  EVENT_FreeNode113c,
  EVENT_SetEventFull113c,
} from './timer-wheel.ts'
import { registerMonsterAiThinkVaHandler113c } from './monster-events.ts'
import {
  ANIMSEQ_GetUnitSeqFrameCountFp8_113c,
  ANIMSEQ_GetUnitSeqRecordPtr113c,
  UNITROOM_RefreshUnit113c,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_FindFreeCoords113c,
  UNITS_GetRoom113c,
  UNITS_GetShiftedFrameMetrics113c,
  UNITS_GetUnitSizeX113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNITS_SetSeqFrameFromLowByte113c,
  UNITS_SetUnitAnimMode113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import {
  SKILLS_CanMonsterReviveInMode2_113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_GetLeftSkillFromSkillList113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillNumTargetsOrShots113c,
  SKILLS_SetParam0C113c,
  SKILLS_SetParam1113c,
  SKILLS_SetParam2113c,
  SKILLS_SetParam3113c,
} from '../common/skills.ts'
import {
  MONAI_GetUnitMeleeVelocity_6FCD08A0_113c,
  MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c,
  MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c,
  SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c,
} from './k2-w2b5-113c.ts'
import {
  UNITS_SetAnimSpeed113c,
  UNITS_SetTargetUnitForDynamicUnit113c,
} from '../common/waypoint.ts'
import {
  MONSTER_CheckMonTypeFlag0x20_113c,
} from '../common/drlg/drlg-ver.ts'
import {
  MISSILE_GetTotalFrames113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetTotalFrames113c,
  MONSTERS_GetHirelingTypeId113c,
} from '../common/missile.ts'
import {
  DATATBLS_GetArenaTxtRecord113c,
  MONSTERS_CheckMonStatsFlagBit6_113c,
  MONSTERS_IsDead113c,
} from '../tables/datatbls-113c.ts'
import {
  mulDiv113c,
} from '../common/int-math.ts'
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts'
import {
  ITEMS_CheckCommandFlags113c,
  ITEMS_GetMagicLevelFromItem113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items.ts'
import {
  ANIMSEQ_GetEventAtFrame113c,
  UNITS_GetPlayerData113c,
} from '../common/composit.ts'
import {
  NET_QueuePacketToClientBuffer113c,
} from './boot-init-gap-a-113c.ts'
import {
  STATES_CreateOrUpdateAuraStatList113c,
} from './k2-gap-itemdef-113c.ts'
import {
  COLLISION_ResetMaskWithPattern113c,
} from '../common/collision.ts'
import {
  D2GAME_SUNIT_GetGameFromUnit113c,
} from './boot-init-gap-b-113c.ts'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetRoomCoordListIndexAtSubtile113c,
} from '../common/dungeon.ts'
import {
  MONSTER_DestroyMonsterUnit113c,
} from './a1c-post150-f150-f276-113c.ts'
import {
  MONSTER_GetAiGeneralPtr_6FC218E0_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  SEED_InitLowSeed113c,
  SEED_InitSeed113c,
  seedRoll,
} from '../prng.ts'
import {
  SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c,
} from './k2-w2b4-113c.ts'
import {
  SKILLS_ExecuteSkillDoFunc113c,
  SUNIT_AreUnitsHostileOrUnaligned113c,
} from './a1c-post150-f786-f1040-113c.ts'
import {
  SKILLS_GetFlags113c,
} from './replay-kernel-113c.ts'
import {
  SUNIT_GetServerUnit113c,
} from './game-strc.ts'
import {
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type D2KernMemory113c = Memory113c

let k2W4B7StackPtr = 0x7ea40000

function i32(m: D2KernMemory113c, p: number): number {
  return m.u32(p >>> 0) | 0
}

function sx16(v: number): number {
  return (v << 16) >> 16
}

function getSgptDataTablesPtr(m: D2KernMemory113c): number {
  const ppDataTables = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C >>> 0) >>> 0
  return ppDataTables !== 0 ? m.u32(ppDataTables) >>> 0 : 0
}

function allocScratch(_m: D2KernMemory113c, size: number): number {
  const aligned = (size + 7) & ~7
  k2W4B7StackPtr = (k2W4B7StackPtr - aligned) >>> 0
  return k2W4B7StackPtr
}

function freeScratch(_m: D2KernMemory113c, size: number): void {
  const aligned = (size + 7) & ~7
  k2W4B7StackPtr = (k2W4B7StackPtr + aligned) >>> 0
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

function stepUnitSeedMod(m: D2KernMemory113c, pSeed: number, mod: number): number {
  const nextLo = stepSeed64At113c(m, pSeed) >>> 0
  return mod > 0 ? (nextLo % (mod >>> 0)) | 0 : 0
}

function rollLimitedSeed6FC21180(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const seed = {
    lo: m.u32(pSeed >>> 0) >>> 0,
    hi: m.u32((pSeed + 4) >>> 0) >>> 0,
  }
  const rolled = seedRoll(seed, nMax | 0) | 0
  m.setU32(pSeed >>> 0, seed.lo >>> 0)
  m.setU32((pSeed + 4) >>> 0, seed.hi >>> 0)
  return rolled
}

/**
 * Clears `STATE_UNINTERRUPTABLE` (`0x0C`) on `pUnit`, re-initializes the monster AI think function
 * via `AI_InitMonsterAiThinkFn113c`, restores command `10` (`pCmd->dwCmdType == 10`) if it was removed,
 * and stalls for `1` frame via `AI_Stall113c`.
 *
 * @va D2Game:0x6FCC59B0 (264B)
 */
export function MONAI_UnburrowThink_6FCC59B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC59B0)
  const pAiCtrl = pAiParam !== 0 ? m.u32(pAiParam >>> 0) >>> 0 : 0
  let savedParam1 = 0
  let savedParam2 = 0
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0) {
        const pCmdHead = m.u32((pAiGen + 0x20) >>> 0) >>> 0
        if (pCmdHead !== 0) {
          let pCur = m.u32(pCmdHead) >>> 0
          if ((m.u32((pCur + 0x08) >>> 0) | 0) !== 10) {
            while (pCur !== pCmdHead && pCur !== 0) {
              pCur = m.u32(pCur) >>> 0
              if (pCur === 0 || (m.u32((pCur + 0x08) >>> 0) | 0) === 10) break
            }
          }
          if (pCur !== 0 && (m.u32((pCur + 0x08) >>> 0) | 0) === 10) {
            savedParam1 = m.u32((pCur + 0x0c) >>> 0) >>> 0
            savedParam2 = m.u32((pCur + 0x10) >>> 0) >>> 0
          }
        }
      }
    }
  }
  if (STATES_CheckState113c(m, pUnit >>> 0, 0x0c) !== 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, 0x0c, 0)
  }
  const nSpecAi = pAiCtrl !== 0 ? (m.u32(pAiCtrl) | 0) : 0
  AI_InitMonsterAiThinkFn113c(m, pUnit >>> 0, pGame >>> 0, pAiCtrl, nSpecAi)

  let hasCmd10 = false
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      const pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
      if (pAiGen !== 0) {
        const pCmdHead = m.u32((pAiGen + 0x20) >>> 0) >>> 0
        if (pCmdHead !== 0) {
          let pCur = m.u32(pCmdHead) >>> 0
          if ((m.u32((pCur + 0x08) >>> 0) | 0) !== 10) {
            while (pCur !== pCmdHead && pCur !== 0) {
              pCur = m.u32(pCur) >>> 0
              if (pCur === 0 || (m.u32((pCur + 0x08) >>> 0) | 0) === 10) break
            }
          }
          if (pCur !== 0 && (m.u32((pCur + 0x08) >>> 0) | 0) === 10) {
            hasCmd10 = true
          }
        }
      }
    }
  }
  if (!hasCmd10 && savedParam1 !== 0 && savedParam2 !== 0) {
    AIGENERAL_CopyAiCommandParams113c(m, pUnit >>> 0, 10, savedParam1, savedParam2, 0, 0)
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 1)
}

/**
 * Executes attack mode `4` (`A1`) when `bInMeleeRange != 0`, `MonStatsTxt` flag `+0x0D` bit `1` is clear,
 * and `MONSTATS2_CheckModeBit113c(classId, 4) != 0`; otherwise rolls `20%` `AI_IdleWander113c` vs `80%` `AI_Stall113c(10)`.
 *
 * @va D2Game:0x6FCC5B30 (333B)
 */
export function MONAI_NestOrMeleeWanderThink_6FCC5B30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC5B30)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const bInMelee = m.u32((pAiParam + 0x18) >>> 0) | 0
  if (bInMelee !== 0) {
    let blockedByFlag = false
    const nClassId = pUnit !== 0 ? m.u32((pUnit + 0x04) >>> 0) | 0 : -1
    if (pUnit !== 0 && nClassId >= 0) {
      const pTables = getSgptDataTablesPtr(m)
      if (pTables !== 0 && nClassId < (m.u32((pTables + 0xa80) >>> 0) | 0)) {
        const pMonStats = (m.u32((pTables + 0xa78) >>> 0) + Math.imul(nClassId, 0x1a8)) >>> 0
        if (pMonStats !== 0) {
          const bFlags1 = m.u8((pMonStats + 0x0d) >>> 0)
          const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
          const mask1 = pMasks !== 0 ? m.u32((pMasks + 0x04) >>> 0) : 2
          if ((bFlags1 & mask1) !== 0) blockedByFlag = true
        }
      }
    }
    if (!blockedByFlag && MONSTATS2_CheckModeBit113c(m, nClassId, 4) !== 0) {
      SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
      let pathTypeArg = 0x64
      if (pUnit !== 0) {
        const pMon2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0) >>> 0
        if (pMon2 !== 0) {
          const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
          const mask4 = pMasks !== 0 ? m.u32((pMasks + 0x10) >>> 0) : 0x10
          if ((m.u8((pMon2 + 0x104) >>> 0) & mask4) !== 0) {
            pathTypeArg = 0x65
          }
        }
      }
      MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0, pathTypeArg)
      return
    }
  }
  const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
  if ((roll | 0) < 0x14) {
    AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, 3)
    return
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
}

/**
 * Checks whether a minion's pack has any dead member (`AI_CheckAnyMinionDeadCallback113c`), `alwaysChase`,
 * or `dist < 20` (or command `8`), broadcasting command `8` to pack minions, unlinking from the minion list,
 * and switching back to the monster's base AI think function (`nSpecialAi = 0`).
 *
 * @va D2Game:0x6FCC5C80 (191B)
 */
export function MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC5C80)
  const dist = m.u32((pAiParam + 0x14) >>> 0) | 0
  let hasCmd8 = false
  if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    const pAiGen = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
    const pCmd = pAiGen !== 0 ? m.u32((pAiGen + 0x20) >>> 0) >>> 0 : 0
    if (pCmd !== 0 && (m.u32((pCmd + 0x08) >>> 0) | 0) === 8) {
      hasCmd8 = true
    }
  }
  const sp = (k2W4B7StackPtr - 0x28) >>> 0
  k2W4B7StackPtr = sp
  try {
    if (!hasCmd8) {
      const pHasDead = sp
      m.setU32(pHasDead, 0)
      AIGENERAL_ForEachPackMember_6FC41490_113c(
        m,
        pUnit >>> 0,
        AI_CheckAnyMinionDeadCallback113c,
        pHasDead,
        0,
      )
      let alwaysChase = false
      if (pUnit !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
        const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          const f54 = m.u32((pMonData + 0x54) >>> 0) | 0
          if (f54 === 3 || f54 === 0x13) alwaysChase = true
        }
      }
      if (!alwaysChase && m.u32(pHasDead) === 0 && dist >= 20) {
        AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
        return
      }
      const pCmdBuf = (sp + 4) >>> 0
      m.fill(pCmdBuf, 0x1c, 0)
      m.setU32((pCmdBuf + 0x08) >>> 0, 8)
      AIGENERAL_BroadcastCmdToMinions113c(m, pUnit >>> 0, pGame >>> 0, pCmdBuf)
    }
    AIGENERAL_RemoveFromMinionList_6FC416A0_113c(m, pGame >>> 0, pUnit >>> 0)
    const pAiCtrl = m.u32(pAiParam >>> 0) >>> 0
    AI_InitMonsterAiThinkFn113c(m, pUnit >>> 0, pGame >>> 0, pAiCtrl, 0)
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
  } finally {
    k2W4B7StackPtr = (sp + 0x28) >>> 0
  }
}

/**
 * Monster AI think callback (`0x6FCC5D70`): when `pTarget != 0 && bInMeleeRange != 0`, rolls `aip1` to cast `wSkill1`
 * (`aip3` chance via `SEED_RollLimitedFast113c`) or `AI_StartAttackMode113c(4)`, else stalls `aip3`; when out of melee,
 * rolls `aip2` to walk toward `pTarget`, and always schedules `AI_ScheduleAiThinkTimer_6FD120C0_113c(aip4)`.
 *
 * @va D2Game:0x6FCC5D70 (318B)
 */
export function MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC5D70)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pSeed = (pUnit + 0x20) >>> 0
  if (pTarget !== 0 && m.u32((pAiParam + 0x18) >>> 0) !== 0) {
    const roll1 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const bDiff = m.u8((pGame + 0x6d) >>> 0)
    const aip1 = sx16(m.u16((pMonStatsTxt + bDiff * 2 + 0x56) >>> 0))
    if ((roll1 | 0) < aip1) {
      const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
      let didCast = false
      if (wSkill1 >= 0) {
        const roll2 = rollLimitedSeed6FC21180(m, pSeed, 100)
        const bDiff2 = m.u8((pGame + 0x6d) >>> 0)
        const aip3 = sx16(m.u16((pMonStatsTxt + bDiff2 * 2 + 0x62) >>> 0))
        if (roll2 < aip3) {
          const bMode1 = m.u8((pMonStatsTxt + 0x180) >>> 0)
          AI_CastSkillWithMode113c(m, bMode1, pUnit >>> 0, pGame >>> 0, wSkill1, pTarget, 0, 0)
          didCast = true
        }
      }
      if (!didCast) {
        AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pTarget)
      }
    } else {
      const aip3Stall = sx16(m.u16((pMonStatsTxt + bDiff * 2 + 0x62) >>> 0))
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, aip3Stall)
    }
  } else {
    const rollMove = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const bDiff = m.u8((pGame + 0x6d) >>> 0)
    const aip2 = sx16(m.u16((pMonStatsTxt + bDiff * 2 + 0x5c) >>> 0))
    if ((rollMove | 0) < aip2) {
      AI_ApproachTarget113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
    }
  }
  const bDiffEnd = m.u8((pGame + 0x6d) >>> 0)
  const aip4 = sx16(m.u16((pMonStatsTxt + bDiffEnd * 2 + 0x68) >>> 0))
  AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pUnit >>> 0, aip4)
}

/**
 * Monster AI think callback (`0x6FCC6530`): in melee range, rolls `aip1` for `MONSTER_StartMode(4)` vs `AI_Stall(15)`;
 * out of melee range, casts `wSkill1` if `wSkill1 >= 0 && dist < aip3 && roll < aip4`, else rolls `aip2` to approach,
 * else stalls `15` frames.
 *
 * @va D2Game:0x6FCC6530 (424B)
 */
export function MONAI_MeleeAndRangedSkillThink_6FCC6530_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC6530)
  const bInMelee = m.u32((pAiParam + 0x18) >>> 0) | 0
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const dist = m.u32((pAiParam + 0x14) >>> 0) | 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const pSeed = (pUnit + 0x20) >>> 0
  if (bInMelee !== 0) {
    const roll1 = (stepSeed64At113c(m, pSeed) >>> 0) % 100
    const bDiff = m.u8((pGame + 0x6d) >>> 0)
    const aip1 = sx16(m.u16((pMonStatsTxt + bDiff * 2 + 0x56) >>> 0))
    if ((roll1 | 0) >= aip1) {
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 15)
      return
    }
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    if (pUnit !== 0) {
      MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0)
    }
    MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    return
  }
  const wSkill1 = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
  if (wSkill1 >= 0) {
    const bDiff = m.u8((pGame + 0x6d) >>> 0)
    const aip3 = sx16(m.u16((pMonStatsTxt + bDiff * 2 + 0x62) >>> 0))
    if (dist < aip3) {
      const rollCast = (stepSeed64At113c(m, pSeed) >>> 0) % 100
      const bDiff2 = m.u8((pGame + 0x6d) >>> 0)
      const aip4 = sx16(m.u16((pMonStatsTxt + bDiff2 * 2 + 0x68) >>> 0))
      if ((rollCast | 0) < aip4) {
        const wSkillCast = sx16(m.u16((pMonStatsTxt + 0x170) >>> 0))
        const bMode1 = m.u8((pMonStatsTxt + 0x180) >>> 0)
        AI_CastSkillWithMode113c(m, bMode1, pUnit >>> 0, pGame >>> 0, wSkillCast, pTarget, 0, 0)
        return
      }
    }
  }
  const rollMove = (stepSeed64At113c(m, pSeed) >>> 0) % 100
  const bDiffMove = m.u8((pGame + 0x6d) >>> 0)
  const aip2 = sx16(m.u16((pMonStatsTxt + bDiffMove * 2 + 0x5c) >>> 0))
  if ((rollMove | 0) < aip2) {
    AI_ApproachTarget113c(m, pGame >>> 0, pUnit >>> 0, pTarget, 2, 0, 0, 1, 0)
    return
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 15)
}

/**
 * Checks if `pCaster` (`edi`) can cast `nSkillId` (`ecx`) on `pTarget` (`esi`, excluding `pSelfUnit` `eax`
 * and town rooms), running toward `pTarget` (`mode 15`, `flags 4`) when `SKILLS_GetSkillNumTargetsOrShots == 1`
 * and `bForceCast == 0`, or casting via `AI_CastSkillWithMode113c`.
 *
 * @va D2Game:0x6FCC6AB0 (182B)
 */
export function MONAI_TryCastLeftSkillOrRunTowardTarget_6FCC6AB0_113c(
  m: D2KernMemory113c,
  pSelfUnit: number,
  pTarget: number,
  pCaster: number,
  nSkillId: number,
  pGame: number,
  bForceCast: number,
  nX: number,
  nY: number,
): number {
  hitD2GameVa113c(0x6FCC6AB0)
  if (pTarget !== 0) {
    if ((pTarget >>> 0) === (pSelfUnit >>> 0) || (pTarget >>> 0) === (pCaster >>> 0)) {
      return 0
    }
  }
  const pSkill = SKILLS_GetSkillById113c(m, pCaster >>> 0, nSkillId | 0, -1) >>> 0
  if (pSkill === 0) return 0
  if (pTarget !== 0) {
    if (((m.u32((pTarget + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0
    const pRoom = UNITS_GetRoom113c(m, pCaster >>> 0) >>> 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 0
  }
  if ((SKILLS_GetSkillNumTargetsOrShots113c(m, pCaster >>> 0, pSkill) | 0) === 1) {
    if ((bForceCast | 0) === 0) {
      return AI_ApproachTarget113c(m, pGame >>> 0, pCaster >>> 0, pTarget >>> 0, 0x0f, 0, 0, 1, 4) | 0
    }
  }
  const mode = SKILLS_GetLeftSkillFromSkillList113c(m, pSkill) & 0xff
  return AI_CastSkillWithMode113c(
    m,
    mode,
    pCaster >>> 0,
    pGame >>> 0,
    nSkillId | 0,
    pTarget >>> 0,
    nX | 0,
    nY | 0,
  )
}

/**
 * Putrid Defiler AI think callback (`0x6FCC7290`): attacks in melee if `pTarget != 0 && bInMelee != 0`,
 * else scans `AITARGET_ScanUnitsByModeTable113c` with `MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c`
 * to cast `skill 0x12C` (`300`, mode `8`) or walk toward the candidate, else flees (`dist < aip1`) or stalls `25` frames.
 *
 * @va D2Game:0x6FCC7290 (370B)
 */
export function MONAI_PutridDefilerThink_6FCC7290_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC7290)
  const pTarget = m.u32((pAiParam + 0x08) >>> 0) >>> 0
  const pMonStatsTxt = m.u32((pAiParam + 0x1c) >>> 0) >>> 0
  const dist = m.u32((pAiParam + 0x14) >>> 0) | 0
  if (pTarget !== 0 && m.u32((pAiParam + 0x18) >>> 0) !== 0) {
    SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)
    if (pUnit !== 0) {
      MONSTATS2_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0)
    }
    MONSTER_StartMode113c(m, pGame >>> 0, pUnit >>> 0, 4, pTarget, 0, 0)
    return
  }
  void MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c
  const sp = (k2W4B7StackPtr - 0x28) >>> 0
  k2W4B7StackPtr = sp
  let pCandidate = 0
  try {
    m.fill(sp, 0x24, 0)
    m.setU32(sp, 0)
    m.setU32((sp + 4) >>> 0, 0x19)
    hitD2GameVa113c(0x6FCD17B0)
    pCandidate = MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(
      m,
      pUnit >>> 0,
      0x6fcc4180,
      pGame >>> 0,
      sp,
      MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c,
    ) >>> 0
  } finally {
    k2W4B7StackPtr = (sp + 0x28) >>> 0
  }
  if (pCandidate !== 0) {
    if (UNITS_CanUnitMeleeAttackTarget113c(m, pUnit >>> 0, pCandidate, 0) !== 0) {
      AI_CastSkillWithMode113c(m, 8, pUnit >>> 0, pGame >>> 0, 0x12c, pCandidate, 0, 0)
      return
    }
    AI_ApproachTarget113c(m, pGame >>> 0, pUnit >>> 0, pCandidate, 2, 0, 0, 1, 0)
    return
  }
  const bDiff = m.u8((pGame + 0x6d) >>> 0)
  const aip1 = sx16(m.u16((pMonStatsTxt + bDiff * 2 + 0x56) >>> 0))
  if (dist < aip1) {
    const fleeDist = m.u8((pMonStatsTxt + bDiff * 2 + 0x5c) >>> 0)
    AI_FleeFrom113c(m, pGame >>> 0, pUnit >>> 0, pTarget, fleeDist, 0)
    return
  }
  AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 0x19)
}

/**
 * Validates `pUnit->pPath`'s target unit (`SUNIT_ValidatePathTargetUnit113c`), chases or melee-attacks it
 * via `AI_ApproachTargetPathType13_6FD13000_113c` / `AI_StartAttackMode113c`, or resets to base AI when
 * the target is gone or in town.
 *
 * @va D2Game:0x6FCC7F60 (339B)
 */
export function MONAI_ImpregnateChaseThink_6FCC7F60_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FCC7F60)
  SUNIT_ValidatePathTargetUnit113c(m, pUnit >>> 0, pGame >>> 0)
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  const pPathTarget = PATH_GetTargetUnit113c(m, pPath) >>> 0
  if (pPathTarget !== (pUnit >>> 0) && pPathTarget !== 0) {
    const pTargetRoom = UNITS_GetRoom113c(m, pPathTarget) >>> 0
    if (DUNGEON_CheckRoomIsTownMemPort113c(m, pTargetRoom) === 0) {
      const pAiControl = m.u32(pAiParam >>> 0) >>> 0
      if (m.u32((pAiControl + 0x14) >>> 0) === 0) {
        m.setU32((pAiControl + 0x14) >>> 0, 1)
        AI_ApproachTargetPathType13_6FD13000_113c(m, pUnit >>> 0, pPathTarget, pGame >>> 0, 7)
        return
      }
      const canMelee = UNITS_CanUnitMeleeAttackTarget113c(m, pUnit >>> 0, pPathTarget, 0) | 0
      if (canMelee !== 0) {
        AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pPathTarget)
        return
      }
      const sp = (k2W4B7StackPtr - 0x28) >>> 0
      k2W4B7StackPtr = sp
      let pAltTarget = 0
      let altInMelee = 0
      try {
        m.fill(sp, 0x24, 0)
        AI_GeneralFindTargetOrThrottle113c(m, pGame >>> 0, pUnit >>> 0, sp)
        pAltTarget = m.u32((sp + 0x08) >>> 0) >>> 0
        altInMelee = m.u32((sp + 0x18) >>> 0) | 0
      } finally {
        k2W4B7StackPtr = (sp + 0x28) >>> 0
      }
      if (pAltTarget !== 0 && altInMelee !== 0) {
        m.setU32((pAiControl + 0x14) >>> 0, 0)
        AI_StartAttackMode113c(m, 4, pUnit >>> 0, pGame >>> 0, pAltTarget)
        return
      }
      m.setU32((pAiControl + 0x14) >>> 0, 1)
      UNITS_SetTargetUnitForDynamicUnit113c(m, pUnit >>> 0, pPathTarget)
      AI_ApproachTargetPathType13_6FD13000_113c(m, pUnit >>> 0, pPathTarget, pGame >>> 0, 7)
      return
    }
  }
  let pAiGen = 0
  if ((m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) pAiGen = m.u32((pMonData + 0x28) >>> 0) >>> 0
  }
  AI_InitMonsterAiThinkFn113c(m, pUnit >>> 0, pGame >>> 0, pAiGen, 0)
  let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
    if (m.u8(pEvent) === 2) {
      EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
    }
    pEvent = pNext
  }
  const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 2, nextFrame, 0, 0, 0)
}

/**
 * Evaluates a 5-tier piecewise linear curve (`nLevel` `edx` across breakpoints `15, 30, 45, 60`)
 * using the 5 `int32` tier slopes at `pTierSlopes` (`ecx + 0x00..0x10`).
 *
 * @va D2Game:0x6FCCC940 (150B)
 */
export function MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c(
  m: D2KernMemory113c,
  pTierSlopes: number,
  nLevel: number,
): number {
  hitD2GameVa113c(0x6FCCC940)
  const lvl = nLevel | 0
  if (lvl <= 1 || pTierSlopes === 0) return 0
  const s0 = m.u32(pTierSlopes >>> 0) | 0
  if (lvl > 0x3c) {
    const s1 = m.u32((pTierSlopes + 0x04) >>> 0) | 0
    const s2 = m.u32((pTierSlopes + 0x08) >>> 0) | 0
    const s3 = m.u32((pTierSlopes + 0x0c) >>> 0) | 0
    const s4 = m.u32((pTierSlopes + 0x10) >>> 0) | 0
    return (Math.imul((s1 + s2 + s3) | 0, 0x0f) + Math.imul((lvl - 0x3c) | 0, s4) + Math.imul(s0, 0x0e)) | 0
  }
  if (lvl > 0x2d) {
    const s1 = m.u32((pTierSlopes + 0x04) >>> 0) | 0
    const s2 = m.u32((pTierSlopes + 0x08) >>> 0) | 0
    const s3 = m.u32((pTierSlopes + 0x0c) >>> 0) | 0
    return (Math.imul((s1 + s2) | 0, 0x0f) + Math.imul((lvl - 0x2d) | 0, s3) + Math.imul(s0, 0x0e)) | 0
  }
  if (lvl > 0x1e) {
    const s1 = m.u32((pTierSlopes + 0x04) >>> 0) | 0
    const s2 = m.u32((pTierSlopes + 0x08) >>> 0) | 0
    return (Math.imul((lvl - 0x1e) | 0, s2) + Math.imul(s1, 0x0f) + Math.imul(s0, 0x0e)) | 0
  }
  if (lvl > 0x0f) {
    const s1 = m.u32((pTierSlopes + 0x04) >>> 0) | 0
    return (Math.imul((lvl - 0x0f) | 0, s1) + Math.imul(s0, 0x0e)) | 0
  }
  return Math.imul((lvl - 1) | 0, s0) | 0
}

/**
 * Applies `item_healafterdemonkill` on `pAttacker` when `pDefender` has `MONTYPE_DEMON` (`0x20`),
 * clamping `STAT_HITPOINTS` (`6`) to `[0, maxHp]` and setting skill icon `0x97`.
 *
 * @va D2Game:0x6FCCCA70 (151B)
 */
export function ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pDefender: number,
  _pDamage: number,
  nStatParam: number,
  _nUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCCA70)
  if (pAttacker === 0 || pDefender === 0) return 0
  if (MONSTER_CheckMonTypeFlag0x20_113c(m, pDefender >>> 0) === 0) return 0
  const heal = STATLIST_GetUnitStatWithLayer113c(
    m,
    pAttacker >>> 0,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0
  if (heal === 0) return 0
  const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, pAttacker >>> 0) | 0
  const curHp = STATLIST_GetUnitStat113c(m, pAttacker >>> 0, 6, 0) | 0
  if (curHp >= maxHp) return 0
  let newHp = (curHp + (heal << 8)) | 0
  if (newHp <= 0) newHp = 0
  if (newHp > maxHp) newHp = maxHp
  STATLIST_SetUnitStat113c(m, pAttacker >>> 0, 6, newHp, 0)
  STATES_SetMonsterSkillIconOnUnit113c(m, pAttacker >>> 0, 0x97, 0)
  return 1
}

/**
 * Applies `item_healafterkill` (`LAEK`) on `pAttacker`, clamping `STAT_HITPOINTS` (`6`)
 * to `[0, maxHp]` and setting skill icon `0x97`.
 *
 * @va D2Game:0x6FCCCB10 (137B)
 */
export function ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pDefender: number,
  _pDamage: number,
  nStatParam: number,
  _nUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCCB10)
  if (pAttacker === 0 || pDefender === 0) return 0
  const heal = STATLIST_GetUnitStatWithLayer113c(
    m,
    pAttacker >>> 0,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0
  if (heal === 0) return 0
  const maxHp = STATLIST_GetMaxLifeFromUnit113c(m, pAttacker >>> 0) | 0
  const curHp = STATLIST_GetUnitStat113c(m, pAttacker >>> 0, 6, 0) | 0
  if (curHp >= maxHp) return 0
  let newHp = (curHp + (heal << 8)) | 0
  if (newHp <= 0) newHp = 0
  if (newHp > maxHp) newHp = maxHp
  STATLIST_SetUnitStat113c(m, pAttacker >>> 0, 6, newHp, 0)
  STATES_SetMonsterSkillIconOnUnit113c(m, pAttacker >>> 0, 0x97, 0)
  return 1
}

/**
 * Applies `item_manaafterkill` (`MAEK`) on player `pAttacker` (`dwUnitType == 0`), clamping
 * `STAT_MANA` (`8`) to `[0, maxMana]` and setting skill icon `0x98`.
 *
 * @va D2Game:0x6FCCCBA0 (142B)
 */
export function ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pDefender: number,
  _pDamage: number,
  nStatParam: number,
  _nUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCCBA0)
  if (pAttacker === 0 || pDefender === 0) return 0
  if ((m.u32(pAttacker >>> 0) | 0) !== 0) return 0
  const manaGain = STATLIST_GetUnitStatWithLayer113c(
    m,
    pAttacker >>> 0,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0
  if (manaGain === 0) return 0
  const maxMana = STATLIST_GetMaxManaFromUnit113c(m, pAttacker >>> 0) | 0
  const curMana = STATLIST_GetUnitStat113c(m, pAttacker >>> 0, 8, 0) | 0
  if (curMana >= maxMana) return 0
  let newMana = (curMana + (manaGain << 8)) | 0
  if (newMana <= 0) newMana = 0
  if (newMana > maxMana) newMana = maxMana
  STATLIST_SetUnitStat113c(m, pAttacker >>> 0, 8, newMana, 0)
  STATES_SetMonsterSkillIconOnUnit113c(m, pAttacker >>> 0, 0x98, 0)
  return 1
}

/**
 * Rolls and applies Crushing Blow fractional life reduction on `pDefender`, scaling the divisor by
 * target unit type (`4` normal monster, `8` boss/unique, `10` player/hireling), player-count exp bonus,
 * missile attack doubling (`nAttackType == 6`), and positive `STAT_DAMAGERESIST` (`0x24`).
 *
 * @va D2Game:0x6FCCCC30 (358B)
 */
export function ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c(
  m: D2KernMemory113c,
  nAttackType: number,
  pAttacker: number,
  pDefender: number,
  pDamage: number,
  nStatParam: number,
  _nUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCCC30)
  if (pAttacker === 0 || pDefender === 0) return 0
  const cbChance = STATLIST_GetUnitStatWithLayer113c(
    m,
    pAttacker >>> 0,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0
  if (cbChance <= 0) return 0
  const roll = (stepSeed64At113c(m, (pAttacker + 0x20) >>> 0) >>> 0) % 100
  if ((roll | 0) >= cbChance) return 0

  const defType = m.u32(pDefender >>> 0) | 0
  let divisor = 4
  if (defType === 0) {
    divisor = 10
  } else if (defType === 1) {
    if (MONSTERS_GetHirelingTypeId113c(m, pDefender >>> 0) !== 0) {
      divisor = 10
    } else {
      if (
        MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pDefender >>> 0) !== 0 ||
        MONSTER_CheckTypeFlagsMask113c(m, pDefender >>> 0, 2) !== 0
      ) {
        divisor = 8
      }
      let monPlayers = STATLIST_GetUnitStat113c(m, pDefender >>> 0, 0x64, 0) | 0
      if (monPlayers < 1) monPlayers = 1
      const expBonusPct = MONSTER_GetPlayerCountExpBonusPct113c(m, monPlayers) | 0
      if (expBonusPct !== 0) {
        divisor = (divisor + mulDiv113c(expBonusPct, divisor, 100)) | 0
      }
    }
  }
  if ((nAttackType | 0) === 6) {
    divisor = (divisor + divisor) | 0
  }
  const curHp = STATLIST_GetUnitStat113c(m, pDefender >>> 0, 6, 0) | 0
  let cbDmg = Math.trunc(curHp / divisor) | 0
  let physRes = STATLIST_GetUnitStat113c(m, pDefender >>> 0, 0x24, 0) | 0
  if (physRes >= 100) {
    physRes = 100
    cbDmg = (cbDmg - mulDiv113c(physRes, cbDmg, 100)) | 0
  } else if (physRes > 0) {
    cbDmg = (cbDmg - mulDiv113c(physRes, cbDmg, 100)) | 0
  }
  let newHp = (curHp - cbDmg) | 0
  if (newHp <= 0) newHp = 0
  STATLIST_SetUnitStat113c(m, pDefender >>> 0, 6, newHp, 0)
  if (newHp <= 0 && pDamage !== 0) {
    m.setU8((pDamage + 0x04) >>> 0, (m.u8((pDamage + 0x04) >>> 0) | 2) & 0xff)
  }
  if (cbDmg > 0) {
    STATES_SetMonsterSkillIconOnUnit113c(m, pDefender >>> 0, 0x93, 0)
  }
  return 1
}

/**
 * Rolls and applies Knockback (`pDamage->wResultFlags |= 0x0800`, i.e. `byte[+0x04] |= 0x08`) on `pDefender`
 * using `MonStats2.txt` size thresholds (`32` for `bLarge`, `128` for `bSmall`, `64` default) out of `128`.
 *
 * @va D2Game:0x6FCCCE60 (174B)
 */
export function ITEMMODS_ApplyKnockback_6FCCCE60_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pDefender: number,
  pDamage: number,
  nStatParam: number,
  _nUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCCE60)
  if (pAttacker === 0 || pDefender === 0 || pDamage === 0) return 0
  const kbVal = STATLIST_GetUnitStatWithLayer113c(
    m,
    pAttacker >>> 0,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0
  if (kbVal <= 0) return 0
  let threshold = 0x40
  if ((m.u32(pDefender >>> 0) | 0) === 1) {
    const pMonStats2 = MONSTATS2_GetRecordPtr113c(m, m.u32((pDefender + 0x04) >>> 0) | 0) >>> 0
    if (pMonStats2 !== 0) {
      const bFlags1 = m.u8((pMonStats2 + 0x05) >>> 0)
      const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
      const mask3 = pMasks !== 0 ? m.u32((pMasks + 0x0c) >>> 0) : 8
      const mask2 = pMasks !== 0 ? m.u32((pMasks + 0x08) >>> 0) : 4
      if ((bFlags1 & mask3) !== 0) {
        threshold = 0x20
      } else if ((bFlags1 & mask2) !== 0) {
        threshold = 0x80
      }
    }
  }
  const roll = stepSeed64At113c(m, (pAttacker + 0x20) >>> 0) & 0x7f
  if ((roll | 0) >= threshold) return 0
  m.setU8((pDamage + 0x04) >>> 0, (m.u8((pDamage + 0x04) >>> 0) | 8) & 0xff)
  return 1
}

/**
 * Iterates `pUnit->pInventory` (`+0x60`), clearing item command flag `0x04` and queueing an `8`-byte
 * `0x3F` (`[0x3F, 0xFF, dwItemGuid, 0xFFFF]`) packet to `pPlayerData->pClient` (`+0x9C`).
 *
 * @va D2Game:0x6FCCCF10 (181B)
 */
export function ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c(
  m: D2KernMemory113c,
  pUnit: number,
  _nUnused = 0,
): void {
  hitD2GameVa113c(0x6FCCCF10)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return
  let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  if (pNode === 0) return
  const sp = (k2W4B7StackPtr - 16) >>> 0
  k2W4B7StackPtr = sp
  try {
    while (pNode !== 0) {
      const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
      if (ITEMS_CheckCommandFlags113c(m, pItem, 4) !== 0) {
        ITEMS_SetOrClearCommandFlags113c(m, pItem, 4, 0)
        let pClient = 0
        if ((m.u32(pUnit >>> 0) | 0) === 0) {
          const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
          if (pPlayerData !== 0) {
            pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
          }
        }
        m.setU32(sp, 0)
        m.setU32((sp + 4) >>> 0, 0)
        m.setU8(sp, 0x3f)
        m.setU8((sp + 1) >>> 0, 0xff)
        m.setU32((sp + 2) >>> 0, pItem !== 0 ? m.u32((pItem + 0x0c) >>> 0) : 0)
        m.setU16((sp + 6) >>> 0, 0xffff)
        NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 8)
      }
      pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    }
  } finally {
    k2W4B7StackPtr = (sp + 16) >>> 0
  }
}

/**
 * @va D2Game:0x6FCCCFD0
 * Send 0x3F use-scroll/tome packet to player client and set item command flag 4.
 */
export function ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c(
  m: D2KernMemory113c,
  wSkillId: number,
  pUnit: number,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FCCCFD0)
  ITEMS_SetOrClearCommandFlags113c(m, pItem, 4, 1);
  const magicLvl = ITEMS_GetMagicLevelFromItem113c(m, pItem) | 0;
  if (magicLvl >= 0) {
    let pClient = 0;
    if (pUnit !== 0 && m.u32(pUnit >>> 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pUnit) >>> 0;
      pClient = pPlayerData !== 0 ? m.u32((pPlayerData + 0x9c) >>> 0) : 0;
    }
    const sp = allocScratch(m, 8);
    try {
      m.setU8(sp, 0x3f);
      m.setU8((sp + 1) >>> 0, magicLvl & 0xff);
      m.setU32((sp + 2) >>> 0, pItem !== 0 ? m.u32((pItem + 0x0c) >>> 0) : 0);
      m.setU16((sp + 6) >>> 0, wSkillId & 0xffff);
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 8);
    } finally {
      freeScratch(m, 8);
    }
  }
  return 1;
}

/**
 * @va D2Game:0x6FCCD050
 * Clear aura state, unlink/free aura statlist, and delete event 9 by arg14 on skill change.
 */
export function SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  pGame: number,
  nEventArg14: number,
): void {
  hitD2GameVa113c(0x6FCCD050)
  if (pUnit === 0 || (nSkillId | 0) < 0) return;
  const pTables = getSgptDataTablesPtr(m);
  if (pTables === 0) return;
  const nSkillsCount = m.u32((pTables + 0xba0) >>> 0) | 0;
  if ((nSkillId | 0) >= nSkillsCount) return;
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
  if (pSkillsTxtBase === 0) return;
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return;
  const bFlags0 = m.u8((pSkillsTxt + 0x04) >>> 0);
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0;
  const mask5 = pMasks !== 0 ? m.u8((pMasks + 0x14) >>> 0) : 0x20;
  if ((bFlags0 & mask5) === 0) return;
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0));
  if (wAuraState < 0) return;
  const nStatesCount = m.u32((pTables + 0xc4) >>> 0) | 0;
  if (wAuraState >= nStatesCount) return;

  STATES_ToggleGfxStateFlag113c(m, pUnit, wAuraState, 0);
  const wAuraStateReloaded = sx16(m.u16((pSkillsTxt + 0x80) >>> 0));
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, wAuraStateReloaded) >>> 0;
  if (pStatList !== 0) {
    STATLIST_UnlinkSubList113c(m, pUnit, pStatList);
    STATLIST_FreeStatListIfNonExtended113c(m, pStatList);
  }
  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 9, nEventArg14);
}

/**
 * @va D2Game:0x6FCCD2A0
 * Apply Slow Target item modifier to defender via STATE_SLOWED (24) aura statlist.
 */
export function ITEMMODS_ApplySlowTarget_6FCCD2A0_113c(
  m: D2KernMemory113c,
  pAttacker: number,
  pDefender: number,
  _pArg3: number,
  nStatParam: number,
  _nUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCD2A0)
  if (pAttacker === 0 || pDefender === 0) return 0;
  let slowPct = STATLIST_GetUnitStatWithLayer113c(
    m,
    pAttacker,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0;
  if (slowPct === 0) return 0;

  const dwUnitType = m.u32(pDefender >>> 0);
  if (dwUnitType === 0) {
    if (slowPct >= 50) slowPct = 50;
  } else if (dwUnitType === 1) {
    if (
      MONSTER_CheckTypeFlagsMask113c(m, pDefender, 0x0c) !== 0 ||
      MONSTERS_CheckMonStatsFlagBit6_113c(m, 0, pDefender) !== 0 ||
      MONSTERS_GetHirelingTypeId113c(m, pDefender) !== 0
    ) {
      if (slowPct >= 50) slowPct = 50;
    } else if (MONSTER_CheckTypeFlagsMask113c(m, pDefender, 2) !== 0) {
      if (slowPct >= 75) slowPct = 75;
    } else {
      if (slowPct >= 90) slowPct = 90;
    }
  } else {
    return 0;
  }

  const sp = allocScratch(m, 0x24);
  try {
    const negSlow = (-slowPct) | 0;
    m.setU32(sp, pAttacker >>> 0);
    m.setU32((sp + 0x04) >>> 0, pDefender >>> 0);
    m.setU32((sp + 0x08) >>> 0, 0);
    m.setU32((sp + 0x0c) >>> 0, 1);
    m.setU32((sp + 0x10) >>> 0, 0x2ee);
    m.setU32((sp + 0x14) >>> 0, 0x43);
    m.setU32((sp + 0x18) >>> 0, negSlow >>> 0);
    m.setU32((sp + 0x1c) >>> 0, 0x18);
    m.setU32((sp + 0x20) >>> 0, 0);
    const pStatList = STATES_CreateOrUpdateAuraStatList113c(m, sp) >>> 0;
    if (pStatList === 0) return 0;
    STATLIST_SetStat113c(m, pStatList, 0x44, negSlow, 0);
    STATLIST_SetStat113c(m, pStatList, 0x45, negSlow, 0);
    UNITS_SetUnitAnimMode113c(m, pDefender, 0x6fd1b660, 0x88b);
    return 1;
  } finally {
    freeScratch(m, 0x24);
  }
}

/**
 * @va D2Game:0x6FCCD580
 * Apply Hit Causes Monster To Flee item modifier on hit.
 */
export function ITEMMODS_ApplyMonsterFlee_6FCCD580_113c(
  m: D2KernMemory113c,
  pGame: number,
  nAttackType: number,
  pAttacker: number,
  pDefender: number,
  _pArg3: number,
  nStatParam: number,
  _nUnused = 0,
): number {
  hitD2GameVa113c(0x6FCCD580)
  if (pAttacker === 0 || pDefender === 0) return 0;
  const fearVal = STATLIST_GetUnitStatWithLayer113c(
    m,
    pAttacker,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0;
  if (fearVal <= 0) return 0;

  let attLvl = STATLIST_GetUnitStat113c(m, pAttacker, 12, 0) | 0;
  const defLvl = STATLIST_GetUnitStat113c(m, pDefender, 12, 0) | 0;
  let c = (fearVal - 1) | 0;
  if (c <= 0) c = 0;
  if ((nAttackType | 0) === 6) {
    attLvl = (attLvl - 6) | 0;
  }
  c = ((c << 2) - defLvl) | 0;
  let chance = Math.imul((c + attLvl + 10) | 0, 5) | 0;
  if ((nAttackType | 0) === 6) {
    chance = Math.trunc(chance / 3) | 0;
  }
  if (chance < 0) {
    chance = 0;
  } else if (chance > 100) {
    chance = 100;
  }

  const roll = stepUnitSeedMod(m, (pAttacker + 0x20) >>> 0, 100);
  if (roll >= chance) return 0;

  let dur = (((chance - roll) * 2) + 25) | 0;
  if (dur < 25) {
    dur = 25;
  } else if (dur > 250) {
    dur = 250;
  }

  const sp = allocScratch(m, 0x70);
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((sp + i) >>> 0, 0);
    }
    m.setU32((sp + 0x34) >>> 0, dur >>> 0);
    SUNITDMG_ApplyDamage113c(m, pGame, pAttacker, pDefender, sp);
    return 1;
  } finally {
    freeScratch(m, 0x70);
  }
}

/**
 * @va D2Game:0x6FCCD6C0
 * Apply Attacker Takes Cold Damage item modifier when struck.
 */
export function ITEMMODS_ApplyAttackerTakesDamage_6FCCD6C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAttacker: number,
  _pArg3: number,
  nStatParam: number,
): number {
  hitD2GameVa113c(0x6FCCD6C0)
  if (pUnit === 0 || pAttacker === 0) return 0;
  if (((m.u32((pAttacker + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0;

  const thornsVal = STATLIST_GetUnitStatWithLayer113c(
    m,
    pUnit,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0;
  if (thornsVal <= 0) return 0;

  const attLvl = STATLIST_GetUnitStat113c(m, pAttacker, 12, 0) | 0;
  const unitLvl = STATLIST_GetUnitStat113c(m, pUnit, 12, 0) | 0;
  let dur = 25;
  if (unitLvl > attLvl) {
    dur = (Math.imul((unitLvl - attLvl) | 0, 10) + 25) | 0;
  }

  const sp = allocScratch(m, 0x70);
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((sp + i) >>> 0, 0);
    }
    m.setU16((sp + 0x04) >>> 0, (m.u16((sp + 0x04) >>> 0) | 0x4021) & 0xffff);
    m.setU32((sp + 0x24) >>> 0, (thornsVal << 8) >>> 0);
    m.setU32((sp + 0x30) >>> 0, dur >>> 0);
    m.setU32((sp + 0x60) >>> 0, 0x3d);
    SUNITDMG_ApplyDamage113c(m, pGame, pUnit, pAttacker, sp);
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pUnit, pAttacker, sp);
    return 1;
  } finally {
    freeScratch(m, 0x70);
  }
}

/**
 * @va D2Game:0x6FCCD7B0
 * Apply Attacker Takes Fire Damage item modifier when struck.
 */
export function ITEMMODS_ApplyAttackerTakesFireDamage_6FCCD7B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAttacker: number,
  _pArg3: number,
  nStatParam: number,
): number {
  hitD2GameVa113c(0x6FCCD7B0)
  if (pUnit === 0 || pAttacker === 0) return 0;
  if (((m.u32((pAttacker + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0;

  const fireVal = STATLIST_GetUnitStatWithLayer113c(
    m,
    pUnit,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0;
  if (fireVal <= 0) return 0;

  const sp = allocScratch(m, 0x70);
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((sp + i) >>> 0, 0);
    }
    m.setU16((sp + 0x04) >>> 0, (m.u16((sp + 0x04) >>> 0) | 0x4021) & 0xffff);
    m.setU32((sp + 0x10) >>> 0, (fireVal << 8) >>> 0);
    m.setU32((sp + 0x60) >>> 0, 0x2d);
    SUNITDMG_ApplyDamage113c(m, pGame, pUnit, pAttacker, sp, 1, undefined, 1);
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pUnit, pAttacker, sp);
    return 1;
  } finally {
    freeScratch(m, 0x70);
  }
}

/**
 * @va D2Game:0x6FCCD860
 * Apply Attacker Takes Lightning Damage item modifier when struck.
 */
export function ITEMMODS_ApplyAttackerTakesLightningDamage_6FCCD860_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  pAttacker: number,
  _pArg3: number,
  nStatParam: number,
): number {
  hitD2GameVa113c(0x6FCCD860)
  if (pUnit === 0 || pAttacker === 0) return 0;
  if (((m.u32((pAttacker + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0;

  const ltngVal = STATLIST_GetUnitStatWithLayer113c(
    m,
    pUnit,
    (nStatParam >>> 16) & 0xffff,
    nStatParam & 0xffff,
  ) | 0;
  if (ltngVal <= 0) return 0;

  const sp = allocScratch(m, 0x70);
  try {
    for (let i = 0; i < 0x70; i += 4) {
      m.setU32((sp + i) >>> 0, 0);
    }
    m.setU16((sp + 0x04) >>> 0, (m.u16((sp + 0x04) >>> 0) | 0x4021) & 0xffff);
    m.setU32((sp + 0x1c) >>> 0, (ltngVal << 8) >>> 0);
    m.setU32((sp + 0x60) >>> 0, 0x4d);
    SUNITDMG_ApplyDamage113c(m, pGame, pUnit, pAttacker, sp, 1, undefined, 1);
    SUNITDMG_ApplySideEffectsAndKill113c(m, pGame, pUnit, pAttacker, sp);
    return 1;
  } finally {
    freeScratch(m, 0x70);
  }
}

/**
 * @va D2Game:0x6FCCDB30
 * Restart aura event 9 timer and optionally execute skill do-func on skill change.
 */
export function SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nEventArg14: number,
  nSkillId: number,
  nSkillLevel: number,
): void {
  hitD2GameVa113c(0x6FCCDB30)
  if (pUnit === 0 || (nSkillId | 0) < 0) return;
  const pTables = getSgptDataTablesPtr(m);
  if (pTables === 0) return;
  const nSkillsCount = m.u32((pTables + 0xba0) >>> 0) | 0;
  if ((nSkillId | 0) >= nSkillsCount) return;
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
  if (pSkillsTxtBase === 0) return;
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return;
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0;
  const mask5 = pMasks !== 0 ? m.u8((pMasks + 0x14) >>> 0) : 0x20;
  if ((m.u8((pSkillsTxt + 0x04) >>> 0) & mask5) === 0) return;
  const wAuraState = sx16(m.u16((pSkillsTxt + 0x80) >>> 0));
  if (wAuraState < 0 || wAuraState >= (m.u32((pTables + 0xc4) >>> 0) | 0)) return;

  EVENT_DeleteEventByArg14_113c(m, pGame, pUnit, 9, nEventArg14);
  const nextFrame = SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c(
    m,
    nSkillLevel,
    nSkillId,
    pSkillsTxt,
    pGame,
    pUnit,
  ) >>> 0;
  EVENT_SetEventFull113c(m, pGame, pUnit, 9, nextFrame, 0, nEventArg14, nSkillId);

  const pMasks2 = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0;
  const mask7 = pMasks2 !== 0 ? m.u8((pMasks2 + 0x1c) >>> 0) : 0x80;
  if ((m.u8((pSkillsTxt + 0x05) >>> 0) & mask7) !== 0) {
    SKILLS_ExecuteSkillDoFunc113c(m, pUnit, pGame, nSkillId, nSkillLevel, 1, 1, 0);
  }
}

/**
 * @va D2Game:0x6FCCFC50
 * Morph monster unit to a new enabled MonStats class ID and reinitialize it.
 */
export function MONSTER_MorphMonsterClassId_6FCCFC50_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  nNewClassId: number,
  nAnimMode: number,
): number {
  hitD2GameVa113c(0x6FCCFC50)
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 1 || (nNewClassId | 0) < 0) return 0;
  const pTables = getSgptDataTablesPtr(m);
  if (pTables === 0) return 0;
  if ((nNewClassId | 0) >= (m.u32((pTables + 0xa80) >>> 0) | 0)) return 0;
  const pMonStatsBase = m.u32((pTables + 0xa78) >>> 0);
  if (pMonStatsBase === 0) return 0;
  const pMonStatsTxt = (pMonStatsBase + Math.imul(nNewClassId | 0, 0x1a8)) >>> 0;
  if (pMonStatsTxt === 0) return 0;
  const pMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C >>> 0) >>> 0;
  const mask1 = pMasks !== 0 ? m.u8((pMasks + 0x04) >>> 0) : 0x02;
  if ((m.u8((pMonStatsTxt + 0x0f) >>> 0) & mask1) === 0) return 0;

  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
  const dwUnitId = m.u32((pUnit + 0x0c) >>> 0);
  MONSTER_DestroyMonsterUnit113c(m, pGame, pUnit);
  m.setU32((pUnit + 0x04) >>> 0, nNewClassId >>> 0);
  MONSTER_InitMonsterUnit113c(m, pUnit, pRoom, pGame, dwUnitId);
  UNITS_ChangeAnimMode113c(m, pUnit, nAnimMode);
  return 1;
}

/**
 * @va D2Game:0x6FCD0720
 * Iterate units in adjacent rooms of `pUnit` and invoke callback until non-zero return.
 */
export function MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pfnCallback: number,
  pGame: number,
  pContext: number,
  fnCallback?: (
    m: D2KernMemory113c,
    pGame: number,
    pUnit: number,
    pRoomUnit: number,
    pContext: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCD0720)
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
  if (pRoom === 0) return 0;
  const sp = allocScratch(m, 8);
  try {
    m.setU32(sp, 0);
    m.setU32((sp + 4) >>> 0, 0);
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, (sp + 4) >>> 0, sp);
    const nRooms = m.u32(sp);
    const ppRooms = m.u32((sp + 4) >>> 0);
    for (let i = 0; i < nRooms; i = (i + 1) >>> 0) {
      const pAdjRoom = m.u32((ppRooms + (i << 2)) >>> 0);
      let pRoomUnit = pAdjRoom !== 0 ? m.u32((pAdjRoom + 0x74) >>> 0) : 0;
      while (pRoomUnit !== 0) {
        let res = 0;
        if (fnCallback !== undefined) {
          res = fnCallback(m, pGame, pUnit, pRoomUnit, pContext) | 0;
        } else if ((pfnCallback >>> 0) === 0x6fcd06f0) {
          MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c(
            m,
            pRoomUnit,
            (pContext + 4) >>> 0,
            pContext,
          );
          res = m.u32(pContext >>> 0) | 0;
        }
        if (res !== 0) return res;
        pRoomUnit = m.u32((pRoomUnit + 0xe8) >>> 0);
      }
    }
    return 0;
  } finally {
    freeScratch(m, 8);
  }
}

/**
 * @va D2Game:0x6FCD0980
 * Calculate approximate subtile distance from `pUnit` to `(nTargetX, nTargetY)` minus half unit size.
 */
export function AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nTargetX: number,
  nTargetY: number,
): number {
  hitD2GameVa113c(0x6FCD0980)
  const dwType1 = m.u32(pUnit >>> 0) | 0;
  let unitX = 0;
  if (dwType1 === 2 || (dwType1 > 3 && dwType1 <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0);
    unitX = m.u32((pStaticPath + 0x0c) >>> 0) | 0;
  } else {
    const pPath = m.u32((pUnit + 0x2c) >>> 0);
    unitX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0;
  }
  let dx = (unitX - (nTargetX | 0)) | 0;

  const dwType2 = m.u32(pUnit >>> 0) | 0;
  let unitY = 0;
  if (dwType2 === 2 || (dwType2 > 3 && dwType2 <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0);
    unitY = m.u32((pStaticPath + 0x10) >>> 0) | 0;
  } else {
    const pPath = m.u32((pUnit + 0x2c) >>> 0);
    unitY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0;
  }
  let dy = (unitY - (nTargetY | 0)) | 0;

  if (dx < 0) dx = (-dx) | 0;
  if (dy < 0) dy = (-dy) | 0;

  const sizeOffset = (((UNITS_GetUnitSizeX113c(m, pUnit) >>> 0) >>> 1) + 1) | 0;
  dx = (dx - sizeOffset) | 0;
  dy = (dy - sizeOffset) | 0;
  if (dx < 0) dx = 0;
  if (dy < 0) dy = 0;

  const weighted = dx > dy ? (dy + (dx << 1)) | 0 : (dx + (dy << 1)) | 0;
  return Math.trunc(weighted / 2) | 0;
}

/**
 * @va D2Game:0x6FCD0B20
 * Check whether monster `pUnit` can teleport or use a skill in `nMode`.
 */
export function MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nMode: number,
): number {
  hitD2GameVa113c(0x6FCD0B20)
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 1 || (nMode | 0) > 0x13) return 0;
  if (STATES_CheckState113c(m, pUnit, 0x36) !== 0) return 0;
  if (SKILLS_CanMonsterReviveInMode2_113c(m, m.u32((pUnit + 0x04) >>> 0)) === 0) return 0;
  if (((m.u32((pUnit + 0xc4) >>> 0) >>> 2) & 1) === 0) {
    if (SUNIT_IsDeadOrDying113c(m, pUnit) === 0) return 0;
  }
  if (MONSTER_CheckTypeFlagsMask113c(m, pUnit, 0x0a) !== 0) return 0;
  if ((nMode | 0) === 0x13) return 1;

  MONSTATS_GetRecordPtr113c(m, m.u32((pUnit + 0x04) >>> 0) | 0);
  if (
    SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c(
      m,
      pUnit,
      nMode,
      1,
    ) !== 0
  ) {
    return 1;
  }
  return 0;
}

/**
 * @va D2Game:0x6FCD0CE0
 * Iterate units in non-town adjacent rooms of `pUnit` that contain active clients/players.
 */
export function MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pfnCallback: number,
  pGame: number,
  pContext: number,
  fnCallback?: (
    m: D2KernMemory113c,
    pGame: number,
    pUnit: number,
    pRoomUnit: number,
    pContext: number,
  ) => number,
): number {
  hitD2GameVa113c(0x6FCD0CE0)
  if (pUnit === 0) return 0;
  const dwUnitType = m.u32(pUnit >>> 0) | 0;
  if (dwUnitType < 0 || dwUnitType > 1) return 0;
  if (SUNIT_IsDeadOrDying113c(m, pUnit) !== 0) return 0;
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
  if (pRoom === 0) return 0;

  const sp = allocScratch(m, 8);
  try {
    m.setU32(sp, 0);
    m.setU32((sp + 4) >>> 0, 0);
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, (sp + 4) >>> 0, sp);
    const nRooms = m.u32(sp);
    for (let i = 0; i < nRooms; i = (i + 1) >>> 0) {
      const ppRooms = m.u32((sp + 4) >>> 0);
      const pAdjRoom = m.u32((ppRooms + (i << 2)) >>> 0);
      if (DUNGEON_CheckRoomIsTownMemPort113c(m, pAdjRoom) === 0) {
        const pRoomReload = m.u32((m.u32((sp + 4) >>> 0) + (i << 2)) >>> 0);
        if (pRoomReload !== 0 && m.u32((pRoomReload + 0x78) >>> 0) !== 0) {
          let pRoomUnit = m.u32((pRoomReload + 0x74) >>> 0);
          while (pRoomUnit !== 0) {
            let res = 0;
            if (fnCallback !== undefined) {
              res = fnCallback(m, pGame, pUnit, pRoomUnit, pContext) | 0;
            } else if ((pfnCallback >>> 0) === 0x6fcd06f0) {
              MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c(
                m,
                pRoomUnit,
                (pContext + 4) >>> 0,
                pContext,
              );
              res = m.u32(pContext >>> 0) | 0;
            }
            if (res !== 0) return res;
            pRoomUnit = m.u32((pRoomUnit + 0xe8) >>> 0);
          }
        }
      }
    }
    return 0;
  } finally {
    freeScratch(m, 8);
  }
}

/**
 * @va D2Game:0x6FCD0E90
 * Check whether free coordinates exist near `pUnit2` or perpendicular offsets from `pUnit1`.
 */
export function MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c(
  m: D2KernMemory113c,
  pUnit1: number,
  pUnit2: number,
): number {
  hitD2GameVa113c(0x6FCD0E90)
  if (pUnit1 === 0 || pUnit2 === 0) return 0;

  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pUnit1, pUnit2) | 0;
  let step = 3;
  if (dist >= 0 && dist < 25) {
    if (dist < 3) {
      step = 2;
    } else if (dist < 11) {
      step = 3;
    } else {
      step = 4;
    }
  }

  const getUnitCoordX = (pU: number): number => {
    const t = m.u32(pU >>> 0) | 0;
    const pP = m.u32((pU + 0x2c) >>> 0);
    if (t === 2 || (t > 3 && t <= 5)) {
      return m.u32((pP + 0x0c) >>> 0) | 0;
    }
    return pP !== 0 ? PATH_GetPosX113c(m, pP) | 0 : 0;
  };
  const getUnitCoordY = (pU: number): number => {
    const t = m.u32(pU >>> 0) | 0;
    const pP = m.u32((pU + 0x2c) >>> 0);
    if (t === 2 || (t > 3 && t <= 5)) {
      return m.u32((pP + 0x10) >>> 0) | 0;
    }
    return pP !== 0 ? PATH_GetPosY113c(m, pP) | 0 : 0;
  };

  const x2 = getUnitCoordX(pUnit2);
  const y2 = getUnitCoordY(pUnit2);
  const x1 = getUnitCoordX(pUnit1);
  const y1 = getUnitCoordY(pUnit1);

  const dx = (x1 - x2) | 0;
  const dy = (y1 - y2) | 0;
  const sx = dx < 0 ? (-step) | 0 : dx > 0 ? step : 0;
  const sy = dy < 0 ? (-step) | 0 : dy > 0 ? step : 0;

  if (UNITS_FindFreeCoords113c(m, pUnit1, x2, y2, 0x805) === 0) {
    return 1;
  }
  if (UNITS_FindFreeCoords113c(m, pUnit1, (x2 - sy) | 0, (y2 + sx) | 0, 0x805) === 0) {
    return 1;
  }
  const r3 = UNITS_FindFreeCoords113c(m, pUnit1, (x2 + sy) | 0, (y2 - sx) | 0, 0x805) | 0;
  return r3 === 0 ? 1 : 0;
}

/**
 * @va D2Game:0x6FCD1320
 * Iterate pack members of `pUnit`'s boss with `MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c`.
 */
export function MONAI_ForEachPackMemberWithFilter_6FCD1320_113c(
  m: D2KernMemory113c,
  pUnit: number,
  pGame: number,
  pfnFilter: number,
  pUserParam: number,
): number {
  hitD2GameVa113c(0x6FCD1320)
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 1) return 0;
  const pMonsterData = m.u32((pUnit + 0x14) >>> 0);
  if (pMonsterData === 0) return 0;
  const pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0);
  if (pAiGeneral === 0) return 0;
  const pAiGame = m.u32((pAiGeneral + 0x28) >>> 0);
  if (pAiGame === 0) return 0;
  const dwBossId = m.u32((pAiGeneral + 0x2c) >>> 0) | 0;
  const dwBossType = m.u32((pAiGeneral + 0x30) >>> 0) | 0;
  const pBoss = SUNIT_GetServerUnit113c(m, pAiGame, dwBossType, dwBossId) >>> 0;
  if (pBoss === 0 || m.u32(pBoss >>> 0) !== 1) return 0;

  const sp = allocScratch(m, 0x14);
  try {
    m.setU32(sp, 0);
    m.setU32((sp + 0x04) >>> 0, pfnFilter >>> 0);
    m.setU32((sp + 0x08) >>> 0, pGame >>> 0);
    m.setU32((sp + 0x0c) >>> 0, pUnit >>> 0);
    m.setU32((sp + 0x10) >>> 0, pUserParam >>> 0);
    AIGENERAL_ForEachPackMember_6FC41490_113c(
      m,
      pBoss,
      (m2, pMember, pArg1, pArg2) => {
        MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c(m2, pMember, pArg1, pArg2);
      },
      (sp + 0x04) >>> 0,
      sp,
    );
    return m.u32(sp) | 0;
  } finally {
    freeScratch(m, 0x14);
  }
}

/**
 * @va D2Game:0x6FCD1400
 * Check whether `pCandidateUnit` is a valid live hostile target for `pOriginUnit`.
 */
export function MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c(
  m: D2KernMemory113c,
  pOriginUnit: number,
  pCandidateUnit: number,
  nAlignFlag: number,
): number {
  hitD2GameVa113c(0x6FCD1400)
  if (pOriginUnit === 0) return 0;
  const origType = i32(m, pOriginUnit >>> 0);
  if (origType < 0 || origType > 1) return 0;
  if (pCandidateUnit === 0) return 0;
  const candType = i32(m, pCandidateUnit >>> 0);
  if (candType < 0 || candType > 1) return 0;

  if (SUNIT_IsDeadOrDying113c(m, pCandidateUnit) !== 0) return 0;
  if (SUNIT_IsDeadOrDying113c(m, pOriginUnit) !== 0) return 0;

  const pRoom = UNITS_GetRoom113c(m, pCandidateUnit) >>> 0;
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 0;
  if (((m.u32((pCandidateUnit + 0xc4) >>> 0) >>> 2) & 1) === 0) return 0;

  if (STATES_CheckState113c(m, pCandidateUnit, 0x92) !== 0) {
    const cType = i32(m, pCandidateUnit >>> 0);
    if (cType === 0) {
      const roll = SEED_RollLimitedFast113c(m, (pCandidateUnit + 0x20) >>> 0, 100) | 0;
      if (roll < 80) {
        if (UNITS_CanUnitMeleeAttackTarget113c(m, pOriginUnit, pCandidateUnit, 0) === 0) {
          return 0;
        }
      }
    } else if (cType === 1) {
      if (UNITS_CanUnitMeleeAttackTarget113c(m, pOriginUnit, pCandidateUnit, 0) !== 0) {
        return 0;
      }
    }
  }

  return SUNIT_AreUnitsHostileOrUnaligned113c(m, pCandidateUnit, pOriginUnit, nAlignFlag) | 0;
}

/**
 * @va D2Game:0x6FCD14B0
 * Callback to find the nearest friendly monster within `pFindCtx->maxDist (+0x0C)`.
 */
export function MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pFindCtx: number,
): number {
  hitD2GameVa113c(0x6FCD14B0)
  if ((pOriginUnit >>> 0) === (pCandidateUnit >>> 0) || pCandidateUnit === 0) return 0;
  if (m.u32(pCandidateUnit >>> 0) !== 1) return 0;
  if (SUNIT_IsDeadOrDying113c(m, pCandidateUnit) !== 0) return 0;

  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pOriginUnit, pCandidateUnit) | 0;
  if (dist < i32(m, (pFindCtx + 0x0c) >>> 0)) {
    if (SUNIT_AreUnitsHostileOrUnaligned113c(m, pCandidateUnit, pOriginUnit, pGame) === 0) {
      const count = (i32(m, (pFindCtx + 0x08) >>> 0) + 1) | 0;
      const bestDist = i32(m, (pFindCtx + 0x04) >>> 0);
      m.setU32((pFindCtx + 0x08) >>> 0, count >>> 0);
      if (dist < bestDist) {
        m.setU32((pFindCtx + 0x04) >>> 0, dist >>> 0);
        m.setU32(pFindCtx >>> 0, pCandidateUnit >>> 0);
      }
    }
  }
  return 0;
}

/**
 * @va D2Game:0x6FCD1660
 * Target evaluation callback updating best moving/stationary hostile target or clearing door flag.
 */
export function MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c(
  m: D2KernMemory113c,
  nAlignFlag: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pScanCtx: number,
): number {
  hitD2GameVa113c(0x6FCD1660)
  if (pCandidateUnit === 0) return 0;
  const candType = i32(m, pCandidateUnit >>> 0);
  if (
    candType >= 0 &&
    candType <= 1 &&
    SUNIT_IsDeadOrDying113c(m, pCandidateUnit) === 0 &&
    ((m.u32((pCandidateUnit + 0xc4) >>> 0) >>> 2) & 1) !== 0 &&
    SUNIT_AreUnitsHostileOrUnaligned113c(m, pCandidateUnit, pOriginUnit, nAlignFlag) !== 0
  ) {
    const dist = AI_CalcApproxUnitDistSubtiles113c(m, pCandidateUnit, pOriginUnit) | 0;
    if (dist > i32(m, (pScanCtx + 0x0c) >>> 0)) return 0;
    const vel = MONAI_GetUnitMeleeVelocity_6FCD08A0_113c(m, pCandidateUnit) | 0;
    if (vel > 1) {
      if (dist >= i32(m, (pScanCtx + 0x04) >>> 0)) return 0;
    } else {
      if (dist >= i32(m, (pScanCtx + 0x18) >>> 0)) return 0;
    }

    if (i32(m, (pScanCtx + 0x08) >>> 0) !== 0) {
      if (UNITS_HasCollisionBetweenUnits113c(m, pCandidateUnit, pOriginUnit, 4) !== 0) {
        return 0;
      }
    }

    if (vel > 1) {
      m.setU32(pScanCtx >>> 0, pCandidateUnit >>> 0);
      m.setU32((pScanCtx + 0x04) >>> 0, dist >>> 0);
      return 0;
    }
    m.setU32((pScanCtx + 0x14) >>> 0, pCandidateUnit >>> 0);
    m.setU32((pScanCtx + 0x18) >>> 0, dist >>> 0);
    return 0;
  }

  if (m.u32(pCandidateUnit >>> 0) !== 1) return 0;
  if (pOriginUnit !== 0 && m.u32(pOriginUnit >>> 0) === 0) return 0;
  if (UNIT_GetAlignment113c(m, pOriginUnit) !== 0) return 0;
  if (i32(m, (pScanCtx + 0x08) >>> 0) === 0) return 0;
  if (MONSTERS_IsDead113c(m, pCandidateUnit) !== 0) return 0;

  const pAiGeneral = MONSTER_GetAiGeneralPtr_6FC218E0_113c(m, pCandidateUnit) >>> 0;
  if (pAiGeneral === 0 || (m.u8((pAiGeneral + 0x08) >>> 0) & 0x08) === 0) return 0;

  const posY = UNIT_GetPosY113c(m, pCandidateUnit) | 0;
  const posX = UNIT_GetPosX113c(m, pCandidateUnit) | 0;
  const pRoom = UNITS_GetRoom113c(m, pCandidateUnit) >>> 0;
  const coordIdx = DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, pRoom, posX, posY) | 0;
  if (i32(m, (pScanCtx + 0x10) >>> 0) === coordIdx) {
    m.setU16((pAiGeneral + 0x08) >>> 0, (m.u16((pAiGeneral + 0x08) >>> 0) | 0x08) & 0xffff);
    m.setU32((pScanCtx + 0x08) >>> 0, 0);
  }
  return 0;
}

/**
 * @va D2Game:0x6FCD1AB0
 * Check if `pUnit` has a direct path to `*ppTargetUnit` or find the nearest blocking obstacle.
 */
export function MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  ppTargetUnit: number,
  pnOutDist: number,
  bAllowForPlayer: number,
  nAction: number,
): number {
  hitD2GameVa113c(0x6FCD1AB0)
  if (pUnit !== 0 && m.u32(pUnit >>> 0) === 0) return 0;
  if (bAllowForPlayer === 0) return 0;

  const pTargetUnit = m.u32(ppTargetUnit >>> 0);
  if (pTargetUnit === 0) return 1;
  if ((nAction | 0) > 5) return 0;

  const pPath = m.u32((pUnit + 0x2c) >>> 0);
  const oldType = PATH_GetType113c(m, pPath) | 0;
  const oldTargetUnit = PATH_GetTargetUnit113c(m, pPath) >>> 0;
  const oldFirstX = PATH_GetFirstPointX113c(m, pPath) | 0;
  const oldFirstY = PATH_GetFirstPointY113c(m, pPath) | 0;

  PATH_SetTargetUnit113c(m, pPath, pTargetUnit);
  PATH_SetType113c(m, pPath, 2);
  PATH_Compute113c(m, pPath, pUnit, 0);
  PATH_SetTargetUnit113c(m, pPath, oldTargetUnit);
  PATH_SetTargetPos113c(m, pPath, oldFirstX, oldFirstY);
  PATH_SetType113c(m, pPath, oldType);

  if (PATH_GetNumberOfPathPoints113c(m, pPath) !== 0) return 0;

  const sp = allocScratch(m, 0x10);
  try {
    m.setU32(sp, 0);
    m.setU32((sp + 0x04) >>> 0, 0x7fffffff);
    m.setU32((sp + 0x08) >>> 0, pTargetUnit);
    m.setU32((sp + 0x0c) >>> 0, 0);
    const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, pUnit) >>> 0;
    AITARGET_ScanUnitsByModeTable113c(m, 7, sp, pGame, pUnit, 0);
    const pBlocker = m.u32(sp);
    if (pBlocker === 0) return 1;
    const dist = i32(m, (sp + 0x04) >>> 0);
    if (dist >= 0x14) return 1;
    m.setU32(ppTargetUnit >>> 0, pBlocker);
    m.setU32(pnOutDist >>> 0, dist >>> 0);
    return 0;
  } finally {
    freeScratch(m, 0x10);
  }
}

/**
 * @va D2Game:0x6FCD2120
 * Apply attract/taunt aura state, target unit, AI think fn 0x0B, and schedule AI event 2.
 */
export function MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c(
  m: D2KernMemory113c,
  pSourceUnit: number,
  pGame: number,
  pTargetMonster: number,
  nDurationFrames: number,
): void {
  hitD2GameVa113c(0x6FCD2120)
  if (pTargetMonster === 0) return;
  if ((m.u8((pTargetMonster + 0xc6) >>> 0) & 1) !== 0) return;

  const dwType = i32(m, pTargetMonster >>> 0);
  if (dwType === 0) {
    const mode = i32(m, (pTargetMonster + 0x10) >>> 0);
    if (mode === 0 || mode === 0x11) return;
  } else if (dwType === 1) {
    const mode = i32(m, (pTargetMonster + 0x10) >>> 0);
    if (mode === 0 || mode === 0x0c) return;
  } else {
    return;
  }

  if (dwType !== 1) return;
  if (STATES_CheckState113c(m, pTargetMonster, 0x36) !== 0) return;
  if (SKILLS_CanMonsterReviveInMode2_113c(m, m.u32((pTargetMonster + 0x04) >>> 0)) === 0) return;
  if (((m.u32((pTargetMonster + 0xc4) >>> 0) >>> 2) & 1) === 0) {
    if (SUNIT_IsDeadOrDying113c(m, pTargetMonster) === 0) return;
  }
  if (MONSTER_CheckTypeFlagsMask113c(m, pTargetMonster, 0x0a) !== 0) return;
  if (i32(m, pTargetMonster >>> 0) === 1) {
    const pMonsterData = m.u32((pTargetMonster + 0x14) >>> 0);
    if (pMonsterData !== 0 && (m.u8((pMonsterData + 0x16) >>> 0) & 2) !== 0) return;
  }
  if (SKILLS_CanMonsterReviveInMode2_113c(m, m.u32((pTargetMonster + 0x04) >>> 0)) === 0) return;

  const sp = allocScratch(m, 0x24);
  try {
    m.setU32(sp, pSourceUnit >>> 0);
    m.setU32((sp + 0x04) >>> 0, pTargetMonster >>> 0);
    m.setU32((sp + 0x08) >>> 0, 0x4d);
    m.setU32((sp + 0x0c) >>> 0, 1);
    m.setU32((sp + 0x10) >>> 0, nDurationFrames >>> 0);
    m.setU32((sp + 0x14) >>> 0, 0xffffffff);
    m.setU32((sp + 0x18) >>> 0, 0);
    m.setU32((sp + 0x1c) >>> 0, 0x38);
    m.setU32((sp + 0x20) >>> 0, 0);
    STATES_CreateOrUpdateAuraStatList113c(m, sp);
  } finally {
    freeScratch(m, 0x24);
  }

  UNITS_SetTargetUnitForDynamicUnit113c(m, pTargetMonster, pSourceUnit);
  let pAiGeneral = 0;
  if (i32(m, pTargetMonster >>> 0) === 1) {
    const pMonsterData = m.u32((pTargetMonster + 0x14) >>> 0);
    if (pMonsterData !== 0) {
      pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0);
    }
  }
  AI_InitMonsterAiThinkFn113c(m, pTargetMonster >>> 0, pGame >>> 0, pAiGeneral, 0x0b);

  let pEvent = m.u32((pTargetMonster + 0xdc) >>> 0);
  while (pEvent !== 0) {
    const pNext = m.u32((pEvent + 0x24) >>> 0);
    if (m.u8(pEvent) === 2) {
      EVENT_FreeNode113c(m, pGame, pEvent);
    }
    pEvent = pNext;
  }

  const nextFrame = (m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0;
  EVENT_SetEventFull113c(m, pGame, pTargetMonster, 2, nextFrame, 0, 0, 0);
}

/**
 * @va D2Game:0x6FCD2820
 * Update player arena score based on `Arena.txt` row and score event type `0..6`.
 */
export function ARENA_UpdatePlayerArenaScore_6FCD2820_113c(
  m: D2KernMemory113c,
  pPlayerUnit: number,
  nScoreType: number,
  pGame: number,
  pTargetUnit: number,
): void {
  hitD2GameVa113c(0x6FCD2820)
  if (pPlayerUnit === 0 || m.u32(pPlayerUnit >>> 0) !== 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x73);
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayerUnit) >>> 0;
  const pArenaUnit = pPlayerData !== 0 ? m.u32((pPlayerData + 0x34) >>> 0) : 0;
  if (pArenaUnit === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x77);
  }
  const pGameArena = pGame !== 0 ? m.u32((pGame + 0x1d28) >>> 0) : 0;
  if (pGameArena === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x6c);
  }

  const nArenaId = i32(m, (pGameArena + 0x04) >>> 0);
  const pArenaTxt = DATATBLS_GetArenaTxtRecord113c(m, nArenaId) >>> 0;
  if ((nScoreType | 0) >= 7) {
    throw new D2CommonAssertError('Arena.cpp', 0x7d);
  }

  if ((nScoreType >>> 0) <= 6) {
    if (nScoreType === 2 || nScoreType === 5) {
      const pTargetPlayerData = UNITS_GetPlayerData113c(m, pTargetUnit) >>> 0;
      const pTargetArenaUnit = pTargetPlayerData !== 0 ? m.u32((pTargetPlayerData + 0x34) >>> 0) : 0;
      if (pTargetArenaUnit === 0) {
        throw new D2CommonAssertError('Arena.cpp', 0x8c);
      }
      const pct = i32(m, (pArenaTxt + ((nScoreType & 7) << 2)) >>> 0);
      const prod = Math.imul(pct, i32(m, pTargetArenaUnit >>> 0)) | 0;
      const delta = Math.trunc(prod / 100) | 0;
      m.setU32(pArenaUnit >>> 0, (i32(m, pArenaUnit >>> 0) + delta) >>> 0);
    } else {
      const addPts = i32(m, (pArenaTxt + ((nScoreType & 7) << 2)) >>> 0);
      m.setU32(pArenaUnit >>> 0, (i32(m, pArenaUnit >>> 0) + addPts) >>> 0);
    }
  }

  m.setU32((pArenaUnit + 0x04) >>> 0, 1);
  const pGameArenaAfter = m.u32((pGame + 0x1d28) >>> 0);
  if (pGameArenaAfter === 0) {
    throw new D2CommonAssertError('Arena.cpp', 0x94);
  }
  m.setU32(
    (pGameArenaAfter + 0x08) >>> 0,
    (m.u32((pGameArenaAfter + 0x08) >>> 0) | 0x400) >>> 0,
  );
  UNITROOM_RefreshUnit113c(m, pTargetUnit);
}

/**
 * @va D2Game:0x6FCD2E00
 * Find next animation event code in remaining frames of `pUnit`'s current sequence or AnimData.
 */
export function MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCD2E00)
  const pSeq = ANIMSEQ_GetUnitSeqRecordPtr113c(m, pUnit) >>> 0;
  if (pSeq !== 0) {
    const totalFrames = ANIMSEQ_GetUnitSeqFrameCountFp8_113c(m, pUnit) >> 8;
    const curFrame = i32(m, (pUnit + 0x38) >>> 0) >> 8;
    let f = (curFrame + 1) | 0;
    if (f < totalFrames) {
      const frameFp8 = curFrame << 8;
      const sp = allocScratch(m, 4);
      try {
        while (f < totalFrames) {
          m.setU32(sp, 0);
          const pSeqRec = m.u32((pUnit + 0x30) >>> 0);
          ANIMSEQ_GetEventAtFrame113c(m, pSeqRec, frameFp8, sp);
          const ev = i32(m, sp);
          if (ev !== 0) return ev;
          f = (f + 1) | 0;
        }
      } finally {
        freeScratch(m, 4);
      }
    }
    return 0;
  }

  const frameCount = i32(m, (pUnit + 0x48) >>> 0) >> 8;
  const curFrame = i32(m, (pUnit + 0x44) >>> 0) >> 8;
  const pAnimData = m.u32((pUnit + 0x50) >>> 0);
  if (pAnimData === 0) return 0;
  if ((frameCount >>> 0) > m.u32((pAnimData + 0x08) >>> 0)) return 0;
  let f = (curFrame + 1) | 0;
  if (f >= frameCount) return 0;
  const evByte = m.u8((pAnimData + curFrame + 0x10) >>> 0);
  while (f < frameCount) {
    if (evByte !== 0) return evByte & 0xff;
    f = (f + 1) | 0;
  }
  return 0;
}

/**
 * @va D2Game:0x6FCD2ED0
 * Set active skill param1 expiration frame from calc2 and enable state 12 on `pUnit`.
 */
export function MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD2ED0)
  if ((nSkillId | 0) < 0) return 0;
  const pTables = getSgptDataTablesPtr(m);
  if (pTables === 0 || (nSkillId | 0) >= i32(m, (pTables + 0xba0) >>> 0)) return 0;
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
  if (pSkillsTxtBase === 0) return 0;
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return 0;

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0;
  if (pSkill === 0) return 0;

  let calcVal = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x13c) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0;
  if (calcVal < 1) calcVal = 1;

  const expireFrame = (m.u32((pGame + 0xa8) >>> 0) + calcVal) >>> 0;
  SKILLS_SetParam1113c(m, pSkill, expireFrame);
  if (STATES_CheckState113c(m, pUnit, 0x0c) === 0) {
    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x0c, 1);
  }
  return 1;
}

/**
 * @va D2Game:0x6FCD2FC0
 * Evaluate skill calc1 or calc2 based on skill flag bit 1 and set `pUnit` sequence frame.
 */
export function MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD2FC0)
  if ((nSkillId | 0) < 0) return 0;
  const pTables = getSgptDataTablesPtr(m);
  if (pTables === 0 || (nSkillId | 0) >= i32(m, (pTables + 0xba0) >>> 0)) return 0;
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
  if (pSkillsTxtBase === 0) return 0;
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return 0;

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0;
  if (pSkill === 0) return 0;

  const flags = SKILLS_GetFlags113c(m, pSkill) | 0;
  let calcExpr = 0;
  if ((flags & 2) !== 0) {
    SKILLS_SetParam0C113c(m, pSkill, 0);
    calcExpr = i32(m, (pSkillsTxt + 0x13c) >>> 0);
  } else {
    calcExpr = i32(m, (pSkillsTxt + 0x138) >>> 0);
  }

  const frameVal = SKILLS_EvalCalcByOffset113c(m, pUnit, calcExpr, nSkillId, nSkillLevel) | 0;
  UNITS_SetSeqFrameFromLowByte113c(m, pUnit, frameVal);
  return 1;
}

/**
 * @va D2Game:0x6FCD3060
 * Set unit flag 0x40, refresh frame metrics, and heal life by `calc1` percent of current life.
 */
export function MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD3060)
  if ((nSkillId | 0) < 0) return 0;
  const pTables = getSgptDataTablesPtr(m);
  if (pTables === 0 || (nSkillId | 0) >= i32(m, (pTables + 0xba0) >>> 0)) return 0;
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
  if (pSkillsTxtBase === 0) return 0;
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return 0;

  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x40) >>> 0);
  }

  const sp = allocScratch(m, 8);
  try {
    m.setU32(sp, 0);
    m.setU32((sp + 4) >>> 0, 0);
    UNITS_GetShiftedFrameMetrics113c(m, pUnit, sp, (sp + 4) >>> 0);
    if (i32(m, sp) <= 0 && pUnit !== 0) {
      m.setU32((pUnit + 0x3c) >>> 0, 0);
    }
  } finally {
    freeScratch(m, 8);
  }

  const healPct = SKILLS_EvalCalcByOffset113c(
    m,
    pUnit,
    i32(m, (pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0;
  if (healPct > 0) {
    const curLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0) | 0;
    const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0;
    const addLife = mulDiv113c(healPct, curLife, 100) | 0;
    let newLife = (curLife + addLife) | 0;
    if (newLife >= maxLife) {
      newLife = maxLife;
    }
    STATLIST_SetUnitStat113c(m, pUnit, 6, newLife, 0);
  }
  return 1;
}

/**
 * @va D2Game:0x6FCD3120
 * Clear unit flags 0x0E at `+0xC4` and reset collision mask `0x1000` (pattern 5) at unit coords.
 */
export function MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c(
  m: D2KernMemory113c,
  pUnit: number,
  _arg1 = 0,
  _arg2 = 0,
): number {
  hitD2GameVa113c(0x6FCD3120)
  if (pUnit !== 0) {
    m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) & 0xfffffff1) >>> 0);
  }
  const dwType1 = i32(m, pUnit >>> 0);
  let posY = 0;
  if (dwType1 === 2 || (dwType1 > 3 && dwType1 <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0);
    posY = i32(m, (pStaticPath + 0x10) >>> 0);
  } else {
    const pPath = m.u32((pUnit + 0x2c) >>> 0);
    posY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0;
  }

  const dwType2 = i32(m, pUnit >>> 0);
  let posX = 0;
  if (dwType2 === 2 || (dwType2 > 3 && dwType2 <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0);
    posX = i32(m, (pStaticPath + 0x0c) >>> 0);
  } else {
    const pPath = m.u32((pUnit + 0x2c) >>> 0);
    posX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0;
  }

  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
  COLLISION_ResetMaskWithPattern113c(m, pRoom, posX, posY, 5, 0x1000);
  return 1;
}

/**
 * @va D2Game:0x6FCD31D0
 * Cap missile total/remaining frames to 77, seed PRNG with firstX + offset, and compute path type 10.
 */
export function MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c(
  m: D2KernMemory113c,
  pMissile: number,
  nSeedOffset: number,
): void {
  hitD2GameVa113c(0x6FCD31D0)
  if (pMissile === 0) return;
  let totalFrames = MISSILE_GetTotalFrames113c(m, pMissile) | 0;
  if (totalFrames >= 0x4e) {
    totalFrames = 0x4d;
    MISSILE_SetTotalFrames113c(m, pMissile, 0x4d);
    MISSILE_SetRemainingFrames113c(m, pMissile, 0x4d);
  }

  const pPath = m.u32((pMissile + 0x2c) >>> 0);
  const pSeed = (pMissile + 0x20) >>> 0;
  const firstX = PATH_GetFirstPointX113c(m, pPath) | 0;
  SEED_InitLowSeed113c(m, pSeed, (firstX + (nSeedOffset | 0)) | 0);

  const roll = stepUnitSeedMod(m, pSeed, 100);
  if (roll >= 0x14) {
    PATH_SetType113c(m, pPath, 0x0a);
    PATH_SetNewDistance113c(m, pPath, totalFrames);
    PATH_Compute113c(m, pPath, pMissile, 0);
  }
}

/**
 * @va D2Game:0x6FCD32E0
 * Configure missile path distance, anim speed, and frame counts from skill calc1 or Missiles.txt range.
 */
export function MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pMissile: number,
  pOwnerUnit: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD32E0)
  if ((nSkillId | 0) < 0) return 0;
  const pTables = getSgptDataTablesPtr(m);
  if (pTables === 0 || (nSkillId | 0) >= i32(m, (pTables + 0xba0) >>> 0)) return 0;
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
  if (pSkillsTxtBase === 0) return 0;
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  if (pSkillsTxt === 0 || pMissile === 0) return 0;

  const nMissileId = i32(m, (pMissile + 0x04) >>> 0);
  if (nMissileId < 0 || nMissileId >= i32(m, (pTables + 0xb6c) >>> 0)) return 0;
  const pMissilesTxtBase = m.u32((pTables + 0xb64) >>> 0);
  if (pMissilesTxtBase === 0) return 0;
  const pMissilesTxt = (pMissilesTxtBase + Math.imul(nMissileId, 0x1a4)) >>> 0;
  if (pMissilesTxt === 0) return 0;

  let dist = SKILLS_EvalCalcByOffset113c(
    m,
    pOwnerUnit,
    i32(m, (pSkillsTxt + 0x138) >>> 0),
    nSkillId,
    nSkillLevel,
  ) | 0;
  if (dist <= 0) {
    dist = (i32(m, (pMissilesTxt + 0x3c) >>> 0) + (nSkillLevel | 0) - 1) | 0;
  }
  if (dist <= 1) {
    dist = 1;
  } else if (dist >= 0xff) {
    dist = 0xff;
  }

  const pPath = m.u32((pMissile + 0x2c) >>> 0);
  PATH_SetNewDistance113c(m, pPath, dist);
  const animRateFp8 = (m.u8((pMissilesTxt + 0x178) >>> 0) & 0xff) << 8;
  const animSpeed = Math.trunc(animRateFp8 / dist) | 0;
  UNITS_SetAnimSpeed113c(m, pMissile, animSpeed);
  MISSILE_SetTotalFrames113c(m, pMissile, dist);
  MISSILE_SetRemainingFrames113c(m, pMissile, dist);
  return 1;
}

/**
 * @va D2Game:0x6FCD35A0
 * Roll skill calc1..calc2 range and store target GUID/type in active skill params 1..3.
 */
export function MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nSkillId: number,
  nSkillLevel: number,
): number {
  hitD2GameVa113c(0x6FCD35A0)
  if ((nSkillId | 0) < 0) return 0;
  const pTables = getSgptDataTablesPtr(m);
  if (pTables === 0 || (nSkillId | 0) >= i32(m, (pTables + 0xba0) >>> 0)) return 0;
  const pSkillsTxtBase = m.u32((pTables + 0xb98) >>> 0);
  if (pSkillsTxtBase === 0) return 0;
  const pSkillsTxt = (pSkillsTxtBase + Math.imul(nSkillId | 0, 0x23c)) >>> 0;
  if (pSkillsTxt === 0) return 0;

  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0;
  if (pSkill === 0) return 0;

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pTargetUnit = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0;
  if (pTargetUnit === (pUnit >>> 0) || pTargetUnit === 0) return 0;

  const sp = allocScratch(m, 8);
  try {
    SEED_InitSeed113c(m, sp);
    const seedVal = (m.u32((pUnit + 0x0c) >>> 0) + m.u32((pTargetUnit + 0x0c) >>> 0)) | 0;
    SEED_InitLowSeed113c(m, sp, seedVal);

    const minVal = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x138) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
    const maxVal = SKILLS_EvalCalcByOffset113c(
      m,
      pUnit,
      i32(m, (pSkillsTxt + 0x13c) >>> 0),
      nSkillId,
      nSkillLevel,
    ) | 0;
    const roll = SEED_RollLimitedFast113c(m, sp, (maxVal - minVal) | 0) | 0;
    let val = (roll + minVal) | 0;
    if (val < 1) val = 1;

    SKILLS_SetParam1113c(m, pSkill, val);
    SKILLS_SetParam2113c(m, pSkill, i32(m, (pTargetUnit + 0x0c) >>> 0));
    SKILLS_SetParam3113c(m, pSkill, i32(m, pTargetUnit >>> 0));
    return 1;
  } finally {
    freeScratch(m, 8);
  }
}

/**
 * @va D2Game:0x6FCD36A0
 * Record target GUID/type in active skill params 1..2, clear path target unit, and set path target pos.
 */
export function MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  _arg1 = 0,
  _arg2 = 0,
): number {
  hitD2GameVa113c(0x6FCD36A0)
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pUnit) >>> 0;
  if (pSkill === 0) return 0;

  SUNIT_ValidatePathTargetUnit113c(m, pUnit, pGame);
  const pTargetUnit = PATH_GetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0)) >>> 0;
  if (pTargetUnit === (pUnit >>> 0) || pTargetUnit === 0) return 0;

  SKILLS_SetParam0C113c(m, pSkill, 0);
  SKILLS_SetParam1113c(m, pSkill, i32(m, (pTargetUnit + 0x0c) >>> 0));
  SKILLS_SetParam2113c(m, pSkill, i32(m, pTargetUnit >>> 0));
  PATH_SetTargetUnit113c(m, m.u32((pUnit + 0x2c) >>> 0), 0);

  const dwType1 = i32(m, pTargetUnit >>> 0);
  let targetY = 0;
  if (dwType1 === 2 || (dwType1 > 3 && dwType1 <= 5)) {
    const pStaticPath = m.u32((pTargetUnit + 0x2c) >>> 0);
    targetY = i32(m, (pStaticPath + 0x10) >>> 0);
  } else {
    const pPath = m.u32((pTargetUnit + 0x2c) >>> 0);
    targetY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) | 0 : 0;
  }

  const dwType2 = i32(m, pTargetUnit >>> 0);
  let targetX = 0;
  if (dwType2 === 2 || (dwType2 > 3 && dwType2 <= 5)) {
    const pStaticPath = m.u32((pTargetUnit + 0x2c) >>> 0);
    targetX = i32(m, (pStaticPath + 0x0c) >>> 0);
  } else {
    const pPath = m.u32((pTargetUnit + 0x2c) >>> 0);
    targetX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) | 0 : 0;
  }

  PATH_SetTargetPos113c(m, m.u32((pUnit + 0x2c) >>> 0), targetX, targetY);
  return 1;
}

registerMonsterAiThinkVaHandler113c(0x6fcc5b30, MONAI_NestOrMeleeWanderThink_6FCC5B30_113c);
