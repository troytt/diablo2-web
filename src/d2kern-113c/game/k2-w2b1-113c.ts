/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 2 Batch 1 (`w2b1`) routines across
 * `0x6FC217E0..0x6FC80810` (45 functions, 3,070 bytes):
 * - Unique item disabled-bit check (`0x6FC217E0`)
 * - Storm `TSHashTable` unique key allocator & `TSExplicitList` SEH placement-new (`0x6FC22060..0x6FC226F0`)
 * - Unit inventory/cursor item removal wrapper (`0x6FC2E7E0`)
 * - `AIGENERAL` boss group replacement & `MONUMOD` specific modifier assignment (`0x6FC41210`, `0x6FC432B0`)
 * - Quest log `0x28` + `0x89` packet sync, living hostile player scan, and missile range init (`0x6FC559C0..0x6FC59600`)
 * - Act 5 quest callbacks, statue object initializers, prison group counters, and speech/alert triggers (`0x6FC77D80..0x6FC7E7F0`)
 * - Act 1 Quest 4 (`Search for Cain`) state/coord helpers and intro quest status filters (`0x6FC80170..0x6FC80810`)
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { imul32 } from '../common/int-math.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_GetItemCell113c,
  ITEMS_GetItemQuality113c,
} from '../common/items.ts'
import { MISSILE_GetLevel113c, MISSILE_GetSkill113c } from '../common/missile.ts'
import { PATH_GetTargetTypeAndPosition113c } from '../common/path.ts'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record.ts'
import { UNITROOM_RefreshUnit113c, UNITS_GetRoom113c } from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c.ts'
import { AIGENERAL_InitBossGroup113c } from './ai-fallen-113c.ts'
import { NET_QueuePacketToClientBuffer113c } from './boot-init-gap-a-113c.ts'
import { D2GAME_SUNIT_IterateAllLivingPlayers113c } from './boot-init-gap-b-113c.ts'
import {
  D2GAME_MONUMOD_TABLE_VA_113C,
  type K2ItemsTcW1Hooks113c,
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
  MONUMOD_RollBossOrMinionNameSeed113c,
  PLAYER_CheckHostilePlayerCallback113c,
  QUESTS_SendNpcMessagePacket27_113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
  QUESTS_SendQuestStateAlert5D_113c,
} from './k2-items-tc-w1-113c.ts'
import {
  SKILLS_EvalLinearParam12_6FC21B10_113c,
  STORM_TSHashTableLookup_6FC22130_113c,
  STORM_TSListInitDefault_6FC224B0_113c,
  STORM_TSListInitFromPrototype_6FC22740_113c,
  UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c,
} from './k2-laneH-0x6fc2-w1-113c.ts'
import {
  AIGENERAL_FreeMinionList_6FC40B30_113c,
  ITEMS_FindQuestItemByBaseCode_6FC2E660_113c,
  ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c,
  type LaneIHooks113c,
} from './k2-laneI-0x6fc3-w1-113c.ts'
import {
  ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c,
  ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c,
} from './k2-laneM-0x6fc7-w1-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
} from './regpop-spawn-113c.ts'
import { EVENT_SetEventFull113c, type EventWheelHooks113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** Optional host callbacks for `w2b1` routines (`AIGENERAL`, `MONUMOD`, and `EVENT` hooks). */
export interface K2W2B1Hooks113c extends K2ItemsTcW1Hooks113c, LaneIHooks113c {
  readonly eventWheel?: EventWheelHooks113c
}

/** Reentrant scratch stack region for `w2b1` local packet/context structs. */
let k2W2B1StackPtr = 0x7e080000

function getDataTablesPtr113c(m: Memory113c): number {
  return m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
}

function findQuestNodeInChain113c(m: Memory113c, pGame: number, nQuestId: number): number {
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  const targetId = nQuestId >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) >>> 0) === targetId) {
      return pQuest
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

function applySelfUnitEventSound113c(m: Memory113c, pUnit: number, wSoundId: number): void {
  const unit = pUnit >>> 0
  if (unit === 0) {
    throw new D2CommonAssertError('', 0x558)
  }
  m.setU16((unit + 0x6e) >>> 0, wSoundId & 0xffff)
  m.setU32((unit + 0x70) >>> 0, unit)
  UNITROOM_RefreshUnit113c(m, unit)
  m.setU32((unit + 0xc4) >>> 0, (m.u32((unit + 0xc4) >>> 0) | 0x400) >>> 0)
}

// ============================================================================
// 1. ITEMS, STORM & AIGENERAL/MONUMOD (`0x6FC217E0 .. 0x6FC432B0`)
// ============================================================================

/**
 * Checks whether `pItem` (`esi`) is a unique item (`dwUnitType == 4`, `ITEMS_GetItemQuality == 7`,
 * `ITEMS_GetItemCell >= 0`) whose `UniqueItemsTxt` record (`0x6FC216F0`) has bit `2` (`gdwBitMasks[2]`
 * at `ecx + 8`, mask `0x04`) set in its flags byte at `+0x2C`.
 *
 * @va D2Game.dll@0x6fc217e0
 */
export function ITEMS_IsUniqueItemDisabled_6FC217E0_113c(
  m: Memory113c,
  pItem: number,
): number {
  hitD2GameVa113c(0x6FC217E0)
  const item = pItem >>> 0
  if (item === 0) return 0
  if ((m.u32(item) | 0) !== 4) return 0
  if ((ITEMS_GetItemQuality113c(m, item) | 0) !== 7) return 0
  if ((ITEMS_GetItemCell113c(m, item) | 0) < 0) return 0
  const nUniqueId = ITEMS_GetItemCell113c(m, item) | 0
  const pRec = UNIQUEITEMS_GetRecordPtrFast_6FC216F0_113c(m, nUniqueId) >>> 0
  if (pRec === 0) return 0
  const uFlags = m.u8((pRec + 0x2c) >>> 0)
  const pBitMasks = m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C) >>> 0
  const maskByte = pBitMasks !== 0 ? m.u8((pBitMasks + 0x08) >>> 0) : 0x04
  return (uFlags & maskByte) !== 0 ? 1 : 0
}

/**
 * Allocates the next non-zero unused 32-bit key from a Storm `TSHashTable` (`edi = pHashTable`,
 * counter at `+0x48`, wraparound flag at `+0x4C`). When `+0x48` increments to `0`, sets
 * `[pHashTable + 0x4C] = 1` and increments again; once `+0x4C != 0`, probes
 * `STORM_TSHashTableLookup_6FC22130_113c` until an unused key is found.
 *
 * @va D2Game.dll@0x6fc22060
 */
export function STORM_TSHashTableAllocUniqueKey_6FC22060_113c(
  m: Memory113c,
  pHashTable: number,
): number {
  hitD2GameVa113c(0x6FC22060)
  const tbl = pHashTable >>> 0
  while (true) {
    const nextKey = ((m.u32((tbl + 0x48) >>> 0) | 0) + 1) >>> 0
    m.setU32((tbl + 0x48) >>> 0, nextKey)
    if (nextKey === 0) {
      m.setU32((tbl + 0x4c) >>> 0, 1)
      continue
    }
    if (m.u32((tbl + 0x4c) >>> 0) !== 0) {
      if (STORM_TSHashTableLookup_6FC22130_113c(m, tbl, nextKey) !== 0) {
        continue
      }
    }
    return m.u32((tbl + 0x48) >>> 0) >>> 0
  }
}

/**
 * SEH-wrapped placement-new constructor for a 12-byte Storm `TSExplicitList` (`[esp+4] = pList`,
 * `ret 4`): invokes `STORM_TSListInitDefault_6FC224B0_113c` when `pList != 0`, returning `pList` (`0` if `NULL`).
 *
 * @va D2Game.dll@0x6fc225a0
 */
export function STORM_TSListPlacementNewDefault_6FC225A0_113c(
  m: Memory113c,
  pList: number,
): number {
  hitD2GameVa113c(0x6FC225A0)
  const addr = pList >>> 0
  if (addr !== 0) {
    return STORM_TSListInitDefault_6FC224B0_113c(m, addr) >>> 0
  }
  return 0
}

/**
 * SEH-wrapped placement-new copy-linkoffset constructor for a 12-byte Storm `TSExplicitList`
 * (`ecx = pSrcList`, `[esp+4] = pDstList`, `ret 4`): invokes `STORM_TSListInitFromPrototype_6FC22740_113c`
 * when `pDstList != 0`, returning `pDstList` (`0` if `NULL`).
 *
 * @va D2Game.dll@0x6fc226f0
 */
export function STORM_TSListPlacementNewCopy_6FC226F0_113c(
  m: Memory113c,
  pDstList: number,
  pSrcList: number,
): number {
  hitD2GameVa113c(0x6FC226F0)
  const dst = pDstList >>> 0
  if (dst !== 0) {
    return STORM_TSListInitFromPrototype_6FC22740_113c(m, dst, pSrcList >>> 0) >>> 0
  }
  return 0
}

/**
 * Detaches `pTargetItem` (`[esp+4]`) from `pUnit->pInventory` (`edx = pUnit`, `pInventory` at `+0x60`,
 * `ret 4`) via `ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c`.
 *
 * @va D2Game.dll@0x6fc2e7e0
 */
export function ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c(
  m: Memory113c,
  pUnit: number,
  pTargetItem: number,
): void {
  hitD2GameVa113c(0x6FC2E7E0)
  const pInventory = m.u32((pUnit + 0x60) >>> 0) >>> 0
  ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c(m, pInventory, pTargetItem >>> 0)
}

/**
 * Frees the existing `pAiGeneral->pMinionList` (`+0x34`) on monster `pUnit` (`ebx`, `eax = pGame`),
 * re-initializes boss/group flags via `AIGENERAL_InitBossGroup113c` (`0x6FC40D90`), and installs
 * `pNewMinionList` (`[esp+0x14]`) at `pAiGeneral + 0x34` (`ret 0x14`).
 *
 * @va D2Game.dll@0x6fc41210
 */
export function AIGENERAL_ReplaceMinionListAndInitBossGroup_6FC41210_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nLeaderId: number,
  nLeaderType: number,
  bIsGroupMember: number,
  bIsBoss: number,
  pNewMinionList: number,
  hooks?: K2W2B1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC41210)
  const unit = pUnit >>> 0
  if (unit === 0) return
  if ((m.u32(unit) | 0) !== 1) return
  const pMonData = m.u32((unit + 0x14) >>> 0) >>> 0
  const pAiGeneral = pMonData !== 0 ? m.u32((pMonData + 0x28) >>> 0) >>> 0 : 0
  const pOldMinionList = m.u32((pAiGeneral + 0x34) >>> 0) >>> 0
  AIGENERAL_FreeMinionList_6FC40B30_113c(m, pGame >>> 0, pOldMinionList, hooks)
  AIGENERAL_InitBossGroup113c(
    m,
    unit,
    nLeaderType,
    pGame >>> 0,
    nLeaderId,
    bIsGroupMember,
    bIsBoss,
  )
  m.setU32((pAiGeneral + 0x34) >>> 0, pNewMinionList >>> 0)
}

/**
 * Assigns `nUModId` (`ebx`) into the first free (`0`) slot of `pMonster->pMonsterData->nMonUMod[0..8]`
 * (`+0x1C`, `[esp+4] = pMonster`, `esi = pGame`, `[esp+8] = bBoss`, `ret 8`). When `bBoss != 0`, first marks
 * `pMonster` as unique boss and increments `dwUniqueCount` via `MONUMOD_MarkBossAndIncrementUniqueCount113c`
 * (`0x6FC43260`); after storing `nUModId`, invokes `monUModTable[nUModId]` (`0x6FD2E550 + nUModId * 4`) if non-NULL.
 *
 * @va D2Game.dll@0x6fc432b0
 */
export function MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c(
  m: Memory113c,
  pMonster: number,
  nUModId: number,
  pGame: number,
  bBoss: number,
  hooks?: K2W2B1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC432B0)
  const monster = pMonster >>> 0
  if (monster === 0) return
  if ((m.u32(monster) | 0) !== 1) return
  const pMonData = m.u32((monster + 0x14) >>> 0) >>> 0
  if (pMonData === 0) return
  const pUMods = (pMonData + 0x1c) >>> 0
  if (pUMods === 0) return

  if (bBoss !== 0) {
    MONUMOD_MarkBossAndIncrementUniqueCount113c(m, monster, pGame >>> 0)
  }

  let slot = 0
  while (slot < 9) {
    if (m.u8((pUMods + slot) >>> 0) === 0) {
      break
    }
    slot = (slot + 1) | 0
    if (slot >= 9) {
      return
    }
  }
  if (slot >= 9) return

  const uMod = nUModId & 0xff
  m.setU8((pUMods + slot) >>> 0, uMod)
  const pfn = m.u32((D2GAME_MONUMOD_TABLE_VA_113C + imul32(nUModId | 0, 4)) >>> 0) >>> 0
  if (pfn === 0) return
  if (pfn === 0x6fc43020) {
    MONUMOD_RollBossOrMinionNameSeed113c(m, monster, nUModId | 0, bBoss)
    return
  }
  if (hooks !== undefined && hooks.onMonUMod !== undefined) {
    hooks.onMonUMod(m, pfn, monster, nUModId | 0, bBoss)
  }
}

// ============================================================================
// 2. QUESTS, PLAYER & MISSILE (`0x6FC559C0 .. 0x6FC59600`)
// ============================================================================

/**
 * Sends `pPlayer`'s (`edx`) quest log (`0x28` packet via `0x6FC54C00`) for `pGame` (`ecx`,
 * `[esp+4] = _uUnused`, `ret 4`), then queues 2-byte S2C packet `0x89` (`[0x89, pGame->pQuestControl->bPickedSet]`
 * from `[pQuestControl + 0x20]`) to `pPlayer`'s client (`0x6FCAA3E0`) and returns `0`.
 *
 * @va D2Game.dll@0x6fc559c0
 */
export function QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _uUnused = 0,
): number {
  hitD2GameVa113c(0x6FC559C0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  const pQuestControl = m.u32((game + 0x10f4) >>> 0) >>> 0
  const bQuestByte = m.u8((pQuestControl + 0x20) >>> 0)

  QUESTS_SendPlayerQuestLogPacket28_113c(m, player, game)

  let pClient = 0
  if (player !== 0 && (m.u32(player) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }

  const sp = k2W2B1StackPtr
  k2W2B1StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU8(sp, 0x89)
    m.setU8((sp + 0x01) >>> 0, bQuestByte)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 2)
  } finally {
    k2W2B1StackPtr = sp
  }
  return 0
}

/**
 * Checks whether living player `pPlayer` (`eax`, `dwUnitType == 0`) has any living hostile player
 * in `pGame` (`ecx`) by iterating all living players via `D2GAME_SUNIT_IterateAllLivingPlayers113c`
 * (`0x6FCFFC10`) with `PLAYER_CheckHostilePlayerCallback113c` (`0x6FC57940`).
 *
 * @va D2Game.dll@0x6fc57ac0
 */
export function PLAYER_HasAnyLivingHostilePlayer_6FC57AC0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
): number {
  hitD2GameVa113c(0x6FC57AC0)
  const game = pGame >>> 0
  const player = pPlayer >>> 0
  if (game === 0) return 0
  if (player === 0) return 0
  if ((m.u32(player) | 0) !== 0) return 0

  const sp = k2W2B1StackPtr
  k2W2B1StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU32(sp, 0)
    m.setU32((sp + 0x04) >>> 0, player)
    D2GAME_SUNIT_IterateAllLivingPlayers113c(
      m,
      game,
      PLAYER_CheckHostilePlayerCallback113c,
      sp,
    )
    return m.u32(sp) | 0
  } finally {
    k2W2B1StackPtr = sp
  }
}

/**
 * Initializes `pOutData->nRange` (`+0x44`) and `pOutData->dwFlags` (`+0x60 = 0x60`) for missile
 * `pMissile` (`edx`, `[esp+4] = _pGame`, `[esp+8] = pOutData`, `ret 8`), using `MissilesTxt.dwParam1`
 * (`+0x78`, stride `0x1A4` at `sgptDataTables + 0xB64`) when `> 0` or falling back to
 * `SKILLS_EvalLinearParam12_6FC21B10_113c(MISSILE_GetSkill(pMissile), MISSILE_GetLevel(pMissile))`.
 *
 * @va D2Game.dll@0x6fc59600
 */
export function MISSILE_InitMissileRangeAndFrameFlag_6FC59600_113c(
  m: Memory113c,
  pMissile: number,
  _pGame: number,
  pOutData: number,
): void {
  hitD2GameVa113c(0x6FC59600)
  const missile = pMissile >>> 0
  if (missile === 0) return
  const nMissileId = m.u32((missile + 0x04) >>> 0) | 0
  if (nMissileId < 0) return
  const pDataTables = getDataTablesPtr113c(m)
  const nCount = m.u32((pDataTables + 0xb6c) >>> 0) | 0
  if (nMissileId >= nCount) return
  const pBase = m.u32((pDataTables + 0xb64) >>> 0) >>> 0
  const pRec = (pBase + imul32(nMissileId, 0x1a4)) >>> 0
  if (pRec === 0) return

  const nSkillId = MISSILE_GetSkill113c(m, missile) | 0
  const nLevel = MISSILE_GetLevel113c(m, missile) | 0
  let nRange = m.u32((pRec + 0x78) >>> 0) | 0
  if (nRange <= 0) {
    nRange = SKILLS_EvalLinearParam12_6FC21B10_113c(m, nSkillId, nLevel) | 0
  }
  const out = pOutData >>> 0
  m.setU32((out + 0x44) >>> 0, nRange >>> 0)
  m.setU32((out + 0x60) >>> 0, 0x60)
}

// ============================================================================
// 3. ACT 5 QUEST CALLBACKS & OBJECT HANDLERS (`0x6FC77D80 .. 0x6FC7E7F0`)
// ============================================================================

/**
 * Party/player iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * if `pPlayer` carries quest item `'ice '` (`0x20656369`), locates quest `3` in `pGame->pQuestControl`
 * and sets `pQuestDataEx[+0xE2] = 1`.
 *
 * @va D2Game.dll@0x6fc77d80
 */
export function ACT5Q3_MarkQuest3PotionFlagIfPlayerHasIceItem_6FC77D80_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): void {
  hitD2GameVa113c(0x6FC77D80)
  const game = pGame >>> 0
  if (ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer >>> 0, game, 0x20656369) === 0) {
    return
  }
  const pQuest = findQuestNodeInChain113c(m, game, 3)
  if (pQuest === 0) return
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pQuestDataEx + 0xe2) >>> 0, 1)
}

/**
 * Act 5 Quest 3 `pfCallback11` (`+0xC8`, `ecx = pQuest`, `edx = pQuestArg`, plain `ret`):
 * removes `pQuestArg->pPlayer` GUID (`0xFFFFFFFF` if `NULL`) from both `pQuest + 0x1C` and
 * `pQuest->pQuestDataEx` (`[pQuest + 0x18]`), and decrements `pQuestDataEx[+0xD8]` if `pPlayer`
 * holds quest item `'ice '` (`0x20656369`).
 *
 * @va D2Game.dll@0x6fc78040
 */
export function ACT5Q3_Callback11_RemovePlayerGuidAndCheckIce_6FC78040_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC78040)
  const quest = pQuest >>> 0
  const arg = pQuestArg >>> 0
  const pPlayer0 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const guid0 = pPlayer0 === 0 ? 0xffffffff : m.u32((pPlayer0 + 0x0c) >>> 0) >>> 0
  QUESTS_GuidListRemove113c(m, (quest + 0x1c) >>> 0, guid0)

  const pPlayer1 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pQuestDataEx = m.u32((quest + 0x18) >>> 0) >>> 0
  const guid1 = pPlayer1 === 0 ? 0xffffffff : m.u32((pPlayer1 + 0x0c) >>> 0) >>> 0
  QUESTS_GuidListRemove113c(m, pQuestDataEx, guid1)

  const pPlayer2 = m.u32((arg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(arg) >>> 0
  const pItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pPlayer2, pGame, 0x20656369) >>> 0
  if (pItem !== 0) {
    m.setU32((pQuestDataEx + 0xd8) >>> 0, (m.u32((pQuestDataEx + 0xd8) >>> 0) - 1) >>> 0)
  }
  return pItem
}

/**
 * Act 5 Quest 4 `pfCallback11` (`+0xC8`, `ecx = pQuest`, `edx = pQuestArg`, plain `ret`):
 * removes `pQuestArg->pPlayer` GUID (`0xFFFFFFFF` if `NULL`) from `pQuest + 0x1C`.
 *
 * @va D2Game.dll@0x6fc787a0
 */
export function ACT5Q4_Callback11_RemovePlayerFromQuestGuidList_6FC787A0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FC787A0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const dwGuid = pPlayer === 0 ? 0xffffffff : m.u32((pPlayer + 0x0c) >>> 0) >>> 0
  return QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x28` state `0` is not `1`, sets `0x28` state `0x0E` and sends quest state
 * alert `0x5D` (`uQuestId = 0x24`, `uMinAct = 0`).
 *
 * @va D2Game.dll@0x6fc78ba0
 */
export function ACT5Q6_SyncPlayerQuest28State0EAlert24_6FC78BA0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC78BA0)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0) !== 1) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x28, 0x0e)
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x24, 0)
  }
  return 0
}

/**
 * Object operate handler (`ecx = pOpParam`, plain `ret`): when `pPlayer` (`[pOpParam + 0x08]`)
 * has `QUESTRECORD` `0x27` state `0 != 0` and state `4 == 0`, sends NPC message packet `0x27`
 * (`wMessageId = 0x4EC9`) for object `[pOpParam + 0x04]`.
 *
 * @va D2Game.dll@0x6fc78da0
 */
export function ACT5Q5_OnAncientsObjectOperateCompletedMsg_6FC78DA0_113c(
  m: Memory113c,
  pOpParam: number,
): number {
  hitD2GameVa113c(0x6FC78DA0)
  const op = pOpParam >>> 0
  const pPlayer0 = m.u32((op + 0x08) >>> 0) >>> 0
  const pGame0 = m.u32(op) >>> 0
  const pPlayerData0 = UNITS_GetPlayerData113c(m, pPlayer0) >>> 0
  const diffIdx0 = m.u8((pGame0 + 0x6d) >>> 0)
  const pQuestFlags0 = m.u32((pPlayerData0 + diffIdx0 * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags0, 0x27, 0) !== 0) {
    const pPlayer1 = m.u32((op + 0x08) >>> 0) >>> 0
    const pGame1 = m.u32(op) >>> 0
    const pPlayerData1 = UNITS_GetPlayerData113c(m, pPlayer1) >>> 0
    const diffIdx1 = m.u8((pGame1 + 0x6d) >>> 0)
    const pQuestFlags1 = m.u32((pPlayerData1 + diffIdx1 * 4 + 0x10) >>> 0) >>> 0
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags1, 0x27, 4) === 0) {
      const pObject = m.u32((op + 0x04) >>> 0) >>> 0
      const pPlayer2 = m.u32((op + 0x08) >>> 0) >>> 0
      QUESTS_SendNpcMessagePacket27_113c(m, pPlayer2, pObject, 0x4ec9)
    }
  }
  return 0
}

/**
 * Ancient statue object init handler (`ecx = pObjInit`): stores `pObject` GUID (`0xFFFFFFFF` if `NULL`)
 * at `pQuestDataEx + 0x1C` on quest `0x23` (`35`) and syncs statue anim mode via `0x6FC774F0`.
 *
 * @va D2Game.dll@0x6fc78e50
 */
export function ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC78E50)
  const init = pObjInit >>> 0
  const pGame = m.u32(init) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame, 0x23)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pObject = m.u32((init + 0x04) >>> 0) >>> 0
  const objGuid = pObject === 0 ? 0xffffffff : m.u32((pObject + 0x0c) >>> 0) >>> 0
  m.setU32((pQuestDataEx + 0x1c) >>> 0, objGuid)
  ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c(m, init, pQuestDataEx)
}

/**
 * Ancient statue object init handler (`ecx = pObjInit`): stores `pObject` GUID (`0xFFFFFFFF` if `NULL`)
 * at `pQuestDataEx + 0x18` on quest `0x23` (`35`) and syncs statue anim mode via `0x6FC774F0`.
 *
 * @va D2Game.dll@0x6fc78ea0
 */
export function ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC78EA0)
  const init = pObjInit >>> 0
  const pGame = m.u32(init) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame, 0x23)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pObject = m.u32((init + 0x04) >>> 0) >>> 0
  const objGuid = pObject === 0 ? 0xffffffff : m.u32((pObject + 0x0c) >>> 0) >>> 0
  m.setU32((pQuestDataEx + 0x18) >>> 0, objGuid)
  ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c(m, init, pQuestDataEx)
}

/**
 * Ancient statue object init handler (`ecx = pObjInit`): stores `pObject` GUID (`0xFFFFFFFF` if `NULL`)
 * at `pQuestDataEx + 0x14` on quest `0x23` (`35`) and syncs statue anim mode via `0x6FC774F0`.
 *
 * @va D2Game.dll@0x6fc78ef0
 */
export function ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  hitD2GameVa113c(0x6FC78EF0)
  const init = pObjInit >>> 0
  const pGame = m.u32(init) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame, 0x23)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const pObject = m.u32((init + 0x04) >>> 0) >>> 0
  const objGuid = pObject === 0 ? 0xffffffff : m.u32((pObject + 0x0c) >>> 0) >>> 0
  m.setU32((pQuestDataEx + 0x14) >>> 0, objGuid)
  ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c(m, init, pQuestDataEx)
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x27` states `0` and `0x0D` are both not `1`, sets `0x27` state `0x0E`
 * and sends quest state alert `0x5D` (`uQuestId = 0x23`, `uMinAct = 0`).
 *
 * @va D2Game.dll@0x6fc78f40
 */
export function ACT5Q5_SyncPlayerQuest27State0EAlert23_6FC78F40_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC78F40)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 0x0d) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x27, 0x0e)
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x23, 0)
  }
  return 0
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x26` state `0x0D` is set (`!= 0`), triggers unit event sound `0x52`
 * (`+0x6E = 0x52`, `+0x70 = pPlayer`, `UNITROOM_RefreshUnit`, `+0xC4 |= 0x400`) on `pPlayer`.
 *
 * @va D2Game.dll@0x6fc78ff0
 */
export function ACT5Q4_ApplyPlayerSkillState52IfQuest26State0D_6FC78FF0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC78FF0)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0d) !== 0) {
    applySelfUnitEventSound113c(m, player, 0x52)
  }
  return 0
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x26` states `0`, `1`, and `0x0D` are all not `1`, sets `0x26` state `0x0E`
 * and sends quest state alert `0x5D` (`uQuestId = 0x22`, `uMinAct = 0`).
 *
 * @va D2Game.dll@0x6fc79060
 */
export function ACT5Q4_SyncPlayerQuest26State0EAlert22_6FC79060_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC79060)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 1) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0d) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0x0e)
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x22, 0)
  }
  return 0
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x25` states `0`, `1`, and `0x0D` are all not `1`, sets `0x25` state `0x0E`
 * and sends quest state alert `0x5D` (`uQuestId = 0x21`, `uMinAct = 0`).
 *
 * @va D2Game.dll@0x6fc79120
 */
export function ACT5Q3_SyncPlayerQuest25State0EAlert21_6FC79120_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC79120)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0x0d) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 0x0e)
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x21, 0)
  }
  return 0
}

/**
 * Queues 6-byte S2C quest status packet `0x5D` (`[0x5D, 0x21, 0x20, 0x00, 0x00, 0x00]`)
 * to `pPlayer`'s (`ecx`) client via `0x6FCAA3E0`.
 *
 * @va D2Game.dll@0x6fc79180
 */
export function ACT5Q3_SendQuest21State20Packet5D_6FC79180_113c(
  m: Memory113c,
  pPlayer: number,
): void {
  hitD2GameVa113c(0x6FC79180)
  const player = pPlayer >>> 0
  let pClient = 0
  if (player !== 0 && (m.u32(player) | 0) === 0) {
    const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
    pClient = m.u32((pPlayerData + 0x9c) >>> 0) >>> 0
  }
  const sp = k2W2B1StackPtr
  k2W2B1StackPtr = (sp + 0x10) >>> 0
  try {
    m.setU32(sp, 0x0020215d)
    m.setU16((sp + 0x04) >>> 0, 0)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, sp, 6)
  } finally {
    k2W2B1StackPtr = sp
  }
}

/**
 * Increments the prison group kill/rescue counter (`pQuestDataEx + 0x114 + groupIdx * 4`) for
 * soldier unit `pUnit` (`[esp+4]`, `eax = pGame`, `ret 4`) on active Act 5 Quest 2 (`0x20`,
 * `pQuest->bActive != 0` at `+0x09`), setting `pQuestDataEx[+0x108 + groupIdx] = 1` when `>= 5`.
 *
 * @va D2Game.dll@0x6fc79230
 */
export function ACT5Q2_IncrementPrisonGroupKillCount_6FC79230_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  hitD2GameVa113c(0x6FC79230)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x20)
  if (pQuest === 0) return
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const groupIdx = ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, pUnit >>> 0, pQuest) | 0
  if (groupIdx < 0) return
  const countAddr = (pQuestDataEx + groupIdx * 4 + 0x114) >>> 0
  const nextCount = ((m.u32(countAddr) | 0) + 1) | 0
  m.setU32(countAddr, nextCount >>> 0)
  if (nextCount >= 5) {
    m.setU8((pQuestDataEx + groupIdx + 0x108) >>> 0, 1)
  }
}

/**
 * Checks whether soldier unit `pUnit` (`[esp+4]`, `eax = pGame`, `ret 4`) belongs to a prison
 * group (`0..2`) on active Act 5 Quest 2 (`0x20`, `+0x09 != 0`) with a non-zero counter at
 * `pQuestDataEx + 0x114 + groupIdx * 4`.
 *
 * @va D2Game.dll@0x6fc79290
 */
export function ACT5Q2_HasPrisonGroupAnyKills_6FC79290_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC79290)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x20)
  if (pQuest === 0) return 0
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return 0
  const groupIdx = ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(m, pUnit >>> 0, pQuest) | 0
  if (groupIdx < 0) return 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u32((pQuestDataEx + groupIdx * 4 + 0x114) >>> 0) === 0) return 0
  return 1
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x24` state `0x0D` is set (`!= 0`), triggers unit event sound `0x51`
 * (`+0x6E = 0x51`, `+0x70 = pPlayer`, `UNITROOM_RefreshUnit`, `+0xC4 |= 0x400`) on `pPlayer`.
 *
 * @va D2Game.dll@0x6fc792f0
 */
export function ACT5Q2_ApplyPlayerSkillState51IfQuest24State0D_6FC792F0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC792F0)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 0x0d) !== 0) {
    applySelfUnitEventSound113c(m, player, 0x51)
  }
  return 0
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x24` states `0`, `1`, and `0x0D` are all not `1`, sets `0x24` state `0x0E`
 * and sends quest state alert `0x5D` (`uQuestId = 0x20`, `uMinAct = 0`).
 *
 * @va D2Game.dll@0x6fc79390
 */
export function ACT5Q2_SyncPlayerQuest24State0EAlert20_6FC79390_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC79390)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 1) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 0x0d) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 0x0e)
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x20, 0)
  }
  return 0
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x23` state `0x0D` is set (`!= 0`), triggers unit event sound `0x50`
 * (`+0x6E = 0x50`, `+0x70 = pPlayer`, `UNITROOM_RefreshUnit`, `+0xC4 |= 0x400`) on `pPlayer`.
 *
 * @va D2Game.dll@0x6fc79550
 */
export function ACT5Q1_ApplyPlayerSkillState50IfQuest23State0D_6FC79550_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC79550)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0x0d) !== 0) {
    applySelfUnitEventSound113c(m, player, 0x50)
  }
  return 0
}

/**
 * Party/player callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 4`):
 * when `QUESTRECORD` `0x23` states `0`, `1`, and `0x0D` are all not `1`, sets `0x23` state `0x0E`
 * and sends quest state alert `0x5D` (`uQuestId = 0x1F`, `uMinAct = 0`).
 *
 * @va D2Game.dll@0x6fc795c0
 */
export function ACT5Q1_SyncPlayerQuest23State0EAlert1F_6FC795C0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg = 0,
): number {
  hitD2GameVa113c(0x6FC795C0)
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 1) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x23, 0x0d) !== 1
  ) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x23, 0x0e)
    QUESTS_SendQuestStateAlert5D_113c(m, player, 0x1f, 0)
  }
  return 0
}

/**
 * Object operate handler A (`ecx = pOpParam`, plain `ret`): triggers unit event sound `0x13`
 * on `pOpParam->pPlayer` (`[pOpParam + 0x08]`, asserting `line 0x558` if `NULL`) and returns `0`.
 *
 * @va D2Game.dll@0x6fc79a60
 */
export function ACT5Q4_OnObjectOperateApplySkillState13A_6FC79A60_113c(
  m: Memory113c,
  pOpParam: number,
): number {
  hitD2GameVa113c(0x6FC79A60)
  const pPlayer = m.u32((pOpParam + 0x08) >>> 0) >>> 0
  applySelfUnitEventSound113c(m, pPlayer, 0x13)
  return 0
}

/**
 * Object operate handler B (`ecx = pOpParam`, plain `ret`): triggers unit event sound `0x13`
 * on `pOpParam->pPlayer` (`[pOpParam + 0x08]`, asserting `line 0x558` if `NULL`) and returns `0`.
 *
 * @va D2Game.dll@0x6fc79ab0
 */
export function ACT5Q4_OnObjectOperateApplySkillState13B_6FC79AB0_113c(
  m: Memory113c,
  pOpParam: number,
): number {
  hitD2GameVa113c(0x6FC79AB0)
  const pPlayer = m.u32((pOpParam + 0x08) >>> 0) >>> 0
  applySelfUnitEventSound113c(m, pPlayer, 0x13)
  return 0
}

/**
 * Object operate handler C (`ecx = pOpParam`, plain `ret`): triggers unit event sound `0x13`
 * on `pOpParam->pPlayer` (`[pOpParam + 0x08]`, asserting `line 0x558` if `NULL`) and returns `0`.
 *
 * @va D2Game.dll@0x6fc79b00
 */
export function ACT5Q4_OnObjectOperateApplySkillState13C_6FC79B00_113c(
  m: Memory113c,
  pOpParam: number,
): number {
  hitD2GameVa113c(0x6FC79B00)
  const pPlayer = m.u32((pOpParam + 0x08) >>> 0) >>> 0
  applySelfUnitEventSound113c(m, pPlayer, 0x13)
  return 0
}

/**
 * Schedules a type-`7` timer event (`EVENT_SetEventFull113c`) at `pGame->dwGameFrame + 12` (`+0xA8`)
 * on `pUnit` (`[esp+4]`, `ecx = pGame`, `ret 4`) when quest `0x22` (`34`) has `pQuestDataEx[+0x87] != 0`.
 *
 * @va D2Game.dll@0x6fc7e7f0
 */
export function ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: K2W2B1Hooks113c,
): void {
  hitD2GameVa113c(0x6FC7E7F0)
  const game = pGame >>> 0
  const pQuest = findQuestNodeInChain113c(m, game, 0x22)
  if (pQuest === 0) return
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x87) >>> 0) === 0) return
  const targetFrame = ((m.u32((game + 0xa8) >>> 0) | 0) + 0x0c) | 0
  EVENT_SetEventFull113c(
    m,
    game,
    pUnit >>> 0,
    7,
    targetFrame,
    0,
    0,
    0,
    hooks !== undefined ? hooks.eventWheel : undefined,
  )
}

// ============================================================================
// 4. ACT 1 QUEST 4 (`Search for Cain`) & INTRO FILTERS (`0x6FC80170 .. 0x6FC80810`)
// ============================================================================

/**
 * Act 4 Tyrael intro `pfStatusFilter` (`+0xE8`, `xor al, al; ret 0xC`): unconditionally returns `0`.
 *
 * @va D2Game.dll@0x6fc80170
 */
export function ACT4_IntroStatusFilter_6FC80170_113c(
  _m?: Memory113c,
  _pQuest = 0,
  _pPlayer = 0,
  _pGlobalFlags = 0,
  _pPlayerFlags = 0,
  _pOutStatus = 0,
): number {
  hitD2GameVa113c(0x6FC80170)
  return 0
}

/**
 * Act 4 Tyrael intro `pfCallback08` (`+0xC0`, `ret`): no-op callback.
 *
 * @va D2Game.dll@0x6fc80180
 */
export function ACT4_IntroCallback08Noop_6FC80180_113c(
  _m?: Memory113c,
  _pQuest = 0,
  _pQuestArg = 0,
): void {
  hitD2GameVa113c(0x6FC80180)
}

/**
 * Checks whether Act 1 Quest 4 (`dwQuestId == 4`) has `pQuestDataEx[+0x93] != 0` (`eax = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fc80390
 */
export function ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC80390)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 4)
  if (pQuest === 0) return 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  return m.u8((pQuestDataEx + 0x93) >>> 0) !== 0 ? 1 : 0
}

/**
 * Sets `pQuestDataEx[+0x92] = 1` on Act 1 Quest 4 (`dwQuestId == 4`, `eax = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fc803d0
 */
export function ACT1Q4_MarkPortalOpenedFlag92_6FC803D0_113c(
  m: Memory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC803D0)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 4)
  if (pQuest === 0) return
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pQuestDataEx + 0x92) >>> 0, 1)
}

/**
 * Records `pUnit`'s (`edx`) position into `pQuestDataEx + 0x9C` via `PATH_GetTargetTypeAndPosition113c`
 * and sets `pQuestDataEx[+0x67] = 1` on Act 1 Quest 4 (`dwQuestId == 4`, `ecx = pGame`, plain `ret`)
 * if `pQuestDataEx[+0x67] == 0`.
 *
 * @va D2Game.dll@0x6fc80400
 */
export function ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  hitD2GameVa113c(0x6FC80400)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 4)
  if (pQuest === 0) return 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x67) >>> 0) !== 0) return 0
  PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, (pQuestDataEx + 0x9c) >>> 0)
  m.setU8((pQuestDataEx + 0x67) >>> 0, 1)
  return 1
}

/**
 * Writes Tristram portal target coordinates into `pOutCoords` (`[esp+4]`, `ecx = pGame`, `edx = pUnit`,
 * `ret 4`) for Act 1 Quest 4 (`dwQuestId == 4`): copies `(pQuestDataEx[+0x9C], pQuestDataEx[+0xA0])`
 * when `pQuestDataEx[+0x95] != 0`, or queries `PATH_GetTargetTypeAndPosition113c(pUnit, pOutCoords)` otherwise.
 *
 * @va D2Game.dll@0x6fc80450
 */
export function ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pOutCoords: number,
): number {
  hitD2GameVa113c(0x6FC80450)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 4)
  if (pQuest === 0) return 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const out = pOutCoords >>> 0
  if (m.u8((pQuestDataEx + 0x95) >>> 0) === 0) {
    PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, out)
    return 1
  }
  m.setU32(out, m.u32((pQuestDataEx + 0x9c) >>> 0))
  m.setU32((out + 0x04) >>> 0, m.u32((pQuestDataEx + 0xa0) >>> 0))
  return 1
}

/**
 * Copies Cairn Stones target coordinates `(pQuestDataEx[+0xA8], pQuestDataEx[+0xAC])` into
 * `pOutCoords` (`ecx`, `eax = pGame`, plain `ret`) when Act 1 Quest 4 (`dwQuestId == 4`) is
 * active (`pQuest[+0x09] != 0`), has `pQuestDataEx[+0x96] != 0`, and has `pQuestDataEx[+0x92] == 0`.
 *
 * @va D2Game.dll@0x6fc804c0
 */
export function ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c(
  m: Memory113c,
  pGame: number,
  pOutCoords: number,
): number {
  hitD2GameVa113c(0x6FC804C0)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 4)
  if (pQuest === 0) return 0
  if (m.u8((pQuest + 0x09) >>> 0) === 0) return 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x96) >>> 0) === 0) return 0
  if (m.u8((pQuestDataEx + 0x92) >>> 0) !== 0) return 0
  const out = pOutCoords >>> 0
  m.setU32(out, m.u32((pQuestDataEx + 0xa8) >>> 0))
  m.setU32((out + 0x04) >>> 0, m.u32((pQuestDataEx + 0xac) >>> 0))
  return 1
}

/**
 * Sets `pQuestDataEx[+0x52] = 1` on Act 1 Quest 4 (`dwQuestId == 4`, `eax = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fc80590
 */
export function ACT1Q4_MarkFlag52_6FC80590_113c(
  m: Memory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC80590)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 4)
  if (pQuest === 0) return
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pQuestDataEx + 0x52) >>> 0, 1)
}

/**
 * Sets `pQuestDataEx[+0x63] = 1` on Act 1 Quest 4 (`dwQuestId == 4`, `eax = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fc805c0
 */
export function ACT1Q4_MarkFlag63_6FC805C0_113c(
  m: Memory113c,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FC805C0)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 4)
  if (pQuest === 0) return
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pQuestDataEx + 0x63) >>> 0, 1)
}

/**
 * Stores portal unit pointer `pUnit` (`edx`) into `pQuestDataEx + 0x74` on Act 1 Quest 4
 * (`dwQuestId == 4`, `ecx = pGame`, `[esp+4] = _uUnused`, `ret 4`) when `UNITS_GetRoom(pUnit)`
 * is in `LEVEL_TRISTRAM` (`0x26 = 38`), returning `1` on match (`0` otherwise).
 *
 * @va D2Game.dll@0x6fc805f0
 */
export function ACT1Q4_StoreTristramPortalUnitIfInTristram_6FC805F0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _uUnused = 0,
): number {
  hitD2GameVa113c(0x6FC805F0)
  const unit = pUnit >>> 0
  const pRoom = UNITS_GetRoom113c(m, unit) >>> 0
  if (pRoom === 0) return 0
  if ((DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0) !== 0x26) return 0
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 4)
  if (pQuest === 0) return 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU32((pQuestDataEx + 0x74) >>> 0, unit)
  return 1
}

/**
 * Act 1 Warriv intro `pfStatusFilter` (`+0xE8`, `xor al, al; ret 0xC`): unconditionally returns `0`.
 *
 * @va D2Game.dll@0x6fc80800
 */
export function ACT1_IntroStatusFilter_6FC80800_113c(
  _m?: Memory113c,
  _pQuest = 0,
  _pPlayer = 0,
  _pGlobalFlags = 0,
  _pPlayerFlags = 0,
  _pOutStatus = 0,
): number {
  hitD2GameVa113c(0x6FC80800)
  return 0
}

/**
 * Act 5 Tyrael endgame `pfStatusFilter` (`+0xE8`, `ret 0xC`): clears `*pOutStatus = 0` (`[esp+0xC]`)
 * and returns `0`.
 *
 * @va D2Game.dll@0x6fc80810
 */
export function ACT4_EndgameStatusFilter_6FC80810_113c(
  m: Memory113c,
  _pQuest: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  _pPlayerFlags: number,
  pOutStatus: number,
): number {
  hitD2GameVa113c(0x6FC80810)
  m.setU8(pOutStatus >>> 0, 0)
  return 0
}
