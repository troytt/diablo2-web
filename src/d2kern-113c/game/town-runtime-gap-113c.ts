import { D2CommonAssertError } from '../common/inline-helpers.ts';
import { UNITS_GetPlayerData113c } from '../common/composit.ts';
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts';
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomExFromRoom113c,
} from '../common/dungeon.ts';
import {
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts';
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetBaseCode113c,
  ITEMS_GetInvPage113c,
} from '../common/items.ts';
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  DUNGEON_CheckRoomIsTownMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports.ts';
import {
  PATH_ClearNextRoom113c,
  PATH_Compute113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetLastPointX113c,
  PATH_GetLastPointY113c,
  PATH_GetMaxDistance113c,
  PATH_GetNextRoom113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetOrCheckLastCollisionMask113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_GetTargetUnit113c,
  PATH_GetType113c,
  PATH_ResetToDefaultType113c,
  PATH_SetCurrentRoomInvalid113c,
  PATH_SetDistance113c,
  PATH_SetNewDistance113c,
  PATH_SetTargetPos113c,
  PATH_SetType113c,
} from '../common/path.ts';
import {
  SKILLS_GetSkillIdFromSkill113c,
  SKILLS_GetSkillsTxtFromSkill113c,
  SKILLS_GetUsedSkill113c,
} from '../common/skills.ts';
import {
  STATES_CheckState113c,
  STATES_CheckStateMask33OnUnit113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
} from '../common/statlist.ts';
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetPathRoomRefreshFlag113c,
  UNITS_GetRoom113c,
  UNITS_HasCollisionBetweenUnits113c,
  UNITS_IsDoor113c,
  UNITS_IsUnitInObjRectRange113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts';
import type { Memory113c } from '../mem/sparse-memory.ts';
import { MONSTERS_IsDead113c } from '../tables/datatbls-113c.ts';
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts';
import {
  AIGENERAL_GetPackLeaderUnit113c,
  AI_CalcApproxUnitDistSubtiles113c,
  AI_CheckApproachTauntSound113c,
  AI_TryMonsterTeleportEscape113c,
  SUNITDMG_FreeAttackerCombatList113c,
} from './ai-fallen-113c.ts';
import {
  AI_FleeFrom113c,
  AI_IdleWander113c,
  AI_Stall113c,
  MONSTER_StartMode113c,
  PLAYER_ScheduleSkillActionFrameEvents113c,
  PLAYER_StartModeCast113c,
  SEED_RollLimitedRandomNumber113c,
} from './combat-a1c-113c.ts';
import { SUNIT_GetServerUnit113c } from './game-strc.ts';
import {
  MONSTER_ClearModeEvents113c,
  MONSTER_RegisterContinuousModeEvent113c,
  SKILLS_SetUsedSkill113c,
  SUNIT_IsDeadOrDying113c,
  UNITS_ChangeAnimMode113c,
} from './monster-events.ts';
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTATS2_CheckModeBit113c,
  MONSTATS_CheckFlagBit113c,
  SEED_RollLimitedFast113c,
  SKILLS_GetRecordPtrFast113c,
  SUNIT_InitUnitAnimData113c,
  SUNIT_ValidatePathTargetUnit113c,
  UNIT_CalcSqDistSubtiles113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts';
import { EVENT_GetNextEventFrame113c } from './timer-wheel.ts';


function i32(m: Memory113c, p: number): number {
  return m.u32(p >>> 0) | 0;
}

function zeroMem(m: Memory113c, p: number, len: number): void {
  m.fill(p >>> 0, len, 0);
}

function freeMem(_m: Memory113c, _p: number): void {
  // Arena bump allocator on Memory113c
}

const QUEST_BIT_STATE_OFFSETS = new Int32Array([0x00, 0x04, 0x06, 0x0c, 0x0e, 0x10]);

function checkQuestBitStateHelper(m: Memory113c, pBitBuffer: number, nQuestId: number, nSubBit: number): number {
  if (pBitBuffer === 0 || nSubBit >= 16 || nQuestId >= 44) {
    return 0;
  }
  const bitOffset = nSubBit < 6 ? QUEST_BIT_STATE_OFFSETS[nSubBit]! : 0;
  const bitIndex = (nQuestId * 16 + (nSubBit + bitOffset)) | 0;
  const byteVal = m.u8((pBitBuffer + (bitIndex >> 3)) >>> 0);
  const gdwBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C);
  const mask = gdwBitMasks !== 0 ? m.u32((gdwBitMasks + ((bitIndex & 7) << 2)) >>> 0) : (1 << (bitIndex & 7)) >>> 0;
  return (byteVal & mask) !== 0 ? 1 : 0;
}

function appendClientNetPacketNode(m: Memory113c, pClient: number, pPayload: number, nSize: number): void {
  if (pClient === 0) {
    return;
  }
  let pTail = m.u32(pClient + 0x1bc);
  let curLen = pTail !== 0 ? i32(m, pTail) : 0;
  if (curLen + nSize > 0x200 || pTail === 0) {
    curLen = 0;
    let pNew = m.u32(pClient + 0x1c0);
    if (pNew !== 0) {
      m.setU32(pClient + 0x1c0, m.u32(pNew + 0x204));
    } else {
      pNew = m.alloc(0x208);
    }
    zeroMem(m, pNew, 0x208);
    const pOldTail = m.u32(pClient + 0x1bc);
    if (pOldTail === 0) {
      m.setU32(pClient + 0x1b8, pNew);
    } else {
      m.setU32(pOldTail + 0x204, pNew);
    }
    m.setU32(pClient + 0x1bc, pNew);
    pTail = pNew;
  }
  const dst = (pTail + curLen + 4) >>> 0;
  for (let i = 0; i < nSize; i++) {
    m.setU8(dst + i, m.u8(pPayload + i));
  }
  m.setU32(pTail, (curLen + nSize) >>> 0);
}

function stepSeedLcg(m: Memory113c, pSeed: number): number {
  const lo = BigInt(m.u32(pSeed));
  const hi = BigInt(m.u32(pSeed + 4));
  const prod = lo * 0x6ac690c5n + hi;
  const newLo = Number(prod & 0xffffffffn) >>> 0;
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0;
  m.setU32(pSeed, newLo);
  m.setU32(pSeed + 4, newHi);
  return newLo;
}

function checkUnitGuidInList0x80(m: Memory113c, pList: number, dwUnitId: number): number {
  const count = m.u16(pList + 0x80);
  for (let i = 0; i < count; i++) {
    if (m.u32(pList + i * 4) === (dwUnitId >>> 0)) {
      return 1;
    }
  }
  return 0;
}

const NPC_QUEST_CLASS_TO_INDEX: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [147, 1],
  [148, 2],
  [150, 3],
  [155, 4],
  [154, 5],
  [265, 6],
  [175, 7],
  [176, 8],
  [177, 9],
  [178, 10],
  [202, 11],
  [200, 12],
  [210, 13],
  [201, 14],
  [198, 15],
  [199, 16],
  [244, 17],
  [245, 18],
  [246, 19],
  [251, 20],
  [252, 21],
  [253, 22],
  [254, 23],
  [255, 24],
  [256, 25],
  [257, 26],
  [264, 27],
  [297, 28],
  [511, 29],
  [512, 30],
  [513, 31],
  [514, 32],
  [515, 33],
  [520, 34],
];

function checkPlayerNpcIntroBit(m: Memory113c, pPlayer: number, pGame: number, nNpcClassId: number): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const diff = m.u8(pGame + 0x6d);
  const pNpcIntroWrapper = m.u32(pPlayerData + diff * 4 + 0x60);
  let bitIdx = 0;
  for (let i = 0; i < NPC_QUEST_CLASS_TO_INDEX.length; i++) {
    if (NPC_QUEST_CLASS_TO_INDEX[i]![0] === nNpcClassId) {
      bitIdx = NPC_QUEST_CLASS_TO_INDEX[i]![1];
      break;
    }
  }
  const pInner = m.u32(pNpcIntroWrapper);
  const pBitBuf = m.u32(pInner);
  if (pBitBuf === 0 || bitIdx >= 64) {
    return 0;
  }
  const byteVal = m.u8((pBitBuf + (bitIdx >> 3)) >>> 0);
  const gdwBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C);
  const mask = gdwBitMasks !== 0 ? m.u32((gdwBitMasks + ((bitIdx & 7) << 2)) >>> 0) : (1 << (bitIdx & 7)) >>> 0;
  return (byteVal & mask) !== 0 ? 1 : 0;
}

function findPlayerQuestItemByCode(m: Memory113c, pUnit: number, pGame: number, dwCode: number): number {
  const pInventory = m.u32(pUnit + 0x60);
  if (pInventory === 0) {
    return 0;
  }
  const pCursor = INVENTORY_GetCursorItem113c(m, pInventory);
  if (pCursor !== 0 && ITEMS_GetBaseCode113c(m, pCursor) === (dwCode >>> 0)) {
    const pTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, i32(m, pCursor + 4));
    if (pTxt === 0 || m.u8(pTxt + 0x12a) === 0 || m.u8(pGame + 0x6d) <= STATLIST_GetUnitStat113c(m, pCursor, 0x164, 0)) {
      return pCursor;
    }
  }
  let pItem = INVENTORY_GetFirstItem113c(m, pInventory);
  while (pItem !== 0) {
    const pChecked = INVENTORY_UnitIsItem113c(m, pItem);
    if (
      ITEMS_GetBaseCode113c(m, pChecked) === (dwCode >>> 0) &&
      (ITEMS_GetInvPage113c(m, pChecked) & 0xff) !== 1
    ) {
      const classId = pChecked === 0 ? -1 : i32(m, pChecked + 4);
      const pTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, classId);
      if (
        pTxt === 0 ||
        m.u8(pTxt + 0x12a) === 0 ||
        m.u8(pTxt + 0x12b) === 0 ||
        m.u8(pGame + 0x6d) <= STATLIST_GetUnitStat113c(m, pChecked, 0x164, 0)
      ) {
        return pChecked;
      }
    }
    pItem = INVENTORY_GetNextItem113c(m, pItem);
  }
  return 0;
}

const OBSTACLE_HALF_SIZE_TABLE = new Uint8Array([
  2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
]);

function checkObstacleClearanceBetweenUnits(m: Memory113c, pTarget: number, pOrigin: number): number {
  if (pOrigin === 0 || pTarget === 0) {
    return 0;
  }
  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pOrigin, pTarget);
  const halfSize = dist >= 25 ? 3 : OBSTACLE_HALF_SIZE_TABLE[dist]!;
  const x1 = UNIT_GetPosX113c(m, pTarget);
  const y1 = UNIT_GetPosY113c(m, pTarget);
  const x2 = UNIT_GetPosX113c(m, pOrigin);
  const y2 = UNIT_GetPosY113c(m, pOrigin);
  const pRoom = UNITS_GetRoom113c(m, pOrigin);
  if (pRoom === 0) {
    return 0;
  }
  return UNITS_HasCollisionBetweenUnits113c(m, pOrigin, pTarget, halfSize) === 0 ? 1 : 0;
}

function checkUnitNextEventWithinFiveFrames(m: Memory113c, pUnit: number, pGame: number): number {
  const nextFrame = EVENT_GetNextEventFrame113c(m, pUnit, 1);
  const gameFrame = i32(m, pGame + 0xa8);
  return gameFrame <= ((nextFrame + 5) | 0) ? 1 : 0;
}

function checkSequenceSkillInterruptable(m: Memory113c, pUnit: number, pGame: number): number {
  const pSkill = SKILLS_GetUsedSkill113c(m, pUnit);
  if (pSkill !== 0) {
    const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(m, pSkill);
    if (pSkillsTxt !== 0 && m.u8(pSkillsTxt + 0x16) > 0) {
      return 1;
    }
  }
  return checkUnitNextEventWithinFiveFrames(m, pUnit, pGame);
}

function startUnitModeAtCoordsInternal(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pSkill: number,
  nMode: number,
  nX: number,
  nY: number,
  bForce: number,
): number {
  if (bForce === 0 && AITHINK_CanPlayerSwitchToMode113c(m, pUnit, pGame, nMode) === 0) {
    return 0;
  }
  if (pUnit !== 0 && m.u32(pUnit) <= 1) {
    SKILLS_SetUsedSkill113c(m, pUnit, pSkill);
    MONSTER_ClearModeEvents113c(m, pGame, pUnit);
  }
  const unitType = pUnit !== 0 ? m.u32(pUnit) : 6;
  if (unitType === 0) {
    UNITS_ChangeAnimMode113c(m, pUnit, nMode);
    return 1;
  }
  if (unitType === 1) {
    return MONSTER_StartMode113c(m, pGame, pUnit, nMode, 0, nX, nY);
  }
  if (unitType === 2 || unitType === 3 || unitType === 5) {
    UNITS_ChangeAnimMode113c(m, pUnit, nMode);
    return 1;
  }
  if (unitType === 4) {
    const pPath = m.u32(pUnit + 0x2c);
    if (pPath !== 0) {
      PATH_SetTargetPos113c(m, pPath, nX, nY);
    }
    UNITS_ChangeAnimMode113c(m, pUnit, nMode);
    MONSTER_RegisterContinuousModeEvent113c(m, pGame, pUnit);
    return 1;
  }
  return 0;
}

const MODE_DISPATCH_POST_TABLE: ReadonlyArray<readonly [number, number]> = [
  [8, 8],
  [7, 7],
  [1, 0],
  [23, 24],
  [6, 6],
  [7, 7],
  [1, 0],
  [21, 22],
];

// @va D2Game:0x6FCBCB30
export function AI_FollowPackLeaderOrAttack113c(
  m: Memory113c,
  pAiTickArgsPtr: number,
  pUnit: number,
  pGame: number,
): number {
  const pAiControl = m.u32(pAiTickArgsPtr);
  const leaderGuid = i32(m, pAiControl + 0xc);
  if (leaderGuid === -1) {
    return 0;
  }
  const classId = pUnit === 0 ? -1 : i32(m, pUnit + 4);
  if (MONSTATS_CheckFlagBit113c(m, classId, 2) === 0) {
    m.setU32(pAiControl + 0xc, 0xffffffff);
    return 0;
  }
  const pLeader = SUNIT_GetServerUnit113c(m, pGame, i32(m, pAiControl + 0x10), leaderGuid);
  if (pLeader === 0 || SUNIT_IsDeadOrDying113c(m, pLeader) !== 0) {
    m.setU32(pAiControl + 0xc, 0xffffffff);
    return 0;
  }
  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pUnit, pLeader);
  if (dist <= 1 && m.u32(pAiControl + 0x10) === 0) {
    if (MONSTER_StartMode113c(m, pGame, pUnit, 2, pLeader, 0, 0) !== 0) {
      return 1;
    }
  } else {
    if (dist <= 20) {
      return 0;
    }
    let pAiGeneral = 0;
    if (pUnit !== 0 && m.u32(pUnit) === 1) {
      const pMonsterData = m.u32(pUnit + 0x14);
      if (pMonsterData !== 0) {
        pAiGeneral = m.u32(pMonsterData + 0x2c);
      }
    }
    if (pAiGeneral !== 0) {
      m.setU32(pAiGeneral + 0x18, 7);
      m.setU8(pAiGeneral + 0x20, 0x28);
    }
  }
  if (pLeader === 0) {
    AI_Stall113c(m, pGame, pUnit, 2);
    return 1;
  }
  const targetX = UNIT_GetPosX113c(m, pLeader);
  const targetY = UNIT_GetPosY113c(m, pLeader);
  const pSeed = (pUnit + 0x20) >>> 0;
  const r0 = stepSeedLcg(m, pSeed);
  let dx = 0;
  let dy = 0;
  if ((r0 & 1) !== 0) {
    dy = 0x13;
    dx = SEED_RollLimitedFast113c(m, pSeed, 0x13);
  } else {
    dx = 0x13;
    dy = SEED_RollLimitedFast113c(m, pSeed, 0x13);
  }
  const r1 = stepSeedLcg(m, pSeed);
  if ((r1 & 1) !== 0) {
    dy = -dy;
  }
  const r2 = stepSeedLcg(m, pSeed);
  if ((r2 & 1) !== 0) {
    dx = -dx;
  }
  MONSTER_StartMode113c(m, pGame, pUnit, 2, 0, (targetX + dy) | 0, (targetY + dx) | 0);
  return 1;
}

// @va D2Game:0x6FCBCCF0
export function AI_TryOpenNearbyClosedDoor113c(
  m: Memory113c,
  pAiTickArgs: number,
  pUnit: number,
  pGame: number,
): number {
  const pMonStats = m.u32(pAiTickArgs + 0x1c);
  const flagsByte = m.u8(pMonStats + 0xc);
  const gdwBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C);
  const mask3 = gdwBitMasks !== 0 ? m.u8(gdwBitMasks + 0xc) : 8;
  if ((flagsByte & mask3) === 0) {
    return 0;
  }
  const pPath = m.u32(pUnit + 0x2c);
  if ((PATH_GetOrCheckLastCollisionMask113c(m, pPath) & 0x800) === 0) {
    return 0;
  }
  const ctx = m.alloc(8);
  m.setU32(ctx, 0);
  m.setU32(ctx + 4, 9);
  AITARGET_ScanUnitsByModeTable113c(m, 8, ctx, pGame, pUnit, 0);
  const pDoor = m.u32(ctx);
  freeMem(m, ctx);
  if (pDoor === 0) {
    return 0;
  }
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, i32(m, pDoor + 4));
  if (pObjTxt === 0 || m.u8(pObjTxt + 0x16d) === 0) {
    return 0;
  }
  const doorGuid = i32(m, pDoor + 0xc);
  const pResolvedDoor = SUNIT_GetServerUnit113c(m, pGame, 2, doorGuid);
  if (pResolvedDoor !== 0 && pUnit !== 0) {
    if (m.u32(pUnit) !== 1 || m.u8(pObjTxt + 0x16d) !== 0) {
      if (UNITS_IsUnitInObjRectRange113c(m, pUnit, pResolvedDoor) !== 0 && m.u32(pResolvedDoor + 0x10) === 0) {
        UNITS_ChangeAnimMode113c(m, pResolvedDoor, 1);
      }
    }
  }
  AI_Stall113c(m, pGame, pUnit, 5);
  return 1;
}

// @va D2Game:0x6FCBCD90
export function AI_HandleStunDoorOrLeaderFollow113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  pAiTickArgs: number,
): number {
  if (STATES_CheckState113c(m, pUnit, 0x15) !== 0) {
    AI_Stall113c(m, pGame, pUnit, 3);
    return 1;
  }
  if (AI_TryOpenNearbyClosedDoor113c(m, pAiTickArgs, pUnit, pGame) !== 0) {
    return 1;
  }
  const pAiTickArgsPtr = m.alloc(4);
  m.setU32(pAiTickArgsPtr, pAiTickArgs);
  const res = AI_FollowPackLeaderOrAttack113c(m, pAiTickArgsPtr, pUnit, pGame);
  freeMem(m, pAiTickArgsPtr);
  return res !== 0 ? 1 : 0;
}

// @va D2Game:0x6FCBCFE0
export function AI_AcquireOrValidateCombatTarget113c(
  m: Memory113c,
  pAiTickArgs: number,
  pUnit: number,
  pGame: number,
): number {
  const pTarget = m.u32(pAiTickArgs + 8);
  if (pTarget === 0) {
    return 0;
  }
  if (AI_CheckApproachTauntSound113c(m, pUnit, pAiTickArgs, pGame) !== 0) {
    return 1;
  }
  if (AI_TryMonsterTeleportEscape113c(m, pUnit, pGame, pAiTickArgs) !== 0) {
    return 1;
  }
  const classId = pUnit === 0 ? -1 : i32(m, pUnit + 4);
  if (MONSTATS2_CheckModeBit113c(m, classId, 1) === 0) {
    return 0;
  }
  if (MONSTATS_CheckFlagBit113c(m, classId, 2) === 0) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  if (pRoom === 0) {
    return 0;
  }
  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom);
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, levelId);
  if (pLevelsTxt === 0) {
    return 0;
  }
  const losDraw = m.u8(pLevelsTxt + 0x2f);
  if (losDraw <= 0 || m.u32(pAiTickArgs + 0x14) <= (losDraw >>> 0)) {
    return 0;
  }
  const pCurTarget = m.u32(pAiTickArgs + 8);
  if (checkObstacleClearanceBetweenUnits(m, pCurTarget, pUnit) !== 0) {
    return 0;
  }
  const ctx = m.alloc(12);
  m.setU32(ctx, 0);
  m.setU32(ctx + 4, 0x7fffffff);
  m.setU32(ctx + 8, pCurTarget);
  AITARGET_ScanUnitsByModeTable113c(m, 0x0b, ctx, pGame, pUnit, 0);
  const pNewTarget = m.u32(ctx);
  const newDist = m.u32(ctx + 4);
  freeMem(m, ctx);
  if (pNewTarget === 0) {
    AI_IdleWander113c(m, pGame, pUnit);
    return 1;
  }
  m.setU32(pAiTickArgs + 8, pNewTarget);
  m.setU32(pAiTickArgs + 0x14, newDist);
  return 0;
}

// @va D2Game:0x6FC53B70
export function QUESTS_StepQuestTimers113c(m: Memory113c, pGame: number): void {
  const pQuestControl = m.u32(pGame + 0x10f4);
  if (pQuestControl === 0) {
    return;
  }
  const nextTick = (m.u32(pQuestControl + 0x14) + 1) >>> 0;
  m.setU32(pQuestControl + 0x14, nextTick);
  if (nextTick === 0xffffffff) {
    let pNode = m.u32(pQuestControl + 0x10);
    while (pNode !== 0) {
      const oldFire = m.u32(pNode + 8);
      m.setU32(pNode + 8, (0xffffffff - oldFire) >>> 0);
      pNode = m.u32(pNode + 0x10);
    }
  }
  let pCurr = m.u32(pQuestControl + 0x10);
  let pPrev = 0;
  m.setU32(pQuestControl + 4, 1);
  while (pCurr !== 0) {
    const fireTick = m.u32(pCurr + 8);
    const curTick = m.u32(pQuestControl + 0x14);
    const pNext = m.u32(pCurr + 0x10);
    if (fireTick < curTick) {
      const pfnTimer = m.u32(pCurr);
      if (pfnTimer === 0) {
        throw new D2CommonAssertError('QUESTS_StepQuestTimers113c: IsBadCodePtr(pfnTimer)', 0x3f0);
      }
      const removeFlag = 0 as number;
      if (removeFlag === 1) {
        if (pPrev === 0) {
          m.setU32(pQuestControl + 0x10, pNext);
          freeMem(m, pCurr);
          pCurr = 0;
        } else {
          m.setU32(pPrev + 0x10, pNext);
          freeMem(m, pCurr);
          pCurr = pPrev;
        }
      } else {
        const period = m.u32(pCurr + 0xc);
        m.setU32(pCurr + 8, (curTick + period) >>> 0);
      }
    }
    pPrev = pCurr;
    pCurr = pNext;
  }
  m.setU32(pQuestControl + 4, 0);
}

// @va D2Game:0x6FC54EA0
export function QUESTS_CheckNpcQuestInteractAlert113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
  pNpc: number,
): number {
  if (pPlayer === 0 || m.u32(pPlayer) !== 0) {
    throw new D2CommonAssertError('QUESTS_CheckNpcQuestInteractAlert113c: invalid player', 0x7ec);
  }
  if (pNpc === 0 || m.u32(pNpc) !== 1) {
    throw new D2CommonAssertError('QUESTS_CheckNpcQuestInteractAlert113c: invalid npc', 0x7ed);
  }
  const npcClassId = i32(m, pNpc + 4);
  if (MONSTATS2_CheckModeBit113c(m, npcClassId, 9) === 0) {
    return 0;
  }
  const pQuestControl = m.u32(pGame + 0x10f4);
  if (pQuestControl === 0 || m.u32(pQuestControl + 8) === 0) {
    throw new D2CommonAssertError('QUESTS_CheckNpcQuestInteractAlert113c: quest control uninitialized', 0x7f4);
  }
  const pClient = m.u32(UNITS_GetPlayerData113c(m, pPlayer) + 0x9c);
  const playerAct = SPLAYER_GetClientActNo113c(m, pClient);
  let pQuest = m.u32(pQuestControl);
  while (pQuest !== 0) {
    if (m.u8(pQuest + 8) === playerAct) {
      const pfnCheck = m.u32(pQuest + 0xec);
      if (pfnCheck === 0) {
        throw new D2CommonAssertError('QUESTS_CheckNpcQuestInteractAlert113c: null pfnCheck', 0x813);
      }
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
      if (pPlayerData === 0) {
        throw new D2CommonAssertError('QUESTS_CheckNpcQuestInteractAlert113c: null player data', 0x803);
      }
      const diff = m.u8(pGame + 0x6d);
      const pQuestFlags = m.u32(pPlayerData + diff * 4 + 0x10);
      if (pQuestFlags === 0) {
        throw new D2CommonAssertError('QUESTS_CheckNpcQuestInteractAlert113c: null quest flags', 0x805);
      }
      if (dispatchQuestNpcAlertCallback(m, pfnCheck, pQuest, pPlayer, npcClassId, pQuestFlags, pNpc) !== 0) {
        const pkt = m.alloc(6);
        m.setU8(pkt, 0x8a);
        m.setU8(pkt + 1, 1);
        m.setU32(pkt + 2, m.u32(pNpc + 0xc));
        const sendClient = m.u32(pPlayer) === 0 ? m.u32(UNITS_GetPlayerData113c(m, pPlayer) + 0x9c) : 0;
        D2NET_SendPacket0x06BytesToClient113c(m, pkt, sendClient);
        freeMem(m, pkt);
        return 1;
      }
    }
    pQuest = m.u32(pQuest + 0xf4);
  }
  return 0;
}

function dispatchQuestNpcAlertCallback(
  m: Memory113c,
  pfnCheck: number,
  pQuest: number,
  pPlayer: number,
  npcClassId: number,
  pQuestFlags: number,
  pNpc: number,
): number {
  switch (pfnCheck >>> 0) {
    case 0x6fc80660:
      return ACT1Q1_CheckDenOfEvilNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    case 0x6fc80750:
      return ACT1Q2_CheckBloodRavenNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    case 0x6fc807d0:
      return ACT1Q0_CheckWarrivIntroNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    case 0x6fc80820:
      return ACT1Q6_CheckTravelEastNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    case 0x6fc80940:
      return ACT1Q5_CheckCharsiImbueNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    case 0x6fc80f20:
      return ACT1Q4_CheckCainTownNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    case 0x6fc81750:
      return ACT1Q4_CheckSearchForCainNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    case 0x6fc81b70:
      return ACT1Q3_CheckMalusNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    case 0x6fc82df0:
      return ACT1Q2_CheckAkaraIntroNpcAlert113c(m, pQuest, npcClassId, pPlayer, pQuestFlags, pNpc);
    default:
      return 0;
  }
}

// @va D2Game:0x6FC69DB0
export function SPLAYER_GetClientActNo113c(m: Memory113c, pClient: number): number {
  if (pClient === 0) {
    throw new D2CommonAssertError('SPLAYER_GetClientActNo113c: pClient == NULL', 0x7cb);
  }
  return m.u8(pClient + 0x1ac);
}

// @va D2Game:0x6FC80660
export function ACT1Q1_CheckDenOfEvilNpcAlert113c(
  m: Memory113c,
  pQuest: number,
  nNpcClassId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpc: number,
): number {
  if (nNpcClassId !== 0x96) {
    return 0;
  }
  const questId = i32(m, pQuest + 0xe0);
  if (checkQuestBitStateHelper(m, pQuestFlags, questId, 0) === 1) {
    return 0;
  }
  if (m.u8(pQuest + 0xc) === 1) {
    if (checkQuestBitStateHelper(m, pQuestFlags, i32(m, pQuest + 0xe0), 1) === 0) {
      return 1;
    }
  }
  if (checkQuestBitStateHelper(m, pQuestFlags, i32(m, pQuest + 0xe0), 1) !== 1) {
    return 0;
  }
  return 1;
}

// @va D2Game:0x6FC80750
export function ACT1Q2_CheckBloodRavenNpcAlert113c(
  m: Memory113c,
  pQuest: number,
  nNpcClassId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpc: number,
): number {
  if (nNpcClassId !== 0x94) {
    return 0;
  }
  const questId = i32(m, pQuest + 0xe0);
  if (checkQuestBitStateHelper(m, pQuestFlags, questId, 0) === 1) {
    return 0;
  }
  if (m.u8(pQuest + 9) === 1 && m.u8(pQuest + 0xc) === 1) {
    if (checkQuestBitStateHelper(m, pQuestFlags, i32(m, pQuest + 0xe0), 1) === 0) {
      return 1;
    }
  }
  if (checkQuestBitStateHelper(m, pQuestFlags, i32(m, pQuest + 0xe0), 1) !== 1) {
    return 0;
  }
  return 1;
}

// @va D2Game:0x6FC807D0
export function ACT1Q0_CheckWarrivIntroNpcAlert113c(
  m: Memory113c,
  _pQuest: number,
  nNpcClassId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpc: number,
): number {
  if (nNpcClassId !== 0x9b) {
    return 0;
  }
  if (checkQuestBitStateHelper(m, pQuestFlags, 0, 0) !== 0) {
    return 0;
  }
  return 1;
}

// @va D2Game:0x6FC80820
export function ACT1Q6_CheckTravelEastNpcAlert113c(
  m: Memory113c,
  pQuest: number,
  nNpcClassId: number,
  pPlayer: number,
  _pQuestFlags: number,
  _pNpc: number,
): number {
  if (nNpcClassId !== 0x10a) {
    return 0;
  }
  const pGame = m.u32(pQuest + 4);
  const pQuestControl = m.u32(pGame + 0x10f4);
  let pQ1 = 0;
  if (pQuestControl !== 0) {
    let pCur = m.u32(pQuestControl);
    while (pCur !== 0) {
      if (m.u32(pCur) === 1) {
        pQ1 = pCur;
        break;
      }
      pCur = m.u32(pCur + 0xf4);
    }
  }
  if (pQ1 === 0 || m.u8(pQ1 + 9) === 0) {
    return 0;
  }
  if (m.u32(pQuestControl + 8) === 0) {
    throw new D2CommonAssertError('ACT1Q6_CheckTravelEastNpcAlert113c: null quest control state', 0x82c);
  }
  const pGlobalFlags = m.u32(pQuestControl + 0xc);
  if (checkQuestBitStateHelper(m, pGlobalFlags, 1, 0x0d) !== 0) {
    return 0;
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const diff = m.u8(pGame + 0x6d);
  const pPlayerQuestFlags = m.u32(pPlayerData + diff * 4 + 0x10);
  if (checkQuestBitStateHelper(m, pPlayerQuestFlags, 1, 0) !== 0) {
    return 0;
  }
  if (checkQuestBitStateHelper(m, pPlayerQuestFlags, 1, 0x0d) !== 0) {
    return 0;
  }
  if (checkQuestBitStateHelper(m, pPlayerQuestFlags, 1, 1) !== 0) {
    return 0;
  }
  return 1;
}

// @va D2Game:0x6FC80940
export function ACT1Q5_CheckCharsiImbueNpcAlert113c(
  m: Memory113c,
  pQuest: number,
  nNpcClassId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpc: number,
): number {
  const playerGuid = pPlayer === 0 ? 0xffffffff : m.u32(pPlayer + 0xc);
  const pQuestData = m.u32(pQuest + 0x18);
  if (nNpcClassId === 0x109) {
    const count = m.u16(pQuestData + 0x80);
    for (let i = 0; i < count; i++) {
      if (m.u32(pQuestData + i * 4) === playerGuid) {
        return 1;
      }
    }
    if (checkQuestBitStateHelper(m, pQuestFlags, 6, 0) === 1) {
      return 0;
    }
    if (m.u8(pQuest + 0xc) !== 1) {
      return 0;
    }
    if (checkQuestBitStateHelper(m, pQuestFlags, 6, 1) !== 0) {
      return 0;
    }
    return 1;
  }
  if (nNpcClassId === 0x9b) {
    if (checkQuestBitStateHelper(m, pQuestFlags, 6, 0) === 1) {
      return 0;
    }
    return checkQuestBitStateHelper(m, pQuestFlags, 6, 1) === 1 ? 1 : 0;
  }
  if (nNpcClassId === 0x94) {
    return checkUnitGuidInList0x80(m, (pQuestData + 0x84) >>> 0, playerGuid) !== 0 ? 1 : 0;
  }
  if (nNpcClassId === 0x96) {
    return checkUnitGuidInList0x80(m, (pQuestData + 0x108) >>> 0, playerGuid) !== 0 ? 1 : 0;
  }
  return 0;
}

// @va D2Game:0x6FC80F20
export function ACT1Q4_CheckCainTownNpcAlert113c(
  m: Memory113c,
  pQuest: number,
  nNpcClassId: number,
  pPlayer: number,
  _pQuestFlags: number,
  _pNpc: number,
): number {
  const pQuestData = m.u32(pQuest + 0x18);
  const playerGuid = pPlayer === 0 ? 0xffffffff : m.u32(pPlayer + 0xc);
  const count = m.u16(pQuestData + 0x64);
  for (let i = 0; i < count; i++) {
    if (m.u32(pQuestData + 0x34 + i * 4) === playerGuid) {
      if (nNpcClassId === 0x9b || nNpcClassId === 0x93) {
        return 0;
      }
      return 1;
    }
  }
  return 0;
}

// @va D2Game:0x6FC81750
export function ACT1Q4_CheckSearchForCainNpcAlert113c(
  m: Memory113c,
  pQuest: number,
  nNpcClassId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpc: number,
): number {
  const bBit13 = checkQuestBitStateHelper(m, pQuestFlags, 4, 0x0d);
  let bBit0 = checkQuestBitStateHelper(m, pQuestFlags, 4, 0);
  const bBit1 = checkQuestBitStateHelper(m, pQuestFlags, 4, 1);
  if (nNpcClassId === 0x94) {
    if (m.u8(pQuest + 0xc) === 4 && bBit0 === 0 && bBit1 === 0) {
      if ( pPlayer === 0 ) {
        throw new D2CommonAssertError('ACT1Q4_CheckSearchForCainNpcAlert113c: null player', 0xa2a);
      }
      const pGame = m.u32(pPlayer + 0x80);
      if (findPlayerQuestItemByCode(m, pPlayer, pGame, 0x20736b62) !== 0) {
        return 1;
      }
      bBit0 = 0;
    }
    const qState = m.u8(pQuest + 0xc);
    if (qState === 1 && bBit0 === 0 && bBit1 === 0) {
      return 1;
    }
    if (qState === 6 && bBit13 === 1 && bBit0 === 0) {
      return 1;
    }
    return bBit1 !== 0 ? 1 : 0;
  }
  if (nNpcClassId === 0x109) {
    const pQuestData = m.u32(pQuest + 0x18);
    const playerGuid = pPlayer === 0 ? 0xffffffff : m.u32(pPlayer + 0xc);
    const count = m.u16(pQuestData + 0x134);
    for (let i = 0; i < count; i++) {
      if (m.u32(pQuestData + 0xb4 + i * 4) === playerGuid) {
        return 1;
      }
    }
    if (checkUnitGuidInList0x80(m, (pQuestData + 0x138) >>> 0, playerGuid) !== 0) {
      return 0;
    }
    return bBit13 !== 0 ? 1 : 0;
  }
  return 0;
}

// @va D2Game:0x6FC81B70
export function ACT1Q3_CheckMalusNpcAlert113c(
  m: Memory113c,
  pQuest: number,
  nNpcClassId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpc: number,
): number {
  if (nNpcClassId !== 0x9a) {
    return 0;
  }
  if (checkQuestBitStateHelper(m, pQuestFlags, 3, 0) === 1) {
    return 0;
  }
  if (m.u8(pQuest + 0xc) === 1) {
    if (checkQuestBitStateHelper(m, pQuestFlags, 3, 1) === 0) {
      return 1;
    }
  }
  if (STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x0c, 0) < 8) {
    return 0;
  }
  if (pPlayer === 0) {
    throw new D2CommonAssertError('ACT1Q3_CheckMalusNpcAlert113c: null player', 0xa2a);
  }
  const pGame = m.u32(pPlayer + 0x80);
  if (findPlayerQuestItemByCode(m, pPlayer, pGame, 0x206d6468) === 0) {
    return 0;
  }
  return 1;
}

// @va D2Game:0x6FC82DF0
export function ACT1Q2_CheckAkaraIntroNpcAlert113c(
  m: Memory113c,
  pQuest: number,
  nNpcClassId: number,
  pPlayer: number,
  _pQuestFlags: number,
  _pNpc: number,
): number {
  const pGame = m.u32(pQuest + 4);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const diff = m.u8(pGame + 0x6d);
  const pFlags = m.u32(pPlayerData + diff * 4 + 0x10);
  if (checkQuestBitStateHelper(m, pFlags, 1, 0) === 1) {
    return 0;
  }
  if (nNpcClassId !== 0x94) {
    return 0;
  }
  if (checkPlayerNpcIntroBit(m, pPlayer, m.u32(pQuest + 4), nNpcClassId) !== 0) {
    return 0;
  }
  return 1;
}

// @va D2Game:0x6FC94D50
export function PLAYER_RecalcTargetUnitPath113c(
  m: Memory113c,
  nNewDist: number,
  pPathSyncState: number,
  pUnit: number,
  _unusedArg: number,
): number {
  const pPath = m.u32(pUnit + 0x2c);
  PATH_SetNewDistance113c(m, pPath, nNewDist);
  const pTarget = PATH_GetTargetUnit113c(m, pPath);
  const lastX = PATH_GetLastPointX113c(m, pPath);
  const lastY = PATH_GetLastPointY113c(m, pPath);
  if (
    pTarget !== m.u32(pPathSyncState + 4) ||
    lastX !== i32(m, pPathSyncState + 8) ||
    lastY !== i32(m, pPathSyncState + 0xc)
  ) {
    m.setU32(pPathSyncState + 4, pTarget);
    m.setU32(pPathSyncState + 8, lastX);
    m.setU32(pPathSyncState + 0xc, lastY);
    m.setU8(pPathSyncState, 0);
    m.setU8(pPathSyncState + 1, 0);
  }
  const pathType = PATH_GetType113c(m, pPath);
  PATH_SetType113c(m, pPath, pathType);
  const nPoints = PATH_Compute113c(m, pPath, pUnit, 0);
  if (nPoints !== 0) {
    UNITROOM_RefreshUnit113c(m, pUnit);
    m.setU32(pUnit + 0xc4, (m.u32(pUnit + 0xc4) | 1) >>> 0);
    m.setU8(pPathSyncState, 0);
    m.setU8(pPathSyncState + 1, 0);
    return pathType;
  }
  if (pathType === 2 || pathType === 7 || pathType === 9 || pathType === 13) {
    UNITROOM_RefreshUnit113c(m, pUnit);
    m.setU32(pUnit + 0xc4, (m.u32(pUnit + 0xc4) | 1) >>> 0);
    PATH_SetType113c(m, pPath, 0x0f);
    PATH_Compute113c(m, pPath, pUnit, 0);
    return 0x0f;
  }
  return pathType;
}

// @va D2Game:0x6FCAA770
export function D2NET_SendPacket0x06BytesToClient113c(m: Memory113c, pPacket6: number, pClient: number): void {
  const buf = m.alloc(8);
  m.setU32(buf, m.u32(pPacket6));
  m.setU16(buf + 4, m.u16(pPacket6 + 4));
  appendClientNetPacketNode(m, pClient, buf, 6);
  freeMem(m, buf);
}

// @va D2Game:0x6FCADB00
export function D2NET_SendUnitPosSync0x15ToClient113c(
  m: Memory113c,
  dwUnitId: number,
  nUnitType: number,
  pClient: number,
  bRealign: number,
  wPosX: number,
  wPosY: number,
  bUnkFlag: number,
): void {
  if (pClient === 0) {
    throw new D2CommonAssertError('D2NET_SendUnitPosSync0x15ToClient113c: pClient == NULL', 0x996);
  }
  const pGame = m.u32(pClient + 0x1a8);
  if (pGame === 0) {
    throw new D2CommonAssertError('D2NET_SendUnitPosSync0x15ToClient113c: pGame == NULL', 0x2d3);
  }
  const bucket = dwUnitId & 0x7f;
  let pMonster = m.u32(pGame + bucket * 4 + 0x1320);
  while (pMonster !== 0) {
    if (m.u32(pMonster + 0xc) === (dwUnitId >>> 0)) {
      break;
    }
    pMonster = m.u32(pMonster + 0xe4);
  }
  if (pMonster === 0) {
    return;
  }
  const pkt = m.alloc(0x10);
  zeroMem(m, pkt, 0x10);
  m.setU8(pkt, nUnitType & 0xff);
  m.setU32(pkt + 1, dwUnitId >>> 0);
  m.setU8(pkt + 5, bRealign & 0xff);
  m.setU16(pkt + 6, wPosX & 0xffff);
  m.setU16(pkt + 8, wPosY & 0xffff);
  m.setU8(pkt + 0x0a, bUnkFlag & 0xff);
  const pPath = m.u32(pMonster + 0x2c);
  const stepNum = PATH_GetNumberOfPathPoints113c(m, pPath) & 0xff;
  m.setU8(pkt + 8, stepNum);
  if (stepNum >= 5) {
    if (stepNum <= 6) {
      m.setU8(pkt + 0x0c, 1);
      m.setU16(pkt + 6, PATH_GetFirstPointX113c(m, pPath) & 0xffff);
      m.setU16(pkt + 4, PATH_GetFirstPointY113c(m, pPath) & 0xffff);
    } else if (stepNum === 8) {
      m.setU8(pkt + 8, 0x0b);
    }
  }
  let velPct = STATLIST_GetUnitStat113c(m, pMonster, 0x43, 0);
  if (velPct <= -32768) {
    velPct = -32768;
  } else if (velPct >= 32767) {
    velPct = 32767;
  }
  m.setU16(pkt + 0x0d, velPct & 0xffff);
  const maxDist = PATH_GetMaxDistance113c(m, pPath) & 0xff;
  m.setU8(pkt + 0x0f, maxDist);
  appendClientNetPacketNode(m, pClient, pkt, 0x10);
  freeMem(m, pkt);
}

// @va D2Game:0x6FCD11A0
export function AITARGET_IterateRoomActiveClients113c(
  m: Memory113c,
  pGame: number,
  pOriginUnit: number,
  pCtx: number,
  pfnCallback: number,
): number {
  const pRoom = UNITS_GetRoom113c(m, pOriginUnit);
  if (pRoom === 0) {
    return 0;
  }
  const ppRoomsPtr = m.alloc(8);
  const pNumRoomsPtr = (ppRoomsPtr + 4) >>> 0;
  DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, ppRoomsPtr, pNumRoomsPtr);
  const numRooms = m.u32(pNumRoomsPtr);
  const ppRooms = m.u32(ppRoomsPtr);
  freeMem(m, ppRoomsPtr);
  for (let i = 0; i < numRooms; i++) {
    const pAdjRoom = m.u32(ppRooms + i * 4);
    const numClients = m.u32(pAdjRoom + 0x78);
    const ppClients = m.u32(pAdjRoom + 0x48);
    for (let j = 0; j < numClients; j++) {
      const pClient = m.u32(ppClients + j * 4);
      if (pClient === 0) {
        throw new D2CommonAssertError('AITARGET_IterateRoomActiveClients113c: null client in room list', 0xfb);
      }
      let pPlayerUnit = 0;
      if ((m.u8(pClient + 0x3d4) & 1) !== 0) {
        pPlayerUnit = m.u32(pClient + 0x174);
      } else if (m.u32(pClient + 0x174) !== 0) {
        pPlayerUnit = SUNIT_GetServerUnit113c(
          m,
          m.u32(pClient + 0x1a8),
          i32(m, pClient + 0x16c),
          i32(m, pClient + 0x170),
        );
        if (pPlayerUnit === 0) {
          m.setU32(pClient + 0x174, 0);
        }
      }
      if (pPlayerUnit !== 0) {
        const res = dispatchAiTargetCallback(m, pfnCallback, pGame, pOriginUnit, pPlayerUnit, pCtx);
        if (res !== 0) {
          return res;
        }
      }
    }
  }
  return 0;
}

const CB_ID_MODE_4 = 4;
const CB_ID_MODE_8 = 8;
const CB_ID_MODE_11 = 11;
const CB_ID_MODE_12 = 12;

function dispatchAiTargetCallback(
  m: Memory113c,
  pfnCallback: number,
  pGame: number,
  pOriginUnit: number,
  pCandidateUnit: number,
  pCtx: number,
): number {
  switch (pfnCallback >>> 0) {
    case 0x6fd11a90:
      return AI_FindNearestPlayerCallback113c(m, pGame, pOriginUnit, pCandidateUnit, pCtx);
    case CB_ID_MODE_4: {
      if (pCandidateUnit === 0 || m.u32(pCandidateUnit) !== 1 || m.u32(pCandidateUnit + 0x10) !== 0) {
        return 0;
      }
      const dist = AI_CalcApproxUnitDistSubtiles113c(m, pCandidateUnit, pOriginUnit);
      return dist < i32(m, pCtx) ? pCandidateUnit : 0;
    }
    case CB_ID_MODE_8: {
      if (pCandidateUnit === 0 || m.u32(pCandidateUnit) !== 2) {
        return 0;
      }
      if (UNITS_IsDoor113c(m, pCandidateUnit) === 0 || m.u32(pCandidateUnit + 0x10) !== 0) {
        return 0;
      }
      const dist = UNIT_CalcSqDistSubtiles113c(m, pCandidateUnit, pOriginUnit);
      if (dist < i32(m, pCtx + 4)) {
        m.setU32(pCtx, pCandidateUnit);
        m.setU32(pCtx + 4, dist);
      }
      return 0;
    }
    case CB_ID_MODE_11: {
      if (pCandidateUnit === m.u32(pCtx + 8)) {
        return 0;
      }
      if (pCandidateUnit === 0 || SUNIT_IsDeadOrDying113c(m, pCandidateUnit) !== 0) {
        return 0;
      }
      const dist = AI_CalcApproxUnitDistSubtiles113c(m, pCandidateUnit, pOriginUnit);
      if (dist > 0x30) {
        return 0;
      }
      const alignOrigin = UNIT_GetAlignment113c(m, pOriginUnit);
      const alignCand = UNIT_GetAlignment113c(m, pCandidateUnit);
      if (alignOrigin === alignCand) {
        return 0;
      }
      if (dist >= i32(m, pCtx + 4)) {
        return 0;
      }
      if (checkObstacleClearanceBetweenUnits(m, pCandidateUnit, pOriginUnit) !== 0) {
        m.setU32(pCtx, pCandidateUnit);
        m.setU32(pCtx + 4, dist);
      }
      return 0;
    }
    case CB_ID_MODE_12: {
      if (pCandidateUnit === 0 || m.u32(pCandidateUnit) !== 1) {
        return 0;
      }
      if (i32(m, pCandidateUnit + 4) !== i32(m, pCtx)) {
        return 0;
      }
      if (SUNIT_IsDeadOrDying113c(m, pCandidateUnit) !== 0) {
        return 0;
      }
      const dist = AI_CalcApproxUnitDistSubtiles113c(m, pOriginUnit, pCandidateUnit);
      if (dist <= i32(m, pCtx + 4)) {
        m.setU32(pCtx + 8, (m.u32(pCtx + 8) + 1) >>> 0);
      }
      return 0;
    }
    default:
      return 0;
  }
}

const AITARGET_SCAN_MODE_TABLE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, 0],
  [1, 0],
  [0, 3],
  [0, CB_ID_MODE_4],
  [2, 5],
  [0, 6],
  [0, 7],
  [0, CB_ID_MODE_8],
  [3, 9],
  [3, 0],
  [2, CB_ID_MODE_11],
  [0, CB_ID_MODE_12],
  [0, 0],
];

// @va D2Game:0x6FCD17B0
export function AITARGET_ScanUnitsByModeTable113c(
  m: Memory113c,
  nScanIndex: number,
  pCtx: number,
  pGame: number,
  pOriginUnit: number,
  pfnOverrideCallback: number,
): number {
  const entry = AITARGET_SCAN_MODE_TABLE[nScanIndex];
  const mode = entry !== undefined ? entry[0] : 0;
  const defaultCb = entry !== undefined ? entry[1] : 0;
  const pfnCb = defaultCb !== 0 ? defaultCb : pfnOverrideCallback;
  if (pfnCb === 0) {
    return 0;
  }
  if (mode === 1) {
    return AITARGET_IterateRoomActiveClients113c(m, pGame, pOriginUnit, pCtx, pfnCb);
  }
  if (mode === 2) {
    if (pOriginUnit === 0) {
      return 0;
    }
    const uType = i32(m, pOriginUnit);
    if (uType < 0 || uType > 1 || SUNIT_IsDeadOrDying113c(m, pOriginUnit) !== 0) {
      return 0;
    }
    const pRoom = UNITS_GetRoom113c(m, pOriginUnit);
    if (pRoom === 0) {
      return 0;
    }
    const ppRoomsPtr = m.alloc(8);
    const pNumRoomsPtr = (ppRoomsPtr + 4) >>> 0;
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, ppRoomsPtr, pNumRoomsPtr);
    const numRooms = m.u32(pNumRoomsPtr);
    const ppRooms = m.u32(ppRoomsPtr);
    freeMem(m, ppRoomsPtr);
    for (let i = 0; i < numRooms; i++) {
      const pAdjRoom = m.u32(ppRooms + i * 4);
      if (DUNGEON_CheckRoomIsTownMemPort113c(m, pAdjRoom) === 0 && m.u32(pAdjRoom + 0x78) !== 0) {
        let pUnit = m.u32(pAdjRoom + 0x74);
        while (pUnit !== 0) {
          const res = dispatchAiTargetCallback(m, pfnCb, pGame, pOriginUnit, pUnit, pCtx);
          if (res !== 0) {
            return res;
          }
          pUnit = m.u32(pUnit + 0xe8);
        }
      }
    }
    return 0;
  }
  if (mode === 3) {
    const pLeader = AIGENERAL_GetPackLeaderUnit113c(m, pOriginUnit);
    if (pLeader === 0 || m.u32(pLeader) !== 1) {
      return 0;
    }
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pOriginUnit);
  if (pRoom === 0) {
    return 0;
  }
  const ppRoomsPtr = m.alloc(8);
  const pNumRoomsPtr = (ppRoomsPtr + 4) >>> 0;
  DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pRoom, ppRoomsPtr, pNumRoomsPtr);
  const numRooms = m.u32(pNumRoomsPtr);
  const ppRooms = m.u32(ppRoomsPtr);
  freeMem(m, ppRoomsPtr);
  for (let i = 0; i < numRooms; i++) {
    const pAdjRoom = m.u32(ppRooms + i * 4);
    let pUnit = m.u32(pAdjRoom + 0x74);
    while (pUnit !== 0) {
      const res = dispatchAiTargetCallback(m, pfnCb, pGame, pOriginUnit, pUnit, pCtx);
      if (res !== 0) {
        return res;
      }
      pUnit = m.u32(pUnit + 0xe8);
    }
  }
  return 0;
}

// @va D2Game:0x6FD11A90
export function AI_FindNearestPlayerCallback113c(
  m: Memory113c,
  pGame: number,
  pMonster: number,
  pCandidatePlayer: number,
  pCtx: number,
): number {
  if (pCandidatePlayer === 0 || m.u32(pCandidatePlayer) !== 0) {
    return 0;
  }
  const dist = AI_CalcApproxUnitDistSubtiles113c(m, pMonster, pCandidatePlayer);
  if (dist > 0x0f) {
    return 0;
  }
  const classId = pMonster === 0 ? -1 : i32(m, pMonster + 4);
  if (MONSTATS2_CheckModeBit113c(m, classId, 9) === 0) {
    m.setU32(pCtx + 4, dist);
    m.setU32(pCtx, pCandidatePlayer);
    return pCandidatePlayer;
  }
  if (QUESTS_CheckNpcQuestInteractAlert113c(m, pCandidatePlayer, pGame, pMonster) !== 0) {
    if (dist < i32(m, pCtx + 4)) {
      m.setU32(pCtx + 4, dist);
      m.setU32(pCtx, pCandidatePlayer);
      return pCandidatePlayer;
    }
  }
  return 0;
}

// @va D2Game:0x6FC97FA0
export function AITHINK_CanPlayerStartSkillOrCast113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nTargetMode: number,
  bCheckSkill: number,
  pTargetSkill: number,
): number {
  if (STATES_CheckState113c(m, pUnit, 0x36) !== 0) {
    return 0;
  }
  if (pUnit === 0) {
    return 0;
  }
  const curMode = m.u32(pUnit + 0x10);
  if (curMode === 0 || curMode === 0x11) {
    return 0;
  }
  if (nTargetMode === 0 || bCheckSkill === 0) {
    return 1;
  }
  const pUsedSkill = SKILLS_GetUsedSkill113c(m, pUnit);
  if (pUsedSkill === 0) {
    return 1;
  }
  const skillId = SKILLS_GetSkillIdFromSkill113c(m, pUsedSkill, 0, 0xba);
  const pSkillsTxt = SKILLS_GetRecordPtrFast113c(m, skillId);
  if (pSkillsTxt === 0) {
    return 1;
  }
  if (pTargetSkill === pUsedSkill) {
    const weapClass = m.u16(pSkillsTxt + 0x2e);
    if (weapClass === 0x43 || weapClass === 0x4c) {
      return 1;
    }
  }
  const gdwBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C);
  const mask7 = gdwBitMasks !== 0 ? m.u8(gdwBitMasks + 0x1c) : 0x80;
  if ((m.u8(pSkillsTxt + 7) & mask7) !== 0) {
    let bShouldStop = 0;
    if (STATES_CheckState113c(m, pUnit, 0x2a) !== 0) {
      const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, 0x2a);
      const concPct = STATLIST_GetStatValue113c(m, pStatList, 0xa4, 0);
      const roll = SEED_RollLimitedRandomNumber113c(m, (pUnit + 0x20) >>> 0, 100);
      if (roll < concPct) {
        bShouldStop = 1;
      }
    }
    if (bShouldStop === 0) {
      if (STATES_CheckState113c(m, pUnit, 0x0f) === 0) {
        return 1;
      }
    }
    if (m.u32(pUnit + 0x10) !== 1) {
      return 0;
    }
    startUnitModeAtCoordsInternal(m, pGame, pUnit, 0, 1, 0, 0, 1);
    return 1;
  }
  if (m.u32(pUnit + 0x10) === 1) {
    startUnitModeAtCoordsInternal(m, pGame, pUnit, 0, 1, 0, 0, 1);
    return 1;
  }
  if (
    nTargetMode === 7 ||
    nTargetMode === 8 ||
    nTargetMode === 10 ||
    nTargetMode === 11 ||
    nTargetMode === 13 ||
    nTargetMode === 18
  ) {
    return checkUnitNextEventWithinFiveFrames(m, pUnit, pGame) !== 0 ? 1 : 0;
  }
  return 0;
}

// @va D2Game:0x6FC98340
export function AITHINK_CanPlayerSwitchToMode113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nTargetMode: number,
): number {
  const pInventory = m.u32(pUnit + 0x60);
  if (pInventory !== 0 && INVENTORY_GetCursorItem113c(m, pInventory) !== 0) {
    if (nTargetMode !== 0 && nTargetMode !== 0x11) {
      return 0;
    }
  }
  if (nTargetMode === 0 || nTargetMode === 1 || nTargetMode === 5 || nTargetMode === 0x11) {
    return 1;
  }
  const curMode = m.u32(pUnit + 0x10);
  if (curMode > 0x12) {
    return 1;
  }
  switch (curMode) {
    case 0:
    case 4:
    case 9:
    case 17:
      return 0;
    case 1:
    case 2:
    case 3:
    case 5:
    case 6:
    case 14:
    case 16:
      return 1;
    case 7:
    case 8:
    case 10:
    case 11:
      if (checkUnitNextEventWithinFiveFrames(m, pUnit, pGame) !== 0) {
        return 1;
      }
      return nTargetMode === 4 || nTargetMode === 9 ? 1 : 0;
    case 12:
      return checkUnitNextEventWithinFiveFrames(m, pUnit, pGame) !== 0 ? 1 : 0;
    case 13:
      return m.u32(pUnit + 4) !== 0 ? 1 : 0;
    case 15:
      return m.u32(pUnit + 4) !== 5 ? 1 : 0;
    case 18:
      return checkSequenceSkillInterruptable(m, pUnit, pGame);
    default:
      return 1;
  }
}

// @va D2Game:0x6FC98610
export function PLAYER_StartWalkOrRunMode113c(
  m: Memory113c,
  nMode: number,
  pUnit: number,
  pGame: number,
): void {
  if (pGame === 0) {
    throw new D2CommonAssertError('PLAYER_StartWalkOrRunMode113c: pGame == NULL', 0x139);
  }
  const pPath = m.u32(pUnit + 0x2c);
  PATH_ResetToDefaultType113c(m, pPath);
  let resolvedMode = nMode;
  if (resolvedMode === 3) {
    if (STATLIST_GetUnitStat113c(m, pUnit, 0x0a, 0) === 0) {
      const bInTown = DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, pUnit));
      resolvedMode = bInTown !== 0 ? 6 : 2;
    }
  } else if (resolvedMode === 2 || resolvedMode === 6) {
    const bInTown = DUNGEON_CheckRoomIsTownMemPort113c(m, UNITS_GetRoom113c(m, pUnit));
    resolvedMode = bInTown !== 0 ? 6 : 2;
  } else if (resolvedMode === 0x13) {
    PATH_SetType113c(m, pPath, 8);
    PATH_SetDistance113c(m, pPath, 5);
  }
  const nPoints = PATH_Compute113c(m, pPath, pUnit, 0);
  SUNIT_InitUnitAnimData113c(m, pUnit);
  if (PATH_GetNumberOfPathPoints113c(m, pPath) === 0 || nPoints === 0) {
    PLAYER_SetNeutralOrTownNeutralMode113c(m, pGame, pUnit, 1, 0, 0);
    return;
  }
  MONSTER_ClearModeEvents113c(m, pGame, pUnit);
  UNITS_ChangeAnimMode113c(m, pUnit, resolvedMode);
  SUNIT_ValidatePathTargetUnit113c(m, pGame, pUnit);
  MONSTER_RegisterContinuousModeEvent113c(m, pGame, pUnit);
}

// @va D2Game:0x6FC98710
export function PLAYER_SetPathTargetCoordsAndWalk113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nMode: number,
  nX: number,
  nY: number,
): void {
  if (pGame === 0) {
    throw new D2CommonAssertError('PLAYER_SetPathTargetCoordsAndWalk113c: pGame == NULL', 0x17d);
  }
  const pPath = m.u32(pUnit + 0x2c);
  PATH_SetTargetPos113c(m, pPath, nX, nY);
  PLAYER_StartWalkOrRunMode113c(m, nMode, pUnit, pGame);
}

// @va D2Game:0x6FC99A10
export function PLAYER_StepAnimationModeTick113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nArg1: number,
  nArg2: number,
): void {
  const mode = pUnit === 0 ? 0 : m.u32(pUnit + 0x10);
  if (mode >= 20) {
    return;
  }
  let res = 1;
  if (mode === 2 || mode === 3 || mode === 6 || mode === 19) {
    res = stepPlayerMoveModeTick(m, pGame, pUnit);
  } else if (
    mode === 7 ||
    mode === 8 ||
    mode === 10 ||
    mode === 11 ||
    mode === 12 ||
    mode === 13 ||
    mode === 14 ||
    mode === 15 ||
    mode === 16 ||
    mode === 18
  ) {
    const pSkill = SKILLS_GetUsedSkill113c(m, pUnit);
    if (pSkill === 0) {
      res = 2;
    } else {
      PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame, pUnit, 0, 1);
      res = SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 ? 2 : 1;
    }
  }
  if (res === 2) {
    PLAYER_FinishModeAndResetToNeutral113c(m, pGame, pUnit, nArg1, nArg2);
  }
}

function stepPlayerMoveModeTick(m: Memory113c, pGame: number, pUnit: number): number {
  SUNIT_UpdateUnitPositionAndRoom113c(m, pGame, pUnit);
  if (pUnit !== 0 && m.u32(pUnit + 0x10) === 3) {
    if (STATLIST_GetUnitStat113c(m, pUnit, 0x0a, 0) === 0 && STATES_CheckState113c(m, pUnit, 0x0e) === 0) {
      PLAYER_StartWalkOrRunMode113c(m, 2, pUnit, pGame);
    }
  }
  if (pUnit === 0) {
    return 2;
  }
  const pPath = m.u32(pUnit + 0x2c);
  if (pPath === 0 || PATH_GetNumberOfPathPoints113c(m, pPath) === 0) {
    return 2;
  }
  return SUNIT_IsDeadOrDying113c(m, pUnit) !== 0 ? 2 : 1;
}

// @va D2Game:0x6FCEE150
export function SPLAYER_BroadcastUnitMovementToClient113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pClient: number,
  nModeIdx: number,
): number {
  if (pClient === 0) {
    throw new D2CommonAssertError('SPLAYER_BroadcastUnitMovementToClient113c: pClient == NULL', 0xfb);
  }
  let pClientPlayer = 0;
  if ((m.u8(pClient + 0x3d4) & 1) !== 0) {
    pClientPlayer = m.u32(pClient + 0x174);
  } else if (m.u32(pClient + 0x174) !== 0) {
    pClientPlayer = SUNIT_GetServerUnit113c(
      m,
      m.u32(pClient + 0x1a8),
      i32(m, pClient + 0x16c),
      i32(m, pClient + 0x170),
    );
    if (pClientPlayer === 0) {
      m.setU32(pClient + 0x174, 0);
    }
  }
  if (pUnit === pClientPlayer) {
    return 0;
  }
  const pTarget = PATH_GetTargetUnit113c(m, m.u32(pUnit + 0x2c));
  if (pTarget !== pUnit && pTarget !== 0) {
    const pTargetRoom = UNITS_GetRoom113c(m, pTarget);
    if (pTargetRoom !== 0) {
      const numClients = m.u32(pTargetRoom + 0x78);
      const ppClients = m.u32(pTargetRoom + 0x48);
      for (let i = 0; i < numClients; i++) {
        if (m.u32(ppClients + i * 4) === (pClient >>> 0)) {
          const targetGuid = m.u32(pTarget + 0xc);
          const targetType = m.u32(pTarget);
          const unitGuid = m.u32(pUnit + 0xc);
          const curY = UNIT_GetPosY113c(m, pUnit);
          const curX = UNIT_GetPosX113c(m, pUnit);
          const row = MODE_DISPATCH_POST_TABLE[nModeIdx & 7]!;
          const pkt = m.alloc(0x10);
          zeroMem(m, pkt, 0x10);
          m.setU8(pkt, 0x10);
          m.setU8(pkt + 1, 0);
          m.setU32(pkt + 2, unitGuid);
          m.setU8(pkt + 6, row[1]);
          m.setU8(pkt + 7, targetType & 0xff);
          m.setU32(pkt + 8, targetGuid);
          m.setU16(pkt + 0x0c, curX & 0xffff);
          m.setU16(pkt + 0x0e, curY & 0xffff);
          appendClientNetPacketNode(m, pClient, pkt, 0x10);
          freeMem(m, pkt);
          return 1;
        }
      }
    }
  }
  const pPath = m.u32(pUnit + 0x2c);
  const curY = UNIT_GetPosY113c(m, pUnit);
  const curX = UNIT_GetPosX113c(m, pUnit);
  const lastY = pPath !== 0 ? PATH_GetLastPointY113c(m, pPath) : 0;
  const lastX = pPath !== 0 ? PATH_GetLastPointX113c(m, pPath) : 0;
  const row = MODE_DISPATCH_POST_TABLE[nModeIdx & 7]!;
  const pkt = m.alloc(0x10);
  zeroMem(m, pkt, 0x10);
  m.setU8(pkt, 0x0f);
  m.setU8(pkt + 1, 0);
  m.setU32(pkt + 2, m.u32(pUnit + 0xc));
  m.setU8(pkt + 6, row[0]);
  m.setU16(pkt + 7, lastX & 0xffff);
  m.setU16(pkt + 9, lastY & 0xffff);
  m.setU8(pkt + 0x0b, 0);
  m.setU16(pkt + 0x0c, curX & 0xffff);
  m.setU16(pkt + 0x0e, curY & 0xffff);
  appendClientNetPacketNode(m, pClient, pkt, 0x10);
  freeMem(m, pkt);
  return 1;
}

// @va D2Game:0x6FC982F0
export function PLAYER_SetNeutralOrTownNeutralMode113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nFallbackMode: number,
  _unused1: number,
  _unused2: number,
): void {
  const pRoom = UNITS_GetRoom113c(m, pUnit);
  let mode = nFallbackMode;
  if (pRoom !== 0) {
    const bInTown = DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom);
    mode = bInTown !== 0 ? 5 : 1;
  }
  SUNIT_ValidatePathTargetUnit113c(m, pGame, pUnit);
  MONSTER_ClearModeEvents113c(m, pGame, pUnit);
  UNITS_ChangeAnimMode113c(m, pUnit, mode);
  SUNIT_InitUnitAnimData113c(m, pUnit);
}

// @va D2Game:0x6FC99850
export function PLAYER_FinishModeAndResetToNeutral113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _nArg1: number,
  _nArg2: number,
): void {
  const curMode = pUnit === 0 ? 0 : m.u32(pUnit + 0x10);
  let bTriggerPostSkill = 0;
  if (curMode === 7 || curMode === 8 || curMode === 0x0b) {
    bTriggerPostSkill = 1;
  } else {
    const pSkill = SKILLS_GetUsedSkill113c(m, pUnit);
    if (pSkill !== 0) {
      const skillId = SKILLS_GetSkillIdFromSkill113c(m, pSkill, 0, 0x778);
      if (skillId >= 0) {
        const sgptPtr = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C);
        const sgpt = sgptPtr !== 0 ? m.u32(sgptPtr) : 0;
        if (sgpt !== 0 && skillId < i32(m, sgpt + 0xba0)) {
          const pSkillsTxt = (m.u32(sgpt + 0xb98) + skillId * 0x23c) >>> 0;
          if (pSkillsTxt !== 0) {
            const gdwBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C);
            const mask2 = gdwBitMasks !== 0 ? m.u8(gdwBitMasks + 8) : 4;
            if ((m.u8(pSkillsTxt + 6) & mask2) !== 0) {
              bTriggerPostSkill = 1;
            }
          }
        }
      }
    }
  }
  if (bTriggerPostSkill !== 0) {
    PLAYER_ScheduleSkillActionFrameEvents113c(m, pGame, pUnit, 0, 1);
  }
  if (curMode === 0) {
    UNITS_ChangeAnimMode113c(m, pUnit, 0x11);
    SUNIT_ValidatePathTargetUnit113c(m, pGame, pUnit);
    return;
  }
  if (curMode === 0x13) {
    startUnitModeAtCoordsInternal(m, pGame, pUnit, 0, 4, -1, 0, 0);
    return;
  }
  PLAYER_SetNeutralOrTownNeutralMode113c(m, pGame, pUnit, 1, 0, 0);
}

// @va D2Game:0x6FCFF620
export function SUNIT_FindValidNextRoomInAct113c(m: Memory113c, pUnit: number, pGame: number): number {
  const pPath = m.u32(pUnit + 0x2c);
  const pNextRoom = PATH_GetNextRoom113c(m, pPath);
  const pCurRoom = UNITS_GetRoom113c(m, pUnit);
  const levelId = DUNGEON_GetLevelIdFromRoom113c(m, pCurRoom);
  if (levelId !== 0) {
    const actNo = DRLG_GetActNoFromLevelId113c(m, levelId) & 0xff;
    const pDrlgAct = m.u32(pGame + actNo * 4 + 0xbc);
    let pRoomIter = DUNGEON_GetRoomExFromRoom113c(m, pDrlgAct);
    while (pRoomIter !== 0) {
      if (pRoomIter === pNextRoom) {
        return pNextRoom;
      }
      pRoomIter = m.u32(pRoomIter + 0x7c);
    }
  }
  PATH_ClearNextRoom113c(m, pPath);
  return 0;
}

// @va D2Game:0x6FD01610
export function SUNIT_UpdateUnitPositionAndRoom113c(
  m: Memory113c,
  pTargetRoomArg: number,
  pUnit: number,
  pGame?: number,
): void {
  const gamePtr = pGame !== undefined ? pGame : pTargetRoomArg;
  const targetRoomIn = pGame !== undefined ? pTargetRoomArg : 0;
  if (UNITS_GetPathRoomRefreshFlag113c(m, pUnit) === 0) {
    return;
  }
  const pOldRoom = UNITS_GetRoom113c(m, pUnit);
  let pNewRoom = targetRoomIn;
  if (pNewRoom === 0) {
    pNewRoom = SUNIT_FindValidNextRoomInAct113c(m, pUnit, gamePtr);
    if (pNewRoom !== 0 && pOldRoom === pNewRoom) {
      return;
    }
  } else if (pOldRoom === pNewRoom) {
    return;
  }
  if (pUnit !== 0 && m.u32(pUnit) === 1) {
    const pMonsterData = m.u32(pUnit + 0x14);
    if (pMonsterData !== 0) {
      m.setU32(pMonsterData + 0x50, 0);
    }
  }
  const oldClients = pOldRoom !== 0 ? m.u32(pOldRoom + 0x48) : 0;
  const oldCount = pOldRoom !== 0 ? m.u32(pOldRoom + 0x78) : 0;
  const newClients = pNewRoom !== 0 ? m.u32(pNewRoom + 0x48) : 0;
  const newCount = pNewRoom !== 0 ? m.u32(pNewRoom + 0x78) : 0;
  let idxOld = 0;
  let idxNew = 0;
  while (idxOld < oldCount && idxNew < newCount) {
    if (oldClients === 0) {
      throw new D2CommonAssertError('SUNIT_UpdateUnitPositionAndRoom113c: null oldClients', 0x107);
    }
    if (newClients === 0) {
      throw new D2CommonAssertError('SUNIT_UpdateUnitPositionAndRoom113c: null newClients', 0x108);
    }
    const pClientOld = m.u32(oldClients + idxOld * 4);
    const pClientNew = m.u32(newClients + idxNew * 4);
    if (pClientOld < pClientNew) {
      idxOld++;
    } else if (pClientOld > pClientNew) {
      if (pClientNew === 0) {
        throw new D2CommonAssertError('SUNIT_UpdateUnitPositionAndRoom113c: null pClientNew', 0xfb);
      }
      let pPlayerNew = 0;
      if ((m.u8(pClientNew + 0x3d4) & 1) !== 0) {
        pPlayerNew = m.u32(pClientNew + 0x174);
      } else if (m.u32(pClientNew + 0x174) !== 0) {
        pPlayerNew = SUNIT_GetServerUnit113c(
          m,
          m.u32(pClientNew + 0x1a8),
          i32(m, pClientNew + 0x16c),
          i32(m, pClientNew + 0x170),
        );
        if (pPlayerNew === 0) {
          m.setU32(pClientNew + 0x174, 0);
        }
      }
      if (pUnit !== pPlayerNew && m.u8(pUnit) !== 3) {
        const pkt = m.alloc(6);
        m.setU8(pkt, 0x0a);
        m.setU8(pkt + 1, m.u8(pUnit));
        m.setU32(pkt + 2, m.u32(pUnit + 0xc));
        appendClientNetPacketNode(m, pClientNew, pkt, 6);
        freeMem(m, pkt);
      }
      idxNew++;
    } else {
      idxOld++;
      idxNew++;
    }
  }
  while (idxOld < oldCount) {
    if (oldClients === 0) {
      throw new D2CommonAssertError('SUNIT_UpdateUnitPositionAndRoom113c: null oldClients tail', 0x11c);
    }
    idxOld++;
  }
  while (idxNew < newCount) {
    if (newClients === 0) {
      throw new D2CommonAssertError('SUNIT_UpdateUnitPositionAndRoom113c: null newClients tail', 0x122);
    }
    const pClientNew = m.u32(newClients + idxNew * 4);
    if (pClientNew === 0) {
      throw new D2CommonAssertError('SUNIT_UpdateUnitPositionAndRoom113c: null pClientNew tail', 0xfb);
    }
    let pPlayerNew = 0;
    if ((m.u8(pClientNew + 0x3d4) & 1) !== 0) {
      pPlayerNew = m.u32(pClientNew + 0x174);
    } else if (m.u32(pClientNew + 0x174) !== 0) {
      pPlayerNew = SUNIT_GetServerUnit113c(
        m,
        m.u32(pClientNew + 0x1a8),
        i32(m, pClientNew + 0x16c),
        i32(m, pClientNew + 0x170),
      );
      if (pPlayerNew === 0) {
        m.setU32(pClientNew + 0x174, 0);
      }
    }
    if (pUnit !== pPlayerNew && m.u8(pUnit) !== 3) {
      const pkt = m.alloc(6);
      m.setU8(pkt, 0x0a);
      m.setU8(pkt + 1, m.u8(pUnit));
      m.setU32(pkt + 2, m.u32(pUnit + 0xc));
      appendClientNetPacketNode(m, pClientNew, pkt, 6);
      freeMem(m, pkt);
    }
    idxNew++;
  }
  const pPath = m.u32(pUnit + 0x2c);
  PATH_SetCurrentRoomInvalid113c(m, pPath, 0);
}

// @va D2Game:0x6FCAC010
export function D2NET_SendUnitMovePacket0x10BytesToClient113c(
  m: Memory113c,
  nPacketHeader: number,
  dwUnitId: number,
  pClient: number,
  bMoveType: number,
  wTargetX: number,
  wTargetY: number,
  bUnk10: number,
  bUnk11: number,
  wCurrentX: number,
  wCurrentY: number,
): void {
  const pkt = m.alloc(0x10);
  zeroMem(m, pkt, 0x10);
  m.setU8(pkt, nPacketHeader & 0xff);
  m.setU32(pkt + 1, dwUnitId >>> 0);
  m.setU8(pkt + 5, bMoveType & 0xff);
  m.setU16(pkt + 6, wTargetX & 0xffff);
  m.setU16(pkt + 8, wTargetY & 0xffff);
  m.setU8(pkt + 0x0a, bUnk10 & 0xff);
  m.setU8(pkt + 0x0b, bUnk11 & 0xff);
  m.setU16(pkt + 0x0c, wCurrentX & 0xffff);
  m.setU16(pkt + 0x0e, wCurrentY & 0xffff);
  appendClientNetPacketNode(m, pClient, pkt, 0x10);
  freeMem(m, pkt);
}
