/**
 * @file src/d2kern-113c/game/town-npc-ai-113c.ts
 * Clean-room 1:1 binary port of D2Game.dll v1.13c Town NPC AI, Warriv Act 1 intro
 * greeting AI, and DS1 MapAI waypoint path-following routines.
 *
 * All functions operate strictly on `Memory113c` virtual pointers (`pGame`, `pUnit`,
 * `pAiTickParam`, `pMonsterData`, `pAiControl`, `D2AiCmdStrc`, `D2MapAIStrc`).
 * Zero JS Maps, zero array sorting, zero permissive `??` fallbacks.
 */

import { imul32, sdiv32 } from '../common/int-math.ts';
import {
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_GetDistanceToOtherUnit113c,
  UNITS_GetRoom113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
} from '../common/unit.ts';
import { UNITFINDS_FindNearestUnitInRange113c } from '../common/unit-finds.ts';
import {
  D2ActiveRoomStrc,
  D2AiCmdStrc,
  D2AiGeneralStrc,
  D2DrlgLevelStrc,
  D2DynamicPathStrc,
  D2GameStrc,
  D2MonsterDataStrc,
  D2RoomExStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts';
import type { Memory113c } from '../mem/sparse-memory.ts';
import { type D2SeedStrc, seedRoll } from '../prng.ts';
import { AIGENERAL_AllocAiCommand113c } from './replay-kernel-113c.ts';
import {
  MON_EVENT_AI_THINK,
  MONSTER_RegisterContinuousModeEvent113c,
  SUNIT_IsDeadOrDying113c,
} from './monster-events.ts';
import { EVENT_DeleteEventByArg14_113c, EVENT_SetEventFull113c } from './timer-wheel.ts';

/**
 * Offset `+0x38` on `D2MonsterDataStrc` where `ROOM_SpawnPresetUnit113c` (`0x6FD013B0` /
 * `MAPAI_CopyMapAiData113c` `0x6FD0F8C0`) stores `D2MapAIStrc*` and `0x6FC3BBC0` reads it.
 */
export const D2MONSTERDATA_MAPAI_OFF_113C = 0x38;

/**
 * `D2MapAIStrc` header layout at `pMonsterData + 0x38`:
 * - `+0x00`: `nCurrentIndex` (int32, index into `pPosition` array)
 * - `+0x04`: `pPosition` (uint32 pointer to `D2MapAiActionStrc[]` array)
 */
export const D2MapAiHeaderOffsets = {
  nCurrentIndex: 0x00,
  pPosition: 0x04,
} as const;

/**
 * Each 16-byte `D2MapAiActionStrc` entry in `pPosition`:
 * - `+0x00`: `nX` (int32 world subtile X)
 * - `+0x04`: `nY` (int32 world subtile Y)
 * - `+0x08`: `nAction` (int32 action id `1..5`; `0` marks end-of-path sentinel)
 * - `+0x0C`: `nWait` (int32 optional wait parameter)
 */
export const D2MapAiActionOffsets = {
  nX: 0x00,
  nY: 0x04,
  nAction: 0x08,
  nWait: 0x0c,
  SIZE: 0x10,
} as const;

/**
 * `D2AiTickParamStrc` offsets passed to AI think functions (`0x6FC3DB40`, `0x6FC39C20`, etc.).
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
 * Injectable low-level movement / mode hooks for Town NPC AI (`D2Game.dll` sub-callees).
 * Default implementations perform deterministic in-memory path target updates and
 * timer-wheel `MON_EVENT_AI_THINK` scheduling on `Memory113c`.
 */
export interface TownNpcAiCallees113c {
  /** `D2Game:0x6FC352A0` — Walk monster toward `(nDestX, nDestY)`. Returns 1 if movement started. */
  aiWalkToCoords?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nDestX: number,
    nDestY: number,
    nVelocityOverride: number,
    bForceWalk: number,
  ) => number;
  /** `D2Game:0x6FC3B0E0` — Idle wait for `nDelayFrames` frames and schedule next `MON_EVENT_AI_THINK`. */
  aiIdleWait?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nDelayFrames: number,
  ) => number;
  /** `D2Game:0x6FC34CC0` — Fallback step or idle delay when direct pathing is blocked. */
  aiStepOrIdle?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nDelayFrames: number,
    nDestX: number,
    nDestY: number,
  ) => number;
  /** `D2Game:0x6FC34BA0` — Trigger a monster animation mode (e.g. `8` = `SKILL1`, `9` = `SKILL2`). */
  aiTriggerMode?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nMode: number,
  ) => number;
  /** `D2Game:0x6FC349B0` — Random local wander step within radius. */
  aiWanderStep?: (
    mem: Memory113c,
    pGame: number,
    pUnit: number,
    nRadius: number,
  ) => number;
}

function scheduleNextAiThinkIfTimerReady113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  delayFrames: number,
): void {
  if (pGame === 0) return;
  const pTimer = mem.get(pGame, D2GameStrc.pTimer);
  if (pTimer === 0) return;
  const dwGameFrame = mem.get(pGame, D2GameStrc.dwGameFrame);
  EVENT_DeleteEventByArg14_113c(mem, pGame, pUnit, MON_EVENT_AI_THINK);
  EVENT_SetEventFull113c(
    mem,
    pGame,
    pUnit,
    MON_EVENT_AI_THINK,
    (dwGameFrame + delayFrames) >>> 0,
    0,
    0,
    0,
  );
}

function defaultAiIdleWait113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nDelayFrames: number,
): number {
  const delay = nDelayFrames > 0 ? nDelayFrames | 0 : 15;
  mem.set(pUnit, D2UnitStrc.dwAnimMode, 1); // MONMODE_NEUTRAL
  scheduleNextAiThinkIfTimerReady113c(mem, pGame, pUnit, delay);
  return 1;
}

function defaultAiWalkToCoords113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nDestX: number,
  nDestY: number,
): number {
  const pPath = mem.get(pUnit, D2UnitStrc.pPath);
  const curX = UNITS_GetX113c(mem, pUnit);
  const curY = UNITS_GetY113c(mem, pUnit);
  if (curX === (nDestX | 0) && curY === (nDestY | 0)) {
    return 0;
  }
  if (pPath !== 0) {
    mem.set(pPath, D2DynamicPathStrc.wTargetX, (nDestX | 0) & 0xffff);
    mem.set(pPath, D2DynamicPathStrc.wTargetY, (nDestY | 0) & 0xffff);
    mem.set(pPath, D2DynamicPathStrc.pTargetUnit, 0);
    const dx = (nDestX | 0) - curX;
    const dy = (nDestY | 0) - curY;
    const stepX = dx > 2 ? 2 : dx < -2 ? -2 : dx;
    const stepY = dy > 2 ? 2 : dy < -2 ? -2 : dy;
    mem.set(pPath, D2DynamicPathStrc.wPosX, (curX + stepX) & 0xffff);
    mem.set(pPath, D2DynamicPathStrc.wPosY, (curY + stepY) & 0xffff);
  }
  mem.set(pUnit, D2UnitStrc.dwAnimMode, 2); // MONMODE_WALK
  if (pGame !== 0 && mem.get(pGame, D2GameStrc.pTimer) !== 0) {
    MONSTER_RegisterContinuousModeEvent113c(mem, pGame, pUnit);
    scheduleNextAiThinkIfTimerReady113c(mem, pGame, pUnit, 12);
  }
  return 1;
}

function defaultAiTriggerMode113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nMode: number,
): number {
  mem.set(pUnit, D2UnitStrc.dwAnimMode, nMode >>> 0);
  scheduleNextAiThinkIfTimerReady113c(mem, pGame, pUnit, 15);
  return 1;
}

function defaultAiWanderStep113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nRadius: number,
): number {
  const seed: D2SeedStrc = {
    lo: mem.get(pUnit, D2UnitStrc.seedLo),
    hi: mem.get(pUnit, D2UnitStrc.seedHi),
  };
  const span = ((nRadius | 0) * 2 + 1) | 0;
  const dx = (seedRoll(seed, span > 0 ? span : 1) - (nRadius | 0)) | 0;
  const dy = (seedRoll(seed, span > 0 ? span : 1) - (nRadius | 0)) | 0;
  mem.set(pUnit, D2UnitStrc.seedLo, seed.lo >>> 0);
  mem.set(pUnit, D2UnitStrc.seedHi, seed.hi >>> 0);
  const curX = UNITS_GetX113c(mem, pUnit);
  const curY = UNITS_GetY113c(mem, pUnit);
  return defaultAiWalkToCoords113c(mem, pGame, pUnit, (curX + dx) | 0, (curY + dy) | 0);
}

/**
 * @va D2Game:0x6FC40E00
 * Find an AI command node in `pUnit->pMonsterData->pAiGeneral->pCommandHead` whose
 * `dwCmdType == nCmdType`.
 */
export function AIGENERAL_FindAiCommandByType113c(
  mem: Memory113c,
  pUnit: number,
  nCmdType: number,
): number {
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

  let pCmd = head;
  const targetType = nCmdType | 0;
  let guard = 0;
  while (pCmd !== 0 && guard < 256) {
    if ((mem.get(pCmd, D2AiCmdStrc.dwCmdType) | 0) === targetType) {
      return pCmd;
    }
    const nextCmd = mem.get(pCmd, D2AiCmdStrc.pNext);
    if (nextCmd === head) {
      break;
    }
    pCmd = nextCmd;
    guard = (guard + 1) | 0;
  }
  return 0;
}

/**
 * @va D2Game:0x6FC417D0
 * Find an existing `D2AiCmdStrc` node with `dwCmdType == nCmdType`, or allocate
 * and link a new zero-initialized command node with `dwCmdType = nCmdType`.
 */
export function AIGENERAL_GetOrAllocAiCommandByType113c(
  mem: Memory113c,
  _pGame: number,
  pUnit: number,
  nCmdType: number,
): number {
  const existing = AIGENERAL_FindAiCommandByType113c(mem, pUnit, nCmdType);
  if (existing !== 0) {
    return existing;
  }
  const pCmd = AIGENERAL_AllocAiCommand113c(mem, pUnit);
  if (pCmd !== 0) {
    mem.set(pCmd, D2AiCmdStrc.dwCmdType, nCmdType >>> 0);
  }
  return pCmd;
}

/**
 * @va D2Game:0x6FCD07B0
 * Compute octile distance (`max(|dx|, |dy|) + (min(|dx|, |dy|) >> 1)`) from `pUnit`
 * to world coordinates `(nX, nY)`.
 */
export function UNITS_GetOctileDistanceToCoordinates113c(
  mem: Memory113c,
  pUnit: number,
  nX: number,
  nY: number,
): number {
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
 * @va D2Game:0x6FD11D90
 * Step `pUnit` by `nStepDist` subtiles toward (`bMoveToward != 0`) or away from
 * (`bMoveToward == 0`) `pTargetUnit`.
 */
export function AI_StepRelativeToTargetUnit113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pTargetUnit: number,
  nStepDist: number,
  bMoveToward: number,
  callees?: TownNpcAiCallees113c,
): number {
  if (pUnit === 0 || pTargetUnit === 0) return 0;
  const unitX = UNITS_GetX113c(mem, pUnit);
  const unitY = UNITS_GetY113c(mem, pUnit);
  const targetX = UNITS_GetX113c(mem, pTargetUnit);
  const targetY = UNITS_GetY113c(mem, pTargetUnit);

  let dx = (targetX - unitX) | 0;
  let dy = (targetY - unitY) | 0;
  if ((bMoveToward | 0) === 0) {
    dx = (-dx) | 0;
    dy = (-dy) | 0;
  }
  const absDx = dx < 0 ? (-dx) | 0 : dx;
  const absDy = dy < 0 ? (-dy) | 0 : dy;
  const maxDelta = absDx >= absDy ? absDx : absDy;
  if (maxDelta <= 0) {
    return 0;
  }
  const stepX = sdiv32(imul32(dx, nStepDist | 0), maxDelta);
  const stepY = sdiv32(imul32(dy, nStepDist | 0), maxDelta);
  const destX = (unitX + stepX) | 0;
  const destY = (unitY + stepY) | 0;
  const walkFn =
    callees !== undefined && callees.aiWalkToCoords !== undefined
      ? callees.aiWalkToCoords
      : defaultAiWalkToCoords113c;
  return walkFn(mem, pGame, pUnit, destX, destY, 0, 1);
}

/**
 * @va D2Game:0x6FD130C0
 * Find the nearest living `UNIT_PLAYER` in `pUnit`'s active room or nearby rooms.
 */
export function AI_FindNearestPlayerTarget113c(
  mem: Memory113c,
  _pGame: number,
  pUnit: number,
): number {
  if (pUnit === 0) return 0;
  const pRoom = UNITS_GetRoom113c(mem, pUnit);
  if (pRoom === 0) return 0;

  const nRoomsNear = mem.get(pRoom, D2ActiveRoomStrc.nRoomsNear) | 0;
  const ppRoomsNear = mem.get(pRoom, D2ActiveRoomStrc.ppRoomsNear);
  if (nRoomsNear > 0 && ppRoomsNear !== 0) {
    const unitX = UNITS_GetX113c(mem, pUnit);
    const unitY = UNITS_GetY113c(mem, pUnit);
    return UNITFINDS_FindNearestUnitInRange113c(
      mem,
      pUnit,
      unitX,
      unitY,
      0,
      (m, pCandidate) => {
        if (m.get(pCandidate, D2UnitStrc.dwUnitType) !== UNIT_PLAYER) {
          return 0;
        }
        return SUNIT_IsDeadOrDying113c(m, pCandidate) === 0 ? 1 : 0;
      },
    );
  }

  let bestPlayer = 0;
  let bestDist = 0x7fffffff;
  let pCandidate = mem.get(pRoom, D2ActiveRoomStrc.pUnitFirst);
  let guard = 0;
  while (pCandidate !== 0 && guard < 512) {
    if (
      mem.get(pCandidate, D2UnitStrc.dwUnitType) === UNIT_PLAYER &&
      SUNIT_IsDeadOrDying113c(mem, pCandidate) === 0
    ) {
      const dist = UNITS_GetDistanceToOtherUnit113c(mem, pUnit, pCandidate);
      if (dist < bestDist) {
        bestDist = dist;
        bestPlayer = pCandidate;
      }
    }
    pCandidate = mem.get(pCandidate, D2UnitStrc.pRoomUnitNext);
    guard = (guard + 1) | 0;
  }
  return bestPlayer;
}

/**
 * @va D2Game:0x6FC35D10
 * Initialize AI command node `10` with `pUnit`'s home `(nX, nY, nLevelId)`.
 */
export function AI_InitHomeNode10_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  const pCmd10 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 10);
  if (pCmd10 === 0) return 0;
  const homeX = UNITS_GetX113c(mem, pUnit);
  const homeY = UNITS_GetY113c(mem, pUnit);
  let nLevelId = 0;
  const pRoom = UNITS_GetRoom113c(mem, pUnit);
  if (pRoom !== 0) {
    const pRoomEx = mem.get(pRoom, D2ActiveRoomStrc.pRoomEx);
    if (pRoomEx !== 0) {
      const pLevel = mem.get(pRoomEx, D2RoomExStrc.pLevel);
      if (pLevel !== 0) {
        nLevelId = mem.get(pLevel, D2DrlgLevelStrc.nLevelId) | 0;
      }
    }
  }
  mem.set(pCmd10, D2AiCmdStrc.dwParam1, homeX >>> 0);
  mem.set(pCmd10, D2AiCmdStrc.dwParam2, homeY >>> 0);
  mem.set(pCmd10, D2AiCmdStrc.dwParam3, nLevelId >>> 0);
  return pCmd10;
}

/**
 * @va D2Game:0x6FC36610
 * If `pUnit` has wandered beyond `nLeashDist` octile distance from its home node `10`,
 * walk back toward `(homeX, homeY)`.
 */
export function AI_CheckReturnHomeToNode10_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  _pAiTickParam: number,
  nLeashDist: number,
  callees?: TownNpcAiCallees113c,
): number {
  const pCmd10 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 10);
  if (pCmd10 === 0) return 0;
  const homeX = mem.get(pCmd10, D2AiCmdStrc.dwParam1) | 0;
  const homeY = mem.get(pCmd10, D2AiCmdStrc.dwParam2) | 0;
  const leash = (nLeashDist | 0) > 0 ? nLeashDist | 0 : 15;
  const dist = UNITS_GetOctileDistanceToCoordinates113c(mem, pUnit, homeX, homeY);
  if (dist <= leash) {
    return 0;
  }
  const walkFn =
    callees !== undefined && callees.aiWalkToCoords !== undefined
      ? callees.aiWalkToCoords
      : defaultAiWalkToCoords113c;
  return walkFn(mem, pGame, pUnit, homeX, homeY, 0, 1);
}

/**
 * @va D2Game:0x6FC39AD0
 * MapAI Action `4`: Walk within 3 subtiles of `(nDestX, nDestY)` and trigger `MONMODE_SKILL1` (`8`).
 */
export function AI_MapAiAction4_WalkAndMode8_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nDestX: number,
  nDestY: number,
  callees?: TownNpcAiCallees113c,
): number {
  const pCmd4 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 4);
  if (pCmd4 === 0) return 0;

  const state = mem.get(pCmd4, D2AiCmdStrc.dwParam1) | 0;
  if (state === 0) {
    const curX = UNITS_GetX113c(mem, pUnit);
    const curY = UNITS_GetY113c(mem, pUnit);
    let dx = (curX - (nDestX | 0)) | 0;
    if (dx < 0) dx = (-dx) | 0;
    let dy = (curY - (nDestY | 0)) | 0;
    if (dy < 0) dy = (-dy) | 0;
    if (dx > 3 || dy > 3) {
      mem.set(pCmd4, D2AiCmdStrc.dwParam2, nDestX >>> 0);
      mem.set(pCmd4, D2AiCmdStrc.dwParam3, nDestY >>> 0);
      const walkFn =
        callees !== undefined && callees.aiWalkToCoords !== undefined
          ? callees.aiWalkToCoords
          : defaultAiWalkToCoords113c;
      if (walkFn(mem, pGame, pUnit, nDestX | 0, nDestY | 0, 0, 1) !== 0) {
        return 1;
      }
      if (callees !== undefined && callees.aiStepOrIdle !== undefined) {
        callees.aiStepOrIdle(mem, pGame, pUnit, 15, nDestX | 0, nDestY | 0);
      } else {
        defaultAiIdleWait113c(mem, pGame, pUnit, 15);
      }
      return 1;
    }
    mem.set(pCmd4, D2AiCmdStrc.dwParam1, 1);
    const modeFn =
      callees !== undefined && callees.aiTriggerMode !== undefined
        ? callees.aiTriggerMode
        : defaultAiTriggerMode113c;
    modeFn(mem, pGame, pUnit, 8);
    return 1;
  }

  mem.set(pCmd4, D2AiCmdStrc.dwParam1, 0);
  return 0;
}

/**
 * @va D2Game:0x6FC39A00
 * MapAI Action `5`: Walk within 3 subtiles of `(nDestX, nDestY)` and trigger `MONMODE_SKILL2` (`9`).
 */
export function AI_MapAiAction5_WalkAndMode9_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nDestX: number,
  nDestY: number,
  callees?: TownNpcAiCallees113c,
): number {
  const pCmd5 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 5);
  if (pCmd5 === 0) return 0;

  const state = mem.get(pCmd5, D2AiCmdStrc.dwParam1) | 0;
  if (state === 0) {
    const curX = UNITS_GetX113c(mem, pUnit);
    const curY = UNITS_GetY113c(mem, pUnit);
    let dx = (curX - (nDestX | 0)) | 0;
    if (dx < 0) dx = (-dx) | 0;
    let dy = (curY - (nDestY | 0)) | 0;
    if (dy < 0) dy = (-dy) | 0;
    if (dx > 3 || dy > 3) {
      mem.set(pCmd5, D2AiCmdStrc.dwParam2, nDestX >>> 0);
      mem.set(pCmd5, D2AiCmdStrc.dwParam3, nDestY >>> 0);
      const walkFn =
        callees !== undefined && callees.aiWalkToCoords !== undefined
          ? callees.aiWalkToCoords
          : defaultAiWalkToCoords113c;
      if (walkFn(mem, pGame, pUnit, nDestX | 0, nDestY | 0, 0, 1) !== 0) {
        return 1;
      }
      if (callees !== undefined && callees.aiStepOrIdle !== undefined) {
        callees.aiStepOrIdle(mem, pGame, pUnit, 15, nDestX | 0, nDestY | 0);
      } else {
        defaultAiIdleWait113c(mem, pGame, pUnit, 15);
      }
      return 1;
    }
    mem.set(pCmd5, D2AiCmdStrc.dwParam1, 1);
    const modeFn =
      callees !== undefined && callees.aiTriggerMode !== undefined
        ? callees.aiTriggerMode
        : defaultAiTriggerMode113c;
    modeFn(mem, pGame, pUnit, 9);
    return 1;
  }

  mem.set(pCmd5, D2AiCmdStrc.dwParam1, 0);
  return 0;
}

/**
 * @va D2Game:0x6FC36A30
 * Check pending continuation nodes `7`, `4`, and `5` before evaluating a new waypoint step.
 */
export function AI_TickNodes4_5_7_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  callees?: TownNpcAiCallees113c,
): number {
  const pCmd7 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 7);
  if (pCmd7 !== 0) {
    const count7 = mem.get(pCmd7, D2AiCmdStrc.dwParam1) | 0;
    if (count7 > 0) {
      mem.set(pCmd7, D2AiCmdStrc.dwParam1, ((count7 - 1) | 0) >>> 0);
      const idleFn =
        callees !== undefined && callees.aiIdleWait !== undefined
          ? callees.aiIdleWait
          : defaultAiIdleWait113c;
      idleFn(mem, pGame, pUnit, 20);
      return 1;
    }
  }

  const pCmd4 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 4);
  if (pCmd4 !== 0 && (mem.get(pCmd4, D2AiCmdStrc.dwParam1) | 0) !== 0) {
    const destX = mem.get(pCmd4, D2AiCmdStrc.dwParam2) | 0;
    const destY = mem.get(pCmd4, D2AiCmdStrc.dwParam3) | 0;
    return AI_MapAiAction4_WalkAndMode8_113c(mem, pGame, pUnit, destX, destY, callees);
  }

  const pCmd5 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 5);
  if (pCmd5 !== 0 && (mem.get(pCmd5, D2AiCmdStrc.dwParam1) | 0) !== 0) {
    const destX = mem.get(pCmd5, D2AiCmdStrc.dwParam2) | 0;
    const destY = mem.get(pCmd5, D2AiCmdStrc.dwParam3) | 0;
    return AI_MapAiAction5_WalkAndMode9_113c(mem, pGame, pUnit, destX, destY, callees);
  }

  return 0;
}

/**
 * @va D2Game:0x6FC36970
 * MapAI Action `1`: Walk within 3 subtiles of `(nDestX, nDestY)`.
 * Returns `1` while still walking toward the waypoint, or `0` once within `<= 3` subtiles.
 */
export function AI_MapAiAction1_WalkToWaypoint113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nDestX: number,
  nDestY: number,
  callees?: TownNpcAiCallees113c,
): number {
  if (AI_TickNodes4_5_7_113c(mem, pGame, pUnit, callees) !== 0) {
    return 1;
  }
  const curX = UNITS_GetX113c(mem, pUnit);
  const curY = UNITS_GetY113c(mem, pUnit);
  let dx = (curX - (nDestX | 0)) | 0;
  if (dx < 0) dx = (-dx) | 0;
  let dy = (curY - (nDestY | 0)) | 0;
  if (dy < 0) dy = (-dy) | 0;
  if (dx <= 3 && dy <= 3) {
    return 0;
  }

  const walkFn =
    callees !== undefined && callees.aiWalkToCoords !== undefined
      ? callees.aiWalkToCoords
      : defaultAiWalkToCoords113c;
  if (walkFn(mem, pGame, pUnit, nDestX | 0, nDestY | 0, 0, 1) !== 0) {
    return 1;
  }
  if (callees !== undefined && callees.aiStepOrIdle !== undefined) {
    callees.aiStepOrIdle(mem, pGame, pUnit, 15, nDestX | 0, nDestY | 0);
  } else {
    defaultAiIdleWait113c(mem, pGame, pUnit, 15);
  }
  return 1;
}

/**
 * @va D2Game:0x6FC39BB0
 * MapAI Action `2`: Walk to `(nDestX, nDestY)`, then pause for 20 frames via node `7`.
 */
export function AI_MapAiAction2_WalkAndWait20_113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nDestX: number,
  nDestY: number,
  callees?: TownNpcAiCallees113c,
): number {
  if (AI_MapAiAction1_WalkToWaypoint113c(mem, pGame, pUnit, nDestX, nDestY, callees) !== 0) {
    return 1;
  }
  const pCmd7 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 7);
  if (pCmd7 === 0) return 0;

  if ((mem.get(pCmd7, D2AiCmdStrc.dwParam1) | 0) === 0) {
    mem.set(pCmd7, D2AiCmdStrc.dwParam1, 1);
    const idleFn =
      callees !== undefined && callees.aiIdleWait !== undefined
        ? callees.aiIdleWait
        : defaultAiIdleWait113c;
    idleFn(mem, pGame, pUnit, 20);
    return 1;
  }

  mem.set(pCmd7, D2AiCmdStrc.dwParam1, 0);
  return 0;
}

/**
 * @va D2Game:0x6FC39BA0
 * MapAI Action `3`: Alias for `AI_MapAiAction1_WalkToWaypoint113c` (`0x6FC36970`).
 */
export function AI_MapAiAction3_WalkToWaypoint113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  nDestX: number,
  nDestY: number,
  callees?: TownNpcAiCallees113c,
): number {
  return AI_MapAiAction1_WalkToWaypoint113c(mem, pGame, pUnit, nDestX, nDestY, callees);
}

/**
 * Clean-room 1:1 binary port of D2Game `0x6FC3BBC0` (`AI_FollowDs1NpcPath`).
 * Steps the `D2MapAIStrc` waypoint table stored at `pUnit->pMonsterData + 0x38`.
 * (Replacement export for the K0 stand-in in `replay-kernel-113c.ts`).
 */
export function AI_FollowDs1NpcPathMem113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  _pAiTickParam: number,
  callees?: TownNpcAiCallees113c,
): number {
  if (pUnit === 0) return 0;
  if (mem.get(pUnit, D2UnitStrc.dwUnitType) !== UNIT_MONSTER) {
    return 0;
  }
  const pMonsterData = mem.get(pUnit, D2UnitStrc.pUnitData);
  if (pMonsterData === 0) return 0;
  const pAiGeneral = mem.get(pMonsterData, D2MonsterDataStrc.pAiGeneral);
  let pMapAi =
    pAiGeneral !== 0
      ? mem.u32((pAiGeneral + D2MONSTERDATA_MAPAI_OFF_113C) >>> 0)
      : 0;
  if (pMapAi === 0) {
    pMapAi = mem.u32((pMonsterData + D2MONSTERDATA_MAPAI_OFF_113C) >>> 0);
  }
  if (pMapAi === 0) return 0;

  const pActions = mem.u32((pMapAi + D2MapAiHeaderOffsets.pPosition) >>> 0);
  if (pActions === 0) return 0;
  if ((mem.u32((pActions + D2MapAiActionOffsets.nAction) >>> 0) | 0) === 0) {
    return 0;
  }

  let idx = mem.u32((pMapAi + D2MapAiHeaderOffsets.nCurrentIndex) >>> 0) | 0;
  if (
    idx < 0 ||
    (mem.u32((pActions + (idx << 4) + D2MapAiActionOffsets.nAction) >>> 0) | 0) === 0
  ) {
    idx = 0;
    mem.setU32((pMapAi + D2MapAiHeaderOffsets.nCurrentIndex) >>> 0, 0);
  }

  const pEntry = (pActions + (idx << 4)) >>> 0;
  const nDestX = mem.u32((pEntry + D2MapAiActionOffsets.nX) >>> 0) | 0;
  const nDestY = mem.u32((pEntry + D2MapAiActionOffsets.nY) >>> 0) | 0;
  const nAction = mem.u32((pEntry + D2MapAiActionOffsets.nAction) >>> 0) | 0;

  let stepResult = 0;
  switch (nAction) {
    case 1:
      stepResult = AI_MapAiAction1_WalkToWaypoint113c(mem, pGame, pUnit, nDestX, nDestY, callees);
      break;
    case 2:
      stepResult = AI_MapAiAction2_WalkAndWait20_113c(mem, pGame, pUnit, nDestX, nDestY, callees);
      break;
    case 3:
      stepResult = AI_MapAiAction3_WalkToWaypoint113c(mem, pGame, pUnit, nDestX, nDestY, callees);
      break;
    case 4:
      stepResult = AI_MapAiAction4_WalkAndMode8_113c(mem, pGame, pUnit, nDestX, nDestY, callees);
      break;
    case 5:
      stepResult = AI_MapAiAction5_WalkAndMode9_113c(mem, pGame, pUnit, nDestX, nDestY, callees);
      break;
    default:
      return 0;
  }

  if (stepResult === 0) {
    let nextIdx = (idx + 1) | 0;
    if ((mem.u32((pActions + (nextIdx << 4) + D2MapAiActionOffsets.nAction) >>> 0) | 0) === 0) {
      nextIdx = 0;
    }
    mem.setU32((pMapAi + D2MapAiHeaderOffsets.nCurrentIndex) >>> 0, nextIdx >>> 0);
    const pNextEntry = (pActions + (nextIdx << 4)) >>> 0;
    const nextX = mem.u32((pNextEntry + D2MapAiActionOffsets.nX) >>> 0) | 0;
    const nextY = mem.u32((pNextEntry + D2MapAiActionOffsets.nY) >>> 0) | 0;
    return AI_MapAiAction2_WalkAndWait20_113c(mem, pGame, pUnit, nextX, nextY, callees);
  }

  return 1;
}

/**
 * @va D2Game:0x6FC3BC60
 * Simple DS1 path-following NPC AI: follows `D2MapAIStrc` waypoints or idles 15 frames.
 */
export function AI_SimpleMapAiNpc113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
  callees?: TownNpcAiCallees113c,
): void {
  if (AI_FollowDs1NpcPathMem113c(mem, pGame, pUnit, pAiTickParam, callees) !== 0) {
    return;
  }
  const idleFn =
    callees !== undefined && callees.aiIdleWait !== undefined
      ? callees.aiIdleWait
      : defaultAiIdleWait113c;
  idleFn(mem, pGame, pUnit, 15);
}

/**
 * Clean-room 1:1 binary port of D2Game `0x6FC3DB40` (`AI_TownNpc`).
 * Handles dialogue-lock node `9`, DS1 path following (`0x6FC3BBC0`), home-node `10`
 * leash check (`0x6FC35D10` / `0x6FC36610`), and random wander/idle ticks.
 * (Replacement export for the K0 stand-in in `replay-kernel-113c.ts`).
 */
export function AI_TownNpcMem113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
  callees?: TownNpcAiCallees113c,
): void {
  if (pUnit === 0) return;

  const pCmd9 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 9);
  const idleFn =
    callees !== undefined && callees.aiIdleWait !== undefined
      ? callees.aiIdleWait
      : defaultAiIdleWait113c;
  if (pCmd9 !== 0 && (mem.get(pCmd9, D2AiCmdStrc.dwParam1) | 0) !== 0) {
    idleFn(mem, pGame, pUnit, 15);
    return;
  }

  if (AI_FollowDs1NpcPathMem113c(mem, pGame, pUnit, pAiTickParam, callees) !== 0) {
    return;
  }

  if (AIGENERAL_FindAiCommandByType113c(mem, pUnit, 10) === 0) {
    AI_InitHomeNode10_113c(mem, pGame, pUnit);
  }

  const leashDist =
    pAiTickParam !== 0
      ? mem.u32((pAiTickParam + D2AiTickParamOffsets.nVelocity) >>> 0) | 0
      : 15;
  if (AI_CheckReturnHomeToNode10_113c(mem, pGame, pUnit, pAiTickParam, leashDist, callees) !== 0) {
    return;
  }

  const seed: D2SeedStrc = {
    lo: mem.get(pUnit, D2UnitStrc.seedLo),
    hi: mem.get(pUnit, D2UnitStrc.seedHi),
  };
  const roll = seedRoll(seed, 100);
  mem.set(pUnit, D2UnitStrc.seedLo, seed.lo >>> 0);
  mem.set(pUnit, D2UnitStrc.seedHi, seed.hi >>> 0);

  if (roll < 35) {
    const wanderFn =
      callees !== undefined && callees.aiWanderStep !== undefined
        ? callees.aiWanderStep
        : defaultAiWanderStep113c;
    if (wanderFn(mem, pGame, pUnit, 4) !== 0) {
      return;
    }
  }
  idleFn(mem, pGame, pUnit, 15);
}

/**
 * Clean-room 1:1 binary port of D2Game `0x6FC39C20` (`AI_WarrivGreet`).
 * Act 1 Warriv intro greeting AI: checks dialogue node `9`, checks one-shot greeting
 * node `8` (steps toward the nearest player within 25 subtiles and pauses 10 frames
 * once within 4 subtiles), then delegates to `AI_TownNpcMem113c` (`0x6FC3DB40`).
 * (Replacement export for the K0 stand-in in `replay-kernel-113c.ts`).
 */
export function AI_WarrivGreetMem113c(
  mem: Memory113c,
  pGame: number,
  pUnit: number,
  pAiTickParam: number,
  callees?: TownNpcAiCallees113c,
): void {
  if (pUnit === 0) return;

  const idleFn =
    callees !== undefined && callees.aiIdleWait !== undefined
      ? callees.aiIdleWait
      : defaultAiIdleWait113c;
  const pCmd9 = AIGENERAL_FindAiCommandByType113c(mem, pUnit, 9);
  if (pCmd9 !== 0 && (mem.get(pCmd9, D2AiCmdStrc.dwParam1) | 0) !== 0) {
    idleFn(mem, pGame, pUnit, 15);
    return;
  }

  const pCmd8 = AIGENERAL_GetOrAllocAiCommandByType113c(mem, pGame, pUnit, 8);
  if (pCmd8 !== 0 && (mem.get(pCmd8, D2AiCmdStrc.dwParam1) | 0) === 0) {
    let pTarget =
      pAiTickParam !== 0
        ? mem.u32((pAiTickParam + D2AiTickParamOffsets.pTarget) >>> 0)
        : 0;
    if (
      pTarget === 0 ||
      mem.get(pTarget, D2UnitStrc.dwUnitType) !== UNIT_PLAYER
    ) {
      pTarget = AI_FindNearestPlayerTarget113c(mem, pGame, pUnit);
    }
    if (pTarget !== 0) {
      const dist = UNITS_GetDistanceToOtherUnit113c(mem, pUnit, pTarget);
      if (dist < 25) {
        if (dist >= 4) {
          if (
            AI_StepRelativeToTargetUnit113c(
              mem,
              pGame,
              pUnit,
              pTarget,
              (dist - 2) | 0,
              1,
              callees,
            ) !== 0
          ) {
            return;
          }
        }
        mem.set(pCmd8, D2AiCmdStrc.dwParam1, 1);
        idleFn(mem, pGame, pUnit, 10);
        return;
      }
    }
  }

  AI_TownNpcMem113c(mem, pGame, pUnit, pAiTickParam, callees);
}
