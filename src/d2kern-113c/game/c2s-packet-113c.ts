/**
 * @file src/d2kern-113c/game/c2s-packet-113c.ts
 * Clean-room 1:1 binary port of the D2Game.dll v1.13c 103-entry `0x6FD1A078` Client-to-Host (C2S)
 * packet handler table (`0x00..0x66`, 8 bytes per entry: `{ handlerVa, flag }`) and the player
 * movement/skill opcode handlers (`0x01..0x11`, `0x3C`, `0x5F`).
 * Table-driven `0x6FCEC550` dispatch across all 91 handlers lives in `c2s-dispatch-113c.ts`.
 *
 * Operates strictly on `Memory113c` virtual pointers (`pGame`, `pClient`, `pPlayer`, `pPacket`).
 * Zero JS Maps, zero array sorting, zero permissive nullish fallbacks.
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts';
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts';
import {
  DUNGEON_GetCollisionGridFromRoomFast113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon.ts';
import { D2CommonAssertError } from '../common/inline-helpers.ts';
import { ITEMS_GetItemTypeFromItem113c } from '../common/items.ts';
import {
  INVENTORY_GetItemFromBodyLocMemPort113c,
  ITEMS_CheckItemTypeIdMemPort113c,
  SKILLS_SetUsedSkillMemPort113c,
} from '../common/k0-d2common-memports.ts';
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_SetTargetUnit113c,
} from '../common/path.ts';
import {
  PLAYER_StoreLeftSkill113c,
  PLAYER_StoreRightSkill113c,
  UNITS_GetLeftSkill113c,
  UNITS_GetRightSkill113c,
} from '../common/quest-record.ts';
import {
  SKILLS_EvaluateSkillLevel113c,
  SKILLS_GetParam4113c,
  SKILLS_GetSkillById113c,
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillNumTargetsOrShots113c,
  SKILLS_GetSkillSlotIndex113c,
  SKILLS_GetSkillsTxtFromSkill113c,
  SKILLS_GetSkillUseFailReason113c,
  SKILLS_GetUsedSkill113c,
  SKILLS_SetParam4113c,
  UNITS_GetUnitDistanceToCoordinates113c,
} from '../common/skills.ts';
import {
  STATES_CheckState113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts';
import {
  UNIT_TILE,
  UNITS_CanUnitMeleeAttackTarget113c,
  UNITS_GetRoom113c,
  UNITS_IsUnitMovingBool113c,
} from '../common/unit.ts';
import { UNITS_SetTargetUnitForDynamicUnit113c } from '../common/waypoint.ts';
import {
  D2ActiveRoomStrc,
  D2DynamicPathStrc,
  D2GameStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts';
import type { Memory113c, SparseMemory113c } from '../mem/sparse-memory.ts';
import { PLAYER_SetPlayerData150ParamsExport113c } from '../tables/datatbls-113c.ts';
import { hitD2GameVa113c } from '../va-trace-113c.ts';
import { SKILLS_StartUsedSkill113c } from './a1c-post150-f786-f1040-113c.ts';
import { SUNITDMG_FreeAttackerCombatList113c } from './ai-fallen-113c.ts';
import {
  PLAYER_ScheduleAttackActionFrameEvents113c,
  PLAYER_StartBlockMode113c,
} from './k2-real-s2c-combat-113c.ts';
import { SUNIT_GetServerUnit113c } from './game-strc.ts';
import {
  PLAYER_StartCastSkillAtCoords113c,
  SKILLS_AssignHandSkillAndSyncAura113c,
} from './k2-gap-melee-dot-113c.ts';
import {
  NET_SendEventMessage5A_Type0E_113c,
  NET_SendReassignUnitPacket15_113c,
} from './k2-combat-core-w1-113c.ts';
import { ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c } from './k2-laneI-0x6fc3-w1-113c.ts';
import { SUNIT_GetOwnerUnit113c } from './k2-sunit-spawn-w1-113c.ts';
import { MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c } from './k2-w2b3-113c.ts';
import { S2C_QueueLocationPacket11_6FCABF80_113c } from './k2-w2b4-113c.ts';
import { SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c } from './k2-w2b8-113c.ts';
import { SKILLS_TestPathReachableToCoords_6FCED790_113c } from './k2-w5b6-113c.ts';
import { PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c } from './k2-w11b1-113c.ts';
import {
  PLAYER_HandleDeathCorpseAndSave_6FC99730_113c,
  PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c,
} from './k2-w16b1-113c.ts';
import {
  MONSTER_ClearModeEvents113c,
  MONSTER_RegisterContinuousModeEvent113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts';
import {
  ITEMS_CheckNotBrokenOrUnequipping113c,
  UNITS_CanDualWield113c,
  applyPlayerPacket113c,
} from './replay-kernel-113c.ts';
import {
  SUNIT_InitUnitAnimData113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts';
import {
  AITHINK_CanPlayerStartSkillOrCast113c,
  AITHINK_CanPlayerSwitchToMode113c,
  PLAYER_SetNeutralOrTownNeutralMode113c,
  PLAYER_SetPathTargetCoordsAndWalk113c,
  PLAYER_StartWalkOrRunMode113c,
} from './town-runtime-gap-113c.ts';

const D2GAME_IAT_SGPT_DATATABLES_VA = 0x6fd1829c;
const D2COMMON_SGPT_DATATABLES_VA = 0x6fde9e1c;
const D2GAME_IAT_GDW_BITMASKS_VA = 0x6fd18be0;

/** Dedicated virtual scratch frame (`0x7FF66000..0x7FF66040`) for C2S stack out-pointers. */
const C2S_STACK_SCRATCH_BASE = 0x7ff66000;
let c2sScratchDepth = 0;

function getSgptDataTablesPtr113c(mem: Memory113c): number {
  const iatPtr = mem.u32(D2GAME_IAT_SGPT_DATATABLES_VA);
  if (iatPtr !== 0) {
    const tbl = mem.u32(iatPtr);
    if (tbl !== 0) return tbl;
  }
  return mem.u32(D2COMMON_SGPT_DATATABLES_VA);
}

function getGdwBitMaskByte113c(mem: Memory113c, dwordOffset: number): number {
  const pMasks = mem.u32(D2GAME_IAT_GDW_BITMASKS_VA);
  if (pMasks !== 0) {
    return mem.u8((pMasks + dwordOffset) >>> 0);
  }
  const bitIndex = dwordOffset >>> 2;
  return bitIndex < 8 ? (1 << bitIndex) & 0xff : 0;
}

function getUnitPosXByType113c(mem: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0;
  const uType = mem.u32(pUnit >>> 0);
  const pPath = mem.u32((pUnit + 0x2c) >>> 0);
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return pPath !== 0 ? mem.u32((pPath + 0x0c) >>> 0) : 0;
  }
  return pPath !== 0 ? PATH_GetPosX113c(mem, pPath) : 0;
}

function getUnitPosYByType113c(mem: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 0;
  const uType = mem.u32(pUnit >>> 0);
  const pPath = mem.u32((pUnit + 0x2c) >>> 0);
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    return pPath !== 0 ? mem.u32((pPath + 0x10) >>> 0) : 0;
  }
  return pPath !== 0 ? PATH_GetPosY113c(mem, pPath) : 0;
}

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

/**
 * `D2PacketTableStrc` entry in `D2Game.dll:0x6FD1A078` (`8` bytes per opcode `0x00..0x66`):
 * `+0x00` `pfnHandler` (`handlerVa`), `+0x04` `u32Flag` (`flag`, `0 | 1`, unreferenced in 1.13c).
 */
export interface D2C2SPacketTableEntry113c {
  readonly opcode: number;
  readonly handlerVa: number;
  readonly flag: 0 | 1;
}

/**
 * Exact 103-entry (`0x00..0x66`, `8` bytes/entry = `0x338` bytes) C2S packet handler table
 * at `D2Game.dll:0x6FD1A078` (`.rdata` file offset `0x0FA078`, 91 non-null handlers + 12 NULL slots).
 * C2S framing byte lengths live separately in `D2Net.dll:0x6FBFABD8` (`C2S_PACKET_SIZES`).
 */
export const C2S_PACKET_TABLE_6FD1A078_113C: readonly D2C2SPacketTableEntry113c[] = [
  { opcode: 0x00, handlerVa: 0x00000000, flag: 0 },
  { opcode: 0x01, handlerVa: 0x6fcee0d0, flag: 0 },
  { opcode: 0x02, handlerVa: 0x6fcee090, flag: 0 },
  { opcode: 0x03, handlerVa: 0x6fcee040, flag: 0 },
  { opcode: 0x04, handlerVa: 0x6fcee000, flag: 0 },
  { opcode: 0x05, handlerVa: 0x6fcee5a0, flag: 0 },
  { opcode: 0x06, handlerVa: 0x6fcee9d0, flag: 0 },
  { opcode: 0x07, handlerVa: 0x6fcee950, flag: 0 },
  { opcode: 0x08, handlerVa: 0x6fcee8f0, flag: 0 },
  { opcode: 0x09, handlerVa: 0x6fceeb70, flag: 0 },
  { opcode: 0x0a, handlerVa: 0x6fceeb10, flag: 0 },
  { opcode: 0x0b, handlerVa: 0x6fceb5b0, flag: 0 },
  { opcode: 0x0c, handlerVa: 0x6fcee520, flag: 0 },
  { opcode: 0x0d, handlerVa: 0x6fcee870, flag: 0 },
  { opcode: 0x0e, handlerVa: 0x6fcee7f0, flag: 0 },
  { opcode: 0x0f, handlerVa: 0x6fcee790, flag: 0 },
  { opcode: 0x10, handlerVa: 0x6fceeab0, flag: 0 },
  { opcode: 0x11, handlerVa: 0x6fceea50, flag: 0 },
  { opcode: 0x12, handlerVa: 0x6fceb590, flag: 0 },
  { opcode: 0x13, handlerVa: 0x6fcf0910, flag: 1 },
  { opcode: 0x14, handlerVa: 0x6fcf00a0, flag: 0 },
  { opcode: 0x15, handlerVa: 0x6fcedbb0, flag: 0 },
  { opcode: 0x16, handlerVa: 0x6fcf08b0, flag: 1 },
  { opcode: 0x17, handlerVa: 0x6fcef380, flag: 1 },
  { opcode: 0x18, handlerVa: 0x6fcef0e0, flag: 1 },
  { opcode: 0x19, handlerVa: 0x6fcf1370, flag: 1 },
  { opcode: 0x1a, handlerVa: 0x6fceee60, flag: 1 },
  { opcode: 0x1b, handlerVa: 0x6fcef2f0, flag: 1 },
  { opcode: 0x1c, handlerVa: 0x6fcf12e0, flag: 1 },
  { opcode: 0x1d, handlerVa: 0x6fcf1200, flag: 1 },
  { opcode: 0x1e, handlerVa: 0x6fcf1140, flag: 1 },
  { opcode: 0x1f, handlerVa: 0x6fcf1010, flag: 1 },
  { opcode: 0x20, handlerVa: 0x6fcef730, flag: 1 },
  { opcode: 0x21, handlerVa: 0x6fcee4b0, flag: 1 },
  { opcode: 0x22, handlerVa: 0x6fced4f0, flag: 1 },
  { opcode: 0x23, handlerVa: 0x6fceec70, flag: 1 },
  { opcode: 0x24, handlerVa: 0x6fcf0f80, flag: 1 },
  { opcode: 0x25, handlerVa: 0x6fceede0, flag: 1 },
  { opcode: 0x26, handlerVa: 0x6fcef5b0, flag: 1 },
  { opcode: 0x27, handlerVa: 0x6fcef6b0, flag: 1 },
  { opcode: 0x28, handlerVa: 0x6fceebd0, flag: 1 },
  { opcode: 0x29, handlerVa: 0x6fcedb30, flag: 1 },
  { opcode: 0x2a, handlerVa: 0x6fcef270, flag: 1 },
  { opcode: 0x2b, handlerVa: 0x00000000, flag: 0 },
  { opcode: 0x2c, handlerVa: 0x6fceb1e0, flag: 0 },
  { opcode: 0x2d, handlerVa: 0x6fcebda0, flag: 0 },
  { opcode: 0x2e, handlerVa: 0x6fceb1d0, flag: 1 },
  { opcode: 0x2f, handlerVa: 0x6fcee440, flag: 1 },
  { opcode: 0x30, handlerVa: 0x6fced480, flag: 0 },
  { opcode: 0x31, handlerVa: 0x6fcec9d0, flag: 0 },
  { opcode: 0x32, handlerVa: 0x6fcef220, flag: 1 },
  { opcode: 0x33, handlerVa: 0x6fcef570, flag: 1 },
  { opcode: 0x34, handlerVa: 0x6fcef070, flag: 1 },
  { opcode: 0x35, handlerVa: 0x6fcef0a0, flag: 1 },
  { opcode: 0x36, handlerVa: 0x6fcf0060, flag: 1 },
  { opcode: 0x37, handlerVa: 0x6fceefe0, flag: 1 },
  { opcode: 0x38, handlerVa: 0x6fcefb30, flag: 1 },
  { opcode: 0x39, handlerVa: 0x6fceb560, flag: 0 },
  { opcode: 0x3a, handlerVa: 0x6fcec960, flag: 0 },
  { opcode: 0x3b, handlerVa: 0x6fceda20, flag: 0 },
  { opcode: 0x3c, handlerVa: 0x6fcef480, flag: 0 },
  { opcode: 0x3d, handlerVa: 0x6fced440, flag: 1 },
  { opcode: 0x3e, handlerVa: 0x6fced8d0, flag: 0 },
  { opcode: 0x3f, handlerVa: 0x6fcebd50, flag: 0 },
  { opcode: 0x40, handlerVa: 0x6fcebd30, flag: 0 },
  { opcode: 0x41, handlerVa: 0x6fcf14b0, flag: 1 },
  { opcode: 0x42, handlerVa: 0x6fceb1c0, flag: 1 },
  { opcode: 0x43, handlerVa: 0x6fceb1b0, flag: 1 },
  { opcode: 0x44, handlerVa: 0x6fcf0e90, flag: 1 },
  { opcode: 0x45, handlerVa: 0x6fceb550, flag: 1 },
  { opcode: 0x46, handlerVa: 0x6fced3d0, flag: 0 },
  { opcode: 0x47, handlerVa: 0x6fced360, flag: 0 },
  { opcode: 0x48, handlerVa: 0x6fceb4e0, flag: 1 },
  { opcode: 0x49, handlerVa: 0x6fcf0d30, flag: 0 },
  { opcode: 0x4a, handlerVa: 0x00000000, flag: 1 },
  { opcode: 0x4b, handlerVa: 0x6fcec6e0, flag: 0 },
  { opcode: 0x4c, handlerVa: 0x6fcef400, flag: 1 },
  { opcode: 0x4d, handlerVa: 0x6fceb4a0, flag: 0 },
  { opcode: 0x4e, handlerVa: 0x00000000, flag: 1 },
  { opcode: 0x4f, handlerVa: 0x6fcf1470, flag: 1 },
  { opcode: 0x50, handlerVa: 0x6fceef40, flag: 1 },
  { opcode: 0x51, handlerVa: 0x6fcebc70, flag: 0 },
  { opcode: 0x52, handlerVa: 0x6fceb490, flag: 1 },
  { opcode: 0x53, handlerVa: 0x6fceb450, flag: 0 },
  { opcode: 0x54, handlerVa: 0x6fceb420, flag: 0 },
  { opcode: 0x55, handlerVa: 0x00000000, flag: 1 },
  { opcode: 0x56, handlerVa: 0x00000000, flag: 1 },
  { opcode: 0x57, handlerVa: 0x00000000, flag: 1 },
  { opcode: 0x58, handlerVa: 0x6fceb3d0, flag: 0 },
  { opcode: 0x59, handlerVa: 0x6fceff30, flag: 0 },
  { opcode: 0x5a, handlerVa: 0x00000000, flag: 1 },
  { opcode: 0x5b, handlerVa: 0x00000000, flag: 1 },
  { opcode: 0x5c, handlerVa: 0x00000000, flag: 1 },
  { opcode: 0x5d, handlerVa: 0x6fcec8e0, flag: 0 },
  { opcode: 0x5e, handlerVa: 0x6fcec860, flag: 0 },
  { opcode: 0x5f, handlerVa: 0x6fcf0790, flag: 0 },
  { opcode: 0x60, handlerVa: 0x6fcef510, flag: 1 },
  { opcode: 0x61, handlerVa: 0x6fcf0bc0, flag: 1 },
  { opcode: 0x62, handlerVa: 0x6fcefb90, flag: 1 },
  { opcode: 0x63, handlerVa: 0x6fcf0950, flag: 1 },
  { opcode: 0x64, handlerVa: 0x00000000, flag: 0 },
  { opcode: 0x65, handlerVa: 0x00000000, flag: 0 },
  { opcode: 0x66, handlerVa: 0x6fceb190, flag: 0 },
] as const;

/**
 * Injectable hooks for `c2s-packet-113c.ts` to customize active unit lookup or
 * player path/mode execution while defaulting to pure `Memory113c` operations.
 */
export interface C2SPacketCallees113c {
  /** Optional override for `SUNIT_GetServerUnit` (`0x6FD003A0`). */
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
  /** Optional post-gate hook for walk/run mode transitions (`2`/`3`/`6`/`19`). */
  onStartWalkOrRun?: (
    mem: Memory113c,
    pGame: number,
    pPlayer: number,
    nPlrMode: number,
    nX: number,
    nY: number,
    pTargetUnit: number,
  ) => void;
  /** Optional post-gate hook for `0x6FC987C0` attack/cast-on-unit transitions (`7`,`8`,`10..16`,`18`). */
  onStartAttackOnUnit?: (
    mem: Memory113c,
    pGame: number,
    pPlayer: number,
    pTargetUnit: number,
    nPlrMode: number,
  ) => void;
  /** Optional callback after a player mode transition completes to sync runtime mirrors. */
  onAfterModeStarted?: (mem: Memory113c, pPlayer: number) => void;
}

function resolveTargetUnitFromMemory113c(
  mem: Memory113c,
  pGame: number,
  dwUnitType: number,
  dwUnitId: number,
  pPlayer: number,
  callees?: C2SPacketCallees113c,
): number {
  if (callees !== undefined && callees.findServerUnit !== undefined) {
    return callees.findServerUnit(mem, pGame, dwUnitType, dwUnitId, pPlayer) >>> 0;
  }
  const typeU = dwUnitType >>> 0;
  const idU = dwUnitId >>> 0;
  if (typeU >= 6) return 0;

  if (pGame !== 0) {
    const found = SUNIT_GetServerUnit113c(mem, pGame, typeU, idU) >>> 0;
    if (found !== 0) return found;
    if (typeU === UNIT_TILE) {
      let pTile = mem.get(pGame, D2GameStrc.pTileList);
      let guard = 0;
      while (pTile !== 0 && guard < 512) {
        if (
          mem.get(pTile, D2UnitStrc.dwUnitType) === typeU &&
          mem.get(pTile, D2UnitStrc.dwUnitId) === idU
        ) {
          return pTile;
        }
        pTile = mem.get(pTile, D2UnitStrc.pGameHashNext);
        guard = (guard + 1) | 0;
      }
    }
  }

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
 * 1:1 binary port of `D2Game.dll:0x6FC98550` (`PLAYER_StartModeAtCoords`, 180 bytes):
 * 1. Gates via `AITHINK_CanPlayerSwitchToMode113c` (`0x6FC98340`).
 * 2. When `bForce == 0`, gates via `AITHINK_CanPlayerStartSkillOrCast113c` (`0x6FC97FA0`).
 * 3. Validates `0x6FD1A3F8[nPlrMode].coords` (`[ebp*8 + 0x6FD1A3F8]`).
 * 4. Sets `SKILLS_SetUsedSkill(pPlayer, pSkill)` (`D2Common.#11103`) when `pSkill != 0`.
 * 5. Dispatches the per-mode start routine (`0x6FC982F0`, `0x6FC98710`, `0x6FC98150`,
 *    `0x6FC981C0`, `0x6FC98840`, `0x6FC99730`).
 */
export function PLAYER_StartModeAtCoords113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  nPlrMode: number,
  nX: number,
  nY: number,
  bForce = 0,
  calleesOrSkill?: C2SPacketCallees113c | number,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FC98550);
  if (pPlayer === 0 || pGame === 0) return 0;

  let pSkill = 0;
  let callees: C2SPacketCallees113c | undefined = calleesArg;
  if (typeof calleesOrSkill === 'number') {
    pSkill = calleesOrSkill >>> 0;
  } else if (calleesOrSkill !== undefined) {
    callees = calleesOrSkill;
  }

  if (callees !== undefined && callees.startPlayerModeAtCoords !== undefined) {
    return callees.startPlayerModeAtCoords(mem, pGame, pPlayer, nPlrMode, nX, nY, bForce);
  }

  const mode = nPlrMode | 0;
  if (mode <= 0 || mode > 19) {
    return 0;
  }
  if (AITHINK_CanPlayerSwitchToMode113c(mem, pPlayer, pGame, mode) === 0) {
    return 0;
  }
  if ((bForce | 0) === 0) {
    if (AITHINK_CanPlayerStartSkillOrCast113c(mem, pPlayer, pGame, mode, 1, pSkill, () => {}) === 0) {
      return 0;
    }
  }
  if (pSkill !== 0) {
    SKILLS_SetUsedSkillMemPort113c(mem, pPlayer, pSkill);
  }

  const pPath = mem.get(pPlayer, D2UnitStrc.pPath);
  const pRoom = UNITS_GetRoom113c(mem, pPlayer);
  const hasHydratedPathGrid =
    pPath !== 0 &&
    mem.get(pPath, D2DynamicPathStrc.pUnit) === (pPlayer >>> 0) &&
    pRoom !== 0 &&
    DUNGEON_GetCollisionGridFromRoomFast113c(mem, pRoom) !== 0;

  switch (mode) {
    case 1:
    case 5:
      PLAYER_SetNeutralOrTownNeutralMode113c(mem, pGame, pPlayer, mode, nX | 0, nY | 0);
      callees?.onAfterModeStarted?.(mem, pPlayer);
      return 1;
    case 2:
    case 3:
    case 6:
    case 19:
      if (callees?.onStartWalkOrRun !== undefined) {
        callees.onStartWalkOrRun(mem, pGame, pPlayer, mode, nX | 0, nY | 0, 0);
      } else if (hasHydratedPathGrid) {
        PLAYER_SetPathTargetCoordsAndWalk113c(mem, pGame, pPlayer, mode, nX | 0, nY | 0);
      } else {
        if (pPath !== 0) {
          mem.set(pPath, D2DynamicPathStrc.wTargetX, (nX | 0) & 0xffff);
          mem.set(pPath, D2DynamicPathStrc.wTargetY, (nY | 0) & 0xffff);
          mem.set(pPath, D2DynamicPathStrc.pTargetUnit, 0);
        }
        mem.set(pPlayer, D2UnitStrc.dwAnimMode, mode >>> 0);
        if (mem.get(pGame, D2GameStrc.pTimer) !== 0) {
          MONSTER_RegisterContinuousModeEvent113c(mem, pGame, pPlayer);
        }
      }
      callees?.onAfterModeStarted?.(mem, pPlayer);
      return 1;
    case 4:
      if (mem.get(pGame, D2GameStrc.pTimer) !== 0) {
        MONMODE_SetUnitAnimModeAndRescheduleEvents_6FC98150_113c(
          mem,
          pGame,
          pPlayer,
          mode,
          nX | 0,
          nY | 0,
        );
      } else {
        mem.set(pPlayer, D2UnitStrc.dwAnimMode, mode >>> 0);
      }
      callees?.onAfterModeStarted?.(mem, pPlayer);
      return 1;
    case 9: {
      const ok = PLAYER_StartBlockMode113c(mem, pGame, pPlayer);
      callees?.onAfterModeStarted?.(mem, pPlayer);
      return ok;
    }
    case 17:
      PLAYER_HandleDeathCorpseAndSave_6FC99730_113c(
        mem as SparseMemory113c,
        pGame,
        pPlayer,
        mode,
        nX | 0,
        nY | 0,
      );
      callees?.onAfterModeStarted?.(mem, pPlayer);
      return 1;
    default:
      // Modes 7, 8, 10..16, 18 -> 0x6FC98840 (`PLAYER_StartCastSkillAtCoords113c`)
      if (mem.get(pGame, D2GameStrc.pTimer) !== 0 && getSgptDataTablesPtr113c(mem) !== 0) {
        PLAYER_StartCastSkillAtCoords113c(mem, pGame, pPlayer, mode, nX | 0, nY | 0);
      } else {
        if (pPath !== 0) {
          mem.set(pPath, D2DynamicPathStrc.wTargetX, (nX | 0) & 0xffff);
          mem.set(pPath, D2DynamicPathStrc.wTargetY, (nY | 0) & 0xffff);
          mem.set(pPath, D2DynamicPathStrc.pTargetUnit, 0);
        }
        mem.set(pPlayer, D2UnitStrc.dwAnimMode, mode >>> 0);
      }
      callees?.onAfterModeStarted?.(mem, pPlayer);
      return 1;
  }
}

/**
 * @va D2Game:0x6FC98430
 * 1:1 binary port of `D2Game.dll:0x6FC98430` (`PLAYER_StartModeOnUnit`):
 * Validates `AITHINK_CanPlayerSwitchToMode113c` + `AITHINK_CanPlayerStartSkillOrCast113c`,
 * zeroes `pPlayerData->dwField150 (+0x150)` and `dwField154 (+0x154)`, assigns `pUsedSkill`,
 * and dispatches `0x6FD1A3FC[nPlrMode]` (`0x6FC99E40`, `0x6FC98760`, `0x6FC987C0`).
 */
export function PLAYER_StartModeOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pTargetUnit: number,
  nPlrMode: number,
  nX = 0,
  nY = 0,
  bForce = 0,
  calleesOrSkill?: C2SPacketCallees113c | number,
  calleesArg?: C2SPacketCallees113c,
  dwTargetType?: number,
  dwTargetId?: number,
): number {
  hitD2GameVa113c(0x6FC98430);
  if (pGame === 0) {
    if (calleesArg === undefined && (typeof calleesOrSkill !== 'object' || calleesOrSkill === null)) {
      throw new D2CommonAssertError('0x6fd19ff9', 2100);
    }
    return 0;
  }

  let resolvedTarget = pTargetUnit >>> 0;
  if (resolvedTarget === 0 && dwTargetType !== undefined && dwTargetId !== undefined) {
    resolvedTarget = SUNIT_GetServerUnit113c(mem, pGame, dwTargetType >>> 0, dwTargetId >>> 0) >>> 0;
  }
  if (pPlayer === 0 || resolvedTarget === 0) return 0;

  let pSkill = 0;
  let callees: C2SPacketCallees113c | undefined = calleesArg;
  if (typeof calleesOrSkill === 'number') {
    pSkill = calleesOrSkill >>> 0;
  } else if (calleesOrSkill !== undefined) {
    callees = calleesOrSkill;
  }

  if (callees !== undefined && callees.startPlayerModeOnUnit !== undefined) {
    return callees.startPlayerModeOnUnit(
      mem,
      pGame,
      pPlayer,
      resolvedTarget,
      nPlrMode,
      nX,
      nY,
      bForce,
    );
  }

  const mode = nPlrMode | 0;
  if (mode < 0 || mode > 19) {
    return 0;
  }
  if (AITHINK_CanPlayerSwitchToMode113c(mem, pPlayer, pGame, mode) === 0) {
    return 0;
  }
  if ((bForce | 0) === 0) {
    if (AITHINK_CanPlayerStartSkillOrCast113c(mem, pPlayer, pGame, mode, 1, pSkill, () => {}) === 0) {
      return 0;
    }
  }

  if (mem.u32(pPlayer >>> 0) === 0) {
    const pPlrData = mem.u32((pPlayer + 0x14) >>> 0);
    if (pPlrData !== 0) {
      mem.setU32((pPlrData + 0x154) >>> 0, 0);
      mem.setU32((pPlrData + 0x150) >>> 0, 0);
    }
  }

  if (pSkill !== 0) {
    SKILLS_SetUsedSkillMemPort113c(mem, pPlayer, pSkill);
  }

  if (mode === 0) {
    PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c(
      mem as SparseMemory113c,
      pGame,
      pPlayer,
      0,
      resolvedTarget,
    );
    callees?.onAfterModeStarted?.(mem, pPlayer);
    return 1;
  }
  if (mode === 1 || mode === 4 || mode === 5 || mode === 9 || mode === 17) {
    return 0;
  }

  const pPath = mem.get(pPlayer, D2UnitStrc.pPath);
  const pRoom = UNITS_GetRoom113c(mem, pPlayer);
  const hasHydratedPathGrid =
    pPath !== 0 &&
    mem.get(pPath, D2DynamicPathStrc.pUnit) === (pPlayer >>> 0) &&
    pRoom !== 0 &&
    DUNGEON_GetCollisionGridFromRoomFast113c(mem, pRoom) !== 0;

  if (mode === 2 || mode === 3 || mode === 6 || mode === 19) {
    // 0x6FC98760 (`PLAYER_SetPathTargetUnitAndWalk`)
    if (callees?.onStartWalkOrRun !== undefined) {
      callees.onStartWalkOrRun(mem, pGame, pPlayer, mode, 0, 0, resolvedTarget);
    } else if (hasHydratedPathGrid) {
      PLAYER_ScheduleAttackActionFrameEvents113c(mem, pGame, pPlayer, -2, mode, resolvedTarget);
    } else {
      if (mode === 19 && mem.get(pPlayer, D2UnitStrc.dwAnimMode) === 19) {
        return 1;
      }
      if (pPath !== 0) {
        const targetX = getUnitPosXByType113c(mem, resolvedTarget);
        const targetY = getUnitPosYByType113c(mem, resolvedTarget);
        mem.set(pPath, D2DynamicPathStrc.wTargetX, targetX & 0xffff);
        mem.set(pPath, D2DynamicPathStrc.wTargetY, targetY & 0xffff);
        mem.set(pPath, D2DynamicPathStrc.pTargetUnit, resolvedTarget >>> 0);
      }
      mem.set(pPlayer, D2UnitStrc.dwAnimMode, mode >>> 0);
      if (mem.get(pGame, D2GameStrc.pTimer) !== 0) {
        MONSTER_RegisterContinuousModeEvent113c(mem, pGame, pPlayer);
      }
    }
    callees?.onAfterModeStarted?.(mem, pPlayer);
    return 1;
  }

  // Modes 7, 8, 10..16, 18 -> 0x6FC987C0 (`PLAYER_StartModeAttackWithTarget`)
  if (callees?.onStartAttackOnUnit !== undefined) {
    callees.onStartAttackOnUnit(mem, pGame, pPlayer, resolvedTarget, mode);
    callees.onAfterModeStarted?.(mem, pPlayer);
    return 1;
  }
  if (mem.get(pGame, D2GameStrc.pTimer) !== 0 && getSgptDataTablesPtr113c(mem) !== 0) {
    applyPlayerPacket113c(mem, pGame, pPlayer, mode, resolvedTarget);
  } else {
    hitD2GameVa113c(0x6fc987c0);
    if (pPath !== 0) {
      const targetX = getUnitPosXByType113c(mem, resolvedTarget);
      const targetY = getUnitPosYByType113c(mem, resolvedTarget);
      mem.set(pPath, D2DynamicPathStrc.wTargetX, targetX & 0xffff);
      mem.set(pPath, D2DynamicPathStrc.wTargetY, targetY & 0xffff);
      mem.set(pPath, D2DynamicPathStrc.pTargetUnit, resolvedTarget >>> 0);
    }
    mem.set(pPlayer, D2UnitStrc.dwAnimMode, mode >>> 0);
  }
  callees?.onAfterModeStarted?.(mem, pPlayer);
  return 1;
}

/**
 * @va D2Game:0x6FCEB1F0
 * 1:1 binary port of `D2Game.dll:0x6FCEB1F0` (`C2S_ResolveDualWieldSkill`, 237 bytes):
 * - Checks `SKILLS_GetSkillIdFromSkill(pSkill) == 0` (`D2Common.#10601`, Normal Attack `0`); if non-zero, returns `pSkill`.
 * - Inspects `BODYLOC_RARM` (`4`) and `BODYLOC_LARM` (`5`) via `D2Common.#11139`: each weapon must pass
 *   `ITEMS_CheckNotBrokenOrUnequipping` (`#11006`) and NOT have item type `0x26` (`#11088`).
 * - Both weapons must satisfy `ITEMS_CheckItemTypeId(..., 0x2D)` (`#10744`, Hand-to-Hand / Claw `45`).
 * - Alternates `SKILLS_GetParam4(pSkill)` (`#10631`) / `SKILLS_SetParam4(pSkill, ...)` (`#11031`):
 *   when `dwParam4 == 0`, resolves `SKILLS_GetSkillById(pPlayer, 5, -1)` (`Left Hand Swing`), sets
 *   `pSkill->dwParam4 = 5`, and returns `pLeftSwing`; otherwise sets `pSkill->dwParam4 = 0` and returns `pSkill`.
 */
export function C2S_ResolveDualWieldThrowSkill113c(
  mem: Memory113c,
  pPlayer: number,
  pSkill: number,
): number {
  hitD2GameVa113c(0x6FCEB1F0);
  if (pPlayer === 0 || pSkill === 0) return pSkill;
  const nSkillId = SKILLS_GetSkillIdFromSkill113c(mem, pSkill, 0x6fd1b188, 0x6d5);
  if (nSkillId !== 0) {
    return pSkill;
  }
  const pInventory = mem.get(pPlayer, D2UnitStrc.pInventory);
  if (pInventory === 0) {
    return pSkill;
  }

  let pRight = INVENTORY_GetItemFromBodyLocMemPort113c(mem, pInventory, 4);
  if (pRight !== 0) {
    if (
      ITEMS_CheckNotBrokenOrUnequipping113c(mem, pRight) === 0 ||
      ITEMS_GetItemTypeFromItem113c(mem, pRight) === 0x26
    ) {
      pRight = 0;
    }
  }

  let pLeft = INVENTORY_GetItemFromBodyLocMemPort113c(mem, pInventory, 5);
  if (pLeft !== 0) {
    if (
      ITEMS_CheckNotBrokenOrUnequipping113c(mem, pLeft) === 0 ||
      ITEMS_GetItemTypeFromItem113c(mem, pLeft) === 0x26
    ) {
      pLeft = 0;
    }
  }

  if (pRight === 0 || pLeft === 0) {
    return pSkill;
  }
  if (
    ITEMS_CheckItemTypeIdMemPort113c(mem, pRight, 0x2d) === 0 ||
    ITEMS_CheckItemTypeIdMemPort113c(mem, pLeft, 0x2d) === 0
  ) {
    return pSkill;
  }

  if (SKILLS_GetParam4113c(mem, pSkill) === 0) {
    const pLeftSwing = SKILLS_GetSkillById113c(mem, pPlayer, 5, -1);
    if (pLeftSwing === 0) {
      return pSkill;
    }
    SKILLS_SetParam4113c(mem, pSkill, 5);
    return pLeftSwing;
  }

  SKILLS_SetParam4113c(mem, pSkill, 0);
  return pSkill;
}

/**
 * @va D2Game:0x6FCEB5B0
 * 1:1 binary port of `D2Game.dll:0x6FCEB5B0` (15 bytes):
 * `eax = nPacketLen - 1; return eax === 0 ? 0 : 3` (`dec eax; neg eax; sbb eax, eax; and eax, 3`).
 */
export function C2S_Packet0B_Noop1Byte113c(
  memOrLen?: Memory113c | number,
  _pGame?: number,
  _pPlayer?: number,
  _pPacket?: number,
  nPacketLen = 1,
): number {
  hitD2GameVa113c(0x6FCEB5B0);
  const len = typeof memOrLen === 'number' ? memOrLen | 0 : nPacketLen | 0;
  return len === 1 ? 0 : 3;
}

/**
 * @va D2Game:0x6FCEB690
 * 1:1 binary port of `D2Game.dll:0x6FCEB690` (`C2S_CheckCoordDeltaExceeded`, 137 bytes):
 * Checks whether `|unitX - (nX & 0xFFFF)| > nMaxDelta` or `|unitY - (nY & 0xFFFF)| > nMaxDelta`.
 * Returns `1` if exceeded, `0` if within range.
 */
export function C2S_CheckCoordDeltaExceeded113c(
  mem: Memory113c,
  pUnit: number,
  nX: number,
  nY: number,
  nMaxDelta: number,
): number {
  hitD2GameVa113c(0x6FCEB690);
  if (pUnit === 0) return 1;
  const unitX = getUnitPosXByType113c(mem, pUnit) | 0;
  const unitY = getUnitPosYByType113c(mem, pUnit) | 0;
  let dx = (unitX - (nX & 0xffff)) | 0;
  if (dx < 0) dx = (-dx) | 0;
  if (dx > (nMaxDelta | 0)) {
    return 1;
  }
  let dy = (unitY - (nY & 0xffff)) | 0;
  if (dy < 0) dy = (-dy) | 0;
  return dy > (nMaxDelta | 0) ? 1 : 0;
}

export interface UnpackedLocationPacket113c {
  readonly ok: number;
  readonly rc: number;
  readonly nX: number;
  readonly nY: number;
}

/**
 * @va D2Game:0x6FCEBF50
 * 1:1 binary port of `D2Game.dll:0x6FCEBF50` (`C2S_UnpackAndValidateLocationPacket`, 213 bytes):
 * - Zeroes `*pOutX = 0`, `*pOutY = 0`.
 * - Requires `nPacketLen === 5` (else returns `3`).
 * - Requires `pPlayerData = UNITS_GetPlayerData(pPlayer) != 0` (`D2Common.#10920`, else returns `2`).
 * - Unpacks `wX = u16(pPacket + 1)`, `wY = u16(pPacket + 3)` and checks `C2S_CheckCoordDeltaExceeded(pPlayer, wX, wY, 0x32)` (`50`).
 * - If exceeded (`1`): when `(pGame->dwGameFrame (+0xA8) - u32(pPlayerData + 0x168)) > 0x19` (`25`),
 *   emits S2C `0x15` reassign packet (`0x6FCABF80`) to `pPlayerData->pClient (+0x9C)` with `bFlash = 1`, and returns `1`.
 * - If within `50` subtiles (`0`): writes `u32(pPlayerData + 0x168) = dwGameFrame`, `*pOutX = wX`, `*pOutY = wY`, and returns `0`.
 */
export function C2S_UnpackAndValidateLocationPacket113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen = 5,
  pOutX = 0,
  pOutY = 0,
): number {
  hitD2GameVa113c(0x6FCEBF50);
  if (pOutX !== 0) mem.setU16(pOutX >>> 0, 0);
  if (pOutY !== 0) mem.setU16(pOutY >>> 0, 0);
  if ((nPacketLen | 0) !== 5 || pPacket === 0) {
    return 3;
  }
  const pPlayerData = UNITS_GetPlayerData113c(mem, pPlayer);
  if (pPlayerData === 0) {
    return 2;
  }
  const wX = mem.u16((pPacket + 1) >>> 0);
  const wY = mem.u16((pPacket + 3) >>> 0);
  const deltaErr = C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, wX, wY, 0x32);
  const dwGameFrame = pGame !== 0 ? mem.u32((pGame + 0xa8) >>> 0) : 0;

  if (deltaErr !== 0) {
    const lastFrame = mem.u32((pPlayerData + 0x168) >>> 0);
    if (((dwGameFrame - lastFrame) | 0) > 0x19) {
      if (pPlayer !== 0 && mem.u32(pPlayer >>> 0) === 0) {
        const pData2 = UNITS_GetPlayerData113c(mem, pPlayer);
        const pClient = pData2 !== 0 ? mem.u32((pData2 + 0x9c) >>> 0) : 0;
        if (pClient !== 0) {
          const dwGuid = mem.u32((pPlayer + 0x0c) >>> 0);
          const posY = UNIT_GetPosY113c(mem, pPlayer);
          const posX = UNIT_GetPosX113c(mem, pPlayer);
          S2C_QueueLocationPacket11_6FCABF80_113c(mem, 0x15, 0, dwGuid, pClient, posX, posY, 1);
        }
      }
    }
    return deltaErr;
  }

  mem.setU32((pPlayerData + 0x168) >>> 0, dwGameFrame);
  if (pOutX !== 0) mem.setU16(pOutX >>> 0, wX);
  if (pOutY !== 0) mem.setU16(pOutY >>> 0, wY);
  return 0;
}

/**
 * @va D2Game:0x6FCECFE0
 * 1:1 binary port of `D2Game.dll:0x6FCECFE0` (`C2S_ValidateTargetUnitDistance`, 254 bytes):
 * - Native 5-arg x86 call `(mem, dwUnitType, dwUnitId, pGame, pPlayer, nMaxDelta = 0x32, callees?)`:
 *   1. Looks up `pTarget = SUNIT_GetServerUnit(pGame, dwUnitType, dwUnitId)`; if `0`, returns `1`.
 *   2. If `dwUnitType === 4` (`UNIT_ITEM`) and `ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(mem, pPlayer, pTarget, 0) != 0`, returns `0`.
 *   3. Compares `DRLG_GetActNoFromLevelId(DUNGEON_GetLevelIdFromRoom(UNITS_GetRoom(...)))` for `pPlayer` and `pTarget`; if different, returns `2`.
 *   4. Returns `C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, targetX, targetY, nMaxDelta)` (`0` or `1`).
 * - Legacy 3-arg call `(mem, pPlayer, pTargetUnit)` preserves boolean `1` (in-range) / `0` (out-of-range) compatibility.
 */
export function C2S_ValidateTargetUnitDistance113c(
  mem: Memory113c,
  dwUnitTypeOrPlayer: number,
  dwUnitIdOrTarget: number,
  pGame?: number,
  pPlayer?: number,
  nMaxDelta = 0x32,
  callees?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCECFE0);
  if (pGame === undefined || pPlayer === undefined) {
    // 3-arg legacy call `(mem, pPlayer, pTargetUnit)` -> 1 (valid) / 0 (invalid)
    const plr = dwUnitTypeOrPlayer >>> 0;
    const tgt = dwUnitIdOrTarget >>> 0;
    if (plr === 0 || tgt === 0) return 0;
    if (
      mem.u32(tgt) === 4 &&
      ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(mem, plr, tgt, 0) !== 0
    ) {
      return 1;
    }
    const rPlr = UNITS_GetRoom113c(mem, plr);
    const rTgt = UNITS_GetRoom113c(mem, tgt);
    if (rPlr !== 0 && rTgt !== 0) {
      const actPlr = DRLG_GetActNoFromLevelId113c(mem, DUNGEON_GetLevelIdFromRoom113c(mem, rPlr)) & 0xff;
      const actTgt = DRLG_GetActNoFromLevelId113c(mem, DUNGEON_GetLevelIdFromRoom113c(mem, rTgt)) & 0xff;
      if (actPlr !== actTgt) return 0;
    }
    const tx = getUnitPosXByType113c(mem, tgt);
    const ty = getUnitPosYByType113c(mem, tgt);
    return C2S_CheckCoordDeltaExceeded113c(mem, plr, tx, ty, 0x32) === 0 ? 1 : 0;
  }

  const dwUnitType = dwUnitTypeOrPlayer >>> 0;
  const dwUnitId = dwUnitIdOrTarget >>> 0;
  const pTarget = resolveTargetUnitFromMemory113c(mem, pGame, dwUnitType, dwUnitId, pPlayer, callees);
  if (pTarget === 0) {
    return 1;
  }
  if (
    dwUnitType === 4 &&
    ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(mem, pPlayer, pTarget, 0) !== 0
  ) {
    return 0;
  }
  const rPlr = UNITS_GetRoom113c(mem, pPlayer);
  const rTgt = UNITS_GetRoom113c(mem, pTarget);
  const actPlr = DRLG_GetActNoFromLevelId113c(mem, DUNGEON_GetLevelIdFromRoom113c(mem, rPlr)) & 0xff;
  const actTgt = DRLG_GetActNoFromLevelId113c(mem, DUNGEON_GetLevelIdFromRoom113c(mem, rTgt)) & 0xff;
  if (actPlr !== actTgt) {
    return 2;
  }
  const targetX = getUnitPosXByType113c(mem, pTarget);
  const targetY = getUnitPosYByType113c(mem, pTarget);
  return C2S_CheckCoordDeltaExceeded113c(mem, pPlayer, targetX, targetY, nMaxDelta | 0);
}

export interface UnpackedUnitPacket113c {
  readonly ok: number;
  readonly rc: number;
  readonly dwUnitType: number;
  readonly dwUnitId: number;
  readonly pTargetUnit: number;
}

/**
 * @va D2Game:0x6FCED630
 * 1:1 binary port of `D2Game.dll:0x6FCED630` (`C2S_UnpackAndValidateUnitPacket`, 91 bytes):
 * - Zeroes `*pOutId = 0`, `*pOutType = 0`.
 * - Requires `nPacketLen === 9` (else returns `3`).
 * - Reads `dwUnitType = u32(pPacket + 1)`, `dwUnitId = u32(pPacket + 5)`; if `(dwUnitType >>> 0) >= 6`, returns `2`.
 * - Calls `C2S_ValidateTargetUnitDistance113c(mem, dwUnitType, dwUnitId, pGame, pPlayer, 0x32, callees)`;
 *   when `0`, writes `*pOutId = dwUnitId`, `*pOutType = dwUnitType`. Returns `0`, `1`, or `2`.
 */
export function C2S_UnpackAndValidateUnitPacket113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  pOutType = 0,
  pOutId = 0,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCED630);
  if (pOutId !== 0) mem.setU32(pOutId >>> 0, 0);
  if (pOutType !== 0) mem.setU32(pOutType >>> 0, 0);

  let nPacketLen = 9;
  let callees: C2SPacketCallees113c | undefined = calleesArg;
  if (typeof nPacketLenOrCallees === 'number') {
    nPacketLen = nPacketLenOrCallees | 0;
  } else {
    callees = nPacketLenOrCallees;
  }

  if (nPacketLen !== 9 || pPacket === 0) {
    return 3;
  }
  const dwUnitType = mem.u32((pPacket + 1) >>> 0);
  const dwUnitId = mem.u32((pPacket + 5) >>> 0);
  if ((dwUnitType >>> 0) >= 6) {
    return 2;
  }
  const rc = C2S_ValidateTargetUnitDistance113c(
    mem,
    dwUnitType,
    dwUnitId,
    pGame,
    pPlayer,
    0x32,
    callees,
  );
  if (rc === 0) {
    if (pOutId !== 0) mem.setU32(pOutId >>> 0, dwUnitId);
    if (pOutType !== 0) mem.setU32(pOutType >>> 0, dwUnitType);
  }
  return rc;
}

/**
 * @va D2Game:0x6FCEE120
 * 1:1 binary port of `D2Game.dll:0x6FCEE120` (`C2S_RunToTargetAndSetQueuedSkill`, 33 bytes):
 * Starts `PLRMODE_RUN (3)` toward `(dwTargetType, dwTargetId)` via `0x6FC98430` and records
 * `(nSkillId, dwTargetType, dwTargetId)` in `pPlayerData` (`+0x150..+0x160`) via `D2Common.#10329`.
 */
export function C2S_RunToTargetAndSetQueuedSkill113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pTargetUnit: number,
  dwTargetType = 0,
  dwTargetId = 0,
  nSkillId = 0,
  callees?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE120);
  const target =
    pTargetUnit !== 0
      ? pTargetUnit
      : resolveTargetUnitFromMemory113c(mem, pGame, dwTargetType, dwTargetId, pPlayer, callees);
  const effType = target !== 0 ? mem.u32(target >>> 0) : dwTargetType >>> 0;
  const effId = target !== 0 ? mem.u32((target + 0x0c) >>> 0) : dwTargetId >>> 0;
  PLAYER_StartModeOnUnit113c(mem, pGame, pPlayer, target, PLRMODE_RUN, 0, 0, 0, 0, callees);
  PLAYER_SetPlayerData150ParamsExport113c(mem, pPlayer, nSkillId | 0, effType | 0, effId | 0);
  return 0;
}

function withStackPair113c<T>(mem: Memory113c, fn: (pSlot0: number, pSlot1: number) => T): T {
  const base = (C2S_STACK_SCRATCH_BASE + c2sScratchDepth * 8) >>> 0;
  c2sScratchDepth = (c2sScratchDepth + 1) & 7;
  try {
    return fn(base, (base + 4) >>> 0);
  } finally {
    c2sScratchDepth = (c2sScratchDepth - 1) & 7;
  }
}

/**
 * @va D2Game:0x6FCEE0D0
 * 1:1 binary port of `D2Game.dll:0x6FCEE0D0` (`C2S_Packet01_WalkToLocation`, 68 bytes).
 * Returns `0` on success, or validation error `1` / `2` / `3`.
 */
export function C2S_Packet01_WalkToLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 5,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE0D0);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 5;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutX, pOutY) => {
    const rc = C2S_UnpackAndValidateLocationPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutX,
      pOutY,
    );
    if (rc !== 0) return rc;
    PLAYER_StartModeAtCoords113c(
      mem,
      pGame,
      pPlayer,
      PLRMODE_WALK,
      mem.u16(pOutX),
      mem.u16(pOutY),
      0,
      0,
      callees,
    );
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE090
 * 1:1 binary port of `D2Game.dll:0x6FCEE090` (`C2S_Packet02_WalkToUnit`, 64 bytes).
 * Returns `0` on success, or validation error `1` / `2` / `3`.
 */
export function C2S_Packet02_WalkToUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE090);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    const target = resolveTargetUnitFromMemory113c(
      mem,
      pGame,
      mem.u32(pOutType),
      mem.u32(pOutId),
      pPlayer,
      callees,
    );
    PLAYER_StartModeOnUnit113c(mem, pGame, pPlayer, target, PLRMODE_WALK, 0, 0, 0, 0, callees);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE040
 * 1:1 binary port of `D2Game.dll:0x6FCEE040` (`C2S_Packet03_RunToLocation`, 68 bytes).
 * Returns `0` on success, or validation error `1` / `2` / `3`.
 */
export function C2S_Packet03_RunToLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 5,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE040);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 5;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutX, pOutY) => {
    const rc = C2S_UnpackAndValidateLocationPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutX,
      pOutY,
    );
    if (rc !== 0) return rc;
    PLAYER_StartModeAtCoords113c(
      mem,
      pGame,
      pPlayer,
      PLRMODE_RUN,
      mem.u16(pOutX),
      mem.u16(pOutY),
      0,
      0,
      callees,
    );
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE000
 * 1:1 binary port of `D2Game.dll:0x6FCEE000` (`C2S_Packet04_RunToUnit`, 64 bytes).
 * Returns `0` on success, or validation error `1` / `2` / `3`.
 */
export function C2S_Packet04_RunToUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE000);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    const target = resolveTargetUnitFromMemory113c(
      mem,
      pGame,
      mem.u32(pOutType),
      mem.u32(pOutId),
      pPlayer,
      callees,
    );
    PLAYER_StartModeOnUnit113c(mem, pGame, pPlayer, target, PLRMODE_RUN, 0, 0, 0, 0, callees);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEDF30
 * 1:1 binary port of `D2Game.dll:0x6FCEDF30` (`C2S_ExecuteSkillOnLocation`, 204 bytes):
 * - Rejects dead/dying players (`pPlayer == 0` or `dwAnimMode == 0` or `dwAnimMode == 17`) with `2`.
 * - Resolves dual-wield claw alternation via `0x6FCEB1F0` when `UNITS_CanDualWield` (`#10747`) is non-zero.
 * - Evaluates `failReason = SKILLS_GetSkillUseFailReason(pPlayer, pSkill)` (`#10787`) and `pSkillsTxt = SKILLS_GetSkillsTxtFromSkill(pSkill)` (`#10858`):
 *   if `failReason in {1, 2, 4}` and `(pSkillsTxt->nFlags3 (+0x07) & bit4)` (`fallbackToAttack`), substitutes `Attack(0)` (`#10708`).
 * - Reads `nPlrMode = SKILLS_GetSkillSlotIndex(pPlayer, pSkill)` (`#10952` `pSkill->nSkillMode`):
 *   - if `nPlrMode == 0`, returns `2`;
 *   - if `failReason == 1`, sends S2C `0x5A` type `0x0E` (`0x6FCEBED0`) and returns `2`;
 *   - if `failReason != 0`, returns `2`;
 *   - if `failReason == 0`, calls `PLAYER_StartModeAtCoords113c(mem, pGame, pPlayer, nPlrMode, nX, nY, 0, pSkill, callees)` and returns `0`.
 */
export function C2S_ExecuteSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pSkill: number,
  nX: number,
  nY: number,
  _bShift = 0,
  callees?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEDF30);
  if (pPlayer === 0 || pSkill === 0) return 2;
  const curMode = mem.get(pPlayer, D2UnitStrc.dwAnimMode);
  if (curMode === PLRMODE_DEATH || curMode === PLRMODE_DEAD) {
    return 2;
  }

  let resolvedSkill = pSkill >>> 0;
  if (UNITS_CanDualWield113c(mem, pPlayer)) {
    resolvedSkill = C2S_ResolveDualWieldThrowSkill113c(mem, pPlayer, resolvedSkill) >>> 0;
  }

  let failReason = SKILLS_GetSkillUseFailReason113c(mem, pPlayer, resolvedSkill);
  const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(mem, resolvedSkill);
  if (pSkillsTxt === 0) {
    return 2;
  }

  if (failReason > 0 && (failReason <= 2 || failReason === 4)) {
    const maskBit4 = getGdwBitMaskByte113c(mem, 0x10);
    if ((mem.u8((pSkillsTxt + 0x07) >>> 0) & maskBit4) !== 0) {
      const pBasicAttack = SKILLS_GetSkillById113c(mem, pPlayer, 0, -1);
      if (pBasicAttack !== 0) {
        resolvedSkill = pBasicAttack >>> 0;
        failReason = SKILLS_GetSkillUseFailReason113c(mem, pPlayer, resolvedSkill);
      }
    }
  }

  const nPlrMode = SKILLS_GetSkillSlotIndex113c(mem, pPlayer, resolvedSkill);
  if (nPlrMode === 0) {
    return 2;
  }
  if (failReason !== 0) {
    if (failReason === 1) {
      NET_SendEventMessage5A_Type0E_113c(mem, pPlayer);
    }
    return 2;
  }

  PLAYER_StartModeAtCoords113c(mem, pGame, pPlayer, nPlrMode, nX, nY, 0, resolvedSkill, callees);
  return 0;
}

/**
 * @va D2Game:0x6FCEE620
 * 1:1 binary port of `D2Game.dll:0x6FCEE620` (`C2S_ExecuteSkillOnUnit`, 355 bytes):
 * - Resolves dual-wield claw alternation (`0x6FCEB1F0`) and `SKILLS_GetSkillUseFailReason` (`#10787`)
 *   with `fallbackToAttack` (`pSkillsTxt + 0x07` bit 4 -> `Attack(0)`).
 * - Checks targetable unit type (`pSkillsTxt + 0x07` bit 3 allows all types; otherwise restricts to `{0, 1, 3}`).
 * - If `pTarget` has state `0x8F` (`STATE_DECREPIFY`/`MONSTER_OWNER_REDIRECT` `143`), redirects to `SUNIT_GetOwnerUnit` (`0x6FD00A20`).
 * - When `bAllowMove != 0`:
 *   - if `SKILLS_GetSkillNumTargetsOrShots` (`#10002`) == `1` and `UNITS_CanUnitMeleeAttackTarget` (`#11138`) == `0`,
 *     runs toward target and queues skill via `0x6FCEE120`;
 *   - if `#10002` == `4`, runs toward target and queues skill via `0x6FCEE120`.
 * - Otherwise starts `PLAYER_StartModeOnUnit113c` (`0x6FC98430`) and returns `0`.
 */
export function C2S_ExecuteSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pSkill: number,
  pTargetUnit: number,
  bAllowMove = 0,
  callees?: C2SPacketCallees113c,
  dwUnitTypeArg?: number,
  dwUnitIdArg?: number,
): number {
  hitD2GameVa113c(0x6FCEE620);
  if (pPlayer === 0 || pSkill === 0) return 2;

  let resolvedSkill = pSkill >>> 0;
  if (UNITS_CanDualWield113c(mem, pPlayer)) {
    resolvedSkill = C2S_ResolveDualWieldThrowSkill113c(mem, pPlayer, resolvedSkill) >>> 0;
  }

  let failReason = SKILLS_GetSkillUseFailReason113c(mem, pPlayer, resolvedSkill);
  const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(mem, resolvedSkill);
  if (pSkillsTxt === 0) {
    return 2;
  }

  if (failReason > 0 && (failReason <= 2 || failReason === 4)) {
    const maskBit4 = getGdwBitMaskByte113c(mem, 0x10);
    if ((mem.u8((pSkillsTxt + 0x07) >>> 0) & maskBit4) !== 0) {
      const pBasicAttack = SKILLS_GetSkillById113c(mem, pPlayer, 0, -1);
      if (pBasicAttack !== 0) {
        resolvedSkill = pBasicAttack >>> 0;
        failReason = SKILLS_GetSkillUseFailReason113c(mem, pPlayer, resolvedSkill);
      }
    }
  }

  if (failReason !== 0) {
    return 2;
  }

  const nPlrMode = SKILLS_GetSkillSlotIndex113c(mem, pPlayer, resolvedSkill);
  if (nPlrMode === 0) {
    return 2;
  }

  let dwTargetType =
    dwUnitTypeArg !== undefined
      ? dwUnitTypeArg | 0
      : pTargetUnit !== 0
        ? mem.u32(pTargetUnit >>> 0) | 0
        : -1;
  let dwTargetId =
    dwUnitIdArg !== undefined
      ? dwUnitIdArg >>> 0
      : pTargetUnit !== 0
        ? mem.u32((pTargetUnit + 0x0c) >>> 0)
        : 0;

  const maskBit3 = getGdwBitMaskByte113c(mem, 0x0c);
  if ((mem.u8((pSkillsTxt + 0x07) >>> 0) & maskBit3) === 0) {
    if (dwTargetType < 0 || (dwTargetType > 1 && dwTargetType !== 3)) {
      return 2;
    }
  }

  let target =
    pTargetUnit !== 0
      ? pTargetUnit >>> 0
      : resolveTargetUnitFromMemory113c(mem, pGame, dwTargetType, dwTargetId, pPlayer, callees);

  if (target !== 0 && STATES_CheckState113c(mem, target, 0x8f) !== 0) {
    const pOwner = SUNIT_GetOwnerUnit113c(mem, target, pGame);
    if (pOwner !== 0) {
      target = pOwner >>> 0;
      dwTargetType = mem.u32(pOwner >>> 0) | 0;
      dwTargetId = mem.u32((pOwner + 0x0c) >>> 0);
    }
  }

  if ((bAllowMove | 0) !== 0 && target !== 0) {
    const rangeType = SKILLS_GetSkillNumTargetsOrShots113c(mem, pPlayer, resolvedSkill);
    if (rangeType === 1) {
      const targetMoving = UNITS_IsUnitMovingBool113c(mem, target);
      if (UNITS_CanUnitMeleeAttackTarget113c(mem, pPlayer, target, targetMoving) === 0) {
        const nSkillId = SKILLS_GetSkillIdFromSkill113c(mem, resolvedSkill, 0x6fd1b188, 0x7a6);
        C2S_RunToTargetAndSetQueuedSkill113c(
          mem,
          pGame,
          pPlayer,
          target,
          dwTargetType,
          dwTargetId,
          nSkillId,
          callees,
        );
        return 0;
      }
    } else if (rangeType === 4) {
      const nSkillId = SKILLS_GetSkillIdFromSkill113c(mem, resolvedSkill, 0x6fd1b188, 0x7a6);
      C2S_RunToTargetAndSetQueuedSkill113c(
        mem,
        pGame,
        pPlayer,
        target,
        dwTargetType,
        dwTargetId,
        nSkillId,
        callees,
      );
      return 0;
    }
  }

  PLAYER_StartModeOnUnit113c(
    mem,
    pGame,
    pPlayer,
    target,
    nPlrMode,
    dwTargetType,
    dwTargetId,
    0,
    resolvedSkill,
    callees,
  );
  return 0;
}

function bumpPlayerActionStat148_113c(mem: Memory113c, pPlayer: number): void {
  const cur = STATLIST_GetUnitBaseStat113c(mem, pPlayer, 0x148, 0);
  STATLIST_SetUnitStat113c(mem, pPlayer, 0x148, (cur + 1) | 0, 0);
}

/**
 * @va D2Game:0x6FCEE5A0
 * 1:1 binary port of `D2Game.dll:0x6FCEE5A0` (`C2S_Packet05_LeftSkillOnLocation`, 116 bytes).
 */
export function C2S_Packet05_LeftSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 5,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE5A0);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 5;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutX, pOutY) => {
    const rc = C2S_UnpackAndValidateLocationPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutX,
      pOutY,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetLeftSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    bumpPlayerActionStat148_113c(mem, pPlayer);
    const pLeftSkill = UNITS_GetLeftSkill113c(mem, pPlayer);
    C2S_ExecuteSkillOnLocation113c(
      mem,
      pGame,
      pPlayer,
      pLeftSkill,
      mem.u16(pOutX),
      mem.u16(pOutY),
      0,
      callees,
    );
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE9D0
 * 1:1 binary port of `D2Game.dll:0x6FCEE9D0` (`C2S_Packet06_LeftSkillOnUnit`, 118 bytes).
 */
export function C2S_Packet06_LeftSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE9D0);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetLeftSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    bumpPlayerActionStat148_113c(mem, pPlayer);
    const dwType = mem.u32(pOutType);
    const dwId = mem.u32(pOutId);
    const pLeftSkill = UNITS_GetLeftSkill113c(mem, pPlayer);
    C2S_ExecuteSkillOnUnit113c(mem, pGame, pPlayer, pLeftSkill, 0, 1, callees, dwType, dwId);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE950
 * 1:1 binary port of `D2Game.dll:0x6FCEE950` (`C2S_Packet07_ShiftLeftSkillOnUnit`, 118 bytes).
 */
export function C2S_Packet07_ShiftLeftSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE950);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetLeftSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    bumpPlayerActionStat148_113c(mem, pPlayer);
    const dwType = mem.u32(pOutType);
    const dwId = mem.u32(pOutId);
    const pLeftSkill = UNITS_GetLeftSkill113c(mem, pPlayer);
    C2S_ExecuteSkillOnUnit113c(mem, pGame, pPlayer, pLeftSkill, 0, 0, callees, dwType, dwId);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE8F0
 * 1:1 binary port of `D2Game.dll:0x6FCEE8F0` (`C2S_Packet08_RepeatLeftSkillOnLocation`, 81 bytes).
 */
export function C2S_Packet08_RepeatLeftSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 5,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE8F0);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 5;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutX, pOutY) => {
    const rc = C2S_UnpackAndValidateLocationPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutX,
      pOutY,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetLeftSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    C2S_Packet05_LeftSkillOnLocation113c(mem, pGame, pPlayer, pPacket, nPacketLen, callees);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEEB70
 * 1:1 binary port of `D2Game.dll:0x6FCEEB70` (`C2S_Packet09_RepeatLeftSkillOnUnit`, 87 bytes).
 */
export function C2S_Packet09_RepeatLeftSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEEB70);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetLeftSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    C2S_Packet06_LeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, nPacketLen, callees);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEEB10
 * 1:1 binary port of `D2Game.dll:0x6FCEEB10` (`C2S_Packet0A_RepeatShiftLeftSkillOnUnit`, 87 bytes).
 */
export function C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEEB10);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetLeftSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    C2S_Packet07_ShiftLeftSkillOnUnit113c(mem, pGame, pPlayer, pPacket, nPacketLen, callees);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE520
 * 1:1 binary port of `D2Game.dll:0x6FCEE520` (`C2S_Packet0C_RightSkillOnLocation`, 116 bytes).
 */
export function C2S_Packet0C_RightSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 5,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE520);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 5;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutX, pOutY) => {
    const rc = C2S_UnpackAndValidateLocationPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutX,
      pOutY,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetRightSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    bumpPlayerActionStat148_113c(mem, pPlayer);
    const pRightSkill = UNITS_GetRightSkill113c(mem, pPlayer);
    C2S_ExecuteSkillOnLocation113c(
      mem,
      pGame,
      pPlayer,
      pRightSkill,
      mem.u16(pOutX),
      mem.u16(pOutY),
      0,
      callees,
    );
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE870
 * 1:1 binary port of `D2Game.dll:0x6FCEE870` (`C2S_Packet0D_RightSkillOnUnit`, 118 bytes).
 */
export function C2S_Packet0D_RightSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE870);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetRightSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    bumpPlayerActionStat148_113c(mem, pPlayer);
    const dwType = mem.u32(pOutType);
    const dwId = mem.u32(pOutId);
    const pRightSkill = UNITS_GetRightSkill113c(mem, pPlayer);
    C2S_ExecuteSkillOnUnit113c(mem, pGame, pPlayer, pRightSkill, 0, 1, callees, dwType, dwId);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE7F0
 * 1:1 binary port of `D2Game.dll:0x6FCEE7F0` (`C2S_Packet0E_ShiftRightSkillOnUnit`, 118 bytes).
 */
export function C2S_Packet0E_ShiftRightSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE7F0);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetRightSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    bumpPlayerActionStat148_113c(mem, pPlayer);
    const dwType = mem.u32(pOutType);
    const dwId = mem.u32(pOutId);
    const pRightSkill = UNITS_GetRightSkill113c(mem, pPlayer);
    C2S_ExecuteSkillOnUnit113c(mem, pGame, pPlayer, pRightSkill, 0, 0, callees, dwType, dwId);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEE790
 * 1:1 binary port of `D2Game.dll:0x6FCEE790` (`C2S_Packet0F_RepeatRightSkillOnLocation`, 81 bytes).
 */
export function C2S_Packet0F_RepeatRightSkillOnLocation113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 5,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEE790);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 5;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutX, pOutY) => {
    const rc = C2S_UnpackAndValidateLocationPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutX,
      pOutY,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetRightSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    C2S_Packet0C_RightSkillOnLocation113c(mem, pGame, pPlayer, pPacket, nPacketLen, callees);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEEAB0
 * 1:1 binary port of `D2Game.dll:0x6FCEEAB0` (`C2S_Packet10_RepeatRightSkillOnUnit`, 87 bytes).
 */
export function C2S_Packet10_RepeatRightSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEEAB0);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetRightSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    C2S_Packet0D_RightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, nPacketLen, callees);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEEA50
 * 1:1 binary port of `D2Game.dll:0x6FCEEA50` (`C2S_Packet11_RepeatShiftRightSkillOnUnit`, 87 bytes).
 */
export function C2S_Packet11_RepeatShiftRightSkillOnUnit113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLenOrCallees: number | C2SPacketCallees113c = 9,
  calleesArg?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCEEA50);
  const nPacketLen = typeof nPacketLenOrCallees === 'number' ? nPacketLenOrCallees | 0 : 9;
  const callees = typeof nPacketLenOrCallees === 'number' ? calleesArg : nPacketLenOrCallees;
  return withStackPair113c(mem, (pOutType, pOutId) => {
    const rc = C2S_UnpackAndValidateUnitPacket113c(
      mem,
      pGame,
      pPlayer,
      pPacket,
      nPacketLen,
      pOutType,
      pOutId,
      callees,
    );
    if (rc !== 0) return rc;
    if (UNITS_GetRightSkill113c(mem, pPlayer) === 0) {
      return 3;
    }
    C2S_Packet0E_ShiftRightSkillOnUnit113c(mem, pGame, pPlayer, pPacket, nPacketLen, callees);
    return 0;
  });
}

/**
 * @va D2Game:0x6FCEF480
 * 1:1 binary port of `D2Game.dll:0x6FCEF480` (`C2S_Packet3C_SelectSkill`, 144 bytes):
 * - Requires `nPacketLen === 9` (else returns `3`).
 * - Reads `rawField = u32(pPacket + 1)`, `dwItemGuid = u32(pPacket + 5)`:
 *   `bLeft = rawField >>> 31`, `nSkillId = rawField & 0x7FFFFFFF`.
 * - Validates `0 <= nSkillId < sgptDataTables->nSkillsTxtRecordCount (+0xBA0)`,
 *   `pSkill = SKILLS_GetSkillById(pPlayer, nSkillId, dwItemGuid)` (`#10708`) != `0`,
 *   and `SKILLS_EvaluateSkillLevel(pPlayer, pSkill, 1)` (`#10306`) != `0` (else returns `3`).
 * - Calls `SKILLS_AssignHandSkillAndSyncAura113c` (`0x6FCC2100`) and stores left (`#10088`) or right (`#10374`) skill.
 * - Returns `0`.
 */
export function C2S_Packet3C_SelectSkill113c(
  mem: Memory113c,
  _pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen = 9,
): number {
  hitD2GameVa113c(0x6FCEF480);
  if ((nPacketLen | 0) !== 9 || pPacket === 0 || pPlayer === 0) {
    return 3;
  }
  const rawField = mem.u32((pPacket + 1) >>> 0);
  const dwItemGuid = mem.u32((pPacket + 5) >>> 0);
  const bLeft = rawField >>> 31;
  const nSkillId = (rawField & 0x7fffffff) | 0;
  if (nSkillId < 0) {
    return 3;
  }
  const pDataTables = getSgptDataTablesPtr113c(mem);
  if (pDataTables === 0) {
    return 3;
  }
  const nSkillsCount = mem.u32((pDataTables + 0xba0) >>> 0) | 0;
  if (nSkillId >= nSkillsCount) {
    return 3;
  }
  const pSkill = SKILLS_GetSkillById113c(mem, pPlayer, nSkillId, dwItemGuid | 0);
  if (pSkill === 0) {
    return 3;
  }
  if (SKILLS_EvaluateSkillLevel113c(mem, pPlayer, pSkill, 1) === 0) {
    return 3;
  }
  SKILLS_AssignHandSkillAndSyncAura113c(mem, pPlayer, bLeft, nSkillId, dwItemGuid);
  if (bLeft !== 0) {
    PLAYER_StoreLeftSkill113c(mem, pPlayer);
  } else {
    PLAYER_StoreRightSkill113c(mem, pPlayer);
  }
  return 0;
}

/**
 * @va D2Game:0x6FCF0790
 * 1:1 binary port of `D2Game.dll:0x6FCF0790` (`C2S_Packet5F_UpdatePlayerPos`, 278 bytes):
 * - Requires `nPacketLen === 5` (else returns `3`).
 * - Validates `pPlayer != 0`, `dwUnitType == 0`, `pPlayerData->pClient (+0x9C) != 0`.
 * - No-ops (`0`) if `SKILLS_GetUsedSkill(pPlayer) != 0` (`#10511`) or `SUNIT_IsDeadOrDying(pPlayer) != 0` (`0x6FCFFA90`).
 * - Computes `dist = UNITS_GetUnitDistanceToCoordinates(pPlayer, wX, wY)` (`#10080`); if `dist < 5`, returns `0`.
 * - If `STATES_CheckState(pPlayer, 0x6C) == 0` and `15 <= dist <= 45`:
 *   tests `SKILLS_TestPathReachableToCoords_6FCED790_113c` + `PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c`;
 *   if unreachable or rejected, sends `NET_SendReassignUnitPacket15_113c(pPlayer, pClient, 0)` and returns `0`.
 * - Otherwise, if `SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(pPlayer, pGame) == 0`, starts walk (`2`) or run (`3`)
 *   toward `(wX, wY)` via `0x6FC98550`, and returns `0`.
 */
export function C2S_Packet5F_UpdatePlayerPos113c(
  mem: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen = 5,
  callees?: C2SPacketCallees113c,
): number {
  hitD2GameVa113c(0x6FCF0790);
  if ((nPacketLen | 0) !== 5 || pPacket === 0) {
    return 3;
  }
  const wX = mem.u16((pPacket + 1) >>> 0);
  const wY = mem.u16((pPacket + 3) >>> 0);
  if (pPlayer === 0 || mem.u32(pPlayer >>> 0) !== 0) {
    return 2;
  }
  const pPlrData = UNITS_GetPlayerData113c(mem, pPlayer);
  const pClient = pPlrData !== 0 ? mem.u32((pPlrData + 0x9c) >>> 0) : 0;
  if (pClient === 0) {
    return 2;
  }
  if (SKILLS_GetUsedSkill113c(mem, pPlayer) !== 0) {
    return 0;
  }
  if (SUNIT_IsDeadOrDying113c(mem, pPlayer) !== 0) {
    return 0;
  }
  const dist = UNITS_GetUnitDistanceToCoordinates113c(mem, pPlayer, wX, wY) | 0;
  if (dist < 5) {
    return 0;
  }
  if (STATES_CheckState113c(mem, pPlayer, 0x6c) === 0 && dist >= 0x0f && dist <= 0x2d) {
    if (
      SKILLS_TestPathReachableToCoords_6FCED790_113c(
        mem as SparseMemory113c,
        wY,
        wX,
        pGame,
        pPlayer,
      ) !== 0 &&
      PLAYER_TeleportToCoordsWithRateLimitDelay_6FCEFE40_113c(
        mem as SparseMemory113c,
        wY,
        wX,
        pPlayer,
        pGame,
      ) !== 0
    ) {
      return 0;
    }
    NET_SendReassignUnitPacket15_113c(mem, pPlayer, pClient, 0);
    return 0;
  }
  if (SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(mem, pPlayer, pGame) === 0) {
    const moveMode = mem.get(pPlayer, D2UnitStrc.dwAnimMode) === PLRMODE_RUN ? 3 : 2;
    PLAYER_StartModeAtCoords113c(mem, pGame, pPlayer, moveMode, wX, wY, 0, 0, callees);
  }
  return 0;
}
