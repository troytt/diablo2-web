/**
 * Diablo II v1.13c `D2Game.dll` Monster AI & Mode Action Pipeline (`[K2]` Wave 5 Batch 10 `w5b10`):
 * 12 `D2Game.dll` v1.13c functions in `0x6FD11C30 .. 0x6FD14260` (image base `0x6FC20000`).
 *
 * Clean-room 1:1 binary-isomorphic translations operating purely on `D2KernMemory113c`.
 */

import { COLLISION_CheckMaskWithPattern2_113c } from '../common/collision.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32, sdiv32 } from '../common/int-math.ts'
import {
  SKILLS_GetUsedSkillMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.ts'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetStepNum113c,
} from '../common/path.ts'
import {
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetSkillIdFromSkill113c,
} from '../common/skills.ts'
import { STATES_CheckState113c } from '../common/statlist.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITS_GetApproximateDistance113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory.ts'
import {
  AI_CastSkillWithMode113c,
  MONSTER_InitModeChangeStrc113c,
  type AiFallenHooks113c,
} from './ai-fallen-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import {
  AI_FindNearestPlayerOrAlly113c,
  AI_Stall113c,
  MONSTER_StartMode113c as MONSTER_StartModeMem113c,
} from './combat-a1c-113c.ts'
import { NET_SendUnitTargetedSkillAction113c } from './k2-gap-itemdef-113c.ts'
import { AI_ScheduleAiThinkTimer_6FD120C0_113c } from './k2-w2b8-113c.ts'
import {
  MONSTATS2_CheckModeBit113c,
  SEED_RollLimitedFast113c,
} from './regpop-spawn-113c.ts'
import {
  AI_ApproachTarget113c,
  AI_IdleWander113c,
  MONSTER_StartMode113c,
  type FallenSliceWorld113c,
} from './replay-kernel-113c.ts'
import {
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_SetEventFull113c,
  type EventWheelHooks113c,
} from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

export type { D2KernMemory113c }

/** Reentrant scratch stack pointer for `w5b10` stack structs (`D2ModeChangeStrc`, packet buffers, etc.). */
let k2W5B10StackPtr = 0x7e070000

/** Optional host/world hooks for `w5b10` routines. */
export interface K2W5B10Hooks113c extends AiFallenHooks113c {
  readonly world?: FallenSliceWorld113c | undefined
  readonly eventHooks?: EventWheelHooks113c | undefined
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

function getUnitXInline113c(m: D2KernMemory113c, pUnit: number): number {
  const dwType = m.u32(pUnit >>> 0) | 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    return m.u32((pStaticPath + 0x0c) >>> 0) | 0
  }
  const pDynamicPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pDynamicPath === 0) {
    return 0
  }
  return PATH_GetPosX113c(m, pDynamicPath) | 0
}

function getUnitYInline113c(m: D2KernMemory113c, pUnit: number): number {
  const dwType = m.u32(pUnit >>> 0) | 0
  if (dwType === 2 || (dwType > 3 && dwType <= 5)) {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    return m.u32((pStaticPath + 0x10) >>> 0) | 0
  }
  const pDynamicPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (pDynamicPath === 0) {
    return 0
  }
  return PATH_GetPosY113c(m, pDynamicPath) | 0
}

function dispatchMonsterStartMode6FC95E10(
  m: D2KernMemory113c,
  pGame: number,
  pModeArgs: number,
  bUpdateAnim: number,
  hooks?: K2W5B10Hooks113c | undefined,
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

function aiIdleWander6FD11B10(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  range: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  if (hooks !== undefined && hooks.world !== undefined) {
    return AI_IdleWander113c(hooks.world, pUnit >>> 0, range | 0) ? 1 : 0
  }
  return AI_IdleWander113c(m, pGame >>> 0, pUnit >>> 0, range | 0) | 0
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
  hooks?: K2W5B10Hooks113c | undefined,
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
  if (hooks === undefined || hooks.onMonsterStartMode === undefined) {
    return (
      AI_ApproachTarget113c(
        m,
        pGame >>> 0,
        pUnit >>> 0,
        pTarget >>> 0,
        nMode | 0,
        nX | 0,
        nY | 0,
        nStepNum | 0,
        dwFlags | 0,
      ) | 0
    )
  }

  let mode = nMode | 0
  if (mode === 0x0f && (STATES_CheckState113c(m, pUnit >>> 0, 0x3c) | 0) !== 0) {
    let pAiControl = 0
    if ((pUnit >>> 0) !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    m.setU32((pAiControl + 0x18) >>> 0, 0)
    m.setU32((pAiControl + 0x1c) >>> 0, 0)
    m.setU8((pAiControl + 0x20) >>> 0, 0)
    mode = 2
  }

  PATH_SetStepNum113c(m, m.u32((pUnit + 0x2c) >>> 0), nStepNum | 0)

  const sp = (k2W5B10StackPtr - 0x20) >>> 0
  k2W5B10StackPtr = sp
  try {
    MONSTER_InitModeChangeStrc113c(m, pUnit >>> 0, sp, mode)
    if ((pTarget >>> 0) !== 0) {
      m.setU32((sp + 0x08) >>> 0, pTarget >>> 0)
    } else {
      m.setU32((sp + 0x0c) >>> 0, nX >>> 0)
      m.setU32((sp + 0x10) >>> 0, nY >>> 0)
    }

    const res = dispatchMonsterStartMode6FC95E10(m, pGame >>> 0, sp, 1, hooks) | 0
    if (res !== 0) {
      return res
    }

    const flagsByte = dwFlags & 0xff
    if ((flagsByte & 4) !== 0) {
      let pEvent = m.u32((pUnit + 0xdc) >>> 0) >>> 0
      while (pEvent !== 0) {
        const pNext = m.u32((pEvent + 0x24) >>> 0) >>> 0
        if (m.u8(pEvent) === 2) {
          EVENT_FreeNode113c(m, pGame >>> 0, pEvent)
        }
        pEvent = pNext
      }
    }

    if ((flagsByte & 1) !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        const pAiGeneral = m.u32((pMonData + 0x28) >>> 0) >>> 0
        if (pAiGeneral !== 0) {
          m.setU8((pAiGeneral + 8) >>> 0, (m.u8((pAiGeneral + 8) >>> 0) | 0x40) & 0xff)
        }
      }
    }

    if ((flagsByte & 2) !== 0) {
      const roll = (stepSeed64At113c(m, (pUnit + 0x20) >>> 0) >>> 0) % 100
      if (roll < 0x46) {
        aiIdleWander6FD11B10(m, pGame >>> 0, pUnit >>> 0, 4, hooks)
        return 1
      }
      AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
      return 1
    }

    return res
  } finally {
    k2W5B10StackPtr = (sp + 0x20) >>> 0
  }
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
  hooks?: K2W5B10Hooks113c | undefined,
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
    AI_Stall113c(m, pGame >>> 0, pUnit >>> 0, 10)
  }
  return res
}

/**
 * Walks `pUnit` (`edi`) to a point at distance `nDistance` (`[esp+8]`) from `pFromUnit` (`eax`)
 * along the ray `(pUnit - pFromUnit)`, clearing `pUnit`'s used skill and dispatching `MONSTER_StartMode`
 * in `MONMODE_WALK` (`2`, speed byte `0x65`). Returns `0` if `UNITS_GetApproximateDistance` is `0`.
 *
 * @va D2Game:0x6FD11C30
 */
export function AI_WalkToLeashDistanceFromUnit_6FD11C30_113c(
  m: D2KernMemory113c,
  pFromUnit: number,
  pUnit: number,
  pGame: number,
  nDistance: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  hitD2GameVa113c(0x6FD11C30)
  const dist = UNITS_GetApproximateDistance113c(m, pUnit >>> 0, pFromUnit >>> 0) | 0
  const fromX = getUnitXInline113c(m, pFromUnit >>> 0)
  const fromY = getUnitYInline113c(m, pFromUnit >>> 0)
  if (dist === 0) {
    return 0
  }

  const unitX = getUnitXInline113c(m, pUnit >>> 0)
  const dx = sdiv32(imul32((unitX - fromX) | 0, nDistance | 0), dist)
  const unitY = getUnitYInline113c(m, pUnit >>> 0)
  const dy = sdiv32(imul32((unitY - fromY) | 0, nDistance | 0), dist)

  const targetX = (fromX + dx) | 0
  const targetY = (fromY + dy) | 0

  SKILLS_SetUsedSkillMemPort113c(m, pUnit >>> 0, 0)

  const sp = (k2W5B10StackPtr - 0x20) >>> 0
  k2W5B10StackPtr = sp
  try {
    m.fill(sp, 0x20, 0)
    m.setU32(sp, 2)
    m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
    m.setU32((sp + 0x0c) >>> 0, targetX >>> 0)
    m.setU32((sp + 0x10) >>> 0, targetY >>> 0)
    m.setU8((sp + 0x15) >>> 0, 0x65)
    return dispatchMonsterStartMode6FC95E10(m, pGame >>> 0, sp, 1, hooks) | 0
  } finally {
    k2W5B10StackPtr = (sp + 0x20) >>> 0
  }
}

/**
 * Schedules an `EVENT_AITHINK` (`2`) timer on `pUnit` (`ebx`) at `pGame->dwGameFrame + (nDelay || 1)`
 * unless a pending type-`2` event already fires after `dwGameFrame` and strictly before `dwGameFrame + delay`,
 * freeing any existing type-`2` nodes on `pUnit->pSrvTimerList` (`+0xDC`) before inserting the new event.
 *
 * @va D2Game:0x6FD12040
 */
export function AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
  nDelay: number,
  hooks?: K2W5B10Hooks113c | undefined,
): void {
  hitD2GameVa113c(0x6FD12040)
  const delay = (nDelay | 0) === 0 ? 1 : nDelay | 0
  const nextFrame = EVENT_GetNextEventFrame113c(m, pUnit >>> 0, 2) >>> 0
  if (nextFrame !== 0) {
    const curFrame = m.u32((pGame + 0xa8) >>> 0) >>> 0
    if (nextFrame !== curFrame) {
      const targetFrame = (curFrame + delay) >>> 0
      if (nextFrame < targetFrame) {
        return
      }
    }
  }

  if ((pUnit >>> 0) !== 0) {
    let pNode = m.u32((pUnit + 0xdc) >>> 0) >>> 0
    while (pNode !== 0) {
      const pNext = m.u32((pNode + 0x24) >>> 0) >>> 0
      if (m.u8(pNode) === 2) {
        EVENT_FreeNode113c(m, pGame >>> 0, pNode)
      }
      pNode = pNext
    }
  }

  const newFrame = (m.u32((pGame + 0xa8) >>> 0) + delay) >>> 0
  if (hooks !== undefined && hooks.eventHooks !== undefined) {
    EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 2, newFrame, 0, 0, 0, hooks.eventHooks)
  } else {
    EVENT_SetEventFull113c(m, pGame >>> 0, pUnit >>> 0, 2, newFrame, 0, 0, 0)
  }
}

/**
 * Rolls random subtile offsets in `[-nRadius, +nRadius)` around `pUnit` (`esi`) using two draws
 * on `pUnit->tSeed` (`+0x20`) and casts `nSkillId` (`[esp+8]`) at `(unitX + dx, unitY + dy)`
 * with animation mode `nMode` (`[esp+12]`) via `AI_CastSkillWithMode` (`0x6FD12380`).
 *
 * @va D2Game:0x6FD12420
 */
export function AI_CastSkillWithModeRandomScatter_6FD12420_113c(
  m: D2KernMemory113c,
  pUnit: number,
  nRadius: number,
  nSkillId: number,
  nMode: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  hitD2GameVa113c(0x6FD12420)
  const unitX = getUnitXInline113c(m, pUnit >>> 0)
  const diameter = ((nRadius | 0) * 2) | 0
  const rX = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, diameter) | 0
  const targetX = ((rX - (nRadius | 0)) + unitX) | 0

  const unitY = getUnitYInline113c(m, pUnit >>> 0)
  const rY = SEED_RollLimitedFast113c(m, (pUnit + 0x20) >>> 0, diameter) | 0
  const targetY = ((rY - (nRadius | 0)) + unitY) | 0

  const pGame = m.u32((pUnit + 0x80) >>> 0) >>> 0
  return castSkillWithMode6FD12380(
    m,
    nMode & 0xff,
    pUnit >>> 0,
    pGame,
    nSkillId | 0,
    0,
    targetX,
    targetY,
    hooks,
  )
}

/**
 * Steps `pUnit->tSeed` (`ecx + 0x20`) to select circle-strafe path type `5` (`< 0x80`) or `6` (`>= 0x80`),
 * stores `dwPathType` (`+0x18`) and clamped `bNewDist` (`+0x20`, max `0x4D`) on `pUnit->pMonsterData->pAiControl`,
 * and walks (`MONMODE_WALK = 2`, `nStepNum = 1`) toward `pTarget` via `AI_ApproachTarget` (`0x6FD12540`).
 *
 * @va D2Game:0x6FD126B0
 */
export function AI_CircleStrafeTarget_6FD126B0_113c(
  m: D2KernMemory113c,
  pUnit: number,
  bClearAiThinkOnFail: number,
  pGame: number,
  pTarget: number,
  nDistance: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  hitD2GameVa113c(0x6FD126B0)
  const newLo = stepSeed64At113c(m, (pUnit + 0x20) >>> 0)
  let pathType = (newLo & 0xff) >= 0x80 ? 6 : 5
  if (pathType === 1) {
    pathType = 7
  }

  let pAiControl = 0
  if ((pUnit >>> 0) !== 0 && (m.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
    if (pMonData !== 0) {
      pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
    }
  }

  if (pathType !== 0) {
    m.setU32((pAiControl + 0x18) >>> 0, pathType >>> 0)
  }

  let distByte = nDistance & 0xff
  if (distByte !== 0) {
    if (distByte >= 0x4e) {
      distByte = 0x4d
    }
    m.setU8((pAiControl + 0x20) >>> 0, distByte)
  }

  const flags = (bClearAiThinkOnFail | 0) !== 0 ? 4 : 0
  return aiApproachTarget6FD12540(
    m,
    pGame >>> 0,
    pUnit >>> 0,
    pTarget >>> 0,
    2,
    0,
    0,
    1,
    flags,
    hooks,
  )
}

/**
 * Picks a random perimeter point on the `[-nRange, +nRange]` square around `pOriginUnit` (`ecx`)
 * using four draws on `pUnit->tSeed` (`[esp+8] + 0x20`), and runs (`MONMODE_RUN = 15`, `nStepNum = 1`)
 * `pUnit` to that coordinate via `AI_ApproachTarget` (`0x6FD12540`).
 *
 * @va D2Game:0x6FD12750
 */
export function AI_RunWanderAroundUnit_6FD12750_113c(
  m: D2KernMemory113c,
  pOriginUnit: number,
  nRange: number,
  pGame: number,
  pUnit: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  hitD2GameVa113c(0x6FD12750)
  const originX = getUnitXInline113c(m, pOriginUnit >>> 0)
  const originY = getUnitYInline113c(m, pOriginUnit >>> 0)

  const pSeed = (pUnit + 0x20) >>> 0
  const lo1 = stepSeed64At113c(m, pSeed)
  const uRange = nRange & 0xff
  let dx = 0
  let dy = 0
  if ((lo1 & 1) !== 0) {
    dx = uRange
    dy = SEED_RollLimitedFast113c(m, pSeed, uRange) | 0
  } else {
    dy = uRange
    dx = SEED_RollLimitedFast113c(m, pSeed, uRange) | 0
  }

  const lo3 = stepSeed64At113c(m, pSeed)
  if ((lo3 & 1) !== 0) {
    dx = (-dx) | 0
  }
  const lo4 = stepSeed64At113c(m, pSeed)
  if ((lo4 & 1) !== 0) {
    dy = (-dy) | 0
  }

  const targetX = (originX + dx) | 0
  const targetY = (originY + dy) | 0
  return aiApproachTarget6FD12540(
    m,
    pGame >>> 0,
    pUnit >>> 0,
    0,
    0x0f,
    targetX,
    targetY,
    1,
    0,
    hooks,
  )
}

/**
 * Walks `pUnit` (`[esp+8]`) to a random perimeter point on `[-nRange, +nRange]` around `pOriginUnit` (`ecx`),
 * or falls back to `AI_IdleWander` (`0x6FD11B10`, `range = 2`) when `pOriginUnit == 0`.
 *
 * @va D2Game:0x6FD12870
 */
export function AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(
  m: D2KernMemory113c,
  pOriginUnit: number,
  nRange: number,
  pGame: number,
  pUnit: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  hitD2GameVa113c(0x6FD12870)
  if ((pOriginUnit >>> 0) === 0) {
    if (hooks !== undefined && hooks.world !== undefined) {
      return AI_IdleWander113c(hooks.world, pUnit >>> 0, 2) ? 1 : 0
    }
    return AI_WalkWanderAroundSelf_6FD129B0_113c(m, 2, pGame >>> 0, pUnit >>> 0, hooks)
  }

  const originX = getUnitXInline113c(m, pOriginUnit >>> 0)
  const originY = getUnitYInline113c(m, pOriginUnit >>> 0)

  const pSeed = (pUnit + 0x20) >>> 0
  const lo1 = stepSeed64At113c(m, pSeed)
  const uRange = nRange & 0xff
  let dx = 0
  let dy = 0
  if ((lo1 & 1) !== 0) {
    dx = uRange
    dy = SEED_RollLimitedFast113c(m, pSeed, uRange) | 0
  } else {
    dy = uRange
    dx = SEED_RollLimitedFast113c(m, pSeed, uRange) | 0
  }

  const lo3 = stepSeed64At113c(m, pSeed)
  if ((lo3 & 1) !== 0) {
    dx = (-dx) | 0
  }
  const lo4 = stepSeed64At113c(m, pSeed)
  if ((lo4 & 1) !== 0) {
    dy = (-dy) | 0
  }

  const targetX = (originX + dx) | 0
  const targetY = (originY + dy) | 0
  return aiApproachTarget6FD12540(
    m,
    pGame >>> 0,
    pUnit >>> 0,
    0,
    2,
    targetX,
    targetY,
    1,
    0,
    hooks,
  )
}

/**
 * Walks `pUnit` (`[esp+8]`) to a random perimeter point on the `[-nRange, +nRange]` square around
 * its own position (`al = nRange`) using four draws on `pUnit->tSeed` (`+0x20`), forwarding to
 * `AI_ApproachTarget` (`0x6FD12540`, `MONMODE_WALK = 2`, `nStepNum = 1`).
 *
 * @va D2Game:0x6FD129B0
 */
export function AI_WalkWanderAroundSelf_6FD129B0_113c(
  m: D2KernMemory113c,
  nRange: number,
  pGame: number,
  pUnit: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  hitD2GameVa113c(0x6FD129B0)
  const unitX = getUnitXInline113c(m, pUnit >>> 0)
  const unitY = getUnitYInline113c(m, pUnit >>> 0)

  const pSeed = (pUnit + 0x20) >>> 0
  const lo1 = stepSeed64At113c(m, pSeed)
  const uRange = nRange & 0xff
  let dx = 0
  let dy = 0
  if ((lo1 & 1) !== 0) {
    dx = uRange
    dy = SEED_RollLimitedFast113c(m, pSeed, uRange) | 0
  } else {
    dy = uRange
    dx = SEED_RollLimitedFast113c(m, pSeed, uRange) | 0
  }

  const lo3 = stepSeed64At113c(m, pSeed)
  if ((lo3 & 1) !== 0) {
    dx = (-dx) | 0
  }
  const lo4 = stepSeed64At113c(m, pSeed)
  if ((lo4 & 1) !== 0) {
    dy = (-dy) | 0
  }

  const targetX = (unitX + dx) | 0
  const targetY = (unitY + dy) | 0
  return aiApproachTarget6FD12540(
    m,
    pGame >>> 0,
    pUnit >>> 0,
    0,
    2,
    targetX,
    targetY,
    1,
    0,
    hooks,
  )
}

/**
 * Runs (`MONMODE_RUN = 15`) `pUnit` (`ebx`) away from `pFromUnit` (`eax`) by `nDistSteps & 0xFF` (`[esp+8]`)
 * along the per-axis sign vector, updating `pAiControl->bNewDist` (`+0x20`, clamped to `0x4D`) when
 * `(nDistSteps & 0xFF) > 5`, and forwarding `bClearAiThinkOnFail ? 4 : 0` to `AI_ApproachTarget` (`0x6FD12540`).
 *
 * @va D2Game:0x6FD12C10
 */
export function AI_RunFleeFromUnit_6FD12C10_113c(
  m: D2KernMemory113c,
  pFromUnit: number,
  pUnit: number,
  pGame: number,
  nDistSteps: number,
  bClearAiThinkOnFail: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  hitD2GameVa113c(0x6FD12C10)
  const unitX = getUnitXInline113c(m, pUnit >>> 0)
  const unitY = getUnitYInline113c(m, pUnit >>> 0)
  const fromX = getUnitXInline113c(m, pFromUnit >>> 0)
  const fromY = getUnitYInline113c(m, pFromUnit >>> 0)

  let sx = 0
  if ((fromX >>> 0) > (unitX >>> 0)) {
    sx = -1
  }
  if ((fromX >>> 0) < (unitX >>> 0)) {
    sx = 1
  }

  let sy = 0
  if ((fromY >>> 0) > (unitY >>> 0)) {
    sy = -1
  }
  if ((fromY >>> 0) < (unitY >>> 0)) {
    sy = 1
  }

  const uDist = nDistSteps & 0xff
  const targetY = (unitY + imul32(uDist, sy)) | 0
  const targetX = (unitX + imul32(uDist, sx)) | 0

  if (uDist > 5) {
    let pAiControl = 0
    if ((m.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        pAiControl = m.u32((pMonData + 0x2c) >>> 0) >>> 0
      }
    }
    if (uDist !== 0) {
      const clampedDist = uDist >= 0x4e ? 0x4d : uDist
      m.setU8((pAiControl + 0x20) >>> 0, clampedDist)
    }
  }

  const flags = (bClearAiThinkOnFail | 0) !== 0 ? 4 : 0
  return aiApproachTarget6FD12540(
    m,
    pGame >>> 0,
    pUnit >>> 0,
    0,
    0x0f,
    targetX,
    targetY,
    1,
    flags,
    hooks,
  )
}

/**
 * Searches for a nearby player/ally target via `AI_FindNearestPlayerOrAlly` (`0x6FCD1C90`);
 * if none is found, checks whether `pUnit` (`[esp+8]`) overlaps collision mask `0x40` and either
 * wanders (`range = 5`) if `MONSTATS2_CheckModeBit(nClassId, 2)` is set or schedules an AI think
 * timer in `20` frames (`0x6FD120C0`), returning `pTarget` (`0` when unengaged).
 *
 * @va D2Game:0x6FD13150
 */
export function AI_FindTargetOrUnstickOverlap_6FD13150_113c(
  m: D2KernMemory113c,
  pOutInMeleeRange: number,
  pOutDistance: number,
  pAiControl: number,
  pGame: number,
  pUnit: number,
  hooks?: K2W5B10Hooks113c | undefined,
): number {
  hitD2GameVa113c(0x6FD13150)
  const unitRoom0 = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  if (unitRoom0 !== 0) {
    if ((pAiControl >>> 0) !== 0) {
      const wAiFlags = m.u16((pAiControl + 0x08) >>> 0)
      if ((wAiFlags & 0x40) !== 0) {
        m.setU16((pAiControl + 0x08) >>> 0, wAiFlags & 0xffbf)
      }
    }
    const found = AI_FindNearestPlayerOrAlly113c(m, pGame >>> 0, pUnit >>> 0)
    if ((found.pTarget >>> 0) !== 0) {
      if ((pAiControl >>> 0) !== 0) {
        m.setU8((pAiControl + 0x08) >>> 0, (m.u8((pAiControl + 0x08) >>> 0) | 0x08) & 0xff)
      }
      if ((pOutInMeleeRange >>> 0) !== 0) {
        m.setU32(pOutInMeleeRange >>> 0, found.inMeleeRange >>> 0)
      }
      if ((pOutDistance >>> 0) !== 0) {
        m.setU32(pOutDistance >>> 0, found.distance >>> 0)
      }
      return found.pTarget >>> 0
    }
    if ((pOutInMeleeRange >>> 0) !== 0) {
      m.setU32(pOutInMeleeRange >>> 0, 0)
    }
    if ((pOutDistance >>> 0) !== 0) {
      const outDist = found.distance === 0x7fffffff ? 0 : found.distance >>> 0
      m.setU32(pOutDistance >>> 0, outDist)
    }
  }

  const nCollisionPattern = PATH_GetUnitCollisionPattern113c(m, pUnit >>> 0) | 0
  const unitY = getUnitYInline113c(m, pUnit >>> 0)
  const unitX = getUnitXInline113c(m, pUnit >>> 0)
  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const hasOverlap =
    COLLISION_CheckMaskWithPattern2_113c(m, pRoom, unitX, unitY, nCollisionPattern, 0x40) | 0
  if (hasOverlap !== 0) {
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    if ((MONSTATS2_CheckModeBit113c(m, nClassId, 2) | 0) !== 0) {
      if (hooks !== undefined && hooks.world !== undefined) {
        AI_IdleWander113c(hooks.world, pUnit >>> 0, 5)
      } else {
        AI_WalkWanderAroundSelf_6FD129B0_113c(m, 5, pGame >>> 0, pUnit >>> 0, hooks)
      }
      return 0
    }
  }

  AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame >>> 0, pUnit >>> 0, 0x14)
  return 0
}

/**
 * Builds and queues 14-byte S2C packet `0x57` (`D2GS_MONSTERUNIQUE`) to `pClient` (`[esp+4]`, channel `1`)
 * when `pMonster` (`ebx`) is a monster (`dwType == 1`) with `pMonsterData->bFlags5C & 1` set,
 * packing `dwUnitId`, `wUniqueNameId` (`+0x14`), `bMonUMod[0..2]` (`+0x1C..+0x1E`), and `(bTypeFlags >> 2) & 1` (`+0x16`).
 *
 * @va D2Game:0x6FD13410
 */
export function NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FD13410)
  if ((pMonster >>> 0) === 0) {
    return
  }
  const dwType = m.u32(pMonster >>> 0) | 0
  if (dwType !== 1) {
    return
  }
  const pMonData = m.u32((pMonster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) {
    return
  }
  if ((m.u8((pMonData + 0x5c) >>> 0) & 1) === 0) {
    return
  }
  const pEnchants = (pMonData + 0x1c) >>> 0
  if (pEnchants === 0) {
    return
  }

  const wUniqueNameId = m.u16((pMonData + 0x14) >>> 0)
  const wEnchant2 = m.u8((pEnchants + 2) >>> 0)
  const wEnchants01 = (m.u8(pEnchants) | (m.u8((pEnchants + 1) >>> 0) << 8)) & 0xffff
  const wChampBit = (m.u8((pMonData + 0x16) >>> 0) >>> 2) & 1
  const dwUnitId = m.u32((pMonster + 0x0c) >>> 0) >>> 0

  const pkt = (k2W5B10StackPtr - 0x10) >>> 0
  k2W5B10StackPtr = pkt
  try {
    m.fill(pkt, 0x10, 0)
    m.setU8(pkt, 0x57)
    m.setU32((pkt + 0x01) >>> 0, dwUnitId)
    m.setU8((pkt + 0x05) >>> 0, 1)
    m.setU16((pkt + 0x06) >>> 0, wUniqueNameId)
    m.setU16((pkt + 0x08) >>> 0, wEnchants01)
    m.setU16((pkt + 0x0a) >>> 0, wEnchant2)
    m.setU16((pkt + 0x0c) >>> 0, wChampBit)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pkt, 0x0e)
  } finally {
    k2W5B10StackPtr = (pkt + 0x10) >>> 0
  }
}

/**
 * Sends a monster skill cast packet to `pClient` (`[esp+4]`): if `pTargetUnit` (`[esp+8]`) is in a room
 * whose `ppClients` (`+0x48`, count `+0x78`) contains `pClient`, delegates to `NET_SendUnitTargetedSkillAction113c`
 * (`0x6FCAD210`); otherwise serializes 17-byte ground-targeted packet `0x4D` using `PATH_GetFirstPointX/Y`
 * on `pMonster->pPath` and queues it on channel `1`.
 *
 * @va D2Game:0x6FD134C0
 */
export function NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c(
  m: D2KernMemory113c,
  pMonster: number,
  pClient: number,
  pTargetUnit: number,
): void {
  hitD2GameVa113c(0x6FD134C0)
  const pSkill = SKILLS_GetUsedSkillMemPort113c(m, pMonster >>> 0) >>> 0
  if (pSkill === 0) {
    return
  }

  const nSkillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0x6fd1c380, 0x96) | 0
  const bSkillLevel = SKILLS_EvaluateSkillLevel113c(m, pMonster >>> 0, pSkill, 1) & 0xff
  const dwOwnerId =
    (pMonster >>> 0) === 0 ? 0xffffffff : m.u32((pMonster + 0x0c) >>> 0) >>> 0

  if ((pTargetUnit >>> 0) !== 0) {
    const pTargetRoom = UNITS_GetRoom113c(m, pTargetUnit >>> 0) >>> 0
    if (pTargetRoom !== 0) {
      const nClients = m.u32((pTargetRoom + 0x78) >>> 0) >>> 0
      const ppClients = m.u32((pTargetRoom + 0x48) >>> 0) >>> 0
      for (let i = 0; i < nClients; i = (i + 1) >>> 0) {
        if ((m.u32((ppClients + i * 4) >>> 0) >>> 0) === (pClient >>> 0)) {
          const dwTargetId = m.u32((pTargetUnit + 0x0c) >>> 0) >>> 0
          const bTargetType = m.u32(pTargetUnit >>> 0) & 0xff
          NET_SendUnitTargetedSkillAction113c(
            m,
            pClient >>> 0,
            0,
            1,
            dwOwnerId,
            bTargetType,
            dwTargetId,
            nSkillId & 0xffff,
            0,
            bSkillLevel,
          )
          return
        }
      }
    }
  }

  const pPathY = m.u32((pMonster + 0x2c) >>> 0) >>> 0
  const wTargetY = PATH_GetFirstPointY113c(m, pPathY) & 0xffff
  const pPathX = m.u32((pMonster + 0x2c) >>> 0) >>> 0
  const wTargetX = PATH_GetFirstPointX113c(m, pPathX) & 0xffff
  const dwSkillIdU16 = nSkillId & 0xffff

  const pkt = (k2W5B10StackPtr - 0x18) >>> 0
  k2W5B10StackPtr = pkt
  try {
    m.fill(pkt, 0x18, 0)
    m.setU8(pkt, 0x4d)
    m.setU8((pkt + 0x01) >>> 0, 1)
    m.setU32((pkt + 0x02) >>> 0, dwOwnerId)
    m.setU32((pkt + 0x06) >>> 0, dwSkillIdU16)
    m.setU8((pkt + 0x0a) >>> 0, bSkillLevel)
    m.setU16((pkt + 0x0b) >>> 0, wTargetX)
    m.setU16((pkt + 0x0d) >>> 0, wTargetY)
    m.setU16((pkt + 0x0f) >>> 0, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pkt, 0x11)
  } finally {
    k2W5B10StackPtr = (pkt + 0x18) >>> 0
  }
}

/**
 * Rolls a percentage in `[nMinPct, nMaxPct + 0x100)` (`edi`, `eax`) using `pObject->tSeed` (`ecx + 0x20`),
 * multiplies by `ObjectsTxt.bByte19C` (`+0x19C`) from `DATATBLS_GetObjectsTxtRecord`, and divides unsigned
 * by `100` (`mul 0x51EB851F; shr 5`), asserting if `nMinPct > nMaxPct` (line `20`) or `bByte19C == 0` (line `27`).
 *
 * @va D2Game:0x6FD14260
 */
export function OBJECTS_RollScaledByte19C_6FD14260_113c(
  m: D2KernMemory113c,
  nMaxPct: number,
  nMinPct: number,
  pObject: number,
): number {
  hitD2GameVa113c(0x6FD14260)
  if ((nMinPct >>> 0) > (nMaxPct >>> 0)) {
    throw new D2CommonAssertError('', 0x14)
  }

  const range = (((nMaxPct >>> 0) - (nMinPct >>> 0)) + 0x100) | 0
  const roll = SEED_RollLimitedFast113c(m, (pObject + 0x20) >>> 0, range) | 0
  const pct = (roll + (nMinPct | 0)) | 0

  const nObjectId = (pObject >>> 0) === 0 ? -1 : m.u32((pObject + 0x04) >>> 0) | 0
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0
  const bBaseVal = m.u8((pObjectsTxt + 0x19c) >>> 0)

  const prod32 = imul32(bBaseVal, pct) >>> 0
  const scaled = Number(((BigInt(prod32) * 0x51eb851fn) >> 37n) & 0xffffffffn) >>> 0

  if (bBaseVal === 0) {
    throw new D2CommonAssertError('', 0x1b)
  }
  return scaled | 0
}
