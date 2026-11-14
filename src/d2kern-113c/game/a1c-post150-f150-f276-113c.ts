/**
 * Pure 1:1 `D2Game.dll` v1.13c post-F150 coverage gap closure (Part 1: 52 VAs in `F150..F276`).
 *
 * Covers:
 * - `F150` (33 VAs): Quest GUID list removal, quest callback dispatch, level-change notification,
 *   Acts 1–4 level-transition quest callbacks (type 3), town player-count & vendor/mercenary slot sync.
 * - `F224` (2 VAs): Room living-unit counter callback and game-clamped room unit counter.
 * - `F251` (3 VAs): Player pet list cleanup, player pet client sync, and party pet client sync.
 * - `F276` (14 VAs): Inactive monster/unit node serialization & archival, AI command circular list
 *   and `D2AiGeneralStrc` teardown, object region & unit teardown, unit quest chain & interact teardown,
 *   monster unit teardown, unit inventory clear, server unit deactivation, and room update-list unlink.
 *
 * Every `@va`-annotated export is an instruction-faithful translation of its
 * corresponding `D2Game.dll` v1.13c routine operating on `Memory113c`.
 */

import {
  UNITS_GetField7C_113c,
  UNITS_GetPlayerData113c,
  UNITS_HasObjectSubClassBit0113c,
} from '../common/composit.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import {
  DRLGPRESET_FreeSaveHeaderBlock113c,
  DRLGPRESET_MovePointerAndClear113c,
} from '../common/drlg/preset.ts'
import {
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetRoomCoordinates113c,
} from '../common/dungeon.ts'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_FreeInventory113c,
  INVENTORY_GetCursorItem113c,
  INVENTORY_GetFirstItem113c,
  INVENTORY_GetItemBodyLocFromX113c,
  INVENTORY_GetItemNodePositionOther113c,
  INVENTORY_GetNextItem113c,
  INVENTORY_NoOpRet20113c,
  INVENTORY_NoOpRet8B113c,
  INVENTORY_RemoveItemFromInventory113c,
  INVENTORY_UnitIsItem113c,
  UNITS_GetInventoryRecordId113c,
} from '../common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CanUseCharmInInventory113c,
  ITEMS_GetInvPage113c,
} from '../common/items.ts'
import { STATLIST_GetStatListFromUnitAndStateMemPort113c } from '../common/k0-d2common-memports.ts'
import {
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetTargetTypeAndPosition113c,
  PATH_RemoveUnitCollisionIfHasPath113c,
} from '../common/path.ts'
import { QUESTRECORD_SetQuestState113c } from '../common/quest-record.ts'
import {
  DRLGLOGIC_GetBossTombLevel113c,
  STATES_CheckState113c,
  STATLIST_FreeStatListIfNonExtended113c,
  STATLIST_GetMaxLifeFromUnit113c,
  STATLIST_GetUnitStat113c,
  STATLIST_UnlinkSubList113c,
} from '../common/statlist.ts'
import { CHAT_FreeHoverMsg113c } from '../common/text.ts'
import {
  DATATBLS_GetObjectsTxtRecord113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_GetRoom113c,
  UNIT_GetAlignment113c,
} from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { SUNITDMG_FreeAttackerCombatList113c } from './ai-fallen-113c.ts'
import { AIGENERAL_CopyAiCommandParams113c } from './replay-kernel-113c.ts'
import { SUNIT_RemoveServerUnit113c } from './game-strc.ts'
import { UNITS_ChangeAnimMode113c } from './monster-events.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  UNIT_GetPosX113c,
  UNIT_GetPosY113c,
} from './regpop-spawn-113c.ts'
import {
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_RemoveUnitEvents113c,
} from './timer-wheel.ts'

/** `D2Game.dll` image base (`0x6FC20000`) used to compute internal callback VAs without raw literals. */
const D2GAME_IMAGE_BASE_113C = 0x6fc20000

/** `D2Game.dll` `.data` `0x6FD31C1C`: maximum room unit count clamp (`gdwMaxRoomUnitCount`). */
export const D2GAME_MAX_ROOM_UNIT_COUNT_VA_113C = (D2GAME_IMAGE_BASE_113C + 0x111c1c) >>> 0

/** Reentrant scratch stack pointer for out-params and temporary structs. */
let laneI1StackPtr = 0x7ff60000

function allocStackFrame(m: Memory113c, size: number): number {
  const ptr = laneI1StackPtr >>> 0
  laneI1StackPtr = (laneI1StackPtr + ((size + 15) & ~15)) >>> 0
  for (let i = 0; i < size; i += 4) {
    m.setU32((ptr + i) >>> 0, 0)
  }
  return ptr
}

function freeStackFrame(savedPtr: number): void {
  laneI1StackPtr = savedPtr >>> 0
}

function freeMemBlock(_m: Memory113c, _ptr: number): void {
  // Fog.#10025 / Fog.#10043 pool release is a no-op on linear SparseMemory113c.
}

function getSgptDataTablesPtr(m: Memory113c): number {
  const iatSlot = m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0
  if (iatSlot === 0) return 0
  const deref = m.u32(iatSlot) >>> 0
  return deref !== 0 ? deref : iatSlot
}

function getBitMaskByte(m: Memory113c, dwordsOffset: number, fallbackBit: number): number {
  const addr = (D2GAME_IAT_GDW_BITMASKS_VA_113C + dwordsOffset) >>> 0
  const b = m.u8(addr)
  return b !== 0 ? b : fallbackBit
}

/**
 * Optional hooks for external `D2Game.dll` helpers invoked by the 52 routines in `F150..F276`.
 */
export interface Post150LaneI1Hooks113c {
  onQuestCallback?: (m: Memory113c, callbackVa: number, pQuest: number, pArg: number) => void
  onQuestStatusCyclerEx?: (m: Memory113c, pQuest: number, bForce: number, bState: number) => void
  onQuestSetMainState?: (m: Memory113c, pQuest: number, nState: number) => void
  onIterateUnitsOfType?: (
    m: Memory113c,
    pGame: number,
    nUnitType: number,
    pArg: number,
    callbackVa: number,
  ) => number
  onForEachPlayerUnit?: (
    m: Memory113c,
    pGame: number,
    pArg: number,
    callbackVa: number,
  ) => void
  onQuestHelperCall?: (
    m: Memory113c,
    helperRva: number,
    pQuest: number,
    pArg: number,
    extra?: number,
  ) => number
  onSendPetPacketToClient?: (
    m: Memory113c,
    pClient: number,
    nPetType: number,
    dwPetGuid: number,
    nClassId: number,
    dwOwnerGuid: number,
    wHydraFlags: number,
  ) => void
  onRemovePlayerPet?: (
    m: Memory113c,
    pGame: number,
    pPlayer: number,
    pPetUnit: number,
    nPetType: number,
    dwPetGuid: number,
  ) => void
  onSaveInactiveItemNode?: (m: Memory113c, pUnit: number, ppOutNode: number) => number
  onDeleteServerUnit?: (m: Memory113c, pGame: number, pUnit: number) => void
  onDeactivateUnitInteractions?: (m: Memory113c, pUnit: number, pGame: number) => void
  onNotifyCharmUnequip?: (m: Memory113c, pGame: number, pUnit: number, pItem: number) => void
  onSeedRollLimited?: (m: Memory113c, pSeed: number, nMax: number) => number
  onFreeNpcInventoryNode?: (m: Memory113c, pGame: number, pNpcRecord: number) => void
  onReinitNpcRecord?: (
    m: Memory113c,
    pGame: number,
    pNpcRecord: number,
    pUnit: number,
  ) => void
  onActPlayerCountChanged?: (m: Memory113c, pGame: number, nAct: number, bEntered: number) => void
  onAct2TownEntered?: (m: Memory113c, pGame: number, pUnit: number) => void
}

function readGameQuestState(m: Memory113c, pGame: number, nQuestId: number, nState: number): number {
  if (pGame === 0) return 0
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return 0
  const pQuestBits = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
  if (pQuestBits === 0) return 0
  return DRLGWARP_TestRoomTileBit113c(m, pQuestBits, nQuestId, nState)
}

function writeGameQuestState(m: Memory113c, pGame: number, nQuestId: number, nState: number): void {
  if (pGame === 0) return
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  const pQuestBits = m.u32((pQuestCtrl + 0x0c) >>> 0) >>> 0
  if (pQuestBits === 0) return
  QUESTRECORD_SetQuestState113c(m, pQuestBits, nQuestId, nState)
}

function setQuestMainStateDefault(
  m: Memory113c,
  pQuest: number,
  nState: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  m.setU8((pQuest + 0x0c) >>> 0, nState & 0xff)
  if (hooks?.onQuestSetMainState !== undefined) {
    hooks.onQuestSetMainState(m, pQuest, nState & 0xff)
  }
}

function statusCyclerExDefault(
  m: Memory113c,
  pQuest: number,
  bForce: number,
  bState: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (hooks?.onQuestStatusCyclerEx !== undefined) {
    hooks.onQuestStatusCyclerEx(m, pQuest, bForce, bState & 0xff)
    return
  }
  m.setU8((pQuest + 0x0c) >>> 0, bState & 0xff)
}

function iterateUnitsOfTypeDefault(
  m: Memory113c,
  pGame: number,
  nUnitType: number,
  pArg: number,
  callbackRva: number,
  hooks?: Post150LaneI1Hooks113c,
): number {
  const callbackVa = (D2GAME_IMAGE_BASE_113C + callbackRva) >>> 0
  if (hooks?.onIterateUnitsOfType !== undefined) {
    return hooks.onIterateUnitsOfType(m, pGame, nUnitType, pArg, callbackVa) | 0
  }
  if (pGame === 0) return 0
  let tableBase = 0
  if (nUnitType === 0) {
    tableBase = (pGame + 0x1120) >>> 0
  } else if (nUnitType === 1) {
    tableBase = (pGame + 0x1320) >>> 0
  } else {
    return 0
  }
  for (let i = 0; i < 128; i++) {
    let pUnit = m.u32((tableBase + i * 4) >>> 0) >>> 0
    while (pUnit !== 0) {
      if (STATES_CheckState113c(m, pUnit, 7) === 0) {
        if (hooks?.onQuestHelperCall !== undefined) {
          const res = hooks.onQuestHelperCall(m, callbackRva, pGame, pUnit, pArg)
          if (res === 1) return pUnit | 0
        }
      }
      pUnit = m.u32((pUnit + 0xe4) >>> 0) >>> 0
    }
  }
  return 0
}

function forEachPlayerInGameDefault(
  m: Memory113c,
  pGame: number,
  pArg: number,
  callbackRva: number,
  directFn?: (m: Memory113c, pGame: number, pUnit: number, pArg: number) => void,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const callbackVa = (D2GAME_IMAGE_BASE_113C + callbackRva) >>> 0
  if (hooks?.onForEachPlayerUnit !== undefined && directFn === undefined) {
    hooks.onForEachPlayerUnit(m, pGame, pArg, callbackVa)
    return
  }
  if (pGame === 0) return
  const tableBase = (pGame + 0x1120) >>> 0
  for (let i = 0; i < 128; i++) {
    let pUnit = m.u32((tableBase + i * 4) >>> 0) >>> 0
    while (pUnit !== 0) {
      if (STATES_CheckState113c(m, pUnit, 7) === 0) {
        if (directFn !== undefined) {
          directFn(m, pGame, pUnit, pArg)
        }
      }
      pUnit = m.u32((pUnit + 0xe4) >>> 0) >>> 0
    }
  }
}

function hasActiveNpcInteract(m: Memory113c, pInteract: number): number {
  if (pInteract === 0) return 0
  let pNode = m.u32(pInteract >>> 0) >>> 0
  while (pNode !== 0) {
    if (m.u32(pNode >>> 0) !== 0) return 1
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return 0
}

function countActiveNpcInteracts(m: Memory113c, pInteract: number): number {
  if (pInteract === 0) return 0
  let pNode = m.u32(pInteract >>> 0) >>> 0
  let count = 0
  while (pNode !== 0) {
    if (m.u32(pNode >>> 0) !== 0) count = (count + 1) | 0
    pNode = m.u32((pNode + 0x08) >>> 0) >>> 0
  }
  return count
}

function clearMonsterInteractList(m: Memory113c, pGame: number, pUnit: number): void {
  if (pUnit === 0) return
  if (m.u32(pUnit >>> 0) !== 1) return
  const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return
  const pInteract = m.u32((pMonsterData + 0x30) >>> 0) >>> 0
  if (pInteract === 0) return
  let pNode = m.u32(pInteract >>> 0) >>> 0
  while (pNode !== 0) {
    const pPlayer = m.u32(pNode >>> 0) >>> 0
    const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
    if (pPlayer !== 0) {
      m.setU32((pPlayer + 0x64) >>> 0, 0xffffffff)
      m.setU32((pPlayer + 0x68) >>> 0, 6)
      m.setU8((pPlayer + 0x6c) >>> 0, 0)
    }
    if (pGame !== 0) {
      freeMemBlock(m, pNode)
    }
    pNode = pNext
  }
  m.setU32(pInteract >>> 0, 0)
}

function findOrCreateInactiveRoomNode(
  m: Memory113c,
  pGame: number,
  actNo: number,
  roomX: number,
  roomY: number,
  bAlloc: number,
): number {
  const headOffset = (pGame + (actNo & 0xff) * 4 + 0xd8) >>> 0
  let pCurr = m.u32(headOffset) >>> 0
  let pPrev = 0
  let found = 0
  while (pCurr !== 0) {
    const currX = (m.u32(pCurr >>> 0) | 0)
    if (roomX === currX && roomY === (m.u32((pCurr + 0x04) | 0) >>> 0)) {
      found = 1
      break
    }
    if (roomX > currX) {
      break
    }
    pPrev = pCurr
    pCurr = m.u32((pCurr + 0x14) >>> 0) >>> 0
  }
  if (bAlloc === 0) {
    return found !== 0 ? pCurr : 0
  }
  if (found !== 0) {
    return pCurr
  }
  const pNew = m.alloc(0x18) >>> 0
  for (let i = 0; i < 0x18; i += 4) {
    m.setU32((pNew + i) >>> 0, 0)
  }
  m.setU32(pNew >>> 0, (roomX) >>> 0)
  m.setU32((pNew + 0x04) >>> 0, (roomY) >>> 0)
  m.setU32((pNew + 0x14) >>> 0, pCurr)
  if (pPrev !== 0) {
    m.setU32((pPrev + 0x14) >>> 0, pNew)
  } else {
    m.setU32(headOffset, pNew)
  }
  return pNew
}

// ============================================================================
// F150 (33 VAs)
// ============================================================================

/**
 * Removes `dwGuid` (`eax`) from a `D2QuestGuidListStrc` (`ecx = pList`, `u16` count at `+0x80`,
 * `u32[32]` GUID array at `+0x00..+0x7C`). Swaps the last element into the removed slot if not
 * already last, decrements `word [pList + 0x80]`, and returns `1` (`0` if not found).
 *
 * @va D2Game:0x6FC53830 (68B)
 */
export function QUESTS_GuidListRemove113c(
  m: Memory113c,
  pList: number,
  dwGuid: number,
): number {
  const count = m.u16((pList + 0x80) >>> 0)
  if (count === 0) {
    return 0
  }
  const targetGuid = dwGuid >>> 0
  for (let i = 0; i < count; i++) {
    if (m.u32((pList + i * 4) >>> 0) >>> 0 === targetGuid) {
      const lastIdx = (count - 1) >>> 0
      if (i !== lastIdx) {
        const lastGuid = m.u32((pList + lastIdx * 4) >>> 0) >>> 0
        m.setU32((pList + i * 4) >>> 0, lastGuid)
      }
      m.setU16((pList + 0x80) >>> 0, lastIdx & 0xffff)
      return 1
    }
  }
  return 0
}

/**
 * Iterates the game's quest chain (`[pGame + 0x10F4] -> [pQuestCtrl + 0x00]`, next at `+0xF4`)
 * and invokes each quest's callback at `[pQuest + cbIdx*4 + 0xA0]` (`cbIdx = [pArg + 0x04]`)
 * when `(bCheckActive != 0 || byte [pQuest + 0x0A] == 1)` and `(actNo == 0xFF || actNo == byte [pQuest + 0x08])`.
 *
 * @va D2Game:0x6FC53CE0 (172B)
 */
export function QUESTS_TriggerCallback113c(
  m: Memory113c,
  pArg: number,
  bCheckActive: number,
  bFilterAct: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const pGame = m.u32(pArg >>> 0) >>> 0
  if (pGame === 0) return
  const pQuestCtrl = m.u32((pGame + 0x10f4) >>> 0) >>> 0
  if (pQuestCtrl === 0) return
  let pQuest = m.u32(pQuestCtrl >>> 0) >>> 0
  let actNo = 0xff
  if (bFilterAct === 1) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const pRoom = UNITS_GetRoom113c(m, pUnit)
    const nLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
    actNo = DRLG_GetActNoFromLevelId113c(m, nLevel) & 0xff
  }
  while (pQuest !== 0) {
    const cbIdx = m.u32((pArg + 0x04) >>> 0) >>> 0
    const pfnCallback = m.u32((pQuest + cbIdx * 4 + 0xa0) >>> 0) >>> 0
    if (pfnCallback !== 0) {
      if (bCheckActive !== 0 || m.u8((pQuest + 0x0a) >>> 0) === 1) {
        if (actNo === 0xff || actNo === m.u8((pQuest + 0x08) >>> 0)) {
          dispatchQuestCallbackByVa(m, pfnCallback, pQuest, pArg, hooks)
        }
      }
    }
    pQuest = m.u32((pQuest + 0xf4) >>> 0) >>> 0
  }
}

function dispatchQuestCallbackByVa(
  m: Memory113c,
  pfnCallback: number,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const rva = (pfnCallback - D2GAME_IMAGE_BASE_113C) >>> 0
  switch (rva) {
    case 0x5a9b0:
      ACT4Q1_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x5ab60:
      ACT4Q2_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x5ad50:
      ACT4Q3_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x5b1e0:
      ACT4Q1_Callback03_AltLevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x5b380:
      ACT4Q2_Callback03_AltLevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x5f3f0:
      ACT4Q2_Hellforge_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x63dd0:
      ACT1Q1_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x642d0:
      ACT1Q2_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x64d30:
      ACT1Q4_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x64ed0:
      ACT1Q5_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x65040:
      ACT1Q6_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0x684b0:
      ACT1Q3_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xba1e0:
      ACT3Q1_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xba3a0:
      ACT3Q2_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xba550:
      ACT3Q3_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xc2e20:
      ACT2Q1_Callback03_LevelChanged113c(m, pQuest, pArg)
      return
    case 0xc3ec0:
      ACT2Q2_Callback03_LevelChanged113c(m, pQuest, pArg)
      return
    case 0xc6450:
      ACT2Q3_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xc6e00:
      ACT2Q4_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xc73a0:
      ACT2Q5_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xc9190:
      ACT2Q6_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xe3e00:
      ACT3Q0_Callback03_LevelChanged113c(m, pQuest, pArg)
      return
    case 0xe71d0:
      ACT3Q4_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xe7560:
      ACT3Q5_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xe7880:
      ACT3Q6_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xe7a10:
      ACT3Q7_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    case 0xe7be0:
      ACT3Q8_Callback03_LevelChanged113c(m, pQuest, pArg, hooks)
      return
    default:
      if (hooks?.onQuestCallback !== undefined) {
        hooks.onQuestCallback(m, pfnCallback, pQuest, pArg)
      }
      return
  }
}

/**
 * Builds a `0x1C`-byte `D2QuestArgStrc` on the stack with `nCallbackType = 3` (level change)
 * and invokes `QUESTS_TriggerCallback113c(pArg, 1, 0)`.
 *
 * @va D2Game:0x6FC54860 (52B)
 */
export function QUESTS_NotifyLevelChange113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  nFromLevel: number,
  nToLevel: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const savedStack = laneI1StackPtr
  const pArg = allocStackFrame(m, 0x1c)
  m.setU32(pArg >>> 0, pGame >>> 0)
  m.setU32((pArg + 0x04) >>> 0, 3)
  m.setU32((pArg + 0x08) >>> 0, 0)
  m.setU32((pArg + 0x0c) >>> 0, pUnit >>> 0)
  m.setU32((pArg + 0x10) >>> 0, 0)
  m.setU32((pArg + 0x14) >>> 0, nFromLevel >>> 0)
  m.setU32((pArg + 0x18) >>> 0, nToLevel >>> 0)
  QUESTS_TriggerCallback113c(m, pArg, 1, 0, hooks)
  freeStackFrame(savedStack)
}

/**
 * Act 4 Quest 1 (Fallen Angel / Izual) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FC7A9B0 (327B)
 */
export function ACT4Q1_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x6d) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u32((pGame + 0x68) >>> 0) >>> 0
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x19, 1) !== 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x01) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 2)
      }
    }
  }
  const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x02) >>> 0) === 1 && m.u32((pQuest + 0x14) >>> 0) === 2) {
    const nToLevel = m.u32((pArg + 0x18) >>> 0)
    if (nToLevel === 0x6e || nToLevel === 0x6f || nToLevel === 0x70) {
      const pGame = m.u32(pArg >>> 0) >>> 0
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      m.setU32((pQuestData + 0x20) >>> 0, 0)
      iterateUnitsOfTypeDefault(m, pGame, 0, pUnit, 0x58d40, hooks)
      if (m.u32((pQuestData + 0x20) >>> 0) === 0) {
        m.setU32((pQuestData + 0x1c) >>> 0, 0)
        const pRoom = UNITS_GetRoom113c(m, m.u32((pArg + 0x0c) >>> 0) >>> 0)
        m.setU32((pQuestData + 0x0c) >>> 0, pRoom >>> 0)
        if (hooks?.onQuestHelperCall !== undefined) {
          hooks.onQuestHelperCall(m, 0x59120, pQuest, pArg)
        }
        if (m.u32((pQuestData + 0x1c) >>> 0) !== 0) {
          m.setU8((pQuestData + 0x03) >>> 0, 0)
          m.setU8((pQuestData + 0x02) >>> 0, 0)
          iterateUnitsOfTypeDefault(
            m,
            m.u32(pArg >>> 0) >>> 0,
            0,
            m.u32((pArg + 0x0c) >>> 0) >>> 0,
            0x58d40,
            hooks,
          )
          if (m.u32((pQuestData + 0x20) >>> 0) !== 0) {
            m.setU32((pQuest + 0x14) >>> 0, 3)
            setQuestMainStateDefault(m, pQuest, m.u8((pQuest + 0x0c) >>> 0), hooks)
          }
          return
        }
        m.setU8((pQuestData + 0x03) >>> 0, 1)
      }
    }
  }
}

/**
 * Act 4 Quest 2 (Terror's End / Diablo) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FC7AB60 (491B)
 */
export function ACT4Q2_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const nFromLevel = m.u32((pArg + 0x14) >>> 0)
  if (nFromLevel === 0x6d) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x20) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel === 0x6c) {
    if (m.u8((pQuest + 0x0a) >>> 0) === 1 && m.u32((pQuest + 0x14) >>> 0) === 1) {
      m.setU32((pQuest + 0x14) >>> 0, 2)
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      statusCyclerExDefault(m, pQuest, bState === 0 || bState > 3 ? 1 : 0, bState, hooks)
    }
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x0d) >>> 0) === 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
      const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
      const diffIdx = m.u8((pGame + 0x6d) >>> 0)
      const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0) !== 1 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0c) !== 1 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1a, 0x0d) !== 1 &&
        hooks?.onQuestHelperCall !== undefined
      ) {
        hooks.onQuestHelperCall(m, 0xaf430, pQuest, pArg)
      }
    }
  } else if (nToLevel === 0x6d) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x1d) >>> 0) !== 0) {
      const pPortal = m.u32((pQuestData + 0x90) >>> 0) >>> 0
      if (pPortal !== 0) {
        if (m.u32((pPortal + 0x10) >>> 0) === 1) {
          UNITS_ChangeAnimMode113c(m, pPortal, 2)
        }
        m.setU8((pQuestData + 0x1d) >>> 0, 0)
      }
    }
  }
  if (nFromLevel === 0x6c) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x1e) >>> 0) === 0 && m.u32((pQuestData + 0x90) >>> 0) !== 0) {
      m.setU32((pQuestData + 0x5c) >>> 0, 0)
      iterateUnitsOfTypeDefault(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        0,
        (pQuestData + 0x5c) >>> 0,
        0x58f90,
        hooks,
      )
      if (m.u32((pQuestData + 0x5c) >>> 0) === 0 && hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0x57750, pQuest, pArg)
      }
    }
  }
}

/**
 * Act 4 Quest 3 ( Chaos Sanctuary / Fortress portal ) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FC7AD50 (199B)
 */
export function ACT4Q3_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x6d) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x05) >>> 0) === 0 && m.u32((pQuestData + 0x10) >>> 0) !== 0) {
      m.setU32((pQuestData + 0x08) >>> 0, 0)
      iterateUnitsOfTypeDefault(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        0,
        (pQuestData + 0x08) >>> 0,
        0x590c0,
        hooks,
      )
      if (m.u32((pQuestData + 0x08) >>> 0) === 0 && hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0x57c00, pQuest, pArg)
      }
    }
  }
  if (m.u32((pArg + 0x18) >>> 0) === 0x6d) {
    m.setU32((pQuest + 0xa8) >>> 0, 0)
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x00) >>> 0) === 1 && m.u8((pQuestData + 0x01) >>> 0) === 0) {
      const pGame = m.u32(pArg >>> 0) >>> 0
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      m.setU8((pQuestData + 0x01) >>> 0, 1)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0xcbe70, pGame, pUnit, 0x1b)
      }
    }
  }
}

/**
 * Act 4 Quest 1 alternate level-change callback (`cbIdx = 3`, levels `0x69`, `0x6A`).
 *
 * @va D2Game:0x6FC7B1E0 (405B)
 */
export function ACT4Q1_Callback03_AltLevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x67) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x04) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel === 0x69) {
    if (m.u8((pQuest + 0x0a) >>> 0) === 1) {
      if (m.u32((pQuest + 0x14) >>> 0) === 1) {
        m.setU32((pQuest + 0x14) >>> 0, 2)
        statusCyclerExDefault(
          m,
          pQuest,
          m.u8((pQuest + 0x0c) >>> 0) !== 1 ? 1 : 0,
          m.u8((pQuest + 0x0c) >>> 0),
          hooks,
        )
      } else {
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        if (bState === 0 || bState > 3) {
          setQuestMainStateDefault(m, pQuest, bState, hooks)
        }
      }
    }
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x01) >>> 0) === 1) {
      m.setU32((pQuest + 0xb0) >>> 0, (D2GAME_IMAGE_BASE_113C + 0x58530) >>> 0)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0x593f0, pQuest, pArg)
      }
    }
  } else if (nToLevel === 0x6a && m.u8((pQuest + 0x0a) >>> 0) === 1) {
    if (m.u32((pQuest + 0x14) >>> 0) <= 2) {
      m.setU32((pQuest + 0x14) >>> 0, 3)
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      statusCyclerExDefault(
        m,
        pQuest,
        bState !== 1 && bState !== 2 ? 1 : 0,
        bState,
        hooks,
      )
      return
    }
    const bState = m.u8((pQuest + 0x0c) >>> 0)
    if (bState === 0 || bState > 3) {
      setQuestMainStateDefault(m, pQuest, bState, hooks)
    }
  }
}

/**
 * Act 4 Quest 2 alternate level-change callback (`cbIdx = 3`, levels `0x68..0x6B`).
 *
 * @va D2Game:0x6FC7B380 (266B)
 */
export function ACT4Q2_Callback03_AltLevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x67) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x18, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x18, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x01) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if ((nToLevel >= 0x68 && nToLevel <= 0x6b) && m.u8((pQuest + 0x0a) >>> 0) === 1) {
    if (m.u32((pQuest + 0x14) >>> 0) === 1) {
      m.setU32((pQuest + 0x14) >>> 0, 2)
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      statusCyclerExDefault(m, pQuest, bState === 0 || bState > 3 ? 1 : 0, bState, hooks)
      return
    }
    const bState = m.u8((pQuest + 0x0c) >>> 0)
    if (bState === 0 || bState > 3) {
      setQuestMainStateDefault(m, pQuest, bState, hooks)
    }
  }
}

/**
 * Act 4 Hellforge level-change callback (`cbIdx = 3`, levels `0x67`, `0x6B`).
 *
 * @va D2Game:0x6FC7F3F0 (484B)
 */
export function ACT4Q2_Hellforge_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x67) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x17, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x17, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x04) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  if (m.u32((pArg + 0x18) >>> 0) === 0x6b) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x01) >>> 0) !== 1) {
      m.setU32((pQuestData + 0x0c) >>> 0, 0)
      iterateUnitsOfTypeDefault(
        m,
        m.u32((pQuest + 0x04) >>> 0) >>> 0,
        0,
        pQuest,
        0x59120,
        hooks,
      )
      if (m.u32((pQuestData + 0x0c) >>> 0) === 0) {
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        if (bState === 1 || bState === 2) {
          m.setU8((pQuest + 0x0c) >>> 0, 0)
        }
        m.setU32((pQuest + 0xb0) >>> 0, (D2GAME_IMAGE_BASE_113C + 0x5f610) >>> 0)
      }
      if (m.u8((pQuest + 0x0a) >>> 0) !== 1) return
      const stateVal = m.u32((pQuest + 0x14) >>> 0)
      if (stateVal !== 1 && stateVal !== 2) {
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        if (bState === 0 || bState > 5) {
          setQuestMainStateDefault(m, pQuest, bState, hooks)
        }
        return
      }
      m.setU32((pQuest + 0x14) >>> 0, 3)
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      statusCyclerExDefault(
        m,
        pQuest,
        bState !== 1 && bState !== 2 ? 1 : 0,
        bState,
        hooks,
      )
      return
    }
    m.setU32((pQuest + 0xb0) >>> 0, (D2GAME_IMAGE_BASE_113C + 0x58110) >>> 0)
    if (hooks?.onQuestHelperCall !== undefined) {
      hooks.onQuestHelperCall(m, 0x591d0, pQuest, pArg)
    }
    if (m.u8((pQuest + 0x0a) >>> 0) === 1) {
      const stateVal = m.u32((pQuest + 0x14) >>> 0)
      if (stateVal !== 1 && stateVal !== 2) {
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        if (bState === 0 || bState > 5) {
          setQuestMainStateDefault(m, pQuest, bState, hooks)
        }
      } else {
        m.setU32((pQuest + 0x14) >>> 0, 3)
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        statusCyclerExDefault(
          m,
          pQuest,
          bState !== 1 && bState !== 2 ? 1 : 0,
          bState,
          hooks,
        )
      }
    }
  }
}

/**
 * Act 1 Quest 1 (Den of Evil) level-change callback (`cbIdx = 3`, levels `0x01`, `0x08`).
 *
 * @va D2Game:0x6FC83DD0 (443B)
 */
export function ACT1Q1_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel === 8) {
    if (m.u8((pQuest + 0x0a) >>> 0) === 1) {
      if (m.u32((pQuest + 0x14) >>> 0) === 1) {
        m.setU32((pQuest + 0x14) >>> 0, 2)
        statusCyclerExDefault(
          m,
          pQuest,
          m.u8((pQuest + 0x0c) >>> 0) !== 1 ? 1 : 0,
          m.u8((pQuest + 0x0c) >>> 0),
          hooks,
        )
      } else {
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        if (bState === 0 || bState > 4) {
          setQuestMainStateDefault(m, pQuest, bState, hooks)
        }
      }
    }
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x00) >>> 0) === 1) return
    m.setU8((pQuestData + 0x00) >>> 0, 1)
    if (m.u8((pQuest + 0x0a) >>> 0) === 0 || m.u8((pQuest + 0x0c) >>> 0) >= 4) return
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    if (pUnit !== 0 && m.u32(pUnit >>> 0) === 0) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
      const pGame = m.u32(pArg >>> 0) >>> 0
      const diffIdx = m.u8((pGame + 0x6d) >>> 0)
      const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuest + 0x10) >>> 0), 0) === 0 &&
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuest + 0x10) >>> 0), 0x0d) === 0 &&
        hooks?.onQuestHelperCall !== undefined
      ) {
        hooks.onQuestHelperCall(m, 0xcbe70, pGame, pUnit, 0x08)
      }
    }
    return
  }
  if (m.u32((pArg + 0x14) >>> 0) === 1) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x02) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
}

/**
 * Act 1 Quest 2 (Sisters' Burial Grounds / Blood Raven) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FC842D0 (350B)
 */
export function ACT1Q2_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 1) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u16((pQuestData + 0x80) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, pQuestData, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1 &&
      m.u8((pQuestData + 0x84) >>> 0) !== 1
    ) {
      m.setU8((pQuest + 0x0b) >>> 0, 1)
      m.setU32((pQuest + 0x0c) >>> 0, 1)
    }
  }
  if (m.u32((pArg + 0x18) >>> 0) === 0x11) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x87) >>> 0) === 1) {
      m.setU32((pQuest + 0xb0) >>> 0, (D2GAME_IMAGE_BASE_113C + 0x61250) >>> 0)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0x602a0, pQuest, pArg)
      }
    }
    if (m.u8((pQuest + 0x0a) >>> 0) !== 1) return
    const stateVal = m.u32((pQuest + 0x14) >>> 0)
    if (stateVal !== 1 && stateVal !== 2) {
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      if (bState === 0 || bState > 4) {
        setQuestMainStateDefault(m, pQuest, bState, hooks)
      }
      return
    }
    m.setU32((pQuest + 0x14) >>> 0, 3)
    const bState = m.u8((pQuest + 0x0c) >>> 0)
    statusCyclerExDefault(
      m,
      pQuest,
      bState !== 1 && bState !== 2 ? 1 : 0,
      bState,
      hooks,
    )
  }
}

/**
 * Act 1 Quest 4 (The Forgotten Tower / Countess) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FC84D30 (217B)
 */
export function ACT1Q4_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel === 0x14) {
    if (m.u8((pQuest + 0x0a) >>> 0) !== 1) return
    if (m.u32((pQuest + 0x14) >>> 0) === 1) {
      m.setU32((pQuest + 0x14) >>> 0, 2)
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      statusCyclerExDefault(
        m,
        pQuest,
        bState !== 1 && bState !== 2 ? 1 : 0,
        bState,
        hooks,
      )
      return
    }
    const bState = m.u8((pQuest + 0x0c) >>> 0)
    if (bState === 0 || bState > 4) {
      setQuestMainStateDefault(m, pQuest, bState, hooks)
    }
    return
  }
  if (nToLevel === 0x19) {
    if (m.u8((pQuest + 0x0a) >>> 0) !== 1) return
    if (m.u32((pQuest + 0x14) >>> 0) !== 3) {
      const stateVal = m.u32((pQuest + 0x14) >>> 0)
      if (stateVal === 1 || stateVal === 2) {
        m.setU32((pQuest + 0x14) >>> 0, 3)
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        statusCyclerExDefault(
          m,
          pQuest,
          bState !== 1 && bState !== 2 ? 1 : 0,
          bState,
          hooks,
        )
        return
      }
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      if (bState === 0 || bState > 4) {
        setQuestMainStateDefault(m, pQuest, bState, hooks)
      }
    }
    return
  }
  const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
  const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
  const pGame = m.u32(pArg >>> 0) >>> 0
  const diffIdx = m.u8((pGame + 0x6d) >>> 0)
  const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
  if (
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0) !== 1 &&
    DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 1) !== 1 &&
    m.u8((pQuest + 0x0a) >>> 0) === 1
  ) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x09) >>> 0) !== 1) {
      m.setU8((pQuest + 0x0b) >>> 0, 1)
      m.setU32((pQuest + 0x0c) >>> 0, 1)
    }
  }
}

/**
 * Act 1 Quest 5 (Tools of the Trade / Charsi Imbue) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FC84ED0 (263B)
 */
export function ACT1Q5_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 1) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x04) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if ((nToLevel - 0x1b) >>> 0 <= 4 && m.u8((pQuest + 0x0a) >>> 0) === 1) {
    if (m.u32((pQuest + 0x14) >>> 0) === 1) {
      m.setU32((pQuest + 0x14) >>> 0, 2)
      statusCyclerExDefault(
        m,
        pQuest,
        m.u8((pQuest + 0x0c) >>> 0) !== 1 ? 1 : 0,
        m.u8((pQuest + 0x0c) >>> 0),
        hooks,
      )
      return
    }
    const bState = m.u8((pQuest + 0x0c) >>> 0)
    if (bState === 0 || bState > 5) {
      setQuestMainStateDefault(m, pQuest, bState, hooks)
    }
  }
}

/**
 * Act 1 Quest 6 (Sisters to the Slaughter / Andariel) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FC85040 (437B)
 */
export function ACT1Q6_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 1) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x89) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if ((nToLevel >= 0x22 && nToLevel <= 0x24) && m.u8((pQuest + 0x0a) >>> 0) === 1) {
    if (m.u32((pQuest + 0x14) >>> 0) === 1) {
      m.setU32((pQuest + 0x14) >>> 0, 2)
      statusCyclerExDefault(
        m,
        pQuest,
        m.u8((pQuest + 0x0c) >>> 0) !== 1 ? 1 : 0,
        m.u8((pQuest + 0x0c) >>> 0),
        hooks,
      )
    } else {
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      if (bState === 0 || bState > 4) {
        setQuestMainStateDefault(m, pQuest, bState, hooks)
      }
    }
  }
  if (nToLevel === 0x25) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x8c) >>> 0) === 0) {
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      m.setU8((pQuestData + 0x8c) >>> 0, 1)
      if (pUnit !== 0 && m.u32(pUnit >>> 0) === 0) {
        const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
        const pGame = m.u32(pArg >>> 0) >>> 0
        const diffIdx = m.u8((pGame + 0x6d) >>> 0)
        const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
        if (
          DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuest + 0x10) >>> 0), 0) === 0 &&
          DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, m.u32((pQuest + 0x10) >>> 0), 0x0d) === 0 &&
          hooks?.onQuestHelperCall !== undefined
        ) {
          hooks.onQuestHelperCall(m, 0xcbe70, pGame, pUnit, 0x3b)
        }
      }
    }
    if (m.u8((pQuest + 0x0a) >>> 0) === 1) {
      const stateVal = m.u32((pQuest + 0x14) >>> 0)
      if (stateVal !== 1 && stateVal !== 2) {
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        if (bState === 0 || bState > 4) {
          setQuestMainStateDefault(m, pQuest, bState, hooks)
        }
      } else {
        m.setU32((pQuest + 0x14) >>> 0, 3)
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        statusCyclerExDefault(
          m,
          pQuest,
          bState !== 1 && bState !== 2 ? 1 : 0,
          bState,
          hooks,
        )
      }
    }
  }
}

/**
 * Act 1 Quest 3 (The Search for Cain) level-change callback (`cbIdx = 3`, levels `0x01`, `0x26`, `0x28`).
 *
 * @va D2Game:0x6FC884B0 (635B)
 */
export function ACT1Q3_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const nFromLevel = m.u32((pArg + 0x14) >>> 0)
  if (nFromLevel === 1) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x17) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
    if (m.u8((m.u32((pQuest + 0xf0) >>> 0) + 0x14) >>> 0) === 0) {
      iterateUnitsOfTypeDefault(
        m,
        m.u32(pArg >>> 0) >>> 0,
        0,
        m.u32((pQuest + 0xf0) >>> 0) >>> 0,
        0x61910,
        hooks,
      )
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel === 0x26) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x07) >>> 0) === 0) {
      const pRoom = UNITS_GetRoom113c(m, pUnit)
      const posX = UNIT_GetPosX113c(m, pUnit)
      const posY = UNIT_GetPosY113c(m, pUnit)
      m.setU8((pQuestData + 0x07) >>> 0, 1)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0x7a030, pRoom, posX, posY)
      }
    }
    if (m.u8((pQuest + 0x0a) >>> 0) === 1) {
      const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
      const pGame = m.u32(pArg >>> 0) >>> 0
      const diffIdx = m.u8((pGame + 0x6d) >>> 0)
      const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
      if (
        DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 2) !== 1 &&
        m.u8((pQuest + 0x0c) >>> 0) < 5
      ) {
        setQuestMainStateDefault(m, pQuest, 4, hooks)
      }
    }
    if (m.u8((pQuestData + 0x19) >>> 0) === 1) {
      m.setU32((pQuest + 0xb0) >>> 0, (D2GAME_IMAGE_BASE_113C + 0x619b0) >>> 0)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0x635b0, pQuest, pArg)
      }
    }
  } else if (nFromLevel === 0x26) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x06) >>> 0) === 1 && m.u8((pQuestData + 0x09) >>> 0) === 0) {
      const pCainUnit = iterateUnitsOfTypeDefault(
        m,
        m.u32(pArg >>> 0) >>> 0,
        1,
        pQuestData,
        0x660d0,
        hooks,
      )
      if (pCainUnit !== 0 && hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0x68280, m.u32((pQuest + 0x04) >>> 0) >>> 0, pCainUnit)
      }
      writeGameQuestState(m, m.u32(pArg >>> 0) >>> 0, 4, 0x0b)
      if (m.u8((pQuest + 0x0a) >>> 0) === 1) {
        m.setU32((pQuest + 0x14) >>> 0, 5)
        setQuestMainStateDefault(m, pQuest, 5, hooks)
      }
    }
  }
  if (nToLevel === 0x28) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32((pQuest + 0x04) >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0d) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0c) !== 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x06) >>> 0) === 0) {
        m.setU8((pQuestData + 0x0c) >>> 0, 1)
        m.setU8((pQuestData + 0x06) >>> 0, 1)
      }
      m.setU8((pQuestData + 0x0a) >>> 0, 1)
      writeGameQuestState(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, 4, 0x0b)
      m.setU8((pQuestData + 0x16) >>> 0, 0)
      m.setU32((pQuestData + 0x64) >>> 0, 0)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0x68280, m.u32((pQuest + 0x04) >>> 0) >>> 0, pQuestData)
      }
    }
  }
}

/**
 * Callback for `SUNIT_ForEachPlayer` that increments `[pCtx + 0x04]` when `pUnit`'s room
 * belongs to level `[pCtx + 0x00]`.
 *
 * @va D2Game:0x6FCAF410 (30B)
 */
export function ARENA_CountPlayersInLevelCallback113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
  pCtx: number,
): void {
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  const nLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  if (nLevel === (m.u32(pCtx >>> 0) | 0)) {
    m.setU32((pCtx + 0x04) >>> 0, (((m.u32((pCtx + 0x04) | 0) >>> 0) + 1) | 0) >>> 0)
  }
}

/**
 * Updates vendor/mercenary NPC records (`[pGame + 0x1D24]`, stride `0x44`) for `nAct`
 * when the town player count changes.
 *
 * @va D2Game:0x6FCB0320 (296B)
 */
export function NPCS_UpdateMercenaryOrVendorSlots113c(
  m: Memory113c,
  pGame: number,
  nAct: number,
  bTownEmpty: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const pNpcCtrl = m.u32((pGame + 0x1d24) >>> 0) >>> 0
  if (pNpcCtrl === 0) return
  const count = (m.u32(pNpcCtrl >>> 0) | 0)
  if (count <= 0) return
  const sgpt = getSgptDataTablesPtr(m)
  const monStatsBase = sgpt !== 0 ? m.u32((sgpt + 0xa78) >>> 0) >>> 0 : 0
  const monStatsCount = sgpt !== 0 ? (m.u32((sgpt + 0xa80) | 0) >>> 0) : 0
  let offset = 0
  for (let i = 0; i < count; i++, offset += 0x44) {
    const pArray = m.u32((pNpcCtrl + 0x04) >>> 0) >>> 0
    const pRec = (pArray + offset) >>> 0
    const hcIdx = (m.u32(pRec >>> 0) | 0)
    let pMonStats = 0
    if (hcIdx >= 0 && hcIdx < monStatsCount && monStatsBase !== 0) {
      pMonStats = (monStatsBase + hcIdx * 0x1a8) >>> 0
    }
    let nMonAct = 0
    if (pMonStats !== 0) {
      nMonAct = m.u8((pMonStats + 0x6b) >>> 0) - 1
    }
    if (nMonAct === nAct) {
      if (m.u32((pRec + 0x34) >>> 0) !== 0 && bTownEmpty === 0) {
        if ((m.u32((pRec + 0x38) | 0) >>> 0) <= 0) {
          let roll = 0
          if (hooks?.onSeedRollLimited !== undefined) {
            roll = hooks.onSeedRollLimited(m, (pNpcCtrl + 0x08) >>> 0, 0x3fff)
          }
          m.setU32((pRec + 0x3c) >>> 0, roll >>> 0)
        }
        m.setU32((pRec + 0x38) >>> 0, (((m.u32((pRec + 0x38) | 0) >>> 0) + 1) | 0) >>> 0)
      }
      if (m.u32((pRec + 0x18) >>> 0) === 0 && bTownEmpty !== 0) {
        if (countActiveNpcInteracts(m, m.u32((pRec + 0x2c) >>> 0) >>> 0) <= 0) {
          if (m.u8((pRec + 0x1c) >>> 0) === 1 || m.u32((pRec + 0x0c) >>> 0) !== 0) {
            if (hooks?.onFreeNpcInventoryNode !== undefined) {
              hooks.onFreeNpcInventoryNode(m, pGame, pRec)
            } else {
              m.setU32((pRec + 0x04) >>> 0, 0)
              m.setU32((pRec + 0x08) >>> 0, 0)
              m.setU32((pRec + 0x14) >>> 0, 0)
            }
            m.setU8((pRec + 0x20) >>> 0, 0)
            m.setU8((pRec + 0x1c) >>> 0, 0)
            const pInv = INVENTORY_AllocInventory113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, 0)
            m.setU32((pRec + 0x04) >>> 0, pInv >>> 0)
          } else if (m.u8((pRec + 0x1e) >>> 0) === 1) {
            if (hooks?.onReinitNpcRecord !== undefined) {
              hooks.onReinitNpcRecord(m, pGame, pRec, 0)
            } else {
              m.setU8((pRec + 0x20) >>> 0, 0)
              m.setU32((pRec + 0x28) >>> 0, 0)
              const pInv = INVENTORY_AllocInventory113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, 0)
              m.setU32((pRec + 0x04) >>> 0, pInv >>> 0)
            }
            m.setU8((pRec + 0x1e) >>> 0, 0)
          }
        }
      }
    }
  }
}

/**
 * Handles player transitions out of or into town levels (`1`, `40`, `75`, `103`, `109`),
 * counting remaining town players via `ARENA_CountPlayersInLevelCallback113c` and updating
 * vendor/mercenary slots (`NPCS_UpdateMercenaryOrVendorSlots113c`).
 *
 * @va D2Game:0x6FCB0C60 (306B)
 */
export function NPCS_OnPlayerLevelChange113c(
  m: Memory113c,
  pGame: number,
  nFromLevel: number,
  pUnit: number,
  nToLevel: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const savedStack = laneI1StackPtr
  const pCtx = allocStackFrame(m, 8)
  m.setU32(pCtx >>> 0, (nFromLevel | 0) >>> 0)
  m.setU32((pCtx + 0x04) >>> 0, (0) >>> 0)

  let fromAct = -1
  if (nFromLevel === 1) fromAct = 0
  else if (nFromLevel === 40) fromAct = 1
  else if (nFromLevel === 75) fromAct = 2
  else if (nFromLevel === 103) fromAct = 3
  else if (nFromLevel === 109) fromAct = 4

  if (fromAct >= 0) {
    forEachPlayerInGameDefault(
      m,
      pGame,
      pCtx,
      0x8f410,
      ARENA_CountPlayersInLevelCallback113c,
      hooks,
    )
    if ((m.u32((pCtx + 0x04) | 0) >>> 0) === 1) {
      NPCS_UpdateMercenaryOrVendorSlots113c(m, pGame, fromAct, 1, hooks)
      if (fromAct < 4 && hooks?.onActPlayerCountChanged !== undefined) {
        hooks.onActPlayerCountChanged(m, pGame, fromAct, 0)
      }
    }
  }

  let toAct = -1
  if (nToLevel === 1) toAct = 0
  else if (nToLevel === 40) toAct = 1
  else if (nToLevel === 75) toAct = 2
  else if (nToLevel === 109) toAct = 4

  if (toAct >= 0) {
    NPCS_UpdateMercenaryOrVendorSlots113c(m, pGame, toAct, 0, hooks)
    if (toAct < 3 && hooks?.onActPlayerCountChanged !== undefined) {
      hooks.onActPlayerCountChanged(m, pGame, toAct, 1)
    }
    if (toAct === 1 && hooks?.onAct2TownEntered !== undefined) {
      hooks.onAct2TownEntered(m, pGame, pUnit)
    }
  }

  freeStackFrame(savedStack)
}

/**
 * Act 3 Quest 1 (The Golden Bird) level-change callback (`cbIdx = 3`, Leaving `0x67`).
 *
 * @va D2Game:0x6FCDA1E0 (142B)
 */
export function ACT3Q1_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x67) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x02) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
}

/**
 * Act 3 Quest 2 (Blade of the Old Religion) level-change callback (`cbIdx = 3`, Entering `0x6C`).
 *
 * @va D2Game:0x6FCDA3A0 (239B)
 */
export function ACT3Q2_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x18) >>> 0) === 0x6c) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    const hasState0 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0)
    const hasState1 = DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 1)
    if (m.u8((pQuest + 0x0a) >>> 0) === 1) {
      if ((hasState0 === 0 && hasState1 === 0) || m.u32((pQuest + 0x14) >>> 0) < 2) {
        m.setU32((pQuest + 0x14) >>> 0, 2)
        statusCyclerExDefault(
          m,
          pQuest,
          m.u8((pQuest + 0x0c) >>> 0) === 0 ? 1 : 0,
          m.u8((pQuest + 0x0c) >>> 0),
          hooks,
        )
      }
    }
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x01) >>> 0) === 1) {
      m.setU32((pQuest + 0xb0) >>> 0, (D2GAME_IMAGE_BASE_113C + 0xb9290) >>> 0)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0xb99d0, pQuest, pArg)
      }
    }
  }
}

/**
 * Act 3 Quest 3 (Khalim's Will) level-change callback (`cbIdx = 3`, Leaving `0x67`).
 *
 * @va D2Game:0x6FCDA550 (137B)
 */
export function ACT3Q3_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x67) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x00) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
}

/**
 * Act 2 Quest 1 (Radament's Lair) level-change callback (`cbIdx = 3`, Leaving `0x28`, Entering `0x32`).
 *
 * @va D2Game:0x6FCE2E20 (68B)
 */
export function ACT2Q1_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x28) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
  }
  if (m.u32((pArg + 0x18) >>> 0) === 0x32) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    m.setU8((pQuestData + 0x01) >>> 0, 1)
  }
}

/**
 * Act 2 Quest 2 (The Horadric Staff) level-change callback (`cbIdx = 3`, Leaving `0x28`).
 *
 * @va D2Game:0x6FCE3EC0 (46B)
 */
export function ACT2Q2_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x28) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
  }
}

/**
 * Act 2 Quest 3 (Tainted Sun) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FCE6450 (334B)
 */
export function ACT2Q3_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const nFromLevel = m.u32((pArg + 0x14) >>> 0)
  if (nFromLevel === 0x28) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u16((pQuestData + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuestData + 0x1c) >>> 0, dwGuid)
    }
  } else if (nFromLevel === 0x2c || nFromLevel === 0x2d) {
    if (hooks?.onQuestHelperCall !== undefined) {
      hooks.onQuestHelperCall(m, 0xc2a90, m.u32(pArg >>> 0) >>> 0, pArg)
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  switch (nToLevel) {
    case 0x2b:
    case 0x2c:
    case 0x3b:
    case 0x3c: {
      if (nToLevel === 0x2c && hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0xc2a90, m.u32(pArg >>> 0) >>> 0, pArg)
      }
      if (m.u8((pQuest + 0x0a) >>> 0) !== 1) return
      const stateVal = m.u32((pQuest + 0x14) >>> 0)
      if (stateVal > 1) return
      if (stateVal === 0) {
        m.setU32((pQuest + 0x14) >>> 0, 1)
      }
      m.setU8((pQuest + 0x0b) >>> 0, 1)
      setQuestMainStateDefault(m, pQuest, 1, hooks)
      return
    }
    case 0x2d:
    case 0x3a:
    case 0x3d: {
      if (nToLevel === 0x2d && hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0xc2a90, m.u32(pArg >>> 0) >>> 0, pArg)
      }
      if (m.u8((pQuest + 0x0a) >>> 0) !== 1) return
      if (m.u32((pQuest + 0x14) >>> 0) >= 2) return
      m.setU32((pQuest + 0x14) >>> 0, 2)
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      if (bState === 1 || bState === 2) {
        setQuestMainStateDefault(m, pQuest, bState, hooks)
      } else {
        setQuestMainStateDefault(m, pQuest, 1, hooks)
      }
      return
    }
    case 0x4a: {
      if (m.u8((pQuest + 0x0a) >>> 0) !== 1) return
      if (m.u32((pQuest + 0x14) >>> 0) >= 3) return
      m.setU32((pQuest + 0x14) >>> 0, 3)
      const bState = m.u8((pQuest + 0x0c) >>> 0)
      if (bState - 1 <= 2) {
        setQuestMainStateDefault(m, pQuest, bState, hooks)
      } else {
        setQuestMainStateDefault(m, pQuest, 1, hooks)
      }
      return
    }
    default: {
      const pGame = m.u32(pArg >>> 0) >>> 0
      const pAct2 = m.u32((pGame + 0xc0) >>> 0) >>> 0
      const bossTomb = pAct2 !== 0 ? DRLGLOGIC_GetBossTombLevel113c(m, pAct2) : 0
      if (nToLevel === bossTomb && m.u8((pQuest + 0x0a) >>> 0) === 1 && m.u32((pQuest + 0x14) >>> 0) < 4) {
        m.setU32((pQuest + 0x14) >>> 0, 4)
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        if (bState - 1 <= 2) {
          setQuestMainStateDefault(m, pQuest, bState, hooks)
        } else {
          setQuestMainStateDefault(m, pQuest, 1, hooks)
        }
      }
      return
    }
  }
}

/**
 * Act 2 Quest 4 (Arcane Sanctuary) level-change callback (`cbIdx = 3`, Leaving `0x28`).
 *
 * @va D2Game:0x6FCE6E00 (142B)
 */
export function ACT2Q4_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  _hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x28) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x03) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
}

/**
 * Act 2 Quest 5 (The Summoner) level-change callback (`cbIdx = 3`, Leaving `0x28`, Entering `0x4A`, `0x2E`).
 *
 * @va D2Game:0x6FCE73A0 (210B)
 */
export function ACT2Q5_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x28) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel === 0x4a) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x01) >>> 0) === 0) {
      const pGame = m.u32(pArg >>> 0) >>> 0
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      m.setU8((pQuestData + 0x01) >>> 0, 1)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0xcbe70, pGame, pUnit, 0x132)
      }
    }
    if (m.u8((pQuest + 0x0a) >>> 0) === 1 && m.u32((pQuest + 0x14) >>> 0) === 1) {
      m.setU32((pQuest + 0x14) >>> 0, 2)
      statusCyclerExDefault(
        m,
        pQuest,
        m.u8((pQuest + 0x0c) >>> 0) !== 1 ? 1 : 0,
        m.u8((pQuest + 0x0c) >>> 0),
        hooks,
      )
    }
    if (m.u8((pQuestData + 0x03) >>> 0) === 1) {
      m.setU32((pQuest + 0xb0) >>> 0, (D2GAME_IMAGE_BASE_113C + 0xc6a30) >>> 0)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0xc7250, pQuest, pArg)
      }
    }
  } else if (nToLevel === 0x2e && m.u8((pQuest + 0x0a) >>> 0) === 1 && m.u32((pQuest + 0x14) >>> 0) <= 3) {
    m.setU8((pQuest + 0x0b) >>> 0, 0)
  }
}

/**
 * Act 2 Quest 6 (The Seven Tombs / Duriel) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FCE9190 (621B)
 */
export function ACT2Q6_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const nFromLevel = m.u32((pArg + 0x14) >>> 0)
  if (nFromLevel === 0x28) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x02) >>> 0) !== 1 && m.u32((pQuest + 0x14) >>> 0) >= 2) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel === 0x2e) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x0b) >>> 0) === 0) {
      const pGame = m.u32(pArg >>> 0) >>> 0
      const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
      m.setU8((pQuestData + 0x0b) >>> 0, 1)
      if (hooks?.onQuestHelperCall !== undefined) {
        hooks.onQuestHelperCall(m, 0xcbe70, pGame, pUnit, 0x14d)
      }
    }
    if (m.u8((pQuest + 0x0a) >>> 0) === 1) {
      if (m.u32((pQuest + 0x14) >>> 0) < 2) {
        m.setU8((pQuestData + 0x01) >>> 0, 1)
      } else if (m.u32((pQuest + 0x14) >>> 0) === 2) {
        const bState = m.u8((pQuest + 0x0c) >>> 0)
        if (bState !== 2 && bState !== 3) {
          setQuestMainStateDefault(m, pQuest, 2, hooks)
        }
      }
    }
  } else if (nFromLevel === 0x49 && nToLevel === 0x28) {
    const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
    if (m.u8((pQuestData + 0x09) >>> 0) === 1) {
      m.setU8((pQuestData + 0x0a) >>> 0, 1)
      const pTyrael = m.u32((pQuestData + 0x5c) >>> 0) >>> 0
      if (pTyrael !== 0 && m.u32(pTyrael >>> 0) === 1) {
        const pMonsterData = m.u32((pTyrael + 0x14) >>> 0) >>> 0
        const pInteract = pMonsterData !== 0 ? m.u32((pMonsterData + 0x30) >>> 0) >>> 0 : 0
        if (hasActiveNpcInteract(m, pInteract) !== 0) {
          clearMonsterInteractList(m, m.u32(pArg >>> 0) >>> 0, pTyrael)
        }
      }
      if (pTyrael !== 0 && hooks?.onQuestHelperCall !== undefined) {
        const savedStack = laneI1StackPtr
        const pCoords = allocStackFrame(m, 8)
        const pPath = m.u32((pTyrael + 0x2c) >>> 0) >>> 0
        if (pPath !== 0) {
          PATH_GetTargetTypeAndPosition113c(m, pTyrael, pCoords)
        }
        const pRoom = UNITS_GetRoom113c(m, pTyrael)
        hooks.onQuestHelperCall(m, 0x2cd10, m.u32(pArg >>> 0) >>> 0, pRoom, pTyrael)
        freeStackFrame(savedStack)
      }
    }
  }
  const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
  if (m.u8((pQuestData + 0x10) >>> 0) !== 0 && nToLevel === m.u32((pQuestData + 0x30) >>> 0)) {
    m.setU8((pQuestData + 0x10) >>> 0, 0)
    if (hooks?.onQuestHelperCall !== undefined) {
      hooks.onQuestHelperCall(m, 0xc8fd0, pQuest, pArg)
    }
  }
  if (m.u8((pQuestData + 0x00) >>> 0) !== 0) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4) === 0 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 5) === 0
    ) {
      if (DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0d, 3) !== 0) {
        QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 4)
        return
      }
      QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 5)
    }
  }
}

/**
 * Act 3 Intro Quest level-change callback (`cbIdx = 3`, Leaving `0x4B`).
 *
 * @va D2Game:0x6FD03E00 (46B)
 */
export function ACT3Q0_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x4b) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
  }
}

/**
 * Act 3 Quest 4 (Lam Esen's Tome / Khalim Relics) level-change callback (`cbIdx = 3`).
 *
 * @va D2Game:0x6FD071D0 (488B)
 */
export function ACT3Q4_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x4b) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x0b) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel - 0x4c <= 0x1b) {
    const rel = nToLevel - 0x4c
    const isRelicArea =
      rel === 0 ||
      rel === 1 ||
      rel === 2 ||
      rel === 3 ||
      rel === 4 ||
      rel === 5 ||
      rel === 6 ||
      rel === 7 ||
      rel === 9 ||
      rel === 13 ||
      rel === 16 ||
      rel === 17 ||
      rel === 19 ||
      rel === 27
    if (isRelicArea) {
      let bTrigger = false
      if (nToLevel === 0x55) {
        if (readGameQuestState(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, 0x11, 7) === 0) {
          bTrigger = true
        }
      } else if (nToLevel === 0x5c || nToLevel === 0x5d) {
        if (readGameQuestState(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, 0x11, 9) === 0) {
          bTrigger = true
        }
      } else if (nToLevel === 0x59 || nToLevel === 0x5b) {
        if (readGameQuestState(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, 0x11, 8) === 0) {
          bTrigger = true
        }
      } else if (nToLevel === 0x53) {
        if (readGameQuestState(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, 0x11, 0x0a) === 0) {
          bTrigger = true
        }
      } else {
        bTrigger = true
      }
      if (bTrigger && m.u8((pQuest + 0x0a) >>> 0) === 1 && m.u32((pQuest + 0x14) >>> 0) <= 2) {
        const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
        m.setU32((pQuestData + 0x58) >>> 0, 0)
        iterateUnitsOfTypeDefault(
          m,
          m.u32((pQuest + 0x04) >>> 0) >>> 0,
          0,
          pQuest,
          0xe6910,
          hooks,
        )
        m.setU32((pQuest + 0x14) >>> 0, 2)
        if (m.u32((pQuestData + 0x58) >>> 0) === 0) {
          const bState = m.u8((pQuest + 0x0c) >>> 0)
          statusCyclerExDefault(
            m,
            pQuest,
            bState !== 1 ? 1 : 0,
            bState,
            hooks,
          )
        }
      }
    }
  }
}

/**
 * Act 3 Quest 5 (The Blackened Temple) level-change callback (`cbIdx = 3`, Leaving `0x4B`).
 *
 * @va D2Game:0x6FD07560 (222B)
 */
export function ACT3Q5_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x4b) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x02) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
    if (
      m.u32((pQuest + 0x14) >>> 0) < 2 &&
      readGameQuestState(m, m.u32((pQuest + 0x04) >>> 0) >>> 0, 0x11, 0x0b) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      m.setU8((pQuestData + 0x04) >>> 0, 0)
      iterateUnitsOfTypeDefault(
        m,
        m.u32(pArg >>> 0) >>> 0,
        0,
        pQuest,
        0xe69e0,
        hooks,
      )
      if (m.u8((pQuestData + 0x04) >>> 0) === 0) {
        m.setU32((pQuest + 0x14) >>> 0, 2)
        statusCyclerExDefault(m, pQuest, 1, m.u8((pQuest + 0x0c) >>> 0), hooks)
      }
    }
  }
}

/**
 * Act 3 Quest 6 (The Guardian / Travincal) level-change callback (`cbIdx = 3`, levels `0x4B..0x4F`).
 *
 * @va D2Game:0x6FD07880 (184B)
 */
export function ACT3Q6_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x4b) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x10, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x10, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x02) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if ((nToLevel === 0x4d || nToLevel === 0x4e || nToLevel === 0x4f) && m.u32((pQuest + 0x14) >>> 0) === 1) {
    m.setU32((pQuest + 0x14) >>> 0, 2)
    statusCyclerExDefault(m, pQuest, 1, m.u8((pQuest + 0x0c) >>> 0), hooks)
  }
}

/**
 * Act 3 Quest 7 (Kurast Bazaar / Ruined Temple) level-change callback (`cbIdx = 3`, Entering `0x52`).
 *
 * @va D2Game:0x6FD07A10 (34B)
 */
export function ACT3Q7_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x18) >>> 0) === 0x52 && m.u32((pQuest + 0x14) >>> 0) < 2) {
    m.setU32((pQuest + 0x14) >>> 0, 2)
    setQuestMainStateDefault(m, pQuest, 1, hooks)
  }
}

/**
 * Act 3 Quest 8 (Durance of Hate / Mephisto) level-change callback (`cbIdx = 3`, levels `0x4B`, `0x62`, `0x64`, `0x66`).
 *
 * @va D2Game:0x6FD07BE0 (245B)
 */
export function ACT3Q8_Callback03_LevelChanged113c(
  m: Memory113c,
  pQuest: number,
  pArg: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (m.u32((pArg + 0x14) >>> 0) === 0x4b) {
    const pUnit = m.u32((pArg + 0x0c) >>> 0) >>> 0
    const dwGuid = pUnit !== 0 ? m.u32((pUnit + 0x0c) >>> 0) : 0xffffffff
    if (m.u16((pQuest + 0x9c) >>> 0) > 0) {
      QUESTS_GuidListRemove113c(m, (pQuest + 0x1c) >>> 0, dwGuid)
    }
    const pPlayerData = UNITS_GetPlayerData113c(m, pUnit)
    const pGame = m.u32(pArg >>> 0) >>> 0
    const diffIdx = m.u8((pGame + 0x6d) >>> 0)
    const pQuestFlags = m.u32((pPlayerData + diffIdx * 4 + 0x10) >>> 0) >>> 0
    if (
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 0) !== 1 &&
      DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 1) !== 1 &&
      m.u8((pQuest + 0x0a) >>> 0) === 1
    ) {
      const pQuestData = m.u32((pQuest + 0xf0) >>> 0) >>> 0
      if (m.u8((pQuestData + 0x00) >>> 0) !== 1) {
        m.setU8((pQuest + 0x0b) >>> 0, 1)
        m.setU32((pQuest + 0x0c) >>> 0, 1)
      }
    }
  }
  const nToLevel = m.u32((pArg + 0x18) >>> 0)
  if (nToLevel === 0x62) {
    if (m.u8((pQuest + 0x0a) >>> 0) === 1 && m.u32((pQuest + 0x14) >>> 0) === 1) {
      m.setU32((pQuest + 0x14) >>> 0, 2)
      statusCyclerExDefault(
        m,
        pQuest,
        m.u8((pQuest + 0x0c) >>> 0) !== 1 ? 1 : 0,
        m.u8((pQuest + 0x0c) >>> 0),
        hooks,
      )
    }
  } else if (
    (nToLevel === 0x64 || nToLevel === 0x66) &&
    m.u8((pQuest + 0x0a) >>> 0) === 1 &&
    m.u32((pQuest + 0x14) >>> 0) <= 2
  ) {
    m.setU32((pQuest + 0x14) >>> 0, 3)
    const bState = m.u8((pQuest + 0x0c) >>> 0)
    statusCyclerExDefault(
      m,
      pQuest,
      bState !== 1 && bState !== 2 ? 1 : 0,
      bState,
      hooks,
    )
  }
}

// ============================================================================
// F224 (2 VAs)
// ============================================================================

/**
 * Unit callback (`edx = pUnit`, `stack[1] = pCount`) that increments `dword [pCount]`
 * when `pUnit != 0`, `(byte [pUnit + 0xC6] & 1) == 0`, and `pUnit` is a living player
 * (`dwUnitType == 0`, `eMode != 0 && eMode != 17`) or living monster (`dwUnitType == 1`, `eMode != 0 && eMode != 12`).
 *
 * @va D2Game:0x6FC57810 (69B)
 */
export function QUESTS_CountLivingUnitsInRoomCallback113c(
  m: Memory113c,
  pUnit: number,
  pCount: number,
): void {
  if (pUnit === 0) return
  if ((m.u8((pUnit + 0xc6) >>> 0) & 1) !== 0) return
  const dwUnitType = m.u32(pUnit >>> 0)
  if (dwUnitType === 0) {
    const eMode = m.u32((pUnit + 0x10) >>> 0)
    if (eMode === 0 || eMode === 17) return
    m.setU32(pCount >>> 0, (((m.u32(pCount >>> 0) | 0) + 1) | 0) >>> 0)
  } else if (dwUnitType === 1) {
    const eMode = m.u32((pUnit + 0x10) >>> 0)
    if (eMode === 0 || eMode === 12) return
    m.setU32(pCount >>> 0, (((m.u32(pCount >>> 0) | 0) + 1) | 0) >>> 0)
  }
}

/**
 * Counts living units in `pGame` via `QUESTS_CountLivingUnitsInRoomCallback113c`, then clamps
 * against `dword [0x6FD31C1C]` when `byte [pGame + 0x6A]` is in `1..3`.
 *
 * @va D2Game:0x6FC579A0 (59B)
 */
export function QUESTS_CountUnitsInGame113c(
  m: Memory113c,
  pGame: number,
  hooks?: Post150LaneI1Hooks113c,
): number {
  const savedStack = laneI1StackPtr
  const pCount = allocStackFrame(m, 4)
  m.setU32(pCount >>> 0, (0) >>> 0)
  forEachPlayerInGameDefault(
    m,
    pGame,
    pCount,
    0x37810,
    (_mem, _game, unit, countPtr) => QUESTS_CountLivingUnitsInRoomCallback113c(_mem, unit, countPtr),
    hooks,
  )
  let count = (m.u32(pCount >>> 0) | 0)
  const gameType = pGame !== 0 ? m.u8((pGame + 0x6a) >>> 0) : 0
  if (gameType >= 1 && gameType <= 3) {
    const maxCount = (m.u32(D2GAME_MAX_ROOM_UNIT_COUNT_VA_113C) | 0)
    if (count < maxCount) {
      count = maxCount
    }
  }
  freeStackFrame(savedStack)
  return count
}

// ============================================================================
// F251 (3 VAs)
// ============================================================================

/**
 * Walks `pPlayerData->pPlayerPets` (`[pPlayerData + 0x44]`) across pet types `1 .. dwPetTypesTxtRecordCount - 1`
 * and removes any pet entry whose server monster unit (`[pGame + 0x1320 + (guid & 0x7F)*4]`) is missing or dead.
 *
 * @va D2Game:0x6FCB7D10 (264B)
 */
export function PLRINTRO_CleanInvalidMonsterMinions113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  pPlayerData: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const sgpt = getSgptDataTablesPtr(m)
  const petTypesCount = sgpt !== 0 ? (m.u32((sgpt + 0xbf0) | 0) >>> 0) : 0
  if (petTypesCount <= 1) return
  let offset = 0x0c
  for (let petType = 1; petType < petTypesCount; petType++, offset += 0x0c) {
    const pPetsRoot = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
    if (pPetsRoot === 0) continue
    const pBucketBase = m.u32(pPetsRoot >>> 0) >>> 0
    const pBucket = (pBucketBase + offset) >>> 0
    if (pBucket === 0) continue
    let pNode = m.u32(pBucket >>> 0) >>> 0
    while (pNode !== 0) {
      const pNext = m.u32((pNode + 0x18) >>> 0) >>> 0
      const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
      let pMonster = m.u32((pGame + ((dwPetGuid & 0x7f) << 2) + 0x1320) >>> 0) >>> 0
      while (pMonster !== 0) {
        if (m.u32((pMonster + 0x0c) >>> 0) >>> 0 === dwPetGuid) break
        pMonster = m.u32((pMonster + 0xe4) >>> 0) >>> 0
      }
      let shouldRemove = false
      if (pMonster === 0) {
        shouldRemove = true
      } else {
        const eMode = m.u32((pMonster + 0x10) >>> 0)
        if (eMode === 0 || eMode === 12) {
          shouldRemove = true
        }
      }
      if (shouldRemove) {
        if (hooks?.onRemovePlayerPet !== undefined) {
          hooks.onRemovePlayerPet(m, pGame, pPlayer, pMonster, petType, dwPetGuid)
        } else {
          // Unlink pNode from [pBucket] list
          let prev = 0
          let cur = m.u32(pBucket >>> 0) >>> 0
          while (cur !== 0) {
            if (cur === pNode) {
              if (prev !== 0) {
                m.setU32((prev + 0x18) >>> 0, pNext)
              } else {
                m.setU32(pBucket >>> 0, pNext)
              }
              break
            }
            prev = cur
            cur = m.u32((cur + 0x18) >>> 0) >>> 0
          }
        }
      }
      pNode = pNext
    }
  }
}

/**
 * Cleans invalid minions via `PLRINTRO_CleanInvalidMonsterMinions113c` and sends all active
 * pet entries with `PetTypesTxt` flag bit 2 (`0x04`) to `pClient`.
 *
 * @va D2Game:0x6FCB8250 (310B)
 */
export function PLRINTRO_SendAllPlayerPetsToClient113c(
  m: Memory113c,
  pClient: number,
  pPlayer: number,
  pGame: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (pPlayer === 0 || m.u32(pPlayer >>> 0) !== 0 || pGame === 0) return
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer)
  if (pPlayerData === 0) return
  const pPetsRoot = m.u32((pPlayerData + 0x44) >>> 0) >>> 0
  if (pPetsRoot === 0) return
  PLRINTRO_CleanInvalidMonsterMinions113c(m, pGame, pPlayer, pPlayerData, hooks)
  const sgpt = getSgptDataTablesPtr(m)
  if (sgpt === 0) return
  const petTypesCount = (m.u32((sgpt + 0xbf0) | 0) >>> 0)
  const petTypesBase = m.u32((sgpt + 0xbec) >>> 0) >>> 0
  const maskByte = getBitMaskByte(m, 8, 4)
  for (let petType = 1; petType < petTypesCount; petType++) {
    if (petTypesBase === 0) continue
    const pPetTxt = (petTypesBase + petType * 0xe0) >>> 0
    if (pPetTxt === 0) continue
    if ((m.u8((pPetTxt + 0x04) >>> 0) & maskByte) === 0) continue
    const pBucketBase = m.u32(pPetsRoot >>> 0) >>> 0
    const pBucket = (pBucketBase + petType * 0x0c) >>> 0
    if (pBucket === 0) continue
    let pNode = m.u32(pBucket >>> 0) >>> 0
    while (pNode !== 0) {
      const dwPetGuid = m.u32((pNode + 0x04) >>> 0) >>> 0
      const nClassId = m.u32(pNode >>> 0) >>> 0
      const dwOwnerGuid = m.u32((pNode + 0x0c) >>> 0) >>> 0
      const wHydraFlags = m.u16((pNode + 0x10) >>> 0)
      if (hooks?.onSendPetPacketToClient !== undefined) {
        hooks.onSendPetPacketToClient(
          m,
          pClient,
          petType,
          dwPetGuid,
          nClassId,
          dwOwnerGuid,
          wHydraFlags,
        )
      }
      pNode = m.u32((pNode + 0x18) >>> 0) >>> 0
    }
  }
}

/**
 * Sends all party members' pets to `pPlayer`'s client (`[pPlayerData + 0x9C]`) when `pPlayer`
 * belongs to a valid party (`nPartyId != -1`).
 *
 * @va D2Game:0x6FCBC620 (193B)
 */
export function PARTY_SendPartyPetsToClient113c(
  m: Memory113c,
  pGame: number,
  pPlayer: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (pPlayer === 0 || m.u32(pPlayer >>> 0) !== 0 || pGame === 0) return
  const pPlayerData = UNITS_GetPlayerData113c(m, pPlayer)
  const pClient = pPlayerData !== 0 ? m.u32((pPlayerData + 0x9c) >>> 0) >>> 0 : 0
  const dwPlayerGuid = m.u32((pPlayer + 0x0c) >>> 0) >>> 0

  // Resolve party ID and party node from pGame->pPartyControl (+0x1D2C)
  const pPartyCtrl = m.u32((pGame + 0x1d2c) >>> 0) >>> 0
  if (pPartyCtrl === 0) return
  let nPartyId = 0xffff
  let pPartySub = m.u32((pPartyCtrl + 0x04) >>> 0) >>> 0
  outer: while (pPartySub !== 0) {
    let pMember = m.u32((pPartySub + 0x04) >>> 0) >>> 0
    while (pMember !== 0) {
      if (m.u32(pMember >>> 0) >>> 0 === dwPlayerGuid) {
        nPartyId = m.u16(pPartySub >>> 0)
        break outer
      }
      pMember = m.u32((pMember + 0x04) >>> 0) >>> 0
    }
    pPartySub = m.u32((pPartySub + 0x08) >>> 0) >>> 0
  }
  if (nPartyId === 0xffff) return

  let pFoundParty = m.u32((pPartyCtrl + 0x04) >>> 0) >>> 0
  while (pFoundParty !== 0) {
    if (m.u16(pFoundParty >>> 0) === nPartyId) break
    pFoundParty = m.u32((pFoundParty + 0x08) >>> 0) >>> 0
  }
  if (pFoundParty === 0) return

  let pMemberNode = m.u32((pFoundParty + 0x04) >>> 0) >>> 0
  while (pMemberNode !== 0) {
    const memberGuid = m.u32(pMemberNode >>> 0) >>> 0
    let pMemberUnit = m.u32((pGame + ((memberGuid & 0x7f) << 2) + 0x1120) >>> 0) >>> 0
    while (pMemberUnit !== 0) {
      if (m.u32((pMemberUnit + 0x0c) >>> 0) >>> 0 === memberGuid) break
      pMemberUnit = m.u32((pMemberUnit + 0xe4) >>> 0) >>> 0
    }
    if (pMemberUnit !== 0) {
      const pMemberPlrData = UNITS_GetPlayerData113c(m, pMemberUnit)
      const pPetsRoot = pMemberPlrData !== 0 ? m.u32((pMemberPlrData + 0x44) >>> 0) >>> 0 : 0
      if (pPetsRoot !== 0) {
        const pBucketBase = m.u32(pPetsRoot >>> 0) >>> 0
        for (let offset = 0; offset < 0x18; offset += 0x0c) {
          const pBucket = (pBucketBase + offset) >>> 0
          let pPetNode = pBucket !== 0 ? m.u32(pBucket >>> 0) >>> 0 : 0
          while (pPetNode !== 0) {
            if (hooks?.onSendPetPacketToClient !== undefined) {
              hooks.onSendPetPacketToClient(
                m,
                pClient,
                (offset / 0x0c) | 0,
                m.u32((pPetNode + 0x04) >>> 0) >>> 0,
                m.u32(pPetNode >>> 0) >>> 0,
                m.u32((pPetNode + 0x0c) >>> 0) >>> 0,
                m.u16((pPetNode + 0x10) >>> 0),
              )
            }
            pPetNode = m.u32((pPetNode + 0x18) >>> 0) >>> 0
          }
        }
      }
    }
    pMemberNode = m.u32((pMemberNode + 0x04) >>> 0) >>> 0
  }
}

// ============================================================================
// F276 (14 VAs)
// ============================================================================

/**
 * Packs monster AI command circular list, mount/rider (`0x219`), carried object (`0x21E`),
 * and owner state (`0x21F`) into an inactive monster preset save node (`pNode`).
 *
 * @va D2Game:0x6FC3EF50 (883B)
 */
export function MONSTER_PackPresetSaveData113c(
  m: Memory113c,
  pUnit: number,
  pNode: number,
  pGame: number,
): number {
  if (pUnit === 0 || m.u32(pUnit >>> 0) !== 1) return 0
  const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonsterData === 0) return 0
  const pAiGeneral = m.u32((pMonsterData + 0x28) >>> 0) >>> 0
  if (pAiGeneral === 0) return 0

  let pCmdHead = m.u32((pAiGeneral + 0x24) >>> 0) >>> 0
  if (pCmdHead !== 0) {
    m.setU32((pNode + 0x24) >>> 0, m.u32((pAiGeneral + 0x20) >>> 0) >>> 0)
    do {
      const pAllocCmd = m.alloc(0x20) >>> 0
      m.setU32((pAllocCmd + 0x18) >>> 0, 0)
      m.setU32((pAllocCmd + 0x1c) >>> 0, 0)
      AIGENERAL_CopyAiCommandParams113c(m, pAllocCmd, pCmdHead)
      const pExistingHead = m.u32((pNode + 0x4c) >>> 0) >>> 0
      if (pExistingHead === 0) {
        m.setU32((pAllocCmd + 0x18) >>> 0, pAllocCmd)
        m.setU32((pAllocCmd + 0x1c) >>> 0, pAllocCmd)
        m.setU32((pNode + 0x4c) >>> 0, pAllocCmd)
      } else {
        const pTail = m.u32((pExistingHead + 0x1c) >>> 0) >>> 0
        m.setU32((pAllocCmd + 0x18) >>> 0, pExistingHead)
        m.setU32((pAllocCmd + 0x1c) >>> 0, pTail)
        if (pTail !== 0) {
          m.setU32((pTail + 0x18) >>> 0, pAllocCmd)
        }
        m.setU32((pExistingHead + 0x1c) >>> 0, pAllocCmd)
      }
      if (m.u32((pNode + 0x24) >>> 0) >>> 0 === pCmdHead) {
        m.setU32((pNode + 0x24) >>> 0, pAllocCmd)
      }
      pCmdHead = m.u32((pCmdHead + 0x18) >>> 0) >>> 0
    } while (pCmdHead !== 0 && pCmdHead !== (m.u32((pAiGeneral + 0x24) >>> 0) >>> 0))
  }

  DRLGPRESET_MovePointerAndClear113c(m, (pAiGeneral + 0x38) >>> 0, (pNode + 0x50) >>> 0)

  const sgpt = getSgptDataTablesPtr(m)
  const monStatsBase = sgpt !== 0 ? m.u32((sgpt + 0xa78) >>> 0) >>> 0 : 0
  const monStatsCount = sgpt !== 0 ? (m.u32((sgpt + 0xa80) | 0) >>> 0) : 0
  const monStats2Base = sgpt !== 0 ? m.u32((sgpt + 0xa84) >>> 0) >>> 0 : 0
  const monStats2Count = sgpt !== 0 ? (m.u32((sgpt + 0xa8c) | 0) >>> 0) : 0
  const hcIdx = (m.u32((pUnit + 0x04) | 0) >>> 0)
  if (hcIdx >= 0 && hcIdx < monStatsCount && monStatsBase !== 0) {
    const pMonStats = (monStatsBase + hcIdx * 0x1a8) >>> 0
    const monStatsExIdx = ((m.u16((pMonStats + 0x02) << 16) >> 16) >>> 0)
    if (monStatsExIdx >= 0 && monStatsExIdx < monStats2Count && monStats2Base !== 0) {
      const pMonStats2 = (monStats2Base + monStatsExIdx * 0x134) >>> 0
      const compBit = getBitMaskByte(m, 0x24, 2)
      if ((m.u8((pMonStats2 + 0x05) >>> 0) & compBit) !== 0 && m.u8((pMonsterData + 0x16) >>> 0) === 1) {
        const pMountSave = m.alloc(0x14) >>> 0
        for (let i = 0; i < 0x14; i += 4) m.setU32((pMountSave + i) >>> 0, 0)
        m.setU32(pMountSave >>> 0, 0x219)
        m.setU32((pMountSave + 0x04) >>> 0, 0x14)
        const pCurHead = m.u32((pNode + 0x50) >>> 0) >>> 0
        m.setU32((pNode + 0x50) >>> 0, pMountSave)
        if (pCurHead !== 0) {
          m.setU32((pMountSave + 0x08) >>> 0, pCurHead)
        }
        m.setU8((pMountSave + 0x10) >>> 0, 1)
      }
    }
  }

  return 1
}

/**
 * Strips active states, frees type-2 event nodes, allocates a `0x5C`-byte inactive monster node,
 * calls `MONSTER_PackPresetSaveData113c`, and links the node into the act's inactive room list.
 *
 * @va D2Game:0x6FC3F600 (1006B)
 */
export function MONSTER_SaveInactiveMonsterNode113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: Post150LaneI1Hooks113c,
): number {
  const sgpt = getSgptDataTablesPtr(m)
  const statesCount = sgpt !== 0 ? m.u16((sgpt + 0x178) >>> 0) : 0
  for (let stateId = 0; stateId < statesCount; stateId++) {
    if (STATES_CheckState113c(m, pUnit, stateId) !== 0) {
      const statesPtrTable = m.u32((sgpt + 0x174) >>> 0) >>> 0
      const pStateRec = statesPtrTable !== 0 ? m.u32((statesPtrTable + stateId * 4) >>> 0) >>> 0 : 0
      if (pStateRec === 0 || (m.u8((pStateRec + 0x04) >>> 0) & 0x40) === 0) {
        const pStatList = STATLIST_GetStatListFromUnitAndStateMemPort113c(m, pUnit, stateId)
        if (pStatList !== 0) {
          STATLIST_UnlinkSubList113c(m, pUnit, pStatList)
          STATLIST_FreeStatListIfNonExtended113c(m, pStatList)
        }
      }
    }
  }

  let pEvent = m.u32((pUnit + 0x84) >>> 0) >>> 0
  while (pEvent !== 0) {
    const pNextEvent = m.u32((pEvent + 0x18) >>> 0) >>> 0
    if (m.u32(pEvent >>> 0) === 2) {
      EVENT_FreeNode113c(m, pGame, pEvent)
    }
    pEvent = pNextEvent
  }

  const pNode = m.alloc(0x5c) >>> 0
  for (let i = 0; i < 0x5c; i += 4) {
    m.setU32((pNode + i) >>> 0, 0)
  }

  if (MONSTER_PackPresetSaveData113c(m, pUnit, pNode, pGame) === 0) {
    freeMemBlock(m, pNode)
    return 0
  }

  m.setU32(pNode >>> 0, m.u32((pUnit + 0x04) >>> 0) >>> 0)
  const pMonsterData =
    m.u32(pUnit >>> 0) === 1 && m.u32((pUnit + 0x14) >>> 0) !== 0
      ? m.u32((pUnit + 0x14) >>> 0) >>> 0
      : 0

  if (pMonsterData !== 0) {
    m.setU16((pNode + 0x10) >>> 0, m.u16((pMonsterData + 0x1c) >>> 0))
  }
  const dwFlags = m.u32((pUnit + 0xc4) >>> 0) >>> 0
  m.setU32((pNode + 0x14) >>> 0, dwFlags)
  m.setU32((pUnit + 0xc4) >>> 0, (dwFlags & 0xfbffffff) >>> 0)
  m.setU32((pNode + 0x18) >>> 0, m.u32((pUnit + 0xc8) >>> 0) >>> 0)
  m.setU32((pNode + 0x1c) >>> 0, UNIT_GetAlignment113c(m, pUnit) >>> 0)

  const pAiControl = pMonsterData !== 0 ? m.u32((pMonsterData + 0x18) >>> 0) >>> 0 : 0
  if (pAiControl !== 0) {
    m.setU32((pNode + 0x20) >>> 0, m.u32(pAiControl >>> 0) >>> 0)
  }

  const pAiGeneral = pMonsterData !== 0 ? m.u32((pMonsterData + 0x28) >>> 0) >>> 0 : 0
  if (pAiGeneral !== 0) {
    const pMinionList = m.u32((pAiGeneral + 0x34) >>> 0) >>> 0
    if (pMinionList !== 0) {
      const pLeader = m.u32(pMinionList >>> 0) >>> 0
      if (pLeader !== 0) {
        const leaderGuid = m.u32((pLeader + 0x0c) >>> 0) >>> 0
        m.setU32((pNode + 0x28) >>> 0, leaderGuid)
        if (pUnit === pLeader) {
          m.setU8((pNode + 0x48) >>> 0, 1)
        }
      }
    }
    if ((m.u8((pMonsterData + 0x16) >>> 0) & 8) !== 0 && hooks?.onQuestHelperCall !== undefined) {
      m.setU16(
        (pNode + 0x2c) >>> 0,
        hooks.onQuestHelperCall(m, 0xe3b00, pUnit, 0) & 0xffff,
      )
    }
    const dwSpecFlag = m.u32(pAiGeneral >>> 0) >>> 0
    m.setU32((pNode + 0x30) >>> 0, dwSpecFlag)
    if (dwSpecFlag !== 0) {
      m.setU32((pNode + 0x34) >>> 0, m.u32((pAiGeneral + 0x0c) >>> 0) >>> 0)
      m.setU32((pNode + 0x38) >>> 0, m.u32((pAiGeneral + 0x10) >>> 0) >>> 0)
    }
  }

  if (pMonsterData !== 0) {
    for (let i = 0; i < 9; i++) {
      m.setU8((pNode + 0x3c + i) >>> 0, m.u8((pMonsterData + 0x26 + i) >>> 0))
    }
    m.setU8((pNode + 0x49) >>> 0, m.u8((pMonsterData + 0x16) >>> 0))
  }

  m.setU32((pNode + 0x44) >>> 0, STATLIST_GetUnitStat113c(m, pUnit, 0x24, 0) >>> 0)
  const curLife = STATLIST_GetUnitStat113c(m, pUnit, 6, 0)
  const maxLife = STATLIST_GetMaxLifeFromUnit113c(m, pUnit)
  if (curLife >= maxLife) {
    m.setU32((pNode + 0x0c) >>> 0, 0xffffffff)
  } else {
    m.setU32((pNode + 0x0c) >>> 0, (curLife) >>> 0)
  }

  let posX = 0
  let posY = 0
  const dwUnitType = m.u32(pUnit >>> 0)
  if (dwUnitType === 0 || dwUnitType === 1 || dwUnitType === 3) {
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    if (pPath !== 0) {
      posX = PATH_GetPosX113c(m, pPath)
      posY = PATH_GetPosY113c(m, pPath)
    }
  } else {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    if (pStaticPath !== 0) {
      posX = (m.u32((pStaticPath + 0x04) | 0) >>> 0)
      posY = (m.u32((pStaticPath + 0x08) | 0) >>> 0)
    }
  }
  m.setU32((pNode + 0x04) >>> 0, (posX) >>> 0)
  m.setU32((pNode + 0x08) >>> 0, (posY) >>> 0)

  const pRoom = UNITS_GetRoom113c(m, pUnit)
  const savedStack = laneI1StackPtr
  const pRoomCoords = allocStackFrame(m, 0x20)
  DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
  const nLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevel) & 0xff
  const roomX = (m.u32(pRoomCoords >>> 0) | 0)
  const roomY = (m.u32((pRoomCoords + 0x04) | 0) >>> 0)
  freeStackFrame(savedStack)

  const pRoomNode = findOrCreateInactiveRoomNode(m, pGame, actNo, roomX, roomY, 1)
  if (pRoomNode === 0) return 0
  m.setU32((pNode + 0x58) >>> 0, m.u32((pRoomNode + 0x08) >>> 0) >>> 0)
  m.setU32((pRoomNode + 0x08) >>> 0, pNode)
  return 1
}

/**
 * Saves an inactive unit (`pUnit`: monster type `1`, object type `2`, or item type `4`) into
 * the act's inactive room list at `[pGame + actNo*4 + 0xD8]`.
 *
 * @va D2Game:0x6FC404E0 (626B)
 */
export function UNIT_SaveInactiveUnitNode113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  const dwUnitType = m.u32(pUnit >>> 0)
  if (dwUnitType === 1) {
    MONSTER_SaveInactiveMonsterNode113c(m, pGame, pUnit, hooks)
    return
  }

  let posX = 0
  let posY = 0
  if (dwUnitType === 0 || dwUnitType === 3) {
    const pPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    if (pPath !== 0) {
      posX = PATH_GetPosX113c(m, pPath)
      posY = PATH_GetPosY113c(m, pPath)
    }
  } else {
    const pStaticPath = m.u32((pUnit + 0x2c) >>> 0) >>> 0
    if (pStaticPath !== 0) {
      posX = (m.u32((pStaticPath + 0x04) | 0) >>> 0)
      posY = (m.u32((pStaticPath + 0x08) | 0) >>> 0)
    }
  }

  const pRoom = UNITS_GetRoom113c(m, pUnit)
  const nLevel = DUNGEON_GetLevelIdFromRoom113c(m, pRoom)
  const actNo = DRLG_GetActNoFromLevelId113c(m, nLevel) & 0xff

  const savedStack = laneI1StackPtr
  const pRoomCoords = allocStackFrame(m, 0x20)
  DUNGEON_GetRoomCoordinates113c(m, pRoom, pRoomCoords)
  const roomX = (m.u32(pRoomCoords >>> 0) | 0)
  const roomY = (m.u32((pRoomCoords + 0x04) | 0) >>> 0)
  const pRoomNode = findOrCreateInactiveRoomNode(m, pGame, actNo, roomX, roomY, 1)

  if (dwUnitType === 4) {
    const ppOutNode = (pRoomCoords + 0x18) >>> 0
    m.setU32(ppOutNode, 0)
    let ok = 0
    if (hooks?.onSaveInactiveItemNode !== undefined) {
      ok = hooks.onSaveInactiveItemNode(m, pUnit, ppOutNode)
    }
    const pItemNode = m.u32(ppOutNode) >>> 0
    if (ok !== 0 && pItemNode !== 0) {
      m.setU32(pItemNode >>> 0, m.u32((pRoomNode + 0x0c) >>> 0) >>> 0)
      m.setU32((pRoomNode + 0x0c) >>> 0, pItemNode)
    }
    freeStackFrame(savedStack)
    return
  }

  if (dwUnitType === 2) {
    const hcIdx = (m.u32((pUnit + 0x04) | 0) >>> 0)
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, hcIdx)
    if (pObjTxt !== 0 && m.u8((pObjTxt + 0x154) >>> 0) !== 0) {
      const pObjNode = m.alloc(0x34) >>> 0
      for (let i = 0; i < 0x34; i += 4) {
        m.setU32((pObjNode + i) >>> 0, 0)
      }
      m.setU32(pObjNode >>> 0, (posX) >>> 0)
      m.setU32((pObjNode + 0x04) >>> 0, (posY) >>> 0)
      m.setU32((pObjNode + 0x08) >>> 0, m.u32((pUnit + 0x10) >>> 0) >>> 0)
      m.setU32((pObjNode + 0x0c) >>> 0, (hcIdx) >>> 0)

      if (UNITS_HasObjectSubClassBit0113c(m, pUnit) !== 0) {
        const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
        m.setU8((pObjNode + 0x1c) >>> 0, m.u8((pObjData + 0x04) >>> 0))
        m.setU8((pObjNode + 0x1d) >>> 0, m.u8((pObjData + 0x05) >>> 0))
        const pRoomDest = UNITS_GetRoom113c(m, pUnit)
        DUNGEON_GetRoomCoordinates113c(m, pRoomDest, pRoomCoords)
        m.setU32((pObjNode + 0x10) >>> 0, m.u32((pObjData + 0x08) >>> 0) >>> 0)
        m.setU32((pObjNode + 0x14) >>> 0, m.u32((pObjData + 0x0c) >>> 0) >>> 0)
        m.setU32((pObjNode + 0x18) >>> 0, ((m.u32((pUnit + 0x0c) | 0) >>> 0)) >>> 0)
        m.setU8((pObjNode + 0x1e) >>> 0, 1)
      }

      if (hcIdx === 0x9c || hcIdx === 0x9d) {
        const nextFrame = EVENT_GetNextEventFrame113c(m, pUnit, 5)
        const curFrame = (m.u32((pGame + 0x68) | 0) >>> 0)
        if (nextFrame > curFrame) {
          m.setU32((pObjNode + 0x20) >>> 0, ((nextFrame - curFrame) | 0) >>> 0)
        }
      }

      const pObjectData = m.u32((pUnit + 0x14) >>> 0) >>> 0
      if (pObjectData !== 0) {
        for (let i = 0; i < 8; i++) {
          m.setU32((pObjNode + 0x24 + i * 4) >>> 0, m.u32((pObjectData + 0x28 + i * 4) >>> 0) >>> 0)
        }
      }

      m.setU32((pObjNode + 0x30) >>> 0, m.u32((pRoomNode + 0x10) >>> 0) >>> 0)
      m.setU32((pRoomNode + 0x10) >>> 0, pObjNode)
    }
  }

  freeStackFrame(savedStack)
}

/**
 * Frees all `D2AiCmdStrc` nodes in the circular doubly-linked list at `[pAiGeneral + 0x24]`
 * and clears `[pAiGeneral + 0x20]` and `[pAiGeneral + 0x24]`.
 *
 * @va D2Game:0x6FC40B60 (91B)
 */
export function MONSTER_FreeAiCmdCircularList113c(
  m: Memory113c,
  _pGame: number,
  pAiGeneral: number,
): void {
  if (pAiGeneral === 0) return
  let pHead = m.u32((pAiGeneral + 0x24) >>> 0) >>> 0
  if (pHead === 0) return
  const pTail = m.u32((pHead + 0x1c) >>> 0) >>> 0
  if (pTail !== 0) {
    m.setU32((pTail + 0x18) >>> 0, 0)
  }
  while (pHead !== 0) {
    const pNext = m.u32((pHead + 0x18) >>> 0) >>> 0
    freeMemBlock(m, pHead)
    pHead = pNext
  }
  m.setU32((pAiGeneral + 0x20) >>> 0, 0)
  m.setU32((pAiGeneral + 0x24) >>> 0, 0)
}

/**
 * Frees `pAiGeneral`'s preset save header block (`+0x38`), minion list (`+0x34`),
 * AI command circular list (`+0x20..+0x24`), and `pAiGeneral` itself.
 *
 * @va D2Game:0x6FC40C00 (93B)
 */
export function MONSTER_FreeAiGeneral113c(
  m: Memory113c,
  pGame: number,
  pAiGeneral: number,
): void {
  if (pAiGeneral === 0) return
  DRLGPRESET_FreeSaveHeaderBlock113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, (pAiGeneral + 0x38) >>> 0)
  let pMinion = m.u32((pAiGeneral + 0x34) >>> 0) >>> 0
  while (pMinion !== 0) {
    const pNext = m.u32((pMinion + 0x04) >>> 0) >>> 0
    freeMemBlock(m, pMinion)
    pMinion = pNext
  }
  m.setU32((pAiGeneral + 0x34) >>> 0, 0)
  MONSTER_FreeAiCmdCircularList113c(m, pGame, pAiGeneral)
  freeMemBlock(m, pAiGeneral)
}

/**
 * Frees the singly-linked list of object region nodes at `[pObjRegion + 0x00]` (next at `+0x04`)
 * and frees `pObjRegion` itself.
 *
 * @va D2Game:0x6FC4E790 (60B)
 */
export function OBJECT_FreeObjectRegionData113c(
  m: Memory113c,
  _pGame: number,
  pObjRegion: number,
): void {
  if (pObjRegion === 0) return
  let pNode = m.u32(pObjRegion >>> 0) >>> 0
  while (pNode !== 0) {
    const pNext = m.u32((pNode + 0x04) >>> 0) >>> 0
    freeMemBlock(m, pNode)
    pNode = pNext
  }
  freeMemBlock(m, pObjRegion)
}

/**
 * Destroys an object unit's hover message (`+0xA4`), object region data (`UNITS_GetField7C`),
 * and unit events (`EVENT_RemoveUnitEvents`).
 *
 * @va D2Game:0x6FC4EE60 (53B)
 */
export function OBJECT_DestroyObjectUnit113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  if (pUnit === 0) return
  const pHoverMsg = m.u32((pUnit + 0xa4) >>> 0) >>> 0
  if (pHoverMsg !== 0) {
    CHAT_FreeHoverMsg113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, pHoverMsg)
  }
  const pObjRegion = UNITS_GetField7C_113c(m, pUnit)
  OBJECT_FreeObjectRegionData113c(m, pGame, pObjRegion)
  EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
}

/**
 * Frees the singly-linked quest chain attached to `[pUnit + 0x90]` (next at `+0x1C`)
 * and zeroes `[pUnit + 0x90]`.
 *
 * @va D2Game:0x6FC57220 (54B)
 */
export function QUESTS_FreeUnitQuestChain113c(
  m: Memory113c,
  _pGame: number,
  pUnit: number,
): void {
  if (pUnit === 0) return
  let pNode = m.u32((pUnit + 0x90) >>> 0) >>> 0
  while (pNode !== 0) {
    const pNext = m.u32((pNode + 0x1c) >>> 0) >>> 0
    freeMemBlock(m, pNode)
    pNode = pNext
  }
  m.setU32((pUnit + 0x90) >>> 0, 0)
}

/**
 * Frees the singly-linked NPC interaction list at `[pInteract + 0x00]` (next at `+0x08`)
 * and frees `pInteract` itself.
 *
 * @va D2Game:0x6FC683B0 (60B)
 */
export function MONSTER_FreeInteractData113c(
  m: Memory113c,
  _pGame: number,
  pInteract: number,
): void {
  if (pInteract === 0) return
  let pNode = m.u32(pInteract >>> 0) >>> 0
  while (pNode !== 0) {
    const pNext = m.u32((pNode + 0x08) >>> 0) >>> 0
    freeMemBlock(m, pNode)
    pNode = pNext
  }
  freeMemBlock(m, pInteract)
}

/**
 * Destroys a monster unit (`pUnit` in `edi`, `pGame` in `ebx`), freeing combat attacker lists,
 * non-vendor inventory items, hover messages, `pAiGeneral` (`+0x28`), `pAiParam` (`+0x2C`),
 * `pInteract` (`+0x30`), and unit events.
 *
 * @va D2Game:0x6FCCFB90 (183B)
 */
export function MONSTER_DestroyMonsterUnit113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (pUnit === 0) return
  SUNITDMG_FreeAttackerCombatList113c(m, pGame, pUnit)

  const hcIdx = (m.u32((pUnit + 0x04) | 0) >>> 0)
  const sgpt = getSgptDataTablesPtr(m)
  let pMonStats = 0
  if (sgpt !== 0 && hcIdx >= 0 && hcIdx < (m.u32((sgpt + 0xa80) | 0) >>> 0)) {
    const monStatsBase = m.u32((sgpt + 0xa78) >>> 0) >>> 0
    if (monStatsBase !== 0) {
      pMonStats = (monStatsBase + hcIdx * 0x1a8) >>> 0
    }
  }

  const maskByte = getBitMaskByte(m, 4, 2)
  if (pMonStats === 0 || (m.u8((pMonStats + 0x0d) >>> 0) & maskByte) === 0) {
    SUNIT_ClearUnitInventoryItems113c(m, pGame, pUnit, hooks)
    const pInv = m.u32((pUnit + 0x60) >>> 0) >>> 0
    if (pInv !== 0) {
      INVENTORY_FreeInventory113c(m, pInv)
      m.setU32((pUnit + 0x60) >>> 0, 0)
    }
  }

  const pHoverMsg = m.u32((pUnit + 0xa4) >>> 0) >>> 0
  if (pHoverMsg !== 0) {
    CHAT_FreeHoverMsg113c(m, m.u32((pGame + 0x1c) >>> 0) >>> 0, pHoverMsg)
    m.setU32((pUnit + 0xa4) >>> 0, 0)
  }

  const pMonsterData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pMonsterData !== 0) {
    MONSTER_FreeAiGeneral113c(m, pGame, m.u32((pMonsterData + 0x28) >>> 0) >>> 0)
    const pAiParam = m.u32((pMonsterData + 0x2c) >>> 0) >>> 0
    if (pAiParam !== 0) {
      freeMemBlock(m, pAiParam)
    }
    MONSTER_FreeInteractData113c(m, pGame, m.u32((pMonsterData + 0x30) >>> 0) >>> 0)
  }

  EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
}

/**
 * Returns `byte [pUnit + 0x78]` (`nUnitField78`).
 *
 * @va D2Game:0x6FCFF6C0 (39B)
 */
export function SUNIT_GetUnitField78_113c(
  m: Memory113c,
  pUnit: number,
): number {
  return m.u8((pUnit + 0x78) >>> 0)
}

/**
 * Deactivates `pUnit` (`dwUnitType` `0..3`), removes path collision for types `1..3`,
 * removes from room if `bKeepInRoom == 0`, and removes from the server unit list.
 *
 * @va D2Game:0x6FD00C80 (103B)
 */
export function SUNIT_DeactivateAndRemoveUnit113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  bKeepInRoom: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (pUnit === 0) return
  const dwUnitType = m.u32(pUnit >>> 0) >>> 0
  if (dwUnitType <= 3) {
    if (hooks?.onDeactivateUnitInteractions !== undefined) {
      hooks.onDeactivateUnitInteractions(m, pUnit, pGame)
    } else if (m.u8((pUnit + 0x6c) >>> 0) !== 0) {
      m.setU32((pUnit + 0x64) >>> 0, 0xffffffff)
      m.setU32((pUnit + 0x68) >>> 0, 6)
      m.setU8((pUnit + 0x6c) >>> 0, 0)
    }
    if (dwUnitType >= 1) {
      PATH_RemoveUnitCollisionIfHasPath113c(m, pUnit)
    }
  }
  if (bKeepInRoom === 0) {
    UNITROOM_RemoveUnitFromRoom113c(m, pUnit)
  }
  SUNIT_RemoveServerUnit113c(m, pGame, pUnit)
}

/**
 * Iterates `pUnit->pInventory` (`[pUnit + 0x60]`), removes every item (including the cursor item),
 * and deletes each item server unit.
 *
 * @va D2Game:0x6FD01110 (445B)
 */
export function SUNIT_ClearUnitInventoryItems113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
  hooks?: Post150LaneI1Hooks113c,
): void {
  if (pUnit === 0) return
  const pInv = m.u32((pUnit + 0x60) >>> 0) >>> 0
  if (pInv === 0) return

  const savedStack = laneI1StackPtr
  const pScratch = allocStackFrame(m, 0x20)

  let pItem = INVENTORY_GetFirstItem113c(m, pInv)
  while (pItem !== 0) {
    const pNext = INVENTORY_GetNextItem113c(m, pItem)
    const pValidItem = INVENTORY_UnitIsItem113c(m, pItem)
    const invPage = ITEMS_GetInvPage113c(m, pValidItem)

    let posX = 0
    let posY = 0
    const itemType = m.u32(pValidItem >>> 0)
    if (itemType === 0 || itemType === 1 || itemType === 3) {
      const pPath = m.u32((pValidItem + 0x2c) >>> 0) >>> 0
      if (pPath !== 0) {
        posX = PATH_GetPosX113c(m, pPath)
        posY = PATH_GetPosY113c(m, pPath)
      }
    } else {
      const pStaticPath = m.u32((pValidItem + 0x2c) >>> 0) >>> 0
      if (pStaticPath !== 0) {
        posX = (m.u32((pStaticPath + 0x04) | 0) >>> 0)
        posY = (m.u32((pStaticPath + 0x08) | 0) >>> 0)
      }
    }

    const posOther = INVENTORY_GetItemNodePositionOther113c(m, pValidItem)
    const bodyLoc = INVENTORY_GetItemBodyLocFromX113c(m, pInv, pValidItem)

    if (posOther === 4) {
      if (invPage !== 0xff) {
        const invRecId = UNITS_GetInventoryRecordId113c(
          m,
          pUnit,
          invPage,
          m.u32((pGame + 0x70) >>> 0) >>> 0,
        )
        INVENTORY_NoOpRet20113c(
          m,
          pUnit,
          invRecId,
          pValidItem,
          posX,
          posY,
          0,
          pScratch,
          (pScratch + 4) >>> 0,
        )
        {
          INVENTORY_RemoveItemFromInventory113c(m, pInv, pValidItem)
          if (
            invPage === 0 &&
            ITEMS_CanUseCharmInInventory113c(m, pUnit, pValidItem) !== 0 &&
            hooks?.onNotifyCharmUnequip !== undefined
          ) {
            hooks.onNotifyCharmUnequip(m, pGame, pUnit, pValidItem)
          }
          if (hooks?.onDeleteServerUnit !== undefined) {
            hooks.onDeleteServerUnit(m, pGame, pValidItem)
          } else {
            SUNIT_RemoveServerUnit113c(m, pGame, pValidItem)
          }
        }
      }
    } else if (posOther === 1) {
      INVENTORY_NoOpRet8B113c(m, pInv, pValidItem)
      if (bodyLoc >= 0) {
        INVENTORY_RemoveItemFromInventory113c(m, pInv, pValidItem)
        if (hooks?.onDeleteServerUnit !== undefined) {
          hooks.onDeleteServerUnit(m, pGame, pValidItem)
        } else {
          SUNIT_RemoveServerUnit113c(m, pGame, pValidItem)
        }
      }
    } else if (posOther === 3) {
      INVENTORY_RemoveItemFromInventory113c(m, pInv, pValidItem)
      if (hooks?.onDeleteServerUnit !== undefined) {
        hooks.onDeleteServerUnit(m, pGame, pValidItem)
      } else {
        SUNIT_RemoveServerUnit113c(m, pGame, pValidItem)
      }
    }

    pItem = pNext
  }

  const pCursorItem = INVENTORY_GetCursorItem113c(m, pInv)
  if (pCursorItem !== 0) {
    INVENTORY_RemoveItemFromInventory113c(m, pInv, pCursorItem)
    if (hooks?.onDeleteServerUnit !== undefined) {
      hooks.onDeleteServerUnit(m, pGame, pCursorItem)
    } else {
      SUNIT_RemoveServerUnit113c(m, pGame, pCursorItem)
    }
  }

  freeStackFrame(savedStack)
}

/**
 * Unlinks `pUnit` (`esi`) from its room update list at `[pGame + listIdx*4 + 0x10F8]`
 * (`listIdx = [pUnit + 0xD0]`), frees the 12-byte doubly-linked node, and sets `[pUnit + 0xD0] = 0x0B`.
 *
 * @va D2Game:0x6FD0FC60 (209B)
 */
export function SUNIT_UnlinkFromRoomUpdateList113c(
  m: Memory113c,
  pGame: number,
  pUnit: number,
): void {
  if (pUnit === 0) return
  const listIdx = m.u32((pUnit + 0xd0) >>> 0) >>> 0
  if (listIdx === 0x0b) return
  let pNode = m.u32((pGame + listIdx * 4 + 0x10f8) >>> 0) >>> 0
  while (pNode !== 0) {
    if (m.u32(pNode >>> 0) >>> 0 === (pUnit >>> 0)) {
      const pNext = m.u32((pNode + 0x04) >>> 0) >>> 0
      if (pNext !== 0) {
        m.setU32((pNext + 0x08) >>> 0, m.u32((pNode + 0x08) >>> 0) >>> 0)
      }
      const pPrev = m.u32((pNode + 0x08) >>> 0) >>> 0
      if (pPrev !== 0) {
        m.setU32((pPrev + 0x04) >>> 0, m.u32((pNode + 0x04) >>> 0) >>> 0)
      } else {
        m.setU32((pGame + listIdx * 4 + 0x10f8) >>> 0, m.u32((pNode + 0x04) >>> 0) >>> 0)
      }
      freeMemBlock(m, pNode)
      m.setU32((pUnit + 0xd0) >>> 0, 0x0b)
      return
    }
    pNode = m.u32((pNode + 0x04) >>> 0) >>> 0
  }
}
