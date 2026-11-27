/**
 * @file src/d2kern-113c/game/town-npc-ai-113c.ts
 * Clean-room 1:1 binary port of D2Game.dll v1.13c Town NPC AI, Warriv/Town NPC
 * greeting & interaction AI, Rogue Town AI, and DS1 MapAI waypoint path-following.
 *
 * Every function operates strictly on `Memory113c` virtual pointers (`pGame`, `pUnit`,
 * `pAiTickParam`, `D2MonsterDataStrc`, `D2AiGeneralStrc`, `D2AiCmdStrc`, `D2MapAIStrc`).
 * Zero JS Maps, zero array sorting, zero permissive nullish fallbacks.
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts';
import { imul32, sdiv32 } from '../common/int-math.ts';
import { INVENTORY_GetCursorItem113c } from '../common/inventory.ts';
import {
  PATH_ClearPathPointsAndFlag0x20_113c,
  PATH_SetNewDirection113c,
  PATH_SetStepNum113c,
} from '../common/path.ts';
import { STATES_CheckState113c } from '../common/statlist.ts';
import {
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_GetRoom113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
} from '../common/unit.ts';
import {
  D2ActiveRoomStrc,
  D2AiCmdStrc,
  D2AiGeneralStrc,
  D2MonsterDataStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts';
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts';
import { hitD2GameVa113c } from '../va-trace-113c.ts';
import {
  AI_CalcApproxUnitDistSubtiles113c,
  AI_StartAttackMode113c,
  MONSTER_InitModeChangeStrc113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c.ts';
import {
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  SEED_RollLimitedRandomNumber113c,
} from './combat-a1c-113c.ts';
import { AI_ApproachTarget113c } from './k2-real-s2c-combat-113c.ts';
import { AIGENERAL_CopyAiCommandParams113c } from './replay-kernel-113c.ts';
import {
  ACT3Q1_GetHratliTargetCoords113c,
  ACT3Q4_CheckOrmusNpcWaitFlag113c,
  ACT3Q4_ClearOrmusNpcWaitFlag113c,
} from './k2-sunit-spawn-w1-113c.ts';
import {
  ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c,
  ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c,
} from './k2-w2b1-113c.ts';
import { ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c } from './k2-w2b7-113c.ts';
import { AI_StartModeAtCoordsKeepSteps_6FD121E0_113c } from './k2-w2b8-113c.ts';
import { ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c } from './k2-w5b4-113c.ts';
import { ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c } from './k2-w5b8-113c.ts';
import { ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c } from './k2-w7b2-113c.ts';
import { ACT2Q4_JerhynPalaceNpcAiOverride_6FCE8990_113c } from './k2-w11b1-113c.ts';
import {
  MONSTATS2_CheckModeBit113c,
  SEED_RollLimitedFast113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts';
import { EVENT_FreeNode113c } from './timer-wheel.ts';
import {
  AI_FindNearestPlayerCallback113c,
  AITARGET_ScanUnitsByModeTable113c,
} from './town-runtime-gap-113c.ts';

/**
 * Offset `+0x38` on `D2AiGeneralStrc` (and `D2MonsterDataStrc` fallback) where
 * `MAPAI_CopyMapAiData113c` (`0x6FD0F8C0`) stores `D2MapAIStrc*` and `0x6FC3BBC0` reads it.
 */
export const D2MONSTERDATA_MAPAI_OFF_113C = 0x38;

/**
 * `D2Game.dll` `.data` global counter at `0x6FD31F90` toggled by `0x6FC36A30` (`AI_TickNodes4_5_7`)
 * (`(dwCounter & 3) == 0 ? 5 : 7` path type override on `pAiParam + 0x18`).
 */
export const D2GAME_MAPAI_NODE4_COUNTER_VA_6FD31F90 = 0x6fd31f90;

/**
 * Disjoint scratch stack region for `town-npc-ai-113c.ts` (`0x7FF67C00..0x7FF68000`, 1 KB).
 */
const TOWN_NPC_AI_STACK_BASE = 0x7ff67c00;
let townNpcAiStackPtr = TOWN_NPC_AI_STACK_BASE;

/**
 * `D2MapAIStrc` header layout (`8` bytes) read by `0x6FC3BBC0`:
 * - `+0x00`: `nPositionCount` (`DWORD PTR [edi]`, count of 12-byte `D2MapAiPositionStrc` entries)
 * - `+0x04`: `pPosition` (`DWORD PTR [edi+0x4]`, pointer to `D2MapAiPositionStrc[]` array)
 */
export const D2MapAiHeaderOffsets = {
  nPositionCount: 0x00,
  nCurrentIndex: 0x00,
  pPosition: 0x04,
} as const;

/**
 * Each 12-byte `D2MapAiPositionStrc` entry in `pPosition` (`lea eax, [eax+eax*2]; lea eax, [ecx+eax*4]`):
 * - `+0x00`: `nAction` (`int32` action id `1..5`; `0` / `6` = null handler in `0x6FD2F850`)
 * - `+0x04`: `nX` (`int32` world subtile X)
 * - `+0x08`: `nY` (`int32` world subtile Y)
 */
export const D2MapAiActionOffsets = {
  nAction: 0x00,
  nX: 0x04,
  nY: 0x08,
  SIZE: 0x0c,
} as const;

/**
 * `D2AiTickParamStrc` offsets passed to AI think functions (`0x6FC3DB40`, `0x6FC39C20`, `0x6FC3BBC0`).
 */
export const D2AiTickParamOffsets = {
  pAiControl: 0x00,
  pTarget: 0x04,
  nTargetDistance: 0x0c,
  nVelocity: 0x10,
  pMonStatsTxt: 0x1c,
  pMonStats2Txt: 0x20,
} as const;

/**
 * Legacy optional hook bag type retained strictly for signature compatibility with
 * external K2 callers (`k2-w6b3-113c.ts`). All Town NPC AI functions execute real
 * `D2Game.dll` / `D2Common.dll` functions directly on `Memory113c`.
 */
export interface TownNpcAiCallees113c {
  aiWalkToCoords?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nDestX: number,
    nDestY: number,
    nVelocityOverride: number,
    bForceWalk: number,
  ) => number;
  aiIdleWait?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nDelayFrames: number,
  ) => number;
  aiStepOrIdle?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nDelayFrames: number,
    nDestX: number,
    nDestY: number,
  ) => number;
  aiTriggerMode?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nMode: number,
  ) => number;
  aiWanderStep?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nRadius: number,
  ) => number;
}

function readMapAiNode4Counter113c(m: Memory113c): number {
  try {
    return m.u32(D2GAME_MAPAI_NODE4_COUNTER_VA_6FD31F90) | 0;
  } catch {
    m.setU32(D2GAME_MAPAI_NODE4_COUNTER_VA_6FD31F90, 0);
    return 0;
  }
}

function stepSeed64At113c(m: Memory113c, pSeed: number): number {
  const lo = BigInt(m.u32(pSeed >>> 0));
  const hi = BigInt(m.u32((pSeed + 4) >>> 0));
  const prod = lo * 0x6ac690c5n + hi;
  const newLo = Number(prod & 0xffffffffn) >>> 0;
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0;
  m.setU32(pSeed >>> 0, newLo);
  m.setU32((pSeed + 4) >>> 0, newHi);
  return newLo;
}

function monsterStartModeFromArgs113c(
  mem: Memory113c,
  pGame: number,
  pModeArgs: number,
): number {
  const mode = mem.u32(pModeArgs >>> 0) | 0;
  const pUnit = mem.u32((pModeArgs + 0x04) >>> 0) >>> 0;
  const pTarget = mem.u32((pModeArgs + 0x08) >>> 0) >>> 0;
  const tx = mem.u32((pModeArgs + 0x0c) >>> 0) | 0;
  const ty = mem.u32((pModeArgs + 0x10) >>> 0) | 0;
  const pathTypeArg = mem.u8((pModeArgs + 0x15) >>> 0);
  return MONSTER_StartMode113c(mem, pGame >>> 0, pUnit, mode, pTarget, tx, ty, pathTypeArg) | 0;
}

function setMonsterAiParamState113c(m: Memory113c, pUnit: number, nState: number): void {
  if (pUnit === 0 || (m.u32(pUnit >>> 0) | 0) !== 1) return;
  const pMonData = m.u32((pUnit + 0x14) >>> 0) >>> 0;
  if (pMonData === 0) return;
  const pAiParam = m.u32((pMonData + 0x2c) >>> 0) >>> 0;
  if (pAiParam === 0) return;
  m.setU32((pAiParam + 0x18) >>> 0, nState >>> 0);
}

/**
 * 1:1 `D2Game.dll@0x6FD12540` (`AI_ApproachTarget`) dispatch on hydrated `Memory113c` via
 * `MONSTER_InitModeChangeStrc113c` (`0x6FC95070`) + `MONSTER_StartMode113c` (`0x6FC95E10`, `dllAbi = true`),
 * ensuring failed `pathType = 5` walks (`nPoints == 0` when already in `MONMODE_NEUTRAL`) do not
 * spuriously set `pUnit->dwFlags |= 1` (while `pathType = 7` sets `dwFlags |= 1` via `0x6FC94DF0`).
 */
function aiApproachTargetTown113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pTarget: number,
  nMode: number,
  targetX: number,
  targetY: number,
  nStepNum: number,
  bFlags: number,
): number {
  let hasHydratedTables = false;
  try {
    hasHydratedTables =
      mem.u32(0x6fde9e1c) !== 0 &&
      mem.u32(0x6fd1829c) !== 0 &&
      mem.u32(0x6fde4180) !== 0 &&
      mem.u32(0x6fdf13a4) !== 0;
  } catch {
    hasHydratedTables = false;
  }
  if (!hasHydratedTables) {
    return AI_ApproachTarget113c(mem, pGame, pUnit, pTarget, nMode, targetX, targetY, nStepNum, bFlags) | 0;
  }
  hitD2GameVa113c(0x6FD12540);
  if (pUnit === 0) return 0;

  let mode = nMode | 0;
  if (mode === 0x0f && (STATES_CheckState113c(mem, pUnit >>> 0, 0x3c) | 0) !== 0) {
    let pAiParam = 0;
    if ((mem.u32(pUnit >>> 0) | 0) === 1) {
      const pMonData = mem.u32((pUnit + 0x14) >>> 0) >>> 0;
      if (pMonData !== 0) {
        pAiParam = mem.u32((pMonData + 0x2c) >>> 0) >>> 0;
      }
    }
    if (pAiParam !== 0) {
      mem.setU32((pAiParam + 0x18) >>> 0, 0);
      mem.setU32((pAiParam + 0x1c) >>> 0, 0);
      mem.setU8((pAiParam + 0x20) >>> 0, 0);
    }
    mode = 2;
  }

  const pPath = mem.u32((pUnit + 0x2c) >>> 0) >>> 0;
  if (pPath !== 0) {
    PATH_SetStepNum113c(mem, pPath, nStepNum | 0);
  }

  const sp = townNpcAiStackPtr;
  townNpcAiStackPtr = (sp + 0x28) >>> 0;
  let ok = 0;
  try {
    MONSTER_InitModeChangeStrc113c(mem, pUnit >>> 0, sp, mode);
    if ((pTarget >>> 0) !== 0) {
      mem.setU32((sp + 0x08) >>> 0, pTarget >>> 0);
    } else {
      mem.setU32((sp + 0x0c) >>> 0, targetX >>> 0);
      mem.setU32((sp + 0x10) >>> 0, targetY >>> 0);
    }
    ok = MONSTER_StartMode113c(mem, pGame >>> 0, sp, 1, 0, 0, 0, 0, 1, true) | 0;
  } finally {
    townNpcAiStackPtr = sp;
  }

  if (ok !== 0) {
    return ok;
  }

  const flagsByte = bFlags & 0xff;
  if ((flagsByte & 4) !== 0) {
    let pEvt = mem.u32((pUnit + 0xdc) >>> 0) >>> 0;
    while (pEvt !== 0) {
      const pNext = mem.u32((pEvt + 0x24) >>> 0) >>> 0;
      if (mem.u8(pEvt) === 2) {
        EVENT_FreeNode113c(mem, pGame >>> 0, pEvt);
      }
      pEvt = pNext;
    }
  }
  if ((flagsByte & 1) !== 0 && (mem.u32(pUnit >>> 0) | 0) === 1) {
    const pMonData = mem.u32((pUnit + 0x14) >>> 0) >>> 0;
    if (pMonData !== 0) {
      const pAiGen = mem.u32((pMonData + 0x28) >>> 0) >>> 0;
      if (pAiGen !== 0) {
        mem.setU8((pAiGen + 0x08) >>> 0, (mem.u8((pAiGen + 0x08) >>> 0) | 0x40) & 0xff);
      }
    }
  }
  if ((flagsByte & 2) !== 0) {
    const roll = (stepSeed64At113c(mem, (pUnit + 0x20) >>> 0) >>> 0) % 100;
    if (roll < 70) {
      AI_IdleWander113c(mem, pGame >>> 0, pUnit >>> 0, 4);
    } else {
      AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 10);
    }
    return 1;
  }
  return 0;
}

function resolveMapAiCoords113c(
  mem: Memory113c,
  pEntryOrDestX: number,
  nDestY?: number | TownNpcAiCallees113c,
): { valid: boolean; nX: number; nY: number } {
  if (typeof nDestY === 'number') {
    const nX = pEntryOrDestX | 0;
    const nY = nDestY | 0;
    return { valid: nX !== 0 && nY !== 0, nX, nY };
  }
  const pEntry = pEntryOrDestX >>> 0;
  if (pEntry === 0) {
    return { valid: false, nX: 0, nY: 0 };
  }
  const nX = mem.u32((pEntry + 0x04) >>> 0) | 0;
  const nY = mem.u32((pEntry + 0x08) >>> 0) | 0;
  return { valid: nX !== 0 && nY !== 0, nX, nY };
}

/**
 * @va D2Game:0x6FC40E00 (72B)
 * Walks the circular `D2AiCmdStrc` command list at `pUnit->pMonsterData->pAiGeneral->pCommandHead (+0x20)`
 * starting at `head->pNext` (`mov eax, [ecx]`) until `pCmd == head`, returning the node with
 * `dwCmdType == nCmdType` (`+0x08`). When `bSetCurrent != 0`, updates `pAiGeneral->pCommandHead = pCmd`.
 */
export function AIGENERAL_FindAiCommandByType113c(
  mem: Memory113c,
  pUnit: number,
  nCmdType: number,
  bSetCurrent = 0,
): number {
  hitD2GameVa113c(0x6FC40E00);
  if (pUnit === 0) return 0;
  if (mem.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) {
    return 0;
  }
  const pMonsterData = mem.get(pUnit, D2UnitStrc.pUnitData);
  if (pMonsterData === 0) return 0;
  const pAiGeneral = mem.get(pMonsterData, D2MonsterDataStrc.pAiGeneral);
  if (pAiGeneral === 0) return 0;

  const head = mem.get(pAiGeneral, D2AiGeneralStrc.pCommandHead);
  if (head === 0) return 0;

  const targetType = nCmdType | 0;
  let pCmd = mem.get(head, D2AiCmdStrc.pNext);
  if (pCmd === 0) {
    pCmd = head;
  }
  let guard = 0;
  while (pCmd !== 0 && guard < 256) {
    if ((mem.get(pCmd, D2AiCmdStrc.dwCmdType) | 0) === targetType) {
      break;
    }
    if (pCmd === head) {
      break;
    }
    const nextCmd = mem.get(pCmd, D2AiCmdStrc.pNext);
    if (nextCmd === 0) {
      break;
    }
    pCmd = nextCmd;
    guard = (guard + 1) | 0;
  }
  if (pCmd === 0 || (mem.get(pCmd, D2AiCmdStrc.dwCmdType) | 0) !== targetType) {
    return 0;
  }
  if ((bSetCurrent | 0) !== 0) {
    mem.set(pAiGeneral, D2AiGeneralStrc.pCommandHead, pCmd);
  }
  return pCmd;
}

/**
 * @va D2Game:0x6FC417D0 (69B)
 * Queries `AIGENERAL_FindAiCommandByType113c(pUnit, nCmdType, bSetCurrent)`; if absent (`0`),
 * allocates and initializes `[nCmdType, 0, 0, 0, 0]` via `0x6FC41290` (`AIGENERAL_CopyAiCommandParams113c`)
 * and re-queries `0x6FC40E00(pUnit, nCmdType, bSetCurrent)`.
 */
export function AIGENERAL_GetOrAllocAiCommandByType113c(
  mem: Memory113c,
  _pGame: number,
  pUnit: number,
  nCmdType: number,
  bSetCurrent = 0,
): number {
  hitD2GameVa113c(0x6FC417D0);
  const existing = AIGENERAL_FindAiCommandByType113c(mem, pUnit, nCmdType, bSetCurrent);
  if (existing === 0) {
    AIGENERAL_CopyAiCommandParams113c(mem, pUnit, nCmdType >>> 0, 0, 0, 0, 0);
  }
  return AIGENERAL_FindAiCommandByType113c(mem, pUnit, nCmdType, bSetCurrent);
}

/**
 * @va D2Game:0x6FCD07B0 (135B)
 * Compute octile distance (`max(|dx|, |dy|) + (min(|dx|, |dy|) >> 1)`) from `pUnit`
 * to world coordinates `(nX, nY)`.
 */
export function UNITS_GetOctileDistanceToCoordinates113c(
  mem: Memory113c,
  pUnit: number,
  nX: number,
  nY: number,
): number {
  hitD2GameVa113c(0x6FCD07B0);
  if (pUnit === 0) return 0;
  const unitX = UNITS_GetX113c(mem, pUnit);
  const unitY = UNITS_GetY113c(mem, pUnit);
  let dx = (unitX - (nX | 0)) | 0;
  if (dx < 0) dx = (-dx) | 0;
  let dy = (unitY - (nY | 0)) | 0;
  if (dy < 0) dy = (-dy) | 0;
  if (dx < dy) {
    const tmp = dx;
    dx = dy;
    dy = tmp;
  }
  return (dx + (dy >> 1)) | 0;
}

/**
 * @va D2Game:0x6FD11D90 (516B)
 * Steps `pUnit` relative to `pTargetUnit` along the `(dx, dy)` vector:
 * - In binary 7-arg form `(mem, pGame, pUnit, pTargetUnit, nMaxStep, nMode, nTargetDist)`:
 *   computes `dist = AI_CalcApproxUnitDistSubtiles(pUnit, pTargetUnit)`, sets `dirSign = dist < nTargetDist ? -1 : 1`,
 *   clamps `stepLen = min(|dist - nTargetDist|, nMaxStep)`, scales `(stepX, stepY)` with the x86
 *   diagonal increment loop (`while (stepX + stepY < stepLen) { stepX++; stepY++; }`), initializes
 *   `D2ModeChangeStrc` via `0x6FC95070`, sets `PATH_SetStepNum(pPath, 1)` (`D2Common.#11005`), and
 *   dispatches `MONSTER_StartMode` (`0x6FC95E10`).
 * - Also supports 6-arg callers `(mem, pGame, pUnit, pTargetUnit, nStepDist, bMoveTowardOrMode)`.
 */
export function AI_StepRelativeToTargetUnit113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pTargetUnit: number,
  nMaxStep: number,
  nModeOrToward: number,
  nTargetDistOrCallees?: number | TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FD11D90);
  if (pUnit === 0 || pTargetUnit === 0) return 0;

  const dist = AI_CalcApproxUnitDistSubtiles113c(mem, pUnit >>> 0, pTargetUnit >>> 0) | 0;
  let dirSign = 1;
  let stepLen = 0;
  let nMode = 2;

  if (typeof nTargetDistOrCallees === 'number') {
    const nTargetDist = nTargetDistOrCallees | 0;
    if (dist < nTargetDist) {
      dirSign = -1;
    }
    let diff = (dist - nTargetDist) | 0;
    if (diff < 0) diff = (-diff) | 0;
    stepLen = diff <= (nMaxStep | 0) ? diff : nMaxStep | 0;
    nMode = nModeOrToward | 0;
  } else {
    const modeOrToward = nModeOrToward | 0;
    if (modeOrToward === 0) {
      dirSign = -1;
      nMode = 2;
    } else {
      dirSign = 1;
      nMode = modeOrToward === 15 ? 15 : 2;
    }
    stepLen = (nMaxStep | 0) > 0 ? nMaxStep | 0 : 0;
  }

  const targetX = UNIT_GetPosX113c(mem, pTargetUnit >>> 0) | 0;
  const targetY = UNIT_GetPosY113c(mem, pTargetUnit >>> 0) | 0;
  const unitX = UNIT_GetPosX113c(mem, pUnit >>> 0) | 0;
  const unitY = UNIT_GetPosY113c(mem, pUnit >>> 0) | 0;

  let absDx = (targetX - unitX) | 0;
  if (absDx < 0) absDx = (-absDx) | 0;
  let absDy = (targetY - unitY) | 0;
  if (absDy < 0) absDy = (-absDy) | 0;

  let denom = (absDx + absDy) | 0;
  if (denom < stepLen) {
    denom = stepLen;
  }
  let stepX = 0;
  let stepY = 0;
  if (denom > 0) {
    stepX = sdiv32(imul32(absDx, stepLen), denom);
    stepY = sdiv32(imul32(absDy, stepLen), denom);
    if (((stepX + stepY) | 0) < stepLen) {
      do {
        stepX = (stepX + 1) | 0;
        stepY = (stepY + 1) | 0;
      } while (((stepX + stepY) | 0) < stepLen);
    }
  }

  let signX = 0;
  if (targetX > unitX) signX = 1;
  else if (targetX < unitX) signX = -1;

  let signY = 0;
  if (targetY > unitY) signY = 1;
  else if (targetY < unitY) signY = -1;

  const destX = (unitX + imul32(imul32(signX, stepX), dirSign)) | 0;
  const destY = (unitY + imul32(imul32(signY, stepY), dirSign)) | 0;

  const sp = townNpcAiStackPtr;
  townNpcAiStackPtr = (sp + 0x20) >>> 0;
  try {
    MONSTER_InitModeChangeStrc113c(mem, pUnit >>> 0, sp, nMode);
    const pPath = mem.u32((pUnit + 0x2c) >>> 0) >>> 0;
    if (pPath !== 0) {
      PATH_SetStepNum113c(mem, pPath, 1);
    }
    mem.setU32((sp + 0x0c) >>> 0, destX >>> 0);
    mem.setU32((sp + 0x10) >>> 0, destY >>> 0);
    return MONSTER_StartMode113c(mem, pGame >>> 0, pUnit >>> 0, nMode, 0, destX, destY) | 0;
  } finally {
    townNpcAiStackPtr = sp;
  }
}

/**
 * @va D2Game:0x6FD130C0 (97B)
 * Scans nearby rooms via `AITARGET_ScanUnitsByModeTable113c` (`nScanIndex = 2`, callback `0x6FD11A90`)
 * to find an eligible player within `15` subtiles. When `bestPlayer != 0 && bestDist < 4` and
 * `pOutClose != 0`, writes `*pOutClose = 1`.
 */
export function AI_FindNearestPlayerTarget113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pOutClose = 0,
): number {
  hitD2GameVa113c(0x6FD130C0);
  if (pUnit === 0) return 0;
  const pRoom = UNITS_GetRoom113c(mem, pUnit);
  if (pRoom === 0) return 0;

  const sp = townNpcAiStackPtr;
  townNpcAiStackPtr = (sp + 0x10) >>> 0;
  try {
    mem.setU32(sp, 0);
    mem.setU32((sp + 0x04) >>> 0, 0x7fffffff);

    const ppRoomsNear = mem.get(pRoom, D2ActiveRoomStrc.ppRoomsNear);
    const nRoomsNear = mem.get(pRoom, D2ActiveRoomStrc.nRoomsNear) | 0;
    if (ppRoomsNear !== 0 && nRoomsNear > 0) {
      AITARGET_ScanUnitsByModeTable113c(mem, 2, sp, pGame >>> 0, pUnit >>> 0, 0x6fd11a90);
    } else {
      let pCandidate = mem.get(pRoom, D2ActiveRoomStrc.pUnitFirst);
      let guard = 0;
      while (pCandidate !== 0 && guard < 512) {
        const res = AI_FindNearestPlayerCallback113c(
          mem,
          pGame >>> 0,
          pUnit >>> 0,
          pCandidate >>> 0,
          sp,
        );
        if (res !== 0) {
          break;
        }
        pCandidate = mem.get(pCandidate, D2UnitStrc.pRoomUnitNext);
        guard = (guard + 1) | 0;
      }
    }

    const bestPlayer = mem.u32(sp) >>> 0;
    if (bestPlayer === 0) {
      return pUnit >>> 0;
    }
    const bestDist = mem.u32((sp + 0x04) >>> 0) | 0;
    if (bestDist < 4 && pOutClose !== 0) {
      mem.setU32(pOutClose >>> 0, 1);
    }
    return bestPlayer;
  } finally {
    townNpcAiStackPtr = sp;
  }
}

/**
 * @va D2Game:0x6FC35D10 (231B)
 * Ensures AI command node `10` (`0x0A`) exists on `pUnit->pMonsterData->pAiGeneral->pCommandHead`.
 * If its stored home coordinates `(dwParam1, dwParam2)` are `(0, 0)`, captures `(UNIT_GetPosX, UNIT_GetPosY)`,
 * stalls `pUnit` for `20` (`0x14`) frames via `AI_Stall113c`, and returns `1`; otherwise returns `0`.
 */
export function AI_InitHomeNode10_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC35D10);
  if (AIGENERAL_FindAiCommandByType113c(mem, pUnit, 0x0a) === 0) {
    AIGENERAL_CopyAiCommandParams113c(mem, pUnit, 0x0a, 0, 0, 0, 0);
  }
  const pCmd10 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 0x0a);
  if (pCmd10 === 0) return 0;

  if (
    mem.get(pCmd10, D2AiCmdStrc.dwParam1) === 0 &&
    mem.get(pCmd10, D2AiCmdStrc.dwParam2) === 0
  ) {
    const homeX = UNIT_GetPosX113c(mem, pUnit >>> 0) >>> 0;
    const homeY = UNIT_GetPosY113c(mem, pUnit >>> 0) >>> 0;
    mem.set(pCmd10, D2AiCmdStrc.dwParam1, homeX);
    mem.set(pCmd10, D2AiCmdStrc.dwParam2, homeY);
    AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x14);
    return 1;
  }
  return 0;
}

/**
 * @va D2Game:0x6FC36610 (179B)
 * Finds home node `10` (`0x0A`, or tail-calls `0x6FC35D10` if absent). If octile distance from `pUnit`
 * to `(homeX, homeY)` exceeds `(nLeashDist >>> 0)`, writes node `4` (`+0x0C = homeX`, `+0x10 = homeY`,
 * `+0x14 = 12`, `+0x18 = 10`), stalls `10` frames via `AI_Stall113c`, and returns `1`; else returns `0`.
 */
export function AI_CheckReturnHomeToNode10_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  _pAiTickParam: number,
  nLeashDist: number,
  _callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC36610);
  const pCmd10 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 0x0a);
  if (pCmd10 === 0) {
    return AI_InitHomeNode10_113c(mem, pGame, pUnit);
  }
  const homeX = mem.get(pCmd10, D2AiCmdStrc.dwParam1) | 0;
  const homeY = mem.get(pCmd10, D2AiCmdStrc.dwParam2) | 0;
  const dist = UNITS_GetOctileDistanceToCoordinates113c(mem, pUnit, homeX, homeY) >>> 0;
  if (dist <= (nLeashDist >>> 0)) {
    return 0;
  }
  const pCmd4 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 4, 0);
  if (pCmd4 !== 0) {
    mem.set(pCmd4, D2AiCmdStrc.dwParam1, homeX >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam2, homeY >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam3, 0x0c);
    mem.set(pCmd4, D2AiCmdStrc.dwParam4, 0x0a);
  }
  AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x0a);
  return 1;
}

/**
 * @va D2Game:0x6FC36970 (183B)
 * MapAI Action `1`: If `pUnit` is at octile distance `> 0` from `(nX, nY)`, sets `pAiParam->dwState = 7`,
 * calls `AI_ApproachTarget` (`0x6FD12540`) toward `(nX, nY)` in `MONMODE_WALK (2)`, populates continuation
 * node `4` (`+0x0C = nX`, `+0x10 = nY`, `+0x14 = 12`, `+0x18 = 10`), and returns `1`; else returns `0`.
 */
export function AI_MapAiAction1_WalkToWaypoint113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pEntryOrDestX: number,
  nDestY?: number | TownNpcAiCallees113c,
  _callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC36970);
  if (pUnit === 0) return 0;
  const coords = resolveMapAiCoords113c(mem, pEntryOrDestX, nDestY);
  if (!coords.valid) return 0;

  const dist = UNITS_GetOctileDistanceToCoordinates113c(mem, pUnit, coords.nX, coords.nY) | 0;
  if (dist <= 0) {
    return 0;
  }
  setMonsterAiParamState113c(mem, pUnit, 7);
  aiApproachTargetTown113c(mem, pGame, pUnit, 0, 2, coords.nX, coords.nY, 0, 0);

  const pCmd4 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 4, 0);
  if (pCmd4 !== 0) {
    mem.set(pCmd4, D2AiCmdStrc.dwParam1, coords.nX >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam2, coords.nY >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam3, 0x0c);
    mem.set(pCmd4, D2AiCmdStrc.dwParam4, 0x0a);
  }
  return 1;
}

/**
 * @va D2Game:0x6FC39BA0 (5B)
 * MapAI Action `3`: 5-byte `jmp 0x6FC36970` (`AI_MapAiAction1_WalkToWaypoint113c`).
 */
export function AI_MapAiAction3_WalkToWaypoint113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pEntryOrDestX: number,
  nDestY?: number | TownNpcAiCallees113c,
  callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC39BA0);
  return AI_MapAiAction1_WalkToWaypoint113c(mem, pGame, pUnit, pEntryOrDestX, nDestY, callees);
}

/**
 * @va D2Game:0x6FC39BB0 (105B)
 * MapAI Action `2`: Calls `0x6FC36970` (`AI_MapAiAction1_WalkToWaypoint113c`), then configures
 * node `4` with `dwParam3 = 20` (`0x14` ticks) and `dwParam4 = 10` (`0x0A` stall delay), returning
 * the result of `0x6FC36970`.
 */
export function AI_MapAiAction2_WalkAndWait20_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pEntryOrDestX: number,
  nDestY?: number | TownNpcAiCallees113c,
  callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC39BB0);
  if (pUnit === 0) return 0;
  const coords = resolveMapAiCoords113c(mem, pEntryOrDestX, nDestY);
  if (!coords.valid) return 0;

  const moved = AI_MapAiAction1_WalkToWaypoint113c(
    mem,
    pGame,
    pUnit,
    coords.nX,
    coords.nY,
    callees,
  );
  const pCmd4 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 4, 0);
  if (pCmd4 !== 0) {
    mem.set(pCmd4, D2AiCmdStrc.dwParam1, coords.nX >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam2, coords.nY >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam3, 0x14);
    mem.set(pCmd4, D2AiCmdStrc.dwParam4, 0x0a);
  }
  return moved;
}

/**
 * @va D2Game:0x6FC39AD0 (195B)
 * MapAI Action `4`: Calls `0x6FC36970`, configures node `7` with `dwParam1 = MONSTATS2_CheckModeBit(hcIdx, 8) ? 8 : 1`
 * (`MONMODE_SKILL1` or `MONMODE_NEUTRAL`), `(dwParam2, dwParam3) = (nX, nY)`, `dwParam4 = 4`, and configures
 * node `4` (`dwParam1 = nX`, `dwParam2 = nY`, `dwParam3 = 12`, `dwParam4 = 10`), returning `0x6FC36970`'s result.
 */
export function AI_MapAiAction4_WalkAndMode8_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pEntryOrDestX: number,
  nDestY?: number | TownNpcAiCallees113c,
  callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC39AD0);
  if (pUnit === 0) return 0;
  const coords = resolveMapAiCoords113c(mem, pEntryOrDestX, nDestY);
  if (!coords.valid) return 0;

  const moved = AI_MapAiAction1_WalkToWaypoint113c(
    mem,
    pGame,
    pUnit,
    coords.nX,
    coords.nY,
    callees,
  );
  const pCmd7 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 7, 0);
  if (pCmd7 !== 0) {
    const classId = mem.get(pUnit, D2UnitStrc.dwClassId) | 0;
    const hasMode8 = MONSTATS2_CheckModeBit113c(mem, classId, 8) !== 0 ? 8 : 1;
    mem.set(pCmd7, D2AiCmdStrc.dwParam1, hasMode8 >>> 0);
    mem.set(pCmd7, D2AiCmdStrc.dwParam2, coords.nX >>> 0);
    mem.set(pCmd7, D2AiCmdStrc.dwParam3, coords.nY >>> 0);
    mem.set(pCmd7, D2AiCmdStrc.dwParam4, 4);
  }
  const pCmd4 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 4, 0);
  if (pCmd4 !== 0) {
    mem.set(pCmd4, D2AiCmdStrc.dwParam1, coords.nX >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam2, coords.nY >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam3, 0x0c);
    mem.set(pCmd4, D2AiCmdStrc.dwParam4, 0x0a);
  }
  return moved;
}

/**
 * @va D2Game:0x6FC39A00 (195B)
 * MapAI Action `5`: Calls `0x6FC36970`, configures node `7` with `dwParam1 = MONSTATS2_CheckModeBit(hcIdx, 9) ? 9 : 1`
 * (`MONMODE_SKILL2` or `MONMODE_NEUTRAL`), `(dwParam2, dwParam3) = (nX, nY)`, `dwParam4 = 4`, and configures
 * node `4` (`dwParam1 = nX`, `dwParam2 = nY`, `dwParam3 = 12`, `dwParam4 = 10`), returning `0x6FC36970`'s result.
 */
export function AI_MapAiAction5_WalkAndMode9_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pEntryOrDestX: number,
  nDestY?: number | TownNpcAiCallees113c,
  callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC39A00);
  if (pUnit === 0) return 0;
  const coords = resolveMapAiCoords113c(mem, pEntryOrDestX, nDestY);
  if (!coords.valid) return 0;

  const moved = AI_MapAiAction1_WalkToWaypoint113c(
    mem,
    pGame,
    pUnit,
    coords.nX,
    coords.nY,
    callees,
  );
  const pCmd7 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 7, 0);
  if (pCmd7 !== 0) {
    const classId = mem.get(pUnit, D2UnitStrc.dwClassId) | 0;
    const hasMode9 = MONSTATS2_CheckModeBit113c(mem, classId, 9) !== 0 ? 9 : 1;
    mem.set(pCmd7, D2AiCmdStrc.dwParam1, hasMode9 >>> 0);
    mem.set(pCmd7, D2AiCmdStrc.dwParam2, coords.nX >>> 0);
    mem.set(pCmd7, D2AiCmdStrc.dwParam3, coords.nY >>> 0);
    mem.set(pCmd7, D2AiCmdStrc.dwParam4, 4);
  }
  const pCmd4 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 4, 0);
  if (pCmd4 !== 0) {
    mem.set(pCmd4, D2AiCmdStrc.dwParam1, coords.nX >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam2, coords.nY >>> 0);
    mem.set(pCmd4, D2AiCmdStrc.dwParam3, 0x0c);
    mem.set(pCmd4, D2AiCmdStrc.dwParam4, 0x0a);
  }
  return moved;
}

/**
 * @va D2Game:0x6FC36A30 (1019B)
 * Steps active Town NPC continuation command nodes in exact binary priority order (`4` -> `5` -> `7`):
 * - Node `4`: walks toward `(dwParam1, dwParam2)` while octile distance `> 3` (toggling `0x6FD31F90` `& 3 == 0 ? 5 : 7`
 *   into `pAiParam + 0x18`), or stalls `dwParam4` frames once within `<= 3` subtiles, decrementing `dwParam3`.
 * - Node `5`: alternates `AI_IdleWander113c` (`dwParam1` odd) and `AI_Stall113c(dwParam4)` (`dwParam1` even / `dwParam3 > 0`).
 * - Node `7`: approaches `(dwParam2, dwParam3)` for up to `dwParam4` retries, sets NPC facing direction via
 *   `D2Common.#10425` (`0x9A -> 0x38`, `0x9B -> 0x34`, `0xB2 -> 0x04`, `0x195 -> 0x34/0x30`), checks `0x1FF` 5% gate,
 *   and triggers `AI_StartAttackMode113c` (`0x6FD12220`) for modes `8..11` (with `0xB2` Cow 66% mode-8 roll).
 */
export function AI_TickNodes4_5_7_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  _callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC36A30);
  if (pUnit === 0) return 0;
  if (mem.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) return 0;

  // 1. Node 4: Walk-to-waypoint / post-arrival stall counter
  const pCmd4 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 4);
  if (pCmd4 !== 0) {
    const count4 = mem.get(pCmd4, D2AiCmdStrc.dwParam3) | 0;
    if (count4 > 0) {
      const destX = mem.get(pCmd4, D2AiCmdStrc.dwParam1) | 0;
      const destY = mem.get(pCmd4, D2AiCmdStrc.dwParam2) | 0;
      if (
        destX !== 0 &&
        destY !== 0 &&
        (UNITS_GetOctileDistanceToCoordinates113c(mem, pUnit, destX, destY) >>> 0) > 3
      ) {
        const counter = readMapAiNode4Counter113c(mem);
        const mod4 = ((counter % 4) + 4) % 4;
        setMonsterAiParamState113c(mem, pUnit, mod4 === 0 ? 5 : 7);
        aiApproachTargetTown113c(mem, pGame, pUnit, 0, 2, destX, destY, 0, 0);
        mem.setU32(D2GAME_MAPAI_NODE4_COUNTER_VA_6FD31F90, ((counter + 1) | 0) >>> 0);
        mem.set(pCmd4, D2AiCmdStrc.dwParam3, ((count4 - 1) | 0) >>> 0);
        return 1;
      }
      const stallDelay = mem.get(pCmd4, D2AiCmdStrc.dwParam4) | 0;
      AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, stallDelay);
      mem.set(pCmd4, D2AiCmdStrc.dwParam3, ((count4 - 1) | 0) >>> 0);
      return 1;
    }
  }

  // 2. Node 5: Alternating wander / stall sequence
  const pCmd5 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 5);
  if (pCmd5 !== 0) {
    const step5 = mem.get(pCmd5, D2AiCmdStrc.dwParam1) | 0;
    if (step5 > 0) {
      if ((step5 & 1) !== 0) {
        AI_IdleWander113c(mem, pGame >>> 0, pUnit >>> 0, mem.get(pCmd5, D2AiCmdStrc.dwParam2) & 0xff);
        mem.set(pCmd5, D2AiCmdStrc.dwParam1, ((step5 - 1) | 0) >>> 0);
        return 1;
      }
      const waitCount = mem.get(pCmd5, D2AiCmdStrc.dwParam3) | 0;
      if (waitCount > 0) {
        const stallDelay = mem.get(pCmd5, D2AiCmdStrc.dwParam4) | 0;
        AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, stallDelay);
        mem.set(pCmd5, D2AiCmdStrc.dwParam3, ((waitCount - 1) | 0) >>> 0);
        mem.set(pCmd5, D2AiCmdStrc.dwParam1, ((step5 - 1) | 0) >>> 0);
        return 1;
      }
      mem.set(pCmd5, D2AiCmdStrc.dwParam1, ((step5 - 1) | 0) >>> 0);
    } else {
      const waitCount = mem.get(pCmd5, D2AiCmdStrc.dwParam3) | 0;
      if (waitCount > 0) {
        const stallDelay = mem.get(pCmd5, D2AiCmdStrc.dwParam4) | 0;
        AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, stallDelay);
        mem.set(pCmd5, D2AiCmdStrc.dwParam3, ((waitCount - 1) | 0) >>> 0);
        return 1;
      }
    }
  }

  // 3. Node 7: Waypoint skill/animation trigger (modes 8..11)
  const pCmd7 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 7);
  if (pCmd7 === 0) return 0;
  let mode7 = mem.get(pCmd7, D2AiCmdStrc.dwParam1) | 0;
  if (mode7 === 0) return 0;

  if (mode7 !== 8 && mode7 !== 9 && mode7 !== 10 && mode7 !== 11) {
    mem.set(pCmd7, D2AiCmdStrc.dwParam1, 0);
    AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x32);
    return 1;
  }

  const targetX7 = mem.get(pCmd7, D2AiCmdStrc.dwParam2) | 0;
  const targetY7 = mem.get(pCmd7, D2AiCmdStrc.dwParam3) | 0;
  const dist7 = UNITS_GetOctileDistanceToCoordinates113c(mem, pUnit, targetX7, targetY7) | 0;
  if (dist7 > 0) {
    const retries = mem.get(pCmd7, D2AiCmdStrc.dwParam4) | 0;
    if (retries > 0) {
      setMonsterAiParamState113c(mem, pUnit, 7);
      const approached = aiApproachTargetTown113c(mem, pGame, pUnit, 0, 2, targetX7, targetY7, 0, 0);
      if (approached === 0) {
        AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x19);
      }
      mem.set(pCmd7, D2AiCmdStrc.dwParam4, ((retries - 1) | 0) >>> 0);
      return 1;
    }
    if (dist7 > 1) {
      mem.set(pCmd7, D2AiCmdStrc.dwParam1, 0);
    }
  }

  const classId = mem.get(pUnit, D2UnitStrc.dwClassId) | 0;
  const pPath = mem.get(pUnit, D2UnitStrc.pPath);
  if (classId === 0x9a && pPath !== 0) {
    PATH_SetNewDirection113c(mem, pPath, 0x38);
  }
  if (classId === 0x9b && pPath !== 0) {
    PATH_SetNewDirection113c(mem, pPath, 0x34);
  }
  if (classId === 0xb2 && pPath !== 0) {
    PATH_SetNewDirection113c(mem, pPath, 0x04);
  }
  if (classId === 0x195 && pPath !== 0) {
    const curMode7 = mem.get(pCmd7, D2AiCmdStrc.dwParam1) | 0;
    if (curMode7 === 8) {
      PATH_SetNewDirection113c(mem, pPath, 0x34);
    }
    if (curMode7 === 9) {
      PATH_SetNewDirection113c(mem, pPath, 0x30);
    }
  }

  if (classId === 0x1ff) {
    const roll = SEED_RollLimitedRandomNumber113c(mem, (pUnit + 0x20) >>> 0, 100) | 0;
    if (roll > 4) {
      mem.set(pCmd7, D2AiCmdStrc.dwParam1, 0);
      AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x32);
      return 1;
    }
  }

  mode7 = mem.get(pCmd7, D2AiCmdStrc.dwParam1) | 0;
  if (mode7 !== 0) {
    if ((mem.get(pUnit, D2UnitStrc.dwAnimMode) | 0) === mode7) {
      AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x32);
      return 1;
    }
    AI_StartAttackMode113c(mem, mode7, pUnit >>> 0, pGame >>> 0, pUnit >>> 0, undefined, {
      onMonsterStartMode: (m, g, sp) => monsterStartModeFromArgs113c(m, g, sp),
    });
    mem.set(pCmd7, D2AiCmdStrc.dwParam1, 0);
    return 1;
  }

  if (classId === 0xb2) {
    const cowRoll = SEED_RollLimitedRandomNumber113c(mem, (pUnit + 0x20) >>> 0, 100) | 0;
    if (cowRoll < 0x42) {
      mem.set(pCmd7, D2AiCmdStrc.dwParam1, 8);
    }
  }
  return 0;
}

/**
 * @va D2Game:0x6FC3BBC0 (149B)
 * Pure `SparseMemory113c` port of `AI_FollowDs1NpcPath`:
 * 1. Resolves `pMapAi` from `[pAiTickParam]->pMapAi (+0x38)` (or `pMonsterData + 0x38` when `pAiTickParam == 0`).
 * 2. Steps `pUnit->tSeed (+0x20)` LCG (`mod 100 < 0x42` = 66% chance to pick a waypoint; else returns `0`).
 * 3. Rolls `idx = SEED_RollLimitedFast(&pUnit->tSeed, nPositionCount)` (`0x6FC211D0`) into the 12-byte
 *    `D2MapAiPositionStrc` array (`+0x00 = nAction`, `+0x04 = nX`, `+0x08 = nY`).
 * 4. Dispatches `0x6FD2F850[nAction]` (`1 -> 0x6FC36970`, `2 -> 0x6FC39BB0`, `3 -> 0x6FC39BA0`,
 *    `4 -> 0x6FC39AD0`, `5 -> 0x6FC39A00`, `0/6 -> 0`).
 */
export function AI_FollowDs1NpcPathMem113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
  callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC3BBC0);
  if (pUnit === 0) return 0;

  let pAiGeneral = 0;
  if (pAiTickParam !== 0) {
    pAiGeneral = mem.u32(pAiTickParam >>> 0) >>> 0;
  } else if (mem.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    const pMonsterData = mem.get(pUnit, D2UnitStrc.pUnitData);
    if (pMonsterData !== 0) {
      pAiGeneral = mem.get(pMonsterData, D2MonsterDataStrc.pAiGeneral);
    }
  }

  let pMapAi =
    pAiGeneral !== 0
      ? mem.u32((pAiGeneral + D2MONSTERDATA_MAPAI_OFF_113C) >>> 0) >>> 0
      : 0;
  if (pMapAi === 0 && mem.get(pUnit, D2UnitStrc.dwUnitType) === UNIT_MONSTER) {
    const pMonsterData = mem.get(pUnit, D2UnitStrc.pUnitData);
    if (pMonsterData !== 0) {
      pMapAi = mem.u32((pMonsterData + D2MONSTERDATA_MAPAI_OFF_113C) >>> 0) >>> 0;
    }
  }
  if (pMapAi === 0) return 0;

  const chanceRoll = (stepSeed64At113c(mem, (pUnit + 0x20) >>> 0) >>> 0) % 100;
  if (chanceRoll >= 0x42) {
    return 0;
  }

  const nCount = mem.u32((pMapAi + D2MapAiHeaderOffsets.nPositionCount) >>> 0) >>> 0;
  if (nCount === 0) {
    return 0;
  }
  const pPosition = mem.u32((pMapAi + D2MapAiHeaderOffsets.pPosition) >>> 0) >>> 0;
  if (pPosition === 0) {
    return 0;
  }

  const idx = SEED_RollLimitedFast113c(mem, (pUnit + 0x20) >>> 0, nCount | 0) >>> 0;
  const pEntry = (pPosition + imul32(idx | 0, D2MapAiActionOffsets.SIZE)) >>> 0;
  const nAction = mem.u32((pEntry + D2MapAiActionOffsets.nAction) >>> 0) | 0;
  if (nAction < 0 || nAction >= 7) {
    return 0;
  }

  switch (nAction) {
    case 1:
      return AI_MapAiAction1_WalkToWaypoint113c(mem, pGame, pUnit, pEntry, callees);
    case 2:
      return AI_MapAiAction2_WalkAndWait20_113c(mem, pGame, pUnit, pEntry, callees);
    case 3:
      return AI_MapAiAction3_WalkToWaypoint113c(mem, pGame, pUnit, pEntry, callees);
    case 4:
      return AI_MapAiAction4_WalkAndMode8_113c(mem, pGame, pUnit, pEntry, callees);
    case 5:
      return AI_MapAiAction5_WalkAndMode9_113c(mem, pGame, pUnit, pEntry, callees);
    default:
      return 0;
  }
}

/**
 * @va D2Game:0x6FC3BC60 (60B)
 * Simple DS1 path-following NPC AI:
 * `0x6FC35D10` -> `0x6FC36A30` -> `0x6FC3BBC0` -> `AI_Stall(12)`.
 */
export function AI_SimpleMapAiNpc113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
  callees?: TownNpcAiCallees113c,
): void {
  hitD2GameVa113c(0x6FC3BC60);
  if ((AI_InitHomeNode10_113c(mem, pGame, pUnit) & 0xff) !== 0) {
    return;
  }
  if ((AI_TickNodes4_5_7_113c(mem, pGame, pUnit, callees) & 0xff) !== 0) {
    return;
  }
  if ((AI_FollowDs1NpcPathMem113c(mem, pGame, pUnit, pAiTickParam, callees) & 0xff) !== 0) {
    return;
  }
  AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x0c);
}

/**
 * @va D2Game:0x6FC39C20 (591B)
 * Town NPC player-interaction, leash, and greeting helper (`AI_WarrivGreet` / `QUESTS_NpcGreetingAi`):
 * - Scans for nearest player via `0x6FD130C0` and measures subtile distance via `0x6FCD0A20`.
 * - Requires active `pMonsterData->pNpcInteract (+0x30)` (`D2NpcInteractStrc`); otherwise returns `0`.
 * - Checks active NPC dialogue list (`[pInteract]`), player busy/cursor/trade state, or `pAiGeneral->dwTimer (+0x14) > 0`
 *   to hold or walk to `(pAiGeneral + 0x18, +0x1C)`.
 * - When idle with an eligible player within `(2, 24)` subtiles, checks home leash `16` (`0x6FC36610`), sets
 *   `pAiParam->dwState = 7`, and steps toward player (`step = dist < 5 ? dist - 2 : 3`, `nTargetDist = 2`) via `0x6FD11D90`.
 * - When `dist <= 2 || dist >= 24`, stops path (`D2Common.#10159`), triggers unit event sound `0x12` (`0x6FCFFFD0`)
 *   with `60`-tick (`0x3C`) cooldown at `pAiGeneral + 0x18`, and stalls `20` (`0x14`) frames.
 */
export function AI_WarrivGreetMem113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
  _callees?: TownNpcAiCallees113c,
): number {
  hitD2GameVa113c(0x6FC39C20);
  const sp = townNpcAiStackPtr;
  townNpcAiStackPtr = (sp + 0x10) >>> 0;
  try {
    mem.setU32(sp, 0);
    const pTarget = AI_FindNearestPlayerTarget113c(mem, pGame, pUnit, sp) >>> 0;
    const dist =
      pUnit !== 0 && pTarget !== 0
        ? AI_CalcApproxUnitDistSubtiles113c(mem, pUnit >>> 0, pTarget) | 0
        : 0;

    if (pUnit === 0 || mem.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) {
      return 0;
    }
    const pMonsterData = mem.get(pUnit, D2UnitStrc.pUnitData);
    if (pMonsterData === 0) {
      return 0;
    }
    const pInteract = mem.u32((pMonsterData + 0x30) >>> 0) >>> 0;
    if (pInteract === 0) {
      return 0;
    }

    let playerBusy = 0;
    let pNode = mem.u32(pInteract) >>> 0;
    let guard = 0;
    while (pNode !== 0 && guard < 128) {
      if (mem.u32(pNode) >>> 0 === pTarget && pTarget !== 0) {
        playerBusy = 1;
        break;
      }
      pNode = mem.u32((pNode + 0x08) >>> 0) >>> 0;
      guard = (guard + 1) | 0;
    }

    if (
      playerBusy === 0 &&
      pTarget !== 0 &&
      mem.get(pTarget, D2UnitStrc.dwUnitType) === UNIT_PLAYER
    ) {
      if (mem.u8((pTarget + 0x6c) >>> 0) !== 0) {
        playerBusy = 1;
      } else {
        const pInv = mem.u32((pTarget + 0x60) >>> 0) >>> 0;
        if (pInv !== 0 && INVENTORY_GetCursorItem113c(mem, pInv) !== 0) {
          playerBusy = 1;
        } else {
          const pPlayerData = UNITS_GetPlayerData113c(mem, pTarget) >>> 0;
          if (pPlayerData !== 0 && (mem.u32((pPlayerData + 0x4c) >>> 0) | 0) === 1) {
            playerBusy = 1;
          }
        }
      }
    }

    let hasInteractingPlayers = 0;
    pNode = mem.u32(pInteract) >>> 0;
    guard = 0;
    while (pNode !== 0 && guard < 128) {
      if (mem.u32(pNode) !== 0) {
        hasInteractingPlayers = 1;
        break;
      }
      pNode = mem.u32((pNode + 0x08) >>> 0) >>> 0;
      guard = (guard + 1) | 0;
    }

    const pAiGeneral =
      pAiTickParam !== 0
        ? mem.u32(pAiTickParam >>> 0) >>> 0
        : mem.get(pMonsterData, D2MonsterDataStrc.pAiGeneral);
    if (pAiGeneral === 0) {
      return 0;
    }

    const holdTimer = mem.u32((pAiGeneral + 0x14) >>> 0) | 0;
    if (hasInteractingPlayers !== 0 || playerBusy !== 0 || holdTimer > 0) {
      const holdX = mem.u32((pAiGeneral + 0x18) >>> 0) | 0;
      const holdY = mem.u32((pAiGeneral + 0x1c) >>> 0) | 0;
      const holdDist = UNITS_GetOctileDistanceToCoordinates113c(mem, pUnit, holdX, holdY) >>> 0;
      if (holdDist > 2 && holdTimer > 0x24) {
        aiApproachTargetTown113c(mem, pGame, pUnit, 0, 2, holdX, holdY, 1, 0);
      } else if (holdTimer > 0) {
        const pPath = mem.get(pUnit, D2UnitStrc.pPath);
        if (pPath !== 0) {
          PATH_ClearPathPointsAndFlag0x20_113c(mem, pPath);
        }
        AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 8);
      }
      const curTimer = mem.u32((pAiGeneral + 0x14) >>> 0) | 0;
      if (curTimer < 0) {
        mem.setU32((pAiGeneral + 0x14) >>> 0, 0);
        return 1;
      }
      mem.setU32((pAiGeneral + 0x14) >>> 0, ((curTimer - 1) | 0) >>> 0);
      return 1;
    }

    if (pTarget === 0 || pTarget === (pUnit >>> 0)) {
      return 0;
    }

    if (dist > 2 && dist < 0x18) {
      if (AI_CheckReturnHomeToNode10_113c(mem, pGame, pUnit, pAiTickParam, 0x10) !== 0) {
        return 1;
      }
      setMonsterAiParamState113c(mem, pUnit, 7);
      const maxStep = dist < 5 ? (dist - 2) | 0 : 3;
      AI_StepRelativeToTargetUnit113c(mem, pGame, pUnit, pTarget, maxStep, 2, 2);
      return 1;
    }

    const pPath = mem.get(pUnit, D2UnitStrc.pPath);
    if (pPath !== 0) {
      PATH_ClearPathPointsAndFlag0x20_113c(mem, pPath);
    }
    const soundCooldown = mem.u32((pAiGeneral + 0x18) >>> 0) | 0;
    if (soundCooldown === 0) {
      mem.setU32((pAiGeneral + 0x18) >>> 0, 0x3c);
      if (mem.get(pTarget, D2UnitStrc.dwUnitType) === UNIT_PLAYER) {
        SUNIT_SetUnitEventSound113c(mem, pUnit >>> 0, 0x12, pTarget);
        AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x14);
        return 1;
      }
    } else {
      if (soundCooldown < 0) {
        mem.setU32((pAiGeneral + 0x18) >>> 0, 0);
      }
      const curCd = mem.u32((pAiGeneral + 0x18) >>> 0) | 0;
      if (curCd > 0) {
        mem.setU32((pAiGeneral + 0x18) >>> 0, ((curCd - 1) | 0) >>> 0);
      }
    }
    AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x14);
    return 1;
  } finally {
    townNpcAiStackPtr = sp;
  }
}

/**
 * @va D2Game:0x6FC3DB40 (511B)
 * Pure `SparseMemory113c` port of `AI_TownNpc`:
 * 1. Initializes home node `10` (`0x6FC35D10`; returns immediately on initial 20-frame stall).
 * 2. Executes quest-specific Town NPC overrides by `hcIdx`:
 *    - `0xC9` (Jerhyn): Act 2 Quest 4 palace cellar / Horazon's Journal sequence (`0x6FCE3260`, `0x6FCE8990`, `0x6FCE1F90`)
 *    - `0xFE` (Ormus): Act 3 Quest 4 wait flag & `MONMODE_SKILL1 (8)` (`0x6FD02B40`, `0x6FD121E0`, `0x6FD02B10`)
 *    - `0xFF` (Hratli): Act 3 Quest 1/2 Gidbinn altar walk & `MONMODE_SKILL1 (8)` (`0x6FD02C40`, `0x6FD121E0`, `0x6FD05F60`)
 *    - `0x109` (Deckard Cain): Act 1 Quest 4 Cairn Stones portal walk (`0x6FC804C0`, `0x6FC803D0`)
 *    - `0x200` (Anya): Act 5 Quest 2 Nihlathak portal check (`0x6FC7D1D0`)
 * 3. Runs `0x6FC39C20` (`AI_WarrivGreetMem113c`) -> `0x6FC36A30` (`AI_TickNodes4_5_7_113c`) ->
 *    `0x6FC3BBC0` (`AI_FollowDs1NpcPathMem113c`) -> `AI_Stall113c(8)`.
 */
export function AI_TownNpcMem113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
  callees?: TownNpcAiCallees113c,
): void {
  hitD2GameVa113c(0x6FC3DB40);
  if ((AI_InitHomeNode10_113c(mem, pGame, pUnit) & 0xff) !== 0) {
    return;
  }

  const classId = pUnit !== 0 ? mem.get(pUnit, D2UnitStrc.dwClassId) | 0 : -1;
  const sp = townNpcAiStackPtr;
  townNpcAiStackPtr = (sp + 0x18) >>> 0;
  try {
    if (classId === 0xfe) {
      if (ACT3Q4_CheckOrmusNpcWaitFlag113c(mem, pGame >>> 0) !== 0) {
        AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(mem, pUnit >>> 0, 8, pGame >>> 0, 0, 0, {
          onMonsterStartMode: (m, g, args) => monsterStartModeFromArgs113c(m, g, args),
        });
        ACT3Q4_ClearOrmusNpcWaitFlag113c(mem, pGame >>> 0);
        return;
      }
    } else if (classId === 0xc9) {
      if ((ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c(mem, pGame >>> 0) & 0xff) !== 1) {
        AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x28);
        return;
      }
      mem.setU32(sp, 0);
      mem.setU32((sp + 0x04) >>> 0, 0);
      ACT2Q4_JerhynPalaceNpcAiOverride_6FCE8990_113c(
        mem as SparseMemory113c,
        pGame >>> 0,
        pUnit >>> 0,
        sp,
        (sp + 0x04) >>> 0,
      );
      if (mem.u32((sp + 0x04) >>> 0) !== 0) {
        AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x14);
      }
      if (mem.u32(sp) === 0) {
        return;
      }
      if (ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(mem, pGame >>> 0) !== 0) {
        const pCmd10 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 0x0a, 0);
        if (pCmd10 !== 0) {
          const newHomeX = ((UNIT_GetPosX113c(mem, pUnit >>> 0) | 0) + 9) >>> 0;
          const newHomeY = UNIT_GetPosY113c(mem, pUnit >>> 0) >>> 0;
          mem.set(pCmd10, D2AiCmdStrc.dwParam1, newHomeX);
          mem.set(pCmd10, D2AiCmdStrc.dwParam2, newHomeY);
          AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0x32);
          return;
        }
      }
    } else if (classId === 0xff) {
      mem.setU32(sp, 0);
      mem.setU32((sp + 0x04) >>> 0, 0);
      if (ACT3Q1_GetHratliTargetCoords113c(mem, pGame >>> 0, sp) !== 0) {
        const tx = mem.u32(sp) | 0;
        const ty = mem.u32((sp + 0x04) >>> 0) | 0;
        const dist = UNITS_GetOctileDistanceToCoordinates113c(mem, pUnit, tx, ty) >>> 0;
        if (dist > 3) {
          aiApproachTargetTown113c(mem, pGame, pUnit, 0, 2, tx, ty, 1, 0);
          return;
        }
        AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(mem, pUnit >>> 0, 8, pGame >>> 0, 0, 0, {
          onMonsterStartMode: (m, g, args) => monsterStartModeFromArgs113c(m, g, args),
        });
        ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c(mem, pGame >>> 0);
        return;
      }
    } else if (classId === 0x109) {
      mem.setU32(sp, 0);
      mem.setU32((sp + 0x04) >>> 0, 0);
      if (ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c(mem, pGame >>> 0, sp) !== 0) {
        const tx = mem.u32(sp) | 0;
        const ty = mem.u32((sp + 0x04) >>> 0) | 0;
        const dist = UNITS_GetOctileDistanceToCoordinates113c(mem, pUnit, tx, ty) >>> 0;
        if (dist > 2) {
          aiApproachTargetTown113c(mem, pGame, pUnit, 0, 2, tx, ty, 1, 0);
          return;
        }
        ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c(mem, pGame >>> 0);
      }
    } else if (classId === 0x200) {
      ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c(mem, pUnit >>> 0, pGame >>> 0);
    }

    if ((AI_WarrivGreetMem113c(mem, pGame, pUnit, pAiTickParam, callees) & 0xff) !== 0) {
      return;
    }
    if ((AI_TickNodes4_5_7_113c(mem, pGame, pUnit, callees) & 0xff) !== 0) {
      return;
    }
    if ((AI_FollowDs1NpcPathMem113c(mem, pGame, pUnit, pAiTickParam, callees) & 0xff) !== 0) {
      return;
    }
    AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 8);
  } finally {
    townNpcAiStackPtr = sp;
  }
}

/**
 * @va D2Game:0x6FCBCB00 (33B)
 * Pure `SparseMemory113c` port of `AI_RogueTown` (stationary town/ambient AI fallback):
 * checks `D2Common.#10331` (`UNITS_GetRoom(pUnit) != NULL`), and if active, stalls `pUnit`
 * for `200` (`0xC8`) frames via `AI_Stall113c`.
 */
export function AI_RogueTownMem113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  _pAiTickParam = 0,
): void {
  hitD2GameVa113c(0x6FCBCB00);
  if (pUnit === 0) return;
  if (UNITS_GetRoom113c(mem, pUnit) !== 0) {
    AI_Stall113c(mem, pGame >>> 0, pUnit >>> 0, 0xc8);
  }
}
