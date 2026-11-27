/**
 * D2Game.dll 1.13c — Milestone 33 [K2] Wave 9 Batch 2 (w9b2).
 *
 * Clean-room 1:1 binary-isomorphic port of 15 D2Game.dll v1.13c functions in
 * the 0x6FCE6CA0..0x6FD110F0 address range.
 */

import { UNITS_GetPlayerData113c } from '../common/composit'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg'
import {
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_GetLevelIdFromRoom113c,
} from '../common/dungeon'
import { D2CommonAssertError } from '../common/inline-helpers'
import {
  INVENTORY_AppendItemGuidNode113c,
  INVENTORY_AutoPlaceItemInBelt113c,
  INVENTORY_CanAutoEquipItem113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_PlaceItemInSocket113c,
  INVENTORY_SetCursorItem113c,
} from '../common/inventory'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_B043_GetMaxDurabilityFromUnit113c,
  ITEMS_CanItemBeAutoBeltOrStacked113c,
  ITEMS_CanItemLoseDurability113c,
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckRequirements113c,
  ITEMS_GetInvWidthFromItem113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetTotalMaxStack113c,
  ITEMS_GetTwoHandedFlag113c,
  ITEMS_IsBeltable113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemFlag113c,
} from '../common/items'
import { PATH_GetPosX113c, PATH_GetPosY113c } from '../common/path'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record'
import { STATLIST_GetUnitStat113c } from '../common/statlist'
import {
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNITS_SetUnitUpdateFlags113c,
} from '../common/unit'
import type { SparseMemory113c } from '../mem/sparse-memory'
import { DATATBLS_GetItemsTxtRecordByCode113c } from '../tables/datatbls-113c'
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c'
import {
  D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c,
  D2GAME_PARTY_GetPartyIdForUnit113c,
} from './boot-init-gap-b-113c'
import { C2S_CheckCoordDeltaExceeded113c } from './c2s-packet-113c'
import { ITEMS_ClearInventoryCmdFlag4AndSync3F113c } from './k2-combat-core-w1-113c'
import {
  ITEMS_ActivateEquippedItemStats113c,
  ITEMS_OnEquipScrollOrTome113c,
} from './k2-gap-itemdef-113c'
import {
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
} from './k2-items-tc-w1-113c'
import { ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c } from './k2-laneI-0x6fc3-w1-113c'
import {
  QUESTS_AppendQuestTimer_6FC53AF0_113c,
  QUESTS_AttachQuestToUnit_6FC53F80_113c,
  QUESTS_TriggerItemDropped_6FC545A0_113c,
} from './k2-laneJ-0x6fc4-w1-113c'
import { ACT3Q1_GetQuestDataByte04_113c } from './k2-sunit-spawn-w1-113c'
import { PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c } from './k2-w4b5-113c'
import { ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c } from './k2-w5b3-113c'
import { C2S_ValidateNpcMonsterInteract_6FCECCF0_113c } from './k2-w5b6-113c'
import {
  ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c,
  ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c,
  ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c,
  ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c,
} from './k2-w5b7-113c'
import {
  ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c,
  ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c,
} from './k2-w6b6-113c'
import { PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c } from './k2-w6b7-113c'
import { ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c } from './k2-w7b4-113c'
import {
  MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c,
  QUESTS_UseQuestScrollItem_6FC56070_113c,
} from './k2-w8b1-113c'
import {
  MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c,
  PARTY_LeavePartyForPlayer_6FCBC840_113c,
} from './k2-w8b2-113c'
import {
  ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c,
  ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c,
  ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c,
  ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c,
  ITEMS_ProcessReplenishStatTick_6FCFA350_113c,
} from './k2-w8b3-113c'
import { ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c } from './k2-w8b4-113c'
import { UNITS_ChangeAnimMode113c } from './monster-events'
import { SEED_RollRangeHalfOpen113c } from './regpop-spawn-113c'
import { ITEMS_CheckItemTypeId113c } from './replay-kernel-113c'
import { hitD2GameVa113c } from '../va-trace-113c'

export type { SparseMemory113c }

let k2W9B2StackPtr = 0x7ef95000

function allocW9B2Stack(m: SparseMemory113c, size: number): number {
  const aligned = (size + 15) & ~15
  const base = k2W9B2StackPtr >>> 0
  k2W9B2StackPtr = (base + aligned) >>> 0
  for (let i = 0; i < aligned; i += 4) {
    m.setU32((base + i) >>> 0, 0)
  }
  return base
}

function freeW9B2Stack(base: number): void {
  k2W9B2StackPtr = base >>> 0
}

/**
 * [1/15] Act 2 Quest 4 (Arcane Sanctuary): updates town quest 9 counters on Jerhyn/Harem progress, sends quest log 0x28, sets state 0x0A:0x0B, and activates quest 11.
 *
 * @dll D2Game.dll
 * @va 0x6FCE6CA0
 * @ordinalOrName D2Game_6FCE6CA0
 */
export function ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FCE6CA0)
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl !== 0) {
    let pQuest = m.u32(pQuestControl) >>> 0
    while (pQuest !== 0) {
      if (m.u32(pQuest) === 0x09) {
        const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
        m.setU8((pQuestState + 0x2a) >>> 0, 1)
        const dwPlayerGuid = pPlayer !== 0 ? m.u32((pPlayer + 0x0c) >>> 0) >>> 0 : 0xffffffff
        const n18 = (m.u32((pQuestState + 0x18) >>> 0) - 1) >>> 0
        const n24 = (m.u32((pQuestState + 0x24) >>> 0) - 1) >>> 0
        m.setU32((pQuestState + 0x2c) >>> 0, dwPlayerGuid)
        const n1c = (m.u32((pQuestState + 0x1c) >>> 0) + 1) >>> 0
        m.setU32((pQuestState + 0x18) >>> 0, n18)
        m.setU32((pQuestState + 0x24) >>> 0, n24)
        m.setU32((pQuestState + 0x1c) >>> 0, n1c)
        break
      }
      pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    }
  }
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0
  QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, pGame)
  QUESTRECORD_SetQuestState113c(m, pQuestRecord, 0x0a, 0x0b)
  ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c(m, pGame)
}

/**
 * [2/15] Act 2 Quest 3 (Tainted Sun): schedules a 15..16 tick quest timer for `0x6FCE6AF0` when not yet scheduled.
 *
 * @dll D2Game.dll
 * @va 0x6FCE7250
 * @ordinalOrName D2Game_6FCE7250
 */
export function ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c(
  m: SparseMemory113c,
  pQuest: number,
): void {
  hitD2GameVa113c(0x6FCE7250)
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuest + 0x0c) >>> 0) !== 0) return
  if (m.u8((pQuestState + 0x01) >>> 0) !== 0) return
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x1fb)
  }
  const nPeriodTicks = SEED_RollRangeHalfOpen113c(m, (pQuestControl + 0x18) >>> 0, 0x0f, 0x11)
  QUESTS_AppendQuestTimer_6FC53AF0_113c(m, nPeriodTicks, pQuest, 0x6fce6af0)
  m.setU8((pQuestState + 0x01) >>> 0, 1)
}

/**
 * [3/15] Act 2 Quest 3 (Tainted Sun): player join/enter callback (`+0xD4`) that syncs quest state or triggers eclipse.
 *
 * @dll D2Game.dll
 * @va 0x6FCE72C0
 * @ordinalOrName D2Game_6FCE72C0
 */
export function ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c(
  m: SparseMemory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE72C0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGameArg = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDifficulty = m.u8((pGameArg + 0x6d) >>> 0)
  const pQuestRecord = m.u32((pPlayerData + nDifficulty * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0b, 0) === 1 ||
    DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0b, 1) === 1
  ) {
    const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (m.u32((pQuestControl + 0x08) >>> 0) === 0) {
      throw new D2CommonAssertError('0x6fd19ff9', 0x820)
    }
    const pGlobalQuestFlags = m.u32((pQuestControl + 0x0c) >>> 0) >>> 0
    QUESTRECORD_SetQuestState113c(m, pGlobalQuestFlags, 0x0b, 0x0d)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0b, 2) !== 1) return
  ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c(m, pQuest, m.u32((pQuestArg + 0x0c) >>> 0) >>> 0)
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0b, 4) !== 0) {
    m.setU8((pQuest + 0x0b) >>> 0, 2)
    m.setU8((pQuest + 0x0c) >>> 0, 3)
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestRecord, 0x0b, 3) !== 0) {
    m.setU8((pQuest + 0x0b) >>> 0, 2)
    m.setU8((pQuest + 0x0c) >>> 0, 2)
    return
  }
  m.setU8((pQuest + 0x0b) >>> 0, 1)
  m.setU8((pQuest + 0x0c) >>> 0, 1)
}

/**
 * [4/15] Act 2 Quest 1 (Radament's Lair): initializes quest data structure and callback table.
 *
 * @dll D2Game.dll
 * @va 0x6FCE7B40
 * @ordinalOrName D2Game_6FCE7B40
 */
export function ACT2Q1_InitQuestData_6FCE7B40_113c(
  m: SparseMemory113c,
  pQuest: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FCE7B40)
  for (let i = 0; i < 15; i++) {
    m.setU32((pQuest + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU8((pQuest + 0x0a) >>> 0, 1)
  m.setU8((pQuest + 0x0c) >>> 0, 1)
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  void m.u32((pGame + 0x1c) >>> 0)
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fce4320)
  m.setU32((pQuest + 0xac) >>> 0, 0x6fce6e00)
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fce7540)
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fce6e90)
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fce44d0)
  m.setU32((pQuest + 0xa8) >>> 0, 0x6fce61c0)
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fce41d0)
  m.setU32((pQuest + 0x10) >>> 0, 0x0d)
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fce24a0)
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd23288)
  const pState = (pPreallocatedState !== 0 ? pPreallocatedState : m.alloc(0x14)) >>> 0
  m.setU32((pQuest + 0x18) >>> 0, pState)
  m.setU32((pQuest + 0xe0) >>> 0, 0x09)
  m.setU32((pQuest + 0xe8) >>> 0, 0)
  m.setU8((pQuest + 0x0d) >>> 0, 4)
  m.setU32((pQuest + 0xec) >>> 0, 0x6fce2520)
  m.setU32(pState, 0)
  m.setU32((pState + 0x04) >>> 0, 0)
  m.setU32((pState + 0x08) >>> 0, 0)
  m.setU32((pState + 0x0c) >>> 0, 0)
  m.setU32((pState + 0x10) >>> 0, 0)
  m.setU32((pState + 0x04) >>> 0, 0)
  m.setU8(pState, 0)
}

/**
 * [5/15] Act 2 Quest 4 (Arcane Sanctuary): initializes quest data structure and callback table.
 *
 * @dll D2Game.dll
 * @va 0x6FCE9400
 * @ordinalOrName D2Game_6FCE9400
 */
export function ACT2Q4_InitQuestData_6FCE9400_113c(
  m: SparseMemory113c,
  pQuest: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FCE9400)
  for (let i = 0; i < 15; i++) {
    m.setU32((pQuest + 0xa0 + i * 4) >>> 0, 0)
  }
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  void m.u32((pGame + 0x1c) >>> 0)
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fce4ea0)
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd246a8)
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fce85a0)
  m.setU32((pQuest + 0xac) >>> 0, 0x6fce9190)
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fce3620)
  m.setU32((pQuest + 0xa8) >>> 0, 0x6fce5db0)
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fce3320)
  m.setU8((pQuest + 0x0a) >>> 0, 1)
  m.setU8((pQuest + 0x0c) >>> 0, 0)
  const pState = (pPreallocatedState !== 0 ? pPreallocatedState : m.alloc(0x48)) >>> 0
  m.setU32((pQuest + 0xe8) >>> 0, 0)
  m.setU16((pQuest + 0x9c) >>> 0, 0)
  m.setU32((pQuest + 0x18) >>> 0, pState)
  m.setU32((pQuest + 0xe0) >>> 0, 0x0c)
  m.setU8((pQuest + 0x0d) >>> 0, 5)
  m.setU32((pQuest + 0xec) >>> 0, 0x6fce2080)
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fce69d0)
  m.setU32((pQuest + 0x10) >>> 0, 0x0d)
  for (let i = 0; i < 18; i++) {
    m.setU32((pState + i * 4) >>> 0, 0)
  }
  m.setU8(pState, 0)
  m.setU8((pState + 0x01) >>> 0, 0)
  m.setU8((pState + 0x02) >>> 0, 0)
  m.setU8((pState + 0x03) >>> 0, 0)
  m.setU8((pState + 0x04) >>> 0, 0)
}

/**
 * [6/15] C2S packet handler (`0x27` / scroll use): validates item GUID, act/distance, and invokes `0x6FC56070`.
 *
 * @dll D2Game.dll
 * @va 0x6FCED8D0
 * @ordinalOrName D2Game_6FCED8D0
 */
export function C2S_PacketUseQuestScrollItem_6FCED8D0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCED8D0)
  if ((nPacketSize | 0) !== 5) return 3
  const dwItemGuid = m.u32((pPacket + 1) >>> 0) >>> 0
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x2d3)
  }
  const nHashIdx = dwItemGuid & 0x7f
  let pItem = m.u32((pGame + nHashIdx * 4 + 0x1720) >>> 0) >>> 0
  while (pItem !== 0) {
    if ((m.u32((pItem + 0x0c) >>> 0) >>> 0) === dwItemGuid) break
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) return 1
  if (ITEMS_IsItemInUnitInventoryOrCursor_6FC2E150_113c(m, pPlayer, pItem, 0) === 0) {
    const pPlayerRoom = UNITS_GetRoom113c(m, pPlayer) >>> 0
    const nPlayerLevel = DUNGEON_GetLevelIdFromRoom113c(m, pPlayerRoom)
    const nPlayerAct = DRLG_GetActNoFromLevelId113c(m, nPlayerLevel) & 0xff
    const pItemRoom = UNITS_GetRoom113c(m, pItem) >>> 0
    const nItemLevel = DUNGEON_GetLevelIdFromRoom113c(m, pItemRoom)
    const nItemAct = DRLG_GetActNoFromLevelId113c(m, nItemLevel) & 0xff
    if (nPlayerAct !== nItemAct) return 2
    const dwTypeX = m.u32(pItem >>> 0) | 0
    let nItemX = 0
    if (dwTypeX === 2 || (dwTypeX > 3 && dwTypeX <= 5)) {
      const pStaticPath = m.u32((pItem + 0x2c) >>> 0) >>> 0
      nItemX = m.u32((pStaticPath + 0x0c) >>> 0) | 0
    } else {
      const pPath = m.u32((pItem + 0x2c) >>> 0) >>> 0
      nItemX = pPath !== 0 ? PATH_GetPosX113c(m, pPath) : 0
    }
    const dwTypeY = m.u32(pItem >>> 0) | 0
    let nItemY = 0
    if (dwTypeY === 2 || (dwTypeY > 3 && dwTypeY <= 5)) {
      const pStaticPath = m.u32((pItem + 0x2c) >>> 0) >>> 0
      nItemY = m.u32((pStaticPath + 0x10) >>> 0) | 0
    } else {
      const pPath = m.u32((pItem + 0x2c) >>> 0) >>> 0
      nItemY = pPath !== 0 ? PATH_GetPosY113c(m, pPath) : 0
    }
    const nCoordErr = C2S_CheckCoordDeltaExceeded113c(m, pPlayer, nItemX, nItemY, 0x0a)
    if (nCoordErr !== 0) return nCoordErr
  }
  QUESTS_UseQuestScrollItem_6FC56070_113c(m, pGame, pPlayer, dwItemGuid)
  return 0
}

/**
 * [7/15] C2S packet handler (9-byte NPC/monster spawn node trigger): validates monster interaction and marks spawn node processed (`0x6FC68B60`).
 *
 * @dll D2Game.dll
 * @va 0x6FCEE440
 * @ordinalOrName D2Game_6FCEE440
 */
export function C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEE440)
  if ((nPacketSize | 0) !== 9) return 3
  const dwMonsterGuid = m.u32((pPacket + 5) >>> 0) >>> 0
  const sp = allocW9B2Stack(m, 16)
  try {
    const nErr = C2S_ValidateNpcMonsterInteract_6FCECCF0_113c(
      m,
      pGame,
      dwMonsterGuid,
      sp,
      pPlayer,
      1,
    )
    if (nErr !== 0) return nErr
    const pMonster = m.u32(sp) >>> 0
    if (pMonster !== 0 && m.u32(pMonster >>> 0) === 1) {
      const pMonsterData = m.u32((pMonster + 0x14) >>> 0) >>> 0
      if (pMonsterData !== 0) {
        const ppListHead = m.u32((pMonsterData + 0x30) >>> 0) >>> 0
        MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c(
          m,
          ppListHead,
          pPlayer,
          pGame,
          pMonster,
        )
        return 0
      }
    }
    MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c(m, 0, pPlayer, pGame, pMonster)
    return 0
  } finally {
    freeW9B2Stack(sp)
  }
}

/**
 * [8/15] Equips or uses a player cursor item (`esi = eax`) on a mercenary unit (`edi = ecx`).
 *
 * @dll D2Game.dll
 * @va 0x6FCF05B0
 * @ordinalOrName D2Game_6FCF05B0
 */
export function ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c(
  m: SparseMemory113c,
  pCursorItem: number,
  pMercUnit: number,
  pGame: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FCF05B0)
  const pInventory = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  if (m.u32((pGame + 0x70) >>> 0) === 0) return 3
  if (ITEMS_CheckCommandFlags113c(m, pCursorItem, 0x10) === 0) return 0
  if (ITEMS_CheckCommandFlags113c(m, pCursorItem, 0x100) !== 0) return 0
  if (
    ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x4c) !== 0 ||
    ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x51) !== 0 ||
    ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x50) !== 0
  ) {
    ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c(
      m,
      pMercUnit,
      pCursorItem,
      pGame,
      pCursorItem,
      0,
      0,
    )
    ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c(m, pPlayer, pCursorItem, pGame)
    INVENTORY_SetCursorItem113c(m, pInventory, 0)
    return 1
  }
  let bCanEquip = 0
  if (
    ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x03) !== 0 ||
    ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x25) !== 0
  ) {
    bCanEquip = 1
  }
  const nMercClassId = pMercUnit !== 0 ? m.u32((pMercUnit + 0x04) >>> 0) | 0 : -1
  let bClassMatch = false
  if ((nMercClassId >>> 0) > 0x167) {
    if (nMercClassId === 0x230) {
      if (
        ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x1c) !== 0 &&
        ITEMS_GetInvWidthFromItem113c(m, pCursorItem) === 0
      ) {
        bCanEquip = 1
      }
      if (ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x47) !== 0) {
        bClassMatch = true
      }
    } else if (nMercClassId === 0x231) {
      if (ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x1e) !== 0) {
        bCanEquip = 1
      }
      if (ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x47) !== 0) {
        bClassMatch = true
      }
    }
  } else if (nMercClassId === 0x167) {
    if (ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x02) !== 0) {
      bClassMatch = true
    } else if (
      ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x1e) !== 0 &&
      ITEMS_GetInvWidthFromItem113c(m, pCursorItem) === 0
    ) {
      bClassMatch = true
    }
  } else if (nMercClassId === 0x10f) {
    if (ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x1b) !== 0) {
      bClassMatch = true
    }
  } else if (nMercClassId === 0x152) {
    if (
      ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x21) !== 0 ||
      ITEMS_CheckItemTypeId113c(m, pCursorItem, 0x22) !== 0
    ) {
      bClassMatch = true
    }
  }
  if (!bClassMatch && bCanEquip === 0) {
    SUNIT_SetUnitEventSound113c(m, pMercUnit, 0x55, pPlayer)
    return 0
  }
  if (ITEMS_CheckRequirements113c(m, pCursorItem, pMercUnit, 0, 0, 0, 0) === 0) {
    SUNIT_SetUnitEventSound113c(m, pMercUnit, 0x55, pPlayer)
    return 0
  }
  if (ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c(m, pGame, pPlayer, pMercUnit, pCursorItem) !== 0) {
    SUNIT_SetUnitEventSound113c(m, pMercUnit, 0x57, pPlayer)
    return 1
  }
  SUNIT_SetUnitEventSound113c(m, pMercUnit, 0x56, pPlayer)
  return 0
}

/**
 * [9/15] Ground item pickup (`0x6FCF6E30`): validates item on ground, handles gold/auto-stack/auto-equip/auto-belt/inventory grid placement.
 *
 * @dll D2Game.dll
 * @va 0x6FCF6E30
 * @ordinalOrName D2Game_6FCF6E30
 */
export function ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c(
  m: SparseMemory113c,
  dwItemGuidArg: number,
  pGameArg: number,
  pPlayerArg: number,
  pOutErrorCode: number,
): number {
  hitD2GameVa113c(0x6FCF6E30)
  const isGamePlayerGuidOrder =
    (pPlayerArg >>> 0) < 0x10000 &&
    (dwItemGuidArg >>> 0) >= 0x10000 &&
    (pGameArg >>> 0) >= 0x10000
  const dwItemGuid = isGamePlayerGuidOrder ? pPlayerArg : dwItemGuidArg
  const pGame = isGamePlayerGuidOrder ? dwItemGuidArg : pGameArg
  const pPlayer = isGamePlayerGuidOrder ? pGameArg : pPlayerArg
  if (pGame === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x77b)
  }
  if (pPlayer === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x77c)
  }
  m.setU32(pOutErrorCode >>> 0, 0)
  const pInventory = m.u32((pPlayer + 0x60) >>> 0) >>> 0
  if (pInventory === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0x781)
  }
  if (INVENTORY_GetCursorItem113c(m, pInventory) !== 0) return 0
  if (PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayer) !== 0) return 0
  const nHashIdx = dwItemGuid & 0x7f
  let pItem = m.u32((pGame + nHashIdx * 4 + 0x1720) >>> 0) >>> 0
  while (pItem !== 0) {
    if ((m.u32((pItem + 0x0c) >>> 0) >>> 0) === (dwItemGuid >>> 0)) break
    pItem = m.u32((pItem + 0xe4) >>> 0) >>> 0
  }
  if (pItem === 0) {
    m.setU32(pOutErrorCode >>> 0, 1)
    return 0
  }
  if (m.u32(pItem >>> 0) !== 4) return 0
  if (m.u32((pItem + 0x10) >>> 0) !== 3) {
    m.setU32(pOutErrorCode >>> 0, 1)
    return 0
  }
  ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m, pPlayer)
  if (ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c(m, pPlayer, pGame, pItem) === 0) {
    ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c(m, pItem, pPlayer, 0x13)
    return 0
  }
  SUNIT_SetUnitEventSound113c(m, pPlayer, 1, pPlayer)
  if (ITEMS_GetItemTypeFromItem113c(m, pItem) === 4) {
    ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c(m, pPlayer, pGame, pItem)
    return 1
  }
  if (ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c(m, pGame, pPlayer, pItem) !== 0) {
    return 0
  }
  const sp = allocW9B2Stack(m, 16)
  try {
    if (ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c(m, pItem, pPlayer, sp, 0) !== 0) {
      const nBodyLoc = m.u32(sp) >>> 0
      if (INVENTORY_CanAutoEquipItem113c(m, pPlayer, nBodyLoc, pItem, 0) !== 1) {
        m.setU32(pOutErrorCode >>> 0, 1)
        return 0
      }
      const pRoom = UNITS_GetRoom113c(m, pItem) >>> 0
      if (pRoom !== 0) {
        DUNGEON_AddRoomPortalNode113c(
          m,
          pRoom,
          m.u32(pItem >>> 0),
          m.u32((pItem + 0x0c) >>> 0),
        )
        UNITS_SetTargetUnitForDynamicUnitEx113c(m, pItem)
        UNITROOM_RemoveUnitFromRoom113c(m, pItem)
      }
      if (ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c(m, pItem, pPlayer, 0, pGame) === 0) {
        return 0
      }
      QUESTS_TriggerItemDropped_6FC545A0_113c(m, pGame, pItem, pPlayer)
      return 1
    }
    if (
      ITEMS_IsBeltable113c(m, pItem) !== 0 &&
      ITEMS_CanItemBeAutoBeltOrStacked113c(m, pInventory, pItem) !== 0 &&
      INVENTORY_AutoPlaceItemInBelt113c(m, pInventory, pItem) !== 0
    ) {
      const pRoom = UNITS_GetRoom113c(m, pItem) >>> 0
      if (pRoom !== 0) {
        const pRoomInner = UNITS_GetRoom113c(m, pItem) >>> 0
        DUNGEON_AddRoomPortalNode113c(
          m,
          pRoomInner,
          m.u32(pItem >>> 0),
          m.u32((pItem + 0x0c) >>> 0),
        )
        UNITS_SetTargetUnitForDynamicUnitEx113c(m, pItem)
        UNITROOM_RemoveUnitFromRoom113c(m, pItem)
      }
      if (INVENTORY_PlaceItemInSocket113c(m, pInventory, pItem, 2) === 0) {
        throw new D2CommonAssertError('0x6fd19ff9', 0x7ee)
      }
      INVENTORY_SetCursorItem113c(m, pInventory, 0)
      ITEMS_OnEquipScrollOrTome113c(m, pItem, pPlayer)
      if (ITEMS_CanUseCharmInInventory113c(m, pItem, pPlayer) !== 0) {
        ITEMS_ActivateEquippedItemStats113c(m, pPlayer, pItem, 0)
      }
      m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & 0xfffffffd) >>> 0)
      UNITS_ChangeAnimMode113c(m, pItem, 2)
      ITEMS_SetInvPage113c(m, pItem, 0xff)
      ITEMS_SetItemFlag113c(m, pItem, 0x2000, 1)
      m.setU32((pItem + 0xc4) >>> 0, (m.u32((pItem + 0xc4) >>> 0) & 0xfdffffff) >>> 0)
      INVENTORY_AppendItemGuidNode113c(m, pInventory, pItem)
      UNITS_SetUnitUpdateFlags113c(m, pPlayer, 1)
      if (ITEMS_CanUseCharmInInventory113c(m, pItem, pPlayer) !== 0) {
        D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c(m, pGame, pPlayer, 0)
        UNITS_SetUnitUpdateFlags113c(m, pPlayer, 1)
      }
      return 1
    }
    if (
      ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c(
        m,
        pItem,
        pPlayer,
        pGame,
        1,
        0,
        0x6fd1b14c,
        0x7f0,
      ) !== 0
    ) {
      return 1
    }
    ITEMS_SetDroppedItemGroundModeAndRefreshOwner_6FCF2840_113c(m, pItem, pPlayer, 0x17)
    return 0
  } finally {
    freeW9B2Stack(sp)
  }
}

/**
 * [10/15] Processes item self-repair (`0xFC` -> `0x48`) and stack replenish (`0xFD` -> `0x46`) on tick.
 *
 * @dll D2Game.dll
 * @va 0x6FCFA480
 * @ordinalOrName D2Game_6FCFA480
 */
export function ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c(
  m: SparseMemory113c,
  pGame: number,
  pItem: number,
): void {
  hitD2GameVa113c(0x6FCFA480)
  if (
    ITEMS_CheckCommandFlags113c(m, pItem, 0x100) === 0 &&
    ITEMS_CanItemLoseDurability113c(m, pItem) !== 0
  ) {
    const nMaxDurability = ITEMS_B043_GetMaxDurabilityFromUnit113c(m, pItem)
    if (
      ITEMS_ProcessReplenishStatTick_6FCFA350_113c(m, 0xfc, 0x48, pGame, pItem, nMaxDurability) !==
      0
    ) {
      return
    }
  }
  if (ITEMS_GetTwoHandedFlag113c(m, pItem) !== 0) {
    const nMaxStack = ITEMS_GetTotalMaxStack113c(m, pItem)
    ITEMS_ProcessReplenishStatTick_6FCFA350_113c(m, 0xfd, 0x46, pGame, pItem, nMaxStack)
  }
}

/**
 * [11/15] Act 3 Quest 3 (Khalim's Will): initializes quest data structure and callback table.
 *
 * @dll D2Game.dll
 * @va 0x6FD07CE0
 * @ordinalOrName D2Game_6FD07CE0
 */
export function ACT3Q3_InitQuestData_6FD07CE0_113c(
  m: SparseMemory113c,
  pQuest: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FD07CE0)
  for (let i = 0; i < 15; i++) {
    m.setU32((pQuest + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU8((pQuest + 0x0a) >>> 0, 1)
  m.setU8((pQuest + 0x0b) >>> 0, 1)
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  void m.u32((pGame + 0x1c) >>> 0)
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fd04c90)
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd20538)
  m.setU8((pQuest + 0x0c) >>> 0, 0)
  m.setU32((pQuest + 0xe0) >>> 0, 0x12)
  m.setU8((pQuest + 0x0d) >>> 0, 0)
  m.setU32((pQuest + 0xe8) >>> 0, 0x6fd04ab0)
  m.setU32((pQuest + 0xec) >>> 0, 0x6fd04f60)
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fd02e80)
  m.setU32((pQuest + 0x10) >>> 0, 0x0f)
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fd07940)
  m.setU32((pQuest + 0xac) >>> 0, 0x6fd07a10)
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fd049e0)
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fd02ef0)
  m.setU32((pQuest + 0xb0) >>> 0, 0x6fd06190)
  const pState = (pPreallocatedState !== 0 ? pPreallocatedState : m.alloc(0xb0)) >>> 0
  m.setU32((pQuest + 0x18) >>> 0, pState)
  for (let i = 0; i < 44; i++) {
    m.setU32((pState + i * 4) >>> 0, 0)
  }
  m.setU32((pState + 0x08) >>> 0, 0)
  m.setU16((pState + 0xac) >>> 0, 0)
}

/**
 * [12/15] Act 3 Quest 1 (The Golden Bird): attaches quest `0x12` to boss monster unit and arms Jade Figurine drop callback (`0x6FD08010`).
 *
 * @dll D2Game.dll
 * @va 0x6FD08200
 * @ordinalOrName D2Game_6FD08200
 */
export function ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c(
  m: SparseMemory113c,
  pQuest: number,
  pMonsterUnit: number,
): number {
  hitD2GameVa113c(0x6FD08200)
  const pQuestState = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return 0
  if (m.u8((pQuestState + 0x0c) >>> 0) === 0) return 0
  if (m.u8((pQuestState + 0x01) >>> 0) !== 1) return 0
  const pGame0 = m.u32((pQuest + 0x04) >>> 0) >>> 0
  if ((ACT3Q1_GetQuestDataByte04_113c(m, pGame0) & 0xff) !== 0) return 0
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl !== 0) {
    let pNode = m.u32(pQuestControl) >>> 0
    while (pNode !== 0) {
      if (m.u32(pNode) === 0x12) {
        QUESTS_AttachQuestToUnit_6FC53F80_113c(m, pNode, pMonsterUnit, pGame)
        break
      }
      pNode = m.u32((pNode + 0xf4) >>> 0) >>> 0
    }
  }
  void ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fd08010)
  m.setU8((pQuestState + 0x01) >>> 0, 0)
  m.setU8((pQuestState + 0x02) >>> 0, 1)
  const dwMonsterGuid =
    pMonsterUnit !== 0 ? m.u32((pMonsterUnit + 0x0c) >>> 0) >>> 0 : 0xffffffff
  m.setU32((pQuestState + 0x04) >>> 0, dwMonsterGuid)
  return 1
}

/**
 * [13/15] Act 3 Quest 6 (The Guardian / Mephisto): initializes quest data structure and callback table.
 *
 * @dll D2Game.dll
 * @va 0x6FD0A080
 * @ordinalOrName D2Game_6FD0A080
 */
export function ACT3Q6_InitQuestData_6FD0A080_113c(
  m: SparseMemory113c,
  pQuest: number,
  pPreallocatedState = 0,
): void {
  hitD2GameVa113c(0x6FD0A080)
  for (let i = 0; i < 15; i++) {
    m.setU32((pQuest + 0xa0 + i * 4) >>> 0, 0)
  }
  m.setU8((pQuest + 0x0c) >>> 0, 0)
  m.setU32((pQuest + 0xe8) >>> 0, 0)
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  void m.u32((pGame + 0x1c) >>> 0)
  m.setU32((pQuest + 0xa0) >>> 0, 0x6fd033a0)
  m.setU32((pQuest + 0xdc) >>> 0, 0x6fd22290)
  m.setU8((pQuest + 0x0a) >>> 0, 1)
  m.setU32((pQuest + 0xc0) >>> 0, 0x6fd09a10)
  m.setU32((pQuest + 0xcc) >>> 0, 0x6fd07080)
  m.setU32((pQuest + 0xac) >>> 0, 0x6fd071d0)
  m.setU32((pQuest + 0xd4) >>> 0, 0x6fd03120)
  m.setU32((pQuest + 0xc8) >>> 0, 0x6fd03390)
  m.setU32((pQuest + 0xf0) >>> 0, 0x6fd07050)
  m.setU32((pQuest + 0xe0) >>> 0, 0x16)
  m.setU8((pQuest + 0x0d) >>> 0, 6)
  m.setU32((pQuest + 0xec) >>> 0, 0x6fd028c0)
  const pState = (pPreallocatedState !== 0 ? pPreallocatedState : m.alloc(0x34)) >>> 0
  m.setU32((pQuest + 0x18) >>> 0, pState)
  for (let i = 0; i < 13; i++) {
    m.setU32((pState + i * 4) >>> 0, 0)
  }
}

/**
 * [14/15] Equips a summoned pet (`edi = eax`) with 4 difficulty-upgraded magic items from `0x6FD1B218`.
 *
 * @dll D2Game.dll
 * @va 0x6FD0E6F0
 * @ordinalOrName D2Game_6FD0E6F0
 */
export function SKILLS_EquipSummonedPetItems_6FD0E6F0_113c(
  m: SparseMemory113c,
  pMonsterUnit: number,
): void {
  hitD2GameVa113c(0x6FD0E6F0)
  if (pMonsterUnit === 0) {
    throw new D2CommonAssertError('0x6fd19ff9', 0xa2a)
  }
  const nClassId = m.u32((pMonsterUnit + 0x04) >>> 0) | 0
  const pGame = m.u32((pMonsterUnit + 0x80) >>> 0) >>> 0
  const nUnitLevel = STATLIST_GetUnitStat113c(m, pMonsterUnit, 0x0c, 0)
  // D2Game.dll 1.13c `.rdata` 0x6FD1C2F8..0x6FD1C357: 4x3 Ancient (cid 540..542) equip table
  // indexed by `0x6FD1B218 + nClassId * 8` with row stride `0x18` (`3 * 8` bytes).
  if (nClassId >= 540 && nClassId <= 542 && m.u32(0x6fd1c2f8) === 0) {
    const ancientEquipWords = [
      // Row 0 (540 Talic, 541 Madawc, 542 Korlic)
      0x20647362, 0x00000104, // 'bsd ', body=4, qual=1
      0x20786174, 0x00000104, // 'tax ', body=4, qual=1
      0x20756f76, 0x00000104, // 'vou ', body=4, qual=1
      // Row 1
      0x20776f74, 0x00000105, // 'tow ', body=5, qual=1
      0x20786174, 0x00000105, // 'tax ', body=5, qual=1
      0x206e6972, 0x00000106, // 'rin ', body=6, qual=1
      // Row 2
      0x20646c66, 0x00000103, // 'fld ', body=3, qual=1
      0x206c6768, 0x0000010a, // 'hgl ', body=10, qual=1
      0x20646c66, 0x00000103, // 'fld ', body=3, qual=1
      // Row 3
      0x20746268, 0x00000109, // 'hbt ', body=9, qual=1
      0x20746268, 0x00000109, // 'hbt ', body=9, qual=1
      0x206e7263, 0x00000101, // 'crn ', body=1, qual=1
    ]
    for (let k = 0; k < ancientEquipWords.length; k++) {
      m.setU32((0x6fd1c2f8 + k * 4) >>> 0, ancientEquipWords[k]!)
    }
  }
  const sp = allocW9B2Stack(m, 0x10)
  try {
    const pOutIndex = (sp + 0x04) >>> 0
    const pMonEquipRec = (sp + 0x08) >>> 0
    let pTableEntry = (0x6fd1b218 + nClassId * 8) >>> 0
    for (let i = 0; i < 4; i++) {
      const dwBaseCode = m.u32(pTableEntry) >>> 0
      const dwBodyLoc = m.u32((pTableEntry + 0x04) >>> 0) >>> 0
      m.setU32(pMonEquipRec, dwBaseCode)
      m.setU32((pMonEquipRec + 0x04) >>> 0, dwBodyLoc)
      const pItemsTxt = DATATBLS_GetItemsTxtRecordByCode113c(m, dwBaseCode, pOutIndex) >>> 0
      const nDiff = m.u8((pGame + 0x6d) >>> 0)
      if (nDiff === 1) {
        if (pItemsTxt !== 0) {
          m.setU32(pMonEquipRec, m.u32((pItemsTxt + 0x88) >>> 0) >>> 0)
        }
      } else if (nDiff === 2) {
        if (pItemsTxt !== 0) {
          m.setU32(pMonEquipRec, m.u32((pItemsTxt + 0x8c) >>> 0) >>> 0)
        }
      }
      MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c(
        m,
        pMonsterUnit,
        pMonEquipRec,
        pGame,
        nUnitLevel,
        4,
      )
      pTableEntry = (pTableEntry + 0x18) >>> 0
    }
  } finally {
    freeW9B2Stack(sp)
  }
}

/**
 * [15/15] Notifies sub-party members with event `0x5A` (`0x6FD10820`) and removes player from party (`0x6FCBC840`).
 *
 * @dll D2Game.dll
 * @va 0x6FD110F0
 * @ordinalOrName D2Game_6FD110F0
 */
export function PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c(
  m: SparseMemory113c,
  pGame: number,
  pPlayerUnit: number,
  _uArg1 = 0,
  _uArg2 = 0,
  _uArg3 = 0,
): void {
  hitD2GameVa113c(0x6FD110F0)
  let wPartyId = 0xffff
  if (pPlayerUnit !== 0) {
    const pUnitGame = m.u32((pPlayerUnit + 0x80) >>> 0) >>> 0
    if (pUnitGame !== 0 && m.u32(pPlayerUnit >>> 0) === 0) {
      wPartyId = D2GAME_PARTY_GetPartyIdForUnit113c(m, pPlayerUnit, pUnitGame) & 0xffff
    }
  }
  PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c(
    m,
    pGame,
    wPartyId,
    PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c,
    pPlayerUnit,
  )
  PARTY_LeavePartyForPlayer_6FCBC840_113c(m, pPlayerUnit, pGame)
}
