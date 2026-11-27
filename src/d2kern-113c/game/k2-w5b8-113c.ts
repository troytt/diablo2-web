/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 5 Batch 8 (`w5b8`) routines across
 * `0x6FD03050..0x6FD06B90` (45 Act 3 quest state, dialog, object, and reward handlers).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c, ITEMS_GetBaseCode113c } from '../common/items.ts'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import type { Memory113c as D2KernMemory113c } from '../mem/sparse-memory.ts'
import { D2GAME_PARTY_GetPartyIdForUnit113c } from './boot-init-gap-b-113c.ts'
import {
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_GuidListAdd113c,
  QUESTS_HasPlayerGuidInQuest113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
} from './k2-items-tc-w1-113c.ts'
import { PLAYER_GetQuestRecordForDifficulty_6FC21020_113c } from './k2-laneH-0x6fc2-w1-113c.ts'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  ACT3Q4_SyncTomePartyQuestStateCallback113c,
  ACT3Q5_CompleteCouncilPartyCallback113c,
  ACT3Q5_IsCompellingOrbIntact113c,
  ACT3Q7_SendQuestUpdatePacket5D_113c,
} from './k2-sunit-spawn-w1-113c.ts'
import {
  QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c,
  QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c,
} from './k2-w2b2-113c.ts'
import { QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c } from './k2-w3b3-113c.ts'
import { PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c } from './k2-w4b5-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import { EVENT_SetEventFull113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

const DIALOG_STATE_MAP_6FD20520: readonly number[] = [0xffffffff, 0, 1, 2, 3, 4]
const DIALOG_STATE_MAP_6FD21550: readonly number[] = [0xffffffff, 0, 1, 2, 3, 4]
const DIALOG_STATE_MAP_6FD22270: readonly number[] = [0xffffffff, 0, 1, 2, 3, 4, 5, 6]
const DIALOG_STATE_MAP_6FD228B0: readonly number[] = [0xffffffff, 0, 1, 2, 3, 4, 5, 6]

function readDialogStateMapDword113c(
  m: D2KernMemory113c,
  baseVa: number,
  defaults: readonly number[],
  idx: number,
): number {
  let needsSeed = false
  try {
    needsSeed = m.u32(baseVa >>> 0) === 0 && m.u32((baseVa + 8) >>> 0) === 0
  } catch {
    needsSeed = true
  }
  if (needsSeed) {
    for (let i = 0; i < defaults.length; i = (i + 1) | 0) {
      m.setU32((baseVa + i * 4) >>> 0, defaults[i]! >>> 0)
    }
  }
  return m.u32((baseVa + idx * 4) >>> 0) >>> 0
}

function findQuestNodeInGame113c(m: D2KernMemory113c, pGame: number, nQuestNo: number): number {
  if (pGame === 0) return 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  const target = nQuestNo >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) >>> 0) === target) return pQuest
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

function setGameQuestHistoryStateOrAssert113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nQuest: number,
  nState: number,
): void {
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError('', 0x820)
  }
  const pGameQuestFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, pGameQuestFlags, nQuest, nState)
}

/**
 * [1/45] Syncs game quest `0x20` state `0x0D` and clears `pQuestDataEx->bByte01` when the
 * entering player already has quest `0x20` state `0` set.
 *
 * @va D2Game:0x6FD03050
 */
export function ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03050)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x20, 0) === 1) {
    setGameQuestHistoryStateOrAssert113c(m, pQuestData, 0x20, 0x0d)
    const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    m.setU8((pQuestEx + 0x01) >>> 0, 0)
  }
}

/**
 * [2/45] Updates Act 3 Mephisto (`0x16`) quest progress bytes (`+0x0B`, `+0x0C`) or marks
 * game quest `0x16` state `0x0D` (`pQuestEx->dwPortalMode = 2`) from player quest flags.
 *
 * @va D2Game:0x6FD03120
 */
export function ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03120)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0b) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x17, 0) === 1
  ) {
    setGameQuestHistoryStateOrAssert113c(m, pQuestData, 0x16, 0x0d)
    const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    m.setU32((pQuestEx + 0x0c) >>> 0, 2)
    return
  }
  const q = pQuestData >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 9) === 1) {
    m.setU8((q + 0x0c) >>> 0, 5)
    m.setU8((q + 0x0b) >>> 0, 4)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 8) === 1) {
    m.setU8((q + 0x0c) >>> 0, 5)
    m.setU8((q + 0x0b) >>> 0, 3)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 7) === 1) {
    m.setU8((q + 0x0c) >>> 0, 5)
    m.setU8((q + 0x0b) >>> 0, 2)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 6) === 1) {
    m.setU8((q + 0x0c) >>> 0, 4)
    m.setU8((q + 0x0b) >>> 0, 4)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 5) === 1) {
    m.setU8((q + 0x0c) >>> 0, 4)
    m.setU8((q + 0x0b) >>> 0, 3)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 4) === 1) {
    m.setU8((q + 0x0c) >>> 0, 4)
    m.setU8((q + 0x0b) >>> 0, 2)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 3) === 1) {
    m.setU8((q + 0x0c) >>> 0, 2)
    m.setU8((q + 0x0b) >>> 0, 2)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 2) === 1) {
    m.setU8((q + 0x0c) >>> 0, 3)
    m.setU8((q + 0x0b) >>> 0, 2)
  }
}

/**
 * [3/45] Object init handler for Act 3 Mephisto portal/bridge (`ecx = pObjInit`):
 * sets mode `2` in level `0x68`, or binds `pObject->dwUnitId` into quest `0x14` and applies `pQuestEx->dwPortalMode`.
 *
 * @va D2Game:0x6FD03290
 */
export function ACT3Q7_InitMephistoPortalObject_6FD03290_113c(
  m: D2KernMemory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FD03290)
  const pGame = m.u32(pObjInit >>> 0) >>> 0
  const pQuest14 = findQuestNodeInGame113c(m, pGame, 0x14)
  const pRoom = m.u32((pObjInit + 0x08) >>> 0) >>> 0
  if (DUNGEON_GetLevelIdFromRoom113c(m, pRoom) === 0x68) {
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInit + 0x04) >>> 0) >>> 0, 2)
    return
  }
  if (pQuest14 !== 0) {
    const pQuestEx = m.u32((pQuest14 + 0x18) >>> 0) >>> 0
    m.setU8((pQuestEx + 0x01) >>> 0, 1)
    const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0
    const dwObjGuid = pObject === 0 ? 0xffffffff : m.u32((pObject + 0x0c) >>> 0) >>> 0
    m.setU32((pQuestEx + 0x04) >>> 0, dwObjGuid)
    const nMode = m.u32((pQuestEx + 0x0c) >>> 0) | 0
    UNITS_ChangeAnimMode113c(m, m.u32((pObjInit + 0x04) >>> 0) >>> 0, nMode)
  }
}

/**
 * [4/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x4`): triggers overlay/message `0x42`
 * and `UNITFLAG_UPDATING` (`0x400`) when quest `0x16` state `0x0D` is set.
 *
 * @va D2Game:0x6FD03320
 */
export function ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD03320)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0d) !== 0) {
    const u = pPlayer >>> 0
    if (u === 0) throw new D2CommonAssertError('', 0x558)
    m.setU16((u + 0x6e) >>> 0, 0x42)
    m.setU32((u + 0x70) >>> 0, u)
    UNITROOM_RefreshUnit113c(m, u)
    m.setU32((u + 0xc4) >>> 0, (m.u32((u + 0xc4) >>> 0) | 0x400) >>> 0)
  }
  return 0
}

/**
 * [5/45] Populates NPC dialog text nodes for Act 3 Mephisto (`0x16`) based on player quest bits,
 * quest participant GUID list (`+0x1C`, count `+0x9C`), and `0x6FD228B0` state-to-message table.
 *
 * @va D2Game:0x6FD033A0
 */
export function ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD033A0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bDone0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0)
  const bState0D = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0d)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc === 0 ? 0xffffffff : m.u32((pNpc + 0x04) >>> 0) >>> 0
  const nQuestId = m.u32((pQuestData + 0xe0) >>> 0) | 0
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 0x0b) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 5, pTextHeader, nNpcClassId)
    return
  }
  if (bDone0 === 1) {
    const pPlr2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    const dwPlrGuid = pPlr2 === 0 ? 0xffffffff : m.u32((pPlr2 + 0x0c) >>> 0) >>> 0
    const nGuidCount = m.u16((pQuestData + 0x9c) >>> 0)
    for (let i = 0; i < nGuidCount; i = (i + 1) | 0) {
      if (m.u32((pQuestData + 0x1c + i * 4) >>> 0) === dwPlrGuid) {
        QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 6, pTextHeader, nNpcClassId)
        return
      }
    }
    return
  }
  const bState = m.u8((pQuestData + 0x0c) >>> 0)
  if (bState >= 6) {
    if (bState0D === 1) {
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 6, pTextHeader, nNpcClassId)
    }
    return
  }
  const nMsgIdx = readDialogStateMapDword113c(m, 0x6fd228b0, DIALOG_STATE_MAP_6FD228B0, bState)
  if (nMsgIdx !== 0xffffffff && nMsgIdx < 8) {
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, nMsgIdx | 0, pTextHeader, nNpcClassId)
  }
}

/**
 * [6/45] Marks Act 3 Mephisto quest `0x16` states `0x0D`, `0`, `0x0B` (`eax = pQuestFlags`,
 * `ecx = pPlayer`, `[esp+4] = pGame`) and advances `pClient->wCharStatus` progression to Act 3 clear.
 *
 * @va D2Game:0x6FD034D0
 */
export function ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c(
  m: D2KernMemory113c,
  pQuestFlags: number,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD034D0)
  const qf = pQuestFlags >>> 0
  QUESTRECORD_SetQuestState113c(m, qf, 0x16, 0x0d)
  QUESTRECORD_SetQuestState113c(m, qf, 0x16, 0)
  QUESTRECORD_SetQuestState113c(m, qf, 0x16, 0x0b)
  let pClient = 0
  const u = pPlayer >>> 0
  if (u !== 0 && m.u32(u) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, u) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const wStatus = m.u16((pClient + 0x0a) >>> 0)
  const nActsPerDiff = ((wStatus & 0x20) | 0x80) >>> 5
  const nTargetProg = (Math.imul(nActsPerDiff, nDiff) + 3) | 0
  const nCurProg = (wStatus >>> 8) & 0x1f
  if (nTargetProg >= nCurProg) {
    const nNewBits = ((Math.imul(nActsPerDiff, nDiff) + 3) << 8) & 0xffff
    const wMasked = m.u16((pClient + 0x0a) >>> 0) & 0xe0ff
    m.setU16((pClient + 0x0a) >>> 0, (nNewBits | wMasked) & 0xffff)
  }
}

/**
 * [7/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x4`): propagates active quest node
 * `0x14` (`+0x0B`, `+0x0C`) into player quest `0x16` state bits `2..9`.
 *
 * @va D2Game:0x6FD03560
 */
export function ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD03560)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0b) === 1) return 0
  const pQuest14 = findQuestNodeInGame113c(m, pGame, 0x14)
  if (pQuest14 === 0) return 0
  const bState = m.u8((pQuest14 + 0x0c) >>> 0)
  const idx = (bState - 2) >>> 0
  if (idx > 3) return 0
  if (idx === 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 2)
    return 0
  }
  if (idx === 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 3)
    return 0
  }
  const bSub = m.u8((pQuest14 + 0x0b) >>> 0)
  if (idx === 2) {
    if (bSub === 2) QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 4)
    else if (bSub === 3) QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 5)
    else if (bSub === 4) QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 6)
    return 0
  }
  if (bSub === 2) QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 7)
  else if (bSub === 3) QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 8)
  else if (bSub === 4) QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 9)
  return 0
}

/**
 * [8/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x4`): counts Act 3 players
 * missing Khalim's Flail/Will (`'qf1 '`/`'qf2 '`, `+0x3C`) or Horadric Cube (`'box '`, `+0x40`) on quest `0x13`.
 *
 * @va D2Game:0x6FD036A0
 */
export function ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD036A0)
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pRoom === 0) return 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  if (nLevelId === 0) return 0
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 2) return 0
  const pQuest13 = findQuestNodeInGame113c(m, pGame, 0x13)
  if (pQuest13 === 0) return 0
  const pQuestEx = m.u32((pQuest13 + 0x18) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) === 0) {
    if (
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20316671) === 0 &&
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20326671) === 0
    ) {
      m.setU32((pQuestEx + 0x3c) >>> 0, (m.u32((pQuestEx + 0x3c) >>> 0) + 1) >>> 0)
    }
  }
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20786f62) === 0) {
    m.setU32((pQuestEx + 0x40) >>> 0, (m.u32((pQuestEx + 0x40) >>> 0) + 1) >>> 0)
  }
  return 0
}

/**
 * [9/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x4`): triggers overlay/message `0x40`
 * and `UNITFLAG_UPDATING` (`0x400`) when quest `0x15` state `0x0D` is set.
 *
 * @va D2Game:0x6FD03760
 */
export function ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD03760)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0d) !== 0) {
    const u = pPlayer >>> 0
    if (u === 0) throw new D2CommonAssertError('', 0x558)
    m.setU16((u + 0x6e) >>> 0, 0x40)
    m.setU32((u + 0x70) >>> 0, u)
    UNITROOM_RefreshUnit113c(m, u)
    m.setU32((u + 0xc4) >>> 0, (m.u32((u + 0xc4) >>> 0) | 0x400) >>> 0)
  }
  return 0
}

/**
 * [10/45] Syncs Act 3 Travincal (`0x15`) quest state (`+0x09`, `+0x0B`, `+0x0C`) and `pQuestEx`
 * flags (`+0x08`, `+0x0C`) from entering player quest record bits (`0x11`, `0x12`, `0x15`).
 *
 * @va D2Game:0x6FD03850
 */
export function ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03850)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const q = pQuestData >>> 0
  const pQuestEx = m.u32((q + 0x18) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) !== 0) {
    m.setU8((pQuestEx + 0x0c) >>> 0, 1)
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4) === 1
  ) {
    setGameQuestHistoryStateOrAssert113c(m, q, 0x15, 0x0d)
    m.setU8((q + 0x09) >>> 0, 0)
    return
  }
  const bQ11Done = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0) >>> 0
  m.setU32((pQuestEx + 0x08) >>> 0, bQ11Done)
  const bBit2 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 2)
  const bBit3 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 3)
  if (bBit2 !== 0) {
    const dwSavedQ11 = m.u32((pQuestEx + 0x08) >>> 0)
    if (bBit3 !== 0) {
      m.setU8((q + 0x0b) >>> 0, 3)
      m.setU8((q + 0x0c) >>> 0, dwSavedQ11 !== 0 ? 4 : 5)
      return
    }
    m.setU8((q + 0x0b) >>> 0, 2)
    m.setU8((q + 0x0c) >>> 0, dwSavedQ11 !== 0 ? 2 : 3)
    return
  }
  if (bBit3 !== 0) {
    const dwSavedQ11 = m.u32((pQuestEx + 0x08) >>> 0)
    m.setU8((q + 0x0b) >>> 0, 3)
    m.setU8((q + 0x0c) >>> 0, dwSavedQ11 !== 0 ? 4 : 5)
  }
}

/**
 * [11/45] Populates NPC dialog text nodes for Act 3 Travincal (`0x15`) using quest flags,
 * participant GUID list, `pQuestData->bActive` (`+0x09`), and `0x6FD22270` state map.
 *
 * @va D2Game:0x6FD03970
 */
export function ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03970)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bDone0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0)
  const bState0D = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0d)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc === 0 ? 0xffffffff : m.u32((pNpc + 0x04) >>> 0) >>> 0
  const nQuestId = m.u32((pQuestData + 0xe0) >>> 0) | 0
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId, 4) !== 0) {
    const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    if (m.u8((pQuestEx + 0x0c) >>> 0) !== 0) return
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 5, pTextHeader, nNpcClassId)
    return
  }
  if (bDone0 === 1) {
    const pPlr2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    const dwPlrGuid = pPlr2 === 0 ? 0xffffffff : m.u32((pPlr2 + 0x0c) >>> 0) >>> 0
    const nGuidCount = m.u16((pQuestData + 0x9c) >>> 0)
    let found = false
    for (let i = 0; i < nGuidCount; i = (i + 1) | 0) {
      if (m.u32((pQuestData + 0x1c + i * 4) >>> 0) === dwPlrGuid) {
        found = true
        break
      }
    }
    if (!found) return
  }
  const bState = m.u8((pQuestData + 0x0c) >>> 0)
  if (bState >= 6) {
    if (bState0D !== 1) return
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 6, pTextHeader, nNpcClassId)
    return
  }
  if (m.u8((pQuestData + 0x09) >>> 0) === 0) return
  const nMsgIdx = readDialogStateMapDword113c(m, 0x6fd22270, DIALOG_STATE_MAP_6FD22270, bState)
  if (nMsgIdx !== 0xffffffff && nMsgIdx < 8) {
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, nMsgIdx | 0, pTextHeader, nNpcClassId)
  }
}

/**
 * [12/45] Syncs Act 3 Golden Bird (`0x14`) quest state bytes (`+0x09`, `+0x0B`, `+0x0C`) and
 * `pQuestEx` flags (`+0x01`, `+0x0C`) from player quest bits and `'g34 '`/`'j34 '` items.
 *
 * @va D2Game:0x6FD03B40
 */
export function ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03B40)
  const q = pQuestData >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const pQuestEx = m.u32((q + 0x18) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) !== 0
  ) {
    m.setU8((q + 0x09) >>> 0, 0)
    m.setU8((pQuestEx + 0x01) >>> 0, 0)
    m.setU8((pQuestEx + 0x0c) >>> 0, 0)
    return
  }
  const pBird = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x20343367,
  )
  const pJade = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x2034336a,
  )
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) !== 0) {
    m.setU8((q + 0x09) >>> 0, 0)
    m.setU8((pQuestEx + 0x01) >>> 0, 0)
    m.setU8((pQuestEx + 0x0c) >>> 0, 0)
    return
  }
  if (pBird !== 0) {
    m.setU8((pQuestEx + 0x01) >>> 0, 0)
    m.setU8((pQuestEx + 0x0c) >>> 0, 0)
    const bBit4 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 4)
    m.setU8((q + 0x0c) >>> 0, 3)
    m.setU8((q + 0x0b) >>> 0, bBit4 !== 0 ? 4 : 3)
    return
  }
  if (pJade !== 0) {
    m.setU8((pQuestEx + 0x01) >>> 0, 0)
    m.setU8((pQuestEx + 0x0c) >>> 0, 0)
    const bBit2 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 2)
    const v = bBit2 !== 0 ? 2 : 1
    m.setU8((q + 0x0c) >>> 0, v)
    m.setU8((q + 0x0b) >>> 0, v)
  }
}

/**
 * [13/45] Quest log status filter (`pfStatusFilter`, `ret 0x0C`) for Act 3 Golden Bird (`0x14`):
 * writes status byte into `*pOutStatus` and returns `1`.
 *
 * @va D2Game:0x6FD03CE0
 */
export function ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pPlayer: number,
  _pGlobalFlags: number,
  pQuestFlags: number,
  pOutStatus: number,
): number {
  hitD2GameVa113c(0x6FD03CE0)
  const out = pOutStatus >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0f, 0) === 0) {
    m.setU8(out, 0)
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) !== 0) {
    m.setU8(out, 5)
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0) !== 0) {
    const bState0D = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0x0d)
    m.setU8(out, bState0D !== 0 ? 0x0d : 0x0b)
    return 1
  }
  m.setU8(out, 0)
  const q = pQuestData >>> 0
  const pBird = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    pPlayer,
    m.u32((q + 0x04) >>> 0) >>> 0,
    0x20343367,
  )
  const pJade = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    pPlayer,
    m.u32((q + 0x04) >>> 0) >>> 0,
    0x2034336a,
  )
  if (pBird !== 0) {
    const bBit4 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 4)
    m.setU8(out, bBit4 !== 0 ? 4 : 3)
    return 1
  }
  if (pJade !== 0) {
    const bBit2 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 2)
    m.setU8(out, bBit2 !== 0 ? 2 : 1)
    return 1
  }
  if (m.u8((q + 0x09) >>> 0) !== 0) {
    let bStatus = m.u8((q + 0x0b) >>> 0)
    if (bStatus >= 6) {
      const pGame = m.u32((q + 0x04) >>> 0) >>> 0
      bStatus = m.u8((pGame + 0x6a) >>> 0) !== 3 ? 7 : 6
    }
    m.setU8(out, bStatus)
  }
  return 1
}

/**
 * [14/45] Populates NPC dialog text nodes for Act 3 Golden Bird (`0x14`) across Alkor (`0xFE`),
 * Cain (`0xF5`), Asheara (`0xFC`), and other Kurast NPCs.
 *
 * @va D2Game:0x6FD03E30
 */
export function ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD03E30)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bDone0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc === 0 ? 0xffffffff : m.u32((pNpc + 0x04) >>> 0) >>> 0
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0
  if (bDone0 === 1) {
    const pPlr2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    const dwPlrGuid = pPlr2 === 0 ? 0xffffffff : m.u32((pPlr2 + 0x0c) >>> 0) >>> 0
    const nGuidCount = m.u16((pQuestData + 0x9c) >>> 0)
    for (let i = 0; i < nGuidCount; i = (i + 1) | 0) {
      if (m.u32((pQuestData + 0x1c + i * 4) >>> 0) === dwPlrGuid) {
        QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 6, pTextHeader, nNpcClassId)
        return
      }
    }
    return
  }
  if (nNpcClassId === 0xfe) {
    const pQuestEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
    if (m.u8(pQuestEx) === 1) return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 5, pTextHeader, nNpcClassId)
    return
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32(pQuestArg >>> 0) >>> 0,
      0x20343367,
    ) !== 0
  ) {
    if (nNpcClassId === 0xf5) {
      const nMsg = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 4) === 0 ? 3 : 2
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, nMsg, pTextHeader, nNpcClassId)
      return
    }
    if (nNpcClassId === 0xfe) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) !== 0) return
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0) !== 0) return
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 2, pTextHeader, nNpcClassId)
      return
    }
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 2, pTextHeader, nNpcClassId)
    return
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32(pQuestArg >>> 0) >>> 0,
      0x2034336a,
    ) !== 0
  ) {
    const bBit2 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 2)
    if (bBit2 === 0) {
      const nMsg = nNpcClassId === 0xf5 || nNpcClassId === 0xfc ? 0 : 1
      QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, nMsg, pTextHeader, nNpcClassId)
      return
    }
    const nMsg = nNpcClassId === 0xf5 || nNpcClassId === 0xfc ? 7 : 1
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, nMsg, pTextHeader, nNpcClassId)
  }
}

/**
 * [15/45] NPC quest-attention filter (`pfActiveFilter`, `ret 0x0C`) for Act 3 Golden Bird (`0x14`):
 * checks Alkor (`0xFE`), Meshif (`0x108`), and Cain (`0xF5`) active exclamation prompt conditions.
 *
 * @va D2Game:0x6FD04030
 */
export function ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcClassId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpc: number = 0,
): number {
  hitD2GameVa113c(0x6FD04030)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) !== 0) return 0
  const q = pQuestData >>> 0
  const npcId = nNpcClassId >>> 0
  if (npcId === 0xfe) {
    if (
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
        m,
        pPlayer,
        m.u32((q + 0x04) >>> 0) >>> 0,
        0x20343367,
      ) !== 0
    ) {
      return 1
    }
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 1) !== 0) return 1
    return 0
  }
  if (npcId === 0x108) {
    return ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x2034336a,
    ) !== 0
      ? 1
      : 0
  }
  if (npcId === 0xf5) {
    if (
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
        m,
        pPlayer,
        m.u32((q + 0x04) >>> 0) >>> 0,
        0x2034336a,
      ) !== 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 2) === 0
    ) {
      return 1
    }
    if (
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
        m,
        pPlayer,
        m.u32((q + 0x04) >>> 0) >>> 0,
        0x20343367,
      ) !== 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 4) === 0
    ) {
      return 1
    }
  }
  return 0
}

/**
 * [16/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): sets quest `0x13` state `6`
 * for Act 3 players when quest node `0x11` is active and states `0`, `6`, `8`, `7` are all clear.
 *
 * @va D2Game:0x6FD041D0
 */
export function ACT3Q2_SetGidbinnTurnInPartyCallback_6FD041D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): void {
  hitD2GameVa113c(0x6FD041D0)
  if (findQuestNodeInGame113c(m, pGame, 0x11) === 0) return
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) !== 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6) !== 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8) !== 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7) !== 0) return
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 2) return
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 6)
}

/**
 * [17/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): sets quest `0x13` state `0x0E`
 * if states `0`, `6`, `8`, `7` are all clear and the player does not carry `'g33 '`.
 *
 * @va D2Game:0x6FD04280
 */
export function ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD04280)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7) !== 0) return 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20333367) !== 0) return 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 0x0e)
  return 0
}

/**
 * [18/45] Populates NPC dialog text nodes for Act 3 Blade of the Old Religion (`0x13`, `'g33 '`)
 * across Asheara (`0xFC`), Ormus (`0xFF`), and `0x6FD21550` state map.
 *
 * @va D2Game:0x6FD042F0
 */
export function ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD042F0)
  const q = pQuestData >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bDone0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc === 0 ? 0xffffffff : m.u32((pNpc + 0x04) >>> 0) >>> 0
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0
  const pPlr2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  if (bDone0 === 1) {
    const dwPlrGuid = pPlr2 === 0 ? 0xffffffff : m.u32((pPlr2 + 0x0c) >>> 0) >>> 0
    const nGuidCount = m.u16((q + 0x9c) >>> 0)
    for (let i = 0; i < nGuidCount; i = (i + 1) | 0) {
      if (m.u32((q + 0x1c + i * 4) >>> 0) === dwPlrGuid) {
        QUESTS_AddNpcDialogTextNodes113c(m, q, 4, pTextHeader, nNpcClassId)
        return
      }
    }
    return
  }
  const pGidbinn = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    pPlr2,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x20333367,
  )
  if (pGidbinn !== 0) {
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 5) !== 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8) === 0
    ) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 3, pTextHeader, nNpcClassId)
      return
    }
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6) !== 0) {
    const bNotBit8 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8) === 0
    const bNotBit7 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7) === 0
    if (nNpcClassId === 0xfc) {
      if (bNotBit7) {
        QUESTS_AddNpcDialogTextNodes113c(m, q, 5, pTextHeader, nNpcClassId)
        return
      }
      if (bNotBit8) {
        QUESTS_AddNpcDialogTextNodes113c(m, q, 6, pTextHeader, nNpcClassId)
      }
      return
    }
    if (nNpcClassId === 0xff && bNotBit8) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 6, pTextHeader, nNpcClassId)
      return
    }
    if (bNotBit7) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 5, pTextHeader, nNpcClassId)
      return
    }
    if (bNotBit8) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 6, pTextHeader, nNpcClassId)
    }
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 5) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, q, 4, pTextHeader, nNpcClassId)
    return
  }
  const bState = m.u8((q + 0x0c) >>> 0)
  if (bState < 4 && pGidbinn === 0) {
    const nMsgIdx = readDialogStateMapDword113c(m, 0x6fd21550, DIALOG_STATE_MAP_6FD21550, bState)
    if (nMsgIdx !== 0xffffffff && nMsgIdx < 8) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, nMsgIdx | 0, pTextHeader, nNpcClassId)
    }
  }
}

/**
 * [19/45] NPC quest-attention filter (`pfActiveFilter`, `ret 0x0C`) for Act 3 Gidbinn (`0x13`):
 * checks Hratli (`0xFD`), Ormus (`0xFF`), and Asheara (`0xFC`) prompt conditions.
 *
 * @va D2Game:0x6FD04500
 */
export function ACT3Q2_GidbinnActiveFilter_6FD04500_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcClassId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpc: number = 0,
): number {
  hitD2GameVa113c(0x6FD04500)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) !== 0) return 0
  const q = pQuestData >>> 0
  const npcId = nNpcClassId >>> 0
  if (npcId === 0xfd) {
    if (
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
        m,
        pPlayer,
        m.u32((q + 0x04) >>> 0) >>> 0,
        0x20333367,
      ) !== 0
    ) {
      return 0
    }
    return m.u8((q + 0x0c) >>> 0) === 1 ? 1 : 0
  }
  if (npcId === 0xff) {
    if (
      ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
        m,
        pPlayer,
        m.u32((q + 0x04) >>> 0) >>> 0,
        0x20333367,
      ) !== 0
    ) {
      return 1
    }
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6) === 0) return 0
    return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8) === 0 ? 1 : 0
  }
  if (npcId !== 0xfc) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6) === 0) return 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7) === 0 ? 1 : 0
}

/**
 * [20/45] Quest log status filter (`pfStatusFilter`, `ret 0x0C`) for Act 3 Gidbinn (`0x13`):
 * computes and writes `*pOutStatus` from quest `0x0F`/`0x13` bits, `'g33 '` item, and `pQuestEx` state.
 *
 * @va D2Game:0x6FD045B0
 */
export function ACT3Q2_GidbinnStatusFilter_6FD045B0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pPlayer: number,
  _pGlobalFlags: number,
  pQuestFlags: number,
  pOutStatus: number,
): number {
  hitD2GameVa113c(0x6FD045B0)
  const out = pOutStatus >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0f, 0) === 0) {
    m.setU8(out, 0)
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) !== 0) {
    const bState0D = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0x0d)
    m.setU8(out, bState0D !== 0 ? 0x0d : 0x0b)
    return 1
  }
  const q = pQuestData >>> 0
  const pQuestEx = m.u32((q + 0x18) >>> 0) >>> 0
  m.setU8(out, 0)
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20333367,
    ) !== 0
  ) {
    m.setU8(out, 4)
    return 1
  }
  if (m.u8((pQuestEx + 0x20) >>> 0) !== 0) {
    const pGame = m.u32((q + 0x04) >>> 0) >>> 0
    m.setU8(out, m.u8((pGame + 0x6a) >>> 0) === 3 ? 8 : 7)
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6) !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 8) === 0) m.setU8(out, 6)
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7) === 0) m.setU8(out, 5)
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 4) !== 0) {
    m.setU8(out, m.u8(pQuestEx) === 1 ? 3 : 2)
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 3) !== 0) {
    m.setU8(out, 2)
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 2) !== 0) {
    m.setU8(out, 1)
  }
  return 1
}

/**
 * [21/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): syncs quest `0x13` states
 * `5`, `4`, `2`, or `3` from `'g33 '` possession and active quest node `0x11`.
 *
 * @va D2Game:0x6FD046F0
 */
export function ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD046F0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) === 1) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 6) === 1) return 0
  const pQuest11 = findQuestNodeInGame113c(m, pGame, 0x11)
  if (pQuest11 === 0) return 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer, pGame, 0x20333367) !== 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 5)
    return 0
  }
  const pQuestEx = m.u32((pQuest11 + 0x18) >>> 0) >>> 0
  if (m.u8(pQuestEx) !== 0) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 4)
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 3) === 0) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 2)
    }
    return 0
  }
  if (m.u8((pQuest11 + 0x0c) >>> 0) === 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 3)
  }
  return 0
}

/**
 * [22/45] Quest log status filter (`pfStatusFilter`, `ret 0x0C`) for Act 3 Khalim's Will (`0x12`):
 * evaluates `'qf2 '`, `'qf1 '`, `'qey '`, `'qhr '`, `'qbr '`, and Compelling Orb state.
 *
 * @va D2Game:0x6FD04AB0
 */
export function ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pPlayer: number,
  _pGlobalFlags: number,
  pQuestFlags: number,
  pOutStatus: number,
): number {
  hitD2GameVa113c(0x6FD04AB0)
  const out = pOutStatus >>> 0
  const q = pQuestData >>> 0
  m.setU8(out, 0)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0f, 0) === 0) return 1
  const bBit2 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 2)
  if (bBit2 !== 0 || (m.u8((q + 0x09) >>> 0) !== 0 && m.u8((q + 0x0c) >>> 0) >= 2)) {
    m.setU8(out, 1)
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20326671,
    ) !== 0
  ) {
    const bOrb = ACT3Q5_IsCompellingOrbIntact113c(m, m.u32((q + 0x04) >>> 0) >>> 0)
    m.setU8(out, (bOrb & 0xff) !== 0 ? 6 : 0x0c)
    return 1
  }
  let nCount = 0
  const bFlail =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20316671,
    ) !== 0
      ? 1
      : 0
  if (bFlail !== 0) nCount = 1
  const bEye =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20796571,
    ) !== 0
      ? 1
      : 0
  if (bEye !== 0) nCount = (nCount + 1) | 0
  const bHeart =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20726871,
    ) !== 0
      ? 1
      : 0
  if (bHeart !== 0) nCount = (nCount + 1) | 0
  const bBrain =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20726271,
    ) !== 0
      ? 1
      : 0
  if (bBrain !== 0) nCount = (nCount + 1) | 0
  if (nCount === 4) {
    const bBit5 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 5)
    m.setU8(out, bBit5 !== 0 ? 5 : 7)
    return 1
  }
  if (nCount !== 0) {
    if (bEye === 0) {
      m.setU8(out, 1)
      return 1
    }
    if (bBrain === 0) {
      m.setU8(out, 2)
      return 1
    }
    if (bHeart === 0) {
      m.setU8(out, 4)
      return 1
    }
    m.setU8(out, bFlail !== 0 ? 7 : 3)
    return 1
  }
  if (bBit2 !== 0) {
    m.setU8(out, 1)
    return 1
  }
  m.setU8(out, m.u8((q + 0x0c) >>> 0) > 1 ? 1 : 0)
  return 1
}

/**
 * [23/45] Populates Cain (`0xF5`) NPC dialog text nodes for Act 3 Khalim's Will (`0x12`)
 * across `'qf2 '`, `'qf1 '`, `'qey '`, `'qhr '`, `'qbr '`, and Compelling Orb states.
 *
 * @va D2Game:0x6FD04C90
 */
export function ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD04C90)
  const q = pQuestData >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u32((pNpc + 0x04) >>> 0) !== 0xf5) return
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0
  if (m.u8((q + 0x0c) >>> 0) >= 1 && DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 2) === 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, q, 0, pTextHeader, 0xf5)
    return
  }
  let nCount = 0
  let bWill = 0
  let bFlail = 0
  let bHeart = 0
  let bEye = 0
  let bBrain = 0
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20326671,
    ) !== 0
  ) {
    bWill = 1
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 7) === 0 &&
      (ACT3Q5_IsCompellingOrbIntact113c(m, m.u32((q + 0x04) >>> 0) >>> 0) & 0xff) !== 0
    ) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 5, pTextHeader, 0xf5)
      return
    }
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20316671,
    ) !== 0
  ) {
    nCount = 1
    bFlail = 1
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 5) === 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 4, pTextHeader, 0xf5)
      return
    }
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20796571,
    ) !== 0
  ) {
    nCount = (nCount + 1) | 0
    bEye = 1
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 3) === 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 1, pTextHeader, 0xf5)
      return
    }
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20726871,
    ) !== 0
  ) {
    nCount = (nCount + 1) | 0
    bHeart = 1
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 6) === 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 2, pTextHeader, 0xf5)
      return
    }
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20726271,
    ) !== 0
  ) {
    nCount = (nCount + 1) | 0
    bBrain = 1
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 4) === 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 3, pTextHeader, 0xf5)
      return
    }
  }
  if (nCount > 0) {
    const nMsg = bFlail !== 0 ? 0x0a : bHeart !== 0 ? 0x08 : bEye !== 0 ? 0x07 : bBrain !== 0 ? 0x09 : 0x06
    QUESTS_AddNpcDialogTextNodes113c(m, q, nMsg, pTextHeader, 0xf5)
    return
  }
  if (bWill !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, q, 0x0b, pTextHeader, 0xf5)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 2) !== 0) {
    QUESTS_AddNpcDialogTextNodes113c(m, q, 6, pTextHeader, 0xf5)
  }
}

/**
 * [24/45] NPC quest-attention filter (`pfActiveFilter`, `ret 0x0C`) for Act 3 Khalim's Will (`0x12`):
 * checks Cain (`0xF5`) active prompt state for each Khalim relic and Compelling Orb.
 *
 * @va D2Game:0x6FD04F60
 */
export function ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcClassId: number,
  pPlayer: number,
  pQuestFlags: number,
  _pNpc: number = 0,
): number {
  hitD2GameVa113c(0x6FD04F60)
  if ((nNpcClassId >>> 0) !== 0xf5) return 0
  const q = pQuestData >>> 0
  if (m.u8((q + 0x0c) >>> 0) >= 1 && DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 2) === 0) {
    return 1
  }
  let nCount = 0
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20316671,
    ) !== 0
  ) {
    nCount = 1
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 5) === 0) return 1
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20796571,
    ) !== 0
  ) {
    nCount = (nCount + 1) | 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 3) === 0) return 1
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20726871,
    ) !== 0
  ) {
    nCount = (nCount + 1) | 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 6) === 0) return 1
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20726271,
    ) !== 0
  ) {
    nCount = (nCount + 1) | 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 4) === 0) return 1
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      pPlayer,
      m.u32((q + 0x04) >>> 0) >>> 0,
      0x20326671,
    ) !== 0
  ) {
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 7) === 0 &&
      (ACT3Q5_IsCompellingOrbIntact113c(m, m.u32((q + 0x04) >>> 0) >>> 0) & 0xff) !== 0
    ) {
      return 1
    }
  }
  if (nCount === 4 && DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 5) === 0) return 1
  return 0
}

/**
 * [25/45] Syncs Act 3 Lam Esen's Tome (`0x11`, `'bbb '`) quest state and `pQuestEx` GUID list
 * (`+0x1C`) from entering player quest bits and inventory.
 *
 * @va D2Game:0x6FD050C0
 */
export function ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD050C0)
  const q = pQuestData >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0) === 1) {
    setGameQuestHistoryStateOrAssert113c(m, q, 0x11, 0x0d)
    return
  }
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32(pQuestArg >>> 0) >>> 0,
      0x20626262,
    ) !== 0
  ) {
    const pQuestEx = m.u32((q + 0x18) >>> 0) >>> 0
    m.setU8((q + 0x0c) >>> 0, 4)
    m.setU8((q + 0x0b) >>> 0, 2)
    m.setU32((pQuestEx + 0x08) >>> 0, (m.u32((pQuestEx + 0x08) >>> 0) + 1) >>> 0)
    m.setU32((pQuestEx + 0x18) >>> 0, 2)
    m.setU8((pQuestEx + 0x02) >>> 0, 1)
    const pPlr2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pPlr2 === 0 ? 0xffffffff : m.u32((pPlr2 + 0x0c) >>> 0) >>> 0
    QUESTS_GuidListAdd113c(m, (pQuestEx + 0x1c) >>> 0, dwGuid)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 3) === 1) {
    m.setU8((q + 0x0c) >>> 0, 3)
    m.setU8((q + 0x0b) >>> 0, 1)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 2) === 1) {
    m.setU8((q + 0x0c) >>> 0, 2)
    m.setU8((q + 0x0b) >>> 0, 1)
  }
}

/**
 * [26/45] Populates NPC dialog text nodes for Act 3 Lam Esen's Tome (`0x11`, `'bbb '`)
 * using quest bits, `QUESTS_HasPlayerGuidInQuest113c`, and `0x6FD20520` state map.
 *
 * @va D2Game:0x6FD05270
 */
export function ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD05270)
  const q = pQuestData >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bDone0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0)
  const bState0D = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0x0d)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc === 0 ? 0xffffffff : m.u32((pNpc + 0x04) >>> 0) >>> 0
  if (bDone0 === 1 && bState0D === 0) return
  const pTextHeader = m.u32((pQuestArg + 0x14) >>> 0) >>> 0
  if (
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32(pQuestArg >>> 0) >>> 0,
      0x20626262,
    ) !== 0
  ) {
    QUESTS_AddNpcDialogTextNodes113c(m, q, 3, pTextHeader, nNpcClassId)
    return
  }
  if (bDone0 === 1) {
    const pPlr2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pPlr2 === 0 ? 0xffffffff : m.u32((pPlr2 + 0x0c) >>> 0) >>> 0
    if (QUESTS_HasPlayerGuidInQuest113c(m, q, dwGuid) !== 0) {
      QUESTS_AddNpcDialogTextNodes113c(m, q, 4, pTextHeader, nNpcClassId)
    }
    return
  }
  if (m.u8((q + 0x09) >>> 0) === 0) return
  const bState = m.u8((q + 0x0c) >>> 0)
  if (bState >= 4) return
  const nMsgIdx = readDialogStateMapDword113c(m, 0x6fd20520, DIALOG_STATE_MAP_6FD20520, bState)
  if (nMsgIdx !== 0xffffffff && nMsgIdx < 6) {
    QUESTS_AddNpcDialogTextNodes113c(m, q, nMsgIdx | 0, pTextHeader, nNpcClassId)
  }
}

/**
 * [27/45] Syncs game quest `0x10` (Act 3 Hratli intro) state `0x0D` when entering player
 * already has quest `0x10` state `0` set.
 *
 * @va D2Game:0x6FD05450
 */
export function ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD05450)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x10, 0) === 1) {
    setGameQuestHistoryStateOrAssert113c(m, pQuestData, 0x10, 0x0d)
  }
}

/**
 * [28/45] Adds Hratli (`0xFD`) Act 3 intro dialog node (`1` for Sorceress class `1`, `0` otherwise)
 * when player quest `0x10` state `0` is clear.
 *
 * @va D2Game:0x6FD054C0
 */
export function ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD054C0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || m.u32((pNpc + 0x04) >>> 0) !== 0xfd) return
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x10, 0) !== 0) return
  const pPlr2 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const nMsg = pPlr2 !== 0 && m.u32((pPlr2 + 0x04) >>> 0) === 1 ? 1 : 0
  QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, nMsg, m.u32((pQuestArg + 0x14) >>> 0) >>> 0, 0xfd)
}

/**
 * [29/45] Marks player quest `0x10` state `0` and game quest `0x10` state `0x0D` when Hratli (`0xFD`)
 * intro speech `0x1D1` or `0x1D2` completes.
 *
 * @va D2Game:0x6FD05540
 */
export function ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD05540)
  const wNpcId = m.u16((pQuestArg + 0x14) >>> 0)
  const wMsgId = m.u16((pQuestArg + 0x18) >>> 0)
  if (wNpcId !== 0xfd) return
  const q = pQuestData >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32((q + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (wMsgId === 0x1d1 || wMsgId === 0x1d2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x10, 0)
    setGameQuestHistoryStateOrAssert113c(m, q, 0x10, 0x0d)
  }
}

/**
 * [30/45] NPC quest-attention filter (`pfActiveFilter`, `ret 0x0C`) returning `1` when `nNpcClassId`
 * is Cain (`0xF5`) and the player has not yet heard Cain's Kurast intro.
 *
 * @va D2Game:0x6FD055C0
 */
export function ACT3_CainIntroActiveFilter_6FD055C0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  nNpcClassId: number,
  pPlayer: number,
  _pQuestFlags: number = 0,
  _pNpc: number = 0,
): number {
  hitD2GameVa113c(0x6FD055C0)
  if ((nNpcClassId >>> 0) !== 0xf5) return 0
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  return QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, 0xf5, pGame) === 0 ? 1 : 0
}

function lookupGameObjectByGuid113c(
  m: D2KernMemory113c,
  pGame: number,
  dwObjGuid: number,
): number {
  const guid = dwObjGuid >>> 0
  let pObj = m.u32((pGame + (guid & 0x7f) * 4 + 0x1520) >>> 0) >>> 0
  while (pObj !== 0) {
    if (m.u32((pObj + 0x0c) >>> 0) === guid) return pObj
    pObj = m.u32((pObj + 0xe4) >>> 0) >>> 0
  }
  return 0
}

/**
 * [31/45] Adds class-tailored Kurast NPC intro dialog nodes (`1` on matching class, `0` otherwise)
 * for Cain (`0xF5`), Asheara (`0xFC`), Alkor (`0xFE`), Ormus (`0xFF`), Meshif (`0x108`), and Natalya (`0x129`).
 *
 * @va D2Game:0x6FD055F0
 */
export function ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD055F0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  const nNpcId = pNpc === 0 ? 0xffffffff : m.u32((pNpc + 0x04) >>> 0) >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const nPlrClass = pPlayer === 0 ? 0xffffffff : m.u32((pPlayer + 0x04) >>> 0) >>> 0
  let nSpecialClass = 7
  if (nNpcId === 0xf5 || nNpcId === 0x129) {
    nSpecialClass = 7
  } else if (nNpcId === 0xfc) {
    nSpecialClass = 0
  } else if (nNpcId === 0xfe) {
    nSpecialClass = 2
  } else if (nNpcId === 0xff) {
    nSpecialClass = 3
  } else if (nNpcId === 0x108) {
    nSpecialClass = 4
  } else {
    return
  }
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  if (QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, nNpcId, pGame) !== 0) return
  const nMsg = nPlrClass === (nSpecialClass >>> 0) ? 1 : 0
  QUESTS_AddNpcDialogTextNodes113c(
    m,
    pQuestData,
    nMsg,
    m.u32((pQuestArg + 0x14) >>> 0) >>> 0,
    nNpcId,
  )
}

/**
 * [32/45] Marks the Kurast NPC intro flag on `pQuestArg->pPlayer` when the matching intro speech ID
 * finishes for Cain, Asheara, Alkor, Ormus, Meshif, or Natalya.
 *
 * @va D2Game:0x6FD056E0
 */
export function ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c(
  m: D2KernMemory113c,
  _pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD056E0)
  const wMsgId = m.u16((pQuestArg + 0x18) >>> 0)
  const nNpcId = m.u32((pQuestArg + 0x14) >>> 0) >>> 0
  let matched = false
  if (nNpcId === 0xf5) {
    matched = wMsgId === 0x1ca
  } else if (nNpcId === 0xfc) {
    matched = wMsgId === 0x1eb || wMsgId === 0x1ea
  } else if (nNpcId === 0xfe) {
    matched = wMsgId === 0x1f6 || wMsgId === 0x1f5
  } else if (nNpcId === 0xff) {
    matched = wMsgId === 0x203 || wMsgId === 0x202
  } else if (nNpcId === 0x108) {
    matched = wMsgId === 0x1df || wMsgId === 0x1de
  } else if (nNpcId === 0x129) {
    matched = wMsgId === 0x1c5
  }
  if (matched) {
    QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      nNpcId,
      m.u32(pQuestArg >>> 0) >>> 0,
    )
  }
}

/**
 * [33/45] Opens Mephisto's Durance 3 bridge (`+0x04`, mode `1`) and Act 4 Hell gate portal
 * (`+0x08`, mode `2`) on quest node `0x14` (`edi = pGame`).
 *
 * @va D2Game:0x6FD05A60
 */
export function ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD05A60)
  const pQuest14 = findQuestNodeInGame113c(m, pGame, 0x14)
  if (pQuest14 === 0) return
  const pQuestEx = m.u32((pQuest14 + 0x18) >>> 0) >>> 0
  const bHasBridge = m.u8((pQuestEx + 0x01) >>> 0)
  m.setU32((pQuestEx + 0x0c) >>> 0, 2)
  m.setU32((pQuestEx + 0x10) >>> 0, 2)
  if (bHasBridge !== 0) {
    const pBridge = lookupGameObjectByGuid113c(m, pGame, m.u32((pQuestEx + 0x04) >>> 0))
    if (pBridge !== 0) UNITS_ChangeAnimMode113c(m, pBridge, 1)
  }
  if (m.u8((pQuestEx + 0x02) >>> 0) !== 0) {
    const pPortal = lookupGameObjectByGuid113c(m, pGame, m.u32((pQuestEx + 0x08) >>> 0))
    if (pPortal !== 0) UNITS_ChangeAnimMode113c(m, pPortal, 2)
  }
}

/**
 * [34/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): sends quest `0x14` (`0x5D`)
 * alert when quest `0x16` is either incomplete (`!bit0 && !bitF`) or newly completed (`bitD || bitE`).
 *
 * @va D2Game:0x6FD05BE0
 */
export function ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD05BE0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bCompleted =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0f) !== 0
  if (
    !bCompleted ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x14, pPlayer, pGame)
  }
  return 0
}

/**
 * [35/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): sends quest `0x13` (`0x5D`)
 * alert when quest `0x15` is either incomplete (`!bit0 && !bitF`) or newly completed (`bitD || bitE`).
 *
 * @va D2Game:0x6FD05D20
 */
export function ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD05D20)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bCompleted =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0f) !== 0
  if (
    !bCompleted ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x13, pPlayer, pGame)
  }
  return 0
}

let k2W5B8ScratchSp = 0x7e050000

/**
 * [36/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): checks whether `pPlayer`
 * is in the same or an adjacent room to the slain Council member (`pQuest13->pQuestEx->dwMonGuid`)
 * and sets quest `0x15` state `0` (if `0x12` done) or `4`, plus `0x0D`.
 *
 * @va D2Game:0x6FD05D80
 */
export function ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD05D80)
  const g = pGame >>> 0
  const u = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, u) >>> 0
  const nDiff = m.u8((g + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const pPlayerRoom = UNITS_GetRoom113c(m, u) >>> 0
  if (pPlayerRoom === 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 4) !== 0) return 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pPlayerRoom)
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 2) return 0
  const pQuest13 = findQuestNodeInGame113c(m, g, 0x13)
  const pQuestEx = m.u32((pQuest13 + 0x18) >>> 0) >>> 0
  const dwMonGuid = m.u32(pQuestEx) >>> 0
  let pMonster = m.u32((g + (dwMonGuid & 0x7f) * 4 + 0x1320) >>> 0) >>> 0
  while (pMonster !== 0 && m.u32((pMonster + 0x0c) >>> 0) !== dwMonGuid) {
    pMonster = m.u32((pMonster + 0xe4) >>> 0) >>> 0
  }
  if (pMonster === 0) return 0
  const pMonRoom = UNITS_GetRoom113c(m, pMonster) >>> 0
  if (pMonRoom === 0) return 0
  let bNear = 0
  if (pPlayerRoom === pMonRoom) {
    bNear = 1
  } else {
    const pPlrRoom2 = UNITS_GetRoom113c(m, u) >>> 0
    if (pPlrRoom2 === 0) throw new D2CommonAssertError('', 0xdf)
    const savedSp = k2W5B8ScratchSp
    const pppRooms = savedSp
    const pnRooms = (savedSp + 4) >>> 0
    k2W5B8ScratchSp = (savedSp + 8) >>> 0
    try {
      m.setU32(pppRooms, 0)
      m.setU32(pnRooms, 0)
      DUNGEON_GetAdjacentRoomsListFromRoom113c(m, pPlrRoom2, pppRooms, pnRooms)
      const nRooms = m.u32(pnRooms) >>> 0
      const ppRooms = m.u32(pppRooms) >>> 0
      for (let i = 0; i < nRooms; i = (i + 1) >>> 0) {
        if (m.u32((ppRooms + i * 4) >>> 0) === pMonRoom) {
          bNear = 1
          break
        }
      }
    } finally {
      k2W5B8ScratchSp = savedSp
    }
  }
  const pPlrRec = PLAYER_GetQuestRecordForDifficulty_6FC21020_113c(m, u, g) >>> 0
  if (bNear !== 0) {
    const bQ12Done = DRLGWARP_TestRoomTileBit113c(m, pPlrRec, 0x12, 0)
    QUESTRECORD_SetQuestState113c(m, pPlrRec, 0x15, bQ12Done !== 0 ? 0 : 4)
    QUESTRECORD_SetQuestState113c(m, pPlrRec, 0x15, 0x0d)
  }
  return 0
}

/**
 * [37/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): sends quest `0x12` (`0x5D`)
 * alert when quest `0x14` is either incomplete (`!bit0 && !bitF`) or newly completed (`bitD || bitE`).
 *
 * @va D2Game:0x6FD05F00
 */
export function ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD05F00)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bCompleted =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0x0f) !== 0
  if (
    !bCompleted ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x12, pPlayer, pGame)
  }
  return 0
}

/**
 * [38/45] Activates the Gidbinn altar object (`pQuestEx->dwAltarGuid` at `+0x28`, mode `1`),
 * schedules timer event `1` using `pObjectsTxt->dwFrameDelta >> 8`, and sets `pQuestEx + 0x2C = 2`.
 *
 * @va D2Game:0x6FD05F60
 */
export function ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c(
  m: D2KernMemory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FD05F60)
  const g = pGame >>> 0
  const pQuest11 = findQuestNodeInGame113c(m, g, 0x11)
  if (pQuest11 === 0) return
  const pQuestEx = m.u32((pQuest11 + 0x18) >>> 0) >>> 0
  const dwAltarGuid = m.u32((pQuestEx + 0x28) >>> 0) >>> 0
  m.setU8((pQuestEx + 0x06) >>> 0, 0)
  const pAltar = lookupGameObjectByGuid113c(m, g, dwAltarGuid)
  if (pAltar === 0) return
  UNITS_ChangeAnimMode113c(m, pAltar, 1)
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, m.u32((pAltar + 0x04) >>> 0)) >>> 0
  const dwFrameOffset = m.u32((pObjTxt + 0xdc) >>> 0) >>> 8
  const dwTargetFrame = (dwFrameOffset + m.u32((g + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, g, pAltar, 1, dwTargetFrame, 0, 0, 0)
  m.setU32((pQuestEx + 0x2c) >>> 0, 2)
}

/**
 * [39/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): sends quest `0x11` (`0x5D`)
 * alert when quest `0x13` is either incomplete (`!bit0 && !bitF`) or newly completed (`bitD || bitE`).
 *
 * @va D2Game:0x6FD06130
 */
export function ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD06130)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bCompleted =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0x0f) !== 0
  if (
    !bCompleted ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x11, pPlayer, pGame)
  }
  return 0
}

/**
 * [40/45] Item pickup handler for Act 3 Khalim's Will (`0x12`): inspects picked item base code
 * (`'qf2 '`, `'qf1 '`, `'qey '`, `'qhr '`, `'qbr '`) and sends packet `0x5D` quest substate update.
 *
 * @va D2Game:0x6FD06190
 */
export function ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FD06190)
  const q = pQuestData >>> 0
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0f, 0) === 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) !== 0) return
  const dwBaseCode = ITEMS_GetBaseCode113c(m, m.u32((pQuestArg + 0x08) >>> 0) >>> 0) >>> 0
  DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 2)
  DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 3)
  DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 4)
  const bNotBit5 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 5) === 0 ? 1 : 0
  DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 6)
  const bNotBit7 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 7) === 0 ? 1 : 0
  const bFlail =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32(pQuestArg >>> 0) >>> 0,
      0x20316671,
    ) !== 0
      ? 1
      : 0
  ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
    m,
    m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
    m.u32(pQuestArg >>> 0) >>> 0,
    0x20326671,
  )
  const bEye =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32(pQuestArg >>> 0) >>> 0,
      0x20796571,
    ) !== 0
      ? 1
      : 0
  const bBrain =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32(pQuestArg >>> 0) >>> 0,
      0x20726271,
    ) !== 0
      ? 1
      : 0
  const bHeart =
    ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(
      m,
      m.u32((pQuestArg + 0x0c) >>> 0) >>> 0,
      m.u32(pQuestArg >>> 0) >>> 0,
      0x20726871,
    ) !== 0
      ? 1
      : 0
  if (dwBaseCode === 0x20326671) {
    if (m.u8((q + 0x0b) >>> 0) !== 0) m.setU8((q + 0x0b) >>> 0, 7)
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0f, 0) !== 0) return
    ACT3Q7_SendQuestUpdatePacket5D_113c(m, q, bNotBit7 !== 0 ? 5 : 6, pQuestArg)
    return
  }
  if (dwBaseCode === 0x20316671) {
    const nSub = bEye === 0 ? 1 : bBrain === 0 ? 2 : bHeart === 0 ? 4 : bNotBit5 === 0 ? 7 : 5
    ACT3Q7_SendQuestUpdatePacket5D_113c(m, q, nSub, pQuestArg)
    return
  }
  if (dwBaseCode === 0x20796571) {
    const nSub = bBrain === 0 ? 2 : bFlail === 0 ? 3 : bHeart !== 0 ? 7 : 4
    ACT3Q7_SendQuestUpdatePacket5D_113c(m, q, nSub, pQuestArg)
    return
  }
  if (dwBaseCode === 0x20726871) {
    const nSub = bBrain === 0 ? 2 : bFlail === 0 ? 3 : bEye !== 0 ? 7 : 1
    ACT3Q7_SendQuestUpdatePacket5D_113c(m, q, nSub, pQuestArg)
    return
  }
  if (dwBaseCode === 0x20726271) {
    const nSub = bHeart === 0 ? 4 : bFlail === 0 ? 3 : bEye !== 0 ? 7 : 1
    ACT3Q7_SendQuestUpdatePacket5D_113c(m, q, nSub, pQuestArg)
  }
}

/**
 * [41/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): sends quest `0x10` (`0x5D`)
 * alert when quest `0x12` states `0` and `0x0F` are both clear.
 *
 * @va D2Game:0x6FD06420
 */
export function ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD06420)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0x0f) === 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x10, pPlayer, pGame)
  }
  return 0
}

/**
 * [42/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): marks Lam Esen's Tome
 * quest `0x11` states `0x0D`, `0`, `1` for Act 3 party members and sends packet `0x28`.
 *
 * @va D2Game:0x6FD064C0
 */
export function ACT3Q4_CompleteLamEsensTomePartyCallback_6FD064C0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD064C0)
  const pRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
  if (pRoom === 0) return 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0) !== 0) return 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 1) !== 0) return 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 2) return 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x11, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x11, 0)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x11, 1)
  QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, pGame)
  return 0
}

/**
 * [43/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): sends quest `0x0F` (`0x5D`)
 * alert when quest `0x11` is either incomplete (`!bit0 && !bitF`) or newly completed (`bitD || bitE`).
 *
 * @va D2Game:0x6FD06550
 */
export function ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD06550)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  const bCompleted =
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0x0f) !== 0
  if (
    !bCompleted ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0x0e) !== 0
  ) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x0f, pPlayer, pGame)
  }
  return 0
}

/**
 * [44/45] Player callback (`ecx = pGame`, `edx = pPlayer`, `ret 0x04`): when `pPlayer` has quest
 * `0x15` state `0x0D`, propagates Council completion across `pPlayer`'s sub-party.
 *
 * @va D2Game:0x6FD06980
 */
export function ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number = 0,
): number {
  hitD2GameVa113c(0x6FD06980)
  const u = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, u) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + nDiff * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0d) !== 0 && u !== 0) {
    const pUnitGame = m.u32((u + 0x80) >>> 0) >>> 0
    if (pUnitGame !== 0 && m.u32(u) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, u, pUnitGame) & 0xffff
      if (wPartyId !== 0xffff) {
        PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
          m,
          pGame,
          wPartyId,
          ACT3Q5_CompleteCouncilPartyCallback113c,
          0,
        )
      }
    }
  }
  return 0
}

/**
 * [45/45] Propagates Lam Esen's Tome quest state across `pPlayer`'s (`eax`) sub-party in `pGame`
 * (`esi`) via `ACT3Q4_SyncTomePartyQuestStateCallback113c`.
 *
 * @va D2Game:0x6FD06B90
 */
export function ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FD06B90)
  const u = pPlayer >>> 0
  if (u !== 0) {
    const pUnitGame = m.u32((u + 0x80) >>> 0) >>> 0
    if (pUnitGame !== 0 && m.u32(u) === 0) {
      const wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, u, pUnitGame) & 0xffff
      if (wPartyId !== 0xffff) {
        PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
          m,
          pGame,
          wPartyId,
          ACT3Q4_SyncTomePartyQuestStateCallback113c,
          0,
        )
      }
    }
  }
  return 0
}
