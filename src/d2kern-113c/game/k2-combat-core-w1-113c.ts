/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Phase 2 Wave 1 Lane C ports (45 VAs across
 * `0x6FC90010..0x6FC9BD00` and `0x6FCEB190..0x6FCFAE20`).
 *
 * Covers:
 * - `PLAYER` / `PlrTrade` (`0x6FC90010..0x6FC90D60`, 9 VAs): trade item ear/personalized sync,
 *   Horadric Cube page checks and counts, trade action button no-ops, belt-change gate during
 *   active trade, `S2C 0x77` accept-button + state-3 transition, `S2C 0x92` merc-equip clear
 *   broadcast callback, and live trade-partner validation.
 * - `MONSTER` / `PLAYER` Modes & AI (`0x6FC94890..0x6FC9BD00`, 11 VAs): `S3` end-mode no-op,
 *   monster timer event `10` (`+0x34`/`+0x38` clear), player skill-mode dispatch handlers,
 *   player active-skill interruptibility & `EVENTTYPE_ENDANIM` 5-frame window check,
 *   `S2C 0x0A` remove-unit packet sender, `UberMephisto` think no-op, spawner AI init frame
 *   reset, `D2MonsterRegionStrc + 0x2D4` sub-variant roll, and `WillOWisp` living-unit filter.
 * - `PACKET` C2S / S2C (`0x6FCEB190..0x6FCECB10`, 16 VAs): C2S `0x2E`/`0x42`/`0x43`/`0x66`
 *   accept no-ops, C2S `0x2C`/`0x2D`/`0x39`/`0x45`/`0x52` reject-3 stubs, cross-Act unit check,
 *   C2S `0x58` quest-intro state setter, `S2C 0x0F` sequence-mode unit movement sync,
 *   `S2C 0x15` unit position reassign sync, `S2C 0x5A` event-message `0x0E` sender,
 *   C2S `0x4B` adjacent-room unit refresh handler, and different-player trade check.
 * - `ITEMS` / `ItemMode` & `SUNITDMG` (`0x6FCF16B0..0x6FCFAE20`, 9 VAs): magic/auto affix
 *   equality check, opposite hand/ring/swap body-location resolver, item timer partition no-op,
 *   two-slot weapon/quiver/shield/dual-wield compatibility check, unordered item-code pair
 *   matcher, socketed sub-item presence check, `D2ItemDropStrc` builder from source item,
 *   command-flag `0x04` clear + `S2C 0x3F` sync, and defender `MonStats.txt` `coldEffect` reader.
 *
 * Operates strictly on `Memory113c` virtual pointers with zero JS Maps, zero array sorting,
 * and zero nullish coalescing fallbacks.
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts'
import { imul32 } from '../common/int-math.ts'
import {
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemCount113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_UnitIsItem113c,
} from '../common/inventory.ts'
import {
  ITEMS_CheckCommandFlags113c,
  ITEMS_GetAutoAffix113c,
  ITEMS_GetEarLevel113c,
  ITEMS_GetEarName113c,
  ITEMS_GetInvPage113c,
  ITEMS_GetItemLevel113c,
  ITEMS_GetItemTypeFromItem113c,
  ITEMS_GetMagicPrefix113c,
  ITEMS_GetMagicSuffix113c,
  ITEMS_GetOwnerGuid113c,
  ITEMS_GetSubTypeFromItem113c,
  ITEMS_SetEarLevel113c,
  ITEMS_SetEarName113c,
  ITEMS_SetOrClearCommandFlags113c,
} from '../common/items.ts'
import {
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
} from '../common/path.ts'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record.ts'
import {
  SGPT_DATATABLES_VA_113C,
  SKILLS_GetSkillsTxtFromSkill113c,
  SKILLS_GetUsedSkill113c,
} from '../common/skills.ts'
import {
  UNITROOM_RefreshUnit113c,
  UNITS_AreInAdjacentRooms113c,
  UNITS_GetRoom113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { MONSTERS_IsDead113c } from '../tables/datatbls-113c.ts'
import {
  NET_QueuePacketToClientBuffer113c,
  NET_SendFixed40BytePacketToClient113c,
} from './boot-init-gap-a-113c.ts'
import { SUNIT_GetServerUnit113c } from './game-strc.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  MONSTER_GetBaseIdFromUnit113c,
  SEED_RollRangeHalfOpen113c,
} from './regpop-spawn-113c.ts'
import { EVENT_GetNextEventFrame113c } from './timer-wheel.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/** `D2Game.dll` `.data` `0x6FD22CE0`: 20-entry `itemActionPacketSubTable` (`12` bytes per `dwAnimMode`). */
export const D2GAME_PLR_MODE_SYNC_TABLE_VA_113C = 0x6fd22ce0

/**
 * Exact byte at `0x6FD22CE4 + nAnimMode * 12` (`nArg0` low byte) across `dwAnimMode = 0..19`
 * from `D2Game.dll` `.data` (`0x6FD22CE0..0x6FD22DCF`), used when `.data` is not hydrated into `m`.
 */
const PLR_MODE_SYNC_SUBTYPE_6FD22CE4_113C: readonly number[] = [
  8, 7, 1, 23, 6, 7, 1, 21, 21, 18, 21, 21, 21, 21, 21, 21, 21, 9, 21, 20,
]

/** Reentrant scratch stack pointer for out-going packet buffers in `Memory113c`. */
let k2LaneCStackPtr = 0x7ff88000

function allocScratchBytes113c(m: Memory113c, size: number): number {
  const ptr = k2LaneCStackPtr >>> 0
  const aligned = (size + 15) & ~15
  k2LaneCStackPtr = (ptr + aligned) >>> 0
  for (let i = 0; i < aligned; i += 4) {
    m.setU32((ptr + i) >>> 0, 0)
  }
  return ptr
}

function freeScratchBytes113c(savedPtr: number): void {
  k2LaneCStackPtr = savedPtr >>> 0
}

function readSgptDataTablesPtr113c(m: Memory113c): number {
  try {
    const iatSlot = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
    if (iatSlot === SGPT_DATATABLES_VA_113C) {
      return m.u32(SGPT_DATATABLES_VA_113C) >>> 0
    }
    if (iatSlot !== 0) {
      try {
        const deref = m.u32(iatSlot) >>> 0
        if (deref !== 0) return deref
      } catch {
        // iatSlot itself is the direct pTables pointer
      }
      return iatSlot
    }
  } catch {
    // Fall back to SGPT_DATATABLES_VA_113C below
  }
  try {
    return m.u32(SGPT_DATATABLES_VA_113C) >>> 0
  } catch {
    return 0
  }
}

function resolvePlayerClientPtr113c(m: Memory113c, pUnit: number): number {
  const ptr = pUnit >>> 0
  if (ptr === 0) return 0
  if (m.u32(ptr) !== 0) return 0
  const pPlayerData = UNITS_GetPlayerData113c(m, ptr) >>> 0
  return pPlayerData !== 0 ? m.u32((pPlayerData + 0x9c) >>> 0) >>> 0 : 0
}

function isStaticPathUnitType113c(dwUnitType: number): boolean {
  const t = dwUnitType | 0
  return t === 2 || (t > 3 && t <= 5)
}

function readUnitPosXInline113c(m: Memory113c, pUnit: number): number {
  const dwUnitType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (isStaticPathUnitType113c(dwUnitType)) {
    return pPath !== 0 ? m.u32((pPath + 0x0c) >>> 0) : 0
  }
  return pPath !== 0 ? PATH_GetPosX113c(m, pPath) : 0
}

function readUnitPosYInline113c(m: Memory113c, pUnit: number): number {
  const dwUnitType = m.u32(pUnit >>> 0) | 0
  const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
  if (isStaticPathUnitType113c(dwUnitType)) {
    return pPath !== 0 ? m.u32((pPath + 0x10) >>> 0) : 0
  }
  return pPath !== 0 ? PATH_GetPosY113c(m, pPath) : 0
}

function readPlrModeSyncSubtypeByte113c(m: Memory113c, nAnimMode: number): number {
  const entryAddr = (D2GAME_PLR_MODE_SYNC_TABLE_VA_113C + 4 + imul32(nAnimMode | 0, 12)) >>> 0
  try {
    const memByte = m.u8(entryAddr) & 0xff
    if (memByte !== 0) {
      return memByte
    }
  } catch {
    // Unloaded .data page in SparseMemory113c; use static 1.13c .data table below.
  }
  const idx = nAnimMode >>> 0
  if (idx < PLR_MODE_SYNC_SUBTYPE_6FD22CE4_113C.length) {
    return PLR_MODE_SYNC_SUBTYPE_6FD22CE4_113C[idx]! & 0xff
  }
  return 0
}

// ============================================================================
// Group A: PLAYER / PlrTrade (0x6FC90010..0x6FC90D60 — 9 VAs)
// ============================================================================

/**
 * Synchronizes ear metadata (`szPlayerName`, `bEarLevel`, command flag `0x8000`) when `pDstItem`
 * has `ItemType == 7` (`ITEMTYPE_PLAYER_BODY_PART`), or copies personalized name (`szPlayerName`)
 * when `pDstItem` has command flag `0x01000000` set.
 *
 * Binary convention: `esi = pDstItem`, `edi = pSrcItem`, `[esp+4] = bSetCmdFlag8000`, `ret 4`.
 *
 * @va D2Game:0x6FC90010
 */
export function PLRTRADE_SyncClonedItemEarOrPersonalizedData113c(
  m: Memory113c,
  pDstItem: number,
  pSrcItem: number,
  bSetCmdFlag8000: number,
): void {
  hitD2GameVa113c(0x6FC90010)
  const dst = pDstItem >>> 0
  if (dst === 0) return
  const itemType = ITEMS_GetItemTypeFromItem113c(m, dst) | 0
  if (itemType === 7) {
    const szEarName = ITEMS_GetEarName113c(m, pSrcItem >>> 0)
    ITEMS_SetEarName113c(m, dst, szEarName)
    const nEarLevel = ITEMS_GetEarLevel113c(m, pSrcItem >>> 0)
    ITEMS_SetEarLevel113c(m, dst, nEarLevel)
    ITEMS_SetOrClearCommandFlags113c(m, dst, 0x8000, bSetCmdFlag8000 | 0)
    return
  }
  if (ITEMS_CheckCommandFlags113c(m, dst, 0x01000000) !== 0) {
    const szEarName = ITEMS_GetEarName113c(m, pSrcItem >>> 0)
    ITEMS_SetEarName113c(m, dst, szEarName)
  }
}

/**
 * Scans `pUnit->pInventory` (`+0x60`) and returns `1` if any contained item resides on
 * inventory page `3` (`INV_PAGE_CUBE`), else `0`.
 *
 * Binary convention: `eax = pUnit`, `ret`.
 *
 * @va D2Game:0x6FC90080
 */
export function PLRTRADE_HasAnyCubePageItemOnUnit113c(m: Memory113c, pUnit: number): number {
  hitD2GameVa113c(0x6FC90080)
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pInventory = m.u32((u + 0x60) >>> 0) >>> 0
  let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (pNode !== 0) {
    const pNext = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) === 3) {
      return 1
    }
    pNode = pNext
  }
  return 0
}

/**
 * No-op trade button callback (`tradeActionCallbacksTable[3]` at `0x6FD1A5F4`); returns `0`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer)`, `ret`.
 *
 * @va D2Game:0x6FC90170
 */
export function PLRTRADE_TradeButtonNoopAction3_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
): number {
  hitD2GameVa113c(0x6FC90170)
  return 0
}

/**
 * No-op trade button callback (`tradeActionCallbacksTable[2]` at `0x6FD1A5F0`); returns `0`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer)`, `ret`.
 *
 * @va D2Game:0x6FC90180
 */
export function PLRTRADE_TradeButtonNoopAction2_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
): number {
  hitD2GameVa113c(0x6FC90180)
  return 0
}

/**
 * Counts how many items in `pInventory` reside on inventory page `3` (`INV_PAGE_CUBE`).
 *
 * Binary convention: `eax = pInventory`, `ret`.
 *
 * @va D2Game:0x6FC90190
 */
export function PLRTRADE_CountCubePageItemsInInventory113c(
  m: Memory113c,
  pInventory: number,
): number {
  hitD2GameVa113c(0x6FC90190)
  let count = 0
  let pNode = INVENTORY_GetFirstItem113c(m, pInventory >>> 0) >>> 0
  while (pNode !== 0) {
    const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
    pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    if ((ITEMS_GetInvPage113c(m, pItem) & 0xff) === 3) {
      count = (count + 1) | 0
    }
  }
  return count
}

/**
 * Returns `0` when `pUnit` is actively trading with another player (`bInteracting != 0` at `+0x6C`
 * and `dwInteractType == 0` at `+0x68`) AND at least one item in `pUnit->pInventory` (`+0x60`) has
 * `nNodePosOther == 2`; otherwise returns `1`.
 *
 * Binary convention: `eax = pUnit`, `ret`.
 *
 * @va D2Game:0x6FC901F0
 */
export function PLRTRADE_CanModifyBeltDuringTrade113c(m: Memory113c, pUnit: number): number {
  hitD2GameVa113c(0x6FC901F0)
  const u = pUnit >>> 0
  if (u === 0) return 1
  if (m.u8((u + 0x6c) >>> 0) === 0) return 1
  if (m.u32((u + 0x68) >>> 0) !== 0) return 1
  const pInventory = m.u32((u + 0x60) >>> 0) >>> 0
  let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  while (pNode !== 0) {
    if ((INVENTORY_GetItemNodePositionOther113c(m, pNode) | 0) === 2) {
      return 0
    }
    pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
  }
  return 1
}

/**
 * Queues `S2C 0x77` (`subAction = 0x06`, 2 bytes) to both `pPlayer1` and `pPlayer2` clients,
 * sets `[pTrade1 + 0x50] = 3` and `[pTrade2 + 0x50] = 3`, and returns `3`.
 *
 * Binary convention: `eax = pPlayer1`, `esi = pPlayer2`, `[esp+4] = pTrade1`, `[esp+8] = pTrade2`, `ret 8`.
 *
 * @va D2Game:0x6FC90B70
 */
export function PLRTRADE_SendTradeAcceptButtonAndSetState3_113c(
  m: Memory113c,
  pPlayer1: number,
  pPlayer2: number,
  pTrade1: number,
  pTrade2: number,
): number {
  hitD2GameVa113c(0x6FC90B70)
  const sp = k2LaneCStackPtr
  const pkt = allocScratchBytes113c(m, 4)
  try {
    const pClient1 = resolvePlayerClientPtr113c(m, pPlayer1)
    m.setU8(pkt, 0x77)
    m.setU8((pkt + 1) >>> 0, 0x06)
    NET_QueuePacketToClientBuffer113c(m, pClient1, 1, pkt, 2)

    const pClient2 = resolvePlayerClientPtr113c(m, pPlayer2)
    m.setU8(pkt, 0x77)
    m.setU8((pkt + 1) >>> 0, 0x06)
    NET_QueuePacketToClientBuffer113c(m, pClient2, 1, pkt, 2)

    if (pTrade1 >>> 0 !== 0) {
      m.setU32((pTrade1 + 0x50) >>> 0, 3)
    }
    if (pTrade2 >>> 0 !== 0) {
      m.setU32((pTrade2 + 0x50) >>> 0, 3)
    }
    return 3
  } finally {
    freeScratchBytes113c(sp)
  }
}

/**
 * Per-player iteration callback (`0x6FCFFC10`): if `pTargetPlayer !== pSourcePlayer`, queues
 * 6-byte `S2C 0x92` (`{ 0x92, 0x00, dwOwnerGuid }`, where `dwOwnerGuid` is `pSourcePlayer->dwUnitId`
 * or `0xFFFFFFFF` if `pSourcePlayer == 0`) to `pTargetPlayer`'s client.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pTargetPlayer, [esp+4] = pSourcePlayer)`, `ret 4`.
 *
 * @va D2Game:0x6FC90C90
 */
export function PLRTRADE_BroadcastClearMercUnitCallback113c(
  m: Memory113c,
  _pGame: number,
  pTargetPlayer: number,
  pSourcePlayer: number,
): void {
  hitD2GameVa113c(0x6FC90C90)
  const dst = pTargetPlayer >>> 0
  const src = pSourcePlayer >>> 0
  if (dst === src) return

  const dwOwnerGuid = src !== 0 ? m.u32((src + 0x0c) >>> 0) >>> 0 : 0xffffffff
  const pClient = resolvePlayerClientPtr113c(m, dst)

  const sp = k2LaneCStackPtr
  const pkt = allocScratchBytes113c(m, 8)
  try {
    m.setU8(pkt, 0x92)
    m.setU8((pkt + 1) >>> 0, 0x00)
    m.setU32((pkt + 2) >>> 0, dwOwnerGuid)
    NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt, 6)
  } finally {
    freeScratchBytes113c(sp)
  }
}

/**
 * Returns `1` if `pPlayer` has `bInteracting != 0` (`+0x6C`), `dwInteractType == 0` (`+0x68`),
 * and `SUNIT_GetServerUnit(pGame, 0, pPlayer->dwInteractGuid)` resolves to a live player unit;
 * otherwise returns `0`.
 *
 * Binary convention: `ecx = pPlayer`, `[esp+4] = pGame`, `ret 4`.
 *
 * @va D2Game:0x6FC90D60
 */
export function PLRTRADE_IsInteractingWithValidPlayer113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC90D60)
  const plr = pPlayer >>> 0
  if (plr === 0) return 0
  const dwInteractGuid = m.u32((plr + 0x64) >>> 0) >>> 0
  const dwInteractType = m.u32((plr + 0x68) >>> 0) >>> 0
  const bInteracting = m.u8((plr + 0x6c) >>> 0)
  if (bInteracting === 0 || dwInteractType !== 0) return 0
  const pOther = SUNIT_GetServerUnit113c(m, pGame >>> 0, 0, dwInteractGuid) >>> 0
  return pOther !== 0 ? 1 : 0
}

// ============================================================================
// Group B: MONSTER / PLAYER Modes & AI (0x6FC94890..0x6FC9BD00 — 11 VAs)
// ============================================================================

/**
 * Monster mode `10` (`MONMODE_SKILL3`) `pfnEnd` no-op callback (`monsterModeEventTable[10].pfnEnd`
 * at `0x6FD1A540`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit)`, `ret`.
 *
 * @va D2Game:0x6FC94890
 */
export function MONSTER_EndModeS3Noop113c(_m: Memory113c, _pGame = 0, _pUnit = 0): void {
  hitD2GameVa113c(0x6FC94890)
}

/**
 * Monster timer wheel event `10` handler (`monsterEventFunctionsTable[10]` at `0x6FD1BC3C`):
 * clears `pMonsterData + 0x38` and `pMonsterData + 0x34` when `pUnit` is a monster (`dwUnitType == 1`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = nArg1, [esp+8] = nArg2)`, `ret 8`.
 *
 * @va D2Game:0x6FC94E40
 */
export function MONSTER_Event10_ClearMonsterFields34And38_113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
  _nEventArg1 = 0,
  _nEventArg2 = 0,
): void {
  hitD2GameVa113c(0x6FC94E40)
  const u = pUnit >>> 0
  if (u === 0) return
  if ((m.u32(u) | 0) !== 1) return
  const pMonsterData = m.u32((u + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return
  m.setU32((pMonsterData + 0x38) >>> 0, 0)
  m.setU32((pMonsterData + 0x34) >>> 0, 0)
}

/**
 * Player skill-mode dispatch stub for `playerSkillModeHandlersTable` indices `4` and `9`
 * (`0x6FD279E0`, `0x6FD279F4`); returns `1`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pSkill, [esp+8] = nSkillLevel)`, `ret 8`.
 *
 * @va D2Game:0x6FC97920
 */
export function PLAYER_SkillModeNoopHandler_04_09_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pSkill = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FC97920)
  return 1
}

/**
 * Player skill-mode dispatch stub for `playerSkillModeHandlersTable` indices `1` and `5`
 * (`0x6FD279D4`, `0x6FD279E4`); returns `1`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pSkill, [esp+8] = nSkillLevel)`, `ret 8`.
 *
 * @va D2Game:0x6FC97930
 */
export function PLAYER_SkillModeNoopHandler_01_05_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pSkill = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FC97930)
  return 1
}

/**
 * Player skill-mode dispatch stub for `playerSkillModeHandlersTable` indices `0` and `17`
 * (`0x6FD279D0`, `0x6FD27A14`); returns `1`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pSkill, [esp+8] = nSkillLevel)`, `ret 8`.
 *
 * @va D2Game:0x6FC97940
 */
export function PLAYER_SkillModeNoopHandler_00_17_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pSkill = 0,
  _nSkillLevel = 0,
): number {
  hitD2GameVa113c(0x6FC97940)
  return 1
}

/**
 * Checks whether `pPlayer`'s currently used skill has `Skills.txt -> bInterrupt (+0x16) > 0`;
 * otherwise compares `pGame->dwGameFrame (+0xA8) <= EVENT_GetNextEventFrame(pPlayer, 1) + 5` (signed).
 *
 * Binary convention: `edi = pPlayer`, `[esp+4] = pGame`, `ret 4`.
 *
 * @va D2Game:0x6FC98100
 */
export function PLAYER_CanInterruptCurrentSkillOrEvent113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC98100)
  const plr = pPlayer >>> 0
  const pSkill = SKILLS_GetUsedSkill113c(m, plr) >>> 0
  if (pSkill !== 0) {
    const pSkillsTxt = SKILLS_GetSkillsTxtFromSkill113c(m, pSkill) >>> 0
    if (pSkillsTxt !== 0 && m.u8((pSkillsTxt + 0x16) >>> 0) > 0) {
      return 1
    }
  }
  const nextEventFrame = EVENT_GetNextEventFrame113c(m, plr, 1) | 0
  const gameFrame = pGame >>> 0 !== 0 ? m.u32((pGame + 0xa8) >>> 0) | 0 : 0
  const limitFrame = (nextEventFrame + 5) | 0
  return gameFrame <= limitFrame ? 1 : 0
}

/**
 * Queues 6-byte `S2C 0x0A` (`RemoveGroundUnit`: `{ 0x0A, nUnitType, dwUnitId }`) to `pClient`
 * unless `(byte)pUnit->dwUnitType == 3` (`UNIT_MISSILE`).
 *
 * Binary convention: `ecx = pUnit`, `[esp+4] = pClient`, `ret 4`.
 *
 * @va D2Game:0x6FC9A540
 */
export function NET_SendRemoveUnitPacket0A113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
): void {
  hitD2GameVa113c(0x6FC9A540)
  const u = pUnit >>> 0
  if (u === 0) return
  const nUnitType = m.u8(u) & 0xff
  if (nUnitType === 3) return
  const dwUnitId = m.u32((u + 0x0c) >>> 0) >>> 0

  const sp = k2LaneCStackPtr
  const pkt = allocScratchBytes113c(m, 8)
  try {
    m.setU8(pkt, 0x0a)
    m.setU8((pkt + 1) >>> 0, nUnitType)
    m.setU32((pkt + 2) >>> 0, dwUnitId)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pkt, 6)
  } finally {
    freeScratchBytes113c(sp)
  }
}

/**
 * `MonAI.txt` row `146` (`UberMephisto`) `pfnAiThink` no-op (`gpMonsterAiFunctionTable[146].pfnAiThink`
 * at `0x6FD2F0B0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = pAiParam)`, `ret 4`.
 *
 * @va D2Game:0x6FC9B4E0
 */
export function AITHINK_Fn146_UberMephistoNoop113c(
  _m: Memory113c,
  _pGame = 0,
  _pUnit = 0,
  _pAiParam = 0,
): void {
  hitD2GameVa113c(0x6FC9B4E0)
}

/**
 * `MonAI.txt` `pfnAiInit` for `FoulCrowNest` (`43`), `Sarcophagus` (`45`), and `MinionSpawner` (`121`):
 * sets `pAiGeneral->dwAiParam0 (+0x14) = pGame->dwGameFrame (+0xA8)` and `dwAiParam1 (+0x18) = 0`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = pAiParam)`, `ret 4`.
 *
 * @va D2Game:0x6FC9B4F0
 */
export function AIINIT_SpawnerResetFrameTimers113c(
  m: Memory113c,
  pGame: number,
  _pUnit: number,
  pAiParam: number,
): void {
  hitD2GameVa113c(0x6FC9B4F0)
  const g = pGame >>> 0
  const param = pAiParam >>> 0
  if (g === 0 || param === 0) return
  const pAiGeneral = m.u32(param) >>> 0
  if (pAiGeneral === 0) return
  const dwGameFrame = m.u32((g + 0xa8) >>> 0) >>> 0
  m.setU32((pAiGeneral + 0x14) >>> 0, dwGameFrame)
  m.setU32((pAiGeneral + 0x18) >>> 0, 0)
}

/**
 * Reads or lazily initializes `pGame->pMonReg[nLevelId]->nSubVariant` (`+0x2D4`):
 * if `< 0`, sets `0` for Act 1 levels (`nLevelId < 40`) or rolls `SEED_RollRangeHalfOpen(&pUnit->tSeed, 0, 3)`
 * (`0..2`) for `nLevelId >= 40`.
 *
 * Binary convention: `eax = pUnit`, `[esp+4] = pGame`, `ret 4`.
 *
 * @va D2Game:0x6FC9B510
 */
export function MONSTER_GetOrRollRegionSubVariant113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FC9B510)
  const u = pUnit >>> 0
  const g = pGame >>> 0
  if (u === 0 || g === 0) return 0
  const pRoom = UNITS_GetRoom113c(m, u) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  const pMonReg = m.u32((g + 0xf0 + imul32(nLevelId, 4)) >>> 0) >>> 0
  if (pMonReg === 0) return 0

  const current = m.u32((pMonReg + 0x2d4) >>> 0) | 0
  if (current < 0) {
    if (nLevelId < 0x28) {
      m.setU32((pMonReg + 0x2d4) >>> 0, 0)
      return m.u32((pMonReg + 0x2d4) >>> 0) | 0
    }
    const rolled = SEED_RollRangeHalfOpen113c(m, (u + 0x20) >>> 0, 0, 3) | 0
    m.setU32((pMonReg + 0x2d4) >>> 0, rolled >>> 0)
  }
  return m.u32((pMonReg + 0x2d4) >>> 0) | 0
}

/**
 * Unit-find filter callback used by `WillOWisp` AI (`0x6FCA0F20`): returns `1` iff `pUnit` is a
 * living monster (`dwUnitType == 1`, `MONSTERS_IsDead == 0`) whose `MonStats.txt` `wBaseId` is
 * within `[0, nMonStatsTxtRecordCount)` and equals `0x76` (`118`, `willowisp1`).
 *
 * Binary convention: `__fastcall(ecx = pUnit, edx = pContext)`, `ret`.
 *
 * @va D2Game:0x6FC9BD00
 */
export function AI_FilterLivingGloamUnit113c(
  m: Memory113c,
  pUnit: number,
  _pContext = 0,
): number {
  hitD2GameVa113c(0x6FC9BD00)
  const u = pUnit >>> 0
  if (u === 0) return 0
  if ((m.u32(u) | 0) !== 1) return 0
  if (MONSTERS_IsDead113c(m, u) !== 0) return 0
  const baseId = MONSTER_GetBaseIdFromUnit113c(m, u) | 0
  if (baseId < 0) return 0
  const pTables = readSgptDataTablesPtr113c(m)
  if (pTables === 0) return 0
  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  if (baseId >= nMonStatsCount) return 0
  return baseId === 0x76 ? 1 : 0
}

// ============================================================================
// Group C: PACKET C2S / S2C Handlers (0x6FCEB190..0x6FCECB10 — 16 VAs)
// ============================================================================

/**
 * C2S opcode `0x66` (`WardenResponse`) handler in `c2sPacketTable` (`0x6FD1A3A8`); accepts (`0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB190
 */
export function PACKET_C2S66_WardenResponseNoop113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEB190)
  return 0
}

/**
 * C2S opcode `0x43` (`QuestLogRequest`) handler in `c2sPacketTable` (`0x6FD1A290`); accepts (`0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB1B0
 */
export function PACKET_C2S43_QuestInitNoop113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEB1B0)
  return 0
}

/**
 * C2S opcode `0x42` (`ClearPlayerCursor`) handler in `c2sPacketTable` (`0x6FD1A288`); accepts (`0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB1C0
 */
export function PACKET_C2S42_ClearCursorNoop113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEB1C0)
  return 0
}

/**
 * C2S opcode `0x2E` (`PlayNpcSound`) handler in `c2sPacketTable` (`0x6FD1A1E8`); accepts (`0`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB1D0
 */
export function PACKET_C2S2E_PlaySoundNoop113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEB1D0)
  return 0
}

/**
 * C2S opcode `0x2C` handler in `c2sPacketTable` (`0x6FD1A1D8`); always rejects with status `3`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB1E0
 */
export function PACKET_C2S2C_Reject3_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEB1E0)
  return 3
}

/**
 * Compares the Acts of `pUnit1` and `pUnit2` via `UNITS_GetRoom -> DUNGEON_GetLevelIdFromRoom -> DRLG_GetActNoFromLevelId`:
 * returns `0` if both units are in the same Act, or `2` if they are in different Acts.
 *
 * Binary convention: `eax = pUnit1`, `[esp+4] = pUnit2`, `ret 4`.
 *
 * @va D2Game:0x6FCEB370
 */
export function PACKET_CheckUnitsInDifferentActs113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
): number {
  hitD2GameVa113c(0x6FCEB370)
  const room1 = UNITS_GetRoom113c(m, pUnit1 >>> 0) >>> 0
  const lvl1 = DUNGEON_GetLevelIdFromRoom113c(m, room1) | 0
  const act1 = DRLG_GetActNoFromLevelId113c(m, lvl1) & 0xff

  const room2 = UNITS_GetRoom113c(m, pUnit2 >>> 0) >>> 0
  const lvl2 = DUNGEON_GetLevelIdFromRoom113c(m, room2) | 0
  const act2 = DRLG_GetActNoFromLevelId113c(m, lvl2) & 0xff

  const sameAct = act1 === act2 ? 1 : 0
  return ((sameAct - 1) & 2) >>> 0
}

/**
 * C2S opcode `0x58` (`MarkQuestIntroSeen`, 3 bytes `{ 0x58, u16 wQuestId }`) handler in `c2sPacketTable` (`0x6FD1A338`):
 * returns `3` if `nPacketSize != 3`, `2` if `wQuestId >= 0x2A` (`42`), otherwise sets quest state `12` (`0x0C`)
 * on `pPlayerData->pQuestData[pGame->nDifficulty]` and returns `0`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB3D0
 */
export function PACKET_C2S58_MarkQuestIntroSeen113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEB3D0)
  if ((nPacketSize | 0) !== 3) return 3
  const wQuestId = m.u16((pPacket + 1) >>> 0)
  if (wQuestId >= 0x2a) return 2
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDifficulty = m.u8((pGame + 0x6d) >>> 0)
  const pQuestData = m.u32((pPlayerData + imul32(nDifficulty, 4) + 0x10) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, pQuestData, wQuestId, 0x0c)
  return 0
}

/**
 * C2S opcode `0x52` handler in `c2sPacketTable` (`0x6FD1A308`); always rejects with status `3`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB490
 */
export function PACKET_C2S52_Reject3_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEB490)
  return 3
}

/**
 * C2S opcode `0x45` handler in `c2sPacketTable` (`0x6FD1A2A0`); always rejects with status `3`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB550
 */
export function PACKET_C2S45_Reject3_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEB550)
  return 3
}

/**
 * C2S opcode `0x39` handler in `c2sPacketTable` (`0x6FD1A240`); always rejects with status `3`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEB560
 */
export function PACKET_C2S39_Reject3_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEB560)
  return 3
}

/**
 * Queues 16-byte `S2C 0x0F` (`PlayerMove`) movement-sync packet for `pUnit` (`itemActionPacketSubTable[19]`
 * at `0x6FD22DC4`): `{ 0x0F, 0x00, dwUnitId, moveSubtypeByte, wTargetX, wTargetY, bFieldB0, wCurX, wCurY }`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pUnit, [esp+4] = pClient, [esp+8] = nAnimMode)`, `ret 8`.
 *
 * @va D2Game:0x6FCEBA20
 */
export function NET_SendUnitMovePacket0F113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
  pClient: number,
  nAnimMode: number,
): void {
  hitD2GameVa113c(0x6FCEBA20)
  const u = pUnit >>> 0
  if (u === 0) return

  const bFieldB0 = m.u8((u + 0xb0) >>> 0) & 0xff
  const pPath = m.u32((u + 0x2c) >>> 0) >>> 0
  const posY = readUnitPosYInline113c(m, u) & 0xffff
  const posX = readUnitPosXInline113c(m, u) & 0xffff
  const dwUnitId = m.u32((u + 0x0c) >>> 0) >>> 0
  const firstY = pPath !== 0 ? PATH_GetFirstPointY113c(m, pPath) & 0xffff : 0
  const firstX = pPath !== 0 ? PATH_GetFirstPointX113c(m, pPath) & 0xffff : 0
  const moveTypeByte = readPlrModeSyncSubtypeByte113c(m, nAnimMode)

  const sp = k2LaneCStackPtr
  const pkt = allocScratchBytes113c(m, 16)
  try {
    m.setU8(pkt, 0x0f)
    m.setU8((pkt + 1) >>> 0, 0x00)
    m.setU32((pkt + 2) >>> 0, dwUnitId)
    m.setU8((pkt + 6) >>> 0, moveTypeByte)
    m.setU16((pkt + 7) >>> 0, firstX)
    m.setU16((pkt + 9) >>> 0, firstY)
    m.setU8((pkt + 11) >>> 0, bFieldB0)
    m.setU16((pkt + 12) >>> 0, posX)
    m.setU16((pkt + 14) >>> 0, posY)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pkt, 16)
  } finally {
    freeScratchBytes113c(sp)
  }
}

/**
 * Queues 11-byte `S2C 0x15` (`ReassignPlayer`: `{ 0x15, bUnitType, dwUnitId, wPosX, wPosY, bFlash }`)
 * to `pClient`.
 *
 * Binary convention: `esi = pUnit`, `[esp+4] = pClient`, `[esp+8] = bFlash`, `ret 8`.
 *
 * @va D2Game:0x6FCEBB10
 */
export function NET_SendReassignUnitPacket15_113c(
  m: Memory113c,
  pUnit: number,
  pClient: number,
  bFlash: number,
): void {
  hitD2GameVa113c(0x6FCEBB10)
  const u = pUnit >>> 0
  if (u === 0) return

  const posY = readUnitPosYInline113c(m, u) & 0xffff
  const posX = readUnitPosXInline113c(m, u) & 0xffff
  const bUnitType = m.u32(u) & 0xff
  const dwUnitId = m.u32((u + 0x0c) >>> 0) >>> 0

  const sp = k2LaneCStackPtr
  const pkt = allocScratchBytes113c(m, 16)
  try {
    m.setU8(pkt, 0x15)
    m.setU8((pkt + 1) >>> 0, bUnitType)
    m.setU32((pkt + 2) >>> 0, dwUnitId)
    m.setU16((pkt + 6) >>> 0, posX)
    m.setU16((pkt + 8) >>> 0, posY)
    m.setU8((pkt + 10) >>> 0, bFlash & 0xff)
    NET_QueuePacketToClientBuffer113c(m, pClient >>> 0, 1, pkt, 11)
  } finally {
    freeScratchBytes113c(sp)
  }
}

/**
 * C2S opcode `0x2D` handler in `c2sPacketTable` (`0x6FD1A1E0`); always rejects with status `3`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEBDA0
 */
export function PACKET_C2S2D_Reject3_113c(
  _m: Memory113c,
  _pGame = 0,
  _pPlayer = 0,
  _pPacket = 0,
  _nPacketSize = 0,
): number {
  hitD2GameVa113c(0x6FCEBDA0)
  return 3
}

/**
 * Formats a 40-byte `S2C 0x5A` event notification (`{ 0x5A, 0x0E, 0x01, 0... }`) and dispatches it
 * via `NET_SendFixed40BytePacketToClient` to `pPlayer`'s client (or `pClient = 0` for non-players).
 *
 * Binary convention: `eax = pPlayer`, `ret`.
 *
 * @va D2Game:0x6FCEBED0
 */
export function NET_SendEventMessage5A_Type0E_113c(m: Memory113c, pPlayer: number): number {
  hitD2GameVa113c(0x6FCEBED0)
  const sp = k2LaneCStackPtr
  const pkt40 = allocScratchBytes113c(m, 40)
  try {
    m.setU8(pkt40, 0x5a)
    m.setU8((pkt40 + 1) >>> 0, 0x0e)
    m.setU8((pkt40 + 2) >>> 0, 0x01)
    const pClient = resolvePlayerClientPtr113c(m, pPlayer)
    return NET_SendFixed40BytePacketToClient113c(m, pClient, pkt40)
  } finally {
    freeScratchBytes113c(sp)
  }
}

/**
 * C2S opcode `0x4B` (`RequestUnitRefresh`, 9 bytes `{ 0x4B, u32 dwUnitType, u32 dwUnitId }`) handler
 * in `c2sPacketTable` (`0x6FD1A2D0`):
 * - `nPacketSize != 9` -> `3`
 * - `dwUnitType >= 6` (unsigned) -> `2`
 * - target unit missing or `UNITS_AreInAdjacentRooms(pPlayer, pTarget) == 0` -> `1`
 * - otherwise calls `UNITROOM_RefreshUnit(pTarget)`, sets `pTarget->dwFlagsEx |= 0x10000` (`+0xC8`), and returns `0`.
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pPlayer, [esp+4] = pPacket, [esp+8] = nPacketSize)`, `ret 8`.
 *
 * @va D2Game:0x6FCEC6E0
 */
export function PACKET_C2S4B_RequestUnitRefresh113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pPacket: number,
  nPacketSize: number,
): number {
  hitD2GameVa113c(0x6FCEC6E0)
  if ((nPacketSize | 0) !== 9) return 3
  const dwUnitType = m.u32((pPacket + 1) >>> 0) >>> 0
  const dwUnitId = m.u32((pPacket + 5) >>> 0) >>> 0
  if (dwUnitType >= 6) return 2
  const pTarget = SUNIT_GetServerUnit113c(m, pGame >>> 0, dwUnitType, dwUnitId) >>> 0
  if (pTarget === 0) return 1
  if (UNITS_AreInAdjacentRooms113c(m, pPlayer >>> 0, pTarget) === 0) return 1
  UNITROOM_RefreshUnit113c(m, pTarget)
  m.setU32((pTarget + 0xc8) >>> 0, (m.u32((pTarget + 0xc8) >>> 0) | 0x10000) >>> 0)
  return 0
}

/**
 * Returns `1` iff `pPlayer` is actively interacting with a live player (`bInteracting != 0` at `+0x6C`,
 * `dwInteractType == 0` at `+0x68`) AND that resolved player unit is NOT `pOtherPlayer`; else returns `0`.
 *
 * Binary convention: `ecx = pPlayer`, `[esp+4] = pGame`, `[esp+8] = pOtherPlayer`, `ret 8`.
 *
 * @va D2Game:0x6FCECB10
 */
export function PACKET_IsInteractingWithDifferentPlayer113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
  pOtherPlayer: number,
): number {
  hitD2GameVa113c(0x6FCECB10)
  const plr = pPlayer >>> 0
  if (plr === 0) return 0
  const dwInteractGuid = m.u32((plr + 0x64) >>> 0) >>> 0
  const dwInteractType = m.u32((plr + 0x68) >>> 0) >>> 0
  const bInteracting = m.u8((plr + 0x6c) >>> 0)
  if (bInteracting === 0 || dwInteractType !== 0) return 0
  const pInteracting = SUNIT_GetServerUnit113c(m, pGame >>> 0, 0, dwInteractGuid) >>> 0
  if (pInteracting === 0 || pInteracting === (pOtherPlayer >>> 0)) return 0
  return 1
}

// ============================================================================
// Group D: ITEMS / ItemMode & SUNITDMG (0x6FCF16B0..0x6FCFAE20 — 9 VAs)
// ============================================================================

/**
 * Returns `1` iff `pItem1` and `pItem2` have identical `wMagicPrefix[0..2]`, `wMagicSuffix[0..2]`,
 * and `wAutoAffix` values; otherwise returns `0`.
 *
 * Binary convention: `ebx = pItem1`, `edi = pItem2`, `ret`.
 *
 * @va D2Game:0x6FCF16B0
 */
export function ITEMS_AreAffixesEqual113c(
  m: Memory113c,
  pItem1: number,
  pItem2: number,
): number {
  hitD2GameVa113c(0x6FCF16B0)
  const a = pItem1 >>> 0
  const b = pItem2 >>> 0
  for (let i = 0; i < 3; i++) {
    const preA = ITEMS_GetMagicPrefix113c(m, a, i) & 0xffff
    const preB = ITEMS_GetMagicPrefix113c(m, b, i) & 0xffff
    if (preA !== preB) return 0
    const sufA = ITEMS_GetMagicSuffix113c(m, a, i) & 0xffff
    const sufB = ITEMS_GetMagicSuffix113c(m, b, i) & 0xffff
    if (sufA !== sufB) return 0
  }
  const autoA = ITEMS_GetAutoAffix113c(m, a) & 0xffff
  const autoB = ITEMS_GetAutoAffix113c(m, b) & 0xffff
  return autoA === autoB ? 1 : 0
}

/**
 * Resolves the paired opposite equipment body location via jump table `0x6FCF1758`:
 * `4 <-> 5` (`RARM <-> LARM`), `6 <-> 7` (`RRING <-> LRING`), `11 <-> 12` (`SWRARM <-> SWLARM`),
 * and `0` for all other body locations.
 *
 * Binary convention: `eax = nBodyLoc`, `ret`.
 *
 * @va D2Game:0x6FCF1720
 */
export function ITEMS_GetOppositeHandOrRingBodyLoc113c(
  _m: Memory113c,
  nBodyLoc: number,
): number {
  hitD2GameVa113c(0x6FCF1720)
  switch (nBodyLoc | 0) {
    case 4:
      return 5
    case 5:
      return 4
    case 6:
      return 7
    case 7:
      return 6
    case 11:
      return 12
    case 12:
      return 11
    default:
      return 0
  }
}

/**
 * Partition `4` (`UNIT_ITEM`) top-level timer handler no-op (`unitTimerTypeHandlers[4]` at `0x6FD1B120`).
 *
 * Binary convention: `__fastcall(ecx = pGame, edx = pItem)`, `ret`.
 *
 * @va D2Game:0x6FCF1790
 */
export function ITEMMODE_UnitTimerNoop113c(_m: Memory113c, _pGame = 0, _pItem = 0): void {
  hitD2GameVa113c(0x6FCF1790)
}

/**
 * Evaluates two `0x28`-byte `D2HandItemFlagsStrc` records (`pFlagsA` in `eax`, `pFlagsB` in `ecx`)
 * for valid paired hand-slot coexistence (bow+arrows, crossbow+bolts, 1H-weapon+shield, dual-wield
 * 1H weapons with `+0x1C`, or paired `+0x24` flags).
 *
 * Binary convention: `eax = pHandFlagsA`, `ecx = pHandFlagsB`, `ret`.
 *
 * @va D2Game:0x6FCF1950
 */
export function ITEMS_AreWeaponSlotTypesCompatible113c(
  m: Memory113c,
  pHandFlagsA: number,
  pHandFlagsB: number,
): number {
  hitD2GameVa113c(0x6FCF1950)
  const a = pHandFlagsA >>> 0
  const b = pHandFlagsB >>> 0
  if (a === 0 || b === 0) return 0

  if (m.u32(a) !== 0 && m.u32((b + 0x08) >>> 0) !== 0) return 1
  if (m.u32((a + 0x08) >>> 0) !== 0 && m.u32(b) !== 0) return 1
  if (m.u32((a + 0x04) >>> 0) !== 0 && m.u32((b + 0x0c) >>> 0) !== 0) return 1
  if (m.u32((a + 0x0c) >>> 0) !== 0 && m.u32((b + 0x04) >>> 0) !== 0) return 1

  const aWeapon = m.u32((a + 0x14) >>> 0)
  if (aWeapon !== 0 && m.u32((a + 0x18) >>> 0) === 0 && m.u32((b + 0x10) >>> 0) !== 0) {
    return 1
  }

  const bWeapon = m.u32((b + 0x14) >>> 0)
  if (bWeapon !== 0 && m.u32((b + 0x18) >>> 0) === 0 && m.u32((a + 0x10) >>> 0) !== 0) {
    return 1
  }

  if (
    aWeapon !== 0 &&
    m.u32((a + 0x18) >>> 0) === 0 &&
    bWeapon !== 0 &&
    m.u32((b + 0x18) >>> 0) === 0 &&
    m.u32((a + 0x1c) >>> 0) !== 0 &&
    m.u32((b + 0x1c) >>> 0) !== 0
  ) {
    return 1
  }

  if (m.u32((a + 0x24) >>> 0) !== 0 && m.u32((b + 0x24) >>> 0) !== 0) {
    return 1
  }

  return 0
}

/**
 * Returns `1` iff `(pItemsTxtA->dwCode, pItemsTxtB->dwCode)` (`+0x80`) matches `(dwCode1, dwCode2)`
 * in either order; otherwise returns `0`.
 *
 * Binary convention: `eax = pItemsTxtA`, `esi = pItemsTxtB`, `ecx = dwCode1`, `edx = dwCode2`, `ret`.
 *
 * @va D2Game:0x6FCF1A00
 */
export function ITEMS_DoItemRecordsMatchCodePair113c(
  m: Memory113c,
  pItemsTxtA: number,
  pItemsTxtB: number,
  dwCode1: number,
  dwCode2: number,
): number {
  hitD2GameVa113c(0x6FCF1A00)
  const a = pItemsTxtA >>> 0
  const b = pItemsTxtB >>> 0
  if (a === 0 || b === 0) return 0
  const codeA = m.u32((a + 0x80) >>> 0) >>> 0
  const codeB = m.u32((b + 0x80) >>> 0) >>> 0
  const c1 = dwCode1 >>> 0
  const c2 = dwCode2 >>> 0
  if (codeA === c1 && codeB === c2) return 1
  if (codeA === c2 && codeB === c1) return 1
  return 0
}

/**
 * Returns `1` iff `pItem` is an item unit (`dwUnitType == 4`) with `ITEMS_GetSubTypeFromItem != 0`
 * and a non-null `pInventory` (`+0x60`) whose `INVENTORY_GetItemCount` is `> 0`; else returns `0`.
 *
 * Binary convention: `eax = pItem`, `ret`.
 *
 * @va D2Game:0x6FCF1BC0
 */
export function ITEMS_HasSocketedSubItems113c(m: Memory113c, pItem: number): number {
  hitD2GameVa113c(0x6FCF1BC0)
  const itm = pItem >>> 0
  if (itm === 0) return 0
  if ((m.u32(itm) | 0) !== 4) return 0
  if (ITEMS_GetSubTypeFromItem113c(m, itm) === 0) return 0
  const pInventory = m.u32((itm + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return 0
  const count = INVENTORY_GetItemCount113c(m, pInventory) >>> 0
  return count > 0 ? 1 : 0
}

/**
 * Zeroes `0x84` bytes (`33` dwords) at `pOutDrop` (`D2ItemDropStrc`) and populates seed pointer,
 * `pGame`, item level, target `nClassId`, spawn type `4`, coordinates, `wItemFormat` (`pGame + 0x78`),
 * quality `2`, action flags `2`, init seed (`pSourceItem + 0x28`), and `ITEMS_GetOwnerGuid(pSourceItem)`.
 *
 * Binary convention: `esi = pOutDrop`, `ebx = pSourceItem`, `[esp+4] = pGame`, `[esp+8] = nClassId`, `ret 8`.
 *
 * @va D2Game:0x6FCF1E10
 */
export function ITEMS_BuildItemDropParamsFromItem113c(
  m: Memory113c,
  pOutDrop: number,
  pSourceItem: number,
  pGame: number,
  nClassId: number,
): void {
  hitD2GameVa113c(0x6FCF1E10)
  const out = pOutDrop >>> 0
  const src = pSourceItem >>> 0
  const g = pGame >>> 0
  if (out === 0 || src === 0) return

  for (let i = 0; i < 0x21; i++) {
    m.setU32((out + i * 4) >>> 0, 0)
  }

  m.setU32((out + 0x08) >>> 0, g)
  const ilvl = ITEMS_GetItemLevel113c(m, src) >>> 0
  m.setU32((out + 0x0c) >>> 0, ilvl)
  const wItemFormat = g !== 0 ? m.u16((g + 0x78) >>> 0) : 0
  m.setU16((out + 0x2a) >>> 0, wItemFormat)
  m.setU32((out + 0x14) >>> 0, nClassId >>> 0)
  m.setU32((out + 0x18) >>> 0, 4)

  const posX = readUnitPosXInline113c(m, src) >>> 0
  m.setU32((out + 0x1c) >>> 0, posX)
  const posY = readUnitPosYInline113c(m, src) >>> 0
  m.setU32((out + 0x20) >>> 0, posY)

  m.setU32((out + 0x04) >>> 0, (src + 0x20) >>> 0)
  m.setU16((out + 0x28) >>> 0, 1)
  m.setU32((out + 0x30) >>> 0, 2)

  const dwInitSeed = m.u32((src + 0x28) >>> 0) >>> 0
  m.setU32((out + 0x48) >>> 0, dwInitSeed)
  const dwOwnerGuid = ITEMS_GetOwnerGuid113c(m, src) >>> 0
  m.setU32((out + 0x40) >>> 0, 2)
  m.setU32((out + 0x4c) >>> 0, dwOwnerGuid)
}

/**
 * Walks `pUnit->pInventory` (`+0x60`), clears command flag `0x04` on every item that has it set,
 * and for player units (`dwUnitType == 0`) queues 8-byte `S2C 0x3F` (`{ 0x3F, 0xFF, dwItemId, 0xFFFF }`)
 * to `pUnit`'s client.
 *
 * Binary convention: `__stdcall([esp+4] = pUnit)`, `ret 4`.
 *
 * @va D2Game:0x6FCF29F0
 */
export function ITEMS_ClearInventoryCmdFlag4AndSync3F113c(m: Memory113c, pUnit: number): void {
  hitD2GameVa113c(0x6FCF29F0)
  const u = pUnit >>> 0
  if (u === 0) return
  const pInventory = m.u32((u + 0x60) >>> 0) >>> 0
  if (pInventory === 0) return

  let pNode = INVENTORY_GetFirstItem113c(m, pInventory) >>> 0
  if (pNode === 0) return

  const sp = k2LaneCStackPtr
  const pkt = allocScratchBytes113c(m, 8)
  try {
    while (pNode !== 0) {
      const pItem = INVENTORY_UnitIsItem113c(m, pNode) >>> 0
      if (ITEMS_CheckCommandFlags113c(m, pItem, 0x04) !== 0) {
        ITEMS_SetOrClearCommandFlags113c(m, pItem, 0x04, 0)
        if (m.u32(u) === 0) {
          const pClient = resolvePlayerClientPtr113c(m, u)
          m.setU32(pkt, 0)
          m.setU32((pkt + 4) >>> 0, 0)
          m.setU8(pkt, 0x3f)
          m.setU8((pkt + 1) >>> 0, 0xff)
          m.setU32((pkt + 2) >>> 0, pItem !== 0 ? m.u32((pItem + 0x0c) >>> 0) >>> 0 : 0)
          m.setU16((pkt + 6) >>> 0, 0xffff)
          NET_QueuePacketToClientBuffer113c(m, pClient, 1, pkt, 8)
        }
      }
      pNode = INVENTORY_GetNextItem113c(m, pNode) >>> 0
    }
  } finally {
    freeScratchBytes113c(sp)
  }
}

/**
 * Returns signed `MonStats.txt -> coldEffect[pGame->nDifficulty]` (`+0x168 + nDifficulty`, `int8`)
 * for monster units (`dwUnitType == 1` with valid `dwClassId`), or `-50` (`0xFFFFFFCE`) for players,
 * non-monsters, or out-of-range class IDs.
 *
 * Binary convention: `eax = pDefender`, `[esp+4] = pGame`, `ret 4`.
 *
 * @va D2Game:0x6FCFAE20
 */
export function SUNITDMG_GetDefenderColdEffect113c(
  m: Memory113c,
  pDefender: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCFAE20)
  const def = pDefender >>> 0
  if (def === 0) return -50
  if ((m.u32(def) | 0) !== 1) return -50
  const classId = m.u32((def + 0x04) >>> 0) | 0
  if (classId < 0) return -50

  const pTables = readSgptDataTablesPtr113c(m)
  if (pTables === 0) return -50
  const nMonStatsCount = m.u32((pTables + 0xa80) >>> 0) | 0
  if (classId >= nMonStatsCount) return -50

  const pMonStatsBase = m.u32((pTables + 0xa78) >>> 0) >>> 0
  const pRow = (pMonStatsBase + imul32(classId, 0x1a8)) >>> 0
  if (pRow === 0) return -50

  const nDifficulty = pGame >>> 0 !== 0 ? m.u8((pGame + 0x6d) >>> 0) : 0
  return (m.u8((pRow + 0x168 + nDifficulty) >>> 0) << 24) >> 24
}
