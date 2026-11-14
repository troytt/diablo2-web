/**
 * @file src/d2kern-113c/game/c2s-packet-113c.ts
 * Clean-room 1:1 binary port of D2Game.dll v1.13c Client-to-Server (C2S) packet table
 * dispatcher (`0x6FCEC550`), the 103-entry `0x6FD1A078` packet handler table (`0x00..0x66`),
 * and the player movement/skill opcode handlers (`0x01..0x11`, `0x3C`, `0x5F`).
 *
 * Operates strictly on `Memory113c` virtual pointers (`pGame`, `pClient`, `pPlayer`, `pPacket`).
 * Zero JS Maps, zero array sorting, zero permissive `??` fallbacks.
 */

import {
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillsTxtFromSkill113c,
  SKILLS_GetUsedSkill113c,
} from '../common/skills.ts';
import { STATES_CheckState113c } from '../common/statlist.ts';
import {
  UNIT_TILE,
  UNITS_GetRoom113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
} from '../common/unit.ts';
import {
  D2ActiveRoomStrc,
  D2DynamicPathStrc,
  D2GameStrc,
  D2SkillListStrc,
  D2SkillsTxt,
  D2UnitStrc,
} from '../mem/layout.generated.ts';
import type { Memory113c } from '../mem/sparse-memory.ts';
import {
  DUNGEON_CheckRoomIsTown113c,
  INVENTORY_GetItemFromBodyLoc113c,
  ITEMS_CheckItemTypeId113c,
  ITEMS_CheckNotBrokenOrUnequipping113c,
  UNITS_CanDualWield113c,
} from './replay-kernel-113c.ts';
import {
  MONSTER_RegisterContinuousModeEvent113c,
  SKILLS_SetUsedSkill113c,
} from './monster-events.ts';

/**
 * `D2ClientStrc` field offsets read by `0x6FCEC550` (`C2S_DispatchPacket`).
 */
export const D2ClientStrcOffsets = {
  dwClientId: 0x000,
  dwClientState: 0x004,
  pPlayer: 0x174,
} as const;

/** Player animation modes (`D2C_PlayerModes`) used by movement/action packets. */
export const PLRMODE_DEATH = 0;
export const PLRMODE_NEUTRAL = 1;
export const PLRMODE_WALK = 2;
export const PLRMODE_RUN = 3;
export const PLRMODE_ATTACK1 = 7;
export const PLRMODE_CAST = 10;
export const PLRMODE_DEAD = 17;

/** `D2PacketTableStrc` entry in `0x6FD1A078` (`12` bytes per opcode `0x00..0x66`). */
export interface D2C2SPacketTableEntry113c {
  readonly opcode: number;
  readonly handlerVa: number;
  readonly packetSize: number;
  readonly handler2Va: number;
}

/**
 * Exact 103-entry (`0x00..0x66`) C2S packet descriptor table at `D2Game.dll:0x6FD1A078`.
 * `packetSize === -1` (`0xFFFFFFFF`) denotes variable-length packets (e.g. `0x14`, `0x15`, `0x66`).
 */
export const C2S_PACKET_TABLE_6FD1A078_113C: readonly D2C2SPacketTableEntry113c[] = [
  { opcode: 0x00, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x01, handlerVa: 0x6fcee0d0, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x02, handlerVa: 0x6fcee090, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x03, handlerVa: 0x6fcee040, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x04, handlerVa: 0x6fcee000, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x05, handlerVa: 0x6fcee5a0, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x06, handlerVa: 0x6fcee9d0, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x07, handlerVa: 0x6fcee950, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x08, handlerVa: 0x6fcee8f0, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x09, handlerVa: 0x6fceeb70, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x0a, handlerVa: 0x6fceeb10, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x0b, handlerVa: 0x6fceb5b0, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x0c, handlerVa: 0x6fcee520, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x0d, handlerVa: 0x6fcee870, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x0e, handlerVa: 0x6fcee7f0, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x0f, handlerVa: 0x6fcee790, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x10, handlerVa: 0x6fceeab0, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x11, handlerVa: 0x6fceea50, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x12, handlerVa: 0x6fceb5c0, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x13, handlerVa: 0x6fceed80, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x14, handlerVa: 0x6fceca30, packetSize: -1, handler2Va: 0x00000000 },
  { opcode: 0x15, handlerVa: 0x6fcec910, packetSize: -1, handler2Va: 0x00000000 },
  { opcode: 0x16, handlerVa: 0x6fceed10, packetSize: 13, handler2Va: 0x00000000 },
  { opcode: 0x17, handlerVa: 0x6fceefb0, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x18, handlerVa: 0x6fcef000, packetSize: 17, handler2Va: 0x00000000 },
  { opcode: 0x19, handlerVa: 0x6fcef050, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x1a, handlerVa: 0x6fcef090, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x1b, handlerVa: 0x6fcef0e0, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x1c, handlerVa: 0x6fcef130, packetSize: 3, handler2Va: 0x00000000 },
  { opcode: 0x1d, handlerVa: 0x6fcef170, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x1e, handlerVa: 0x6fceb5d0, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x1f, handlerVa: 0x6fcef1c0, packetSize: 17, handler2Va: 0x00000000 },
  { opcode: 0x20, handlerVa: 0x6fcef210, packetSize: 13, handler2Va: 0x00000000 },
  { opcode: 0x21, handlerVa: 0x6fcef290, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x22, handlerVa: 0x6fcef2d0, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x23, handlerVa: 0x6fcef310, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x24, handlerVa: 0x6fcef360, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x25, handlerVa: 0x6fcef3a0, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x26, handlerVa: 0x6fcef3f0, packetSize: 13, handler2Va: 0x00000000 },
  { opcode: 0x27, handlerVa: 0x6fcef440, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x28, handlerVa: 0x6fcef600, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x29, handlerVa: 0x6fcef640, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x2a, handlerVa: 0x6fcef690, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x2b, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x2c, handlerVa: 0x6fceb610, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x2d, handlerVa: 0x6fceb620, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x2e, handlerVa: 0x6fceb630, packetSize: 3, handler2Va: 0x00000000 },
  { opcode: 0x2f, handlerVa: 0x6fcf0c50, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x30, handlerVa: 0x6fcf0bf0, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x31, handlerVa: 0x6fcf03a0, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x32, handlerVa: 0x6fcef6d0, packetSize: 17, handler2Va: 0x00000000 },
  { opcode: 0x33, handlerVa: 0x6fcef730, packetSize: 17, handler2Va: 0x00000000 },
  { opcode: 0x34, handlerVa: 0x6fcef780, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x35, handlerVa: 0x6fcef7c0, packetSize: 17, handler2Va: 0x00000000 },
  { opcode: 0x36, handlerVa: 0x6fcef810, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x37, handlerVa: 0x6fcef850, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x38, handlerVa: 0x6fcef890, packetSize: 13, handler2Va: 0x00000000 },
  { opcode: 0x39, handlerVa: 0x6fcef8e0, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x3a, handlerVa: 0x6fcf0400, packetSize: 3, handler2Va: 0x00000000 },
  { opcode: 0x3b, handlerVa: 0x6fcf0690, packetSize: 3, handler2Va: 0x00000000 },
  { opcode: 0x3c, handlerVa: 0x6fcef480, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x3d, handlerVa: 0x6fcef5c0, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x3e, handlerVa: 0x6fcef930, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x3f, handlerVa: 0x6fcefa50, packetSize: 3, handler2Va: 0x00000000 },
  { opcode: 0x40, handlerVa: 0x6fcefa90, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x41, handlerVa: 0x6fcefad0, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x42, handlerVa: 0x6fceb640, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x43, handlerVa: 0x6fceb650, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x44, handlerVa: 0x6fcefb00, packetSize: 17, handler2Va: 0x00000000 },
  { opcode: 0x45, handlerVa: 0x6fcefb90, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x46, handlerVa: 0x6fcefc10, packetSize: 13, handler2Va: 0x00000000 },
  { opcode: 0x47, handlerVa: 0x6fcefc80, packetSize: 13, handler2Va: 0x00000000 },
  { opcode: 0x48, handlerVa: 0x6fcefd50, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x49, handlerVa: 0x6fcefd90, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x4a, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x4b, handlerVa: 0x6fcefe20, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x4c, handlerVa: 0x6fcefe70, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x4d, handlerVa: 0x6fcefeb0, packetSize: 3, handler2Va: 0x00000000 },
  { opcode: 0x4e, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x4f, handlerVa: 0x6fceff30, packetSize: 7, handler2Va: 0x00000000 },
  { opcode: 0x50, handlerVa: 0x6fceff90, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x51, handlerVa: 0x6fcf0050, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x52, handlerVa: 0x6fcf0090, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x53, handlerVa: 0x6fcf0110, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x54, handlerVa: 0x6fcf0150, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x55, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x56, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x57, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x58, handlerVa: 0x6fcf0190, packetSize: 3, handler2Va: 0x00000000 },
  { opcode: 0x59, handlerVa: 0x6fcf01f0, packetSize: 17, handler2Va: 0x00000000 },
  { opcode: 0x5a, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x5b, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x5c, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x5d, handlerVa: 0x6fcf0290, packetSize: 7, handler2Va: 0x00000000 },
  { opcode: 0x5e, handlerVa: 0x6fcf02f0, packetSize: 6, handler2Va: 0x00000000 },
  { opcode: 0x5f, handlerVa: 0x6fcf0790, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x60, handlerVa: 0x6fcf08b0, packetSize: 1, handler2Va: 0x00000000 },
  { opcode: 0x61, handlerVa: 0x6fcf0900, packetSize: 3, handler2Va: 0x00000000 },
  { opcode: 0x62, handlerVa: 0x6fcf0a80, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x63, handlerVa: 0x6fcf0af0, packetSize: 5, handler2Va: 0x00000000 },
  { opcode: 0x64, handlerVa: 0x00000000, packetSize: 9, handler2Va: 0x00000000 },
  { opcode: 0x65, handlerVa: 0x00000000, packetSize: 0, handler2Va: 0x00000000 },
  { opcode: 0x66, handlerVa: 0x6fceb670, packetSize: -1, handler2Va: 0x6fceb680 },
] as const;

/**
 * Injectable hooks for `c2s-packet-113c.ts` to customize server unit lookup or
 * player path/mode execution while defaulting to pure `Memory113c` operations.
 */
export interface C2SPacketCallees113c {
  /** Optional override for `SUNIT_GetServerUnit` (`0x6FCBDE40`). */
  findServerUnit?: (
    mem: Memory113c,
    pGame: number,
    dwUnitType: number,
    dwUnitId: number,
    pPlayer: number,
  ) => number;
  /** Optional override for `PLAYER_StartModeAtCoords113c` (`0x6FC98550`). */
  startPlayerModeAtCoords?: (
    mem: Memory113c,
    pGame: number,
    pPlayer: number,
    nPlrMode: number,
    nX: number,
    nY: number,
    bRunOrShift: number,
  ) => number;
  /** Optional override for `PLAYER_StartModeOnUnit113c` (`0x6FC98430`). */
  startPlayerModeOnUnit?: (
    mem: Memory113c,
    pGame: number,
    pPlayer: number,
    pTargetUnit: number,
    nPlrMode: number,
    nX: number,
    nY: number,
    bRunOrShift: number,
  ) => number;
  /** Optional handler hook for opcodes outside the core movement/skill set. */
  onUnhandledOpcode?: (
    mem: Memory113c,
    pGame: number,
    pPlayer: number,
    opcode: number,
    pPacket: number,
    nPacketLen: number,
  ) => number;
}

function resolveServerUnitFromMemory113c(
  mem: Memory113c,
  pGame: number,
  dwUnitType: number,
  dwUnitId: number,
  pPlayer: number,
): number {
  const typeU = dwUnitType >>> 0;
  const idU = dwUnitId >>> 0;
  if (typeU >= 6) return 0;

  // 1. Check `pGame->pUnitHash` (`+0x1120`, 5 types * 128 buckets) or `pTileList` (`+0x1B20`)
  if (pGame !== 0) {
    let pUnit = 0;
    if (typeU < 5) {
      const bucketIdx = ((typeU << 7) + (idU & 0x7f)) | 0;
      pUnit = mem.get(pGame, D2GameStrc.pUnitHash, bucketIdx);
    } else if (typeU === UNIT_TILE) {
      pUnit = mem.get(pGame, D2GameStrc.pTileList);
    }
    let guard = 0;
    while (pUnit !== 0 && guard < 512) {
      if (
        mem.get(pUnit, D2UnitStrc.dwUnitType) === typeU &&
        mem.get(pUnit, D2UnitStrc.dwUnitId) === idU
      ) {
        return pUnit;
      }
      pUnit = mem.get(pUnit, D2UnitStrc.pGameHashNext);
      guard = (guard + 1) | 0;
    }
  }

  // 2. Fallback: scan `pPlayer`'s current room (`pRoom->pUnitFirst` via `pRoomUnitNext`)
  const pRoom = UNITS_GetRoom113c(mem, pPlayer);
  if (pRoom !== 0) {
    let pUnit = mem.get(pRoom, D2ActiveRoomStrc.pUnitFirst);
    let guard = 0;
    while (pUnit !== 0 && guard < 512) {
      if (
        mem.get(pUnit, D2UnitStrc.dwUnitType) === typeU &&
        mem.get(pUnit, D2UnitStrc.dwUnitId) === idU
      ) {
        return pUnit;
      }
      pUnit = mem.get(pUnit, D2UnitStrc.pRoomUnitNext);
      guard = (guard + 1) | 0;
    }
  }

  return 0;
}

/**
 * @va D2Game:0x6FC98550
 * Start player movement or action mode (`PLRMODE_WALK = 2`, `PLRMODE_RUN = 3`, `PLRMODE_ATTACK1 = 7`, etc.)
 * targeting world coordinates `(nX, nY)`.
 */
export function PLAYER_StartModeAtCoords113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  nPlrMode: number,
  nX: number,
  nY: number,
  bRunOrShift: number,
  callees?: C2SPacketCallees113c,
): number {
  if (pPlayer === 0) return 0;
  if (callees !== undefined && callees.startPlayerModeAtCoords !== undefined) {
    return callees.startPlayerModeAtCoords(
      mem,
      pGame,
      pPlayer,
      nPlrMode,
      nX,
      nY,
      bRunOrShift,
    );
  }
  const pPath = mem.get(pPlayer, D2UnitStrc.pPath);
  if (pPath !== 0) {
    mem.set(pPath, D2DynamicPathStrc.wTargetX, (nX | 0) & 0xffff);
    mem.set(pPath, D2DynamicPathStrc.wTargetY, (nY | 0) & 0xffff);
    mem.set(pPath, D2DynamicPathStrc.pTargetUnit, 0);
  }
  mem.set(pPlayer, D2UnitStrc.dwAnimMode, nPlrMode >>> 0);
  if (pGame !== 0 && mem.get(pGame, D2GameStrc.pTimer) !== 0) {
    MONSTER_RegisterContinuousModeEvent113c(mem, pGame, pPlayer);
  }
  return 1;
}

/**
 * @va D2Game:0x6FC98430
 * Start player movement or action mode targeting `pTargetUnit`.
 */
export function PLAYER_StartModeOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pTargetUnit: number,
  nPlrMode: number,
  nX: number,
  nY: number,
  bRunOrShift: number,
  callees?: C2SPacketCallees113c,
): number {
  if (pPlayer === 0 || pTargetUnit === 0) return 0;
  if (callees !== undefined && callees.startPlayerModeOnUnit !== undefined) {
    return callees.startPlayerModeOnUnit(
      mem,
      pGame,
      pPlayer,
      pTargetUnit,
      nPlrMode,
      nX,
      nY,
      bRunOrShift,
    );
  }
  const pPath = mem.get(pPlayer, D2UnitStrc.pPath);
  if (pPath !== 0) {
    const targetX = UNITS_GetX113c(mem, pTargetUnit);
    const targetY = UNITS_GetY113c(mem, pTargetUnit);
    mem.set(pPath, D2DynamicPathStrc.wTargetX, targetX & 0xffff);
    mem.set(pPath, D2DynamicPathStrc.wTargetY, targetY & 0xffff);
    mem.set(pPath, D2DynamicPathStrc.pTargetUnit, pTargetUnit >>> 0);
  }
  mem.set(pPlayer, D2UnitStrc.dwAnimMode, nPlrMode >>> 0);
  if (pGame !== 0 && mem.get(pGame, D2GameStrc.pTimer) !== 0) {
    MONSTER_RegisterContinuousModeEvent113c(mem, pGame, pPlayer);
  }
  return 1;
}

/**
 * @va D2Game:0x6FCEB1F0
 * If `pSkill` is `SKILL_THROW` (`2`) and the player can dual-wield (`UNITS_CanDualWield`)
 * with no valid right-hand throwing weapon (`BODYLOC_RARM = 4`, `ITEMTYPE_THROWING = 48`),
 * substitute `SKILL_LEFT_HAND_THROW` (`144`) when the left hand holds an unbroken throwing weapon.
 */
export function C2S_ResolveDualWieldThrowSkill113c(
  mem: Memory113c,
  pPlayer: number,
  pSkill: number,
): number {
  if (pPlayer === 0 || pSkill === 0) return pSkill;
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(mem, pSkill);
  if (nSkillId !== 2) {
    return pSkill;
  }
  if (!UNITS_CanDualWield113c(mem, pPlayer)) {
    return pSkill;
  }
  const pInventory = mem.get(pPlayer, D2UnitStrc.pInventory);
  if (pInventory === 0) {
    return pSkill;
  }
  const pRightItem = INVENTORY_GetItemFromBodyLoc113c(mem, pInventory, 4);
  if (
    pRightItem !== 0 &&
    ITEMS_CheckItemTypeId113c(mem, pRightItem, 48) !== 0 &&
    ITEMS_CheckNotBrokenOrUnequipping113c(mem, pRightItem) !== 0
  ) {
    return pSkill;
  }
  const pLeftItem = INVENTORY_GetItemFromBodyLoc113c(mem, pInventory, 5);
  if (
    pLeftItem !== 0 &&
    ITEMS_CheckItemTypeId113c(mem, pLeftItem, 48) !== 0 &&
    ITEMS_CheckNotBrokenOrUnequipping113c(mem, pLeftItem) !== 0
  ) {
    const pLeftThrow = SKILLS_GetSkillById113c(mem, pPlayer, 144, -1);
    if (pLeftThrow !== 0) {
      return pLeftThrow;
    }
  }
  return pSkill;
}

/**
 * @va D2Game:0x6FCEB5B0
 * Opcode `0x0B`: 1-byte no-op keepalive packet handler. Returns `1`.
 */
export function C2S_Packet0B_Noop1Byte113c(): number {
  return 1;
}

/**
 * @va D2Game:0x6FCEB690
 * Check whether `|unitX - nX| > nMaxDelta` or `|unitY - nY| > nMaxDelta`.
 * Returns `1` if exceeded, `0` if within range.
 */
export function C2S_CheckCoordDeltaExceeded113c(
  mem: Memory113c,
  pUnit: number,
  nX: number,
  nY: number,
  nMaxDelta: number,
): number {
  if (pUnit === 0) return 1;
  let dx = (UNITS_GetX113c(mem, pUnit) - (nX | 0)) | 0;
  if (dx < 0) dx = (-dx) | 0;
  if (dx > (nMaxDelta | 0)) {
    return 1;
  }
  let dy = (UNITS_GetY113c(mem, pUnit) - (nY | 0)) | 0;
  if (dy < 0) dy = (-dy) | 0;
  return dy > (nMaxDelta | 0) ? 1 : 0;
}

export interface UnpackedLocationPacket113c {
  readonly ok: number;
  readonly nX: number;
  readonly nY: number;
}

/**
 * @va D2Game:0x6FCEBF50
 * Unpack `(nX, nY)` from a 5-byte C2S location packet (`+0x01: u16 nX`, `+0x03: u16 nY`)
 * and validate player state (alive, in room, not frozen, delta `<= 100`).
 */
export function C2S_UnpackAndValidateLocationPacket113c(
  mem: Memory113c,
  _pGame: number,
  pPlayer: number,
  pPacket: number,
): UnpackedLocationPacket113c {
  if (pPlayer === 0 || pPacket === 0) {
    return { ok: 0, nX: 0, nY: 0 };
  }
  if (UNITS_GetRoom113c(mem, pPlayer) === 0) {
    return { ok: 0, nX: 0, nY: 0 };
  }
  const dwAnimMode = mem.get(pPlayer, D2UnitStrc.dwAnimMode);
  if (dwAnimMode === PLRMODE_DEATH || dwAnimMode === PLRMODE_DEAD) {
    return { ok: 0, nX: 0, nY: 0 };
  }
  if (
    mem.get(pPlayer, D2UnitStrc.pStatListEx) !== 0 &&
    STATES_CheckState113c(mem, pPlayer, 1) !== 0
  ) {
    // STATE_FREEZE = 1
    return { ok: 0, nX: 0, nY: 0 };
  }
  const nX = mem.u16((pPacket + 1) >>> 0);
  const nY = mem.u16((pPacket + 3) >>> 0);
  if (nX === 0 || nY === 0) {
    return { ok: 0, nX, nY };
  }
  if (C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, nX, nY, 100) !== 0) {
    return { ok: 0, nX, nY };
  }
  return { ok: 1, nX, nY };
}

/**
 * @va D2Game:0x6FCECFE0
 * Validate that `pTargetUnit` has non-zero coordinates within 100 subtiles of `pPlayer`.
 */
export function C2S_ValidateTargetUnitDistance113c(
  mem: Memory113c,
  pPlayer: number,
  pTargetUnit: number,
): number {
  if (pPlayer === 0 || pTargetUnit === 0) return 0;
  const targetX = UNITS_GetX113c(mem, pTargetUnit);
  const targetY = UNITS_GetY113c(mem, pTargetUnit);
  if (targetX === 0 || targetY === 0) {
    return 0;
  }
  if (C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, targetX, targetY, 100) !== 0) {
    return 0;
  }
  return 1;
}

export interface UnpackedUnitPacket113c {
  readonly ok: number;
  readonly dwUnitType: number;
  readonly dwUnitId: number;
  readonly pTargetUnit: number;
}

/**
 * @va D2Game:0x6FCED630
 * Unpack `(dwUnitType, dwUnitId)` from a 9-byte C2S unit packet (`+0x01: u32 dwUnitType`,
 * `+0x05: u32 dwUnitId`), resolve `pTargetUnit`, and validate player state & target distance.
 */
export function C2S_UnpackAndValidateUnitPacket113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): UnpackedUnitPacket113c {
  if (pPlayer === 0 || pPacket === 0) {
    return { ok: 0, dwUnitType: 0, dwUnitId: 0, pTargetUnit: 0 };
  }
  if (UNITS_GetRoom113c(mem, pPlayer) === 0) {
    return { ok: 0, dwUnitType: 0, dwUnitId: 0, pTargetUnit: 0 };
  }
  const dwAnimMode = mem.get(pPlayer, D2UnitStrc.dwAnimMode);
  if (dwAnimMode === PLRMODE_DEATH || dwAnimMode === PLRMODE_DEAD) {
    return { ok: 0, dwUnitType: 0, dwUnitId: 0, pTargetUnit: 0 };
  }
  if (
    mem.get(pPlayer, D2UnitStrc.pStatListEx) !== 0 &&
    STATES_CheckState113c(mem, pPlayer, 1) !== 0
  ) {
    return { ok: 0, dwUnitType: 0, dwUnitId: 0, pTargetUnit: 0 };
  }
  const dwUnitType = mem.u32((pPacket + 1) >>> 0);
  const dwUnitId = mem.u32((pPacket + 5) >>> 0);
  if ((dwUnitType >>> 0) >= 6) {
    return { ok: 0, dwUnitType, dwUnitId, pTargetUnit: 0 };
  }
  const findFn =
    callees !== undefined && callees.findServerUnit !== undefined
      ? callees.findServerUnit
      : resolveServerUnitFromMemory113c;
  const pTargetUnit = findFn(mem, pGame, dwUnitType, dwUnitId, pPlayer);
  if (pTargetUnit === 0) {
    return { ok: 0, dwUnitType, dwUnitId, pTargetUnit: 0 };
  }
  if (C2S_ValidateTargetUnitDistance113c(mem, pPlayer, pTargetUnit) === 0) {
    return { ok: 0, dwUnitType, dwUnitId, pTargetUnit: 0 };
  }
  return { ok: 1, dwUnitType, dwUnitId, pTargetUnit };
}

/**
 * @va D2Game:0x6FCEE120
 * Move `pPlayer` (`bRun != 0` -> `PLRMODE_RUN`, `bRun == 0` -> `PLRMODE_WALK`) toward
 * `pTargetUnit` or `(nX, nY)`.
 */
export function C2S_RunToTargetAndSetQueuedSkill113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pTargetUnit: number,
  nX: number,
  nY: number,
  bRun: number,
  callees?: C2SPacketCallees113c,
): number {
  const mode = (bRun | 0) !== 0 ? PLRMODE_RUN : PLRMODE_WALK;
  if (pTargetUnit !== 0) {
    return PLAYER_StartModeOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pTargetUnit,
      mode,
      nX,
      nY,
      bRun,
      callees,
    );
  }
  return PLAYER_StartModeAtCoords113c(mem, pGame, pPlayer, mode, nX, nY, bRun, callees);
}

/**
 * @va D2Game:0x6FCEE0D0
 * Opcode `0x01`: Walk to location `(u16 nX, u16 nY)`. Returns packet length `5`.
 */
export function C2S_Packet01_WalkToLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateLocationPacket113c(mem, pGame, pPlayer, pPacket);
  if (unpacked.ok !== 0) {
    PLAYER_StartModeAtCoords113c(
      mem,
      pGame,
      pPlayer,
      PLRMODE_WALK,
      unpacked.nX,
      unpacked.nY,
      0,
      callees,
    );
  }
  return 5;
}

/**
 * @va D2Game:0x6FCEE090
 * Opcode `0x02`: Walk to target unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet02_WalkToUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    C2S_RunToTargetAndSetQueuedSkill113c(
      mem,
      pGame,
      pPlayer,
      unpacked.pTargetUnit,
      0,
      0,
      0,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEE040
 * Opcode `0x03`: Run to location `(u16 nX, u16 nY)`. Returns `5`.
 */
export function C2S_Packet03_RunToLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateLocationPacket113c(mem, pGame, pPlayer, pPacket);
  if (unpacked.ok !== 0) {
    PLAYER_StartModeAtCoords113c(
      mem,
      pGame,
      pPlayer,
      PLRMODE_RUN,
      unpacked.nX,
      unpacked.nY,
      1,
      callees,
    );
  }
  return 5;
}

/**
 * @va D2Game:0x6FCEE000
 * Opcode `0x04`: Run to target unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet04_RunToUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    C2S_RunToTargetAndSetQueuedSkill113c(
      mem,
      pGame,
      pPlayer,
      unpacked.pTargetUnit,
      0,
      0,
      1,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEDF30
 * Execute `pSkill` targeting world coordinates `(nX, nY)`.
 */
export function C2S_ExecuteSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pSkill: number,
  nX: number,
  nY: number,
  bShift: number,
  callees?: C2SPacketCallees113c,
): number {
  if (pPlayer === 0 || pSkill === 0) return 0;
  const resolvedSkill = C2S_ResolveDualWieldThrowSkill113c(mem, pPlayer, pSkill);
  const pRoom = UNITS_GetRoom113c(mem, pPlayer);
  if (pRoom !== 0 && DUNGEON_CheckRoomIsTown113c(mem, pRoom)) {
    const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(mem, resolvedSkill);
    if (pSkillsTxt !== 0) {
      const nFlags2 = mem.get(pSkillsTxt, D2SkillsTxt.nFlags2);
      // Skills.txt byte +0x06 bit 0x20 (`InTown`) allows casting in town
      const nSkillId = SKILLS_GetSkillIdFromSkill113c(mem, resolvedSkill);
      if (nSkillId > 0 && (nFlags2 & 0x20) === 0) {
        return 0;
      }
    }
  }
  SKILLS_SetUsedSkill113c(mem, pPlayer, resolvedSkill);
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(mem, resolvedSkill);
  const mode = nSkillId === 0 ? PLRMODE_ATTACK1 : PLRMODE_CAST;
  return PLAYER_StartModeAtCoords113c(
    mem,
    pGame,
    pPlayer,
    mode,
    nX,
    nY,
    bShift,
    callees,
  );
}

/**
 * @va D2Game:0x6FCEE620
 * Execute `pSkill` targeting `pTargetUnit`.
 */
export function C2S_ExecuteSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pSkill: number,
  pTargetUnit: number,
  bShift: number,
  callees?: C2SPacketCallees113c,
): number {
  if (pPlayer === 0 || pSkill === 0 || pTargetUnit === 0) return 0;
  const resolvedSkill = C2S_ResolveDualWieldThrowSkill113c(mem, pPlayer, pSkill);
  const pRoom = UNITS_GetRoom113c(mem, pPlayer);
  if (pRoom !== 0 && DUNGEON_CheckRoomIsTown113c(mem, pRoom)) {
    const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(mem, resolvedSkill);
    if (pSkillsTxt !== 0) {
      const nFlags2 = mem.get(pSkillsTxt, D2SkillsTxt.nFlags2);
      const nSkillId = SKILLS_GetSkillIdFromSkill113c(mem, resolvedSkill);
      if (nSkillId > 0 && (nFlags2 & 0x20) === 0) {
        return 0;
      }
    }
  }
  SKILLS_SetUsedSkill113c(mem, pPlayer, resolvedSkill);
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(mem, resolvedSkill);
  const mode = nSkillId === 0 ? PLRMODE_ATTACK1 : PLRMODE_CAST;
  return PLAYER_StartModeOnUnit113c(
    mem,
    pGame,
    pPlayer,
    pTargetUnit,
    mode,
    0,
    0,
    bShift,
    callees,
  );
}

function getPlayerLeftSkillPtr113c(mem: Memory113c, pPlayer: number): number {
  const pSkills = mem.get(pPlayer, D2UnitStrc.pSkills);
  if (pSkills === 0) return 0;
  return mem.get(pSkills, D2SkillListStrc.pLeftSkill);
}

function getPlayerRightSkillPtr113c(mem: Memory113c, pPlayer: number): number {
  const pSkills = mem.get(pPlayer, D2UnitStrc.pSkills);
  if (pSkills === 0) return 0;
  return mem.get(pSkills, D2SkillListStrc.pRightSkill);
}

/**
 * @va D2Game:0x6FCEE5A0
 * Opcode `0x05`: Left skill on location `(u16 nX, u16 nY)`. Returns `5`.
 */
export function C2S_Packet05_LeftSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateLocationPacket113c(mem, pGame, pPlayer, pPacket);
  if (unpacked.ok !== 0) {
    const pLeftSkill = getPlayerLeftSkillPtr113c(mem, pPlayer);
    C2S_ExecuteSkillOnLocation113c(
      mem,
      pGame,
      pPlayer,
      pLeftSkill,
      unpacked.nX,
      unpacked.nY,
      1,
      callees,
    );
  }
  return 5;
}

/**
 * @va D2Game:0x6FCEE9D0
 * Opcode `0x06`: Left skill on target unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet06_LeftSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    const pLeftSkill = getPlayerLeftSkillPtr113c(mem, pPlayer);
    C2S_ExecuteSkillOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pLeftSkill,
      unpacked.pTargetUnit,
      0,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEE950
 * Opcode `0x07`: Shift + Left skill on target unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet07_ShiftLeftSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    const pLeftSkill = getPlayerLeftSkillPtr113c(mem, pPlayer);
    C2S_ExecuteSkillOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pLeftSkill,
      unpacked.pTargetUnit,
      1,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEE8F0
 * Opcode `0x08`: Repeat left skill on location `(u16 nX, u16 nY)`. Returns `5`.
 */
export function C2S_Packet08_RepeatLeftSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateLocationPacket113c(mem, pGame, pPlayer, pPacket);
  if (unpacked.ok !== 0) {
    let pSkill = SKILLS_GetUsedSkill113c(mem, pPlayer);
    if (pSkill === 0) {
      pSkill = getPlayerLeftSkillPtr113c(mem, pPlayer);
    }
    C2S_ExecuteSkillOnLocation113c(
      mem,
      pGame,
      pPlayer,
      pSkill,
      unpacked.nX,
      unpacked.nY,
      1,
      callees,
    );
  }
  return 5;
}

/**
 * @va D2Game:0x6FCEEB70
 * Opcode `0x09`: Repeat left skill on unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet09_RepeatLeftSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    let pSkill = SKILLS_GetUsedSkill113c(mem, pPlayer);
    if (pSkill === 0) {
      pSkill = getPlayerLeftSkillPtr113c(mem, pPlayer);
    }
    C2S_ExecuteSkillOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pSkill,
      unpacked.pTargetUnit,
      0,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEEB10
 * Opcode `0x0A`: Repeat Shift + Left skill on unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    let pSkill = SKILLS_GetUsedSkill113c(mem, pPlayer);
    if (pSkill === 0) {
      pSkill = getPlayerLeftSkillPtr113c(mem, pPlayer);
    }
    C2S_ExecuteSkillOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pSkill,
      unpacked.pTargetUnit,
      1,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEE520
 * Opcode `0x0C`: Right skill on location `(u16 nX, u16 nY)`. Returns `5`.
 */
export function C2S_Packet0C_RightSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateLocationPacket113c(mem, pGame, pPlayer, pPacket);
  if (unpacked.ok !== 0) {
    const pRightSkill = getPlayerRightSkillPtr113c(mem, pPlayer);
    C2S_ExecuteSkillOnLocation113c(
      mem,
      pGame,
      pPlayer,
      pRightSkill,
      unpacked.nX,
      unpacked.nY,
      1,
      callees,
    );
  }
  return 5;
}

/**
 * @va D2Game:0x6FCEE870
 * Opcode `0x0D`: Right skill on target unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet0D_RightSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    const pRightSkill = getPlayerRightSkillPtr113c(mem, pPlayer);
    C2S_ExecuteSkillOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pRightSkill,
      unpacked.pTargetUnit,
      0,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEE7F0
 * Opcode `0x0E`: Shift + Right skill on target unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet0E_ShiftRightSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    const pRightSkill = getPlayerRightSkillPtr113c(mem, pPlayer);
    C2S_ExecuteSkillOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pRightSkill,
      unpacked.pTargetUnit,
      1,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEE790
 * Opcode `0x0F`: Repeat right skill on location `(u16 nX, u16 nY)`. Returns `5`.
 */
export function C2S_Packet0F_RepeatRightSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateLocationPacket113c(mem, pGame, pPlayer, pPacket);
  if (unpacked.ok !== 0) {
    let pSkill = SKILLS_GetUsedSkill113c(mem, pPlayer);
    if (pSkill === 0) {
      pSkill = getPlayerRightSkillPtr113c(mem, pPlayer);
    }
    C2S_ExecuteSkillOnLocation113c(
      mem,
      pGame,
      pPlayer,
      pSkill,
      unpacked.nX,
      unpacked.nY,
      1,
      callees,
    );
  }
  return 5;
}

/**
 * @va D2Game:0x6FCEEAB0
 * Opcode `0x10`: Repeat right skill on unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet10_RepeatRightSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    let pSkill = SKILLS_GetUsedSkill113c(mem, pPlayer);
    if (pSkill === 0) {
      pSkill = getPlayerRightSkillPtr113c(mem, pPlayer);
    }
    C2S_ExecuteSkillOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pSkill,
      unpacked.pTargetUnit,
      0,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEEA50
 * Opcode `0x11`: Repeat Shift + Right skill on unit `(u32 dwUnitType, u32 dwUnitId)`. Returns `9`.
 */
export function C2S_Packet11_RepeatShiftRightSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  callees?: C2SPacketCallees113c,
): number {
  const unpacked = C2S_UnpackAndValidateUnitPacket113c(
    mem,
    pGame,
    pPlayer,
    pPacket,
    callees,
  );
  if (unpacked.ok !== 0) {
    let pSkill = SKILLS_GetUsedSkill113c(mem, pPlayer);
    if (pSkill === 0) {
      pSkill = getPlayerRightSkillPtr113c(mem, pPlayer);
    }
    C2S_ExecuteSkillOnUnit113c(
      mem,
      pGame,
      pPlayer,
      pSkill,
      unpacked.pTargetUnit,
      1,
      callees,
    );
  }
  return 9;
}

/**
 * @va D2Game:0x6FCEF480
 * Opcode `0x3C`: Select active Left or Right skill (`+0x01: u16 wSkillId`, `+0x04: u8 bLeft`,
 * `+0x05: i32 dwOwnerItemGuid`). Returns `9`.
 */
export function C2S_Packet3C_SelectSkill113c(
  mem: Memory113c,
  _pGame: number,
  pPlayer: number,
  pPacket: number,
): number {
  if (pPlayer === 0 || pPacket === 0) return 9;
  const wSkillId = mem.u16((pPacket + 1) >>> 0);
  const bLeft = mem.u8((pPacket + 4) >>> 0);
  const dwItemId = mem.u32((pPacket + 5) >>> 0) | 0;

  const pSkill = SKILLS_GetSkillById113c(mem, pPlayer, wSkillId, dwItemId);
  if (pSkill !== 0) {
    const pSkills = mem.get(pPlayer, D2UnitStrc.pSkills);
    if (pSkills !== 0) {
      if (bLeft !== 0) {
        mem.set(pSkills, D2SkillListStrc.pLeftSkill, pSkill >>> 0);
      } else {
        mem.set(pSkills, D2SkillListStrc.pRightSkill, pSkill >>> 0);
      }
    }
  }
  return 9;
}

/**
 * @va D2Game:0x6FCF0790
 * Opcode `0x5F`: Update player position heartbeat (`+0x01: u16 nX`, `+0x03: u16 nY`). Returns `5`.
 */
export function C2S_Packet5F_UpdatePlayerPos113c(
  mem: Memory113c,
  _pGame: number,
  pPlayer: number,
  pPacket: number,
): number {
  if (pPlayer === 0 || pPacket === 0) return 5;
  const nX = mem.u16((pPacket + 1) >>> 0);
  const nY = mem.u16((pPacket + 3) >>> 0);
  if (nX !== 0 && nY !== 0 && C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, nX, nY, 100) === 0) {
    const pPath = mem.get(pPlayer, D2UnitStrc.pPath);
    if (pPath !== 0 && mem.get(pPlayer, D2UnitStrc.dwAnimMode) === PLRMODE_NEUTRAL) {
      mem.set(pPath, D2DynamicPathStrc.wTargetX, nX & 0xffff);
      mem.set(pPath, D2DynamicPathStrc.wTargetY, nY & 0xffff);
    }
  }
  return 5;
}

/**
 * Clean-room 1:1 binary port of D2Game `0x6FCEC550` (`C2S_DispatchPacket`).
 * Validates opcode bounds (`0x00..0x66`), packet length against `0x6FD1A078`,
 * client state (`dwClientState` at `pClient + 0x04`: `4` = in-game), and dispatches
 * to the per-opcode handler.
 *
 * Returns:
 * - `3` if packet is invalid/truncated or opcode has no handler (`handlerVa === 0`)
 * - `2` if client state rejects the packet
 * - `1` (or bytes consumed `> 0`) on successful dispatch
 *
 * (Replacement export for the K0 stand-in in `replay-kernel-113c.ts`).
 */
export function C2S_DispatchPacketMem113c(
  mem: Memory113c,
  pGame: number,
  pClient: number,
  pPacket: number,
  nPacketLen: number,
  callees?: C2SPacketCallees113c,
): number {
  if (pPacket === 0 || (nPacketLen | 0) <= 0) {
    return 3;
  }
  const opcode = mem.u8(pPacket >>> 0);

  if (opcode > 0x66) {
    return 3;
  }

  const entry = C2S_PACKET_TABLE_6FD1A078_113C[opcode];
  if (entry === undefined || entry.handlerVa === 0) {
    return 3;
  }

  const expectedSize = entry.packetSize;
  if (expectedSize !== -1) {
    if (expectedSize <= 0 || (nPacketLen | 0) < expectedSize) {
      return 3;
    }
  }

  let pPlayer = 0;
  if (pClient !== 0) {
    const dwClientState = mem.u32((pClient + D2ClientStrcOffsets.dwClientState) >>> 0);
    if (dwClientState !== 4) {
      return 2;
    }
    pPlayer = mem.u32((pClient + D2ClientStrcOffsets.pPlayer) >>> 0);
  }
  if (pPlayer === 0) {
    return 2;
  }

  switch (opcode) {
    case 0x01:
      return C2S_Packet01_WalkToLocation113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x02:
      return C2S_Packet02_WalkToUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x03:
      return C2S_Packet03_RunToLocation113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x04:
      return C2S_Packet04_RunToUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x05:
      return C2S_Packet05_LeftSkillOnLocation113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x06:
      return C2S_Packet06_LeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x07:
      return C2S_Packet07_ShiftLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x08:
      return C2S_Packet08_RepeatLeftSkillOnLocation113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x09:
      return C2S_Packet09_RepeatLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x0a:
      return C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x0b:
      return C2S_Packet0B_Noop1Byte113c();
    case 0x0c:
      return C2S_Packet0C_RightSkillOnLocation113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x0d:
      return C2S_Packet0D_RightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x0e:
      return C2S_Packet0E_ShiftRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x0f:
      return C2S_Packet0F_RepeatRightSkillOnLocation113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x10:
      return C2S_Packet10_RepeatRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x11:
      return C2S_Packet11_RepeatShiftRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, callees);
    case 0x3c:
      return C2S_Packet3C_SelectSkill113c(mem, pGame, pPlayer, pPacket);
    case 0x5f:
      return C2S_Packet5F_UpdatePlayerPos113c(mem, pGame, pPlayer, pPacket);
    default:
      if (callees !== undefined && callees.onUnhandledOpcode !== undefined) {
        return callees.onUnhandledOpcode(mem, pGame, pPlayer, opcode, pPacket, nPacketLen);
      }
      return expectedSize > 0 ? expectedSize : 1;
  }
}
