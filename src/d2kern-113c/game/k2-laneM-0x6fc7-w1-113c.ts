/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 1 (`Lane K2-M`) routines across
 * `0x6FC73470..0x6FC782E0` (`45` functions, `4,157` bytes total):
 * - `0x6FC73470`: player save item bitstream serialization helper
 * - `0x6FC764D0..0x6FC782E0`: Act 5 Harrogath quest object initializers,
 *   active/status NPC filters, player/party iteration callbacks, and quest
 *   lifecycle callbacks (`dwQuestNo` `0x20..0x24`, `QUESTRECORD` `0x23..0x28`).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_SerializeItemToBuffer113c,
} from '../common/items.ts'
import { PATH_GetTargetTypeAndPosition113c } from '../common/path.ts'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.ts'
import { STATLIST_GetUnitBaseStat113c } from '../common/statlist.ts'
import { UNITS_GetRoom113c } from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import {
  ROOM_FindRoomContainingSubtile113c,
  SUNIT_AllocUnitData113c,
} from './regpop-spawn-113c.ts'

/**
 * Jump-table state mapping for `D2Game.dll` `.text` table at `0x6FC77300`
 * indexed by `(wScrollMsgId - 0x4ECF)` for `0..5`.
 */
const ACT5Q5_SCROLL_MSG_STATES: readonly number[] = [7, 9, 5, 4, 6, 8]

function findQuestNodeInChain113c(
  m: Memory113c,
  pGame: number,
  dwQuestNo: number,
): number {
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  let pQuest = m.u32(pQuestCtrl) >>> 0
  const target = dwQuestNo >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) >>> 0) === target) {
      return pQuest
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

function removeQuestArgPlayerFromQuestAndExGuidLists113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  const pUnit0 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const guid0 = pUnit0 === 0 ? 0xffffffff : m.u32((pUnit0 + 0x0c) >>> 0) >>> 0
  QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, guid0)
  const pUnit1 = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const guid1 = pUnit1 === 0 ? 0xffffffff : m.u32((pUnit1 + 0x0c) >>> 0) >>> 0
  return QUESTS_GuidListRemove113c(m, pQuestDataEx, guid1)
}

/**
 * Serializes `pItem` (`eax`) into `pOutBuffer` (`[esp+4]`, `ret 0x4`) with capacity
 * `nMaxBytes` (`edx`) when `pItem != 0` and `(pItem->dwFlagsEx (+0xC8) & 0x8000) == 0`:
 * - Returns `0` when `pItem == 0` or bit `15` (`0x8000`) of `[pItem + 0xC8]` is set.
 * - Otherwise invokes `ITEMS_SerializeItemToBuffer113c(m, pItem, pOutBuffer, nMaxBytes, 1, 1, 0)`
 *   and returns the non-zero byte count, or raises `Fog.#10024` assertion (`line 0x75A`) if `0`.
 *
 * @va D2Game:0x6FC73470
 */
export function SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c(
  m: Memory113c,
  pItem: number,
  nMaxBytes: number,
  pOutBuffer: number,
): number {
  const item = pItem >>> 0
  if (item === 0) {
    return 0
  }
  const flagBit15 = (m.u32((item + 0xc8) >>> 0) >>> 15) & 1
  if (flagBit15 !== 0) {
    return 0
  }
  const written =
    ITEMS_SerializeItemToBuffer113c(m, item, pOutBuffer >>> 0, nMaxBytes | 0, 1, 1, 0) | 0
  if (written !== 0) {
    return written
  }
  throw new D2CommonAssertError('SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c', 0x75a)
}

/**
 * Object init handler (`ecx = pObjInit`): resolves quest node `0x24` on `pObjInit->pGame` (`[ecx]`),
 * sets `pObjInit->pObject` (`[ecx + 0x04]`) anim mode to `pQuestDataEx[+0x9C]`, then writes
 * `pQuestDataEx[+0x9C] = 2`.
 *
 * @va D2Game:0x6FC764D0
 */
export function ACT5Q6_InitWorldstoneChamberObject9C_6FC764D0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  const pGame = m.u32(pObjInit >>> 0) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame, 0x24)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const nMode = m.u32((pQuestDataEx + 0x9c) >>> 0)
  const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObject, nMode)
  m.setU32((pQuestDataEx + 0x9c) >>> 0, 2)
}

/**
 * Object init handler (`ecx = pObjInit`): resolves quest node `0x24` on `pObjInit->pGame` (`[ecx]`),
 * sets `pObjInit->pObject` (`[ecx + 0x04]`) anim mode to `pQuestDataEx[+0x94]`, then writes
 * `pQuestDataEx[+0x94] = 2`.
 *
 * @va D2Game:0x6FC76520
 */
export function ACT5Q6_InitWorldstoneChamberObject94_6FC76520_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  const pGame = m.u32(pObjInit >>> 0) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame, 0x24)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const nMode = m.u32((pQuestDataEx + 0x94) >>> 0)
  const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObject, nMode)
  m.setU32((pQuestDataEx + 0x94) >>> 0, 2)
}

/**
 * Checks whether quest node `0x24` in `pGame` (`eax`) blocks Worldstone Chamber entry:
 * returns `0` iff quest node `0x24` exists and `pQuestDataEx[+0x86] == 1`, otherwise `1`.
 *
 * @va D2Game:0x6FC76570
 */
export function ACT5Q6_IsWorldstoneEntryAllowed_6FC76570_113c(
  m: Memory113c,
  pGame: number,
): number {
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x24)
  if (pQuest === 0) {
    return 1
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  return m.u8((pQuestDataEx + 0x86) >>> 0) === 1 ? 0 : 1
}

/**
 * Object init handler (`ecx = pObjInit`): looks up quest node `0x23` in `pObjInit->pGame` (`[ecx]`);
 * if present, sets `pObjInit->pObject` (`[ecx + 0x04]`) anim mode to `2` when
 * `pQuestDataEx[+0x4A] != 0`, or `0` otherwise.
 *
 * @va D2Game:0x6FC765B0
 */
export function ACT5Q5_InitSummitDoorObject_6FC765B0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  const pGame = m.u32(pObjInit >>> 0) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame, 0x23)
  if (pQuest === 0) {
    return
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const bOpen = m.u8((pQuestDataEx + 0x4a) >>> 0)
  const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObject, bOpen !== 0 ? 2 : 0)
}

/**
 * Checks whether a Town Portal may be opened on Arreat Summit (`levelId == 0x78`, `eax = pGame`):
 * resolves quest node `0x23` and returns `1` iff `pQuest->bNotIntro` (`+0x09`) is non-zero and
 * `pQuestDataEx[+0x00] == 0`, otherwise `0`.
 *
 * @va D2Game:0x6FC76600
 */
export function ACT5Q5_CanSpawnTownPortalOnSummit_6FC76600_113c(
  m: Memory113c,
  pGame: number,
): number {
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x23)
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  return m.u8(pQuestDataEx) === 0 ? 1 : 0
}

/**
 * Returns `1` iff quest node `0x23` exists in `pGame` (`eax`), `pQuestDataEx[+0x48] != 0`,
 * and `pQuestDataEx[+0x44] == 0` (remaining active Ancients count is zero), else `0`.
 *
 * @va D2Game:0x6FC76640
 */
export function ACT5Q5_IsLastAncientDefeatedReady_6FC76640_113c(
  m: Memory113c,
  pGame: number,
): number {
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x23)
  if (pQuest === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x48) >>> 0) === 0) {
    return 0
  }
  return m.u32((pQuestDataEx + 0x44) >>> 0) === 0 ? 1 : 0
}

/**
 * Reads `pQuest23->pQuestDataEx[+0x0C]` (`dwSummitPlayerCount`) from `pGame` (`eax`).
 *
 * @va D2Game:0x6FC766D0
 */
export function ACT5Q5_GetSummitPlayerCount_6FC766D0_113c(
  m: Memory113c,
  pGame: number,
): number {
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x23)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  return m.u32((pQuestDataEx + 0x0c) >>> 0) >>> 0
}

/**
 * Decrements `pQuest23->pQuestDataEx[+0x0C]` when `pUnit` (`eax`) is in Arreat Summit
 * (`levelId == 0x78`) within `pGame` (`[esp+4]`, `ret 0x4`); if the count reaches `0` while
 * `pQuestDataEx[+0x10] != 0`, sets `pQuestDataEx[+0x11] = 1`.
 *
 * @va D2Game:0x6FC76740
 */
export function ACT5Q5_OnPlayerLeaveSummitCheck_6FC76740_113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
): void {
  const pRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId !== 0x78) {
    return
  }
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x23)
  const pQuestDataEx0 = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const nextCount = ((m.u32((pQuestDataEx0 + 0x0c) >>> 0) | 0) - 1) >>> 0
  m.setU32((pQuestDataEx0 + 0x0c) >>> 0, nextCount)
  const pQuestDataEx1 = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u32((pQuestDataEx1 + 0x0c) >>> 0) === 0) {
    if (m.u8((pQuestDataEx1 + 0x10) >>> 0) !== 0) {
      m.setU8((pQuestDataEx1 + 0x11) >>> 0, 1)
    }
  }
}

/**
 * Act 5 Quest 6 (`Eve of Destruction`) `pfActiveFilter` (`+0xEC`, `ecx = pQuest`, `edx = nNpcId`,
 * `[esp+4] = _pPlayer`, `[esp+8] = pQuestFlags`, `[esp+0xC] = _pNpcUnit`, `ret 0xC`):
 * returns `1` iff `nNpcId == 0x203` (`515`, Qual-Kehk), `pQuest->bLastState` (`+0x0C`) is `1`,
 * and `pQuest->dwQuestRecordId` (`+0xE0`) state `0` is clear.
 *
 * @va D2Game:0x6FC76810
 */
export function ACT5Q6_ActiveFilter_6FC76810_113c(
  m: Memory113c,
  pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  if ((nNpcId | 0) !== 0x203) {
    return 0
  }
  if (m.u8((pQuest + 0x0c) >>> 0) !== 1) {
    return 0
  }
  const nQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, nQuestId, 0) === 0 ? 1 : 0
}

/**
 * Act 5 Quest 4 (`Betrayal of Harrogath`) `pfActiveFilter` (`+0xEC`, `ecx = pQuest`, `edx = nNpcId`,
 * `[esp+4] = _pPlayer`, `[esp+8] = pQuestFlags`, `[esp+0xC] = _pNpcUnit`, `ret 0xC`) for Anya (`0x200`).
 *
 * @va D2Game:0x6FC76840
 */
export function ACT5Q4_ActiveFilter_6FC76840_113c(
  m: Memory113c,
  pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  if ((nNpcId | 0) !== 0x200) {
    return 0
  }
  const flags = pQuestFlags >>> 0
  if (m.u8((pQuest + 0x0c) >>> 0) === 1) {
    if (
      DRLGWARP_TestRoomTileBit113c(m, flags, 0x25, 0) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, flags, 0x25, 1) === 0
    ) {
      return 0
    }
    const nQuestId0 = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId0, 0) !== 0) {
      return 0
    }
    const nQuestId1 = m.u32((pQuest + 0xe0) >>> 0) | 0
    return DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId1, 1) === 0 ? 1 : 0
  }
  const nQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId, 0x0d) === 0) {
    return 0
  }
  return DRLGWARP_TestRoomTileBit113c(m, flags, 0x26, 4) === 0 ? 1 : 0
}

/**
 * Act 5 Quest 4 (`Betrayal of Harrogath`, `QUESTRECORD` `0x26`) `pfStatusFilter` (`+0xE8`,
 * `ecx = pQuest`, `edx = _pPlayer`, `[esp+4] = _pGlobalFlags`, `[esp+8] = pPlayerFlags`,
 * `[esp+0xC] = pOutStatus`, `ret 0xC`): writes quest log status byte into `*pOutStatus` and returns `1`.
 *
 * @va D2Game:0x6FC768C0
 */
export function ACT5Q4_StatusFilter_6FC768C0_113c(
  m: Memory113c,
  pQuest: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  pPlayerFlags: number,
  pOutStatus: number,
): number {
  const outAddr = pOutStatus >>> 0
  const flags = pPlayerFlags >>> 0
  m.setU8(outAddr, 0)
  if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x26, 0) !== 0) {
    return 1
  }
  if (
    DRLGWARP_TestRoomTileBit113c(m, flags, 0x26, 1) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, flags, 0x26, 0x0d) !== 0
  ) {
    const hasBit4 = DRLGWARP_TestRoomTileBit113c(m, flags, 0x26, 4) !== 0 ? 1 : 0
    m.setU8(outAddr, (hasBit4 + 4) & 0xff)
    return 1
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x26, 0x0e) !== 0) {
    m.setU8(outAddr, 0x0c)
    return 1
  }
  if (m.u8((pQuest + 0x0c) >>> 0) < 4) {
    m.setU8(outAddr, m.u8((pQuest + 0x0b) >>> 0))
  }
  return 1
}

/**
 * Returns `1` iff quest node `0x21` exists in `pGame` (`eax`) and `pQuestDataEx[+0x84] == 0`,
 * otherwise `0`.
 *
 * @va D2Game:0x6FC76950
 */
export function ACT5Q3_IsFrozenAnyaUnspawned_6FC76950_113c(
  m: Memory113c,
  pGame: number,
): number {
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x21)
  if (pQuest === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  return m.u32((pQuestDataEx + 0x84) >>> 0) === 0 ? 1 : 0
}

/**
 * Records `pUnit` (`edx`) coordinates into `pQuest21->pQuestDataEx + 0xC4` via
 * `PATH_GetTargetTypeAndPosition113c`, sets `pQuestDataEx[+0xE0] = 1`, and returns `1`
 * (or `0` when quest node `0x21` is absent in `ecx = pGame`).
 *
 * @va D2Game:0x6FC76A00
 */
export function ACT5Q3_RecordAnyaPosition_6FC76A00_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x21)
  if (pQuest === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, (pQuestDataEx + 0xc4) >>> 0)
  m.setU8((pQuestDataEx + 0xe0) >>> 0, 1)
  return 1
}

/**
 * Resolves Prison of Ice portal target coordinates into `pOutCoords` (`[esp+4]`, `ret 0x4`)
 * for `(ecx = pGame, edx = pUnit)`:
 * - Returns `0` if quest node `0x21` is missing or `pQuestDataEx[+0x84] == 0`.
 * - When `pQuestDataEx[+0xB1] == 0`, queries `PATH_GetTargetTypeAndPosition113c(m, pUnit, pOutCoords)`.
 * - Otherwise copies `(dwX, dwY)` from `pQuestDataEx + 0xC4..+0xC8` into `pOutCoords[0..1]`.
 *
 * @va D2Game:0x6FC76A40
 */
export function ACT5Q3_GetPortalTargetCoords_6FC76A40_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  pOutCoords: number,
): number {
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x21)
  if (pQuest === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u32((pQuestDataEx + 0x84) >>> 0) === 0) {
    return 0
  }
  const outAddr = pOutCoords >>> 0
  if (m.u8((pQuestDataEx + 0xb1) >>> 0) === 0) {
    PATH_GetTargetTypeAndPosition113c(m, pUnit >>> 0, outAddr)
    return 1
  }
  m.setU32(outAddr, m.u32((pQuestDataEx + 0xc4) >>> 0))
  m.setU32((outAddr + 0x04) >>> 0, m.u32((pQuestDataEx + 0xc8) >>> 0))
  return 1
}

/**
 * Computes the remaining barbarian soldier count for Act 5 Quest 2 (`eax = pQuest`),
 * summing `5` per unspawned prison group (`pQuestDataEx[+0x86..+0x88] == 0`) plus
 * `pQuestDataEx[+0xA4] - pQuestDataEx[+0xAC] - pQuestDataEx[+0xA8]`, clamped at `>= 0`.
 *
 * @va D2Game:0x6FC76B80
 */
export function ACT5Q2_CalcRemainingSoldiersCount_6FC76B80_113c(
  m: Memory113c,
  pQuest: number,
): number {
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  let count = 0
  if (m.u8((pQuestDataEx + 0x86) >>> 0) === 0) {
    count = 5
  }
  if (m.u8((pQuestDataEx + 0x87) >>> 0) === 0) {
    count = (count + 5) | 0
  }
  if (m.u8((pQuestDataEx + 0x88) >>> 0) === 0) {
    count = (count + 5) | 0
  }
  let delta = m.u32((pQuestDataEx + 0xa4) >>> 0) | 0
  delta = (delta - (m.u32((pQuestDataEx + 0xac) >>> 0) | 0)) | 0
  delta = (delta - (m.u32((pQuestDataEx + 0xa8) >>> 0) | 0)) | 0
  const total = (count + delta) | 0
  return total < 0 ? 0 : total
}

/**
 * Act 5 Quest 2 (`Rescue on Mount Arreat`) `pfActiveFilter` (`+0xEC`, `ecx = pQuest`, `edx = nNpcId`,
 * `[esp+4] = _pPlayer`, `[esp+8] = pQuestFlags`, `[esp+0xC] = _pNpcUnit`, `ret 0xC`) for
 * Qual-Kehk (`0x203`) and captive soldiers (`0x216`).
 *
 * @va D2Game:0x6FC76C40
 */
export function ACT5Q2_ActiveFilter_6FC76C40_113c(
  m: Memory113c,
  pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  const npc = nNpcId | 0
  const flags = pQuestFlags >>> 0
  if (npc === 0x203) {
    if (m.u8((pQuest + 0x0c) >>> 0) === 1) {
      const nQuestId0 = m.u32((pQuest + 0xe0) >>> 0) | 0
      if (DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId0, 0) !== 0) {
        return 0
      }
      const nQuestId1 = m.u32((pQuest + 0xe0) >>> 0) | 0
      return DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId1, 1) === 0 ? 1 : 0
    }
    const nQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0
    return DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId, 1) !== 0 ? 1 : 0
  }
  if (npc === 0x216) {
    if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x24, 0) !== 0) {
      return 0
    }
    return DRLGWARP_TestRoomTileBit113c(m, flags, 0x24, 1) === 0 ? 1 : 0
  }
  return 0
}

/**
 * Object init table slot `0x46` (`ecx = _pObjInit`): single-byte `ret` no-op.
 *
 * @va D2Game:0x6FC76CE0
 */
export function ACT5_InitObjectNoop_6FC76CE0_113c(
  _m: Memory113c,
  _pObjInit: number,
): void {}

/**
 * Sets `pQuest->bLastState` (`+0x0C`) to `1` on `pQuest` (`eax`) when `bLastState == 0`
 * and `pQuest->bNotIntro` (`+0x09`) is non-zero.
 *
 * @va D2Game:0x6FC76CF0
 */
export function ACT5Q1_ActivateQuestIfNotIntro_6FC76CF0_113c(
  m: Memory113c,
  pQuest: number,
): void {
  if (m.u8((pQuest + 0x0c) >>> 0) !== 0) {
    return
  }
  if (m.u8((pQuest + 0x09) >>> 0) !== 0) {
    m.setU8((pQuest + 0x0c) >>> 0, 1)
  }
}

/**
 * Act 5 Quest 1 (`Siege on Harrogath`) `pfActiveFilter` (`+0xEC`, `ecx = pQuest`, `edx = nNpcId`,
 * `[esp+4] = _pPlayer`, `[esp+8] = pQuestFlags`, `[esp+0xC] = _pNpcUnit`, `ret 0xC`) for Larzuk (`0x1FF`).
 *
 * @va D2Game:0x6FC76D80
 */
export function ACT5Q1_ActiveFilter_6FC76D80_113c(
  m: Memory113c,
  pQuest: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpcUnit: number,
): number {
  if ((nNpcId | 0) !== 0x1ff) {
    return 0
  }
  const flags = pQuestFlags >>> 0
  const nQuestId0 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId0, 1) !== 0) {
    const nQuestId1 = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId1, 5) === 0) {
      return 1
    }
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    return 0
  }
  if (m.u8((pQuest + 0x0c) >>> 0) !== 1) {
    return 0
  }
  const nQuestId2 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId2, 0) !== 0) {
    return 0
  }
  const nQuestId3 = m.u32((pQuest + 0xe0) >>> 0) | 0
  return DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId3, 1) === 0 ? 1 : 0
}

/**
 * Act 5 Quest 1 (`Siege on Harrogath`, `QUESTRECORD` `0x23`) `pfStatusFilter` (`+0xE8`,
 * `ecx = pQuest`, `edx = _pPlayer`, `[esp+4] = _pGlobalFlags`, `[esp+8] = pPlayerFlags`,
 * `[esp+0xC] = pOutStatus`, `ret 0xC`): writes quest log status byte into `*pOutStatus` and returns `1`.
 *
 * @va D2Game:0x6FC76E00
 */
export function ACT5Q1_StatusFilter_6FC76E00_113c(
  m: Memory113c,
  pQuest: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  pPlayerFlags: number,
  pOutStatus: number,
): number {
  const outAddr = pOutStatus >>> 0
  const flags = pPlayerFlags >>> 0
  m.setU8(outAddr, 0)
  if (
    DRLGWARP_TestRoomTileBit113c(m, flags, 0x23, 1) !== 0 ||
    DRLGWARP_TestRoomTileBit113c(m, flags, 0x23, 0x0d) !== 0
  ) {
    const nQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0
    if (DRLGWARP_TestRoomTileBit113c(m, flags, nQuestId, 5) !== 0) {
      m.setU8(outAddr, 4)
      return 1
    }
    m.setU8(outAddr, 3)
    return 1
  }
  if (m.u8((pQuest + 0x09) >>> 0) === 0) {
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x23, 0) !== 0) {
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, flags, 0x23, 0x0e) !== 0) {
    m.setU8(outAddr, 0x0c)
    return 1
  }
  if (m.u8((pQuest + 0x0c) >>> 0) < 5) {
    m.setU8(outAddr, m.u8((pQuest + 0x0b) >>> 0))
  }
  return 1
}

/**
 * Act 5 intro `pfStatusFilter` (`+0xE8`, `ret 0xC`): clears `*pOutStatus = 0` and returns `0`.
 *
 * @va D2Game:0x6FC76EA0
 */
export function ACT5Q0_StatusFilter_6FC76EA0_113c(
  m: Memory113c,
  _pQuest: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  _pPlayerFlags: number,
  pOutStatus: number,
): number {
  m.setU8(pOutStatus >>> 0, 0)
  return 0
}

/**
 * Act 5 Quest 5 `pfCallback15` (`+0xD8`, `ecx = pQuest`, `edx = pQuestArg`):
 * if state `0` is set on `pQuest->dwQuestRecordId` (`+0xE0`) for `pQuestArg->pPlayer` (`+0x0C`),
 * also sets state `0x0A`.
 *
 * @va D2Game:0x6FC76EB0
 */
export function ACT5Q5_Callback15_SetState0AIfCompleted_6FC76EB0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const nQuestId0 = m.u32((pQuest + 0xe0) >>> 0) | 0
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId0, 0) !== 0) {
    const nQuestId1 = m.u32((pQuest + 0xe0) >>> 0) | 0
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, nQuestId1, 0x0a)
  }
}

/**
 * Act 5 Quest 5 `pfCallback11` (`+0xC8`, `ecx = pQuest`, `edx = pQuestArg`):
 * removes `pQuestArg->pPlayer` GUID (`0xFFFFFFFF` if NULL) from both `pQuest + 0x1C`
 * and `pQuest->pQuestDataEx` (`[pQuest + 0x18]`).
 *
 * @va D2Game:0x6FC76FC0
 */
export function ACT5Q5_Callback11_RemovePlayerGuid_6FC76FC0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  return removeQuestArgPlayerFromQuestAndExGuidLists113c(m, pQuest, pQuestArg)
}

/**
 * Act 5 Quest 5 `pfCallback12` (`+0xCC`, `ecx = pQuest`, `edx = pQuestArg`):
 * maps `pQuestArg->wMessageIndex` (`+0x18`) in `0x4ECF..0x4ED4` via jump table `0x6FC77300`
 * (`[7, 9, 5, 4, 6, 8]`) and sets that state on `pQuest->dwQuestRecordId` (`+0xE0`).
 *
 * @va D2Game:0x6FC77270
 */
export function ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  const msgId = m.u16((pQuestArg + 0x18) >>> 0)
  const idx = (msgId + 0xffffb131) >>> 0
  if (idx > 5) {
    return
  }
  const nState = ACT5Q5_SCROLL_MSG_STATES[idx]!
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const nQuestId = m.u32((pQuest + 0xe0) >>> 0) | 0
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, nQuestId, nState)
}

/**
 * Player iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * when `pPlayer` is in Act 5 (`actNo == 4`), `QUESTRECORD` `0x28` states `0` and `1` are both not `1`,
 * and quest node `0x24` has `bLastState` (`+0x0C`) equal to `2` or `3`, sets `0x28` to that state.
 *
 * @va D2Game:0x6FC77320
 */
export function ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x28, 1) === 1) {
    return 0
  }
  const pRoom = UNITS_GetRoom113c(m, pPlayer >>> 0) >>> 0
  if (pRoom === 0) {
    return 0
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) {
    return 0
  }
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (actNo !== 4) {
    return 0
  }
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x24)
  if (pQuest === 0) {
    return 0
  }
  const bState = m.u8((pQuest + 0x0c) >>> 0)
  if (bState === 2 || bState === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x28, bState)
  }
  return 0
}

/**
 * Object init handler (`ecx = pObjInit`): binds the Altar of the Heavens object (`[ecx + 0x04]`)
 * onto `pQuest23->pQuestDataEx` (`+0x58 = 1`, `+0x5C = guid`), applies anim mode `[+0x60]`, and
 * if `pQuestDataEx[+0x00] == 0` and `[+0x60] != 2`, sets `[+0x60] = 2` and anim mode `1`.
 *
 * @va D2Game:0x6FC773D0
 */
export function ACT5Q5_InitAncientsAltarObject_6FC773D0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  const pGame = m.u32(pObjInit >>> 0) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame, 0x23)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU8((pQuestDataEx + 0x58) >>> 0, 1)
  const pObject0 = m.u32((pObjInit + 0x04) >>> 0) >>> 0
  const objGuid = pObject0 === 0 ? 0xffffffff : m.u32((pObject0 + 0x0c) >>> 0) >>> 0
  const initialMode = m.u32((pQuestDataEx + 0x60) >>> 0)
  m.setU32((pQuestDataEx + 0x5c) >>> 0, objGuid)
  const pObject1 = m.u32((pObjInit + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObject1, initialMode)
  if (m.u8(pQuestDataEx) === 0) {
    if (m.u32((pQuestDataEx + 0x60) >>> 0) !== 2) {
      m.setU32((pQuestDataEx + 0x60) >>> 0, 2)
      const pObject2 = m.u32((pObjInit + 0x04) >>> 0) >>> 0
      UNITS_ChangeAnimMode113c(m, pObject2, 1)
    }
  }
}

/**
 * Player iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * increments `pQuest23->pQuestDataEx[+0x54]` when `pPlayer` is in Arreat Summit (`levelId == 0x78`)
 * and `pPlayer->dwAnimMode` (`+0x10`) is neither `0` nor `0x11`.
 *
 * @va D2Game:0x6FC77440
 */
export function ACT5Q5_CountLivingSummitPlayersCallback_6FC77440_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const player = pPlayer >>> 0
  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) {
    return 0
  }
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId !== 0x78) {
    return 0
  }
  if (player === 0) {
    return 0
  }
  const animMode = m.u32((player + 0x10) >>> 0)
  if (animMode === 0 || animMode === 0x11) {
    return 0
  }
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x23)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU32((pQuestDataEx + 0x54) >>> 0, ((m.u32((pQuestDataEx + 0x54) >>> 0) | 0) + 1) >>> 0)
  return 0
}

/**
 * Object init handler (`ecx = pObjInit`): stores `pObjInit->pObject` GUID (`0xFFFFFFFF` if NULL)
 * into `pQuest23->pQuestDataEx[+0x50]` and sets object anim mode to `pQuestDataEx[+0x4C]`
 * when quest node `0x23` exists.
 *
 * @va D2Game:0x6FC774A0
 */
export function ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c(
  m: Memory113c,
  pObjInit: number,
): void {
  const pGame = m.u32(pObjInit >>> 0) >>> 0
  const pQuest = findQuestNodeInChain113c(m, pGame, 0x23)
  if (pQuest === 0) {
    return
  }
  const pObject0 = m.u32((pObjInit + 0x04) >>> 0) >>> 0
  const objGuid = pObject0 === 0 ? 0xffffffff : m.u32((pObject0 + 0x0c) >>> 0) >>> 0
  const pQuestDataEx0 = m.u32((pQuest + 0x18) >>> 0) >>> 0
  m.setU32((pQuestDataEx0 + 0x50) >>> 0, objGuid)
  const pQuestDataEx1 = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const nMode = m.u32((pQuestDataEx1 + 0x4c) >>> 0)
  const pObject1 = m.u32((pObjInit + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObject1, nMode)
}

/**
 * Applies the saved statue anim mode from `pQuestDataEx + 0x30 + slot * 4` (`edx = pQuestDataEx`)
 * to `pObjInit->pObject` (`[eax + 0x04]`) for Ancients statue class IDs:
 * - `0x1DA` (`474`) -> `slot = 1` (`+0x34`)
 * - `0x1DB` (`475`) -> `slot = 0` (`+0x30`)
 * - `0x1DC` (`476`) -> `slot = 2` (`+0x38`)
 *
 * @va D2Game:0x6FC774F0
 */
export function ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c(
  m: Memory113c,
  pObjInit: number,
  pQuestDataEx: number,
): void {
  const pObject = m.u32((pObjInit + 0x04) >>> 0) >>> 0
  const classId = pObject === 0 ? -1 : m.u32((pObject + 0x04) >>> 0) | 0
  let slot = -1
  if (classId === 0x1da) {
    slot = 1
  } else if (classId === 0x1db) {
    slot = 0
  } else if (classId === 0x1dc) {
    slot = 2
  } else {
    return
  }
  const nMode = m.u32((pQuestDataEx + 0x30 + slot * 4) >>> 0)
  UNITS_ChangeAnimMode113c(m, pObject, nMode)
}

/**
 * Act 5 Quest 6 `pfCallback14` (`+0xD4`, `ecx = pQuest`, `edx = pQuestArg`):
 * - Sets `pQuest->pQuestDataEx[+0x4A] = 1` when `pQuest->dwQuestRecordId` (`+0xE0`) state `0` or `0x0F` is set.
 * - Otherwise sets `pQuest + 0x0B = 1` and `pQuest + 0x0C = 3` (if state `3` is `1`) or `2` (if state `2` is `1`).
 *
 * @va D2Game:0x6FC77540
 */
export function ACT5Q6_Callback14_PlayerJoined_6FC77540_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const nQuestId0 = m.u32((pQuest + 0xe0) >>> 0) | 0
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId0, 0) !== 0) {
    const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
    m.setU8((pQuestDataEx + 0x4a) >>> 0, 1)
    return
  }
  const nQuestId1 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId1, 0x0f) !== 0) {
    const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
    m.setU8((pQuestDataEx + 0x4a) >>> 0, 1)
    return
  }
  const nQuestId2 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId2, 3) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 1)
    m.setU8((pQuest + 0x0c) >>> 0, 3)
    return
  }
  const nQuestId3 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId3, 2) === 1) {
    m.setU8((pQuest + 0x0b) >>> 0, 1)
    m.setU8((pQuest + 0x0c) >>> 0, 2)
  }
}

/**
 * Act 5 Quest 6 `pfCallback11` (`+0xC8`, `ecx = pQuest`, `edx = pQuestArg`):
 * removes `pQuestArg->pPlayer` GUID (`0xFFFFFFFF` if NULL) from `pQuest + 0x1C`.
 *
 * @va D2Game:0x6FC775D0
 */
export function ACT5Q6_Callback11_RemovePlayerGuid_6FC775D0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  const pUnit = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const guid = pUnit === 0 ? 0xffffffff : m.u32((pUnit + 0x0c) >>> 0) >>> 0
  return QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, guid)
}

/**
 * Player iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * when `QUESTRECORD` `0x27` state `0` is not `1`, `STATLIST_GetUnitBaseStat(pPlayer, STAT_LEVEL=12, 0)`
 * is at least `(nDifficulty + 1) * 20`, and quest node `0x23` has `bLastState` (`+0x0C`) equal to
 * `2` or `3`, sets `QUESTRECORD` `0x27` to that state.
 *
 * @va D2Game:0x6FC77750
 */
export function ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx0 = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx0 * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x27, 0) === 1) {
    return 0
  }
  const baseLevel = STATLIST_GetUnitBaseStat113c(m, player, 0x0c, 0) | 0
  const reqLevel = ((m.u8((pGame + 0x6d) >>> 0) + 1) * 20) | 0
  if (baseLevel < reqLevel) {
    return 0
  }
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x23)
  if (pQuest === 0) {
    return 0
  }
  const bState = m.u8((pQuest + 0x0c) >>> 0)
  if (bState === 2 || bState === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x27, bState)
  }
  return 0
}

/**
 * Completes the Anya personalization reward on `QUESTRECORD` `0x26` for `pPlayer` (`eax`)
 * in `pGame` (`[esp+4]`, `ret 0x4`): sets state `0`, clears state `1`, and returns
 * `DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0F)`.
 *
 * @va D2Game:0x6FC777F0
 */
export function ACT5Q4_CompletePersonalizationReward_6FC777F0_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0)
  QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x26, 1)
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0f)
}

/**
 * Party iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * awards `QUESTRECORD` `0x26` states `1` and `0x0D` to eligible Act 5 (`actNo == 4`) party
 * members who have completed or started `0x25` (`state 0` or `1` set) and lack `0x26` states
 * `0`, `0x0E`, `1`, and `0x0D`.
 *
 * @va D2Game:0x6FC77830
 */
export function ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): void {
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0e) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 1) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0x0d) === 1) return
  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (actNo !== 4) return
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1) === 0
  ) {
    return
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0) !== 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 1) !== 0) return
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 1)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, 0x0d)
}

/**
 * Act 5 Quest 4 `pfCallback11` (`+0xC8`, `ecx = pQuest`, `edx = pQuestArg`):
 * removes `pQuestArg->pPlayer` GUID (`0xFFFFFFFF` if NULL) from both `pQuest + 0x1C`
 * and `pQuest->pQuestDataEx` (`[pQuest + 0x18]`).
 *
 * @va D2Game:0x6FC77A20
 */
export function ACT5Q4_Callback11_RemovePlayerGuid_6FC77A20_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  return removeQuestArgPlayerFromQuestAndExGuidLists113c(m, pQuest, pQuestArg)
}

/**
 * Player iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * when `QUESTRECORD` `0x25` has state `0` or `1` set, `0x26` states `0` and `1` are both not `1`,
 * and quest node `0x22` has `bLastState` (`+0x0C`) equal to `2` or `3`, sets `0x26` to that state.
 *
 * @va D2Game:0x6FC77C00
 */
export function ACT5Q4_SyncNihlathakQuestStateCallback_6FC77C00_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0) === 0 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1) === 0
  ) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x26, 1) === 1) {
    return 0
  }
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x22)
  if (pQuest === 0) {
    return 0
  }
  const bState = m.u8((pQuest + 0x0c) >>> 0)
  if (bState === 2 || bState === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x26, bState)
  }
  return 0
}

/**
 * Spawns or verifies the Prison of Ice return portal (`classId = 0xBD`, `UNIT_OBJECT = 2`)
 * for `(ecx = pGame, edx = pUnit)` using `pQuest21->pQuestDataEx`:
 * - Returns `0` if quest node `0x21` is absent, or `1` immediately if `pQuestDataEx[+0xB1] != 0`.
 * - If `pQuestDataEx[+0x84] == 0`, returns `0`.
 * - Probes `ROOM_FindRoomContainingSubtile113c` around `UNITS_GetRoom113c(m, pUnit)` at
 *   `(pQuestDataEx[+0xC4], pQuestDataEx[+0xC8])`; if `0`, advances both coords by `+3` and returns `0`.
 * - Otherwise allocates object `0xBD` via `SUNIT_AllocUnitData113c`; on success sets `+0xB1 = 1`,
 *   stores `pObj->dwUnitId` at `+0xC0`, and returns `1`.
 *
 * @va D2Game:0x6FC77CB0
 */
export function ACT5Q3_EnsureAnyaTownPortalSpawned_6FC77CB0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): number {
  const game = pGame >>> 0
  const pQuest = findQuestNodeInChain113c(m, game, 0x21)
  if (pQuest === 0) {
    return 0
  }
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0xb1) >>> 0) !== 0) {
    return 1
  }
  if (m.u32((pQuestDataEx + 0x84) >>> 0) === 0) {
    return 0
  }
  const pStartRoom = UNITS_GetRoom113c(m, pUnit >>> 0) >>> 0
  const probeY = m.u32((pQuestDataEx + 0xc8) >>> 0) | 0
  const probeX = m.u32((pQuestDataEx + 0xc4) >>> 0) | 0
  const pTargetRoom = ROOM_FindRoomContainingSubtile113c(m, pStartRoom, probeX, probeY) >>> 0
  if (pTargetRoom === 0) {
    const nextX = ((m.u32((pQuestDataEx + 0xc4) >>> 0) | 0) + 3) >>> 0
    const nextY = ((m.u32((pQuestDataEx + 0xc8) >>> 0) | 0) + 3) >>> 0
    m.setU32((pQuestDataEx + 0xc4) >>> 0, nextX)
    m.setU32((pQuestDataEx + 0xc8) >>> 0, nextY)
    return 0
  }
  const spawnX = m.u32((pQuestDataEx + 0xc4) >>> 0) | 0
  const spawnY = m.u32((pQuestDataEx + 0xc8) >>> 0) | 0
  const pPortalObj =
    SUNIT_AllocUnitData113c(m, 2, 0xbd, spawnX, spawnY, game, pTargetRoom, 1, 1, 0) >>> 0
  if (pPortalObj === 0) {
    return 0
  }
  m.setU8((pQuestDataEx + 0xb1) >>> 0, 1)
  m.setU32((pQuestDataEx + 0xc0) >>> 0, m.u32((pPortalObj + 0x0c) >>> 0))
  return 1
}

/**
 * Party iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * awards `QUESTRECORD` `0x25` states `0x0D` and `1` to Act 5 (`actNo == 4`) party members
 * when states `0` and `1` are both not `1`.
 *
 * @va D2Game:0x6FC780A0
 */
export function ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): void {
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1) === 1) return
  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (actNo !== 4) return
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, 1)
}

/**
 * Player iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * when `QUESTRECORD` `0x25` states `0` and `1` are both not `1` and quest node `0x21` has
 * `bLastState` (`+0x0C`) equal to `2` or `3`, sets `0x25` to that state.
 *
 * @va D2Game:0x6FC78110
 */
export function ACT5Q3_SyncPrisonOfIceQuestStateCallback_6FC78110_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): number {
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1) === 1) {
    return 0
  }
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x21)
  if (pQuest === 0) {
    return 0
  }
  const bState = m.u8((pQuest + 0x0c) >>> 0)
  if (bState === 2 || bState === 3) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x25, bState)
  }
  return 0
}

/**
 * Act 5 Quest 2 `pfCallback14` (`+0xD4`, `ecx = pQuest`, `edx = pQuestArg`):
 * clears state `4` on `pQuest->dwQuestRecordId` (`+0xE0`), then if states `0`, `0x0F`, and `1`
 * are clear, promotes `pQuest + 0x0C = 3, +0x0B = 1` (when state `3` is `1`) or
 * `pQuest + 0x0C = 2, +0x0B = 1` (when state `2` is `1`).
 *
 * @va D2Game:0x6FC781A0
 */
export function ACT5Q2_Callback14_PlayerJoined_6FC781A0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): void {
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const nQuestId0 = m.u32((pQuest + 0xe0) >>> 0) | 0
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  QUESTRECORD_ClearQuestState113c(m, pQuestFlags, nQuestId0, 4)
  const nQuestId1 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId1, 0) !== 0) return
  const nQuestId2 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId2, 0x0f) !== 0) return
  const nQuestId3 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId3, 1) === 1) return
  const nQuestId4 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId4, 3) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 3)
    m.setU8((pQuest + 0x0b) >>> 0, 1)
    return
  }
  const nQuestId5 = m.u32((pQuest + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuestId5, 2) === 1) {
    m.setU8((pQuest + 0x0c) >>> 0, 2)
    m.setU8((pQuest + 0x0b) >>> 0, 1)
  }
}

/**
 * Act 5 Quest 2 `pfCallback15` (`+0xD8`, `ecx = _pQuest`, `edx = pQuestArg`):
 * clears `QUESTRECORD` `0x24` state `4` on `pQuestArg->pPlayer` (`+0x0C`).
 *
 * @va D2Game:0x6FC78240
 */
export function ACT5Q2_Callback15_ClearState04_6FC78240_113c(
  m: Memory113c,
  _pQuest: number,
  pQuestArg: number,
): void {
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x24, 4)
}

/**
 * Searches the `3 x 5` soldier GUID matrix at `pQuest->pQuestDataEx + 0xB0` (`ecx = pQuest`,
 * row stride `0x14`) for `pUnit` (`eax`, matching `0xFFFFFFFF` when `pUnit == 0`, else
 * `pUnit->dwUnitId`), returning group index `0..2` or `-1` if not found.
 *
 * @va D2Game:0x6FC78260
 */
export function ACT5Q2_FindSoldierPrisonGroupIndex_6FC78260_113c(
  m: Memory113c,
  pUnit: number,
  pQuest: number,
): number {
  const unit = pUnit >>> 0
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const targetGuid = unit === 0 ? 0xffffffff : m.u32((unit + 0x0c) >>> 0) >>> 0
  for (let groupIdx = 0; groupIdx < 3; groupIdx++) {
    const rowBase = (pQuestDataEx + 0xb0 + groupIdx * 0x14) >>> 0
    for (let slot = 0; slot < 5; slot++) {
      if ((m.u32((rowBase + slot * 4) >>> 0) >>> 0) === targetGuid) {
        return groupIdx
      }
    }
  }
  return -1
}

/**
 * Act 5 Quest 2 `pfCallback11` (`+0xC8`, `ecx = pQuest`, `edx = pQuestArg`):
 * removes `pQuestArg->pPlayer` GUID (`0xFFFFFFFF` if NULL) from both `pQuest + 0x1C`
 * and `pQuest->pQuestDataEx` (`[pQuest + 0x18]`).
 *
 * @va D2Game:0x6FC782A0
 */
export function ACT5Q2_Callback11_RemovePlayerGuid_6FC782A0_113c(
  m: Memory113c,
  pQuest: number,
  pQuestArg: number,
): number {
  return removeQuestArgPlayerFromQuestAndExGuidLists113c(m, pQuest, pQuestArg)
}

/**
 * Party iteration callback (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = _pArg`, `ret 0x4`):
 * when `QUESTRECORD` `0x24` states `0` and `1` are both not `1` and `pPlayer` is in Act 5 (`actNo == 4`),
 * sets `0x24` states `0x0D` and `1`, then sets state `5` (if `pQuest20->pQuestDataEx[+0xAC] == 15`),
 * `6` (if `== 14`), or `7` (otherwise).
 *
 * @va D2Game:0x6FC782E0
 */
export function ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  _pArg: number,
): void {
  const player = pPlayer >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, player) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 0) === 1) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x24, 1) === 1) return
  const pRoom = UNITS_GetRoom113c(m, player) >>> 0
  if (pRoom === 0) return
  const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
  if (nLevelId === 0) return
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevelId) & 0xff
  if (actNo !== 4) return
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 0x0d)
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 1)
  const pQuest = findQuestNodeInChain113c(m, pGame >>> 0, 0x20)
  const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
  const savedSoldiers = m.u32((pQuestDataEx + 0xac) >>> 0) | 0
  if (savedSoldiers === 0x0f) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 5)
    return
  }
  if (savedSoldiers === 0x0e) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 6)
    return
  }
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x24, 7)
}
