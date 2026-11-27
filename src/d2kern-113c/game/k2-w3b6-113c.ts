/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 3 Batch 6 (w3b6).
 *
 * Clean-room 1:1 binary-isomorphic port of 45 strictly ready D2Game.dll
 * functions in the 0x6FC7E000..0x6FC863A0 address range (Act 5 Quest 2/3/5
 * object timers and ancient statue helpers, generic quest chain state checks,
 * and Act 1 Quest 0..6 NPC/party/object callbacks).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts';
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts';
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../common/dungeon.ts';
import { D2CommonAssertError } from '../common/inline-helpers.ts';
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts';
import { SKILLS_SetUsedSkillMemPort113c } from '../common/k0-d2common-memports.ts';
import { PATH_GetTargetTypeAndPosition113c } from '../common/path.ts';
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.ts';
import { seedRoll } from '../prng.ts';
import { STATES_CheckState113c, STATLIST_GetUnitBaseStat113c } from '../common/statlist.ts';
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_AllocStaticPath113c,
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNIT_Alloc113c,
} from '../common/unit.ts';
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory.ts';
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c.ts';
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c.ts';
import { QUEST_Act1TownPortalUpdateState113c } from './boot-init-gap-a-113c.ts';
import { MONSTER_StartMode113c } from './combat-a1c-113c.ts';
import {
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_GuidListAdd113c,
  QUESTS_GuidListContains113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
} from './k2-items-tc-w1-113c.ts';
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.ts';
import {
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_GetQuestData_6FC53F30_113c,
} from './k2-laneJ-0x6fc4-w1-113c.ts';
import {
  ACT1Q4_MarkFlag52_6FC80590_113c,
  ACT1Q4_MarkFlag63_6FC805C0_113c,
} from './k2-w2b1-113c.ts';
import {
  ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c,
  QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c,
  QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c,
} from './k2-w2b2-113c.ts';
import { UNITS_ChangeAnimMode113c } from './monster-events.ts';
import { OBJECTS_InitObjectUnit113c } from './objects-populate-113c.ts';
import {
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_AllocUnitData113c,
  SUNIT_InitUnitSeed113c,
  SUNIT_PlaceServerUnitInRoom113c,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts';
import { EVENT_SetEventFull113c, MONSTER_RefreshAiEvent113c } from './timer-wheel.ts';
import { hitD2GameVa113c } from '../va-trace-113c.ts';

const ACT1Q6_DIALOG_STATE_MAP_VA = 0x6fd2a024;
const ACT1Q3_DIALOG_STATE_MAP_VA = 0x6fd2a00c;
const ACT1Q5_DIALOG_STATE_MAP_VA = 0x6fd29390;
const ACT1Q2_DIALOG_STATE_MAP_VA = 0x6fd28ee0;
const ACT1Q1_DIALOG_STATE_MAP_VA = 0x6fd28a30;

const DEFAULT_DIALOG_STATE_MAP_01234: readonly number[] = [0xffffffff, 0, 1, 2, 3, 4];
const DEFAULT_DIALOG_STATE_MAP_Q2: readonly number[] = [0xffffffff, 0, 1, 2, 3, 4, 154, 146];
const DEFAULT_DIALOG_STATE_MAP_Q3: readonly number[] = [0xffffffff, 0xffffffff, 0, 1, 2, 3];

let k2W3B6StackPtr = 0x7ecc0000;

function ensureDialogStateTableSeeded113c(
  m: D2KernMemory113c,
  baseVa: number,
  defaults: readonly number[],
): void {
  let needsSeed = false;
  try {
    needsSeed = m.u32(baseVa) === 0 && m.u32((baseVa + 8) >>> 0) === 0;
  } catch {
    needsSeed = true;
  }
  if (needsSeed) {
    for (let i = 0; i < defaults.length; i = (i + 1) | 0) {
      const val = defaults[i];
      if (val !== undefined) {
        m.setU32((baseVa + i * 4) >>> 0, val >>> 0);
      }
    }
  }
}

function findQuestNodeInGame113c(m: D2KernMemory113c, pGame: number, nQuestId: number): number {
  const pQuestChain = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
  if (pQuestChain === 0) {
    return 0;
  }
  let pQuest = m.u32(pQuestChain) >>> 0;
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === (nQuestId | 0)) {
      return pQuest;
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0;
  }
  return 0;
}

function getPlayerQuestFlags113c(m: D2KernMemory113c, pGame: number, pPlayer: number): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0;
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  return m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
}

function findUnitInGameHash113c(
  m: D2KernMemory113c,
  pGame: number,
  hashTableOffset: number,
  dwUnitId: number,
): number {
  if ((pGame >>> 0) === 0) {
    throw new D2CommonAssertError('ptGame', 0x2d3);
  }
  const bucketIdx = (dwUnitId & 0x7f) >>> 0;
  let pUnit = m.u32((pGame + hashTableOffset + bucketIdx * 4) >>> 0) >>> 0;
  while (pUnit !== 0) {
    if ((m.u32((pUnit + 0x0c) >>> 0) >>> 0) === (dwUnitId >>> 0)) {
      return pUnit;
    }
    pUnit = m.u32((pUnit + 0xe4) >>> 0) >>> 0;
  }
  return 0;
}

function rollUnitSeed113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const seed = {
    lo: m.u32(pSeed >>> 0) >>> 0,
    hi: m.u32((pSeed + 4) >>> 0) >>> 0,
  };
  const rolled = seedRoll(seed, nMax | 0);
  m.setU32(pSeed >>> 0, seed.lo >>> 0);
  m.setU32((pSeed + 4) >>> 0, seed.hi >>> 0);
  return rolled | 0;
}

export interface K2W3B6ChainRefreshHooks113c {
  readonly onChainQuestRefresh?: (
    m: D2KernMemory113c,
    pNextQuest: number,
    pfnRefresh: number,
  ) => number;
}

/**
 * Resets an Ancient Barbarian monster back to its statue state, starting mode 0x0C,
 * adding a room portal node, clearing target unit, and removing the monster from its room.
 *
 * @va D2Game:0x6FC7E000
 */
export function ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwMonsterUnitId: number,
): number {
  hitD2GameVa113c(0x6FC7E000);
  const pMonster = findUnitInGameHash113c(m, pGame, 0x1320, dwMonsterUnitId);
  if (pMonster === 0) {
    return 0;
  }
  if (STATES_CheckState113c(m, pMonster, 0x36) !== 0) {
    MONSTER_RefreshAiEvent113c(m, pMonster, 0);
  }
  if (UNITS_GetRoom113c(m, pMonster) !== 0) {
    SKILLS_SetUsedSkillMemPort113c(m, pMonster, 0);
    const sp = k2W3B6StackPtr;
    k2W3B6StackPtr = (sp + 0x20) >>> 0;
    try {
      for (let i = 0; i < 8; i = (i + 1) | 0) {
        m.setU32((sp + i * 4) >>> 0, 0);
      }
      m.setU32(sp, 0x0c);
      m.setU32((sp + 0x04) >>> 0, pMonster >>> 0);
      m.setU8((sp + 0x15) >>> 0, 0x64);
      MONSTER_StartMode113c(m, pGame, pMonster, 0x0c, 0, 0, 0);
    } finally {
      k2W3B6StackPtr = sp;
    }
    const pRoom = UNITS_GetRoom113c(m, pMonster) >>> 0;
    DUNGEON_AddRoomPortalNode113c(m, pRoom, 1, dwMonsterUnitId >>> 0);
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, pMonster);
    UNITROOM_RemoveUnitFromRoom113c(m, pMonster);
  }
  return 1;
}

/**
 * Validates all 3 Ancient statue objects in the game, clears their room portal flags,
 * sets animation mode 3, schedules timer event 7 at frame + 0x14, and resets quest counters.
 *
 * @va D2Game:0x6FC7E560
 */
export function ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestDataEx: number,
): number {
  hitD2GameVa113c(0x6FC7E560);
  const sp = k2W3B6StackPtr;
  k2W3B6StackPtr = (sp + 0x10) >>> 0;
  try {
    for (let i = 0; i < 3; i = (i + 1) | 0) {
      const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
      const dwObjGuid = m.u32((pQuestDataEx + 0x14 + i * 4) >>> 0) >>> 0;
      const pObj = findUnitInGameHash113c(m, pGame, 0x1520, dwObjGuid);
      m.setU32((sp + i * 4) >>> 0, pObj);
      if (pObj === 0) {
        return 0;
      }
      const pRoom = UNITS_GetRoom113c(m, pObj) >>> 0;
      DUNGEON_ToggleHasPortalFlag113c(m, pRoom, 0);
    }
    for (let i = 0; i < 3; i = (i + 1) | 0) {
      const pObj = m.u32((sp + i * 4) >>> 0) >>> 0;
      UNITS_ChangeAnimMode113c(m, pObj, 3);
      UNITS_SetTargetUnitForDynamicUnitEx113c(m, pObj);
      const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
      const dwTargetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x14) >>> 0;
      EVENT_SetEventFull113c(m, pGame, pObj, 7, dwTargetFrame, 0, 0, 0);
      m.setU32((pQuestDataEx + 0x30 + i * 4) >>> 0, 3);
    }
    m.setU32((pQuestDataEx + 0x40) >>> 0, 0);
    m.setU32((pQuestDataEx + 0x44) >>> 0, 0);
    return 1;
  } finally {
    k2W3B6StackPtr = sp;
  }
}

/**
 * Activates flagged Ancient statue objects into animation mode 1 and schedules event 1
 * using the object record's frame count ((dwFrameCnt1 >> 8) + dwGameFrame).
 *
 * @va D2Game:0x6FC7E660
 */
export function ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c(
  m: D2KernMemory113c,
  pGame: number,
  pQuest: number,
): number {
  hitD2GameVa113c(0x6FC7E660);
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  if (m.u32((pQuestDataEx + 0x0c) >>> 0) !== 0 || m.u8((pQuestDataEx + 0x11) >>> 0) === 0) {
    m.setU8((pQuestDataEx + 0x04) >>> 0, 0);
    return 1;
  }
  let bMissing = 0;
  for (let i = 0; i < 3; i = (i + 1) | 0) {
    if (m.u8((pQuestDataEx + 0x3c + i) >>> 0) !== 0) {
      const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
      const dwObjGuid = m.u32((pQuestDataEx + 0x14 + i * 4) >>> 0) >>> 0;
      const pObj = findUnitInGameHash113c(m, pQuestGame, 0x1520, dwObjGuid);
      if (pObj === 0) {
        bMissing = 1;
      } else {
        UNITS_ChangeAnimMode113c(m, pObj, 1);
        const nObjClassId = m.u32((pObj + 0x04) >>> 0) | 0;
        const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjClassId) >>> 0;
        const dwFrameDelta = (m.u32((pObjTxt + 0xdc) >>> 0) >>> 8) >>> 0;
        const dwTargetFrame = (dwFrameDelta + m.u32((pGame + 0xa8) >>> 0)) >>> 0;
        EVENT_SetEventFull113c(m, pGame, pObj, 1, dwTargetFrame, 0, 0, 0);
        m.setU8((pQuestDataEx + 0x3c + i) >>> 0, 0);
        m.setU32((pQuestDataEx + 0x30 + i * 4) >>> 0, 2);
      }
    }
  }
  if (bMissing !== 0) {
    return 0;
  }
  m.setU8((pQuestDataEx + 0x04) >>> 0, 0);
  return 1;
}

/**
 * Updates Anya object animation mode across modes 1 -> 2 -> 3 -> 4 and reschedules timer event 7.
 *
 * @va D2Game:0x6FC7E840
 */
export function ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC7E840);
  const nMode = (pObject >>> 0) !== 0 ? m.u32((pObject + 0x10) >>> 0) | 0 : 0;
  if (nMode === 1) {
    UNITS_ChangeAnimMode113c(m, pObject, 2);
  } else if (nMode === 2) {
    const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
    const pRoom = UNITS_GetRoom113c(m, pObject) >>> 0;
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
    if (nLevelId === 0x6d) {
      const nextCount = (m.u32((pQuestDataEx + 0xdc) >>> 0) + 1) | 0;
      m.setU32((pQuestDataEx + 0xdc) >>> 0, nextCount >>> 0);
      if (nextCount > 5) {
        m.setU8((pQuestDataEx + 0xae) >>> 0, 1);
      }
      if (m.u8((pQuestDataEx + 0xae) >>> 0) !== 0) {
        UNITS_ChangeAnimMode113c(m, pObject, 3);
      }
    } else if (m.u8((pQuestDataEx + 0xad) >>> 0) !== 0) {
      UNITS_ChangeAnimMode113c(m, pObject, 3);
    }
  } else if (nMode === 3) {
    UNITS_ChangeAnimMode113c(m, pObject, 4);
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
  const dwTargetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x19) >>> 0;
  EVENT_SetEventFull113c(m, pGame, pObject, 7, dwTargetFrame, 0, 0, 0);
}

/**
 * Initializes the Frozen Anya object (records object GUID at +0xF8 and schedules event 7 if +0xA4 is 0).
 *
 * @va D2Game:0x6FC7E8D0
 */
export function ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c(
  m: D2KernMemory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC7E8D0);
  const pGame = m.u32(pObjInit >>> 0) >>> 0;
  const pQuest = findQuestNodeInGame113c(m, pGame, 0x21);
  if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) {
    return;
  }
  const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const dwGuid = pObject !== 0 ? m.u32((pObject + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  m.setU32((pQuestDataEx + 0xf8) >>> 0, dwGuid);
  if (m.u8((pQuestDataEx + 0xa4) >>> 0) === 0) {
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
    const pTargetObj = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
    const dwTargetFrame = (m.u32((pQuestGame + 0xa8) >>> 0) + 0x19) >>> 0;
    EVENT_SetEventFull113c(m, pQuestGame, pTargetObj, 7, dwTargetFrame, 0, 0, 0);
  }
}

/**
 * Allocates and places the Frozen Anya monster wrapper object (class 0x22E) at the source unit's coordinates.
 *
 * @va D2Game:0x6FC7E940
 */
export function ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC7E940);
  const pQuest = findQuestNodeInGame113c(m, pGame, 0x21);
  if (pQuest === 0 || m.u8((pQuest + 0x09) >>> 0) === 0) {
    return;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  if (m.u8((pQuestDataEx + 0xa4) >>> 0) !== 0) {
    return;
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
  const y = UNIT_GetPosY113c(m, pUnit) | 0;
  const x = UNIT_GetPosX113c(m, pUnit) | 0;
  const pNewObj = UNIT_Alloc113c(m, 2) >>> 0;
  if (pNewObj === 0) {
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
    const dwTargetFrame = (m.u32((pQuestGame + 0xa8) >>> 0) + 0x19) >>> 0;
    EVENT_SetEventFull113c(m, pQuestGame, pUnit, 7, dwTargetFrame, 0, 0, 0);
    return;
  }
  m.setU32(pNewObj, 2);
  m.setU32((pNewObj + 0x04) >>> 0, 0x22e);
  m.setU32((pNewObj + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0));
  m.setU32((pNewObj + 0x80) >>> 0, pGame >>> 0);
  let dwFlagsEx = m.u32((pNewObj + 0xc8) >>> 0) >>> 0;
  if (m.u32((pGame + 0x70) >>> 0) !== 0) {
    dwFlagsEx = (dwFlagsEx | 0x02000000) >>> 0;
  } else {
    dwFlagsEx = (dwFlagsEx & 0xfdffffff) >>> 0;
  }
  dwFlagsEx = (dwFlagsEx | 0x04000000) >>> 0;
  m.setU32((pNewObj + 0xc8) >>> 0, dwFlagsEx);
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff;
  m.setU8((pNewObj + 0x18) >>> 0, nAct);
  m.setU32((pNewObj + 0x1c) >>> 0, m.u32((pGame + nAct * 4 + 0xbc) >>> 0));
  m.setU32((pNewObj + 0x74) >>> 0, 0);
  SUNIT_InitUnitSeed113c(m, pNewObj, (pGame + 0xd0) >>> 0);
  m.setU32((pNewObj + 0xc4) >>> 0, (m.u32((pNewObj + 0xc4) >>> 0) | 0x10) >>> 0);
  m.setU32((pNewObj + 0xd0) >>> 0, 0x0b);
  let dwNextGuid = (m.u32((pGame + 0x98) >>> 0) + 1) >>> 0;
  if (dwNextGuid === 0xffffffff) {
    dwNextGuid = 1;
  }
  m.setU32((pGame + 0x98) >>> 0, dwNextGuid);
  const pObjectData = m.alloc(0x38) >>> 0;
  m.setU32((pNewObj + 0x14) >>> 0, pObjectData);
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, 0x22e) >>> 0;
  m.setU32(pObjectData, pObjTxt);
  m.setU32((pNewObj + 0x10) >>> 0, 0);
  UNITS_AllocStaticPath113c(m, pNewObj);
  OBJECTS_InitObjectUnit113c(m, pNewObj, pGame, dwNextGuid, pRoom, x, y);
  SUNIT_PlaceServerUnitInRoom113c(m, pRoom, y, pNewObj, x, pGame, 1);
  m.setU32((pNewObj + 0xc4) >>> 0, (m.u32((pNewObj + 0xc4) >>> 0) | 0x03000000) >>> 0);
  m.setU8((pQuestDataEx + 0xa4) >>> 0, 1);
  m.setU32((pQuestDataEx + 0xa8) >>> 0, m.u32((pNewObj + 0x0c) >>> 0));
}

/**
 * Updates Act 5 Quest 2 prison door object animation mode across modes 1 -> 2 -> 3 -> 4
 * and reschedules timer event 7 at frame + 0x19.
 *
 * @va D2Game:0x6FC7EE30
 */
export function ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC7EE30);
  const dwObjGuid = (pObject >>> 0) !== 0 ? m.u32((pObject + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  let idx = 0;
  while (idx < 3) {
    if ((m.u32((pQuestDataEx + 0xec + idx * 4) >>> 0) >>> 0) === dwObjGuid) {
      break;
    }
    idx = (idx + 1) | 0;
  }
  if (idx >= 3) {
    return;
  }
  const nMode = (pObject >>> 0) !== 0 ? m.u32((pObject + 0x10) >>> 0) | 0 : 0;
  if (nMode === 1) {
    UNITS_ChangeAnimMode113c(m, pObject, 2);
  } else if (nMode === 2) {
    if (m.u8((pQuestDataEx + 0x108 + idx) >>> 0) === 1) {
      const nextTicks = (m.u32((pQuestDataEx + 0xfc + idx * 4) >>> 0) + 1) | 0;
      m.setU32((pQuestDataEx + 0xfc + idx * 4) >>> 0, nextTicks >>> 0);
    }
    if ((m.u32((pQuestDataEx + 0xfc + idx * 4) >>> 0) | 0) > 5) {
      m.setU8((pQuestDataEx + 0x10b + idx) >>> 0, 1);
    }
    if (m.u8((pQuestDataEx + 0x10b + idx) >>> 0) !== 0) {
      UNITS_ChangeAnimMode113c(m, pObject, 3);
    }
  } else if (nMode === 3) {
    UNITS_ChangeAnimMode113c(m, pObject, 4);
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
  const dwTargetFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x19) >>> 0;
  EVENT_SetEventFull113c(m, pGame, pObject, 7, dwTargetFrame, 0, 0, 0);
}

/**
 * Checks whether a quest is active (including bLastState < 2 && bNotIntro == 1)
 * or chains to the next quest's +0xF0 refresh callback.
 *
 * @va D2Game:0x6FC801B0
 */
export function QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  hooks?: K2W3B6ChainRefreshHooks113c,
): number {
  hitD2GameVa113c(0x6FC801B0);
  const bLastState = m.u8((pQuest + 0x0c) >>> 0);
  if (bLastState < 2 && m.u8((pQuest + 0x09) >>> 0) === 1) {
    return 1;
  }
  if (bLastState !== 5 && m.u8((pQuest + 0x09) >>> 0) !== 0) {
    return 1;
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
  const nNextQuestId = m.u32((pQuest + 0x10) >>> 0) | 0;
  const pNextQuest = QUESTS_GetQuestData_6FC53F30_113c(m, pGame, nNextQuestId) >>> 0;
  if (pNextQuest === 0) {
    return 0;
  }
  const pfnSelf = m.u32((pQuest + 0xf0) >>> 0) >>> 0;
  if (pfnSelf === 0) {
    throw new D2CommonAssertError('ptGame', 0x2e0);
  }
  const pfnNext = m.u32((pNextQuest + 0xf0) >>> 0) >>> 0;
  if (hooks !== undefined && hooks.onChainQuestRefresh !== undefined) {
    return hooks.onChainQuestRefresh(m, pNextQuest, pfnNext) | 0;
  }
  if (pfnNext === 0x6fc801b0) {
    return QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(m, pNextQuest, hooks);
  }
  if (pfnNext === 0x6fc806e0) {
    return QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(m, pNextQuest, hooks);
  }
  return pfnNext !== 0 ? 1 : 0;
}

function removeGuidFromSelectedListInline113c(
  m: D2KernMemory113c,
  pQuestDataEx: number,
  bSecondList: number,
  dwGuid: number,
): number {
  if (bSecondList !== 0) {
    const count = m.u16((pQuestDataEx + 0x64) >>> 0);
    for (let idx = 0; idx < count; idx = (idx + 1) | 0) {
      const slotAddr = (pQuestDataEx + 0x34 + idx * 4) >>> 0;
      if ((m.u32(slotAddr) >>> 0) === (dwGuid >>> 0)) {
        if (idx !== ((count - 1) | 0)) {
          const lastVal = m.u32((pQuestDataEx + 0x30 + count * 4) >>> 0);
          m.setU32(slotAddr, lastVal);
        }
        m.setU16((pQuestDataEx + 0x64) >>> 0, (count - 1) & 0xffff);
        return 1;
      }
    }
    return 0;
  }
  const count = m.u16((pQuestDataEx + 0x30) >>> 0);
  for (let idx = 0; idx < count; idx = (idx + 1) | 0) {
    const slotAddr = (pQuestDataEx + idx * 4) >>> 0;
    if ((m.u32(slotAddr) >>> 0) === (dwGuid >>> 0)) {
      if (idx !== ((count - 1) | 0)) {
        const lastVal = m.u32((pQuestDataEx + count * 4 - 4) >>> 0);
        m.setU32(slotAddr, lastVal);
      }
      m.setU16((pQuestDataEx + 0x30) >>> 0, (count - 1) & 0xffff);
      return 1;
    }
  }
  return 0;
}

/**
 * Removes a GUID from one of two compact 12-entry GUID arrays in pQuestDataEx
 * (+0x00 with count at +0x30 when bSecondList == 0, or +0x34 with count at +0x64 when bSecondList != 0).
 *
 * @va D2Game:0x6FC802A0
 */
export function ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c(
  m: D2KernMemory113c,
  pQuestDataEx: number,
  bSecondList: number,
  dwGuid: number,
): number {
  hitD2GameVa113c(0x6FC802A0);
  return removeGuidFromSelectedListInline113c(m, pQuestDataEx, bSecondList, dwGuid);
}

/**
 * Checks whether a quest is active (bLastState != 5 && bNotIntro != 0)
 * or chains to the next quest's +0xF0 refresh callback.
 *
 * @va D2Game:0x6FC806E0
 */
export function QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  hooks?: K2W3B6ChainRefreshHooks113c,
): number {
  hitD2GameVa113c(0x6FC806E0);
  if (m.u8((pQuest + 0x0c) >>> 0) !== 5 && m.u8((pQuest + 0x09) >>> 0) !== 0) {
    return 1;
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
  const nNextQuestId = m.u32((pQuest + 0x10) >>> 0) | 0;
  const pNextQuest = QUESTS_GetQuestData_6FC53F30_113c(m, pGame, nNextQuestId) >>> 0;
  if (pNextQuest === 0) {
    return 0;
  }
  const pfnSelf = m.u32((pQuest + 0xf0) >>> 0) >>> 0;
  if (pfnSelf === 0) {
    throw new D2CommonAssertError('ptGame', 0x2a7);
  }
  const pfnNext = m.u32((pNextQuest + 0xf0) >>> 0) >>> 0;
  if (hooks !== undefined && hooks.onChainQuestRefresh !== undefined) {
    return hooks.onChainQuestRefresh(m, pNextQuest, pfnNext) | 0;
  }
  if (pfnNext === 0x6fc806e0) {
    return QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(m, pNextQuest, hooks);
  }
  if (pfnNext === 0x6fc801b0) {
    return QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(m, pNextQuest, hooks);
  }
  return pfnNext !== 0 ? 1 : 0;
}

/**
 * Act 1 Quest 6 callback 13: refreshes quest fState (+0x0B) and fLastState (+0x0C) from player quest flags.
 *
 * @va D2Game:0x6FC808B0
 */
export function ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC808B0);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const dwQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0x0f) !== 0
  ) {
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 4) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 2);
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 3) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 2) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 2);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
  }
}

/**
 * Act 1 Quest 6 callback 00: handles NPC activation and dialog text selection for Sisters to the Slaughter.
 *
 * @va D2Game:0x6FC80A80
 */
export function ACT1Q6_Callback00_NpcActivate_6FC80A80_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC80A80);
  ensureDialogStateTableSeeded113c(m, ACT1Q6_DIALOG_STATE_MAP_VA, DEFAULT_DIALOG_STATE_MAP_01234);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const bit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 0);
  const bit0d = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 0x0d);
  const bit1 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 1);
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0;
  const nNpcId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1;
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0;

  if (nNpcId === 0x94) {
    const count94 = m.u16((pQuestDataEx + 0x104) >>> 0);
    for (let i = 0; i < count94; i = (i + 1) | 0) {
      if ((m.u32((pQuestDataEx + 0x84 + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
        QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 3, pTextHeader, 0x94);
        return;
      }
    }
  } else if (nNpcId === 0x96) {
    const count96 = m.u16((pQuestDataEx + 0x188) >>> 0);
    for (let i = 0; i < count96; i = (i + 1) | 0) {
      if ((m.u32((pQuestDataEx + 0x108 + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
        QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 3, pTextHeader, 0x96);
        return;
      }
    }
  } else if (nNpcId === 0x109) {
    const count109 = m.u16((pQuestDataEx + 0x80) >>> 0);
    for (let i = 0; i < count109; i = (i + 1) | 0) {
      if ((m.u32((pQuestDataEx + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
        QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 3, pTextHeader, 0x109);
        return;
      }
    }
  }

  if (bit1 !== 0) {
    if (nNpcId === 0x109 || nNpcId === 0x94 || nNpcId === 0x96) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 4, pTextHeader, nNpcId);
      return;
    }
    QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 3, pTextHeader, nNpcId);
    return;
  }

  const guidCount = m.u16((pQuest + 0x9c) >>> 0);
  for (let i = 0; i < guidCount; i = (i + 1) | 0) {
    if ((m.u32((pQuest + 0x1c + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 4, pTextHeader, nNpcId);
      return;
    }
  }

  const bState = m.u8((pQuest + 0x0c) >>> 0);
  if (bState === 1 && nNpcId === 0x109) {
    if (bit0 === 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 0, pTextHeader, 0x109);
      return;
    }
  }
  if (bState === 0) {
    return;
  }
  if (bit0 === 1 && bit0d === 0) {
    return;
  }
  if (bState >= 4 && bit0d === 0) {
    return;
  }
  if (bit0 === 1 && bit0d === 1) {
    return;
  }
  const nMsgIdx = m.u32((ACT1Q6_DIALOG_STATE_MAP_VA + bState * 4) >>> 0) | 0;
  if (nMsgIdx === -1 || (nMsgIdx >>> 0) >= 6) {
    return;
  }
  QUESTS_AddNpcDialogTextNodes113c(m, pQuest, nMsgIdx, pTextHeader, nNpcId);
}

/**
 * Act 1 Quest 6 player callback: updates player quest 6 flags (state 2, 3, or 4) from quest state.
 *
 * @va D2Game:0x6FC80D00
 */
export function ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC80D00);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 1) === 1
  ) {
    return 0;
  }
  const pQuest = findQuestNodeInGame113c(m, pGame, 6);
  if (pQuest === 0) {
    return 0;
  }
  const bLastState = m.u8((pQuest + 0x0c) >>> 0);
  if (bLastState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 2);
    return 0;
  }
  if (bLastState !== 3) {
    return 0;
  }
  if (m.u8((pQuest + 0x0b) >>> 0) === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 3);
    return 0;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 4);
  return 0;
}

/**
 * Act 1 Quest 3 (Tools of the Trade, quest index 5) callback 13: refreshes quest state from player flags.
 *
 * @va D2Game:0x6FC80E00
 */
export function ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC80E00);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const dwQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0x0f) !== 0
  ) {
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 4) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 1);
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 6) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 4);
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 5) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 3);
    m.setU8((pQuest + 0x0c) >>> 0, 2);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 3) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 2) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 2);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
  }
}

/**
 * Act 1 Quest 3 party callback: when player is in level 0x19, records player GUID at +0x8C
 * and sets quest 5 states 0 and 0x0D.
 *
 * @va D2Game:0x6FC80F70
 */
export function ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC80F70);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 1) !== 0
  ) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0;
  if (pRoom === 0) {
    return 0;
  }
  if ((DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0) !== 0x19) {
    return 0;
  }
  const pQuest = findQuestNodeInGame113c(m, pGame, 5);
  if (pQuest === 0) {
    return 0;
  }
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const pGuidList = (pQuestDataEx + 0x8c) >>> 0;
  if (QUESTS_GuidListContains113c(m, pGuidList, dwPlayerGuid) === 0) {
    QUESTS_GuidListAdd113c(m, pGuidList, dwPlayerGuid);
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0x0d);
  return 0;
}

/**
 * Act 1 Quest 3 callback 00: handles NPC activation and dialog text selection for Tools of the Trade.
 *
 * @va D2Game:0x6FC81030
 */
export function ACT1Q3_Callback00_NpcActivate_6FC81030_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC81030);
  ensureDialogStateTableSeeded113c(m, ACT1Q3_DIALOG_STATE_MAP_VA, DEFAULT_DIALOG_STATE_MAP_Q3);
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    return;
  }
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const bit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0);
  const bit0d = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0x0d);
  if (bit0 === 1 && bit0d === 0) {
    return;
  }
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0;
  const nNpcId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1;
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  const bState = m.u8((pQuest + 0x0c) >>> 0);
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0;
  if (bState >= 4) {
    const countSecond0 = m.u16((pQuestDataEx + 0x64) >>> 0);
    let inSecond0 = false;
    for (let i = 0; i < countSecond0; i = (i + 1) | 0) {
      if ((m.u32((pQuestDataEx + 0x34 + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
        inSecond0 = true;
        break;
      }
    }
    if (!inSecond0) {
      const countFirst0 = m.u16((pQuestDataEx + 0x30) >>> 0);
      let inFirst0 = false;
      for (let i = 0; i < countFirst0; i = (i + 1) | 0) {
        if ((m.u32((pQuestDataEx + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
          inFirst0 = true;
          break;
        }
      }
      if (!inFirst0) {
        return;
      }
    }
  }
  const countSecond = m.u16((pQuestDataEx + 0x64) >>> 0);
  for (let i = 0; i < countSecond; i = (i + 1) | 0) {
    if ((m.u32((pQuestDataEx + 0x34 + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 2, pTextHeader, nNpcId);
      return;
    }
  }
  if (bit0 === 1 && bit0d === 1) {
    const countFirst = m.u16((pQuestDataEx + 0x30) >>> 0);
    for (let i = 0; i < countFirst; i = (i + 1) | 0) {
      if ((m.u32((pQuestDataEx + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
        QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 3, pTextHeader, nNpcId);
        return;
      }
    }
    return;
  }
  const nMsgIdx = m.u32((ACT1Q3_DIALOG_STATE_MAP_VA + bState * 4) >>> 0) | 0;
  if (nMsgIdx === -1 || (nMsgIdx >>> 0) >= 5) {
    return;
  }
  QUESTS_AddNpcDialogTextNodes113c(m, pQuest, nMsgIdx, pTextHeader, nNpcId);
}

/**
 * Act 1 Quest 3 callback 11: removes player GUID from +0x8C, +0x34/+0x64, and +0x00/+0x30 lists.
 *
 * @va D2Game:0x6FC811B0
 */
export function ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC811B0);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0x8c) >>> 0, dwPlayerGuid);
  removeGuidFromSelectedListInline113c(m, pQuestDataEx, 1, dwPlayerGuid);
  removeGuidFromSelectedListInline113c(m, pQuestDataEx, 0, dwPlayerGuid);
}

/**
 * Act 1 Quest 3 player callback: updates player quest 5 state bits (2..6) from quest state.
 *
 * @va D2Game:0x6FC81250
 */
export function ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC81250);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 1) === 1
  ) {
    return 0;
  }
  const pQuest = findQuestNodeInGame113c(m, pGame, 5);
  if (pQuest === 0) {
    return 0;
  }
  const bLastState = m.u8((pQuest + 0x0c) >>> 0);
  if (bLastState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 2);
    return 0;
  }
  if (bLastState !== 3) {
    return 0;
  }
  const bState = m.u8((pQuest + 0x0b) >>> 0);
  if (bState === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 3);
  } else if (bState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 4);
  } else if (bState === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 5);
  } else if (bState === 4) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 6);
  }
  return 0;
}

/**
 * Spawns the Tristram portal object (class 0xBD) at quest 4's target coordinates (+0x9C, +0xA0),
 * or increments both coordinates by 3 if no room contains that subtile.
 *
 * @va D2Game:0x6FC81340
 */
export function ACT1Q4_SpawnTristramPortalObject_6FC81340_113c(
  m: D2KernMemory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC81340);
  const pQuest = findQuestNodeInGame113c(m, pGame, 4);
  if (pQuest === 0) {
    return 1;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  if (m.u8((pQuestDataEx + 0x95) >>> 0) !== 0) {
    return 1;
  }
  const x = m.u32((pQuestDataEx + 0x9c) >>> 0) | 0;
  const y = m.u32((pQuestDataEx + 0xa0) >>> 0) | 0;
  const pStartRoom = UNITS_GetRoom113c(m, pUnit) >>> 0;
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pStartRoom, x, y) >>> 0;
  if (pTargetRoom === 0) {
    m.setU32((pQuestDataEx + 0x9c) >>> 0, (x + 3) >>> 0);
    m.setU32((pQuestDataEx + 0xa0) >>> 0, (y + 3) >>> 0);
    return 1;
  }
  const pPortalObj = SUNIT_AllocUnitData113c(m, 2, 0xbd, x, y, pGame, pTargetRoom, 1, 1, 0) >>> 0;
  if (pPortalObj !== 0) {
    m.setU8((pQuestDataEx + 0x95) >>> 0, 1);
    m.setU32((pQuestDataEx + 0x98) >>> 0, m.u32((pPortalObj + 0x0c) >>> 0));
  }
  return 1;
}

/**
 * Act 1 Quest 4 callback 13: refreshes Search for Cain state and checks player inventory for 'bkd ' and 'bks '.
 *
 * @va D2Game:0x6FC81540
 */
export function ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC81540);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0) === 1) {
    const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
    const pQuestCtrl0 = m.u32((pQuestGame + 0x10f4) >>> 0) >>> 0;
    if (pQuestCtrl0 !== 0) {
      let pNode = m.u32(pQuestCtrl0 >>> 0) >>> 0;
      while (pNode !== 0) {
        if (m.u32(pNode >>> 0) === 4) {
          const pNodeEx = m.u32((pNode + 0x18) >>> 0) >>> 0;
          m.setU8((pNodeEx + 0x52) >>> 0, 1);
          break;
        }
        pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0;
      }
    }
    const pQuestGame2 = m.u32((pQuest + 0x04) >>> 0) >>> 0;
    const pQuestCtrl = m.u32((pQuestGame2 + 0x10f4) >>> 0) >>> 0;
    if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x820);
    }
    const pGameQuestFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0;
    QUESTRECORD_SetQuestState113c(m, pGameQuestFlags, 4, 0x0d);
    m.setU32((pQuestDataEx + 0x54) >>> 0, 3);
    m.setU8((pQuestDataEx + 0x4c) >>> 0, 1);
    m.setU8((pQuestDataEx + 0x4d) >>> 0, 1);
  } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0f) === 1) {
    ACT1Q4_MarkFlag52_6FC80590_113c(m, m.u32((pQuest + 0x04) >>> 0) >>> 0);
    ACT1Q4_MarkFlag63_6FC805C0_113c(m, m.u32((pQuest + 0x04) >>> 0) >>> 0);
    m.setU32((pQuestDataEx + 0x54) >>> 0, 3);
    m.setU8((pQuestDataEx + 0x4c) >>> 0, 1);
    m.setU8((pQuestDataEx + 0x4d) >>> 0, 1);
  } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 4) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 4);
    m.setU8((pQuest + 0x0c) >>> 0, 5);
    m.setU8((pQuestDataEx + 0x4c) >>> 0, 1);
    m.setU8((pQuestDataEx + 0x4e) >>> 0, 1);
    m.setU8((pQuestDataEx + 0x4d) >>> 0, 1);
    m.setU8((pQuestDataEx + 0x78) >>> 0, 1);
    m.setU32((pQuestDataEx + 0x58) >>> 0, 1);
  } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 3) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
  } else if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 2) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 2);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
  }
  const hasBkd = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x20646b62,
  );
  const hasBks = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x20736b62,
  );
  if (hasBkd !== 0) {
    m.setU32((pQuestDataEx + 0x7c) >>> 0, (m.u32((pQuestDataEx + 0x7c) >>> 0) + 1) >>> 0);
  }
  if (hasBks !== 0) {
    m.setU32((pQuestDataEx + 0x7c) >>> 0, (m.u32((pQuestDataEx + 0x7c) >>> 0) + 1) >>> 0);
  }
  if (hasBkd !== 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 5);
    m.setU8((pQuest + 0x0b) >>> 0, 3);
    m.setU8((pQuestDataEx + 0x4e) >>> 0, 1);
    m.setU8((pQuestDataEx + 0x78) >>> 0, 1);
    m.setU32((pQuestDataEx + 0x58) >>> 0, 1);
    return;
  }
  if (hasBks !== 0) {
    m.setU8((pQuestDataEx + 0x78) >>> 0, 1);
    m.setU8((pQuest + 0x0c) >>> 0, 4);
    m.setU8((pQuest + 0x0b) >>> 0, 2);
    m.setU32((pQuestDataEx + 0x58) >>> 0, 1);
  }
}

/**
 * Act 1 Quest 4 player callback: sets quest 4 state 0x0E and adds player GUID to +0xB4 list.
 *
 * @va D2Game:0x6FC81910
 */
export function ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC81910);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 1) !== 0
  ) {
    return 0;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 0x0e);
  const pQuest = findQuestNodeInGame113c(m, pGame, 4);
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  QUESTS_GuidListAdd113c(m, (pQuestDataEx + 0xb4) >>> 0, dwPlayerGuid);
  return 0;
}

/**
 * Act 1 Quest 4 player callback: updates player quest 4 state bits (2 or 3) from quest state.
 *
 * @va D2Game:0x6FC819B0
 */
export function ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC819B0);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 1) === 1
  ) {
    return 0;
  }
  const pQuest = findQuestNodeInGame113c(m, pGame, 4);
  if (pQuest === 0) {
    return 0;
  }
  const bLastState = m.u8((pQuest + 0x0c) >>> 0);
  if (bLastState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 2);
    return 0;
  }
  if (bLastState >= 3 && bLastState <= 5) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 3);
  }
  return 0;
}

/**
 * Act 1 Quest 5 (Malus, quest index 3) callback 13: checks for 'hdm ' item and refreshes quest state.
 *
 * @va D2Game:0x6FC81A80
 */
export function ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC81A80);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x206d6468) !== 0) {
    m.setU32((pQuestDataEx + 0x9c) >>> 0, (m.u32((pQuestDataEx + 0x9c) >>> 0) + 1) >>> 0);
    m.setU8((pQuestDataEx + 0xa1) >>> 0, 1);
  }
  const dwQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0x0f) !== 0
  ) {
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 2) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 2);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 3) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
  }
}

/**
 * Act 1 Quest 5 (Malus, quest index 3) callback 00: handles Charsi activation and dialog text selection.
 *
 * @va D2Game:0x6FC81C60
 */
export function ACT1Q5_Callback00_NpcActivate_6FC81C60_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC81C60);
  ensureDialogStateTableSeeded113c(m, ACT1Q5_DIALOG_STATE_MAP_VA, DEFAULT_DIALOG_STATE_MAP_01234);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const bit0d = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0x0d);
  const bit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0);
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0;
  const nNpcId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1;
  if (bit0 === 1 && bit0d === 0) {
    return;
  }
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0;
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x206d6468) !== 0) {
    if ((STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x0c, 0) | 0) < 8) {
      return;
    }
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0) !== 0) {
      return;
    }
    QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 3, pTextHeader, nNpcId);
    return;
  }
  if (bit0 === 1) {
    return;
  }
  const bState = m.u8((pQuest + 0x0c) >>> 0);
  if (bState === 0 || bState === 4) {
    return;
  }
  const nMsgIdx = m.u32((ACT1Q5_DIALOG_STATE_MAP_VA + bState * 4) >>> 0) | 0;
  if (nMsgIdx === -1 || (nMsgIdx >>> 0) >= 6) {
    return;
  }
  QUESTS_AddNpcDialogTextNodes113c(m, pQuest, nMsgIdx, pTextHeader, nNpcId);
}

/**
 * Act 1 Quest 5 (Malus, quest index 3) player callback: updates player quest 3 state bits (2 or 3).
 *
 * @va D2Game:0x6FC81DA0
 */
export function ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC81DA0);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 1) === 1
  ) {
    return 0;
  }
  const pQuest = findQuestNodeInGame113c(m, pGame, 3);
  if (pQuest === 0) {
    return 0;
  }
  const bLastState = m.u8((pQuest + 0x0c) >>> 0);
  if (bLastState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 3, 2);
    return 0;
  }
  if (bLastState === 3 || bLastState === 4) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 3, 3);
  }
  return 0;
}

/**
 * Act 1 Quest 2 callback 13: refreshes Sisters' Burial Grounds quest state from player flags.
 *
 * @va D2Game:0x6FC81E30
 */
export function ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC81E30);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const dwQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0x0f) !== 0
  ) {
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 4) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 2);
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 3) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 2) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 2);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
  }
}

/**
 * Act 1 Quest 2 party callback: sets quest 2 states 0x0D and 1 for party members in Act 1.
 *
 * @va D2Game:0x6FC81EC0
 */
export function ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC81EC0);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 1) === 1
  ) {
    return;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0;
  if (pRoom === 0) {
    return;
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  if (nLevelId === 0) {
    return;
  }
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 0) {
    return;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 0x0d);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 1);
}

/**
 * Act 1 Quest 2 callback 00: handles Kashya activation and dialog text selection for Blood Raven.
 *
 * @va D2Game:0x6FC81F50
 */
export function ACT1Q2_Callback00_NpcActivate_6FC81F50_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC81F50);
  ensureDialogStateTableSeeded113c(m, ACT1Q2_DIALOG_STATE_MAP_VA, DEFAULT_DIALOG_STATE_MAP_Q2);
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0;
  const nNpcId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1;
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const bit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuest + 0xe0) >>> 0) | 0, 0);
  const bit1 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuest + 0xe0) >>> 0) | 0, 1);
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0;
  if (bit1 !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 3, pTextHeader, nNpcId);
    return;
  }
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  const guidCount = m.u16((pQuest + 0x9c) >>> 0);
  for (let i = 0; i < guidCount; i = (i + 1) | 0) {
    if ((m.u32((pQuest + 0x1c + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 4, pTextHeader, nNpcId);
      return;
    }
  }
  const bState = m.u8((pQuest + 0x0c) >>> 0);
  if (bState === 0 || bit0 === 1 || bState >= 4) {
    return;
  }
  const nMsgIdx = m.u32((ACT1Q2_DIALOG_STATE_MAP_VA + bState * 4) >>> 0) | 0;
  if (nMsgIdx === -1 || (nMsgIdx >>> 0) >= 6) {
    return;
  }
  QUESTS_AddNpcDialogTextNodes113c(m, pQuest, nMsgIdx, pTextHeader, nNpcId);
}

/**
 * Act 1 Quest 2 player callback: updates player quest 2 state bits (2, 3, or 4) from quest state.
 *
 * @va D2Game:0x6FC82040
 */
export function ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82040);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 1) === 1
  ) {
    return 0;
  }
  const pQuest = findQuestNodeInGame113c(m, pGame, 2);
  if (pQuest === 0) {
    return 0;
  }
  const bLastState = m.u8((pQuest + 0x0c) >>> 0);
  if (bLastState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 2);
    return 0;
  }
  if (bLastState !== 3) {
    return 0;
  }
  if (m.u8((pQuest + 0x0b) >>> 0) === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 3);
    return 0;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 4);
  return 0;
}

/**
 * Act 1 Quest 1 callback 13: refreshes Den of Evil quest state from player flags.
 *
 * @va D2Game:0x6FC820E0
 */
export function ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC820E0);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const dwQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, dwQuestId, 0x0f) !== 0
  ) {
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 4) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 2);
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 3) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 3);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 2) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 2);
    m.setU8((pQuest + 0x0b) >>> 0, 1);
  }
}

/**
 * Act 1 Quest 1 party callback: sets quest 1 states 0x0D and 1 for party members in Act 1.
 *
 * @va D2Game:0x6FC821B0
 */
export function ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC821B0);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 1) === 1
  ) {
    return;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0;
  if (pRoom === 0) {
    return;
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  if (nLevelId === 0) {
    return;
  }
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 0) {
    return;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 0x0d);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 1);
}

/**
 * Act 1 Quest 1 callback 00: handles Akara activation and dialog text selection for Den of Evil.
 *
 * @va D2Game:0x6FC82220
 */
export function ACT1Q1_Callback00_NpcActivate_6FC82220_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC82220);
  ensureDialogStateTableSeeded113c(m, ACT1Q1_DIALOG_STATE_MAP_VA, DEFAULT_DIALOG_STATE_MAP_01234);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  const bit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuest + 0xe0) >>> 0) | 0, 0);
  const bit0d = DRLGWARP_TestRoomTileBit113c(
    m,
    pQuestFlags,
    m.u32((pQuest + 0xe0) >>> 0) | 0,
    0x0d,
  );
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0;
  const nNpcId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1;
  const bit1 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuest + 0xe0) >>> 0) | 0, 1);
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0;
  if (bit1 !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 3, pTextHeader, nNpcId);
    return;
  }
  const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  const guidCount = m.u16((pQuest + 0x9c) >>> 0);
  for (let i = 0; i < guidCount; i = (i + 1) | 0) {
    if ((m.u32((pQuest + 0x1c + i * 4) >>> 0) >>> 0) === dwPlayerGuid) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuest, 4, pTextHeader, nNpcId);
      return;
    }
  }
  if (bit0 === 1) {
    return;
  }
  const bState = m.u8((pQuest + 0x0c) >>> 0);
  if (bState >= 4 && bit0d === 0) {
    return;
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    return;
  }
  const nMsgIdx = m.u32((ACT1Q1_DIALOG_STATE_MAP_VA + bState * 4) >>> 0) | 0;
  if (nMsgIdx === -1 || (nMsgIdx >>> 0) >= 8) {
    return;
  }
  QUESTS_AddNpcDialogTextNodes113c(m, pQuest, nMsgIdx, pTextHeader, nNpcId);
}

/**
 * Act 1 Quest 1 player callback: updates player quest 1 state bits (2, 3, or 4) from quest state.
 *
 * @va D2Game:0x6FC82370
 */
export function ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82370);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 1) === 1
  ) {
    return 0;
  }
  const pQuest = findQuestNodeInGame113c(m, pGame, 1);
  if (pQuest === 0) {
    return 0;
  }
  const bLastState = m.u8((pQuest + 0x0c) >>> 0);
  if (bLastState === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 2);
    return 0;
  }
  if (bLastState !== 3) {
    return 0;
  }
  if (m.u8((pQuest + 0x0b) >>> 0) === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 3);
    return 0;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 4);
  return 0;
}

/**
 * Act 1 Quest 0 callback 00: handles Warriv initial greeting (class 3 Paladin uses table 1, others 0).
 *
 * @va D2Game:0x6FC82410
 */
export function ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC82410);
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0;
  if (pNpc === 0 || (m.u32((pNpc + 0x04) >>> 0) | 0) !== 0x9b) {
    return;
  }
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0, 0) !== 0) {
    return;
  }
  const nPlayerClass = pPlayer !== 0 ? m.u32((pPlayer + 0x04) >>> 0) | 0 : -1;
  const nMsgIdx = nPlayerClass === 3 ? 1 : 0;
  QUESTS_AddNpcDialogTextNodes113c(m, pQuest, nMsgIdx, m.u32((pQuestArg + 0x14) >>> 0), 0x9b);
}

/**
 * Act 1 Cain intro/gossip callback: rolls dialog index (0..1 or 2..4) using player's unit seed (+0x20).
 *
 * @va D2Game:0x6FC824D0
 */
export function ACT1_IntroCainActivate_6FC824D0_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC824D0);
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0;
  if (pNpc === 0 || (m.u32((pNpc + 0x04) >>> 0) | 0) !== 0x10a) {
    return;
  }
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  const pQuestOwnerGame = pQuest !== 0 ? (m.u32((pQuest + 0x04) >>> 0) >>> 0) : pGame;
  const pQuest1 = pQuestOwnerGame !== 0 ? findQuestNodeInGame113c(m, pQuestOwnerGame, 1) : 0;
  if (pGame === 0) {
    throw new D2CommonAssertError('ptGame', 0x820);
  }
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0;
  if (pQuestControl === 0 || (m.u32((pQuestControl + 0x08) >>> 0) >>> 0) === 0) {
    throw new D2CommonAssertError('ptGame', 0x82c);
  }
  const pGlobalQuestFlags = m.u32((pQuestControl + 0x0c) >>> 0) >>> 0;
  const bGlobalDone =
    pGlobalQuestFlags !== 0 ? DRLGWARP_TestRoomTileBit113c(m, pGlobalQuestFlags, 1, 0x0d) : 0;
  let nMsgIdx = 0;
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  if (bGlobalDone === 0 && pQuest1 !== 0 && m.u8((pQuest1 + 0x09) >>> 0) !== 0) {
    const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
    const bit0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0);
    const bit0d = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0x0d);
    const bit1 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 1);
    if (bit0d === 0 && bit1 === 0 && bit0 === 0) {
      nMsgIdx = rollUnitSeed113c(m, (pPlayer + 0x20) >>> 0, 2);
    } else {
      nMsgIdx = (rollUnitSeed113c(m, (pPlayer + 0x20) >>> 0, 3) + 2) | 0;
    }
  } else {
    nMsgIdx = (rollUnitSeed113c(m, (pPlayer + 0x20) >>> 0, 3) + 2) | 0;
  }
  QUESTS_AddNpcDialogTextNodes113c(m, pQuest, nMsgIdx, m.u32((pQuestArg + 0x14) >>> 0), 0x10a);
}

/**
 * Marks quest 6 states 0x0D and 1 and updates the client's Act/difficulty completion word (+0x0A).
 *
 * @va D2Game:0x6FC82640
 */
export function ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pQuestFlags: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC82640);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 0x0d);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 1);
  let pClient = 0;
  if ((pPlayer >>> 0) !== 0 && m.u32(pPlayer >>> 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0;
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0;
  }
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const wFlags = m.u16((pClient + 0x0a) >>> 0);
  const nTotalActs = (((wFlags & 0x20) | 0x80) >>> 5) | 0;
  const nCurrentProgress = (wFlags >>> 8) & 0x1f;
  const nTargetProgress = (Math.imul(nTotalActs, nDifficulty) + 1) | 0;
  if (nTargetProgress >= nCurrentProgress) {
    const wReloaded = m.u16((pClient + 0x0a) >>> 0);
    const wNewFlags = ((wReloaded & 0xe0ff) | ((nTargetProgress << 8) & 0xffff)) & 0xffff;
    m.setU16((pClient + 0x0a) >>> 0, wNewFlags);
  }
}

/**
 * Act 1 Quest 3 party callback: when in Catacombs Level 4 (0x19), completes quest 5, clears bit 1,
 * plays sound 0x25, and adds player GUID to +0x34/+0x64; otherwise sets quest 5 state 0x0E.
 *
 * @va D2Game:0x6FC827A0
 */
export function ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC827A0);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0) === 1) {
    return 0;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0;
  if (pRoom === 0) {
    return 0;
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  if (nLevelId === 0x19) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0x0d);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0);
    QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 5, 1);
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x25, pPlayer);
    const pQuest = findQuestNodeInGame113c(m, pGame, 5);
    if (pQuest !== 0) {
      const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
      const count = m.u16((pQuestDataEx + 0x64) >>> 0);
      if (count < 0x0c) {
        const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
        m.setU32((pQuestDataEx + 0x34 + count * 4) >>> 0, dwPlayerGuid);
        m.setU16((pQuestDataEx + 0x64) >>> 0, (count + 1) & 0xffff);
      }
    }
    return 0;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0x0e);
  return 0;
}

/**
 * Act 1 Quest 4 object init handler for Inifuss Tree (records tree GUID if class 0x3D and attaches quest 4).
 *
 * @va D2Game:0x6FC828D0
 */
export function ACT1Q4_InitInifussTreeObject_6FC828D0_113c(
  m: D2KernMemory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC828D0);
  const pGame = m.u32(pObjInit >>> 0) >>> 0;
  const pQuest = findQuestNodeInGame113c(m, pGame, 4);
  if (pQuest === 0) {
    const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
    if (pObject === 0 || (m.u32((pObject + 0x10) >>> 0) | 0) !== 2) {
      UNITS_ChangeAnimMode113c(m, pObject, 2);
    }
    return;
  }
  const pQuestGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
  const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
  const pQuestInGame = findQuestNodeInGame113c(m, pQuestGame, 4);
  if (pQuestInGame === 0) {
    return;
  }
  if (
    pObject !== 0 &&
    m.u32(pObject >>> 0) === 2 &&
    (m.u32((pObject + 0x04) >>> 0) | 0) === 0x3d
  ) {
    ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c(m, pQuestInGame, pObject);
  }
  QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pQuestInGame, pObject, pQuestGame);
}

/**
 * Act 1 Quest 4 party callback: sets quest 4 states 0x0D and 1 and sends quest log packet 0x28.
 *
 * @va D2Game:0x6FC829B0
 */
export function ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC829B0);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 1) === 1
  ) {
    return;
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0;
  if (pRoom === 0) {
    return;
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  if (nLevelId === 0) {
    return;
  }
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 0) {
    return;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 0x0d);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 1);
  QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, pGame);
}

/**
 * Act 1 Quest 2 party callback: plays sound 0x22 on players with quest 2 bit 0x0D set.
 *
 * @va D2Game:0x6FC82B40
 */
export function ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82B40);
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0x0d) !== 1) {
    return 0;
  }
  if ((pPlayer >>> 0) === 0) {
    throw new D2CommonAssertError('ptGame', 0x558);
  }
  m.setU16((pPlayer + 0x6e) >>> 0, 0x22);
  m.setU32((pPlayer + 0x70) >>> 0, pPlayer >>> 0);
  UNITROOM_RefreshUnit113c(m, pPlayer);
  m.setU32((pPlayer + 0xc4) >>> 0, (m.u32((pPlayer + 0xc4) >>> 0) | 0x400) >>> 0);
  return 0;
}

/**
 * Act 1 NPC intro activation callback: dispatches jump table 0x6FC82EDC for NPCs 0x93..0x9A
 * (Gheed=147/class 2, Akara=148/class 1, Kashya=150/class 0, Charsi=154/class 4).
 *
 * @va D2Game:0x6FC82E50
 */
export function ACT1_IntroNpcActivate_6FC82E50_113c(
  m: D2KernMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC82E50);
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0;
  const nNpcId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1;
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const nPlayerClass = pPlayer !== 0 ? m.u32((pPlayer + 0x04) >>> 0) | 0 : -1;
  let nPreferredClass = -1;
  switch ((nNpcId - 0x93) | 0) {
    case 0:
      nPreferredClass = 2;
      break;
    case 1:
      nPreferredClass = 1;
      break;
    case 3:
      nPreferredClass = 0;
      break;
    case 7:
      nPreferredClass = 4;
      break;
    default:
      return;
  }
  const pGame = m.u32(pQuestArg >>> 0) >>> 0;
  if (QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, nNpcId, pGame) === 0) {
    const nMsgIdx = nPlayerClass === nPreferredClass ? 1 : 0;
    QUESTS_AddNpcDialogTextNodes113c(m, pQuest, nMsgIdx, m.u32((pQuestArg + 0x14) >>> 0), nNpcId);
  }
}

/**
 * Act 1 NPC intro callback 12: marks NPC intro flag done when matching intro dialog ID is scrolled.
 *
 * @va D2Game:0x6FC82F00
 */
export function ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c(
  m: D2KernMemory113c,
  _pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC82F00);
  const nNpcId = m.u32((pQuestArg + 0x14) >>> 0) | 0;
  const wMsgId = m.u16((pQuestArg + 0x18) >>> 0);
  let bMatch = false;
  switch ((nNpcId - 0x93) | 0) {
    case 0:
      bMatch = wMsgId === 0x2d || wMsgId === 0x2e;
      break;
    case 1:
      bMatch = wMsgId === 0x0b || wMsgId === 0x0c;
      break;
    case 3:
      bMatch = wMsgId === 0x18 || wMsgId === 0x19;
      break;
    case 7:
      bMatch = wMsgId === 0x24 || wMsgId === 0x25;
      break;
    default:
      return;
  }
  if (bMatch) {
    const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
    const pGame = m.u32(pQuestArg >>> 0) >>> 0;
    QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, nNpcId, pGame);
  }
}

/**
 * Iterates all player GUIDs in a 32-entry GUID list (count at +0x80), sets quest states 0x0D and 0,
 * and optionally triggers wSoundId on each qualifying player.
 *
 * @va D2Game:0x6FC83270
 */
export function QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c(
  m: D2KernMemory113c,
  pGame: number,
  pGuidList: number,
  nQuestId: number,
  wSoundId: number,
): void {
  hitD2GameVa113c(0x6FC83270);
  let i = 0;
  while (i < m.u16((pGuidList + 0x80) >>> 0)) {
    const dwPlayerGuid = m.u32((pGuidList + i * 4) >>> 0) >>> 0;
    const pPlayer = findUnitInGameHash113c(m, pGame, 0x1120, dwPlayerGuid);
    if (pPlayer !== 0) {
      const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId | 0, 0) !== 1) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, nQuestId | 0, 0x0d);
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, nQuestId | 0, 0);
        if ((wSoundId | 0) !== 0) {
          m.setU16((pPlayer + 0x6e) >>> 0, wSoundId & 0xffff);
          m.setU32((pPlayer + 0x70) >>> 0, pPlayer >>> 0);
          UNITROOM_RefreshUnit113c(m, pPlayer);
          m.setU32((pPlayer + 0xc4) >>> 0, (m.u32((pPlayer + 0xc4) >>> 0) | 0x400) >>> 0);
        }
      }
    }
    i = (i + 1) | 0;
  }
}

/**
 * Act 1 Quest 2 nearby party callback: checks if the player's room is the same as or adjacent to
 * the killed monster's room, and sets quest 2 states 0x0D and 1.
 *
 * @va D2Game:0x6FC83930
 */
export function ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC83930);
  const pPlayerRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0;
  const pQuest = findQuestNodeInGame113c(m, pGame, 2);
  if (pQuest === 0) {
    throw new D2CommonAssertError('ptGame', 0x133);
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  if (m.u8((pQuestDataEx + 0x02) >>> 0) === 0) {
    return 0;
  }
  const dwTargetMonGuid = m.u32((pQuestDataEx + 0x08) >>> 0) >>> 0;
  const pTrackedMon = findUnitInGameHash113c(m, pGame, 0x1320, dwTargetMonGuid);
  const pTrackedMonRoom = UNITS_GetRoom113c(m, pTrackedMon) >>> 0;
  if (pPlayerRoom === 0) {
    return 0;
  }
  let bNearby = 0;
  if (pPlayerRoom === pTrackedMonRoom) {
    bNearby = 1;
  } else {
    const pPlayerRoomCur = UNITS_GetRoom113c(m, pPlayer) >>> 0;
    if (pPlayerRoomCur === 0) {
      throw new D2CommonAssertError('ptGame', 0x14e);
    }
    const sp = k2W3B6StackPtr;
    k2W3B6StackPtr = (sp + 0x10) >>> 0;
    try {
      m.setU32(sp, 0);
      m.setU32((sp + 4) >>> 0, 0);
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pPlayerRoomCur, sp, (sp + 4) >>> 0);
      const ppRooms = m.u32(sp) >>> 0;
      const nRooms = m.u32((sp + 4) >>> 0) >>> 0;
      for (let i = 0; i < nRooms; i = (i + 1) >>> 0) {
        if ((m.u32((ppRooms + i * 4) >>> 0) >>> 0) === pTrackedMonRoom) {
          bNearby = 1;
          break;
        }
      }
    } finally {
      k2W3B6StackPtr = sp;
    }
  }
  const pQuestFlags = getPlayerQuestFlags113c(m, pGame, pPlayer);
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 1) === 0 &&
    bNearby !== 0
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 0x0d);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 1);
  }
  return 0;
}

/**
 * Updates Cain cage coordinates/state in Act 1 Quest 4 and spawns portal object 0xBD at Cain monster's position.
 *
 * @va D2Game:0x6FC863A0
 */
export function ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC863A0);
  const pQuest = findQuestNodeInGame113c(m, pGame, 4);
  if (pQuest === 0) {
    return;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const bHadCage = m.u8((pQuestDataEx + 0x70) >>> 0);
  m.setU8((pQuestDataEx + 0x91) >>> 0, 1);
  m.setU8((pQuestDataEx + 0x52) >>> 0, 1);
  if (bHadCage !== 1) {
    return;
  }
  const dwCageGuid = m.u32((pQuestDataEx + 0x6c) >>> 0) >>> 0;
  const pCageObj = findUnitInGameHash113c(m, pGame, 0x1520, dwCageGuid);
  if (pCageObj === 0) {
    return;
  }
  const pObjRoom = UNITS_GetRoom113c(m, pCageObj) >>> 0;
  const x = UNIT_GetPosX113c(m, pCageObj) | 0;
  const y = UNIT_GetPosY113c(m, pCageObj) | 0;
  const spArgs = k2W3B6StackPtr;
  k2W3B6StackPtr = (spArgs + 0x20) >>> 0;
  try {
    m.setU32((spArgs + 0x00) >>> 0, pGame >>> 0);
    m.setU32((spArgs + 0x04) >>> 0, pCageObj >>> 0);
    m.setU32((spArgs + 0x08) >>> 0, pObjRoom);
    m.setU32((spArgs + 0x0c) >>> 0, 0);
    m.setU32((spArgs + 0x10) >>> 0, 0);
    m.setU32((spArgs + 0x14) >>> 0, x >>> 0);
    m.setU32((spArgs + 0x18) >>> 0, y >>> 0);
    QUEST_Act1TownPortalUpdateState113c(m, spArgs);
  } finally {
    k2W3B6StackPtr = spArgs;
  }
  if (m.u8((pQuestDataEx + 0x51) >>> 0) !== 1) {
    return;
  }
  const dwCainMonGuid = m.u32((pQuestDataEx + 0x68) >>> 0) >>> 0;
  const pCainMon = findUnitInGameHash113c(m, pGame, 0x1320, dwCainMonGuid);
  if (pCainMon === 0) {
    return;
  }
  const sp = k2W3B6StackPtr;
  k2W3B6StackPtr = (sp + 0x10) >>> 0;
  try {
    m.setU32(sp, 0);
    m.setU32((sp + 4) >>> 0, 0);
    PATH_GetTargetTypeAndPosition113c(m, pCainMon, sp);
    const portalX = m.u32(sp) | 0;
    const portalY = m.u32((sp + 4) >>> 0) | 0;
    const pMonRoom = UNITS_GetRoom113c(m, pCainMon) >>> 0;
    const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pMonRoom, portalX, portalY) >>> 0;
    if (pTargetRoom !== 0) {
      const pPortalObj = SUNIT_AllocUnitData113c(
        m,
        2,
        0xbd,
        portalX,
        portalY,
        pGame,
        pTargetRoom,
        1,
        1,
        0,
      ) >>> 0;
      if (pPortalObj !== 0) {
        m.setU8((pQuestDataEx + 0x96) >>> 0, 1);
        m.setU32((pQuestDataEx + 0xa4) >>> 0, m.u32((pPortalObj + 0x0c) >>> 0));
      }
    }
  } finally {
    k2W3B6StackPtr = sp;
  }
}
