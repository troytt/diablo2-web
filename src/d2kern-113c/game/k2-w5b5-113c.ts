/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 5 Batch 5 (`w5b5`) routines across
 * `0x6FCE3E10..0x6FCEC9D0` (45 functions).
 */

import { COLLISION_FindFreePositionWithStep113c } from '../common/collision'
import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_FindFreeSpawnPositionInLevel113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items'
import {
  DATATBLS_GetItemsTxtRecordMemPort113c,
  STATLIST_GetStatListFromUnitAndStateMemPort113c,
} from '../common/k0-d2common-memports'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record'
import {
  SKILLS_CanUnitAllocateSkillPoint113c,
  SKILLS_CheckSkillLevelAndPrereqs113c,
  SKILLS_GetSkillById113c,
} from '../common/skills'
import {
  DRLGLOGIC_GetBossTombLevel113c,
  STATLIST_GetExpireFrameEx113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetMaxManaFromUnit113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
} from '../common/statlist'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RefreshUnit113c,
  UNITS_GetRoom113c,
  UNIT_GetAlignment113c,
} from '../common/unit'
import type { Memory113c } from '../mem/sparse-memory'
import { isFrameS2CTraceActive113c } from '../net/packet-sink'
import { seedRoll } from '../prng'
import {
  AIGENERAL_GetPackLeaderUnit113c,
  SUNIT_SetUnitEventSound113c,
} from './ai-fallen-113c'
import {
  AIGENERAL_FlushAllAiCommands113c,
  CLIENTS_ForEachInGameClient113c,
  NET_QueuePacketToClientBuffer113c,
} from './boot-init-gap-a-113c'
import {
  D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c,
  D2GAME_SUNIT_GetGameFromUnit113c,
  D2GAME_SUNIT_IterateAllLivingPlayers113c,
} from './boot-init-gap-b-113c'
import { SUNIT_GetServerUnit113c } from './game-strc'
import {
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  PLAYER_SetClientSkillHotkeySlot113c,
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_GuidListAdd113c,
  QUESTS_GuidListContains113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
} from './k2-items-tc-w1-113c'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c,
  DRLG_PopulateSingleRoom_6FC4CB80_113c,
  QUESTS_CheckGlobalQuestState_6FC538D0_113c,
  QUESTS_SetGlobalQuestState_6FC53920_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { QUESTS_TriggerCallback0B_6FC55C90_113c } from './k2-laneK-0x6fc5-w1-113c'
import { MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c } from './k2-laneL-0x6fc6-w1-113c'
import {
  ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c,
  QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c,
  QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c,
  QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c,
} from './k2-w2b2-113c'
import { NET_SendPacketBuffer7B_6FCAAB20_113c } from './k2-w2b3-113c'
import { SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c } from './k2-w2b5-113c'
import {
  ACT2Q2_IsQuestPastState01_6FCE1B60_113c,
  ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c,
} from './k2-w2b6-113c'
import {
  ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c,
  ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c,
} from './k2-w2b7-113c'
import { SUNIT_SetLastKillerInfo_6FCFFAE0_113c } from './k2-w2b8-113c'
import {
  QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c,
  QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c,
  QUESTS_SendQuestLogPackets50And52_6FC55640_113c,
} from './k2-w3b3-113c'
import { NET_SendPacket26_ChatMessage_6FCAB470_113c } from './k2-w4b4-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import {
  MONSTER_Create113c,
  MONSTER_SpawnAtCoords113c,
  ROOM_FindRoomContainingSubtile113c,
} from './regpop-spawn-113c'
import { SUNIT_FreeUnit113c } from './replay-final11-113c'
import { AIGENERAL_CopyAiCommandParams113c } from './replay-kernel-113c'
import { EVENT_SetEventFull113c } from './timer-wheel'
import { hitD2GameVa113c } from '../va-trace-113c'

export type D2KernMemory113c = Memory113c

const ACT2Q1_SEQ_MSG_TABLE_6FD2396C: readonly number[] = [
  0xffffffff, 0, 1, 2, 3, 4, 0, 244,
]

function readDataTableU32_113c(
  m: D2KernMemory113c,
  tableVa: number,
  defaults: readonly number[],
  idx: number,
): number {
  try {
    const first = m.u32(tableVa >>> 0) >>> 0
    if (first !== 0 || (defaults.length > 0 && (defaults[0]! >>> 0) === 0)) {
      return m.u32((tableVa + (idx << 2)) >>> 0) >>> 0
    }
  } catch {
    // Unmapped .data section in standalone SparseMemory113c; fall back to v1.13c D2Game.dll bytes.
  }
  return idx >= 0 && idx < defaults.length ? (defaults[idx]! >>> 0) : 0xffffffff
}

/**
 * Clears ACT2Q2 (`0x0A`) quest flags `4` (`'vip '`), `6` (`'box '`), or `5` (`'msf '`) on the player when dropping/removing the item.
 * @va D2Game:0x6FCE3E10
 */
export function ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c(
  m: D2KernMemory113c,
  _pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE3E10)
  const arg = pQuestArg >>> 0
  const pItem = m.u32((arg + 0x08) >>> 0) >>> 0
  const nItemId = pItem !== 0 ? m.u32((pItem + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const dwCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0
  if (dwCode === 0x20706976 && DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 4) !== 0) {
    QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0a, 4)
  }
  if (dwCode === 0x20786f62 && DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 6) !== 0) {
    QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0a, 6)
  }
  if (dwCode === 0x2066736d && DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 5) !== 0) {
    QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0a, 5)
  }
}

/**
 * Increments `pQuestDataEx->nStaffPlayerCount (+0x14)` on quest `9` (`ACT2Q2`) if the player lacks state `(10, 0)`, `'msf '`, and `'hst '`.
 * @va D2Game:0x6FCE3F40
 */
export function ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE3F40)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) !== 0) return 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, player, game, 0x2066736d) !== 0) return 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, player, game, 0x20747368) !== 0) return 0
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 9) {
      const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
      m.setU32((pQuestDataEx + 0x14) >>> 0, (m.u32((pQuestDataEx + 0x14) >>> 0) + 1) >>> 0)
      return 0
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Resolves ACT2Q2 Horadric Staff sub-status byte (`*pOutStatus`) from `'hst '`, `'box '`, `'tr1 '`, `'vip '`, and `'msf '` items (`edi = pQuestData`, `esi = pPlayer`, `[esp+4] = pOutStatus`).
 * @va D2Game:0x6FCE4030
 */
export function ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pPlayer: number,
  pOutStatus: number,
): number {
  hitD2GameVa113c(0x6FCE4030)
  const qd = pQuestData >>> 0
  const player = pPlayer >>> 0
  const out = pOutStatus >>> 0
  m.setU8(out, 0xff)
  let pGame = m.u32((qd + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0

  pGame = m.u32((qd + 0x04) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, player, pGame, 0x20747368) !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x0a) === 0) {
      m.setU8(out, 0x04)
      return 1
    }
    m.setU8(out, 0x05)
    return 0
  }
  pGame = m.u32((qd + 0x04) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, player, pGame, 0x20786f62) !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x06) === 0) {
      m.setU8(out, 0x03)
      return 1
    }
    m.setU8(out, 0x09)
  }
  pGame = m.u32((qd + 0x04) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, player, pGame, 0x20317274) !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x03) === 0) {
      m.setU8(out, 0x00)
      return 1
    }
    m.setU8(out, 0x06)
  }
  pGame = m.u32((qd + 0x04) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, player, pGame, 0x20706976) !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x04) === 0) {
      m.setU8(out, 0x01)
      return 1
    }
    m.setU8(out, 0x07)
  }
  pGame = m.u32((qd + 0x04) >>> 0) >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, player, pGame, 0x2066736d) !== 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x05) === 0) {
      m.setU8(out, 0x02)
      return 1
    }
    m.setU8(out, 0x08)
  }
  return 0
}

/**
 * Syncs ACT2Q1 (`0x09`, Radament) quest flags and `pQuestData` sequence filter when a player enters the game.
 * @va D2Game:0x6FCE41D0
 */
export function ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE41D0)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pPlayer0 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame0 = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0

  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0) | 0) === 1) {
    if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 5) | 0) === 1) {
      const pPlayer1 = m.u32((arg + 0x0c) >>> 0) >>> 0
      const pGame1 = m.u32(arg) >>> 0
      if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer1, pGame1, 0x20737361) === 0) {
        QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 9, 0)
        QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 9, 1)
        QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 9, 0x0f)
        QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 9, 5)
      }
    }
    const pGame = m.u32((qd + 0x04) >>> 0) >>> 0
    const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
      throw new D2CommonAssertError('', 0x820)
    }
    const pGlobalFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
    QUESTRECORD_SetQuestState113c(m, pGlobalFlags, 9, 0x0d)
    m.setU8((qd + 0x09) >>> 0, 0)
    m.setU8((qd + 0x0c) >>> 0, 0)
    return
  }

  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0x0f) | 0) === 1) {
    if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 1) | 0) === 1) {
      const pQuestDataEx = m.u32((qd + 0x18) >>> 0) >>> 0
      m.setU8((pQuestDataEx + 0x10) >>> 0, 1)
    }
    m.setU8((qd + 0x0c) >>> 0, 0)
    m.setU8((qd + 0x09) >>> 0, 0)
    return
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 4) | 0) === 1) {
    m.setU8((qd + 0x0b) >>> 0, 2)
    m.setU8((qd + 0x0c) >>> 0, 3)
    return
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 3) | 0) === 1) {
    m.setU8((qd + 0x0b) >>> 0, 1)
    m.setU8((qd + 0x0c) >>> 0, 3)
    return
  }
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 2) | 0) === 1) {
    m.setU8((qd + 0x0c) >>> 0, 2)
    m.setU8((qd + 0x0b) >>> 0, 1)
  }
}

/**
 * Adds ACT2Q1 NPC dialog text nodes on NPC activation based on quest state and `0x6FD2396C` sequence table.
 * @va D2Game:0x6FCE4320
 */
export function ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE4320)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pNpc = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) >>> 0 : 0xffffffff
  const pPlayer0 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame0 = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0

  const state0D = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((qd + 0xe0) >>> 0) | 0, 0x0d) | 0
  const state00 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((qd + 0xe0) >>> 0) | 0, 0x00) | 0
  const state01 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((qd + 0xe0) >>> 0) | 0, 0x01) | 0
  if (state01 !== 0) {
    const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
    QUESTS_AddNpcDialogTextNodes113c(m, qd, 3, pTextHeader, nNpcClassId)
    return
  }

  const pPlayer1 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const dwGuid = pPlayer1 !== 0 ? m.u32((pPlayer1 + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const wGuidCount = m.u16((qd + 0x9c) >>> 0)
  for (let i = 0; i < wGuidCount; i++) {
    if ((m.u32((qd + 0x1c + (i << 2)) >>> 0) >>> 0) === dwGuid) {
      const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
      QUESTS_AddNpcDialogTextNodes113c(m, qd, 4, pTextHeader, nNpcClassId)
      return
    }
  }

  if (state00 === 1) return
  const nSeq = m.u8((qd + 0x0c) >>> 0)
  if (nSeq === 0) return
  if (nSeq >= 4 && state0D === 0) return
  const msgIdx = readDataTableU32_113c(m, 0x6fd2396c, ACT2Q1_SEQ_MSG_TABLE_6FD2396C, nSeq)
  if (msgIdx !== 0xffffffff && msgIdx < 9) {
    const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
    QUESTS_AddNpcDialogTextNodes113c(m, qd, msgIdx | 0, pTextHeader, nNpcClassId)
  }
}

/**
 * Propagates active quest `8` (`ACT2Q1`) sequence filter (`2` or `3`) to player quest flags `(9, 2|3|4)`.
 * @va D2Game:0x6FCE4430
 */
export function ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE4430)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0) | 0) === 1) return 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 1) | 0) === 1) return 0
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 8) {
      const nSeq = m.u8((pQuest + 0x0c) >>> 0)
      if (nSeq === 2) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 2)
        return 0
      }
      if (nSeq === 3) {
        if (m.u8((pQuest + 0x0b) >>> 0) === 1) {
          QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 3)
          return 0
        }
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 4)
      }
      return 0
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Sets global quest state `(8, 0x0D)` if the entering player already has quest state `(8, 0)` (`ACT2Q0`).
 * @va D2Game:0x6FCE44E0
 */
export function ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE44E0)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame0 = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 8, 0) | 0) === 1) {
    const pGame = m.u32((qd + 0x04) >>> 0) >>> 0
    const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
      throw new D2CommonAssertError('', 0x820)
    }
    const pGlobalFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
    QUESTRECORD_SetQuestState113c(m, pGlobalFlags, 8, 0x0d)
  }
}

/**
 * Adds ACT2Q0 Jerhyn (`0xC9`) or Deckard Cain (`0xF4`) intro dialog text on NPC activation.
 * @va D2Game:0x6FCE4570
 */
export function ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE4570)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pNpc = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1
  const pPlayer0 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame0 = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0

  if (nNpcClassId === 0xc9) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 8, 0) === 0) {
      const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
      QUESTS_AddNpcDialogTextNodes113c(m, qd, 0, pTextHeader, 0xc9)
    }
    return
  }
  if (nNpcClassId === 0xf4) {
    const pQuestDataEx = m.u32((qd + 0x18) >>> 0) >>> 0
    if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0e) | 0) !== 1) return
    const pPlayer1 = m.u32((arg + 0x0c) >>> 0) >>> 0
    const dwGuid = pPlayer1 !== 0 ? m.u32((pPlayer1 + 0x0c) >>> 0) >>> 0 : 0xffffffff
    if (QUESTS_GuidListContains113c(m, pQuestDataEx, dwGuid) !== 0) return
    const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
    QUESTS_AddNpcDialogTextNodes113c(m, qd, 1, pTextHeader, 0xf4)
    const pPlayer2 = m.u32((arg + 0x0c) >>> 0) >>> 0
    const pGame1 = m.u32((qd + 0x04) >>> 0) >>> 0
    ACT1Q4_RemovePlayerFromCainPortalGuidList_6FC81420_113c(m, pGame1, pPlayer2)
  }
}

/**
 * Completes ACT2Q0 Jerhyn (`0xC9`, msg `0xFD`) or Cain (`0xF4`, msg `0x7D`) scroll message callback.
 * @va D2Game:0x6FCE4620
 */
export function ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE4620)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const wNpcId = m.u16((arg + 0x14) >>> 0)
  const wMsgIdx = m.u16((arg + 0x18) >>> 0)
  if (wNpcId === 0xc9) {
    if (wMsgIdx === 0xfd) {
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      const pGame = m.u32(arg) >>> 0
      const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
      const nDiff = m.u8((pGame + 0x6d) >>> 0)
      const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 8, 0)
      QUESTS_SetGlobalQuestState_6FC53920_113c(m, m.u32(arg) >>> 0, 8, 0x0d)
    }
    return
  }
  if (wNpcId === 0xf4 && wMsgIdx === 0x7d) {
    const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
    const pQuestDataEx = m.u32((qd + 0x18) >>> 0) >>> 0
    const dwGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
    QUESTS_GuidListAdd113c(m, pQuestDataEx, dwGuid)
  }
}

/**
 * Adds Act 2 town NPC introduction dialog text (`1` for class-matched greeting, `0` otherwise) if unseen.
 * @va D2Game:0x6FCE4690
 */
export function ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE4690)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pNpc = m.u32((arg + 0x08) >>> 0) >>> 0
  const nNpcClassId = pNpc !== 0 ? m.u32((pNpc + 0x04) >>> 0) | 0 : -1
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const nPlayerClass = pPlayer !== 0 ? m.u32((pPlayer + 0x04) >>> 0) | 0 : -1

  let specialClass = 7
  switch (nNpcClassId) {
    case 0xaf:
    case 0xc6:
    case 0xca:
      specialClass = 7
      break
    case 0xb1:
      specialClass = 1
      break
    case 0xb2:
      specialClass = 3
      break
    case 0xc7:
      specialClass = 2
      break
    case 0xc8:
      specialClass = 4
      break
    case 0xd2:
      specialClass = 0
      break
    default:
      return
  }

  const pGame = m.u32(arg) >>> 0
  if (QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, nNpcClassId, pGame) !== 0) return
  const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
  const msgTableIdx = nPlayerClass === specialClass ? 1 : 0
  QUESTS_AddNpcDialogTextNodes113c(m, qd, msgTableIdx, pTextHeader, nNpcClassId >>> 0)
}

let k2W5B5StackPtr = 0x7ee90000

function rollUnitSeedLimited113c(m: D2KernMemory113c, pSeed: number, nMax: number): number {
  const s = pSeed >>> 0
  const seed = { lo: m.u32(s) >>> 0, hi: m.u32((s + 4) >>> 0) >>> 0 }
  const out = seedRoll(seed, nMax)
  m.setU32(s, seed.lo >>> 0)
  m.setU32((s + 4) >>> 0, seed.hi >>> 0)
  return out >>> 0
}

/**
 * Records Act 2 town NPC intro flag on `pPlayer` when the matching greeting scroll message completes.
 * @va D2Game:0x6FCE4780
 */
export function ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c(
  m: D2KernMemory113c,
  _pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE4780)
  const arg = pQuestArg >>> 0
  const wMsgIdx = m.u16((arg + 0x18) >>> 0)
  const nNpcClassId = m.u32((arg + 0x14) >>> 0) | 0
  let matched = false
  switch (nNpcClassId) {
    case 0xaf:
      matched = wMsgIdx === 0xd7
      break
    case 0xb1:
      matched = wMsgIdx === 0x11e || wMsgIdx === 0x11d
      break
    case 0xb2:
      matched = wMsgIdx === 0x108 || wMsgIdx === 0x107
      break
    case 0xc6:
      matched = wMsgIdx === 0xbe
      break
    case 0xc7:
      matched = wMsgIdx === 0xcc || wMsgIdx === 0xcb
      break
    case 0xc8:
      matched = wMsgIdx === 0xe7 || wMsgIdx === 0xe6
      break
    case 0xca:
      matched = wMsgIdx === 0x112
      break
    case 0xd2:
      matched = wMsgIdx === 0xf2 || wMsgIdx === 0xf1
      break
    default:
      return
  }
  if (!matched) return
  const pGame = m.u32(arg) >>> 0
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c(m, pPlayer, nNpcClassId, pGame)
}

/**
 * Selects and adds Kaelan (`0x179`) palace guard dialog text nodes for ACT2Q7 using `pPlayer->pSeed (+0x20)`.
 * @va D2Game:0x6FCE4900
 */
export function ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE4900)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pNpc = m.u32((arg + 0x08) >>> 0) >>> 0
  if (pNpc === 0 || (m.u32((pNpc + 0x04) >>> 0) | 0) !== 0x179) return

  const pPlayer0 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame0 = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0

  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1e, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0x0d) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 1) === 0 &&
    QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32(arg) >>> 0, 9, 0x0d) === 0
  ) {
    const pGame1 = m.u32((qd + 0x04) >>> 0) >>> 0
    const pQuestCtrl = m.u32((pGame1 + 0x10f4) >>> 0) >>> 0
    let pQuest8 = pQuestCtrl !== 0 ? m.u32(pQuestCtrl) >>> 0 : 0
    while (pQuest8 !== 0 && (m.u32(pQuest8) | 0) !== 8) {
      pQuest8 = m.u32((pQuest8 + 0xf4) >>> 0) >>> 0
    }
    if (pQuest8 !== 0 && m.u8((pQuest8 + 0x09) >>> 0) === 0) {
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      const msgIdx = (rollUnitSeedLimited113c(m, (pPlayer + 0x20) >>> 0, 3) + 2) | 0
      const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
      QUESTS_AddNpcDialogTextNodes113c(m, qd, msgIdx, pTextHeader, 0x179)
      return
    }
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1e, 0x0d) === 0) {
      const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
      const msgIdx = rollUnitSeedLimited113c(m, (pPlayer + 0x20) >>> 0, 2) | 0
      const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
      QUESTS_AddNpcDialogTextNodes113c(m, qd, msgIdx, pTextHeader, 0x179)
      return
    }
  }

  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const msgIdx = (rollUnitSeedLimited113c(m, (pPlayer + 0x20) >>> 0, 3) + 2) | 0
  const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
  QUESTS_AddNpcDialogTextNodes113c(m, qd, msgIdx, pTextHeader, 0x179)
}

/**
 * Updates ACT2Q7 (`0x1E`) quest state (`0x0D` or `0x00`) on Kaelan (`0x179`) scroll message completion.
 * @va D2Game:0x6FCE4A40
 */
export function ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE4A40)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  if (m.u16((arg + 0x14) >>> 0) !== 0x179) return
  const pPlayer = m.u32((arg + 0x0c) >>> 0) >>> 0
  const wMsgIdx = m.u16((arg + 0x18) >>> 0)
  const pGame = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (wMsgIdx === 0x3b || wMsgIdx === 0x3c) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1e, 0x0d)
    m.setU32((qd + 0xa8) >>> 0, 0x6fce27c0)
    return
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1e, 0)
}

/**
 * Checks whether ACT2Q6 (`0x0D`, Tal Rasha's Tomb) blocks `pTargetUnit` when no living player is within `< 12` subtiles.
 * @va D2Game:0x6FCE4AA0
 */
export function ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pTargetUnit: number,
): number {
  hitD2GameVa113c(0x6FCE4AA0)
  const game = pGame >>> 0
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x3d) >>> 0) !== 0) return 1
  if (m.u8((pQuestDataEx + 0x0f) >>> 0) === 0) return 0
  m.setU8((pQuestDataEx + 0x44) >>> 0, 0)
  m.setU32((pQuestDataEx + 0x40) >>> 0, pTargetUnit >>> 0)
  D2GAME_SUNIT_IterateAllLivingPlayers113c(
    m,
    game,
    ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c,
    pQuestDataEx,
  )
  return m.u8((pQuestDataEx + 0x44) >>> 0) === 0 ? 1 : 0
}

/**
 * Sends S2C packet `0x50` (`0x0F` bytes, quest `0x0D`) carrying the true Tal Rasha tomb symbol (`nBossTombLvl - 0x42`).
 * @va D2Game:0x6FCE4B10
 */
export function ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCE4B10)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  let pQuest = pQuestCtrl !== 0 ? m.u32(pQuestCtrl) >>> 0 : 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }

  let pClient = 0
  if (player !== 0 && (m.u32(player) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const savedSp = k2W5B5StackPtr
  const pPacket = savedSp >>> 0
  k2W5B5StackPtr = (savedSp + 0x10) >>> 0
  try {
    m.fill(pPacket, 0x10, 0)
    m.setU8(pPacket, 0x50)
    m.setU16((pPacket + 0x01) >>> 0, 0x0d)
    const pAct1 = m.u32((game + 0xc0) >>> 0) >>> 0
    const nBossTombLvl = DRLGLOGIC_GetBossTombLevel113c(m, pAct1) | 0
    if (nBossTombLvl === 0) {
      m.setU16((pPacket + 0x03) >>> 0, 0)
    } else {
      const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
      m.setU16((pPacket + 0x03) >>> 0, (nBossTombLvl - 0x42) & 0xffff)
      m.setU32((pQuestDataEx + 0x34) >>> 0, nBossTombLvl >>> 0)
    }
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket, 0x0f)
  } finally {
    k2W5B5StackPtr = savedSp
  }
}

const ACT2Q4_SEQ_MSG_TABLE_6FD24FD8: readonly number[] = [
  0xffffffff, 0, 1, 2, 3, 4, 0, 0, 176, 414, 2, 175,
]

/**
 * Marks ACT2Q6 (`0x0E`) states `0x0D` and `0x03` and advances `pClient->wCharStatus (+0x0A)` Act 2 progression if lower.
 * @va D2Game:0x6FCE4C30
 */
export function ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c(
  m: D2KernMemory113c,
  pPlayer: number,
  pQuestFlags: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCE4C30)
  const player = pPlayer >>> 0
  const flags = pQuestFlags >>> 0
  const game = pGame >>> 0
  QUESTRECORD_SetQuestState113c(m, flags, 0x0e, 0x0d)
  QUESTRECORD_SetQuestState113c(m, flags, 0x0e, 0x03)

  let pClient = 0
  if (player !== 0 && (m.u32(player) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const nDiff = m.u8((game + 0x6d) >>> 0)
  const wStatus = m.u16((pClient + 0x0a) >>> 0)
  const actsPerDiff = (((wStatus & 0x20) | 0x80) >>> 5) | 0
  const targetProg = (Math.imul(actsPerDiff, nDiff) + 2) | 0
  const curProg = (wStatus >>> 8) & 0x1f
  if (targetProg >= curProg) {
    const wStatusCur = m.u16((pClient + 0x0a) >>> 0)
    const nextStatus = ((targetProg << 8) | (wStatusCur & 0xe0ff)) & 0xffff
    m.setU16((pClient + 0x0a) >>> 0, nextStatus)
  }
}

/**
 * Sets `wInteractType (+0x6E) = 0x36`, `pInteractUnit (+0x70) = pPlayer`, refreshes room, and sets `+0xC4 |= 0x400` when `(0x0E, 0x0D)` is set.
 * @va D2Game:0x6FCE4CC0
 */
export function ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE4CC0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0d) !== 0) {
    if (player === 0) {
      throw new D2CommonAssertError('', 0x558)
    }
    m.setU16((player + 0x6e) >>> 0, 0x36)
    m.setU32((player + 0x70) >>> 0, player)
    UNITROOM_RefreshUnit113c(m, player)
    m.setU32((player + 0xc4) >>> 0, (m.u32((player + 0xc4) >>> 0) | 0x400) >>> 0)
  }
  return 0
}

/**
 * Sends S2C quest alert `0x5D` for quest `0x0D` (`ACT2Q6`) when quest `0x0E` flags indicate active/updated status.
 * @va D2Game:0x6FCE4D30
 */
export function ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE4D30)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  let shouldSend = false
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x00) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0f) === 0
  ) {
    shouldSend = true
  } else if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0x0e) !== 0
  ) {
    shouldSend = true
  }
  if (shouldSend) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x0d, player, game)
  }
  return 0
}

/**
 * Sends S2C quest alert `0x5D` for quest `0x0C` (`ACT2Q5`) when quest `0x0D` flags indicate active/updated status.
 * @va D2Game:0x6FCE4E30
 */
export function ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE4E30)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  let shouldSend = false
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x00) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0f) === 0
  ) {
    shouldSend = true
  } else if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0e) !== 0
  ) {
    shouldSend = true
  }
  if (shouldSend) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x0c, player, game)
  }
  return 0
}

/**
 * Adds ACT2Q4 (`0x0C`, Arcane Sanctuary) NPC dialog text nodes on NPC activation (including `0x14B` random lines `8..10` or `7`).
 * @va D2Game:0x6FCE4EA0
 */
export function ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE4EA0)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pPlayer0 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame0 = m.u32(arg) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0

  const pNpc = m.u32((arg + 0x08) >>> 0) >>> 0
  let nNpcClassId = 0xffffffff
  if (pNpc !== 0) {
    nNpcClassId = m.u32((pNpc + 0x04) >>> 0) >>> 0
    if ((nNpcClassId | 0) === 0x14b) {
      const pGame1 = m.u32((qd + 0x04) >>> 0) >>> 0
      const pQuestCtrl = m.u32((pGame1 + 0x10f4) >>> 0) >>> 0
      if (pQuestCtrl === 0) {
        throw new D2CommonAssertError('', 0x1fb)
      }
      const pQuestDataEx = m.u32((qd + 0x18) >>> 0) >>> 0
      const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
      if (m.u8((pQuestDataEx + 0x0e) >>> 0) !== 0) {
        const msgIdx = (rollUnitSeedLimited113c(m, (pQuestCtrl + 0x18) >>> 0, 3) + 8) | 0
        QUESTS_AddNpcDialogTextNodes113c(m, qd, msgIdx, pTextHeader, 0x14b)
        return
      }
      QUESTS_AddNpcDialogTextNodes113c(m, qd, 7, pTextHeader, 0x14b)
      return
    }
  }

  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 1) !== 0) {
    const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
    QUESTS_AddNpcDialogTextNodes113c(m, qd, 4, pTextHeader, nNpcClassId)
    return
  }

  const pPlayer1 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const dwGuid = pPlayer1 !== 0 ? m.u32((pPlayer1 + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const wGuidCount = m.u16((qd + 0x9c) >>> 0)
  for (let i = 0; i < wGuidCount; i++) {
    if ((m.u32((qd + 0x1c + (i << 2)) >>> 0) >>> 0) === dwGuid) {
      const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
      QUESTS_AddNpcDialogTextNodes113c(m, qd, 5, pTextHeader, nNpcClassId)
      return
    }
  }

  const nSeq0 = m.u8((qd + 0x0c) >>> 0)
  if (nSeq0 === 0) return
  if (m.u8((qd + 0x09) >>> 0) === 0) return
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0) | 0) === 1) return
  if (
    m.u8((qd + 0x0c) >>> 0) >= 5 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0x0d) === 0
  ) {
    return
  }
  const nSeq = m.u8((qd + 0x0c) >>> 0)
  const msgIdx = readDataTableU32_113c(m, 0x6fd24fd8, ACT2Q4_SEQ_MSG_TABLE_6FD24FD8, nSeq)
  if (msgIdx !== 0xffffffff && msgIdx < 0x0c) {
    const pTextHeader = m.u32((arg + 0x14) >>> 0) >>> 0
    QUESTS_AddNpcDialogTextNodes113c(m, qd, msgIdx | 0, pTextHeader, nNpcClassId)
  }
}

/**
 * Sends S2C quest alert `0x5D` for quest `0x0B` (`ACT2Q4`) when quest `0x0C` flags indicate active/updated status.
 * @va D2Game:0x6FCE5030
 */
export function ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE5030)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  let shouldSend = false
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0x00) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0x0f) === 0
  ) {
    shouldSend = true
  } else if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0x0e) !== 0
  ) {
    shouldSend = true
  }
  if (shouldSend) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x0b, player, game)
  }
  return 0
}

/**
 * Sets `wInteractType (+0x6E) = 0x34`, `pInteractUnit (+0x70) = pPlayer`, refreshes room, and sets `+0xC4 |= 0x400` when `(0x0B, 0x0D)` is set.
 * @va D2Game:0x6FCE5090
 */
export function ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE5090)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0d) !== 0) {
    if (player === 0) {
      throw new D2CommonAssertError('', 0x558)
    }
    m.setU16((player + 0x6e) >>> 0, 0x34)
    m.setU32((player + 0x70) >>> 0, player)
    UNITROOM_RefreshUnit113c(m, player)
    m.setU32((player + 0xc4) >>> 0, (m.u32((player + 0xc4) >>> 0) | 0x400) >>> 0)
  }
  return 0
}

/**
 * Queues 10-byte S2C darkness packet `0x53` (`[0x53, 2, 0, 0, 0, 0, 0, 0, 0, 0]`) to Act 2 (`nAct == 1`) client.
 * @va D2Game:0x6FCE5100
 */
export function ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE5100)
  const player = pPlayer >>> 0
  let pClient = 0
  if (player !== 0 && (m.u32(player) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  if (pClient === 0) {
    throw new D2CommonAssertError('', 0x7cb)
  }
  if (m.u8((pClient + 0x1ac) >>> 0) === 1) {
    const savedSp = k2W5B5StackPtr
    const pPacket = savedSp >>> 0
    k2W5B5StackPtr = (savedSp + 0x10) >>> 0
    try {
      m.fill(pPacket, 0x10, 0)
      m.setU8(pPacket, 0x53)
      m.setU32((pPacket + 0x01) >>> 0, 2)
      m.setU32((pPacket + 0x05) >>> 0, 0)
      m.setU8((pPacket + 0x09) >>> 0, 0)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket, 0x0a)
    } finally {
      k2W5B5StackPtr = savedSp
    }
  }
  return 0
}

/**
 * Queues 10-byte S2C sun-restore packet `0x53` (`[0x53, 5, 0, 0, 0, 0, 0, 0, 0, 1]`) and 6-byte alert `0x5D` (`[0x5D, 0x0A, 0x10, 0, 0, 0]`) to Act 2 client.
 * @va D2Game:0x6FCE5190
 */
export function ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE5190)
  const player = pPlayer >>> 0
  let pClient = 0
  if (player !== 0 && (m.u32(player) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  if (pClient === 0) {
    throw new D2CommonAssertError('', 0x7cb)
  }
  if (m.u8((pClient + 0x1ac) >>> 0) === 1) {
    const savedSp = k2W5B5StackPtr
    const pPacket53 = savedSp >>> 0
    const pPacket5D = (savedSp + 0x10) >>> 0
    k2W5B5StackPtr = (savedSp + 0x20) >>> 0
    try {
      m.fill(pPacket53, 0x20, 0)
      m.setU8(pPacket53, 0x53)
      m.setU32((pPacket53 + 0x01) >>> 0, 5)
      m.setU32((pPacket53 + 0x05) >>> 0, 0)
      m.setU8((pPacket53 + 0x09) >>> 0, 1)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket53, 0x0a)

      m.setU8(pPacket5D, 0x5d)
      m.setU8((pPacket5D + 0x01) >>> 0, 0x0a)
      m.setU8((pPacket5D + 0x02) >>> 0, 0x10)
      m.setU8((pPacket5D + 0x03) >>> 0, 0)
      m.setU16((pPacket5D + 0x04) >>> 0, 0)
      NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPacket5D, 0x06)
    } finally {
      k2W5B5StackPtr = savedSp
    }
  }
  return 0
}

/**
 * Sends S2C quest alert `0x5D` for quest `0x0A` (`ACT2Q3`) when quest `0x0B` flags indicate active/updated status.
 * @va D2Game:0x6FCE52B0
 */
export function ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE52B0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  let shouldSend = false
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x00) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0f) === 0
  ) {
    shouldSend = true
  } else if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0x0e) !== 0
  ) {
    shouldSend = true
  }
  if (shouldSend) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x0a, player, game)
  }
  return 0
}

/**
 * Increments quest `8` missing-Book-of-Skill (`'ass '`) counter when `(9, 5)` is set, and refreshes unit room (`+0x6E = 0x32`) when `(9, 0x0D)` is set.
 * @va D2Game:0x6FCE54A0
 */
export function ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE54A0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData0 = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff0 = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags0 = m.u32((pPlayerData0 + (nDiff0 << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags0, 9, 5) !== 0) {
    const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
    if (pQuestCtrl !== 0) {
      let pQuest = m.u32(pQuestCtrl) >>> 0
      while (pQuest !== 0) {
        if ((m.u32(pQuest) | 0) === 8) {
          if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, player, game, 0x20737361) === 0) {
            const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
            m.setU32((pQuestDataEx + 0x0c) >>> 0, (m.u32((pQuestDataEx + 0x0c) >>> 0) + 1) >>> 0)
          }
          break
        }
        pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
      }
    }
  }

  const pPlayerData1 = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff1 = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags1 = m.u32((pPlayerData1 + (nDiff1 << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags1, 9, 0x0d) !== 0) {
    if (player === 0) {
      throw new D2CommonAssertError('', 0x558)
    }
    m.setU16((player + 0x6e) >>> 0, 0x32)
    m.setU32((player + 0x70) >>> 0, player)
    UNITROOM_RefreshUnit113c(m, player)
    m.setU32((player + 0xc4) >>> 0, (m.u32((player + 0xc4) >>> 0) | 0x400) >>> 0)
  }
  return 0
}

/**
 * Sets ACT2Q1 (`9`) states `0x0D`, `1`, and `5` and sends packet `0x28` for each Act 2 player lacking `(9, 0)` and `(9, 1)`.
 * @va D2Game:0x6FCE55B0
 */
export function ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): void {
  hitD2GameVa113c(0x6FCE55B0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0) | 0) === 1) return
  if ((DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 1) | 0) === 1) return
  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  if ((DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff) !== 1) return
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 1)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 5)
  QUESTS_SendPlayerQuestLogPacket28_113c(m, player, game)
}

/**
 * Sends S2C quest alert `0x5D` for quest `0x08` (`ACT2Q1`) when quest `0x09` flags indicate active/updated status.
 * @va D2Game:0x6FCE5630
 */
export function ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FCE5630)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const nDiff = m.u8((game + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  let shouldSend = false
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0x00) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0x0f) === 0
  ) {
    shouldSend = true
  } else if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0x0d) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0x0e) !== 0
  ) {
    shouldSend = true
  }
  if (shouldSend) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 0x08, player, game)
  }
  return 0
}

/**
 * Updates ACT2Q2 (`pQuestData+0x0B`) and sends quest alert `9` when picking up `'tr1 '`, `'vip '`, `'box '`, or `'msf '`.
 * @va D2Game:0x6FCE5F30
 */
export function ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE5F30)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pItem = m.u32((arg + 0x08) >>> 0) >>> 0
  const nItemId = pItem !== 0 ? m.u32((pItem + 0x04) >>> 0) | 0 : -1
  const pItemsTxt = DATATBLS_GetItemsTxtRecordMemPort113c(m, nItemId) >>> 0
  const pGame0 = m.u32(arg) >>> 0
  const pPlayer0 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const nDiff = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  const hasState3 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 3) | 0

  m.setU8((qd + 0x14) >>> 0, 0)
  const pPlayer1 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pRoom = UNITS_GetRoom113c(m, pPlayer1) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const nAct = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (m.u8((qd + 0x08) >>> 0) === nAct) {
    ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c(
      m,
      m.u32((arg + 0x0c) >>> 0) >>> 0,
      m.u32(arg) >>> 0,
    )
  }

  const dwCode = m.u32((pItemsTxt + 0x80) >>> 0) >>> 0
  if (dwCode === 0x20317274 && hasState3 === 0) {
    m.setU8((qd + 0x0b) >>> 0, 1)
  } else if (
    dwCode === 0x20706976 ||
    dwCode === 0x20786f62 ||
    dwCode === 0x2066736d
  ) {
    m.setU8((qd + 0x0b) >>> 0, hasState3 !== 0 ? 2 : 6)
  } else {
    return
  }

  const pPlayer2 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame2 = m.u32((qd + 0x04) >>> 0) >>> 0
  if (ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c(m, pPlayer2, pGame2) !== 0) {
    QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 9, pPlayer2, pGame2)
  }
}

/**
 * Object operate handler for the Horadric Orifice (`ACT2Q6`, quest `0x0D`): opens Orifice UI (`0x58`) when player holds `'hst '`.
 * @va D2Game:0x6FCE6240
 */
export function ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c(
  m: D2KernMemory113c,
  pOpParam: number,
  _nObjId = 0,
): number {
  hitD2GameVa113c(0x6FCE6240)
  const op = pOpParam >>> 0
  const pGame = m.u32(op) >>> 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return 0

  const pPlayer0 = m.u32((op + 0x08) >>> 0) >>> 0
  let pPrevTarget = 0
  if (m.u8((pPlayer0 + 0x6c) >>> 0) !== 0) {
    pPrevTarget = SUNIT_GetServerUnit113c(
      m,
      pGame,
      m.u32((pPlayer0 + 0x68) >>> 0) | 0,
      m.u32((pPlayer0 + 0x64) >>> 0) >>> 0,
    ) >>> 0
  }

  const pPlayer1 = m.u32((op + 0x08) >>> 0) >>> 0
  let pClient = 0
  if (pPlayer1 !== 0 && (m.u32(pPlayer1) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer1) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const pObject = m.u32((op + 0x04) >>> 0) >>> 0
  const nObjMode = pObject !== 0 ? m.u32((pObject + 0x10) >>> 0) | 0 : 0
  if (nObjMode === 0) {
    const pPlr = m.u32((op + 0x08) >>> 0) >>> 0
    if ((PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlr) | 0) === 1) {
      return 1
    }
    if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlr, m.u32(op) >>> 0, 0x20747368) === 0) {
      const pPlrSnd = m.u32((op + 0x08) >>> 0) >>> 0
      SUNIT_SetUnitEventSound113c(m, pPlrSnd, 0x13, pPlrSnd)
      return 1
    }
    const pObj0 = m.u32((op + 0x04) >>> 0) >>> 0
    const dwObjGuid0 = pObj0 !== 0 ? m.u32((pObj0 + 0x0c) >>> 0) >>> 0 : 0xffffffff
    SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, m.u32((op + 0x08) >>> 0) >>> 0, 2, dwObjGuid0)
    UNITS_ChangeAnimMode113c(m, m.u32((op + 0x04) >>> 0) >>> 0, 1)
    const pObj1 = m.u32((op + 0x04) >>> 0) >>> 0
    const dwObjGuid1 = pObj1 !== 0 ? m.u32((pObj1 + 0x0c) >>> 0) >>> 0 : 0xffffffff

    const savedSp = k2W5B5StackPtr
    const pPacket58 = savedSp >>> 0
    k2W5B5StackPtr = (savedSp + 0x10) >>> 0
    try {
      m.fill(pPacket58, 0x10, 0)
      m.setU8(pPacket58, 0x58)
      m.setU32((pPacket58 + 0x01) >>> 0, dwObjGuid1)
      m.setU8((pPacket58 + 0x05) >>> 0, 0)
      if (isFrameS2CTraceActive113c()) {
        // 0x6FCE6356..0x6FCE6373 never writes buf[6]; live D2Game.dll stack leaves 0x87 here.
        m.setU8((pPacket58 + 0x06) >>> 0, 0x87)
      }
      NET_SendPacketBuffer7B_6FCAAB20_113c(m, pPacket58, pClient)
    } finally {
      k2W5B5StackPtr = savedSp
    }
    return 0
  }

  if (nObjMode === 1 && pPrevTarget === pObject) {
    const pPlr = m.u32((op + 0x08) >>> 0) >>> 0
    m.setU32((pPlr + 0x64) >>> 0, 0xffffffff)
    m.setU32((pPlr + 0x68) >>> 0, 6)
    m.setU8((pPlr + 0x6c) >>> 0, 0)
    UNITS_ChangeAnimMode113c(m, m.u32((op + 0x04) >>> 0) >>> 0, 2)
  }
  return 0
}

/**
 * Spawns Jerhyn (`0xC9`) near `pQuestArg` coordinates (`+0x14`, `+0x18`) in `pQuestArg->pRoom (+0x08)` if ACT2Q0/Q2/Q4 gates allow.
 * @va D2Game:0x6FCE7C20
 */
export function ACT2Q0_SpawnJerhynAtPalaceEntrance_6FCE7C20_113c(
  m: D2KernMemory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE7C20)
  const qd = pQuestData >>> 0
  const arg = pQuestArg >>> 0
  const pQuestDataEx = m.u32((qd + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x0d) >>> 0) !== 0) return

  const pGame0 = m.u32((qd + 0x04) >>> 0) >>> 0
  const pQuestCtrl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  if (m.u32((pQuestCtrl + 0x08) >>> 0) === 0) {
    throw new D2CommonAssertError('', 0x82c)
  }
  const pGlobalFlags = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pGlobalFlags, 8, 0x0d) !== 0) return
  if (QUESTS_CheckGlobalQuestState_6FC538D0_113c(m, m.u32((qd + 0x04) >>> 0) >>> 0, 0x0c, 0x0d) !== 0) {
    return
  }
  if ((ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, m.u32((qd + 0x04) >>> 0) >>> 0) & 0xff) !== 0) {
    return
  }

  const savedSp = k2W5B5StackPtr
  const pCoord = savedSp >>> 0
  const ppOutRoom = (savedSp + 0x08) >>> 0
  k2W5B5StackPtr = (savedSp + 0x10) >>> 0
  try {
    const pRoom = m.u32((arg + 0x08) >>> 0) >>> 0
    m.setU32(pCoord, m.u32((arg + 0x14) >>> 0) >>> 0)
    m.setU32((pCoord + 0x04) >>> 0, m.u32((arg + 0x18) >>> 0) >>> 0)
    m.setU32(ppOutRoom, pRoom)
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, pRoom, pCoord, 2, 0x100, ppOutRoom, 0x64)
    const pJerhyn = MONSTER_SpawnAtCoords113c(
      m,
      0xc9,
      1,
      m.u32((qd + 0x04) >>> 0) >>> 0,
      m.u32(ppOutRoom) >>> 0,
      m.u32(pCoord) | 0,
      m.u32((pCoord + 0x04) >>> 0) | 0,
      -1,
      0,
    ) >>> 0
    if (pJerhyn !== 0) {
      m.setU8((pQuestDataEx + 0x0c) >>> 0, 1)
      m.setU32((pQuestDataEx + 0x3c) >>> 0, m.u32((pJerhyn + 0x0c) >>> 0) >>> 0)
    }
  } finally {
    k2W5B5StackPtr = savedSp
  }
}

/**
 * Finds and populates the Lut Gholein (`0x28`, portal type `0x0C`) return portal position for ACT2Q6 (`0x0D`) when `+0x3C == 1`.
 * @va D2Game:0x6FCE7FB0
 */
export function ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pOutCoord: number,
  ppOutRoom: number,
): number {
  hitD2GameVa113c(0x6FCE7FB0)
  const game = pGame >>> 0
  const outCoord = pOutCoord >>> 0
  const outRoomPtr = ppOutRoom >>> 0
  const pQuestCtrl = m.u32((game + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x3c) >>> 0) !== 1) return 0

  const savedSp = k2W5B5StackPtr
  const pOutX = savedSp >>> 0
  const pOutY = (savedSp + 0x04) >>> 0
  k2W5B5StackPtr = (savedSp + 0x08) >>> 0
  try {
    m.fill(pOutX, 8, 0)
    const pAct1 = m.u32((game + 0xc0) >>> 0) >>> 0
    const pRoom = DUNGEON_FindFreeSpawnPositionInLevel113c(m, pAct1, 0x28, 0x0c, pOutX, pOutY, 3) >>> 0
    if (pRoom === 0) return 0
    DRLG_PopulateSingleRoom_6FC4CB80_113c(m, pRoom, game)
    const pFreeRoom = COLLISION_FindFreePositionWithStep113c(m, pRoom, outCoord, 3, 0xbe11, 7) >>> 0
    if (pFreeRoom === 0) return 0
    m.setU32(outCoord, m.u32(pOutX) >>> 0)
    m.setU32((outCoord + 0x04) >>> 0, m.u32(pOutY) >>> 0)
    m.setU32(outRoomPtr, pFreeRoom)
    return 1
  } finally {
    k2W5B5StackPtr = savedSp
  }
}

/**
 * Despawns outside Jerhyn (`+0x0C == 1`) if not conversing and respawns Jerhyn (`0xC9`) inside/outside Palace (`+0x0D = 1`).
 * @va D2Game:0x6FCE8FD0
 */
export function ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c(
  m: D2KernMemory113c,
  pIoCoord: number,
  pQuestData: number,
  pRoom: number,
): void {
  hitD2GameVa113c(0x6FCE8FD0)
  const ioCoord = pIoCoord >>> 0
  const qd = pQuestData >>> 0
  const room = pRoom >>> 0
  let pQuestDataEx = m.u32((qd + 0x18) >>> 0) >>> 0

  if (m.u8((pQuestDataEx + 0x0c) >>> 0) === 1) {
    const pGame = m.u32((qd + 0x04) >>> 0) >>> 0
    if (pGame === 0) {
      throw new D2CommonAssertError('', 0x2d3)
    }
    const dwGuid = m.u32((pQuestDataEx + 0x3c) >>> 0) >>> 0
    let pMon = m.u32((pGame + 0x1320 + ((dwGuid & 0x7f) << 2)) >>> 0) >>> 0
    while (pMon !== 0 && (m.u32((pMon + 0x0c) >>> 0) >>> 0) !== dwGuid) {
      pMon = m.u32((pMon + 0xe4) >>> 0) >>> 0
    }
    if (pMon !== 0) {
      let pInteractListPtr = 0
      if ((m.u32(pMon) | 0) === 1) {
        const pMonData = m.u32((pMon + 0x14) >>> 0) >>> 0
        if (pMonData !== 0) {
          pInteractListPtr = m.u32((pMonData + 0x30) >>> 0) >>> 0
        }
      }
      let pNode = m.u32(pInteractListPtr) >>> 0
      while (pNode !== 0) {
        if ((m.u32(pNode) | 0) !== 0) {
          MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(m, pGame, pMon, 0)
          return
        }
        pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
      }
      CLIENTS_ForEachInGameClient113c(
        m,
        pGame,
        0x6fc4a9f0,
        pMon,
        CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c,
      )
      SUNIT_FreeUnit113c(m, pGame, pMon)
      m.setU8((pQuestDataEx + 0x0c) >>> 0, 0)
    }
  }

  if (m.u8((pQuestDataEx + 0x0d) >>> 0) === 1) return
  const pastState01 = ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, m.u32((qd + 0x04) >>> 0) >>> 0) & 0xff
  const nextX = (m.u32(ioCoord) + (pastState01 !== 0 ? 0x0f : -10)) | 0
  const nextY = (m.u32((ioCoord + 0x04) >>> 0) - 3) | 0
  m.setU32((ioCoord + 0x04) >>> 0, nextY >>> 0)
  m.setU32(ioCoord, nextX >>> 0)
  const pSubRoom = ROOM_FindRoomContainingSubtile113c(m, room, nextX, nextY) >>> 0

  const savedSp = k2W5B5StackPtr
  const ppSpawnRoom = savedSp >>> 0
  const pSpawnArgs = (savedSp + 0x08) >>> 0
  k2W5B5StackPtr = (savedSp + 0x30) >>> 0
  try {
    m.fill(savedSp, 0x30, 0)
    m.setU32(ppSpawnRoom, pSubRoom)
    QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, room, ioCoord, 3, 0x100, ppSpawnRoom, 0x64)
    const pGame = m.u32((qd + 0x04) >>> 0) >>> 0
    const spawnRoom = m.u32(ppSpawnRoom) >>> 0
    const spawnX = m.u32(ioCoord) >>> 0
    const spawnY = m.u32((ioCoord + 0x04) >>> 0) >>> 0

    m.setU32(pSpawnArgs, pGame)
    m.setU32((pSpawnArgs + 0x04) >>> 0, spawnRoom)
    m.setU32((pSpawnArgs + 0x08) >>> 0, 0)
    m.setU32((pSpawnArgs + 0x0c) >>> 0, 0xc9)
    m.setU32((pSpawnArgs + 0x10) >>> 0, 1)
    m.setU32((pSpawnArgs + 0x14) >>> 0, 0)
    m.setU32((pSpawnArgs + 0x18) >>> 0, spawnX)
    m.setU32((pSpawnArgs + 0x1c) >>> 0, spawnY)
    m.setU32((pSpawnArgs + 0x20) >>> 0, 0xffffffff)
    m.setU16((pSpawnArgs + 0x24) >>> 0, 0)

    let pSpawned = MONSTER_Create113c(m, pSpawnArgs) >>> 0
    if (pSpawned === 0) {
      pSpawned = MONSTER_SpawnAtCoords113c(
        m,
        0xc9,
        1,
        pGame,
        spawnRoom,
        spawnX | 0,
        spawnY | 0,
        2,
        0,
      ) >>> 0
      if (pSpawned === 0) return
    }
    m.setU32((pSpawned + 0xc4) >>> 0, (m.u32((pSpawned + 0xc4) >>> 0) | 0x03000000) >>> 0)
    pQuestDataEx = m.u32((qd + 0x18) >>> 0) >>> 0
    const bFirstPos = m.u8((pQuestDataEx + 0x15) >>> 0) === 0
    m.setU8((pQuestDataEx + 0x0d) >>> 0, 1)
    if (bFirstPos) {
      m.setU8((pQuestDataEx + 0x15) >>> 0, 1)
      m.setU32((pQuestDataEx + 0x28) >>> 0, m.u32(ioCoord) >>> 0)
      m.setU32((pQuestDataEx + 0x2c) >>> 0, m.u32((ioCoord + 0x04) >>> 0) >>> 0)
    }
  } finally {
    k2W5B5StackPtr = savedSp
  }
}

/**
 * Initializes Arcane Sanctuary (`0x4A`) / Palace Cellar 3 (`0x36`) portal object anim mode for ACT2Q4 (`0x0B`) and schedules event `1`.
 * @va D2Game:0x6FCE99B0
 */
export function ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c(
  m: D2KernMemory113c,
  pObjInitParam: number,
): void {
  hitD2GameVa113c(0x6FCE99B0)
  const init = pObjInitParam >>> 0
  const pGame0 = m.u32(init) >>> 0
  const pQuestCtrl = m.u32((pGame0 + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  let pQuest = m.u32(pQuestCtrl) >>> 0
  while (pQuest !== 0 && (m.u32(pQuest) | 0) !== 0x0b) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  if (pQuest === 0) return

  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, m.u32((init + 0x08) >>> 0) >>> 0) | 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (nLevelId === 0x4a) {
    UNITS_ChangeAnimMode113c(m, m.u32((init + 0x04) >>> 0) >>> 0, m.u16((pQuestDataEx + 0x42) >>> 0))
    if (m.u16((pQuestDataEx + 0x42) >>> 0) !== 1) return
    m.setU16((pQuestDataEx + 0x42) >>> 0, 2)
  } else if (nLevelId === 0x36) {
    UNITS_ChangeAnimMode113c(m, m.u32((init + 0x04) >>> 0) >>> 0, m.u16((pQuestDataEx + 0x44) >>> 0))
    if (m.u16((pQuestDataEx + 0x44) >>> 0) !== 1) return
    m.setU16((pQuestDataEx + 0x44) >>> 0, 2)
  } else {
    return
  }

  const pObj = m.u32((init + 0x04) >>> 0) >>> 0
  const nObjClassId = pObj !== 0 ? m.u32((pObj + 0x04) >>> 0) | 0 : -1
  const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjClassId) >>> 0
  const dwFrames = (m.u32((pObjTxt + 0xdc) >>> 0) >>> 8) >>> 0
  const pGame = m.u32(init) >>> 0
  const nFrame = (dwFrames + m.u32((pGame + 0xa8) >>> 0) + 1) >>> 0
  EVENT_SetEventFull113c(m, pGame, m.u32((init + 0x04) >>> 0) >>> 0, 1, nFrame, 0, 0, 0)
}

/**
 * Updates `pMonsterData->nMonRegAct (+0x58)` and decrements `D2MonsterRegionStrc` total/unique counts (`+0x2CC`, `+0x2C8`).
 * @va D2Game:0x6FCEA410
 */
export function MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c(
  m: D2KernMemory113c,
  ppMonsterRegion: number,
  nDstRegion: number,
  bSkipDec: number,
  nSrcRegion: number,
  nArg2: number,
  nArg3: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FCEA410)
  const ppReg = ppMonsterRegion >>> 0
  const pDstReg = m.u32((ppReg + ((nDstRegion | 0) << 2)) >>> 0) >>> 0
  const pSrcReg = m.u32((ppReg + ((nSrcRegion | 0) << 2)) >>> 0) >>> 0
  const u = pUnit >>> 0
  if (u !== 0) {
    if (pSrcReg !== pDstReg && (m.u32(u) | 0) === 1) {
      const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
      if (pMonData !== 0) {
        m.setU32((pMonData + 0x58) >>> 0, nDstRegion >>> 0)
      }
    }
    if ((bSkipDec | 0) === 0 && UNIT_GetAlignment113c(m, u) === 0) {
      m.setU32((pSrcReg + 0x2cc) >>> 0, (m.u32((pSrcReg + 0x2cc) >>> 0) - 1) >>> 0)
      if ((m.u32(u) | 0) === 1) {
        const pMonData = m.u32((u + 0x14) >>> 0) >>> 0
        if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 1) !== 0) {
          m.setU32((pSrcReg + 0x2c8) >>> 0, (m.u32((pSrcReg + 0x2c8) >>> 0) - 1) >>> 0)
        }
      }
    }
    return
  }
  if ((bSkipDec | 0) === 0 && (nArg3 | 0) === 0 && (nArg2 | 0) === 0) {
    m.setU32((pDstReg + 0x2cc) >>> 0, (m.u32((pDstReg + 0x2cc) >>> 0) - 1) >>> 0)
  }
}

/**
 * C2S packet `0x3B` handler: validates `nPacketLen == 3` and `wNpcId < nMonStatsCount`, then clears player NPC intro flag.
 * @va D2Game:0x6FCEB4A0
 */
export function PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEB4A0)
  if ((nPacketLen | 0) !== 3) return 3
  const pkt = pPacket >>> 0
  const wNpcId = m.u16((pkt + 0x01) >>> 0)
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  const nMonStatsCount = m.u32((pDataTables + 0xa80) >>> 0) | 0
  if ((wNpcId | 0) >= nMonStatsCount) return 2
  QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c(m, pPlayer >>> 0, wNpcId, pGame >>> 0)
  return 0
}

/**
 * Fastcall wrapper (`ecx = pClient`, `edx = pChatMsg`) forwarding to `NET_SendPacket26_ChatMessage_6FCAB470_113c`.
 * @va D2Game:0x6FCEB580
 */
export function NET_SendChatMessagePacket26Wrapper_6FCEB580_113c(
  m: D2KernMemory113c,
  pClient: number,
  pChatMsg: number,
): number {
  hitD2GameVa113c(0x6FCEB580)
  return NET_SendPacket26_ChatMessage_6FCAB470_113c(m, pChatMsg >>> 0, pClient >>> 0)
}

/**
 * Validates whether `pUnit` (`edi`) can allocate a skill point into `nSkillId` (`esi`), returning `0` (ok), `2` (range), or `3` (ineligible).
 * @va D2Game:0x6FCEB610
 */
export function SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c(
  m: D2KernMemory113c,
  nSkillId: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCEB610)
  const sk = nSkillId | 0
  const u = pUnit >>> 0
  if (sk < 0) return 2
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  const nSkillsTxtCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  if (sk >= nSkillsTxtCount) return 2
  if (SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c(m, sk, u) === 0) {
    return 3
  }
  if (SKILLS_CheckSkillLevelAndPrereqs113c(m, u, sk) === 0) {
    return 3
  }
  return SKILLS_CanUnitAllocateSkillPoint113c(m, u, sk) !== 0 ? 0 : 3
}

/**
 * Computes projected mana percentage (`0..100`) at the end of `STATE_SHRINEMANA` (`0x6A`) on `pUnit` (`eax`).
 * @va D2Game:0x6FCEB720
 */
export function PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCEB720)
  const u = pUnit >>> 0
  const curMana = STATLIST_GetUnitStat113c(m, u, 8, 0) | 0
  const maxMana = STATLIST_GetMaxManaFromUnit113c(m, u) | 0
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, u, 0x6a) >>> 0
  if (pStatList === 0 || maxMana === 0 || u === 0) return 0

  const nClass = m.u32((u + 0x04) >>> 0) | 0
  if (nClass < 0) return 0
  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  const nCharStatsCount = m.u32((pDataTables + 0xbc8) >>> 0) | 0
  if (nClass >= nCharStatsCount) return 0
  const pCharStatsBase = m.u32((pDataTables + 0xbc4) >>> 0) >>> 0
  const pCharTxt = (pCharStatsBase + Math.imul(nClass, 0xc4)) >>> 0
  if (pCharTxt === 0) return 0

  let regenFrames = Math.imul(m.u8((pCharTxt + 0x3a) >>> 0), 0x19)
  if (regenFrames === 0) {
    regenFrames = 0x1d4c
  }
  const baseRate = Math.trunc(maxMana / regenFrames) | 0
  const clampedRate = baseRate < 1 ? 1 : baseRate

  const manaRecoveryBonus = STATLIST_GetUnitStat113c(m, u, 0x1b, 0) | 0
  const manaRecoveryFlat = STATLIST_GetUnitStat113c(m, u, 0x1a, 0) | 0
  const scaledRate = Math.imul((manaRecoveryBonus + 100) | 0, clampedRate)
  const ratePerFrame = (Math.trunc(scaledRate / 100) + manaRecoveryFlat) | 0

  const pGame = D2GAME_SUNIT_GetGameFromUnit113c(m, u) >>> 0
  const expireFrame = STATLIST_GetExpireFrameEx113c(m, pStatList) | 0
  const curFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const remFrames = (expireFrame - curFrame) | 0
  const projectedMana = (Math.imul(remFrames, ratePerFrame) + curMana) | 0
  const pct = Math.trunc(Math.imul(projectedMana, 100) / maxMana) | 0
  const al = pct & 0xff
  return al > 0x64 ? 0x64 : al
}

/**
 * Computes projected life percentage (`0..100`) at the end of `STATE_HEALTHPOT` (`0x64`) on `pUnit` (`eax`).
 * @va D2Game:0x6FCEB840
 */
export function PLAYER_CalcHealingPotionPercent_6FCEB840_113c(
  m: D2KernMemory113c,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FCEB840)
  const u = pUnit >>> 0
  const curHp = STATLIST_GetUnitStat113c(m, u, 6, 0) | 0
  const maxHpShifted = (STATLIST_GetMaxLifeFromUnit113c(m, u) | 0) >> 8
  const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, u, 0x64) >>> 0
  if (pStatList === 0 || maxHpShifted === 0) return 0
  if (u === 0) {
    throw new D2CommonAssertError('', 0xa2a)
  }

  const pGame = m.u32((u + 0x80) >>> 0) >>> 0
  const expireFrame = STATLIST_GetExpireFrameEx113c(m, pStatList) | 0
  const curFrame = m.u32((pGame + 0xa8) >>> 0) | 0
  const remFrames = (expireFrame - curFrame) | 0
  const hpRegen = STATLIST_GetStatValue113c(m, pStatList, 0x4a, 0) | 0
  const projectedHpShifted = ((Math.imul(hpRegen, remFrames) + curHp) | 0) >> 8
  const pct = Math.trunc(Math.imul(projectedHpShifted, 100) / maxHpShifted) | 0
  const al = pct & 0xff
  return al > 0x64 ? 0x64 : al
}

function sstrLen113c(m: D2KernMemory113c, pStr: number): number {
  const s = pStr >>> 0
  if (s === 0) return 0
  let n = 0
  while (m.u8((s + n) >>> 0) !== 0) {
    n++
  }
  return n
}

function sstrCopy113c(m: D2KernMemory113c, pDst: number, pSrc: number, maxLen: number): void {
  const dst = pDst >>> 0
  const src = pSrc >>> 0
  const cap = maxLen | 0
  if (dst === 0 || cap <= 0) return
  if (src === 0) {
    m.setU8(dst, 0)
    return
  }
  let i = 0
  const limit = cap - 1
  while (i < limit) {
    const ch = m.u8((src + i) >>> 0)
    if (ch === 0) break
    m.setU8((dst + i) >>> 0, ch)
    i++
  }
  m.setU8((dst + i) >>> 0, 0)
}

/**
 * C2S packet `0x3C` handler: validates `nPacketLen == 9`, skill slot `0..15`, and skill ownership, then binds hotkey slot.
 * @va D2Game:0x6FCEBC70
 */
export function PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c(
  m: D2KernMemory113c,
  _pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEBC70)
  if ((nPacketLen | 0) !== 9) return 3
  const pkt = pPacket >>> 0
  const player = pPlayer >>> 0
  const dwItemGuid = m.u32((pkt + 0x05) >>> 0) >>> 0
  const dwRaw = m.u32((pkt + 0x01) >>> 0) >>> 0
  const nSlot = (dwRaw >>> 16) | 0
  if (nSlot < 0 || nSlot >= 0x10) return 3

  const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
  const nSkillsTxtCount = m.u32((pDataTables + 0xba0) >>> 0) | 0
  let wSkillId = dwRaw & 0x7fff
  if ((wSkillId | 0) > nSkillsTxtCount) {
    wSkillId = -1
  } else if (wSkillId !== -1) {
    if ((wSkillId | 0) < 0 || (wSkillId | 0) >= nSkillsTxtCount) return 3
    if (SKILLS_GetSkillById113c(m, player, wSkillId, dwItemGuid) === 0) {
      return 3
    }
  }

  const bLeftHand = (dwRaw >>> 15) & 1
  const ok = PLAYER_SetClientSkillHotkeySlot113c(m, player, nSlot, wSkillId, bLeftHand, dwItemGuid) | 0
  return ok !== 0 ? 0 : 3
}

/**
 * C2S packet `0x40` handler: validates `nPacketLen == 1` and sends quest log packets `0x50` and `0x52`.
 * @va D2Game:0x6FCEBD30
 */
export function PACKET_Srv40_RequestQuestLog_6FCEBD30_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  _pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEBD30)
  if ((nPacketLen | 0) !== 1) return 3
  QUESTS_SendQuestLogPackets50And52_6FC55640_113c(m, pGame >>> 0, pPlayer >>> 0)
  return 0
}

/**
 * Builds and broadcasts the `0x28`-byte `0x5A` (`EVENT_SLAIN = 6`) notification when `pVictimPlayer` (`eax`) is slain by `pKillerUnit` (`ecx`).
 * @va D2Game:0x6FCEC370
 */
export function PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c(
  m: D2KernMemory113c,
  pVictimPlayer: number,
  pKillerUnit: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCEC370)
  const victim = pVictimPlayer >>> 0
  const game = pGame >>> 0
  if (victim === 0 || (m.u32(victim) | 0) !== 0) {
    throw new D2CommonAssertError('', 0x190b)
  }

  let killer = pKillerUnit >>> 0
  if (killer !== 0 && (m.u32(killer) | 0) === 1) {
    const pLeader = AIGENERAL_GetPackLeaderUnit113c(m, killer) >>> 0
    if (pLeader !== 0 && (m.u32(pLeader) | 0) === 0) {
      killer = pLeader
    }
  }

  const savedSp = k2W5B5StackPtr
  const pTmpName = savedSp >>> 0
  const pPkt5A = (savedSp + 0x10) >>> 0
  k2W5B5StackPtr = (savedSp + 0x38) >>> 0
  try {
    m.fill(savedSp, 0x38, 0)
    m.setU8(pPkt5A, 0x5a)
    m.setU8((pPkt5A + 0x01) >>> 0, 0x06)
    m.setU8((pPkt5A + 0x02) >>> 0, 0x04)
    const dwKillerClass = killer !== 0 ? m.u32((killer + 0x04) >>> 0) >>> 0 : 0xffffffff
    m.setU32((pPkt5A + 0x03) >>> 0, dwKillerClass)
    const nKillerType = killer !== 0 ? m.u32(killer) | 0 : 6
    m.setU8((pPkt5A + 0x07) >>> 0, nKillerType & 0xff)
    m.setU8((pPkt5A + 0x18) >>> 0, 0)

    if ((m.u32(victim) | 0) !== 0) {
      throw new D2CommonAssertError('', 0x9d9)
    }
    const pVictimData = UNITS_GetPlayerData113c(m, victim) >>> 0
    const pVictimClient = m.u32((pVictimData + 0x9c) >>> 0) >>> 0
    if (pVictimClient === 0) {
      throw new D2CommonAssertError('', 0x9d9)
    }
    const pVictimName = (pVictimClient + 0x0d) >>> 0
    if (sstrLen113c(m, pVictimName) !== 0) {
      sstrCopy113c(m, (pPkt5A + 0x08) >>> 0, pVictimName, 0x10)
    } else {
      m.setU8((pPkt5A + 0x08) >>> 0, 0)
    }

    const dispatchType = killer !== 0 ? m.u32(killer) | 0 : 6
    if (dispatchType === 0) {
      if (killer === 0 || (m.u32(killer) | 0) !== 0) {
        throw new D2CommonAssertError('', 0x9d9)
      }
      const pKillerData = UNITS_GetPlayerData113c(m, killer) >>> 0
      const pKillerClient = m.u32((pKillerData + 0x9c) >>> 0) >>> 0
      if (pKillerClient === 0) {
        throw new D2CommonAssertError('', 0x9d9)
      }
      sstrCopy113c(m, pTmpName, (pKillerClient + 0x0d) >>> 0, 0x10)
      if (sstrLen113c(m, pTmpName) !== 0) {
        sstrCopy113c(m, (pPkt5A + 0x18) >>> 0, pTmpName, 0x10)
      }
      D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(m, pPkt5A, game)
      return
    }

    if (dispatchType === 1 && killer !== 0 && (m.u32(killer) | 0) === 1) {
      const pMonData = m.u32((killer + 0x14) >>> 0) >>> 0
      if (pMonData !== 0 && (m.u8((pMonData + 0x16) >>> 0) & 2) !== 0) {
        const wBossNameId = m.u16((pMonData + 0x26) >>> 0)
        m.setU16((pPkt5A + 0x18) >>> 0, wBossNameId)
        D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(m, pPkt5A, game)
        return
      }
    }

    D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c(m, pPkt5A, game)
  } finally {
    k2W5B5StackPtr = savedSp
  }
}

/**
 * Verifies `dwMercGuid` (`eax`) is `pPlayer`'s active `PETTYPE_HIRE (7)` monster in `pGame` (`ecx`), flushes AI commands, queues `(nCmdType, nX, nY)`, and sets sound `0x0F`.
 * @va D2Game:0x6FCEC750
 */
export function PLAYER_IssueMercAiMoveCommand_6FCEC750_113c(
  m: D2KernMemory113c,
  pGame: number,
  dwMercGuid: number,
  pPlayer: number,
  nX: number,
  nY: number,
  nCmdType: number,
): number {
  hitD2GameVa113c(0x6FCEC750)
  const game = pGame >>> 0
  if (game === 0) {
    throw new D2CommonAssertError('', 0x2d3)
  }
  const targetGuid = dwMercGuid >>> 0
  let pMerc = m.u32((game + 0x1320 + ((targetGuid & 0x7f) << 2)) >>> 0) >>> 0
  while (pMerc !== 0 && (m.u32((pMerc + 0x0c) >>> 0) >>> 0) !== targetGuid) {
    pMerc = m.u32((pMerc + 0xe4) >>> 0) >>> 0
  }
  if (pMerc === 0) return 1

  const player = pPlayer >>> 0
  let pOwnedHire = 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  if (pPlayerData !== 0) {
    const pDataTables = m.u32(m.u32(0x6fd1829c) >>> 0) >>> 0
    if ((m.u32((pDataTables + 0xbf0) >>> 0) | 0) > 7) {
      const pPetTable = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
      if (pPetTable !== 0) {
        const pPetArray = m.u32(pPetTable) >>> 0
        const pHireSlot = (pPetArray + 0x54) >>> 0
        if (pHireSlot !== 0) {
          let pPetNode = m.u32(pHireSlot) >>> 0
          while (pPetNode !== 0 && (m.u8(pPetNode) & 1) !== 0) {
            pPetNode = m.u32((pPetNode + 0x14) >>> 0) >>> 0
          }
          if (pPetNode !== 0) {
            const dwHireGuid = m.u32((pPetNode + 0x04) >>> 0) >>> 0
            let pScan = m.u32((game + 0x1320 + ((dwHireGuid & 0x7f) << 2)) >>> 0) >>> 0
            while (pScan !== 0 && (m.u32((pScan + 0x0c) >>> 0) >>> 0) !== dwHireGuid) {
              pScan = m.u32((pScan + 0xe4) >>> 0) >>> 0
            }
            pOwnedHire = pScan
          }
        }
      }
    }
  }

  if (pOwnedHire !== pMerc) return 1

  AIGENERAL_FlushAllAiCommands113c(m, game, pMerc)
  AIGENERAL_CopyAiCommandParams113c(m, pMerc, nCmdType >>> 0, nX >>> 0, nY >>> 0, 0, 0)
  SUNIT_SetUnitEventSound113c(m, pMerc, 0x0f, player)
  return 0
}

/**
 * C2S packet `0x2F` handler: validates `nPacketLen == 9` and triggers quest scroll callback `0x0B` (`QUESTS_TriggerCallback0B_6FC55C90_113c`).
 * @va D2Game:0x6FCEC9D0
 */
export function PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c(
  m: D2KernMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEC9D0)
  if ((nPacketLen | 0) !== 9) return 3
  const pkt = pPacket >>> 0
  const wMessageId = m.u16((pkt + 0x05) >>> 0)
  const dwTargetGuid = m.u32((pkt + 0x01) >>> 0) >>> 0
  QUESTS_TriggerCallback0B_6FC55C90_113c(m, pGame >>> 0, dwTargetGuid, pPlayer >>> 0, wMessageId)
  return 0
}
