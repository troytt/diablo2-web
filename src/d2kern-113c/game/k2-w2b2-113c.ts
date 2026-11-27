/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 2 Batch 2 (w2b2).
 *
 * Clean-room 1:1 binary port of 45 strictly ready D2Game.dll functions in the
 * 0x6FC80A30..0x6FC89A80 address range (Act 1 Quest 0..6 callbacks, object
 * initialization/operate handlers, NPC intro bitfield helpers, permanent stat
 * reward handlers, and shrine effect callbacks).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts';
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts';
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts';
import { D2CommonAssertError } from '../common/inline-helpers.ts';
import { imul32 } from '../common/int-math.ts';
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts';
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts';
import {
  ITEMS_CheckItemTypeIdMemPort113c,
  STATLIST_AddUnitStatMemPort113c,
} from '../common/k0-d2common-memports.ts';
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record.ts';
import {
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../common/statlist.ts';
import { UNITROOM_RefreshUnit113c, UNITS_GetRoom113c } from '../common/unit.ts';
import type { Memory113c } from '../mem/sparse-memory.ts';
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c.ts';
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c.ts';
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts';
import {
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
  QUESTS_SendQuestStateAlert5D_113c,
} from './k2-items-tc-w1-113c.ts';
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.ts';
import { UNITS_ChangeAnimMode113c } from './monster-events.ts';
import { EVENT_SetEventFull113c } from './timer-wheel.ts';
import { hitD2GameVa113c } from '../va-trace-113c.ts';

const QUEST_NPC_INTRO_TABLE_VA = 0x6fd27e50;
const QUEST_NPC_INTRO_COUNT_VA = 0x6fd27f68;
let k2W2B2StackPtr = 0x7ec80000;

const DEFAULT_NPC_INTRO_TABLE_113C: readonly (readonly [number, number])[] = [
  [0xffffffff, 0],
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

function ensureQuestNpcIntroTableSeeded(m: Memory113c): void {
  let needsSeed = false;
  try {
    needsSeed = m.u32(QUEST_NPC_INTRO_COUNT_VA) === 0 && m.u32(QUEST_NPC_INTRO_TABLE_VA) === 0;
  } catch {
    needsSeed = true;
  }
  if (needsSeed) {
    for (let i = 0; i < DEFAULT_NPC_INTRO_TABLE_113C.length; i = (i + 1) | 0) {
      const entry = DEFAULT_NPC_INTRO_TABLE_113C[i];
      if (entry !== undefined) {
        m.setU32((QUEST_NPC_INTRO_TABLE_VA + i * 8) >>> 0, entry[0] >>> 0);
        m.setU32((QUEST_NPC_INTRO_TABLE_VA + i * 8 + 4) >>> 0, entry[1] >>> 0);
      }
    }
    m.setU32(QUEST_NPC_INTRO_COUNT_VA, DEFAULT_NPC_INTRO_TABLE_113C.length);
  }
}

function findQuestNodeInGame(m: Memory113c, pGame: number, nQuestId: number): number {
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

/**
 * @va D2Game.dll@0x6fc80a30
 * Act 1 Quest 6 callback 11: removes player GUID from quest and Sisters to the Slaughter GUID lists (D2Game:0x6FC80A30).
 */
export function ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC80A30);
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuest, pQuestArg);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const dwGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  QUESTS_GuidListRemove113c(m, pQuestDataEx, dwGuid);
  QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0x84) >>> 0, dwGuid);
  return QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0x108) >>> 0, dwGuid);
}

/**
 * @va D2Game.dll@0x6fc80da0
 * Act 1 Quest 5 object init handler for Horadric Malus stand (D2Game:0x6FC80DA0).
 */
export function ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC80DA0);
  const pGame = m.u32(pObjInit >>> 0) >>> 0;
  const pQuest = findQuestNodeInGame(m, pGame, 5);
  if (pQuest === 0) {
    throw new D2CommonAssertError('ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c', 0x423);
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
    UNITS_ChangeAnimMode113c(m, pObject, 3);
  }
}

/**
 * @va D2Game.dll@0x6fc80ec0
 * Act 1 Quest 5 party callback: completes Charsi quest state when in Act 1 (D2Game:0x6FC80EC0).
 */
export function ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC80EC0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0) === 1) {
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
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0x0d);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0);
}

/**
 * @va D2Game.dll@0x6fc81420
 * Act 1 Quest 4 helper: removes player GUID from Cain portal GUID list at +0xB4 (D2Game:0x6FC81420).
 */
export function ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FC81420);
  const pQuest = findQuestNodeInGame(m, pGame, 4);
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const dwGuid = (pPlayer >>> 0) !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  return QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0xb4) >>> 0, dwGuid);
}

/**
 * @va D2Game.dll@0x6fc814a0
 * Act 1 Quest 4 object init handler for Cain gibbet cage (D2Game:0x6FC814A0).
 */
export function ACT1Q4_InitCainGibbetObject_6FC814A0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC814A0);
  const pGame = m.u32(pObjInit >>> 0) >>> 0;
  const pQuest = findQuestNodeInGame(m, pGame, 4);
  if (pQuest === 0) {
    const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
    if (pObject === 0 || (m.u32((pObject + 0x10) >>> 0) | 0) !== 2) {
      UNITS_ChangeAnimMode113c(m, pObject, 2);
    }
    return;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  m.setU8((pQuestDataEx + 0x47) >>> 0, 1);
  if (m.u8((pQuest + 0x09) >>> 0) === 0 || m.u8((pQuestDataEx + 0x50) >>> 0) !== 0) {
    m.setU32((pQuestDataEx + 0x58) >>> 0, 1);
  }
  const nMode = m.u32((pQuestDataEx + 0x58) >>> 0) | 0;
  const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
  UNITS_ChangeAnimMode113c(m, pObject, nMode);
}

/**
 * @va D2Game.dll@0x6fc81500
 * Act 1 Quest 4 party callback: sets quest 4 state 0x0A when player is in Tristram (level 0x27) (D2Game:0x6FC81500).
 */
export function ACT1Q4_SetTristramEnteredQuestStateCallback_6FC81500_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC81500);
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0;
  if (pRoom !== 0) {
    const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
    if (nLevelId === 0x27) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
      const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
      const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 0x0a);
    }
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc816f0
 * Act 1 Quest 4 party callback: sets quest 4 state 4 when Cain is rescued by party in Act 1 (D2Game:0x6FC816F0).
 */
export function ACT1Q4_SetCainRescuedByPartyCallback_6FC816F0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC816F0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0) === 1) {
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 1) === 1) {
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
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 4);
}

/**
 * @va D2Game.dll@0x6fc81860
 * Act 1 Quest 4 helper: records Inifuss Tree object GUID in quest data (D2Game:0x6FC81860).
 */
export function ACT1Q4_RecordInifussTreeObjectGuid_6FC81860_113c(
  m: Memory113c,
  pQuest: number,
  pObject: number,
): void {
  hitD2GameVa113c(0x6FC81860);
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  m.setU8((pQuestDataEx + 0x49) >>> 0, 1);
  const dwGuid = (pObject >>> 0) !== 0 ? m.u32((pObject + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  m.setU32((pQuestDataEx + 0x28) >>> 0, dwGuid);
}

/**
 * @va D2Game.dll@0x6fc81880
 * Act 1 Quest 4 callback 11: removes player GUID from quest 4 GUID lists (D2Game:0x6FC81880).
 */
export function ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC81880);
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuest, pQuestArg);
  const pPlayer0 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const dwGuid0 = pPlayer0 !== 0 ? m.u32((pPlayer0 + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0xb4) >>> 0, dwGuid0);
  const pPlayer1 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const dwGuid1 = pPlayer1 !== 0 ? m.u32((pPlayer1 + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  return QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0x138) >>> 0, dwGuid1);
}

/**
 * @va D2Game.dll@0x6fc818d0
 * Act 1 Quest 4 callback 14: counts Inifuss scrolls ('bkd ' and 'bks ') on joining player (D2Game:0x6FC818D0).
 */
export function ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC818D0);
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const pBkd = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x20646b62,
  );
  const pBks = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x20736b62,
  );
  if (pBkd !== 0) {
    m.setU32((pQuestDataEx + 0x7c) >>> 0, (m.u32((pQuestDataEx + 0x7c) >>> 0) + 1) >>> 0);
  }
  if (pBks !== 0) {
    m.setU32((pQuestDataEx + 0x7c) >>> 0, (m.u32((pQuestDataEx + 0x7c) >>> 0) + 1) >>> 0);
  }
}

/**
 * @va D2Game.dll@0x6fc81b20
 * Act 1 Quest 5 callback: marks Horadric Malus present in quest 3 data if player carries 'hdm ' (D2Game:0x6FC81B20).
 */
export function ACT1Q5_CheckPlayerHasHoradricMalusCallback_6FC81B20_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC81B20);
  const pItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x206d6468);
  if (pItem === 0) {
    return;
  }
  const pQuest = findQuestNodeInGame(m, pGame, 3);
  if (pQuest !== 0) {
    const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
    m.setU8((pQuestDataEx + 0xa0) >>> 0, 1);
  }
}

/**
 * @va D2Game.dll@0x6fc81be0
 * Act 1 Quest 5 callback 11: removes player GUID from questDataEx + 0x14 GUID list (D2Game:0x6FC81BE0).
 */
export function ACT1Q5_Callback11_RemovePlayerGuid_6FC81BE0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC81BE0);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const dwGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  return QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0x14) >>> 0, dwGuid);
}

/**
 * @va D2Game.dll@0x6fc81c00
 * Act 1 Quest 5 callback 14: tracks Horadric Malus count when player joins game (D2Game:0x6FC81C00).
 */
export function ACT1Q5_Callback14_PlayerJoinedWithMalus_6FC81C00_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC81C00);
  const pItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x206d6468,
  );
  if (pItem === 0) {
    return;
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    return;
  }
  if (m.u8((pQuest + 0x0c) >>> 0) === 5) {
    return;
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const nMalusCount = (m.u32((pQuestDataEx + 0x9c) >>> 0) + 1) >>> 0;
  m.setU32((pQuestDataEx + 0x9c) >>> 0, nMalusCount);
  if (
    nMalusCount === 1 &&
    m.u8((pQuestDataEx + 0x01) >>> 0) !== 0 &&
    (m.u32((pQuestDataEx + 0x98) >>> 0) | 0) === 2
  ) {
    m.setU8((pQuest + 0x0b) >>> 0, 2);
  }
}

/**
 * @va D2Game.dll@0x6fc81d40
 * Act 1 Quest 5 party callback: grants Charsi imbue reward state when player base level >= 8 (D2Game:0x6FC81D40).
 */
export function ACT1Q5_GrantImbueRewardIfLevel8Callback_6FC81D40_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC81D40);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0) === 1) {
    return;
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 1) === 1) {
    return;
  }
  if ((STATLIST_GetUnitBaseStat113c(m, pPlayer, 0x0c, 0) | 0) < 8) {
    return;
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 3, 0x0d);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 3, 1);
}

/**
 * @va D2Game.dll@0x6fc81f30
 * Quest callback 11: removes player GUID from quest primary GUID list at +0x1C (D2Game:0x6FC81F30).
 */
export function QUESTS_Callback11_RemovePlayerFromQuestGuidList_6FC81F30_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC81F30);
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const dwGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  return QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid);
}

/**
 * @va D2Game.dll@0x6fc82170
 * Quest callback 11: removes player GUID from quest +0x1C and questDataEx +0x00 GUID lists (D2Game:0x6FC82170).
 */
export function QUESTS_Callback11_RemovePlayerFromQuestAndExGuidLists_6FC82170_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC82170);
  const pPlayer0 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const dwGuid0 = pPlayer0 !== 0 ? m.u32((pPlayer0 + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid0);
  const pPlayer1 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0;
  const dwGuid1 = pPlayer1 !== 0 ? m.u32((pPlayer1 + 0x0c) >>> 0) >>> 0 : 0xffffffff;
  return QUESTS_GuidListRemove113c(m, pQuestDataEx, dwGuid1);
}

/**
 * @va D2Game.dll@0x6fc82340
 * Act 1 Quest 1 respec helper: marks Akara respec quest (0x29) states 0x0D and 1 (D2Game:0x6FC82340).
 */
export function ACT1Q1_CompleteAkaraRespecReward_6FC82340_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC82340);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x29, 0x0d);
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x29, 1);
}

/**
 * @va D2Game.dll@0x6fc82490
 * Act 1 Quest 0 callback 12: sets quest 0 state 0 upon Warriv intro message 0 or 1 (D2Game:0x6FC82490).
 */
export function ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FC82490);
  const wNpcId = m.u16((pQuestArg + 0x14) >>> 0);
  const wMessageIndex = m.u16((pQuestArg + 0x18) >>> 0);
  if (wNpcId !== 0x9b) {
    return;
  }
  if (wMessageIndex !== 0 && wMessageIndex !== 1) {
    return;
  }
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0;
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0, 0);
}

/**
 * @va D2Game.dll@0x6fc825f0
 * Act 1 Quest 6 party callback: sets quest 6 state 0x0E and sends alert 0x5D if not completed (D2Game:0x6FC825F0).
 */
export function ACT1Q6_SetCompletedBeforeAlertCallback_6FC825F0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC825F0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 1) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 0x0e);
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer, 6, 0);
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc826c0
 * Act 1 Quest 6 party callback: plays Andariel defeated event sound 0x21 if quest 6 states 1 and 0x0D set (D2Game:0x6FC826C0).
 */
export function ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC826C0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 1) !== 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 0x0d) !== 0
  ) {
    SUNIT_SetUnitEventSound113c(m, pPlayer, 0x21, pPlayer);
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc82760
 * Act 1 Quest 3 party callback: sets quest 5 state 0x0E and sends alert 0x5D if state 0 not set (D2Game:0x6FC82760).
 */
export function ACT1Q3_SetCompletedBeforeAlertCallback_6FC82760_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82760);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0) !== 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0x0e);
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer, 5, 0);
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc82960
 * Act 1 Quest 4 party callback: sets quest 4 state 0x0E and sends alert 0x5D if not completed (D2Game:0x6FC82960).
 */
export function ACT1Q4_SetCompletedBeforeAlertCallback_6FC82960_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82960);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 1) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 0x0e);
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer, 4, 0);
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc82a30
 * Act 1 Quest 5 helper: sends 6-byte packet 0x5D (quest 4, flags 1, arg 0) to player client (D2Game:0x6FC82A30).
 */
export function ACT1Q5_SendTowerTomeQuestAlert5D_6FC82A30_113c(
  m: Memory113c,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC82A30);
  const sp = k2W2B2StackPtr;
  k2W2B2StackPtr = (sp + 8) >>> 0;
  try {
    m.setU32(sp, 0);
    m.setU8(sp, 0x5d);
    m.setU8((sp + 2) >>> 0, 1);
    m.setU8((sp + 1) >>> 0, 4);
    let pClient = 0;
    if ((pPlayer >>> 0) !== 0 && m.u32(pPlayer >>> 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
      pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0;
    }
    const dwHead = m.u32(sp) >>> 0;
    m.setU32(sp, dwHead);
    m.setU16((sp + 4) >>> 0, 0);
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 6);
  } finally {
    k2W2B2StackPtr = sp;
  }
}

/**
 * @va D2Game.dll@0x6fc82bb0
 * Act 1 Quest 2 party callback: sets quest 2 state 0x0E and sends alert 0x5D if not completed (D2Game:0x6FC82BB0).
 */
export function ACT1Q2_SetCompletedBeforeAlertCallback_6FC82BB0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82BB0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 1) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 0x0e);
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer, 2, 0);
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc82c60
 * Act 1 Quest 1 party callback: plays Den of Evil cleared sound 0x23 if quest 1 state 0x0D is set (D2Game:0x6FC82C60).
 */
export function ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82C60);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0x0d) !== 0) {
    if ((pPlayer >>> 0) === 0) {
      throw new D2CommonAssertError('ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c', 0x558);
    }
    m.setU16((pPlayer + 0x6e) >>> 0, 0x23);
    m.setU32((pPlayer + 0x70) >>> 0, pPlayer >>> 0);
    UNITROOM_RefreshUnit113c(m, pPlayer);
    m.setU32((pPlayer + 0xc4) >>> 0, (m.u32((pPlayer + 0xc4) >>> 0) | 0x400) >>> 0);
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc82cd0
 * Act 1 Quest 1 party callback: sets quest 1 state 0x0E and sends alert 0x5D + quest log 0x28 (D2Game:0x6FC82CD0).
 */
export function ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC82CD0);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pQuestFlags = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0;
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 1) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 0x0e);
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer, 1, 0);
    QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, pGame);
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc88f90
 * Object init handler: sets anim mode 1 and schedules event 7 at gameFrame + 25 (D2Game:0x6FC88F90).
 */
export function OBJECTS_InitOperatingObjectWithTimer25_6FC88F90_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC88F90);
  const pObject0 = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
  UNITS_ChangeAnimMode113c(m, pObject0, 1);
  const pGame = m.u32(pObjInit >>> 0) >>> 0;
  const dwFrame = (m.u32((pGame + 0xa8) >>> 0) + 0x19) >>> 0;
  const pObject1 = m.u32((pObjInit + 0x04) >>> 0) >>> 0;
  EVENT_SetEventFull113c(m, pGame, pObject1, 7, dwFrame, 0, 0, 0);
}

/**
 * @va D2Game.dll@0x6fc89490
 * Clears an NPC intro flag in the player's difficulty intro bitfield at +4 (D2Game:0x6FC89490).
 */
export function QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c(
  m: Memory113c,
  pPlayer: number,
  nNpcClassId: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC89490);
  ensureQuestNpcIntroTableSeeded(m);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pIntroData = m.u32((pPlayerData + nDifficulty * 4 + 0x60) >>> 0) >>> 0;
  const nCount = m.u32(QUEST_NPC_INTRO_COUNT_VA) | 0;
  let nBitIndex = 0;
  for (let i = 0; i < nCount; i = (i + 1) | 0) {
    if ((m.u32((QUEST_NPC_INTRO_TABLE_VA + i * 8) >>> 0) | 0) === (nNpcClassId | 0)) {
      nBitIndex = m.u32((QUEST_NPC_INTRO_TABLE_VA + i * 8 + 4) >>> 0) | 0;
      break;
    }
  }
  const pBitFieldHolder = m.u32((pIntroData + 0x04) >>> 0) >>> 0;
  const pBitBuffer = m.u32(pBitFieldHolder) >>> 0;
  const byteAddr = (pBitBuffer + (nBitIndex >> 3)) >>> 0;
  const mask = (~(1 << (nBitIndex & 7))) & 0xff;
  m.setU8(byteAddr, m.u8(byteAddr) & mask);
}

/**
 * @va D2Game.dll@0x6fc89590
 * Tests whether an NPC intro flag is set in the player's difficulty intro bitfield at +0 (D2Game:0x6FC89590).
 */
export function QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(
  m: Memory113c,
  pPlayer: number,
  nNpcClassId: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC89590);
  ensureQuestNpcIntroTableSeeded(m);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pIntroData = m.u32((pPlayerData + nDifficulty * 4 + 0x60) >>> 0) >>> 0;
  const nCount = m.u32(QUEST_NPC_INTRO_COUNT_VA) | 0;
  let nBitIndex = 0;
  for (let i = 0; i < nCount; i = (i + 1) | 0) {
    if ((m.u32((QUEST_NPC_INTRO_TABLE_VA + i * 8) >>> 0) | 0) === (nNpcClassId | 0)) {
      nBitIndex = m.u32((QUEST_NPC_INTRO_TABLE_VA + i * 8 + 4) >>> 0) | 0;
      break;
    }
  }
  const pBitFieldHolder = m.u32(pIntroData) >>> 0;
  const pBitBuffer = m.u32(pBitFieldHolder) >>> 0;
  const byteAddr = (pBitBuffer + (nBitIndex >> 3)) >>> 0;
  return (m.u8(byteAddr) & (1 << (nBitIndex & 7))) >>> 0;
}

/**
 * @va D2Game.dll@0x6fc895f0
 * Sets an NPC intro flag in the player's difficulty intro bitfield at +0 (D2Game:0x6FC895F0).
 */
export function QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(
  m: Memory113c,
  pPlayer: number,
  nNpcClassId: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC895F0);
  ensureQuestNpcIntroTableSeeded(m);
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer);
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0);
  const pIntroData = m.u32((pPlayerData + nDifficulty * 4 + 0x60) >>> 0) >>> 0;
  const nCount = m.u32(QUEST_NPC_INTRO_COUNT_VA) | 0;
  let nBitIndex = 0;
  for (let i = 0; i < nCount; i = (i + 1) | 0) {
    if ((m.u32((QUEST_NPC_INTRO_TABLE_VA + i * 8) >>> 0) | 0) === (nNpcClassId | 0)) {
      nBitIndex = m.u32((QUEST_NPC_INTRO_TABLE_VA + i * 8 + 4) >>> 0) | 0;
      break;
    }
  }
  const pBitFieldHolder = m.u32(pIntroData) >>> 0;
  const pBitBuffer = m.u32(pBitFieldHolder) >>> 0;
  const byteAddr = (pBitBuffer + (nBitIndex >> 3)) >>> 0;
  m.setU8(byteAddr, (m.u8(byteAddr) | (1 << (nBitIndex & 7))) & 0xff);
}

/**
 * @va D2Game.dll@0x6fc89650
 * Adds permanent skill points (stat 5) to unit and returns 1 (D2Game:0x6FC89650).
 */
export function OBJECTS_GrantUnitSkillPoints_6FC89650_113c(
  m: Memory113c,
  pGameOrUnit: number,
  pUnitOrDelta: number,
  nDeltaOpt?: number,
): number {
  hitD2GameVa113c(0x6FC89650);
  const pUnit = nDeltaOpt !== undefined ? pUnitOrDelta : pGameOrUnit;
  const nDelta = nDeltaOpt !== undefined ? nDeltaOpt : pUnitOrDelta;
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 5, nDelta | 0, 0);
  return 1;
}

/**
 * @va D2Game.dll@0x6fc89670
 * Increases unit max life (stat 7) and current life (stat 6) by nLifeAdd << 8 and returns 1 (D2Game:0x6FC89670).
 */
export function OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c(
  m: Memory113c,
  pGameOrUnit: number,
  pUnitOrLifeAdd: number,
  nLifeAddOpt?: number,
): number {
  hitD2GameVa113c(0x6FC89670);
  const pUnit = nLifeAddOpt !== undefined ? pUnitOrLifeAdd : pGameOrUnit;
  const nLifeAdd = nLifeAddOpt !== undefined ? nLifeAddOpt : pUnitOrLifeAdd;
  const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit) | 0;
  const nNewLife = (nMaxLife + ((nLifeAdd | 0) << 8)) | 0;
  STATLIST_SetUnitStat113c(m, pUnit, 6, nNewLife, 0);
  STATLIST_SetUnitStat113c(m, pUnit, 7, nNewLife, 0);
  return 1;
}

/**
 * @va D2Game.dll@0x6fc896b0
 * Adds permanent strength (stat 0) to unit and returns 1 (D2Game:0x6FC896B0).
 */
export function OBJECTS_GrantUnitStrength_6FC896B0_113c(
  m: Memory113c,
  pGameOrUnit: number,
  pUnitOrDelta: number,
  nDeltaOpt?: number,
): number {
  hitD2GameVa113c(0x6FC896B0);
  const pUnit = nDeltaOpt !== undefined ? pUnitOrDelta : pGameOrUnit;
  const nDelta = nDeltaOpt !== undefined ? nDeltaOpt : pUnitOrDelta;
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 0, nDelta | 0, 0);
  return 1;
}

/**
 * @va D2Game.dll@0x6fc896d0
 * Adds permanent vitality (stat 3) to unit and returns 1 (D2Game:0x6FC896D0).
 */
export function OBJECTS_GrantUnitVitality_6FC896D0_113c(
  m: Memory113c,
  pGameOrUnit: number,
  pUnitOrDelta: number,
  nDeltaOpt?: number,
): number {
  hitD2GameVa113c(0x6FC896D0);
  const pUnit = nDeltaOpt !== undefined ? pUnitOrDelta : pGameOrUnit;
  const nDelta = nDeltaOpt !== undefined ? nDeltaOpt : pUnitOrDelta;
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 3, nDelta | 0, 0);
  return 1;
}

/**
 * @va D2Game.dll@0x6fc896f0
 * Adds permanent dexterity (stat 2) to unit and returns 1 (D2Game:0x6FC896F0).
 */
export function OBJECTS_GrantUnitDexterity_6FC896F0_113c(
  m: Memory113c,
  pGameOrUnit: number,
  pUnitOrDelta: number,
  nDeltaOpt?: number,
): number {
  hitD2GameVa113c(0x6FC896F0);
  const pUnit = nDeltaOpt !== undefined ? pUnitOrDelta : pGameOrUnit;
  const nDelta = nDeltaOpt !== undefined ? nDeltaOpt : pUnitOrDelta;
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 2, nDelta | 0, 0);
  return 1;
}

/**
 * @va D2Game.dll@0x6fc89710
 * Adds permanent energy (stat 1) to unit and returns 1 (D2Game:0x6FC89710).
 */
export function OBJECTS_GrantUnitEnergy_6FC89710_113c(
  m: Memory113c,
  pGameOrUnit: number,
  pUnitOrDelta: number,
  nDeltaOpt?: number,
): number {
  hitD2GameVa113c(0x6FC89710);
  const pUnit = nDeltaOpt !== undefined ? pUnitOrDelta : pGameOrUnit;
  const nDelta = nDeltaOpt !== undefined ? nDeltaOpt : pUnitOrDelta;
  STATLIST_AddUnitStatMemPort113c(m, pUnit, 1, nDelta | 0, 0);
  return 1;
}

/**
 * @va D2Game.dll@0x6fc89730
 * Increases unit max mana (stat 9) and current mana (stat 8) by nManaAdd << 8 and returns 1 (D2Game:0x6FC89730).
 */
export function OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c(
  m: Memory113c,
  pGameOrUnit: number,
  pUnitOrManaAdd: number,
  nManaAddOpt?: number,
): number {
  hitD2GameVa113c(0x6FC89730);
  const pUnit = nManaAddOpt !== undefined ? pUnitOrManaAdd : pGameOrUnit;
  const nManaAdd = nManaAddOpt !== undefined ? nManaAddOpt : pUnitOrManaAdd;
  const nMaxMana = STATLIST_GetMaxManaFromUnit113c(m, pUnit) | 0;
  const nNewMana = (nMaxMana + ((nManaAdd | 0) << 8)) | 0;
  STATLIST_SetUnitStat113c(m, pUnit, 8, nNewMana, 0);
  STATLIST_SetUnitStat113c(m, pUnit, 9, nNewMana, 0);
  return 1;
}

/**
 * @va D2Game.dll@0x6fc89770
 * Enirhs shrine effect: reverses player name in-place and copies up to 16 bytes (D2Game:0x6FC89770).
 */
export function SHRINES_ApplyEnirhsReversePlayerName_6FC89770_113c(
  m: Memory113c,
  pObjOperate: number,
  _pShrinesTxt = 0,
): void {
  hitD2GameVa113c(0x6FC89770);
  const pPlayer = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0;
  if (pPlayerData === 0) {
    return;
  }
  let len = 0;
  while (m.u8((pPlayerData + len) >>> 0) !== 0) {
    len = (len + 1) | 0;
  }
  let left = 0;
  let right = (len - 1) | 0;
  while (left < right) {
    const a = m.u8((pPlayerData + left) >>> 0);
    const b = m.u8((pPlayerData + right) >>> 0);
    m.setU8((pPlayerData + left) >>> 0, b);
    m.setU8((pPlayerData + right) >>> 0, a);
    left = (left + 1) | 0;
    right = (right - 1) | 0;
  }
  let nulSeen = false;
  for (let i = 0; i < 0x10; i = (i + 1) | 0) {
    const addr = (pPlayerData + i) >>> 0;
    if (nulSeen) {
      m.setU8(addr, 0);
    } else if (m.u8(addr) === 0) {
      nulSeen = true;
    }
  }
}

/**
 * @va D2Game.dll@0x6fc897a0
 * Shrine mana exchange effect: drains percentage of current mana and converts to life (D2Game:0x6FC897A0).
 */
export function SHRINES_ApplyManaExchangeEffect_6FC897A0_113c(
  m: Memory113c,
  pObjOperate: number,
  pShrinesTxt: number,
): void {
  hitD2GameVa113c(0x6FC897A0);
  const pUnit0 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  const nCurMana = STATLIST_GetUnitStat113c(m, pUnit0, 8, 0) | 0;
  const nArg0 = m.u32((pShrinesTxt + 0x04) >>> 0) | 0;
  const uProd0 = imul32(nArg0, nCurMana) >>> 0;
  const uManaDrain = Number((BigInt(uProd0) * 0x51eb851fn) >> 37n) >>> 0;
  const pUnit1 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  STATLIST_AddUnitStatMemPort113c(m, pUnit1, 8, (-uManaDrain) | 0, 0);
  const nArg1 = m.u32((pShrinesTxt + 0x08) >>> 0) | 0;
  const uProd1 = imul32(nArg1, uManaDrain | 0) >>> 0;
  const uLifeGain = Number((BigInt(uProd1) * 0x51eb851fn) >> 37n) >>> 0;
  const pUnit2 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  STATLIST_AddUnitStatMemPort113c(m, pUnit2, 6, uLifeGain | 0, 0);
}

/**
 * @va D2Game.dll@0x6fc89800
 * Shrine health exchange effect: drains percentage of current life and converts to mana (D2Game:0x6FC89800).
 */
export function SHRINES_ApplyHealthExchangeEffect_6FC89800_113c(
  m: Memory113c,
  pObjOperate: number,
  pShrinesTxt: number,
): void {
  hitD2GameVa113c(0x6FC89800);
  const pUnit0 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  const nCurLifeWhole = (STATLIST_GetUnitStat113c(m, pUnit0, 6, 0) | 0) >> 8;
  const nArg0 = m.u32((pShrinesTxt + 0x04) >>> 0) | 0;
  const uProd0 = imul32(nArg0, nCurLifeWhole) >>> 0;
  const uLifeDrainFixed8 = (Number((BigInt(uProd0) * 0x51eb851fn) >> 37n) << 8) >>> 0;
  const pUnit1 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  STATLIST_AddUnitStatMemPort113c(m, pUnit1, 6, (-uLifeDrainFixed8) | 0, 0);
  const nArg1 = m.u32((pShrinesTxt + 0x08) >>> 0) | 0;
  const uProd1 = imul32(nArg1, uLifeDrainFixed8 | 0) >>> 0;
  const uManaGain = Number((BigInt(uProd1) * 0x51eb851fn) >> 37n) >>> 0;
  const pUnit2 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  STATLIST_AddUnitStatMemPort113c(m, pUnit2, 8, uManaGain | 0, 0);
}

/**
 * @va D2Game.dll@0x6fc89860
 * Shrine mana recharge effect: restores unit mana (stat 8) to max mana (D2Game:0x6FC89860).
 */
export function SHRINES_ApplyManaRechargeEffect_6FC89860_113c(
  m: Memory113c,
  pObjOperate: number,
): void {
  hitD2GameVa113c(0x6FC89860);
  const pUnit0 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  const nCurMana = STATLIST_GetUnitStat113c(m, pUnit0, 8, 0) | 0;
  const pUnit1 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  const nMaxMana = STATLIST_GetMaxManaFromUnit113c(m, pUnit1) | 0;
  const nDiff = (nMaxMana - nCurMana) | 0;
  if (nDiff !== 0) {
    const pUnit2 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
    STATLIST_AddUnitStatMemPort113c(m, pUnit2, 8, nDiff, 0);
  }
}

/**
 * @va D2Game.dll@0x6fc898a0
 * Shrine health recharge effect: restores unit life (stat 6) to max life (D2Game:0x6FC898A0).
 */
export function SHRINES_ApplyHealthRechargeEffect_6FC898A0_113c(
  m: Memory113c,
  pObjOperate: number,
): void {
  hitD2GameVa113c(0x6FC898A0);
  const pUnit0 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  const nCurLife = STATLIST_GetUnitStat113c(m, pUnit0, 6, 0) | 0;
  const pUnit1 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
  const nMaxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit1) | 0;
  const nDiff = (nMaxLife - nCurLife) | 0;
  if (nDiff !== 0) {
    const pUnit2 = m.u32((pObjOperate + 0x08) >>> 0) >>> 0;
    STATLIST_AddUnitStatMemPort113c(m, pUnit2, 6, nDiff, 0);
  }
}

/**
 * @va D2Game.dll@0x6fc898e0
 * Checks whether unit inventory contains any item matching nItemType (D2Game:0x6FC898E0).
 */
export function OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c(
  m: Memory113c,
  pUnit: number,
  nItemType: number,
): number {
  hitD2GameVa113c(0x6FC898E0);
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0;
  if (pInventory === 0) {
    throw new D2CommonAssertError('OBJECTS_HasItemOfTypeInInventory_6FC898E0_113c', 0x6d3);
  }
  let pItem = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0;
  while (pItem !== 0) {
    const pCheckedItem = INVENTORY_UnitIsItem113c(m, pItem) >>> 0;
    if (ITEMS_CheckItemTypeIdMemPort113c(m, pCheckedItem, nItemType | 0) !== 0) {
      return 1;
    }
    pItem = INVENTORY_GetNextItem113c(m, pItem) >>> 0;
  }
  return 0;
}

/**
 * @va D2Game.dll@0x6fc89940
 * Returns 0 if monster class 0xEA (Flying Scimitar) is spawned in Act 1, otherwise 1 (D2Game:0x6FC89940).
 */
export function OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c(
  m: Memory113c,
  pRoom: number,
  nMonsterClassId: number,
): number {
  hitD2GameVa113c(0x6FC89940);
  if ((nMonsterClassId | 0) !== 0xea) {
    return 1;
  }
  if ((pRoom >>> 0) === 0) {
    return 1;
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0;
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) === 0) {
    return 0;
  }
  return 1;
}

/**
 * @va D2Game.dll@0x6fc89a80
 * Object operate handler: toggles object mode between 0 and 1/2, clearing flag 0x02 when opening (D2Game:0x6FC89A80).
 */
export function OBJECTS_OperateToggleObjectMode012_6FC89A80_113c(
  m: Memory113c,
  pObjOperate: number,
): number {
  hitD2GameVa113c(0x6FC89A80);
  const pObject = m.u32((pObjOperate + 0x04) >>> 0) >>> 0;
  if (pObject === 0 || (m.u32((pObject + 0x10) >>> 0) >>> 0) === 0) {
    UNITS_ChangeAnimMode113c(m, pObject, 1);
    const pObjectAfter = m.u32((pObjOperate + 0x04) >>> 0) >>> 0;
    if (pObjectAfter !== 0) {
      m.setU32(
        (pObjectAfter + 0xc4) >>> 0,
        (m.u32((pObjectAfter + 0xc4) >>> 0) & 0xfffffffd) >>> 0,
      );
    }
    return 1;
  }
  const dwMode = m.u32((pObject + 0x10) >>> 0) >>> 0;
  if (dwMode <= 2) {
    UNITS_ChangeAnimMode113c(m, pObject, 0);
    return 1;
  }
  return 1;
}
