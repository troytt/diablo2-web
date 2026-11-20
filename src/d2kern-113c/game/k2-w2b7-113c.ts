/**
 * Pure 1:1 `D2Game.dll` v1.13c `[K2]` Wave 2 Batch 7 (`w2b7`) routines across
 * `0x6FCE1F90..0x6FCEB4E0` (45 functions: Act 2 quest state/filter/iteration/portal
 * callbacks across `ACT2Q0..ACT2Q8`, `MONREG` active evil monster count decrement,
 * `STATES` gfx state flag clear wrapper, and `PACKET` `0x48`/`0x53`/`0x54` handlers).
 *
 * Every `@va`-annotated export is a direct instruction-faithful translation of
 * its corresponding `D2Game.dll` v1.13c machine-code routine operating on
 * `Memory113c` (`SparseMemory113c`).
 */

import { UNITS_GetPlayerData113c } from '../common/composit.ts'
import { DUNGEON_GetLevelIdFromRoom113c } from '../common/dungeon.ts'
import { ENV_InitEclipseEnvironment113c } from '../common/env.ts'
import { D2CommonAssertError } from '../common/inline-helpers.ts'
import { DRLGWARP_TestRoomTileBit113c } from '../common/items.ts'
import {
  QUESTRECORD_ClearQuestState113c,
  QUESTRECORD_SetQuestState113c,
} from '../common/quest-record.ts'
import { STATES_ToggleGfxStateFlag113c, STATLIST_GetUnitStat113c } from '../common/statlist.ts'
import {
  UNITS_GetRoom113c,
  UNITS_SetTargetUnitForDynamicUnitEx113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { QUESTS_GuidListRemove113c } from './a1c-post150-f150-f276-113c.ts'
import { SUNIT_SetUnitEventSound113c } from './ai-fallen-113c.ts'
import {
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c,
  QUESTS_SendQuestStateAlert5D_113c,
} from './k2-items-tc-w1-113c.ts'
import { ITEMS_FindQuestItemByBaseCode_6FC2E660_113c } from './k2-laneI-0x6fc3-w1-113c.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import { hitD2GameVa113c } from '../va-trace-113c.ts'

/**
 * Walks `pGame->pQuestControl (+0x10F4)->pQuest (+0x00)` via `pPrev (+0xF4)` to find
 * quest `11` (`0x0B`, `ACT2Q4`). If found and `pQuestDataEx->bJournalReady (+0x0F) == 1`
 * while `pQuestDataEx->bJournalActivated (+0x10) == 0`, sets `+0x10 = 1` and returns `1`;
 * otherwise returns `0` (`eax = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce1f90
 */
export function ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCE1F90)
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return 0
  eax = m.u32(eax) >>> 0
  if (eax === 0) return 0
  while ((m.u32(eax) | 0) !== 0x0b) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return 0
  }
  const pQuestDataEx = m.u32((eax + 0x18) >>> 0) >>> 0
  if (m.u8((pQuestDataEx + 0x0f) >>> 0) !== 1) return 0
  if (m.u8((pQuestDataEx + 0x10) >>> 0) !== 0) return 0
  m.setU8((pQuestDataEx + 0x10) >>> 0, 1)
  return 1
}

/**
 * Walks `pGame->pQuestControl (+0x10F4)->pQuest (+0x00)` via `pPrev (+0xF4)` to find
 * quest `11` (`0x0B`, `ACT2Q4`) and returns `1` if `u16 [pQuestDataEx + 0x40] == 2`,
 * else `0` (`eax = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce2040
 */
export function ACT2Q4_IsPortalOpen_6FCE2040_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCE2040)
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return 0
  eax = m.u32(eax) >>> 0
  if (eax === 0) return 0
  while ((m.u32(eax) | 0) !== 0x0b) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return 0
  }
  const pQuestDataEx = m.u32((eax + 0x18) >>> 0) >>> 0
  return m.u16((pQuestDataEx + 0x40) >>> 0) === 2 ? 1 : 0
}

/**
 * Reads `pGame = pAct->pGame (+0x04)`, walks `pGame->pQuestControl (+0x10F4)` for
 * quest `10` (`0x0A`, `ACT2Q3`), and returns `u8 [pQuestDataEx + 0x04]` or `0` if
 * not found (`eax = pAct`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce2120
 */
export function ACT2Q3_GetAltarState_6FCE2120_113c(
  m: Memory113c,
  pAct: number,
): number {
  hitD2GameVa113c(0x6FCE2120)
  const pGame = m.u32((pAct + 0x04) >>> 0) >>> 0
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return 0
  eax = m.u32(eax) >>> 0
  if (eax === 0) return 0
  while ((m.u32(eax) | 0) !== 0x0a) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return 0
  }
  const pQuestDataEx = m.u32((eax + 0x18) >>> 0) >>> 0
  return m.u8((pQuestDataEx + 0x04) >>> 0)
}

/**
 * When `(nAct & 0xFF) == 1`, looks up quest `10` (`0x0A`, `ACT2Q3`) on `pGame` (`ecx`);
 * if `u8 [pQuestDataEx + 0x03] == 1`, initializes eclipse environment on `pGame->pAct[1]`
 * (`+0xC0`) via `D2Common.#10337` (`ENV_InitEclipseEnvironment113c`), clears `+0x03 = 0`,
 * and sets `+0x02 = 1` (`al = nAct`, `ecx = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce2150
 */
export function ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c(
  m: Memory113c,
  nAct: number,
  pGame: number,
): void {
  hitD2GameVa113c(0x6FCE2150)
  if ((nAct & 0xff) !== 1) return
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return
  eax = m.u32(eax) >>> 0
  if (eax === 0) return
  while ((m.u32(eax) | 0) !== 0x0a) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return
  }
  const esi = m.u32((eax + 0x18) >>> 0) >>> 0
  if (m.u8((esi + 0x03) >>> 0) === 1) {
    const pAct1 = m.u32((pGame + 0xc0) >>> 0) >>> 0
    ENV_InitEclipseEnvironment113c(m, pAct1)
    m.setU8((esi + 0x03) >>> 0, 0)
    m.setU8((esi + 0x02) >>> 0, 1)
  }
}

/**
 * Walks `pGame->pQuestControl (+0x10F4)` for quest `10` (`0x0A`, `ACT2Q3`).
 * Returns `1` if the quest is absent, `pQuest->bNotIntro (+0x09) == 0`, or
 * `pQuest->nSeqFilter (+0x0C) >= 4`; returns `0` when `nSeqFilter < 4`
 * (`eax = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce21a0
 */
export function ACT2Q3_IsEclipseInactive_6FCE21A0_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCE21A0)
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return 1
  eax = m.u32(eax) >>> 0
  if (eax === 0) return 1
  while ((m.u32(eax) | 0) !== 0x0a) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return 1
  }
  if (m.u8((eax + 0x09) >>> 0) === 0) return 1
  return m.u8((eax + 0x0c) >>> 0) < 4 ? 0 : 1
}

/**
 * Single-byte `ret` stub at `0x6FCE2350`.
 *
 * @va D2Game.dll@0x6fce2350
 */
export function ACT2Q3_NoOpA_6FCE2350_113c(_m?: Memory113c): void {
  hitD2GameVa113c(0x6FCE2350)
}

/**
 * Single-byte `ret` stub at `0x6FCE2360`.
 *
 * @va D2Game.dll@0x6fce2360
 */
export function ACT2Q3_NoOpB_6FCE2360_113c(_m?: Memory113c): void {
  hitD2GameVa113c(0x6FCE2360)
}

/**
 * Single-byte `ret` stub at `0x6FCE2370`.
 *
 * @va D2Game.dll@0x6fce2370
 */
export function ACT2Q3_NoOpC_6FCE2370_113c(_m?: Memory113c): void {
  hitD2GameVa113c(0x6FCE2370)
}

/**
 * Reads `pGame = pAct->pGame (+0x04)`, finds quest `9` (`ACT2Q2`) in
 * `pGame->pQuestControl (+0x10F4)`, and adds `nDelta` (`[esp+4]`) to
 * `u32 [pQuestDataEx + 0x24]` (`eax = pAct`, `[esp+4] = nDelta`, `ret 4`).
 *
 * @va D2Game.dll@0x6fce2380
 */
export function ACT2Q2_AddStaffCount_6FCE2380_113c(
  m: Memory113c,
  pAct: number,
  nDelta: number,
): void {
  hitD2GameVa113c(0x6FCE2380)
  const pGame = m.u32((pAct + 0x04) >>> 0) >>> 0
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return
  eax = m.u32(eax) >>> 0
  if (eax === 0) return
  while ((m.u32(eax) | 0) !== 9) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return
  }
  const pQuestDataEx = m.u32((eax + 0x18) >>> 0) >>> 0
  const cur = m.u32((pQuestDataEx + 0x24) >>> 0) | 0
  m.setU32((pQuestDataEx + 0x24) >>> 0, ((cur + (nDelta | 0)) | 0) >>> 0)
}

/**
 * Single-byte `ret` stub at `0x6FCE2450`.
 *
 * @va D2Game.dll@0x6fce2450
 */
export function ACT2Q2_NoOp_6FCE2450_113c(_m?: Memory113c): void {
  hitD2GameVa113c(0x6FCE2450)
}

/**
 * Walks `pGame->pQuestControl (+0x10F4)` for quest `8` (`ACT2Q1` Radament).
 * Returns `1` if the quest is absent, `pQuest->bNotIntro (+0x09) == 0`, or
 * `pQuest->nSeqFilter (+0x0C) == 5`; otherwise returns `0` (`eax = pGame`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce2460
 */
export function ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c(
  m: Memory113c,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCE2460)
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return 1
  eax = m.u32(eax) >>> 0
  if (eax === 0) return 1
  while ((m.u32(eax) | 0) !== 8) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return 1
  }
  if (m.u8((eax + 0x09) >>> 0) === 0) return 1
  return m.u8((eax + 0x0c) >>> 0) === 5 ? 1 : 0
}

/**
 * `ACT2Q0` `pfActiveFilter` (`+0xEC`): returns `1` when `nNpcId == 0xC9` (`201`, Jerhyn)
 * and quest state `(8, 0)` is clear in `pQuestFlags` (`[esp+8]`); otherwise returns `0`
 * (`ecx = pQuestData`, `edx = nNpcId`, `[esp+4] = pPlayer`, `[esp+8] = pQuestFlags`,
 * `[esp+0xC] = pNpc`, `ret 0xC`).
 *
 * @va D2Game.dll@0x6fce2590
 */
export function ACT2Q0_ActiveFilter_6FCE2590_113c(
  m: Memory113c,
  _pQuestData: number,
  nNpcId: number,
  _pPlayer: number,
  pQuestFlags: number,
  _pNpc: number,
): number {
  hitD2GameVa113c(0x6FCE2590)
  if ((nNpcId | 0) !== 0xc9) return 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestFlags >>> 0, 8, 0) === 0 ? 1 : 0
}

/**
 * `ACT2Q0` `pfStatusFilter` (`+0xE8`): unconditionally returns `0` (`xor al, al; ret 0xC`).
 *
 * @va D2Game.dll@0x6fce25c0
 */
export function ACT2Q0_StatusFilter_6FCE25C0_113c(
  _m?: Memory113c,
  _pQuestData?: number,
  _pPlayer?: number,
  _pGlobalFlags?: number,
  _pFlags?: number,
  _pStatus?: number,
): number {
  hitD2GameVa113c(0x6FCE25C0)
  return 0
}

/**
 * `ACT2Q8` `pfActiveFilter` (`+0xEC`): unconditionally returns `0` (`xor al, al; ret 0xC`).
 *
 * @va D2Game.dll@0x6fce25d0
 */
export function ACT2Q8_ActiveFilter_6FCE25D0_113c(
  _m?: Memory113c,
  _pQuestData?: number,
  _nNpcId?: number,
  _pPlayer?: number,
  _pQuestFlags?: number,
  _pNpc?: number,
): number {
  hitD2GameVa113c(0x6FCE25D0)
  return 0
}

/**
 * `ACT2Q8` `pfStatusFilter` (`+0xE8`): zeroes `*pStatus` (`u8 [esp+0xC] = 0`) and returns `0`
 * (`ecx = pQuestData`, `edx = pPlayer`, `[esp+4] = pGlobalFlags`, `[esp+8] = pFlags`,
 * `[esp+0xC] = pStatus`, `ret 0xC`).
 *
 * @va D2Game.dll@0x6fce25e0
 */
export function ACT2Q8_StatusFilter_6FCE25E0_113c(
  m: Memory113c,
  _pQuestData: number,
  _pPlayer: number,
  _pGlobalFlags: number,
  _pFlags: number,
  pStatus: number,
): number {
  hitD2GameVa113c(0x6FCE25E0)
  m.setU8(pStatus >>> 0, 0)
  return 0
}

/**
 * When `u16 [pQuestArg + 0x14] == 0x17A` and `u16 [pQuestArg + 0x18] == 0x12F`, sets
 * quest state `(0x1F, 0)` on `pQuestArg->pPlayer (+0x0C)` for `pQuestArg->pGame->nDifficulty (+0x6D)`
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce2720
 */
export function ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c(
  m: Memory113c,
  _pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE2720)
  if (m.u16((pQuestArg + 0x14) >>> 0) !== 0x17a) return
  if (m.u16((pQuestArg + 0x18) >>> 0) !== 0x12f) return
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x1f, 0)
}

/**
 * `ACT2Q7` `pfActiveFilter` (`+0xEC`): for `nNpcId == 0x179` (`377`), reads the player's
 * quest flags for `pQuestData->pGame->nDifficulty` and returns `1` if either:
 * - `GetQuestState(0x1E, 0) == 0 && GetQuestState(0x1E, 0x0D) == 0`, or
 * - `GetQuestState(9, 0x0D) == 1 && GetQuestState(0x1E, 0) == 0`;
 * otherwise returns `0` (`ecx = pQuestData`, `edx = nNpcId`, `[esp+4] = pPlayer`,
 * `[esp+8] = pQuestFlags`, `[esp+0xC] = pNpc`, `ret 0xC`).
 *
 * @va D2Game.dll@0x6fce2750
 */
export function ACT2Q7_ActiveFilter_6FCE2750_113c(
  m: Memory113c,
  pQuestData: number,
  nNpcId: number,
  pPlayer: number,
  _pQuestFlags?: number,
  _pNpc?: number,
): number {
  hitD2GameVa113c(0x6FCE2750)
  if ((nNpcId | 0) !== 0x179) return 0
  const pGame = m.u32((pQuestData + 0x04) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x1e, 0) === 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x1e, 0x0d) === 0) {
      return 1
    }
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pFlags, 9, 0x0d) !== 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pFlags, 0x1e, 0) !== 0) {
    return 0
  }
  return 1
}

/**
 * When `pQuestArg->pTarget (+0x08)` is non-null with `wClassId (+0x04) == 0x179` and
 * `u8 [pQuestData->pQuestDataEx] == 1`, clears `u8 [pQuestData->pQuestDataEx] = 0`
 * and `u32 [pQuestData + 0xA8] = 0` (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce27c0
 */
export function ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE27C0)
  const pNpc = m.u32((pQuestArg + 0x08) >>> 0) >>> 0
  if (pNpc === 0) return
  if (m.u16((pNpc + 0x04) >>> 0) !== 0x179) return
  const pQuestDataEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  if (m.u8(pQuestDataEx) !== 1) return
  m.setU8(pQuestDataEx, 0)
  m.setU32((pQuestData + 0xa8) >>> 0, 0)
}

/**
 * Initializes the Horadric Orifice object (`pInteractArg->pObject (+0x04)`) for quest `13`
 * (`0x0D`, `ACT2Q6`): sets `u8 [pQuestDataEx + 0x05] = 1`, records the object GUID in
 * `u32 [pQuestDataEx + 0x2C]`, and transitions the object animation mode via
 * `D2Common.#11090` (`2` if `pQuest->bNotIntro (+0x09) == 0`, else `u32 [pQuestDataEx + 0x18]`)
 * (`ecx = pInteractArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce27f0
 */
export function ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c(
  m: Memory113c,
  pInteractArg: number,
): void {
  hitD2GameVa113c(0x6FCE27F0)
  const pGame = m.u32(pInteractArg >>> 0) >>> 0
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return
  eax = m.u32(eax) >>> 0
  if (eax === 0) return
  while ((m.u32(eax) | 0) !== 0x0d) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return
  }
  const edx = m.u32((eax + 0x18) >>> 0) >>> 0
  m.setU8((edx + 0x05) >>> 0, 1)
  const pObj0 = m.u32((pInteractArg + 0x04) >>> 0) >>> 0
  const dwGuid = pObj0 === 0 ? 0xffffffff : m.u32((pObj0 + 0x0c) >>> 0) >>> 0
  m.setU32((edx + 0x2c) >>> 0, dwGuid)
  const bNotIntro = m.u8((eax + 0x09) >>> 0)
  if (bNotIntro === 0) {
    const pObj1 = m.u32((pInteractArg + 0x04) >>> 0) >>> 0
    UNITS_ChangeAnimMode113c(m, pObj1, 2)
    return
  }
  const nMode = m.u32((edx + 0x18) >>> 0) | 0
  const pObj2 = m.u32((pInteractArg + 0x04) >>> 0) >>> 0
  UNITS_ChangeAnimMode113c(m, pObj2, nMode)
}

/**
 * Clears quest state `(0x0A, 9)` on `pQuestArg->pPlayer (+0x0C)` for
 * `pQuestArg->pGame->nDifficulty (+0x6D)` via `D2Common.#10593`
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce29c0
 */
export function ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c(
  m: Memory113c,
  _pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE29C0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  QUESTRECORD_ClearQuestState113c(m, pQuestFlags, 0x0a, 9)
}

/**
 * Unit-iteration callback for `ACT2Q6`: if quest state `(0x0E, 0)` is not set (`!= 1`)
 * on `pUnit` (`edx`) and quest `13` (`0x0D`) in `pGame->pQuestControl (+0x10F4)` has
 * `u8 [pQuest + 0x0C] >= 2`, sets quest state `(0x0E, 2)` on `pUnit`
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4` -> `0`).
 *
 * @va D2Game.dll@0x6fce2a90
 */
export function ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE2A90)
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0) === 1) {
    return 0
  }
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  if (pQuest === 0) return 0
  while ((m.u32(pQuest) | 0) !== 0x0d) {
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
    if (pQuest === 0) return 0
  }
  if (m.u8((pQuest + 0x0c) >>> 0) >= 2) {
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 2)
  }
  return 0
}

/**
 * `ACT2Q6` wrapper around `0x6FC540C0` (`QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c`)
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce2af0
 */
export function ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE2AF0)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
}

/**
 * `ACT2Q5` player-join/started callback: if quest state `(pQuestData->nQuestFilter, 0)` and
 * `(pQuestData->nQuestFilter, 0x0F)` are both `0` and `GetQuestState(0x0D, 2) == 1`, sets
 * `u8 [pQuestData + 0x0B] = 2` and `u8 [pQuestData + 0x0C] = 1`
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce2dc0
 */
export function ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE2DC0)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pGame = m.u32(pQuestArg >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const nQuest0 = m.u32((pQuestData + 0xe0) >>> 0) | 0
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuest0, 0) !== 0) return
  const nQuest1 = m.u32((pQuestData + 0xe0) >>> 0) | 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, nQuest1, 0x0f) !== 0) return
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 2) === 1) {
    m.setU8((pQuestData + 0x0b) >>> 0, 2)
    m.setU8((pQuestData + 0x0c) >>> 0, 1)
  }
}

/**
 * `ACT2Q5` wrapper around `0x6FC540C0` (`QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c`)
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce2f00
 */
export function ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE2F00)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
}

/**
 * Unit-iteration callback for `ACT2Q4`: queries quest state `(0x0C, 0x0D)` on `pUnit`
 * (`edx`) and returns `0` (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4`).
 *
 * @va D2Game.dll@0x6fce3190
 */
export function ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE3190)
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0x0d)
  return 0
}

/**
 * Initializes the Arcane Sanctuary portal object (`pInteractArg->pObject (+0x04)`) for
 * quest `11` (`0x0B`, `ACT2Q4`): sets animation mode to `u16 [pQuestDataEx + 0x40]`,
 * stores the object GUID at `u32 [pQuestDataEx + 0x38]`, and if `u16 [pQuestDataEx + 0x40] == 2`
 * calls `D2Common.#10408` (`UNITS_SetTargetUnitForDynamicUnitEx113c`)
 * (`ecx = pInteractArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce32c0
 */
export function ACT2Q4_InitArcanePortalObject_6FCE32C0_113c(
  m: Memory113c,
  pInteractArg: number,
): void {
  hitD2GameVa113c(0x6FCE32C0)
  const pGame = m.u32(pInteractArg >>> 0) >>> 0
  let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (eax === 0) return
  eax = m.u32(eax) >>> 0
  if (eax === 0) return
  while ((m.u32(eax) | 0) !== 0x0b) {
    eax = m.u32((eax + 0xf4) >>> 0) >>> 0
    if (eax === 0) return
  }
  const pObj0 = m.u32((pInteractArg + 0x04) >>> 0) >>> 0
  const esi = m.u32((eax + 0x18) >>> 0) >>> 0
  const wMode = m.u16((esi + 0x40) >>> 0)
  UNITS_ChangeAnimMode113c(m, pObj0, wMode)
  const pObj1 = m.u32((pInteractArg + 0x04) >>> 0) >>> 0
  const dwGuid = pObj1 === 0 ? 0xffffffff : m.u32((pObj1 + 0x0c) >>> 0) >>> 0
  const isOpen = m.u16((esi + 0x40) >>> 0) === 2
  m.setU32((esi + 0x38) >>> 0, dwGuid)
  if (isOpen) {
    const pObj2 = m.u32((pInteractArg + 0x04) >>> 0) >>> 0
    UNITS_SetTargetUnitForDynamicUnitEx113c(m, pObj2)
  }
}

/**
 * Unit-iteration callback for `ACT2Q4`: if neither `(0x0C, 0)` nor `(0x0C, 1)` is set
 * (`!= 1`) on `pUnit`, sets quest state `(0x0C, 0x0E)` and returns `0`
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4`).
 *
 * @va D2Game.dll@0x6fce3510
 */
export function ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE3510)
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 0) !== 1) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0c, 1) !== 1) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0c, 0x0e)
    }
  }
  return 0
}

/**
 * `ACT2Q4` wrapper around `0x6FC540C0` (`QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c`)
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce3620
 */
export function ACT2Q4_Callback10_RemovePlayerGuid_6FCE3620_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE3620)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
}

/**
 * `ACT2Q3` callback: invokes `QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c` and
 * removes `pQuestArg->pPlayer (+0x0C)`'s GUID from `pQuestData->pQuestDataEx + 0x14`
 * via `QUESTS_GuidListRemove113c` (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce3970
 */
export function ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCE3970)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pQuestDataEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const dwGuid = pPlayer === 0 ? 0xffffffff : m.u32((pPlayer + 0x0c) >>> 0) >>> 0
  return QUESTS_GuidListRemove113c(m, (pQuestDataEx + 0x14) >>> 0, dwGuid)
}

/**
 * `ACT2Q2` wrapper around `0x6FC540C0` (`QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c`)
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce3eb0
 */
export function ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE3EB0)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
}

/**
 * Unit-iteration callback for `ACT2Q2`: checks if `pUnit` (`edx`) possesses a Horadric Cube
 * (`'box '` = `0x20786F62`) via `0x6FC2E660`; if not found (`0`), increments
 * `u32 [pQuestDataEx + 0x14]` on quest `9` (`ACT2Q2`) and returns `0`
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4`).
 *
 * @va D2Game.dll@0x6fce3ef0
 */
export function ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE3EF0)
  const pItem = ITEMS_FindQuestItemByBaseCode_6FC2E660_113c(m, pUnit >>> 0, pGame >>> 0, 0x20786f62)
  if (pItem === 0) {
    let eax = m.u32((pGame + 0x10f4) >>> 0) >>> 0
    if (eax !== 0) {
      eax = m.u32(eax) >>> 0
      while (eax !== 0) {
        if ((m.u32(eax) | 0) === 9) {
          const pQuestDataEx = m.u32((eax + 0x18) >>> 0) >>> 0
          m.setU32((pQuestDataEx + 0x14) >>> 0, (m.u32((pQuestDataEx + 0x14) >>> 0) + 1) >>> 0)
          break
        }
        eax = m.u32((eax + 0xf4) >>> 0) >>> 0
      }
    }
  }
  return 0
}

/**
 * Unit-iteration callback for `ACT2Q2`: when both `GetQuestState(0x0A, 0) != 1` and
 * `GetQuestState(0x0A, 3) == 0` for `pUnit` (`edx`), increments `u32 [pQuestDataEx + 0x14]`
 * on quest `9` (`ACT2Q2`) and returns `0`
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4`).
 *
 * @va D2Game.dll@0x6fce3fc0
 */
export function ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE3FC0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) === 1) {
    return 0
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 3) !== 0) {
    return 0
  }
  const pQuestControl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestControl === 0) return 0
  let pQuest = m.u32(pQuestControl) >>> 0
  while (pQuest !== 0) {
    if ((m.u32(pQuest) | 0) === 9) {
      const pQuestDataEx = m.u32((pQuest + 0x18) >>> 0) >>> 0
      m.setU32((pQuestDataEx + 0x14) >>> 0, (m.u32((pQuestDataEx + 0x14) >>> 0) + 1) >>> 0)
      break
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
  return 0
}

/**
 * Checks whether `pPlayer` (`eax`) is eligible for the Viper Amulet quest state in `pGame`
 * (`[esp+4]`): returns `1` if `(GetQuestState(0x0A, 0) == 0 && GetQuestState(0x0A, 0x0F) == 0)`
 * or `GetQuestState(0x0A, 0x0D) != 0` or `GetQuestState(0x0A, 0x0E) != 0`; otherwise returns `0`
 * (`eax = pPlayer`, `[esp+4] = pGame`, `ret 4`).
 *
 * @va D2Game.dll@0x6fce4170
 */
export function ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c(
  m: Memory113c,
  pPlayer: number,
  pGame: number,
): number {
  hitD2GameVa113c(0x6FCE4170)
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) === 0) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x0f) === 0) {
      return 1
    }
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x0d) !== 0) {
    return 1
  }
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x0e) !== 0) {
    return 1
  }
  return 0
}

/**
 * `ACT2Q1` wrapper around `0x6FC540C0` (`QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c`)
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce44d0
 */
export function ACT2Q1_Callback10_RemovePlayerGuid_6FCE44D0_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): void {
  hitD2GameVa113c(0x6FCE44D0)
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
}

/**
 * `ACT2Q0` callback: removes `pQuestArg->pPlayer (+0x0C)`'s GUID from
 * `pQuestData->pQuestDataEx (+0x18)` via `QUESTS_GuidListRemove113c`
 * (`ecx = pQuestData`, `edx = pQuestArg`, plain `ret`).
 *
 * @va D2Game.dll@0x6fce4550
 */
export function ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c(
  m: Memory113c,
  pQuestData: number,
  pQuestArg: number,
): number {
  hitD2GameVa113c(0x6FCE4550)
  const pPlayer = m.u32((pQuestArg + 0x0c) >>> 0) >>> 0
  const pQuestDataEx = m.u32((pQuestData + 0x18) >>> 0) >>> 0
  const dwGuid = pPlayer === 0 ? 0xffffffff : m.u32((pPlayer + 0x0c) >>> 0) >>> 0
  return QUESTS_GuidListRemove113c(m, pQuestDataEx, dwGuid)
}

/**
 * Unit-iteration callback for `ACT2Q6`: when quest states `(0x0E, 0)`, `(0x0E, 3)`, and
 * `(0x0E, 4)` are all not set (`!= 1`) on `pUnit` (`edx`), sets `(0x0E, 0x0E)` and sends
 * alert `0x5D` (`uQuestId = 0x0D`, `uMinAct = 0`)
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4` -> `0`).
 *
 * @va D2Game.dll@0x6fce4bd0
 */
export function ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE4BD0)
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0) !== 1) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 3) !== 1) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) !== 1) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 0x0e)
        QUESTS_SendQuestStateAlert5D_113c(m, pUnit >>> 0, 0x0d, 0)
      }
    }
  }
  return 0
}

/**
 * Unit-iteration callback for `ACT2Q5`: when quest states `(0x0D, 0)` and `(0x0D, 1)`
 * are both not set (`!= 1`) on `pUnit` (`edx`), sets `(0x0D, 0x0E)` and sends alert `0x5D`
 * (`uQuestId = 0x0C`, `uMinAct = 0`)
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4` -> `0`).
 *
 * @va D2Game.dll@0x6fce4d90
 */
export function ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE4D90)
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0) !== 1) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 1) !== 1) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0d, 0x0e)
      QUESTS_SendQuestStateAlert5D_113c(m, pUnit >>> 0, 0x0c, 0)
    }
  }
  return 0
}

/**
 * Unit-iteration callback for `ACT2Q5`: if quest state `(0x0D, 0x0D)` is set on `pUnit`
 * (`edx`) and `pUnit`'s room belongs to level `0x4A` (`74`, Arcane Sanctuary), triggers
 * unit event sound `0x33` on `pUnit` via `SUNIT_SetUnitEventSound113c`
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4` -> `0`).
 *
 * @va D2Game.dll@0x6fce4de0
 */
export function ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE4DE0)
  const u = pUnit >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, u) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0x0d) !== 0) {
    const pRoom = UNITS_GetRoom113c(m, u) >>> 0
    if (pRoom !== 0) {
      const nLevelId = DUNGEON_GetLevelIdFromRoom113c(m, pRoom) | 0
      if (nLevelId === 0x4a) {
        SUNIT_SetUnitEventSound113c(m, u, 0x33, u)
      }
    }
  }
  return 0
}

/**
 * Unit-iteration callback for `ACT2Q3`: when quest states `(0x0B, 0)` and `(0x0B, 1)`
 * are both not set (`!= 1`) on `pUnit` (`edx`), sets `(0x0B, 0x0E)` and sends alert `0x5D`
 * (`uQuestId = 0x0A`, `uMinAct = 0`)
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4` -> `0`).
 *
 * @va D2Game.dll@0x6fce5260
 */
export function ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE5260)
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 0) !== 1) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0b, 1) !== 1) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0b, 0x0e)
      QUESTS_SendQuestStateAlert5D_113c(m, pUnit >>> 0, 0x0a, 0)
    }
  }
  return 0
}

/**
 * Unit-iteration callback for `ACT2Q1`: when quest states `(9, 0)` and `(9, 1)`
 * are both not set (`!= 1`) on `pUnit` (`edx`), sets `(9, 0x0E)` and sends alert `0x5D`
 * (`uQuestId = 8`, `uMinAct = 0`)
 * (`ecx = pGame`, `edx = pUnit`, `[esp+4] = pArg`, `ret 4` -> `0`).
 *
 * @va D2Game.dll@0x6fce5560
 */
export function ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  _pArg?: number,
): number {
  hitD2GameVa113c(0x6FCE5560)
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit >>> 0) >>> 0
  const nDiff = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + (nDiff << 2) + 0x10) >>> 0) >>> 0
  if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 0) !== 1) {
    if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 9, 1) !== 1) {
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 9, 0x0e)
      QUESTS_SendQuestStateAlert5D_113c(m, pUnit >>> 0, 8, 0)
    }
  }
  return 0
}

/**
 * Decrements `pMonReg->dwActiveMonsterCount (+0x2D0)` for `pUnit`'s spawn act
 * (`pMonsterData->nSpawnAct (+0x58)`, or `0` if non-monster/null) when `pUnit` does not
 * have `MONTYPEFLAG_OTHER` (`u8 [pMonsterData + 0x5C] & 2`) and `UNIT_GetAlignment(pUnit) == 0`
 * (`eax = pUnit`, `[esp+4] = ppMonsterRegion`, `ret 4`).
 *
 * @va D2Game.dll@0x6fcea490
 */
export function MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c(
  m: Memory113c,
  pUnit: number,
  ppMonsterRegion: number,
): void {
  hitD2GameVa113c(0x6FCEA490)
  const u = pUnit >>> 0
  let nAct = 0
  if (u !== 0) {
    const dwType = m.u32(u) | 0
    if (dwType === 1) {
      const pMonsterData = m.u32((u + 0x14) >>> 0) >>> 0
      if (pMonsterData !== 0 && (m.u8((pMonsterData + 0x5c) >>> 0) & 2) !== 0) {
        return
      }
      if (pMonsterData !== 0) {
        nAct = m.u32((pMonsterData + 0x58) >>> 0) | 0
      }
    }
  }
  const pMonReg = m.u32((ppMonsterRegion + (nAct << 2)) >>> 0) >>> 0
  if (UNIT_GetAlignment113c(m, u) === 0) {
    m.setU32((pMonReg + 0x2d0) >>> 0, (m.u32((pMonReg + 0x2d0) >>> 0) - 1) >>> 0)
  }
}

/**
 * Clears gfx state flag `nState` (`edx`) on `pUnit` (`ecx`) via `D2Common.#10945`
 * (`STATES_ToggleGfxStateFlag(pUnit, nState, 0)`) (`ecx = pUnit`, `edx = nState`,
 * `[esp+4] = bUnused`, `ret 4`).
 *
 * @va D2Game.dll@0x6fceb1a0
 */
export function STATES_ClearGfxStateFlag_6FCEB1A0_113c(
  m: Memory113c,
  pUnit: number,
  nState: number,
  _bUnused?: number,
): void {
  hitD2GameVa113c(0x6FCEB1A0)
  STATES_ToggleGfxStateFlag113c(m, pUnit >>> 0, nState | 0, 0)
}

/**
 * C2S packet `0x54` handler: validates `nPacketLen == 1` (else returns `3`); if `pPlayer`
 * (`edx`) is a `UNIT_PLAYER (0)` in `PLRMODE_RUN (3)`, switches `pPlayer` to `PLRMODE_WALK (2)`
 * via `D2Common.#11090` and returns `0` (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = pPacket`,
 * `[esp+8] = nPacketLen`, `ret 8`).
 *
 * @va D2Game.dll@0x6fceb420
 */
export function PACKET_Srv54_TurnOffRunToWalk_6FCEB420_113c(
  m: Memory113c,
  _pGame: number,
  pPlayer: number,
  _pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEB420)
  if ((nPacketLen | 0) !== 1) return 3
  const u = pPlayer >>> 0
  if (u !== 0 && (m.u32(u) | 0) === 0 && (m.u32((u + 0x10) >>> 0) | 0) === 3) {
    UNITS_ChangeAnimMode113c(m, u, 2)
  }
  return 0
}

/**
 * C2S packet `0x53` handler: validates `nPacketLen == 1` (else returns `3`); if `pPlayer`
 * (`edx`) is a `UNIT_PLAYER (0)` in `PLRMODE_WALK (2)` with non-zero `STAT_STAMINA (10)`,
 * switches `pPlayer` to `PLRMODE_RUN (3)` via `D2Common.#11090` and returns `0`
 * (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = pPacket`, `[esp+8] = nPacketLen`, `ret 8`).
 *
 * @va D2Game.dll@0x6fceb450
 */
export function PACKET_Srv53_TurnOnWalkToRun_6FCEB450_113c(
  m: Memory113c,
  _pGame: number,
  pPlayer: number,
  _pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEB450)
  if ((nPacketLen | 0) !== 1) return 3
  const u = pPlayer >>> 0
  if (u !== 0 && (m.u32(u) | 0) === 0 && (m.u32((u + 0x10) >>> 0) | 0) === 2) {
    if (STATLIST_GetUnitStat113c(m, u, 0x0a, 0) !== 0) {
      UNITS_ChangeAnimMode113c(m, u, 3)
    }
  }
  return 0
}

/**
 * C2S packet `0x48` handler: validates `nPacketLen == 1` (else returns `3`), checks
 * `UNITS_GetPlayerData(pPlayer)->pPlayerIntro (+0x4C)` (returning `2` if `0`), re-reads
 * `UNITS_GetPlayerData(pPlayer)->pPlayerIntro (+0x4C)` (asserting line `0x1C6` if `0`),
 * clears `u32 [pPlayerData + 0x4C] = 0`, and returns `0`
 * (`ecx = pGame`, `edx = pPlayer`, `[esp+4] = pPacket`, `[esp+8] = nPacketLen`, `ret 8`).
 *
 * @va D2Game.dll@0x6fceb4e0
 */
export function PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c(
  m: Memory113c,
  _pGame: number,
  pPlayer: number,
  _pPacket: number,
  nPacketLen: number,
): number {
  hitD2GameVa113c(0x6FCEB4E0)
  if ((nPacketLen | 0) !== 1) return 3
  const u = pPlayer >>> 0
  const pPlayerData0 = UNITS_GetPlayerData113c(m, u) >>> 0
  if (m.u32((pPlayerData0 + 0x4c) >>> 0) === 0) {
    return 2
  }
  const pPlayerData1 = UNITS_GetPlayerData113c(m, u) >>> 0
  if (m.u32((pPlayerData1 + 0x4c) >>> 0) === 0) {
    throw new D2CommonAssertError('', 0x1c6)
  }
  m.setU32((pPlayerData1 + 0x4c) >>> 0, 0)
  return 0
}
